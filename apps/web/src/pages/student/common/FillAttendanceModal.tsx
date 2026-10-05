/** Modal for students to fill attendance for a scheduled teaching session. */
import { useState } from 'react';

export interface FillableLecture {
    id?: number;
    lecture_id?: number;
    lecture_no?: number | string;
    subject?: string | null;
    subject_name?: string | null;
    subject_code?: string | null;
    date_iso?: string | null;
    lecture_date?: string | null;
    card_date?: string | null;
    time_slot?: string | null;
    card_time?: string | null;
    faculty_name?: string | null;
    venue?: string | null;
    room_no?: string | null;
    topic?: string | null;
    attendance_requested?: boolean;
    attendance_status?: string | null;
}

interface FillAttendanceModalProps {
    open: boolean;
    session: FillableLecture | null;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

export function FillAttendanceModal({ open, session, onClose, onSuccess }: FillAttendanceModalProps) {
    const [status, setStatus] = useState<'Present' | 'Field Duty' | 'Leave'>('Present');
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open || !session) return null;

    const lectureId = session.id || session.lecture_id;
    const subject = session.subject_name || session.subject || 'Scheduled Lecture';
    const date = session.date_iso || session.lecture_date || session.card_date || 'Today';
    const time = session.time_slot || session.card_time || `Lecture ${session.lecture_no || 1}`;
    const venue = session.venue || session.room_no || 'Lecture Theatre';
    const faculty = session.faculty_name || 'Department Faculty';
    const topic = session.topic || 'Curricular Teaching & Clinical Training';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const payload: Record<string, unknown> = {
                status,
                remarks: remarks.trim() || `Self-marked as ${status} via Student Portal`,
            };
            if (lectureId) {
                payload.lecture_id = lectureId;
            } else {
                payload.date = session.date_iso || session.lecture_date;
                payload.lecture_no = session.lecture_no || 1;
            }

            const res = await fetch('/api/academic/attendance/fill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || `Failed to submit attendance (status ${res.status})`);
            }

            onSuccess(data.message || `Attendance submitted successfully as ${status}!`);
            onClose();
        } catch (err) {
            console.error('Fill attendance error:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit attendance');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: '540px', width: '92%', borderRadius: '16px', padding: '24px 28px', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📝</span>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            Fill Lecture Attendance
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b', padding: '4px 8px' }}
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        {error}
                    </div>
                )}

                {/* Session Summary Card */}
                <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 750, color: '#1e293b' }}>
                            {subject}
                        </span>
                        <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px' }}>
                            {session.subject_code || 'MBBS'}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>📅 {date}</span>
                        <span>⏰ {time}</span>
                        <span>📍 {venue}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
                        <strong>Faculty:</strong> {faculty}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#334155', fontStyle: 'italic', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                        <strong>Topic:</strong> {topic}
                    </div>
                </div>

                {session.attendance_requested && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', fontSize: '0.82rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📢</span>
                        <span><strong>Attendance Requested:</strong> Faculty has requested attendance for this scheduled session.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                            Select Attendance Status:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setStatus('Present')}
                                style={{
                                    padding: '10px 8px',
                                    borderRadius: '10px',
                                    border: `2px solid ${status === 'Present' ? '#10b981' : '#e2e8f0'}`,
                                    background: status === 'Present' ? 'rgba(16, 185, 129, 0.12)' : '#fff',
                                    color: status === 'Present' ? '#065f46' : '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                ✅ Present
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('Field Duty')}
                                style={{
                                    padding: '10px 8px',
                                    borderRadius: '10px',
                                    border: `2px solid ${status === 'Field Duty' ? '#8b5cf6' : '#e2e8f0'}`,
                                    background: status === 'Field Duty' ? 'rgba(139, 92, 246, 0.12)' : '#fff',
                                    color: status === 'Field Duty' ? '#5b21b6' : '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                🏡 Field Duty
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('Leave')}
                                style={{
                                    padding: '10px 8px',
                                    borderRadius: '10px',
                                    border: `2px solid ${status === 'Leave' ? '#f59e0b' : '#e2e8f0'}`,
                                    background: status === 'Leave' ? 'rgba(245, 158, 11, 0.12)' : '#fff',
                                    color: status === 'Leave' ? '#92400e' : '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                🟡 On Leave
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#475569', marginBottom: '6px' }}>
                            Remarks (Optional):
                        </label>
                        <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="e.g. Attended clinical session / field posting survey"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={busy}
                            style={{ padding: '8px 18px', fontWeight: 650 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={busy}
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', border: 'none', boxShadow: '0 4px 12px rgba(79,70,229,0.35)', fontWeight: 700, padding: '8px 22px' }}
                        >
                            {busy ? '⏳ Submitting...' : '✓ Submit Attendance'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
