const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const router = express.Router();
const { authenticateStudent } = require('../middleware/auth.middleware');
const { isFieldWrite, checkLocation } = require('../services/geofence.service');
const { getArea } = require('./geofence.routes');

// Enforce field location before any mutation handler, including direct API requests.
router.use((req, res, next) => {
    if (!isFieldWrite(req.method, req.path)) return next();
    authenticateStudent(req, res, () => {
        let location;
        try { location = JSON.parse(req.get('X-Field-Location') || 'null'); } catch (_) { location = null; }
        const error = checkLocation(getArea(req.student.college_id), location);
        if (error) return res.status(403).json({ error, code: 'LOCATION_REQUIRED' });
        next();
    });
});

// Auto-mount every *.routes.js file in this folder.
// Adding a new module (CRM or HMS) never requires editing this file.
fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.routes.js'))
    .sort()
    .forEach((f) => router.use(require(path.join(__dirname, f))));

module.exports = router;
