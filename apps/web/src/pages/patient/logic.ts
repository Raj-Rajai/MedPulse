/** Derived data of the patient portal (pure functions from patient.js). */
import type { CampNotification, FamilyMember, HospitalRequest, PatientCard, PortalState } from './types';
import { daysUntil, fmtDay } from './util';

export function cardCompleteness(c: PatientCard): { pct: number; missing: string[] } {
    const items: [string, boolean][] = [
        ['Date of birth', !!c.date_of_birth], ['Blood group', !!c.blood_group && c.blood_group !== 'Unknown'],
        ['Address', !!(c.address || c.family_address)], ['Emergency contact', !!(c.emergency_contact_name && c.emergency_contact_phone)],
    ];
    const missing = items.filter((i) => !i[1]).map((i) => i[0]);
    return { pct: Math.round(((items.length - missing.length) / items.length) * 100), missing };
}

export function ageText(m: FamilyMember): string {
    if ((m.age_years ?? 0) > 0) return `${m.age_years} yrs`;
    if ((m.age_months ?? 0) > 0) return `${m.age_months} mo`;
    return m.date_of_birth ? 'Under 1 yr' : 'Age not set';
}

/* ---- Hospital requests ---- */
export const REQ_PILL: Record<string, string> = { Open: 'warn', Acknowledged: 'info', Scheduled: 'info', Resolved: 'ok', Cancelled: 'mute' };
export const REQ_LABEL: Record<string, string> = { Open: 'Sent', Acknowledged: 'Seen by hospital', Scheduled: 'Appointment set', Resolved: 'Done', Cancelled: 'Cancelled' };
export const OPEN_STATUSES = ['Open', 'Acknowledged', 'Scheduled'];
export const needsRequestConfirm = (r: HospitalRequest): boolean => r.status === 'Resolved' && !r.patient_confirmation;

/* ---- Campaigns ---- */
export type Rsvp = 'Attending' | 'Not Attending' | 'Need Help' | 'Pending';
export const RSVP_LABEL: Record<string, string> = { 'Attending': '✅ Attending', 'Not Attending': "❌ Can't attend", 'Need Help': '🙋 Asked for help', 'Pending': '⏳ Reply needed' };
export const RSVP_PILL: Record<string, string> = { 'Attending': 'ok', 'Not Attending': 'bad', 'Need Help': 'warn', 'Pending': 'info' };
export function rsvpOf(n: CampNotification): string {
    if (n.rsvp && n.rsvp !== 'Pending') return n.rsvp;
    if (n.notification_status === 'Acknowledged') return 'Attending';
    if (n.notification_status === 'Declined') return 'Not Attending';
    return 'Pending';
}
export const isPast = (n: CampNotification): boolean => {
    const d = daysUntil(n.event_date);
    return (d !== null && d < 0) || n.campaign_status === 'Completed' || n.campaign_status === 'Cancelled';
};
export const needsContactConfirm = (n: CampNotification): boolean =>
    !!(n.contacted_at || ['Contacted', 'Assisted'].includes(n.cadet_call_status || '')) && !n.patient_contact_confirmation;

export function splitCamps(notifs: CampNotification[]): { up: CampNotification[]; past: CampNotification[] } {
    const up = notifs.filter((n) => !isPast(n)).sort((a, b) => (daysUntil(a.event_date) ?? 999) - (daysUntil(b.event_date) ?? 999));
    return { up, past: notifs.filter(isPast) };
}
export const pendingCampCount = (up: CampNotification[]): number =>
    up.filter((n) => rsvpOf(n) === 'Pending').length + up.filter(needsContactConfirm).length;

/* ---- Vitals (plain language) ---- */
export interface VitalCard { lvl: '' | 'ok' | 'warn' | 'bad'; lbl: string; val: string | number; unit: string; tag: string; hint: string }

export function latestVitals(s: PortalState) {
    const r = s.records || {};
    const m = (r.member || {}) as Record<string, unknown>;
    const fu = ((r.follow_ups || [])[0] || {}) as Record<string, unknown>;
    const pick = (k: string) => ((fu[k] !== null && fu[k] !== undefined && fu[k] !== '') ? fu[k] : (m[k] || null)) as number | null;
    return { sbp: pick('sbp'), dbp: pick('dbp'), rbs: pick('rbs'), hb: pick('hb'), bmi: (m.bmi || null) as number | string | null, date: (fu.visit_date || null) as string | null };
}

export function vitalCards(s: PortalState): { source: string; cards: VitalCard[] } {
    const v = latestVitals(s);
    const source = v.date ? `From your check-up on ${fmtDay(v.date)}.` : 'From your family health survey.';
    const cards: VitalCard[] = [];
    if (v.sbp && v.dbp) {
        const lvl = (v.sbp >= 140 || v.dbp >= 90) ? 'bad' : (v.sbp >= 130 || v.dbp >= 80) ? 'warn' : 'ok';
        cards.push({ lvl, lbl: 'Blood pressure', val: `${v.sbp}/${v.dbp}`, unit: 'mmHg', tag: { bad: 'High', warn: 'Slightly high', ok: 'Normal' }[lvl],
            hint: { bad: 'Higher than it should be. Take your medicines daily and talk to your doctor.', warn: 'A little above normal. Less salt and daily walking help.', ok: 'Good. Keep it up.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Blood pressure', val: '—', unit: '', tag: 'Not checked', hint: 'Get it checked at your next visit.' });
    if (v.rbs) {
        const lvl = v.rbs >= 200 ? 'bad' : v.rbs >= 140 ? 'warn' : 'ok';
        cards.push({ lvl, lbl: 'Blood sugar', val: v.rbs, unit: 'mg/dL', tag: { bad: 'High', warn: 'Borderline', ok: 'Normal' }[lvl],
            hint: { bad: 'High sugar. Please see a doctor and avoid sweets and sugary drinks.', warn: 'Slightly high. Cut down on sweets and white rice.', ok: 'In the normal range.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Blood sugar', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    if (v.hb) {
        const lvl = v.hb < 8 ? 'bad' : v.hb < 11 ? 'warn' : 'ok';
        cards.push({ lvl, lbl: 'Haemoglobin', val: v.hb, unit: 'g/dL', tag: { bad: 'Very low', warn: 'Low', ok: 'Good' }[lvl],
            hint: { bad: 'Very low blood. Please see a doctor soon.', warn: 'Low blood (anaemia). Eat green leafy vegetables, jaggery and dal; take iron tablets if prescribed.', ok: 'Healthy level.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Haemoglobin', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    if (v.bmi) {
        const b = Number(v.bmi); const lvl = (b >= 30 || b < 16) ? 'bad' : (b >= 25 || b < 18.5) ? 'warn' : 'ok';
        const tag = b >= 30 ? 'Obese' : b >= 25 ? 'Overweight' : b < 18.5 ? 'Underweight' : 'Healthy';
        cards.push({ lvl, lbl: 'Body weight (BMI)', val: b.toFixed(1), unit: '', tag,
            hint: b >= 25 ? 'Above healthy weight. Walk 30 minutes a day and eat less oily food.' : b < 18.5 ? 'Below healthy weight. Eat regular, nutritious meals.' : 'Healthy weight for your height.' });
    } else cards.push({ lvl: '', lbl: 'Body weight (BMI)', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    return { source, cards };
}
export const VITAL_PILL: Record<string, string> = { ok: 'ok', warn: 'warn', bad: 'bad', '': 'mute' };
