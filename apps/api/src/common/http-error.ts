/**
 * An error that is rendered verbatim: `res.status(status).json(body)`.
 * Controllers throw it wherever the original Express handler wrote a non-2xx response,
 * so every status code and JSON body stays byte-for-byte the same.
 */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: unknown,
    ) {
        super(typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${status}`);
    }
}

/** Shorthand for the `{ error }` bodies used across the API. */
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}): HttpError =>
    new HttpError(status, { error, ...extra });

/**
 * Model-layer error that carries an HTTP status (the original `ModelError` / `PatientError` classes).
 * Anything thrown without a numeric status is treated as a 500.
 */
export class StatusError extends Error {
    constructor(
        message: string,
        public readonly status: number = 400,
    ) {
        super(message);
    }
}

/** Status code carried by a thrown error, defaulting to 500 like the original `handle()` helpers. */
export const statusOf = (err: unknown): number => {
    const s = (err as { status?: unknown })?.status;
    return Number.isInteger(s) ? (s as number) : 500;
};

/**
 * Used in `catch` blocks: an HttpError raised inside the `try` passes through untouched,
 * anything else becomes the original `res.status(500).json({ error: prefix + err.message })`.
 */
export const serverError = (err: unknown, prefix = ''): HttpError =>
    err instanceof HttpError ? err : fail(500, prefix + (err as Error)?.message);
