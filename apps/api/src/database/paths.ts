import * as path from 'node:path';

/** Repository root (…/medpulse-ts). Works from both src/ and dist/. */
export const REPO_ROOT = process.env.MEDPULSE_ROOT
    ? path.resolve(process.env.MEDPULSE_ROOT)
    : path.resolve(__dirname, '..', '..', '..', '..');

export const DATABASE_DIR = path.join(REPO_ROOT, 'database');

export const DB_PATH = process.env.MEDPULSE_DB_PATH
    ? path.resolve(process.env.MEDPULSE_DB_PATH)
    : path.join(DATABASE_DIR, 'health_survey.db');
