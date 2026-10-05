import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { clean, Row } from '../common/row';
import { fail } from '../common/http-error';

const STUDENT_SELECT = 'SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id';
const PATIENT_SELECT = `
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id`;

const header = (req: Request, name: string): string | undefined => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
};
const query = (req: Request, name: string): string | undefined => {
    const v = (req.query as Record<string, unknown>)[name];
    return v === undefined ? undefined : String(v);
};

/**
 * Identity resolution for the four portals plus the multi-tenant access checks.
 * Logic and SQL are unchanged from backend/middleware/auth.middleware.js.
 * Each authenticate* method throws the original 401 body or attaches the identity to `req`.
 */
@Injectable()
export class AuthService {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    /** Medical Students / Cadets */
    authenticateStudent(req: Request): void {
        const studentIdHeader = header(req, 'x-student-id');
        const rollHeader = header(req, 'x-roll-number');
        const authHeader = header(req, 'authorization');
        const queryStudentId = query(req, 'student_id');
        const queryRoll = query(req, 'roll_number');

        let student: Row | undefined;

        if (studentIdHeader) {
            student = this.db.prepare(`${STUDENT_SELECT} WHERE s.id = ?`).get(studentIdHeader);
        } else if (rollHeader) {
            student = this.db.prepare(`${STUDENT_SELECT} WHERE s.roll_number = ?`).get(rollHeader.toString().trim());
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            const tokenVal = authHeader.replace('Bearer ', '').trim();
            if (!isNaN(tokenVal as unknown as number)) {
                student = this.db.prepare(`${STUDENT_SELECT} WHERE s.id = ? OR s.roll_number = ?`).get(tokenVal, tokenVal);
            } else {
                student = this.db.prepare(`${STUDENT_SELECT} WHERE s.roll_number = ?`).get(tokenVal);
            }
        } else if (queryStudentId) {
            student = this.db.prepare(`${STUDENT_SELECT} WHERE s.id = ?`).get(queryStudentId);
        } else if (queryRoll) {
            student = this.db.prepare(`${STUDENT_SELECT} WHERE s.roll_number = ?`).get(queryRoll.toString().trim());
        }

        if (!student) {
            throw fail(401, 'Authentication required. Please sign in to access MedPulse.');
        }

        req.student = clean(student)!;
        req.studentId = student.id;
        req.rollNumber = student.roll_number;
    }

    /** University Super Admin & University Admins */
    authenticateAdmin(req: Request): void {
        const adminTokenHeader = header(req, 'x-admin-token');
        const adminIdHeader = header(req, 'x-admin-id');
        const authHeader = header(req, 'authorization');
        const queryToken = query(req, 'admin_token');
        const queryId = query(req, 'admin_id');

        let admin: Row | undefined;

        if (adminIdHeader) {
            admin = this.db.prepare('SELECT * FROM admins WHERE id = ?').get(adminIdHeader);
        } else if (adminTokenHeader) {
            const idFromToken = adminTokenHeader.replace('admin-', '').trim();
            admin = this.db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, adminTokenHeader);
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            const tokenVal = authHeader.replace('Bearer ', '').trim();
            const idFromToken = tokenVal.replace('admin-', '').trim();
            admin = this.db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, tokenVal);
        } else if (queryId) {
            admin = this.db.prepare('SELECT * FROM admins WHERE id = ?').get(queryId);
        } else if (queryToken) {
            const idFromToken = queryToken.replace('admin-', '').trim();
            admin = this.db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, queryToken);
        }

        if (!admin) {
            throw fail(401, 'Administrative authorization required. Please sign in as Faculty / Admin.');
        }

        req.admin = clean(admin)!;
        req.adminId = admin.id;
    }

    /** Patients (Independent & Dependents) */
    authenticatePatient(req: Request): void {
        const patientIdHeader = header(req, 'x-patient-id');
        const authHeader = header(req, 'authorization');
        const queryPatientId = query(req, 'patient_id');

        let patient: Row | undefined;

        if (patientIdHeader) {
            patient = this.db.prepare(`${PATIENT_SELECT}
            WHERE p.id = ?
        `).get(patientIdHeader);
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            const tokenVal = authHeader.replace('Bearer ', '').trim();
            const idFromToken = tokenVal.replace('patient-', '').trim();
            patient = this.db.prepare(`${PATIENT_SELECT}
            WHERE p.id = ? OR p.patient_uid = ?
        `).get(idFromToken, tokenVal);
        } else if (queryPatientId) {
            patient = this.db.prepare(`${PATIENT_SELECT}
            WHERE p.id = ?
        `).get(queryPatientId);
        }

        if (!patient) {
            throw fail(401, 'Patient authentication required. Please sign in to your patient account.');
        }

        req.patient = clean(patient)!;
        req.patientId = patient.id;
    }

    /** Hospital Super Admins & Hospital Admins */
    authenticateHospitalAdmin(req: Request): void {
        const authHeader = header(req, 'authorization');
        const adminId =
            header(req, 'x-hospital-admin-id') ||
            (authHeader && authHeader.startsWith('Bearer hosp-') ? authHeader.replace('Bearer hosp-', '').trim() : null);

        if (!adminId) {
            throw fail(401, 'Hospital authentication required. Please sign in.');
        }

        let admin: Row | undefined;
        try {
            admin = this.db.prepare(`
            SELECT ha.*, h.name as hospital_name, h.code as hospital_code, h.type as hospital_type, 
                   h.city as hospital_city, h.bed_capacity, h.max_super_admins, h.max_admins
            FROM hospital_admins ha
            JOIN hospitals h ON ha.hospital_id = h.id
            WHERE ha.id = ? AND ha.status = 'Active'
        `).get(adminId);
        } catch (err) {
            throw fail(500, (err as Error).message);
        }

        if (!admin) {
            throw fail(401, 'Hospital admin session invalid or expired.');
        }

        req.hospitalAdmin = clean(admin)!;
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
