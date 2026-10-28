require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Worker } = require('node:worker_threads');
const { memberIdentitySchema } = require('../dist/database/schemas/61-member-identity.schema');
const { SCHEMAS } = require('../dist/database/schemas');
const { FamilyModel } = require('../dist/modules/survey/family.model');
const { PatientFamilyModel } = require('../dist/modules/patient/patient-family.model');

function simpleDb(t, path = ':memory:') {
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE family_members (id INTEGER PRIMARY KEY AUTOINCREMENT, family_id INTEGER, name TEXT)');
    t.after(() => db.close());
    return db;
}

test('startup backfills existing members, remains idempotent, and keeps identities immutable', (t) => {
    const db = simpleDb(t);
    db.exec("INSERT INTO family_members (family_id, name) VALUES (1, 'Existing'), (2, 'Other family')");
    memberIdentitySchema.apply(db);
    memberIdentitySchema.apply(db);
    assert.deepEqual(db.prepare('SELECT medpulse_id FROM family_members ORDER BY id').all().map((m) => m.medpulse_id), ['MP-00000001', 'MP-00000002']);
    for (const value of ['MP-00000002', 'MP-99999999', '', null]) {
        assert.throws(() => db.prepare('UPDATE family_members SET medpulse_id = ? WHERE id = 1').run(value));
        assert.throws(() => db.prepare('INSERT INTO family_members (medpulse_id) VALUES (?)').run(value === null ? '' : value));
    }
    assert.throws(() => db.exec('UPDATE family_members SET id = 20 WHERE id = 1'));
    db.exec("UPDATE family_members SET name = 'Renamed', family_id = 3 WHERE id = 1");
    assert.equal(db.prepare('SELECT medpulse_id FROM family_members WHERE id = 1').get().medpulse_id, 'MP-00000001');
    db.exec('DELETE FROM family_members WHERE id = 2');
    db.exec("INSERT INTO family_members (family_id, name) VALUES (2, 'New member')");
    assert.equal(db.prepare('SELECT medpulse_id FROM family_members WHERE id = 3').get().medpulse_id, 'MP-00000003');
    assert.equal(db.prepare("SELECT [unique] FROM pragma_index_list('family_members') WHERE name = 'family_members_medpulse_id_unique'").get().unique, 1);
});

test('student registration and bulk creation return persisted IDs across students and ignore client IDs', (t) => {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    db.exec('PRAGMA foreign_keys = ON');
    SCHEMAS.forEach((schema) => schema.apply(db));
    db.exec("INSERT INTO students (id, roll_number, name) VALUES (1, 'ID-TEST-1', 'Student 1'), (2, 'ID-TEST-2', 'Student 2')");
    const model = new FamilyModel({ db });
    const first = model.createFamily(1, { family_no: 1, head_of_family: 'First', members: [{ name: 'Bulk member', medpulse_id: 'CLIENT-SUPPLIED' }] });
    const second = model.createFamily(2, { family_no: 1, head_of_family: 'Second' });
    assert.ok(first.family_id);
    assert.ok(second.family_id);
    const one = model.addMember(first.family_id, 1, { name: 'Student one member', medpulse_id: 'CLIENT-SUPPLIED' }).member;
    const two = model.addMember(second.family_id, 2, { name: 'Student two member', medpulse_id: one.medpulse_id }).member;
    assert.ok(one.medpulse_id.match(/^MP-\d{8,}$/));
    assert.notEqual(one.medpulse_id, two.medpulse_id);
    assert.equal(db.prepare('SELECT medpulse_id FROM family_members WHERE id = ?').get(one.id).medpulse_id, one.medpulse_id);
    const edited = model.updateMember(one.id, 1, { name: 'Edited', medpulse_id: two.medpulse_id }).member;
    assert.equal(edited.medpulse_id, one.medpulse_id);
    assert.equal(model.getFamilyById(first.family_id, 1).family.members.find((m) => m.id === one.id).medpulse_id, one.medpulse_id);
    const all = db.prepare('SELECT medpulse_id FROM family_members').all();
    assert.equal(new Set(all.map((m) => m.medpulse_id)).size, 3);
    assert.ok(all.every((m) => m.medpulse_id && m.medpulse_id !== 'CLIENT-SUPPLIED'));
    db.prepare(`INSERT INTO patients (id, patient_uid, name, phone, family_id, family_member_id, family_role)
        VALUES (1, 'IDENTITY-TEST', 'Patient head', '9990000001', ?, ?, 'Head')`).run(first.family_id, one.id);
    const patientModel = new PatientFamilyModel({ db });
    const added = patientModel.addMember(1, { name: 'Patient-added member', gender: 'F', relation_to_hof: 'Spouse', age_years: 30, medpulse_id: one.medpulse_id });
    const patientMember = added.members.find((m) => m.id === added.id);
    assert.ok(patientMember.medpulse_id);
    assert.notEqual(patientMember.medpulse_id, one.medpulse_id);
    assert.equal(new Set(db.prepare('SELECT medpulse_id FROM family_members').all().map((m) => m.medpulse_id)).size, 4);
});

test('concurrent server connections assign unique IDs and preserve them after restart', async (t) => {
    const folder = mkdtempSync(join(tmpdir(), 'medpulse-identity-'));
    t.after(() => rmSync(folder, { recursive: true, force: true }));
    const path = join(folder, 'members.db');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE family_members (id INTEGER PRIMARY KEY AUTOINCREMENT, family_id INTEGER, name TEXT)');
    memberIdentitySchema.apply(db);
    db.close();
    const workerSource = `
        const { workerData, parentPort } = require('node:worker_threads');
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(workerData.path);
        db.exec('PRAGMA busy_timeout = 10000');
        const insert = db.prepare('INSERT INTO family_members (family_id, name) VALUES (?, ?)');
        const ids = [];
        for (let i = 0; i < 25; i++) {
            const row = insert.run(workerData.family, 'Member ' + i);
            ids.push(db.prepare('SELECT medpulse_id FROM family_members WHERE id = ?').get(row.lastInsertRowid).medpulse_id);
        }
        db.close();
        parentPort.postMessage(ids);
    `;
    const ids = (await Promise.all([1, 2, 3, 4].map((family) => new Promise((resolve, reject) => {
        const worker = new Worker(workerSource, { eval: true, workerData: { path, family } });
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', (code) => { if (code) reject(new Error('Worker exited ' + code)); });
    })))).flat();
    assert.equal(ids.length, 100);
    assert.equal(new Set(ids).size, 100);
    assert.ok(ids.every((id) => /^MP-\d{8,}$/.test(id)));
    const reopened = new DatabaseSync(path);
    try {
        memberIdentitySchema.apply(reopened);
        assert.deepEqual(new Set(reopened.prepare('SELECT medpulse_id FROM family_members').all().map((m) => m.medpulse_id)), new Set(ids));
    } finally {
        reopened.close();
    }
});
