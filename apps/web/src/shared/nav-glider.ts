/**
 * iPhone-style sliding active-link "glider" for the dark sidebar (frontend/shared/nav-glider.js).
 * This is a purely visual effect over the rendered sidebar, so it stays an imperative DOM
 * enhancement; React owns the sidebar markup and the active link.
 *
 * Usage: call `useNavGlider()` once in the component that renders `.sidebar-nav`.
 */
import { useEffect } from 'react';

interface Metrics { top: number; left: number; width: number; height: number }

const TRANSITION =
    'top 0.28s cubic-bezier(0.16, 1, 0.3, 1), left 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1), height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.16s ease';

function getLinkMetrics(link: Element | null, nav: HTMLElement | null): Metrics | null {
    if (!link || !nav) return null;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    // DOM rectangles include CSS zoom; absolute positioning uses local CSS pixels.
    const scale = navRect.width / parseFloat(getComputedStyle(nav).width) || 1;
    return {
        top: (linkRect.top - navRect.top) / scale + nav.scrollTop - nav.clientTop,
        left: (linkRect.left - navRect.left) / scale + nav.scrollLeft - nav.clientLeft,
        width: linkRect.width / scale,
        height: linkRect.height / scale,
    };
}

const nav = () => document.querySelector<HTMLElement>('.sidebar-nav');
const gliderEl = () => document.getElementById('sidebarGlider');

function getOrCreateGlider(n: HTMLElement): HTMLElement {
    let glider = gliderEl();
    if (!glider) {
        glider = document.createElement('div');
        glider.id = 'sidebarGlider';
        glider.className = 'sidebar-glider';
        n.insertBefore(glider, n.firstChild);
    }
    return glider;
}

function isLinkVisible(link: HTMLElement | null): boolean {
    if (!link) return false;
    if (link.offsetParent === null) return false;
    const parentGroup = link.closest('.sidebar-nav-group');
    if (parentGroup && !parentGroup.classList.contains('open')) return false;
    const subnav = link.closest('.sidebar-subnav');
    if (subnav) {
        if (getComputedStyle(subnav).visibility === 'hidden') return false;
        if (subnav.getBoundingClientRect().height <= 0) return false;
    }
    const rect = link.getBoundingClientRect();
    return !(rect.width === 0 || rect.height === 0);
}

function place(glider: HTMLElement, m: Metrics) {
    glider.style.top = `${m.top}px`;
    glider.style.left = `${m.left}px`;
    glider.style.width = `${m.width}px`;
    glider.style.height = `${m.height}px`;
}

function hide(glider: HTMLElement) {
    glider.style.opacity = '0';
    glider.style.pointerEvents = 'none';
}

function setDirect(glider: HTMLElement, metrics: Metrics) {
    glider.style.transition = 'none';
    place(glider, metrics);
    glider.style.opacity = '1';
    requestAnimationFrame(() => {
        glider.style.transition = TRANSITION;
    });
}

function handleLinkClick(this: HTMLElement, e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = this;
    if (link.classList.contains('sidebar-group-toggle')) return;
    const n = nav();
    const glider = gliderEl();
    if (!glider || !n) return;
    if (link.classList.contains('active')) return;
    const targetMetrics = getLinkMetrics(link, n);
    if (!targetMetrics) return;
    sessionStorage.setItem('medpulse_glider_pos', JSON.stringify(getLinkMetrics(glider, n)));
    glider.style.transition = TRANSITION;
    place(glider, targetMetrics);
    n.querySelectorAll('.sidebar-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    const href = link.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('javascript')) {
        e.preventDefault();
        setTimeout(() => {
            window.location.href = href;
        }, 180);
    }
}

function initGlider(): void {
    const n = nav();
    if (!n) return;
    n.querySelectorAll('.sidebar-nav-group').forEach((group) => {
        if (group.querySelector('.sidebar-sublink.active') || group.classList.contains('has-active-child')) {
            group.classList.add('open', 'has-active-child');
        } else if (localStorage.getItem('medpulse_' + group.id + '_open') === '1') {
            group.classList.add('open');
        }
    });

    const glider = getOrCreateGlider(n);
    const activeLink = n.querySelector<HTMLElement>('.sidebar-link.active');
    if (!activeLink || !isLinkVisible(activeLink)) return hide(glider);

    const targetMetrics = getLinkMetrics(activeLink, n);
    if (!targetMetrics || targetMetrics.width === 0 || targetMetrics.height === 0) {
        requestAnimationFrame(initGlider);
        return;
    }

    const prevPosStr = sessionStorage.getItem('medpulse_glider_pos');
    if (prevPosStr) {
        try {
            const prevPos = JSON.parse(prevPosStr) as Metrics;
            sessionStorage.removeItem('medpulse_glider_pos');
            glider.style.transition = 'none';
            place(glider, prevPos);
            glider.style.opacity = '1';
            void glider.offsetHeight;
            requestAnimationFrame(() => {
                glider.style.transition = TRANSITION;
                place(glider, targetMetrics);
            });
        } catch {
            setDirect(glider, targetMetrics);
        }
    } else {
        setDirect(glider, targetMetrics);
    }

    n.querySelectorAll<HTMLElement>('.sidebar-link').forEach((link) => {
        link.removeEventListener('click', handleLinkClick);
        link.addEventListener('click', handleLinkClick);
    });
}

export function updateSidebarGlider(): void {
    const n = nav();
    const glider = gliderEl();
    if (!n || !glider) return;
    const activeLink = n.querySelector<HTMLElement>('.sidebar-link.active');
    if (!activeLink || !isLinkVisible(activeLink)) return hide(glider);
    const metrics = getLinkMetrics(activeLink, n);
    if (metrics && metrics.width > 0 && metrics.height > 0) {
        place(glider, metrics);
        glider.style.opacity = '1';
    } else {
        hide(glider);
    }
}

/** Sidebar open/close on mobile (frontend/shared/app.js toggleSidebar / closeSidebar). */
export function toggleSidebar(): void {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (!sb) return;
    const isOpen = sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active', isOpen);
}
export function closeSidebar(): void {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
}

/** Expand/collapse a sidebar link group, remembering the choice (window.toggleNavGroup). */
export function toggleNavGroup(groupId: string): void {
    const group = document.getElementById(groupId);
    if (!group) return;
    if (document.documentElement.classList.contains('sidebar-collapsed') || document.body.classList.contains('sidebar-collapsed')) {
        const t = (window as unknown as { toggleSidebar?: () => void }).toggleSidebar;
        (t || toggleSidebar)();
    }
    const isOpen = group.classList.toggle('open');
    try {
        localStorage.setItem('medpulse_' + groupId + '_open', isOpen ? '1' : '0');
    } catch {
        /* ignore */
    }
    const glider = gliderEl();
    if (glider && !isOpen && group.querySelector('.sidebar-link.active')) hide(glider);
    setTimeout(updateSidebarGlider, isOpen ? 220 : 0);
}

/** Apply the remembered collapsed-sidebar state before first paint (inline script in the original pages). */
export function applyStoredSidebarCollapsed(): void {
    try {
        const c = localStorage.getItem('sidebar_collapsed');
        if (c === '1' || c === 'true') document.documentElement.classList.add('sidebar-collapsed');
    } catch {
        /* ignore */
    }
}

export function useNavGlider(): void {
    useEffect(() => {
        initGlider();
        const onUnload = () => {
            const glider = gliderEl();
            const n = nav();
            if (glider && n) {
                const m = getLinkMetrics(glider, n);
                if (m && m.width > 0 && m.height > 0) sessionStorage.setItem('medpulse_glider_pos', JSON.stringify(m));
            }
        };
        const onTransition = (e: TransitionEvent) => {
            if (e.propertyName === 'width') updateSidebarGlider();
        };
        window.addEventListener('beforeunload', onUnload);
        window.addEventListener('resize', updateSidebarGlider);
        const n = nav();
        const ro = n && 'ResizeObserver' in window ? new ResizeObserver(() => updateSidebarGlider()) : null;
        if (n && ro) ro.observe(n);
        const sidebar = document.getElementById('sidebar');
        sidebar?.addEventListener('transitionend', onTransition);
        Object.assign(window, { updateSidebarGlider, toggleNavGroup });
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            window.removeEventListener('resize', updateSidebarGlider);
            ro?.disconnect();
            sidebar?.removeEventListener('transitionend', onTransition);
        };
    }, []);
}
