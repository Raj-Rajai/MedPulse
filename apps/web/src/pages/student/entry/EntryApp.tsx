/**
 * student/entry.html: household selection board (custom dropdown + quick strip), household
 * diet card, member roster carousel and the clinical survey form with its gender / age rules
 * and live classifiers. The field-location card sits first in <main> (field-location.js).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutReload, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_ENTRY, useToasts } from '../common/Toasts';
import { errMsg, runWhenActive } from '../common/utils';
import { LocationVerificationCard } from '../common/fieldLocation';
import { Select, selectValue, type Option } from '../common/Select';
import { familyCode, isSurveyDone, type FamilyDetail, type FamilySummary, type Member } from './types';
import { INITIAL_FORM, checkAdultVitals, checkMuac, computeWhr, formFromMember, payloadFromForm, type MuacStatus, type SurveyForm, type Whr } from './survey';
import { SurveyFormView } from './SurveyForm';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

const DIET_STATUS: readonly Option[] = [['Normal', 'Normal (N)'], ['Deficient', 'Deficient (D)'], ['Excess', 'Excess (E)']];
const DIET_ADVICE: readonly Option[] = [['Y', 'Yes (Y)'], ['N', 'No (N)']];

type LoadState = 'loading' | 'empty' | 'list';

export function EntryApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_ENTRY);
    const [loggedInStudent] = useState(readStoredUser);

    const {
        activeModal,
        saving: privacySaving,
        handleForm1Continue,
        handleForm2Consent,
        handleForm2Refuse,
        closeModal,
    } = useStudentPrivacy(loggedInStudent?.roll_number);

    const [families, setFamilies] = useState<FamilySummary[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [query, setQuery] = useState('');
    /** renderCustomFamilySelect() has run (after loading, or when the menu filters). */
    const [listRendered, setListRendered] = useState(false);
    /** The custom trigger keeps the last family that was found in the list. */
    const [triggerFamily, setTriggerFamily] = useState<FamilySummary | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [familyId, setFamilyId] = useState<number | null>(null);
    const [familyData, setFamilyData] = useState<FamilyDetail | null>(null);
    const [dietOpen, setDietOpen] = useState(false);
    const [diet, setDiet] = useState({ totalCu: '4.0', calorie: '12000', status: 'Normal', advice: 'N' });
    const [dietSaving, setDietSaving] = useState(false);

    const [memberId, setMemberId] = useState<number | null>(null);
    const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
    const [form, setForm] = useState<SurveyForm>(INITIAL_FORM);
    const [muac, setMuac] = useState<MuacStatus>('initial');
    const [femaleAlert, setFemaleAlert] = useState<Whr | null>(null);
    const [maleAlert, setMaleAlert] = useState<Whr | null>(null);
    const [saving, setSaving] = useState<'save' | 'next' | null>(null);

    const [stripScroll, setStripScroll] = useState<{ id: number; n: number } | null>(null);
    const [rosterScroll, setRosterScroll] = useState<{ id: number; n: number } | null>(null);
    const [dietScroll, setDietScroll] = useState(0);

    const familiesRef = useRef<FamilySummary[]>([]);
    const familyDataRef = useRef<FamilyDetail | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const members = familyData?.members || [];
    const member = members.find((m) => m.id === memberId) || null;

    /* ---- Member selection (selectMemberForSurvey) ---- */
    const selectMemberForSurvey = useCallback((id: number, list: Member[]) => {
        const m = list.find((x) => x.id === id);
        if (!m) return;
        setMemberId(id);
        setRosterScroll((s) => ({ id, n: (s?.n || 0) + 1 }));
        const muacRes = checkMuac(formFromMember(m));
        setForm(muacRes.f);
        if (muacRes.status) setMuac(muacRes.status);
        const isFemale = m.gender === 'F';
        const w = computeWhr(muacRes.f, isFemale);
        if (w) (isFemale ? setFemaleAlert : setMaleAlert)(w);
    }, []);

    /* ---- Select family and fetch roster ---- */
    const selectFamily = useCallback(async (id: number, preselectMemberId: number | null = null) => {
        setFamilyId(id);
        const found = familiesRef.current.find((f) => f.id === id);
        if (found) setTriggerFamily(found);
        setStripScroll((s) => ({ id, n: (s?.n || 0) + 1 }));
        try {
            const res = await fetch(`/api/families/${id}`);
            const data = (await res.json()) as FamilyDetail;
            familyDataRef.current = data;
            setFamilyData(data);
            setDiet({
                totalCu: String(data.total_cu || 0),
                calorie: String(data.calorie_intake_per_cu || 0),
                status: data.calorie_status || 'Normal',
                advice: data.dietary_advice_given || 'N',
            });
            setDoneIds(new Set());
            const list = data.members || [];
            if (list.length > 0) {
                let targetId = preselectMemberId;
                if (!targetId || !list.some((m) => m.id === targetId)) targetId = list[0].id;
                selectMemberForSurvey(targetId, list);
            }
        } catch (err) {
            console.error('Error selecting family:', err);
            showToast('Error loading family record', 'error');
        }
    }, [selectMemberForSurvey, showToast]);

    useEffect(() => {
        return runWhenActive(async () => {
            try {
                const res = await fetch('/api/families');
                const list = (await res.json()) as FamilySummary[];
                if (!list || list.length === 0) {
                    setLoadState('empty');
                    setListRendered(true);
                } else {
                    if (!Array.isArray(list)) throw new TypeError('allFamilies.map is not a function');
                    familiesRef.current = list;
                    setFamilies(list);
                    setLoadState('list');
                    setListRendered(true);
                }
            } catch (err) {
                console.error('Error loading families dropdown:', err);
                showToast('Failed to load families', 'error');
            }
            const urlParams = new URLSearchParams(window.location.search);
            const paramFamilyId = urlParams.get('familyId');
            const paramMemberId = urlParams.get('memberId');
            if (paramFamilyId) {
                await selectFamily(parseInt(paramFamilyId, 10), paramMemberId ? parseInt(paramMemberId, 10) : null);
            } else if (familiesRef.current.length > 0) {
                selectFamily(familiesRef.current[0].id);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---- Scroll effects (scrollIntoView calls of the original) ---- */
    useEffect(() => {
        if (stripScroll) document.getElementById(`quickFamilyCard_${stripScroll.id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }, [stripScroll]);
    useEffect(() => {
        if (rosterScroll) document.getElementById(`rosterCard_${rosterScroll.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [rosterScroll]);
    useEffect(() => {
        if (dietScroll) document.getElementById('familyDietCard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [dietScroll]);

    /* ---- Custom dropdown ---- */
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const c = containerRef.current;
            if (c && !c.contains(e.target as Node)) closeMenu();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [closeMenu]);

    const toggleMenu = () => {
        if (menuOpen) {
            closeMenu();
            return;
        }
        setMenuOpen(true);
        setQuery('');
        setListRendered(true);
        setTimeout(() => searchRef.current?.focus(), 60);
    };
    const onCustomSelectFamily = (id: number) => {
        closeMenu();
        selectFamily(id);
    };

    const q = query.toLowerCase().trim();
    const shown = families.filter((f) => {
        const code = familyCode(f).toLowerCase();
        return code.includes(q) || (f.head_of_family || '').toLowerCase().includes(q) || (f.village_ward || '').toLowerCase().includes(q);
    });
    const selectedF = triggerFamily;

    /* ---- Household diet ---- */
    const toggleDiet = () => {
        setDietOpen((o) => !o);
        if (!dietOpen) setDietScroll((n) => n + 1);
    };
    const saveFamilyDietary = async () => {
        if (!familyId) return;
        setDietSaving(true);
        const payload = {
            total_cu: parseFloat(diet.totalCu) || 0,
            calorie_intake_per_cu: parseInt(diet.calorie, 10) || 0,
            calorie_status: selectValue(DIET_STATUS, diet.status),
            dietary_advice_given: selectValue(DIET_ADVICE, diet.advice),
        };
        try {
            const res = await fetch(`/api/families/${familyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('Failed to update dietary assessment');
            showToast('Household dietary assessment saved!', 'success');
            toggleDiet();
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setDietSaving(false);
        }
    };

    /* ---- Live form handlers ---- */
    const isFemale = member?.gender === 'F';
    const onField = (id: string, value: string) => {
        let f = { ...form, [id]: value };
        if (id === 'fHb') {
            const hb = parseFloat(value || '0');
            if (hb > 0) f = hb < 12.0 ? { ...f, fAnaemia: 'Y', fPallor: 'Y' } : { ...f, fAnaemia: 'N' };
        } else if (id === 'fWorkType') {
            const table: Record<string, string> = isFemale ? { S: '0.8', M: '0.9', H: '1.2' } : { S: '1.0', M: '1.2', H: '1.6' };
            if (table[value]) f.fCu = table[value];
        } else if (id === 'fSbp' || id === 'fDbp' || id === 'fRbs') {
            f = checkAdultVitals(f);
        } else if (id === 'fWaist' || id === 'fHip') {
            const w = computeWhr(f, isFemale);
            if (w) (isFemale ? setFemaleAlert : setMaleAlert)(w);
        } else if (id === 'fMuac') {
            const r = checkMuac(f);
            f = r.f;
            if (r.status) setMuac(r.status);
        }
        setForm(f);
    };

    /* ---- Save ---- */
    const saveMemberSurvey = async (nextMember: boolean) => {
        if (!memberId || !member) {
            showToast('Please select a member first', 'error');
            return;
        }
        setSaving(nextMember ? 'next' : 'save');
        const payload = payloadFromForm(form);
        const savedId = memberId;
        try {
            const res = await fetch(`/api/members/${savedId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update member survey');
            showToast(`Survey saved for "${member.name}"!`, 'success');
            const fam = familyDataRef.current;
            const list = (fam?.members || []).map((m) => (m.id === savedId ? { ...m, ...(data.member || {}) } : m));
            if (fam) {
                const next = { ...fam, members: list };
                familyDataRef.current = next;
                setFamilyData(next);
            }
            setDoneIds((s) => new Set(s).add(savedId));
            if (nextMember) {
                const currIdx = list.findIndex((m) => m.id === savedId);
                if (currIdx >= 0 && currIdx < list.length - 1) {
                    const nextM = list[currIdx + 1];
                    selectMemberForSurvey(nextM.id, list);
                    showToast(`Loaded next member: "${nextM.name}"`, 'info');
                } else {
                    showToast('All family members surveyed!', 'success');
                }
            } else {
                selectMemberForSurvey(savedId, list);
            }
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSaving(null);
        }
    };

    /* ---- Derived member banner ---- */
    const ht = parseFloat(form.fHeight);
    const wt = parseFloat(form.fWeight);
    let bmi: ReactNode = 'Enter Ht & Wt';
    if (ht > 0 && wt > 0) {
        const v = (wt / (ht * ht)).toFixed(1);
        const n = Number(v);
        let cat = 'Normal';
        let color = 'var(--green)';
        if (n < 18.5) { cat = 'Underweight'; color = 'var(--amber)'; }
        else if (n >= 25 && n < 30) { cat = 'Overweight'; color = 'var(--amber)'; }
        else if (n >= 30) { cat = 'Obese'; color = 'var(--red)'; }
        bmi = <>BMI: <strong>{v}</strong> <span style={{ color, fontWeight: 700 }}>({cat})</span></>;
    }
    const avatar = member?.gender === 'F' ? { t: '👩', bg: '#fdf2f8', c: '#be185d' } : member?.gender === 'M' ? { t: '👨', bg: '#eff6ff', c: '#1d4ed8' } : { t: '👤', bg: 'var(--accent-subtle)', c: 'var(--accent)' };
    const age = Number(member?.age_years);
    const pills: ReactNode[] = [];
    if (member) {
        const m = member;
        if (m.sbp && m.dbp) pills.push(<span key="bp" className={`badge ${m.has_htn === 'Y' ? 'badge-danger' : 'badge-info'}`}>BP {m.sbp}/{m.dbp}</span>);
        if (m.rbs) pills.push(<span key="rbs" className={`badge ${m.has_dm === 'Y' ? 'badge-danger' : 'badge-info'}`}>RBS {m.rbs}</span>);
        if (m.hb) pills.push(<span key="hb" className={`badge ${m.has_anaemia === 'Y' ? 'badge-danger' : 'badge-success'}`}>Hb {m.hb}</span>);
        if (m.bmi) pills.push(<span key="bmi" className="badge badge-info">BMI {m.bmi}</span>);
        if (m.muac_cm) pills.push(<span key="muac" className="badge badge-warning">MUAC {m.muac_cm}</span>);
        if (m.anc_taken === 'Y') pills.push(<span key="anc" className="badge badge-success">ANC Reg</span>);
    }

    const familyOptionLabel = (f: FamilySummary) => `[${familyCode(f)}] #${f.family_no} — ${f.head_of_family} (${f.village_ward || 'Ward'}, ${f.member_count || 0} members)`;

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="entry" onToggle={standardSidebar.toggle}
                badge={loggedInStudent ? <StudentBadge roll={String(loggedInStudent.roll_number)} mode="profile" onLogout={logoutReload} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}

            <main className="main-content">
                <LocationVerificationCard />

                <div className="page-header anim-fade-up">
                    <div>
                        <h1 className="page-title page-title-animated">Clinical Field Survey Data Entry</h1>
                        <p className="page-subtitle">Standardized clinical digitization for registered households &amp; individuals (Roll 235 PSM Survey)</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href="/family-manage.html" className="btn btn-secondary">👥 Manage Families</a>
                    </div>
                </div>

                <div className="family-selector-board card anim-fade-up anim-delay-1">
                    <div className="selector-board-top">
                        <div className="custom-select-container" ref={containerRef}>
                            <label className="family-selector-label">
                                <span>🏠</span>
                                <span>Select Household Unit *</span>
                            </label>

                            <button type="button" id="customSelectTrigger" className={`custom-select-trigger${menuOpen ? ' open' : ''}`} onClick={toggleMenu}>
                                <div id="customTriggerContent" className="custom-trigger-content">
                                    {selectedF ? (
                                        <div className="trigger-active-card">
                                            <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', fontWeight: 700 }}>{familyCode(selectedF)}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', lineHeight: '1.25' }}>
                                                <span className="trigger-active-title">{selectedF.head_of_family}</span>
                                                <span className="trigger-active-sub">{`${selectedF.village_ward || 'Field Area'} • 👥 ${selectedF.member_count || 0} members`}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="trigger-placeholder">Loading surveyed families...</span>
                                    )}
                                </div>
                                <span className="custom-trigger-arrow" id="customTriggerArrow">▾</span>
                            </button>

                            <select
                                id="familySelect" className="family-select-input sr-only" value={familyId != null ? String(familyId) : ''}
                                onChange={(e) => { const id = parseInt(e.target.value, 10); if (id) selectFamily(id); }}
                            >
                                {loadState === 'loading' && <option value="" disabled>Loading surveyed families...</option>}
                                {loadState === 'empty' && <option value="">No households recorded yet</option>}
                                {loadState === 'list' && <option value="" disabled>-- Select a Household Unit --</option>}
                                {loadState === 'list' && families.map((f) => <option key={f.id} value={f.id}>{familyOptionLabel(f)}</option>)}
                            </select>

                            <div id="customSelectMenu" className="custom-select-menu" style={{ display: menuOpen ? 'block' : 'none' }}>
                                <div className="custom-select-search-wrap">
                                    <span className="search-icon">🔍</span>
                                    <input
                                        type="text" id="customSelectSearch" className="custom-select-search" ref={searchRef}
                                        placeholder="Search household code, head name, ward..." autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)}
                                    />
                                </div>
                                <div className="custom-select-header">
                                    <span>Surveyed Households</span>
                                    <span id="customSelectCount" className="badge badge-info">{listRendered ? shown.length : 0}</span>
                                </div>
                                <div id="customSelectList" className="custom-select-list">
                                    {listRendered && (shown.length === 0 ? (
                                        <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            No households registered under your cadet cadre yet.<br />
                                            <a href="/family-manage.html" className="btn btn-primary" style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 14px' }}>+ Register Household in Family Management</a>
                                        </div>
                                    ) : shown.map((f) => {
                                        const active = familyId === f.id;
                                        return (
                                            <div key={f.id} className={`custom-select-item ${active ? 'active' : ''}`} onClick={() => onCustomSelectFamily(f.id)} id={`customFamilyItem_${f.id}`}>
                                                <div className="custom-select-item-left">
                                                    <span className="badge badge-info" style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0.25rem 0.5rem', letterSpacing: '0.02em' }}>{familyCode(f)}</span>
                                                    <div className="custom-select-item-info">
                                                        <span className="custom-select-item-name">{f.head_of_family}</span>
                                                        <span className="custom-select-item-meta">{`${f.village_ward || 'Field Area'} • 👥 ${f.member_count || 0} members`}</span>
                                                    </div>
                                                </div>
                                                <div className="custom-select-item-right">{active ? <span className="custom-select-check">✓</span> : null}</div>
                                            </div>
                                        );
                                    }))}
                                </div>
                                <div className="custom-select-footer">
                                    <a href="/family-manage.html" className="custom-select-footer-link">
                                        <span>➕ Register / Manage Families</span>
                                        <span>→</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div id="householdSummaryQuick" className="household-summary-quick" style={{ display: familyData ? 'flex' : 'none' }}>
                            <div className="household-summary-info">
                                <span className="badge badge-info" id="quickFamilyCode">{familyData ? familyData.family_code || `FAM-${familyData.family_no}` : 'FAM-0001'}</span>
                                <span className="household-summary-item">HOF: <strong id="quickHofName">{familyData ? familyData.head_of_family : '-'}</strong></span>
                                <span className="household-summary-item">Location: <strong id="quickVillage">{familyData ? familyData.village_ward || '-' : '-'}</strong></span>
                            </div>
                            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }} onClick={toggleDiet}>🥗 Household Diet</button>
                        </div>
                    </div>

                    <div className="selector-board-strip-wrap">
                        <div className="strip-label-row">
                            <span className="strip-label">Quick Switch Household:</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any household below to select</span>
                        </div>
                        <div id="quickFamilyStrip" className="family-horizontal-strip">
                            {listRendered && (shown.length === 0 ? (
                                <div style={{ padding: '0.5rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                                    No households registered yet. <a href="/family-manage.html" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline' }}>+ Register Household</a>
                                </div>
                            ) : shown.map((f) => (
                                <div key={f.id} className={`family-strip-card ${familyId === f.id ? 'active' : ''}`} onClick={() => onCustomSelectFamily(f.id)} id={`quickFamilyCard_${f.id}`}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>{familyCode(f)}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>👥 {f.member_count || 0}</span>
                                    </div>
                                    <div className="family-strip-name" title={f.head_of_family}>{f.head_of_family}</div>
                                    <div className="family-strip-meta">{f.village_ward || 'Ward'}</div>
                                </div>
                            )))}
                        </div>
                    </div>
                </div>

                <div className="card" id="familyDietCard" style={{ display: dietOpen ? 'block' : 'none', border: '1.5px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                        <div className="section-title" style={{ marginBottom: '0' }}>
                            <span>🥗 Household Dietary Assessment (ICMR Units)</span>
                            <span className="badge badge-info">Family Level</span>
                        </div>
                        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={toggleDiet}>✕ Close</button>
                    </div>
                    <p className="card-desc">Enter total consumption units and daily caloric adequacy for the entire household (from 1st row of survey sheet):</p>
                    <form id="familyDietForm" onSubmit={(e) => { e.preventDefault(); saveFamilyDietary(); }}>
                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="fdTotalCu">Total Family CU (Consumption Units)</label>
                                <input type="number" step="0.1" id="fdTotalCu" placeholder="e.g. 4.5" value={diet.totalCu} onChange={(e) => setDiet({ ...diet, totalCu: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="fdCalorie">Daily Calorie Intake (kcal/CU/Day)</label>
                                <input type="number" id="fdCalorie" placeholder="e.g. 13459" value={diet.calorie} onChange={(e) => setDiet({ ...diet, calorie: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="fdCalorieStatus">Calorie Intake Status</label>
                                <Select id="fdCalorieStatus" options={DIET_STATUS} value={diet.status} onValue={(v) => setDiet({ ...diet, status: v })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="fdAdvice">Dietary Advice Provided?</label>
                                <Select id="fdAdvice" options={DIET_ADVICE} value={diet.advice} onValue={(v) => setDiet({ ...diet, advice: v })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary" id="saveDietBtn" disabled={dietSaving}>{dietSaving ? 'Saving...' : '💾 Save Household Diet'}</button>
                        </div>
                    </form>
                </div>

                <div id="emptyWorkspacePrompt" className="card anim-fade-up anim-delay-2" style={{ padding: '4rem 2rem', textAlign: 'center', display: familyData ? 'none' : undefined }}>
                    <div className="mp-empty-icon" style={{ marginBottom: '1rem' }}>📋</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Select a Household to Begin Clinical Entry</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                        Choose any surveyed family from the dropdown above to load its members and record structured screening data.
                    </p>
                    <a href="/family-manage.html" className="btn btn-primary">➕ Register New Families &amp; Members</a>
                </div>

                <div id="surveyWorkspace" style={{ display: familyData ? 'block' : 'none' }}>
                    <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Family Member to Enter Survey (<span id="rosterCount">{members.length}</span> Members)
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click a member card below to switch</span>
                    </div>
                    <div className="roster-carousel" id="rosterCarousel">
                        {familyData && members.length === 0 ? (
                            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No members in this family yet. <a href="/family-manage.html" style={{ color: 'var(--accent)', fontWeight: 600 }}>+ Add members on Family page</a>.
                            </div>
                        ) : members.map((m) => (
                            <div key={m.id} className={`roster-card${m.id === memberId ? ' active' : ''}`} id={`rosterCard_${m.id}`} onClick={() => selectMemberForSurvey(m.id, members)}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>#{String(m.member_order)}</span>
                                        {doneIds.has(m.id) || isSurveyDone(m)
                                            ? <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>✓ Done</span>
                                            : <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>○ Pending</span>}
                                    </div>
                                    <div className="roster-name" title={m.name}>{m.name}</div>
                                    <div className="roster-meta">{`${m.relation_to_hof || 'Member'} • ${m.age_years}y (${m.gender})`}</div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>Select →</div>
                            </div>
                        ))}
                    </div>

                    <div className="card" id="memberSurveyCard" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: familyData && members.length === 0 ? 'none' : 'block' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div id="memberGenderAvatar" style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: avatar.bg, color: avatar.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 800 }}>
                                    {avatar.t}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h2 id="entryMemberName" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0' }}>{member ? member.name : '-'}</h2>
                                        <span className="badge badge-info" id="entryMemberOrder">{member ? `#${member.member_order}` : '#1'}</span>
                                        {member
                                            ? <span className={isSurveyDone(member) ? 'badge badge-success' : 'badge badge-warning'} id="entryMemberStatusBadge">{isSurveyDone(member) ? '✓ Survey Recorded' : '○ Survey Pending'}</span>
                                            : <span className="badge" id="entryMemberStatusBadge">○ Pending</span>}
                                    </div>
                                    <div id="entryMemberSubtext" style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        {member
                                            ? `${member.relation_to_hof || 'Member'} • ${member.age_years} Years, ${member.age_months || 0} Months • Gender: ${member.gender === 'F' ? 'Female (F)' : member.gender === 'M' ? 'Male (M)' : 'Other'} • ${member.occupation || 'No occupation listed'}`
                                            : 'Head of Family • 60 Years (M)'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} id="quickVitalsPills">
                                {member && (pills.length > 0 ? pills : <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No vitals recorded</span>)}
                            </div>
                        </div>

                        <SurveyFormView
                            f={form} onField={onField}
                            sections={{
                                adult: member ? age >= 18 : true,
                                female: member?.gender === 'F',
                                male: member?.gender === 'M',
                                pediatric: !!member && age <= 5,
                            }}
                            bmi={bmi} whr={computeWhr(form, isFemale)} femaleAlert={femaleAlert} maleAlert={maleAlert} muac={muac}
                            actionTarget={member ? `${member.name} (${member.gender}, ${member.age_years}y)` : '-'}
                            saving={saving} onSave={saveMemberSurvey} onReset={() => { if (memberId) selectMemberForSurvey(memberId, members); }}
                        />
                    </div>
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
