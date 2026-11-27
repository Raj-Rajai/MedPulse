import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Row } from '../../common/row';

export interface AcademicYearInput {
    label: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
}

@Injectable()
export class GeofenceService {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async getArea(collegeId: unknown): Promise<Row | null> {
        const row = await this.db.queryOne(
            'SELECT name, latitude, longitude, radius FROM student_geofences WHERE scope_id = $1 OR scope_id = 0 ORDER BY scope_id DESC LIMIT 1',
            Number(collegeId || 0),
        );
        return row || null;
    }

    async getAreaForStudent(student: { academic_year_id?: unknown; college_id?: unknown }): Promise<Row | null> {
        if (student.academic_year_id) {
            const own = await this.db.queryOne(
                `SELECT area_name AS name, latitude, longitude, radius FROM academic_years
                 WHERE id = $1 AND area_name IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL AND radius IS NOT NULL`,
                Number(student.academic_year_id),
            );
            if (own) return own;
        }
        return this.getArea(student.college_id);
    }

    async saveArea(scopeId: number, name: string, latitude: number, longitude: number, radius: number, adminId: number): Promise<void> {
        await this.db.execute(
            `INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
             ON CONFLICT (scope_id) DO UPDATE SET
                 name = EXCLUDED.name,
                 latitude = EXCLUDED.latitude,
                 longitude = EXCLUDED.longitude,
                 radius = EXCLUDED.radius,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`,
            Number(scopeId),
            name.trim(),
            Number(latitude),
            Number(longitude),
            Number(radius),
            Number(adminId),
        );
    }

    /* ── Academic years ───────────────────────────────────── */

    async listAcademicYears(): Promise<Row[]> {
        return this.db.queryAll(
            `SELECT ay.id, ay.label, ay.start_date, ay.end_date, ay.is_current,
                    ay.area_name, ay.latitude, ay.longitude, ay.radius, ay.area_updated_at,
                    (SELECT COUNT(*) FROM students s WHERE s.academic_year_id = ay.id) AS students_count
             FROM academic_years ay ORDER BY ay.label DESC`,
        );
    }

    async getAcademicYear(id: unknown): Promise<Row | null> {
        const row = await this.db.queryOne('SELECT * FROM academic_years WHERE id = $1', Number(id));
        return row || null;
    }

    async labelTaken(label: string, exceptId?: unknown): Promise<boolean> {
        if (exceptId !== undefined && exceptId !== null) {
            const row = await this.db.queryOne(
                'SELECT id FROM academic_years WHERE label = $1 AND id <> $2',
                label,
                Number(exceptId),
            );
            return !!row;
        }
        const row = await this.db.queryOne('SELECT id FROM academic_years WHERE label = $1', label);
        return !!row;
    }

    async createAcademicYear(input: AcademicYearInput): Promise<Row | null> {
        const id = await this.db.inTransaction(async (tx) => {
            if (input.is_current) await tx.execute('UPDATE academic_years SET is_current = 0');
            const res = await tx.insert(
                'INSERT INTO academic_years (label, start_date, end_date, is_current) VALUES ($1, $2, $3, $4)',
                input.label,
                input.start_date,
                input.end_date,
                input.is_current ? 1 : 0,
            );
            return res.lastInsertRowid;
        });
        return this.getAcademicYear(id);
    }

    async updateAcademicYear(id: unknown, input: AcademicYearInput): Promise<Row | null> {
        const numId = Number(id);
        await this.db.inTransaction(async (tx) => {
            if (input.is_current) await tx.execute('UPDATE academic_years SET is_current = 0 WHERE id <> $1', numId);
            await tx.execute(
                'UPDATE academic_years SET label = $1, start_date = $2, end_date = $3, is_current = $4 WHERE id = $5',
                input.label,
                input.start_date,
                input.end_date,
                input.is_current ? 1 : 0,
                numId,
            );
        });
        return this.getAcademicYear(numId);
    }

    async deleteAcademicYear(id: unknown): Promise<number> {
        const numId = Number(id);
        return this.db.inTransaction(async (tx) => {
            const moved = (await tx.execute('UPDATE students SET academic_year_id = NULL WHERE academic_year_id = $1', numId)).changes;
            await tx.execute('DELETE FROM academic_years WHERE id = $1', numId);
            return moved;
        });
    }

    async saveYearArea(id: unknown, name: string, latitude: number, longitude: number, radius: number, adminId: number): Promise<void> {
        await this.db.execute(
            `UPDATE academic_years
             SET area_name = $1, latitude = $2, longitude = $3, radius = $4,
                 area_updated_by = $5,
                 area_updated_at = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
             WHERE id = $6`,
            name.trim(),
            Number(latitude),
            Number(longitude),
            Number(radius),
            Number(adminId),
            Number(id),
        );
    }

    async clearYearArea(id: unknown): Promise<void> {
        await this.db.execute(
            `UPDATE academic_years
             SET area_name = NULL, latitude = NULL, longitude = NULL, radius = NULL,
                 area_updated_by = NULL, area_updated_at = NULL
             WHERE id = $1`,
            Number(id),
        );
    }

    async assignStudents(yearId: number | null, studentIds: number[]): Promise<number> {
        return this.db.inTransaction(async (tx) => {
            let total = 0;
            for (const sid of studentIds) {
                const res = await tx.execute('UPDATE students SET academic_year_id = $1 WHERE id = $2', yearId, Number(sid));
                total += res.changes;
            }
            return total;
        });
    }
}
