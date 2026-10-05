import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clean, cleanList, Row } from '../../common/row';

export interface CollegeInput {
    name?: string;
    code?: string;
    city?: string;
    state?: string;
}

@Injectable()
export class CollegeModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    getAll(): Row[] {
        const rows = this.db.prepare('SELECT * FROM colleges ORDER BY name ASC').all();
        return cleanList(rows);
    }

    getById(id: unknown): Row | null {
        const row = this.db.prepare('SELECT * FROM colleges WHERE id = ?').get(id);
        return clean(row);
    }

    getByCode(code: string): Row | null {
        const row = this.db.prepare('SELECT id FROM colleges WHERE LOWER(code) = LOWER(?)').get(code.trim());
        return clean(row);
    }

    create({ name, code, city, state }: CollegeInput): Row | null {
        const stmt = this.db.prepare(`
            INSERT INTO colleges (name, code, city, state)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(name!.trim(), code!.trim(), city ? city.trim() : null, state ? state.trim() : null);
        return this.getById(Number(result.lastInsertRowid));
    }

    update(id: unknown, { name, code, city, state }: CollegeInput): Row | null {
        this.db.prepare(`
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
            id,
        );
        return this.getById(id);
    }

    getAdminOverview(): Row[] {
        const rows = this.db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count
            FROM colleges c
            ORDER BY c.name ASC
        `).all();
        return cleanList(rows);
    }
}
