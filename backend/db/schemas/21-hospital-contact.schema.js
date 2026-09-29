// Keep the default hospital record aligned with current SAL Hospital branding.
module.exports = {
    apply(db) {
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

        // Ensure college is SAL Institute of Medical Sciences & Hospital and no GMERS remains
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
    }
};
