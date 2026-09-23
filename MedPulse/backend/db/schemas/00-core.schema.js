/**
 * SHARED: colleges, students, admins, survey tables. Change only with both teams agreeing.
 * Loaded automatically by backend/config/db.js (files run in filename order).
 */
module.exports = {
    name: 'core',
    apply(db) {
        // Migration checks for existing databases
        const studentCols = db.prepare("PRAGMA table_info(students)").all();
        const hasReferralCode = studentCols.some(c => c.name === 'referral_code');
        if (!hasReferralCode && studentCols.length > 0) {
            try {
                db.exec("ALTER TABLE students ADD COLUMN referral_code TEXT;");
                db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_referral ON students(referral_code);");
            } catch (e) {
                // Ignore if already added concurrently
            }
        }
        db.exec(`
            -- Medical Colleges (Multi-College Architecture)
            CREATE TABLE IF NOT EXISTS colleges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                city TEXT,
                state TEXT DEFAULT 'Gujarat',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Students / Cadre
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                roll_number TEXT UNIQUE NOT NULL,
                pin TEXT NOT NULL DEFAULT '1234',
                batch_year TEXT DEFAULT '3rd Year MBBS',
                posting_unit TEXT DEFAULT 'RHTC',
                email TEXT,
                phone TEXT,
                referral_code TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- University Administrators (Multi-University Hierarchy)
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                pin TEXT NOT NULL DEFAULT '9999',
                role TEXT CHECK(role IN ('Super Admin', 'Admin', 'University Super Admin', 'University Admin')) DEFAULT 'Admin',
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Families
            CREATE TABLE IF NOT EXISTS families (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                family_number TEXT NOT NULL,
                head_of_family TEXT NOT NULL,
                address TEXT,
                locality TEXT,
                area_type TEXT DEFAULT 'Rural',
                religion TEXT,
                caste_category TEXT,
                total_family_income REAL,
                socioeconomic_class TEXT,
                ration_card_type TEXT,
                housing_type TEXT,
                overcrowding INTEGER DEFAULT 0,
                water_source TEXT,
                toilet_facility TEXT,
                waste_disposal TEXT,
                fuel_used TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Family Members
            CREATE TABLE IF NOT EXISTS family_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                relationship TEXT,
                age INTEGER,
                gender TEXT,
                marital_status TEXT,
                education TEXT,
                occupation TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Health Conditions
            CREATE TABLE IF NOT EXISTS health_conditions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                condition_name TEXT NOT NULL,
                diagnosed_date TEXT,
                status TEXT DEFAULT 'Active',
                notes TEXT
            );

            -- Medications
            CREATE TABLE IF NOT EXISTS medications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                medicine_name TEXT NOT NULL,
                dosage TEXT,
                frequency TEXT,
                adherence TEXT DEFAULT 'Good'
            );

            -- Allergies
            CREATE TABLE IF NOT EXISTS allergies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                allergen TEXT NOT NULL,
                severity TEXT DEFAULT 'Mild',
                reaction TEXT
            );

            -- Patient Clinical History
            CREATE TABLE IF NOT EXISTS clinical_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_date TEXT,
                description TEXT
            );

            -- Lifestyle / Vitals
            CREATE TABLE IF NOT EXISTS lifestyle_habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER UNIQUE NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                smoking_status TEXT,
                alcohol_status TEXT,
                dietary_pattern TEXT,
                physical_activity TEXT,
                systolic_bp INTEGER,
                diastolic_bp INTEGER,
                blood_sugar_fasting REAL,
                blood_sugar_random REAL,
                bmi REAL
            );

            -- Longitudinal Follow-up Visits
            CREATE TABLE IF NOT EXISTS follow_up_visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                visit_date TEXT NOT NULL,
                purpose TEXT,
                vitals_summary TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

        `);

    }
};
