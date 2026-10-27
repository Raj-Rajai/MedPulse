import type { ReactNode } from 'react';
import { SidebarUserBadge } from '../../../shared/SidebarUserBadge';
import { useNavGlider } from '../../../shared/nav-glider';
import { closeAdminSidebar, toggleAdminSidebar } from '../lib/sidebar';
import type { AdminTab } from '../types';

const svg = (children: ReactNode) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const NAV: { tab: AdminTab; title: string; label: string; icon: ReactNode }[] = [
    { tab: 'overview', title: 'Analysis', label: 'Analysis', icon: svg(<>
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </>) },
    { tab: 'students', title: 'Cadets', label: 'Student Cadre', icon: svg(<>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>) },
    // Attendance, Schedule, Exam marks and University admins are no longer linked from the console;
    // their sections stay in ./sections.
    { tab: 'households', title: 'Households', label: 'Global Households', icon: svg(<>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </>) },
    { tab: 'campaigns', title: 'Campaigns', label: 'Campaigns', icon: svg(<>
        <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>) },
    { tab: 'exports', title: 'Master Exports', label: 'Master Data Exports', icon: svg(<>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </>) },
    { tab: 'config', title: 'Admin Config', label: 'Admin Config', icon: svg(<>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </>) },
];

/**
 * The links keep the original `href="javascript:void(0)"` attribute (React 19 would rewrite a
 * javascript: href passed as a prop), so it is set once on the element.
 */
const jsVoidHref = (el: HTMLAnchorElement | null) => {
    if (el && !el.hasAttribute('href')) el.setAttribute('href', 'javascript:void(0)');
};

export function AdminSidebar({ activeTab, onSelect }: { activeTab: AdminTab; onSelect: (tab: AdminTab) => void }) {
    useNavGlider();
    return (
        <>
            {/* Backdrop Overlay for Mobile Sliding Nav */}
            <div className="sidebar-overlay" id="sidebarOverlay" onClick={closeAdminSidebar}></div>

            {/* Collapsible Dock Sidebar */}
            <aside className="sidebar" id="sidebar">
                <div className="sidebar-header">
                    <a href="/admin.html" className="sidebar-logo" title="SAL Education • Admin Console">
                        <div className="logo-icon" style={{ background: '#ffffff', padding: 2 }}>
                            <img src="/images/sal-logo.png" alt="SAL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
                        </div>
                        <div className="logo-text-group">
                            <span className="logo-title">SAL Education</span>
                            <span className="logo-subtitle" style={{ color: '#f59e0b', fontWeight: 750 }}>ADMIN CONSOLE</span>
                        </div>
                    </a>
                    <button className="sidebar-toggle-btn" id="sidebarToggleBtn" onClick={toggleAdminSidebar} title="Toggle Sidebar">
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

                {/* Administrative Navigation */}
                <nav className="sidebar-nav" id="adminSidebarNav">
                    {NAV.map((n) => (
                        <a
                            key={n.tab}
                            ref={jsVoidHref}
                            className={`sidebar-link${activeTab === n.tab ? ' active' : ''}`}
                            data-tab={n.tab}
                            data-title={n.title}
                            onClick={(e) => { e.preventDefault(); onSelect(n.tab); }}
                        >
                            <div className="nav-icon-box">{n.icon}</div>
                            <span className="link-label">{n.label}</span>
                        </a>
                    ))}
                </nav>

                <div className="sidebar-footer" id="authNavArea"><SidebarUserBadge /></div>
            </aside>

            {/* Mobile Drawer Toggle */}
            <button className="mobile-nav-toggle" id="mobileNavToggle" onClick={toggleAdminSidebar} title="Toggle Navigation">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>
        </>
    );
}
