/**
 * Session storage for the four portals (same localStorage keys and validity checks as
 * the original frontend/shared/auth-guard.js, so existing browser sessions keep working).
 */
export interface StudentSession {
    id?: number;
    roll_number?: string;
    name?: string;
    batch_year?: string;
    [key: string]: unknown;
}
export interface AdminSession {
    id?: number;
    username?: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
}
export interface PatientSession {
    id?: number;
    patient_uid?: string;
    name?: string;
    model_type?: string;
    [key: string]: unknown;
}
export interface HospitalAdminSession {
    id?: number;
    username?: string;
    name?: string;
    role?: string;
    hospital_name?: string;
    [key: string]: unknown;
}

const KEYS = {
    user: 'medpulse_user',
    admin: 'medpulse_admin',
    patient: 'medpulse_patient',
    hospital: 'medpulse_hospital_admin',
} as const;

function read<T>(key: string, valid: (v: T) => boolean): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as T;
        return parsed && valid(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
function write(key: string, value: unknown): void {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
}

export const getUser = () => read<StudentSession>(KEYS.user, (p) => !!(p.id || p.roll_number));
export const getAdmin = () => read<AdminSession>(KEYS.admin, (p) => !!(p.id || p.username));
export const getPatient = () => read<PatientSession>(KEYS.patient, (p) => !!(p.id || p.patient_uid));
export const getHospitalAdmin = () => read<HospitalAdminSession>(KEYS.hospital, (p) => !!(p.id || p.username));

export const setUser = (v: StudentSession | null) => write(KEYS.user, v);
export const setAdmin = (v: AdminSession | null) => write(KEYS.admin, v);
export const setPatient = (v: PatientSession | null) => write(KEYS.patient, v);
export const setHospitalAdmin = (v: HospitalAdminSession | null) => write(KEYS.hospital, v);

export const clearUser = () => localStorage.removeItem(KEYS.user);
export const clearAdmin = () => localStorage.removeItem(KEYS.admin);
export const clearPatient = () => localStorage.removeItem(KEYS.patient);
export const clearHospitalAdmin = () => localStorage.removeItem(KEYS.hospital);

export function logout(): void {
    clearUser();
    window.location.replace('/login.html');
}
export function logoutAdmin(): void {
    clearAdmin();
    window.location.replace('/login.html?admin=1');
}
export function logoutPatient(): void {
    clearPatient();
    window.location.replace('/login.html?patient=1');
}
export function logoutHospitalAdmin(): void {
    clearHospitalAdmin();
    window.location.replace('/login.html?hospital=1');
}

/** The same object the original exposed as window.MedPulseAuth. */
export const MedPulseAuth = {
    getUser,
    setUser,
    logout,
    isAuthenticated: () => !!getUser(),
    getAdmin,
    setAdmin,
    logoutAdmin,
    isAdminAuthenticated: () => !!getAdmin(),
    getPatient,
    setPatient,
    logoutPatient,
    isPatientAuthenticated: () => !!getPatient(),
    getHospitalAdmin,
    setHospitalAdmin,
    logoutHospitalAdmin,
    isHospitalAdminAuthenticated: () => !!getHospitalAdmin(),
};
