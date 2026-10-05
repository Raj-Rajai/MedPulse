/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';
import { PatientFamilyModel } from './patient-family.model';

/**
 * CRM: Patient -> Hospital callback requests.
 *
 * CRM owns the table and both sides of the API:
 *   - Patient side:  /api/patient/hospital-requests...
 *   - HMS contract:  /api/crm/hospital/callback-requests...  (hospital admins; the HMS team renders these)
 * See docs/api-contract.md.
 */

export const CHANNELS = ['Callback', 'WhatsApp'];
export const DEPARTMENTS = ['General Medicine', 'Cardiology (Heart / BP)', 'Diabetes & Endocrine', 'Paediatrics (Children)',
    'Obstetrics & Gynaecology', 'Orthopaedics (Bones)', 'ENT', 'Eye', 'Dental', 'Skin', 'Not sure'];
export const REASONS = ['Book appointment', 'Doctor consultation', 'Test report', 'Medicine query', 'New symptom', 'Follow-up visit', 'Other'];
export const HOSPITAL_STATUSES = ['Acknowledged', 'Scheduled', 'Resolved'];
const OPEN = ['Open', 'Acknowledged', 'Scheduled'];

/** The original `CallbackError(message, status = 400)`. */
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

    private getOne(id: unknown): Row | null {
        return clean(this.db.prepare(`${SELECT} WHERE r.id = ?`).get(id));
    }

    getHospitalForPatient(patient: Row): Row | null {
        const h = this.db.prepare(`
            SELECT id, name, code, type, city, district, state, contact_phone, contact_email
            FROM hospitals WHERE id = COALESCE(?, 1)
        `).get(patient.hospital_id || null);
        return clean(h);
    }

    /* ---------------- Patient side ---------------- */

    create(patient: Row, { channel = 'Callback', department, reason, message, preferred_time, for_member_id }: Record<string, any> = {}): Row | null {
        const p = this.patientFamily.ensureFamily(patient.id);
        if (!CHANNELS.includes(channel)) throw new StatusError(`Channel must be one of: ${CHANNELS.join(', ')}`);
        const dept = DEPARTMENTS.includes(department) ? department : 'General Medicine';
        const why = REASONS.includes(reason) ? reason : 'Other';

        let memberId = p.family_member_id;
        if (for_member_id) {
            const m = this.db.prepare('SELECT id, family_id FROM family_members WHERE id = ?').get(for_member_id);
            if (!m || m.family_id !== p.family_id) throw new StatusError('You can only request for members of your own family.', 403);
            if (p.family_role !== 'Head' && m.id !== p.family_member_id) throw new StatusError('Only the head of the family can request for other members.', 403);
            memberId = m.id;
        }

        const open = this.db.prepare(`SELECT COUNT(*) AS n FROM hospital_callback_requests WHERE patient_id = ? AND status IN ('Open','Acknowledged','Scheduled')`).get(p.id)!.n;
        if (open >= 5) throw new StatusError('You already have 5 open requests. Please wait for the hospital to respond.', 429);

        const hospital = this.getHospitalForPatient(p);
        const info = this.db.prepare(`
            INSERT INTO hospital_callback_requests (patient_id, hospital_id, for_member_id, channel, department, reason, message, preferred_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(p.id, hospital ? hospital.id : null, memberId, channel, dept, why,
            message ? String(message).trim().slice(0, 1000) : null,
            preferred_time ? String(preferred_time).trim().slice(0, 80) : null);
        return this.getOne(Number(info.lastInsertRowid));
    }

    listForPatient(patientId: unknown): Row[] {
        return cleanList(this.db.prepare(`${SELECT} WHERE r.patient_id = ? ORDER BY r.created_at DESC, r.id DESC`).all(patientId));
    }

    cancel(requestId: unknown, patientId: unknown): Row | null {
        const r = this.db.prepare('SELECT * FROM hospital_callback_requests WHERE id = ? AND patient_id = ?').get(requestId, patientId);
        if (!r) throw new StatusError('Request not found', 404);
        if (!OPEN.includes(r.status)) throw new StatusError(`Request is already ${r.status}`);
        this.db.prepare(`UPDATE hospital_callback_requests SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
        return this.getOne(requestId);
    }

    confirm(requestId: unknown, patientId: unknown, confirmed: boolean): Row | null {
        const r = this.db.prepare('SELECT * FROM hospital_callback_requests WHERE id = ? AND patient_id = ?').get(requestId, patientId);
        if (!r) throw new StatusError('Request not found', 404);
        if (r.status !== 'Resolved') throw new StatusError('You can confirm only after the hospital marks it resolved');
        this.db.prepare(`UPDATE hospital_callback_requests SET patient_confirmation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(confirmed ? 'Confirmed' : 'Disputed', requestId);
        if (!confirmed) {
            this.db.prepare(`UPDATE hospital_callback_requests SET status = 'Open', resolved_at = NULL WHERE id = ?`).run(requestId);
        }
        return this.getOne(requestId);
    }

    /* ---------------- HMS contract (hospital admins) ---------------- */

    listForHospital(hospitalId: unknown, status: any): Row[] {
        const params: any[] = [hospitalId];
        let where = 'r.hospital_id = ?';
        if (status && status !== 'All') {
            if (status === 'Active') where += ` AND r.status IN ('Open','Acknowledged','Scheduled')`;
            else { where += ' AND r.status = ?'; params.push(status); }
        }
        return cleanList(this.db.prepare(`
            ${SELECT} WHERE ${where}
            ORDER BY CASE r.status WHEN 'Open' THEN 0 WHEN 'Acknowledged' THEN 1 WHEN 'Scheduled' THEN 2 ELSE 3 END, r.created_at DESC
        `).all(...params));
    }

    updateByHospital(requestId: unknown, admin: Row, { status, note, scheduled_for }: Record<string, any> = {}): Row | null {
        if (!HOSPITAL_STATUSES.includes(status)) throw new StatusError(`Status must be one of: ${HOSPITAL_STATUSES.join(', ')}`);
        const r = this.db.prepare('SELECT * FROM hospital_callback_requests WHERE id = ? AND hospital_id = ?').get(requestId, admin.hospital_id);
        if (!r) throw new StatusError('Request not found for this hospital', 404);
        if (r.status === 'Cancelled') throw new StatusError('The patient cancelled this request');
        if (status === 'Scheduled' && !scheduled_for) throw new StatusError('Please give the appointment date/time (scheduled_for).');

        this.db.prepare(`
            UPDATE hospital_callback_requests
            SET status = ?, hospital_note = COALESCE(?, hospital_note), scheduled_for = COALESCE(?, scheduled_for),
                handled_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP,
                resolved_at = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                patient_confirmation = CASE WHEN ? = 'Resolved' THEN NULL ELSE patient_confirmation END
            WHERE id = ?
        `).run(status, note ? String(note).trim().slice(0, 500) : null, scheduled_for ? String(scheduled_for).trim().slice(0, 80) : null,
            admin.id, status, status, requestId);
        return this.getOne(requestId);
    }
}
