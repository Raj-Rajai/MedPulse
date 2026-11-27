/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';

/**
 * Model results carry flags (notFound / forbidden / badRequest / conflict / invalidReport)
 * that the controller maps to status codes, exactly like the original object-literal model.
 */
export type FamilyResult = Record<string, any>;

/**
 * Ported from backend/models/family.model.js (logic and SQL unchanged).
 */
@Injectable()
export class FamilyModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    // -------------------------------------------------------------
    // Families
    // -------------------------------------------------------------
    async getFamilies(studentId: any, search: any): Promise<Row[]> {
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name,
                   COUNT(DISTINCT m.id) as member_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN family_members m ON f.id = m.family_id
            WHERE f.student_id = $1
        `;
        const params: any[] = [Number(studentId)];

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            params.push(s);
            const p = `$${params.length}`;
            query += ` AND (f.family_code ILIKE ${p} OR f.head_of_family ILIKE ${p} OR f.family_name ILIKE ${p} OR f.contact_number ILIKE ${p} OR f.village ILIKE ${p} OR f.village_ward ILIKE ${p})`;
        }

        query += ' GROUP BY f.id, s.roll_number, s.name ORDER BY f.id DESC';

        const rows = await this.db.queryAll(query, ...params);
        return rows.map((rawR) => {
            const r = clean(rawR)!;
            const phone = r.contact_number || r.contact_phone || null;
            return {
                ...r,
                contact_phone: phone,
                contact_number: phone,
            };
        });
    }

    async getFamilyById(familyId: any, studentId: any): Promise<FamilyResult> {
        const fid = Number(familyId);
        const sid = Number(studentId);
        const family = await this.db.queryOne(
            `SELECT f.*, s.roll_number, s.name as student_name
             FROM families f
             JOIN students s ON f.student_id = s.id
             WHERE f.id = $1`,
            fid,
        );

        if (!family) return { notFound: true };
        if (Number(family.student_id) !== sid) return { forbidden: true };

        const members = await this.db.queryAll(
            `SELECT * FROM family_members
             WHERE family_id = $1
             ORDER BY member_order ASC, id ASC`,
            fid,
        );

        const enhancedMembers = await Promise.all(
            members.map(async (rawM) => {
                const m = clean(rawM)!;
                const mid = Number(m.id);
                const [conditions, medRow, allergyRow, historyRow] = await Promise.all([
                    this.db.queryAll('SELECT condition_name, status FROM member_conditions WHERE member_id = $1', mid),
                    this.db.queryOne('SELECT COUNT(*) as c FROM member_medications WHERE member_id = $1', mid),
                    this.db.queryOne('SELECT COUNT(*) as c FROM member_allergies WHERE member_id = $1', mid),
                    this.db.queryOne('SELECT COUNT(*) as c FROM member_medical_history WHERE member_id = $1', mid),
                ]);
                return {
                    ...m,
                    conditions_list: cleanList(conditions),
                    medication_count: medRow?.c || 0,
                    allergy_count: allergyRow?.c || 0,
                    history_count: historyRow?.c || 0,
                };
            }),
        );

        const phone = family.contact_number || family.contact_phone || null;
        return {
            family: {
                ...clean(family),
                contact_phone: phone,
                contact_number: phone,
                members: enhancedMembers,
            },
        };
    }

    async getFamilyMembers(familyId: any, studentId: any, search: any, gender: any): Promise<FamilyResult> {
        const fid = Number(familyId);
        const sid = Number(studentId);
        const family = await this.db.queryOne('SELECT id, student_id FROM families WHERE id = $1', fid);
        if (!family) return { notFound: true };
        if (Number(family.student_id) !== sid) return { forbidden: true };

        let query = 'SELECT * FROM family_members WHERE family_id = $1';
        const params: any[] = [fid];

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            params.push(s);
            const p = `$${params.length}`;
            query += ` AND (name ILIKE ${p} OR relation_to_hof ILIKE ${p})`;
        }

        if (gender && gender !== 'ALL') {
            params.push(gender);
            query += ` AND gender = $${params.length}`;
        }

        query += ' ORDER BY member_order ASC, id ASC';
        const members = await this.db.queryAll(query, ...params);

        const enhancedMembers = await Promise.all(
            members.map(async (rawM) => {
                const m = clean(rawM)!;
                const conditions = await this.db.queryAll('SELECT condition_name, status FROM member_conditions WHERE member_id = $1', Number(m.id));
                return {
                    ...m,
                    conditions_list: cleanList(conditions),
                };
            }),
        );

        return { members: enhancedMembers };
    }

    async createFamily(studentId: any, {
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
        members = [],
    }: any): Promise<FamilyResult> {
        const sid = Number(studentId);
        const effectiveContact = contact_number || contact_phone || null;
        if (!head_of_family || !head_of_family.trim()) {
            return { badRequest: true, message: 'Head of Family name is required' };
        }

        let targetFamilyNo = family_no ? Number(family_no) : null;
        if (!targetFamilyNo) {
            const maxFamily = await this.db.queryOne('SELECT MAX(family_no) as max_no FROM families WHERE student_id = $1', sid);
            targetFamilyNo = (maxFamily?.max_no || 0) + 1;
        } else {
            const existingFam = await this.db.queryOne('SELECT id FROM families WHERE student_id = $1 AND family_no = $2', sid, targetFamilyNo);
            if (existingFam) {
                return { conflict: true, message: `Family #${targetFamilyNo} already exists for this student. Please use family number ${targetFamilyNo + 1} or another number.` };
            }
        }

        let targetFamilyCode = family_code && family_code.trim() ? family_code.trim() : null;
        if (!targetFamilyCode) {
            const maxIdRow = await this.db.queryOne('SELECT MAX(id) as max_id FROM families');
            const nextId = (maxIdRow?.max_id || 0) + 1;
            targetFamilyCode = `FAM-${String(nextId).padStart(4, '0')}`;
        } else {
            const existingCode = await this.db.queryOne('SELECT id FROM families WHERE family_code = $1', targetFamilyCode);
            if (existingCode) {
                return { conflict: true, message: `Family Code '${targetFamilyCode}' is already in use. Please choose another.` };
            }
        }

        const effectiveFamilyName = family_name && family_name.trim() ? family_name.trim() : `${head_of_family.trim()} Household`;

        const familyId = await this.db.inTransaction(async (tx) => {
            const familyResult = await tx.insert(
                `INSERT INTO families (
                    student_id, family_code, family_name, family_no, head_of_family,
                    contact_number, village_ward, village, city, district, state, pincode,
                    address, survey_date, total_cu, calorie_intake_per_cu, calorie_status,
                    dietary_advice_given, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, to_char(CURRENT_DATE, 'YYYY-MM-DD')), $15, $16, $17, $18, $19)`,
                sid,
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
                total_cu ? Number(total_cu) : 0,
                calorie_intake_per_cu ? Number(calorie_intake_per_cu) : 0,
                calorie_status || 'Normal',
                dietary_advice_given || 'N',
                notes || '',
            );

            const newFamilyId = familyResult.lastInsertRowid;

            for (let idx = 0; idx < members.length; idx++) {
                const m = members[idx];
                let ageYears = parseInt(m.age_years || 0, 10);
                if ((!ageYears || ageYears === 0) && m.date_of_birth) {
                    const dob = new Date(m.date_of_birth);
                    const today = new Date();
                    let calcAge = today.getFullYear() - dob.getFullYear();
                    const mDiff = today.getMonth() - dob.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
                    if (calcAge >= 0) ageYears = calcAge;
                }

                let bmi = m.bmi ? parseFloat(m.bmi) : null;
                if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
                    bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
                }

                let whr = m.whr ? parseFloat(m.whr) : null;
                if (!whr && m.waist_cm > 0 && m.hip_cm > 0) {
                    whr = parseFloat((m.waist_cm / m.hip_cm).toFixed(2));
                }

                let has_htn = m.has_htn;
                if ((!has_htn || has_htn === 'NA') && (m.sbp >= 140 || m.dbp >= 90)) has_htn = 'Y';

                let has_anaemia = m.has_anaemia;
                if ((!has_anaemia || has_anaemia === 'NA') && m.hb !== undefined && m.hb !== null && m.hb > 0 && m.hb < 12.0) has_anaemia = 'Y';

                await tx.execute(
                    `INSERT INTO family_members (
                        family_id, member_order, name, relation_to_hof, gender,
                        date_of_birth, age_years, age_months, contact_number, marital_status,
                        education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                        height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                        hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                        diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                        anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                        work_type, consumption_unit
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        $21, $22, $23, $24, $25, $26,
                        $27, $28, $29, $30, $31, $32, $33, $34,
                        $35, $36, $37, $38, $39,
                        $40, $41, $42, $43, $44, $45,
                        $46, $47
                    )`,
                    newFamilyId,
                    m.member_order ? Number(m.member_order) : (idx + 1),
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
                    m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0,
                );
            }

            return newFamilyId;
        });

        const createdFamily: any = await this.db.queryOne('SELECT * FROM families WHERE id = $1', familyId);
        const phone = createdFamily.contact_number || createdFamily.contact_phone || null;

        return {
            family_id: familyId,
            family_code: targetFamilyCode,
            family_no: targetFamilyNo,
            family: {
                ...clean(createdFamily),
                contact_phone: phone,
                contact_number: phone,
            },
            members_count: members.length,
        };
    }

    async updateFamily(familyId: any, studentId: any, body: any): Promise<FamilyResult> {
        const fid = Number(familyId);
        const sid = Number(studentId);
        const existing = await this.db.queryOne('SELECT * FROM families WHERE id = $1', fid);
        if (!existing) return { notFound: true };
        if (Number(existing.student_id) !== sid) return { forbidden: true };

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
            notes,
        } = body;

        const effectiveContact = contact_number !== undefined ? contact_number : contact_phone;

        await this.db.execute(
            `UPDATE families SET
                family_name = COALESCE($1, family_name),
                head_of_family = COALESCE($2, head_of_family),
                contact_number = COALESCE($3, contact_number),
                village_ward = COALESCE($4, village_ward),
                village = COALESCE($5, village),
                city = COALESCE($6, city),
                district = COALESCE($7, district),
                state = COALESCE($8, state),
                pincode = COALESCE($9, pincode),
                address = COALESCE($10, address),
                total_cu = COALESCE($11, total_cu),
                calorie_intake_per_cu = COALESCE($12, calorie_intake_per_cu),
                calorie_status = COALESCE($13, calorie_status),
                dietary_advice_given = COALESCE($14, dietary_advice_given),
                notes = COALESCE($15, notes),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $16`,
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
            total_cu !== undefined ? Number(total_cu) : null,
            calorie_intake_per_cu !== undefined ? Number(calorie_intake_per_cu) : null,
            calorie_status !== undefined ? calorie_status : null,
            dietary_advice_given !== undefined ? dietary_advice_given : null,
            notes !== undefined ? notes : null,
            fid,
        );

        const updated: any = await this.db.queryOne('SELECT * FROM families WHERE id = $1', fid);
        const phone = updated.contact_number || updated.contact_phone || null;
        return {
            family: {
                ...clean(updated),
                contact_phone: phone,
                contact_number: phone,
            },
        };
    }

    async deleteFamily(familyId: any, studentId: any): Promise<FamilyResult> {
        const fid = Number(familyId);
        const sid = Number(studentId);
        const existing = await this.db.queryOne('SELECT * FROM families WHERE id = $1', fid);
        if (!existing) return { notFound: true };
        if (Number(existing.student_id) !== sid) return { forbidden: true };

        await this.db.execute('DELETE FROM families WHERE id = $1', fid);
        return { success: true };
    }

    // -------------------------------------------------------------
    // Members
    // -------------------------------------------------------------
    async addMember(familyId: any, studentId: any, m: any): Promise<FamilyResult> {
        const fid = Number(familyId);
        const sid = Number(studentId);
        const family = await this.db.queryOne('SELECT id, student_id FROM families WHERE id = $1', fid);
        if (!family) return { notFound: true };
        if (Number(family.student_id) !== sid) return { forbidden: true };

        if (!m.name || !m.name.trim()) {
            return { badRequest: true, message: 'Member name is required' };
        }

        const maxOrderRow = await this.db.queryOne('SELECT MAX(member_order) as max_order FROM family_members WHERE family_id = $1', fid);
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

        let bmi = m.bmi ? parseFloat(m.bmi) : null;
        if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
            bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
        }

        let whr = m.whr ? parseFloat(m.whr) : null;
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

        const result = await this.db.insert(
            `INSERT INTO family_members (
                family_id, member_order, name, relation_to_hof, gender,
                date_of_birth, age_years, age_months, contact_number, marital_status,
                education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                work_type, consumption_unit
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26,
                $27, $28, $29, $30, $31, $32, $33, $34,
                $35, $36, $37, $38, $39,
                $40, $41, $42, $43, $44, $45,
                $46, $47
            )`,
            fid,
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
            m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0,
        );

        const newMemberId = result.lastInsertRowid;

        if (m.diagnosis && m.diagnosis.trim()) {
            await this.db.execute(
                `INSERT INTO member_conditions (member_id, condition_name, status, notes)
                 VALUES ($1, $2, 'Active', 'Entered during baseline survey')`,
                newMemberId,
                m.diagnosis.trim(),
            );
        }

        const newMember = await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', newMemberId);
        return { member: clean(newMember) };
    }

    async updateMember(memberId: any, studentId: any, m: any): Promise<FamilyResult> {
        const mid = Number(memberId);
        const sid = Number(studentId);
        const existing = await this.db.queryOne(
            `SELECT m.*, f.student_id
             FROM family_members m
             JOIN families f ON m.family_id = f.id
             WHERE m.id = $1`,
            mid,
        );

        if (!existing) return { notFound: true };
        if (Number(existing.student_id) !== sid) return { forbidden: true };

        let ageYears = m.age_years !== undefined ? parseInt(m.age_years, 10) : existing.age_years;
        if ((!ageYears || ageYears === 0) && m.date_of_birth) {
            const dob = new Date(m.date_of_birth);
            const today = new Date();
            let calcAge = today.getFullYear() - dob.getFullYear();
            const mDiff = today.getMonth() - dob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
            if (calcAge >= 0) ageYears = calcAge;
        }

        const heightM = m.height_m !== undefined ? (m.height_m ? parseFloat(m.height_m) : null) : existing.height_m;
        const weightKg = m.weight_kg !== undefined ? (m.weight_kg ? parseFloat(m.weight_kg) : null) : existing.weight_kg;
        let bmi = m.bmi !== undefined ? (m.bmi ? parseFloat(m.bmi) : null) : existing.bmi;
        if (heightM && weightKg && heightM > 0) {
            bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(2));
        }

        const waistCm = m.waist_cm !== undefined ? (m.waist_cm ? parseFloat(m.waist_cm) : null) : existing.waist_cm;
        const hipCm = m.hip_cm !== undefined ? (m.hip_cm ? parseFloat(m.hip_cm) : null) : existing.hip_cm;
        let whr = m.whr !== undefined ? (m.whr ? parseFloat(m.whr) : null) : existing.whr;
        if (waistCm && hipCm && hipCm > 0) {
            whr = parseFloat((waistCm / hipCm).toFixed(2));
        }

        const sbp = m.sbp !== undefined ? (m.sbp ? parseInt(m.sbp, 10) : null) : existing.sbp;
        const dbp = m.dbp !== undefined ? (m.dbp ? parseInt(m.dbp, 10) : null) : existing.dbp;
        let has_htn = m.has_htn !== undefined ? m.has_htn : existing.has_htn;
        if ((!has_htn || has_htn === 'NA') && (sbp >= 140 || dbp >= 90)) {
            has_htn = 'Y';
        }

        const hb = m.hb !== undefined ? (m.hb ? parseFloat(m.hb) : null) : existing.hb;
        let has_anaemia = m.has_anaemia !== undefined ? m.has_anaemia : existing.has_anaemia;
        if ((!has_anaemia || has_anaemia === 'NA') && hb !== null && hb !== undefined && hb > 0 && hb < 12.0) {
            has_anaemia = 'Y';
        }

        await this.db.execute(
            `UPDATE family_members SET
                name = COALESCE($1, name),
                relation_to_hof = COALESCE($2, relation_to_hof),
                gender = COALESCE($3, gender),
                date_of_birth = $4,
                age_years = $5,
                age_months = $6,
                contact_number = $7,
                marital_status = COALESCE($8, marital_status),
                education = $9,
                occupation = $10,
                has_htn = $11,
                sbp = $12,
                dbp = $13,
                has_dm = COALESCE($14, has_dm),
                rbs = $15,
                has_pallor = COALESCE($16, has_pallor),
                hb = $17,
                has_anaemia = $18,
                height_m = $19,
                weight_kg = $20,
                bmi = $21,
                waist_cm = $22,
                hip_cm = $23,
                whr = $24,
                hc_cm = $25,
                cc_cm = $26,
                muac_cm = $27,
                is_underweight = COALESCE($28, is_underweight),
                is_overweight = COALESCE($29, is_overweight),
                is_stunting = COALESCE($30, is_stunting),
                is_wasting = COALESCE($31, is_wasting),
                is_severe_wasting = COALESCE($32, is_severe_wasting),
                diagnosis = $33,
                treatment_taken = COALESCE($34, treatment_taken),
                treatment_source = $35,
                oral_hygiene = COALESCE($36, oral_hygiene),
                general_hygiene = COALESCE($37, general_hygiene),
                anc_taken = COALESCE($38, anc_taken),
                delivery_place = COALESCE($39, delivery_place),
                pnc_taken = COALESCE($40, pnc_taken),
                fp_method_used = COALESCE($41, fp_method_used),
                mamta_card = COALESCE($42, mamta_card),
                immunization_status = COALESCE($43, immunization_status),
                work_type = COALESCE($44, work_type),
                consumption_unit = COALESCE($45, consumption_unit),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $46`,
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
            mid,
        );

        const updated = await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', mid);
        return { member: clean(updated) };
    }

    async getMemberById(memberId: any): Promise<Row | null> {
        const mid = Number(memberId);
        const member = await this.db.queryOne(
            `SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village, f.city, f.district
             FROM family_members m
             JOIN families f ON m.family_id = f.id
             WHERE m.id = $1`,
            mid,
        );

        if (!member) return null;

        const [conditions, medications, allergies, medicalHistory, lifestyle, followUps] = await Promise.all([
            this.db.queryAll('SELECT * FROM member_conditions WHERE member_id = $1 ORDER BY id DESC', mid),
            this.db.queryAll('SELECT * FROM member_medications WHERE member_id = $1 ORDER BY id DESC', mid),
            this.db.queryAll('SELECT * FROM member_allergies WHERE member_id = $1 ORDER BY id DESC', mid),
            this.db.queryAll('SELECT * FROM member_medical_history WHERE member_id = $1 ORDER BY year DESC, id DESC', mid),
            this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', mid),
            this.db.queryAll('SELECT * FROM follow_ups WHERE member_id = $1 ORDER BY visit_date DESC, id DESC', mid),
        ]);

        return {
            ...clean(member),
            conditions: cleanList(conditions),
            medications: medications.map((r) => this.medicationOut(r)!),
            allergies: allergies.map((r) => this.allergyOut(r)!),
            medicalHistory: medicalHistory.map((r) => this.historyOut(r)!),
            lifestyle: clean(lifestyle),
            followUps: cleanList(followUps),
            history: medicalHistory.map((r) => this.historyOut(r)!),
            follow_ups: cleanList(followUps),
        };
    }

    async deleteMember(memberId: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM family_members WHERE id = $1', Number(memberId));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Sub-Entities: Conditions
    // -------------------------------------------------------------
    async getConditions(memberId: any): Promise<Row[]> {
        const rows = await this.db.queryAll('SELECT * FROM member_conditions WHERE member_id = $1 ORDER BY id DESC', Number(memberId));
        return cleanList(rows);
    }

    async createCondition(memberId: any, { condition_name, status, diagnosed_year, diagnosis_date, notes }: any): Promise<Row | null> {
        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const result = await this.db.insert(
            `INSERT INTO member_conditions (member_id, condition_name, status, diagnosed_year, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            Number(memberId),
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null,
        );

        const created = await this.db.queryOne('SELECT * FROM member_conditions WHERE id = $1', result.lastInsertRowid);
        return clean(created);
    }

    async updateCondition(id: any, { condition_name, status, diagnosed_year, diagnosis_date, notes }: any): Promise<Row | null> {
        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const cid = Number(id);
        const result = await this.db.execute(
            `UPDATE member_conditions SET
                condition_name = $1,
                status = $2,
                diagnosed_year = $3,
                notes = $4,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null,
            cid,
        );

        if (result.changes === 0) return null;
        const updated = await this.db.queryOne('SELECT * FROM member_conditions WHERE id = $1', cid);
        return clean(updated);
    }

    async deleteCondition(id: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM member_conditions WHERE id = $1', Number(id));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Sub-Entities: Medications
    // -------------------------------------------------------------
    private medicationOut(row: unknown): Row | null {
        const r = clean(row);
        if (!r) return null;
        return {
            ...r,
            medicine_name: r.name,
            medication_name: r.name,
            purpose: r.reason,
            prescribed_for: r.reason,
            status: r.currently_taking === 'No' ? 'Discontinued' : 'Active',
        };
    }

    private medicationIn({ medicine_name, medication_name, name, dosage, frequency, purpose, prescribed_for, reason, notes, status, currently_taking }: any) {
        const medName = String(medicine_name ?? medication_name ?? name ?? '').trim();
        let taking = ['Yes', 'No', 'Unknown'].includes(currently_taking) ? currently_taking : null;
        if (!taking) taking = status === 'Discontinued' ? 'No' : 'Yes';
        const why = purpose ?? prescribed_for ?? reason;
        return [
            medName,
            dosage ? String(dosage).trim() : null,
            frequency ? String(frequency).trim() : null,
            why ? String(why).trim() : null,
            notes ? String(notes).trim() : null,
            taking,
        ];
    }

    async getMedications(memberId: any): Promise<Row[]> {
        const rows = await this.db.queryAll('SELECT * FROM member_medications WHERE member_id = $1 ORDER BY id DESC', Number(memberId));
        return rows.map((r) => this.medicationOut(r)!);
    }

    async createMedication(memberId: any, body: any): Promise<Row | null> {
        const result = await this.db.insert(
            `INSERT INTO member_medications (member_id, name, dosage, frequency, reason, notes, currently_taking)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            Number(memberId),
            ...this.medicationIn(body),
        );

        const created = await this.db.queryOne('SELECT * FROM member_medications WHERE id = $1', result.lastInsertRowid);
        return this.medicationOut(created);
    }

    async updateMedication(id: any, body: any): Promise<Row | null> {
        const mid = Number(id);
        const result = await this.db.execute(
            `UPDATE member_medications SET
                name = $1,
                dosage = $2,
                frequency = $3,
                reason = $4,
                notes = $5,
                currently_taking = $6,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            ...this.medicationIn(body),
            mid,
        );

        if (result.changes === 0) return null;
        const updated = await this.db.queryOne('SELECT * FROM member_medications WHERE id = $1', mid);
        return this.medicationOut(updated);
    }

    async deleteMedication(id: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM member_medications WHERE id = $1', Number(id));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Sub-Entities: Allergies
    // -------------------------------------------------------------
    private allergyOut(row: unknown): Row | null {
        const r = clean(row);
        return r ? { ...r, reaction_description: r.reaction ?? null } : null;
    }

    async getAllergies(memberId: any): Promise<Row[]> {
        const rows = await this.db.queryAll('SELECT * FROM member_allergies WHERE member_id = $1 ORDER BY id DESC', Number(memberId));
        return cleanList(rows);
    }

    async createAllergy(memberId: any, { allergen, severity, reaction, reaction_description, notes }: any): Promise<Row | null> {
        reaction = reaction ?? reaction_description;
        let effSev = severity || 'Mild';
        if (!['Mild', 'Moderate', 'Severe'].includes(effSev)) effSev = 'Mild';

        const result = await this.db.insert(
            `INSERT INTO member_allergies (member_id, allergen, severity, reaction, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            Number(memberId),
            allergen.trim(),
            effSev,
            reaction ? reaction.trim() : null,
            notes ? notes.trim() : null,
        );

        const created = await this.db.queryOne('SELECT * FROM member_allergies WHERE id = $1', result.lastInsertRowid);
        return clean(created);
    }

    async updateAllergy(id: any, { allergen, severity, reaction, reaction_description, notes }: any): Promise<Row | null> {
        reaction = reaction ?? reaction_description;
        let effSev = severity || 'Mild';
        if (!['Mild', 'Moderate', 'Severe'].includes(effSev)) effSev = 'Mild';

        const aid = Number(id);
        const result = await this.db.execute(
            `UPDATE member_allergies SET
                allergen = $1,
                severity = $2,
                reaction = $3,
                notes = $4,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            allergen.trim(),
            effSev,
            reaction ? reaction.trim() : null,
            notes ? notes.trim() : null,
            aid,
        );

        if (result.changes === 0) return null;
        const updated = await this.db.queryOne('SELECT * FROM member_allergies WHERE id = $1', aid);
        return clean(updated);
    }

    async deleteAllergy(id: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM member_allergies WHERE id = $1', Number(id));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Sub-Entities: Medical History
    // -------------------------------------------------------------
    private static readonly EVENT_TO_CATEGORY: Record<string, string> = {
        Surgery: 'Surgery',
        Hospitalization: 'Previous hospitalization',
        'Chronic Condition': 'Long-term condition',
        Illness: 'Major illness',
        Other: 'Other',
    };
    private static readonly CATEGORIES = ['Major illness', 'Previous hospitalization', 'Surgery', 'Accident / injury', 'Long-term condition', 'Other'];

    private historyOut(row: unknown): Row | null {
        const r = clean(row);
        if (!r) return null;
        const event = Object.keys(FamilyModel.EVENT_TO_CATEGORY).find((k) => FamilyModel.EVENT_TO_CATEGORY[k] === r.category) || 'Other';
        const year = r.year == null ? null : String(r.year);
        return { ...r, event_type: event, event_date: year, facility_name: r.hospital_doctor ?? null, outcome_notes: r.notes ?? null };
    }

    private historyIn({ event_type, category, description, year, event_year, event_date, hospital_doctor, facility_name, notes, outcome_notes }: any) {
        let effYear = year ? parseInt(year, 10) : null;
        if (!effYear && event_year) effYear = parseInt(event_year, 10);
        if (!effYear && event_date) effYear = parseInt(String(event_date), 10) || null;
        hospital_doctor = hospital_doctor ?? facility_name;
        notes = notes ?? outcome_notes;

        let effCategory = FamilyModel.CATEGORIES.includes(category) ? category : null;
        if (!effCategory) {
            let effType = event_type || 'Illness';
            if (!['Surgery', 'Hospitalization', 'Chronic Condition', 'Illness', 'Other'].includes(effType)) effType = 'Illness';
            effCategory = FamilyModel.EVENT_TO_CATEGORY[effType];
        }
        return [
            effCategory,
            String(description).trim(),
            effYear,
            hospital_doctor ? String(hospital_doctor).trim() : null,
            notes ? String(notes).trim() : null,
        ];
    }

    async getHistory(memberId: any): Promise<Row[]> {
        const rows = await this.db.queryAll('SELECT * FROM member_medical_history WHERE member_id = $1 ORDER BY year DESC, id DESC', Number(memberId));
        return rows.map((r) => this.historyOut(r)!);
    }

    async createHistory(memberId: any, body: any): Promise<Row | null> {
        const result = await this.db.insert(
            `INSERT INTO member_medical_history (member_id, category, description, year, hospital_doctor, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            Number(memberId),
            ...this.historyIn(body),
        );

        const created = await this.db.queryOne('SELECT * FROM member_medical_history WHERE id = $1', result.lastInsertRowid);
        return this.historyOut(created);
    }

    async updateHistory(id: any, body: any): Promise<Row | null> {
        const hid = Number(id);
        const result = await this.db.execute(
            `UPDATE member_medical_history SET
                category = $1,
                description = $2,
                year = $3,
                hospital_doctor = $4,
                notes = $5,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            ...this.historyIn(body),
            hid,
        );

        if (result.changes === 0) return null;
        const updated = await this.db.queryOne('SELECT * FROM member_medical_history WHERE id = $1', hid);
        return this.historyOut(updated);
    }

    async deleteHistory(id: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM member_medical_history WHERE id = $1', Number(id));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Sub-Entities: Lifestyle
    // -------------------------------------------------------------
    async getLifestyle(memberId: any): Promise<Row | null> {
        const row = await this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', Number(memberId));
        return row ? clean(row) : {
            smoking_status: 'Never',
            alcohol_status: 'Never',
            physical_activity: 'Moderate',
            diet: '',
            notes: '',
        };
    }

    async saveLifestyle(memberId: any, { smoking_status, alcohol_status, alcohol_consumption, physical_activity, physical_activity_level, diet, diet_type, notes, smoking_frequency, salt_intake }: any): Promise<Row | null> {
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

        const mid = Number(memberId);
        await this.db.execute(
            `INSERT INTO member_lifestyle (member_id, smoking_status, alcohol_status, physical_activity, diet, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (member_id) DO UPDATE SET
                 smoking_status = EXCLUDED.smoking_status,
                 alcohol_status = EXCLUDED.alcohol_status,
                 physical_activity = EXCLUDED.physical_activity,
                 diet = EXCLUDED.diet,
                 notes = EXCLUDED.notes,
                 updated_at = CURRENT_TIMESTAMP`,
            mid,
            effSmoking,
            effAlcohol,
            effActivity,
            effDiet,
            effNotes,
        );

        const saved = await this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', mid);
        return clean(saved);
    }

    // -------------------------------------------------------------
    // Sub-Entities: Follow-Ups
    // -------------------------------------------------------------
    async createFollowUp(memberId: any, studentId: any, {
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
        next_visit_date,
    }: any): Promise<Row | null> {
        const mid = Number(memberId);
        const sid = Number(studentId);
        const countRow = await this.db.queryOne('SELECT COUNT(*) as c FROM follow_ups WHERE member_id = $1', mid);
        const visitNumber = (countRow?.c || 0) + 1;

        const result = await this.db.insert(
            `INSERT INTO follow_ups (
                member_id, student_id, visit_date, visit_number,
                sbp, dbp, rbs, hb, weight_kg, muac_cm,
                treatment_compliance, health_progress, clinical_notes, next_visit_date
            ) VALUES (
                $1, $2, COALESCE($3, to_char(CURRENT_DATE, 'YYYY-MM-DD')), $4,
                $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14
            )`,
            mid,
            sid,
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
            next_visit_date || null,
        );

        const newFu = await this.db.queryOne(
            `SELECT fu.*, s.roll_number as recorded_by_roll, s.name as recorded_by_name
             FROM follow_ups fu
             LEFT JOIN students s ON fu.student_id = s.id
             WHERE fu.id = $1`,
            result.lastInsertRowid,
        );

        return clean(newFu);
    }

    async deleteFollowUp(fuId: any): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM follow_ups WHERE id = $1', Number(fuId));
        return result.changes > 0;
    }

    // -------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------
    async getAnalyticsSummary(sid: any): Promise<FamilyResult> {
        const studentId = Number(sid);
        const [famRow, memRow, adultStats, pediatricStats, calorieStats] = await Promise.all([
            this.db.queryOne('SELECT COUNT(*) as c FROM families WHERE student_id = $1', studentId),
            this.db.queryOne(
                `SELECT COUNT(*) as c
                 FROM family_members m
                 JOIN families f ON m.family_id = f.id
                 WHERE f.student_id = $1`,
                studentId,
            ),
            this.db.queryOne(
                `SELECT
                    COUNT(*) as adults_count,
                    COALESCE(SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END), 0) as htn_count,
                    COALESCE(SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END), 0) as dm_count,
                    COALESCE(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END), 0) as anaemia_count
                 FROM family_members m
                 JOIN families f ON m.family_id = f.id
                 WHERE f.student_id = $1 AND m.age_years >= 18`,
                studentId,
            ),
            this.db.queryOne(
                `SELECT
                    COUNT(*) as under5_count,
                    COALESCE(SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END), 0) as underweight_count,
                    COALESCE(SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END), 0) as stunted_count,
                    COALESCE(SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END), 0) as wasted_count,
                    COALESCE(SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END), 0) as mamta_card_count,
                    COALESCE(SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END), 0) as immunized_count
                 FROM family_members m
                 JOIN families f ON m.family_id = f.id
                 WHERE f.student_id = $1 AND m.age_years <= 5`,
                studentId,
            ),
            this.db.queryAll(
                `SELECT calorie_status, COUNT(*) as count
                 FROM families
                 WHERE student_id = $1
                 GROUP BY calorie_status`,
                studentId,
            ),
        ]);

        const totalFamilies = famRow?.c || 0;
        const totalMembers = memRow?.c || 0;
        const totalStudents = 1;
        const a: any = adultStats || { adults_count: 0, htn_count: 0, dm_count: 0, anaemia_count: 0 };
        const p: any = pediatricStats || { under5_count: 0, underweight_count: 0, stunted_count: 0, wasted_count: 0, mamta_card_count: 0, immunized_count: 0 };

        return {
            totals: {
                families: totalFamilies,
                members: totalMembers,
                students: totalStudents,
            },
            adults: {
                total: a.adults_count,
                htn_count: a.htn_count,
                htn_pct: a.adults_count ? Math.round((a.htn_count / a.adults_count) * 100) : 0,
                dm_count: a.dm_count,
                dm_pct: a.adults_count ? Math.round((a.dm_count / a.adults_count) * 100) : 0,
                anaemia_count: a.anaemia_count,
                anaemia_pct: a.adults_count ? Math.round((a.anaemia_count / a.adults_count) * 100) : 0,
            },
            pediatric: {
                total_under5: p.under5_count,
                underweight_count: p.underweight_count,
                stunted_count: p.stunted_count,
                wasted_count: p.wasted_count,
                mamta_card_coverage: p.under5_count ? Math.round((p.mamta_card_count / p.under5_count) * 100) : 0,
                immunization_coverage: p.under5_count ? Math.round((p.immunized_count / p.under5_count) * 100) : 0,
            },
            calorieDistribution: cleanList(calorieStats),
        };
    }

    async getAnalyticsCharts(sid: any, { gender, ageGroup, familyId }: any): Promise<FamilyResult> {
        const studentId = Number(sid);
        const conditions = ['f.student_id = $1'];
        const params: any[] = [studentId];

        if (gender && gender !== 'all') {
            params.push(gender);
            conditions.push(`m.gender = $${params.length}`);
        }
        if (familyId && familyId !== 'all') {
            params.push(parseInt(familyId, 10));
            conditions.push(`m.family_id = $${params.length}`);
        }
        if (ageGroup && ageGroup !== 'all') {
            if (ageGroup === 'under18') conditions.push('m.age_years < 18');
            else if (ageGroup === '18-44') conditions.push('m.age_years BETWEEN 18 AND 44');
            else if (ageGroup === '45-59') conditions.push('m.age_years BETWEEN 45 AND 59');
            else if (ageGroup === '60+') conditions.push('m.age_years >= 60');
        }

        const whereSql = 'WHERE ' + conditions.join(' AND ');

        const kpiSql = `
            SELECT
                COUNT(*) as total_members,
                COALESCE(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) as males,
                COALESCE(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END), 0) as females,
                ROUND((SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END)::numeric /
                      NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0)) * 1000, 1) as sex_ratio,
                COALESCE(SUM(CASE WHEN m.age_years >= 18 THEN 1 ELSE 0 END), 0) as adult_count,
                COALESCE(SUM(CASE WHEN m.age_years >= 18 AND m.has_htn = 'Y' THEN 1 ELSE 0 END), 0) as htn_cases,
                COALESCE(SUM(CASE WHEN m.age_years >= 18 AND m.has_dm = 'Y' THEN 1 ELSE 0 END), 0) as dm_cases,
                COALESCE(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END), 0) as anaemia_cases,
                ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END)::numeric, 1) as avg_sbp,
                ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END)::numeric, 1) as avg_dbp,
                ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END)::numeric, 1) as avg_rbs,
                ROUND(AVG(CASE WHEN m.hb IS NOT NULL THEN m.hb END)::numeric, 2) as avg_hb,
                ROUND(AVG(CASE WHEN m.bmi IS NOT NULL THEN m.bmi END)::numeric, 2) as avg_bmi
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
        `;

        let familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = $1';
        let familyCountParams: any[] = [studentId];
        if (familyId && familyId !== 'all') {
            familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = $1 AND id = $2';
            familyCountParams = [studentId, parseInt(familyId, 10)];
        }

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
                ROUND((SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as htn_pct,
                SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_count,
                ROUND((SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as dm_pct
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

        const anaemiaGenderSql = `
            SELECT
                m.gender,
                COUNT(*) as total,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemic_count,
                ROUND((SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as anaemia_pct,
                SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) as pallor_count,
                ROUND(AVG(m.hb)::numeric, 2) as avg_hb
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY m.gender
        `;

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

        const calSql = familyId && familyId !== 'all'
            ? 'SELECT calorie_status, COUNT(*) as count FROM families WHERE student_id = $1 AND id = $2 GROUP BY calorie_status'
            : 'SELECT calorie_status, COUNT(*) as count FROM families WHERE student_id = $1 GROUP BY calorie_status';
        const calParams = familyId && familyId !== 'all' ? [studentId, parseInt(familyId, 10)] : [studentId];

        const cohortSql = `
            SELECT
                fu.visit_number,
                COUNT(*) as visits_count,
                ROUND(AVG(fu.sbp)::numeric, 1) as avg_sbp,
                ROUND(AVG(fu.dbp)::numeric, 1) as avg_dbp,
                ROUND(AVG(fu.rbs)::numeric, 1) as avg_rbs,
                ROUND(AVG(fu.hb)::numeric, 1) as avg_hb,
                ROUND(AVG(fu.weight_kg)::numeric, 1) as avg_wt
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY fu.visit_number
            ORDER BY fu.visit_number
        `;

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

        const [
            kpis,
            famCountRow,
            bmiDistribution,
            ncdByAgeGroup,
            bpCategories,
            anaemiaByGender,
            conditionsRanking,
            lifestyleWork,
            dietaryStatus,
            cohortTrends,
            rawCurves,
            memberList,
        ] = await Promise.all([
            this.db.queryOne(kpiSql, ...params),
            this.db.queryOne(familyCountSql, ...familyCountParams),
            this.db.queryAll(bmiSql, ...params),
            this.db.queryAll(ncdAgeSql, ...params),
            this.db.queryAll(bpSql, ...params),
            this.db.queryAll(anaemiaGenderSql, ...params),
            this.db.queryAll(condSql, ...params),
            this.db.queryAll(workSql, ...params),
            this.db.queryAll(calSql, ...calParams),
            this.db.queryAll(cohortSql, ...params),
            this.db.queryAll(patientCurvesSql, ...params),
            this.db.queryAll(listSql, ...params),
        ]);

        const totalHouseholds = famCountRow?.c || 0;

        const patientCurvesMap: Record<string, any> = {};
        for (const row of rawCurves) {
            if (!patientCurvesMap[row.member_id]) {
                patientCurvesMap[row.member_id] = {
                    id: row.member_id,
                    name: row.member_name,
                    gender: row.gender,
                    visits: [],
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
                compliance: row.treatment_compliance,
            });
        }
        const patientCurves = Object.values(patientCurvesMap);

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
                avgBmi: kpis?.avg_bmi || null,
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
                patientCurves: cleanList(patientCurves),
            },
            memberList: cleanList(memberList),
        };
    }

    async getAnalyticsReport(sid: any, reportId: any): Promise<FamilyResult> {
        let sql = '';
        const params = [Number(sid)];

        switch (reportId) {
            case 'student-audit':
                sql = `
                    SELECT
                        s.roll_number,
                        s.name AS student_name,
                        COUNT(DISTINCT f.id) AS total_families_surveyed,
                        COUNT(m.id) AS total_members_surveyed,
                        COALESCE(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) AS male_count,
                        COALESCE(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END), 0) AS female_count,
                        ROUND((SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END)::numeric /
                              NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0)) * 1000, 1) AS sex_ratio
                    FROM students s
                    LEFT JOIN families f ON s.id = f.student_id
                    LEFT JOIN family_members m ON f.id = m.family_id
                    WHERE s.id = $1
                    GROUP BY s.id, s.roll_number, s.name
                `;
                break;

            case 'ncd-prevalence':
                sql = `
                    SELECT
                        COUNT(*) AS total_adults,
                        COALESCE(SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END), 0) AS htn_cases,
                        ROUND((SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS htn_pct,
                        COALESCE(SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END), 0) AS dm_cases,
                        ROUND((SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS dm_pct,
                        COALESCE(SUM(CASE WHEN m.has_htn = 'Y' AND m.has_dm = 'Y' THEN 1 ELSE 0 END), 0) AS htn_and_dm_cases,
                        ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END)::numeric, 1) AS mean_sbp,
                        ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END)::numeric, 1) AS mean_dbp,
                        ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END)::numeric, 1) AS mean_rbs
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = $1 AND m.age_years >= 18
                `;
                break;

            case 'anaemia-gender':
                sql = `
                    SELECT
                        m.gender,
                        COUNT(*) AS total_individuals,
                        SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) AS anaemic_count,
                        ROUND((SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS anaemia_pct,
                        SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) AS pallor_count,
                        ROUND(AVG(m.hb)::numeric, 2) AS average_hb
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = $1 AND m.gender IN ('M', 'F')
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
                    WHERE f.student_id = $1 AND m.age_years >= 18 AND m.bmi IS NOT NULL
                    GROUP BY bmi_category
                `;
                break;

            case 'pediatric-health':
                sql = `
                    SELECT
                        COUNT(*) AS total_under_5,
                        COALESCE(SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END), 0) AS underweight,
                        COALESCE(SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END), 0) AS stunting,
                        COALESCE(SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END), 0) AS wasting,
                        COALESCE(SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END), 0) AS mamta_card,
                        COALESCE(SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END), 0) AS age_immunized
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = $1 AND m.age_years <= 5
                `;
                break;

            default:
                return { invalidReport: true };
        }

        const data = await this.db.queryAll(sql, ...params);
        return { reportId, data: cleanList(data) };
    }
}
