import type { Row } from './row';

/** Notifications are logistics previews, never a copy of the clinical matching criteria. */
export function patientNotificationView(row: Row | null | undefined): Row | null {
    if (!row) return null;
    const fields = ['id', 'notification_id', 'notification_status', 'status', 'rsvp', 'rsvp_note', 'event_date',
        'campaign_status', 'venue', 'organizing_college', 'contacted_at', 'cadet_call_status', 'cadet_name', 'patient_contact_confirmation'];
    return { ...Object.fromEntries(Object.entries(row).filter(([key]) => fields.includes(key))), campaign_title: 'Health camp invitation' };
}
