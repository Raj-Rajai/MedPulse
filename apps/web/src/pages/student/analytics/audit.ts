/** Academic audit report metadata (verbatim from analytics.html). */
export const AUDIT_META = {
  'student-audit': {
    title: 'Student Field Survey Audit & Sex Ratio',
    desc: 'Aggregates surveyed families, surveyed individuals, and calculated sex ratio per student roll number.',
    sql: `SELECT 
s.roll_number,
s.name AS student_name,
COUNT(DISTINCT f.id) AS total_families_surveyed,
COUNT(m.id) AS total_members_surveyed,
SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS female_count,
ROUND(CAST(SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS REAL) / 
      NULLIF(SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END), 0) * 1000, 1) AS sex_ratio
FROM students s
LEFT JOIN families f ON s.id = f.student_id
LEFT JOIN family_members m ON f.id = m.family_id
GROUP BY s.id, s.roll_number, s.name;`
  },
  'ncd-prevalence': {
    title: 'Adult Non-Communicable Disease (NCD) Prevalence',
    desc: 'Calculates prevalence rates for Hypertension (HTN), Diabetes Mellitus (DM), and average Blood Pressure values.',
    sql: `SELECT 
COUNT(*) AS total_adults,
SUM(CASE WHEN has_htn = 'Y' THEN 1 ELSE 0 END) AS htn_cases,
ROUND(SUM(CASE WHEN has_htn = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS htn_pct,
SUM(CASE WHEN has_dm = 'Y' THEN 1 ELSE 0 END) AS dm_cases,
ROUND(SUM(CASE WHEN has_dm = 'Y' THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS dm_pct,
SUM(CASE WHEN has_htn = 'Y' AND has_dm = 'Y' THEN 1 ELSE 0 END) AS htn_and_dm_cases,
ROUND(AVG(CASE WHEN sbp IS NOT NULL THEN sbp END), 1) AS mean_sbp,
ROUND(AVG(CASE WHEN dbp IS NOT NULL THEN dbp END), 1) AS mean_dbp,
ROUND(AVG(CASE WHEN rbs IS NOT NULL THEN rbs END), 1) AS mean_rbs
FROM family_members
WHERE age_years >= 18;`
  },
  'anaemia-gender': {
    title: 'Anaemia & Hemoglobin Profile by Gender',
    desc: 'Evaluates community anaemia burden and mean Hemoglobin levels separated by male vs female individuals.',
    sql: `SELECT 
gender,
COUNT(*) AS total_individuals,
SUM(CASE WHEN has_anaemia = 'Y' OR (hb IS NOT NULL AND hb < 12.0) THEN 1 ELSE 0 END) AS anaemic_count,
ROUND(SUM(CASE WHEN has_anaemia = 'Y' OR (hb IS NOT NULL AND hb < 12.0) THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1) AS anaemia_pct,
SUM(CASE WHEN has_pallor = 'Y' THEN 1 ELSE 0 END) AS pallor_count,
ROUND(AVG(hb), 2) AS average_hb
FROM family_members
WHERE gender IN ('M', 'F')
GROUP BY gender;`
  },
  'bmi-distribution': {
    title: 'Adult Nutritional Status (BMI Categorization)',
    desc: 'Breaks down adults into WHO/Asian BMI cut-offs: Underweight, Normal, Overweight, and Obese.',
    sql: `SELECT 
CASE 
    WHEN bmi < 18.5 THEN 'Underweight (< 18.5)'
    WHEN bmi BETWEEN 18.5 AND 22.9 THEN 'Normal Weight (18.5 - 22.9)'
    WHEN bmi BETWEEN 23.0 AND 27.4 THEN 'Overweight (23.0 - 27.4)'
    WHEN bmi >= 27.5 THEN 'Obese (>= 27.5)'
    ELSE 'Unmeasured'
END AS bmi_category,
COUNT(*) AS count
FROM family_members
WHERE age_years >= 18 AND bmi IS NOT NULL
GROUP BY bmi_category;`
  },
  'pediatric-health': {
    title: 'Pediatric Health & Malnutrition (Children 0 - 5 Years)',
    desc: 'Measures under-5 growth metrics: underweight, stunting, wasting, Mamta card possession, and age-appropriate immunization.',
    sql: `SELECT 
COUNT(*) AS total_under_5,
SUM(CASE WHEN is_underweight = 'Y' THEN 1 ELSE 0 END) AS underweight,
SUM(CASE WHEN is_stunting = 'Y' THEN 1 ELSE 0 END) AS stunting,
SUM(CASE WHEN is_wasting = 'Y' THEN 1 ELSE 0 END) AS wasting,
SUM(CASE WHEN mamta_card = 'Y' THEN 1 ELSE 0 END) AS mamta_card,
SUM(CASE WHEN immunization_status = 'Y' THEN 1 ELSE 0 END) AS age_immunized
FROM family_members
WHERE age_years <= 5;`
  }
} as const;

export type AuditId = keyof typeof AUDIT_META;
