module.exports = {
    apply(db) {
        db.exec(`CREATE TABLE IF NOT EXISTS student_geofences (
            scope_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius REAL NOT NULL,
            updated_by INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
    }
};
