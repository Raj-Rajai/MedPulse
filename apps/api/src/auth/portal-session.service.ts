import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { fail } from '../common/http-error';

export type PortalRole = 'student' | 'admin' | 'patient' | 'hospital';
const cookieName = (role: PortalRole) => `mp_${role}_session`;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function publicIdentity<T extends Record<string, any>>(row: T): Omit<T, 'pin'> {
    const { pin: _pin, ...safe } = row;
    return safe;
}

@Injectable()
export class PortalSessionService {
    constructor(private readonly database: DatabaseService) {}
    private cookie(req: Request, role: PortalRole): string | undefined {
        const prefix = cookieName(role) + '=';
        return req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
    }
    issue(req: Request, role: PortalRole, actorId: number): void {
        for (const existingRole of ['student', 'admin', 'patient', 'hospital'] as const) this.revoke(req, existingRole);
        const token = randomBytes(32).toString('hex');
        const now = Date.now();
        const lifetime = 30 * 60 * 1000;
        this.database.db.prepare('DELETE FROM portal_sessions WHERE expires_at <= ?').run(now);
        this.database.db.prepare('INSERT INTO portal_sessions VALUES (?, ?, ?, ?, ?)').run(hash(token), role, actorId, now + lifetime, now);
        req.res?.cookie(cookieName(role), token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: lifetime, path: '/api' });
    }
    resolve(req: Request, role: PortalRole): number {
        const token = this.cookie(req, role);
        const session = token && /^[a-f0-9]{64}$/.test(token)
            ? this.database.db.prepare('SELECT actor_id FROM portal_sessions WHERE token_hash = ? AND role = ? AND expires_at > ?').get(hash(token), role, Date.now())
            : null;
        if (!session) throw fail(401, 'Your session has expired. Please sign in again.');
        const method = req.method?.toUpperCase();
        if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method) && req.headers.origin) {
            let origin: string;
            try { origin = new URL(req.headers.origin).host; } catch { throw fail(403, 'Invalid request origin.'); }
            if (origin !== req.headers.host) throw fail(403, 'Cross-origin changes are not allowed.');
        }
        req.res?.setHeader('Cache-Control', 'no-store, private');
        return Number(session.actor_id);
    }
    revoke(req: Request, role: PortalRole): void {
        const token = this.cookie(req, role);
        if (token) this.database.db.prepare('DELETE FROM portal_sessions WHERE token_hash = ? AND role = ?').run(hash(token), role);
        req.res?.clearCookie(cookieName(role), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api' });
    }
}
