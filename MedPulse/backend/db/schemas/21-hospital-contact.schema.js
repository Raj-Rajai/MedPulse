// Update the legacy helpdesk number once, preserving any customized contacts.
module.exports = {
    apply(db) {
        db.prepare(`UPDATE hospitals SET contact_phone = ?
            WHERE code = ? AND contact_phone = ?`)
            .run('9664552098', 'HOSP-SAL-01', '079-23221234');
    }
};
