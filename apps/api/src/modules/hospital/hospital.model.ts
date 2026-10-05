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

    findByCredentials(username: string): Row | null {
        const cleanUser = username.trim();
        const admin = this.db.prepare(`
            SELECT ha.*, h.name as hospital_name, h.code as hospital_code, h.type as hospital_type, 
                   h.city as hospital_city, h.bed_capacity
            FROM hospital_admins ha
            JOIN hospitals h ON ha.hospital_id = h.id
            WHERE (ha.username = ? OR ha.phone = ? OR ha.email = ?) AND ha.status = 'Active'
        `).get(cleanUser, cleanUser, cleanUser);
        return clean(admin);
    }

    findById(id: unknown): Row | null {
        const row = this.db.prepare('SELECT * FROM hospital_admins WHERE id = ?').get(id);
        return clean(row);
    }

    getStats(hospitalId: unknown) {
        const totalPatients = this.db.prepare('SELECT COUNT(*) as count FROM patients WHERE hospital_id = ?').get(hospitalId)!.count;
        const independentPatients = this.db.prepare("SELECT COUNT(*) as count FROM patients WHERE hospital_id = ? AND model_type = 'Independent'").get(hospitalId)!.count;
        const dependentPatients = this.db.prepare("SELECT COUNT(*) as count FROM patients WHERE hospital_id = ? AND model_type = 'Dependent'").get(hospitalId)!.count;

        const morbidityStats = this.db.prepare(`
            SELECT 
                COUNT(DISTINCT CASE WHEN fm.has_htn = 'Y' THEN p.id END) as htn_cases,
                COUNT(DISTINCT CASE WHEN fm.has_dm = 'Y' THEN p.id END) as dm_cases,
                COUNT(DISTINCT CASE WHEN fm.has_anaemia = 'Y' THEN p.id END) as anaemia_cases,
                COUNT(DISTINCT CASE WHEN fm.is_underweight = 'Y' THEN p.id END) as underweight_children
            FROM patients p
            JOIN family_members fm ON p.family_member_id = fm.id
            WHERE p.hospital_id = ?
        `).get(hospitalId);

        const uniBreakdown = this.db.prepare(`
            SELECT c.id as university_id, c.name as university_name, c.code as university_code, COUNT(p.id) as patient_count
            FROM patients p
            JOIN students s ON p.student_id = s.id
            JOIN colleges c ON s.college_id = c.id
            WHERE p.hospital_id = ? AND p.model_type = 'Dependent'
            GROUP BY c.id, c.name, c.code
            ORDER BY patient_count DESC
        `).all(hospitalId);

        const followUpsCount = this.db.prepare(`
            SELECT COUNT(fu.id) as count
            FROM follow_ups fu
            JOIN family_members fm ON fu.member_id = fm.id
            JOIN patients p ON p.family_member_id = fm.id
            WHERE p.hospital_id = ?
        `).get(hospitalId)!.count;

        return {
            totals: {
                total_patients: totalPatients,
                independent_patients: independentPatients,
                dependent_patients: dependentPatients,
                follow_up_visits: followUpsCount,
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

    getFilterOptions() {
        const universities = this.db.prepare('SELECT id, name, code, city FROM colleges ORDER BY name ASC').all();
        const students = this.db.prepare(`
            SELECT s.id, s.name, s.roll_number, s.college_id, c.name as college_name, s.referral_code
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            ORDER BY s.name ASC
        `).all();

        return {
            universities: cleanList(universities),
            students: cleanList(students),
        };
    }

    getPatients(hospitalId: unknown, { university_id, student_id, model_type, condition, search, limit = 50, offset = 0 }: PatientFilters): Row[] {
        let query = `
            SELECT 
                p.id, p.patient_uid, p.name, p.phone, p.age_years, p.gender, p.address,
                p.model_type, p.referral_code_used, p.status, p.created_at,
                p.student_id, s.name as student_name, s.roll_number as student_roll,
                c.id as university_id, c.name as university_name, c.code as university_code,
                fm.id as family_member_id, fm.has_htn, fm.sbp, fm.dbp, fm.has_dm, fm.rbs, 
                fm.has_anaemia, fm.hb, fm.bmi, fm.is_underweight,
                (
                    SELECT GROUP_CONCAT(condition_name, ', ') 
                    FROM member_conditions mc 
                    WHERE mc.member_id = p.family_member_id
                ) as conditions_summary
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            LEFT JOIN family_members fm ON p.family_member_id = fm.id
            WHERE p.hospital_id = ?
        `;

        const params: any[] = [hospitalId];

        if (university_id) {
            query += ' AND c.id = ?';
            params.push(university_id);
        }

        if (student_id) {
            query += ' AND s.id = ?';
            params.push(student_id);
        }

        if (model_type) {
            query += ' AND p.model_type = ?';
            params.push(model_type);
        }

        if (condition === 'HTN') {
            query += ` AND (fm.has_htn = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name LIKE '%Hypertension%'))`;
        } else if (condition === 'DM') {
            query += ` AND (fm.has_dm = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name LIKE '%Diabetes%'))`;
        } else if (condition === 'Anaemia') {
            query += ` AND (fm.has_anaemia = 'Y' OR p.id IN (SELECT p2.id FROM patients p2 JOIN member_conditions mc2 ON p2.family_member_id = mc2.member_id WHERE mc2.condition_name LIKE '%Anaemia%' OR mc2.condition_name LIKE '%Anemia%'))`;
        } else if (condition === 'Pediatric') {
            query += ` AND (fm.is_underweight = 'Y' OR p.age_years <= 5)`;
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            query += ' AND (p.name LIKE ? OR p.phone LIKE ? OR p.patient_uid LIKE ? OR s.name LIKE ? OR s.roll_number LIKE ?)';
            params.push(term, term, term, term, term);
        }

        query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const patients = this.db.prepare(query).all(...params);
        return cleanList(patients);
    }

    getPatientDossier(patientId: unknown, hospitalId: unknown) {
        const patient = this.db.prepare(`
            SELECT 
                p.*, 
                s.name as student_name, s.roll_number as student_roll, s.phone as student_phone, s.posting_unit as student_unit,
                c.id as university_id, c.name as university_name, c.code as university_code,
                h.name as hospital_name, h.code as hospital_code
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            LEFT JOIN hospitals h ON p.hospital_id = h.id
            WHERE p.id = ? AND p.hospital_id = ?
        `).get(patientId, hospitalId);

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
            vitals = this.db.prepare(`
                SELECT fm.*, f.head_of_family, f.village_ward, f.district, f.state, f.calorie_intake_per_cu
                FROM family_members fm
                JOIN families f ON fm.family_id = f.id
                WHERE fm.id = ?
            `).get(patient.family_member_id);

            conditions = this.db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(patient.family_member_id);
            medications = this.db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(patient.family_member_id);
            allergies = this.db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(patient.family_member_id);
            history = this.db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY id DESC').all(patient.family_member_id);
            lifestyle = this.db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(patient.family_member_id);
            followUps = this.db.prepare('SELECT * FROM follow_ups WHERE member_id = ? ORDER BY visit_date DESC').all(patient.family_member_id);
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

    getStaff(hospitalId: unknown, hospitalAdmin: Row) {
        const staff = this.db.prepare(`
            SELECT id, hospital_id, username, name, email, phone, role, department, status, created_at
            FROM hospital_admins
            WHERE hospital_id = ?
            ORDER BY CASE WHEN role = 'Hospital Super Admin' THEN 1 ELSE 2 END, id ASC
        `).all(hospitalId);

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

    createStaff(
        hospitalId: unknown,
        hospitalAdmin: Row,
        { username, name, email, phone, pin = '8888', role = 'Hospital Admin', department = 'General Medicine' }: StaffInput,
    ): Row {
        const maxSuperAdmins = hospitalAdmin.max_super_admins || 3;
        const maxAdmins = hospitalAdmin.max_admins || 20;

        if (role === 'Hospital Super Admin') {
            const currentSuperAdmins = this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM hospital_admins 
                WHERE hospital_id = ? AND role = 'Hospital Super Admin' AND status = 'Active'
            `).get(hospitalId)!.count;

            if (currentSuperAdmins >= maxSuperAdmins) {
                return {
                    quotaError: true,
                    message: `Hospital Super Admin quota reached (Maximum ${maxSuperAdmins} Super Admins allowed per hospital).`,
                };
            }
        } else {
            const currentAdmins = this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM hospital_admins 
                WHERE hospital_id = ? AND role = 'Hospital Admin' AND status = 'Active'
            `).get(hospitalId)!.count;

            if (currentAdmins >= maxAdmins) {
                return {
                    quotaError: true,
                    message: `Hospital Admin quota reached (Maximum ${maxAdmins} Admins allowed per hospital).`,
                };
            }
        }

        const cleanUser = username.trim().toLowerCase();
        const existing = this.db.prepare('SELECT id FROM hospital_admins WHERE username = ?').get(cleanUser);
        if (existing) {
            return {
                userConflict: true,
                message: 'Username already taken. Please choose another username.',
            };
        }

        const result = this.db.prepare(`
            INSERT INTO hospital_admins (hospital_id, username, name, email, phone, pin, role, department, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
        `).run(
            hospitalId,
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

    updateStaff(staffId: unknown, hospitalId: unknown, { name, email, phone, department, status }: StaffUpdateInput): Row | null {
        const staff = this.db.prepare('SELECT * FROM hospital_admins WHERE id = ? AND hospital_id = ?').get(staffId, hospitalId);
        if (!staff) return null;

        this.db.prepare(`
            UPDATE hospital_admins 
            SET name = COALESCE(?, name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                department = COALESCE(?, department),
                status = COALESCE(?, status)
            WHERE id = ? AND hospital_id = ?
        `).run(
            name ? name.trim() : null,
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            department ? department.trim() : null,
            status || null,
            staffId,
            hospitalId,
        );

        return staff;
    }

    resetStaffPin(staffId: unknown, hospitalId: unknown, pin: any): Row | null {
        const staff = this.db.prepare('SELECT * FROM hospital_admins WHERE id = ? AND hospital_id = ?').get(staffId, hospitalId);
        if (!staff) return null;

        this.db.prepare('UPDATE hospital_admins SET pin = ? WHERE id = ? AND hospital_id = ?').run(pin.trim(), staffId, hospitalId);
        return staff;
    }

    deleteStaff(staffId: unknown, hospitalId: unknown): { notFound?: boolean; isLastSuperAdmin?: boolean; staff?: Row } {
        const staff = this.db.prepare('SELECT * FROM hospital_admins WHERE id = ? AND hospital_id = ?').get(staffId, hospitalId);
        if (!staff) return { notFound: true };

        if (staff.role === 'Hospital Super Admin') {
            const superAdminCount = this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM hospital_admins 
                WHERE hospital_id = ? AND role = 'Hospital Super Admin' AND status = 'Active'
            `).get(hospitalId)!.count;

            if (superAdminCount <= 1) {
                return { isLastSuperAdmin: true };
            }
        }

        this.db.prepare('DELETE FROM hospital_admins WHERE id = ? AND hospital_id = ?').run(staffId, hospitalId);
        return { staff };
    }
}
