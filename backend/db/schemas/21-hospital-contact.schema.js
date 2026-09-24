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
                '9664552098'
            );
    }
};
