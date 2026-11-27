/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';
import { PatientFamilyModel } from './patient-family.model';

export const CHANNELS = ['Callback', 'WhatsApp'];
export const DEPARTMENTS = [
    'General Medicine', 'Cardiology (Heart / BP)', 'Diabetes & Endocrine', 'Paediatrics (Children)',
    'Obstetrics & Gynaecology', 'Orthopaedics (Bones)', 'ENT', 'Eye', 'Dental', 'Skin', 'Not sure',
];
export const REASONS = ['Book appointment', 'Doctor consultation', 'Test report', 'Medicine query', 'New symptom', 'Follow-up visit', 'Other'];
export const HOSPITAL_STATUSES = ['Acknowledged', 'Scheduled', 'Resolved'];
const OPEN = ['Open', 'Acknowledged', 'Scheduled'];

export const CallbackError = StatusError;

const SELECT = `
    SELECT r.*,
           p.name AS patient_name, p.phone AS patient_phone, p.patient_uid, p.blood_group, p.age_years AS patient_age, p.gender AS patient_gender,
           m.name AS for_member_name, m.relation_to_hof AS for_member_relation, m.age_years AS for_member_age, m.gender AS for_member_gender,
           h.name AS hospital_name, h.contact_phone AS hospital_phone,
           ha.name AS handled_by_name
    FROM hospital_callback_requests r
    JOIN patients p ON p.id = r.patient_id
    LEFT JOIN family_members m ON m.id = r.for_member_id
    LEFT JOIN hospitals h ON h.id = r.hospital_id
    LEFT JOIN hospital_admins ha ON ha.id = r.handled_by_admin_id
`;

@Injectable()
export class HospitalCallbackModel {
    static readonly CallbackError = StatusError;
    static readonly CHANNELS = CHANNELS;
    static readonly DEPARTMENTS = DEPARTMENTS;
    static readonly REASONS = REASONS;

    constructor(
        private readonly database: DatabaseService,
        private readonly patientFamily: PatientFamilyModel,
    ) {}

    private get db() {
        return this.database.db;
    }

    private async getOne(id: unknown): Promise<Row | null> {
        return clean(await this.db.queryOne(`${SELECT} WHERE r.id = $1`, Number(id)));
    }

    private patientView(row: Row | null): Row | null {
        if (!row) return null;
        const { id, status, channel, department, created_at, for_member_name, preferred_time, scheduled_for, patient_confirmation } = row;
        return { id, status, channel, department, created_at, for_member_name, preferred_time, scheduled_for, patient_confirmation };
    }

    private async audit(role: string, actor: number, action: string, id: number): Promise<void> {
        await this.db.execute(
            `INSERT INTO portal_privacy_audit (actor_role, actor_id, action, resource_type, resource_id, created_at)
             VALUES ($1, $2, $3, 'hospital_request', $4, $5)`,
            role,
            Number(actor),
            action,
            Number(id),
            BigInt(Date.now()),
        );
    }

    async getHospitalForPatient(patient: Row): Promise<Row | null> {
        const h = await this.db.queryOne(
            `SELECT id, name, code, type, city, district, state, contact_phone, contact_email
             FROM hospitals WHERE id = COALESCE($1, 1)`,
            patient.hospital_id ? Number(patient.hospital_id) : null,
        );
        return clean(h);
    }

    async create(patient: Row, { channel = 'Callback', department, reason, message, preferred_time, for_member_id }: Record<string, any> = {}): Promise<Row | null> {
        const p = await this.patientFamily.ensureFamily(patient.id);
        if (!CHANNELS.includes(channel)) throw new StatusError(`Channel must be one of: ${CHANNELS.join(', ')}`);
        const dept = DEPARTMENTS.includes(department) ? department : 'General Medicine';
        const why = REASONS.includes(reason) ? reason : 'Other';

        let memberId = p.family_member_id;
        if (for_member_id) {
            const m = await this.db.queryOne('SELECT id, family_id FROM family_members WHERE id = $1', Number(for_member_id));
            if (!m || Number(m.family_id) !== Number(p.family_id)) throw new StatusError('You can only request for members of your own family.', 403);
            if (p.family_role !== 'Head' && Number(m.id) !== Number(p.family_member_id)) throw new StatusError('Only the head of the family can request for other members.', 403);
            memberId = m.id;
        }

        const openRow = await this.db.queryOne(
            `SELECT COUNT(*) AS n FROM hospital_callback_requests WHERE patient_id = $1 AND status IN ('Open','Acknowledged','Scheduled')`,
            Number(p.id),
        );
        if ((openRow?.n || 0) >= 5) throw new StatusError('You already have 5 open requests. Please wait for the hospital to respond.', 429);

        const hospital = await this.getHospitalForPatient(p);
        const info = await this.db.insert(
            `INSERT INTO hospital_callback_requests (patient_id, hospital_id, for_member_id, channel, department, reason, message, preferred_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            Number(p.id),
            hospital ? Number(hospital.id) : null,
            memberId ? Number(memberId) : null,
            channel,
            dept,
            why,
            message ? String(message).trim().slice(0, 1000) : null,
            preferred_time ? String(preferred_time).trim().slice(0, 80) : null,
        );
        await this.audit('patient', p.id, 'request_created', info.lastInsertRowid);
        return this.patientView(await this.getOne(info.lastInsertRowid));
    }

    async listForPatient(patientId: unknown): Promise<Row[]> {
        const rows = await this.db.queryAll(`${SELECT} WHERE r.patient_id = $1 ORDER BY r.created_at DESC, r.id DESC`, Number(patientId));
        return cleanList(rows).map((row) => this.patientView(row)!);
    }

    async cancel(requestId: unknown, patientId: unknown): Promise<Row | null> {
        const rid = Number(requestId);
        const pid = Number(patientId);
        const r = await this.db.queryOne('SELECT * FROM hospital_callback_requests WHERE id = $1 AND patient_id = $2', rid, pid);
        if (!r) throw new StatusError('Request not found', 404);
        if (!OPEN.includes(r.status)) throw new StatusError(`Request is already ${r.status}`);
        await this.db.execute(`UPDATE hospital_callback_requests SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, rid);
        await this.audit('patient', pid, 'request_status_changed', rid);
        return this.patientView(await this.getOne(rid));
    }

    async confirm(requestId: unknown, patientId: unknown, confirmed: boolean): Promise<Row | null> {
        const rid = Number(requestId);
        const pid = Number(patientId);
        const r = await this.db.queryOne('SELECT * FROM hospital_callback_requests WHERE id = $1 AND patient_id = $2', rid, pid);
        if (!r) throw new StatusError('Request not found', 404);
        if (r.status !== 'Resolved') throw new StatusError('You can confirm only after the hospital marks it resolved');
        await this.db.execute(
            `UPDATE hospital_callback_requests SET patient_confirmation = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            confirmed ? 'Confirmed' : 'Disputed',
            rid,
        );
        if (!confirmed) {
            await this.db.execute(`UPDATE hospital_callback_requests SET status = 'Open', resolved_at = NULL WHERE id = $1`, rid);
        }
        await this.audit('patient', pid, 'request_status_changed', rid);
        return this.patientView(await this.getOne(rid));
    }

    async listForHospital(hospitalId: unknown, status: any): Promise<Row[]> {
        const params: any[] = [Number(hospitalId)];
        let where = 'r.hospital_id = $1';
        if (status && status !== 'All') {
            if (status === 'Active') where += ` AND r.status IN ('Open','Acknowledged','Scheduled')`;
            else {
                params.push(status);
                where += ` AND r.status = $${params.length}`;
            }
        }
        const rows = await this.db.queryAll(
            `${SELECT} WHERE ${where}
             ORDER BY CASE r.status WHEN 'Open' THEN 0 WHEN 'Acknowledged' THEN 1 WHEN 'Scheduled' THEN 2 ELSE 3 END, r.created_at DESC`,
            ...params,
        );
        return cleanList(rows);
    }

    async updateByHospital(requestId: unknown, admin: Row, { status, note, scheduled_for }: Record<string, any> = {}): Promise<Row | null> {
        const rid = Number(requestId);
        if (!HOSPITAL_STATUSES.includes(status)) throw new StatusError(`Status must be one of: ${HOSPITAL_STATUSES.join(', ')}`);
        const r = await this.db.queryOne(
            'SELECT * FROM hospital_callback_requests WHERE id = $1 AND hospital_id = $2',
            rid,
            Number(admin.hospital_id),
        );
        if (!r) throw new StatusError('Request not found for this hospital', 404);
        if (r.status === 'Cancelled') throw new StatusError('The patient cancelled this request');
        if (status === 'Scheduled' && !scheduled_for) throw new StatusError('Please give the appointment date/time (scheduled_for).');

        await this.db.execute(
            `UPDATE hospital_callback_requests
             SET status = $1, hospital_note = COALESCE($2, hospital_note), scheduled_for = COALESCE($3, scheduled_for),
                 handled_by_admin_id = $4, updated_at = CURRENT_TIMESTAMP,
                 resolved_at = CASE WHEN $5 = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                 patient_confirmation = CASE WHEN $6 = 'Resolved' THEN NULL ELSE patient_confirmation END
             WHERE id = $7`,
            status,
            note ? String(note).trim().slice(0, 500) : null,
            scheduled_for ? String(scheduled_for).trim().slice(0, 80) : null,
            Number(admin.id),
            status,
            status,
            rid,
        );
        await this.audit('hospital', admin.id, 'appointment_updated', rid);
        return this.getOne(rid);
    }
}
