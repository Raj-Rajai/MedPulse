/** VIEW: Campaign command center — keyword campaign creator, live match preview, dispatched campaigns. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson } from '../../lib/http';
import type { Campaign, CampaignMatch, CampaignPreview } from '../../types';

const FORM_DEFAULTS = { keyword: 'HTN', custom: '', date: '', title: '', venue: '', desc: '' };

type PreviewState =
    | { kind: 'initial' }
    | { kind: 'loading'; prev: PreviewState }
    | { kind: 'none'; keyword: string }
    | { kind: 'matches'; count: number; cadets: number; matches: CampaignMatch[] }
    | { kind: 'error'; message: string };

type TableState = { kind: 'initial' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; rows: Campaign[] };

function PreviewList({ state }: { state: PreviewState }) {
    if (state.kind === 'loading') return <PreviewList state={state.prev} />;
    if (state.kind === 'initial') return <span className="mm-sub">Pick a condition to preview who it reaches.</span>;
    if (state.kind === 'error') return <span className="mm-error">Could not check matches: {state.message}</span>;
    if (state.kind === 'none') return <span className="mm-sub">No patients match "{state.keyword}" yet.</span>;
    return (
        <ul className="mm-list">
            {state.matches.slice(0, 5).map((m, i) => (
                <li key={i}>
                    <span className="mm-strong">{m.name || ''}</span>
                    <span className="mm-sub">{m.matched_label || m.matched_condition_detail || ''}</span>
                </li>
            ))}
            {state.count > 5 && <li className="mm-sub">and {state.count - 5} more</li>}
        </ul>
    );
}

function counts(state: PreviewState): [string | number, string | number] {
    switch (state.kind) {
        case 'initial': return ['--', '--'];
        case 'loading': return ['...', '...'];
        case 'none': return [0, 0];
        case 'matches': return [state.count, state.cadets];
        case 'error': return ['0', '0'];
    }
}

function CampaignRow({ c, onRoster }: { c: Campaign; onRoster: (c: Campaign) => void }) {
    const stats = c.stats || {};
    const targeted = stats.total_targeted || 0;
    const ack = stats.acknowledged || 0;
    const contacted = stats.cadet_contacted || 0;
    return (
        <tr>
            <td>
                <div className="mm-sub">#{c.id}</div>
                <span className="badge mm-badge-neutral">{c.keyword || ''}</span>
            </td>
            <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>
                <div className="mm-strong">{c.title || ''}</div>
                <div className="mm-sub mm-clamp">{c.description || '-'}</div>
            </td>
            <td>
                <div>{c.event_date || 'TBD'}</div>
                <div className="mm-sub">{c.venue || 'Campus Clinic'}</div>
            </td>
            <td style={{ textAlign: 'center' }} className="mm-strong">{targeted}</td>
            <td style={{ textAlign: 'center' }}>{ack}<span className="mm-sub"> / {targeted}</span></td>
            <td style={{ textAlign: 'center' }}>{contacted}<span className="mm-sub"> / {targeted}</span></td>
            <td style={{ textAlign: 'right' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => onRoster(c)}>View roster</button>
            </td>
        </tr>
    );
}

export function CampaignsSection({ active, loadSignal, onOpenRoster }: { active: boolean; loadSignal: number; onOpenRoster: (c: Campaign) => void }) {
    const showToast = useToast();
    const [f, setF] = useState(FORM_DEFAULTS);
    const [showCustom, setShowCustom] = useState(false);
    const [focusCustom, setFocusCustom] = useState(0);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<PreviewState>({ kind: 'initial' });
    const [table, setTable] = useState<TableState>({ kind: 'initial' });
    const customRef = useRef<HTMLInputElement>(null);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const previewKeyword = useCallback(async (keyword: string) => {
        if (!keyword) return;
        setPreview((p) => ({ kind: 'loading', prev: p.kind === 'loading' ? p.prev : p }));
        try {
            const res = await fetch(`/api/campaigns/preview?keyword=${encodeURIComponent(keyword)}`);
            if (!res.ok) throw new Error('Failed to preview matches');
            const data = (await res.json()) as CampaignPreview;
            const count = data.total_matching || 0;
            const matches = data.matches || [];
            const cadetRolls = new Set(matches.filter((m) => m.cadet_roll).map((m) => m.cadet_roll));
            setPreview(count === 0 ? { kind: 'none', keyword } : { kind: 'matches', count, cadets: cadetRolls.size, matches });
        } catch (err) {
            console.error('Preview error:', err);
            setPreview({ kind: 'error', message: errMessage(err) });
        }
    }, []);

    const loadCampaigns = useCallback(async () => {
        setTable({ kind: 'loading' });
        try {
            const res = await fetch('/api/campaigns');
            if (!res.ok) throw new Error('Failed to fetch campaigns');
            const data = (await res.json()) as { campaigns?: Campaign[] };
            setTable({ kind: 'data', rows: data.campaigns || [] });
        } catch (err) {
            console.error('Error loading admin campaigns:', err);
            setTable({ kind: 'error', message: errMessage(err) });
        }
    }, []);

    useEffect(() => {
        if (!loadSignal) return;
        loadCampaigns();
        previewKeyword('HTN');
    }, [loadSignal, loadCampaigns, previewKeyword]);

    useEffect(() => {
        if (focusCustom) customRef.current?.focus();
    }, [focusCustom]);

    const onKeywordChange = (val: string) => {
        setF({ ...f, keyword: val });
        if (val === 'CUSTOM') {
            setShowCustom(true);
            setFocusCustom((n) => n + 1);
            previewKeyword(f.custom.trim() || 'HTN');
        } else {
            setShowCustom(false);
            previewKeyword(val);
        }
    };

    const onCustomInput = (val: string) => {
        setF({ ...f, custom: val });
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => {
            if (val.trim()) previewKeyword(val.trim());
        }, 300);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        let keyword = f.keyword;
        if (keyword === 'CUSTOM') {
            keyword = f.custom.trim();
            if (!keyword) {
                showToast('Please enter a custom condition keyword', 'error');
                setBusy(false);
                return;
            }
        }
        const payload = {
            keyword,
            title: f.title.trim(),
            venue: f.venue.trim(),
            event_date: f.date,
            description: f.desc.trim(),
            auto_dispatch: true,
        };
        try {
            const res = await sendJson('/api/campaigns', 'POST', payload);
            const data = await readJson<object>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to dispatch campaign');
            showToast(data.message || 'Campaign launched and dispatched successfully!', 'success', 4000);
            setF(FORM_DEFAULTS);
            setShowCustom(false);
            await loadCampaigns();
            previewKeyword('HTN');
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const set = (k: keyof typeof FORM_DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
    const [patientCount, cadetCount] = counts(preview);

    return (
        <div id="viewCampaigns" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="mm-split">
                {/* Creator */}
                <div className="card">
                    <div className="mm-card-head">
                        <div>
                            <h2 className="card-title">Launch a campaign</h2>
                            <p className="card-desc">Send outreach to patients whose screening matches a condition, and assign follow-up calls to their students.</p>
                        </div>
                    </div>

                    <form id="createCampaignForm" onSubmit={submit} className="mm-form">
                        <div className="mm-form-row">
                            <div className="form-group">
                                <label htmlFor="campKeyword">Condition</label>
                                <select id="campKeyword" value={f.keyword} onChange={(e) => onKeywordChange(e.target.value)} required>
                                    <option value="HTN">HTN: hypertension, BP 140/90 or higher</option>
                                    <option value="DM">DM: diabetes, RBS 200 or higher</option>
                                    <option value="ANAEMIA">Anaemia: Hb below 11 g/dL</option>
                                    <option value="UNDERWEIGHT">Underweight: child malnutrition or low BMI</option>
                                    <option value="ELDERLY">Elderly: age 60 and above</option>
                                    <option value="CUSTOM">Custom keyword...</option>
                                </select>
                            </div>
                            <div className="form-group" id="campDateGroup">
                                <label htmlFor="campDate">Camp date</label>
                                <input type="date" id="campDate" required value={f.date} onChange={set('date')} />
                            </div>
                        </div>

                        <div className="form-group" id="campCustomKeywordGroup" style={{ display: showCustom ? 'flex' : 'none' }}>
                            <label htmlFor="campCustomKeyword">Custom keyword</label>
                            <input type="text" id="campCustomKeyword" ref={customRef} placeholder="e.g. asthma, arthritis, thyroid" value={f.custom} onChange={(e) => onCustomInput(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="campTitle">Title</label>
                            <input type="text" id="campTitle" required placeholder="e.g. Free hypertension screening camp" value={f.title} onChange={set('title')} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="campVenue">Venue</label>
                            <input type="text" id="campVenue" required placeholder="e.g. RHTC community hall, Sector 4" value={f.venue} onChange={set('venue')} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="campDesc">Instructions for patients</label>
                            <textarea id="campDesc" rows={3} required placeholder="Fasting instructions, what to bring, and what the students will help with" value={f.desc} onChange={set('desc')} style={{ resize: 'vertical' }}></textarea>
                        </div>

                        <div className="mm-form-foot">
                            <span className="mm-sub">Only matched patients and their students are notified.</span>
                            <button type="submit" className="btn btn-primary" id="btnLaunchCampaign" disabled={busy}>
                                {busy ? 'Sending...' : 'Send campaign'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Live match preview */}
                <div className="card">
                    <h2 className="card-title">Who this reaches</h2>
                    <p className="card-desc">Updates as you change the condition.</p>
                    <div className="mm-stat-pair">
                        <div>
                            <span className="mm-sub">Matching patients</span>
                            <span id="previewPatientCount" className="mm-stat">{patientCount}</span>
                        </div>
                        <div>
                            <span className="mm-sub">Students assigned</span>
                            <span id="previewCadetCount" className="mm-stat">{cadetCount}</span>
                        </div>
                    </div>
                    <div id="previewSampleList" className="mm-scroll-box">
                        <PreviewList state={preview} />
                    </div>
                    <p className="mm-sub" style={{ marginTop: 12 }}>
                        Patients get an RSVP card in their portal, and each student gets a call task to confirm attendance.
                    </p>
                </div>
            </div>

            {/* Sent campaigns */}
            <div className="card">
                <div className="mm-card-head">
                    <div>
                        <h2 className="card-title">Sent campaigns</h2>
                        <p className="card-desc">Patient confirmations and student follow-up calls for each campaign.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={loadCampaigns}>↺ Refresh</button>
                </div>

                <div className="table-wrapper">
                    <table id="campaignsTable">
                        <thead>
                            <tr>
                                <th>Condition</th>
                                <th>Campaign</th>
                                <th>Date and venue</th>
                                <th style={{ textAlign: 'center' }}>Patients</th>
                                <th style={{ textAlign: 'center' }}>Confirmed</th>
                                <th style={{ textAlign: 'center' }}>Called</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody id="campaignsTableBody">
                            {table.kind === 'initial' || table.kind === 'loading' ? (
                                <tr><td colSpan={7} className="dt-message">Loading campaigns...</td></tr>
                            ) : table.kind === 'error' ? (
                                <tr><td colSpan={7} className="dt-message mm-error">Failed to load campaigns: {table.message}</td></tr>
                            ) : table.rows.length === 0 ? (
                                <tr><td colSpan={7} className="dt-message">No campaigns sent yet.</td></tr>
                            ) : (
                                table.rows.map((c) => <CampaignRow key={c.id} c={c} onRoster={onOpenRoster} />)
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
