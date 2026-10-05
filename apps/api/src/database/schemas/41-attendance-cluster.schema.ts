import type { SchemaModule } from '../db.types';

export const attendanceClusterSchema: SchemaModule = {
    name: 'attendance-cluster',
    apply(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS attendance_clusters (
                id TEXT PRIMARY KEY,
                lecture_id INTEGER NOT NULL UNIQUE REFERENCES academic_lectures(id) ON DELETE CASCADE,
                college_id INTEGER NOT NULL REFERENCES colleges(id),
                admin_id INTEGER NOT NULL REFERENCES admins(id),
                anchor_token_hash TEXT NOT NULL,
                radius_m REAL NOT NULL DEFAULT 1 CHECK(radius_m > 0),
                tx_power_at_1m REAL NOT NULL,
                path_loss_exponent REAL NOT NULL,
                started_at INTEGER NOT NULL,
                ends_at INTEGER NOT NULL,
                closed_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS attendance_clusters_expiry ON attendance_clusters(closed_at, ends_at);
            CREATE TABLE IF NOT EXISTS attendance_cluster_members (
                cluster_id TEXT NOT NULL REFERENCES attendance_clusters(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                challenge TEXT UNIQUE,
                challenge_issued_at INTEGER,
                challenge_expires_at INTEGER,
                verified_until INTEGER,
                distance_m REAL,
                accepted_at INTEGER,
                PRIMARY KEY(cluster_id, student_id)
            );
            CREATE TABLE IF NOT EXISTS attendance_cluster_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_id TEXT NOT NULL REFERENCES attendance_clusters(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                event TEXT NOT NULL,
                distance_m REAL,
                created_at INTEGER NOT NULL
            );
        `);
        if (!db.prepare('PRAGMA table_info(attendance_cluster_members)').all().some(column => column.name === 'joined_at')) {
            db.exec('ALTER TABLE attendance_cluster_members ADD COLUMN joined_at INTEGER');
        }
    },
};
