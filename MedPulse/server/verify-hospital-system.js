/**
 * MedPulse Hospital Network (Independent Medium) & Quota System Verification Suite
 * Tests 1-3 Super Admin & 20 Admin quotas, cross-institutional surveillance, and medical dossier API.
 */

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { db, initDatabase } = require('./db');
const routes = require('./routes');

// Setup test server on dynamic port
initDatabase();

const app = express();
app.use(express.json());
app.use('/api', routes);

let passedTests = 0;
let failedTests = 0;

function logPass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
    passedTests++;
}

function logFail(msg, err) {
    console.error(`  ❌ FAIL: ${msg}`);
    if (err) console.error(`     Error: ${err}`);
    failedTests++;
}

function request(server, method, url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        const options = {
            hostname: '127.0.0.1',
            port,
            path: url,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log('🏥 MEDPULSE HOSPITAL NETWORK & QUOTA SYSTEM TEST');
    console.log('====================================================\n');

    const server = app.listen(0);
    const createdStaffIds = [];

    try {
        // 1. Test Hospital Super Admin Login
        console.log('1. Testing Hospital Super Admin Login:');
        const loginRes = await request(server, 'POST', '/api/hospital/login', {
            username: 'hosp_superadmin',
            pin: '8888'
        });

        if (loginRes.status === 200 && loginRes.body.success && loginRes.body.token) {
            logPass('POST /api/hospital/login returned 200 OK with session token');
        } else {
            logFail('Failed to login as Hospital Super Admin', JSON.stringify(loginRes.body));
        }

        const hospToken = loginRes.body.token;
        const hospAdminId = loginRes.body.admin.id;
        const hospHeaders = {
            'X-Hospital-Admin-Id': String(hospAdminId),
            'Authorization': `Bearer ${hospToken}`
        };

        // 2. Test Staff & Live Quotas Endpoint
        console.log('\n2. Testing Hospital Staff & Live Quotas Endpoint:');
        const staffRes = await request(server, 'GET', '/api/hospital/staff', null, hospHeaders);

        if (staffRes.status === 200 && staffRes.body.quota) {
            logPass('GET /api/hospital/staff returns 200 OK with quota metadata');
            const sq = staffRes.body.quota.super_admins;
            const aq = staffRes.body.quota.admins;
            if (sq.max === 3 && aq.max === 20) {
                logPass(`Hospital quota correctly configured: Max ${sq.max} Super Admins, Max ${aq.max} Admins`);
            } else {
                logFail(`Quota mismatch: expected 3 Super Admins and 20 Admins, got ${sq.max} and ${aq.max}`);
            }
        } else {
            logFail('Failed to retrieve staff and quota', JSON.stringify(staffRes.body));
        }

        // 3. Test Strict Quota for Hospital Super Admins (1 to 3 max)
        console.log('\n3. Testing Hospital Super Admin Quota (Max 3 Allowed):');

        // Clean any leftover test super admins from previous runs
        db.prepare("DELETE FROM hospital_admins WHERE username LIKE 'test_super_%' OR username LIKE 'test_adm_%'").run();

        // Appoint 2nd Super Admin
        const sa2Res = await request(server, 'POST', '/api/hospital/staff', {
            username: 'test_super_2',
            name: 'Dr. Test Super Admin 2',
            role: 'Hospital Super Admin',
            department: 'ICU',
            pin: '8888'
        }, hospHeaders);
        if (sa2Res.status === 201) {
            createdStaffIds.push(sa2Res.body.staff_id);
            logPass('Appointed 2nd Super Admin (2/3 seats filled)');
        } else {
            logFail('Failed to appoint 2nd Super Admin', JSON.stringify(sa2Res.body));
        }

        // Appoint 3rd Super Admin
        const sa3Res = await request(server, 'POST', '/api/hospital/staff', {
            username: 'test_super_3',
            name: 'Dr. Test Super Admin 3',
            role: 'Hospital Super Admin',
            department: 'Emergency',
            pin: '8888'
        }, hospHeaders);
        if (sa3Res.status === 201) {
            createdStaffIds.push(sa3Res.body.staff_id);
            logPass('Appointed 3rd Super Admin (3/3 seats filled - Capacity Reached)');
        } else {
            logFail('Failed to appoint 3rd Super Admin', JSON.stringify(sa3Res.body));
        }

        // Attempt to appoint 4th Super Admin -> MUST BE REJECTED with 403
        const sa4Res = await request(server, 'POST', '/api/hospital/staff', {
            username: 'test_super_4',
            name: 'Dr. Test Super Admin 4 (Should Fail)',
            role: 'Hospital Super Admin',
            department: 'Cardiology',
            pin: '8888'
        }, hospHeaders);
        if (sa4Res.status === 403) {
            logPass('4th Super Admin creation correctly rejected with 403 Forbidden');
            if (sa4Res.body.error && sa4Res.body.error.includes('Maximum 3 Super Admins allowed')) {
                logPass(`Error message correctly specifies quota constraint: "${sa4Res.body.error}"`);
            } else {
                logFail('Error message did not mention quota', sa4Res.body.error);
            }
        } else {
            logFail(`Expected 403 Forbidden for 4th Super Admin, got ${sa4Res.status}`, JSON.stringify(sa4Res.body));
        }

        // 4. Test Strict Quota for Hospital Admins (Max 20 Allowed)
        console.log('\n4. Testing Hospital Admin Quota (Max 20 Allowed):');
        let adminSuccessCount = 0;
        for (let i = 1; i <= 20; i++) {
            const admRes = await request(server, 'POST', '/api/hospital/staff', {
                username: `test_adm_${i}`,
                name: `Staff Member ${i}`,
                role: 'Hospital Admin',
                department: 'Ward Management',
                pin: '8888'
            }, hospHeaders);
            if (admRes.status === 201) {
                adminSuccessCount++;
                createdStaffIds.push(admRes.body.staff_id);
            }
        }

        if (adminSuccessCount === 20) {
            logPass('Successfully appointed 20 Hospital Admins (20/20 quota filled)');
        } else {
            logFail(`Only appointed ${adminSuccessCount} of 20 Admins`);
        }

        // Attempt to appoint 21st Admin -> MUST BE REJECTED with 403
        const adm21Res = await request(server, 'POST', '/api/hospital/staff', {
            username: 'test_adm_21',
            name: 'Staff Member 21 (Should Fail)',
            role: 'Hospital Admin',
            department: 'OPD',
            pin: '8888'
        }, hospHeaders);

        if (adm21Res.status === 403) {
            logPass('21st Admin creation correctly rejected with 403 Forbidden');
            if (adm21Res.body.error && adm21Res.body.error.includes('Maximum 20 Admins allowed')) {
                logPass(`Error message correctly specifies quota constraint: "${adm21Res.body.error}"`);
            } else {
                logFail('Error message did not mention quota', adm21Res.body.error);
            }
        } else {
            logFail(`Expected 403 Forbidden for 21st Admin, got ${adm21Res.status}`, JSON.stringify(adm21Res.body));
        }

        // 5. Test Admin Removal & Seat Freeing
        console.log('\n5. Testing Seat Freeing upon Admin Removal:');
        const adminToDelete = createdStaffIds[createdStaffIds.length - 1];
        const delRes = await request(server, 'DELETE', `/api/hospital/staff/${adminToDelete}`, null, hospHeaders);

        if (delRes.status === 200 && delRes.body.success) {
            logPass('DELETE /api/hospital/staff/:id freed up an admin seat (200 OK)');

            // Now appointment of a new admin should succeed
            const refillRes = await request(server, 'POST', '/api/hospital/staff', {
                username: 'test_adm_refill',
                name: 'Refill Staff Member',
                role: 'Hospital Admin',
                department: 'OPD',
                pin: '8888'
            }, hospHeaders);

            if (refillRes.status === 201) {
                createdStaffIds.push(refillRes.body.staff_id);
                logPass('Refilling freed admin seat succeeded with 201 Created');
            } else {
                logFail('Failed to refill freed admin seat', JSON.stringify(refillRes.body));
            }
        } else {
            logFail('Failed to delete admin', JSON.stringify(delRes.body));
        }

        // 6. Test Sole Super Admin Protection
        console.log('\n6. Testing Sole Hospital Super Admin Protection:');
        // Delete Super Admins 2 and 3
        const sa2Id = createdStaffIds[0];
        const sa3Id = createdStaffIds[1];
        await request(server, 'DELETE', `/api/hospital/staff/${sa2Id}`, null, hospHeaders);
        await request(server, 'DELETE', `/api/hospital/staff/${sa3Id}`, null, hospHeaders);

        // Attempt to delete the only remaining Super Admin (id: 1)
        const delSoleRes = await request(server, 'DELETE', `/api/hospital/staff/1`, null, hospHeaders);
        if (delSoleRes.status === 400) {
            logPass('Cannot delete the last remaining Hospital Super Admin (400 Bad Request)');
        } else {
            logFail(`Expected 400 Bad Request when deleting sole Super Admin, got ${delSoleRes.status}`);
        }

        // 7. Test Cross-Institutional Patient Surveillance
        console.log('\n7. Testing Cross-Institutional Patient Surveillance & Filtering:');
        const patRes = await request(server, 'GET', '/api/hospital/patients', null, hospHeaders);
        if (patRes.status === 200 && Array.isArray(patRes.body.patients)) {
            logPass(`GET /api/hospital/patients retrieved ${patRes.body.patients.length} patient records`);
        } else {
            logFail('Failed to retrieve patients', JSON.stringify(patRes.body));
        }

        // Filter by University (SAL - ID 1)
        const uniFilterRes = await request(server, 'GET', '/api/hospital/patients?university_id=1', null, hospHeaders);
        if (uniFilterRes.status === 200 && Array.isArray(uniFilterRes.body.patients)) {
            logPass(`University-wise filter (SAL) returned ${uniFilterRes.body.patients.length} records`);
        } else {
            logFail('Failed to filter by university', JSON.stringify(uniFilterRes.body));
        }

        // Filter by Student Cadet (Dhruv Patel - ID 1)
        const cadetFilterRes = await request(server, 'GET', '/api/hospital/patients?student_id=1', null, hospHeaders);
        if (cadetFilterRes.status === 200 && Array.isArray(cadetFilterRes.body.patients)) {
            logPass(`Cadet-wise filter (Roll 235) returned ${cadetFilterRes.body.patients.length} records`);
        } else {
            logFail('Failed to filter by cadet', JSON.stringify(cadetFilterRes.body));
        }

        // 8. Test Medical Dossier Retrieval
        console.log('\n8. Testing Patient Medical Dossier Retrieval:');
        const firstPatient = patRes.body.patients[0];
        if (firstPatient) {
            const dosRes = await request(server, 'GET', `/api/hospital/patients/${firstPatient.id}`, null, hospHeaders);
            if (dosRes.status === 200 && dosRes.body.patient && dosRes.body.vitals !== undefined) {
                logPass(`GET /api/hospital/patients/:id retrieved complete medical dossier for ${dosRes.body.patient.name}`);
                logPass(`Contains vitals, ${dosRes.body.conditions.length} conditions, and ${dosRes.body.follow_ups.length} follow-up visits`);
            } else {
                logFail('Failed to retrieve medical dossier', JSON.stringify(dosRes.body));
            }
        }

    } catch (err) {
        console.error('Fatal test execution error:', err);
    } finally {
        // Cleanup test data
        db.prepare("DELETE FROM hospital_admins WHERE username LIKE 'test_super_%' OR username LIKE 'test_adm_%'").run();
        server.close();

        console.log('\n====================================================');
        console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('====================================================\n');

        if (failedTests > 0) process.exit(1);
    }
}

runTests();
