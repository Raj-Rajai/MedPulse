(() => {
    'use strict';
    const nativeFetch = window.fetch.bind(window);
    const fieldPath = /^\/api\/(?:families|members|conditions|medications|allergies|history|follow-ups)(?:\/|$)|^\/api\/students\/provision-patient\/?$|^\/api\/student\/campaign-tasks(?:\/|$)/;
    let statusEl, buttonEl, expiryTimer, verifiedLocation = null;
    let isLocked = true;

    function setStatus(text, isSuccess = false, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = text;
        if (isSuccess) {
            statusEl.style.color = '#059669';
        } else if (isError) {
            statusEl.style.color = '#dc2626';
        } else {
            statusEl.style.color = 'var(--accent, #6d28d9)';
        }
    }

    function locate() {
        return new Promise((resolve, reject) => {
            if (!window.isSecureContext) return reject(new Error('Location requires HTTPS or localhost. Open the secure portal address.'));
            if (!navigator.geolocation) return reject(new Error('This browser does not support location. Use a location-enabled device.'));
            navigator.geolocation.getCurrentPosition(position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            }), error => reject(new Error(error.code === 1
                ? 'Location permission denied. Allow location in your browser settings, then try again.'
                : error.code === 3 ? 'Location timed out. Move outdoors and try again.'
                    : 'Location unavailable. Turn on device location and try again.')),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        });
    }

    async function verify() {
        setStatus('Checking your current location…');
        const location = await locate();
        const response = await nativeFetch('/api/student/geofence/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(location)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Location verification failed.');
        verifiedLocation = location;
        isLocked = false;
        setStatus('✓ Inside permitted area. You can enter data; location will be checked again when you save.', true);
        const card = document.getElementById('locationVerificationCard');
        if (card) {
            card.style.borderColor = '#10b981';
            card.style.background = '#f0fdf4';
        }
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(() => {
            isLocked = true;
            verifiedLocation = null;
            setStatus('Location check expired. Check your location again to continue entering data.', false, true);
            if (card) {
                card.style.borderColor = 'var(--accent, #6d28d9)';
                card.style.background = '#ffffff';
            }
        }, 60000);
        return location;
    }

    window.fetch = async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : input, window.location.href);
        const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (url.origin !== window.location.origin || !fieldPath.test(url.pathname) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return nativeFetch(input, init);
        }

        try {
            const location = verifiedLocation || await verify();
            const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            headers.set('X-Field-Location', JSON.stringify(location));
            const response = await nativeFetch(input, { ...init, headers });
            if (response.status === 403) {
                const data = await response.clone().json();
                if (data.code === 'LOCATION_REQUIRED') {
                    isLocked = true;
                    verifiedLocation = null;
                    setStatus(data.error, false, true);
                }
            }
            return response;
        } catch (error) {
            isLocked = true;
            verifiedLocation = null;
            setStatus(error.message, false, true);
            return new Response(JSON.stringify({ error: error.message }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        const main = document.querySelector('main.main-content') || document.querySelector('main') || document.body;

        const panel = document.createElement('section');
        panel.className = 'card anim-fade-up';
        panel.id = 'locationVerificationCard';
        panel.style.cssText = 'padding: 16px 20px; margin-bottom: 20px; border: 1.5px solid var(--accent, #6d28d9); background: #ffffff; border-radius: var(--radius-lg); box-shadow: var(--shadow-xs);';
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                <div style="flex: 1; min-width: 240px;">
                    <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 4px;">
                        <span style="font-size: 1.15rem;">📍</span>
                        <strong style="font-size: 0.98rem; color: var(--text-primary); font-weight: 700;">Village Location Verification</strong>
                    </div>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 6px; line-height: 1.45;">
                        Allow location access to enter field records. Your current location is checked when you save; it is not continuously tracked or stored.
                    </p>
                    <p data-location-status role="status" aria-live="polite" style="font-size: 0.82rem; font-weight: 600; color: var(--accent, #6d28d9); margin: 0;">Loading permitted area…</p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn btn-primary" id="btnLocationCheck" style="font-size: 0.82rem; padding: 0.45rem 0.95rem; white-space: nowrap;">📍 Enable location / Check again</button>
                </div>
            </div>
        `;

        main.prepend(panel);

        statusEl = panel.querySelector('[data-location-status]');
        buttonEl = panel.querySelector('#btnLocationCheck');

        buttonEl.onclick = async () => {
            buttonEl.disabled = true;
            try {
                await verify();
            } catch (error) {
                setStatus(error.message, false, true);
            } finally {
                buttonEl.disabled = false;
            }
        };

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
            setStatus(error.message, false, true);
        }
    });
})();
