const StudentModel = require('../models/student.model');
const { clean } = require('../middleware/auth.middleware');

const AuthController = {
    register(req, res) {
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

            if (!roll_number || !roll_number.toString().trim()) {
                return res.status(400).json({ error: 'Student Roll Number is required' });
            }
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Student full name is required' });
            }

            const cleanRoll = roll_number.toString().trim();
            const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';

            if (cleanPin.length < 4) {
                return res.status(400).json({ error: 'PIN / Passcode must be at least 4 characters' });
            }

            const existing = StudentModel.findByRoll(cleanRoll);
            if (existing) {
                return res.status(409).json({ error: `Student with Roll Number "${cleanRoll}" is already registered. Please sign in instead.` });
            }

            const newStudent = StudentModel.create({
                roll_number: cleanRoll,
                name,
                pin: cleanPin,
                email,
                phone,
                batch_year,
                posting_unit,
                college_id,
                status
            });

            res.status(201).json({
                success: true,
                message: 'Student registration completed successfully',
                student: newStudent
            });
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Student with this Roll Number is already registered' });
            }
            res.status(500).json({ error: err.message });
        }
    },

    login(req, res) {
        try {
            const { roll_number, pin } = req.body;
            if (!roll_number) {
                return res.status(400).json({ error: 'Roll number is required' });
            }

            const student = StudentModel.findByRoll(roll_number.trim());
            if (!student) {
                return res.status(404).json({ error: 'Student with Roll Number ' + roll_number + ' not found' });
            }

            const expectedPin = student.pin || '1234';
            if (pin && pin.trim() !== expectedPin) {
                return res.status(401).json({ error: 'Invalid PIN / Password' });
            }

            res.json({
                success: true,
                student
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    me(req, res) {
        try {
            const { roll_number, id } = req.query;
            let student = null;
            if (id) {
                student = StudentModel.findById(id);
            } else if (roll_number) {
                student = StudentModel.findByRoll(roll_number);
            }

            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }

            res.json(student);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = AuthController;
