/** API client, payload types and small formatting helpers ported from hospital-ui.js. */

export type Val = string | number | null | undefined;

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const fetchOpts: RequestInit = {};
    if (options.method) fetchOpts.method = options.method;
    if (options.body && typeof options.body === 'object') {
        fetchOpts.headers = { 'Content-Type': 'application/json' };
        fetchOpts.body = JSON.stringify(options.body);
    }
    const response = await fetch('/api/hospital/' + path, fetchOpts);
    const data = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? 'Your hospital session expired. Please sign in again.' : (data.error || 'Could not complete request.'));
    return data as T;
}

export const errorMessage = (e: unknown): string => (e as Error)?.message;

export const labels: Record<string, string> = { HTN: 'Hypertension', DM: 'Diabetes', Anaemia: 'Anaemia', Pediatric: 'Children aged 0–5', NoFollowUp: 'No follow-up recorded' };

/** `shown()` without the HTML escaping (React escapes text). */
export const shown = (v: Val): string => (v === null || v === undefined || v === '' ? 'Not recorded' : String(v));

export function getInitials(name: Val): string {
    if (!name) return 'PT';
    const parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export const genderClass = (g: Val) => (g === 'F' ? 'gender-f' : (g === 'M' ? 'gender-m' : 'gender-other'));
export const genderLabel = (g: Val) => (g === 'F' ? 'Female' : (g === 'M' ? 'Male' : shown(g)));

export interface Profile { admin: { hospital_name: string; name: string; role: string } }

export interface FapPatient {
    id: number; name: string | null; age_years: Val; age_months: Val; gender: Val; contact_number: Val;
    has_htn: Val; has_dm: Val; has_anaemia: Val; sbp: Val; dbp: Val; rbs: Val; hb: Val;
    family_id: Val; family_code: Val; head_of_family: Val; village: Val;
    student_name: Val; student_roll: Val; university_name: Val; conditions_summary: string | null;
    follow_up_count: Val; last_visit: Val;
}
export interface FapList { patients: FapPatient[]; total: number; offset: number; limit: number }

export interface FapSummary {
    totals: { patients: number; families: number; students: number; follow_ups: number };
    conditions: { key: string; count: number }[];
    universities: { id: number; name: Val; patient_count: number }[];
}
export interface FapStudent { id: number; name: string; roll_number: string; college_id: number | null }
export interface FapOptions { students: FapStudent[]; universities: { id: number; name: string }[] }

export type Row = Record<string, Val>;
export interface FapDossier {
    member: FapPatient & { student_name: string; student_roll: string };
    vitals: Row; family: Row;
    conditions: Row[]; medications: Row[]; allergies: Row[]; history: Row[]; follow_ups: Row[];
    lifestyle: Row | null;
}

export interface Visit {
    id: number; visit_uid: string; patient_name: Val; gender: Val; age_years: Val; contact_number: Val;
    department: Val; visit_date: Val; attending_doctor: Val; chief_complaint: Val; diagnosis: Val; symptoms_duration: Val;
    sbp: Val; dbp: Val; pulse: Val; temperature: Val; rbs: Val;
    family_code: Val; village: Val; address: Val; student_name: Val; student_roll: Val;
    disposition: string | null; ward_bed_no: Val; existing_conditions: Val; allergies: Val;
    treatment_prescribed: Val; follow_up_advice: Val; registered_by_name: Val;
}
export interface VisitList { visits: Visit[]; total: number; offset: number; limit: number }
export interface VisitSummary { total_registered: number; today_visits: number; admitted_patients: number; opd_discharged: number }
