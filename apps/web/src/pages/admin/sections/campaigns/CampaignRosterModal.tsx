import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { ModalOverlay, closeBtnStyle, modalHeadStyle } from '../../components/ModalOverlay';
import type { ModalState } from '../../hooks/useModal';
import { errMessage } from '../../lib/http';
import type { Campaign, RosterEntry } from '../../types';

type Body = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; rows: RosterEntry[] };

const cell: CSSProperties = { padding: '8px 10px' };
const th: CSSProperties = { padding: '8px 10px' };

function RsvpBadge({ status }: { status?: string | null }) {
    if (status === 'Acknowledged') return <span className="badge" style={{ background: '#d1fae5', color: '#047857', fontWeight: 700 }}>✅ Confirmed</span>;
    if (status === 'Declined') return <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Declined</span>;
    return <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>⏳ Delivered</span>;
}

function CadetCallBadge({ status }: { status?: string | null }) {
    if (status === 'Assisted') return <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>🌟 Assisted</span>;
    if (status === 'Contacted') return <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>📞 Contacted</span>;
    return <span className="badge" style={{ background: '#fffbeb', color: '#b45309' }}>Pending</span>;
}

/** MODAL: campaign target roster (openCampaignRosterModal). */
export function CampaignRosterModal({ modal }: { modal: ModalState<Campaign> }) {
    const [title, setTitle] = useState('👥 Campaign Patient Roster');
    const [subtitle, setSubtitle] = useState('Targeted patients and cadet care coordinators');
    const [body, setBody] = useState<Body | null>(null);

    useLayoutEffect(() => {
        const c = modal.data;
        if (!modal.nonce || !c) return;
        let live = true;
        setTitle(`👥 Target Roster: ${c.title || '#' + c.id}`);
        setSubtitle(`Matched patients and supervising medical cadets for campaign #${c.id}`);
        setBody({ kind: 'loading' });
        (async () => {
            try {
                const res = await fetch(`/api/campaigns/${c.id}`);
                if (!res.ok) throw new Error('Failed to load campaign roster');
                const data = (await res.json()) as { campaign?: { roster?: RosterEntry[] } };
                if (live) setBody({ kind: 'data', rows: (data.campaign && data.campaign.roster) || [] });
            } catch (err) {
                if (live) setBody({ kind: 'error', message: errMessage(err) });
            }
        })();
        return () => { live = false; };
    }, [modal.nonce, modal.data]);

    return (
        <ModalOverlay id="campaignRosterModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 820, width: '92%' }}>
            <div style={modalHeadStyle}>
                <div>
                    <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem', margin: 0 }} id="rosterModalTitle">{title}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} id="rosterModalSubtitle">{subtitle}</span>
                </div>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                            <th style={th}>Patient Name &amp; Phone</th>
                            <th style={th}>Matched Condition Details</th>
                            <th style={th}>Patient RSVP</th>
                            <th style={th}>Supervising Cadet</th>
                            <th style={th}>Cadet Call Status</th>
                        </tr>
                    </thead>
                    <tbody id="rosterModalTableBody">
                        {body === null ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading roster...</td></tr>
                        ) : body.kind === 'loading' ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading recipient roster...</td></tr>
                        ) : body.kind === 'error' ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#dc2626' }}>Error: {body.message}</td></tr>
                        ) : body.rows.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No patients currently dispatched for this campaign.</td></tr>
                        ) : (
                            body.rows.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={cell}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.patient_name || '-'}</div>
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>📞 {r.patient_phone || '-'}</div>
                                    </td>
                                    <td style={cell}>
                                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{r.matched_keyword || '-'}</span>
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.matched_condition_detail || '-'}</div>
                                    </td>
                                    <td style={cell}>
                                        <RsvpBadge status={r.status} />
                                        {r.patient_response_note ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>"{r.patient_response_note}"</div> : null}
                                    </td>
                                    <td style={cell}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.cadet_name || 'Cadet'}</div>
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Roll {r.cadet_roll || '-'}</div>
                                    </td>
                                    <td style={cell}>
                                        <CadetCallBadge status={r.cadet_call_status} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={modal.hide}>Close</button>
            </div>
        </ModalOverlay>
    );
}
