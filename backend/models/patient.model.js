const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');

const PatientModel = {
    findById(id) {
        if (!id) return null;
        const row = db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.id = ?
        `).get(id);
        return clean(row);
    },

    findByPhone(phone) {
        if (!phone) return null;
        const row = db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.phone = ?
        `).get(phone);
        return clean(row);
    },

    verifyReferral(code) {
        if (!code) return null;
        const student = db.prepare(`
            SELECT s.id, s.name, s.roll_number, s.posting_unit, s.referral_code,
                   c.name as college_name, c.city as college_city
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE UPPER(TRIM(s.referral_code)) = UPPER(TRIM(?))
        `).get(code.toString().trim());
        return clean(student);
    },

    register({ name, phone, pin, email, gender, age_years, date_of_birth, address, is_adopted, referral_code }) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const cleanPin = (pin && pin.trim().length >= 4) ? pin.trim() : '1234';

        // Check if phone already registered
        const existing = db.prepare('SELECT id, phone, patient_uid FROM patients WHERE phone = ?').get(cleanPhone);
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
            const collision = db.prepare('SELECT id FROM patients WHERE patient_uid = ?').get(patientUid);
            if (!collision) break;
        }

        // Attempt to auto-link with family_members record by contact_number
        let familyMemberId = null;
        const matchingMember = db.prepare('SELECT id FROM family_members WHERE contact_number = ? LIMIT 1').get(cleanPhone);
        if (matchingMember) {
            familyMemberId = matchingMember.id;
        }

        const insertStmt = db.prepare(`
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
            ({ m: 'M', male: 'M', f: 'F', female: 'F' })[String(gender || '').trim().toLowerCase()] || 'Other',
            address ? address.trim() : null,
            modelType,
            studentId,
            referralCodeUsed,
            familyMemberId
        );

        // Auto-create the patient's card + household (patient becomes head of family)
        require('./patient-family.model').ensureFamily(Number(result.lastInsertRowid));

        const newPatient = this.findById(Number(result.lastInsertRowid));

        return {
            modelType,
            patient: newPatient,
            token: `patient-${newPatient.id}`
        };
    },

    login(identifier, pin) {
        const cleanId = identifier.trim();
        const digitsOnly = cleanId.replace(/[^0-9]/g, '');

        let patient = null;
        if (digitsOnly.length === 10) {
            patient = db.prepare(`
                SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                       c.name as college_name, c.city as college_city
                FROM patients p
                LEFT JOIN students s ON p.student_id = s.id
                LEFT JOIN colleges c ON s.college_id = c.id
                WHERE p.phone = ? OR p.phone = ?
            `).get(cleanId, digitsOnly);
        }

        if (!patient) {
            patient = db.prepare(`
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
    },

    linkReferral(patientId, referralCode, currentPatient) {
        const student = this.verifyReferral(referralCode.trim());
        if (!student) {
            return { notFound: true, message: 'Invalid medical cadet referral code.' };
        }

        let familyMemberId = null;
        {
            const memberMatch = db.prepare(`
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

        db.prepare(`
            UPDATE patients
            SET model_type = 'Dependent',
                student_id = ?,
                referral_code_used = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(student.id, student.referral_code, patientId);

        // Household: move into the surveyed family, or let the student adopt the patient's family
        require('./patient-family.model').onStudentLinked(patientId, student.id, familyMemberId);

        const updated = this.findById(patientId);
        return {
            student,
            patient: updated
        };
    },

    getRecords(patient) {
        let memberId = patient.family_member_id;

        // Auto-match member by phone if not linked yet
        if (!memberId && patient.phone) {
            const match = db.prepare('SELECT id FROM family_members WHERE contact_number = ? LIMIT 1').get(patient.phone);
            if (match) {
                memberId = match.id;
                db.prepare('UPDATE patients SET family_member_id = ? WHERE id = ?').run(memberId, patient.id);
            }
        }

        let member = null;
        let conditions = [];
        let medications = [];
        let allergies = [];
        let medicalHistory = [];
        let lifestyle = null;
        let followUps = [];

        if (memberId) {
            member = db.prepare(`
                SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village, f.city, f.district
                FROM family_members m
                JOIN families f ON m.family_id = f.id
                WHERE m.id = ?
            `).get(memberId);

            conditions = db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(memberId);
            medications = db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(memberId);
            allergies = db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(memberId);
            medicalHistory = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(memberId);
            lifestyle = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
            followUps = db.prepare('SELECT * FROM follow_ups WHERE member_id = ? ORDER BY visit_date DESC, id DESC').all(memberId);
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
};

module.exports = PatientModel;
