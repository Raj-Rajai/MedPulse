/**
 * VIEW 2C: Examination marksheet entry. Like attendance, /api/admin/academic/exams/* does not
 * exist on the server, so today the grid ends in its error row; the flow is ported unchanged.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson } from '../../lib/http';
import { Options, SUBJECTS, labelOf, type Option } from '../academic';
import { SAMPLES, computeKpis, recalculate, toRow, type ExamKpis, type ExamRow, type MarksheetResponse } from './examLogic';

const YEARS: Option[] = [
    { value: '3', label: '3rd Year MBBS (2026)' },
    { value: '2', label: '2nd Year MBBS (2025)' },
    { value: '1', label: '1st Year MBBS (2024)' },
];
const TYPES: Option[] = [
    { value: 'IA-1', label: 'Internal Assessment I (Theory & Practical)' },
    { value: 'IA-2', label: 'Internal Assessment II (Theory & Practical)' },
    { value: 'Preliminary', label: 'Preliminary Examination (Paper 1 + 2 + Practical)' },
    { value: 'University', label: 'University Examination (Paper 1 + 2 + Practical)' },
];

interface Config { year: string; type: string; subject: string; date: string; code: string }
const INITIAL: Config = { year: '3', type: 'IA-1', subject: '2010043342', date: '2026-09-15', code: 'PSM-2026-IA1' };

type Body = { kind: 'initial' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; rows: ExamRow[]; twoPaper: boolean };

function StatusBadge({ status }: { status?: string | null }) {
    if (!status || status === 'Not Entered') return <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Not Entered</span>;
    if (status === 'Distinction') return <span className="badge" style={{ background: 'rgba(124,58,237,0.14)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.35)', fontWeight: 750 }}>Distinction</span>;
    if (status === 'Pass') return <span className="badge badge-success">Pass</span>;
    if (status === 'Fail') return <span className="badge badge-danger">Fail</span>;
    if (status === 'Absent') return <span className="badge badge-warning">Absent</span>;
    return <span className="badge badge-info">{status}</span>;
}

function NmcChip({ row, twoPaper }: { row: ExamRow; twoPaper: boolean }) {
    if (!row.status || row.status === 'Not Entered') return <span className="badge" style={{ background: '#f8fafc', color: '#94a3b8' }}>Pending</span>;
    const tPass = (row.theory_obtained || 0) >= (twoPaper ? 80 : 40);
    const pPass = (row.practical_obtained || 0) >= 40;
    const combinedPass = (row.percentage || 0) >= 50.0;
    return tPass && pPass && combinedPass ? <span className="nmc-chip-pass">✓ NMC Eligible</span> : <span className="nmc-chip-fail">✗ Remedial</span>;
}

const thc = (width: number): CSSProperties => ({ textAlign: 'center', width });

function ExamHead({ twoPaper }: { twoPaper: boolean }) {
    return twoPaper ? (
        <tr>
            <th style={{ width: 70, textAlign: 'center' }}>Roll</th>
            <th>Cadet Name</th>
            <th style={thc(85)}>Paper 1 (100)</th>
            <th style={thc(85)}>Paper 2 (100)</th>
            <th style={thc(95)}>Theory (200)</th>
            <th style={thc(85)}>Practical (100)</th>
            <th style={thc(85)}>Viva (20)</th>
            <th style={thc(90)}>Total (300)</th>
            <th style={thc(75)}>% Score</th>
            <th style={thc(90)}>Status</th>
            <th style={thc(110)}>NMC Criteria</th>
            <th>Faculty Remarks</th>
        </tr>
    ) : (
        <tr>
            <th style={{ width: 70, textAlign: 'center' }}>Roll</th>
            <th>Cadet Name</th>
            <th style={thc(95)}>Theory (100)</th>
            <th style={thc(95)}>Practical (100)</th>
            <th style={thc(85)}>Viva (20)</th>
            <th style={thc(95)}>Total (200)</th>
            <th style={thc(75)}>% Score</th>
            <th style={thc(90)}>Status</th>
            <th style={thc(110)}>NMC Criteria</th>
            <th>Faculty Remarks</th>
        </tr>
    );
}

type MarkField = 'inP1' | 'inP2' | 'inTh' | 'inPr' | 'inVv';

function MarksInput({ row, field, prefix, max, onChange }: { row: ExamRow; field: MarkField; prefix: string; max: number; onChange: (id: number, field: MarkField, v: string) => void }) {
    return (
        <td style={{ textAlign: 'center' }}>
            <input type="number" className="marks-input" id={`${prefix}-${row.student_id}`} value={row[field]} min="0" max={max} step="0.5" placeholder={`0-${max}`} onChange={(e) => onChange(row.student_id, field, e.target.value)} />
        </td>
    );
}

const kpiCardStyle: CSSProperties = { padding: '16px 20px' };
const kpiLabel: CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' };
const kpiValue = (color: string): CSSProperties => ({ fontSize: '1.8rem', fontWeight: 850, color, margin: '4px 0' });

export function ExamsSection({ active, loadSignal }: { active: boolean; loadSignal: number }) {
    const showToast = useToast();
    const [cfg, setCfg] = useState<Config>(INITIAL);
    const cfgRef = useRef<Config>(INITIAL);
    const [headTwoPaper, setHeadTwoPaper] = useState<boolean | null>(null);
    const [body, setBody] = useState<Body>({ kind: 'initial' });
    const bodyRef = useRef<Body>(body);
    const [kpis, setKpis] = useState<ExamKpis>({ avg: 0, passPct: 0, distinctions: 0, remedial: 0 });
    const [saving, setSaving] = useState(false);

    const updateCfg = (patch: Partial<Config>) => {
        cfgRef.current = { ...cfgRef.current, ...patch };
        setCfg(cfgRef.current);
    };
    const setData = (rows: ExamRow[], twoPaper: boolean) => {
        bodyRef.current = { kind: 'data', rows, twoPaper };
        setBody(bodyRef.current);
        setKpis(computeKpis(rows));
    };

    const loadSheet = useCallback(async () => {
        const c = cfgRef.current;
        const yLevel = c.year || 3;
        const eType = c.type || 'IA-1';
        const sCode = c.subject || '2010043342';
        const isTwoPaper = eType === 'Preliminary' || eType === 'University';

        const subShort = labelOf(SUBJECTS, c.subject)?.split('–')[1]?.trim().split(' ')[0] || 'EXAM';
        updateCfg({ code: `${subShort}-${yLevel === '3' ? '2026' : yLevel === '2' ? '2025' : '2024'}-${eType}` });

        setHeadTwoPaper(isTwoPaper);
        bodyRef.current = { kind: 'loading' };
        setBody(bodyRef.current);
        try {
            const url = `/api/admin/academic/exams/sheet?year_level=${encodeURIComponent(yLevel)}&exam_type=${encodeURIComponent(eType)}&subject_code=${encodeURIComponent(sCode)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load exam marksheet');
            const data = (await res.json()) as MarksheetResponse;
            setData((data.marksheet || []).map(toRow), !!data.is_two_paper);
        } catch (err) {
            bodyRef.current = { kind: 'error', message: errMessage(err) };
            setBody(bodyRef.current);
        }
    }, []);

    useEffect(() => {
        if (loadSignal) loadSheet();
    }, [loadSignal, loadSheet]);

    const onMark = (id: number, field: MarkField, v: string) => {
        const b = bodyRef.current;
        if (b.kind !== 'data') return;
        setData(b.rows.map((r) => (r.student_id === id ? recalculate({ ...r, [field]: v }, b.twoPaper) : r)), b.twoPaper);
    };
    const onRemarks = (id: number, v: string) => {
        const b = bodyRef.current;
        if (b.kind !== 'data') return;
        setData(b.rows.map((r) => (r.student_id === id ? { ...r, inRemarks: v, faculty_remarks: v } : r)), b.twoPaper);
    };

    const autofill = () => {
        const b = bodyRef.current;
        if (b.kind !== 'data') return;
        setData(b.rows.map((r, idx) => {
            const s = SAMPLES[idx % SAMPLES.length];
            const filled: ExamRow = b.twoPaper
                ? { ...r, inP1: String(s.p1), inP2: String(s.p2) }
                : { ...r, inTh: String(s.th) };
            return recalculate({ ...filled, inPr: String(s.pr), inVv: String(s.vv), inRemarks: s.rem }, b.twoPaper);
        }), b.twoPaper);
        showToast('Sample realistic assessment marks populated!', 'info');
    };

    const save = async () => {
        const b = bodyRef.current;
        if (b.kind !== 'data') return;
        setSaving(true);
        const c = cfgRef.current;
        const yLevel = parseInt(c.year, 10) || 3;
        const eType = c.type || 'IA-1';
        const sCode = c.subject || '2010043342';
        const payload = {
            academic_year: labelOf(YEARS, c.year) || '3rd Year MBBS (2026)',
            year_level: yLevel,
            exam_type: eType,
            exam_code: c.code.trim() || `${sCode}-${eType}`,
            exam_name: labelOf(TYPES, c.type) || `${eType} Examination`,
            exam_date: c.date,
            subject_code: sCode,
            subject: labelOf(SUBJECTS, c.subject) || 'Community Medicine (PSM)',
            results: b.rows.map((r) => ({
                student_id: r.student_id,
                paper1_obtained: b.twoPaper ? r.inP1 : null,
                paper2_obtained: b.twoPaper ? r.inP2 : null,
                theory_obtained: b.twoPaper ? null : r.inTh,
                practical_obtained: r.inPr || 0,
                viva_obtained: r.inVv || 0,
                faculty_remarks: r.inRemarks.trim() || '',
            })),
        };
        try {
            const res = await sendJson('/api/admin/academic/exams', 'POST', payload);
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to save examination marks');
            showToast(data.message || 'Examination marks successfully published to student marksheets!', 'success');
            await loadSheet();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    const sel = (k: keyof Config) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        updateCfg({ [k]: e.target.value });
        loadSheet();
    };

    const errSpan = headTwoPaper ? 12 : 10;

    return (
        <div id="viewExams" className={`admin-view-pane${active ? ' active' : ''}`}>
            {/* Exam Configuration Card */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                            📋 Examination &amp; Marksheet Assessment Console
                        </h2>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Input student assessment scores for Internal Assessments (IA-1, IA-2), Preliminary, and University exams with real-time NMC compliance.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={autofill} style={{ fontWeight: 700 }}>
                            ⚡ Autofill Sample Marks
                        </button>
                    </div>
                </div>

                {/* Exam Filter Controls */}
                <div className="att-config-grid exam-config-grid">
                    <div className="att-config-item">
                        <label>Academic Year</label>
                        <select id="examYearLevel" value={cfg.year} onChange={sel('year')}><Options list={YEARS} /></select>
                    </div>
                    <div className="att-config-item">
                        <label>Examination Type</label>
                        <select id="examTypeSelect" value={cfg.type} onChange={sel('type')}><Options list={TYPES} /></select>
                    </div>
                    <div className="att-config-item">
                        <label>Subject</label>
                        <select id="examSubjectSelect" value={cfg.subject} onChange={sel('subject')}><Options list={SUBJECTS} /></select>
                    </div>
                    <div className="att-config-item">
                        <label>Examination Date</label>
                        <input type="date" id="examDateInput" value={cfg.date} onChange={sel('date')} />
                    </div>
                    <div className="att-config-item col-span-2">
                        <label>Examination Code &amp; Title</label>
                        <input type="text" id="examCodeInput" value={cfg.code} onChange={(e) => updateCfg({ code: e.target.value })} placeholder="e.g. PSM-2026-IA1 (Internal Assessment I)" />
                    </div>
                </div>
            </div>

            {/* Class Performance KPI Cards */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
                <div className="card kpi-card" style={kpiCardStyle}>
                    <div style={kpiLabel}>Class Average</div>
                    <div style={kpiValue('#1e1b4b')} id="examClassAvg">{`${kpis.avg}%`}</div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Aggregate Performance</div>
                </div>
                <div className="card kpi-card" style={kpiCardStyle}>
                    <div style={kpiLabel}>Pass Percentage</div>
                    <div style={kpiValue('#059669')} id="examPassPct">{`${kpis.passPct}%`}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>NMC Eligible Cadets</div>
                </div>
                <div className="card kpi-card" style={kpiCardStyle}>
                    <div style={kpiLabel}>Distinctions (≥ 75%)</div>
                    <div style={kpiValue('#7c3aed')} id="examDistinctionCount">{kpis.distinctions}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6d28d9', fontWeight: 600 }}>Academic Honours</div>
                </div>
                <div className="card kpi-card" style={kpiCardStyle}>
                    <div style={kpiLabel}>Remedial Attention</div>
                    <div style={kpiValue('#dc2626')} id="examRemedialCount">{kpis.remedial}</div>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Scores &lt; 50% combined</div>
                </div>
            </div>

            {/* Marksheet Table Card */}
            <div className="card">
                <div className="table-wrapper">
                    <table id="adminExamsTable">
                        <thead id="adminExamsThead">
                            {headTwoPaper !== null && <ExamHead twoPaper={headTwoPaper} />}
                        </thead>
                        <tbody id="adminExamsTbody">
                            {body.kind === 'initial' ? (
                                <MessageRow colSpan={10} padding={24}>Loading marksheet entry grid...</MessageRow>
                            ) : body.kind === 'loading' ? (
                                <MessageRow colSpan={errSpan} padding={24}>Loading marksheet data...</MessageRow>
                            ) : body.kind === 'error' ? (
                                <MessageRow colSpan={errSpan} padding={24} color="#ef4444">{body.message}</MessageRow>
                            ) : body.rows.length === 0 ? (
                                <MessageRow colSpan={10} padding={24}>No student records found</MessageRow>
                            ) : (
                                body.rows.map((m) => (
                                    <tr id={`examRow-${m.student_id}`} key={m.student_id}>
                                        <td style={{ textAlign: 'center' }}>
                                            <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{m.roll_number || ''}</strong>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{m.name || ''}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.batch_year || '3rd Year MBBS'}</div>
                                        </td>
                                        {body.twoPaper ? (
                                            <>
                                                <MarksInput row={m} field="inP1" prefix="exP1" max={100} onChange={onMark} />
                                                <MarksInput row={m} field="inP2" prefix="exP2" max={100} onChange={onMark} />
                                                <td style={{ textAlign: 'center' }}>
                                                    <span id={`exThCalc-${m.student_id}`} style={{ fontWeight: 800, color: '#1e1b4b' }}>{m.thCalcText}</span>
                                                </td>
                                            </>
                                        ) : (
                                            <MarksInput row={m} field="inTh" prefix="exTh" max={100} onChange={onMark} />
                                        )}
                                        <MarksInput row={m} field="inPr" prefix="exPr" max={100} onChange={onMark} />
                                        <MarksInput row={m} field="inVv" prefix="exVv" max={20} onChange={onMark} />
                                        <td style={{ textAlign: 'center' }}>
                                            <strong id={`exTot-${m.student_id}`} style={{ fontSize: '0.95rem', color: '#1e1b4b' }}>{m.totText}</strong>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <strong id={`exPct-${m.student_id}`} style={{ fontSize: '0.95rem', color: m.pctColor }}>{m.pctText}</strong>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span id={`exStatusBadge-${m.student_id}`}><StatusBadge status={m.status} /></span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span id={`exNmcChip-${m.student_id}`}><NmcChip row={m} twoPaper={body.twoPaper} /></span>
                                        </td>
                                        <td>
                                            <input type="text" className="marks-remarks-input" id={`exRemarks-${m.student_id}`} value={m.inRemarks} placeholder="Clinical remarks..." onChange={(e) => onRemarks(m.student_id, e.target.value)} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Sticky Save Bar */}
                <div className="admin-sticky-action-bar">
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                            Scores will be published directly to student examination reports and marksheets.
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-primary" onClick={save} id="btnSaveExams" disabled={saving} style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)', fontWeight: 750, padding: '0.65rem 1.4rem' }}>
                            {saving ? '⏳ Saving & Publishing...' : '💾 Save & Publish Exam Results'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
