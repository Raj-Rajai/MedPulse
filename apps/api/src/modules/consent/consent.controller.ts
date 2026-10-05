import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConsentModel } from './consent.model';
import { fail, serverError } from '../../common/http-error';

@Controller('consent')
export class ConsentController {
    constructor(private readonly consentModel: ConsentModel) {}

    @Get('status')
    getStatus(
        @Query('consent_type') consentType: string,
        @Query('version') version: string,
        @Query('user_id') queryUserId?: string,
        @Req() req?: Request
    ) {
        try {
            const user = (req as any)?.session?.user;
            const userId = String(queryUserId || user?.roll_number || user?.id || '235');
            const type = consentType || 'STUDENT_DATA_USE_PRIVACY';
            const ver = version || '1.0.0';

            const status = this.consentModel.getStatus(userId, type, ver);
            return status;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post()
    @HttpCode(200)
    recordConsent(@Body() body: any, @Req() req: Request) {
        try {
            const user = (req as any)?.session?.user;
            const userId = String(body.user_id || body.roll_number || user?.roll_number || user?.id || '235');
            const actorId = String(user?.id || user?.roll_number || userId);
            const role = String(body.role || user?.role || 'student');
            const consentType = String(body.consent_type || 'STUDENT_DATA_USE_PRIVACY');
            const consentVersion = String(body.consent_version || '1.0.0');
            const purposeVersion = String(body.purpose_version || '1.0.0');
            const privacyPolicyVersion = String(body.privacy_policy_version || '1.0.0');
            const purposeScope = String(body.purpose_scope || 'COMMUNITY_MEDICINE_FAP');
            const action = (body.action as 'GRANTED' | 'WITHDRAWN') || 'GRANTED';
            const source = String(body.source || 'STUDENT_PORTAL');

            const ipAddress = req.ip || req.socket.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;

            const rec = this.consentModel.recordConsent({
                userId,
                actorId,
                role,
                consentType,
                consentVersion,
                purposeVersion,
                privacyPolicyVersion,
                purposeScope,
                action,
                source,
                ipAddress,
                userAgent,
            });

            return { success: true, consent: rec };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('withdraw')
    @HttpCode(200)
    withdrawConsent(@Body() body: any, @Req() req: Request) {
        try {
            const user = (req as any)?.session?.user;
            const userId = String(body.user_id || body.roll_number || user?.roll_number || user?.id || '235');
            const actorId = String(user?.id || user?.roll_number || userId);
            const role = String(body.role || user?.role || 'student');
            const consentType = String(body.consent_type || 'STUDENT_DATA_USE_PRIVACY');
            const consentVersion = String(body.consent_version || '1.0.0');

            if (!userId) throw fail(400, 'User ID is required for withdrawal');

            const ipAddress = req.ip || req.socket.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;

            const rec = this.consentModel.recordConsent({
                userId,
                actorId,
                role,
                consentType,
                consentVersion,
                purposeVersion: '1.0.0',
                privacyPolicyVersion: '1.0.0',
                purposeScope: 'COMMUNITY_MEDICINE_FAP',
                action: 'WITHDRAWN',
                source: 'STUDENT_PORTAL',
                ipAddress,
                userAgent,
            });

            return { success: true, message: 'Consent successfully withdrawn', consent: rec };
        } catch (err) {
            throw serverError(err);
        }
    }
}
