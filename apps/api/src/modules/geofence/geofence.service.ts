import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Row } from '../../common/row';

@Injectable()
export class GeofenceService {
    constructor(private readonly database: DatabaseService) {}

    getArea(collegeId: unknown): Row | null {
        return (
            this.database.db
                .prepare(
                    'SELECT name, latitude, longitude, radius FROM student_geofences WHERE scope_id = ? OR scope_id = 0 ORDER BY scope_id DESC LIMIT 1',
                )
                .get(collegeId || 0) || null
        );
    }

    saveArea(scopeId: number, name: string, latitude: number, longitude: number, radius: number, adminId: number): void {
        this.database.db.prepare(`INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, updated_by)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(scope_id) DO UPDATE SET
        name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude,
        radius=excluded.radius, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
            .run(scopeId, name.trim(), latitude, longitude, radius, adminId);
    }
}
