# MedPulse (TypeScript)

TypeScript rewrite of MedPulse: **NestJS** API (`apps/api`) and **React** portals (`apps/web`).
The original Express app is the reference; the API is checked against it request by request (see *Parity check*).

## Layout
```
apps/api/            NestJS API (TypeScript)
  src/main.ts          server entry: body parsers, portal pages, /api prefix
  src/database/        SQLite connection, schema modules, Roll 235 seeder
  src/auth/            student / admin / patient / hospital guards + access checks
  src/common/          error rendering, JSON adapter, pre-route middleware (geofence, FAP auth)
  src/modules/<domain> one Nest module per domain: admin, campaign, college, engagement, export,
                       geofence, hospital, patient, student, survey
  PORTING.md           conventions used for the port
apps/web/            React + Vite portals: all portals are ported (student, admin, patient, hospital,
                       login/register/home); `npm start` serves the React build (apps/web/dist)
database/            seed JSON + SQL references; health_survey.db lives here at runtime
tools/parity/        replays ~350 requests against the original and the new API and diffs them
tools/ui-parity/     screenshot harness comparing original HTML pages with the React pages
```

## Run
```bash
npm install
npm run build
cp /path/to/your/health_survey.db database/   # or let it create a fresh one
npm start                                      # http://localhost:3000
```
Environment: `PORT`, `MEDPULSE_DB_PATH`, `MEDPULSE_FRONTEND_DIR`, `MEDPULSE_ROOT`.

## Member identity on local and hosted servers

The backend assigns every saved family member a permanent `medpulse_id` (for example,
`MP-00000001`). A startup migration backfills existing members and installs a database-wide
unique index and assignment/immutability triggers. This applies to all students, bulk family
creation, and patient-added members. The browser displays the API value; it never allocates IDs.
The database assigns and checks the ID atomically during insertion, so concurrent requests
cannot reserve the same ID. A failed insert does not return a member or an assigned ID.

Deploy the backend and frontend together and restart the backend to apply the migration.
Use one persistent SQLite database for the deployment, set `MEDPULSE_DB_PATH` to that file on a
persistent volume, and retain it across deployments and restarts. The supplied free Render
configuration does not configure a persistent volume; configure persistent storage before using
it for live data. Independent SQLite files are independent databases, not a shared ID registry.

Identity checks (Node 22.5+ after building the API):
```bash
npm --prefix apps/api run build
node --test apps/api/test/member-identity.test.cjs
```

## Parity check
```bash
npm run build
node tools/parity/run.mjs --legacy "/path/to/unzipped/MedPulse-before-typescript/MedPulse" --db /path/to/health_survey.db [--verbose]
```
Starts both servers on private copies of the same database, sends every request in
`tools/parity/scenario.mjs` to both, and compares status, headers and JSON bodies
(clock timestamps and random IDs are masked). The bug fixes listed in `tools/parity/intended.mjs`
are the only expected differences; `--strict` reports them too.

The original Express backend and HTML pages are in `MedPulse-before-typescript.zip` / `docs/README-original.md`.
