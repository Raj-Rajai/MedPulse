/**
 * Request script replayed against BOTH servers, in order, from the same starting database.
 * Each step: { name, method, path, as, body?, headers?, query?, field?, capture? }
 *  - as: who is calling (adds the auth header the portals send)
 *  - field: true adds a valid X-Field-Location header (student field writes are geofenced)
 *  - capture(body) -> object merged into vars; `{var}` in path/body strings is substituted.
 *    Captures are taken from the ORIGINAL server's response.
 */
export const AUTH = {
    student: { 'x-student-id': '1' },
    student2: { 'x-student-id': '56' },
    studentRoll: { 'x-roll-number': '235' },
    studentBearer: { authorization: 'Bearer 235' },
    admin: { 'x-admin-id': '1' },
    adminToken: { 'x-admin-token': 'admin-1' },
    adminBearer: { authorization: 'Bearer admin' },
    admin2: { 'x-admin-id': '35' },
    patient: { 'x-patient-id': '48' },
    patientBearer: { authorization: 'Bearer PAT-ROLL235-001' },
    hospital: { 'x-hospital-admin-id': '1' },
    hospitalBearer: { authorization: 'Bearer hosp-1' },
    bogusStudent: { 'x-student-id': '99999' },
};

export const AREA = { name: 'Khoraj', latitude: 23.1, longitude: 72.5, radius: 5000 };

const S = [];
const step = (s) => S.push(s);
const get = (path, as, extra = {}) => step({ method: 'GET', path, as, ...extra });
const post = (path, as, body, extra = {}) => step({ method: 'POST', path, as, body, ...extra });
const put = (path, as, body, extra = {}) => step({ method: 'PUT', path, as, body, ...extra });
const del = (path, as, extra = {}) => step({ method: 'DELETE', path, as, ...extra });

/* ---------------- unauthenticated / auth edge cases ---------------- */
get('/api/colleges');
get('/api/families');
get('/api/families', 'bogusStudent');
get('/api/families', 'studentRoll');
get('/api/families', 'studentBearer');
get('/api/families?roll_number=235');
get('/api/families?student_id=1');
get('/api/admin/stats');
get('/api/admin/me', 'adminToken');
get('/api/admin/me', 'adminBearer');
get('/api/admin/me?admin_id=1');
get('/api/patient/profile');
get('/api/patient/profile', 'patientBearer');
get('/api/patient/profile?patient_id=48');
get('/api/hospital/profile');
get('/api/hospital/profile', 'hospitalBearer');
get('/api/hospital/fap/summary');
get('/api/hospital/fap/does-not-exist');
get('/api/hospital/fap/does-not-exist', 'hospital');
get('/api/does-not-exist');
post('/api/does-not-exist', null, {});
step({ name: 'malformed json', method: 'POST', path: '/api/auth/login', raw: '{"roll_number":', headers: { 'content-type': 'application/json' } });

/* ---------------- auth (student) ---------------- */
post('/api/auth/login', null, { roll_number: '235', pin: '1234' });
post('/api/auth/login', null, { roll_number: '235', pin: '0000' });
post('/api/auth/login', null, {});
get('/api/auth/me?roll_number=235');
get('/api/auth/me?id=1');
get('/api/auth/me');
post('/api/auth/register', null, { roll_number: 'P900', name: 'Parity Student', pin: '4321', email: 'p@x.y', phone: '9000000001', college_id: 1 });
post('/api/auth/register', null, { roll_number: 'P900', name: 'Parity Student', pin: '4321' });
post('/api/auth/register', null, { name: 'No roll' });

/* ---------------- students ---------------- */
get('/api/students', 'student');
post('/api/students', 'student', { roll_number: 'P901', name: 'Second Parity', pin: '1111' });
post('/api/students', 'student', {});
get('/api/students/profile?roll_number=235');
get('/api/students/profile?student_id=1');
get('/api/students/profile');
put('/api/students/profile', 'student', { name: 'Dhruv Patel', email: 'dhruv.patel@medpulse.edu', phone: '+91 98765 43210' });
post('/api/students/change-pin', 'student', { current_pin: '0000', new_pin: '5555' });
post('/api/students/change-pin', 'student', { current_pin: '1234', new_pin: '12' });
post('/api/students/change-pin', 'student', { current_pin: '1234', new_pin: '1234' });

/* ---------------- admin ---------------- */
post('/api/admin/login', null, { username: 'admin', pin: '9999' });
post('/api/admin/login', null, { username: 'admin', pin: '1' });
post('/api/admin/login', null, {});
get('/api/admin/me', 'admin');
get('/api/admin/stats', 'admin');
get('/api/admin/students', 'admin');
get('/api/admin/students?search=dhruv', 'admin');
get('/api/admin/students?college_id=1&status=Active', 'admin');
post('/api/admin/students', 'admin', { roll_number: 'P902', name: 'Admin Made', pin: '2222', college_id: 1 }, { capture: (b) => ({ newStudent: b?.student?.id ?? b?.id }) });
post('/api/admin/students', 'admin', { roll_number: 'P902', name: 'Dup' });
post('/api/admin/students', 'admin', {});
put('/api/admin/students/{newStudent}', 'admin', { name: 'Admin Made 2', status: 'Active' });
put('/api/admin/students/999999', 'admin', { name: 'x' });
post('/api/admin/students/{newStudent}/reset-pin', 'admin', { new_pin: '3333' });
post('/api/admin/students/{newStudent}/reset-pin', 'admin', {});
get('/api/admin/students/1/families', 'admin');
get('/api/admin/students/999999/families', 'admin');
get('/api/admin/families', 'admin');
get('/api/admin/families?student_id=1&village=Khoraj&search=thakore', 'admin');
get('/api/admin/members', 'admin');
get('/api/admin/members?has_htn=Y&has_dm=Y&has_anaemia=Y&search=a', 'admin');
get('/api/admin/colleges', 'admin');
post('/api/admin/colleges', 'admin', { name: 'Parity College', code: 'PAR-01', city: 'Surat', state: 'Gujarat' }, { capture: (b) => ({ newCollege: b?.college?.id ?? b?.id }) });
post('/api/admin/colleges', 'admin', { name: 'Parity College', code: 'PAR-01' });
post('/api/admin/colleges', 'admin', {});
put('/api/admin/colleges/{newCollege}', 'admin', { city: 'Vadodara' });
put('/api/admin/colleges/999999', 'admin', { city: 'Nowhere' });
get('/api/admin/export/all-csv', 'admin', { kind: 'csv' });
get('/api/admin/export/all-csv?college_id=1', 'admin', { kind: 'csv' });
get('/api/admin/export/audit-pdf', 'admin', { kind: 'pdf' });
get('/api/admin/university-admins', 'admin');
get('/api/admin/university-admins?university_id=1', 'admin');
post('/api/admin/university-admins', 'admin', { username: 'parity.admin', name: 'Parity Admin', pin: '4444', email: 'pa@x.y', role: 'University Admin' }, { capture: (b) => ({ newAdmin: b?.admin?.id ?? b?.id }) });
post('/api/admin/university-admins', 'admin', { username: 'parity.admin', name: 'Dup' });
post('/api/admin/university-admins', 'admin2', { username: 'parity.admin2', name: 'By non-super' });
post('/api/admin/university-admins', 'admin', {});
put('/api/admin/university-admins/{newAdmin}', 'admin', { name: 'Parity Admin 2', status: 'Active' });
post('/api/admin/university-admins/{newAdmin}/reset-pin', 'admin', { new_pin: '5555' });
post('/api/admin/university-admins/{newAdmin}/reset-pin', 'admin', {});
del('/api/admin/university-admins/{newAdmin}', 'admin');
del('/api/admin/university-admins/1', 'admin');
del('/api/admin/university-admins/999999', 'admin');

/* ---------------- geofence ---------------- */
get('/api/admin/geofence', 'admin');
put('/api/admin/geofence', 'admin', { name: '', latitude: 1, longitude: 1, radius: 1 });
get('/api/student/geofence', 'student');
post('/api/families', 'student', { head_of_family: 'No area yet' }, { field: true });
put('/api/admin/geofence', 'admin', AREA);
get('/api/admin/geofence', 'admin');
get('/api/student/geofence', 'student');
post('/api/student/geofence/check', 'student', { latitude: 23.1, longitude: 72.5, accuracy: 10, timestamp: '{now}' });
post('/api/student/geofence/check', 'student', { latitude: 25, longitude: 75, accuracy: 10, timestamp: '{now}' });
post('/api/student/geofence/check', 'student', {});
post('/api/families', 'student', { head_of_family: 'No location' });
step({ method: 'POST', path: '/api/families', as: 'student', body: { head_of_family: 'Bad header' }, headers: { 'X-Field-Location': 'not-json' } });
post('/api/families', null, { head_of_family: 'No auth' }, { field: true });

/* ---------------- survey: families ---------------- */
get('/api/families', 'student');
get('/api/families?search=thakore', 'student');
get('/api/families', 'student2');
post('/api/families', 'student', {
    head_of_family: 'Parity Head', family_name: 'Parity Household', village: 'Khoraj', village_ward: 'Ward 1',
    address: '1 Parity Street', contact_number: '9000000002', religion: 'Hindu', total_cu: 3.2, calorie_intake_per_cu: 2400,
    members: [
        { name: 'Parity Head', relation_to_hof: 'Head', gender: 'M', age_years: 52, sbp: 150, dbp: 95, rbs: 210, has_dm: 'Y', height_m: 1.7, weight_kg: 80, waist_cm: 95, hip_cm: 100 },
        { name: 'Parity Spouse', relation_to_hof: 'Spouse', gender: 'F', age_years: 47, hb: 10.5, has_pallor: 'Y' },
        { name: 'Parity Child', relation_to_hof: 'Son', gender: 'M', age_years: 3, muac_cm: 13.5, date_of_birth: '2023-02-01' },
    ],
}, { field: true, capture: (b) => ({ fam: b.family_id }) });
post('/api/families', 'student', {}, { field: true });
post('/api/families', 'student', { head_of_family: 'Parity Head', family_code: 'FAM-235-01' }, { field: true });
get('/api/families/{fam}', 'student');
get('/api/families/{fam}', 'student2');
get('/api/families/999999', 'student');
get('/api/families/{fam}/members', 'student', { capture: (b) => ({ m1: b[0]?.id, m2: b[1]?.id, m3: b[2]?.id }) });
get('/api/families/{fam}/members?search=Spouse&gender=F', 'student');
get('/api/families/{fam}/members', 'student2');
put('/api/families/{fam}', 'student', { family_name: 'Parity Household Renamed', religion: 'Hindu', housing_type: 'Pucca' }, { field: true });
put('/api/families/{fam}', 'student2', { family_name: 'x' }, { field: true });
put('/api/families/999999', 'student', { family_name: 'x' }, { field: true });

/* ---------------- survey: members ---------------- */
post('/api/families/{fam}/members', 'student', { name: 'Parity Elder', gender: 'F', age_years: 71, sbp: 165, dbp: 92, hb: 9.8 }, { field: true, capture: (b) => ({ m4: b?.member?.id }) });
post('/api/families/{fam}/members', 'student', { name: '' }, { field: true });
post('/api/families/{fam}/members', 'student2', { name: 'x' }, { field: true });
put('/api/members/{m4}', 'student', { name: 'Parity Elder', age_years: 72, sbp: 140, dbp: 85, occupation: 'Retired' }, { field: true });
put('/api/members/{m4}', 'student2', { name: 'x' }, { field: true });
put('/api/members/999999', 'student', { name: 'x' }, { field: true });
get('/api/members/{m1}');
get('/api/members/999999');

/* conditions / medications / allergies / history / lifestyle / follow-ups */
get('/api/members/{m1}/conditions', 'student');
get('/api/members/{m1}/conditions', 'student2');
post('/api/members/{m1}/conditions', 'student', { condition_name: 'Hypertension', status: 'Active', diagnosed_year: 2020, notes: 'n' }, { field: true, capture: (b) => ({ cond: b?.condition?.id }) });
post('/api/members/{m1}/conditions', 'student', { condition_name: ' ' }, { field: true });
put('/api/conditions/{cond}', 'student', { condition_name: 'Hypertension', status: 'Controlled' }, { field: true });
put('/api/conditions/{cond}', 'student', { condition_name: '' }, { field: true });
put('/api/conditions/999999', 'student', { condition_name: 'x' }, { field: true });
get('/api/members/{m1}/medications', 'student');
post('/api/members/{m1}/medications', 'student', { medicine_name: 'Amlodipine', dosage: '5mg', frequency: 'OD', purpose: 'BP' }, { field: true, capture: (b) => ({ med: b?.medication?.id }) });
post('/api/members/{m1}/medications', 'student', {}, { field: true });
put('/api/medications/{med}', 'student', { medicine_name: 'Amlodipine', dosage: '10mg', status: 'Active' }, { field: true });
put('/api/medications/{med}', 'student', { medicine_name: '' }, { field: true });
get('/api/members/{m1}/allergies', 'student');
post('/api/members/{m1}/allergies', 'student', { allergen: 'Penicillin', severity: 'Severe', reaction: 'Rash' }, { field: true, capture: (b) => ({ alg: b?.allergy?.id }) });
post('/api/members/{m1}/allergies', 'student', {}, { field: true });
put('/api/allergies/{alg}', 'student', { allergen: 'Penicillin', severity: 'Moderate' }, { field: true });
put('/api/allergies/{alg}', 'student', { allergen: '' }, { field: true });
get('/api/members/{m1}/history', 'student');
post('/api/members/{m1}/history', 'student', { event_type: 'Surgery', description: 'Appendectomy', year: 2015, hospital_doctor: 'Civil' }, { field: true, capture: (b) => ({ hist: b?.history?.id }) });
post('/api/members/{m1}/history', 'student', {}, { field: true });
put('/api/history/{hist}', 'student', { description: 'Appendectomy (lap)', event_year: 2016 }, { field: true });
put('/api/history/{hist}', 'student', { description: '' }, { field: true });
get('/api/members/{m1}/lifestyle', 'student');
post('/api/members/{m1}/lifestyle', 'student', { smoking_status: 'Former', alcohol_status: 'Never', physical_activity: 'Moderate', diet: 'Vegetarian', salt_intake: 'High' }, { field: true });
get('/api/members/{m1}/lifestyle', 'student');
post('/api/members/{m1}/lifestyle', 'student', { smoking_status: 'Never', notes: 'quit' }, { field: true });
post('/api/members/{m1}/follow-ups', 'student', { visit_date: '2026-09-30', sbp: 142, dbp: 88, rbs: 160, hb: 13, weight_kg: 79, clinical_notes: 'better' }, { field: true, capture: (b) => ({ fu: b?.follow_up?.id }) });
post('/api/members/{m1}/follow-ups', 'student2', { visit_date: '2026-09-30' }, { field: true });
get('/api/members/{m1}', null);
get('/api/families/{fam}', 'student');

/* ---------------- analytics + exports (student) ---------------- */
get('/api/analytics/summary', 'student');
get('/api/analytics/summary', 'student2');
get('/api/analytics/charts', 'student');
get('/api/analytics/charts?gender=F', 'student');
get('/api/analytics/charts?ageGroup=adult', 'student');
get('/api/analytics/charts?familyId={fam}', 'student');
for (const r of ['1', '2', '3', '4', '5', '6', '7', '8', 'ncd', 'anaemia', 'bmi', 'pediatric', 'calorie', 'audit', 'bogus']) get(`/api/analytics/report/${r}`, 'student');
get('/api/export/csv', 'student', { kind: 'csv' });
get('/api/export/pdf', 'student', { kind: 'pdf' });
get('/api/export/data', 'student');
get('/api/export/data', 'student2');

/* ---------------- patients ---------------- */
post('/api/patient/verify-referral', null, { referral_code: 'SAL-235-DA9B' });
post('/api/patient/verify-referral', null, { referral_code: 'NOPE' });
post('/api/patient/verify-referral', null, {});
post('/api/patient/login', null, { identifier: '9876543210', pin: '1234' });
post('/api/patient/login', null, { identifier: 'PAT-ROLL235-001', pin: '1234' });
post('/api/patient/login', null, { identifier: '9876543210', pin: '0' });
post('/api/patient/login', null, {});
post('/api/patient/register', null, { name: 'Parity Patient', phone: '9000000003', pin: '1234', gender: 'F', age_years: 40, address: 'x' }, { capture: (b) => ({ pat: b?.patient?.id }) });
post('/api/patient/register', null, { name: 'Parity Patient', phone: '9000000003', pin: '1234' });
post('/api/patient/register', null, { name: 'Adopted Patient', phone: '9000000004', pin: '1234', is_adopted: true, referral_code: 'SAL-235-DA9B', date_of_birth: '1980-01-01' }, { capture: (b) => ({ pat2: b?.patient?.id }) });
post('/api/patient/register', null, {});
get('/api/patient/profile', 'patient');
get('/api/patient/records', 'patient');
step({ method: 'GET', path: '/api/patient/profile', headers: { 'x-patient-id': '{pat}' } });
step({ method: 'POST', path: '/api/patient/link-referral', headers: { 'x-patient-id': '{pat}' }, body: { referral_code: 'NOPE' } });
step({ method: 'POST', path: '/api/patient/link-referral', headers: { 'x-patient-id': '{pat}' }, body: { referral_code: 'SAL-235-DA9B' } });
step({ method: 'GET', path: '/api/patient/records', headers: { 'x-patient-id': '{pat}' } });

/* patient portal */
get('/api/patient/card', 'patient');
put('/api/patient/profile', 'patient', { blood_group: 'B+', emergency_contact_name: 'Son', emergency_contact_phone: '9000000005', emergency_contact_relation: 'Son' });
put('/api/patient/profile', 'patient', { blood_group: 'Z+' });
get('/api/patient/family', 'patient');
put('/api/patient/family', 'patient', { address: '53, Krishna Nagar', village: 'Khoraj' });
post('/api/patient/family/members', 'patient', { name: 'Patient Added Kid', relation_to_hof: 'Son', gender: 'Male', date_of_birth: '2015-06-01' }, { capture: (b) => ({ pm: b?.id }) });
post('/api/patient/family/members', 'patient', {});
put('/api/patient/family/members/{pm}', 'patient', { occupation: 'Student' });
put('/api/patient/family/members/{pm}', 'patient', { name: 'Patient Added Kid', relation_to_hof: 'Son', gender: 'Male', date_of_birth: '2015-06-02', contact_number: '12' });
put('/api/patient/family/members/999999', 'patient', { name: 'x' });
step({ method: 'GET', path: '/api/patient/family', headers: { 'x-patient-id': '{pat}' } });
step({ method: 'POST', path: '/api/patient/family/members', headers: { 'x-patient-id': '{pat2}' }, body: { name: 'Pat2 kid', relation_to_hof: 'Daughter', gender: 'Female', age_years: 5 } });
get('/api/patient/hospital', 'patient');
get('/api/patient/hospital-requests', 'patient');
post('/api/patient/hospital-requests', 'patient', { channel: 'Callback', department: 'General Medicine', reason: 'Book appointment', message: 'Need BP review', preferred_time: 'Morning' }, { capture: (b) => ({ cb: b?.request?.id }) });
post('/api/patient/hospital-requests', 'patient', { channel: 'Fax' });
post('/api/patient/hospital-requests', 'patient', { channel: 'WhatsApp', department: 'Cardiology (Heart / BP)', reason: 'Other', for_member_id: '{pm}' }, { capture: (b) => ({ cb2: b?.request?.id }) });
get('/api/patient/hospital-requests', 'patient');
get('/api/crm/hospital/callback-requests', 'hospital');
get('/api/crm/hospital/callback-requests?status=Open', 'hospital');
get('/api/crm/hospital/callback-requests?status=All', 'hospital');
post('/api/crm/hospital/callback-requests/{cb}/status', 'hospital', { status: 'Scheduled', note: 'Tomorrow 10am', scheduled_for: '2026-10-05 10:00' });
post('/api/crm/hospital/callback-requests/{cb}/status', 'hospital', { status: 'Bogus' });
post('/api/crm/hospital/callback-requests/999999/status', 'hospital', { status: 'Resolved' });
post('/api/patient/hospital-requests/{cb}/confirm', 'patient', { confirmed: true });
post('/api/crm/hospital/callback-requests/{cb}/status', 'hospital', { status: 'Resolved', note: 'Done' });
post('/api/patient/hospital-requests/{cb}/confirm', 'patient', { confirmed: 'yes' });
post('/api/patient/hospital-requests/{cb2}/cancel', 'patient', {});
post('/api/patient/hospital-requests/{cb2}/cancel', 'patient', {});
post('/api/patient/hospital-requests/999999/cancel', 'patient', {});
del('/api/patient/family/members/{pm}', 'patient');
del('/api/patient/family/members/999999', 'patient');

/* ---------------- campaigns + engagement ---------------- */
get('/api/campaigns');
get('/api/campaigns?college_id=1');
get('/api/campaigns/preview?keyword=HTN', 'admin');
get('/api/campaigns/preview', 'admin');
post('/api/campaigns/preview', 'admin', { keyword: 'DM' });
post('/api/campaigns/preview', 'admin', { keyword: 'Anaemia' });
post('/api/campaigns/preview', 'admin', {});
post('/api/campaigns', 'admin', { title: 'Parity Diabetes Camp', keyword: 'DM', description: 'Free sugar test', event_date: '2026-11-01', venue: 'RHTC', auto_dispatch: false }, { capture: (b) => ({ camp: b?.campaign?.id }) });
post('/api/campaigns', 'admin', { title: 'Parity HTN Camp', keyword: 'HTN', description: 'BP camp', event_date: '2026-11-02', venue: 'UHTC' }, { capture: (b) => ({ camp2: b?.campaign?.id }) });
post('/api/campaigns', 'admin', {});
get('/api/campaigns/{camp}', 'admin');
get('/api/campaigns/999999', 'admin');
post('/api/campaigns/{camp}/dispatch', 'admin', {});
post('/api/campaigns/999999/dispatch', 'admin', {});
get('/api/patient/notifications', 'patient', { capture: (b) => ({ notif: b?.notifications?.[0]?.notification_id }) });
post('/api/patient/notifications/mark-read', 'patient', {});
post('/api/patient/notifications/{notif}/rsvp', 'patient', { rsvp: 'Attending', note: 'Will come' });
post('/api/patient/notifications/{notif}/rsvp', 'patient', { rsvp: 'Maybe' });
post('/api/patient/notifications/999999/rsvp', 'patient', { rsvp: 'Attending' });
post('/api/patient/notifications/{notif}/acknowledge', 'patient', { status: 'Acknowledged', response_note: 'ok' });
post('/api/patient/notifications/999999/acknowledge', 'patient', {});
get('/api/student/campaign-tasks', 'student');
post('/api/student/campaign-tasks/{notif}/status', 'student', { status: 'Contacted' }, { field: true });
post('/api/student/campaign-tasks/{notif}/status', 'student', { status: 'Nope' }, { field: true });
post('/api/student/campaign-tasks/{notif}/status', 'student2', { status: 'Assisted' }, { field: true });
post('/api/patient/notifications/{notif}/confirm-contact', 'patient', { confirmed: true });
post('/api/patient/notifications/{notif}/confirm-contact', 'patient', { confirmed: false });
post('/api/patient/notifications/999999/confirm-contact', 'patient', { confirmed: true });
get('/api/patient/notifications', 'patient');
get('/api/campaigns/1', 'admin');

/* ---------------- student provisions a patient ---------------- */
post('/api/students/provision-patient', 'student', { member_id: '{m2}', phone: '9000000006', pin: '1234', name: 'Parity Spouse' }, { field: true });
post('/api/students/provision-patient', 'student', { member_id: '{m2}', phone: '9000000006', pin: '1234' }, { field: true });
post('/api/students/provision-patient', 'student', {}, { field: true });
post('/api/students/provision-patient', 'student2', { member_id: '{m3}', phone: '9000000007', pin: '1234' }, { field: true });

/* ---------------- hospital ---------------- */
post('/api/hospital/login', null, { username: 'hosp_superadmin', pin: '8888' });
post('/api/hospital/login', null, { username: 'hosp_superadmin', pin: '0' });
post('/api/hospital/login', null, {});
get('/api/hospital/profile', 'hospital');
get('/api/hospital/stats', 'hospital');
get('/api/hospital/filter-options', 'hospital');
get('/api/hospital/patients', 'hospital');
get('/api/hospital/patients?condition=HTN&limit=5&offset=0', 'hospital');
get('/api/hospital/patients?university_id=1&student_id=1&model_type=Dependent&search=radhu', 'hospital');
get('/api/hospital/patients?condition=DM', 'hospital');
get('/api/hospital/patients?condition=Anaemia', 'hospital');
get('/api/hospital/patients/48', 'hospital');
get('/api/hospital/patients/999999', 'hospital');
get('/api/hospital/staff', 'hospital');
post('/api/hospital/staff', 'hospital', { username: 'parity.staff', name: 'Parity Staff', email: 'ps@x.y', phone: '9000000008', role: 'Hospital Admin', department: 'Cardiology' }, { capture: (b) => ({ staff: b?.staff_id }) });
post('/api/hospital/staff', 'hospital', { username: 'parity.staff', name: 'Dup' });
post('/api/hospital/staff', 'hospital', {});
put('/api/hospital/staff/{staff}', 'hospital', { name: 'Parity Staff 2', department: 'Medicine', status: 'Active' });
put('/api/hospital/staff/999999', 'hospital', { name: 'x' });
post('/api/hospital/staff/{staff}/reset-pin', 'hospital', { pin: '7777' });
post('/api/hospital/staff/{staff}/reset-pin', 'hospital', {});
step({ method: 'GET', path: '/api/hospital/staff', headers: { 'x-hospital-admin-id': '{staff}' } });
step({ method: 'POST', path: '/api/hospital/staff', headers: { 'x-hospital-admin-id': '{staff}' }, body: { username: 'by.staff', name: 'By Staff' } });
del('/api/hospital/staff/1', 'hospital');
del('/api/hospital/staff/{staff}', 'hospital');
del('/api/hospital/staff/999999', 'hospital');
get('/api/hospital/visits', 'hospital');
get('/api/hospital/visits?search=thakore&department=General%20Medicine&limit=2&offset=0', 'hospital');
get('/api/hospital/visits/summary', 'hospital');
post('/api/hospital/visits', 'hospital', { patient_name: 'Parity Walk-in', age_years: 33, gender: 'F', contact_number: '9000000009', department: 'General Medicine', chief_complaint: 'Fever', sbp: 120, dbp: 80, pulse: 90, temperature: 101.2, diagnosis: 'Viral fever', disposition: 'Discharged OPD' }, { capture: (b) => ({ visit: b?.visit?.id }) });
post('/api/hospital/visits', 'hospital', { family_member_id: '{m1}', department: 'Cardiology', chief_complaint: 'BP high', sbp: 170, dbp: 100 }, { capture: (b) => ({ visit2: b?.visit?.id }) });
post('/api/hospital/visits', 'hospital', {});
get('/api/hospital/visits/{visit}', 'hospital');
get('/api/hospital/visits/999999', 'hospital');
get('/api/hospital/visits/summary', 'hospital');
get('/api/hospital/stats', 'hospital');

/* FAP (family adoption programme) dossier */
get('/api/hospital/fap/summary', 'hospital');
get('/api/hospital/fap/options', 'hospital');
get('/api/hospital/fap/patients', 'hospital');
get('/api/hospital/fap/patients?search=thakore&limit=5&offset=5', 'hospital');
get('/api/hospital/fap/patients?condition=HTN', 'hospital');
get('/api/hospital/fap/patients?condition=DM&student_id=1&university_id=1', 'hospital');
get('/api/hospital/fap/patients?condition=NoFollowUp', 'hospital');
get('/api/hospital/fap/patients?condition=Pediatric', 'hospital');
get('/api/hospital/fap/patients?limit=500', 'hospital');
get('/api/hospital/fap/patients?student_id=abc', 'hospital');
get('/api/hospital/fap/patients?condition=Bogus', 'hospital');
get('/api/hospital/fap/patients/{m1}', 'hospital');
get('/api/hospital/fap/patients/abc', 'hospital');
get('/api/hospital/fap/patients/999999', 'hospital');

/* ---------------- deletes (student) ---------------- */
del('/api/follow-ups/{fu}', 'student2', { field: true });
del('/api/follow-ups/{fu}', 'student', { field: true });
del('/api/follow-ups/{fu}', 'student', { field: true });
del('/api/conditions/{cond}', 'student', { field: true });
del('/api/conditions/{cond}', 'student', { field: true });
del('/api/medications/{med}', 'student', { field: true });
del('/api/allergies/{alg}', 'student', { field: true });
del('/api/history/{hist}', 'student', { field: true });
del('/api/history/{hist}', 'student2', { field: true });
del('/api/members/{m4}', null, { field: true });
del('/api/members/{m4}', 'student', { field: true });
del('/api/members/{m4}', 'student', { field: true });
del('/api/families/{fam}', 'student2', { field: true });
del('/api/families/{fam}', 'student', { field: true });
del('/api/families/{fam}', 'student', { field: true });
get('/api/families', 'student');
del('/api/admin/students/{newStudent}', 'admin');
del('/api/admin/students/{newStudent}', 'admin');
get('/api/admin/stats', 'admin');
get('/api/hospital/stats', 'hospital');

/* ---------------- pages (HTML frontend served by the API server) ---------------- */
for (const p of ['/', '/login', '/register', '/login.html', '/register.html', '/admin', '/admin/', '/admin.html', '/admin/admin.html', '/admin/login',
    '/hospital', '/hospital.html', '/hospital/hospital.html', '/hospital/login', '/hospital/hospital.css', '/hospital/hospital-ui.js',
    '/patient', '/patient.html', '/patient/patient.js', '/patient/login', '/student', '/student/login', '/profile.html', '/style.css',
    '/app.js', '/vendor/chart.umd.min.js', '/manifest.webmanifest', '/some/spa/route', '/admin/nope.html']) {
    get(p, null, { kind: 'page' });
}

export const steps = S;
