/**
 * Page shell helpers. style.css hides any direct <body> child that is not one of the known
 * layout elements, so #root stays empty and every page renders straight into <body> through
 * a portal, in the same element order as the original markup.
 */
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavGlider } from '../../../shared/nav-glider';
import { initSidebar, publishSidebar, removePreloadTransitions, type SidebarControls } from './sidebar';

export function BodyPortal({ children }: { children: ReactNode }) {
    return createPortal(children, document.body);
}

/**
 * Sidebar bootstrap shared by the pages: publishes window.toggleSidebar/closeSidebar,
 * runs initSidebar() (unless the page did not), removes preload-transitions and starts the glider.
 */
export function useStudentChrome(controls: SidebarControls, opts: { init?: boolean; preloadFrames?: number } = {}): void {
    const { init = true, preloadFrames = 2 } = opts;
    useEffect(() => {
        publishSidebar(controls);
        if (init) initSidebar();
        removePreloadTransitions(preloadFrames > 0 ? preloadFrames : 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useNavGlider();
}
