import { Controller, Delete, Get, Header, HttpCode, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminGuard, StudentGuard } from '../../auth/guards';
import { fail } from '../../common/http-error';
import { checkLocation, validArea } from './geofence.rules';
import { GeofenceService, type AcademicYearInput } from './geofence.service';

const AREA_ERROR = 'Enter a village name, valid latitude and longitude, and a radius from 25 to 50,000 metres.';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function academicYearInput(body: any): AcademicYearInput {
    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const m = /^(\d{4})-(\d{4})$/.exec(label);
    if (!m || Number(m[2]) !== Number(m[1]) + 1) throw fail(400, 'Enter the academic year as two consecutive years, for example 2026-2027.');
    const date = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const start_date = date(body.start_date);
    const end_date = date(body.end_date);
    if ((start_date && !DATE.test(start_date)) || (end_date && !DATE.test(end_date))) throw fail(400, 'Dates must be in YYYY-MM-DD format.');
    if (start_date && end_date && start_date > end_date) throw fail(400, 'The start date must be before the end date.');
    return { label, start_date, end_date, is_current: !!body.is_current };
}

@Controller()
export class GeofenceController {
    constructor(private readonly geofence: GeofenceService) {}

    @Get('admin/geofence')
    @UseGuards(AdminGuard)
    @Header('Cache-Control', 'no-store')
    async getAdminArea(@Req() req: Request) {
        return {
            area: await this.geofence.getArea(req.admin.college_id),
            scope: req.admin.college_id ? 'Your college' : 'Default for all colleges',
        };
    }

    @Put('admin/geofence')
    @UseGuards(AdminGuard)
    async saveAdminArea(@Req() req: Request) {
        if (!validArea(req.body)) throw fail(400, AREA_ERROR);
        const { name, latitude, longitude, radius } = req.body;
        await this.geofence.saveArea(req.admin.college_id || 0, name, latitude, longitude, radius, req.admin.id);
        return { success: true };
    }

    @Get('admin/academic-years')
    @UseGuards(AdminGuard)
    @Header('Cache-Control', 'no-store')
    async listAcademicYears(@Req() req: Request) {
        return {
            years: await this.geofence.listAcademicYears(),
            default_area: await this.geofence.getArea(req.admin.college_id),
        };
    }

    @Post('admin/academic-years')
    @HttpCode(201)
    @UseGuards(AdminGuard)
    async createAcademicYear(@Req() req: Request) {
        const input = academicYearInput(req.body);
        if (await this.geofence.labelTaken(input.label)) throw fail(409, `Academic year ${input.label} already exists.`);
        return { success: true, year: await this.geofence.createAcademicYear(input) };
    }

    @Post('admin/academic-years/assign')
    @HttpCode(200)
    @UseGuards(AdminGuard)
    async assignStudents(@Req() req: Request) {
        const ids = Array.isArray(req.body?.student_ids) ? req.body.student_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
        if (!ids.length) throw fail(400, 'Choose at least one student.');
        const raw = req.body?.academic_year_id;
        const yearId = raw === null || raw === '' || raw === undefined ? null : Number(raw);
        if (yearId !== null && !(await this.geofence.getAcademicYear(yearId))) throw fail(404, 'Academic year not found.');
        return { success: true, updated: await this.geofence.assignStudents(yearId, ids) };
    }

    @Put('admin/academic-years/:id')
    @UseGuards(AdminGuard)
    async updateAcademicYear(@Req() req: Request) {
        const id = Number(req.params.id);
        if (!(await this.geofence.getAcademicYear(id))) throw fail(404, 'Academic year not found.');
        const input = academicYearInput(req.body);
        if (await this.geofence.labelTaken(input.label, id)) throw fail(409, `Academic year ${input.label} already exists.`);
        return { success: true, year: await this.geofence.updateAcademicYear(id, input) };
    }

    @Delete('admin/academic-years/:id')
    @UseGuards(AdminGuard)
    async deleteAcademicYear(@Req() req: Request) {
        const id = Number(req.params.id);
        if (!(await this.geofence.getAcademicYear(id))) throw fail(404, 'Academic year not found.');
        return { success: true, unassigned_students: await this.geofence.deleteAcademicYear(id) };
    }

    @Put('admin/academic-years/:id/area')
    @UseGuards(AdminGuard)
    async saveYearArea(@Req() req: Request) {
        const id = Number(req.params.id);
        if (!(await this.geofence.getAcademicYear(id))) throw fail(404, 'Academic year not found.');
        if (!validArea(req.body)) throw fail(400, AREA_ERROR);
        const { name, latitude, longitude, radius } = req.body;
        await this.geofence.saveYearArea(id, name, latitude, longitude, radius, req.admin.id);
        return { success: true };
    }

    @Delete('admin/academic-years/:id/area')
    @UseGuards(AdminGuard)
    async clearYearArea(@Req() req: Request) {
        const id = Number(req.params.id);
        if (!(await this.geofence.getAcademicYear(id))) throw fail(404, 'Academic year not found.');
        await this.geofence.clearYearArea(id);
        return { success: true };
    }

    @Get('student/geofence')
    @UseGuards(StudentGuard)
    @Header('Cache-Control', 'no-store')
    async getStudentArea(@Req() req: Request) {
        return { area: await this.geofence.getAreaForStudent(req.student) };
    }

    @Post('student/geofence/check')
    @UseGuards(StudentGuard)
    async checkStudentLocation(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const area = await this.geofence.getAreaForStudent(req.student);
        const error = checkLocation(area, req.body);
        res.status(error ? 403 : 200);
        return error ? { error } : { success: true };
    }
}
