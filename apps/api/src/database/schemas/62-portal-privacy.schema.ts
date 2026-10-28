import type { SchemaModule } from '../db.types';

export const portalPrivacySchema: SchemaModule = {
    name: 'portal-privacy',
    apply(db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS portal_sessions (
                token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, actor_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS patient_record_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                grantee_patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                owner_patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('consent', 'guardian')),
                status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Revoked')),
                relationship TEXT, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
                reviewed_by INTEGER REFERENCES hospital_admins(id), reviewed_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS patient_record_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id),
                member_id INTEGER NOT NULL REFERENCES family_members(id),
                hospital_id INTEGER REFERENCES hospitals(id),
                record_type TEXT NOT NULL, record_id INTEGER, message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending', created_at INTEGER NOT NULL,
                reviewed_by INTEGER REFERENCES hospital_admins(id), reviewed_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS portal_privacy_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT, actor_role TEXT NOT NULL,
                actor_id INTEGER NOT NULL, action TEXT NOT NULL,
                resource_type TEXT NOT NULL, resource_id INTEGER, created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS patient_access_lookup ON patient_record_access(member_id, grantee_patient_id, status);
        `);
        if (!db.prepare('PRAGMA table_info(patient_record_corrections)').all().some(column => column.name === 'hospital_id')) {
            db.exec('ALTER TABLE patient_record_corrections ADD COLUMN hospital_id INTEGER REFERENCES hospitals(id)');
        }
        db.exec(`UPDATE patient_record_corrections SET hospital_id = COALESCE(
            (SELECT hospital_id FROM patients WHERE family_member_id = patient_record_corrections.member_id ORDER BY id LIMIT 1), 1)
            WHERE hospital_id IS NULL`);
    },
};
