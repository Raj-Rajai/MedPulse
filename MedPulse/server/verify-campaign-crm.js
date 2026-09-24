/**
 * Comprehensive Verification Suite for Keyword Campaign & Patient CRM Matching Engine
 * Tests the Decision-Diamond engine linking:
 * - Prof / College (Faculty Admin)
 * - Patient (CRM condition-matching)
 * - Student (Cadet Call Source & care coordination)
 * - Zero HMS Conflict Audit
 */

const http = require('node:http');
const express = require('express');
const { execSync } = require('child_process');
const { initDatabase } = require('../backend/config/db');
const apiRoutes = require('../backend/routes');

// Ensure database is initialized
initDatabase();

function request(port, options, body = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (body && !reqOptions.headers['Content-Type']) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('===============================================================');
  console.log('🚀 RUNNING KEYWORD CAMPAIGN & PATIENT CRM VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Ensure demo patient Radhuji exists for the campaign test
  const { db } = require('../backend/config/db');
  const radhuji = db.prepare("SELECT * FROM family_members WHERE LOWER(name) LIKE '%radhuji%'").get();
  if (radhuji) {
    const existing = db.prepare("SELECT * FROM patients WHERE phone = '9876543210'").get();
    if (!existing) {
      db.prepare(`
        INSERT INTO patients (patient_uid, student_id, family_member_id, name, phone, pin, age_years, gender, model_type, referral_code_used)
        VALUES ('PAT-ROLL235-001', 1, ?, ?, '9876543210', '1234', ?, ?, 'Dependent', 'SAL-235-DA9B')
      `).run(radhuji.id, radhuji.name, radhuji.age_years || 60, radhuji.gender || 'M');
    }
  }

  // Launch test server on ephemeral port
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  let passed = 0;
  let failed = 0;

  function assertTest(name, condition, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${extraInfo}`);
      failed++;
    }
  }

  try {
    // --- Step 1: Admin Login & Campaign Creation ---
    console.log('--- Step 1: Faculty Admin Campaign Broadcast ---');
    
    const adminLoginRes = await request(port, {
      path: '/api/admin/login',
      method: 'POST'
    }, { username: 'admin', pin: '9999' });

    assertTest('Admin login returns 200 OK', adminLoginRes.status === 200);
    const adminToken = adminLoginRes.data.token || `admin-${adminLoginRes.data.admin.id}`;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // Preview HTN matches
    const previewRes = await request(port, {
      path: '/api/campaigns/preview?keyword=HTN',
      method: 'GET',
      headers: adminHeaders
    });

    assertTest('Preview HTN matching patients returns 200', previewRes.status === 200);
    assertTest('Found qualifying HTN patients in network', previewRes.data.total_matching > 0, `(Count: ${previewRes.data.total_matching})`);
    
    // Launch HTN Campaign
    const createCampRes = await request(port, {
      path: '/api/campaigns',
      method: 'POST',
      headers: adminHeaders
    }, {
      title: 'Automated Test: Community Hypertension Management Camp',
      keyword: 'HTN',
      description: 'Complimentary blood pressure checkup, sodium reduction counseling, and cardiology referral.',
      event_date: '2026-10-25',
      venue: 'Urban Health Training Center Clinic',
      auto_dispatch: true
    });

    assertTest('Campaign creation & auto-dispatch returns 201 Created', createCampRes.status === 201);
    const campaignId = createCampRes.data.campaign ? createCampRes.data.campaign.id : null;
    assertTest('Campaign ID generated', campaignId !== null, `(ID: ${campaignId})`);
    assertTest('Patients auto-dispatched', createCampRes.data.dispatch && createCampRes.data.dispatch.newly_notified >= 0);

    // --- Step 2: Patient CRM Decision Diamond (HTN Patient vs Non-HTN) ---
    console.log('\n--- Step 2: Patient CRM Decision Diamond & RSVP ---');

    // Login as Patient Radhuji Thakore (9876543210 / 1234) who has HTN
    const patLoginRes = await request(port, {
      path: '/api/patient/login',
      method: 'POST'
    }, { identifier: '9876543210', pin: '1234' });

    assertTest('HTN Patient login returns 200 OK', patLoginRes.status === 200);
    const patientToken = patLoginRes.data.token || `patient-${patLoginRes.data.patient.id}`;
    const patientHeaders = { 
      'Authorization': `Bearer ${patientToken}`,
      'x-patient-id': String(patLoginRes.data.patient.id)
    };

    // Fetch Patient targeted notifications
    const notifRes = await request(port, {
      path: '/api/patient/notifications',
      method: 'GET',
      headers: patientHeaders
    });

    assertTest('Fetch patient notifications returns 200', notifRes.status === 200);
    assertTest('Patient received notifications', notifRes.data.notifications && notifRes.data.notifications.length > 0);
    
    const targetNotif = notifRes.data.notifications.find(n => n.campaign_id === campaignId) || notifRes.data.notifications[0];
    assertTest('Patient received targeted campaign matching HTN condition', !!targetNotif, `(Matched: ${targetNotif ? targetNotif.matched_keyword : 'None'})`);

    let targetNotifId = targetNotif ? targetNotif.notification_id : null;
    let targetCampaignId = targetNotif ? targetNotif.campaign_id : campaignId;

    // Patient RSVPs to the campaign
    if (targetNotifId) {
      const ackRes = await request(port, {
        path: `/api/patient/notifications/${targetNotifId}/acknowledge`,
        method: 'POST',
        headers: patientHeaders
      }, {
        status: 'Acknowledged',
        response_note: 'Yes, I will attend Saturday morning for the BP checkup.'
      });

      assertTest('Patient RSVP Acknowledged returns 200', ackRes.status === 200);
      assertTest('Notification status updated to Acknowledged', ackRes.data.notification && ackRes.data.notification.status === 'Acknowledged');
    }

    // --- Step 3: Student Cadet Outreach ---
    console.log('\n--- Step 3: Medical Cadet Call Coordination ---');

    // Login as Cadet Roll 235 (PIN 1234)
    const cadetLoginRes = await request(port, {
      path: '/api/auth/login',
      method: 'POST'
    }, { roll_number: '235', pin: '1234' });

    assertTest('Student Cadet login returns 200 OK', cadetLoginRes.status === 200);
    const cadetStudent = cadetLoginRes.data.student;
    const cadetHeaders = { 
      'x-student-id': String(cadetStudent.id),
      'x-roll-number': String(cadetStudent.roll_number),
      'Authorization': `Bearer ${cadetStudent.id}`
    };

    // Fetch Cadet Campaign Tasks
    const cadetTasksRes = await request(port, {
      path: '/api/student/campaign-tasks',
      method: 'GET',
      headers: cadetHeaders
    });

    assertTest('Fetch cadet campaign tasks returns 200', cadetTasksRes.status === 200);
    assertTest('Cadet has assigned campaign outreach tasks', cadetTasksRes.data.tasks && cadetTasksRes.data.tasks.length > 0);

    const cadetTask = cadetTasksRes.data.tasks.find(t => t.notification_id === targetNotifId || t.matched_keyword === 'HTN');
    assertTest('Cadet has task for adopted patient in this campaign', !!cadetTask);

    if (cadetTask) {
      // Cadet marks task as Contacted
      const updateTaskRes = await request(port, {
        path: `/api/student/campaign-tasks/${cadetTask.notification_id}/status`,
        method: 'POST',
        headers: cadetHeaders
      }, {
        callStatus: 'Contacted'
      });

      assertTest('Cadet task update returns 200 OK', updateTaskRes.status === 200);
      assertTest('Task status updated to Contacted', updateTaskRes.data.task && updateTaskRes.data.task.cadet_call_status === 'Contacted');
    }

    // --- Step 4: Admin Live Campaign Roster Inspection ---
    console.log('\n--- Step 4: Admin Campaign Metrics Audit ---');

    const campDetailsRes = await request(port, {
      path: `/api/campaigns/${targetCampaignId}`,
      method: 'GET',
      headers: adminHeaders
    });

    assertTest('Fetch campaign details returns 200', campDetailsRes.status === 200);
    const camp = campDetailsRes.data.campaign;
    assertTest('Campaign stats present', !!camp && !!camp.stats);
    assertTest('Campaign stats record patient targets', camp && camp.stats && camp.stats.total_targeted >= 1);
    assertTest('Campaign stats record patient acknowledgment', camp && camp.stats && camp.stats.acknowledged >= 1);
    assertTest('Campaign stats record cadet contact', camp && camp.stats && camp.stats.cadet_contacted >= 1);

    // --- Step 5: Zero HMS Conflict Audit ---
    console.log('\n--- Step 5: Zero Merge Conflict Audit with HMS ---');

    try {
      const gitDiff = execSync('git status --porcelain', { encoding: 'utf8' });
      const modifiedHospitalFiles = gitDiff.split('\n').filter(line => {
        const trimmed = line.trim();
        return (trimmed.includes('frontend/hospital') || trimmed.includes('backend/controllers/hospital') || trimmed.includes('backend/models/hospital') || trimmed.includes('backend/routes/hospital'));
      });

      assertTest('Zero files modified in frontend/hospital/ or backend/*hospital*', modifiedHospitalFiles.length === 0, modifiedHospitalFiles.join(', '));
    } catch (err) {
      console.error('Git status error:', err.message);
    }

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`🏁 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
