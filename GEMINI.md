# MedPulse Project Guidelines

## 1. Strict Frontend-Only Scope (Merge Conflict Prevention)
- **NO Backend Changes**: Under NO circumstances should any backend files (including `apps/api/`, `backend/`, `server/`, backend database migrations, and backend schemas) be edited, added, or deleted.
- **Frontend-Only Edits**: All changes, UI improvements, bug fixes, client validations, and mock responses must be implemented strictly on the frontend side (`apps/web/`, `frontend/`, `public/`).
- If an API response structure or field is missing, adapt and handle it gracefully on the frontend side without modifying any backend files.

## 2. Git Branch & Push Invariants
- Direct commits and pushes to `main` (`origin main`) are permitted as directed by the user.
