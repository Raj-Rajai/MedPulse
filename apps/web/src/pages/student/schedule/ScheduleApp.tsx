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
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [detail, setDetail] = useState<ScheduleItem | null>(null);
    const [timelineFilter, setTimelineFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const [fillModalOpen, setFillModalOpen] = useState(false);
    const [fillSession, setFillSession] = useState<FillableLecture | null>(null);
    const [emptyTopic, setEmptyTopic] = useState(false);
    const [total, setTotal] = useState<number | null>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const displayed = strip.kind === 'list' ? strip.items : [];
    const displayedRef = useRef<ScheduleItem[]>([]);

    const getItemKey = (item: ScheduleItem) =>
        String(item.id ?? `${item.date_iso}_${item.lecture_no || ''}_${item.time_slot || item.card_time || ''}_${item.subject || ''}`);

    const selectScheduleItem = (item: ScheduleItem, cardDomId?: string) => {
        const key = getItemKey(item);
        if (selectedKey === key && detail) {
            // Clicking currently open card toggles it closed
            setSelectedKey(null);
            setDetail(null);
            return;
        }
        setSelectedKey(key);
        setDetail(item);
        setEmptyTopic(false);
        if (cardDomId) {
            const el = stripRef.current;
            const card = document.getElementById(cardDomId);
            if (el && card) {
                const left = card.offsetLeft - el.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
                el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
            }
        }
    };

    const scrollToToday = () => {
        const stripEl = stripRef.current;
        if (!stripEl) return;
        const todayCard = stripEl.querySelector('.schedule-cubic-card.today') as HTMLElement | null;
        if (todayCard) {
            const left = todayCard.offsetLeft - stripEl.offsetLeft - (stripEl.clientWidth - todayCard.offsetWidth) / 2;
            stripEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        } else {
            stripEl.scrollTo({ left: 0, behavior: 'smooth' });
        }
    };

    const showItems = (items: ScheduleItem[]) => {
        displayedRef.current = items;
        flushSync(() => setStrip({ kind: 'list', items }));
        // Detailed card is NOT automatically opened; only upon clicking
        setSelectedKey(null);
        setDetail(null);
        setEmptyTopic(false);
        if (items.length > 0) {
            setTimeout(() => {
                scrollToToday();
            }, 60);
        } else {
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
        const current = detail;
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
    const todayIsoStr = localIso(today);

    // Split displayed into past (< today) and upcoming (>= today) sessions
    const pastSessions = displayed.filter((i) => (i.date_iso || '') < todayIsoStr);
    const upcomingSessions = displayed.filter((i) => (i.date_iso || '') >= todayIsoStr);

    const sessionsToDisplay =
        timelineFilter === 'past'
            ? pastSessions.slice().reverse()
            : timelineFilter === 'all'
            ? displayed
            : upcomingSessions.length > 0
            ? upcomingSessions
            : displayed;

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
                                        <span>Schedule</span>
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
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.5)', fontSize: '0.78rem', padding: '4px 12px' }}>📚 NMC CBME curriculum</span>
                            </div>
                        </div>
                        <div className="hero-gauge-box">
                            <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em', marginBottom: '2px' }}>Today</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '850', color: '#ffffff' }} id="heroTodayDateLabel">{longDate(today)}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '650', marginTop: '4px' }} id="heroTotalSessionsCount">{total === null ? 'Loading teaching schedule...' : `${total} sessions scheduled`}</div>
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
                            <>
                                {/* Action Toggle Card: Switch between Previous Sessions and Today & Upcoming */}
                                {timelineFilter === 'upcoming' && pastSessions.length > 0 && (
                                    <div
                                        className="schedule-cubic-card prev-sessions-toggle-card"
                                        id="btnStudentShowPastSessionsCard"
                                        onClick={() => {
                                            setTimelineFilter('past');
                                            setSelectedKey(null);
                                            setDetail(null);
                                            setTimeout(() => stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50);
                                        }}
                                        title={`Click to view ${pastSessions.length} previous teaching sessions (yesterday 05 Oct & earlier)`}
                                    >
                                        <div className="cubic-date">⏮</div>
                                        <div className="cubic-day">Earlier</div>
                                        <div className="cubic-time">Sessions</div>
                                    </div>
                                )}
                                {timelineFilter === 'past' && (
                                    <div
                                        className="schedule-cubic-card return-today-toggle-card"
                                        id="btnStudentReturnTodayCard"
                                        onClick={() => {
                                            setTimelineFilter('upcoming');
                                            setSelectedKey(null);
                                            setDetail(null);
                                            setTimeout(scrollToToday, 50);
                                        }}
                                        title="Return to Today & Upcoming teaching sessions"
                                    >
                                        <div className="cubic-date">📅</div>
                                        <div className="cubic-day">Today</div>
                                        <div className="cubic-time">&amp; Upcoming ▶</div>
                                    </div>
                                )}
                                {sessionsToDisplay.map((item, idx) => {
                                    const key = getItemKey(item);
                                    const isSelected = selectedKey === key;
                                    const isToday = (item.date_iso || '') === todayIsoStr;
                                    const domId = `cubicCard_${idx}`;
                                    return (
                                        <div
                                            key={`${idx}_${key}`}
                                            className={`schedule-cubic-card${isSelected ? ' active' : ''}${isToday ? ' today' : ''}`}
                                            id={domId}
                                            onClick={() => selectScheduleItem(item, domId)}
                                            title={`Click to view details for ${item.card_day || ''}, ${item.card_date || ''}`}
                                        >
                                            <div className="cubic-date">
                                                <span>{item.card_date || ''}</span>
                                                {isToday && <span className="today-pulse-dot" title="Today's Session">●</span>}
                                            </div>
                                            <div className="cubic-day">
                                                {isToday ? `${item.card_day || 'Today'} • Today` : (item.card_day || '')}
                                            </div>
                                            <div className="cubic-time">{item.card_time || item.time_slot || ''}</div>
                                            {item.attendance_requested && (
                                                <div className="cubic-attendance-pill">
                                                    📢 Att. Req
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                    <button type="button" className="schedule-scroll-nav-btn next" onClick={() => scrollSchedule(1)} title="Scroll right">▶</button>
                </div>

                {/* Pagination Controls Toolbar */}
                <div className="schedule-pagination-bar anim-fade-up">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Timeline Switcher: Upcoming vs. Previous vs. All */}
                        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '3px' }}>
                            <button
                                type="button"
                                className={`schedule-pagi-btn${timelineFilter === 'upcoming' ? ' active' : ''}`}
                                style={{
                                    background: timelineFilter === 'upcoming' ? '#ffffff' : 'transparent',
                                    color: timelineFilter === 'upcoming' ? '#4f46e5' : '#64748b',
                                    borderColor: timelineFilter === 'upcoming' ? '#cbd5e1' : 'transparent',
                                    boxShadow: timelineFilter === 'upcoming' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    fontWeight: timelineFilter === 'upcoming' ? 750 : 600,
                                    padding: '5px 11px',
                                    fontSize: '0.76rem',
                                }}
                                onClick={() => {
                                    setTimelineFilter('upcoming');
                                    setSelectedKey(null);
                                    setDetail(null);
                                    setTimeout(scrollToToday, 50);
                                }}
                                title="View today and upcoming sessions"
                            >
                                📅 Today &amp; Upcoming ({upcomingSessions.length})
                            </button>
                            <button
                                type="button"
                                className={`schedule-pagi-btn${timelineFilter === 'past' ? ' active' : ''}`}
                                style={{
                                    background: timelineFilter === 'past' ? '#ffffff' : 'transparent',
                                    color: timelineFilter === 'past' ? '#7e22ce' : '#64748b',
                                    borderColor: timelineFilter === 'past' ? '#cbd5e1' : 'transparent',
                                    boxShadow: timelineFilter === 'past' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    fontWeight: timelineFilter === 'past' ? 750 : 600,
                                    padding: '5px 11px',
                                    fontSize: '0.76rem',
                                }}
                                onClick={() => {
                                    setTimelineFilter('past');
                                    setSelectedKey(null);
                                    setDetail(null);
                                    setTimeout(() => stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50);
                                }}
                                title="View previous teaching sessions (05 Oct and earlier)"
                            >
                                ⏮ Previous Sessions ({pastSessions.length})
                            </button>
                            <button
                                type="button"
                                className={`schedule-pagi-btn${timelineFilter === 'all' ? ' active' : ''}`}
                                style={{
                                    background: timelineFilter === 'all' ? '#ffffff' : 'transparent',
                                    color: timelineFilter === 'all' ? '#0f172a' : '#64748b',
                                    borderColor: timelineFilter === 'all' ? '#cbd5e1' : 'transparent',
                                    boxShadow: timelineFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    fontWeight: timelineFilter === 'all' ? 750 : 600,
                                    padding: '5px 11px',
                                    fontSize: '0.76rem',
                                }}
                                onClick={() => {
                                    setTimelineFilter('all');
                                    setSelectedKey(null);
                                    setDetail(null);
                                    setTimeout(scrollToToday, 50);
                                }}
                                title="View all teaching sessions"
                            >
                                All ({displayed.length})
                            </button>
                        </div>

                        {/* Navigation Scroll Buttons */}
                        <button
                            type="button"
                            className="schedule-pagi-btn"
                            onClick={() => scrollSchedule(-1)}
                            title="Scroll cards left"
                        >
                            <span>◀</span>
                            <span>Earlier</span>
                        </button>
                        <button
                            type="button"
                            className="schedule-pagi-btn"
                            onClick={() => scrollSchedule(1)}
                            title="Scroll cards right"
                        >
                            <span>Later</span>
                            <span>▶</span>
                        </button>
                        {timelineFilter !== 'past' && (
                            <button
                                type="button"
                                className="schedule-today-jump-btn"
                                onClick={scrollToToday}
                                title="Jump to Today's session card"
                            >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' }} />
                                <span>Today ({today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})</span>
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#64748b', fontWeight: '650' }}>
                        <span>{sessionsToDisplay.length} Sessions ({timelineFilter === 'past' ? 'Previous' : timelineFilter === 'upcoming' ? 'Upcoming' : 'Total'})</span>
                    </div>
                </div>

                {/* Detail card is only opened upon clicking; otherwise placeholder is shown */}
                {d ? (
                    <div className="schedule-detail-panel anim-fade-up" id="scheduleDetailPanel">
                        <div className="datewise-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', flexWrap: 'wrap', gap: '10px' }}>
                            <h2 id="detailDeptTitle">{d.department || d.subject || 'Teaching Session'}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="schedule-top-calendar-btn"
                                    id="btnScheduleCalendarTop"
                                    onClick={downloadIcs}
                                    title="Add lecture to calendar (.ics)"
                                >
                                    📅 Add to Calendar (.ics)
                                </button>
                                <button
                                    type="button"
                                    className="schedule-top-close-btn"
                                    onClick={() => { setSelectedKey(null); setDetail(null); }}
                                    title="Close details"
                                >
                                    ✕ Close
                                </button>
                            </div>
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
            ) : (
                <div className="schedule-detail-placeholder anim-fade-up" id="scheduleDetailPlaceholder">
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                        📅
                    </div>
                    <div style={{ fontSize: '1.12rem', fontWeight: '800', color: '#1e293b' }}>
                        Select a Teaching Session
                    </div>
                    <div style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '440px', lineHeight: '1.5' }}>
                        Click on any date card above to view the NMC CBME curriculum topic, learning objectives, faculty in-charge, and mark attendance.
                    </div>
                </div>
            )}
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
