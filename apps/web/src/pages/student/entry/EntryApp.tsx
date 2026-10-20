import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutReload, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_ENTRY, useToasts } from '../common/Toasts';
import { errMsg, getHouseholdDisplayName, runWhenActive } from '../common/utils';
import { LocationVerificationCard } from '../common/fieldLocation';
import {
    familyCode,
    isSurveyDone,
    type FamilyDetail,
    type FamilySummary,
    type Member,
    type ProfessionalYear,
    type FamilySurveyRecord,
    type MemberSurveyData,
} from './types';
import { SurveyFormView } from './SurveyForm';
import { ConsumptionUnitSection } from './ConsumptionUnitSection';
import { HealthyMacrosSection } from './HealthyMacrosSection';
import {
    loadFamilySurveyRecord,
    persistSurveyLocally,
    syncSurveyWithBackend,
    createEmptyMemberSurvey,
    getSurveyStorageKey,
} from './surveyStorage';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

type LoadState = 'loading' | 'empty' | 'list';

function checkYearStatus(
    familyId: number | null,
    year: ProfessionalYear,
    familyNotes?: string | null
): 'submitted' | 'draft' | 'none' {
    if (!familyId) return 'none';
    try {
        const key = getSurveyStorageKey(familyId, year);
        const cached = localStorage.getItem(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.status === 'submitted') return 'submitted';
            if (parsed?.updatedAt) return 'draft';
        }
        if (familyNotes && familyNotes.includes('medpulse_survey_records')) {
            const parsedNotes = JSON.parse(familyNotes);
            const rec = parsedNotes?.survey_records?.[year];
            if (rec?.status === 'submitted') return 'submitted';
            if (rec) return 'draft';
        }
    } catch {
        // ignore
    }
    return 'none';
}

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
    const [familyId, setFamilyId] = useState<number | null>(null);
    const [familyData, setFamilyData] = useState<FamilyDetail | null>(null);

    const [currentYear, setCurrentYear] = useState<ProfessionalYear>('Year 1');
    const [surveyRecord, setSurveyRecord] = useState<FamilySurveyRecord | null>(null);
    const [yearStarted, setYearStarted] = useState<Record<string, boolean>>({ 'Year 1': true });

    const [entryView, setEntryView] = useState<'member' | 'household'>('member');

    const [memberId, setMemberId] = useState<number | null>(null);
    const [saving, setSaving] = useState<'save' | 'next' | 'submit' | null>(null);

    const [stripScroll, setStripScroll] = useState<{ id: number; n: number } | null>(null);
    const [rosterScroll, setRosterScroll] = useState<{ id: number; n: number } | null>(null);

    const familiesRef = useRef<FamilySummary[]>([]);
    const familyDataRef = useRef<FamilyDetail | null>(null);

    const members = familyData?.members || [];
    const member = members.find((m) => m.id === memberId) || null;
    const currentMemberIndex = members.findIndex((m) => m.id === memberId);

    /* ---- Select Member ---- */
    const selectMemberForSurvey = useCallback((id: number, list: Member[]) => {
        const m = list.find((x) => x.id === id);
        if (!m) return;
        setMemberId(id);
        setRosterScroll((s) => ({ id, n: (s?.n || 0) + 1 }));
    }, []);

    /* ---- Select Family & Load Survey Record ---- */
    const selectFamily = useCallback(async (id: number, preselectMemberId: number | null = null, year: ProfessionalYear = currentYear) => {
        setFamilyId(id);
        setStripScroll((s) => ({ id, n: (s?.n || 0) + 1 }));
        try {
            const res = await fetch(`/api/families/${id}`);
            const data = (await res.json()) as FamilyDetail;
            familyDataRef.current = data;
            setFamilyData(data);

            // Load multi-year survey record
            const loaded = loadFamilySurveyRecord(id, year, data);
            setSurveyRecord(loaded);

            const list = data.members || [];
            if (list.length > 0) {
                let targetId = preselectMemberId;
                if (!targetId || !list.some((m) => m.id === targetId)) targetId = list[0].id;
                selectMemberForSurvey(targetId, list);
            } else {
                setMemberId(null);
            }
        } catch (err) {
            console.error('Error selecting family:', err);
            showToast('Error loading family record', 'error');
        }
    }, [currentYear, selectMemberForSurvey, showToast]);

    useEffect(() => {
        return runWhenActive(async () => {
            try {
                const res = await fetch('/api/families');
                const list = (await res.json()) as FamilySummary[];
                if (!list || list.length === 0) {
                    setLoadState('empty');
                } else {
                    if (!Array.isArray(list)) throw new TypeError('allFamilies.map is not a function');
                    familiesRef.current = list;
                    setFamilies(list);
                    setLoadState('list');
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

    /* ---- Scroll Effects ---- */
    useEffect(() => {
        if (stripScroll) document.getElementById(`quickFamilyCard_${stripScroll.id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }, [stripScroll]);
    useEffect(() => {
        if (rosterScroll) document.getElementById(`rosterCard_${rosterScroll.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [rosterScroll]);

    /* ---- Professional Year Switching ---- */
    const handleSelectYear = (year: ProfessionalYear) => {
        if (year === currentYear) return;
        if (surveyRecord) {
            persistSurveyLocally(surveyRecord);
        }
        setCurrentYear(year);
        if (familyId) {
            const loaded = loadFamilySurveyRecord(familyId, year, familyDataRef.current);
            setSurveyRecord(loaded);
            showToast(`Switched to ${year} record`, 'info');
        }
    };

    /* ---- Update Survey Data for Selected Member ---- */
    const handleChangeSurveyData = (updater: (prev: MemberSurveyData) => MemberSurveyData) => {
        if (!memberId) return;
        setSurveyRecord((prev) => {
            if (!prev) return prev;
            const currentMs = prev.memberSurveys[memberId] || createEmptyMemberSurvey(member);
            const nextMs = updater(currentMs);
            const nextRecord: FamilySurveyRecord = {
                ...prev,
                memberSurveys: {
                    ...prev.memberSurveys,
                    [memberId]: nextMs,
                },
                updatedAt: new Date().toISOString(),
            };
            persistSurveyLocally(nextRecord);
            return nextRecord;
        });
    };

    /* ---- Save Draft ---- */
    const handleSaveDraft = async () => {
        if (!surveyRecord || !familyId) return;
        setSaving('save');
        try {
            await syncSurveyWithBackend(surveyRecord, 'draft');
            setSurveyRecord((prev) => prev ? { ...prev, status: 'draft', updatedAt: new Date().toISOString() } : null);
            showToast(`Survey draft saved for ${currentYear}!`, 'success');
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSaving(null);
        }
    };

    /* ---- Submit Record ---- */
    const handleSubmitRecord = async () => {
        if (!surveyRecord || !familyId) return;
        setSaving('submit');
        try {
            await syncSurveyWithBackend(surveyRecord, 'submitted');
            setSurveyRecord((prev) => prev ? { ...prev, status: 'submitted', updatedAt: new Date().toISOString() } : null);
            showToast(`Survey for ${currentYear} submitted successfully!`, 'success');
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSaving(null);
        }
    };

    /* ---- Save and Move to Next Member ---- */
    const handleNextMember = async () => {
        if (!surveyRecord || !familyId || !memberId) return;
        setSaving('next');
        try {
            await syncSurveyWithBackend(surveyRecord, 'draft');
            const currIdx = members.findIndex((m) => m.id === memberId);
            if (currIdx >= 0 && currIdx < members.length - 1) {
                const nextM = members[currIdx + 1];
                setMemberId(nextM.id);
                setRosterScroll((s) => ({ id: nextM.id, n: (s?.n || 0) + 1 }));
                showToast(`Draft saved. Active: "${nextM.name}"`, 'info');
            }
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSaving(null);
        }
    };

    /* ---- Derived Quick Vitals Badges for Selected Member ---- */
    const currentMemberSurvey = memberId && surveyRecord?.memberSurveys ? surveyRecord.memberSurveys[memberId] : null;
    const avatar = member?.gender === 'F'
        ? { t: '👩', bg: '#fdf2f8', c: '#be185d' }
        : member?.gender === 'M'
            ? { t: '👨', bg: '#eff6ff', c: '#1d4ed8' }
            : { t: '👤', bg: 'var(--accent-subtle)', c: 'var(--accent)' };

    const pills: ReactNode[] = [];
    if (currentMemberSurvey) {
        const ms = currentMemberSurvey;
        if (ms.sbp && ms.dbp) {
            pills.push(<span key="bp" className={`badge ${ms.has_htn === 'Y' ? 'badge-danger' : 'badge-info'}`}>BP {ms.sbp}/{ms.dbp}</span>);
        }
        if (ms.rbs) {
            pills.push(<span key="rbs" className={`badge ${ms.has_dm === 'Y' ? 'badge-danger' : 'badge-info'}`}>RBS {ms.rbs}</span>);
        }
        if (ms.hb) {
            pills.push(<span key="hb" className={`badge ${ms.has_anaemia === 'Y' ? 'badge-danger' : 'badge-success'}`}>Hb {ms.hb}</span>);
        }
        if (ms.bmi) {
            pills.push(<span key="bmi" className="badge badge-info">BMI {ms.bmi}</span>);
        }
        if (ms.muac_cm) {
            pills.push(<span key="muac" className="badge badge-warning">MUAC {ms.muac_cm}</span>);
        }
        if (ms.whr) {
            pills.push(<span key="whr" className="badge badge-info">WHR {ms.whr}</span>);
        }
        if (ms.anc_taken === 'Y') {
            pills.push(<span key="anc" className="badge badge-success">ANC Reg</span>);
        }
        if (ms.mamta_card_present === 'Present') {
            pills.push(<span key="mamta" className="badge badge-success">Mamta Card</span>);
        }
    }

    const yearStatus = checkYearStatus(familyId, currentYear, familyData?.notes);
    const isYearActive = yearStarted[currentYear] || yearStatus !== 'none';

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="entry"
                onToggle={standardSidebar.toggle}
                badge={loggedInStudent ? <StudentBadge roll={String(loggedInStudent.roll_number)} mode="profile" onLogout={logoutReload} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}

            <main className="main-content">
                <LocationVerificationCard />

                {/* Page Title & Navigation Header */}
                <div className="page-header anim-fade-up">
                    <div>
                        <h1 className="page-title">Community Health Survey</h1>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Digital paper-survey data entry with multi-year tracking, auto-calculations, and healthy macros.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <a href="/family-manage.html" className="btn btn-secondary">👥 Families</a>
                        <a href="/member-manage.html" className="btn btn-secondary">👤 Members</a>
                    </div>
                </div>

                {/* Household Selector Strip */}
                <div className="card anim-fade-up anim-delay-1" id="householdSelectorCard" style={{ marginBottom: '1.25rem', padding: '1.1rem 1.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>🏠</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Household (<span id="householdCount">{families.length}</span>)
                            </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click a household card below to switch</span>
                    </div>

                    <div id="quickFamilyStrip" className="family-horizontal-strip">
                        {loadState === 'loading' ? (
                            <div style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading households…</div>
                        ) : families.length === 0 ? (
                            <div style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No households registered yet. <a href="/family-manage.html" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline' }}>+ Register Household</a>
                            </div>
                        ) : families.map((f) => {
                            const householdName = getHouseholdDisplayName(f);
                            return (
                                <div
                                    key={f.id}
                                    className={`family-strip-card ${familyId === f.id ? 'active' : ''}`}
                                    onClick={() => selectFamily(f.id)}
                                    id={`quickFamilyCard_${f.id}`}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', fontWeight: 700 }}>{familyCode(f)}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>👥 {f.member_count || 0}</span>
                                    </div>
                                    <div className="family-strip-name" title={householdName} style={{ marginBottom: 0 }}>{householdName}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Empty State: No Family Selected */}
                <div id="emptyWorkspacePrompt" className="card anim-fade-up anim-delay-2" style={{ padding: '4rem 2rem', textAlign: 'center', display: familyData ? 'none' : undefined }}>
                    <div className="mp-empty-icon" style={{ marginBottom: '1rem' }}>📋</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        {loadState === 'empty' ? 'Add a household first' : 'Choose a household'}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                        {loadState === 'empty' ? 'Survey entries belong to a household. Add one in Families, then come back here.' : 'Pick a household above to see its members and record screening data.'}
                    </p>
                    {loadState === 'empty' && <a href="/family-manage.html" className="btn btn-primary">➕ Add household</a>}
                </div>

                {/* Main Survey Workspace */}
                {familyData && (
                    <div id="surveyWorkspace" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Professional Year Selector & Record Navigation Bar */}
                        <div
                            className="card anim-fade-up"
                            style={{
                                padding: '1rem 1.25rem',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                background: '#fafbff',
                            }}
                        >
                            {/* Professional Year Selector (Year 1 | Year 2 | Year 3) */}
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                                    Professional Survey Year
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {(['Year 1', 'Year 2', 'Year 3'] as const).map((year) => {
                                        const status = checkYearStatus(familyId, year, familyData?.notes);
                                        const isActive = currentYear === year;
                                        return (
                                            <button
                                                key={year}
                                                type="button"
                                                onClick={() => handleSelectYear(year)}
                                                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{
                                                    fontSize: '0.825rem',
                                                    padding: '0.4rem 0.85rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.45rem',
                                                    border: isActive ? 'none' : '1px solid var(--border)',
                                                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                                                }}
                                            >
                                                <span>{year}</span>
                                                {status === 'submitted' && (
                                                    <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>✓ Submitted</span>
                                                )}
                                                {status === 'draft' && (
                                                    <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>✎ Draft</span>
                                                )}
                                                {status === 'none' && !isActive && (
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>(New)</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* View Switcher: Member Clinical Survey vs Household Nutrition & CU */}
                            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setEntryView('member')}
                                    className={`btn ${entryView === 'member' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{
                                        fontSize: '0.825rem',
                                        padding: '0.35rem 0.85rem',
                                        border: 'none',
                                        boxShadow: entryView === 'member' ? 'var(--shadow-sm)' : 'none',
                                    }}
                                >
                                    👤 Member Survey ({members.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEntryView('household')}
                                    className={`btn ${entryView === 'household' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{
                                        fontSize: '0.825rem',
                                        padding: '0.35rem 0.85rem',
                                        border: 'none',
                                        boxShadow: entryView === 'household' ? 'var(--shadow-sm)' : 'none',
                                    }}
                                >
                                    🥗 Household Nutrition & CU
                                </button>
                            </div>
                        </div>

                        {/* If selected year has not been started yet, show clean empty state (Master Prompt Section 62) */}
                        {!isYearActive ? (
                            <div
                                className="card anim-fade-up"
                                style={{
                                    padding: '3.5rem 2rem',
                                    textAlign: 'center',
                                    border: '1.5px dashed var(--border)',
                                    borderRadius: '12px',
                                }}
                            >
                                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                                    No {currentYear} Record Exists Yet
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                                    Start a new survey record for {currentYear}. Prior professional years ({currentYear === 'Year 2' ? 'Year 1' : 'Year 1 & 2'}) will remain safe, untouched, and fully editable.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setYearStarted((prev) => ({ ...prev, [currentYear]: true }));
                                        if (surveyRecord) persistSurveyLocally(surveyRecord);
                                        showToast(`Started new ${currentYear} survey record`, 'success');
                                    }}
                                    style={{ fontSize: '0.9rem', padding: '0.55rem 1.4rem' }}
                                >
                                    + Start {currentYear} Record
                                </button>
                            </div>
                        ) : entryView === 'member' ? (
                            /* ---- View Mode: Member Clinical Survey ---- */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Member Roster Carousel */}
                                <div>
                                    <div style={{ marginBottom: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Select Family Member (<span id="rosterCount">{members.length}</span> Members)
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click a member card below to switch</span>
                                    </div>
                                    <div className="roster-carousel" id="rosterCarousel">
                                        {members.length === 0 ? (
                                            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                No members in this family yet. <a href="/family-manage.html" style={{ color: 'var(--accent)', fontWeight: 600 }}>+ Add members on Family page</a>.
                                            </div>
                                        ) : members.map((m) => {
                                            const mSurvey = surveyRecord?.memberSurveys[m.id];
                                            const hasData = mSurvey?.sbp || mSurvey?.hb || isSurveyDone(m);
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`roster-card${m.id === memberId ? ' active' : ''}`}
                                                    id={`rosterCard_${m.id}`}
                                                    onClick={() => selectMemberForSurvey(m.id, members)}
                                                >
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>#{String(m.member_order)}</span>
                                                            {hasData ? (
                                                                <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>✓ Done</span>
                                                            ) : (
                                                                <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>○ Pending</span>
                                                            )}
                                                        </div>
                                                        <div className="roster-name" title={m.name}>{m.name}</div>
                                                        <div className="roster-meta">{`${m.relation_to_hof || 'Member'} • ${m.age_years}y (${m.gender})`}</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>Select →</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Member Card & Categorized Survey Forms */}
                                <div
                                    className="card"
                                    id="memberSurveyCard"
                                    style={{
                                        border: '1px solid var(--border)',
                                        boxShadow: 'var(--shadow-sm)',
                                        display: members.length === 0 ? 'none' : 'block',
                                    }}
                                >
                                    {/* Member Header & Vitals Bar */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '0.75rem',
                                            paddingBottom: '1.25rem',
                                            borderBottom: '1px solid var(--border)',
                                            marginBottom: '1.5rem',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div
                                                id="memberGenderAvatar"
                                                style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: avatar.bg,
                                                    color: avatar.c,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.35rem',
                                                    fontWeight: 800,
                                                }}
                                            >
                                                {avatar.t}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <h2 id="entryMemberName" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0' }}>
                                                        {member ? member.name : '-'}
                                                    </h2>
                                                    <span className="badge badge-info" id="entryMemberOrder">
                                                        {member ? `#${member.member_order}` : '#1'}
                                                    </span>
                                                    {member && (
                                                        <span
                                                            className={surveyRecord?.status === 'submitted' ? 'badge badge-success' : 'badge badge-warning'}
                                                            id="entryMemberStatusBadge"
                                                        >
                                                            {surveyRecord?.status === 'submitted' ? '✓ Record Submitted' : '✎ Draft Entry'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div id="entryMemberSubtext" style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                    {member
                                                        ? `${member.relation_to_hof || 'Member'} • ${member.age_years} Years, ${member.age_months || 0} Months • Gender: ${member.gender === 'F' ? 'Female (F)' : member.gender === 'M' ? 'Male (M)' : 'TG'} • ${member.occupation || 'No occupation listed'}`
                                                        : '-'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Vitals Pills */}
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} id="quickVitalsPills">
                                            {member && (pills.length > 0 ? pills : <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No vitals recorded yet</span>)}
                                        </div>
                                    </div>

                                    {/* Categorized Clinical Sections View */}
                                    {surveyRecord && (
                                        <SurveyFormView
                                            member={member}
                                            surveyData={currentMemberSurvey}
                                            onChangeSurveyData={handleChangeSurveyData}
                                            currentYear={currentYear}
                                            status={surveyRecord.status}
                                            saving={saving}
                                            onSaveDraft={handleSaveDraft}
                                            onSubmitRecord={handleSubmitRecord}
                                            onNextMember={handleNextMember}
                                            hasNextMember={currentMemberIndex >= 0 && currentMemberIndex < members.length - 1}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* ---- View Mode: Household Nutrition & CU ---- */
                            surveyRecord && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {/* ICMR Consumption Unit Calculation Table across Family Members */}
                                    <ConsumptionUnitSection
                                        members={members}
                                        surveyRecord={surveyRecord}
                                        onChangeSurveyRecord={(updater) => {
                                            setSurveyRecord((prev) => {
                                                if (!prev) return prev;
                                                const next = updater(prev);
                                                persistSurveyLocally(next);
                                                return next;
                                            });
                                        }}
                                    />

                                    {/* Healthy Macros / Food Intake Table */}
                                    <HealthyMacrosSection
                                        surveyRecord={surveyRecord}
                                        onChangeSurveyRecord={(updater) => {
                                            setSurveyRecord((prev) => {
                                                if (!prev) return prev;
                                                const next = updater(prev);
                                                persistSurveyLocally(next);
                                                return next;
                                            });
                                        }}
                                    />

                                    {/* Sticky Action Footer for Household View */}
                                    <div
                                        style={{
                                            position: 'sticky',
                                            bottom: '1rem',
                                            zIndex: 10,
                                            padding: '0.85rem 1.25rem',
                                            background: 'rgba(255, 255, 255, 0.95)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1.5px solid var(--border)',
                                            borderRadius: '12px',
                                            boxShadow: 'var(--shadow-md)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '0.75rem',
                                        }}
                                    >
                                        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                                            Household Level: <strong>{getHouseholdDisplayName(familyData)}</strong> ({currentYear})
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={handleSaveDraft}
                                                disabled={saving !== null}
                                                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                                            >
                                                {saving === 'save' ? 'Saving Draft…' : '💾 Save Household Draft'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={handleSubmitRecord}
                                                disabled={saving !== null}
                                                style={{ fontSize: '0.85rem', padding: '0.45rem 1.25rem' }}
                                            >
                                                {saving === 'submit' ? 'Submitting…' : '✓ Submit Survey Record'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
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
