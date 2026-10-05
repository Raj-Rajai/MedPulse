/** Registered hospital visits table (renderRegisteredTable() in hospital-ui.js). */
import type { ReactNode } from 'react';
import { genderClass, genderLabel, getInitials, shown, type Visit } from './api';

function Head() {
    return (
        <thead><tr>
            <th>Registration ID &amp; Patient</th>
            <th>Visit Date &amp; Dept</th>
            <th>Clinical Intake</th>
            <th>Vitals</th>
            <th>FAP Reference</th>
            <th>Disposition</th>
            <th>Slip</th>
        </tr></thead>
    );
}

function dispositionClass(d: string | null): string {
    if (d && d.includes('Admit')) return 'disposition-admitted';
    if (d === 'Observation') return 'disposition-observation';
    if (d && d.includes('Referral')) return 'disposition-referral';
    return 'disposition-discharged';
}

function VisitRow({ v, onSlip }: { v: Visit; onSlip: (id: number) => void }) {
    const ageLabel = v.age_years !== null && v.age_years !== undefined ? `${v.age_years}y` : '';
    const vitals: ReactNode[] = [];
    if (v.sbp || v.dbp) vitals.push(<>BP <b>{`${v.sbp || '-'}/${v.dbp || '-'}`}</b></>);
    if (v.pulse) vitals.push(<>Pulse <b>{v.pulse}</b></>);
    if (v.temperature) vitals.push(<>Temp <b>{`${v.temperature}°F`}</b></>);
    if (v.rbs) vitals.push(<>RBS <b>{v.rbs}</b></>);

    return (
        <tr>
            <td>
                <div className="patient-cell">
                    <div className={`patient-avatar ${genderClass(v.gender)}`}>{getInitials(v.patient_name)}</div>
                    <div className="patient-info">
                        <strong className="patient-name">{shown(v.patient_name)}</strong>
                        <div className="patient-meta-row">
                            <span className="fap-id-badge" style={{ background: '#eaf4f0', color: '#0d5c4e', borderColor: '#b9ded2' }}>{v.visit_uid}</span>
                            <span className="demographics-tag">{`${ageLabel} / ${genderLabel(v.gender)}`}</span>
                        </div>
                        <div className="patient-contact">{v.contact_number ? <span className="contact-num">{`📞 ${v.contact_number}`}</span> : <span className="contact-none">No phone</span>}</div>
                    </div>
                </div>
            </td>
            <td>
                <div>
                    <strong style={{ color: '#1e3c32', fontSize: '12px' }}>{shown(v.department)}</strong>
                    <div style={{ fontSize: '11px', color: '#5a766a', marginTop: '2px' }}>{`📅 ${shown(v.visit_date)}`}</div>
                    <div style={{ fontSize: '10px', color: '#789387', marginTop: '2px' }}>{`Dr: ${shown(v.attending_doctor || 'Staff MO')}`}</div>
                </div>
            </td>
            <td style={{ maxWidth: '220px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1d392e', lineHeight: 1.4 }}>{shown(v.chief_complaint || 'No complaint listed')}</div>
                {v.diagnosis ? <div style={{ fontSize: '11px', color: '#087e72', marginTop: '2px' }}>Dx: <b>{shown(v.diagnosis)}</b></div> : null}
                {v.symptoms_duration ? <div style={{ fontSize: '10px', color: '#769083' }}>{`Duration: ${shown(v.symptoms_duration)}`}</div> : null}
            </td>
            <td>
                <div className="vitals-strip">{vitals.length ? vitals.map((vp, i) => <span key={i} className="vital-chip">{vp}</span>) : <span className="vital-chip">None recorded</span>}</div>
            </td>
            <td>
                {v.family_code ? (
                    <div className="family-cell">
                        <span className="family-code-badge">{shown(v.family_code)}</span>
                        <div className="family-meta-row"><span className="dim-icon">📍</span> <span className="village-name">{shown(v.village || v.address)}</span></div>
                        {v.student_name ? <div style={{ fontSize: '10px', color: '#5d7b6f', marginTop: '1px' }}>{`By ${shown(v.student_name)} (Roll ${shown(v.student_roll)})`}</div> : null}
                    </div>
                ) : <span style={{ fontSize: '11px', color: '#779386' }}>Hospital direct</span>}
            </td>
            <td>
                <span className={`reg-badge-disposition ${dispositionClass(v.disposition)}`}>{shown(v.disposition)}</span>
                {v.ward_bed_no ? <div style={{ fontSize: '10px', fontWeight: 600, color: '#854d0e', marginTop: '3px' }}>{`🛏️ ${shown(v.ward_bed_no)}`}</div> : null}
            </td>
            <td>
                <button type="button" className="button action-open-btn" data-view-slip={v.id} aria-label={`View visit slip for ${v.patient_name}`} onClick={() => onSlip(v.id)}>
                    <span>Slip</span>
                    <span className="arrow-sym">📄</span>
                </button>
            </td>
        </tr>
    );
}

export function RegisteredTable({ visits, onSlip }: { visits: Visit[]; onSlip: (id: number) => void }) {
    if (!visits.length) {
        return (
            <table><Head /><tbody>
                <tr><td colSpan={7} className="empty">No registered hospital visits found. Click “+ Register Patient Visit” or register from the FAP Registry.</td></tr>
            </tbody></table>
        );
    }
    return <table><Head /><tbody>{visits.map((v) => <VisitRow key={v.id} v={v} onSlip={onSlip} />)}</tbody></table>;
}
