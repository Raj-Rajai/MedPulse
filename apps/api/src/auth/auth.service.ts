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

    authenticateStudent(req: Request): void {
        const id = this.sessions.resolve(req, 'student');
        const student = this.db.prepare(`${STUDENT_SELECT} WHERE s.id = ?`).get(id);
        if (!student || student.status === 'Inactive') throw fail(401, 'Student account unavailable.');
        req.student = publicIdentity(clean(student)!);
        req.studentId = student.id;
        req.rollNumber = student.roll_number;
    }

    authenticateAdmin(req: Request): void {
        const id = this.sessions.resolve(req, 'admin');
        const admin = this.db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
        if (!admin || admin.status === 'Inactive') throw fail(401, 'Admin account unavailable.');
        req.admin = publicIdentity(clean(admin)!);
        req.adminId = admin.id;
    }

    authenticatePatient(req: Request): void {
        const id = this.sessions.resolve(req, 'patient');
        const patient = this.db.prepare(`${PATIENT_SELECT} WHERE p.id = ? AND p.status = 'Active'`).get(id);
        if (!patient) throw fail(401, 'Patient account unavailable.');
        req.patient = publicIdentity(clean(patient)!);
        req.patientId = patient.id;
    }

    authenticateHospitalAdmin(req: Request): void {
        const id = this.sessions.resolve(req, 'hospital');
        const admin = this.db.prepare(`
            SELECT ha.*, h.name AS hospital_name, h.code AS hospital_code, h.type AS hospital_type,
                   h.city AS hospital_city, h.bed_capacity, h.max_super_admins, h.max_admins
            FROM hospital_admins ha JOIN hospitals h ON ha.hospital_id = h.id
            WHERE ha.id = ? AND ha.status = 'Active'
        `).get(id);
        if (!admin) throw fail(401, 'Hospital account unavailable.');
        req.hospitalAdmin = publicIdentity(clean(admin)!);
        req.hospitalId = admin.hospital_id;
    }

    /* ---------------- Resource multi-tenant scoping verifiers ---------------- */

    verifyFamilyAccess(familyId: unknown, studentId: number): Row | undefined {
        return this.db.prepare('SELECT id, student_id FROM families WHERE id = ? AND student_id = ?').get(familyId, studentId);
    }

    verifyMemberAccess(memberId: unknown, studentId: number): Row | undefined {
        return this.db.prepare(`
        SELECT m.id, f.student_id 
        FROM family_members m 
        JOIN families f ON m.family_id = f.id 
        WHERE m.id = ? AND f.student_id = ?
    `).get(memberId, studentId);
    }

    verifySubEntityAccess(table: string, id: unknown, studentId: number): Row | undefined {
        return this.db.prepare(`
        SELECT t.id, f.student_id 
        FROM ${table} t 
        JOIN family_members m ON t.member_id = m.id 
        JOIN families f ON m.family_id = f.id 
        WHERE t.id = ? AND f.student_id = ?
    `).get(id, studentId);
    }

    verifyFollowUpAccess(fuId: unknown, studentId: number): Row | undefined {
        return this.db.prepare(`
        SELECT fu.id, f.student_id 
        FROM follow_ups fu 
        JOIN family_members m ON fu.member_id = m.id 
        JOIN families f ON m.family_id = f.id 
        WHERE fu.id = ? AND (f.student_id = ? OR fu.student_id = ?)
    `).get(fuId, studentId, studentId);
    }
}
