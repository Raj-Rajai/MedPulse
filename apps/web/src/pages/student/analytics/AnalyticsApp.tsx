/**
 * student/analytics.html: epidemiological dashboard (KPIs, eight Chart.js charts, cohort drilldown, SQL audit reports).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutReload, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { runWhenActive } from '../common/utils';
import { AUDIT_META, type AuditId } from './audit';
import { renderChart, type ChartKey, type AnalyticsData, type PatientCurve } from './charts';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

interface FamilyOpt {
    id: number;
    family_code?: string;
    family_no?: number;
    head_of_family?: string;
    member_count?: number;
}

export interface Member {
    name?: string;
    relation_to_hof?: string;
    family_code?: string;
    village_ward?: string;
    age_years?: number;
    gender?: string;
    sbp?: number;
    dbp?: number;
    rbs?: number;
    hb?: number;
    bmi?: number;
    has_htn?: string;
    has_dm?: string;
    has_anaemia?: string;
    work_type?: string;
    diagnosis?: string;
    follow_up_count?: number;
}

type TabId = 'tab-all' | 'tab-ncd' | 'tab-nutrition' | 'tab-longitudinal' | 'tab-audit';
const TAB_ORDER: TabId[] = ['tab-all', 'tab-ncd', 'tab-nutrition', 'tab-longitudinal', 'tab-audit'];
const CHART_KEYS: ChartKey[] = ['bmi', 'ncdAge', 'longitudinal', 'bp', 'anaemia', 'conditions', 'calorie', 'work'];
const HIDDEN: Partial<Record<TabId, ChartKey[]>> = {
    'tab-ncd': ['bmi', 'calorie', 'work', 'anaemia'],
    'tab-nutrition': ['ncdAge', 'bp', 'longitudinal', 'conditions'],
    'tab-longitudinal': ['bmi', 'ncdAge', 'bp', 'anaemia', 'conditions', 'calorie', 'work'],
};

interface AuditState {
    id: AuditId;
    status: 'loading' | 'empty' | 'rows' | 'error';
    cols?: string[];
    rows?: Record<string, unknown>[];
    error?: string;
}

const badgeStyle = { fontSize: '0.65rem', padding: '0.1rem 0.35rem', marginLeft: '0.25rem' };

function DrilldownRows({ members }: { members: Member[] }) {
    if (!members || members.length === 0) {
        return (
            <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No matching member records found for the active filter.</td>
            </tr>
        );
    }
    return (
        <>
            {members.map((m, i) => (
                <tr key={i}>
                    <td>
                        <strong>{m.name}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.relation_to_hof}</div>
                    </td>
                    <td>
                        <span className="badge badge-info">{m.family_code}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.village_ward || '-'}</div>
                    </td>
                    <td>
                        {m.age_years} yrs ({m.gender})
                    </td>
                    <td>
                        {m.sbp && m.dbp ? (
                            <>
                                <strong style={{ color: m.has_htn === 'Y' ? 'var(--danger-text)' : 'inherit' }}>
                                    {m.sbp}/{m.dbp}
                                </strong>
                                {m.has_htn === 'Y' ? (
                                    <>
                                        {' '}
                                        <span className="badge badge-danger" style={badgeStyle}>HTN</span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            '-'
                        )}
                    </td>
                    <td>
                        {m.rbs ? (
                            <>
                                <strong style={{ color: m.has_dm === 'Y' ? 'var(--warning-text)' : 'inherit' }}>{m.rbs}</strong>
                                {m.has_dm === 'Y' ? (
                                    <>
                                        {' '}
                                        <span className="badge badge-warning" style={badgeStyle}>DM</span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            '-'
                        )}
                    </td>
                    <td>
                        {m.hb ? (
                            <>
                                <span style={{ color: m.has_anaemia === 'Y' ? 'var(--danger-text)' : 'inherit' }}>{m.hb}</span>
                                {m.has_anaemia === 'Y' ? (
                                    <>
                                        {' '}
                                        <span className="badge badge-danger" style={badgeStyle}>Anaemic</span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            '-'
                        )}
                    </td>
                    <td>
                        <strong>{m.bmi || '-'}</strong>
                    </td>
                    <td>
                        <span className="badge badge-subtle">{m.work_type || 'Moderate'}</span>
                    </td>
                    <td style={{ maxWidth: '220px', fontSize: '0.8rem', lineHeight: '1.35' }}>
                        {m.diagnosis ? m.diagnosis : <span style={{ color: 'var(--text-muted)' }}>None reported</span>}
                    </td>
                    <td>
                        <span className={`badge ${m.follow_up_count && m.follow_up_count > 0 ? 'badge-success' : 'badge-subtle'}`}>{m.follow_up_count || 0} visits</span>
                    </td>
                    <td>
                        <a href="/family-manage.html" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}>
                            View →
                        </a>
                    </td>
                </tr>
            ))}
        </>
    );
}

function AuditBody({ audit }: { audit: AuditState | null }) {
    if (!audit)
        return (
            <tr>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No query selected</td>
            </tr>
        );
    if (audit.status === 'loading')
        return (
            <tr>
                <td style={{ textAlign: 'center' }}>Executing database query...</td>
            </tr>
        );
    if (audit.status === 'empty')
        return (
            <tr>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No matching records found in database.</td>
            </tr>
        );
    if (audit.status === 'error')
        return (
            <tr>
                <td style={{ color: 'var(--danger-text)' }}>Error running query: {audit.error}</td>
            </tr>
        );
    const cols = audit.cols || [];
    return (
        <>
            {(audit.rows || []).map((r, i) => (
                <tr key={i}>
                    {cols.map((c) => (
                        <td key={c}>
                            <strong>{r[c] !== null ? String(r[c]) : '-'}</strong>
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

export function AnalyticsApp() {
    useStudentChrome(standardSidebar);
    const [user] = useState(readStoredUser);

    const {
        activeModal,
        saving: privacySaving,
        handleForm1Continue,
        handleForm2Consent,
        handleForm2Refuse,
        closeModal,
    } = useStudentPrivacy(user?.roll_number);

    const [families, setFamilies] = useState<FamilyOpt[]>([]);
    const [filters, setFilters] = useState({ gender: 'all', ageGroup: 'all', familyId: 'all' });
    const { gender, ageGroup, familyId } = filters;
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [shown, setShown] = useState<Member[] | null>(null);
    const [search, setSearch] = useState('');
    const [patientSel, setPatientSel] = useState('cohort');
    const [tab, setTab] = useState<TabId>('tab-all');
    const [cardsTab, setCardsTab] = useState<TabId | null>(null);
    const [touched, setTouched] = useState(false);
    const [slide, setSlide] = useState<{ n: number; cls: string; target: 'charts' | 'audit' } | null>(null);
    const [audit, setAudit] = useState<AuditState | null>(null);
    const tabIndex = useRef(0);
    const dataRef = useRef<AnalyticsData | null>(null);
    const membersRef = useRef<Member[]>([]);
    const charts = useRef<Partial<Record<ChartKey, Chart>>>({});
    const canvasRefs = Object.fromEntries(CHART_KEYS.map((k) => [k, useRef<HTMLCanvasElement>(null)])) as Record<ChartKey, React.RefObject<HTMLCanvasElement | null>>;
    const chartsWrapRef = useRef<HTMLDivElement>(null);
    const drilldownRef = useRef<HTMLDivElement>(null);
    const auditRef = useRef<HTMLDivElement>(null);

    const draw = (key: ChartKey, d: AnalyticsData, patient?: PatientCurve) => {
        const canvas = canvasRefs[key].current;
        if (!canvas) return;
        charts.current[key]?.destroy();
        charts.current[key] = renderChart(key, canvas, d, { onBmiClick: filterTableByBmiCategory, patient });
    };

    const fetchAnalyticsData = async (f = filters) => {
        const params = new URLSearchParams();
        if (f.gender !== 'all') params.append('gender', f.gender);
        if (f.ageGroup !== 'all') params.append('ageGroup', f.ageGroup);
        if (f.familyId !== 'all') params.append('familyId', f.familyId);
        try {
            const res = await fetch(`/api/analytics/charts?${params.toString()}`);
            const d = (await res.json()) as AnalyticsData;
            dataRef.current = d;
            const list = d.memberList || [];
            membersRef.current = list;
            for (const key of CHART_KEYS) draw(key, d);
            // populatePatientSelector() rebuilt the options with "cohort" selected.
            setPatientSel('cohort');
            setData(d);
            setMembers(list);
            setShown(list);
        } catch (err) {
            console.error('Error fetching analytics:', err);
        }
    };

    useEffect(() => {
        return runWhenActive(async () => {
            try {
                const res = await fetch('/api/families');
                const list = (await res.json()) as FamilyOpt[];
                setFamilies(list);
            } catch (err) {
                console.error('Error loading families for filter:', err);
            }
            await fetchAnalyticsData();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => () => Object.values(charts.current).forEach((c) => c?.destroy()), []);

    const onFilterChange = (patch: Partial<typeof filters>) => {
        const next = { ...filters, ...patch };
        setFilters(next);
        fetchAnalyticsData(next);
    };

    const resetFilters = () => {
        const next = { gender: 'all', ageGroup: 'all', familyId: 'all' };
        setFilters(next);
        setSearch('');
        fetchAnalyticsData(next);
    };

    const k = data?.kpis || null;
    const calorie = (() => {
        const normal = (data?.dietaryStatus || []).find((d) => d.calorie_status === 'Normal')?.count || 0;
        const total = k?.totalHouseholds || 1;
        return { normal, total, rate: Math.round((normal / total) * 100) };
    })();

    const filterDrilldownTable = (value: string) => {
        setSearch(value);
        const q = value.toLowerCase().trim();
        const all = membersRef.current;
        if (!q) {
            setShown(all);
            return;
        }
        setShown(
            all.filter(
                (m) =>
                    (m.name || '').toLowerCase().includes(q) ||
                    (m.family_code || '').toLowerCase().includes(q) ||
                    (m.diagnosis || '').toLowerCase().includes(q) ||
                    (m.village_ward || '').toLowerCase().includes(q),
            ),
        );
    };

    function filterTableByBmiCategory(category: string) {
        document.getElementById('drilldownCard')?.scrollIntoView({ behavior: 'smooth' });
        const all = membersRef.current;
        let filtered = all;
        if (category.includes('Underweight')) filtered = all.filter((m) => m.bmi && m.bmi < 18.5);
        else if (category.includes('Normal')) filtered = all.filter((m) => m.bmi && m.bmi >= 18.5 && m.bmi <= 22.9);
        else if (category.includes('Overweight')) filtered = all.filter((m) => m.bmi && m.bmi >= 23.0 && m.bmi <= 27.4);
        else if (category.includes('Obese')) filtered = all.filter((m) => m.bmi && m.bmi >= 27.5);
        setShown(filtered);
    }

    const onLongitudinalPatientChange = (value: string) => {
        setPatientSel(value);
        const d = dataRef.current;
        const trends = d?.longitudinalTrends;
        if (!d || !trends) return;
        if (value === 'cohort') draw('longitudinal', d);
        else {
            const patient = trends.patientCurves.find((p) => String(p.id) === value);
            if (patient) draw('longitudinal', d, patient);
        }
    };

    // Restart the slide animation on the newly shown view (purely visual, like the original reflow trick).
    useLayoutEffect(() => {
        if (!slide) return;
        const els = [chartsWrapRef.current, auditRef.current, drilldownRef.current];
        els.forEach((el) => el?.classList.remove('tab-slide-right', 'tab-slide-left'));
        const el = slide.target === 'audit' ? auditRef.current : chartsWrapRef.current;
        if (el) {
            void el.offsetWidth;
            el.classList.add(slide.cls);
        }
    }, [slide]);

    const switchViewTab = (tabId: TabId) => {
        const newIndex = TAB_ORDER.indexOf(tabId);
        const cls = newIndex >= tabIndex.current ? 'tab-slide-right' : 'tab-slide-left';
        tabIndex.current = newIndex >= 0 ? newIndex : 0;
        setTab(tabId);
        setTouched(true);
        setSlide((s) => ({ n: (s?.n || 0) + 1, cls, target: tabId === 'tab-audit' ? 'audit' : 'charts' }));
        if (tabId === 'tab-audit') loadAuditReport('student-audit');
        else setCardsTab(tabId);
    };

    const cardStyle = (key: ChartKey): React.CSSProperties | undefined => {
        if (!cardsTab) return undefined;
        return { display: HIDDEN[cardsTab]?.includes(key) ? 'none' : 'flex' };
    };


    const auditBtnClass = (id: AuditId) => ((audit ? audit.id : 'student-audit') === id ? 'btn btn-primary' : 'btn btn-secondary');

    async function loadAuditReport(reportId: AuditId) {
        setAudit({ id: reportId, status: 'loading', cols: audit?.cols });
        try {
            const res = await fetch(`/api/analytics/report/${reportId}`);
            const result = (await res.json()) as { data?: Record<string, unknown>[] };
            const rows = result.data || [];
            if (rows.length === 0) {
                setAudit((a) => ({ id: reportId, status: 'empty', cols: a?.cols }));
                return;
            }
            setAudit({ id: reportId, status: 'rows', cols: Object.keys(rows[0]), rows });
        } catch (err) {
            setAudit((a) => ({ id: reportId, status: 'error', cols: a?.cols, error: err instanceof Error ? err.message : String(err) }));
        }
    }

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="analytics" logoTitle="SAL Education • HEALTH PORTAL" onToggle={standardSidebar.toggle}
                badge={user ? <StudentBadge roll={String(user.roll_number)} mode="profile" onLogout={logoutReload} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
        <main className="main-content">
            <div className="page-header anim-fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="page-title">Analytics</h1>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" onClick={resetFilters} title="Reset all interactive filters">↺ Reset Filters</button>
                </div>
            </div>
            <div className="kpi-grid anim-fade-up anim-delay-1" id="kpiContainer">
                <div className="kpi-card kpi-purple">
                    <div className="kpi-header">
                        <span className="kpi-title">Surveyed Households</span>
                        <span className="kpi-icon">🏠</span>
                    </div>
                    <div className="kpi-value" id="kpiHouseholds">{k ? k.totalHouseholds : '-'}</div>
                    <div className="kpi-sub">
                        <span>Active Field Postings</span>
                    </div>
                </div>
                <div className="kpi-card kpi-blue">
                    <div className="kpi-header">
                        <span className="kpi-title">Screened Population</span>
                        <span className="kpi-icon">👥</span>
                    </div>
                    <div className="kpi-value" id="kpiMembers">{k ? k.totalMembers : '-'}</div>
                    <div className="kpi-sub" id="kpiSexRatio">
                        {k ? (
                            <span>
                                {k.males} M • {k.females} F • Sex Ratio: <strong>{k.sexRatio}</strong>
                            </span>
                        ) : (
                            <span>Sex Ratio: - / 1000 M</span>
                        )}
                    </div>
                </div>
                <div className="kpi-card kpi-rose">
                    <div className="kpi-header">
                        <span className="kpi-title">Adult Hypertension Rate</span>
                        <span className="kpi-icon">🩺</span>
                    </div>
                    <div className="kpi-value" id="kpiHtn">{k ? `${k.htnPct}%` : '-'}</div>
                    <div className="kpi-sub" id="kpiHtnCases">
                        <span>{k ? `${k.htnCases} adult cases • Avg SBP: ${k.avgSbp || '-'}` : '- cases • SBP ≥ 140 or DBP ≥ 90'}</span>
                    </div>
                </div>
                <div className="kpi-card kpi-amber">
                    <div className="kpi-header">
                        <span className="kpi-title">Adult Diabetes Rate</span>
                        <span className="kpi-icon">🩸</span>
                    </div>
                    <div className="kpi-value" id="kpiDm">{k ? `${k.dmPct}%` : '-'}</div>
                    <div className="kpi-sub" id="kpiDmCases">
                        <span>{k ? `${k.dmCases} adult cases • Avg RBS: ${k.avgRbs || '-'}` : '- cases • RBS ≥ 200 mg/dL'}</span>
                    </div>
                </div>
                <div className="kpi-card kpi-emerald">
                    <div className="kpi-header">
                        <span className="kpi-title">Community Anaemia Rate</span>
                        <span className="kpi-icon">🧪</span>
                    </div>
                    <div className="kpi-value" id="kpiAnaemia">{k ? `${k.anaemiaPct}%` : '-'}</div>
                    <div className="kpi-sub" id="kpiAnaemiaCases">
                        <span>{k ? `${k.anaemiaCases} cases • Avg Hb: ${k.avgHb ? k.avgHb + ' g/dL' : '-'}` : '- cases • Hb < 12.0 g/dL'}</span>
                    </div>
                </div>
                <div className="kpi-card kpi-indigo">
                    <div className="kpi-header">
                        <span className="kpi-title">Caloric Adequacy Rate</span>
                        <span className="kpi-icon">🥗</span>
                    </div>
                    <div className="kpi-value" id="kpiCalorie">{k ? `${calorie.rate}%` : '-'}</div>
                    <div className="kpi-sub" id="kpiCalorieStatus">
                        <span>{k ? `${calorie.normal} / ${calorie.total} households adequate` : 'ICMR CU Recommended'}</span>
                    </div>
                </div>
            </div>
            <div className="analytics-filter-bar anim-fade-up anim-delay-2">
                <div className="filter-controls">
                    <div className="filter-item">
                        <label htmlFor="filterGender">Gender</label>
                        <select id="filterGender" className="filter-select" value={gender} onChange={(e) => onFilterChange({ gender: e.target.value })}>
                            <option value="all">All Genders</option>
                            <option value="M">Male Only</option>
                            <option value="F">Female Only</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label htmlFor="filterAgeGroup">Age Cohort</label>
                        <select id="filterAgeGroup" className="filter-select" value={ageGroup} onChange={(e) => onFilterChange({ ageGroup: e.target.value })}>
                            <option value="all">All Ages</option>
                            <option value="under18">{"Pediatric & Adolescents (< 18 yrs)"}</option>
                            <option value="18-44">Young Adults (18–44 yrs)</option>
                            <option value="45-59">Middle-aged (45–59 yrs)</option>
                            <option value="60+">Geriatric (60+ yrs)</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label htmlFor="filterFamily">Household Unit</label>
                        <select id="filterFamily" className="filter-select" value={familyId} onChange={(e) => onFilterChange({ familyId: e.target.value })}>
                            <option value="all">All Households</option>
                            {families.map((f) => (
                                <option key={f.id} value={f.id}>{`[${f.family_code || `FAM-${String(f.family_no).padStart(4, '0')}`}] ${f.head_of_family} (${f.member_count || 0} members)`}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="badge badge-info" id="filterStatusBadge">{data ? `Showing ${members.length} Members` : 'Showing 19 Members'}</span>
                    <button className="btn btn-secondary" onClick={resetFilters} style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}>Clear Filters</button>
                </div>
            </div>
            <div className="analytics-tabs anim-fade-up anim-delay-2">
                <button className={tab === 'tab-all' ? 'analytics-tab active' : 'analytics-tab'} onClick={() => switchViewTab('tab-all')}>{"🌐 All Visualizations & Overview"}</button>
                <button className={tab === 'tab-ncd' ? 'analytics-tab active' : 'analytics-tab'} onClick={() => switchViewTab('tab-ncd')}>{"🩺 Cardiovascular & NCDs"}</button>
                <button className={tab === 'tab-nutrition' ? 'analytics-tab active' : 'analytics-tab'} onClick={() => switchViewTab('tab-nutrition')}>{"🩸 Nutrition & Hematology"}</button>
                <button className={tab === 'tab-longitudinal' ? 'analytics-tab active' : 'analytics-tab'} onClick={() => switchViewTab('tab-longitudinal')}>📈 Longitudinal Care Tracking</button>
                <button className={tab === 'tab-audit' ? 'analytics-tab active' : 'analytics-tab'} onClick={() => switchViewTab('tab-audit')}>🔍 Academic SQL Audit</button>
            </div>
            <div id="chartsViewContainer" className="anim-fade-up anim-delay-3" ref={chartsWrapRef} style={tab === 'tab-audit' ? { display: 'none' } : touched ? { display: 'block' } : undefined}>
                <div className="charts-grid">
                    <div className="chart-card" id="cardBmiChart" style={cardStyle('bmi')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">🥧 Adult Nutritional Status (BMI)</h3>
                                <div className="chart-desc">{"Asian-Indian WHO Cut-offs (<18.5, 18.5-22.9, 23-27.4, ≥27.5)"}</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="bmiChartCanvas" ref={canvasRefs.bmi} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardNcdAgeChart" style={cardStyle('ncdAge')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">📊 NCD Burden Across Age Cohorts</h3>
                                <div className="chart-desc">Hypertension (%) vs Diabetes Mellitus (%) across age brackets</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="ncdAgeChartCanvas" ref={canvasRefs.ncdAge} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardLongitudinalChart" style={{ gridColumn: "1 / -1", ...cardStyle('longitudinal') }}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">📈 Longitudinal Follow-up Progression Over Visits</h3>
                                <div className="chart-desc">Chronological tracking of SBP, DBP, RBS, and Hb across consecutive examination visits</div>
                            </div>
                            <div className="chart-actions" style={{ gap: "0.6rem" }}>
                                <select id="lineChartPatientSelector" className="filter-select" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }} value={patientSel} onChange={(e) => onLongitudinalPatientChange(e.target.value)}>
                                    <option value="cohort">👥 Cohort Average (All Patients)</option>
                                    {(data?.longitudinalTrends?.patientCurves || []).map((p) => (
                                        <option key={p.id} value={p.id}>{`👤 ${p.name} (${p.gender}, ${p.visits.length} Visits)`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap" style={{ height: "320px" }}>
                            <canvas id="longitudinalChartCanvas" ref={canvasRefs.longitudinal} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardBpChart" style={cardStyle('bp')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">📊 Blood Pressure Stratification</h3>
                                <div className="chart-desc">AHA/ACC Classification: Normal, Pre-HTN, Stage 1, Stage 2</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="bpChartCanvas" ref={canvasRefs.bp} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardAnaemiaChart" style={cardStyle('anaemia')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">{"📊 Anaemia Prevalence & Mean Hb by Gender"}</h3>
                                <div className="chart-desc">Comparison of community anaemia rates and average Hb (g/dL)</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="anaemiaChartCanvas" ref={canvasRefs.anaemia} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardConditionsChart" style={cardStyle('conditions')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">📊 Community Chronic Pathologies Ranking</h3>
                                <div className="chart-desc">Top diagnosed conditions ranked by prevalence in surveyed families</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="conditionsChartCanvas" ref={canvasRefs.conditions} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardCalorieChart" style={cardStyle('calorie')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">🥧 Household Caloric Adequacy</h3>
                                <div className="chart-desc">ICMR Consumption Units adequacy (Normal vs Deficient vs Excess)</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="calorieChartCanvas" ref={canvasRefs.calorie} />
                        </div>
                    </div>
                    <div className="chart-card" id="cardWorkChart" style={cardStyle('work')}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">📊 Occupational Physical Activity Level</h3>
                                <div className="chart-desc">Daily physical exertion categories (Sedentary vs Moderate vs Heavy)</div>
                            </div>
                        </div>
                        <div className="chart-canvas-wrap">
                            <canvas id="workChartCanvas" ref={canvasRefs.work} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="card" id="drilldownCard" ref={drilldownRef} style={{ marginTop: "1.5rem", ...(tab === 'tab-audit' ? { display: 'none' } : touched ? { display: 'block' } : {}) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: "0.15rem", fontSize: "1.25rem" }}>
                            {"🔍 Cohort Drilldown & Clinical Records ("}
                            <span id="drilldownCount">{shown ? shown.length : 0}</span>
                            {' '}
                            Members)
                        </h2>
                        <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>Click any row to inspect member profile or click chart elements above to filter this table</div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input type="text" id="drilldownSearch" className="search-input" placeholder="🔍 Search by name, condition, village..." value={search} onChange={(e) => filterDrilldownTable(e.target.value)} style={{ maxWidth: "260px", fontSize: "0.825rem", padding: "0.4rem 0.8rem" }} />
                    </div>
                </div>
                <div className="table-wrapper">
                    <table id="drilldownTable">
                        <thead>
                            <tr>
                                <th>Member Name</th>
                                <th>Household</th>
                                <th>Age / Gender</th>
                                <th>BP (mmHg)</th>
                                <th>RBS</th>
                                <th>Hb (g/dL)</th>
                                <th>BMI</th>
                                <th>Work Type</th>
                                <th>Diagnosed Conditions</th>
                                <th>Visits</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="drilldownTbody">
                            {shown === null ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>Loading data...</td>
                                </tr>
                            ) : (
                                <DrilldownRows members={shown} />
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="card" id="auditQueryCard" ref={auditRef} style={{ display: tab === 'tab-audit' ? "block" : "none", marginTop: "1.5rem" }}>
                <div className="section-title">
                    <span>{"🔍 Academic SQL Query Inspector & Medical College Audit"}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                    <button className={auditBtnClass('student-audit')} onClick={() => loadAuditReport('student-audit')}>1. Student Survey Audit</button>
                    <button className={auditBtnClass('ncd-prevalence')} onClick={() => loadAuditReport('ncd-prevalence')}>{"2. Adult NCD Prevalence (HTN & DM)"}</button>
                    <button className={auditBtnClass('anaemia-gender')} onClick={() => loadAuditReport('anaemia-gender')}>{"3. Anaemia & Hb by Gender"}</button>
                    <button className={auditBtnClass('bmi-distribution')} onClick={() => loadAuditReport('bmi-distribution')}>4. Adult BMI Distribution</button>
                    <button className={auditBtnClass('pediatric-health')} onClick={() => loadAuditReport('pediatric-health')}>5. Pediatric Health (0-5 Yrs)</button>
                </div>
                <div id="queryMeta" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", padding: "1.25rem 1.35rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem", boxShadow: "var(--shadow-xs)" }}>
                    <h3 id="reportTitle" style={{ fontSize: "1.05rem", marginBottom: "0.35rem", color: "var(--text-primary)", fontWeight: "700" }}>{audit ? AUDIT_META[audit.id].title : 'Select an audit report above'}</h3>
                    <p id="reportDesc" style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.65rem" }}>{audit ? AUDIT_META[audit.id].desc : ''}</p>
                    <details>
                        <summary style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}>View Relational SQL Code</summary>
                        <pre id="rawSqlCode" style={{ marginTop: "0.65rem", padding: "0.9rem 1.1rem", background: "#0f172a", color: "#f8fafc", borderRadius: "var(--radius-md)", fontSize: "0.825rem", overflowX: "auto", border: "1px solid #334155", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", lineHeight: "1.6" }}>{audit ? AUDIT_META[audit.id].sql : ''}</pre>
                    </details>
                </div>
                <div className="table-wrapper">
                    <table id="resultsTable">
                        <thead id="resultsThead">
                            {audit && audit.cols ? (
                                <tr>
                                    {audit.cols.map((c) => <th key={c}>{c.replace(/_/g, ' ').toUpperCase()}</th>)}
                                </tr>
                            ) : (
                                <tr>
                                    <th>Select an audit query above to view results</th>
                                </tr>
                            )}
                        </thead>
                        <tbody id="resultsTbody">
                            <AuditBody audit={audit} />
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="card" style={{ marginTop: "1.5rem" }}>
                <h2>{"Database Schema & Methodological References"}</h2>
                <p className="card-desc">Standards-aligned epidemiological analytics engine built for PSM (Community Medicine) medical training:</p>
                <ul style={{ marginLeft: "1.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.8" }}>
                    <li>
                        <strong>ICMR Dietary Standards</strong>
                        : Caloric requirements assessed per Consumption Unit (CU) based on occupational workload (Sedentary, Moderate, Heavy).
                    </li>
                    <li>
                        <strong>Asian-Indian BMI Cut-offs (WHO/Consensus Guidelines)</strong>
                        : Normal (18.5–22.9 kg/m²), Overweight (23.0–27.4 kg/m²), Obese (≥27.5 kg/m²).
                    </li>
                    <li>
                        <strong>NCD Diagnostic Thresholds (Roll 235 Protocol)</strong>
                        {": Hypertension: SBP ≥140 mmHg or DBP ≥90 mmHg; Diabetes Mellitus: RBS ≥200 mg/dL; Anaemia: Hb <12.0 g/dL."}
                    </li>
                    <li>
                        <strong>Longitudinal Cohort Progression</strong>
                        : Follow-up visits capture chronological blood pressure control, glycemic response, medication adherence, and health improvement.
                    </li>
                </ul>
            </div>
        </main>
        {activeModal && (
            <ConfidentialityNoticeModal
                type={activeModal}
                open={Boolean(activeModal)}
                onContinue={handleForm1Continue}
                onConsent={handleForm2Consent}
                onRefuse={handleForm2Refuse}
                onClose={closeModal}
                saving={privacySaving}
            />
        )}
        </BodyPortal>
    );
}
