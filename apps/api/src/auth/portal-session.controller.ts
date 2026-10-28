import { Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { fail } from '../common/http-error';
import { PortalSessionService, type PortalRole } from './portal-session.service';

@Controller('session')
export class PortalSessionController {
    constructor(private readonly sessions: PortalSessionService) {}
    @Post(':role/logout')
    @HttpCode(200)
    logout(@Req() req: Request, @Param('role') role: PortalRole) {
        if (!['student', 'admin', 'patient', 'hospital'].includes(role)) throw fail(400, 'Invalid portal');
        this.sessions.revoke(req, role);
        return { success: true };
    }
}
