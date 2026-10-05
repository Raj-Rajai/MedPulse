/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Delete, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HospitalGuard, PatientGuard } from '../../auth/guards';
import { fail, HttpError, statusOf } from '../../common/http-error';
import { DEPARTMENTS, HospitalCallbackModel, REASONS } from './hospital-callback.model';
import { PatientFamilyModel } from './patient-family.model';

// Known model errors carry an HTTP status; anything else is a 500
function handle<T>(fn: () => T): T {
    try {
        return fn();
    } catch (err) {
        if (err instanceof HttpError) throw err;
        throw fail(statusOf(err), err.message);
    }
}
const toBool = (v: any) => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';
const id = (req: Request) => parseInt(req.params.id as string, 10);

@Controller()
export class PatientPortalController {
    constructor(
        private readonly family: PatientFamilyModel,
        private readonly callbacks: HospitalCallbackModel,
    ) {}

    /* ---- Profile card ---- */
    @Get('patient/card')
    @UseGuards(PatientGuard)
    getCard(@Req() req: Request) {
        return handle(() => ({ success: true, card: this.family.getCard(req.patientId) }));
    }

    @Put('patient/profile')
    @UseGuards(PatientGuard)
    updateProfile(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Profile updated.', card: this.family.updateProfile(req.patientId, req.body || {}) }));
    }

    /* ---- Family (head of family) ---- */
    @Get('patient/family')
    @UseGuards(PatientGuard)
    getFamily(@Req() req: Request) {
        return handle(() => ({ success: true, ...this.family.getFamily(req.patientId) }));
    }

    @Put('patient/family')
    @UseGuards(PatientGuard)
    updateFamily(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Family details saved.', ...this.family.updateFamily(req.patientId, req.body || {}) }));
    }

    @Post('patient/family/members')
    @HttpCode(201)
    @UseGuards(PatientGuard)
    addMember(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Family member added.', ...this.family.addMember(req.patientId, req.body || {}) }));
    }

    @Put('patient/family/members/:id')
    @UseGuards(PatientGuard)
    updateMember(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Family member updated.', ...this.family.updateMember(req.patientId, id(req), req.body || {}) }));
    }

    @Delete('patient/family/members/:id')
    @UseGuards(PatientGuard)
    deleteMember(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Family member removed.', ...this.family.deleteMember(req.patientId, id(req)) }));
    }

    /* ---- Hospital calling ---- */
    @Get('patient/hospital')
    @UseGuards(PatientGuard)
    getHospital(@Req() req: Request) {
        return handle(() => ({
            success: true,
            hospital: this.callbacks.getHospitalForPatient(req.patient),
            departments: DEPARTMENTS,
            reasons: REASONS
        }));
    }

    @Get('patient/hospital-requests')
    @UseGuards(PatientGuard)
    listRequests(@Req() req: Request) {
        return handle(() => {
            const requests = this.callbacks.listForPatient(req.patientId);
            return { success: true, total: requests.length, requests };
        });
    }

    @Post('patient/hospital-requests')
    @HttpCode(201)
    @UseGuards(PatientGuard)
    createRequest(@Req() req: Request) {
        return handle(() => ({ success: true, message: 'Request sent to the hospital.', request: this.callbacks.create(req.patient, req.body || {}) }));
    }

    @Post('patient/hospital-requests/:id/cancel')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    cancelRequest(@Req() req: Request) {
        return handle(() => ({ success: true, request: this.callbacks.cancel(id(req), req.patientId) }));
    }

    @Post('patient/hospital-requests/:id/confirm')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    confirmRequest(@Req() req: Request) {
        return handle(() => ({ success: true, request: this.callbacks.confirm(id(req), req.patientId, toBool(req.body && req.body.confirmed)) }));
    }

    /* ---- HMS contract: hospital admins work the callback queue ---- */
    @Get('crm/hospital/callback-requests')
    @UseGuards(HospitalGuard)
    hospitalQueue(@Req() req: Request) {
        return handle(() => {
            const requests = this.callbacks.listForHospital(req.hospitalId, req.query.status || 'Active');
            return { success: true, open_count: requests.filter((r) => r.status === 'Open').length, total: requests.length, requests };
        });
    }

    @Post('crm/hospital/callback-requests/:id/status')
    @HttpCode(200)
    @UseGuards(HospitalGuard)
    hospitalUpdate(@Req() req: Request) {
        return handle(() => ({ success: true, request: this.callbacks.updateByHospital(id(req), req.hospitalAdmin, req.body || {}) }));
    }
}
