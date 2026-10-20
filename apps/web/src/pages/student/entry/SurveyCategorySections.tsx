import { useState } from 'react';
import { AccordionSectionHeader, FormField, SegmentedControl, YesNoToggle } from './FastControls';
import { deriveAgeFromDob } from './surveyStorage';
import type { MemberSurveyData } from './types';

export interface SurveyCategorySectionsProps {
    data: MemberSurveyData;
    onChange: (updater: (prev: MemberSurveyData) => MemberSurveyData) => void;
    currentYear: string;
}

export function SurveyCategorySections({ data, onChange, currentYear }: SurveyCategorySectionsProps) {
    const [closed, setClosed] = useState<Record<string, boolean>>({
        // Open the first 3 sections by default; user can collapse or expand any
        maternal: true,
        female: true,
        child: true,
        birth_history: true,
    });

    const toggle = (id: string) => setClosed((prev) => ({ ...prev, [id]: !prev[id] }));

    const update = (field: keyof MemberSurveyData, value: any) => {
        onChange((prev) => {
            const next = { ...prev, [field]: value };

            // Automatic BMI calculation (Master Prompt Section 18)
            if (field === 'height_m' || field === 'weight_kg') {
                const h = parseFloat(field === 'height_m' ? value : next.height_m);
                const w = parseFloat(field === 'weight_kg' ? value : next.weight_kg);
                if (h > 0 && w > 0) {
                    next.bmi = (w / (h * h)).toFixed(2);
                }
            }

            // Automatic WHR calculation (Master Prompt Section 18)
            if (field === 'waist_cm' || field === 'hip_cm') {
                const waist = parseFloat(field === 'waist_cm' ? value : next.waist_cm);
                const hip = parseFloat(field === 'hip_cm' ? value : next.hip_cm);
                if (waist > 0 && hip > 0) {
                    next.whr = (waist / hip).toFixed(2);
                }
            }

            // Auto-check vitals suggestions (Master Prompt Section 14)
            if (field === 'sbp' || field === 'dbp') {
                const s = parseInt(field === 'sbp' ? value : next.sbp, 10);
                const d = parseInt(field === 'dbp' ? value : next.dbp, 10);
                if (s >= 140 || d >= 90) next.has_htn = 'Y';
            }
            if (field === 'rbs') {
                const rbs = parseFloat(value);
                if (rbs >= 200) next.has_dm = 'Y';
            }
            if (field === 'hb') {
                const hb = parseFloat(value);
                if (hb > 0 && hb < 12.0) {
                    next.has_anaemia = 'Y';
                    next.has_pallor = 'Y';
                }
            }

            // Auto-check MUAC wasting suggestions
            if (field === 'muac_cm') {
                const muac = parseFloat(value);
                if (muac > 0 && muac < 11.5) {
                    next.is_severe_wasting = 'Y';
                    next.is_wasting = 'Y';
                } else if (muac >= 11.5 && muac <= 12.5) {
                    next.is_wasting = 'Y';
                }
            }

            // Auto-derive age from DOB if DOB changed
            if (field === 'date_of_birth') {
                const res = deriveAgeFromDob(value);
                if (res.display) {
                    next.age_years = String(res.years);
                    next.age_months = String(res.months);
                }
            }

            return next;
        });
    };

    // Demographic and eligibility checks
    const isFemale = data.gender === 'F';
    const ageY = parseFloat(data.age_years) || 0;
    const ageM = parseFloat(data.age_months) || 0;
    const totalAgeYears = ageY + ageM / 12;

    const isUnderTwo = totalAgeYears <= 2;
    const isMuacEligible = totalAgeYears >= 0.5 && totalAgeYears <= 5;
    const isSevereWastingEligible = totalAgeYears < 5;
    const isChild = totalAgeYears <= 16;
    const isInfant = totalAgeYears <= 1;

    return (
        <div className="survey-sections-container">
            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 1: SOCIO-DEMOGRAPHIC PROFILE                         */}
            {/* ------------------------------------------------------------- */}
            <div className="survey-category-card">
                <AccordionSectionHeader
                    id="socio"
                    title="1. Socio-Demographic Profile"
                    subtitle="Basic identification, relation, and demographic details"
                    isClosed={!!closed.socio}
                    onToggle={toggle}
                />
                {!closed.socio && (
                    <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <FormField label="Full Name">
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    placeholder="Member's full name"
                                />
                            </FormField>

                            <FormField label="Sex" sublabel="M / F / TG">
                                <SegmentedControl
                                    options={[
                                        { label: 'Male (M)', value: 'M' },
                                        { label: 'Female (F)', value: 'F' },
                                        { label: 'Transgender (TG)', value: 'TG' },
                                    ]}
                                    value={data.gender}
                                    onChange={(v) => update('gender', v)}
                                />
                            </FormField>

                            <FormField label="Date of Birth" sublabel="Authoritative">
                                <input
                                    type="date"
                                    value={data.date_of_birth}
                                    onChange={(e) => update('date_of_birth', e.target.value)}
                                />
                            </FormField>

                            <FormField label="Age" sublabel="Derived from DOB">
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        placeholder="Years"
                                        value={data.age_years}
                                        onChange={(e) => update('age_years', e.target.value)}
                                        style={{ width: '50%' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Y</span>
                                    <input
                                        type="number"
                                        placeholder="Months"
                                        value={data.age_months}
                                        onChange={(e) => update('age_months', e.target.value)}
                                        style={{ width: '50%' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>M</span>
                                </div>
                            </FormField>

                            <FormField label="Relation with Head">
                                <input
                                    type="text"
                                    value={data.relation_to_hof}
                                    onChange={(e) => update('relation_to_hof', e.target.value)}
                                    placeholder="e.g. Head, Wife, Son, Daughter"
                                />
                            </FormField>

                            <FormField label="Marital Status">
                                <input
                                    type="text"
                                    value={data.marital_status}
                                    onChange={(e) => update('marital_status', e.target.value)}
                                    placeholder="Married, Unmarried, Divorced..."
                                />
                            </FormField>

                            <FormField label="Education">
                                <input
                                    type="text"
                                    value={data.education}
                                    onChange={(e) => update('education', e.target.value)}
                                    placeholder="Illiterate, Primary, Secondary, Graduate..."
                                />
                            </FormField>

                            <FormField label="Occupation">
                                <input
                                    type="text"
                                    value={data.occupation}
                                    onChange={(e) => update('occupation', e.target.value)}
                                    placeholder="e.g. Farmer, Homemaker, Student..."
                                />
                            </FormField>

                            <FormField label="Aadhaar Number" sublabel="Text">
                                <input
                                    type="text"
                                    value={data.aadhaar_number}
                                    onChange={(e) => update('aadhaar_number', e.target.value)}
                                    placeholder="12-digit Aadhaar (optional)"
                                    maxLength={16}
                                />
                            </FormField>

                            <FormField label="ABHA ID" sublabel="Text">
                                <input
                                    type="text"
                                    value={data.abha_id}
                                    onChange={(e) => update('abha_id', e.target.value)}
                                    placeholder="14-digit ABHA number or address"
                                />
                            </FormField>

                            <FormField label="Addiction (If any)">
                                <input
                                    type="text"
                                    value={data.addiction}
                                    onChange={(e) => update('addiction', e.target.value)}
                                    placeholder="e.g. Tobacco, Smoking, Alcohol, None"
                                />
                            </FormField>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 2: FAMILY HEALTH RECORDS - 1                         */}
            {/* ------------------------------------------------------------- */}
            <div className="survey-category-card">
                <AccordionSectionHeader
                    id="health_records_1"
                    title={`2. Family Health Records - 1 (${currentYear})`}
                    subtitle="Vitals, clinical measurements, blood pressure, blood sugar, circumferences"
                    badge={currentYear}
                    isClosed={!!closed.health_records_1}
                    onToggle={toggle}
                />
                {!closed.health_records_1 && (
                    <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <FormField label="PR (Pulse Rate)" sublabel="bpm">
                                <input
                                    type="number"
                                    value={data.pr}
                                    onChange={(e) => update('pr', e.target.value)}
                                    placeholder="e.g. 72"
                                />
                            </FormField>

                            <FormField label="RR (Respiratory Rate)" sublabel="breaths/min">
                                <input
                                    type="number"
                                    value={data.rr}
                                    onChange={(e) => update('rr', e.target.value)}
                                    placeholder="e.g. 16"
                                />
                            </FormField>

                            <FormField label="Blood Pressure (BP)" sublabel="SBP / DBP mmHg">
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        placeholder="SBP (120)"
                                        value={data.sbp}
                                        onChange={(e) => update('sbp', e.target.value)}
                                        style={{ width: '50%' }}
                                    />
                                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/</span>
                                    <input
                                        type="number"
                                        placeholder="DBP (80)"
                                        value={data.dbp}
                                        onChange={(e) => update('dbp', e.target.value)}
                                        style={{ width: '50%' }}
                                    />
                                </div>
                            </FormField>

                            <FormField label="Hypertension (HTN)" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.has_htn}
                                    onChange={(v) => update('has_htn', v)}
                                />
                            </FormField>

                            <FormField label="RBS (Random Blood Sugar)" sublabel="mg/dl">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={data.rbs}
                                    onChange={(e) => update('rbs', e.target.value)}
                                    placeholder="e.g. 110"
                                />
                            </FormField>

                            <FormField label="Diabetes Mellitus (DM)" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.has_dm}
                                    onChange={(v) => update('has_dm', v)}
                                />
                            </FormField>

                            <FormField label="Hb (Hemoglobin)" sublabel="g/dl">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={data.hb}
                                    onChange={(e) => update('hb', e.target.value)}
                                    placeholder="e.g. 13.5"
                                />
                            </FormField>

                            <FormField label="Anaemia" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.has_anaemia}
                                    onChange={(v) => update('has_anaemia', v)}
                                />
                            </FormField>

                            {/* Head Circumference (HC) - Conditional: age <= 2 years */}
                            {isUnderTwo && (
                                <FormField label="HC (Head Circumference)" sublabel="cm" badge="Age ≤ 2 yrs">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={data.hc_cm}
                                        onChange={(e) => update('hc_cm', e.target.value)}
                                        placeholder="e.g. 45.0"
                                    />
                                </FormField>
                            )}

                            {/* Chest Circumference (CC) - Conditional: age <= 2 years */}
                            {isUnderTwo && (
                                <FormField label="CC (Chest Circumference)" sublabel="cm" badge="Age ≤ 2 yrs">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={data.cc_cm}
                                        onChange={(e) => update('cc_cm', e.target.value)}
                                        placeholder="e.g. 47.0"
                                    />
                                </FormField>
                            )}

                            {/* MUAC - Conditional: children 6 months to 5 years */}
                            {isMuacEligible && (
                                <FormField label="MUAC (Mid Upper Arm Circumference)" sublabel="cm" badge="6m – 5 yrs">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={data.muac_cm}
                                        onChange={(e) => update('muac_cm', e.target.value)}
                                        placeholder="e.g. 13.2"
                                    />
                                </FormField>
                            )}

                            {isFemale && (
                                <FormField label="Any Pregnant woman in family?" sublabel="Y/N">
                                    <YesNoToggle
                                        value={data.is_pregnant_woman}
                                        onChange={(v) => update('is_pregnant_woman', v)}
                                    />
                                </FormField>
                            )}

                            <div style={{ gridColumn: '1 / -1' }}>
                                <FormField label="Advice" sublabel="From survey sheet footnote">
                                    <textarea
                                        rows={2}
                                        value={data.health_records_advice}
                                        onChange={(e) => update('health_records_advice', e.target.value)}
                                        placeholder="Clinical observations or instructions for this record..."
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 3: HEALTH STATUS                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="survey-category-card">
                <AccordionSectionHeader
                    id="health_status"
                    title="3. Health Status"
                    subtitle="Past illness, C/O present illness, treatment, oral health & hygiene"
                    isClosed={!!closed.health_status}
                    onToggle={toggle}
                />
                {!closed.health_status && (
                    <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <FormField label="Past illness during last one year" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.past_illness_last_year}
                                    onChange={(v) => update('past_illness_last_year', v)}
                                />
                            </FormField>

                            <FormField label="C/O Present illness" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.co_present_illness}
                                    onChange={(v) => update('co_present_illness', v)}
                                />
                            </FormField>

                            <FormField label="Diagnosis (If Known)" sublabel="Text">
                                <input
                                    type="text"
                                    value={data.diagnosis}
                                    onChange={(e) => update('diagnosis', e.target.value)}
                                    placeholder="e.g. Hypertension, Diabetes, URTI, None"
                                />
                            </FormField>

                            <FormField label="Treatment Taken" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.treatment_taken}
                                    onChange={(v) => update('treatment_taken', v)}
                                />
                            </FormField>

                            {/* Conditional: Only show/enable when Treatment Taken = Y */}
                            {data.treatment_taken === 'Y' && (
                                <FormField label="If Yes, From where?" sublabel="Provider / Facility" badge="Conditional">
                                    <input
                                        type="text"
                                        value={data.treatment_source}
                                        onChange={(e) => update('treatment_source', e.target.value)}
                                        placeholder="e.g. PHC Santej, Civil Hospital, Private clinic"
                                    />
                                </FormField>
                            )}

                            <FormField label="Oral Health check-up" sublabel="Satisfactory Y/N">
                                <YesNoToggle
                                    value={data.oral_health_checkup}
                                    onChange={(v) => update('oral_health_checkup', v)}
                                />
                            </FormField>

                            <FormField label="Hygiene status" sublabel="Satisfactory Y/N">
                                <YesNoToggle
                                    value={data.hygiene_status}
                                    onChange={(v) => update('hygiene_status', v)}
                                />
                            </FormField>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 4: FAMILY HEALTH RECORDS - 2 (ANTHROPOMETRY)         */}
            {/* ------------------------------------------------------------- */}
            <div className="survey-category-card">
                <AccordionSectionHeader
                    id="health_records_2"
                    title="4. Family Health Records - 2 (Physical & Anthropometry)"
                    subtitle="Height, weight, BMI, waist, hip, WHR, and growth indicators"
                    isClosed={!!closed.health_records_2}
                    onToggle={toggle}
                />
                {!closed.health_records_2 && (
                    <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            <FormField label="Height (Ht)" sublabel="meters">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={data.height_m}
                                    onChange={(e) => update('height_m', e.target.value)}
                                    placeholder="e.g. 1.65"
                                />
                            </FormField>

                            <FormField label="Weight (Wt)" sublabel="kg">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={data.weight_kg}
                                    onChange={(e) => update('weight_kg', e.target.value)}
                                    placeholder="e.g. 62.5"
                                />
                            </FormField>

                            <FormField label="BMI (Body Mass Index)" sublabel="Auto kg/m²" badge="Calculated">
                                <input
                                    type="text"
                                    readOnly
                                    value={data.bmi ? `${data.bmi} kg/m²` : 'Enter Ht & Wt'}
                                    style={{ background: 'var(--bg-subtle)', fontWeight: 700, color: 'var(--primary)' }}
                                />
                            </FormField>

                            <FormField label="WC (Waist Circumference)" sublabel="cm">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={data.waist_cm}
                                    onChange={(e) => update('waist_cm', e.target.value)}
                                    placeholder="e.g. 82.0"
                                />
                            </FormField>

                            <FormField label="HC (Hip Circumference)" sublabel="cm">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={data.hip_cm}
                                    onChange={(e) => update('hip_cm', e.target.value)}
                                    placeholder="e.g. 94.0"
                                />
                            </FormField>

                            <FormField label="WHR (Waist-Hip Ratio)" sublabel="Auto" badge="Calculated">
                                <input
                                    type="text"
                                    readOnly
                                    value={data.whr || 'Enter WC & HC'}
                                    style={{ background: 'var(--bg-subtle)', fontWeight: 700, color: 'var(--primary)' }}
                                />
                            </FormField>

                            <FormField label="Under weight" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.is_underweight}
                                    onChange={(v) => update('is_underweight', v)}
                                />
                            </FormField>

                            <FormField label="Over Weight" sublabel="Y/N">
                                <YesNoToggle
                                    value={data.is_overweight}
                                    onChange={(v) => update('is_overweight', v)}
                                />
                            </FormField>

                            <FormField label="Stunting" sublabel="Low Height-for-Age Y/N">
                                <YesNoToggle
                                    value={data.is_stunting}
                                    onChange={(v) => update('is_stunting', v)}
                                />
                            </FormField>

                            <FormField label="Wasting" sublabel="Low Weight-for-Height Y/N">
                                <YesNoToggle
                                    value={data.is_wasting}
                                    onChange={(v) => update('is_wasting', v)}
                                />
                            </FormField>

                            {/* Severely Wasted - Conditional: age < 5 years (Master Prompt Section 18) */}
                            {isSevereWastingEligible && (
                                <FormField label="Severely wasted" sublabel="Y/N" badge="Age < 5 yrs">
                                    <YesNoToggle
                                        value={data.is_severe_wasting}
                                        onChange={(v) => update('is_severe_wasting', v)}
                                    />
                                </FormField>
                            )}

                            <div style={{ gridColumn: '1 / -1' }}>
                                <FormField label="Anthropometry Advice" sublabel="From survey sheet footnote">
                                    <textarea
                                        rows={2}
                                        value={data.anthropometry_advice}
                                        onChange={(e) => update('anthropometry_advice', e.target.value)}
                                        placeholder="Nutritional recommendations, follow-up advice..."
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 5: MATERNAL HISTORY (DELIVERY IN LAST ONE YEAR)      */}
            {/* ------------------------------------------------------------- */}
            {isFemale && (
                <div className="survey-category-card">
                    <AccordionSectionHeader
                        id="maternal"
                        title="5. Maternal History (Delivery in Last One Year) & Antenatal Care"
                        subtitle="Antenatal visits, immunizations, BP, Hb, urine checks"
                        badge="Female Only"
                        isClosed={!!closed.maternal}
                        onToggle={toggle}
                    />
                    {!closed.maternal && (
                        <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <FormField label="ANC taken" sublabel="Yes/No">
                                    <YesNoToggle
                                        value={data.anc_taken}
                                        onChange={(v) => update('anc_taken', v)}
                                    />
                                </FormField>

                                <FormField label="No. of ANC visits" sublabel="Integer">
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.anc_visits_count}
                                        onChange={(e) => update('anc_visits_count', e.target.value)}
                                        placeholder="e.g. 4"
                                    />
                                </FormField>

                                <FormField label="Place" sublabel="ANC facility">
                                    <SegmentedControl
                                        options={[
                                            { label: 'Govt.', value: 'Government' },
                                            { label: 'Private', value: 'Private' },
                                            { label: 'Health worker', value: 'Health worker' },
                                            { label: 'Others', value: 'Others' },
                                        ]}
                                        value={data.anc_place}
                                        onChange={(v) => update('anc_place', v)}
                                    />
                                </FormField>

                                <FormField label="Inj. TT" sublabel="Dose 1 / 2 / Booster">
                                    <SegmentedControl
                                        options={[
                                            { label: '1 (1st Dose)', value: '1' },
                                            { label: '2 (2nd Dose)', value: '2' },
                                            { label: 'B (Booster)', value: 'B' },
                                        ]}
                                        value={data.inj_tt}
                                        onChange={(v) => update('inj_tt', v)}
                                    />
                                </FormField>

                                <FormField label="IFA tablets" sublabel="Y/N">
                                    <YesNoToggle
                                        value={data.ifa_tablets}
                                        onChange={(v) => update('ifa_tablets', v)}
                                    />
                                </FormField>

                                <FormField label="ANC BP" sublabel="mmHg">
                                    <input
                                        type="text"
                                        value={data.anc_bp}
                                        onChange={(e) => update('anc_bp', e.target.value)}
                                        placeholder="e.g. 110/70"
                                    />
                                </FormField>

                                <FormField label="ANC Hb" sublabel="gm/dl">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={data.anc_hb}
                                        onChange={(e) => update('anc_hb', e.target.value)}
                                        placeholder="e.g. 11.2"
                                    />
                                </FormField>

                                <FormField label="Urine Sugar">
                                    <input
                                        type="text"
                                        value={data.urine_sugar}
                                        onChange={(e) => update('urine_sugar', e.target.value)}
                                        placeholder="e.g. Nil, Trace, +"
                                    />
                                </FormField>

                                <FormField label="Urine Albumin">
                                    <input
                                        type="text"
                                        value={data.urine_albumin}
                                        onChange={(e) => update('urine_albumin', e.target.value)}
                                        placeholder="e.g. Nil, Trace, +"
                                    />
                                </FormField>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 6: FEMALE-SPECIFIC SECTION                           */}
            {/* ------------------------------------------------------------- */}
            {isFemale && (
                <div className="survey-category-card">
                    <AccordionSectionHeader
                        id="female"
                        title="6. Female-Specific Section (Delivery, PNC, Family Planning)"
                        subtitle="Institutional/home delivery details, postnatal care, and contraception"
                        badge="Female Only"
                        isClosed={!!closed.female}
                        onToggle={toggle}
                    />
                    {!closed.female && (
                        <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Delivery History
                                </h4>
                                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    <FormField label="Place of Delivery">
                                        <input
                                            type="text"
                                            value={data.delivery_place}
                                            onChange={(e) => update('delivery_place', e.target.value)}
                                            placeholder="e.g. PHC, Hospital, Home"
                                        />
                                    </FormField>

                                    <FormField label="Birth Attendant">
                                        <input
                                            type="text"
                                            value={data.delivery_attendant}
                                            onChange={(e) => update('delivery_attendant', e.target.value)}
                                            placeholder="e.g. Doctor, Nurse, Trained Dai"
                                        />
                                    </FormField>

                                    <FormField label="Type of Delivery">
                                        <input
                                            type="text"
                                            value={data.delivery_type}
                                            onChange={(e) => update('delivery_type', e.target.value)}
                                            placeholder="e.g. Normal Vaginal, LSCS, Forceps"
                                        />
                                    </FormField>

                                    <FormField label="Delivery Complication">
                                        <input
                                            type="text"
                                            value={data.delivery_complication}
                                            onChange={(e) => update('delivery_complication', e.target.value)}
                                            placeholder="e.g. None, PPH, Eclampsia"
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Post Natal Care (PNC)
                                </h4>
                                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    <FormField label="Total No. of PNC Visits" sublabel="Integer">
                                        <input
                                            type="number"
                                            min="0"
                                            value={data.pnc_visits_count}
                                            onChange={(e) => update('pnc_visits_count', e.target.value)}
                                            placeholder="e.g. 3"
                                        />
                                    </FormField>

                                    <FormField label="PNC Complication">
                                        <input
                                            type="text"
                                            value={data.pnc_complication}
                                            onChange={(e) => update('pnc_complication', e.target.value)}
                                            placeholder="e.g. Sepsis, Breast engorgement, None"
                                        />
                                    </FormField>

                                    <FormField label="Colostrum Given" sublabel="Y/N">
                                        <YesNoToggle
                                            value={data.colostrum_given}
                                            onChange={(v) => update('colostrum_given', v)}
                                        />
                                    </FormField>

                                    <FormField label="Breastfeeding" sublabel="Y/N">
                                        <YesNoToggle
                                            value={data.breastfeeding}
                                            onChange={(v) => update('breastfeeding', v)}
                                        />
                                    </FormField>

                                    <FormField label="Duration of BF">
                                        <input
                                            type="text"
                                            value={data.duration_of_breastfeeding}
                                            onChange={(e) => update('duration_of_breastfeeding', e.target.value)}
                                            placeholder="e.g. 6 months, 1 year"
                                        />
                                    </FormField>

                                    <FormField label="IFA Tablets (PNC)" sublabel="Y/N">
                                        <YesNoToggle
                                            value={data.pnc_ifa_tablets}
                                            onChange={(v) => update('pnc_ifa_tablets', v)}
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div style={{ paddingTop: '0.85rem', borderTop: '1px dashed var(--border)' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Family Planning Method
                                </h4>
                                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    <FormField label="Use of any FP methods?" sublabel="Y/N">
                                        <YesNoToggle
                                            value={data.fp_methods_used}
                                            onChange={(v) => update('fp_methods_used', v)}
                                        />
                                    </FormField>

                                    {/* Conditional: FP method type if YES */}
                                    {data.fp_methods_used === 'Y' && (
                                        <FormField label="If yes, type of method" sublabel="Text" badge="Conditional">
                                            <input
                                                type="text"
                                                value={data.fp_method_type}
                                                onChange={(e) => update('fp_method_type', e.target.value)}
                                                placeholder="e.g. OCP, Condom, IUCD, Copper-T, Tubectomy"
                                            />
                                        </FormField>
                                    )}

                                    {/* Conditional: FP reason for not using if NO */}
                                    {data.fp_methods_used === 'N' && (
                                        <FormField label="If no, reason for not using" sublabel="Text" badge="Conditional">
                                            <input
                                                type="text"
                                                value={data.fp_non_use_reason}
                                                onChange={(e) => update('fp_non_use_reason', e.target.value)}
                                                placeholder="Reason given by respondent..."
                                            />
                                        </FormField>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 7: CHILD-SPECIFIC IMMUNIZATION & MCH                 */}
            {/* ------------------------------------------------------------- */}
            {isChild && (
                <div className="survey-category-card">
                    <AccordionSectionHeader
                        id="child"
                        title="7. Child Immunization & MCH (Mamta Card)"
                        subtitle="Full vaccination checklist as per national immunization schedule & Vitamin A"
                        badge="Child ≤ 16 yrs"
                        isClosed={!!closed.child}
                        onToggle={toggle}
                    />
                    {!closed.child && (
                        <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                <FormField label="Immunization / MCH / Mamta card" sublabel="Present / Absent">
                                    <SegmentedControl
                                        options={[
                                            { label: 'Present', value: 'Present' },
                                            { label: 'Absent', value: 'Absent' },
                                        ]}
                                        value={data.mamta_card_present}
                                        onChange={(v) => update('mamta_card_present', v)}
                                    />
                                </FormField>

                                <FormField label="Taking all doses for IPPI rounds?" sublabel="Pulse Polio Y/N">
                                    <YesNoToggle
                                        value={data.ippi_all_doses}
                                        onChange={(v) => update('ippi_all_doses', v)}
                                    />
                                </FormField>

                                {data.ippi_all_doses === 'N' && (
                                    <FormField label="If no, reason" sublabel="Text" badge="Conditional">
                                        <input
                                            type="text"
                                            value={data.ippi_non_dose_reason}
                                            onChange={(e) => update('ippi_non_dose_reason', e.target.value)}
                                            placeholder="Reason for missing polio round..."
                                        />
                                    </FormField>
                                )}

                                <FormField label="Health workers visit family or not?" sublabel="Y/N">
                                    <YesNoToggle
                                        value={data.health_worker_visit}
                                        onChange={(v) => update('health_worker_visit', v)}
                                    />
                                </FormField>

                                <FormField label="Nearby Anganwadi">
                                    <input
                                        type="text"
                                        value={data.nearby_anganwadi}
                                        onChange={(e) => update('nearby_anganwadi', e.target.value)}
                                        placeholder="Name/location of nearby Anganwadi"
                                    />
                                </FormField>

                                <FormField label="Access to Anganwadi" sublabel="Yes / No">
                                    <YesNoToggle
                                        value={data.anganwadi_access}
                                        onChange={(v) => update('anganwadi_access', v)}
                                    />
                                </FormField>
                            </div>

                            {/* Vaccination schedule grid as per page 42 */}
                            <div style={{ marginBottom: '1.5rem', background: '#faf8ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '1rem' }}>
                                <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
                                    National Immunization Schedule (NIS) Checklist
                                </h4>

                                {[
                                    { period: 'At Birth', vaccines: ['BCG', 'OPV-0', 'Hep B'] },
                                    { period: '6 Weeks', vaccines: ['Pentavalent-1', 'Rota-1', 'fIPV-1', 'PCV-1', 'bOPV-1'] },
                                    { period: '10 Weeks', vaccines: ['Pentavalent-2', 'Rota-2', 'bOPV-2'] },
                                    { period: '14 Weeks', vaccines: ['Pentavalent-3', 'Rota-3', 'fIPV-2', 'PCV-2', 'bOPV-3'] },
                                    { period: '9-12 Months', vaccines: ['MR-1', 'fIPV-3', 'PCV Booster', 'JE-1*'] },
                                    { period: '16-24 Months', vaccines: ['MR-2', 'DPT Booster-1', 'bOPV Booster-1', 'JE-2*'] },
                                    { period: '5 Years', vaccines: ['DPT Booster-2'] },
                                    { period: '10 Years', vaccines: ['Td'] },
                                    { period: '16 Years', vaccines: ['Td'] },
                                ].map((group) => (
                                    <div key={group.period} style={{ marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid #ede9fe' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                                            {group.period}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {group.vaccines.map((vax) => {
                                                const checked = !!data.vaccines_received?.[vax];
                                                return (
                                                    <label
                                                        key={vax}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            padding: '0.3rem 0.65rem',
                                                            background: checked ? '#ede9fe' : '#ffffff',
                                                            border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                                                            borderRadius: '6px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: checked ? 700 : 500,
                                                            color: checked ? 'var(--primary)' : 'var(--text-primary)',
                                                            cursor: 'pointer',
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const nextMap = { ...(data.vaccines_received || {}), [vax]: e.target.checked };
                                                                update('vaccines_received', nextMap);
                                                            }}
                                                            style={{ margin: 0 }}
                                                        />
                                                        <span>{vax}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                    * JE in endemic district only.
                                </div>
                            </div>

                            {/* Vitamin A doses (page 43) */}
                            <div style={{ marginBottom: '1rem', background: '#faf8ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '1rem' }}>
                                <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
                                    Vitamin A Doses Checklist
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {['9M', '18M', '24M', '30M', '36M', '42M', '48M', '54M', '60M'].map((dose) => {
                                        const checked = !!data.vitamin_a_doses?.[dose];
                                        return (
                                            <label
                                                key={dose}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    padding: '0.3rem 0.65rem',
                                                    background: checked ? '#ede9fe' : '#ffffff',
                                                    border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                                                    borderRadius: '6px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: checked ? 700 : 500,
                                                    color: checked ? 'var(--primary)' : 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const nextMap = { ...(data.vitamin_a_doses || {}), [dose]: e.target.checked };
                                                        update('vitamin_a_doses', nextMap);
                                                    }}
                                                    style={{ margin: 0 }}
                                                />
                                                <span>{dose}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <FormField label="If not immunized, reason(s)">
                                <input
                                    type="text"
                                    value={data.not_immunized_reason}
                                    onChange={(e) => update('not_immunized_reason', e.target.value)}
                                    placeholder="e.g. Child sick, Unaware of schedule, Vaccine fear, None"
                                />
                            </FormField>
                        </div>
                    )}
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* CATEGORY 8: BIRTH HISTORY (INFANTS)                           */}
            {/* ------------------------------------------------------------- */}
            {isInfant && (
                <div className="survey-category-card">
                    <AccordionSectionHeader
                        id="birth_history"
                        title="8. Birth History (Infants)"
                        subtitle="Birthplace, attendant, birth weight, and early infant feeding practices"
                        badge="Infant ≤ 1 yr"
                        isClosed={!!closed.birth_history}
                        onToggle={toggle}
                    />
                    {!closed.birth_history && (
                        <div className="category-fields-wrap" style={{ padding: '0.75rem 1rem 1.25rem' }}>
                            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <FormField label="Birth place">
                                    <input
                                        type="text"
                                        value={data.birth_place}
                                        onChange={(e) => update('birth_place', e.target.value)}
                                        placeholder="e.g. PHC, Hospital, Home"
                                    />
                                </FormField>

                                <FormField label="Birth Attendant">
                                    <input
                                        type="text"
                                        value={data.birth_attendant}
                                        onChange={(e) => update('birth_attendant', e.target.value)}
                                        placeholder="e.g. Doctor, Nurse, SBA, Relative"
                                    />
                                </FormField>

                                <FormField label="Birth weight" sublabel="kg">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={data.birth_weight_kg}
                                        onChange={(e) => update('birth_weight_kg', e.target.value)}
                                        placeholder="e.g. 2.85"
                                    />
                                </FormField>

                                <FormField label="Colostrum given" sublabel="Y/N">
                                    <YesNoToggle
                                        value={data.infant_colostrum}
                                        onChange={(v) => update('infant_colostrum', v)}
                                    />
                                </FormField>

                                <FormField label="Breast feeding initiated" sublabel="Y/N">
                                    <YesNoToggle
                                        value={data.infant_breastfeeding}
                                        onChange={(v) => update('infant_breastfeeding', v)}
                                    />
                                </FormField>

                                <FormField label="Complementary feeding">
                                    <input
                                        type="text"
                                        value={data.complementary_feeding}
                                        onChange={(e) => update('complementary_feeding', e.target.value)}
                                        placeholder="e.g. Started at 6 months, Khichdi, Milk, None yet"
                                    />
                                </FormField>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
