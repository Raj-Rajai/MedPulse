/** Helpers ported from patient.js. */
import { logoutPatient as sessionLogoutPatient } from '../../shared/session';

export const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export const digits = (p: unknown): string => String(p || '').replace(/\D/g, '');
export const firstName = (n: unknown): string => String(n || '').trim().split(/\s+/)[0] || 'there';
export const initials = (n: unknown): string => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const genderLabel = (g: string | null | undefined): string =>
    (({ M: 'Male', F: 'Female', Male: 'Male', Female: 'Female' } as Record<string, string>)[g || ''] || (g ? 'Other' : ''));
const AV_COLORS = ['#0284c7', '#7c3aed', '#db2777', '#059669', '#d97706', '#4f46e5', '#0d9488', '#b91c1c'];
export const avColor = (s: unknown): string => AV_COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

export function parseDay(s: string | null | undefined): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
export function daysUntil(s: string | null | undefined): number | null {
    const d = parseDay(s); if (!d) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - t.getTime()) / 86400000);
}
export const fmtDay = (s: string | null | undefined): string => {
    const d = parseDay(s);
    return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};
export function fmtWhen(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(String(ts).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? '' : 'Z'));
    if (isNaN(d.getTime())) return ts;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function relDay(n: number | null): string {
    if (n === null) return '';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n > 1) return `In ${n} days`;
    return `${-n} day${n === -1 ? '' : 's'} ago`;
}
export function isMobile(p: unknown): boolean {
    const d = digits(p);
    return (d.length === 10 && /^[6-9]/.test(d)) || (d.length === 12 && d.startsWith('91'));
}
export function waLink(phone: unknown, text?: string): string {
    let d = digits(phone); if (d.length === 10) d = '91' + d;
    return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const todayIso = (): string => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export function logoutPatient(): void {
    sessionLogoutPatient();
}

export interface ApiOptions { method?: string; body?: unknown }

/** fetch wrapper of patient.js: JSON body, 401 signs the patient out, `error` field becomes the thrown message. */
export async function api<T = Record<string, unknown>>(path: string, opts: ApiOptions = {}): Promise<T> {
    const res = await fetch(path, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 401) { logoutPatient(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error((data.error as string) || 'Something went wrong');
    return data as T;
}

