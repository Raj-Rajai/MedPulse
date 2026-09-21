const express = require('express');
const router = express.Router();
const { db } = require('./db');
const { generateCsv, generatePdfStream, getStudentExportData, generateMasterCsv, generateFacultyAuditPdfStream } = require('./export-service');

// Helper to convert SQLite object prototype results to clean objects
const clean = (row) => (row ? { ...row } : null);
const cleanList = (rows) => rows.map((r) => ({ ...r }));

// -------------------------------------------------------------
// Authentication & Multi-Tenant Scoping Middleware
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 1. Colleges & Students
// -------------------------------------------------------------
router.get('/colleges', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM colleges ORDER BY name ASC').all();
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/students', authenticateStudent, (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT s.*, c.name as college_name,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            ORDER BY s.roll_number ASC
        `).all();
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/students', authenticateStudent, (req, res) => {
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
        const cleanName = name.trim();
        const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';
        const cleanEmail = email ? email.trim() : null;
        const cleanPhone = phone ? phone.trim() : null;
        const cleanBatch = batch_year && batch_year.trim() ? batch_year.trim() : '3rd Year MBBS (Community Medicine)';
        const cleanUnit = posting_unit && posting_unit.trim() ? posting_unit.trim() : 'RHTC - Rural Health Training Center';
        const cleanCollege = college_id ? Number(college_id) : 1;
        const cleanStatus = status && status.trim() ? status.trim() : 'Active';

        const stmt = db.prepare(`
            INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanRoll,
            cleanName,
            cleanPin,
            cleanEmail,
            cleanPhone,
            cleanBatch,
            cleanUnit,
            cleanCollege,
            cleanStatus
        );

        const newStudent = db.prepare(`
            SELECT s.*, c.name as college_name
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE s.id = ?
        `).get(Number(result.lastInsertRowid));

        res.status(201).json({ id: Number(result.lastInsertRowid), ...clean(newStudent) });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Student with this Roll Number already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Student Self-Registration
router.post('/auth/register', (req, res) => {
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
        const cleanName = name.trim();
        const cleanPin = pin && pin.toString().trim() ? pin.toString().trim() : '1234';
        const cleanEmail = email && email.trim() ? email.trim() : null;
        const cleanPhone = phone && phone.trim() ? phone.trim() : null;
        const cleanBatch = batch_year && batch_year.trim() ? batch_year.trim() : '3rd Year MBBS (Community Medicine)';
        const cleanUnit = posting_unit && posting_unit.trim() ? posting_unit.trim() : 'RHTC - Rural Health Training Center';
        const cleanCollege = college_id ? Number(college_id) : 1;
        const cleanStatus = status && status.trim() ? status.trim() : 'Active';

        if (cleanPin.length < 4) {
            return res.status(400).json({ error: 'PIN / Passcode must be at least 4 characters' });
        }

        // Check if student with this roll number already exists
        const existing = db.prepare('SELECT id, roll_number FROM students WHERE LOWER(roll_number) = LOWER(?)').get(cleanRoll);
        if (existing) {
            return res.status(409).json({ error: `Student with Roll Number "${cleanRoll}" is already registered. Please sign in instead.` });
        }

        const stmt = db.prepare(`
            INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanRoll,
            cleanName,
            cleanPin,
            cleanEmail,
            cleanPhone,
            cleanBatch,
            cleanUnit,
            cleanCollege,
            cleanStatus
        );

        const newStudent = db.prepare(`
            SELECT s.*, c.name as college_name
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE s.id = ?
        `).get(Number(result.lastInsertRowid));

        const studentClean = clean(newStudent);

        res.status(201).json({
            success: true,
            message: 'Student registration completed successfully',
            student: studentClean
        });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Student with this Roll Number is already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Student Authentication
router.post('/auth/login', (req, res) => {
    try {
        const { roll_number, pin } = req.body;
        if (!roll_number) {
            return res.status(400).json({ error: 'Roll number is required' });
        }

        const student = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.roll_number = ?
        `).get(roll_number.trim());

        if (!student) {
            return res.status(404).json({ error: 'Student with Roll Number ' + roll_number + ' not found' });
        }

        // Check PIN (default '1234' if none set)
        const expectedPin = student.pin || '1234';
        if (pin && pin.trim() !== expectedPin) {
            return res.status(401).json({ error: 'Invalid PIN / Password' });
        }

        res.json({
            success: true,
            student: clean(student)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/auth/me', (req, res) => {
    try {
        const { roll_number, id } = req.query;
        let student = null;
        if (id) {
            student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(id);
        } else if (roll_number) {
            student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.roll_number = ?').get(roll_number);
        }
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(clean(student));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete Student Profile & Clinical Portfolio Aggregation
router.get('/students/profile', (req, res) => {
    try {
        const { roll_number, student_id } = req.query;
        let student = null;
        if (student_id) {
            student = db.prepare(`
                SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                WHERE s.id = ?
            `).get(student_id);
        } else if (roll_number) {
            student = db.prepare(`
                SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                WHERE s.roll_number = ?
            `).get(roll_number.trim());
        } else {
            student = db.prepare(`
                SELECT s.*, c.name as college_name, c.code as college_code, c.city as college_city, c.state as college_state
                FROM students s
                LEFT JOIN colleges c ON s.college_id = c.id
                ORDER BY s.id ASC LIMIT 1
            `).get();
        }

        if (!student) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        const sid = student.id;

        // Aggregated Clinical Statistics
        const statsRow = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM families WHERE student_id = ?) as total_families,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_members,
                (SELECT COUNT(m.id) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = ? AND (m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL OR m.anc_taken != 'NA' OR m.is_underweight != 'NA')) as completed_surveys,
                (SELECT COUNT(*) FROM follow_ups WHERE student_id = ?) as total_followups,
                (SELECT COUNT(c.id) FROM member_conditions c JOIN family_members m ON c.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_conditions,
                (SELECT COUNT(med.id) FROM member_medications med JOIN family_members m ON med.member_id = m.id JOIN families f ON m.family_id = f.id WHERE f.student_id = ?) as total_medications
        `).get(sid, sid, sid, sid, sid, sid);

        // Assigned Families Directory
        const families = db.prepare(`
            SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.family_name, 
                   f.village_ward, f.village, f.contact_number, f.total_cu, f.calorie_status,
                   COUNT(m.id) as member_count,
                   SUM(CASE WHEN m.has_htn != 'NA' OR m.has_dm != 'NA' OR m.bmi IS NOT NULL THEN 1 ELSE 0 END) as surveyed_members
            FROM families f
            LEFT JOIN family_members m ON f.id = m.family_id
            WHERE f.student_id = ?
            GROUP BY f.id
            ORDER BY f.family_no ASC
        `).all(sid);

        // Recent Clinical Activity (Follow-ups, Diagnoses)
        const recentActivity = db.prepare(`
            SELECT v.id, v.visit_date, v.visit_number, v.sbp, v.dbp, v.rbs, v.health_progress, v.treatment_compliance, v.clinical_notes,
                   m.name as member_name, m.relation_to_hof, m.gender, m.age_years,
                   f.id as family_id, f.family_code, f.head_of_family
            FROM follow_ups v
            JOIN family_members m ON v.member_id = m.id
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ?
            ORDER BY v.visit_date DESC, v.id DESC
            LIMIT 10
        `).all(sid);

        // Don't expose plaintext PIN in profile payload
        const studentClean = clean(student);
        delete studentClean.pin;

        res.json({
            student: studentClean,
            stats: clean(statsRow),
            families: cleanList(families),
            recentActivity: cleanList(recentActivity)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Student Profile Information
router.put('/students/profile', authenticateStudent, (req, res) => {
    try {
        const sid = req.studentId;
        const { name, email, phone, batch_year, posting_unit } = req.body;

        db.prepare(`
            UPDATE students
            SET name = COALESCE(?, name),
                email = ?,
                phone = ?,
                batch_year = COALESCE(?, batch_year),
                posting_unit = COALESCE(?, posting_unit)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            sid
        );

        const updated = db.prepare(`
            SELECT s.*, c.name as college_name, c.city as college_city, c.state as college_state
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE s.id = ?
        `).get(sid);

        const updatedClean = clean(updated);
        delete updatedClean.pin;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            student: updatedClean
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student PIN / Password Change
router.post('/students/change-pin', authenticateStudent, (req, res) => {
    try {
        const sid = req.studentId;
        const { current_pin, new_pin } = req.body;
        if (!current_pin || !new_pin) {
            return res.status(400).json({ error: 'Both current PIN and new PIN are required' });
        }
        if (new_pin.trim().length < 4) {
            return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
        }

        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const expectedPin = student.pin || '1234';
        if (current_pin.trim() !== expectedPin) {
            return res.status(401).json({ error: 'Current PIN is incorrect' });
        }

        db.prepare('UPDATE students SET pin = ? WHERE id = ?').run(new_pin.trim(), student.id);

        res.json({
            success: true,
            message: 'PIN successfully changed'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 2. Families & Family Members
// -------------------------------------------------------------
// 2. Families & Household Management
// -------------------------------------------------------------

router.get('/families', authenticateStudent, (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name,
                   COUNT(DISTINCT m.id) as member_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN family_members m ON f.id = m.family_id
            WHERE f.student_id = ?
        `;
        const params = [req.studentId];

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            query += ' AND (f.family_code LIKE ? OR f.head_of_family LIKE ? OR f.family_name LIKE ? OR f.contact_number LIKE ? OR f.village LIKE ? OR f.village_ward LIKE ?)';
            params.push(s, s, s, s, s, s);
        }

        query += ' GROUP BY f.id ORDER BY f.id DESC';

        const rows = db.prepare(query).all(...params);
        const mapped = rows.map(rawR => {
            const r = clean(rawR);
            const phone = r.contact_number || r.contact_phone || null;
            return {
                ...r,
                contact_phone: phone,
                contact_number: phone
            };
        });
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/families/:id', authenticateStudent, (req, res) => {
    try {
        const familyId = req.params.id;
        const family = db.prepare(`
            SELECT f.*, s.roll_number, s.name as student_name
            FROM families f
            JOIN students s ON f.student_id = s.id
            WHERE f.id = ?
        `).get(familyId);

        if (!family) {
            return res.status(404).json({ error: 'Family not found' });
        }

        if (family.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. This household record belongs to another student cadre.' });
        }

        const members = db.prepare(`
            SELECT * FROM family_members 
            WHERE family_id = ? 
            ORDER BY member_order ASC, id ASC
        `).all(familyId);

        // Enhance members with conditions summary and counts
        const enhancedMembers = members.map(rawM => {
            const m = clean(rawM);
            const conditions = db.prepare('SELECT condition_name, status FROM member_conditions WHERE member_id = ?').all(m.id);
            const medCount = db.prepare('SELECT COUNT(*) as c FROM member_medications WHERE member_id = ?').get(m.id)?.c || 0;
            const allergyCount = db.prepare('SELECT COUNT(*) as c FROM member_allergies WHERE member_id = ?').get(m.id)?.c || 0;
            const historyCount = db.prepare('SELECT COUNT(*) as c FROM member_medical_history WHERE member_id = ?').get(m.id)?.c || 0;
            return {
                ...m,
                conditions_list: cleanList(conditions),
                medication_count: medCount,
                allergy_count: allergyCount,
                history_count: historyCount
            };
        });

        const phone = family.contact_number || family.contact_phone || null;
        res.json({
            ...clean(family),
            contact_phone: phone,
            contact_number: phone,
            members: enhancedMembers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/families/:id/members', authenticateStudent, (req, res) => {
    try {
        const familyId = req.params.id;
        const family = db.prepare('SELECT id, student_id FROM families WHERE id = ?').get(familyId);
        if (!family) {
            return res.status(404).json({ error: 'Family not found' });
        }
        if (family.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. This household belongs to another student cadre.' });
        }

        const { search, gender } = req.query;

        let query = 'SELECT * FROM family_members WHERE family_id = ?';
        const params = [familyId];

        if (search && search.trim()) {
            query += ' AND (name LIKE ? OR relation_to_hof LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s);
        }

        if (gender && gender !== 'ALL') {
            query += ' AND gender = ?';
            params.push(gender);
        }

        query += ' ORDER BY member_order ASC, id ASC';
        const members = db.prepare(query).all(...params);

        const enhancedMembers = members.map(rawM => {
            const m = clean(rawM);
            const conditions = db.prepare('SELECT condition_name, status FROM member_conditions WHERE member_id = ?').all(m.id);
            return {
                ...m,
                conditions_list: cleanList(conditions)
            };
        });

        res.json(enhancedMembers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/families
 * Create a new household record
 */
router.post('/families', authenticateStudent, (req, res) => {
    try {
        const {
            family_code,
            family_name,
            family_no,
            head_of_family,
            contact_number,
            contact_phone,
            village_ward,
            village,
            city,
            district,
            state,
            pincode,
            address,
            survey_date,
            total_cu,
            calorie_intake_per_cu,
            calorie_status,
            dietary_advice_given,
            notes,
            members = []
        } = req.body;

        const effectiveContact = contact_number || contact_phone || null;
        const targetStudentId = req.studentId;
        if (!head_of_family || !head_of_family.trim()) {
            return res.status(400).json({ error: 'Head of Family name is required' });
        }

        // Determine next family_no if not provided
        let targetFamilyNo = family_no;
        if (!targetFamilyNo) {
            const maxFamily = db.prepare('SELECT MAX(family_no) as max_no FROM families WHERE student_id = ?').get(targetStudentId);
            targetFamilyNo = (maxFamily?.max_no || 0) + 1;
        } else {
            const existingFam = db.prepare('SELECT id FROM families WHERE student_id = ? AND family_no = ?').get(targetStudentId, targetFamilyNo);
            if (existingFam) {
                return res.status(409).json({ error: `Family #${targetFamilyNo} already exists for this student. Please use family number ${targetFamilyNo + 1} or another number.` });
            }
        }

        // Auto-generate family code if not provided
        let targetFamilyCode = family_code && family_code.trim() ? family_code.trim() : null;
        if (!targetFamilyCode) {
            const maxIdRow = db.prepare('SELECT MAX(id) as max_id FROM families').get();
            const nextId = (maxIdRow?.max_id || 0) + 1;
            targetFamilyCode = `FAM-${String(nextId).padStart(4, '0')}`;
        } else {
            const existingCode = db.prepare('SELECT id FROM families WHERE family_code = ?').get(targetFamilyCode);
            if (existingCode) {
                return res.status(409).json({ error: `Family Code '${targetFamilyCode}' is already in use. Please choose another.` });
            }
        }

        const effectiveFamilyName = family_name && family_name.trim() ? family_name.trim() : `${head_of_family.trim()} Household`;

        // Run in transaction
        db.exec('BEGIN TRANSACTION;');

        try {
            const insertFamilyStmt = db.prepare(`
                INSERT INTO families (
                    student_id, family_code, family_name, family_no, head_of_family,
                    contact_number, village_ward, village, city, district, state, pincode,
                    address, survey_date, total_cu, calorie_intake_per_cu, calorie_status,
                    dietary_advice_given, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?)
            `);

            const familyResult = insertFamilyStmt.run(
                targetStudentId,
                targetFamilyCode,
                effectiveFamilyName,
                targetFamilyNo,
                head_of_family.trim(),
                effectiveContact,
                village_ward || village || 'Community Ward',
                village || village_ward || null,
                city || null,
                district || null,
                state || null,
                pincode || null,
                address || '',
                survey_date || null,
                total_cu || 0,
                calorie_intake_per_cu || 0,
                calorie_status || 'Normal',
                dietary_advice_given || 'N',
                notes || ''
            );

            const familyId = Number(familyResult.lastInsertRowid);

            const insertMemberStmt = db.prepare(`
                INSERT INTO family_members (
                    family_id, member_order, name, relation_to_hof, gender,
                    date_of_birth, age_years, age_months, contact_number, marital_status,
                    education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                    height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                    hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                    diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                    anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                    work_type, consumption_unit
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?
                )
            `);

            members.forEach((m, idx) => {
                let ageYears = parseInt(m.age_years || 0, 10);
                if ((!ageYears || ageYears === 0) && m.date_of_birth) {
                    const dob = new Date(m.date_of_birth);
                    const today = new Date();
                    let calcAge = today.getFullYear() - dob.getFullYear();
                    const mDiff = today.getMonth() - dob.getMonth();
                    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
                    if (calcAge >= 0) ageYears = calcAge;
                }

                let bmi = m.bmi || null;
                if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
                    bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
                }

                let whr = m.whr || null;
                if (!whr && m.waist_cm > 0 && m.hip_cm > 0) {
                    whr = parseFloat((m.waist_cm / m.hip_cm).toFixed(2));
                }

                let has_htn = m.has_htn;
                if ((!has_htn || has_htn === 'NA') && (m.sbp >= 140 || m.dbp >= 90)) has_htn = 'Y';

                let has_anaemia = m.has_anaemia;
                if ((!has_anaemia || has_anaemia === 'NA') && m.hb !== undefined && m.hb !== null && m.hb > 0 && m.hb < 12.0) has_anaemia = 'Y';

                insertMemberStmt.run(
                    familyId,
                    m.member_order || (idx + 1),
                    m.name || `Member ${idx + 1}`,
                    m.relation_to_hof || (idx === 0 ? 'Head of Family' : 'Family Member'),
                    m.gender || 'Other',
                    m.date_of_birth || null,
                    ageYears,
                    parseInt(m.age_months || 0, 10),
                    m.contact_number || null,
                    m.marital_status || 'Unknown',
                    m.education || null,
                    m.occupation || null,
                    has_htn || 'NA',
                    m.sbp ? parseInt(m.sbp, 10) : null,
                    m.dbp ? parseInt(m.dbp, 10) : null,
                    m.has_dm || 'NA',
                    m.rbs ? parseFloat(m.rbs) : null,
                    m.has_pallor || 'NA',
                    m.hb ? parseFloat(m.hb) : null,
                    has_anaemia || 'NA',
                    m.height_m ? parseFloat(m.height_m) : null,
                    m.weight_kg ? parseFloat(m.weight_kg) : null,
                    bmi,
                    m.waist_cm ? parseFloat(m.waist_cm) : null,
                    m.hip_cm ? parseFloat(m.hip_cm) : null,
                    whr,
                    m.hc_cm ? parseFloat(m.hc_cm) : null,
                    m.cc_cm ? parseFloat(m.cc_cm) : null,
                    m.muac_cm ? parseFloat(m.muac_cm) : null,
                    m.is_underweight || 'NA',
                    m.is_overweight || 'NA',
                    m.is_stunting || 'NA',
                    m.is_wasting || 'NA',
                    m.is_severe_wasting || 'NA',
                    m.diagnosis || null,
                    m.treatment_taken || 'NA',
                    m.treatment_source || null,
                    m.oral_hygiene || 'Y',
                    m.general_hygiene || 'Y',
                    m.anc_taken || 'NA',
                    m.delivery_place || 'NA',
                    m.pnc_taken || 'NA',
                    m.fp_method_used || 'NA',
                    m.mamta_card || 'NA',
                    m.immunization_status || 'NA',
                    m.work_type || 'NA',
                    m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0
                );
            });

            db.exec('COMMIT;');

            const createdFamily = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
            const phone = createdFamily.contact_number || createdFamily.contact_phone || null;

            res.status(201).json({
                success: true,
                message: 'Family record created successfully',
                family_id: familyId,
                family_code: targetFamilyCode,
                family_no: targetFamilyNo,
                family: {
                    ...clean(createdFamily),
                    contact_phone: phone,
                    contact_number: phone
                },
                members_count: members.length
            });
        } catch (txError) {
            db.exec('ROLLBACK;');
            throw txError;
        }
    } catch (err) {
        console.error('Error saving family:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/families/:id
 * Edit an existing family's household information
 */
router.put('/families/:id', authenticateStudent, (req, res) => {
    try {
        const familyId = req.params.id;
        const existing = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        if (!existing) {
            return res.status(404).json({ error: 'Family not found' });
        }
        if (existing.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. You cannot modify a household belonging to another student.' });
        }

        const {
            family_name,
            head_of_family,
            contact_number,
            contact_phone,
            village_ward,
            village,
            city,
            district,
            state,
            pincode,
            address,
            total_cu,
            calorie_intake_per_cu,
            calorie_status,
            dietary_advice_given,
            notes
        } = req.body;

        const effectiveContact = contact_number !== undefined ? contact_number : contact_phone;

        db.prepare(`
            UPDATE families SET
                family_name = COALESCE(?, family_name),
                head_of_family = COALESCE(?, head_of_family),
                contact_number = COALESCE(?, contact_number),
                village_ward = COALESCE(?, village_ward),
                village = COALESCE(?, village),
                city = COALESCE(?, city),
                district = COALESCE(?, district),
                state = COALESCE(?, state),
                pincode = COALESCE(?, pincode),
                address = COALESCE(?, address),
                total_cu = COALESCE(?, total_cu),
                calorie_intake_per_cu = COALESCE(?, calorie_intake_per_cu),
                calorie_status = COALESCE(?, calorie_status),
                dietary_advice_given = COALESCE(?, dietary_advice_given),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            family_name !== undefined ? family_name : null,
            head_of_family !== undefined ? head_of_family : null,
            effectiveContact !== undefined ? effectiveContact : null,
            village_ward !== undefined ? village_ward : null,
            village !== undefined ? village : null,
            city !== undefined ? city : null,
            district !== undefined ? district : null,
            state !== undefined ? state : null,
            pincode !== undefined ? pincode : null,
            address !== undefined ? address : null,
            total_cu !== undefined ? total_cu : null,
            calorie_intake_per_cu !== undefined ? calorie_intake_per_cu : null,
            calorie_status !== undefined ? calorie_status : null,
            dietary_advice_given !== undefined ? dietary_advice_given : null,
            notes !== undefined ? notes : null,
            familyId
        );

        const updated = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        const phone = updated.contact_number || updated.contact_phone || null;
        res.json({
            success: true,
            message: 'Family updated successfully',
            family: {
                ...clean(updated),
                contact_phone: phone,
                contact_number: phone
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/families/:id', authenticateStudent, (req, res) => {
    try {
        const familyId = req.params.id;
        const existing = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
        if (!existing) {
            return res.status(404).json({ error: 'Family not found' });
        }
        if (existing.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. You cannot delete a household belonging to another student.' });
        }
        db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
        res.json({ success: true, message: 'Family record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/families/:id/members
 * Add a new individual member to an existing family
 */
router.post('/families/:id/members', authenticateStudent, (req, res) => {
    try {
        const familyId = req.params.id;
        const family = db.prepare('SELECT id, student_id FROM families WHERE id = ?').get(familyId);
        if (!family) {
            return res.status(404).json({ error: 'Family not found' });
        }
        if (family.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. Cannot add members to another student\'s household.' });
        }

        const m = req.body;
        if (!m.name || !m.name.trim()) {
            return res.status(400).json({ error: 'Member name is required' });
        }

        // Determine next member_order
        const maxOrderRow = db.prepare('SELECT MAX(member_order) as max_order FROM family_members WHERE family_id = ?').get(familyId);
        const nextOrder = (maxOrderRow?.max_order || 0) + 1;

        // Dynamic age calculation from DOB if age_years is not set
        let ageYears = parseInt(m.age_years || 0, 10);
        if ((!ageYears || ageYears === 0) && m.date_of_birth) {
            const dob = new Date(m.date_of_birth);
            const today = new Date();
            let calcAge = today.getFullYear() - dob.getFullYear();
            const mDiff = today.getMonth() - dob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
            if (calcAge >= 0) ageYears = calcAge;
        }

        // Auto-calculate BMI
        let bmi = m.bmi || null;
        if (!bmi && m.height_m > 0 && m.weight_kg > 0) {
            bmi = parseFloat((m.weight_kg / (m.height_m * m.height_m)).toFixed(2));
        }

        // Auto-calculate WHR
        let whr = m.whr || null;
        if (!whr && m.waist_cm > 0 && m.hip_cm > 0) {
            whr = parseFloat((m.waist_cm / m.hip_cm).toFixed(2));
        }

        // Auto-flag HTN
        let has_htn = m.has_htn;
        if ((!has_htn || has_htn === 'NA') && (m.sbp >= 140 || m.dbp >= 90)) {
            has_htn = 'Y';
        }

        // Auto-flag Anaemia
        let has_anaemia = m.has_anaemia;
        if ((!has_anaemia || has_anaemia === 'NA') && m.hb !== undefined && m.hb !== null && m.hb > 0 && m.hb < 12.0) {
            has_anaemia = 'Y';
        }

        const insertStmt = db.prepare(`
            INSERT INTO family_members (
                family_id, member_order, name, relation_to_hof, gender,
                date_of_birth, age_years, age_months, contact_number, marital_status,
                education, occupation, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia,
                height_m, weight_kg, bmi, waist_cm, hip_cm, whr,
                hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status,
                work_type, consumption_unit
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?
            )
        `);

        const result = insertStmt.run(
            familyId,
            nextOrder,
            m.name.trim(),
            m.relation_to_hof || 'Family Member',
            m.gender || 'Other',
            m.date_of_birth || null,
            ageYears,
            parseInt(m.age_months || 0, 10),
            m.contact_number || m.contact_phone || m.contact || null,
            (m.marital_status && m.marital_status !== 'NA') ? m.marital_status : 'Unknown',
            m.education || m.education_level || null,
            m.occupation || null,
            has_htn || 'NA',
            m.sbp ? parseInt(m.sbp, 10) : null,
            m.dbp ? parseInt(m.dbp, 10) : null,
            m.has_dm || 'NA',
            m.rbs ? parseFloat(m.rbs) : null,
            m.has_pallor || 'NA',
            m.hb ? parseFloat(m.hb) : null,
            has_anaemia || 'NA',
            m.height_m ? parseFloat(m.height_m) : null,
            m.weight_kg ? parseFloat(m.weight_kg) : null,
            bmi,
            m.waist_cm ? parseFloat(m.waist_cm) : null,
            m.hip_cm ? parseFloat(m.hip_cm) : null,
            whr,
            m.hc_cm ? parseFloat(m.hc_cm) : null,
            m.cc_cm ? parseFloat(m.cc_cm) : null,
            m.muac_cm ? parseFloat(m.muac_cm) : null,
            m.is_underweight || 'NA',
            m.is_overweight || 'NA',
            m.is_stunting || 'NA',
            m.is_wasting || 'NA',
            m.is_severe_wasting || 'NA',
            m.diagnosis || null,
            m.treatment_taken || 'NA',
            m.treatment_source || null,
            m.oral_hygiene || 'Y',
            m.general_hygiene || 'Y',
            m.anc_taken || 'NA',
            m.delivery_place || 'NA',
            m.pnc_taken || 'NA',
            m.fp_method_used || 'NA',
            m.mamta_card || 'NA',
            m.immunization_status || 'NA',
            m.work_type || 'NA',
            m.consumption_unit ? parseFloat(m.consumption_unit) : 1.0
        );

        const newMemberId = Number(result.lastInsertRowid);

        // If condition was entered initially, add it to structured conditions table
        if (m.diagnosis && m.diagnosis.trim()) {
            db.prepare(`
                INSERT INTO member_conditions (member_id, condition_name, status, notes)
                VALUES (?, ?, 'Active', 'Entered during baseline survey')
            `).run(newMemberId, m.diagnosis.trim());
        }

        const newMember = db.prepare('SELECT * FROM family_members WHERE id = ?').get(newMemberId);

        res.status(201).json({
            success: true,
            message: 'Member added successfully to family',
            member: clean(newMember)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/members/:id
 * Edit personal and demographic details of a member
 */
router.put('/members/:id', authenticateStudent, (req, res) => {
    try {
        const memberId = req.params.id;
        const existing = db.prepare(`
            SELECT m.*, f.student_id 
            FROM family_members m 
            JOIN families f ON m.family_id = f.id 
            WHERE m.id = ?
        `).get(memberId);

        if (!existing) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (existing.student_id !== req.studentId) {
            return res.status(403).json({ error: 'Access denied. Cannot modify a member belonging to another student.' });
        }

        const m = req.body;
        let ageYears = m.age_years !== undefined ? parseInt(m.age_years, 10) : existing.age_years;
        if ((!ageYears || ageYears === 0) && m.date_of_birth) {
            const dob = new Date(m.date_of_birth);
            const today = new Date();
            let calcAge = today.getFullYear() - dob.getFullYear();
            const mDiff = today.getMonth() - dob.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) calcAge--;
            if (calcAge >= 0) ageYears = calcAge;
        }

        const contactVal = m.contact_number !== undefined ? m.contact_number : (m.contact_phone !== undefined ? m.contact_phone : m.contact);
        const eduVal = m.education !== undefined ? m.education : m.education_level;
        let maritalVal = m.marital_status;
        if (maritalVal === 'NA') maritalVal = 'Unknown';

        // Calculated BMI
        let heightM = m.height_m !== undefined ? (m.height_m ? parseFloat(m.height_m) : null) : existing.height_m;
        let weightKg = m.weight_kg !== undefined ? (m.weight_kg ? parseFloat(m.weight_kg) : null) : existing.weight_kg;
        let bmi = m.bmi !== undefined ? (m.bmi ? parseFloat(m.bmi) : null) : existing.bmi;
        if (heightM > 0 && weightKg > 0) {
            bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(2));
        }

        // Calculated WHR
        let waistCm = m.waist_cm !== undefined ? (m.waist_cm ? parseFloat(m.waist_cm) : null) : existing.waist_cm;
        let hipCm = m.hip_cm !== undefined ? (m.hip_cm ? parseFloat(m.hip_cm) : null) : existing.hip_cm;
        let whr = m.whr !== undefined ? (m.whr ? parseFloat(m.whr) : null) : existing.whr;
        if (waistCm > 0 && hipCm > 0) {
            whr = parseFloat((waistCm / hipCm).toFixed(2));
        }

        // Auto HTN
        let sbp = m.sbp !== undefined ? (m.sbp ? parseInt(m.sbp, 10) : null) : existing.sbp;
        let dbp = m.dbp !== undefined ? (m.dbp ? parseInt(m.dbp, 10) : null) : existing.dbp;
        let hasHtn = m.has_htn !== undefined ? m.has_htn : existing.has_htn;
        if ((!hasHtn || hasHtn === 'NA') && (sbp >= 140 || dbp >= 90)) {
            hasHtn = 'Y';
        }

        // Auto DM
        let rbs = m.rbs !== undefined ? (m.rbs ? parseFloat(m.rbs) : null) : existing.rbs;
        let hasDm = m.has_dm !== undefined ? m.has_dm : existing.has_dm;
        if ((!hasDm || hasDm === 'NA') && rbs >= 200) {
            hasDm = 'Y';
        }

        // Auto Anaemia
        let hb = m.hb !== undefined ? (m.hb ? parseFloat(m.hb) : null) : existing.hb;
        let hasAnaemia = m.has_anaemia !== undefined ? m.has_anaemia : existing.has_anaemia;
        if ((!hasAnaemia || hasAnaemia === 'NA') && hb !== null && hb > 0 && hb < 12.0) {
            hasAnaemia = 'Y';
        }

        db.prepare(`
            UPDATE family_members SET
                name = COALESCE(?, name),
                relation_to_hof = COALESCE(?, relation_to_hof),
                gender = COALESCE(?, gender),
                date_of_birth = COALESCE(?, date_of_birth),
                age_years = COALESCE(?, age_years),
                age_months = COALESCE(?, age_months),
                contact_number = COALESCE(?, contact_number),
                marital_status = COALESCE(?, marital_status),
                education = COALESCE(?, education),
                occupation = COALESCE(?, occupation),
                work_type = COALESCE(?, work_type),
                consumption_unit = COALESCE(?, consumption_unit),
                has_htn = COALESCE(?, has_htn),
                sbp = ?,
                dbp = ?,
                has_dm = COALESCE(?, has_dm),
                rbs = ?,
                has_pallor = COALESCE(?, has_pallor),
                hb = ?,
                has_anaemia = COALESCE(?, has_anaemia),
                height_m = ?,
                weight_kg = ?,
                bmi = ?,
                waist_cm = ?,
                hip_cm = ?,
                whr = ?,
                hc_cm = ?,
                cc_cm = ?,
                muac_cm = ?,
                is_underweight = COALESCE(?, is_underweight),
                is_overweight = COALESCE(?, is_overweight),
                is_stunting = COALESCE(?, is_stunting),
                is_wasting = COALESCE(?, is_wasting),
                is_severe_wasting = COALESCE(?, is_severe_wasting),
                diagnosis = COALESCE(?, diagnosis),
                treatment_taken = COALESCE(?, treatment_taken),
                treatment_source = COALESCE(?, treatment_source),
                oral_hygiene = COALESCE(?, oral_hygiene),
                general_hygiene = COALESCE(?, general_hygiene),
                anc_taken = COALESCE(?, anc_taken),
                delivery_place = COALESCE(?, delivery_place),
                pnc_taken = COALESCE(?, pnc_taken),
                fp_method_used = COALESCE(?, fp_method_used),
                mamta_card = COALESCE(?, mamta_card),
                immunization_status = COALESCE(?, immunization_status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            m.name !== undefined ? m.name.trim() : null,
            m.relation_to_hof !== undefined ? m.relation_to_hof : null,
            m.gender !== undefined ? m.gender : null,
            m.date_of_birth !== undefined ? m.date_of_birth : null,
            ageYears !== undefined ? ageYears : null,
            m.age_months !== undefined ? parseInt(m.age_months, 10) : null,
            contactVal !== undefined ? contactVal : null,
            maritalVal !== undefined ? maritalVal : null,
            eduVal !== undefined ? eduVal : null,
            m.occupation !== undefined ? m.occupation : null,
            m.work_type !== undefined ? m.work_type : null,
            m.consumption_unit !== undefined ? (m.consumption_unit ? parseFloat(m.consumption_unit) : null) : null,
            hasHtn !== undefined ? hasHtn : null,
            sbp,
            dbp,
            hasDm !== undefined ? hasDm : null,
            rbs,
            m.has_pallor !== undefined ? m.has_pallor : null,
            hb,
            hasAnaemia !== undefined ? hasAnaemia : null,
            heightM,
            weightKg,
            bmi,
            waistCm,
            hipCm,
            whr,
            m.hc_cm !== undefined ? (m.hc_cm ? parseFloat(m.hc_cm) : null) : existing.hc_cm,
            m.cc_cm !== undefined ? (m.cc_cm ? parseFloat(m.cc_cm) : null) : existing.cc_cm,
            m.muac_cm !== undefined ? (m.muac_cm ? parseFloat(m.muac_cm) : null) : existing.muac_cm,
            m.is_underweight !== undefined ? m.is_underweight : null,
            m.is_overweight !== undefined ? m.is_overweight : null,
            m.is_stunting !== undefined ? m.is_stunting : null,
            m.is_wasting !== undefined ? m.is_wasting : null,
            m.is_severe_wasting !== undefined ? m.is_severe_wasting : null,
            m.diagnosis !== undefined ? m.diagnosis : null,
            m.treatment_taken !== undefined ? m.treatment_taken : null,
            m.treatment_source !== undefined ? m.treatment_source : null,
            m.oral_hygiene !== undefined ? m.oral_hygiene : null,
            m.general_hygiene !== undefined ? m.general_hygiene : null,
            m.anc_taken !== undefined ? m.anc_taken : null,
            m.delivery_place !== undefined ? m.delivery_place : null,
            m.pnc_taken !== undefined ? m.pnc_taken : null,
            m.fp_method_used !== undefined ? m.fp_method_used : null,
            m.mamta_card !== undefined ? m.mamta_card : null,
            m.immunization_status !== undefined ? m.immunization_status : null,
            memberId
        );

        // If a diagnosis was entered or changed, add to member_conditions
        if (m.diagnosis && m.diagnosis.trim() && m.diagnosis !== existing.diagnosis) {
            const existingCond = db.prepare('SELECT id FROM member_conditions WHERE member_id = ? AND condition_name = ?').get(memberId, m.diagnosis.trim());
            if (!existingCond) {
                db.prepare(`
                    INSERT INTO member_conditions (member_id, condition_name, status, notes)
                    VALUES (?, ?, 'Active', 'Recorded during survey entry')
                `).run(memberId, m.diagnosis.trim());
            }
        }

        const updated = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
        res.json({ success: true, message: 'Member clinical survey data updated successfully', member: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/members/:id
 * Retrieve single member's complete data + structured conditions, medications, allergies, history, lifestyle, and follow-ups
 */
router.get('/members/:id', (req, res) => {
    try {
        const memberId = req.params.id;
        const member = db.prepare(`
            SELECT m.*, f.family_no, f.family_code, f.family_name, f.head_of_family, f.village_ward, f.address,
                   s.roll_number as student_roll, s.name as student_name
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            WHERE m.id = ?
        `).get(memberId);

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        const conditions = db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const medications = db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const allergies = db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(memberId);
        const history = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(memberId);
        const lifestyle = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);

        const followUps = db.prepare(`
            SELECT fu.*, s.roll_number as recorded_by_roll, s.name as recorded_by_name
            FROM follow_ups fu
            LEFT JOIN students s ON fu.student_id = s.id
            WHERE fu.member_id = ?
            ORDER BY fu.visit_date DESC, fu.id DESC
        `).all(memberId);

        res.json({
            ...clean(member),
            conditions: cleanList(conditions),
            medications: cleanList(medications),
            allergies: cleanList(allergies),
            history: cleanList(history),
            medical_history: cleanList(history),
            lifestyle: lifestyle ? clean(lifestyle) : null,
            follow_ups: cleanList(followUps)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/members/:id
 */
router.delete('/members/:id', (req, res) => {
    try {
        const memberId = req.params.id;
        const result = db.prepare('DELETE FROM family_members WHERE id = ?').run(memberId);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ success: true, message: 'Member record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 3. Structured Clinical Sub-Entities CRUD
// -------------------------------------------------------------

// --- Conditions ---
router.get('/members/:id/conditions', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const rows = db.prepare('SELECT * FROM member_conditions WHERE member_id = ? ORDER BY id DESC').all(req.params.id);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/members/:id/conditions', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const memberId = req.params.id;
        const { condition_name, status, diagnosed_year, diagnosis_date, notes } = req.body;
        if (!condition_name || !condition_name.trim()) {
            return res.status(400).json({ error: 'Condition name is required' });
        }

        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            INSERT INTO member_conditions (member_id, condition_name, status, diagnosed_year, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            memberId,
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_conditions WHERE id = ?').get(Number(result.lastInsertRowid));
        res.status(201).json({ success: true, message: 'Medical condition recorded', condition: clean(created) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/conditions/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const { condition_name, status, diagnosed_year, diagnosis_date, notes } = req.body;
        if (!condition_name || !condition_name.trim()) {
            return res.status(400).json({ error: 'Condition name is required' });
        }

        let effYear = diagnosed_year ? parseInt(diagnosed_year, 10) : null;
        if (!effYear && diagnosis_date) {
            const m = String(diagnosis_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        let effStatus = status || 'Active';
        if (!['Active', 'Resolved', 'Unknown'].includes(effStatus)) effStatus = 'Active';

        const result = db.prepare(`
            UPDATE member_conditions SET
                condition_name = ?,
                status = ?,
                diagnosed_year = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            condition_name.trim(),
            effStatus,
            effYear,
            notes ? notes.trim() : null,
            req.params.id
        );

        if (result.changes === 0) return res.status(404).json({ error: 'Condition not found' });
        const updated = db.prepare('SELECT * FROM member_conditions WHERE id = ?').get(req.params.id);
        res.json({ success: true, message: 'Condition updated', condition: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/conditions/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_conditions', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const result = db.prepare('DELETE FROM member_conditions WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Condition not found' });
        res.json({ success: true, message: 'Condition removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Medications ---
router.get('/members/:id/medications', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const rows = db.prepare('SELECT * FROM member_medications WHERE member_id = ? ORDER BY id DESC').all(req.params.id);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/members/:id/medications', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const memberId = req.params.id;
        const { name, medication_name, dosage, frequency, reason, prescribed_for, currently_taking, adherence_status, notes } = req.body;
        const drugName = name || medication_name;
        if (!drugName || !drugName.trim()) {
            return res.status(400).json({ error: 'Medication name is required' });
        }

        const effReason = reason || prescribed_for || null;
        let effTaking = currently_taking || (adherence_status === 'Discontinued' ? 'No' : 'Yes');
        if (!['Yes', 'No', 'Unknown'].includes(effTaking)) effTaking = 'Yes';

        const result = db.prepare(`
            INSERT INTO member_medications (member_id, name, dosage, frequency, reason, currently_taking, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            memberId,
            drugName.trim(),
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            effReason ? effReason.trim() : null,
            effTaking,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_medications WHERE id = ?').get(Number(result.lastInsertRowid));
        res.status(201).json({ success: true, message: 'Medication recorded', medication: clean(created) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/medications/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_medications', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const { name, medication_name, dosage, frequency, reason, prescribed_for, currently_taking, adherence_status, notes } = req.body;
        const drugName = name || medication_name;
        if (!drugName || !drugName.trim()) {
            return res.status(400).json({ error: 'Medication name is required' });
        }

        const effReason = reason || prescribed_for || null;
        let effTaking = currently_taking || (adherence_status === 'Discontinued' ? 'No' : 'Yes');
        if (!['Yes', 'No', 'Unknown'].includes(effTaking)) effTaking = 'Yes';

        const result = db.prepare(`
            UPDATE member_medications SET
                name = ?,
                dosage = ?,
                frequency = ?,
                reason = ?,
                currently_taking = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            drugName.trim(),
            dosage ? dosage.trim() : null,
            frequency ? frequency.trim() : null,
            effReason ? effReason.trim() : null,
            effTaking,
            notes ? notes.trim() : null,
            req.params.id
        );

        if (result.changes === 0) return res.status(404).json({ error: 'Medication not found' });
        const updated = db.prepare('SELECT * FROM member_medications WHERE id = ?').get(req.params.id);
        res.json({ success: true, message: 'Medication updated', medication: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/medications/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_medications', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const result = db.prepare('DELETE FROM member_medications WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Medication not found' });
        res.json({ success: true, message: 'Medication removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Allergies ---
router.get('/members/:id/allergies', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const rows = db.prepare('SELECT * FROM member_allergies WHERE member_id = ? ORDER BY id DESC').all(req.params.id);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/members/:id/allergies', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const memberId = req.params.id;
        const { allergen, allergy_type, reaction, reaction_description, severity, notes } = req.body;
        if (!allergen || !allergen.trim()) {
            return res.status(400).json({ error: 'Allergen name is required' });
        }

        let effType = allergy_type || 'Medication';
        if (effType === 'Drug') effType = 'Medication';
        if (!['Medication', 'Food', 'Environmental', 'Other'].includes(effType)) effType = 'Other';

        let effSeverity = severity || 'Moderate';
        if (effSeverity === 'Life-threatening') effSeverity = 'Severe';
        if (!['Mild', 'Moderate', 'Severe', 'Unknown'].includes(effSeverity)) effSeverity = 'Moderate';

        const effReaction = reaction || reaction_description || null;

        const result = db.prepare(`
            INSERT INTO member_allergies (member_id, allergen, allergy_type, reaction, severity, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            memberId,
            allergen.trim(),
            effType,
            effReaction ? effReaction.trim() : null,
            effSeverity,
            notes ? notes.trim() : null
        );

        const created = db.prepare('SELECT * FROM member_allergies WHERE id = ?').get(Number(result.lastInsertRowid));
        res.status(201).json({ success: true, message: 'Allergy recorded', allergy: clean(created) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/allergies/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const { allergen, allergy_type, reaction, reaction_description, severity, notes } = req.body;
        if (!allergen || !allergen.trim()) {
            return res.status(400).json({ error: 'Allergen name is required' });
        }

        let effType = allergy_type || 'Medication';
        if (effType === 'Drug') effType = 'Medication';
        if (!['Medication', 'Food', 'Environmental', 'Other'].includes(effType)) effType = 'Other';

        let effSeverity = severity || 'Moderate';
        if (effSeverity === 'Life-threatening') effSeverity = 'Severe';
        if (!['Mild', 'Moderate', 'Severe', 'Unknown'].includes(effSeverity)) effSeverity = 'Moderate';

        const effReaction = reaction || reaction_description || null;

        const result = db.prepare(`
            UPDATE member_allergies SET
                allergen = ?,
                allergy_type = ?,
                reaction = ?,
                severity = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            allergen.trim(),
            effType,
            effReaction ? effReaction.trim() : null,
            effSeverity,
            notes ? notes.trim() : null,
            req.params.id
        );

        if (result.changes === 0) return res.status(404).json({ error: 'Allergy not found' });
        const updated = db.prepare('SELECT * FROM member_allergies WHERE id = ?').get(req.params.id);
        res.json({ success: true, message: 'Allergy updated', allergy: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/allergies/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_allergies', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const result = db.prepare('DELETE FROM member_allergies WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Allergy not found' });
        res.json({ success: true, message: 'Allergy removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Medical History ---
router.get('/members/:id/history', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const rows = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ? ORDER BY year DESC, id DESC').all(req.params.id);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/members/:id/history', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const memberId = req.params.id;
        const { category, event_type, description, year, event_date, notes, outcome_notes, facility_name } = req.body;
        const desc = description || req.body.event_description;
        if (!desc || !desc.trim()) {
            return res.status(400).json({ error: 'Description is required' });
        }

        let effCategory = category || event_type || 'Other';
        if (/hospital/i.test(effCategory)) effCategory = 'Previous hospitalization';
        else if (/surgery|surgical/i.test(effCategory)) effCategory = 'Surgery';
        else if (/accident|trauma/i.test(effCategory)) effCategory = 'Accident / injury';
        else if (/illness/i.test(effCategory)) effCategory = 'Major illness';
        else if (/condition|chronic/i.test(effCategory)) effCategory = 'Long-term condition';
        else if (!['Major illness', 'Previous hospitalization', 'Surgery', 'Accident / injury', 'Long-term condition', 'Other'].includes(effCategory)) effCategory = 'Other';

        let effYear = year ? parseInt(year, 10) : null;
        if (!effYear && event_date) {
            const m = String(event_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        const effNotes = [notes, outcome_notes, facility_name ? `Facility: ${facility_name}` : null].filter(Boolean).join(' - ') || null;

        const result = db.prepare(`
            INSERT INTO member_medical_history (member_id, category, description, year, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            memberId,
            effCategory,
            desc.trim(),
            effYear,
            effNotes
        );

        const created = db.prepare('SELECT * FROM member_medical_history WHERE id = ?').get(Number(result.lastInsertRowid));
        res.status(201).json({ success: true, message: 'Medical history recorded', history_item: clean(created) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/history/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const { category, event_type, description, year, event_date, notes, outcome_notes, facility_name } = req.body;
        const desc = description || req.body.event_description;
        if (!desc || !desc.trim()) {
            return res.status(400).json({ error: 'Description is required' });
        }

        let effCategory = category || event_type || 'Other';
        if (/hospital/i.test(effCategory)) effCategory = 'Previous hospitalization';
        else if (/surgery|surgical/i.test(effCategory)) effCategory = 'Surgery';
        else if (/accident|trauma/i.test(effCategory)) effCategory = 'Accident / injury';
        else if (/illness/i.test(effCategory)) effCategory = 'Major illness';
        else if (/condition|chronic/i.test(effCategory)) effCategory = 'Long-term condition';
        else if (!['Major illness', 'Previous hospitalization', 'Surgery', 'Accident / injury', 'Long-term condition', 'Other'].includes(effCategory)) effCategory = 'Other';

        let effYear = year ? parseInt(year, 10) : null;
        if (!effYear && event_date) {
            const m = String(event_date).match(/\d{4}/);
            if (m) effYear = parseInt(m[0], 10);
        }

        const effNotes = [notes, outcome_notes, facility_name ? `Facility: ${facility_name}` : null].filter(Boolean).join(' - ') || null;

        const result = db.prepare(`
            UPDATE member_medical_history SET
                category = ?,
                description = ?,
                year = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            effCategory,
            desc.trim(),
            effYear,
            effNotes,
            req.params.id
        );

        if (result.changes === 0) return res.status(404).json({ error: 'History item not found' });
        const updated = db.prepare('SELECT * FROM member_medical_history WHERE id = ?').get(req.params.id);
        res.json({ success: true, message: 'Medical history updated', history_item: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/history/:id', authenticateStudent, (req, res) => {
    if (!verifySubEntityAccess('member_medical_history', req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const result = db.prepare('DELETE FROM member_medical_history WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'History item not found' });
        res.json({ success: true, message: 'Medical history item removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Lifestyle ---
router.get('/members/:id/lifestyle', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const row = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(req.params.id);
        res.json(row ? clean(row) : {
            smoking_status: 'Never',
            alcohol_status: 'Never',
            physical_activity: 'Moderate',
            diet: '',
            notes: ''
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/members/:id/lifestyle', authenticateStudent, (req, res) => {
    if (!verifyMemberAccess(req.params.id, req.studentId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const memberId = req.params.id;
        const { smoking_status, alcohol_status, alcohol_consumption, physical_activity, physical_activity_level, diet, diet_type, notes, smoking_frequency, salt_intake } = req.body;

        let effSmoking = smoking_status || 'Never';
        if (effSmoking === 'Occasional') effSmoking = 'Current';
        if (!['Never', 'Former', 'Current', 'Unknown'].includes(effSmoking)) effSmoking = 'Never';

        let effAlcohol = alcohol_status || alcohol_consumption || 'Never';
        if (effAlcohol === 'Occasional' || effAlcohol === 'Regular') effAlcohol = 'Current';
        if (!['Never', 'Former', 'Current', 'Unknown'].includes(effAlcohol)) effAlcohol = 'Never';

        let effActivity = physical_activity || physical_activity_level || 'Moderate';
        if (effActivity === 'Sedentary') effActivity = 'Low';
        if (effActivity === 'Active' || effActivity === 'Very Active') effActivity = 'High';
        if (!['Low', 'Moderate', 'High', 'Unknown'].includes(effActivity)) effActivity = 'Moderate';

        const effDiet = diet || diet_type || 'Vegetarian';
        const effNotes = [notes, smoking_frequency ? `Tobacco: ${smoking_frequency}` : null, salt_intake ? `Salt: ${salt_intake}` : null].filter(Boolean).join(' | ') || null;

        db.prepare(`
            INSERT INTO member_lifestyle (member_id, smoking_status, alcohol_status, physical_activity, diet, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(member_id) DO UPDATE SET
                smoking_status = excluded.smoking_status,
                alcohol_status = excluded.alcohol_status,
                physical_activity = excluded.physical_activity,
                diet = excluded.diet,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            memberId,
            effSmoking,
            effAlcohol,
            effActivity,
            effDiet,
            effNotes
        );

        const saved = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(memberId);
        res.json({ success: true, message: 'Lifestyle recorded successfully', lifestyle: clean(saved) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 3. Clinical Follow-Up Visits
// -------------------------------------------------------------
router.post('/members/:id/follow-ups', authenticateStudent, (req, res) => {
    try {
        const memberId = req.params.id;
        const member = verifyMemberAccess(memberId, req.studentId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied. Member belongs to another student cadre.' });
        }

        const {
            visit_date,
            sbp,
            dbp,
            rbs,
            hb,
            weight_kg,
            muac_cm,
            treatment_compliance,
            health_progress,
            clinical_notes,
            next_visit_date
        } = req.body;

        const targetStudentId = req.studentId;

        // Determine visit number
        const countRow = db.prepare('SELECT COUNT(*) as c FROM follow_ups WHERE member_id = ?').get(memberId);
        const visitNumber = (countRow?.c || 0) + 1;

        const insertStmt = db.prepare(`
            INSERT INTO follow_ups (
                member_id, student_id, visit_date, visit_number,
                sbp, dbp, rbs, hb, weight_kg, muac_cm,
                treatment_compliance, health_progress, clinical_notes, next_visit_date
            ) VALUES (
                ?, ?, COALESCE(?, date('now')), ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `);

        const result = insertStmt.run(
            memberId,
            targetStudentId,
            visit_date || null,
            visitNumber,
            sbp ? parseInt(sbp, 10) : null,
            dbp ? parseInt(dbp, 10) : null,
            rbs ? parseFloat(rbs) : null,
            hb ? parseFloat(hb) : null,
            weight_kg ? parseFloat(weight_kg) : null,
            muac_cm ? parseFloat(muac_cm) : null,
            treatment_compliance || 'Good',
            health_progress || 'Stable',
            clinical_notes || '',
            next_visit_date || null
        );

        const newFuId = Number(result.lastInsertRowid);
        const newFu = db.prepare(`
            SELECT fu.*, s.roll_number as recorded_by_roll, s.name as recorded_by_name
            FROM follow_ups fu
            LEFT JOIN students s ON fu.student_id = s.id
            WHERE fu.id = ?
        `).get(newFuId);

        res.status(201).json({
            success: true,
            message: 'Follow-up visit recorded successfully',
            follow_up: clean(newFu)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/follow-ups/:id', authenticateStudent, (req, res) => {
    try {
        const fuId = req.params.id;
        if (!verifyFollowUpAccess(fuId, req.studentId)) {
            return res.status(403).json({ error: 'Access denied. You cannot delete this follow-up visit.' });
        }
        const result = db.prepare('DELETE FROM follow_ups WHERE id = ?').run(fuId);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Follow-up not found' });
        }
        res.json({ success: true, message: 'Follow-up record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 3. Epidemiological Analytics & Database Queries
// -------------------------------------------------------------
router.get('/analytics/summary', authenticateStudent, (req, res) => {
    try {
        const sid = req.studentId;
        const totalFamilies = db.prepare('SELECT COUNT(*) as c FROM families WHERE student_id = ?').get(sid)?.c || 0;
        const totalMembers = db.prepare(`
            SELECT COUNT(*) as c 
            FROM family_members m 
            JOIN families f ON m.family_id = f.id 
            WHERE f.student_id = ?
        `).get(sid)?.c || 0;
        const totalStudents = 1;

        // Adults & NCD
        const adultStats = db.prepare(`
            SELECT 
                COUNT(*) as adults_count,
                SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_count,
                SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_count,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemia_count
            FROM family_members m 
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ? AND m.age_years >= 18
        `).get(sid);

        // Under 5 Pediatric
        const pediatricStats = db.prepare(`
            SELECT 
                COUNT(*) as under5_count,
                SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END) as underweight_count,
                SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END) as stunted_count,
                SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END) as wasted_count,
                SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END) as mamta_card_count,
                SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END) as immunized_count
            FROM family_members m 
            JOIN families f ON m.family_id = f.id
            WHERE f.student_id = ? AND m.age_years <= 5
        `).get(sid);

        // Caloric status distribution
        const calorieStats = db.prepare(`
            SELECT 
                calorie_status,
                COUNT(*) as count
            FROM families
            WHERE student_id = ?
            GROUP BY calorie_status
        `).all(sid);

        res.json({
            totals: {
                families: totalFamilies,
                members: totalMembers,
                students: totalStudents
            },
            adults: {
                total: adultStats.adults_count,
                htn_count: adultStats.htn_count,
                htn_pct: adultStats.adults_count ? Math.round((adultStats.htn_count / adultStats.adults_count) * 100) : 0,
                dm_count: adultStats.dm_count,
                dm_pct: adultStats.adults_count ? Math.round((adultStats.dm_count / adultStats.adults_count) * 100) : 0,
                anaemia_count: adultStats.anaemia_count,
                anaemia_pct: adultStats.adults_count ? Math.round((adultStats.anaemia_count / adultStats.adults_count) * 100) : 0
            },
            pediatric: {
                total_under5: pediatricStats.under5_count,
                underweight_count: pediatricStats.underweight_count,
                stunted_count: pediatricStats.stunted_count,
                wasted_count: pediatricStats.wasted_count,
                mamta_card_coverage: pediatricStats.under5_count ? Math.round((pediatricStats.mamta_card_count / pediatricStats.under5_count) * 100) : 0,
                immunization_coverage: pediatricStats.under5_count ? Math.round((pediatricStats.immunized_count / pediatricStats.under5_count) * 100) : 0
            },
            calorieDistribution: cleanList(calorieStats)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// Interactive Analytics & Chart Data API (Multi-parameter filtered)
// -------------------------------------------------------------
router.get('/analytics/charts', authenticateStudent, (req, res) => {
    try {
        const { gender, ageGroup, familyId } = req.query;
        const sid = req.studentId;

        // Build dynamic WHERE clause - always constrained to current student
        const conditions = ['f.student_id = ?'];
        const params = [sid];

        if (gender && gender !== 'all') {
            conditions.push('m.gender = ?');
            params.push(gender);
        }
        if (familyId && familyId !== 'all') {
            conditions.push('m.family_id = ?');
            params.push(parseInt(familyId, 10));
        }
        if (ageGroup && ageGroup !== 'all') {
            if (ageGroup === 'under18') conditions.push('m.age_years < 18');
            else if (ageGroup === '18-44') conditions.push('m.age_years BETWEEN 18 AND 44');
            else if (ageGroup === '45-59') conditions.push('m.age_years BETWEEN 45 AND 59');
            else if (ageGroup === '60+') conditions.push('m.age_years >= 60');
        }

        const whereSql = 'WHERE ' + conditions.join(' AND ');

        // 1. KPI Aggregates
        const kpiSql = `
            SELECT 
                COUNT(*) as total_members,
                SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) as males,
                SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) as females,
                ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
                      NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) as sex_ratio,
                SUM(CASE WHEN m.age_years >= 18 THEN 1 ELSE 0 END) as adult_count,
                SUM(CASE WHEN m.age_years >= 18 AND m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_cases,
                SUM(CASE WHEN m.age_years >= 18 AND m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_cases,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemia_cases,
                ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END), 1) as avg_sbp,
                ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END), 1) as avg_dbp,
                ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END), 1) as avg_rbs,
                ROUND(AVG(CASE WHEN m.hb IS NOT NULL THEN m.hb END), 2) as avg_hb,
                ROUND(AVG(CASE WHEN m.bmi IS NOT NULL THEN m.bmi END), 2) as avg_bmi
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
        `;
        const kpis = db.prepare(kpiSql).get(...params);

        // Households total
        let familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = ?';
        let familyCountParams = [sid];
        if (familyId && familyId !== 'all') {
            familyCountSql = 'SELECT COUNT(*) as c FROM families WHERE student_id = ? AND id = ?';
            familyCountParams = [sid, parseInt(familyId, 10)];
        }
        const totalHouseholds = db.prepare(familyCountSql).get(...familyCountParams)?.c || 0;

        // 2. BMI Distribution
        const bmiSql = `
            SELECT 
                CASE 
                    WHEN m.bmi < 18.5 THEN 'Underweight (< 18.5)'
                    WHEN m.bmi BETWEEN 18.5 AND 22.9 THEN 'Normal (18.5 - 22.9)'
                    WHEN m.bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
                    WHEN m.bmi >= 27.5 THEN 'Obese (>= 27.5)'
                    ELSE 'Unmeasured'
                END AS category,
                COUNT(*) AS count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND m.bmi IS NOT NULL
            GROUP BY category
            ORDER BY 
                CASE category
                    WHEN 'Underweight (< 18.5)' THEN 1
                    WHEN 'Normal (18.5 - 22.9)' THEN 2
                    WHEN 'Overweight (23.0 - 27.4)' THEN 3
                    WHEN 'Obese (>= 27.5)' THEN 4
                    ELSE 5
                END
        `;
        const bmiDistribution = db.prepare(bmiSql).all(...params);

        // 3. NCD Prevalence by Age Group
        const ncdAgeSql = `
            SELECT 
                CASE 
                    WHEN m.age_years < 30 THEN '< 30 yrs'
                    WHEN m.age_years BETWEEN 30 AND 44 THEN '30-44 yrs'
                    WHEN m.age_years BETWEEN 45 AND 59 THEN '45-59 yrs'
                    ELSE '60+ yrs'
                END as age_bracket,
                COUNT(*) as total,
                SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) as htn_count,
                ROUND(SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as htn_pct,
                SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) as dm_count,
                ROUND(SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as dm_pct
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY age_bracket
            ORDER BY 
                CASE age_bracket
                    WHEN '< 30 yrs' THEN 1
                    WHEN '30-44 yrs' THEN 2
                    WHEN '45-59 yrs' THEN 3
                    ELSE 4
                END
        `;
        const ncdByAgeGroup = db.prepare(ncdAgeSql).all(...params);

        // 4. Blood Pressure Classification
        const bpSql = `
            SELECT 
                CASE 
                    WHEN m.sbp < 120 AND m.dbp < 80 THEN 'Normal (<120/80)'
                    WHEN (m.sbp BETWEEN 120 AND 139) OR (m.dbp BETWEEN 80 AND 89) THEN 'Pre-HTN (120-139/80-89)'
                    WHEN (m.sbp BETWEEN 140 AND 159) OR (m.dbp BETWEEN 90 AND 99) THEN 'Stage 1 HTN (140-159/90-99)'
                    WHEN m.sbp >= 160 OR m.dbp >= 100 THEN 'Stage 2 HTN (>=160/100)'
                    ELSE 'Unmeasured'
                END as category,
                COUNT(*) as count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND m.sbp IS NOT NULL AND m.dbp IS NOT NULL
            GROUP BY category
            ORDER BY 
                CASE category
                    WHEN 'Normal (<120/80)' THEN 1
                    WHEN 'Pre-HTN (120-139/80-89)' THEN 2
                    WHEN 'Stage 1 HTN (140-159/90-99)' THEN 3
                    WHEN 'Stage 2 HTN (>=160/100)' THEN 4
                    ELSE 5
                END
        `;
        const bpCategories = db.prepare(bpSql).all(...params);

        // 5. Anaemia & Hb by Gender
        const anaemiaGenderSql = `
            SELECT 
                m.gender,
                COUNT(*) as total,
                SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) as anaemic_count,
                ROUND(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) as anaemia_pct,
                SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) as pallor_count,
                ROUND(AVG(m.hb), 2) as avg_hb
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY m.gender
        `;
        const anaemiaByGender = db.prepare(anaemiaGenderSql).all(...params);

        // 6. Community Conditions Ranking
        const condSql = `
            SELECT 
                c.condition_name,
                COUNT(*) as count
            FROM member_conditions c
            JOIN family_members m ON c.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY c.condition_name
            ORDER BY count DESC
            LIMIT 10
        `;
        const conditionsRanking = db.prepare(condSql).all(...params);

        // 7. Occupational / Physical Activity Work Type
        const workSql = `
            SELECT 
                CASE 
                    WHEN m.work_type IN ('S', 'Sedentary') THEN 'Sedentary'
                    WHEN m.work_type IN ('M', 'Moderate') THEN 'Moderate'
                    WHEN m.work_type IN ('H', 'Heavy') THEN 'Heavy'
                    ELSE 'Unclassified'
                END as work_category,
                COUNT(*) as count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY work_category
        `;
        const lifestyleWork = db.prepare(workSql).all(...params);

        // 8. Caloric Adequacy
        const calSql = `
            SELECT 
                calorie_status,
                COUNT(*) as count
            FROM families
            WHERE student_id = ? ${familyId && familyId !== 'all' ? 'AND id = ' + parseInt(familyId, 10) : ''}
            GROUP BY calorie_status
        `;
        const dietaryStatus = db.prepare(calSql).all(sid);

        // 9. Longitudinal Trends (Cohort averages across Visit 1 & Visit 2, plus individual chronic trajectories)
        const cohortSql = `
            SELECT 
                fu.visit_number,
                COUNT(*) as visits_count,
                ROUND(AVG(fu.sbp), 1) as avg_sbp,
                ROUND(AVG(fu.dbp), 1) as avg_dbp,
                ROUND(AVG(fu.rbs), 1) as avg_rbs,
                ROUND(AVG(fu.hb), 1) as avg_hb,
                ROUND(AVG(fu.weight_kg), 1) as avg_wt
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            GROUP BY fu.visit_number
            ORDER BY fu.visit_number
        `;
        const cohortTrends = db.prepare(cohortSql).all(...params);

        const patientCurvesSql = `
            SELECT 
                m.id as member_id,
                m.name as member_name,
                m.gender,
                fu.visit_number,
                fu.visit_date,
                fu.sbp,
                fu.dbp,
                fu.rbs,
                fu.hb,
                fu.weight_kg,
                fu.health_progress,
                fu.treatment_compliance
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            ${whereSql} AND (m.has_htn = 'Y' OR m.has_dm = 'Y' OR m.has_anaemia = 'Y')
            ORDER BY m.id, fu.visit_number
        `;
        const rawCurves = db.prepare(patientCurvesSql).all(...params);

        // Group patient curves by member
        const patientCurvesMap = {};
        for (const row of rawCurves) {
            if (!patientCurvesMap[row.member_id]) {
                patientCurvesMap[row.member_id] = {
                    id: row.member_id,
                    name: row.member_name,
                    gender: row.gender,
                    visits: []
                };
            }
            patientCurvesMap[row.member_id].visits.push({
                visit_number: row.visit_number,
                visit_date: row.visit_date,
                sbp: row.sbp,
                dbp: row.dbp,
                rbs: row.rbs,
                hb: row.hb,
                weight_kg: row.weight_kg,
                progress: row.health_progress,
                compliance: row.treatment_compliance
            });
        }
        const patientCurves = Object.values(patientCurvesMap);

        // 10. Member List for Interactive Drilldown Table
        const listSql = `
            SELECT 
                m.id,
                m.name,
                f.family_code,
                f.head_of_family,
                f.village_ward,
                m.relation_to_hof,
                m.gender,
                m.age_years,
                m.sbp,
                m.dbp,
                m.has_htn,
                m.rbs,
                m.has_dm,
                m.hb,
                m.has_anaemia,
                m.bmi,
                m.work_type,
                m.diagnosis,
                m.treatment_taken,
                (SELECT COUNT(*) FROM follow_ups WHERE member_id = m.id) as follow_up_count
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            ${whereSql}
            ORDER BY f.family_no, m.member_order
        `;
        const memberList = db.prepare(listSql).all(...params);

        res.json({
            filters: { gender: gender || 'all', ageGroup: ageGroup || 'all', familyId: familyId || 'all' },
            kpis: {
                totalHouseholds,
                totalMembers: kpis?.total_members || 0,
                males: kpis?.males || 0,
                females: kpis?.females || 0,
                sexRatio: kpis?.sex_ratio || 0,
                adultCount: kpis?.adult_count || 0,
                htnCases: kpis?.htn_cases || 0,
                htnPct: kpis?.adult_count ? Math.round((kpis.htn_cases / kpis.adult_count) * 100) : 0,
                dmCases: kpis?.dm_cases || 0,
                dmPct: kpis?.adult_count ? Math.round((kpis.dm_cases / kpis.adult_count) * 100) : 0,
                anaemiaCases: kpis?.anaemia_cases || 0,
                anaemiaPct: kpis?.total_members ? Math.round((kpis.anaemia_cases / kpis.total_members) * 100) : 0,
                avgSbp: kpis?.avg_sbp || null,
                avgDbp: kpis?.avg_dbp || null,
                avgRbs: kpis?.avg_rbs || null,
                avgHb: kpis?.avg_hb || null,
                avgBmi: kpis?.avg_bmi || null
            },
            bmiDistribution: cleanList(bmiDistribution),
            ncdByAgeGroup: cleanList(ncdByAgeGroup),
            bpCategories: cleanList(bpCategories),
            anaemiaByGender: cleanList(anaemiaByGender),
            conditionsRanking: cleanList(conditionsRanking),
            lifestyleWork: cleanList(lifestyleWork),
            dietaryStatus: cleanList(dietaryStatus),
            longitudinalTrends: {
                cohortAverages: cleanList(cohortTrends),
                patientCurves: cleanList(patientCurves)
            },
            memberList: cleanList(memberList)
        });

    } catch (err) {
        console.error('Error in /analytics/charts:', err);
        res.status(500).json({ error: err.message });
    }
});

// Run pre-built query reports
router.get('/analytics/report/:reportId', authenticateStudent, (req, res) => {
    try {
        const { reportId } = req.params;
        const sid = req.studentId;
        let sql = '';
        let params = [sid];

        switch (reportId) {
            case 'student-audit':
                sql = `
                    SELECT 
                        s.roll_number,
                        s.name AS student_name,
                        COUNT(DISTINCT f.id) AS total_families_surveyed,
                        COUNT(m.id) AS total_members_surveyed,
                        SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
                        SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS female_count,
                        ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
                              NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) AS sex_ratio
                    FROM students s
                    LEFT JOIN families f ON s.id = f.student_id
                    LEFT JOIN family_members m ON f.id = m.family_id
                    WHERE s.id = ?
                    GROUP BY s.id, s.roll_number, s.name
                `;
                break;

            case 'ncd-prevalence':
                sql = `
                    SELECT 
                        COUNT(*) AS total_adults,
                        SUM(CASE WHEN m.has_htn = 'Y' THEN 1 ELSE 0 END) AS htn_cases,
                        ROUND(SUM(CASE WHEN m.has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS htn_pct,
                        SUM(CASE WHEN m.has_dm = 'Y' THEN 1 ELSE 0 END) AS dm_cases,
                        ROUND(SUM(CASE WHEN m.has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS dm_pct,
                        SUM(CASE WHEN m.has_htn = 'Y' AND m.has_dm = 'Y' THEN 1 ELSE 0 END) AS htn_and_dm_cases,
                        ROUND(AVG(CASE WHEN m.sbp IS NOT NULL THEN m.sbp END), 1) AS mean_sbp,
                        ROUND(AVG(CASE WHEN m.dbp IS NOT NULL THEN m.dbp END), 1) AS mean_dbp,
                        ROUND(AVG(CASE WHEN m.rbs IS NOT NULL THEN m.rbs END), 1) AS mean_rbs
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years >= 18
                `;
                break;

            case 'anaemia-gender':
                sql = `
                    SELECT 
                        m.gender,
                        COUNT(*) AS total_individuals,
                        SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1 ELSE 0 END) AS anaemic_count,
                        ROUND(SUM(CASE WHEN m.has_anaemia = 'Y' OR (m.hb IS NOT NULL AND m.hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS anaemia_pct,
                        SUM(CASE WHEN m.has_pallor = 'Y' THEN 1 ELSE 0 END) AS pallor_count,
                        ROUND(AVG(m.hb), 2) AS average_hb
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.gender IN ('M', 'F')
                    GROUP BY m.gender
                `;
                break;

            case 'bmi-distribution':
                sql = `
                    SELECT 
                        CASE 
                            WHEN m.bmi < 18.5 THEN 'Underweight (< 18.5)'
                            WHEN m.bmi BETWEEN 18.5 AND 22.9 THEN 'Normal Weight (18.5 - 22.9)'
                            WHEN m.bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
                            WHEN m.bmi >= 27.5 THEN 'Obese (>= 27.5)'
                            ELSE 'Unmeasured'
                        END AS bmi_category,
                        COUNT(*) AS count
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years >= 18 AND m.bmi IS NOT NULL
                    GROUP BY bmi_category
                `;
                break;

            case 'pediatric-health':
                sql = `
                    SELECT 
                        COUNT(*) AS total_under_5,
                        SUM(CASE WHEN m.is_underweight = 'Y' THEN 1 ELSE 0 END) AS underweight,
                        SUM(CASE WHEN m.is_stunting = 'Y' THEN 1 ELSE 0 END) AS stunting,
                        SUM(CASE WHEN m.is_wasting = 'Y' THEN 1 ELSE 0 END) AS wasting,
                        SUM(CASE WHEN m.mamta_card = 'Y' THEN 1 ELSE 0 END) AS mamta_card,
                        SUM(CASE WHEN m.immunization_status = 'Y' THEN 1 ELSE 0 END) AS age_immunized
                    FROM family_members m
                    JOIN families f ON m.family_id = f.id
                    WHERE f.student_id = ? AND m.age_years <= 5
                `;
                break;

            default:
                return res.status(400).json({ error: 'Unknown report identifier' });
        }

        const data = db.prepare(sql).all(...params);
        res.json({ reportId, data: cleanList(data) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// Official Field Survey & Follow-up Export Endpoints (Roll 235 Proforma)
// -------------------------------------------------------------

/**
 * GET /api/export/csv
 * Downloads standard RFC 4180 CSV matching the 43 columns of Roll235.pdf + follow-up tracking
 */
router.get('/export/csv', authenticateStudent, (req, res) => {
    try {
        const csvData = generateCsv(req.studentId);
        const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvData);
    } catch (err) {
        console.error('CSV Export Error:', err);
        res.status(500).json({ error: 'Failed to generate CSV export: ' + err.message });
    }
});

/**
 * GET /api/export/pdf
 * Streams high-fidelity clinical PDF matching Roll 235 proforma + longitudinal follow-ups
 */
router.get('/export/pdf', authenticateStudent, (req, res) => {
    try {
        const filename = `Roll_${req.rollNumber || '235'}_Health_Survey_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        generatePdfStream(req.studentId, res);
    } catch (err) {
        console.error('PDF Export Error:', err);
        res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
    }
});

/**
 * GET /api/export/data
 * JSON endpoint returning aggregated family, member, and latest follow-up records
 */
router.get('/export/data', authenticateStudent, (req, res) => {
    try {
        const exportData = getStudentExportData(req.studentId);
        if (!exportData) {
            return res.status(404).json({ error: 'No survey data found for student.' });
        }
        res.json(exportData);
    } catch (err) {
        console.error('Export Data Error:', err);
        res.status(500).json({ error: 'Failed to fetch export data: ' + err.message });
    }
});

// =============================================================
// ADMINISTRATIVE COMMAND CENTER ENDPOINTS (FACULTY / ADMIN PORTAL)
// =============================================================

// 1. Admin Authentication
router.post('/admin/login', (req, res) => {
    try {
        const { username, pin } = req.body;
        if (!username || !pin) {
            return res.status(400).json({ error: 'Admin username and PIN are required' });
        }
        const admin = db.prepare('SELECT * FROM admins WHERE LOWER(username) = LOWER(?)').get(username.trim());
        if (!admin) {
            return res.status(401).json({ error: 'Invalid admin username or account not found' });
        }
        if (admin.pin !== pin.trim()) {
            return res.status(401).json({ error: 'Invalid administrator PIN / Password' });
        }
        res.json({
            success: true,
            admin: clean(admin),
            token: `admin-${admin.id}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/admin/me', authenticateAdmin, (req, res) => {
    res.json({ admin: req.admin });
});

// 2. Administrative Surveillance Overview & Catchment KPIs
router.get('/admin/stats', authenticateAdmin, (req, res) => {
    try {
        const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get()?.c || 0;
        const activeStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get()?.c || 0;
        const totalFamilies = db.prepare('SELECT COUNT(*) as c FROM families').get()?.c || 0;
        const totalMembers = db.prepare('SELECT COUNT(*) as c FROM family_members').get()?.c || 0;
        const totalFollowups = db.prepare('SELECT COUNT(*) as c FROM follow_ups').get()?.c || 0;
        const totalColleges = db.prepare('SELECT COUNT(*) as c FROM colleges').get()?.c || 0;

        // Epidemiological Disease Burden in Catchment Area
        const totalHtn = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_htn = 'Y'").get()?.c || 0;
        const totalDm = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_dm = 'Y'").get()?.c || 0;
        const totalAnaemia = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_anaemia = 'Y'").get()?.c || 0;
        const totalMalnutrition = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE is_underweight = 'Y' OR is_wasting = 'Y' OR is_severe_wasting = 'Y'").get()?.c || 0;

        // Breakdown by Medical College
        const collegesBreakdown = db.prepare(`
            SELECT c.id, c.name, c.code, c.city, c.state,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count,
                   (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as members_count
            FROM colleges c
            ORDER BY c.name ASC
        `).all();

        // Recent Survey Activity Streams
        const recentFamilies = db.prepare(`
            SELECT f.id, f.family_no, f.family_code, f.head_of_family, f.created_at, f.village,
                   s.roll_number, s.name as student_name,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            ORDER BY f.id DESC
            LIMIT 6
        `).all();

        const recentFollowups = db.prepare(`
            SELECT fu.id, fu.visit_number, fu.visit_date, fu.health_progress, fu.treatment_compliance, fu.clinical_notes,
                   m.name as member_name, f.family_no, s.roll_number, s.name as student_name
            FROM follow_ups fu
            JOIN family_members m ON fu.member_id = m.id
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            ORDER BY fu.id DESC
            LIMIT 6
        `).all();

        res.json({
            overview: {
                total_students: totalStudents,
                active_students: activeStudents,
                total_families: totalFamilies,
                total_members: totalMembers,
                total_followups: totalFollowups,
                total_colleges: totalColleges
            },
            burden: {
                total_htn: totalHtn,
                total_dm: totalDm,
                total_anaemia: totalAnaemia,
                total_malnutrition: totalMalnutrition
            },
            colleges: cleanList(collegesBreakdown),
            recent_families: cleanList(recentFamilies),
            recent_followups: cleanList(recentFollowups)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Student Cadre Management Endpoints
router.get('/admin/students', authenticateAdmin, (req, res) => {
    try {
        const { college_id, status, search } = req.query;
        let query = `
            SELECT s.*, c.name as college_name,
                   (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as families_count,
                   (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = s.id) as members_count,
                   (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = s.id) as followups_count
            FROM students s
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (college_id) {
            query += ` AND s.college_id = ?`;
            params.push(college_id);
        }
        if (status) {
            query += ` AND s.status = ?`;
            params.push(status);
        }
        if (search) {
            query += ` AND (s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY s.roll_number ASC`;
        const rows = db.prepare(query).all(...params);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admin/students', authenticateAdmin, (req, res) => {
    try {
        const { roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status } = req.body;
        if (!roll_number || !name) {
            return res.status(400).json({ error: 'Roll number and student name are required' });
        }
        const cleanRoll = roll_number.toString().trim();
        const existing = db.prepare('SELECT id FROM students WHERE LOWER(roll_number) = LOWER(?)').get(cleanRoll);
        if (existing) {
            return res.status(409).json({ error: `Cadet with Roll Number "${cleanRoll}" is already registered.` });
        }

        const stmt = db.prepare(`
            INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cleanRoll,
            name.trim(),
            pin && pin.toString().trim() ? pin.toString().trim() : '1234',
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            batch_year ? batch_year.trim() : '3rd Year MBBS (Community Medicine)',
            posting_unit ? posting_unit.trim() : 'RHTC - Rural Health Training Center',
            college_id ? Number(college_id) : 1,
            status ? status.trim() : 'Active'
        );

        const newStudent = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.id = ?
        `).get(Number(result.lastInsertRowid));

        res.status(201).json({ success: true, student: clean(newStudent) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/admin/students/:id', authenticateAdmin, (req, res) => {
    try {
        const studentId = req.params.id;
        const { name, email, phone, batch_year, posting_unit, college_id, status } = req.body;

        const current = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!current) {
            return res.status(404).json({ error: 'Cadet record not found' });
        }

        db.prepare(`
            UPDATE students
            SET name = COALESCE(?, name),
                email = ?,
                phone = ?,
                batch_year = COALESCE(?, batch_year),
                posting_unit = COALESCE(?, posting_unit),
                college_id = COALESCE(?, college_id),
                status = COALESCE(?, status)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            email !== undefined ? (email ? email.trim() : null) : current.email,
            phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
            batch_year ? batch_year.trim() : null,
            posting_unit ? posting_unit.trim() : null,
            college_id ? Number(college_id) : null,
            status ? status.trim() : null,
            studentId
        );

        const updated = db.prepare(`
            SELECT s.*, c.name as college_name 
            FROM students s 
            LEFT JOIN colleges c ON s.college_id = c.id 
            WHERE s.id = ?
        `).get(studentId);

        res.json({ success: true, student: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admin/students/:id/reset-pin', authenticateAdmin, (req, res) => {
    try {
        const studentId = req.params.id;
        const newPin = req.body.new_pin ? req.body.new_pin.toString().trim() : '1234';
        if (newPin.length < 4) {
            return res.status(400).json({ error: 'PIN must be at least 4 digits' });
        }
        const student = db.prepare('SELECT id, roll_number, name FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Cadet record not found' });
        }
        db.prepare('UPDATE students SET pin = ? WHERE id = ?').run(newPin, studentId);
        res.json({
            success: true,
            message: `PIN for Cadet ${student.name} (Roll ${student.roll_number}) reset to "${newPin}".`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/admin/students/:id', authenticateAdmin, (req, res) => {
    try {
        const studentId = req.params.id;
        const student = db.prepare('SELECT id, roll_number, name FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Cadet record not found' });
        }
        db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
        res.json({
            success: true,
            message: `Cadet ${student.name} (Roll ${student.roll_number}) and all associated survey records deleted.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/admin/students/:id/families', authenticateAdmin, (req, res) => {
    try {
        const studentId = req.params.id;
        const student = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Cadet record not found' });
        }
        const families = db.prepare(`
            SELECT f.*,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count,
                   (SELECT COUNT(*) FROM follow_ups fu WHERE fu.student_id = f.student_id) as total_followups
            FROM families f
            WHERE f.student_id = ?
            ORDER BY f.family_no ASC
        `).all(studentId);
        res.json({
            student: clean(student),
            families: cleanList(families)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Global Cross-Cadet Household & Population Surveillance
router.get('/admin/families', authenticateAdmin, (req, res) => {
    try {
        const { student_id, college_id, village, search } = req.query;
        let query = `
            SELECT f.*, s.roll_number, s.name as student_name, c.name as college_name,
                   (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id) as members_count
            FROM families f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            query += ` AND f.student_id = ?`;
            params.push(student_id);
        }
        if (college_id) {
            query += ` AND s.college_id = ?`;
            params.push(college_id);
        }
        if (village) {
            query += ` AND f.village = ?`;
            params.push(village);
        }
        if (search) {
            query += ` AND (f.head_of_family LIKE ? OR f.family_code LIKE ? OR f.village LIKE ? OR s.roll_number LIKE ? OR s.name LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term, term);
        }

        query += ` ORDER BY f.id DESC`;
        const rows = db.prepare(query).all(...params);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/admin/members', authenticateAdmin, (req, res) => {
    try {
        const { has_htn, has_dm, has_anaemia, search } = req.query;
        let query = `
            SELECT m.*, f.family_no, f.family_code, f.head_of_family, f.village,
                   s.roll_number, s.name as student_name, c.name as college_name
            FROM family_members m
            JOIN families f ON m.family_id = f.id
            JOIN students s ON f.student_id = s.id
            LEFT JOIN colleges c ON s.college_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (has_htn) {
            query += ` AND m.has_htn = ?`;
            params.push(has_htn);
        }
        if (has_dm) {
            query += ` AND m.has_dm = ?`;
            params.push(has_dm);
        }
        if (has_anaemia) {
            query += ` AND m.has_anaemia = ?`;
            params.push(has_anaemia);
        }
        if (search) {
            query += ` AND (m.name LIKE ? OR m.diagnosis LIKE ? OR f.head_of_family LIKE ? OR s.roll_number LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        query += ` ORDER BY m.id DESC LIMIT 100`;
        const rows = db.prepare(query).all(...params);
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. College & Medical Institution Administration
router.get('/admin/colleges', authenticateAdmin, (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM students s WHERE s.college_id = c.id) as students_count,
                   (SELECT COUNT(*) FROM families f JOIN students s ON f.student_id = s.id WHERE s.college_id = c.id) as families_count
            FROM colleges c
            ORDER BY c.name ASC
        `).all();
        res.json(cleanList(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admin/colleges', authenticateAdmin, (req, res) => {
    try {
        const { name, code, city, state } = req.body;
        if (!name || !code) {
            return res.status(400).json({ error: 'College name and institutional code are required' });
        }
        const existing = db.prepare('SELECT id FROM colleges WHERE LOWER(code) = LOWER(?)').get(code.trim());
        if (existing) {
            return res.status(409).json({ error: `Medical institution with code "${code.trim()}" already exists` });
        }
        const stmt = db.prepare(`
            INSERT INTO colleges (name, code, city, state)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(name.trim(), code.trim(), city ? city.trim() : null, state ? state.trim() : null);
        const newCol = db.prepare('SELECT * FROM colleges WHERE id = ?').get(Number(result.lastInsertRowid));
        res.status(201).json({ success: true, college: clean(newCol) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/admin/colleges/:id', authenticateAdmin, (req, res) => {
    try {
        const { name, code, city, state } = req.body;
        const colId = req.params.id;
        db.prepare(`
            UPDATE colleges
            SET name = COALESCE(?, name),
                code = COALESCE(?, code),
                city = COALESCE(?, city),
                state = COALESCE(?, state)
            WHERE id = ?
        `).run(
            name ? name.trim() : null,
            code ? code.trim() : null,
            city ? city.trim() : null,
            state ? state.trim() : null,
            colId
        );
        const updated = db.prepare('SELECT * FROM colleges WHERE id = ?').get(colId);
        res.json({ success: true, college: clean(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Master Compilation & Faculty Audit Export Endpoints
router.get('/admin/export/all-csv', authenticateAdmin, (req, res) => {
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
});

router.get('/admin/export/audit-pdf', authenticateAdmin, (req, res) => {
    try {
        const filename = `MedPulse_Faculty_Surveillance_Audit_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        generateFacultyAuditPdfStream(res);
    } catch (err) {
        console.error('Faculty Audit PDF Error:', err);
        res.status(500).json({ error: 'Failed to generate Audit PDF: ' + err.message });
    }
});

module.exports = router;
