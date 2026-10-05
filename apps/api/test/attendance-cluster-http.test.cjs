require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('API boots with cluster migrations and guards the new routes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medpulse-cluster-'));
    const file = path.join(dir, 'test.db');
    process.env.MEDPULSE_DB_PATH = file;
    const { createApp } = require('../dist/main');
    const { DatabaseService } = require('../dist/database/database.service');
    let app;
    try {
        app = await createApp();
        await app.listen(0, '127.0.0.1');
        const url = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
        for (const [method, route] of [
            ['GET', '/academic/attendance/clusters'],
            ['POST', '/academic/attendance/clusters/test/challenge'],
            ['GET', '/academic/attendance/clusters/test'],
            ['POST', '/academic/attendance/clusters/test/join'],
            ['GET', '/admin/academic/schedule/1/attendance-cluster'],
            ['GET', '/admin/academic/attendance/clusters/test'],
            ['POST', '/admin/academic/attendance/clusters/test/end'],
            ['POST', '/admin/academic/attendance/clusters/test/observations'],
        ]) {
            const response = await fetch(url + route, { method });
            assert.equal(response.status, 401, `${method} ${route}`);
        }
        const db = app.get(DatabaseService).db;
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'attendance_cluster%'").get().n, 3);
    } finally {
        if (app) {
            await app.close();
            app.get(DatabaseService).db.close();
        }
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
            if (fs.existsSync(file + suffix)) fs.unlinkSync(file + suffix);
        }
        fs.rmdirSync(dir);
    }
});
