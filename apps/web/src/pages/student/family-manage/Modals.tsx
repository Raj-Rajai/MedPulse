/** The modal overlays of family-manage.html, in their original order after <main>. */
import type { ReactNode } from 'react';
import type { ValidatedField } from '../../../shared/validation';
import { OPT, fieldKit } from './fields';
import type { FormValues } from './types';

const display = (open: boolean) => ({ display: open ? 'flex' : 'none' });
const closeX = { fontSize: '0.8rem', padding: '0.25rem 0.5rem' };
const h2 = { color: 'var(--primary)', fontSize: '1.3rem' };
const h2s = { color: 'var(--primary)', fontSize: '1.25rem' };
const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const actions = (mt: string) => ({ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: mt });

interface FormModalProps {
    open: boolean;
    form: FormValues;
    set: (id: string, v: string) => void;
    onClose: () => void;
    onSubmit: () => void;
    saving: boolean;
}

function Header({ title, titleId, style, mb = '1rem', onClose }: { title: ReactNode; titleId?: string; style: object; mb?: string; onClose: () => void }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mb }}>
            <h2 id={titleId} style={style}>{title}</h2>
            <button className="btn btn-secondary" onClick={onClose} style={closeX}>✕</button>
        </div>
    );
}

export function EditFamilyModal({ open, form, set, onClose, onSubmit, saving, phone }: FormModalProps & { phone: ValidatedField }) {
    const k = fieldKit(form, set);
    return (
        <div id="editFamilyModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content">
                <Header title="✏️ Edit Household Details" style={h2} onClose={onClose} />
                <form id="editFamilyForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <div className="form-grid">
                        {k.inp('efHof', 'Head of Family (HOF) Name *', { required: true })}
                        {k.inp('efFamilyName', 'Family Name / Household Label')}
                        {k.phone('efContactPhone', 'Contact Phone Number', phone)}
                        {k.inp('efVillage', 'Village / Ward Area *', { required: true })}
                        {k.inp('efAddress', 'Address / House Plot')}
                        {k.inp('efCity', 'City / Town')}
                        {k.inp('efPincode', 'Pincode')}
                        {k.inp('efTotalCu', 'Total Family CU', { type: 'number', step: '0.1' })}
                        {k.inp('efCalorie', 'Daily Calorie Intake (kcal/CU/Day)', { type: 'number' })}
                        {k.sel('efCalorieStatus', 'Calorie Adequacy Status', OPT.calStatus)}
                        {k.sel('efAdvice', 'Dietary Advice Given?', OPT.advice)}
                    </div>
                    <div style={actions('1.5rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveEditFamilyBtn" disabled={saving}>{saving ? 'Updating...' : '💾 Update Household'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface AddMemberProps extends Omit<FormModalProps, 'onSubmit' | 'saving'> {
    familyNo: string;
    draftAlert: boolean;
    onRestore: () => void;
    onDiscard: () => void;
    onSubmit: (addAnother: boolean) => void;
    saving: 'save' | 'another' | null;
    phone: ValidatedField;
    onFormInput: (patch: FormValues) => void;
}

export function AddMemberModal(p: AddMemberProps) {
    // Every user change goes through onFormInput (the draft autosave listened to the form's input event).
    const k = fieldKit(p.form, (id, v) => p.onFormInput({ [id]: v }));
    return (
        <div id="addMemberModal" className="modal-overlay" style={display(p.open)}>
            <div className="modal-content">
                <Header title={<>➕ Add Member to Family #<span id="modalFamilyNo">{p.familyNo}</span></>} style={h2} mb="0.5rem" onClose={p.onClose} />

                <div id="memberDraftAlert" className="draft-alert" style={{ display: p.draftAlert ? 'flex' : 'none' }}>
                    <span>⚠️ Unsaved member draft found from previous session.</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button type="button" onClick={p.onRestore}>Restore Draft</button>
                        <button type="button" onClick={p.onDiscard} style={{ background: '#e2e8f0', color: '#475569' }}>Discard</button>
                    </div>
                </div>

                <p className="card-desc" style={{ marginBottom: '1rem' }}>Fill in demographics and clinical parameters. Age is automatically calculated if Date of Birth is provided.</p>

                <form id="addMemberForm" onSubmit={(e) => { e.preventDefault(); p.onSubmit(false); }}>
                    <div className="form-grid">
                        {k.inp('modalMName', 'Full Name *', { required: true, placeholder: 'Member name' })}
                        {k.sel('modalMRelation', 'Relation to Head of Family *', OPT.relation)}
                        {k.sel('modalMGender', 'Gender *', OPT.gender)}
                        {k.inp('modalMDob', 'Date of Birth (DOB)', { type: 'date' })}
                        {k.inp('modalMAgeYears', 'Age (Years) *', { type: 'number', min: '0', max: '120', required: true, placeholder: 'e.g. 35' })}
                        {k.inp('modalMAgeMonths', 'Age (Months - if < 2 yrs)', { type: 'number', min: '0', max: '24' })}
                        {k.sel('modalMMaritalStatus', 'Marital Status', OPT.marital)}
                        {k.sel('modalMEducation', 'Education Level', OPT.education)}
                        {k.inp('modalMOccupation', 'Occupation', { placeholder: 'e.g. Farmer, Homemaker, Student' })}
                        {k.phone('modalMContact', 'Contact Phone Number', p.phone, { placeholder: 'e.g. 9876543210' })}
                        {k.sel('modalMWork', 'Physical Activity', OPT.work)}
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>ℹ️</span>
                        <span>Member registered with basic demographics. Full clinical survey (vitals, screening, pediatric &amp; maternal records) is recorded on the <strong>Data Entry</strong> page.</span>
                    </div>

                    <div style={{ ...actions('1.5rem'), flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary" onClick={p.onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveMemberBtn" disabled={p.saving === 'save'}>{p.saving === 'save' ? 'Saving...' : '💾 Save Member'}</button>
                        <button type="button" className="btn btn-success" id="saveAddAnotherBtn" disabled={p.saving === 'another'} onClick={() => p.onSubmit(true)}>{p.saving === 'another' ? 'Saving...' : '⚡ Save & Add Another'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function EditMemberModal({ open, form, set, onClose, onSubmit, saving, phone, onDob }: FormModalProps & { phone: ValidatedField; onDob: (v: string) => void }) {
    const k = fieldKit(form, set);
    return (
        <div id="editMemberModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content">
                <Header title="✏️ Edit Member Personal Info" style={h2} onClose={onClose} />
                <form id="editMemberForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <div className="form-grid">
                        {k.inp('emName', 'Full Name *', { required: true })}
                        {k.sel('emRelation', 'Relation to Head of Family *', OPT.relation)}
                        {k.sel('emGender', 'Gender *', OPT.gender)}
                        {fieldKit(form, (_id, v) => onDob(v)).inp('emDob', 'Date of Birth', { type: 'date' })}
                        {k.inp('emAgeYears', 'Age (Years) *', { type: 'number', min: '0', max: '120', required: true })}
                        {k.inp('emAgeMonths', 'Age (Months - if < 2 yrs)', { type: 'number', min: '0', max: '24' })}
                        {k.sel('emMaritalStatus', 'Marital Status', OPT.marital)}
                        {k.sel('emEducation', 'Education Level', OPT.education)}
                        {k.inp('emOccupation', 'Occupation')}
                        {k.phone('emContact', 'Contact Phone Number', phone)}
                        {k.sel('emWork', 'Physical Activity', OPT.work)}
                    </div>
                    <div style={actions('1.5rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveEditMemberBtn" disabled={saving}>{saving ? 'Updating...' : '💾 Update Member'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function ConditionModal({ open, title, form, set, onClose, onSubmit, saving }: FormModalProps & { title: string }) {
    const k = fieldKit(form, set);
    return (
        <div id="conditionModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content" style={{ maxWidth: '540px' }}>
                <Header title={title} titleId="conditionModalTitle" style={h2s} onClose={onClose} />
                <form id="conditionForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <input type="hidden" id="condEditId" value={form.condEditId} />
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {k.inp('condName', 'Condition / Disease Name *', { required: true, placeholder: 'e.g. Hypertension, Type 2 Diabetes, Asthma' })}
                        {k.sel('condCategory', 'Category', OPT.condCategory)}
                        <div style={two}>
                            {k.sel('condStatus', 'Status', OPT.condStatus)}
                            {k.sel('condSeverity', 'Severity', OPT.severity3)}
                        </div>
                        {k.inp('condDate', 'Diagnosis Date / Approximate Year', { type: 'date' })}
                        {k.area('condNotes', 'Clinical Notes', { rows: 2, placeholder: 'e.g. Diagnosed at SAL Hospital, on regular oral medication' })}
                    </div>
                    <div style={actions('1.25rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveConditionBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save Condition'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function MedicationModal({ open, title, form, set, onClose, onSubmit, saving }: FormModalProps & { title: string }) {
    const k = fieldKit(form, set);
    return (
        <div id="medicationModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content" style={{ maxWidth: '540px' }}>
                <Header title={title} titleId="medicationModalTitle" style={h2s} onClose={onClose} />
                <form id="medicationForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <input type="hidden" id="medEditId" value={form.medEditId} />
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {k.inp('medName', 'Medication / Drug Name *', { required: true, placeholder: 'e.g. Amlodipine, Metformin, Salbutamol Inhaler' })}
                        <div style={two}>
                            {k.inp('medDosage', 'Dosage', { placeholder: 'e.g. 5 mg, 500 mg' })}
                            {k.sel('medFrequency', 'Frequency', OPT.medFreq)}
                        </div>
                        <div style={two}>
                            {k.sel('medRoute', 'Route', OPT.medRoute)}
                            {k.sel('medAdherence', 'Adherence Status', OPT.medAdherence)}
                        </div>
                        {k.inp('medPrescribedFor', 'Prescribed For (Indication)', { placeholder: 'e.g. High blood pressure' })}
                        {k.inp('medStartDate', 'Start Date', { type: 'date' })}
                    </div>
                    <div style={actions('1.25rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveMedicationBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save Medication'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function AllergyModal({ open, title, form, set, onClose, onSubmit, saving }: FormModalProps & { title: string }) {
    const k = fieldKit(form, set);
    return (
        <div id="allergyModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <Header title={title} titleId="allergyModalTitle" style={h2s} onClose={onClose} />
                <form id="allergyForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <input type="hidden" id="algEditId" value={form.algEditId} />
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {k.inp('algAllergen', 'Allergen Substance *', { required: true, placeholder: 'e.g. Penicillin, Sulfa drugs, Peanuts, Dust' })}
                        <div style={two}>
                            {k.sel('algType', 'Allergy Type', OPT.algType)}
                            {k.sel('algSeverity', 'Severity', OPT.algSeverity)}
                        </div>
                        {k.inp('algReaction', 'Reaction Description', { placeholder: 'e.g. Skin rash, Urticaria, Bronchospasm' })}
                    </div>
                    <div style={actions('1.25rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveAllergyBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save Allergy'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function HistoryModal({ open, title, form, set, onClose, onSubmit, saving }: FormModalProps & { title: string }) {
    const k = fieldKit(form, set);
    return (
        <div id="historyModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content" style={{ maxWidth: '520px' }}>
                <Header title={title} titleId="historyModalTitle" style={h2s} onClose={onClose} />
                <form id="historyForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <input type="hidden" id="histEditId" value={form.histEditId} />
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {k.sel('histType', 'Event Type *', OPT.histType)}
                        {k.inp('histDesc', 'Event Description *', { required: true, placeholder: 'e.g. Appendectomy, Cholecystectomy, Pneumonia admission' })}
                        <div style={two}>
                            {k.inp('histDate', 'Event Date / Year', { placeholder: 'e.g. 2021 or 2021-04' })}
                            {k.inp('histFacility', 'Facility / Hospital', { placeholder: 'e.g. SAL Hospital' })}
                        </div>
                        {k.area('histNotes', 'Outcome / Recovery Notes', { rows: 2, placeholder: 'e.g. Full recovery, no post-op complications' })}
                    </div>
                    <div style={actions('1.25rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveHistoryBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save History'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function LifestyleModal({ open, form, set, onClose, onSubmit, saving }: FormModalProps) {
    const k = fieldKit(form, set);
    return (
        <div id="lifestyleModal" className="modal-overlay" style={display(open)}>
            <div className="modal-content" style={{ maxWidth: '540px' }}>
                <Header title="🏃 Lifestyle & Health Habits" style={h2s} onClose={onClose} />
                <form id="lifestyleForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div style={two}>
                            {k.sel('lsSmoking', 'Smoking / Tobacco', OPT.smoking)}
                            {k.inp('lsSmokingFreq', 'Tobacco Frequency', { placeholder: 'e.g. 5 bidi/day, Gutkha daily' })}
                        </div>
                        <div style={two}>
                            {k.sel('lsAlcohol', 'Alcohol Consumption', OPT.alcohol)}
                            {k.sel('lsDiet', 'Diet Pattern', OPT.diet)}
                        </div>
                        <div style={two}>
                            {k.sel('lsPhysical', 'Physical Activity Level', OPT.physical)}
                            {k.sel('lsSalt', 'Salt Intake', OPT.salt)}
                        </div>
                        <div style={two}>
                            {k.inp('lsSleep', 'Sleep Hours / Night', { type: 'number', step: '0.5', min: '0', max: '24', placeholder: 'e.g. 7.5' })}
                            {k.inp('lsNotes', 'Habits & Counseling Notes', { placeholder: 'e.g. Tobacco cessation advised' })}
                        </div>
                    </div>
                    <div style={actions('1.25rem')}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" id="saveLifestyleBtn" disabled={saving}>{saving ? 'Saving...' : '💾 Save Lifestyle Profile'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export interface ProvisionResult {
    message: string;
    name: string;
    uid: string;
    phone: string;
    pin: string;
    url: string;
}

interface ProvisionProps extends FormModalProps {
    headerName: string;
    result: ProvisionResult | null;
    copied: boolean;
    onCopy: () => void;
}

export function ProvisionModal(p: ProvisionProps) {
    const k = fieldKit(p.form, p.set);
    const r = p.result;
    return (
        <div id="provisionPatientModal" className="modal-overlay" style={display(p.open)}>
            <div className="modal-content" style={{ maxWidth: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                            📱
                        </div>
                        <div>
                            <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 800, margin: '0' }}>Patient Portal Account</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0' }}>Provision 1-click self-service access for this adopted family member</p>
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={p.onClose} style={closeX}>✕</button>
                </div>

                <div id="provisionFormSection" style={{ display: r ? 'none' : 'block' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                        Create login credentials for <strong id="provMemberNameHeader">{p.headerName}</strong>. The patient will be able to log in on the Patient Portal using their phone number and 4-digit PIN.
                    </p>

                    <form id="provisionForm" onSubmit={(e) => { e.preventDefault(); p.onSubmit(); }}>
                        <input type="hidden" id="provMemberId" value={p.form.provMemberId} />
                        {k.inp('provPatientName', 'Patient Display Name', { required: true }, { marginBottom: '0.85rem' })}
                        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                            <label htmlFor="provPhone">Mobile Phone (10 Digits - used for login)</label>
                            <input type="tel" id="provPhone" placeholder="e.g. 9876543210" maxLength={10} value={p.form.provPhone} onChange={(e) => p.set('provPhone', e.target.value)} />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Leave empty to auto-generate a designated health ID phone</small>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label htmlFor="provPin">4-Digit Security PIN</label>
                            <input type="text" id="provPin" maxLength={6} style={{ letterSpacing: '2px', fontWeight: 700 }} value={p.form.provPin} onChange={(e) => p.set('provPin', e.target.value)} />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Default is 1234 (Patient can change this anytime)</small>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={p.onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" id="btnSubmitProvision" disabled={p.saving} style={{ background: 'linear-gradient(135deg, #0d9488, #2563eb)', border: 'none' }}>
                                {p.saving ? 'Generating...' : '✨ Generate Patient Access'}
                            </button>
                        </div>
                    </form>
                </div>

                <div id="provisionSuccessSection" style={{ display: r ? 'block' : 'none' }}>
                    <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                            <span>✅</span> Account Ready &amp; Linked!
                        </div>
                        <p id="provSuccessMessage" style={{ fontSize: '0.825rem', color: '#047857', marginBottom: '1rem', lineHeight: '1.4' }}>
                            {r ? r.message : 'Patient account successfully provisioned and linked to your cadet supervision profile.'}
                        </p>

                        <div style={{ background: 'white', border: '1px solid #d1fae5', borderRadius: 'var(--radius-sm)', padding: '0.85rem', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.7' }}>
                            <div><strong>Patient Name:</strong> <span id="provResName">{r ? r.name : '-'}</span></div>
                            <div><strong>Patient UID:</strong> <span id="provResUid" style={{ color: '#0284c7', fontWeight: 700 }}>{r ? r.uid : '-'}</span></div>
                            <div><strong>Login Phone:</strong> <span id="provResPhone" style={{ fontWeight: 700 }}>{r ? r.phone : '-'}</span></div>
                            <div><strong>Login PIN:</strong> <span id="provResPin" style={{ color: '#d97706', fontWeight: 700 }}>{r ? r.pin : '1234'}</span></div>
                            <div><strong>Portal Link:</strong> <span id="provResUrl">{r ? r.url : '/login.html?patient=1'}</span></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary" onClick={p.onCopy} id="btnCopyCreds">
                            {p.copied ? '✅ Copied to Clipboard!' : '📋 Copy Patient Credentials'}
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <a href="/login.html?patient=1" target="_blank" className="btn btn-secondary" style={{ fontSize: '0.8rem', textDecoration: 'none' }}>
                                🔗 Open Portal
                            </a>
                            <button type="button" className="btn btn-primary" onClick={p.onClose}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export interface ConfirmState {
    open: boolean;
    title: string;
    message: string;
    okText: string;
    danger: boolean;
}

export function ConfirmModal({ s, onAnswer }: { s: ConfirmState; onAnswer: (ok: boolean) => void }) {
    return (
        <div id="customConfirmModal" className="modal-overlay" style={display(s.open)}>
            <div className="confirm-box">
                <h3 id="confirmTitle">{s.title}</h3>
                <p id="confirmMessage">{s.message}</p>
                <div className="confirm-actions">
                    <button type="button" className="btn btn-secondary" id="confirmCancelBtn" onClick={() => onAnswer(false)}>Cancel</button>
                    <button type="button" className={s.danger ? 'btn btn-danger' : 'btn btn-primary'} id="confirmOkBtn" onClick={() => onAnswer(true)}>{s.okText}</button>
                </div>
            </div>
        </div>
    );
}
