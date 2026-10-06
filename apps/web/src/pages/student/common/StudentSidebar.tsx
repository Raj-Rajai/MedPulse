/**
 * The dark collapsible sidebar shared by every student page (the <aside> block that each
 * original page repeated verbatim), plus the backdrop overlay and the mobile drawer button.
 * Each page passes its own active link, its own sidebar handlers and its own user badge.
 */
import type { ReactNode } from 'react';
import { toggleNavGroup } from '../../../shared/nav-glider';

export type StudentRoute = 'profile' | 'schedule' | 'attendance' | 'exams' | 'home' | 'families' | 'entry' | 'analytics';

interface SidebarProps {
    active: StudentRoute;
    logoTitle?: string;
    onToggle: () => void;
    badge: ReactNode;
}

const cls = (active: boolean, sub = false) => `sidebar-link${sub ? ' sidebar-sublink' : ''}${active ? ' active' : ''}`;

const icon = { width: '19', height: '19', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function SidebarOverlay({ onClose }: { onClose: () => void }) {
    return <div className="sidebar-overlay" id="sidebarOverlay" onClick={onClose} />;
}

export function MobileNavToggle({ onToggle }: { onToggle: () => void }) {
    return (
        <button className="mobile-nav-toggle" id="mobileNavToggle" onClick={onToggle} title="Toggle Navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
        </button>
    );
}

export function StudentSidebar({ active, logoTitle = 'SAL Education • MedPulse Health Portal', onToggle, badge }: SidebarProps) {
    const inGroup = active === 'home' || active === 'families' || active === 'entry' || active === 'analytics';
    return (
        <aside className="sidebar" id="sidebar">
            <div className="sidebar-header">
                <a href="/" className="sidebar-logo" title={logoTitle}>
                    <div className="logo-icon" style={{ background: '#ffffff', padding: '2px' }}>
                        <img src="/images/sal-logo.png" alt="SAL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="logo-text-group">
                        <span className="logo-label">SAL Education</span>
                        <span className="logo-sublabel">HEALTH PORTAL</span>
                    </div>
                </a>
                <button className="sidebar-toggle-btn" id="sidebarToggleBtn" onClick={onToggle} title="Toggle Sidebar">
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
                <a href="/profile.html" className={cls(active === 'profile')} data-route="profile" data-title="Profile">
                    <div className="nav-icon-box">
                        <svg {...icon}>
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <span className="link-label">Profile</span>
                </a>
                <a href="/schedule.html" className={cls(active === 'schedule')} data-route="schedule" data-title="Schedule">
                    <div className="nav-icon-box">
                        <svg {...icon}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <span className="link-label">Schedule</span>
                </a>
                <a href="/attendance.html" className={cls(active === 'attendance')} data-route="attendance" data-title="Attendance">
                    <div className="nav-icon-box">
                        <svg {...icon}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <path d="m9 16 2 2 4-4" />
                        </svg>
                    </div>
                    <span className="link-label">Attendance</span>
                </a>
                <a href="/exams.html" className={cls(active === 'exams')} data-route="exams" data-title="Exams">
                    <div className="nav-icon-box">
                        <svg {...icon}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <span className="link-label">Exams</span>
                </a>
                <div className={inGroup ? 'sidebar-nav-group open has-active-child' : 'sidebar-nav-group'} id="navGroupCommMed">
                    <button
                        type="button" className="sidebar-link sidebar-group-toggle" id="btnGroupCommMed" onClick={() => toggleNavGroup('navGroupCommMed')}
                        title="Community Medicine" data-route="community-medicine" data-title="Community Medicine"
                    >
                        <div className="nav-icon-box">
                            <svg {...icon}>
                                <path d="M4.5 3v6a6 6 0 0 0 12 0V3" />
                                <path d="M4.5 3H3m15 0h1.5" />
                                <path d="M10.5 15v3a3 3 0 0 0 6 0v-1" />
                                <circle cx="16.5" cy="17" r="1.5" />
                            </svg>
                        </div>
                        <span className="link-label">Community Medicine</span>
                        <svg className="group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    <div className="sidebar-subnav" id="subnavCommMed">
                        <a href="/index.html" className={cls(active === 'home', true)} data-route="home" data-title="Home">
                            <div className="nav-icon-box">
                                <svg {...icon}>
                                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                            <span className="link-label">Home</span>
                        </a>
                        <a href="/family-manage.html" className={cls(active === 'families', true)} data-route="families" data-title="Families">
                            <div className="nav-icon-box">
                                <svg {...icon}>
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <span className="link-label">Families</span>
                        </a>
                        <a href="/entry.html" className={cls(active === 'entry', true)} data-route="entry" data-title="Data Entry">
                            <div className="nav-icon-box">
                                <svg {...icon}>
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                    <path d="M9 14h6" />
                                    <path d="M9 18h4" />
                                    <path d="M12 10h.01" />
                                </svg>
                            </div>
                            <span className="link-label">Data Entry</span>
                        </a>
                        <a href="/analytics.html" className={cls(active === 'analytics', true)} data-route="analytics" data-title="Analytics">
                            <div className="nav-icon-box">
                                <svg {...icon}>
                                    <line x1="18" y1="20" x2="18" y2="10" />
                                    <line x1="12" y1="20" x2="12" y2="4" />
                                    <line x1="6" y1="20" x2="6" y2="14" />
                                    <line x1="2" y1="20" x2="22" y2="20" />
                                </svg>
                            </div>
                            <span className="link-label">Analytics</span>
                        </a>
                    </div>
                </div>
            </nav>
            <div className="sidebar-footer" id="authNavArea">{badge}</div>
        </aside>
    );
}
