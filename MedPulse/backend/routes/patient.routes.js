const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/patient.controller');
const { authenticatePatient } = require('../middleware/auth.middleware');

router.post('/patient/verify-referral', PatientController.verifyReferral);
router.post('/patient/register', PatientController.register);
router.post('/patient/login', PatientController.login);
router.get('/patient/profile', authenticatePatient, PatientController.getProfile);
router.post('/patient/link-referral', authenticatePatient, PatientController.linkReferral);
router.get('/patient/records', authenticatePatient, PatientController.getRecords);

module.exports = router;
