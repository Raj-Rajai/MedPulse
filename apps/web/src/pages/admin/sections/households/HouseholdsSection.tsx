import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '../../components/DataTable';
import { useToast } from '../../hooks/useToasts';
import { academicYearOf, byAcademicYear, byStudyOrder, distinctSorted, ENROLLMENT_LABEL, studyYearOf, UNASSIGNED } from '../../lib/academic';
import { datePart, errMessage } from '../../lib/http';
import type { Cadet, Household } from '../../types';

/** A household row with its surveyor's academic year and study year (joined from the cadet roster). */
type HouseholdRow = Household & { academic_year: string; study_year: string };

const CALORIE: Record<string, string> = { D: 'Deficient', E: 'Excess' };
const calorieLabel = (s?: string | null) => (s && CALORIE[s]) || 'Normal';

function CalorieBadge({ status }: { status?: string | null }) {
    if (status === 'D') return <span className="badge badge-danger">Deficient</span>;
    if (status === 'E') return <span className="badge badge-warning">Excess</span>;
    return <span className="badge badge-info">Normal</span>;
}

const COLUMNS: Column<HouseholdRow>[] = [
    { key: 'code', label: 'Family Code', value: (f) => f.family_code || 'FAM-' + f.family_no, render: (f) => <code>{f.family_code || 'FAM-' + f.family_no}</code> },
    { key: 'no', label: 'Family No.', value: (f) => f.family_no, numeric: true },
    { key: 'hof', label: 'Head of Family', value: (f) => f.head_of_family, render: (f) => <span className="mm-strong">{f.head_of_family || ''}</span> },
    { key: 'village', label: 'Village / Ward', value: (f) => f.village || 'Field Block' },
    { key: 'surveyor', label: 'Surveyor Name', value: (f) => f.student_name },
    { key: 'enrollment', label: ENROLLMENT_LABEL, value: (f) => f.roll_number, render: (f) => <span className="mm-code">{f.roll_number || ''}</span> },
    { key: 'year', label: 'Academic Year', value: (f) => f.academic_year },
    { key: 'study', label: 'Study Year', value: (f) => f.study_year },
    { key: 'members', label: 'Members', value: (f) => f.members_count || 0, numeric: true, align: 'center' },
    { key: 'calorie', label: 'Calorie Status', value: (f) => calorieLabel(f.calorie_status), align: 'center', render: (f) => <CalorieBadge status={f.calorie_status} /> },
    { key: 'date', label: 'Survey Date', value: (f) => f.survey_date || datePart(f.created_at) },
];

/** VIEW 3: Global household registry with academic year filter, column filters and pagination. */
export function HouseholdsSection({ active, loadSignal, cadets }: { active: boolean; loadSignal: number; cadets: Cadet[] | null }) {
    const showToast = useToast();
    const [families, setFamilies] = useState<Household[] | null>(null);
    const [q, setQ] = useState('');
    const [year, setYear] = useState('');
    const [study, setStudy] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/families');
            if (!res.ok) throw new Error('Failed to load global households');
            setFamilies((await res.json()) as Household[]);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (loadSignal) load();
    }, [loadSignal, load]);

    const all = useMemo<HouseholdRow[] | null>(() => {
        if (!families) return null;
        const byId = new Map((cadets || []).map((c) => [c.id, c]));
        return families.map((f) => {
            const c = byId.get(f.student_id);
            return { ...f, academic_year: c ? academicYearOf(c) : UNASSIGNED, study_year: studyYearOf(c?.batch_year) };
        });
    }, [families, cadets]);

    const years = useMemo(() => distinctSorted((all || []).map((f) => f.academic_year), byAcademicYear), [all]);
    const studies = useMemo(() => distinctSorted((all || []).map((f) => f.study_year), byStudyOrder), [all]);

    const rows = useMemo(() => {
        if (!all) return null;
        const ql = q.toLowerCase().trim();
        return all.filter((f) => {
            const matchesQ = !ql || [f.head_of_family, f.family_code, f.village, f.student_name, f.roll_number].some((v) => v && v.toLowerCase().includes(ql));
            return matchesQ && (!year || f.academic_year === year) && (!study || f.study_year === study);
        });
    }, [all, q, year, study]);

    return (
        <div id="viewHouseholds" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="card">
                <div className="mm-card-head">
                    <div>
                        <h2 className="card-title">Global households <span className="mm-count" id="householdTotalCount">{families ? families.length : 0}</span></h2>
                        <p className="card-desc">Every surveyed household across all students, with the surveyor who registered it.</p>
                    </div>
                    <div className="mm-toolbar">
                        <button className="btn btn-secondary" onClick={load} title="Reload households">↺ Refresh</button>
                    </div>
                </div>

                <div className="mm-filters">
                    <input type="search" id="householdSearchInput" className="search-input" placeholder="Search family code, head of family, village, surveyor" value={q} onChange={(e) => setQ(e.target.value)} />
                    <select id="householdYearFilter" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">
                        <option value="">All academic years</option>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select id="householdStudyFilter" value={study} onChange={(e) => setStudy(e.target.value)} aria-label="Study year">
                        <option value="">All study years</option>
                        {studies.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <DataTable
                    id="householdsTable"
                    columns={COLUMNS}
                    rows={rows}
                    rowKey={(f, i) => `${f.student_id}-${f.family_no}-${i}`}
                    loadingText="Loading the household registry..."
                    emptyText="No surveyed households match the current filters."
                />
            </div>
        </div>
    );
}
