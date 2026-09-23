const PatientModel = require('../models/patient.model');

const PatientController = {
    verifyReferral(req, res) {
        try {
            const { referral_code } = req.body;
            if (!referral_code || !referral_code.toString().trim()) {
                return res.status(400).json({ valid: false, error: 'Referral code is required.' });
            }

            const student = PatientModel.verifyReferral(referral_code.toString().trim());
            if (!student) {
                return res.status(404).json({ valid: false, error: 'No medical cadet found with this referral code.' });
            }

            res.json({
                valid: true,
                student
            });
        } catch (err) {
            res.status(500).json({ valid: false, error: err.message });
        }
    },

    register(req, res) {
        try {
            const { name, phone, pin, email, gender, age_years, date_of_birth, address, is_adopted, referral_code } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Patient name is required.' });
            }
            if (!phone || !phone.trim()) {
                return res.status(400).json({ error: 'Contact phone number is required.' });
            }

            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10) {
                return res.status(400).json({ error: 'Please provide a valid 10-digit mobile phone number.' });
            }

            const result = PatientModel.register({
                name,
                phone,
                pin,
                email,
                gender,
                age_years,
                date_of_birth,
                address,
                is_adopted,
                referral_code
            });

            if (result.conflict) {
                return res.status(409).json({ error: result.message });
            }
            if (result.badRequest) {
                return res.status(400).json({ error: result.message });
            }

            res.status(201).json({
                success: true,
                message: `Patient account registered successfully as ${result.modelType}.`,
                patient: result.patient,
                token: result.token
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    login(req, res) {
        try {
            const { identifier, pin } = req.body;
            if (!identifier || !identifier.trim()) {
                return res.status(400).json({ error: 'Phone number or Patient ID is required.' });
            }
            if (!pin || !pin.trim()) {
                return res.status(400).json({ error: 'PIN / Passcode is required.' });
            }

            const result = PatientModel.login(identifier, pin);
            if (result.notFound) {
                return res.status(404).json({ error: 'No patient record found matching this Phone number or Patient ID.' });
            }
            if (result.invalidPin) {
                return res.status(401).json({ error: 'Invalid PIN / Passcode.' });
            }

            res.json({
                success: true,
                message: 'Signed in successfully.',
                patient: result.patient,
                token: result.token
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getProfile(req, res) {
        res.json(req.patient);
    },

    linkReferral(req, res) {
        try {
            const { referral_code } = req.body;
            if (!referral_code || !referral_code.trim()) {
                return res.status(400).json({ error: 'Referral code is required.' });
            }

            const result = PatientModel.linkReferral(req.patientId, referral_code, req.patient);
            if (result.notFound) {
                return res.status(404).json({ error: result.message });
            }

            res.json({
                success: true,
                message: `Successfully linked to Medical Cadet ${result.student.name} (${result.student.college_name})!`,
                patient: result.patient
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getRecords(req, res) {
        try {
            const records = PatientModel.getRecords(req.patient);
            res.json(records);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = PatientController;
