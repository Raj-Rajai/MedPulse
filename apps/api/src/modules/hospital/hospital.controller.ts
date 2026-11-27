import { PortalSessionService } from '../../auth/portal-session.service';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Delete, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HospitalGuard } from '../../auth/guards';
import { fail, serverError } from '../../common/http-error';
import { HospitalModel } from './hospital.model';
import { HospitalVisitModel } from './hospital-visit.model';

@Controller()
export class HospitalController {
    constructor(
        private readonly hospitals: HospitalModel,
        private readonly visits: HospitalVisitModel,
        private readonly sessions: PortalSessionService,
    ) {}

    @Post('hospital/login')
    @HttpCode(200)
    async login(@Req() req: Request) {
        try {
            const { username, pin } = req.body;
            if (!username || !pin) {
                throw fail(400, 'Username and security PIN are required.');
            }

            const admin = await this.hospitals.findByCredentials(username);
            if (!admin || admin.pin !== pin.trim()) {
                throw fail(401, 'Invalid hospital credentials or incorrect PIN.');
            }

            await this.sessions.issue(req, 'hospital', admin.id);
            return {
                success: true,
                admin: {
                    id: admin.id,
                    hospital_id: admin.hospital_id,
                    username: admin.username,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    role: admin.role,
                    department: admin.department,
                    hospital_name: admin.hospital_name,
                    hospital_code: admin.hospital_code,
                    hospital_type: admin.hospital_type,
                    hospital_city: admin.hospital_city,
                },
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/profile')
    @UseGuards(HospitalGuard)
    getProfile(@Req() req: Request) {
        try {
            return {
                success: true,
                admin: req.hospitalAdmin,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/stats')
    @UseGuards(HospitalGuard)
    async getStats(@Req() req: Request) {
        try {
            return await this.hospitals.getStats(req.hospitalId);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/filter-options')
    @UseGuards(HospitalGuard)
    async getFilterOptions() {
        try {
            return await this.hospitals.getFilterOptions();
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/patients')
    @UseGuards(HospitalGuard)
    async getPatients(@Req() req: Request) {
        try {
            const hospitalId = req.hospitalId;
            const { university_id, student_id, model_type, condition, search, limit = 50, offset = 0 } = req.query as Record<string, any>;
            const patients = await this.hospitals.getPatients(hospitalId, {
                university_id,
                student_id,
                model_type,
                condition,
                search,
                limit,
                offset,
            });

            return {
                count: patients.length,
                patients,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/patients/:id')
    @UseGuards(HospitalGuard)
    async getPatientDossier(@Req() req: Request) {
        try {
            const patientId = req.params.id;
            const dossier = await this.hospitals.getPatientDossier(patientId, req.hospitalId);
            if (!dossier || dossier.patient.hospital_id !== req.hospitalId) {
                throw fail(404, 'Patient record not found.');
            }
            return dossier;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/staff')
    @UseGuards(HospitalGuard)
    async getStaff(@Req() req: Request) {
        try {
            return await this.hospitals.getStaff(req.hospitalId, req.hospitalAdmin);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('hospital/staff')
    @HttpCode(201)
    @UseGuards(HospitalGuard)
    async createStaff(@Req() req: Request) {
        try {
            const hospitalId = req.hospitalId;
            const { username, name, email, phone, pin = '8888', role = 'Hospital Admin', department = 'General Medicine' } = req.body;

            if (!username || !username.trim() || !name || !name.trim()) {
                throw fail(400, 'Username and staff name are required.');
            }

            const validRoles = ['Hospital Super Admin', 'Hospital Admin'];
            if (!validRoles.includes(role)) {
                throw fail(400, 'Role must be Hospital Super Admin or Hospital Admin.');
            }

            const result = await this.hospitals.createStaff(hospitalId, req.hospitalAdmin, {
                username,
                name,
                email,
                phone,
                pin,
                role,
                department,
            });

            if (result.quotaError) throw fail(403, result.message);
            if (result.userConflict) throw fail(409, result.message);

            return {
                success: true,
                message: `${result.role} "${result.name}" successfully appointed!`,
                staff_id: result.staff_id,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('hospital/staff/:id')
    @UseGuards(HospitalGuard)
    async updateStaff(@Req() req: Request) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;
            const { name, email, phone, department, status } = req.body;

            const updated = await this.hospitals.updateStaff(staffId, hospitalId, { name, email, phone, department, status });
            if (!updated) {
                throw fail(404, 'Staff member not found.');
            }

            return { success: true, message: 'Hospital staff details updated successfully.' };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('hospital/staff/:id/reset-pin')
    @HttpCode(200)
    @UseGuards(HospitalGuard)
    async resetStaffPin(@Req() req: Request) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;
            const { pin } = req.body;

            if (!pin || pin.trim().length < 4) {
                throw fail(400, 'Security PIN must be at least 4 digits.');
            }

            const staff = await this.hospitals.resetStaffPin(staffId, hospitalId, pin);
            if (!staff) {
                throw fail(404, 'Staff member not found.');
            }

            return { success: true, message: `Security PIN reset successfully for ${staff.name}.` };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('hospital/staff/:id')
    @UseGuards(HospitalGuard)
    async deleteStaff(@Req() req: Request) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;

            const result = await this.hospitals.deleteStaff(staffId, hospitalId);
            if (result.notFound) {
                throw fail(404, 'Staff member not found.');
            }
            if (result.isLastSuperAdmin) {
                throw fail(400, 'Cannot remove the only remaining Hospital Super Admin.');
            }

            return {
                success: true,
                message: `Staff member "${result.staff!.name}" removed and quota seat freed.`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/visits')
    @UseGuards(HospitalGuard)
    async getVisits(@Req() req: Request) {
        try {
            const { search, department, disposition, date, limit = 25, offset = 0 } = req.query as Record<string, any>;
            return await this.visits.listVisits(req.hospitalId, {
                search,
                department,
                disposition,
                date,
                limit,
                offset,
            });
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('hospital/visits/summary')
    @UseGuards(HospitalGuard)
    async getVisitsSummary(@Req() req: Request) {
        try {
            return await this.visits.getSummary(req.hospitalId);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('hospital/visits')
    @HttpCode(201)
    @UseGuards(HospitalGuard)
    async createVisit(@Req() req: Request) {
        try {
            const visit = (await this.visits.createVisit(req.hospitalId, req.body, req.hospitalAdmin))!;
            return {
                success: true,
                message: `Patient ${visit.patient_name} registered successfully with ID ${visit.visit_uid}.`,
                visit,
            };
        } catch (err) {
            throw fail(400, (err as Error)?.message);
        }
    }

    @Get('hospital/visits/:id')
    @UseGuards(HospitalGuard)
    async getVisitDetails(@Req() req: Request) {
        try {
            const visit = await this.visits.getVisitById(req.hospitalId, req.params.id);
            if (!visit) {
                throw fail(404, 'Hospital visit record not found.');
            }
            return visit;
        } catch (err) {
            throw serverError(err);
        }
    }
}
