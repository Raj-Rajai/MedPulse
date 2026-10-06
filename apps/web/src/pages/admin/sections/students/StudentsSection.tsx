import { useEffect, useState, type CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import type { ExportButtons } from '../../hooks/useExports';
import type { ShowToast } from '../../hooks/useToasts';
import type { Cadet, CollegeStat } from '../../types';

export interface CadetActions {
    openAttendance: (id: number) => void;
    openExams: (id: number) => void;
    edit: (id: number) => void;
    resetPin: (c: Cadet) => void;
    inspect: (id: number) => void;
    remove: (c: Cadet) => void;
}

const filterSelectStyle: CSSProperties = { padding: '0.45rem 0.8rem', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#fff' };
const center: CSSProperties = { textAlign: 'center' };

function copyReferralCode(code: string, showToast: ShowToast) {
    if (!code || code === 'N/A') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(
            () => showToast(`📋 Referral Code "${code}" copied to clipboard!`, 'success'),
            () => showToast(`Referral Code: ${code}`, 'info'),
        );
    } else {
        showToast(`Referral Code: ${code}`, 'info');
    }
}

function CadetRow({ s, actions, showToast }: { s: Cadet; actions: CadetActions; showToast: ShowToast }) {
    return (
        <tr>
            <td><strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{s.roll_number || ''}</strong></td>
            <td>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name || ''}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.email || 'No email'}</div>
            </td>
            <td>{s.college_name || 'SAL Hospital'}</td>
            <td>
                <span className="referral-pill" onClick={() => copyReferralCode(s.referral_code || '', showToast)} title="Click to copy Patient Adoption Referral Code">
                    <code>{s.referral_code || 'N/A'}</code>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, opacity: 0.7 }}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                </span>
            </td>
            <td>{s.batch_year || '3rd Year MBBS'}</td>
            <td>{s.posting_unit || 'RHTC'}</td>
            <td style={center}><span className="badge badge-primary">{s.families_count}</span></td>
            <td style={center}><span className="badge badge-success">{s.members_count}</span></td>
            <td style={center}><span className="badge badge-info">{s.followups_count}</span></td>
            <td style={center}>
                {s.status === 'Active' ? <span className="stat-badge-active">Active</span> : <span className="stat-badge-inactive">Inactive</span>}
            </td>
            <td style={{ textAlign: 'right' }}>
                <div className="table-actions-cell">
                    <button className="table-act-btn" onClick={() => actions.openAttendance(s.id)} title="Mark / View Attendance">📅</button>
                    <button className="table-act-btn" onClick={() => actions.openExams(s.id)} title="Input / View Exam Marks">📋</button>
                    <button className="table-act-btn" onClick={() => actions.edit(s.id)} title="Edit Cadet">✏️</button>
                    <button className="table-act-btn" onClick={() => actions.resetPin(s)} title="Reset PIN">🔒</button>
                    <button className="table-act-btn" onClick={() => actions.inspect(s.id)} title="View Households">👁️</button>
                    <button className="table-act-btn act-delete" onClick={() => actions.remove(s)} title="Delete Cadet">🗑️</button>
                </div>
            </td>
        </tr>
    );
}

/** VIEW 2: Student cadre roster with search / institution / status filters. */
export function StudentsSection({ active, all, rows, setRows, collegeOptions, actions, onAdd, exports, onRefresh, showToast }: {
    active: boolean;
    all: Cadet[] | null;
    rows: Cadet[] | null;
    setRows: (rows: Cadet[]) => void;
    collegeOptions: CollegeStat[] | null;
    actions: CadetActions;
    onAdd: () => void;
    exports?: ExportButtons;
    onRefresh?: () => void;
    showToast: ShowToast;
}) {
    const [q, setQ] = useState('');
    const [col, setCol] = useState('');
    const [stat, setStat] = useState('');

    // Re-populating the institution filter's options resets it to "All Institutions".
    useEffect(() => setCol(''), [collegeOptions]);

    const applyFilter = (next: { q?: string; col?: string; stat?: string }) => {
        const query = (next.q ?? q).toLowerCase().trim();
        const c = next.col ?? col;
        const st = next.stat ?? stat;
        setRows((all || []).filter((s) => {
            const matchesQ = !query || (s.name && s.name.toLowerCase().includes(query)) || (s.roll_number && s.roll_number.toLowerCase().includes(query)) || (s.email && s.email.toLowerCase().includes(query));
            const matchesCol = !c || String(s.college_id) === String(c);
            const matchesStat = !st || s.status === st;
            return matchesQ && matchesCol && matchesStat;
        }));
    };

    return (
        <div id="viewStudents" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="card">
                {/* Filter Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                            👨‍⚕️ Medical Student Cadre Roster (<span id="cadetTotalCount">{all ? all.length : 0}</span> Cadets)
                        </h2>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Manage student field survey assignments, credentials, security PINs, and submission progress.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="text" id="cadetSearchInput" className="search-input" placeholder="🔍 Search cadet name, roll..." value={q}
                            onChange={(e) => { setQ(e.target.value); applyFilter({ q: e.target.value }); }}
                            style={{ maxWidth: 220, fontSize: '0.82rem', padding: '0.45rem 0.8rem' }} />

                        <select id="cadetCollegeFilter" value={col} onChange={(e) => { setCol(e.target.value); applyFilter({ col: e.target.value }); }} style={filterSelectStyle}>
                            <option value="">All Institutions</option>
                            {(collegeOptions || []).map((c) => <option key={c.id} value={c.id}>{c.name || ''}</option>)}
                        </select>

                        <select id="cadetStatusFilter" value={stat} onChange={(e) => { setStat(e.target.value); applyFilter({ stat: e.target.value }); }} style={filterSelectStyle}>
                            <option value="">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>

                        <button className="btn btn-secondary" onClick={onAdd} style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', fontWeight: 650 }}>
                            ➕ Register Cadet
                        </button>
                        {exports && (
                            <>
                                <button className="btn btn-secondary" onClick={exports.exportMasterCsv} style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', fontWeight: 650 }} id="topMasterCsvBtn" title="Download master 43-column CSV of all surveyed families" disabled={exports.csvBusy}>
                                    {exports.csvBusy ? '⏳ Exporting...' : '📥 Master CSV'}
                                </button>
                                <button className="btn btn-primary" onClick={exports.exportFacultyPdf} style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', boxShadow: '0 4px 14px rgba(217,119,6,0.4)', fontSize: '0.82rem', padding: '0.45rem 0.9rem', fontWeight: 650 }} id="topFacultyPdfBtn" title="Download Faculty Audit PDF Report" disabled={exports.pdfBusy}>
                                    {exports.pdfBusy ? '⏳ Generating...' : '📄 Faculty Audit PDF'}
                                </button>
                            </>
                        )}
                        {onRefresh && (
                            <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', fontWeight: 650 }} title="Refresh live statistics">
                                ↺ Refresh
                            </button>
                        )}
                    </div>
                </div>

                {/* Cadets Table */}
                <div className="table-wrapper">
                    <table id="cadetsTable">
                        <thead>
                            <tr>
                                <th style={{ width: 70 }}>Roll</th>
                                <th>Cadet Full Name</th>
                                <th>Institution</th>
                                <th>Referral Code</th>
                                <th>Batch Year</th>
                                <th>Posting Unit</th>
                                <th style={center}>Families</th>
                                <th style={center}>Members</th>
                                <th style={center}>Follow-ups</th>
                                <th style={center}>Status</th>
                                <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="cadetsTbody">
                            {rows === null ? (
                                <MessageRow colSpan={11} padding={24}>Loading student cadre roster...</MessageRow>
                            ) : rows.length === 0 ? (
                                <MessageRow colSpan={10} padding={24}>No medical students match current filters</MessageRow>
                            ) : (
                                rows.map((s) => <CadetRow key={s.id} s={s} actions={actions} showToast={showToast} />)
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
