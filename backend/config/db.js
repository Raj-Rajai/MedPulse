const path = require('node:path');
const fs = require('node:fs');

let DatabaseSync;
try {
    ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
    if (err && err.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && err.code !== 'MODULE_NOT_FOUND') {
        throw err;
    }
    DatabaseSync = require('better-sqlite3');
}

const dbDir = path.join(__dirname, '..', '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'health_survey.db');
const db = new DatabaseSync(dbPath);

// Enable foreign key constraints
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize database schema and optional initial seed data
 */
function initDatabase() {
    try {
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

            -- Patients Dual-Model
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_uid TEXT UNIQUE NOT NULL,
                student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                pin TEXT NOT NULL DEFAULT '1234',
                age_years INTEGER,
                gender TEXT,
                model_type TEXT CHECK(model_type IN ('Independent', 'Dependent')) DEFAULT 'Independent',
                referral_code_used TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Hospitals (Independent Medium)
            CREATE TABLE IF NOT EXISTS hospitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                type TEXT DEFAULT 'Government Civil Hospital',
                city TEXT NOT NULL,
                district TEXT,
                state TEXT DEFAULT 'Gujarat',
                bed_capacity INTEGER DEFAULT 500,
                contact_email TEXT,
                contact_phone TEXT,
                max_super_admins INTEGER DEFAULT 3,
                max_admins INTEGER DEFAULT 20,
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Hospital Administrators & Medical Surveillance Staff
            CREATE TABLE IF NOT EXISTS hospital_admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                pin TEXT NOT NULL DEFAULT '8888',
                role TEXT CHECK(role IN ('Hospital Super Admin', 'Hospital Admin')) DEFAULT 'Hospital Admin',
                department TEXT DEFAULT 'General Medicine',
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_hosp_code ON hospitals(code);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_hosp ON hospital_admins(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_user ON hospital_admins(username);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_role ON hospital_admins(role);

            -- Hospital Patient Registration & Clinical Visits Subsystem
            CREATE TABLE IF NOT EXISTS hospital_visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
                patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
                family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                visit_uid TEXT UNIQUE NOT NULL,
                patient_name TEXT NOT NULL,
                age_years INTEGER,
                gender TEXT,
                contact_number TEXT,
                address TEXT,
                village TEXT,
                family_code TEXT,
                student_name TEXT,
                student_roll TEXT,
                visit_date DATE DEFAULT (date('now')),
                department TEXT NOT NULL DEFAULT 'General Medicine',
                attending_doctor TEXT DEFAULT 'Dr. Ramesh Patel',
                visit_type TEXT DEFAULT 'FAP Survey Referral',
                chief_complaint TEXT,
                symptoms_duration TEXT,
                sbp INTEGER,
                dbp INTEGER,
                pulse INTEGER,
                temperature REAL,
                rbs REAL,
                existing_conditions TEXT,
                allergies TEXT,
                diagnosis TEXT,
                treatment_prescribed TEXT,
                disposition TEXT DEFAULT 'Discharged OPD',
                ward_bed_no TEXT,
                follow_up_advice TEXT,
                registered_by_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_hosp_visits_hosp ON hospital_visits(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_date ON hospital_visits(visit_date);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_member ON hospital_visits(family_member_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_uid ON hospital_visits(visit_uid);
        `);

        // Seed default hospital
        db.prepare(`
            INSERT OR IGNORE INTO hospitals (id, name, code, type, city, district, state, bed_capacity, contact_email, contact_phone, max_super_admins, max_admins, status)
            VALUES (1, 'GMERS Civil Hospital & Research Institute', 'HOSP-GMERS-01', 'Government Civil Hospital', 'Gandhinagar', 'Gandhinagar', 'Gujarat', 750, 'civil.hospital@gmers.edu', '079-23221234', 3, 20, 'Active')
        `).run();

        // Seed default Hospital Super Admin
        db.prepare(`
            INSERT OR IGNORE INTO hospital_admins (id, hospital_id, username, name, email, phone, pin, role, department, status)
            VALUES (1, 1, 'hosp_superadmin', 'Dr. Ramesh Patel (Medical Superintendent)', 'ms.civil@gmers.edu', '9876500001', '8888', 'Hospital Super Admin', 'Hospital Administration & Clinical Oversight', 'Active')
        `).run();

        // Auto-seed survey data (Roll 235) if families table is empty
        const familyCountRow = db.prepare('SELECT COUNT(*) as count FROM families').get();
        if (!familyCountRow || familyCountRow.count === 0) {
            console.log('🌱 No survey records found in database. Auto-seeding Roll 235 survey data...');
            try {
                const { seedRoll235 } = require('./seed-roll235');
                seedRoll235(db);
            } catch (seedErr) {
                console.error('⚠️ Could not auto-seed Roll 235 data:', seedErr.message);
            }
        }

        console.log('✅ SQLite Database ready at:', dbPath);
    } catch (err) {
        console.error('❌ Error initializing database:', err);
        throw err;
    }
}

module.exports = {
    db,
    initDatabase
};
