import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { fail, HttpError, serverError } from '../../common/http-error';
import type { Row } from '../../common/row';
import { StudentModel } from './student.model';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Controller()
export class AuthController {
    constructor(private readonly students: StudentModel) {}

    @Post('auth/register')
    @HttpCode(201)
    register(@Req() req: Request) {
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

            if (!roll_number || !roll_number.toString().trim()) {
                throw fail(400, 'Student Roll Number is required');
            }
            if (!name || !name.trim()) {
                throw fail(400, 'Student full name is required');
            }

            const cleanRoll = roll_number.toString().trim();
            const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';

            if (cleanPin.length < 4) {
                throw fail(400, 'PIN / Passcode must be at least 4 characters');
            }

            const existing = this.students.findByRoll(cleanRoll);
            if (existing) {
                throw fail(409, `Student with Roll Number "${cleanRoll}" is already registered. Please sign in instead.`);
            }

            const newStudent = this.students.create({
                roll_number: cleanRoll,
                name,
                pin: cleanPin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status,
            });

            return {
                success: true,
                message: 'Student registration completed successfully',
                student: newStudent,
            };
        } catch (err) {
            if (err instanceof HttpError) throw err;
            if (err.message && err.message.includes('UNIQUE')) {
                throw fail(409, 'Student with this Roll Number is already registered');
            }
            throw serverError(err);
        }
    }

    @Post('auth/login')
    @HttpCode(200)
    login(@Req() req: Request) {
        try {
            const { roll_number, pin } = req.body;
            if (!roll_number) {
                throw fail(400, 'Roll number is required');
            }

            const student = this.students.findByRoll(roll_number.trim());
            if (!student) {
                throw fail(404, 'Student with Roll Number ' + roll_number + ' not found');
            }

            // FIX (security): the original skipped the PIN check when no PIN was sent, so a roll number alone signed in.
            if (!pin || !String(pin).trim()) {
                throw fail(400, 'PIN is required');
            }
            const expectedPin = student.pin || '1234';
            if (String(pin).trim() !== expectedPin) {
                throw fail(401, 'Invalid PIN / Password');
            }

            return {
                success: true,
                student,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('auth/me')
    me(@Req() req: Request) {
        try {
            const { roll_number, id } = req.query as Record<string, any>;
            let student: Row | null = null;
            if (id) {
                student = this.students.findById(id);
            } else if (roll_number) {
                student = this.students.findByRoll(roll_number);
            }

            if (!student) {
                throw fail(404, 'Student not found');
            }

            return student;
        } catch (err) {
            throw serverError(err);
        }
    }
}
