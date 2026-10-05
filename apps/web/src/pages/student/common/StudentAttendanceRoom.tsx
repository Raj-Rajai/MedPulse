import { useEffect, useRef, useState } from 'react';
import { AttendanceDialog, ProximityOrbit, SessionClock, attendanceApi, useAttendanceResource, useRoomClock,
    type RoomSummary, type StudentRoom } from '../../../shared/attendance/attendance';

export function StudentAttendanceRoom({ lectureId, onClose, onSuccess }: {
    lectureId?: number; onClose: () => void; onSuccess: (message: string) => void;
}) {
    const [roomId, setRoomId] = useState<string | null>(null);
    const sessions = useAttendanceResource<{ clusters: RoomSummary[] }>('/api/academic/attendance/clusters');
    const roomState = useAttendanceResource<StudentRoom>(roomId ? `/api/academic/attendance/clusters/${roomId}` : null, 2000);
    const room = roomState.data;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [submissionVerified, setSubmissionVerified] = useState(false);
    const actionVersion = useRef(0);
    const now = useRoomClock(room?.server_now);
    const closed = !!room && (room.closed_at !== null || now >= room.ends_at);
    const present = submitted || room?.attendance_status === 'Present';
    const verified = !!room?.verified_until && room.verified_until > now;
    const canSubmit = !!room?.joined_at && verified && !closed && !present && !room?.attendance_status && !roomState.error;
    useEffect(() => {
        if (!roomId && lectureId && sessions.data) {
            const match = sessions.data.clusters.find(cluster => cluster.lecture_id === lectureId);
            if (match) setRoomId(match.cluster_id);
        }
    }, [sessions.data, lectureId, roomId]);
    useEffect(() => () => { actionVersion.current++; }, []);
    const join = async () => {
        if (!roomId) return;
        const version = actionVersion.current;
        setBusy(true); setError(null);
        try { await attendanceApi(`/api/academic/attendance/clusters/${roomId}/join`, {}); if (version === actionVersion.current) roomState.refresh(); }
        catch (failure) { if (version === actionVersion.current) setError(failure instanceof Error ? failure.message : 'Unable to join.'); }
        finally { if (version === actionVersion.current) setBusy(false); }
    };
    const submit = async () => {
        if (!canSubmit || !roomId) return;
        const version = actionVersion.current;
        setBusy(true); setError(null);
        try {
            await attendanceApi('/api/academic/attendance/fill', { cluster_id: roomId });
            if (version !== actionVersion.current) return;
            setSubmitted(true); setSubmissionVerified(true); roomState.refresh();
            onSuccess('Attendance recorded. You are marked present.');
        } catch (failure) {
            if (version === actionVersion.current) { setError(failure instanceof Error ? failure.message : 'Unable to record attendance.'); roomState.refresh(); }
        } finally { if (version === actionVersion.current) setBusy(false); }
    };
    const available = (sessions.data?.clusters ?? []).filter(cluster => !lectureId || cluster.lecture_id === lectureId);
    const problem = error || (roomId ? roomState.error : sessions.error);
    const choose = (id: string) => { actionVersion.current++; setRoomId(id); setError(null); setSubmitted(false); setSubmissionVerified(false); setBusy(false); };
    return <AttendanceDialog title="Student attendance waiting room" onClose={onClose}>
        <div className="mp-att-content">
            <header className="mp-att-heading"><div><span className="mp-att-eyebrow">Student · Cluster attendance</span>
                <h2>{present ? 'You’re marked present' : closed ? 'This session has ended' : room ? 'Your attendance room' : 'Join your class'}</h2>
                <p>{room ? `${room.subject_name} · ${room.room_no || 'Classroom'}` : 'Attendance opens when your faculty starts a session.'}</p>
            </div>{room && <span className={`mp-att-pill ${!closed && !present ? 'mp-att-pill--live' : ''}`}>{present ? 'Present' : closed ? 'Closed' : 'Live session'}</span>}</header>
            {problem && <div className="mp-att-error" role="alert">{problem} <button className="mp-att-btn" onClick={() => { roomState.refresh(); sessions.refresh(); }}>Retry</button></div>}
            {!roomId ? <>
                {!sessions.data && !sessions.error ? <div className="mp-att-empty" role="status"><span className="mp-att-spinner"/>Checking for active attendance…</div>
                    : !available.length ? <div className="mp-att-empty"><ProximityOrbit radius={1}/><h3>Waiting for faculty</h3>
                        <p>{lectureId ? 'There is no active attendance room for this lecture.' : 'There are no active attendance sessions for your class.'}<br/>Keep this screen open. New sessions appear automatically.</p>
                        <div className="mp-att-note mp-att-note--info">You can only submit during a faculty-started session and after your proximity has been verified.</div></div>
                    : available.map(cluster => <button key={cluster.cluster_id} className="mp-att-session" onClick={() => choose(cluster.cluster_id)}>
                        <span><span className="mp-att-eyebrow">{cluster.accepted_at ? 'Attendance recorded' : 'Attendance is open'}</span><strong style={{ marginTop:7 }}>{cluster.subject_name}</strong>
                            <small>{cluster.faculty_name || 'Department faculty'} · {cluster.room_no || 'Classroom'} · {cluster.radius_m} m radius</small></span><span aria-hidden="true">→</span>
                    </button>)}
            </> : !room ? <div className="mp-att-empty" role="status"><span className="mp-att-spinner"/>Connecting to the room…</div> : <>
                <div className="mp-att-steps" aria-label="Attendance progress">
                    <span className={`mp-att-step ${room.joined_at || present ? 'mp-att-step--done' : ''}`}>01 · Join room</span>
                    <span className={`mp-att-step ${verified || room.accepted_at || submissionVerified ? 'mp-att-step--done' : ''}`}>02 · Verify proximity</span>
                    <span className={`mp-att-step ${present ? 'mp-att-step--done' : ''}`}>03 · Mark present</span>
                </div>
                <div className="mp-att-panel mp-att-student-center">
                    <ProximityOrbit radius={room.radius_m} complete={!!present}/>
                    <h3>{present ? 'Attendance saved' : closed ? 'Attendance is closed' : verified ? 'You’re ready to submit' : room.joined_at ? 'You’re in the waiting room' : 'Your faculty is taking attendance'}</h3>
                    <p>{present ? 'Your attendance is available in your academic record.' : closed ? 'New submissions are no longer accepted.' : verified ? 'Your proximity check passed. Submit before verification expires.' : room.joined_at
                        ? `Stay within ${room.radius_m} metre${room.radius_m === 1 ? '' : 's'} of the faculty phone. Waiting for Bluetooth verification.`
                        : 'Join this session to begin your attendance check.'}</p>
                    {!present && <SessionClock startedAt={room.started_at} endsAt={room.ends_at} now={now} closed={closed}/>}
                    <p style={{ fontSize:11 }}>{room.faculty_name || 'Department faculty'} · {room.lecture_date}</p>
                </div>
                {present ? <div className="mp-att-success" role="status">✓ Present · {room.subject_name}</div> : closed ? <div className="mp-att-note" role="status">
                    {room.attendance_status ? `Your attendance status: ${room.attendance_status}.` : 'Your attendance record is being finalized.'} Contact your faculty if you need a correction.
                </div> : room.attendance_status ? <div className="mp-att-note">Your register already shows <strong>{room.attendance_status}</strong>. Ask faculty to make any correction.</div>
                    : room.joined_at && !verified ? <div className="mp-att-note" role="status">
                        {room.last_observation === 'outside_radius' ? <><strong>Outside the permitted proximity.</strong> Move closer to the faculty phone and repeat the check in the Bluetooth phone app.</>
                            : room.last_observation === 'proximity_verified' ? <><strong>Verification expired.</strong> Repeat the proximity check in the Bluetooth phone app before submitting.</>
                            : <><strong>Proximity check pending.</strong> A compatible Bluetooth phone app is needed for this check. This browser cannot complete phone-to-phone verification. Joining alone does not mark you present.</>}
                    </div> : <div className="mp-att-note mp-att-note--info">Joining does not mark you present. Attendance requires a successful proximity check and submission before the timer ends.</div>}
            </>}
        </div>
        <footer className="mp-att-footer"><p>{closed ? 'Only faculty can correct a closed attendance record.' : 'Unverified students are marked absent when the session ends.'}</p>
            <div className="mp-att-actions"><button className="mp-att-btn" onClick={onClose}>{present ? 'Done' : 'Close'}</button>
                {room && !closed && !present && !room.attendance_status && (room.joined_at
                    ? <button className="mp-att-btn mp-att-btn--primary" disabled={!canSubmit || busy} onClick={submit}>{busy ? 'Submitting…' : verified ? 'Submit attendance' : 'Awaiting verification'}</button>
                    : <button className="mp-att-btn mp-att-btn--primary" disabled={busy || !!roomState.error} onClick={join}>{busy ? 'Joining…' : 'Join waiting room'}</button>)}
            </div>
        </footer>
    </AttendanceDialog>;
}

/** Live entry point on the profile and schedule; no hard-coded example lecture. */
export function ActiveAttendanceBanner({ onOpen }: { onOpen: () => void }) {
    const { data } = useAttendanceResource<{ clusters: RoomSummary[] }>('/api/academic/attendance/clusters', 5000);
    const active = data?.clusters.filter(cluster => !cluster.accepted_at) ?? [];
    return <div className="mp-att-launcher"><div><strong>{active.length ? 'Attendance is open' : 'Attendance waiting room'}</strong><p>{active.length
        ? `${active.length === 1 ? active[0].subject_name : `${active.length} faculty sessions are accepting attendance`}. Join before the session closes.`
        : 'Join when your faculty opens a session. Check the waiting room for updates.'}</p></div>
        <button onClick={onOpen}>View waiting room →</button></div>;
}
