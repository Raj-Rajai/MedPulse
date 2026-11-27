import { Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StudentGuard } from '../../auth/guards';
import { fail, serverError, statusOf, StatusError } from '../../common/http-error';
import { AcademicModel, isIsoDate, todayIso } from './academic.model';
import { AttendanceClusterService } from './attendance-cluster.service';

export const academicError = (err: unknown) => (err instanceof StatusError ? fail(statusOf(err), err.message) : serverError(err));

const yearParam = (v: unknown): string => {
    const y = v === undefined || v === '' ? 'all' : String(v);
    if (y !== 'all' && !['1', '2', '3'].includes(y)) throw fail(400, "year must be 1, 2, 3 or 'all'");
    return y;
};

@Controller()
@UseGuards(StudentGuard)
export class AcademicController {
    constructor(private readonly academic: AcademicModel, private readonly clusters: AttendanceClusterService) {}

    @Get('academic/attendance/clusters')
    @Header('Cache-Control', 'no-store')
    async getClusters(@Req() req: Request) {
        try { return { clusters: await this.clusters.list(req.student) }; }
        catch (err) { throw academicError(err); }
    }

    @Post('academic/attendance/clusters/:id/challenge')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    async getClusterChallenge(@Req() req: Request) {
        try { return await this.clusters.challenge(req.student, req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Get('academic/attendance/clusters/:id')
    @Header('Cache-Control', 'no-store')
    async getClusterRoom(@Req() req: Request) {
        try { return await this.clusters.studentRoom(req.student, req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Post('academic/attendance/clusters/:id/join')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    async joinClusterRoom(@Req() req: Request) {
        try { return await this.clusters.join(req.student, req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Get('academic/attendance/datewise')
    @Header('Cache-Control', 'no-store')
    async getDatewise(@Req() req: Request) {
        try {
            const raw = req.query.date;
            const date = raw === undefined || raw === '' ? todayIso() : String(raw);
            if (!isIsoDate(date)) throw fail(400, 'date must be a valid YYYY-MM-DD date');
            return await this.academic.getDatewise(req.student, date);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/attendance/subject-wise')
    @Header('Cache-Control', 'no-store')
    async getSubjectWise(@Req() req: Request) {
        try {
            return await this.academic.getSubjectWise(req.student);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/exams/results')
    @Header('Cache-Control', 'no-store')
    async getExamResults(@Req() req: Request) {
        try {
            return await this.academic.getExamResults(req.student, yearParam(req.query.year));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/exams/summary')
    @Header('Cache-Control', 'no-store')
    async getExamSummary(@Req() req: Request) {
        try {
            return await this.academic.getExamSummary(req.student, yearParam(req.query.year));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/schedule')
    @Header('Cache-Control', 'no-store')
    async getSchedule(@Req() req: Request) {
        try {
            const dept = req.query.department === undefined ? 'all' : String(req.query.department).trim();
            return await this.academic.getSchedule(req.student, dept || 'all');
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('academic/attendance/fill')
    @HttpCode(200)
    async fillAttendance(@Req() req: Request) {
        try {
            return await this.academic.fillAttendance(req.student, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }
}
