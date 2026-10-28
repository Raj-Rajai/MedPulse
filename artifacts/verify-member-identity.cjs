const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ geolocation: { latitude: 23.0, longitude: 72.5 }, permissions: ['geolocation'] });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const family = {
            id: 900001, family_no: 1, head_of_family: 'Test Member',
            members: [
                { id: 900001, medpulse_id: 'MP-00900001', member_order: 1, name: 'Test Member', age_years: 32, gender: 'M' },
                { id: 900002, medpulse_id: 'MP-00900002', member_order: 2, name: 'Second Member', age_years: 28, gender: 'F' },
            ],
        };
        const writes = [];
        await page.route('**/api/**', async (route) => {
            const request = route.request();
            const path = new URL(request.url()).pathname;
            if (request.method() === 'PUT') writes.push({ path, body: request.postDataJSON() });
            const body = path === '/api/families' ? [family]
                : path === `/api/families/${family.id}` ? family
                : path === '/api/consent/status' ? { consented: true } : {};
            await route.fulfill({ json: body });
        });
        await page.addInitScript(() => {
            localStorage.setItem('medpulse_user', JSON.stringify({ id: 1, roll_number: 'TEST', name: 'Test Student' }));
            sessionStorage.setItem('medpulse_comm_med_noticed', 'true');
        });
        await page.goto('http://localhost:5173/entry.html?familyId=900001');
        const idField = page.locator('#entryMemberMedpulseId');
        await idField.waitFor({ timeout: 60000 });
        assert.equal(await idField.textContent(), 'MP-00900001');
        assert.equal(await page.getByRole('textbox', { name: 'MedPulse ID', exact: true }).count(), 0);
        assert.equal(await page.getByText('Assigned automatically.', { exact: false }).count(), 0);
        assert.equal(await page.getByText(/Aadhaar|ABHA/i).count(), 0);
        await page.locator('#rosterCard_900002').click();
        await page.waitForFunction(() => document.querySelector('#entryMemberMedpulseId')?.textContent === 'MP-00900002');
        await page.getByRole('button', { name: /Year 2/ }).click();
        assert.equal(await idField.textContent(), 'MP-00900002');
        await page.reload();
        await idField.waitFor();
        assert.equal(await idField.textContent(), 'MP-00900001');

        const result = await page.evaluate(async (family) => {
            const storage = await import('/src/pages/student/entry/surveyStorage.ts');
            const identity = await import('/src/pages/student/common/memberIdentity.ts');
            const record = storage.loadFamilySurveyRecord(family.id, 'Year 3', family);
            record.memberSurveys[900001].aadhaar_number = 'legacy-test';
            record.memberSurveys[900001].abha_id = 'legacy-test';
            record.memberSurveys[900001].medpulse_id = 'incorrect-id';
            record.memberSurveys[900001].sbp = '123';
            localStorage.setItem(storage.getSurveyStorageKey(family.id, 'Year 3'), JSON.stringify(record));
            const migrated = storage.loadFamilySurveyRecord(family.id, 'Year 3', family);
            await storage.syncSurveyWithBackend(migrated, 'draft');
            const fromNotes = storage.loadFamilySurveyRecord(family.id + 1, 'Year 1', {
                ...family, notes: JSON.stringify({ medpulse_survey_records: true, survey_records: { 'Year 1': record } }),
            });
            return {
                migrated, fromNotes,
                cached: localStorage.getItem(storage.getSurveyStorageKey(family.id, 'Year 3')),
                missingServerId: identity.medpulseMemberId({ id: 900003 }),
            };
        }, family);
        assert.equal(result.missingServerId, '');
        assert.equal(result.migrated.memberSurveys[900001].medpulse_id, 'MP-00900001');
        assert.equal(result.migrated.memberSurveys[900001].sbp, '123');
        for (const record of [result.migrated, result.fromNotes, JSON.parse(result.cached)]) {
            assert.ok(!JSON.stringify(record).match(/aadhaar_number|abha_id/));
        }
        assert.equal(writes.filter((w) => w.path.startsWith('/api/members/')).length, 2);
        const savedFamily = writes.find((w) => w.path === '/api/families/900001');
        assert.ok(!savedFamily.body.notes.match(/aadhaar_number|abha_id/));
        assert.equal(JSON.parse(savedFamily.body.notes).survey_records['Year 3'].memberSurveys[900001].medpulse_id, 'MP-00900001');
        assert.deepEqual(errors, []);
        console.log('PASS: ID beside name, no ID form field, member switching, year switching, reload, legacy migration, unique IDs, and API persistence.');
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
