import { Controller, Delete, Get, Header, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards';
import { fail } from '../../common/http-error';
import { AcademicModel } from './academic.model';
import { academicError } from './academic.controller';
import { AttendanceClusterService } from './attendance-cluster.service';

@Controller()
@UseGuards(AdminGuard)
export class AcademicAdminController {
    constructor(private readonly academic: AcademicModel, private readonly clusters: AttendanceClusterService) {}

    @Get('admin/academic/attendance/clusters/:id')
    @Header('Cache-Control', 'no-store')
    async inspectCluster(@Req() req: Request) {
        try { return await this.clusters.inspect(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Post('admin/academic/attendance/clusters/:id/end')
    @HttpCode(200)
    async endCluster(@Req() req: Request) {
        try { return await this.clusters.end(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Post('admin/academic/attendance/clusters/:id/observations')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    async observeCluster(@Req() req: Request) {
        try {
            return await this.clusters.observe(
                this.college(req),
                req.adminId,
                req.params.id,
                req.get('x-attendance-anchor-token') || '',
                req.body || {},
            );
        } catch (err) {
            throw academicError(err);
        }
    }

    private college(req: Request): number {
        return AcademicModel.collegeOfAdmin(req.admin);
    }

    @Get('admin/academic/schedule/:id/attendance-cluster')
    @Header('Cache-Control', 'no-store')
    async lectureCluster(@Req() req: Request) {
        try { return await this.clusters.forLecture(this.college(req), req.params.id); }
        catch (err) { throw academicError(err); }
    }

    @Get('admin/academic/meta')
    @Header('Cache-Control', 'no-store')
    async getMeta(@Req() req: Request) {
        try {
            return await this.academic.getMeta(this.college(req));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/attendance/sheet')
    @Header('Cache-Control', 'no-store')
    async getAttendanceSheet(@Req() req: Request) {
        try {
            return await this.academic.getAttendanceSheet(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/attendance/history')
    @Header('Cache-Control', 'no-store')
    async getAttendanceHistory(@Req() req: Request) {
        try {
            return await this.academic.getAttendanceHistory(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/attendance')
    @HttpCode(200)
    async saveAttendance(@Req() req: Request) {
        try {
            return await this.academic.saveAttendance(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/attendance/:id')
    async deleteAttendance(@Req() req: Request) {
        try {
            if (!(await this.academic.deleteAttendance(this.college(req), req.params.id))) throw fail(404, 'Attendance record not found');
            return { success: true, message: 'Attendance record removed' };
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/exams')
    @Header('Cache-Control', 'no-store')
    async listExams(@Req() req: Request) {
        try {
            return await this.academic.listExams(this.college(req));
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/exams/sheet')
    @Header('Cache-Control', 'no-store')
    async getExamSheet(@Req() req: Request) {
        try {
            return await this.academic.getExamSheet(this.college(req), req.query as Record<string, unknown>);
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/exams')
    @HttpCode(200)
    async saveExamMarks(@Req() req: Request) {
        try {
            return await this.academic.saveExamMarks(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/exams/:id')
    async deleteExam(@Req() req: Request) {
        try {
            if (!(await this.academic.deleteExam(this.college(req), req.params.id))) throw fail(404, 'Examination not found');
            return { success: true, message: 'Examination and its marks removed' };
        } catch (err) {
            throw academicError(err);
        }
    }

    @Get('admin/academic/schedule')
    @Header('Cache-Control', 'no-store')
    async getAdminSchedule(@Req() req: Request) {
        try {
            const dept = req.query.department === undefined ? 'all' : String(req.query.department).trim();
            return await this.academic.getAdminSchedule(this.college(req), dept || 'all');
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/schedule')
    @HttpCode(201)
    async createLecture(@Req() req: Request) {
        try {
            return await this.academic.createLecture(this.college(req), req.adminId, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Put('admin/academic/schedule/:id')
    async updateLecture(@Req() req: Request) {
        try {
            return await this.academic.updateLecture(this.college(req), req.params.id as string, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }

    @Delete('admin/academic/schedule/:id')
    async deleteLecture(@Req() req: Request) {
        try {
            if (!(await this.academic.deleteLecture(this.college(req), req.params.id as string))) throw fail(404, 'Lecture session not found');
            return { success: true, message: 'Lecture session deleted successfully' };
        } catch (err) {
            throw academicError(err);
        }
    }

    @Post('admin/academic/schedule/:id/request-attendance')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    async requestAttendance(@Req() req: Request) {
        try {
            return await this.academic.requestAttendance(this.college(req), req.adminId, req.params.id, req.body || {});
        } catch (err) {
            throw academicError(err);
        }
    }
}
