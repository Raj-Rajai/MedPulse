/**
 * API parity check: replays scenario.mjs against the ORIGINAL Express server and the NEW
 * NestJS server, each started on its own copy of the same database, and diffs every response.
 *
 *   node tools/parity/run.mjs --legacy <path to original MedPulse folder> --db <baseline .db>
 *
 * Exit code 0 = every step matched.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { steps, AUTH, AREA } from './scenario.mjs';
import { stripPins, intendedFor, KEEPS_PIN } from './intended.mjs';

const strict = process.argv.includes('--strict'); // compare with no intended differences (the original's bugs)

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const legacyDir = path.resolve(arg('--legacy'));
const baseline = path.resolve(arg('--db'));
const verbose = process.argv.includes('--verbose');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'medpulse-parity-'));
// Original server reads <legacy>/database/health_survey.db, so run it from a private copy.
const legacyCopy = path.join(work, 'legacy');
fs.cpSync(legacyDir, legacyCopy, { recursive: true, filter: (s) => !s.endsWith('.db') });
fs.copyFileSync(baseline, path.join(legacyCopy, 'database', 'health_survey.db'));
const newDb = path.join(work, 'new.db');
fs.copyFileSync(baseline, newDb);

const servers = {
    legacy: { port: 3201, cmd: ['node', [path.join(legacyCopy, 'backend', 'server.js')]], env: {} },
    nest: {
        port: 3202,
        cmd: ['node', [path.join(repo, 'apps', 'api', 'dist', 'main.js')]],
        env: { MEDPULSE_DB_PATH: newDb, MEDPULSE_FRONTEND_DIR: path.join(legacyCopy, 'frontend'), MEDPULSE_ROOT: repo },
    },
};

const procs = [];
async function start(name) {
    const s = servers[name];
    const p = spawn(s.cmd[0], s.cmd[1], { env: { ...process.env, ...s.env, PORT: String(s.port), NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push(p);
    let log = '';
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    for (let i = 0; i < 100; i++) {
        try { await fetch(`http://localhost:${s.port}/api/colleges`); return () => log; } catch { await new Promise((r) => setTimeout(r, 100)); }
        if (p.exitCode !== null) break;
    }
    throw new Error(`${name} server did not start:\n${log}`);
}
const stopAll = () => procs.forEach((p) => p.kill());

const vars = {};
const subst = (v) => {
    if (typeof v === 'string') {
        if (v === '{now}') return Date.now();
        return v.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
    }
    if (Array.isArray(v)) return v.map(subst);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subst(x)]));
    return v;
};
const location = () => JSON.stringify({ latitude: AREA.latitude, longitude: AREA.longitude, accuracy: 10, timestamp: Date.now() });

/** Values that legitimately differ between two runs (clock, randomness) are masked before comparing. */
const TS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?$/;
function normalize(v, key = '') {
    if (Array.isArray(v)) return v.map((x) => normalize(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x, k)]));
    if (typeof v === 'string') {
        if (TS.test(v)) return '<timestamp>';
        return v
            .replace(/\b([A-Z0-9]{1,8}-[A-Z0-9]+)-[0-9A-F]{4}\b/g, '$1-<rand>') // student referral codes
            .replace(/\b(PAT|REG)-(\d{4})-\d{5}\b/g, '$1-$2-<rand>') // random patient / visit UIDs
            .replace(/<rand>-\d{5}\b/g, '<rand>') // family codes derived from the patient UID
            .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<timestamp>');
    }
    return v;
}

async function call(port, st) {
    const headers = { ...(st.as ? AUTH[st.as] : {}), ...subst(st.headers || {}) };
    if (st.field) headers['X-Field-Location'] = location();
    let body;
    if (st.raw !== undefined) body = st.raw;
    else if (st.body !== undefined) { body = JSON.stringify(subst(st.body)); headers['content-type'] = 'application/json'; }
    const res = await fetch(`http://localhost:${port}${subst(st.path)}`, { method: st.method, headers, body, redirect: 'manual' });
    const buf = Buffer.from(await res.arrayBuffer());
    const type = (res.headers.get('content-type') || '').split(';')[0];
    let parsed;
    if (type === 'application/json') { try { parsed = JSON.parse(buf.toString()); } catch { parsed = buf.toString(); } }
    return { status: res.status, type, buf, json: parsed, location: res.headers.get('location'), disposition: res.headers.get('content-disposition'), cache: res.headers.get('cache-control') };
}

function compare(st, a, b) {
    const diffs = [];
    if (a.status !== b.status) diffs.push(`status ${a.status} != ${b.status}`);
    if (a.type !== b.type) diffs.push(`content-type ${a.type} != ${b.type}`);
    if (a.location !== b.location) diffs.push(`location ${a.location} != ${b.location}`);
    if (a.disposition !== b.disposition) diffs.push(`content-disposition ${a.disposition} != ${b.disposition}`);
    if (st.path.includes('geofence') && a.cache !== b.cache) diffs.push(`cache-control ${a.cache} != ${b.cache}`);
    if (st.kind === 'pdf') {
        if (Math.abs(a.buf.length - b.buf.length) > 64) diffs.push(`pdf size ${a.buf.length} vs ${b.buf.length}`);
    } else if (a.type === 'application/json') {
        const x = JSON.stringify(normalize(strict || KEEPS_PIN.test(st.path) ? a.json : stripPins(a.json))), y = JSON.stringify(normalize(b.json));
        if (x !== y) {
            let i = 0; while (i < x.length && x[i] === y[i]) i++;
            diffs.push(`body differs at char ${i}:\n      original: …${x.slice(Math.max(0, i - 80), i + 120)}\n      new:      …${y.slice(Math.max(0, i - 80), i + 120)}`);
        }
    } else {
        const x = normalize(a.buf.toString()), y = normalize(b.buf.toString());
        if (x !== y) diffs.push(`body differs (${a.buf.length} vs ${b.buf.length} bytes)`);
    }
    return diffs;
}

let failures = 0, intended = 0;
try {
    const legacyLog = await start('legacy');
    const nestLog = await start('nest');
    for (const [i, st] of steps.entries()) {
        const a = await call(servers.legacy.port, st);
        const b = await call(servers.nest.port, st);
        if (st.capture && a.json !== undefined) Object.assign(vars, st.capture(a.json) || {});
        const label = `${String(i + 1).padStart(3)} ${st.method.padEnd(6)} ${subst(st.path)}${st.as ? ` [${st.as}]` : ''}${st.name ? ` (${st.name})` : ''}`;
        let diffs = compare(st, a, b);
        if (!strict && !KEEPS_PIN.test(st.path) && b.json && JSON.stringify(b.json).includes('"pin":')) diffs.push('new response still contains a pin');
        const why = !strict && diffs.length && intendedFor(st, subst(st.path), a, b);
        if (why && (why.body === 'any' || why.status !== undefined)) { intended++; if (verbose) console.log(`≈ ${label} -> ${b.status} (intended: ${why.why})`); diffs = []; continue; }
        if (diffs.length) { failures++; console.log(`✗ ${label} -> ${a.status}`); diffs.forEach((d) => console.log(`    ${d}`)); }
        else if (verbose) console.log(`✓ ${label} -> ${a.status}`);
    }
    console.log(`\n${steps.length - failures - intended}/${steps.length} steps identical, ${intended} intended differences (bug fixes; --strict to fail on them), ${failures} unexpected`);
    if (process.argv.includes('--logs')) console.log('--- original log ---\n' + legacyLog() + '\n--- new log ---\n' + nestLog());
} finally {
    stopAll();
}
process.exit(failures ? 1 : 0);
