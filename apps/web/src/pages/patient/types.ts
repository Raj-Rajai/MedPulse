/** API payloads of /api/patient/* (fields the portal reads). */

export interface PatientCard {
    id?: number;
    name?: string;
    patient_uid?: string;
    age_years?: number | null;
    gender?: string | null;
    blood_group?: string | null;
    family_role?: string | null;
    date_of_birth?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    family_address?: string | null;
    village?: string | null;
    city?: string | null;
    family_code?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_relation?: string | null;
    emergency_contact_phone?: string | null;
    hospital_name?: string | null;
    created_at?: string | null;
    student_id?: number | null;
    student_name?: string | null;
    student_roll?: string | null;
    college_name?: string | null;
}

export interface FamilyInfo {
    family_name?: string | null;
    head_of_family?: string | null;
    family_code?: string | null;
    address?: string | null;
    village?: string | null;
    city?: string | null;
    district?: string | null;
    pincode?: string | null;
    student_name?: string | null;
}

export interface FamilyMember {
    id: number;
    name: string;
    is_self?: boolean | number;
    relation_to_hof?: string | null;
    account_uid?: string | null;
    surveyed?: boolean | number;
    patient_updated_at?: string | null;
    age_years?: number | null;
    age_months?: number | null;
    date_of_birth?: string | null;
    gender?: string | null;
    contact_number?: string | null;
    occupation?: string | null;
    education?: string | null;
    marital_status?: string | null;
    can_edit?: boolean | number;
    can_delete?: boolean | number;
    sbp?: number | null;
    dbp?: number | null;
    rbs?: number | null;
    hb?: number | null;
    bmi?: number | string | null;
    conditions?: string | null;
}

export interface FamilyPayload {
    family?: FamilyInfo | null;
    members: FamilyMember[];
    can_edit?: boolean | number;
    relations?: string[];
}

export interface Medication { name?: string; dosage?: string | null; frequency?: string | null; reason?: string | null }
export interface Condition { condition_name?: string; notes?: string | null; status?: string | null }
export interface Allergy { allergen?: string; reaction?: string | null; allergy_type?: string | null; severity?: string | null }
export interface FollowUp {
    visit_number?: number | null;
    visit_date?: string | null;
    clinical_notes?: string | null;
    sbp?: number | string | null;
    dbp?: number | string | null;
    rbs?: number | string | null;
    hb?: number | string | null;
    health_progress?: string | null;
    next_visit_date?: string | null;
    [k: string]: unknown;
}
export interface RecordsPayload {
    member?: { sbp?: number | null; dbp?: number | null; rbs?: number | null; hb?: number | null; bmi?: number | string | null; [k: string]: unknown } | null;
    medications?: Medication[];
    conditions?: Condition[];
    allergies?: Allergy[];
    follow_ups?: FollowUp[];
}

export interface CampNotification {
    notification_id: number;
    notification_status?: string | null;
    rsvp?: string | null;
    rsvp_note?: string | null;
    event_date?: string | null;
    campaign_status?: string | null;
    campaign_title?: string;
    campaign_description?: string | null;
    matched_keyword?: string | null;
    matched_condition_detail?: string | null;
    venue?: string | null;
    organizing_college?: string | null;
    contacted_at?: string | null;
    cadet_call_status?: string | null;
    cadet_name?: string | null;
    patient_contact_confirmation?: string | null;
}

export interface Hospital {
    name?: string;
    type?: string | null;
    city?: string | null;
    contact_phone?: string | null;
}

export interface HospitalRequest {
    id: number;
    status: string;
    channel?: string | null;
    reason?: string | null;
    department?: string | null;
    created_at?: string | null;
    for_member_name?: string | null;
    preferred_time?: string | null;
    message?: string | null;
    scheduled_for?: string | null;
    hospital_note?: string | null;
    handled_by_name?: string | null;
    patient_confirmation?: string | null;
}

export interface PortalState {
    card: PatientCard | null;
    records: RecordsPayload | null;
    family: FamilyPayload | null;
    notifs: CampNotification[];
    requests: HospitalRequest[];
    hospital: Hospital | null;
    departments: string[];
    reasons: string[];
}

export type TabId = 'overview' | 'profile' | 'family' | 'hospital' | 'campaigns' | 'records';
export const TABS: TabId[] = ['overview', 'profile', 'family', 'hospital', 'campaigns', 'records'];
