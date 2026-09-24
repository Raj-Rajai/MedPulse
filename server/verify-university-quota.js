const http = require('node:http');
const express = require('express');
const { db, initDatabase } = require('./db');
const routes = require('./routes');

async function runQuotaVerification() {
    console.log('====================================================');
    console.log('🏛️ MEDPULSE UNIVERSITY ADMIN & QUOTA ENFORCEMENT TEST');
    console.log('====================================================\n');

    initDatabase();

    const app = express();
    app.use(express.json());
    app.use('/api', routes);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

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

    function makeRequest(path, options = {}, body = null) {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port,
                path,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': 'admin-1',
                    'X-Admin-Id': '1',
                    ...(options.headers || {})
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        parsed = data;
                    }
                    resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
                });
            });
            req.on('error', reject);
            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            req.end();
        });
    }

    try {
        // 1. Check default quota response for University 1 (SAL)
        console.log('1. Checking University Admins Quota Endpoint:');
        const quotaRes = await makeRequest('/api/admin/university-admins?university_id=1');
        assert(quotaRes.statusCode === 200, 'GET /api/admin/university-admins returns 200 OK');
        assert(quotaRes.body.quota && quotaRes.body.quota.max_admins === 10, 'Max quota is 10 admins');
        assert(quotaRes.body.quota.super_admin_count === 1, 'Exactly 1 Super Admin present');

        // Cleanup any previous test admins (keep admin id 1)
        db.prepare("DELETE FROM admins WHERE username LIKE 'test_admin_%'").run();

        // 2. Test Super Admin Conflict: Cannot appoint a 2nd Super Admin
        console.log('\n2. Testing 1 Super Admin per University Constraint:');
        const secondSuper = await makeRequest('/api/admin/university-admins', { method: 'POST' }, {
            username: 'test_super_duplicate',
            name: 'Dr. Duplicate Super Admin',
            role: 'University Super Admin',
            university_id: 1,
            pin: '8888'
        });
        assert(secondSuper.statusCode === 409, 'Attempt to create 2nd Super Admin returns 409 Conflict');
        assert(secondSuper.body.error && secondSuper.body.error.includes('already has an appointed Super Admin'), 'Error message specifies 1 Super Admin rule');

        // 3. Appoint 10 University Admins under University 1 (Filling the quota)
        console.log('\n3. Appointing up to 10 University Admins (Quota Boundary Test):');
        const createdAdminIds = [];
        for (let i = 1; i <= 10; i++) {
            const res = await makeRequest('/api/admin/university-admins', { method: 'POST' }, {
                username: `test_admin_${i}`,
                name: `Faculty Admin ${i}`,
                role: 'University Admin',
                university_id: 1,
                email: `faculty${i}@SAL.edu`,
                phone: `98765432${i.toString().padStart(2, '0')}`,
                pin: '1234'
            });
            if (res.statusCode === 201) {
                createdAdminIds.push(res.body.admin.id);
            }
        }
        assert(createdAdminIds.length === 10, `Successfully created 10 University Admins (Seats filled: ${createdAdminIds.length}/10)`);

        // Check quota status when full
        const fullQuotaRes = await makeRequest('/api/admin/university-admins?university_id=1');
        assert(fullQuotaRes.body.quota.current_admins === 10, 'Current admins count is 10');
        assert(fullQuotaRes.body.quota.remaining_seats === 0, 'Remaining seats is 0');
        assert(fullQuotaRes.body.quota.is_at_capacity === true, 'Quota is_at_capacity is true');

        // 4. Test 11th Admin Rejection (Strict Quota Enforcement)
        console.log('\n4. Testing 11th University Admin Rejection:');
        const eleventhAdmin = await makeRequest('/api/admin/university-admins', { method: 'POST' }, {
            username: 'test_admin_11_overflow',
            name: 'Faculty Admin 11 (Overflow)',
            role: 'University Admin',
            university_id: 1,
            pin: '1234'
        });
        assert(eleventhAdmin.statusCode === 403, '11th Admin creation returns 403 Forbidden');
        assert(eleventhAdmin.body.error && eleventhAdmin.body.error.includes('quota exceeded'), 'Error message specifies quota exceeded (Maximum 10 allowed)');

        // 5. Test Admin Deletion & Seat Freeing
        console.log('\n5. Testing Admin Removal & Seat Freeing:');
        const adminToDelete = createdAdminIds.pop();
        const deleteRes = await makeRequest(`/api/admin/university-admins/${adminToDelete}`, { method: 'DELETE' });
        assert(deleteRes.statusCode === 200, 'DELETE /api/admin/university-admins/:id returns 200 OK');

        const freedQuotaRes = await makeRequest('/api/admin/university-admins?university_id=1');
        assert(freedQuotaRes.body.quota.current_admins === 9, 'Admin count dropped to 9');
        assert(freedQuotaRes.body.quota.remaining_seats === 1, 'Remaining seats increased to 1');
        assert(freedQuotaRes.body.quota.is_at_capacity === false, 'Quota is_at_capacity is false');

        // Re-filling the 10th seat should now succeed
        const refillRes = await makeRequest('/api/admin/university-admins', { method: 'POST' }, {
            username: 'test_admin_replacement',
            name: 'Faculty Admin Replacement',
            role: 'University Admin',
            university_id: 1,
            pin: '1234'
        });
        assert(refillRes.statusCode === 201, 'Refilling freed 10th seat succeeds with 201 Created');
        if (refillRes.body && refillRes.body.admin) {
            createdAdminIds.push(refillRes.body.admin.id);
        }

        // 6. Test Cannot Delete Super Admin
        console.log('\n6. Testing Super Admin Protection:');
        const deleteSuperRes = await makeRequest('/api/admin/university-admins/1', { method: 'DELETE' });
        assert(deleteSuperRes.statusCode === 400, 'Cannot delete University Super Admin (returns 400)');

        // 7. Test Student Referral Codes
        console.log('\n7. Testing Student Referral Code Generation & Visibility:');
        const studentsRes = await makeRequest('/api/admin/students');
        assert(studentsRes.statusCode === 200, 'GET /api/admin/students returns 200 OK');
        const dhruv = studentsRes.body.find(s => s.roll_number === '235');
        assert(dhruv && dhruv.referral_code && dhruv.referral_code.startsWith('SAL-235-'), `Dhruv Patel has valid referral code: ${dhruv?.referral_code}`);

        // Cleanup test admins
        for (const id of createdAdminIds) {
            db.prepare('DELETE FROM admins WHERE id = ?').run(id);
        }

    } finally {
        server.close();
    }

    console.log('\n====================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
}

runQuotaVerification().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
