/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

/**
 * CRM: Patient engagement with health campaigns
 *  - Campaign RSVP (Attending / Not Attending / Need Help)
 *  - Patient confirmation that the student actually made the campaign follow-up call
 */

export const RSVP_VALUES = ['Attending', 'Not Attending', 'Need Help'];
const RSVP_TO_STATUS: Record<string, string> = {
    'Attending': 'Acknowledged',
    'Not Attending': 'Declined',
    'Need Help': 'Read',
};

export const EngagementError = StatusError;

@Injectable()
export class EngagementModel {
    static readonly EngagementError = StatusError;

    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    private async getNotificationForPatient(notificationId: unknown, patientId: unknown): Promise<Row> {
        const row = await this.db.queryOne(
            `SELECT cn.*, c.title AS campaign_title
             FROM campaign_notifications cn
             JOIN campaigns c ON c.id = cn.campaign_id
             WHERE cn.id = $1 AND cn.patient_id = $2`,
            Number(notificationId),
            Number(patientId),
        );
        if (!row) throw new StatusError('Campaign alert not found', 404);
        return row;
    }

    async rsvp(notificationId: unknown, patient: Row, rsvp: any, note: any) {
        if (!RSVP_VALUES.includes(rsvp)) {
            throw new StatusError(`RSVP must be one of: ${RSVP_VALUES.join(', ')}`);
        }
        await this.getNotificationForPatient(notificationId, patient.id);
        const cleanNote = note ? String(note).trim().slice(0, 500) : null;

        await this.db.execute(
            `UPDATE campaign_notifications
             SET rsvp = $1, rsvp_note = $2, rsvp_at = CURRENT_TIMESTAMP,
                 status = $3, patient_response_note = COALESCE($4, patient_response_note),
                 read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                 cadet_call_status = CASE WHEN $5 = 'Need Help' AND cadet_call_status != 'Assisted' THEN 'Pending' ELSE cadet_call_status END
             WHERE id = $6`,
            rsvp,
            cleanNote,
            RSVP_TO_STATUS[rsvp],
            cleanNote,
            rsvp,
            Number(notificationId),
        );

        const updated = await this.db.queryOne('SELECT * FROM campaign_notifications WHERE id = $1', Number(notificationId));
        return { notification: clean(updated) };
    }

    async markNotificationsRead(patientId: unknown): Promise<number> {
        const info = await this.db.execute(
            `UPDATE campaign_notifications
             SET status = 'Read', read_at = CURRENT_TIMESTAMP
             WHERE patient_id = $1 AND status = 'Delivered'`,
            Number(patientId),
        );
        return Number(info.changes || 0);
    }

    async confirmCampaignContact(notificationId: unknown, patientId: unknown, confirmed: boolean): Promise<Row | null> {
        const notif = await this.getNotificationForPatient(notificationId, patientId);
        if (!notif.contacted_at && !['Contacted', 'Assisted'].includes(notif.cadet_call_status)) {
            throw new StatusError('Your student has not marked this call as done yet');
        }
        await this.db.execute(
            `UPDATE campaign_notifications
             SET patient_contact_confirmation = $1, patient_contact_confirmed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            confirmed ? 'Confirmed' : 'Disputed',
            Number(notificationId),
        );
        const updated = await this.db.queryOne('SELECT * FROM campaign_notifications WHERE id = $1', Number(notificationId));
        return clean(updated);
    }
}
