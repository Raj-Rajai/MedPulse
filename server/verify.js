const { db, initDatabase } = require('./db');

console.log('🧪 Starting MedPulse Phase 2 Verification Test Suite...\n');

// 1. Initialize DB and run migrations
initDatabase();

// 2. Test Student Authentication & Existence
const student235 = db.prepare('SELECT * FROM students WHERE roll_number = ?').get('235');
if (!student235) throw new Error('Student 235 not found');
if (student235.pin !== '1234') throw new Error('Default PIN not set to 1234');
console.log(`✅ Auth Check: Roll 235 exists with PIN '${student235.pin}'.`);

// Clean any leftover test records
db.prepare('DELETE FROM families WHERE family_no = 201').run();

// 3. Test Household Creation with Phase 2 Fields (family_code, contact_number, city, pincode)
const famInsert = db.prepare(`
  INSERT INTO families (
    student_id, family_no, family_code, family_name,
    head_of_family, contact_number, village_ward, address, city, pincode,
    total_cu, calorie_intake_per_cu, calorie_status, dietary_advice_given
  ) VALUES (
    ?, 201, 'FAM-0201', 'Sharma Household',
    'Ramesh Sharma', '9876543210', 'RHTC Ward 2', 'House 42, Main Bazaar', 'Ahmedabad', '380001',
    4.5, 12200, 'Normal', 'Y'
  )
`).run(student235.id);
const testFamId = Number(famInsert.lastInsertRowid);
console.log(`✅ Household Creation: Created Family #201 (ID: ${testFamId}, Code: FAM-0201, Name: 'Sharma Household').`);

// 4. Test Household Details Update (PUT)
db.prepare(`
  UPDATE families
  SET family_name = ?, contact_number = ?, city = ?
  WHERE id = ?
`).run('Updated Sharma Residence', '9988776655', 'Gandhinagar', testFamId);

const updatedFam = db.prepare('SELECT * FROM families WHERE id = ?').get(testFamId);
if (updatedFam.family_name !== 'Updated Sharma Residence' || updatedFam.contact_number !== '9988776655') {
  throw new Error('Family update verification failed');
}
console.log(`✅ Household Update: Updated family name to '${updatedFam.family_name}' and phone to '${updatedFam.contact_number}'.`);

// 5. Test Family Search Query
const searchMatch = db.prepare(`
  SELECT * FROM families
  WHERE head_of_family LIKE ? OR family_name LIKE ? OR family_code LIKE ? OR contact_number LIKE ?
`).all('%Sharma%', '%Sharma%', '%Sharma%', '%Sharma%');
if (searchMatch.length === 0) throw new Error('Family search by name failed');
console.log(`✅ Family Search: Found ${searchMatch.length} household(s) matching 'Sharma'.`);

// 6. Test Member Creation with Phase 2 Fields (DOB, marital_status, education, occupation, contact)
const memberInsert = db.prepare(`
  INSERT INTO family_members (
    family_id, member_order, name, relation_to_hof, gender,
    date_of_birth, age_years, age_months, marital_status, education,
    occupation, contact_number, work_type, sbp, dbp, rbs, hb, height_m, weight_kg, bmi
  ) VALUES (
    ?, 1, 'Ramesh Sharma', 'Head of Family', 'M',
    '1979-05-15', 45, 0, 'Married', 'Higher Secondary',
    'Farmer', '9876543210', 'Moderate', 142, 92, 145, 14.2, 1.70, 72.0, 24.91
  )
`).run(testFamId);
const testMemberId = Number(memberInsert.lastInsertRowid);
console.log(`✅ Member Creation: Created member Ramesh Sharma (ID: ${testMemberId}) with DOB 1979-05-15, Marital: Married, Occupation: Farmer.`);

// 7. Test Member Details Update
db.prepare(`
  UPDATE family_members
  SET occupation = ?, contact_number = ?
  WHERE id = ?
`).run('Senior Agri Contractor', '9988776655', testMemberId);
const updatedMember = db.prepare('SELECT * FROM family_members WHERE id = ?').get(testMemberId);
if (updatedMember.occupation !== 'Senior Agri Contractor') throw new Error('Member update failed');
console.log(`✅ Member Update: Updated member occupation to '${updatedMember.occupation}'.`);

// 8. Test Clinical Sub-Entity: Medical Conditions
const condInsert = db.prepare(`
  INSERT INTO member_conditions (member_id, condition_name, status, diagnosed_year, notes)
  VALUES (?, 'Essential Hypertension', 'Active', 2020, 'On Amlodipine 5mg')
`).run(testMemberId);
const testCondId = Number(condInsert.lastInsertRowid);

// Update condition
db.prepare('UPDATE member_conditions SET status = ? WHERE id = ?').run('Resolved', testCondId);
const condRecord = db.prepare('SELECT * FROM member_conditions WHERE id = ?').get(testCondId);
if (condRecord.status !== 'Resolved') throw new Error('Condition status update failed');
console.log(`✅ Sub-Entity (Conditions): Added & updated condition '${condRecord.condition_name}' (Status: ${condRecord.status}).`);

// 9. Test Clinical Sub-Entity: Medications
const medInsert = db.prepare(`
  INSERT INTO member_medications (member_id, name, dosage, frequency, reason, currently_taking, notes)
  VALUES (?, 'Amlodipine', '5 mg', 'Once daily', 'Hypertension', 'Yes', 'Good adherence')
`).run(testMemberId);
const testMedId = Number(medInsert.lastInsertRowid);
const medRecord = db.prepare('SELECT * FROM member_medications WHERE id = ?').get(testMedId);
if (!medRecord || medRecord.dosage !== '5 mg') throw new Error('Medication insertion failed');
console.log(`✅ Sub-Entity (Medications): Added medication '${medRecord.name}' ${medRecord.dosage} (Taking: ${medRecord.currently_taking}).`);

// 10. Test Clinical Sub-Entity: Allergies
const algInsert = db.prepare(`
  INSERT INTO member_allergies (member_id, allergen, allergy_type, reaction, severity, notes)
  VALUES (?, 'Penicillin', 'Medication', 'Diffuse rash and bronchospasm', 'Severe', 'Avoid all beta-lactams')
`).run(testMemberId);
const testAlgId = Number(algInsert.lastInsertRowid);
const algRecord = db.prepare('SELECT * FROM member_allergies WHERE id = ?').get(testAlgId);
if (!algRecord || algRecord.allergen !== 'Penicillin') throw new Error('Allergy insertion failed');
console.log(`✅ Sub-Entity (Allergies): Added allergy '${algRecord.allergen}' (${algRecord.severity}).`);

// 11. Test Clinical Sub-Entity: Medical / Surgical History
const histInsert = db.prepare(`
  INSERT INTO member_medical_history (member_id, category, description, year, notes)
  VALUES (?, 'Surgery', 'Open Appendectomy', 2015, 'SAL Hospital, full recovery')
`).run(testMemberId);
const testHistId = Number(histInsert.lastInsertRowid);
const histRecord = db.prepare('SELECT * FROM member_medical_history WHERE id = ?').get(testHistId);
if (!histRecord || histRecord.category !== 'Surgery') throw new Error('History insertion failed');
console.log(`✅ Sub-Entity (History): Added past surgical event '${histRecord.description}' (${histRecord.year}).`);

// 12. Test Clinical Sub-Entity: Lifestyle & Habits (Upsert)
db.prepare(`
  INSERT INTO member_lifestyle (member_id, smoking_status, alcohol_status, physical_activity, diet, notes)
  VALUES (?, 'Former', 'Never', 'Moderate', 'Vegetarian', 'Quit tobacco 2 yrs ago')
  ON CONFLICT(member_id) DO UPDATE SET
    smoking_status = excluded.smoking_status,
    updated_at = CURRENT_TIMESTAMP
`).run(testMemberId);
const lsRecord = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(testMemberId);
if (!lsRecord || lsRecord.smoking_status !== 'Former' || lsRecord.diet !== 'Vegetarian') {
  throw new Error('Lifestyle insertion failed');
}
console.log(`✅ Sub-Entity (Lifestyle): Upserted lifestyle (Smoking: ${lsRecord.smoking_status}, Alcohol: ${lsRecord.alcohol_status}, Diet: ${lsRecord.diet}).`);

// 13. Test Follow-up Visit Logging
const fuRes = db.prepare(`
  INSERT INTO follow_ups (
    member_id, student_id, visit_date, visit_number, sbp, dbp, rbs, hb,
    treatment_compliance, health_progress, clinical_notes
  ) VALUES (
    ?, ?, '2026-09-19', 1, 128, 82, 118, 14.0,
    'Good', 'Improved', 'Blood pressure well controlled on Amlodipine 5mg. Compliant with salt restriction.'
  )
`).run(testMemberId, student235.id);
const testFuId = Number(fuRes.lastInsertRowid);
console.log(`✅ Longitudinal Care: Logged Follow-up Visit #${testFuId} with BP 128/82 mmHg.`);

// 14. Test Joined Member Retrieval (Verify conditions, meds, allergies, history, lifestyle all link)
const allConditions = db.prepare('SELECT * FROM member_conditions WHERE member_id = ?').all(testMemberId);
const allMeds = db.prepare('SELECT * FROM member_medications WHERE member_id = ?').all(testMemberId);
const allAllergies = db.prepare('SELECT * FROM member_allergies WHERE member_id = ?').all(testMemberId);
const allHistory = db.prepare('SELECT * FROM member_medical_history WHERE member_id = ?').all(testMemberId);
const lifestyle = db.prepare('SELECT * FROM member_lifestyle WHERE member_id = ?').get(testMemberId);
const allFollowUps = db.prepare('SELECT * FROM follow_ups WHERE member_id = ?').all(testMemberId);

if (allConditions.length !== 1 || allMeds.length !== 1 || allAllergies.length !== 1 || allHistory.length !== 1 || !lifestyle || allFollowUps.length !== 1) {
  throw new Error('Joined member sub-entities retrieval check failed');
}
console.log(`✅ Profile Aggregation: Member ${testMemberId} successfully linked with:
   - Conditions: ${allConditions.length}
   - Medications: ${allMeds.length}
   - Allergies: ${allAllergies.length}
   - History: ${allHistory.length}
   - Lifestyle Profile: Active
   - Follow-up Visits: ${allFollowUps.length}`);

// 15. Test Cascade Deletion: Deleting the household cascades to member and all sub-entities
db.prepare('DELETE FROM families WHERE id = ?').run(testFamId);

const checkMember = db.prepare('SELECT COUNT(*) as c FROM family_members WHERE id = ?').get(testMemberId).c;
const checkCond = db.prepare('SELECT COUNT(*) as c FROM member_conditions WHERE member_id = ?').get(testMemberId).c;
const checkMed = db.prepare('SELECT COUNT(*) as c FROM member_medications WHERE member_id = ?').get(testMemberId).c;
const checkAlg = db.prepare('SELECT COUNT(*) as c FROM member_allergies WHERE member_id = ?').get(testMemberId).c;
const checkHist = db.prepare('SELECT COUNT(*) as c FROM member_medical_history WHERE member_id = ?').get(testMemberId).c;
const checkLs = db.prepare('SELECT COUNT(*) as c FROM member_lifestyle WHERE member_id = ?').get(testMemberId).c;
const checkFu = db.prepare('SELECT COUNT(*) as c FROM follow_ups WHERE member_id = ?').get(testMemberId).c;

if (checkMember !== 0 || checkCond !== 0 || checkMed !== 0 || checkAlg !== 0 || checkHist !== 0 || checkLs !== 0 || checkFu !== 0) {
  throw new Error('Cascade deletion of household and clinical sub-entities failed');
}
// 16. Test Student Profile & PIN Management
db.prepare(`
  UPDATE students
  SET name = ?, email = ?, phone = ?, posting_unit = ?
  WHERE id = ?
`).run('Dhruv Patel', 'dhruv.patel@medpulse.edu', '+91 98765 43210', 'Community Medicine Unit 3', student235.id);

const profileCheck = db.prepare('SELECT * FROM students WHERE id = ?').get(student235.id);
if (profileCheck.name !== 'Dhruv Patel' || profileCheck.email !== 'dhruv.patel@medpulse.edu' || profileCheck.posting_unit !== 'Community Medicine Unit 3') {
  throw new Error('Student profile update verification failed');
}
console.log(`✅ Student Profile: Updated profile for Roll ${profileCheck.roll_number} (${profileCheck.name}, Email: ${profileCheck.email}, Unit: ${profileCheck.posting_unit}).`);

// Change PIN test
db.prepare('UPDATE students SET pin = ? WHERE id = ?').run('5678', student235.id);
const pinCheck = db.prepare('SELECT pin FROM students WHERE id = ?').get(student235.id);
if (pinCheck.pin !== '5678') throw new Error('Student PIN update failed');

// Restore default PIN 1234
db.prepare('UPDATE students SET pin = ? WHERE id = ?').run('1234', student235.id);
console.log(`✅ Student Security: Verified PIN change and reset back to default PIN '1234'.`);

// 17. Test Student Registration Panel Persistence
const testRegRoll = 'TEST-999';
db.prepare('DELETE FROM students WHERE roll_number = ?').run(testRegRoll);
const regRes = db.prepare(`
  INSERT INTO students (roll_number, name, pin, email, phone, batch_year, posting_unit, college_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  testRegRoll,
  'Dr. Ananya Sharma',
  '4321',
  'ananya.sharma@medpulse.edu',
  '+91 91234 56789',
  '3rd Year MBBS (Community Medicine)',
  'RHTC - Rural Health Training Center',
  1,
  'Active'
);
const regStudent = db.prepare('SELECT s.*, c.name as college_name FROM students s LEFT JOIN colleges c ON s.college_id = c.id WHERE s.id = ?').get(Number(regRes.lastInsertRowid));
if (!regStudent || regStudent.roll_number !== testRegRoll || regStudent.name !== 'Dr. Ananya Sharma' || regStudent.pin !== '4321' || !regStudent.college_name) {
  throw new Error('Student registration persistence assertion failed');
}
console.log(`✅ Student Registration: Created student '${regStudent.name}' (Roll: ${regStudent.roll_number}, College: ${regStudent.college_name}, PIN: ${regStudent.pin}).`);

// 18. Test Duplicate Roll Number Rejection
let dupErrorThrown = false;
try {
  db.prepare('INSERT INTO students (roll_number, name) VALUES (?, ?)').run(testRegRoll, 'Duplicate Student');
} catch (e) {
  dupErrorThrown = true;
}
if (!dupErrorThrown) throw new Error('Duplicate student roll number was not rejected by UNIQUE constraint');
console.log(`✅ Registration Security: Duplicate Roll Number '${testRegRoll}' successfully rejected.`);

// Cleanup test student
db.prepare('DELETE FROM students WHERE roll_number = ?').run(testRegRoll);

// 19. Test Multi-Tenant API Authentication & Isolation
(async () => {
  const PORT = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 19a. 401 Challenge on Unauthenticated Request
    const unauthRes = await fetch(`${baseUrl}/api/families`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 on unauthenticated /api/families, got ${unauthRes.status}`);
    }
    console.log('✅ API Security: Unauthenticated request rejected with 401 Unauthorized.');

    // 19b. User A (Dhruv Patel, Roll 235) Data Scoping
    const userARes = await fetch(`${baseUrl}/api/families`, {
      headers: { 'X-Roll-Number': '235' }
    });
    if (userARes.status !== 200) throw new Error(`User A /api/families returned status ${userARes.status}`);
    const userAFamilies = await userARes.json();
    if (userAFamilies.length !== 5) {
      throw new Error(`Expected 5 families for Roll 235 (Dhruv Patel), got ${userAFamilies.length}`);
    }
    console.log(`✅ User A Scoping: Roll 235 (Dhruv Patel) successfully loaded exclusively his ${userAFamilies.length} surveyed households.`);

    // 19c. User B Registration & Clean Slate Isolation
    const cadetBRoll = 'CADET_B_VERIFY';
    db.prepare('DELETE FROM students WHERE roll_number = ?').run(cadetBRoll);
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roll_number: cadetBRoll,
        name: 'Dr. Cadet B',
        pin: '1234',
        batch_year: '3rd Year MBBS',
        posting_unit: 'RHTC Unit 1'
      })
    });
    if (regBRes.status !== 201) throw new Error(`Cadet B registration failed: ${regBRes.status}`);

    const userBRes = await fetch(`${baseUrl}/api/families`, {
      headers: { 'X-Roll-Number': cadetBRoll }
    });
    const userBFamilies = await userBRes.json();
    if (userBFamilies.length !== 0) {
      throw new Error(`Expected 0 families for fresh Cadet B, got ${userBFamilies.length}`);
    }
    console.log('✅ User B Scoping: Freshly registered Cadet B starts with a clean slate of 0 families (zero data leakage).');

    // 19d. User B Analytics Summary Isolation
    const summaryBRes = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { 'X-Roll-Number': cadetBRoll }
    });
    const summaryB = await summaryBRes.json();
    if (summaryB.totals.families !== 0 || summaryB.totals.members !== 0) {
      throw new Error(`Expected 0 totals for Cadet B summary, got ${JSON.stringify(summaryB.totals)}`);
    }
    console.log('✅ Analytics Isolation: Cadet B summary metrics reflect strictly 0 families and 0 members.');

    // 20. Test Cross-Tenant Authorization Protection (403 Forbidden)
    const dhruvFam = userAFamilies[0];
    const famId = dhruvFam.id;

    // 20a. Cadet B attempting to read Dhruv's family
    const crossRead = await fetch(`${baseUrl}/api/families/${famId}`, {
      headers: { 'X-Roll-Number': cadetBRoll }
    });
    if (crossRead.status !== 403) {
      throw new Error(`Expected 403 Forbidden on cross-tenant read of Family ${famId}, got ${crossRead.status}`);
    }
    console.log(`✅ Cross-Tenant Security: Cross-cadet inspection of Family ${famId} blocked with 403 Forbidden.`);

    // 20b. Cadet B attempting to modify Dhruv's family
    const crossUpdate = await fetch(`${baseUrl}/api/families/${famId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roll-Number': cadetBRoll },
      body: JSON.stringify({ head_of_family: 'Tampered HOF' })
    });
    if (crossUpdate.status !== 403) {
      throw new Error(`Expected 403 Forbidden on cross-tenant update of Family ${famId}, got ${crossUpdate.status}`);
    }
    console.log(`✅ Cross-Tenant Security: Cross-cadet mutation of Family ${famId} blocked with 403 Forbidden.`);

    // 20c. Cadet B creates their own household
    const createB = await fetch(`${baseUrl}/api/families`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Roll-Number': cadetBRoll },
      body: JSON.stringify({
        family_no: 1,
        family_code: 'FAM-B01',
        head_of_family: 'Cadet B Test HOF',
        village_ward: 'RHTC Ward B'
      })
    });
    if (createB.status !== 201) throw new Error(`Cadet B household creation failed: ${createB.status}`);

    const userBAfter = await fetch(`${baseUrl}/api/families`, {
      headers: { 'X-Roll-Number': cadetBRoll }
    });
    const userBFamiliesAfter = await userBAfter.json();
    if (userBFamiliesAfter.length !== 1) {
      throw new Error(`Expected 1 family for Cadet B, got ${userBFamiliesAfter.length}`);
    }

    const userAAfter = await fetch(`${baseUrl}/api/families`, {
      headers: { 'X-Roll-Number': '235' }
    });
    const userAFamiliesAfter = await userAAfter.json();
    if (userAFamiliesAfter.length !== 5) {
      throw new Error(`Expected exactly 5 families for Roll 235 after Cadet B created family, got ${userAFamiliesAfter.length}`);
    }
    console.log(`✅ Multi-Tenant Integrity: Cadet B has 1 household; Roll 235 (Dhruv Patel) still has exactly 5 households.`);

    // Cleanup Cadet B
    db.prepare('DELETE FROM families WHERE family_code = ?').run('FAM-B01');
    db.prepare('DELETE FROM students WHERE roll_number = ?').run(cadetBRoll);
    console.log('✅ Cleanup: Temporary Cadet B test records purged.');

    console.log('\n🎉 ALL MULTI-TENANT AUTHENTICATION & AUTHORIZATION VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Async verification failed:', err.message);
    process.exit(1);
  }
})();
