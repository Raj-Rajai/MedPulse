import type { Db, SchemaModule } from '../db.types';

/**
 * Consent records schema supporting immutable event history, versioning,
 * actor/data principal tracking, purpose scope, and withdrawal/re-consent.
 */
export const consentSchema: SchemaModule = {
    name: 'consent',
    apply(db: Db) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS consent_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consent_id TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                role TEXT NOT NULL,
                consent_type TEXT NOT NULL,
                consent_version TEXT NOT NULL,
                purpose_version TEXT NOT NULL,
                privacy_policy_version TEXT NOT NULL,
                purpose_scope TEXT NOT NULL,
                action TEXT NOT NULL CHECK (action IN ('GRANTED', 'WITHDRAWN', 'SUPERSEDED', 'EXPIRED')),
                source TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                timestamp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(user_id, consent_type, action);
            CREATE INDEX IF NOT EXISTS idx_consent_records_version ON consent_records(consent_type, consent_version);
        `);
    },
};
