const express = require('express');
const router = express.Router();
const HospitalController = require('../controllers/hospital.controller');
const { authenticateHospitalAdmin } = require('../middleware/auth.middleware');

router.post('/hospital/login', HospitalController.login);
router.get('/hospital/profile', authenticateHospitalAdmin, HospitalController.getProfile);
router.get('/hospital/stats', authenticateHospitalAdmin, HospitalController.getStats);
router.get('/hospital/filter-options', authenticateHospitalAdmin, HospitalController.getFilterOptions);
router.get('/hospital/patients', authenticateHospitalAdmin, HospitalController.getPatients);
router.get('/hospital/patients/:id', authenticateHospitalAdmin, HospitalController.getPatientDossier);
router.get('/hospital/staff', authenticateHospitalAdmin, HospitalController.getStaff);
router.post('/hospital/staff', authenticateHospitalAdmin, HospitalController.createStaff);
router.put('/hospital/staff/:id', authenticateHospitalAdmin, HospitalController.updateStaff);
router.post('/hospital/staff/:id/reset-pin', authenticateHospitalAdmin, HospitalController.resetStaffPin);
router.delete('/hospital/staff/:id', authenticateHospitalAdmin, HospitalController.deleteStaff);

module.exports = router;
