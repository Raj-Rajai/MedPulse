/** "Overall Summary" card of profile.html (renderProfileAttendance). */

interface Part { total?: number; attended?: number; percentage?: number; met?: boolean }
export interface SubjectRow {
    subject?: string;
    faculty_name?: string;
    total: number;
    attended?: number;
    overall_percentage?: number;
    nmc_status?: string;
    theory?: Part;
    practical?: Part;
}
export interface SubjectWiseData {
    summary?: Record<string, number | string | undefined>;
    overall_summary?: Record<string, number | string | undefined>;
    theory?: Part;
    practical?: Part;
    subjects?: SubjectRow[];
}

const cell = { padding: '12px 14px' } as const;

function Kpis({ v }: { v: ReturnType<typeof compute> | null }) {
    // Before any class has been marked there is nothing to judge, so no colours and no verdict.
    const hasClasses = !!v && v.totSessions > 0;
    const statusColor = !v || !hasClasses ? '#059669' : v.nmcStatus === 'Eligible' ? '#059669' : v.nmcStatus === 'Warning' ? '#d97706' : '#dc2626';
    const status = !v ? '--' : !hasClasses ? 'Not started' : v.nmcStatus === 'Eligible' ? 'Eligible' : 'At risk';
    const statusNote = !v || !hasClasses ? 'Shown once attendance is marked' : v.nmcStatus === 'Eligible' ? 'Meets the attendance minimum' : 'Below the attendance minimum';
    return (
        <div className="profile-att-kpis-strip">
            <div className="prof-att-kpi-box">
                <div className="prof-att-kpi-label">Overall</div>
                <div className="prof-att-kpi-val" id="profAttOverallPct" style={v ? { color: v.overallPct >= 75 ? '#10b981' : v.overallPct >= 65 ? '#f59e0b' : '#ef4444' } : undefined}>{v ? v.overallPct + '%' : '--%'}</div>
                <div className="prof-att-kpi-sub" id="profAttTotalFraction">{v ? `${v.attSessions} of ${v.totSessions} sessions` : '-- sessions'}</div>
            </div>
            <div className="prof-att-kpi-box">
                <div className="prof-att-kpi-label" style={{ color: '#0284c7' }}>Theory</div>
                <div className="prof-att-kpi-val" style={{ color: '#0284c7' }} id="profAttTheoryPct">{v ? v.thPct + '%' : '--%'}</div>
                <div className="prof-att-kpi-sub" id="profAttTheoryFraction">{v ? `${v.thAtt} of ${v.thTot} · min 75%` : 'min 75%'}</div>
            </div>
            <div className="prof-att-kpi-box">
                <div className="prof-att-kpi-label" style={{ color: '#7c3aed' }}>Practicals</div>
                <div className="prof-att-kpi-val" style={{ color: '#7c3aed' }} id="profAttPracticalPct">{v ? v.prPct + '%' : '--%'}</div>
                <div className="prof-att-kpi-sub" id="profAttPracticalFraction">{v ? `${v.prAtt} of ${v.prTot} · min 80%` : 'min 80%'}</div>
            </div>
            <div className="prof-att-kpi-box highlight">
                <div className="prof-att-kpi-label" style={{ color: '#059669' }}>Exam eligibility</div>
                <div className="prof-att-kpi-val" style={{ color: statusColor }} id="profAttComplianceText">{status}</div>
                <div className="prof-att-kpi-sub">{statusNote}</div>
            </div>
        </div>
    );
}

function compute(data: SubjectWiseData) {
    const summary = data.summary || data.overall_summary || {};
    const theory = data.theory || {};
    const practical = data.practical || {};
    const subjects = (data.subjects || []).filter((s) => s.total > 0);
    let thTot = theory.total || 0;
    let thAtt = theory.attended || 0;
    let prTot = practical.total || 0;
    let prAtt = practical.attended || 0;
    for (const s of subjects) {
        if (!theory.total && s.theory) {
            thTot += s.theory.total || 0;
            thAtt += s.theory.attended || 0;
        }
        if (!practical.total && s.practical) {
            prTot += s.practical.total || 0;
            prAtt += s.practical.attended || 0;
        }
    }
    const num = (x: unknown) => x as number;
    const totSessions = num(summary.total_sessions || summary.total_classes || thTot + prTot);
    const attSessions = num(summary.attended_sessions || summary.attended_classes || thAtt + prAtt);
    const overallPct = summary.overall_percentage !== undefined ? num(summary.overall_percentage) : totSessions > 0 ? parseFloat(((attSessions / totSessions) * 100).toFixed(1)) : 0;
    const thPct = theory.percentage !== undefined ? theory.percentage : thTot > 0 ? parseFloat(((thAtt / thTot) * 100).toFixed(1)) : 0;
    const prPct = practical.percentage !== undefined ? practical.percentage : prTot > 0 ? parseFloat(((prAtt / prTot) * 100).toFixed(1)) : 0;
    const nmcStatus = summary.nmc_status || (overallPct >= 75 && thPct >= 75 && prPct >= 80 ? 'Eligible' : 'Warning');
    return { subjects, thTot, thAtt, prTot, prAtt, totSessions, attSessions, overallPct, thPct, prPct, nmcStatus };
}

function PartCell({ p }: { p?: Part; color?: string }) {
    return p && (p.total || 0) > 0 ? (
        <span style={{ fontWeight: 700 }}>{`${p.attended} / ${p.total}`}</span>
    ) : (
        <span style={{ color: '#94a3b8' }}>—</span>
    );
}

export function OverallAttendance({ data }: { data: SubjectWiseData | 'loading' | 'error' }) {
    const v = typeof data === 'object' ? compute(data) : null;
    let body;
    if (data === 'loading') {
        body = (
            <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>Loading overall attendance...</td>
            </tr>
        );
    } else if (data === 'error') {
        body = (
            <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#ef4444' }}>Failed to load attendance records.</td>
            </tr>
        );
    } else if (v && v.subjects.length === 0) {
        body = (
            <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No attendance records found for current academic year.</td>
            </tr>
        );
    } else if (v) {
        body = v.subjects.map((s, i) => {
            const pct = s.overall_percentage || 0;
            const pctColor = pct >= 75 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444';
            return (
                <tr key={i}>
                    <td style={{ fontWeight: 750, color: 'var(--text-primary)' }}>{s.subject || ''}</td>
                    <td style={{ color: '#475569', fontSize: '0.8rem' }}>{s.faculty_name || 'Faculty Member'}</td>
                    <td style={{ textAlign: 'center' }}><PartCell p={s.theory} color="#0284c7" /></td>
                    <td style={{ textAlign: 'center' }}><PartCell p={s.practical} color="#7c3aed" /></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#1e1b4b' }}>{`${s.attended} / ${s.total}`}</td>
                    <td style={{ textAlign: 'center', fontWeight: 850, color: pctColor }}>{`${s.overall_percentage}%`}</td>
                    <td style={{ textAlign: 'center' }}>
                        {s.nmc_status === 'Eligible' ? (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>✅ Eligible</span>
                        ) : s.nmc_status === 'Warning' ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>⚠ Warning</span>
                        ) : (
                            <span className="badge badge-danger" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>❌ Shortage</span>
                        )}
                    </td>
                </tr>
            );
        });
    }
    const showFoot = !!v && v.subjects.length > 0;
    return (
        <div className="datewise-container-card" style={{ marginBottom: '0' }}>
            <div className="datewise-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                <h2>Summary</h2>
                <a href="/schedule.html" style={{ color: '#ffffff', opacity: '0.92', fontSize: '0.8rem', fontWeight: '650', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Schedule</span>
                    <span>→</span>
                </a>
            </div>
            <div className="datewise-body-content">
                <Kpis v={v} />
                <div className="table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', overflowX: 'auto', marginTop: '14px' }}>
                    <table className="profile-att-table" id="profileAttendanceTable">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '240px' }}>Subject Name</th>
                                <th style={{ minWidth: '180px' }}>Faculty In-Charge</th>
                                <th style={{ textAlign: 'center', width: '140px' }}>Theory</th>
                                <th style={{ textAlign: 'center', width: '140px' }}>Practical</th>
                                <th style={{ textAlign: 'center', width: '130px' }}>Total Attended</th>
                                <th style={{ textAlign: 'center', width: '100px' }}>Overall %</th>
                                <th style={{ textAlign: 'center', width: '120px' }}>NMC Status</th>
                            </tr>
                        </thead>
                        <tbody id="profileAttendanceTableBody">{body}</tbody>
                        <tfoot id="profileAttendanceTableFoot" style={{ display: showFoot ? 'table-row-group' : 'none', background: '#f8fafc', fontWeight: '750', borderTop: '2px solid #e2e8f0' }}>
                            {showFoot && v ? (
                                <tr>
                                    <td style={{ ...cell, color: '#1e1b4b', fontWeight: 800 }}>Total Aggregate Attendance</td>
                                    <td style={{ ...cell, color: '#64748b', fontSize: '0.78rem' }}>Current Year Subjects Combined</td>
                                    <td style={{ ...cell, textAlign: 'center', color: '#0284c7', fontWeight: 800 }}>{v.thTot > 0 ? `${v.thAtt} / ${v.thTot}` : '—'}</td>
                                    <td style={{ ...cell, textAlign: 'center', color: '#7c3aed', fontWeight: 800 }}>{v.prTot > 0 ? `${v.prAtt} / ${v.prTot}` : '—'}</td>
                                    <td style={{ ...cell, textAlign: 'center', color: '#1e1b4b', fontWeight: 850 }}>{`${v.attSessions} / ${v.totSessions}`}</td>
                                    <td style={{ ...cell, textAlign: 'center', fontWeight: 900, color: v.overallPct >= 75 ? '#10b981' : '#ef4444', fontSize: '0.95rem' }}>{`${v.overallPct}%`}</td>
                                    <td style={{ ...cell, textAlign: 'center' }}>
                                        <span className={`badge ${v.nmcStatus === 'Eligible' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.74rem', padding: '4px 10px' }}>
                                            {v.nmcStatus === 'Eligible' ? '✅ ' + v.nmcStatus : '⚠ ' + v.nmcStatus}
                                        </span>
                                    </td>
                                </tr>
                            ) : null}
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
