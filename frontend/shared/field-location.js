(() => {
    'use strict';
    const nativeFetch = window.fetch.bind(window);
    const fieldPath = /^\/api\/(?:families|members|conditions|medications|allergies|history|follow-ups)(?:\/|$)|^\/api\/students\/provision-patient\/?$|^\/api\/student\/campaign-tasks(?:\/|$)/;
    let status, button, expiry;
    const locks = [];
    function lock(value) { locks.forEach(fieldset => { fieldset.disabled = value; }); }
    function message(text) { if (status) status.textContent = text; }
    function locate() {
        return new Promise((resolve, reject) => {
            if (!window.isSecureContext) return reject(new Error('Location requires HTTPS or localhost. Open the secure portal address.'));
            if (!navigator.geolocation) return reject(new Error('This browser does not support location. Use a location-enabled device.'));
            navigator.geolocation.getCurrentPosition(position => resolve({
                latitude: position.coords.latitude, longitude: position.coords.longitude,
                accuracy: position.coords.accuracy, timestamp: position.timestamp
            }), error => reject(new Error(error.code === 1
                ? 'Location permission denied. Allow location in your browser settings, then try again.'
                : error.code === 3 ? 'Location timed out. Move outdoors and try again.'
                    : 'Location unavailable. Turn on device location and try again.')),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        });
    }
    async function verify() {
        message('Checking your current location…');
        const location = await locate();
        const response = await nativeFetch('/api/student/geofence/check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(location)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Location verification failed.');
        lock(false);
        message('Inside the permitted area. You can enter data; location will be checked again when you save.');
        clearTimeout(expiry);
        expiry = setTimeout(() => { lock(true); message('Location check expired. Check your location again to continue entering data.'); }, 60000);
        return location;
    }
    window.fetch = async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : input, window.location.href);
        const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (url.origin !== window.location.origin || !fieldPath.test(url.pathname) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return nativeFetch(input, init);
        try {
            const location = await verify();
            const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
            headers.set('X-Field-Location', JSON.stringify(location));
            const response = await nativeFetch(input, { ...init, headers });
            if (response.status === 403) {
                const data = await response.clone().json();
                if (data.code === 'LOCATION_REQUIRED') { lock(true); message(data.error); }
            }
            return response;
        } catch (error) {
            lock(true); message(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
    };
    document.addEventListener('DOMContentLoaded', async () => {
        const panel = document.createElement('section');
        panel.className = 'card';
        panel.style.cssText = 'padding:16px;margin:16px 0;border:1px solid var(--accent,#6d28d9)';
        panel.innerHTML = '<strong>Village location verification</strong><p>Allow location access to enter field records. Your current location is checked when you save; it is not continuously tracked or stored.</p><p data-location-status role="status" aria-live="polite">Loading permitted area…</p><button type="button" class="btn btn-primary">Enable location / Check again</button>';
        (document.querySelector('main') || document.body).prepend(panel);
        status = panel.querySelector('[data-location-status]');
        button = panel.querySelector('button');
        document.querySelectorAll('form').forEach(form => {
            const fieldset = document.createElement('fieldset');
            fieldset.style.cssText = 'border:0;margin:0;padding:0;min-width:0';
            while (form.firstChild) fieldset.appendChild(form.firstChild);
            form.appendChild(fieldset); locks.push(fieldset);
        });
        lock(true);
        button.onclick = async () => {
            button.disabled = true;
            try { await verify(); } catch (error) { lock(true); message(error.message); }
            finally { button.disabled = false; }
        };
        try {
            const response = await nativeFetch('/api/student/geofence', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load permitted area.');
            message(data.area ? `Permitted area: ${data.area.name}, within ${data.area.radius} metres. Enable location to begin.` : 'Your administrator must configure the village area before field entry is available.');
        } catch (error) { message(error.message); }
    });
})();
