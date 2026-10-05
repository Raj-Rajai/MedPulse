/** Visit slip body (openVisitSlip() in hospital-ui.js). */
import { genderLabel, shown, type Visit } from './api';

const SEP = '  |  ';

export function VisitSlip({ v, hospitalName, printedAt }: { v: Visit; hospitalName: string; printedAt: string }) {
    const ageGender = `${v.age_years ? `${v.age_years} yrs` : ''} / ${genderLabel(v.gender)}`;
    return (
        <>
            <div className="slip-header">
                <div>
                    <div className="slip-hospital-title">{hospitalName}</div>
                    <div style={{ fontSize: '11px', color: '#5c776b', marginTop: '2px' }}>Outpatient / Inpatient Registration Record · FAP Connected Care</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="slip-reg-num">{v.visit_uid}</div>
                    <div style={{ fontSize: '10px', color: '#769183', marginTop: '3px' }}>Date: <b>{shown(v.visit_date)}</b></div>
                </div>
            </div>

            <div className="slip-grid">
                <div className="slip-item">
                    <dt>Patient Full Name</dt>
                    <dd>{shown(v.patient_name)}</dd>
                </div>
                <div className="slip-item">
                    <dt>Age / Gender</dt>
                    <dd>{ageGender}</dd>
                </div>
                <div className="slip-item">
                    <dt>Contact Phone</dt>
                    <dd>{shown(v.contact_number)}</dd>
                </div>
                <div className="slip-item">
                    <dt>Department &amp; Doctor</dt>
                    <dd>{`${shown(v.department)} · ${shown(v.attending_doctor || 'Medical Officer')}`}</dd>
                </div>

                {v.family_code ? (
                    <div className="slip-item slip-full" style={{ background: '#f4f9f6', padding: '9px 12px', borderRadius: '6px', border: '1px solid #dbeae2' }}>
                        <dt style={{ color: '#087e72' }}>🏠 FAP Surveillance Linkage</dt>
                        <dd style={{ fontSize: '12px', color: '#184c3d' }}>
                            Family Code: <b>{shown(v.family_code)}</b> · Village: <b>{shown(v.village || v.address)}</b>
                            {v.student_name ? <>{' · Surveyor: '}<b>{`${shown(v.student_name)} (Roll ${shown(v.student_roll)})`}</b></> : null}
                        </dd>
                    </div>
                ) : null}

                <hr className="slip-divider" />

                <div className="slip-item slip-full">
                    <dt>Chief Complaint &amp; Symptom Duration</dt>
                    <dd>{shown(v.chief_complaint)} {v.symptoms_duration ? `(Duration: ${v.symptoms_duration})` : ''}</dd>
                </div>

                <div className="slip-item slip-full">
                    <dt>Triage Vital Signs</dt>
                    <dd style={{ fontSize: '12px', color: '#284a3e' }}>
                        BP: <b>{`${v.sbp || '--'}/${v.dbp || '--'} mmHg`}</b>{SEP}
                        Pulse: <b>{`${v.pulse || '--'} bpm`}</b>{SEP}
                        Temp: <b>{v.temperature ? `${v.temperature}°F` : '--'}</b>{SEP}
                        RBS: <b>{v.rbs ? `${v.rbs} mg/dL` : '--'}</b>
                    </dd>
                </div>

                <div className="slip-item">
                    <dt>Known Conditions</dt>
                    <dd>{shown(v.existing_conditions)}</dd>
                </div>
                <div className="slip-item">
                    <dt>Known Allergies</dt>
                    <dd>{shown(v.allergies)}</dd>
                </div>

                <hr className="slip-divider" />

                <div className="slip-item">
                    <dt>Provisional Clinical Diagnosis</dt>
                    <dd style={{ color: '#087e72' }}>{shown(v.diagnosis || 'Clinical evaluation')}</dd>
                </div>
                <div className="slip-item">
                    <dt>Disposition / Ward</dt>
                    <dd>{shown(v.disposition)} {v.ward_bed_no ? `(Bed: ${shown(v.ward_bed_no)})` : ''}</dd>
                </div>

                <div className="slip-item slip-full">
                    <dt>Prescribed Treatment / Medication Dispensed</dt>
                    <dd style={{ whiteSpace: 'pre-wrap' }}>{shown(v.treatment_prescribed || 'As per prescription slip')}</dd>
                </div>

                <div className="slip-item slip-full">
                    <dt>Follow-up Advice &amp; Next Steps</dt>
                    <dd>{shown(v.follow_up_advice || 'Return for review as directed')}</dd>
                </div>

                <hr className="slip-divider" />

                <div className="slip-item slip-full" style={{ fontSize: '10px', color: '#859c90', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Registered By: <b>{shown(v.registered_by_name || 'Hospital Admission Desk')}</b></span>
                    <span>{`Printed on: ${printedAt}`}</span>
                </div>
            </div>
        </>
    );
}
