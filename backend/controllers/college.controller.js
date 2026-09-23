const CollegeModel = require('../models/college.model');

const CollegeController = {
    getColleges(req, res) {
        try {
            const colleges = CollegeModel.getAll();
            res.json(colleges);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = CollegeController;
