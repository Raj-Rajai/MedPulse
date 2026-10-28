/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { PatientFamilyModel } from './patient-family.model';
import { publicIdentity } from '../../auth/portal-session.service';
import { canReadMember } from './patient-privacy.service';
import { StatusError } from '../../common/http-error';

@Injectable()
export class PatientModel {
    constructor(
        private readonly database: DatabaseService,
        private readonly patientFamily: PatientFamilyModel,
    ) {}

    private get db() {
        return this.database.db;
    }

    findById(id: unknown): Row | null {
        if (!id) return null;
        const row = this.db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.id = ?
        `).get(id);
        return clean(row);
    }

    findByPhone(phone: unknown): Row | null {
        if (!phone) return null;
        const row = this.db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.phone = ?
        `).get(phone);
        return clean(row);
    }

    verifyReferral(code: any): Row | null {
        if (!code) return null;
        const student = this.db.prepare(`
            SELECT s.id, s.name, s.roll_number, s.posting_unit, s.referral_code,
                   c.name as college_name, c.city as college_city
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE UPPER(TRIM(s.referral_code)) = UPPER(TRIM(?))
        `).get(code.toString().trim());
        return clean(student);
    }

    register({ name, phone, pin, email, gender, age_years, date_of_birth, address, is_adopted, referral_code }: Record<string, any>): Record<string, any> {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const cleanPin = (pin && pin.trim().length >= 4) ? pin.trim() : '1234';

        // Check if phone already registered
        const existing = this.db.prepare('SELECT id, phone, patient_uid FROM patients WHERE phone = ?').get(cleanPhone);
        if (existing) {
            return { conflict: true, message: 'This phone number is already registered. Please sign in.' };
        }

        // Determine Model Type & Linkage
        let modelType = 'Independent';
        let studentId = null;
        let referralCodeUsed = null;

        const hasReferral = (is_adopted || (referral_code && referral_code.trim().length > 0));
        if (hasReferral) {
            if (!referral_code || !referral_code.trim()) {
                return { badRequest: true, message: "Please enter your cadet's referral code to complete dependent registration." };
            }
            const student = this.verifyReferral(referral_code.trim());
            if (!student) {
                return { badRequest: true, message: 'Invalid medical cadet referral code provided.' };
            }

            modelType = 'Dependent';
            studentId = student.id;
            referralCodeUsed = student.referral_code;
        }

        // Generate Collision-Free Patient UID (e.g. PAT-2026-XXXXX)
        let patientUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            patientUid = `PAT-${new Date().getFullYear()}-${randSuffix}`;
            const collision = this.db.prepare('SELECT id FROM patients WHERE patient_uid = ?').get(patientUid);
            if (!collision) break;
        }

        // Public registration never proves ownership of an existing medical record.
        const familyMemberId = null;

        const insertStmt = this.db.prepare(`
            INSERT INTO patients (patient_uid, name, phone, email, pin, date_of_birth, age_years, gender, address, model_type, student_id, referral_code_used, family_member_id, hospital_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Active')
        `);

        const result = insertStmt.run(
            patientUid,
            name.trim(),
            cleanPhone,
            email ? email.trim() : null,
            cleanPin,
            date_of_birth || null,
            age_years ? parseInt(age_years, 10) : null,
            ({ m: 'M', male: 'M', f: 'F', female: 'F' } as Record<string, string>)[String(gender || '').trim().toLowerCase()] || 'Other',
            address ? address.trim() : null,
            modelType,
            studentId,
            referralCodeUsed,
            familyMemberId
        );

        // Auto-create the patient's card + household (patient becomes head of family)
        this.patientFamily.ensureFamily(Number(result.lastInsertRowid));

        const newPatient = this.findById(Number(result.lastInsertRowid))!;

        return {
            modelType,
            patient: publicIdentity(newPatient)
        };
    }

    login(identifier: any, pin: any): Record<string, any> {
        const cleanId = identifier.trim();
        const digitsOnly = cleanId.replace(/[^0-9]/g, '');

        let patient: Row | null | undefined = null;
        if (digitsOnly.length === 10) {
            patient = this.db.prepare(`
                SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                       c.name as college_name, c.city as college_city
                FROM patients p
                LEFT JOIN students s ON p.student_id = s.id
                LEFT JOIN colleges c ON s.college_id = c.id
                WHERE p.phone = ? OR p.phone = ?
            `).get(cleanId, digitsOnly);
        }

        if (!patient) {
            patient = this.db.prepare(`
                SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                       c.name as college_name, c.city as college_city
                FROM patients p
                LEFT JOIN students s ON p.student_id = s.id
                LEFT JOIN colleges c ON s.college_id = c.id
                WHERE UPPER(p.patient_uid) = UPPER(?) OR p.phone = ?
            `).get(cleanId, cleanId);
        }

        if (!patient) {
            return { notFound: true };
        }

        const expectedPin = patient.pin || '1234';
        if (pin.trim() !== expectedPin) {
            return { invalidPin: true };
        }

        return {
            patient: publicIdentity(clean(patient)!)
        };
    }

    linkReferral(patientId: unknown, referralCode: any, currentPatient: Row): Record<string, any> {
        const student = this.verifyReferral(referralCode.trim());
        if (!student) {
            return { notFound: true, message: 'Invalid medical cadet referral code.' };
        }

        // A referral links care teams; names and shared phones do not prove record ownership.
        const familyMemberId = null;

        this.db.prepare(`
            UPDATE patients
            SET model_type = 'Dependent',
                student_id = ?,
                referral_code_used = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(student.id, student.referral_code, patientId);

        // Household: move into the surveyed family, or let the student adopt the patient's family
        this.patientFamily.onStudentLinked(patientId, student.id, familyMemberId);

        const updated = this.findById(patientId);
        return {
            student,
            patient: updated
        };
    }

    getRecords(patient: Row, requestedMemberId?: number) {
        const memberId = requestedMemberId || patient.family_member_id;
        const target = memberId && this.db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
        if (memberId && (!target || !canReadMember(this.db, patient, target))) {
            this.db.prepare(`INSERT INTO portal_privacy_audit (actor_role, actor_id, action, resource_type, resource_id, created_at)
                VALUES ('patient', ?, 'records_denied', 'member', ?, ?)`).run(patient.id, Number(memberId), Date.now());
            throw new StatusError('You do not have permission to view this health record.', 403);
        }

        let member: Row | null | undefined = null;
        let conditions: Row[] = [];
        let medications: Row[] = [];
        let allergies: Row[] = [];
        let medicalHistory: Row[] = [];
        let lifestyle: Row | null | undefined = null;
        let followUps: Row[] = [];

        if (memberId) {
            member = this.db.prepare(`
                SELECT m.*, f.survey_date AS measured_at
                FROM family_members m
                JOIN families f ON m.family_id = f.id
                WHERE m.id = ?
            `).get(memberId);

            conditions = this.db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(memberId);
            medications = this.db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(memberId);
            allergies = this.db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(memberId);
            medicalHistory = this.db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(memberId);
            lifestyle = this.db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
            followUps = this.db.prepare('SELECT * FROM follow_ups WHERE member_id = ? ORDER BY visit_date DESC, id DESC').all(memberId);
        }

        return {
            profile: publicIdentity(clean(patient)!),
            member: member ? {
                id: member.id, name: member.name, medpulse_id: member.medpulse_id,
                sbp: member.sbp, dbp: member.dbp, rbs: member.rbs, hb: member.hb, bmi: member.bmi,
                measured_at: member.measured_at || null,
            } : null,
            provenance: { source: 'Family health survey', verified: false, recorded_at: member?.measured_at || null },
            conditions: cleanList(conditions).map(({ id, condition_name, status, created_at }) => ({ id, condition_name, status, recorded_at: created_at || null, source: 'Family health survey', verified: false })),
            medications: cleanList(medications).map(({ id, name, dosage, frequency, reason, created_at, currently_taking }) => ({ id, name, dosage, frequency, reason, currently_taking, recorded_at: created_at || null, source: 'Family health survey', verified: false })),
            allergies: cleanList(allergies).map(({ id, allergen, reaction, allergy_type, severity, created_at }) => ({ id, allergen, reaction, allergy_type, severity, recorded_at: created_at || null, source: 'Family health survey', verified: false })),
            medicalHistory: cleanList(medicalHistory),
            lifestyle: clean(lifestyle),
            follow_ups: cleanList(followUps).map(({ id, visit_number, visit_date, sbp, dbp, rbs, hb, weight_kg, next_visit_date }) => ({ id, visit_number, visit_date, sbp, dbp, rbs, hb, weight_kg, next_visit_date, source: 'Family health survey follow-up', verified: false })),

        };
    }
}
