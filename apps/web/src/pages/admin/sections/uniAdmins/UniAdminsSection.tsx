import type { CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import type { QuotaView } from '../../hooks/useAdminData';
import { datePart } from '../../lib/http';
import type { CollegeStat, UniAdmin } from '../../types';

const quotaBox: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' };
const quotaLabel: CSSProperties = { fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' };
const quotaFoot: CSSProperties = { fontSize: '0.72rem', color: '#64748b', marginTop: 2 };

export const isSuperAdmin = (a: UniAdmin) => a.role === 'University Super Admin' || a.role === 'Super Admin';

function AdminRow({ a, idx, onEdit, onResetPin, onDelete }: { a: UniAdmin; idx: number; onEdit: (id: number) => void; onResetPin: (a: UniAdmin) => void; onDelete: (a: UniAdmin) => void }) {
    const isSuper = isSuperAdmin(a);
    return (
        <tr>
            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
            <td>
                <div style={{ fontWeight: 750, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{a.name || ''}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>ID #{a.id} • {datePart(a.created_at)}</div>
            </td>
            <td><code>{a.username || ''}</code></td>
            <td>
                {isSuper
                    ? <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 750 }}>👑 Super Admin</span>
                    : <span className="badge badge-primary" style={{ fontWeight: 650 }}>👔 University Admin</span>}
            </td>
            <td><span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{a.university_name || 'SAL'}</span></td>
            <td>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{a.email || '—'}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.phone || ''}</div>
            </td>
            <td style={{ textAlign: 'center' }}>
                {a.status === 'Active' ? <span className="stat-badge-active">Active</span> : <span className="stat-badge-inactive">Inactive</span>}
            </td>
            <td style={{ textAlign: 'right' }}>
                <div className="table-actions-cell">
                    <button className="table-act-btn" onClick={() => onEdit(a.id)} title="Edit Admin">✏</button>
                    <button className="table-act-btn" onClick={() => onResetPin(a)} title="Reset Passcode">🔒</button>
                    {!isSuper && <button className="table-act-btn act-delete" onClick={() => onDelete(a)} title="Remove Admin">🗑</button>}
                </div>
            </td>
        </tr>
    );
}

/** VIEW: University admins & quota (loadUniversityAdmins / renderUniAdminsTable). */
export function UniAdminsSection({ active, admins, view, collegeOptions, selectedUni, onSelectUni, onAppoint, onEdit, onResetPin, onDelete }: {
    active: boolean;
    admins: UniAdmin[] | null;
    view: QuotaView | null;
    collegeOptions: CollegeStat[] | null;
    selectedUni: string;
    onSelectUni: (id: string) => void;
    onAppoint: () => void;
    onEdit: (id: number) => void;
    onResetPin: (a: UniAdmin) => void;
    onDelete: (a: UniAdmin) => void;
}) {
    const pct = view ? view.pct : 0;
    const barBackground = !view ? 'linear-gradient(90deg, #10b981, #0284c7)' : pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'linear-gradient(90deg, #10b981, #0284c7)';
    const appointStyle: CSSProperties = { fontSize: '0.82rem', padding: '0.45rem 0.95rem', gap: 6, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)' };
    if (view) Object.assign(appointStyle, view.full ? { opacity: '0.6', cursor: 'not-allowed' } : { opacity: '1', cursor: 'pointer' });
    const appointTitle = !view ? undefined : view.full
        ? `University Admin quota reached (${view.curA}/${view.maxQ} seats used). Remove an admin to appoint another.`
        : 'Appoint a new faculty administrator under this university';

    return (
        <div id="viewUniAdmins" className={`admin-view-pane${active ? ' active' : ''}`}>
            {/* Quota Meter Card */}
            <div className="card anim-fade-up" style={{ marginBottom: 20, borderLeft: '5px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, rgba(255,255,255,0.95) 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                                🏛 University Admins &amp; Faculty Oversight
                            </h2>
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', fontSize: '0.72rem', fontWeight: 750 }}>
                                Strict Quota Engine
                            </span>
                        </div>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Scale university administration with a strict ceiling of <strong>1 Super Admin</strong> and up to <strong>10 University Admins</strong> per institution.
                        </p>
                    </div>

                    {/* University Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Institution:</label>
                        <select id="uniAdminCollegeSelect" value={selectedUni} onChange={(e) => onSelectUni(e.target.value)} style={{ padding: '0.45rem 0.85rem', fontSize: '0.84rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', minWidth: 220, fontWeight: 600 }}>
                            {collegeOptions
                                ? collegeOptions.map((c) => <option key={c.id} value={c.id}>{c.name || ''}</option>)
                                : <option value="1">SAL Hospital</option>}
                        </select>
                    </div>
                </div>

                {/* Quota Progress & KPI Pills */}
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <div style={quotaBox}>
                        <div style={quotaLabel}>Dean / Super Admin</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: '1.2rem' }}>👑</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b45309' }} id="quotaSuperAdminText">{view ? view.superText : '1 / 1 Appointed'}</span>
                        </div>
                        <div style={quotaFoot}>Fixed 1 Super Admin quota</div>
                    </div>

                    <div style={quotaBox}>
                        <div style={quotaLabel}>University Admin Seats</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: '1.2rem' }}>👥</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }} id="quotaAdminsCountText">{view ? view.adminsText : '0 / 10 Used'}</span>
                        </div>
                        <div style={quotaFoot}>
                            <span id="quotaRemainingText">{view ? view.remainingText : '10 seats remaining'}</span>
                        </div>
                    </div>

                    <div style={quotaBox}>
                        <div style={quotaLabel}>Quota Capacity Bar</div>
                        <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                            <div id="quotaProgressBar" style={{ width: `${pct}%`, height: '100%', background: barBackground, transition: 'width 0.4s ease' }}></div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>0</span>
                            <span id="quotaCapacityPct">{pct}% Full</span>
                            <span>10 Cap</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* University Admins Roster Table Card */}
            <div className="card anim-fade-up anim-delay-1">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.2rem' }}>
                            Appointed University Administrators (<span id="uniAdminCount">{view ? view.count : 0}</span>)
                        </h2>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Faculty and unit coordinators authorized to register and supervise medical cadets under this institution.
                        </p>
                    </div>

                    <button className="btn btn-primary" id="btnAppointAdmin" onClick={onAppoint} disabled={!!view && view.full} title={appointTitle} style={appointStyle}>
                        ➕ Appoint University Admin
                    </button>
                </div>

                <div className="table-wrapper">
                    <table id="uniAdminsTable">
                        <thead>
                            <tr>
                                <th style={{ width: 45, textAlign: 'center' }}>#</th>
                                <th>Administrator Name</th>
                                <th>Username</th>
                                <th>Institutional Role</th>
                                <th>University</th>
                                <th>Contact</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="uniAdminsTbody">
                            {admins === null ? (
                                <MessageRow colSpan={8} padding={24}>Loading university administrators...</MessageRow>
                            ) : admins.length === 0 ? (
                                <MessageRow colSpan={8} padding={24}>No administrators appointed yet for this institution</MessageRow>
                            ) : (
                                admins.map((a, idx) => <AdminRow key={a.id} a={a} idx={idx} onEdit={onEdit} onResetPin={onResetPin} onDelete={onDelete} />)
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
