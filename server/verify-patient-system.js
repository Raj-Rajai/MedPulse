/**
 * Test Suite: MedPulse Patient Dual-Model Architecture & Cadet Account Provisioning
 * Verifies Independent/Dependent patient registration, referral code validation,
 * late linking, and cadet patient account provisioning.
 */
const http = require('node:http');
const express = require('express');
const assert = require('assert');
const { initDatabase, db } = require('./db');
const routes = require('./routes');

initDatabase();

async function runTests() {
    const app = express();
    app.use(express.json());
    app.use('/api', routes);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    function makeRequest(path, options = {}, body = null) {
        return new Promise((resolve, reject) => {
            const reqOptions = {
                hostname: '127.0.0.1',
                port: port,
                path: path,
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
                    let parsedBody = data;
                    try {
                        parsedBody = JSON.parse(data);
                    } catch (e) {}
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsedBody
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

    let passed = 0;
    let failed = 0;

    function check(description, fn) {
        try {
            fn();
            console.log(`  ✅ PASS: ${description}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${description}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    console.log('====================================================');
    console.log('🏥 MEDPULSE PATIENT DUAL-MODEL & PROVISIONING TEST');
    console.log('====================================================\n');

    // Clean up any previous test patients
    db.prepare("DELETE FROM patients WHERE phone IN ('9898980001', '9898980002', '9898980003', '9898980099')").run();

    // 1. Referral Code Verification Tests
    console.log('1. Testing Referral Code Verification (/api/patient/verify-referral):');
    const cadet = db.prepare('SELECT referral_code FROM students WHERE id = 1').get();
    const validCode = cadet.referral_code;

    const verifyValid = await makeRequest('/api/patient/verify-referral', { method: 'POST' }, { referral_code: validCode });
    check('Valid cadet referral code returns 200 OK with valid: true', () => {
        assert.strictEqual(verifyValid.statusCode, 200);
        assert.strictEqual(verifyValid.body.valid, true);
        assert.strictEqual(verifyValid.body.student.roll_number, '235');
        assert.strictEqual(verifyValid.body.student.name, 'Dhruv Patel');
    });

    const verifyInvalid = await makeRequest('/api/patient/verify-referral', { method: 'POST' }, { referral_code: 'INVALID-CODE-99' });
    check('Invalid referral code returns 404 with valid: false', () => {
        assert.strictEqual(verifyInvalid.statusCode, 404);
        assert.strictEqual(verifyInvalid.body.valid, false);
    });

    // 2. Independent Patient Registration & Login
    console.log('\n2. Testing Independent Patient Registration & Login:');
    const indePayload = {
        name: 'Anand Kumar',
        phone: '9898980001',
        pin: '4321',
        gender: 'M',
        age_years: 45,
        is_adopted: false
    };

    const regInde = await makeRequest('/api/patient/register', { method: 'POST' }, indePayload);
    let indePatientId = null;
    let indeToken = null;

    check('Independent patient registers with 201 Created', () => {
        assert.strictEqual(regInde.statusCode, 201);
        assert.strictEqual(regInde.body.success, true);
        assert.strictEqual(regInde.body.patient.model_type, 'Independent');
        assert.strictEqual(regInde.body.patient.student_id, null);
        assert(regInde.body.patient.patient_uid.startsWith('PAT-'));
        indePatientId = regInde.body.patient.id;
        indeToken = regInde.body.token;
    });

    const loginInde = await makeRequest('/api/patient/login', { method: 'POST' }, { identifier: '9898980001', pin: '4321' });
    check('Independent patient logs in with phone + PIN (200 OK)', () => {
        assert.strictEqual(loginInde.statusCode, 200);
        assert.strictEqual(loginInde.body.success, true);
        assert.strictEqual(loginInde.body.patient.name, 'Anand Kumar');
        assert.strictEqual(loginInde.body.patient.model_type, 'Independent');
    });

    // 3. Dependent Patient Registration (With Referral Code)
    console.log('\n3. Testing Dependent Patient Registration (Adopted Model):');
    const depPayload = {
        name: 'Savitaben Vora',
        phone: '9898980002',
        pin: '1234',
        gender: 'F',
        age_years: 60,
        is_adopted: true,
        referral_code: validCode
    };

    const regDep = await makeRequest('/api/patient/register', { method: 'POST' }, depPayload);
    let depPatientId = null;
    let depToken = null;

    check('Dependent patient registers with 201 Created and links to student', () => {
        assert.strictEqual(regDep.statusCode, 201);
        assert.strictEqual(regDep.body.success, true);
        assert.strictEqual(regDep.body.patient.model_type, 'Dependent');
        assert.strictEqual(regDep.body.patient.student_id, 1);
        assert.strictEqual(regDep.body.patient.cadet_name, 'Dhruv Patel');
        assert.strictEqual(regDep.body.patient.cadet_roll, '235');
        depPatientId = regDep.body.patient.id;
        depToken = regDep.body.token;
    });

    // 4. Duplicate Phone Prevention
    console.log('\n4. Testing Duplicate Phone Registration Protection:');
    const dupRes = await makeRequest('/api/patient/register', { method: 'POST' }, depPayload);
    check('Attempt to register duplicate phone returns 409 Conflict', () => {
        assert.strictEqual(dupRes.statusCode, 409);
    });

    // 5. Late Linking of Independent Patient
    console.log('\n5. Testing Late Referral Code Linking on Independent Patient:');
    const linkRes = await makeRequest('/api/patient/link-referral', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(indePatientId) }
    }, { referral_code: validCode });

    check('Independent patient links referral code and upgrades to Dependent (200 OK)', () => {
        assert.strictEqual(linkRes.statusCode, 200);
        assert.strictEqual(linkRes.body.success, true);
        assert.strictEqual(linkRes.body.patient.model_type, 'Dependent');
        assert.strictEqual(linkRes.body.patient.student_id, 1);
        assert.strictEqual(linkRes.body.patient.cadet_name, 'Dhruv Patel');
    });

    // 6. Cadet Patient Account Provisioning
    console.log('\n6. Testing Student Cadet Patient Account Provisioning:');
    const testMember = db.prepare(`
        SELECT m.id, m.name, m.gender, m.age_years
        FROM family_members m
        JOIN families f ON m.family_id = f.id
        WHERE f.student_id = 1
        LIMIT 1
    `).get();

    // Clean up if already provisioned
    db.prepare('DELETE FROM patients WHERE family_member_id = ?').run(testMember.id);

    const provRes = await makeRequest('/api/students/provision-patient', {
        method: 'POST',
        headers: {
            'X-Student-Id': '1',
            'X-Roll-Number': '235'
        }
    }, {
        member_id: testMember.id,
        phone: '9898980099',
        pin: '1234'
    });

    check('Cadet provisions patient account with 201 Created', () => {
        assert.strictEqual(provRes.statusCode, 201);
        assert.strictEqual(provRes.body.success, true);
        assert(provRes.body.patient_uid.startsWith('PAT-'));
        assert.strictEqual(provRes.body.phone, '9898980099');
        assert.strictEqual(provRes.body.pin, '1234');
    });

    // Verify provisioned patient can log in and view medical records
    const provLogin = await makeRequest('/api/patient/login', { method: 'POST' }, {
        identifier: '9898980099',
        pin: '1234'
    });

    check('Provisioned patient logs in successfully', () => {
        assert.strictEqual(provLogin.statusCode, 200);
        assert.strictEqual(provLogin.body.patient.model_type, 'Dependent');
        assert.strictEqual(provLogin.body.patient.student_id, 1);
    });

    const recordsRes = await makeRequest('/api/patient/records', {
        headers: { 'X-Patient-Id': String(provLogin.body.patient.id) }
    });

    check('Provisioned patient can access full clinical records', () => {
        assert.strictEqual(recordsRes.statusCode, 200);
        assert(recordsRes.body.member !== null);
        assert.strictEqual(recordsRes.body.member.id, testMember.id);
        assert(Array.isArray(recordsRes.body.conditions));
        assert(Array.isArray(recordsRes.body.medications));
        assert(Array.isArray(recordsRes.body.follow_ups));
    });

    // Cleanup test records
    db.prepare("DELETE FROM patients WHERE phone IN ('9898980001', '9898980002', '9898980003', '9898980099')").run();

    console.log('\n====================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
