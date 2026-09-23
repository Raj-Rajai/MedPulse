const express = require('express');
const router = express.Router();

const collegeRoutes = require('./college.routes');
const authRoutes = require('./auth.routes');
const studentRoutes = require('./student.routes');
const adminRoutes = require('./admin.routes');
const patientRoutes = require('./patient.routes');
const hospitalRoutes = require('./hospital.routes');
const surveyRoutes = require('./survey.routes');

router.use(collegeRoutes);
router.use(authRoutes);
router.use(studentRoutes);
router.use(adminRoutes);
router.use(patientRoutes);
router.use(hospitalRoutes);
router.use(surveyRoutes);

module.exports = router;
