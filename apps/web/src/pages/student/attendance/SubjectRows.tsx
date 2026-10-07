/** Subject-wise rows of attendance.html (renderSubjectWiseRows). */

export interface AttSubject {
    subject?: string;
    faculty_name?: string | null;
    total?: number;
    attended?: number;
    absent: number;
    overall_percentage: number;
    nmc_status?: string;
    theory: { percentage: number; attended?: number; total?: number };
    practical: { percentage: number; attended?: number; total?: number };
}

function Prog({ p, min }: { p: AttSubject['theory']; min: number }) {
    return (
        <td>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700 }}>
                <span>{`${p.percentage}%`}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{`${p.attended}/${p.total}`}</span>
            </div>
            <div className="mini-prog-track">
                <div className={`mini-prog-fill ${p.percentage < min ? 'warn' : ''}`} style={{ width: `${Math.min(100, p.percentage)}%` }} />
            </div>
        </td>
    );
}

export function SubjectRows({ subjects }: { subjects: AttSubject[] }) {
    if (!subjects || subjects.length === 0) {
        return (
            <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No subject data found.</td>
            </tr>
        );
    }
    return (
        <>
            {subjects.map((s, i) => {
                let statusBadgeClass = 'badge-success';
                let statusBadgeText = '✅ Eligible';
                if (s.nmc_status === 'Warning') {
                    statusBadgeClass = 'badge-warning';
                    statusBadgeText = '⚠ Warning';
                } else if (s.nmc_status === 'Shortage') {
                    statusBadgeClass = 'badge-danger';
                    statusBadgeText = '🚨 Shortage';
                }
                let pctColor = '#10b981';
                if (s.overall_percentage < 65) pctColor = '#ef4444';
                else if (s.overall_percentage < 75) pctColor = '#f59e0b';
                return (
                    <tr key={i}>
                        <td>
                            <div style={{ fontWeight: 750, color: 'var(--text-primary)' }}>{s.subject || ''}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Faculty: <strong>{s.faculty_name || ''}</strong>
                            </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{String(s.total)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>{String(s.attended)}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {s.absent > 0 ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>{`${s.absent} Abs`}</span> : '0 Abs'}
                        </td>
                        <Prog p={s.theory} min={75} />
                        <Prog p={s.practical} min={80} />
                        <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 850, color: pctColor }}>{`${s.overall_percentage}%`}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.74rem', padding: '4px 10px', fontWeight: 750 }}>{statusBadgeText}</span>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
