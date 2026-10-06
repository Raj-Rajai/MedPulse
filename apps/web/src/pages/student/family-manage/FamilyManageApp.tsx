/**
 * student/family-manage.html: household directory with live search, register / edit / delete
 * household, the selected household's workspace (roster cards, member profile segments with
 * condition / medication / allergy / history / lifestyle CRUD, follow-up visits) and the
 * add-member (with draft recovery), edit-member, provision-patient and confirm modals.
 * The field-location card is moved to the end of <main> with its button renamed, like the original.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutToLogin, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_PROFILE, useToasts } from '../common/Toasts';
import { errMsg, runWhenActive } from '../common/utils';
import { LocationVerificationCard } from '../common/fieldLocation';
import { selectValue } from '../common/Select';
import { useValidatedField, validatePhone, type ValidatedField } from '../../../shared/validation';
import { OPT, fieldKit } from './fields';
import { AddMemberModal, AllergyModal, ConditionModal, ConfirmModal, EditFamilyModal, EditMemberModal, HistoryModal, LifestyleModal, MedicationModal, ProvisionModal, type ConfirmState, type ProvisionResult } from './Modals';
import { AllergiesList, Baseline, ConditionsList, Demographics, HistoryList, LifestyleView, MedicationsList, MemberCards, Timeline, Vitals } from './MemberViews';
import { ageFromDob, inputValue, isoToday, type FamilyDetail, type FamilyRow, type FormValues, type Lifestyle, type MemberDetail } from './types';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

const CREATE_DEFAULTS: FormValues = { cfRoll: '235', cfFamilyNo: '', cfHof: '', cfFamilyName: '', cfContactPhone: '', cfVillage: 'RHTC Field Area - Ward 4', cfAddress: '', cfCity: '', cfPincode: '', cfTotalCu: '4.0', cfCalorie: '12000', cfCalorieStatus: 'Normal', cfAdvice: 'N' };
const ADD_DEFAULTS: FormValues = { modalMName: '', modalMRelation: 'Head of Family', modalMGender: 'M', modalMDob: '', modalMAgeYears: '', modalMAgeMonths: '0', modalMMaritalStatus: 'Married', modalMEducation: 'Secondary', modalMOccupation: '', modalMContact: '', modalMWork: 'Moderate' };
const COND_DEFAULTS: FormValues = { condEditId: '', condName: '', condCategory: 'Other', condStatus: 'Active', condSeverity: 'Moderate', condDate: '', condNotes: '' };
const MED_DEFAULTS: FormValues = { medEditId: '', medName: '', medDosage: '', medFrequency: 'OD (Once daily)', medRoute: 'Oral', medAdherence: 'Good', medPrescribedFor: '', medStartDate: '' };
const ALG_DEFAULTS: FormValues = { algEditId: '', algAllergen: '', algType: 'Drug', algSeverity: 'Moderate', algReaction: '' };
const HIST_DEFAULTS: FormValues = { histEditId: '', histType: 'Surgery', histDesc: '', histDate: '', histFacility: '', histNotes: '' };
const LS_DEFAULTS: FormValues = { lsSmoking: 'Never', lsSmokingFreq: '', lsAlcohol: 'Never', lsDiet: 'Vegetarian', lsPhysical: 'Moderate', lsSalt: 'Normal', lsSleep: '', lsNotes: '' };
const FU_DEFAULTS: FormValues = { fuDate: '', fuSbp: '', fuDbp: '', fuRbs: '', fuHb: '', fuWeight: '', fuCompliance: 'Good', fuProgress: 'Improved', fuNextDate: '', fuNotes: '' };
const PROV_DEFAULTS: FormValues = { provMemberId: '', provPatientName: '', provPhone: '', provPin: '1234' };

type ListView = { k: 'initial' } | { k: 'list' } | { k: 'empty'; q: string } | { k: 'error' };

/** A form's values with a single-field setter and a reset to the markup defaults. */
function useForm(defaults: FormValues) {
    const [values, setValues] = useState<FormValues>(defaults);
    const set = useCallback((id: string, v: string) => setValues((f) => ({ ...f, [id]: v })), []);
    const reset = useCallback(() => setValues(defaults), [defaults]);
    return { values, setValues, set, reset };
}

/** MedPulseValidation.validatePhone(value, false) + showError + focus, as the submit handlers did. */
function checkPhone(value: string, field: ValidatedField, inputId: string, toast: (m: string, t: string) => void, focus: (id: string) => void): string | null {
    const contactVal = value.trim();
    if (!contactVal) return contactVal;
    const check = validatePhone(contactVal, false);
    if (!check.valid) {
        toast(check.error, 'error');
        field.showError(check.error);
        focus(inputId);
        return null;
    }
    return check.clean;
}

export function FamilyManageApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_PROFILE);
    const [loggedInStudent] = useState(readStoredUser);

    const {
        activeModal,
        saving: privacySaving,
        handleForm1Continue,
        handleForm2Consent,
        handleForm2Refuse,
        closeModal,
    } = useStudentPrivacy(loggedInStudent?.roll_number);

    /* ---- Imperative focus / scroll / animation requests, run after the commit that shows the element ---- */
    const focusReq = useRef<string[]>([]);
    const scrollReq = useRef<string | null>(null);
    const slideReq = useRef(false);
    const [effectTick, setEffectTick] = useState(0);
    const focusLater = useCallback((id: string) => { focusReq.current.push(id); setEffectTick((t) => t + 1); }, []);
    const scrollLater = useCallback((id: string) => { scrollReq.current = id; setEffectTick((t) => t + 1); }, []);
    useLayoutEffect(() => {
        if (slideReq.current) {
            slideReq.current = false;
            for (const id of ['memberDetailCard', 'followUpWorkspaceCard']) {
                const el = document.getElementById(id);
                if (!el) continue;
                el.classList.remove('tab-slide-right');
                void el.offsetWidth;
                el.classList.add('tab-slide-right');
            }
        }
        if (scrollReq.current) {
            document.getElementById(scrollReq.current)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            scrollReq.current = null;
        }
        // In request order, like the original's successive focus() calls (each may scroll its container).
        const ids = focusReq.current;
        focusReq.current = [];
        for (const id of ids) document.getElementById(id)?.focus();
    }, [effectTick]);

    /* ---- Household directory ---- */
    const familiesRef = useRef<FamilyRow[]>([]);
    const [families, setFamilies] = useState<FamilyRow[]>([]);
    const [listView, setListView] = useState<ListView>({ k: 'initial' });
    const [familiesBadge, setFamiliesBadge] = useState('0');
    const [search, setSearch] = useState('');
    const [searchClear, setSearchClear] = useState<boolean | null>(null);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const loadFamilies = useCallback(async (searchQuery = '') => {
        try {
            const url = searchQuery ? `/api/families?search=${encodeURIComponent(searchQuery)}` : '/api/families';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Could not load households');
            const list = (await res.json()) as FamilyRow[];
            familiesRef.current = list;
            setFamilies(list);
            setFamiliesBadge(String(list.length));
            setListView(list.length === 0 ? { k: 'empty', q: searchQuery } : { k: 'list' });
        } catch (err) {
            console.error('Failed to load families:', err);
            setListView({ k: 'error' });
        }
    }, []);

    const onFamilySearchInput = (value: string) => {
        setSearch(value);
        const q = value.trim();
        setSearchClear(!!q);
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => loadFamilies(q), 250);
    };
    const clearFamilySearch = () => {
        setSearch('');
        setSearchClear(false);
        loadFamilies('');
    };

    /* ---- Create household ---- */
    const create = useForm(CREATE_DEFAULTS);
    const [createOpen, setCreateOpen] = useState(false);
    const [createSaving, setCreateSaving] = useState(false);
    const cfPhone = useValidatedField('phone', true);
    useEffect(() => {
        if (loggedInStudent) create.set('cfRoll', String(loggedInStudent.roll_number));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showCreateFamilyForm = () => {
        const list = familiesRef.current;
        const nextNo = list.length > 0 ? Math.max(...list.map((f) => f.family_no || 0)) + 1 : 1;
        create.setValues((f) => ({ ...f, cfFamilyNo: String(nextNo), ...(loggedInStudent ? { cfRoll: String(loggedInStudent.roll_number) } : {}) }));
        setCreateOpen(true);
        scrollLater('createFamilyCard');
        focusLater('cfHof');
    };
    const hideCreateFamilyForm = () => {
        setCreateOpen(false);
        create.reset();
    };

    /* ---- Workspace state (globals of the original script kept in refs where later awaits read them) ---- */
    const selectedFamilyIdRef = useRef<number | null>(null);
    const selectedMemberIdRef = useRef<number | null>(null);
    const memberDataRef = useRef<MemberDetail | null>(null);
    const [, setSelectedFamilyId] = useState<number | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [workspace, setWorkspace] = useState(false);
    const [loadStatus, setLoadStatus] = useState<{ text: string; shown: boolean }>({ text: '', shown: false });
    const [detailShown, setDetailShown] = useState(true);
    const [familyData, setFamilyData] = useState<FamilyDetail | null>(null);
    const [memberQuery, setMemberQuery] = useState('');
    const [memberClear, setMemberClear] = useState<boolean | null>(null);
    const [memberShown, setMemberShown] = useState(false);
    const [memberData, setMemberData] = useState<MemberDetail | null>(null);
    const [fuOpen, setFuOpen] = useState(false);

    const selectMember = useCallback(async (memberId: number) => {
        selectedMemberIdRef.current = memberId;
        setSelectedMemberId(memberId);
        setMemberShown(true);
        slideReq.current = true;
        setEffectTick((t) => t + 1);
        try {
            const res = await fetch(`/api/members/${memberId}`);
            const data = (await res.json()) as MemberDetail;
            memberDataRef.current = data;
            setMemberData(data);
        } catch (err) {
            console.error('Error fetching member:', err);
        }
    }, []);

    const closeMemberDetail = useCallback(() => {
        selectedMemberIdRef.current = null;
        setSelectedMemberId(null);
        memberDataRef.current = null;
        setMemberData(null);
        setMemberShown(false);
        setFuOpen(false);
    }, []);

    const selectFamily = useCallback(async (familyId: number, preselectMemberId: number | null = null) => {
        selectedFamilyIdRef.current = familyId;
        setSelectedFamilyId(familyId);
        selectedMemberIdRef.current = null;
        setSelectedMemberId(null);
        setCreateOpen(false);
        create.reset();
        setWorkspace(true);
        setDetailShown(false);
        setLoadStatus({ text: 'Loading household…', shown: true });
        focusLater('backToHouseholds');
        try {
            const res = await fetch(`/api/families/${familyId}`);
            if (!res.ok) throw new Error('Could not load household');
            const data = (await res.json()) as FamilyDetail;
            if (selectedFamilyIdRef.current !== familyId) return;
            setFamilyData(data);
            setLoadStatus((s) => ({ ...s, shown: false }));
            setDetailShown(true);
            setMemberQuery('');
            const members = data.members;
            if (preselectMemberId && members && members.some((m) => m.id === preselectMemberId)) selectMember(preselectMemberId);
            else if (members && members.length > 0) selectMember(members[0].id);
            else closeMemberDetail();
        } catch (err) {
            console.error('Error fetching family:', err);
            if (selectedFamilyIdRef.current !== familyId) return;
            setLoadStatus({ text: 'Could not load this household. Go back to households and try again.', shown: true });
        }
    }, [create, focusLater, selectMember, closeMemberDetail]);

    const showHouseholdList = () => {
        const previousId = selectedFamilyIdRef.current;
        selectedFamilyIdRef.current = null;
        setSelectedFamilyId(null);
        selectedMemberIdRef.current = null;
        setSelectedMemberId(null);
        setFamilyData(null);
        setWorkspace(false);
        focusLater(`familyCard_${previousId}`);
    };

    /* ---- Bootstrap ---- */
    useEffect(() => {
        fu.setValues((f) => ({ ...f, fuDate: isoToday() }));
        return runWhenActive(async () => {
            await loadFamilies();
            const autoFamId = new URLSearchParams(window.location.search).get('familyId');
            if (autoFamId) selectFamily((parseInt(autoFamId, 10) || autoFamId) as number);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---- Confirm dialog (showConfirm) ---- */
    const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: '⚠ Confirm Action', message: 'Are you sure you want to proceed?', okText: 'Confirm', danger: true });
    const confirmResolve = useRef<((ok: boolean) => void) | null>(null);
    const showConfirm = (title: string, message: string, okText = 'Confirm', danger = true) =>
        new Promise<boolean>((resolve) => {
            setConfirmState({ open: true, title, message, okText, danger });
            confirmResolve.current = resolve;
        });
    const answerConfirm = (ok: boolean) => {
        setConfirmState((s) => ({ ...s, open: false }));
        const r = confirmResolve.current;
        confirmResolve.current = null;
        r?.(ok);
    };

    const toast = (m: string, t: string) => showToast(m, t);
    const jsonFetch = async (url: string, method: string, body?: unknown) => {
        const res = await fetch(url, body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return res;
    };

    const submitCreateFamily = async () => {
        const f = create.values;
        const rollNumber = (f.cfRoll && f.cfRoll.trim()) || (loggedInStudent ? String(loggedInStudent.roll_number) : '235');
        const cleanContact = checkPhone(f.cfContactPhone, cfPhone, 'cfContactPhone', toast, focusLater);
        if (cleanContact === null) return;
        setCreateSaving(true);
        const payload = {
            roll_number: rollNumber,
            student_roll: rollNumber,
            student_id: loggedInStudent ? loggedInStudent.id : null,
            family_no: parseInt(f.cfFamilyNo, 10),
            head_of_family: f.cfHof.trim(),
            family_name: f.cfFamilyName.trim() || null,
            contact_phone: cleanContact || null,
            contact_number: cleanContact || null,
            village_ward: f.cfVillage.trim(),
            address: f.cfAddress.trim(),
            city: f.cfCity.trim() || null,
            pincode: f.cfPincode.trim() || null,
            total_cu: parseFloat(f.cfTotalCu) || 0,
            calorie_intake_per_cu: parseInt(f.cfCalorie) || 0,
            calorie_status: selectValue(OPT.calStatus, f.cfCalorieStatus),
            dietary_advice_given: selectValue(OPT.advice, f.cfAdvice),
            members: [],
        };
        try {
            const res = await jsonFetch('/api/families', 'POST', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create family');
            showToast(`Household #${payload.family_no} created successfully!`, 'success');
            hideCreateFamilyForm();
            const newId = data.family_id || (data.family && data.family.id);
            selectedFamilyIdRef.current = newId;
            await loadFamilies();
            if (newId) selectFamily(newId);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setCreateSaving(false);
        }
    };

    /* ---- Edit household ---- */
    const editFamily = useForm({});
    const [editFamilyOpen, setEditFamilyOpen] = useState(false);
    const [editFamilySaving, setEditFamilySaving] = useState(false);
    const efPhone = useValidatedField('phone', true);
    const openEditFamilyModal = () => {
        const d = familyData;
        if (!d) return;
        editFamily.setValues({
            efHof: d.head_of_family || '', efFamilyName: d.family_name || '', efContactPhone: d.contact_phone || d.contact_number || '',
            efVillage: d.village_ward || '', efAddress: d.address || '', efCity: d.city || '', efPincode: d.pincode || '',
            efTotalCu: String(d.total_cu || 0), efCalorie: String(d.calorie_intake_per_cu || 0),
            efCalorieStatus: d.calorie_status || 'Normal', efAdvice: d.dietary_advice_given || 'N',
        });
        setEditFamilyOpen(true);
    };
    const submitEditFamily = async () => {
        const famId = selectedFamilyIdRef.current;
        if (!famId) return;
        const f = editFamily.values;
        const cleanContact = checkPhone(f.efContactPhone, efPhone, 'efContactPhone', toast, focusLater);
        if (cleanContact === null) return;
        setEditFamilySaving(true);
        const payload = {
            head_of_family: f.efHof.trim(),
            family_name: f.efFamilyName.trim() || null,
            contact_phone: cleanContact || null,
            contact_number: cleanContact || null,
            village_ward: f.efVillage.trim(),
            address: f.efAddress.trim(),
            city: f.efCity.trim() || null,
            pincode: f.efPincode.trim() || null,
            total_cu: parseFloat(f.efTotalCu) || 0,
            calorie_intake_per_cu: parseInt(f.efCalorie) || 0,
            calorie_status: selectValue(OPT.calStatus, f.efCalorieStatus),
            dietary_advice_given: selectValue(OPT.advice, f.efAdvice),
        };
        try {
            const res = await jsonFetch(`/api/families/${famId}`, 'PUT', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update household');
            showToast('Household details updated', 'success');
            setEditFamilyOpen(false);
            await loadFamilies();
            selectFamily(selectedFamilyIdRef.current as number);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setEditFamilySaving(false);
        }
    };

    const confirmDeleteFamily = async () => {
        const famId = selectedFamilyIdRef.current;
        if (!famId) return;
        const fam = familiesRef.current.find((f) => f.id === famId);
        const name = fam ? fam.head_of_family : `Family #${famId}`;
        const confirmed = await showConfirm('Delete Household Record', `Are you sure you want to permanently delete "${name}" and all its members, conditions, and clinical records? This action cannot be undone.`, 'Delete Household', true);
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/families/${selectedFamilyIdRef.current}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete family');
            showToast('Household record deleted', 'info');
            showHouseholdList();
            await loadFamilies();
        } catch (err) {
            showToast(errMsg(err), 'error');
        }
    };

    /* ---- Member roster search ---- */
    const allMembers = familyData?.members || [];
    const mq = memberQuery.trim().toLowerCase();
    const shownMembers = memberQuery
        ? allMembers.filter((m) => (m.name && m.name.toLowerCase().includes(mq)) || (m.relation_to_hof && m.relation_to_hof.toLowerCase().includes(mq)) || (m.occupation && m.occupation.toLowerCase().includes(mq)) || (m.contact_number && m.contact_number.includes(mq)) || (m.conditions_summary && m.conditions_summary.toLowerCase().includes(mq)))
        : allMembers;

    const confirmDeleteMember = async () => {
        const cur = memberDataRef.current;
        if (!selectedMemberIdRef.current || !cur) return;
        const confirmed = await showConfirm('Delete Member Record', `Are you sure you want to permanently delete "${cur.name}" and all their clinical sub-entities (conditions, medications, allergies, history, and follow-ups)?`, 'Delete Member', true);
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/members/${selectedMemberIdRef.current}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete member');
            showToast('Member deleted successfully', 'info');
            selectedMemberIdRef.current = null;
            closeMemberDetail();
            await selectFamily(selectedFamilyIdRef.current as number);
        } catch (err) {
            showToast(errMsg(err), 'error');
        }
    };

    /* ---- Sub-entity CRUD (conditions / medications / allergies / history) ---- */
    const cond = useForm(COND_DEFAULTS);
    const med = useForm(MED_DEFAULTS);
    const alg = useForm(ALG_DEFAULTS);
    const hist = useForm(HIST_DEFAULTS);
    const [condModal, setCondModal] = useState({ open: false, title: '+ Add Medical Condition' });
    const [medModal, setMedModal] = useState({ open: false, title: '+ Add Medication' });
    const [algModal, setAlgModal] = useState({ open: false, title: '+ Add Allergy / Adverse Reaction' });
    const [histModal, setHistModal] = useState({ open: false, title: '+ Add Medical / Surgical History' });
    const [subSaving, setSubSaving] = useState<string | null>(null);

    const openAdd = (form: typeof cond, setModal: typeof setCondModal, title: string, focusId: string) => {
        if (!selectedMemberIdRef.current) return;
        form.reset();
        setModal({ open: true, title });
        focusLater(focusId);
    };

    const subSubmit = async (opts: {
        key: string; editId: string; urlEdit: string; urlAdd: string; payload: unknown; failMsg: string; okEdit: string; okAdd: string;
        close: () => void; refreshFamilies?: boolean;
    }) => {
        if (!selectedMemberIdRef.current) return;
        const isEdit = !!opts.editId;
        setSubSaving(opts.key);
        try {
            const res = await jsonFetch(isEdit ? opts.urlEdit : opts.urlAdd, isEdit ? 'PUT' : 'POST', opts.payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || opts.failMsg);
            showToast(isEdit ? opts.okEdit : opts.okAdd, 'success');
            opts.close();
            await selectMember(selectedMemberIdRef.current as number);
            if (opts.refreshFamilies) loadFamilies();
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSubSaving(null);
        }
    };

    const subDelete = async (title: string, message: string, url: string, failMsg: string, okMsg: string, refreshFamilies = false) => {
        const confirmed = await showConfirm(title, message, 'Delete', true);
        if (!confirmed) return;
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) throw new Error(failMsg);
            showToast(okMsg, 'info');
            await selectMember(selectedMemberIdRef.current as number);
            if (refreshFamilies) loadFamilies();
        } catch (err) {
            showToast(errMsg(err), 'error');
        }
    };

    const closeCond = () => { setCondModal((s) => ({ ...s, open: false })); cond.reset(); };
    const closeMed = () => { setMedModal((s) => ({ ...s, open: false })); med.reset(); };
    const closeAlg = () => { setAlgModal((s) => ({ ...s, open: false })); alg.reset(); };
    const closeHist = () => { setHistModal((s) => ({ ...s, open: false })); hist.reset(); };

    const openEditCondition = (id: number) => {
        const c = memberDataRef.current?.conditions?.find((x) => x.id === id);
        if (!c) return;
        cond.setValues({ condEditId: String(c.id), condName: inputValue(c.condition_name), condCategory: c.category || 'Other', condStatus: c.status || 'Active', condSeverity: c.severity || 'Moderate', condDate: c.diagnosis_date || '', condNotes: c.notes || '' });
        setCondModal({ open: true, title: '✏ Edit Medical Condition' });
    };
    const openEditMedication = (id: number) => {
        const m = memberDataRef.current?.medications?.find((x) => x.id === id);
        if (!m) return;
        med.setValues({ medEditId: String(m.id), medName: inputValue(m.medication_name), medDosage: m.dosage || '', medFrequency: m.frequency || 'OD (Once daily)', medRoute: m.route || 'Oral', medPrescribedFor: m.prescribed_for || '', medStartDate: m.start_date || '', medAdherence: m.adherence_status || 'Good' });
        setMedModal({ open: true, title: '✏ Edit Medication' });
    };
    const openEditAllergy = (id: number) => {
        const a = memberDataRef.current?.allergies?.find((x) => x.id === id);
        if (!a) return;
        alg.setValues({ algEditId: String(a.id), algAllergen: inputValue(a.allergen), algType: a.allergy_type || 'Drug', algSeverity: a.severity || 'Moderate', algReaction: a.reaction_description || '' });
        setAlgModal({ open: true, title: '✏ Edit Allergy' });
    };
    const openEditHistory = (id: number) => {
        const h = memberDataRef.current?.history?.find((x) => x.id === id);
        if (!h) return;
        hist.setValues({ histEditId: String(h.id), histType: h.event_type || 'Surgery', histDesc: inputValue(h.description), histDate: h.event_date || '', histFacility: h.facility_name || '', histNotes: h.outcome_notes || '' });
        setHistModal({ open: true, title: '✏ Edit Medical / Surgical History' });
    };

    const submitCondition = () => {
        const f = cond.values;
        return subSubmit({
            key: 'cond', editId: f.condEditId, urlEdit: `/api/conditions/${f.condEditId}`, urlAdd: `/api/members/${selectedMemberIdRef.current}/conditions`,
            payload: { condition_name: f.condName.trim(), category: selectValue(OPT.condCategory, f.condCategory), status: selectValue(OPT.condStatus, f.condStatus), severity: selectValue(OPT.severity3, f.condSeverity), diagnosis_date: f.condDate || null, notes: f.condNotes.trim() || null },
            failMsg: 'Failed to save condition', okEdit: 'Condition updated', okAdd: 'Condition recorded', close: closeCond, refreshFamilies: true,
        });
    };
    const submitMedication = () => {
        const f = med.values;
        return subSubmit({
            key: 'med', editId: f.medEditId, urlEdit: `/api/medications/${f.medEditId}`, urlAdd: `/api/members/${selectedMemberIdRef.current}/medications`,
            payload: { medication_name: f.medName.trim(), dosage: f.medDosage.trim() || null, frequency: selectValue(OPT.medFreq, f.medFrequency), route: selectValue(OPT.medRoute, f.medRoute), prescribed_for: f.medPrescribedFor.trim() || null, start_date: f.medStartDate || null, adherence_status: selectValue(OPT.medAdherence, f.medAdherence) },
            failMsg: 'Failed to save medication', okEdit: 'Medication updated', okAdd: 'Medication added', close: closeMed,
        });
    };
    const submitAllergy = () => {
        const f = alg.values;
        return subSubmit({
            key: 'alg', editId: f.algEditId, urlEdit: `/api/allergies/${f.algEditId}`, urlAdd: `/api/members/${selectedMemberIdRef.current}/allergies`,
            payload: { allergen: f.algAllergen.trim(), allergy_type: selectValue(OPT.algType, f.algType), severity: selectValue(OPT.algSeverity, f.algSeverity), reaction_description: f.algReaction.trim() || null },
            failMsg: 'Failed to save allergy', okEdit: 'Allergy updated', okAdd: 'Allergy recorded', close: closeAlg,
        });
    };
    const submitHistory = () => {
        const f = hist.values;
        return subSubmit({
            key: 'hist', editId: f.histEditId, urlEdit: `/api/history/${f.histEditId}`, urlAdd: `/api/members/${selectedMemberIdRef.current}/history`,
            payload: { event_type: selectValue(OPT.histType, f.histType), description: f.histDesc.trim(), event_date: f.histDate.trim() || null, facility_name: f.histFacility.trim() || null, outcome_notes: f.histNotes.trim() || null },
            failMsg: 'Failed to save history', okEdit: 'History entry updated', okAdd: 'History entry recorded', close: closeHist,
        });
    };

    /* ---- Lifestyle ---- */
    const ls = useForm(LS_DEFAULTS);
    const [lsOpen, setLsOpen] = useState(false);
    const openEditLifestyleModal = () => {
        if (!selectedMemberIdRef.current) return;
        const l: Lifestyle = memberDataRef.current?.lifestyle || {};
        ls.setValues({
            lsSmoking: l.smoking_status || 'Never', lsSmokingFreq: l.smoking_frequency || '', lsAlcohol: l.alcohol_consumption || 'Never', lsDiet: l.diet_type || 'Vegetarian',
            lsPhysical: l.physical_activity_level || 'Moderate', lsSalt: l.salt_intake || 'Normal', lsSleep: String(l.sleep_hours_per_night || ''), lsNotes: l.notes || '',
        });
        setLsOpen(true);
    };
    const closeLs = () => { setLsOpen(false); ls.reset(); };
    const submitLifestyle = async () => {
        if (!selectedMemberIdRef.current) return;
        const f = ls.values;
        const payload = {
            smoking_status: selectValue(OPT.smoking, f.lsSmoking), smoking_frequency: f.lsSmokingFreq.trim() || null, alcohol_consumption: selectValue(OPT.alcohol, f.lsAlcohol),
            physical_activity_level: selectValue(OPT.physical, f.lsPhysical), diet_type: selectValue(OPT.diet, f.lsDiet), sleep_hours_per_night: parseFloat(f.lsSleep) || null,
            salt_intake: selectValue(OPT.salt, f.lsSalt), notes: f.lsNotes.trim() || null,
        };
        setSubSaving('ls');
        try {
            const res = await jsonFetch(`/api/members/${selectedMemberIdRef.current}/lifestyle`, 'POST', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save lifestyle');
            showToast('Lifestyle profile saved', 'success');
            closeLs();
            await selectMember(selectedMemberIdRef.current as number);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSubSaving(null);
        }
    };

    /* ---- Follow-ups ---- */
    const fu = useForm(FU_DEFAULTS);
    const [fuSaving, setFuSaving] = useState(false);
    const toggleFollowUpForm = () => {
        if (!selectedMemberIdRef.current) {
            showToast('Please select a household member first before logging a follow-up visit', 'warning');
            return;
        }
        const open = !fuOpen;
        setFuOpen(open);
        if (open) scrollLater('followUpFormContainer');
    };
    const submitFollowUp = async () => {
        if (!selectedMemberIdRef.current) return;
        setFuSaving(true);
        const f = fu.values;
        const payload = {
            student_id: loggedInStudent ? loggedInStudent.id : 1,
            roll_number: loggedInStudent ? loggedInStudent.roll_number : '235',
            visit_date: f.fuDate,
            sbp: parseInt(f.fuSbp) || null,
            dbp: parseInt(f.fuDbp) || null,
            rbs: parseFloat(f.fuRbs) || null,
            hb: parseFloat(f.fuHb) || null,
            weight_kg: parseFloat(f.fuWeight) || null,
            treatment_compliance: selectValue(OPT.compliance, f.fuCompliance),
            health_progress: selectValue(OPT.progress, f.fuProgress),
            clinical_notes: f.fuNotes.trim(),
            next_visit_date: f.fuNextDate || null,
        };
        try {
            const res = await jsonFetch(`/api/members/${selectedMemberIdRef.current}/follow-ups`, 'POST', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save follow-up');
            showToast('Follow-up visit logged', 'success');
            fu.setValues({ ...FU_DEFAULTS, fuDate: isoToday() });
            toggleFollowUpForm();
            selectMember(selectedMemberIdRef.current as number);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setFuSaving(false);
        }
    };

    /* ---- Edit member ---- */
    const em = useForm({});
    const [emOpen, setEmOpen] = useState(false);
    const [emSaving, setEmSaving] = useState(false);
    const emPhone = useValidatedField('phone', true);
    const openEditMemberModal = () => {
        const m = memberDataRef.current;
        if (!m) return;
        em.setValues({
            emName: m.name || '', emRelation: m.relation_to_hof || 'Head of Family', emGender: m.gender || 'M', emDob: m.date_of_birth || '',
            emAgeYears: String(m.age_years || 0), emAgeMonths: String(m.age_months || 0), emMaritalStatus: m.marital_status || 'Married',
            emEducation: m.education_level || 'Secondary', emOccupation: m.occupation || '', emContact: m.contact_number || '', emWork: m.work_type || 'Moderate',
        });
        setEmOpen(true);
    };
    const onEditDob = (v: string) => {
        em.set('emDob', v);
        if (!v) return;
        const { age } = ageFromDob(v);
        if (age >= 0) em.set('emAgeYears', String(age));
    };
    const submitEditMember = async () => {
        if (!selectedMemberIdRef.current) return;
        const f = em.values;
        const cleanContact = checkPhone(f.emContact, emPhone, 'emContact', toast, focusLater);
        if (cleanContact === null) return;
        setEmSaving(true);
        const payload = {
            name: f.emName.trim(),
            relation_to_hof: selectValue(OPT.relation, f.emRelation),
            gender: selectValue(OPT.gender, f.emGender),
            date_of_birth: f.emDob || null,
            age_years: parseInt(f.emAgeYears, 10),
            age_months: parseInt(f.emAgeMonths || '0', 10),
            marital_status: selectValue(OPT.marital, f.emMaritalStatus),
            education_level: selectValue(OPT.education, f.emEducation),
            occupation: f.emOccupation.trim() || null,
            contact_number: cleanContact || null,
            work_type: selectValue(OPT.work, f.emWork),
        };
        try {
            const res = await jsonFetch(`/api/members/${selectedMemberIdRef.current}`, 'PUT', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update member');
            showToast('Member profile updated', 'success');
            setEmOpen(false);
            await selectFamily(selectedFamilyIdRef.current as number);
            selectMember(selectedMemberIdRef.current as unknown as number);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setEmSaving(false);
        }
    };

    const openInDataEntry = () => {
        if (!selectedFamilyIdRef.current) return;
        const targetMember = selectedMemberIdRef.current ? `&memberId=${selectedMemberIdRef.current}` : '';
        window.location.href = `/entry.html?familyId=${selectedFamilyIdRef.current}${targetMember}`;
    };

    /* ---- Add member + draft recovery ---- */
    const add = useForm(ADD_DEFAULTS);
    const [addOpen, setAddOpen] = useState(false);
    const [familyNoLabel, setFamilyNoLabel] = useState('');
    const [draftAlert, setDraftAlert] = useState(false);
    const [addSaving, setAddSaving] = useState<'save' | 'another' | null>(null);
    const modalPhone = useValidatedField('phone', true);
    const draftKey = () => `medpulse_member_draft_${selectedFamilyIdRef.current}`;

    const saveDraft = (f: FormValues) => {
        if (!selectedFamilyIdRef.current) return;
        const draft = {
            name: f.modalMName, relation: selectValue(OPT.relation, f.modalMRelation), gender: selectValue(OPT.gender, f.modalMGender), dob: f.modalMDob,
            ageYears: f.modalMAgeYears, ageMonths: f.modalMAgeMonths, marital: selectValue(OPT.marital, f.modalMMaritalStatus),
            education: selectValue(OPT.education, f.modalMEducation), occupation: f.modalMOccupation, contact: f.modalMContact, work: selectValue(OPT.work, f.modalMWork),
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey(), JSON.stringify(draft));
    };
    const onAddInput = (patch: FormValues) => {
        const next = { ...add.values, ...patch };
        saveDraft(next);
        if ('modalMDob' in patch && patch.modalMDob) {
            const { age, months } = ageFromDob(patch.modalMDob);
            if (age >= 0) {
                next.modalMAgeYears = String(age);
                if (age < 2) next.modalMAgeMonths = String(Math.max(0, months));
            }
        }
        add.setValues(next);
    };

    const checkMemberDraft = () => {
        if (!selectedFamilyIdRef.current) return;
        const draftStr = localStorage.getItem(draftKey());
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr);
                if (draft.name || draft.dob || draft.ageYears) {
                    setDraftAlert(true);
                    return;
                }
            } catch {
                /* ignore */
            }
        }
        setDraftAlert(false);
    };
    const openAddMemberModal = () => {
        const famId = selectedFamilyIdRef.current;
        if (!famId) { showToast('Please select a household first', 'error'); return; }
        const fam = familiesRef.current.find((f) => f.id === famId);
        setFamilyNoLabel(String(fam ? fam.family_no : famId));
        setAddOpen(true);
        checkMemberDraft();
        focusLater('modalMName');
    };
    const closeAddMemberModal = () => {
        setAddOpen(false);
        add.reset();
        setDraftAlert(false);
    };
    const restoreMemberDraft = () => {
        if (!selectedFamilyIdRef.current) return;
        const draftStr = localStorage.getItem(draftKey());
        if (!draftStr) return;
        try {
            const d = JSON.parse(draftStr);
            const f = { ...add.values };
            if (d.name) f.modalMName = d.name;
            if (d.relation) f.modalMRelation = d.relation;
            if (d.gender) f.modalMGender = d.gender;
            if (d.dob) f.modalMDob = d.dob;
            if (d.ageYears) f.modalMAgeYears = d.ageYears;
            if (d.ageMonths) f.modalMAgeMonths = d.ageMonths;
            if (d.marital) f.modalMMaritalStatus = d.marital;
            if (d.education) f.modalMEducation = d.education;
            if (d.occupation) f.modalMOccupation = d.occupation;
            if (d.contact) f.modalMContact = d.contact;
            if (d.work) f.modalMWork = d.work;
            add.setValues(f);
            setDraftAlert(false);
            showToast('Member draft restored', 'info');
        } catch {
            /* ignore */
        }
    };
    const discardMemberDraft = () => {
        if (!selectedFamilyIdRef.current) return;
        localStorage.removeItem(draftKey());
        setDraftAlert(false);
        add.reset();
        showToast('Draft discarded', 'info');
    };

    const submitNewMember = async (addAnother: boolean) => {
        if (!selectedFamilyIdRef.current) return;
        const f = add.values;
        const memberName = f.modalMName.trim();
        if (!memberName) {
            showToast('Member full name is required', 'error');
            focusLater('modalMName');
            return;
        }
        const cleanContact = checkPhone(f.modalMContact, modalPhone, 'modalMContact', toast, focusLater);
        if (cleanContact === null) return;
        const payload = {
            name: memberName,
            relation_to_hof: selectValue(OPT.relation, f.modalMRelation),
            gender: selectValue(OPT.gender, f.modalMGender),
            date_of_birth: f.modalMDob || null,
            age_years: parseInt(f.modalMAgeYears, 10) || 0,
            age_months: parseInt(f.modalMAgeMonths || '0', 10),
            marital_status: selectValue(OPT.marital, f.modalMMaritalStatus),
            education_level: selectValue(OPT.education, f.modalMEducation),
            occupation: f.modalMOccupation.trim() || null,
            contact_number: cleanContact || null,
            work_type: selectValue(OPT.work, f.modalMWork),
        };
        setAddSaving(addAnother ? 'another' : 'save');
        try {
            const res = await jsonFetch(`/api/families/${selectedFamilyIdRef.current}/members`, 'POST', payload);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add member');
            localStorage.removeItem(draftKey());
            setDraftAlert(false);
            showToast(`Member "${payload.name}" saved!`, 'success');
            if (addAnother) {
                add.reset();
                focusLater('modalMName');
                await selectFamily(selectedFamilyIdRef.current as number);
            } else {
                closeAddMemberModal();
                await selectFamily(selectedFamilyIdRef.current as number);
                selectMember(data.member.id);
            }
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setAddSaving(null);
        }
    };

    /* ---- Provision patient account ---- */
    const prov = useForm(PROV_DEFAULTS);
    const [provOpen, setProvOpen] = useState(false);
    const [provHeader, setProvHeader] = useState('-');
    const [provResult, setProvResult] = useState<ProvisionResult | null>(null);
    const [provSaving, setProvSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const openProvisionModalForCurrentMember = () => {
        const m = memberDataRef.current;
        if (!selectedMemberIdRef.current || !m) {
            showToast('Please select a family member first', 'info');
            return;
        }
        prov.setValues({ provMemberId: String(m.id), provPatientName: m.name ?? '', provPhone: (m.contact_number || m.contact_phone || '').replace(/[^0-9]/g, ''), provPin: '1234' });
        setProvHeader(m.name ?? '');
        setProvResult(null);
        setProvSaving(false);
        setProvOpen(true);
    };
    const submitProvisionAccount = async () => {
        const f = prov.values;
        const memberId = f.provMemberId;
        const name = f.provPatientName.trim();
        const phone = f.provPhone.trim();
        const pin = f.provPin.trim();
        if (!memberId) { showToast('No member selected', 'error'); return; }
        if (!name) { showToast('Patient name is required', 'error'); return; }
        setProvSaving(true);
        try {
            const res = await jsonFetch('/api/students/provision-patient', 'POST', { member_id: memberId, name, phone, pin });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to provision patient account');
            setProvResult({
                message: data.message || 'Account successfully generated and linked!',
                name: data.name || name, uid: data.patient_uid || '-', phone: data.phone || '-', pin: data.pin || pin || '1234',
                url: `${window.location.origin}/login.html?patient=1`,
            });
            showToast(data.message || 'Patient account ready!', 'success');
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setProvSaving(false);
        }
    };
    const copyProvisionCredentials = () => {
        const r = provResult;
        const url = `${window.location.origin}/login.html?patient=1`;
        const text = `🏥 MedPulse Patient Health Portal Access\n\nPatient: ${r ? r.name : '-'}\nPatient UID: ${r ? r.uid : '-'}\nLogin Phone: ${r ? r.phone : '-'}\nAccess PIN: ${r ? r.pin : '1234'}\nPortal Link: ${url}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            showToast('Credentials copied to clipboard!', 'success');
            setTimeout(() => setCopied(false), 2500);
        }).catch(() => {
            showToast('Unable to copy automatically. Please copy manually.', 'info');
        });
    };

    /* ---- Render ---- */
    const ck = fieldKit(create.values, create.set);
    const fk = fieldKit(fu.values, fu.set);
    const d = familyData;
    const m = memberData;
    const chip = (id: string, label: string, n: number) => (
        <div className={`summary-chip ${n > 0 ? 'has-items' : ''}`} id={id}>{label}: <strong>{n}</strong></div>
    );

    const landingList = () => {
        if (listView.k === 'initial') {
            return (
                <div className="empty-state" style={{ padding: '1.5rem 0.5rem', width: '100%' }}>
                    <div className="empty-state-icon">📂</div>
                    <h3>No Families Yet</h3>
                    <p style={{ marginBottom: '0.75rem' }}>No families recorded. Click "+ Add New Family" to create your first household.</p>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={showCreateFamilyForm}>+ Add New Family</button>
                </div>
            );
        }
        if (listView.k === 'error') {
            return <p role="alert">Households could not be loaded. <button className="btn btn-secondary" onClick={() => loadFamilies()}>Try again</button></p>;
        }
        if (listView.k === 'empty') {
            const q = listView.q;
            return (
                <div className="empty-state" style={{ padding: '2rem 0.5rem', width: '100%' }}>
                    <div className="empty-state-icon">📂</div>
                    <h3>{q ? 'No Results Found' : 'No Families Yet'}</h3>
                    <p style={{ marginBottom: '1rem' }}>{q ? `No households match "${q}". Try a different term.` : 'Click "+ Add New Family" to create your first household.'}</p>
                    {q
                        ? <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={clearFamilySearch}>Clear Search</button>
                        : <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={showCreateFamilyForm}>+ Add New Family</button>}
                </div>
            );
        }
        return families.map((f) => (
            <button type="button" className="household-name" id={`familyCard_${f.id}`} key={f.id} onClick={() => selectFamily(f.id)}>
                {f.family_name || f.head_of_family || `Household ${f.family_no}`}
            </button>
        ));
    };

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="families" onToggle={standardSidebar.toggle}
                badge={loggedInStudent ? <StudentBadge roll={String(loggedInStudent.roll_number)} mode="profile" onLogout={logoutToLogin} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />

            <main className="main-content">
                <div id="globalAlert" style={{ display: 'none' }} />

                <div className="page-header anim-fade-up">
                    <div>
                        <span className="families-eyebrow">Student workspace</span>
                        <h1 className="page-title">Families</h1>
                        <p className="page-subtitle">Add a family or choose a household to view its details.</p>
                    </div>
                </div>

                <div id="familyLanding" style={workspace ? { display: 'none' } : { display: 'block' }}>
                    <section className="card family-add-section" aria-labelledby="addFamilyHeading">
                        <div>
                            <h2 id="addFamilyHeading">Add family</h2>
                            <p>Register a household to begin recording its care.</p>
                        </div>
                        <button className="btn btn-primary" onClick={showCreateFamilyForm}>+ Add family</button>
                    </section>

                    <div className="card" id="createFamilyCard" style={{ display: createOpen ? 'block' : 'none', border: '1px solid var(--primary-border)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h2 className="card-title" style={{ color: 'var(--primary)', marginBottom: '0' }}>Register household</h2>
                            <button className="btn btn-secondary" onClick={hideCreateFamilyForm} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>✕ Close</button>
                        </div>
                        <p className="card-desc">Enter identification and geographic details for the household. Once created, you can immediately add individual members and structured health profiles.</p>

                        <form id="createFamilyForm" onSubmit={(e) => { e.preventDefault(); submitCreateFamily(); }}>
                            <div className="form-grid">
                                {ck.inp('cfRoll', 'Cadet Roll Number (Authenticated) *', { readOnly: true, style: { background: 'rgba(109, 40, 217, 0.05)', color: 'var(--accent)', fontWeight: 700, cursor: 'not-allowed' }, title: 'Locked to authenticated student account' })}
                                {ck.inp('cfFamilyNo', 'Family Number *', { type: 'number', min: '1', required: true, placeholder: 'e.g. 1' })}
                                {ck.inp('cfHof', 'Head of Family (HOF) Name *', { required: true, placeholder: 'Full name of HOF' })}
                                {ck.inp('cfFamilyName', 'Family Name / Household Label', { placeholder: 'e.g. Patel Household' })}
                                {ck.phone('cfContactPhone', 'Contact Phone Number', cfPhone, { placeholder: 'e.g. 9876543210' })}
                                {ck.inp('cfVillage', 'Village / Ward Area *', { required: true, placeholder: 'e.g. RHTC Field Area - Ward 4' })}
                                {ck.inp('cfAddress', 'House / Street Address', { placeholder: 'e.g. Plot 12, Main Vas' })}
                                {ck.inp('cfCity', 'City / Town', { placeholder: 'e.g. Ahmedabad' })}
                                {ck.inp('cfPincode', 'Pincode', { placeholder: 'e.g. 380001' })}
                                {ck.inp('cfTotalCu', 'Total Family CU', { type: 'number', step: '0.1', placeholder: 'e.g. 4.0' })}
                                {ck.inp('cfCalorie', 'Daily Calorie Intake (kcal/CU/Day)', { type: 'number', placeholder: 'e.g. 12000' })}
                                {ck.sel('cfCalorieStatus', 'Calorie Adequacy Status', OPT.calStatus)}
                                {ck.sel('cfAdvice', 'Dietary Advice Given?', OPT.advice)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={hideCreateFamilyForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary" id="createFamilyBtn" disabled={createSaving}>{createSaving ? 'Saving...' : 'Save household'}</button>
                            </div>
                        </form>
                    </div>

                    <div className="family-horizontal-bar anim-fade-up anim-delay-1">
                        <div className="household-directory-header">
                            <div className="household-directory-title">
                                <h2>Family households</h2>
                                <span className="household-count" id="familiesBadge" aria-label="Household count">{familiesBadge}</span>
                            </div>
                            <div className="search-wrapper household-search">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
                                <input type="search" id="familySearchInput" className="search-input" aria-label="Search households" placeholder="Search households" value={search} onChange={(e) => onFamilySearchInput(e.target.value)} />
                                <button className="search-clear-btn" id="familySearchClear" aria-label="Clear search" onClick={clearFamilySearch} style={searchClear === null ? undefined : { display: searchClear ? 'block' : 'none' }}>✕</button>
                            </div>
                        </div>

                        <div id="familyListContainer" className="household-name-list">{landingList()}</div>
                    </div>
                </div>

                <div id="familyWorkspace" style={{ display: workspace ? 'block' : 'none' }}>
                    <button type="button" id="backToHouseholds" className="btn btn-secondary" onClick={showHouseholdList} style={{ marginBottom: '1rem' }}>← Back to households</button>
                    <p id="familyLoadStatus" role="status" style={{ display: loadStatus.shown ? 'block' : 'none' }}>{loadStatus.text}</p>
                    <div id="familyDetailContent" style={detailShown ? { display: 'block' } : { display: 'none' }}>
                        <div className="fm-top-grid anim-fade-up anim-delay-2">
                            <div className="card fm-household-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span className="badge badge-info" id="fWorkspaceCode" style={{ fontSize: '0.85rem', padding: '0.35rem 0.65rem' }}>{d ? d.family_code || `FAM-${String(d.family_no).padStart(4, '0')}` : 'FAM-0001'}</span>
                                        <div>
                                            <h2 id="fWorkspaceTitle" className="card-title" style={{ color: 'var(--primary)', fontSize: '1.3rem', marginBottom: '0.15rem' }}>{d ? (d.family_name ? `${d.family_name} (${d.head_of_family})` : d.head_of_family) : '-'}</h2>
                                            <div id="fSubhead" style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{d ? `${d.village_ward || '-'} • ${d.members ? d.members.length : 0} Members Recorded` : ''}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button className="btn btn-secondary" onClick={openEditFamilyModal} title="Edit household identification and address" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}>✏ Edit Household</button>
                                        <button className="btn btn-primary" onClick={openAddMemberModal} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>➕ Add Member</button>
                                        <button className="btn btn-danger" onClick={confirmDeleteFamily} title="Delete this family and all its members" style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }}>🗑 Delete</button>
                                    </div>
                                </div>

                                <div className="fm-household-meta-grid">
                                    <div><span className="fm-meta-label">Head of Family</span><strong id="fHead">{d ? d.head_of_family : '-'}</strong></div>
                                    <div><span className="fm-meta-label">Contact Phone</span><span id="fPhone">{d ? d.contact_phone || d.contact_number || 'None recorded' : '-'}</span></div>
                                    <div><span className="fm-meta-label">Location</span><span id="fLocation">{d ? [d.address, d.city, d.village_ward, d.pincode].filter(Boolean).join(', ') || '-' : '-'}</span></div>
                                    <div><span className="fm-meta-label">Surveyed By</span><span id="fStudent">{d ? `Roll ${d.roll_number || '-'}` : '-'}</span></div>
                                    <div><span className="fm-meta-label">Total Family CU</span><strong id="fCu">{d ? String(d.total_cu || 0) : '-'}</strong></div>
                                    <div><span className="fm-meta-label">Caloric Status</span><span id="fCalorie">{d ? <span className={`badge ${d.calorie_status === 'Deficient' ? 'badge-danger' : 'badge-success'}`}>{`${d.calorie_status} (${Math.round(Number(d.calorie_intake_per_cu || 0))} kcal)`}</span> : '-'}</span></div>
                                </div>
                            </div>

                            <div className="card fm-members-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h2 className="card-title" style={{ marginBottom: '0', fontSize: '1.15rem' }}>Members (<span id="memberCountHeader">{d ? (d.members ? d.members.length : 0) : 0}</span>)</h2>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select a member to view profile below</span>
                                    </div>
                                    <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }} onClick={openAddMemberModal}>+ Add Member</button>
                                </div>

                                <div className="search-wrapper" style={{ marginBottom: '0.6rem' }}>
                                    <input
                                        type="text" id="memberSearchInput" className="search-input" placeholder="🔍 Filter members by name, relation..." value={memberQuery}
                                        onChange={(e) => { setMemberQuery(e.target.value); if (familyData && familyData.members) setMemberClear(!!e.target.value.trim()); }}
                                    />
                                    <button className="search-clear-btn" id="memberSearchClear" onClick={() => { setMemberQuery(''); setMemberClear(false); }} style={memberClear === null ? undefined : { display: memberClear ? 'block' : 'none' }}>✕</button>
                                </div>

                                <div id="membersListContainer" className="member-cards-grid">
                                    {d
                                        ? <MemberCards members={shownMembers} selectedId={selectedMemberId} onSelect={selectMember} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No members in this family yet. Click "➕ Add Member" above to add one.</div>}
                                </div>
                            </div>
                        </div>

                        <div className="fm-bottom-section anim-fade-up anim-delay-3">
                            <div className="card fm-no-member-card" id="noMemberSelectedCard" style={memberShown ? { display: 'none' } : { display: 'block' }}>
                                <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
                                    <div className="empty-state-icon" style={{ fontSize: '2.75rem', marginBottom: '0.75rem' }}>👤</div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>No Member Selected</h3>
                                    <p style={{ color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 1.25rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
                                        Click on any member card in the household roster above to inspect their clinical profile, recorded medical conditions, active prescriptions, allergies, past history, and longitudinal follow-up examination visits.
                                    </p>
                                    <button className="btn btn-primary" onClick={openAddMemberModal}>➕ Add Member to Household</button>
                                </div>
                            </div>

                            <div className="card fm-member-detail-card" id="memberDetailCard" style={{ display: memberShown ? 'block' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div>
                                        <h2 id="detailMemberName" style={{ color: 'var(--primary)', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.2rem' }}>{m ? m.name : '-'}</h2>
                                        <div id="detailMemberMeta" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            {m ? `${m.relation_to_hof} • ${m.age_years} yrs (${m.gender}) • ${m.marital_status || 'Married'} • ${m.occupation || 'Occupation: Not specified'}` : '-'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button className="btn btn-secondary" onClick={openEditMemberModal} style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>✏ Edit Info</button>
                                        <button className="btn btn-primary" onClick={openProvisionModalForCurrentMember} style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', background: 'linear-gradient(135deg, #0d9488, #2563eb)', border: 'none', color: 'white' }} title="Provision or inspect Patient Health Portal credentials">📱 Provision Patient Account</button>
                                        <button className="btn btn-danger" onClick={confirmDeleteMember} title="Delete this member record" style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>🗑 Delete</button>
                                        <button className="btn btn-secondary" onClick={closeMemberDetail} style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>✕ Close</button>
                                    </div>
                                </div>

                                <div className="summary-chips-row">
                                    {chip('chipConditions', '🏷 Conditions', m?.conditions?.length || 0)}
                                    {chip('chipMedications', '💊 Medications', m?.medications?.length || 0)}
                                    {chip('chipAllergies', '⚠ Allergies', m?.allergies?.length || 0)}
                                    {chip('chipHistory', '📜 History', m?.history?.length || 0)}
                                    {chip('chipFollowUps', '🩺 Visits', m?.follow_ups?.length || 0)}
                                </div>

                                <div className="fm-subentities-grid">
                                    <div className="sub-entity-card full-width">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">📋 Demographics &amp; Socio-Economic Profile</span>
                                        </div>
                                        <div id="detailDemographicsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', fontSize: '0.825rem' }}>
                                            {m ? <Demographics m={m} /> : null}
                                        </div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">📝 Field Survey &amp; Baseline Vitals</span>
                                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }} onClick={openInDataEntry}>
                                                Open in Data Entry →
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                                            Full clinical screening (NCDs, blood pressure, sugar, pediatric growth, maternal care, and ICMR units) is managed on the <strong>Data Entry</strong> page.
                                        </p>
                                        <div id="detailVitalsGrid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.65rem' }}>{m ? <Vitals m={m} /> : null}</div>
                                        <div id="baselineDetailsContent" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>{m ? <Baseline m={m} /> : null}</div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">🩺 Medical Conditions &amp; Diagnoses</span>
                                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }} onClick={() => openAdd(cond, setCondModal, '+ Add Medical Condition', 'condName')}>+ Add Condition</button>
                                        </div>
                                        <div id="conditionsListContainer" className="sub-entity-list">
                                            {m
                                                ? <ConditionsList items={m.conditions || []} onEdit={openEditCondition} onDelete={(id) => subDelete('Delete Condition', 'Are you sure you want to remove this medical condition record?', `/api/conditions/${id}`, 'Failed to delete condition', 'Condition removed', true)} />
                                                : <div style={muted}>No conditions recorded for this member.</div>}
                                        </div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">💊 Current Medications &amp; Adherence</span>
                                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }} onClick={() => openAdd(med, setMedModal, '+ Add Medication', 'medName')}>+ Add Medication</button>
                                        </div>
                                        <div id="medicationsListContainer" className="sub-entity-list">
                                            {m
                                                ? <MedicationsList items={m.medications || []} onEdit={openEditMedication} onDelete={(id) => subDelete('Delete Medication', 'Are you sure you want to remove this medication entry?', `/api/medications/${id}`, 'Failed to delete medication', 'Medication removed')} />
                                                : <div style={muted}>No medications recorded for this member.</div>}
                                        </div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">⚠ Allergies &amp; Adverse Drug Reactions</span>
                                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }} onClick={() => openAdd(alg, setAlgModal, '+ Add Allergy', 'algAllergen')}>+ Add Allergy</button>
                                        </div>
                                        <div id="allergiesListContainer" className="sub-entity-list">
                                            {m
                                                ? <AllergiesList items={m.allergies || []} onEdit={openEditAllergy} onDelete={(id) => subDelete('Delete Allergy', 'Are you sure you want to remove this allergy record?', `/api/allergies/${id}`, 'Failed to delete allergy', 'Allergy removed')} />
                                                : <div style={muted}>No allergies recorded for this member.</div>}
                                        </div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">📜 Past Medical &amp; Surgical History</span>
                                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }} onClick={() => openAdd(hist, setHistModal, '+ Add Medical / Surgical History', 'histDesc')}>+ Add History</button>
                                        </div>
                                        <div id="historyListContainer" className="sub-entity-list">
                                            {m
                                                ? <HistoryList items={m.history || []} onEdit={openEditHistory} onDelete={(id) => subDelete('Delete History Record', 'Are you sure you want to remove this history entry?', `/api/history/${id}`, 'Failed to delete history', 'History entry removed')} />
                                                : <div style={muted}>No surgical or past medical events recorded.</div>}
                                        </div>
                                    </div>

                                    <div className="sub-entity-card">
                                        <div className="sub-entity-header">
                                            <span className="sub-entity-title">🏃 Lifestyle, Habits &amp; Risk Factors</span>
                                            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }} onClick={openEditLifestyleModal}>✏ Edit Lifestyle</button>
                                        </div>
                                        <div id="lifestyleContent" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.825rem' }}>
                                            {m ? <LifestyleView lifestyle={m.lifestyle} /> : <div style={{ color: 'var(--text-muted)' }}>No lifestyle information recorded yet.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card fm-bottom-followup" id="followUpWorkspaceCard" style={{ display: memberShown ? 'block' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem' }}>
                                        🩺
                                    </div>
                                    <div>
                                        <h2 className="card-title" style={{ marginBottom: '0.15rem', fontSize: '1.25rem' }}>
                                            Longitudinal Follow-up Visits — <span id="fuTargetMemberName" style={{ color: 'var(--primary)' }}>{m ? m.name : 'No Member Selected'}</span>
                                        </h2>
                                        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                                            Chronological examination visits, blood pressure/sugar control, medication compliance, and clinical progress
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span className="badge badge-info" id="fuVisitsCountBadge">{`${m && m.follow_ups ? m.follow_ups.length : 0} Visits Recorded`}</span>
                                    <button className="btn btn-success" id="btnLogFollowUp" style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }} onClick={toggleFollowUpForm}>
                                        + Log New Visit
                                    </button>
                                </div>
                            </div>

                            <div id="followUpFormContainer" style={{ display: fuOpen ? 'block' : 'none', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#166534', marginBottom: '0.85rem' }}>
                                    Record Follow-Up Examination Visit
                                </h3>
                                <form id="followUpForm" onSubmit={(e) => { e.preventDefault(); submitFollowUp(); }}>
                                    <div className="form-grid">
                                        {fk.inp('fuDate', 'Visit Date *', { type: 'date', required: true })}
                                        {fk.inp('fuSbp', 'Follow-up SBP (mmHg)', { type: 'number', placeholder: 'e.g. 130' })}
                                        {fk.inp('fuDbp', 'Follow-up DBP (mmHg)', { type: 'number', placeholder: 'e.g. 80' })}
                                        {fk.inp('fuRbs', 'Follow-up RBS (mg/dl)', { type: 'number', placeholder: 'e.g. 120' })}
                                        {fk.inp('fuHb', 'Follow-up Hb (g/dl)', { type: 'number', step: '0.1', placeholder: 'e.g. 10.5' })}
                                        {fk.inp('fuWeight', 'Follow-up Weight (kg)', { type: 'number', step: '0.5', placeholder: 'e.g. 58.0' })}
                                        {fk.sel('fuCompliance', 'Treatment Compliance', OPT.compliance)}
                                        {fk.sel('fuProgress', 'Clinical Health Progress', OPT.progress)}
                                        {fk.inp('fuNextDate', 'Next Scheduled Visit Date', { type: 'date' })}
                                    </div>
                                    {fk.area('fuNotes', 'Clinical Examination Notes & Counseling Given *', { rows: 2, placeholder: 'e.g. Adherent to antihypertensive therapy. Dietary salt restriction observed. Pallor improved.', required: true }, { marginTop: '0.85rem' })}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                        <button type="button" className="btn btn-secondary" onClick={toggleFollowUpForm}>Cancel</button>
                                        <button type="submit" className="btn btn-primary" id="saveFuBtn" disabled={fuSaving}>{fuSaving ? 'Saving...' : '💾 Save Follow-up Visit'}</button>
                                    </div>
                                </form>
                            </div>

                            <div id="timelineContainer">
                                {m
                                    ? <Timeline followUps={m.follow_ups || []} onDelete={(id) => subDelete('Delete Follow-Up', 'Are you sure you want to remove this examination visit record?', `/api/follow-ups/${id}`, 'Failed to delete follow-up', 'Follow-up visit removed')} />
                                    : (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2.5rem 1rem', textAlign: 'center' }}>
                                            Select a member above to view and log their longitudinal follow-up examination visits.
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>

                <LocationVerificationCard buttonLabel="Check location" />
            </main>

            <EditFamilyModal open={editFamilyOpen} form={editFamily.values} set={editFamily.set} onClose={() => setEditFamilyOpen(false)} onSubmit={submitEditFamily} saving={editFamilySaving} phone={efPhone} />
            <AddMemberModal
                open={addOpen} familyNo={familyNoLabel} draftAlert={draftAlert} form={add.values} set={add.set} onFormInput={onAddInput}
                onClose={closeAddMemberModal} onSubmit={submitNewMember} saving={addSaving} onRestore={restoreMemberDraft} onDiscard={discardMemberDraft}
                phone={modalPhone}
            />
            <EditMemberModal open={emOpen} form={em.values} set={em.set} onClose={() => setEmOpen(false)} onSubmit={submitEditMember} saving={emSaving} phone={emPhone} onDob={onEditDob} />
            <ConditionModal open={condModal.open} title={condModal.title} form={cond.values} set={cond.set} onClose={closeCond} onSubmit={submitCondition} saving={subSaving === 'cond'} />
            <MedicationModal open={medModal.open} title={medModal.title} form={med.values} set={med.set} onClose={closeMed} onSubmit={submitMedication} saving={subSaving === 'med'} />
            <AllergyModal open={algModal.open} title={algModal.title} form={alg.values} set={alg.set} onClose={closeAlg} onSubmit={submitAllergy} saving={subSaving === 'alg'} />
            <HistoryModal open={histModal.open} title={histModal.title} form={hist.values} set={hist.set} onClose={closeHist} onSubmit={submitHistory} saving={subSaving === 'hist'} />
            <LifestyleModal open={lsOpen} form={ls.values} set={ls.set} onClose={closeLs} onSubmit={submitLifestyle} saving={subSaving === 'ls'} />
            <ProvisionModal
                open={provOpen} form={prov.values} set={prov.set} onClose={() => setProvOpen(false)} onSubmit={submitProvisionAccount} saving={provSaving}
                headerName={provHeader} result={provResult} copied={copied} onCopy={copyProvisionCredentials}
            />
            <ConfirmModal s={confirmState} onAnswer={answerConfirm} />
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
            {toasts}
        </BodyPortal>
    );
}

const muted = { fontSize: '0.825rem', color: 'var(--text-muted)' } as const;
