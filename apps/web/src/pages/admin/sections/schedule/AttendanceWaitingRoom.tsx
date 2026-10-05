import { useEffect, useRef, useState } from 'react';
import type { AdminScheduleItem } from '../../types';
import { AttendanceDialog, ProximityOrbit, SessionClock, attendanceApi, useAttendanceResource, useRoomClock,
    type FacultyRoom, type RoomMember } from '../../../../shared/attendance/attendance';

interface RosterStudent { student_id: number; name: string; roll_number: string; batch_year: string | null; }

export function AttendanceWaitingRoom({ lecture, onClose, onChanged }: {
    lecture: AdminScheduleItem; onClose: () => void; onChanged: () => void;
}) {
    const endpoint = `/api/admin/academic/schedule/${lecture.id}/attendance-cluster`;
    const { data, error: loadError, refresh } = useAttendanceResource<{ cluster: FacultyRoom | null }>(endpoint);
    const [createdRoom, setCreatedRoom] = useState<FacultyRoom | null>(null);
    const room = data?.cluster ?? createdRoom;
    const roster = useAttendanceResource<{ students: RosterStudent[] }>(data && !room
        ? `/api/admin/academic/attendance/sheet?date=${encodeURIComponent(lecture.date_iso)}&lecture_no=${lecture.lecture_no || 1}` : null, 0);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const initialized = useRef(false);
    const [batch, setBatch] = useState('all');
    const [search, setSearch] = useState('');
    const [radius, setRadius] = useState('1');
    const [minutes, setMinutes] = useState('5');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const now = useRoomClock(room?.server_now);
    const closed = !!room && (room.closed_at !== null || now >= room.ends_at);
    const students = roster.data?.students ?? [];
    const batches = [...new Set(students.map(student => student.batch_year).filter((value): value is string => !!value))].sort();
    useEffect(() => {
        if (roster.data && !initialized.current) {
            initialized.current = true;
            const matching = roster.data.students.filter(student => student.batch_year === lecture.batch_year);
            const initial = matching.length ? matching : roster.data.students;
            setBatch(matching.length ? lecture.batch_year! : 'all');
            setSelected(new Set(initial.map(student => student.student_id)));
        }
    }, [roster.data, lecture.batch_year]);
    const matchesSearch = (student: { name: string; roll_number: string }) => `${student.name} ${student.roll_number}`.toLowerCase().includes(search.toLowerCase());
    const visible = students.filter(student => (batch === 'all' || student.batch_year === batch) && matchesSearch(student));
    const toggle = (id: number) => setSelected(previous => {
        const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
    });
    const start = async () => {
        setBusy(true); setError(null);
        try {
            const result = await attendanceApi<{ cluster_id: string; anchor_token: string }>(
                `/api/admin/academic/schedule/${lecture.id}/request-attendance`, {
                    student_ids: [...selected], radius_m: Number(radius), duration_seconds: Number(minutes) * 60,
                });
            // Retained only in this faculty tab for a future compatible phone client; never put in a URL or roster response.
            try { sessionStorage.setItem(`medpulse:attendance-anchor:${result.cluster_id}`, result.anchor_token); } catch { /* Storage can be disabled. */ }
            setSearch('');
            refresh(); onChanged();
            const updated = await attendanceApi<{ cluster: FacultyRoom }>(endpoint);
            setCreatedRoom(updated.cluster);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to open attendance.'); refresh(); }
        finally { setBusy(false); }
    };
    const end = async () => {
        if (!room) return;
        setBusy(true); setError(null);
        try {
            await attendanceApi(`/api/admin/academic/attendance/clusters/${room.id}/end`, {});
            try { sessionStorage.removeItem(`medpulse:attendance-anchor:${room.id}`); } catch { /* Optional storage. */ }
            setConfirmEnd(false); refresh(); onChanged();
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to close attendance.'); }
        finally { setBusy(false); }
    };
    const status = (student: RoomMember): [string, string] => {
        if (student.attendance_status === 'Present') return ['Present', 'present'];
        if (student.attendance_status) return [student.attendance_status, student.attendance_status === 'Absent' ? 'absent' : 'waiting'];
        if (closed) return ['Finalizing', 'waiting'];
        if (student.verified_until && student.verified_until > now) return ['Ready to submit', 'present'];
        if (student.joined_at) return ['Awaiting proximity', 'waiting'];
        return ['Not joined', ''];
    };
    const problem = error || loadError || roster.error;
    return <AttendanceDialog wide title="Faculty attendance waiting room" onClose={onClose}>
        <div className="mp-att-content">
            <header className="mp-att-heading"><div><span className="mp-att-eyebrow">Faculty · Cluster attendance</span>
                <h2>{room ? closed ? 'Attendance complete' : 'Attendance waiting room' : 'Prepare your attendance room'}</h2>
                <p>{lecture.subject_name || lecture.subject || lecture.department} · {lecture.date_iso} · Lecture {lecture.lecture_no || 1}</p>
            </div><span className={`mp-att-pill ${room && !closed ? 'mp-att-pill--live' : ''}`}>{room ? closed ? 'Closed' : 'Live session' : 'Not started'}</span></header>
            {problem && <div role="alert" className="mp-att-error">{problem} <button className="mp-att-btn" onClick={() => { refresh(); roster.refresh(); }}>Retry</button></div>}
            {!data && !room ? <div className="mp-att-empty" role="status"><span className="mp-att-spinner"/>Loading attendance room…</div> : <div className="mp-att-grid">
                <aside className="mp-att-panel mp-att-panel--anchor">
                    <ProximityOrbit radius={room?.radius_m ?? (Number(radius) || 1)} complete={closed}/>
                    <h3>{closed ? 'Session closed' : 'Faculty is the anchor'}</h3>
                    <p>{lecture.room_no || lecture.venue || 'Classroom'}<br/>{lecture.faculty_name || 'Department faculty'}</p>
                    {room ? <SessionClock startedAt={room.started_at} endsAt={room.ends_at} now={now} closed={closed}/> : <div className="mp-att-fields">
                        <div className="mp-att-field"><label htmlFor="att-radius">Radius (metres)</label><input id="att-radius" type="number" min="0.1" max="100" step="0.1" value={radius} onChange={event => setRadius(event.target.value)}/></div>
                        <div className="mp-att-field"><label htmlFor="att-duration">Duration (min)</label><input id="att-duration" type="number" min="1" max="60" step="1" value={minutes} onChange={event => setMinutes(event.target.value)}/></div>
                    </div>}
                    {!closed && <div className="mp-att-note"><strong>Bluetooth phone connection required</strong><br/>This browser manages the room but cannot verify nearby phones. A compatible faculty phone app must provide proximity readings. Until then, students can join but cannot submit.</div>}
                    {closed && <p>Unverified students have been marked absent. Faculty corrections remain in the attendance register.</p>}
                </aside>
                <div>
                    {room && <div className="mp-att-stats">
                        <div className="mp-att-stat"><strong>{room.joined}<small style={{ fontSize:12, color:'#8a9da8' }}> / {room.students.length}</small></strong><span>Joined room</span></div>
                        <div className="mp-att-stat"><strong>{room.verified}</strong><span>Proximity verified</span></div>
                        <div className="mp-att-stat mp-att-stat--green"><strong>{room.present}</strong><span>Marked present</span></div>
                    </div>}
                    <div className="mp-att-panel">
                        <div className="mp-att-roster-head"><h3>{room ? 'Class register' : 'Choose your class'}</h3><span className="mp-att-pill">{room ? `${room.students.length} students` : `${selected.size} selected`}</span></div>
                        {!room && <div className="mp-att-field" style={{ marginBottom:12 }}><label htmlFor="att-batch">Batch</label><select id="att-batch" value={batch} onChange={event => {
                            const nextBatch = event.target.value; setBatch(nextBatch);
                            setSelected(new Set(students.filter(student => nextBatch === 'all' || student.batch_year === nextBatch).map(student => student.student_id)));
                        }}><option value="all">All batches</option>{batches.map(value => <option key={value}>{value}</option>)}</select></div>}
                        <input className="mp-att-search" type="search" aria-label="Search students by name or roll number" placeholder="Search name or roll number…" value={search} onChange={event => setSearch(event.target.value)}/>
                        {!room && visible.length > 0 && <label className="mp-att-check" style={{ fontSize:12, paddingBottom:9 }}><input type="checkbox" checked={visible.every(student => selected.has(student.student_id))} onChange={event => {
                            const checked = event.target.checked;
                            setSelected(previous => { const next = new Set(previous); visible.forEach(student => checked ? next.add(student.student_id) : next.delete(student.student_id)); return next; });
                        }}/>Select visible students</label>}
                        <div className="mp-att-roster" aria-label="Attendance roster">
                            {room ? room.students.filter(matchesSearch).map(student => {
                                const [label, color] = status(student);
                                return <div className="mp-att-row" key={student.student_id}><span className="mp-att-avatar">{student.name.split(' ').map(part => part[0]).slice(0,2).join('')}</span>
                                    <div className="mp-att-person"><strong>{student.name}</strong><small>Roll {student.roll_number}</small></div><span className={`mp-att-status mp-att-status--${color}`}>{label}</span></div>;
                            }) : visible.map(student => <label className="mp-att-row mp-att-check" key={student.student_id}>
                                <input type="checkbox" checked={selected.has(student.student_id)} onChange={() => toggle(student.student_id)}/>
                                <div className="mp-att-person"><strong>{student.name}</strong><small>Roll {student.roll_number} · {student.batch_year || 'Unassigned batch'}</small></div></label>)}
                            {(!room && !roster.data && !roster.error) && <p role="status">Loading class roster…</p>}
                            {(room ? !room.students.filter(matchesSearch).length : roster.data && !visible.length) && <p className="mp-att-empty">No students match this selection.</p>}
                        </div>
                    </div>
                    {room && <p style={{ marginTop:12, fontSize:11 }}>Updates automatically. Joining the room does not mark attendance.</p>}
                </div>
            </div>}
            {confirmEnd && !closed && <div className="mp-att-note" role="alert"><strong>End this session now?</strong> Pending students will be marked absent. This attendance session cannot be reopened.
                <div className="mp-att-actions" style={{ marginTop:10 }}><button className="mp-att-btn" disabled={busy} onClick={() => setConfirmEnd(false)}>Keep room open</button><button className="mp-att-btn mp-att-btn--danger" disabled={busy} onClick={end}>{busy ? 'Closing…' : 'Confirm end session'}</button></div></div>}
        </div>
        <footer className="mp-att-footer"><p>{room && !closed ? 'You can leave this screen. The session stays open until its timer ends.' : room ? 'Attendance is saved to the faculty register.' : 'Only selected students can join. The timer starts when you open the room.'}</p>
            <div className="mp-att-actions"><button className="mp-att-btn" onClick={onClose}>{room && !closed ? 'Back to schedule' : 'Close'}</button>
                {room ? !closed && <button className="mp-att-btn mp-att-btn--danger" disabled={busy || !!loadError} onClick={() => setConfirmEnd(true)}>End session</button>
                    : <button className="mp-att-btn mp-att-btn--primary" disabled={busy || !data || !!loadError || !!roster.error || !selected.size || !Number.isFinite(Number(radius)) || Number(radius) < .1 || Number(radius) > 100 || Number(minutes) < 1 || Number(minutes) > 60}
                        onClick={start}>{busy ? 'Opening room…' : 'Open waiting room'}</button>}
            </div>
        </footer>
    </AttendanceDialog>;
}
