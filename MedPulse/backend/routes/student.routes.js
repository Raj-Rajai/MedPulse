const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/student.controller');
const { authenticateStudent } = require('../middleware/auth.middleware');

router.get('/students', authenticateStudent, StudentController.getStudents);
router.post('/students', authenticateStudent, StudentController.createStudent);
router.get('/students/profile', StudentController.getProfile);
router.put('/students/profile', authenticateStudent, StudentController.updateProfile);
router.post('/students/change-pin', authenticateStudent, StudentController.changePin);
router.post('/students/provision-patient', authenticateStudent, StudentController.provisionPatient);

module.exports = router;
