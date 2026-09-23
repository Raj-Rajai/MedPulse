// CRM-owned: patient profile card, head-of-family household management, hospital calling
const express = require('express');
const router = express.Router();
const C = require('../controllers/patient-portal.controller');
const { authenticatePatient, authenticateHospitalAdmin } = require('../middleware/auth.middleware');

// Profile card (auto-created at registration)
router.get('/patient/card', authenticatePatient, C.getCard);
router.put('/patient/profile', authenticatePatient, C.updateProfile);

// Family: read for every account in the family, write for the head of family only
router.get('/patient/family', authenticatePatient, C.getFamily);
router.put('/patient/family', authenticatePatient, C.updateFamily);
router.post('/patient/family/members', authenticatePatient, C.addMember);
router.put('/patient/family/members/:id', authenticatePatient, C.updateMember);
router.delete('/patient/family/members/:id', authenticatePatient, C.deleteMember);

// Hospital calling (patient side)
router.get('/patient/hospital', authenticatePatient, C.getHospital);
router.get('/patient/hospital-requests', authenticatePatient, C.listRequests);
router.post('/patient/hospital-requests', authenticatePatient, C.createRequest);
router.post('/patient/hospital-requests/:id/cancel', authenticatePatient, C.cancelRequest);
router.post('/patient/hospital-requests/:id/confirm', authenticatePatient, C.confirmRequest);

// HMS contract (see docs/api-contract.md). CRM owns these; the HMS team renders them in the hospital portal.
router.get('/crm/hospital/callback-requests', authenticateHospitalAdmin, C.hospitalQueue);
router.post('/crm/hospital/callback-requests/:id/status', authenticateHospitalAdmin, C.hospitalUpdate);

module.exports = router;
