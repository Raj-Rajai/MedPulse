const PatientFamilyModel = require('../models/patient-family.model');
const HospitalCallbackModel = require('../models/hospital-callback.model');

// Known model errors carry an HTTP status; anything else is a 500
function handle(res, fn) {
    try {
        return fn();
    } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        return res.status(status).json({ error: err.message });
    }
}
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';
const id = (req) => parseInt(req.params.id, 10);

const PatientPortalController = {
    /* ---- Profile card ---- */
    getCard(req, res) {
        handle(res, () => res.json({ success: true, card: PatientFamilyModel.getCard(req.patientId) }));
    },
    updateProfile(req, res) {
        handle(res, () => res.json({ success: true, message: 'Profile updated.', card: PatientFamilyModel.updateProfile(req.patientId, req.body || {}) }));
    },

    /* ---- Family (head of family) ---- */
    getFamily(req, res) {
        handle(res, () => res.json({ success: true, ...PatientFamilyModel.getFamily(req.patientId) }));
    },
    updateFamily(req, res) {
        handle(res, () => res.json({ success: true, message: 'Family details saved.', ...PatientFamilyModel.updateFamily(req.patientId, req.body || {}) }));
    },
    addMember(req, res) {
        handle(res, () => res.status(201).json({ success: true, message: 'Family member added.', ...PatientFamilyModel.addMember(req.patientId, req.body || {}) }));
    },
    updateMember(req, res) {
        handle(res, () => res.json({ success: true, message: 'Family member updated.', ...PatientFamilyModel.updateMember(req.patientId, id(req), req.body || {}) }));
    },
    deleteMember(req, res) {
        handle(res, () => res.json({ success: true, message: 'Family member removed.', ...PatientFamilyModel.deleteMember(req.patientId, id(req)) }));
    },

    /* ---- Hospital calling ---- */
    getHospital(req, res) {
        handle(res, () => res.json({
            success: true,
            hospital: HospitalCallbackModel.getHospitalForPatient(req.patient),
            departments: HospitalCallbackModel.DEPARTMENTS,
            reasons: HospitalCallbackModel.REASONS
        }));
    },
    listRequests(req, res) {
        handle(res, () => {
            const requests = HospitalCallbackModel.listForPatient(req.patientId);
            res.json({ success: true, total: requests.length, requests });
        });
    },
    createRequest(req, res) {
        handle(res, () => res.status(201).json({ success: true, message: 'Request sent to the hospital.', request: HospitalCallbackModel.create(req.patient, req.body || {}) }));
    },
    cancelRequest(req, res) {
        handle(res, () => res.json({ success: true, request: HospitalCallbackModel.cancel(id(req), req.patientId) }));
    },
    confirmRequest(req, res) {
        handle(res, () => res.json({ success: true, request: HospitalCallbackModel.confirm(id(req), req.patientId, toBool(req.body && req.body.confirmed)) }));
    },

    /* ---- HMS contract: hospital admins work the callback queue ---- */
    hospitalQueue(req, res) {
        handle(res, () => {
            const requests = HospitalCallbackModel.listForHospital(req.hospitalId, req.query.status || 'Active');
            res.json({ success: true, open_count: requests.filter((r) => r.status === 'Open').length, total: requests.length, requests });
        });
    },
    hospitalUpdate(req, res) {
        handle(res, () => res.json({ success: true, request: HospitalCallbackModel.updateByHospital(id(req), req.hospitalAdmin, req.body || {}) }));
    }
};

module.exports = PatientPortalController;
