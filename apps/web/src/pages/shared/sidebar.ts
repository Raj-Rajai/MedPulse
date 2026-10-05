/**
 * Sidebar controls of the shared pages (index.html / register.html inline scripts).
 * Unlike the shared nav-glider toggleSidebar(), these also collapse the dock on desktop.
 */
const MOBILE_MAX = 860;

export function toggleSidebar(): void {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= MOBILE_MAX) {
        if (!sb) return;
        const isOpen = sb.classList.toggle('open');
        if (ov) ov.classList.toggle('active', isOpen);
    } else {
        const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    }
}

export function closeSidebar(): void {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= MOBILE_MAX) {
        if (sb) sb.classList.remove('open');
        if (ov) ov.classList.remove('active');
    } else {
        document.documentElement.classList.add('sidebar-collapsed');
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebar_collapsed', '1');
    }
}

/** Apply the stored collapsed state on desktop; always expanded on mobile widths. */
export function initSidebar(): void {
    const stored = localStorage.getItem('sidebar_collapsed');
    const isCollapsed = (stored === '1' || stored === 'true') && window.innerWidth > MOBILE_MAX;
    document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed);
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
}
