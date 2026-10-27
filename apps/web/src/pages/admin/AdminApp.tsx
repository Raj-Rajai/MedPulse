/**
 * MedPulse faculty & administrative command center (frontend/admin/admin.html).
 * Owns the active tab, the data shared between tabs and every modal; each tab is its own section
 * component under ./sections.
 *
 * The Attendance, Schedule, Exam marks and University admins sections (./sections/attendance,
 * ./sections/schedule, ./sections/exams, ./sections/uniAdmins) are kept in the codebase but are no
 * longer reachable from the console.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateSidebarGlider } from '../../shared/nav-glider';
import { AdminHeader, type Heading } from './components/AdminHeader';
import { AdminSidebar } from './components/AdminSidebar';
import { useCadets, useColleges, useOverview } from './hooks/useAdminData';
import { useExports } from './hooks/useExports';
import { useModal } from './hooks/useModal';
import { ToastProvider, useToast } from './hooks/useToasts';
import { ENROLLMENT_LABEL, useAcademicYears } from './lib/academic';
import { errMessage } from './lib/http';
import { closeAdminSidebar, toggleAdminSidebar } from './lib/sidebar';
import { CampaignRosterModal } from './sections/campaigns/CampaignRosterModal';
import { CampaignsSection } from './sections/campaigns/CampaignsSection';
import { AdminConfigSection } from './sections/config/AdminConfigSection';
import { ExportsSection } from './sections/exports/ExportsSection';
import { HouseholdsSection } from './sections/households/HouseholdsSection';
import { OverviewSection } from './sections/overview/OverviewSection';
import { AddStudentModal, EditStudentModal, InspectCadetModal, ResetPinModal } from './sections/students/StudentModals';
import { StudentsSection, type CadetActions } from './sections/students/StudentsSection';
import type { AdminTab, Campaign, Cadet } from './types';
import { ConfidentialityNoticeModal } from '../../shared/privacy/ConfidentialityNoticeModal';

/** Tabs the console links to; any other tab falls back to the overview. */
const TAB_HEADERS: Partial<Record<AdminTab, Heading>> = {
    overview: { title: 'Analysis', sub: '' },
    students: { title: 'Students', sub: '' },
    households: { title: 'Households', sub: '' },
    campaigns: { title: 'Campaigns', sub: '' },
    exports: { title: 'Exports', sub: '' },
    config: { title: 'Admin config', sub: '' },
};

/** The heading the page shows before any tab switch. */
const INITIAL_HEADING: Heading = TAB_HEADERS.overview!;

/** Tabs whose section loads its own data when the tab is opened. */
type SignalTab = 'households' | 'campaigns';

function AdminConsole() {
    const showToast = useToast();
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [heading, setHeading] = useState<Heading>(INITIAL_HEADING);
    const [switches, setSwitches] = useState(0);
    const [signals, setSignals] = useState<Record<SignalTab, number>>({ households: 0, campaigns: 0 });

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
    const exports = useExports(showToast);
    const academic = useAcademicYears();

    // Reload what depends on academic years after a change in Admin Config or a bulk move.
    const reloadAcademic = useCallback(() => {
        academic.load();
        cadets.load();
    }, [academic.load, cadets.load]);

    const addStudent = useModal<true>();
    const editStudent = useModal<Cadet>();
    const resetPin = useModal<Cadet>();
    const inspect = useModal<number>();
    const roster = useModal<Campaign>();

    const switchTab = useCallback((requested: AdminTab) => {
        const tab: AdminTab = TAB_HEADERS[requested] ? requested : 'overview';
        setActiveTab(tab);
        if (window.innerWidth <= 860) closeAdminSidebar();
        setHeading(TAB_HEADERS[tab]!);
        setSwitches((n) => n + 1);

        if (tab === 'overview') { overview.load(); cadets.load(); academic.load(); }
        else if (tab === 'students') { cadets.load(); academic.load(); }
        else if (tab === 'config') academic.load();
        else if (tab === 'households' || tab === 'campaigns') setSignals((s) => ({ ...s, [tab]: s[tab] + 1 }));
    }, [overview.load, cadets.load, academic.load]);

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
        if (!confirm(`Delete ${s.name} (${ENROLLMENT_LABEL} ${s.roll_number}) and all of their surveyed households and medical records?\n\nThis cannot be undone.`)) return;
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

    const cadetActions: CadetActions = useMemo(() => ({
        edit: (id) => { const s = cadets.find(id); if (s) editStudent.show(s); },
        resetPin: (s) => resetPin.show(s),
        inspect: (id) => inspect.show(id),
        remove: deleteStudent,
    }), [cadets.find]);

    return (
        <>
            <AdminSidebar activeTab={activeTab} onSelect={switchTab} />

            {/* Main Content */}
            <main className="main-content">
                <AdminHeader heading={heading} />

                <OverviewSection active={activeTab === 'overview'} stats={overview.stats} cadets={cadets.all} years={academic.years} onOpen={switchTab} />
                <StudentsSection
                    active={activeTab === 'students'} all={cadets.all} years={academic.years} actions={cadetActions} onAdd={() => addStudent.show(true)} onChanged={reloadAcademic}
                    exports={exports} onRefresh={() => switchTab('students')} showToast={showToast}
                />
                <HouseholdsSection active={activeTab === 'households'} loadSignal={signals.households} cadets={cadets.all} />
                <CampaignsSection active={activeTab === 'campaigns'} loadSignal={signals.campaigns} onOpenRoster={(c) => roster.show(c)} />
                <ExportsSection active={activeTab === 'exports'} exports={exports} />
                <AdminConfigSection active={activeTab === 'config'} years={academic.years} defaultArea={academic.defaultArea} onChanged={reloadAcademic} />
            </main>

            {/* MODALS */}
            <AddStudentModal modal={addStudent} collegeOptions={colleges.options} years={academic.years} onSaved={() => { refreshAfterCadetChange(); academic.load(); }} />
            <EditStudentModal modal={editStudent} collegeOptions={colleges.options} years={academic.years} onSaved={() => { refreshAfterCadetChange(); academic.load(); }} />
            <ResetPinModal modal={resetPin} />
            <InspectCadetModal modal={inspect} />
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
