import type { Db, SchemaModule } from '../db.types';

/**
 * Academic years (sessions such as 2026-2027) managed from the admin console. Each year can carry
 * its own field area (centre + radius) that its students must be inside to save field records;
 * students.academic_year_id says which session a student belongs to.
 */
export const academicYearsSchema: SchemaModule = {
    name: 'academic-years',
    apply(db: Db) {
        // Per-batch areas from an earlier draft of this feature; never released, replaced by the columns below.
        db.exec('DROP TABLE IF EXISTS academic_year_geofences');

        db.exec(`CREATE TABLE IF NOT EXISTS academic_years (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL UNIQUE,
            start_date TEXT,
            end_date TEXT,
            is_current INTEGER NOT NULL DEFAULT 0,
            area_name TEXT,
            latitude REAL,
            longitude REAL,
            radius REAL,
            area_updated_by INTEGER,
            area_updated_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        const cols = db.prepare('PRAGMA table_info(students)').all();
        if (cols.length && !cols.some((c) => c.name === 'academic_year_id')) {
            db.exec('ALTER TABLE students ADD COLUMN academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL');
        }

        // First run: create the recent sessions and file every existing student under the current one.
        const count = db.prepare('SELECT COUNT(*) AS n FROM academic_years').get();
        if (count && count.n === 0) {
            const now = new Date();
            // Sessions start in July: Oct 2026 is in 2026-2027, Mar 2026 in 2025-2026.
            const currentStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
            const insert = db.prepare('INSERT INTO academic_years (label, start_date, end_date, is_current) VALUES (?, ?, ?, ?)');
            for (let y = currentStart - 2; y <= currentStart; y++) {
                insert.run(`${y}-${y + 1}`, `${y}-07-01`, `${y + 1}-06-30`, y === currentStart ? 1 : 0);
            }
            const current = db.prepare('SELECT id FROM academic_years WHERE is_current = 1').get();
            if (current) db.prepare('UPDATE students SET academic_year_id = ? WHERE academic_year_id IS NULL').run(current.id);
        }
    },
};
