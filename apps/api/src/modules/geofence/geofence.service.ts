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

    private transaction<T>(fn: () => T): T {
        this.db.exec('BEGIN');
        try {
            const out = fn();
            this.db.exec('COMMIT');
            return out;
        } catch (e) {
            this.db.exec('ROLLBACK');
            throw e;
        }
    }

    /** The default boundary (per college, else global): used by students whose academic year has no area. */
    getArea(collegeId: unknown): Row | null {
        return (
            this.db
                .prepare(
                    'SELECT name, latitude, longitude, radius FROM student_geofences WHERE scope_id = ? OR scope_id = 0 ORDER BY scope_id DESC LIMIT 1',
                )
                .get(collegeId || 0) || null
        );
    }

    /** The area a student must be inside: their academic year's area, else the default boundary. */
    getAreaForStudent(student: { academic_year_id?: unknown; college_id?: unknown }): Row | null {
        if (student.academic_year_id) {
            const own = this.db
                .prepare(`SELECT area_name AS name, latitude, longitude, radius FROM academic_years
                          WHERE id = ? AND area_name IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL AND radius IS NOT NULL`)
                .get(student.academic_year_id);
            if (own) return own;
        }
        return this.getArea(student.college_id);
    }

    saveArea(scopeId: number, name: string, latitude: number, longitude: number, radius: number, adminId: number): void {
        this.db.prepare(`INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, updated_by)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(scope_id) DO UPDATE SET
        name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude,
        radius=excluded.radius, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
            .run(scopeId, name.trim(), latitude, longitude, radius, adminId);
    }

    /* ── Academic years ───────────────────────────────────── */

    listAcademicYears(): Row[] {
        return this.db
            .prepare(`SELECT ay.id, ay.label, ay.start_date, ay.end_date, ay.is_current,
                             ay.area_name, ay.latitude, ay.longitude, ay.radius, ay.area_updated_at,
                             (SELECT COUNT(*) FROM students s WHERE s.academic_year_id = ay.id) AS students_count
                      FROM academic_years ay ORDER BY ay.label DESC`)
            .all();
    }

    getAcademicYear(id: unknown): Row | null {
        return this.db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id) || null;
    }

    labelTaken(label: string, exceptId?: unknown): boolean {
        return !!this.db.prepare('SELECT id FROM academic_years WHERE label = ? AND id IS NOT ?').get(label, exceptId ?? null);
    }

    createAcademicYear(input: AcademicYearInput): Row | null {
        const id = this.transaction(() => {
            if (input.is_current) this.db.prepare('UPDATE academic_years SET is_current = 0').run();
            const res = this.db
                .prepare('INSERT INTO academic_years (label, start_date, end_date, is_current) VALUES (?, ?, ?, ?)')
                .run(input.label, input.start_date, input.end_date, input.is_current ? 1 : 0);
            return Number(res.lastInsertRowid);
        });
        return this.getAcademicYear(id);
    }

    updateAcademicYear(id: unknown, input: AcademicYearInput): Row | null {
        this.transaction(() => {
            if (input.is_current) this.db.prepare('UPDATE academic_years SET is_current = 0 WHERE id <> ?').run(id);
            this.db
                .prepare('UPDATE academic_years SET label = ?, start_date = ?, end_date = ?, is_current = ? WHERE id = ?')
                .run(input.label, input.start_date, input.end_date, input.is_current ? 1 : 0, id);
        });
        return this.getAcademicYear(id);
    }

    /** Deletes the year; its students become unassigned (and fall back to the default area). */
    deleteAcademicYear(id: unknown): number {
        return this.transaction(() => {
            const moved = Number(this.db.prepare('UPDATE students SET academic_year_id = NULL WHERE academic_year_id = ?').run(id).changes);
            this.db.prepare('DELETE FROM academic_years WHERE id = ?').run(id);
            return moved;
        });
    }

    saveYearArea(id: unknown, name: string, latitude: number, longitude: number, radius: number, adminId: number): void {
        this.db
            .prepare(`UPDATE academic_years SET area_name = ?, latitude = ?, longitude = ?, radius = ?,
                      area_updated_by = ?, area_updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(name.trim(), latitude, longitude, radius, adminId, id);
    }

    clearYearArea(id: unknown): void {
        this.db
            .prepare(`UPDATE academic_years SET area_name = NULL, latitude = NULL, longitude = NULL, radius = NULL,
                      area_updated_by = NULL, area_updated_at = NULL WHERE id = ?`)
            .run(id);
    }

    /** Files the given students under an academic year (null = unassigned). Returns how many changed. */
    assignStudents(yearId: number | null, studentIds: number[]): number {
        const stmt = this.db.prepare('UPDATE students SET academic_year_id = ? WHERE id = ?');
        return this.transaction(() => studentIds.reduce((n, sid) => n + Number(stmt.run(yearId, sid).changes), 0));
    }
}
