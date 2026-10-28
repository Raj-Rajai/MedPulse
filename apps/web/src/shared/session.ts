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
export function storeSessionPreview(key: string, value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const allowed = ['id', 'name', 'roll_number', 'patient_uid', 'username', 'role', 'hospital_id', 'hospital_name', 'college_id', 'college_name', 'batch_year', 'posting_unit', 'status', 'department'];
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(value).filter(([field]) => allowed.includes(field)))));
}
function write(key: string, value: unknown): void {
    if (value) storeSessionPreview(key, value);
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

async function endSession(role: string, redirect: string): Promise<void> {
    try { await fetch(`/api/session/${role}/logout`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' }); }
    finally { window.location.replace(redirect); }
}

export function logout(): void {
    clearUser();
    void endSession('student', '/login.html');
}
export function logoutAdmin(): void {
    clearAdmin();
    void endSession('admin', '/login.html?admin=1');
}
export function logoutPatient(): void {
    clearPatient();
    void endSession('patient', '/login.html?patient=1');
}
export function logoutHospitalAdmin(): void {
    clearHospitalAdmin();
    void endSession('hospital', '/login.html?hospital=1');
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
