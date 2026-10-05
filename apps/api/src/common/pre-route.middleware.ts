import type { NextFunction, Request, Response } from 'express';
import type { INestApplication } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { HttpError } from './http-error';
import { GeofenceService } from '../modules/geofence/geofence.service';
import { checkLocation, isFieldWrite } from '../modules/geofence/geofence.rules';

const send = (res: Response, err: unknown, next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json(err.body);
    next(err);
};

/**
 * Mounted on /api before any controller, in the same order as the original routes/index.js:
 *  1. field-location enforcement for student field writes (X-Field-Location header)
 *  2. hospital auth for everything under /hospital/fap (router.use in hospital-fap.routes.js),
 *     which also answers 401 before 404 for unknown /hospital/fap paths.
 */
export function apiPreRouteMiddleware(app: INestApplication) {
    const auth = app.get(AuthService);
    const geofence = app.get(GeofenceService);

    return (req: Request, res: Response, next: NextFunction) => {
        if (isFieldWrite(req.method, req.path)) {
            try {
                auth.authenticateStudent(req);
            } catch (err) {
                return send(res, err, next);
            }
            let location;
            try {
                location = JSON.parse(req.get('X-Field-Location') || 'null');
            } catch (_) {
                location = null;
            }
            const error = checkLocation(geofence.getArea(req.student.college_id), location);
            if (error) return res.status(403).json({ error, code: 'LOCATION_REQUIRED' });
        }

        if (req.path === '/hospital/fap' || req.path.startsWith('/hospital/fap/')) {
            try {
                auth.authenticateHospitalAdmin(req);
            } catch (err) {
                return send(res, err, next);
            }
        }
        next();
    };
}
