const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbDir = path.join(__dirname, '..', 'database');
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
        const migrations = [
            "ALTER TABLE students ADD COLUMN pin TEXT DEFAULT '1234';",
            "ALTER TABLE students ADD COLUMN email TEXT;",
            "ALTER TABLE students ADD COLUMN phone TEXT;",
            "ALTER TABLE students ADD COLUMN posting_unit TEXT DEFAULT 'RHTC - Rural Health Training Center';",
            "ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'Active';",
            "ALTER TABLE students ADD COLUMN referral_code TEXT;",
            "ALTER TABLE colleges ADD COLUMN max_admins INTEGER DEFAULT 10;",
            "ALTER TABLE admins ADD COLUMN university_id INTEGER REFERENCES colleges(id);",
            "ALTER TABLE admins ADD COLUMN phone TEXT;",
            "ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'Active';",
            "ALTER TABLE families ADD COLUMN family_code TEXT;",
            "ALTER TABLE families ADD COLUMN family_name TEXT;",
            "ALTER TABLE families ADD COLUMN contact_number TEXT;",
            "ALTER TABLE families ADD COLUMN village TEXT;",
            "ALTER TABLE families ADD COLUMN city TEXT;",
            "ALTER TABLE families ADD COLUMN district TEXT;",
            "ALTER TABLE families ADD COLUMN state TEXT;",
            "ALTER TABLE families ADD COLUMN pincode TEXT;",
            "ALTER TABLE families ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE family_members ADD COLUMN date_of_birth DATE;",
            "ALTER TABLE family_members ADD COLUMN contact_number TEXT;",
            "ALTER TABLE family_members ADD COLUMN marital_status TEXT DEFAULT 'Unknown';",
            "ALTER TABLE family_members ADD COLUMN education TEXT;",
            "ALTER TABLE family_members ADD COLUMN occupation TEXT;",
            "ALTER TABLE family_members ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;"
        ];

        for (const m of migrations) {
            try {
                db.exec(m);
            } catch (e) {
                // Column already exists or table doesn't exist yet, safe to ignore
            }
        }

        const schemaPath = path.join(dbDir, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        }

        // Migration safety for patients table
        const patientMigrations = [
            "ALTER TABLE patients ADD COLUMN model_type TEXT DEFAULT 'Independent';",
            "ALTER TABLE patients ADD COLUMN student_id INTEGER REFERENCES students(id);",
            "ALTER TABLE patients ADD COLUMN referral_code_used TEXT;",
            "ALTER TABLE patients ADD COLUMN family_member_id INTEGER REFERENCES family_members(id);",
            "ALTER TABLE patients ADD COLUMN hospital_id INTEGER DEFAULT 1;"
        ];
        for (const pm of patientMigrations) {
            try { db.exec(pm); } catch (e) {}
        }

        // Ensure default colleges exist
        db.prepare(`
            INSERT OR IGNORE INTO colleges (id, name, code, city, state, max_admins)
            VALUES (1, 'GMERS Medical College & Hospital', 'GMERS-01', 'Ahmedabad', 'Gujarat', 10)
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO colleges (id, name, code, city, state, max_admins)
            VALUES (2, 'SAL Institute of Medical Sciences', 'SAL-01', 'Ahmedabad', 'Gujarat', 10)
        `).run();

        // Ensure default student exists (Roll 235 - Dhruv Patel)
        db.prepare(`
            INSERT OR IGNORE INTO students (id, roll_number, name, pin, batch_year, college_id)
            VALUES (1, '235', 'Dhruv Patel', '1234', '3rd Year MBBS (Community Medicine)', 1)
        `).run();

        // Backfill student referral codes if missing
        try {
            const { generateUniqueReferralCode } = require('./referral-service');
            const unlinkedStudents = db.prepare("SELECT id, roll_number, college_id FROM students WHERE referral_code IS NULL OR referral_code = ''").all();
            for (const s of unlinkedStudents) {
                const code = generateUniqueReferralCode(db, s.college_id || 1, s.roll_number);
                db.prepare('UPDATE students SET referral_code = ? WHERE id = ?').run(code, s.id);
            }
        } catch (refErr) {
            console.warn('Referral backfill notice:', refErr.message);
        }

        // Ensure default admin exists (admin / 9999 as University Super Admin of GMERS)
        db.prepare(`
            INSERT OR IGNORE INTO admins (id, username, name, pin, email, role, university_id, status)
            VALUES (1, 'admin', 'Dr. Rajesh Mehta (HOD Community Medicine)', '9999', 'admin@medpulse.edu', 'University Super Admin', 1, 'Active')
        `).run();

        // Ensure default admin has University Super Admin role and university_id
        db.prepare(`
            UPDATE admins 
            SET role = 'University Super Admin',
                university_id = COALESCE(university_id, 1),
                status = 'Active'
            WHERE id = 1 AND (role = 'Super Admin' OR role = 'Faculty Supervisor' OR role = 'University Super Admin')
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
