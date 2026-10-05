import type { Db, SchemaModule } from '../db.types';

/**
 * Baseline: the complete schema of the production database (health_survey.db, 2026-09).
 *
 * The original backend only ever ran against an existing database; its schema files describe an
 * older layout, so a fresh install crashed (colleges.code, family_code, member_* tables missing).
 * Applying this first makes a fresh database identical to the production one. Every statement is
 * IF NOT EXISTS, so existing databases are untouched. Later schema modules keep migrating as before.
 */
export const baselineSchema: SchemaModule = {
    name: 'baseline',
    apply(db: Db) {
        db.exec(`
CREATE TABLE IF NOT EXISTS colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    city TEXT,
    state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, max_admins INTEGER DEFAULT 10);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pin TEXT DEFAULT '1234',                        -- Simple student login PIN / password
    batch_year TEXT,
    college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, email TEXT, phone TEXT, posting_unit TEXT DEFAULT 'RHTC - Rural Health Training Center', status TEXT DEFAULT 'Active', referral_code TEXT);

CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_order INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    relation_to_hof TEXT,
    gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
    age_years INTEGER NOT NULL DEFAULT 0,
    age_months INTEGER NOT NULL DEFAULT 0,

    -- Adult Non-Communicable Disease (NCD) Screening (Age >= 18)
    has_htn TEXT CHECK(has_htn IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    sbp INTEGER,                                    -- Systolic Blood Pressure (mmHg)
    dbp INTEGER,                                    -- Diastolic Blood Pressure (mmHg)
    has_dm TEXT CHECK(has_dm IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    rbs REAL,                                       -- Random Blood Sugar (mg/dL)
    has_pallor TEXT CHECK(has_pallor IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    hb REAL,                                        -- Hemoglobin (g/dL)
    has_anaemia TEXT CHECK(has_anaemia IN ('Y', 'N', 'NA')) DEFAULT 'NA',

    -- Anthropometric Measurements
    height_m REAL,                                  -- Height in meters
    weight_kg REAL,                                 -- Weight in kilograms
    bmi REAL,                                       -- Calculated BMI: weight / (height * height)
    waist_cm REAL,                                  -- Waist circumference in cm (Adults)
    hip_cm REAL,                                    -- Hip circumference in cm (Adults)
    whr REAL,                                       -- Calculated Waist-Hip Ratio: waist / hip

    -- Pediatric Nutrition & Growth Screening (0 - 5 Years)
    hc_cm REAL,                                     -- Head Circumference in cm (Up to 2 yrs)
    cc_cm REAL,                                     -- Chest Circumference in cm (Up to 2 yrs)
    muac_cm REAL,                                   -- Mid-Upper Arm Circumference in cm (6 mo - 5 yrs)
    is_underweight TEXT CHECK(is_underweight IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    is_overweight TEXT CHECK(is_overweight IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    is_stunting TEXT CHECK(is_stunting IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    is_wasting TEXT CHECK(is_wasting IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    is_severe_wasting TEXT CHECK(is_severe_wasting IN ('Y', 'N', 'NA')) DEFAULT 'NA',

    -- Diagnosis & Medical Care
    diagnosis TEXT,                                 -- Known diagnosis if any (e.g. Hypertension, Diabetes, Asthma)
    treatment_taken TEXT CHECK(treatment_taken IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    treatment_source TEXT,                          -- Where treatment is taken from (e.g. PHC, Civil Hospital, Private)

    -- Hygiene Assessment
    oral_hygiene TEXT CHECK(oral_hygiene IN ('Y', 'N')) DEFAULT 'Y',
    general_hygiene TEXT CHECK(general_hygiene IN ('Y', 'N')) DEFAULT 'Y',

    -- Reproductive, Maternal & Child Health (RCH)
    anc_taken TEXT CHECK(anc_taken IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    delivery_place TEXT CHECK(delivery_place IN ('Home', 'Hospital', 'NA')) DEFAULT 'NA',
    pnc_taken TEXT CHECK(pnc_taken IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    fp_method_used TEXT CHECK(fp_method_used IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    mamta_card TEXT CHECK(mamta_card IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    immunization_status TEXT CHECK(immunization_status IN ('Y', 'N', 'NA')) DEFAULT 'NA',

    -- Occupational & Nutritional Coefficients
    work_type TEXT CHECK(work_type IN ('S', 'M', 'H', 'Sedentary', 'Moderate', 'Heavy', 'NA')) DEFAULT 'NA',
    consumption_unit REAL DEFAULT 1.0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, date_of_birth DATE, contact_number TEXT, marital_status TEXT DEFAULT 'Unknown', education TEXT, occupation TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, added_by_patient_id INTEGER, patient_updated_at DATETIME,
    UNIQUE(family_id, member_order)
);

CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    visit_date DATE DEFAULT (date('now')),
    visit_number INTEGER DEFAULT 1,
    sbp INTEGER,                                    -- Follow-up Systolic BP
    dbp INTEGER,                                    -- Follow-up Diastolic BP
    rbs REAL,                                       -- Follow-up Blood Sugar
    hb REAL,                                        -- Follow-up Hemoglobin
    weight_kg REAL,                                 -- Follow-up Weight
    muac_cm REAL,                                   -- Follow-up MUAC (Pediatric)
    treatment_compliance TEXT CHECK(treatment_compliance IN ('Good', 'Irregular', 'Not Taking', 'NA')) DEFAULT 'NA',
    health_progress TEXT CHECK(health_progress IN ('Improved', 'Stable', 'Deteriorated', 'NA')) DEFAULT 'Stable',
    clinical_notes TEXT,                            -- Doctor/Student examination notes & counseling
    next_visit_date DATE,                           -- Recommended next follow-up date
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,                   -- e.g. Diabetes, Hypertension, Asthma, Thyroid
    status TEXT CHECK(status IN ('Active', 'Resolved', 'Unknown')) DEFAULT 'Active',
    diagnosed_year INTEGER,                         -- Year diagnosed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                             -- Medication name (e.g. Metformin, Amlodipine)
    dosage TEXT,                                    -- e.g. 500mg, 5mg
    frequency TEXT,                                 -- e.g. Once daily, Twice daily, PRN
    reason TEXT,                                    -- Condition / reason for taking
    currently_taking TEXT CHECK(currently_taking IN ('Yes', 'No', 'Unknown')) DEFAULT 'Yes',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_allergies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,                         -- e.g. Penicillin, Sulfa, Peanuts, Dust
    allergy_type TEXT CHECK(allergy_type IN ('Medication', 'Food', 'Environmental', 'Other')) DEFAULT 'Medication',
    reaction TEXT,                                  -- e.g. Rash, Anaphylaxis, Swelling
    severity TEXT CHECK(severity IN ('Mild', 'Moderate', 'Severe', 'Unknown')) DEFAULT 'Moderate',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_medical_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    category TEXT CHECK(category IN ('Major illness', 'Previous hospitalization', 'Surgery', 'Accident / injury', 'Long-term condition', 'Other')) NOT NULL,
    description TEXT NOT NULL,                      -- e.g. Appendectomy, Fracture Right Femur, Typhoid
    year INTEGER,                                   -- Year of event
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_lifestyle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER UNIQUE NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    smoking_status TEXT CHECK(smoking_status IN ('Never', 'Former', 'Current', 'Unknown')) DEFAULT 'Never',
    alcohol_status TEXT CHECK(alcohol_status IN ('Never', 'Former', 'Current', 'Unknown')) DEFAULT 'Never',
    physical_activity TEXT CHECK(physical_activity IN ('Low', 'Moderate', 'High', 'Unknown')) DEFAULT 'Moderate',
    diet TEXT,                                      -- e.g. Vegetarian, Non-Vegetarian, Ovo-lacto
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '9999',
    email TEXT,
    role TEXT DEFAULT 'Faculty Supervisor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, university_id INTEGER REFERENCES colleges(id), phone TEXT, status TEXT DEFAULT 'Active');

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_uid TEXT UNIQUE NOT NULL,               -- e.g. PAT-2026-XXXX
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    pin TEXT NOT NULL DEFAULT '1234',
    date_of_birth DATE,
    age_years INTEGER,
    gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
    address TEXT,
    model_type TEXT CHECK(model_type IN ('Independent', 'Dependent')) DEFAULT 'Independent',
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    referral_code_used TEXT,
    family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    hospital_id INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, blood_group TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, family_id INTEGER, family_role TEXT DEFAULT 'Head');

CREATE TABLE IF NOT EXISTS hospitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,                       -- Standardized Hospital Code (e.g. HOSP-CIVIL-01)
    type TEXT DEFAULT 'Civil / General Hospital',
    city TEXT,
    district TEXT,
    state TEXT,
    bed_capacity INTEGER DEFAULT 500,
    contact_email TEXT,
    contact_phone TEXT,
    max_super_admins INTEGER DEFAULT 3,             -- Strict Quota: 1 to 3 Super Admins per hospital
    max_admins INTEGER DEFAULT 20,                   -- Strict Quota: Maximum 20 Admins per hospital
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospital_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    pin TEXT NOT NULL DEFAULT '8888',
    role TEXT CHECK(role IN ('Hospital Super Admin', 'Hospital Admin')) DEFAULT 'Hospital Admin',
    department TEXT DEFAULT 'General Medicine',
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_conditions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                condition_name TEXT NOT NULL,
                diagnosed_date TEXT,
                status TEXT DEFAULT 'Active',
                notes TEXT
            );

CREATE TABLE IF NOT EXISTS medications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                medicine_name TEXT NOT NULL,
                dosage TEXT,
                frequency TEXT,
                adherence TEXT DEFAULT 'Good'
            );

CREATE TABLE IF NOT EXISTS allergies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                allergen TEXT NOT NULL,
                severity TEXT DEFAULT 'Mild',
                reaction TEXT
            );

CREATE TABLE IF NOT EXISTS clinical_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_date TEXT,
                description TEXT
            );

CREATE TABLE IF NOT EXISTS lifestyle_habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER UNIQUE NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                smoking_status TEXT,
                alcohol_status TEXT,
                dietary_pattern TEXT,
                physical_activity TEXT,
                systolic_bp INTEGER,
                diastolic_bp INTEGER,
                blood_sugar_fasting REAL,
                blood_sugar_random REAL,
                bmi REAL
            );

CREATE TABLE IF NOT EXISTS follow_up_visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
                visit_date TEXT NOT NULL,
                purpose TEXT,
                vitals_summary TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                keyword TEXT NOT NULL,
                description TEXT NOT NULL,
                college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
                created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
                event_date TEXT,
                venue TEXT,
                status TEXT CHECK(status IN ('Active', 'Completed', 'Cancelled')) DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

CREATE TABLE IF NOT EXISTS campaign_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
                matched_keyword TEXT NOT NULL,
                matched_condition_detail TEXT,
                status TEXT CHECK(status IN ('Delivered', 'Read', 'Acknowledged', 'Declined')) DEFAULT 'Delivered',
                patient_response_note TEXT,
                cadet_call_status TEXT CHECK(cadet_call_status IN ('Pending', 'Contacted', 'Assisted')) DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            , rsvp TEXT DEFAULT 'Pending', rsvp_note TEXT, rsvp_at DATETIME, read_at DATETIME, contacted_at DATETIME, patient_contact_confirmation TEXT, patient_contact_confirmed_at DATETIME);

CREATE TABLE IF NOT EXISTS "families" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    family_no INTEGER NOT NULL,
    head_of_family TEXT NOT NULL,
    village_ward TEXT,
    address TEXT,
    survey_date DATE DEFAULT (date('now')),
    total_cu REAL DEFAULT 0,                        -- Total Family Consumption Units
    calorie_intake_per_cu REAL DEFAULT 0,           -- Calorie Intake (kcal) / CU / Day
    calorie_status TEXT CHECK(calorie_status IN ('D', 'N', 'E', 'Deficient', 'Normal', 'Excess')) DEFAULT 'N',
    dietary_advice_given TEXT CHECK(dietary_advice_given IN ('Y', 'N')) DEFAULT 'N',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, family_code TEXT, family_name TEXT, contact_number TEXT, village TEXT, city TEXT, district TEXT, state TEXT, pincode TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, family_no)
);

CREATE TABLE IF NOT EXISTS hospital_callback_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
                for_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                channel TEXT CHECK(channel IN ('Callback', 'WhatsApp')) DEFAULT 'Callback',
                department TEXT NOT NULL DEFAULT 'General Medicine',
                reason TEXT NOT NULL DEFAULT 'Consultation',
                message TEXT,
                preferred_time TEXT,
                status TEXT CHECK(status IN ('Open', 'Acknowledged', 'Scheduled', 'Resolved', 'Cancelled')) DEFAULT 'Open',
                hospital_note TEXT,
                scheduled_for TEXT,
                handled_by_admin_id INTEGER REFERENCES hospital_admins(id) ON DELETE SET NULL,
                patient_confirmation TEXT CHECK(patient_confirmation IN ('Confirmed', 'Disputed')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            );

CREATE TABLE IF NOT EXISTS hospital_visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
                patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
                family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                visit_uid TEXT UNIQUE NOT NULL,
                patient_name TEXT NOT NULL,
                age_years INTEGER,
                gender TEXT,
                contact_number TEXT,
                address TEXT,
                village TEXT,
                family_code TEXT,
                student_name TEXT,
                student_roll TEXT,
                visit_date DATE DEFAULT (date('now')),
                department TEXT NOT NULL DEFAULT 'General Medicine',
                attending_doctor TEXT DEFAULT 'Dr. Ramesh Patel',
                visit_type TEXT DEFAULT 'FAP Survey Referral',
                chief_complaint TEXT,
                symptoms_duration TEXT,
                sbp INTEGER,
                dbp INTEGER,
                pulse INTEGER,
                temperature REAL,
                rbs REAL,
                existing_conditions TEXT,
                allergies TEXT,
                diagnosis TEXT,
                treatment_prescribed TEXT,
                disposition TEXT DEFAULT 'Discharged OPD',
                ward_bed_no TEXT,
                follow_up_advice TEXT,
                registered_by_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);

CREATE INDEX IF NOT EXISTS idx_members_family ON family_members(family_id);

CREATE INDEX IF NOT EXISTS idx_members_age ON family_members(age_years);

CREATE INDEX IF NOT EXISTS idx_members_htn ON family_members(has_htn);

CREATE INDEX IF NOT EXISTS idx_members_dm ON family_members(has_dm);

CREATE INDEX IF NOT EXISTS idx_members_anaemia ON family_members(has_anaemia);

CREATE INDEX IF NOT EXISTS idx_followups_member ON follow_ups(member_id);

CREATE INDEX IF NOT EXISTS idx_followups_date ON follow_ups(visit_date);

CREATE INDEX IF NOT EXISTS idx_members_dob ON family_members(date_of_birth);

CREATE INDEX IF NOT EXISTS idx_conditions_member ON member_conditions(member_id);

CREATE INDEX IF NOT EXISTS idx_medications_member ON member_medications(member_id);

CREATE INDEX IF NOT EXISTS idx_allergies_member ON member_allergies(member_id);

CREATE INDEX IF NOT EXISTS idx_history_member ON member_medical_history(member_id);

CREATE INDEX IF NOT EXISTS idx_lifestyle_member ON member_lifestyle(member_id);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

CREATE INDEX IF NOT EXISTS idx_admins_uni ON admins(university_id);

CREATE INDEX IF NOT EXISTS idx_students_referral ON students(referral_code);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

CREATE INDEX IF NOT EXISTS idx_patients_uid ON patients(patient_uid);

CREATE INDEX IF NOT EXISTS idx_patients_student ON patients(student_id);

CREATE INDEX IF NOT EXISTS idx_patients_model ON patients(model_type);

CREATE INDEX IF NOT EXISTS idx_patients_member ON patients(family_member_id);

CREATE INDEX IF NOT EXISTS idx_hosp_code ON hospitals(code);

CREATE INDEX IF NOT EXISTS idx_hosp_admins_hosp ON hospital_admins(hospital_id);

CREATE INDEX IF NOT EXISTS idx_hosp_admins_user ON hospital_admins(username);

CREATE INDEX IF NOT EXISTS idx_hosp_admins_role ON hospital_admins(role);

CREATE INDEX IF NOT EXISTS idx_campaigns_keyword ON campaigns(keyword);

CREATE INDEX IF NOT EXISTS idx_campaigns_college ON campaigns(college_id);

CREATE INDEX IF NOT EXISTS idx_campaign_notifs_patient ON campaign_notifications(patient_id);

CREATE INDEX IF NOT EXISTS idx_campaign_notifs_student ON campaign_notifications(student_id);

CREATE INDEX IF NOT EXISTS idx_campaign_notifs_camp ON campaign_notifications(campaign_id);

CREATE INDEX IF NOT EXISTS idx_families_student ON families(student_id);

CREATE INDEX IF NOT EXISTS idx_families_code ON families(family_code);

CREATE INDEX IF NOT EXISTS idx_hosp_cb_patient ON hospital_callback_requests(patient_id);

CREATE INDEX IF NOT EXISTS idx_hosp_cb_hospital ON hospital_callback_requests(hospital_id, status);

CREATE INDEX IF NOT EXISTS idx_hosp_visits_hosp ON hospital_visits(hospital_id);

CREATE INDEX IF NOT EXISTS idx_hosp_visits_date ON hospital_visits(visit_date);

CREATE INDEX IF NOT EXISTS idx_hosp_visits_member ON hospital_visits(family_member_id);

CREATE INDEX IF NOT EXISTS idx_hosp_visits_uid ON hospital_visits(visit_uid);
`);
    },
};
