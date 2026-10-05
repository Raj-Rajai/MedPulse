/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { PatientFamilyModel } from './patient-family.model';

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

        // Attempt to auto-link with family_members record by contact_number
        let familyMemberId = null;
        const matchingMember = this.db.prepare('SELECT id FROM family_members WHERE contact_number = ? LIMIT 1').get(cleanPhone);
        if (matchingMember) {
            familyMemberId = matchingMember.id;
        }

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
            patient: newPatient,
            token: `patient-${newPatient.id}`
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
            patient: clean(patient),
            token: `patient-${patient.id}`
        };
    }

    linkReferral(patientId: unknown, referralCode: any, currentPatient: Row): Record<string, any> {
        const student = this.verifyReferral(referralCode.trim());
        if (!student) {
            return { notFound: true, message: 'Invalid medical cadet referral code.' };
        }

        let familyMemberId = null;
        {
            const memberMatch = this.db.prepare(`
                SELECT m.id 
                FROM family_members m 
                JOIN families f ON m.family_id = f.id 
                WHERE f.student_id = ?
                  AND (m.contact_number = ? OR LOWER(TRIM(m.name)) = LOWER(TRIM(?)))
                  AND NOT EXISTS (SELECT 1 FROM patients p2 WHERE p2.family_member_id = m.id AND p2.id != ?)
                ORDER BY CASE WHEN m.contact_number = ? THEN 0 ELSE 1 END
                LIMIT 1
            `).get(student.id, currentPatient.phone, currentPatient.name, patientId, currentPatient.phone);
            if (memberMatch) familyMemberId = memberMatch.id;
        }

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

    getRecords(patient: Row) {
        let memberId = patient.family_member_id;

        // Auto-match member by phone if not linked yet
        if (!memberId && patient.phone) {
            const match = this.db.prepare('SELECT id FROM family_members WHERE contact_number = ? LIMIT 1').get(patient.phone);
            if (match) {
                memberId = match.id;
                this.db.prepare('UPDATE patients SET family_member_id = ? WHERE id = ?').run(memberId, patient.id);
            }
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
                SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village, f.city, f.district
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
            profile: clean(patient),
            member: clean(member),
            conditions: cleanList(conditions),
            medications: cleanList(medications),
            allergies: cleanList(allergies),
            medicalHistory: cleanList(medicalHistory),
            lifestyle: clean(lifestyle),
            follow_ups: cleanList(followUps),
            followUps: cleanList(followUps)
        };
    }
}
