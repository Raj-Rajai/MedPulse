/** Offline page support (frontend/shared/pwa.js). */
export function registerServiceWorker(): void {
    if ('serviceWorker' in navigator && window.isSecureContext) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((error) => {
                console.warn('App offline support unavailable:', error);
            });
        });
    }
}
