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

        // Ensure default colleges exist
        db.prepare(`
            INSERT OR IGNORE INTO colleges (id, name, code, city, state)
            VALUES (1, 'GMERS Medical College & Hospital', 'GMERS-01', 'Ahmedabad', 'Gujarat')
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO colleges (id, name, code, city, state)
            VALUES (2, 'SAL Institute of Medical Sciences', 'SAL-01', 'Ahmedabad', 'Gujarat')
        `).run();

        // Ensure default student exists (Roll 235 - Dhruv Patel)
        db.prepare(`
            INSERT OR IGNORE INTO students (id, roll_number, name, pin, batch_year, college_id)
            VALUES (1, '235', 'Dhruv Patel', '1234', '3rd Year MBBS (Community Medicine)', 1)
        `).run();

        // Ensure default admin exists (admin / 9999)
        db.prepare(`
            INSERT OR IGNORE INTO admins (id, username, name, pin, email, role)
            VALUES (1, 'admin', 'Dr. Rajesh Mehta (HOD Community Medicine)', '9999', 'admin@medpulse.edu', 'Super Admin')
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
