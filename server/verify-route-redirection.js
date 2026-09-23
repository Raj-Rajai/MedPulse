const http = require('http');
const assert = require('assert');
const app = require('../backend/server');

let server;
const PORT = 3899;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: { ...headers }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING ROUTE & LOGIN REDIRECTION VERIFICATION ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return fn().then(() => {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    }).catch(err => {
      console.error(`  ❌ FAIL: ${name}: ${err.message}`);
      failed++;
    });
  }

  // 1. Patient Routes
  await test('GET /patient returns 200 and patient portal HTML', async () => {
    const res = await request('GET', '/patient');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Patient Health Portal') || res.body.includes('Patient Portal'));
  });

  await test('GET /patient/ returns 200 and patient portal HTML', async () => {
    const res = await request('GET', '/patient/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Patient Health Portal') || res.body.includes('Patient Portal'));
  });

  await test('GET /patient/patient.html returns 200 and patient portal HTML', async () => {
    const res = await request('GET', '/patient/patient.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Patient Health Portal') || res.body.includes('Patient Portal'));
  });

  await test('GET /patient.html backward-compatibility route returns 200', async () => {
    const res = await request('GET', '/patient.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Patient Health Portal') || res.body.includes('Patient Portal'));
  });

  await test('GET /patient/login redirects to /login.html?patient=1', async () => {
    const res = await request('GET', '/patient/login');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/login.html?patient=1');
  });

  // 2. Hospital Routes
  await test('GET /hospital returns 200 and hospital portal HTML', async () => {
    const res = await request('GET', '/hospital');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hospital Command Center'));
  });

  await test('GET /hospital/ returns 200 and hospital portal HTML', async () => {
    const res = await request('GET', '/hospital/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hospital Command Center'));
  });

  await test('GET /hospital/hospital.html returns 200 and hospital portal HTML', async () => {
    const res = await request('GET', '/hospital/hospital.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hospital Command Center'));
  });

  await test('GET /hospital.html backward-compatibility route returns 200', async () => {
    const res = await request('GET', '/hospital.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hospital Command Center'));
  });

  await test('GET /hospital/login redirects to /login.html?hospital=1', async () => {
    const res = await request('GET', '/hospital/login');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/login.html?hospital=1');
  });

  // 3. Admin & Student Routes
  await test('GET /admin returns 200 and admin portal HTML', async () => {
    const res = await request('GET', '/admin');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Admin') || res.body.includes('Faculty'));
  });

  await test('GET /admin/login redirects to /login.html?admin=1', async () => {
    const res = await request('GET', '/admin/login');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/login.html?admin=1');
  });

  await test('GET /student returns 200 and student portal HTML', async () => {
    const res = await request('GET', '/student');
    assert.strictEqual(res.status, 200);
  });

  await test('GET /student/login redirects to /login.html', async () => {
    const res = await request('GET', '/student/login');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/login.html');
  });

  // 4. Patient Authentication Flow
  let patientId = null;
  await test('POST /api/patient/login with valid demo credentials', async () => {
    const res = await request('POST', '/api/patient/login', {}, { identifier: '9876543210', pin: '1234' });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.patient);
    assert.ok(json.patient.id);
    patientId = json.patient.id;
  });

  await test('GET /api/patient/records with X-Patient-Id returns 200 OK', async () => {
    const res = await request('GET', '/api/patient/records', { 'X-Patient-Id': String(patientId) });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.profile);
    assert.strictEqual(json.profile.id, patientId);
  });

  await test('GET /api/patient/records with Bearer patient token returns 200 OK', async () => {
    const res = await request('GET', '/api/patient/records', { 'Authorization': `Bearer patient-${patientId}` });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.profile);
  });

  // 5. Hospital Authentication Flow
  let hospAdminId = null;
  await test('POST /api/hospital/login with demo hospital credentials', async () => {
    const res = await request('POST', '/api/hospital/login', {}, { username: 'hosp_superadmin', pin: '8888' });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.admin);
    assert.ok(json.admin.id);
    hospAdminId = json.admin.id;
  });

  await test('GET /api/hospital/stats with X-Hospital-Admin-Id returns 200 OK', async () => {
    const res = await request('GET', '/api/hospital/stats', { 'X-Hospital-Admin-Id': String(hospAdminId) });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.totals && json.totals.total_patients !== undefined);
  });

  await test('GET /api/hospital/stats with Bearer hosp- token returns 200 OK', async () => {
    const res = await request('GET', '/api/hospital/stats', { 'Authorization': `Bearer hosp-${hospAdminId}` });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.totals && json.totals.total_patients !== undefined);
  });

  console.log('----------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

server = app.listen(PORT, async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
