import type { Db, SchemaModule } from '../db.types';

/** Database-wide member identity, applied on every server's startup. */
export const memberIdentitySchema: SchemaModule = {
    name: 'member-identity',
    apply(db: Db) {
        db.exec('SAVEPOINT member_identity_migration');
        try {
            const columns = db.prepare('PRAGMA table_info(family_members)').all();
            if (!columns.some((column) => column.name === 'medpulse_id')) {
                db.exec('ALTER TABLE family_members ADD COLUMN medpulse_id TEXT');
            }
            // Preserve the IDs already displayed by the frontend for existing members.
            db.exec(`
                UPDATE family_members SET medpulse_id = printf('MP-%08d', id)
                WHERE medpulse_id IS NULL OR medpulse_id = '';

                CREATE UNIQUE INDEX IF NOT EXISTS family_members_medpulse_id_unique
                ON family_members (medpulse_id);

                CREATE TRIGGER IF NOT EXISTS family_members_identity_server_only
                BEFORE INSERT ON family_members
                WHEN NEW.medpulse_id IS NOT NULL
                BEGIN
                    SELECT RAISE(ABORT, 'MedPulse ID is assigned by the server');
                END;

                CREATE TRIGGER IF NOT EXISTS family_members_identity_assign
                AFTER INSERT ON family_members
                BEGIN
                    UPDATE family_members SET medpulse_id = printf('MP-%08d', NEW.id)
                    WHERE id = NEW.id;
                END;

                CREATE TRIGGER IF NOT EXISTS family_members_identity_immutable
                BEFORE UPDATE OF id, medpulse_id ON family_members
                WHEN NEW.id IS NOT OLD.id
                    OR (OLD.medpulse_id IS NOT NULL AND NEW.medpulse_id IS NOT OLD.medpulse_id)
                    OR NEW.medpulse_id IS NOT printf('MP-%08d', NEW.id)
                BEGIN
                    SELECT RAISE(ABORT, 'MedPulse ID cannot be changed');
                END;
            `);
            db.exec('RELEASE member_identity_migration');
        } catch (error) {
            db.exec('ROLLBACK TO member_identity_migration; RELEASE member_identity_migration');
            throw error;
        }
    },
};
