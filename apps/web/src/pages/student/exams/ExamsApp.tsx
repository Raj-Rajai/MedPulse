/**
 * student/exams.html: year pills, summary KPIs, exam-type tabs, search / subject filter,
 * consolidated marksheet table and paginated result cards, CSV export.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, readAuthUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_PLAIN, useToasts } from '../common/Toasts';
import { errMsg, runWhenActive } from '../common/utils';
import { MedPulseAuth } from '../../../shared/session';
import { ExamCards, paginate } from './ExamCards';
import { MarksheetTable } from './MarksheetTable';
import type { Exam } from './types';

interface Summary {
    student?: { roll_number?: string; name?: string };
    cumulative_overall?: { percentage?: number; obtained?: number; max?: number };
    cumulative_theory?: { percentage?: number };
    cumulative_practical?: { percentage?: number };
    standing?: string;
    university_eligibility?: { eligible?: boolean; ia_combined_pct?: number };
    distinctions?: number;
    passed_exams?: number;
    total_exams?: number;
}
type Counts = Record<string, number | undefined>;
type SubjectItem = string | { subject?: string; subject_code?: string };

const BATCH: Record<string, string> = {
    '1': '1st Year MBBS (Batch 2024)',
    '2': '2nd Year MBBS (Batch 2025)',
    '3': '3rd Year MBBS (PSM Batch 2024-25)',
    all: 'MBBS Multi-Year Academic Transcript (2024 - 2026)',
};
const STATIC_SUBJECTS: [string, string][] = [
    ['all', 'All MBBS Subjects'],
    ['Community Medicine', 'Community Medicine (PSM)'],
    ['Ophthalmology', 'Ophthalmology (Eye)'],
    ['Otorhinolaryngology', 'Otorhinolaryngology (ENT)'],
];
const TYPE_PRIORITY: Record<string, number> = { University: 1, Preliminary: 2, 'IA-2': 3, 'IA-1': 4 };

function logoutStudent() {
    MedPulseAuth.logout();
}

export function ExamsApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_PLAIN);
    const [user] = useState(readAuthUser);
    const [year, setYear] = useState('3');
    const [summary, setSummary] = useState<{ year: string; data: Summary } | null>(null);
    // Name / roll only change when a summary carries a student (otherwise the previous one stays).
    const [st, setSt] = useState<Summary['student'] | null>(null);
    // renderExamsCards() hid the pager on an empty result, but clicking "Cards" showed it again until the next render.
    const renderSeq = useRef(0);
    const [cardsClickSeq, setCardsClickSeq] = useState(-1);
    const [raw, setRaw] = useState<Exam[] | null>(null);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [subjectOptions, setSubjectOptions] = useState<[string, string][]>(STATIC_SUBJECTS);
    const [subject, setSubject] = useState('all');
    const subjectRef = useRef('all');
    subjectRef.current = subject;
    const [typeFilter, setTypeFilter] = useState('all');
    const [search, setSearch] = useState('');
    // Phones start on the cards view; the wide marksheet table needs a desktop-width screen.
    const [view, setView] = useState<'table' | 'cards'>(() => (window.matchMedia('(max-width: 768px)').matches ? 'cards' : 'table'));
    const [page, setPage] = useState(1);
    const [pageSize, setPageSizeState] = useState<number | 'all'>(3);

    const loadExamsSummary = async (y: string) => {
        try {
            const res = await fetch(`/api/academic/exams/summary?year=${encodeURIComponent(y)}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = (await res.json()) as Summary;
            if (data.student) setSt(data.student);
            setSummary({ year: y, data });
        } catch (err) {
            console.error('Failed to load exams summary:', err);
            showToast('Error loading exam summary: ' + errMsg(err), 'error');
        }
    };

    const loadExamResults = async (y: string) => {
        try {
            const res = await fetch(`/api/academic/exams/results?year=${encodeURIComponent(y)}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const list: Exam[] = data.exams || [];
            renderSeq.current++;
            setRaw(list);
            setCounts(data.counts_by_type || {
                all: list.length,
                'IA-1': list.filter((e) => e.exam_type === 'IA-1').length,
                'IA-2': list.filter((e) => e.exam_type === 'IA-2').length,
                Preliminary: list.filter((e) => e.exam_type === 'Preliminary').length,
                University: list.filter((e) => e.exam_type === 'University').length,
            });
            const opts: [string, string][] = [['all', 'All MBBS Subjects']];
            (data.available_subjects || []).forEach((item: SubjectItem) => {
                const subjName = typeof item === 'string' ? item : item.subject;
                const subjCode = typeof item !== 'string' && item.subject_code ? ` (${item.subject_code})` : '';
                opts.push([subjName || '', `${subjName || ''}${subjCode}`]);
            });
            setSubjectOptions(opts);
            setSubject(opts.some(([v]) => v === subjectRef.current) ? subjectRef.current : 'all');
        } catch (err) {
            console.error('Failed to load exam results:', err);
            showToast('Error loading exam results: ' + errMsg(err), 'error');
        }
    };

    useEffect(() => {
        return runWhenActive(() => {
            loadExamsSummary('3');
            loadExamResults('3');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectAcademicYear = (y: number | string) => {
        const ys = y.toString();
        setYear(ys);
        setPage(1);
        loadExamsSummary(ys);
        loadExamResults(ys);
    };
    const navigateYear = (delta: number) => {
        const currentNum = year === 'all' ? 3 : parseInt(year, 10);
        selectAcademicYear(Math.max(1, Math.min(3, currentNum + delta)));
    };
    const setExamTypeFilter = (t: string) => {
        renderSeq.current++;
        setTypeFilter(t);
        setPage(1);
    };
    const setViewMode = (m: 'table' | 'cards') => {
        setView(m);
        if (m === 'cards') setCardsClickSeq(renderSeq.current);
    };
    const setPageSize = (size: number | 'all') => {
        renderSeq.current++;
        setPageSizeState(size);
        setPage(1);
    };
    const containerRef = useRef<HTMLDivElement>(null);
    const goPage = (p: number) => {
        setPage(p);
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const filtered = useMemo(() => {
        if (raw === null) return null;
        const term = search.trim().toLowerCase();
        const out = raw.filter((ex) => {
            if (typeFilter !== 'all' && ex.exam_type !== typeFilter) return false;
            if (subject !== 'all' && !(ex.subject || '').toLowerCase().includes(subject.toLowerCase())) return false;
            if (term) {
                const hay = `${ex.exam_name} ${ex.exam_code} ${ex.subject} ${ex.academic_year} ${ex.faculty_remarks}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
        if (typeFilter === 'all') {
            out.sort((a, b) => {
                const pA = TYPE_PRIORITY[a.exam_type || ''] || 5;
                const pB = TYPE_PRIORITY[b.exam_type || ''] || 5;
                if (pA !== pB) return pA - pB;
                return (a.subject || '').localeCompare(b.subject || '');
            });
        }
        return out;
    }, [raw, typeFilter, subject, search]);



    const sd = summary ? summary.data : ({} as Summary);
    const uElig = sd.university_eligibility || {};
    const elig = summary ? !!uElig.eligible : null;
    // Standing, eligibility and the overall score only mean something once results exist.
    const hasResults = !!summary && (sd.total_exams || 0) > 0;
    const pill = (y: string) => (year === y ? 'year-pill-btn active' : 'year-pill-btn');
    const tab = (t: string) => (typeFilter === t ? 'tab-pill-btn active' : 'tab-pill-btn');
    const info = filtered && filtered.length > 0 ? paginate(filtered.length, pageSize, page) : null;
    // The pager keeps its last rendered contents while hidden behind an empty result.
    const lastInfo = useRef<typeof info>(null);
    if (info) lastInfo.current = info;
    const shownInfo = info || lastInfo.current;
    const roll = user ? String(user.roll_number || '235') : null;

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="exams" onToggle={standardSidebar.toggle}
                badge={roll ? <StudentBadge roll={roll} mode="logout" onLogout={logoutStudent} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}
            <main className="main-content">
                <div className="exams-hero anim-fade-up">
                    <div className="hero-split-grid">
                        <div className="hero-left-col">
                            <div className="profile-identity-group" style={{ marginBottom: "10px" }}>
                                <div className="profile-avatar-wrapper" style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ec4899 100%)" }}>
                                    <div className="profile-avatar-inner" style={{ fontSize: "1.7rem", borderRadius: "15px" }}>🏆</div>
                                    <div className="profile-badge-online" style={{ background: "#eab308", boxShadow: "0 0 8px rgba(234, 179, 8, 0.6)" }} title="Distinction Standing" />
                                </div>
                                <div>
                                    <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "#ffffff", marginBottom: "3px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                        <span>Exams</span>
                                        <span className="profile-roll-tag" id="heroRollBadge">{st ? 'Roll ' + (st.roll_number || '235') : 'Roll 235'}</span>
                                    </h1>
                                    <div className="profile-sub-pills">
                                        <span id="heroCadetName">{st ? st.name || 'Dhruv Patel' : 'Dhruv Patel'}</span>
                                        <span>•</span>
                                        <span id="heroCadetBatch">{summary ? BATCH[summary.year] || BATCH.all : BATCH['3']}</span>
                                        <span>•</span>
                                        <span>Semester - 5</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                                {hasResults && <span className="badge badge-success" id="examStandingBadge" style={{ fontSize: "0.8rem", padding: "5px 12px", background: "rgba(16, 185, 129, 0.25)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.5)" }}>{'🌟 ' + (sd.standing || 'Pass')}</span>}
                                {hasResults && <span className={elig === null ? 'badge' : elig ? 'badge badge-success' : 'badge badge-warning'} id="heroUnivEligibilityBadge" style={{ background: "rgba(59, 130, 246, 0.25)", color: "#93c5fd", border: "1px solid rgba(59, 130, 246, 0.5)", fontSize: "0.8rem", padding: "5px 12px" }}>{elig === null ? '✅ University Exam Eligibility: CLEARED (IA ≥ 50%)' : elig ? '✅ University Exam Eligibility: CLEARED (IA Combined ' + uElig.ia_combined_pct + '%)' : '⚠ Remedial IA Required for University Eligibility'}</span>}
                            </div>
                        </div>
                        {hasResults && <div className="hero-standing-card">
                            <div style={{ fontSize: "0.72rem", fontWeight: "700", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", marginBottom: "4px" }}>Overall</div>
                            <div className="hero-standing-score" id="heroCumulativePct">{summary ? (sd.cumulative_overall?.percentage || 0) + '%' : '--%'}</div>
                            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.85)", marginTop: "4px" }} id="heroTotalMarksFraction">{`${sd.cumulative_overall?.obtained || 0} / ${sd.cumulative_overall?.max || 0} marks`}</div>
                        </div>}
                    </div>
                </div>
                <div className="year-pagination-bar anim-fade-up" id="yearPaginationBar">
                    <div className="year-nav-left">
                        <button className="year-nav-arrow-btn" id="btnPrevYear" onClick={() => navigateYear(-1)} disabled={year === '1'} title="Previous MBBS Academic Year">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            <span>Prev Year</span>
                        </button>
                    </div>
                    <div className="year-pills-container" id="yearPillsGroup">
                        <button className={pill('1')} data-year="1" onClick={() => selectAcademicYear(1)}>
                            <span className="year-dot" />
                            <div className="year-text-group">
                                <span className="year-title">1st Year MBBS</span>
                                <span className="year-meta">2024</span>
                            </div>
                        </button>
                        <button className={pill('2')} data-year="2" onClick={() => selectAcademicYear(2)}>
                            <span className="year-dot" />
                            <div className="year-text-group">
                                <span className="year-title">2nd Year MBBS</span>
                                <span className="year-meta">2025</span>
                            </div>
                        </button>
                        <button className={pill('3')} data-year="3" onClick={() => selectAcademicYear(3)}>
                            <span className="year-dot" />
                            <div className="year-text-group">
                                <span className="year-title">3rd Year MBBS</span>
                                <span className="year-meta">2026</span>
                            </div>
                        </button>
                        <button className={pill('all')} data-year="all" onClick={() => selectAcademicYear('all')}>
                            <span className="year-dot" />
                            <div className="year-text-group">
                                <span className="year-title">All Academic Years</span>
                                <span className="year-meta">Complete Transcript (36)</span>
                            </div>
                        </button>
                    </div>
                    <div className="year-nav-right">
                        <button className="year-nav-arrow-btn" id="btnNextYear" onClick={() => navigateYear(1)} title="Next MBBS Academic Year" disabled={year === '3' || year === 'all'}>
                            <span>Next Year</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="profile-kpis-grid anim-fade-up">
                    <div className="profile-kpi-card">
                        <div className="profile-kpi-icon" style={{ background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", fontSize: "1.4rem" }}>📝</div>
                        <div className="profile-kpi-info">
                            <div className="kpi-num" id="kpiTheoryAvg">{summary ? (sd.cumulative_theory?.percentage || 0) + '%' : '--%'}</div>
                            <div className="kpi-label">Theory average</div>
                        </div>
                    </div>
                    <div className="profile-kpi-card">
                        <div className="profile-kpi-icon" style={{ background: "rgba(124, 58, 237, 0.1)", color: "var(--accent)", fontSize: "1.4rem" }}>🩺</div>
                        <div className="profile-kpi-info">
                            <div className="kpi-num" id="kpiPracticalAvg">{summary ? (sd.cumulative_practical?.percentage || 0) + '%' : '--%'}</div>
                            <div className="kpi-label">Practical average</div>
                        </div>
                    </div>
                    <div className="profile-kpi-card">
                        <div className="profile-kpi-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--green)", fontSize: "1.4rem" }}>🎖</div>
                        <div className="profile-kpi-info">
                            <div className="kpi-num" id="kpiDistinctionsCount">{summary ? String(sd.distinctions || 0) : '0'}</div>
                            <div className="kpi-label">Distinctions</div>
                        </div>
                    </div>
                    <div className="profile-kpi-card">
                        <div className="profile-kpi-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: "1.4rem" }}>📜</div>
                        <div className="profile-kpi-info">
                            <div className="kpi-num" id="kpiExamsCleared">{summary ? `${sd.passed_exams || 0} / ${sd.total_exams || 0}` : '0 / 0'}</div>
                            <div className="kpi-label">Exams passed</div>
                        </div>
                    </div>
                </div>
                <div className="exams-toolbar anim-fade-up">
                    <div className="toolbar-top-row">
                        <div className="tab-pills-group" id="examTypeTabs">
                            <button className={tab('all')} data-type="all" onClick={() => setExamTypeFilter('all')}>
                                <span>All Examinations</span>
                                <span className="tab-count-tag" id="tabCountAll">{counts ? counts.all || 0 : 12}</span>
                            </button>
                            <button className={tab('IA-1')} data-type="IA-1" onClick={() => setExamTypeFilter('IA-1')}>
                                <span>Internal Assessment - 1</span>
                                <span className="tab-count-tag" id="tabCountIA1">{counts ? counts['IA-1'] || 0 : 3}</span>
                            </button>
                            <button className={tab('IA-2')} data-type="IA-2" onClick={() => setExamTypeFilter('IA-2')}>
                                <span>Internal Assessment - 2</span>
                                <span className="tab-count-tag" id="tabCountIA2">{counts ? counts['IA-2'] || 0 : 3}</span>
                            </button>
                            <button className={tab('Preliminary')} data-type="Preliminary" onClick={() => setExamTypeFilter('Preliminary')}>
                                <span>Pre-lims (Preliminary)</span>
                                <span className="tab-count-tag" id="tabCountPrelim">{counts ? counts.Preliminary || 0 : 3}</span>
                            </button>
                            <button className={tab('University')} data-type="University" onClick={() => setExamTypeFilter('University')}>
                                <span>University Examination</span>
                                <span className="tab-count-tag" id="tabCountUniv">{counts ? counts.University || 0 : 3}</span>
                            </button>
                        </div>
                        <div className="toolbar-actions-right">
                            <button className="btn btn-primary btn-sm btn-print-marksheet" onClick={() => window.print()} title="Print complete academic marksheet">
                                <span className="print-btn-icon">🖨</span>
                                <span className="print-btn-text-full">Print Marksheet</span>
                                <span className="print-btn-text-short">Print</span>
                            </button>
                        </div>
                    </div>
                    <div className="toolbar-bottom-row">
                        <div className="toolbar-filters-left">
                            <div className="search-input-pill">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input type="text" id="examSearchInput" placeholder="Search paper, subject..." value={search} onChange={(e) => { renderSeq.current++; setSearch(e.target.value); setPage(1); }} />
                            </div>
                            <select className="subject-select-pill" id="subjectFilterSelect" value={subject} onChange={(e) => { renderSeq.current++; setSubject(e.target.value); setPage(1); }}>
                                {subjectOptions.map(([v, label]) => (
                                    <option key={v} value={v}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="view-toggle-group">
                            <button className={view === 'table' ? 'view-toggle-btn active' : 'view-toggle-btn'} id="btnViewTable" onClick={() => setViewMode('table')}>
                                <span className="view-toggle-full">📊 Marksheet Table</span>
                                <span className="view-toggle-short">📊 Table</span>
                            </button>
                            <button className={view === 'cards' ? 'view-toggle-btn active' : 'view-toggle-btn'} id="btnViewCards" onClick={() => setViewMode('cards')}>
                                <span>🗂 Cards</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="marksheet-table-card anim-fade-up" id="marksheetTableCard" style={{ display: view === 'table' ? 'block' : 'none' }}>
                    <div className="table-container-scroll">
                        <MarksheetTable exams={filtered} typeFilter={typeFilter} />
                    </div>
                </div>
                <div className="exams-list-container anim-fade-up" id="examsContainer" ref={containerRef} style={{ display: view === 'cards' ? 'flex' : 'none' }}>
                    {filtered === null ? (
                        <div className="exam-record-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>Loading examination results...</div>
                    ) : (
                        <ExamCards exams={filtered} info={info || paginate(0, pageSize, 1)} typeFilter={typeFilter} />
                    )}
                </div>
                <div className="cards-pagination-bar anim-fade-up" id="cardsPaginationBar" style={{ display: view === 'cards' && (info || cardsClickSeq === renderSeq.current) ? 'flex' : 'none' }}>
                    <div className="pagination-info-text" id="paginationInfoText">
                        {shownInfo
                            ? `Showing ${shownInfo.startIndex + 1} - ${shownInfo.endIndex} of ${shownInfo.totalItems} examinations ${shownInfo.totalPages > 1 ? `(Page ${shownInfo.page} of ${shownInfo.totalPages})` : ''}`
                            : 'Showing 1 - 3 of 12 examination records (Page 1 of 4)'}
                    </div>
                    <div className="pagination-controls-row" id="paginationButtonsGroup">
                        {shownInfo ? (
                            <>
                                <button className="pg-btn" onClick={() => goPage(shownInfo.page - 1)} disabled={shownInfo.page <= 1} title="Previous Page">◀ Prev</button>
                                {Array.from({ length: shownInfo.totalPages }, (_, i) => i + 1).map((p) => (
                                    <button key={p} className={`pg-btn ${p === shownInfo.page ? 'active' : ''}`} onClick={() => goPage(p)}>{p}</button>
                                ))}
                                <button className="pg-btn" onClick={() => goPage(shownInfo.page + 1)} disabled={shownInfo.page >= shownInfo.totalPages} title="Next Page">Next ▶</button>
                            </>
                        ) : null}
                    </div>
                    <div className="page-size-selector">
                        <span>Cards per page:</span>
                        <button className={pageSize === 3 ? 'size-btn active' : 'size-btn'} id="sizeBtn3" onClick={() => setPageSize(3)}>3</button>
                        <button className={pageSize === 6 ? 'size-btn active' : 'size-btn'} id="sizeBtn6" onClick={() => setPageSize(6)}>6</button>
                        <button className={pageSize === 'all' ? 'size-btn active' : 'size-btn'} id="sizeBtnAll" onClick={() => setPageSize('all')}>All</button>
                    </div>
                </div>
            </main>
        </BodyPortal>
    );
}
