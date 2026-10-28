export type Scalar = string | number | null | undefined;

export type ProfessionalYear = 'Year 1' | 'Year 2' | 'Year 3';
export type SurveyStatus = 'draft' | 'submitted';

/** GET /api/families row (fields the page reads). */
export interface FamilySummary {
    id: number;
    family_code?: string | null;
    family_no: number;
    head_of_family: string;
    village_ward?: string | null;
    member_count?: number;
    family_name?: string | null;
}

/** A member as returned inside GET /api/families/:id (survey columns read by key). */
export interface Member {
    id: number;
    medpulse_id?: string | null;
    name?: string;
    member_order?: Scalar;
    relation_to_hof?: string | null;
    age_years?: Scalar;
    age_months?: Scalar;
    gender?: string | null;
    occupation?: string | null;
    date_of_birth?: string | null;
    contact_number?: string | null;
    marital_status?: string | null;
    education?: string | null;
    [key: string]: Scalar;
}

/** GET /api/families/:id */
export interface FamilyDetail {
    id?: number;
    family_code?: string | null;
    family_no?: Scalar;
    head_of_family?: string;
    village_ward?: string | null;
    address?: string | null;
    total_cu?: Scalar;
    calorie_intake_per_cu?: Scalar;
    calorie_status?: string | null;
    dietary_advice_given?: string | null;
    notes?: string | null;
    members?: Member[];
}

export const familyCode = (f: { family_code?: string | null; family_no?: Scalar }) => f.family_code || `FAM-${String(f.family_no).padStart(4, '0')}`;

export const isSurveyDone = (m: Member) => Number(m.sbp) > 0 || Number(m.hb) > 0 || Number(m.height_m) > 0 || Number(m.muac_cm) > 0;

/** Complete survey record for an individual member for a specific professional year */
export interface MemberSurveyData {
    // Socio-Demographic Profile (Data entry.pdf p. 1)
    name: string;
    age_years: string;
    age_months: string;
    gender: 'M' | 'F' | 'TG' | string;
    date_of_birth: string;
    medpulse_id: string;
    relation_to_hof: string;
    marital_status: string;
    education: string;
    occupation: string;
    contact_number?: string;
    addiction: string;

    // Family Health Records - 1 (First/Second/Third Year) (Data entry.pdf p. 1, 2, 4, 6)
    pr: string;
    rr: string;
    has_htn: 'Y' | 'N' | string;
    sbp: string;
    dbp: string;
    has_dm: 'Y' | 'N' | string;
    rbs: string;
    hb: string;
    has_anaemia: 'Y' | 'N' | string;
    has_pallor: 'Y' | 'N' | string;
    hc_cm: string; // Head Circumference (Age <= 2 yrs)
    cc_cm: string; // Chest Circumference (Age <= 2 yrs)
    muac_cm: string; // Mid Upper Arm Circumference (6 mos - 5 yrs)
    is_pregnant_woman: 'Y' | 'N' | string;
    health_records_advice: string;

    // Health Status (Data entry.pdf p. 3, 6)
    past_illness_last_year: 'Y' | 'N' | string;
    co_present_illness: 'Y' | 'N' | string;
    diagnosis: string;
    treatment_taken: 'Y' | 'N' | string;
    treatment_source: string;
    oral_health_checkup: 'Y' | 'N' | string;
    hygiene_status: 'Y' | 'N' | string;

    // Family Health Records - 2 (Anthropometry) (Data entry.pdf p. 4, 5)
    height_m: string;
    weight_kg: string;
    bmi: string; // Auto-calculated
    waist_cm: string;
    hip_cm: string;
    whr: string; // Auto-calculated
    is_underweight: 'Y' | 'N' | string;
    is_overweight: 'Y' | 'N' | string;
    is_stunting: 'Y' | 'N' | string;
    is_wasting: 'Y' | 'N' | string;
    is_severe_wasting: 'Y' | 'N' | string; // Age < 5 yrs
    anthropometry_advice: string;

    // Maternal History - Antenatal Care (Data entry.pdf p. 7)
    anc_taken: 'Y' | 'N' | string;
    anc_visits_count: string;
    anc_place: 'Government' | 'Private' | 'Health worker' | 'Others' | string;
    inj_tt: '1' | '2' | 'B' | string;
    ifa_tablets: 'Y' | 'N' | string;
    anc_bp: string;
    anc_hb: string;
    urine_sugar: string;
    urine_albumin: string;

    // Female-Specific - Delivery, PNC, Family Planning (Female specific .pdf p. 41)
    delivery_place: string;
    delivery_attendant: string;
    delivery_type: string;
    delivery_complication: string;
    pnc_visits_count: string;
    pnc_complication: string;
    colostrum_given: 'Y' | 'N' | string;
    breastfeeding: 'Y' | 'N' | string;
    duration_of_breastfeeding: string;
    pnc_ifa_tablets: 'Y' | 'N' | string;
    fp_methods_used: 'Y' | 'N' | string;
    fp_method_type: string;
    fp_non_use_reason: string;

    // Child-Specific Immunization & MCH (kids specific .pdf pp. 42-43)
    mamta_card_present: 'Present' | 'Absent' | string;
    // Vaccines checklist (comma-separated or record of true/false)
    vaccines_received: Record<string, boolean>;
    vitamin_a_doses: Record<string, boolean>;
    not_immunized_reason: string;
    ippi_all_doses: 'Y' | 'N' | string;
    ippi_non_dose_reason: string;
    health_worker_visit: 'Y' | 'N' | string;
    nearby_anganwadi: string;
    anganwadi_access: 'Y' | 'N' | string;

    // Birth History (Infants) (kids specific .pdf p. 43)
    birth_place: string;
    birth_attendant: string;
    birth_weight_kg: string;
    infant_colostrum: 'Y' | 'N' | string;
    infant_breastfeeding: 'Y' | 'N' | string;
    complementary_feeding: string;

    // Consumption Unit for Member (calculate-ai.pdf p. 44)
    work_type: 'Sedentary' | 'Moderate' | 'Heavy' | string;
    physiological_status: 'None' | 'Pregnancy' | 'Lactation' | string;
    consumption_unit: string;
}

/** Complete Survey Record for a Household per Professional Year */
export interface FamilySurveyRecord {
    familyId: number;
    professionalYear: ProfessionalYear;
    status: SurveyStatus;
    updatedAt: string;
    // Member survey states keyed by memberId
    memberSurveys: Record<number, MemberSurveyData>;
    // Household nutrition intake: quantity per day in grams keyed by foodItemId
    nutritionIntakeDay: Record<string, number>;
    // Family Dietary assessment (ICMR)
    totalCu: string;
    calorieIntakePerCu: string;
    calorieStatus: string;
    dietaryAdviceGiven: string;
}
