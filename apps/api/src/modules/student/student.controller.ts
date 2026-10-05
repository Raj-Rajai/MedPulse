import { Controller, Get, HttpCode, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StudentGuard } from '../../auth/guards';
import { fail, HttpError, serverError } from '../../common/http-error';
import { StudentModel } from './student.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Controller()
export class StudentController {
    constructor(private readonly students: StudentModel) {}

    @Get('students')
    @UseGuards(StudentGuard)
    getStudents() {
        try {
            const rows = this.students.getAll();
            return rows;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('students')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createStudent(@Req() req: Request) {
        try {
            const {
                roll_number,
                name,
                pin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status,
            } = req.body;

            if (!roll_number || !name) {
                throw fail(400, 'Roll number and student name are required');
            }

            const cleanRoll = roll_number.toString().trim();
            const existing = this.students.findByRoll(cleanRoll);
            if (existing) {
                throw fail(409, 'Student with this Roll Number already exists');
            }

            const newStudent = this.students.create({
                roll_number: cleanRoll,
                name,
                pin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status,
            });

            return { id: newStudent!.id, ...newStudent };
        } catch (err) {
            if (err instanceof HttpError) throw err;
            if (err.message && err.message.includes('UNIQUE')) {
                throw fail(409, 'Student with this Roll Number already exists');
            }
            throw serverError(err);
        }
    }

    @Get('students/profile')
    getProfile(@Req() req: Request) {
        try {
            const { roll_number, student_id } = req.query as Record<string, any>;
            const profileData = this.students.getProfile(student_id, roll_number);
            if (!profileData) {
                throw fail(404, 'Student record not found');
            }
            return profileData;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('students/profile')
    @UseGuards(StudentGuard)
    updateProfile(@Req() req: Request) {
        try {
            const sid = req.studentId;
            const { name, email, phone, batch_year, posting_unit } = req.body;
            const updated = this.students.updateProfile(sid, { name, email, phone, batch_year, posting_unit });
            return {
                success: true,
                message: 'Profile updated successfully',
                student: updated,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('students/change-pin')
    @HttpCode(200)
    @UseGuards(StudentGuard)
    changePin(@Req() req: Request) {
        try {
            const sid = req.studentId;
            const { current_pin, new_pin } = req.body;
            if (!current_pin || !new_pin) {
                throw fail(400, 'Both current PIN and new PIN are required');
            }
            if (new_pin.trim().length < 4) {
                throw fail(400, 'New PIN must be at least 4 digits');
            }

            const result = this.students.changePin(sid, current_pin, new_pin);
            if (result.notFound) {
                throw fail(404, 'Student not found');
            }
            if (result.invalidPin) {
                throw fail(401, 'Current PIN is incorrect');
            }

            return {
                success: true,
                message: 'PIN successfully changed',
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('students/provision-patient')
    @UseGuards(StudentGuard)
    provisionPatient(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        try {
            const { member_id, phone, pin, name } = req.body;
            if (!member_id) {
                throw fail(400, 'Family member ID is required.');
            }

            const result = this.students.provisionPatient(req.studentId, req.student.referral_code, {
                member_id,
                phone,
                pin,
                name,
            });

            if (result.forbidden) {
                throw fail(403, 'Family member not found in your assigned households.');
            }

            if (result.alreadyExists) {
                res.status(200);
                return {
                    success: true,
                    message: result.message,
                    patient_uid: result.patient_uid,
                    phone: result.phone,
                    pin: result.pin,
                    name: result.name,
                };
            }

            res.status(201);
            return {
                success: true,
                message: `Patient account created successfully for ${result.name}!`,
                patient_uid: result.patient_uid,
                phone: result.phone,
                pin: result.pin,
                name: result.name,
            };
        } catch (err) {
            throw serverError(err);
        }
    }
}
