const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

// Authentication & Profile
router.post('/admin/login', AdminController.login);
router.get('/admin/me', authenticateAdmin, AdminController.me);

// Overview & Statistics
router.get('/admin/stats', authenticateAdmin, AdminController.getStats);

// Student Cadre Management
router.get('/admin/students', authenticateAdmin, AdminController.getStudents);
router.post('/admin/students', authenticateAdmin, AdminController.createStudent);
router.put('/admin/students/:id', authenticateAdmin, AdminController.updateStudent);
router.post('/admin/students/:id/reset-pin', authenticateAdmin, AdminController.resetStudentPin);
router.delete('/admin/students/:id', authenticateAdmin, AdminController.deleteStudent);
router.get('/admin/students/:id/families', authenticateAdmin, AdminController.getStudentFamilies);

// Cross-Cadet Household & Population Surveillance
router.get('/admin/families', authenticateAdmin, AdminController.getFamilies);
router.get('/admin/members', authenticateAdmin, AdminController.getMembers);

// College & Institutional Administration
router.get('/admin/colleges', authenticateAdmin, AdminController.getColleges);
router.post('/admin/colleges', authenticateAdmin, AdminController.createCollege);
router.put('/admin/colleges/:id', authenticateAdmin, AdminController.updateCollege);

// Master Exports & Faculty Audit
router.get('/admin/export/all-csv', authenticateAdmin, AdminController.exportAllCsv);
router.get('/admin/export/audit-pdf', authenticateAdmin, AdminController.exportAuditPdf);

// University Admins & Quota Hierarchy
router.get('/admin/university-admins', authenticateAdmin, AdminController.getUniversityAdmins);
router.post('/admin/university-admins', authenticateAdmin, AdminController.createUniversityAdmin);
router.put('/admin/university-admins/:id', authenticateAdmin, AdminController.updateUniversityAdmin);
router.post('/admin/university-admins/:id/reset-pin', authenticateAdmin, AdminController.resetUniversityAdminPin);
router.delete('/admin/university-admins/:id', authenticateAdmin, AdminController.deleteUniversityAdmin);

module.exports = router;
