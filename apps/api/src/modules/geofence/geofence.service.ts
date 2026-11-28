import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Row } from '../../common/row';

export interface AcademicYearInput {
    label: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
}

@Injectable()
export class GeofenceService implements OnModuleInit {
    private schemaReady = false;

    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async onModuleInit(): Promise<void> {
        await this.ensureColumns();
    }

    private async ensureColumns(): Promise<void> {
        if (this.schemaReady) return;
        try {
            await this.db.execute('ALTER TABLE student_geofences ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1');
            await this.db.execute('ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS area_enabled INTEGER NOT NULL DEFAULT 1');
            this.schemaReady = true;
        } catch {
            // Ignore if table doesn't exist yet
        }
    }

    async getArea(collegeId: unknown): Promise<Row | null> {
        await this.ensureColumns();
        const row = await this.db.queryOne(
            'SELECT scope_id, name, latitude, longitude, radius, COALESCE(enabled, 1) AS enabled FROM student_geofences WHERE scope_id = $1 OR scope_id = 0 ORDER BY scope_id DESC LIMIT 1',
            Number(collegeId || 0),
        );
        if (!row) return null;
        return {
            ...row,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            radius: Number(row.radius),
            enabled: Number(row.enabled ?? 1) !== 0,
        };
    }

    async isEnabled(collegeId: unknown): Promise<boolean> {
        const area = await this.getArea(collegeId);
        if (!area) return false;
        return area.enabled !== false && Number(area.enabled) !== 0;
    }

    async setEnabled(collegeId: unknown, enabled: boolean, adminId: number): Promise<boolean> {
        await this.ensureColumns();
        const scopeId = Number(collegeId || 0);
        const flag = enabled ? 1 : 0;
        const existing = await this.db.queryOne('SELECT scope_id FROM student_geofences WHERE scope_id = $1', scopeId);
        if (existing) {
            await this.db.execute(
                `UPDATE student_geofences
                 SET enabled = $1, updated_by = $2,
                     updated_at = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
                 WHERE scope_id = $3 OR scope_id = 0`,
                flag,
                Number(adminId || 1),
                scopeId,
            );
        } else {
            const fallback = await this.getArea(scopeId);
            await this.db.execute(
                `INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, enabled, updated_by, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
                 ON CONFLICT (scope_id) DO UPDATE SET
                     enabled = EXCLUDED.enabled,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = EXCLUDED.updated_at`,
                scopeId,
                String(fallback?.name || 'RHTC Khoraj Rural Field Training Center'),
                Number(fallback?.latitude ?? 23.1678),
                Number(fallback?.longitude ?? 72.5714),
                Number(fallback?.radius ?? 3000),
                flag,
                Number(adminId || 1),
            );
            await this.db.execute('UPDATE student_geofences SET enabled = $1 WHERE scope_id = 0', flag);
        }
        return enabled;
    }

    async setYearAreaEnabled(id: unknown, enabled: boolean, adminId: number): Promise<boolean> {
        await this.ensureColumns();
        await this.db.execute(
            `UPDATE academic_years
             SET area_enabled = $1, area_updated_by = $2,
                 area_updated_at = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
             WHERE id = $3`,
            enabled ? 1 : 0,
            Number(adminId || 1),
            Number(id),
        );
        return enabled;
    }

    async getAreaForStudent(student: { academic_year_id?: unknown; college_id?: unknown }): Promise<Row | null> {
        await this.ensureColumns();
        const collegeArea = await this.getArea(student?.college_id);
        const masterEnabled = collegeArea ? collegeArea.enabled !== false : true;

        if (student?.academic_year_id) {
            const own = await this.db.queryOne(
                `SELECT area_name AS name, latitude, longitude, radius, COALESCE(area_enabled, 1) AS area_enabled
                 FROM academic_years
                 WHERE id = $1 AND area_name IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL AND radius IS NOT NULL`,
                Number(student.academic_year_id),
            );
            if (own) {
                const yearEnabled = Number(own.area_enabled ?? 1) !== 0;
                return {
                    name: own.name,
                    latitude: Number(own.latitude),
                    longitude: Number(own.longitude),
                    radius: Number(own.radius),
                    enabled: masterEnabled && yearEnabled,
                };
            }
        }
        return collegeArea;
    }

    async saveArea(scopeId: number, name: string, latitude: number, longitude: number, radius: number, adminId: number, enabled?: boolean): Promise<void> {
        await this.ensureColumns();
        const current = await this.getArea(scopeId);
        const flag = enabled !== undefined ? (enabled ? 1 : 0) : (current && current.enabled === false ? 0 : 1);
        await this.db.execute(
            `INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, enabled, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
             ON CONFLICT (scope_id) DO UPDATE SET
                 name = EXCLUDED.name,
                 latitude = EXCLUDED.latitude,
                 longitude = EXCLUDED.longitude,
                 radius = EXCLUDED.radius,
                 enabled = EXCLUDED.enabled,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`,
            Number(scopeId),
            name.trim(),
            Number(latitude),
            Number(longitude),
            Number(radius),
            flag,
            Number(adminId),
        );
    }

    /* ── Academic years ───────────────────────────────────── */

    async listAcademicYears(): Promise<Row[]> {
        await this.ensureColumns();
        return this.db.queryAll(
            `SELECT ay.id, ay.label, ay.start_date, ay.end_date, ay.is_current,
                    ay.area_name, ay.latitude, ay.longitude, ay.radius,
                    COALESCE(ay.area_enabled, 1) AS area_enabled, ay.area_updated_at,
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
