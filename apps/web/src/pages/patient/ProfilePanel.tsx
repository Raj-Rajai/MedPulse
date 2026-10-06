/** Health card tab: printable card with QR, completeness meter and the profile form (renderCard / fillProfileForm / saveProfile). */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PortalActions } from './actions';
import { useT } from './i18n';
import { cardCompleteness } from './logic';
import { svgModel, type QrSvgModel } from './qr';
import type { PatientCard, PortalState } from './types';
import { api, BLOOD, digits, fmtDay, genderLabel, initials, todayIso } from './util';

function QrSvg({ m }: { m: QrSvgModel }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${m.dim} ${m.dim}`} width={m.width} height={m.height} shapeRendering="crispEdges" role="img" aria-label="QR code">
            <rect width="100%" height="100%" fill={m.light} />
            <path d={m.path} fill={m.dark} />
        </svg>
    );
}

function HealthCard({ c }: { c: PatientCard }) {
    const t = useT();
    let qr: QrSvgModel | null = null;
    try { qr = svgModel(`MEDPULSE:${c.patient_uid}`, { margin: 1, dark: '#0c4a6e' }); } catch { qr = null; }
    const address = c.address || [c.family_address, c.village, c.city].filter(Boolean).join(', ');
    const ec = c.emergency_contact_name
        ? `${c.emergency_contact_name}${c.emergency_contact_relation ? ` (${c.emergency_contact_relation})` : ''} · ${c.emergency_contact_phone || ''}`
        : 'Not added';
    return (
        <>
            <div className="hc-top">
                <div className="hc-brand"><div className="lg"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div><div>{t('MedPulse')}<small>{t('PATIENT HEALTH CARD')}</small></div></div>
                <div className="hc-blood" title={t('Blood group')}><b>{t(c.blood_group && c.blood_group !== 'Unknown' ? c.blood_group : '—')}</b><span>{t('BLOOD')}</span></div>
            </div>
            <div className="hc-mid">
                <div className="hc-av">{t(initials(c.name))}</div>
                <div style={{ minWidth: 0 }}><div className="hc-name">{t(c.name)}</div><div className="hc-uid">{t(c.patient_uid)}</div></div>
            </div>
            <div className="hc-body">
                <div className="hc-fields">
                    <div className="hc-f"><span>{t('Age / Sex')}</span><b>{t([c.age_years ? `${c.age_years} yrs` : '—', genderLabel(c.gender)].filter(Boolean).join(' · '))}</b></div>
                    <div className="hc-f"><span>{t('Date of birth')}</span><b>{t(fmtDay(c.date_of_birth) || '—')}</b></div>
                    <div className="hc-f"><span>{t('Mobile')}</span><b>{t(c.phone || '—')}</b></div>
                    <div className="hc-f"><span>{t('Family')}</span><b>{t(c.family_code || '—')}</b></div>
                    <div className="hc-f wide"><span>{t('Emergency contact')}</span><b>{t(ec)}</b></div>
                    {address ? <div className="hc-f wide"><span>{t('Address')}</span><b>{t(address)}</b></div> : null}
                </div>
                {qr ? <div className="hc-qr" title={t('Scan at the hospital desk')}><QrSvg m={qr} /></div> : null}
            </div>
            <div className="hc-foot"><span>{t(`🏥 ${c.hospital_name || 'MedPulse Network'}`)}</span><span>{t(`Issued ${fmtDay((c.created_at || '').slice(0, 10)) || ''}`)}</span></div>
        </>
    );
}

interface ProfileForm {
    name: string; dob: string; dobMax: string; gender: string; phone: string; email: string; address: string;
    ecName: string; ecRel: string; ecPhone: string; blood: string | null;
}
const EMPTY: ProfileForm = { name: '', dob: '', dobMax: '', gender: 'M', phone: '', email: '', address: '', ecName: '', ecRel: '', ecPhone: '', blood: null };

function formFromCard(c: PatientCard): ProfileForm {
    return {
        name: c.name || '',
        dob: c.date_of_birth || '',
        dobMax: todayIso(),
        gender: ['M', 'F'].includes(c.gender || '') ? (c.gender as string) : (c.gender === 'Male' ? 'M' : c.gender === 'Female' ? 'F' : 'Other'),
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        ecName: c.emergency_contact_name || '',
        ecRel: c.emergency_contact_relation || '',
        ecPhone: c.emergency_contact_phone || '',
        blood: BLOOD.includes(c.blood_group || '') ? (c.blood_group as string) : null,
    };
}

type ErrKey = 'pfNameErr' | 'pfDobErr' | 'pfEmailErr' | 'pfEcPhoneErr';
const EC_RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Friend', 'Neighbour', 'Other'];

export function ProfilePanel({ s, a, active }: { s: PortalState; a: PortalActions; active: boolean }) {
    const t = useT();
    const c = s.card;
    const [f, setF] = useState<ProfileForm>(EMPTY);
    const [filled, setFilled] = useState(false);
    const [errs, setErrs] = useState<Partial<Record<ErrKey, boolean>>>({});
    const [busy, setBusy] = useState(false);
    const cardRef = useRef(c);
    cardRef.current = c;

    // fillProfileForm(): only the first time a card arrives (later refreshes keep what the user typed).
    useEffect(() => {
        if (c && !filled) { setF(formFromCard(c)); setFilled(true); }
    }, [c, filled]);

    const set = (patch: Partial<ProfileForm>) => setF((old) => ({ ...old, ...patch }));
    const errStyle = (k: ErrKey) => (errs[k] === undefined ? undefined : { display: errs[k] ? 'block' : 'none' });

    async function saveProfile() {
        const card = cardRef.current;
        if (!card) return;
        const name = f.name.trim();
        const dob = f.dob;
        const email = f.email.trim();
        const ecPhone = digits(f.ecPhone);
        const badDob = !!dob && dob > todayIso();
        const badEmail = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const badEc = !!ecPhone && (ecPhone.length !== 10 || ecPhone === digits(card.phone));
        setErrs({ pfNameErr: !name, pfDobErr: badDob, pfEmailErr: badEmail, pfEcPhoneErr: badEc });
        if (!name || badDob || badEmail || badEc) return;
        setBusy(true);
        try {
            const d = await api<{ card: PatientCard }>('/api/patient/profile', {
                method: 'PUT', body: {
                    name, date_of_birth: dob || null, gender: f.gender, email: email || null, address: f.address.trim() || null,
                    blood_group: f.blood, emergency_contact_name: f.ecName.trim() || null,
                    emergency_contact_relation: f.ecRel || null, emergency_contact_phone: ecPhone || null,
                },
            });
            setF(formFromCard(d.card));
            await a.profileSaved(d.card);
        } catch (e) { a.showToast((e as Error).message, 'error'); }
        finally { setBusy(false); }
    }
    const submit = (e: FormEvent) => { e.preventDefault(); void saveProfile(); };

    const comp = c ? cardCompleteness(c) : null;
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" tabIndex={0}>
            <div className="pt-grid-card">
                <div>
                    <div className="hc" id="healthCard" aria-label={t('Patient health card')}>
                        {c ? <HealthCard c={c} /> : <div className="pt-skel" style={{ height: 220, opacity: 0.3 }} />}
                    </div>
                    <div className="hc-actions">
                        <button className="pt-btn" onClick={a.printCard}>{t('🖨 Print card')}</button>
                        <button className="pt-btn" onClick={a.copyUid}>{t('📋 Copy patient ID')}</button>
                    </div>
                    <div id="completeness">
                        {comp && comp.missing.length ? (
                            <div className="pt-complete"><strong>{t(`Your card is ${comp.pct}% complete.`)}</strong>{t(` Add ${comp.missing.join(', ').toLowerCase()} so the hospital can help you faster in an emergency.`)}
                                <div className="pt-meter"><i style={{ width: `${comp.pct}%` }} /></div></div>
                        ) : null}
                    </div>
                </div>

                <div className="pt-card">
                    <div className="pt-card-h">
                        <div>
                            <h2>{t('✏ Your details')}</h2>
                            <p className="pt-sub">{t("These appear on your card. Your phone number is your login, so it can't be changed here.")}</p>
                        </div>
                    </div>
                    <form id="profileForm" noValidate onSubmit={submit}>
                        <fieldset className="pt-fieldset">
                            <legend>{t('Basic')}</legend>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="pfName">{t('Full name *')}</label>
                                <input id="pfName" className="pt-input" maxLength={80} required autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
                                <div className="pt-err" id="pfNameErr" style={errStyle('pfNameErr')}>{t('Please enter your name.')}</div>
                            </div>
                            <div className="pt-form-2 pt-form-row">
                                <div>
                                    <label className="l" htmlFor="pfDob">{t('Date of birth')}</label>
                                    <input id="pfDob" type="date" className="pt-input" max={f.dobMax || undefined} value={f.dob} onChange={(e) => set({ dob: e.target.value })} />
                                    <div className="pt-err" id="pfDobErr" style={errStyle('pfDobErr')}>{t("Date of birth can't be in the future.")}</div>
                                </div>
                                <div>
                                    <label className="l" htmlFor="pfGender">{t('Gender')}</label>
                                    <select id="pfGender" className="pt-select" value={f.gender} onChange={(e) => set({ gender: e.target.value })}><option value="M">{t('Male')}</option><option value="F">{t('Female')}</option><option value="Other">{t('Other')}</option></select>
                                </div>
                            </div>
                            <div className="pt-form-row">
                                <label className="l">{t('Blood group')}</label>
                                <div className="pt-bg-picker" id="pfBlood">
                                    {filled ? BLOOD.map((b) => (
                                        <label key={b}><input type="radio" name="pfBlood" value={b} checked={f.blood === b} onChange={() => set({ blood: b })} /><span>{t(b === 'Unknown' ? "Don't know" : b)}</span></label>
                                    )) : null}
                                </div>
                            </div>
                        </fieldset>
                        <fieldset className="pt-fieldset">
                            <legend>{t('Contact')}</legend>
                            <div className="pt-form-2 pt-form-row">
                                <div>
                                    <label className="l" htmlFor="pfPhone">{t('Mobile (login)')}</label>
                                    <input id="pfPhone" className="pt-input" disabled value={f.phone} onChange={() => { /* login phone is fixed */ }} />
                                </div>
                                <div>
                                    <label className="l" htmlFor="pfEmail">{t('Email')}</label>
                                    <input id="pfEmail" type="email" className="pt-input" maxLength={120} autoComplete="email" placeholder={t('optional')} value={f.email} onChange={(e) => set({ email: e.target.value })} />
                                    <div className="pt-err" id="pfEmailErr" style={errStyle('pfEmailErr')}>{t('Enter a valid email.')}</div>
                                </div>
                            </div>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="pfAddress">{t('Address')}</label>
                                <textarea id="pfAddress" className="pt-textarea" style={{ minHeight: 60 }} maxLength={300} autoComplete="street-address" value={f.address} onChange={(e) => set({ address: e.target.value })} />
                            </div>
                        </fieldset>
                        <fieldset className="pt-fieldset">
                            <legend>{t('Emergency contact')}</legend>
                            <div className="pt-form-2 pt-form-row">
                                <div>
                                    <label className="l" htmlFor="pfEcName">{t('Name')}</label>
                                    <input id="pfEcName" className="pt-input" maxLength={80} placeholder={t('e.g. Asha Patel')} value={f.ecName} onChange={(e) => set({ ecName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="l" htmlFor="pfEcRel">{t('Relation')}</label>
                                    <select id="pfEcRel" className="pt-select" value={f.ecRel} onChange={(e) => set({ ecRel: e.target.value })}>
                                        <option value="">{t('Select')}</option>
                                        {EC_RELATIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-form-row">
                                <label className="l" htmlFor="pfEcPhone">{t('Mobile')}</label>
                                <input id="pfEcPhone" className="pt-input" inputMode="numeric" maxLength={10} placeholder={t('10-digit mobile')} value={f.ecPhone} onChange={(e) => set({ ecPhone: e.target.value })} />
                                <div className="pt-err" id="pfEcPhoneErr" style={errStyle('pfEcPhoneErr')}>{t("Enter a 10-digit mobile that isn't your own.")}</div>
                            </div>
                        </fieldset>
                        <button type="submit" className="pt-btn primary" id="pfSave" style={{ width: '100%' }} disabled={busy}>{busy ? t('Saving...') : t('Save details')}</button>
                    </form>
                </div>
            </div>
        </section>
    );
}
