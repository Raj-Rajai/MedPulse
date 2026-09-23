/**
 * Verification: Patient profile card + head-of-family household (CRM v2.2)
 *  - Registration auto-creates the card + household (patient = head)
 *  - Profile edits (blood group, emergency contact, DOB) with validation; no PIN leaks
 *  - Head can add / edit / remove own family members; medical fields stay read-only
 *  - Second account in the same family is read-only; no access across families
 *  - Linking a student lets the student adopt the family
 */
const http = require('node:http');
const express = require('express');
const { initDatabase, db } = require('../backend/config/db');
const apiRoutes = require('../backend/routes');

initDatabase();

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ✅ PASS: ${name}`); }
  else { failed++; console.log(`  ❌ FAIL: ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); }
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
  console.log('👪 PATIENT PROFILE CARD & FAMILY VERIFICATION');
  console.log('====================================================');

  const app = express(); app.use(express.json()); app.use('/api', apiRoutes);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const stamp = String(Date.now()).slice(-8);
  const phoneA = `70${stamp}`, phoneKid = `71${stamp}`;
  const created = [];

  try {
    console.log('\n1. Registration auto-creates card + household');
    let r = await call(port, 'POST', '/api/patient/register', {}, { name: 'Test Head Patel', phone: phoneA, pin: '4321', gender: 'Male', age_years: 45 });
    check('register independent patient (201)', r.status === 201, r.data);
    const pid = r.data.patient && r.data.patient.id; created.push(pid);
    const A = { 'X-Patient-Id': String(pid) };
    r = await call(port, 'GET', '/api/patient/card', A);
    const card = r.data.card || {};
    check('card exists with UID, family and Head role', r.status === 200 && card.patient_uid && card.family_id && card.family_role === 'Head' && card.family_size === 1, card);
    check('card never exposes PIN', !('pin' in card), card);
    check('card includes hospital for calling', !!card.hospital_name, card);

    console.log('\n2. Profile edits');
    r = await call(port, 'PUT', '/api/patient/profile', A, { blood_group: 'Z+' });
    check('invalid blood group rejected', r.status === 400, r.data);
    r = await call(port, 'PUT', '/api/patient/profile', A, { emergency_contact_phone: phoneA });
    check('own phone as emergency contact rejected', r.status === 400, r.data);
    r = await call(port, 'PUT', '/api/patient/profile', A, { date_of_birth: '2999-01-01' });
    check('future DOB rejected', r.status === 400, r.data);
    r = await call(port, 'PUT', '/api/patient/profile', A, { blood_group: 'B+', date_of_birth: '1980-05-15', address: '12 MG Road, Gandhinagar', emergency_contact_name: 'Asha Patel', emergency_contact_phone: '9898989898', emergency_contact_relation: 'Spouse' });
    check('profile saved; age computed from DOB', r.status === 200 && r.data.card.blood_group === 'B+' && r.data.card.age_years >= 45 && r.data.card.emergency_contact_phone === '9898989898', r.data);

    console.log('\n3. Head manages family');
    r = await call(port, 'GET', '/api/patient/family', A);
    const selfId = r.data.members && r.data.members[0].id;
    check('family lists self first, head can edit', r.status === 200 && r.data.can_edit && r.data.members[0].is_self && r.data.members[0].name === 'Test Head Patel', r.data);
    r = await call(port, 'POST', '/api/patient/family/members', A, { name: 'Kid Patel', relation_to_hof: 'Son', gender: 'M' });
    check('missing age/DOB rejected', r.status === 400, r.data);
    r = await call(port, 'POST', '/api/patient/family/members', A, { name: 'Kid Patel', relation_to_hof: 'Head', gender: 'M', age_years: 12 });
    check('second Head rejected', r.status === 400, r.data);
    r = await call(port, 'POST', '/api/patient/family/members', A, { name: 'Kid Patel', relation_to_hof: 'Son', gender: 'M', date_of_birth: '2012-03-10', contact_number: phoneKid });
    const kidId = r.data.id;
    check('head adds son (201) with age from DOB', r.status === 201 && r.data.members.some((m) => m.id === kidId && m.age_years >= 13 && m.can_delete), r.data);
    r = await call(port, 'POST', '/api/patient/family/members', A, { name: 'kid patel', relation_to_hof: 'Son', gender: 'M', age_years: 12 });
    check('duplicate name rejected (409)', r.status === 409, r.data);
    r = await call(port, 'PUT', `/api/patient/family/members/${kidId}`, A, { occupation: 'Student', education: 'Class 8', sbp: 200 });
    const kid = (r.data.members || []).find((m) => m.id === kidId) || {};
    check('head edits basic fields; medical field ignored; tagged as patient edit', r.status === 200 && kid.occupation === 'Student' && !kid.sbp && kid.patient_updated_at, kid);
    r = await call(port, 'PUT', `/api/patient/family/members/${selfId}`, A, { name: 'X' });
    check('self edits go through Profile (400)', r.status === 400, r.data);
    r = await call(port, 'PUT', '/api/patient/family', A, { family_name: 'Patel Parivar', pincode: '12' });
    check('bad PIN code rejected', r.status === 400, r.data);
    r = await call(port, 'PUT', '/api/patient/family', A, { family_name: 'Patel Parivar', village: 'Sector 21', pincode: '382021' });
    check('head updates family address', r.status === 200 && r.data.family.family_name === 'Patel Parivar', r.data);

    console.log('\n4. Access boundaries');
    r = await call(port, 'POST', '/api/patient/register', {}, { name: 'Kid Patel', phone: phoneKid, pin: '1111', gender: 'Male', age_years: 13 });
    const kidPid = r.data.patient && r.data.patient.id; created.push(kidPid);
    const K = { 'X-Patient-Id': String(kidPid) };
    r = await call(port, 'GET', '/api/patient/family', K);
    check('second account joins same family as read-only Member', r.status === 200 && r.data.role === 'Member' && !r.data.can_edit && r.data.members.length === 2, r.data);
    r = await call(port, 'POST', '/api/patient/family/members', K, { name: 'Someone', relation_to_hof: 'Other', gender: 'F', age_years: 30 });
    check('member account cannot add (403)', r.status === 403, r.data);
    const surveyed = db.prepare("SELECT id, family_id FROM patients WHERE family_id IS NOT NULL AND id NOT IN (?, ?) LIMIT 1").get(pid, kidPid)
      || db.prepare("SELECT p.id, fm.family_id FROM patients p JOIN family_members fm ON fm.id = p.family_member_id WHERE p.id NOT IN (?, ?) LIMIT 1").get(pid, kidPid);
    if (surveyed) {
      const other = db.prepare('SELECT id FROM family_members WHERE family_id = ? LIMIT 1').get(surveyed.family_id);
      r = await call(port, 'PUT', `/api/patient/family/members/${other.id}`, A, { occupation: 'Hacker' });
      check('cannot edit another family\'s member (404)', r.status === 404, r.data);
    }
    r = await call(port, 'DELETE', `/api/patient/family/members/${kidId}`, A);
    check('cannot remove member who has own account (403)', r.status === 403, r.data);
    r = await call(port, 'POST', '/api/patient/family/members', A, { name: 'Temp Relative', relation_to_hof: 'Other', gender: 'F', age_years: 70 });
    const tempId = r.data.id;
    r = await call(port, 'DELETE', `/api/patient/family/members/${tempId}`, A);
    check('head removes member they added', r.status === 200 && !r.data.members.some((m) => m.id === tempId), r.data);
    r = await call(port, 'GET', '/api/patient/family');
    check('unauthenticated rejected (401)', r.status === 401, r.data);

    console.log('\n5. Linking a student adopts the family');
    const student = db.prepare('SELECT id, referral_code FROM students WHERE referral_code IS NOT NULL LIMIT 1').get();
    if (student) {
      r = await call(port, 'POST', '/api/patient/link-referral', A, { referral_code: student.referral_code });
      const fam = db.prepare('SELECT f.student_id FROM families f JOIN patients p ON p.family_id = f.id WHERE p.id = ?').get(pid);
      check('student now owns the household (appears in their survey)', r.status === 200 && fam && fam.student_id === student.id, { r: r.data, fam });
    }
  } finally {
    server.close();
    for (const id of created.filter(Boolean)) {
      const row = db.prepare('SELECT family_id FROM patients WHERE id = ?').get(id);
      db.prepare('DELETE FROM hospital_callback_requests WHERE patient_id = ?').run(id);
      db.prepare('DELETE FROM campaign_notifications WHERE patient_id = ?').run(id);
      db.prepare('DELETE FROM patients WHERE id = ?').run(id);
      if (row && row.family_id) db.prepare("DELETE FROM families WHERE id = ? AND family_code LIKE 'FAM-PAT-%'").run(row.family_id);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error('Fatal test error:', e); process.exit(1); });
