import { useEffect, useState } from 'react';

interface Review { id: number; member_id: number; member_name: string; requester_name?: string; relationship?: string; message?: string; record_type?: string; record_id?: number }
interface Queue { guardian_requests: Review[]; corrections: Review[] }
export function PrivacyRequests({ onOpen }: { onOpen: (memberId: number) => void }) {
    const [queue, setQueue] = useState<Queue>({ guardian_requests: [], corrections: [] });
    const [error, setError] = useState('');
    const [verified, setVerified] = useState<Record<number, boolean>>({});
    const [busy, setBusy] = useState(false);
    async function load() {
        setError('');
        try { const response = await fetch('/api/crm/hospital/privacy-requests', { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setQueue(data); } catch (err) { setError((err as Error).message); }
    }
    useEffect(() => { void load(); }, []);
    async function review(kind: string, id: number, status: string) {
        setBusy(true); setError('');
        try { const response = await fetch(`/api/crm/hospital/privacy-requests/${kind}/${id}/review`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, verified: !!verified[id] }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }
    return <section className="panel" style={{ marginTop: 24 }} aria-label="Patient privacy requests"><div className="panel-heading"><div><h2>Patient privacy requests</h2><p>Review guardianship and record corrections for patients assigned to this hospital.</p></div><button className="button" onClick={() => void load()}>Refresh requests</button></div>{error && <p role="alert">{error}</p>}
        <h3 style={{ margin: '16px 0' }}>Guardian verification</h3>
        {!queue.guardian_requests.length && <p className="empty">No guardian requests awaiting review.</p>}
        {queue.guardian_requests.map(row => <article className="list-row" key={row.id} style={{ flexWrap: 'wrap' }}><div style={{ flex: '1 1 280px' }}><strong>{row.requester_name} → {row.member_name}</strong><p>Claimed relationship: {row.relationship}. Access lasts up to 30 days and ends when the member reaches adulthood.</p><label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><input type="checkbox" checked={!!verified[row.id]} onChange={e => setVerified(v => ({ ...v, [row.id]: e.target.checked }))} /><span>I have verified guardian identity, relationship, the child’s date of birth and applicable consent requirements.</span></label></div><button className="button" disabled={busy || !verified[row.id]} onClick={() => void review('guardian', row.id, 'Approved')}>Approve verified access</button><button className="button" disabled={busy} onClick={() => void review('guardian', row.id, 'Rejected')}>Reject</button></article>)}
        <h3 style={{ margin: '24px 0 16px' }}>Record correction requests</h3><p>Review the original record and coordinate verified changes through the existing clinical or survey workflow. Reviewing a request does not silently overwrite that record.</p>
        {!queue.corrections.length && <p className="empty">No correction requests awaiting review.</p>}
        {queue.corrections.map(row => <article className="list-row" key={row.id} style={{ flexWrap: 'wrap' }}><div style={{ flex: '1 1 280px' }}><strong>{row.member_name} · {row.record_type} #{row.record_id}</strong><p>{row.message}</p></div><button className="button" onClick={() => onOpen(row.member_id)}>Open record</button><button className="button" disabled={busy} onClick={() => void review('correction', row.id, 'Reviewed')}>Mark reviewed</button><button className="button" disabled={busy} onClick={() => void review('correction', row.id, 'Rejected')}>Reject</button></article>)}
    </section>;
}
