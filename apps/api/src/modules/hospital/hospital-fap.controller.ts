/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HospitalGuard } from '../../auth/guards';
import { fail, HttpError } from '../../common/http-error';
import { HospitalFapModel } from './hospital-fap.model';

/**
 * The original `handle` wrapper forwarded thrown errors to the centralized errorHandler,
 * which logs and answers `{ error: err.message || 'Internal server error', status: err.status || 500 }`.
 */
const handle = <T>(fn: () => T): T => {
    try {
        return fn();
    } catch (err) {
        if (err instanceof HttpError) throw err;
        console.error('Unhandled server error:', err);
        const e = err as { status?: number; message?: string };
        const status = e?.status || 500;
        throw new HttpError(status, { error: e?.message || 'Internal server error', status });
    }
};

/** Auth for /hospital/fap is also applied by the pre-route middleware (router.use in the original). */
@Controller()
@UseGuards(HospitalGuard)
export class HospitalFapController {
    constructor(private readonly fap: HospitalFapModel) {}

    @Get('hospital/fap/summary')
    summary(@Req() req: Request) {
        return handle(() => this.fap.summary(req.hospitalId));
    }

    @Get('hospital/fap/options')
    options(@Req() req: Request) {
        return handle(() => this.fap.options(req.hospitalId));
    }

    @Get('hospital/fap/patients')
    patients(@Req() req: Request) {
        return handle(() => {
            const query = req.query as Record<string, any>;
            const { search = '', student_id, university_id, condition } = query;
            const limit = Number(query.limit ?? 25),
                offset = Number(query.offset ?? 0);
            if (
                typeof search !== 'string' ||
                search.length > 200 ||
                !Number.isInteger(limit) ||
                limit < 1 ||
                limit > 100 ||
                !Number.isInteger(offset) ||
                offset < 0 ||
                [student_id, university_id].some((v) => v !== undefined && v !== '' && (!/^\d+$/.test(v) || Number(v) < 1)) ||
                (condition && !['HTN', 'DM', 'Anaemia', 'Pediatric', 'NoFollowUp'].includes(condition))
            )
                throw fail(400, 'Invalid patient search or pagination parameters.');
            return this.fap.list(req.hospitalId, { search, student_id, university_id, condition, limit, offset });
        });
    }

    @Get('hospital/fap/patients/:id')
    dossier(@Req() req: Request) {
        return handle(() => {
            if (!/^\d+$/.test(req.params.id as string)) throw fail(400, 'Invalid FAP record ID.');
            const dossier = this.fap.dossier(req.hospitalId, Number(req.params.id));
            if (!dossier) throw fail(404, 'FAP record not found for this hospital.');
            return dossier;
        });
    }
}
