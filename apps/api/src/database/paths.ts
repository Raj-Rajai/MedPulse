import * as path from 'node:path';

/** Repository root (…/Project-X). Works from both src/ and dist/. */
export const REPO_ROOT = process.env.MEDPULSE_ROOT
    ? path.resolve(process.env.MEDPULSE_ROOT)
    : path.resolve(__dirname, '..', '..', '..', '..');

export const DATABASE_DIR = path.join(REPO_ROOT, 'database');
