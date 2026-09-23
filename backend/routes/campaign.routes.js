const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/campaign.controller');
const { authenticateAdmin, authenticatePatient, authenticateStudent } = require('../middleware/auth.middleware');

// Public / General Campaign Listing
router.get('/campaigns', CampaignController.listCampaigns);

// Faculty Admin Campaign Management
router.get('/campaigns/preview', authenticateAdmin, CampaignController.previewMatching);
router.post('/campaigns/preview', authenticateAdmin, CampaignController.previewMatching);
router.post('/campaigns', authenticateAdmin, CampaignController.createCampaign);
router.get('/campaigns/:id', authenticateAdmin, CampaignController.getCampaignDetails);
router.post('/campaigns/:id/dispatch', authenticateAdmin, CampaignController.dispatchCampaign);

// Patient CRM Notifications (Decision-Diamond Engine: Only condition-matched patients)
router.get('/patient/notifications', authenticatePatient, CampaignController.getPatientNotifications);
router.post('/patient/notifications/:id/acknowledge', authenticatePatient, CampaignController.acknowledgeNotification);

// Medical Cadet (Student) Campaign Coordination Tasks
router.get('/student/campaign-tasks', authenticateStudent, CampaignController.getCadetTasks);
router.post('/student/campaign-tasks/:id/status', authenticateStudent, CampaignController.updateCadetTask);

module.exports = router;
