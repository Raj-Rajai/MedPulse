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

    async issue(req: Request, role: PortalRole, actorId: number): Promise<void> {
        for (const existingRole of ['student', 'admin', 'patient', 'hospital'] as const) {
            await this.revoke(req, existingRole);
        }
        const token = randomBytes(32).toString('hex');
        const now = BigInt(Date.now());
        const lifetime = 30 * 60 * 1000;
        await this.database.portalSession.deleteMany({ where: { expires_at: { lte: now } } });
        await this.database.portalSession.create({
            data: {
                token_hash: hash(token),
                role,
                actor_id: Number(actorId),
                expires_at: now + BigInt(lifetime),
                created_at: now,
            },
        });
        req.res?.cookie(cookieName(role), token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: lifetime,
            path: '/api',
        });
    }

    async resolve(req: Request, role: PortalRole): Promise<number> {
        const token = this.cookie(req, role);
        const session = token && /^[a-f0-9]{64}$/.test(token)
            ? await this.database.portalSession.findFirst({
                where: {
                    token_hash: hash(token),
                    role,
                    expires_at: { gt: BigInt(Date.now()) },
                },
                select: { actor_id: true },
            })
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

    async revoke(req: Request, role: PortalRole): Promise<void> {
        const token = this.cookie(req, role);
        if (token) {
            await this.database.portalSession.deleteMany({
                where: { token_hash: hash(token), role },
            });
        }
        req.res?.clearCookie(cookieName(role), {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/api',
        });
    }
}
