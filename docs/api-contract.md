# CRM ⇄ HMS API contract

CRM (patient portal) owns these endpoints and the `hospital_callback_requests` table.
HMS (hospital portal) only **calls** them. Neither team edits the other's files.

Auth: same as other hospital endpoints: `X-Hospital-Admin-Id: <hospital_admins.id>` (or `Authorization: Bearer hosp-<id>`).
Every call is scoped to the signed-in admin's hospital.

## 1. List the callback queue

`GET /api/crm/hospital/callback-requests?status=Active`

`status`: `Active` (default: Open + Acknowledged + Scheduled) · `Open` · `Acknowledged` · `Scheduled` · `Resolved` · `Cancelled` · `All`

```json
{
  "success": true,
  "open_count": 3,
  "total": 5,
  "requests": [{
    "id": 12,
    "status": "Open",                     // Open | Acknowledged | Scheduled | Resolved | Cancelled
    "channel": "Callback",                // Callback | WhatsApp
    "department": "Cardiology (Heart / BP)",
    "reason": "Book appointment",
    "message": "BP tablet makes me dizzy",
    "preferred_time": "Evening (4–8)",
    "created_at": "2026-09-24 09:12:00",
    "patient_id": 48, "patient_uid": "PAT-ROLL235-001", "patient_name": "…", "patient_phone": "9876543210",
    "blood_group": "B+", "patient_age": 60, "patient_gender": "M",
    "for_member_id": 233, "for_member_name": "…", "for_member_relation": "Spouse", "for_member_age": 55, "for_member_gender": "F",
    "hospital_note": null, "scheduled_for": null, "handled_by_name": null,
    "patient_confirmation": null          // Confirmed | Disputed (after Resolved)
  }]
}
```

`for_member_*` is the family member the request is **for**. The patient account holder may be calling on behalf of a relative.

## 2. Update a request

`POST /api/crm/hospital/callback-requests/:id/status`

```json
{ "status": "Scheduled", "scheduled_for": "Mon 29 Sep, 10:30 AM · OPD 4", "note": "Bring old prescriptions" }
```

| status | required | effect |
|---|---|---|
| `Acknowledged` | none | Patient sees "Hospital has seen your request" |
| `Scheduled` | `scheduled_for` | Patient sees the appointment time |
| `Resolved` | none (note recommended) | Patient is asked "Was this resolved?". If they answer No, it goes back to `Open` |

Errors: `400` bad status / missing `scheduled_for` / patient cancelled · `401` not signed in · `404` not this hospital's request.

## 3. Suggested HMS UI
A "Patient callbacks" tab with an Open count badge, a list sorted Open → Acknowledged → Scheduled,
a Call button (`tel:` patient_phone), and Acknowledge / Schedule / Resolve actions.

Tests: `npm run test:engagement` (section 3) exercises this contract end to end.
