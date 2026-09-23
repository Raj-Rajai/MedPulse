const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');

const CollegeModel = {
    getAll() {
        const rows = db.prepare('SELECT * FROM colleges ORDER BY name ASC').all();
        return cleanList(rows);
    },

    getById(id) {
        const row = db.prepare('SELECT * FROM colleges WHERE id = ?').get(id);
        return clean(row);
    },

    getByCode(code) {
        const row = db.prepare('SELECT id FROM colleges WHERE LOWER(code) = LOWER(?)').get(code.trim());
        return clean(row);
    },

    create({ name, code, city, state }) {
        const stmt = db.prepare(`
            INSERT INTO colleges (name, code, city, state)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(name.trim(), code.trim(), city ? city.trim() : null, state ? state.trim() : null);
        return this.getById(Number(result.lastInsertRowid));
    },

    update(id, { name, code, city, state }) {
        db.prepare(`
            UPDATE colleges
            SET name = COALESCE(?, name),
                code = COALESCE(?, code),
                city = COALESCE(?, city),
                state = COALESCE(?, state)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            code ? code.trim() : null,
            city ? city.trim() : null,
            state ? state.trim() : null,
            id
        );
        return this.getById(id);
    },

    getAdminOverview() {
        const rows = db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count
            FROM colleges c
            ORDER BY c.name ASC
        `).all();
        return cleanList(rows);
    }
};

module.exports = CollegeModel;
