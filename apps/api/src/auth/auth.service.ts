import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { clean, Row } from '../common/row';
import { fail } from '../common/http-error';
import { PortalSessionService, publicIdentity } from './portal-session.service';

const STUDENT_SELECT = 'SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id';
const PATIENT_SELECT = `
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id`;

const ALLOWED_SUB_TABLES = new Set([
    'member_conditions',
    'member_medications',
    'member_allergies',
    'member_medical_history',
    'member_lifestyle',
    'health_conditions',
    'medications',
    'allergies',
    'clinical_history',
    'lifestyle_habits',
    'follow_up_visits',
]);

/**
 * Identity resolution for the four portals plus the multi-tenant access checks.
 * Identity is resolved exclusively from an opaque, expiring server session.
 * Each authenticate* method throws the original 401 body or attaches the identity to `req`.
 */
@Injectable()
export class AuthService {
    constructor(private readonly database: DatabaseService, private readonly sessions: PortalSessionService) {}

    private get db() {
        return this.database.db;
    }

    async authenticateStudent(req: Request): Promise<void> {
        const id = await this.sessions.resolve(req, 'student');
        const student = await this.db.queryOne(`${STUDENT_SELECT} WHERE s.id = $1`, Number(id));
        if (!student || student.status === 'Inactive') throw fail(401, 'Student account unavailable.');
        req.student = publicIdentity(clean(student)!);
        req.studentId = student.id;
        req.rollNumber = student.roll_number;
    }

    async authenticateAdmin(req: Request): Promise<void> {
        const id = await this.sessions.resolve(req, 'admin');
        const admin = await this.db.queryOne('SELECT * FROM admins WHERE id = $1', Number(id));
        if (!admin || admin.status === 'Inactive') throw fail(401, 'Admin account unavailable.');
        req.admin = publicIdentity(clean(admin)!);
        req.adminId = admin.id;
    }

    async authenticatePatient(req: Request): Promise<void> {
        const id = await this.sessions.resolve(req, 'patient');
        const patient = await this.db.queryOne(`${PATIENT_SELECT} WHERE p.id = $1 AND p.status = 'Active'`, Number(id));
        if (!patient) throw fail(401, 'Patient account unavailable.');
        req.patient = publicIdentity(clean(patient)!);
        req.patientId = patient.id;
    }

    async authenticateHospitalAdmin(req: Request): Promise<void> {
        const id = await this.sessions.resolve(req, 'hospital');
        const admin = await this.db.queryOne(`
            SELECT ha.*, h.name AS hospital_name, h.code AS hospital_code, h.type AS hospital_type,
                   h.city AS hospital_city, h.bed_capacity, h.max_super_admins, h.max_admins
            FROM hospital_admins ha JOIN hospitals h ON ha.hospital_id = h.id
            WHERE ha.id = $1 AND ha.status = 'Active'
        `, Number(id));
        if (!admin) throw fail(401, 'Hospital account unavailable.');
        req.hospitalAdmin = publicIdentity(clean(admin)!);
        req.hospitalId = admin.hospital_id;
    }

    /* ---------------- Resource multi-tenant scoping verifiers ---------------- */

    async verifyFamilyAccess(familyId: unknown, studentId: number): Promise<Row | undefined> {
        return this.db.queryOne('SELECT id, student_id FROM families WHERE id = $1 AND student_id = $2', Number(familyId), Number(studentId));
    }

    async verifyMemberAccess(memberId: unknown, studentId: number): Promise<Row | undefined> {
        return this.db.queryOne(`
        SELECT m.id, f.student_id
        FROM family_members m
        JOIN families f ON m.family_id = f.id
        WHERE m.id = $1 AND f.student_id = $2
    `, Number(memberId), Number(studentId));
    }

    async verifySubEntityAccess(table: string, id: unknown, studentId: number): Promise<Row | undefined> {
        if (!ALLOWED_SUB_TABLES.has(table)) {
            throw fail(400, `Unsupported table: ${table}`);
        }
        return this.db.queryOne(`
        SELECT t.id, f.student_id
        FROM "${table}" t
        JOIN family_members m ON t.member_id = m.id
        JOIN families f ON m.family_id = f.id
        WHERE t.id = $1 AND f.student_id = $2
    `, Number(id), Number(studentId));
    }

    async verifyFollowUpAccess(fuId: unknown, studentId: number): Promise<Row | undefined> {
        return this.db.queryOne(`
        SELECT fu.id, f.student_id
        FROM follow_ups fu
        JOIN family_members m ON fu.member_id = m.id
        JOIN families f ON m.family_id = f.id
        WHERE fu.id = $1 AND (f.student_id = $2 OR fu.student_id = $3)
    `, Number(fuId), Number(studentId), Number(studentId));
    }
}
