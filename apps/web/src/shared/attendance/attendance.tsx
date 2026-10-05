import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './attendance.css';

export interface RoomSummary {
    cluster_id: string; lecture_id: number; subject_name: string; faculty_name: string;
    room_no: string; lecture_date: string; radius_m: number; started_at: number; ends_at: number;
    server_now: number; accepted_at: number | null; joined_at: number | null;
}
export interface StudentRoom extends RoomSummary {
    closed_at: number | null; verified_until: number | null;
    attendance_status: string | null; last_observation: string | null;
}
export interface RoomMember {
    student_id: number; name: string; roll_number: string; batch_year: string;
    joined_at: number | null; accepted_at: number | null; verified_until: number | null;
    attendance_status: string | null;
}
export interface FacultyRoom {
    id: string; lecture_id: number; radius_m: number; started_at: number; ends_at: number;
    closed_at: number | null; server_now: number; students: RoomMember[];
    present: number; joined: number; verified: number; pending: number;
}

export async function attendanceApi<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 12000);
    try {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to update attendance. Please try again.');
    return data as T;
    } catch (error) {
        if (controller.signal.aborted && !signal?.aborted) throw new Error('Connection timed out. Please try again.');
        throw error;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

/** One outstanding poll at a time; responses from a previous room are discarded. */
export function useAttendanceResource<T>(url: string | null, interval = 2500) {
    const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion(v => v + 1), []);
    useEffect(() => {
        if (!url) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                const data = await attendanceApi<T>(url, undefined, controller.signal);
                if (!controller.signal.aborted) setState({ url, data, error: null });
            } catch (error) {
                if (!controller.signal.aborted) setState(previous => ({ url, data: previous.url === url ? previous.data : null,
                    error: error instanceof Error ? error.message : 'Connection lost. Retrying…' }));
            } finally {
                if (!controller.signal.aborted && interval > 0) timer = setTimeout(poll, interval);
            }
        };
        void poll();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [url, version, interval]);
    return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, refresh };
}

export function useRoomClock(serverNow?: number) {
    const [now, setNow] = useState(serverNow ?? Date.now());
    useEffect(() => {
        const start = Date.now(), initial = serverNow ?? start;
        setNow(initial);
        const timer = setInterval(() => setNow(initial + Date.now() - start), 500);
        return () => clearInterval(timer);
    }, [serverNow]);
    return now;
}
export function remainingTime(endsAt: number, now: number) {
    const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function AttendanceDialog({ children, onClose, title, wide = false }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = overflow; previous?.focus(); };
    }, []);
    return createPortal(<dialog ref={ref} className={`mp-attendance ${wide ? 'mp-attendance--wide' : ''}`} aria-label={title}
        onCancel={event => { event.preventDefault(); onClose(); }}>
        <div className="mp-att-topbar"><span className="mp-att-brand"><span className="mp-att-brandmark">m<span>+</span></span> MedPulse <span className="mp-att-divider">/</span> Attendance</span>
            <button type="button" className="mp-att-close" onClick={onClose} aria-label="Close attendance room">×</button></div>
        {children}
    </dialog>, document.body);
}

export function ProximityOrbit({ radius, complete = false }: { radius: number; complete?: boolean }) {
    return <div className={`mp-att-orbit ${complete ? 'mp-att-orbit--complete' : ''}`} aria-hidden="true">
        <div className="mp-att-orbit-ring"/><div className="mp-att-orbit-ring mp-att-orbit-ring--inner"/>
        <span className="mp-att-orbit-dot"/><div className="mp-att-orbit-core">{complete ? '✓' : <svg width="27" height="35" viewBox="0 0 24 32" fill="none"><path d="M5 8 19 23 12 29V3l7 6L5 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
        <span className="mp-att-orbit-label">{complete ? 'Recorded' : `${radius} m proximity`}</span>
    </div>;
}

export function SessionClock({ startedAt, endsAt, now, closed }: { startedAt: number; endsAt: number; now: number; closed: boolean }) {
    const progress = closed ? 0 : Math.max(0, Math.min(100, (endsAt - now) / Math.max(1, endsAt - startedAt) * 100));
    return <div className={`mp-att-clock ${!closed && endsAt - now < 30000 ? 'mp-att-clock--urgent' : ''}`}>
        <span>{closed ? 'Session finished' : 'Time remaining'}</span><strong aria-label={closed ? 'Session finished' : `${remainingTime(endsAt, now)} remaining`}>{closed ? '00:00' : remainingTime(endsAt, now)}</strong>
        <div className="mp-att-progress"><span style={{ width: `${progress}%` }}/></div>
    </div>;
}
