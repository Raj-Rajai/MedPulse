/**
 * Unified Student Portal Application Shell
 *
 * Hosts a single persistent common navbar on the left side across all student pages
 * (Profile, Schedule, Exams, Home, Families, Data Entry, Analytics). Page transitions
 * occur smoothly via client-side routing without full browser refreshes, completely
 * eliminating screen flickers and duplicate sidebars.
 */
import './student-styles.css';
import { useEffect, useState, type ReactNode } from 'react';
import { BodyPortal, useStudentChrome } from './Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar, type StudentRoute } from './StudentSidebar';
import { SignInLink, StudentBadge, logoutToLogin } from './badges';
import { standardSidebar } from './sidebar';
import { getUser, type StudentSession } from '../../../shared/session';

// Student Page Components
import { IndexApp } from '../index/IndexApp';
import { ProfileApp } from '../profile/ProfileApp';
import { ScheduleApp } from '../schedule/ScheduleApp';
import { ExamsApp } from '../exams/ExamsApp';
import { FamilyManageApp } from '../family-manage/FamilyManageApp';
import { EntryApp } from '../entry/EntryApp';
import { AnalyticsApp } from '../analytics/AnalyticsApp';
import { UpcomingApp } from '../upcoming/UpcomingApp';

/** Schedule and Exams open the Upcoming page for now; ScheduleApp and ExamsApp are kept for later. */
const SHOW_UPCOMING_FOR_SCHEDULE_AND_EXAMS = true;

export function getBasePrefix(): string {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.startsWith('/student') ? '/student' : '';
}

export function getRouteFromPath(path: string): StudentRoute | null {
    const clean = path.toLowerCase();
    if (clean.includes('family-manage') || clean.includes('families')) return 'families';
    if (clean.includes('profile')) return 'profile';
    if (clean.includes('schedule')) return 'schedule';
    if (clean.includes('exam')) return 'exams';
    if (clean.includes('entry')) return 'entry';
    if (clean.includes('analytics')) return 'analytics';
    if (clean.includes('index') || clean.endsWith('/student') || clean.endsWith('/student/') || clean === '/' || clean.includes('home')) return 'home';
    return null;
}

export function getPathForRoute(route: StudentRoute): string {
    const prefix = getBasePrefix();
    switch (route) {
        case 'profile': return `${prefix}/profile.html`;
        case 'schedule': return `${prefix}/schedule.html`;
        case 'exams': return `${prefix}/exams.html`;
        case 'home': return `${prefix}/index.html`;
        case 'families': return `${prefix}/family-manage.html`;
        case 'entry': return `${prefix}/entry.html`;
        case 'analytics': return `${prefix}/analytics.html`;
        default: return `${prefix}/profile.html`;
    }
}

interface StudentPortalProps {
    initialRoute?: StudentRoute;
}

export function StudentPortalApp({ initialRoute }: StudentPortalProps) {
    const [route, setRoute] = useState<StudentRoute>(() => {
        return (typeof window !== 'undefined' ? getRouteFromPath(window.location.pathname) : null) || initialRoute || 'profile';
    });

    const [user, setUser] = useState<StudentSession | null>(() => (typeof window !== 'undefined' ? getUser() : null));

    useStudentChrome(standardSidebar);

    useEffect(() => {
        setUser(getUser());
    }, [route]);

    useEffect(() => {
        const titles: Record<StudentRoute, string> = {
            profile: 'MedPulse — Student Profile & Attendance',
            schedule: 'MedPulse — Academic Schedule',
            exams: 'MedPulse — Student Exams & Marksheets',
            home: 'MedPulse — Community Medicine Dashboard',
            families: 'MedPulse — Family Records & Household Management',
            entry: 'MedPulse — Community Health Survey Data Entry',
            analytics: 'MedPulse — Epidemiological Surveillance & Analytics',
            attendance: 'MedPulse — Student Profile & Attendance',
        };
        if (titles[route]) {
            document.title = titles[route];
        }
    }, [route]);

    const navigateTo = (targetRoute: StudentRoute, href?: string) => {
        if (targetRoute === route) {
            standardSidebar.close();
            return;
        }
        const targetHref = href || getPathForRoute(targetRoute);
        window.history.pushState(null, '', targetHref);
        setRoute(targetRoute);
        window.scrollTo({ top: 0, behavior: 'instant' });
        standardSidebar.close();
    };

    // Handle browser Back / Forward buttons
    useEffect(() => {
        const onPopState = () => {
            const r = getRouteFromPath(window.location.pathname);
            if (r) setRoute(r);
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    // Intercept in-page navigation links so clicking buttons/links stays in the SPA
    useEffect(() => {
        const onDocumentClick = (e: MouseEvent) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href) return;
            if (
                href.startsWith('http:') ||
                href.startsWith('https:') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('#') ||
                href.startsWith('javascript:')
            ) return;

            const targetRoute = getRouteFromPath(href);
            if (targetRoute) {
                e.preventDefault();
                navigateTo(targetRoute, href);
            }
        };
        document.addEventListener('click', onDocumentClick);
        return () => document.removeEventListener('click', onDocumentClick);
    }, [route]);

    const renderActivePage = (): ReactNode => {
        switch (route) {
            case 'profile': return <ProfileApp />;
            case 'schedule': return SHOW_UPCOMING_FOR_SCHEDULE_AND_EXAMS ? <UpcomingApp feature="Schedule" /> : <ScheduleApp />;
            case 'exams': return SHOW_UPCOMING_FOR_SCHEDULE_AND_EXAMS ? <UpcomingApp feature="Exams" /> : <ExamsApp />;
            case 'home': return <IndexApp />;
            case 'families': return <FamilyManageApp />;
            case 'entry': return <EntryApp />;
            case 'analytics': return <AnalyticsApp />;
            default: return <ProfileApp />;
        }
    };

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active={route}
                onToggle={standardSidebar.toggle}
                onNavigate={(r, href) => navigateTo(r, href)}
                badge={user ? <StudentBadge roll={String(user.roll_number || '235')} mode="profile" onLogout={logoutToLogin} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {renderActivePage()}
        </BodyPortal>
    );
}
