const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const fs = require('node:fs');

// Use isolated in-memory database to test the model & endpoints cleanly
const db = new Database(':memory:');
db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
require.cache[require.resolve('../backend/config/db')] = { exports: { db, initDatabase() {} } };

db.exec(`
  INSERT INTO colleges(id, name, code) VALUES(1, 'Test Medical College', 'TEST');
  INSERT INTO students(id, roll_number, name, college_id) VALUES(1, '235', 'Student Dhruv', 1);
  INSERT INTO hospitals(id, name, code) VALUES(1, 'Civil Hospital', 'CH1');
  INSERT INTO hospital_admins(id, hospital_id, username, name, role) VALUES(1, 1, 'admin1', 'Dr. Ramesh Patel', 'Hospital Super Admin');
  INSERT INTO families(id, student_id, family_no, family_code, head_of_family, village_ward) VALUES(1, 1, 1, 'FAM-TEST-01', 'Ramanlal Thakor', 'Adalaj');
  INSERT INTO family_members(id, family_id, member_order, name, age_years, gender, has_htn, sbp, dbp, contact_number)
  VALUES(1, 1, 1, 'Kantilal Thakor', 52, 'M', 'Y', 145, 92, '9876543210');
`);

const app = require('../backend/server');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function req(url, { method = 'GET', body } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Hospital-Admin-Id': '1'
    };
    const res = await fetch(base + '/api/' + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json() };
  }

  try {
    console.log('1. Testing GET /api/hospital/visits/summary (empty initially)');
    const summary1 = await req('hospital/visits/summary');
    assert.equal(summary1.status, 200);
    assert.equal(summary1.data.total_registered, 0);

    console.log('2. Registering an FAP patient visit into hospital records (POST /api/hospital/visits)');
    const regPayload = {
      family_member_id: 1,
      patient_name: 'Kantilal Thakor',
      age_years: 52,
      gender: 'M',
      contact_number: '9876543210',
      address: 'Adalaj, Gandhinagar',
      village: 'Adalaj',
      family_code: 'FAM-TEST-01',
      student_name: 'Student Dhruv',
      student_roll: '235',
      visit_date: '2026-09-24',
      department: 'General Medicine',
      attending_doctor: 'Dr. Ramesh Patel',
      visit_type: 'FAP Survey Referral',
      chief_complaint: 'Headache and occasional dizziness for 4 days',
      symptoms_duration: '4 days',
      sbp: 148,
      dbp: 94,
      pulse: 78,
      temperature: 98.4,
      rbs: 135,
      existing_conditions: 'Hypertension',
      allergies: 'None known',
      diagnosis: 'Essential Hypertension Stage 1',
      treatment_prescribed: 'Tab Amlodipine 5mg OD x 14 days, dietary salt restriction',
      disposition: 'Discharged OPD',
      follow_up_advice: 'Review BP in 14 days or SOS if symptoms worsen'
    };

    const createRes = await req('hospital/visits', { method: 'POST', body: regPayload });
    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.visit);
    assert.ok(createRes.data.visit.visit_uid.startsWith('REG-'));
    assert.equal(createRes.data.visit.patient_name, 'Kantilal Thakor');
    assert.equal(createRes.data.visit.chief_complaint, 'Headache and occasional dizziness for 4 days');
    assert.equal(createRes.data.visit.disposition, 'Discharged OPD');
    const visitId = createRes.data.visit.id;

    console.log('3. Checking auto-provisioned/linked patient record in hospital patients');
    const patRow = db.prepare('SELECT * FROM patients WHERE family_member_id = 1 AND hospital_id = 1').get();
    assert.ok(patRow, 'Linked patient row created');
    assert.equal(patRow.name, 'Kantilal Thakor');

    console.log('4. Testing GET /api/hospital/visits list & filters');
    const listRes = await req('hospital/visits');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.total, 1);
    assert.equal(listRes.data.visits[0].id, visitId);

    const filterDept = await req('hospital/visits?department=General%20Medicine');
    assert.equal(filterDept.data.total, 1);

    const filterOther = await req('hospital/visits?department=Pediatrics');
    assert.equal(filterOther.data.total, 0);

    const searchRes = await req('hospital/visits?search=Kantilal');
    assert.equal(searchRes.data.total, 1);

    console.log('5. Testing GET /api/hospital/visits/:id for slip generation');
    const detailRes = await req(`hospital/visits/${visitId}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.visit_uid, createRes.data.visit.visit_uid);
    assert.equal(detailRes.data.treatment_prescribed, regPayload.treatment_prescribed);

    console.log('6. Testing summary KPIs after visit registration');
    const summary2 = await req('hospital/visits/summary');
    assert.equal(summary2.data.total_registered, 1);
    assert.equal(summary2.data.opd_discharged, 1);

    console.log('\nAll hospital visit registration tests passed successfully!');
  } finally {
    await new Promise(r => server.close(r));
    db.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
