const path = require('node:path');
const fs = require('node:fs');

let DatabaseSync;
try {
    ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
    if (err && err.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && err.code !== 'MODULE_NOT_FOUND') {
        throw err;
    }
    DatabaseSync = require('better-sqlite3');
}

const dbDir = path.join(__dirname, '..', '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'health_survey.db');
const db = new DatabaseSync(dbPath);

// Enable foreign key constraints
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize database schema and optional initial seed data
 */
function initDatabase() {
    try {
        // Apply every schema module in backend/db/schemas (sorted by filename).
        // CRM and HMS each own their own file here, so schema work never collides.
        const schemaDir = path.join(__dirname, '..', 'db', 'schemas');
        fs.readdirSync(schemaDir)
            .filter((f) => f.endsWith('.schema.js'))
            .sort()
            .forEach((f) => require(path.join(schemaDir, f)).apply(db));

        // Auto-seed survey data (Roll 235) if families table is empty
        const familyCountRow = db.prepare('SELECT COUNT(*) as count FROM families').get();
        if (!familyCountRow || familyCountRow.count === 0) {
            console.log('🌱 No survey records found in database. Auto-seeding Roll 235 survey data...');
            try {
                const { seedRoll235 } = require('./seed-roll235');
                seedRoll235(db);
            } catch (seedErr) {
                console.error('⚠️ Could not auto-seed Roll 235 data:', seedErr.message);
            }
        }

        console.log('✅ SQLite Database ready at:', dbPath);
    } catch (err) {
        console.error('❌ Error initializing database:', err);
        throw err;
    }
}

module.exports = {
    db,
    initDatabase
};
