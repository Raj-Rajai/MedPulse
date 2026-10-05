/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

/**
 * CRM: Patient engagement with health campaigns
 *  - Campaign RSVP (Attending / Not Attending / Need Help)
 *  - Patient confirmation that the student actually made the campaign follow-up call
 *
 * (Patient -> care-team calls now go to the hospital: see hospital-callback.model.ts)
 */

export const RSVP_VALUES = ['Attending', 'Not Attending', 'Need Help'];
// Keep the legacy `status` column in sync so admin rosters & stats keep working
const RSVP_TO_STATUS: Record<string, string> = { 'Attending': 'Acknowledged', 'Not Attending': 'Declined', 'Need Help': 'Read' };

/** The original `EngagementError(message, status = 400)`. */
export const EngagementError = StatusError;

@Injectable()
export class EngagementModel {
    static readonly EngagementError = StatusError;

    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    private getNotificationForPatient(notificationId: unknown, patientId: unknown): Row {
        const row = this.db.prepare(`
        SELECT cn.*, c.title AS campaign_title
        FROM campaign_notifications cn
        JOIN campaigns c ON c.id = cn.campaign_id
        WHERE cn.id = ? AND cn.patient_id = ?
    `).get(notificationId, patientId);
        if (!row) throw new StatusError('Campaign alert not found', 404);
        return row;
    }

    rsvp(notificationId: unknown, patient: Row, rsvp: any, note: any) {
        if (!RSVP_VALUES.includes(rsvp)) {
            throw new StatusError(`RSVP must be one of: ${RSVP_VALUES.join(', ')}`);
        }
        this.getNotificationForPatient(notificationId, patient.id);
        const cleanNote = note ? String(note).trim().slice(0, 500) : null;

        // "Need Help" re-opens the student's follow-up call so they reach out again
        this.db.prepare(`
            UPDATE campaign_notifications
            SET rsvp = ?, rsvp_note = ?, rsvp_at = CURRENT_TIMESTAMP,
                status = ?, patient_response_note = COALESCE(?, patient_response_note),
                read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                cadet_call_status = CASE WHEN ? = 'Need Help' AND cadet_call_status != 'Assisted' THEN 'Pending' ELSE cadet_call_status END
            WHERE id = ?
        `).run(rsvp, cleanNote, RSVP_TO_STATUS[rsvp], cleanNote, rsvp, notificationId);

        return { notification: clean(this.db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId)) };
    }

    markNotificationsRead(patientId: unknown): number {
        const info = this.db.prepare(`
            UPDATE campaign_notifications
            SET status = 'Read', read_at = CURRENT_TIMESTAMP
            WHERE patient_id = ? AND status = 'Delivered'
        `).run(patientId);
        return Number(info.changes || 0);
    }

    confirmCampaignContact(notificationId: unknown, patientId: unknown, confirmed: boolean): Row | null {
        const notif = this.getNotificationForPatient(notificationId, patientId);
        if (!notif.contacted_at && !['Contacted', 'Assisted'].includes(notif.cadet_call_status)) {
            throw new StatusError('Your student has not marked this call as done yet');
        }
        this.db.prepare(`
            UPDATE campaign_notifications
            SET patient_contact_confirmation = ?, patient_contact_confirmed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(confirmed ? 'Confirmed' : 'Disputed', notificationId);
        return clean(this.db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId));
    }
}
