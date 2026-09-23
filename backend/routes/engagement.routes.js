// CRM-owned: Patient engagement with health campaigns (RSVP + campaign call confirmation)
const express = require('express');
const router = express.Router();
const EngagementController = require('../controllers/engagement.controller');
const { authenticatePatient } = require('../middleware/auth.middleware');

router.post('/patient/notifications/mark-read', authenticatePatient, EngagementController.markRead);
router.post('/patient/notifications/:id/rsvp', authenticatePatient, EngagementController.rsvp);
router.post('/patient/notifications/:id/confirm-contact', authenticatePatient, EngagementController.confirmCampaignContact);

module.exports = router;
