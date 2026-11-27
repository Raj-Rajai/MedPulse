/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';

export interface PatientFilters {
    university_id?: any;
    student_id?: any;
    model_type?: any;
    condition?: any;
    search?: any;
    limit?: any;
    offset?: any;
}

export interface StaffInput {
    username?: any;
    name?: any;
    email?: any;
    phone?: any;
    pin?: any;
    role?: any;
    department?: any;
}

export interface StaffUpdateInput {
    name?: any;
    email?: any;
    phone?: any;
    department?: any;
    status?: any;
}

@Injectable()
export class HospitalModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async findByCredentials(username: string): Promise<Row | null> {
        const cleanUser = username.trim();
        const admin = await this.db.queryOne(
            `SELECT ha.*, h.name as hospital_name, h.code as hospital_code, h.type as hospital_type,
                    h.city as hospital_city, h.bed_capacity
             FROM hospital_admins ha
             JOIN hospitals h ON ha.hospital_id = h.id
             WHERE (ha.username = $1 OR ha.phone = $2 OR ha.email = $3) AND ha.status = 'Active'`,
            cleanUser,
            cleanUser,
            cleanUser,
        );
        return clean(admin);
    }

    async findById(id: unknown): Promise<Row | null> {
        const row = await this.db.queryOne('SELECT * FROM hospital_admins WHERE id = $1', Number(id));
        return clean(row);
    }

    async getStats(hospitalId: unknown) {
        const hid = Number(hospitalId);
        const [totalRow, indRow, depRow, morbidityStats, uniBreakdown, fuRow] = await Promise.all([
            this.db.queryOne('SELECT COUNT(*) as count FROM patients WHERE hospital_id = $1', hid),
            this.db.queryOne("SELECT COUNT(*) as count FROM patients WHERE hospital_id = $1 AND model_type = 'Independent'", hid),
            this.db.queryOne("SELECT COUNT(*) as count FROM patients WHERE hospital_id = $1 AND model_type = 'Dependent'", hid),
            this.db.queryOne(
                `SELECT
                    COUNT(DISTINCT CASE WHEN fm.has_htn = 'Y' THEN p.id END) as htn_cases,
                    COUNT(DISTINCT CASE WHEN fm.has_dm = 'Y' THEN p.id END) as dm_cases,
                    COUNT(DISTINCT CASE WHEN fm.has_anaemia = 'Y' THEN p.id END) as anaemia_cases,
                    COUNT(DISTINCT CASE WHEN fm.is_underweight = 'Y' THEN p.id END) as underweight_children
                 FROM patients p
                 JOIN family_members fm ON p.family_member_id = fm.id
                 WHERE p.hospital_id = $1`,
                hid,
            ),
            this.db.queryAll(
                `SELECT c.id as university_id, c.name as university_name, c.code as university_code, COUNT(p.id) as patient_count
                 FROM patients p
                 JOIN students s ON p.student_id = s.id
                 JOIN colleges c ON s.college_id = c.id
                 WHERE p.hospital_id = $1 AND p.model_type = 'Dependent'
                 GROUP BY c.id, c.name, c.code
                 ORDER BY patient_count DESC`,
                hid,
            ),
            this.db.queryOne(
                `SELECT COUNT(fu.id) as count
                 FROM follow_ups fu
                 JOIN family_members fm ON fu.member_id = fm.id
                 JOIN patients p ON p.family_member_id = fm.id
                 WHERE p.hospital_id = $1`,
                hid,
            ),
        ]);

        return {
            totals: {
                total_patients: totalRow?.count || 0,
                independent_patients: indRow?.count || 0,
                dependent_patients: depRow?.count || 0,
                follow_up_visits: fuRow?.count || 0,
            },
            morbidities: {
                htn_cases: morbidityStats?.htn_cases || 0,
                dm_cases: morbidityStats?.dm_cases || 0,
                anaemia_cases: morbidityStats?.anaemia_cases || 0,
                underweight_children: morbidityStats?.underweight_children || 0,
            },
            university_breakdown: cleanList(uniBreakdown),
        };
    }

    async getFilterOptions() {
        const [universities, students] = await Promise.all([
            this.db.queryAll('SELECT id, name, code, city FROM colleges ORDER BY name ASC'),
            this.db.queryAll(`
                SELECT s.id, s.name, s.roll_number, s.college_id, c.name as college_name, s.referral_code
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                ORDER BY s.name ASC
            `),
        ]);

        return {
            universities: cleanList(universities),
            students: cleanList(students),
        };
    }

    async getPatients(hospitalId: unknown, { university_id, student_id, model_type, condition, search, limit = 50, offset = 0 }: PatientFilters): Promise<Row[]> {
        let query = `
            SELECT
                p.id, p.patient_uid, p.name, p.phone, p.age_years, p.gender, p.address,
                p.model_type, p.referral_code_used, p.status, p.created_at,
                p.student_id, s.name as student_name, s.roll_number as student_roll,
                c.id as university_id, c.name as university_name, c.code as university_code,
                fm.id as family_member_id, fm.has_htn, fm.sbp, fm.dbp, fm.has_dm, fm.rbs,
                fm.has_anaemia, fm.hb, fm.bmi, fm.is_underweight,
                (
                    SELECT STRING_AGG(condition_name, ', ')
                    FROM member_conditions mc
                    WHERE mc.member_id = p.family_member_id
                ) as conditions_summary
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            LEFT JOIN family_members fm ON p.family_member_id = fm.id
            WHERE p.hospital_id = $1
        `;

        const params: any[] = [Number(hospitalId)];

        if (university_id) {
            params.push(Number(university_id));
            query += ` AND c.id = $${params.length}`;
        }

        if (student_id) {
            params.push(Number(student_id));
            query += ` AND s.id = $${params.length}`;
        }

        if (model_type) {
            params.push(model_type);
            query += ` AND p.model_type = $${params.length}`;
        }

        if (condition === 'HTN') {
            query += ` AND (fm.has_htn = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name ILIKE '%Hypertension%'))`;
        } else if (condition === 'DM') {
            query += ` AND (fm.has_dm = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name ILIKE '%Diabetes%'))`;
        } else if (condition === 'Anaemia') {
            query += ` AND (fm.has_anaemia = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name ILIKE '%Anaemia%' OR mc2.condition_name ILIKE '%Anemia%'))`;
        } else if (condition === 'Pediatric') {
            query += ` AND (fm.is_underweight = 'Y' OR p.age_years <= 5)`;
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            params.push(term);
            const p = `$${params.length}`;
            query += ` AND (p.name ILIKE ${p} OR p.phone ILIKE ${p} OR p.patient_uid ILIKE ${p} OR s.name ILIKE ${p} OR s.roll_number ILIKE ${p})`;
        }

        params.push(parseInt(limit, 10), parseInt(offset, 10));
        query += ` ORDER BY p.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const patients = await this.db.queryAll(query, ...params);
        return cleanList(patients);
    }

    async getPatientDossier(patientId: unknown, hospitalId: unknown) {
        const patient = await this.db.queryOne(
            `SELECT
                p.*,
                s.name as student_name, s.roll_number as student_roll, s.phone as student_phone, s.posting_unit as student_unit,
                c.id as university_id, c.name as university_name, c.code as university_code,
                h.name as hospital_name, h.code as hospital_code
             FROM patients p
             LEFT JOIN students s ON p.student_id = s.id
             LEFT JOIN colleges c ON s.college_id = c.id
             LEFT JOIN hospitals h ON p.hospital_id = h.id
             WHERE p.id = $1 AND p.hospital_id = $2`,
            Number(patientId),
            Number(hospitalId),
        );

        if (!patient) return null;
        delete patient.pin;

        let vitals: Row | undefined | null = null;
        let conditions: Row[] = [];
        let medications: Row[] = [];
        let allergies: Row[] = [];
        let history: Row[] = [];
        let lifestyle: Row | undefined | null = null;
        let followUps: Row[] = [];

        if (patient.family_member_id) {
            const fmId = Number(patient.family_member_id);
            [vitals, conditions, medications, allergies, history, lifestyle, followUps] = await Promise.all([
                this.db.queryOne(
                    `SELECT fm.*, f.head_of_family, f.village_ward, f.district, f.state, f.calorie_intake_per_cu
                     FROM family_members fm
                     JOIN families f ON fm.family_id = f.id
                     WHERE fm.id = $1`,
                    fmId,
                ),
                this.db.queryAll('SELECT * FROM member_conditions WHERE member_id = $1 ORDER BY id DESC', fmId),
                this.db.queryAll('SELECT * FROM member_medications WHERE member_id = $1 ORDER BY id DESC', fmId),
                this.db.queryAll('SELECT * FROM member_allergies WHERE member_id = $1 ORDER BY id DESC', fmId),
                this.db.queryAll('SELECT * FROM member_medical_history WHERE member_id = $1 ORDER BY id DESC', fmId),
                this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', fmId),
                this.db.queryAll('SELECT * FROM follow_ups WHERE member_id = $1 ORDER BY visit_date DESC', fmId),
            ]);
        }

        return {
            patient: clean(patient)!,
            vitals: clean(vitals),
            conditions: cleanList(conditions),
            medications: cleanList(medications),
            allergies: cleanList(allergies),
            history: cleanList(history),
            lifestyle: clean(lifestyle),
            follow_ups: cleanList(followUps),
        };
    }

    async getStaff(hospitalId: unknown, hospitalAdmin: Row) {
        const staff = await this.db.queryAll(
            `SELECT id, hospital_id, username, name, email, phone, role, department, status, created_at
             FROM hospital_admins
             WHERE hospital_id = $1
             ORDER BY CASE WHEN role = 'Hospital Super Admin' THEN 1 ELSE 2 END, id ASC`,
            Number(hospitalId),
        );

        const superAdminCount = staff.filter((s) => s.role === 'Hospital Super Admin' && s.status === 'Active').length;
        const adminCount = staff.filter((s) => s.role === 'Hospital Admin' && s.status === 'Active').length;

        const maxSuperAdmins = hospitalAdmin.max_super_admins || 3;
        const maxAdmins = hospitalAdmin.max_admins || 20;

        return {
            hospital: {
                id: hospitalAdmin.hospital_id,
                name: hospitalAdmin.hospital_name,
                code: hospitalAdmin.hospital_code,
                type: hospitalAdmin.hospital_type,
                city: hospitalAdmin.hospital_city,
                bed_capacity: hospitalAdmin.bed_capacity,
            },
            quota: {
                super_admins: {
                    current: superAdminCount,
                    max: maxSuperAdmins,
                    remaining: Math.max(0, maxSuperAdmins - superAdminCount),
                    is_at_capacity: superAdminCount >= maxSuperAdmins,
                },
                admins: {
                    current: adminCount,
                    max: maxAdmins,
                    remaining: Math.max(0, maxAdmins - adminCount),
                    is_at_capacity: adminCount >= maxAdmins,
                },
            },
            staff: cleanList(staff),
        };
    }

    async createStaff(
        hospitalId: unknown,
        hospitalAdmin: Row,
        { username, name, email, phone, pin = '8888', role = 'Hospital Admin', department = 'General Medicine' }: StaffInput,
    ): Promise<Row> {
        const hid = Number(hospitalId);
        const maxSuperAdmins = hospitalAdmin.max_super_admins || 3;
        const maxAdmins = hospitalAdmin.max_admins || 20;

        if (role === 'Hospital Super Admin') {
            const row = await this.db.queryOne(
                `SELECT COUNT(*) as count
                 FROM hospital_admins
                 WHERE hospital_id = $1 AND role = 'Hospital Super Admin' AND status = 'Active'`,
                hid,
            );
            const currentSuperAdmins = row?.count || 0;

            if (currentSuperAdmins >= maxSuperAdmins) {
                return {
                    quotaError: true,
                    message: `Hospital Super Admin quota reached (Maximum ${maxSuperAdmins} Super Admins allowed per hospital).`,
                };
            }
        } else {
            const row = await this.db.queryOne(
                `SELECT COUNT(*) as count
                 FROM hospital_admins
                 WHERE hospital_id = $1 AND role = 'Hospital Admin' AND status = 'Active'`,
                hid,
            );
            const currentAdmins = row?.count || 0;

            if (currentAdmins >= maxAdmins) {
                return {
                    quotaError: true,
                    message: `Hospital Admin quota reached (Maximum ${maxAdmins} Admins allowed per hospital).`,
                };
            }
        }

        const cleanUser = username.trim().toLowerCase();
        const existing = await this.db.queryOne('SELECT id FROM hospital_admins WHERE username = $1', cleanUser);
        if (existing) {
            return {
                userConflict: true,
                message: 'Username already taken. Please choose another username.',
            };
        }

        const result = await this.db.insert(
            `INSERT INTO hospital_admins (hospital_id, username, name, email, phone, pin, role, department, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')`,
            hid,
            cleanUser,
            name.trim(),
            (email && email.trim()) || null,
            (phone && phone.trim()) || null,
            pin.trim() || '8888',
            role,
            department.trim() || 'General Medicine',
        );

        return {
            staff_id: result.lastInsertRowid,
            role,
            name: name.trim(),
        };
    }

    async updateStaff(staffId: unknown, hospitalId: unknown, { name, email, phone, department, status }: StaffUpdateInput): Promise<Row | null> {
        const sid = Number(staffId);
        const hid = Number(hospitalId);
        const staff = await this.db.queryOne('SELECT * FROM hospital_admins WHERE id = $1 AND hospital_id = $2', sid, hid);
        if (!staff) return null;

        await this.db.execute(
            `UPDATE hospital_admins
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 phone = COALESCE($3, phone),
                 department = COALESCE($4, department),
                 status = COALESCE($5, status)
             WHERE id = $6 AND hospital_id = $7`,
            name ? name.trim() : null,
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            department ? department.trim() : null,
            status || null,
            sid,
            hid,
        );

        return staff;
    }

    async resetStaffPin(staffId: unknown, hospitalId: unknown, pin: any): Promise<Row | null> {
        const sid = Number(staffId);
        const hid = Number(hospitalId);
        const staff = await this.db.queryOne('SELECT * FROM hospital_admins WHERE id = $1 AND hospital_id = $2', sid, hid);
        if (!staff) return null;

        await this.db.execute('UPDATE hospital_admins SET pin = $1 WHERE id = $2 AND hospital_id = $3', pin.trim(), sid, hid);
        return staff;
    }

    async deleteStaff(staffId: unknown, hospitalId: unknown): Promise<{ notFound?: boolean; isLastSuperAdmin?: boolean; staff?: Row }> {
        const sid = Number(staffId);
        const hid = Number(hospitalId);
        const staff = await this.db.queryOne('SELECT * FROM hospital_admins WHERE id = $1 AND hospital_id = $2', sid, hid);
        if (!staff) return { notFound: true };

        if (staff.role === 'Hospital Super Admin') {
            const row = await this.db.queryOne(
                `SELECT COUNT(*) as count
                 FROM hospital_admins
                 WHERE hospital_id = $1 AND role = 'Hospital Super Admin' AND status = 'Active'`,
                hid,
            );
            const superAdminCount = row?.count || 0;

            if (superAdminCount <= 1) {
                return { isLastSuperAdmin: true };
            }
        }

        await this.db.execute('DELETE FROM hospital_admins WHERE id = $1 AND hospital_id = $2', sid, hid);
        return { staff };
    }
}
