import type { Row } from '../common/row';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
}

export interface Statement {
    get(...params: any[]): Row | undefined;
    all(...params: any[]): Row[];
    run(...params: any[]): RunResult;
}

/** The subset of `node:sqlite` DatabaseSync (or better-sqlite3) the app uses. */
export interface Db {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
}

export interface SchemaModule {
    name?: string;
    apply(db: Db): void;
}
