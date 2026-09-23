const { db } = require('../config/db');

// Helper to convert SQLite object prototype results to clean objects
const clean = (row) => (row ? { ...row } : null);
const cleanList = (rows) => rows.map((r) => ({ ...r }));

/**
 * Authentication Middleware for Medical Students / Cadets
 */
function authenticateStudent(req, res, next) {
    const studentIdHeader = req.headers['x-student-id'];
    const rollHeader = req.headers['x-roll-number'];
    const authHeader = req.headers['authorization'];
    const queryStudentId = req.query.student_id;
    const queryRoll = req.query.roll_number;

    let student = null;

    if (studentIdHeader) {
        student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(studentIdHeader);
    } else if (rollHeader) {
        student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.roll_number = ?').get(rollHeader.toString().trim());
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenVal = authHeader.replace('Bearer ', '').trim();
        if (!isNaN(tokenVal)) {
            student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ? OR s.roll_number = ?').get(tokenVal, tokenVal);
        } else {
            student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.roll_number = ?').get(tokenVal);
        }
    } else if (queryStudentId) {
        student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(queryStudentId);
    } else if (queryRoll) {
        student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.roll_number = ?').get(queryRoll.toString().trim());
    }

    if (!student) {
        return res.status(401).json({ error: 'Authentication required. Please sign in to access MedPulse.' });
    }

    req.student = clean(student);
    req.studentId = student.id;
    req.rollNumber = student.roll_number;
    next();
}

/**
 * Authentication Middleware for University Super Admin & University Admins
 */
function authenticateAdmin(req, res, next) {
    const adminTokenHeader = req.headers['x-admin-token'];
    const adminIdHeader = req.headers['x-admin-id'];
    const authHeader = req.headers['authorization'];
    const queryToken = req.query.admin_token;
    const queryId = req.query.admin_id;

    let admin = null;

    if (adminIdHeader) {
        admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminIdHeader);
    } else if (adminTokenHeader) {
        const idFromToken = adminTokenHeader.replace('admin-', '').trim();
        admin = db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, adminTokenHeader);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenVal = authHeader.replace('Bearer ', '').trim();
        const idFromToken = tokenVal.replace('admin-', '').trim();
        admin = db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, tokenVal);
    } else if (queryId) {
        admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(queryId);
    } else if (queryToken) {
        const idFromToken = queryToken.replace('admin-', '').trim();
        admin = db.prepare('SELECT * FROM admins WHERE id = ? OR username = ?').get(idFromToken, queryToken);
    }

    if (!admin) {
        return res.status(401).json({ error: 'Administrative authorization required. Please sign in as Faculty / Admin.' });
    }

    req.admin = clean(admin);
    req.adminId = admin.id;
    next();
}

/**
 * Authentication Middleware for Patients (Independent & Dependents)
 */
function authenticatePatient(req, res, next) {
    const patientIdHeader = req.headers['x-patient-id'];
    const authHeader = req.headers['authorization'];
    const queryPatientId = req.query.patient_id;

    let patient = null;

    if (patientIdHeader) {
        patient = db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.id = ?
        `).get(patientIdHeader);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenVal = authHeader.replace('Bearer ', '').trim();
        const idFromToken = tokenVal.replace('patient-', '').trim();
        patient = db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.id = ? OR p.patient_uid = ?
        `).get(idFromToken, tokenVal);
    } else if (queryPatientId) {
        patient = db.prepare(`
            SELECT p.*, s.name as cadet_name, s.roll_number as cadet_roll, s.phone as cadet_phone, s.posting_unit as cadet_posting,
                   c.name as college_name, c.city as college_city
            FROM patients p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE p.id = ?
        `).get(queryPatientId);
    }

    if (!patient) {
        return res.status(401).json({ error: 'Patient authentication required. Please sign in to your patient account.' });
    }

    req.patient = clean(patient);
    req.patientId = patient.id;
    next();
}

/**
 * Authentication Middleware for Hospital Super Admins & Hospital Admins
 */
function authenticateHospitalAdmin(req, res, next) {
    const adminId = req.headers['x-hospital-admin-id'] || 
                    (req.headers.authorization && req.headers.authorization.startsWith('Bearer hosp-') ? 
                     req.headers.authorization.replace('Bearer hosp-', '').trim() : null);

    if (!adminId) {
        return res.status(401).json({ error: 'Hospital authentication required. Please sign in.' });
    }

    try {
        const admin = db.prepare(`
            SELECT ha.*, h.name as hospital_name, h.code as hospital_code, h.type as hospital_type, 
                   h.city as hospital_city, h.bed_capacity, h.max_super_admins, h.max_admins
            FROM hospital_admins ha
            JOIN hospitals h ON ha.hospital_id = h.id
            WHERE ha.id = ? AND ha.status = 'Active'
        `).get(adminId);

        if (!admin) {
            return res.status(401).json({ error: 'Hospital admin session invalid or expired.' });
        }

        req.hospitalAdmin = clean(admin);
        req.hospitalId = admin.hospital_id;
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Resource Multi-Tenant Scoping Verifiers
 */
function verifyFamilyAccess(familyId, studentId) {
    return db.prepare('SELECT id, student_id FROM families WHERE id = ? AND student_id = ?').get(familyId, studentId);
}

function verifyMemberAccess(memberId, studentId) {
    return db.prepare(`
        SELECT m.id, f.student_id 
        FROM family_members m 
        JOIN families f ON m.family_id = f.id 
        WHERE m.id = ? AND f.student_id = ?
    `).get(memberId, studentId);
}

function verifySubEntityAccess(table, id, studentId) {
    return db.prepare(`
        SELECT t.id, f.student_id 
        FROM ${table} t 
        JOIN family_members m ON t.member_id = m.id 
        JOIN families f ON m.family_id = f.id 
        WHERE t.id = ? AND f.student_id = ?
    `).get(id, studentId);
}

function verifyFollowUpAccess(fuId, studentId) {
    return db.prepare(`
        SELECT fu.id, f.student_id 
        FROM follow_ups fu 
        JOIN family_members m ON fu.member_id = m.id 
        JOIN families f ON m.family_id = f.id 
        WHERE fu.id = ? AND (f.student_id = ? OR fu.student_id = ?)
    `).get(fuId, studentId, studentId);
}

module.exports = {
    clean,
    cleanList,
    authenticateStudent,
    authenticateAdmin,
    authenticatePatient,
    authenticateHospitalAdmin,
    authenticateHospital: authenticateHospitalAdmin,
    verifyFamilyAccess,
    verifyMemberAccess,
    verifySubEntityAccess,
    verifyFollowUpAccess
};
