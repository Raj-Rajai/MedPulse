const EngagementModel = require('../models/engagement.model');

// Map model validation errors to proper HTTP status codes
function handle(res, fn) {
    try {
        return fn();
    } catch (err) {
        const status = err instanceof EngagementModel.EngagementError ? err.status : 500;
        return res.status(status).json({ error: err.message });
    }
}

const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';

const EngagementController = {
    rsvp(req, res) {
        handle(res, () => {
            const { rsvp, note } = req.body || {};
            const result = EngagementModel.rsvp(parseInt(req.params.id, 10), req.patient, rsvp, note);
            const messages = {
                'Attending': 'Thank you! Your attendance is confirmed.',
                'Not Attending': 'Noted. The camp team has been informed you cannot attend.',
                'Need Help': 'Your student will call you to help you attend.'
            };
            res.json({ success: true, message: messages[rsvp], ...result });
        });
    },

    markRead(req, res) {
        handle(res, () => res.json({ success: true, updated: EngagementModel.markNotificationsRead(req.patientId) }));
    },

    confirmCampaignContact(req, res) {
        handle(res, () => {
            const notification = EngagementModel.confirmCampaignContact(parseInt(req.params.id, 10), req.patientId, toBool(req.body && req.body.confirmed));
            res.json({ success: true, notification });
        });
    }
};

module.exports = EngagementController;
