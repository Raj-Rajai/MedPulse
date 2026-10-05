/**
 * Student field-location (village geofence) editor, ported from frontend/shared/admin-geofence.js.
 * That script appended this card to <main> on DOMContentLoaded. NOTE: the original admin.html never
 * loads admin-geofence.js, so AdminApp keeps it switched off (SHOW_GEOFENCE_PANEL) to stay identical.
 */
import { useEffect, useState } from 'react';
import { errMessage } from '../lib/http';

interface Area { name: string; latitude: number | string; longitude: number | string; radius: number | string }
interface GeofenceResponse { scope?: string; area?: Area | null; error?: string }

const EMPTY = { name: '', latitude: '', longitude: '', radius: '' };

export function GeofencePanel() {
    const [form, setForm] = useState(EMPTY);
    const [scope, setScope] = useState('');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch('/api/admin/geofence', { cache: 'no-store' });
                const data = (await response.json()) as GeofenceResponse;
                if (!response.ok) throw new Error(data.error || 'Unable to load boundary.');
                setScope(`Applies to: ${data.scope}. College-specific boundaries override the default.`);
                if (data.area) {
                    const a = data.area;
                    setForm({ name: String(a.name), latitude: String(a.latitude), longitude: String(a.longitude), radius: String(a.radius) });
                } else {
                    setStatus('No boundary configured. Student field submissions are blocked until you save one.');
                }
            } catch (error) {
                setStatus(errMessage(error));
            }
        })();
    }, []);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            const area = { name: form.name, latitude: Number(form.latitude), longitude: Number(form.longitude), radius: Number(form.radius) };
            const response = await fetch('/api/admin/geofence', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(area) });
            const data = (await response.json()) as GeofenceResponse;
            if (!response.ok) throw new Error(data.error || 'Unable to save boundary.');
            setStatus('Village boundary saved. It applies to the next student location check and submission.');
        } catch (error) {
            setStatus(errMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

    return (
        <section className="card" style={{ padding: 20, margin: '20px 0' }}>
            <h2>Student field location</h2>
            <p>Set the village centre and permitted radius. Students must allow location access and be inside this area to enter and save field records. GPS accuracy must be within 100 metres and the reported accuracy circle must fit inside the boundary.</p>
            <p data-scope="">{scope}</p>
            <form style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }} onSubmit={submit}>
                <label>Village name<input className="form-control" name="name" required maxLength={120} value={form.name} onChange={set('name')} /></label>
                <label>Latitude<input className="form-control" name="latitude" type="number" min="-90" max="90" step="any" required value={form.latitude} onChange={set('latitude')} /></label>
                <label>Longitude<input className="form-control" name="longitude" type="number" min="-180" max="180" step="any" required value={form.longitude} onChange={set('longitude')} /></label>
                <label>Radius (metres)<input className="form-control" name="radius" type="number" min="25" max="50000" step="any" required value={form.radius} onChange={set('radius')} /></label>
                <button className="btn btn-primary" type="submit" disabled={busy}>Save village boundary</button>
            </form>
            <p role="status" aria-live="polite" data-status="">{status}</p>
        </section>
    );
}
