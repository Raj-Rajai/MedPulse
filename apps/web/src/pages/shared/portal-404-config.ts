export type PortalKey = 'student' | 'hospital' | 'admin' | 'patient' | 'common';

export interface RouteSuggestion {
    name: string;
    href: string;
    description: string;
    icon: string;
}

export interface PortalConfig {
    key: PortalKey;
    title: string;
    subtitle: string;
    badge: string;
    icon: string;
    brandLabel: string;
    accentColor: string;
    gradient: string;
    glowColor: string;
    homeLabel: string;
    homeHref: string;
    homeDesc: string;
    description: string;
    knownRoutes: RouteSuggestion[];
    suggestRoute: (path: string) => RouteSuggestion | null;
}

export const PORTAL_CONFIGS: Record<PortalKey, PortalConfig> = {
    student: {
        key: 'student',
        title: 'Student Page Not Found',
        subtitle: 'Community Medicine Field Health Surveillance',
        badge: 'STUDENT PORTAL · 404',
        icon: '🎓',
        brandLabel: 'STUDENT PORTAL',
        accentColor: '#7c3aed',
        gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9, #4f46e5)',
        glowColor: 'rgba(124, 58, 237, 0.3)',
        homeLabel: 'Return to Student Dashboard',
        homeHref: '/profile.html',
        homeDesc: 'Cadet profile, active postings and clinical surveillance',
        description: 'The requested student module or surveillance URL could not be resolved. It may have been moved or mistyped.',
        knownRoutes: [
            { name: 'Analytics Dashboard', href: '/analytics.html', description: 'Surveillance charts, KPIs & HTN/DM trends', icon: '📊' },
            { name: 'Student Profile & Home', href: '/profile.html', description: 'Cadet profile, active postings and records', icon: '👤' },
            { name: 'Family Management', href: '/family-manage.html', description: 'Household roster and assigned families', icon: '👥' },
            { name: 'Survey Data Entry', href: '/entry.html', description: 'Standard clinical survey forms & vitals', icon: '📝' },
            { name: 'Clinical Exams', href: '/exams.html', description: 'OSCE/OSPE schedules & evaluations', icon: '🩺' },
            { name: 'Field Schedule', href: '/schedule.html', description: 'Posting rotation schedule & attendance', icon: '📅' },
        ],
        suggestRoute: (path: string) => {
            const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
            if (clean.includes('analyt') || clean.includes('chart') || clean.includes('stat') || clean.includes('trend')) {
                return { name: 'Analytics Dashboard', href: '/analytics.html', description: 'Surveillance charts, epidemiological KPIs & HTN/DM trends', icon: '📊' };
            }
            if (clean.includes('prof') || clean.includes('cadet') || clean.includes('stud') || clean.includes('home')) {
                return { name: 'Student Profile & Home', href: '/profile.html', description: 'Cadet profile, active postings and clinical records', icon: '👤' };
            }
            if (clean.includes('fam') || clean.includes('house') || clean.includes('roster')) {
                return { name: 'Family Management', href: '/family-manage.html', description: 'Household roster, demographic data and assigned families', icon: '👥' };
            }
            if (clean.includes('ent') || clean.includes('surv') || clean.includes('form') || clean.includes('data')) {
                return { name: 'Survey Data Entry', href: '/entry.html', description: 'Standard clinical survey forms, vitals and screenings', icon: '📝' };
            }
            if (clean.includes('exam') || clean.includes('test') || clean.includes('osce')) {
                return { name: 'Clinical Exams', href: '/exams.html', description: 'OSCE/OSPE schedules, clinical evaluations and results', icon: '🩺' };
            }
            if (clean.includes('sched') || clean.includes('rotat') || clean.includes('post') || clean.includes('attend')) {
                return { name: 'Field Schedule', href: '/schedule.html', description: 'Posting rotation schedule, field visits and attendance', icon: '📅' };
            }
            return null;
        },
    },
    hospital: {
        key: 'hospital',
        title: 'Hospital Route Not Found',
        subtitle: 'Inpatient & Clinical Management System (HMS)',
        badge: 'HOSPITAL PORTAL · 404',
        icon: '🏥',
        brandLabel: 'HOSPITAL HMS',
        accentColor: '#0d9488',
        gradient: 'linear-gradient(135deg, #14b8a6, #0d9488, #0891b2)',
        glowColor: 'rgba(13, 148, 136, 0.3)',
        homeLabel: 'Return to Hospital Portal',
        homeHref: '/hospital.html',
        homeDesc: 'Inpatient wards, emergency and clinical dashboard',
        description: 'The requested hospital service, ward or clinical queue URL is not available in the Hospital Management System.',
        knownRoutes: [
            { name: 'Hospital Dashboard', href: '/hospital.html', description: 'Inpatient wards, bed tracking and patient queue', icon: '🏥' },
            { name: 'Inpatient Wards & Beds', href: '/hospital.html', description: 'Ward occupancy, bed transfers and releases', icon: '🛏️' },
            { name: 'Emergency Admissions', href: '/hospital.html', description: 'Acute triage, intake and fast-track admissions', icon: '🚨' },
            { name: 'Clinical Staff Duties', href: '/hospital.html', description: 'Doctor/nurse shift schedules and ward assignments', icon: '👨‍⚕️' },
            { name: 'Laboratory Orders', href: '/hospital.html', description: 'Diagnostic test requests and pathology results', icon: '🔬' },
            { name: 'Hospital Staff Sign In', href: '/login.html?hospital=1', description: 'Staff access to clinical management system', icon: '🔐' },
        ],
        suggestRoute: (path: string) => {
            const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
            if (clean.includes('bed') || clean.includes('ward') || clean.includes('inpat')) {
                return { name: 'Inpatient Wards & Beds', href: '/hospital.html', description: 'Ward occupancy, bed transfers and releases', icon: '🛏️' };
            }
            if (clean.includes('admit') || clean.includes('emerg') || clean.includes('triage')) {
                return { name: 'Emergency Admissions', href: '/hospital.html', description: 'Acute triage, intake and fast-track admissions', icon: '🚨' };
            }
            if (clean.includes('staff') || clean.includes('duty') || clean.includes('doc') || clean.includes('nurse')) {
                return { name: 'Clinical Staff Duties', href: '/hospital.html', description: 'Doctor/nurse shift schedules and ward assignments', icon: '👨‍⚕️' };
            }
            if (clean.includes('lab') || clean.includes('test') || clean.includes('path')) {
                return { name: 'Laboratory Orders', href: '/hospital.html', description: 'Diagnostic test requests and pathology results', icon: '🔬' };
            }
            return { name: 'Hospital Dashboard', href: '/hospital.html', description: 'Inpatient wards, bed tracking and patient queue', icon: '🏥' };
        },
    },
    admin: {
        key: 'admin',
        title: 'Admin Page Not Found',
        subtitle: 'Faculty Governance & Institutional Administration',
        badge: 'ADMIN PORTAL · 404',
        icon: '⚡',
        brandLabel: 'ADMIN CONSOLE',
        accentColor: '#d97706',
        gradient: 'linear-gradient(135deg, #fbbf24, #d97706, #b45309)',
        glowColor: 'rgba(217, 119, 6, 0.3)',
        homeLabel: 'Return to Admin Portal',
        homeHref: '/admin.html',
        homeDesc: 'Faculty governance, cadet rosters and institutional oversight',
        description: 'The requested administrative route, governance report, or audit endpoint was not found.',
        knownRoutes: [
            { name: 'Admin Command Console', href: '/admin.html', description: 'Faculty dashboard and system-wide metrics', icon: '⚡' },
            { name: 'Cadet Roster & Audits', href: '/admin.html', description: 'Student postings, survey verification and attendance', icon: '👨‍🎓' },
            { name: 'Household Database', href: '/admin.html', description: 'Cross-ward family demographic records', icon: '🏘️' },
            { name: 'Surveillance Analytics', href: '/admin.html', description: 'Aggregated community health statistics', icon: '📈' },
            { name: 'System Role Access', href: '/admin.html', description: 'User permissions, role governance and audit logs', icon: '🛡️' },
            { name: 'Faculty Administrator Sign In', href: '/login.html?admin=1', description: 'Access protected administrative functions', icon: '🔑' },
        ],
        suggestRoute: (path: string) => {
            const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
            if (clean.includes('stud') || clean.includes('cadet') || clean.includes('roster')) {
                return { name: 'Cadet Roster & Audits', href: '/admin.html', description: 'Student postings, survey verification and attendance', icon: '👨‍🎓' };
            }
            if (clean.includes('fam') || clean.includes('house') || clean.includes('unit')) {
                return { name: 'Household Database', href: '/admin.html', description: 'Cross-ward family demographic records', icon: '🏘️' };
            }
            if (clean.includes('stat') || clean.includes('analyt') || clean.includes('trend')) {
                return { name: 'Surveillance Analytics', href: '/admin.html', description: 'Aggregated community health statistics', icon: '📈' };
            }
            if (clean.includes('role') || clean.includes('user') || clean.includes('perm')) {
                return { name: 'System Role Access', href: '/admin.html', description: 'User permissions, role governance and audit logs', icon: '🛡️' };
            }
            return { name: 'Admin Command Console', href: '/admin.html', description: 'Faculty dashboard and system-wide metrics', icon: '⚡' };
        },
    },
    patient: {
        key: 'patient',
        title: 'Patient Page Not Found',
        subtitle: 'MyHealth Personal Medical & Family Care',
        badge: 'PATIENT PORTAL · 404',
        icon: '❤️',
        brandLabel: 'MYHEALTH PORTAL',
        accentColor: '#e11d48',
        gradient: 'linear-gradient(135deg, #fb7185, #e11d48, #3b82f6)',
        glowColor: 'rgba(225, 29, 72, 0.3)',
        homeLabel: 'Return to Patient Portal',
        homeHref: '/patient.html',
        homeDesc: 'Personal health records, active prescriptions and appointments',
        description: 'The requested personal medical record, prescription page, or appointment slot is not available.',
        knownRoutes: [
            { name: 'MyHealth Dashboard', href: '/patient.html', description: 'Patient records, vitals summary and upcoming visits', icon: '❤️' },
            { name: 'Prescription Regimens', href: '/patient.html', description: 'Active medications, dosage schedule and refills', icon: '💊' },
            { name: 'Vitals & Lab History', href: '/patient.html', description: 'Blood pressure, glucose levels and lab charts', icon: '🩺' },
            { name: 'Clinical Appointments', href: '/patient.html', description: 'Consultation schedule with your assigned doctor', icon: '📅' },
            { name: 'Emergency Helpline', href: '/patient.html', description: '24/7 hospital clinical assistance & contact', icon: '📞' },
            { name: 'Patient Sign In', href: '/login.html?patient=1', description: 'Access your private personal medical records', icon: '🔐' },
        ],
        suggestRoute: (path: string) => {
            const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
            if (clean.includes('med') || clean.includes('presc') || clean.includes('drug')) {
                return { name: 'Prescription Regimens', href: '/patient.html', description: 'Active medications, dosage schedule and refills', icon: '💊' };
            }
            if (clean.includes('vital') || clean.includes('bp') || clean.includes('sugar') || clean.includes('lab')) {
                return { name: 'Vitals & Lab History', href: '/patient.html', description: 'Blood pressure, glucose levels and lab charts', icon: '🩺' };
            }
            if (clean.includes('appoint') || clean.includes('visit') || clean.includes('book')) {
                return { name: 'Clinical Appointments', href: '/patient.html', description: 'Consultation schedule with your assigned doctor', icon: '📅' };
            }
            return { name: 'MyHealth Dashboard', href: '/patient.html', description: 'Patient records, vitals summary and upcoming visits', icon: '❤️' };
        },
    },
    common: {
        key: 'common',
        title: 'Page Not Found',
        subtitle: 'MedPulse Central Access & Authentication',
        badge: 'CENTRAL PORTAL · 404',
        icon: '🔐',
        brandLabel: 'MEDPULSE ACCESS',
        accentColor: '#4f46e5',
        gradient: 'linear-gradient(135deg, #6366f1, #4f46e5, #0ea5e9)',
        glowColor: 'rgba(79, 70, 229, 0.3)',
        homeLabel: 'Go to Sign In',
        homeHref: '/login.html',
        homeDesc: 'Log in with your cadet, faculty, hospital or patient credentials',
        description: 'The requested link is not a recognized MedPulse route. Please choose your portal or sign in below.',
        knownRoutes: [
            { name: 'Portal Sign In', href: '/login.html', description: 'Authenticate to your departmental account', icon: '🔐' },
            { name: 'Cadet Registration', href: '/register.html', description: 'Register new MBBS student cadet profile', icon: '✍️' },
            { name: 'Student Field Portal', href: '/profile.html', description: 'Community medicine surveillance & households', icon: '🎓' },
            { name: 'Hospital Management', href: '/hospital.html', description: 'Inpatient wards, emergency & bed tracking', icon: '🏥' },
            { name: 'Faculty & Admin Console', href: '/admin.html', description: 'Academic administration & governance', icon: '⚡' },
            { name: 'Patient Health Portal', href: '/patient.html', description: 'Personal medical records & appointments', icon: '❤️' },
        ],
        suggestRoute: (path: string) => {
            const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
            if (clean.includes('log') || clean.includes('sign') || clean.includes('auth')) {
                return { name: 'Portal Sign In', href: '/login.html', description: 'Authenticate to your departmental account', icon: '🔐' };
            }
            if (clean.includes('reg') || clean.includes('join') || clean.includes('enroll')) {
                return { name: 'Cadet Registration', href: '/register.html', description: 'Register new MBBS student cadet profile', icon: '✍️' };
            }
            if (clean.includes('stud') || clean.includes('analyt') || clean.includes('fam') || clean.includes('entry')) {
                return { name: 'Student Field Portal', href: '/profile.html', description: 'Community medicine surveillance & households', icon: '🎓' };
            }
            if (clean.includes('hosp') || clean.includes('bed') || clean.includes('ward')) {
                return { name: 'Hospital Management', href: '/hospital.html', description: 'Inpatient wards, emergency & bed tracking', icon: '🏥' };
            }
            if (clean.includes('admin') || clean.includes('fac') || clean.includes('gov')) {
                return { name: 'Faculty & Admin Console', href: '/admin.html', description: 'Academic administration & governance', icon: '⚡' };
            }
            if (clean.includes('pat') || clean.includes('myhealth')) {
                return { name: 'Patient Health Portal', href: '/patient.html', description: 'Personal medical records & appointments', icon: '❤️' };
            }
            return { name: 'Portal Sign In', href: '/login.html', description: 'Authenticate to your departmental account', icon: '🔐' };
        },
    },
};

/**
 * Intelligent detector: determines which of the 5 portals a given path / user session belongs to.
 */
export function detectPortal(pathname: string, searchParams?: URLSearchParams): PortalKey {
    // 1. Direct override via query parameter (e.g. ?portal=hospital)
    if (searchParams) {
        const queryPortal = searchParams.get('portal') as PortalKey | null;
        if (queryPortal && PORTAL_CONFIGS[queryPortal]) return queryPortal;
    }

    const clean = (pathname || '').toLowerCase();

    // 2. Explicit portal prefix
    if (clean.startsWith('/student') || clean === '/student') return 'student';
    if (clean.startsWith('/hospital') || clean === '/hospital') return 'hospital';
    if (clean.startsWith('/admin') || clean === '/admin') return 'admin';
    if (clean.startsWith('/patient') || clean === '/patient') return 'patient';
    if (clean.startsWith('/login') || clean.startsWith('/register') || clean.startsWith('/auth')) return 'common';

    // 3. Keyword matching for known module URLs without prefix
    if (
        clean.includes('analyt') ||
        clean.includes('fam') ||
        clean.includes('entry') ||
        clean.includes('exam') ||
        clean.includes('sched') ||
        clean.includes('profile') ||
        clean.includes('survey')
    ) {
        return 'student';
    }

    if (clean.includes('hosp') || clean.includes('ward') || clean.includes('bed') || clean.includes('clinic')) {
        return 'hospital';
    }

    if (clean.includes('gov') || clean.includes('roster') || clean.includes('faculty') || clean.includes('audit')) {
        return 'admin';
    }

    if (clean.includes('myhealth') || clean.includes('presc') || clean.includes('appoint')) {
        return 'patient';
    }

    // Default to common for generic / unknown routes
    return 'common';
}
