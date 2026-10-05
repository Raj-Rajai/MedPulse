import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { cleanList, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

/* ------------------------------------------------------------------ */
/* Constants and pure helpers                                          */
/* ------------------------------------------------------------------ */

/** Subjects offered by the admin consoles (same codes and names as the web app's SUBJECTS list). */
export const DEFAULT_SUBJECTS: { code: string; name: string; default_faculty: string | null; default_room: string | null }[] = [
    { code: 'PA-301', name: 'Department of Pathology', default_faculty: 'Dr. Ramesh Mehta (Prof & HOD)', default_room: 'Lecture Theatre 1 (LT-1)' },
    { code: '2010043342', name: 'Community Medicine (PSM)', default_faculty: 'DRASHTI R SONI', default_room: 'LT-2' },
    { code: '2010043410', name: 'Ophthalmology', default_faculty: null, default_room: null },
    { code: '2010043425', name: 'ENT (Otorhinolaryngology)', default_faculty: null, default_room: null },
    { code: '2010043320', name: 'Forensic Medicine (FMT)', default_faculty: null, default_room: null },
    { code: '2010043375', name: 'General Surgery', default_faculty: null, default_room: null },
    { code: '2010043350', name: 'General Medicine', default_faculty: null, default_room: null },
    { code: '2010043360', name: 'Obstetrics & Gynaecology', default_faculty: null, default_room: null },
    { code: '2010043380', name: 'Paediatrics', default_faculty: null, default_room: null },
];

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Leave', 'Field Duty'] as const;
export const EXAM_TYPES = ['IA-1', 'IA-2', 'Preliminary', 'University'] as const;
const EXAM_TYPE_ORDER: Record<string, number> = { University: 1, Preliminary: 2, 'IA-2': 3, 'IA-1': 4 };
const TERM_LABEL: Record<string, string> = { 'IA-1': 'IA-1', 'IA-2': 'IA-2', Preliminary: 'Pre-lims', University: 'University' };
/** Batch prefix of the students who sit a year's exams (students.batch_year starts with it). */
const YEAR_BATCH: Record<number, string> = { 1: '1st Year MBBS', 2: '2nd Year MBBS', 3: '3rd Year MBBS' };
/** Fallback the web app shows when a student has no batch_year. */
const DEFAULT_BATCH = '3rd Year MBBS';
const NMC_THEORY_MIN = 75;
const NMC_PRACTICAL_MIN = 80;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : 0);
const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());

export function isIsoDate(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2010043342 – Community Medicine (PSM)" (the console's option label) -> "Community Medicine (PSM)". */
function subjectName(code: string, label: unknown): string {
    const raw = text(label);
    const stripped = raw.replace(/^\s*\d+\s*[–—-]\s*/, '').trim();
    return stripped || DEFAULT_SUBJECTS.find((s) => s.code === code)?.name || code;
}

function semesterOf(batch: unknown): string {
    const b = text(batch).toLowerCase();
    if (b.startsWith('1st')) return 'Semester - 1';
    if (b.startsWith('2nd')) return 'Semester - 3';
    if (b.startsWith('final')) return 'Semester - 7';
    if (b.includes('intern')) return 'Internship';
    return 'Semester - 5';
}

/**
 * A mark as sent by the marksheet console: number, numeric string, '' / null (not entered).
 * Returns null when not entered, NaN when not a number.
 */
function markValue(v: unknown): number | null {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : NaN;
}

export interface ComputedMarks {
    paper1_obtained: number | null;
    paper2_obtained: number | null;
    theory_obtained: number;
    practical_obtained: number;
    viva_obtained: number;
    total_obtained: number;
    total_max: number;
    percentage: number;
    status: 'Distinction' | 'Pass' | 'Fail';
}

/**
 * Same maths as the marksheet console (examLogic.recalculate): theory = paper 1 + paper 2 for
 * two-paper exams, total = theory + practical (viva is recorded but not added), Distinction at 75%,
 * Pass at 50% with practical >= 40 and, for two-paper exams, both papers >= 40.
 * Returns null when nothing was entered for the student.
 */
export function computeMarks(r: Row, isTwoPaper: boolean, label: string): ComputedMarks | null {
    const p1 = markValue(r.paper1_obtained);
    const p2 = markValue(r.paper2_obtained);
    const th = markValue(r.theory_obtained);
    const pr = markValue(r.practical_obtained);
    const vv = markValue(r.viva_obtained);

    const check = (name: string, v: number | null, max: number) => {
        if (v === null) return;
        if (isNaN(v) || v < 0 || v > max) throw new StatusError(`${name} for ${label} must be a number from 0 to ${max}`, 400);
    };
    if (isTwoPaper) {
        check('Paper 1 marks', p1, 100);
        check('Paper 2 marks', p2, 100);
    } else {
        check('Theory marks', th, 100);
    }
    check('Practical marks', pr, 100);
    check('Viva marks', vv, 20);

    // The console sends practical/viva as 0 when left blank, so a row only counts as entered
    // when it has theory (or paper) marks, a non-zero practical or a non-zero viva.
    const hasTheory = isTwoPaper ? p1 !== null || p2 !== null : th !== null;
    if (!hasTheory && !pr && !vv) return null;

    const paper1 = isTwoPaper ? p1 || 0 : null;
    const paper2 = isTwoPaper ? p2 || 0 : null;
    const theory = isTwoPaper ? (paper1 as number) + (paper2 as number) : th || 0;
    const practical = pr || 0;
    const viva = vv || 0;
    const totalMax = isTwoPaper ? 300 : 200;
    const total = theory + practical;
    const percentage = parseFloat(((total / totalMax) * 100).toFixed(1));

    let status: ComputedMarks['status'] = 'Fail';
    if (percentage >= 75.0) status = 'Distinction';
    else if (percentage >= 50.0 && (!isTwoPaper || ((paper1 as number) >= 40 && (paper2 as number) >= 40)) && practical >= 40) status = 'Pass';

    return {
        paper1_obtained: paper1,
        paper2_obtained: paper2,
        theory_obtained: theory,
        practical_obtained: practical,
        viva_obtained: viva,
        total_obtained: total,
        total_max: totalMax,
        percentage,
        status,
    };
}

const isTwoPaperType = (t: unknown) => t === 'Preliminary' || t === 'University';

function gradeOf(status: string, percentage: number): string {
    if (status === 'Absent') return 'AB';
    if (status === 'Fail') return 'F (Remedial)';
    if (status === 'Distinction' || percentage >= 75) return 'A+ Distinction';
    if (percentage >= 65) return 'A';
    if (percentage >= 60) return 'B+';
    return 'B';
}

function standingOf(percentage: number, total: number, failed: number): string {
    if (total === 0) return 'Awaiting Assessments';
    if (failed > 0 && percentage < 50) return 'Remedial Required';
    if (percentage >= 75) return 'First Class with Distinction';
    if (percentage >= 60) return 'First Class';
    if (percentage >= 50) return 'Second Class';
    return 'Remedial Required';
}

/** Students of `batch` ('all' = every batch). Students without a batch count as the default batch. */
const BATCH_SQL = `(? = 'all' OR substr(lower(COALESCE(NULLIF(TRIM(s.batch_year), ''), '${DEFAULT_BATCH}')), 1, length(?)) = lower(?))`;
const ACTIVE_SQL = `COALESCE(s.status, 'Active') != 'Inactive'`;
const ROLL_ORDER = 'ORDER BY CAST(s.roll_number AS INTEGER), s.roll_number, s.id';

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

@Injectable()
export class AcademicModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    private transaction<T>(fn: () => T): T {
        this.db.exec('BEGIN');
        try {
            const out = fn();
            this.db.exec('COMMIT');
            return out;
        } catch (e) {
            this.db.exec('ROLLBACK');
            throw e;
        }
    }

    /** College an admin manages (admins.university_id references colleges(id)). */
    static collegeOfAdmin(admin: Row): number {
        return Number(admin.university_id || admin.college_id || 1);
    }

    private upsertSubject(collegeId: number, code: string, name: string, faculty: string | null, room: string | null) {
        this.db.prepare(`
            INSERT INTO academic_subjects (college_id, code, name, default_faculty, default_room)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (college_id, code) DO UPDATE SET
                name = excluded.name,
                default_faculty = COALESCE(excluded.default_faculty, academic_subjects.default_faculty),
                default_room = COALESCE(excluded.default_room, academic_subjects.default_room),
                updated_at = CURRENT_TIMESTAMP
        `).run(collegeId, code, name, faculty, room);
    }

    private studentInCollege(collegeId: number, studentId: unknown): Row | undefined {
        return this.db.prepare('SELECT s.id, s.roll_number, s.name FROM students s WHERE s.id = ? AND s.college_id = ?').get(studentId, collegeId);
    }

    /* ======================= Admin: meta ======================= */

    getMeta(collegeId: number): Row {
        const saved = cleanList(this.db.prepare('SELECT code, name, default_faculty, default_room FROM academic_subjects WHERE college_id = ? ORDER BY name').all(collegeId));
        const byCode = new Map<string, Row>();
        for (const s of DEFAULT_SUBJECTS) byCode.set(s.code, { ...s });
        for (const s of saved) {
            const base = byCode.get(s.code) || {};
            byCode.set(s.code, {
                code: s.code,
                name: s.name || base.name,
                default_faculty: s.default_faculty || base.default_faculty || null,
                default_room: s.default_room || base.default_room || null,
            });
        }
        return {
            subjects: [...byCode.values()],
            exam_types: [...EXAM_TYPES],
            attendance_statuses: [...ATTENDANCE_STATUSES],
        };
    }

    /* ======================= Admin: attendance ======================= */

    getAttendanceSheet(collegeId: number, q: Row): Row {
        const date = q.date === undefined || q.date === '' ? todayIso() : q.date;
        if (!isIsoDate(date)) throw new StatusError('date must be a valid YYYY-MM-DD date', 400);
        const lectureNo = q.lecture_no === undefined || q.lecture_no === '' ? 1 : parseInt(String(q.lecture_no), 10);
        if (!Number.isInteger(lectureNo) || lectureNo < 1 || lectureNo > 12) throw new StatusError('lecture_no must be a number from 1 to 12', 400);
        const batch = text(q.batch) || 'all';

        const students = cleanList(this.db.prepare(`
            SELECT s.id AS student_id, s.roll_number, s.name, s.posting_unit, s.batch_year,
                   a.id AS record_id, COALESCE(a.status, 'Not Marked') AS status, COALESCE(a.remarks, '') AS remarks,
                   a.lecture_id
            FROM students s
            LEFT JOIN academic_attendance a ON a.student_id = s.id AND a.lecture_date = ? AND a.lecture_no = ?
            WHERE s.college_id = ? AND ${BATCH_SQL} AND (${ACTIVE_SQL} OR a.id IS NOT NULL)
            ${ROLL_ORDER}
        `).all(date, lectureNo, collegeId, batch, batch, batch));

        // Session details: the lecture most of this cohort was marked in for the slot.
        const counts = new Map<number, number>();
        for (const s of students) if (s.lecture_id) counts.set(s.lecture_id, (counts.get(s.lecture_id) || 0) + 1);
        let sessionInfo: Row | null = null;
        if (counts.size) {
            const lectureId = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
            const l = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ?').get(lectureId);
            if (l) {
                sessionInfo = {
                    lecture_id: l.id,
                    subject_code: l.subject_code,
                    subject: l.subject_name,
                    session_type: l.session_type,
                    room_no: l.room_no,
                    time_slot: l.time_slot,
                    faculty_name: l.faculty_name,
                    topic: l.topic,
                };
            }
        }
        for (const s of students) delete s.lecture_id;

        return { date, lecture_no: lectureNo, batch, students, session_info: sessionInfo };
    }

    saveAttendance(collegeId: number, adminId: number, body: Row): Row {
        const date = body.date;
        if (!isIsoDate(date)) throw new StatusError('A valid attendance date (YYYY-MM-DD) is required', 400);
        const lectureNo = parseInt(String(body.lecture_no), 10);
        if (!Number.isInteger(lectureNo) || lectureNo < 1 || lectureNo > 12) throw new StatusError('lecture_no must be a number from 1 to 12', 400);
        const subjectCode = text(body.subject_code);
        if (!subjectCode) throw new StatusError('subject_code is required', 400);
        const sessionType = text(body.session_type) || 'Theory';
        if (sessionType !== 'Theory' && sessionType !== 'Practical') throw new StatusError("session_type must be 'Theory' or 'Practical'", 400);
        const list = body.attendance;
        if (!Array.isArray(list) || list.length === 0) throw new StatusError('attendance must be a non-empty list of { student_id, status }', 400);

        const name = subjectName(subjectCode, body.subject);
        const faculty = text(body.faculty_name) || null;
        const room = text(body.room_no) || null;
        const timeSlot = text(body.time_slot) || null;
        const topic = text(body.topic) || null;

        const entries = list.map((e: Row, i: number) => {
            const status = text(e?.status) || 'Present';
            if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
                throw new StatusError(`Invalid status "${status}" in attendance entry ${i + 1}`, 400);
            }
            const student = this.studentInCollege(collegeId, e?.student_id);
            if (!student) throw new StatusError(`Student ${text(e?.student_id) || '(missing)'} is not registered in your college`, 400);
            return { studentId: student.id as number, status, remarks: text(e?.remarks) || null };
        });

        return this.transaction(() => {
            this.upsertSubject(collegeId, subjectCode, name, faculty, room);
            this.db.prepare(`
                INSERT INTO academic_lectures (college_id, lecture_date, lecture_no, subject_code, subject_name, session_type, time_slot, room_no, faculty_name, topic, created_by_admin_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (college_id, lecture_date, lecture_no, subject_code) DO UPDATE SET
                    subject_name = excluded.subject_name, session_type = excluded.session_type, time_slot = excluded.time_slot,
                    room_no = excluded.room_no, faculty_name = excluded.faculty_name, topic = excluded.topic,
                    updated_at = CURRENT_TIMESTAMP
            `).run(collegeId, date, lectureNo, subjectCode, name, sessionType, timeSlot, room, faculty, topic, adminId);
            const lecture = this.db.prepare('SELECT id FROM academic_lectures WHERE college_id = ? AND lecture_date = ? AND lecture_no = ? AND subject_code = ?')
                .get(collegeId, date, lectureNo, subjectCode)!;

            const upsert = this.db.prepare(`
                INSERT INTO academic_attendance (lecture_id, student_id, lecture_date, lecture_no, status, remarks, marked_by_admin_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (student_id, lecture_date, lecture_no) DO UPDATE SET
                    lecture_id = excluded.lecture_id, status = excluded.status, remarks = excluded.remarks,
                    marked_by_admin_id = excluded.marked_by_admin_id, updated_at = CURRENT_TIMESTAMP
            `);
            const tally: Record<string, number> = { Present: 0, Absent: 0, Leave: 0, 'Field Duty': 0 };
            for (const e of entries) {
                upsert.run(lecture.id, e.studentId, date, lectureNo, e.status, e.remarks, adminId);
                tally[e.status]++;
            }
            this.removeEmptyLectures(collegeId, date, lectureNo);

            return {
                success: true,
                message: `Attendance saved for ${entries.length} student${entries.length === 1 ? '' : 's'} (Lecture ${lectureNo}, ${date}).`,
                lecture_id: lecture.id,
                saved: entries.length,
                summary: { present: tally.Present, absent: tally.Absent, leave: tally.Leave, field_duty: tally['Field Duty'] },
            };
        });
    }

    /** Lectures in a slot that no longer have any attendance rows (every student moved to another subject). */
    private removeEmptyLectures(collegeId: number, date: string, lectureNo: number) {
        this.db.prepare(`
            DELETE FROM academic_lectures
            WHERE college_id = ? AND lecture_date = ? AND lecture_no = ?
              AND NOT EXISTS (SELECT 1 FROM academic_attendance a WHERE a.lecture_id = academic_lectures.id)
        `).run(collegeId, date, lectureNo);
    }

    getAttendanceHistory(collegeId: number, q: Row): Row {
        let limit = parseInt(String(q.limit ?? '100'), 10);
        if (!Number.isInteger(limit) || limit < 1) limit = 100;
        limit = Math.min(limit, 1000);
        const where = ['l.college_id = ?'];
        const params: unknown[] = [collegeId];
        if (q.date) {
            if (!isIsoDate(q.date)) throw new StatusError('date must be a valid YYYY-MM-DD date', 400);
            where.push('a.lecture_date = ?');
            params.push(q.date);
        }
        if (q.status && q.status !== 'all') {
            if (!(ATTENDANCE_STATUSES as readonly string[]).includes(String(q.status))) throw new StatusError('Unknown attendance status filter', 400);
            where.push('a.status = ?');
            params.push(q.status);
        }
        const search = text(q.search);
        if (search) {
            where.push('(s.roll_number LIKE ? OR s.name LIKE ? OR l.subject_name LIKE ? OR l.subject_code LIKE ? OR l.topic LIKE ? OR l.faculty_name LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like, like, like, like, like);
        }
        const records = cleanList(this.db.prepare(`
            SELECT a.id, a.lecture_date AS date, a.lecture_no, s.id AS student_id, s.roll_number, s.name AS student_name,
                   l.subject_name AS subject, l.subject_code, l.session_type, l.topic, a.status, a.remarks,
                   l.faculty_name, l.room_no, l.time_slot, a.updated_at
            FROM academic_attendance a
            JOIN academic_lectures l ON l.id = a.lecture_id
            JOIN students s ON s.id = a.student_id
            WHERE ${where.join(' AND ')}
            ORDER BY a.lecture_date DESC, a.lecture_no ASC, CAST(s.roll_number AS INTEGER), s.roll_number
            LIMIT ?
        `).all(...params, limit));
        return { records, count: records.length };
    }

    /** Returns false when the record does not exist in this college. */
    deleteAttendance(collegeId: number, id: unknown): boolean {
        const rec = this.db.prepare(`
            SELECT a.id, a.lecture_date, a.lecture_no FROM academic_attendance a
            JOIN academic_lectures l ON l.id = a.lecture_id
            WHERE a.id = ? AND l.college_id = ?
        `).get(id, collegeId);
        if (!rec) return false;
        this.transaction(() => {
            this.db.prepare('DELETE FROM academic_attendance WHERE id = ?').run(rec.id);
            this.removeEmptyLectures(collegeId, rec.lecture_date, rec.lecture_no);
        });
        return true;
    }

    /* ======================= Admin: exams ======================= */

    private parseExamKey(src: Row): { yearLevel: number; examType: string; subjectCode: string } {
        const yearLevel = parseInt(String(src.year_level ?? '3'), 10);
        if (!YEAR_BATCH[yearLevel]) throw new StatusError('year_level must be 1, 2 or 3', 400);
        const examType = text(src.exam_type) || 'IA-1';
        if (!(EXAM_TYPES as readonly string[]).includes(examType)) throw new StatusError(`exam_type must be one of ${EXAM_TYPES.join(', ')}`, 400);
        const subjectCode = text(src.subject_code);
        if (!subjectCode) throw new StatusError('subject_code is required', 400);
        return { yearLevel, examType, subjectCode };
    }

    listExams(collegeId: number): Row {
        const exams = cleanList(this.db.prepare(`
            SELECT e.*, COUNT(m.id) AS marks_entered,
                   ROUND(AVG(m.percentage), 1) AS class_average,
                   SUM(CASE WHEN m.status IN ('Pass', 'Distinction') THEN 1 ELSE 0 END) AS passed
            FROM academic_exams e
            LEFT JOIN academic_exam_marks m ON m.exam_id = e.id
            WHERE e.college_id = ?
            GROUP BY e.id
            ORDER BY e.year_level DESC, e.exam_date DESC, e.id DESC
        `).all(collegeId));
        return { exams };
    }

    getExamSheet(collegeId: number, q: Row): Row {
        const { yearLevel, examType, subjectCode } = this.parseExamKey(q);
        const isTwoPaper = isTwoPaperType(examType);
        const exam = this.db.prepare('SELECT * FROM academic_exams WHERE college_id = ? AND year_level = ? AND exam_type = ? AND subject_code = ?')
            .get(collegeId, yearLevel, examType, subjectCode);
        const batch = YEAR_BATCH[yearLevel];
        const marksheet = cleanList(this.db.prepare(`
            SELECT s.id AS student_id, s.roll_number, s.name, s.batch_year,
                   m.paper1_obtained, m.paper2_obtained, m.theory_obtained, m.practical_obtained, m.viva_obtained,
                   m.total_obtained, m.percentage, COALESCE(m.status, 'Not Entered') AS status, COALESCE(m.faculty_remarks, '') AS faculty_remarks
            FROM students s
            LEFT JOIN academic_exam_marks m ON m.student_id = s.id AND m.exam_id = ?
            WHERE s.college_id = ? AND ((${BATCH_SQL} AND ${ACTIVE_SQL}) OR m.id IS NOT NULL)
            ${ROLL_ORDER}
        `).all(exam ? exam.id : -1, collegeId, batch, batch, batch));
        return {
            year_level: yearLevel,
            exam_type: examType,
            subject_code: subjectCode,
            is_two_paper: isTwoPaper,
            max_marks: isTwoPaper ? { paper1: 100, paper2: 100, theory: 200, practical: 100, viva: 20, total: 300 } : { theory: 100, practical: 100, viva: 20, total: 200 },
            exam: exam ? { ...exam } : null,
            marksheet,
        };
    }

    saveExamMarks(collegeId: number, adminId: number, body: Row): Row {
        const { yearLevel, examType, subjectCode } = this.parseExamKey(body);
        const isTwoPaper = isTwoPaperType(examType);
        const examDate = text(body.exam_date) || null;
        if (examDate !== null && !isIsoDate(examDate)) throw new StatusError('exam_date must be a valid YYYY-MM-DD date', 400);
        const results = body.results;
        if (!Array.isArray(results) || results.length === 0) throw new StatusError('results must be a non-empty list of student marks', 400);

        const name = subjectName(subjectCode, body.subject);
        const entries = results.map((r: Row, i: number) => {
            const student = this.studentInCollege(collegeId, r?.student_id);
            if (!student) throw new StatusError(`Student ${text(r?.student_id) || '(missing) in row ' + (i + 1)} is not registered in your college`, 400);
            const marks = computeMarks(r || {}, isTwoPaper, `roll ${student.roll_number}`);
            return { studentId: student.id as number, marks, remarks: text(r?.faculty_remarks) || null };
        });

        return this.transaction(() => {
            this.upsertSubject(collegeId, subjectCode, name, null, null);
            this.db.prepare(`
                INSERT INTO academic_exams (college_id, year_level, exam_type, subject_code, subject_name, exam_code, exam_name, exam_date, academic_year, created_by_admin_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (college_id, year_level, exam_type, subject_code) DO UPDATE SET
                    subject_name = excluded.subject_name, exam_code = excluded.exam_code, exam_name = excluded.exam_name,
                    exam_date = excluded.exam_date, academic_year = excluded.academic_year, updated_at = CURRENT_TIMESTAMP
            `).run(
                collegeId, yearLevel, examType, subjectCode, name,
                text(body.exam_code) || `${subjectCode}-${examType}`,
                text(body.exam_name) || `${examType} Examination`,
                examDate,
                text(body.academic_year) || null,
                adminId,
            );
            const exam = this.db.prepare('SELECT id, exam_code FROM academic_exams WHERE college_id = ? AND year_level = ? AND exam_type = ? AND subject_code = ?')
                .get(collegeId, yearLevel, examType, subjectCode)!;

            const upsert = this.db.prepare(`
                INSERT INTO academic_exam_marks (exam_id, student_id, paper1_obtained, paper2_obtained, theory_obtained, practical_obtained, viva_obtained,
                                                 total_obtained, total_max, percentage, status, faculty_remarks, entered_by_admin_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (exam_id, student_id) DO UPDATE SET
                    paper1_obtained = excluded.paper1_obtained, paper2_obtained = excluded.paper2_obtained,
                    theory_obtained = excluded.theory_obtained, practical_obtained = excluded.practical_obtained,
                    viva_obtained = excluded.viva_obtained, total_obtained = excluded.total_obtained, total_max = excluded.total_max,
                    percentage = excluded.percentage, status = excluded.status, faculty_remarks = excluded.faculty_remarks,
                    entered_by_admin_id = excluded.entered_by_admin_id, updated_at = CURRENT_TIMESTAMP
            `);
            const clear = this.db.prepare('DELETE FROM academic_exam_marks WHERE exam_id = ? AND student_id = ?');
            let saved = 0;
            let cleared = 0;
            for (const e of entries) {
                if (!e.marks) {
                    cleared += Number(clear.run(exam.id, e.studentId).changes);
                    continue;
                }
                const m = e.marks;
                upsert.run(exam.id, e.studentId, m.paper1_obtained, m.paper2_obtained, m.theory_obtained, m.practical_obtained, m.viva_obtained,
                    m.total_obtained, m.total_max, m.percentage, m.status, e.remarks, adminId);
                saved++;
            }
            return {
                success: true,
                message: `Examination marks published for ${saved} student${saved === 1 ? '' : 's'} (${exam.exam_code}).`,
                exam_id: exam.id,
                saved,
                cleared,
                skipped: entries.length - saved - cleared,
            };
        });
    }

    /** Returns false when the exam does not exist in this college. */
    deleteExam(collegeId: number, id: unknown): boolean {
        const res = this.db.prepare('DELETE FROM academic_exams WHERE id = ? AND college_id = ?').run(id, collegeId);
        return Number(res.changes) > 0;
    }

    /* ======================= Student: attendance ======================= */

    getDatewise(student: Row, date: string): Row {
        const collegeId = student.college_id || 1;
        const lectures = cleanList(this.db.prepare(`
            SELECT l.id AS lecture_id, l.lecture_no, l.room_no, COALESCE(l.time_slot, '') AS time, l.subject_code, l.subject_name,
                   l.session_type AS theory_practical, l.faculty_name, l.topic,
                   COALESCE(a.status, 'Not Marked') AS status, a.remarks,
                   l.attendance_requested, l.attendance_requested_at
            FROM academic_lectures l
            LEFT JOIN academic_attendance a ON l.id = a.lecture_id AND a.student_id = ?
            WHERE l.college_id = ? AND l.lecture_date = ?
            ORDER BY l.lecture_no
        `).all(student.id, collegeId, date));
        const summary = { total: lectures.length, present: 0, absent: 0, leave: 0, field_duty: 0, not_marked: 0 };
        for (const l of lectures) {
            if (l.status === 'Present') summary.present++;
            else if (l.status === 'Absent') summary.absent++;
            else if (l.status === 'Leave') summary.leave++;
            else if (l.status === 'Field Duty') summary.field_duty++;
            else summary.not_marked++;
        }
        const [y, m, d] = date.split('-');
        return {
            date,
            date_formatted: `${d}/${m}/${y}`,
            semester: semesterOf(student.batch_year),
            student: { roll_number: student.roll_number, name: student.name, batch_year: student.batch_year },
            summary,
            lectures,
        };
    }

    getSubjectWise(student: Row): Row {
        const rows = this.db.prepare(`
            SELECT l.subject_code, l.subject_name, l.session_type, l.faculty_name, a.status, a.lecture_date, a.lecture_no
            FROM academic_attendance a
            JOIN academic_lectures l ON l.id = a.lecture_id
            WHERE a.student_id = ?
            ORDER BY a.lecture_date, a.lecture_no
        `).all(student.id);

        interface Part { total: number; attended: number }
        interface Acc { subject: string; subject_code: string; faculty_name: string | null; total: number; attended: number; absent: number; leave: number; field_duty: number; theory: Part; practical: Part }
        const bySubject = new Map<string, Acc>();
        for (const r of rows) {
            let s = bySubject.get(r.subject_code);
            if (!s) {
                s = { subject: r.subject_name, subject_code: r.subject_code, faculty_name: null, total: 0, attended: 0, absent: 0, leave: 0, field_duty: 0, theory: { total: 0, attended: 0 }, practical: { total: 0, attended: 0 } };
                bySubject.set(r.subject_code, s);
            }
            s.subject = r.subject_name; // latest name wins (rows are in date order)
            if (r.faculty_name) s.faculty_name = r.faculty_name;
            const attended = r.status === 'Present' || r.status === 'Field Duty';
            const part = r.session_type === 'Practical' ? s.practical : s.theory;
            s.total++;
            part.total++;
            if (attended) {
                s.attended++;
                part.attended++;
            }
            if (r.status === 'Absent') s.absent++;
            if (r.status === 'Leave') s.leave++;
            if (r.status === 'Field Duty') s.field_duty++;
        }

        const partOut = (p: Part, min: number) => {
            const percentage = pct(p.attended, p.total);
            return { total: p.total, attended: p.attended, percentage, met: p.total > 0 && percentage >= min };
        };
        const subjects = [...bySubject.values()]
            .sort((a, b) => a.subject.localeCompare(b.subject))
            .map((s) => {
                const overall = pct(s.attended, s.total);
                const theory = partOut(s.theory, NMC_THEORY_MIN);
                const practical = partOut(s.practical, NMC_PRACTICAL_MIN);
                const theoryOk = s.theory.total === 0 || theory.met;
                const practicalOk = s.practical.total === 0 || practical.met;
                const nmc_status = overall >= 75 && theoryOk && practicalOk ? 'Eligible' : overall >= 65 ? 'Warning' : 'Shortage';
                return { ...s, overall_percentage: overall, theory, practical, nmc_status };
            });

        const totals = subjects.reduce(
            (acc, s) => {
                acc.total += s.total;
                acc.attended += s.attended;
                acc.thT += s.theory.total;
                acc.thA += s.theory.attended;
                acc.prT += s.practical.total;
                acc.prA += s.practical.attended;
                return acc;
            },
            { total: 0, attended: 0, thT: 0, thA: 0, prT: 0, prA: 0 },
        );
        return {
            student: { id: student.id, roll_number: student.roll_number, name: student.name, batch_year: student.batch_year },
            overall_summary: {
                overall_percentage: pct(totals.attended, totals.total),
                attended_classes: totals.attended,
                total_classes: totals.total,
                eligible_subjects: subjects.filter((s) => s.nmc_status === 'Eligible').length,
                total_subjects: subjects.length,
            },
            theory: partOut({ total: totals.thT, attended: totals.thA }, NMC_THEORY_MIN),
            practical: partOut({ total: totals.prT, attended: totals.prA }, NMC_PRACTICAL_MIN),
            subjects,
        };
    }

    /* ======================= Student: exams ======================= */

    private studentExamRows(studentId: unknown, year: string): Row[] {
        const params: unknown[] = [studentId];
        let where = 'm.student_id = ?';
        if (year !== 'all') {
            where += ' AND e.year_level = ?';
            params.push(Number(year));
        }
        return this.db.prepare(`
            SELECT e.id AS exam_id, e.year_level, e.exam_type, e.exam_code, e.exam_name, e.exam_date, e.academic_year,
                   e.subject_name, e.subject_code, e.created_at AS exam_created_at,
                   m.paper1_obtained, m.paper2_obtained, m.theory_obtained, m.practical_obtained, m.viva_obtained,
                   m.total_obtained, m.total_max, m.percentage, m.status, m.faculty_remarks
            FROM academic_exam_marks m
            JOIN academic_exams e ON e.id = m.exam_id
            WHERE ${where}
        `).all(...params);
    }

    getExamResults(student: Row, year: string): Row {
        const score = (obtained: number, max: number, passPct: number) => {
            const percentage = pct(obtained, max);
            return { obtained, max, percentage, passed: percentage >= passPct };
        };
        const exams = this.studentExamRows(student.id, year)
            .sort((a, b) => b.year_level - a.year_level || (EXAM_TYPE_ORDER[a.exam_type] || 5) - (EXAM_TYPE_ORDER[b.exam_type] || 5) || String(a.subject_name).localeCompare(String(b.subject_name)))
            .map((r) => {
                const two = isTwoPaperType(r.exam_type);
                return {
                    exam_id: r.exam_id,
                    year_level: r.year_level,
                    exam_type: r.exam_type,
                    exam_name: r.exam_name || `${r.exam_type} Examination`,
                    exam_code: r.exam_code || '',
                    exam_date: r.exam_date || String(r.exam_created_at || '').slice(0, 10),
                    term: TERM_LABEL[r.exam_type] || r.exam_type,
                    academic_year: r.academic_year || YEAR_BATCH[r.year_level] || '',
                    subject: r.subject_name,
                    subject_code: r.subject_code,
                    status: r.status,
                    grade: gradeOf(r.status, r.percentage),
                    is_two_paper: two,
                    ...(two ? { paper1: score(r.paper1_obtained || 0, 100, 40), paper2: score(r.paper2_obtained || 0, 100, 40) } : {}),
                    theory: score(r.theory_obtained, two ? 200 : 100, 50),
                    practical: score(r.practical_obtained, 100, 50),
                    viva: { obtained: r.viva_obtained, max: 20, percentage: pct(r.viva_obtained, 20) },
                    total: { obtained: r.total_obtained, max: r.total_max, percentage: r.percentage, passed: r.status === 'Pass' || r.status === 'Distinction' },
                    faculty_remarks: r.faculty_remarks || '',
                };
            });

        const counts_by_type: Record<string, number> = { all: exams.length };
        for (const t of EXAM_TYPES) counts_by_type[t] = exams.filter((e) => e.exam_type === t).length;
        const subjects = new Map<string, string>();
        for (const e of exams) if (!subjects.has(e.subject)) subjects.set(e.subject, e.subject_code);
        const available_subjects = [...subjects.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([subject, subject_code]) => ({ subject, subject_code }));

        return {
            student: { roll_number: student.roll_number, name: student.name, batch_year: student.batch_year },
            year,
            exams,
            counts_by_type,
            available_subjects,
        };
    }

    getExamSummary(student: Row, year: string): Row {
        const rows = this.studentExamRows(student.id, year);
        let obtained = 0, max = 0, thObt = 0, thMax = 0, prObt = 0, prMax = 0, iaObt = 0, iaMax = 0, iaCount = 0;
        let distinctions = 0, passed = 0, failed = 0;
        for (const r of rows) {
            const two = isTwoPaperType(r.exam_type);
            obtained += r.total_obtained;
            max += r.total_max;
            thObt += r.theory_obtained;
            thMax += two ? 200 : 100;
            prObt += r.practical_obtained;
            prMax += 100;
            if (r.exam_type === 'IA-1' || r.exam_type === 'IA-2') {
                iaObt += r.total_obtained;
                iaMax += r.total_max;
                iaCount++;
            }
            if (r.status === 'Distinction') distinctions++;
            if (r.status === 'Pass' || r.status === 'Distinction') passed++;
            else failed++;
        }
        const overallPct = pct(obtained, max);
        const iaPct = pct(iaObt, iaMax);
        return {
            student: { roll_number: student.roll_number, name: student.name, batch_year: student.batch_year },
            year,
            cumulative_overall: { percentage: overallPct, obtained: round1(obtained), max },
            cumulative_theory: { percentage: pct(thObt, thMax), obtained: round1(thObt), max: thMax },
            cumulative_practical: { percentage: pct(prObt, prMax), obtained: round1(prObt), max: prMax },
            standing: standingOf(overallPct, rows.length, failed),
            university_eligibility: { eligible: iaCount > 0 && iaPct >= 50, ia_combined_pct: iaPct, ia_exams: iaCount },
            distinctions,
            passed_exams: passed,
            total_exams: rows.length,
        };
    }

    /* ======================= Student: schedule ======================= */

    /** The student's teaching schedule: every lecture session they were enrolled in (marked) by faculty. */
    getSchedule(student: Row, department: string): Row {
        const collegeId = student.college_id || 1;
        const params: unknown[] = [student.id, collegeId];
        let filter = '';
        if (department && department !== 'all') {
            filter = ' AND (l.subject_name LIKE ? OR l.subject_code = ?)';
            params.push(`%${department}%`, department);
        }
        const rows = this.db.prepare(`
            SELECT l.id, l.lecture_date, l.lecture_no, l.time_slot, l.subject_code, l.subject_name, l.session_type,
                   l.room_no, l.faculty_name, l.topic, l.attendance_requested, l.attendance_requested_at, a.status
            FROM academic_lectures l
            LEFT JOIN academic_attendance a ON l.id = a.lecture_id AND a.student_id = ?
            WHERE l.college_id = ?${filter}
            ORDER BY l.lecture_date ASC, l.lecture_no ASC
        `).all(...params);
        const schedules = rows.map((r) => {
            const d = new Date(r.lecture_date + 'T00:00:00Z');
            const compMatch = (r.topic || '').match(/^([A-Z]{2}\s*[\d.]+)/i);
            const compNo = r.competency_no || (compMatch ? compMatch[1] : null);
            return {
                id: r.id,
                date_iso: r.lecture_date,
                card_date: `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`,
                card_day: DAYS[d.getUTCDay()],
                card_time: r.time_slot || `Lecture ${r.lecture_no}`,
                time_slot: r.time_slot || '',
                lecture_no: r.lecture_no,
                department: r.subject_name,
                teaching_type: r.session_type === 'Practical' ? 'DOAP SESSION' : 'LARGE GROUP TEACHING',
                venue: r.room_no || null,
                subject: r.subject_name.includes('Pathology') ? 'Pathology' : r.subject_name.includes('Community') ? 'Community Medicine' : r.subject_name,
                subject_code: r.subject_code,
                topic: r.topic || '',
                competency_no: compNo,
                faculty_name: r.faculty_name || null,
                batch_year: student.batch_year || DEFAULT_BATCH,
                semester: semesterOf(student.batch_year),
                attendance_requested: r.attendance_requested === 1 || r.attendance_requested === '1' || r.attendance_requested === true,
                attendance_requested_at: r.attendance_requested_at || null,
                attendance_status: r.status,
            };
        });
        return { schedules, total: schedules.length };
    }

    /* ======================= Admin: schedule CRUD ======================= */

    getAdminSchedule(collegeId: number, department: string): Row {
        const params: unknown[] = [collegeId];
        let filter = '';
        if (department && department !== 'all') {
            filter = ' AND (l.subject_name LIKE ? OR l.subject_code = ?)';
            params.push(`%${department}%`, department);
        }
        const rows = this.db.prepare(`
            SELECT l.id, l.college_id, l.lecture_date, l.lecture_no, l.time_slot, l.subject_code, l.subject_name,
                   l.session_type, l.room_no, l.faculty_name, l.topic, l.attendance_requested, l.attendance_requested_at, l.created_at, l.updated_at,
                   (SELECT COUNT(*) FROM academic_attendance a WHERE a.lecture_id = l.id) AS attendance_count
            FROM academic_lectures l
            WHERE l.college_id = ?${filter}
            ORDER BY l.lecture_date ASC, l.lecture_no ASC
        `).all(...params);

        const schedules = rows.map((r) => {
            const d = new Date(r.lecture_date + 'T00:00:00Z');
            const compMatch = (r.topic || '').match(/^([A-Z]{2}\s*[\d.]+)/i);
            const compNo = compMatch ? compMatch[1] : null;
            return {
                id: r.id,
                college_id: r.college_id,
                date_iso: r.lecture_date,
                card_date: `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`,
                card_day: DAYS[d.getUTCDay()],
                card_time: r.time_slot || `Lecture ${r.lecture_no}`,
                time_slot: r.time_slot || '',
                lecture_no: r.lecture_no,
                department: r.subject_name,
                session_type: r.session_type || 'Theory',
                teaching_type: r.session_type === 'Practical' ? 'DOAP SESSION' : 'LARGE GROUP TEACHING',
                venue: r.room_no || 'Lecture Theatre 1 (LT-1)',
                room_no: r.room_no || '',
                subject: r.subject_name.includes('Pathology') ? 'Pathology' : r.subject_name.includes('Community') ? 'Community Medicine' : r.subject_name,
                subject_name: r.subject_name,
                subject_code: r.subject_code,
                topic: r.topic || '',
                competency_no: compNo,
                faculty_name: r.faculty_name || '',
                batch_year: '3rd Year MBBS',
                semester: 'Semester 5',
                attendance_requested: r.attendance_requested === 1 || r.attendance_requested === '1' || r.attendance_requested === true,
                attendance_requested_at: r.attendance_requested_at || null,
                attendance_count: r.attendance_count || 0,
            };
        });
        return { schedules, total: schedules.length };
    }

    createLecture(collegeId: number, adminId: number | null, body: Record<string, unknown>): Row {
        const lectureDate = text(body.lecture_date || body.date_iso);
        if (!isIsoDate(lectureDate)) throw new StatusError('A valid lecture date in YYYY-MM-DD format is required', 400);

        const topic = text(body.topic);
        if (!topic) throw new StatusError('Topic and learning objectives are required', 400);

        const subjectCode = text(body.subject_code || 'PA-301');
        const subjectRaw = text(body.subject_name || body.department);
        const name = subjectRaw || (DEFAULT_SUBJECTS.find((s) => s.code === subjectCode)?.name) || 'Department of Pathology';
        const sessionType = body.session_type === 'Practical' ? 'Practical' : 'Theory';
        const lectureNo = Number(body.lecture_no) || 1;
        const timeSlot = text(body.time_slot || (sessionType === 'Practical' ? '02:00 - 04:00 PM' : '09:00 - 10:00 AM'));
        const roomNo = text(body.room_no || body.venue || (sessionType === 'Practical' ? 'Pathology Practical Lab' : 'Lecture Theatre 1 (LT-1)'));
        const facultyName = text(body.faculty_name || 'Dr. Ramesh Mehta (Prof & HOD)');

        this.upsertSubject(collegeId, subjectCode, name, facultyName, roomNo);

        const res = this.db.prepare(`
            INSERT INTO academic_lectures (
                college_id, lecture_date, lecture_no, subject_code, subject_name,
                session_type, time_slot, room_no, faculty_name, topic, created_by_admin_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (college_id, lecture_date, lecture_no, subject_code) DO UPDATE SET
                subject_name = excluded.subject_name,
                session_type = excluded.session_type,
                time_slot = excluded.time_slot,
                room_no = excluded.room_no,
                faculty_name = excluded.faculty_name,
                topic = excluded.topic,
                updated_at = CURRENT_TIMESTAMP
        `).run(collegeId, lectureDate, lectureNo, subjectCode, name, sessionType, timeSlot, roomNo, facultyName, topic, adminId);

        return {
            id: res.lastInsertRowid,
            message: 'Lecture session scheduled successfully',
        };
    }

    updateLecture(collegeId: number, lectureId: number | string, body: Record<string, unknown>): Row {
        const id = Number(lectureId);
        const existing = this.db.prepare('SELECT id FROM academic_lectures WHERE id = ? AND college_id = ?').get(id, collegeId);
        if (!existing) throw new StatusError('Lecture session not found', 404);

        const lectureDate = text(body.lecture_date || body.date_iso);
        if (lectureDate && !isIsoDate(lectureDate)) throw new StatusError('Invalid lecture date', 400);

        const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
        const params: unknown[] = [];

        if (lectureDate) { updates.push('lecture_date = ?'); params.push(lectureDate); }
        if (body.lecture_no !== undefined) { updates.push('lecture_no = ?'); params.push(Number(body.lecture_no) || 1); }
        if (body.subject_code !== undefined) { updates.push('subject_code = ?'); params.push(text(body.subject_code)); }
        if (body.subject_name !== undefined || body.department !== undefined) {
            updates.push('subject_name = ?');
            params.push(text(body.subject_name || body.department));
        }
        if (body.session_type !== undefined) {
            updates.push('session_type = ?');
            params.push(body.session_type === 'Practical' ? 'Practical' : 'Theory');
        }
        if (body.time_slot !== undefined) { updates.push('time_slot = ?'); params.push(text(body.time_slot)); }
        if (body.room_no !== undefined || body.venue !== undefined) {
            updates.push('room_no = ?');
            params.push(text(body.room_no || body.venue));
        }
        if (body.faculty_name !== undefined) { updates.push('faculty_name = ?'); params.push(text(body.faculty_name)); }
        if (body.topic !== undefined) { updates.push('topic = ?'); params.push(text(body.topic)); }

        params.push(id, collegeId);
        this.db.prepare(`UPDATE academic_lectures SET ${updates.join(', ')} WHERE id = ? AND college_id = ?`).run(...params);

        return { id, message: 'Lecture session updated successfully' };
    }

    deleteLecture(collegeId: number, lectureId: number | string): boolean {
        const id = Number(lectureId);
        const res = this.db.prepare('DELETE FROM academic_lectures WHERE id = ? AND college_id = ?').run(id, collegeId);
        return res.changes > 0;
    }

    requestAttendance(collegeId: number, _adminId: number | null, lectureId: unknown): Row {
        const id = Number(lectureId);
        if (!Number.isFinite(id) || id <= 0) throw new StatusError('Invalid lecture session ID', 400);

        const lecture = this.db.prepare('SELECT id, subject_name, lecture_date, time_slot FROM academic_lectures WHERE id = ? AND college_id = ?').get(id, collegeId) as Row | undefined;
        if (!lecture) throw new StatusError('Lecture session not found', 404);

        this.db.prepare(`
            UPDATE academic_lectures
            SET attendance_requested = 1, attendance_requested_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        return {
            success: true,
            message: `Attendance request sent to students for ${lecture.subject_name} (${lecture.lecture_date}).`,
            lecture_id: id,
            attendance_requested: true,
        };
    }

    fillAttendance(student: Row, body: Record<string, unknown>): Row {
        const lectureId = Number(body.lecture_id);
        let lecture: Row | undefined;
        if (Number.isFinite(lectureId) && lectureId > 0) {
            lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ?').get(lectureId) as Row | undefined;
        } else {
            const date = text(body.date || body.lecture_date);
            const lectureNo = Number(body.lecture_no || 1);
            if (isIsoDate(date)) {
                lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE college_id = ? AND lecture_date = ? AND lecture_no = ?').get(student.college_id || 1, date, lectureNo) as Row | undefined;
            }
        }

        if (!lecture) throw new StatusError('Scheduled lecture session not found', 404);

        const status = text(body.status) || 'Present';
        if (!['Present', 'Absent', 'Leave', 'Field Duty'].includes(status)) {
            throw new StatusError('Invalid attendance status', 400);
        }
        const remarks = text(body.remarks) || 'Self-marked by student via portal';

        this.db.prepare(`
            INSERT INTO academic_attendance (lecture_id, student_id, lecture_date, lecture_no, status, remarks)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (student_id, lecture_date, lecture_no) DO UPDATE SET
                lecture_id = excluded.lecture_id, status = excluded.status, remarks = excluded.remarks,
                updated_at = CURRENT_TIMESTAMP
        `).run(lecture.id, student.id, lecture.lecture_date, lecture.lecture_no, status, remarks);

        return {
            success: true,
            message: `Attendance marked as ${status} for ${lecture.subject_name}!`,
            lecture_id: lecture.id,
            status,
        };
    }
}
