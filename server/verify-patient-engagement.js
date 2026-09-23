/**
 * Verification: Patient <-> Student engagement (CRM v2.1)
 *  - RSVP (Attending / Not Attending / Need Help -> re-opens the student's follow-up call)
 *  - Patient confirms the student's campaign call
 *  - Hospital callback requests: create, hospital acknowledge/schedule/resolve (HMS contract), patient confirm/dispute, cancel
 */
const http = require('node:http');
const express = require('express');
const { initDatabase, db } = require('../backend/config/db');
const apiRoutes = require('../backend/routes');

initDatabase();

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ✅ PASS: ${name}`); }
  else { failed++; console.log(`  ❌ FAIL: ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function call(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } resolve({ status: res.statusCode, data: j }); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🤝 PATIENT <-> STUDENT ENGAGEMENT VERIFICATION');
  console.log('====================================================');

  // Fixture: a linked patient + a campaign notification for them
  const student = db.prepare('SELECT * FROM students ORDER BY id LIMIT 1').get();
  const uid = `PAT-TEST-${Date.now() % 100000}`;
  const phone = `9${String(Date.now()).slice(-9)}`;
  const pid = Number(db.prepare(`INSERT INTO patients (patient_uid, name, phone, pin, model_type, student_id) VALUES (?, 'Engagement Test', ?, '1234', 'Dependent', ?)`).run(uid, phone, student.id).lastInsertRowid);
  const indep = Number(db.prepare(`INSERT INTO patients (patient_uid, name, phone, pin, model_type) VALUES (?, 'Independent Test', ?, '1234', 'Independent')`).run(uid + 'I', String(Number(phone) - 1)).lastInsertRowid);
  const campId = Number(db.prepare(`INSERT INTO campaigns (title, keyword, description, status) VALUES ('Engagement Test Camp', 'HTN', 'Test', 'Active')`).run().lastInsertRowid);
  const notifId = Number(db.prepare(`INSERT INTO campaign_notifications (campaign_id, patient_id, student_id, matched_keyword, matched_condition_detail) VALUES (?, ?, ?, 'HTN', 'Hypertension (BP: 150/95 mmHg)')`).run(campId, pid, student.id).lastInsertRowid);

  const app = express(); app.use(express.json()); app.use('/api', apiRoutes);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const P = { 'X-Patient-Id': String(pid) };
  const S = { 'X-Student-Id': String(student.id) };

  try {
    console.log('\n1. Campaign alerts');
    let r = await call(port, 'POST', '/api/patient/notifications/mark-read', P);
    check('mark-read updates delivered alerts', r.status === 200 && r.data.updated >= 1, r.data);
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/rsvp`, P, { rsvp: 'Maybe' });
    check('invalid RSVP rejected with 400', r.status === 400, r);
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/rsvp`, P, { rsvp: 'Attending', note: 'Coming with my son' });
    check('RSVP Attending -> status Acknowledged', r.status === 200 && r.data.notification.rsvp === 'Attending' && r.data.notification.status === 'Acknowledged', r.data);
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/rsvp`, P, { rsvp: 'Need Help', note: 'No transport' });
    check('RSVP Need Help re-opens student follow-up call', r.status === 200 && r.data.notification.rsvp === 'Need Help' && r.data.notification.cadet_call_status === 'Pending', r.data);
    r = await call(port, 'GET', '/api/patient/notifications', P);
    const n = (r.data.notifications || []).find((x) => x.notification_id === notifId);
    check('patient feed exposes rsvp + reason', n && n.rsvp === 'Need Help' && /Hypertension/.test(n.matched_condition_detail), n);
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/rsvp`, { 'X-Patient-Id': String(indep) }, { rsvp: 'Attending' });
    check('other patient cannot RSVP (404)', r.status === 404, r);

    console.log('\n2. Patient confirms student call');
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/confirm-contact`, P, { confirmed: true });
    check('cannot confirm before student marks contacted', r.status === 400, r);
    r = await call(port, 'POST', `/api/student/campaign-tasks/${notifId}/status`, S, { callStatus: 'Contacted' });
    check('student marks Contacted', r.status === 200 && r.data.task.contacted_at, r.data);
    r = await call(port, 'POST', `/api/patient/notifications/${notifId}/confirm-contact`, P, { confirmed: true });
    check('patient confirms call', r.status === 200 && r.data.notification.patient_contact_confirmation === 'Confirmed', r.data);
    r = await call(port, 'GET', '/api/student/campaign-tasks', S);
    const t = (r.data.tasks || []).find((x) => x.notification_id === notifId);
    check('student sees patient confirmation + RSVP', t && t.patient_contact_confirmation === 'Confirmed' && t.rsvp === 'Need Help', t);

    console.log('\n3. Hospital callback requests');
    const HA = { 'X-Hospital-Admin-Id': '1' };
    r = await call(port, 'GET', '/api/patient/hospital', P);
    check('patient sees their hospital + departments', r.status === 200 && r.data.hospital && r.data.hospital.name && r.data.departments.length > 3, r.data);
    r = await call(port, 'POST', '/api/patient/hospital-requests', P, { channel: 'Fax' });
    check('invalid channel rejected', r.status === 400, r);
    r = await call(port, 'POST', '/api/patient/hospital-requests', P, { channel: 'WhatsApp', department: 'Cardiology (Heart / BP)', reason: 'Medicine query', message: 'Can I take BP tablet at night?', preferred_time: 'Evening' });
    check('patient creates hospital request (201)', r.status === 201 && r.data.request.status === 'Open' && r.data.request.hospital_id, r.data);
    const reqId = r.data.request && r.data.request.id;
    r = await call(port, 'POST', '/api/patient/hospital-requests', { 'X-Patient-Id': String(indep) }, { for_member_id: r.data.request.for_member_id });
    check('cannot request for another family\'s member (403)', r.status === 403, r);
    r = await call(port, 'GET', '/api/crm/hospital/callback-requests', HA);
    check('HMS contract: hospital queue lists request', r.status === 200 && r.data.requests.some((x) => x.id === reqId), r.data);
    r = await call(port, 'GET', '/api/crm/hospital/callback-requests');
    check('HMS contract: unauthenticated rejected (401)', r.status === 401, r);
    r = await call(port, 'POST', `/api/crm/hospital/callback-requests/${reqId}/status`, HA, { status: 'Scheduled' });
    check('scheduling without a time is rejected', r.status === 400, r);
    r = await call(port, 'POST', `/api/crm/hospital/callback-requests/${reqId}/status`, HA, { status: 'Scheduled', scheduled_for: 'Mon 10:30 AM, OPD 4', note: 'Please bring old prescriptions' });
    check('hospital schedules appointment', r.status === 200 && r.data.request.status === 'Scheduled' && r.data.request.handled_by_name, r.data);
    r = await call(port, 'POST', `/api/patient/hospital-requests/${reqId}/confirm`, P, { confirmed: true });
    check('patient cannot confirm before resolved', r.status === 400, r);
    r = await call(port, 'POST', `/api/crm/hospital/callback-requests/${reqId}/status`, HA, { status: 'Resolved', note: 'Night dose is fine' });
    check('hospital resolves with note', r.status === 200 && r.data.request.status === 'Resolved', r.data);
    r = await call(port, 'POST', `/api/patient/hospital-requests/${reqId}/confirm`, P, { confirmed: false });
    check('patient disputes -> request re-opened', r.status === 200 && r.data.request.status === 'Open' && r.data.request.patient_confirmation === 'Disputed', r.data);
    r = await call(port, 'POST', `/api/patient/hospital-requests/${reqId}/cancel`, P);
    check('patient cancels request', r.status === 200 && r.data.request.status === 'Cancelled', r.data);
    r = await call(port, 'POST', `/api/crm/hospital/callback-requests/${reqId}/status`, HA, { status: 'Resolved' });
    check('hospital cannot act on cancelled request', r.status === 400, r);
    r = await call(port, 'GET', '/api/patient/hospital-requests', P);
    check('patient history lists requests', r.status === 200 && r.data.total >= 1, r.data);
    r = await call(port, 'GET', '/api/student/contact-requests', S);
    check('old student request inbox removed (404)', r.status === 404, r);
  } finally {
    server.close();
    db.prepare('DELETE FROM hospital_callback_requests WHERE patient_id IN (?, ?)').run(pid, indep);
    for (const id of [pid, indep]) {
      const row = db.prepare('SELECT family_id FROM patients WHERE id = ?').get(id);
      db.prepare('DELETE FROM patients WHERE id = ?').run(id);
      if (row && row.family_id) db.prepare("DELETE FROM families WHERE id = ? AND family_code LIKE 'FAM-PAT-%'").run(row.family_id);
    }
    db.prepare('DELETE FROM campaign_notifications WHERE campaign_id = ?').run(campId);
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campId);
  }

  console.log('----------------------------------------------------');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error('Fatal test error:', e); process.exit(1); });
