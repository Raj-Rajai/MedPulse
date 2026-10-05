/** Health camps tab: upcoming camp cards with RSVP and past camps (renderCampaigns / campaignCard). */
import type { PortalActions } from './actions';
import { useT } from './i18n';
import { needsContactConfirm, rsvpOf, RSVP_LABEL, RSVP_PILL, splitCamps } from './logic';
import type { CampNotification, PortalState } from './types';
import { daysUntil, firstName, fmtDay, relDay } from './util';

function CampaignCard({ n, a }: { n: CampNotification; a: PortalActions }) {
    const t = useT();
    const r = rsvpOf(n);
    const du = daysUntil(n.event_date);
    const sel = (v: string) => (r === v ? `sel-${v.replace(' ', '')}` : '');
    const id = n.notification_id;
    return (
        <article className="pt-camp" id={`camp-${id}`}>
            <div className="pt-camp-top">
                <div className="pt-camp-row">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="pt-kw">{t(`🎯 ${n.matched_keyword ?? ''}`)}</span>
                        {n.notification_status === 'Delivered' ? <span className="pt-pill info">{t('New')}</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="pt-pill mute">{t(`📅 ${fmtDay(n.event_date) || 'Date to be announced'}${du !== null && du >= 0 && du <= 7 ? ` · ${relDay(du)}` : ''}`)}</span>
                        <span className={`pt-pill ${RSVP_PILL[r]}`}>{t(RSVP_LABEL[r])}</span>
                    </div>
                </div>
                <h3>{t(n.campaign_title)}</h3>
                {n.campaign_description ? <p className="desc">{t(n.campaign_description)}</p> : null}
                <div className="pt-why"><span>🔎</span><div><strong>{t('Why you got this:')}</strong>{t(' your health record shows ')}<strong>{t(n.matched_condition_detail || n.matched_keyword)}</strong>{t('. This camp is for people with this condition.')}</div></div>
                <div className="pt-meta">
                    <div>{t('📍 ')}<b>{t('Where:')}</b>{t(` ${n.venue || 'To be announced'}`)}</div>
                    <div>{t('🎓 ')}<b>{t('Organised by:')}</b>{t(` ${n.organizing_college || 'Medical College'}`)}</div>
                </div>
            </div>
            <div className="pt-camp-foot">
                <div className="pt-rsvp-q">{t('Will you attend?')}</div>
                <div className="pt-rsvp" role="group" aria-label={t('RSVP')}>
                    <button className={sel('Attending')} onClick={() => a.sendRsvp(id, 'Attending')}>{t("✅ Yes, I'll come")}</button>
                    <button className={sel('Not Attending')} onClick={() => a.askRsvp(id, 'Not Attending')}>{t("❌ Can't come")}</button>
                    <button className={sel('Need Help')} onClick={() => a.askRsvp(id, 'Need Help')}>{t('🙋 Need help to come')}</button>
                </div>
                {n.rsvp_note ? <div className="pt-rsvp-note">{t(`Your note: “${n.rsvp_note}”`)}</div> : null}
                {needsContactConfirm(n) ? (
                    <div className="pt-confirm">
                        <span>📞</span><div className="grow">{t(`The camp team (${firstName(n.cadet_name)}) says they called you about this. Did they?`)}</div>
                        <button className="pt-btn sm" onClick={() => a.confirmCampContact(id, true)}>{t('👍 Yes')}</button>
                        <button className="pt-btn sm ghost-danger" onClick={() => a.confirmCampContact(id, false)}>{t('No')}</button>
                    </div>
                ) : null}
                {n.patient_contact_confirmation === 'Confirmed' ? <div className="pt-rsvp-note" style={{ color: '#065f46' }}>{t('✔ You confirmed the camp team called you.')}</div> : null}
                <div className="pt-foot-links">
                    {n.event_date ? <button className="pt-btn sm" onClick={() => a.downloadIcs(id)}>{t('🗓️ Add to calendar')}</button> : null}
                </div>
            </div>
        </article>
    );
}

export function CampaignsPanel({ s, a, loaded, active }: { s: PortalState; a: PortalActions; loaded: boolean; active: boolean }) {
    const t = useT();
    const { up, past } = splitCamps(s.notifs);
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-campaigns" role="tabpanel" aria-labelledby="tab-campaigns" tabIndex={0}>
            <div className="pt-why" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <div><strong>{t("Only what's relevant to you.")}</strong>{t(' You get a camp alert only when it matches a condition or reading in your health record.')}</div>
            </div>
            <div className="pt-section-title">{t('Upcoming')}</div>
            <div id="upcomingCamps">
                {!loaded ? <div className="pt-skel" style={{ height: 180 }} /> : up.length
                    ? up.map((n) => <CampaignCard key={n.notification_id} n={n} a={a} />)
                    : <div className="pt-empty"><span className="big">🛡️</span><strong>{t('No camps for you right now.')}</strong><br />{t("We'll let you know when a camp matches your health record.")}</div>}
            </div>
            <div className="pt-section-title" style={{ marginTop: 22 }}>{t('Past camps')}</div>
            <div id="pastCamps">
                {!loaded ? null : past.length ? past.map((n) => {
                    const r = rsvpOf(n);
                    return (
                        <div className="pt-past" key={n.notification_id}><div><div className="t">{t(n.campaign_title)}</div><div className="d">{t(`${fmtDay(n.event_date)} · ${n.venue || ''}`)}</div></div>
                            <span className={`pt-pill ${r === 'Attending' ? 'ok' : 'mute'}`}>{t(r === 'Attending' ? '✅ You said you would attend' : r === 'Pending' ? 'No reply' : RSVP_LABEL[r])}</span></div>
                    );
                }) : <div className="pt-sub">{t('No past camps yet.')}</div>}
            </div>
        </section>
    );
}
