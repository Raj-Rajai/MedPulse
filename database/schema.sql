-- ==========================================================
-- MEDICAL COLLEGE COMMUNITY HEALTH SURVEY DATABASE SCHEMA
-- Phase 2 - Structured Healthcare Data Collection & Family Management
-- ==========================================================

PRAGMA foreign_keys = ON;

-- 1. Colleges / Medical Institutions & Universities
CREATE TABLE IF NOT EXISTS colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    city TEXT,
    state TEXT,
    max_admins INTEGER DEFAULT 10,                 -- Strict quota: max 10 university admins per university
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Medical Students (assigned survey roll numbers)
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pin TEXT DEFAULT '1234',                        -- Simple student login PIN / password
    batch_year TEXT,
    email TEXT,
    phone TEXT,
    posting_unit TEXT DEFAULT 'RHTC - Rural Health Training Center',
    college_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
    referral_code TEXT UNIQUE,                      -- Unique Patient Adoption Referral Code (e.g. GMERS-235-9B2D)
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Surveyed Families (Household Unit)
CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    family_code TEXT UNIQUE,                        -- Standardized family identifier (e.g. FAM-0001)
    family_name TEXT,                               -- Household / family name
    family_no INTEGER NOT NULL,
    head_of_family TEXT NOT NULL,
    contact_number TEXT,
    village_ward TEXT,
    village TEXT,
    city TEXT,
    district TEXT,
    state TEXT,
    pincode TEXT,
    address TEXT,
    survey_date DATE DEFAULT (date('now')),
    total_cu REAL DEFAULT 0,                        -- Total Family Consumption Units
    calorie_intake_per_cu REAL DEFAULT 0,           -- Calorie Intake (kcal) / CU / Day
    calorie_status TEXT CHECK(calorie_status IN ('D', 'N', 'E', 'Deficient', 'Normal', 'Excess')) DEFAULT 'N',
    dietary_advice_given TEXT CHECK(dietary_advice_given IN ('Y', 'N')) DEFAULT 'N',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, family_no)
);

-- 4. Family Members (Individual Demographic & Baseline Records)
CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    member_order INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    relation_to_hof TEXT,
    gender TEXT CHECK(gender IN ('M', 'F', 'Other')),
    date_of_birth DATE,                             -- Date of birth for dynamic age calculation
    age_years INTEGER NOT NULL DEFAULT 0,
    age_months INTEGER NOT NULL DEFAULT 0,
    contact_number TEXT,
    marital_status TEXT CHECK(marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Unknown')) DEFAULT 'Unknown',
    education TEXT,
    occupation TEXT,

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

    -- Diagnosis & Medical Care (Baseline legacy fields)
    diagnosis TEXT,
    treatment_taken TEXT CHECK(treatment_taken IN ('Y', 'N', 'NA')) DEFAULT 'NA',
    treatment_source TEXT,

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

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, member_order)
);

-- 5. Structured Medical Conditions (Specific Diagnosed Pathologies)
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

-- 6. Structured Medications (Prescribed / Over-The-Counter Regimens)
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

-- 7. Structured Allergies (Adverse Reactions & Drug Sensitivities)
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

-- 8. Structured Medical History (Major Illnesses, Surgeries, Hospitalizations)
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

-- 9. Structured Lifestyle Information (Habits & Physical Activity)
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

-- 10. Longitudinal Clinical Follow-Up Visits
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

-- Optimized Indexes for Health & Epidemiological Analytics
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_families_student ON families(student_id);
CREATE INDEX IF NOT EXISTS idx_families_code ON families(family_code);
CREATE INDEX IF NOT EXISTS idx_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_members_dob ON family_members(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_members_age ON family_members(age_years);
CREATE INDEX IF NOT EXISTS idx_conditions_member ON member_conditions(member_id);
CREATE INDEX IF NOT EXISTS idx_medications_member ON member_medications(member_id);
CREATE INDEX IF NOT EXISTS idx_allergies_member ON member_allergies(member_id);
CREATE INDEX IF NOT EXISTS idx_history_member ON member_medical_history(member_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_member ON member_lifestyle(member_id);
CREATE INDEX IF NOT EXISTS idx_followups_member ON follow_ups(member_id);
CREATE INDEX IF NOT EXISTS idx_followups_date ON follow_ups(visit_date);

-- 11. Faculty & Administrative Personnel (Admin Panel)
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '9999',
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'University Admin',           -- 'University Super Admin' (max 1/uni) or 'University Admin' (max 10/uni)
    university_id INTEGER REFERENCES colleges(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_uni ON admins(university_id);
CREATE INDEX IF NOT EXISTS idx_students_referral ON students(referral_code);
