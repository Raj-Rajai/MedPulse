import type { Db, SchemaModule } from '../db.types';

/** Fixes on top of the original migrations (missing column, missing default admin on a fresh install). */
export const fixesSchema: SchemaModule = {
    name: 'fixes',
    apply(db: Db) {
        const cols = db.prepare('PRAGMA table_info(member_medical_history)').all();
        if (cols.length && !cols.some((c) => c.name === 'hospital_doctor')) {
            db.exec('ALTER TABLE member_medical_history ADD COLUMN hospital_doctor TEXT');
        }

        // A fresh install had no administrator, so nobody could sign in to the admin portal and the
        // seeded campaign (created_by_admin_id = 1) failed its foreign key. Create the same default
        // University Super Admin the production database has, only when there are no admins at all.
        const admins = db.prepare('SELECT COUNT(*) AS n FROM admins').get();
        if (admins && admins.n === 0) {
            // admins.university_id references colleges(id); same default college the seeder creates.
            db.prepare(`INSERT OR IGNORE INTO colleges (id, name, code, city, state)
                VALUES (1, 'SAL Institute of Medical Sciences & Hospital', 'SAL-01', 'Ahmedabad', 'Gujarat')`).run();
            db.prepare(`INSERT INTO admins (id, username, name, email, pin, role, university_id, status)
                VALUES (1, 'admin', 'Dr. Rajesh Mehta (HOD Community Medicine)', 'admin@medpulse.edu', '9999', 'University Super Admin', 1, 'Active')`).run();
        }
    },
};
