/**
 * Port of frontend/shared/field-location.js (loaded by entry.html and family-manage.html).
 *
 * - installFieldLocation() wraps window.fetch (after the auth guard, like the script order in the
 *   original <head>): POST/PUT/PATCH/DELETE to the field-data APIs first verify the device location
 *   and send it as the X-Field-Location header; a failure answers with a synthetic 403.
 * - <LocationVerificationCard/> is the "Village Location Verification" panel the script injected
 *   into <main>; its status line and colours come from the shared store below.
 */
import { useSyncExternalStore, type CSSProperties } from 'react';

interface FieldLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

interface LocationState {
    text: string;
    color: string;
    verified: boolean;
    busy: boolean;
}

const ACCENT = 'var(--accent, #6d28d9)';
let state: LocationState = { text: 'Loading permitted area…', color: ACCENT, verified: false, busy: false };
const listeners = new Set<() => void>();
const emit = (patch: Partial<LocationState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

function setStatus(text: string, isSuccess = false, isError = false): void {
    emit({ text, color: isSuccess ? '#059669' : isError ? '#dc2626' : ACCENT });
}

const fieldPath = /^\/api\/(?:families|members|conditions|medications|allergies|history|follow-ups)(?:\/|$)|^\/api\/students\/provision-patient\/?$|^\/api\/student\/campaign-tasks(?:\/|$)/;
let nativeFetch: typeof window.fetch = (...args) => window.fetch(...args);
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let verifiedLocation: FieldLocation | null = null;
let installed = false;

function locate(): Promise<FieldLocation> {
    return new Promise((resolve, reject) => {
        if (!window.isSecureContext) return reject(new Error('Location requires HTTPS or localhost. Open the secure portal address.'));
        if (!navigator.geolocation) return reject(new Error('This browser does not support location. Use a location-enabled device.'));
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
            }),
            (error) => reject(new Error(error.code === 1
                ? 'Location permission denied. Allow location in your browser settings, then try again.'
                : error.code === 3 ? 'Location timed out. Move outdoors and try again.'
                    : 'Location unavailable. Turn on device location and try again.')),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
    });
}

async function verify(): Promise<FieldLocation> {
    setStatus('Checking your current location…');
    const location = await locate();
    const response = await nativeFetch('/api/student/geofence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Location verification failed.');
    verifiedLocation = location;
    setStatus('✓ Inside permitted area. You can enter data; location will be checked again when you save.', true);
    emit({ verified: true });
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
        verifiedLocation = null;
        setStatus('Location check expired. Check your location again to continue entering data.', false, true);
        emit({ verified: false });
    }, 60000);
    return location;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Install the fetch wrapper and load the permitted area (idempotent). */
export function installFieldLocation(): void {
    if (installed) return;
    installed = true;
    nativeFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (url.origin !== window.location.origin || !fieldPath.test(url.pathname) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return nativeFetch(input, init);
        }
        try {
            const location = verifiedLocation || (await verify());
            const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            headers.set('X-Field-Location', JSON.stringify(location));
            const response = await nativeFetch(input, { ...init, headers });
            if (response.status === 403) {
                const data = await response.clone().json();
                if (data.code === 'LOCATION_REQUIRED') {
                    verifiedLocation = null;
                    setStatus(data.error, false, true);
                }
            }
            return response;
        } catch (error) {
            verifiedLocation = null;
            setStatus(errText(error), false, true);
            return new Response(JSON.stringify({ error: errText(error) }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
    };

    (async () => {
        try {
            const response = await nativeFetch('/api/student/geofence', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load permitted area.');
            if (data.area) {
                setStatus(`Permitted area: ${data.area.name}, within ${data.area.radius} metres. Enable location to begin.`);
            } else {
                setStatus('Your administrator must configure the village area before field entry is available.', false, true);
            }
        } catch (error) {
            setStatus(errText(error), false, true);
        }
    })();
}

async function checkAgain(): Promise<void> {
    emit({ busy: true });
    try {
        await verify();
    } catch (error) {
        setStatus(errText(error), false, true);
    } finally {
        emit({ busy: false });
    }
}

const cardStyle: CSSProperties = {
    padding: '16px 20px', marginBottom: '20px', border: '1.5px solid var(--accent, #6d28d9)', background: '#ffffff',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)',
};

/** `buttonLabel`: family-manage.html renamed the button to "Check location" (and moved the card to the end of <main>). */
export function LocationVerificationCard({ buttonLabel = '📍 Enable location / Check again' }: { buttonLabel?: string }) {
    const s = useSyncExternalStore(subscribe, () => state);
    const style: CSSProperties = s.verified ? { ...cardStyle, borderColor: '#10b981', background: '#f0fdf4' } : cardStyle;
    return (
        <section className="card anim-fade-up" id="locationVerificationCard" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: '1', minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1.15rem' }}>📍</span>
                        <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)', fontWeight: 700 }}>Village Location Verification</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: '1.45' }}>
                        Allow location access to enter field records. Your current location is checked when you save; it is not continuously tracked or stored.
                    </p>
                    <p data-location-status="" role="status" aria-live="polite" style={{ fontSize: '0.82rem', fontWeight: 600, color: s.color, margin: '0' }}>{s.text}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" className="btn btn-primary" id="btnLocationCheck" disabled={s.busy} onClick={checkAgain} style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem', whiteSpace: 'nowrap' }}>{buttonLabel}</button>
                </div>
            </div>
        </section>
    );
}
