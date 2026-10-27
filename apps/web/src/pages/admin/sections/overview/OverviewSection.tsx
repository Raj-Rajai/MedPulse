/**
 * VIEW 1: Analysis. Headline numbers and charts for the survey programme, filtered by academic year,
 * study year and period. Student and household figures come from the roster and the household
 * registry; the disease burden comes from /api/admin/stats and covers every student.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { ChartCanvas } from '../../components/ChartCanvas';
import { useToast } from '../../hooks/useToasts';
import { academicYearOf, byAcademicYear, byStudyOrder, distinctSorted, ENROLLMENT_LABEL, studyYearOf } from '../../lib/academic';
import { errMessage } from '../../lib/http';
import type { AcademicYear, AdminStats, AdminTab, Cadet, Household } from '../../types';

const BLUE = '#1d4ed8';
const PALETTE = ['#1d4ed8', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#14b8a6', '#f97316'];
const PERIODS: { key: string; label: string; months: number | null }[] = [
    { key: '3', label: 'Last 3 months', months: 3 },
    { key: '6', label: 'Last 6 months', months: 6 },
    { key: '12', label: 'Last 12 months', months: 12 },
    { key: 'all', label: 'All time', months: null },
];

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('en-IN'));
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%');
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

/** Survey date of a household (survey_date, else created_at), or null when unreadable. */
function surveyDate(f: Household): Date | null {
    const raw = f.survey_date || f.created_at;
    if (!raw) return null;
    const d = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
}

const CALORIE: Record<string, string> = { D: 'Deficient', E: 'Excess' };

function Kpi({ title, icon, id, value, sub }: { title: string; icon: string; id: string; value: string; sub: React.ReactNode }) {
    return (
        <div className="kpi-card">
            <div className="kpi-header">
                <span className="kpi-title">{title}</span>
                <span className="kpi-icon">{icon}</span>
            </div>
            <div className="kpi-value" id={id}>{value}</div>
            <div className="kpi-sub">{sub}</div>
        </div>
    );
}

function ChartCard({ title, desc, children, wide }: { title: string; desc: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={`card mm-chart-card${wide ? ' wide' : ''}`}>
            <h2 className="card-title">{title}</h2>
            <p className="card-desc">{desc}</p>
            {children}
        </div>
    );
}

const Empty = ({ text = 'No data for these filters.' }: { text?: string }) => <div className="mm-chart-empty">{text}</div>;

export function OverviewSection({ active, stats, cadets, years, onOpen }: {
    active: boolean;
    stats: AdminStats | null;
    cadets: Cadet[] | null;
    years: AcademicYear[] | null;
    onOpen: (tab: AdminTab) => void;
}) {
    const showToast = useToast();
    const [families, setFamilies] = useState<Household[] | null>(null);
    const [year, setYear] = useState('');
    const [study, setStudy] = useState('');
    const [period, setPeriod] = useState('12');

    const loadFamilies = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/families');
            if (!res.ok) throw new Error('Failed to load households for the analysis');
            setFamilies((await res.json()) as Household[]);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (active) loadFamilies();
    }, [active, loadFamilies]);

    const yearOptions = useMemo(() => distinctSorted([...(years || []).map((y) => y.label), ...(cadets || []).map((c) => academicYearOf(c))], byAcademicYear), [years, cadets]);
    const studyOptions = useMemo(() => distinctSorted((cadets || []).map((c) => studyYearOf(c.batch_year)), byStudyOrder), [cadets]);

    /* ── Filtered data ── */
    const students = useMemo(
        () => (cadets || []).filter((c) => (!year || academicYearOf(c) === year) && (!study || studyYearOf(c.batch_year) === study)),
        [cadets, year, study],
    );
    const studentById = useMemo(() => new Map((cadets || []).map((c) => [c.id, c])), [cadets]);
    const months = PERIODS.find((p) => p.key === period)?.months ?? null;
    const since = useMemo(() => {
        if (!months) return null;
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        d.setMonth(d.getMonth() - (months - 1));
        return d;
    }, [months]);

    const homes = useMemo(() => {
        const ids = new Set(students.map((s) => s.id));
        return (families || []).filter((f) => {
            if (!ids.has(f.student_id)) return false;
            if (!since) return true;
            const d = surveyDate(f);
            return !!d && d >= since;
        });
    }, [families, students, since]);

    const people = homes.reduce((n, f) => n + (Number(f.members_count) || 0), 0);
    const followups = students.reduce((n, s) => n + (Number(s.followups_count) || 0), 0);
    const activeStudents = students.filter((s) => s.status === 'Active').length;
    const surveying = new Set(homes.map((f) => f.student_id)).size;

    /* ── Charts ── */
    const trend = useMemo<ChartConfiguration | null>(() => {
        const dated = homes.map(surveyDate).filter((d): d is Date => !!d);
        if (!dated.length) return null;
        const start = since || new Date(Math.min(...dated.map((d) => d.getTime())));
        const keys: string[] = [];
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        const end = new Date();
        while (cur <= end && keys.length < 60) { keys.push(monthKey(cur)); cur.setMonth(cur.getMonth() + 1); }
        const counts = new Map(keys.map((k) => [k, 0]));
        dated.forEach((d) => { const k = monthKey(d); if (counts.has(k)) counts.set(k, counts.get(k)! + 1); });
        return {
            type: 'line',
            data: {
                labels: keys.map(monthLabel),
                datasets: [{ label: 'Households surveyed', data: keys.map((k) => counts.get(k) || 0), borderColor: BLUE, backgroundColor: 'rgba(29, 78, 216, 0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: BLUE }],
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
        };
    }, [homes, since]);

    const byStudy = useMemo<ChartConfiguration | null>(() => {
        const labels = distinctSorted(students.map((s) => studyYearOf(s.batch_year)), byStudyOrder);
        if (!labels.length) return null;
        const hh = labels.map((l) => homes.filter((f) => studyYearOf(studentById.get(f.student_id)?.batch_year) === l).length);
        const st = labels.map((l) => students.filter((s) => studyYearOf(s.batch_year) === l).length);
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Households', data: hh, backgroundColor: BLUE, borderRadius: 6, maxBarThickness: 36 },
                    { label: 'Students', data: st, backgroundColor: '#93c5fd', borderRadius: 6, maxBarThickness: 36 },
                ],
            },
            options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
        };
    }, [students, homes, studentById]);

    const calorie = useMemo<ChartConfiguration | null>(() => {
        if (!homes.length) return null;
        const labels = ['Normal', 'Deficient', 'Excess'];
        const data = labels.map((l) => homes.filter((f) => ((f.calorie_status && CALORIE[f.calorie_status]) || 'Normal') === l).length);
        return {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderWidth: 2, borderColor: '#ffffff' }] },
            options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
        };
    }, [homes]);

    const villages = useMemo<ChartConfiguration | null>(() => {
        const counts = new Map<string, number>();
        homes.forEach((f) => { const v = (f.village || 'Field Block').trim(); counts.set(v, (counts.get(v) || 0) + 1); });
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (!top.length) return null;
        return {
            type: 'bar',
            data: { labels: top.map(([v]) => v), datasets: [{ label: 'Households', data: top.map(([, n]) => n), backgroundColor: '#0ea5e9', borderRadius: 6, maxBarThickness: 22 }] },
            options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } },
        };
    }, [homes]);

    const yearSplit = useMemo<ChartConfiguration | null>(() => {
        const base = (cadets || []).filter((c) => !study || studyYearOf(c.batch_year) === study);
        const labels = distinctSorted(base.map((c) => academicYearOf(c)), byAcademicYear);
        if (!labels.length) return null;
        return {
            type: 'pie',
            data: { labels, datasets: [{ data: labels.map((l) => base.filter((c) => academicYearOf(c) === l).length), backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2, borderColor: '#ffffff' }] },
            options: { plugins: { legend: { position: 'bottom' } } },
        };
    }, [cadets, study]);

    const burden = useMemo<ChartConfiguration | null>(() => {
        const b = stats?.burden;
        if (!b) return null;
        return {
            type: 'bar',
            data: {
                labels: ['Hypertension', 'Diabetes', 'Anaemia', 'Child malnutrition'],
                datasets: [{ label: 'People', data: [b.total_htn, b.total_dm, b.total_anaemia, b.total_malnutrition], backgroundColor: ['#ef4444', '#f59e0b', BLUE, '#14b8a6'], borderRadius: 6, maxBarThickness: 44 }],
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
        };
    }, [stats]);

    const topSurveyors = useMemo(() => {
        const counts = new Map<number, number>();
        homes.forEach((f) => counts.set(f.student_id, (counts.get(f.student_id) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ s: studentById.get(id), n }));
    }, [homes, studentById]);

    const filtered = !!(year || study || period !== 'all');
    const totalPeople = stats?.overview.total_members || 0;

    return (
        <div id="viewOverview" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="mm-filters mm-filter-bar">
                <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">
                    <option value="">All academic years</option>
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={study} onChange={(e) => setStudy(e.target.value)} aria-label="Study year">
                    <option value="">All study years</option>
                    {studyOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
                    {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <div className="mm-filters-end">
                    {(year || study || period !== '12') && <button className="btn btn-secondary" onClick={() => { setYear(''); setStudy(''); setPeriod('12'); }}>Reset filters</button>}
                    <button className="btn btn-secondary" onClick={loadFamilies} title="Reload households">↺ Refresh</button>
                </div>
            </div>

            <div className="kpi-grid">
                <Kpi title="Students" icon="👥" id="kpiTotalStudents" value={fmt(cadets ? students.length : null)}
                    sub={<><span id="kpiActiveStudentsPill" className="badge badge-success">{fmt(activeStudents)} active</span><span>{fmt(surveying)} surveyed in period</span></>} />
                <Kpi title="Households surveyed" icon="🏡" id="kpiTotalFamilies" value={fmt(families ? homes.length : null)}
                    sub={<span>{students.length ? (homes.length / students.length).toFixed(1) : '0'} per student{filtered ? ' (filtered)' : ''}</span>} />
                <Kpi title="People screened" icon="🩺" id="kpiTotalMembers" value={fmt(families ? people : null)}
                    sub={<span>{homes.length ? (people / homes.length).toFixed(1) : '0'} per household</span>} />
                <Kpi title="Follow-up visits" icon="📋" id="kpiTotalFollowups" value={fmt(cadets ? followups : null)}
                    sub={<span>By the students shown (all time)</span>} />
            </div>

            <div className="mm-chart-grid">
                <ChartCard title="Households surveyed over time" desc="New households registered each month." wide>
                    {trend ? <ChartCanvas config={trend} label="Line chart of households surveyed per month" /> : <Empty text={families ? undefined : 'Loading...'} />}
                </ChartCard>

                <ChartCard title="By study year" desc="Students and the households they surveyed.">
                    {byStudy ? <ChartCanvas config={byStudy} label="Bar chart of students and households by study year" /> : <Empty />}
                </ChartCard>

                <ChartCard title="Calorie status" desc="Share of surveyed households.">
                    {calorie ? <ChartCanvas config={calorie} label="Doughnut chart of household calorie status" /> : <Empty />}
                </ChartCard>

                <ChartCard title="Top villages" desc="Villages or wards with the most households.">
                    {villages ? <ChartCanvas config={villages} label="Bar chart of households by village" /> : <Empty />}
                </ChartCard>

                <ChartCard title="Students by academic year" desc="Roster size for each session.">
                    {yearSplit ? <ChartCanvas config={yearSplit} label="Pie chart of students by academic year" /> : <Empty />}
                </ChartCard>

                <ChartCard title="Disease burden" desc={`Screening findings across all students (${fmt(totalPeople)} people screened).`}>
                    {burden ? (
                        <>
                            <ChartCanvas config={burden} height={220} label="Bar chart of disease burden" />
                            <div className="mm-burden-legend">
                                <span>HTN {pct(stats!.burden.total_htn, totalPeople)}</span>
                                <span>DM {pct(stats!.burden.total_dm, totalPeople)}</span>
                                <span>Anaemia {pct(stats!.burden.total_anaemia, totalPeople)}</span>
                                <span>Malnutrition {pct(stats!.burden.total_malnutrition, totalPeople)}</span>
                            </div>
                        </>
                    ) : <Empty text="Loading..." />}
                </ChartCard>

                <ChartCard title="Top surveyors" desc="Most households in the selected filters.">
                    <ul className="mm-list">
                        {topSurveyors.length === 0 ? <li className="mm-sub">No households in these filters.</li> : topSurveyors.map(({ s, n }, i) => (
                            <li key={s?.id ?? i}>
                                <div>
                                    <div className="mm-strong">{s?.name || 'Unknown student'}</div>
                                    <div className="mm-sub">{ENROLLMENT_LABEL} {s?.roll_number || '-'} · {studyYearOf(s?.batch_year)}</div>
                                </div>
                                <span className="mm-num">{fmt(n)}<span className="mm-sub"> households</span></span>
                            </li>
                        ))}
                    </ul>
                    <button className="btn btn-secondary btn-sm" onClick={() => onOpen('students')} style={{ marginTop: 12 }}>View all students</button>
                </ChartCard>
            </div>
        </div>
    );
}
