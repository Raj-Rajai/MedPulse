import { useEffect, useState } from 'react';
import { getAdmin, getHospitalAdmin, getPatient, getUser, logout, logoutAdmin, logoutHospitalAdmin, logoutPatient, type StudentSession } from '../../shared/session';

interface RouteSuggestion {
    name: string;
    href: string;
    description: string;
    icon: string;
}

const KNOWN_ROUTES: RouteSuggestion[] = [
    { name: 'Analytics Dashboard', href: '/analytics.html', description: 'Surveillance charts, epidemiological KPIs & HTN/DM trends', icon: '📊' },
    { name: 'Student Profile & Home', href: '/profile.html', description: 'Cadet profile, active postings and clinical records', icon: '👤' },
    { name: 'Family Management', href: '/family-manage.html', description: 'Household roster, demographic data and assigned families', icon: '👥' },
    { name: 'Survey Data Entry', href: '/entry.html', description: 'Standard clinical survey forms, vitals and screenings', icon: '📝' },
    { name: 'Clinical Exams', href: '/exams.html', description: 'OSCE/OSPE schedules, clinical evaluations and results', icon: '🩺' },
    { name: 'Field Schedule', href: '/schedule.html', description: 'Posting rotation schedule, field visits and attendance', icon: '📅' },
    { name: 'Hospital Portal', href: '/hospital.html', description: 'Inpatient wards, bed management and emergency admissions', icon: '🏥' },
    { name: 'Admin Portal', href: '/admin.html', description: 'Faculty dashboard, cadet rosters and institutional governance', icon: '⚡' },
    { name: 'Patient Portal', href: '/patient.html', description: 'Personal health records, prescriptions and appointments', icon: '❤️' },
];

function findBestSuggestion(path: string): RouteSuggestion | null {
    const clean = path.toLowerCase().replace(/^\/+/, '').replace(/\.html$/, '');
    if (!clean) return null;

    if (clean.includes('analyt') || clean.includes('chart') || clean.includes('stat') || clean.includes('trend')) {
        return KNOWN_ROUTES[0]; // Analytics
    }
    if (clean.includes('prof') || clean.includes('cadet') || clean.includes('stud') || clean.includes('home')) {
        return KNOWN_ROUTES[1]; // Profile
    }
    if (clean.includes('fam') || clean.includes('house') || clean.includes('roster')) {
        return KNOWN_ROUTES[2]; // Family Manage
    }
    if (clean.includes('ent') || clean.includes('surv') || clean.includes('form') || clean.includes('data')) {
        return KNOWN_ROUTES[3]; // Entry
    }
    if (clean.includes('exam') || clean.includes('test') || clean.includes('osce') || clean.includes('mark')) {
        return KNOWN_ROUTES[4]; // Exams
    }
    if (clean.includes('sched') || clean.includes('rotat') || clean.includes('post') || clean.includes('attend')) {
        return KNOWN_ROUTES[5]; // Schedule
    }
    if (clean.includes('hosp') || clean.includes('ward') || clean.includes('bed') || clean.includes('clinic')) {
        return KNOWN_ROUTES[6]; // Hospital
    }
    if (clean.includes('admin') || clean.includes('manage') || clean.includes('gov')) {
        return KNOWN_ROUTES[7]; // Admin
    }
    if (clean.includes('pat') || clean.includes('myhealth') || clean.includes('record')) {
        return KNOWN_ROUTES[8]; // Patient
    }
    return null;
}

export function NotFoundApp() {
    const [path, setPath] = useState('');
    const [copied, setCopied] = useState(false);
    const [user, setUser] = useState<StudentSession | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHosp, setIsHosp] = useState(false);
    const [isPat, setIsPat] = useState(false);

    useEffect(() => {
        document.title = '404 — Invalid URL | MedPulse';
        setPath(window.location.pathname + window.location.search);
        setUser(getUser());
        setIsAdmin(Boolean(getAdmin()));
        setIsHosp(Boolean(getHospitalAdmin()));
        setIsPat(Boolean(getPatient()));
    }, []);

    const suggestion = findBestSuggestion(path);

    const handleCopy = () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLogout = () => {
        if (isAdmin) logoutAdmin();
        else if (isHosp) logoutHospitalAdmin();
        else if (isPat) logoutPatient();
        else logout();
        window.location.href = '/login.html';
    };

    let primaryDestination = {
        label: 'Go to Sign In',
        href: '/login.html',
        desc: 'Access your authenticated portal account',
    };

    if (isAdmin) {
        primaryDestination = {
            label: 'Return to Admin Portal',
            href: '/admin.html',
            desc: 'System administration and faculty dashboard',
        };
    } else if (isHosp) {
        primaryDestination = {
            label: 'Return to Hospital Portal',
            href: '/hospital.html',
            desc: 'Inpatient wards, emergency and clinical dashboard',
        };
    } else if (isPat) {
        primaryDestination = {
            label: 'Return to Patient Portal',
            href: '/patient.html',
            desc: 'Your health records and clinical appointments',
        };
    } else if (user) {
        primaryDestination = {
            label: 'Return to Student Dashboard',
            href: '/profile.html',
            desc: 'Field health surveillance and assigned households',
        };
    }

    return (
        <div className="notfound-root">
            {/* Ambient Background Glows */}
            <div className="notfound-glow notfound-glow-1" />
            <div className="notfound-glow notfound-glow-2" />

            {/* Top Navigation Bar */}
            <header className="notfound-header">
                <a href={primaryDestination.href} className="notfound-brand">
                    <div className="notfound-brand-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <div className="notfound-brand-text">
                        <span className="notfound-brand-name">MedPulse</span>
                        <span className="notfound-brand-sub">HEALTH PORTAL</span>
                    </div>
                </a>

                <div className="notfound-auth-badge">
                    {user ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role">Cadet</span>
                            <span className="notfound-user-name">
                                {user.name ? `${user.name} (Roll ${user.roll_number})` : `Roll ${user.roll_number}`}
                            </span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : isAdmin ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role" style={{ background: '#f59e0b', color: '#1e1b4b' }}>Admin</span>
                            <span className="notfound-user-name">Faculty Staff</span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : isHosp ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role" style={{ background: '#0d9488', color: '#ffffff' }}>HMS</span>
                            <span className="notfound-user-name">Hospital Staff</span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : isPat ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role" style={{ background: '#e11d48', color: '#ffffff' }}>Patient</span>
                            <span className="notfound-user-name">Verified Record</span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : (
                        <a href="/login.html" className="notfound-signin-btn">
                            Sign In
                        </a>
                    )}
                </div>
            </header>

            {/* Main Content Container */}
            <main className="notfound-container">
                <div className="notfound-card">
                    {/* Error Indicator & Icon */}
                    <div className="notfound-icon-wrap">
                        <div className="notfound-pulse-ring notfound-pulse-ring-1" />
                        <div className="notfound-pulse-ring notfound-pulse-ring-2" />
                        <div className="notfound-badge-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                    </div>

                    <div className="notfound-error-code">404</div>
                    <div className="notfound-pill-badge">
                        <span className="notfound-dot" />
                        <span>Invalid URL · Route Not Found</span>
                    </div>

                    <h1 className="notfound-title">Page Does Not Exist</h1>
                    <p className="notfound-desc">
                        The requested URL could not be resolved to any active portal, module, or resource. It may have been mistyped, moved, or retired.
                    </p>

                    {/* Path Diagnostics Pill */}
                    <div className="notfound-path-box">
                        <div className="notfound-path-details">
                            <span className="notfound-method">GET</span>
                            <span className="notfound-path-text" title={path}>{path || window.location.pathname}</span>
                        </div>
                        <button className="notfound-copy-btn" onClick={handleCopy} title="Copy URL">
                            {copied ? (
                                <span className="notfound-copied">✓ Copied</span>
                            ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Smart Did You Mean Suggestion */}
                    {suggestion && (
                        <div className="notfound-suggestion-box">
                            <div className="notfound-suggestion-header">
                                <span className="notfound-suggestion-tag">💡 Did you mean?</span>
                                <span className="notfound-suggestion-note">Based on your entered address</span>
                            </div>
                            <div className="notfound-suggestion-body">
                                <div className="notfound-suggestion-info">
                                    <span className="notfound-suggestion-icon">{suggestion.icon}</span>
                                    <div className="notfound-suggestion-texts">
                                        <div className="notfound-suggestion-name">{suggestion.name}</div>
                                        <div className="notfound-suggestion-sub">{suggestion.description}</div>
                                    </div>
                                </div>
                                <a href={suggestion.href} className="notfound-suggestion-action">
                                    <span>Open Page</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Primary Actions */}
                    <div className="notfound-actions">
                        <button className="notfound-btn notfound-btn-secondary" onClick={() => window.history.back()}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12" />
                                <polyline points="12 19 5 12 12 5" />
                            </svg>
                            <span>Go Back</span>
                        </button>

                        <a href={primaryDestination.href} className="notfound-btn notfound-btn-primary">
                            <span>{primaryDestination.label}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </a>
                    </div>
                </div>

                {/* Quick Navigation Directory */}
                <div className="notfound-directory">
                    <h2 className="notfound-directory-title">Available Portals & Modules</h2>
                    <div className="notfound-grid">
                        {KNOWN_ROUTES.map((route) => (
                            <a key={route.href} href={route.href} className="notfound-grid-item">
                                <span className="notfound-grid-icon">{route.icon}</span>
                                <div className="notfound-grid-content">
                                    <span className="notfound-grid-name">{route.name}</span>
                                    <span className="notfound-grid-desc">{route.description}</span>
                                </div>
                                <span className="notfound-grid-arrow">→</span>
                            </a>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
