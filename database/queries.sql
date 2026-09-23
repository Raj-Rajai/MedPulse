-- ==========================================================
-- PRE-BUILT EPIDEMIOLOGICAL & MEDICAL COLLEGE QUERIES
-- Department of Community Medicine / Preventive & Social Medicine
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Student Field Survey Audit (Progress by Roll Number)
-- ----------------------------------------------------------
-- Description: Aggregates total families, members, and sex ratio surveyed per student.
SELECT 
    s.roll_number,
    s.name AS student_name,
    COUNT(DISTINCT f.id) AS total_families_surveyed,
    COUNT(m.id) AS total_members_surveyed,
    SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
    SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS female_count,
    ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
          NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) AS sex_ratio_per_1000_males
FROM students s
LEFT JOIN families f ON s.id = f.student_id
LEFT JOIN family_members m ON f.id = m.family_id
GROUP BY s.id, s.roll_number, s.name;


-- ----------------------------------------------------------
-- 2. Non-Communicable Disease (NCD) Prevalence in Adults (Age >= 18)
-- ----------------------------------------------------------
-- Description: Measures community burden of Hypertension (HTN) and Diabetes (DM).
SELECT 
    COUNT(*) AS total_adults_surveyed,
    SUM(CASE WHEN has_htn = 'Y' THEN 1 ELSE 0 END) AS htn_cases,
    ROUND(SUM(CASE WHEN has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 2) AS htn_prevalence_pct,
    SUM(CASE WHEN has_dm = 'Y' THEN 1 ELSE 0 END) AS dm_cases,
    ROUND(SUM(CASE WHEN has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 2) AS dm_prevalence_pct,
    SUM(CASE WHEN has_htn = 'Y' AND has_dm = 'Y' THEN 1 ELSE 0 END) AS both_htn_and_dm_cases,
    ROUND(AVG(CASE WHEN sbp IS NOT NULL THEN sbp END), 1) AS mean_systolic_bp,
    ROUND(AVG(CASE WHEN dbp IS NOT NULL THEN dbp END), 1) AS mean_diastolic_bp,
    ROUND(AVG(CASE WHEN rbs IS NOT NULL THEN rbs END), 1) AS mean_random_blood_sugar
FROM family_members
WHERE age_years >= 18;


-- ----------------------------------------------------------
-- 3. Anaemia & Hemoglobin Profile by Gender
-- ----------------------------------------------------------
-- Description: Assesses anaemia prevalence across male vs female population.
SELECT 
    gender,
    COUNT(*) AS total_individuals,
    SUM(CASE WHEN has_anaemia = 'Y' OR (hb IS NOT NULL AND hb < 12.0) THEN 1 ELSE 0 END) AS anaemic_count,
    ROUND(SUM(CASE WHEN has_anaemia = 'Y' OR (hb IS NOT NULL AND hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 2) AS anaemia_prevalence_pct,
    SUM(CASE WHEN has_pallor = 'Y' THEN 1 ELSE 0 END) AS clinical_pallor_detected,
    ROUND(AVG(hb), 2) AS average_hb_g_dl,
    MIN(hb) AS lowest_hb_recorded
FROM family_members
WHERE gender IN ('M', 'F')
GROUP BY gender;


-- ----------------------------------------------------------
-- 4. Adult Nutritional Status (BMI Categorization)
-- ----------------------------------------------------------
-- Description: Categorizes adult nutritional status using WHO/Asian BMI cut-offs.
SELECT 
    CASE 
        WHEN bmi < 18.5 THEN 'Underweight (< 18.5)'
        WHEN bmi BETWEEN 18.5 AND 22.9 THEN 'Normal Weight (18.5 - 22.9)'
        WHEN bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
        WHEN bmi >= 27.5 THEN 'Obese (>= 27.5)'
        ELSE 'Measurement Pending / Not Applicable'
    END AS bmi_category,
    COUNT(*) AS person_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM family_members WHERE age_years >= 18 AND bmi IS NOT NULL), 1) AS percentage_of_measured
FROM family_members
WHERE age_years >= 18 AND bmi IS NOT NULL
GROUP BY bmi_category
ORDER BY MIN(COALESCE(bmi, 0));


-- ----------------------------------------------------------
-- 5. Pediatric Health & Malnutrition (Children 0 - 5 Years)
-- ----------------------------------------------------------
-- Description: Monitors growth faltering and under-5 indicators (stunting, wasting, immunization).
SELECT 
    COUNT(*) AS total_under_5_children,
    SUM(CASE WHEN is_underweight = 'Y' THEN 1 ELSE 0 END) AS underweight_count,
    SUM(CASE WHEN is_stunting = 'Y' THEN 1 ELSE 0 END) AS stunted_count,
    SUM(CASE WHEN is_wasting = 'Y' THEN 1 ELSE 0 END) AS wasted_count,
    SUM(CASE WHEN is_severe_wasting = 'Y' THEN 1 ELSE 0 END) AS severely_wasted_count,
    SUM(CASE WHEN mamta_card = 'Y' THEN 1 ELSE 0 END) AS mamta_card_holders,
    ROUND(SUM(CASE WHEN mamta_card = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS mamta_card_coverage_pct,
    SUM(CASE WHEN immunization_status = 'Y' THEN 1 ELSE 0 END) AS fully_immunized_as_per_age,
    ROUND(SUM(CASE WHEN immunization_status = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS age_appropriate_immunization_pct
FROM family_members
WHERE age_years <= 5;


-- ----------------------------------------------------------
-- 6. Maternal & Reproductive Health Indicators
-- ----------------------------------------------------------
-- Description: Evaluates institutional delivery %, ANC/PNC coverage, and family planning adoption.
SELECT 
    COUNT(*) AS surveyed_women_reproductive_age,
    SUM(CASE WHEN anc_taken = 'Y' THEN 1 ELSE 0 END) AS anc_registered,
    SUM(CASE WHEN delivery_place = 'Hospital' THEN 1 ELSE 0 END) AS institutional_deliveries,
    SUM(CASE WHEN delivery_place = 'Home' THEN 1 ELSE 0 END) AS home_deliveries,
    SUM(CASE WHEN pnc_taken = 'Y' THEN 1 ELSE 0 END) AS pnc_received,
    SUM(CASE WHEN fp_method_used = 'Y' THEN 1 ELSE 0 END) AS family_planning_users
FROM family_members
WHERE gender = 'F' AND (anc_taken != 'NA' OR delivery_place != 'NA' OR fp_method_used != 'NA');


-- ----------------------------------------------------------
-- 7. Family Caloric Adequacy & Dietary Counseling Status
-- ----------------------------------------------------------
-- Description: Analyzes family nutrition deficiency and counseling interventions.
SELECT 
    calorie_status,
    COUNT(*) AS family_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM families), 1) AS percentage_of_families,
    ROUND(AVG(calorie_intake_per_cu), 0) AS avg_calorie_intake_per_cu,
    SUM(CASE WHEN dietary_advice_given = 'Y' THEN 1 ELSE 0 END) AS received_dietary_advice
FROM families
GROUP BY calorie_status;
