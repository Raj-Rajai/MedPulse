/** Overview tab: reminders, action centre, vitals, hospital, family and next camp (renderOverview & co.). */
import type { ReactNode } from 'react';
import type { PortalActions } from './actions';
import { HospitalButtons } from './HospitalPanel';
import { useT } from './i18n';
import {
    cardCompleteness, isPast, needsRequestConfirm, rsvpOf, RSVP_LABEL, RSVP_PILL, splitCamps, VITAL_PILL, vitalCards,
} from './logic';
import type { PortalState } from './types';
import { avColor, daysUntil, fmtDay, initials, relDay } from './util';

const Skel = () => <div className="pt-skel" />;

interface ActionItem { ic: string; t: string; d: string; btns: ReactNode }

export function actionItems(s: PortalState, a: PortalActions, t: (x: string) => string): ActionItem[] {
    const items: ActionItem[] = [];
    const c = s.card;
    if (c) {
        const comp = cardCompleteness(c);
        if (comp.missing.length) items.push({ ic: '▣', t: 'Complete your health card', d: `Add ${comp.missing.join(', ').toLowerCase()}`, btns: <button className="pt-btn sm primary" onClick={() => a.showTab('profile')}>{t('Complete')}</button> });
    }
    s.notifs.filter((n) => !isPast(n) && rsvpOf(n) === 'Pending').forEach((n) => items.push({
        ic: '📣', t: `Reply to: ${n.campaign_title}`, d: `${fmtDay(n.event_date) || 'Date TBA'} · matched ${n.matched_keyword}`,
        btns: <>
            <button className="pt-btn sm primary" onClick={() => a.sendRsvp(n.notification_id, 'Attending')}>{t("✅ I'll come")}</button>
            <button className="pt-btn sm" onClick={() => a.openCamp(n.notification_id)}>{t('Other reply')}</button>
        </>,
    }));
    s.requests.filter(needsRequestConfirm).forEach((r) => items.push({
        ic: '🏥', t: 'Did the hospital sort this out?', d: `${r.reason} · ${r.department}${r.hospital_note ? ` · “${r.hospital_note}”` : ''}`,
        btns: <>
            <button className="pt-btn sm" onClick={() => a.confirmRequest(r.id, true)}>{t('👍 Yes')}</button>
            <button className="pt-btn sm ghost-danger" onClick={() => a.confirmRequest(r.id, false)}>{t('Not yet')}</button>
        </>,
    }));
    return items;
}

function Reminders({ s, a }: { s: PortalState; a: PortalActions }) {
    const t = useT();
    const { up } = splitCamps(s.notifs);
    const soon = up.filter((n) => { const d = daysUntil(n.event_date); return d !== null && d >= 0 && d <= 1 && rsvpOf(n) !== 'Not Attending'; });
    const appts = s.requests.filter((r) => r.status === 'Scheduled' && r.scheduled_for);
    return (
        <div id="reminderArea">
            {soon.map((n) => (
                <div className="pt-reminder" key={`c${n.notification_id}`}>
                    <div className="ic">⏰</div>
                    <div className="grow"><div className="t">{t(`${relDay(daysUntil(n.event_date))}: ${n.campaign_title}`)}</div><div className="d">{t(`📍 ${n.venue || 'Venue to be announced'}${rsvpOf(n) === 'Pending' ? ' · Please reply so the team can plan.' : ''}`)}</div></div>
                    <button className="pt-btn sm" onClick={() => a.openCamp(n.notification_id)}>{t('Open')}</button>
                </div>
            ))}
            {appts.map((r) => (
                <div className="pt-reminder" key={`r${r.id}`} style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderColor: '#a5b4fc' }}>
                    <div className="ic">📅</div>
                    <div className="grow"><div className="t" style={{ color: '#3730a3' }}>{t(`Hospital appointment: ${r.scheduled_for}`)}</div><div className="d" style={{ color: '#3730a3' }}>{t(`${r.department}${r.for_member_name ? ` · for ${r.for_member_name}` : ''}`)}</div></div>
                    <button className="pt-btn sm" onClick={() => a.showTab('hospital')}>{t('Open')}</button>
                </div>
            ))}
        </div>
    );
}

function OverviewFamily({ s }: { s: PortalState }) {
    const t = useT();
    const F = s.family;
    if (!F || !F.members) return <div className="pt-empty">{t('Loading family…')}</div>;
    const shown = F.members.slice(0, 6);
    const av = { width: 36, height: 36, flexBasis: 36, fontSize: '0.78rem' } as const;
    return (
        <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {shown.map((m) => <span key={m.id} title={t(m.name)} className="mem-av" style={{ ...av, background: avColor(m.name) }}>{t(initials(m.name))}</span>)}
                {F.members.length > shown.length ? <span className="mem-av" style={{ ...av, background: '#94a3b8' }}>{t(`+${F.members.length - shown.length}`)}</span> : null}
            </div>
            <div className="pt-sub">{t(`${F.members.length} member${F.members.length === 1 ? '' : 's'} · ${F.can_edit ? 'You manage this family' : 'View only'}`)}</div>
        </>
    );
}

function NextCamp({ s }: { s: PortalState }) {
    const t = useT();
    const next = splitCamps(s.notifs).up[0];
    if (!next) return <div className="pt-empty" style={{ padding: 16 }}><strong>{t('No upcoming camps.')}</strong><br />{t('You only get alerts that match your health.')}</div>;
    const r = rsvpOf(next);
    return (
        <>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t(next.campaign_title)}</div>
            <div className="pt-sub" style={{ margin: '4px 0 10px' }}>{t(`📅 ${fmtDay(next.event_date) || 'TBA'} · 📍 ${next.venue || 'TBA'}`)}</div>
            <span className={`pt-pill ${RSVP_PILL[r]}`}>{t(RSVP_LABEL[r])}</span>
        </>
    );
}

export function OverviewPanel({ s, a, loaded, active }: { s: PortalState; a: PortalActions; loaded: boolean; active: boolean }) {
    const t = useT();
    const items = actionItems(s, a, t);
    const vitals = vitalCards(s);
    const h = s.hospital;
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabIndex={0}>
            {loaded ? <Reminders s={s} a={a} /> : <div id="reminderArea" />}
            <div className="pt-grid-2">
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h">
                            <div>
                                <h2>{t('✅ Needs your attention')}</h2>
                                <p className="pt-sub">{t('Things waiting on you.')}</p>
                            </div>
                        </div>
                        <div id="actionCentre">
                            {!loaded ? <><Skel /><Skel /></> : items.length ? items.map((i, k) => (
                                <div className="pt-action" key={k}><div className="ic">{t(i.ic)}</div><div className="grow"><div className="t">{t(i.t)}</div><div className="d">{t(i.d)}</div></div><div className="btns">{i.btns}</div></div>
                            )) : <div className="pt-empty" style={{ padding: 18 }}><span className="big">🎉</span><strong>{t("You're all caught up.")}</strong><br />{t('Nothing needs your attention right now.')}</div>}
                        </div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h">
                            <div>
                                <h2>{t('🩺 Your latest health numbers')}</h2>
                                <p className="pt-sub" id="vitalsSource">{t(loaded ? vitals.source : 'From your last check-up.')}</p>
                            </div>
                        </div>
                        <div className="pt-vitals" id="vitalsGrid">
                            {!loaded ? <><Skel /><Skel /></> : vitals.cards.map((c) => (
                                <div className={`pt-vital ${c.lvl}`} key={c.lbl}>
                                    <div className="lbl"><span>{t(c.lbl)}</span><span className={`pt-pill ${VITAL_PILL[c.lvl]}`}>{t(c.tag)}</span></div>
                                    <div className="val">{t(`${c.val} `)}<small>{t(c.unit)}</small></div>
                                    <div className="hint">{t(c.hint)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h"><div className="pt-hospital-heading"><h2>{t('🏥 Your hospital')}</h2><img className="pt-hospital-logo" src="/hospital/sal-hospital-logo.webp" alt="SAL Hospital - Healthcare with Human Touch" width="2559" height="1493" /></div><button className="pt-btn sm" onClick={() => a.showTab('hospital')}>{t('Requests →')}</button></div>
                        <div id="overviewHospital">
                            {!loaded ? <Skel /> : h ? <>
                                <div className="hosp-card"><div className="ic">🏥</div><div style={{ minWidth: 0 }}><div className="hosp-name">{t(h.name)}</div><div className="pt-sub">{t(`${h.city || ''}${h.contact_phone ? ` · 📞 ${h.contact_phone}` : ''}`)}</div></div></div>
                                <HospitalButtons s={s} a={a} compact />
                            </> : <div className="pt-empty">{t('Hospital details are not available.')}</div>}
                        </div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('👪 Your family')}</h2><button className="pt-btn sm" onClick={() => a.showTab('family')}>{t('Open →')}</button></div>
                        <div id="overviewFamily">{loaded ? <OverviewFamily s={s} /> : <Skel />}</div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('📣 Next health camp')}</h2><button className="pt-btn sm" onClick={() => a.showTab('campaigns')}>{t('See all →')}</button></div>
                        <div id="nextCampBody">{loaded ? <NextCamp s={s} /> : <Skel />}</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
