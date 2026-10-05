/** Day-wise lecture rows shared by profile.html (day-wise tab) and attendance.html. */

export interface Lecture {
    lecture_no: number | string;
    room_no?: string | null;
    time?: string;
    subject_code?: string;
    subject_name?: string;
    theory_practical?: string;
    faculty_name?: string;
    status?: string;
}
export interface DatewiseData {
    semester?: string;
    date_formatted?: string;
    summary?: { total?: number; present?: number; field_duty?: number; absent?: number; leave?: number };
    lectures?: Lecture[];
}

function StatusCell({ status }: { status?: string }) {
    if (status === 'Not Marked') {
        return (
            <div className="status-cell-wrapper">
                <span className="status-icon-notmarked" />
                <span className="status-text-notmarked">Not Marked</span>
            </div>
        );
    }
    if (status === 'Present') return <span className="status-pill-present">✅ Present</span>;
    if (status === 'Field Duty') return <span className="status-pill-fieldduty">🏡 Field Duty</span>;
    if (status === 'Absent') return <span className="status-pill-absent">❌ Absent</span>;
    if (status === 'Leave') return <span className="status-pill-leave">🟡 Leave</span>;
    return null;
}

/** `variant` picks the empty-state styling: profile.html and attendance.html differed slightly. */
export function DatewiseTableBody({ lectures, variant = 'profile' }: { lectures: Lecture[]; variant?: 'profile' | 'attendance' }) {
    if (!lectures || lectures.length === 0) {
        const p = variant === 'profile';
        return (
            <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: p ? '36px' : '40px', color: '#64748b' }}>
                    <div style={{ fontSize: p ? '1.6rem' : '1.8rem', marginBottom: '6px' }}>📅</div>
                    <strong>No lectures or clinical postings scheduled on this date.</strong>
                    <div style={p ? { fontSize: '0.8rem', marginTop: '4px', color: '#94a3b8' } : { fontSize: '0.8rem', marginTop: '4px' }}>Use the date navigator above to browse academic days.</div>
                </td>
            </tr>
        );
    }
    return (
        <>
            {lectures.map((item, i) => {
                const isTheory = (item.theory_practical || '').toLowerCase().includes('theory');
                return (
                    <tr key={i}>
                        <td className="center" style={{ fontWeight: 700, color: '#0f172a' }}>{String(item.lecture_no)}</td>
                        <td style={{ color: '#334155', fontWeight: 600 }}>{item.room_no || ''}</td>
                        <td style={{ color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.time || ''}</td>
                        <td style={{ fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.subject_code || ''}</td>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{item.subject_name || ''}</td>
                        <td className="center">{isTheory ? <span className="tag-theory">Theory</span> : <span className="tag-practical">Practical</span>}</td>
                        <td style={{ fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.82rem' }}>{item.faculty_name || ''}</td>
                        <td className="center"><StatusCell status={item.status} /></td>
                    </tr>
                );
            })}
        </>
    );
}
