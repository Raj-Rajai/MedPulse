require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

test('patient privacy: real sessions, consent, guardians, minimized responses, corrections and audit', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'medpulse-patient-privacy-'));
    process.env.MEDPULSE_DB_PATH = join(folder, 'test.db');
    const { SCHEMAS } = require('../dist/database/schemas');
    const seed = new DatabaseSync(process.env.MEDPULSE_DB_PATH);
    SCHEMAS.forEach(schema => schema.apply(seed));
    seed.exec(`
        INSERT INTO students (id, roll_number, name, pin, referral_code) VALUES
            (1001, 'PRIVACY-ONE', 'Synthetic student one', '2468', 'PRIVACY-CODE'),
            (1002, 'PRIVACY-TWO', 'Synthetic student two', '2468', 'PRIVACY-CODE-TWO');
        INSERT INTO families (id, student_id, family_no, family_code, head_of_family) VALUES
            (1001,1001,1,'TEST-PRIVACY-A','Synthetic head'), (1002,1002,1,'TEST-PRIVACY-B','Synthetic outsider');
        INSERT INTO family_members (id,family_id,member_order,name,date_of_birth,age_years,contact_number,sbp,dbp,rbs,hb) VALUES
            (1001,1001,1,'Synthetic head','1986-01-01',40,'9000000001',151,92,172,11),
            (1002,1001,2,'Synthetic adult','1996-01-01',30,'9000000002',161,93,181,10),
            (1003,1001,3,'Synthetic child','2018-01-01',8,NULL,101,65,99,12),
            (1004,1002,1,'Synthetic outsider','1992-01-01',34,'9000000004',171,94,199,9),
            (1005,1002,2,'Unclaimed medical identity','1992-01-01',34,'9000000010',171,94,199,9);
        INSERT INTO patients (id,patient_uid,name,phone,pin,family_id,family_member_id,family_role,blood_group,address,hospital_id) VALUES
            (1001,'PAT-TEST-1001','Synthetic head','9000000001','2468',1001,1001,'Head','A+','Synthetic private address',1),
            (1002,'PAT-TEST-1002','Synthetic adult','9000000002','2468',1001,1002,'Member','B+','Other private address',1),
            (1004,'PAT-TEST-1004','Synthetic outsider','9000000004','2468',1002,1004,'Head','O+','Outside private address',1);
        INSERT INTO member_medications (member_id,name,dosage) VALUES (1001,'SYNTHETIC-MEDICINE','10 mg');
        INSERT INTO member_conditions (member_id,condition_name,status) VALUES (1002,'SYNTHETIC-DIAGNOSIS','Active');
        INSERT INTO hospitals (id,name,code,city) VALUES (1002,'Other synthetic hospital','PRIVACY-HOSP-2','Example city');
        INSERT INTO hospital_admins (id,hospital_id,username,name,pin,role,status)
            VALUES (1002,1002,'privacy_other_staff','Other synthetic staff','2468','Hospital Admin','Active');
    `);
    seed.close();
    const { createApp } = require('../dist/main');
    const { DatabaseService } = require('../dist/database/database.service');
    const app = await createApp();
    try {
        await app.listen(0, '127.0.0.1');
        const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
        const db = app.get(DatabaseService).db;
        async function request(path, { cookie, method = 'GET', body, headers = {} } = {}) {
            const response = await fetch(base + path, { method, headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
            const data = await response.json();
            return { response, status: response.status, data };
        }
        async function login(id) {
            const result = await request('/patient/login', { method: 'POST', body: { identifier: `PAT-TEST-${id}`, pin: '2468' } });
            assert.equal(result.status, 200);
            assert.ok(!('pin' in result.data.patient));
            assert.ok(!('token' in result.data));
            const cookies = result.response.headers.getSetCookie();
            const cookie = cookies.find(c => c.startsWith('mp_patient_session=') && !c.startsWith('mp_patient_session=;'));
            assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
            return cookie.split(';')[0];
        }
        const head = await login(1001), adult = await login(1002), outsider = await login(1004);
        for (const headers of [{ 'X-Patient-Id': '1001' }, { Authorization: 'Bearer patient-1001' }, { Authorization: 'Bearer PAT-TEST-1001' }]) {
            assert.equal((await request('/patient/records?patient_id=1001', { headers })).status, 401);
        }
        for (const path of ['/members/1001', '/students/profile?student_id=1001', '/students', '/export/data', '/export/pdf', '/export/csv', '/crm/hospital/privacy-requests', '/admin/stats']) {
            assert.equal((await request(path, { cookie: head, headers: { 'X-Student-Id': '1001', 'X-Hospital-Admin-Id': '1' } })).status, 401);
        }
        const own = await request('/patient/records?patient_id=1002', { cookie: head, headers: { 'X-Patient-Id': '1002' } });
        assert.equal(own.data.member.id, 1001);
        assert.equal(own.data.medications[0].name, 'SYNTHETIC-MEDICINE');
        assert.equal(own.data.provenance.verified, false);
        assert.ok(!JSON.stringify(own.data).includes('"pin"'));
        assert.match(own.response.headers.get('cache-control'), /no-store/);
        assert.equal((await request('/patient/family/members/1002/records', { cookie: head })).status, 403);
        assert.equal((await request('/patient/family/members/1004/records', { cookie: head })).status, 403);
        assert.equal((await request('/patient/family/members/1001/records', { cookie: outsider })).status, 403);
        const family = (await request('/patient/family', { cookie: head })).data;
        for (const member of family.members) {
            for (const field of ['sbp','dbp','rbs','hb','bmi','conditions','blood_group']) assert.ok(!(field in member), field);
        }
        assert.equal(family.members.find(m => m.id === 1002).can_view_records, false);
        assert.ok(!('contact_number' in family.members.find(m => m.id === 1002)));
        assert.equal((await request('/patient/family/members/1002', { cookie: head, method: 'PUT', body: { name: 'Forbidden edit' } })).status, 403);

        const grant = await request('/patient/access', { cookie: adult, method: 'POST', body: { grantee_patient_id: 1001, consent: true } });
        assert.equal(grant.status, 201);
        const grantId = grant.data.grants[0].id;
        assert.equal((await request('/patient/family/members/1002/records', { cookie: head })).status, 200);
        assert.equal((await request(`/patient/access/${grantId}`, { cookie: outsider, method: 'DELETE' })).status, 404);
        assert.equal((await request(`/patient/access/${grantId}`, { cookie: adult, method: 'DELETE' })).status, 200);
        assert.equal((await request('/patient/family/members/1002/records', { cookie: head })).status, 403);
        const expiredGrant = await request('/patient/access', { cookie: adult, method: 'POST', body: { grantee_patient_id: 1001, consent: true } });
        db.prepare('UPDATE patient_record_access SET expires_at = 0 WHERE id = ?').run(expiredGrant.data.grants[0].id);
        assert.equal((await request('/patient/family/members/1002/records', { cookie: head })).status, 403);
        assert.equal((await request('/patient/access', { cookie: adult, method: 'POST', body: { grantee_patient_id: 1004, consent: true } })).status, 400);

        const guardian = await request('/patient/family/members/1003/guardian-request', { cookie: head, method: 'POST', body: { relationship: 'Parent', confirm: true } });
        assert.equal(guardian.status, 201);
        assert.equal((await request('/patient/family/members/1003/records', { cookie: head })).status, 403);
        const staffLogin = await request('/hospital/login', { method: 'POST', body: { username: 'hosp_superadmin', pin: '8888' } });
        assert.equal(staffLogin.status, 200);
        const staff = staffLogin.response.headers.getSetCookie().find(c => c.startsWith('mp_hospital_session=') && !c.startsWith('mp_hospital_session=;')).split(';')[0];
        const queue = (await request('/crm/hospital/privacy-requests', { cookie: staff })).data;
        const guardianId = queue.guardian_requests.find(r => r.member_id === 1003).id;
        const otherStaffLogin = await request('/hospital/login', { method: 'POST', body: { username: 'privacy_other_staff', pin: '2468' } });
        const otherStaff = otherStaffLogin.response.headers.getSetCookie().find(c => c.startsWith('mp_hospital_session=') && !c.startsWith('mp_hospital_session=;')).split(';')[0];
        assert.equal((await request('/crm/hospital/privacy-requests', { cookie: otherStaff })).data.guardian_requests.length, 0);
        assert.equal((await request(`/crm/hospital/privacy-requests/guardian/${guardianId}/review`, { cookie: otherStaff, method: 'POST', body: { status: 'Approved', verified: true } })).status, 404);
        assert.equal((await request(`/crm/hospital/privacy-requests/guardian/${guardianId}/review`, { cookie: staff, method: 'POST', body: { status: 'Approved', verified: false } })).status, 400);
        assert.equal((await request(`/crm/hospital/privacy-requests/guardian/${guardianId}/review`, { cookie: staff, method: 'POST', body: { status: 'Approved', verified: true } })).status, 201);
        assert.equal((await request('/patient/family/members/1003/records', { cookie: head })).status, 200);
        db.prepare("UPDATE family_members SET date_of_birth = '2000-01-01' WHERE id = 1003").run();
        assert.equal((await request('/patient/family/members/1003/records', { cookie: head })).status, 403);

        const before = db.prepare('SELECT sbp FROM family_members WHERE id = 1001').get().sbp;
        const correction = await request('/patient/corrections', { cookie: head, method: 'POST', body: { member_id: 1001, record_type: 'measurement', record_id: 1001, message: 'Synthetic correction request' } });
        assert.equal(correction.status, 201);
        assert.equal((await request('/crm/hospital/privacy-requests', { cookie: otherStaff })).data.corrections.length, 0);
        assert.equal((await request(`/crm/hospital/privacy-requests/correction/${correction.data.id}/review`, { cookie: otherStaff, method: 'POST', body: { status: 'Reviewed' } })).status, 404);
        assert.equal((await request(`/crm/hospital/privacy-requests/correction/${correction.data.id}/review`, { cookie: staff, method: 'POST', body: { status: 'Reviewed' } })).status, 201);
        assert.equal((await request('/patient/corrections', { cookie: head })).data.corrections[0].status, 'Reviewed');
        assert.equal(db.prepare('SELECT sbp FROM family_members WHERE id = 1001').get().sbp, before);
        assert.equal((await request('/patient/corrections', { cookie: head, method: 'POST', body: { member_id: 1002, record_type: 'measurement', message: 'Forbidden correction' } })).status, 403);
        assert.equal((await request('/patient/profile', { cookie: head, method: 'PUT', body: { blood_group: 'B+' } })).status, 403);
        const card = (await request('/patient/card', { cookie: head })).data.card;
        assert.ok(!('blood_group' in card) && !('pin' in card));
        assert.equal((await request('/patient/card/action', { method: 'POST', body: { action: 'print' } })).status, 401);
        assert.equal((await request('/patient/card/action', { cookie: head, method: 'POST', body: { action: 'print' } })).status, 200);

        const created = await request('/patient/hospital-requests', { cookie: head, method: 'POST', body: { department: 'General Medicine', reason: 'Book appointment', message: 'Synthetic message' } });
        assert.equal(created.status, 201);
        const requestId = created.data.request.id;
        db.prepare("UPDATE hospital_callback_requests SET hospital_note = 'PRIVATE STAFF NOTE' WHERE id = ?").run(requestId);
        const requests = (await request('/patient/hospital-requests', { cookie: head })).data.requests;
        assert.ok(!JSON.stringify(requests).includes('PRIVATE STAFF NOTE'));
        assert.ok(!('hospital_note' in requests[0]) && !('blood_group' in requests[0]) && !('patient_phone' in requests[0]));
        assert.equal((await request(`/patient/hospital-requests/${requestId}/cancel`, { cookie: outsider, method: 'POST' })).status, 404);
        assert.equal((await request(`/patient/hospital-requests/${requestId}/cancel`, { cookie: head, method: 'POST' })).status, 200);
        assert.ok(db.prepare("SELECT id FROM portal_privacy_audit WHERE action = 'request_status_changed' AND resource_id = ?").get(requestId));
        const logs = db.prepare('SELECT * FROM portal_privacy_audit').all();
        assert.ok(logs.some(l => l.action === 'records_read'));
        assert.ok(logs.some(l => l.action === 'records_denied'));
        assert.ok(!JSON.stringify(logs).includes('SYNTHETIC-MEDICINE'));

        const register = await request('/patient/register', { method: 'POST', body: { name: 'Unclaimed medical identity', phone: '9000000010', pin: '2468' } });
        assert.equal(register.status, 201);
        assert.notEqual(register.data.patient.family_member_id, 1005, 'Knowing a phone/name must not claim another medical record');
        const studentLogin = await request('/auth/login', { method: 'POST', body: { roll_number: 'PRIVACY-ONE', pin: '2468' } });
        const student = studentLogin.response.headers.getSetCookie().find(c => c.startsWith('mp_student_session=') && !c.startsWith('mp_student_session=;')).split(';')[0];
        assert.equal((await request('/members/1001', { cookie: student })).status, 200);
        assert.equal((await request('/members/1004', { cookie: student })).status, 403);
        assert.equal((await request('/export/data', { cookie: student })).status, 200);
        const studentProfile = (await request('/students/profile?student_id=1002', { cookie: student })).data;
        assert.equal(studentProfile.student.id, 1001);
        const studentList = (await request('/students', { cookie: student })).data;
        assert.deepEqual(studentList.map(row => row.id), [1001]);
        assert.ok(!('pin' in studentList[0]));
        const { StudentModel } = require('../dist/modules/student/student.model');
        const studentModel = new StudentModel({ db });
        const existingAccount = studentModel.provisionPatient(1001, 'PRIVACY-CODE', { member_id: 1001, phone: '9000000001', pin: '9999' });
        assert.equal(existingAccount.alreadyExists, true);
        assert.ok(!('pin' in existingAccount));
        assert.equal(db.prepare('SELECT pin FROM patients WHERE id = 1001').get().pin, '2468');
        assert.throws(() => studentModel.provisionPatient(1001, 'PRIVACY-CODE', { member_id: 1003, phone: '9000000004', pin: '9999' }), { status: 409 });
        assert.equal((await request('/patient/login', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: { identifier: 'PAT-TEST-1001', pin: '2468' } })).status, 403);
        const crossOrigin = await request('/patient/corrections', { cookie: head, method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: {} });
        assert.equal(crossOrigin.status, 403);
        db.prepare("UPDATE portal_sessions SET expires_at = 0 WHERE role = 'patient' AND actor_id = 1001").run();
        assert.equal((await request('/patient/records', { cookie: head })).status, 401);
        await request('/session/patient/logout', { cookie: adult, method: 'POST' });
        assert.equal((await request('/patient/records', { cookie: adult })).status, 401);
    } finally {
        await app.close();
        app.get(DatabaseService).db.close();
        rmSync(folder, { recursive: true, force: true });
    }
});
