/**
 * Hospital FAP control centre, ported from frontend/hospital/hospital-ui.js + hospital.html.
 * Views (#overview, #patients, #registered, #network) are hash routes; the three <dialog>s are the
 * patient dossier, the visit registration form and the visit slip.
 */
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
    api, errorMessage, type FapDossier, type FapList, type FapOptions, type FapPatient, type FapSummary,
    labels, type Profile, shown, type Visit, type VisitList, type VisitSummary,
} from './api';
import { Icon, IconSpan, type IconName } from './icons';
import { PatientDossier } from './PatientDossier';
import { PatientTable } from './PatientTable';
import { RegisteredTable } from './RegisteredTable';
import { type FapRef, type RegForm, RegistrationDialog, resetForm } from './RegistrationDialog';
import { VisitSlip } from './VisitSlip';

type View = 'overview' | 'patients' | 'registered' | 'network';
const viewFromHash = (): View => {
    const key = location.hash.slice(1);
    return (['patients', 'network', 'registered'] as string[]).includes(key) ? key as View : 'overview';
};
const titles: Record<View, string> = { overview: 'FAP control centre', patients: 'FAP patient registry', registered: 'Registered hospital patients', network: 'Colleges & students' };
const crumbs: Record<View, string> = { overview: 'Control centre', patients: 'Patient registry', registered: 'Registered patients', network: 'Care network' };

interface Filters { search: string; university: string; student: string; condition: string }
interface RegFilters { search: string; department: string; status: string }
type Tag = { key: 'search' | 'university' | 'student' | 'condition'; text: string; aria: string };
type TableState<T> = { kind: 'message'; text: string } | { kind: 'table'; rows: T[] };
type Loadable<T> = { kind: 'loading' } | { kind: 'failed' } | { kind: 'data'; value: T };
type DossierBody = { kind: 'loading' } | { kind: 'error'; message: string; id: number } | { kind: 'data'; d: FapDossier };
type SlipBody = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; v: Visit; hospitalName: string; printedAt: string };

const EMPTY_FILTERS: Filters = { search: '', university: '', student: '', condition: '' };
const EMPTY_REG_FILTERS: RegFilters = { search: '', department: '', status: '' };
const QUICK_CHIPS: [string, string, string][] = [['HTN', 'htn', 'Hypertension'], ['DM', 'dm', 'Diabetes'], ['Anaemia', 'anaemia', 'Anaemia'], ['Pediatric', 'ped', 'Children 0–5'], ['NoFollowUp', 'warn', 'Needs Follow-up']];
const isPage = (pages: string, view: View) => pages.split(' ').includes(view);

/** Keeps a value in a ref (for async code reading the current value) and in state (for rendering). */
function useRefState<T>(initial: T): [T, { current: T }, (v: T) => void] {
    const [value, setValue] = useState(initial);
    const ref = useRef(initial);
    const set = (v: T) => { ref.current = v; setValue(v); };
    return [value, ref, set];
}

const studentsFor = (options: FapOptions, college: string) => options.students.filter((s) => !college || String(s.college_id) === college);

export function HospitalApp() {
    // ---- shell ----
    const [view, setView] = useState<View>(viewFromHash);
    const [navOpen, setNavOpen] = useState(false);
    const [profile, setProfile] = useState({ hospitalName: 'Hospital workspace', accountName: 'Hospital team', accountRole: 'Hospital access', avatar: 'H' });
    const hospitalNameRef = useRef('Hospital workspace');
    const [loadError, setLoadError] = useState<{ hidden: boolean; text: string }>({ hidden: true, text: '' });
    const [refreshing, setRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState('Connecting to FAP records…');

    // ---- overview / registry ----
    const st = useRef({ offset: 0, limit: 25, total: 0, options: { students: [], universities: [] } as FapOptions, searchSequence: 0, detailSequence: 0 });
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [options, setOptions] = useState<FapOptions>({ students: [], universities: [] });
    const [metrics, setMetrics] = useState<Loadable<FapSummary['totals']>>({ kind: 'loading' });
    const [conditionList, setConditionList] = useState<Loadable<FapSummary['conditions']>>({ kind: 'loading' });
    const [universityList, setUniversityList] = useState<Loadable<FapSummary['universities']>>({ kind: 'loading' });
    const [network, setNetwork] = useState<FapOptions | null>(null);
    const [filters, filtersRef, setFiltersRaw] = useRefState<Filters>(EMPTY_FILTERS);
    const [tags, setTags] = useState<Tag[]>([]);
    const [patientTable, setPatientTable] = useState<TableState<FapPatient>>({ kind: 'message', text: 'Loading FAP records…' });
    const [patientCount, setPatientCount] = useState('…');
    const [pageInfo, setPageInfo] = useState('Loading records');
    const [pager, setPager] = useState({ prev: true, next: true });

    // ---- registered visits ----
    const reg = useRef({ offset: 0, limit: 25, total: 0, searchSequence: 0 });
    const regTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [regFilters, regFiltersRef, setRegFilters] = useRefState<RegFilters>(EMPTY_REG_FILTERS);
    const [registeredTable, setRegisteredTable] = useState<TableState<Visit>>({ kind: 'message', text: 'Loading registered patients…' });
    const [kpis, setKpis] = useState({ total: '0', today: '0', admitted: '0', opd: '0' });
    const [registeredCount, setRegisteredCount] = useState('0');
    const [regPageInfo, setRegPageInfo] = useState('0 registered patients');
    const [regPager, setRegPager] = useState({ prev: true, next: true });

    // ---- dialogs ----
    const modalRef = useRef<HTMLDialogElement>(null);
    const regModalRef = useRef<HTMLDialogElement>(null);
    const slipModalRef = useRef<HTMLDialogElement>(null);
    const [modalTitle, setModalTitle] = useState('Patient details');
    const [dossier, setDossier] = useState<DossierBody | null>(null);
    const [regTitle, setRegTitle] = useState('Register Patient Visit');
    const [form, setForm] = useState<RegForm>(() => resetForm({ familyMemberId: '', patientId: '' }));
    const [fapRef, setFapRef] = useState<FapRef>({ hidden: true, text: 'Family Code: FAM-235-05 · Surveyor: Dhruv Patel (Roll 235)', data: {} });
    const [submitting, setSubmitting] = useState(false);
    const [slipTitle, setSlipTitle] = useState('Patient Visit Slip');
    const [slip, setSlip] = useState<SlipBody | null>(null);

    // ---------------------------------------------------------------- helpers
    const closeNav = () => setNavOpen(false);
    const error = (message: string) => setLoadError({ hidden: false, text: message });

    /** Setting the college re-filters the student list; a student outside it falls back to "All students". */
    const setFilters = (next: Filters) => {
        const opts = st.current.options;
        if (next.student && !studentsFor(opts, next.university).some((s) => String(s.id) === next.student)) next = { ...next, student: '' };
        setFiltersRaw(next);
    };

    function syncFilterUI() {
        const f = filtersRef.current;
        const opts = st.current.options;
        const out: Tag[] = [];
        const searchVal = f.search.trim();
        if (searchVal) out.push({ key: 'search', text: `Search: “${searchVal}”`, aria: 'Clear search term' });
        if (f.university) {
            const c = opts.universities.find((u) => String(u.id) === f.university);
            out.push({ key: 'university', text: `College: ${c ? c.name : 'College'}`, aria: 'Remove college filter' });
        }
        if (f.student) {
            const s = opts.students.find((x) => String(x.id) === f.student);
            out.push({ key: 'student', text: `Student: ${s ? `${s.name} · Roll ${s.roll_number}` : 'Student'}`, aria: 'Remove student filter' });
        }
        if (f.condition) out.push({ key: 'condition', text: `Indicator: ${labels[f.condition] || f.condition}`, aria: 'Remove indicator filter' });
        setTags(out);
    }

    function params() {
        const f = filtersRef.current;
        return new URLSearchParams({
            search: f.search.trim(), student_id: f.student, university_id: f.university, condition: f.condition,
            limit: String(st.current.limit), offset: String(st.current.offset),
        });
    }

    async function search() {
        const s = st.current;
        const seq = ++s.searchSequence;
        setPatientTable({ kind: 'message', text: 'Searching student-entered records…' });
        setPager({ prev: true, next: true });
        setPageInfo('Searching…');
        syncFilterUI();
        try {
            const data = await api<FapList>('fap/patients?' + params());
            if (seq !== s.searchSequence) return;
            s.total = data.total;
            setPatientTable({ kind: 'table', rows: data.patients });
            setPatientCount(`${data.total} matching records`);
            setPageInfo(data.total ? `${data.offset + 1}–${data.offset + data.patients.length} of ${data.total} patients` : '0 matching patients');
            setPager({ prev: s.offset === 0, next: s.offset + s.limit >= data.total });
            setUpdatedAt('Records loaded at ' + new Date().toLocaleTimeString());
        } catch (e) {
            if (seq !== s.searchSequence) return;
            setPatientTable({ kind: 'message', text: 'Records could not be loaded. Use Retry above.' });
            setPageInfo('Unable to load records');
            error(errorMessage(e));
        }
    }

    function resetSearch() { clearTimeout(timer.current); st.current.offset = 0; search(); }

    async function loadSummary() {
        const [summary, opts] = await Promise.all([api<FapSummary>('fap/summary'), api<FapOptions>('fap/options')]);
        st.current.options = opts;
        setOptions(opts);
        const f = filtersRef.current;
        const university = opts.universities.some((c) => String(c.id) === f.university) ? f.university : '';
        setFilters({ ...f, university });
        setMetrics({ kind: 'data', value: summary.totals });
        setConditionList({ kind: 'data', value: summary.conditions });
        setUniversityList({ kind: 'data', value: summary.universities });
        setNetwork(opts);
    }

    async function loadRegisteredPatients() {
        const r = reg.current;
        const seq = ++r.searchSequence;
        setRegisteredTable({ kind: 'message', text: 'Loading registered patients…' });
        setRegPager({ prev: true, next: true });
        setRegPageInfo('Loading…');
        const f = regFiltersRef.current;
        const regParams = new URLSearchParams({ search: f.search.trim(), department: f.department, disposition: f.status, limit: String(r.limit), offset: String(r.offset) });
        try {
            const [visitsData, summary] = await Promise.all([api<VisitList>('visits?' + regParams.toString()), api<VisitSummary>('visits/summary')]);
            if (seq !== r.searchSequence) return;
            r.total = visitsData.total;
            setKpis({
                total: Number(summary.total_registered || 0).toLocaleString(),
                today: Number(summary.today_visits || 0).toLocaleString(),
                admitted: Number(summary.admitted_patients || 0).toLocaleString(),
                opd: Number(summary.opd_discharged || 0).toLocaleString(),
            });
            setRegisteredCount(`${visitsData.total} visits`);
            setRegisteredTable({ kind: 'table', rows: visitsData.visits });
            setRegPageInfo(visitsData.total
                ? `${visitsData.offset + 1}–${visitsData.offset + visitsData.visits.length} of ${visitsData.total} registered patients`
                : '0 registered patients');
            setRegPager({ prev: r.offset === 0, next: r.offset + r.limit >= visitsData.total });
        } catch (err) {
            if (seq !== r.searchSequence) return;
            setRegisteredTable({ kind: 'message', text: `Could not load registered patients: ${errorMessage(err)}` });
            setRegPageInfo('Error loading records');
        }
    }

    function resetRegSearch() { clearTimeout(regTimer.current); reg.current.offset = 0; loadRegisteredPatients(); }

    function navigate() {
        const v = viewFromHash();
        setView(v);
        closeNav();
        if (v === 'registered') loadRegisteredPatients();
    }

    async function refresh() {
        clearTimeout(timer.current);
        st.current.searchSequence++;
        setLoadError((e) => ({ ...e, hidden: true }));
        setRefreshing(true);
        try {
            await loadSummary();
            st.current.offset = 0;
            await search();
            if (location.hash === '#registered') {
                reg.current.offset = 0;
                await loadRegisteredPatients();
            }
        } catch (e) {
            error(errorMessage(e));
            setMetrics({ kind: 'failed' });
            setPatientTable({ kind: 'message', text: 'Records unavailable. Please retry.' });
            setConditionList({ kind: 'failed' });
            setUniversityList({ kind: 'failed' });
            setUpdatedAt('Connection failed');
        } finally {
            setRefreshing(false);
        }
    }

    async function start() {
        try {
            const p = await api<Profile>('profile');
            const a = p.admin;
            hospitalNameRef.current = a.hospital_name;
            setProfile({ hospitalName: a.hospital_name, accountName: a.name, accountRole: a.role, avatar: a.name.slice(0, 1) });
            await refresh();
        } catch (e) {
            error(errorMessage(e));
            setUpdatedAt('Hospital sign-in required');
        }
    }

    // ---------------------------------------------------------------- dossier
    async function openPatient(id: number) {
        const seq = ++st.current.detailSequence;
        flushSync(() => { setModalTitle(`FAP-${id}`); setDossier({ kind: 'loading' }); });
        modalRef.current?.showModal();
        try {
            const d = await api<FapDossier>('fap/patients/' + id);
            if (seq !== st.current.detailSequence) return;
            setModalTitle(String(d.member.name));
            setDossier({ kind: 'data', d });
        } catch (e) {
            if (seq === st.current.detailSequence) setDossier({ kind: 'error', message: errorMessage(e), id });
        }
    }

    // ---------------------------------------------------------------- registration
    async function openRegistrationModal(memberId?: number) {
        let next = resetForm(form);
        next = { ...next, visitDate: new Date().toISOString().slice(0, 10), familyMemberId: '', patientId: '' };
        let ref: FapRef = { hidden: true, text: fapRef.text, data: {} };
        setForm(next);
        setFapRef(ref);

        if (memberId) {
            try {
                const d = await api<FapDossier>('fap/patients/' + memberId);
                const m = d.member;
                const v = d.vitals || {};
                const f = d.family || {};
                const conds: string[] = [];
                if (m.has_htn === 'Y') conds.push('Hypertension');
                if (m.has_dm === 'Y') conds.push('Diabetes');
                if (m.has_anaemia === 'Y') conds.push('Anaemia');
                if (d.conditions && d.conditions.length) {
                    d.conditions.forEach((c) => { if (!conds.includes(c.condition_name as string)) conds.push(c.condition_name as string); });
                }
                next = {
                    ...next,
                    familyMemberId: String(m.id),
                    patientName: String(m.name || ''),
                    contactNumber: String(v.contact_number || m.contact_number || f.contact_number || ''),
                    ageYears: numberInput(m.age_years || ''),
                    gender: ['M', 'F', 'Other'].includes(String(m.gender)) ? String(m.gender) : 'Other',
                    address: String(f.address || f.village_ward || f.village || ''),
                    existingConditions: conds.join(', '),
                    allergies: d.allergies && d.allergies.length ? d.allergies.map((a) => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ') : '',
                    diagnosis: String(v.diagnosis || ''),
                    sbp: numberInput(v.sbp || ''),
                    dbp: numberInput(v.dbp || ''),
                    rbs: numberInput(v.rbs || ''),
                    department: 'Community Medicine / FAP Referral',
                    visitType: 'FAP Survey Referral',
                };
                const famCode = String(f.family_code || `FAM-${f.id}`);
                const village = String(f.village_ward || f.village || '');
                const studName = m.student_name || '';
                const studRoll = m.student_roll || '';
                ref = {
                    hidden: false,
                    text: `Family Code: ${famCode} · Village: ${village} · Surveyor: ${studName} (Roll ${studRoll})`,
                    data: { familyCode: famCode, village, studentName: studName, studentRoll: studRoll },
                };
                setRegTitle(`Register Visit · ${m.name} (FAP-${m.id})`);
            } catch (e) {
                alert('Could not fetch FAP member details: ' + errorMessage(e));
            }
        } else {
            next = { ...next, department: 'General Medicine', visitType: 'Routine OPD' };
            setRegTitle('Register Patient Visit');
        }
        flushSync(() => { setForm(next); setFapRef(ref); });
        regModalRef.current?.showModal();
    }

    async function openVisitSlip(visitId: number) {
        flushSync(() => { setSlipTitle('Loading slip…'); setSlip({ kind: 'loading' }); });
        slipModalRef.current?.showModal();
        try {
            const v = await api<Visit>('visits/' + visitId);
            setSlipTitle(`Visit Slip · ${v.visit_uid}`);
            setSlip({ kind: 'data', v, hospitalName: hospitalNameRef.current || 'District / General Hospital', printedAt: new Date().toLocaleString() });
        } catch (err) {
            setSlip({ kind: 'error', message: errorMessage(err) });
        }
    }

    async function submitRegistration(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const num = (s: string) => (s ? Number(s) : null);
            const payload = {
                family_member_id: form.familyMemberId || null,
                patient_id: form.patientId || null,
                patient_name: form.patientName.trim(),
                contact_number: form.contactNumber.trim(),
                age_years: num(form.ageYears),
                gender: form.gender,
                address: form.address.trim(),
                village: fapRef.data.village || '',
                family_code: fapRef.data.familyCode || '',
                student_name: fapRef.data.studentName || '',
                student_roll: fapRef.data.studentRoll || '',
                visit_date: form.visitDate,
                department: form.department,
                attending_doctor: form.doctor.trim(),
                visit_type: form.visitType,
                chief_complaint: form.chiefComplaint.trim(),
                symptoms_duration: form.symptomsDuration.trim(),
                sbp: num(form.sbp),
                dbp: num(form.dbp),
                pulse: num(form.pulse),
                temperature: num(form.temp),
                rbs: num(form.rbs),
                existing_conditions: form.existingConditions.trim(),
                allergies: form.allergies.trim(),
                diagnosis: form.diagnosis.trim(),
                treatment_prescribed: form.treatment.trim(),
                disposition: form.disposition,
                ward_bed_no: form.wardBed.trim(),
                follow_up_advice: form.followUp.trim(),
            };
            const res = await api<{ visit: { id: number } }>('visits', { method: 'POST', body: payload });
            regModalRef.current?.close();
            setForm(resetForm(form));
            reg.current.offset = 0;
            await loadRegisteredPatients();
            openVisitSlip(res.visit.id);
        } catch (err) {
            alert('Registration failed: ' + errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    // ---------------------------------------------------------------- filter actions
    const goToPatients = () => { location.hash = 'patients'; };

    const pickCondition = (condition: string) => {
        setFilters({ ...filtersRef.current, condition });
        goToPatients();
        resetSearch();
    };

    const clearFilters = () => { setFilters(EMPTY_FILTERS); resetSearch(); };

    const removeTag = (key: Tag['key']) => {
        const f = filtersRef.current;
        if (key === 'search') setFilters({ ...f, search: '' });
        else if (key === 'university') setFilters({ ...f, university: '' });
        else if (key === 'student') setFilters({ ...f, student: '' });
        else setFilters({ ...f, condition: '' });
        resetSearch();
    };

    const viewStudent = (id: number) => {
        setFilters({ ...EMPTY_FILTERS, student: String(id) });
        goToPatients();
        resetSearch();
    };

    const onSearchInput = (value: string) => {
        clearTimeout(timer.current);
        st.current.searchSequence++;
        setFilters({ ...filtersRef.current, search: value });
        timer.current = setTimeout(resetSearch, 300);
    };

    const onRegSearchInput = (value: string) => {
        clearTimeout(regTimer.current);
        reg.current.searchSequence++;
        setRegFilters({ ...regFiltersRef.current, search: value });
        regTimer.current = setTimeout(resetRegSearch, 300);
    };

    // ---------------------------------------------------------------- lifecycle
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    const started = useRef(false);
    useEffect(() => {
        const onHash = () => navigateRef.current();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
        window.addEventListener('hashchange', onHash);
        document.addEventListener('keydown', onKey);
        if (!started.current) {
            started.current = true;
            navigateRef.current();
            start();
        }
        return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signOut = () => {
        localStorage.removeItem('medpulse_hospital_admin');
        location.href = '/hospital/login';
    };

    // ---------------------------------------------------------------- render
    const navItem = (v: View, icon: IconName, label: string) => (
        <a href={'#' + v} className={'nav-item' + (view === v ? ' active' : '')} data-view={v} aria-current={view === v ? 'page' : undefined}><IconSpan name={icon} />{label}</a>
    );
    const studentOptions = studentsFor(options, filters.university);
    const metricCards: [string, keyof FapSummary['totals'], IconName][] = [['Surveyed patients', 'patients', 'users'], ['Adopted families', 'families', 'building'], ['Surveying students', 'students', 'staff'], ['Follow-up visits', 'follow_ups', 'calendar']];

    return (
        <>
            <a className="skip" href="#main">Skip to FAP records</a><button className="scrim" id="scrim" aria-label="Close navigation" hidden={!navOpen} onClick={closeNav}></button>
            <aside className={'sidebar' + (navOpen ? ' open' : '')} id="sidebar">
                <a className="brand" href="#overview"><span className="brand-symbol" data-icon="pulse"><Icon name="pulse" /></span><span>MedPulse<small>FAMILY ADOPTION PROGRAMME</small></span></a>
                <div className="hospital-switch"><IconSpan name="building" /><div><strong id="hospitalName">{profile.hospitalName}</strong><small>Connected to student surveys</small></div></div>
                <div className="nav-label">FAP WORKSPACE</div>
                <nav aria-label="Hospital navigation">
                    {navItem('overview', 'grid', 'Control centre')}
                    {navItem('patients', 'users', 'FAP patient registry')}
                    {navItem('registered', 'bed', 'Registered patients')}
                    {navItem('network', 'building', 'Colleges & students')}
                </nav>
                <div className="sidebar-bottom">
                    <div className="help-card"><IconSpan name="shield" /><strong>Student surveys. Connected care.</strong><p>Family records and follow-up visits, in one hospital workspace.</p></div>
                    <div className="account"><span className="avatar teal" id="avatar">{profile.avatar}</span><div><strong id="accountName">{profile.accountName}</strong><small id="accountRole">{profile.accountRole}</small></div><button className="icon-button" id="signOut" aria-label="Sign out" data-icon="logout" onClick={signOut}><Icon name="logout" /></button></div>
                </div>
            </aside>
            <div className="workspace">
                <header className="topbar">
                    <div className="breadcrumb">
                        <button className="icon-button mobile-menu" id="menuButton" aria-label="Open navigation" aria-expanded={navOpen ? 'true' : 'false'} data-icon="menu" onClick={() => setNavOpen((o) => !o)}><Icon name="menu" /></button>
                        <IconSpan name="building" /><span>Family Adoption Programme</span><span>/</span><strong id="breadcrumb">{crumbs[view]}</strong>
                    </div>
                    <span className="demo-pill"><i></i> Student survey records</span>
                </header>
                <main id="main" tabIndex={-1}>
                    <section className="hospital-logo-band" aria-label="SAL Hospital"><img className="hospital-logo" src="/hospital/sal-hospital-logo.webp" alt="SAL Hospital - Healthcare with Human Touch" width="2559" height="1493" /></section>
                    <div className="page-heading">
                        <div className="page-heading-copy"><div className="eyebrow">HOSPITAL · FAMILY ADOPTION PROGRAMME</div><h1 id="pageTitle">{titles[view]}<span>.</span></h1><p>Search the patients surveyed by students and review their care history.</p></div>
                        <div className="heading-actions"><button className="button" id="refreshButton" disabled={refreshing} onClick={refresh}><IconSpan name="clock" />Refresh records</button><a className="button primary" href="#patients"><IconSpan name="search" />Search FAP patients</a></div>
                    </div>
                    <div className="fap-error" id="loadError" role="alert" hidden={loadError.hidden}><span id="errorText">{loadError.text}</span><button className="button" id="retryButton" onClick={refresh}>Retry</button></div>

                    <section className="metrics" id="metrics" data-page="overview" aria-label="FAP totals" hidden={!isPage('overview', view)}>
                        {metrics.kind === 'loading' ? <p className="empty">Loading student survey totals…</p>
                            : metrics.kind === 'failed' ? <p className="empty">FAP totals unavailable. Please retry.</p>
                                : metricCards.map(([label, key, type]) => (
                                    <article className="metric" key={key}><div className="metric-top">{label}<span className="metric-icon"><Icon name={type} /></span></div><div className="metric-value">{Number(metrics.value[key]).toLocaleString()}</div><div className="metric-foot">From accessible FAP records</div></article>
                                ))}
                    </section>

                    <div className="fap-overview" data-page="overview" hidden={!isPage('overview', view)}>
                        <section className="panel">
                            <div className="panel-heading"><div><h2>Recorded health indicators</h2><p>Student-entered flags and conditions · select to search</p></div><IconSpan name="pulse" /></div>
                            <div id="conditions">
                                {conditionList.kind === 'loading' ? <p className="empty">Loading indicators…</p>
                                    : conditionList.kind === 'data' ? conditionList.value.map((c) => (
                                        <button className="indicator" data-condition={c.key} key={c.key} onClick={() => pickCondition(c.key)}><span>{labels[c.key]}</span><strong>{c.count}</strong><span>→</span></button>
                                    )) : null}
                            </div>
                            <p className="form-note">Recorded indicators may overlap. Missing entries are not treated as normal results.</p>
                        </section>
                        <section className="panel">
                            <div className="panel-heading"><div><h2>FAP care network</h2><p>Colleges contributing patient surveys</p></div><a href="#network" className="text-link">View students →</a></div>
                            <div id="universities">
                                {universityList.kind === 'loading' ? <p className="empty">Loading colleges…</p>
                                    : universityList.kind === 'data' ? (universityList.value.length ? universityList.value.map((c, i) => (
                                        <div className="list-row" key={i}><span className="avatar teal"><Icon name="building" /></span><div><strong>{shown(c.name)}</strong><small>{`${c.patient_count} surveyed patients`}</small></div></div>
                                    )) : <p className="empty">No student surveys available for this hospital.</p>) : null}
                            </div>
                        </section>
                    </div>

                    <section className="panel fap-registry" data-page="overview patients" hidden={!isPage('overview patients', view)}>
                        <div className="panel-heading registry-header">
                            <div><div className="registry-title-row"><h2>FAP patient registry <span id="patientCount" className="count-badge">{patientCount}</span></h2><span className="registry-live-pill"><i className="live-dot"></i> Live surveys</span></div><p>Includes surveyed family members without a separate patient login · Real-time clinical indicators.</p></div>
                            <div className="quick-filter-chips" id="quickFilterChips" role="group" aria-label="Quick clinical filters">
                                <button type="button" className={'quick-chip' + (filters.condition === '' ? ' active' : '')} data-condition-chip="" onClick={() => pickCondition('')}>All Patients</button>
                                {QUICK_CHIPS.map(([key, dot, label]) => (
                                    <button type="button" key={key} className={'quick-chip' + (filters.condition === key ? ' active' : '')} data-condition-chip={key} onClick={() => pickCondition(key)}><span className={'chip-dot ' + dot}></span>{label}</button>
                                ))}
                            </div>
                        </div>
                        <form id="searchForm" className="fap-filters-wrapper" onSubmit={(e) => { e.preventDefault(); resetSearch(); }}>
                            <div className="fap-search-row"><div className="search search-large"><IconSpan name="search" /><input id="patientSearch" maxLength={200} placeholder="Search patient name, FAP ID, phone, family code, village, student, roll number, or condition…" autoComplete="off" value={filters.search} onChange={(e) => onSearchInput(e.target.value)} /><button type="button" className="search-clear-btn" id="searchClearBtn" aria-label="Clear search input" hidden={!filters.search.trim()} data-icon="close" onClick={() => { setFilters({ ...filtersRef.current, search: '' }); resetSearch(); }}><Icon name="close" /></button></div></div>
                            <div className="fap-dropdown-row">
                                <label className="filter-field"><span className="filter-label">College</span><select id="universityFilter" value={filters.university} onChange={(e) => { setFilters({ ...filtersRef.current, university: e.target.value }); resetSearch(); }}><option value="">All colleges</option>{options.universities.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select></label>
                                <label className="filter-field"><span className="filter-label">Surveying Student</span><select id="studentFilter" value={filters.student} onChange={(e) => { setFilters({ ...filtersRef.current, student: e.target.value }); resetSearch(); }}><option value="">All students</option>{studentOptions.map((s) => <option key={s.id} value={String(s.id)}>{`${s.name} · Roll ${s.roll_number}`}</option>)}</select></label>
                                <label className="filter-field"><span className="filter-label">Clinical Indicator</span><select id="conditionFilter" value={filters.condition} onChange={(e) => { setFilters({ ...filtersRef.current, condition: e.target.value }); resetSearch(); }}><option value="">All records</option><option value="HTN">Hypertension</option><option value="DM">Diabetes</option><option value="Anaemia">Anaemia</option><option value="Pediatric">Children aged 0–5</option><option value="NoFollowUp">No follow-up recorded</option></select></label>
                                <div className="filter-actions"><button type="submit" className="button primary"><IconSpan name="search" />Search</button><button type="button" className="button" id="clearFilters" onClick={clearFilters}>Clear</button></div>
                            </div>
                            <div className="active-filter-tags" id="activeFilterTags" hidden={!tags.length}>
                                {tags.length ? <>
                                    <span style={{ fontSize: '11px', fontWeight: 650, color: '#537365', marginRight: '2px' }}>Active filters:</span>
                                    {tags.map((t) => <span className="active-tag" key={t.key}>{t.text}<button type="button" className="active-tag-remove" data-remove-filter={t.key} aria-label={t.aria} onClick={() => removeTag(t.key)}>✕</button></span>)}
                                    <button type="button" className="active-tag-clear-all" id="clearAllFiltersTag" onClick={clearFilters}>Clear all</button>
                                </> : null}
                            </div>
                        </form>
                        <div className="table-scroll" id="patientTable" aria-live="polite">
                            {patientTable.kind === 'message' ? <p className="empty">{patientTable.text}</p> : <PatientTable patients={patientTable.rows} onOpen={openPatient} onRegister={(id) => openRegistrationModal(id)} />}
                        </div>
                        <div className="table-footer"><span id="pageInfo">{pageInfo}</span><div className="heading-actions">
                            <button className="button" id="previousPage" disabled={pager.prev} onClick={() => { st.current.offset = Math.max(0, st.current.offset - st.current.limit); search(); }}>← Previous</button>
                            <button className="button" id="nextPage" disabled={pager.next} onClick={() => { st.current.offset += st.current.limit; search(); }}>Next →</button>
                        </div></div>
                    </section>

                    <section className="panel fap-registry" data-page="registered" hidden={!isPage('registered', view)}>
                        <div className="panel-heading registry-header">
                            <div><div className="registry-title-row"><h2>Registered hospital patients <span id="registeredCount" className="count-badge">{registeredCount}</span></h2><span className="registry-live-pill"><i className="live-dot"></i> Hospital admissions &amp; OPD</span></div><p>Patients registered upon visiting the hospital · OPD intake, triage, and admissions log.</p></div>
                            <button type="button" className="button primary" id="openNewRegistrationBtn" onClick={() => openRegistrationModal()}><IconSpan name="plus" />+ Register Patient Visit</button>
                        </div>
                        <div className="registered-summary-grid">
                            <div className="reg-kpi-card"><span className="kpi-label">Total Registered</span><strong id="kpiTotalVisits">{kpis.total}</strong><small>All-time hospital visits</small></div>
                            <div className="reg-kpi-card"><span className="kpi-label">Today's Visits</span><strong id="kpiTodayVisits">{kpis.today}</strong><small>Registered today</small></div>
                            <div className="reg-kpi-card"><span className="kpi-label">Admitted / Ward</span><strong id="kpiAdmittedVisits">{kpis.admitted}</strong><small>Inpatient observation</small></div>
                            <div className="reg-kpi-card"><span className="kpi-label">OPD Discharged</span><strong id="kpiOpdVisits">{kpis.opd}</strong><small>Treated &amp; outpatient</small></div>
                        </div>
                        <form id="registeredSearchForm" className="fap-filters-wrapper" onSubmit={(e) => { e.preventDefault(); resetRegSearch(); }}>
                            <div className="fap-search-row"><div className="search search-large"><IconSpan name="search" /><input id="registeredSearchInput" placeholder="Search by patient name, registration ID, contact, department, diagnosis, or doctor…" autoComplete="off" value={regFilters.search} onChange={(e) => onRegSearchInput(e.target.value)} /><button type="button" className="search-clear-btn" id="regSearchClearBtn" hidden={!regFilters.search.trim()} data-icon="close" onClick={() => { setRegFilters({ ...regFiltersRef.current, search: '' }); resetRegSearch(); }}><Icon name="close" /></button></div></div>
                            <div className="fap-dropdown-row">
                                <label className="filter-field"><span className="filter-label">Department</span><select id="regDeptFilter" value={regFilters.department} onChange={(e) => { setRegFilters({ ...regFiltersRef.current, department: e.target.value }); resetRegSearch(); }}><option value="">All departments</option><option value="General Medicine">General Medicine</option><option value="Cardiology">Cardiology</option><option value="Community Medicine / FAP Referral">Community Medicine / FAP Referral</option><option value="Pediatrics">Pediatrics</option><option value="Orthopedics">Orthopedics</option><option value="Obstetrics & Gynecology">Obstetrics &amp; Gynecology</option><option value="Emergency / Casualty">Emergency / Casualty</option></select></label>
                                <label className="filter-field"><span className="filter-label">Disposition / Status</span><select id="regStatusFilter" value={regFilters.status} onChange={(e) => { setRegFilters({ ...regFiltersRef.current, status: e.target.value }); resetRegSearch(); }}><option value="">All statuses</option><option value="Discharged OPD">Discharged OPD</option><option value="Admitted to Ward">Admitted to Ward</option><option value="Observation">Observation</option><option value="Specialist Referral">Specialist Referral</option></select></label>
                                <div className="filter-actions"><button type="submit" className="button primary"><IconSpan name="search" />Filter</button><button type="button" className="button" id="clearRegFilters" onClick={() => { setRegFilters(EMPTY_REG_FILTERS); resetRegSearch(); }}>Clear</button></div>
                            </div>
                        </form>
                        <div className="table-scroll" id="registeredTable" aria-live="polite">
                            {registeredTable.kind === 'message' ? <p className="empty">{registeredTable.text}</p> : <RegisteredTable visits={registeredTable.rows} onSlip={openVisitSlip} />}
                        </div>
                        <div className="table-footer"><span id="registeredPageInfo">{regPageInfo}</span><div className="heading-actions">
                            <button className="button" id="regPrevPage" disabled={regPager.prev} onClick={() => { reg.current.offset = Math.max(0, reg.current.offset - reg.current.limit); loadRegisteredPatients(); }}>← Previous</button>
                            <button className="button" id="regNextPage" disabled={regPager.next} onClick={() => { reg.current.offset += reg.current.limit; loadRegisteredPatients(); }}>Next →</button>
                        </div></div>
                    </section>

                    <section className="panel" data-page="network" hidden={!isPage('network', view)}>
                        <div className="panel-heading"><div><h2>Student care teams</h2><p>Select a student to search their surveyed patients.</p></div></div>
                        <div id="studentNetwork">
                            {network ? (network.students.length ? network.students.map((s) => (
                                <div className="list-row" key={s.id}><span className="avatar teal">{s.name.slice(0, 1)}</span><div><strong>{s.name}</strong><small>{`Roll ${s.roll_number} · ${shown(network.universities.find((c) => c.id === s.college_id)?.name)}`}</small></div><button className="button" data-student={s.id} onClick={() => viewStudent(s.id)}>View patients →</button></div>
                            )) : <p className="empty">No students with accessible FAP records.</p>) : null}
                        </div>
                    </section>
                    <footer><span id="updatedAt">{updatedAt}</span><span>MedPulse · Student surveys to hospital care</span></footer>
                </main>
            </div>

            <dialog id="modal" className="fap-dialog" aria-labelledby="modalTitle" ref={modalRef} onClose={() => { st.current.detailSequence++; }}>
                <div className="modal-heading"><div><div className="eyebrow">STUDENT-ENTERED FAP RECORD</div><h2 id="modalTitle">{modalTitle}</h2></div><button className="icon-button" id="closeModal" aria-label="Close patient record" data-icon="close" onClick={() => modalRef.current?.close()}><Icon name="close" /></button></div>
                <div id="modalBody">
                    {dossier?.kind === 'loading' ? <p className="empty">Loading student survey and follow-ups…</p> : null}
                    {dossier?.kind === 'error' ? <><p className="empty" role="alert">{dossier.message}</p><button className="button" id="retryDossier" onClick={() => { modalRef.current?.close(); openPatient(dossier.id); }}>Retry record</button></> : null}
                    {dossier?.kind === 'data' ? <PatientDossier d={dossier.d} onRegister={(id) => { modalRef.current?.close(); openRegistrationModal(id); }} /> : null}
                </div>
            </dialog>

            <RegistrationDialog
                dialogRef={regModalRef} title={regTitle} form={form} fapRef={fapRef} submitting={submitting}
                setField={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
                onSubmit={submitRegistration}
                onClose={() => regModalRef.current?.close()}
            />

            <dialog id="visitSlipModal" className="fap-dialog visit-slip-dialog" aria-labelledby="slipModalTitle" ref={slipModalRef}>
                <div className="modal-heading"><div><div className="eyebrow">HOSPITAL REGISTRATION &amp; OUTPATIENT SLIP</div><h2 id="slipModalTitle">{slipTitle}</h2></div><button className="icon-button" id="closeSlipModal" aria-label="Close visit slip" data-icon="close" onClick={() => slipModalRef.current?.close()}><Icon name="close" /></button></div>
                <div id="visitSlipBody" className="slip-content">
                    {slip?.kind === 'loading' ? <p className="empty">Loading patient visit slip…</p> : null}
                    {slip?.kind === 'error' ? <p className="empty">{`Error loading visit slip: ${slip.message}`}</p> : null}
                    {slip?.kind === 'data' ? <VisitSlip v={slip.v} hospitalName={slip.hospitalName} printedAt={slip.printedAt} /> : null}
                </div>
                <div className="slip-actions"><button type="button" className="button" id="printSlipBtn" onClick={() => window.print()}><IconSpan name="download" />Print / Save Slip</button><button type="button" className="button primary" id="closeSlipBtn" onClick={() => slipModalRef.current?.close()}>Done</button></div>
            </dialog>
        </>
    );
}

/** Value an <input type="number"> keeps after `.value = x` (non-numeric strings are sanitised to ''). */
function numberInput(x: unknown): string {
    const s = String(x);
    return /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s) ? s : '';
}
