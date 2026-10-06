import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { installAuthGuard } from './auth-guard';
import { registerServiceWorker } from './pwa';
import { installDatePicker } from './ui/date-picker';

/**
 * Standard page bootstrap: auth guard first (may redirect), then React.
 * `pwa` registers the offline service worker on pages that loaded pwa.js before.
 */
export function mountPage(render: () => ReactNode, opts: { pwa?: boolean; rootId?: string } = {}): void {
    if (!installAuthGuard()) return;
    if (opts.pwa) registerServiceWorker();
    installDatePicker();
    const el = document.getElementById(opts.rootId || 'root');
    if (!el) throw new Error('Missing #root element');
    createRoot(el).render(<StrictMode>{render()}</StrictMode>);
}
