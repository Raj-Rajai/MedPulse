/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PatientGuard } from '../../auth/guards';
import { fail, HttpError, StatusError } from '../../common/http-error';
import { EngagementModel } from './engagement.model';

// Map model validation errors to proper HTTP status codes
function handle<T>(fn: () => T): T {
    try {
        return fn();
    } catch (err) {
        if (err instanceof HttpError) throw err;
        const status = err instanceof StatusError ? err.status : 500;
        throw fail(status, err.message);
    }
}

const toBool = (v: any) => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';

@Controller()
export class EngagementController {
    constructor(private readonly engagement: EngagementModel) {}

    @Post('patient/notifications/mark-read')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    markRead(@Req() req: Request) {
        return handle(() => ({ success: true, updated: this.engagement.markNotificationsRead(req.patientId) }));
    }

    @Post('patient/notifications/:id/rsvp')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    rsvp(@Req() req: Request) {
        return handle(() => {
            const { rsvp, note } = req.body || {};
            const result = this.engagement.rsvp(parseInt(req.params.id as string, 10), req.patient, rsvp, note);
            const messages: Record<string, string> = {
                'Attending': 'Thank you! Your attendance is confirmed.',
                'Not Attending': 'Noted. The camp team has been informed you cannot attend.',
                'Need Help': 'Your student will call you to help you attend.'
            };
            return { success: true, message: messages[rsvp], ...result };
        });
    }

    @Post('patient/notifications/:id/confirm-contact')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    confirmCampaignContact(@Req() req: Request) {
        return handle(() => {
            const notification = this.engagement.confirmCampaignContact(parseInt(req.params.id as string, 10), req.patientId, toBool(req.body && req.body.confirmed));
            return { success: true, notification };
        });
    }
}
