import type { ReactNode } from 'react';
import { SidebarUserBadge } from '../../../shared/SidebarUserBadge';
import { useNavGlider } from '../../../shared/nav-glider';
import { closeAdminSidebar, toggleAdminSidebar } from '../lib/sidebar';
import type { AdminTab } from '../types';

const svg = (children: ReactNode) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const NAV: { tab: AdminTab; title: string; label: string; icon: ReactNode }[] = [
    { tab: 'overview', title: 'Overview', label: 'Executive Overview', icon: svg(<>
        <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </>) },
    { tab: 'students', title: 'Cadets', label: 'Student Cadre', icon: svg(<>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>) },
    { tab: 'attendance', title: 'Attendance', label: 'Student Attendance', icon: svg(<>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="m9 16 2 2 4-4" />
    </>) },
    { tab: 'schedule', title: 'Schedule', label: 'Academic Schedule', icon: svg(<>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="14" r="2" />
    </>) },
    { tab: 'exams', title: 'Exam Marks', label: 'Exam Results & Marks', icon: svg(<>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </>) },
    { tab: 'households', title: 'Households', label: 'Global Households', icon: svg(<>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </>) },
    { tab: 'campaigns', title: 'Campaigns', label: 'Campaigns', icon: svg(<>
        <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>) },
    { tab: 'uniAdmins', title: 'University Admins', label: 'University Admins', icon: svg(<>
        <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
    </>) },
    { tab: 'exports', title: 'Master Exports', label: 'Master Data Exports', icon: svg(<>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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
