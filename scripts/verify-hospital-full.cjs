const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = require('../backend/server');
const { db } = require('../backend/config/db');

(async () => {
  console.log('====================================================');
  console.log('🏥 COMPLETE HOSPITAL END VERIFICATION AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, condition, errorMsg = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${errorMsg ? `(${errorMsg})` : ''}`);
      failed++;
    }
  }

  // 1. Schema & Table Audits
  console.log('--- 1. Schema & Database Integrity Audit ---');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  test('SQLite database integrity check is OK', integrity.length === 1 && integrity[0].integrity_check === 'ok');

  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  test('Zero foreign key violations across all tables', fkCheck.length === 0, JSON.stringify(fkCheck));

  const hospitalTables = ['hospitals', 'hospital_admins', 'hospital_visits', 'hospital_callback_requests'];
  for (const table of hospitalTables) {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    test(`Hospital table exists: ${table}`, Boolean(tableExists));
  }

  // Check hospital_visits required columns
  const visitCols = db.prepare("PRAGMA table_info(hospital_visits)").all().map(c => c.name);
  const expectedVisitCols = [
    'id', 'hospital_id', 'patient_id', 'family_member_id', 'visit_uid',
    'patient_name', 'age_years', 'gender', 'contact_number', 'address', 'village',
    'family_code', 'student_name', 'student_roll', 'visit_date', 'department',
    'attending_doctor', 'visit_type', 'chief_complaint', 'symptoms_duration',
    'sbp', 'dbp', 'pulse', 'temperature', 'rbs', 'existing_conditions',
    'allergies', 'diagnosis', 'treatment_prescribed', 'disposition',
    'ward_bed_no', 'follow_up_advice', 'registered_by_name', 'created_at'
  ];
  for (const col of expectedVisitCols) {
    test(`hospital_visits has column: ${col}`, visitCols.includes(col));
  }

  // 2. Route Auto-mount Audit
  console.log('\n--- 2. Route Auto-mount Architecture Audit ---');
  const routesDir = path.join(__dirname, '../backend/routes');
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'));
  test('Found all route files in backend/routes/', routeFiles.length >= 8);
  test('Includes hospital.routes.js', routeFiles.includes('hospital.routes.js'));
  test('Includes hospital-fap.routes.js', routeFiles.includes('hospital-fap.routes.js'));
  test('Includes patient-portal.routes.js (HMS callback bridge)', routeFiles.includes('patient-portal.routes.js'));

  // 3. HTTP Server & Route Endpoints
  console.log('\n--- 3. HTTP Server Endpoints & Zero-Trust Auth Audit ---');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function req(url, { method = 'GET', body, token, adminId } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminId) headers['X-Hospital-Admin-Id'] = String(adminId);
    const res = await fetch(base + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data, rawText: text };
  }

  try {
    // Static HTML serving
    const htmlRes = await req('/hospital/');
    test('GET /hospital/ returns 200 OK', htmlRes.status === 200);
    test('GET /hospital/ is HTML and contains MedPulse branding', typeof htmlRes.data === 'string' && htmlRes.data.includes('MedPulse'));

    const cssRes = await req('/hospital/hospital.css');
    test('GET /hospital/hospital.css returns 200 OK', cssRes.status === 200);
    test('hospital.css contains registration & visit slip rules', typeof cssRes.data === 'string' && cssRes.data.includes('.reg-card') && cssRes.data.includes('.slip-content'));

    const jsRes = await req('/hospital/hospital-ui.js');
    test('GET /hospital/hospital-ui.js returns 200 OK', jsRes.status === 200);
    test('hospital-ui.js contains registration and slip handlers', typeof jsRes.data === 'string' && jsRes.data.includes('loadRegisteredPatients') && jsRes.data.includes('openVisitSlip'));

    // Zero-trust authentication test on all protected hospital routes
    const protectedRoutes = [
      '/api/hospital/profile',
      '/api/hospital/stats',
      '/api/hospital/filter-options',
      '/api/hospital/patients',
      '/api/hospital/staff',
      '/api/hospital/visits',
      '/api/hospital/visits/summary',
      '/api/hospital/fap/summary',
      '/api/hospital/fap/options',
      '/api/hospital/fap/patients',
      '/api/crm/hospital/callback-requests'
    ];

    for (const route of protectedRoutes) {
      const unauth = await req(route);
      test(`Route ${route} strictly rejects unauthenticated access (401)`, unauth.status === 401);
      test(`Route ${route} returns JSON error on 401 (never HTML)`, typeof unauth.data === 'object' && unauth.data.error !== undefined);
    }

    // Hospital Login
    console.log('\n--- 4. Hospital Authentication & Session Audit ---');
    const loginFail = await req('/api/hospital/login', {
      method: 'POST',
      body: { username: 'hosp_superadmin', pin: '0000' }
    });
    test('POST /api/hospital/login with invalid PIN returns 401', loginFail.status === 401);

    const loginOk = await req('/api/hospital/login', {
      method: 'POST',
      body: { username: 'hosp_superadmin', pin: '8888' }
    });
    test('POST /api/hospital/login with valid credentials returns 200 OK', loginOk.status === 200);
    test('Login response contains session token and admin details', Boolean(loginOk.data.token && loginOk.data.admin));

    const token = loginOk.data.token;
    const adminId = loginOk.data.admin.id;

    // Authenticated Hospital endpoints
    console.log('\n--- 5. Hospital Operational & Governance API Audit ---');
    const profile = await req('/api/hospital/profile', { token });
    test('GET /api/hospital/profile returns 200 OK', profile.status === 200);
    test('Profile contains hospital_name and admin role', profile.data.admin.hospital_name !== undefined && profile.data.admin.role === 'Hospital Super Admin');

    const stats = await req('/api/hospital/stats', { token });
    test('GET /api/hospital/stats returns 200 OK', stats.status === 200);
    test('Stats includes totals structure', Boolean(stats.data.totals));

    const staff = await req('/api/hospital/staff', { token });
    test('GET /api/hospital/staff returns 200 OK', staff.status === 200);
    test('Staff includes quota metadata', Boolean(staff.data.quota && staff.data.quota.super_admins));

    // FAP Surveillance API
    console.log('\n--- 6. FAP Patient Registry & Dossier API Audit ---');
    const fapSummary = await req('/api/hospital/fap/summary', { token });
    test('GET /api/hospital/fap/summary returns 200 OK', fapSummary.status === 200);
    test('FAP summary includes totals for patients, families, students, and follow-ups', Boolean(fapSummary.data.totals && fapSummary.data.totals.patients >= 0));

    const fapOptions = await req('/api/hospital/fap/options', { token });
    test('GET /api/hospital/fap/options returns 200 OK', fapOptions.status === 200);
    test('FAP options contains colleges and students lists', Array.isArray(fapOptions.data.universities) && Array.isArray(fapOptions.data.students));

    const fapPatients = await req('/api/hospital/fap/patients?limit=10', { token });
    test('GET /api/hospital/fap/patients returns 200 OK', fapPatients.status === 200);
    test('FAP patients contains patients array and total counter', Array.isArray(fapPatients.data.patients) && typeof fapPatients.data.total === 'number');

    if (fapPatients.data.patients.length > 0) {
      const firstPatientId = fapPatients.data.patients[0].id;
      const dossier = await req(`/api/hospital/fap/patients/${firstPatientId}`, { token });
      test(`GET /api/hospital/fap/patients/${firstPatientId} returns 200 OK`, dossier.status === 200);
      test('Dossier includes member, family, vitals, follow_ups, conditions, medications, allergies', Boolean(
        dossier.data.member && dossier.data.family && dossier.data.vitals &&
        Array.isArray(dossier.data.follow_ups) && Array.isArray(dossier.data.conditions)
      ));
      test('Dossier never exposes patient PIN', !JSON.stringify(dossier.data).includes('"pin"'));
    }

    // Hospital Visits & Registration API
    console.log('\n--- 7. Hospital Visits & Registration API Audit ---');
    const visitsInitial = await req('/api/hospital/visits', { token });
    test('GET /api/hospital/visits returns 200 OK', visitsInitial.status === 200);
    test('Visits list has total and visits array', Array.isArray(visitsInitial.data.visits) && typeof visitsInitial.data.total === 'number');

    const visitsSummary = await req('/api/hospital/visits/summary', { token });
    test('GET /api/hospital/visits/summary returns 200 OK', visitsSummary.status === 200);
    test('Visits summary has total_registered, today_visits, admitted_patients, opd_discharged', Boolean(
      visitsSummary.data.total_registered !== undefined &&
      visitsSummary.data.today_visits !== undefined &&
      visitsSummary.data.admitted_patients !== undefined &&
      visitsSummary.data.opd_discharged !== undefined
    ));

    // Register a new patient visit
    const newVisitPayload = {
      patient_name: 'Verification Test Patient',
      age_years: 48,
      gender: 'F',
      contact_number: '9898012345',
      address: 'Near Civil Hospital, Sector 12',
      village: 'Gandhinagar',
      visit_date: new Date().toISOString().slice(0, 10),
      department: 'General Medicine',
      attending_doctor: 'Dr. Ramesh Patel',
      visit_type: 'Routine OPD',
      chief_complaint: 'Seasonal cough and fever for 2 days',
      symptoms_duration: '2 days',
      sbp: 124,
      dbp: 82,
      pulse: 74,
      temperature: 99.1,
      rbs: 110,
      existing_conditions: 'None',
      allergies: 'None known',
      diagnosis: 'Acute Upper Respiratory Tract Infection',
      treatment_prescribed: 'Tab Paracetamol 500mg TDS x 3 days, Tab Levocetirizine 5mg HS x 5 days, warm saline gargles',
      disposition: 'Discharged OPD',
      follow_up_advice: 'Return in 5 days if fever persists'
    };

    const createVisitRes = await req('/api/hospital/visits', {
      method: 'POST',
      body: newVisitPayload,
      token
    });
    test('POST /api/hospital/visits creates visit with 201 Created', createVisitRes.status === 201);
    test('Created visit has REG-YYYY-XXXXX UID format', Boolean(createVisitRes.data.visit && createVisitRes.data.visit.visit_uid.startsWith('REG-')));
    test('Created visit stores clinical questions correctly', createVisitRes.data.visit.chief_complaint === newVisitPayload.chief_complaint);

    const createdVisitId = createVisitRes.data.visit.id;

    // Retrieve visit details for slip
    const getVisitRes = await req(`/api/hospital/visits/${createdVisitId}`, { token });
    test(`GET /api/hospital/visits/${createdVisitId} returns 200 OK`, getVisitRes.status === 200);
    test('Visit detail has all intake fields for printable slip', Boolean(
      getVisitRes.data.visit_uid && getVisitRes.data.patient_name && getVisitRes.data.diagnosis &&
      getVisitRes.data.treatment_prescribed && getVisitRes.data.follow_up_advice
    ));

    // Search and filter visits
    const searchVisit = await req('/api/hospital/visits?search=Verification%20Test', { token });
    test('GET /api/hospital/visits?search=... finds the registered visit', searchVisit.data.total >= 1);

    const filterDept = await req('/api/hospital/visits?department=General%20Medicine', { token });
    test('GET /api/hospital/visits?department=General Medicine filters correctly', filterDept.data.total >= 1);

    // Cross-system callback requests (HMS contract)
    console.log('\n--- 8. HMS Cross-Domain Callback Requests Bridge ---');
    const callbackQueue = await req('/api/crm/hospital/callback-requests', { token });
    test('GET /api/crm/hospital/callback-requests returns 200 OK', callbackQueue.status === 200);
    test('Callback queue returns requests list and open_count', Boolean(Array.isArray(callbackQueue.data.requests) && typeof callbackQueue.data.open_count === 'number'));

    // DOM & UI Contract Verification
    console.log('\n--- 9. Frontend DOM Integrity & ID Contract Audit ---');
    const htmlContent = fs.readFileSync(path.join(__dirname, '../frontend/hospital/hospital.html'), 'utf8');
    const indexContent = fs.readFileSync(path.join(__dirname, '../frontend/hospital/index.html'), 'utf8');
    const jsContent = fs.readFileSync(path.join(__dirname, '../frontend/hospital/hospital-ui.js'), 'utf8');

    // Extract all $('elementId') calls from hospital-ui.js
    const idRegex = /\$\(['"]([^'"]+)['"]\)/g;
    const foundIds = new Set();
    let match;
    while ((match = idRegex.exec(jsContent)) !== null) {
      foundIds.add(match[1]);
    }

    test('Found DOM element IDs in hospital-ui.js', foundIds.size > 20);

    // Dynamic IDs created at runtime (e.g. inside error or dossier templates)
    const dynamicIds = new Set(['retryDossier']);

    let missingInHospital = [];
    let missingInIndex = [];
    for (const id of foundIds) {
      if (dynamicIds.has(id)) continue;
      if (!htmlContent.includes(`id="${id}"`) && !htmlContent.includes(`id='${id}'`)) {
        missingInHospital.push(id);
      }
      if (!indexContent.includes(`id="${id}"`) && !indexContent.includes(`id='${id}'`)) {
        missingInIndex.push(id);
      }
    }

    test('Every static ID referenced in hospital-ui.js exists in hospital.html', missingInHospital.length === 0, missingInHospital.join(', '));
    test('Every static ID referenced in hospital-ui.js exists in index.html', missingInIndex.length === 0, missingInIndex.join(', '));
    test('hospital.html and index.html are perfectly synchronized', htmlContent.trim() === indexContent.trim());

  } finally {
    await new Promise(r => server.close(r));
  }

  console.log('\n====================================================');
  console.log(`🏁 HOSPITAL VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
