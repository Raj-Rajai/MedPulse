/**
 * Read-only views of family-manage.html: roster member cards (renderMembersCards), the segmented
 * member profile (selectMember + render*List) and the follow-up timeline (renderFollowUpsTimeline).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Allergy, Condition, FollowUp, HistoryItem, Lifestyle, Medication, MemberDetail, RosterMember } from './types';

const muted: CSSProperties = { fontSize: '0.825rem', color: 'var(--text-muted)' };
const capLabel: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, display: 'block' };
/** Interpolate like the original's template literals (undefined/null print as text). */
/** Missing fields show as a dash (the original printed the word "undefined"). */
const str = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : `${v}`);

export function MemberCards({ members, selectedId, onSelect }: { members: RosterMember[]; selectedId: number | null; onSelect: (id: number) => void }) {
    if (!members || members.length === 0) {
        return (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="mp-empty-icon" style={{ marginBottom: '0.6rem' }}>👤</div>
                <strong>No members found</strong>
                <p style={{ fontSize: '0.825rem', marginTop: '0.35rem' }}>Click <strong>"➕ Add Member"</strong> above to register household members.</p>
            </div>
        );
    }
    return (
        <>
            {members.map((m) => {
                const bpText = m.sbp && m.dbp ? `${m.sbp}/${m.dbp} mmHg` : null;
                const hbText = m.hb ? `Hb ${m.hb}` : null;
                const contact = m.contact_number ? ` • 📞 ${m.contact_number}` : '';
                const tags: ReactNode[] = [];
                const tag = (cls: string, text: string, key: string) => <span key={key} className={`badge ${cls}`}>{text}</span>;
                if (m.conditions_summary) {
                    m.conditions_summary.split(',').forEach((c, i) => {
                        const trimmed = c.trim();
                        if (trimmed) tags.push(tag('badge-warning', trimmed, 'c' + i));
                    });
                }
                if (m.has_htn === 'Y' && !m.conditions_summary?.includes('Hypertension')) tags.push(tag('badge-warning', 'HTN', 'htn'));
                if (m.has_dm === 'Y' && !m.conditions_summary?.includes('Diabetes')) tags.push(tag('badge-warning', 'DM', 'dm'));
                if (m.has_anaemia === 'Y') tags.push(tag('badge-danger', 'Anaemia', 'an'));
                if (Number(m.age_years) <= 5) tags.push(tag('badge-info', 'Under 5', 'u5'));
                if (m.anc_taken === 'Y') tags.push(tag('badge-success', 'ANC Reg', 'anc'));
                return (
                    <div key={m.id} className={`member-card ${m.id === selectedId ? 'active' : ''}`} id={`memberCard_${m.id}`} onClick={() => onSelect(m.id)}>
                        <div>
                            <div className="member-card-header">
                                <div>
                                    <div className="member-name">{m.name}</div>
                                    <div className="member-relation">{`${m.relation_to_hof || 'Member'} • ${m.age_years} yrs (${m.gender})${contact}`}</div>
                                    {m.added_by_patient_id
                                        ? <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', marginTop: '4px' }} title="Added by the family from the patient portal">✍ Added by family</span>
                                        : m.patient_updated_at
                                            ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.68rem', marginTop: '4px' }} title="Basic details were updated by the family from the patient portal">✍ Updated by family</span>
                                            : null}
                                </div>
                                <span className="badge badge-info">#{String(m.member_order)}</span>
                            </div>
                            <div className="member-tags">
                                {tags.length > 0
                                    ? tags.flatMap((t, i) => (i ? [' ', t] : [t]))
                                    : <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No recorded conditions</span>}
                            </div>
                        </div>
                        <div className="member-card-vitals">
                            <span>🩺 <strong>{bpText || 'BP: -'}</strong> • <strong>{hbText || 'Hb: -'}</strong> {m.bmi ? <>• BMI: <strong>{m.bmi}</strong></> : ''}</span>
                            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem' }}>Inspect →</span>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function Actions({ kind, id, onEdit, onDelete }: { kind: string; id: number; onEdit: (id: number) => void; onDelete: (id: number) => void }) {
    return (
        <div className="sub-item-actions">
            <button className="btn-icon" onClick={() => onEdit(id)} title={`Edit ${kind}`}>✏</button>
            <button className="btn-icon danger" onClick={() => onDelete(id)} title={`Delete ${kind}`}>🗑</button>
        </div>
    );
}

type Crud = { onEdit: (id: number) => void; onDelete: (id: number) => void };

export function ConditionsList({ items, onEdit, onDelete }: { items: Condition[] } & Crud) {
    if (!items || items.length === 0) return <div style={muted}>No conditions recorded for this member. Click "+ Add Condition" to record one.</div>;
    return (
        <>
            {items.map((c) => (
                <div className="sub-item-row" key={c.id}>
                    <div className="sub-item-content">
                        <div className="sub-item-main">
                            <span>{str(c.condition_name)}</span>
                            <span className={`badge ${c.status === 'Active' ? 'badge-danger' : 'badge-info'}`}>{str(c.status)}</span>
                            <span className="badge badge-warning">{str(c.severity)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>({c.category || 'General'})</span>
                        </div>
                        <div className="sub-item-meta">
                            {c.diagnosis_date ? <>Diagnosed: <strong>{c.diagnosis_date}</strong> • </> : null}
                            {c.notes ? <em>{c.notes}</em> : 'No additional notes'}
                        </div>
                    </div>
                    <Actions kind="condition" id={c.id} onEdit={onEdit} onDelete={onDelete} />
                </div>
            ))}
        </>
    );
}

export function MedicationsList({ items, onEdit, onDelete }: { items: Medication[] } & Crud) {
    if (!items || items.length === 0) return <div style={muted}>No medications recorded for this member. Click "+ Add Medication" to log prescription.</div>;
    return (
        <>
            {items.map((m) => (
                <div className="sub-item-row" key={m.id}>
                    <div className="sub-item-content">
                        <div className="sub-item-main">
                            <span>💊 {str(m.medication_name)}</span>
                            {m.dosage ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({m.dosage})</span> : null}
                            <span className="badge badge-info">{m.frequency || 'OD'}</span>
                            <span className={`badge ${m.adherence_status === 'Good' ? 'badge-success' : 'badge-warning'}`}>{str(m.adherence_status)}</span>
                        </div>
                        <div className="sub-item-meta">
                            Route: <strong>{m.route || 'Oral'}</strong> •{' '}
                            {m.prescribed_for ? <>Indication: <em>{m.prescribed_for}</em> • </> : null}
                            {m.start_date ? `Started: ${m.start_date}` : ''}
                        </div>
                    </div>
                    <Actions kind="medication" id={m.id} onEdit={onEdit} onDelete={onDelete} />
                </div>
            ))}
        </>
    );
}

export function AllergiesList({ items, onEdit, onDelete }: { items: Allergy[] } & Crud) {
    if (!items || items.length === 0) return <div style={muted}>No allergies recorded for this member. Click "+ Add Allergy" to record.</div>;
    return (
        <>
            {items.map((a) => (
                <div className="sub-item-row" key={a.id}>
                    <div className="sub-item-content">
                        <div className="sub-item-main">
                            <span>⚠ {str(a.allergen)}</span>
                            <span className="badge badge-info">{str(a.allergy_type)}</span>
                            <span className={`badge ${a.severity === 'Severe' || a.severity === 'Life-threatening' ? 'badge-danger' : 'badge-warning'}`}>{str(a.severity)}</span>
                        </div>
                        <div className="sub-item-meta">
                            Reaction: <strong>{a.reaction_description || 'Unspecified allergic reaction'}</strong>
                        </div>
                    </div>
                    <Actions kind="allergy" id={a.id} onEdit={onEdit} onDelete={onDelete} />
                </div>
            ))}
        </>
    );
}

export function HistoryList({ items, onEdit, onDelete }: { items: HistoryItem[] } & Crud) {
    if (!items || items.length === 0) return <div style={muted}>No surgical or past medical events recorded. Click "+ Add History" to log past procedures.</div>;
    return (
        <>
            {items.map((h) => (
                <div className="sub-item-row" key={h.id}>
                    <div className="sub-item-content">
                        <div className="sub-item-main">
                            <span>📜 {str(h.description)}</span>
                            <span className="badge badge-info">{str(h.event_type)}</span>
                            {h.event_date ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({h.event_date})</span> : null}
                        </div>
                        <div className="sub-item-meta">
                            {h.facility_name ? <>Facility: <strong>{h.facility_name}</strong> • </> : null}
                            {h.outcome_notes ? <>Notes: <em>{h.outcome_notes}</em></> : 'No post-op notes'}
                        </div>
                    </div>
                    <Actions kind="history" id={h.id} onEdit={onEdit} onDelete={onDelete} />
                </div>
            ))}
        </>
    );
}

export function LifestyleView({ lifestyle }: { lifestyle: Lifestyle | null | undefined }) {
    if (!lifestyle) return <div style={{ color: 'var(--text-muted)' }}>No lifestyle information recorded yet. Click "✏ Edit Lifestyle" to record smoking, alcohol, exercise, and diet.</div>;
    const l = lifestyle;
    return (
        <>
            <div><span style={capLabel}>Tobacco / Smoking</span><strong>{l.smoking_status || 'Never'}</strong> {l.smoking_frequency ? `(${l.smoking_frequency})` : ''}</div>
            <div><span style={capLabel}>Alcohol</span><strong>{l.alcohol_consumption || 'Never'}</strong></div>
            <div><span style={capLabel}>Diet Type</span><span>{l.diet_type || 'Vegetarian'}</span></div>
            <div><span style={capLabel}>Activity Level</span><span>{l.physical_activity_level || 'Moderate'}</span></div>
            <div><span style={capLabel}>Salt Intake</span><span>{l.salt_intake || 'Normal'}</span></div>
            <div><span style={capLabel}>Sleep Hours</span><span>{l.sleep_hours_per_night ? `${l.sleep_hours_per_night} hrs/night` : 'Unrecorded'}</span></div>
            {l.notes ? <div style={{ gridColumn: '1 / -1' }}><span style={capLabel}>Counseling / Lifestyle Notes</span><em>{l.notes}</em></div> : null}
        </>
    );
}

export function Demographics({ m }: { m: MemberDetail }) {
    return (
        <>
            <div><span style={capLabel}>Date of Birth</span><strong>{m.date_of_birth || 'Not recorded'}</strong></div>
            <div><span style={capLabel}>Age / Gender</span><strong>{`${m.age_years} yrs (${m.gender})`}</strong></div>
            <div><span style={capLabel}>Marital Status</span><span>{m.marital_status || 'NA'}</span></div>
            <div><span style={capLabel}>Education</span><span>{m.education_level || 'NA'}</span></div>
            <div><span style={capLabel}>Occupation</span><span>{m.occupation || 'NA'}</span></div>
            <div><span style={capLabel}>Contact Phone</span><span>{m.contact_number || m.contact_phone || 'None'}</span></div>
            <div><span style={capLabel}>Physical Activity</span><span>{m.work_type || 'Moderate'}</span></div>
        </>
    );
}

export function Vitals({ m }: { m: MemberDetail }) {
    return (
        <>
            <span className="calc-preview">BP: <strong>{m.sbp && m.dbp ? `${m.sbp}/${m.dbp} mmHg` : 'Unmeasured'}</strong></span>
            <span className="calc-preview">RBS: <strong>{m.rbs ? `${m.rbs} mg/dl` : 'Untested'}</strong></span>
            <span className="calc-preview">Hb: <strong>{m.hb ? `${m.hb} g/dl` : 'Untested'}</strong></span>
            <span className="calc-preview">BMI: <strong>{m.bmi || 'Uncalculated'}</strong></span>
            {m.muac_cm ? <span className="calc-preview">MUAC: <strong>{`${m.muac_cm} cm`}</strong></span> : null}
            <span className="calc-preview">Oral Hygiene: <strong>{m.oral_hygiene || 'Y'}</strong></span>
            <span className="calc-preview">General Hygiene: <strong>{m.general_hygiene || 'Y'}</strong></span>
        </>
    );
}

export function Baseline({ m }: { m: MemberDetail }) {
    return (
        <>
            <strong>Primary Diagnosis:</strong> {m.diagnosis || 'None reported'}<br />
            <strong>Treatment Taken:</strong> {`${m.treatment_taken || 'NA'} (${m.treatment_source || 'No facility noted'})`}<br />
            {Number(m.age_years) <= 5 ? (
                <><strong>Pediatric Nutrition:</strong> {`HC: ${m.hc_cm || '-'} cm, CC: ${m.cc_cm || '-'} cm, Underweight: ${m.is_underweight}, Stunting: ${m.is_stunting}, Wasting: ${m.is_wasting}, Mamta Card: ${m.mamta_card}, Immunization: ${m.immunization_status}`}<br /></>
            ) : null}
            {m.gender === 'F' && m.anc_taken !== 'NA' ? (
                <><strong>Maternal Care:</strong> {`ANC: ${m.anc_taken}, Delivery Place: ${m.delivery_place}, PNC: ${m.pnc_taken}, FP Method: ${m.fp_method_used}`}<br /></>
            ) : null}
            <strong>Surveyed By:</strong> {`Roll ${m.student_roll || '-'} (${m.student_name || 'Student'})`}
        </>
    );
}

export function Timeline({ followUps, onDelete }: { followUps: FollowUp[]; onDelete: (id: number) => void }) {
    if (!followUps || followUps.length === 0) {
        return (
            <div style={{ background: 'var(--bg-subtle)', border: '1.5px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No follow-up visits recorded yet for this patient.<br />
                Click <strong>"+ Log New Visit"</strong> above to record an examination visit.
            </div>
        );
    }
    return (
        <div className="timeline">
            {followUps.map((fu) => {
                let progressBadge = <span className="badge badge-info">Stable</span>;
                if (fu.health_progress === 'Improved') progressBadge = <span className="badge badge-success">Improved</span>;
                if (fu.health_progress === 'Deteriorated') progressBadge = <span className="badge badge-danger">Deteriorated</span>;
                return (
                    <div className="timeline-item" key={fu.id}>
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                            <div className="timeline-header">
                                <div>
                                    <strong style={{ color: 'var(--primary)' }}>Visit #{String(fu.visit_number)}</strong>{' • '}
                                    <span className="timeline-date">{str(fu.visit_date)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                    {progressBadge}
                                    <span className="badge badge-info">Compliance: {str(fu.treatment_compliance)}</span>
                                    <button onClick={() => onDelete(fu.id)} title="Delete visit" style={{ background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.15rem 0.35rem' }}>✕</button>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.825rem', margin: '0.4rem 0', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                {fu.sbp && fu.dbp ? <span>BP: <strong>{`${fu.sbp}/${fu.dbp} mmHg`}</strong></span> : null}
                                {fu.rbs ? <span>RBS: <strong>{`${fu.rbs} mg/dl`}</strong></span> : null}
                                {fu.hb ? <span>Hb: <strong>{`${fu.hb} g/dl`}</strong></span> : null}
                                {fu.weight_kg ? <span>Weight: <strong>{`${fu.weight_kg} kg`}</strong></span> : null}
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.4rem', background: 'var(--bg-subtle)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                📝 <em>"{str(fu.clinical_notes)}"</em>
                            </p>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Recorded by: Roll {fu.recorded_by_roll || '-'}</span>
                                {fu.next_visit_date ? <span>📅 Next Visit: <strong>{fu.next_visit_date}</strong></span> : null}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
