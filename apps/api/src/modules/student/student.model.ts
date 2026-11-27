import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { generateUniqueReferralCode } from '../../common/referral';
import { fail } from '../../common/http-error';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StudentInput {
    roll_number?: any;
    name?: any;
    pin?: any;
    email?: any;
    phone?: any;
    batch_year?: any;
    posting_unit?: any;
    college_id?: any;
    status?: any;
}

export interface ProvisionPatientInput {
    member_id?: any;
    phone?: any;
    pin?: any;
    name?: any;
}

@Injectable()
export class StudentModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async findByRoll(rollNumber: any): Promise<Row | null> {
        if (!rollNumber) return null;
        const row = await this.db.queryOne(
            `SELECT s.*, c.name as college_name
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE s.roll_number = $1`,
            rollNumber.toString().trim(),
        );
        return clean(row);
    }

    async findById(id: any): Promise<Row | null> {
        if (!id) return null;
        const row = await this.db.queryOne(
            `SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE s.id = $1`,
            Number(id),
        );
        return clean(row);
    }

    async findByReferralCode(code: any): Promise<Row | null> {
        if (!code) return null;
        const row = await this.db.queryOne(
            `SELECT s.id, s.name, s.roll_number, s.posting_unit, s.referral_code,
                    c.name as college_name, c.city as college_city
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE UPPER(TRIM(s.referral_code)) = UPPER(TRIM($1))`,
            code.toString().trim(),
        );
        return clean(row);
    }

    async getAll(): Promise<Row[]> {
        const rows = await this.db.queryAll(`
            SELECT s.*, c.name as college_name,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            ORDER BY s.roll_number ASC
        `);
        return cleanList(rows);
    }

    async create({ roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status }: StudentInput): Promise<Row | null> {
        const cleanRoll = roll_number.toString().trim();
        const cleanName = name.trim();
        const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';
        const cleanEmail = email && email.trim() ? email.trim() : null;
        const cleanPhone = phone && phone.trim() ? phone.trim() : null;
        const cleanBatch = batch_year && batch_year.trim() ? batch_year.trim() : '3rd Year MBBS (Community Medicine)';
        const cleanUnit = posting_unit && posting_unit.trim() ? posting_unit.trim() : 'RHTC - Rural Health Training Center';
        const cleanCollege = college_id ? Number(college_id) : 1;
        const cleanStatus = status && status.trim() ? status.trim() : 'Active';
        const referralCode = await generateUniqueReferralCode(this.db, cleanCollege, cleanRoll);

        const result = await this.db.insert(
            `INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, referral_code, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            cleanRoll,
            cleanName,
            cleanPin,
            cleanEmail,
            cleanPhone,
            cleanBatch,
            cleanUnit,
            cleanCollege,
            referralCode,
            cleanStatus,
        );

        return this.findById(result.lastInsertRowid);
    }

    async getProfile(studentId: any, rollNumber: any): Promise<Row | null> {
        let student: Row | null = null;
        if (studentId) {
            student = await this.findById(studentId);
        } else if (rollNumber) {
            student = await this.findByRoll(rollNumber);
        } else {
            const first = await this.db.queryOne(`
                SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                ORDER BY s.id ASC LIMIT 1
            `);
            student = clean(first);
        }

        if (!student) return null;
        const sid = Number(student.id);

        const statsRow = await this.db.queryOne(
            `SELECT
                (SELECT COUNT(*) FROM families WHERE student_id = $1) as total_families,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = $2) as total_members,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = $3 AND (m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL OR m.anc_taken != 'NA' OR m.is_underweight != 'NA')) as completed_surveys,
                (SELECT COUNT(*) FROM follow_ups WHERE student_id = $4) as total_followups,
                (SELECT COUNT(c.id) FROM member_conditions c JOIN family_members m ON c.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = $5) as total_conditions,
                (SELECT COUNT(med.id) FROM member_medications med JOIN family_members m ON med.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = $6) as total_medications`,
            sid,
            sid,
            sid,
            sid,
            sid,
            sid,
        );

        const families = await this.db.queryAll(
            `SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.family_name,
                    f.village_ward, f.village, f.contact_number, f.total_cu, f.calorie_status,
                    COUNT(m.id) as member_count,
                    SUM(CASE WHEN m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL THEN 1 ELSE 0 END) as surveyed_members
             FROM families f
             LEFT JOIN family_members m ON f.id = m.family_id
             WHERE f.student_id = $1
             GROUP BY f.id
             ORDER BY f.family_no ASC`,
            sid,
        );

        const recentActivity = await this.db.queryAll(
            `SELECT v.id, v.visit_date, v.visit_number, v.sbp, v.dbp, v.rbs, v.health_progress, v.treatment_compliance, v.clinical_notes,
                    m.name as member_name, m.relation_to_hof, m.gender, m.age_years,
                    f.id as family_id, f.family_code, f.head_of_family
             FROM follow_ups v
             JOIN family_members m ON v.member_id = m.id
             JOIN families f ON m.family_id = f.id
             WHERE f.student_id = $1
             ORDER BY v.visit_date DESC, v.id DESC
             LIMIT 10`,
            sid,
        );

        const studentClean: Row = { ...student };
        delete studentClean.pin;

        return {
            student: studentClean,
            stats: clean(statsRow),
            families: cleanList(families),
            recentActivity: cleanList(recentActivity),
        };
    }

    async updateProfile(sid: any, { name, email, phone, batch_year, posting_unit }: StudentInput): Promise<Row | null> {
        await this.db.execute(
            `UPDATE students
             SET name = COALESCE($1, name),
                 email = $2,
                 phone = $3,
                 batch_year = COALESCE($4, batch_year),
                 posting_unit = COALESCE($5, posting_unit)
             WHERE id = $6`,
            name ? name.trim() : null,
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            Number(sid),
        );

        const updated = await this.findById(sid);
        if (updated) {
            delete updated.pin;
        }
        return updated;
    }

    async changePin(sid: any, currentPin: any, newPin: any): Promise<{ notFound?: boolean; invalidPin?: boolean; success?: boolean }> {
        const student = await this.db.queryOne('SELECT * FROM students WHERE id = $1', Number(sid));
        if (!student) return { notFound: true };

        const expectedPin = student.pin || '1234';
        if (currentPin.trim() !== expectedPin) {
            return { invalidPin: true };
        }

        await this.db.execute('UPDATE students SET pin = $1 WHERE id = $2', newPin.trim(), Number(sid));
        return { success: true };
    }

    async provisionPatient(studentId: any, studentReferralCode: any, { member_id, phone, pin, name }: ProvisionPatientInput): Promise<Row> {
        const member = await this.db.queryOne(
            `SELECT m.*, f.student_id, f.head_of_family
             FROM family_members m
             JOIN families f ON m.family_id = f.id
             WHERE m.id = $1 AND f.student_id = $2`,
            Number(member_id),
            Number(studentId),
        );

        if (!member) {
            return { forbidden: true };
        }

        const patientName = (name && name.trim()) ? name.trim() : member.name;
        let patientPhone = (phone && phone.trim())
            ? phone.replace(/[^0-9]/g, '')
            : (member.contact_number ? member.contact_number.replace(/[^0-9]/g, '') : '');

        if (patientPhone.length < 10) {
            patientPhone = `98${String(member.id).padStart(8, '0')}`;
        }

        const patientPin = (pin && pin.trim().length >= 4) ? pin.trim() : '1234';

        const existing = await this.db.queryOne(
            'SELECT * FROM patients WHERE family_member_id = $1 OR phone = $2',
            Number(member.id),
            patientPhone,
        );
        if (existing) {
            if (Number(existing.family_member_id) !== Number(member.id)) {
                throw fail(409, 'This phone belongs to a different patient account. Ask the care team to verify account ownership.');
            }
            return {
                alreadyExists: true,
                message: `Patient account already exists for ${existing.name}. Their existing PIN is unchanged.`,
                patient_uid: existing.patient_uid,
                phone: existing.phone,
                name: existing.name,
            };
        }

        let patientUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            patientUid = `PAT-${new Date().getFullYear()}-${randSuffix}`;
            const collision = await this.db.queryOne('SELECT id FROM patients WHERE patient_uid = $1', patientUid);
            if (!collision) break;
        }

        await this.db.execute(
            `INSERT INTO patients (patient_uid, name, phone, pin, date_of_birth, age_years, gender, model_type, student_id, referral_code_used, family_member_id, hospital_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Dependent', $8, $9, $10, 1, 'Active')`,
            patientUid,
            patientName,
            patientPhone,
            patientPin,
            member.date_of_birth,
            member.age_years,
            member.gender,
            Number(studentId),
            studentReferralCode,
            Number(member.id),
        );

        return {
            created: true,
            patient_uid: patientUid,
            phone: patientPhone,
            pin: patientPin,
            name: patientName,
        };
    }
}
