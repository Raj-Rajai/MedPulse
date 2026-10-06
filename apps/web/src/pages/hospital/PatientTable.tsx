/** FAP registry table (renderTable() in hospital-ui.js). */
import type { ReactNode } from 'react';
import { type FapPatient, genderClass, genderLabel, getInitials, shown } from './api';

function Head() {
    return (
        <thead><tr>
            <th>Patient / FAP record</th>
            <th>Family &amp; location</th>
            <th>Surveying student</th>
            <th>Recorded indicators</th>
            <th>Follow-up</th>
            <th>Record &amp; Action</th>
        </tr></thead>
    );
}

interface Props {
    patients: FapPatient[];
    onOpen: (id: number) => void;
    onRegister: (id: number) => void;
}

function ConditionTags({ p }: { p: FapPatient }) {
    const tags: ReactNode[] = [];
    if (p.has_htn === 'Y') tags.push(<span key="htn" className="cond-tag cond-htn" title="Hypertension Screened">HTN</span>);
    if (p.has_dm === 'Y') tags.push(<span key="dm" className="cond-tag cond-dm" title="Diabetes Mellitus Screened">DM</span>);
    if (p.has_anaemia === 'Y') tags.push(<span key="an" className="cond-tag cond-anaemia" title="Anaemia Detected">Anaemia</span>);
    if (p.conditions_summary) {
        const customs = p.conditions_summary.split(',').map((s) => s.trim()).filter(Boolean);
        customs.forEach((c, i) => {
            if (!['Hypertension', 'Diabetes', 'Anaemia'].includes(c)) {
                tags.push(<span key={'c' + i} className="cond-tag cond-other" title={c}>{c}</span>);
            }
        });
    }
    return <div className="condition-tags-row">{tags.length ? tags : <span className="cond-tag cond-none">No flagged conditions</span>}</div>;
}

function PatientRow({ p, onOpen, onRegister }: { p: FapPatient } & Omit<Props, 'patients'>) {
    const ageLabel = p.age_years !== null && p.age_years !== undefined ? `${p.age_years}y${p.age_months ? ` ${p.age_months}m` : ''}` : 'Age unrecorded';
    const { sbp, dbp, rbs, hb } = p;
    const isHtnAlert = Boolean((sbp && Number(sbp) >= 140) || (dbp && Number(dbp) >= 90));
    const isDmAlert = Boolean(rbs && Number(rbs) >= 140);
    const isHbAlert = Boolean(hb && ((p.gender === 'F' && Number(hb) < 11) || (p.gender === 'M' && Number(hb) < 12) || Number(hb) < 11));
    const followUps = Number(p.follow_up_count) || 0;

    return (
        <tr>
            <td>
                <div className="patient-cell">
                    <div className={`patient-avatar ${genderClass(p.gender)}`}>{getInitials(p.name)}</div>
                    <div className="patient-info">
                        <strong className="patient-name">{shown(p.name)}</strong>
                        <div className="patient-meta-row">
                            <span className="fap-id-badge">{`FAP-${p.id}`}</span>
                            <span className="demographics-tag">{`${ageLabel} / ${genderLabel(p.gender)}`}</span>
                        </div>
                        <div className="patient-contact">{p.contact_number ? <span className="contact-num">{`📞 ${p.contact_number}`}</span> : <span className="contact-none">No phone recorded</span>}</div>
                    </div>
                </div>
            </td>
            <td>
                <div className="family-cell">
                    <span className="family-code-badge">{shown(p.family_code || `Family ${p.family_id}`)}</span>
                    <div className="family-meta-row"><span className="dim-label">Head:</span> <span className="head-name">{shown(p.head_of_family)}</span></div>
                    <div className="family-meta-row"><span className="dim-icon">📍</span> <span className="village-name">{shown(p.village)}</span></div>
                </div>
            </td>
            <td>
                <div className="student-cell">
                    <div className="student-name">{`👨‍⚕ ${shown(p.student_name)}`}</div>
                    <div className="student-sub">
                        <span className="roll-badge">{`Roll ${shown(p.student_roll)}`}</span>
                        <span className="college-abbr" title={String(p.university_name || '')}>{shown(p.university_name)}</span>
                    </div>
                </div>
            </td>
            <td className="wrap-cell clinical-cell">
                <ConditionTags p={p} />
                <div className="vitals-strip">
                    <span className={`vital-chip ${isHtnAlert ? 'vital-alert' : ''}`} title="Blood Pressure (SBP/DBP)">BP <b>{`${shown(p.sbp)} / ${shown(p.dbp)}`}</b></span>
                    <span className={`vital-chip ${isDmAlert ? 'vital-alert' : ''}`} title="Random Blood Sugar (mg/dL)">RBS <b>{shown(p.rbs)}</b></span>
                    {hb ? <span className={`vital-chip ${isHbAlert ? 'vital-alert' : ''}`} title="Haemoglobin (g/dL)">Hb <b>{hb}</b></span> : null}
                </div>
            </td>
            <td>
                <div className="followup-cell">
                    {followUps > 0 ? (
                        <><div className="followup-pill visited"><span className="dot-status green"></span>{`${followUps} visit${followUps > 1 ? 's' : ''}`}</div><div className="followup-date">{`Last: ${shown(p.last_visit)}`}</div></>
                    ) : (
                        <><div className="followup-pill pending"><span className="dot-status amber"></span>Needs follow-up</div><div className="followup-date pending-text">0 visits recorded</div></>
                    )}
                </div>
            </td>
            <td>
                <div className="actions-cell">
                    <button className="button action-open-btn" data-patient={p.id} aria-label={`Open FAP record for ${p.name}`} onClick={() => onOpen(p.id)}>
                        <span>Open</span>
                        <span className="arrow-sym">→</span>
                    </button>
                    <button type="button" className="button action-register-btn" data-register-patient={p.id} aria-label={`Register hospital visit for ${p.name}`} onClick={() => onRegister(p.id)}>
                        <span>+ Register</span>
                    </button>
                </div>
            </td>
        </tr>
    );
}

export function PatientTable({ patients, onOpen, onRegister }: Props) {
    if (!patients.length) {
        return (
            <table><Head /><tbody>
                <tr><td colSpan={6} className="empty">No matching FAP records. Try another name, family, village or student, or clear the filters.</td></tr>
            </tbody></table>
        );
    }
    return (
        <table><Head /><tbody>{patients.map((p) => <PatientRow key={p.id} p={p} onOpen={onOpen} onRegister={onRegister} />)}</tbody></table>
    );
}
