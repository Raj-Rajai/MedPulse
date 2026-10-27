import { useMemo, useState } from 'react';
import { DataTable, type Column } from '../../components/DataTable';
import type { ExportButtons } from '../../hooks/useExports';
import type { ShowToast } from '../../hooks/useToasts';
import { academicYearOf, byAcademicYear, byStudyOrder, distinctSorted, ENROLLMENT_LABEL, studyYearOf, UNASSIGNED } from '../../lib/academic';
import { errMessage, sendJson } from '../../lib/http';
import type { AcademicYear, Cadet } from '../../types';

export interface CadetActions {
    edit: (id: number) => void;
    resetPin: (c: Cadet) => void;
    inspect: (id: number) => void;
    remove: (c: Cadet) => void;
}

function copyReferralCode(code: string, showToast: ShowToast) {
    if (!code || code === 'N/A') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(
            () => showToast(`Referral code "${code}" copied`, 'success'),
            () => showToast(`Referral code: ${code}`, 'info'),
        );
    } else {
        showToast(`Referral code: ${code}`, 'info');
    }
}

function cadetColumns(actions: CadetActions, showToast: ShowToast): Column<Cadet>[] {
    return [
        { key: 'enrollment', label: ENROLLMENT_LABEL, value: (s) => s.roll_number, render: (s) => <span className="mm-code">{s.roll_number || ''}</span> },
        {
            key: 'name', label: 'Name', value: (s) => s.name,
            render: (s) => (
                <div>
                    <div className="mm-strong">{s.name || ''}</div>
                    <div className="mm-sub">{s.email || 'No email'}</div>
                </div>
            ),
        },
        { key: 'year', label: 'Academic Year', value: (s) => academicYearOf(s) },
        { key: 'study', label: 'Study Year', value: (s) => studyYearOf(s.batch_year) },
        {
            key: 'referral', label: 'Referral Code', value: (s) => s.referral_code,
            render: (s) => (
                <span className="referral-pill" onClick={() => copyReferralCode(s.referral_code || '', showToast)} title="Click to copy the patient referral code">
                    <code>{s.referral_code || 'N/A'}</code>
                </span>
            ),
        },
        { key: 'posting', label: 'Posting Unit', value: (s) => s.posting_unit || 'RHTC' },
        { key: 'families', label: 'Families', value: (s) => s.families_count, numeric: true, align: 'center' },
        { key: 'members', label: 'Members', value: (s) => s.members_count, numeric: true, align: 'center' },
        { key: 'followups', label: 'Follow-ups', value: (s) => s.followups_count, numeric: true, align: 'center' },
        {
            key: 'status', label: 'Status', value: (s) => s.status || 'Inactive', align: 'center',
            render: (s) => (s.status === 'Active' ? <span className="stat-badge-active">Active</span> : <span className="stat-badge-inactive">Inactive</span>),
        },
        {
            key: 'actions', label: 'Actions', value: () => '', filterable: false, align: 'right',
            render: (s) => (
                <div className="table-actions-cell">
                    <button className="table-act-btn" onClick={() => actions.edit(s.id)} title="Edit cadet">✏</button>
                    <button className="table-act-btn" onClick={() => actions.resetPin(s)} title="Reset PIN">🔒</button>
                    <button className="table-act-btn" onClick={() => actions.inspect(s.id)} title="View households">👁</button>
                    <button className="table-act-btn act-delete" onClick={() => actions.remove(s)} title="Delete cadet">🗑</button>
                </div>
            ),
        },
    ];
}

/** VIEW 2: Student cadre roster: search, academic year and study year filters, column filters, pagination. */
export function StudentsSection({ active, all, years, actions, onAdd, onChanged, exports, onRefresh, showToast }: {
    active: boolean;
    all: Cadet[] | null;
    years: AcademicYear[] | null;
    actions: CadetActions;
    onAdd: () => void;
    /** Reload students (and academic year counts) after a bulk move. */
    onChanged: () => void;
    exports?: ExportButtons;
    onRefresh?: () => void;
    showToast: ShowToast;
}) {
    const [q, setQ] = useState('');
    const [year, setYear] = useState('');
    const [study, setStudy] = useState('');
    const [moveTo, setMoveTo] = useState('');
    const [moving, setMoving] = useState(false);

    const yearOptions = useMemo(
        () => distinctSorted([...(years || []).map((y) => y.label), ...(all || []).map((s) => academicYearOf(s))], byAcademicYear),
        [years, all],
    );
    const studyOptions = useMemo(() => distinctSorted((all || []).map((s) => studyYearOf(s.batch_year)), byStudyOrder), [all]);
    const columns = useMemo(() => cadetColumns(actions, showToast), [actions, showToast]);

    const rows = useMemo(() => {
        if (!all) return null;
        const query = q.toLowerCase().trim();
        return all.filter((s) => {
            const matchesQ = !query || [s.name, s.roll_number, s.email].some((v) => v && v.toLowerCase().includes(query));
            return matchesQ && (!year || academicYearOf(s) === year) && (!study || studyYearOf(s.batch_year) === study);
        });
    }, [all, q, year, study]);

    const moveShown = async () => {
        if (!rows || !rows.length || !moveTo) return;
        const target = moveTo === UNASSIGNED ? null : (years || []).find((y) => String(y.id) === moveTo);
        const name = target ? target.label : 'Unassigned';
        if (!confirm(`Move ${rows.length} shown student${rows.length > 1 ? 's' : ''} to academic year ${name}?`)) return;
        setMoving(true);
        try {
            const res = await sendJson('/api/admin/academic-years/assign', 'POST', { student_ids: rows.map((s) => s.id), academic_year_id: target ? target.id : null });
            const data = (await res.json().catch(() => ({}))) as { updated?: number; error?: string };
            if (!res.ok) throw new Error(data.error || 'Could not move the students.');
            showToast(`${data.updated ?? rows.length} students moved to ${name}.`, 'success');
            setMoveTo('');
            onChanged();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setMoving(false);
        }
    };

    return (
        <div id="viewStudents" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="card">
                <div className="mm-card-head">
                    <div>
                        <h2 className="card-title">Student cadre <span className="mm-count" id="cadetTotalCount">{all ? all.length : 0}</span></h2>
                        <p className="card-desc">Field survey assignments, access PINs and submission progress for every student.</p>
                    </div>
                    <div className="mm-toolbar">
                        <button className="btn btn-secondary" onClick={onAdd}>➕ Register cadet</button>
                        {exports && (
                            <button className="btn btn-secondary" onClick={exports.exportMasterCsv} id="topMasterCsvBtn" title="Download the master CSV of all surveyed families" disabled={exports.csvBusy}>
                                {exports.csvBusy ? '⏳ Exporting...' : '📥 Master CSV'}
                            </button>
                        )}
                        {exports && (
                            <button className="btn btn-primary" onClick={exports.exportFacultyPdf} id="topFacultyPdfBtn" title="Download the faculty audit PDF" disabled={exports.pdfBusy}>
                                {exports.pdfBusy ? '⏳ Generating...' : '📄 Audit PDF'}
                            </button>
                        )}
                        {onRefresh && <button className="btn btn-secondary" onClick={onRefresh} title="Reload the roster">↺ Refresh</button>}
                    </div>
                </div>

                <div className="mm-filters">
                    <input type="search" id="cadetSearchInput" className="search-input" placeholder={`Search name, ${ENROLLMENT_LABEL.toLowerCase()} or email`} value={q} onChange={(e) => setQ(e.target.value)} />
                    <select id="cadetYearFilter" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">
                        <option value="">All academic years</option>
                        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select id="cadetStudyFilter" value={study} onChange={(e) => setStudy(e.target.value)} aria-label="Study year">
                        <option value="">All study years</option>
                        {studyOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="mm-filters-end">
                        <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move shown students to academic year" disabled={!rows || !rows.length}>
                            <option value="">Move shown students to...</option>
                            {(years || []).map((y) => <option key={y.id} value={String(y.id)}>{y.label}</option>)}
                            <option value={UNASSIGNED}>Unassigned</option>
                        </select>
                        <button className="btn btn-secondary" onClick={moveShown} disabled={!moveTo || moving || !rows || !rows.length}>{moving ? 'Moving...' : 'Move'}</button>
                    </div>
                </div>

                <DataTable
                    id="cadetsTable"
                    columns={columns}
                    rows={rows}
                    rowKey={(s) => s.id}
                    loadingText="Loading the student roster..."
                    emptyText="No students match the current filters."
                />
            </div>
        </div>
    );
}
