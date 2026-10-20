/**
 * surveyStorage.ts
 * Frontend persistence & data adapter for Community Health Survey.
 * Strictly adheres to Frontend-Only invariant: syncs standard columns to
 * PUT /api/members/:id and PUT /api/families/:id, while mirroring full
 * structured multi-year records in `localStorage` and `families.notes`.
 */

import { calculateMemberCU } from './cuCalculation';
import type { FamilyDetail, FamilySurveyRecord, Member, MemberSurveyData, ProfessionalYear, SurveyStatus } from './types';

const STORAGE_PREFIX = 'medpulse_survey_v1_';

export function getSurveyStorageKey(familyId: number, year: ProfessionalYear): string {
    return `${STORAGE_PREFIX}${familyId}_${year.replace(/\s+/g, '_')}`;
}

export function deriveAgeFromDob(dobString: string, refDate = new Date()): { years: number; months: number; weeks: number; display: string } {
    if (!dobString) return { years: 0, months: 0, weeks: 0, display: '' };
    const birth = new Date(dobString);
    if (isNaN(birth.getTime())) return { years: 0, months: 0, weeks: 0, display: '' };

    let years = refDate.getFullYear() - birth.getFullYear();
    let months = refDate.getMonth() - birth.getMonth();
    let days = refDate.getDate() - birth.getDate();

    if (days < 0) {
        months -= 1;
        // Approximation for days in prior month
        days += 30;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    const diffMs = refDate.getTime() - birth.getTime();
    const totalWeeks = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));

    let display = '';
    if (years >= 2) {
        display = `${years}y`;
    } else if (years >= 1) {
        display = `${years}y ${months}m`;
    } else if (months >= 1) {
        display = `${months}m`;
    } else {
        display = `${totalWeeks}w`;
    }

    return { years: Math.max(0, years), months: Math.max(0, months), weeks: totalWeeks, display };
}

/**
 * Creates a clean MemberSurveyData object, prefilled from the member master identity if available.
 */
export function createEmptyMemberSurvey(m?: Member | null): MemberSurveyData {
    const dob = m?.date_of_birth || '';
    const derived = deriveAgeFromDob(dob);

    const ageY = m?.age_years != null ? String(m.age_years) : (derived.display ? String(derived.years) : '');
    const ageM = m?.age_months != null ? String(m.age_months) : (derived.display ? String(derived.months) : '0');
    const gender = (m?.gender || 'M').toUpperCase();
    const workType = String(m?.work_type || 'Moderate');
    const initialCu = calculateMemberCU(parseInt(ageY, 10) || 0, gender, workType, 'None');

    return {
        // Socio-demographic
        name: m?.name || '',
        age_years: ageY,
        age_months: ageM,
        gender: gender as any,
        date_of_birth: dob,
        aadhaar_number: '',
        relation_to_hof: m?.relation_to_hof || 'Family Member',
        marital_status: m?.marital_status && m.marital_status !== 'NA' ? String(m.marital_status) : 'Unmarried',
        education: String(m?.education || ''),
        occupation: String(m?.occupation || ''),
        contact_number: String(m?.contact_number || ''),
        abha_id: '',
        addiction: '',

        // Health Records - 1
        pr: String(m?.pr || ''),
        rr: String(m?.rr || ''),
        has_htn: (m?.has_htn as any) || 'N',
        sbp: m?.sbp != null ? String(m.sbp) : '',
        dbp: m?.dbp != null ? String(m.dbp) : '',
        has_dm: (m?.has_dm as any) || 'N',
        rbs: m?.rbs != null ? String(m.rbs) : '',
        hb: m?.hb != null ? String(m.hb) : '',
        has_anaemia: (m?.has_anaemia as any) || 'N',
        has_pallor: (m?.has_pallor as any) || 'N',
        hc_cm: m?.hc_cm != null ? String(m.hc_cm) : '',
        cc_cm: m?.cc_cm != null ? String(m.cc_cm) : '',
        muac_cm: m?.muac_cm != null ? String(m.muac_cm) : '',
        is_pregnant_woman: 'N',
        health_records_advice: '',

        // Health Status
        past_illness_last_year: 'N',
        co_present_illness: 'N',
        diagnosis: String(m?.diagnosis || ''),
        treatment_taken: (m?.treatment_taken as any) || 'N',
        treatment_source: String(m?.treatment_source || ''),
        oral_health_checkup: (m?.oral_hygiene as any) || 'Y',
        hygiene_status: (m?.general_hygiene as any) || 'Y',

        // Health Records - 2 (Anthropometry)
        height_m: m?.height_m != null ? String(m.height_m) : '',
        weight_kg: m?.weight_kg != null ? String(m.weight_kg) : '',
        bmi: m?.bmi != null ? String(m.bmi) : '',
        waist_cm: m?.waist_cm != null ? String(m.waist_cm) : '',
        hip_cm: m?.hip_cm != null ? String(m.hip_cm) : '',
        whr: m?.whr != null ? String(m.whr) : '',
        is_underweight: (m?.is_underweight as any) || 'N',
        is_overweight: (m?.is_overweight as any) || 'N',
        is_stunting: (m?.is_stunting as any) || 'N',
        is_wasting: (m?.is_wasting as any) || 'N',
        is_severe_wasting: (m?.is_severe_wasting as any) || 'N',
        anthropometry_advice: '',

        // Maternal History
        anc_taken: (m?.anc_taken as any) || 'N',
        anc_visits_count: '',
        anc_place: 'Government',
        inj_tt: '1',
        ifa_tablets: 'N',
        anc_bp: '',
        anc_hb: '',
        urine_sugar: '',
        urine_albumin: '',

        // Female-Specific
        delivery_place: String(m?.delivery_place || ''),
        delivery_attendant: '',
        delivery_type: '',
        delivery_complication: '',
        pnc_visits_count: '',
        pnc_complication: '',
        colostrum_given: 'N',
        breastfeeding: 'N',
        duration_of_breastfeeding: '',
        pnc_ifa_tablets: 'N',
        fp_methods_used: (m?.fp_method_used as any) || 'N',
        fp_method_type: '',
        fp_non_use_reason: '',

        // Child-Specific
        mamta_card_present: (m?.mamta_card as any) || 'Present',
        vaccines_received: {},
        vitamin_a_doses: {},
        not_immunized_reason: '',
        ippi_all_doses: 'Y',
        ippi_non_dose_reason: '',
        health_worker_visit: 'Y',
        nearby_anganwadi: '',
        anganwadi_access: 'Y',

        // Birth History
        birth_place: '',
        birth_attendant: '',
        birth_weight_kg: '',
        infant_colostrum: 'N',
        infant_breastfeeding: 'N',
        complementary_feeding: '',

        // Consumption Unit
        work_type: workType,
        physiological_status: 'None',
        consumption_unit: String(initialCu),
    };
}

/**
 * Loads the survey record for a family and professional year.
 * Checks localStorage first; falls back to embedded family notes, then generates defaults.
 * Synchronizes all family members and master fields so data entered on the family page reflects immediately.
 */
export function loadFamilySurveyRecord(
    familyId: number,
    year: ProfessionalYear,
    familyDetail?: FamilyDetail | null
): FamilySurveyRecord {
    const key = getSurveyStorageKey(familyId, year);
    let record: FamilySurveyRecord | null = null;

    // 1. LocalStorage lookup
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const parsed = JSON.parse(cached) as FamilySurveyRecord;
            if (parsed && parsed.familyId === familyId) {
                record = parsed;
            }
        }
    } catch (e) {
        console.warn('Error reading survey from localStorage:', e);
    }

    // 2. Embedded in family notes lookup
    if (!record && familyDetail?.notes && familyDetail.notes.includes('medpulse_survey_records')) {
        try {
            const parsedNotes = JSON.parse(familyDetail.notes);
            if (parsedNotes?.survey_records?.[year]) {
                const rec = parsedNotes.survey_records[year] as FamilySurveyRecord;
                if (rec) record = rec;
            }
        } catch {
            // ignore JSON parse error
        }
    }

    // 3. Fallback: Create initial record from existing family members
    if (!record) {
        record = {
            familyId,
            professionalYear: year,
            status: 'draft',
            updatedAt: new Date().toISOString(),
            memberSurveys: {},
            nutritionIntakeDay: {},
            totalCu: String(familyDetail?.total_cu || '0'),
            calorieIntakePerCu: String(familyDetail?.calorie_intake_per_cu || '0'),
            calorieStatus: familyDetail?.calorie_status || 'Normal',
            dietaryAdviceGiven: familyDetail?.dietary_advice_given || 'N',
        };
    }

    if (!record.memberSurveys) record.memberSurveys = {};

    // 4. Ensure ALL members from familyDetail exist and reflect master entered data
    const members = familyDetail?.members || [];
    for (const m of members) {
        const existing = record.memberSurveys[m.id];
        if (!existing) {
            record.memberSurveys[m.id] = createEmptyMemberSurvey(m);
        } else {
            // Reflect master fields entered from the family manage page
            if (m.name && m.name.trim()) existing.name = m.name.trim();
            if (m.gender) existing.gender = (m.gender || 'M').toUpperCase();
            if (m.relation_to_hof) existing.relation_to_hof = m.relation_to_hof;
            if (m.contact_number) existing.contact_number = m.contact_number;
            if (m.date_of_birth && !existing.date_of_birth) existing.date_of_birth = m.date_of_birth;
            if (m.age_years != null && (!existing.age_years || existing.age_years === '0' || existing.age_years === '')) {
                existing.age_years = String(m.age_years);
            }
            if (m.age_months != null && (!existing.age_months || existing.age_months === '0' || existing.age_months === '')) {
                existing.age_months = String(m.age_months);
            }
            if (m.marital_status && m.marital_status !== 'NA' && (!existing.marital_status || existing.marital_status === 'Unmarried')) {
                existing.marital_status = m.marital_status;
            }
            if (m.education && !existing.education) existing.education = m.education;
            if (m.occupation && !existing.occupation) existing.occupation = m.occupation;
        }
    }

    // Sync household-level nutrition fields if available
    if (familyDetail?.total_cu) record.totalCu = String(familyDetail.total_cu);
    if (familyDetail?.calorie_intake_per_cu) record.calorieIntakePerCu = String(familyDetail.calorie_intake_per_cu);
    if (familyDetail?.calorie_status) record.calorieStatus = familyDetail.calorie_status;
    if (familyDetail?.dietary_advice_given) record.dietaryAdviceGiven = familyDetail.dietary_advice_given;

    persistSurveyLocally(record);
    return record;
}

/**
 * Persists family survey record locally in localStorage.
 */
export function persistSurveyLocally(record: FamilySurveyRecord): void {
    try {
        const key = getSurveyStorageKey(record.familyId, record.professionalYear);
        localStorage.setItem(key, JSON.stringify(record));
    } catch (e) {
        console.warn('Failed to save survey to localStorage:', e);
    }
}

/**
 * Synchronizes the survey record with backend API:
 * 1. Calls PUT /api/members/:id for any surveyed members to update standard clinical columns.
 * 2. Calls PUT /api/families/:id to store dietary info and serialized survey in notes.
 */
export async function syncSurveyWithBackend(
    record: FamilySurveyRecord,
    statusOverride?: SurveyStatus
): Promise<void> {
    const finalRecord: FamilySurveyRecord = {
        ...record,
        status: statusOverride || record.status,
        updatedAt: new Date().toISOString(),
    };

    // Always persist to localStorage first
    persistSurveyLocally(finalRecord);

    // Save member records to backend
    const memberIds = Object.keys(finalRecord.memberSurveys).map(Number);
    for (const mId of memberIds) {
        const ms = finalRecord.memberSurveys[mId];
        if (!ms) continue;

        const memberPayload = {
            name: ms.name || null,
            gender: ms.gender || null,
            relation_to_hof: ms.relation_to_hof || null,
            contact_number: ms.contact_number || null,
            date_of_birth: ms.date_of_birth || null,
            age_years: parseInt(ms.age_years, 10) || null,
            age_months: parseInt(ms.age_months, 10) || null,
            marital_status: ms.marital_status || null,
            education: ms.education || null,
            occupation: ms.occupation || null,
            has_htn: ms.has_htn || 'N',
            sbp: ms.sbp ? parseInt(ms.sbp, 10) : null,
            dbp: ms.dbp ? parseInt(ms.dbp, 10) : null,
            has_dm: ms.has_dm || 'N',
            rbs: ms.rbs ? parseFloat(ms.rbs) : null,
            has_pallor: ms.has_pallor || 'N',
            hb: ms.hb ? parseFloat(ms.hb) : null,
            has_anaemia: ms.has_anaemia || 'N',
            height_m: ms.height_m ? parseFloat(ms.height_m) : null,
            weight_kg: ms.weight_kg ? parseFloat(ms.weight_kg) : null,
            bmi: ms.bmi ? parseFloat(ms.bmi) : null,
            waist_cm: ms.waist_cm ? parseFloat(ms.waist_cm) : null,
            hip_cm: ms.hip_cm ? parseFloat(ms.hip_cm) : null,
            whr: ms.whr ? parseFloat(ms.whr) : null,
            hc_cm: ms.hc_cm ? parseFloat(ms.hc_cm) : null,
            cc_cm: ms.cc_cm ? parseFloat(ms.cc_cm) : null,
            muac_cm: ms.muac_cm ? parseFloat(ms.muac_cm) : null,
            is_underweight: ms.is_underweight || 'N',
            is_overweight: ms.is_overweight || 'N',
            is_stunting: ms.is_stunting || 'N',
            is_wasting: ms.is_wasting || 'N',
            is_severe_wasting: ms.is_severe_wasting || 'N',
            diagnosis: ms.diagnosis ? ms.diagnosis.trim() : null,
            treatment_taken: ms.treatment_taken || 'N',
            treatment_source: ms.treatment_source ? ms.treatment_source.trim() : null,
            oral_hygiene: ms.oral_health_checkup || 'Y',
            general_hygiene: ms.hygiene_status || 'Y',
            anc_taken: ms.anc_taken || 'N',
            delivery_place: ms.delivery_place || null,
            pnc_taken: ms.pnc_visits_count ? 'Y' : 'N',
            fp_method_used: ms.fp_methods_used || 'N',
            mamta_card: ms.mamta_card_present === 'Present' ? 'Y' : 'N',
            immunization_status: ms.ippi_all_doses === 'Y' ? 'Y' : 'N',
            work_type: ms.work_type || 'M',
            consumption_unit: parseFloat(ms.consumption_unit) || 1.0,
        };

        try {
            await fetch(`/api/members/${mId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberPayload),
            });
        } catch (e) {
            console.warn(`Failed to sync member ${mId} to API:`, e);
        }
    }

    // Save family diet and embed full survey records in family notes
    try {
        const familyPayload = {
            total_cu: parseFloat(finalRecord.totalCu) || null,
            calorie_intake_per_cu: parseInt(finalRecord.calorieIntakePerCu, 10) || null,
            calorie_status: finalRecord.calorieStatus || 'Normal',
            dietary_advice_given: finalRecord.dietaryAdviceGiven || 'N',
            notes: JSON.stringify({
                medpulse_survey_records: true,
                version: 1,
                last_year: finalRecord.professionalYear,
                survey_records: {
                    [finalRecord.professionalYear]: finalRecord,
                },
            }),
        };

        await fetch(`/api/families/${finalRecord.familyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(familyPayload),
        });
    } catch (e) {
        console.warn('Failed to sync family record to API:', e);
    }
}
