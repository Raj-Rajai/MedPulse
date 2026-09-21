const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { generateCsv, generatePdfStream, getStudentExportData } = require('./export-service');
const { db } = require('./db');

console.log('====================================================');
console.log('🧪 MEDPULSE FIELD SURVEY & FOLLOW-UP EXPORT TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${desc}`);
        console.error(`     Error: ${err.message}`);
        failCount++;
    }
}

async function itAsync(desc, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${desc}`);
        console.error(`     Error: ${err.message}`);
        failCount++;
    }
}

// 1. Data Aggregation Tests
console.log('--- 1. Data Model & Aggregation Tests ---');

it('Dhruv Patel (Student 1 / Roll 235) has 5 families and 26 members matching Roll235.pdf', () => {
    const data = getStudentExportData(1);
    assert.ok(data, 'Export data should not be null');
    assert.strictEqual(data.student.roll_number, '235');
    assert.strictEqual(data.families.length, 5, 'Should have exactly 5 families');

    const totalMembers = data.families.reduce((sum, f) => sum + f.members.length, 0);
    assert.strictEqual(totalMembers, 26, 'Should have exactly 26 members across 5 families');
});

it('Longitudinal follow-ups exist for chronic patients', () => {
    const data = getStudentExportData(1);
    const fuMembers = [];
    for (const f of data.families) {
        for (const m of f.members) {
            if (m.has_followup) fuMembers.push(m);
        }
    }
    assert.ok(fuMembers.length >= 8, `Expected at least 8 follow-up patients, found ${fuMembers.length}`);
    
    // Radhuji has follow-up visit 2
    const radhuji = fuMembers.find(m => m.name.toLowerCase().includes('radhuji'));
    assert.ok(radhuji, 'Radhuji should have follow-up');
    assert.strictEqual(radhuji.latest_visit_number, 2);
    assert.strictEqual(radhuji.effective_sbp, 140, 'Radhuji effective SBP should be latest follow-up 140');
    assert.strictEqual(radhuji.effective_dbp, 78, 'Radhuji effective DBP should be latest follow-up 78');
});

// 2. CSV Generator Tests
console.log('\n--- 2. CSV Export Generator Tests ---');

function parseCsvRow(rowStr) {
    const cells = [];
    let insideQuotes = false;
    let currentCell = '';
    for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
            if (insideQuotes && rowStr[i+1] === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            cells.push(currentCell.trim());
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    cells.push(currentCell.trim());
    return cells;
}

let csvContent = '';
it('Generates valid CSV containing 43 core columns + follow-up audit columns', () => {
    csvContent = generateCsv(1);
    assert.ok(csvContent && csvContent.length > 500, 'CSV content should not be empty');

    const lines = csvContent.split('\r\n');
    assert.strictEqual(lines.length, 27, 'CSV should have 27 lines (1 header + 26 members)');

    const headerCols = parseCsvRow(lines[0]);
    assert.ok(headerCols.length >= 43, `Expected at least 43 columns, got ${headerCols.length}`);
    
    // Verify core column names match Roll235.pdf
    assert.strictEqual(headerCols[0], 'Roll Number');
    assert.strictEqual(headerCols[1], 'Family No.');
    assert.ok(headerCols[2].includes('Name of Family Member'));
    assert.ok(headerCols[3].includes('Age (in Completed Years)'));
    assert.ok(headerCols[5].includes('HTN'));
    assert.ok(headerCols[6].includes('SBP ONLY for ADULTS'));
    assert.ok(headerCols[7].includes('DBP ONLY for ADULTS'));
    assert.ok(headerCols[8].includes('DM'));
    assert.ok(headerCols[9].includes('RBS'));
    assert.ok(headerCols[10].includes('Pallor'));
    assert.ok(headerCols[11].includes('Hb'));
    assert.ok(headerCols[12].includes('Anaemia'));
    assert.ok(headerCols[38].includes('Type of Work'));
    assert.ok(headerCols[39].includes('Consumption Unit'));
    assert.ok(headerCols[40].includes('Calorie Intake'));
    assert.ok(headerCols[41].includes('Calorie Intake Status'));
    assert.ok(headerCols[42].includes('Dietary Advice Provided'));
});

it('CSV populates Calorie Intake on 1st member only and leaves subsequent members blank', () => {
    const lines = csvContent.split('\r\n');
    const row1 = parseCsvRow(lines[1]); // Radhuji (1st member of Fam 1)
    const row2 = parseCsvRow(lines[2]); // Naniben (2nd member of Fam 1)

    // Col 40 (0-indexed) is Calorie Intake
    assert.ok(row1[40].includes('13459'), `Row 1 calorie intake should be 13459, got ${row1[40]}`);
    assert.strictEqual(row2[40], '', 'Row 2 calorie intake should be empty string');
});

// 3. PDF Generator Tests
console.log('\n--- 3. PDF Export Generator Tests ---');

itAsync('Generates valid %PDF-1. binary stream with non-trivial size (> 15KB)', async () => {
    const tempPdfPath = path.join(__dirname, 'test_export_verify.pdf');
    const outStream = fs.createWriteStream(tempPdfPath);

    await new Promise((resolve, reject) => {
        outStream.on('finish', resolve);
        outStream.on('error', reject);
        generatePdfStream(1, outStream);
    });

    const stats = fs.statSync(tempPdfPath);
    assert.ok(stats.size > 15000, `PDF size should be > 15000 bytes, got ${stats.size}`);

    const buffer = fs.readFileSync(tempPdfPath);
    const header = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'PDF must start with %PDF- header');

    // Clean up temporary test file
    fs.unlinkSync(tempPdfPath);
});

// 4. HTTP Endpoints & Auth Scoping Tests
console.log('\n--- 4. HTTP Endpoints & Multi-Tenant Authorization Tests ---');

async function testHttp() {
    const express = require('express');
    const app = express();
    const apiRoutes = require('./routes');
    app.use('/api', apiRoutes);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    const request = (path, headers = {}) => {
        return new Promise((resolve, reject) => {
            http.get(`http://localhost:${port}${path}`, { headers }, (res) => {
                let data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: Buffer.concat(data)
                    });
                });
            }).on('error', reject);
        });
    };

    try {
        await itAsync('GET /api/export/csv returns 401 Unauthorized when unauthenticated', async () => {
            const res = await request('/api/export/csv');
            assert.strictEqual(res.statusCode, 401);
        });

        await itAsync('GET /api/export/pdf returns 401 Unauthorized when unauthenticated', async () => {
            const res = await request('/api/export/pdf');
            assert.strictEqual(res.statusCode, 401);
        });

        await itAsync('GET /api/export/csv returns 200 with text/csv header for Roll 235', async () => {
            const res = await request('/api/export/csv?student_id=1&roll_number=235');
            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.headers['content-type'].includes('text/csv'));
            assert.ok(res.headers['content-disposition'].includes('Roll_235_Health_Survey_Export'));
            const text = res.body.toString('utf8');
            assert.ok(text.includes('Radhuji shukaji thakore'));
            assert.ok(text.includes('Dhavalji thakore'));
        });

        await itAsync('GET /api/export/pdf returns 200 with application/pdf header for Roll 235', async () => {
            const res = await request('/api/export/pdf?student_id=1&roll_number=235');
            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.headers['content-type'].includes('application/pdf'));
            assert.ok(res.headers['content-disposition'].includes('Roll_235_Health_Survey_Report'));
            assert.ok(res.body.length > 15000);
        });

        await itAsync('GET /api/export/data returns JSON with 5 families and 26 members for student 1', async () => {
            const res = await request('/api/export/data?student_id=1');
            assert.strictEqual(res.statusCode, 200);
            const json = JSON.parse(res.body.toString('utf8'));
            assert.strictEqual(json.student.roll_number, '235');
            assert.strictEqual(json.families.length, 5);
        });

        await itAsync('Multi-tenant isolation: cadet with 0 families gets clean empty export', async () => {
            // Create a temporary second cadet with roll 999
            db.prepare("DELETE FROM students WHERE roll_number = '999'").run();
            db.prepare("INSERT INTO students (roll_number, name, pin) VALUES ('999', 'Cadet Zero', '1234')").run();
            const cadetB = db.prepare("SELECT id FROM students WHERE roll_number = '999'").get();

            const res = await request(`/api/export/csv?student_id=${cadetB.id}&roll_number=999`);
            assert.strictEqual(res.statusCode, 200);
            const text = res.body.toString('utf8');
            const lines = text.trim().split('\r\n');
            assert.strictEqual(lines.length, 1, 'Cadet Zero should have only the header line (0 member rows)');
            assert.ok(!text.includes('Radhuji'), 'Cadet Zero must NOT see Dhruv Patel families');

            // Cleanup
            db.prepare("DELETE FROM students WHERE id = ?").run(cadetB.id);
        });

    } finally {
        server.close();
    }

    console.log('\n====================================================');
    console.log(`🏁 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('====================================================');

    if (failCount > 0) process.exit(1);
}

testHttp();
