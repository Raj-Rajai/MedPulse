/**
 * The clinical survey form of entry.html as data: field ids, the member column each one is
 * filled from (selectMemberForSurvey), and how saveMemberSurvey() turned it back into the
 * PUT /api/members/:id body (same key order).
 */
import { selectValue, type Option } from '../common/Select';
import type { Member } from './types';

type Kind = 'sel' | 'float' | 'int' | 'text' | 'cu';

export const OPTIONS = {
    fPallor: [['N', 'No (N)'], ['Y', 'Yes (Y)'], ['NA', 'NA']],
    fAnaemia: [['N', 'No (Normal)'], ['Y', 'Yes (Anaemic)'], ['NA', 'NA']],
    fWorkType: [['S', 'S — Sedentary'], ['M', 'M — Moderate'], ['H', 'H — Heavy'], ['NA', 'NA / Child']],
    fTreatment: [['NA', 'NA'], ['Y', 'Yes (Y)'], ['N', 'No (N)']],
    fOralHygiene: [['Y', 'Satisfactory (Y)'], ['N', 'Unsatisfactory (N)']],
    fGeneralHygiene: [['Y', 'Satisfactory (Y)'], ['N', 'Unsatisfactory (N)']],
    fHtn: [['N', 'No (Normal BP)'], ['Y', 'Yes (Hypertensive)'], ['NA', 'NA']],
    fDm: [['N', 'No (Normal)'], ['Y', 'Yes (Diabetic ≥ 200)'], ['NA', 'NA']],
    fAnc: [['NA', 'Not Applicable (NA)'], ['Y', 'Yes (Y)'], ['N', 'No (N)']],
    fDelivery: [['NA', 'Not Applicable (NA)'], ['Hospital', 'Hospital (Institutional)'], ['Home', 'Home Delivery']],
    fPnc: [['NA', 'Not Applicable (NA)'], ['Y', 'Yes (Y)'], ['N', 'No (N)']],
    fFp: [['NA', 'Not Applicable (NA)'], ['Y', 'Yes (Y)'], ['N', 'No (N)']],
    fUnderweight: [['NA', 'NA'], ['N', 'No (Normal)'], ['Y', 'Yes (Underweight)']],
    fOverweight: [['NA', 'NA'], ['N', 'No (Normal)'], ['Y', 'Yes (Overweight)']],
    fStunting: [['NA', 'NA'], ['N', 'No'], ['Y', 'Yes (Low Height-for-Age)']],
    fWasting: [['NA', 'NA'], ['N', 'No'], ['Y', 'Yes (Low Weight-for-Height)']],
    fSevereWasting: [['NA', 'NA'], ['N', 'No'], ['Y', 'Yes (Severe Acute)']],
    fMamta: [['Y', 'Yes (Y)'], ['N', 'No (N)'], ['NA', 'NA']],
    fImmun: [['Y', 'Complete as per Age (Y)'], ['N', 'Incomplete / Delayed (N)'], ['NA', 'NA']],
} satisfies Record<string, readonly Option[]>;

export type SelectId = keyof typeof OPTIONS;

/** [element id, member column, kind, fallback used when the column is empty] in payload order. */
const FIELDS: readonly (readonly [string, string, Kind, string])[] = [
    ['fPallor', 'has_pallor', 'sel', 'N'],
    ['fHb', 'hb', 'float', ''],
    ['fAnaemia', 'has_anaemia', 'sel', 'N'],
    ['fHeight', 'height_m', 'float', ''],
    ['fWeight', 'weight_kg', 'float', ''],
    ['fWorkType', 'work_type', 'sel', 'M'],
    ['fCu', 'consumption_unit', 'cu', ''],
    ['fDiagnosis', 'diagnosis', 'text', ''],
    ['fTreatment', 'treatment_taken', 'sel', 'NA'],
    ['fTreatmentSource', 'treatment_source', 'text', ''],
    ['fOralHygiene', 'oral_hygiene', 'sel', 'Y'],
    ['fGeneralHygiene', 'general_hygiene', 'sel', 'Y'],
    ['fSbp', 'sbp', 'int', ''],
    ['fDbp', 'dbp', 'int', ''],
    ['fHtn', 'has_htn', 'sel', 'N'],
    ['fRbs', 'rbs', 'float', ''],
    ['fDm', 'has_dm', 'sel', 'N'],
    ['fWaist', 'waist_cm', 'float', ''],
    ['fHip', 'hip_cm', 'float', ''],
    ['fAnc', 'anc_taken', 'sel', 'NA'],
    ['fDelivery', 'delivery_place', 'sel', 'NA'],
    ['fPnc', 'pnc_taken', 'sel', 'NA'],
    ['fFp', 'fp_method_used', 'sel', 'NA'],
    ['fHc', 'hc_cm', 'float', ''],
    ['fCc', 'cc_cm', 'float', ''],
    ['fMuac', 'muac_cm', 'float', ''],
    ['fUnderweight', 'is_underweight', 'sel', 'NA'],
    ['fOverweight', 'is_overweight', 'sel', 'NA'],
    ['fStunting', 'is_stunting', 'sel', 'NA'],
    ['fWasting', 'is_wasting', 'sel', 'NA'],
    ['fSevereWasting', 'is_severe_wasting', 'sel', 'NA'],
    ['fMamta', 'mamta_card', 'sel', 'Y'],
    ['fImmun', 'immunization_status', 'sel', 'Y'],
];

export type SurveyForm = Record<string, string>;

/** The markup defaults (selected options / value attributes) before any member is loaded. */
export const INITIAL_FORM: SurveyForm = {
    ...Object.fromEntries(FIELDS.map(([id]) => [id, ''])),
    fPallor: 'N', fAnaemia: 'N', fWorkType: 'M', fCu: '1.0', fTreatment: 'Y', fOralHygiene: 'Y', fGeneralHygiene: 'Y',
    fHtn: 'N', fDm: 'N', fAnc: 'NA', fDelivery: 'NA', fPnc: 'NA', fFp: 'NA',
    fUnderweight: 'N', fOverweight: 'N', fStunting: 'N', fWasting: 'N', fSevereWasting: 'N', fMamta: 'Y', fImmun: 'Y',
};

/** selectMemberForSurvey(): `el.value = member.x || fallback`. */
export function formFromMember(m: Member): SurveyForm {
    const f: SurveyForm = {};
    for (const [id, key, kind, def] of FIELDS) {
        const v = m[key];
        if (kind === 'cu') f[id] = String(v || (m.gender === 'F' ? 0.9 : 1.2));
        else f[id] = String(v || def);
    }
    return f;
}

/** saveMemberSurvey() payload. */
export function payloadFromForm(f: SurveyForm): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {};
    for (const [id, key, kind] of FIELDS) {
        const v = f[id];
        if (kind === 'sel') out[key] = selectValue(OPTIONS[id as SelectId], v);
        else if (kind === 'float') out[key] = parseFloat(v) || null;
        else if (kind === 'int') out[key] = parseInt(v, 10) || null;
        else if (kind === 'cu') out[key] = parseFloat(v) || 1.0;
        else out[key] = v.trim() || null;
    }
    return out;
}

export type MuacStatus = 'initial' | 'sam' | 'mam' | 'normal';

/** checkMuacStatus(): returns the new status (null = unchanged) and the auto-set wasting selects. */
export function checkMuac(f: SurveyForm): { status: MuacStatus | null; f: SurveyForm } {
    const muac = parseFloat(f.fMuac || '0');
    if (!(muac > 0)) return { status: null, f };
    if (muac < 11.5) return { status: 'sam', f: { ...f, fSevereWasting: 'Y', fWasting: 'Y' } };
    if (muac <= 12.5) return { status: 'mam', f: { ...f, fWasting: 'Y' } };
    return { status: 'normal', f };
}

export interface Whr {
    whr: string;
    high: boolean;
}

/** recalcWHR(): null when waist or hip is missing. */
export function computeWhr(f: SurveyForm, isFemale: boolean): Whr | null {
    const waist = parseFloat(f.fWaist);
    const hip = parseFloat(f.fHip);
    if (!(waist > 0 && hip > 0)) return null;
    const whr = (waist / hip).toFixed(2);
    return { whr, high: Number(whr) > (isFemale ? 0.85 : 0.9) };
}

/** checkAdultVitals(): HTN / DM auto-classification. */
export function checkAdultVitals(f: SurveyForm): SurveyForm {
    const sbp = parseInt(f.fSbp || '0', 10);
    const dbp = parseInt(f.fDbp || '0', 10);
    const rbs = parseFloat(f.fRbs || '0');
    const out = { ...f };
    if (sbp >= 140 || dbp >= 90) out.fHtn = 'Y';
    else if (sbp > 0 && dbp > 0) out.fHtn = 'N';
    if (rbs >= 200) out.fDm = 'Y';
    else if (rbs > 0) out.fDm = 'N';
    return out;
}
