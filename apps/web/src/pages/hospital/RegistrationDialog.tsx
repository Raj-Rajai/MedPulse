/** "Register Patient Visit" intake dialog (registrationModal in hospital.html). */
import type { ChangeEvent, FormEvent, Ref } from 'react';
import { Icon, IconSpan } from './icons';

export interface RegForm {
    familyMemberId: string; patientId: string;
    patientName: string; contactNumber: string; ageYears: string; gender: string; address: string;
    visitDate: string; department: string; doctor: string; visitType: string;
    chiefComplaint: string; symptomsDuration: string; existingConditions: string; allergies: string; diagnosis: string;
    sbp: string; dbp: string; pulse: string; temp: string; rbs: string;
    treatment: string; disposition: string; wardBed: string; followUp: string;
}

/** Values after HTMLFormElement.reset(): inputs empty, selects on their first option (hidden inputs keep theirs). */
export function resetForm(prev: Pick<RegForm, 'familyMemberId' | 'patientId'>): RegForm {
    return {
        familyMemberId: prev.familyMemberId, patientId: prev.patientId,
        patientName: '', contactNumber: '', ageYears: '', gender: 'M', address: '',
        visitDate: '', department: 'General Medicine', doctor: '', visitType: 'FAP Survey Referral',
        chiefComplaint: '', symptomsDuration: '', existingConditions: '', allergies: '', diagnosis: '',
        sbp: '', dbp: '', pulse: '', temp: '', rbs: '',
        treatment: '', disposition: 'Discharged OPD', wardBed: '', followUp: '',
    };
}

export interface FapRef {
    hidden: boolean;
    text: string;
    data: { familyCode?: string; village?: string; studentName?: string; studentRoll?: string };
}

interface Props {
    dialogRef: Ref<HTMLDialogElement>;
    title: string;
    form: RegForm;
    setField: (key: keyof RegForm, value: string) => void;
    fapRef: FapRef;
    submitting: boolean;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
    onClose: () => void;
}

export function RegistrationDialog({ dialogRef, title, form, setField, fapRef, submitting, onSubmit, onClose }: Props) {
    const bind = (key: keyof RegForm) => ({
        value: form[key],
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setField(key, e.target.value),
    });
    return (
        <dialog id="registrationModal" className="fap-dialog registration-dialog" aria-labelledby="regModalTitle" ref={dialogRef}>
            <div className="modal-heading"><div><div className="eyebrow">HOSPITAL PATIENT INTAKE &amp; REGISTRATION</div><h2 id="regModalTitle">{title}</h2></div><button className="icon-button" id="closeRegModal" aria-label="Close registration dialog" data-icon="close" onClick={onClose}><Icon name="close" /></button></div>
            <form id="registrationForm" className="reg-form" onSubmit={onSubmit}>
                <input type="hidden" id="regFamilyMemberId" name="family_member_id" value={form.familyMemberId} />
                <input type="hidden" id="regPatientId" name="patient_id" value={form.patientId} />
                <div className="reg-card"><div className="reg-card-header"><span className="card-step-num">1</span><h3>Patient Identification &amp; Demographics</h3></div><div className="form-grid">
                    <label>Full Patient Name *<input type="text" id="regPatientName" required placeholder="Patient full name" {...bind('patientName')} /></label>
                    <label>Contact Phone Number *<input type="tel" id="regContactNumber" placeholder="10-digit mobile number" {...bind('contactNumber')} /></label>
                    <label>Age (Years) *<input type="number" id="regAgeYears" min="0" max="120" placeholder="e.g. 45" {...bind('ageYears')} /></label>
                    <label>Gender *<select id="regGender" {...bind('gender')}><option value="M">Male</option><option value="F">Female</option><option value="Other">Other</option></select></label>
                    <label className="full">Address / Village / Ward<input type="text" id="regAddress" placeholder="Village name, street or residential address" {...bind('address')} /></label>
                    <div className="full fap-ref-box" id="regFapRefBox" hidden={fapRef.hidden}><span className="ref-badge">🏠 FAP Linked Record</span><span id="regFapInfo" data-family-code={fapRef.data.familyCode} data-village={fapRef.data.village} data-student-name={fapRef.data.studentName} data-student-roll={fapRef.data.studentRoll}>{fapRef.text}</span></div>
                </div></div>
                <div className="reg-card"><div className="reg-card-header"><span className="card-step-num">2</span><h3>Hospital Visit &amp; Department Routing</h3></div><div className="form-grid">
                    <label>Visit / Registration Date *<input type="date" id="regVisitDate" required {...bind('visitDate')} /></label>
                    <label>Department / OPD Unit *<select id="regDepartment" required {...bind('department')}><option value="General Medicine">General Medicine</option><option value="Cardiology">Cardiology</option><option value="Community Medicine / FAP Referral">Community Medicine / FAP Referral Clinic</option><option value="Pediatrics">Pediatrics</option><option value="Orthopedics">Orthopedics</option><option value="Obstetrics & Gynecology">Obstetrics &amp; Gynecology</option><option value="ENT">ENT (Ear, Nose, Throat)</option><option value="Dermatology">Dermatology</option><option value="Emergency / Casualty">Emergency / Casualty</option></select></label>
                    <label>Attending Medical Officer / Doctor<input type="text" id="regDoctor" placeholder="e.g. Dr. Ramesh Patel (Medical Superintendent)" {...bind('doctor')} /></label>
                    <label>Visit Type / Referral Source<select id="regVisitType" {...bind('visitType')}><option value="FAP Survey Referral">FAP Survey Referral (Student Surveyed)</option><option value="Routine OPD">Routine OPD Walk-in</option><option value="Chronic Disease Follow-up">Chronic Disease Follow-up</option><option value="Emergency">Emergency Triage</option><option value="Specialist Referral">Specialist Referral</option></select></label>
                </div></div>
                <div className="reg-card"><div className="reg-card-header"><span className="card-step-num">3</span><h3>Basic Registration Clinical Intake Questions</h3></div><div className="form-grid">
                    <label className="full">Primary Chief Complaint / Reason for Hospital Visit *<textarea id="regChiefComplaint" rows={2} required placeholder="What symptoms or reasons prompted the hospital visit? (e.g. Severe headache and dizziness for 3 days; routine follow-up for diabetes; chest pain upon exertion)" {...bind('chiefComplaint')}></textarea></label>
                    <label>Symptoms Duration<input type="text" id="regSymptomsDuration" placeholder="e.g. 3 days, 2 weeks, chronic" {...bind('symptomsDuration')} /></label>
                    <label>Known Chronic Conditions<input type="text" id="regExistingConditions" placeholder="e.g. Hypertension, Diabetes, Asthma, None" {...bind('existingConditions')} /></label>
                    <label>Known Drug Allergies<input type="text" id="regAllergies" placeholder="e.g. Penicillin, Sulfa, None known" {...bind('allergies')} /></label>
                    <label>Provisional Clinical Diagnosis<input type="text" id="regDiagnosis" placeholder="e.g. Essential Hypertension, Type 2 Diabetes, Acute Bronchitis" {...bind('diagnosis')} /></label>
                </div><h4 className="sub-heading">Triage Vital Signs at Registration</h4><div className="form-grid vitals-inputs-grid">
                    <label>Systolic BP (mmHg)<input type="number" id="regSbp" placeholder="e.g. 130" {...bind('sbp')} /></label>
                    <label>Diastolic BP (mmHg)<input type="number" id="regDbp" placeholder="e.g. 85" {...bind('dbp')} /></label>
                    <label>Pulse Rate (bpm)<input type="number" id="regPulse" placeholder="e.g. 76" {...bind('pulse')} /></label>
                    <label>Temperature (°F)<input type="number" step="0.1" id="regTemp" placeholder="e.g. 98.6" {...bind('temp')} /></label>
                    <label>Blood Sugar / RBS (mg/dL)<input type="number" id="regRbs" placeholder="e.g. 140" {...bind('rbs')} /></label>
                </div></div>
                <div className="reg-card"><div className="reg-card-header"><span className="card-step-num">4</span><h3>Treatment Plan &amp; Hospital Disposition</h3></div><div className="form-grid">
                    <label className="full">Prescribed Treatment / Medication Dispensed<textarea id="regTreatment" rows={2} placeholder="List medications, dosage, interventions, or lab orders given..." {...bind('treatment')}></textarea></label>
                    <label>Visit Disposition / Admission Status *<select id="regDisposition" {...bind('disposition')}><option value="Discharged OPD">Discharged OPD (Outpatient with Medication)</option><option value="Observation">Short Stay / Observation Unit</option><option value="Admitted to Ward">Admitted to Inpatient Ward</option><option value="Specialist Referral">Specialist Higher-Center Referral</option></select></label>
                    <label>Ward / Bed Number (if applicable)<input type="text" id="regWardBed" placeholder="e.g. Ward 4 - Bed 12" {...bind('wardBed')} /></label>
                    <label className="full">Follow-up Advice &amp; Next Steps<input type="text" id="regFollowUp" placeholder="e.g. Return in 7 days for BP review, SOS if dizziness recurs" {...bind('followUp')} /></label>
                </div></div>
                <div className="form-actions"><button type="button" className="button" id="cancelRegBtn" onClick={onClose}>Cancel</button><button type="submit" className="button primary" id="submitRegBtn" disabled={submitting}>{submitting ? 'Registering…' : <><IconSpan name="plus" />Complete Registration &amp; Generate Slip</>}</button></div>
            </form>
        </dialog>
    );
}
