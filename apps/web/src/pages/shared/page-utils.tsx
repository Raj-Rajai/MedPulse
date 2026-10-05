/**
 * Small helpers shared by the shared/ pages (login, register, index).
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * style.css hides every direct <body> child that is not main/aside/header/#sidebar/... (the
 * "rogue right-side panel" rule), which would hide #root. The original pages put their
 * markup directly in <body>, so render it there too: #root stays an empty, hidden node and
 * the page elements become body children exactly as before.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
    return createPortal(children, document.body);
}

/** Remove preload-transitions after a double rAF so the first paint has no transition jumps. */
export function removePreloadTransitions(): void {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.documentElement.classList.remove('preload-transitions');
        });
    });
}

/** Run the callback now if the document is visible, otherwise once it becomes visible. */
export function runWhenActive(callback: () => void): () => void {
    if (document.visibilityState === 'visible') {
        callback();
        return () => {};
    }
    const onVisible = () => {
        if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', onVisible);
            callback();
        }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
}

export const Arrow = '→';
