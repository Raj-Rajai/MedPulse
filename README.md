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
