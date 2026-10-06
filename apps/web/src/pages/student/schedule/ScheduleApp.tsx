/**
 * student/schedule.html: academic teaching schedule (department pills, horizontal strip of
 * cubic date cards, detail panel, CSV / .ics export).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const filterDropdownRef = useRef<HTMLDivElement>(null);
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

    const departments = useMemo(() => departmentsOf(allItems), [allItems]);

    const deptCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of allItems) {
            const d = item.department || item.subject || 'Other';
            counts[d] = (counts[d] || 0) + 1;
        }
        return counts;
    }, [allItems]);

    const filteredDeptList = useMemo(() => {
        if (!filterSearch.trim()) return departments;
        const q = filterSearch.toLowerCase();
        return departments.filter((d) => d.toLowerCase().includes(q));
    }, [departments, filterSearch]);

    const applyDepartmentFilter = (newSelected: string[], sourceItems = allItems) => {
        setSelectedDepts(newSelected);
        if (strip.kind === 'error') return;
        const filtered = newSelected.length === 0
            ? sourceItems
            : sourceItems.filter((i) => newSelected.includes(i.department || i.subject || ''));
        showItems(filtered);
    };

    const toggleDept = (dept: string) => {
        let updated: string[];
        if (selectedDepts.includes(dept)) {
            updated = selectedDepts.filter((d) => d !== dept);
        } else {
            updated = [...selectedDepts, dept];
        }
        if (updated.length === departments.length) {
            updated = [];
        }
        applyDepartmentFilter(updated);
    };

    const selectAllDepts = () => {
        applyDepartmentFilter([]);
    };

    const clearDepts = () => {
        applyDepartmentFilter([]);
    };

    const loadScheduleData = async () => {
        try {
            const res = await fetch('/api/academic/schedule');
            if (res.status === 401 || res.status === 403) throw new Error('Please sign in as a student to view your schedule');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const items: ScheduleItem[] = [...(data.schedules || [])];
            setAllItems(items);
            setTotal(items.length);
            const filtered = selectedDepts.length === 0
                ? items
                : items.filter((i) => selectedDepts.includes(i.department || i.subject || ''));
            showItems(filtered);
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

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        if (isFilterOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
            return () => document.removeEventListener('mousedown', handleOutsideClick);
        }
    }, [isFilterOpen]);

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
                <div className="schedule-filter-bar anim-fade-up" style={{ position: 'relative', zIndex: 40, marginBottom: '18px' }} ref={filterDropdownRef}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Primary Multi-Select Dropdown Button */}
                        <button
                            type="button"
                            id="btnDeptMultiFilter"
                            className={`schedule-multiselect-btn${isFilterOpen ? ' open' : ''}${selectedDepts.length > 0 ? ' filtered' : ''}`}
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '7px 14px',
                                background: selectedDepts.length > 0 ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#ffffff',
                                color: selectedDepts.length > 0 ? '#ffffff' : '#334155',
                                border: selectedDepts.length > 0 ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                                borderRadius: '20px',
                                fontSize: '0.82rem',
                                fontWeight: 650,
                                cursor: 'pointer',
                                boxShadow: selectedDepts.length > 0 ? '0 2px 8px rgba(99, 102, 241, 0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            <span>
                                {selectedDepts.length === 0
                                    ? 'Filter Departments'
                                    : `${selectedDepts.length} Department${selectedDepts.length > 1 ? 's' : ''} Selected`}
                            </span>
                            <span
                                style={{
                                    background: selectedDepts.length > 0 ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                    color: selectedDepts.length > 0 ? '#ffffff' : '#64748b',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                }}
                            >
                                {selectedDepts.length === 0 ? departments.length : selectedDepts.length}
                            </span>
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    transform: isFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                }}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {/* Quick "All" Button if filtered */}
                        {selectedDepts.length > 0 && (
                            <button
                                type="button"
                                onClick={selectAllDepts}
                                style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    color: '#475569',
                                    borderRadius: '16px',
                                    padding: '6px 12px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                            >
                                Reset to All
                            </button>
                        )}

                        {/* Selected Chips */}
                        {selectedDepts.length > 0 && selectedDepts.length <= 3 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {selectedDepts.map((d) => (
                                    <span
                                        key={d}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: '#eef2ff',
                                            color: '#4f46e5',
                                            border: '1px solid #c7d2fe',
                                            borderRadius: '14px',
                                            padding: '3px 9px',
                                            fontSize: '0.75rem',
                                            fontWeight: 650,
                                        }}
                                    >
                                        <span>{d}</span>
                                        <span
                                            onClick={(e) => { e.stopPropagation(); toggleDept(d); }}
                                            style={{ cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, opacity: 0.7 }}
                                            title={`Remove ${d}`}
                                        >
                                            ✕
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Summary count */}
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {`Showing ${displayed.length} of ${allItems.length} sessions`}
                        </span>
                    </div>

                    {/* Floating Multi-Select Dropdown Popover */}
                    {isFilterOpen && (
                        <div
                            id="deptMultiSelectDropdown"
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: 0,
                                zIndex: 100,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                boxShadow: '0 14px 38px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(0, 0, 0, 0.05)',
                                width: 'min(360px, 94vw)',
                                maxHeight: '380px',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Popover Header */}
                            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Filter Departments</strong>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Multi-select departments to view</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={selectAllDepts}
                                        style={{ background: 'transparent', border: 'none', color: '#4f46e5', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}
                                    >
                                        Select All
                                    </button>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <button
                                        type="button"
                                        onClick={clearDepts}
                                        style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Popover Search Bar */}
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Search department..."
                                        value={filterSearch}
                                        onChange={(e) => setFilterSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px 6px 28px',
                                            fontSize: '0.78rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '8px',
                                            outline: 'none',
                                            background: '#ffffff',
                                            color: '#1e293b',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                    <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', opacity: 0.6 }}>🔍</span>
                                    {filterSearch && (
                                        <span
                                            onClick={() => setFilterSearch('')}
                                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8' }}
                                        >
                                            ✕
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Scrollable Checkbox List */}
                            <div style={{ overflowY: 'auto', padding: '6px', maxHeight: '220px', flex: 1 }}>
                                {filteredDeptList.map((dep) => {
                                    const isChecked = selectedDepts.length === 0 || selectedDepts.includes(dep);
                                    const count = deptCounts[dep] || 0;
                                    return (
                                        <div
                                            key={dep}
                                            onClick={() => toggleDept(dep)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                background: selectedDepts.includes(dep) ? '#f5f3ff' : 'transparent',
                                                transition: 'background 0.15s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!selectedDepts.includes(dep)) e.currentTarget.style.background = '#f8fafc';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!selectedDepts.includes(dep)) e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '4px',
                                                        border: isChecked
                                                            ? '1.5px solid #6366f1'
                                                            : '1.5px solid #cbd5e1',
                                                        background: isChecked ? '#6366f1' : '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#ffffff',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {isChecked && '✓'}
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {dep}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', fontWeight: 650, flexShrink: 0 }}>
                                                {count}
                                            </span>
                                        </div>
                                    );
                                })}
                                {filteredDeptList.length === 0 && (
                                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                                        No departments matching "{filterSearch}"
                                    </div>
                                )}
                            </div>

                            {/* Popover Footer */}
                            <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', background: '#faf5ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 650 }}>
                                    {selectedDepts.length === 0 ? 'All departments active' : `${selectedDepts.length} selected`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterOpen(false)}
                                    style={{
                                        background: '#7c3aed',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '5px 12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="schedule-scroll-wrapper anim-fade-up">
                    <button type="button" className="schedule-scroll-nav-btn prev" onClick={() => scrollSchedule(-1)} title="Scroll left">◀</button>
                    <div className="schedule-horizontal-strip" id="scheduleHorizontalStrip" ref={stripRef}>
                        {strip.kind === 'loading' ? (
                            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading academic schedule cards...</div>
                        ) : strip.kind === 'error' ? (
                            <div style={{ padding: '24px', color: '#ef4444' }}>Failed to load schedule. ({strip.message})</div>
                        ) : displayed.length === 0 ? (
                            <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedDepts.length === 0 ? 'No teaching sessions have been scheduled for you yet.' : 'No teaching sessions found for selected departments.'}</div>
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
                    loadScheduleData();
                }}
            />
        </BodyPortal>
    );
}
