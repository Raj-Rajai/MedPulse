/**
 * HMS-owned: hospitals, hospital staff, hospital visits (+ default seeds).
 * Loaded automatically by backend/config/db.js (files run in filename order).
 */
module.exports = {
    name: 'hms',
    apply(db) {

        db.exec(`
            -- Hospitals (Independent Medium)
            CREATE TABLE IF NOT EXISTS hospitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                type TEXT DEFAULT 'Private Multi-Specialty Hospital',
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

            -- Hospital Patient Visits & Registrations (OPD/IPD Intake)
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

            CREATE INDEX IF NOT EXISTS idx_hosp_code ON hospitals(code);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_hosp ON hospital_admins(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_user ON hospital_admins(username);
            CREATE INDEX IF NOT EXISTS idx_hosp_admins_role ON hospital_admins(role);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_hosp ON hospital_visits(hospital_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_date ON hospital_visits(visit_date);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_member ON hospital_visits(family_member_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_visits_uid ON hospital_visits(visit_uid);
        `);

        // Seed default hospital
        db.prepare(`
            INSERT OR IGNORE INTO hospitals (id, name, code, type, city, district, state, bed_capacity, contact_email, contact_phone, max_super_admins, max_admins, status)
            VALUES (1, 'SAL Hospital', 'HOSP-SAL-01', 'Private Multi-Specialty Hospital', 'Ahmedabad', 'Ahmedabad', 'Gujarat', 750, 'info@salhospital.com', '9664552098', 3, 20, 'Active')
        `).run();

        // Seed default Hospital Super Admin
        db.prepare(`
            INSERT OR IGNORE INTO hospital_admins (id, hospital_id, username, name, email, phone, pin, role, department, status)
            VALUES (1, 1, 'hosp_superadmin', 'Dr. Ramesh Patel (Medical Superintendent)', 'ms@salhospital.com', '9876500001', '8888', 'Hospital Super Admin', 'Hospital Administration & Clinical Oversight', 'Active')
        `).run();
    }
};
