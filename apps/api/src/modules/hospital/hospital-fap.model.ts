/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const FROM = `FROM family_members fm JOIN families f ON f.id = fm.family_id
 JOIN students s ON s.id = f.student_id LEFT JOIN colleges c ON c.id = s.college_id`;
const SCOPE = `(EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id = fm.id AND p.hospital_id = $1)
 OR ($2 = 1 AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id = fm.id)))`;
const conditionSQL: Record<string, string> = {
    HTN: `(fm.has_htn = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name ILIKE '%hypertension%'))`,
    DM: `(fm.has_dm = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name ILIKE '%diabetes%'))`,
    Anaemia: `(fm.has_anaemia = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND (mc.condition_name ILIKE '%anaemia%' OR mc.condition_name ILIKE '%anemia%')))`,
    Pediatric: `(fm.age_years <= 5)`,
    NoFollowUp: `NOT EXISTS (SELECT 1 FROM follow_ups fu WHERE fu.member_id=fm.id)`,
};

export interface FapFilters {
    search?: any;
    student_id?: any;
    university_id?: any;
    condition?: any;
    limit?: any;
    offset?: any;
}

function where(hospitalId: unknown, filters: FapFilters = {}) {
    const hid = Number(hospitalId);
    let sql = SCOPE;
    const args: any[] = [hid, hid];
    for (const [key, column] of [['student_id', 's.id'], ['university_id', 'c.id']] as const) {
        if (filters[key]) {
            args.push(Number(filters[key]));
            sql += ` AND ${column} = $${args.length}`;
        }
    }
    if (filters.condition && conditionSQL[filters.condition]) {
        sql += ` AND ${conditionSQL[filters.condition]}`;
    }
    if (filters.search?.trim()) {
        const term = `%${filters.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
        args.push(term);
        const termParam = `$${args.length}`;
        args.push(hid);
        const hidParam = `$${args.length}`;
        const fields = [
            'fm.name',
            'fm.contact_number',
            'f.contact_number',
            'f.family_code',
            'f.head_of_family',
            'f.village_ward',
            'f.village',
            'f.address',
            's.name',
            's.roll_number',
            'c.name',
            'fm.diagnosis',
            "('FAP-' || fm.id::text)",
        ];
        sql += ` AND (${fields.map((x) => `${x} ILIKE ${termParam} ESCAPE '\\'`).join(' OR ')}
         OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name ILIKE ${termParam} ESCAPE '\\')
         OR EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id=fm.id AND p.hospital_id=${hidParam} AND (p.patient_uid ILIKE ${termParam} ESCAPE '\\' OR p.phone ILIKE ${termParam} ESCAPE '\\')))`;
    }
    return { sql, args };
}

const selection = `fm.id, fm.name, fm.age_years, fm.age_months, fm.gender, fm.contact_number,
 fm.has_htn, fm.sbp, fm.dbp, fm.has_dm, fm.rbs, fm.has_anaemia, fm.hb, fm.bmi, fm.diagnosis,
 f.id AS family_id, f.family_code, f.head_of_family, COALESCE(NULLIF(f.village_ward,''), f.village) AS village,
 f.survey_date, s.id AS student_id, s.name AS student_name, s.roll_number AS student_roll,
 c.id AS university_id, c.name AS university_name,
 (SELECT STRING_AGG(mc.condition_name, ', ') FROM member_conditions mc WHERE mc.member_id=fm.id) AS conditions_summary,
 (SELECT COUNT(*) FROM follow_ups fu WHERE fu.member_id=fm.id) AS follow_up_count,
 (SELECT MAX(fu.visit_date) FROM follow_ups fu WHERE fu.member_id=fm.id) AS last_visit`;

@Injectable()
export class HospitalFapModel {
    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    async list(hospitalId: unknown, filters: FapFilters) {
        const { sql, args } = where(hospitalId, filters);
        const totalRow = await this.db.queryOne(`SELECT COUNT(*) AS total ${FROM} WHERE ${sql}`, ...args);
        const total = totalRow?.total || 0;
        const limitIdx = args.length + 1;
        const offsetIdx = args.length + 2;
        const patients = await this.db.queryAll(
            `SELECT ${selection} ${FROM} WHERE ${sql} ORDER BY fm.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            ...args,
            Number(filters.limit),
            Number(filters.offset),
        );
        return { patients, total, limit: filters.limit, offset: filters.offset };
    }

    async summary(hospitalId: unknown) {
        const { sql, args } = where(hospitalId);
        const totals = await this.db.queryOne(
            `SELECT COUNT(*) AS patients, COUNT(DISTINCT f.id) AS families,
                    COUNT(DISTINCT s.id) AS students,
                    COALESCE(SUM((SELECT COUNT(*) FROM follow_ups fu WHERE fu.member_id=fm.id)), 0) AS follow_ups
             ${FROM} WHERE ${sql}`,
            ...args,
        );
        const conditions = await Promise.all(
            Object.entries(conditionSQL).map(async ([key, expression]) => {
                const r = await this.db.queryOne(`SELECT COUNT(*) AS n ${FROM} WHERE ${sql} AND ${expression}`, ...args);
                return { key, count: r?.n || 0 };
            }),
        );
        const universities = await this.db.queryAll(
            `SELECT c.id, c.name, COUNT(*) AS patient_count ${FROM} WHERE ${sql} GROUP BY c.id, c.name ORDER BY patient_count DESC`,
            ...args,
        );
        return { totals, conditions, universities };
    }

    async options(hospitalId: unknown) {
        const { sql, args } = where(hospitalId);
        const [students, universities] = await Promise.all([
            this.db.queryAll(`SELECT DISTINCT s.id, s.name, s.roll_number, s.college_id ${FROM} WHERE ${sql} ORDER BY s.name`, ...args),
            this.db.queryAll(`SELECT DISTINCT c.id, c.name ${FROM} WHERE ${sql} AND c.id IS NOT NULL ORDER BY c.name`, ...args),
        ]);
        return { students, universities };
    }

    async dossier(hospitalId: unknown, id: number) {
        const { sql, args } = where(hospitalId);
        const member = await this.db.queryOne(
            `SELECT ${selection} ${FROM} WHERE ${sql} AND fm.id = $${args.length + 1}`,
            ...args,
            Number(id),
        );
        if (!member) return null;
        const [vitals, family, conditions, medications, allergies, history, lifestyle, follow_ups] = await Promise.all([
            this.db.queryOne('SELECT * FROM family_members WHERE id = $1', Number(id)),
            this.db.queryOne('SELECT * FROM families WHERE id = $1', Number(member.family_id)),
            this.db.queryAll('SELECT * FROM member_conditions WHERE member_id = $1 ORDER BY id DESC', Number(id)),
            this.db.queryAll('SELECT * FROM member_medications WHERE member_id = $1 ORDER BY id DESC', Number(id)),
            this.db.queryAll('SELECT * FROM member_allergies WHERE member_id = $1 ORDER BY id DESC', Number(id)),
            this.db.queryAll('SELECT * FROM member_medical_history WHERE member_id = $1 ORDER BY id DESC', Number(id)),
            this.db.queryOne('SELECT * FROM member_lifestyle WHERE member_id = $1', Number(id)),
            this.db.queryAll(
                `SELECT fu.*, s.name AS student_name, s.roll_number AS student_roll
                 FROM follow_ups fu LEFT JOIN students s ON s.id = fu.student_id
                 WHERE fu.member_id = $1 ORDER BY fu.visit_date DESC, fu.id DESC`,
                Number(id),
            ),
        ]);
        return {
            member,
            vitals,
            family,
            conditions,
            medications,
            allergies,
            history,
            lifestyle: lifestyle || null,
            follow_ups,
        };
    }
}
