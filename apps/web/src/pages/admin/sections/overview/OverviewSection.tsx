import type { CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import { datePart } from '../../lib/http';
import type { AdminStats } from '../../types';

const h2Style: CSSProperties = { fontSize: '1.15rem', fontWeight: 750, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const burdenLabel: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' };
const burdenSub: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-secondary)' };
const streamHeading: CSSProperties = { fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' };

function KpiCard({ cls, title, icon, id, value, children }: { cls: string; title: string; icon: string; id: string; value: string | number; children: React.ReactNode }) {
    return (
        <div className={`kpi-card ${cls}`}>
            <div className="kpi-header">
                <span className="kpi-title">{title}</span>
                <span className="kpi-icon">{icon}</span>
            </div>
            <div className="kpi-value" id={id}>{value}</div>
            <div className="kpi-sub">{children}</div>
        </div>
    );
}

function BurdenCard({ cls, label, color, id, value, sub }: { cls: string; label: string; color: string; id: string; value: number; sub: string }) {
    return (
        <div className={`burden-card ${cls}`}>
            <div style={burdenLabel}>{label}</div>
            <div className="burden-num" style={{ color }} id={id}>{value}</div>
            <div style={burdenSub}>{sub}</div>
        </div>
    );
}

function ActivityStream({ stats }: { stats: AdminStats | null }) {
    if (!stats) {
        return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading activity stream...</div>;
    }
    const fams = stats.recent_families || [];
    const fus = stats.recent_followups || [];
    if (fams.length === 0 && fus.length === 0) {
        return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No field activity recorded yet.</div>;
    }
    return (
        <>
            {fams.length > 0 && (
                <>
                    <div style={streamHeading}>Recent Household Registrations</div>
                    {fams.map((f, i) => (
                        <div className="activity-stream-item" key={'f' + i}>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{f.head_of_family || ''}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    🏡 {f.village || 'Field Block'} • {f.members_count || 0} Members
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Roll {f.roll_number || ''}</span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{datePart(f.created_at)}</div>
                            </div>
                        </div>
                    ))}
                </>
            )}
            {fus.length > 0 && (
                <>
                    <div style={{ ...streamHeading, margin: '16px 0 8px' }}>Recent Clinical Follow-ups</div>
                    {fus.map((fu, i) => (
                        <div className="activity-stream-item" key={'u' + i}>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{fu.member_name || ''}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    🩺 Visit {fu.visit_number} • Progress: <strong style={{ color: '#047857' }}>{fu.health_progress || 'Stable'}</strong>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Roll {fu.roll_number || ''}</span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{fu.visit_date || ''}</div>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </>
    );
}

/** VIEW 1: Executive overview dashboard (loadOverviewStats). */
export function OverviewSection({ active, stats }: { active: boolean; stats: AdminStats | null }) {
    const o = stats?.overview;
    const b = stats?.burden;
    return (
        <div id="viewOverview" className={`admin-view-pane${active ? ' active' : ''}`}>
            {/* 4 Top Executive KPI Cards */}
            <div className="kpi-grid anim-fade-up anim-delay-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 24 }}>
                <KpiCard cls="kpi-gold" title="Medical Cadets" icon="👨‍⚕️" id="kpiTotalStudents" value={o ? o.total_students : '-'}>
                    <span id="kpiActiveStudentsPill" className="badge badge-success" style={{ fontSize: '0.72rem' }}>{o ? o.active_students : 0} Active</span>
                    <span style={{ marginLeft: 4 }}>Registered</span>
                </KpiCard>
                <KpiCard cls="kpi-purple" title="Surveyed Households" icon="🏡" id="kpiTotalFamilies" value={o ? o.total_families : '-'}>
                    <span>Community Catchment Units</span>
                </KpiCard>
                <KpiCard cls="kpi-blue" title="Enrolled Population" icon="👥" id="kpiTotalMembers" value={o ? o.total_members : '-'}>
                    <span>Individuals Screened</span>
                </KpiCard>
                <KpiCard cls="kpi-emerald" title="Follow-Up Encounters" icon="🩺" id="kpiTotalFollowups" value={o ? o.total_followups : '-'}>
                    <span>Longitudinal Interventions</span>
                </KpiCard>
            </div>

            {/* 2-Column Responsive Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, marginBottom: 24 }} className="admin-grid-2col">
                {/* Left: Catchment Disease Burden & Colleges Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Epidemiological Disease Burden Card */}
                    <div className="card anim-fade-up anim-delay-2">
                        <h2 style={h2Style}>
                            <span>🩺 Catchment Epidemiological Burden</span>
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Screening Metrics</span>
                        </h2>
                        <p className="card-desc">
                            Consolidated health burden detected by student cadres during community field visits.
                        </p>
                        <div className="burden-grid">
                            <BurdenCard cls="burden-htn" label="Hypertension (HTN)" color="#ef4444" id="statHtn" value={b ? b.total_htn : 0} sub="Adult BP ≥ 140/90 mmHg" />
                            <BurdenCard cls="burden-dm" label="Type 2 Diabetes (DM)" color="#d97706" id="statDm" value={b ? b.total_dm : 0} sub="Random Sugar ≥ 200 mg/dL" />
                            <BurdenCard cls="burden-anaemia" label="Anaemia Burden" color="#7c3aed" id="statAnaemia" value={b ? b.total_anaemia : 0} sub="Hb < 12.0 g/dL or Pallor" />
                            <BurdenCard cls="burden-malnutrition" label="Pediatric Malnutrition" color="#0284c7" id="statMalnutrition" value={b ? b.total_malnutrition : 0} sub="Stunting / Wasting (0-5 Yrs)" />
                        </div>
                    </div>

                    {/* Institutional Distribution Card */}
                    <div className="card anim-fade-up anim-delay-3">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                                🏥 Institutional Distribution
                            </h2>
                            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>SAL Campus</span>
                        </div>
                        <div className="table-wrapper">
                            <table style={{ fontSize: '0.825rem' }}>
                                <thead>
                                    <tr>
                                        <th>Medical Institution</th>
                                        <th>Code</th>
                                        <th>Cadets</th>
                                        <th>Households</th>
                                    </tr>
                                </thead>
                                <tbody id="overviewCollegesTbody">
                                    {!stats ? (
                                        <MessageRow colSpan={4} padding={16}>Loading colleges...</MessageRow>
                                    ) : stats.colleges && stats.colleges.length > 0 ? (
                                        stats.colleges.map((c) => (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{c.name || ''}</td>
                                                <td><code>{c.code || ''}</code></td>
                                                <td><span className="badge badge-primary">{c.students_count} Cadets</span></td>
                                                <td><span className="badge badge-success">{c.families_count} Families</span></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <MessageRow colSpan={4} padding={16}>No institutions registered</MessageRow>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Real-Time Field Activity Stream */}
                <div className="card anim-fade-up anim-delay-2" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={h2Style}>
                        <span>⚡ Real-Time Field Submissions</span>
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Live Roster</span>
                    </h2>
                    <p className="card-desc">
                        Stream of newly registered households and clinical follow-up encounters across all cadres.
                    </p>
                    <div style={{ marginTop: 10, flex: 1 }} id="overviewActivityStream">
                        <ActivityStream stats={stats} />
                    </div>
                </div>
            </div>
        </div>
    );
}
