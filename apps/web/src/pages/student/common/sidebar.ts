/**
 * The three flavours of sidebar controls the student pages carried inline.
 *  - standard: profile, attendance, exams, analytics, entry, family-manage
 *  - schedule: schedule.html (body.sidebar-mobile-open on phones, fires a resize event)
 *  - index: frontend/shared/app.js toggleSidebar / closeSidebar (mobile drawer only)
 * Each page also publishes its pair as window.toggleSidebar / window.closeSidebar, because the
 * shared nav-glider's group toggle calls window.toggleSidebar when the dock is collapsed.
 */
const MOBILE_MAX = 860;

export interface SidebarControls {
    toggle: () => void;
    close: () => void;
}

const sb = () => document.getElementById('sidebar');
const ov = () => document.getElementById('sidebarOverlay');

function collapseToggle(): void {
    const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
}

export const standardSidebar: SidebarControls = {
    toggle() {
        if (window.innerWidth <= MOBILE_MAX) {
            const isOpen = sb()!.classList.toggle('open');
            ov()?.classList.toggle('active', isOpen);
        } else collapseToggle();
    },
    close() {
        if (window.innerWidth <= MOBILE_MAX) {
            sb()?.classList.remove('open');
            ov()?.classList.remove('active');
        } else {
            document.documentElement.classList.add('sidebar-collapsed');
            document.body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebar_collapsed', '1');
        }
    },
};

export const scheduleSidebar: SidebarControls = {
    toggle() {
        if (window.innerWidth <= MOBILE_MAX) {
            const open = document.body.classList.toggle('sidebar-mobile-open');
            ov()?.classList.toggle('active', open);
        } else collapseToggle();
        window.dispatchEvent(new Event('resize'));
    },
    close() {
        document.body.classList.remove('sidebar-mobile-open');
        ov()?.classList.remove('active');
    },
};

export const indexSidebar: SidebarControls = standardSidebar;

/** initSidebar(): sync the stored collapsed state on desktop, always expanded on phones. */
export function initSidebar(): void {
    const stored = localStorage.getItem('sidebar_collapsed');
    const isCollapsed = (stored === '1' || stored === 'true') && window.innerWidth > MOBILE_MAX;
    document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed);
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
}

export function publishSidebar(c: SidebarControls): void {
    Object.assign(window, { toggleSidebar: c.toggle, closeSidebar: c.close });
}

/** Remove preload-transitions after a double rAF (most pages) or a single one (index.html). */
export function removePreloadTransitions(frames = 2): void {
    const run = () => document.documentElement.classList.remove('preload-transitions');
    if (frames === 1) requestAnimationFrame(run);
    else requestAnimationFrame(() => requestAnimationFrame(run));
}
