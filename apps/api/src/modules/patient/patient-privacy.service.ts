import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Db } from '../../database/db.types';
import type { Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

export function isMinor(member: Row): boolean {
    if (!member.date_of_birth) return false; // Unknown age is never proof of guardianship.
    const birth = new Date(member.date_of_birth);
    if (!Number.isFinite(birth.getTime()) || birth > new Date()) return false;
    const adulthood = new Date(birth);
    adulthood.setFullYear(adulthood.getFullYear() + 18);
    return new Date() < adulthood;
}

export function canReadMember(db: Db, patient: Row, member: Row): boolean {
    if (patient.family_member_id === member.id) return true;
    if (patient.family_id !== member.family_id) return false;
    const grants = db.prepare(`SELECT * FROM patient_record_access
        WHERE member_id = ? AND grantee_patient_id = ? AND status = 'Approved' AND expires_at > ?`)
        .all(member.id, patient.id, Date.now());
    return grants.some((grant) => grant.kind === 'guardian' ? !!(grant.reviewed_by && grant.reviewed_at && isMinor(member))
        : db.prepare('SELECT id FROM patients WHERE id = ? AND family_member_id = ? AND family_id = ? AND status = ?')
            .get(grant.owner_patient_id, member.id, member.family_id, 'Active'));
}

@Injectable()
export class PatientPrivacyService {
    constructor(private readonly database: DatabaseService) {}
    private get db() { return this.database.db; }
    audit(role: string, actor: number, action: string, resource: string, id?: number) {
        this.db.prepare(`INSERT INTO portal_privacy_audit (actor_role, actor_id, action, resource_type, resource_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`).run(role, actor, action, resource, id || null, Date.now());
    }
    overview(patient: Row) {
        const member = this.db.prepare('SELECT id, sbp, rbs, hb, height_m FROM family_members WHERE id = ?').get(patient.family_member_id);
        const next = member && this.db.prepare(`SELECT next_visit_date FROM follow_ups
            WHERE member_id = ? AND next_visit_date >= date('now') ORDER BY next_visit_date LIMIT 1`).get(member.id);
        const visit = member && this.db.prepare('SELECT id FROM follow_ups WHERE member_id = ? LIMIT 1').get(member.id);
        return { record_available: !!(member && (member.sbp || member.rbs || member.hb || member.height_m || visit)), next_visit_date: next?.next_visit_date || null };
    }
    access(patient: Row) {
        return this.db.prepare(`SELECT a.id, a.member_id, a.grantee_patient_id, a.kind, a.status, a.relationship, a.expires_at,
            p.name AS grantee_name, m.name AS member_name
            FROM patient_record_access a JOIN patients p ON p.id = a.grantee_patient_id
            JOIN family_members m ON m.id = a.member_id
            WHERE a.owner_patient_id = ? OR a.grantee_patient_id = ? ORDER BY a.id DESC`).all(patient.id, patient.id);
    }
    grant(patient: Row, body: Row) {
        const member = this.db.prepare('SELECT * FROM family_members WHERE id = ?').get(patient.family_member_id);
        const target = this.db.prepare('SELECT id FROM patients WHERE id = ? AND family_id = ? AND status = ?')
            .get(Number(body.grantee_patient_id), patient.family_id, 'Active');
        if (!member || isMinor(member) || !member.date_of_birth) throw new StatusError('Adult identity must be verified before sharing records.', 403);
        if (!target || target.id === patient.id || body.consent !== true) throw new StatusError('Choose a family account and explicitly confirm consent.', 400);
        const now = Date.now();
        const result = this.db.prepare(`INSERT INTO patient_record_access
            (member_id, grantee_patient_id, owner_patient_id, kind, status, expires_at, created_at)
            VALUES (?, ?, ?, 'consent', 'Approved', ?, ?)`).run(member.id, target.id, patient.id, now + 30 * 86400000, now);
        this.audit('patient', patient.id, 'consent_granted', 'record_access', Number(result.lastInsertRowid));
        return this.access(patient);
    }
    revoke(patient: Row, id: number) {
        const access = this.db.prepare('SELECT * FROM patient_record_access WHERE id = ?').get(id);
        if (!access || (access.owner_patient_id !== patient.id && access.grantee_patient_id !== patient.id)) throw new StatusError('Access permission not found.', 404);
        this.db.prepare("UPDATE patient_record_access SET status = 'Revoked' WHERE id = ?").run(id);
        this.audit('patient', patient.id, 'consent_revoked', 'record_access', id);
        return this.access(patient);
    }
    requestGuardian(patient: Row, memberId: number, body: Row) {
        const member = this.db.prepare('SELECT * FROM family_members WHERE id = ? AND family_id = ?').get(memberId, patient.family_id);
        if (!member || !isMinor(member) || patient.family_member_id === memberId) throw new StatusError('A verified date of birth and a child in your family are required.', 403);
        const relationship = String(body.relationship || '').trim();
        if (!relationship || relationship.length > 80 || body.confirm !== true) throw new StatusError('Confirm your guardian relationship for staff verification.');
        const existing = this.db.prepare("SELECT id FROM patient_record_access WHERE member_id = ? AND grantee_patient_id = ? AND status IN ('Pending','Approved') AND expires_at > ?").get(memberId, patient.id, Date.now());
        if (existing) throw new StatusError('A guardian request is already pending or approved.', 409);
        const result = this.db.prepare(`INSERT INTO patient_record_access
            (member_id, grantee_patient_id, kind, status, relationship, expires_at, created_at)
            VALUES (?, ?, 'guardian', 'Pending', ?, ?, ?)`).run(memberId, patient.id, relationship, Date.now() + 30 * 86400000, Date.now());
        this.audit('patient', patient.id, 'guardian_requested', 'record_access', Number(result.lastInsertRowid));
        return { status: 'Pending' };
    }
    corrections(patient: Row) {
        return this.db.prepare('SELECT id, member_id, record_type, record_id, status, created_at FROM patient_record_corrections WHERE patient_id = ? ORDER BY id DESC').all(patient.id);
    }
    requestCorrection(patient: Row, body: Row) {
        const memberId = Number(body.member_id || patient.family_member_id);
        const member = this.db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
        if (!member || !canReadMember(this.db, patient, member)) throw new StatusError('Record access is not authorized.', 403);
        const tables: Record<string, string> = { medication: 'member_medications', condition: 'member_conditions', allergy: 'member_allergies', visit: 'follow_ups', measurement: 'family_members' };
        const type = String(body.record_type || 'measurement');
        const recordId = Number(body.record_id || memberId);
        if (!tables[type]) throw new StatusError('Choose a valid record type.');
        const record = this.db.prepare(`SELECT id FROM ${tables[type]} WHERE id = ? AND ${type === 'measurement' ? 'id' : 'member_id'} = ?`).get(recordId, memberId);
        if (!record) throw new StatusError('Record not found.', 404);
        const message = String(body.message || '').trim();
        if (message.length < 5 || message.length > 1000) throw new StatusError('Explain the correction in 5 to 1000 characters.');
        const hospital = this.db.prepare('SELECT hospital_id FROM patients WHERE family_member_id = ? ORDER BY id LIMIT 1').get(memberId);
        const result = this.db.prepare(`INSERT INTO patient_record_corrections (patient_id, member_id, hospital_id, record_type, record_id, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(patient.id, memberId, hospital?.hospital_id || 1, type, recordId, message, Date.now());
        this.audit('patient', patient.id, 'correction_requested', 'correction', Number(result.lastInsertRowid));
        return { id: Number(result.lastInsertRowid), status: 'Pending' };
    }
    staffQueue(hospitalId: number) {
        return {
            guardian_requests: this.db.prepare(`SELECT a.*, m.name AS member_name, p.name AS requester_name FROM patient_record_access a
                JOIN family_members m ON m.id = a.member_id JOIN patients p ON p.id = a.grantee_patient_id
                WHERE a.kind = 'guardian' AND a.status = 'Pending' AND COALESCE(
                    (SELECT hospital_id FROM patients owner WHERE owner.family_member_id = a.member_id ORDER BY owner.id LIMIT 1), 1) = ?`).all(hospitalId),
            corrections: this.db.prepare(`SELECT c.*, m.name AS member_name FROM patient_record_corrections c
                JOIN family_members m ON m.id = c.member_id JOIN patients p ON p.id = c.patient_id
                WHERE c.hospital_id = ? AND c.status = 'Pending'`).all(hospitalId),
        };
    }
    review(admin: Row, kind: string, id: number, body: Row) {
        if (!['Hospital Super Admin', 'Hospital Admin'].includes(admin.role)) throw new StatusError('An authorized hospital administrator must review this request.', 403);
        if (!['guardian', 'correction'].includes(kind)) throw new StatusError('Invalid request type.');
        if (kind === 'guardian') {
            const row = this.db.prepare(`SELECT a.*, m.date_of_birth FROM patient_record_access a
                JOIN patients p ON p.id = a.grantee_patient_id JOIN family_members m ON m.id = a.member_id
                WHERE a.id = ? AND a.kind = 'guardian' AND COALESCE(
                    (SELECT hospital_id FROM patients owner WHERE owner.family_member_id = a.member_id ORDER BY owner.id LIMIT 1), 1) = ?
                    AND a.status = 'Pending'`).get(id, admin.hospital_id);
            if (!row) throw new StatusError('Request not found.', 404);
            if (!['Approved', 'Rejected'].includes(body.status) || (body.status === 'Approved' && (body.verified !== true || !isMinor(row)))) throw new StatusError('Verify guardianship and the child’s date of birth before approval.');
            this.db.prepare('UPDATE patient_record_access SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(body.status, admin.id, Date.now(), id);
        } else {
            const row = this.db.prepare(`SELECT c.id FROM patient_record_corrections c JOIN patients p ON p.id = c.patient_id
                WHERE c.id = ? AND c.hospital_id = ? AND c.status = 'Pending'`).get(id, admin.hospital_id);
            if (!row) throw new StatusError('Request not found.', 404);
            if (!['Reviewed', 'Rejected'].includes(body.status)) throw new StatusError('Choose Reviewed or Rejected. Apply any verified correction through the clinical workflow.');
            this.db.prepare('UPDATE patient_record_corrections SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(body.status, admin.id, Date.now(), id);
        }
        this.audit('hospital', admin.id, 'privacy_request_reviewed', kind, id);
        return { success: true };
    }
}
