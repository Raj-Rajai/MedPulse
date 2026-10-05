/**
 * The admin page's own sidebar behaviour (it overrode the shared toggleSidebar/closeSidebar):
 * on desktop the toggle collapses the dock and remembers it in localStorage, on mobile it slides
 * the drawer. Same 860px breakpoint and keys as the original.
 */
import { updateSidebarGlider } from '../../../shared/nav-glider';

const html = () => document.documentElement;

export function toggleAdminSidebar(): void {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= 860) {
        if (!sb) return;
        const isOpen = sb.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active', isOpen);
    } else {
        const isCollapsed = html().classList.toggle('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
        setTimeout(updateSidebarGlider, 280);
    }
}

export function closeAdminSidebar(): void {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= 860) {
        if (sb) sb.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    } else {
        html().classList.add('sidebar-collapsed');
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebar_collapsed', '1');
        setTimeout(updateSidebarGlider, 280);
    }
}

/** initSidebar(): sync the collapsed state to html+body (desktop only). */
export function initAdminSidebar(): void {
    const stored = localStorage.getItem('sidebar_collapsed');
    const isCollapsed = (stored === '1' || stored === 'true') && window.innerWidth > 860;
    html().classList.toggle('sidebar-collapsed', isCollapsed);
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
}
