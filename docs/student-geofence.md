# Student village location

In the admin dashboard, use **Student field location** to save the village name,
centre latitude/longitude (decimal degrees), and radius (25–50,000 metres).
College admins set their college's area. An admin without a college sets the
default; a college-specific area overrides that default. This version supports
one circular area per college, not separate assignments for individual villages.

Students open Household Management or Survey Entry and click **Enable location /
Check again**. Forms unlock for 60 seconds after verification. Every field save,
delete, patient provisioning, or campaign status update requests a fresh location
and is checked again by the server. Reading records and managing profile/PIN are
available outside the area. Missing configuration blocks field writes.

Location must be at most 60 seconds old, have reported accuracy within 100 metres,
and its entire accuracy circle must fit within the permitted radius. Permission
denial, timeouts, unavailable GPS, insecure connections, and outside locations
block submission and retain entered form values. Use HTTPS in deployment;
localhost is suitable for development. No coordinates are stored or continuously
tracked. Admin settings persist in SQLite and apply on the next check/save.

Browser location and timestamps are client-reported and can be spoofed. Existing
authentication also accepts identity headers rather than signed sessions; this
feature does not fix that pre-existing authentication limitation. Do not treat
this as tamper-proof attendance evidence. Production hardening requires proper
authenticated sessions and, if needed, a separate device-attestation design.

Run `node --test server/verify-geofence.js`. Tests use an in-memory
database and do not change patient records. Both checked-in application copies
contain the same geofence implementation.
