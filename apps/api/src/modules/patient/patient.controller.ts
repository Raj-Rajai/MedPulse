import { Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PatientGuard } from '../../auth/guards';
import { fail, HttpError, serverError } from '../../common/http-error';
import { PatientModel } from './patient.model';

@Controller()
export class PatientController {
    constructor(private readonly patients: PatientModel) {}

    @Post('patient/verify-referral')
    @HttpCode(200)
    verifyReferral(@Req() req: Request) {
        try {
            const { referral_code } = req.body;
            if (!referral_code || !referral_code.toString().trim()) {
                throw new HttpError(400, { valid: false, error: 'Referral code is required.' });
            }

            const student = this.patients.verifyReferral(referral_code.toString().trim());
            if (!student) {
                throw new HttpError(404, { valid: false, error: 'No medical cadet found with this referral code.' });
            }

            return {
                valid: true,
                student
            };
        } catch (err) {
            if (err instanceof HttpError) throw err;
            throw new HttpError(500, { valid: false, error: err.message });
        }
    }

    @Post('patient/register')
    @HttpCode(201)
    register(@Req() req: Request) {
        try {
            const { name, phone, pin, email, gender, age_years, date_of_birth, address, is_adopted, referral_code } = req.body;

            if (!name || !name.trim()) {
                throw fail(400, 'Patient name is required.');
            }
            if (!phone || !phone.trim()) {
                throw fail(400, 'Contact phone number is required.');
            }

            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10) {
                throw fail(400, 'Please provide a valid 10-digit mobile phone number.');
            }

            const result = this.patients.register({
                name,
                phone,
                pin,
                email,
                gender,
                age_years,
                date_of_birth,
                address,
                is_adopted,
                referral_code
            });

            if (result.conflict) {
                throw fail(409, result.message);
            }
            if (result.badRequest) {
                throw fail(400, result.message);
            }

            return {
                success: true,
                message: `Patient account registered successfully as ${result.modelType}.`,
                patient: result.patient,
                token: result.token
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('patient/login')
    @HttpCode(200)
    login(@Req() req: Request) {
        try {
            const { identifier, pin } = req.body;
            if (!identifier || !identifier.trim()) {
                throw fail(400, 'Phone number or Patient ID is required.');
            }
            if (!pin || !pin.trim()) {
                throw fail(400, 'PIN / Passcode is required.');
            }

            const result = this.patients.login(identifier, pin);
            if (result.notFound) {
                throw fail(404, 'No patient record found matching this Phone number or Patient ID.');
            }
            if (result.invalidPin) {
                throw fail(401, 'Invalid PIN / Passcode.');
            }

            return {
                success: true,
                message: 'Signed in successfully.',
                patient: result.patient,
                token: result.token
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('patient/profile')
    @UseGuards(PatientGuard)
    getProfile(@Req() req: Request) {
        return req.patient;
    }

    @Post('patient/link-referral')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    linkReferral(@Req() req: Request) {
        try {
            const { referral_code } = req.body;
            if (!referral_code || !referral_code.trim()) {
                throw fail(400, 'Referral code is required.');
            }

            const result = this.patients.linkReferral(req.patientId, referral_code, req.patient);
            if (result.notFound) {
                throw fail(404, result.message);
            }

            return {
                success: true,
                message: `Successfully linked to Medical Cadet ${result.student.name} (${result.student.college_name})!`,
                patient: result.patient
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('patient/records')
    @UseGuards(PatientGuard)
    getRecords(@Req() req: Request) {
        try {
            const records = this.patients.getRecords(req.patient);
            return records;
        } catch (err) {
            throw serverError(err);
        }
    }
}
