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

export interface FieldLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export interface DesignatedArea {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    enabled?: boolean;
}

export interface LocationState {
    text: string;
    color: string;
    enabled: boolean;
    area: DesignatedArea | null;
    verified: boolean;
    readOnly: boolean;
    busy: boolean;
}

const ACCENT = 'var(--accent, #6d28d9)';
let state: LocationState = {
    text: 'Loading permitted area…',
    color: ACCENT,
    enabled: true,
    area: null,
    verified: false,
    readOnly: false,
    busy: false,
};
const listeners = new Set<() => void>();
const emit = (patch: Partial<LocationState>) => {
    const next = { ...state, ...patch };
    next.readOnly = next.enabled && !next.verified;
    state = next;
    listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useFieldLocationState(): LocationState {
    return useSyncExternalStore(subscribe, () => state);
}

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
                ? 'Location permission denied. Only Read (R) operations are available until you allow location inside the designated area.'
                : error.code === 3 ? 'Location timed out. Move outdoors and try again.'
                    : 'Location unavailable. Turn on device location and try again.')),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
    });
}

async function verify(): Promise<FieldLocation | null> {
    if (!state.enabled) {
        emit({ verified: true });
        return verifiedLocation;
    }
    setStatus('Checking your current location against designated field area…');
    const location = await locate();
    const response = await nativeFetch('/api/student/geofence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
    });
    const data = await response.json();
    if (data && data.enabled === false) {
        verifiedLocation = location;
        emit({ enabled: false, verified: true });
        setStatus('Location binding is turned OFF by administrator — full Read & Write (CRUD) access enabled.', true, false);
        return location;
    }
    if (!response.ok) throw new Error(data.error || 'Location verification failed.');
    verifiedLocation = location;
    setStatus(
        `✓ Inside designated location${state.area ? ` (${state.area.name})` : ''}. Full Create, Read, Update & Delete (CRUD) access enabled.`,
        true,
    );
    emit({ verified: true });
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
        verifiedLocation = null;
        if (state.enabled) {
            setStatus('Location check expired. Verify your location again to perform CUD operations (Read-Only mode active).', false, true);
            emit({ verified: false });
        }
    }, 300000);
    return location;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function refreshFieldLocationStatus(autoVerify = true): Promise<void> {
    try {
        const response = await nativeFetch('/api/student/geofence', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load permitted area.');
        const isEnabled = data.enabled !== undefined ? Boolean(data.enabled) : Boolean(data.area && data.area.enabled !== false);
        const area: DesignatedArea | null = data.area || null;

        if (!isEnabled) {
            clearTimeout(expiryTimer);
            emit({
                enabled: false,
                area,
                verified: true,
                text: 'Location binding is turned OFF by administrator — full Read & Write (CRUD) access enabled.',
                color: '#059669',
            });
            return;
        }

        if (!area) {
            verifiedLocation = null;
            emit({
                enabled: true,
                area: null,
                verified: false,
                text: 'Read-Only Mode (R Only): Your administrator has enabled location binding, but no village area is configured yet. CUD operations are disabled.',
                color: '#dc2626',
            });
            return;
        }

        emit({ enabled: true, area });
        if (verifiedLocation) {
            // Re-validate existing cached location against the newly loaded area
            const chk = await nativeFetch('/api/student/geofence/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...verifiedLocation, timestamp: Date.now() }),
            });
            if (chk.ok) {
                emit({ verified: true });
                setStatus(`✓ Inside designated location (${area.name}, within ${area.radius}m). Full CRUD access enabled.`, true, false);
                return;
            }
            verifiedLocation = null;
        }

        if (autoVerify) {
            emit({ busy: true });
            try {
                await verify();
            } catch (error) {
                verifiedLocation = null;
                emit({ verified: false });
                setStatus(errText(error), false, true);
            } finally {
                emit({ busy: false });
            }
        } else {
            emit({ verified: false });
            setStatus(`Designated area: ${area.name} (within ${area.radius} metres). Verify location to unlock CUD operations.`, false, false);
        }
    } catch (error) {
        setStatus(errText(error), false, true);
    }
}

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
            if (!state.enabled) {
                const response = await nativeFetch(input, init);
                if (response.status === 403) {
                    const data = await response.clone().json().catch(() => ({}));
                    if (data.code === 'LOCATION_REQUIRED') {
                        await refreshFieldLocationStatus(true);
                    }
                }
                return response;
            }
            const location = verifiedLocation || (await verify());
            const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            if (location) headers.set('X-Field-Location', JSON.stringify(location));
            const response = await nativeFetch(input, { ...init, headers });
            if (response.status === 403) {
                const data = await response.clone().json().catch(() => ({}));
                if (data.code === 'LOCATION_REQUIRED') {
                    verifiedLocation = null;
                    emit({ enabled: true, verified: false });
                    setStatus(data.error || 'Read-Only Mode: Outside designated location.', false, true);
                }
            }
            return response;
        } catch (error) {
            verifiedLocation = null;
            emit({ verified: false });
            setStatus(errText(error), false, true);
            return new Response(JSON.stringify({ error: errText(error), code: 'LOCATION_REQUIRED' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    };

    void refreshFieldLocationStatus(true);
}

export async function checkAgain(): Promise<void> {
    emit({ busy: true });
    try {
        await refreshFieldLocationStatus(true);
    } finally {
        emit({ busy: false });
    }
}

const cardStyle: CSSProperties = {
    padding: '16px 20px', marginBottom: '20px', border: '1.5px solid var(--accent, #6d28d9)', background: '#ffffff',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)',
};

/** `buttonLabel`: family-manage.html renamed the button to "Check location" (and moved the card to the end of <main>). */
export function LocationVerificationCard({ buttonLabel = '📍 Verify location / Check again' }: { buttonLabel?: string }) {
    const s = useSyncExternalStore(subscribe, () => state);
    const style: CSSProperties = !s.enabled
        ? { ...cardStyle, borderColor: '#10b981', background: '#f0fdf4' }
        : s.verified
            ? { ...cardStyle, borderColor: '#10b981', background: '#f0fdf4' }
            : { ...cardStyle, borderColor: '#ef4444', background: '#fef2f2' };

    return (
        <section className="card anim-fade-up" id="locationVerificationCard" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: '1', minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1.15rem' }}>{s.readOnly ? '🔒' : '📍'}</span>
                        <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            Student Location Binding
                        </strong>
                        <span
                            id="studentLocationModeBadge"
                            className={`badge ${s.readOnly ? 'badge-danger' : 'badge-success'}`}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', fontWeight: 700 }}
                        >
                            {!s.enabled
                                ? '🔓 Location Binding OFF — Full CRUD'
                                : s.verified
                                    ? '🟢 Inside Designated Area — Full CRUD'
                                    : '🔒 Read-Only Mode (R Only — CUD Disabled)'}
                        </span>
                    </div>
                    {s.area && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                            Designated Area: <strong>{s.area.name}</strong> ({Number(s.area.latitude).toFixed(4)}, {Number(s.area.longitude).toFixed(4)}) • Allowed Radius: <strong>{s.area.radius}m</strong>
                        </p>
                    )}
                    <p data-location-status="" role="status" aria-live="polite" style={{ fontSize: '0.82rem', fontWeight: 600, color: s.color, margin: '0' }}>
                        {s.text}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        id="btnLocationCheck"
                        disabled={s.busy}
                        onClick={checkAgain}
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem', whiteSpace: 'nowrap' }}
                    >
                        {s.busy ? 'Checking GPS…' : buttonLabel}
                    </button>
                </div>
            </div>
        </section>
    );
}
