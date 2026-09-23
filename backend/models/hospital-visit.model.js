const { db } = require('../config/db');

const HospitalVisitModel = {
    createVisit(hospitalId, data, admin) {
        if (!data.patient_name || !data.patient_name.trim()) {
            throw new Error('Patient name is required for registration.');
        }

        // Generate Unique Visit / Registration ID
        let visitUid = '';
        while (true) {
            const randSuffix = Math.floor(10000 + Math.random() * 90000);
            visitUid = `REG-${new Date().getFullYear()}-${randSuffix}`;
            const collision = db.prepare('SELECT id FROM hospital_visits WHERE visit_uid = ?').get(visitUid);
            if (!collision) break;
        }

        let patientId = data.patient_id || null;
        const familyMemberId = data.family_member_id ? Number(data.family_member_id) : null;

        // If this is an FAP family member, link or create in patients table if needed
        if (familyMemberId) {
            const existingPatient = db.prepare('SELECT id FROM patients WHERE family_member_id = ? AND hospital_id = ?').get(familyMemberId, hospitalId);
            if (existingPatient) {
                patientId = existingPatient.id;
            } else {
                // Check if patient with this phone exists
                const phone = data.contact_number && data.contact_number.trim() ? data.contact_number.trim() : null;
                const phoneMatch = phone ? db.prepare('SELECT id FROM patients WHERE phone = ?').get(phone) : null;
                if (phoneMatch) {
                    patientId = phoneMatch.id;
                } else {
                    // Create patient record
                    let patUid = `PAT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                    const safePhone = phone || `99${Math.floor(10000000 + Math.random() * 90000000)}`;
                    try {
                        const patStmt = db.prepare(`
                            INSERT INTO patients (patient_uid, name, phone, age_years, gender, address, model_type, family_member_id, hospital_id, status)
                            VALUES (?, ?, ?, ?, ?, ?, 'Dependent', ?, ?, 'Active')
                        `);
                        const patRes = patStmt.run(
                            patUid,
                            data.patient_name.trim(),
                            safePhone,
                            data.age_years ? Number(data.age_years) : null,
                            data.gender || 'Other',
                            data.address || data.village || '',
                            familyMemberId,
                            hospitalId
                        );
                        patientId = patRes.lastInsertRowid;
                    } catch (e) {
                        // In case of conflict, proceed without crashing
                    }
                }
            }
        }

        const stmt = db.prepare(`
            INSERT INTO hospital_visits (
                hospital_id, patient_id, family_member_id, visit_uid,
                patient_name, age_years, gender, contact_number, address, village,
                family_code, student_name, student_roll,
                visit_date, department, attending_doctor, visit_type,
                chief_complaint, symptoms_duration,
                sbp, dbp, pulse, temperature, rbs,
                existing_conditions, allergies, diagnosis, treatment_prescribed,
                disposition, ward_bed_no, follow_up_advice, registered_by_name
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                COALESCE(?, date('now')), ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `);

        const res = stmt.run(
            hospitalId,
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
            admin?.name || 'Admissions Desk'
        );

        const createdVisit = db.prepare('SELECT * FROM hospital_visits WHERE id = ?').get(res.lastInsertRowid);
        return createdVisit;
    },

    listVisits(hospitalId, { search, department, disposition, date, limit = 25, offset = 0 } = {}) {
        let sql = 'WHERE hospital_id = ?';
        const params = [hospitalId];

        if (department && department.trim()) {
            sql += ' AND department = ?';
            params.push(department.trim());
        }

        if (disposition && disposition.trim()) {
            sql += ' AND disposition = ?';
            params.push(disposition.trim());
        }

        if (date && date.trim()) {
            sql += ' AND visit_date = ?';
            params.push(date.trim());
        }

        if (search && search.trim()) {
            const term = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
            sql += ` AND (
                patient_name LIKE ? ESCAPE '\\' OR
                visit_uid LIKE ? ESCAPE '\\' OR
                contact_number LIKE ? ESCAPE '\\' OR
                family_code LIKE ? ESCAPE '\\' OR
                attending_doctor LIKE ? ESCAPE '\\' OR
                diagnosis LIKE ? ESCAPE '\\' OR
                chief_complaint LIKE ? ESCAPE '\\' OR
                department LIKE ? ESCAPE '\\' OR
                student_name LIKE ? ESCAPE '\\'
            )`;
            params.push(term, term, term, term, term, term, term, term, term);
        }

        const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM hospital_visits ${sql}`).get(...params);
        const total = totalRow ? totalRow.total : 0;

        const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
        const offsetNum = Math.max(0, Number(offset) || 0);

        const visits = db.prepare(`
            SELECT * FROM hospital_visits
            ${sql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `).all(...params, limitNum, offsetNum);

        return {
            visits,
            total,
            limit: limitNum,
            offset: offsetNum
        };
    },

    getSummary(hospitalId) {
        const total = db.prepare('SELECT COUNT(*) AS total FROM hospital_visits WHERE hospital_id = ?').get(hospitalId)?.total || 0;
        const today = db.prepare("SELECT COUNT(*) AS today FROM hospital_visits WHERE hospital_id = ? AND visit_date = date('now')").get(hospitalId)?.today || 0;
        const admitted = db.prepare("SELECT COUNT(*) AS admitted FROM hospital_visits WHERE hospital_id = ? AND (disposition LIKE '%Admit%' OR disposition = 'Observation')").get(hospitalId)?.admitted || 0;
        const opd = db.prepare("SELECT COUNT(*) AS opd FROM hospital_visits WHERE hospital_id = ? AND disposition LIKE '%Discharged%'").get(hospitalId)?.opd || 0;

        return {
            total_registered: total,
            today_visits: today,
            admitted_patients: admitted,
            opd_discharged: opd
        };
    },

    getVisitById(hospitalId, visitId) {
        return db.prepare('SELECT * FROM hospital_visits WHERE id = ? AND hospital_id = ?').get(visitId, hospitalId);
    }
};

module.exports = HospitalVisitModel;
