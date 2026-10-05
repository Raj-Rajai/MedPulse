# MedPulse | Medical College Community Health Platform

> **Healthcare Startup Solution**: A normalized relational database & intuitive data-entry platform tailored for medical colleges (Community Medicine / PSM departments) to replace manual, error-prone paper logbooks and wide spreadsheets.

Based on real-world MBBS field survey logbooks (such as [Roll235.pdf.pdf](file:///c:/Users/rajai/OneDrive/Desktop/Project%20X/Roll235.pdf.pdf)), this platform enables medical students to efficiently record family health profiles with age-adaptive inputs, real-time calculations (BMI, WHR, hypertension/anaemia auto-flagging), and instant epidemiological queries for college audits.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js (v24) + Express.js
- **Database**: SQLite via Node's native `node:sqlite` (`DatabaseSync` - zero native compilation issues on Windows)
- **Frontend**: Clean, lightweight semantic HTML5 & minimal CSS (no bloated CSS frameworks, fast on field tablets and mobile)
- **Data Engine**: Relational ANSI SQL schema with foreign keys, checks, and performance indexes

---

## 📁 Project Structure

```
Project X/
├── database/
│   ├── schema.sql           # Normalized relational schema (colleges, students, families, members, follow-ups)
│   ├── seed.sql             # Real survey data from Roll235.pdf + longitudinal follow-ups
│   ├── queries.sql          # Pre-built epidemiological and statistical SQL queries
│   └── health_survey.db     # SQLite database file (auto-generated on start)
├── server/
│   ├── db.js                # Database connection & schema/seed initializer
│   ├── routes.js            # REST API endpoints (auth, families, members, follow-ups, reports)
│   ├── server.js            # Express server entrypoint
│   └── verify.js            # Automated verification test suite
├── public/
│   ├── index.html           # Community Health Dashboard & Family Roster browser
│   ├── login.html           # Student sign-in portal (Roll No + PIN, 1-click demo login)
│   ├── family-manage.html   # Family selector, member cards, member addition & follow-ups
│   ├── entry.html           # Adaptive student survey data-entry interface
│   ├── analytics.html       # Interactive database query runner & SQL inspector
│   ├── style.css            # Minimal, high-contrast, responsive CSS
│   └── app.js               # Dynamic form interactions, BMI/WHR logic, and API calls
├── package.json             # NPM package scripts & dependencies
└── README.md                # Documentation & developer guide
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies & Start
```bash
npm install
npm start
```

### 2. Open in Browser
- **Student Sign-In**: [http://localhost:3000/login.html](http://localhost:3000/login.html) *(Demo Roll: `235`, PIN: `1234`)*
- **Family & Member Management**: [http://localhost:3000/family-manage.html](http://localhost:3000/family-manage.html)
- **Dashboard Overview**: [http://localhost:3000/](http://localhost:3000/)
- **Student Data Entry Form**: [http://localhost:3000/entry.html](http://localhost:3000/entry.html)
- **Database Queries & Analytics**: [http://localhost:3000/analytics.html](http://localhost:3000/analytics.html)

---

## 📊 Database Schema Highlights

### `colleges`
Stores institutions participating in the community medicine program.
- `id`, `name`, `code`, `city`, `state`

### `students`
Medical students conducting field surveys.
- `id`, `roll_number` (e.g. `235`), `name`, `batch_year`, `college_id`

### `families`
The household survey unit.
- `id`, `student_id`, `family_no`, `head_of_family`, `village_ward`, `address`, `survey_date`
- **Dietary Profile**: `total_cu` (Consumption Units), `calorie_intake_per_cu` (kcal/CU/day), `calorie_status` (`Deficient`/`Normal`/`Excess`), `dietary_advice_given` (`Y`/`N`)

### `family_members`
Normalized health, clinical, and anthropometric records per individual:
- **Demographics**: `member_order`, `name`, `relation_to_hof`, `gender`, `age_years`, `age_months`
- **Adult NCD Screening** (*Age $\ge$ 18*): `has_htn`, `sbp`, `dbp`, `has_dm`, `rbs`, `has_pallor`, `hb`, `has_anaemia`
- **Anthropometry**: `height_m`, `weight_kg`, `bmi` ($kg/m^2$), `waist_cm`, `hip_cm`, `whr`
- **Pediatric Nutrition & Growth** (*0 to 5 Years*): `muac_cm`, `hc_cm`, `cc_cm`, `is_underweight`, `is_overweight`, `is_stunting`, `is_wasting`, `is_severe_wasting`, `mamta_card`, `immunization_status`
- **Maternal & Reproductive Health** (*Females 15–49*): `anc_taken`, `delivery_place`, `pnc_taken`, `fp_method_used`
- **General & Occupational**: `oral_hygiene`, `general_hygiene`, `diagnosis`, `treatment_taken`, `treatment_source`, `work_type`, `consumption_unit`

---

## ⚡ User-Friendly Student Experience (Key Features)

1. **Age-Adaptive Form Fields**:
   - Adult sections (Blood Pressure, Diabetes, Waist/Hip) automatically activate when Age $\ge$ 18.
   - Pediatric growth & nutrition sections (MUAC, Head Circumference, Stunting, Wasting, Mamta Card) automatically appear for children $\le$ 5 years.
   - Maternal care sections appear for women of reproductive age.
2. **Instant Client-Side Auto-Calculations**:
   - **BMI**: Instant calculation from Height & Weight with WHO Asian categorization (*Underweight / Normal / Overweight / Obese*).
   - **WHR**: Waist-to-hip ratio computed live.
   - **Hypertension auto-flag**: Triggers warning if SBP $\ge 140$ or DBP $\ge 90$.
   - **Anaemia auto-flag**: Triggers warning if Hb $< 12.0$ g/dL or Pallor is present.
3. **Multi-Member Staging Builder**:
   - Students can add multiple members sequentially with instant preview before committing the entire family transaction to the database.

---

## 🔍 Pre-Built Database Queries

The system provides turnkey queries in `database/queries.sql` and the interactive web viewer:
1. **Student Field Survey Audit**: Total families, members, and sex ratio surveyed per roll number.
2. **Adult NCD Prevalence**: Hypertension and Diabetes rates, mean SBP/DBP, and comorbidity counts.
3. **Anaemia & Hemoglobin Profile**: Gender-disaggregated anaemia prevalence and mean Hb levels.
4. **Adult BMI Categorization**: Distribution across Underweight, Normal, Overweight, and Obese.
5. **Pediatric Health (0-5 Years)**: Under-5 stunting, wasting, underweight, Mamta card coverage, and immunization rates.
6. **Family Caloric Adequacy**: Nutritional status breakdown and counseling intervention metrics.

---

## 🛣️ Roadmap (Next Phases)

- **Phase 2**: Multi-tenant College Admin dashboard with batch assignment and student CSV exports.
- **Phase 3**: Offline PWA caching for rural field surveys without cellular connectivity.
- **Phase 4**: Automated ICMR dietary intake calculator (ingredient-to-calorie conversion).
