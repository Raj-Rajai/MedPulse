import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Db } from './db.types';
import { DB_PATH } from './paths';
import { SCHEMAS } from './schemas';

function openDatabase(file: string): Db {
    // Prefer Node's built-in SQLite; fall back to better-sqlite3 on older runtimes (same as the original db.js).
    let DatabaseSync: new (file: string) => Db;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ({ DatabaseSync } = require('node:sqlite'));
    } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && code !== 'MODULE_NOT_FOUND') throw err;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        DatabaseSync = require('better-sqlite3');
    }
    return new DatabaseSync(file);
}

/**
 * Owns the single SQLite connection. Schemas are applied in the constructor so the
 * database is ready before any other provider (seeder, models) touches it.
 */
@Injectable()
export class DatabaseService {
    readonly db: Db;
    readonly path = DB_PATH;

    constructor() {
        const dir = path.dirname(this.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = openDatabase(this.path);
        // Enable foreign key constraints
        this.db.exec('PRAGMA foreign_keys = ON;');

        try {
            SCHEMAS.forEach((schema) => schema.apply(this.db));
        } catch (err) {
            console.error('❌ Error initializing database:', err);
            throw err;
        }
    }
}
