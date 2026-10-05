/**
 * MedPulse faculty & administrative command center (frontend/admin/admin.html).
 * Owns the active tab, the data shared between tabs and every modal; each tab is its own section
 * component under ./sections.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { updateSidebarGlider } from '../../shared/nav-glider';
import { AdminHeader, type Heading } from './components/AdminHeader';
import { AdminSidebar } from './components/AdminSidebar';
import { GeofencePanel } from './geofence/GeofencePanel';
import { useCadets, useColleges, useOverview, useUniAdmins } from './hooks/useAdminData';
import { useExports } from './hooks/useExports';
import { useModal } from './hooks/useModal';
import { ToastProvider, useToast } from './hooks/useToasts';
import { errMessage, flashRow } from './lib/http';
import { closeAdminSidebar, toggleAdminSidebar } from './lib/sidebar';
import { AttendanceSection } from './sections/attendance/AttendanceSection';
import { ScheduleSection } from './sections/schedule/ScheduleSection';
import { CampaignRosterModal } from './sections/campaigns/CampaignRosterModal';
import { CampaignsSection } from './sections/campaigns/CampaignsSection';
import { ExamsSection } from './sections/exams/ExamsSection';
import { ExportsSection } from './sections/exports/ExportsSection';
import { HouseholdsSection } from './sections/households/HouseholdsSection';
import { OverviewSection } from './sections/overview/OverviewSection';
import { AddStudentModal, EditStudentModal, InspectCadetModal, ResetPinModal } from './sections/students/StudentModals';
import { StudentsSection, type CadetActions } from './sections/students/StudentsSection';
import { AppointUniAdminModal, EditUniAdminModal, ResetUniAdminPinModal, type QuotaNote } from './sections/uniAdmins/UniAdminModals';
import { UniAdminsSection } from './sections/uniAdmins/UniAdminsSection';
import type { AdminTab, Campaign, Cadet, UniAdmin } from './types';
import { ConfidentialityNoticeModal } from '../../shared/privacy/ConfidentialityNoticeModal';

/** admin-geofence.js exists in the original frontend but admin.html never loads it. */
const SHOW_GEOFENCE_PANEL = false;

const TAB_HEADERS: Record<AdminTab, Heading> = {
    overview: { title: 'Executive Surveillance Overview', sub: 'Departmental Community Medicine (PSM) oversight, multi-cadet rosters, and population health surveillance' },
    students: { title: 'Student Cadre Roster & Assignments', sub: 'Manage medical trainees, track survey submission completion, and adjust institutional credentials' },
    attendance: { title: 'Student Attendance Register & Timetable', sub: 'Mark daily lecture attendance, track clinical session presence, and maintain NMC compliance' },
    schedule: { title: 'Academic & Teaching Schedule Editor', sub: 'NMC CBME curriculum schedule management, lecture session planning, and teaching timetable administration' },
    exams: { title: 'Examination Results & Marksheet Management', sub: 'Input and publish Internal Assessment (IA-1, IA-2), Preliminary, and University examination marks' },
    households: { title: 'Global Household Surveillance Registry', sub: 'Comprehensive roster of all families surveyed across all student cohorts' },
    campaigns: { title: 'Targeted Health Campaign Command Center', sub: 'Broadcast disease-specific health drives, monitor automated patient matching, and coordinate cadet follow-ups' },
    uniAdmins: { title: 'University Admins & Faculty Oversight', sub: 'Manage Super Admin and up to 10 departmental faculty administrators per university institution' },
    exports: { title: 'Master Data & Administrative Exports', sub: 'Download complete 43-column master survey proforma CSVs and polished faculty clinical audit reports' },
};

/** The heading the page shows before any tab switch (differs from TAB_HEADERS.overview.sub). */
const INITIAL_HEADING: Heading = {
    title: 'Executive Surveillance Overview',
    sub: 'SAL Institute of Medical Sciences & Hospital • Departmental Community Medicine (PSM) oversight',
};

/** Tabs whose section loads its own data when the tab is opened. */
type SignalTab = 'attendance' | 'schedule' | 'exams' | 'households' | 'campaigns';

function AdminConsole() {
    const showToast = useToast();
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [heading, setHeading] = useState<Heading>(INITIAL_HEADING);
    const [switches, setSwitches] = useState(0);
    const [signals, setSignals] = useState<Record<SignalTab, number>>({ attendance: 0, schedule: 0, exams: 0, households: 0, campaigns: 0 });

    const [householdNoticeOpen, setHouseholdNoticeOpen] = useState(false);
    const prevTabRef = useRef<AdminTab | null>(null);

    useEffect(() => {
        if (activeTab === 'households' && prevTabRef.current !== 'households') {
            setHouseholdNoticeOpen(true);
        }
        prevTabRef.current = activeTab;
    }, [activeTab]);

    const overview = useOverview(showToast);
    const cadets = useCadets(showToast);
    const colleges = useColleges(showToast);
    const uni = useUniAdmins(showToast);
    const exports = useExports(showToast);

    // uniAdminCollegeSelect: "SAL Hospital" (1) until the college list replaces its options.
    const [selectedUni, setSelectedUni] = useState('1');
    const selectedUniRef = useRef('1');
    const selectUni = (id: string) => {
        selectedUniRef.current = id;
        setSelectedUni(id);
    };
    useEffect(() => {
        if (colleges.options && colleges.options.length) selectUni(String(colleges.options[0].id));
    }, [colleges.options]);

    const [quotaNote, setQuotaNote] = useState<QuotaNote>({ text: 'Strict Quota: Max 10 University Admins', color: '#d97706' });
    useEffect(() => {
        const v = uni.view;
        if (!v) return;
        setQuotaNote({
            text: v.full ? `⚠️ Quota Full: ${v.curA}/${v.maxQ} seats used` : `Seats: ${v.curA}/${v.maxQ} used (${v.rem} available)`,
            color: v.full ? '#dc2626' : '#d97706',
        });
    }, [uni.view]);

    const addStudent = useModal<true>();
    const editStudent = useModal<Cadet>();
    const resetPin = useModal<Cadet>();
    const inspect = useModal<number>();
    const appoint = useModal<string>();
    const editUni = useModal<UniAdmin>();
    const resetUniPin = useModal<UniAdmin>();
    const roster = useModal<Campaign>();

    const loadUni = uni.load;
    const switchTab = useCallback((tab: AdminTab) => {
        setActiveTab(tab);
        if (window.innerWidth <= 860) closeAdminSidebar();
        setHeading(TAB_HEADERS[tab] || TAB_HEADERS.overview);
        setSwitches((n) => n + 1);

        if (tab === 'overview') overview.load();
        else if (tab === 'students') cadets.load();
        else if (tab === 'uniAdmins') loadUni(selectedUniRef.current || 1);
        else if (tab !== 'exports') setSignals((s) => ({ ...s, [tab]: s[tab] + 1 }));
    }, [overview.load, cadets.load, colleges.load, loadUni]);

    // Keep the sidebar glider on the active link after every switch.
    useEffect(() => {
        if (switches) updateSidebarGlider();
    }, [switches]);

    // Bootstrap (DOMContentLoaded): overview, colleges, cadets.
    useEffect(() => {
        Object.assign(window, { toggleSidebar: toggleAdminSidebar, closeSidebar: closeAdminSidebar });
        requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('preload-transitions')));
        overview.load();
        colleges.load();
        cadets.load();
    }, []);

    const refreshAfterCadetChange = () => {
        cadets.load();
        overview.load();
    };

    const deleteStudent = async (s: Cadet) => {
        if (!confirm(`Are you sure you want to delete Cadet ${s.name} (Roll ${s.roll_number}) and ALL associated survey households and medical records?\n\nThis action cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/students/${s.id}`, { method: 'DELETE' });
            const data = (await res.json()) as { message?: string; error?: string };
            if (!res.ok) throw new Error(data.error || 'Failed to delete student');
            showToast(data.message as string, 'success');
            refreshAfterCadetChange();
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    };

    const deleteUniAdmin = async (a: UniAdmin) => {
        if (!confirm(`Are you sure you want to remove University Administrator "${a.name}"?\n\nThis will revoke their access and free up 1 administrative seat for this university.`)) return;
        try {
            const res = await fetch(`/api/admin/university-admins/${a.id}`, { method: 'DELETE' });
            const data = (await res.json()) as { message?: string; error?: string };
            if (!res.ok) throw new Error(data.error || 'Failed to remove administrator');
            showToast(data.message as string, 'success');
            loadUni(selectedUniRef.current || 1);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    };

    const cadetActions: CadetActions = {
        openAttendance: (id) => { switchTab('attendance'); flashRow(`attRow-${id}`); },
        openExams: (id) => { switchTab('exams'); flashRow(`examRow-${id}`); },
        edit: (id) => { const s = cadets.find(id); if (s) editStudent.show(s); },
        resetPin: (s) => resetPin.show(s),
        inspect: (id) => inspect.show(id),
        remove: deleteStudent,
    };

    const openAppoint = () => {
        if (uni.quota) {
            const curA = uni.quota.current_admins || 0;
            const maxQ = uni.quota.max_admins || 10;
            setQuotaNote((n) => ({ ...n, text: `Quota Status: ${curA}/${maxQ} seats used (${maxQ - curA} available)` }));
        }
        appoint.show(selectedUniRef.current || '1');
    };

    return (
        <>
            <AdminSidebar activeTab={activeTab} onSelect={switchTab} />

            {/* Main Content */}
            <main className="main-content">
                <AdminHeader heading={heading} exports={exports} onRegisterCadet={() => addStudent.show(true)} onRefresh={() => switchTab(activeTab)} />

                <OverviewSection active={activeTab === 'overview'} stats={overview.stats} />
                <StudentsSection
                    active={activeTab === 'students'} all={cadets.all} rows={cadets.rows} setRows={cadets.setRows}
                    collegeOptions={colleges.options} actions={cadetActions} onAdd={() => addStudent.show(true)} showToast={showToast}
                />
                <AttendanceSection active={activeTab === 'attendance'} loadSignal={signals.attendance} />
                <ScheduleSection active={activeTab === 'schedule'} loadSignal={signals.schedule} />
                <ExamsSection active={activeTab === 'exams'} loadSignal={signals.exams} />
                <HouseholdsSection active={activeTab === 'households'} loadSignal={signals.households} />
                <UniAdminsSection
                    active={activeTab === 'uniAdmins'} admins={uni.admins} view={uni.view} collegeOptions={colleges.options}
                    selectedUni={selectedUni} onSelectUni={(id) => { selectUni(id); loadUni(id); }}
                    onAppoint={openAppoint} onEdit={(id) => { const a = uni.find(id); if (a) editUni.show(a); }}
                    onResetPin={(a) => resetUniPin.show(a)} onDelete={deleteUniAdmin}
                />
                <ExportsSection active={activeTab === 'exports'} exports={exports} collegeOptions={colleges.options} />
                <CampaignsSection active={activeTab === 'campaigns'} loadSignal={signals.campaigns} onOpenRoster={(c) => roster.show(c)} />
                {SHOW_GEOFENCE_PANEL && <GeofencePanel />}
            </main>

            {/* MODALS */}
            <AddStudentModal modal={addStudent} collegeOptions={colleges.options} onSaved={refreshAfterCadetChange} />
            <EditStudentModal modal={editStudent} collegeOptions={colleges.options} onSaved={refreshAfterCadetChange} />
            <ResetPinModal modal={resetPin} />
            <InspectCadetModal modal={inspect} />
            <AppointUniAdminModal modal={appoint} collegeOptions={colleges.options} note={quotaNote} onSaved={(id) => loadUni(id)} />
            <EditUniAdminModal modal={editUni} onSaved={(id) => loadUni(id)} />
            <ResetUniAdminPinModal modal={resetUniPin} />
            <CampaignRosterModal modal={roster} />
            <ConfidentialityNoticeModal
                type="SENSITIVE_HOUSEHOLD"
                context="GLOBAL_HOUSEHOLD"
                open={householdNoticeOpen}
                onContinue={() => setHouseholdNoticeOpen(false)}
                onClose={() => {
                    setHouseholdNoticeOpen(false);
                    switchTab('overview');
                }}
            />
        </>
    );
}

export function AdminApp() {
    return (
        <ToastProvider>
            <AdminConsole />
        </ToastProvider>
    );
}
