/** Edit Profile and Change PIN modals of profile.html. */
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ValidatedField } from '../../../shared/validation';

export interface ProfileForm {
    name: string;
    email: string;
    phone: string;
    batch: string;
    posting: string;
}

interface EditProps {
    open: boolean;
    form: ProfileForm;
    setForm: Dispatch<SetStateAction<ProfileForm>>;
    saving: boolean;
    emailField: ValidatedField;
    phoneField: ValidatedField;
    emailRef: RefObject<HTMLInputElement | null>;
    phoneRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onSubmit: () => void;
}

export function EditProfileModal({ open, form, setForm, saving, emailField, phoneField, emailRef, phoneRef, onClose, onSubmit }: EditProps) {
    const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
    return (
        <div id="editProfileModal" className="modal-overlay" style={{ display: open ? 'flex' : 'none' }}>
            <div className="modal-content" style={{ maxWidth: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>✏️ Edit Student Profile</h2>
                    <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>✕</button>
                </div>
                <form id="editProfileForm" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                            <label htmlFor="epName">Trainee Full Name *</label>
                            <input type="text" id="epName" required placeholder="e.g. Dr. Harsh Vora" value={form.name} onChange={set('name')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="epEmail">Official Email</label>
                            <input
                                type="email" id="epEmail" placeholder="e.g. harsh.vora@salhospital.com" ref={emailRef}
                                className={emailField.className} value={form.email}
                                onChange={(e) => { set('email')(e); emailField.onInput(e.target.value); }} onBlur={(e) => emailField.onInput(e.target.value)}
                            />
                            {emailField.hints}
                        </div>
                        <div className="form-group">
                            <label htmlFor="epPhone">Contact Phone Number</label>
                            <input
                                type="tel" id="epPhone" placeholder="e.g. +91 98765 43210" ref={phoneRef} {...phoneField.inputProps}
                                className={phoneField.className} value={form.phone}
                                onChange={(e) => { set('phone')(e); phoneField.onInput(e.target.value); }} onBlur={(e) => phoneField.onInput(e.target.value)}
                            />
                            {phoneField.hints}
                        </div>
                        <div className="form-group">
                            <label htmlFor="epBatch">Batch &amp; Professional Year</label>
                            <input type="text" id="epBatch" placeholder="e.g. 3rd Year MBBS (PSM Batch 2024-25)" value={form.batch} onChange={set('batch')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="epPostingUnit">Posting Unit / Health Center</label>
                            <input type="text" id="epPostingUnit" placeholder="e.g. RHTC - Sanand Community Health Block" value={form.posting} onChange={set('posting')} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveProfileBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export interface PinForm {
    cur: string;
    n1: string;
    n2: string;
}

interface PinProps {
    open: boolean;
    pin: PinForm;
    setPin: Dispatch<SetStateAction<PinForm>>;
    saving: boolean;
    onClose: () => void;
    onSubmit: () => void;
}

export function ChangePinModal({ open, pin, setPin, saving, onClose, onSubmit }: PinProps) {
    const set = (k: keyof PinForm) => (e: React.ChangeEvent<HTMLInputElement>) => setPin((p) => ({ ...p, [k]: e.target.value }));
    return (
        <div id="changePinModal" className="modal-overlay" style={{ display: open ? 'flex' : 'none' }}>
            <div className="modal-content" style={{ maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>🔒 Change Student PIN</h2>
                    <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>✕</button>
                </div>
                <form id="changePinForm" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                            <label htmlFor="cpCurrent">Current PIN *</label>
                            <input type="password" id="cpCurrent" required maxLength={8} placeholder="Enter current PIN" value={pin.cur} onChange={set('cur')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="cpNew">New PIN (4–8 Digits) *</label>
                            <input type="password" id="cpNew" required minLength={4} maxLength={8} placeholder="Enter new PIN" value={pin.n1} onChange={set('n1')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="cpConfirm">Confirm New PIN *</label>
                            <input type="password" id="cpConfirm" required minLength={4} maxLength={8} placeholder="Re-enter new PIN" value={pin.n2} onChange={set('n2')} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="savePinBtn" disabled={saving}>{saving ? 'Updating...' : '🔑 Update PIN'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
