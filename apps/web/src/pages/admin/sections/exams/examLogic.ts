/** Marksheet maths from the original exam console (recalculateExamRow / updateExamKPIs). */

export interface MarksheetEntry {
    student_id: number;
    roll_number: string;
    name: string;
    batch_year?: string | null;
    paper1_obtained?: number | null;
    paper2_obtained?: number | null;
    theory_obtained?: number | null;
    practical_obtained?: number | null;
    viva_obtained?: number | null;
    total_obtained?: number | null;
    percentage?: number | null;
    status?: string | null;
    faculty_remarks?: string | null;
}

export interface MarksheetResponse { marksheet?: MarksheetEntry[]; is_two_paper?: boolean }

/** One editable row: the inputs as typed plus what the read-only cells show. */
export interface ExamRow extends MarksheetEntry {
    inP1: string; inP2: string; inTh: string; inPr: string; inVv: string; inRemarks: string;
    thCalcText: string;
    totText: string;
    pctText: string;
    pctColor: string;
}

const str = (v: number | null | undefined) => (v != null ? String(v) : '');

export function toRow(m: MarksheetEntry): ExamRow {
    const thVal = m.theory_obtained != null ? m.theory_obtained : '';
    return {
        ...m,
        inP1: str(m.paper1_obtained), inP2: str(m.paper2_obtained), inTh: str(m.theory_obtained),
        inPr: str(m.practical_obtained), inVv: str(m.viva_obtained), inRemarks: m.faculty_remarks || '',
        thCalcText: String(thVal || '-'),
        totText: m.total_obtained != null ? String(m.total_obtained) : '-',
        pctText: m.percentage != null ? `${m.percentage}%` : '-',
        pctColor: '#059669',
    };
}

export function recalculate(row: ExamRow, isTwoPaper: boolean): ExamRow {
    let p1 = 0, p2 = 0, th = 0, pr = 0, vv = 0;
    let hasInput = false;
    if (isTwoPaper) {
        if (row.inP1 !== '') { p1 = parseFloat(row.inP1); hasInput = true; }
        if (row.inP2 !== '') { p2 = parseFloat(row.inP2); hasInput = true; }
        th = p1 + p2;
    } else if (row.inTh !== '') {
        th = parseFloat(row.inTh);
        hasInput = true;
    }
    if (row.inPr !== '') { pr = parseFloat(row.inPr); hasInput = true; }
    if (row.inVv !== '') vv = parseFloat(row.inVv);

    const totMax = isTwoPaper ? 300 : 200;
    const totObt = th + pr;
    const pct = totMax > 0 ? parseFloat(((totObt / totMax) * 100).toFixed(1)) : 0;

    let status = 'Fail';
    if (!hasInput) status = 'Not Entered';
    else if (pct >= 75.0) status = 'Distinction';
    else if (pct >= 50.0 && (!isTwoPaper || (p1 >= 40 && p2 >= 40)) && pr >= 40) status = 'Pass';

    return {
        ...row,
        paper1_obtained: isTwoPaper ? p1 : null,
        paper2_obtained: isTwoPaper ? p2 : null,
        theory_obtained: th,
        practical_obtained: pr,
        viva_obtained: vv,
        total_obtained: hasInput ? totObt : null,
        percentage: hasInput ? pct : null,
        status,
        thCalcText: isTwoPaper ? (hasInput ? th.toFixed(1) : '-') : row.thCalcText,
        totText: hasInput ? totObt.toFixed(1) : '-',
        pctText: hasInput ? `${pct}%` : '-',
        pctColor: pct >= 75 ? '#7c3aed' : pct >= 50 ? '#059669' : '#dc2626',
    };
}

export interface ExamKpis { avg: string | number; passPct: string | number; distinctions: number; remedial: number }

export function computeKpis(rows: MarksheetEntry[]): ExamKpis {
    let scored = 0, passed = 0, distinctions = 0, remedial = 0, sumPct = 0;
    for (const m of rows) {
        if (m.total_obtained != null) {
            scored++;
            sumPct += m.percentage as number;
            if (m.status === 'Distinction') distinctions++;
            if (m.status === 'Pass' || m.status === 'Distinction') passed++;
            else remedial++;
        }
    }
    return {
        avg: scored > 0 ? (sumPct / scored).toFixed(1) : 0,
        passPct: scored > 0 ? ((passed / scored) * 100).toFixed(1) : 0,
        distinctions,
        remedial,
    };
}

export const SAMPLES = [
    { p1: 82, p2: 84, th: 83, pr: 88, vv: 18, rem: 'Excellent clinical acumen and viva response.' },
    { p1: 76, p2: 78, th: 77, pr: 80, vv: 16, rem: 'Good grasp of preventive epidemiology.' },
    { p1: 72, p2: 74, th: 73, pr: 76, vv: 15, rem: 'Consistent clinical logbook and case work.' },
    { p1: 88, p2: 86, th: 87, pr: 92, vv: 19, rem: 'Outstanding honors performance across modules.' },
    { p1: 68, p2: 70, th: 69, pr: 72, vv: 14, rem: 'Satisfactory performance; reinforce statistics.' },
];
