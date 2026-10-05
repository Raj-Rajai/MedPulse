/** Patient sidebar (static nav of patient.html; links switch tabs instead of navigating). */
import type { MouseEvent, ReactNode } from 'react';
import { useT } from './i18n';
import type { TabId } from './types';

const svgProps = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const LINKS: { tab: TabId; title: string; icon: ReactNode }[] = [
    { tab: 'overview', title: 'Overview', icon: <svg {...svgProps}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
    { tab: 'profile', title: 'My Health Card', icon: <svg {...svgProps}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.5" /><path d="M13 10h5M13 14h3" /></svg> },
    { tab: 'family', title: 'My Family', icon: <svg {...svgProps}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    { tab: 'hospital', title: 'Call Hospital', icon: <svg {...svgProps}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg> },
    { tab: 'campaigns', title: 'Health Camps', icon: <svg {...svgProps}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg> },
    { tab: 'records', title: 'Health Records', icon: <svg {...svgProps}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></svg> },
];

export function Sidebar({ tab, open, onToggle, onTab, badge }: { tab: TabId; open: boolean; onToggle: () => void; onTab: (t: TabId) => void; badge: ReactNode }) {
    const t = useT();
    const go = (e: MouseEvent, x: TabId) => { e.preventDefault(); onTab(x); };
    return (
        <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
            <div className="sidebar-header">
                <a href="/" className="sidebar-logo" title={t('MedPulse Health Portal')}>
                    <div className="logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    </div>
                    <div className="logo-text-group">
                        <span className="logo-label">{t('MedPulse')}</span>
                        <span className="logo-sublabel">{t('HEALTH PORTAL')}</span>
                    </div>
                </a>
                <button className="sidebar-toggle-btn" id="sidebarToggleBtn" onClick={onToggle} title={t('Toggle Sidebar')}>
                    <svg className="icon-collapse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    <svg className="icon-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                </button>
            </div>
            <nav className="sidebar-nav">
                {LINKS.map((l) => (
                    <a key={l.tab} href={`#${l.tab}`} className={`sidebar-link${l.tab === tab ? ' active' : ''}`} data-tab={l.tab} data-title={t(l.title)} onClick={(e) => go(e, l.tab)}>
                        <div className="nav-icon-box">{l.icon}</div>
                        <span className="link-label">{t(l.title)}</span>
                    </a>
                ))}
            </nav>
            <div className="sidebar-footer" id="authNavArea">{badge}</div>
        </aside>
    );
}
