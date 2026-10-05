import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth/auth.service';
import { StudentGuard } from '../../auth/guards';
import { fail, HttpError, serverError } from '../../common/http-error';
import { ExportService } from '../export/export.service';
import { FamilyModel } from './family.model';

/**
 * Ported from backend/controllers/survey.controller.js + backend/routes/survey.routes.js.
 * Routes are declared in the same order as the original routes file.
 */
@Controller()
export class SurveyController {
    constructor(
        private readonly families: FamilyModel,
        private readonly auth: AuthService,
        private readonly exporter: ExportService,
    ) {}

    // -------------------------------------------------------------
    // Families
    // -------------------------------------------------------------
    @Get('families')
    @UseGuards(StudentGuard)
    getFamilies(@Req() req: Request) {
        try {
            const { search } = req.query;
            const rows = this.families.getFamilies(req.studentId, search);
            return rows;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('families/:id')
    @UseGuards(StudentGuard)
    getFamilyById(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = this.families.getFamilyById(familyId, req.studentId);
            if (result.notFound) {
                throw fail(404, 'Family not found');
            }
            if (result.forbidden) {
                throw fail(403, 'Access denied. This household record belongs to another student cadre.');
            }
            return result.family;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('families/:id/members')
    @UseGuards(StudentGuard)
    getFamilyMembers(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const { search, gender } = req.query;
            const result = this.families.getFamilyMembers(familyId, req.studentId, search, gender);
            if (result.notFound) {
                throw fail(404, 'Family not found');
            }
            if (result.forbidden) {
                throw fail(403, 'Access denied. This household belongs to another student cadre.');
            }
            return result.members;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('families')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createFamily(@Req() req: Request) {
        try {
            const result = this.families.createFamily(req.studentId, req.body);
            if (result.badRequest) {
                throw fail(400, result.message);
            }
            if (result.conflict) {
                throw fail(409, result.message);
            }

            return {
                success: true,
                message: 'Family record created successfully',
                family_id: result.family_id,
                family_code: result.family_code,
                family_no: result.family_no,
                family: result.family,
                members_count: result.members_count,
            };
        } catch (err) {
            // The original returned 400/409 directly (never reaching this catch), so only real failures are logged.
            if (!(err instanceof HttpError)) console.error('Error saving family:', err);
            throw serverError(err);
        }
    }

    @Put('families/:id')
    @UseGuards(StudentGuard)
    updateFamily(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = this.families.updateFamily(familyId, req.studentId, req.body);
            if (result.notFound) {
                throw fail(404, 'Family not found');
            }
            if (result.forbidden) {
                throw fail(403, 'Access denied. You cannot modify a household belonging to another student.');
            }

            return {
                success: true,
                message: 'Family updated successfully',
                family: result.family,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('families/:id')
    @UseGuards(StudentGuard)
    deleteFamily(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = this.families.deleteFamily(familyId, req.studentId);
            if (result.notFound) {
                throw fail(404, 'Family not found');
            }
            if (result.forbidden) {
                throw fail(403, 'Access denied. You cannot delete a household belonging to another student.');
            }

            return { success: true, message: 'Family record deleted' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Members
    // -------------------------------------------------------------
    @Post('families/:id/members')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    addMember(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = this.families.addMember(familyId, req.studentId, req.body);
            if (result.notFound) {
                throw fail(404, 'Family not found');
            }
            if (result.forbidden) {
                throw fail(403, "Access denied. Cannot add members to another student's household.");
            }
            if (result.badRequest) {
                throw fail(400, result.message);
            }

            return {
                success: true,
                message: 'Member added successfully to family',
                member: result.member,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('members/:id')
    @UseGuards(StudentGuard)
    updateMember(@Req() req: Request) {
        try {
            const memberId = req.params.id;
            const result = this.families.updateMember(memberId, req.studentId, req.body);
            if (result.notFound) {
                throw fail(404, 'Member not found');
            }
            if (result.forbidden) {
                throw fail(403, 'Access denied. Cannot modify a member belonging to another student.');
            }

            return {
                success: true,
                message: 'Member updated successfully',
                member: result.member,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    // FIX (security): the original had no auth on GET/DELETE /members/:id, so anyone could read or delete
    // any member. Both now require the signed-in student who owns the household, like the other member routes.
    @Get('members/:id')
    @UseGuards(StudentGuard)
    getMemberById(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const memberId = req.params.id;
            const member = this.families.getMemberById(memberId);
            if (!member) {
                throw fail(404, 'Member not found');
            }
            return member;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('members/:id')
    @UseGuards(StudentGuard)
    deleteMember(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const memberId = req.params.id;
            const deleted = this.families.deleteMember(memberId);
            if (!deleted) {
                throw fail(404, 'Member not found');
            }
            return { success: true, message: 'Member record deleted' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Conditions
    // -------------------------------------------------------------
    @Get('members/:id/conditions')
    @UseGuards(StudentGuard)
    getConditions(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const conditions = this.families.getConditions(req.params.id);
            return conditions;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/conditions')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createCondition(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) {
                throw fail(400, 'Condition name is required');
            }
            const condition = this.families.createCondition(req.params.id, req.body);
            return { success: true, message: 'Medical condition recorded', condition };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('conditions/:id')
    @UseGuards(StudentGuard)
    updateCondition(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) {
                throw fail(400, 'Condition name is required');
            }
            const updated = this.families.updateCondition(req.params.id, req.body);
            if (!updated) throw fail(404, 'Condition not found');
            return { success: true, message: 'Condition updated', condition: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('conditions/:id')
    @UseGuards(StudentGuard)
    deleteCondition(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const deleted = this.families.deleteCondition(req.params.id);
            if (!deleted) throw fail(404, 'Condition not found');
            return { success: true, message: 'Condition removed' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Medications
    // -------------------------------------------------------------
    @Get('members/:id/medications')
    @UseGuards(StudentGuard)
    getMedications(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const medications = this.families.getMedications(req.params.id);
            return medications;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/medications')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createMedication(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const medicine_name = req.body.medicine_name ?? req.body.medication_name; // medication_name: student family page
            if (!medicine_name || !String(medicine_name).trim()) {
                throw fail(400, 'Medication name is required');
            }
            const medication = this.families.createMedication(req.params.id, req.body);
            return { success: true, message: 'Medication recorded', medication };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('medications/:id')
    @UseGuards(StudentGuard)
    updateMedication(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_medications', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const medicine_name = req.body.medicine_name ?? req.body.medication_name; // medication_name: student family page
            if (!medicine_name || !String(medicine_name).trim()) {
                throw fail(400, 'Medication name is required');
            }
            const updated = this.families.updateMedication(req.params.id, req.body);
            if (!updated) throw fail(404, 'Medication not found');
            return { success: true, message: 'Medication updated', medication: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('medications/:id')
    @UseGuards(StudentGuard)
    deleteMedication(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_medications', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const deleted = this.families.deleteMedication(req.params.id);
            if (!deleted) throw fail(404, 'Medication not found');
            return { success: true, message: 'Medication removed' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Allergies
    // -------------------------------------------------------------
    @Get('members/:id/allergies')
    @UseGuards(StudentGuard)
    getAllergies(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const allergies = this.families.getAllergies(req.params.id);
            return allergies;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/allergies')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createAllergy(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) {
                throw fail(400, 'Allergen name is required');
            }
            const allergy = this.families.createAllergy(req.params.id, req.body);
            return { success: true, message: 'Allergy recorded', allergy };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('allergies/:id')
    @UseGuards(StudentGuard)
    updateAllergy(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) {
                throw fail(400, 'Allergen name is required');
            }
            const updated = this.families.updateAllergy(req.params.id, req.body);
            if (!updated) throw fail(404, 'Allergy not found');
            return { success: true, message: 'Allergy updated', allergy: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('allergies/:id')
    @UseGuards(StudentGuard)
    deleteAllergy(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const deleted = this.families.deleteAllergy(req.params.id);
            if (!deleted) throw fail(404, 'Allergy not found');
            return { success: true, message: 'Allergy removed' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Medical History
    // -------------------------------------------------------------
    @Get('members/:id/history')
    @UseGuards(StudentGuard)
    getHistory(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const history = this.families.getHistory(req.params.id);
            return history;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/history')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createHistory(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { description } = req.body;
            if (!description || !description.trim()) {
                throw fail(400, 'Description is required');
            }
            const history = this.families.createHistory(req.params.id, req.body);
            return { success: true, message: 'Medical history recorded', history };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('history/:id')
    @UseGuards(StudentGuard)
    updateHistory(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const { description } = req.body;
            if (!description || !description.trim()) {
                throw fail(400, 'Description is required');
            }
            const updated = this.families.updateHistory(req.params.id, req.body);
            if (!updated) throw fail(404, 'History record not found');
            return { success: true, message: 'Medical history updated', history: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('history/:id')
    @UseGuards(StudentGuard)
    deleteHistory(@Req() req: Request) {
        if (!this.auth.verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const deleted = this.families.deleteHistory(req.params.id);
            if (!deleted) throw fail(404, 'History record not found');
            return { success: true, message: 'Medical history removed' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Lifestyle
    // -------------------------------------------------------------
    @Get('members/:id/lifestyle')
    @UseGuards(StudentGuard)
    getLifestyle(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const lifestyle = this.families.getLifestyle(req.params.id);
            return lifestyle;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/lifestyle')
    @HttpCode(200)
    @UseGuards(StudentGuard)
    saveLifestyle(@Req() req: Request) {
        if (!this.auth.verifyMemberAccess(req.params.id, req.studentId)) throw fail(403, 'Access denied');
        try {
            const lifestyle = this.families.saveLifestyle(req.params.id, req.body);
            return { success: true, message: 'Lifestyle recorded successfully', lifestyle };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Follow-Ups
    // -------------------------------------------------------------
    @Post('members/:id/follow-ups')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    createFollowUp(@Req() req: Request) {
        try {
            const memberId = req.params.id;
            const member = this.auth.verifyMemberAccess(memberId, req.studentId);
            if (!member) {
                throw fail(403, 'Access denied. Member belongs to another student cadre.');
            }

            const followUp = this.families.createFollowUp(memberId, req.studentId, req.body);
            return {
                success: true,
                message: 'Follow-up visit recorded successfully',
                follow_up: followUp,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('follow-ups/:id')
    @UseGuards(StudentGuard)
    deleteFollowUp(@Req() req: Request) {
        try {
            const fuId = req.params.id;
            if (!this.auth.verifyFollowUpAccess(fuId, req.studentId)) {
                throw fail(403, 'Access denied. You cannot delete this follow-up visit.');
            }
            const deleted = this.families.deleteFollowUp(fuId);
            if (!deleted) {
                throw fail(404, 'Follow-up not found');
            }
            return { success: true, message: 'Follow-up record deleted' };
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------
    @Get('analytics/summary')
    @UseGuards(StudentGuard)
    getAnalyticsSummary(@Req() req: Request) {
        try {
            const summary = this.families.getAnalyticsSummary(req.studentId);
            return summary;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('analytics/charts')
    @UseGuards(StudentGuard)
    getAnalyticsCharts(@Req() req: Request) {
        try {
            const { gender, ageGroup, familyId } = req.query;
            const charts = this.families.getAnalyticsCharts(req.studentId, { gender, ageGroup, familyId });
            return charts;
        } catch (err) {
            console.error('Error in /analytics/charts:', err);
            throw serverError(err);
        }
    }

    @Get('analytics/report/:reportId')
    @UseGuards(StudentGuard)
    getAnalyticsReport(@Req() req: Request) {
        try {
            const { reportId } = req.params;
            const result = this.families.getAnalyticsReport(req.studentId, reportId);
            if (result.invalidReport) {
                throw fail(400, 'Unknown report identifier');
            }
            return result;
        } catch (err) {
            throw serverError(err);
        }
    }

    // -------------------------------------------------------------
    // Export
    // -------------------------------------------------------------
    @Get('export/csv')
    @UseGuards(StudentGuard)
    exportCsv(@Req() req: Request, @Res() res: Response) {
        try {
            const csvData = this.exporter.generateCsv(req.studentId);
            const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Export_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvData);
        } catch (err) {
            console.error('CSV Export Error:', err);
            res.status(500).json({ error: 'Failed to generate CSV export: ' + err.message });
        }
    }

    @Get('export/pdf')
    @UseGuards(StudentGuard)
    exportPdf(@Req() req: Request, @Res() res: Response) {
        try {
            const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Report_${new Date().toISOString().split('T')[0]}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            this.exporter.generatePdfStream(req.studentId, res);
        } catch (err) {
            console.error('PDF Export Error:', err);
            res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
        }
    }

    @Get('export/data')
    @UseGuards(StudentGuard)
    exportData(@Req() req: Request) {
        try {
            const exportData = this.exporter.getStudentExportData(req.studentId);
            if (!exportData) {
                throw fail(404, 'No survey data found for student.');
            }
            return exportData;
        } catch (err) {
            // The original returned the 404 directly (never reaching this catch), so only real failures are logged.
            if (!(err instanceof HttpError)) console.error('Export Data Error:', err);
            throw serverError(err, 'Failed to fetch export data: ');
        }
    }
}
