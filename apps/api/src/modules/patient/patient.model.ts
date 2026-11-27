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

    async findById(id: unknown): Promise<Row | null> {
        if (!id) return null;
        const row = await this.db.queryOne(
            `SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                    c.name as college_name, c.city as college_city
             FROM patients p
             LEFT JOIN students s ON p.student_id = s.id
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE p.id = $1`,
            Number(id),
        );
        return clean(row);
    }

    async findByPhone(phone: unknown): Promise<Row | null> {
        if (!phone) return null;
        const row = await this.db.queryOne(
            `SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                    c.name as college_name, c.city as college_city
             FROM patients p
             LEFT JOIN students s ON p.student_id = s.id
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE p.phone = $1`,
            phone,
        );
        return clean(row);
    }

    async verifyReferral(code: any): Promise<Row | null> {
        if (!code) return null;
        const student = await this.db.queryOne(
            `SELECT s.id, s.name, s.roll_number, s.posting_unit, s.referral_code,
                    c.name as college_name, c.city as college_city
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE UPPER(TRIM(s.referral_code)) = UPPER(TRIM($1))`,
            code.toString().trim(),
        );
        return clean(student);
    }

    async register({ name, phone, pin, email, gender, age_years, date_of_birth, address, is_adopted, referral_code }: Record<string, any>): Promise<Record<string, any>> {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const cleanPin = (pin && pin.trim().length >= 4) ? pin.trim() : '1234';

        const existing = await this.db.queryOne('SELECT id, phone, patient_uid FROM patients WHERE phone = $1', cleanPhone);
        if (existing) {
            return { conflict: true, message: 'This phone number is already registered. Please sign in.' };
        }

        let modelType = 'Independent';
        let studentId: number | null = null;
        let referralCodeUsed: string | null = null;

        const hasReferral = (is_adopted || (referral_code && referral_code.trim().length > 0));
        if (hasReferral) {
            if (!referral_code || !referral_code.trim()) {
                return { badRequest: true, message: "Please enter your cadet's referral code to complete dependent registration." };
            }
            const student = await this.verifyReferral(referral_code.trim());
            if (!student) {
                return { badRequest: true, message: 'Invalid medical cadet referral code provided.' };
            }

            modelType = 'Dependent';
            studentId = Number(student.id);
            referralCodeUsed = student.referral_code;
        }

        let patientUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            patientUid = `PAT-${new Date().getFullYear()}-${randSuffix}`;
            const collision = await this.db.queryOne('SELECT id FROM patients WHERE patient_uid = $1', patientUid);
            if (!collision) break;
        }

        const familyMemberId = null;

        const result = await this.db.insert(
            `INSERT INTO patients (patient_uid, name, phone, email, pin, date_of_birth, age_years, gender, address, model_type, student_id, referral_code_used, family_member_id, hospital_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, 'Active')`,
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
            familyMemberId,
        );

        await this.patientFamily.ensureFamily(result.lastInsertRowid);

        const newPatient = (await this.findById(result.lastInsertRowid))!;

        return {
            modelType,
            patient: publicIdentity(newPatient),
        };
    }

    async login(identifier: any, pin: any): Promise<Record<string, any>> {
        const cleanId = identifier.trim();
        const digitsOnly = cleanId.replace(/[^0-9]/g, '');

        let patient: Row | null | undefined = null;
        if (digitsOnly.length === 10) {
            patient = await this.db.queryOne(
                `SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                        c.name as college_name, c.city as college_city
                 FROM patients p
                 LEFT JOIN students s ON p.student_id = s.id
                 LEFT JOIN colleges c ON s.college_id = c.id
                 WHERE p.phone = $1 OR p.phone = $2`,
                cleanId,
                digitsOnly,
            );
        }

        if (!patient) {
            patient = await this.db.queryOne(
                `SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                        c.name as college_name, c.city as college_city
                 FROM patients p
                 LEFT JOIN students s ON p.student_id = s.id
                 LEFT JOIN colleges c ON s.college_id = c.id
                 WHERE UPPER(p.patient_uid) = UPPER($1) OR p.phone = $2`,
                cleanId,
                cleanId,
            );
        }

        if (!patient) {
            return { notFound: true };
        }

        const expectedPin = patient.pin || '1234';
        if (pin.trim() !== expectedPin) {
            return { invalidPin: true };
        }

        return {
            patient: publicIdentity(clean(patient)!),
        };
    }

    async linkReferral(patientId: unknown, referralCode: any, _currentPatient: Row): Promise<Record<string, any>> {
        const student = await this.verifyReferral(referralCode.trim());
        if (!student) {
            return { notFound: true, message: 'Invalid medical cadet referral code.' };
        }

        const familyMemberId = null;

        await this.db.execute(
            `UPDATE patients
             SET model_type = 'Dependent',
                 student_id = $1,
                 referral_code_used = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            Number(student.id),
            student.referral_code,
            Number(patientId),
        );

        await this.patientFamily.onStudentLinked(patientId, student.id, familyMemberId);

        const updated = await this.findById(patientId);
        return {
            student,
            patient: updated,
        };
    }

    async getRecords(patient: Row, requestedMemberId?: number) {
        const memberId = requestedMemberId || patient.family_member_id;
        const target = memberId ? await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', Number(memberId)) : null;
        if (memberId && (!target || !(await canReadMember(this.db, patient, target)))) {
            await this.db.execute(
                `INSERT INTO portal_privacy_audit (actor_role, actor_id, action, resource_type, resource_id, created_at)
                 VALUES ('patient', $1, 'records_denied', 'member', $2, $3)`,
                Number(patient.id),
                Number(memberId),
                BigInt(Date.now()),
            );
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
            const mid = Number(memberId);
            [member, conditions, medications, allergies, medicalHistory, lifestyle, followUps] = await Promise.all([
                this.db.queryOne(
                    `SELECT m.*, f.survey_date AS measured_at
                     FROM family_members m
                     JOIN families f ON m.family_id = f.id
                     WHERE m.id = $1`,
                    mid,
                ),
                this.db.queryAll('SELECT * FROM member_conditions WHERE member_id = $1 ORDER BY id DESC', mid),
                this.db.queryAll('SELECT * FROM member_medications WHERE member_id = $1 ORDER BY id DESC', mid),
                this.db.queryAll('SELECT * FROM member_allergies WHERE member_id = $1 ORDER BY id DESC', mid),
                this.db.queryAll('SELECT * FROM member_medical_history WHERE member_id = $1 ORDER BY year DESC, id DESC', mid),
                this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', mid),
                this.db.queryAll('SELECT * FROM follow_ups WHERE member_id = $1 ORDER BY visit_date DESC, id DESC', mid),
            ]);
        }

        return {
            profile: publicIdentity(clean(patient)!),
            member: member ? {
                id: member.id,
                name: member.name,
                medpulse_id: member.medpulse_id,
                sbp: member.sbp,
                dbp: member.dbp,
                rbs: member.rbs,
                hb: member.hb,
                bmi: member.bmi,
                measured_at: member.measured_at || null,
            } : null,
            provenance: { source: 'Family health survey', verified: false, recorded_at: member?.measured_at || null },
            conditions: cleanList(conditions).map(({ id, condition_name, status, created_at }) => ({
                id, condition_name, status, recorded_at: created_at || null, source: 'Family health survey', verified: false,
            })),
            medications: cleanList(medications).map(({ id, name, dosage, frequency, reason, created_at, currently_taking }) => ({
                id, name, dosage, frequency, reason, currently_taking, recorded_at: created_at || null, source: 'Family health survey', verified: false,
            })),
            allergies: cleanList(allergies).map(({ id, allergen, reaction, allergy_type, severity, created_at }) => ({
                id, allergen, reaction, allergy_type, severity, recorded_at: created_at || null, source: 'Family health survey', verified: false,
            })),
            medicalHistory: cleanList(medicalHistory),
            lifestyle: clean(lifestyle),
            follow_ups: cleanList(followUps).map(({ id, visit_number, visit_date, sbp, dbp, rbs, hb, weight_kg, next_visit_date }) => ({
                id, visit_number, visit_date, sbp, dbp, rbs, hb, weight_kg, next_visit_date, source: 'Family health survey follow-up', verified: false,
            })),
        };
    }
}
