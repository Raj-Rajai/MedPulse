/** Detailed examination cards of exams.html (renderExamsCards), one page at a time. */
import { Fragment } from 'react';
import { isDistinctionOf, termBadgeClassOf, type Exam, type Score } from './types';

const MILESTONES: Record<string, [string, string, string]> = {
    University: ['🏛', 'University Professional Examination', 'Assessment Milestone 4 of 4 • Paper 1 (100) + Paper 2 (100) + Practical (100) = 300 Marks'],
    Preliminary: ['📋', 'Preliminary Examination (Pre-lims)', 'Assessment Milestone 3 of 4 • Paper 1 (100) + Paper 2 (100) + Practical (100) = 300 Marks'],
    'IA-2': ['📝', 'Internal Assessment - 2', 'Assessment Milestone 2 of 4 • Theory (100) + Practical (100) = 200 Marks'],
    'IA-1': ['📝', 'Internal Assessment - 1', 'Assessment Milestone 1 of 4 • Theory (100) + Practical (100) = 200 Marks'],
};

interface BoxProps {
    label: string;
    s: Score;
    pctBadge: 'badge-info' | 'badge-success';
    bar: string;
    note: React.ReactNode;
    highlight?: boolean;
    maxSize: string;
}

function ScoreBox({ label, s, pctBadge, bar, note, highlight, maxSize }: BoxProps) {
    return (
        <div className={highlight ? 'score-box highlight' : 'score-box'}>
            <div className="score-box-label">
                <span>{label}</span>
                <span className={`badge ${pctBadge}`} style={{ fontSize: '0.68rem' }}>{`${s.percentage}%`}</span>
            </div>
            <div className="score-box-val" style={highlight ? { color: 'var(--accent)' } : undefined}>
                {`${s.obtained.toFixed(1)} `}
                <span style={{ fontSize: maxSize, fontWeight: 600, color: 'var(--text-muted)' }}>{`/ ${s.max}`}</span>
            </div>
            <div className="score-box-prog">
                <div className={`score-box-prog-bar ${bar}`} style={{ width: `${Math.min(100, s.percentage)}%` }} />
            </div>
            <div className="score-sub-note">{note}</div>
        </div>
    );
}

const pass50 = (s: Score) => (s.passed ? '✅ Passed (≥50% Min Met)' : '❌ Below 50%');
const standard = (s: Score) => <strong>{s.percentage >= 75 ? 'Distinction Standard' : 'First Class Standard'}</strong>;

function ExamCard({ ex }: { ex: Exam }) {
    const d = new Date(ex.exam_date + 'T00:00:00');
    const formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const isDistinction = isDistinctionOf(ex);
    const statusBadgeClass = isDistinction ? 'badge-success' : ex.status === 'Pass' ? 'badge-info' : 'badge-danger';
    const statusText = isDistinction ? '🌟 Distinction' : ex.status === 'Pass' ? '✅ Passed' : '⚠ Remedial';
    const termBadgeClass = termBadgeClassOf(ex.exam_type);
    return (
        <div className="exam-record-card">
            <div className="exam-header">
                <div className="exam-title-group">
                    <h3>
                        <span>{ex.exam_name || ''}</span>
                        <span className={`badge-term ${termBadgeClass}`}>{ex.term || ''}</span>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontSize: '0.72rem', padding: '2px 8px' }}>{ex.academic_year || ''}</span>
                    </h3>
                    <div className="exam-meta-pills">
                        <span>Code: <strong>{ex.exam_code || ''}</strong></span>
                        <span>•</span>
                        <span>Date: <strong>{formattedDate}</strong></span>
                        <span>•</span>
                        <span>Subject: <strong>{ex.subject || ''}</strong></span>
                        <span>•</span>
                        <span style={{ fontFamily: 'monospace' }}>({ex.subject_code || ''})</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.84rem', padding: '6px 14px', fontWeight: 750 }}>{statusText}</span>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Grade: <strong>{ex.grade || 'A'}</strong>
                    </div>
                </div>
            </div>
            {ex.is_two_paper ? (
                <div className="score-breakdown-grid cols-5">
                    <ScoreBox label="📄 Theory Paper I" s={ex.paper1!} pctBadge="badge-info" bar="paper" maxSize="0.82rem" note={ex.paper1!.passed ? '✅ Passed (≥40% Min Met)' : '❌ Remedial'} />
                    <ScoreBox label="📄 Theory Paper II" s={ex.paper2!} pctBadge="badge-info" bar="paper" maxSize="0.82rem" note={ex.paper2!.passed ? '✅ Passed (≥40% Min Met)' : '❌ Remedial'} />
                    <ScoreBox label="📖 Combined Theory" s={ex.theory} pctBadge="badge-info" bar="theory" maxSize="0.82rem" note={pass50(ex.theory)} />
                    <ScoreBox label="🩺 Clinical & OSPE" s={ex.practical} pctBadge="badge-success" bar="practical" maxSize="0.82rem" note={pass50(ex.practical)} />
                    <ScoreBox label="🎯 Grand Aggregate" s={ex.total} pctBadge="badge-success" bar="total" maxSize="0.82rem" note={standard(ex.total)} highlight />
                </div>
            ) : (
                <div className="score-breakdown-grid cols-3">
                    <ScoreBox label="📖 Theory Written" s={ex.theory} pctBadge="badge-info" bar="theory" maxSize="0.85rem" note={pass50(ex.theory)} />
                    <ScoreBox label="🩺 Practical & OSPE" s={ex.practical} pctBadge="badge-success" bar="practical" maxSize="0.85rem" note={pass50(ex.practical)} />
                    <ScoreBox label="🎯 Assessment Total" s={ex.total} pctBadge="badge-success" bar="total" maxSize="0.85rem" note={standard(ex.total)} highlight />
                </div>
            )}
            {ex.faculty_remarks ? (
                <div className="faculty-feedback-box">
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>💬</span>
                    <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Faculty Examiner Assessment:</strong>
                        <div style={{ fontStyle: 'italic', marginTop: '2px' }}>{`“${ex.faculty_remarks}”`}</div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export interface PageInfo {
    startIndex: number;
    endIndex: number;
    totalItems: number;
    totalPages: number;
    page: number;
}

/** Same pagination maths as renderExamsCards (clamps the requested page). */
export function paginate(total: number, pageSize: number | 'all', requested: number): PageInfo {
    const numPerPage = pageSize === 'all' ? total : pageSize;
    const totalPages = Math.max(1, Math.ceil(total / numPerPage));
    let page = requested;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const startIndex = pageSize === 'all' ? 0 : (page - 1) * numPerPage;
    const endIndex = pageSize === 'all' ? total : Math.min(total, startIndex + numPerPage);
    return { startIndex, endIndex, totalItems: total, totalPages, page };
}

export function ExamCards({ exams, info, typeFilter }: { exams: Exam[]; info: PageInfo; typeFilter: string }) {
    if (exams.length === 0) {
        return (
            <div className="exam-record-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                <div className="mp-empty-icon" style={{ marginBottom: '10px' }}>📭</div>
                <strong>No examination records found matching selected filter.</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try selecting another assessment type, clearing the search, or choosing another academic year.</div>
            </div>
        );
    }
    const pageExams = exams.slice(info.startIndex, info.endIndex);
    let lastMilestoneType: string | undefined | null = null;
    return (
        <>
            {pageExams.map((ex, i) => {
                let banner = null;
                if (typeFilter === 'all' && ex.exam_type !== lastMilestoneType) {
                    lastMilestoneType = ex.exam_type;
                    const [icon, title, sub] = MILESTONES[ex.exam_type || ''] || ['📝', ex.exam_name || '', 'Theory 100 + Practical 100 = 200 Marks'];
                    banner = (
                        <div className="milestone-group-banner">
                            <div className="milestone-banner-left">
                                <span className="milestone-banner-icon">{icon}</span>
                                <div>
                                    <div className="milestone-banner-title">{title}</div>
                                    <div className="milestone-banner-sub">{sub}</div>
                                </div>
                            </div>
                            <div className="milestone-banner-right">
                                <span className={`badge ${termBadgeClassOf(ex.exam_type)}`}>{ex.term || ''}</span>
                                <span className="badge" style={{ background: 'rgba(49, 46, 129, 0.08)', color: '#312e81', fontWeight: 750 }}>{ex.academic_year || ''}</span>
                            </div>
                        </div>
                    );
                }
                return (
                    <Fragment key={i}>
                        {banner}
                        <ExamCard ex={ex} />
                    </Fragment>
                );
            })}
        </>
    );
}
