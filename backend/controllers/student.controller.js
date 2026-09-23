const StudentModel = require('../models/student.model');

const StudentController = {
    getStudents(req, res) {
        try {
            const rows = StudentModel.getAll();
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    createStudent(req, res) {
        try {
            const {
                roll_number,
                name,
                pin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status
            } = req.body;

            if (!roll_number || !name) {
                return res.status(400).json({ error: 'Roll number and student name are required' });
            }

            const cleanRoll = roll_number.toString().trim();
            const existing = StudentModel.findByRoll(cleanRoll);
            if (existing) {
                return res.status(409).json({ error: 'Student with this Roll Number already exists' });
            }

            const newStudent = StudentModel.create({
                roll_number: cleanRoll,
                name,
                pin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status
            });

            res.status(201).json({ id: newStudent.id, ...newStudent });
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Student with this Roll Number already exists' });
            }
            res.status(500).json({ error: err.message });
        }
    },

    getProfile(req, res) {
        try {
            const { roll_number, student_id } = req.query;
            const profileData = StudentModel.getProfile(student_id, roll_number);
            if (!profileData) {
                return res.status(404).json({ error: 'Student record not found' });
            }
            res.json(profileData);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    updateProfile(req, res) {
        try {
            const sid = req.studentId;
            const { name, email, phone, batch_year, posting_unit } = req.body;
            const updated = StudentModel.updateProfile(sid, { name, email, phone, batch_year, posting_unit });
            res.json({
                success: true,
                message: 'Profile updated successfully',
                student: updated
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    changePin(req, res) {
        try {
            const sid = req.studentId;
            const { current_pin, new_pin } = req.body;
            if (!current_pin || !new_pin) {
                return res.status(400).json({ error: 'Both current PIN and new PIN are required' });
            }
            if (new_pin.trim().length < 4) {
                return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
            }

            const result = StudentModel.changePin(sid, current_pin, new_pin);
            if (result.notFound) {
                return res.status(404).json({ error: 'Student not found' });
            }
            if (result.invalidPin) {
                return res.status(401).json({ error: 'Current PIN is incorrect' });
            }

            res.json({
                success: true,
                message: 'PIN successfully changed'
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    provisionPatient(req, res) {
        try {
            const { member_id, phone, pin, name } = req.body;
            if (!member_id) {
                return res.status(400).json({ error: 'Family member ID is required.' });
            }

            const result = StudentModel.provisionPatient(req.studentId, req.student.referral_code, {
                member_id,
                phone,
                pin,
                name
            });

            if (result.forbidden) {
                return res.status(403).json({ error: 'Family member not found in your assigned households.' });
            }

            if (result.alreadyExists) {
                return res.json({
                    success: true,
                    message: result.message,
                    patient_uid: result.patient_uid,
                    phone: result.phone,
                    pin: result.pin,
                    name: result.name
                });
            }

            res.status(201).json({
                success: true,
                message: `Patient account created successfully for ${result.name}!`,
                patient_uid: result.patient_uid,
                phone: result.phone,
                pin: result.pin,
                name: result.name
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = StudentController;
