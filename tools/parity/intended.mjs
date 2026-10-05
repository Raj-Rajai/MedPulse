/**
 * Differences from the original Express server that are on purpose: the bug fixes from
 * fix/startup-and-security. run.mjs applies these unless --strict is passed.
 * Each entry matches a step by method + path (after variable substitution).
 */

/** The one place a PIN is still returned: a student provisioning a patient account hands that new PIN over. */
export const KEEPS_PIN = /^\/api\/students\/provision-patient\/?$/;

/** PINs are no longer returned by any other endpoint, so drop them from the original's responses before comparing. */
export function stripPins(v) {
    if (Array.isArray(v)) return v.map(stripPins);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'pin').map(([k, x]) => [k, stripPins(x)]));
    return v;
}

export const INTENDED = [
    { why: 'GET /members/:id now needs a student session', method: 'GET', path: /^\/api\/members\/\d+$/, anonymous: true, status: 401 },
    { why: 'DELETE /members/:id now needs the owning student', method: 'DELETE', path: /^\/api\/members\/\d+$/, status: [401, 403] },
    { why: 'adding a medication used to fail with a 500', method: 'POST', path: /^\/api\/members\/\d+\/medications$/, status: 201 },
    { why: 'adding medical history used to fail with a 500', method: 'POST', path: /^\/api\/members\/\d+\/history$/, status: 201 },
    { why: 'counts and lists now include the saved medication/history', method: 'GET', path: /^\/api\/(families\/\d+|hospital\/fap\/patients\/\d+)$/, body: 'any' },
];

/** The intended difference covering this step, if any. `anonymous` means the rule only covers calls made without a session. */
export function intendedFor(st, path, a, b) {
    return INTENDED.find((r) => {
        if (r.method !== st.method || !r.path.test(path.split('?')[0])) return false;
        if (r.anonymous && st.as) return false;
        if (r.status !== undefined && ![].concat(r.status).includes(b.status)) return false;
        return true;
    });
}
