const { db } = require('../config/db');
const { clean, cleanList } = require('../middleware/auth.middleware');

/**
 * CRM: Patient profile card + patient-managed family (head of family).
 *
 * Rules
 *  - Every patient account belongs to exactly one family (patients.family_id).
 *    It is created automatically on registration (or on first access for older accounts).
 *  - If the patient was already surveyed by a student, we reuse that surveyed family.
 *  - The first account in a family is its Head (can add / edit members); later accounts are Members (read-only).
 *  - Patients may edit BASIC details only. Medical fields (BP, sugar, Hb, conditions…) stay read-only
 *    and remain owned by the student survey. Every patient edit is stamped with patient_updated_at.
 *  - Patients can remove only members they added themselves and that have no health data yet.
 */

class FamilyError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const RELATIONS = ['Head', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister',
    'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Daughter-in-law', 'Son-in-law', 'Other'];
const MAX_MEMBERS = 25;

const str = (v, max = 120) => (v === undefined || v === null ? null : (String(v).trim().slice(0, max) || null));
const digits = (v) => String(v || '').replace(/\D/g, '');

function normGender(g) {
    const v = String(g || '').trim().toLowerCase();
    if (['m', 'male'].includes(v)) return 'M';
    if (['f', 'female'].includes(v)) return 'F';
    if (!v) return null;
    return 'Other';
}

function ageFromDob(dob) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    if (isNaN(d) || d > now) return null;
    let years = now.getFullYear() - d.getFullYear();
    let months = now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    return { years, months };
}

function validDob(dob) {
    if (dob === undefined) return undefined;
    if (dob === null || dob === '') return null;
    if (!ageFromDob(dob)) throw new FamilyError('Date of birth must be a valid past date (YYYY-MM-DD).');
    return dob;
}

function getPatient(patientId) {
    return db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
}

/** Members whose survey has medical data cannot be deleted by the patient. */
function hasHealthData(m) {
    const counts = db.prepare(`
        SELECT (SELECT COUNT(*) FROM member_conditions WHERE member_id = ?) +
               (SELECT COUNT(*) FROM member_medications WHERE member_id = ?) +
               (SELECT COUNT(*) FROM follow_ups WHERE member_id = ?) AS n
    `).get(m.id, m.id, m.id).n;
    return counts > 0 || m.sbp || m.dbp || m.rbs || m.hb || m.weight_kg || m.height_m;
}

const PatientFamilyModel = {
    FamilyError,
    BLOOD_GROUPS,
    RELATIONS,

    /**
     * Make sure the patient has a family + their own member row. Idempotent.
     * Returns the fresh patient row.
     */
    ensureFamily(patientId) {
        let p = getPatient(patientId);
        if (!p) throw new FamilyError('Patient not found', 404);

        if (p.family_id && db.prepare('SELECT id FROM families WHERE id = ?').get(p.family_id)) {
            return p;
        }

        const run = () => {
            let familyId = null;
            let memberId = p.family_member_id;

            // 1) Reuse the surveyed family if the patient is already a surveyed member
            if (memberId) {
                const m = db.prepare('SELECT family_id FROM family_members WHERE id = ?').get(memberId);
                if (m) familyId = m.family_id; else memberId = null;
            }

            // 2) Otherwise create a new household with the patient as head
            if (!familyId) {
                let familyNo = 1;
                if (p.student_id) {
                    familyNo = (db.prepare('SELECT MAX(family_no) AS n FROM families WHERE student_id = ?').get(p.student_id).n || 0) + 1;
                }
                const info = db.prepare(`
                    INSERT INTO families (student_id, family_no, head_of_family, address, family_code, family_name, contact_number)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(p.student_id || null, familyNo, p.name, p.address || null,
                    `FAM-${p.patient_uid}`, `${p.name.split(/\s+/).slice(-1)[0]} Family`, p.phone);
                familyId = Number(info.lastInsertRowid);
            }

            // 3) Make sure the patient has a member row inside the family
            if (!memberId) {
                const order = (db.prepare('SELECT MAX(member_order) AS n FROM family_members WHERE family_id = ?').get(familyId).n || 0) + 1;
                const age = ageFromDob(p.date_of_birth);
                const info = db.prepare(`
                    INSERT INTO family_members (family_id, member_order, name, relation_to_hof, gender, age_years, age_months,
                                                date_of_birth, contact_number, added_by_patient_id)
                    VALUES (?, ?, ?, 'Head', ?, ?, ?, ?, ?, ?)
                `).run(familyId, order, p.name, normGender(p.gender),
                    age ? age.years : (p.age_years || 0), age ? age.months : 0,
                    p.date_of_birth || null, p.phone, p.id);
                memberId = Number(info.lastInsertRowid);
            }

            // 4) First account in a family is the Head
            const head = db.prepare("SELECT id FROM patients WHERE family_id = ? AND family_role = 'Head' AND id != ?").get(familyId, p.id);
            db.prepare(`
                UPDATE patients SET family_id = ?, family_member_id = ?, family_role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(familyId, memberId, head ? 'Member' : 'Head', p.id);
        };

        db.exec('BEGIN');
        try { run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
        return getPatient(patientId);
    },

    /**
     * Called after a patient links a student's referral code.
     *  - If the student had already surveyed this patient (matchMemberId) and the patient's own
     *    self-created family is still empty, move the account into the surveyed family.
     *  - Otherwise the student adopts the patient's family (so they can record health data for it).
     */
    onStudentLinked(patientId, studentId, matchMemberId) {
        let p = this.ensureFamily(patientId);
        const fam = db.prepare('SELECT * FROM families WHERE id = ?').get(p.family_id);
        const run = () => {
            if (matchMemberId && matchMemberId !== p.family_member_id) {
                const match = db.prepare('SELECT * FROM family_members WHERE id = ?').get(matchMemberId);
                const others = db.prepare('SELECT COUNT(*) AS n FROM family_members WHERE family_id = ? AND id != ?').get(p.family_id, p.family_member_id).n;
                const self = db.prepare('SELECT * FROM family_members WHERE id = ?').get(p.family_member_id);
                if (match && !fam.student_id && others === 0 && self && !hasHealthData(self)) {
                    const head = db.prepare("SELECT id FROM patients WHERE family_id = ? AND family_role = 'Head' AND id != ?").get(match.family_id, p.id);
                    db.prepare(`UPDATE patients SET family_id = ?, family_member_id = ?, family_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
                        .run(match.family_id, match.id, head ? 'Member' : 'Head', p.id);
                    db.prepare('DELETE FROM family_members WHERE id = ?').run(self.id);
                    db.prepare('DELETE FROM families WHERE id = ? AND NOT EXISTS (SELECT 1 FROM family_members WHERE family_id = ?)').run(fam.id, fam.id);
                    return;
                }
            }
            if (!fam.student_id) {
                const no = (db.prepare('SELECT MAX(family_no) AS n FROM families WHERE student_id = ?').get(studentId).n || 0) + 1;
                db.prepare('UPDATE families SET student_id = ?, family_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(studentId, no, fam.id);
            }
        };
        db.exec('BEGIN');
        try { run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
        return getPatient(patientId);
    },

    /* ======================= Profile card ======================= */

    getCard(patientId) {
        const p = this.ensureFamily(patientId);
        const row = db.prepare(`
            SELECT p.*, s.name AS student_name, s.roll_number AS student_roll, c.name AS college_name,
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
            WHERE p.id = ?
        `).get(p.id);
        const card = clean(row);
        delete card.pin;                                // never send credentials to the client
        const age = ageFromDob(card.date_of_birth);
        if (age) card.age_years = age.years;
        card.blood_groups = BLOOD_GROUPS;
        return card;
    },

    updateProfile(patientId, body = {}) {
        const p = this.ensureFamily(patientId);
        const next = {
            name: body.name !== undefined ? str(body.name, 80) : p.name,
            email: body.email !== undefined ? str(body.email, 120) : p.email,
            gender: body.gender !== undefined ? (str(body.gender, 10) || p.gender) : p.gender,
            date_of_birth: body.date_of_birth !== undefined ? validDob(body.date_of_birth) : p.date_of_birth,
            address: body.address !== undefined ? str(body.address, 300) : p.address,
            blood_group: body.blood_group !== undefined ? str(body.blood_group, 10) : p.blood_group,
            emergency_contact_name: body.emergency_contact_name !== undefined ? str(body.emergency_contact_name, 80) : p.emergency_contact_name,
            emergency_contact_phone: body.emergency_contact_phone !== undefined ? (digits(body.emergency_contact_phone) || null) : p.emergency_contact_phone,
            emergency_contact_relation: body.emergency_contact_relation !== undefined ? str(body.emergency_contact_relation, 40) : p.emergency_contact_relation
        };
        if (!next.name) throw new FamilyError('Name is required.');
        if (next.blood_group && !BLOOD_GROUPS.includes(next.blood_group)) throw new FamilyError(`Blood group must be one of: ${BLOOD_GROUPS.join(', ')}`);
        if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new FamilyError('Please enter a valid email address.');
        if (next.emergency_contact_phone && next.emergency_contact_phone.length !== 10) throw new FamilyError('Emergency contact phone must be a 10-digit mobile number.');
        if (next.emergency_contact_phone && next.emergency_contact_phone === p.phone) throw new FamilyError('Emergency contact should be someone other than you.');
        const age = ageFromDob(next.date_of_birth);

        db.prepare(`
            UPDATE patients SET name = ?, email = ?, gender = ?, date_of_birth = ?, age_years = COALESCE(?, age_years), address = ?,
                   blood_group = ?, emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?,
                   updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(next.name, next.email, next.gender, next.date_of_birth, age ? age.years : null, next.address,
            next.blood_group, next.emergency_contact_name, next.emergency_contact_phone, next.emergency_contact_relation, p.id);

        // Keep the patient's own survey row in sync (basic fields only)
        if (p.family_member_id) {
            db.prepare(`
                UPDATE family_members SET name = ?, gender = COALESCE(?, gender), date_of_birth = COALESCE(?, date_of_birth),
                       age_years = COALESCE(?, age_years), age_months = COALESCE(?, age_months),
                       patient_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(next.name, normGender(next.gender), next.date_of_birth, age ? age.years : null, age ? age.months : null, p.family_member_id);
            if (p.family_role === 'Head') {
                db.prepare('UPDATE families SET head_of_family = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next.name, p.family_id);
            }
        }
        return this.getCard(p.id);
    },

    /* ======================= Family ======================= */

    getFamily(patientId) {
        const p = this.ensureFamily(patientId);
        const family = db.prepare(`
            SELECT f.id, f.family_code, f.family_name, f.head_of_family, f.address, f.village, f.city, f.district, f.state, f.pincode,
                   f.contact_number, f.student_id, s.name AS student_name, s.roll_number AS student_roll
            FROM families f LEFT JOIN students s ON s.id = f.student_id
            WHERE f.id = ?
        `).get(p.family_id);

        const members = db.prepare(`
            SELECT m.id, m.member_order, m.name, m.relation_to_hof, m.gender, m.age_years, m.age_months, m.date_of_birth,
                   m.contact_number, m.marital_status, m.education, m.occupation,
                   m.sbp, m.dbp, m.rbs, m.hb, m.bmi, m.weight_kg, m.height_m, m.has_htn, m.has_dm, m.has_anaemia,
                   m.added_by_patient_id, m.patient_updated_at, m.updated_at,
                   (SELECT GROUP_CONCAT(condition_name, ', ') FROM member_conditions c WHERE c.member_id = m.id) AS conditions,
                   (SELECT COUNT(*) FROM member_medications x WHERE x.member_id = m.id) AS medications_count,
                   (SELECT p2.patient_uid FROM patients p2 WHERE p2.family_member_id = m.id LIMIT 1) AS account_uid
            FROM family_members m
            WHERE m.family_id = ?
            ORDER BY CASE WHEN m.id = ? THEN 0 ELSE 1 END, m.member_order, m.id
        `).all(p.family_id, p.family_member_id);

        const canEdit = p.family_role === 'Head';
        return {
            family: clean(family),
            role: p.family_role,
            can_edit: canEdit,
            relations: RELATIONS,
            members: cleanList(members).map((m) => ({
                ...m,
                is_self: m.id === p.family_member_id,
                surveyed: !m.added_by_patient_id,
                can_edit: canEdit && m.id !== p.family_member_id,
                can_delete: canEdit && m.id !== p.family_member_id && m.added_by_patient_id === p.id && !hasHealthData(m)
            }))
        };
    },

    updateFamily(patientId, body = {}) {
        const p = this.requireHead(patientId);
        const f = db.prepare('SELECT * FROM families WHERE id = ?').get(p.family_id);
        const pick = (k, max) => (body[k] !== undefined ? str(body[k], max) : f[k]);
        const pin = body.pincode !== undefined ? (digits(body.pincode) || null) : f.pincode;
        if (pin && pin.length !== 6) throw new FamilyError('PIN code must be 6 digits.');
        db.prepare(`
            UPDATE families SET family_name = ?, address = ?, village = ?, city = ?, district = ?, state = ?, pincode = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(pick('family_name', 80), pick('address', 300), pick('village', 80), pick('city', 80), pick('district', 80), pick('state', 80), pin, f.id);
        return this.getFamily(patientId);
    },

    requireHead(patientId) {
        const p = this.ensureFamily(patientId);
        if (p.family_role !== 'Head') throw new FamilyError('Only the head of the family can make changes.', 403);
        return p;
    },

    memberPayload(body, existing = {}) {
        const out = {};
        const set = (k, v) => { if (v !== undefined) out[k] = v; };
        set('name', body.name !== undefined ? str(body.name, 80) : undefined);
        if (body.relation_to_hof !== undefined) {
            const r = str(body.relation_to_hof, 30);
            if (r && !RELATIONS.includes(r)) throw new FamilyError(`Relation must be one of: ${RELATIONS.join(', ')}`);
            if (r === 'Head') throw new FamilyError('This family already has a head.');
            out.relation_to_hof = r;
        }
        if (body.gender !== undefined) {
            const g = normGender(body.gender);
            if (!g) throw new FamilyError('Gender is required.');
            out.gender = g;
        }
        const dob = validDob(body.date_of_birth);
        if (dob !== undefined) out.date_of_birth = dob;
        const age = ageFromDob(dob === undefined ? existing.date_of_birth : dob);
        if (age) { out.age_years = age.years; out.age_months = age.months; }
        else if (body.age_years !== undefined && body.age_years !== '' && body.age_years !== null) {
            const a = parseInt(body.age_years, 10);
            if (isNaN(a) || a < 0 || a > 120) throw new FamilyError('Age must be between 0 and 120.');
            out.age_years = a;
        }
        if (body.contact_number !== undefined) {
            const ph = digits(body.contact_number);
            if (ph && ph.length !== 10) throw new FamilyError('Phone must be a 10-digit mobile number.');
            out.contact_number = ph || null;
        }
        set('marital_status', body.marital_status !== undefined ? (str(body.marital_status, 20) || 'Unknown') : undefined);
        set('education', body.education !== undefined ? str(body.education, 60) : undefined);
        set('occupation', body.occupation !== undefined ? str(body.occupation, 60) : undefined);
        return out;
    },

    addMember(patientId, body = {}) {
        const p = this.requireHead(patientId);
        const data = this.memberPayload(body);
        if (!data.name) throw new FamilyError('Member name is required.');
        if (!data.relation_to_hof) throw new FamilyError('Relation is required.');
        if (!data.gender) throw new FamilyError('Gender is required.');
        if (data.age_years === undefined) throw new FamilyError('Enter date of birth or age.');
        const count = db.prepare('SELECT COUNT(*) AS n FROM family_members WHERE family_id = ?').get(p.family_id).n;
        if (count >= MAX_MEMBERS) throw new FamilyError(`A family can have at most ${MAX_MEMBERS} members.`);
        const dup = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND LOWER(TRIM(name)) = LOWER(?)').get(p.family_id, data.name);
        if (dup) throw new FamilyError(`${data.name} is already in your family.`, 409);

        const order = (db.prepare('SELECT MAX(member_order) AS n FROM family_members WHERE family_id = ?').get(p.family_id).n || 0) + 1;
        const info = db.prepare(`
            INSERT INTO family_members (family_id, member_order, name, relation_to_hof, gender, age_years, age_months, date_of_birth,
                                        contact_number, marital_status, education, occupation, added_by_patient_id, patient_updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(p.family_id, order, data.name, data.relation_to_hof, data.gender, data.age_years, data.age_months || 0,
            data.date_of_birth || null, data.contact_number || null, data.marital_status || 'Unknown',
            data.education || null, data.occupation || null, p.id);
        return { id: Number(info.lastInsertRowid), ...this.getFamily(patientId) };
    },

    getMemberInFamily(p, memberId) {
        const m = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId);
        if (!m || m.family_id !== p.family_id) throw new FamilyError('Family member not found', 404);
        return m;
    },

    updateMember(patientId, memberId, body = {}) {
        const p = this.requireHead(patientId);
        const m = this.getMemberInFamily(p, memberId);
        if (m.id === p.family_member_id) throw new FamilyError('Edit your own details from your Profile.');
        const data = this.memberPayload(body, m);
        if (data.name === null) throw new FamilyError('Member name cannot be empty.');
        const keys = Object.keys(data);
        if (!keys.length) throw new FamilyError('Nothing to update.');
        db.prepare(`
            UPDATE family_members SET ${keys.map((k) => `${k} = ?`).join(', ')}, patient_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(...keys.map((k) => data[k]), m.id);
        return this.getFamily(patientId);
    },

    deleteMember(patientId, memberId) {
        const p = this.requireHead(patientId);
        const m = this.getMemberInFamily(p, memberId);
        if (m.id === p.family_member_id) throw new FamilyError('You cannot remove yourself.');
        if (m.added_by_patient_id !== p.id) throw new FamilyError('This member was recorded in the health survey. Ask your hospital or student to remove them.', 403);
        if (hasHealthData(m)) throw new FamilyError('This member already has health records, so they cannot be removed.', 403);
        if (db.prepare('SELECT id FROM patients WHERE family_member_id = ?').get(m.id)) throw new FamilyError('This member has their own patient account.', 403);
        db.prepare('DELETE FROM family_members WHERE id = ?').run(m.id);
        return this.getFamily(patientId);
    }
};

module.exports = PatientFamilyModel;
