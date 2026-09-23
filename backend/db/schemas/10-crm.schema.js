/**
 * CRM-owned: patients, campaigns, campaign notifications, hospital callback requests.
 * Loaded automatically by backend/config/db.js (files run in filename order).
 */
module.exports = {
    name: 'crm',
    apply(db) {

        db.exec(`
            -- Patients Dual-Model
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_uid TEXT UNIQUE NOT NULL,
                student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                pin TEXT NOT NULL DEFAULT '1234',
                age_years INTEGER,
                gender TEXT,
                model_type TEXT CHECK(model_type IN ('Independent', 'Dependent')) DEFAULT 'Independent',
                referral_code_used TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );


            -- Public Health Campaigns (College / Faculty Initiated)
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                keyword TEXT NOT NULL,
                description TEXT NOT NULL,
                college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
                created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                event_date TEXT,
                venue TEXT,
                status TEXT CHECK(status IN ('Active', 'Completed', 'Cancelled')) DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Targeted Patient CRM Notifications & Cadet Action Items
            CREATE TABLE IF NOT EXISTS campaign_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                matched_keyword TEXT NOT NULL,
                matched_condition_detail TEXT,
                status TEXT CHECK(status IN ('Delivered', 'Read', 'Acknowledged', 'Declined')) DEFAULT 'Delivered',
                patient_response_note TEXT,
                cadet_call_status TEXT CHECK(cadet_call_status IN ('Pending', 'Contacted', 'Assisted')) DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_campaigns_keyword ON campaigns(keyword);
            CREATE INDEX IF NOT EXISTS idx_campaigns_college ON campaigns(college_id);
            CREATE INDEX IF NOT EXISTS idx_campaign_notifs_patient ON campaign_notifications(patient_id);
            CREATE INDEX IF NOT EXISTS idx_campaign_notifs_student ON campaign_notifications(student_id);
            CREATE INDEX IF NOT EXISTS idx_campaign_notifs_camp ON campaign_notifications(campaign_id);
        `);


        // ---- Patient engagement (v2.1): campaign RSVP detail + call confirmation ----
        const addColumn = (table, column, ddl) => {
            const cols = db.prepare(`PRAGMA table_info(${table})`).all();
            if (cols.length && !cols.some((c) => c.name === column)) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
            }
        };
        addColumn('campaign_notifications', 'rsvp', "TEXT DEFAULT 'Pending'");        // Pending | Attending | Not Attending | Need Help
        addColumn('campaign_notifications', 'rsvp_note', 'TEXT');
        addColumn('campaign_notifications', 'rsvp_at', 'DATETIME');
        addColumn('campaign_notifications', 'read_at', 'DATETIME');
        addColumn('campaign_notifications', 'contacted_at', 'DATETIME');               // set when student marks Contacted/Assisted
        addColumn('campaign_notifications', 'patient_contact_confirmation', 'TEXT');   // NULL | Confirmed | Disputed
        addColumn('campaign_notifications', 'patient_contact_confirmed_at', 'DATETIME');

        // ---- Patient profile card (v2.2) ----
        addColumn('patients', 'blood_group', 'TEXT');
        addColumn('patients', 'emergency_contact_name', 'TEXT');
        addColumn('patients', 'emergency_contact_phone', 'TEXT');
        addColumn('patients', 'emergency_contact_relation', 'TEXT');
        addColumn('patients', 'family_id', 'INTEGER');                                 // household this account belongs to
        addColumn('patients', 'family_role', "TEXT DEFAULT 'Head'");                   // Head (can edit family) | Member (read-only)

        // ---- Patient-managed family (v2.2) ----
        // NOTE (shared tables): two harmless additive columns on family_members so students
        // can see which records the patient added or edited.
        addColumn('family_members', 'added_by_patient_id', 'INTEGER');
        addColumn('family_members', 'patient_updated_at', 'DATETIME');

        // NOTE (shared table): self-registered patients have no student yet, so families.student_id
        // must allow NULL. Rebuild the table once, copying all rows, only if it is still NOT NULL.
        const famCol = db.prepare('PRAGMA table_info(families)').all().find((c) => c.name === 'student_id');
        if (famCol && famCol.notnull) {
            const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'families'").get();
            const newSql = row.sql
                .replace(/^CREATE TABLE\s+"?families"?/i, 'CREATE TABLE families__rebuild')
                .replace(/student_id\s+INTEGER\s+NOT\s+NULL/i, 'student_id INTEGER');
            const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'families' AND sql IS NOT NULL").all();
            db.exec('PRAGMA foreign_keys = OFF;');
            try {
                db.exec('BEGIN;');
                db.exec(newSql);
                db.exec('INSERT INTO families__rebuild SELECT * FROM families;');
                db.exec('DROP TABLE families;');
                db.exec('ALTER TABLE families__rebuild RENAME TO families;');
                indexes.forEach((ix) => db.exec(ix.sql));
                db.exec('COMMIT;');
            } catch (err) {
                try { db.exec('ROLLBACK;'); } catch (e) { /* ignore */ }
                throw err;
            } finally {
                db.exec('PRAGMA foreign_keys = ON;');
            }
        }

        db.exec(`
            -- Patient -> Hospital callback requests (CRM-owned; HMS reads them via /api/crm/hospital/*)
            CREATE TABLE IF NOT EXISTS hospital_callback_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
                for_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                channel TEXT CHECK(channel IN ('Callback', 'WhatsApp')) DEFAULT 'Callback',
                department TEXT NOT NULL DEFAULT 'General Medicine',
                reason TEXT NOT NULL DEFAULT 'Consultation',
                message TEXT,
                preferred_time TEXT,
                status TEXT CHECK(status IN ('Open', 'Acknowledged', 'Scheduled', 'Resolved', 'Cancelled')) DEFAULT 'Open',
                hospital_note TEXT,
                scheduled_for TEXT,
                handled_by_admin_id INTEGER REFERENCES hospital_admins(id) ON DELETE SET NULL,
                patient_confirmation TEXT CHECK(patient_confirmation IN ('Confirmed', 'Disputed')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            );
            CREATE INDEX IF NOT EXISTS idx_hosp_cb_patient ON hospital_callback_requests(patient_id);
            CREATE INDEX IF NOT EXISTS idx_hosp_cb_hospital ON hospital_callback_requests(hospital_id, status);
        `);

        // v2.1 patient->student requests were replaced by hospital callbacks in v2.2.
        // Drop the old table only if it holds no data.
        const oldReq = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'patient_contact_requests'").get();
        if (oldReq && db.prepare('SELECT COUNT(*) AS n FROM patient_contact_requests').get().n === 0) {
            db.exec('DROP TABLE patient_contact_requests;');
        }
    }
};
