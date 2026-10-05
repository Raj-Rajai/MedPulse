import { Controller, Delete, Get, Header, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards';
import { fail } from '../../common/http-error';
import { AcademicModel } from './academic.model';
import { academicError } from './academic.controller';
import { AttendanceClusterService } from './attendance-cluster.service';

/**
 * Admin attendance register and examination marksheets (/api/admin/academic/*), scoped to the
 * signed-in admin's college. Static paths are declared before the `:id` routes.
 */
@Controller()
@UseGuards(AdminGuard)
export class AcademicAdminController {
    constructor(private readonly academic: AcademicModel, private readonly clusters: AttendanceClusterService) {}

    @Get('admin/academic/attendance/clusters/:id')
    @Header('Cache-Control', 'no-store')
    inspectCluster(@Req() req: Request) {
        try { return this.clusters.inspect(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Post('admin/academic/attendance/clusters/:id/end')
    @HttpCode(200)
    endCluster(@Req() req: Request) {
        try { return this.clusters.end(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Post('admin/academic/attendance/clusters/:id/observations')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    observeCluster(@Req() req: Request) {
        try { return this.clusters.observe(this.college(req), req.adminId,
            req.params.id, req.get('x-attendance-anchor-token') || '', req.body || {}); }
        catch (err) { throw academicError(err); }
    }

    private college(req: Request): number {
        return AcademicModel.collegeOfAdmin(req.admin);
    }

    @Get('admin/academic/schedule/:id/attendance-cluster')
    @Header('Cache-Control', 'no-store')
    lectureCluster(@Req() req: Request) {
        try { return this.clusters.forLecture(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Get('admin/academic/meta')
    @Header('Cache-Control', 'no-store')
    getMeta(@Req() req: Request) {
        try {
            return this.academic.getMeta(this.college(req));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/attendance/sheet')
    @Header('Cache-Control', 'no-store')
    getAttendanceSheet(@Req() req: Request) {
        try {
            return this.academic.getAttendanceSheet(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/attendance/history')
    @Header('Cache-Control', 'no-store')
    getAttendanceHistory(@Req() req: Request) {
        try {
            return this.academic.getAttendanceHistory(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/attendance')
    @HttpCode(200)
    saveAttendance(@Req() req: Request) {
        try {
            return this.academic.saveAttendance(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/attendance/:id')
    deleteAttendance(@Req() req: Request) {
        try {
            if (!this.academic.deleteAttendance(this.college(req), req.params.id)) throw fail(404, 'Attendance record not found');
            return { success: true, message: 'Attendance record removed' };
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/exams')
    @Header('Cache-Control', 'no-store')
    listExams(@Req() req: Request) {
        try {
            return this.academic.listExams(this.college(req));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/exams/sheet')
    @Header('Cache-Control', 'no-store')
    getExamSheet(@Req() req: Request) {
        try {
            return this.academic.getExamSheet(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/exams')
    @HttpCode(200)
    saveExamMarks(@Req() req: Request) {
        try {
            return this.academic.saveExamMarks(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/exams/:id')
    deleteExam(@Req() req: Request) {
        try {
            if (!this.academic.deleteExam(this.college(req), req.params.id)) throw fail(404, 'Examination not found');
            return { success: true, message: 'Examination and its marks removed' };
        } catch (err) {
            throw academicError(err);
        }
    }

    /* ── Schedule Management Endpoints ── */

    @Get('admin/academic/schedule')
    @Header('Cache-Control', 'no-store')
    getAdminSchedule(@Req() req: Request) {
        try {
            const dept = req.query.department === undefined ? 'all' : String(req.query.department).trim();
            return this.academic.getAdminSchedule(this.college(req), dept || 'all');
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/schedule')
    @HttpCode(201)
    createLecture(@Req() req: Request) {
        try {
            return this.academic.createLecture(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Put('admin/academic/schedule/:id')
    updateLecture(@Req() req: Request) {
        try {
            return this.academic.updateLecture(this.college(req), req.params.id as string, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/schedule/:id')
    deleteLecture(@Req() req: Request) {
        try {
            if (!this.academic.deleteLecture(this.college(req), req.params.id as string)) throw fail(404, 'Lecture session not found');
            return { success: true, message: 'Lecture session deleted successfully' };
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/schedule/:id/request-attendance')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    requestAttendance(@Req() req: Request) {
        try {
            return this.academic.requestAttendance(this.college(req), req.adminId, req.params.id, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }
}
