const protectedPath = /^\/(?:families|members|conditions|medications|allergies|history|follow-ups)(?:\/|$)|^\/students\/provision-patient\/?$|^\/student\/campaign-tasks(?:\/|$)/;
function isFieldWrite(method, path) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && protectedPath.test(path);
}
function validArea(a) {
    return a && typeof a.name === 'string' && a.name.trim().length > 0 && a.name.length <= 120 &&
        Number.isFinite(a.latitude) && Math.abs(a.latitude) <= 90 &&
        Number.isFinite(a.longitude) && Math.abs(a.longitude) <= 180 &&
        Number.isFinite(a.radius) && a.radius >= 25 && a.radius <= 50000;
}
function checkLocation(area, location, now = Date.now()) {
    if (!validArea(area)) return 'Your administrator must configure a village area before you can save field records.';
    if (!location || !['latitude', 'longitude', 'accuracy', 'timestamp'].every(k => Number.isFinite(location[k])) ||
        Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180 || location.accuracy < 0) {
        return 'A valid current location is required. Enable location permission and try again.';
    }
    if (now - location.timestamp > 60000 || location.timestamp > now + 10000) return 'Your location has expired. Check your device clock and try again.';
    if (location.accuracy > 100) return 'Location accuracy is too low. Move outdoors and try again.';
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(location.latitude - area.latitude) / 2) ** 2 +
        Math.cos(rad(area.latitude)) * Math.cos(rad(location.latitude)) * Math.sin(rad(location.longitude - area.longitude) / 2) ** 2;
    const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    if (distance + location.accuracy > area.radius) return 'Your location cannot be confirmed inside the village area. Move further inside the boundary and try again.';
    return null;
}
module.exports = { isFieldWrite, validArea, checkLocation };
