-- ==========================================================
-- SAMPLE SEED DATA - Extracted from Medical Survey (Roll 235 Log)
-- Can be loaded for demo/testing purposes
-- ==========================================================

-- Insert Default Medical Colleges
INSERT OR IGNORE INTO colleges (id, name, code, city, state)
VALUES (1, 'SAL Hospital', 'SAL-01', 'Ahmedabad', 'Gujarat');

INSERT OR IGNORE INTO colleges (id, name, code, city, state)
VALUES (2, 'SAL Institute of Medical Sciences', 'SAL-01', 'Ahmedabad', 'Gujarat');

-- Insert Sample Student (Roll 235 - Dhruv Patel)
INSERT OR IGNORE INTO students (id, roll_number, name, pin, batch_year, college_id)
VALUES (1, '235', 'Dhruv Patel', '1234', '3rd Year MBBS (Community Medicine)', 1);

-- ==========================================================
-- FAMILY 1 (HOF: Radhuji shukaji thakore)
-- ==========================================================
INSERT OR IGNORE INTO families (id, student_id, family_no, head_of_family, village_ward, address, total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given)
VALUES (1, 1, 1, 'Radhuji shukaji thakore', 'RHTC Field Area - Ward 4', 'Plot 12, Thakore Vas', 5.0, 13459, 'Deficient', 'N');

INSERT OR IGNORE INTO family_members 
(family_id, member_order, name, relation_to_hof, gender, age_years, age_months, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia, height_m, weight_kg, bmi, waist_cm, hip_cm, whr, oral_hygiene, general_hygiene, work_type, consumption_unit)
VALUES
(1, 1, 'Radhuji shukaji thakore', 'Head of Family', 'M', 60, 0, 'Y', 156, 82, 'N', 146, 'Y', 8.0, 'Y', 1.52, 55.0, 23.8, 90.0, 96.0, 0.94, 'Y', 'Y', 'Moderate', 1.2),
(1, 2, 'Naniben thakore', 'Wife', 'F', 59, 0, 'Y', 145, 85, 'Y', 221, 'N', 14.0, 'N', 1.60, 60.0, 23.4, 83.0, 87.0, 0.95, 'Y', 'Y', 'Sedentary', 0.9),
(1, 3, 'Manuji thakore', 'Son', 'M', 35, 0, 'N', 118, 72, 'N', 154, 'N', 15.0, 'N', 1.49, 50.0, 22.5, 78.0, 85.0, 0.92, 'Y', 'Y', 'Sedentary', 0.7),
(1, 4, 'Kanchanben thakore', 'Daughter-in-law', 'F', 30, 0, 'N', 110, 73, 'N', 147, 'Y', 7.0, 'Y', 1.30, 30.0, 17.8, NULL, NULL, NULL, 'N', 'Y', 'Sedentary', 0.7),
(1, 5, 'Haresh mauji thakore', 'Grandson', 'M', 16, 0, 'N', NULL, NULL, 'N', NULL, 'N', 12.0, 'N', NULL, NULL, NULL, NULL, NULL, NULL, 'Y', 'Y', 'Sedentary', 1.3),
(1, 6, 'Jagruti thakore', 'Granddaughter', 'F', 10, 0, 'N', NULL, NULL, 'N', NULL, 'N', 12.0, 'N', 1.58, 43.0, 17.2, 79.0, 83.0, 0.95, 'Y', 'Y', 'Sedentary', 0.8);

-- ==========================================================
-- FAMILY 2 (HOF: shivaji thakore)
-- ==========================================================
INSERT OR IGNORE INTO families (id, student_id, family_no, head_of_family, village_ward, address, total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given)
VALUES (2, 1, 2, 'shivaji thakore', 'RHTC Field Area - Ward 4', 'Plot 18, Thakore Vas', 8.2, 14770, 'Normal', 'N');

INSERT OR IGNORE INTO family_members 
(family_id, member_order, name, relation_to_hof, gender, age_years, age_months, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia, height_m, weight_kg, bmi, waist_cm, hip_cm, whr, oral_hygiene, general_hygiene, work_type, consumption_unit)
VALUES
(2, 1, 'shivaji thakore', 'Head of Family', 'M', 70, 0, 'Y', 159, 79, 'Y', 265, 'N', 15.0, 'N', 1.55, 45.0, 18.7, 85.0, 90.0, 0.94, 'N', 'Y', 'Moderate', 1.2),
(2, 2, 'maheshji thakore', 'Son', 'M', 46, 0, 'Y', 168, 76, 'N', 157, 'Y', 9.0, 'Y', 1.48, 39.0, 17.8, 82.0, 88.0, 0.93, 'Y', 'Y', 'Moderate', 1.3),
(2, 3, 'gauriben thakore', 'Daughter-in-law', 'F', 35, 0, 'N', 110, 85, 'N', 176, 'N', 15.0, 'N', 1.09, 16.0, 13.5, NULL, NULL, NULL, 'N', 'Y', 'Sedentary', 1.1),
(2, 4, 'priyankaben thakore', 'Granddaughter', 'F', 20, 0, 'N', 119, 84, 'N', 179, 'N', 14.0, 'N', NULL, NULL, NULL, NULL, NULL, NULL, 'Y', 'Y', 'Sedentary', 0.9),
(2, 5, 'santoben thakore', 'Granddaughter', 'F', 18, 0, 'N', NULL, NULL, 'N', NULL, 'N', 14.0, 'N', NULL, NULL, NULL, NULL, NULL, NULL, 'Y', 'Y', 'Sedentary', 0.7),
(2, 6, 'amitji thakore', 'Grandson', 'M', 15, 0, 'N', NULL, NULL, 'N', NULL, 'N', 13.0, 'N', 1.50, 35.0, 15.6, 75.0, 80.0, 0.94, 'Y', 'Y', 'Sedentary', 0.9),
(2, 7, 'shitaben thakore', 'Sister', 'F', 68, 0, 'Y', 160, 86, 'N', 150, 'N', 13.0, 'N', 1.55, 40.0, 16.6, 78.0, 83.0, 0.94, 'Y', 'N', 'Sedentary', 0.6),
(2, 8, 'shardaben thakore', 'Daughter-in-law', 'F', 28, 0, 'N', 122, 74, 'Y', 248, 'N', 14.0, 'N', 1.58, 43.0, 17.2, 79.0, 83.0, 0.95, 'N', 'N', 'Moderate', 1.2);

-- ==========================================================
-- FAMILY 3 (HOF: Natwariji thakore) - Contains Under-5 Children
-- ==========================================================
INSERT OR IGNORE INTO families (id, student_id, family_no, head_of_family, village_ward, address, total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given)
VALUES (3, 1, 3, 'Natwariji thakore', 'RHTC Field Area - Ward 4', 'Plot 25, Thakore Vas', 6.5, 15895, 'Normal', 'N');

INSERT OR IGNORE INTO family_members 
(family_id, member_order, name, relation_to_hof, gender, age_years, age_months, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia, height_m, weight_kg, bmi, waist_cm, hip_cm, whr, hc_cm, cc_cm, muac_cm, is_underweight, is_overweight, is_stunting, is_wasting, is_severe_wasting, mamta_card, immunization_status, oral_hygiene, general_hygiene, work_type, consumption_unit)
VALUES
(3, 1, 'Natwariji thakore', 'Head of Family', 'M', 57, 0, 'Y', 156, 73, 'Y', 213, 'N', 12.0, 'N', 1.55, 45.0, 18.7, 85.0, 90.0, 0.94, NULL, NULL, NULL, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'Y', 'Y', 'Moderate', 1.3),
(3, 2, 'Kanlaben thakore', 'Wife', 'F', 54, 0, 'Y', 158, 86, 'N', 157, 'N', 13.0, 'N', 1.48, 39.0, 17.8, 82.0, 88.0, 0.93, NULL, NULL, NULL, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'Y', 'Y', 'Sedentary', 1.2),
(3, 3, 'Deepak kumar thakore', 'Son', 'M', 28, 0, 'N', 119, 84, 'N', 197, 'N', 14.0, 'N', 1.09, 16.0, 13.5, NULL, NULL, NULL, NULL, NULL, NULL, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'Y', 'Y', 'Sedentary', 1.1),
(3, 4, 'Renukaben thakore', 'Daughter-in-law', 'F', 26, 0, 'N', 117, 73, 'Y', 235, 'N', 14.0, 'N', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'Y', 'Y', 'Sedentary', 0.9),
(3, 5, 'Sheedha thakore', 'Granddaughter', 'F', 2, 0, 'N', NULL, NULL, 'N', NULL, 'N', 15.0, 'N', 0.85, 11.0, 15.2, NULL, NULL, NULL, 46.0, 47.0, 13.5, 'N', 'N', 'N', 'N', 'N', 'Y', 'Y', 'Y', 'Y', 'Sedentary', 0.9),
(3, 6, 'Shraddha thakore', 'Granddaughter', 'F', 2, 0, 'N', NULL, NULL, 'N', NULL, 'N', 12.0, 'N', 0.84, 10.5, 14.9, NULL, NULL, NULL, 45.5, 46.5, 13.0, 'N', 'N', 'N', 'N', 'N', 'Y', 'Y', 'Y', 'Y', 'Moderate', 1.1);

-- ==========================================================
-- FAMILY 4 (HOF: Aruniji thakore) - Reproductive / Child Health
-- ==========================================================
INSERT OR IGNORE INTO families (id, student_id, family_no, head_of_family, village_ward, address, total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given)
VALUES (4, 1, 4, 'Aruniji thakore', 'RHTC Field Area - Ward 4', 'Plot 31, Thakore Vas', 3.2, 5000, 'Normal', 'N');

INSERT OR IGNORE INTO family_members 
(family_id, member_order, name, relation_to_hof, gender, age_years, age_months, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia, height_m, weight_kg, bmi, waist_cm, hip_cm, whr, oral_hygiene, general_hygiene, anc_taken, delivery_place, pnc_taken, fp_method_used, mamta_card, immunization_status, work_type, consumption_unit)
VALUES
(4, 1, 'Aruniji thakore', 'Head of Family', 'M', 29, 0, 'N', 116, 70, 'N', 147, 'N', 13.0, 'N', 1.60, 55.0, 21.5, 84.0, 88.0, 0.95, 'Y', 'N', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'Sedentary', 1.2),
(4, 2, 'Umaben thakore', 'Wife', 'F', 27, 0, 'N', 112, 83, 'N', 167, 'N', 14.0, 'N', 1.50, 48.0, 21.3, 76.0, 84.0, 0.90, 'Y', 'Y', 'Y', 'Hospital', 'Y', 'Y', 'Y', 'Y', 'Sedentary', 0.9),
(4, 3, 'Antraben thakore', 'Daughter', 'F', 4, 0, 'N', NULL, NULL, 'N', NULL, 'N', 12.0, 'N', 0.95, 14.0, 15.5, NULL, NULL, NULL, 'Y', 'Y', 'NA', 'NA', 'NA', 'NA', 'Y', 'Y', 'Sedentary', 1.1);

-- ==========================================================
-- FAMILY 5 (HOF: Dhavalji thakore)
-- ==========================================================
INSERT OR IGNORE INTO families (id, student_id, family_no, head_of_family, village_ward, address, total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given)
VALUES (5, 1, 5, 'Dhavalji thakore', 'RHTC Field Area - Ward 4', 'Plot 40, Thakore Vas', 3.6, 6904, 'Normal', 'N');

INSERT OR IGNORE INTO family_members 
(family_id, member_order, name, relation_to_hof, gender, age_years, age_months, has_htn, sbp, dbp, has_dm, rbs, has_pallor, hb, has_anaemia, height_m, weight_kg, bmi, waist_cm, hip_cm, whr, oral_hygiene, general_hygiene, work_type, consumption_unit)
VALUES
(5, 1, 'Dhavalji thakore', 'Head of Family', 'M', 22, 0, 'N', 118, 74, 'N', 148, 'N', 14.0, 'N', 1.55, 35.0, 14.6, 84.0, 89.0, 0.94, 'Y', 'Y', 'Moderate', 1.3),
(5, 2, 'Raiben thakore', 'Mother', 'F', 62, 0, 'Y', 164, 82, 'N', 169, 'N', 12.0, 'N', 1.52, 37.0, 16.0, 80.0, 84.0, 0.95, 'Y', 'Y', 'Sedentary', 1.2),
(5, 3, 'Melaji thakore', 'Brother', 'M', 21, 0, 'N', 114, 79, 'N', 175, 'N', 13.0, 'N', 1.58, 53.0, 21.2, 85.0, 90.0, 0.94, 'Y', 'Y', 'Sedentary', 1.1);

-- ==========================================================
-- LONGITUDINAL FOLLOW-UP VISITS
-- ==========================================================
INSERT OR IGNORE INTO follow_ups 
(id, member_id, student_id, visit_date, visit_number, sbp, dbp, rbs, hb, weight_kg, treatment_compliance, health_progress, clinical_notes, next_visit_date)
VALUES
(1, 1, 1, date('now', '-14 days'), 1, 142, 80, 138, 9.1, 55.5, 'Good', 'Improved', 'Patient started Amlodipine 5mg from PHC. Dietary salt reduction advised. Iron-folic acid tablets given.', date('now', '+14 days')),
(2, 1, 1, date('now'), 2, 134, 78, 130, 9.8, 56.0, 'Good', 'Improved', 'BP well controlled. Pallor reduced. Energy levels improved.', date('now', '+30 days')),
(3, 4, 1, date('now', '-7 days'), 1, 112, 70, NULL, 8.6, 31.5, 'Good', 'Improved', 'Received 2 doses of injectable Iron Sucrose at CHC. Oral IFA daily continued. Jaggery & green leafy diet advised.', date('now', '+15 days')),
(4, 7, 1, date('now', '-5 days'), 1, 148, 76, 195, 14.5, 45.0, 'Irregular', 'Stable', 'Patient misses evening Metformin doses. Strict counseling provided regarding diabetic foot care and compliance.', date('now', '+10 days'));
