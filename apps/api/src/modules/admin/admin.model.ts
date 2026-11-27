import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';
import { generateUniqueReferralCode } from '../../common/referral';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Injectable()
export class AdminModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async findByUsername(username: any): Promise<Row | null> {
        if (!username) return null;
        const row = await this.db.queryOne('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', username.trim());
        return clean(row);
    }

    async findById(id: any): Promise<Row | null> {
        if (!id) return null;
        const row = await this.db.queryOne('SELECT * FROM admins WHERE id = $1', Number(id));
        return clean(row);
    }

    async getStats(): Promise<Row> {
        const [
            totalStudents,
            activeStudents,
            totalFamilies,
            totalMembers,
            totalFollowups,
            totalColleges,
            totalHtn,
            totalDm,
            totalAnaemia,
            totalMalnutrition,
            collegesBreakdown,
            recentFamilies,
            recentFollowups,
        ] = await Promise.all([
            this.db.queryOne('SELECT COUNT(*) as c FROM students'),
            this.db.queryOne("SELECT COUNT(*) as c FROM students WHERE status = 'Active'"),
            this.db.queryOne('SELECT COUNT(*) as c FROM families'),
            this.db.queryOne('SELECT COUNT(*) as c FROM family_members'),
            this.db.queryOne('SELECT COUNT(*) as c FROM follow_ups'),
            this.db.queryOne('SELECT COUNT(*) as c FROM colleges'),
            this.db.queryOne("SELECT COUNT(*) as c FROM family_members WHERE has_htn = 'Y'"),
            this.db.queryOne("SELECT COUNT(*) as c FROM family_members WHERE has_dm = 'Y'"),
            this.db.queryOne("SELECT COUNT(*) as c FROM family_members WHERE has_anaemia = 'Y'"),
            this.db.queryOne("SELECT COUNT(*) as c FROM family_members WHERE is_underweight = 'Y' OR is_wasting = 'Y' OR is_severe_wasting = 'Y'"),
            this.db.queryAll(`
                SELECT c.id, c.name, c.code, c.city, c.state,
                       (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                       (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count,
                       (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as members_count
                FROM colleges c
                ORDER BY c.name ASC
            `),
            this.db.queryAll(`
                SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.created_at, f.village,
                       s.roll_number, s.name as student_name,
                       (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
                FROM families f
                JOIN students s ON f.student_id = s.id
                ORDER BY f.id DESC
                LIMIT 6
            `),
            this.db.queryAll(`
                SELECT fu.id, fu.visit_number, fu.visit_date, fu.health_progress, fu.treatment_compliance, fu.clinical_notes,
                       m.name as member_name, f.family_no, s.roll_number, s.name as student_name
                FROM follow_ups fu
                JOIN family_members m ON fu.member_id = m.id
                JOIN families f ON m.family_id = f.id
                JOIN students s ON f.student_id = s.id
                ORDER BY fu.id DESC
                LIMIT 6
            `),
        ]);

        return {
            overview: {
                total_students: totalStudents?.c || 0,
                active_students: activeStudents?.c || 0,
                total_families: totalFamilies?.c || 0,
                total_members: totalMembers?.c || 0,
                total_followups: totalFollowups?.c || 0,
                total_colleges: totalColleges?.c || 0,
            },
            burden: {
                total_htn: totalHtn?.c || 0,
                total_dm: totalDm?.c || 0,
                total_anaemia: totalAnaemia?.c || 0,
                total_malnutrition: totalMalnutrition?.c || 0,
            },
            colleges: cleanList(collegesBreakdown),
            recent_families: cleanList(recentFamilies),
            recent_followups: cleanList(recentFollowups),
        };
    }

    async getStudents({ college_id, status, search }: Record<string, any>): Promise<Row[]> {
        let query = `
            SELECT s.*, c.name as college_name, ay.label as academic_year,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count,
                   (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = s.id) as members_count,
                   (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = s.id) as followups_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (college_id) {
            params.push(Number(college_id));
            query += ` AND s.college_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND s.status = $${params.length}`;
        }
        if (search) {
            const term = `%${search.trim()}%`;
            params.push(term);
            const p = `$${params.length}`;
            query += ` AND (s.name ILIKE ${p} OR s.roll_number ILIKE ${p} OR s.email ILIKE ${p})`;
        }

        query += ` ORDER BY s.roll_number ASC`;
        const rows = await this.db.queryAll(query, ...params);
        return cleanList(rows);
    }

    private async academicYearId(value: unknown, fallbackToCurrent: boolean): Promise<number | null> {
        if (value !== undefined && value !== null && value !== '') {
            const row = await this.db.queryOne('SELECT id FROM academic_years WHERE id = $1', Number(value));
            if (row) return Number(row.id);
        }
        if (!fallbackToCurrent) return null;
        const current = await this.db.queryOne('SELECT id FROM academic_years WHERE is_current = 1');
        return current ? Number(current.id) : null;
    }

    async createStudent(
        { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status, academic_year_id }: Record<string, any>,
        requesterAdmin: Row,
    ): Promise<Row> {
        const cleanRoll = roll_number.toString().trim();
        const existing = await this.db.queryOne('SELECT id FROM students WHERE LOWER(roll_number) = LOWER($1)', cleanRoll);
        if (existing) {
            return { conflict: true, message: `Cadet with Roll Number "${cleanRoll}" is already registered.` };
        }

        const targetCollegeId = college_id ? Number(college_id) : (requesterAdmin.university_id || 1);
        const referralCode = await generateUniqueReferralCode(this.db, targetCollegeId, cleanRoll);
        const ayId = await this.academicYearId(academic_year_id, true);

        const result = await this.db.insert(
            `INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, referral_code, status, academic_year_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            cleanRoll,
            name.trim(),
            pin && pin.toString().trim() ? pin.toString().trim() : '1234',
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : '3rd Year MBBS (Community Medicine)',
            posting_unit ? posting_unit.trim() : 'RHTC - Rural Health Training Center',
            targetCollegeId,
            referralCode,
            status ? status.trim() : 'Active',
            ayId,
        );

        const newStudent = await this.db.queryOne(
            `SELECT s.*, c.name as college_name
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE s.id = $1`,
            result.lastInsertRowid,
        );

        return { student: clean(newStudent) };
    }

    async updateStudent(
        studentId: any,
        { name, email, phone, batch_year, posting_unit, college_id, status, academic_year_id }: Record<string, any>,
    ): Promise<Row | null> {
        const sid = Number(studentId);
        const current = await this.db.queryOne('SELECT * FROM students WHERE id = $1', sid);
        if (!current) return null;

        if (academic_year_id !== undefined) {
            const ayId = await this.academicYearId(academic_year_id, false);
            await this.db.execute('UPDATE students SET academic_year_id = $1 WHERE id = $2', ayId, sid);
        }

        await this.db.execute(
            `UPDATE students
             SET name = COALESCE($1, name),
                 email = $2,
                 phone = $3,
                 batch_year = COALESCE($4, batch_year),
                 posting_unit = COALESCE($5, posting_unit),
                 college_id = COALESCE($6, college_id),
                 status = COALESCE($7, status)
             WHERE id = $8`,
            name ? name.trim() : null,
            email !== undefined ? (email ? email.trim() : null) : current.email,
            phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            college_id ? Number(college_id) : null,
            status ? status.trim() : null,
            sid,
        );

        const updated = await this.db.queryOne(
            `SELECT s.*, c.name as college_name
             FROM students s
             LEFT JOIN colleges c ON s.college_id = c.id
             WHERE s.id = $1`,
            sid,
        );

        return clean(updated);
    }

    async resetStudentPin(studentId: any, newPin = '1234'): Promise<Row | null> {
        const sid = Number(studentId);
        const student = await this.db.queryOne('SELECT id, roll_number, name FROM students WHERE id = $1', sid);
        if (!student) return null;

        await this.db.execute('UPDATE students SET pin = $1 WHERE id = $2', newPin, sid);
        return student;
    }

    async deleteStudent(studentId: any): Promise<Row | null> {
        const sid = Number(studentId);
        const student = await this.db.queryOne('SELECT id, roll_number, name FROM students WHERE id = $1', sid);
        if (!student) return null;

        await this.db.execute('DELETE FROM students WHERE id = $1', sid);
        return student;
    }

    async getStudentFamilies(studentId: any): Promise<Row | null> {
        const sid = Number(studentId);
        const student = await this.db.queryOne(
            'SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = $1',
            sid,
        );
        if (!student) return null;

        const families = await this.db.queryAll(
            `SELECT f.*,
                    (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count,
                    (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = f.student_id) as total_followups
             FROM families f
             WHERE f.student_id = $1
             ORDER BY f.family_no ASC`,
            sid,
        );

        return {
            student: clean(student),
            families: cleanList(families),
        };
    }

    async getFamilies({ student_id, college_id, village, search }: Record<string, any>): Promise<Row[]> {
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name, c.name as college_name,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (student_id) {
            params.push(Number(student_id));
            query += ` AND f.student_id = $${params.length}`;
        }
        if (college_id) {
            params.push(Number(college_id));
            query += ` AND s.college_id = $${params.length}`;
        }
        if (village) {
            params.push(village);
            query += ` AND f.village = $${params.length}`;
        }
        if (search) {
            const term = `%${search.trim()}%`;
            params.push(term);
            const p = `$${params.length}`;
            query += ` AND (f.head_of_family ILIKE ${p} OR f.family_code ILIKE ${p} OR f.village ILIKE ${p} OR s.roll_number ILIKE ${p} OR s.name ILIKE ${p})`;
        }

        query += ` ORDER BY f.id DESC`;
        const rows = await this.db.queryAll(query, ...params);
        return cleanList(rows);
    }

    async getMembers({ has_htn, has_dm, has_anaemia, search }: Record<string, any>): Promise<Row[]> {
        let query = `
            SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village,
                   s.roll_number, s.name as student_name, c.name as college_name
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (has_htn) {
            params.push(has_htn);
            query += ` AND m.has_htn = $${params.length}`;
        }
        if (has_dm) {
            params.push(has_dm);
            query += ` AND m.has_dm = $${params.length}`;
        }
        if (has_anaemia) {
            params.push(has_anaemia);
            query += ` AND m.has_anaemia = $${params.length}`;
        }
        if (search) {
            const term = `%${search.trim()}%`;
            params.push(term);
            const p = `$${params.length}`;
            query += ` AND (m.name ILIKE ${p} OR m.diagnosis ILIKE ${p} OR f.head_of_family ILIKE ${p} OR s.roll_number ILIKE ${p})`;
        }

        query += ` ORDER BY m.id DESC LIMIT 100`;
        const rows = await this.db.queryAll(query, ...params);
        return cleanList(rows);
    }

    async getUniversityAdmins(uniId: any): Promise<Row> {
        const uid = Number(uniId);
        const college = await this.db.queryOne('SELECT * FROM colleges WHERE id = $1', uid);
        const maxQuota = (college && college.max_admins) ? college.max_admins : 10;

        const admins = await this.db.queryAll(
            `SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                    c.name as university_name, c.code as university_code
             FROM admins a
             LEFT JOIN colleges c ON a.university_id = c.id
             WHERE a.university_id = $1
             ORDER BY CASE WHEN a.role LIKE '%Super Admin%' THEN 1 ELSE 2 END, a.id ASC`,
            uid,
        );

        const superAdminCount = admins.filter((a) => a.role === 'University Super Admin' || a.role === 'Super Admin').length;
        const regularAdmins = admins.filter((a) => a.role !== 'University Super Admin' && a.role !== 'Super Admin');
        const adminCount = regularAdmins.length;

        return {
            university: clean(college),
            quota: {
                max_admins: maxQuota,
                current_admins: adminCount,
                remaining_seats: Math.max(0, maxQuota - adminCount),
                super_admin_count: superAdminCount,
                is_at_capacity: adminCount >= maxQuota,
            },
            admins: cleanList(admins),
        };
    }

    async createUniversityAdmin(
        { username, name, pin, email, phone, role, university_id, status }: Record<string, any>,
        requesterAdmin: Row,
    ): Promise<Row> {
        const targetUniId = university_id ? Number(university_id) : (requesterAdmin.university_id || 1);
        const college = await this.db.queryOne('SELECT * FROM colleges WHERE id = $1', targetUniId);
        if (!college) {
            return { notFound: true, message: 'Target university institution not found' };
        }

        const maxQuota = college.max_admins || 10;
        const targetRole = (role && role.includes('Super Admin')) ? 'University Super Admin' : 'University Admin';

        if (targetRole === 'University Super Admin') {
            const existingSuper = await this.db.queryOne(
                `SELECT id, name, username FROM admins
                 WHERE university_id = $1 AND (role = 'University Super Admin' OR role = 'Super Admin')`,
                targetUniId,
            );
            if (existingSuper) {
                return {
                    conflict: true,
                    message: `University "${college.name}" already has an appointed Super Admin: ${existingSuper.name} (${existingSuper.username}). Each university can have only 1 Super Admin.`,
                };
            }
        } else {
            const currentRow = await this.db.queryOne(
                `SELECT COUNT(*) as c FROM admins
                 WHERE university_id = $1 AND role != 'University Super Admin' AND role != 'Super Admin'`,
                targetUniId,
            );
            const currentCount = currentRow?.c || 0;

            if (currentCount >= maxQuota) {
                return {
                    quotaExceeded: true,
                    message: `University Admin quota exceeded for "${college.name}". Maximum ${maxQuota} University Admins allowed (Current: ${currentCount}/${maxQuota} seats used).`,
                };
            }
        }

        const cleanUser = username.toString().trim();
        const existingUser = await this.db.queryOne('SELECT id FROM admins WHERE LOWER(username) = LOWER($1)', cleanUser);
        if (existingUser) {
            return { userConflict: true, message: `Admin username "${cleanUser}" is already taken.` };
        }

        const result = await this.db.insert(
            `INSERT INTO admins (username, name, pin, email, phone, role, university_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            cleanUser,
            name.trim(),
            pin && pin.toString().trim() ? pin.toString().trim() : '9999',
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            targetRole,
            targetUniId,
            status || 'Active',
        );

        const newAdmin = await this.db.queryOne(
            `SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                    c.name as university_name, c.code as university_code
             FROM admins a
             LEFT JOIN colleges c ON a.university_id = c.id
             WHERE a.id = $1`,
            result.lastInsertRowid,
        );

        return {
            collegeName: college.name,
            admin: clean(newAdmin),
        };
    }

    async updateUniversityAdmin(adminId: any, { name, email, phone, status }: Record<string, any>): Promise<Row | null> {
        const aid = Number(adminId);
        const current = await this.db.queryOne('SELECT * FROM admins WHERE id = $1', aid);
        if (!current) return null;

        await this.db.execute(
            `UPDATE admins
             SET name = COALESCE($1, name),
                 email = $2,
                 phone = $3,
                 status = COALESCE($4, status)
             WHERE id = $5`,
            name ? name.trim() : null,
            email !== undefined ? (email ? email.trim() : null) : current.email,
            phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
            status ? status.trim() : null,
            aid,
        );

        const updated = await this.db.queryOne(
            `SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                    c.name as university_name, c.code as university_code
             FROM admins a
             LEFT JOIN colleges c ON a.university_id = c.id
             WHERE a.id = $1`,
            aid,
        );

        return clean(updated);
    }

    async resetUniversityAdminPin(adminId: any, newPin = '9999'): Promise<Row | null> {
        const aid = Number(adminId);
        const target = await this.db.queryOne('SELECT id, name, username FROM admins WHERE id = $1', aid);
        if (!target) return null;

        await this.db.execute('UPDATE admins SET pin = $1 WHERE id = $2', newPin, aid);
        return target;
    }

    async deleteUniversityAdmin(adminId: any): Promise<Row> {
        const aid = Number(adminId);
        const target = await this.db.queryOne('SELECT id, name, username, role, university_id FROM admins WHERE id = $1', aid);
        if (!target) return { notFound: true };

        if (target.role === 'University Super Admin' || target.role === 'Super Admin') {
            return { isSuperAdmin: true };
        }

        await this.db.execute('DELETE FROM admins WHERE id = $1', aid);
        return { target };
    }
}
