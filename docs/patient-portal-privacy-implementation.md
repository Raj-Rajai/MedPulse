# Patient portal privacy implementation

Requirements source: `MedPulse_Patient_Portal_Privacy_Audit_for_Codex.pdf`, supplied by the user.

## Architecture and scope

The source in this repository uses NestJS, SQLite (`node:sqlite`) and React/Vite. There is no
Supabase client, Supabase schema, RLS policy or document storage bucket in this application.
The audit's Supabase-specific recommendations are implemented as server-side authorization
and SQLite access-grant/session tables for the architecture actually present. No manual
Supabase migration is required for this repository.

Historical clinical fields, survey records and hospital notes remain in the database.
This change restricts their delivery and presentation; it does not purge historical clinical data.

## Requirements trace

| Audit requirement | Implemented behavior |
| --- | --- |
| Four primary sections | Appointments, Health records, My family, Care reminders. Identification card and health camps are secondary views. |
| Neutral overview | No medicine names, diagnoses or numeric health readings. Follow-up dates, appointment status and camp logistics remain available. |
| Minimal general card | Name, patient ID, age and a reference-only QR. Blood group, full birth date, phone numbers and addresses are excluded. Private contact details require an explicit reveal and are excluded from print. |
| Identification versus clinical document | Card explicitly states it is not a clinical document or an access credential. |
| Safe QR, print and copy | QR payload is only `MEDPULSE-ID:<patient_uid>`. A patient UID is never accepted as authentication. Print/copy actions check the current server session and are audited. Print CSS excludes all other portal content, including expanded contact forms. |
| Private family cards | Name, relationship, MedPulse member ID, registration/survey status and access status. No clinical measurements, diagnoses or contact details for other adult account holders. |
| Individual permissions | Self-access by the authenticated patient, or an unexpired explicit consent grant. Family-head status alone grants no medical-record access. Adults can grant access to a family account for 30 days and revoke it. |
| Guardian workflow | A family member submits a request. An authorized hospital administrator must verify identity, relationship, date of birth and applicable consent requirements. Requests do not grant access until approved; grants expire and cease working when the child reaches adulthood. Unknown birth date never implies guardianship. |
| Clinical section | Records load only on explicit opening. Source/date labels identify survey entries as not automatically clinically verified. Unknown measurement dates are labeled as missing, rather than inferred from a profile-edit date. |
| No unsupported treatment claims | Recorded measurements are shown neutrally. No calculated “normal”, “improved”, or default medicine-taking claims are shown. |
| Correction process | Patients submit a correction request against an authorized record. The original record is unchanged. Patients can track request status; hospital staff have a scoped review queue. Verified changes use the existing clinical/survey workflow. |
| Appointments preserved | Department, request type, contact method, preferred time and optional message remain. No medical information is prefilled into messages or external WhatsApp links. |
| Internal notes protected | Patient callback responses contain only tracking fields. Internal hospital notes, handler details and clinical/contact fields remain in authorized staff responses. |
| Authorization and audit | Expiring opaque sessions replace claimed IDs and predictable tokens. Student access remains scoped to assigned records. Hospital queues remain hospital-scoped. Access, consent, corrections, print/copy and appointment changes have metadata-only audit events. |
| Session expiry and shared screens | Sessions expire after 30 minutes. Patient portal signs out after 15 minutes of inactivity. Clinical records are unmounted on navigation/backgrounding; the private contact editor closes when backgrounded. API responses use `no-store`. |
| Notification previews | Camp notifications contain logistics with a generic title, never the condition or clinical criterion that triggered matching. Calendar exports use a generic event title and description. |
| Emergency guidance | Guidance to seek immediate emergency care stays visible in every section. Patients are told not to wait for a portal reply or callback. |
| Protected documents | Existing FAP exports still require an authenticated student session and remain student-scoped. There is no patient report bucket to configure or public clinical-document URL added by this change. |
| Aadhaar/ABHA | The earlier data-entry changes remain: no new collection; MedPulse member IDs are backend-assigned and database-wide unique. |
| Development screenshots | Browser verification uses invented people, identifiers, phone numbers and clinical entries. No real patient screenshots are included. |

## Database and API changes

Startup migration: `apps/api/src/database/schemas/62-portal-privacy.schema.ts`.

- `portal_sessions`: random 256-bit session secrets are stored only as SHA-256 hashes, with role,
  account ID and expiry. Browser cookies are HttpOnly, SameSite Strict and Secure in production.
- `patient_record_access`: individual-consent and staff-reviewed guardian grants, revocation and expiry.
- `patient_record_corrections`: review requests; no automatic rewriting of source clinical records.
- `portal_privacy_audit`: actor, action, resource ID and timestamp; no copied clinical notes or readings.

New patient routes: `/api/patient/overview`, `/api/patient/access`,
`/api/patient/access/:id`, `/api/patient/family/members/:id/records`,
`/api/patient/family/members/:id/guardian-request`, `/api/patient/corrections`,
and `/api/patient/card/action`. Every one requires a patient session.

Hospital review: `/api/crm/hospital/privacy-requests` and
`/api/crm/hospital/privacy-requests/:kind/:id/review`, where kind is `guardian` or `correction`.
These require the hospital session, the correct hospital and an administrator role for review.
The hospital control centre includes the review queue.

Logout: `POST /api/session/:role/logout`. Browser-stored account previews do not authenticate
requests. Headers such as `X-Patient-Id`, `X-Student-Id`, `X-Admin-Id` and predictable
`patient-123` / `hosp-123` tokens no longer establish identity.

Names, phone numbers and student referral codes no longer automatically claim an existing medical
record. Existing verified/provisioned links are retained. Existing patient PINs cannot be reset by
student provisioning, and a different patient's phone cannot be reused to claim their account.

## Changed files

Patient UI: `PatientApp.tsx`, `Sidebar.tsx`, `OverviewPanel.tsx`, `ProfilePanel.tsx`,
`FamilyPanel.tsx`, `RecordsPanel.tsx`, `PrivacyControls.tsx`, `HospitalPanel.tsx`,
`CampaignsPanel.tsx`, `Modals.tsx`, `actions.ts`, `types.ts`, `logic.ts`, `util.ts`,
`patient-styles.css`, and `patient-privacy.css` under `apps/web/src/pages/patient/`.

Supporting UI: `apps/web/src/pages/hospital/PrivacyRequests.tsx`, `HospitalApp.tsx`,
shared `session.ts` and `auth-guard.ts`, shared login/registration forms, and the existing-account
message in `student/family-manage/FamilyManageApp.tsx`.

Backend: `auth/portal-session.service.ts`, `auth/portal-session.controller.ts`, `auth/auth.service.ts`,
`auth/auth.module.ts`, the privacy migration and schema registry, `main.ts`,
`common/api-exception.filter.ts`, `common/patient-notification.ts`,
patient controllers/models/module plus `patient-privacy.service.ts` and `patient-privacy.controller.ts`,
student authentication/profile/provisioning code, admin/hospital login controllers, and campaign/
engagement notification controllers.

## Validation

Backend regression suite:

```powershell
npm --prefix apps/api run build
node --test apps/api/test/patient-privacy.test.cjs apps/api/test/member-identity.test.cjs apps/api/test/attendance-cluster.test.cjs apps/api/test/attendance-cluster-http.test.cjs
```

The suite covers 15 tests, including direct API impersonation attempts, cross-family reads,
student scoping, explicit adult consent, revocation/expiry, guardian approval/adulthood,
correction authorization, internal-note filtering, print-action authentication, metadata-only
auditing, session expiry/logout, member-ID concurrency and existing attendance behavior.

Browser verification: `node artifacts/verify-patient-privacy.cjs`.
It checks default/private DOM content, four-section navigation, consent and guardian forms,
lazy clinical requests, background hiding, QR payload, copied ID, print contents, correction
submission and mobile page width. Screenshots are in `artifacts/patient-privacy/`.

Type checking: `npm run typecheck`. Production frontend build: `npm --prefix apps/web run build`.

## Deployment and operational requirements

1. Deploy backend and frontend together and restart the backend. The schema migrations run
   automatically; no clinical tables need to be deleted. Users must sign in again because old
   browser IDs and predictable tokens are intentionally no longer credentials.
2. Serve the UI and API on the same HTTPS origin with `NODE_ENV=production`. Use a persistent
   SQLite volume with `MEDPULSE_DB_PATH`; preserve and back up the database between deployments.
   The existing free Render configuration does not configure a persistent disk.
3. Review and replace demo/default account PINs before exposing the deployment publicly.
   Existing credential storage and account-recovery policy need their own operational review;
   this implementation is not a certification of the entire application's security or compliance.
4. Hospital staff must verify guardianship and apply institutional consent requirements before
   approving a request. Review the portal's fixed 30-day sharing/guardian duration and 30-minute
   session duration against the institution's policy before rollout.
5. Historical unverified account-to-record links are preserved rather than silently deleting or
   reassigning them. Staff should review legacy links created by the old phone/name matching flow.
6. Future Supabase or report-storage integrations need their own deny-by-default RLS/storage
   policies. There are none to migrate in the current SQLite application.

This work changes the local implementation only; it does not deploy or publish the application.
