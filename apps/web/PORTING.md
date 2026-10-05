# Porting the HTML portals to React + TypeScript

Goal: each React page looks and behaves exactly like the original page in `frontend/` (same URL, same
markup classes/ids, same CSS, same API calls with the same bodies, same texts, same validation, same
navigation). Logic is moved, not redesigned.

## Layout
- `pages/<portal>/<page>.html` — Vite entry HTML at the same URL path as the original
  (`frontend/hospital/hospital.html` -> `pages/hospital/hospital.html`; shared pages go in `pages/shared/`).
  Copy the original `<head>` (meta tags, title, fonts, manifest links) and put `<div id="root"></div>` in body
  plus `<script type="module" src="../../src/pages/<portal>/<page>.main.tsx"></script>`.
  If the body/html element has classes or attributes in the original, keep them on <html>/<body> in the entry HTML.
- `src/pages/<portal>/...` — the page components, hooks and helpers for that portal.
- `src/shared/` — cross-portal code (session, auth guard, nav glider, sidebar badge, …). Do not edit files
  owned by someone else; add new shared helpers only if your brief says you own them.
- `src/styles/` — the ORIGINAL CSS files, copied verbatim (style.css, families.css, hospital.css, patient.css).
  Import them from your entry (`import '../../styles/style.css'`). Page-specific inline `<style>` blocks from the
  original HTML go verbatim into `src/pages/<portal>/<page>.css` and are imported.
- `public/` — static files served at fixed URLs (images, icons, vendor scripts, manifest, sw.js, offline.html).

## Entry
```tsx
// src/pages/hospital/hospital.main.tsx
import '../../styles/hospital.css';
import { mountPage } from '../../shared/mount';
import { HospitalApp } from './HospitalApp';
mountPage(() => <HospitalApp />, { pwa: true /* only if the original loaded /pwa.js */ });
```
`mountPage` runs the auth guard first (same redirects and the same fetch header injection as auth-guard.js),
then renders into #root. Use plain `fetch('/api/...')` exactly like the original; the guard adds the auth headers.

## Shared modules available
- `src/shared/session.ts`  getUser/getAdmin/getPatient/getHospitalAdmin, set*/logout* (same localStorage keys)
- `src/shared/auth-guard.ts` installAuthGuard(), pageKind()
- `src/shared/mount.tsx` mountPage()
- `src/shared/nav-glider.ts` useNavGlider(), toggleNavGroup(id), toggleSidebar(), closeSidebar(),
  updateSidebarGlider(), applyStoredSidebarCollapsed()  (dark-sidebar pages: admin, shared index/register)
- `src/shared/SidebarUserBadge.tsx` <SidebarUserBadge/> — render inside the element with id="authNavArea"
  (replaces renderSidebarUserBadge()).

## React rules
- Real components with typed props and state. No `dangerouslySetInnerHTML` for app markup, no global
  `onclick="..."` strings, no `document.getElementById(...).innerHTML = ...` rendering. Imperative DOM is OK only
  for focus, scrolling, measuring, and purely visual effects.
- Types: interfaces for API payloads you read (fields you use), `strict` mode, no `any` unless unavoidable.
- Keep every user-visible string, class name, id, aria attribute, data-* attribute and inline style that
  affects rendering. Keep element order. The CSS is unchanged, so the DOM structure must match closely.
- Keep the same API calls (method, URL, query params, JSON body), the same order of calls when it matters,
  the same client-side validation and messages, same localStorage/sessionStorage keys, same redirects.
- Charts: `import Chart from 'chart.js/auto'` (same version 4.4.7 as the vendored file) with identical config.

## Verify
`npm run build` in apps/web (tsc + vite) must pass. Then compare against the original with
`tools/ui-parity/harness.mjs` (see its header): build the API once (`cd apps/api && npx tsc -p tsconfig.json`),
write a small script that logs in as the right role, opens each view/tab/modal, and compares screenshots and
visible text at desktop and mobile widths. Target: text identical and pixel diff <= 1% for every view,
no page errors. Also exercise the main write flows (create/edit/delete) on both servers and confirm the same
API requests are made (you can record `page.on('request')`).
