const test = require('node:test');
const assert = require('node:assert/strict');
const { checkLocation, validArea, isFieldWrite } = require('../backend/services/geofence.service');
const area = { name: 'Test village', latitude: 23, longitude: 72, radius: 500 };
const location = { latitude: 23, longitude: 72, accuracy: 10, timestamp: Date.now() };
test('validates configuration and fails closed without a boundary', () => {
    assert.ok(validArea(area));
    for (const bad of [{ ...area, latitude: 91 }, { ...area, longitude: -181 }, { ...area, radius: 0 }, { ...area, name: '' }]) assert.ok(!validArea(bad));
    assert.ok(checkLocation(null, location));
});
test('accepts inside, rejects outside and uncertain boundary readings', () => {
    assert.equal(checkLocation(area, location), null);
    assert.ok(checkLocation(area, { ...location, latitude: 24 }));
    assert.ok(checkLocation({ ...area, radius: 25 }, { ...location, accuracy: 30 }));
});
test('rejects stale, future, malformed and inaccurate locations', () => {
    for (const bad of [null, {}, { ...location, latitude: '23' }, { ...location, longitude: 181 },
        { ...location, accuracy: -1 }, { ...location, accuracy: 101 },
        { ...location, timestamp: Date.now() - 61000 }, { ...location, timestamp: Date.now() + 20000 }]) assert.ok(checkLocation(area, bad));
});
test('protects field mutations while allowing reads and account actions', () => {
    for (const path of ['/families', '/families/1/members', '/members/1', '/conditions/1', '/medications/1', '/allergies/1', '/history/1', '/follow-ups/1', '/students/provision-patient', '/student/campaign-tasks/1/status']) {
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isFieldWrite(method, path), true);
        assert.equal(isFieldWrite('GET', path), false);
    }
    for (const path of ['/admin/geofence', '/student/geofence/check', '/students/profile', '/students/change-pin', '/patient/register']) assert.equal(isFieldWrite('POST', path), false);
});
test('browser asks for fresh location on each save and blocks denied permission', async () => {
    const vm = require('node:vm');
    const fs = require('node:fs');
    let denied = false, reads = 0;
    const calls = [];
    const window = {
        location: { href: 'https://portal.test/entry.html', origin: 'https://portal.test' },
        isSecureContext: true,
        fetch: async (input, init) => { calls.push({ input, init }); return new Response(JSON.stringify({ success: true })); }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/shared/field-location.js'), 'utf8'), {
        window, document: { addEventListener() {} }, URL, Request, Response, Headers,
        setTimeout: () => 1, clearTimeout() {},
        navigator: { geolocation: { getCurrentPosition(ok, fail, options) {
            reads++;
            assert.equal(options.maximumAge, 0);
            if (denied) fail({ code: 1 });
            else ok({ coords: location, timestamp: Date.now() });
        } } }
    });
    await window.fetch('/api/families');
    assert.equal(reads, 0);
    await window.fetch('/api/families', { method: 'POST' });
    await window.fetch('/api/members/1', { method: 'PUT' });
    assert.equal(reads, 2);
    assert.ok(calls.find(call => call.init?.headers instanceof Headers && call.init.headers.has('X-Field-Location')));
    denied = true;
    const count = calls.length;
    const response = await window.fetch('/api/families', { method: 'POST' });
    assert.equal(response.status, 403);
    assert.equal(calls.length, count);
    assert.match((await response.json()).error, /permission denied/);
});
test('HTTP enforcement, admin persistence and college isolation', async () => {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); }
    catch (_) { DatabaseSync = require('better-sqlite3'); }
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE colleges (id INTEGER, name TEXT);
        CREATE TABLE students (id INTEGER, college_id INTEGER, roll_number TEXT);
        CREATE TABLE admins (id INTEGER, college_id INTEGER, username TEXT);
        INSERT INTO students VALUES (1, 10, 'one'), (2, 20, 'two');
        INSERT INTO admins VALUES (1, 10, 'faculty');`);
    require('../backend/db/schemas/22-geofence.schema').apply(db);
    require.cache[require.resolve('../backend/config/db')] = { exports: { db } };
    // A harmless handler lets the real router prove that only valid requests reach mutations.
    require('../backend/controllers/survey.controller').createFamily = (req, res) => res.json({ success: true });
    const app = require('express')();
    app.use(require('express').json());
    app.use('/api', require('../backend/routes'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = (path, method, headers = {}, body) => fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined
    });
    try {
        assert.equal((await call('/admin/geofence', 'PUT', {}, area)).status, 401);
        assert.equal((await call('/families', 'POST', { 'X-Student-Id': '1' })).status, 403);
        assert.equal((await call('/admin/geofence', 'PUT', { 'X-Admin-Id': '1' }, { ...area, radius: -1 })).status, 400);
        assert.equal((await call('/admin/geofence', 'PUT', { 'X-Admin-Id': '1' }, area)).status, 200);
        assert.equal((await (await call('/student/geofence', 'GET', { 'X-Student-Id': '1' })).json()).area.name, area.name);
        assert.equal((await (await call('/student/geofence', 'GET', { 'X-Student-Id': '2' })).json()).area, null);
        assert.equal((await call('/families', 'POST', { 'X-Student-Id': '1', 'X-Field-Location': '{}' })).status, 403);
        assert.equal((await call('/families', 'POST', { 'X-Student-Id': '1', 'X-Field-Location': JSON.stringify({ ...location, latitude: 25 }) })).status, 403);
        assert.equal((await call('/families', 'POST', { 'X-Student-Id': '1', 'X-Field-Location': JSON.stringify({ ...location, timestamp: Date.now() }) })).status, 200);
    } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
