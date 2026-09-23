const { db } = require('../config/db');
const { clean } = require('../middleware/auth.middleware');

/**
 * CRM: Patient engagement with health campaigns
 *  - Campaign RSVP (Attending / Not Attending / Need Help)
 *  - Patient confirmation that the student actually made the campaign follow-up call
 *
 * (Patient -> care-team calls now go to the hospital: see hospital-callback.model.js)
 */

const RSVP_VALUES = ['Attending', 'Not Attending', 'Need Help'];
// Keep the legacy `status` column in sync so admin rosters & stats keep working
const RSVP_TO_STATUS = { 'Attending': 'Acknowledged', 'Not Attending': 'Declined', 'Need Help': 'Read' };

class EngagementError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function getNotificationForPatient(notificationId, patientId) {
    const row = db.prepare(`
        SELECT cn.*, c.title AS campaign_title
        FROM campaign_notifications cn
        JOIN campaigns c ON c.id = cn.campaign_id
        WHERE cn.id = ? AND cn.patient_id = ?
    `).get(notificationId, patientId);
    if (!row) throw new EngagementError('Campaign alert not found', 404);
    return row;
}

const EngagementModel = {
    EngagementError,

    rsvp(notificationId, patient, rsvp, note) {
        if (!RSVP_VALUES.includes(rsvp)) {
            throw new EngagementError(`RSVP must be one of: ${RSVP_VALUES.join(', ')}`);
        }
        getNotificationForPatient(notificationId, patient.id);
        const cleanNote = note ? String(note).trim().slice(0, 500) : null;

        // "Need Help" re-opens the student's follow-up call so they reach out again
        db.prepare(`
            UPDATE campaign_notifications
            SET rsvp = ?, rsvp_note = ?, rsvp_at = CURRENT_TIMESTAMP,
                status = ?, patient_response_note = COALESCE(?, patient_response_note),
                read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                cadet_call_status = CASE WHEN ? = 'Need Help' AND cadet_call_status != 'Assisted' THEN 'Pending' ELSE cadet_call_status END
            WHERE id = ?
        `).run(rsvp, cleanNote, RSVP_TO_STATUS[rsvp], cleanNote, rsvp, notificationId);

        return { notification: clean(db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId)) };
    },

    markNotificationsRead(patientId) {
        const info = db.prepare(`
            UPDATE campaign_notifications
            SET status = 'Read', read_at = CURRENT_TIMESTAMP
            WHERE patient_id = ? AND status = 'Delivered'
        `).run(patientId);
        return Number(info.changes || 0);
    },

    confirmCampaignContact(notificationId, patientId, confirmed) {
        const notif = getNotificationForPatient(notificationId, patientId);
        if (!notif.contacted_at && !['Contacted', 'Assisted'].includes(notif.cadet_call_status)) {
            throw new EngagementError('Your student has not marked this call as done yet');
        }
        db.prepare(`
            UPDATE campaign_notifications
            SET patient_contact_confirmation = ?, patient_contact_confirmed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(confirmed ? 'Confirmed' : 'Disputed', notificationId);
        return clean(db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId));
    }
};

module.exports = EngagementModel;
