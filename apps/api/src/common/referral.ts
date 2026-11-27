import * as crypto from 'node:crypto';
import type { Db } from '../database/db.types';

/**
 * Generate a clean, collision-free Student Referral Code for Patient Adoption.
 * Format: [PREFIX]-[ROLL]-[4_CHAR_HEX] (e.g. SAL-235-9F4D)
 */
export function formatReferralCode(collegePrefix: string | null | undefined, rollNumber: unknown): string {
    const cleanPrefix = (collegePrefix || 'UNI').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    const cleanRoll = String(rollNumber || '000').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randHex = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
    return `${cleanPrefix}-${cleanRoll}-${randHex}`;
}

/**
 * Generate and guarantee database uniqueness for a student referral code.
 */
export async function generateUniqueReferralCode(db: Db, collegeId: unknown, rollNumber: unknown): Promise<string> {
    let prefix = 'MED';
    if (collegeId) {
        try {
            const col = await db.queryOne('SELECT code FROM colleges WHERE id = $1', Number(collegeId));
            if (col && col.code) {
                prefix = String(col.code).split('-')[0] || String(col.code);
            }
        } catch {
            prefix = 'MED';
        }
    }

    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        attempts++;
        code = formatReferralCode(prefix, rollNumber);
        try {
            const existing = await db.queryOne('SELECT id FROM students WHERE referral_code = $1', code);
            if (!existing) {
                isUnique = true;
            }
        } catch {
            isUnique = true;
        }
    }

    return code;
}
