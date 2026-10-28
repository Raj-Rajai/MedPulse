/** Identification card intentionally excludes clinical and contact information. */
import { useEffect, useState, type FormEvent } from 'react';
import type { PortalActions } from './actions';
import { useT } from './i18n';
import { svgModel } from './qr';
import type { PatientCard, PortalState } from './types';
import { api, initials, todayIso } from './util';

export function cardReference(c: PatientCard): string {
    return `MEDPULSE-ID:${c.patient_uid || ''}`;
}
export function IdentificationCard({ c }: { c: PatientCard }) {
    const t = useT();
    const qr = c.patient_uid ? svgModel(cardReference(c), { margin: 4, scale: 3, dark: '#134e4a' }) : null;
    return <div className="hc" id="healthCard" aria-label="Patient identification card">
        <div className="hc-top"><div className="hc-brand"><div className="lg">M</div><div>MedPulse<small>{t('PATIENT IDENTIFICATION')}</small></div></div><span className="pt-pill mute">{t('ID only')}</span></div>
        <div className="hc-mid"><div className="hc-av">{initials(c.name)}</div><div><div className="hc-name">{c.name}</div><div className="hc-uid">{c.patient_uid}</div></div></div>
        <div className="hc-body"><div className="hc-fields"><div className="hc-f"><span>{t('Age')}</span><b>{c.age_years == null ? '—' : `${c.age_years} years`}</b></div><div className="hc-f wide"><span>{t('Identification reference only')}</span><b>{t('Not a clinical document or access credential.')}</b></div></div>
            {qr && <div className="hc-qr"><svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${qr.dim} ${qr.dim}`} width={qr.width} height={qr.height} aria-label="Identification reference QR code" role="img"><rect width="100%" height="100%" fill={qr.light} /><path d={qr.path} fill={qr.dark} /></svg></div>}
        </div><div className="hc-foot">{t('Clinical records require separate authorized sign-in.')}</div>
    </div>;
}

function PrivateProfile({ c, a }: { c: PatientCard; a: PortalActions }) {
    const t = useT();
    const [form, setForm] = useState({ name: c.name || '', date_of_birth: c.date_of_birth || '', gender: c.gender || 'Other', email: c.email || '', address: c.address || '', emergency_contact_name: c.emergency_contact_name || '', emergency_contact_relation: c.emergency_contact_relation || '', emergency_contact_phone: c.emergency_contact_phone || '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function save(e: FormEvent) {
        e.preventDefault(); setBusy(true); setError('');
        try {
            const { card } = await api<{ card: PatientCard }>('/api/patient/profile', { method: 'PUT', body: form });
            await a.profileSaved(card);
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }
    return <form onSubmit={save} className="pt-private-profile">
        <p className="pt-sub">{t('Private contact details are available to your care team. They are excluded from the identification card and printout.')}</p>
        <div className="pt-form-2">
            <label className="pt-form-row">{t('Full name')}<input className="pt-input" required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className="pt-form-row">{t('Date of birth')}<input className="pt-input" type="date" max={todayIso()} value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></label>
            <label className="pt-form-row">{t('Gender')}<select className="pt-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="M">{t('Male')}</option><option value="F">{t('Female')}</option><option value="Other">{t('Other')}</option></select></label>
            <label className="pt-form-row">{t('Mobile (login)')}<input className="pt-input" disabled value={c.phone || ''} /></label>
            <label className="pt-form-row">{t('Email')}<input className="pt-input" type="email" maxLength={120} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label className="pt-form-row">{t('Address')}<textarea className="pt-textarea" maxLength={300} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
            <label className="pt-form-row">{t('Emergency contact name')}<input className="pt-input" maxLength={80} value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} /></label>
            <label className="pt-form-row">{t('Relationship')}<input className="pt-input" maxLength={40} value={form.emergency_contact_relation} onChange={e => setForm({ ...form, emergency_contact_relation: e.target.value })} /></label>
            <label className="pt-form-row">{t('Emergency contact phone')}<input className="pt-input" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} /></label>
        </div>{error && <p role="alert" className="pt-form-error">{error}</p>}<button className="pt-btn primary" disabled={busy}>{t(busy ? 'Saving...' : 'Save private details')}</button>
    </form>;
}
export function ProfilePanel({ s, a }: { s: PortalState; a: PortalActions; active: boolean }) {
    const t = useT(); const [privateOpen, setPrivateOpen] = useState(false);
    useEffect(() => {
        const hide = () => { if (document.hidden) setPrivateOpen(false); };
        document.addEventListener('visibilitychange', hide);
        return () => document.removeEventListener('visibilitychange', hide);
    }, []);
    return <section className="pt-panel active" id="panel-profile" role="tabpanel" aria-labelledby="tab-profile">
        <div className="pt-section-intro"><span className="pt-eyebrow">{t('YOUR IDENTIFICATION')}</span><h2>{t('A card with only what is needed.')}</h2><p>{t('Your name, patient ID and age. Your medical information stays in Health records.')}</p></div>
        {s.card && <><IdentificationCard c={s.card} /><div className="hc-actions"><button className="pt-btn" onClick={a.printCard}>{t('Print identification card')}</button><button className="pt-btn" onClick={a.copyUid}>{t('Copy patient ID')}</button></div>
            <div className="pt-card"><button className="pt-btn" aria-expanded={privateOpen} onClick={() => setPrivateOpen(v => !v)}>{t(privateOpen ? 'Hide private contact details' : 'View or edit private contact details')}</button>{privateOpen && <PrivateProfile c={s.card} a={a} />}</div></>}
    </section>;
}
