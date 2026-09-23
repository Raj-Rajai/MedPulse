const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');
const { generateUniqueReferralCode } = require('../services/referral.service');
const CollegeModel = require('./college.model');

const AdminModel = {
    findByUsername(username) {
        if (!username) return null;
        const row = db.prepare('SELECT * FROM admins WHERE LOWER(username) = LOWER(?)').get(username.trim());
        return clean(row);
    },

    findById(id) {
        if (!id) return null;
        const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
        return clean(row);
    },

    getStats() {
        const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get()?.c || 0;
        const activeStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get()?.c || 0;
        const totalFamilies = db.prepare('SELECT COUNT(*) as c FROM families').get()?.c || 0;
        const totalMembers = db.prepare('SELECT COUNT(*) as c FROM family_members').get()?.c || 0;
        const totalFollowups = db.prepare('SELECT COUNT(*) as c FROM follow_ups').get()?.c || 0;
        const totalColleges = db.prepare('SELECT COUNT(*) as c FROM colleges').get()?.c || 0;

        // Epidemiological Disease Burden in Catchment Area
        const totalHtn = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_htn = 'Y'").get()?.c || 0;
        const totalDm = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_dm = 'Y'").get()?.c || 0;
        const totalAnaemia = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_anaemia = 'Y'").get()?.c || 0;
        const totalMalnutrition = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE is_underweight = 'Y' OR is_wasting = 'Y' OR is_severe_wasting = 'Y'").get()?.c || 0;

        // Breakdown by Medical College
        const collegesBreakdown = db.prepare(`
            SELECT c.id, c.name, c.code, c.city, c.state,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count,
                   (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as members_count
            FROM colleges c
            ORDER BY c.name ASC
        `).all();

        // Recent Survey Activity Streams
        const recentFamilies = db.prepare(`
            SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.created_at, f.village,
                   s.roll_number, s.name as student_name,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            ORDER BY f.id DESC
            LIMIT 6
        `).all();

        const recentFollowups = db.prepare(`
            SELECT fu.id, fu.visit_number, fu.visit_date, fu.health_progress, fu.treatment_compliance, fu.clinical_notes,
                   m.name as member_name, f.family_no, s.roll_number, s.name as student_name
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            ORDER BY fu.id DESC
            LIMIT 6
        `).all();

        return {
            overview: {
                total_students: totalStudents,
                active_students: activeStudents,
                total_families: totalFamilies,
                total_members: totalMembers,
                total_followups: totalFollowups,
                total_colleges: totalColleges
            },
            burden: {
                total_htn: totalHtn,
                total_dm: totalDm,
                total_anaemia: totalAnaemia,
                total_malnutrition: totalMalnutrition
            },
            colleges: cleanList(collegesBreakdown),
            recent_families: cleanList(recentFamilies),
            recent_followups: cleanList(recentFollowups)
        };
    },

    getStudents({ college_id, status, search }) {
        let query = `
            SELECT s.*, c.name as college_name,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count,
                   (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = s.id) as members_count,
                   (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = s.id) as followups_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (college_id) {
            query += ` AND s.college_id = ?`;
            params.push(college_id);
        }
        if (status) {
            query += ` AND s.status = ?`;
            params.push(status);
        }
        if (search) {
            query += ` AND (s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY s.roll_number ASC`;
        const rows = db.prepare(query).all(...params);
        return cleanList(rows);
    },

    createStudent({ roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status }, requesterAdmin) {
        const cleanRoll = roll_number.toString().trim();
        const existing = db.prepare('SELECT id FROM students WHERE LOWER(roll_number) = LOWER(?)').get(cleanRoll);
        if (existing) {
            return { conflict: true, message: `Cadet with Roll Number "${cleanRoll}" is already registered.` };
        }

        const targetCollegeId = college_id ? Number(college_id) : (requesterAdmin.university_id || 1);
        const referralCode = generateUniqueReferralCode(db, targetCollegeId, cleanRoll);

        const stmt = db.prepare(`
            INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, referral_code, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanRoll,
            name.trim(),
            pin && pin.toString().trim() ? pin.toString().trim() : '1234',
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : '3rd Year MBBS (Community Medicine)',
            posting_unit ? posting_unit.trim() : 'RHTC - Rural Health Training Center',
            targetCollegeId,
            referralCode,
            status ? status.trim() : 'Active'
        );

        const newStudent = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.id = ?
        `).get(Number(result.lastInsertRowid));

        return { student: clean(newStudent) };
    },

    updateStudent(studentId, { name, email, phone, batch_year, posting_unit, college_id, status }) {
        const current = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!current) return null;

        db.prepare(`
            UPDATE students
            SET name = COALESCE(?, name),
                email = ?,
                phone = ?,
                batch_year = COALESCE(?, batch_year),
                posting_unit = COALESCE(?, posting_unit),
                college_id = COALESCE(?, college_id),
                status = COALESCE(?, status)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            email !== undefined ? (email ? email.trim() : null) : current.email,
            phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            college_id ? Number(college_id) : null,
            status ? status.trim() : null,
            studentId
        );

        const updated = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.id = ?
        `).get(studentId);

        return clean(updated);
    },

    resetStudentPin(studentId, newPin = '1234') {
        const student = db.prepare('SELECT id, roll_number, name FROM students WHERE id = ?').get(studentId);
        if (!student) return null;

        db.prepare('UPDATE students SET pin = ? WHERE id = ?').run(newPin, studentId);
        return student;
    },

    deleteStudent(studentId) {
        const student = db.prepare('SELECT id, roll_number, name FROM students WHERE id = ?').get(studentId);
        if (!student) return null;

        db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
        return student;
    },

    getStudentFamilies(studentId) {
        const student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(studentId);
        if (!student) return null;

        const families = db.prepare(`
            SELECT f.*,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count,
                   (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = f.student_id) as total_followups
            FROM families f
            WHERE f.student_id = ?
            ORDER BY f.family_no ASC
        `).all(studentId);

        return {
            student: clean(student),
            families: cleanList(families)
        };
    },

    getFamilies({ student_id, college_id, village, search }) {
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name, c.name as college_name,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            query += ` AND f.student_id = ?`;
            params.push(student_id);
        }
        if (college_id) {
            query += ` AND s.college_id = ?`;
            params.push(college_id);
        }
        if (village) {
            query += ` AND f.village = ?`;
            params.push(village);
        }
        if (search) {
            query += ` AND (f.head_of_family LIKE ? OR f.family_code LIKE ? OR f.village LIKE ? OR s.roll_number LIKE ? OR s.name LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term, term);
        }

        query += ` ORDER BY f.id DESC`;
        const rows = db.prepare(query).all(...params);
        return cleanList(rows);
    },

    getMembers({ has_htn, has_dm, has_anaemia, search }) {
        let query = `
            SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village,
                   s.roll_number, s.name as student_name, c.name as college_name
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (has_htn) {
            query += ` AND m.has_htn = ?`;
            params.push(has_htn);
        }
        if (has_dm) {
            query += ` AND m.has_dm = ?`;
            params.push(has_dm);
        }
        if (has_anaemia) {
            query += ` AND m.has_anaemia = ?`;
            params.push(has_anaemia);
        }
        if (search) {
            query += ` AND (m.name LIKE ? OR m.diagnosis LIKE ? OR f.head_of_family LIKE ? OR s.roll_number LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        query += ` ORDER BY m.id DESC LIMIT 100`;
        const rows = db.prepare(query).all(...params);
        return cleanList(rows);
    },

    getUniversityAdmins(uniId) {
        const college = db.prepare('SELECT * FROM colleges WHERE id = ?').get(uniId);
        const maxQuota = (college && college.max_admins) ? college.max_admins : 10;

        const admins = db.prepare(`
            SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                   c.name as university_name, c.code as university_code
            FROM admins a
            LEFT JOIN colleges c ON a.university_id = c.id
            WHERE a.university_id = ?
            ORDER BY CASE WHEN a.role LIKE '%Super Admin%' THEN 1 ELSE 2 END, a.id ASC
        `).all(uniId);

        const superAdminCount = admins.filter(a => a.role === 'University Super Admin' || a.role === 'Super Admin').length;
        const regularAdmins = admins.filter(a => a.role !== 'University Super Admin' && a.role !== 'Super Admin');
        const adminCount = regularAdmins.length;

        return {
            university: clean(college),
            quota: {
                max_admins: maxQuota,
                current_admins: adminCount,
                remaining_seats: Math.max(0, maxQuota - adminCount),
                super_admin_count: superAdminCount,
                is_at_capacity: adminCount >= maxQuota
            },
            admins: cleanList(admins)
        };
    },

    createUniversityAdmin({ username, name, pin, email, phone, role, university_id, status }, requesterAdmin) {
        const targetUniId = university_id ? Number(university_id) : (requesterAdmin.university_id || 1);
        const college = db.prepare('SELECT * FROM colleges WHERE id = ?').get(targetUniId);
        if (!college) {
            return { notFound: true, message: 'Target university institution not found' };
        }

        const maxQuota = college.max_admins || 10;
        const targetRole = (role && role.includes('Super Admin')) ? 'University Super Admin' : 'University Admin';

        // 1. Enforce 1 Super Admin constraint
        if (targetRole === 'University Super Admin') {
            const existingSuper = db.prepare(`
                SELECT id, name, username FROM admins 
                WHERE university_id = ? AND (role = 'University Super Admin' OR role = 'Super Admin')
            `).get(targetUniId);
            if (existingSuper) {
                return {
                    conflict: true,
                    message: `University "${college.name}" already has an appointed Super Admin: ${existingSuper.name} (${existingSuper.username}). Each university can have only 1 Super Admin.`
                };
            }
        } else {
            // 2. Enforce strict 10 University Admins quota constraint
            const currentCount = db.prepare(`
                SELECT COUNT(*) as c FROM admins 
                WHERE university_id = ? AND role != 'University Super Admin' AND role != 'Super Admin'
            `).get(targetUniId)?.c || 0;

            if (currentCount >= maxQuota) {
                return {
                    quotaExceeded: true,
                    message: `University Admin quota exceeded for "${college.name}". Maximum ${maxQuota} University Admins allowed (Current: ${currentCount}/${maxQuota} seats used).`
                };
            }
        }

        // 3. Username uniqueness
        const cleanUser = username.toString().trim();
        const existingUser = db.prepare('SELECT id FROM admins WHERE LOWER(username) = LOWER(?)').get(cleanUser);
        if (existingUser) {
            return { userConflict: true, message: `Admin username "${cleanUser}" is already taken.` };
        }

        const stmt = db.prepare(`
            INSERT INTO admins (username, name, pin, email, phone, role, university_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanUser,
            name.trim(),
            pin && pin.toString().trim() ? pin.toString().trim() : '9999',
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            targetRole,
            targetUniId,
            status || 'Active'
        );

        const newAdmin = db.prepare(`
            SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                   c.name as university_name, c.code as university_code
            FROM admins a
            LEFT JOIN colleges c ON a.university_id = c.id
            WHERE a.id = ?
        `).get(Number(result.lastInsertRowid));

        return {
            collegeName: college.name,
            admin: clean(newAdmin)
        };
    },

    updateUniversityAdmin(adminId, { name, email, phone, status }) {
        const current = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
        if (!current) return null;

        db.prepare(`
            UPDATE admins
            SET name = COALESCE(?, name),
                email = ?,
                phone = ?,
                status = COALESCE(?, status)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            email !== undefined ? (email ? email.trim() : null) : current.email,
            phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
            status ? status.trim() : null,
            adminId
        );

        const updated = db.prepare(`
            SELECT a.id, a.username, a.name, a.email, a.phone, a.role, a.university_id, a.status, a.created_at,
                   c.name as university_name, c.code as university_code
            FROM admins a
            LEFT JOIN colleges c ON a.university_id = c.id
            WHERE a.id = ?
        `).get(adminId);

        return clean(updated);
    },

    resetUniversityAdminPin(adminId, newPin = '9999') {
        const target = db.prepare('SELECT id, name, username FROM admins WHERE id = ?').get(adminId);
        if (!target) return null;

        db.prepare('UPDATE admins SET pin = ? WHERE id = ?').run(newPin, adminId);
        return target;
    },

    deleteUniversityAdmin(adminId) {
        const target = db.prepare('SELECT id, name, username, role, university_id FROM admins WHERE id = ?').get(adminId);
        if (!target) return { notFound: true };

        if (target.role === 'University Super Admin' || target.role === 'Super Admin') {
            return { isSuperAdmin: true };
        }

        db.prepare('DELETE FROM admins WHERE id = ?').run(adminId);
        return { target };
    }
};

module.exports = AdminModel;
