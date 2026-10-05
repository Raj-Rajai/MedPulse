/** Consolidated marksheet table of exams.html (renderMarksheetTable). */
import { isDistinctionOf, termBadgeClassOf, type Exam } from './types';

const IA_HEAD: [string, React.CSSProperties][] = [
    ['Academic Year', { minWidth: '140px' }],
    ['Evaluation Term', { minWidth: '140px' }],
    ['Subject Name & Code', { minWidth: '220px' }],
    ['Theory (100)', { textAlign: 'center', width: '130px' }],
    ['Practical (100)', { textAlign: 'center', width: '130px' }],
    ['Total (200)', { textAlign: 'center', width: '130px' }],
    ['Overall %', { textAlign: 'center', width: '90px' }],
    ['Grade', { textAlign: 'center', width: '90px' }],
    ['Status', { textAlign: 'center', width: '120px' }],
];
const PAPER_HEAD: [string, React.CSSProperties][] = [
    ['Academic Year', { minWidth: '140px' }],
    ['Evaluation Term', { minWidth: '140px' }],
    ['Subject Name & Code', { minWidth: '220px' }],
    ['Paper 1 (100)', { textAlign: 'center', width: '110px' }],
    ['Paper 2 (100)', { textAlign: 'center', width: '110px' }],
    ['Theory Total', { textAlign: 'center', width: '130px' }],
    ['Practical (100)', { textAlign: 'center', width: '130px' }],
    ['Grand Total', { textAlign: 'center', width: '130px' }],
    ['Overall %', { textAlign: 'center', width: '90px' }],
    ['Grade', { textAlign: 'center', width: '90px' }],
    ['Status', { textAlign: 'center', width: '120px' }],
];

function Row({ ex, papers }: { ex: Exam; papers: boolean }) {
    const isDistinction = isDistinctionOf(ex);
    const statusBadgeClass = isDistinction ? 'badge-success' : ex.status === 'Pass' ? 'badge-info' : 'badge-danger';
    const statusText = isDistinction ? '🌟 Distinction' : ex.status === 'Pass' ? 'Passed' : 'Remedial';
    return (
        <tr>
            <td>
                <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.72rem', fontWeight: 750 }}>{ex.academic_year || ''}</span>
            </td>
            <td>
                <span className={`badge-term ${termBadgeClassOf(ex.exam_type)}`}>{ex.term || ''}</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>{ex.exam_code || ''}</div>
            </td>
            <td>
                <div style={{ fontWeight: 750, color: 'var(--text-primary)' }}>{ex.subject || ''}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ex.subject_code || ''}</div>
            </td>
            {papers ? (
                ex.is_two_paper ? (
                    <>
                        <td style={{ textAlign: 'center', fontWeight: 650 }}>{`${ex.paper1?.obtained} / 100`}</td>
                        <td style={{ textAlign: 'center', fontWeight: 650 }}>{`${ex.paper2?.obtained} / 100`}</td>
                    </>
                ) : (
                    <td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.74rem', background: '#fafafa', fontStyle: 'italic' }}>Single Theory Paper</td>
                )
            ) : null}
            <td style={{ textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>{`${ex.theory.obtained} / ${ex.theory.max}`}</td>
            <td style={{ textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>{`${ex.practical.obtained} / ${ex.practical.max}`}</td>
            <td style={{ textAlign: 'center', fontWeight: 850, color: 'var(--text-primary)' }}>{`${ex.total.obtained} / ${ex.total.max}`}</td>
            <td style={{ textAlign: 'center', fontWeight: 800, color: ex.total.percentage >= 75 ? '#10b981' : '#3b82f6' }}>{`${ex.total.percentage}%`}</td>
            <td style={{ textAlign: 'center', fontWeight: 800 }}>{ex.grade || ''}</td>
            <td style={{ textAlign: 'center' }}>
                <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>{statusText}</span>
            </td>
        </tr>
    );
}

/** `exams === null`: nothing loaded yet (original static markup). */
export function MarksheetTable({ exams, typeFilter }: { exams: Exam[] | null; typeFilter: string }) {
    const showPaperColumns = exams === null || (typeFilter !== 'IA-1' && typeFilter !== 'IA-2' && exams.some((e) => e.is_two_paper));
    const head = showPaperColumns ? PAPER_HEAD : IA_HEAD;
    return (
        <table className="marksheet-table" id="consolidatedMarksheetTable">
            <thead id="marksheetTableHead">
                <tr>
                    {head.map(([label, style]) => (
                        <th key={label} style={style}>{label}</th>
                    ))}
                </tr>
            </thead>
            <tbody id="consolidatedTableBody">
                {exams === null ? (
                    <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading consolidated marksheet...</td>
                    </tr>
                ) : exams.length === 0 ? (
                    <tr>
                        <td colSpan={showPaperColumns ? 11 : 9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No examination records found.</td>
                    </tr>
                ) : (
                    exams.map((ex, i) => <Row key={i} ex={ex} papers={showPaperColumns} />)
                )}
            </tbody>
        </table>
    );
}
