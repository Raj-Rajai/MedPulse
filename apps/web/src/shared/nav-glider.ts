/**
 * Navigation state helper for sidebar (accordion groups and mobile drawer).
 * Sliding glider animations removed to keep navigation simple, smooth, and instant.
 */
import { useEffect } from 'react';

const nav = () => document.querySelector<HTMLElement>('.sidebar-nav');

function initNavGroups(): void {
    const n = nav();
    if (!n) return;

    // Clean up any legacy glider DOM element
    const glider = document.getElementById('sidebarGlider');
    if (glider) glider.remove();

    try {
        sessionStorage.removeItem('medpulse_glider_pos');
    } catch {
        /* ignore */
    }

    n.querySelectorAll('.sidebar-nav-group').forEach((group) => {
        if (group.querySelector('.sidebar-sublink.active') || group.classList.contains('has-active-child')) {
            group.classList.add('open', 'has-active-child');
        } else if (localStorage.getItem('medpulse_' + group.id + '_open') === '1') {
            group.classList.add('open');
        }
    });
}

export function updateSidebarGlider(): void {
    const glider = document.getElementById('sidebarGlider');
    if (glider) glider.remove();
}

/** Sidebar open/close on mobile */
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
    document.body.classList.remove('sidebar-mobile-open');
}

/** Expand/collapse a sidebar link group, remembering choice (window.toggleNavGroup). */
export function toggleNavGroup(groupId: string): void {
    const group = document.getElementById(groupId);
    if (!group) return;
    const isOpen = group.classList.toggle('open');
    try {
        localStorage.setItem('medpulse_' + groupId + '_open', isOpen ? '1' : '0');
    } catch {
        /* ignore */
    }
}

/** Apply remembered collapsed-sidebar state before first paint. */
export function applyStoredSidebarCollapsed(): void {
    try {
        const c = localStorage.getItem('sidebar_collapsed') || localStorage.getItem('medpulse_sidebar_collapsed');
        const isCollapsed = (c === '1' || c === 'true') && typeof window !== 'undefined' && window.innerWidth > 860;
        document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed);
        if (document.body) {
            document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        }
    } catch {
        /* ignore */
    }
}

export function useNavGlider(): void {
    useEffect(() => {
        initNavGroups();
        Object.assign(window, { updateSidebarGlider, toggleNavGroup });
    }, []);
}

