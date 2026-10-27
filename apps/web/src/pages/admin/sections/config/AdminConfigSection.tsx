/**
 * Admin Config: academic years (sessions such as 2026-2027) and the field area for each one.
 * Students can enter or save field records only inside their academic year's area; a year without
 * its own area uses the default area. Both are enforced by the API on every field write.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalOverlay, closeBtnStyle, modalFootStyle, modalHeadStyle, twoColStyle } from '../../components/ModalOverlay';
import { useToast } from '../../hooks/useToasts';
import { isCurrent } from '../../lib/academic';
import { errMessage, readJson, sendJson } from '../../lib/http';
import type { AcademicYear, FieldArea } from '../../types';

/** The list entry that edits the default area. */
const DEFAULT = 'default';
const EMPTY_AREA = { name: '', latitude: '', longitude: '', radius: '500' };
const RADIUS_PRESETS = [250, 500, 1000, 2000];

const radiusText = (r: number | string) => (Number(r) >= 1000 ? `${Number(r) / 1000} km` : `${Number(r)} m`);
const hasArea = (y: AcademicYear) => !!y.area_name && y.latitude !== null && y.latitude !== undefined;
const areaOfYear = (y: AcademicYear): FieldArea | null =>
    hasArea(y) ? { name: String(y.area_name), latitude: Number(y.latitude), longitude: Number(y.longitude), radius: Number(y.radius) } : null;
const formOf = (a: FieldArea | null) => (a ? { name: String(a.name), latitude: String(a.latitude), longitude: String(a.longitude), radius: String(a.radius) } : EMPTY_AREA);

/** OpenStreetMap embed framing the circle (bbox a little larger than the radius). */
function mapUrl(lat: number, lng: number, radius: number) {
    const dLat = (radius * 1.6) / 111320;
    const dLng = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(6)).join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

async function call(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    const res = method === 'DELETE' ? await fetch(url, { method }) : await sendJson(url, method, body);
    const data = await readJson<{ unassigned_students?: number }>(res);
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

/* ---------------- Add / edit academic year ---------------- */
const YEAR_DEFAULTS = { label: '', start: '', end: '', current: false };

function nextLabel(years: AcademicYear[]) {
    const starts = years.map((y) => Number(y.label.slice(0, 4))).filter(Number.isFinite);
    const start = starts.length ? Math.max(...starts) + 1 : new Date().getFullYear();
    return `${start}-${start + 1}`;
}

function YearModal({ open, year, years, onClose, onSaved }: { open: boolean; year: AcademicYear | null; years: AcademicYear[]; onClose: () => void; onSaved: () => void }) {
    const showToast = useToast();
    const [f, setF] = useState(YEAR_DEFAULTS);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (year) setF({ label: year.label, start: year.start_date || '', end: year.end_date || '', current: isCurrent(year) });
        else {
            const label = nextLabel(years);
            setF({ label, start: `${label.slice(0, 4)}-07-01`, end: `${label.slice(5)}-06-30`, current: false });
        }
    }, [open, year]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const body = { label: f.label.trim(), start_date: f.start || null, end_date: f.end || null, is_current: f.current };
            if (year) await call(`/api/admin/academic-years/${year.id}`, 'PUT', body);
            else await call('/api/admin/academic-years', 'POST', body);
            showToast(year ? `Academic year ${body.label} updated.` : `Academic year ${body.label} added.`, 'success');
            onClose();
            onSaved();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="academicYearModal" open={open} onClose={onClose} contentStyle={{ maxWidth: 460 }}>
            <div style={modalHeadStyle}>
                <h2>{year ? 'Edit academic year' : 'Add academic year'}</h2>
                <button className="btn btn-secondary" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
            </div>
            <form onSubmit={submit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                    <label htmlFor="ayLabel">Academic year</label>
                    <input id="ayLabel" required pattern="\d{4}-\d{4}" placeholder="2026-2027" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
                </div>
                <div style={twoColStyle}>
                    <div className="form-group">
                        <label htmlFor="ayStart">Starts</label>
                        <input id="ayStart" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ayEnd">Ends</label>
                        <input id="ayEnd" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
                    </div>
                </div>
                <label className="mm-check">
                    <input type="checkbox" checked={f.current} onChange={(e) => setF({ ...f, current: e.target.checked })} />
                    <span>Current academic year (new students are added to it)</span>
                </label>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : year ? 'Save changes' : 'Add academic year'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}

/* ---------------- Page ---------------- */
export function AdminConfigSection({ active, years, defaultArea, onChanged }: {
    active: boolean;
    years: AcademicYear[] | null;
    defaultArea: FieldArea | null;
    /** Reload academic years (and students) after any change. */
    onChanged: () => void;
}) {
    const showToast = useToast();
    const [selected, setSelected] = useState<string>('');
    const [form, setForm] = useState(EMPTY_AREA);
    const [busy, setBusy] = useState(false);
    const [locating, setLocating] = useState(false);
    const [modal, setModal] = useState<{ open: boolean; year: AcademicYear | null }>({ open: false, year: null });

    const list = years || [];
    const selectedYear = list.find((y) => String(y.id) === selected) || null;

    // Start on the current year once the list arrives (or the default area when there are none).
    useEffect(() => {
        if (!years || (selected && (selected === DEFAULT || selectedYear))) return;
        const first = years.find(isCurrent) || years[0];
        setSelected(first ? String(first.id) : DEFAULT);
    }, [years]);

    const savedArea = useMemo(() => (selected === DEFAULT ? defaultArea : selectedYear ? areaOfYear(selectedYear) : null), [selected, selectedYear, defaultArea]);
    useEffect(() => { setForm(formOf(savedArea)); }, [selected, savedArea?.name, savedArea?.latitude, savedArea?.longitude, savedArea?.radius]);

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radius);
    const valid = form.name.trim().length > 0 && form.latitude !== '' && form.longitude !== ''
        && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
        && Number.isFinite(radius) && radius >= 25 && radius <= 50000;
    const dirty = !savedArea || form.name.trim() !== String(savedArea.name) || lat !== Number(savedArea.latitude) || lng !== Number(savedArea.longitude) || radius !== Number(savedArea.radius);
    const set = (k: keyof typeof EMPTY_AREA) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

    const useMyLocation = () => {
        if (!navigator.geolocation) {
            showToast('This browser cannot read your location.', 'error');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
                setLocating(false);
                showToast(`Location filled in (accurate to about ${Math.round(pos.coords.accuracy)} m).`, 'success');
            },
            (err) => {
                setLocating(false);
                showToast(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not read your location.', 'error');
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    const saveArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        try {
            const area = { name: form.name.trim(), latitude: lat, longitude: lng, radius };
            if (selected === DEFAULT) await call('/api/admin/geofence', 'PUT', area);
            else if (selectedYear) await call(`/api/admin/academic-years/${selectedYear.id}/area`, 'PUT', area);
            showToast(selected === DEFAULT ? 'Default field area saved.' : `Field area saved for ${selectedYear?.label}.`, 'success');
            onChanged();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const removeArea = async () => {
        if (!selectedYear || !hasArea(selectedYear)) return;
        if (!confirm(`Remove the field area for ${selectedYear.label}? Its students will use the default area${defaultArea ? ` (${defaultArea.name})` : ', which is not set, so they will be blocked from saving field records'}.`)) return;
        setBusy(true);
        try {
            await call(`/api/admin/academic-years/${selectedYear.id}/area`, 'DELETE');
            showToast(`Field area removed for ${selectedYear.label}.`, 'success');
            onChanged();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const deleteYear = async (y: AcademicYear) => {
        const note = y.students_count ? ` Its ${y.students_count} students will become unassigned.` : '';
        if (!confirm(`Delete academic year ${y.label}?${note}`)) return;
        try {
            await call(`/api/admin/academic-years/${y.id}`, 'DELETE');
            showToast(`Academic year ${y.label} deleted.`, 'success');
            if (selected === String(y.id)) setSelected('');
            onChanged();
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    };

    const title = selected === DEFAULT ? 'Default area' : selectedYear ? `Field area · ${selectedYear.label}` : 'Field area';

    return (
        <div id="viewConfig" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="mm-split mm-split-even">
                <div className="card">
                    <div className="mm-card-head">
                        <div>
                            <h2 className="card-title">Academic years</h2>
                            <p className="card-desc">Sessions such as 2026-2027. Pick one to set where its students may enter data.</p>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, year: null })}>➕ Add year</button>
                    </div>

                    <ul className="mm-list mm-select-list" role="listbox" aria-label="Academic years">
                        {!years && <li className="mm-sub">Loading...</li>}
                        {list.map((y) => (
                            <li key={y.id} role="option" aria-selected={selected === String(y.id)} className={selected === String(y.id) ? 'on' : undefined} onClick={() => setSelected(String(y.id))}>
                                <div className="mm-grow">
                                    <div className="mm-strong">
                                        {y.label} {isCurrent(y) && <span className="badge badge-info">Current</span>}
                                    </div>
                                    <div className="mm-sub">
                                        {y.students_count} students · {hasArea(y) ? `${y.area_name}, ${radiusText(Number(y.radius))}` : defaultArea ? 'Uses default area' : 'No field area'}
                                    </div>
                                </div>
                                <div className="table-actions-cell" onClick={(e) => e.stopPropagation()}>
                                    <button className="table-act-btn" title={`Edit ${y.label}`} onClick={() => setModal({ open: true, year: y })}>✏</button>
                                    <button className="table-act-btn act-delete" title={`Delete ${y.label}`} onClick={() => deleteYear(y)}>🗑</button>
                                </div>
                            </li>
                        ))}
                        <li role="option" aria-selected={selected === DEFAULT} className={selected === DEFAULT ? 'on' : undefined} onClick={() => setSelected(DEFAULT)}>
                            <div className="mm-grow">
                                <div className="mm-strong">Default area</div>
                                <div className="mm-sub">{defaultArea ? `${defaultArea.name}, ${radiusText(defaultArea.radius)}` : 'Not set'} · for years without their own area</div>
                            </div>
                        </li>
                    </ul>
                </div>

                <div className="mm-stack">
                    <div className="card">
                        <div className="mm-card-head">
                            <div>
                                <h2 className="card-title">{title}</h2>
                                <p className="card-desc">
                                    {selected === DEFAULT
                                        ? 'Used by every academic year that has no area of its own.'
                                        : savedArea ? 'Students in this academic year must be inside this area to enter data.' : 'This year uses the default area until you save one here.'}
                                </p>
                            </div>
                            {selected !== DEFAULT && savedArea && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={removeArea} disabled={busy}>Remove area</button>
                            )}
                        </div>

                        <form onSubmit={saveArea} className="mm-form">
                            <div className="form-group">
                                <label htmlFor="faName">Village / area name</label>
                                <input id="faName" required maxLength={120} placeholder="e.g. Sola village, Ward 12" value={form.name} onChange={set('name')} />
                            </div>
                            <div className="mm-form-row">
                                <div className="form-group">
                                    <label htmlFor="faLat">Latitude</label>
                                    <input id="faLat" type="number" min="-90" max="90" step="any" required placeholder="23.0225" value={form.latitude} onChange={set('latitude')} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="faLng">Longitude</label>
                                    <input id="faLng" type="number" min="-180" max="180" step="any" required placeholder="72.5714" value={form.longitude} onChange={set('longitude')} />
                                </div>
                            </div>
                            <button type="button" className="btn btn-secondary" onClick={useMyLocation} disabled={locating}>
                                {locating ? 'Reading location...' : '📍 Use my current location'}
                            </button>
                            <div className="form-group">
                                <label htmlFor="faRadius">Accepted radius (metres)</label>
                                <input id="faRadius" type="number" min="25" max="50000" step="1" required value={form.radius} onChange={set('radius')} />
                                <div className="mm-chips">
                                    {RADIUS_PRESETS.map((r) => (
                                        <button type="button" key={r} className={`mm-chip${radius === r ? ' on' : ''}`} onClick={() => setForm({ ...form, radius: String(r) })}>{radiusText(r)}</button>
                                    ))}
                                </div>
                                <span className="mm-sub">Between 25 m and 50 km. The student's GPS must also be accurate to within 100 m.</span>
                            </div>
                            <div className="mm-form-foot">
                                <span className="mm-sub">{selected === DEFAULT ? 'Default for all years' : selectedYear ? `Applies to ${selectedYear.students_count} students` : ''}</span>
                                <button type="submit" className="btn btn-primary" disabled={busy || !valid || !dirty || (!selectedYear && selected !== DEFAULT)}>{busy ? 'Saving...' : 'Save field area'}</button>
                            </div>
                        </form>
                    </div>

                    <div className="card mm-map-card">
                        {valid ? (
                            <>
                                <iframe className="mm-map" title="Field area map" src={mapUrl(lat, lng, radius)} loading="lazy" referrerPolicy="no-referrer" />
                                <div className="mm-map-foot">
                                    <span>{form.name.trim()} · {radiusText(radius)} radius</span>
                                    <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`} target="_blank" rel="noreferrer">Open map</a>
                                </div>
                            </>
                        ) : (
                            <div className="mm-map-empty">Enter a name, latitude and longitude to see the area on the map.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Portalled to <body>: <main> is a size container, which would clip a fixed overlay. */}
            {createPortal(<YearModal open={modal.open} year={modal.year} years={list} onClose={() => setModal({ open: false, year: null })} onSaved={onChanged} />, document.body)}
        </div>
    );
}
