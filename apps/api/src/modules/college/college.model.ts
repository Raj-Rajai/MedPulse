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

    async getAll(): Promise<Row[]> {
        const rows = await this.db.queryAll('SELECT * FROM colleges ORDER BY name ASC');
        return cleanList(rows);
    }

    async getById(id: unknown): Promise<Row | null> {
        const row = await this.db.queryOne('SELECT * FROM colleges WHERE id = $1', Number(id));
        return clean(row);
    }

    async getByCode(code: string): Promise<Row | null> {
        const row = await this.db.queryOne('SELECT id FROM colleges WHERE LOWER(code) = LOWER($1)', code.trim());
        return clean(row);
    }

    async create({ name, code, city, state }: CollegeInput): Promise<Row | null> {
        const result = await this.db.insert(
            `INSERT INTO colleges (name, code, city, state) VALUES ($1, $2, $3, $4)`,
            name!.trim(),
            code!.trim(),
            city ? city.trim() : null,
            state ? state.trim() : null,
        );
        return this.getById(result.lastInsertRowid);
    }

    async update(id: unknown, { name, code, city, state }: CollegeInput): Promise<Row | null> {
        await this.db.execute(
            `UPDATE colleges
             SET name = COALESCE($1, name),
                 code = COALESCE($2, code),
                 city = COALESCE($3, city),
                 state = COALESCE($4, state)
             WHERE id = $5`,
            name ? name.trim() : null,
            code ? code.trim() : null,
            city ? city.trim() : null,
            state ? state.trim() : null,
            Number(id),
        );
        return this.getById(id);
    }

    async getAdminOverview(): Promise<Row[]> {
        const rows = await this.db.queryAll(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count
            FROM colleges c
            ORDER BY c.name ASC
        `);
        return cleanList(rows);
    }
}
