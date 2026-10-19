import { useEffect, useState } from 'react';
import {
    getAdmin,
    getHospitalAdmin,
    getPatient,
    getUser,
    logout,
    logoutAdmin,
    logoutHospitalAdmin,
    logoutPatient,
    type StudentSession,
} from '../../shared/session';
import {
    detectPortal,
    PORTAL_CONFIGS,
    type PortalKey,
} from './portal-404-config';

interface NotFoundAppProps {
    initialPortal?: PortalKey;
}

const PORTAL_TABS: { key: PortalKey; label: string; icon: string }[] = [
    { key: 'student', label: 'Student', icon: '🎓' },
    { key: 'hospital', label: 'Hospital', icon: '🏥' },
    { key: 'admin', label: 'Admin', icon: '⚡' },
    { key: 'patient', label: 'Patient', icon: '❤️' },
    { key: 'common', label: 'Common / Login', icon: '🔐' },
];

export function NotFoundApp({ initialPortal }: NotFoundAppProps) {
    const [path, setPath] = useState('');
    const [copied, setCopied] = useState(false);
    const [user, setUser] = useState<StudentSession | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHosp, setIsHosp] = useState(false);
    const [isPat, setIsPat] = useState(false);

    // Initial portal selection
    const [activePortal, setActivePortal] = useState<PortalKey>(() => {
        if (initialPortal) return initialPortal;
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            const detected = detectPortal(window.location.pathname, searchParams);
            // If path detection resolved to common but user has an active session, contextualize to their role
            if (detected === 'common') {
                if (getUser()) return 'student';
                if (getAdmin()) return 'admin';
                if (getHospitalAdmin()) return 'hospital';
                if (getPatient()) return 'patient';
            }
            return detected;
        }
        return 'common';
    });

    useEffect(() => {
        setPath(window.location.pathname + window.location.search);
        const u = getUser();
        const a = Boolean(getAdmin());
        const h = Boolean(getHospitalAdmin());
        const p = Boolean(getPatient());

        setUser(u);
        setIsAdmin(a);
        setIsHosp(h);
        setIsPat(p);

        // If not explicitly set by prop and not in URL params, check session
        if (!initialPortal) {
            const searchParams = new URLSearchParams(window.location.search);
            const detected = detectPortal(window.location.pathname, searchParams);
            if (detected !== 'common') {
                setActivePortal(detected);
            } else if (u) {
                setActivePortal('student');
            } else if (a) {
                setActivePortal('admin');
            } else if (h) {
                setActivePortal('hospital');
            } else if (p) {
                setActivePortal('patient');
            }
        }
    }, [initialPortal]);

    useEffect(() => {
        const config = PORTAL_CONFIGS[activePortal];
        document.title = `404 — ${config.title} | MedPulse`;
    }, [activePortal]);

    const config = PORTAL_CONFIGS[activePortal];
    const suggestion = config.suggestRoute(path);

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

    return (
        <div className="notfound-root" data-portal={activePortal}>
            {/* Ambient Background Glows */}
            <div className="notfound-glow notfound-glow-1" />
            <div className="notfound-glow notfound-glow-2" />

            {/* Compact Header */}
            <header className="notfound-header">
                <a href={config.homeHref} className="notfound-brand">
                    <div className="notfound-brand-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <div className="notfound-brand-text">
                        <span className="notfound-brand-name">MedPulse</span>
                        <span className="notfound-brand-sub">{config.brandLabel}</span>
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
                            <span className="notfound-user-role">Admin</span>
                            <span className="notfound-user-name">Faculty Staff</span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : isHosp ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role">HMS</span>
                            <span className="notfound-user-name">Hospital Staff</span>
                            <button className="notfound-logout-mini" onClick={handleLogout} title="Log Out">
                                ✕
                            </button>
                        </div>
                    ) : isPat ? (
                        <div className="notfound-user-chip">
                            <span className="notfound-user-role">Patient</span>
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

            {/* Main Content Area */}
            <main className="notfound-container">
                {/* 5-Portal Switcher Tabs */}
                <nav className="notfound-portal-switcher" aria-label="Portal Selection">
                    {PORTAL_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`notfound-portal-tab ${activePortal === tab.key ? 'active' : ''}`}
                            onClick={() => setActivePortal(tab.key)}
                        >
                            <span className="notfound-portal-tab-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Compact Glassmorphic Card */}
                <div className="notfound-card">
                    {/* Pulsing Badge Icon */}
                    <div className="notfound-icon-wrap">
                        <div className="notfound-pulse-ring notfound-pulse-ring-1" />
                        <div className="notfound-pulse-ring notfound-pulse-ring-2" />
                        <div className="notfound-badge-icon">{config.icon}</div>
                    </div>

                    <div className="notfound-error-code">404</div>

                    <div className="notfound-pill-badge">
                        <span className="notfound-dot" />
                        <span>{config.badge}</span>
                    </div>

                    <h1 className="notfound-title">{config.title}</h1>
                    <p className="notfound-desc">{config.description}</p>

                    {/* Diagnostics Pill */}
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
                                <span className="notfound-suggestion-note">Suggested {config.brandLabel} route</span>
                            </div>
                            <div className="notfound-suggestion-body">
                                <div className="notfound-suggestion-info">
                                    <span className="notfound-suggestion-icon">{suggestion.icon}</span>
                                    <div>
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

                        <a href={config.homeHref} className="notfound-btn notfound-btn-primary">
                            <span>{config.homeLabel}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </a>
                    </div>
                </div>

                {/* Compact Directory of Known Routes for Active Portal */}
                <div className="notfound-directory">
                    <h2 className="notfound-directory-title">{config.brandLabel} Modules & Destinations</h2>
                    <div className="notfound-grid">
                        {config.knownRoutes.map((route) => (
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
