export type Scalar = string | number | null | undefined;

/** GET /api/families row. */
export interface FamilyRow {
    id: number;
    family_no?: number;
    family_name?: string | null;
    head_of_family?: string | null;
}

/** Roster member inside GET /api/families/:id. */
export interface RosterMember {
    id: number;
    name?: string;
    member_order?: Scalar;
    relation_to_hof?: string | null;
    age_years?: Scalar;
    gender?: string | null;
    occupation?: string | null;
    contact_number?: string | null;
    conditions_summary?: string | null;
    has_htn?: string | null;
    has_dm?: string | null;
    has_anaemia?: string | null;
    anc_taken?: string | null;
    sbp?: Scalar;
    dbp?: Scalar;
    hb?: Scalar;
    bmi?: Scalar;
    added_by_patient_id?: Scalar;
    patient_updated_at?: Scalar;
}

/** GET /api/families/:id */
export interface FamilyDetail {
    family_code?: string | null;
    family_no?: Scalar;
    family_name?: string | null;
    head_of_family?: string;
    village_ward?: string | null;
    contact_phone?: string | null;
    contact_number?: string | null;
    roll_number?: string | null;
    address?: string | null;
    city?: string | null;
    pincode?: string | null;
    total_cu?: Scalar;
    calorie_intake_per_cu?: Scalar;
    calorie_status?: string | null;
    dietary_advice_given?: string | null;
    members?: RosterMember[];
}

export interface Condition {
    id: number;
    condition_name?: string;
    category?: string | null;
    status?: string | null;
    severity?: string | null;
    diagnosis_date?: string | null;
    notes?: string | null;
}
export interface Medication {
    id: number;
    medication_name?: string;
    dosage?: string | null;
    frequency?: string | null;
    route?: string | null;
    prescribed_for?: string | null;
    start_date?: string | null;
    adherence_status?: string | null;
}
export interface Allergy {
    id: number;
    allergen?: string;
    allergy_type?: string | null;
    severity?: string | null;
    reaction_description?: string | null;
}
export interface HistoryItem {
    id: number;
    event_type?: string | null;
    description?: string;
    event_date?: string | null;
    facility_name?: string | null;
    outcome_notes?: string | null;
}
export interface Lifestyle {
    smoking_status?: string | null;
    smoking_frequency?: string | null;
    alcohol_consumption?: string | null;
    diet_type?: string | null;
    physical_activity_level?: string | null;
    salt_intake?: string | null;
    sleep_hours_per_night?: Scalar;
    notes?: string | null;
}
export interface FollowUp {
    id: number;
    visit_number?: Scalar;
    visit_date?: string;
    health_progress?: string | null;
    treatment_compliance?: string | null;
    sbp?: Scalar;
    dbp?: Scalar;
    rbs?: Scalar;
    hb?: Scalar;
    weight_kg?: Scalar;
    clinical_notes?: string;
    recorded_by_roll?: string | null;
    next_visit_date?: string | null;
}

/** GET /api/members/:id */
export interface MemberDetail {
    id: number;
    name?: string;
    relation_to_hof?: string | null;
    age_years?: Scalar;
    age_months?: Scalar;
    gender?: string | null;
    marital_status?: string | null;
    occupation?: string | null;
    date_of_birth?: string | null;
    education_level?: string | null;
    contact_number?: string | null;
    contact_phone?: string | null;
    work_type?: string | null;
    sbp?: Scalar;
    dbp?: Scalar;
    rbs?: Scalar;
    hb?: Scalar;
    bmi?: Scalar;
    muac_cm?: Scalar;
    oral_hygiene?: string | null;
    general_hygiene?: string | null;
    diagnosis?: string | null;
    treatment_taken?: string | null;
    treatment_source?: string | null;
    hc_cm?: Scalar;
    cc_cm?: Scalar;
    is_underweight?: Scalar;
    is_stunting?: Scalar;
    is_wasting?: Scalar;
    mamta_card?: Scalar;
    immunization_status?: Scalar;
    anc_taken?: Scalar;
    delivery_place?: Scalar;
    pnc_taken?: Scalar;
    fp_method_used?: Scalar;
    student_roll?: string | null;
    student_name?: string | null;
    conditions?: Condition[];
    medications?: Medication[];
    allergies?: Allergy[];
    history?: HistoryItem[];
    lifestyle?: Lifestyle | null;
    follow_ups?: FollowUp[];
}

export type FormValues = Record<string, string>;

/** `today` as the page computed it: new Date().toISOString().split('T')[0]. */
export const isoToday = () => new Date().toISOString().split('T')[0];

/** calcAgeFromDob / calcEditAgeFromDob: whole years since the date (UTC-parsed like the original). */
export function ageFromDob(dobVal: string): { age: number; months: number } {
    const dob = new Date(dobVal);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
    const months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
    return { age, months };
}

/** `input.value = v` as the original wrote it: null clears the field, undefined becomes the text "undefined". */
export const inputValue = (v: Scalar): string => (v === null || v === undefined ? '' : `${v}`);
