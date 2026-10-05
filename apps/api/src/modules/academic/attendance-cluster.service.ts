import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { Row } from '../../common/row';
import { StatusError } from '../../common/http-error';

const hash = (value: string) => createHash('sha256').update(value).digest();
function number(value: unknown, name: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new StatusError(`${name} must be a number between ${min} and ${max}`, 400);
    }
    return value;
}

/** The faculty phone observes BLE; the server owns eligibility, deadlines and records.
 * RSSI is an estimate, never proof of an exact physical distance or student identity.
 */
@Injectable()
export class AttendanceClusterService implements OnModuleInit, OnModuleDestroy {
    private timer?: ReturnType<typeof setInterval>;
    private readonly logger = new Logger(AttendanceClusterService.name);
    constructor(private readonly database: DatabaseService) {}
    private get db() { return this.database.db; }

    onModuleInit() {
        this.expire();
        this.timer = setInterval(() => {
            try { this.expire(); } catch (error) { this.logger.error('Attendance expiry failed; will retry', error); }
        }, 1000);
        this.timer.unref();
    }
    onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

    private transaction<T>(fn: () => T): T {
        this.db.exec('BEGIN IMMEDIATE');
        try { const result = fn(); this.db.exec('COMMIT'); return result; }
        catch (error) { this.db.exec('ROLLBACK'); throw error; }
    }
    private event(id: string, studentId: number | null, event: string, distance: number | null = null) {
        this.db.prepare(`INSERT INTO attendance_cluster_events
            (cluster_id, student_id, event, distance_m, created_at) VALUES (?, ?, ?, ?, ?)`)
            .run(id, studentId, event, distance, Date.now());
    }
    private getCluster(id: unknown, collegeId: number): Row {
        const cluster = this.db.prepare('SELECT * FROM attendance_clusters WHERE id = ? AND college_id = ?')
            .get(String(id ?? ''), collegeId);
        if (!cluster) throw new StatusError('Attendance cluster not found', 404);
        return cluster;
    }
    private active(cluster: Row) {
        if (cluster.closed_at !== null || Date.now() >= cluster.ends_at) {
            throw new StatusError('Attendance cluster has ended', 409);
        }
    }
    private member(clusterId: string, studentId: number): Row {
        const member = this.db.prepare('SELECT * FROM attendance_cluster_members WHERE cluster_id = ? AND student_id = ?')
            .get(clusterId, studentId);
        if (!member) throw new StatusError('Student is not on this attendance roster', 403);
        return member;
    }

    start(collegeId: number, adminId: number | null, lectureId: unknown, body: Row): Row {
        this.expire();
        if (!adminId) throw new StatusError('Faculty account required', 403);
        const radius = number(body.radius_m ?? 1, 'radius_m', 0.1, 100);
        const duration = number(body.duration_seconds ?? 300, 'duration_seconds', 10, 3600);
        const tx = number(body.tx_power_at_1m ?? -59, 'tx_power_at_1m', -100, -20);
        const exponent = number(body.path_loss_exponent ?? 2, 'path_loss_exponent', 1, 6);
        if (!Array.isArray(body.student_ids) || !body.student_ids.length || body.student_ids.length > 2000) {
            throw new StatusError('student_ids must contain the class roster (1 to 2000 IDs)', 400);
        }
        const ids = [...new Set<number>(body.student_ids.map((id: unknown) => {
            const value = number(id, 'student_id', 1, Number.MAX_SAFE_INTEGER);
            if (!Number.isInteger(value)) throw new StatusError('student_id must be an integer', 400);
            return value;
        }))];
        return this.transaction(() => {
            const lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ? AND college_id = ?')
                .get(Number(lectureId), collegeId);
            if (!lecture) throw new StatusError('Lecture session not found', 404);
            if (this.db.prepare('SELECT id FROM attendance_clusters WHERE lecture_id = ?').get(lecture.id)) {
                throw new StatusError('This lecture already has an attendance cluster', 409);
            }
            for (const id of ids) {
                if (!this.db.prepare('SELECT id FROM students WHERE id = ? AND college_id = ?').get(id, collegeId)) {
                    throw new StatusError('Every roster student must belong to this college', 400);
                }
                if (this.db.prepare(`SELECT m.student_id FROM attendance_cluster_members m
                    JOIN attendance_clusters c ON c.id = m.cluster_id
                    JOIN academic_lectures l ON l.id = c.lecture_id
                    WHERE m.student_id = ? AND l.lecture_date = ? AND l.lecture_no = ?`).get(id, lecture.lecture_date, lecture.lecture_no)) {
                    throw new StatusError('A roster student already has a cluster for this lecture slot', 409);
                }
            }
            const id = randomUUID();
            const token = randomBytes(32).toString('hex');
            const now = Date.now();
            const endsAt = now + duration * 1000;
            this.db.prepare(`INSERT INTO attendance_clusters
                (id, lecture_id, college_id, admin_id, anchor_token_hash, radius_m, tx_power_at_1m,
                 path_loss_exponent, started_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(id, lecture.id, collegeId, adminId, hash(token).toString('hex'), radius, tx, exponent, now, endsAt);
            for (const studentId of ids) {
                this.db.prepare('INSERT INTO attendance_cluster_members (cluster_id, student_id) VALUES (?, ?)').run(id, studentId);
            }
            this.db.prepare('UPDATE academic_lectures SET attendance_requested = 1, attendance_requested_at = CURRENT_TIMESTAMP WHERE id = ?').run(lecture.id);
            this.event(id, null, 'started');
            return { success: true, cluster_id: id, lecture_id: lecture.id, radius_m: radius,
                started_at: now, ends_at: endsAt, anchor_token: token, attendance_requested: true,
                proximity_method: 'bluetooth_rssi_estimate' };
        });
    }

    /** Snapshot roster, not all students in the college. Manual register entries take precedence. */
    private close(cluster: Row, now: number) {
        const lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ?').get(cluster.lecture_id)!;
        this.db.prepare(`INSERT INTO academic_attendance
            (lecture_id, student_id, lecture_date, lecture_no, status, remarks)
            SELECT ?, m.student_id, ?, ?, 'Absent', 'Attendance cluster ended without an accepted check-in'
            FROM attendance_cluster_members m WHERE m.cluster_id = ? AND m.accepted_at IS NULL
            ON CONFLICT (student_id, lecture_date, lecture_no) DO NOTHING`)
            .run(lecture.id, lecture.lecture_date, lecture.lecture_no, cluster.id);
        this.db.prepare('UPDATE attendance_clusters SET closed_at = ? WHERE id = ?').run(now, cluster.id);
        this.db.prepare('UPDATE attendance_cluster_members SET challenge = NULL, verified_until = NULL WHERE cluster_id = ?').run(cluster.id);
        this.db.prepare('UPDATE academic_lectures SET attendance_requested = 0 WHERE id = ?').run(lecture.id);
        this.event(cluster.id, null, 'closed');
    }
    expire() {
        this.transaction(() => {
            const now = Date.now();
            for (const cluster of this.db.prepare('SELECT * FROM attendance_clusters WHERE closed_at IS NULL AND ends_at <= ?').all(now)) {
                this.close(cluster, now);
            }
        });
    }
    end(collegeId: number, id: unknown): Row {
        this.expire();
        return this.transaction(() => {
            const cluster = this.getCluster(id, collegeId);
            if (cluster.closed_at === null) this.close(cluster, Date.now());
            return { success: true, cluster_id: cluster.id, status: 'closed' };
        });
    }
    inspect(collegeId: number, id: unknown): Row {
        this.expire();
        const cluster = this.getCluster(id, collegeId);
        const { anchor_token_hash: _secret, ...safe } = cluster;
        const students = this.db.prepare(`SELECT m.student_id, s.name, s.roll_number, s.batch_year,
            m.joined_at, m.accepted_at, m.distance_m, m.verified_until,
            a.status AS attendance_status FROM attendance_cluster_members m
            JOIN students s ON s.id = m.student_id
            JOIN academic_lectures l ON l.id = ?
            LEFT JOIN academic_attendance a ON a.student_id = m.student_id
                AND a.lecture_date = l.lecture_date AND a.lecture_no = l.lecture_no
            WHERE m.cluster_id = ?`).all(cluster.lecture_id, cluster.id);
        return { ...safe, server_now: Date.now(), students, present: students.filter(s => s.attendance_status === 'Present').length,
            joined: students.filter(s => s.joined_at !== null).length,
            verified: students.filter(s => s.accepted_at !== null || s.verified_until > Date.now()).length,
            pending: students.filter(s => !s.attendance_status).length,
            events: this.db.prepare('SELECT student_id, event, distance_m, created_at FROM attendance_cluster_events WHERE cluster_id = ? ORDER BY id').all(cluster.id) };
    }
    list(student: Row): Row[] {
        this.expire();
        return this.db.prepare(`SELECT c.id AS cluster_id, c.lecture_id, c.radius_m, c.started_at, c.ends_at,
            m.accepted_at, m.joined_at, l.subject_name, l.lecture_date, l.room_no, l.faculty_name,
            ? AS server_now
            FROM attendance_clusters c JOIN attendance_cluster_members m ON m.cluster_id = c.id
            JOIN academic_lectures l ON l.id = c.lecture_id
            WHERE c.college_id = ? AND m.student_id = ? AND c.closed_at IS NULL`)
            .all(Date.now(), student.college_id, student.id);
    }

    forLecture(collegeId: number, lectureId: unknown): Row {
        const lecture = this.db.prepare('SELECT id FROM academic_lectures WHERE id = ? AND college_id = ?').get(Number(lectureId), collegeId);
        if (!lecture) throw new StatusError('Lecture session not found', 404);
        const cluster = this.db.prepare('SELECT id FROM attendance_clusters WHERE lecture_id = ?').get(lecture.id);
        return { cluster: cluster ? this.inspect(collegeId, cluster.id) : null };
    }

    studentRoom(student: Row, id: unknown): Row {
        this.expire();
        const cluster = this.getCluster(id, student.college_id);
        const member = this.member(cluster.id, student.id);
        const lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ?').get(cluster.lecture_id)!;
        const attendance = this.db.prepare('SELECT status FROM academic_attendance WHERE student_id = ? AND lecture_date = ? AND lecture_no = ?')
            .get(student.id, lecture.lecture_date, lecture.lecture_no);
        const lastObservation = this.db.prepare(`SELECT event FROM attendance_cluster_events
            WHERE cluster_id = ? AND student_id = ? AND event IN ('outside_radius', 'proximity_verified') ORDER BY id DESC LIMIT 1`)
            .get(cluster.id, student.id);
        return { cluster_id: cluster.id, lecture_id: cluster.lecture_id, subject_name: lecture.subject_name,
            faculty_name: lecture.faculty_name, room_no: lecture.room_no, lecture_date: lecture.lecture_date,
            radius_m: cluster.radius_m, started_at: cluster.started_at, ends_at: cluster.ends_at,
            closed_at: cluster.closed_at, server_now: Date.now(), joined_at: member.joined_at,
            accepted_at: member.accepted_at, verified_until: member.verified_until,
            attendance_status: attendance?.status ?? null, last_observation: lastObservation?.event ?? null };
    }

    join(student: Row, id: unknown): Row {
        this.expire();
        this.transaction(() => {
            const cluster = this.getCluster(id, student.college_id);
            this.active(cluster);
            const member = this.member(cluster.id, student.id);
            if (member.joined_at === null) {
                this.db.prepare('UPDATE attendance_cluster_members SET joined_at = ? WHERE cluster_id = ? AND student_id = ?')
                    .run(Date.now(), cluster.id, student.id);
                this.event(cluster.id, student.id, 'joined');
            }
        });
        return this.studentRoom(student, id);
    }
    challenge(student: Row, id: unknown): Row {
        this.join(student, id);
        return this.transaction(() => {
            const cluster = this.getCluster(id, student.college_id);
            this.active(cluster);
            const member = this.member(cluster.id, student.id);
            if (member.accepted_at !== null) throw new StatusError('Attendance already recorded', 409);
            const challenge = randomBytes(32).toString('hex');
            const expiresAt = Math.min(Date.now() + 30000, cluster.ends_at);
            this.db.prepare(`UPDATE attendance_cluster_members SET challenge = ?, challenge_issued_at = ?, challenge_expires_at = ?, verified_until = NULL
                WHERE cluster_id = ? AND student_id = ?`).run(challenge, Date.now(), expiresAt, cluster.id, student.id);
            return { cluster_id: cluster.id, student_id: student.id, challenge, expires_at: expiresAt };
        });
    }

    /** Only the starting faculty phone can report samples observed on its BLE connection.
     * Never accept student-supplied distance, GPS, or a boolean "Bluetooth connected".
     */
    observe(collegeId: number, adminId: number, id: unknown, token: string, body: Row): Row {
        this.expire();
        return this.transaction(() => {
            const cluster = this.getCluster(id, collegeId);
            this.active(cluster);
            if (cluster.admin_id !== adminId || !timingSafeEqual(hash(token), Buffer.from(cluster.anchor_token_hash, 'hex'))) {
                throw new StatusError('Invalid faculty anchor credentials', 403);
            }
            const member = this.member(cluster.id, number(body.student_id, 'student_id', 1, Number.MAX_SAFE_INTEGER));
            const now = Date.now();
            if (typeof body.challenge !== 'string' || body.challenge !== member.challenge || now >= member.challenge_expires_at) {
                throw new StatusError('Invalid or expired Bluetooth challenge', 403);
            }
            if (!Array.isArray(body.samples) || body.samples.length < 5 || body.samples.length > 50) {
                throw new StatusError('Provide 5 to 50 timestamped Bluetooth RSSI samples', 400);
            }
            const samples = body.samples.map((sample: Row) => {
                if (!sample || typeof sample !== 'object') throw new StatusError('Invalid RSSI sample', 400);
                return { rssi: number(sample.rssi, 'rssi', -127, -1),
                    at: number(sample.observed_at, 'observed_at', Math.max(member.challenge_issued_at, now - 10000), now) };
            });
            for (let i = 1; i < samples.length; i++) {
                if (samples[i].at <= samples[i - 1].at) throw new StatusError('RSSI samples must have increasing timestamps', 400);
            }
            if (samples[samples.length - 1].at - samples[0].at < 1000) throw new StatusError('RSSI sampling must span at least one second', 400);
            // Use the weakest sample (largest estimated distance), not one lucky strong reading.
            const distance = Math.pow(10, (cluster.tx_power_at_1m - Math.min(...samples.map(s => s.rssi))) / (10 * cluster.path_loss_exponent));
            const allowed = distance <= cluster.radius_m;
            const verifiedUntil = Math.min(samples[samples.length - 1].at + 10000, cluster.ends_at);
            this.db.prepare(`UPDATE attendance_cluster_members SET challenge = NULL, verified_until = ?, distance_m = ?
                WHERE cluster_id = ? AND student_id = ?`).run(allowed ? verifiedUntil : null, distance, cluster.id, member.student_id);
            this.event(cluster.id, member.student_id, allowed ? 'proximity_verified' : 'outside_radius', distance);
            return { allowed, distance_m: distance, radius_m: cluster.radius_m, verified_until: allowed ? verifiedUntil : null,
                proximity_method: 'bluetooth_rssi_estimate' };
        });
    }
    fill(student: Row, body: Row): Row {
        this.expire();
        return this.transaction(() => {
            const cluster = body.cluster_id
                ? this.getCluster(body.cluster_id, student.college_id)
                : this.db.prepare('SELECT * FROM attendance_clusters WHERE lecture_id = ? AND college_id = ?').get(Number(body.lecture_id), student.college_id);
            if (!cluster) throw new StatusError('An active Bluetooth attendance cluster is required', 409);
            this.active(cluster);
            const member = this.member(cluster.id, student.id);
            if (body.status !== undefined && body.status !== 'Present') throw new StatusError('Students can only check in as Present', 400);
            if (member.accepted_at !== null) {
                const record = this.db.prepare('SELECT status FROM academic_attendance WHERE lecture_id = ? AND student_id = ?').get(cluster.lecture_id, student.id);
                if (record?.status !== 'Present') throw new StatusError('Faculty has changed this attendance record', 409);
                return { success: true, lecture_id: cluster.lecture_id, status: 'Present', already_recorded: true };
            }
            if (!member.verified_until || Date.now() >= member.verified_until || member.distance_m > cluster.radius_m) {
                throw new StatusError('Fresh faculty-observed Bluetooth proximity within the session radius is required', 403);
            }
            const lecture = this.db.prepare('SELECT * FROM academic_lectures WHERE id = ?').get(cluster.lecture_id)!;
            const existing = this.db.prepare('SELECT id FROM academic_attendance WHERE student_id = ? AND lecture_date = ? AND lecture_no = ?')
                .get(student.id, lecture.lecture_date, lecture.lecture_no);
            if (existing) throw new StatusError('Attendance already exists; ask faculty to correct the register', 409);
            this.db.prepare(`INSERT INTO academic_attendance (lecture_id, student_id, lecture_date, lecture_no, status, remarks)
                VALUES (?, ?, ?, ?, 'Present', 'Bluetooth cluster check-in (estimated proximity)')`)
                .run(lecture.id, student.id, lecture.lecture_date, lecture.lecture_no);
            this.db.prepare('UPDATE attendance_cluster_members SET accepted_at = ?, verified_until = NULL WHERE cluster_id = ? AND student_id = ?')
                .run(Date.now(), cluster.id, student.id);
            this.event(cluster.id, student.id, 'present', member.distance_m);
            return { success: true, lecture_id: lecture.id, status: 'Present' };
        });
    }
    assertLectureEditable(lectureId: unknown) {
        if (this.db.prepare('SELECT id FROM attendance_clusters WHERE lecture_id = ?').get(Number(lectureId))) {
            throw new StatusError('A lecture with a cluster cannot be rescheduled or deleted; correct attendance through the faculty register', 409);
        }
    }

    recordManualChange(studentId: number, date: string, slot: number, adminId: number, status: string) {
        const clusters = this.db.prepare(`SELECT c.id FROM attendance_clusters c
            JOIN attendance_cluster_members m ON m.cluster_id = c.id
            JOIN academic_lectures l ON l.id = c.lecture_id
            WHERE m.student_id = ? AND l.lecture_date = ? AND l.lecture_no = ?`).all(studentId, date, slot);
        for (const cluster of clusters) this.event(cluster.id, studentId, `faculty_override:${adminId}:${status}`);
    }
}
