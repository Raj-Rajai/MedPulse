/**
 * VIEW 2C: Academic Teaching Schedule Editor Mode.
 * Allows administrators and faculty to manage NMC CBME lecture and practical schedules:
 * - View horizontal cubic date strip or tabular lecture overview
 * - Create new teaching sessions with subject, venue, faculty, and competency details
 * - Edit scheduled sessions
 * - Remove scheduled sessions with confirmation
 * - Generate .ics calendar invites and printable lecture plans
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson, todayIso } from '../../lib/http';
import { SUBJECTS } from '../academic';
import type { AdminScheduleItem } from '../../types';
import { AttendanceWaitingRoom } from './AttendanceWaitingRoom';

const DEPTS: [string, string][] = [
    ['all', 'All Departments'],
    ['Department of Pathology', 'Department of Pathology'],
    ['Community Medicine', 'Community Medicine'],
];

const SLOTS = [
    { no: 1, slot: '09:00 - 10:00 AM', label: 'Slot 1 (09:00 - 10:00 AM)' },
    { no: 2, slot: '10:00 - 11:00 AM', label: 'Slot 2 (10:00 - 11:00 AM)' },
    { no: 3, slot: '11:00 AM - 01:00 PM', label: 'Slot 3 (11:00 AM - 01:00 PM)' },
    { no: 4, slot: '01:00 - 02:00 PM', label: 'Slot 4 (01:00 - 02:00 PM)' },
    { no: 5, slot: '02:00 - 04:00 PM', label: 'Slot 5 (02:00 - 04:00 PM)' },
];

interface FormState {
    date_iso: string;
    lecture_no: number;
    time_slot: string;
    subject_code: string;
    subject_name: string;
    session_type: 'Theory' | 'Practical';
    room_no: string;
    faculty_name: string;
    competency_no: string;
    topic: string;
}

const DEFAULT_FORM: FormState = {
    date_iso: todayIso(),
    lecture_no: 1,
    time_slot: '09:00 - 10:00 AM',
    subject_code: 'PA-301',
    subject_name: 'Department of Pathology',
    session_type: 'Theory',
    room_no: 'Lecture Theatre 1 (LT-1)',
    faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
    competency_no: 'PA 12.1',
    topic: 'PA 12.1: Etiopathogenesis and laboratory diagnosis of Iron Deficiency Anaemia',
};

const isDoap = (item: AdminScheduleItem) => (item.teaching_type || '').toUpperCase().includes('DOAP') || item.session_type === 'Practical';

export function ScheduleSection({ active, loadSignal }: { active: boolean; loadSignal: number }) {
    const showToast = useToast();
    const [activePill, setActivePill] = useState('all');
    const [viewMode, setViewMode] = useState<'strip' | 'table'>('strip');
    const [items, setItems] = useState<AdminScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [timelineFilter, setTimelineFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

    // Modal state for Add / Edit
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AdminScheduleItem | null>(null);
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);

    const stripRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<AdminScheduleItem[]>([]);

    const loadSchedule = async (dept = activePill) => {
        setLoading(true);
        setError(null);
        try {
            const query = dept !== 'all' ? `?department=${encodeURIComponent(dept)}` : '';
            const res = await fetch(`/api/admin/academic/schedule${query}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const list: AdminScheduleItem[] = data.schedules || [];
            itemsRef.current = list;
            setItems(list);
            setSelectedIdx((prev) => (prev !== null && prev < list.length ? prev : null));
        } catch (err) {
            console.error('Failed to load admin schedule:', err);
            setError(errMessage(err));
            showToast('Error loading schedule: ' + errMessage(err), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (active) loadSchedule(activePill);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, loadSignal]);

    const filterDepartment = (dept: string) => {
        setActivePill(dept);
        setSelectedIdx(null);
        loadSchedule(dept);
    };

    const selectSchedule = (index: number, scrollIntoView = true) => {
        if (selectedIdx === index) {
            setSelectedIdx(null);
            return;
        }
        if (index < 0 || index >= items.length) return;
        if (!scrollIntoView) {
            setSelectedIdx(index);
            return;
        }
        flushSync(() => setSelectedIdx(index));
        document.getElementById(`adminCubicCard_${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

    const scrollSchedule = (direction: number) => {
        stripRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
    };

    // Open Add Modal
    const handleOpenAdd = () => {
        setEditingItem(null);
        setForm({
            ...DEFAULT_FORM,
            date_iso: todayIso(),
            subject_name: activePill !== 'all' ? activePill : 'Department of Pathology',
            subject_code: activePill.includes('Community') ? '2010043342' : 'PA-301',
        });
        setModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item: AdminScheduleItem) => {
        setEditingItem(item);
        setForm({
            date_iso: item.date_iso || todayIso(),
            lecture_no: item.lecture_no || 1,
            time_slot: item.time_slot || '09:00 - 10:00 AM',
            subject_code: item.subject_code || (item.department?.includes('Community') ? '2010043342' : 'PA-301'),
            subject_name: item.department || item.subject_name || 'Department of Pathology',
            session_type: item.session_type || (item.teaching_type?.includes('DOAP') ? 'Practical' : 'Theory'),
            room_no: item.room_no || item.venue || 'Lecture Theatre 1 (LT-1)',
            faculty_name: item.faculty_name || '',
            competency_no: item.competency_no || '',
            topic: item.topic || '',
        });
        setModalOpen(true);
    };

    // Save Lecture (Create or Update)
    const handleSaveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const fullTopic = form.competency_no && !form.topic.startsWith(form.competency_no)
                ? `${form.competency_no}: ${form.topic}`
                : form.topic;

            const payload = {
                lecture_date: form.date_iso,
                date_iso: form.date_iso,
                lecture_no: Number(form.lecture_no),
                time_slot: form.time_slot,
                subject_code: form.subject_code,
                subject_name: form.subject_name,
                session_type: form.session_type,
                room_no: form.room_no,
                venue: form.room_no,
                faculty_name: form.faculty_name,
                topic: fullTopic,
            };

            if (editingItem) {
                const res = await sendJson(`/api/admin/academic/schedule/${editingItem.id}`, 'PUT', payload);
                const data = await readJson<{ message?: string }>(res);
                if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
                showToast(data.message || 'Teaching session updated successfully', 'success');
            } else {
                const res = await sendJson('/api/admin/academic/schedule', 'POST', payload);
                const data = await readJson<{ message?: string }>(res);
                if (!res.ok) throw new Error(data.error || 'Failed to schedule session');
                showToast(data.message || 'Teaching session scheduled successfully', 'success');
            }

            setModalOpen(false);
            loadSchedule(activePill);
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Delete Lecture Session
    const handleDeleteSession = async (item: AdminScheduleItem) => {
        if (!confirm(`Are you sure you want to delete this teaching session?\n\nDate: ${item.date_iso}\nDepartment: ${item.department}\nTopic: ${item.topic}\n\nThis will also remove any attendance markings associated with this session.`)) {
            return;
        }
        try {
            const res = await fetch(`/api/admin/academic/schedule/${item.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete session');
            showToast(data.message || 'Teaching session removed', 'success');
            loadSchedule(activePill);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    };

    // Download .ics
    const downloadIcs = (current: AdminScheduleItem) => {
        if (!current) return;
        const dateStr = (current.date_iso || '2026-10-02').replace(/-/g, '');
        const icsData = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SAL Education//MedPulse Academic Schedule//EN',
            'BEGIN:VEVENT',
            `SUMMARY:${current.subject || current.department || 'Medical Faculty'}: ${current.competency_no || ''} - ${current.teaching_type || 'Lecture'}`,
            `DESCRIPTION:${current.topic || ''} \\nFaculty: ${current.faculty_name || ''}`,
            `LOCATION:${current.venue || current.room_no || 'Lecture Theatre 1'}`,
            `DTSTART:${dateStr}T090000`,
            `DTEND:${dateStr}T100000`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `Lecture_${current.date_iso}_${(current.competency_no || 'Session').replace(/[^a-zA-Z0-9]/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Calendar event (.ics) downloaded!', 'success');
    };

    const [attendanceLecture, setAttendanceLecture] = useState<AdminScheduleItem | null>(null);
    const handleRequestAttendance = (item: AdminScheduleItem) => setAttendanceLecture(item);

    const d = selectedIdx !== null ? (items[selectedIdx] || null) : null;

    return (
        <div id="viewSchedule" className={`admin-view-pane${active ? ' active' : ''}`}>
            {/* Academic Schedule Hero Banner with intact styling */}
            <div className="attendance-hero anim-fade-up">
                <div className="hero-split-grid">
                    <div className="hero-left-col">
                        <div className="profile-identity-group" style={{ marginBottom: '8px' }}>
                            <div className="profile-avatar-wrapper" style={{ width: '60px', height: '60px', borderRadius: '17px' }}>
                                <div className="profile-avatar-inner" style={{ fontSize: '1.6rem', borderRadius: '14px' }}>🗓</div>
                                <div className="profile-badge-online" title="Editor Active" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span>Academic &amp; Teaching Schedule</span>
                                    <span className="badge" style={{ background: '#f59e0b', color: '#1e1b4b', fontWeight: 800, fontSize: '0.74rem', padding: '3px 8px', borderRadius: '6px' }}>EDITOR MODE</span>
                                </h1>
                                <div className="profile-sub-pills">
                                    <span>SAL Institute of Medical Sciences</span>
                                    <span>•</span>
                                    <span>Faculty Teaching Timetable</span>
                                    <span>•</span>
                                    <span>NMC CBME Timetable</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.5)', fontSize: '0.78rem', padding: '4px 12px' }}>
                                📚 National Medical Commission (NMC) Competency-Based Medical Education (CBME)
                            </span>
                        </div>
                    </div>
                    <div className="hero-gauge-box">
                        <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em', marginBottom: '2px' }}>Schedule Register</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '850', color: '#ffffff' }}>{todayIso()}</div>
                        <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '650', marginTop: '4px' }}>
                            {loading ? 'Refreshing timetable...' : `${items.length} Scheduled Teaching Sessions`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Department Filter Bar & Editor Action Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }} className="anim-fade-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} className="schedule-filter-bar" id="deptFilterGroup">
                    {DEPTS.map(([dept, label]) => (
                        <button
                            key={dept}
                            type="button"
                            className={`schedule-dept-pill${activePill === dept ? ' active' : ''}`}
                            onClick={() => filterDepartment(dept)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* View Switcher: Strip vs Table */}
                    <div className="btn-group" style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                                background: viewMode === 'strip' ? '#ffffff' : 'transparent',
                                color: viewMode === 'strip' ? '#1e293b' : '#64748b',
                                boxShadow: viewMode === 'strip' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: 700,
                                border: 'none',
                            }}
                            onClick={() => setViewMode('strip')}
                        >
                            🗓 Cubic Strip
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                                color: viewMode === 'table' ? '#1e293b' : '#64748b',
                                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: 700,
                                border: 'none',
                            }}
                            onClick={() => setViewMode('table')}
                        >
                            📋 Table List
                        </button>
                    </div>

                    {/* Schedule New Session Button */}
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        onClick={handleOpenAdd}
                        title="Add a new lecture or practical session to the schedule"
                    >
                        <span>➕ Schedule Teaching Session</span>
                    </button>
                </div>
            </div>

            {/* Error banner if loading failed */}
            {error && (
                <div className="card-box anim-fade-up" style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: '18px' }}>
                    <strong>Failed to load schedule:</strong> {error}
                </div>
            )}

            {/* VIEW MODE 1: Horizontal Cubic Strip & Interactive Detail Panel */}
            {viewMode === 'strip' && (
                <>
                    {(() => {
                        const todayIsoStr = todayIso();
                        const pastItems = items.filter((it) => (it.date_iso || '') < todayIsoStr);
                        const upcomingItems = items.filter((it) => (it.date_iso || '') >= todayIsoStr);
                        const displayedItems =
                            timelineFilter === 'past'
                                ? pastItems.slice().reverse()
                                : timelineFilter === 'all'
                                ? items
                                : upcomingItems.length > 0
                                ? upcomingItems
                                : items;
                        return (
                            <>
                                <div className="schedule-scroll-wrapper anim-fade-up">
                                    <button type="button" className="schedule-scroll-nav-btn prev" onClick={() => scrollSchedule(-1)} title="Scroll left">◀</button>
                                    <div className="schedule-horizontal-strip" id="scheduleHorizontalStrip" ref={stripRef}>
                                        {loading ? (
                                            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading academic schedule cards...</div>
                                        ) : displayedItems.length === 0 ? (
                                            <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                No teaching sessions found for this department. Click <strong>&quot;Schedule Teaching Session&quot;</strong> to create one.
                                            </div>
                                        ) : (
                                            <>
                                                {/* Action Toggle Card: Switch between Previous Sessions and Today & Upcoming */}
                                                {timelineFilter === 'upcoming' && pastItems.length > 0 && (
                                                    <div
                                                        className="schedule-cubic-card prev-sessions-toggle-card"
                                                        id="btnAdminShowPastSessionsCard"
                                                        onClick={() => {
                                                            setTimelineFilter('past');
                                                            setSelectedIdx(null);
                                                            setTimeout(() => stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50);
                                                        }}
                                                        title={`Click to view ${pastItems.length} previous sessions (yesterday 05 Oct & earlier)`}
                                                    >
                                                        <div className="cubic-date">⏮</div>
                                                        <div className="cubic-day">PREVIOUS</div>
                                                        <div className="cubic-time">Sessions</div>
                                                    </div>
                                                )}
                                                {timelineFilter === 'past' && (
                                                    <div
                                                        className="schedule-cubic-card return-today-toggle-card"
                                                        id="btnAdminReturnTodayCard"
                                                        onClick={() => {
                                                            setTimelineFilter('upcoming');
                                                            setSelectedIdx(null);
                                                            setTimeout(scrollToToday, 50);
                                                        }}
                                                        title="Return to Today & Upcoming teaching sessions"
                                                    >
                                                        <div className="cubic-date">📅</div>
                                                        <div className="cubic-day">TODAY</div>
                                                        <div className="cubic-time">&amp; Upcoming ▶</div>
                                                    </div>
                                                )}
                                                {displayedItems.map((item, idx) => {
                                                    const isSelected = d !== null && d.id === item.id;
                                                    const isToday = (item.date_iso || '') === todayIsoStr;
                                                    const realIdx = items.indexOf(item);
                                                    return (
                                                        <div
                                                            key={item.id || idx}
                                                            className={`schedule-cubic-card${isSelected ? ' active' : ''}${isToday ? ' today' : ''}`}
                                                            id={`adminCubicCard_${idx}`}
                                                            onClick={() => selectSchedule(realIdx >= 0 ? realIdx : idx)}
                                                            title={`Click to view & edit details for ${item.card_day || ''}, ${item.card_date || ''}`}
                                                        >
                                                            <div className="cubic-date">
                                                                <span>{item.card_date || item.date_iso}</span>
                                                                {isToday && <span className="today-pulse-dot" title="Today's Session">●</span>}
                                                            </div>
                                                            <div className="cubic-day">
                                                                {isToday ? `${item.card_day || 'TODAY'} • TODAY` : (item.card_day || '')}
                                                            </div>
                                                            <div className="cubic-time">{item.card_time || item.time_slot || ''}</div>
                                                            {item.attendance_requested && (
                                                                <div className="cubic-attendance-pill">
                                                                    ✅ Att. Req
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
                                                    setSelectedIdx(null);
                                                    setTimeout(scrollToToday, 50);
                                                }}
                                                title="View today and upcoming sessions"
                                            >
                                                📅 Today &amp; Upcoming ({upcomingItems.length})
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
                                                    setSelectedIdx(null);
                                                    setTimeout(() => stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50);
                                                }}
                                                title="View previous teaching sessions (05 Oct and earlier)"
                                            >
                                                ⏮ Previous Sessions ({pastItems.length})
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
                                                    setSelectedIdx(null);
                                                    setTimeout(scrollToToday, 50);
                                                }}
                                                title="View all teaching sessions"
                                            >
                                                All ({items.length})
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
                                            <span>Previous Cards</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="schedule-pagi-btn"
                                            onClick={() => scrollSchedule(1)}
                                            title="Scroll cards right"
                                        >
                                            <span>Next Cards</span>
                                            <span>▶</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="schedule-today-jump-btn"
                                            onClick={scrollToToday}
                                            title="Jump to Today's session card"
                                        >
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' }} />
                                            <span>Today</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#64748b', fontWeight: '650' }}>
                                        <span>{displayedItems.length} Scheduled Sessions</span>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* Schedule Detail Panel with Editor Actions */}
                    {d ? (
                        <div className="schedule-detail-panel anim-fade-up" id="scheduleDetailPanel">
                            <div className="datewise-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h2 id="detailDeptTitle" style={{ margin: 0 }}>{d.department || 'Department of Pathology'}</h2>
                                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', fontSize: '0.72rem' }}>
                                        Session ID #{d.id}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="schedule-top-calendar-btn"
                                        onClick={() => handleOpenEdit(d)}
                                        title="Edit this teaching session"
                                        style={{ background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)' }}
                                    >
                                        ✏ Edit Session
                                    </button>
                                    <button
                                        type="button"
                                        className="schedule-top-calendar-btn"
                                        onClick={() => handleDeleteSession(d)}
                                        title="Delete this session"
                                        style={{ background: 'rgba(239, 68, 68, 0.4)', border: '1px solid rgba(239, 68, 68, 0.6)' }}
                                    >
                                        🗑 Delete
                                    </button>
                                    <button
                                        type="button"
                                        className="schedule-top-calendar-btn"
                                        id="btnScheduleCalendarTop"
                                        onClick={() => downloadIcs(d)}
                                        title="Download .ics calendar event"
                                    >
                                        📅 .ics
                                    </button>
                                    <button
                                        type="button"
                                        className="schedule-top-close-btn"
                                        onClick={() => setSelectedIdx(null)}
                                        title="Close session details"
                                    >
                                        ✕ Close
                                    </button>
                                </div>
                            </div>
                            <div className="datewise-body-content">
                                <div className="schedule-detail-header-strip">
                                    <span>
                                        📅{' '}
                                        <strong id="detailFullDate">{`${d.card_day || ''}, ${d.card_date || ''} (${d.date_iso})`}</strong>
                                    </span>
                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                    <span>
                                        ⏰{' '}
                                        <strong id="detailFullTime">{d.card_time || d.time_slot || `Slot ${d.lecture_no}`}</strong>
                                    </span>
                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                    <span>
                                        📍{' '}
                                        <strong id="detailVenue">{d.venue || d.room_no || 'Lecture Theatre 1 (LT-1)'}</strong>
                                    </span>
                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                    <span>
                                        🏷{' '}
                                        <strong id="detailSubjectTag">{d.subject || d.department || 'Pathology'}</strong>
                                    </span>
                                    {d.attendance_count !== undefined && d.attendance_count > 0 && (
                                        <>
                                            <span style={{ color: '#cbd5e1' }}>|</span>
                                            <span>
                                                👥 <strong>{d.attendance_count} Cadets Marked</strong>
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="schedule-topic-box">
                                    <div className="schedule-topic-label">NMC CBME Curriculum Topic &amp; Learning Objectives</div>
                                    <div className="schedule-topic-text" id="detailTopic">{d.topic || 'No topic specified.'}</div>
                                </div>
                                <div className="schedule-meta-grid">
                                    <div className="schedule-meta-card">
                                        <div className="schedule-meta-label">Competency No.</div>
                                        <div className="schedule-meta-val" id="detailCompetency" style={{ color: '#4f46e5', fontFamily: 'monospace', fontSize: '1.05rem' }}>
                                            {d.competency_no || 'PA --'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>NMC CBME Syllabus Code</div>
                                    </div>
                                    <div className="schedule-meta-card">
                                        <div className="schedule-meta-label">Staff Member In-Charge</div>
                                        <div className="schedule-meta-val" id="detailFaculty">{d.faculty_name || 'Faculty Staff'}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Faculty In-Charge</div>
                                    </div>
                                    <div className="schedule-meta-card">
                                        <div className="schedule-meta-label">Type of Teaching</div>
                                        <div className="schedule-meta-val" id="detailTeachingMethod">
                                            {isDoap(d) ? (
                                                <span className="badge-teaching-doap">DOAP SESSION</span>
                                            ) : (
                                                <span className="badge-teaching-large">LARGE GROUP TEACHING</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Lecture / Practical / DOAP</div>
                                    </div>
                                    <div className="schedule-meta-card">
                                        <div className="schedule-meta-label">Target Batch &amp; Term</div>
                                        <div className="schedule-meta-val" id="detailBatch">
                                            {`${d.batch_year || '3rd Year MBBS'} • ${d.semester || 'Semester 5'}`}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Clinical Posting Group</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleOpenEdit(d)}
                                            title="Edit this teaching session"
                                        >
                                            ✏ Edit This Session
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDeleteSession(d)}
                                            title="Delete this teaching session"
                                        >
                                            🗑 Delete Session
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"

                                            onClick={() => handleRequestAttendance(d)}
                                            style={{
                                                background: d.attendance_requested
                                                    ? 'linear-gradient(135deg, #059669, #10b981)'
                                                    : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                                border: 'none',
                                                boxShadow: d.attendance_requested
                                                    ? '0 2px 8px rgba(16,185,129,0.35)'
                                                    : '0 2px 8px rgba(79,70,229,0.35)',
                                                fontWeight: '650',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                color: '#ffffff',
                                            }}
                                            title="Open the faculty attendance room"
                                        >
                                            {d.attendance_requested ? 'Open waiting room' : 'Take attendance'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="schedule-detail-placeholder anim-fade-up">
                            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                                📅
                            </div>
                            <div style={{ fontSize: '1.12rem', fontWeight: '800', color: '#1e293b' }}>
                                Select a Teaching Session
                            </div>
                            <div style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '440px', lineHeight: '1.5' }}>
                                Click on any date card above to view curriculum topic, competencies, faculty in-charge, and manage session attendance or settings.
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* VIEW MODE 2: Comprehensive Table Roster for Bulk Administration */}
            {viewMode === 'table' && (
                <div className="card-box anim-fade-up" style={{ padding: '20px', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>All Scheduled Teaching Sessions ({items.length})</h3>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAdd}>➕ Add New Session</button>
                    </div>
                    {items.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No sessions found.</div>
                    ) : (
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 12px' }}>Date</th>
                                    <th style={{ padding: '10px 12px' }}>Slot / Time</th>
                                    <th style={{ padding: '10px 12px' }}>Department</th>
                                    <th style={{ padding: '10px 12px' }}>Type</th>
                                    <th style={{ padding: '10px 12px' }}>Topic &amp; Learning Objectives</th>
                                    <th style={{ padding: '10px 12px' }}>Faculty</th>
                                    <th style={{ padding: '10px 12px' }}>Venue</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                            {item.date_iso}
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{item.card_day}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontWeight: 650, color: '#334155' }}>{item.time_slot || `Lecture ${item.lecture_no}`}</span>
                                        </td>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 650 }}>
                                            {item.department || item.subject_name}
                                        </td>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                            {isDoap(item) ? (
                                                <span className="badge-teaching-doap" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>DOAP</span>
                                            ) : (
                                                <span className="badge-teaching-large" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>THEORY</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 12px', minWidth: '240px', maxWidth: '380px' }}>
                                            {item.competency_no && (
                                                <div style={{ fontFamily: 'monospace', color: '#4f46e5', fontWeight: 750, fontSize: '0.8rem' }}>
                                                    {item.competency_no}
                                                </div>
                                            )}
                                            <div style={{ color: '#0f172a', lineHeight: 1.35 }}>{item.topic}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#334155' }}>
                                            {item.faculty_name || '--'}
                                        </td>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                                            {item.venue || item.room_no || '--'}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${item.attendance_requested ? 'btn-success' : 'btn-primary'}`}
                                                style={{
                                                    marginRight: '6px',
                                                    padding: '4px 8px',
                                                    background: item.attendance_requested ? '#059669' : '#4f46e5',
                                                    borderColor: item.attendance_requested ? '#059669' : '#4f46e5',
                                                    color: '#ffffff',
                                                }}

                                                onClick={() => handleRequestAttendance(item)}
                                                title="Open the faculty attendance room"
                                            >
                                                {item.attendance_requested ? 'Waiting room' : 'Take attendance'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                style={{ marginRight: '6px', padding: '4px 8px' }}
                                                onClick={() => handleOpenEdit(item)}
                                                title="Edit Session"
                                            >
                                                ✏
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger"
                                                style={{ marginRight: '6px', padding: '4px 8px' }}
                                                onClick={() => handleDeleteSession(item)}
                                                title="Delete Session"
                                            >
                                                🗑
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                style={{ padding: '4px 8px' }}
                                                onClick={() => downloadIcs(item)}
                                                title="Download .ics"
                                            >
                                                📅
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* MODAL: Add / Edit Teaching Session */}
            {modalOpen && (
                <div className="modal-overlay" style={{ display: 'flex', zIndex: 1050 }}>
                    <div className="modal-box" style={{ maxWidth: 650, width: '92%', borderRadius: '16px' }}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    {editingItem ? '✏ Edit Teaching Session' : '➕ Schedule New Teaching Session'}
                                </h3>
                                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    NMC Competency-Based Medical Education (CBME) curriculum timetable
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => !saving && setModalOpen(false)}
                                disabled={saving}
                                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveSession}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    {/* Date */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Lecture Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            className="form-control"
                                            value={form.date_iso}
                                            onChange={(e) => setForm({ ...form, date_iso: e.target.value })}
                                        />
                                    </div>

                                    {/* Slot Number / Time */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Time Slot *
                                        </label>
                                        <select
                                            className="form-control"
                                            value={form.time_slot}
                                            onChange={(e) => {
                                                const found = SLOTS.find((s) => s.slot === e.target.value);
                                                setForm({
                                                    ...form,
                                                    time_slot: e.target.value,
                                                    lecture_no: found ? found.no : form.lecture_no,
                                                });
                                            }}
                                        >
                                            {SLOTS.map((s) => (
                                                <option key={s.slot} value={s.slot}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    {/* Subject / Department */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Subject / Department *
                                        </label>
                                        <select
                                            className="form-control"
                                            value={form.subject_code}
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                const found = SUBJECTS.find((s) => s.value === code);
                                                const cleanName = found ? found.label.replace(/^\s*\S+\s*[–—-]\s*/, '').trim() : 'Department of Pathology';
                                                setForm({
                                                    ...form,
                                                    subject_code: code,
                                                    subject_name: cleanName,
                                                    room_no: code === 'PA-301' ? 'Lecture Theatre 1 (LT-1)' : 'LT-2',
                                                    faculty_name: code === 'PA-301' ? 'Dr. Ramesh Mehta (Prof & HOD)' : 'DRASHTI R SONI',
                                                });
                                            }}
                                        >
                                            {SUBJECTS.map((s) => (
                                                <option key={s.value} value={s.value}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Session Type */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Session Type *
                                        </label>
                                        <select
                                            className="form-control"
                                            value={form.session_type}
                                            onChange={(e) => {
                                                const st = e.target.value as 'Theory' | 'Practical';
                                                setForm({
                                                    ...form,
                                                    session_type: st,
                                                    room_no: st === 'Practical'
                                                        ? (form.subject_code === 'PA-301' ? 'Pathology Practical Lab' : 'Field Survey Centre')
                                                        : (form.subject_code === 'PA-301' ? 'Lecture Theatre 1 (LT-1)' : 'LT-2'),
                                                });
                                            }}
                                        >
                                            <option value="Theory">Theory (Interactive Didactic Lecture)</option>
                                            <option value="Practical">Practical (DOAP Hands-on Session)</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    {/* Room / Venue */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Venue / Room No.
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Lecture Theatre 1 (LT-1)"
                                            value={form.room_no}
                                            onChange={(e) => setForm({ ...form, room_no: e.target.value })}
                                        />
                                    </div>

                                    {/* Faculty Staff In-Charge */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Faculty In-Charge *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="form-control"
                                            placeholder="e.g. Dr. Ramesh Mehta (Prof & HOD)"
                                            value={form.faculty_name}
                                            onChange={(e) => setForm({ ...form, faculty_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px' }}>
                                    {/* Competency No */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            NMC Code
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. PA 12.1"
                                            value={form.competency_no}
                                            onChange={(e) => setForm({ ...form, competency_no: e.target.value })}
                                        />
                                    </div>

                                    {/* Curriculum Topic */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                                            Topic &amp; Learning Objectives *
                                        </label>
                                        <textarea
                                            required
                                            rows={3}
                                            className="form-control"
                                            placeholder="Describe the CBME syllabus topic, learning objectives, and clinical correlations..."
                                            value={form.topic}
                                            onChange={(e) => setForm({ ...form, topic: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #e2e8f0' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setModalOpen(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : editingItem ? '💾 Update Session' : '➕ Schedule Session'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {attendanceLecture && <AttendanceWaitingRoom key={attendanceLecture.id} lecture={attendanceLecture}
                onClose={() => { setAttendanceLecture(null); loadSchedule(activePill); }} onChanged={() => loadSchedule(activePill)}/>}
        </div>
    );
}
