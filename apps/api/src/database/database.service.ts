import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Row } from '../common/row';
import type { Db, ExecuteResult, InsertResult, PrismaTx } from './db.types';
import { REPO_ROOT } from './paths';
import { ensurePostgresTriggers } from './pg-triggers';

// Load .env from repo root (or apps/api) if DATABASE_URL isn't already set
if (!process.env.DATABASE_URL) {
    const candidates = [
        path.join(REPO_ROOT, '.env'),
        path.join(REPO_ROOT, 'apps', 'api', '.env'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            dotenv.config({ path: candidate });
            break;
        }
    }
}

function normalizeValue(val: unknown): unknown {
    if (typeof val === 'bigint') {
        if (val >= BigInt(Number.MIN_SAFE_INTEGER) && val <= BigInt(Number.MAX_SAFE_INTEGER)) {
            return Number(val);
        }
        return val.toString();
    }
    if (val instanceof Date) {
        return val.toISOString();
    }
    if (val && typeof val === 'object' && typeof (val as { toNumber?: () => number }).toNumber === 'function') {
        return (val as { toNumber: () => number }).toNumber();
    }
    if (Array.isArray(val)) {
        return val.map(normalizeValue);
    }
    return val;
}

function normalizeRow<T = Row>(row: unknown): T {
    if (!row || typeof row !== 'object') return row as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        out[k] = normalizeValue(v);
    }
    return out as T;
}

function createDbAdapter(client: PrismaClient | PrismaTx, rootClient: PrismaClient): Db {
    const adapter: Db = {
        prisma: client,
        async queryOne<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
            const rows = await client.$queryRawUnsafe<unknown[]>(sql, ...params);
            return rows.length > 0 ? normalizeRow<T>(rows[0]) : undefined;
        },
        async queryAll<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
            const rows = await client.$queryRawUnsafe<unknown[]>(sql, ...params);
            return rows.map((r) => normalizeRow<T>(r));
        },
        async execute(sql: string, ...params: unknown[]): Promise<ExecuteResult> {
            const changes = await client.$executeRawUnsafe(sql, ...params);
            return { changes: Number(changes) };
        },
        async insert(sql: string, ...params: unknown[]): Promise<InsertResult> {
            const hasReturning = /\bRETURNING\b/i.test(sql);
            const finalSql = hasReturning ? sql : `${sql.replace(/;\s*$/, '')} RETURNING id`;
            const rows = await client.$queryRawUnsafe<Array<{ id?: number | bigint }>>(finalSql, ...params);
            const rawId = rows[0]?.id;
            const lastInsertRowid = typeof rawId === 'bigint' ? Number(rawId) : Number(rawId ?? 0);
            return { changes: rows.length, lastInsertRowid };
        },
        async inTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
            // If we're already inside an interactive transaction client, reuse it.
            if (client !== rootClient) {
                return fn(adapter);
            }
            return rootClient.$transaction(
                async (txClient) => fn(createDbAdapter(txClient, rootClient)),
                { maxWait: 10000, timeout: 30000 },
            );
        },
    };
    return adapter;
}

/**
 * Owns the Prisma PostgreSQL connection pool and provides both typed Prisma
 * models (via `DatabaseService extends PrismaClient`) and the async `Db`
 * helper (`this.db`) for raw PostgreSQL queries and transactions.
 */
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    readonly db: Db;

    constructor() {
        super();
        this.db = createDbAdapter(this, this);
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
        try {
            await ensurePostgresTriggers(this);
        } catch (err) {
            console.warn('⚠️ Could not ensure PostgreSQL triggers on startup:', (err as Error)?.message || err);
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}
