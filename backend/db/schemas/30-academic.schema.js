/**
 * Academic schema: Student Attendance and Examination Results.
 * Loaded automatically by backend/config/db.js (sorted by filename).
 *
 * Fully modular and isolated to the Student Portal dimension.
 */
module.exports = {
    name: 'academic',
    apply(db) {
        db.exec(`
            -- =================================================================
            -- 1. Student Attendance Ledger (Datewise & Subject-Wise)
            -- =================================================================
            CREATE TABLE IF NOT EXISTS student_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                date TEXT NOT NULL,                     -- ISO 'YYYY-MM-DD'
                lecture_no INTEGER DEFAULT 1,
                room_no TEXT DEFAULT '',
                time_slot TEXT DEFAULT '08:10 to 08:55',
                subject_code TEXT DEFAULT '2010043342',
                subject TEXT NOT NULL DEFAULT 'COMMUNITY MEDICINE (PSM)',
                session_type TEXT NOT NULL DEFAULT 'Theory', -- 'Theory', 'Practical'
                faculty_name TEXT DEFAULT 'DR. RAMESH SHARMA',
                status TEXT CHECK(status IN ('Present', 'Absent', 'Leave', 'Field Duty', 'Not Marked')) NOT NULL DEFAULT 'Present',
                hours REAL NOT NULL DEFAULT 1.0,
                topic TEXT,
                remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date 
                ON student_attendance(student_id, date);
            CREATE INDEX IF NOT EXISTS idx_student_attendance_subject 
                ON student_attendance(subject);
            CREATE INDEX IF NOT EXISTS idx_student_attendance_status 
                ON student_attendance(status);

            -- =================================================================
            -- 2. Student Examinations & Results (Theory & Practical)
            -- =================================================================
            CREATE TABLE IF NOT EXISTS student_exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                exam_code TEXT NOT NULL,                -- e.g. 'PSM-2026-T1'
                exam_name TEXT NOT NULL,                -- e.g. 'Terminal Assessment I (Theory & OSPE)'
                exam_date TEXT NOT NULL,                -- ISO 'YYYY-MM-DD'
                term TEXT DEFAULT 'Term 1',             -- '1st Terminal', 'Mid-Term', '2nd Terminal', 'Preliminary'
                subject TEXT NOT NULL DEFAULT 'Community Medicine (PSM)',
                theory_obtained REAL NOT NULL DEFAULT 0,
                theory_max REAL NOT NULL DEFAULT 100,
                practical_obtained REAL NOT NULL DEFAULT 0,
                practical_max REAL NOT NULL DEFAULT 100,
                viva_obtained REAL DEFAULT 0,
                viva_max REAL DEFAULT 20,
                passing_percentage REAL DEFAULT 50.0,
                grade TEXT DEFAULT 'A',
                status TEXT CHECK(status IN ('Pass', 'Fail', 'Distinction', 'Absent')) DEFAULT 'Pass',
                faculty_remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_student_exams_student 
                ON student_exams(student_id, exam_date);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attendance_slot
                ON student_attendance(student_id, date, lecture_no);
        `);

        // Migration check for datewise columns
        const cols = db.prepare("PRAGMA table_info(student_attendance)").all();
        const colNames = cols.map(c => c.name);
        
        if (!colNames.includes('lecture_no')) {
            try { db.exec("ALTER TABLE student_attendance ADD COLUMN lecture_no INTEGER DEFAULT 1;"); } catch (_) {}
        }
        if (!colNames.includes('room_no')) {
            try { db.exec("ALTER TABLE student_attendance ADD COLUMN room_no TEXT DEFAULT '';"); } catch (_) {}
        }
        if (!colNames.includes('subject_code')) {
            try { db.exec("ALTER TABLE student_attendance ADD COLUMN subject_code TEXT DEFAULT '2010043342';"); } catch (_) {}
        }

        // Migration check for student_exams columns
        const examCols = db.prepare("PRAGMA table_info(student_exams)").all();
        const examColNames = examCols.map(c => c.name);

        if (!examColNames.includes('paper1_obtained')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN paper1_obtained REAL;"); } catch (_) {}
        }
        if (!examColNames.includes('paper1_max')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN paper1_max REAL DEFAULT 100;"); } catch (_) {}
        }
        if (!examColNames.includes('paper2_obtained')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN paper2_obtained REAL;"); } catch (_) {}
        }
        if (!examColNames.includes('paper2_max')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN paper2_max REAL DEFAULT 100;"); } catch (_) {}
        }
        if (!examColNames.includes('exam_type')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN exam_type TEXT DEFAULT 'IA-1';"); } catch (_) {}
        }
        if (!examColNames.includes('subject_code')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN subject_code TEXT DEFAULT '2010043342';"); } catch (_) {}
        }
        if (!examColNames.includes('total_obtained')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN total_obtained REAL;"); } catch (_) {}
        }
        if (!examColNames.includes('total_max')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN total_max REAL;"); } catch (_) {}
        }
        if (!examColNames.includes('academic_year')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN academic_year TEXT DEFAULT '3rd Year MBBS (2026)';"); } catch (_) {}
        }
        if (!examColNames.includes('year_level')) {
            try { db.exec("ALTER TABLE student_exams ADD COLUMN year_level INTEGER DEFAULT 3;"); } catch (_) {}
        }

        // Ensure 5-student clinical cohort exists for multi-student attendance and marksheet
        ensureClinicalCohort(db);

        // Check if we need to seed datewise data (or if upcoming days 29 & 30 are missing)
        const hasDatewise = db.prepare("SELECT COUNT(*) as count FROM student_attendance WHERE date = '2026-09-29' AND student_id = 1").get();
        if (!hasDatewise || hasDatewise.count === 0) {
            seedAcademicData(db);
        }

        // Check if exams need to be reseeded with all MBBS academic years (1st, 2nd, 3rd)
        const hasMultiYear = db.prepare("SELECT COUNT(*) as count FROM student_exams WHERE year_level = 1 AND student_id = 1").get();
        if (!hasMultiYear || hasMultiYear.count === 0) {
            seedExamsData(db);
        }
    }
};

/**
 * Ensure clinical batch cohort of 5 medical students exists for multi-cadet attendance and exam results
 */
function ensureClinicalCohort(db) {
    const students = [
        { roll: '235', name: 'Dhruv Patel', batch: '3rd Year MBBS', posting: 'Community Medicine Unit 3', email: 'dhruv.patel@medpulse.edu', phone: '+91 98765 43210' },
        { roll: '236', name: 'Dr. Ananya Sharma', batch: '3rd Year MBBS', posting: 'Community Medicine Unit 1', email: 'ananya.sharma@medpulse.edu', phone: '+91 98765 43211' },
        { roll: '237', name: 'Rohan Mehta', batch: '3rd Year MBBS', posting: 'Community Medicine Unit 2', email: 'rohan.mehta@medpulse.edu', phone: '+91 98765 43212' },
        { roll: '238', name: 'Priya Nair', batch: '3rd Year MBBS', posting: 'Community Medicine Unit 3', email: 'priya.nair@medpulse.edu', phone: '+91 98765 43213' },
        { roll: '239', name: 'Arjun Patel', batch: '3rd Year MBBS', posting: 'Community Medicine Unit 4', email: 'arjun.patel@medpulse.edu', phone: '+91 98765 43214' }
    ];

    const check = db.prepare("SELECT id FROM students WHERE roll_number = ?");
    const insert = db.prepare(`
        INSERT INTO students (roll_number, name, pin, batch_year, college_id, email, phone, posting_unit, status)
        VALUES (@roll, @name, '1234', @batch, 1, @email, @phone, @posting, 'Active')
    `);

    for (const s of students) {
        const existing = check.get(s.roll);
        if (!existing) {
            try {
                insert.run(s);
            } catch (_) {}
        }
    }
}

/**
 * Seed realistic datewise timetable & multi-subject attendance records
 */
function seedAcademicData(db) {
    console.log('🌱 Seeding realistic Datewise Timetable & Attendance data for Roll 235...');

    // Clear existing attendance records for clean datewise structure
    db.prepare('DELETE FROM student_attendance WHERE student_id = 1').run();

    const datewiseTimetable = [
        // --- 30/09/2026 (Wednesday) - Upcoming Timetable ---
        {
            date: '2026-09-30',
            lecture_no: 1,
            room_no: 'LT-2',
            time: '08:10 to 08:55',
            subject_code: '2010043425',
            subject: '2010043425 – OTO-RHINO-LARYNGOLOGY (ENT)',
            session_type: 'Theory',
            faculty: 'DR. ANAND DESAI',
            status: 'Not Marked',
            topic: 'Chronic Suppurative Otitis Media (CSOM) Classification'
        },
        {
            date: '2026-09-30',
            lecture_no: 2,
            room_no: 'LT-1',
            time: '08:55 to 09:40',
            subject_code: '2010043375',
            subject: '2010043375 – GENERAL SURGERY',
            session_type: 'Theory',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Not Marked',
            topic: 'Thyroid Swellings: Solitary Nodule Management'
        },
        {
            date: '2026-09-30',
            lecture_no: 3,
            room_no: 'OT Complex',
            time: '10:00 to 01:00',
            subject_code: '2010043375',
            subject: '2010043375 – SURGICAL THEATRE POSTING',
            session_type: 'Practical',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Not Marked',
            topic: 'Aseptic Techniques & Inguinal Hernioplasty'
        },

        // --- 29/09/2026 (Tuesday) - Upcoming Timetable ---
        {
            date: '2026-09-29',
            lecture_no: 1,
            room_no: 'LT-3',
            time: '08:10 to 08:55',
            subject_code: '2010043388',
            subject: '2010043388 – PAEDIATRICS',
            session_type: 'Theory',
            faculty: 'DR. HARISH DAVE',
            status: 'Not Marked',
            topic: 'Neonatal Resuscitation Protocol (NRP Guidelines)'
        },
        {
            date: '2026-09-29',
            lecture_no: 2,
            room_no: 'LT-1',
            time: '08:55 to 09:40',
            subject_code: '2010043394',
            subject: '2010043394 – OBSTETRICS & GYNAECOLOGY (OBGYN)',
            session_type: 'Theory',
            faculty: 'DR. MEENA PRAJAPATI',
            status: 'Not Marked',
            topic: 'Normal Labour: Mechanism & Partograph Interpretation'
        },
        {
            date: '2026-09-29',
            lecture_no: 3,
            room_no: 'Ward 2A',
            time: '10:00 to 12:30',
            subject_code: '2010043361',
            subject: '2010043361 – MEDICINE BEDSIDE CLINICS',
            session_type: 'Practical',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Not Marked',
            topic: 'Clinical Approach to Jaundice & Hepatomegaly'
        },
        {
            date: '2026-09-29',
            lecture_no: 4,
            room_no: 'LT-2',
            time: '01:30 to 02:30',
            subject_code: '2010043410',
            subject: '2010043410 – OPHTHALMOLOGY',
            session_type: 'Theory',
            faculty: 'DR. NEHA SHAH',
            status: 'Not Marked',
            topic: 'Primary Open Angle Glaucoma: Tonometry & Perimetry'
        },

        // --- 28/09/2026 (Today) - As shown in user screenshot (Not Marked) ---
        {
            date: '2026-09-28',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Theory',
            faculty: 'DRASHTI R SONI',
            status: 'Not Marked',
            topic: 'Biostatistics: Sample Size & Tests of Significance'
        },
        {
            date: '2026-09-28',
            lecture_no: 2,
            room_no: 'LT-2',
            time: '08:55 to 09:40',
            subject_code: '2010043361',
            subject: '2010043361 – GENERAL MEDICINE',
            session_type: 'Theory',
            faculty: 'SONU B SURATI',
            status: 'Not Marked',
            topic: 'Clinical Approach to Acute Coronary Syndromes'
        },
        {
            date: '2026-09-28',
            lecture_no: 3,
            room_no: 'Ward 4B',
            time: '10:00 to 12:00',
            subject_code: '2010043375',
            subject: '2010043375 – GENERAL SURGERY CLINICS',
            session_type: 'Practical',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Not Marked',
            topic: 'Bedside Clinical Signs of Acute Appendicitis'
        },

        // --- 26/09/2026 (Saturday) ---
        {
            date: '2026-09-26',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Theory',
            faculty: 'DR. RAMESH SHARMA',
            status: 'Present',
            topic: 'Epidemiology of Vector-Borne Diseases'
        },
        {
            date: '2026-09-26',
            lecture_no: 2,
            room_no: 'RHTC Field',
            time: '09:00 to 01:00',
            subject_code: '2010043342',
            subject: '2010043342 – RHTC RURAL FIELD POSTING',
            session_type: 'Practical',
            faculty: 'DR. SUNITA RAO',
            status: 'Field Duty',
            topic: 'Village Household Survey & Water Chlorination Inspection'
        },

        // --- 25/09/2026 (Friday) ---
        {
            date: '2026-09-25',
            lecture_no: 1,
            room_no: 'LT-2',
            time: '08:10 to 08:55',
            subject_code: '2010043361',
            subject: '2010043361 – GENERAL MEDICINE',
            session_type: 'Theory',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Present',
            topic: 'Type 2 Diabetes Mellitus with Nephropathy Management'
        },
        {
            date: '2026-09-25',
            lecture_no: 2,
            room_no: 'LT-3',
            time: '08:55 to 09:40',
            subject_code: '2010043375',
            subject: '2010043375 – GENERAL SURGERY',
            session_type: 'Theory',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Present',
            topic: 'Acute Appendicitis: Signs & Alvarado Score'
        },
        {
            date: '2026-09-25',
            lecture_no: 3,
            room_no: 'Ward 2A',
            time: '10:00 to 12:30',
            subject_code: '2010043361',
            subject: '2010043361 – MEDICINE BEDSIDE CLINICS',
            session_type: 'Practical',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Present',
            topic: 'Cardiovascular Examination: Murmurs & JVP'
        },

        // --- 24/09/2026 (Thursday) ---
        {
            date: '2026-09-24',
            lecture_no: 1,
            room_no: 'PSM Lab',
            time: '08:10 to 10:30',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Practical',
            faculty: 'DR. RAMESH SHARMA',
            status: 'Present',
            topic: 'Entomological Indices & Larval Identification'
        },
        {
            date: '2026-09-24',
            lecture_no: 2,
            room_no: 'LT-1',
            time: '11:00 to 12:00',
            subject_code: '2010043388',
            subject: '2010043388 – PAEDIATRICS',
            session_type: 'Theory',
            faculty: 'DR. HARISH DAVE',
            status: 'Present',
            topic: 'Protein Energy Malnutrition (PEM): Marasmus vs Kwashiorkor'
        },

        // --- 23/09/2026 (Wednesday) ---
        {
            date: '2026-09-23',
            lecture_no: 1,
            room_no: 'Ward 3',
            time: '08:30 to 11:30',
            subject_code: '2010043394',
            subject: '2010043394 – OBSTETRICS & GYNAECOLOGY (OBGYN)',
            session_type: 'Practical',
            faculty: 'DR. MEENA PRAJAPATI',
            status: 'Present',
            topic: 'Antenatal Ward: Pre-eclampsia Assessment & FHR Monitoring'
        },
        {
            date: '2026-09-23',
            lecture_no: 2,
            room_no: 'LT-2',
            time: '12:00 to 01:00',
            subject_code: '2010043410',
            subject: '2010043410 – OPHTHALMOLOGY',
            session_type: 'Theory',
            faculty: 'DR. NEHA SHAH',
            status: 'Present',
            topic: 'Senile Cataract Classification & Phacoemulsification'
        },

        // --- 22/09/2026 (Tuesday) ---
        {
            date: '2026-09-22',
            lecture_no: 1,
            room_no: 'RHTC Booth',
            time: '09:00 to 01:00',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Practical',
            faculty: 'DR. SUNITA RAO',
            status: 'Field Duty',
            topic: 'Maternal & Child Immunization Session Tracking'
        },
        {
            date: '2026-09-22',
            lecture_no: 2,
            room_no: 'LT-3',
            time: '02:00 to 03:30',
            subject_code: '2010043425',
            subject: '2010043425 – OTORHINOLARYNGOLOGY (ENT)',
            session_type: 'Theory',
            faculty: 'DR. BHAVIN PATEL',
            status: 'Present',
            topic: 'Chronic Suppurative Otitis Media (CSOM) Staging'
        },

        // --- 21/09/2026 (Monday) ---
        {
            date: '2026-09-21',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043361',
            subject: '2010043361 – GENERAL MEDICINE',
            session_type: 'Theory',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Present',
            topic: 'Hypertension Management Guidelines & JNC-8 Pharmacotherapy'
        },
        {
            date: '2026-09-21',
            lecture_no: 2,
            room_no: 'LT-2',
            time: '08:55 to 09:40',
            subject_code: '2010043375',
            subject: '2010043375 – GENERAL SURGERY',
            session_type: 'Theory',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Present',
            topic: 'Inguinal Hernia: Direct vs Indirect Anatomy & Mesh Repair'
        },

        // --- 19/09/2026 (Saturday) ---
        {
            date: '2026-09-19',
            lecture_no: 1,
            room_no: 'Seminar Hall',
            time: '09:00 to 12:00',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Practical',
            faculty: 'DR. ANANYA JOSHI',
            status: 'Present',
            topic: 'Family Health Study Presentation - Multi-Generation Hypertensive Case'
        },

        // --- 18/09/2026 (Friday) ---
        {
            date: '2026-09-18',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Theory',
            faculty: 'DR. SUNITA RAO',
            status: 'Present',
            topic: 'Biostatistics: Chi-Square Test & Tests of Significance'
        },
        {
            date: '2026-09-18',
            lecture_no: 2,
            room_no: 'Ward 2B',
            time: '09:00 to 11:30',
            subject_code: '2010043361',
            subject: '2010043361 – GENERAL MEDICINE',
            session_type: 'Practical',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Present',
            topic: 'Respiratory Examination: Consolidation vs Effusion'
        },

        // --- 15/09/2026 (Tuesday) ---
        {
            date: '2026-09-15',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043375',
            subject: '2010043375 – GENERAL SURGERY',
            session_type: 'Theory',
            faculty: 'DR. RAJESH SOLANKI',
            status: 'Present',
            topic: 'Shock: Hypovolemic vs Septic Resuscitation'
        },
        {
            date: '2026-09-15',
            lecture_no: 2,
            room_no: 'Eye OPD',
            time: '09:00 to 11:00',
            subject_code: '2010043410',
            subject: '2010043410 – OPHTHALMOLOGY',
            session_type: 'Practical',
            faculty: 'DR. NEHA SHAH',
            status: 'Present',
            topic: 'Visual Acuity Testing: Snellen Chart & Direct Ophthalmoscopy'
        },

        // --- 08/09/2026 (Tuesday - Absent record) ---
        {
            date: '2026-09-08',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Theory',
            faculty: 'DR. RAMESH SHARMA',
            status: 'Absent',
            topic: 'Demographic Trends & National Population Policy Goals'
        },
        {
            date: '2026-09-08',
            lecture_no: 2,
            room_no: 'LT-2',
            time: '09:00 to 10:00',
            subject_code: '2010043394',
            subject: '2010043394 – OBSTETRICS & GYNAECOLOGY (OBGYN)',
            session_type: 'Theory',
            faculty: 'DR. MEENA PRAJAPATI',
            status: 'Present',
            topic: 'Antepartum Haemorrhage: Placenta Praevia vs Abruption'
        },

        // --- 18/08/2026 (Tuesday - Leave record) ---
        {
            date: '2026-08-18',
            lecture_no: 1,
            room_no: 'LT-1',
            time: '08:10 to 08:55',
            subject_code: '2010043342',
            subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
            session_type: 'Theory',
            faculty: 'DR. ANANYA JOSHI',
            status: 'Leave',
            topic: 'Nutrition Programs: POSHAN Abhiyaan & IFA Supplementation'
        },
        {
            date: '2026-08-18',
            lecture_no: 2,
            room_no: 'LT-2',
            time: '09:00 to 10:00',
            subject_code: '2010043361',
            subject: '2010043361 – GENERAL MEDICINE',
            session_type: 'Theory',
            faculty: 'DR. VIKRAM MEHTA',
            status: 'Leave',
            topic: 'Gastroenterology: Acute Viral Hepatitis Staging'
        }
    ];

    const insertStmt = db.prepare(`
        INSERT INTO student_attendance (student_id, date, lecture_no, room_no, time_slot, subject_code, subject, session_type, faculty_name, status, hours, topic)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of datewiseTimetable) {
        insertStmt.run(
            1,
            item.date,
            item.lecture_no || 1,
            item.room_no || '',
            item.time || '08:10 to 08:55',
            item.subject_code || '2010043342',
            item.subject,
            item.session_type || 'Theory',
            item.faculty || 'DR. RAMESH SHARMA',
            item.status || 'Present',
            item.session_type === 'Practical' ? 2.5 : 1.0,
            item.topic || ''
        );
    }

    // Reseed exams if needed
    seedExamsData(db);

    console.log(`✅ Seeded ${datewiseTimetable.length} Datewise timetable attendance records successfully.`);
}

/**
 * Seed comprehensive exam records for MBBS Phase I, Phase II, and Phase III
 * strictly adhering to the user-specified examination structure:
 * - Internal Assessment-1: Theory 100 + Practical 100 = Total 200
 * - Internal Assessment-2: Theory 100 + Practical 100 = Total 200
 * - Pre-lims: Paper 1 (100) + Paper 2 (100) + Practical (100) = Total 300
 * - University: Paper 1 (100) + Paper 2 (100) + Practical (100) = Total 300
 */
function seedExamsData(db) {
    console.log('🌱 Seeding multi-year MBBS Examination records (1st Year, 2nd Year, 3rd Year)...');

    db.prepare('DELETE FROM student_exams WHERE student_id = 1').run();

    const examsList = [
        // =====================================================================
        // === 3RD YEAR MBBS (2026) - Current Year (Phase III Part 1) ===
        // =====================================================================

        // --- 1. Community Medicine (PSM) (2010043342) ---
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'PSM-2026-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2026-03-24',
            subject_code: '2010043342',
            subject: 'Community Medicine (PSM)',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 74.0, theory_max: 100.0,
            practical_obtained: 78.0, practical_max: 100.0,
            viva_obtained: 16.0, viva_max: 20.0,
            total_obtained: 152.0, total_max: 200.0,
            grade: 'A+', status: 'Pass',
            faculty_remarks: 'Solid grasp of Epidemiology & General Demography. Good viva on maternal nutrition and cold chain.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'PSM-2026-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2026-06-19',
            subject_code: '2010043342',
            subject: 'Community Medicine (PSM)',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 78.5, theory_max: 100.0,
            practical_obtained: 82.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 160.5, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Excellent field health report analysis, sampling methods, and biostatistical test interpretation. Spotters accurate.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'PSM-2026-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2026-08-25',
            subject_code: '2010043342',
            subject: 'Community Medicine (PSM)',
            paper1_obtained: 81.0, paper1_max: 100.0,
            paper2_obtained: 77.0, paper2_max: 100.0,
            theory_obtained: 158.0, theory_max: 200.0,
            practical_obtained: 85.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 243.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Eligible for University Exam with First Class Distinction standing. Outstanding family health study presentation.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'PSM-2026-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2026-09-20',
            subject_code: '2010043342',
            subject: 'Community Medicine (PSM)',
            paper1_obtained: 83.0, paper1_max: 100.0,
            paper2_obtained: 81.0, paper2_max: 100.0,
            theory_obtained: 164.0, theory_max: 200.0,
            practical_obtained: 87.0, practical_max: 100.0,
            viva_obtained: 18.5, viva_max: 20.0,
            total_obtained: 251.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Certified University Pass with Honors. Separate theory ≥50% & practical ≥50% university standards satisfied.'
        },

        // --- 2. Ophthalmology (Eye) (2010043410) ---
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'EYE-2026-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2026-03-26',
            subject_code: '2010043410',
            subject: 'Ophthalmology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 72.0, theory_max: 100.0,
            practical_obtained: 75.0, practical_max: 100.0,
            viva_obtained: 15.0, viva_max: 20.0,
            total_obtained: 147.0, total_max: 200.0,
            grade: 'A', status: 'Pass',
            faculty_remarks: 'Good slit-lamp and direct ophthalmoscopy skills. Review optics and refraction principles.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'EYE-2026-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2026-06-21',
            subject_code: '2010043410',
            subject: 'Ophthalmology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 76.0, theory_max: 100.0,
            practical_obtained: 80.0, practical_max: 100.0,
            viva_obtained: 16.5, viva_max: 20.0,
            total_obtained: 156.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Accurate clinical presentation of senile immature cataract and primary open angle glaucoma.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'EYE-2026-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2026-08-27',
            subject_code: '2010043410',
            subject: 'Ophthalmology',
            paper1_obtained: 79.0, paper1_max: 100.0,
            paper2_obtained: 78.0, paper2_max: 100.0,
            theory_obtained: 157.0, theory_max: 200.0,
            practical_obtained: 82.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 239.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Very sound diagnostic approach to diabetic retinopathy staging and fundus examination.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'EYE-2026-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2026-09-22',
            subject_code: '2010043410',
            subject: 'Ophthalmology',
            paper1_obtained: 82.0, paper1_max: 100.0,
            paper2_obtained: 80.0, paper2_max: 100.0,
            theory_obtained: 162.0, theory_max: 200.0,
            practical_obtained: 84.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 246.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Passed University Examination with First Class Distinction. High proficiency in surgical instruments viva.'
        },

        // --- 3. Otorhinolaryngology (ENT) (2010043425) ---
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'ENT-2026-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2026-03-28',
            subject_code: '2010043425',
            subject: 'Otorhinolaryngology (ENT)',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 70.0, theory_max: 100.0,
            practical_obtained: 74.0, practical_max: 100.0,
            viva_obtained: 14.5, viva_max: 20.0,
            total_obtained: 144.0, total_max: 200.0,
            grade: 'A', status: 'Pass',
            faculty_remarks: 'Tuning fork tests performed proficiently. Read more on acoustic neuroma audiometry.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'ENT-2026-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2026-06-23',
            subject_code: '2010043425',
            subject: 'Otorhinolaryngology (ENT)',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 75.0, theory_max: 100.0,
            practical_obtained: 78.0, practical_max: 100.0,
            viva_obtained: 16.0, viva_max: 20.0,
            total_obtained: 153.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Clear explanation of cortical mastoidectomy steps and tracheostomy indications.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'ENT-2026-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2026-08-29',
            subject_code: '2010043425',
            subject: 'Otorhinolaryngology (ENT)',
            paper1_obtained: 77.0, paper1_max: 100.0,
            paper2_obtained: 76.0, paper2_max: 100.0,
            theory_obtained: 153.0, theory_max: 200.0,
            practical_obtained: 80.0, practical_max: 100.0,
            viva_obtained: 16.5, viva_max: 20.0,
            total_obtained: 233.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Demonstrated thorough understanding of stridor evaluation and epistaxis packing.'
        },
        {
            academic_year: '3rd Year MBBS (2026)',
            year_level: 3,
            exam_code: 'ENT-2026-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2026-09-24',
            subject_code: '2010043425',
            subject: 'Otorhinolaryngology (ENT)',
            paper1_obtained: 80.0, paper1_max: 100.0,
            paper2_obtained: 79.0, paper2_max: 100.0,
            theory_obtained: 159.0, theory_max: 200.0,
            practical_obtained: 83.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 242.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'University Examination passed with Distinction standard. Commendable clinical case presentation.'
        },

        // =====================================================================
        // === 2ND YEAR MBBS (2025) - Phase II ===
        // =====================================================================

        // --- 1. Pathology (2010042210) ---
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PATH-2025-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2025-03-22',
            subject_code: '2010042210',
            subject: 'Pathology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 76.0, theory_max: 100.0,
            practical_obtained: 80.0, practical_max: 100.0,
            viva_obtained: 16.0, viva_max: 20.0,
            total_obtained: 156.0, total_max: 200.0,
            grade: 'A+', status: 'Pass',
            faculty_remarks: 'Excellent identification of gross pathology specimens and histopathology slide reporting.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PATH-2025-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2025-06-18',
            subject_code: '2010042210',
            subject: 'Pathology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 81.0, theory_max: 100.0,
            practical_obtained: 83.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 164.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Flawless interpretation of hematology peripheral blood smear and coagulation profile.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PATH-2025-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2025-08-20',
            subject_code: '2010042210',
            subject: 'Pathology',
            paper1_obtained: 82.0, paper1_max: 100.0,
            paper2_obtained: 80.0, paper2_max: 100.0,
            theory_obtained: 162.0, theory_max: 200.0,
            practical_obtained: 85.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 247.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Distinction standard in general neoplasia genetics and systemic cardiovascular pathology.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PATH-2025-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2025-09-18',
            subject_code: '2010042210',
            subject: 'Pathology',
            paper1_obtained: 84.0, paper1_max: 100.0,
            paper2_obtained: 83.0, paper2_max: 100.0,
            theory_obtained: 167.0, theory_max: 200.0,
            practical_obtained: 88.0, practical_max: 100.0,
            viva_obtained: 18.5, viva_max: 20.0,
            total_obtained: 255.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'University Distinction honors achieved. Outstanding practical examination demonstration.'
        },

        // --- 2. Pharmacology (2010042220) ---
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PHARM-2025-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2025-03-24',
            subject_code: '2010042220',
            subject: 'Pharmacology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 73.0, theory_max: 100.0,
            practical_obtained: 77.0, practical_max: 100.0,
            viva_obtained: 15.5, viva_max: 20.0,
            total_obtained: 150.0, total_max: 200.0,
            grade: 'A', status: 'Pass',
            faculty_remarks: 'Good grasp of autonomic nervous system pharmacology and pharmacokinetics.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PHARM-2025-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2025-06-20',
            subject_code: '2010042220',
            subject: 'Pharmacology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 77.5, theory_max: 100.0,
            practical_obtained: 81.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 158.5, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Accurate clinical prescription audit and rational antimicrobial chemotherapy principles.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PHARM-2025-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2025-08-22',
            subject_code: '2010042220',
            subject: 'Pharmacology',
            paper1_obtained: 80.0, paper1_max: 100.0,
            paper2_obtained: 78.0, paper2_max: 100.0,
            theory_obtained: 158.0, theory_max: 200.0,
            practical_obtained: 82.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 240.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Sound pharmacovigilance concepts and clinical adverse drug reaction reporting.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'PHARM-2025-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2025-09-20',
            subject_code: '2010042220',
            subject: 'Pharmacology',
            paper1_obtained: 82.0, paper1_max: 100.0,
            paper2_obtained: 81.0, paper2_max: 100.0,
            theory_obtained: 163.0, theory_max: 200.0,
            practical_obtained: 85.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 248.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Certified University Distinction. Excellent OSPE experimental pharmacology skills.'
        },

        // --- 3. Microbiology (2010042230) ---
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'MICRO-2025-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2025-03-26',
            subject_code: '2010042230',
            subject: 'Microbiology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 75.0, theory_max: 100.0,
            practical_obtained: 78.0, practical_max: 100.0,
            viva_obtained: 16.0, viva_max: 20.0,
            total_obtained: 153.0, total_max: 200.0,
            grade: 'A+', status: 'Pass',
            faculty_remarks: 'Proficient Gram staining and bacterial culture colony morphology identification.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'MICRO-2025-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2025-06-22',
            subject_code: '2010042230',
            subject: 'Microbiology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 79.0, theory_max: 100.0,
            practical_obtained: 82.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 161.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Accurate stool wet mount parasitology examination and viral serology test interpretation.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'MICRO-2025-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2025-08-24',
            subject_code: '2010042230',
            subject: 'Microbiology',
            paper1_obtained: 81.0, paper1_max: 100.0,
            paper2_obtained: 79.0, paper2_max: 100.0,
            theory_obtained: 160.0, theory_max: 200.0,
            practical_obtained: 84.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 244.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Outstanding hospital infection control and biomedical waste segregation knowledge.'
        },
        {
            academic_year: '2nd Year MBBS (2025)',
            year_level: 2,
            exam_code: 'MICRO-2025-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2025-09-22',
            subject_code: '2010042230',
            subject: 'Microbiology',
            paper1_obtained: 83.0, paper1_max: 100.0,
            paper2_obtained: 82.0, paper2_max: 100.0,
            theory_obtained: 165.0, theory_max: 200.0,
            practical_obtained: 86.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 251.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'University Distinction. Precise antibiotic susceptibility Kirby-Bauer zone reporting.'
        },

        // =====================================================================
        // === 1ST YEAR MBBS (2024) - Phase I ===
        // =====================================================================

        // --- 1. Human Anatomy (2010041110) ---
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'ANAT-2024-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2024-03-20',
            subject_code: '2010041110',
            subject: 'Human Anatomy',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 72.0, theory_max: 100.0,
            practical_obtained: 76.0, practical_max: 100.0,
            viva_obtained: 15.0, viva_max: 20.0,
            total_obtained: 148.0, total_max: 200.0,
            grade: 'A', status: 'Pass',
            faculty_remarks: 'Good cadaveric dissection technique in upper limb and thorax anatomy.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'ANAT-2024-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2024-06-15',
            subject_code: '2010041110',
            subject: 'Human Anatomy',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 77.0, theory_max: 100.0,
            practical_obtained: 80.0, practical_max: 100.0,
            viva_obtained: 16.5, viva_max: 20.0,
            total_obtained: 157.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Accurate neuroanatomy cross-section tracking and embryological basis of malformations.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'ANAT-2024-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2024-08-18',
            subject_code: '2010041110',
            subject: 'Human Anatomy',
            paper1_obtained: 79.0, paper1_max: 100.0,
            paper2_obtained: 78.0, paper2_max: 100.0,
            theory_obtained: 157.0, theory_max: 200.0,
            practical_obtained: 83.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 240.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Strong spotters performance on osteology and radiology imaging.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'ANAT-2024-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2024-09-15',
            subject_code: '2010041110',
            subject: 'Human Anatomy',
            paper1_obtained: 81.0, paper1_max: 100.0,
            paper2_obtained: 80.0, paper2_max: 100.0,
            theory_obtained: 161.0, theory_max: 200.0,
            practical_obtained: 85.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 246.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: '1st Professional University Distinction. Excellent soft part viva presentation.'
        },

        // --- 2. Physiology (2010041120) ---
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'PHYS-2024-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2024-03-22',
            subject_code: '2010041120',
            subject: 'Physiology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 74.0, theory_max: 100.0,
            practical_obtained: 78.0, practical_max: 100.0,
            viva_obtained: 16.0, viva_max: 20.0,
            total_obtained: 152.0, total_max: 200.0,
            grade: 'A+', status: 'Pass',
            faculty_remarks: 'Hematology experiments and RBC/WBC counting chamber pipetting performed accurately.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'PHYS-2024-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2024-06-17',
            subject_code: '2010041120',
            subject: 'Physiology',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 79.0, theory_max: 100.0,
            practical_obtained: 82.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 161.0, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Clear physiological reasoning on cardiac cycle pressure curves and spirometry tracing.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'PHYS-2024-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2024-08-20',
            subject_code: '2010041120',
            subject: 'Physiology',
            paper1_obtained: 81.0, paper1_max: 100.0,
            paper2_obtained: 80.0, paper2_max: 100.0,
            theory_obtained: 161.0, theory_max: 200.0,
            practical_obtained: 84.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 245.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Excellent command of endocrine feedback mechanisms and renal countercurrent system.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'PHYS-2024-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2024-09-17',
            subject_code: '2010041120',
            subject: 'Physiology',
            paper1_obtained: 83.0, paper1_max: 100.0,
            paper2_obtained: 82.0, paper2_max: 100.0,
            theory_obtained: 165.0, theory_max: 200.0,
            practical_obtained: 86.0, practical_max: 100.0,
            viva_obtained: 18.0, viva_max: 20.0,
            total_obtained: 251.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Passed University Examination with Distinction standing in human physiology.'
        },

        // --- 3. Biochemistry (2010041130) ---
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'BIO-2024-IA1',
            exam_name: 'Internal Assessment - 1 (Theory & Practical)',
            exam_type: 'IA-1',
            term: 'Internal Assessment 1',
            exam_date: '2024-03-24',
            subject_code: '2010041130',
            subject: 'Biochemistry',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 71.0, theory_max: 100.0,
            practical_obtained: 75.0, practical_max: 100.0,
            viva_obtained: 15.0, viva_max: 20.0,
            total_obtained: 146.0, total_max: 200.0,
            grade: 'A', status: 'Pass',
            faculty_remarks: 'Accurate qualitative urine screening and carbohydrate biochemical reactions.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'BIO-2024-IA2',
            exam_name: 'Internal Assessment - 2 (Theory & Practical)',
            exam_type: 'IA-2',
            term: 'Internal Assessment 2',
            exam_date: '2024-06-19',
            subject_code: '2010041130',
            subject: 'Biochemistry',
            paper1_obtained: null, paper1_max: 100, paper2_obtained: null, paper2_max: 100,
            theory_obtained: 76.5, theory_max: 100.0,
            practical_obtained: 79.0, practical_max: 100.0,
            viva_obtained: 16.5, viva_max: 20.0,
            total_obtained: 155.5, total_max: 200.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Quantitative serum creatinine estimation and liver enzyme profiles performed neatly.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'BIO-2024-PRELIM',
            exam_name: 'Preliminary Examination (Pre-lims)',
            exam_type: 'Preliminary',
            term: 'Pre-lims',
            exam_date: '2024-08-22',
            subject_code: '2010041130',
            subject: 'Biochemistry',
            paper1_obtained: 78.0, paper1_max: 100.0,
            paper2_obtained: 77.0, paper2_max: 100.0,
            theory_obtained: 155.0, theory_max: 200.0,
            practical_obtained: 81.0, practical_max: 100.0,
            viva_obtained: 17.0, viva_max: 20.0,
            total_obtained: 236.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Strong understanding of inborn errors of metabolism and molecular genetics.'
        },
        {
            academic_year: '1st Year MBBS (2024)',
            year_level: 1,
            exam_code: 'BIO-2024-UNIV',
            exam_name: 'University Professional Examination',
            exam_type: 'University',
            term: 'University Exam',
            exam_date: '2024-09-19',
            subject_code: '2010041130',
            subject: 'Biochemistry',
            paper1_obtained: 80.0, paper1_max: 100.0,
            paper2_obtained: 79.0, paper2_max: 100.0,
            theory_obtained: 159.0, theory_max: 200.0,
            practical_obtained: 83.0, practical_max: 100.0,
            viva_obtained: 17.5, viva_max: 20.0,
            total_obtained: 242.0, total_max: 300.0,
            grade: 'Distinction', status: 'Distinction',
            faculty_remarks: 'Passed University Examination with First Class Distinction in medical biochemistry.'
        }
    ];

    const insertExam = db.prepare(`
        INSERT INTO student_exams (
            student_id, academic_year, year_level, exam_code, exam_name, exam_type, exam_date, term, subject_code, subject,
            paper1_obtained, paper1_max, paper2_obtained, paper2_max,
            theory_obtained, theory_max, practical_obtained, practical_max,
            viva_obtained, viva_max, total_obtained, total_max,
            grade, status, faculty_remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ex of examsList) {
        insertExam.run(
            1,
            ex.academic_year,
            ex.year_level,
            ex.exam_code,
            ex.exam_name,
            ex.exam_type,
            ex.exam_date,
            ex.term,
            ex.subject_code,
            ex.subject,
            ex.paper1_obtained,
            ex.paper1_max,
            ex.paper2_obtained,
            ex.paper2_max,
            ex.theory_obtained,
            ex.theory_max,
            ex.practical_obtained,
            ex.practical_max,
            ex.viva_obtained,
            ex.viva_max,
            ex.total_obtained,
            ex.total_max,
            ex.grade,
            ex.status,
            ex.faculty_remarks
        );
    }

    console.log(`✅ Seeded ${examsList.length} Multi-Year MBBS Examination records successfully.`);
}
