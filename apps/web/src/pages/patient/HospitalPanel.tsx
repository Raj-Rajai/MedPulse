/** Hospital tab: callback request form, hospital contact card and request list (renderHospital / renderRequests). */
import { Fragment, type FormEvent } from 'react';
import type { PortalActions, RequestForm, RequestFormRefs } from './actions';
import { useT } from './i18n';
import { needsRequestConfirm, OPEN_STATUSES, REQ_LABEL, REQ_PILL } from './logic';
import type { HospitalRequest, PortalState } from './types';
import { digits, fmtWhen, isMobile, waLink } from './util';

export function HospitalButtons({ s, a, compact }: { s: PortalState; a: PortalActions; compact?: boolean }) {
    const t = useT();
    const phone = digits(s.hospital && s.hospital.contact_phone);
    const c = s.card;
    return (
        <div className="hosp-call">
            {phone
                ? <a className="pt-btn call" href={`tel:${phone}`}>{t(`📞 Call${compact ? '' : ' helpdesk'}`)}</a>
                : <button className="pt-btn" disabled>{t('📞 No phone')}</button>}
            {isMobile(phone)
                ? <a className="pt-btn wa" href={waLink(phone, `Hello, I am ${c ? c.name : ''} (${c ? c.patient_uid : ''}).`)} target="_blank" rel="noopener">{t('💬 WhatsApp')}</a>
                : <button className="pt-btn primary" onClick={a.focusRequestMessage}>{t('✉️ Request call')}</button>}
        </div>
    );
}

const STEPS = ['Open', 'Acknowledged', 'Scheduled', 'Resolved'];

function RequestItem({ r, s, a }: { r: HospitalRequest; s: PortalState; a: PortalActions }) {
    const t = useT();
    const idx = STEPS.indexOf(r.status);
    const forWho = r.for_member_name && r.for_member_name !== (s.card && s.card.name) ? ` · for ${r.for_member_name}` : '';
    return (
        <div className="pt-req">
            <div className="row">
                <div className="t">{t(`${r.channel === 'WhatsApp' ? '💬' : '📞'} ${r.reason ?? ''} · ${r.department ?? ''}`)}</div>
                <span className={`pt-pill ${REQ_PILL[r.status]}`}>{t(REQ_LABEL[r.status] || r.status)}</span>
            </div>
            <div className="d">{t(`${fmtWhen(r.created_at)}${forWho}${r.preferred_time ? ` · Best time: ${r.preferred_time}` : ''}`)}</div>
            {r.message ? <div className="msg">{t(r.message)}</div> : null}
            {r.status !== 'Cancelled' ? (
                <div className="pt-steps">
                    {STEPS.map((st, i) => (
                        <Fragment key={st}>
                            {i > 0 ? <span>›</span> : null}
                            <span className={`s ${i <= idx ? 'on' : ''}`}>{t(REQ_LABEL[st])}</span>
                        </Fragment>
                    ))}
                </div>
            ) : null}
            {r.scheduled_for && r.status !== 'Cancelled' ? <div className="pt-appt">{t(`📅 Appointment: ${r.scheduled_for}`)}</div> : null}
            {r.hospital_note ? <div className="reply">{t('🏥 ')}<strong>{t(`${r.handled_by_name || 'Hospital'}:`)}</strong>{t(` ${r.hospital_note}`)}</div> : null}
            {r.patient_confirmation === 'Disputed' ? <div className="pt-rsvp-note" style={{ color: '#b91c1c' }}>{t("You said this wasn't resolved, so it's open again.")}</div> : null}
            {needsRequestConfirm(r) ? (
                <div className="pt-confirm"><div className="grow">{t('Did the hospital sort this out?')}</div>
                    <button className="pt-btn sm" onClick={() => a.confirmRequest(r.id, true)}>{t('👍 Yes')}</button>
                    <button className="pt-btn sm ghost-danger" onClick={() => a.confirmRequest(r.id, false)}>{t('Not yet')}</button></div>
            ) : null}
            {r.status === 'Resolved' && r.patient_confirmation === 'Confirmed' ? <div className="pt-rsvp-note" style={{ color: '#065f46' }}>{t('✔ You confirmed this was resolved.')}</div> : null}
            {OPEN_STATUSES.includes(r.status) ? <div style={{ textAlign: 'right', marginTop: 8 }}><button className="pt-btn sm ghost-danger" onClick={() => a.cancelRequest(r.id)}>{t('Cancel request')}</button></div> : null}
        </div>
    );
}

interface Props {
    s: PortalState;
    a: PortalActions;
    loaded: boolean;
    active: boolean;
    form: RequestForm;
    setForm: (patch: Partial<RequestForm>) => void;
    refs: RequestFormRefs;
    busy: boolean;
    onSubmit: () => void;
}

/** Members the patient may raise a request for (self, or everyone for the head of family). */
export function requestMembers(s: PortalState) {
    const F = s.family;
    return F ? F.members.filter((m) => m.is_self || F.can_edit) : [];
}

/** The option the "Who is it for?" select shows: the chosen member while still listed, else the first one. */
export function effectiveRequestFor(s: PortalState, forId: string): string {
    const members = requestMembers(s);
    if (forId && members.some((m) => String(m.id) === forId)) return forId;
    return members[0] ? String(members[0].id) : '';
}

export function HospitalPanel({ s, a, loaded, active, form, setForm, refs, busy, onSubmit }: Props) {
    const t = useT();
    const h = s.hospital;
    const members = requestMembers(s);
    const reqs = s.requests;
    const openN = reqs.filter((r) => OPEN_STATUSES.includes(r.status)).length;
    const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-hospital" role="tabpanel" aria-labelledby="tab-hospital" tabIndex={0}>
            <div className="pt-grid-2">
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h">
                            <div>
                                <h2>{t('📞 Request a call from the hospital')}</h2>
                                <p className="pt-sub">{t('The hospital helpdesk will call or message you back.')}</p>
                            </div>
                            <img className="pt-hospital-logo" src="/hospital/sal-hospital-logo.webp" alt="SAL Hospital - Healthcare with Human Touch" width="2559" height="1493" />
                        </div>
                        <form id="requestForm" onSubmit={submit}>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="reqFor">{t('Who is it for?')}</label>
                                <select id="reqFor" className="pt-select" value={effectiveRequestFor(s, form.forId)} onChange={(e) => setForm({ forId: e.target.value })}>
                                    {!loaded ? null : members.length
                                        ? members.map((m) => <option key={m.id} value={String(m.id)}>{t(m.is_self ? `Me (${m.name})` : `${m.name} (${m.relation_to_hof || 'Member'})`)}</option>)
                                        : <option value="">{t('Me')}</option>}
                                </select>
                            </div>
                            <div className="pt-form-2 pt-form-row">
                                <div>
                                    <label className="l" htmlFor="reqDept">{t('Department')}</label>
                                    <select id="reqDept" className="pt-select" ref={refs.reqDept} value={form.dept} onChange={(e) => setForm({ dept: e.target.value })}>
                                        {s.departments.map((d) => <option key={d} value={d}>{t(d)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="l" htmlFor="reqReason">{t('What do you need?')}</label>
                                    <select id="reqReason" className="pt-select" value={form.reason} onChange={(e) => setForm({ reason: e.target.value })}>
                                        {s.reasons.map((d) => <option key={d} value={d}>{t(d)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-form-row">
                                <label className="l">{t('How should they reach you?')}</label>
                                <div className="pt-seg">
                                    <label><input type="radio" name="channel" value="Callback" checked={form.channel === 'Callback'} onChange={() => setForm({ channel: 'Callback' })} /><span>{t('📞 Call me back')}</span></label>
                                    <label><input type="radio" name="channel" value="WhatsApp" checked={form.channel === 'WhatsApp'} onChange={() => setForm({ channel: 'WhatsApp' })} /><span>{t('💬 WhatsApp')}</span></label>
                                </div>
                            </div>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="reqTime">{t('Best time')}</label>
                                <select id="reqTime" className="pt-select" value={form.time} onChange={(e) => setForm({ time: e.target.value })}>
                                    {['Any time', 'Morning (8–12)', 'Afternoon (12–4)', 'Evening (4–8)'].map((o) => <option key={o} value={o}>{t(o)}</option>)}
                                </select>
                            </div>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="reqMsg">{t('Message ')}<span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{t('(optional)')}</span></label>
                                <textarea id="reqMsg" className="pt-textarea" ref={refs.reqMsg} maxLength={1000} placeholder={t('e.g. BP tablet makes me dizzy in the morning')} value={form.msg} onChange={(e) => setForm({ msg: e.target.value })} />
                            </div>
                            <div className="pt-why" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', marginBottom: 12 }}>
                                <span aria-hidden="true">!</span><div>{t('For a medical emergency, seek immediate care at the nearest emergency department. Do not wait for a callback.')}</div>
                            </div>
                            <button type="submit" className="pt-btn primary" id="reqSubmit" style={{ width: '100%' }} disabled={busy}>{busy ? t('Sending…') : t('Send to hospital')}</button>
                        </form>
                    </div>
                </div>
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h"><div className="pt-hospital-heading"><h2>{t('🏥 Your hospital')}</h2><img className="pt-hospital-logo" src="/hospital/sal-hospital-logo.webp" alt="SAL Hospital - Healthcare with Human Touch" width="2559" height="1493" /></div></div>
                        <div id="hospitalBody">
                            {!loaded ? <div className="pt-skel" /> : h ? <>
                                <div className="hosp-card">
                                    <div className="ic">🏥</div>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="hosp-name">{t(h.name)}</div>
                                        <div className="pt-sub">{t([h.type, h.city].filter(Boolean).join(' · '))}</div>
                                        {h.contact_phone ? <div className="pt-sub">{t(`📞 ${h.contact_phone}`)}</div> : null}
                                    </div>
                                </div>
                                <HospitalButtons s={s} a={a} />
                            </> : <div className="pt-empty">{t('Hospital details are not available.')}</div>}
                        </div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('🗂️ Your requests')}</h2><span className="pt-pill mute" id="reqCountPill">{t(`${openN} open`)}</span></div>
                        <div id="requestList">
                            {!loaded ? <div className="pt-skel" /> : reqs.length
                                ? reqs.map((r) => <RequestItem key={r.id} r={r} s={s} a={a} />)
                                : <div className="pt-empty" style={{ padding: 16 }}>{t('No requests yet. Use the form to ask the hospital to call you.')}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
