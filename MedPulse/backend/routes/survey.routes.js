const express = require('express');
const router = express.Router();
const SurveyController = require('../controllers/survey.controller');
const { authenticateStudent } = require('../middleware/auth.middleware');

// Household & Families Management
router.get('/families', authenticateStudent, SurveyController.getFamilies);
router.get('/families/:id', authenticateStudent, SurveyController.getFamilyById);
router.get('/families/:id/members', authenticateStudent, SurveyController.getFamilyMembers);
router.post('/families', authenticateStudent, SurveyController.createFamily);
router.put('/families/:id', authenticateStudent, SurveyController.updateFamily);
router.delete('/families/:id', authenticateStudent, SurveyController.deleteFamily);

// Members Management
router.post('/families/:id/members', authenticateStudent, SurveyController.addMember);
router.put('/members/:id', authenticateStudent, SurveyController.updateMember);
router.get('/members/:id', SurveyController.getMemberById);
router.delete('/members/:id', SurveyController.deleteMember);

// Conditions
router.get('/members/:id/conditions', authenticateStudent, SurveyController.getConditions);
router.post('/members/:id/conditions', authenticateStudent, SurveyController.createCondition);
router.put('/conditions/:id', authenticateStudent, SurveyController.updateCondition);
router.delete('/conditions/:id', authenticateStudent, SurveyController.deleteCondition);

// Medications
router.get('/members/:id/medications', authenticateStudent, SurveyController.getMedications);
router.post('/members/:id/medications', authenticateStudent, SurveyController.createMedication);
router.put('/medications/:id', authenticateStudent, SurveyController.updateMedication);
router.delete('/medications/:id', authenticateStudent, SurveyController.deleteMedication);

// Allergies
router.get('/members/:id/allergies', authenticateStudent, SurveyController.getAllergies);
router.post('/members/:id/allergies', authenticateStudent, SurveyController.createAllergy);
router.put('/allergies/:id', authenticateStudent, SurveyController.updateAllergy);
router.delete('/allergies/:id', authenticateStudent, SurveyController.deleteAllergy);

// Medical History
router.get('/members/:id/history', authenticateStudent, SurveyController.getHistory);
router.post('/members/:id/history', authenticateStudent, SurveyController.createHistory);
router.put('/history/:id', authenticateStudent, SurveyController.updateHistory);
router.delete('/history/:id', authenticateStudent, SurveyController.deleteHistory);

// Lifestyle
router.get('/members/:id/lifestyle', authenticateStudent, SurveyController.getLifestyle);
router.post('/members/:id/lifestyle', authenticateStudent, SurveyController.saveLifestyle);

// Follow-Ups
router.post('/members/:id/follow-ups', authenticateStudent, SurveyController.createFollowUp);
router.delete('/follow-ups/:id', authenticateStudent, SurveyController.deleteFollowUp);

// Epidemiological Analytics
router.get('/analytics/summary', authenticateStudent, SurveyController.getAnalyticsSummary);
router.get('/analytics/charts', authenticateStudent, SurveyController.getAnalyticsCharts);
router.get('/analytics/report/:reportId', authenticateStudent, SurveyController.getAnalyticsReport);

// Exports
router.get('/export/csv', authenticateStudent, SurveyController.exportCsv);
router.get('/export/pdf', authenticateStudent, SurveyController.exportPdf);
router.get('/export/data', authenticateStudent, SurveyController.exportData);

module.exports = router;
