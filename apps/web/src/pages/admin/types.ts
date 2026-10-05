/** Payloads the admin console reads from the API (only the fields the page uses). */

export type AdminTab =
    | 'overview' | 'students' | 'attendance' | 'schedule' | 'exams' | 'households'
    | 'campaigns' | 'uniAdmins' | 'exports';

export interface AdminScheduleItem {
    id: number;
    college_id?: number;
    date_iso: string;
    card_date?: string;
    card_day?: string;
    card_time?: string;
    time_slot?: string;
    lecture_no?: number;
    department?: string;
    session_type?: 'Theory' | 'Practical';
    teaching_type?: string;
    venue?: string;
    room_no?: string;
    subject?: string;
    subject_name?: string;
    subject_code?: string;
    topic?: string;
    competency_no?: string | null;
    faculty_name?: string;
    batch_year?: string;
    semester?: string;
    attendance_count?: number;
    attendance_requested?: boolean;
    attendance_requested_at?: string | null;
}

export interface CollegeStat {
    id: number;
    name: string;
    code: string;
    city?: string | null;
    state?: string | null;
    students_count: number;
    families_count: number;
}

export interface RecentFamily {
    head_of_family: string;
    village?: string | null;
    members_count?: number | null;
    roll_number: string;
    created_at?: string | null;
}

export interface RecentFollowup {
    member_name: string;
    visit_number: number | string;
    health_progress?: string | null;
    roll_number: string;
    visit_date?: string | null;
}

export interface AdminStats {
    overview: {
        total_students: number;
        active_students: number;
        total_families: number;
        total_members: number;
        total_followups: number;
    };
    burden: { total_htn: number; total_dm: number; total_anaemia: number; total_malnutrition: number };
    colleges?: CollegeStat[];
    recent_families?: RecentFamily[];
    recent_followups?: RecentFollowup[];
}

export interface Cadet {
    id: number;
    roll_number: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    college_id?: number | null;
    college_name?: string | null;
    referral_code?: string | null;
    batch_year?: string | null;
    posting_unit?: string | null;
    status?: string | null;
    families_count: number;
    members_count: number;
    followups_count: number;
}

export interface Household {
    student_id: number;
    family_no: number;
    family_code?: string | null;
    head_of_family: string;
    village?: string | null;
    student_name: string;
    roll_number: string;
    college_name?: string | null;
    members_count?: number | null;
    calorie_status?: string | null;
    survey_date?: string | null;
    created_at?: string | null;
}

export interface CadetFamiliesResponse {
    student: { name: string; roll_number: string; college_name?: string | null };
    families: Household[];
}

export interface UniAdmin {
    id: number;
    username: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    status?: string | null;
    university_id: number;
    university_name?: string | null;
    created_at?: string | null;
}

export interface UniQuota {
    max_admins?: number;
    current_admins?: number;
    remaining_seats?: number;
}

export interface UniAdminsResponse {
    admins: UniAdmin[];
    quota?: UniQuota;
}

export interface Campaign {
    id: number;
    title: string;
    keyword: string;
    description?: string | null;
    event_date?: string | null;
    venue?: string | null;
    stats?: { total_targeted?: number; acknowledged?: number; cadet_contacted?: number };
}

export interface CampaignMatch {
    name?: string | null;
    cadet_name?: string | null;
    cadet_roll?: string | null;
    matched_label?: string | null;
    matched_condition_detail?: string | null;
}

export interface CampaignPreview {
    total_matching?: number;
    matches?: CampaignMatch[];
}

export interface RosterEntry {
    status?: string | null;
    patient_name?: string | null;
    patient_phone?: string | null;
    patient_response_note?: string | null;
    matched_keyword?: string | null;
    matched_condition_detail?: string | null;
    cadet_name?: string | null;
    cadet_roll?: string | null;
    cadet_call_status?: string | null;
}

/** Error body shape of failed API calls ({ error }). */
export interface ApiError {
    error?: string;
    message?: string;
}
