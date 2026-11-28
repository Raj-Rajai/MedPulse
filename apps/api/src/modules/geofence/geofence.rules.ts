/** Pure geofence rules, unchanged from backend/services/geofence.service.js */

export interface Area {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    enabled?: boolean | number;
}

export interface FieldLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

const protectedPath =
    /^\/(?:families|members|conditions|medications|allergies|history|follow-ups)(?:\/|$)|^\/students\/provision-patient\/?$|^\/student\/campaign-tasks(?:\/|$)/;

/** `path` is relative to the /api mount, e.g. `/families/3`. */
export function isFieldWrite(method: string, path: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && protectedPath.test(path);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validArea(a: any): a is Area {
    return (
        a &&
        typeof a.name === 'string' &&
        a.name.trim().length > 0 &&
        a.name.length <= 120 &&
        Number.isFinite(Number(a.latitude)) &&
        Math.abs(Number(a.latitude)) <= 90 &&
        Number.isFinite(Number(a.longitude)) &&
        Math.abs(Number(a.longitude)) <= 180 &&
        Number.isFinite(Number(a.radius)) &&
        Number(a.radius) >= 25 &&
        Number(a.radius) <= 50000
    );
}

export function computeDistanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = (n: number) => (n * Math.PI) / 180;
    const h =
        Math.sin(rad(lat2 - lat1) / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkLocation(area: any, location: any, now = Date.now()): string | null {
    if (area && (area.enabled === false || area.enabled === 0)) return null;
    if (!validArea(area)) return 'Your administrator must configure a village area before you can save field records.';
    if (
        !location ||
        !['latitude', 'longitude', 'accuracy', 'timestamp'].every((k) => Number.isFinite(location[k])) ||
        Math.abs(location.latitude) > 90 ||
        Math.abs(location.longitude) > 180 ||
        location.accuracy < 0
    ) {
        return 'A valid current location is required. Enable location permission and try again.';
    }
    const loc = location as FieldLocation;
    if (now - loc.timestamp > 300000 || loc.timestamp > now + 30000) return 'Your location has expired. Check your device clock and try again.';
    const distance = computeDistanceMetres(Number(area.latitude), Number(area.longitude), loc.latitude, loc.longitude);
    if (distance > Number(area.radius)) {
        return `Your location cannot be confirmed inside the village area (${area.name}: ${Math.round(distance)}m away, allowed radius ${area.radius}m). Only Read (R) operations are permitted outside the designated area.`;
    }
    return null;
}
