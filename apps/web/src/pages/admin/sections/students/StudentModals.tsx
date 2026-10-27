/** Cadet modals: register, edit, reset PIN, inspect households. */
import { useLayoutEffect, useRef, useState } from 'react';
import { MessageRow, ModalOverlay, closeBtnStyle, modalFootStyle, modalHeadStyle, twoColStyle } from '../../components/ModalOverlay';
import type { ModalState } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToasts';
import { datePart, errMessage, readJson, sendJson } from '../../lib/http';
import { batchYearFor, isCurrent, STUDY_YEARS, studyYearOf } from '../../lib/academic';
import type { AcademicYear, Cadet, CadetFamiliesResponse, CollegeStat, Household } from '../../types';

const firstId = (opts: CollegeStat[] | null) => (opts && opts.length ? String(opts[0].id) : '');
const currentYearId = (years: AcademicYear[] | null) => {
    const y = (years || []).find(isCurrent) || (years || [])[0];
    return y ? String(y.id) : '';
};

/** Academic year and study year pickers shared by the register and edit forms. */
function YearFields({ idPrefix, years, yearId, onYear, study, onStudy, studyValue }: {
    idPrefix: string;
    years: AcademicYear[] | null;
    yearId: string;
    onYear: (v: string) => void;
    study: string;
    onStudy: (v: string) => void;
    /** The student's stored batch text, offered when it does not map to a known study year. */
    studyValue?: string;
}) {
    const known = STUDY_YEARS.some((s) => s.label === study);
    return (
        <div style={twoColStyle}>
            <div className="form-group">
                <label htmlFor={`${idPrefix}Year`}>Academic Year</label>
                <select id={`${idPrefix}Year`} value={yearId} onChange={(e) => onYear(e.target.value)}>
                    <option value="">Unassigned</option>
                    {(years || []).map((y) => <option key={y.id} value={String(y.id)}>{y.label}{isCurrent(y) ? ' (current)' : ''}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor={`${idPrefix}Study`}>Study Year</label>
                <select id={`${idPrefix}Study`} value={study} onChange={(e) => onStudy(e.target.value)}>
                    {!known && <option value={study}>{studyValue || study}</option>}
                    {STUDY_YEARS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
            </div>
        </div>
    );
}

/* ---------------- Register cadet ---------------- */
const ADD_DEFAULTS = { roll: '', pin: '1234', name: '', email: '', phone: '', study: 'Third Year', posting: 'RHTC - Rural Health Training Center' };

export function AddStudentModal({ modal, collegeOptions, years, onSaved }: { modal: ModalState<true>; collegeOptions: CollegeStat[] | null; years: AcademicYear[] | null; onSaved: () => void }) {
    const showToast = useToast();
    const [f, setF] = useState(ADD_DEFAULTS);
    const [yearId, setYearId] = useState('');
    const [college, setCollege] = useState('');
    const [busy, setBusy] = useState(false);
    const rollRef = useRef<HTMLInputElement>(null);

    // Replacing the select's options selects the first one again.
    useLayoutEffect(() => setCollege(firstId(collegeOptions)), [collegeOptions]);
    useLayoutEffect(() => {
        if (!modal.nonce) return;
        setF(ADD_DEFAULTS); // form.reset()
        setCollege(firstId(collegeOptions));
        setYearId(currentYearId(years));
        rollRef.current?.focus();
    }, [modal.nonce]);

    const set = (k: keyof typeof ADD_DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                roll_number: f.roll.trim(),
                name: f.name.trim(),
                pin: f.pin.trim(),
                email: f.email.trim() || null,
                phone: f.phone.trim() || null,
                college_id: college,
                batch_year: batchYearFor(f.study),
                academic_year_id: yearId || null,
                posting_unit: f.posting.trim() || 'RHTC - Rural Health Training Center',
                status: 'Active',
            };
            const res = await sendJson('/api/admin/students', 'POST', payload);
            const data = await readJson<{ student: Cadet }>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to register student');
            showToast(`Cadet ${data.student.name} (Enrollment No. ${data.student.roll_number}) registered successfully!`, 'success');
            modal.hide();
            onSaved();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="addStudentModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 520 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>➕ Register Medical Cadet</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="addStudentForm" onSubmit={submit}>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="asRoll">Enrollment No. *</label>
                            <input type="text" id="asRoll" ref={rollRef} required placeholder="Unique code, e.g. 2024MBBS0237" value={f.roll} onChange={set('roll')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="asPin">Initial PIN *</label>
                            <input type="password" id="asPin" required minLength={4} value={f.pin} onChange={set('pin')} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="asName">Cadet Full Name *</label>
                        <input type="text" id="asName" required placeholder="e.g. Dr. Pooja Patel" value={f.name} onChange={set('name')} />
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="asEmail">Institutional Email</label>
                            <input type="email" id="asEmail" placeholder="pooja.patel@medpulse.edu" value={f.email} onChange={set('email')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="asPhone">Contact Phone</label>
                            <input type="tel" id="asPhone" placeholder="10-digit phone" value={f.phone} onChange={set('phone')} />
                        </div>
                    </div>
                    {/* No institution picker: the student is filed under the first (default) college. */}
                    <YearFields idPrefix="as" years={years} yearId={yearId} onYear={setYearId} study={f.study} onStudy={(v) => setF({ ...f, study: v })} />
                    <div className="form-group">
                        <label htmlFor="asPostingUnit">Posting Unit</label>
                        <input type="text" id="asPostingUnit" value={f.posting} onChange={set('posting')} />
                    </div>
                </div>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="addStudentSubmitBtn" disabled={busy}>{busy ? 'Registering...' : '💾 Register Cadet'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Edit cadet ---------------- */
export function EditStudentModal({ modal, collegeOptions, years, onSaved }: { modal: ModalState<Cadet>; collegeOptions: CollegeStat[] | null; years: AcademicYear[] | null; onSaved: () => void }) {
    const showToast = useToast();
    const [f, setF] = useState({ id: '', roll: '', name: '', email: '', phone: '', college: '', status: 'Active', posting: '', yearId: '', study: '', batch: '' });
    const [busy, setBusy] = useState(false);

    useLayoutEffect(() => setF((prev) => ({ ...prev, college: firstId(collegeOptions) })), [collegeOptions]);
    useLayoutEffect(() => {
        const s = modal.data;
        if (!modal.nonce || !s) return;
        setF({
            id: String(s.id), roll: s.roll_number, name: s.name, email: s.email || '', phone: s.phone || '',
            college: String(s.college_id || 1), status: s.status || 'Active', posting: s.posting_unit || '',
            yearId: s.academic_year_id ? String(s.academic_year_id) : '', study: studyYearOf(s.batch_year), batch: s.batch_year || '',
        });
    }, [modal.nonce, modal.data]);

    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                name: f.name.trim(),
                email: f.email.trim() || null,
                phone: f.phone.trim() || null,
                college_id: f.college,
                status: f.status,
                posting_unit: f.posting.trim(),
                academic_year_id: f.yearId || null,
                batch_year: batchYearFor(f.study, f.batch) || undefined,
            };
            const res = await sendJson(`/api/admin/students/${f.id}`, 'PUT', payload);
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to update student');
            showToast('Cadet record updated successfully!', 'success');
            modal.hide();
            onSaved();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="editStudentModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 520 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>✏ Edit Medical Cadet</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="editStudentForm" onSubmit={submit}>
                <input type="hidden" id="esId" value={f.id} />
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                        <label>Enrollment No. (permanent)</label>
                        <input type="text" id="esRoll" readOnly style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700 }} value={f.roll} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="esName">Cadet Full Name *</label>
                        <input type="text" id="esName" required value={f.name} onChange={set('name')} />
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="esEmail">Email Address</label>
                            <input type="email" id="esEmail" value={f.email} onChange={set('email')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="esPhone">Phone Number</label>
                            <input type="tel" id="esPhone" value={f.phone} onChange={set('phone')} />
                        </div>
                    </div>
                    <YearFields idPrefix="es" years={years} yearId={f.yearId} onYear={(v) => setF({ ...f, yearId: v })} study={f.study} onStudy={(v) => setF({ ...f, study: v })} studyValue={f.batch} />
                    <div className="form-group">
                        <label htmlFor="esStatus">Status</label>
                        <select id="esStatus" value={f.status} onChange={set('status')}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="esPostingUnit">Posting Unit</label>
                        <input type="text" id="esPostingUnit" value={f.posting} onChange={set('posting')} />
                    </div>
                </div>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="editStudentSubmitBtn" disabled={busy}>{busy ? 'Saving...' : '💾 Save Changes'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Reset cadet PIN ---------------- */
export function ResetPinModal({ modal }: { modal: ModalState<Cadet> }) {
    const showToast = useToast();
    const [pin, setPin] = useState('1234');
    const [prompt, setPrompt] = useState('Reset student access passcode.');
    const [studentId, setStudentId] = useState('');
    const [busy, setBusy] = useState(false);

    useLayoutEffect(() => {
        const s = modal.data;
        if (!modal.nonce || !s) return;
        setStudentId(String(s.id));
        setPin('1234');
        setPrompt(`Reset access PIN for Cadet ${s.name || ''} (Enrollment No. ${s.roll_number || ''}):`);
    }, [modal.nonce, modal.data]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await sendJson(`/api/admin/students/${studentId}/reset-pin`, 'POST', { new_pin: pin.trim() });
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to reset PIN');
            showToast(data.message || 'PIN updated!', 'success');
            modal.hide();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="resetPinModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 400 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>🔒 Reset Cadet PIN</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }} id="resetPinPromptText">{prompt}</p>
            <form id="resetPinForm" onSubmit={submit}>
                <input type="hidden" id="rpStudentId" value={studentId} />
                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label htmlFor="rpNewPin">New 4-Digit PIN *</label>
                    <input type="password" id="rpNewPin" required minLength={4} maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="resetPinSubmitBtn" disabled={busy}>{busy ? 'Updating...' : '🔑 Set PIN'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Inspect cadet households ---------------- */
type InspectState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; families: Household[] };

export function InspectCadetModal({ modal }: { modal: ModalState<number> }) {
    const [title, setTitle] = useState('Cadet Field Households');
    const [sub, setSub] = useState('Assigned Survey Roster');
    const [body, setBody] = useState<InspectState>({ kind: 'loading' });

    useLayoutEffect(() => {
        const studentId = modal.data;
        if (!modal.nonce || studentId === null) return;
        let live = true;
        setBody({ kind: 'loading' });
        (async () => {
            try {
                const res = await fetch(`/api/admin/students/${studentId}/families`);
                if (!res.ok) throw new Error('Failed to load cadet families');
                const data = (await res.json()) as CadetFamiliesResponse;
                if (!live) return;
                setTitle(`${data.student.name} (Enrollment No. ${data.student.roll_number})`);
                setSub(`${data.families.length} assigned households`);
                setBody({ kind: 'data', families: data.families || [] });
            } catch (err) {
                if (live) setBody({ kind: 'error', message: errMessage(err) });
            }
        })();
        return () => { live = false; };
    }, [modal.nonce, modal.data]);

    return (
        <ModalOverlay id="inspectCadetModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 680 }}>
            <div style={{ ...modalHeadStyle, marginBottom: '1rem' }}>
                <div>
                    <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem', marginBottom: 2 }} id="inspectCadetTitle">{title}</h2>
                    <span id="inspectCadetSub" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub}</span>
                </div>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Fam No.</th>
                            <th>Head of Family</th>
                            <th>Village</th>
                            <th style={{ textAlign: 'center' }}>Members</th>
                            <th>Survey Date</th>
                        </tr>
                    </thead>
                    <tbody id="inspectCadetTbody">
                        {body.kind === 'loading' ? (
                            <MessageRow colSpan={5} padding={16}>Loading families...</MessageRow>
                        ) : body.kind === 'error' ? (
                            <MessageRow colSpan={5} padding={16} color="#ef4444">{body.message}</MessageRow>
                        ) : body.families.length === 0 ? (
                            <MessageRow colSpan={5} padding={24}>No surveyed households recorded for this cadet yet.</MessageRow>
                        ) : (
                            body.families.map((f, i) => (
                                <tr key={i}>
                                    <td><strong>#{f.family_no}</strong></td>
                                    <td><strong style={{ color: 'var(--text-primary)' }}>{f.head_of_family || ''}</strong></td>
                                    <td>{f.village || 'Field Block'}</td>
                                    <td style={{ textAlign: 'center' }}><span className="badge badge-success">{f.members_count || 0}</span></td>
                                    <td>{f.survey_date || datePart(f.created_at)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={modal.hide}>Close</button>
            </div>
        </ModalOverlay>
    );
}
