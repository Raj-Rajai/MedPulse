const express = require('express');
const router = express.Router();
const CollegeController = require('../controllers/college.controller');

router.get('/colleges', CollegeController.getColleges);

module.exports = router;
