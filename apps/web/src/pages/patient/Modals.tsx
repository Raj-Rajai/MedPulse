/** The five dialogs of patient.html: member, family address, survey link, RSVP note and confirm. */
import type { FormEvent, ReactNode, RefObject } from 'react';
import { useT } from './i18n';

function Overlay({ id, open, onClose, maxWidth, role = 'dialog', labelledBy, children }: {
    id: string; open: boolean; onClose: () => void; maxWidth: number; role?: string; labelledBy: string; children: ReactNode;
}) {
    return (
        <div id={id} className="modal-overlay" style={{ display: open ? 'flex' : 'none' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-content" style={{ maxWidth }} role={role} aria-modal="true" aria-labelledby={labelledBy}>
                {children}
            </div>
        </div>
    );
}

function CloseX({ onClose }: { onClose: () => void }) {
    const t = useT();
    return <button className="pt-x" onClick={onClose} aria-label={t('Close')}>✕</button>;
}

const prevent = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); fn(); };

/* ---------------- Add / edit family member ---------------- */
export interface MemberForm {
    name: string; rel: string; gender: string; dob: string; dobMax: string; age: string; phone: string; marital: string; occ: string; edu: string;
}
export const EMPTY_MEMBER: MemberForm = { name: '', rel: '', gender: '', dob: '', dobMax: '', age: '', phone: '', marital: 'Unknown', occ: '', edu: '' };

export function MemberModal({ open, title, form, setForm, relations, error, busy, nameRef, onClose, onSave }: {
    open: boolean; title: string; form: MemberForm; setForm: (p: Partial<MemberForm>) => void; relations: string[];
    error: string | null; busy: boolean; nameRef: RefObject<HTMLInputElement | null>; onClose: () => void; onSave: () => void;
}) {
    const t = useT();
    return (
        <Overlay id="memberModal" open={open} onClose={onClose} maxWidth={520} labelledBy="memberTitle">
            <div className="pt-modal-h"><h2 id="memberTitle">{t(title)}</h2><CloseX onClose={onClose} /></div>
            <form id="memberForm" noValidate onSubmit={prevent(onSave)}>
                <div className="pt-modal-body">
                    <div className="pt-form-row">
                        <label className="l" htmlFor="mfName">{t('Full name *')}</label>
                        <input id="mfName" ref={nameRef} className="pt-input" maxLength={80} required value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
                    </div>
                    <div className="pt-form-2 pt-form-row">
                        <div>
                            <label className="l" htmlFor="mfRel">{t('Relation to you *')}</label>
                            <select id="mfRel" className="pt-select" required value={form.rel} onChange={(e) => setForm({ rel: e.target.value })}>
                                <option value="">{t('Select')}</option>
                                {relations.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="l" htmlFor="mfGender">{t('Gender *')}</label>
                            <select id="mfGender" className="pt-select" required value={form.gender} onChange={(e) => setForm({ gender: e.target.value })}><option value="">{t('Select')}</option><option value="M">{t('Male')}</option><option value="F">{t('Female')}</option><option value="Other">{t('Other')}</option></select>
                        </div>
                    </div>
                    <div className="pt-form-2 pt-form-row">
                        <div>
                            <label className="l" htmlFor="mfDob">{t('Date of birth')}</label>
                            <input id="mfDob" type="date" className="pt-input" max={form.dobMax || undefined} value={form.dob} onChange={(e) => setForm({ dob: e.target.value })} />
                        </div>
                        <div>
                            <label className="l" htmlFor="mfAge">{t('…or age (years)')}</label>
                            <input id="mfAge" type="number" min="0" max="120" className="pt-input" placeholder={t('if DOB unknown')} value={form.age} onChange={(e) => setForm({ age: e.target.value })} />
                        </div>
                    </div>
                    <div className="pt-form-row">
                        <label className="l" htmlFor="mfPhone">{t('Mobile')}</label>
                        <input id="mfPhone" className="pt-input" inputMode="numeric" maxLength={10} placeholder={t('optional, 10 digits')} value={form.phone} onChange={(e) => setForm({ phone: e.target.value })} />
                    </div>
                    <div className="pt-form-2 pt-form-row">
                        <div>
                            <label className="l" htmlFor="mfMarital">{t('Marital status')}</label>
                            <select id="mfMarital" className="pt-select" value={form.marital} onChange={(e) => setForm({ marital: e.target.value })}>
                                {['Unknown', 'Single', 'Married', 'Widowed', 'Divorced'].map((o) => <option key={o} value={o}>{t(o)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="l" htmlFor="mfOcc">{t('Occupation')}</label>
                            <input id="mfOcc" className="pt-input" maxLength={60} placeholder={t('e.g. Farmer, Student')} value={form.occ} onChange={(e) => setForm({ occ: e.target.value })} />
                        </div>
                    </div>
                    <div className="pt-form-row">
                        <label className="l" htmlFor="mfEdu">{t('Education')}</label>
                        <input id="mfEdu" className="pt-input" maxLength={60} placeholder={t('e.g. Class 10, Graduate')} value={form.edu} onChange={(e) => setForm({ edu: e.target.value })} />
                    </div>
                    <div className="pt-note" style={{ marginBottom: 0 }}><span>ℹ</span><div>{t('Health readings (BP, sugar, weight) are added by the hospital or health survey team, not here.')}</div></div>
                    <div className="pt-err" id="mfErr" style={{ marginTop: 8, display: error === null ? 'none' : 'block' }}>{t(error ?? '')}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <button type="button" className="pt-btn" onClick={onClose}>{t('Cancel')}</button>
                    <button type="submit" className="pt-btn primary" id="mfSave" disabled={busy}>{busy ? t('Saving...') : t('Save')}</button>
                </div>
            </form>
        </Overlay>
    );
}

/* ---------------- Family address ---------------- */
export interface FamilyForm { name: string; addr: string; village: string; city: string; district: string; pin: string }

export function FamilyModal({ open, form, setForm, busy, onClose, onSave }: {
    open: boolean; form: FamilyForm; setForm: (p: Partial<FamilyForm>) => void; busy: boolean; onClose: () => void; onSave: () => void;
}) {
    const t = useT();
    const field = (id: string, label: string, key: keyof FamilyForm, extra: { maxLength: number; placeholder?: string; inputMode?: 'numeric' }) => (
        <><label className="l" htmlFor={id}>{t(label)}</label><input id={id} className="pt-input" maxLength={extra.maxLength} inputMode={extra.inputMode} placeholder={extra.placeholder ? t(extra.placeholder) : undefined} value={form[key]} onChange={(e) => setForm({ [key]: e.target.value })} /></>
    );
    return (
        <Overlay id="famModal" open={open} onClose={onClose} maxWidth={480} labelledBy="famTitle">
            <div className="pt-modal-h"><h2 id="famTitle">{t('🏠 Family details')}</h2><CloseX onClose={onClose} /></div>
            <form onSubmit={prevent(onSave)}>
                <div className="pt-form-row">{field('ffName', 'Family name', 'name', { maxLength: 80, placeholder: 'e.g. Patel Parivar' })}</div>
                <div className="pt-form-row">{field('ffAddr', 'House / street', 'addr', { maxLength: 300 })}</div>
                <div className="pt-form-2 pt-form-row">
                    <div>{field('ffVillage', 'Village / area', 'village', { maxLength: 80 })}</div>
                    <div>{field('ffCity', 'City', 'city', { maxLength: 80 })}</div>
                </div>
                <div className="pt-form-2 pt-form-row">
                    <div>{field('ffDistrict', 'District', 'district', { maxLength: 80 })}</div>
                    <div>{field('ffPin', 'PIN code', 'pin', { maxLength: 6, inputMode: 'numeric' })}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" className="pt-btn" onClick={onClose}>{t('Cancel')}</button>
                    <button type="submit" className="pt-btn primary" id="ffSave" disabled={busy}>{busy ? t('Saving...') : t('Save')}</button>
                </div>
            </form>
        </Overlay>
    );
}

/* ---------------- Link health survey ---------------- */
export type LinkFeedback =
    | { kind: 'hidden' }
    | { kind: 'ok'; name: string; roll: string; college: string }
    | { kind: 'error'; text: string };

const FEEDBACK_OK = { color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0' };
const FEEDBACK_ERR = { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' };

export function LinkModal({ open, code, setCode, feedback, busy, codeRef, onClose, onSubmit }: {
    open: boolean; code: string; setCode: (v: string) => void; feedback: LinkFeedback; busy: boolean;
    codeRef: RefObject<HTMLInputElement | null>; onClose: () => void; onSubmit: () => void;
}) {
    const t = useT();
    const tone = feedback.kind === 'ok' ? FEEDBACK_OK : feedback.kind === 'error' ? FEEDBACK_ERR : {};
    return (
        <Overlay id="linkModal" open={open} onClose={onClose} maxWidth={440} labelledBy="linkTitle">
            <div className="pt-modal-h"><h2 id="linkTitle">{t('🔗 Connect your health survey')}</h2><CloseX onClose={onClose} /></div>
            <p className="pt-sub" style={{ marginBottom: 12 }}>{t('If a medical student surveyed your family, enter the referral code they gave you (for example ')}<code>SAL-235-DA9B</code>{t('). Your survey health data will then show here.')}</p>
            <form onSubmit={prevent(onSubmit)}>
                <input id="linkCode" ref={codeRef} className="pt-input" required placeholder={t('SAL-235-XXXX')} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, textTransform: 'uppercase' }} />
                <div id="linkFeedback" style={{ fontSize: '0.8rem', marginTop: 8, display: feedback.kind === 'hidden' ? 'none' : 'block', padding: '6px 10px', borderRadius: 8, ...tone }}>
                    {feedback.kind === 'ok' ? <>{t('✔ ')}<strong>{t(feedback.name)}</strong>{t(` · Roll ${feedback.roll} · ${feedback.college}`)}</> : feedback.kind === 'error' ? t(feedback.text) : null}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button type="button" className="pt-btn" onClick={onClose}>{t('Cancel')}</button>
                    <button type="submit" className="pt-btn primary" id="linkSubmit" disabled={busy}>{busy ? t('Connecting…') : t('Connect')}</button>
                </div>
            </form>
        </Overlay>
    );
}

/* ---------------- RSVP note ---------------- */
export const QUICK_NOTES: Record<string, string[]> = {
    'Not Attending': ['Out of town', 'Not feeling well', 'Work that day', 'Already see a doctor'],
    'Need Help': ['No transport', 'Need someone to come with me', "Don't know the place", 'Timing problem'],
};

export function RsvpModal({ open, rsvp, quick, setQuick, note, setNote, onClose, onSubmit }: {
    open: boolean; rsvp: string | null; quick: string | null; setQuick: (v: string) => void; note: string; setNote: (v: string) => void;
    onClose: () => void; onSubmit: () => void;
}) {
    const t = useT();
    const title = rsvp === null ? 'Reply' : rsvp === 'Need Help' ? '🙋 What help do you need?' : "❌ Can't attend";
    const help = rsvp === null ? '' : rsvp === 'Need Help' ? 'The camp team will call you to help you attend.' : 'Let the camp team know why (optional).';
    return (
        <Overlay id="rsvpModal" open={open} onClose={onClose} maxWidth={440} labelledBy="rsvpTitle">
            <div className="pt-modal-h"><h2 id="rsvpTitle">{t(title)}</h2><CloseX onClose={onClose} /></div>
            <p className="pt-sub" id="rsvpHelp" style={{ marginBottom: 10 }}>{t(help)}</p>
            <form onSubmit={prevent(onSubmit)}>
                <div className="pt-seg" id="rsvpQuick" style={{ marginBottom: 10 }}>
                    {(rsvp ? QUICK_NOTES[rsvp] || [] : []).map((q) => (
                        <label key={q}><input type="radio" name="rsvpQuick" value={q} checked={quick === q} onChange={() => setQuick(q)} /><span>{t(q)}</span></label>
                    ))}
                </div>
                <textarea id="rsvpNote" className="pt-textarea" maxLength={500} placeholder={t('Anything else? (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <button type="button" className="pt-btn" onClick={onClose}>{t('Cancel')}</button>
                    <button type="submit" className="pt-btn primary">{t('Send')}</button>
                </div>
            </form>
        </Overlay>
    );
}

/* ---------------- Confirm (replaces window.confirm) ---------------- */
export interface ConfirmState { title: string; text: string; ok: string }

export function ConfirmModal({ open, state, onCancel, onOk }: { open: boolean; state: ConfirmState; onCancel: () => void; onOk: () => void }) {
    const t = useT();
    return (
        <Overlay id="confirmModal" open={open} onClose={onCancel} maxWidth={400} role="alertdialog" labelledBy="confirmTitle">
            <div className="pt-modal-h"><h2 id="confirmTitle">{t(state.title)}</h2></div>
            <p className="pt-sub" id="confirmText" style={{ marginBottom: 16 }}>{t(state.text)}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="pt-btn" onClick={onCancel}>{t('Cancel')}</button>
                <button type="button" className="pt-btn ghost-danger" id="confirmOk" onClick={onOk}>{t(state.ok)}</button>
            </div>
        </Overlay>
    );
}
