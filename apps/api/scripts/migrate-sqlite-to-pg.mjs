#!/usr/bin/env node
/**
 * MedPulse SQLite -> PostgreSQL Full Data Migration, Verification, Backup & Cleanup
 *
 * Usage:
 *   node apps/api/scripts/migrate-sqlite-to-pg.mjs                  # Migrate + verify row counts
 *   node apps/api/scripts/migrate-sqlite-to-pg.mjs --zip-and-delete # Migrate + verify + zip SQLite files + delete SQLite files
 *   node apps/api/scripts/migrate-sqlite-to-pg.mjs --truncate       # Truncate PG tables before migrating (idempotent re-run)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { Client } = require('pg');

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
if (fs.existsSync(ENV_PATH)) {
    dotenv.config({ path: ENV_PATH });
}

const SQLITE_PATH = process.env.MEDPULSE_SQLITE_PATH || path.join(REPO_ROOT, 'database', 'health_survey.db');
const DATABASE_URL = process.env.DATABASE_URL;
const ARGS = new Set(process.argv.slice(2));
const DO_TRUNCATE = ARGS.has('--truncate');
const DO_ZIP_AND_DELETE = ARGS.has('--zip-and-delete');

// Strict parent-before-child topological order across all 39 tables
const TABLE_ORDER = [
    'colleges',
    'admins',
    'academic_years',
    'students',
    'student_geofences',
    'hospitals',
    'hospital_admins',
    'families',
    'family_members',
    'patients',
    'follow_ups',
    'follow_up_visits',
    'allergies',
    'clinical_history',
    'health_conditions',
    'lifestyle_habits',
    'medications',
    'member_allergies',
    'member_conditions',
    'member_lifestyle',
    'member_medical_history',
    'member_medications',
    'hospital_visits',
    'hospital_callback_requests',
    'campaigns',
    'campaign_notifications',
    'academic_subjects',
    'academic_lectures',
    'academic_attendance',
    'academic_exams',
    'academic_exam_marks',
    'attendance_clusters',
    'attendance_cluster_members',
    'attendance_cluster_events',
    'consent_records',
    'portal_sessions',
    'patient_record_access',
    'patient_record_corrections',
    'portal_privacy_audit',
];

const TIMESTAMP_COLUMNS = new Set([
    'created_at',
    'updated_at',
    'rsvp_at',
    'read_at',
    'contacted_at',
    'patient_contact_confirmed_at',
    'resolved_at',
    'patient_updated_at',
]);

const BIGINT_TIMESTAMP_TABLES = new Set([
    'attendance_clusters',
    'attendance_cluster_members',
    'attendance_cluster_events',
    'portal_sessions',
    'patient_record_access',
    'patient_record_corrections',
    'portal_privacy_audit',
]);

const TABLES_WITHOUT_SERIAL_ID = new Set([
    'student_geofences',
    'attendance_clusters',
    'attendance_cluster_members',
    'portal_sessions',
]);

function normalizeValue(table, col, val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'bigint') return val.toString();
    if (!BIGINT_TIMESTAMP_TABLES.has(table) && TIMESTAMP_COLUMNS.has(col) && typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
            return trimmed.replace(' ', 'T') + 'Z';
        }
        return trimmed;
    }
    return val;
}

async function main() {
    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL is not set. Add it to .env in the repository root.');
        process.exit(1);
    }
    if (!fs.existsSync(SQLITE_PATH)) {
        console.error(`❌ SQLite database not found at: ${SQLITE_PATH}`);
        process.exit(1);
    }

    const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
    const existingSqliteTables = new Set(
        sqlite
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
            .all()
            .map((r) => r.name),
    );

    const tablesToMigrate = TABLE_ORDER.filter((t) => existingSqliteTables.has(t));
    for (const extra of existingSqliteTables) {
        if (!tablesToMigrate.includes(extra)) tablesToMigrate.push(extra);
    }

    const pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();
    console.log(`✅ Connected to PostgreSQL (${pg.host}:${pg.port}/${pg.database})`);
    console.log(`📦 Reading SQLite database: ${SQLITE_PATH} (${tablesToMigrate.length} tables)`);

    try {
        await pg.query('BEGIN');

        if (DO_TRUNCATE) {
            console.log('🧹 Truncating target PostgreSQL tables (--truncate)...');
            const quoted = [...tablesToMigrate].reverse().map((t) => `"${t}"`).join(', ');
            await pg.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
        }

        // Disable family_members triggers if they exist so bulk load preserves exact IDs
        await pg.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_server_only') THEN
                    ALTER TABLE family_members DISABLE TRIGGER family_members_identity_server_only;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_assign') THEN
                    ALTER TABLE family_members DISABLE TRIGGER family_members_identity_assign;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_immutable') THEN
                    ALTER TABLE family_members DISABLE TRIGGER family_members_identity_immutable;
                END IF;
            END $$;
        `);

        const BATCH_SIZE = 200;
        let totalInserted = 0;

        for (const table of tablesToMigrate) {
            const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
            if (rows.length === 0) {
                console.log(`  - ${table.padEnd(32)} 0 rows (skipped)`);
                continue;
            }

            // Get target PG columns to ensure we only insert columns that exist in PG
            const pgColsRes = await pg.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
                [table],
            );
            const pgColSet = new Set(pgColsRes.rows.map((r) => r.column_name));
            const cols = Object.keys(rows[0]).filter((c) => pgColSet.has(c));

            const colList = cols.map((c) => `"${c}"`).join(', ');
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const chunk = rows.slice(i, i + BATCH_SIZE);
                const values = [];
                const placeholders = chunk.map((row, rowIdx) => {
                    const base = rowIdx * cols.length;
                    const ph = cols.map((col, colIdx) => {
                        values.push(normalizeValue(table, col, row[col]));
                        return `$${base + colIdx + 1}`;
                    });
                    return `(${ph.join(', ')})`;
                });
                const sql = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
                await pg.query(sql, values);
            }

            totalInserted += rows.length;
            console.log(`  ✓ ${table.padEnd(32)} ${String(rows.length).padStart(7)} rows migrated`);
        }

        // Backfill medpulse_id for all migrated family_members & re-enable triggers
        await pg.query(`
            UPDATE family_members
            SET medpulse_id = 'MP-' || LPAD(id::text, 8, '0')
            WHERE medpulse_id IS NULL OR medpulse_id = ''
        `);
        await pg.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_server_only') THEN
                    ALTER TABLE family_members ENABLE TRIGGER family_members_identity_server_only;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_assign') THEN
                    ALTER TABLE family_members ENABLE TRIGGER family_members_identity_assign;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'family_members_identity_immutable') THEN
                    ALTER TABLE family_members ENABLE TRIGGER family_members_identity_immutable;
                END IF;
            END $$;
        `);

        // Reset every SERIAL/IDENTITY sequence so future inserts don't collide
        for (const table of tablesToMigrate) {
            if (TABLES_WITHOUT_SERIAL_ID.has(table)) continue;
            await pg.query(`
                SELECT setval(
                    pg_get_serial_sequence('${table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM "${table}"), 1),
                    (SELECT COUNT(*) > 0 FROM "${table}")
                )
            `);
        }

        await pg.query('COMMIT');
        console.log(`\n✅ Transaction committed (${totalInserted} source rows processed).`);
    } catch (err) {
        await pg.query('ROLLBACK');
        console.error('❌ Migration failed and was rolled back:', err);
        process.exit(1);
    }

    // Exact row-count verification
    console.log('\n🔍 Verifying exact row counts (SQLite vs PostgreSQL):');
    let mismatches = 0;
    let totalSqlite = 0;
    let totalPg = 0;

    for (const table of tablesToMigrate) {
        const sCount = Number(sqlite.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c);
        const pCount = Number((await pg.query(`SELECT COUNT(*) as c FROM "${table}"`)).rows[0].c);
        totalSqlite += sCount;
        totalPg += pCount;
        const ok = sCount === pCount;
        if (!ok) mismatches++;
        console.log(`  ${ok ? '✅' : '❌'} ${table.padEnd(32)} SQLite=${String(sCount).padStart(6)}  PG=${String(pCount).padStart(6)}`);
    }

    console.log(`\nSUMMARY: SQLite=${totalSqlite} rows, PostgreSQL=${totalPg} rows, Mismatches=${mismatches}`);

    await pg.end();
    sqlite.close();

    if (mismatches > 0) {
        console.error('❌ Row count verification FAILED. SQLite files were NOT deleted.');
        process.exit(1);
    }

    console.log('🎉 100% row-count parity verified across all tables!');

    if (DO_ZIP_AND_DELETE) {
        const dbDir = path.join(REPO_ROOT, 'database');
        const filesToArchive = ['health_survey.db', 'seed.sql', 'sample_seed.sql']
            .map((f) => path.join(dbDir, f))
            .filter((p) => fs.existsSync(p));

        if (filesToArchive.length === 0) {
            console.log('ℹ️ No SQLite files left to archive.');
            return;
        }

        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipPath = path.join(dbDir, `sqlite_backup_${stamp}.zip`);

        if (process.platform === 'win32') {
            const quotedPaths = filesToArchive.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
            execFileSync('powershell.exe', [
                '-NoProfile',
                '-Command',
                `Compress-Archive -Path ${quotedPaths} -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
            ]);
        } else {
            execFileSync('zip', ['-j', zipPath, ...filesToArchive]);
        }

        if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
            console.error('❌ Zip backup verification failed. SQLite files were NOT deleted.');
            process.exit(1);
        }

        console.log(`📦 Created verified SQLite backup archive: ${zipPath} (${fs.statSync(zipPath).size} bytes)`);

        for (const f of filesToArchive) {
            fs.unlinkSync(f);
            console.log(`🗑️ Deleted legacy SQLite file: ${path.basename(f)}`);
        }
        console.log('✅ Legacy SQLite files archived and deleted cleanly.');
    }
}

main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
