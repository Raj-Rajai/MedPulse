/**
 * SQLite rows come back as null-prototype objects. `clean`/`cleanList` copy them into
 * plain objects so they serialise and spread exactly like the original Express code did.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const clean = <T extends Row = Row>(row: unknown): T | null => (row ? ({ ...(row as Row) } as T) : null);

export const cleanList = <T extends Row = Row>(rows: unknown[]): T[] => rows.map((r) => ({ ...(r as Row) }) as T);
