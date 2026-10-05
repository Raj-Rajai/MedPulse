/**
 * index.html: student home dashboard, also served as the SPA fallback for unknown URLs.
 * Port of the inline scripts of frontend/shared/index.html.
 */
import { useEffect, useState } from 'react';
import { useNavGlider } from '../../shared/nav-glider';
import { getUser, type StudentSession } from '../../shared/session';
import { BodyPortal, removePreloadTransitions, runWhenActive } from './page-utils';
import { closeSidebar, initSidebar, toggleSidebar } from './sidebar';

interface AnalyticsSummary {
    totals?: { families?: number; members?: number };
    adults?: { htn_pct?: number | string; dm_pct?: number | string };
}

interface Stats {
    families: number | string;
    members: number | string;
    htn: string;
    dm: string;
}

const isCollapsed = () =>
    document.documentElement.classList.contains('sidebar-collapsed') || document.body.classList.contains('sidebar-collapsed');

/** This page's own logoutUser(): drop the student session and reload (the guard then redirects). */
function logoutUser(): void {
    localStorage.removeItem('medpulse_user');
    window.location.reload();
}

function readStoredUser(): { ok: true; user: { roll_number?: unknown } | null } | { ok: false } {
    const userStr = localStorage.getItem('medpulse_user');
    if (!userStr) return { ok: true, user: null };
    try {
        return { ok: true, user: JSON.parse(userStr) as { roll_number?: unknown } };
    } catch {
        return { ok: false };
    }
}

/**
 * The badge index.html's own initAuth() rendered. It ran after auth-guard's
 * renderSidebarUserBadge() and replaced it, so this page shows "Student / Roll N"
 * rather than the shared <SidebarUserBadge/> text.
 */
function IndexUserBadge() {
    const stored = readStoredUser();
    if (!stored.ok || !stored.user) {
        return (
            <a href="/login.html" className="sidebar-login-link" title="Sign In">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="login-label">Sign In</span>
            </a>
        );
    }
    const roll = String(stored.user?.roll_number);
    return (
        <div
            className="sidebar-user" data-tooltip={`Roll ${roll} (View Profile)`} title={`Roll ${roll}`}
            onClick={() => (isCollapsed() ? logoutUser() : (window.location.href = '/profile.html'))}
        >
            <div className="user-avatar-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="role-dot" />
            </div>
            <div className="user-info-text">
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'block' }}>Student</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>Roll {roll}</span>
            </div>
            <button className="logout-btn" onClick={(e) => { e.stopPropagation(); logoutUser(); }} title="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
            </button>
        </div>
    );
}

function Sidebar() {
    useNavGlider();
    return (
        <aside className="sidebar" id="sidebar">
            <div className="sidebar-header">
                <a href="/" className="sidebar-logo" title="MedPulse Health Portal">
                    <div className="logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <div className="logo-text-group">
                        <span className="logo-label">MedPulse</span>
                        <span className="logo-sublabel">HEALTH PORTAL</span>
                    </div>
                </a>
                <button className="sidebar-toggle-btn" id="sidebarToggleBtn" onClick={toggleSidebar} title="Toggle Sidebar">
                    <svg className="icon-collapse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <svg className="icon-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
            </div>
            <nav className="sidebar-nav">
                <a href="/" className="sidebar-link active" data-route="home" data-title="Home">
                    <div className="nav-icon-box">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </div>
                    <span className="link-label">Home</span>
                </a>
                <a href="/family-manage.html" className="sidebar-link" data-route="families" data-title="Families">
                    <div className="nav-icon-box">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <span className="link-label">Families</span>
                </a>
                <a href="/entry.html" className="sidebar-link" data-route="entry" data-title="Data Entry">
                    <div className="nav-icon-box">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                            <path d="M9 14h6" />
                            <path d="M9 18h4" />
                            <path d="M12 10h.01" />
                        </svg>
                    </div>
                    <span className="link-label">Data Entry</span>
                </a>
                <a href="/analytics.html" className="sidebar-link" data-route="analytics" data-title="Analytics">
                    <div className="nav-icon-box">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                            <line x1="2" y1="20" x2="22" y2="20" />
                        </svg>
                    </div>
                    <span className="link-label">Analytics</span>
                </a>
                <a href="/profile.html" className="sidebar-link" data-route="profile" data-title="Profile">
                    <div className="nav-icon-box">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <span className="link-label">Profile</span>
                </a>
            </nav>
            <div className="sidebar-footer" id="authNavArea">
                <IndexUserBadge />
            </div>
        </aside>
    );
}

const cardBox = { background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' } as const;
const listStyle = { fontSize: '0.825rem', color: 'var(--text-secondary)', paddingLeft: '1.1rem', lineHeight: 1.7 } as const;
const headStyle = (color: string) => ({ color, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }) as const;
const stepBox = { border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' } as const;
const stepNum = { fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '0.25rem' } as const;
const stepTitle = { display: 'block', marginBottom: '0.25rem' } as const;
const stepText = { fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 } as const;

export function IndexApp() {
    const [cadet, setCadet] = useState<StudentSession | null>(null);
    const [stats, setStats] = useState<Stats>({ families: 0, members: 0, htn: '0%', dm: '0%' });

    useEffect(() => {
        removePreloadTransitions();
        initSidebar();
        return runWhenActive(() => {
            void (async () => {
                try {
                    const activeUser = getUser();
                    if (activeUser) setCadet(activeUser);
                    const statsRes = await fetch('/api/analytics/summary');
                    const s = (await statsRes.json()) as AnalyticsSummary | null;
                    setStats({
                        families: (s && s.totals && s.totals.families) || 0,
                        members: (s && s.totals && s.totals.members) || 0,
                        htn: ((s && s.adults && s.adults.htn_pct) || 0) + '%',
                        dm: ((s && s.adults && s.adults.dm_pct) || 0) + '%',
                    });
                } catch (err) {
                    console.error('Failed to load dashboard:', err);
                }
            })();
        });
    }, []);

    return (
        <BodyPortal>
            {/* Backdrop Overlay for Mobile Sliding Nav */}
            <div className="sidebar-overlay" id="sidebarOverlay" onClick={closeSidebar} />

            <Sidebar />

            {/* Mobile Drawer Toggle */}
            <button className="mobile-nav-toggle" id="mobileNavToggle" onClick={toggleSidebar} title="Toggle Navigation">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            {/* Main Content */}
            <main className="main-content">

                {/* Hero Section */}
                <div className="hero anim-fade-up">
                    <div className="hero-text">
                        <div className="anim-float-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(109, 40, 217, 0.08)', border: '1.5px solid rgba(109, 40, 217, 0.22)', padding: '4px 14px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 12, letterSpacing: '0.03em' }}>
                            <span className="role-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                            <span>PSM · Community Medicine Surveillance</span>
                        </div>
                        <div id="heroUserBadge" style={{ display: cadet ? 'inline-flex' : 'none', alignItems: 'center', gap: 8, marginBottom: 12, background: 'rgba(109, 40, 217, 0.12)', border: '1.5px solid rgba(109, 40, 217, 0.28)', borderRadius: 100, padding: '5px 16px', width: 'fit-content' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>👤 Authenticated Cadet:</span>
                            <span id="heroCadetInfo" style={{ fontSize: '0.82rem', fontWeight: 650, color: '#1e1b4b' }}>
                                {cadet ? `${cadet.name || 'Cadet'} (Roll ${cadet.roll_number}) • ${(cadet.posting_unit as string | undefined) || 'Community Medicine'}` : ''}
                            </span>
                        </div>
                        <h1 className="page-title-animated">Community Medicine Field Health System</h1>
                        <p>
                            A standardized, clinical data-entry and surveillance platform for medical colleges and MBBS students.
                            Record household socio-demographics, screen for non-communicable diseases, evaluate nutritional adequacy,
                            and track longitudinal patient follow-up visits in rural and urban field practice areas.
                        </p>
                        <div className="hero-actions">
                            <a href="/family-manage.html" className="btn btn-primary btn-lg">👥 Manage Families</a>
                            <a href="/entry.html" className="btn btn-secondary btn-lg">📝 Survey Data Entry</a>
                            <a href="/analytics.html" className="btn btn-secondary btn-lg">📊 Analytics</a>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="stats-grid anim-fade-up anim-delay-1">
                    <div className="stat-box">
                        <div className="title">Families Surveyed</div>
                        <div className="value" id="statFamilies">{stats.families}</div>
                        <div className="subtext">Active household units</div>
                    </div>
                    <div className="stat-box">
                        <div className="title">Total Individuals</div>
                        <div className="value" id="statMembers">{stats.members}</div>
                        <div className="subtext">Registered individuals</div>
                    </div>
                    <div className="stat-box stat-warning">
                        <div className="title">Adult HTN Prevalence</div>
                        <div className="value" id="statHtn">{stats.htn}</div>
                        <div className="subtext">SBP &ge; 140 or DBP &ge; 90 mmHg</div>
                    </div>
                    <div className="stat-box stat-warning">
                        <div className="title">Adult DM Prevalence</div>
                        <div className="value" id="statDm">{stats.dm}</div>
                        <div className="subtext">Random Blood Sugar &ge; 200 mg/dl</div>
                    </div>
                </div>

                {/* Feature Modules Grid */}
                <div className="features-grid anim-fade-up anim-delay-2">
                    <a href="/family-manage.html" className="feature-card">
                        <span className="feature-icon">👥</span>
                        <h3>Family &amp; Member Management</h3>
                        <p>Create households from scratch, stage family members, inspect baseline clinical records, and manage individual patient charts.</p>
                    </a>
                    <a href="/entry.html" className="feature-card">
                        <span className="feature-icon">📋</span>
                        <h3>Standardized Field Survey Entry</h3>
                        <p>Full 3-step structured digitization form with dynamic age-adaptive builders for adult NCDs, pediatric growth, and maternal RMNCH+A.</p>
                    </a>
                    <a href="/family-manage.html" className="feature-card">
                        <span className="feature-icon">🩺</span>
                        <h3>Longitudinal Follow-up Visits</h3>
                        <p>Log chronological patient re-examinations, track blood pressure and sugar control, therapy compliance, and clinical progress notes.</p>
                    </a>
                    <a href="/analytics.html" className="feature-card">
                        <span className="feature-icon">📊</span>
                        <h3>Epidemiological Audit Queries</h3>
                        <p>Run pre-built relational SQL reports for student survey audits, sex ratios, community anaemia burden, and malnutrition distributions.</p>
                    </a>
                </div>

                {/* Medical & Clinical Reference Guide for Field Students */}
                <div className="card anim-fade-up anim-delay-3">
                    <div className="section-title">
                        <span>Clinical Screening Criteria</span>
                        <span className="badge badge-info">Reference</span>
                    </div>
                    <p className="card-desc">Quick diagnostic reference values and field examination benchmarks used during family health postings:</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>

                        {/* Adult NCD Criteria */}
                        <div style={cardBox}>
                            <strong style={headStyle('var(--primary)')}>
                                Adult NCD Screening (Age &ge; 18)
                            </strong>
                            <ul style={listStyle}>
                                <li><strong>Hypertension:</strong> SBP &ge; 140 mmHg or DBP &ge; 90 mmHg</li>
                                <li><strong>Pre-Hypertension:</strong> SBP 120-139 or DBP 80-89</li>
                                <li><strong>Diabetes Mellitus:</strong> RBS &ge; 200 mg/dl (with symptoms)</li>
                                <li><strong>Severe Anaemia:</strong> Hb &lt; 7.0 g/dl | Moderate: 7.0-9.9 g/dl</li>
                                <li><strong>WHR Risk:</strong> &gt; 0.90 in Males, &gt; 0.85 in Females</li>
                            </ul>
                        </div>

                        {/* Pediatric Nutrition */}
                        <div style={cardBox}>
                            <strong style={headStyle('var(--warning-text)')}>
                                Pediatric Malnutrition (0-5 Yrs)
                            </strong>
                            <ul style={listStyle}>
                                <li><strong>MUAC &lt; 11.5 cm:</strong> Severe Acute Malnutrition (SAM)</li>
                                <li><strong>MUAC 11.5 - 12.5 cm:</strong> Moderate Malnutrition (MAM)</li>
                                <li><strong>MUAC &gt; 12.5 cm:</strong> Normal nutritional status</li>
                                <li><strong>Growth Screening:</strong> Verify Mamta Card &amp; Immunization</li>
                                <li><strong>Head vs Chest Circ:</strong> HC = CC at approx. 1 year of age</li>
                            </ul>
                        </div>

                        {/* ICMR Dietary Assessment */}
                        <div style={cardBox}>
                            <strong style={headStyle('var(--success-text)')}>
                                ICMR Dietary Units (CU Reference)
                            </strong>
                            <ul style={listStyle}>
                                <li><strong>Reference Adult Male (Sedentary):</strong> 1.0 CU (2400 kcal)</li>
                                <li><strong>Moderate Worker:</strong> 1.2 CU | <strong>Heavy Worker:</strong> 1.6 CU</li>
                                <li><strong>Adult Female:</strong> 0.8 CU (Sedentary) | 0.9 CU (Moderate)</li>
                                <li><strong>Calorie Adequacy:</strong> Deficient if daily intake &lt; requirement</li>
                                <li><strong>Dietary Advice:</strong> Balanced diet counseling for deficient households</li>
                            </ul>
                        </div>

                        {/* Maternal Health RMNCH+A */}
                        <div style={cardBox}>
                            <strong style={headStyle('#7c3aed')}>
                                Maternal Health (RMNCH+A)
                            </strong>
                            <ul style={listStyle}>
                                <li><strong>Antenatal Care:</strong> Minimum 4 ANC checkups recommended</li>
                                <li><strong>Institutional Delivery:</strong> Hospital/PHC vs Home birth</li>
                                <li><strong>Postnatal Care:</strong> Follow-up within 48h and 7 days</li>
                                <li><strong>Family Planning:</strong> Modern spacing / terminal methods</li>
                                <li><strong>IFA Supplementation:</strong> 180 tablets during pregnancy</li>
                            </ul>
                        </div>

                    </div>
                </div>

                {/* Student Field Workflow Guide */}
                <div className="card anim-fade-up anim-delay-4">
                    <h2 className="card-title">MBBS Field Survey Step-by-Step Workflow</h2>
                    <p className="card-desc">Standard operating procedure for manual survey record entry in community medicine:</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        <div style={stepBox}>
                            <div style={stepNum}>01</div>
                            <strong style={stepTitle}>Create Household</strong>
                            <p style={stepText}>
                                Register the family number, head of household, ward/village, and total family consumption units (CU).
                            </p>
                        </div>
                        <div style={stepBox}>
                            <div style={stepNum}>02</div>
                            <strong style={stepTitle}>Add Family Members</strong>
                            <p style={stepText}>
                                Record demographics and clinical screening for each individual. The form adapts automatically by age group.
                            </p>
                        </div>
                        <div style={stepBox}>
                            <div style={stepNum}>03</div>
                            <strong style={stepTitle}>Log Follow-Up Visits</strong>
                            <p style={stepText}>
                                Revisit hypertensive, diabetic, or anaemic individuals to record follow-up blood pressure, sugar, and compliance.
                            </p>
                        </div>
                        <div style={stepBox}>
                            <div style={stepNum}>04</div>
                            <strong style={stepTitle}>Run College Audits</strong>
                            <p style={stepText}>
                                Execute relational SQL queries to analyze morbidity rates, sex ratios, and nutritional trends across batches.
                            </p>
                        </div>
                    </div>
                </div>

            </main>
        </BodyPortal>
    );
}
