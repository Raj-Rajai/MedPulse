const CampaignModel = require('../models/campaign.model');

const CampaignController = {
    /**
     * Preview matching patients for a keyword before creating or dispatching
     */
    previewMatching(req, res) {
        try {
            const keyword = req.query.keyword || req.body.keyword;
            if (!keyword) {
                return res.status(400).json({ error: 'Keyword is required to preview matching patients' });
            }
            const collegeId = req.query.college_id || (req.admin ? req.admin.college_id : null);
            const matches = CampaignModel.findMatchingPatients(keyword, collegeId);

            res.json({
                success: true,
                keyword: keyword.toUpperCase(),
                total_matching: matches.length,
                matches: matches
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Create and optionally auto-dispatch a campaign
     */
    createCampaign(req, res) {
        try {
            const { title, keyword, description, event_date, venue, auto_dispatch = true } = req.body;
            if (!title || !keyword) {
                return res.status(400).json({ error: 'Title and keyword are required to launch a campaign' });
            }

            const collegeId = req.body.college_id || (req.admin ? req.admin.college_id : 1);
            const adminId = req.admin ? req.admin.id : null;

            const campaign = CampaignModel.create({
                title,
                keyword,
                description,
                college_id: collegeId,
                created_by_admin_id: adminId,
                event_date,
                venue
            });

            let dispatchResult = null;
            if (auto_dispatch) {
                dispatchResult = CampaignModel.dispatchCampaign(campaign.id);
            }

            res.status(201).json({
                success: true,
                campaign,
                dispatch: dispatchResult,
                message: `Campaign "${campaign.title}" created successfully and dispatched to ${dispatchResult ? dispatchResult.newly_notified : 0} matching patients.`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * List all campaigns with real-time delivery and engagement counts
     */
    listCampaigns(req, res) {
        try {
            const collegeId = req.query.college_id || (req.admin ? req.admin.college_id : null);
            const campaigns = CampaignModel.list(collegeId);
            res.json({
                success: true,
                count: campaigns.length,
                campaigns
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get campaign details and recipient roster
     */
    getCampaignDetails(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const campaign = CampaignModel.findById(id);
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' });
            }
            const roster = CampaignModel.getCampaignRoster(id);
            const stats = {
                total_targeted: roster.length,
                acknowledged: roster.filter(r => r.status === 'Acknowledged').length,
                cadet_contacted: roster.filter(r => r.cadet_call_status === 'Contacted' || r.cadet_call_status === 'Assisted').length
            };
            campaign.stats = stats;
            campaign.roster = roster;

            res.json({
                success: true,
                campaign,
                total_recipients: roster.length,
                roster
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Re-dispatch or manually trigger a campaign scan
     */
    dispatchCampaign(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const result = CampaignModel.dispatchCampaign(id);
            res.json({
                success: true,
                ...result,
                message: `Dispatched campaign to ${result.newly_notified} new matching patients.`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Patient CRM: Get notification feed for authenticated patient
     */
    getPatientNotifications(req, res) {
        try {
            const patientId = req.patientId;
            const notifications = CampaignModel.getPatientNotifications(patientId);
            const unreadCount = notifications.filter(n => n.notification_status === 'Delivered').length;

            res.json({
                success: true,
                unread_count: unreadCount,
                total: notifications.length,
                notifications
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Patient CRM: Acknowledge or RSVP to a campaign
     */
    acknowledgeNotification(req, res) {
        try {
            const notifId = parseInt(req.params.id, 10);
            const patientId = req.patientId;
            const { status = 'Acknowledged', response_note } = req.body;

            const updated = CampaignModel.acknowledgeNotification(notifId, patientId, status, response_note);
            res.json({
                success: true,
                message: status === 'Acknowledged' ? 'Thank you! Your attendance has been confirmed.' : 'Notification updated.',
                notification: updated
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Student Portal: Get campaign tasks for adopted patients
     */
    getCadetTasks(req, res) {
        try {
            const studentId = req.studentId;
            const tasks = CampaignModel.getCadetCampaignTasks(studentId);
            const pendingCount = tasks.filter(t => t.cadet_call_status === 'Pending').length;

            res.json({
                success: true,
                pending_count: pendingCount,
                total: tasks.length,
                tasks
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Student Portal: Update cadet call / outreach status
     */
    updateCadetTask(req, res) {
        try {
            const notifId = parseInt(req.params.id, 10);
            const studentId = req.studentId;
            const status = req.body.status || req.body.callStatus || req.body.call_status;

            const updated = CampaignModel.updateCadetTaskStatus(notifId, studentId, status);
            res.json({
                success: true,
                message: `Patient contact status updated to: ${status}`,
                task: updated
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = CampaignController;
