const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');
const { generateUniqueReferralCode } = require('../services/referral.service');

const StudentModel = {
    findByRoll(rollNumber) {
        if (!rollNumber) return null;
        const row = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.roll_number = ?
        `).get(rollNumber.toString().trim());
        return clean(row);
    },

    findById(id) {
        if (!id) return null;
        const row = db.prepare(`
            SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE s.id = ?
        `).get(id);
        return clean(row);
    },

    findByReferralCode(code) {
        if (!code) return null;
        const row = db.prepare(`
            SELECT s.id, s.name, s.roll_number, s.posting_unit, s.referral_code,
                   c.name as college_name, c.city as college_city
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE UPPER(TRIM(s.referral_code)) = UPPER(TRIM(?))
        `).get(code.toString().trim());
        return clean(row);
    },

    getAll() {
        const rows = db.prepare(`
            SELECT s.*, c.name as college_name,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            ORDER BY s.roll_number ASC
        `).all();
        return cleanList(rows);
    },

    create({ roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status }) {
        const cleanRoll = roll_number.toString().trim();
        const cleanName = name.trim();
        const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';
        const cleanEmail = email && email.trim() ? email.trim() : null;
        const cleanPhone = phone && phone.trim() ? phone.trim() : null;
        const cleanBatch = batch_year && batch_year.trim() ? batch_year.trim() : '3rd Year MBBS (Community Medicine)';
        const cleanUnit = posting_unit && posting_unit.trim() ? posting_unit.trim() : 'RHTC - Rural Health Training Center';
        const cleanCollege = college_id ? Number(college_id) : 1;
        const cleanStatus = status && status.trim() ? status.trim() : 'Active';
        const referralCode = generateUniqueReferralCode(db, cleanCollege, cleanRoll);

        const stmt = db.prepare(`
            INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, referral_code, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanRoll,
            cleanName,
            cleanPin,
            cleanEmail,
            cleanPhone,
            cleanBatch,
            cleanUnit,
            cleanCollege,
            referralCode,
            cleanStatus
        );

        return this.findById(Number(result.lastInsertRowid));
    },

    getProfile(studentId, rollNumber) {
        let student = null;
        if (studentId) {
            student = this.findById(studentId);
        } else if (rollNumber) {
            student = this.findByRoll(rollNumber);
        } else {
            const first = db.prepare(`
                SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                ORDER BY s.id ASC LIMIT 1
            `).get();
            student = clean(first);
        }

        if (!student) return null;
        const sid = student.id;

        // Aggregated Clinical Statistics
        const statsRow = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM families WHERE student_id = ?) as total_families,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_members,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = ? AND (m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL OR m.anc_taken != 'NA' OR m.is_underweight != 'NA')) as completed_surveys,
                (SELECT COUNT(*) FROM follow_ups WHERE student_id = ?) as total_followups,
                (SELECT COUNT(c.id) FROM member_conditions c JOIN family_members m ON c.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_conditions,
                (SELECT COUNT(med.id) FROM member_medications med JOIN family_members m ON med.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_medications
        `).get(sid, sid, sid, sid, sid, sid);

        // Assigned Families Directory
        const families = db.prepare(`
            SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.family_name, 
                   f.village_ward, f.village, f.contact_number, f.total_cu, f.calorie_status,
                   COUNT(m.id) as member_count,
                   SUM(CASE WHEN m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL THEN 1 ELSE 0 END) as surveyed_members
            FROM families f
            LEFT JOIN family_members m ON f.id = m.family_id
            WHERE f.student_id = ?
            GROUP BY f.id
            ORDER BY f.family_no ASC
        `).all(sid);

        // Recent Clinical Activity (Follow-ups, Diagnoses)
        const recentActivity = db.prepare(`
            SELECT v.id, v.visit_date, v.visit_number, v.sbp, v.dbp, v.rbs, v.health_progress, v.treatment_compliance, v.clinical_notes,
                   m.name as member_name, m.relation_to_hof, m.gender, m.age_years,
                   f.id as family_id, f.family_code, f.head_of_family
            FROM follow_ups v
            JOIN family_members m ON v.member_id = m.id
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ?
            ORDER BY v.visit_date DESC, v.id DESC
            LIMIT 10
        `).all(sid);

        const studentClean = { ...student };
        delete studentClean.pin;

        return {
            student: studentClean,
            stats: clean(statsRow),
            families: cleanList(families),
            recentActivity: cleanList(recentActivity)
        };
    },

    updateProfile(sid, { name, email, phone, batch_year, posting_unit }) {
        db.prepare(`
            UPDATE students
            SET name = COALESCE(?, name),
                email = ?,
                phone = ?,
                batch_year = COALESCE(?, batch_year),
                posting_unit = COALESCE(?, posting_unit)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            sid
        );

        const updated = this.findById(sid);
        if (updated) {
            delete updated.pin;
        }
        return updated;
    },

    changePin(sid, currentPin, newPin) {
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid);
        if (!student) return { notFound: true };

        const expectedPin = student.pin || '1234';
        if (currentPin.trim() !== expectedPin) {
            return { invalidPin: true };
        }

        db.prepare('UPDATE students SET pin = ? WHERE id = ?').run(newPin.trim(), sid);
        return { success: true };
    },

    provisionPatient(studentId, studentReferralCode, { member_id, phone, pin, name }) {
        // Validate that member belongs to this student cadet
        const member = db.prepare(`
            SELECT m.*, f.student_id, f.head_of_family
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            WHERE m.id = ? AND f.student_id = ?
        `).get(member_id, studentId);

        if (!member) {
            return { forbidden: true };
        }

        const patientName = (name && name.trim()) ? name.trim() : member.name;
        let patientPhone = (phone && phone.trim()) ? phone.replace(/[^0-9]/g, '') : (member.contact_number ? member.contact_number.replace(/[^0-9]/g, '') : '');

        if (patientPhone.length < 10) {
            patientPhone = `98${String(member.id).padStart(8, '0')}`;
        }

        const patientPin = (pin && pin.trim().length >= 4) ? pin.trim() : '1234';

        // Check if patient already exists for this member
        const existing = db.prepare('SELECT * FROM patients WHERE family_member_id = ? OR phone = ?').get(member.id, patientPhone);
        if (existing) {
            if (pin && pin.trim().length >= 4) {
                db.prepare('UPDATE patients SET pin = ? WHERE id = ?').run(patientPin, existing.id);
            }
            return {
                alreadyExists: true,
                message: `Patient account already exists for ${existing.name}.`,
                patient_uid: existing.patient_uid,
                phone: existing.phone,
                pin: patientPin,
                name: existing.name
            };
        }

        // Generate Unique Patient UID
        let patientUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            patientUid = `PAT-${new Date().getFullYear()}-${randSuffix}`;
            const collision = db.prepare('SELECT id FROM patients WHERE patient_uid = ?').get(patientUid);
            if (!collision) break;
        }

        db.prepare(`
            INSERT INTO patients (patient_uid, name, phone, pin, date_of_birth, age_years, gender, model_type, student_id, referral_code_used, family_member_id, hospital_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Dependent', ?, ?, ?, 1, 'Active')
        `).run(
            patientUid,
            patientName,
            patientPhone,
            patientPin,
            member.date_of_birth,
            member.age_years,
            member.gender,
            studentId,
            studentReferralCode,
            member.id
        );

        return {
            created: true,
            patient_uid: patientUid,
            phone: patientPhone,
            pin: patientPin,
            name: patientName
        };
    }
};

module.exports = StudentModel;
