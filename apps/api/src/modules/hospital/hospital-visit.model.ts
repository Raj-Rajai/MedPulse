/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Row } from '../../common/row';

export interface VisitFilters {
    search?: any;
    department?: any;
    disposition?: any;
    date?: any;
    limit?: any;
    offset?: any;
}

@Injectable()
export class HospitalVisitModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async createVisit(hospitalId: unknown, data: Record<string, any>, admin: Row | undefined): Promise<Row | undefined> {
        if (!data.patient_name || !data.patient_name.trim()) {
            throw new Error('Patient name is required for registration.');
        }

        const hid = Number(hospitalId);

        let visitUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            visitUid = `REG-${new Date().getFullYear()}-${randSuffix}`;
            const collision = await this.db.queryOne('SELECT id FROM hospital_visits WHERE visit_uid = $1', visitUid);
            if (!collision) break;
        }

        let patientId: any = data.patient_id ? Number(data.patient_id) : null;
        const familyMemberId = data.family_member_id ? Number(data.family_member_id) : null;

        if (familyMemberId) {
            const existingPatient = await this.db.queryOne(
                'SELECT id FROM patients WHERE family_member_id = $1 AND hospital_id = $2',
                familyMemberId,
                hid,
            );
            if (existingPatient) {
                patientId = existingPatient.id;
            } else {
                const phone = data.contact_number && data.contact_number.trim() ? data.contact_number.trim() : null;
                const phoneMatch = phone ? await this.db.queryOne('SELECT id FROM patients WHERE phone = $1', phone) : null;
                if (phoneMatch) {
                    patientId = phoneMatch.id;
                } else {
                    const patUid = `PAT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                    const safePhone = phone || `99${Math.floor(10000000 + Math.random() * 90000000)}`;
                    try {
                        const patRes = await this.db.insert(
                            `INSERT INTO patients (patient_uid, name, phone, age_years, gender, address, model_type, family_member_id, hospital_id, status)
                             VALUES ($1, $2, $3, $4, $5, $6, 'Dependent', $7, $8, 'Active')`,
                            patUid,
                            data.patient_name.trim(),
                            safePhone,
                            data.age_years ? Number(data.age_years) : null,
                            data.gender || 'Other',
                            data.address || data.village || '',
                            familyMemberId,
                            hid,
                        );
                        patientId = patRes.lastInsertRowid;
                    } catch {
                        // In case of conflict, proceed without crashing
                    }
                }
            }
        }

        const res = await this.db.insert(
            `INSERT INTO hospital_visits (
                hospital_id, patient_id, family_member_id, visit_uid,
                patient_name, age_years, gender, contact_number, address, village,
                family_code, student_name, student_roll,
                visit_date, department, attending_doctor, visit_type,
                chief_complaint, symptoms_duration,
                sbp, dbp, pulse, temperature, rbs,
                existing_conditions, allergies, diagnosis, treatment_prescribed,
                disposition, ward_bed_no, follow_up_advice, registered_by_name
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12, $13,
                COALESCE($14, to_char(CURRENT_DATE, 'YYYY-MM-DD')), $15, $16, $17,
                $18, $19,
                $20, $21, $22, $23, $24,
                $25, $26, $27, $28,
                $29, $30, $31, $32
            )`,
            hid,
            patientId,
            familyMemberId,
            visitUid,
            data.patient_name.trim(),
            data.age_years !== undefined && data.age_years !== null ? Number(data.age_years) : null,
            data.gender || 'Other',
            data.contact_number ? data.contact_number.trim() : null,
            data.address ? data.address.trim() : null,
            data.village ? data.village.trim() : null,
            data.family_code ? data.family_code.trim() : null,
            data.student_name ? data.student_name.trim() : null,
            data.student_roll ? String(data.student_roll).trim() : null,
            data.visit_date || null,
            data.department ? data.department.trim() : 'General Medicine',
            data.attending_doctor ? data.attending_doctor.trim() : (admin?.name || 'Dr. Ramesh Patel'),
            data.visit_type ? data.visit_type.trim() : 'FAP Survey Referral',
            data.chief_complaint ? data.chief_complaint.trim() : null,
            data.symptoms_duration ? data.symptoms_duration.trim() : null,
            data.sbp ? Number(data.sbp) : null,
            data.dbp ? Number(data.dbp) : null,
            data.pulse ? Number(data.pulse) : null,
            data.temperature ? Number(data.temperature) : null,
            data.rbs ? Number(data.rbs) : null,
            data.existing_conditions ? data.existing_conditions.trim() : null,
            data.allergies ? data.allergies.trim() : null,
            data.diagnosis ? data.diagnosis.trim() : null,
            data.treatment_prescribed ? data.treatment_prescribed.trim() : null,
            data.disposition ? data.disposition.trim() : 'Discharged OPD',
            data.ward_bed_no ? data.ward_bed_no.trim() : null,
            data.follow_up_advice ? data.follow_up_advice.trim() : null,
            admin?.name || 'Admissions Desk',
        );

        return this.db.queryOne('SELECT * FROM hospital_visits WHERE id = $1', res.lastInsertRowid);
    }

    async listVisits(hospitalId: unknown, { search, department, disposition, date, limit = 25, offset = 0 }: VisitFilters = {}) {
        let sql = 'WHERE hospital_id = $1';
        const params: any[] = [Number(hospitalId)];

        if (department && department.trim()) {
            params.push(department.trim());
            sql += ` AND department = $${params.length}`;
        }

        if (disposition && disposition.trim()) {
            params.push(disposition.trim());
            sql += ` AND disposition = $${params.length}`;
        }

        if (date && date.trim()) {
            params.push(date.trim());
            sql += ` AND visit_date = $${params.length}`;
        }

        if (search && search.trim()) {
            const term = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
            params.push(term);
            const p = `$${params.length}`;
            sql += ` AND (
                patient_name ILIKE ${p} ESCAPE '\\' OR
                visit_uid ILIKE ${p} ESCAPE '\\' OR
                contact_number ILIKE ${p} ESCAPE '\\' OR
                family_code ILIKE ${p} ESCAPE '\\' OR
                attending_doctor ILIKE ${p} ESCAPE '\\' OR
                diagnosis ILIKE ${p} ESCAPE '\\' OR
                chief_complaint ILIKE ${p} ESCAPE '\\' OR
                department ILIKE ${p} ESCAPE '\\' OR
                student_name ILIKE ${p} ESCAPE '\\'
            )`;
        }

        const totalRow = await this.db.queryOne(`SELECT COUNT(*) AS total FROM hospital_visits ${sql}`, ...params);
        const total = totalRow ? totalRow.total : 0;

        const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
        const offsetNum = Math.max(0, Number(offset) || 0);

        const visits = await this.db.queryAll(
            `SELECT * FROM hospital_visits
             ${sql}
             ORDER BY id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            ...params,
            limitNum,
            offsetNum,
        );

        return {
            visits,
            total,
            limit: limitNum,
            offset: offsetNum,
        };
    }

    async getSummary(hospitalId: unknown) {
        const hid = Number(hospitalId);
        const [totalRow, todayRow, admittedRow, opdRow] = await Promise.all([
            this.db.queryOne('SELECT COUNT(*) AS total FROM hospital_visits WHERE hospital_id = $1', hid),
            this.db.queryOne("SELECT COUNT(*) AS today FROM hospital_visits WHERE hospital_id = $1 AND visit_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')", hid),
            this.db.queryOne("SELECT COUNT(*) AS admitted FROM hospital_visits WHERE hospital_id = $1 AND (disposition ILIKE '%Admit%' OR disposition = 'Observation')", hid),
            this.db.queryOne("SELECT COUNT(*) AS opd FROM hospital_visits WHERE hospital_id = $1 AND disposition ILIKE '%Discharged%'", hid),
        ]);

        return {
            total_registered: totalRow?.total || 0,
            today_visits: todayRow?.today || 0,
            admitted_patients: admittedRow?.admitted || 0,
            opd_discharged: opdRow?.opd || 0,
        };
    }

    async getVisitById(hospitalId: unknown, visitId: unknown): Promise<Row | undefined> {
        return this.db.queryOne('SELECT * FROM hospital_visits WHERE id = $1 AND hospital_id = $2', Number(visitId), Number(hospitalId));
    }
}
