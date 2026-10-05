import type { Db, SchemaModule } from '../db.types';

/**
 * Academic records behind /api/academic/* (student portal) and /api/admin/academic/* (admin console).
 * Everything is scoped to a college: subjects, lecture sessions and exams carry college_id, while
 * attendance and marks rows belong to one student and one lecture / exam.
 */
export const academicSchema: SchemaModule = {
    name: 'academic',
    apply(db: Db) {
        db.exec(`
            -- Subject catalogue per college (code as used by the admin consoles, e.g. 2010043342)
            CREATE TABLE IF NOT EXISTS academic_subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                default_faculty TEXT,
                default_room TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (college_id, code)
            );

            -- One taught session: a subject in a lecture slot on a date
            CREATE TABLE IF NOT EXISTS academic_lectures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
                lecture_date TEXT NOT NULL,
                lecture_no INTEGER NOT NULL,
                subject_code TEXT NOT NULL,
                subject_name TEXT NOT NULL,
                session_type TEXT NOT NULL DEFAULT 'Theory' CHECK (session_type IN ('Theory', 'Practical')),
                time_slot TEXT,
                room_no TEXT,
                faculty_name TEXT,
                topic TEXT,
                created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (college_id, lecture_date, lecture_no, subject_code)
            );
            CREATE INDEX IF NOT EXISTS idx_academic_lectures_slot ON academic_lectures(college_id, lecture_date, lecture_no);

            -- A student's attendance in one lecture slot (one status per student per date + slot)
            CREATE TABLE IF NOT EXISTS academic_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER NOT NULL REFERENCES academic_lectures(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                lecture_date TEXT NOT NULL,
                lecture_no INTEGER NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Field Duty')),
                remarks TEXT,
                marked_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (student_id, lecture_date, lecture_no)
            );
            CREATE INDEX IF NOT EXISTS idx_academic_attendance_lecture ON academic_attendance(lecture_id);
            CREATE INDEX IF NOT EXISTS idx_academic_attendance_slot ON academic_attendance(lecture_date, lecture_no);

            -- One examination of a subject for a year (IA-1, IA-2, Preliminary, University)
            CREATE TABLE IF NOT EXISTS academic_exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
                year_level INTEGER NOT NULL,
                exam_type TEXT NOT NULL CHECK (exam_type IN ('IA-1', 'IA-2', 'Preliminary', 'University')),
                subject_code TEXT NOT NULL,
                subject_name TEXT NOT NULL,
                exam_code TEXT,
                exam_name TEXT,
                exam_date TEXT,
                academic_year TEXT,
                created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (college_id, year_level, exam_type, subject_code)
            );

            -- A student's marks in one exam (totals and status computed on save)
            CREATE TABLE IF NOT EXISTS academic_exam_marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_id INTEGER NOT NULL REFERENCES academic_exams(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                paper1_obtained REAL,
                paper2_obtained REAL,
                theory_obtained REAL NOT NULL DEFAULT 0,
                practical_obtained REAL NOT NULL DEFAULT 0,
                viva_obtained REAL NOT NULL DEFAULT 0,
                total_obtained REAL NOT NULL DEFAULT 0,
                total_max REAL NOT NULL,
                percentage REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL CHECK (status IN ('Distinction', 'Pass', 'Fail', 'Absent')),
                faculty_remarks TEXT,
                entered_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (exam_id, student_id)
            );
            CREATE INDEX IF NOT EXISTS idx_academic_exam_marks_student ON academic_exam_marks(student_id);
        `);

        // Migration: add attendance_requested columns to academic_lectures if not present
        try {
            db.exec('ALTER TABLE academic_lectures ADD COLUMN attendance_requested INTEGER DEFAULT 0;');
        } catch {
            // column already exists
        }
        try {
            db.exec('ALTER TABLE academic_lectures ADD COLUMN attendance_requested_at TEXT;');
        } catch {
            // column already exists
        }
    },
};
