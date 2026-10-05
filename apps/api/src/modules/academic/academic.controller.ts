import { Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StudentGuard } from '../../auth/guards';
import { fail, serverError, statusOf, StatusError } from '../../common/http-error';
import { AcademicModel, isIsoDate, todayIso } from './academic.model';

/** Model validation errors keep their status; anything else is a 500. */
export const academicError = (err: unknown) => (err instanceof StatusError ? fail(statusOf(err), err.message) : serverError(err));

const yearParam = (v: unknown): string => {
    const y = v === undefined || v === '' ? 'all' : String(v);
    if (y !== 'all' && !['1', '2', '3'].includes(y)) throw fail(400, "year must be 1, 2, 3 or 'all'");
    return y;
};

/**
 * Student academic records (/api/academic/*). Every route reads the signed-in student's own rows
 * (the profile page also sends ?roll_number=, which only identifies the student to StudentGuard).
 */
@Controller()
@UseGuards(StudentGuard)
export class AcademicController {
    constructor(private readonly academic: AcademicModel) {}

    @Get('academic/attendance/datewise')
    @Header('Cache-Control', 'no-store')
    getDatewise(@Req() req: Request) {
        try {
            const raw = req.query.date;
            const date = raw === undefined || raw === '' ? todayIso() : String(raw);
            if (!isIsoDate(date)) throw fail(400, 'date must be a valid YYYY-MM-DD date');
            return this.academic.getDatewise(req.student, date);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/attendance/subject-wise')
    @Header('Cache-Control', 'no-store')
    getSubjectWise(@Req() req: Request) {
        try {
            return this.academic.getSubjectWise(req.student);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/exams/results')
    @Header('Cache-Control', 'no-store')
    getExamResults(@Req() req: Request) {
        try {
            return this.academic.getExamResults(req.student, yearParam(req.query.year));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/exams/summary')
    @Header('Cache-Control', 'no-store')
    getExamSummary(@Req() req: Request) {
        try {
            return this.academic.getExamSummary(req.student, yearParam(req.query.year));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('academic/schedule')
    @Header('Cache-Control', 'no-store')
    getSchedule(@Req() req: Request) {
        try {
            const dept = req.query.department === undefined ? 'all' : String(req.query.department).trim();
            return this.academic.getSchedule(req.student, dept || 'all');
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('academic/attendance/fill')
    @HttpCode(200)
    fillAttendance(@Req() req: Request) {
        try {
            return this.academic.fillAttendance(req.student, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }
}
