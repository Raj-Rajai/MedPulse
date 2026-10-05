/**
 * Route guard + API auth headers, ported from frontend/shared/auth-guard.js.
 * Call `installAuthGuard()` first thing in every page entry. It returns false when the
 * page is redirecting to a login screen (the caller must not render).
 */
import {
    getAdmin, getHospitalAdmin, getPatient, getUser,
    logout, logoutAdmin, logoutHospitalAdmin, logoutPatient, MedPulseAuth,
} from './session';

const PUBLIC_PATHS = ['/login.html', '/register.html'];

function normalizePath(pathname: string): string {
    if (!pathname || pathname === '/') return '/index.html';
    const clean = pathname.split('?')[0].split('#')[0];
    if (clean === '' || clean === '/') return '/index.html';
    return clean;
}

export interface PageKind {
    path: string;
    isPublicPage: boolean;
    isAdminPage: boolean;
    isPatientPage: boolean;
    isHospitalPage: boolean;
}

export function pageKind(pathname = window.location.pathname): PageKind {
    const p = normalizePath(pathname);
    return {
        path: p,
        isPublicPage: PUBLIC_PATHS.includes(p) || p === '/login' || p === '/register',
        isAdminPage: p === '/admin.html' || p === '/admin' || p === '/admin/' || p.startsWith('/admin/'),
        isPatientPage: p === '/patient.html' || p === '/patient' || p === '/patient/' || p.startsWith('/patient/'),
        isHospitalPage: p === '/hospital.html' || p === '/hospital' || p === '/hospital/' || p.startsWith('/hospital/'),
    };
}

function block(redirect: string): false {
    const style = document.createElement('style');
    style.id = 'medpulse-auth-block';
    style.textContent = 'html, body { display: none !important; visibility: hidden !important; opacity: 0 !important; }';
    (document.head || document.documentElement).appendChild(style);
    window.location.replace(redirect);
    return false;
}

let installed = false;

export function installAuthGuard(): boolean {
    const kind = pageKind();
    const { isPublicPage, isAdminPage, isPatientPage, isHospitalPage } = kind;
    const here = encodeURIComponent(window.location.pathname + window.location.search);
    const user = getUser();
    const admin = getAdmin();
    const patient = getPatient();
    const hospitalAdmin = getHospitalAdmin();

    // 1. Route protection
    if (isAdminPage && !admin) return block('/login.html?admin=1&redirect=' + here);
    if (isPatientPage && !patient && !admin) return block('/login.html?patient=1&redirect=' + here);
    if (isHospitalPage && !hospitalAdmin && !admin) return block('/login.html?hospital=1&redirect=' + here);
    if (!isPublicPage && !isAdminPage && !isPatientPage && !isHospitalPage && !user && !admin) {
        return block('/login.html?redirect=' + here);
    }

    if (installed) return true;
    installed = true;

    // 2. Globals the original pages exposed (kept for any inline handler or bookmarklet that uses them)
    Object.assign(window as unknown as Record<string, unknown>, {
        MedPulseAuth,
        getMedPulseUser: getUser,
        logoutUser: logout,
        logoutAdmin,
        getMedPulsePatient: getPatient,
        logoutPatient,
        getMedPulseHospitalAdmin: getHospitalAdmin,
        logoutHospitalAdmin,
    });

    // 3. Inject auth headers into every API call
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
        init = init || {};
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
        const activeUser = getUser();
        const activeAdmin = getAdmin();
        const activePatient = getPatient();
        const activeHospitalAdmin = getHospitalAdmin();
        const headers = new Headers(init.headers instanceof Headers || Array.isArray(init.headers) ? init.headers : { ...(init.headers as Record<string, string>) });

        if (activeAdmin && (url.includes('/api/admin/') || isAdminPage)) {
            if (!headers.has('X-Admin-Id') && activeAdmin.id) headers.set('X-Admin-Id', String(activeAdmin.id));
            if (!headers.has('X-Admin-Token')) headers.set('X-Admin-Token', 'admin-' + activeAdmin.id);
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer admin-' + activeAdmin.id);
            init.headers = headers;
        } else if (activeHospitalAdmin && (url.includes('/api/hospital/') || isHospitalPage)) {
            if (!headers.has('X-Hospital-Admin-Id') && activeHospitalAdmin.id) headers.set('X-Hospital-Admin-Id', String(activeHospitalAdmin.id));
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer hosp-' + activeHospitalAdmin.id);
            init.headers = headers;
        } else if (activePatient && (url.includes('/api/patient/') || isPatientPage)) {
            if (!headers.has('X-Patient-Id') && activePatient.id) headers.set('X-Patient-Id', String(activePatient.id));
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer patient-' + activePatient.id);
            init.headers = headers;
        } else if (activeUser && url.includes('/api/')) {
            if (!headers.has('X-Student-Id') && activeUser.id) headers.set('X-Student-Id', String(activeUser.id));
            if (!headers.has('X-Roll-Number') && activeUser.roll_number) headers.set('X-Roll-Number', String(activeUser.roll_number));
            init.headers = headers;
        }

        return originalFetch(input, init).then((response) => {
            if (response.status === 401 && (url.includes('/api/admin/') || isAdminPage) && !url.includes('/api/admin/login')) {
                console.warn('[MedPulse Auth] Admin session expired or invalid. Redirecting to admin login.');
                localStorage.removeItem('medpulse_admin');
                if (isAdminPage) window.location.replace('/login.html?admin=1&session_expired=1');
            } else if (response.status === 401 && (url.includes('/api/hospital/') || isHospitalPage) && !url.includes('/api/hospital/login')) {
                console.warn('[MedPulse Auth] Hospital session expired. Redirecting to hospital login.');
                localStorage.removeItem('medpulse_hospital_admin');
                window.location.replace('/login.html?hospital=1&session_expired=1');
            } else if (
                response.status === 401 && (url.includes('/api/patient/') || isPatientPage) &&
                !url.includes('/api/patient/login') && !url.includes('/api/patient/register')
            ) {
                console.warn('[MedPulse Auth] Patient session expired. Redirecting to patient login.');
                localStorage.removeItem('medpulse_patient');
                window.location.replace('/login.html?patient=1&session_expired=1');
            } else if (
                response.status === 401 && !isPublicPage && !isAdminPage && !isPatientPage && !isHospitalPage &&
                !url.includes('/api/auth/login') && !url.includes('/api/auth/register')
            ) {
                console.warn('[MedPulse Auth] Session invalidated or unauthorized. Redirecting to login.');
                localStorage.removeItem('medpulse_user');
                window.location.replace('/login.html?session_expired=1');
            }
            return response;
        });
    };

    // 4. Friendly errors when an API call returns an HTML page instead of JSON
    const nativeJson = Response.prototype.json;
    Response.prototype.json = async function (this: Response) {
        try {
            return await nativeJson.call(this);
        } catch (err) {
            const e = err as Error;
            if (e && e.name === 'SyntaxError' && (e.message.includes('Unexpected token') || e.message.includes('is not valid JSON'))) {
                const status = this.status;
                if (status === 404) throw new Error('API endpoint not found (HTTP 404). If you just added new routes or features, please restart your server process.');
                if (status >= 500) throw new Error('Server error (HTTP ' + status + '). The server returned an HTML error page instead of JSON.');
                throw new Error('Server returned an unexpected HTML page instead of JSON (HTTP ' + status + ' ' + (this.statusText || '') + '). Please restart your server process.');
            }
            throw err;
        }
    };

    return true;
}
