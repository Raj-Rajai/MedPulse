const path = require('node:path');
const { initDatabase, db } = require('../config/db');

console.log('Testing Academic Schema & Data Initialization...');
initDatabase();

// Verify tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'student_%'").all();
console.log('Tables found:', tables.map(t => t.name));

const attendanceCount = db.prepare('SELECT COUNT(*) as count FROM student_attendance WHERE student_id = 1').get();
console.log('Attendance records for Student 1:', attendanceCount.count);

const examsCount = db.prepare('SELECT COUNT(*) as count FROM student_exams WHERE student_id = 1').get();
console.log('Exam records for Student 1:', examsCount.count);

if (attendanceCount.count > 0 && examsCount.count > 0) {
    console.log('✅ Academic schema and seed verified successfully!');
} else {
    console.error('❌ Missing seed records!');
    process.exit(1);
}
