import * as path from 'node:path';
import express, { Express, Request, Response } from 'express';
import { REPO_ROOT } from '../database/paths';

/**
 * Page routes + static folders for the four portals and the shared pages.
 * Mirrors backend/portals/*.portal.js and the static/alias routes in backend/server.js.
 *
 * FRONTEND_DIR points at the built React portals (default: <repo>/apps/web/dist). When the React build
 * replaces a portal, its route here is switched to the React bundle.
 */
export const FRONTEND_DIR = process.env.MEDPULSE_FRONTEND_DIR
    ? path.resolve(process.env.MEDPULSE_FRONTEND_DIR)
    : path.join(REPO_ROOT, 'apps', 'web', 'dist');

export const SHARED_DIR = path.join(FRONTEND_DIR, 'shared');
export const SPA_INDEX = path.join(SHARED_DIR, 'index.html');

export function registerPortals(app: Express): void {
    // ADMIN portal
    {
        const dir = path.join(FRONTEND_DIR, 'admin');
        app.get(['/admin', '/admin/'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'admin.html')));
        app.get(['/admin/admin.html', '/admin.html'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'admin.html')));
        app.get('/admin/login', (_req: Request, res: Response) => res.redirect('/login.html?admin=1'));
        app.use('/admin', express.static(dir));
    }
    // HOSPITAL portal
    {
        const dir = path.join(FRONTEND_DIR, 'hospital');
        app.get(['/hospital', '/hospital/'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'hospital.html')));
        app.get(['/hospital/hospital.html', '/hospital.html'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'hospital.html')));
        app.get('/hospital/login', (_req: Request, res: Response) => res.redirect('/login.html?hospital=1'));
        app.use('/hospital', express.static(dir));
    }
    // PATIENT portal
    {
        const dir = path.join(FRONTEND_DIR, 'patient');
        app.get(['/patient', '/patient/'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'patient.html')));
        app.get(['/patient/patient.html', '/patient.html'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'patient.html')));
        app.get('/patient/login', (_req: Request, res: Response) => res.redirect('/login.html?patient=1'));
        app.use('/patient', express.static(dir));
    }
    // STUDENT portal
    {
        const dir = path.join(FRONTEND_DIR, 'student');
        app.get(['/student', '/student/'], (_req: Request, res: Response) => res.sendFile(path.join(dir, 'profile.html')));
        for (const page of ['index', 'family-manage', 'entry', 'analytics', 'exams', 'profile', 'schedule']) {
            app.get([`/student/${page}.html`, `/${page}.html`], (_req: Request, res: Response) => res.sendFile(path.join(dir, `${page}.html`)));
        }
        app.get(['/student/attendance.html', '/attendance.html', '/attendance'], (_req: Request, res: Response) => res.redirect('/profile.html'));
        app.get('/student/login', (_req: Request, res: Response) => res.redirect('/login.html'));
        app.use('/student', express.static(dir));
    }

    // Default root route opens student profile directly
    app.get('/', (_req: Request, res: Response) => res.redirect('/profile.html'));

    // Public Auth Aliases
    app.get('/login', (_req: Request, res: Response) => res.redirect('/login.html'));
    app.get('/register', (_req: Request, res: Response) => res.redirect('/register.html'));

    // Shared frontend assets (styles, scripts, icons, vendor, login, index)
    app.use(express.static(SHARED_DIR));
    // Legacy public directory for full fallback safety
    app.use(express.static(path.join(FRONTEND_DIR, '..', 'public')));
}
