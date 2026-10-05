import { Controller, Get, Header, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminGuard, StudentGuard } from '../../auth/guards';
import { fail } from '../../common/http-error';
import { checkLocation, validArea } from './geofence.rules';
import { GeofenceService } from './geofence.service';

@Controller()
export class GeofenceController {
    constructor(private readonly geofence: GeofenceService) {}

    @Get('admin/geofence')
    @UseGuards(AdminGuard)
    @Header('Cache-Control', 'no-store')
    getAdminArea(@Req() req: Request) {
        return { area: this.geofence.getArea(req.admin.college_id), scope: req.admin.college_id ? 'Your college' : 'Default for all colleges' };
    }

    @Put('admin/geofence')
    @UseGuards(AdminGuard)
    saveAdminArea(@Req() req: Request) {
        if (!validArea(req.body))
            throw fail(400, 'Enter a village name, valid latitude and longitude, and a radius from 25 to 50,000 metres.');
        const { name, latitude, longitude, radius } = req.body;
        this.geofence.saveArea(req.admin.college_id || 0, name, latitude, longitude, radius, req.admin.id);
        return { success: true };
    }

    @Get('student/geofence')
    @UseGuards(StudentGuard)
    @Header('Cache-Control', 'no-store')
    getStudentArea(@Req() req: Request) {
        return { area: this.geofence.getArea(req.student.college_id) };
    }

    @Post('student/geofence/check')
    @UseGuards(StudentGuard)
    checkStudentLocation(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const error = checkLocation(this.geofence.getArea(req.student.college_id), req.body);
        res.status(error ? 403 : 200);
        return error ? { error } : { success: true };
    }
}
