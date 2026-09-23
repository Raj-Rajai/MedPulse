const HospitalModel = require('../models/hospital.model');
const HospitalVisitModel = require('../models/hospital-visit.model');

const HospitalController = {
    login(req, res) {
        try {
            const { username, pin } = req.body;
            if (!username || !pin) {
                return res.status(400).json({ error: 'Username and security PIN are required.' });
            }

            const admin = HospitalModel.findByCredentials(username);
            if (!admin || admin.pin !== pin.trim()) {
                return res.status(401).json({ error: 'Invalid hospital credentials or incorrect PIN.' });
            }

            res.json({
                success: true,
                token: `hosp-${admin.id}`,
                admin: {
                    id: admin.id,
                    hospital_id: admin.hospital_id,
                    username: admin.username,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    role: admin.role,
                    department: admin.department,
                    hospital_name: admin.hospital_name,
                    hospital_code: admin.hospital_code,
                    hospital_type: admin.hospital_type,
                    hospital_city: admin.hospital_city
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getProfile(req, res) {
        try {
            res.json({
                success: true,
                admin: req.hospitalAdmin
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getStats(req, res) {
        try {
            const stats = HospitalModel.getStats(req.hospitalId);
            res.json(stats);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getFilterOptions(req, res) {
        try {
            const options = HospitalModel.getFilterOptions();
            res.json(options);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getPatients(req, res) {
        try {
            const hospitalId = req.hospitalId;
            const { university_id, student_id, model_type, condition, search, limit = 50, offset = 0 } = req.query;
            const patients = HospitalModel.getPatients(hospitalId, {
                university_id,
                student_id,
                model_type,
                condition,
                search,
                limit,
                offset
            });

            res.json({
                count: patients.length,
                patients
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getPatientDossier(req, res) {
        try {
            const patientId = req.params.id;
            const dossier = HospitalModel.getPatientDossier(patientId, req.hospitalId);
            if (!dossier || dossier.patient.hospital_id !== req.hospitalId) {
                return res.status(404).json({ error: 'Patient record not found.' });
            }
            res.json(dossier);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getStaff(req, res) {
        try {
            const staffData = HospitalModel.getStaff(req.hospitalId, req.hospitalAdmin);
            res.json(staffData);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createStaff(req, res) {
        try {
            const hospitalId = req.hospitalId;
            const { username, name, email, phone, pin = '8888', role = 'Hospital Admin', department = 'General Medicine' } = req.body;

            if (!username || !username.trim() || !name || !name.trim()) {
                return res.status(400).json({ error: 'Username and staff name are required.' });
            }

            const validRoles = ['Hospital Super Admin', 'Hospital Admin'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ error: 'Role must be Hospital Super Admin or Hospital Admin.' });
            }

            const result = HospitalModel.createStaff(hospitalId, req.hospitalAdmin, {
                username,
                name,
                email,
                phone,
                pin,
                role,
                department
            });

            if (result.quotaError) {
                return res.status(403).json({ error: result.message });
            }
            if (result.userConflict) {
                return res.status(409).json({ error: result.message });
            }

            res.status(201).json({
                success: true,
                message: `${result.role} "${result.name}" successfully appointed!`,
                staff_id: result.staff_id
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateStaff(req, res) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;
            const { name, email, phone, department, status } = req.body;

            const updated = HospitalModel.updateStaff(staffId, hospitalId, { name, email, phone, department, status });
            if (!updated) {
                return res.status(404).json({ error: 'Staff member not found.' });
            }

            res.json({ success: true, message: 'Hospital staff details updated successfully.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    resetStaffPin(req, res) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;
            const { pin } = req.body;

            if (!pin || pin.trim().length < 4) {
                return res.status(400).json({ error: 'Security PIN must be at least 4 digits.' });
            }

            const staff = HospitalModel.resetStaffPin(staffId, hospitalId, pin);
            if (!staff) {
                return res.status(404).json({ error: 'Staff member not found.' });
            }

            res.json({ success: true, message: `Security PIN reset successfully for ${staff.name}.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteStaff(req, res) {
        try {
            const staffId = req.params.id;
            const hospitalId = req.hospitalId;

            const result = HospitalModel.deleteStaff(staffId, hospitalId);
            if (result.notFound) {
                return res.status(404).json({ error: 'Staff member not found.' });
            }
            if (result.isLastSuperAdmin) {
                return res.status(400).json({ error: 'Cannot remove the only remaining Hospital Super Admin.' });
            }

            res.json({
                success: true,
                message: `Staff member "${result.staff.name}" removed and quota seat freed.`
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getVisits(req, res) {
        try {
            const { search, department, disposition, date, limit = 25, offset = 0 } = req.query;
            const result = HospitalVisitModel.listVisits(req.hospitalId, {
                search,
                department,
                disposition,
                date,
                limit,
                offset
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getVisitsSummary(req, res) {
        try {
            const summary = HospitalVisitModel.getSummary(req.hospitalId);
            res.json(summary);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createVisit(req, res) {
        try {
            const visit = HospitalVisitModel.createVisit(req.hospitalId, req.body, req.hospitalAdmin);
            res.status(201).json({
                success: true,
                message: `Patient ${visit.patient_name} registered successfully with ID ${visit.visit_uid}.`,
                visit
            });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },

    getVisitDetails(req, res) {
        try {
            const visit = HospitalVisitModel.getVisitById(req.hospitalId, req.params.id);
            if (!visit) {
                return res.status(404).json({ error: 'Hospital visit record not found.' });
            }
            res.json(visit);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = HospitalController;

