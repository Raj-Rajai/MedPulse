/** Patient dossier body (openPatient() in hospital-ui.js). */
import { Fragment } from 'react';
import { type FapDossier, type Row, shown, type Val } from './api';

type Pair = [string, Val];

function DetailsGrid({ pairs }: { pairs: Pair[] }) {
    return <dl className="detail-grid">{pairs.map(([label, value], i) => <div key={i}><dt>{label}</dt><dd>{shown(value)}</dd></div>)}</dl>;
}

function ListSection({ title, records, fields }: { title: string; records: Row[]; fields: [string, string][] }) {
    return (
        <section className="dossier-section"><h3>{title}</h3>{records.length
            ? records.map((r, i) => <Fragment key={i}>{i > 0 ? <hr /> : null}<DetailsGrid pairs={fields.map(([label, key]) => [label, r[key]])} /></Fragment>)
            : <p className="form-note">No entries recorded.</p>}</section>
    );
}

function SurveySection({ title, v, keys }: { title: string; v: Row; keys: [string, string][] }) {
    return <section className="dossier-section"><h3>{title}</h3><DetailsGrid pairs={keys.map(([label, key]) => [label, v[key]])} /></section>;
}

interface Status { text: string; cls: string }

function statuses(d: FapDossier) {
    const m = d.member, v = d.vitals;
    const sbp = v.sbp ? Number(v.sbp) : null;
    const dbp = v.dbp ? Number(v.dbp) : null;
    let bp: Status = { text: 'Not assessed', cls: 'vitals-sub-dim' };
    if (sbp || dbp) {
        bp = (sbp && sbp >= 140) || (dbp && dbp >= 90)
            ? { text: 'Hypertension (Elevated)', cls: 'vitals-sub-alert' }
            : { text: 'Normal Blood Pressure', cls: 'vitals-sub-normal' };
    }
    const rbs = v.rbs ? Number(v.rbs) : null;
    let rbsS: Status = { text: 'Not assessed', cls: 'vitals-sub-dim' };
    if (rbs) rbsS = rbs >= 140 ? { text: 'Elevated Blood Sugar', cls: 'vitals-sub-alert' } : { text: 'Normal Range', cls: 'vitals-sub-normal' };
    const hb = v.hb ? Number(v.hb) : null;
    let hbS: Status = { text: 'Not assessed', cls: 'vitals-sub-dim' };
    if (hb) {
        hbS = (m.gender === 'F' && hb < 11) || (m.gender === 'M' && hb < 12) || hb < 11
            ? { text: 'Anaemia Flagged', cls: 'vitals-sub-alert' }
            : { text: 'Normal Range', cls: 'vitals-sub-normal' };
    }
    const bmi = v.bmi ? Number(v.bmi) : null;
    let bmiS: Status = { text: 'Not calculated', cls: 'vitals-sub-dim' };
    if (bmi) {
        if (bmi < 18.5) bmiS = { text: 'Underweight', cls: 'vitals-sub-alert' };
        else if (bmi > 25) bmiS = { text: 'Overweight', cls: 'vitals-sub-alert' };
        else bmiS = { text: 'Healthy Weight', cls: 'vitals-sub-normal' };
    }
    return { bp, rbs: rbsS, hb: hbS, bmi: bmiS };
}

const unitStyle = { fontSize: '11px', fontWeight: 500, color: '#678275' } as const;

function VitalsCard({ label, value, unit, status }: { label: string; value: string; unit: string; status: Status }) {
    return (
        <div className="vitals-card">
            <div className="vitals-card-label">{label}</div>
            <div className="vitals-card-value">{value} <small style={unitStyle}>{unit}</small></div>
            <span className={`vitals-card-sub ${status.cls}`}>{status.text}</span>
        </div>
    );
}

export function PatientDossier({ d, onRegister }: { d: FapDossier; onRegister: (id: number) => void }) {
    const m = d.member, v = d.vitals, f = d.family;
    const s = statuses(d);
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <p className="form-note" style={{ margin: 0 }}>{`FAP-${m.id} · Entered by ${m.student_name} (roll ${m.student_roll}) · ${shown(m.university_name)}`}</p>
                <button type="button" className="button action-register-btn" data-register-from-dossier={m.id} onClick={() => onRegister(m.id)}>
                    <span>+ Register Hospital Visit</span>
                </button>
            </div>

            <div className="dossier-hero-grid">
                <VitalsCard label="Blood Pressure" value={`${v.sbp || '--'} / ${v.dbp || '--'}`} unit="mmHg" status={s.bp} />
                <VitalsCard label="Random Blood Sugar" value={String(v.rbs || '--')} unit="mg/dL" status={s.rbs} />
                <VitalsCard label="Haemoglobin" value={String(v.hb || '--')} unit="g/dL" status={s.hb} />
                <VitalsCard label="Body Mass Index" value={String(v.bmi || '--')} unit="kg/m²" status={s.bmi} />
            </div>

            <section className="dossier-section">
                <h3>📋 Patient &amp; adopted family</h3>
                <DetailsGrid pairs={[['Age / sex', `${m.age_years} years ${m.age_months || 0} months / ${m.gender || 'Not recorded'}`], ['Patient phone', v.contact_number], ['Family', f.family_code || `Family ${f.id}`], ['Head of family', f.head_of_family], ['Relation', v.relation_to_hof], ['Family phone', f.contact_number], ['Village / ward', f.village_ward || f.village], ['Address', f.address], ['Survey date', f.survey_date], ['Date of birth', v.date_of_birth], ['Education', v.education], ['Occupation', v.occupation]]} />
            </section>

            <SurveySection title="🩺 Student screening & treatment" v={v} keys={[['Hypertension flag', 'has_htn'], ['Diabetes flag', 'has_dm'], ['Anaemia flag', 'has_anaemia'], ['Diagnosis', 'diagnosis'], ['Treatment taken', 'treatment_taken'], ['Treatment source', 'treatment_source']]} />

            <SurveySection title="📊 Baseline measurements" v={v} keys={[['Systolic BP (mmHg)', 'sbp'], ['Diastolic BP (mmHg)', 'dbp'], ['Random blood sugar (mg/dL)', 'rbs'], ['Haemoglobin (g/dL)', 'hb'], ['Height (m)', 'height_m'], ['Weight (kg)', 'weight_kg'], ['BMI', 'bmi'], ['Waist / hip ratio', 'whr']]} />

            <ListSection title="🏷 Recorded conditions" records={d.conditions} fields={[['Condition', 'condition_name'], ['Status', 'status'], ['Notes', 'notes']]} />

            <ListSection title="📅 Follow-up visits" records={d.follow_ups} fields={[['Visit date', 'visit_date'], ['Student', 'student_name'], ['Student roll', 'student_roll'], ['Systolic BP (mmHg)', 'sbp'], ['Diastolic BP (mmHg)', 'dbp'], ['RBS (mg/dL)', 'rbs'], ['Haemoglobin (g/dL)', 'hb'], ['Weight (kg)', 'weight_kg'], ['Progress', 'health_progress'], ['Treatment compliance', 'treatment_compliance'], ['Clinical notes', 'clinical_notes'], ['Next visit', 'next_visit_date']]} />

            <ListSection title="💊 Medications" records={d.medications} fields={[['Medicine', 'name'], ['Dosage', 'dosage'], ['Frequency', 'frequency'], ['Currently taking', 'currently_taking'], ['Reason', 'reason']]} />

            <ListSection title="⚠ Allergies" records={d.allergies} fields={[['Allergen', 'allergen'], ['Reaction', 'reaction'], ['Severity', 'severity']]} />

            <ListSection title="📜 Medical history" records={d.history} fields={[['Category', 'category'], ['Description', 'description'], ['Year', 'year'], ['Notes', 'notes']]} />

            <SurveySection title="👶 Child growth & immunisation" v={v} keys={[['MUAC (cm)', 'muac_cm'], ['Underweight flag', 'is_underweight'], ['Stunting flag', 'is_stunting'], ['Wasting flag', 'is_wasting'], ['Immunisation status', 'immunization_status']]} />

            <SurveySection title="🌸 Maternal & reproductive health" v={v} keys={[['Antenatal care', 'anc_taken'], ['Place of delivery', 'delivery_place'], ['Postnatal care', 'pnc_taken'], ['Family planning', 'fp_method_used']]} />

            <SurveySection title="🌿 Lifestyle" v={d.lifestyle || {}} keys={[['Smoking', 'smoking_status'], ['Alcohol', 'alcohol_status'], ['Physical activity', 'physical_activity'], ['Diet', 'diet'], ['Notes', 'notes']]} />

            <p className="form-note">Y = yes, N = no, NA = not applicable / not assessed as entered. Blank fields are shown as “Not recorded”. Updates made in the student workspace appear when you refresh or reopen the record.</p>
        </>
    );
}
