import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth/auth.service';
import { StudentGuard } from '../../auth/guards';
import { fail, HttpError, serverError } from '../../common/http-error';
import { ExportService } from '../export/export.service';
import { FamilyModel } from './family.model';

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
    async getFamilies(@Req() req: Request) {
        try {
            const { search } = req.query;
            return await this.families.getFamilies(req.studentId, search);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('families/:id')
    @UseGuards(StudentGuard)
    async getFamilyById(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = await this.families.getFamilyById(familyId, req.studentId);
            if (result.notFound) throw fail(404, 'Family not found');
            if (result.forbidden) throw fail(403, 'Access denied. This household record belongs to another student cadre.');
            return result.family;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('families/:id/members')
    @UseGuards(StudentGuard)
    async getFamilyMembers(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const { search, gender } = req.query;
            const result = await this.families.getFamilyMembers(familyId, req.studentId, search, gender);
            if (result.notFound) throw fail(404, 'Family not found');
            if (result.forbidden) throw fail(403, 'Access denied. This household belongs to another student cadre.');
            return result.members;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('families')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    async createFamily(@Req() req: Request) {
        try {
            const result = await this.families.createFamily(req.studentId, req.body);
            if (result.badRequest) throw fail(400, result.message);
            if (result.conflict) throw fail(409, result.message);

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
            if (!(err instanceof HttpError)) console.error('Error saving family:', err);
            throw serverError(err);
        }
    }

    @Put('families/:id')
    @UseGuards(StudentGuard)
    async updateFamily(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = await this.families.updateFamily(familyId, req.studentId, req.body);
            if (result.notFound) throw fail(404, 'Family not found');
            if (result.forbidden) throw fail(403, 'Access denied. You cannot modify a household belonging to another student.');

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
    async deleteFamily(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = await this.families.deleteFamily(familyId, req.studentId);
            if (result.notFound) throw fail(404, 'Family not found');
            if (result.forbidden) throw fail(403, 'Access denied. You cannot delete a household belonging to another student.');

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
    async addMember(@Req() req: Request) {
        try {
            const familyId = req.params.id;
            const result = await this.families.addMember(familyId, req.studentId, req.body);
            if (result.notFound) throw fail(404, 'Family not found');
            if (result.forbidden) throw fail(403, "Access denied. Cannot add members to another student's household.");
            if (result.badRequest) throw fail(400, result.message);

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
    async updateMember(@Req() req: Request) {
        try {
            const memberId = req.params.id;
            const result = await this.families.updateMember(memberId, req.studentId, req.body);
            if (result.notFound) throw fail(404, 'Member not found');
            if (result.forbidden) throw fail(403, 'Access denied. Cannot modify a member belonging to another student.');

            return {
                success: true,
                message: 'Member updated successfully',
                member: result.member,
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('members/:id')
    @UseGuards(StudentGuard)
    async getMemberById(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const member = await this.families.getMemberById(req.params.id);
            if (!member) throw fail(404, 'Member not found');
            return member;
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('members/:id')
    @UseGuards(StudentGuard)
    async deleteMember(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const deleted = await this.families.deleteMember(req.params.id);
            if (!deleted) throw fail(404, 'Member not found');
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
    async getConditions(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            return await this.families.getConditions(req.params.id);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/conditions')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    async createCondition(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) throw fail(400, 'Condition name is required');
            const condition = await this.families.createCondition(req.params.id, req.body);
            return { success: true, message: 'Medical condition recorded', condition };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('conditions/:id')
    @UseGuards(StudentGuard)
    async updateCondition(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_conditions', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { condition_name } = req.body;
            if (!condition_name || !condition_name.trim()) throw fail(400, 'Condition name is required');
            const updated = await this.families.updateCondition(req.params.id, req.body);
            if (!updated) throw fail(404, 'Condition not found');
            return { success: true, message: 'Condition updated', condition: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('conditions/:id')
    @UseGuards(StudentGuard)
    async deleteCondition(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_conditions', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const deleted = await this.families.deleteCondition(req.params.id);
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
    async getMedications(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            return await this.families.getMedications(req.params.id);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/medications')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    async createMedication(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const medicine_name = req.body.medicine_name ?? req.body.medication_name;
            if (!medicine_name || !String(medicine_name).trim()) throw fail(400, 'Medication name is required');
            const medication = await this.families.createMedication(req.params.id, req.body);
            return { success: true, message: 'Medication recorded', medication };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('medications/:id')
    @UseGuards(StudentGuard)
    async updateMedication(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_medications', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const medicine_name = req.body.medicine_name ?? req.body.medication_name;
            if (!medicine_name || !String(medicine_name).trim()) throw fail(400, 'Medication name is required');
            const updated = await this.families.updateMedication(req.params.id, req.body);
            if (!updated) throw fail(404, 'Medication not found');
            return { success: true, message: 'Medication updated', medication: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('medications/:id')
    @UseGuards(StudentGuard)
    async deleteMedication(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_medications', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const deleted = await this.families.deleteMedication(req.params.id);
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
    async getAllergies(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            return await this.families.getAllergies(req.params.id);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/allergies')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    async createAllergy(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) throw fail(400, 'Allergen name is required');
            const allergy = await this.families.createAllergy(req.params.id, req.body);
            return { success: true, message: 'Allergy recorded', allergy };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('allergies/:id')
    @UseGuards(StudentGuard)
    async updateAllergy(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_allergies', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { allergen } = req.body;
            if (!allergen || !allergen.trim()) throw fail(400, 'Allergen name is required');
            const updated = await this.families.updateAllergy(req.params.id, req.body);
            if (!updated) throw fail(404, 'Allergy not found');
            return { success: true, message: 'Allergy updated', allergy: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('allergies/:id')
    @UseGuards(StudentGuard)
    async deleteAllergy(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_allergies', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const deleted = await this.families.deleteAllergy(req.params.id);
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
    async getHistory(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            return await this.families.getHistory(req.params.id);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/history')
    @HttpCode(201)
    @UseGuards(StudentGuard)
    async createHistory(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { description } = req.body;
            if (!description || !description.trim()) throw fail(400, 'Description is required');
            const history = await this.families.createHistory(req.params.id, req.body);
            return { success: true, message: 'Medical history recorded', history };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Put('history/:id')
    @UseGuards(StudentGuard)
    async updateHistory(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_medical_history', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const { description } = req.body;
            if (!description || !description.trim()) throw fail(400, 'Description is required');
            const updated = await this.families.updateHistory(req.params.id, req.body);
            if (!updated) throw fail(404, 'History record not found');
            return { success: true, message: 'Medical history updated', history: updated };
        } catch (err) {
            throw serverError(err);
        }
    }

    @Delete('history/:id')
    @UseGuards(StudentGuard)
    async deleteHistory(@Req() req: Request) {
        if (!(await this.auth.verifySubEntityAccess('member_medical_history', req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const deleted = await this.families.deleteHistory(req.params.id);
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
    async getLifestyle(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            return await this.families.getLifestyle(req.params.id);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Post('members/:id/lifestyle')
    @HttpCode(200)
    @UseGuards(StudentGuard)
    async saveLifestyle(@Req() req: Request) {
        if (!(await this.auth.verifyMemberAccess(req.params.id, req.studentId))) throw fail(403, 'Access denied');
        try {
            const lifestyle = await this.families.saveLifestyle(req.params.id, req.body);
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
    async createFollowUp(@Req() req: Request) {
        try {
            const memberId = req.params.id;
            const member = await this.auth.verifyMemberAccess(memberId, req.studentId);
            if (!member) throw fail(403, 'Access denied. Member belongs to another student cadre.');

            const followUp = await this.families.createFollowUp(memberId, req.studentId, req.body);
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
    async deleteFollowUp(@Req() req: Request) {
        try {
            const fuId = req.params.id;
            if (!(await this.auth.verifyFollowUpAccess(fuId, req.studentId))) {
                throw fail(403, 'Access denied. You cannot delete this follow-up visit.');
            }
            const deleted = await this.families.deleteFollowUp(fuId);
            if (!deleted) throw fail(404, 'Follow-up not found');
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
    async getAnalyticsSummary(@Req() req: Request) {
        try {
            return await this.families.getAnalyticsSummary(req.studentId);
        } catch (err) {
            throw serverError(err);
        }
    }

    @Get('analytics/charts')
    @UseGuards(StudentGuard)
    async getAnalyticsCharts(@Req() req: Request) {
        try {
            const { gender, ageGroup, familyId } = req.query;
            return await this.families.getAnalyticsCharts(req.studentId, { gender, ageGroup, familyId });
        } catch (err) {
            console.error('Error in /analytics/charts:', err);
            throw serverError(err);
        }
    }

    @Get('analytics/report/:reportId')
    @UseGuards(StudentGuard)
    async getAnalyticsReport(@Req() req: Request) {
        try {
            const { reportId } = req.params;
            const result = await this.families.getAnalyticsReport(req.studentId, reportId);
            if (result.invalidReport) throw fail(400, 'Unknown report identifier');
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
    async exportCsv(@Req() req: Request, @Res() res: Response) {
        try {
            const csvData = await this.exporter.generateCsv(req.studentId);
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
    async exportPdf(@Req() req: Request, @Res() res: Response) {
        try {
            const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Report_${new Date().toISOString().split('T')[0]}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await this.exporter.generatePdfStream(req.studentId, res);
        } catch (err) {
            console.error('PDF Export Error:', err);
            res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
        }
    }

    @Get('export/data')
    @UseGuards(StudentGuard)
    async exportData(@Req() req: Request) {
        try {
            const exportData = await this.exporter.getStudentExportData(req.studentId);
            if (!exportData) throw fail(404, 'No survey data found for student.');
            return exportData;
        } catch (err) {
            if (!(err instanceof HttpError)) console.error('Export Data Error:', err);
            throw serverError(err, 'Failed to fetch export data: ');
        }
    }
}
