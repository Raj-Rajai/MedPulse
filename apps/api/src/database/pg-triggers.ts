import type { PrismaClient } from '@prisma/client';

/**
 * PostgreSQL equivalent of the SQLite `61-member-identity` triggers:
 * - Rejects client-supplied medpulse_id on INSERT
 * - Auto-assigns `MP-00000001` from the generated `id`
 * - Makes `id` and `medpulse_id` immutable on UPDATE
 */
export async function ensurePostgresTriggers(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION family_members_medpulse_id_before_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.medpulse_id IS NOT NULL THEN
                RAISE EXCEPTION 'MedPulse ID is assigned by the server';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION family_members_medpulse_id_after_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE family_members
            SET medpulse_id = 'MP-' || LPAD(NEW.id::text, 8, '0')
            WHERE id = NEW.id AND (medpulse_id IS NULL OR medpulse_id = '');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION family_members_medpulse_id_before_update()
        RETURNS TRIGGER AS $$
        DECLARE
            expected_id TEXT := 'MP-' || LPAD(NEW.id::text, 8, '0');
        BEGIN
            IF NEW.id IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'MedPulse ID cannot be changed';
            END IF;
            IF OLD.medpulse_id IS NOT NULL AND NEW.medpulse_id IS DISTINCT FROM OLD.medpulse_id THEN
                RAISE EXCEPTION 'MedPulse ID cannot be changed';
            END IF;
            IF NEW.medpulse_id IS NOT NULL AND NEW.medpulse_id IS DISTINCT FROM expected_id THEN
                RAISE EXCEPTION 'MedPulse ID cannot be changed';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS family_members_identity_server_only ON family_members;
        CREATE TRIGGER family_members_identity_server_only
        BEFORE INSERT ON family_members
        FOR EACH ROW
        EXECUTE FUNCTION family_members_medpulse_id_before_insert();
    `);

    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS family_members_identity_assign ON family_members;
        CREATE TRIGGER family_members_identity_assign
        AFTER INSERT ON family_members
        FOR EACH ROW
        EXECUTE FUNCTION family_members_medpulse_id_after_insert();
    `);

    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS family_members_identity_immutable ON family_members;
        CREATE TRIGGER family_members_identity_immutable
        BEFORE UPDATE OF id, medpulse_id ON family_members
        FOR EACH ROW
        EXECUTE FUNCTION family_members_medpulse_id_before_update();
    `);
}
