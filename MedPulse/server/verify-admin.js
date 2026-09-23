// Automated verification suite for Faculty & Administrative Command Center
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Accept': 'application/json'
    };
    if (postData) {
      defaultHeaders['Content-Type'] = 'application/json';
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let body = null;
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(bodyBuffer.toString());
          } catch (e) {
            body = bodyBuffer.toString();
          }
        } else {
          body = bodyBuffer;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log(' MedPulse Admin Command Center - End-to-End Test');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check /admin.html serves with 200 OK
    console.log('1. Testing HTML Page Serving:');
    const htmlRes = await makeRequest('/admin.html');
    assert(htmlRes.statusCode === 200, 'GET /admin.html returned status 200 OK');
    const htmlStr = htmlRes.body.toString();
    assert(htmlStr.includes('ADMIN CONSOLE'), 'admin.html contains ADMIN CONSOLE branding');
    assert(htmlStr.includes('auth-guard.js'), 'admin.html includes zero-trust auth-guard.js');

    // 2. Test Unauthenticated Access Rejection
    console.log('\n2. Testing Route Guarding (Unauthenticated Access):');
    const unauthStats = await makeRequest('/api/admin/stats');
    assert(unauthStats.statusCode === 401, 'GET /api/admin/stats without auth correctly returns 401 Unauthorized');

    // 3. Test Admin Login
    console.log('\n3. Testing Admin Authentication (/api/admin/login):');
    const badLogin = await makeRequest('/api/admin/login', { method: 'POST' }, JSON.stringify({ username: 'admin', pin: '0000' }));
    assert(badLogin.statusCode === 401, 'POST /api/admin/login with invalid PIN returns 401');

    const goodLogin = await makeRequest('/api/admin/login', { method: 'POST' }, JSON.stringify({ username: 'admin', pin: '9999' }));
    assert(goodLogin.statusCode === 200, 'POST /api/admin/login with valid credentials returns 200 OK');
    assert(goodLogin.body && goodLogin.body.token, 'Response contains admin session token');
    assert(goodLogin.body.admin && (goodLogin.body.admin.role === 'Super Admin' || goodLogin.body.admin.role === 'University Super Admin'), 'Admin role is Super Admin or University Super Admin');

    const adminToken = goodLogin.body.token;
    const authHeaders = {
      'X-Admin-Token': adminToken,
      'X-Admin-Id': goodLogin.body.admin.id.toString()
    };

    // 4. Test Admin Stats & Epidemiological Disease Burden
    console.log('\n4. Testing Executive Statistics & Surveillance Metrics:');
    const statsRes = await makeRequest('/api/admin/stats', { headers: authHeaders });
    assert(statsRes.statusCode === 200, 'GET /api/admin/stats returns 200 OK');
    const stats = statsRes.body;
    assert(stats.overview && stats.overview.total_students >= 1, `Total students tracked: ${stats.overview?.total_students}`);
    assert(stats.overview && stats.overview.total_families >= 5, `Total households tracked: ${stats.overview?.total_families}`);
    assert(stats.overview && stats.overview.total_members >= 20, `Total individuals tracked: ${stats.overview?.total_members}`);
    assert(stats.burden && typeof stats.burden.total_htn === 'number', `HTN cases identified: ${stats.burden?.total_htn}`);
    assert(stats.burden && typeof stats.burden.total_dm === 'number', `DM cases identified: ${stats.burden?.total_dm}`);
    assert(Array.isArray(stats.colleges), 'College breakdown is returned as array');

    // 5. Test Student Cadre Management (List, Add, Reset PIN, Delete)
    console.log('\n5. Testing Student Cadre Management:');
    const studentsRes = await makeRequest('/api/admin/students', { headers: authHeaders });
    assert(studentsRes.statusCode === 200, 'GET /api/admin/students returns 200 OK');
    assert(Array.isArray(studentsRes.body), 'Returns students array');
    const dhruv = studentsRes.body.find(s => s.roll_number === '235');
    assert(dhruv && dhruv.name.includes('Dhruv Patel'), 'Cadet Dhruv Patel (Roll 235) present in admin roster');
    assert(dhruv && dhruv.families_count >= 5, `Dhruv has ${dhruv ? dhruv.families_count : 0} families linked`);

    // Create temporary test cadet
    const testCadetPayload = JSON.stringify({
      name: 'Test Cadet QA',
      roll_number: '9999_TEST',
      college_id: 1,
      posting_unit: 'UHTC Test Sub-center',
      phone: '9999999999',
      pin: '1234'
    });
    const createCadetRes = await makeRequest('/api/admin/students', { method: 'POST', headers: authHeaders }, testCadetPayload);
    assert(createCadetRes.statusCode === 201, 'POST /api/admin/students creates new cadet with 201 Created');
    const createdId = createCadetRes.body.student ? createCadetRes.body.student.id : null;

    if (createdId) {
      // Reset PIN
      const resetPinRes = await makeRequest(`/api/admin/students/${createdId}/reset-pin`, { method: 'POST', headers: authHeaders }, JSON.stringify({ new_pin: '5678' }));
      assert(resetPinRes.statusCode === 200 && resetPinRes.body.success, 'POST /api/admin/students/:id/reset-pin resets PIN successfully');

      // Delete test cadet
      const deleteCadetRes = await makeRequest(`/api/admin/students/${createdId}`, { method: 'DELETE', headers: authHeaders });
      assert(deleteCadetRes.statusCode === 200, 'DELETE /api/admin/students/:id cleans up test cadet');
    }

    // 6. Test Cross-Cadre Household Registry
    console.log('\n6. Testing Master Household Surveillance Registry:');
    const famRes = await makeRequest('/api/admin/families', { headers: authHeaders });
    assert(famRes.statusCode === 200, 'GET /api/admin/families returns 200 OK');
    assert(Array.isArray(famRes.body) && famRes.body.length >= 5, `Retrieved ${famRes.body.length} global households`);
    const sampleFam = famRes.body[0];
    assert(sampleFam.student_name && sampleFam.roll_number, `Household annotated with surveyor: ${sampleFam.student_name} (${sampleFam.roll_number})`);

    // 7. Test Master 43-Column Survey CSV Export
    console.log('\n7. Testing Master Cross-Cadre Survey CSV Export:');
    const csvRes = await makeRequest('/api/admin/export/all-csv', { headers: authHeaders });
    assert(csvRes.statusCode === 200, 'GET /api/admin/export/all-csv returns 200 OK');
    assert(csvRes.headers['content-type'] && csvRes.headers['content-type'].includes('text/csv'), 'Content-Type is text/csv');
    const csvContent = csvRes.body.toString();
    const csvLines = csvContent.trim().split('\n');
    assert(csvLines.length >= 25, `Master CSV generated ${csvLines.length} lines (header + member records)`);
    assert(csvLines[0].includes('Cadet Name') && csvLines[0].includes('Cadet Roll Number'), 'CSV includes Cadet attribution metadata headers');
    assert(csvLines[0].includes('Family No.'), 'CSV includes Family No. column');
    assert(csvLines[0].includes('Name of Family Member'), 'CSV includes Name of Family Member column');

    // 8. Test Executive Faculty Surveillance Audit PDF Report Export
    console.log('\n8. Testing Executive Faculty Audit PDF Report Export:');
    const pdfRes = await makeRequest('/api/admin/export/audit-pdf', { headers: authHeaders });
    assert(pdfRes.statusCode === 200, 'GET /api/admin/export/audit-pdf returns 200 OK');
    assert(pdfRes.headers['content-type'] && pdfRes.headers['content-type'].includes('application/pdf'), 'Content-Type is application/pdf');
    const pdfBuffer = pdfRes.body;
    assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'PDF response starts with valid %PDF magic bytes');
    assert(pdfBuffer.length > 2000, `PDF generated successfully (size: ${pdfBuffer.length} bytes)`);

    console.log('\n====================================================');
    console.log(` Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Verification encountered an unexpected error:', err);
    process.exit(1);
  }
}

runVerification();
