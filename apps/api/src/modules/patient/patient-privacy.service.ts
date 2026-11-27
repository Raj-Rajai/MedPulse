import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Db } from '../../database/db.types';
import type { Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

export function isMinor(member: Row): boolean {
    if (!member.date_of_birth) return false;
    const birth = new Date(member.date_of_birth);
    if (!Number.isFinite(birth.getTime()) || birth > new Date()) return false;
    const adulthood = new Date(birth);
    adulthood.setFullYear(adulthood.getFullYear() + 18);
    return new Date() < adulthood;
}

export async function canReadMember(db: Db, patient: Row, member: Row): Promise<boolean> {
    if (Number(patient.family_member_id) === Number(member.id)) return true;
    if (Number(patient.family_id) !== Number(member.family_id)) return false;
    const grants = await db.queryAll(
        `SELECT * FROM patient_record_access
         WHERE member_id = $1 AND grantee_patient_id = $2 AND status = 'Approved' AND expires_at > $3`,
        Number(member.id),
        Number(patient.id),
        BigInt(Date.now()),
    );
    for (const grant of grants) {
        if (grant.kind === 'guardian') {
            if (grant.reviewed_by && grant.reviewed_at && isMinor(member)) return true;
        } else {
            const owner = await db.queryOne(
                'SELECT id FROM patients WHERE id = $1 AND family_member_id = $2 AND family_id = $3 AND status = $4',
                Number(grant.owner_patient_id),
                Number(member.id),
                Number(member.family_id),
                'Active',
            );
            if (owner) return true;
        }
    }
    return false;
}

@Injectable()
export class PatientPrivacyService {
    constructor(private readonly database: DatabaseService) {}
    private get db() {
        return this.database.db;
    }

    async audit(role: string, actor: number, action: string, resource: string, id?: number): Promise<void> {
        await this.db.execute(
            `INSERT INTO portal_privacy_audit (actor_role, actor_id, action, resource_type, resource_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            role,
            Number(actor),
            action,
            resource,
            id ? Number(id) : null,
            BigInt(Date.now()),
        );
    }

    async overview(patient: Row) {
        const member = patient.family_member_id
            ? await this.db.queryOne('SELECT id, sbp, rbs, hb, height_m FROM family_members WHERE id = $1', Number(patient.family_member_id))
            : null;
        const next = member
            ? await this.db.queryOne(
                `SELECT next_visit_date FROM follow_ups
                 WHERE member_id = $1 AND next_visit_date >= to_char(CURRENT_DATE, 'YYYY-MM-DD')
                 ORDER BY next_visit_date LIMIT 1`,
                Number(member.id),
            )
            : null;
        const visit = member
            ? await this.db.queryOne('SELECT id FROM follow_ups WHERE member_id = $1 LIMIT 1', Number(member.id))
            : null;
        return {
            record_available: !!(member && (member.sbp || member.rbs || member.hb || member.height_m || visit)),
            next_visit_date: next?.next_visit_date || null,
        };
    }

    async access(patient: Row) {
        return this.db.queryAll(
            `SELECT a.id, a.member_id, a.grantee_patient_id, a.kind, a.status, a.relationship, a.expires_at,
                    p.name AS grantee_name, m.name AS member_name
             FROM patient_record_access a
             JOIN patients p ON p.id = a.grantee_patient_id
             JOIN family_members m ON m.id = a.member_id
             WHERE a.owner_patient_id = $1 OR a.grantee_patient_id = $2
             ORDER BY a.id DESC`,
            Number(patient.id),
            Number(patient.id),
        );
    }

    async grant(patient: Row, body: Row) {
        const member = patient.family_member_id
            ? await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', Number(patient.family_member_id))
            : null;
        const target = await this.db.queryOne(
            'SELECT id FROM patients WHERE id = $1 AND family_id = $2 AND status = $3',
            Number(body.grantee_patient_id),
            Number(patient.family_id),
            'Active',
        );
        if (!member || isMinor(member) || !member.date_of_birth) {
            throw new StatusError('Adult identity must be verified before sharing records.', 403);
        }
        if (!target || Number(target.id) === Number(patient.id) || body.consent !== true) {
            throw new StatusError('Choose a family account and explicitly confirm consent.', 400);
        }
        const now = BigInt(Date.now());
        const result = await this.db.insert(
            `INSERT INTO patient_record_access
             (member_id, grantee_patient_id, owner_patient_id, kind, status, expires_at, created_at)
             VALUES ($1, $2, $3, 'consent', 'Approved', $4, $5)`,
            Number(member.id),
            Number(target.id),
            Number(patient.id),
            now + BigInt(30 * 86400000),
            now,
        );
        await this.audit('patient', patient.id, 'consent_granted', 'record_access', result.lastInsertRowid);
        return this.access(patient);
    }

    async revoke(patient: Row, id: number) {
        const access = await this.db.queryOne('SELECT * FROM patient_record_access WHERE id = $1', Number(id));
        if (!access || (Number(access.owner_patient_id) !== Number(patient.id) && Number(access.grantee_patient_id) !== Number(patient.id))) {
            throw new StatusError('Access permission not found.', 404);
        }
        await this.db.execute("UPDATE patient_record_access SET status = 'Revoked' WHERE id = $1", Number(id));
        await this.audit('patient', patient.id, 'consent_revoked', 'record_access', id);
        return this.access(patient);
    }

    async requestGuardian(patient: Row, memberId: number, body: Row) {
        const member = await this.db.queryOne(
            'SELECT * FROM family_members WHERE id = $1 AND family_id = $2',
            Number(memberId),
            Number(patient.family_id),
        );
        if (!member || !isMinor(member) || Number(patient.family_member_id) === Number(memberId)) {
            throw new StatusError('A verified date of birth and a child in your family are required.', 403);
        }
        const relationship = String(body.relationship || '').trim();
        if (!relationship || relationship.length > 80 || body.confirm !== true) {
            throw new StatusError('Confirm your guardian relationship for staff verification.');
        }
        const now = BigInt(Date.now());
        const existing = await this.db.queryOne(
            "SELECT id FROM patient_record_access WHERE member_id = $1 AND grantee_patient_id = $2 AND status IN ('Pending','Approved') AND expires_at > $3",
            Number(memberId),
            Number(patient.id),
            now,
        );
        if (existing) throw new StatusError('A guardian request is already pending or approved.', 409);
        const result = await this.db.insert(
            `INSERT INTO patient_record_access
             (member_id, grantee_patient_id, kind, status, relationship, expires_at, created_at)
             VALUES ($1, $2, 'guardian', 'Pending', $3, $4, $5)`,
            Number(memberId),
            Number(patient.id),
            relationship,
            now + BigInt(30 * 86400000),
            now,
        );
        await this.audit('patient', patient.id, 'guardian_requested', 'record_access', result.lastInsertRowid);
        return { status: 'Pending' };
    }

    async corrections(patient: Row) {
        return this.db.queryAll(
            'SELECT id, member_id, record_type, record_id, status, created_at FROM patient_record_corrections WHERE patient_id = $1 ORDER BY id DESC',
            Number(patient.id),
        );
    }

    async requestCorrection(patient: Row, body: Row) {
        const memberId = Number(body.member_id || patient.family_member_id);
        const member = await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', memberId);
        if (!member || !(await canReadMember(this.db, patient, member))) {
            throw new StatusError('Record access is not authorized.', 403);
        }
        const tables: Record<string, string> = {
            medication: 'member_medications',
            condition: 'member_conditions',
            allergy: 'member_allergies',
            visit: 'follow_ups',
            measurement: 'family_members',
        };
        const type = String(body.record_type || 'measurement');
        const recordId = Number(body.record_id || memberId);
        if (!tables[type]) throw new StatusError('Choose a valid record type.');
        const record = await this.db.queryOne(
            `SELECT id FROM "${tables[type]}" WHERE id = $1 AND ${type === 'measurement' ? 'id' : 'member_id'} = $2`,
            recordId,
            memberId,
        );
        if (!record) throw new StatusError('Record not found.', 404);
        const message = String(body.message || '').trim();
        if (message.length < 5 || message.length > 1000) throw new StatusError('Explain the correction in 5 to 1000 characters.');
        const hospital = await this.db.queryOne('SELECT hospital_id FROM patients WHERE family_member_id = $1 ORDER BY id LIMIT 1', memberId);
        const result = await this.db.insert(
            `INSERT INTO patient_record_corrections (patient_id, member_id, hospital_id, record_type, record_id, message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            Number(patient.id),
            memberId,
            Number(hospital?.hospital_id || 1),
            type,
            recordId,
            message,
            BigInt(Date.now()),
        );
        await this.audit('patient', patient.id, 'correction_requested', 'correction', result.lastInsertRowid);
        return { id: result.lastInsertRowid, status: 'Pending' };
    }

    async staffQueue(hospitalId: number) {
        const hid = Number(hospitalId);
        const [guardian_requests, corrections] = await Promise.all([
            this.db.queryAll(
                `SELECT a.*, m.name AS member_name, p.name AS requester_name
                 FROM patient_record_access a
                 JOIN family_members m ON m.id = a.member_id
                 JOIN patients p ON p.id = a.grantee_patient_id
                 WHERE a.kind = 'guardian' AND a.status = 'Pending' AND COALESCE(
                     (SELECT hospital_id FROM patients owner WHERE owner.family_member_id = a.member_id ORDER BY owner.id LIMIT 1), 1) = $1`,
                hid,
            ),
            this.db.queryAll(
                `SELECT c.*, m.name AS member_name
                 FROM patient_record_corrections c
                 JOIN family_members m ON m.id = c.member_id
                 JOIN patients p ON p.id = c.patient_id
                 WHERE c.hospital_id = $1 AND c.status = 'Pending'`,
                hid,
            ),
        ]);
        return { guardian_requests, corrections };
    }

    async review(admin: Row, kind: string, id: number, body: Row) {
        if (!['Hospital Super Admin', 'Hospital Admin'].includes(admin.role)) {
            throw new StatusError('An authorized hospital administrator must review this request.', 403);
        }
        if (!['guardian', 'correction'].includes(kind)) throw new StatusError('Invalid request type.');
        if (kind === 'guardian') {
            const row = await this.db.queryOne(
                `SELECT a.*, m.date_of_birth FROM patient_record_access a
                 JOIN patients p ON p.id = a.grantee_patient_id JOIN family_members m ON m.id = a.member_id
                 WHERE a.id = $1 AND a.kind = 'guardian' AND COALESCE(
                     (SELECT hospital_id FROM patients owner WHERE owner.family_member_id = a.member_id ORDER BY owner.id LIMIT 1), 1) = $2
                     AND a.status = 'Pending'`,
                Number(id),
                Number(admin.hospital_id),
            );
            if (!row) throw new StatusError('Request not found.', 404);
            if (!['Approved', 'Rejected'].includes(body.status) || (body.status === 'Approved' && (body.verified !== true || !isMinor(row)))) {
                throw new StatusError('Verify guardianship and the child’s date of birth before approval.');
            }
            await this.db.execute(
                'UPDATE patient_record_access SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4',
                body.status,
                Number(admin.id),
                BigInt(Date.now()),
                Number(id),
            );
        } else {
            const row = await this.db.queryOne(
                `SELECT c.id FROM patient_record_corrections c JOIN patients p ON p.id = c.patient_id
                 WHERE c.id = $1 AND c.hospital_id = $2 AND c.status = 'Pending'`,
                Number(id),
                Number(admin.hospital_id),
            );
            if (!row) throw new StatusError('Request not found.', 404);
            if (!['Reviewed', 'Rejected'].includes(body.status)) {
                throw new StatusError('Choose Reviewed or Rejected. Apply any verified correction through the clinical workflow.');
            }
            await this.db.execute(
                'UPDATE patient_record_corrections SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4',
                body.status,
                Number(admin.id),
                BigInt(Date.now()),
                Number(id),
            );
        }
        await this.audit('hospital', admin.id, 'privacy_request_reviewed', kind, id);
        return { success: true };
    }
}
