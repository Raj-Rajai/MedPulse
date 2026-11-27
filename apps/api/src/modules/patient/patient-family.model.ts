/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Db } from '../../database/db.types';
import { clean, cleanList, Row } from '../../common/row';
import { StatusError } from '../../common/http-error';
import { canReadMember, isMinor } from './patient-privacy.service';

export const FamilyError = StatusError;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
export const RELATIONS = [
    'Head', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister',
    'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Daughter-in-law', 'Son-in-law', 'Other',
];
export const MAX_MEMBERS = 25;

const str = (v: any, max = 120): string | null => (v === undefined || v === null ? null : (String(v).trim().slice(0, max) || null));
const digits = (v: any): string => String(v || '').replace(/\D/g, '');

function normGender(g: any): string | null {
    const v = String(g || '').trim().toLowerCase();
    if (['m', 'male'].includes(v)) return 'M';
    if (['f', 'female'].includes(v)) return 'F';
    if (!v) return null;
    return 'Other';
}

function ageFromDob(dob: any): { years: number; months: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    if (isNaN(d as any) || d > now) return null;
    let years = now.getFullYear() - d.getFullYear();
    let months = now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    return { years, months };
}

function validDob(dob: any): any {
    if (dob === undefined) return undefined;
    if (dob === null || dob === '') return null;
    if (!ageFromDob(dob)) throw new StatusError('Date of birth must be a valid past date (YYYY-MM-DD).');
    return dob;
}

@Injectable()
export class PatientFamilyModel {
    static readonly FamilyError = StatusError;
    static readonly BLOOD_GROUPS = BLOOD_GROUPS;
    static readonly RELATIONS = RELATIONS;

    constructor(private readonly database: DatabaseService) {}

    private get db() {
        return this.database.db;
    }

    private async getPatient(patientId: unknown, db: Db = this.db): Promise<Row> {
        return (await db.queryOne('SELECT * FROM patients WHERE id = $1', Number(patientId)))!;
    }

    private async hasHealthData(m: Row, db: Db = this.db): Promise<boolean> {
        const mid = Number(m.id);
        const row = await db.queryOne(
            `SELECT (SELECT COUNT(*) FROM member_conditions WHERE member_id = $1) +
                    (SELECT COUNT(*) FROM member_medications WHERE member_id = $2) +
                    (SELECT COUNT(*) FROM follow_ups WHERE member_id = $3) AS n`,
            mid,
            mid,
            mid,
        );
        const counts = row?.n || 0;
        return !!(counts > 0 || m.sbp || m.dbp || m.rbs || m.hb || m.weight_kg || m.height_m);
    }

    async ensureFamily(patientId: unknown): Promise<Row> {
        const p = await this.getPatient(patientId);
        if (!p) throw new StatusError('Patient not found', 404);

        if (p.family_id && (await this.db.queryOne('SELECT id FROM families WHERE id = $1', Number(p.family_id)))) {
            return p;
        }

        await this.db.inTransaction(async (tx) => {
            let familyId: number | null = null;
            let memberId: number | null = p.family_member_id ? Number(p.family_member_id) : null;

            if (memberId) {
                const m = await tx.queryOne('SELECT family_id FROM family_members WHERE id = $1', memberId);
                if (m) familyId = Number(m.family_id);
                else memberId = null;
            }

            if (!familyId) {
                let familyNo = 1;
                if (p.student_id) {
                    const maxRow = await tx.queryOne('SELECT MAX(family_no) AS n FROM families WHERE student_id = $1', Number(p.student_id));
                    familyNo = (maxRow?.n || 0) + 1;
                }
                const info = await tx.insert(
                    `INSERT INTO families (student_id, family_no, head_of_family, address, family_code, family_name, contact_number)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    p.student_id ? Number(p.student_id) : null,
                    familyNo,
                    p.name,
                    p.address || null,
                    `FAM-${p.patient_uid}`,
                    `${p.name.split(/\s+/).slice(-1)[0]} Family`,
                    p.phone,
                );
                familyId = info.lastInsertRowid;
            }

            if (!memberId) {
                const orderRow = await tx.queryOne('SELECT MAX(member_order) AS n FROM family_members WHERE family_id = $1', familyId);
                const order = (orderRow?.n || 0) + 1;
                const age = ageFromDob(p.date_of_birth);
                const info = await tx.insert(
                    `INSERT INTO family_members (family_id, member_order, name, relation_to_hof, gender, age_years, age_months,
                                                 date_of_birth, contact_number, added_by_patient_id)
                     VALUES ($1, $2, $3, 'Head', $4, $5, $6, $7, $8, $9)`,
                    familyId,
                    order,
                    p.name,
                    normGender(p.gender),
                    age ? age.years : (p.age_years || 0),
                    age ? age.months : 0,
                    p.date_of_birth || null,
                    p.phone,
                    Number(p.id),
                );
                memberId = info.lastInsertRowid;
            }

            const head = await tx.queryOne(
                "SELECT id FROM patients WHERE family_id = $1 AND family_role = 'Head' AND id != $2",
                familyId,
                Number(p.id),
            );
            await tx.execute(
                `UPDATE patients SET family_id = $1, family_member_id = $2, family_role = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                familyId,
                memberId,
                head ? 'Member' : 'Head',
                Number(p.id),
            );
        });

        return this.getPatient(patientId);
    }

    async onStudentLinked(patientId: unknown, studentId: unknown, matchMemberId: any): Promise<Row> {
        const p = await this.ensureFamily(patientId);
        const fam = (await this.db.queryOne('SELECT * FROM families WHERE id = $1', Number(p.family_id)))!;

        await this.db.inTransaction(async (tx) => {
            if (matchMemberId && Number(matchMemberId) !== Number(p.family_member_id)) {
                const match = await tx.queryOne('SELECT * FROM family_members WHERE id = $1', Number(matchMemberId));
                const othersRow = await tx.queryOne(
                    'SELECT COUNT(*) AS n FROM family_members WHERE family_id = $1 AND id != $2',
                    Number(p.family_id),
                    Number(p.family_member_id),
                );
                const others = othersRow?.n || 0;
                const self = await tx.queryOne('SELECT * FROM family_members WHERE id = $1', Number(p.family_member_id));
                if (match && !fam.student_id && others === 0 && self && !(await this.hasHealthData(self, tx))) {
                    const head = await tx.queryOne(
                        "SELECT id FROM patients WHERE family_id = $1 AND family_role = 'Head' AND id != $2",
                        Number(match.family_id),
                        Number(p.id),
                    );
                    await tx.execute(
                        `UPDATE patients SET family_id = $1, family_member_id = $2, family_role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
                        Number(match.family_id),
                        Number(match.id),
                        head ? 'Member' : 'Head',
                        Number(p.id),
                    );
                    await tx.execute('DELETE FROM family_members WHERE id = $1', Number(self.id));
                    await tx.execute(
                        'DELETE FROM families WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM family_members WHERE family_id = $2)',
                        Number(fam.id),
                        Number(fam.id),
                    );
                    return;
                }
            }
            if (!fam.student_id) {
                const maxRow = await tx.queryOne('SELECT MAX(family_no) AS n FROM families WHERE student_id = $1', Number(studentId));
                const no = (maxRow?.n || 0) + 1;
                await tx.execute(
                    'UPDATE families SET student_id = $1, family_no = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                    Number(studentId),
                    no,
                    Number(fam.id),
                );
            }
        });

        return this.getPatient(patientId);
    }

    async getCard(patientId: unknown): Promise<Row> {
        const p = await this.ensureFamily(patientId);
        const row = await this.db.queryOne(
            `SELECT p.*, s.name AS student_name, s.roll_number AS student_roll, c.name AS college_name,
                    h.name AS hospital_name, h.code AS hospital_code, h.city AS hospital_city,
                    h.contact_phone AS hospital_phone, h.contact_email AS hospital_email,
                    f.family_code, f.family_name, f.head_of_family, f.address AS family_address,
                    f.village, f.city, f.district, f.state, f.pincode,
                    (SELECT COUNT(*) FROM family_members m WHERE m.family_id = p.family_id) AS family_size
             FROM patients p
             LEFT JOIN students s ON s.id = p.student_id
             LEFT JOIN colleges c ON c.id = s.college_id
             LEFT JOIN hospitals h ON h.id = COALESCE(p.hospital_id, 1)
             LEFT JOIN families f ON f.id = p.family_id
             WHERE p.id = $1`,
            Number(p.id),
        );
        const card = clean(row)!;
        delete card.pin;
        const age = ageFromDob(card.date_of_birth);
        if (age) card.age_years = age.years;
        delete card.blood_group;
        return card;
    }

    async updateProfile(patientId: unknown, body: Record<string, any> = {}): Promise<Row> {
        if (body.blood_group !== undefined) throw new StatusError('Request a clinical correction for blood group information.', 403);
        const p = await this.ensureFamily(patientId);
        const next = {
            name: body.name !== undefined ? str(body.name, 80) : p.name,
            email: body.email !== undefined ? str(body.email, 120) : p.email,
            gender: body.gender !== undefined ? (str(body.gender, 10) || p.gender) : p.gender,
            date_of_birth: body.date_of_birth !== undefined ? validDob(body.date_of_birth) : p.date_of_birth,
            address: body.address !== undefined ? str(body.address, 300) : p.address,
            blood_group: body.blood_group !== undefined ? str(body.blood_group, 10) : p.blood_group,
            emergency_contact_name: body.emergency_contact_name !== undefined ? str(body.emergency_contact_name, 80) : p.emergency_contact_name,
            emergency_contact_phone: body.emergency_contact_phone !== undefined ? (digits(body.emergency_contact_phone) || null) : p.emergency_contact_phone,
            emergency_contact_relation: body.emergency_contact_relation !== undefined ? str(body.emergency_contact_relation, 40) : p.emergency_contact_relation,
        };
        if (!next.name) throw new StatusError('Name is required.');
        if (next.blood_group && !BLOOD_GROUPS.includes(next.blood_group)) throw new StatusError(`Blood group must be one of: ${BLOOD_GROUPS.join(', ')}`);
        if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new StatusError('Please enter a valid email address.');
        if (next.emergency_contact_phone && next.emergency_contact_phone.length !== 10) throw new StatusError('Emergency contact phone must be a 10-digit mobile number.');
        if (next.emergency_contact_phone && next.emergency_contact_phone === p.phone) throw new StatusError('Emergency contact should be someone other than you.');
        const age = ageFromDob(next.date_of_birth);

        await this.db.execute(
            `UPDATE patients
             SET name = $1, email = $2, gender = $3, date_of_birth = $4, age_years = COALESCE($5, age_years), address = $6,
                 blood_group = $7, emergency_contact_name = $8, emergency_contact_phone = $9, emergency_contact_relation = $10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11`,
            next.name,
            next.email,
            next.gender,
            next.date_of_birth,
            age ? age.years : null,
            next.address,
            next.blood_group,
            next.emergency_contact_name,
            next.emergency_contact_phone,
            next.emergency_contact_relation,
            Number(p.id),
        );

        if (p.family_member_id) {
            await this.db.execute(
                `UPDATE family_members
                 SET name = $1, gender = COALESCE($2, gender), date_of_birth = COALESCE($3, date_of_birth),
                     age_years = COALESCE($4, age_years), age_months = COALESCE($5, age_months),
                     patient_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6`,
                next.name,
                normGender(next.gender),
                next.date_of_birth,
                age ? age.years : null,
                age ? age.months : null,
                Number(p.family_member_id),
            );
            if (p.family_role === 'Head') {
                await this.db.execute(
                    'UPDATE families SET head_of_family = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    next.name,
                    Number(p.family_id),
                );
            }
        }
        return this.getCard(p.id);
    }

    async getFamily(patientId: unknown) {
        const p = await this.ensureFamily(patientId);
        const [family, members] = await Promise.all([
            this.db.queryOne(
                `SELECT f.id, f.family_code, f.family_name, f.head_of_family, f.address, f.village, f.city, f.district, f.state, f.pincode,
                        f.contact_number, f.student_id, s.name AS student_name, s.roll_number AS student_roll
                 FROM families f LEFT JOIN students s ON s.id = f.student_id
                 WHERE f.id = $1`,
                Number(p.family_id),
            ),
            this.db.queryAll(
                `SELECT m.id, m.medpulse_id, m.member_order, m.name, m.relation_to_hof, m.gender, m.age_years, m.age_months, m.date_of_birth,
                        m.contact_number, m.marital_status, m.education, m.occupation,
                        m.sbp, m.dbp, m.rbs, m.hb, m.bmi, m.weight_kg, m.height_m, m.has_htn, m.has_dm, m.has_anaemia,
                        m.added_by_patient_id, m.patient_updated_at, m.updated_at,
                        (SELECT STRING_AGG(condition_name, ', ') FROM member_conditions c WHERE c.member_id = m.id) AS conditions,
                        (SELECT COUNT(*) FROM member_medications x WHERE x.member_id = m.id) AS medications_count,
                        (SELECT p2.patient_uid FROM patients p2 WHERE p2.family_member_id = m.id LIMIT 1) AS account_uid
                 FROM family_members m
                 WHERE m.family_id = $1
                 ORDER BY CASE WHEN m.id = $2 THEN 0 ELSE 1 END, m.member_order, m.id`,
                Number(p.family_id),
                Number(p.family_member_id || 0),
            ),
        ]);

        const canEdit = p.family_role === 'Head';
        const mappedMembers = await Promise.all(
            cleanList(members).map(async (m) => {
                const self = Number(m.id) === Number(p.family_member_id);
                const account = await this.db.queryOne(
                    'SELECT id FROM patients WHERE family_member_id = $1 AND status = $2',
                    Number(m.id),
                    'Active',
                );
                const basicEditable = canEdit && !self && Number(m.added_by_patient_id) === Number(p.id) && !account;
                const canView = await canReadMember(this.db, p, { ...m, family_id: p.family_id });
                const hasHealth = basicEditable ? await this.hasHealthData(m) : false;
                return {
                    id: m.id,
                    name: m.name,
                    medpulse_id: m.medpulse_id,
                    relation_to_hof: m.relation_to_hof,
                    is_self: self,
                    surveyed: !m.added_by_patient_id,
                    age_years: m.age_years,
                    gender: m.gender,
                    can_view_records: canView,
                    can_request_guardian: !self && isMinor(m),
                    account_patient_id: account?.id || null,
                    can_edit: basicEditable,
                    can_delete: basicEditable && !hasHealth,
                    ...(self || basicEditable
                        ? {
                            date_of_birth: m.date_of_birth,
                            contact_number: m.contact_number,
                            occupation: m.occupation,
                            education: m.education,
                            marital_status: m.marital_status,
                        }
                        : {}),
                };
            }),
        );

        return {
            family: clean(family),
            role: p.family_role,
            can_edit: canEdit,
            relations: RELATIONS,
            members: mappedMembers,
        };
    }

    async updateFamily(patientId: unknown, body: Record<string, any> = {}) {
        const p = await this.requireHead(patientId);
        const f = (await this.db.queryOne('SELECT * FROM families WHERE id = $1', Number(p.family_id)))!;
        const pick = (k: string, max: number) => (body[k] !== undefined ? str(body[k], max) : f[k]);
        const pin = body.pincode !== undefined ? (digits(body.pincode) || null) : f.pincode;
        if (pin && pin.length !== 6) throw new StatusError('PIN code must be 6 digits.');
        await this.db.execute(
            `UPDATE families
             SET family_name = $1, address = $2, village = $3, city = $4, district = $5, state = $6, pincode = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            pick('family_name', 80),
            pick('address', 300),
            pick('village', 80),
            pick('city', 80),
            pick('district', 80),
            pick('state', 80),
            pin,
            Number(f.id),
        );
        return this.getFamily(patientId);
    }

    async requireHead(patientId: unknown): Promise<Row> {
        const p = await this.ensureFamily(patientId);
        if (p.family_role !== 'Head') throw new StatusError('Only the head of the family can make changes.', 403);
        return p;
    }

    memberPayload(body: Record<string, any>, existing: Row = {}): Record<string, any> {
        const out: Record<string, any> = {};
        const set = (k: string, v: any) => { if (v !== undefined) out[k] = v; };
        set('name', body.name !== undefined ? str(body.name, 80) : undefined);
        if (body.relation_to_hof !== undefined) {
            const r = str(body.relation_to_hof, 30);
            if (r && !RELATIONS.includes(r)) throw new StatusError(`Relation must be one of: ${RELATIONS.join(', ')}`);
            if (r === 'Head') throw new StatusError('This family already has a head.');
            out.relation_to_hof = r;
        }
        if (body.gender !== undefined) {
            const g = normGender(body.gender);
            if (!g) throw new StatusError('Gender is required.');
            out.gender = g;
        }
        const dob = validDob(body.date_of_birth);
        if (dob !== undefined) out.date_of_birth = dob;
        const age = ageFromDob(dob === undefined ? existing.date_of_birth : dob);
        if (age) {
            out.age_years = age.years;
            out.age_months = age.months;
        } else if (body.age_years !== undefined && body.age_years !== '' && body.age_years !== null) {
            const a = parseInt(body.age_years, 10);
            if (isNaN(a) || a < 0 || a > 120) throw new StatusError('Age must be between 0 and 120.');
            out.age_years = a;
        }
        if (body.contact_number !== undefined) {
            const ph = digits(body.contact_number);
            if (ph && ph.length !== 10) throw new StatusError('Phone must be a 10-digit mobile number.');
            out.contact_number = ph || null;
        }
        set('marital_status', body.marital_status !== undefined ? (str(body.marital_status, 20) || 'Unknown') : undefined);
        set('education', body.education !== undefined ? str(body.education, 60) : undefined);
        set('occupation', body.occupation !== undefined ? str(body.occupation, 60) : undefined);
        return out;
    }

    async addMember(patientId: unknown, body: Record<string, any> = {}) {
        const p = await this.requireHead(patientId);
        const data = this.memberPayload(body);
        if (!data.name) throw new StatusError('Member name is required.');
        if (!data.relation_to_hof) throw new StatusError('Relation is required.');
        if (!data.gender) throw new StatusError('Gender is required.');
        if (data.age_years === undefined) throw new StatusError('Enter date of birth or age.');

        const countRow = await this.db.queryOne('SELECT COUNT(*) AS n FROM family_members WHERE family_id = $1', Number(p.family_id));
        if ((countRow?.n || 0) >= MAX_MEMBERS) throw new StatusError(`A family can have at most ${MAX_MEMBERS} members.`);
        const dup = await this.db.queryOne(
            'SELECT id FROM family_members WHERE family_id = $1 AND LOWER(TRIM(name)) = LOWER($2)',
            Number(p.family_id),
            data.name,
        );
        if (dup) throw new StatusError(`${data.name} is already in your family.`, 409);

        const orderRow = await this.db.queryOne('SELECT MAX(member_order) AS n FROM family_members WHERE family_id = $1', Number(p.family_id));
        const order = (orderRow?.n || 0) + 1;
        const info = await this.db.insert(
            `INSERT INTO family_members (family_id, member_order, name, relation_to_hof, gender, age_years, age_months, date_of_birth,
                                         contact_number, marital_status, education, occupation, added_by_patient_id, patient_updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
            Number(p.family_id),
            order,
            data.name,
            data.relation_to_hof,
            data.gender,
            data.age_years,
            data.age_months || 0,
            data.date_of_birth || null,
            data.contact_number || null,
            data.marital_status || 'Unknown',
            data.education || null,
            data.occupation || null,
            Number(p.id),
        );
        return { id: info.lastInsertRowid, ...(await this.getFamily(patientId)) };
    }

    async getMemberInFamily(p: Row, memberId: unknown): Promise<Row> {
        const m = await this.db.queryOne('SELECT * FROM family_members WHERE id = $1', Number(memberId));
        if (!m || Number(m.family_id) !== Number(p.family_id)) throw new StatusError('Family member not found', 404);
        return m;
    }

    async updateMember(patientId: unknown, memberId: unknown, body: Record<string, any> = {}) {
        const p = await this.requireHead(patientId);
        const m = await this.getMemberInFamily(p, memberId);
        if (Number(m.id) === Number(p.family_member_id)) throw new StatusError('Edit your own details from your Profile.');
        const account = await this.db.queryOne('SELECT id FROM patients WHERE family_member_id = $1', Number(m.id));
        if (Number(m.added_by_patient_id) !== Number(p.id) || account) {
            throw new StatusError('This member manages their own details or is managed by the care team.', 403);
        }
        const data = this.memberPayload(body, m);
        if (data.name === null) throw new StatusError('Member name cannot be empty.');
        const keys = Object.keys(data);
        if (!keys.length) throw new StatusError('Nothing to update.');
        const setSql = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
        await this.db.execute(
            `UPDATE family_members SET ${setSql}, patient_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${keys.length + 1}`,
            ...keys.map((k) => data[k]),
            Number(m.id),
        );
        return this.getFamily(patientId);
    }

    async deleteMember(patientId: unknown, memberId: unknown) {
        const p = await this.requireHead(patientId);
        const m = await this.getMemberInFamily(p, memberId);
        if (Number(m.id) === Number(p.family_member_id)) throw new StatusError('You cannot remove yourself.');
        if (Number(m.added_by_patient_id) !== Number(p.id)) {
            throw new StatusError('This member was recorded in the health survey. Ask your hospital or student to remove them.', 403);
        }
        if (await this.hasHealthData(m)) {
            throw new StatusError('This member already has health records, so they cannot be removed.', 403);
        }
        if (await this.db.queryOne('SELECT id FROM patients WHERE family_member_id = $1', Number(m.id))) {
            throw new StatusError('This member has their own patient account.', 403);
        }
        await this.db.execute('DELETE FROM family_members WHERE id = $1', Number(m.id));
        return this.getFamily(patientId);
    }
}
