const express = require('express');
const router = express.Router();
const { db } = require('../config/db');

/**
 * Helper to resolve student ID from query, auth header, or default to Roll 235 (Student 1)
 */
function resolveStudentId(req) {
    if (req.studentId) return req.studentId;
    if (req.query.student_id) return parseInt(req.query.student_id, 10);
    if (req.query.roll_number) {
        const student = db.prepare('SELECT id FROM students WHERE roll_number = ?').get(req.query.roll_number.toString().trim());
        if (student) return student.id;
    }
    // Default demo cadet is Student ID 1 (Roll 235)
    return 1;
}

/**
 * Helper to fetch student metadata
 */
function getStudentMeta(studentId) {
    const s = db.prepare(`
        SELECT s.id, s.name, s.roll_number, s.batch_year, s.posting_unit, c.name as college_name 
        FROM students s 
        LEFT JOIN colleges c ON s.college_id = c.id 
        WHERE s.id = ?
    `).get(studentId);
    return s || { id: studentId, name: 'Student Clinician', roll_number: '235', batch_year: '3rd Year MBBS', college_name: 'Medical College' };
}

// =========================================================================
// ATTENDANCE APIS
// =========================================================================

/**
 * GET /api/academic/attendance/overview
 * Returns overall statistics, NMC compliance indicators, and Theory vs Practical breakdowns.
 */
router.get(['/academic/attendance/overview', '/api/academic/attendance/overview'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const student = getStudentMeta(studentId);

        // 3rd Year MBBS Cumulative Ledger (Current Academic Year)
        res.json({
            student,
            current_year: '3rd Year MBBS',
            academic_year: '2026',
            summary: {
                total_sessions: 285,
                attended_sessions: 246,
                absent_sessions: 26,
                leave_sessions: 13,
                field_duty_sessions: 12,
                total_hours: 382.5,
                overall_percentage: 86.3,
                nmc_status: 'Eligible',
                nmc_min_percentage: 75.0
            },
            theory: {
                total: 185,
                attended: 157,
                percentage: 84.9,
                nmc_min: 75.0,
                compliant: true
            },
            practical: {
                total: 100,
                attended: 89,
                percentage: 89.0,
                nmc_min: 80.0,
                compliant: true
            }
        });
    } catch (err) {
        console.error('Attendance Overview Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/academic/attendance/subject-wise
 * Returns subject-by-subject attendance analytics for current academic year (3rd Year MBBS)
 * with Theory vs Practical breakdowns and NMC eligibility.
 */
router.get(['/academic/attendance/subject-wise', '/api/academic/attendance/subject-wise'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const student = getStudentMeta(studentId);

        // Official Current Year (3rd Year MBBS) Subjects & Complete Annual Ledger
        const currentYearSubjects = [
            {
                subject: '2010043342 – COMMUNITY MEDICINE (PSM)',
                subject_code: '2010043342',
                faculty_name: 'DRASHTI R SONI',
                total: 90,
                attended: 80,
                absent: 6,
                leave: 4,
                field_duty: 12,
                theory: { total: 60, attended: 52, percentage: 86.7, met: true },
                practical: { total: 30, attended: 28, percentage: 93.3, met: true },
                overall_percentage: 88.9,
                eligible: true,
                nmc_status: 'Eligible'
            },
            {
                subject: '2010043410 – OPHTHALMOLOGY',
                subject_code: '2010043410',
                faculty_name: 'DR. NEHA SHAH',
                total: 70,
                attended: 60,
                absent: 7,
                leave: 3,
                field_duty: 0,
                theory: { total: 45, attended: 38, percentage: 84.4, met: true },
                practical: { total: 25, attended: 22, percentage: 88.0, met: true },
                overall_percentage: 85.7,
                eligible: true,
                nmc_status: 'Eligible'
            },
            {
                subject: '2010043425 – OTORHINOLARYNGOLOGY (ENT)',
                subject_code: '2010043425',
                faculty_name: 'DR. BHAVIN PATEL',
                total: 67,
                attended: 56,
                absent: 8,
                leave: 3,
                field_duty: 0,
                theory: { total: 42, attended: 35, percentage: 83.3, met: true },
                practical: { total: 25, attended: 21, percentage: 84.0, met: true },
                overall_percentage: 83.6,
                eligible: true,
                nmc_status: 'Eligible'
            },
            {
                subject: '2010043320 – FORENSIC MEDICINE & TOXICOLOGY',
                subject_code: '2010043320',
                faculty_name: 'DR. K. M. PATEL',
                total: 58,
                attended: 50,
                absent: 5,
                leave: 3,
                field_duty: 0,
                theory: { total: 38, attended: 32, percentage: 84.2, met: true },
                practical: { total: 20, attended: 18, percentage: 90.0, met: true },
                overall_percentage: 86.2,
                eligible: true,
                nmc_status: 'Eligible'
            }
        ];

        let grandTotal = 0;
        let grandAttended = 0;
        let grandAbsent = 0;
        let grandLeave = 0;
        let grandTheoryTotal = 0;
        let grandTheoryAttended = 0;
        let grandPracticalTotal = 0;
        let grandPracticalAttended = 0;

        for (const s of currentYearSubjects) {
            grandTotal += s.total;
            grandAttended += s.attended;
            grandAbsent += s.absent;
            grandLeave += s.leave;
            grandTheoryTotal += s.theory.total;
            grandTheoryAttended += s.theory.attended;
            grandPracticalTotal += s.practical.total;
            grandPracticalAttended += s.practical.attended;
        }

        const grandPct = parseFloat(((grandAttended / grandTotal) * 100).toFixed(1));
        const grandTheoryPct = parseFloat(((grandTheoryAttended / grandTheoryTotal) * 100).toFixed(1));
        const grandPracticalPct = parseFloat(((grandPracticalAttended / grandPracticalTotal) * 100).toFixed(1));

        res.json({
            student,
            current_year: '3rd Year MBBS',
            academic_year: '2026',
            summary: {
                total_sessions: grandTotal,
                attended_sessions: grandAttended,
                absent_sessions: grandAbsent,
                leave_sessions: grandLeave,
                field_duty_sessions: 12,
                overall_percentage: grandPct,
                nmc_status: 'Eligible',
                nmc_min_percentage: 75.0
            },
            theory: {
                total: grandTheoryTotal,
                attended: grandTheoryAttended,
                percentage: grandTheoryPct,
                nmc_min: 75.0,
                compliant: true
            },
            practical: {
                total: grandPracticalTotal,
                attended: grandPracticalAttended,
                percentage: grandPracticalPct,
                nmc_min: 80.0,
                compliant: true
            },
            overall_summary: {
                total_classes: grandTotal,
                attended_classes: grandAttended,
                absent_classes: grandAbsent,
                leave_classes: grandLeave,
                overall_percentage: grandPct,
                eligible_subjects: currentYearSubjects.length,
                total_subjects: currentYearSubjects.length,
                all_eligible: true
            },
            subjects: currentYearSubjects
        });
    } catch (err) {
        console.error('Attendance Subject-Wise Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/academic/attendance/datewise
 * Returns exact lecture schedule & status for a specific date (matching university portal layout)
 */
router.get(['/academic/attendance/datewise', '/api/academic/attendance/datewise'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const student = getStudentMeta(studentId);

        let targetDate = req.query.date ? req.query.date.trim() : '2026-09-28';
        // Handle DD/MM/YYYY or DD-MM-YYYY format
        if (targetDate.includes('/') || (targetDate.includes('-') && targetDate.split('-')[0].length === 2)) {
            const parts = targetDate.split(/[\/\-]/);
            if (parts[0].length === 2 && parts[2] && parts[2].length === 4) {
                targetDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        const lectures = db.prepare(`
            SELECT * FROM student_attendance 
            WHERE student_id = ? AND date = ? 
            ORDER BY lecture_no ASC, time_slot ASC, id ASC
        `).all(studentId, targetDate);

        let present = 0;
        let absent = 0;
        let leave = 0;
        let fieldDuty = 0;
        let notMarked = 0;

        const formattedLectures = lectures.map(l => {
            if (l.status === 'Present') present++;
            else if (l.status === 'Absent') absent++;
            else if (l.status === 'Leave') leave++;
            else if (l.status === 'Field Duty') fieldDuty++;
            else notMarked++;

            return {
                id: l.id,
                lecture_no: l.lecture_no || 1,
                room_no: l.room_no || '',
                time: l.time_slot || '08:10 to 08:55',
                subject_code: l.subject_code || '2010043342',
                subject_name: l.subject,
                theory_practical: l.session_type || 'Theory',
                faculty_name: l.faculty_name || 'FACULTY',
                status: l.status || 'Not Marked'
            };
        });

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const dParts = targetDate.split('-');
        const dateFormatted = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : targetDate;

        // Distinct available dates
        const dateRows = db.prepare(`
            SELECT DISTINCT date 
            FROM student_attendance 
            WHERE student_id = ? 
            ORDER BY date DESC
        `).all(studentId);
        const availableDates = dateRows.map(r => r.date);

        res.json({
            student,
            semester: 'Semester - 5',
            batch: student.batch_year || '3rd Year MBBS',
            date_iso: targetDate,
            date_formatted: dateFormatted,
            summary: {
                total: formattedLectures.length,
                present,
                absent,
                leave,
                field_duty: fieldDuty,
                not_marked: notMarked
            },
            lectures: formattedLectures,
            available_dates: availableDates
        });
    } catch (err) {
        console.error('Datewise Attendance Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/academic/schedule
 * Returns academic teaching schedule with NMC competencies, topics, faculty, teaching types (Large Group, DOAP),
 * and dates/times. Orders sessions so that Today's schedule is the leftmost card (index 0).
 */
router.get(['/academic/schedule', '/api/academic/schedule'], (req, res) => {
    try {
        const { department, teaching_type, date } = req.query;

        let sql = 'SELECT * FROM academic_schedule WHERE 1=1';
        const params = [];

        if (department && department !== 'all') {
            sql += ' AND department LIKE ?';
            params.push(`%${department}%`);
        }

        if (teaching_type && teaching_type !== 'all') {
            sql += ' AND teaching_type = ?';
            params.push(teaching_type);
        }

        if (date) {
            sql += ' AND date = ?';
            params.push(date);
        }

        sql += ' ORDER BY date ASC, time_slot ASC, id ASC';

        const allSchedules = db.prepare(sql).all(...params);

        const todayIso = new Date().toISOString().slice(0, 10); // '2026-10-02'
        
        let todaySessions = allSchedules.filter(s => s.date === todayIso || s.status === 'Today');
        let upcomingSessions = allSchedules.filter(s => (s.date >= todayIso && s.status !== 'Today') || (s.date > todayIso));
        let pastSessions = allSchedules.filter(s => s.date < todayIso && s.status !== 'Today');

        let orderedSchedules = [];
        if (todaySessions.length > 0) {
            orderedSchedules = [...todaySessions, ...upcomingSessions, ...pastSessions];
        } else if (upcomingSessions.length > 0) {
            orderedSchedules = [...upcomingSessions, ...pastSessions];
        } else {
            orderedSchedules = allSchedules;
        }

        const formattedList = orderedSchedules.map((item, idx) => {
            let dObj = new Date(item.date + 'T00:00:00');
            let displayDate = item.date;
            let displayDay = item.day || 'Day';
            if (!isNaN(dObj.getTime())) {
                const dayNum = String(dObj.getDate()).padStart(2, '0');
                const monthName = dObj.toLocaleDateString('en-US', { month: 'short' });
                displayDate = `${dayNum} ${monthName}`;
                if (!item.day) {
                    displayDay = dObj.toLocaleDateString('en-US', { weekday: 'long' });
                }
            }

            return {
                id: item.id,
                date_iso: item.date,
                card_date: displayDate,
                card_day: displayDay,
                card_time: item.time_slot,
                department: item.department,
                topic: item.topic,
                competency_no: item.competency_no,
                faculty_name: item.faculty_name,
                teaching_type: item.teaching_type,
                venue: item.venue || 'Lecture Theatre 1 (LT-1)',
                subject: item.subject || 'Pathology',
                semester: item.semester || 'Semester - 5',
                batch_year: item.batch_year || '3rd Year MBBS',
                is_today: item.date === todayIso || item.status === 'Today' || idx === 0,
                status: item.status || 'Scheduled'
            };
        });

        const depts = db.prepare('SELECT DISTINCT department FROM academic_schedule ORDER BY department ASC').all().map(d => d.department);

        res.json({
            today_date: todayIso,
            total_sessions: formattedList.length,
            departments: depts,
            active_index: 0,
            active_schedule: formattedList.length > 0 ? formattedList[0] : null,
            schedules: formattedList
        });
    } catch (err) {
        console.error('Academic Schedule Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/academic/attendance/daily
 * Filterable day-wise attendance ledger.
 */
router.get(['/academic/attendance/daily', '/api/academic/attendance/daily'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const { month, status, subject, session_type, search } = req.query;

        let sql = 'SELECT * FROM student_attendance WHERE student_id = ?';
        const params = [studentId];

        if (subject && subject !== 'all') {
            sql += ' AND subject = ?';
            params.push(subject);
        }

        if (month && month !== 'all') {
            sql += ' AND date LIKE ?';
            params.push(`${month}%`);
        }

        if (status && status !== 'all') {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (session_type && session_type !== 'all') {
            sql += ' AND session_type LIKE ?';
            params.push(`%${session_type}%`);
        }

        if (search && search.trim()) {
            sql += ' AND (topic LIKE ? OR remarks LIKE ? OR faculty_name LIKE ? OR subject LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        sql += ' ORDER BY date DESC, id DESC';

        const records = db.prepare(sql).all(...params);

        // Fetch distinct available months for month filtering dropdown
        const monthsRows = db.prepare(`
            SELECT DISTINCT substr(date, 1, 7) as month_val 
            FROM student_attendance 
            WHERE student_id = ? 
            ORDER BY month_val DESC
        `).all(studentId);

        // Fetch distinct available subjects for subject filtering dropdown
        const subjectRows = db.prepare(`
            SELECT DISTINCT subject 
            FROM student_attendance 
            WHERE student_id = ? 
            ORDER BY subject ASC
        `).all(studentId);

        const availableMonths = monthsRows.map(r => r.month_val);
        const availableSubjects = subjectRows.map(r => r.subject);

        res.json({
            count: records.length,
            records,
            available_months: availableMonths,
            available_subjects: availableSubjects
        });
    } catch (err) {
        console.error('Attendance Daily Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// EXAMINATION APIS
// =========================================================================

/**
 * GET /api/academic/exams/summary
 * Returns overall examination GPA, Theory vs Practical averages, and distinctions count, filterable by academic year.
 */
router.get(['/academic/exams/summary', '/api/academic/exams/summary'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const student = getStudentMeta(studentId);
        const { year } = req.query;

        // Default to 3rd Year MBBS (2026) unless 'all' or specific year requested
        const selectedYear = year !== undefined ? year.toString().trim() : '3';

        let sql = 'SELECT * FROM student_exams WHERE student_id = ?';
        const params = [studentId];

        if (selectedYear !== 'all') {
            if (['1', '2', '3'].includes(selectedYear)) {
                sql += ' AND year_level = ?';
                params.push(parseInt(selectedYear, 10));
            } else {
                sql += ' AND (academic_year LIKE ? OR year_level = ?)';
                params.push(`%${selectedYear}%`, parseInt(selectedYear, 10) || 0);
            }
        }

        sql += ' ORDER BY exam_date DESC';
        const exams = db.prepare(sql).all(...params);

        const availableYears = [
            { year_level: 1, academic_year: '1st Year MBBS (2024)', short_label: '1st Year (2024)', is_current: false },
            { year_level: 2, academic_year: '2nd Year MBBS (2025)', short_label: '2nd Year (2025)', is_current: false },
            { year_level: 3, academic_year: '3rd Year MBBS (2026)', short_label: '3rd Year (2026)', is_current: true }
        ];

        if (exams.length === 0) {
            return res.json({
                student,
                selected_year: selectedYear,
                available_years: availableYears,
                total_exams: 0,
                passed_exams: 0,
                distinctions: 0,
                cumulative_overall: { obtained: 0, max: 0, percentage: 0 },
                cumulative_theory: { obtained: 0, max: 0, percentage: 0 },
                cumulative_practical: { obtained: 0, max: 0, percentage: 0 },
                standing: 'No Records',
                university_eligibility: { eligible: false, note: 'No exam records found.' }
            });
        }

        let totalTheoryObtained = 0;
        let totalTheoryMax = 0;
        let totalPracticalObtained = 0;
        let totalPracticalMax = 0;
        let grandObtained = 0;
        let grandMax = 0;
        let passedCount = 0;
        let distinctionsCount = 0;

        // IA Tracking for University Eligibility
        let iaTheoryObt = 0;
        let iaTheoryMax = 0;
        let iaPracObt = 0;
        let iaPracMax = 0;

        for (const ex of exams) {
            const isTwoPaper = ex.exam_type === 'Preliminary' || ex.exam_type === 'University';
            const tMax = isTwoPaper ? 200 : (ex.theory_max || 100);
            const tObt = ex.theory_obtained || 0;
            const pMax = ex.practical_max || 100;
            const pObt = ex.practical_obtained || 0;

            const totMax = ex.total_max || (tMax + pMax);
            const totObt = ex.total_obtained || (tObt + pObt);

            totalTheoryObtained += tObt;
            totalTheoryMax += tMax;
            totalPracticalObtained += pObt;
            totalPracticalMax += pMax;
            grandObtained += totObt;
            grandMax += totMax;

            if (ex.exam_type === 'IA-1' || ex.exam_type === 'IA-2') {
                iaTheoryObt += tObt;
                iaTheoryMax += tMax;
                iaPracObt += pObt;
                iaPracMax += pMax;
            }

            if (ex.status === 'Pass' || ex.status === 'Distinction') {
                passedCount++;
            }
            if (ex.status === 'Distinction' || (ex.grade && ex.grade.toLowerCase().includes('distinction'))) {
                distinctionsCount++;
            }
        }

        const grandPercentage = grandMax > 0 ? parseFloat(((grandObtained / grandMax) * 100).toFixed(1)) : 0;
        const theoryPercentage = totalTheoryMax > 0 ? parseFloat(((totalTheoryObtained / totalTheoryMax) * 100).toFixed(1)) : 0;
        const practicalPercentage = totalPracticalMax > 0 ? parseFloat(((totalPracticalObtained / totalPracticalMax) * 100).toFixed(1)) : 0;

        // Internal Assessment Eligibility (NMC Criterion: min 40% in theory, min 40% in practical, >= 50% combined)
        const iaTheoryPct = iaTheoryMax > 0 ? (iaTheoryObt / iaTheoryMax) * 100 : 0;
        const iaPracPct = iaPracMax > 0 ? (iaPracObt / iaPracMax) * 100 : 0;
        const iaCombinedPct = (iaTheoryMax + iaPracMax) > 0 ? ((iaTheoryObt + iaPracObt) / (iaTheoryMax + iaPracMax)) * 100 : 0;

        const isUnivEligible = iaTheoryPct >= 40.0 && iaPracPct >= 40.0 && iaCombinedPct >= 50.0;

        let standing = 'Pass';
        if (grandPercentage >= 75.0) standing = 'First Class with Distinction';
        else if (grandPercentage >= 65.0) standing = 'First Class';
        else if (grandPercentage >= 50.0) standing = 'Second Class';
        else standing = 'Remedial Required';

        res.json({
            student,
            selected_year: selectedYear,
            available_years: availableYears,
            assessment_scheme: {
                ia1: { theory_max: 100, practical_max: 100, total_max: 200 },
                ia2: { theory_max: 100, practical_max: 100, total_max: 200 },
                prelims: { paper1_max: 100, paper2_max: 100, theory_max: 200, practical_max: 100, total_max: 300 },
                university: { paper1_max: 100, paper2_max: 100, theory_max: 200, practical_max: 100, total_max: 300 }
            },
            total_exams: exams.length,
            passed_exams: passedCount,
            distinctions: distinctionsCount,
            cumulative_overall: {
                obtained: parseFloat(grandObtained.toFixed(1)),
                max: parseFloat(grandMax.toFixed(1)),
                percentage: grandPercentage
            },
            cumulative_theory: {
                obtained: parseFloat(totalTheoryObtained.toFixed(1)),
                max: parseFloat(totalTheoryMax.toFixed(1)),
                percentage: theoryPercentage
            },
            cumulative_practical: {
                obtained: parseFloat(totalPracticalObtained.toFixed(1)),
                max: parseFloat(totalPracticalMax.toFixed(1)),
                percentage: practicalPercentage
            },
            standing,
            university_eligibility: {
                eligible: isUnivEligible,
                ia_combined_pct: parseFloat(iaCombinedPct.toFixed(1)),
                ia_theory_pct: parseFloat(iaTheoryPct.toFixed(1)),
                ia_practical_pct: parseFloat(iaPracPct.toFixed(1)),
                note: isUnivEligible
                    ? 'Eligible for University Exam: IA Aggregate ≥ 50% (Theory ≥ 40% & Practical ≥ 40%) satisfied.'
                    : 'Remedial IA Assessment needed to satisfy 50% NMC requirement.'
            }
        });
    } catch (err) {
        console.error('Exams Summary Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/academic/exams/results
 * Returns full detailed cards with Paper 1, Paper 2, Theory, Practical breakdowns, pass/fail status, and faculty remarks.
 * Filterable by year, exam_type, subject, and search.
 */
router.get(['/academic/exams/results', '/api/academic/exams/results'], (req, res) => {
    try {
        const studentId = resolveStudentId(req);
        const { type, subject, search, year } = req.query;

        // Default to year 3 unless explicitly 'all' or another year
        const selectedYear = year !== undefined ? year.toString().trim() : '3';

        let sql = 'SELECT * FROM student_exams WHERE student_id = ?';
        const params = [studentId];

        if (selectedYear !== 'all') {
            if (['1', '2', '3'].includes(selectedYear)) {
                sql += ' AND year_level = ?';
                params.push(parseInt(selectedYear, 10));
            } else {
                sql += ' AND (academic_year LIKE ? OR year_level = ?)';
                params.push(`%${selectedYear}%`, parseInt(selectedYear, 10) || 0);
            }
        }

        if (type && type !== 'all') {
            sql += ' AND exam_type = ?';
            params.push(type);
        }

        if (subject && subject !== 'all') {
            sql += ' AND (subject LIKE ? OR subject_code = ?)';
            params.push(`%${subject}%`, subject);
        }

        if (search && search.trim()) {
            sql += ' AND (exam_name LIKE ? OR exam_code LIKE ? OR subject LIKE ? OR faculty_remarks LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        sql += ' ORDER BY exam_date DESC, id DESC';

        const exams = db.prepare(sql).all(...params);

        const formatted = exams.map(ex => {
            const isTwoPaper = ex.exam_type === 'Preliminary' || ex.exam_type === 'University';

            // Paper 1 & Paper 2 (for Prelims & University)
            const p1Obt = ex.paper1_obtained != null ? ex.paper1_obtained : (isTwoPaper ? 80.0 : null);
            const p1Max = ex.paper1_max || 100;
            const p1Pct = p1Obt != null ? parseFloat(((p1Obt / p1Max) * 100).toFixed(1)) : null;

            const p2Obt = ex.paper2_obtained != null ? ex.paper2_obtained : (isTwoPaper ? 80.0 : null);
            const p2Max = ex.paper2_max || 100;
            const p2Pct = p2Obt != null ? parseFloat(((p2Obt / p2Max) * 100).toFixed(1)) : null;

            // Theory
            const theoryMax = isTwoPaper ? 200 : (ex.theory_max || 100);
            const theoryObt = isTwoPaper ? (p1Obt + p2Obt) : (ex.theory_obtained || 0);
            const theoryPct = theoryMax > 0 ? parseFloat(((theoryObt / theoryMax) * 100).toFixed(1)) : 0;
            const theoryPassed = theoryPct >= 50.0;

            // Practical
            const pracObt = ex.practical_obtained || 0;
            const pracMax = ex.practical_max || 100;
            const pracPct = pracMax > 0 ? parseFloat(((pracObt / pracMax) * 100).toFixed(1)) : 0;
            const pracPassed = pracPct >= 50.0;

            // Total
            const totalMax = isTwoPaper ? 300 : (ex.total_max || (theoryMax + pracMax));
            const totalObt = ex.total_obtained || (theoryObt + pracObt);
            const totalPct = totalMax > 0 ? parseFloat(((totalObt / totalMax) * 100).toFixed(1)) : 0;

            return {
                id: ex.id,
                academic_year: ex.academic_year || '3rd Year MBBS (2026)',
                year_level: ex.year_level || 3,
                exam_code: ex.exam_code,
                exam_name: ex.exam_name,
                exam_type: ex.exam_type || (isTwoPaper ? 'Preliminary' : 'IA-1'),
                exam_date: ex.exam_date,
                term: ex.term || ex.exam_type,
                subject_code: ex.subject_code || '2010043342',
                subject: ex.subject,
                is_two_paper: isTwoPaper,
                paper1: isTwoPaper ? {
                    name: 'Theory Paper I',
                    obtained: p1Obt,
                    max: p1Max,
                    percentage: p1Pct,
                    passed: p1Pct >= 40.0
                } : null,
                paper2: isTwoPaper ? {
                    name: 'Theory Paper II',
                    obtained: p2Obt,
                    max: p2Max,
                    percentage: p2Pct,
                    passed: p2Pct >= 40.0
                } : null,
                theory: {
                    name: isTwoPaper ? 'Combined Theory (Paper 1 + 2)' : 'Theory Written',
                    obtained: parseFloat(theoryObt.toFixed(1)),
                    max: theoryMax,
                    percentage: theoryPct,
                    passed: theoryPassed
                },
                practical: {
                    name: 'Practical & OSPE / Clinical',
                    obtained: parseFloat(pracObt.toFixed(1)),
                    max: pracMax || 100,
                    percentage: pracPct,
                    passed: pracPassed
                },
                total: {
                    obtained: parseFloat(totalObt.toFixed(1)),
                    max: totalMax,
                    percentage: totalPct
                },
                grade: ex.grade || 'A',
                status: ex.status || 'Pass',
                faculty_remarks: ex.faculty_remarks || ''
            };
        });

        // Compute counts specifically for this academic year (without type or subject filters)
        let countSql = 'SELECT exam_type, count(*) as count FROM student_exams WHERE student_id = ?';
        const countParams = [studentId];
        if (selectedYear !== 'all') {
            if (['1', '2', '3'].includes(selectedYear)) {
                countSql += ' AND year_level = ?';
                countParams.push(parseInt(selectedYear, 10));
            } else {
                countSql += ' AND (academic_year LIKE ? OR year_level = ?)';
                countParams.push(`%${selectedYear}%`, parseInt(selectedYear, 10) || 0);
            }
        }
        countSql += ' GROUP BY exam_type';
        const typeCountRows = db.prepare(countSql).all(...countParams);

        let totalYearCount = 0;
        const countsByType = { all: 0, 'IA-1': 0, 'IA-2': 0, Preliminary: 0, University: 0 };
        for (const row of typeCountRows) {
            countsByType[row.exam_type] = row.count;
            totalYearCount += row.count;
        }
        countsByType.all = totalYearCount;

        // Distinct available exam types & subjects for this year
        let subjectSql = 'SELECT DISTINCT subject_code, subject FROM student_exams WHERE student_id = ?';
        const subjectParams = [studentId];
        if (selectedYear !== 'all') {
            if (['1', '2', '3'].includes(selectedYear)) {
                subjectSql += ' AND year_level = ?';
                subjectParams.push(parseInt(selectedYear, 10));
            } else {
                subjectSql += ' AND (academic_year LIKE ? OR year_level = ?)';
                subjectParams.push(`%${selectedYear}%`, parseInt(selectedYear, 10) || 0);
            }
        }
        subjectSql += ' ORDER BY subject ASC';
        const subjectRows = db.prepare(subjectSql).all(...subjectParams);

        const availableYears = [
            { year_level: 1, academic_year: '1st Year MBBS (2024)', short_label: '1st Year (2024)', is_current: false },
            { year_level: 2, academic_year: '2nd Year MBBS (2025)', short_label: '2nd Year (2025)', is_current: false },
            { year_level: 3, academic_year: '3rd Year MBBS (2026)', short_label: '3rd Year (2026)', is_current: true }
        ];

        res.json({
            selected_year: selectedYear,
            available_years: availableYears,
            count: formatted.length,
            counts_by_type: countsByType,
            exams: formatted,
            available_types: ['IA-1', 'IA-2', 'Preliminary', 'University'],
            available_subjects: subjectRows
        });
    } catch (err) {
        console.error('Exams Results Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// FACULTY & ADMINISTRATIVE ACADEMIC APIS (ATTENDANCE & EXAM RESULTS)
// =========================================================================

/**
 * GET /api/admin/academic/meta
 * Returns curriculum metadata: batches, subjects, timetable slots, exam types.
 */
router.get(['/admin/academic/meta', '/api/admin/academic/meta'], (req, res) => {
    try {
        const batches = [
            '3rd Year MBBS',
            '2nd Year MBBS',
            '1st Year MBBS',
            'Final Year MBBS Part 1',
            'Final Year MBBS Part 2',
            'CRMI Intern Doctor'
        ];

        const subjects = [
            { code: '2010043342', name: '2010043342 – COMMUNITY MEDICINE (PSM)', short_name: 'Community Medicine (PSM)', default_faculty: 'DRASHTI R SONI', default_room: 'LT-2' },
            { code: '2010043410', name: '2010043410 – OPHTHALMOLOGY', short_name: 'Ophthalmology', default_faculty: 'DR. NEHA SHAH', default_room: 'LT-1' },
            { code: '2010043425', name: '2010043425 – OTORHINOLARYNGOLOGY (ENT)', short_name: 'ENT', default_faculty: 'DR. ANAND DESAI', default_room: 'LT-2' },
            { code: '2010043320', name: '2010043320 – FORENSIC MEDICINE & TOXICOLOGY', short_name: 'Forensic Medicine (FMT)', default_faculty: 'DR. K. M. PATEL', default_room: 'LT-3' },
            { code: '2010043375', name: '2010043375 – GENERAL SURGERY', short_name: 'General Surgery', default_faculty: 'DR. S. K. MEHTA', default_room: 'LT-1' },
            { code: '2010043350', name: '2010043350 – GENERAL MEDICINE', short_name: 'General Medicine', default_faculty: 'DR. RAJESH VERMA', default_room: 'LT-2' },
            { code: '2010043360', name: '2010043360 – OBSTETRICS & GYNAECOLOGY', short_name: 'OBGYN', default_faculty: 'DR. POOJA JOSHI', default_room: 'LT-3' },
            { code: '2010043380', name: '2010043380 – PAEDIATRICS', short_name: 'Paediatrics', default_faculty: 'DR. MANISH TRIVEDI', default_room: 'LT-2' }
        ];

        const timeSlots = [
            { lecture_no: 1, time: '08:10 to 08:55' },
            { lecture_no: 2, time: '08:55 to 09:40' },
            { lecture_no: 3, time: '09:50 to 10:35' },
            { lecture_no: 4, time: '10:35 to 11:20' },
            { lecture_no: 5, time: '11:30 to 12:15' },
            { lecture_no: 6, time: '12:15 to 01:00' },
            { lecture_no: 7, time: '02:00 to 04:00 (Clinical / Practical)' }
        ];

        const examTypes = [
            { type: 'IA-1', name: 'Internal Assessment I', is_two_paper: false, theory_max: 100, practical_max: 100, total_max: 200 },
            { type: 'IA-2', name: 'Internal Assessment II', is_two_paper: false, theory_max: 100, practical_max: 100, total_max: 200 },
            { type: 'Preliminary', name: 'Preliminary Examination', is_two_paper: true, paper1_max: 100, paper2_max: 100, theory_max: 200, practical_max: 100, total_max: 300 },
            { type: 'University', name: 'University Annual Examination', is_two_paper: true, paper1_max: 100, paper2_max: 100, theory_max: 200, practical_max: 100, total_max: 300 }
        ];

        const academicYears = [
            { year_level: 3, label: '3rd Year MBBS (2026)', current: true },
            { year_level: 2, label: '2nd Year MBBS (2025)', current: false },
            { year_level: 1, label: '1st Year MBBS (2024)', current: false }
        ];

        res.json({
            batches,
            subjects,
            time_slots: timeSlots,
            exam_types: examTypes,
            academic_years: academicYears
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/academic/attendance/sheet
 * Returns student roster for a date, lecture_no, and batch with their current attendance status
 */
router.get(['/admin/academic/attendance/sheet', '/api/admin/academic/attendance/sheet'], (req, res) => {
    try {
        const { date, batch, lecture_no, subject_code } = req.query;
        const targetDate = date ? date.trim() : new Date().toISOString().split('T')[0];
        const lectureNum = parseInt(lecture_no, 10) || 1;

        let studentSql = 'SELECT id, roll_number, name, batch_year, posting_unit, status as cadet_status FROM students';
        const params = [];
        if (batch && batch !== 'all') {
            studentSql += ' WHERE batch_year LIKE ?';
            params.push(`%${batch.trim()}%`);
        }
        studentSql += ' ORDER BY CAST(roll_number AS INTEGER) ASC, roll_number ASC, id ASC';
        const students = db.prepare(studentSql).all(...params);

        // Fetch existing attendance records for this date and lecture_no
        const attendanceRecords = db.prepare(`
            SELECT * FROM student_attendance 
            WHERE date = ? AND lecture_no = ?
        `).all(targetDate, lectureNum);

        const recordMap = new Map();
        for (const r of attendanceRecords) {
            recordMap.set(r.student_id, r);
        }

        let present = 0, absent = 0, leave = 0, fieldDuty = 0, notMarked = 0;
        let commonSession = null;

        const roster = students.map(s => {
            const rec = recordMap.get(s.id);
            const status = rec ? rec.status : 'Not Marked';

            if (status === 'Present') present++;
            else if (status === 'Absent') absent++;
            else if (status === 'Leave') leave++;
            else if (status === 'Field Duty') fieldDuty++;
            else notMarked++;

            if (rec && !commonSession) {
                commonSession = {
                    subject: rec.subject,
                    subject_code: rec.subject_code,
                    session_type: rec.session_type,
                    faculty_name: rec.faculty_name,
                    room_no: rec.room_no,
                    time_slot: rec.time_slot,
                    topic: rec.topic
                };
            }

            return {
                student_id: s.id,
                roll_number: s.roll_number,
                name: s.name,
                batch_year: s.batch_year,
                posting_unit: s.posting_unit,
                status,
                remarks: rec ? (rec.remarks || '') : '',
                record_id: rec ? rec.id : null
            };
        });

        res.json({
            date: targetDate,
            lecture_no: lectureNum,
            batch: batch || 'all',
            session_info: commonSession,
            summary: {
                total: roster.length,
                present,
                absent,
                leave,
                field_duty: fieldDuty,
                not_marked: notMarked
            },
            students: roster
        });
    } catch (err) {
        console.error('Admin Attendance Sheet Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/academic/attendance
 * Saves or updates student attendance for a date, lecture_no, and subject
 */
router.post(['/admin/academic/attendance', '/api/admin/academic/attendance'], (req, res) => {
    try {
        const {
            date,
            lecture_no,
            room_no,
            time_slot,
            subject_code,
            subject,
            session_type,
            faculty_name,
            topic,
            attendance
        } = req.body;

        if (!date || !lecture_no || !subject || !Array.isArray(attendance)) {
            return res.status(400).json({ error: 'date, lecture_no, subject, and attendance array are required.' });
        }

        const targetDate = date.trim();
        const lectureNum = parseInt(lecture_no, 10);
        const sType = session_type || 'Theory';
        const fName = faculty_name || 'FACULTY';
        const sCode = subject_code || '2010043342';
        const rNo = room_no || '';
        const tSlot = time_slot || '08:10 to 08:55';
        const tTopic = topic || '';

        const checkStmt = db.prepare('SELECT id FROM student_attendance WHERE student_id = ? AND date = ? AND lecture_no = ?');
        const updateStmt = db.prepare(`
            UPDATE student_attendance 
            SET room_no = ?, time_slot = ?, subject_code = ?, subject = ?, session_type = ?, faculty_name = ?, status = ?, topic = ?, remarks = ?
            WHERE id = ?
        `);
        const insertStmt = db.prepare(`
            INSERT INTO student_attendance (student_id, date, lecture_no, room_no, time_slot, subject_code, subject, session_type, faculty_name, status, hours, topic, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?)
        `);

        let present = 0, absent = 0, leave = 0, fieldDuty = 0, notMarked = 0;

        try {
            db.exec('BEGIN');
            for (const item of attendance) {
                const sId = parseInt(item.student_id, 10);
                const status = item.status || 'Present';
                const remarks = item.remarks || '';

                if (status === 'Present') present++;
                else if (status === 'Absent') absent++;
                else if (status === 'Leave') leave++;
                else if (status === 'Field Duty') fieldDuty++;
                else notMarked++;

                const existing = checkStmt.get(sId, targetDate, lectureNum);
                if (existing) {
                    updateStmt.run(rNo, tSlot, sCode, subject, sType, fName, status, tTopic, remarks, existing.id);
                } else {
                    insertStmt.run(sId, targetDate, lectureNum, rNo, tSlot, sCode, subject, sType, fName, status, tTopic, remarks);
                }
            }
            db.exec('COMMIT');
        } catch (txnErr) {
            try { db.exec('ROLLBACK'); } catch (_) {}
            throw txnErr;
        }

        res.json({
            success: true,
            message: `Attendance marked successfully for ${attendance.length} students.`,
            summary: {
                total: attendance.length,
                present,
                absent,
                leave,
                field_duty: fieldDuty,
                not_marked: notMarked
            }
        });
    } catch (err) {
        console.error('Admin Save Attendance Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/academic/attendance/history
 * Returns historical logs with filters
 */
router.get(['/admin/academic/attendance/history', '/api/admin/academic/attendance/history'], (req, res) => {
    try {
        const { date, date_from, date_to, status, subject, search, limit } = req.query;
        let sql = `
            SELECT a.*, s.name as student_name, s.roll_number, s.batch_year
            FROM student_attendance a
            JOIN students s ON a.student_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            sql += ' AND a.date = ?';
            params.push(date.trim());
        }
        if (date_from) {
            sql += ' AND a.date >= ?';
            params.push(date_from.trim());
        }
        if (date_to) {
            sql += ' AND a.date <= ?';
            params.push(date_to.trim());
        }
        if (status && status !== 'all') {
            sql += ' AND a.status = ?';
            params.push(status);
        }
        if (subject && subject !== 'all') {
            sql += ' AND (a.subject LIKE ? OR a.subject_code = ?)';
            params.push(`%${subject}%`, subject);
        }
        if (search && search.trim()) {
            sql += ' AND (s.name LIKE ? OR s.roll_number LIKE ? OR a.topic LIKE ? OR a.faculty_name LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        sql += ' ORDER BY a.date DESC, a.lecture_no ASC, CAST(s.roll_number AS INTEGER) ASC LIMIT ?';
        params.push(parseInt(limit, 10) || 100);

        const logs = db.prepare(sql).all(...params);
        res.json({ count: logs.length, records: logs });
    } catch (err) {
        console.error('Admin Attendance History Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/admin/academic/attendance/:id
 * Delete specific attendance record
 */
router.delete(['/admin/academic/attendance/:id', '/api/admin/academic/attendance/:id'], (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        db.prepare('DELETE FROM student_attendance WHERE id = ?').run(id);
        res.json({ success: true, message: 'Attendance record removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/academic/exams/sheet
 * Returns class marksheet for year_level, exam_type, and subject
 */
router.get(['/admin/academic/exams/sheet', '/api/admin/academic/exams/sheet'], (req, res) => {
    try {
        const { year_level, exam_type, subject_code } = req.query;
        const yLevel = parseInt(year_level, 10) || 3;
        const eType = exam_type || 'IA-1';
        const isTwoPaper = eType === 'Preliminary' || eType === 'University';

        let studentSql = 'SELECT id, roll_number, name, batch_year FROM students ORDER BY CAST(roll_number AS INTEGER) ASC, roll_number ASC, id ASC';
        const students = db.prepare(studentSql).all();

        // Fetch existing exam records for this subject and exam_type
        let examSql = 'SELECT * FROM student_exams WHERE year_level = ? AND exam_type = ?';
        const examParams = [yLevel, eType];
        if (subject_code) {
            examSql += ' AND (subject_code = ? OR subject LIKE ?)';
            examParams.push(subject_code, `%${subject_code}%`);
        }
        const existingExams = db.prepare(examSql).all(...examParams);

        const examMap = new Map();
        for (const ex of existingExams) {
            examMap.set(ex.student_id, ex);
        }

        let passedCount = 0, failedCount = 0, distinctionCount = 0;
        let totalPctSum = 0, scoredCount = 0;

        const marksheet = students.map(s => {
            const ex = examMap.get(s.id);

            const p1 = ex ? ex.paper1_obtained : null;
            const p2 = ex ? ex.paper2_obtained : null;
            const th = ex ? ex.theory_obtained : null;
            const pr = ex ? ex.practical_obtained : null;
            const vv = ex ? ex.viva_obtained : null;

            const tMax = isTwoPaper ? 200 : 100;
            const pMax = 100;
            const totMax = isTwoPaper ? 300 : 200;

            let totObt = null;
            let pct = null;
            let status = 'Not Entered';
            let grade = '-';

            if (ex && (ex.theory_obtained != null || ex.practical_obtained != null)) {
                totObt = ex.total_obtained != null ? ex.total_obtained : ((th || 0) + (pr || 0));
                pct = totMax > 0 ? parseFloat(((totObt / totMax) * 100).toFixed(1)) : 0;
                status = ex.status || (pct >= 50 ? 'Pass' : 'Fail');
                grade = ex.grade || (pct >= 75 ? 'Distinction' : (pct >= 65 ? 'A' : (pct >= 50 ? 'B' : 'F')));

                scoredCount++;
                totalPctSum += pct;
                if (status === 'Distinction') distinctionCount++;
                if (status === 'Pass' || status === 'Distinction') passedCount++;
                else if (status === 'Fail') failedCount++;
            }

            return {
                student_id: s.id,
                roll_number: s.roll_number,
                name: s.name,
                batch_year: s.batch_year,
                exam_id: ex ? ex.id : null,
                exam_code: ex ? ex.exam_code : `${eType}-${yLevel}`,
                exam_date: ex ? ex.exam_date : new Date().toISOString().split('T')[0],
                paper1_obtained: p1,
                paper1_max: 100,
                paper2_obtained: p2,
                paper2_max: 100,
                theory_obtained: th,
                theory_max: tMax,
                practical_obtained: pr,
                practical_max: pMax,
                viva_obtained: vv,
                viva_max: 20,
                total_obtained: totObt,
                total_max: totMax,
                percentage: pct,
                grade,
                status,
                faculty_remarks: ex ? (ex.faculty_remarks || '') : ''
            };
        });

        const classAverage = scoredCount > 0 ? parseFloat((totalPctSum / scoredCount).toFixed(1)) : 0;
        const passPct = scoredCount > 0 ? parseFloat(((passedCount / scoredCount) * 100).toFixed(1)) : 0;

        res.json({
            year_level: yLevel,
            exam_type: eType,
            subject_code: subject_code || '2010043342',
            is_two_paper: isTwoPaper,
            class_stats: {
                total_cadets: students.length,
                scored_cadets: scoredCount,
                passed_cadets: passedCount,
                failed_cadets: failedCount,
                distinctions: distinctionCount,
                pass_percentage: passPct,
                class_average: classAverage
            },
            marksheet
        });
    } catch (err) {
        console.error('Admin Exams Sheet Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/academic/exams
 * Saves or updates student marks for year_level, exam_type, and subject
 */
router.post(['/admin/academic/exams', '/api/admin/academic/exams'], (req, res) => {
    try {
        const {
            academic_year,
            year_level,
            exam_type,
            exam_code,
            exam_name,
            exam_date,
            subject_code,
            subject,
            results
        } = req.body;

        if (!year_level || !exam_type || !subject || !Array.isArray(results)) {
            return res.status(400).json({ error: 'year_level, exam_type, subject, and results array are required.' });
        }

        const yLevel = parseInt(year_level, 10);
        const eType = exam_type.trim();
        const isTwoPaper = eType === 'Preliminary' || eType === 'University';
        const eCode = exam_code || `${eType}-${subject_code || 'EXAM'}-${yLevel}`;
        const eName = exam_name || `${eType} Examination`;
        const eDate = exam_date || new Date().toISOString().split('T')[0];
        const sCode = subject_code || '2010043342';
        const aYear = academic_year || (yLevel === 3 ? '3rd Year MBBS (2026)' : (yLevel === 2 ? '2nd Year MBBS (2025)' : '1st Year MBBS (2024)'));

        const checkStmt = db.prepare('SELECT id FROM student_exams WHERE student_id = ? AND year_level = ? AND exam_type = ? AND subject_code = ?');
        const updateStmt = db.prepare(`
            UPDATE student_exams 
            SET exam_code = ?, exam_name = ?, exam_date = ?, term = ?, subject = ?,
                paper1_obtained = ?, paper1_max = ?, paper2_obtained = ?, paper2_max = ?,
                theory_obtained = ?, theory_max = ?, practical_obtained = ?, practical_max = ?,
                viva_obtained = ?, viva_max = ?, total_obtained = ?, total_max = ?,
                grade = ?, status = ?, faculty_remarks = ?
            WHERE id = ?
        `);
        const insertStmt = db.prepare(`
            INSERT INTO student_exams (
                student_id, exam_code, exam_name, exam_date, term, subject_code, subject,
                exam_type, academic_year, year_level,
                paper1_obtained, paper1_max, paper2_obtained, paper2_max,
                theory_obtained, theory_max, practical_obtained, practical_max,
                viva_obtained, viva_max, total_obtained, total_max,
                grade, status, faculty_remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let passed = 0, failed = 0, distinction = 0;

        try {
            db.exec('BEGIN');
            for (const r of results) {
                const sId = parseInt(r.student_id, 10);

                let p1 = r.paper1_obtained != null && r.paper1_obtained !== '' ? parseFloat(r.paper1_obtained) : null;
                let p2 = r.paper2_obtained != null && r.paper2_obtained !== '' ? parseFloat(r.paper2_obtained) : null;
                let th = r.theory_obtained != null && r.theory_obtained !== '' ? parseFloat(r.theory_obtained) : null;
                let pr = r.practical_obtained != null && r.practical_obtained !== '' ? parseFloat(r.practical_obtained) : 0;
                let vv = r.viva_obtained != null && r.viva_obtained !== '' ? parseFloat(r.viva_obtained) : 0;

                const p1Max = 100;
                const p2Max = 100;
                const tMax = isTwoPaper ? 200 : 100;
                const pMax = 100;
                const totMax = isTwoPaper ? 300 : 200;

                if (isTwoPaper) {
                    th = (p1 || 0) + (p2 || 0);
                } else {
                    p1 = null;
                    p2 = null;
                }

                const totObt = (th != null ? th : 0) + (pr != null ? pr : 0);
                const pct = totMax > 0 ? parseFloat(((totObt / totMax) * 100).toFixed(1)) : 0;

                let status = r.status;
                if (!status || status === 'Auto') {
                    if (r.is_absent || status === 'Absent') {
                        status = 'Absent';
                    } else if (pct >= 75.0) {
                        status = 'Distinction';
                    } else if (pct >= 50.0 && (!isTwoPaper || ((p1 || 0) >= 40 && (p2 || 0) >= 40)) && (pr >= 40)) {
                        status = 'Pass';
                    } else {
                        status = 'Fail';
                    }
                }

                let grade = 'F';
                if (status === 'Distinction') grade = 'Distinction';
                else if (status === 'Pass') grade = pct >= 65 ? 'A' : 'B';
                else if (status === 'Absent') grade = 'Absent';

                if (status === 'Distinction') distinction++;
                if (status === 'Pass' || status === 'Distinction') passed++;
                else if (status === 'Fail') failed++;

                const remarks = r.faculty_remarks || '';

                const existing = checkStmt.get(sId, yLevel, eType, sCode);
                if (existing) {
                    updateStmt.run(
                        eCode, eName, eDate, eType, subject,
                        p1, p1Max, p2, p2Max,
                        th, tMax, pr, pMax,
                        vv, 20, totObt, totMax,
                        grade, status, remarks,
                        existing.id
                    );
                } else {
                    insertStmt.run(
                        sId, eCode, eName, eDate, eType, sCode, subject,
                        eType, aYear, yLevel,
                        p1, p1Max, p2, p2Max,
                        th, tMax, pr, pMax,
                        vv, 20, totObt, totMax,
                        grade, status, remarks
                    );
                }
            }
            db.exec('COMMIT');
        } catch (txnErr) {
            try { db.exec('ROLLBACK'); } catch (_) {}
            throw txnErr;
        }

        res.json({
            success: true,
            message: `Examination marks saved successfully for ${results.length} students.`,
            summary: {
                total: results.length,
                passed,
                failed,
                distinction
            }
        });
    } catch (err) {
        console.error('Admin Save Exams Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

