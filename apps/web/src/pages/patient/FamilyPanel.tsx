import type { PortalActions } from './actions';
import { useT } from './i18n';
import type { FamilyMember, PortalState } from './types';
import { initials } from './util';
import { GuardianRequest, PrivacyControls } from './PrivacyControls';
function MemberCard({ m, a, canManage }: { m: FamilyMember; a: PortalActions; canManage: boolean }) {
    const t = useT();
    return <article className={`mem ${m.is_self ? 'self' : ''}`}>
        <div className="mem-top"><div className="mem-av">{initials(m.name)}</div><div><div className="mem-name">{m.name}</div><div className="mem-sub">{t(m.is_self ? 'You' : m.relation_to_hof || 'Family member')}</div>{m.medpulse_id && <div className="mem-sub mono">{m.medpulse_id}</div>}</div></div>
        <div className="mem-tags"><span className="pt-pill mute">{t(m.surveyed ? 'Health survey recorded' : 'Member registered')}</span><span className="pt-pill info">{t(m.can_view_records ? 'Record access authorized' : 'Health records private')}</span></div>
        <div className="mem-actions">
            {m.can_view_records ? <button className="pt-btn sm" onClick={() => a.openRecords(m.id)}>{t(m.is_self ? 'Open my record' : 'Open authorized record')}</button> : m.can_request_guardian ? <GuardianRequest member={m} a={a} /> : <span className="pt-sub">{t('Individual consent is required to view this adult’s health records.')}</span>}
            {m.is_self ? <button className="pt-btn sm" onClick={() => a.showTab('profile')}>{t('My details')}</button> : null}
            {m.can_edit ? <button className="pt-btn sm" onClick={() => a.editMember(m.id)}>{t('Edit basic details')}</button> : null}
            {canManage || m.is_self ? <button className="pt-btn sm" onClick={() => a.requestFor(m.id)}>{t('Request appointment')}</button> : null}
            {m.can_delete ? <button className="pt-btn sm ghost-danger" onClick={() => a.removeMember(m.id)}>{t('Remove')}</button> : null}
        </div>
    </article>;
}
export function FamilyPanel({ s, a }: { s: PortalState; a: PortalActions; active: boolean }) {
    const t = useT(); const family = s.family; const f = family?.family;
    return <section className="pt-panel active" id="panel-family" role="tabpanel" aria-labelledby="tab-family">
        <div className="pt-section-intro"><span className="pt-eyebrow">{t('MY FAMILY')}</span><h2>{t('Connected as a family. Private as individuals.')}</h2><p>{t('Manage household members here. Each person’s clinical information has separate access permissions.')}</p></div>
        <div className="pt-card"><div className="fam-head"><div><h2 className="fam-title">{f?.family_name || t('Your household')}</h2><div className="fam-meta">{f?.family_code} · {family?.members.length || 0} {t('members')}</div></div>{family?.can_edit ? <div className="pt-heading-actions"><button className="pt-btn" onClick={a.editFamily}>{t('Edit household details')}</button><button className="pt-btn primary" onClick={a.addMember}>{t('Add member')}</button></div> : null}</div></div>
        <div className="pt-note"><span aria-hidden="true">⌑</span><div>{t('Being the head of a family does not grant access to another adult’s medical information. Guardian access is reviewed by authorized staff and expires automatically.')}</div></div>
        <div className="fam-grid">{family?.members.map(m => <MemberCard key={m.id} m={m} a={a} canManage={!!family.can_edit} />)}</div>
        <PrivacyControls s={s} a={a} />
        <article className="pt-card"><h2>{t('Your care team')}</h2>{s.card?.student_id ? <p className="pt-sub">{t('Your household is linked to')} {s.card.student_name || t('a medical student')}.</p> : <><p className="pt-sub">{t('Use a student referral code to connect your household with a care team. Existing medical-record ownership must be verified separately by staff.')}</p><button className="pt-btn" onClick={a.openLink}>{t('Connect care team')}</button></>}</article>
    </section>;
}
