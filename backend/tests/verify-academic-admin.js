const { db, initDatabase } = require('../config/db');

console.log('Testing Admin Academic Management APIs & Transactions...');
initDatabase();

// 1. Verify 5-student clinical cohort exists
const studentCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
console.log(`Students count in database: ${studentCount}`);
if (studentCount < 5) {
    console.error('❌ Expected at least 5 students in cohort!');
    process.exit(1);
}

// 2. Test Attendance Sheet Query & Transaction
const date = '2026-10-02';
const lectureNo = 1;
const checkStmt = db.prepare('SELECT id FROM student_attendance WHERE student_id = ? AND date = ? AND lecture_no = ?');
const insertStmt = db.prepare(`
    INSERT INTO student_attendance (student_id, date, lecture_no, room_no, time_slot, subject_code, subject, session_type, faculty_name, status, hours, topic, remarks)
    VALUES (?, ?, ?, 'LT-2', '08:10 to 08:55', '2010043342', '2010043342 – COMMUNITY MEDICINE (PSM)', 'Theory', 'DRASHTI R SONI', ?, 1.0, 'Automated Test Topic', 'Verified')
`);
const updateStmt = db.prepare(`
    UPDATE student_attendance 
    SET status = ?, remarks = ?
    WHERE id = ?
`);

const testStudents = db.prepare('SELECT id FROM students LIMIT 3').all();

db.exec('BEGIN');
for (const s of testStudents) {
    const existing = checkStmt.get(s.id, date, lectureNo);
    if (existing) {
        updateStmt.run('Present', 'Automated Test Update', existing.id);
    } else {
        insertStmt.run(s.id, date, lectureNo, 'Present');
    }
}
db.exec('COMMIT');

const markedCount = db.prepare('SELECT COUNT(*) as c FROM student_attendance WHERE date = ? AND lecture_no = ?').get(date, lectureNo).c;
console.log(`Marked attendance count for test slot: ${markedCount}`);
if (markedCount < 3) {
    console.error('❌ Attendance transaction failed!');
    process.exit(1);
}

console.log('✅ Admin Academic Backend tests passed successfully!');
