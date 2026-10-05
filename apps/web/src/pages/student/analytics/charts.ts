/**
 * The eight analytics charts, with the same Chart.js configuration as student/analytics.html.
 */
import Chart from 'chart.js/auto';
import type { Member } from './AnalyticsApp';

export type ChartKey = 'bmi' | 'ncdAge' | 'longitudinal' | 'bp' | 'anaemia' | 'conditions' | 'calorie' | 'work';

export interface PatientVisit {
    visit_number: number;
    visit_date?: string;
    sbp?: number;
    dbp?: number;
    rbs?: number;
    hb?: number;
    progress?: string;
    compliance?: string;
}
export interface PatientCurve {
    id: number | string;
    name: string;
    gender: string;
    visits: PatientVisit[];
}

export interface AnalyticsData {
    kpis?: {
        totalHouseholds: number;
        totalMembers: number;
        males: number;
        females: number;
        sexRatio: number | string;
        htnPct: number;
        htnCases: number;
        avgSbp?: number | null;
        dmPct: number;
        dmCases: number;
        avgRbs?: number | null;
        anaemiaPct: number;
        anaemiaCases: number;
        avgHb?: number | null;
    };
    bmiDistribution: { category: string; count: number }[];
    ncdByAgeGroup: { age_bracket: string; htn_pct: number; dm_pct: number }[];
    longitudinalTrends: {
        cohortAverages: { visit_number: number; avg_sbp: number; avg_dbp: number; avg_rbs: number; avg_hb: number }[];
        patientCurves: PatientCurve[];
    };
    bpCategories: { category: string; count: number }[];
    anaemiaByGender: { gender: string; anaemia_pct: number; avg_hb: number }[];
    conditionsRanking: { condition_name: string; count: number }[];
    dietaryStatus: { calorie_status: string; count: number }[];
    lifestyleWork: { work_category: string; count: number }[];
    memberList?: Member[];
}

// Design System Color Tokens (PALETTE.purple is not defined in the original either; those lines use Chart.js defaults).
const PALETTE: Record<string, string> = {
    violet: '#7c3aed',
    violetSubtle: '#ede9fe',
    indigo: '#4f46e5',
    indigoSubtle: '#e0e7ff',
    blue: '#2563eb',
    blueSubtle: '#dbeafe',
    emerald: '#059669',
    emeraldSubtle: '#d1fae5',
    amber: '#d97706',
    amberSubtle: '#fef3c7',
    rose: '#e11d48',
    roseSubtle: '#ffe4e6',
    slate: '#64748b',
    slateSubtle: '#f1f5f9',
};

interface Opts {
    onBmiClick: (category: string) => void;
    patient?: PatientCurve;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function renderChart(key: ChartKey, canvas: HTMLCanvasElement, data: AnalyticsData, opts: Opts): Chart {
    const ctx = canvas.getContext('2d')!;
    const make = (cfg: any) => new Chart(ctx, cfg);
    switch (key) {
        case 'bmi': {
            const bmiData = data.bmiDistribution;
            const labels = bmiData.map((d) => d.category);
            const counts = bmiData.map((d) => d.count);
            const colors = labels.map((l) => {
                if (l.includes('Normal')) return PALETTE.emerald;
                if (l.includes('Overweight')) return PALETTE.amber;
                if (l.includes('Obese')) return PALETTE.rose;
                if (l.includes('Underweight')) return PALETTE.blue;
                return PALETTE.slate;
            });
            return make({
                type: 'doughnut',
                data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6 }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11, weight: '600' } } },
                        tooltip: {
                            callbacks: {
                                label: (c: any) => {
                                    const total = counts.reduce((a, b) => a + b, 0);
                                    const val = c.parsed;
                                    const pct = total ? Math.round((val / total) * 100) : 0;
                                    return ` ${c.label}: ${val} (${pct}%)`;
                                },
                            },
                        },
                    },
                    onClick: (_evt: unknown, elements: { index: number }[]) => {
                        if (elements.length > 0) opts.onBmiClick(labels[elements[0].index]);
                    },
                },
            });
        }
        case 'ncdAge': {
            const ncdData = data.ncdByAgeGroup;
            return make({
                type: 'bar',
                data: {
                    labels: ncdData.map((d) => d.age_bracket),
                    datasets: [
                        { label: 'Hypertension (%)', data: ncdData.map((d) => d.htn_pct), backgroundColor: PALETTE.rose, borderRadius: 6, barPercentage: 0.65 },
                        { label: 'Diabetes (%)', data: ncdData.map((d) => d.dm_pct), backgroundColor: PALETTE.amber, borderRadius: 6, barPercentage: 0.65 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: 100, ticks: { callback: (v: unknown) => v + '%' }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } },
                    },
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 12, font: { weight: '600' } } },
                        tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${c.parsed.y}%` } },
                    },
                },
            });
        }
        case 'longitudinal': {
            const patient = opts.patient;
            if (patient) {
                const v = patient.visits;
                return make({
                    type: 'line',
                    data: {
                        labels: v.map((x) => `Visit #${x.visit_number} (${x.visit_date})`),
                        datasets: [
                            { label: `${patient.name} SBP (mmHg)`, data: v.map((x) => x.sbp), borderColor: PALETTE.purple, tension: 0.25, pointRadius: 7, borderWidth: 3 },
                            { label: 'DBP (mmHg)', data: v.map((x) => x.dbp), borderColor: PALETTE.blue, tension: 0.25, pointRadius: 6, borderWidth: 2.5 },
                            { label: 'RBS (mg/dL)', data: v.map((x) => x.rbs), borderColor: PALETTE.amber, tension: 0.25, pointRadius: 6, borderWidth: 2.5 },
                            { label: 'Hb (g/dL)', data: v.map((x) => x.hb), borderColor: PALETTE.emerald, tension: 0.25, pointRadius: 6, borderWidth: 2.5 },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    afterBody: (items: { dataIndex: number }[]) => {
                                        const visit = v[items[0].dataIndex];
                                        return `Progress: ${visit.progress || 'Stable'}\nCompliance: ${visit.compliance || 'Good'}`;
                                    },
                                },
                            },
                        },
                    },
                });
            }
            const ca = data.longitudinalTrends.cohortAverages;
            const ds = (label: string, d: number[], color: string, bg: string, borderWidth: number) => ({
                label, data: d, borderColor: color, backgroundColor: bg, tension: 0.3, pointRadius: 6, pointHoverRadius: 8, borderWidth,
            });
            return make({
                type: 'line',
                data: {
                    labels: ca.map((d) => `Visit #${d.visit_number}`),
                    datasets: [
                        ds('Mean SBP (mmHg)', ca.map((d) => d.avg_sbp), PALETTE.purple, PALETTE.violetSubtle, 3),
                        ds('Mean DBP (mmHg)', ca.map((d) => d.avg_dbp), PALETTE.blue, PALETTE.blueSubtle, 2.5),
                        ds('Mean RBS (mg/dL)', ca.map((d) => d.avg_rbs), PALETTE.amber, PALETTE.amberSubtle, 2.5),
                        ds('Mean Hb (g/dL)', ca.map((d) => d.avg_hb), PALETTE.emerald, PALETTE.emeraldSubtle, 2.5),
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { weight: '600' } } },
                        x: { grid: { display: false }, ticks: { font: { weight: '700' } } },
                    },
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 14, font: { weight: '600' } } },
                        tooltip: { padding: 10, callbacks: { label: (c: any) => ` ${c.dataset.label}: ${c.parsed.y}` } },
                    },
                },
            });
        }
        case 'bp': {
            const bpData = data.bpCategories;
            const labels = bpData.map((d) => d.category);
            const colors = labels.map((l) => {
                if (l.includes('Normal')) return PALETTE.emerald;
                if (l.includes('Pre-HTN')) return PALETTE.blue;
                if (l.includes('Stage 1')) return PALETTE.amber;
                if (l.includes('Stage 2')) return PALETTE.rose;
                return PALETTE.slate;
            });
            return make({
                type: 'bar',
                data: { labels, datasets: [{ data: bpData.map((d) => d.count), backgroundColor: colors, borderRadius: 6 }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${c.parsed.y} Individuals` } } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } },
                },
            });
        }
        case 'anaemia': {
            const a = data.anaemiaByGender;
            return make({
                type: 'bar',
                data: {
                    labels: a.map((d) => (d.gender === 'M' ? 'Males' : 'Females')),
                    datasets: [
                        { label: 'Anaemia Prevalence (%)', data: a.map((d) => d.anaemia_pct), backgroundColor: PALETTE.rose, borderRadius: 6 },
                        { label: 'Average Hemoglobin (g/dL)', data: a.map((d) => d.avg_hb), backgroundColor: PALETTE.blue, borderRadius: 6 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { weight: '600' } } } },
                    scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
                },
            });
        }
        case 'conditions': {
            const c = data.conditionsRanking;
            return make({
                type: 'bar',
                data: { labels: c.map((d) => d.condition_name), datasets: [{ label: 'Diagnosed Cases', data: c.map((d) => d.count), backgroundColor: PALETTE.indigo, borderRadius: 6 }] },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } },
                },
            });
        }
        case 'calorie': {
            const cal = data.dietaryStatus;
            const labels = cal.map((d) => `${d.calorie_status} Calorie`);
            const colors = labels.map((l) => (l.includes('Normal') ? PALETTE.emerald : l.includes('Deficient') ? PALETTE.rose : PALETTE.amber));
            return make({
                type: 'pie',
                data: { labels, datasets: [{ data: cal.map((d) => d.count), backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff' }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { weight: '600' } } } },
                },
            });
        }
        case 'work': {
            const w = data.lifestyleWork;
            return make({
                type: 'bar',
                data: { labels: w.map((d) => d.work_category), datasets: [{ data: w.map((d) => d.count), backgroundColor: [PALETTE.blue, PALETTE.emerald, PALETTE.amber, PALETTE.violet], borderRadius: 6 }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } },
                },
            });
        }
    }
}
