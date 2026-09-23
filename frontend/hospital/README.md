# Hospital FAP workspace

Run `npm start` from MedPulse, then open http://localhost:3000/hospital/ and sign in with a hospital account. The former public demo URL now forwards to the authenticated workspace.

This interface reads actual student-entered Family Adoption Programme records from family_members, families, students, colleges and their clinical sub-records. It does not require a separate patient login and does not create duplicate patient accounts. Search covers names, FAP IDs, contact numbers, family codes/heads, villages, addresses, students/roll numbers, colleges, diagnoses, recorded conditions and linked patient IDs/phones. College, student and indicator filters are applied on the server. Results have a total count and 25-record pagination.

Opening a record loads baseline measurements, family information, screening flags, treatment, conditions, medications, allergies, medical history, lifestyle, child/maternal fields and dated follow-up visits with student attribution. Missing fields display as Not recorded. Refreshing or reopening reflects student edits directly.

New read-only endpoints use the existing hospital authentication middleware:
- GET /api/hospital/fap/summary
- GET /api/hospital/fap/options
- GET /api/hospital/fap/patients
- GET /api/hospital/fap/patients/:id (family member ID)

Hospital scope: explicit patients.hospital_id links take priority. Members without any patient account follow hospital 1, matching the application's existing StudentModel.createPatientAccount default. They are excluded from other hospitals. This default is defined in hospital-fap.model.js; a future configurable FAP referral mapping should replace it if surveys need assignment to multiple hospitals. Both the list and detail endpoints enforce this scope. The legacy patient dossier now also checks hospital scope before reading clinical sub-records and omits the patient PIN.

Verification: `node scripts/check-hospital-ui.cjs` runs isolated in-memory integration tests through the actual student and hospital API routes. It verifies student creation/updates and follow-ups appearing in hospital search, filters, pagination, invalid parameters, unauthenticated requests and cross-hospital isolation. Set FAP_BROWSER=1 to also run Playwright checks. Optional PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE environment variables select an existing installation. Browser screenshots use synthetic test records. No tests modify the application database.
