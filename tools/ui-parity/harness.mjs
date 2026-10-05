/**
 * UI parity harness: runs the NestJS API twice, once serving the original HTML frontend and once
 * serving the React build, each on its own copy of the same database, and compares what a user sees.
 *
 *   import { startPair, comparePages, closePair } from './harness.mjs';
 *   const pair = await startPair({ db: '/path/baseline.db', legacyFrontend: '/path/frontend', basePort: 3600 });
 *   await comparePages(pair, 'hospital-overview', async (page, base) => {
 *       await loginAs(page, base, 'hospital');
 *       await page.goto(base + '/hospital/hospital.html');
 *       await page.waitForLoadState('networkidle');
 *   });
 *   await closePair(pair);
 *
 * For every check it writes <out>/<name>.<viewport>.{legacy,react,diff}.png plus a text dump of
 * visible text, and returns { name, viewport, diffRatio, textEqual }.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const require = createRequire(path.join(repo, 'apps', 'web', 'package.json'));
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

export const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

export const SESSIONS = {
    student: { key: 'medpulse_user', value: { id: 1, roll_number: '235', name: 'Dhruv Patel', batch_year: '3rd Year MBBS (PSM Batch 2024-25)', college_id: 1 } },
    admin: { key: 'medpulse_admin', value: { id: 1, username: 'admin', name: 'Dr. Rajesh Mehta (HOD Community Medicine)', role: 'University Super Admin', university_id: 1 } },
    patient: { key: 'medpulse_patient', value: { id: 48, patient_uid: 'PAT-ROLL235-001', name: 'Radhuji shukaji thakore', model_type: 'Dependent' } },
    hospital: { key: 'medpulse_hospital_admin', value: { id: 1, hospital_id: 1, username: 'hosp_superadmin', name: 'Dr. Ramesh Patel (Medical Superintendent)', role: 'Hospital Super Admin', hospital_name: 'SAL Hospital' } },
};

async function startServer(port, db, frontendDir) {
    const p = spawn('node', [path.join(repo, 'apps', 'api', 'dist', 'main.js')], {
        env: { ...process.env, PORT: String(port), MEDPULSE_DB_PATH: db, MEDPULSE_FRONTEND_DIR: frontendDir, MEDPULSE_ROOT: repo, NODE_NO_WARNINGS: '1' },
        stdio: 'ignore',
    });
    for (let i = 0; i < 100; i++) {
        try { await fetch(`http://localhost:${port}/api/colleges`); return p; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    p.kill();
    throw new Error('server did not start on ' + port);
}

export async function startPair({ db, legacyFrontend /* original HTML frontend folder, e.g. from MedPulse-before-typescript.zip */, reactFrontend = path.join(repo, 'apps', 'web', 'dist'), basePort = 3600, out = path.join(os.tmpdir(), 'medpulse-ui-parity') }) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'medpulse-ui-'));
    fs.copyFileSync(db, path.join(work, 'legacy.db'));
    fs.copyFileSync(db, path.join(work, 'react.db'));
    fs.mkdirSync(out, { recursive: true });
    const procs = [
        await startServer(basePort, path.join(work, 'legacy.db'), legacyFrontend),
        await startServer(basePort + 1, path.join(work, 'react.db'), reactFrontend),
    ];
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
    return { procs, browser, out, legacy: `http://localhost:${basePort}`, react: `http://localhost:${basePort + 1}` };
}

export async function closePair(pair) {
    await pair.browser.close();
    pair.procs.forEach((p) => p.kill());
}

/** Store a portal session in localStorage (what the login page does after a successful sign-in). */
export async function loginAs(page, base, role) {
    const s = SESSIONS[role];
    await page.goto(base + '/offline.html');
    await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(value)); }, s);
}

const freeze = `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }`;

async function shoot(browser, base, viewport, steps) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
    // Same wall clock for both runs so "loaded at …" stamps and date-based text match.
    await ctx.clock.setFixedTime(new Date('2026-10-03T10:00:00+05:30'));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await steps(page, base);
    await page.addStyleTag({ content: freeze }).catch(() => {});
    await page.waitForTimeout(400);
    const png = await page.screenshot({ fullPage: true });
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    await ctx.close();
    return { png: PNG.sync.read(png), text, errors };
}

export async function comparePages(pair, name, steps, { viewports = ['desktop', 'mobile'] } = {}) {
    const results = [];
    for (const vp of viewports) {
        const a = await shoot(pair.browser, pair.legacy, VIEWPORTS[vp], steps);
        const b = await shoot(pair.browser, pair.react, VIEWPORTS[vp], steps);
        const width = Math.max(a.png.width, b.png.width), height = Math.max(a.png.height, b.png.height);
        const pad = (img) => { const o = new PNG({ width, height }); o.data.fill(255); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
        const A = pad(a.png), B = pad(b.png), D = new PNG({ width, height });
        const changed = pixelmatch(A.data, B.data, D.data, width, height, { threshold: 0.1 });
        const base = path.join(pair.out, `${name}.${vp}`);
        fs.writeFileSync(base + '.legacy.png', PNG.sync.write(A));
        fs.writeFileSync(base + '.react.png', PNG.sync.write(B));
        fs.writeFileSync(base + '.diff.png', PNG.sync.write(D));
        fs.writeFileSync(base + '.legacy.txt', a.text);
        fs.writeFileSync(base + '.react.txt', b.text);
        const r = {
            name, viewport: vp,
            diffRatio: +(changed / (width * height)).toFixed(4),
            sizeLegacy: `${a.png.width}x${a.png.height}`, sizeReact: `${b.png.width}x${b.png.height}`,
            textEqual: a.text === b.text,
            reactErrors: b.errors,
        };
        results.push(r);
        console.log(`${r.diffRatio <= 0.01 && r.textEqual ? '✓' : '✗'} ${name} [${vp}] diff=${(r.diffRatio * 100).toFixed(2)}% text=${r.textEqual ? 'same' : 'DIFFERENT'} ${r.sizeLegacy} vs ${r.sizeReact}${b.errors.length ? ' errors=' + b.errors.join(' | ') : ''}`);
    }
    return results;
}
