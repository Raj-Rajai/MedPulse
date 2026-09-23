const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');

const FamilyModel = {
    // -------------------------------------------------------------
    // Families
    // -------------------------------------------------------------
    getFamilies(studentId, search) {
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name,
                   COUNT(DISTINCT m.id) as member_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN family_members m ON f.id = m.family_id
            WHERE f.student_id = ?
        `;
        const params = [studentId];

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            query += ' AND (f.family_code LIKE ? OR f.head_of_family LIKE ? OR f.family_name LIKE ? OR f.contact_number LIKE ? OR f.village LIKE ? OR f.village_ward LIKE ?)';
            params.push(s, s, s, s, s, s);
        }

        query += ' GROUP BY f.id ORDER BY f.id DESC';

        const rows = db.prepare(query).all(...params);
        return rows.map(rawR => {
            const r = clean(rawR);
            const phone = r.contact_number || r.contact_phone || null;
            return {
                ...r,
                contact_phone: phone,
                contact_number: phone
            };
        });
    },

    getFamilyById(familyId, studentId) {
        const family = db.prepare(`
            SELECT f.*, s.roll_number, s.name as student_name
            FROM families f
            JOIN students s ON f.student_id = s.id
            WHERE f.id = ?
        `).get(familyId);

        if (!family) return { notFound: true };
        if (family.student_id !== studentId) return { forbidden: true };

        const members = db.prepare(`
            SELECT * FROM family_members 
            WHERE family_id = ? 
            ORDER BY member_order ASC, id ASC
        `).all(familyId);

        const enhancedMembers = members.map(rawM => {
            const m = clean(rawM);
            const conditions = db.prepare('SELECT condition_name, status FROM member_conditions WHERE member_id = ?').all(m.id);
            const medCount = db.prepare('SELECT COUNT(*) as c FROM member_medications WHERE member_id = ?').get(m.id)?.c || 0;
            const allergyCount = db.prepare('SELECT COUNT(*) as c FROM member_allergies WHERE member_id = ?').get(m.id)?.c || 0;
            const historyCount = db.prepare('SELECT COUNT(*) as c FROM member_medical_history WHERE member_id = ?').get(m.id)?.c || 0;
            return {
                ...m,
                conditions_list: cleanList(conditions),
                medication_count: medCount,
                allergy_count: allergyCount,
                history_count: historyCount
            };
        });

        const phone = family.contact_number || family.contact_phone || null;
        return {
            family: {
                ...clean(family),
                contact_phone: phone,
                contact_number: phone,
                members: enhancedMembers
            }
        };
    },

    getFamilyMembers(familyId, studentId, search, gender) {
        const family = db.prepare('SELECT id, student_id FROM families WHERE id = ?').get(familyId);
        if (!family) return { notFound: true };
        if (family.student_id !== studentId) return { forbidden: true };

        let query = 'SELECT * FROM family_members WHERE family_id = ?';
        const params = [familyId];

        if (search && search.trim()) {
            query += ' AND (name LIKE ? OR relation_to_hof LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s);
        }

        if (gender && gender !== 'ALL') {
            query += ' AND gender = ?';
            params.push(gender);
        }

        query += ' ORDER BY member_order ASC, id ASC';
        const members = db.prepare(query).all(...params);

        const enhancedMembers = members.map(rawM => {
            const m = clean(rawM);
            const conditions = db.prepare('SELECT condition_name, status FROM member_conditions WHERE member_id = ?').all(m.id);
            return {
                ...m,
                conditions_list: cleanList(conditions)
            };
        });

        return { members: enhancedMembers };
    },

    createFamily(studentId, {
        family_code,
        family_name,
        family_no,
        head_of_family,
        contact_number,
        contact_phone,
        village_ward,
        village,
        city,
        district,
        state,
        pincode,
        address,
        survey_date,
        total_cu,
        calorie_intake_per_cu,
        calorie_status,
        dietary_advice_given,
        notes,
        members = []
    }) {
        const effectiveContact = contact_number || contact_phone || null;
        if (!head_of_family || !head_of_family.trim()) {
            return { badRequest: true, message: 'Head of Family name is required' };
        }

        // Determine next family_no if not provided
        let targetFamilyNo = family_no;
        if (!targetFamilyNo) {
            const maxFamily = db.prepare('SELECT MAX(family_no) as max_no FROM families WHERE student_id = ?').get(studentId);
            targetFamilyNo = (maxFamily?.max_no || 0) + 1;
        } else {
            const existingFam = db.prepare('SELECT id FROM families WHERE student_id = ? AND family_no = ?').get(studentId, targetFamilyNo);
            if (existingFam) {
                return { conflict: true, message: `Family #${targetFamilyNo} already exists for this student. Please use family number ${targetFamilyNo + 1} or another number.` };
            }
        }

        // Auto-generate family code if not provided
        let targetFamilyCode = family_code && family_code.trim() ? family_code.trim() : null;
        if (!targetFamilyCode) {
            const maxIdRow = db.prepare('SELECT MAX(id) as max_id FROM families').get();
            const nextId = (maxIdRow?.max_id || 0) + 1;
            targetFamilyCode = `FAM-${String(nextId).padStart(4, '0')}`;
        } else {
            const existingCode = db.prepare('SELECT id FROM families WHERE family_code = ?').get(targetFamilyCode);
            if (existingCode) {
                return { conflict: true, message: `Family Code '${targetFamilyCode}' is already in use. Please choose another.` };
            }
        }

        const effectiveFamilyName = family_name && family_name.trim() ? family_name.trim() : `${head_of_family.trim()} Household`;

        // Run in transaction
        db.exec('BEGIN TRANSACTION;');

        try {
            const insertFamilyStmt = db.prepare(`
                INSERT INTO families (
                    student_id, family_code, family_name, family_no, head_of_family,
                    contact_number, village_ward, village, city, district, state, pincode,
                    address, survey_date, total_cu, calorie_intake_per_cu, calorie_status,
                    dietary_advice_given, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?)
            `);

            const familyResult = insertFamilyStmt.run(
                studentId,
                targetFamilyCode,
                effectiveFamilyName,
                targetFamilyNo,
                head_of_family.trim(),
                effectiveContact,
                village_ward || village || 'Community Ward',
                village || village_ward || null,
                city || null,
                district || null,
                state || null,
                pincode || null,
                address || '',
                survey_date || null,
                total_cu || 0,
                calorie_intake_per_cu || 0,
                calorie_status || 'Normal',
                dietary_advice_given || 'N',
                notes || ''
            );

            const familyId = Number(familyResult.lastInsertRowid);

            const insertMemberStmt = db.prepare(`
                INSERT INTO family_members (
                    family_id, member_order, name, relation_to_hof, gender,
                    date_of_birth, age_years, age_months, contact_number, marital_status,
                    education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                    height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                    hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                    diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                    anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                    work_type, consumption_unit
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?
                )
            `);

            members.forEach((m, idx) => {
                let ageYears = parseInt(m.age_years || 0, 10);
                if ((!ageYears || ageYears === 0) && m.date_of_birth) {
                    const dob = new Date(m.date_of_birth);
                    const today = new Date();
                    let calcAge = today.getFullYear() - dob.getFullYear();
                    const mDiff = today.getMonth() - dob.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
                    if (calcAge >= 0) ageYears = calcAge;
                }

                let bmi = m.bmi || null;
                if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
                    bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
                }

                let whr = m.whr || null;
                if (!whr && m.waist_cm > 0 && m.hip_cm > 0) {
                    whr = parseFloat((m.waist_cm / m.hip_cm).toFixed(2));
                }

                let has_htn = m.has_htn;
                if ((!has_htn || has_htn === 'NA') && (m.sbp >= 140 || m.dbp >= 90)) has_htn = 'Y';

                let has_anaemia = m.has_anaemia;
                if ((!has_anaemia || has_anaemia === 'NA') && m.hb !== undefined && m.hb !== null && m.hb > 0 && m.hb < 12.0) has_anaemia = 'Y';

                insertMemberStmt.run(
                    familyId,
                    m.member_order || (idx + 1),
                    m.name || `Member ${idx + 1}`,
                    m.relation_to_hof || (idx === 0 ? 'Head of Family' : 'Family Member'),
                    m.gender || 'Other',
                    m.date_of_birth || null,
                    ageYears,
                    parseInt(m.age_months || 0, 10),
                    m.contact_number || null,
                    m.marital_status || 'Unknown',
                    m.education || null,
                    m.occupation || null,
                    has_htn || 'NA',
                    m.sbp ? parseInt(m.sbp, 10) : null,
                    m.dbp ? parseInt(m.dbp, 10) : null,
                    m.has_dm || 'NA',
                    m.rbs ? parseFloat(m.rbs) : null,
                    m.has_pallor || 'NA',
                    m.hb ? parseFloat(m.hb) : null,
                    has_anaemia || 'NA',
                    m.height_m ? parseFloat(m.height_m) : null,
                    m.weight_kg ? parseFloat(m.weight_kg) : null,
                    bmi,
                    m.waist_cm ? parseFloat(m.waist_cm) : null,
                    m.hip_cm ? parseFloat(m.hip_cm) : null,
                    whr,
                    m.hc_cm ? parseFloat(m.hc_cm) : null,
                    m.cc_cm ? parseFloat(m.cc_cm) : null,
                    m.muac_cm ? parseFloat(m.muac_cm) : null,
                    m.is_underweight || 'NA',
                    m.is_overweight || 'NA',
                    m.is_stunting || 'NA',
                    m.is_wasting || 'NA',
                    m.is_severe_wasting || 'NA',
                    m.diagnosis || null,
                    m.treatment_taken || 'NA',
                    m.treatment_source || null,
                    m.oral_hygiene || 'Y',
                    m.general_hygiene || 'Y',
                    m.anc_taken || 'NA',
                    m.delivery_place || 'NA',
                    m.pnc_taken || 'NA',
                    m.fp_method_used || 'NA',
                    m.mamta_card || 'NA',
                    m.immunization_status || 'NA',
                    m.work_type || 'NA',
                    m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0
                );
            });

            db.exec('COMMIT;');

            const createdFamily = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
            const phone = createdFamily.contact_number || createdFamily.contact_phone || null;

            return {
                family_id: familyId,
                family_code: targetFamilyCode,
                family_no: targetFamilyNo,
                family: {
                    ...clean(createdFamily),
                    contact_phone: phone,
                    contact_number: phone
                },
                members_count: members.length
            };
        } catch (txError) {
            db.exec('ROLLBACK;');
            throw txError;
        }
    },

    updateFamily(familyId, studentId, body) {
        const existing = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        if (!existing) return { notFound: true };
        if (existing.student_id !== studentId) return { forbidden: true };

        const {
            family_name,
            head_of_family,
            contact_number,
            contact_phone,
            village_ward,
            village,
            city,
            district,
            state,
            pincode,
            address,
            total_cu,
            calorie_intake_per_cu,
            calorie_status,
            dietary_advice_given,
            notes
        } = body;

        const effectiveContact = contact_number !== undefined ? contact_number : contact_phone;

        db.prepare(`
            UPDATE families SET
                family_name = COALESCE(?, family_name),
                head_of_family = COALESCE(?, head_of_family),
                contact_number = COALESCE(?, contact_number),
                village_ward = COALESCE(?, village_ward),
                village = COALESCE(?, village),
                city = COALESCE(?, city),
                district = COALESCE(?, district),
                state = COALESCE(?, state),
                pincode = COALESCE(?, pincode),
                address = COALESCE(?, address),
                total_cu = COALESCE(?, total_cu),
                calorie_intake_per_cu = COALESCE(?, calorie_intake_per_cu),
                calorie_status = COALESCE(?, calorie_status),
                dietary_advice_given = COALESCE(?, dietary_advice_given),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            family_name !== undefined ? family_name : null,
            head_of_family !== undefined ? head_of_family : null,
            effectiveContact !== undefined ? effectiveContact : null,
            village_ward !== undefined ? village_ward : null,
            village !== undefined ? village : null,
            city !== undefined ? city : null,
            district !== undefined ? district : null,
            state !== undefined ? state : null,
            pincode !== undefined ? pincode : null,
            address !== undefined ? address : null,
            total_cu !== undefined ? total_cu : null,
            calorie_intake_per_cu !== undefined ? calorie_intake_per_cu : null,
            calorie_status !== undefined ? calorie_status : null,
            dietary_advice_given !== undefined ? dietary_advice_given : null,
            notes !== undefined ? notes : null,
            familyId
        );

        const updated = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        const phone = updated.contact_number || updated.contact_phone || null;
        return {
            family: {
                ...clean(updated),
                contact_phone: phone,
                contact_number: phone
            }
        };
    },

    deleteFamily(familyId, studentId) {
        const existing = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        if (!existing) return { notFound: true };
        if (existing.student_id !== studentId) return { forbidden: true };

        db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
        return { success: true };
    },

    // -------------------------------------------------------------
    // Members
    // -------------------------------------------------------------
    addMember(familyId, studentId, m) {
        const family = db.prepare('SELECT id, student_id FROM families WHERE id = ?').get(familyId);
        if (!family) return { notFound: true };
        if (family.student_id !== studentId) return { forbidden: true };

        if (!m.name || !m.name.trim()) {
            return { badRequest: true, message: 'Member name is required' };
        }

        const maxOrderRow = db.prepare('SELECT MAX(member_order) as max_order FROM family_members WHERE family_id = ?').get(familyId);
        const nextOrder = (maxOrderRow?.max_order || 0) + 1;

        let ageYears = parseInt(m.age_years || 0, 10);
        if ((!ageYears || ageYears === 0) && m.date_of_birth) {
            const dob = new Date(m.date_of_birth);
            const today = new Date();
            let calcAge = today.getFullYear() - dob.getFullYear();
            const mDiff = today.getMonth() - dob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
            if (calcAge >= 0) ageYears = calcAge;
        }

        let bmi = m.bmi || null;
        if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
            bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
        }

        let whr = m.whr || null;
        if (!whr && m.waist_cm > 0 && m.hip_cm > 0) {
            whr = parseFloat((m.waist_cm / m.hip_cm).toFixed(2));
        }

        let has_htn = m.has_htn;
        if ((!has_htn || has_htn === 'NA') && (m.sbp >= 140 || m.dbp >= 90)) {
            has_htn = 'Y';
        }

        let has_anaemia = m.has_anaemia;
        if ((!has_anaemia || has_anaemia === 'NA') && m.hb !== undefined && m.hb !== null && m.hb > 0 && m.hb < 12.0) {
            has_anaemia = 'Y';
        }

        const insertStmt = db.prepare(`
            INSERT INTO family_members (
                family_id, member_order, name, relation_to_hof, gender,
                date_of_birth, age_years, age_months, contact_number, marital_status,
                education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                work_type, consumption_unit
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?
            )
        `);

        const result = insertStmt.run(
            familyId,
            nextOrder,
            m.name.trim(),
            m.relation_to_hof || 'Family Member',
            m.gender || 'Other',
            m.date_of_birth || null,
            ageYears,
            parseInt(m.age_months || 0, 10),
            m.contact_number || m.contact_phone || m.contact || null,
            (m.marital_status && m.marital_status !== 'NA') ? m.marital_status : 'Unknown',
            m.education || m.education_level || null,
            m.occupation || null,
            has_htn || 'NA',
            m.sbp ? parseInt(m.sbp, 10) : null,
            m.dbp ? parseInt(m.dbp, 10) : null,
            m.has_dm || 'NA',
            m.rbs ? parseFloat(m.rbs) : null,
            m.has_pallor || 'NA',
            m.hb ? parseFloat(m.hb) : null,
            has_anaemia || 'NA',
            m.height_m ? parseFloat(m.height_m) : null,
            m.weight_kg ? parseFloat(m.weight_kg) : null,
            bmi,
            m.waist_cm ? parseFloat(m.waist_cm) : null,
            m.hip_cm ? parseFloat(m.hip_cm) : null,
            whr,
            m.hc_cm ? parseFloat(m.hc_cm) : null,
            m.cc_cm ? parseFloat(m.cc_cm) : null,
            m.muac_cm ? parseFloat(m.muac_cm) : null,
            m.is_underweight || 'NA',
            m.is_overweight || 'NA',
            m.is_stunting || 'NA',
            m.is_wasting || 'NA',
            m.is_severe_wasting || 'NA',
            m.diagnosis || null,
            m.treatment_taken || 'NA',
            m.treatment_source || null,
            m.oral_hygiene || 'Y',
            m.general_hygiene || 'Y',
            m.anc_taken || 'NA',
            m.delivery_place || 'NA',
            m.pnc_taken || 'NA',
            m.fp_method_used || 'NA',
            m.mamta_card || 'NA',
            m.immunization_status || 'NA',
            m.work_type || 'NA',
            m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0
        );

        const newMemberId = Number(result.lastInsertRowid);

        if (m.diagnosis && m.diagnosis.trim()) {
            db.prepare(`
                INSERT INTO member_conditions (member_id, condition_name, status, notes)
                VALUES (?, ?, 'Active', 'Entered during baseline survey')
            `).run(newMemberId, m.diagnosis.trim());
        }

        const newMember = db.prepare('SELECT * FROM family_members WHERE id = ?').get(newMemberId);
        return { member: clean(newMember) };
    },

    updateMember(memberId, studentId, m) {
        const existing = db.prepare(`
            SELECT m.*, f.student_id 
            FROM family_members m 
            JOIN families f ON m.family_id = f.id 
            WHERE m.id = ?
        `).get(memberId);

        if (!existing) return { notFound: true };
        if (existing.student_id !== studentId) return { forbidden: true };

        let ageYears = m.age_years !== undefined ? parseInt(m.age_years, 10) : existing.age_years;
        if ((!ageYears || ageYears === 0) && m.date_of_birth) {
            const dob = new Date(m.date_of_birth);
            const today = new Date();
            let calcAge = today.getFullYear() - dob.getFullYear();
            const mDiff = today.getMonth() - dob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
            if (calcAge >= 0) ageYears = calcAge;
        }

        let heightM = m.height_m !== undefined ? (m.height_m ? parseFloat(m.height_m) : null) : existing.height_m;
        let weightKg = m.weight_kg !== undefined ? (m.weight_kg ? parseFloat(m.weight_kg) : null) : existing.weight_kg;
        let bmi = m.bmi !== undefined ? (m.bmi ? parseFloat(m.bmi) : null) : existing.bmi;
        if (heightM && weightKg && heightM > 0) {
            bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(2));
        }

        let waistCm = m.waist_cm !== undefined ? (m.waist_cm ? parseFloat(m.waist_cm) : null) : existing.waist_cm;
        let hipCm = m.hip_cm !== undefined ? (m.hip_cm ? parseFloat(m.hip_cm) : null) : existing.hip_cm;
        let whr = m.whr !== undefined ? (m.whr ? parseFloat(m.whr) : null) : existing.whr;
        if (waistCm && hipCm && hipCm > 0) {
            whr = parseFloat((waistCm / hipCm).toFixed(2));
        }

        let sbp = m.sbp !== undefined ? (m.sbp ? parseInt(m.sbp, 10) : null) : existing.sbp;
        let dbp = m.dbp !== undefined ? (m.dbp ? parseInt(m.dbp, 10) : null) : existing.dbp;
        let has_htn = m.has_htn !== undefined ? m.has_htn : existing.has_htn;
        if ((!has_htn || has_htn === 'NA') && (sbp >= 140 || dbp >= 90)) {
            has_htn = 'Y';
        }

        let hb = m.hb !== undefined ? (m.hb ? parseFloat(m.hb) : null) : existing.hb;
        let has_anaemia = m.has_anaemia !== undefined ? m.has_anaemia : existing.has_anaemia;
        if ((!has_anaemia || has_anaemia === 'NA') && hb !== null && hb !== undefined && hb > 0 && hb < 12.0) {
            has_anaemia = 'Y';
        }

        db.prepare(`
            UPDATE family_members SET
                name = COALESCE(?, name),
                relation_to_hof = COALESCE(?, relation_to_hof),
                gender = COALESCE(?, gender),
                date_of_birth = ?,
                age_years = ?,
                age_months = ?,
                contact_number = ?,
                marital_status = COALESCE(?, marital_status),
                education = ?,
                occupation = ?,
                has_htn = ?,
                sbp = ?,
                dbp = ?,
                has_dm = COALESCE(?, has_dm),
                rbs = ?,
                has_pallor = COALESCE(?, has_pallor),
                hb = ?,
                has_anaemia = ?,
                height_m = ?,
                weight_kg = ?,
                bmi = ?,
                waist_cm = ?,
                hip_cm = ?,
                whr = ?,
                hc_cm = ?,
                cc_cm = ?,
                muac_cm = ?,
                is_underweight = COALESCE(?, is_underweight),
                is_overweight = COALESCE(?, is_overweight),
                is_stunting = COALESCE(?, is_stunting),
                is_wasting = COALESCE(?, is_wasting),
                is_severe_wasting = COALESCE(?, is_severe_wasting),
                diagnosis = ?,
                treatment_taken = COALESCE(?, treatment_taken),
                treatment_source = ?,
                oral_hygiene = COALESCE(?, oral_hygiene),
                general_hygiene = COALESCE(?, general_hygiene),
                anc_taken = COALESCE(?, anc_taken),
                delivery_place = COALESCE(?, delivery_place),
                pnc_taken = COALESCE(?, pnc_taken),
                fp_method_used = COALESCE(?, fp_method_used),
                mamta_card = COALESCE(?, mamta_card),
                immunization_status = COALESCE(?, immunization_status),
                work_type = COALESCE(?, work_type),
                consumption_unit = COALESCE(?, consumption_unit),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            m.name ? m.name.trim() : null,
            m.relation_to_hof || null,
            m.gender || null,
            m.date_of_birth !== undefined ? m.date_of_birth : existing.date_of_birth,
            ageYears,
            m.age_months !== undefined ? parseInt(m.age_months, 10) : existing.age_months,
            m.contact_number !== undefined ? (m.contact_number || m.contact_phone || null) : existing.contact_number,
            (m.marital_status && m.marital_status !== 'NA') ? m.marital_status : null,
            m.education !== undefined ? (m.education || m.education_level || null) : existing.education,
            m.occupation !== undefined ? m.occupation : existing.occupation,
            has_htn,
            sbp,
            dbp,
            m.has_dm || null,
            m.rbs !== undefined ? (m.rbs ? parseFloat(m.rbs) : null) : existing.rbs,
            m.has_pallor || null,
            hb,
            has_anaemia,
            heightM,
            weightKg,
            bmi,
            waistCm,
            hipCm,
            whr,
            m.hc_cm !== undefined ? (m.hc_cm ? parseFloat(m.hc_cm) : null) : existing.hc_cm,
            m.cc_cm !== undefined ? (m.cc_cm ? parseFloat(m.cc_cm) : null) : existing.cc_cm,
            m.muac_cm !== undefined ? (m.muac_cm ? parseFloat(m.muac_cm) : null) : existing.muac_cm,
            m.is_underweight || null,
            m.is_overweight || null,
            m.is_stunting || null,
            m.is_wasting || null,
            m.is_severe_wasting || null,
            m.diagnosis !== undefined ? m.diagnosis : existing.diagnosis,
            m.treatment_taken || null,
            m.treatment_source !== undefined ? m.treatment_source : existing.treatment_source,
            m.oral_hygiene || null,
            m.general_hygiene || null,
            m.anc_taken || null,
            m.delivery_place || null,
            m.pnc_taken || null,
            m.fp_method_used || null,
            m.mamta_card || null,
            m.immunization_status || null,
            m.work_type || null,
            m.consumption_unit !== undefined ? (m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0) : existing.consumption_unit,
            memberId
        );

        const updated = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
        return { member: clean(updated) };
    },

    getMemberById(memberId) {
        const member = db.prepare(`
            SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village, f.city, f.district
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            WHERE m.id = ?
        `).get(memberId);

        if (!member) return null;

        const conditions = db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const medications = db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const allergies = db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const medicalHistory = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(memberId);
        const lifestyle = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
        const followUps = db.prepare('SELECT * FROM follow_ups WHERE member_id = ? ORDER BY visit_date DESC, id DESC').all(memberId);

        return {
            ...clean(member),
            conditions: cleanList(conditions),
            medications: cleanList(medications),
            allergies: cleanList(allergies),
            medicalHistory: cleanList(medicalHistory),
            lifestyle: clean(lifestyle),
            followUps: cleanList(followUps)
        };
    },

    deleteMember(memberId) {
        const result = db.prepare('DELETE FROM family_members WHERE id = ?').run(memberId);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Sub-Entities: Conditions
    // -------------------------------------------------------------
    getConditions(memberId) {
        const rows = db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(memberId);
        return cleanList(rows);
    },

    createCondition(memberId, { condition_name, status, diagnosed_year, diagnosis_date, notes }) {
        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            INSERT INTO member_conditions (member_id, condition_name, status, diagnosed_year, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            memberId,
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_conditions WHERE id = ?').get(Number(result.lastInsertRowid));
        return clean(created);
    },

    updateCondition(id, { condition_name, status, diagnosed_year, diagnosis_date, notes }) {
        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            UPDATE member_conditions SET
                condition_name = ?,
                status = ?,
                diagnosed_year = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null,
            id
        );

        if (result.changes === 0) return null;
        const updated = db.prepare('SELECT * FROM member_conditions WHERE id = ?').get(id);
        return clean(updated);
    },

    deleteCondition(id) {
        const result = db.prepare('DELETE FROM member_conditions WHERE id = ?').run(id);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Sub-Entities: Medications
    // -------------------------------------------------------------
    getMedications(memberId) {
        const rows = db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(memberId);
        return cleanList(rows);
    },

    createMedication(memberId, { medicine_name, dosage, frequency, purpose, notes, status }) {
        let effStatus = status || 'Active';
        if (!['Active', 'Discontinued'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            INSERT INTO member_medications (member_id, medicine_name, dosage, frequency, purpose, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            memberId,
            medicine_name.trim(),
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            purpose ? purpose.trim() : null,
            notes ? notes.trim() : null,
            effStatus
        );

        const created = db.prepare('SELECT * FROM member_medications WHERE id = ?').get(Number(result.lastInsertRowid));
        return clean(created);
    },

    updateMedication(id, { medicine_name, dosage, frequency, purpose, notes, status }) {
        let effStatus = status || 'Active';
        if (!['Active', 'Discontinued'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            UPDATE member_medications SET
                medicine_name = ?,
                dosage = ?,
                frequency = ?,
                purpose = ?,
                notes = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            medicine_name.trim(),
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            purpose ? purpose.trim() : null,
            notes ? notes.trim() : null,
            effStatus,
            id
        );

        if (result.changes === 0) return null;
        const updated = db.prepare('SELECT * FROM member_medications WHERE id = ?').get(id);
        return clean(updated);
    },

    deleteMedication(id) {
        const result = db.prepare('DELETE FROM member_medications WHERE id = ?').run(id);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Sub-Entities: Allergies
    // -------------------------------------------------------------
    getAllergies(memberId) {
        const rows = db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(memberId);
        return cleanList(rows);
    },

    createAllergy(memberId, { allergen, severity, reaction, notes }) {
        let effSev = severity || 'Mild';
        if (!['Mild', 'Moderate', 'Severe'].includes(effSev)) effSev = 'Mild';

        const result = db.prepare(`
            INSERT INTO member_allergies (member_id, allergen, severity, reaction, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            memberId,
            allergen.trim(),
            effSev,
            reaction ? reaction.trim() : null,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_allergies WHERE id = ?').get(Number(result.lastInsertRowid));
        return clean(created);
    },

    updateAllergy(id, { allergen, severity, reaction, notes }) {
        let effSev = severity || 'Mild';
        if (!['Mild', 'Moderate', 'Severe'].includes(effSev)) effSev = 'Mild';

        const result = db.prepare(`
            UPDATE member_allergies SET
                allergen = ?,
                severity = ?,
                reaction = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            allergen.trim(),
            effSev,
            reaction ? reaction.trim() : null,
            notes ? notes.trim() : null,
            id
        );

        if (result.changes === 0) return null;
        const updated = db.prepare('SELECT * FROM member_allergies WHERE id = ?').get(id);
        return clean(updated);
    },

    deleteAllergy(id) {
        const result = db.prepare('DELETE FROM member_allergies WHERE id = ?').run(id);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Sub-Entities: Medical History
    // -------------------------------------------------------------
    getHistory(memberId) {
        const rows = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(memberId);
        return cleanList(rows);
    },

    createHistory(memberId, { event_type, description, year, event_year, hospital_doctor, notes }) {
        let effYear = year ? parseInt(year, 10) : null;
        if (!effYear && event_year) effYear = parseInt(event_year, 10);

        let effType = event_type || 'Illness';
        if (!['Surgery', 'Hospitalization', 'Chronic Condition', 'Illness', 'Other'].includes(effType)) effType = 'Illness';

        const result = db.prepare(`
            INSERT INTO member_medical_history (member_id, event_type, description, year, hospital_doctor, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            memberId,
            effType,
            description.trim(),
            effYear,
            hospital_doctor ? hospital_doctor.trim() : null,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_medical_history WHERE id = ?').get(Number(result.lastInsertRowid));
        return clean(created);
    },

    updateHistory(id, { event_type, description, year, event_year, hospital_doctor, notes }) {
        let effYear = year ? parseInt(year, 10) : null;
        if (!effYear && event_year) effYear = parseInt(event_year, 10);

        let effType = event_type || 'Illness';
        if (!['Surgery', 'Hospitalization', 'Chronic Condition', 'Illness', 'Other'].includes(effType)) effType = 'Illness';

        const result = db.prepare(`
            UPDATE member_medical_history SET
                event_type = ?,
                description = ?,
                year = ?,
                hospital_doctor = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            effType,
            description.trim(),
            effYear,
            hospital_doctor ? hospital_doctor.trim() : null,
            notes ? notes.trim() : null,
            id
        );

        if (result.changes === 0) return null;
        const updated = db.prepare('SELECT * FROM member_medical_history WHERE id = ?').get(id);
        return clean(updated);
    },

    deleteHistory(id) {
        const result = db.prepare('DELETE FROM member_medical_history WHERE id = ?').run(id);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Sub-Entities: Lifestyle
    // -------------------------------------------------------------
    getLifestyle(memberId) {
        const row = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
        return row ? clean(row) : {
            smoking_status: 'Never',
            alcohol_status: 'Never',
            physical_activity: 'Moderate',
            diet: '',
            notes: ''
        };
    },

    saveLifestyle(memberId, { smoking_status, alcohol_status, alcohol_consumption, physical_activity, physical_activity_level, diet, diet_type, notes, smoking_frequency, salt_intake }) {
        let effSmoking = smoking_status || 'Never';
        if (effSmoking === 'Occasional') effSmoking = 'Current';
        if (!['Never', 'Former', 'Current', 'Unknown'].includes(effSmoking)) effSmoking = 'Never';

        let effAlcohol = alcohol_status || alcohol_consumption || 'Never';
        if (effAlcohol === 'Occasional' || effAlcohol === 'Regular') effAlcohol = 'Current';
        if (!['Never', 'Former', 'Current', 'Unknown'].includes(effAlcohol)) effAlcohol = 'Never';

        let effActivity = physical_activity || physical_activity_level || 'Moderate';
        if (effActivity === 'Sedentary') effActivity = 'Low';
        if (effActivity === 'Active' || effActivity === 'Very Active') effActivity = 'High';
        if (!['Low', 'Moderate', 'High', 'Unknown'].includes(effActivity)) effActivity = 'Moderate';

        const effDiet = diet || diet_type || 'Vegetarian';
        const effNotes = [notes, smoking_frequency ? `Tobacco: ${smoking_frequency}` : null, salt_intake ? `Salt: ${salt_intake}` : null].filter(Boolean).join(' | ') || null;

        db.prepare(`
            INSERT INTO member_lifestyle (member_id, smoking_status, alcohol_status, physical_activity, diet, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(member_id) DO UPDATE SET
                smoking_status = excluded.smoking_status,
                alcohol_status = excluded.alcohol_status,
                physical_activity = excluded.physical_activity,
                diet = excluded.diet,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            memberId,
            effSmoking,
            effAlcohol,
            effActivity,
            effDiet,
            effNotes
        );

        const saved = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
        return clean(saved);
    },

    // -------------------------------------------------------------
    // Sub-Entities: Follow-Ups
    // -------------------------------------------------------------
    createFollowUp(memberId, studentId, {
        visit_date,
        sbp,
        dbp,
        rbs,
        hb,
        weight_kg,
        muac_cm,
        treatment_compliance,
        health_progress,
        clinical_notes,
        next_visit_date
    }) {
        const countRow = db.prepare('SELECT COUNT(*) as c FROM follow_ups WHERE member_id = ?').get(memberId);
        const visitNumber = (countRow?.c || 0) + 1;

        const insertStmt = db.prepare(`
            INSERT INTO follow_ups (
                member_id, student_id, visit_date, visit_number,
                sbp, dbp, rbs, hb, weight_kg, muac_cm,
                treatment_compliance, health_progress, clinical_notes, next_visit_date
            ) VALUES (
                ?, ?, COALESCE(?, date('now')), ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `);

        const result = insertStmt.run(
            memberId,
            studentId,
            visit_date || null,
            visitNumber,
            sbp ? parseInt(sbp, 10) : null,
            dbp ? parseInt(dbp, 10) : null,
            rbs ? parseFloat(rbs) : null,
            hb ? parseFloat(hb) : null,
            weight_kg ? parseFloat(weight_kg) : null,
            muac_cm ? parseFloat(muac_cm) : null,
            treatment_compliance || 'Good',
            health_progress || 'Stable',
            clinical_notes || '',
            next_visit_date || null
        );

        const newFuId = Number(result.lastInsertRowid);
        const newFu = db.prepare(`
            SELECT fu.*, s.roll_number as recorded_by_roll, s.name as recorded_by_name
            FROM follow_ups fu
            LEFT JOIN students s ON fu.student_id = s.id
            WHERE fu.id = ?
        `).get(newFuId);

        return clean(newFu);
    },

    deleteFollowUp(fuId) {
        const result = db.prepare('DELETE FROM follow_ups WHERE id = ?').run(fuId);
        return result.changes > 0;
    },

    // -------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------
    getAnalyticsSummary(sid) {
        const totalFamilies = db.prepare('SELECT COUNT(*) as c FROM families WHERE student_id = ?').get(sid)?.c || 0;
        const totalMembers = db.prepare(`
            SELECT COUNT(*) as c 
            FROM family_members m 
            JOIN families f ON m.family_id = f.id 
            WHERE f.student_id = ?
        `).get(sid)?.c || 0;
        const totalStudents = 1;

        const adultStats = db.prepare(`
            SELECT 
                COUNT(*) as adults_count,
                SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_count,
                SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_count,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemia_count
            FROM family_members m 
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ? AND m.age_years >= 18
        `).get(sid);

        const pediatricStats = db.prepare(`
            SELECT 
                COUNT(*) as under5_count,
                SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END) as underweight_count,
                SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END) as stunted_count,
                SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END) as wasted_count,
                SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END) as mamta_card_count,
                SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END) as immunized_count
            FROM family_members m 
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ? AND m.age_years <= 5
        `).get(sid);

        const calorieStats = db.prepare(`
            SELECT 
                calorie_status,
                COUNT(*) as count
            FROM families
            WHERE student_id = ?
            GROUP BY calorie_status
        `).all(sid);

        return {
            totals: {
                families: totalFamilies,
                members: totalMembers,
                students: totalStudents
            },
            adults: {
                total: adultStats.adults_count,
                htn_count: adultStats.htn_count,
                htn_pct: adultStats.adults_count ? Math.round((adultStats.htn_count / adultStats.adults_count) * 100) : 0,
                dm_count: adultStats.dm_count,
                dm_pct: adultStats.adults_count ? Math.round((adultStats.dm_count / adultStats.adults_count) * 100) : 0,
                anaemia_count: adultStats.anaemia_count,
                anaemia_pct: adultStats.adults_count ? Math.round((adultStats.anaemia_count / adultStats.adults_count) * 100) : 0
            },
            pediatric: {
                total_under5: pediatricStats.under5_count,
                underweight_count: pediatricStats.underweight_count,
                stunted_count: pediatricStats.stunted_count,
                wasted_count: pediatricStats.wasted_count,
                mamta_card_coverage: pediatricStats.under5_count ? Math.round((pediatricStats.mamta_card_count / pediatricStats.under5_count) * 100) : 0,
                immunization_coverage: pediatricStats.under5_count ? Math.round((pediatricStats.immunized_count / pediatricStats.under5_count) * 100) : 0
            },
            calorieDistribution: cleanList(calorieStats)
        };
    },

    getAnalyticsCharts(sid, { gender, ageGroup, familyId }) {
        const conditions = ['f.student_id = ?'];
        const params = [sid];

        if (gender && gender !== 'all') {
            conditions.push('m.gender = ?');
            params.push(gender);
        }
        if (familyId && familyId !== 'all') {
            conditions.push('m.family_id = ?');
            params.push(parseInt(familyId, 10));
        }
        if (ageGroup && ageGroup !== 'all') {
            if (ageGroup === 'under18') conditions.push('m.age_years < 18');
            else if (ageGroup === '18-44') conditions.push('m.age_years BETWEEN 18 AND 44');
            else if (ageGroup === '45-59') conditions.push('m.age_years BETWEEN 45 AND 59');
            else if (ageGroup === '60+') conditions.push('m.age_years >= 60');
        }

        const whereSql = 'WHERE ' + conditions.join(' AND ');

        // 1. KPI Aggregates
        const kpiSql = `
            SELECT 
                COUNT(*) as total_members,
                SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) as males,
                SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) as females,
                ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
                      NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) as sex_ratio,
                SUM(CASE WHEN m.age_years >= 18 THEN 1 ELSE 0 END) as adult_count,
                SUM(CASE WHEN m.age_years >= 18 AND m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_cases,
                SUM(CASE WHEN m.age_years >= 18 AND m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_cases,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemia_cases,
                ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END), 1) as avg_sbp,
                ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END), 1) as avg_dbp,
                ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END), 1) as avg_rbs,
                ROUND(AVG(CASE WHEN m.hb IS NOT NULL THEN m.hb END), 2) as avg_hb,
                ROUND(AVG(CASE WHEN m.bmi IS NOT NULL THEN m.bmi END), 2) as avg_bmi
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
        `;
        const kpis = db.prepare(kpiSql).get(...params);

        // Households total
        let familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = ?';
        let familyCountParams = [sid];
        if (familyId && familyId !== 'all') {
            familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = ? AND id = ?';
            familyCountParams = [sid, parseInt(familyId, 10)];
        }
        const totalHouseholds = db.prepare(familyCountSql).get(...familyCountParams)?.c || 0;

        // 2. BMI Distribution
        const bmiSql = `
            SELECT 
                CASE 
                    WHEN m.bmi < 18.5 THEN 'Underweight (< 18.5)'
                    WHEN m.bmi BETWEEN 18.5 AND 22.9 THEN 'Normal (18.5 - 22.9)'
                    WHEN m.bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
                    WHEN m.bmi >= 27.5 THEN 'Obese (>= 27.5)'
                    ELSE 'Unmeasured'
                END AS category,
                COUNT(*) AS count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND m.bmi IS NOT NULL
            GROUP BY category
            ORDER BY 
                CASE category
                    WHEN 'Underweight (< 18.5)' THEN 1
                    WHEN 'Normal (18.5 - 22.9)' THEN 2
                    WHEN 'Overweight (23.0 - 27.4)' THEN 3
                    WHEN 'Obese (>= 27.5)' THEN 4
                    ELSE 5
                END
        `;
        const bmiDistribution = db.prepare(bmiSql).all(...params);

        // 3. NCD Prevalence by Age Group
        const ncdAgeSql = `
            SELECT 
                CASE 
                    WHEN m.age_years < 30 THEN '< 30 yrs'
                    WHEN m.age_years BETWEEN 30 AND 44 THEN '30-44 yrs'
                    WHEN m.age_years BETWEEN 45 AND 59 THEN '45-59 yrs'
                    ELSE '60+ yrs'
                END as age_bracket,
                COUNT(*) as total,
                SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_count,
                ROUND(SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as htn_pct,
                SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_count,
                ROUND(SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as dm_pct
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY age_bracket
            ORDER BY 
                CASE age_bracket
                    WHEN '< 30 yrs' THEN 1
                    WHEN '30-44 yrs' THEN 2
                    WHEN '45-59 yrs' THEN 3
                    ELSE 4
                END
        `;
        const ncdByAgeGroup = db.prepare(ncdAgeSql).all(...params);

        // 4. Blood Pressure Classification
        const bpSql = `
            SELECT 
                CASE 
                    WHEN m.sbp < 120 AND m.dbp < 80 THEN 'Normal (<120/80)'
                    WHEN (m.sbp BETWEEN 120 AND 139) OR (m.dbp BETWEEN 80 AND 89) THEN 'Pre-HTN (120-139/80-89)'
                    WHEN (m.sbp BETWEEN 140 AND 159) OR (m.dbp BETWEEN 90 AND 99) THEN 'Stage 1 HTN (140-159/90-99)'
                    WHEN m.sbp >= 160 OR m.dbp >= 100 THEN 'Stage 2 HTN (>=160/100)'
                    ELSE 'Unmeasured'
                END as category,
                COUNT(*) as count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND m.sbp IS NOT NULL AND m.dbp IS NOT NULL
            GROUP BY category
            ORDER BY 
                CASE category
                    WHEN 'Normal (<120/80)' THEN 1
                    WHEN 'Pre-HTN (120-139/80-89)' THEN 2
                    WHEN 'Stage 1 HTN (140-159/90-99)' THEN 3
                    WHEN 'Stage 2 HTN (>=160/100)' THEN 4
                    ELSE 5
                END
        `;
        const bpCategories = db.prepare(bpSql).all(...params);

        // 5. Anaemia & Hb by Gender
        const anaemiaGenderSql = `
            SELECT 
                m.gender,
                COUNT(*) as total,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemic_count,
                ROUND(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as anaemia_pct,
                SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) as pallor_count,
                ROUND(AVG(m.hb), 2) as avg_hb
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY m.gender
        `;
        const anaemiaByGender = db.prepare(anaemiaGenderSql).all(...params);

        // 6. Community Conditions Ranking
        const condSql = `
            SELECT 
                c.condition_name,
                COUNT(*) as count
            FROM member_conditions c
            JOIN family_members m ON c.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY c.condition_name
            ORDER BY count DESC
            LIMIT 10
        `;
        const conditionsRanking = db.prepare(condSql).all(...params);

        // 7. Occupational / Physical Activity Work Type
        const workSql = `
            SELECT 
                CASE 
                    WHEN m.work_type IN ('S', 'Sedentary') THEN 'Sedentary'
                    WHEN m.work_type IN ('M', 'Moderate') THEN 'Moderate'
                    WHEN m.work_type IN ('H', 'Heavy') THEN 'Heavy'
                    ELSE 'Unclassified'
                END as work_category,
                COUNT(*) as count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY work_category
        `;
        const lifestyleWork = db.prepare(workSql).all(...params);

        // 8. Caloric Adequacy
        const calSql = `
            SELECT 
                calorie_status,
                COUNT(*) as count
            FROM families
            WHERE student_id = ? ${familyId && familyId !== 'all' ? 'AND id = ' + parseInt(familyId, 10) : ''}
            GROUP BY calorie_status
        `;
        const dietaryStatus = db.prepare(calSql).all(sid);

        // 9. Longitudinal Trends
        const cohortSql = `
            SELECT 
                fu.visit_number,
                COUNT(*) as visits_count,
                ROUND(AVG(fu.sbp), 1) as avg_sbp,
                ROUND(AVG(fu.dbp), 1) as avg_dbp,
                ROUND(AVG(fu.rbs), 1) as avg_rbs,
                ROUND(AVG(fu.hb), 1) as avg_hb,
                ROUND(AVG(fu.weight_kg), 1) as avg_wt
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY fu.visit_number
            ORDER BY fu.visit_number
        `;
        const cohortTrends = db.prepare(cohortSql).all(...params);

        const patientCurvesSql = `
            SELECT 
                m.id as member_id,
                m.name as member_name,
                m.gender,
                fu.visit_number,
                fu.visit_date,
                fu.sbp,
                fu.dbp,
                fu.rbs,
                fu.hb,
                fu.weight_kg,
                fu.health_progress,
                fu.treatment_compliance
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND (m.has_htn = 'Y' OR m.has_dm = 'Y' OR m.has_anaemia = 'Y')
            ORDER BY m.id, fu.visit_number
        `;
        const rawCurves = db.prepare(patientCurvesSql).all(...params);

        const patientCurvesMap = {};
        for (const row of rawCurves) {
            if (!patientCurvesMap[row.member_id]) {
                patientCurvesMap[row.member_id] = {
                    id: row.member_id,
                    name: row.member_name,
                    gender: row.gender,
                    visits: []
                };
            }
            patientCurvesMap[row.member_id].visits.push({
                visit_number: row.visit_number,
                visit_date: row.visit_date,
                sbp: row.sbp,
                dbp: row.dbp,
                rbs: row.rbs,
                hb: row.hb,
                weight_kg: row.weight_kg,
                progress: row.health_progress,
                compliance: row.treatment_compliance
            });
        }
        const patientCurves = Object.values(patientCurvesMap);

        // 10. Member List for Interactive Drilldown Table
        const listSql = `
            SELECT 
                m.id,
                m.name,
                f.family_code,
                f.head_of_family,
                f.village_ward,
                m.relation_to_hof,
                m.gender,
                m.age_years,
                m.sbp,
                m.dbp,
                m.has_htn,
                m.rbs,
                m.has_dm,
                m.hb,
                m.has_anaemia,
                m.bmi,
                m.work_type,
                m.diagnosis,
                m.treatment_taken,
                (SELECT COUNT(*) FROM follow_ups WHERE member_id = m.id) as follow_up_count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            ORDER BY f.family_no, m.member_order
        `;
        const memberList = db.prepare(listSql).all(...params);

        return {
            filters: { gender: gender || 'all', ageGroup: ageGroup || 'all', familyId: familyId || 'all' },
            kpis: {
                totalHouseholds,
                totalMembers: kpis?.total_members || 0,
                males: kpis?.males || 0,
                females: kpis?.females || 0,
                sexRatio: kpis?.sex_ratio || 0,
                adultCount: kpis?.adult_count || 0,
                htnCases: kpis?.htn_cases || 0,
                htnPct: kpis?.adult_count ? Math.round((kpis.htn_cases / kpis.adult_count) * 100) : 0,
                dmCases: kpis?.dm_cases || 0,
                dmPct: kpis?.adult_count ? Math.round((kpis.dm_cases / kpis.adult_count) * 100) : 0,
                anaemiaCases: kpis?.anaemia_cases || 0,
                anaemiaPct: kpis?.total_members ? Math.round((kpis.anaemia_cases / kpis.total_members) * 100) : 0,
                avgSbp: kpis?.avg_sbp || null,
                avgDbp: kpis?.avg_dbp || null,
                avgRbs: kpis?.avg_rbs || null,
                avgHb: kpis?.avg_hb || null,
                avgBmi: kpis?.avg_bmi || null
            },
            bmiDistribution: cleanList(bmiDistribution),
            ncdByAgeGroup: cleanList(ncdByAgeGroup),
            bpCategories: cleanList(bpCategories),
            anaemiaByGender: cleanList(anaemiaByGender),
            conditionsRanking: cleanList(conditionsRanking),
            lifestyleWork: cleanList(lifestyleWork),
            dietaryStatus: cleanList(dietaryStatus),
            longitudinalTrends: {
                cohortAverages: cleanList(cohortTrends),
                patientCurves: cleanList(patientCurves)
            },
            memberList: cleanList(memberList)
        };
    },

    getAnalyticsReport(sid, reportId) {
        let sql = '';
        const params = [sid];

        switch (reportId) {
            case 'student-audit':
                sql = `
                    SELECT 
                        s.roll_number,
                        s.name AS student_name,
                        COUNT(DISTINCT f.id) AS total_families_surveyed,
                        COUNT(m.id) AS total_members_surveyed,
                        SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
                        SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS female_count,
                        ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
                              NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) AS sex_ratio
                    FROM students s
                    LEFT JOIN families f ON s.id = f.student_id
                    LEFT JOIN family_members m ON f.id = m.family_id
                    WHERE s.id = ?
                    GROUP BY s.id, s.roll_number, s.name
                `;
                break;

            case 'ncd-prevalence':
                sql = `
                    SELECT 
                        COUNT(*) AS total_adults,
                        SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) AS htn_cases,
                        ROUND(SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS htn_pct,
                        SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) AS dm_cases,
                        ROUND(SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS dm_pct,
                        SUM(CASE WHEN m.has_htn = 'Y' AND m.has_dm = 'Y' THEN 1 ELSE 0 END) AS htn_and_dm_cases,
                        ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END), 1) AS mean_sbp,
                        ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END), 1) AS mean_dbp,
                        ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END), 1) AS mean_rbs
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years >= 18
                `;
                break;

            case 'anaemia-gender':
                sql = `
                    SELECT 
                        m.gender,
                        COUNT(*) AS total_individuals,
                        SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) AS anaemic_count,
                        ROUND(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS anaemia_pct,
                        SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) AS pallor_count,
                        ROUND(AVG(m.hb), 2) AS average_hb
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.gender IN ('M', 'F')
                    GROUP BY m.gender
                `;
                break;

            case 'bmi-distribution':
                sql = `
                    SELECT 
                        CASE 
                            WHEN m.bmi < 18.5 THEN 'Underweight (< 18.5)'
                            WHEN m.bmi BETWEEN 18.5 AND 22.9 THEN 'Normal Weight (18.5 - 22.9)'
                            WHEN m.bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
                            WHEN m.bmi >= 27.5 THEN 'Obese (>= 27.5)'
                            ELSE 'Unmeasured'
                        END AS bmi_category,
                        COUNT(*) AS count
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years >= 18 AND m.bmi IS NOT NULL
                    GROUP BY bmi_category
                `;
                break;

            case 'pediatric-health':
                sql = `
                    SELECT 
                        COUNT(*) AS total_under_5,
                        SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END) AS underweight,
                        SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END) AS stunting,
                        SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END) AS wasting,
                        SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END) AS mamta_card,
                        SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END) AS age_immunized
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years <= 5
                `;
                break;

            default:
                return { invalidReport: true };
        }

        const data = db.prepare(sql).all(...params);
        return { reportId, data: cleanList(data) };
    }
};

module.exports = FamilyModel;
