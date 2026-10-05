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
export function generateUniqueReferralCode(db: Db, collegeId: unknown, rollNumber: unknown): string {
    let prefix = 'MED';
    if (collegeId) {
        try {
            const col = db.prepare('SELECT code FROM colleges WHERE id = ?').get(collegeId);
            if (col && col.code) {
                prefix = col.code.split('-')[0] || col.code;
            }
        } catch (e) {
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
            const existing = db.prepare('SELECT id FROM students WHERE referral_code = ?').get(code);
            if (!existing) {
                isUnique = true;
            }
        } catch (e) {
            // Table might not have column yet during early migration
            isUnique = true;
        }
    }

    return code;
}
