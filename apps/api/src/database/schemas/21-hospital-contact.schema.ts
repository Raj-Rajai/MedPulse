import type { Db, SchemaModule } from '../db.types';

// Keep the default hospital record aligned with current SAL Hospital branding.
export const hospitalContactSchema: SchemaModule = {
    apply(db: Db) {
        db.prepare(`UPDATE hospitals
            SET name = ?,
                code = ?,
                type = ?,
                city = ?,
                district = ?,
                state = ?,
                contact_email = ?,
                contact_phone = ?
            WHERE id = 1
                OR code IN ('HOSP-GMERS-01', 'GMERS-01')
                OR name LIKE '%GMERS%'
                OR name LIKE '%Civil Hospital%'
                OR contact_phone = '079-23221234'`)
            .run(
                'SAL Hospital',
                'HOSP-SAL-01',
                'Private Multi-Specialty Hospital',
                'Ahmedabad',
                'Ahmedabad',
                'Gujarat',
                'info@salhospital.com',
                '6357009495'
            );

        // Ensure college is SAL Institute of Medical Sciences & Hospital and no GMERS remains.
        // FIX (startup crash): another college may already hold the code 'SAL-01' (colleges.code is UNIQUE),
        // which made the update below throw and the server refuse to start. Free the code first;
        // those colleges are removed further down anyway.
        db.prepare(`UPDATE colleges SET code = code || '-OLD-' || id WHERE id != 1 AND code = 'SAL-01'`).run();
        db.prepare(`UPDATE colleges
            SET name = 'SAL Institute of Medical Sciences & Hospital',
                code = 'SAL-01',
                city = 'Ahmedabad',
                state = 'Gujarat'
            WHERE id = 1`).run();

        // Migrate any remaining students to college 1
        db.prepare(`UPDATE students SET college_id = 1 WHERE college_id IS NULL OR college_id != 1`).run();
        // Migrate any remaining admins to university_id 1
        try {
            db.prepare(`UPDATE admins SET university_id = 1 WHERE university_id IS NULL OR university_id != 1`).run();
        } catch (e) {}
        // Remove any college with id != 1 or mentioning GMERS
        try {
            db.prepare(`DELETE FROM colleges WHERE id != 1 OR name LIKE '%GMERS%'`).run();
        } catch (e) {}

        // Migrate any referral codes and emails referencing GMERS
        try {
            db.prepare(`UPDATE students SET referral_code = REPLACE(referral_code, 'GMERS', 'SAL') WHERE referral_code LIKE '%GMERS%'`).run();
            db.prepare(`UPDATE patients SET referral_code_used = REPLACE(referral_code_used, 'GMERS', 'SAL') WHERE referral_code_used LIKE '%GMERS%'`).run();
            db.prepare(`UPDATE hospital_admins SET email = 'ms.civil@salhospital.com' WHERE email LIKE '%gmers%'`).run();
        } catch (e) {}
    }
};
