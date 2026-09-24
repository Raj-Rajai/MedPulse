const router = require('express').Router();
const { db } = require('../config/db');
const { authenticateAdmin, authenticateStudent } = require('../middleware/auth.middleware');
const { validArea, checkLocation } = require('../services/geofence.service');
function getArea(collegeId) {
    return db.prepare('SELECT name, latitude, longitude, radius FROM student_geofences WHERE scope_id = ? OR scope_id = 0 ORDER BY scope_id DESC LIMIT 1').get(collegeId || 0) || null;
}
router.get('/admin/geofence', authenticateAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ area: getArea(req.admin.college_id), scope: req.admin.college_id ? 'Your college' : 'Default for all colleges' });
});
router.put('/admin/geofence', authenticateAdmin, (req, res) => {
    if (!validArea(req.body)) return res.status(400).json({ error: 'Enter a village name, valid latitude and longitude, and a radius from 25 to 50,000 metres.' });
    const { name, latitude, longitude, radius } = req.body;
    db.prepare(`INSERT INTO student_geofences (scope_id, name, latitude, longitude, radius, updated_by)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(scope_id) DO UPDATE SET
        name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude,
        radius=excluded.radius, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
        .run(req.admin.college_id || 0, name.trim(), latitude, longitude, radius, req.admin.id);
    res.json({ success: true });
});
router.get('/student/geofence', authenticateStudent, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ area: getArea(req.student.college_id) });
});
router.post('/student/geofence/check', authenticateStudent, (req, res) => {
    const error = checkLocation(getArea(req.student.college_id), req.body);
    res.status(error ? 403 : 200).json(error ? { error } : { success: true });
});
module.exports = router;
module.exports.getArea = getArea;
