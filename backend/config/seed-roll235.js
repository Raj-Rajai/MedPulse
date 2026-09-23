const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '..', 'database', 'health_survey.db');

function seedRoll235(targetDb) {
    const db = targetDb || new DatabaseSync(dbPath);

    console.log('🌱 Seeding Roll 235 Real Field Survey Data from Roll235.pdf...');

    // Parse JSON generated from Roll235.pdf
    const parsedJsonPath = path.join(__dirname, '..', 'database', 'roll235_parsed.json');
    let membersData = [];

    if (fs.existsSync(parsedJsonPath)) {
        membersData = JSON.parse(fs.readFileSync(parsedJsonPath, 'utf8'));
    } else {
        const fallbackPath = path.join(__dirname, 'roll235_parsed.json');
        if (fs.existsSync(fallbackPath)) {
            membersData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        }
    }

    if (!membersData || membersData.length === 0) {
        console.error('Error: Could not load roll235_parsed.json');
        return { error: 'Could not load roll235_parsed.json' };
    }

    // Ensure default College 1 exists
    db.prepare(`
        INSERT OR IGNORE INTO colleges (id, name, code, city, state)
        VALUES (1, 'GMERS Medical College & Hospital', 'GMERS-01', 'Ahmedabad', 'Gujarat')
    `).run();

    // Ensure Student 1 (Roll 235 - Dhruv Patel) exists
    let student = db.prepare("SELECT * FROM students WHERE roll_number = '235'").get();
    if (!student) {
        db.prepare(`
            INSERT INTO students (roll_number, name, pin, batch_year, college_id, email, phone, posting_unit, status)
            VALUES ('235', 'Dhruv Patel', '1234', '3rd Year MBBS (PSM Batch 2024-25)', 1, 'dhruv.patel@medpulse.edu', '+91 98765 43210', 'Community Medicine Unit 3', 'Active')
        `).run();
        student = db.prepare("SELECT * FROM students WHERE roll_number = '235'").get();
    }
    const studentId = student.id;

// Delete previous families and cascade delete for clean slate for student 1
const oldFamilies = db.prepare('SELECT id FROM families WHERE student_id = ?').all(studentId);
for (const f of oldFamilies) {
    const mems = db.prepare('SELECT id FROM family_members WHERE family_id = ?').all(f.id);
    for (const m of mems) {
        db.prepare('DELETE FROM follow_ups WHERE member_id = ?').run(m.id);
        db.prepare('DELETE FROM member_conditions WHERE member_id = ?').run(m.id);
        db.prepare('DELETE FROM member_medications WHERE member_id = ?').run(m.id);
        db.prepare('DELETE FROM member_allergies WHERE member_id = ?').run(m.id);
        db.prepare('DELETE FROM member_medical_history WHERE member_id = ?').run(m.id);
        db.prepare('DELETE FROM member_lifestyle WHERE member_id = ?').run(m.id);
    }
    db.prepare('DELETE FROM family_members WHERE family_id = ?').run(f.id);
    db.prepare('DELETE FROM families WHERE id = ?').run(f.id);
}

// Group members by family_no (1 to 5)
const familiesMap = {};
for (const m of membersData) {
    const fNo = parseInt(m.family_no, 10);
    if (!familiesMap[fNo]) {
        familiesMap[fNo] = [];
    }
    familiesMap[fNo].push(m);
}

// Family metadata mapping
const familyInfo = {
    1: {
        head: 'Radhuji shukaji thakore',
        name: 'Thakore Household 1',
        village: 'Khoraj Rural Post',
        address: 'House No. 12, Thakore Vas, Khoraj Village',
        survey_date: '2026-08-01',
        calorie_intake: 13459,
        calorie_status: 'Normal',
        dietary_advice: 'N'
    },
    2: {
        head: 'shivaji thakore',
        name: 'Thakore Household 2',
        village: 'Khoraj Rural Post',
        address: 'House No. 18, Thakore Vas, Khoraj Village',
        survey_date: '2026-08-02',
        calorie_intake: 14770,
        calorie_status: 'Normal',
        dietary_advice: 'N'
    },
    3: {
        head: 'Natwariji thakore',
        name: 'Thakore Household 3',
        village: 'Khoraj Rural Post',
        address: 'House No. 24, Main Chawk, Khoraj Village',
        survey_date: '2026-08-03',
        calorie_intake: 15895,
        calorie_status: 'Normal',
        dietary_advice: 'N'
    },
    4: {
        head: 'Aruniji thakore',
        name: 'Thakore Household 4',
        village: 'Khoraj Rural Post',
        address: 'House No. 31, East Ward, Khoraj Village',
        survey_date: '2026-08-04',
        calorie_intake: 5000,
        calorie_status: 'Normal',
        dietary_advice: 'N'
    },
    5: {
        head: 'Dhavalji thakore',
        name: 'Thakore Household 5',
        village: 'Khoraj Rural Post',
        address: 'House No. 45, West Extension, Khoraj Village',
        survey_date: '2026-08-05',
        calorie_intake: 6904,
        calorie_status: 'Normal',
        dietary_advice: 'N'
    }
};

const insertedMembers = [];

for (const [fNoStr, mems] of Object.entries(familiesMap)) {
    const fNo = parseInt(fNoStr, 10);
    const meta = familyInfo[fNo] || {
        head: mems[0].name,
        name: `Household ${fNo}`,
        village: 'Khoraj Rural Post',
        address: `House No. ${fNo}, Khoraj Village`,
        survey_date: '2026-08-01',
        calorie_intake: parseFloat(mems[0].calorie_intake) || 2400,
        calorie_status: mems[0].calorie_status === 'N' ? 'Normal' : (mems[0].calorie_status === 'D' ? 'Deficient' : 'Excess'),
        dietary_advice: mems[0].dietary_advice || 'N'
    };

    // Calculate total CU
    let totalCU = 0;
    for (const m of mems) {
        const cuVal = parseFloat(m.consumption_unit);
        if (!isNaN(cuVal)) totalCU += cuVal;
    }
    totalCU = Math.round(totalCU * 10) / 10;

    const famRes = db.prepare(`
        INSERT INTO families (
            student_id, family_no, head_of_family, village_ward, address, survey_date,
            total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given,
            family_code, family_name, contact_number, village, city, district, state, pincode
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
        )
    `).run(
        studentId,
        fNo,
        meta.head,
        meta.village,
        meta.address,
        meta.survey_date,
        totalCU,
        meta.calorie_intake,
        meta.calorie_status,
        meta.dietary_advice,
        `FAM-235-${String(fNo).padStart(2, '0')}`,
        meta.name,
        '+91 98250 1234' + fNo,
        'Khoraj',
        'Gandhinagar',
        'Gandhinagar',
        'Gujarat',
        '382421'
    );

    const familyDbId = famRes.lastInsertRowid;
    console.log(`Inserted Family ${fNo} (DB ID: ${familyDbId}) with Head: ${meta.head}, Total CU: ${totalCU}`);

    // Insert family members
    for (let idx = 0; idx < mems.length; idx++) {
        const m = mems[idx];
        const ageYears = (m.age_years !== '' && !isNaN(m.age_years)) ? parseInt(m.age_years, 10) : 0;
        const ageMonths = (m.age_months !== '' && !isNaN(m.age_months)) ? parseInt(m.age_months, 10) : 0;
        const sbp = m.sbp !== '' && !isNaN(m.sbp) ? parseInt(m.sbp, 10) : null;
        const dbp = m.dbp !== '' && !isNaN(m.dbp) ? parseInt(m.dbp, 10) : null;
        const rbs = m.rbs !== '' && !isNaN(m.rbs) ? parseFloat(m.rbs) : null;
        const hb = m.hb !== '' && !isNaN(m.hb) ? parseFloat(m.hb) : null;
        const heightM = m.height_m !== '' && !isNaN(m.height_m) ? parseFloat(m.height_m) : null;
        const weightKg = m.weight_kg !== '' && !isNaN(m.weight_kg) ? parseFloat(m.weight_kg) : null;
        
        // Calculate BMI if height and weight exist and valid
        let bmi = null;
        if (heightM && heightM > 0.5 && heightM < 2.5 && weightKg && weightKg > 5) {
            bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
        }

        const waistCm = m.waist_cm !== '' && !isNaN(m.waist_cm) ? parseFloat(m.waist_cm) : null;
        const hipCm = m.hip_cm !== '' && !isNaN(m.hip_cm) ? parseFloat(m.hip_cm) : null;
        let whr = null;
        if (waistCm && hipCm && hipCm > 0) {
            whr = Math.round((waistCm / hipCm) * 100) / 100;
        }

        const hcCm = m.hc_cm !== '' && !isNaN(m.hc_cm) ? parseFloat(m.hc_cm) : null;
        const ccCm = m.cc_cm !== '' && !isNaN(m.cc_cm) ? parseFloat(m.cc_cm) : null;
        const muacCm = m.muac_cm !== '' && !isNaN(m.muac_cm) ? parseFloat(m.muac_cm) : null;

        // Gender determination: 'M' or 'F'
        const nameLower = m.name.toLowerCase();
        let gender = 'M';
        if (nameLower.includes('ben') || nameLower.includes('bai') || nameLower.includes('devi') || nameLower.includes('jagruti') || nameLower.includes('santoben') || nameLower.includes('priyanka') || nameLower.includes('shitaben') || nameLower.includes('renuka') || nameLower.includes('sheedha') || nameLower.includes('shraddha') || nameLower.includes('umaben') || nameLower.includes('antraben') || nameLower.includes('raiben')) {
            gender = 'F';
        }

        let relation = 'Other';
        if (idx === 0) relation = 'Head';
        else if (idx === 1 && gender === 'F') relation = 'Spouse';
        else if (ageYears !== null && ageYears < 25) relation = gender === 'F' ? 'Daughter' : 'Son';
        else if (ageYears !== null && ageYears > 60) relation = gender === 'F' ? 'Mother' : 'Father';

        let delivPlace = m.delivery_place || 'NA';
        if (delivPlace !== 'Home' && delivPlace !== 'Hospital') delivPlace = 'NA';

        let oralHyg = m.oral_hygiene === 'Y' ? 'Y' : (m.oral_hygiene === 'N' ? 'N' : 'Y');
        let genHyg = m.general_hygiene === 'Y' ? 'Y' : (m.general_hygiene === 'N' ? 'N' : 'Y');

        const cleanYNA = (val, defaultVal = 'NA') => {
            if (!val) return defaultVal;
            const up = val.toUpperCase().trim();
            return ['Y', 'N', 'NA'].includes(up) ? up : defaultVal;
        };

        const workType = ['S', 'M', 'H', 'NA'].includes(m.work_type) ? m.work_type : 'S';

        const memRes = db.prepare(`
            INSERT INTO family_members (
                family_id, member_order, name, relation_to_hof, gender,
                age_years, age_months, has_htn, sbp, dbp, has_dm, rbs,
                has_pallor, hb, has_anaemia, height_m, weight_kg, bmi,
                waist_cm, hip_cm, whr, hc_cm, cc_cm, muac_cm,
                is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting,
                diagnosis, treatment_taken, treatment_source, oral_hygiene, general_hygiene,
                anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card,
                immunization_status, work_type, consumption_unit
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?
            )
        `).run(
            familyDbId,
            idx + 1,
            m.name,
            relation,
            gender,
            ageYears,
            ageMonths,
            cleanYNA(m.has_htn, 'N'),
            sbp,
            dbp,
            cleanYNA(m.has_dm, 'N'),
            rbs,
            cleanYNA(m.has_pallor, 'N'),
            hb,
            cleanYNA(m.has_anaemia, 'N'),
            heightM,
            weightKg,
            bmi,
            waistCm,
            hipCm,
            whr,
            hcCm,
            ccCm,
            muacCm,
            cleanYNA(m.is_underweight, 'NA'),
            cleanYNA(m.is_overweight, 'NA'),
            cleanYNA(m.is_stunting, 'NA'),
            cleanYNA(m.is_wasting, 'NA'),
            cleanYNA(m.is_severe_wasting, 'NA'),
            m.diagnosis || (m.has_htn === 'Y' && m.has_dm === 'Y' ? 'HTN + Type 2 DM' : (m.has_htn === 'Y' ? 'Hypertension' : (m.has_dm === 'Y' ? 'Type 2 Diabetes' : (m.has_anaemia === 'Y' ? 'Iron Deficiency Anaemia' : '')))),
            cleanYNA(m.treatment_taken, 'NA'),
            m.treatment_source || (m.treatment_taken === 'Y' ? 'PHC Khoraj' : ''),
            oralHyg,
            genHyg,
            cleanYNA(m.anc_taken, 'NA'),
            delivPlace,
            cleanYNA(m.pnc_taken, 'NA'),
            cleanYNA(m.fp_method_used, 'NA'),
            cleanYNA(m.mamta_card, 'NA'),
            cleanYNA(m.immunization_status, 'NA'),
            workType,
            parseFloat(m.consumption_unit) || 1.0
        );

        const memberDbId = memRes.lastInsertRowid;
        insertedMembers.push({
            id: memberDbId,
            name: m.name,
            fNo: fNo,
            has_htn: m.has_htn,
            has_dm: m.has_dm,
            has_anaemia: m.has_anaemia,
            sbp: sbp,
            dbp: dbp,
            rbs: rbs,
            hb: hb,
            weight_kg: weightKg
        });
    }
}

console.log(`Successfully inserted all ${insertedMembers.length} members across 5 families.`);

// -------------------------------------------------------------
// Seed Realistic Follow-Up Visits for Chronic & Monitored Patients
// -------------------------------------------------------------
const followUpsToSeed = [
    // Radhuji shukaji thakore (Fam 1, HOF, HTN SBP 156 / DBP 82, RBS 146, Pallor Y, Hb 8)
    {
        name: 'Radhuji shukaji thakore',
        visits: [
            { date: '2026-08-15', num: 1, sbp: 148, dbp: 80, rbs: 140, hb: 8.4, wt: 55.0, comp: 'Good', prog: 'Improved', notes: 'Tab Amlodipine 5mg OD prescribed. Salt restriction advised.' },
            { date: '2026-09-10', num: 2, sbp: 140, dbp: 78, rbs: 134, hb: 9.2, wt: 55.5, comp: 'Good', prog: 'Improved', notes: 'BP well controlled at 140/78 mmHg. Iron supplementation ongoing.' }
        ]
    },
    // Naniben thakore (Fam 1, HTN SBP 145 / DBP 85, DM RBS 221)
    {
        name: 'Naniben thakore',
        visits: [
            { date: '2026-08-20', num: 1, sbp: 138, dbp: 82, rbs: 188, hb: 14.0, wt: 60.0, comp: 'Good', prog: 'Improved', notes: 'Metformin 500mg BD compliance verified. Reduced refined carbohydrate intake.' },
            { date: '2026-09-12', num: 2, sbp: 132, dbp: 80, rbs: 156, hb: 14.1, wt: 59.5, comp: 'Good', prog: 'Improved', notes: 'RBS reduced to 156 mg/dl. Morning brisk walking continued.' }
        ]
    },
    // Kanchanben thakore (Fam 1, Pallor Y, Hb 7, RBS 147)
    {
        name: 'Kanchanben thakore',
        visits: [
            { date: '2026-08-22', num: 1, sbp: 112, dbp: 74, rbs: 136, hb: 8.2, wt: 30.5, comp: 'Good', prog: 'Improved', notes: 'Oral Iron + Folic Acid tablets started. Dietary counseling on green leafy vegetables.' },
            { date: '2026-09-14', num: 2, sbp: 110, dbp: 72, rbs: 124, hb: 9.8, wt: 31.2, comp: 'Good', prog: 'Improved', notes: 'Hb improved from 7.0 to 9.8 g/dl. Pallor visibly reduced, energy levels higher.' }
        ]
    },
    // shivaji thakore (Fam 2, Age 70, HTN SBP 159 / DBP 79, DM RBS 265)
    {
        name: 'shivaji thakore',
        visits: [
            { date: '2026-08-18', num: 1, sbp: 150, dbp: 78, rbs: 224, hb: 15.0, wt: 45.0, comp: 'Irregular', prog: 'Stable', notes: 'Counselled on medication regularity. Glimepiride + Metformin regimen reiterated.' },
            { date: '2026-09-15', num: 2, sbp: 142, dbp: 76, rbs: 178, hb: 15.0, wt: 45.2, comp: 'Good', prog: 'Improved', notes: 'Medication compliance restored. Fasting and random sugars improving.' }
        ]
    },
    // maheshji thakore (Fam 2, Age 46, HTN SBP 168 / DBP 76, Pallor Y, Hb 9)
    {
        name: 'maheshji thakore',
        visits: [
            { date: '2026-09-05', num: 1, sbp: 152, dbp: 74, rbs: 144, hb: 10.1, wt: 39.5, comp: 'Good', prog: 'Improved', notes: 'Antihypertensive treatment initiated at PHC Khoraj. Hb monitored.' }
        ]
    },
    // shardaben thakore (Fam 2, Age 28, DM RBS 248)
    {
        name: 'shardaben thakore',
        visits: [
            { date: '2026-09-08', num: 1, sbp: 118, dbp: 72, rbs: 195, hb: 14.0, wt: 43.0, comp: 'Good', prog: 'Improved', notes: 'Dietary modifications and oral hypoglycemics started. Good compliance.' }
        ]
    },
    // Natwariji thakore (Fam 3, Age 57, HTN SBP 156 / DBP 73, DM RBS 213)
    {
        name: 'Natwariji thakore',
        visits: [
            { date: '2026-09-08', num: 1, sbp: 144, dbp: 72, rbs: 172, hb: 12.2, wt: 45.5, comp: 'Good', prog: 'Improved', notes: 'BP 144/72 mmHg. Fasting blood glucose counseling provided.' }
        ]
    },
    // Kanlaben thakore (Fam 3, Age 54, HTN SBP 158 / DBP 86)
    {
        name: 'Kanlaben thakore',
        visits: [
            { date: '2026-09-11', num: 1, sbp: 140, dbp: 80, rbs: 142, hb: 13.0, wt: 39.5, comp: 'Good', prog: 'Improved', notes: 'Telmisartan 40mg taken daily. BP controlled at 140/80 mmHg.' }
        ]
    },
    // Renukaben thakore (Fam 3, Age 26, DM RBS 235)
    {
        name: 'Renukaben thakore',
        visits: [
            { date: '2026-09-13', num: 1, sbp: 114, dbp: 72, rbs: 184, hb: 14.0, wt: 10.0, comp: 'Good', prog: 'Improved', notes: 'Under evaluation for gestational/type 2 diabetes. Dietitian consult arranged.' }
        ]
    },
    // Raiben thakore (Fam 5, Age 62, HTN SBP 164 / DBP 82)
    {
        name: 'Raiben thakore',
        visits: [
            { date: '2026-09-12', num: 1, sbp: 146, dbp: 78, rbs: 150, hb: 12.5, wt: 37.5, comp: 'Good', prog: 'Improved', notes: 'Geriatric hypertension screening. BP down from 164/82 to 146/78 mmHg.' }
        ]
    }
];

let totalFollowUps = 0;
for (const item of followUpsToSeed) {
    const mem = insertedMembers.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    if (mem) {
        for (const v of item.visits) {
            db.prepare(`
                INSERT INTO follow_ups (
                    member_id, student_id, visit_date, visit_number,
                    sbp, dbp, rbs, hb, weight_kg,
                    treatment_compliance, health_progress, clinical_notes, next_visit_date
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?
                )
            `).run(
                mem.id,
                studentId,
                v.date,
                v.num,
                v.sbp,
                v.dbp,
                v.rbs,
                v.hb,
                v.wt,
                v.comp,
                v.prog,
                v.notes,
                '2026-10-15'
            );
            totalFollowUps++;
        }
    }
}

    console.log(`Successfully created ${totalFollowUps} longitudinal follow-up records for Roll 235.`);
    console.log('Seed synchronization complete!');
    return { familiesCount: Object.keys(familiesMap).length, followUpsCount: totalFollowUps };
}

module.exports = { seedRoll235 };

if (require.main === module) {
    seedRoll235();
}
