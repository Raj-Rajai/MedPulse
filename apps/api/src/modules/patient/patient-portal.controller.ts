/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Delete, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HospitalGuard, PatientGuard } from '../../auth/guards';
import { fail, HttpError, statusOf } from '../../common/http-error';
import { DEPARTMENTS, HospitalCallbackModel, REASONS } from './hospital-callback.model';
import { PatientFamilyModel } from './patient-family.model';

async function handle<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
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

    @Get('patient/card')
    @UseGuards(PatientGuard)
    getCard(@Req() req: Request) {
        return handle(async () => ({ success: true, card: await this.family.getCard(req.patientId) }));
    }

    @Put('patient/profile')
    @UseGuards(PatientGuard)
    updateProfile(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Profile updated.', card: await this.family.updateProfile(req.patientId, req.body || {}) }));
    }

    @Get('patient/family')
    @UseGuards(PatientGuard)
    getFamily(@Req() req: Request) {
        return handle(async () => ({ success: true, ...(await this.family.getFamily(req.patientId)) }));
    }

    @Put('patient/family')
    @UseGuards(PatientGuard)
    updateFamily(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Family details saved.', ...(await this.family.updateFamily(req.patientId, req.body || {})) }));
    }

    @Post('patient/family/members')
    @HttpCode(201)
    @UseGuards(PatientGuard)
    addMember(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Family member added.', ...(await this.family.addMember(req.patientId, req.body || {})) }));
    }

    @Put('patient/family/members/:id')
    @UseGuards(PatientGuard)
    updateMember(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Family member updated.', ...(await this.family.updateMember(req.patientId, id(req), req.body || {})) }));
    }

    @Delete('patient/family/members/:id')
    @UseGuards(PatientGuard)
    deleteMember(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Family member removed.', ...(await this.family.deleteMember(req.patientId, id(req))) }));
    }

    @Get('patient/hospital')
    @UseGuards(PatientGuard)
    getHospital(@Req() req: Request) {
        return handle(async () => ({
            success: true,
            hospital: await this.callbacks.getHospitalForPatient(req.patient),
            departments: DEPARTMENTS,
            reasons: REASONS,
        }));
    }

    @Get('patient/hospital-requests')
    @UseGuards(PatientGuard)
    listRequests(@Req() req: Request) {
        return handle(async () => {
            const requests = await this.callbacks.listForPatient(req.patientId);
            return { success: true, total: requests.length, requests };
        });
    }

    @Post('patient/hospital-requests')
    @HttpCode(201)
    @UseGuards(PatientGuard)
    createRequest(@Req() req: Request) {
        return handle(async () => ({ success: true, message: 'Request sent to the hospital.', request: await this.callbacks.create(req.patient, req.body || {}) }));
    }

    @Post('patient/hospital-requests/:id/cancel')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    cancelRequest(@Req() req: Request) {
        return handle(async () => ({ success: true, request: await this.callbacks.cancel(id(req), req.patientId) }));
    }

    @Post('patient/hospital-requests/:id/confirm')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    confirmRequest(@Req() req: Request) {
        return handle(async () => ({ success: true, request: await this.callbacks.confirm(id(req), req.patientId, toBool(req.body && req.body.confirmed)) }));
    }

    @Get('crm/hospital/callback-requests')
    @UseGuards(HospitalGuard)
    hospitalQueue(@Req() req: Request) {
        return handle(async () => {
            const requests = await this.callbacks.listForHospital(req.hospitalId, req.query.status || 'Active');
            return { success: true, open_count: requests.filter((r) => r.status === 'Open').length, total: requests.length, requests };
        });
    }

    @Post('crm/hospital/callback-requests/:id/status')
    @HttpCode(200)
    @UseGuards(HospitalGuard)
    hospitalUpdate(@Req() req: Request) {
        return handle(async () => ({ success: true, request: await this.callbacks.updateByHospital(id(req), req.hospitalAdmin, req.body || {}) }));
    }
}
