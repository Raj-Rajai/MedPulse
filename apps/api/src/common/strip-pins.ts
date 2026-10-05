/**
 * FIX (security): the original API sent stored PINs back in many responses (student/admin/hospital/patient
 * login, /auth/me, profiles, lists). Every JSON response now has `pin` fields removed, except where the
 * PIN is a credential the caller just issued and must hand over (student provisioning a patient account).
 */
const KEEP_PIN_PATHS = [/^\/api\/students\/provision-patient\/?$/i];

export function keepsPins(path: string): boolean {
    return KEEP_PIN_PATHS.some((re) => re.test(path));
}

export function stripPins<T>(value: T): T {
    if (Array.isArray(value)) return value.map((v) => stripPins(v)) as T;
    const proto = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    if (proto === Object.prototype || proto === null) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (k === 'pin') continue;
            out[k] = stripPins(v);
        }
        return out as T;
    }
    return value;
}
