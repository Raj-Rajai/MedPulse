/** Care reminders intentionally contain no diagnoses, medicine names or readings. */
import type { ReactNode } from 'react';
import type { PortalActions } from './actions';
import type { PortalState } from './types';
import { useT } from './i18n';
import { fmtDay } from './util';
import { needsRequestConfirm, isPast, rsvpOf } from './logic';
interface ActionItem { ic: string; t: string; d: string; btns: ReactNode }
export function actionItems(s: PortalState, a: PortalActions, t: (s: string) => string): ActionItem[] {
    return [
        ...s.notifs.filter(n => !isPast(n) && rsvpOf(n) === 'Pending').map(n => ({ ic: '📅', t: 'Health camp invitation', d: fmtDay(n.event_date), btns: <button className="pt-btn sm" onClick={() => a.openCamp(n.notification_id)}>{t('View invitation')}</button> })),
        ...s.requests.filter(needsRequestConfirm).map(r => ({ ic: '✓', t: 'Confirm your request status', d: `Request #${r.id}`, btns: <button className="pt-btn sm" onClick={() => a.showTab('hospital')}>{t('View request')}</button> })),
    ];
}
export function OverviewPanel({ s, a, loaded }: { s: PortalState; a: PortalActions; loaded: boolean; active: boolean }) {
    const t = useT(); const items = actionItems(s, a, t);
    return <section className="pt-panel active" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
        <div className="pt-section-intro"><span className="pt-eyebrow">{t('CARE REMINDERS')}</span><h2>{t('Stay connected to your next step.')}</h2><p>{t('Appointments and care reminders, with your health details kept private.')}</p></div>
        <div className="pt-grid-2"><div>
            <article className="pt-card pt-record-summary"><span className="pt-icon-round" aria-hidden="true">↗</span><h2>{t(s.overview?.record_available ? 'Your latest check-up is available.' : 'Your personal health records')}</h2><p>{t('Open your secure health records to see readings, medicines and visit details.')}</p>{s.overview?.next_visit_date && <p>{t('Next follow-up:')} {fmtDay(s.overview.next_visit_date)}</p>}<button className="pt-btn primary" onClick={() => a.openRecords()}>{t('Open my health records')}</button></article>
            <article className="pt-card"><div className="pt-card-h"><h2>{t('Needs your attention')}</h2></div>{!loaded ? <div className="pt-skel" /> : items.length ? items.map((item, i) => <div className="pt-action" key={i}><div className="ic">{item.ic}</div><div className="grow"><div className="t">{t(item.t)}</div><div className="d">{item.d}</div></div>{item.btns}</div>) : <div className="pt-empty">{t('No pending actions. Your care team will let you know about the next step.')}</div>}</article>
        </div><div>
            <article className="pt-card"><div className="pt-card-h"><h2>{t('Your appointments')}</h2></div>{s.requests.filter(r => r.status === 'Scheduled').map(r => <div className="pt-action" key={r.id}><div className="grow"><strong>{t('Hospital appointment')}</strong><p className="pt-sub">{r.scheduled_for}</p></div><button className="pt-btn sm" onClick={() => a.showTab('hospital')}>{t('View')}</button></div>)}<button className="pt-btn" onClick={() => a.showTab('hospital')}>{t('Appointments and requests')}</button></article>
            <article className="pt-card"><div className="pt-card-h"><h2 id="tab-campaigns">{t('Health camps')}</h2></div><p className="pt-sub">{t('View camp information, reply to an invitation or get help attending.')}</p><button className="pt-btn" onClick={() => a.showTab('campaigns')}>{t('View health camps')}</button></article>
            <article className="pt-card"><h2>{t('Your identification card')}</h2><p className="pt-sub">{t('A minimal card to identify you at the care desk.')}</p><button className="pt-btn" onClick={() => a.showTab('profile')}>{t('View identification card')}</button></article>
        </div></div>
    </section>;
}
