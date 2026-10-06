/** Family tab: household header, notice and member cards (renderFamily). */
import type { ReactElement } from 'react';
import type { PortalActions } from './actions';
import { useT } from './i18n';
import { ageText } from './logic';
import type { FamilyMember, PortalState } from './types';
import { avColor, genderLabel, initials } from './util';

function HealthPills({ m }: { m: FamilyMember }) {
    const t = useT();
    const out: ReactElement[] = [];
    if (m.sbp && m.dbp) out.push(<span key="bp" className={`pt-pill ${(m.sbp >= 140 || m.dbp >= 90) ? 'bad' : 'mute'}`}>{t(`BP ${m.sbp}/${m.dbp}`)}</span>);
    if (m.rbs) out.push(<span key="rbs" className={`pt-pill ${m.rbs >= 200 ? 'bad' : m.rbs >= 140 ? 'warn' : 'mute'}`}>{t(`Sugar ${m.rbs}`)}</span>);
    if (m.hb) out.push(<span key="hb" className={`pt-pill ${m.hb < 11 ? 'warn' : 'mute'}`}>{t(`Hb ${m.hb}`)}</span>);
    if (m.bmi) out.push(<span key="bmi" className="pt-pill mute">{t(`BMI ${Number(m.bmi).toFixed(1)}`)}</span>);
    if (m.conditions) m.conditions.split(', ').slice(0, 3).forEach((c, i) => out.push(<span key={`c${i}`} className="pt-pill warn">{t(c)}</span>));
    return out.length ? <>{out}</> : <span className="pt-sub">{t('No readings yet')}</span>;
}

function MemberCard({ m, canEdit, a }: { m: FamilyMember; canEdit: boolean; a: PortalActions }) {
    const t = useT();
    const self = !!m.is_self;
    return (
        <article className={`mem ${self ? 'self' : ''}`}>
            <div className="mem-top">
                <div className="mem-av" style={{ background: avColor(m.name) }}>{t(initials(m.name))}</div>
                <div style={{ minWidth: 0 }}>
                    <div className="mem-name">{t(m.name)}</div>
                    <div className="mem-sub">{t(`${self ? 'You' : (m.relation_to_hof || 'Member')} · ${ageText(m)}${m.gender ? ` · ${genderLabel(m.gender)}` : ''}`)}</div>
                    {m.contact_number ? <div className="mem-sub">{t(`📞 ${m.contact_number}`)}</div> : null}
                    {m.occupation || m.education ? <div className="mem-sub">{t([m.occupation, m.education].filter(Boolean).join(' · '))}</div> : null}
                </div>
            </div>
            <div className="mem-tags">
                {self ? <span className="pt-pill info">{t('You')}</span> : null}
                {m.relation_to_hof === 'Head' && !self ? <span className="pt-pill ok">{t('👑 Head')}</span> : null}
                {m.account_uid && !self ? <span className="pt-pill mute">{t('📱 Has own account')}</span> : null}
                {m.surveyed ? <span className="pt-pill mute">{t('📝 From health survey')}</span> : <span className="pt-pill mute">{t('✍ Added by family')}</span>}
                {m.patient_updated_at && m.surveyed && !self ? <span className="pt-pill warn">{t('Updated by you')}</span> : null}
            </div>
            <div className="mem-health"><span className="lbl">{t('Health (read-only)')}</span><HealthPills m={m} /></div>
            <div className="mem-actions">
                {self ? <button className="pt-btn sm" onClick={() => a.showTab('profile')}>{t('✏ Edit my details')}</button> : null}
                {m.can_edit ? <button className="pt-btn sm" onClick={() => a.editMember(m.id)}>{t('✏ Edit')}</button> : null}
                {canEdit || self ? <button className="pt-btn sm" onClick={() => a.requestFor(m.id)}>{t('📞 Call hospital')}</button> : null}
                {m.can_delete ? <button className="pt-btn sm ghost-danger icon" onClick={() => a.removeMember(m.id)} aria-label={t(`Remove ${m.name}`)} title={t('Remove')}>🗑</button> : null}
            </div>
        </article>
    );
}

export function FamilyPanel({ s, a, active }: { s: PortalState; a: PortalActions; active: boolean }) {
    const t = useT();
    const F = s.family;
    const f = F && F.family ? F.family : null;
    const canEdit = !!(F && F.can_edit);
    const addr = f ? [f.address, f.village, f.city, f.district, f.pincode].filter(Boolean).join(', ') : '';
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-family" role="tabpanel" aria-labelledby="tab-family" tabIndex={0}>
            <div className="pt-card">
                <div className="fam-head" id="famHead">
                    {F && f ? <>
                        <div style={{ minWidth: 0 }}>
                            <h2 className="fam-title">{t(`👪 ${f.family_name || `${f.head_of_family}'s family`}`)}</h2>
                            <div className="fam-meta">{t(`${f.family_code || ''}${addr ? ` · 📍 ${addr}` : ''}`)}</div>
                            <div className="fam-stats">
                                <span className="pt-pill info">{t(`${F.members.length} member${F.members.length === 1 ? '' : 's'}`)}</span>
                                <span className={`pt-pill ${canEdit ? 'ok' : 'mute'}`}>{t(canEdit ? '👑 You are head of family' : '👁 View only')}</span>
                                {f.student_name ? <span className="pt-pill mute">{t(`📝 Health survey: ${f.student_name}`)}</span> : null}
                            </div>
                        </div>
                        {canEdit ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="pt-btn" onClick={a.editFamily}>{t('🏠 Edit address')}</button><button className="pt-btn primary" onClick={a.addMember}>{t('＋ Add member')}</button></div> : null}
                    </> : <div className="pt-skel" style={{ width: '100%' }} />}
                </div>
            </div>
            <div id="famNotice">
                {F && f ? (canEdit
                    ? <div className="pt-note"><span>ℹ</span><div>{t("You can add family members and update their basic details. Health readings and diagnoses come from the hospital and health survey team, so they can't be edited here.")}</div></div>
                    : <div className="pt-note"><span>👁</span><div>{t('Only ')}<strong>{t(f.head_of_family)}</strong>{t(' (head of family) can make changes. You can view your family here.')}</div></div>) : null}
            </div>
            <div className="fam-grid" id="famGrid">
                {F && f ? <>
                    {F.members.map((m) => <MemberCard key={m.id} m={m} canEdit={canEdit} a={a} />)}
                    {canEdit ? <button type="button" className="mem-add" onClick={a.addMember}><span className="plus">＋</span>{t('Add family member')}</button> : null}
                </> : null}
            </div>
        </section>
    );
}
