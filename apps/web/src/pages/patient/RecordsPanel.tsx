/** Health records tab: survey link card, medicines, conditions, allergies and follow-up timeline (renderRecords). */
import type { PortalActions } from './actions';
import { useT } from './i18n';
import type { PortalState } from './types';
import { fmtDay } from './util';

function Empty({ text }: { text: string }) {
    const t = useT();
    return <div className="pt-empty" style={{ padding: 14 }}>{t(text)}</div>;
}

export function RecordsPanel({ s, a, loaded, active }: { s: PortalState; a: PortalActions; loaded: boolean; active: boolean }) {
    const t = useT();
    const c = s.card || {};
    const r = s.records || {};
    const meds = r.medications || [], conds = r.conditions || [], alls = r.allergies || [], fus = r.follow_ups || [];
    return (
        <section className={`pt-panel${active ? ' active' : ''}`} id="panel-records" role="tabpanel" aria-labelledby="tab-records" tabIndex={0}>
            <div className="pt-card" id="surveyCard">
                {!loaded ? null : c.student_id ? (
                    <div className="pt-card-h" style={{ margin: 0 }}><div><h2>{t('📝 Health survey')}</h2>
                        <p className="pt-sub">{t("Your family's health survey was done by ")}<strong>{t(c.student_name || 'a medical student')}</strong>{t(`${c.student_roll ? ` (Roll ${c.student_roll})` : ''}${c.college_name ? `, ${c.college_name}` : ''}. Readings below come from that survey and follow-up visits.`)}</p></div></div>
                ) : (
                    <div className="pt-card-h" style={{ margin: 0 }}><div><h2>{t('📝 Health survey')}</h2>
                        <p className="pt-sub">{t('Was your family surveyed by a medical student? Connect it to see those health readings here.')}</p></div>
                        <button className="pt-btn primary sm" onClick={a.openLink}>{t('🔗 Connect survey')}</button></div>
                )}
            </div>
            <div className="pt-grid-2">
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('💊 Medicines')}</h2><span className="pt-pill info" id="medCount">{t(meds.length)}</span></div>
                        <div id="medicationsList">
                            {!loaded ? null : meds.length ? meds.map((m, i) => (
                                <div className="pt-rec" key={i}><div><div className="t">{t(`${m.name ?? ''} ${m.dosage || ''}`)}</div><div className="d">{t(`${m.frequency || 'Daily'}${m.reason ? ` · for ${m.reason}` : ''}`)}</div></div><span className="pt-pill ok">{t('Taking')}</span></div>
                            )) : <Empty text="No medicines recorded." />}
                        </div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('📋 Conditions')}</h2><span className="pt-pill warn" id="condCount">{t(conds.length)}</span></div>
                        <div id="conditionsList">
                            {!loaded ? null : conds.length ? conds.map((x, i) => (
                                <div className="pt-rec" key={i}><div><div className="t">{t(x.condition_name)}</div><div className="d">{t(x.notes || 'Being monitored')}</div></div><span className="pt-pill warn">{t(x.status || 'Active')}</span></div>
                            )) : <Empty text="No long-term conditions recorded." />}
                        </div>
                    </div>
                    <div className="pt-card">
                        <div className="pt-card-h"><h2>{t('⚠️ Allergies')}</h2><span className="pt-pill bad" id="allergyCount">{t(alls.length)}</span></div>
                        <div id="allergiesList">
                            {!loaded ? null : alls.length ? alls.map((x, i) => (
                                <div className="pt-rec" key={i}><div><div className="t" style={{ color: '#b91c1c' }}>{t(x.allergen)}</div><div className="d">{t(`${x.reaction || 'Reaction'}${x.allergy_type ? ` · ${x.allergy_type}` : ''}`)}</div></div><span className="pt-pill bad">{t(x.severity || 'Moderate')}</span></div>
                            )) : <Empty text="No allergies recorded." />}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="pt-card">
                        <div className="pt-card-h">
                            <div>
                                <h2>{t('🩺 Check-up visits')}</h2>
                                <p className="pt-sub">{t('Follow-up visits recorded in your health survey.')}</p>
                            </div>
                        </div>
                        <div id="followupsTimeline">
                            {!loaded ? null : fus.length ? (
                                <div className="pt-tl">{fus.map((f, i) => (
                                    <div className="pt-tl-item" key={i}>
                                        <div className="h"><span>{t(`Visit #${f.visit_number || 1}`)}</span><span>{t(fmtDay(f.visit_date))}</span></div>
                                        <div className="b">{t(f.clinical_notes || 'Routine check-up.')}</div>
                                        <div className="v">
                                            {f.sbp && f.dbp ? <span className={`pt-pill ${(Number(f.sbp) >= 140 || Number(f.dbp) >= 90) ? 'bad' : 'mute'}`}>{t(`BP ${f.sbp}/${f.dbp}`)}</span> : null}
                                            {f.rbs ? <span className={`pt-pill ${Number(f.rbs) >= 200 ? 'bad' : 'mute'}`}>{t(`Sugar ${f.rbs}`)}</span> : null}
                                            {f.hb ? <span className={`pt-pill ${Number(f.hb) < 11 ? 'warn' : 'mute'}`}>{t(`Hb ${f.hb}`)}</span> : null}
                                            {f.health_progress ? <span className="pt-pill ok">{t(f.health_progress)}</span> : null}
                                        </div>
                                        {f.next_visit_date ? <div className="pt-sub" style={{ color: 'var(--pt-dark)', marginTop: 4 }}>{t(`📅 Next visit: ${fmtDay(f.next_visit_date)}`)}</div> : null}
                                    </div>
                                ))}</div>
                            ) : <Empty text="No visits recorded yet." />}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
