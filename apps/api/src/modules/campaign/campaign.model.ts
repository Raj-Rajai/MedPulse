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

    async create(data: Record<string, any>): Promise<Row | null> {
        const title = data.title ? data.title.trim() : 'Public Health Campaign';
        const keyword = data.keyword ? data.keyword.trim().toUpperCase() : 'GENERAL';
        const description = data.description ? data.description.trim() : '';
        const collegeId = data.college_id ? Number(data.college_id) : null;
        const adminId = data.created_by_admin_id ? Number(data.created_by_admin_id) : null;
        const eventDate = data.event_date || null;
        const venue = data.venue ? data.venue.trim() : null;

        const info = await this.db.insert(
            `INSERT INTO campaigns (title, keyword, description, college_id, created_by_admin_id, event_date, venue, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')`,
            title,
            keyword,
            description,
            collegeId,
            adminId,
            eventDate,
            venue,
        );

        return this.findById(info.lastInsertRowid);
    }

    async findById(id: unknown): Promise<Row | null> {
        const campaign = await this.db.queryOne(
            `SELECT c.*, col.name as college_name, a.name as admin_name
             FROM campaigns c
             LEFT JOIN colleges col ON c.college_id = col.id
             LEFT JOIN admins a ON c.created_by_admin_id = a.id
             WHERE c.id = $1`,
            Number(id),
        );
        return clean(campaign);
    }

    async list(collegeId: any = null): Promise<Row[]> {
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
            sql += ' WHERE c.college_id = $1 OR c.college_id IS NULL ';
            params.push(Number(collegeId));
        }
        sql += ' GROUP BY c.id, col.name, a.name ORDER BY c.created_at DESC';

        const rows = await this.db.queryAll(sql, ...params);
        return cleanList(rows);
    }

    async findMatchingPatients(keyword: any, collegeId: any = null): Promise<Row[]> {
        const kw = (keyword || '').trim().toUpperCase();

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
            conditionClause = `(
                LOWER(COALESCE(cond.condition_name, '')) LIKE LOWER('%' || $2 || '%')
                OR LOWER(COALESCE(fm.diagnosis, '')) LIKE LOWER('%' || $3 || '%')
            )`;
            matchedLabel = `Custom Condition (${kw})`;
            isCustomKeyword = true;
        }

        const params: any[] = [matchedLabel];
        if (isCustomKeyword) {
            params.push(kw, kw);
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
                $1::text as matched_label
            FROM patients p
            LEFT JOIN family_members fm ON p.family_member_id = fm.id
            LEFT JOIN health_conditions cond ON fm.id = cond.member_id
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE ${conditionClause}
        `;

        if (collegeId) {
            params.push(Number(collegeId));
            sql += ` AND (s.college_id = $${params.length} OR s.college_id IS NULL)`;
        }

        sql += ' ORDER BY p.name ASC';

        const rows = await this.db.queryAll(sql, ...params);
        return cleanList(rows);
    }

    async dispatchCampaign(campaignId: any) {
        const campaign = await this.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        const matchingPatients = await this.findMatchingPatients(campaign.keyword, campaign.college_id);

        const existingRows = await this.db.queryAll(
            'SELECT patient_id FROM campaign_notifications WHERE campaign_id = $1',
            Number(campaignId),
        );
        const existingSet = new Set(existingRows.map((r) => r.patient_id));

        let insertedCount = 0;
        for (const pat of matchingPatients) {
            if (!existingSet.has(pat.patient_id)) {
                let detail = pat.matched_label;
                if (pat.sbp && pat.dbp) detail += ` (BP: ${pat.sbp}/${pat.dbp} mmHg)`;
                else if (pat.rbs) detail += ` (RBS: ${pat.rbs} mg/dL)`;
                else if (pat.hb) detail += ` (Hb: ${pat.hb} g/dL)`;

                await this.db.execute(
                    `INSERT INTO campaign_notifications (campaign_id, patient_id, student_id, matched_keyword, matched_condition_detail, status, cadet_call_status)
                     VALUES ($1, $2, $3, $4, $5, 'Delivered', 'Pending')`,
                    Number(campaignId),
                    Number(pat.patient_id),
                    pat.student_id ? Number(pat.student_id) : null,
                    campaign.keyword,
                    detail,
                );
                insertedCount++;
            }
        }

        return {
            campaign_id: campaignId,
            keyword: campaign.keyword,
            total_matching: matchingPatients.length,
            newly_notified: insertedCount,
            already_notified: matchingPatients.length - insertedCount,
        };
    }

    async getPatientNotifications(patientId: unknown): Promise<Row[]> {
        const rows = await this.db.queryAll(
            `SELECT
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
             WHERE cn.patient_id = $1
             ORDER BY cn.created_at DESC`,
            Number(patientId),
        );

        return cleanList(rows);
    }

    async acknowledgeNotification(
        notificationId: unknown,
        patientId: unknown,
        status: any = 'Acknowledged',
        responseNote: any = null,
    ): Promise<Row | undefined> {
        const notif = await this.db.queryOne(
            'SELECT * FROM campaign_notifications WHERE id = $1 AND patient_id = $2',
            Number(notificationId),
            Number(patientId),
        );

        if (!notif) throw new Error('Notification not found or access denied');

        await this.db.execute(
            `UPDATE campaign_notifications
             SET status = $1, patient_response_note = COALESCE($2, patient_response_note)
             WHERE id = $3`,
            status,
            responseNote,
            Number(notificationId),
        );

        return this.db.queryOne('SELECT * FROM campaign_notifications WHERE id = $1', Number(notificationId));
    }

    async getCadetCampaignTasks(studentId: unknown): Promise<Row[]> {
        const rows = await this.db.queryAll(
            `SELECT
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
             WHERE cn.student_id = $1
             ORDER BY cn.created_at DESC`,
            Number(studentId),
        );

        return cleanList(rows);
    }

    async updateCadetTaskStatus(notificationId: unknown, studentId: unknown, callStatus: any): Promise<Row | undefined> {
        const validStatuses = ['Pending', 'Contacted', 'Assisted'];
        if (!validStatuses.includes(callStatus)) {
            throw new Error(`Invalid call status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const task = await this.db.queryOne(
            'SELECT * FROM campaign_notifications WHERE id = $1 AND student_id = $2',
            Number(notificationId),
            Number(studentId),
        );

        if (!task) throw new Error('Campaign task not found for this cadet');

        await this.db.execute(
            `UPDATE campaign_notifications
             SET cadet_call_status = $1,
                 contacted_at = CASE WHEN $2 = 'Pending' THEN NULL ELSE COALESCE(contacted_at, CURRENT_TIMESTAMP) END,
                 patient_contact_confirmation = CASE WHEN $3 = 'Pending' THEN NULL ELSE patient_contact_confirmation END
             WHERE id = $4`,
            callStatus,
            callStatus,
            callStatus,
            Number(notificationId),
        );

        return this.db.queryOne('SELECT * FROM campaign_notifications WHERE id = $1', Number(notificationId));
    }

    async getCampaignRoster(campaignId: unknown): Promise<Row[]> {
        const rows = await this.db.queryAll(
            `SELECT
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
             WHERE cn.campaign_id = $1
             ORDER BY cn.status DESC, p.name ASC`,
            Number(campaignId),
        );

        return cleanList(rows);
    }

    async autoEnrollPatient(patientId: unknown): Promise<number> {
        const activeCampaigns = await this.db.queryAll("SELECT * FROM campaigns WHERE status = 'Active'");
        let enrolledCount = 0;
        const pid = Number(patientId);
        for (const camp of activeCampaigns) {
            const matches = await this.findMatchingPatients(camp.keyword, camp.college_id);
            const matchInfo = matches.find((m) => Number(m.patient_id) === pid);
            if (matchInfo) {
                const exists = await this.db.queryOne(
                    'SELECT id FROM campaign_notifications WHERE campaign_id = $1 AND patient_id = $2',
                    Number(camp.id),
                    pid,
                );
                if (!exists) {
                    await this.db.execute(
                        `INSERT INTO campaign_notifications (campaign_id, patient_id, student_id, matched_keyword, matched_condition_detail, status, cadet_call_status)
                         VALUES ($1, $2, $3, $4, $5, 'Delivered', 'Pending')`,
                        Number(camp.id),
                        pid,
                        matchInfo.student_id ? Number(matchInfo.student_id) : null,
                        camp.keyword,
                        matchInfo.matched_label,
                    );
                    enrolledCount++;
                }
            }
        }
        return enrolledCount;
    }
}
