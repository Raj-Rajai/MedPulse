/** University admin modals: appoint, edit, reset PIN. */
import { useLayoutEffect, useRef, useState } from 'react';
import { ModalOverlay, closeBtnStyle, modalFootStyle, modalHeadStyle, twoColStyle } from '../../components/ModalOverlay';
import type { ModalState } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson } from '../../lib/http';
import type { CollegeStat, UniAdmin } from '../../types';

export interface QuotaNote { text: string; color: string }

/* ---------------- Appoint ---------------- */
const APPOINT_DEFAULTS = { username: '', pin: '9999', name: '', email: '', phone: '', role: 'University Admin' };

export function AppointUniAdminModal({ modal, collegeOptions, note, onSaved }: {
    modal: ModalState<string>; // opened with the currently selected university id
    collegeOptions: CollegeStat[] | null;
    note: QuotaNote;
    onSaved: (universityId: string) => void;
}) {
    const showToast = useToast();
    const [f, setF] = useState(APPOINT_DEFAULTS);
    const [uni, setUni] = useState('');
    const [busy, setBusy] = useState(false);
    const userRef = useRef<HTMLInputElement>(null);
    const optionsRef = useRef(collegeOptions);
    optionsRef.current = collegeOptions;

    useLayoutEffect(() => setUni(collegeOptions && collegeOptions.length ? String(collegeOptions[0].id) : ''), [collegeOptions]);
    useLayoutEffect(() => {
        if (!modal.nonce) return;
        setF(APPOINT_DEFAULTS);
        const wanted = String(modal.data ?? '');
        const opts = optionsRef.current;
        // Setting a select to a value it has no option for leaves it with no selection.
        setUni(opts && opts.some((c) => String(c.id) === wanted) ? wanted : '');
        userRef.current?.focus();
    }, [modal.nonce, modal.data]);

    const set = (k: keyof typeof APPOINT_DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                username: f.username.trim(),
                pin: f.pin.trim(),
                name: f.name.trim(),
                email: f.email.trim() || null,
                phone: f.phone.trim() || null,
                university_id: uni,
                role: f.role,
                status: 'Active',
            };
            const res = await sendJson('/api/admin/university-admins', 'POST', payload);
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to appoint university admin');
            showToast(data.message || 'University Administrator appointed successfully!', 'success');
            modal.hide();
            onSaved(payload.university_id);
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="appointUniAdminModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 520 }}>
            <div style={modalHeadStyle}>
                <div>
                    <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem', margin: 0 }}>➕ Appoint University Administrator</h2>
                    <span style={{ fontSize: '0.8rem', color: note.color, fontWeight: 650 }} id="modalQuotaNote">{note.text}</span>
                </div>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="appointUniAdminForm" onSubmit={submit}>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label htmlFor="auaUsername">Admin Username *</label>
                            <input type="text" id="auaUsername" ref={userRef} required placeholder="e.g. dr.mehta" value={f.username} onChange={set('username')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="auaPin">Access PIN *</label>
                            <input type="password" id="auaPin" required minLength={4} value={f.pin} onChange={set('pin')} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="auaName">Full Name &amp; Title *</label>
                        <input type="text" id="auaName" required placeholder="e.g. Dr. Alok Verma (Associate Prof)" value={f.name} onChange={set('name')} />
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="auaEmail">Email Address</label>
                            <input type="email" id="auaEmail" placeholder="faculty@institution.edu" value={f.email} onChange={set('email')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="auaPhone">Mobile Phone</label>
                            <input type="tel" id="auaPhone" placeholder="10-digit number" value={f.phone} onChange={set('phone')} />
                        </div>
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="auaUniversity">Affiliated Institution *</label>
                            <select id="auaUniversity" required value={uni} onChange={(e) => setUni(e.target.value)}>
                                {(collegeOptions || []).map((c) => <option key={c.id} value={c.id}>{c.name || ''}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="auaRole">Institutional Role *</label>
                            <select id="auaRole" required value={f.role} onChange={set('role')}>
                                <option value="University Admin">University Admin (Faculty)</option>
                                <option value="University Super Admin">University Super Admin (Dean)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="btnAppointAdminSubmit" disabled={busy} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}>{busy ? 'Appointing...' : '💾 Appoint Administrator'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Edit ---------------- */
export function EditUniAdminModal({ modal, onSaved }: { modal: ModalState<UniAdmin>; onSaved: (universityId: number) => void }) {
    const showToast = useToast();
    const [f, setF] = useState({ id: '', username: '', name: '', email: '', phone: '', status: 'Active' });
    const [busy, setBusy] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        const a = modal.data;
        if (!modal.nonce || !a) return;
        setF({ id: String(a.id), username: a.username, name: a.name, email: a.email || '', phone: a.phone || '', status: a.status || 'Active' });
        nameRef.current?.focus();
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
                status: f.status,
            };
            const res = await sendJson(`/api/admin/university-admins/${f.id}`, 'PUT', payload);
            const data = await readJson<{ admin: UniAdmin }>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to update administrator details');
            showToast(`Administrator "${data.admin.name}" updated!`, 'success');
            modal.hide();
            onSaved(data.admin.university_id);
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="editUniAdminModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 500 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>✏ Edit Administrator Details</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="editUniAdminForm" onSubmit={submit}>
                <input type="hidden" id="euaId" value={f.id} />
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                        <label>Username (Permanent)</label>
                        <input type="text" id="euaUsername" readOnly style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700 }} value={f.username} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="euaName">Administrator Full Name *</label>
                        <input type="text" id="euaName" ref={nameRef} required value={f.name} onChange={set('name')} />
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="euaEmail">Email Address</label>
                            <input type="email" id="euaEmail" value={f.email} onChange={set('email')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="euaPhone">Phone Number</label>
                            <input type="tel" id="euaPhone" value={f.phone} onChange={set('phone')} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="euaStatus">Account Status</label>
                        <select id="euaStatus" value={f.status} onChange={set('status')}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="btnEditUniAdminSubmit" disabled={busy}>{busy ? 'Saving...' : '💾 Save Changes'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Reset PIN ---------------- */
export function ResetUniAdminPinModal({ modal }: { modal: ModalState<UniAdmin> }) {
    const showToast = useToast();
    const [adminId, setAdminId] = useState('');
    const [name, setName] = useState('-');
    const [pin, setPin] = useState('9999');
    const [busy, setBusy] = useState(false);
    const pinRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        const a = modal.data;
        if (!modal.nonce || !a) return;
        setAdminId(String(a.id));
        setName(a.name || '');
        setPin('9999');
        pinRef.current?.focus();
    }, [modal.nonce, modal.data]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await sendJson(`/api/admin/university-admins/${adminId}/reset-pin`, 'POST', { new_pin: pin.trim() });
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to reset PIN');
            showToast(data.message as string, 'success');
            modal.hide();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="resetUniAdminPinModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 420 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>🔒 Reset Administrator PIN</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="resetUniAdminPinForm" onSubmit={submit}>
                <input type="hidden" id="ruaId" value={adminId} />
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Set a new access PIN / passcode for administrator <strong id="ruaAdminName" style={{ color: 'var(--text-primary)' }}>{name}</strong>:
                </p>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="ruaNewPin">New 4+ Digit PIN *</label>
                    <input type="password" id="ruaNewPin" ref={pinRef} required minLength={4} value={pin} onChange={(e) => setPin(e.target.value)} style={{ fontSize: '1.1rem', letterSpacing: 2, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="btnResetUniAdminPinSubmit" disabled={busy}>{busy ? 'Updating...' : '🔑 Update PIN'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}
