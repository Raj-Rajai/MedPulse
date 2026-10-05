/** The member survey <form> of entry.html (sections A–D and the sticky action bar). */
import type { ReactNode } from 'react';
import { Select } from '../common/Select';
import { OPTIONS, type MuacStatus, type SelectId, type SurveyForm, type Whr } from './survey';

export interface SurveyFormProps {
    f: SurveyForm;
    onField: (id: string, value: string) => void;
    sections: { adult: boolean; female: boolean; male: boolean; pediatric: boolean };
    bmi: ReactNode;
    whr: Whr | null;
    femaleAlert: Whr | null;
    maleAlert: Whr | null;
    muac: MuacStatus;
    actionTarget: string;
    saving: 'save' | 'next' | null;
    onSave: (next: boolean) => void;
    onReset: () => void;
}

export function SurveyFormView(p: SurveyFormProps) {
    const { f, onField } = p;
    const sel = (id: SelectId, label: string) => (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <Select id={id} options={OPTIONS[id]} value={f[id]} onValue={(v) => onField(id, v)} />
        </div>
    );
    const num = (id: string, label: string, attrs: { step?: string; min?: string; max?: string; placeholder: string }) => (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <input type="number" {...attrs} id={id} value={f[id]} onChange={(e) => onField(id, e.target.value)} />
        </div>
    );
    const text = (id: string, label: string, placeholder: string) => (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <input type="text" id={id} placeholder={placeholder} value={f[id]} onChange={(e) => onField(id, e.target.value)} />
        </div>
    );
    const show = (on: boolean) => (on ? 'block' : 'none');

    return (
        <form id="memberSurveyForm" onSubmit={(e) => { e.preventDefault(); p.onSave(false); }}>
            <div className="section-title">
                <span>🌐 1. Common Clinical Assessment &amp; Vitals</span>
                <span className="badge badge-info">Applies to All Individuals</span>
            </div>
            <p className="card-desc">General anthropometry, hemoglobin/pallor evaluation, hygiene status, and primary diagnosis.</p>

            <div className="form-grid">
                {sel('fPallor', 'Pallor Present? (Y/N)')}
                {num('fHb', 'Hemoglobin (Hb in g/dl) *', { step: '0.1', min: '2', max: '25', placeholder: 'e.g. 13.5' })}
                {sel('fAnaemia', 'Anaemia Diagnosis')}
                {num('fHeight', 'Height (in Meters)', { step: '0.01', min: '0.3', max: '2.5', placeholder: 'e.g. 1.62' })}
                {num('fWeight', 'Weight (in kg)', { step: '0.1', min: '1', max: '250', placeholder: 'e.g. 58.0' })}
                <div className="form-group">
                    <label>BMI (kg/m²) &amp; Status</label>
                    <div id="bmiDisplay" className="calc-preview">{p.bmi}</div>
                </div>
                {sel('fWorkType', 'Type of Work (S/M/H)')}
                {num('fCu', 'Consumption Unit (CU)', { step: '0.1', placeholder: 'e.g. 1.2' })}
                {text('fDiagnosis', 'Diagnosis (If Known)', 'e.g. Essential Hypertension, Type 2 DM, None')}
                {sel('fTreatment', 'Treatment Taken? (Y/N/NA)')}
                {text('fTreatmentSource', 'If Yes, From Where?', 'e.g. Govt Hospital, PHC, Private Clinic')}
                {sel('fOralHygiene', 'Oral Hygiene Satisfactory?')}
                {sel('fGeneralHygiene', 'General Hygiene Status?')}
            </div>

            <div id="adultNcdSection" className="section-divider" style={{ display: show(p.sections.adult) }}>
                <div className="section-title">
                    <span>🩺 2. Adult NCD Screening &amp; Central Obesity</span>
                    <span className="badge badge-info">Only for Adults (Age ≥ 18)</span>
                </div>
                <p className="card-desc">Non-communicable disease examination (Hypertension ≥140/90, Diabetes RBS ≥200) and waist-to-hip ratio.</p>

                <div className="form-grid">
                    {num('fSbp', 'Systolic BP (SBP, mmHg)', { min: '50', max: '300', placeholder: 'e.g. 120' })}
                    {num('fDbp', 'Diastolic BP (DBP, mmHg)', { min: '30', max: '200', placeholder: 'e.g. 80' })}
                    {sel('fHtn', 'Hypertension HTN (Y/N)')}
                    {num('fRbs', 'Random Blood Sugar (mg/dl)', { min: '30', max: '600', placeholder: 'e.g. 110' })}
                    {sel('fDm', 'Diabetes Mellitus DM (Y/N)')}
                    {num('fWaist', 'Waist Circumference (cm)', { step: '0.1', min: '30', max: '200', placeholder: 'e.g. 85.0' })}
                    {num('fHip', 'Hip Circumference (cm)', { step: '0.1', min: '30', max: '200', placeholder: 'e.g. 95.0' })}
                    <div className="form-group">
                        <label>Waist-to-Hip Ratio (WHR)</label>
                        <div id="whrDisplay" className="calc-preview">
                            {p.whr ? (
                                <>
                                    WHR: <strong>{p.whr.whr}</strong>{' '}
                                    {p.whr.high
                                        ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ Central Obesity</span>
                                        : <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Low Risk</span>}
                                </>
                            ) : 'Enter Waist & Hip'}
                        </div>
                    </div>
                </div>
            </div>

            <div id="femaleOnlyCard" className="card gender-card-female" style={{ marginTop: '1.5rem', display: show(p.sections.female) }}>
                <div className="section-title">
                    <span>👩 3. Female Specific — Maternal &amp; Reproductive Health</span>
                    <span className="badge" style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>Female Only</span>
                </div>
                <p className="card-desc">Antenatal care checkups, institutional vs home delivery, postnatal visits, family planning, and female central obesity standard (WHR &gt; 0.85).</p>

                <div className="form-grid">
                    {sel('fAnc', 'ANC Checkups Taken? (Y/N/NA)')}
                    {sel('fDelivery', 'Delivery Place (Hospital/Home)')}
                    {sel('fPnc', 'PNC Checkups Taken? (Y/N/NA)')}
                    {sel('fFp', 'Use of Any Family Planning Method?')}
                    <div className="form-group">
                        <label>Female WHR Threshold Alert</label>
                        <div id="femaleWhrAlert" className="calc-preview" style={{ background: '#fdf2f8', color: '#9d174d' }}>
                            {p.femaleAlert
                                ? p.femaleAlert.high ? `⚠️ WHR ${p.femaleAlert.whr} > 0.85 (Central Obesity Risk)` : `✓ WHR ${p.femaleAlert.whr} ≤ 0.85 (Normal Female Ratio)`
                                : 'WHR Standard: ≤ 0.85'}
                        </div>
                    </div>
                </div>
            </div>

            <div id="maleOnlyCard" className="card gender-card-male" style={{ marginTop: '1.5rem', display: show(p.sections.male) }}>
                <div className="section-title">
                    <span>👨 3. Male Specific — Anthropometry &amp; Activity Evaluation</span>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Male Only</span>
                </div>
                <p className="card-desc">Male cardiovascular risk threshold (WHR &gt; 0.90) and ICMR adult male consumption unit allocation. (Maternal sections are excluded).</p>

                <div className="form-grid">
                    <div className="form-group">
                        <label>Male Central Obesity Risk (WHR)</label>
                        <div id="maleWhrAlert" className="calc-preview" style={{ background: '#eff6ff', color: '#1e40af' }}>
                            {p.maleAlert
                                ? p.maleAlert.high ? `⚠️ WHR ${p.maleAlert.whr} > 0.90 (Central Obesity Risk)` : `✓ WHR ${p.maleAlert.whr} ≤ 0.90 (Normal Male Ratio)`
                                : 'WHR Standard: ≤ 0.90'}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>ICMR Reference Male Allocation</label>
                        <div className="calc-preview" style={{ background: '#f8fafc', color: 'var(--text-secondary)' }}>
                            Sedentary: 1.0 CU • Moderate: 1.2 CU • Heavy: 1.6 CU
                        </div>
                    </div>
                </div>
            </div>

            <div id="pediatricSection" className="card pediatric-card" style={{ marginTop: '1.5rem', display: show(p.sections.pediatric) }}>
                <div className="section-title">
                    <span>👶 4. Pediatric Growth, Nutrition &amp; Immunization (0-5 Yrs)</span>
                    <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Children 0-5 Yrs</span>
                </div>
                <p className="card-desc">Head/Chest circumference (0-2 yrs), MUAC arm circumference (6 mo - 5 yrs), clinical stunting/wasting, and Mamta card status.</p>

                <div className="form-grid">
                    {num('fHc', 'Head Circumference HC (cm, ≤ 2 Yrs)', { step: '0.1', min: '20', max: '65', placeholder: 'e.g. 45.0' })}
                    {num('fCc', 'Chest Circumference CC (cm, ≤ 2 Yrs)', { step: '0.1', min: '20', max: '75', placeholder: 'e.g. 46.0' })}
                    {num('fMuac', 'MUAC (cm, 6 mo - 5 Yrs)', { step: '0.1', min: '5', max: '25', placeholder: 'e.g. 13.5' })}
                    <div className="form-group">
                        <label>MUAC Malnutrition Status</label>
                        <div id="muacStatusDisplay" className="calc-preview">
                            {p.muac === 'initial' && 'Normal (> 12.5 cm)'}
                            {p.muac === 'sam' && <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ SAM (&lt; 11.5 cm)</span>}
                            {p.muac === 'mam' && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚠️ MAM (11.5 - 12.5 cm)</span>}
                            {p.muac === 'normal' && <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Normal (&gt; 12.5 cm)</span>}
                        </div>
                    </div>
                    {sel('fUnderweight', 'Underweight? (Y/N/NA)')}
                    {sel('fOverweight', 'Overweight? (Y/N/NA)')}
                    {sel('fStunting', 'Stunting? (Y/N/NA)')}
                    {sel('fWasting', 'Wasting? (Y/N/NA)')}
                    {sel('fSevereWasting', 'Severe Wasting? (Y/N/NA)')}
                    {sel('fMamta', 'Mamta Card Available? (Y/N/NA)')}
                    {sel('fImmun', 'Immunization Status As Per Age')}
                </div>
            </div>

            <div className="sticky-actions-bar" role="region" aria-label="Survey actions">
                <div className="survey-action-context">
                    <span className="survey-action-label">Editing survey</span>
                    <strong id="actionTargetMemberName">{p.actionTarget}</strong>
                </div>
                <div className="survey-action-buttons">
                    <button type="button" className="btn btn-secondary" onClick={p.onReset}>Reset</button>
                    <button type="button" className="btn btn-primary" id="btnSaveMember" disabled={p.saving === 'save'} onClick={() => p.onSave(false)}>
                        {p.saving === 'save' ? 'Saving...' : 'Save survey'}
                    </button>
                    <button type="button" className="btn btn-success" id="btnSaveNext" disabled={p.saving === 'next'} onClick={() => p.onSave(true)}>
                        {p.saving === 'next' ? 'Saving...' : 'Save & next member →'}
                    </button>
                </div>
            </div>
        </form>
    );
}
