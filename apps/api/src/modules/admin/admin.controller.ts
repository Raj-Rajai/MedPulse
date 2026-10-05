import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards';
import { fail, serverError } from '../../common/http-error';
import { CollegeModel } from '../college/college.model';
import { ExportService } from '../export/export.service';
import { AdminModel } from './admin.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Controller()
export class AdminController {
    constructor(
        private readonly admins: AdminModel,
        private readonly colleges: CollegeModel,
        private readonly exports: ExportService,
    ) {}

    // Authentication & Profile
    @Post('admin/login')
    @HttpCode(200)
    login(@Req() req: Request) {
        try {
            const { username, pin } = req.body;
            if (!username || !pin) {
                throw fail(400, 'Admin username and PIN are required');
            }

            const admin = this.admins.findByUsername(username);
            if (!admin) {
                throw fail(401, 'Invalid admin username or account not found');
            }
            if (admin.pin !== pin.trim()) {
                throw fail(401, 'Invalid administrator PIN / Password');
            }

            return {
                success: true,
                admin,
                token: `admin-${admin.id}`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('admin/me')
    @UseGuards(AdminGuard)
    me(@Req() req: Request) {
        return { admin: req.admin };
    }

    // Overview & Statistics
    @Get('admin/stats')
    @UseGuards(AdminGuard)
    getStats() {
        try {
            const stats = this.admins.getStats();
            return stats;
        } catch (err) {
            throw serverError(err);
        }
    }

    // Student Cadre Management
    @Get('admin/students')
    @UseGuards(AdminGuard)
    getStudents(@Req() req: Request) {
        try {
            const { college_id, status, search } = req.query as Record<string, any>;
            const students = this.admins.getStudents({ college_id, status, search });
            return students;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('admin/students')
    @HttpCode(201)
    @UseGuards(AdminGuard)
    createStudent(@Req() req: Request) {
        try {
            const { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status } = req.body;
            if (!roll_number || !name) {
                throw fail(400, 'Roll number and student name are required');
            }

            const result = this.admins.createStudent(
                { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status },
                req.admin,
            );

            if (result.conflict) {
                throw fail(409, result.message);
            }

            return { success: true, student: result.student };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('admin/students/:id')
    @UseGuards(AdminGuard)
    updateStudent(@Req() req: Request) {
        try {
            const studentId = req.params.id;
            const { name, email, phone, batch_year, posting_unit, college_id, status } = req.body;
            const updated = this.admins.updateStudent(studentId, { name, email, phone, batch_year, posting_unit, college_id, status });
            if (!updated) {
                throw fail(404, 'Cadet record not found');
            }
            return { success: true, student: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('admin/students/:id/reset-pin')
    @HttpCode(200)
    @UseGuards(AdminGuard)
    resetStudentPin(@Req() req: Request) {
        try {
            const studentId = req.params.id;
            const newPin = req.body.new_pin ? req.body.new_pin.toString().trim() : '1234';
            if (newPin.length < 4) {
                throw fail(400, 'PIN must be at least 4 digits');
            }

            const student = this.admins.resetStudentPin(studentId, newPin);
            if (!student) {
                throw fail(404, 'Cadet record not found');
            }

            return {
                success: true,
                message: `PIN for Cadet ${student.name} (Roll ${student.roll_number}) reset to "${newPin}".`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('admin/students/:id')
    @UseGuards(AdminGuard)
    deleteStudent(@Req() req: Request) {
        try {
            const studentId = req.params.id;
            const deleted = this.admins.deleteStudent(studentId);
            if (!deleted) {
                throw fail(404, 'Cadet record not found');
            }

            return {
                success: true,
                message: `Cadet ${deleted.name} (Roll ${deleted.roll_number}) and all associated survey records deleted.`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('admin/students/:id/families')
    @UseGuards(AdminGuard)
    getStudentFamilies(@Req() req: Request) {
        try {
            const studentId = req.params.id;
            const result = this.admins.getStudentFamilies(studentId);
            if (!result) {
                throw fail(404, 'Cadet record not found');
            }
            return result;
        } catch (err) {
            throw serverError(err);
        }
    }

    // Cross-Cadet Household & Population Surveillance
    @Get('admin/families')
    @UseGuards(AdminGuard)
    getFamilies(@Req() req: Request) {
        try {
            const { student_id, college_id, village, search } = req.query as Record<string, any>;
            const families = this.admins.getFamilies({ student_id, college_id, village, search });
            return families;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('admin/members')
    @UseGuards(AdminGuard)
    getMembers(@Req() req: Request) {
        try {
            const { has_htn, has_dm, has_anaemia, search } = req.query as Record<string, any>;
            const members = this.admins.getMembers({ has_htn, has_dm, has_anaemia, search });
            return members;
        } catch (err) {
            throw serverError(err);
        }
    }

    // College & Institutional Administration
    @Get('admin/colleges')
    @UseGuards(AdminGuard)
    getColleges() {
        try {
            const colleges = this.colleges.getAdminOverview();
            return colleges;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('admin/colleges')
    @HttpCode(201)
    @UseGuards(AdminGuard)
    createCollege(@Req() req: Request) {
        try {
            const { name, code, city, state } = req.body;
            if (!name || !code) {
                throw fail(400, 'College name and institutional code are required');
            }

            const existing = this.colleges.getByCode(code);
            if (existing) {
                throw fail(409, `Medical institution with code "${code.trim()}" already exists`);
            }

            const newCol = this.colleges.create({ name, code, city, state });
            return { success: true, college: newCol };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('admin/colleges/:id')
    @UseGuards(AdminGuard)
    updateCollege(@Req() req: Request) {
        try {
            const { name, code, city, state } = req.body;
            const colId = req.params.id;
            const updated = this.colleges.update(colId, { name, code, city, state });
            return { success: true, college: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    // Master Exports & Faculty Audit
    @Get('admin/export/all-csv')
    @UseGuards(AdminGuard)
    exportAllCsv(@Req() req: Request, @Res() res: Response) {
        try {
            const csvData = this.exports.generateMasterCsv(req.query.college_id ? Number(req.query.college_id) : null);
            const filename = `MedPulse_Master_Survey_Compilation_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvData);
        } catch (err) {
            console.error('Master CSV Export Error:', err);
            res.status(500).json({ error: 'Failed to generate Master CSV: ' + err.message });
        }
    }

    @Get('admin/export/audit-pdf')
    @UseGuards(AdminGuard)
    exportAuditPdf(@Req() req: Request, @Res() res: Response) {
        try {
            const filename = `MedPulse_Faculty_Surveillance_Audit_${new Date().toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            this.exports.generateFacultyAuditPdfStream(res);
        } catch (err) {
            console.error('Faculty Audit PDF Error:', err);
            res.status(500).json({ error: 'Failed to generate Audit PDF: ' + err.message });
        }
    }

    // University Admins & Quota Hierarchy
    @Get('admin/university-admins')
    @UseGuards(AdminGuard)
    getUniversityAdmins(@Req() req: Request) {
        try {
            const uniId = req.query.university_id ? Number(req.query.university_id) : (req.admin.university_id || 1);
            const data = this.admins.getUniversityAdmins(uniId);
            return data;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('admin/university-admins')
    @HttpCode(201)
    @UseGuards(AdminGuard)
    createUniversityAdmin(@Req() req: Request) {
        try {
            const { username, name, pin, email, phone, role, university_id, status } = req.body;
            if (!username || !name) {
                throw fail(400, 'Admin username and full name are required');
            }

            const result = this.admins.createUniversityAdmin(
                { username, name, pin, email, phone, role, university_id, status },
                req.admin,
            );

            if (result.notFound) {
                throw fail(404, result.message);
            }
            if (result.conflict) {
                throw fail(409, result.message);
            }
            if (result.quotaExceeded) {
                throw fail(403, result.message);
            }
            if (result.userConflict) {
                throw fail(409, result.message);
            }

            return {
                success: true,
                message: `University Admin "${name.trim()}" registered successfully under ${result.collegeName}.`,
                admin: result.admin,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('admin/university-admins/:id')
    @UseGuards(AdminGuard)
    updateUniversityAdmin(@Req() req: Request) {
        try {
            const adminId = req.params.id;
            const { name, email, phone, status } = req.body;
            const updated = this.admins.updateUniversityAdmin(adminId, { name, email, phone, status });
            if (!updated) {
                throw fail(404, 'University Admin record not found');
            }
            return { success: true, admin: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('admin/university-admins/:id/reset-pin')
    @HttpCode(200)
    @UseGuards(AdminGuard)
    resetUniversityAdminPin(@Req() req: Request) {
        try {
            const adminId = req.params.id;
            const newPin = req.body.new_pin ? req.body.new_pin.toString().trim() : '9999';
            if (newPin.length < 4) {
                throw fail(400, 'Admin PIN must be at least 4 digits');
            }

            const target = this.admins.resetUniversityAdminPin(adminId, newPin);
            if (!target) {
                throw fail(404, 'University Admin record not found');
            }

            return {
                success: true,
                message: `PIN for Administrator ${target.name} (${target.username}) has been reset to "${newPin}".`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('admin/university-admins/:id')
    @UseGuards(AdminGuard)
    deleteUniversityAdmin(@Req() req: Request) {
        try {
            const adminId = req.params.id;
            const result = this.admins.deleteUniversityAdmin(adminId);
            if (result.notFound) {
                throw fail(404, 'University Admin record not found');
            }
            if (result.isSuperAdmin) {
                throw fail(400, 'Cannot delete the designated University Super Admin account.');
            }

            return {
                success: true,
                message: `University Admin ${result.target.name} (${result.target.username}) removed successfully.`,
            };
        } catch (err) {
            throw serverError(err);
        }
    }
}
