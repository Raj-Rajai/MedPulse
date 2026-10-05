/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';

@Injectable()
export class CampaignModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    /**
     * Create a new public health campaign
     */
    create(data: Record<string, any>): Row | null {
        const title = data.title ? data.title.trim() : 'Public Health Campaign';
        const keyword = data.keyword ? data.keyword.trim().toUpperCase() : 'GENERAL';
        const description = data.description ? data.description.trim() : '';
        const collegeId = data.college_id || null;
        const adminId = data.created_by_admin_id || null;
        const eventDate = data.event_date || null;
        const venue = data.venue ? data.venue.trim() : null;

        const info = this.db.prepare(`
            INSERT INTO campaigns (title, keyword, description, college_id, created_by_admin_id, event_date, venue, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
        `).run(title, keyword, description, collegeId, adminId, eventDate, venue);

        const newId = info.lastInsertRowid;
        return this.findById(newId);
    }

    /**
     * Retrieve campaign by ID
     */
    findById(id: unknown): Row | null {
        const campaign = this.db.prepare(`
            SELECT c.*, col.name as college_name, a.name as admin_name
            FROM campaigns c
            LEFT JOIN colleges col ON c.college_id = col.id
            LEFT JOIN admins a ON c.created_by_admin_id = a.id
            WHERE c.id = ?
        `).get(id);
        return clean(campaign);
    }

    /**
     * List campaigns with aggregated delivery and engagement statistics
     */
    list(collegeId: any = null): Row[] {
        let sql = `
            SELECT c.*, col.name as college_name, a.name as admin_name,
                   COUNT(cn.id) as total_targeted,
                   COUNT(CASE WHEN cn.status IN ('Read', 'Acknowledged') THEN 1 END) as total_opened,
                   COUNT(CASE WHEN cn.status = 'Acknowledged' THEN 1 END) as total_acknowledged,
                   COUNT(CASE WHEN cn.cadet_call_status = 'Contacted' OR cn.cadet_call_status = 'Assisted' THEN 1 END) as total_contacted
            FROM campaigns c
            LEFT JOIN colleges col ON c.college_id = col.id
            LEFT JOIN admins a ON c.created_by_admin_id = a.id
            LEFT JOIN campaign_notifications cn ON c.id = cn.campaign_id
        `;
        const params: any[] = [];
        if (collegeId) {
            sql += ' WHERE c.college_id = ? OR c.college_id IS NULL ';
            params.push(collegeId);
        }
        sql += ' GROUP BY c.id ORDER BY c.created_at DESC';

        const rows = this.db.prepare(sql).all(...params);
        return cleanList(rows);
    }

    /**
     * Intelligent matching algorithm: Scans database for patients matching the campaign keyword
     * (Supports HTN, DM, ANAEMIA, UNDERWEIGHT/MALNUTRITION, ELDERLY, and generic conditions)
     */
    findMatchingPatients(keyword: any, collegeId: any = null): Row[] {
        const kw = (keyword || '').trim().toUpperCase();

        // Base query joining patients, members, students, colleges, and diagnostic conditions
        let conditionClause = '';
        let matchedLabel = '';
        let isCustomKeyword = false;

        if (kw === 'HTN' || kw.includes('HYPERTEN')) {
            conditionClause = `(
                fm.has_htn = 'Y'
                OR fm.sbp >= 140
                OR fm.dbp >= 90
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%hypertens%'
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%htn%'
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE '%hypertens%'
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE '%htn%'
            )`;
            matchedLabel = 'Hypertension (HTN)';
        } else if (kw === 'DM' || kw.includes('DIABET')) {
            conditionClause = `(
                fm.has_dm = 'Y'
                OR fm.rbs >= 200
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%diabet%'
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%dm%'
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE '%diabet%'
            )`;
            matchedLabel = 'Diabetes Mellitus (DM)';
        } else if (kw === 'ANAEMIA' || kw.includes('ANEMIA') || kw.includes('ANAEM')) {
            conditionClause = `(
                fm.has_anaemia = 'Y'
                OR (fm.hb IS NOT NULL AND fm.hb > 0 AND fm.hb < 11.0)
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%anaemi%'
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%anemi%'
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE '%anaemi%'
            )`;
            matchedLabel = 'Anaemia / Low Haemoglobin';
        } else if (kw === 'UNDERWEIGHT' || kw.includes('MALNUTRIT') || kw === 'NUTRITION') {
            conditionClause = `(
                fm.is_underweight = 'Y'
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%malnutr%'
                OR LOWER(COALESCE(cond.condition_name, '')) LIKE '%underweight%'
            )`;
            matchedLabel = 'Underweight / Nutritional Deficiency';
        } else if (kw === 'ELDERLY' || kw.includes('GERIATRIC')) {
            conditionClause = `(
                p.age_years >= 60
                OR fm.age_years >= 60
            )`;
            matchedLabel = 'Geriatric / Age >= 60';
        } else {
            // General condition keyword search
            conditionClause = `(
                LOWER(COALESCE(cond.condition_name, '')) LIKE LOWER('%' || ? || '%')
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE LOWER('%' || ? || '%')
            )`;
            matchedLabel = `Custom Condition (${kw})`;
            isCustomKeyword = true;
        }

        let sql = `
            SELECT DISTINCT
                p.id as patient_id,
                p.name as patient_name,
                p.phone as patient_phone,
                COALESCE(p.age_years, fm.age_years) as age_years,
                COALESCE(p.gender, fm.gender) as gender,
                p.model_type,
                p.student_id,
                s.name as cadet_name,
                s.roll_number as cadet_roll,
                s.phone as cadet_phone,
                c.id as college_id,
                c.name as college_name,
                fm.sbp,
                fm.dbp,
                fm.rbs,
                fm.hb,
                cond.condition_name,
                ? as matched_label
            FROM patients p
            LEFT JOIN family_members fm ON p.family_member_id = fm.id
            LEFT JOIN health_conditions cond ON fm.id = cond.member_id
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE ${conditionClause}
        `;

        // FIX (SQL injection): the label used to be spliced into the SQL text, and for custom keywords it
        // contains the user's keyword. It is now a bound parameter. The keyword params are bound only when
        // the custom-keyword clause (the one with the two placeholders) was chosen; the old separate check
        // disagreed with the branches above for NUTRITION / GERIATRIC and broke those queries.
        const params: any[] = [matchedLabel];
        if (isCustomKeyword) {
            params.push(kw, kw);
        }

        if (collegeId) {
            sql += ' AND (s.college_id = ? OR s.college_id IS NULL)';
            params.push(collegeId);
        }

        sql += ' ORDER BY p.name ASC';

        const rows = this.db.prepare(sql).all(...params);
        return cleanList(rows);
    }

    /**
     * Dispatch campaign: Evaluates matching criteria and inserts targeted notification records
     */
    dispatchCampaign(campaignId: any) {
        const campaign = this.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        const matchingPatients = this.findMatchingPatients(campaign.keyword, campaign.college_id);

        const checkExisting = this.db.prepare(`
            SELECT patient_id FROM campaign_notifications WHERE campaign_id = ?
        `);
        const existingSet = new Set(checkExisting.all(campaignId).map(r => r.patient_id));

        const insertStmt = this.db.prepare(`
            INSERT INTO campaign_notifications (campaign_id, patient_id, student_id, matched_keyword, matched_condition_detail, status, cadet_call_status)
            VALUES (?, ?, ?, ?, ?, 'Delivered', 'Pending')
        `);

        let insertedCount = 0;
        for (const pat of matchingPatients) {
            if (!existingSet.has(pat.patient_id)) {
                let detail = pat.matched_label;
                if (pat.sbp && pat.dbp) detail += ` (BP: ${pat.sbp}/${pat.dbp} mmHg)`;
                else if (pat.rbs) detail += ` (RBS: ${pat.rbs} mg/dL)`;
                else if (pat.hb) detail += ` (Hb: ${pat.hb} g/dL)`;

                insertStmt.run(
                    campaignId,
                    pat.patient_id,
                    pat.student_id || null,
                    campaign.keyword,
                    detail
                );
                insertedCount++;
            }
        }

        return {
            campaign_id: campaignId,
            keyword: campaign.keyword,
            total_matching: matchingPatients.length,
            newly_notified: insertedCount,
            already_notified: matchingPatients.length - insertedCount
        };
    }

    /**
     * Patient CRM: Get all active campaigns & notifications for a specific patient
     */
    getPatientNotifications(patientId: unknown): Row[] {
        const rows = this.db.prepare(`
            SELECT
                cn.id as notification_id,
                cn.status as notification_status,
                cn.matched_keyword,
                cn.matched_condition_detail,
                cn.patient_response_note,
                cn.rsvp,
                cn.rsvp_note,
                cn.rsvp_at,
                cn.read_at,
                cn.cadet_call_status,
                cn.contacted_at,
                cn.patient_contact_confirmation,
                cn.created_at as notification_date,
                c.id as campaign_id,
                c.title as campaign_title,
                c.description as campaign_description,
                c.event_date,
                c.venue,
                c.status as campaign_status,
                col.name as organizing_college,
                s.name as cadet_name,
                s.roll_number as cadet_roll,
                s.phone as cadet_phone
            FROM campaign_notifications cn
            JOIN campaigns c ON cn.campaign_id = c.id
            LEFT JOIN colleges col ON c.college_id = col.id
            LEFT JOIN students s ON cn.student_id = s.id
            WHERE cn.patient_id = ?
            ORDER BY cn.created_at DESC
        `).all(patientId);

        return cleanList(rows);
    }

    /**
     * Patient CRM: Acknowledge / RSVP to a campaign
     */
    acknowledgeNotification(notificationId: unknown, patientId: unknown, status: any = 'Acknowledged', responseNote: any = null): Row | undefined {
        const notif = this.db.prepare(`
            SELECT * FROM campaign_notifications WHERE id = ? AND patient_id = ?
        `).get(notificationId, patientId);

        if (!notif) throw new Error('Notification not found or access denied');

        this.db.prepare(`
            UPDATE campaign_notifications
            SET status = ?, patient_response_note = COALESCE(?, patient_response_note)
            WHERE id = ?
        `).run(status, responseNote, notificationId);

        return this.db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId);
    }

    /**
     * Student Portal: Get campaign action items / follow-ups for assigned adopted patients
     */
    getCadetCampaignTasks(studentId: unknown): Row[] {
        const rows = this.db.prepare(`
            SELECT
                cn.id as notification_id,
                cn.status as notification_status,
                cn.matched_keyword,
                cn.matched_condition_detail,
                cn.patient_response_note,
                cn.cadet_call_status,
                cn.rsvp,
                cn.rsvp_note,
                cn.contacted_at,
                cn.patient_contact_confirmation,
                cn.created_at as notified_at,
                p.id as patient_id,
                p.name as patient_name,
                p.phone as patient_phone,
                p.patient_uid,
                c.id as campaign_id,
                c.title as campaign_title,
                c.event_date,
                c.venue
            FROM campaign_notifications cn
            JOIN campaigns c ON cn.campaign_id = c.id
            JOIN patients p ON cn.patient_id = p.id
            WHERE cn.student_id = ?
            ORDER BY cn.created_at DESC
        `).all(studentId);

        return cleanList(rows);
    }

    /**
     * Student Portal: Update cadet call / assistance status
     */
    updateCadetTaskStatus(notificationId: unknown, studentId: unknown, callStatus: any): Row | undefined {
        const validStatuses = ['Pending', 'Contacted', 'Assisted'];
        if (!validStatuses.includes(callStatus)) {
            throw new Error(`Invalid call status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const task = this.db.prepare(`
            SELECT * FROM campaign_notifications WHERE id = ? AND student_id = ?
        `).get(notificationId, studentId);

        if (!task) throw new Error('Campaign task not found for this cadet');

        this.db.prepare(`
            UPDATE campaign_notifications
            SET cadet_call_status = ?,
                contacted_at = CASE WHEN ? = 'Pending' THEN NULL ELSE COALESCE(contacted_at, CURRENT_TIMESTAMP) END,
                patient_contact_confirmation = CASE WHEN ? = 'Pending' THEN NULL ELSE patient_contact_confirmation END
            WHERE id = ?
        `).run(callStatus, callStatus, callStatus, notificationId);

        return this.db.prepare('SELECT * FROM campaign_notifications WHERE id = ?').get(notificationId);
    }

    /**
     * Admin Portal: Detailed roster of all targeted patients for a campaign
     */
    getCampaignRoster(campaignId: unknown): Row[] {
        const rows = this.db.prepare(`
            SELECT
                cn.id as notification_id,
                cn.status as status,
                cn.status as patient_status,
                cn.patient_response_note,
                cn.cadet_call_status,
                cn.rsvp,
                cn.patient_contact_confirmation,
                cn.matched_condition_detail,
                cn.created_at as delivered_at,
                p.id as patient_id,
                p.name as patient_name,
                p.phone as patient_phone,
                p.model_type,
                s.name as cadet_name,
                s.roll_number as cadet_roll,
                s.phone as cadet_phone
            FROM campaign_notifications cn
            JOIN patients p ON cn.patient_id = p.id
            LEFT JOIN students s ON cn.student_id = s.id
            WHERE cn.campaign_id = ?
            ORDER BY cn.status DESC, p.name ASC
        `).all(campaignId);

        return cleanList(rows);
    }

    /**
     * Auto-enroll a patient into any active campaigns matching their health condition
     */
    autoEnrollPatient(patientId: unknown): number {
        const activeCampaigns = this.db.prepare("SELECT * FROM campaigns WHERE status = 'Active'").all();
        let enrolledCount = 0;
        for (const camp of activeCampaigns) {
            const matches = this.findMatchingPatients(camp.keyword, camp.college_id);
            const isMatch = matches.some(m => m.patient_id === patientId);
            if (isMatch) {
                const exists = this.db.prepare('SELECT id FROM campaign_notifications WHERE campaign_id = ? AND patient_id = ?').get(camp.id, patientId);
                if (!exists) {
                    const matchInfo = matches.find(m => m.patient_id === patientId)!;
                    this.db.prepare(`
                        INSERT INTO campaign_notifications (campaign_id, patient_id, student_id, matched_keyword, matched_condition_detail, status, cadet_call_status)
                        VALUES (?, ?, ?, ?, ?, 'Delivered', 'Pending')
                    `).run(camp.id, patientId, matchInfo.student_id || null, camp.keyword, matchInfo.matched_label);
                    enrolledCount++;
                }
            }
        }
        return enrolledCount;
    }
}
