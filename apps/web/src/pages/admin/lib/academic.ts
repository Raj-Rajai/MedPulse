/**
 * Enrollment number, academic year and study year as the admin console shows them.
 *  - Enrollment number: each student's unique code (`roll_number`).
 *  - Academic year: the session the student belongs to (`academic_year`, e.g. 2026-2027), managed in Admin Config.
 *  - Study year: First Year, Second Year... read from the student's `batch_year` text.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AcademicYear, Cadet, FieldArea } from '../types';

export const ENROLLMENT_LABEL = 'Enrollment No.';
export const UNASSIGNED = 'Unassigned';

export const academicYearOf = (c: Pick<Cadet, 'academic_year'> | null | undefined) => (c && c.academic_year) || UNASSIGNED;

/** Study years in course order; the value stored in batch_year when an admin picks one. */
export const STUDY_YEARS: { label: string; value: string }[] = [
    { label: 'First Year', value: '1st Year MBBS' },
    { label: 'Second Year', value: '2nd Year MBBS' },
    { label: 'Third Year', value: '3rd Year MBBS' },
    { label: 'Final Year Part 1', value: 'Final Year MBBS Part 1' },
    { label: 'Final Year Part 2', value: 'Final Year MBBS Part 2' },
    { label: 'Internship', value: 'CRMI Intern Doctor' },
];
const STUDY_ORDER = [...STUDY_YEARS.map((s) => s.label), 'Final Year', 'Not set'];

export function studyYearOf(batchYear?: string | null): string {
    const t = (batchYear || '').toLowerCase();
    if (!t.trim()) return 'Not set';
    if (/\b(1st|first)\b/.test(t)) return 'First Year';
    if (/\b(2nd|second)\b/.test(t)) return 'Second Year';
    if (/\b(3rd|third)\b/.test(t)) return 'Third Year';
    if (/final/.test(t)) return /part\s*(2|ii)\b/.test(t) ? 'Final Year Part 2' : /part\s*(1|i)\b/.test(t) ? 'Final Year Part 1' : 'Final Year';
    if (/intern|crmi/.test(t)) return 'Internship';
    return 'Not set';
}

/** batch_year value for a study-year label (keeps the existing text when it already matches). */
export function batchYearFor(label: string, current?: string | null): string {
    if (current && studyYearOf(current) === label) return current;
    return STUDY_YEARS.find((s) => s.label === label)?.value || current || '';
}

export const byStudyOrder = (a: string, b: string) => STUDY_ORDER.indexOf(a) - STUDY_ORDER.indexOf(b);

/** Academic years newest first, Unassigned last. */
export const byAcademicYear = (a: string, b: string) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : b.localeCompare(a));

export function distinctSorted(values: string[], compare: (a: string, b: string) => number): string[] {
    return [...new Set(values)].sort(compare);
}

export const isCurrent = (y: AcademicYear) => !!Number(y.is_current);

/** Loads the academic years (and the default field area) from the API. */
export function useAcademicYears() {
    const [years, setYears] = useState<AcademicYear[] | null>(null);
    const [defaultArea, setDefaultArea] = useState<FieldArea | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/academic-years', { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { years?: AcademicYear[]; default_area?: FieldArea | null; error?: string };
            if (!res.ok) throw new Error(data.error || 'Unable to load academic years.');
            setYears(data.years || []);
            setDefaultArea(data.default_area || null);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return { years, defaultArea, error, load };
}
