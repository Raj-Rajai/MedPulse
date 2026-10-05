/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard, PatientGuard, StudentGuard } from '../../auth/guards';
import { fail, serverError } from '../../common/http-error';
import { CampaignModel } from './campaign.model';

@Controller()
export class CampaignController {
    constructor(private readonly campaigns: CampaignModel) {}

    /**
     * Preview matching patients for a keyword before creating or dispatching
     */
    private previewMatching(req: Request) {
        try {
            const keyword: any = req.query.keyword || req.body.keyword;
            if (!keyword) {
                throw fail(400, 'Keyword is required to preview matching patients');
            }
            const collegeId = req.query.college_id || (req.admin ? req.admin.college_id : null);
            const matches = this.campaigns.findMatchingPatients(keyword, collegeId);

            return {
                success: true,
                keyword: keyword.toUpperCase(),
                total_matching: matches.length,
                matches: matches
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    // Public / General Campaign Listing
    /**
     * List all campaigns with real-time delivery and engagement counts
     */
    @Get('campaigns')
    listCampaigns(@Req() req: Request) {
        try {
            const collegeId = req.query.college_id || (req.admin ? req.admin.college_id : null);
            const campaigns = this.campaigns.list(collegeId);
            return {
                success: true,
                count: campaigns.length,
                campaigns
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    // Faculty Admin Campaign Management
    @Get('campaigns/preview')
    @UseGuards(AdminGuard)
    previewMatchingGet(@Req() req: Request) {
        return this.previewMatching(req);
    }

    @Post('campaigns/preview')
    @HttpCode(200)
    @UseGuards(AdminGuard)
    previewMatchingPost(@Req() req: Request) {
        return this.previewMatching(req);
    }

    /**
     * Create and optionally auto-dispatch a campaign
     */
    @Post('campaigns')
    @HttpCode(201)
    @UseGuards(AdminGuard)
    createCampaign(@Req() req: Request) {
        try {
            const { title, keyword, description, event_date, venue, auto_dispatch = true } = req.body;
            if (!title || !keyword) {
                throw fail(400, 'Title and keyword are required to launch a campaign');
            }

            const collegeId = req.body.college_id || (req.admin ? req.admin.college_id : 1);
            const adminId = req.admin ? req.admin.id : null;

            const campaign = this.campaigns.create({
                title,
                keyword,
                description,
                college_id: collegeId,
                created_by_admin_id: adminId,
                event_date,
                venue
            })!;

            let dispatchResult = null;
            if (auto_dispatch) {
                dispatchResult = this.campaigns.dispatchCampaign(campaign.id);
            }

            return {
                success: true,
                campaign,
                dispatch: dispatchResult,
                message: `Campaign "${campaign.title}" created successfully and dispatched to ${dispatchResult ? dispatchResult.newly_notified : 0} matching patients.`
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    /**
     * Get campaign details and recipient roster
     */
    @Get('campaigns/:id')
    @UseGuards(AdminGuard)
    getCampaignDetails(@Req() req: Request) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const campaign = this.campaigns.findById(id);
            if (!campaign) {
                throw fail(404, 'Campaign not found');
            }
            const roster = this.campaigns.getCampaignRoster(id);
            const stats = {
                total_targeted: roster.length,
                acknowledged: roster.filter(r => r.status === 'Acknowledged').length,
                cadet_contacted: roster.filter(r => r.cadet_call_status === 'Contacted' || r.cadet_call_status === 'Assisted').length
            };
            campaign.stats = stats;
            campaign.roster = roster;

            return {
                success: true,
                campaign,
                total_recipients: roster.length,
                roster
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    /**
     * Re-dispatch or manually trigger a campaign scan
     */
    @Post('campaigns/:id/dispatch')
    @HttpCode(200)
    @UseGuards(AdminGuard)
    dispatchCampaign(@Req() req: Request) {
        try {
            const id = parseInt(req.params.id as string, 10);
            const result = this.campaigns.dispatchCampaign(id);
            return {
                success: true,
                ...result,
                message: `Dispatched campaign to ${result.newly_notified} new matching patients.`
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    // Patient CRM Notifications (Decision-Diamond Engine: Only condition-matched patients)
    /**
     * Patient CRM: Get notification feed for authenticated patient
     */
    @Get('patient/notifications')
    @UseGuards(PatientGuard)
    getPatientNotifications(@Req() req: Request) {
        try {
            const patientId = req.patientId;
            const notifications = this.campaigns.getPatientNotifications(patientId);
            const unreadCount = notifications.filter(n => n.notification_status === 'Delivered').length;

            return {
                success: true,
                unread_count: unreadCount,
                total: notifications.length,
                notifications
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    /**
     * Patient CRM: Acknowledge or RSVP to a campaign
     */
    @Post('patient/notifications/:id/acknowledge')
    @HttpCode(200)
    @UseGuards(PatientGuard)
    acknowledgeNotification(@Req() req: Request) {
        try {
            const notifId = parseInt(req.params.id as string, 10);
            const patientId = req.patientId;
            const { status = 'Acknowledged', response_note } = req.body;

            const updated = this.campaigns.acknowledgeNotification(notifId, patientId, status, response_note);
            return {
                success: true,
                message: status === 'Acknowledged' ? 'Thank you! Your attendance has been confirmed.' : 'Notification updated.',
                notification: updated
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    // Medical Cadet (Student) Campaign Coordination Tasks
    /**
     * Student Portal: Get campaign tasks for adopted patients
     */
    @Get('student/campaign-tasks')
    @UseGuards(StudentGuard)
    getCadetTasks(@Req() req: Request) {
        try {
            const studentId = req.studentId;
            const tasks = this.campaigns.getCadetCampaignTasks(studentId);
            const pendingCount = tasks.filter(t => t.cadet_call_status === 'Pending').length;

            return {
                success: true,
                pending_count: pendingCount,
                total: tasks.length,
                tasks
            };
        } catch (err) {
            throw serverError(err);
        }
    }

    /**
     * Student Portal: Update cadet call / outreach status
     */
    @Post('student/campaign-tasks/:id/status')
    @HttpCode(200)
    @UseGuards(StudentGuard)
    updateCadetTask(@Req() req: Request) {
        try {
            const notifId = parseInt(req.params.id as string, 10);
            const studentId = req.studentId;
            const status = req.body.status || req.body.callStatus || req.body.call_status;

            const updated = this.campaigns.updateCadetTaskStatus(notifId, studentId, status);
            return {
                success: true,
                message: `Patient contact status updated to: ${status}`,
                task: updated
            };
        } catch (err) {
            throw serverError(err);
        }
    }
}
