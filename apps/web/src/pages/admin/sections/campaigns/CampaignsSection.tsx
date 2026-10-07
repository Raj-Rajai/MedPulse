/** VIEW: Campaign command center — keyword campaign creator, live match preview, dispatched campaigns. */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson } from '../../lib/http';
import type { Campaign, CampaignMatch, CampaignPreview } from '../../types';

const labelStyle: CSSProperties = { fontWeight: 650, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const fieldStyle = (padding: string, fontSize = '0.88rem'): CSSProperties => ({ width: '100%', padding, fontSize, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' });
const thStyle: CSSProperties = { padding: '10px 14px', fontSize: '0.78rem', textTransform: 'uppercase' };
const tdTop: CSSProperties = { padding: '12px 14px', verticalAlign: 'top' };

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
    if (state.kind === 'initial') return <em>Select a keyword above to preview matched population...</em>;
    if (state.kind === 'error') return <span style={{ color: '#dc2626' }}>Error checking matches: {state.message}</span>;
    if (state.kind === 'none') return <span style={{ color: '#64748b' }}>No matching patients found for keyword "{state.keyword}" in the active proforma registry.</span>;
    return (
        <>
            {state.matches.slice(0, 5).map((m, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px dotted #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{m.name || ''}</strong>
                    <span style={{ color: '#059669' }}>{m.matched_label || m.matched_condition_detail || ''}</span>
                </div>
            ))}
            {state.count > 5 && <div style={{ marginTop: 4, color: '#64748b', fontStyle: 'italic' }}>+ {state.count - 5} more qualifying patients</div>}
        </>
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

const kwColor = (k: string) => (k === 'HTN' ? '#dc2626' : k === 'DM' ? '#9333ea' : k === 'ANAEMIA' ? '#d97706' : '#0284c7');

function CampaignRow({ c, onRoster }: { c: Campaign; onRoster: (c: Campaign) => void }) {
    const stats = c.stats || {};
    const targeted = stats.total_targeted || 0;
    const ack = stats.acknowledged || 0;
    const contacted = stats.cadet_contacted || 0;
    return (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={tdTop}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>#{c.id}</div>
                <span className="badge" style={{ background: kwColor(c.keyword), color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}>{c.keyword || ''}</span>
            </td>
            <td style={{ ...tdTop, maxWidth: 240 }}>
                <div style={{ fontWeight: 750, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 4 }}>{c.title || ''}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description || '-'}</div>
            </td>
            <td style={tdTop}>
                <div style={{ fontWeight: 650, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>📅 {c.event_date || 'TBD'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>📍 {c.venue || 'Campus Clinic'}</div>
            </td>
            <td style={tdTop}>
                <div style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0284c7' }}>{targeted}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Patients Notified</div>
            </td>
            <td style={tdTop}>
                <span className="badge" style={{ background: ack > 0 ? '#d1fae5' : '#f1f5f9', color: ack > 0 ? '#047857' : '#64748b', fontWeight: 700 }}>
                    {ack} / {targeted} Confirmed
                </span>
            </td>
            <td style={tdTop}>
                <span className="badge" style={{ background: contacted > 0 ? '#e0f2fe' : '#f1f5f9', color: contacted > 0 ? '#0369a1' : '#64748b', fontWeight: 700 }}>
                    {contacted} / {targeted} Followed Up
                </span>
            </td>
            <td style={{ ...tdTop, textAlign: 'right' }}>
                <button className="btn btn-secondary" onClick={() => onRoster(c)} style={{ fontSize: '0.76rem', padding: '4px 10px', gap: 4 }}>
                    👥 Target Roster
                </button>
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
            {/* Top Grid: Campaign Creator & Live Decision Diamond Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 24, marginBottom: 24 }} className="admin-grid-2col">
                {/* Creator Card */}
                <div className="card" style={{ borderTop: '4px solid #0284c7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>📢</span> Launch Disease-Targeted Campaign
                            </h2>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                Broadcast targeted outreach to qualifying households based on disease screening keywords.
                            </p>
                        </div>
                        <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>Decision Diamond</span>
                    </div>

                    <form id="createCampaignForm" onSubmit={submit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                            <div className="form-group">
                                <label htmlFor="campKeyword" style={labelStyle}>
                                    Target Keyword / Pathology *
                                </label>
                                <select id="campKeyword" value={f.keyword} onChange={(e) => onKeywordChange(e.target.value)} required style={{ ...fieldStyle('9px 12px'), background: '#fff', fontWeight: 600 }}>
                                    <option value="HTN">🩺 HTN - Hypertension &amp; BP &ge;140/90</option>
                                    <option value="DM">🩸 DM - Diabetes &amp; RBS &ge;200</option>
                                    <option value="ANAEMIA">🔬 ANAEMIA - Low Hb &lt;11 g/dL</option>
                                    <option value="UNDERWEIGHT">⚖ UNDERWEIGHT - Child Malnutrition / Low BMI</option>
                                    <option value="ELDERLY">👵 ELDERLY - Geriatric Cohort (Age 60+)</option>
                                    <option value="CUSTOM">🔍 Custom Condition Keyword...</option>
                                </select>
                            </div>

                            <div className="form-group" id="campCustomKeywordGroup" style={{ display: showCustom ? 'block' : 'none' }}>
                                <label htmlFor="campCustomKeyword" style={labelStyle}>
                                    Custom Keyword Search *
                                </label>
                                <input type="text" id="campCustomKeyword" ref={customRef} placeholder="e.g. asthma, arthritis, thyroid" value={f.custom} onChange={(e) => onCustomInput(e.target.value)} style={fieldStyle('8px 12px')} />
                            </div>

                            <div className="form-group" id="campDateGroup">
                                <label htmlFor="campDate" style={labelStyle}>
                                    Drive / Camp Date *
                                </label>
                                <input type="date" id="campDate" required value={f.date} onChange={set('date')} style={fieldStyle('8px 12px')} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label htmlFor="campTitle" style={labelStyle}>
                                Campaign Headline / Title *
                            </label>
                            <input type="text" id="campTitle" required placeholder="e.g. Free Community Hypertension Screening & Cardiovascular Consultation" value={f.title} onChange={set('title')} style={fieldStyle('9px 12px')} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label htmlFor="campVenue" style={labelStyle}>
                                Venue / Screening Location *
                            </label>
                            <input type="text" id="campVenue" required placeholder="e.g. RHTC Community Health Hall, Sector 4 or Field Camp Station" value={f.venue} onChange={set('venue')} style={fieldStyle('9px 12px')} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 18 }}>
                            <label htmlFor="campDesc" style={labelStyle}>
                                Clinical Advisory &amp; Patient Instructions *
                            </label>
                            <textarea id="campDesc" rows={3} required placeholder="Describe clinical advisory, fasting instructions, medication review notes, and what medical cadets will facilitate..." value={f.desc} onChange={set('desc')} style={{ ...fieldStyle('9px 12px', '0.85rem'), resize: 'vertical' }}></textarea>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>🔒</span> Zero HMS conflict: Only dispatches to matched patients &amp; cadets
                            </div>
                            <button type="submit" className="btn btn-primary" id="btnLaunchCampaign" disabled={busy} style={{ padding: '10px 22px', fontWeight: 700, gap: 8 }}>
                                {busy ? '🚀 Dispatching...' : '🚀 Dispatch Campaign Now'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Live Impact / Decision Diamond Radar Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="card" style={{ borderTop: '4px solid #10b981', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 750, margin: 0, color: '#065f46' }}>Live Decision Diamond</h3>
                            </div>
                            <span className="badge" style={{ background: '#d1fae5', color: '#047857', fontSize: '0.72rem', fontWeight: 700 }}>Condition == Keyword</span>
                        </div>

                        <p style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.5, marginBottom: 14 }}>
                            Our automated matching engine isolates target patients in real time based on active proforma data. Non-matching families receive zero spam alerts.
                        </p>

                        <div style={{ background: '#ffffff', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 650, color: '#065f46' }}>Qualifying Patients Found:</span>
                                <span id="previewPatientCount" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>{patientCount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 650, color: '#065f46' }}>Assigned Student Cadets:</span>
                                <span id="previewCadetCount" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0d9488' }}>{cadetCount}</span>
                            </div>
                        </div>

                        <div id="previewSampleList" style={{ fontSize: '0.78rem', color: '#374151', maxHeight: 140, overflowY: 'auto', padding: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 6, border: '1px dashed #a7f3d0' }}>
                            <PreviewList state={preview} />
                        </div>
                    </div>

                    {/* Architecture Note Box */}
                    <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: '1.2rem' }}>💡</span>
                            <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.45 }}>
                                <strong>Workflow Loop:</strong> Prof launches campaign &rarr; Patient receives instant personalized RSVP card in CRM &rarr; Student Cadet receives call task to coordinate field attendance.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Campaigns Roster */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)' }}>
                            📋 Dispatched Campaigns &amp; Real-Time RSVP Tracker
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                            Monitor delivery rates, patient confirmations, and student cadet call status across all launched drives.
                        </p>
                    </div>
                    <button className="btn btn-secondary" onClick={loadCampaigns} style={{ fontSize: '0.8rem', padding: '6px 14px', gap: 6 }}>
                        🔄 Refresh Campaign Feed
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }} id="campaignsTable">
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                <th style={thStyle}>ID &amp; Keyword</th>
                                <th style={thStyle}>Campaign Details</th>
                                <th style={thStyle}>Drive Date &amp; Venue</th>
                                <th style={thStyle}>Patient Targets</th>
                                <th style={thStyle}>Patient RSVP</th>
                                <th style={thStyle}>Cadet Outreach</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody id="campaignsTableBody">
                            {table.kind === 'initial' ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading campaigns...</td></tr>
                            ) : table.kind === 'loading' ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading campaigns...</td></tr>
                            ) : table.kind === 'error' ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#dc2626' }}>Failed to load campaigns: {table.message}</td></tr>
                            ) : table.rows.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No disease campaigns launched yet. Launch your first drive above!</td></tr>
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
