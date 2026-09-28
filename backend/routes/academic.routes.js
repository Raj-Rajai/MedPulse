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

module.exports = router;
