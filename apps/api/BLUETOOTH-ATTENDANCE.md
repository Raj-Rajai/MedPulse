# Bluetooth cluster attendance backend

The backend and browser waiting rooms are implemented. Faculty open the academic schedule and choose **Take attendance**, select a roster/radius/duration, then **Open waiting room**. Students use the live attendance banner or **Join attendance room** on their profile. The waiting room shows server-controlled time, live participation, proximity status and attendance results. Closing the room screen does not end the session; reopening it restores the same session. Faculty can end it early with confirmation.

The faculty phone is the BLE anchor; no separate tag is required by this protocol. A compatible phone client must still advertise/connect over BLE and report actual observations. The browser screens do not implement phone-to-phone Bluetooth and explicitly show this limitation. Student submission stays disabled until the server receives a real observation. No browser code fabricates RSSI readings. Faculty anchor tokens are retained in sessionStorage for that tab and removed on manual closure; they are not displayed or placed in URLs.

## Accuracy and trust

Default radius: **1 metre**, configurable per new session with `radius_m` (0.1–100). Default duration: **300 seconds**, configurable with `duration_seconds` (10–3600). Radius is measured from the faculty anchor, not from other students; joining does not extend the cluster boundary.

Ordinary BLE RSSI cannot guarantee a strict physical 1m cutoff. This implementation enforces an **estimated** radius using `10 ** ((tx_power_at_1m - weakest_rssi) / (10 * path_loss_exponent))`. Defaults are -59 dBm at 1m and exponent 2. These are starting assumptions requiring device/room calibration, not universal constants. Every sample must estimate a distance within the limit. Bluetooth connection alone, GPS, and student-supplied distances are not accepted.

RSSI is affected by bodies, walls, orientation and interference. A physically nearby student may fail, and a distant device can appear nearby. Exact ranging requires a supported technology such as Bluetooth Channel Sounding, and compatible clients/hardware. See [Bluetooth SIG](https://www.bluetooth.com/learn-about-bluetooth/feature-enhancements/channel-sounding/).

The faculty client must read RSSI itself from the student's BLE connection, never forward measurements supplied by the student. It receives a secret anchor token once at session creation. Keep it on the faculty device, never advertise it over Bluetooth, and use HTTPS. The server stores only its SHA-256 hash. Challenges bind observations to a session and student but do not prevent radio relays, collusion or sharing a student account. Face verification is not implemented.

Existing application guards accept student/admin identifiers without cryptographic login sessions. College/roster checks and the anchor secret do not repair that inherited authentication weakness. Strong account authentication and trusted faculty-client provisioning are prerequisites for production anti-proxy use. This change does not claim to prove device or human identity.

## API sequence

All paths start with `/api`. Existing student/admin guards apply.

1. Faculty: `POST /admin/academic/schedule/:lectureId/request-attendance` with JSON:

   ```json
   {"student_ids":[1,2,3],"radius_m":1,"duration_seconds":300,"tx_power_at_1m":-59,"path_loss_exponent":2}
   ```

   `student_ids` is required: an explicit class/batch roster, all in the faculty's college. Optional fields use the defaults above. Returns `cluster_id`, `anchor_token`, `started_at`, `ends_at`, `radius_m`, `lecture_id`. Times are Unix milliseconds. The token is never returned by status/list APIs. Sessions cannot be reopened or rescheduled; duplicate starts return 409. Overlapping rosters in the same date/lecture slot are rejected.
2. Student: `GET /academic/attendance/clusters` lists eligible active sessions.
   `GET /academic/attendance/clusters/:id` returns only that student's room state, including `joined_at`, `verified_until`, `attendance_status`, closure state and `server_now` for clock alignment. `POST /academic/attendance/clusters/:id/join` records joining idempotently. Joining never verifies proximity or marks attendance.
3. Student: `POST /academic/attendance/clusters/:id/challenge` returns `student_id`, a random `challenge` and `expires_at`. Transfer these to the faculty phone over BLE. Challenges last at most 30 seconds. A new challenge revokes the previous verification.
4. Faculty anchor collects 5–50 RSSI readings over at least 1 second, then posts `POST /admin/academic/attendance/clusters/:id/observations`, authenticated as the session creator, with `x-attendance-anchor-token` and JSON:

   ```json
   {"student_id":1,"challenge":"challenge-from-step-3","samples":[{"rssi":-55,"observed_at":1800000000100},{"rssi":-56,"observed_at":1800000000400},{"rssi":-56,"observed_at":1800000000700},{"rssi":-55,"observed_at":1800000001000},{"rssi":-57,"observed_at":1800000001300}]}
   ```

   Example timestamps must be replaced with current readings. Samples must be after challenge issuance, strictly increasing, no more than 10 seconds old and not in the server's future (synchronize client clock). Returns `allowed`, estimated `distance_m`, `radius_m`, and `verified_until`. Valid submissions consume the challenge even if outside the radius. Retry through a fresh challenge.
5. Student: `POST /academic/attendance/fill` with `{"cluster_id":"..."}` or `{"lecture_id":1}` records Present only after a successful, fresh observation. Verification expires 10 seconds after the last sample or at session end, whichever occurs first. Requests with raw proximity claims cannot bypass this step. The legacy date/slot-only self-marking path is removed. Students cannot select Absent.
6. Faculty: `GET /admin/academic/attendance/clusters/:id` returns roster, current attendance, counts and audit events. `POST /admin/academic/attendance/clusters/:id/end` closes early.
   `GET /admin/academic/schedule/:lectureId/attendance-cluster` returns `{cluster: null}` before creation or the existing room for reopening, including closed sessions. Roster entries include student names and roll numbers, while student APIs never expose the class roster or anchor secret.

At the deadline all submissions are rejected. A 1-second worker finalizes unaccepted roster members as Absent; startup and cluster requests also finalize overdue sessions. Database writes are transactional and restart-safe. If the service is down, expiry is finalized on restart. Existing register entries (including faculty corrections) take precedence and are not overwritten. Non-roster students are untouched. Being verified alone is insufficient: the student must submit attendance before verification/session expiry. One successful check-in is sufficient; continuous presence is not tracked.

Faculty can correct attendance through the existing register API. Cluster audit events record starts, observations, accepted check-ins, closure and register overrides. Do not delete or reschedule cluster lectures; create a new scheduled slot if needed. Raw RSSI samples and Bluetooth hardware identifiers are not persisted. Configure institutional retention before deployment; this change does not add automatic audit deletion.

## Verification

Run with Node.js 22.12+:

```sh
npm --prefix apps/api run build
node --test apps/api/test/attendance-cluster.test.cjs apps/api/test/attendance-cluster-http.test.cjs
```

Service tests use isolated in-memory databases; the API startup test uses a disposable temporary database. No live database or frontend files are needed.

After building both applications, run `node apps/web/test/attendance-flow.cjs` with Node 22 and an installed Playwright Chromium (Microsoft Edge is used on Windows; override with `PLAYWRIGHT_CHANNEL`). It starts a real API against a disposable database and checks faculty setup/resume, student joining, submission gating, success, session closure and mobile layouts. Synthetic RSSI is confined to this test fixture; the test does not establish real-world Bluetooth accuracy. Screenshots are written under `artifacts/attendance/`.
