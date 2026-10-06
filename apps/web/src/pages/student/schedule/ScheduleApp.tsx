/**
 * student/schedule.html: academic teaching schedule (department pills, horizontal strip of
 * cubic date cards, detail panel, CSV / .ics export).
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { StudentBadge, StudentSignInLink, readAuthUser } from '../common/badges';
import { scheduleSidebar } from '../common/sidebar';
import { TOAST_PLAIN, useToasts } from '../common/Toasts';
import { errMsg } from '../common/utils';
import { MedPulseAuth } from '../../../shared/session';
import { FillAttendanceModal, type FillableLecture } from '../common/FillAttendanceModal';
import { ActiveAttendanceBanner } from '../common/StudentAttendanceRoom';

interface ScheduleItem {
    id?: number;
    lecture_no?: number | string;
    card_date?: string;
    card_day?: string;
    card_time?: string;
    time_slot?: string;
    date_iso?: string;
    department?: string;
    teaching_type?: string;
    venue?: string;
    subject?: string;
    subject_code?: string;
    topic?: string;
    competency_no?: string;
    faculty_name?: string;
    batch_year?: string;
    semester?: string;
    attendance_requested?: boolean;
    attendance_requested_at?: string | null;
    attendance_status?: string | null;
}

type Strip = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'list'; items: ScheduleItem[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const longDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Department pills come from the sessions themselves (one per subject the student has lectures in). */
function departmentsOf(items: ScheduleItem[]): string[] {
    return [...new Set(items.map((i) => i.department || i.subject || '').filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** The session to open first: the next one from today onwards, else the most recent one. */
function defaultIndex(items: ScheduleItem[]): number {
    const today = localIso(new Date());
    const next = items.findIndex((i) => (i.date_iso || '') >= today);
    return next >= 0 ? next : items.length - 1;
}

/** "09:00-10:00" / "08:10 to 08:55" -> ['0900', '1000']; null when the slot has no clock times. */
function slotTimes(slot: string | undefined): [string, string] | null {
    const m = /(\d{1,2}):(\d{2})\s*(?:-|–|to)\s*(\d{1,2}):(\d{2})/i.exec(slot || '');
    if (!m) return null;
    return [m[1].padStart(2, '0') + m[2], m[3].padStart(2, '0') + m[4]];
}

/** RFC 5545 text escaping for .ics values. */
const icsText = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const isDoap = (item: ScheduleItem) => (item.teaching_type || '').toUpperCase().includes('DOAP');

function logoutStudent() {
    MedPulseAuth.logout();
}

export function ScheduleApp() {
    useStudentChrome(scheduleSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_PLAIN);
    const [user] = useState(readAuthUser);
    const [activePill, setActivePill] = useState('all');
    const [strip, setStrip] = useState<Strip>({ kind: 'loading' });
    const [allItems, setAllItems] = useState<ScheduleItem[]>([]);
    const [selected, setSelected] = useState(0);
    const [detail, setDetail] = useState<ScheduleItem | null>(null);
    const [fillModalOpen, setFillModalOpen] = useState(false);
    const [fillSession, setFillSession] = useState<FillableLecture | null>(null);
    const [emptyTopic, setEmptyTopic] = useState(false);
    const [total, setTotal] = useState<number | null>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const displayed = strip.kind === 'list' ? strip.items : [];
    const displayedRef = useRef<ScheduleItem[]>([]);
    const selectedRef = useRef(0);

    const selectSchedule = (index: number, scrollIntoView = true) => {
        const list = displayedRef.current;
        if (index < 0 || index >= list.length) return;
        selectedRef.current = index;
        if (!scrollIntoView) {
            setSelected(index);
            setDetail(list[index]);
            setEmptyTopic(false);
            return;
        }
        // The original moved the "active" class before scrolling the card into view (the active card is larger).
        flushSync(() => setSelected(index));
        scrollCardIntoView(index);
        setDetail(list[index]);
        setEmptyTopic(false);
    };

    /** Scrolls only the card strip (scrollIntoView would also scroll the page down to it). */
    const scrollCardIntoView = (index: number, behavior: ScrollBehavior = 'smooth') => {
        const stripEl = stripRef.current;
        const card = document.getElementById(`cubicCard_${index}`);
        if (!stripEl || !card) return;
        const left = card.offsetLeft - stripEl.offsetLeft - (stripEl.clientWidth - card.offsetWidth) / 2;
        stripEl.scrollTo({ left: Math.max(0, left), behavior });
    };

    const showItems = (items: ScheduleItem[]) => {
        displayedRef.current = items;
        flushSync(() => setStrip({ kind: 'list', items }));
        if (items.length > 0) {
            const idx = defaultIndex(items);
            selectSchedule(idx, false);
            scrollCardIntoView(idx, 'auto');
        } else {
            selectedRef.current = 0;
            setSelected(0);
            setDetail(null);
            setEmptyTopic(true);
        }
    };

    const loadScheduleData = async (dept = 'all') => {
        try {
            const res = await fetch('/api/academic/schedule');
            if (res.status === 401 || res.status === 403) throw new Error('Please sign in as a student to view your schedule');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const items: ScheduleItem[] = [...(data.schedules || [])];
            setAllItems(items);
            setTotal(items.length);
            showItems(dept === 'all' ? items : items.filter((i) => (i.department || i.subject) === dept));
        } catch (err) {
            console.error('Failed to load academic schedule:', err);
            showToast('Error loading schedule: ' + errMsg(err), 'error');
            setStrip({ kind: 'error', message: errMsg(err) });
        }
    };

    useEffect(() => {
        loadScheduleData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filtering is done on the loaded list, so switching pills is instant and can't race a slower request.
    const filterDepartment = (dept: string) => {
        setActivePill(dept);
        if (strip.kind === 'error') return;
        showItems(dept === 'all' ? allItems : allItems.filter((i) => (i.department || i.subject) === dept));
    };
    const departments = departmentsOf(allItems);


    const downloadIcs = () => {
        const current = displayedRef.current[selectedRef.current];
        if (!current) {
            showToast('Please select a lecture to download calendar invite.', 'error');
            return;
        }
        const dateStr = (current.date_iso || localIso(new Date())).replace(/-/g, '');
        const [start, end] = slotTimes(current.time_slot || current.card_time) || ['0900', '1000'];
        const icsData = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SAL Education//MedPulse Academic Schedule//EN',
            'BEGIN:VEVENT',
            `UID:medpulse-lecture-${current.date_iso}-${start}-${(current.subject_code || current.subject || 'session').replace(/[^a-zA-Z0-9]/g, '')}@medpulse`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
            `SUMMARY:${icsText(`${current.subject || 'Lecture'}${current.competency_no ? ` (${current.competency_no})` : ''} - ${current.teaching_type || 'Lecture'}`)}`,
            `DESCRIPTION:${icsText(current.topic || '')}\\nFaculty: ${icsText(current.faculty_name || '')}`,
            `LOCATION:${icsText(current.venue || 'Lecture Theatre 1')}`,
            `DTSTART:${dateStr}T${start}00`,
            `DTEND:${dateStr}T${end}00`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `Lecture_${current.date_iso}_${(current.competency_no || current.subject || 'Session').replace(/[^a-zA-Z0-9]/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        showToast('Calendar event (.ics) downloaded!', 'success');
    };

    const scrollSchedule = (direction: number) => {
        const el = stripRef.current;
        if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
    };
    const today = new Date();

    const d = detail;
    const roll = user ? String(user.roll_number || '235') : null;

    return (
        <BodyPortal>
            <SidebarOverlay onClose={scheduleSidebar.close} />
            <StudentSidebar
                active="schedule" onToggle={scheduleSidebar.toggle}
                badge={roll ? <StudentBadge roll={roll} mode="logout" onLogout={logoutStudent} /> : <StudentSignInLink />}
            />
            <MobileNavToggle onToggle={scheduleSidebar.toggle} />
            {toasts}
            <main className="main-content">
                <ActiveAttendanceBanner onOpen={() => { setFillSession(null); setFillModalOpen(true); }}/>
                <div className="attendance-hero anim-fade-up">
                    <div className="hero-split-grid">
                        <div className="hero-left-col">
                            <div className="profile-identity-group" style={{ marginBottom: '8px' }}>
                                <div className="profile-avatar-wrapper" style={{ width: '60px', height: '60px', borderRadius: '17px' }}>
                                    <div className="profile-avatar-inner" style={{ fontSize: '1.6rem', borderRadius: '14px' }}>🗓</div>
                                    <div className="profile-badge-online" title="Active Semester" />
                                </div>
                                <div>
                                    <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>Academic &amp; Teaching Schedule</span>
                                        <span className="profile-roll-tag" id="heroRollBadge">{`Roll ${roll || '235'}`}</span>
                                    </h1>
                                    <div className="profile-sub-pills">
                                        <span id="heroCadetName">{(user && user.name) || 'Dhruv Patel'}</span>
                                        <span>•</span>
                                        <span id="heroCadetBatch">{(user && user.batch_year) || '3rd Year MBBS'}</span>
                                        <span>•</span>
                                        <span>Semester - 5</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.5)', fontSize: '0.78rem', padding: '4px 12px' }}>📚 National Medical Commission (NMC) Competency-Based Medical Education (CBME)</span>
                            </div>
                        </div>
                        <div className="hero-gauge-box">
                            <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em', marginBottom: '2px' }}>Today's Date</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '850', color: '#ffffff' }} id="heroTodayDateLabel">{longDate(today)}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '650', marginTop: '4px' }} id="heroTotalSessionsCount">{total === null ? 'Loading teaching schedule...' : `${total} Scheduled Teaching Sessions`}</div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }} className="anim-fade-up">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} className="schedule-filter-bar" id="deptFilterGroup">
                        {[['all', 'All Departments'], ...departments.map((dep) => [dep, dep])].map(([dept, label]) => (
                            <button key={dept} type="button" className={`schedule-dept-pill${activePill === dept ? ' active' : ''}`} onClick={() => filterDepartment(dept)}>{label}</button>
                        ))}
                    </div>
                </div>
                <div className="schedule-scroll-wrapper anim-fade-up">
                    <button type="button" className="schedule-scroll-nav-btn prev" onClick={() => scrollSchedule(-1)} title="Scroll left">◀</button>
                    <div className="schedule-horizontal-strip" id="scheduleHorizontalStrip" ref={stripRef}>
                        {strip.kind === 'loading' ? (
                            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading academic schedule cards...</div>
                        ) : strip.kind === 'error' ? (
                            <div style={{ padding: '24px', color: '#ef4444' }}>Failed to load schedule. ({strip.message})</div>
                        ) : displayed.length === 0 ? (
                            <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{activePill === 'all' ? 'No teaching sessions have been scheduled for you yet.' : 'No teaching sessions found for this department.'}</div>
                        ) : (
                            displayed.map((item, idx) => (
                                <div
                                    key={idx} className={`schedule-cubic-card${idx === selected ? ' active' : ''}${(item.date_iso || '') === localIso(today) ? ' today' : ''}`} id={`cubicCard_${idx}`}
                                    onClick={() => selectSchedule(idx)} title={`Click to view details for ${item.card_day || ''}, ${item.card_date || ''}`}
                                >
                                    <div className="cubic-date">{item.card_date || ''}</div>
                                    <div className="cubic-day">{item.card_day || ''}</div>
                                    <div className="cubic-time">{item.card_time || ''}</div>
                                    {item.attendance_requested && (
                                        <div style={{ fontSize: '0.66rem', color: '#b45309', fontWeight: '750', marginTop: '4px', background: 'rgba(254, 243, 199, 0.9)', borderRadius: '4px', padding: '1px 5px', textAlign: 'center' }}>
                                            📢 Att. Req
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <button type="button" className="schedule-scroll-nav-btn next" onClick={() => scrollSchedule(1)} title="Scroll right">▶</button>
                </div>
                <div className="schedule-detail-panel anim-fade-up" id="scheduleDetailPanel">
                    <div className="datewise-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                        <h2 id="detailDeptTitle">{d ? d.department || d.subject || 'Teaching Session' : 'Teaching Session'}</h2>
                        <button
                            type="button"
                            className="schedule-top-calendar-btn"
                            id="btnScheduleCalendarTop"
                            onClick={downloadIcs}
                            title="Add lecture to calendar (.ics)"
                        >
                            📅 Add to Calendar (.ics)
                        </button>
                    </div>
                    <div className="datewise-body-content">
                        <div className="schedule-detail-header-strip">
                            <span>
                                📅{' '}
                                <strong id="detailFullDate">{d ? `${d.card_day}, ${d.card_date} (${d.date_iso})` : '--'}</strong>
                            </span>
                            <span className="schedule-detail-sep">|</span>
                            <span>
                                ⏰{' '}
                                <strong id="detailFullTime">{d ? d.card_time || d.time_slot || '' : '--'}</strong>
                            </span>
                            <span className="schedule-detail-sep">|</span>
                            <span>
                                📍{' '}
                                <strong id="detailVenue">{d ? d.venue || 'Lecture Theatre 1 (LT-1)' : '--'}</strong>
                            </span>
                            <span className="schedule-detail-sep">|</span>
                            <span>
                                🏷{' '}
                                <strong id="detailSubjectTag">{d ? d.subject || d.department || '--' : '--'}</strong>
                            </span>
                        </div>
                        <div className="schedule-topic-box">
                            <div className="schedule-topic-label">NMC CBME Curriculum Topic &amp; Learning Objectives</div>
                            <div className="schedule-topic-text" id="detailTopic">{emptyTopic ? 'No session selected.' : d ? d.topic || 'No topic specified.' : 'Loading lecture topic details...'}</div>
                        </div>
                        <div className="schedule-meta-grid">
                            <div className="schedule-meta-card">
                                <div className="schedule-meta-label">{d && !d.competency_no && d.subject_code ? 'Subject Code' : 'Competency No.'}</div>
                                <div className="schedule-meta-val" id="detailCompetency" style={{ color: '#4f46e5', fontFamily: 'monospace', fontSize: '1.05rem' }}>{d ? d.competency_no || d.subject_code || '--' : '--'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>{d && !d.competency_no && d.subject_code ? 'University Subject Code' : 'NMC CBME Syllabus Code'}</div>
                            </div>
                            <div className="schedule-meta-card">
                                <div className="schedule-meta-label">Staff Member In-Charge</div>
                                <div className="schedule-meta-val" id="detailFaculty">{d ? d.faculty_name || 'Faculty Staff' : '--'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Faculty In-Charge</div>
                            </div>
                            <div className="schedule-meta-card">
                                <div className="schedule-meta-label">Type of Teaching</div>
                                <div className="schedule-meta-val" id="detailTeachingMethod">{d ? (isDoap(d) ? 'DOAP (Demonstration, Observation, Assistance, Performance)' : 'Large Group Teaching (Interactive Didactic Lecture)') : '--'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Lecture / Practical / DOAP</div>
                            </div>
                            <div className="schedule-meta-card">
                                <div className="schedule-meta-label">Target Batch &amp; Term</div>
                                <div className="schedule-meta-val" id="detailBatch">{d ? `${d.batch_year || '3rd Year MBBS'} • ${d.semester || 'Semester 5'}` : '3rd Year MBBS • Semester 5'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Clinical Posting Group</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                {d?.attendance_status && d.attendance_status !== 'Not Marked' ? (
                                    <span style={{ fontSize: '0.82rem', fontWeight: '700', padding: '6px 12px', borderRadius: '20px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span>Status:</span>
                                        <span>{d.attendance_status === 'Present' ? '✅ Present' : d.attendance_status === 'Field Duty' ? '🏡 Field Duty' : d.attendance_status === 'Leave' ? '🟡 Leave' : d.attendance_status}</span>
                                    </span>
                                ) : d?.attendance_requested ? (
                                    <span style={{ fontSize: '0.82rem', fontWeight: '700', padding: '6px 12px', borderRadius: '20px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span>📢 Attendance Requested by Faculty</span>
                                    </span>
                                ) : null}
                            </div>
                            <div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={!d}
                                    onClick={() => { setFillSession(d); setFillModalOpen(true); }}
                                    style={{
                                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        border: 'none',
                                        boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                                        fontWeight: '700',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '9px 18px',
                                        fontSize: '0.9rem',
                                        borderRadius: '10px',
                                    }}
                                    title="View this lecture?s attendance session"
                                >
                                    📝 Fill Attendance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <FillAttendanceModal
                open={fillModalOpen}
                session={fillSession}
                onClose={() => setFillModalOpen(false)}
                onSuccess={(msg) => {
                    showToast(msg, 'success');
                    loadScheduleData(activePill);
                }}
            />
        </BodyPortal>
    );
}
