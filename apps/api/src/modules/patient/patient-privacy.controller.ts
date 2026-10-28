import { Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HospitalGuard, PatientGuard } from '../../auth/guards';
import { PatientPrivacyService } from './patient-privacy.service';
import { PatientModel } from './patient.model';
import { fail } from '../../common/http-error';

@Controller()
export class PatientPrivacyController {
    constructor(private readonly privacy: PatientPrivacyService, private readonly patients: PatientModel) {}
    @Get('patient/overview') @UseGuards(PatientGuard)
    overview(@Req() req: Request) { return this.privacy.overview(req.patient); }
    @Get('patient/family/members/:id/records') @UseGuards(PatientGuard)
    records(@Req() req: Request, @Param('id') id: string) {
        const result = this.patients.getRecords(req.patient, Number(id));
        this.privacy.audit('patient', req.patientId, 'records_read', 'member', Number(id));
        return result;
    }
    @Get('patient/access') @UseGuards(PatientGuard)
    access(@Req() req: Request) { return { grants: this.privacy.access(req.patient) }; }
    @Post('patient/access') @UseGuards(PatientGuard)
    grant(@Req() req: Request) { return { grants: this.privacy.grant(req.patient, req.body) }; }
    @Delete('patient/access/:id') @UseGuards(PatientGuard)
    revoke(@Req() req: Request, @Param('id') id: string) { return { grants: this.privacy.revoke(req.patient, Number(id)) }; }
    @Post('patient/family/members/:id/guardian-request') @UseGuards(PatientGuard)
    guardian(@Req() req: Request, @Param('id') id: string) { return this.privacy.requestGuardian(req.patient, Number(id), req.body); }
    @Get('patient/corrections') @UseGuards(PatientGuard)
    corrections(@Req() req: Request) { return { corrections: this.privacy.corrections(req.patient) }; }
    @Post('patient/corrections') @UseGuards(PatientGuard)
    correction(@Req() req: Request) { return this.privacy.requestCorrection(req.patient, req.body); }
    @Post('patient/card/action') @HttpCode(200) @UseGuards(PatientGuard)
    cardAction(@Req() req: Request) {
        if (!['print', 'copy'].includes(req.body.action)) throw fail(400, 'Choose print or copy.');
        const action = req.body.action === 'print' ? 'card_printed' : 'patient_id_copied';
        this.privacy.audit('patient', req.patientId, action, 'patient', req.patientId);
        return { success: true };
    }
    @Get('crm/hospital/privacy-requests') @UseGuards(HospitalGuard)
    queue(@Req() req: Request) { return this.privacy.staffQueue(req.hospitalId); }
    @Post('crm/hospital/privacy-requests/:kind/:id/review') @UseGuards(HospitalGuard)
    review(@Req() req: Request, @Param('kind') kind: string, @Param('id') id: string) {
        return this.privacy.review(req.hospitalAdmin, kind, Number(id), req.body);
    }
}
