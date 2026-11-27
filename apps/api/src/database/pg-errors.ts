/**
 * Detects PostgreSQL / Prisma unique constraint violations across both
 * typed Prisma queries (P2002) and raw SQL queries (P2010 + code 23505).
 */
export function isUniqueConstraintError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: string; meta?: { code?: string }; message?: string };
    if (e.code === 'P2002') return true;
    if (e.code === 'P2010' && e.meta?.code === '23505') return true;
    if (e.code === '23505') return true;
    const msg = e.message || '';
    return /unique constraint|duplicate key value violates unique|23505/i.test(msg);
}
