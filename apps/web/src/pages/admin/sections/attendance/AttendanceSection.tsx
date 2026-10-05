/**
 * VIEW 2B: Student attendance register (mark a lecture) and the attendance audit history.
 * The original page has no backend routes for /api/admin/academic/*, so today both panes end
 * in their error rows; the full flow is kept exactly as written.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson, todayIso } from '../../lib/http';
import { Options, SUBJECTS, labelOf, type Option } from '../academic';

type Status = 'Present' | 'Absent' | 'Leave' | 'Field Duty' | 'Not Marked';

interface SheetStudent {
    student_id: number;
    roll_number: string;
    name: string;
    posting_unit?: string | null;
    batch_year?: string | null;
    status?: Status | null;
    remarks?: string | null;
}

interface SheetResponse {
    students?: SheetStudent[];
    session_info?: { subject_code?: string; session_type?: string; room_no?: string; faculty_name?: string; topic?: string } | null;
}

interface HistoryRecord {
    id: number;
    date: string;
    lecture_no: number;
    roll_number: string;
    student_name: string;
    subject: string;
    topic?: string | null;
    status: string;
    faculty_name?: string | null;
}

interface AcademicMeta { subjects?: { code: string; default_faculty?: string; default_room?: string }[] }

const BATCHES: Option[] = [
    { value: 'all', label: 'All Registered Cadets' },
    { value: '3rd Year MBBS', label: '3rd Year MBBS (PSM)' },
    { value: '2nd Year MBBS', label: '2nd Year MBBS' },
    { value: '1st Year MBBS', label: '1st Year MBBS' },
    { value: 'Final Year MBBS Part 1', label: 'Final Year MBBS Part 1' },
    { value: 'CRMI Intern Doctor', label: 'CRMI Intern Doctor' },
];
const SESSIONS: Option[] = [
    { value: 'Theory', label: 'Theory Lecture' },
    { value: 'Practical', label: 'Practical & Clinical Posting' },
];
const SLOTS: Option[] = [
    { value: '1', label: 'Lecture 1 (08:10 to 08:55)' },
    { value: '2', label: 'Lecture 2 (08:55 to 09:40)' },
    { value: '3', label: 'Lecture 3 (09:50 to 10:35)' },
    { value: '4', label: 'Lecture 4 (10:35 to 11:20)' },
    { value: '5', label: 'Lecture 5 (11:30 to 12:15)' },
    { value: '6', label: 'Lecture 6 (12:15 to 01:00)' },
    { value: '7', label: 'Clinical / Practical (02:00 to 04:00)' },
];

interface Config { date: string; batch: string; subject: string; session: string; slot: string; room: string; faculty: string; topic: string }
const INITIAL: Config = {
    date: '', batch: '3rd Year MBBS', subject: '2010043342', session: 'Theory', slot: '1',
    room: 'LT-2', faculty: 'DRASHTI R SONI', topic: 'Epidemiological Surveillance & Outbreak Investigation',
};

type Body<T> = { kind: 'initial' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; rows: T };

const STATUS_BUTTONS: { status: Status; cls: string; title: string; label: string }[] = [
    { status: 'Present', cls: 'btn-p', title: 'Mark Present', label: '✓ Present' },
    { status: 'Absent', cls: 'btn-a', title: 'Mark Absent', label: '✗ Absent' },
    { status: 'Leave', cls: 'btn-l', title: 'Mark On Leave', label: '⏳ Leave' },
    { status: 'Field Duty', cls: 'btn-fd', title: 'Mark Field Survey Duty', label: '🏥 Field Duty' },
];

function HistoryStatusBadge({ status }: { status: string }) {
    if (status === 'Absent') return <span className="badge badge-danger">Absent</span>;
    if (status === 'Leave') return <span className="badge badge-warning">Leave</span>;
    if (status === 'Field Duty') return <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>Field Duty</span>;
    return <span className="badge badge-success">Present</span>;
}

const histControl: CSSProperties = { height: 38, fontSize: '0.82rem', borderRadius: 8, border: '1.5px solid #cbd5e1', outline: 'none' };

export function AttendanceSection({ active, loadSignal }: { active: boolean; loadSignal: number }) {
    const showToast = useToast();
    const [subView, setSubView] = useState<'mark' | 'history'>('mark');
    const [cfg, setCfg] = useState<Config>(INITIAL);
    const cfgRef = useRef<Config>(INITIAL);
    const metaRef = useRef<AcademicMeta | null>(null);
    const [sheet, setSheet] = useState<Body<SheetStudent[]>>({ kind: 'initial' });
    const sheetRef = useRef<SheetStudent[] | null>(null);
    const [saving, setSaving] = useState(false);

    const [hist, setHist] = useState({ date: '', status: 'all', search: '' });
    const histRef = useRef(hist);
    const [history, setHistory] = useState<Body<HistoryRecord[]>>({ kind: 'initial' });

    const updateCfg = (patch: Partial<Config>) => {
        cfgRef.current = { ...cfgRef.current, ...patch };
        setCfg(cfgRef.current);
    };
    const setStudents = (students: SheetStudent[]) => {
        sheetRef.current = students;
        setSheet({ kind: 'data', rows: students });
    };

    const loadSheet = useCallback(async () => {
        const c = cfgRef.current;
        const targetDate = c.date || todayIso();
        const lectureNo = c.slot || 1;
        setSheet({ kind: 'loading' });
        try {
            const url = `/api/admin/academic/attendance/sheet?date=${encodeURIComponent(targetDate)}&lecture_no=${encodeURIComponent(lectureNo)}&batch=${encodeURIComponent(c.batch)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load attendance sheet');
            const data = (await res.json()) as SheetResponse;
            const si = data.session_info;
            if (si) {
                const patch: Partial<Config> = {};
                if (si.subject_code) patch.subject = si.subject_code;
                if (si.session_type) patch.session = si.session_type;
                if (si.room_no) patch.room = si.room_no;
                if (si.faculty_name) patch.faculty = si.faculty_name;
                if (si.topic) patch.topic = si.topic;
                updateCfg(patch);
            }
            setStudents(data.students || []);
        } catch (err) {
            setSheet({ kind: 'error', message: errMessage(err) });
        }
    }, []);

    const loadAttendance = useCallback(async () => {
        if (!cfgRef.current.date) updateCfg({ date: todayIso() });
        if (!metaRef.current) {
            try {
                const res = await fetch('/api/admin/academic/meta');
                if (res.ok) metaRef.current = (await res.json()) as AcademicMeta;
            } catch { /* ignore */ }
        }
        await loadSheet();
    }, [loadSheet]);

    useEffect(() => {
        if (loadSignal) loadAttendance();
    }, [loadSignal, loadAttendance]);

    const loadHistory = useCallback(async () => {
        setHistory({ kind: 'loading' });
        const { date, status, search } = histRef.current;
        let url = '/api/admin/academic/attendance/history?limit=100';
        if (date) url += `&date=${encodeURIComponent(date)}`;
        if (status && status !== 'all') url += `&status=${encodeURIComponent(status)}`;
        if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load history');
            const data = (await res.json()) as { records?: HistoryRecord[] };
            setHistory({ kind: 'data', rows: data.records || [] });
        } catch (err) {
            setHistory({ kind: 'error', message: errMessage(err) });
        }
    }, []);

    const updateHist = (patch: Partial<typeof hist>) => {
        histRef.current = { ...histRef.current, ...patch };
        setHist(histRef.current);
        loadHistory();
    };

    const switchSubView = (v: 'mark' | 'history') => {
        setSubView(v);
        if (v === 'history') loadHistory();
    };

    const deleteRecord = async (recordId: number) => {
        if (!confirm('Are you sure you want to remove this attendance entry?')) return;
        try {
            const res = await fetch(`/api/admin/academic/attendance/${recordId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete attendance record');
            showToast('Record removed successfully', 'success');
            loadHistory();
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    };

    const stepDate = (offsetDays: number) => {
        const cur = new Date(cfgRef.current.date || new Date());
        cur.setDate(cur.getDate() + offsetDays);
        updateCfg({ date: cur.toISOString().split('T')[0] });
        loadSheet();
    };

    const onSubjectChange = (code: string) => {
        updateCfg({ subject: code });
        const s = metaRef.current?.subjects?.find((sub) => sub.code === code);
        if (s) {
            if (s.default_faculty) updateCfg({ faculty: s.default_faculty });
            if (s.default_room) updateCfg({ room: s.default_room });
        }
    };

    const setStatus = (studentId: number, status: Status) => {
        if (!sheetRef.current) return;
        setStudents(sheetRef.current.map((s) => (s.student_id === studentId ? { ...s, status } : s)));
    };
    const setRemarks = (studentId: number, remarks: string) => {
        if (!sheetRef.current) return;
        setStudents(sheetRef.current.map((s) => (s.student_id === studentId ? { ...s, remarks } : s)));
    };
    const markAll = (status: Status) => {
        if (!sheetRef.current) return;
        setStudents(sheetRef.current.map((s) => ({ ...s, status })));
    };

    const save = async () => {
        const students = sheetRef.current;
        if (!students) return;
        setSaving(true);
        const c = cfgRef.current;
        const payload = {
            date: c.date,
            lecture_no: parseInt(c.slot, 10),
            room_no: c.room.trim(),
            time_slot: labelOf(SLOTS, c.slot)?.split('(')[1]?.replace(')', '') || '08:10 to 08:55',
            subject_code: c.subject,
            subject: labelOf(SUBJECTS, c.subject) ?? 'Community Medicine (PSM)',
            session_type: c.session,
            faculty_name: c.faculty.trim(),
            topic: c.topic.trim(),
            attendance: students.map((s) => ({
                student_id: s.student_id,
                status: s.status === 'Not Marked' ? 'Present' : s.status,
                remarks: (s.remarks || '').trim(),
            })),
        };
        try {
            const res = await sendJson('/api/admin/academic/attendance', 'POST', payload);
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to save attendance');
            showToast(data.message || 'Attendance saved and synchronized successfully!', 'success');
            await loadSheet();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Summary counters only change once a sheet has loaded.
    const [counts, setCounts] = useState({ total: 0, present: 0, absent: 0, leave: 0, fieldDuty: 0 });
    useEffect(() => {
        if (sheet.kind !== 'data') return;
        const c = { total: sheet.rows.length, present: 0, absent: 0, leave: 0, fieldDuty: 0 };
        for (const s of sheet.rows) {
            if (s.status === 'Present') c.present++;
            else if (s.status === 'Absent') c.absent++;
            else if (s.status === 'Leave') c.leave++;
            else if (s.status === 'Field Duty') c.fieldDuty++;
        }
        setCounts(c);
    }, [sheet]);

    const sel = (k: keyof Config) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        updateCfg({ [k]: e.target.value });
        loadSheet();
    };
    const txt = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => updateCfg({ [k]: e.target.value });

    return (
        <div id="viewAttendance" className={`admin-view-pane${active ? ' active' : ''}`}>
            {/* Sub-Nav Switcher: Mark Attendance vs Attendance History */}
            <div className="admin-subnav-bar">
                <button type="button" className={`admin-subnav-btn${subView === 'mark' ? ' active' : ''}`} id="btnSubnavAttMark" onClick={() => switchSubView('mark')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        <path d="m9 14 2 2 4-4" />
                    </svg>
                    Mark Daily Lecture Attendance
                </button>
                <button type="button" className={`admin-subnav-btn${subView === 'history' ? ' active' : ''}`} id="btnSubnavAttHistory" onClick={() => switchSubView('history')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Attendance Audit History
                </button>
            </div>

            {/* SUB-PANE 1: MARK ATTENDANCE */}
            <div id="attMarkPane" style={subView === 'history' ? { display: 'none' } : undefined}>
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                                📅 Lecture Schedule &amp; Session Configuration
                            </h2>
                            <p className="card-desc" style={{ margin: 0 }}>
                                Select lecture slot, batch, and subject to populate student cohort. Use 1-click status pills to mark attendance.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '5px 12px', fontWeight: 700 }}>
                                🏛️ NMC Minimum: 75% Theory • 80% Practical
                            </span>
                        </div>
                    </div>

                    {/* Configuration Controls Grid */}
                    <div className="att-config-grid">
                        <div className="att-config-item">
                            <label>Attendance Date</label>
                            <div className="date-step-control">
                                <button type="button" className="date-step-btn" onClick={() => stepDate(-1)} title="Previous Day">◀</button>
                                <input type="date" id="attDateInput" value={cfg.date} onChange={sel('date')} />
                                <button type="button" className="date-step-btn" onClick={() => stepDate(1)} title="Next Day">▶</button>
                            </div>
                        </div>
                        <div className="att-config-item">
                            <label>Student Batch / Cohort</label>
                            <select id="attBatchSelect" value={cfg.batch} onChange={sel('batch')}><Options list={BATCHES} /></select>
                        </div>
                        <div className="att-config-item">
                            <label>Curriculum Subject</label>
                            <select id="attSubjectSelect" value={cfg.subject} onChange={(e) => onSubjectChange(e.target.value)}><Options list={SUBJECTS} /></select>
                        </div>
                        <div className="att-config-item">
                            <label>Session Format</label>
                            <select id="attSessionType" value={cfg.session} onChange={sel('session')}><Options list={SESSIONS} /></select>
                        </div>
                        <div className="att-config-item">
                            <label>Lecture Slot</label>
                            <select id="attLectureSlot" value={cfg.slot} onChange={sel('slot')}><Options list={SLOTS} /></select>
                        </div>
                        <div className="att-config-item">
                            <label>Lecture Hall / Room</label>
                            <input type="text" id="attRoomNo" value={cfg.room} onChange={txt('room')} placeholder="e.g. LT-2 / Demo Room" />
                        </div>
                        <div className="att-config-item">
                            <label>Faculty In-Charge</label>
                            <input type="text" id="attFacultyName" value={cfg.faculty} onChange={txt('faculty')} placeholder="e.g. Dr. Ramesh Sharma" />
                        </div>
                        <div className="att-config-item col-span-2">
                            <label>Lecture Topic / Clinical Case</label>
                            <input type="text" id="attTopicInput" value={cfg.topic} onChange={txt('topic')} placeholder="e.g. Vector-borne Disease Surveillance, Cold Chain Management" />
                        </div>
                    </div>
                </div>

                {/* Live KPI Strip & Bulk Actions */}
                <div className="att-summary-strip">
                    <div className="att-badges-row">
                        <span className="att-count-pill total">Total Cadets: <strong id="attCountTotal">{counts.total}</strong></span>
                        <span className="att-count-pill present">✓ Present: <strong id="attCountPresent">{counts.present}</strong></span>
                        <span className="att-count-pill absent">✗ Absent: <strong id="attCountAbsent">{counts.absent}</strong></span>
                        <span className="att-count-pill leave">⏳ Leave: <strong id="attCountLeave">{counts.leave}</strong></span>
                        <span className="att-count-pill field-duty">🏥 Field Duty: <strong id="attCountFieldDuty">{counts.fieldDuty}</strong></span>
                    </div>

                    {/* Bulk Quick Toggles */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-bulk-present" onClick={() => markAll('Present')}>⚡ Mark All Present</button>
                        <button type="button" className="btn-bulk-absent" onClick={() => markAll('Absent')}>⚡ Mark All Absent</button>
                        <button type="button" className="btn-bulk-reset" onClick={() => markAll('Not Marked')}>↺ Reset</button>
                    </div>
                </div>

                {/* Attendance Table */}
                <div className="card">
                    <div className="table-wrapper">
                        <table id="adminAttendanceTable">
                            <thead>
                                <tr>
                                    <th style={{ width: 80, textAlign: 'center' }}>Roll</th>
                                    <th>Cadet Name</th>
                                    <th>Batch / Institution</th>
                                    <th style={{ textAlign: 'center', width: 310 }}>Attendance Status</th>
                                    <th>Remarks / Official Notes</th>
                                </tr>
                            </thead>
                            <tbody id="adminAttendanceTbody">
                                {sheet.kind === 'initial' || sheet.kind === 'loading' ? (
                                    <MessageRow colSpan={5} padding={24}>Loading attendance roster...</MessageRow>
                                ) : sheet.kind === 'error' ? (
                                    <MessageRow colSpan={5} padding={24} color="#ef4444">{sheet.message}</MessageRow>
                                ) : sheet.rows.length === 0 ? (
                                    <MessageRow colSpan={5} padding={24}>No student cadets registered for this batch</MessageRow>
                                ) : (
                                    sheet.rows.map((s) => {
                                        const cur = s.status || 'Not Marked';
                                        return (
                                            <tr id={`attRow-${s.student_id}`} key={s.student_id}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{s.roll_number || ''}</strong>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{s.name || ''}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.posting_unit || 'RHTC'}</div>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>{s.batch_year || '3rd Year MBBS'}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div className="att-status-group">
                                                        {STATUS_BUTTONS.map((b) => (
                                                            <button key={b.status} type="button" className={`att-status-btn ${b.cls} ${cur === b.status ? 'active' : ''}`} onClick={() => setStatus(s.student_id, b.status)} title={b.title}>
                                                                {b.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <input type="text" className="att-remarks-input" id={`attRemarks-${s.student_id}`} value={s.remarks || ''} placeholder="Optional note..." onChange={(e) => setRemarks(s.student_id, e.target.value)} />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Sticky Save Bar */}
                    <div className="admin-sticky-action-bar">
                        <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                Status changes will be recorded in student attendance ledgers and updated in real-time.
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="btn btn-primary" onClick={save} id="btnSaveAttendance" disabled={saving} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)', fontWeight: 750, padding: '0.65rem 1.4rem' }}>
                                {saving ? '⏳ Saving Attendance...' : '💾 Save & Publish Attendance'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SUB-PANE 2: ATTENDANCE AUDIT HISTORY */}
            <div id="attHistoryPane" style={{ display: subView === 'history' ? 'block' : 'none' }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                                📜 Attendance Audit History &amp; Session Logs
                            </h2>
                            <p className="card-desc" style={{ margin: 0 }}>
                                Review, filter, and audit past lecture attendance records.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="date" id="attHistDateFilter" value={hist.date} onChange={(e) => updateHist({ date: e.target.value })} style={{ ...histControl, padding: '0 10px' }} />
                            <select id="attHistStatusFilter" className="filter-select" value={hist.status} onChange={(e) => updateHist({ status: e.target.value })} style={{ maxWidth: 160, height: 38 }}>
                                <option value="all">All Statuses</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Leave">Leave</option>
                                <option value="Field Duty">Field Duty</option>
                            </select>
                            <input type="text" id="attHistSearchInput" placeholder="🔍 Search cadet, topic, faculty..." value={hist.search} onChange={(e) => updateHist({ search: e.target.value })} style={{ ...histControl, maxWidth: 220, padding: '0 12px' }} />
                            <button className="btn btn-secondary" onClick={loadHistory} style={{ height: 38, fontSize: '0.82rem', padding: '0 14px', borderRadius: 8, fontWeight: 700 }}>
                                ↺ Refresh
                            </button>
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>Date</th>
                                    <th style={{ width: 70, textAlign: 'center' }}>Lecture</th>
                                    <th style={{ width: 70 }}>Roll</th>
                                    <th>Student Name</th>
                                    <th>Subject</th>
                                    <th>Topic</th>
                                    <th style={{ textAlign: 'center', width: 110 }}>Status</th>
                                    <th>Faculty</th>
                                    <th style={{ textAlign: 'right', width: 80 }}>Action</th>
                                </tr>
                            </thead>
                            <tbody id="attHistoryTbody">
                                {history.kind === 'initial' ? (
                                    <MessageRow colSpan={9} padding={24}>Loading attendance history...</MessageRow>
                                ) : history.kind === 'loading' ? (
                                    <MessageRow colSpan={9} padding={24}>Loading attendance logs...</MessageRow>
                                ) : history.kind === 'error' ? (
                                    <MessageRow colSpan={9} padding={24} color="#ef4444">{history.message}</MessageRow>
                                ) : history.rows.length === 0 ? (
                                    <MessageRow colSpan={9} padding={24}>No historical attendance records found</MessageRow>
                                ) : (
                                    history.rows.map((r) => (
                                        <tr key={r.id}>
                                            <td><code>{r.date || ''}</code></td>
                                            <td style={{ textAlign: 'center' }}><strong>L-{r.lecture_no}</strong></td>
                                            <td><strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{r.roll_number || ''}</strong></td>
                                            <td><strong>{r.student_name || ''}</strong></td>
                                            <td><span style={{ fontSize: '0.8rem' }}>{r.subject || ''}</span></td>
                                            <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.topic || 'N/A'}</span></td>
                                            <td style={{ textAlign: 'center' }}><HistoryStatusBadge status={r.status} /></td>
                                            <td><span style={{ fontSize: '0.78rem' }}>{r.faculty_name || ''}</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button type="button" className="table-act-btn act-delete" onClick={() => deleteRecord(r.id)} title="Delete record">🗑️</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
