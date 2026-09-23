/**
 * HMS-owned: hospitals, hospital staff (+ default seeds).
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
    }
};
