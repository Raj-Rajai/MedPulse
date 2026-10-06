/**
 * Patient portal (frontend/patient/patient.html + patient.js) as one React app.
 * Rendered through a portal straight into <body>: style.css hides every unknown direct child of body
 * (`body > *:not(#sidebar)...`), so the sidebar, main, toasts and modals must stay body children like before.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { SidebarUserBadge } from '../../shared/SidebarUserBadge';
import type { PortalActions, RequestForm, ToastType } from './actions';
import { CampaignsPanel } from './CampaignsPanel';
import { FamilyPanel } from './FamilyPanel';
import { effectiveRequestFor, HospitalPanel } from './HospitalPanel';
import { LangContext, makeT, storedLang, storeLang, translateText, type Lang } from './i18n';
import { cardCompleteness, needsRequestConfirm, pendingCampCount, splitCamps } from './logic';
import {
    ConfirmModal, EMPTY_MEMBER, FamilyModal, LinkModal, MemberModal, RsvpModal,
    type ConfirmState, type FamilyForm, type LinkFeedback, type MemberForm,
} from './Modals';
import { actionItems, OverviewPanel } from './OverviewPanel';
import { ProfilePanel } from './ProfilePanel';
import { RecordsPanel } from './RecordsPanel';
import { Sidebar } from './Sidebar';
import { TABS, type CampNotification, type FamilyPayload, type HospitalRequest, type PatientCard, type PortalState, type RecordsPayload, type TabId } from './types';
import { api, digits, genderLabel, initials, logoutPatient, parseDay, todayIso } from './util';
import { ConfidentialityNoticeModal } from '../../shared/privacy/ConfidentialityNoticeModal';

const EMPTY_STATE: PortalState = { card: null, records: null, family: null, notifs: [], requests: [], hospital: null, departments: [], reasons: [] };
type ModalId = 'memberModal' | 'famModal' | 'linkModal' | 'rsvpModal' | 'confirmModal';
type RefreshKey = 'card' | 'family' | 'notifs' | 'requests' | 'records';

interface Toast { id: number; message: string; type: ToastType; fading: boolean }

const TAB_BUTTONS: { tab: TabId; label: string; count?: string }[] = [
    { tab: 'overview', label: '🏠 Overview ', count: 'cntOverview' },
    { tab: 'profile', label: '▣ Health Card ', count: 'cntProfile' },
    { tab: 'family', label: '👪 Family' },
    { tab: 'hospital', label: '🏥 Hospital ', count: 'cntHospital' },
    { tab: 'campaigns', label: '📣 Camps ', count: 'cntCampaigns' },
    { tab: 'records', label: '📋 Records' },
];

const initialTab = (): TabId => {
    const h = window.location.hash.slice(1);
    return (TABS as string[]).includes(h) ? (h as TabId) : 'overview';
};

export function PatientApp() {
    /* ---------- language ---------- */
    const [lang, setLangState] = useState<Lang>(storedLang);
    const t = useMemo(() => makeT(lang), [lang]);
    const langRef = useRef(lang);
    langRef.current = lang;
    const setPatientLanguage = (v: string) => {
        const next: Lang = v === 'gu' ? 'gu' : 'en';
        storeLang(next);
        setLangState(next);
    };
    useEffect(() => {
        document.documentElement.lang = lang === 'gu' ? 'gu' : 'en';
        document.body.classList.toggle('lang-gu', lang === 'gu');
        // The sidebar badge (shared component) keeps its English tooltips; translate them like applyLanguage() did.
        document.querySelectorAll<HTMLElement>('#authNavArea [title], #authNavArea [aria-label]').forEach((el) => {
            (['title', 'aria-label'] as const).forEach((attr) => {
                if (!el.hasAttribute(attr)) return;
                const key = `data-en-${attr}`;
                if (!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(attr) || '');
                el.setAttribute(attr, translateText(el.getAttribute(key) || '', lang));
            });
        });
    }, [lang]);

    /* ---------- data ---------- */
    const [st, setSt] = useState<PortalState>(EMPTY_STATE);
    const [loaded, setLoaded] = useState(false);
    const stRef = useRef(st);
    stRef.current = st;

    /* ---------- toasts ---------- */
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastSeq = useRef(0);
    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3400) => {
        const id = ++toastSeq.current;
        setToasts((l) => [...l, { id, message: translateText(String(message), langRef.current), type, fading: false }]);
        setTimeout(() => {
            setToasts((l) => l.map((x) => (x.id === id ? { ...x, fading: true } : x)));
            setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 200);
        }, duration);
    }, []);

    const loadAll = useCallback(async () => {
        const [card, rec, fam, notif, hosp, reqs] = await Promise.allSettled([
            api<{ card: PatientCard }>('/api/patient/card'), api<RecordsPayload>('/api/patient/records'), api<FamilyPayload>('/api/patient/family'),
            api<{ notifications?: CampNotification[] }>('/api/patient/notifications'),
            api<{ hospital: PortalState['hospital']; departments?: string[]; reasons?: string[] }>('/api/patient/hospital'),
            api<{ requests?: HospitalRequest[] }>('/api/patient/hospital-requests'),
        ]);
        if (card.status === 'rejected') showToast((card.reason as Error).message, 'error');
        setSt((old) => {
            const next = { ...old };
            if (card.status === 'fulfilled') next.card = card.value.card;
            if (rec.status === 'fulfilled') next.records = rec.value;
            if (fam.status === 'fulfilled') next.family = fam.value;
            next.notifs = notif.status === 'fulfilled' ? (notif.value.notifications || []) : [];
            if (hosp.status === 'fulfilled') { next.hospital = hosp.value.hospital; next.departments = hosp.value.departments || []; next.reasons = hosp.value.reasons || []; }
            next.requests = reqs.status === 'fulfilled' ? (reqs.value.requests || []) : [];
            return next;
        });
        setLoaded(true);
    }, [showToast]);

    const refresh = useCallback(async (which: RefreshKey[]) => {
        const patch: Partial<PortalState> = {};
        const jobs: Record<RefreshKey, () => Promise<void>> = {
            card: () => api<{ card: PatientCard }>('/api/patient/card').then((d) => { patch.card = d.card; }),
            family: () => api<FamilyPayload>('/api/patient/family').then((d) => { patch.family = d; }),
            notifs: () => api<{ notifications?: CampNotification[] }>('/api/patient/notifications').then((d) => { patch.notifs = d.notifications || []; }),
            requests: () => api<{ requests?: HospitalRequest[] }>('/api/patient/hospital-requests').then((d) => { patch.requests = d.requests || []; }),
            records: () => api<RecordsPayload>('/api/patient/records').then((d) => { patch.records = d; }),
        };
        await Promise.allSettled(which.map((k) => jobs[k]()));
        setSt((old) => ({ ...old, ...patch }));
    }, []);

    /* ---------- sidebar ---------- */
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = () => {
        if (window.innerWidth <= 860) setSidebarOpen((o) => !o);
        else {
            const c = document.documentElement.classList.toggle('sidebar-collapsed');
            document.body.classList.toggle('sidebar-collapsed', c);
            try { localStorage.setItem('sidebar_collapsed', c ? '1' : '0'); } catch { /* ignore */ }
        }
    };
    const closeSidebar = () => { if (window.innerWidth <= 860) setSidebarOpen(false); };

    /* ---------- tabs ---------- */
    const [tab, setTab] = useState<TabId>(initialTab);
    const [tabSeq, setTabSeq] = useState(0);
    const [familyNoticeOpen, setFamilyNoticeOpen] = useState(false);
    const prevTabRef = useRef<TabId | null>(null);

    useEffect(() => {
        if (tab === 'family' && prevTabRef.current !== 'family') {
            setFamilyNoticeOpen(true);
        }
        prevTabRef.current = tab;
    }, [tab]);

    const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
    const showTab = useCallback((name: TabId | string, push = true) => {
        const next: TabId = (TABS as string[]).includes(name) ? (name as TabId) : 'overview';
        setTab(next);
        setTabSeq((n) => n + 1);
        if (push && window.location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`);
        if (window.innerWidth <= 860) setSidebarOpen(false);
    }, []);
    useLayoutEffect(() => {
        const el = tabRefs.current[tab];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabSeq]);
    useEffect(() => {
        const onHash = () => showTab(window.location.hash.slice(1), false);
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, [showTab]);
    const onTabsKey = (event: KeyboardEvent<HTMLElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = TABS.map((x) => tabRefs.current[x]).filter((x): x is HTMLButtonElement => !!x);
        const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
        if (current < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
            : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        showTab(TABS[next]);
        tabs[next].focus({ preventScroll: true });
    };

    /* ---------- mark camp alerts read when the camps tab is open ---------- */
    const readSent = useRef(false);
    useEffect(() => {
        if (tab !== 'campaigns') return;
        if (readSent.current || !st.notifs.some((n) => n.notification_status === 'Delivered')) return;
        readSent.current = true;
        api('/api/patient/notifications/mark-read', { method: 'POST' }).catch(() => { readSent.current = false; });
    }, [tab, st.notifs]);

    /* ---------- boot ---------- */
    useEffect(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('preload-transitions')));
        void loadAll();
        const timer = setInterval(() => { if (!document.hidden) void refresh(['notifs', 'requests']); }, 60000);
        return () => clearInterval(timer);
    }, [loadAll, refresh]);

    /* ---------- modals ---------- */
    const [openModals, setOpenModals] = useState<Partial<Record<ModalId, boolean>>>({});
    const openModal = (id: ModalId) => setOpenModals((m) => ({ ...m, [id]: true }));
    const closeModal = useCallback((id: ModalId) => {
        setOpenModals((m) => ({ ...m, [id]: false }));
        if (id === 'confirmModal' && confirmResolve.current) { confirmResolve.current(false); confirmResolve.current = null; }
    }, []);
    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') (['memberModal', 'famModal', 'linkModal', 'rsvpModal', 'confirmModal'] as ModalId[]).forEach(closeModal);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [closeModal]);

    // confirm dialog
    const [confirmState, setConfirmState] = useState<ConfirmState>({ title: 'Are you sure?', text: '', ok: 'Yes, remove' });
    const confirmResolve = useRef<((v: boolean) => void) | null>(null);
    const confirmDialog = (title: string, text: string, ok?: string) => new Promise<boolean>((resolve) => {
        if (confirmResolve.current) confirmResolve.current(false);
        confirmResolve.current = resolve;
        setConfirmState({ title, text, ok: ok || 'Yes' });
        openModal('confirmModal');
    });
    const confirmOk = () => {
        const r = confirmResolve.current;
        confirmResolve.current = null;
        setOpenModals((m) => ({ ...m, confirmModal: false }));
        if (r) r(true);
    };

    // member modal
    const [memberTitle, setMemberTitle] = useState('Add family member');
    const [memberForm, setMemberForm] = useState<MemberForm>(EMPTY_MEMBER);
    const [memberErr, setMemberErr] = useState<string | null>(null);
    const [memberBusy, setMemberBusy] = useState(false);
    const editingMemberId = useRef<number | null>(null);
    const mfNameRef = useRef<HTMLInputElement>(null);
    const relations = ((st.family && st.family.relations) || []).filter((r) => r !== 'Head');

    // family modal
    const [famForm, setFamForm] = useState<FamilyForm>({ name: '', addr: '', village: '', city: '', district: '', pin: '' });
    const [famBusy, setFamBusy] = useState(false);

    // link modal
    const [linkCode, setLinkCode] = useState('');
    const [linkFeedback, setLinkFeedback] = useState<LinkFeedback>({ kind: 'hidden' });
    const [linkBusy, setLinkBusy] = useState(false);
    const linkCodeRef = useRef<HTMLInputElement>(null);
    const verifyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // rsvp modal
    const [rsvpCtx, setRsvpCtx] = useState<{ id: number; rsvp: string } | null>(null);
    const [rsvpQuick, setRsvpQuick] = useState<string | null>(null);
    const [rsvpNote, setRsvpNote] = useState('');

    /* ---------- hospital request form ---------- */
    const [reqForm, setReqFormState] = useState<RequestForm>({ forId: '', dept: '', reason: '', channel: 'Callback', time: 'Any time', msg: '' });
    const setReqForm = (patch: Partial<RequestForm>) => setReqFormState((f) => ({ ...f, ...patch }));
    const [reqBusy, setReqBusy] = useState(false);
    const reqDeptRef = useRef<HTMLSelectElement>(null);
    const reqMsgRef = useRef<HTMLTextAreaElement>(null);

    async function submitRequest() {
        setReqBusy(true);
        try {
            const s = stRef.current;
            const forId = effectiveRequestFor(s, reqForm.forId);
            const body = {
                for_member_id: forId ? Number(forId) : undefined,
                channel: reqForm.channel,
                department: reqForm.dept || s.departments[0] || '', reason: reqForm.reason || s.reasons[0] || '',
                preferred_time: reqForm.time, message: reqForm.msg.trim(),
            };
            const d = await api<{ message?: string }>('/api/patient/hospital-requests', { method: 'POST', body });
            showToast(d.message || 'Request sent', 'success');
            setReqForm({ msg: '' });
            await refresh(['requests']);
        } catch (e) { showToast((e as Error).message, 'error'); }
        finally { setReqBusy(false); }
    }

    /* ---------- actions (window.PT) ---------- */
    const actions: PortalActions = {
        showTab,
        showToast,
        printCard() {
            document.body.classList.add('print-card');
            const done = () => { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', done); };
            window.addEventListener('afterprint', done);
            window.print();
            setTimeout(done, 1500);
        },
        copyUid() {
            const c = stRef.current.card;
            const uid = c && c.patient_uid; if (!uid) return;
            (navigator.clipboard ? navigator.clipboard.writeText(uid) : Promise.reject())
                .then(() => showToast(`Copied ${uid}`, 'success'))
                .catch(() => showToast(uid, 'info'));
        },
        async profileSaved(card) {
            setSt((old) => ({ ...old, card }));
            showToast('Your card is updated', 'success');
            await refresh(['family']);
        },
        editFamily() {
            const f = (stRef.current.family && stRef.current.family.family) || {};
            setFamForm({ name: f.family_name || '', addr: f.address || '', village: f.village || '', city: f.city || '', district: f.district || '', pin: f.pincode || '' });
            openModal('famModal');
        },
        addMember() {
            editingMemberId.current = null;
            setMemberTitle('＋ Add family member');
            setMemberForm({ ...EMPTY_MEMBER, dobMax: todayIso() });
            setMemberErr(null);
            openModal('memberModal');
            setTimeout(() => mfNameRef.current?.focus(), 60);
        },
        editMember(id) {
            const m = stRef.current.family?.members.find((x) => x.id === id); if (!m) return;
            editingMemberId.current = id;
            setMemberTitle(`✏ Edit ${m.name}`);
            setMemberForm({
                name: m.name || '', dob: m.date_of_birth || '', dobMax: todayIso(), age: m.date_of_birth ? '' : String(m.age_years || ''),
                phone: m.contact_number || '', occ: m.occupation || '', edu: m.education || '', gender: m.gender || '',
                marital: m.marital_status || 'Unknown', rel: m.relation_to_hof || '',
            });
            setMemberErr(null);
            openModal('memberModal');
        },
        async removeMember(id) {
            const m = stRef.current.family?.members.find((x) => x.id === id); if (!m) return;
            const yes = await confirmDialog(`Remove ${m.name}?`, 'They will be removed from your family list. This cannot be undone.', 'Yes, remove');
            if (!yes) return;
            try {
                const fam = await api<FamilyPayload>(`/api/patient/family/members/${id}`, { method: 'DELETE' });
                setSt((old) => ({ ...old, family: fam }));
                showToast(`${m.name} removed`, 'info');
            } catch (e) { showToast((e as Error).message, 'error'); }
        },
        requestFor(id) {
            showTab('hospital');
            setReqForm({ forId: String(id) });
            setTimeout(() => reqDeptRef.current?.focus(), 60);
        },
        focusRequestMessage() {
            showTab('hospital');
            setTimeout(() => reqMsgRef.current?.focus(), 60);
        },
        async confirmRequest(id, confirmed) {
            try {
                await api(`/api/patient/hospital-requests/${id}/confirm`, { method: 'POST', body: { confirmed } });
                showToast(confirmed ? 'Thanks for confirming!' : 'Request re-opened. The hospital will follow up.', confirmed ? 'success' : 'info');
                await refresh(['requests']);
            } catch (e) { showToast((e as Error).message, 'error'); }
        },
        async cancelRequest(id) {
            const yes = await confirmDialog('Cancel this request?', 'The hospital will no longer call you about it.', 'Yes, cancel');
            if (!yes) return;
            try {
                await api(`/api/patient/hospital-requests/${id}/cancel`, { method: 'POST' });
                showToast('Request cancelled', 'info');
                await refresh(['requests']);
            } catch (e) { showToast((e as Error).message, 'error'); }
        },
        sendRsvp: (id, rsvp, note) => { void sendRsvp(id, rsvp, note); },
        askRsvp(id, rsvp) {
            setRsvpCtx({ id, rsvp });
            setRsvpNote('');
            setRsvpQuick(null);
            openModal('rsvpModal');
        },
        async confirmCampContact(id, confirmed) {
            try {
                await api(`/api/patient/notifications/${id}/confirm-contact`, { method: 'POST', body: { confirmed } });
                showToast(confirmed ? 'Thanks for confirming!' : "Thanks. We've let the organisers know.", confirmed ? 'success' : 'info');
                await refresh(['notifs']);
            } catch (e) { showToast((e as Error).message, 'error'); }
        },
        downloadIcs(id) {
            const n = stRef.current.notifs.find((x) => x.notification_id === id); if (!n) return;
            const d = parseDay(n.event_date); if (!d) return;
            const ymd = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`;
            const end = new Date(d); end.setDate(end.getDate() + 1);
            const clean = (s: unknown) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
            const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedPulse//Patient//EN', 'BEGIN:VEVENT',
                `UID:medpulse-camp-${id}@medpulse`, `DTSTAMP:${ymd(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
                `SUMMARY:${clean(n.campaign_title)}`, `LOCATION:${clean(n.venue)}`, `DESCRIPTION:${clean(n.campaign_description)}`,
                'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', 'DESCRIPTION:Health camp tomorrow', 'END:VALARM',
                'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
            a.download = `health-camp-${id}.ics`; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
        openCamp(id) {
            showTab('campaigns');
            setTimeout(() => { const el = document.getElementById(`camp-${id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
        },
        openLink() {
            setLinkCode('');
            setLinkFeedback({ kind: 'hidden' });
            openModal('linkModal');
            setTimeout(() => linkCodeRef.current?.focus(), 80);
        },
    };

    async function sendRsvp(id: number, rsvp: string, note?: string) {
        try {
            const d = await api<{ message?: string }>(`/api/patient/notifications/${id}/rsvp`, { method: 'POST', body: { rsvp, note } });
            showToast(d.message || 'Reply sent', 'success');
            await refresh(['notifs']);
        } catch (e) { showToast((e as Error).message, 'error'); }
    }

    function submitRsvpNote() {
        const note = [rsvpQuick || '', rsvpNote.trim()].filter(Boolean).join('. ');
        closeModal('rsvpModal');
        if (rsvpCtx) void sendRsvp(rsvpCtx.id, rsvpCtx.rsvp, note);
    }

    async function saveMember() {
        const f = memberForm;
        const body: Record<string, unknown> = {
            name: f.name.trim(), relation_to_hof: f.rel, gender: f.gender,
            date_of_birth: f.dob || null, contact_number: digits(f.phone) || null,
            marital_status: f.marital, occupation: f.occ.trim() || null, education: f.edu.trim() || null,
        };
        if (f.age !== '' && !body.date_of_birth) body.age_years = f.age;
        if (!body.name) return setMemberErr('Please enter a name.');
        if (!body.relation_to_hof) return setMemberErr('Please choose a relation.');
        if (!body.gender) return setMemberErr('Please choose a gender.');
        if (!body.date_of_birth && body.age_years === undefined && !editingMemberId.current) return setMemberErr('Enter a date of birth or an age.');
        if (body.contact_number && String(body.contact_number).length !== 10) return setMemberErr('Mobile must be 10 digits.');
        setMemberBusy(true);
        const editing = editingMemberId.current;
        try {
            const url = editing ? `/api/patient/family/members/${editing}` : '/api/patient/family/members';
            const d = await api<FamilyPayload>(url, { method: editing ? 'PUT' : 'POST', body });
            setSt((old) => ({ ...old, family: d }));
            setOpenModals((m) => ({ ...m, memberModal: false }));
            showToast(editing ? 'Member updated' : `${body.name} added to your family`, 'success');
        } catch (e) { setMemberErr((e as Error).message); }
        finally { setMemberBusy(false); }
    }

    async function saveFamily() {
        const pin = digits(famForm.pin);
        if (pin && pin.length !== 6) return showToast('PIN code must be 6 digits', 'error');
        setFamBusy(true);
        try {
            const fam = await api<FamilyPayload>('/api/patient/family', {
                method: 'PUT', body: {
                    family_name: famForm.name.trim(), address: famForm.addr.trim(), village: famForm.village.trim(),
                    city: famForm.city.trim(), district: famForm.district.trim(), pincode: pin || null,
                },
            });
            setSt((old) => ({ ...old, family: fam }));
            setOpenModals((m) => ({ ...m, famModal: false }));
            showToast('Family details saved', 'success');
            await refresh(['card']);
        } catch (e) { showToast((e as Error).message, 'error'); }
        finally { setFamBusy(false); }
    }

    function onLinkInput(v: string) {
        setLinkCode(v);
        clearTimeout(verifyTimer.current);
        verifyTimer.current = setTimeout(() => void verifyCode(v), 350);
    }
    async function verifyCode(raw: string) {
        const code = raw.trim().toUpperCase();
        if (code.length < 4) { setLinkFeedback({ kind: 'hidden' }); return; }
        try {
            const res = await fetch('/api/patient/verify-referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referral_code: code }) });
            const d = await res.json();
            if (res.ok && d.valid && d.student) {
                setLinkFeedback({ kind: 'ok', name: String(d.student.name ?? ''), roll: String(d.student.roll_number ?? ''), college: String(d.student.college_name || '') });
            } else {
                setLinkFeedback({ kind: 'error', text: d.error || 'No student found with this code.' });
            }
        } catch { /* ignore */ }
    }
    async function submitLink() {
        setLinkBusy(true);
        try {
            const d = await api<{ message?: string; patient?: Record<string, unknown> }>('/api/patient/link-referral', { method: 'POST', body: { referral_code: linkCode.trim() } });
            showToast(d.message || 'Health survey connected', 'success');
            if (d.patient) { try { const p = { ...d.patient }; delete p.pin; localStorage.setItem('medpulse_patient', JSON.stringify(p)); } catch { /* ignore */ } }
            setOpenModals((m) => ({ ...m, linkModal: false }));
            await loadAll();
        } catch (e) { showToast((e as Error).message, 'error'); }
        finally { setLinkBusy(false); }
    }

    /* ---------- derived counters & hero ---------- */
    const c = st.card;
    const counts: Record<string, string> = {
        cntOverview: String(loaded ? actionItems(st, actions, t).length || '' : ''),
        cntProfile: c && cardCompleteness(c).missing.length ? '!' : '',
        cntHospital: String(loaded ? st.requests.filter(needsRequestConfirm).length || '' : ''),
        cntCampaigns: String(loaded ? pendingCampCount(splitCamps(st.notifs).up) || '' : ''),
    };
    const hour = new Date().getHours();
    const hc = c || {};
    const hero = loaded ? {
        greet: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
        name: hc.name || 'Patient',
        avatar: initials(hc.name),
        uid: hc.patient_uid || 'PAT-····',
        ageGender: [hc.age_years ? `${hc.age_years} yrs` : null, genderLabel(hc.gender), hc.blood_group && hc.blood_group !== 'Unknown' ? `🩸 ${hc.blood_group}` : null].filter(Boolean).join(' · ') || '—',
        role: hc.family_role === 'Head' ? '👑 Head of family' : '👪 Family member',
    } : { greet: 'Welcome', name: 'Loading…', avatar: '–', uid: 'PAT-····', ageGender: '–', role: '–' };

    const page = (
        <LangContext.Provider value={t}>
            <a className="pt-skip" href="#patientMain">{t('Skip to patient content')}</a>

            <div className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`} id="sidebarOverlay" onClick={closeSidebar} />

            <Sidebar tab={tab} open={sidebarOpen} onToggle={toggleSidebar} onTab={(x) => showTab(x)} badge={<SidebarUserBadge />} />

            <button className="mobile-nav-toggle" id="mobileNavToggle" onClick={toggleSidebar} title={t('Toggle Navigation')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>

            <div id="toastContainer" className="toast-container" role="status" aria-live="polite">
                {toasts.map((x) => (
                    <div key={x.id} className={`toast toast-${x.type}`} style={x.fading ? { opacity: '0' } : undefined}>
                        <span>{x.message}</span><button className="toast-close" aria-label={t('Dismiss')} onClick={() => setToasts((l) => l.filter((y) => y.id !== x.id))}>✕</button>
                    </div>
                ))}
            </div>

            <main className="main-content" id="patientMain" tabIndex={-1}>
                <div className="pt-wrap">

                    <div className="pt-page-heading">
                        <div>
                            <p className="pt-eyebrow">{t('YOUR PATIENT PORTAL')}</p>
                            <h2>{t('Your health, in one place.')}</h2>
                            <p>{t('Stay connected to your care, your family and your hospital.')}</p>
                        </div>
                        <div className="pt-heading-actions">
                            <label className="pt-lang" htmlFor="patientLanguage"><span>{t('Language')}</span><select id="patientLanguage" className="pt-select" value={lang} onChange={(e) => setPatientLanguage(e.target.value)}><option value="en">{t('English')}</option><option value="gu">ગુજરાતી</option></select></label>
                            <span className="pt-page-badge">{t('MedPulse Care')}</span>
                        </div>
                    </div>

                    <header className="pt-hero">
                        <div className="pt-hero-id">
                            <div className="pt-avatar" id="heroAvatar">{t(hero.avatar)}</div>
                            <div style={{ minWidth: 0 }}>
                                <div className="pt-greet" id="heroGreeting">{t(hero.greet)}</div>
                                <h1 className="pt-name" id="heroName">{t(hero.name)}</h1>
                                <div className="pt-chips">
                                    <span className="pt-chip mono" id="heroUid">{t(hero.uid)}</span>
                                    <span className="pt-chip" id="heroAgeGender">{t(hero.ageGender)}</span>
                                    <span className="pt-chip" id="heroRole">{t(hero.role)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-hero-actions">
                            <button className="pt-hero-btn" onClick={() => showTab('profile')}>{t('▣ My card')}</button>
                            <button className="pt-hero-btn" onClick={logoutPatient}>{t('🚪 Sign out')}</button>
                        </div>
                    </header>

                    <nav className="pt-tabs" role="tablist" aria-label={t('Patient portal sections')} onKeyDown={onTabsKey}>
                        {TAB_BUTTONS.map((b) => {
                            const on = b.tab === tab;
                            return (
                                <button key={b.tab} ref={(el) => { tabRefs.current[b.tab] = el; }} className={`pt-tab${on ? ' active' : ''}`} role="tab" id={`tab-${b.tab}`} aria-controls={`panel-${b.tab}`}
                                    aria-selected={on} tabIndex={on ? 0 : -1} data-tab={b.tab} onClick={() => showTab(b.tab)}>
                                    {t(b.label)}{b.count ? <span className="pt-count" id={b.count}>{t(counts[b.count])}</span> : null}
                                </button>
                            );
                        })}
                    </nav>

                    <OverviewPanel s={st} a={actions} loaded={loaded} active={tab === 'overview'} />
                    <ProfilePanel s={st} a={actions} active={tab === 'profile'} />
                    <FamilyPanel s={st} a={actions} active={tab === 'family'} />
                    <HospitalPanel s={st} a={actions} loaded={loaded} active={tab === 'hospital'} form={reqForm} setForm={setReqForm}
                        refs={{ reqDept: reqDeptRef, reqMsg: reqMsgRef }} busy={reqBusy} onSubmit={() => void submitRequest()} />
                    <CampaignsPanel s={st} a={actions} loaded={loaded} active={tab === 'campaigns'} />
                    <RecordsPanel s={st} a={actions} loaded={loaded} active={tab === 'records'} />

                </div>
            </main>

            <MemberModal open={!!openModals.memberModal} title={memberTitle} form={memberForm} setForm={(p) => setMemberForm((f) => ({ ...f, ...p }))}
                relations={relations} error={memberErr} busy={memberBusy} nameRef={mfNameRef} onClose={() => closeModal('memberModal')} onSave={() => void saveMember()} />
            <FamilyModal open={!!openModals.famModal} form={famForm} setForm={(p) => setFamForm((f) => ({ ...f, ...p }))} busy={famBusy}
                onClose={() => closeModal('famModal')} onSave={() => void saveFamily()} />
            <LinkModal open={!!openModals.linkModal} code={linkCode} setCode={onLinkInput} feedback={linkFeedback} busy={linkBusy} codeRef={linkCodeRef}
                onClose={() => closeModal('linkModal')} onSubmit={() => void submitLink()} />
            <RsvpModal open={!!openModals.rsvpModal} rsvp={rsvpCtx ? rsvpCtx.rsvp : null} quick={rsvpQuick} setQuick={setRsvpQuick} note={rsvpNote} setNote={setRsvpNote}
                onClose={() => closeModal('rsvpModal')} onSubmit={submitRsvpNote} />
            <ConfirmModal open={!!openModals.confirmModal} state={confirmState} onCancel={() => closeModal('confirmModal')} onOk={confirmOk} />
            <ConfidentialityNoticeModal
                type="SENSITIVE_HOUSEHOLD"
                context="MY_FAMILY"
                open={familyNoticeOpen}
                onContinue={() => setFamilyNoticeOpen(false)}
                onClose={() => {
                    setFamilyNoticeOpen(false);
                    showTab('overview');
                }}
            />
        </LangContext.Provider>
    );
    return createPortal(page, document.body);
}

