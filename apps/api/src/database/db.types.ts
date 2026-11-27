import type { Prisma, PrismaClient } from '@prisma/client';
import type { Row } from '../common/row';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ExecuteResult {
    changes: number;
}

export interface InsertResult {
    changes: number;
    lastInsertRowid: number;
}

export type PrismaTx = Prisma.TransactionClient;

/**
 * Async PostgreSQL database interface backed by PrismaClient.
 * Supports both raw PostgreSQL queries ($1, $2, ...) and typed Prisma models.
 */
export interface Db {
    readonly prisma: PrismaClient | PrismaTx;
    queryOne<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined>;
    queryAll<T = Row>(sql: string, ...params: unknown[]): Promise<T[]>;
    execute(sql: string, ...params: unknown[]): Promise<ExecuteResult>;
    insert(sql: string, ...params: unknown[]): Promise<InsertResult>;
    inTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
