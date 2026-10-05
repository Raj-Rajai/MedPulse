require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { academicSchema } = require('../dist/database/schemas/40-academic.schema');
const { attendanceClusterSchema } = require('../dist/database/schemas/41-attendance-cluster.schema');
const { AttendanceClusterService } = require('../dist/modules/academic/attendance-cluster.service');
const { AcademicModel } = require('../dist/modules/academic/academic.model');

function fixture(t) {
    let now = 1800000000000;
    t.mock.method(Date, 'now', () => now);
    const db = new DatabaseSync(':memory:');
    db.exec(`PRAGMA foreign_keys = ON;
        CREATE TABLE colleges (id INTEGER PRIMARY KEY);
        CREATE TABLE admins (id INTEGER PRIMARY KEY);
        CREATE TABLE students (id INTEGER PRIMARY KEY, college_id INTEGER, name TEXT, roll_number TEXT, batch_year TEXT);
        INSERT INTO colleges VALUES (1), (2);
        INSERT INTO admins VALUES (1), (2);
        INSERT INTO students VALUES (1,1,'Student One','101','MBBS'), (2,1,'Student Two','102','MBBS'), (3,1,'Student Three','103','MBBS'), (4,2,'Other College','104','MBBS');`);
    academicSchema.apply(db);
    attendanceClusterSchema.apply(db);
    attendanceClusterSchema.apply(db);
    db.exec(`INSERT INTO academic_lectures (id,college_id,lecture_date,lecture_no,subject_code,subject_name)
        VALUES (1,1,'2026-10-06',1,'A','Anatomy'),(2,2,'2026-10-06',1,'A','Anatomy'),
        (3,1,'2026-10-06',1,'B','Biology');`);
    const service = new AttendanceClusterService({ db });
    const model = new AcademicModel({ db }, service);
    t.after(() => { service.onModuleDestroy(); db.close(); });
    const student = { id: 1, college_id: 1 };
    const start = (options = {}) => service.start(1, 1, 1, { student_ids: [1, 2], ...options });
    const advance = ms => { now += ms; };
    const observe = (cluster, rssi = -59, who = student) => {
        const challenge = service.challenge(who, cluster.cluster_id);
        advance(2000);
        const body = { student_id: who.id, challenge: challenge.challenge,
            samples: Array.from({ length: 5 }, (_, i) => ({ rssi, observed_at: now - 1500 + i * 300 })) };
        return { body, result: service.observe(1, 1, cluster.cluster_id, cluster.anchor_token, body) };
    };
    return { db, service, model, student, start, advance, observe };
}

test('default 1m accepts the boundary; submission is one-time and secret stays private', t => {
    const f = fixture(t), c = f.start();
    assert.equal(c.radius_m, 1);
    assert.equal(c.ends_at - c.started_at, 300000);
    assert.equal(f.observe(c).result.allowed, true);
    assert.equal(f.model.fillAttendance(f.student, { lecture_id: 1 }).status, 'Present');
    assert.equal(f.model.fillAttendance(f.student, { lecture_id: 1 }).already_recorded, true);
    const report = f.service.inspect(1, c.cluster_id);
    assert.equal(report.present, 1);
    assert.ok(!JSON.stringify(report).includes(c.anchor_token));
    assert.ok(!('anchor_token_hash' in report));
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM academic_attendance').get().n, 1);
});

test('outside 1m denied and absent at exact deadline; non-roster students untouched', t => {
    const f = fixture(t), c = f.start({ duration_seconds: 10 });
    assert.equal(f.observe(c, -60).result.allowed, false);
    assert.throws(() => f.service.fill(f.student, { lecture_id: 1 }), { status: 403 });
    f.advance(8000);
    assert.throws(() => f.service.fill(f.student, { lecture_id: 1 }), { status: 409 });
    assert.deepEqual(f.db.prepare('SELECT status FROM academic_attendance ORDER BY student_id').all().map(r => r.status), ['Absent','Absent']);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM academic_attendance WHERE student_id = 3').get().n, 0);
    f.service.expire();
    assert.equal(f.service.inspect(1, c.cluster_id).events.filter(e => e.event === 'closed').length, 1);
});

test('radius is adjustable; invalid configuration and cross-college rosters are rejected atomically', t => {
    const f = fixture(t);
    for (const options of [{ radius_m: 0 }, { radius_m: '1' }, { duration_seconds: -1 }, { student_ids: [] }, { student_ids: [1,4] }]) {
        assert.throws(() => f.start(options), { status: 400 });
    }
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM attendance_clusters').get().n, 0);
    const c = f.start({ radius_m: 2 });
    assert.equal(f.observe(c, -64).result.allowed, true);
    assert.throws(() => f.start(), { status: 409 });
    assert.throws(() => f.service.start(1,1,3,{ student_ids: [1] }), { status: 409 });
});

test('student input cannot bypass proximity, roster or college checks', t => {
    const f = fixture(t), c = f.start();
    assert.throws(() => f.model.fillAttendance(f.student, { lecture_id: 1, distance_m: 0, bluetooth_connected: true }), { status: 403 });
    assert.throws(() => f.model.fillAttendance(f.student, { date: '2026-10-06', lecture_no: 1 }), { status: 409 });
    assert.throws(() => f.model.fillAttendance(f.student, { lecture_id: 2 }), { status: 409 });
    assert.throws(() => f.service.challenge({ id: 3, college_id: 1 }, c.cluster_id), { status: 403 });
    assert.throws(() => f.service.challenge({ id: 4, college_id: 2 }, c.cluster_id), { status: 404 });
    assert.throws(() => f.service.inspect(2, c.cluster_id), { status: 404 });
    assert.throws(() => f.service.end(2, c.cluster_id), { status: 404 });
    assert.throws(() => f.service.fill(f.student, { lecture_id: 1, status: 'Leave' }), { status: 400 });
});

test('anchor credentials, freshness and replay enforced', t => {
    const f = fixture(t), c = f.start();
    const { body } = f.observe(c);
    assert.throws(() => f.service.observe(1,1,c.cluster_id,'wrong',body), { status: 403 });
    assert.throws(() => f.service.observe(1,2,c.cluster_id,c.anchor_token,body), { status: 403 });
    assert.throws(() => f.service.observe(1,1,c.cluster_id,c.anchor_token,body), { status: 403 });
    f.advance(10000);
    assert.throws(() => f.service.fill(f.student,{ lecture_id: 1 }), { status: 403 });
    const challenge = f.service.challenge(f.student, c.cluster_id);
    f.advance(30000);
    assert.throws(() => f.service.observe(1,1,c.cluster_id,c.anchor_token,{ ...body, challenge: challenge.challenge }), { status: 403 });
});

test('sample validation rejects missing, stale, future, unordered and pre-challenge observations', t => {
    const f = fixture(t), c = f.start();
    const challenge = f.service.challenge(f.student,c.cluster_id);
    f.advance(2000);
    const samples = Array.from({ length: 5 }, (_, i) => ({ rssi: -59, observed_at: Date.now() - 1500 + i * 300 }));
    for (const bad of [[], samples.slice(0,4), samples.map(s => ({...s,rssi:0})),
        samples.map(s => ({...s,observed_at:Date.now()+100})), [...samples].reverse(),
        samples.map(s => ({...s,observed_at:s.observed_at-2000}))]) {
        assert.throws(() => f.service.observe(1,1,c.cluster_id,c.anchor_token,{ student_id:1,challenge:challenge.challenge,samples:bad }), { status: 400 });
    }
});

test('ending preserves present and faculty overrides; durable expiry recovers after restart', t => {
    const f = fixture(t), c = f.start();
    f.observe(c);
    f.service.fill(f.student,{ lecture_id:1 });
    f.db.exec(`INSERT INTO academic_attendance (lecture_id,student_id,lecture_date,lecture_no,status,marked_by_admin_id)
        VALUES (1,2,'2026-10-06',1,'Leave',1)`);
    f.advance(300000);
    const restarted = new AttendanceClusterService({ db:f.db });
    restarted.onModuleInit();
    restarted.onModuleDestroy();
    assert.deepEqual(f.db.prepare('SELECT status FROM academic_attendance ORDER BY student_id').all().map(r => r.status), ['Present','Leave']);
    assert.equal(f.service.end(1,c.cluster_id).status,'closed');
    assert.throws(() => f.service.challenge(f.student,c.cluster_id), { status:409 });
    assert.throws(() => f.model.updateLecture(1,1,{ topic:'Changed' }), { status:409 });
    assert.throws(() => f.model.deleteLecture(1,1), { status:409 });
});

test('manual close marks pending students absent immediately', t => {
    const f = fixture(t), c = f.start();
    f.service.end(1,c.cluster_id);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM academic_attendance WHERE status='Absent'").get().n,2);
    assert.equal(f.db.prepare('SELECT attendance_requested FROM academic_lectures WHERE id=1').get().attendance_requested,0);
});

test('automatic timer finalizes without requests', t => {
    const f = fixture(t);
    f.start({ duration_seconds:10 });
    t.mock.timers.enable({ apis:['setInterval'] });
    f.service.onModuleInit();
    f.advance(10000);
    t.mock.timers.tick(1000);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM academic_attendance WHERE status='Absent'").get().n,2);
});

test('waiting room join is idempotent, scoped, and never grants attendance', t => {
    const f = fixture(t), c = f.start();
    assert.equal(f.service.forLecture(1,1).cluster.id,c.cluster_id);
    assert.equal(f.service.forLecture(1,3).cluster,null);
    assert.throws(() => f.service.forLecture(2,1),{ status:404 });
    const joined = f.service.join(f.student,c.cluster_id);
    assert.ok(joined.joined_at);
    assert.equal(joined.verified_until,null);
    assert.equal(joined.attendance_status,null);
    assert.equal(joined.subject_name,'Anatomy');
    assert.ok(!('students' in joined));
    assert.ok(!('anchor_token_hash' in joined));
    f.service.join(f.student,c.cluster_id);
    assert.equal(f.service.inspect(1,c.cluster_id).joined,1);
    assert.equal(f.service.inspect(1,c.cluster_id).events.filter(e=>e.event==='joined').length,1);
    assert.throws(()=>f.service.fill(f.student,{cluster_id:c.cluster_id}),{status:403});
    assert.throws(()=>f.service.studentRoom({id:3,college_id:1},c.cluster_id),{status:403});
    assert.throws(()=>f.service.join({id:4,college_id:2},c.cluster_id),{status:404});
    f.service.end(1,c.cluster_id);
    assert.equal(f.service.studentRoom(f.student,c.cluster_id).attendance_status,'Absent');
    assert.throws(()=>f.service.join(f.student,c.cluster_id),{status:409});
});
