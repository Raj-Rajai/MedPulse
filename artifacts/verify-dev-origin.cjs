const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const host of ['localhost', '127.0.0.1']) {
            const page = await browser.newPage();
            await page.goto(`http://${host}:5173/login.html?patient=1`);
            const result = await page.evaluate(async () => {
                const response = await fetch('/api/patient/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: 'nonexistent-dev-origin-test', pin: 'invalid' }),
                });
                return { status: response.status, data: await response.json() };
            });
            assert.equal(result.status, 404, 'A real browser POST must reach credential validation');
            assert.match(result.data.error, /No patient record found/);
            await page.close();
        }
        const external = await fetch('http://localhost:5173/api/patient/login', {
            method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'nonexistent-dev-origin-test', pin: 'invalid' }),
        });
        assert.equal(external.status, 403);
        console.log('PASS: real browser login POSTs pass through Vite for localhost and 127.0.0.1; external-origin writes remain blocked.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
