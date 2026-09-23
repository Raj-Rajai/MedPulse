const AdminModel = require('../models/admin.model');
const CollegeModel = require('../models/college.model');
const { generateMasterCsv, generateFacultyAuditPdfStream } = require('../services/export.service');

const AdminController = {
    login(req, res) {
        try {
            const { username, pin } = req.body;
            if (!username || !pin) {
                return res.status(400).json({ error: 'Admin username and PIN are required' });
            }

            const admin = AdminModel.findByUsername(username);
            if (!admin) {
                return res.status(401).json({ error: 'Invalid admin username or account not found' });
            }
            if (admin.pin !== pin.trim()) {
                return res.status(401).json({ error: 'Invalid administrator PIN / Password' });
            }

            res.json({
                success: true,
                admin,
                token: `admin-${admin.id}`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    me(req, res) {
        res.json({ admin: req.admin });
    },

    getStats(req, res) {
        try {
            const stats = AdminModel.getStats();
            res.json(stats);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getStudents(req, res) {
        try {
            const { college_id, status, search } = req.query;
            const students = AdminModel.getStudents({ college_id, status, search });
            res.json(students);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createStudent(req, res) {
        try {
            const { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status } = req.body;
            if (!roll_number || !name) {
                return res.status(400).json({ error: 'Roll number and student name are required' });
            }

            const result = AdminModel.createStudent(
                { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status },
                req.admin
            );

            if (result.conflict) {
                return res.status(409).json({ error: result.message });
            }

            res.status(201).json({ success: true, student: result.student });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateStudent(req, res) {
        try {
            const studentId = req.params.id;
            const { name, email, phone, batch_year, posting_unit, college_id, status } = req.body;
            const updated = AdminModel.updateStudent(studentId, { name, email, phone, batch_year, posting_unit, college_id, status });
            if (!updated) {
                return res.status(404).json({ error: 'Cadet record not found' });
            }
            res.json({ success: true, student: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    resetStudentPin(req, res) {
        try {
            const studentId = req.params.id;
            const newPin = req.body.new_pin ? req.body.new_pin.toString().trim() : '1234';
            if (newPin.length < 4) {
                return res.status(400).json({ error: 'PIN must be at least 4 digits' });
            }

            const student = AdminModel.resetStudentPin(studentId, newPin);
            if (!student) {
                return res.status(404).json({ error: 'Cadet record not found' });
            }

            res.json({
                success: true,
                message: `PIN for Cadet ${student.name} (Roll ${student.roll_number}) reset to "${newPin}".`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteStudent(req, res) {
        try {
            const studentId = req.params.id;
            const deleted = AdminModel.deleteStudent(studentId);
            if (!deleted) {
                return res.status(404).json({ error: 'Cadet record not found' });
            }

            res.json({
                success: true,
                message: `Cadet ${deleted.name} (Roll ${deleted.roll_number}) and all associated survey records deleted.`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getStudentFamilies(req, res) {
        try {
            const studentId = req.params.id;
            const result = AdminModel.getStudentFamilies(studentId);
            if (!result) {
                return res.status(404).json({ error: 'Cadet record not found' });
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getFamilies(req, res) {
        try {
            const { student_id, college_id, village, search } = req.query;
            const families = AdminModel.getFamilies({ student_id, college_id, village, search });
            res.json(families);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getMembers(req, res) {
        try {
            const { has_htn, has_dm, has_anaemia, search } = req.query;
            const members = AdminModel.getMembers({ has_htn, has_dm, has_anaemia, search });
            res.json(members);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getColleges(req, res) {
        try {
            const colleges = CollegeModel.getAdminOverview();
            res.json(colleges);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createCollege(req, res) {
        try {
            const { name, code, city, state } = req.body;
            if (!name || !code) {
                return res.status(400).json({ error: 'College name and institutional code are required' });
            }

            const existing = CollegeModel.getByCode(code);
            if (existing) {
                return res.status(409).json({ error: `Medical institution with code "${code.trim()}" already exists` });
            }

            const newCol = CollegeModel.create({ name, code, city, state });
            res.status(201).json({ success: true, college: newCol });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateCollege(req, res) {
        try {
            const { name, code, city, state } = req.body;
            const colId = req.params.id;
            const updated = CollegeModel.update(colId, { name, code, city, state });
            res.json({ success: true, college: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    exportAllCsv(req, res) {
        try {
            const csvData = generateMasterCsv(req.query.college_id ? Number(req.query.college_id) : null);
            const filename = `MedPulse_Master_Survey_Compilation_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvData);
        } catch (err) {
            console.error('Master CSV Export Error:', err);
            res.status(500).json({ error: 'Failed to generate Master CSV: ' + err.message });
        }
    },

    exportAuditPdf(req, res) {
        try {
            const filename = `MedPulse_Faculty_Surveillance_Audit_${new Date().toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            generateFacultyAuditPdfStream(res);
        } catch (err) {
            console.error('Faculty Audit PDF Error:', err);
            res.status(500).json({ error: 'Failed to generate Audit PDF: ' + err.message });
        }
    },

    getUniversityAdmins(req, res) {
        try {
            const uniId = req.query.university_id ? Number(req.query.university_id) : (req.admin.university_id || 1);
            const data = AdminModel.getUniversityAdmins(uniId);
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createUniversityAdmin(req, res) {
        try {
            const { username, name, pin, email, phone, role, university_id, status } = req.body;
            if (!username || !name) {
                return res.status(400).json({ error: 'Admin username and full name are required' });
            }

            const result = AdminModel.createUniversityAdmin(
                { username, name, pin, email, phone, role, university_id, status },
                req.admin
            );

            if (result.notFound) {
                return res.status(404).json({ error: result.message });
            }
            if (result.conflict) {
                return res.status(409).json({ error: result.message });
            }
            if (result.quotaExceeded) {
                return res.status(403).json({ error: result.message });
            }
            if (result.userConflict) {
                return res.status(409).json({ error: result.message });
            }

            res.status(201).json({
                success: true,
                message: `University Admin "${name.trim()}" registered successfully under ${result.collegeName}.`,
                admin: result.admin
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateUniversityAdmin(req, res) {
        try {
            const adminId = req.params.id;
            const { name, email, phone, status } = req.body;
            const updated = AdminModel.updateUniversityAdmin(adminId, { name, email, phone, status });
            if (!updated) {
                return res.status(404).json({ error: 'University Admin record not found' });
            }
            res.json({ success: true, admin: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    resetUniversityAdminPin(req, res) {
        try {
            const adminId = req.params.id;
            const newPin = req.body.new_pin ? req.body.new_pin.toString().trim() : '9999';
            if (newPin.length < 4) {
                return res.status(400).json({ error: 'Admin PIN must be at least 4 digits' });
            }

            const target = AdminModel.resetUniversityAdminPin(adminId, newPin);
            if (!target) {
                return res.status(404).json({ error: 'University Admin record not found' });
            }

            res.json({
                success: true,
                message: `PIN for Administrator ${target.name} (${target.username}) has been reset to "${newPin}".`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteUniversityAdmin(req, res) {
        try {
            const adminId = req.params.id;
            const result = AdminModel.deleteUniversityAdmin(adminId);
            if (result.notFound) {
                return res.status(404).json({ error: 'University Admin record not found' });
            }
            if (result.isSuperAdmin) {
                return res.status(400).json({ error: 'Cannot delete the designated University Super Admin account.' });
            }

            res.json({
                success: true,
                message: `University Admin ${result.target.name} (${result.target.username}) removed successfully.`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = AdminController;
