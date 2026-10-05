import { chromium } from 'playwright';
import { loginAs } from './harness.mjs';
const B='http://localhost:3730';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pages = { student: ['/student/profile.html','/student/index.html','/student/family-manage.html','/student/entry.html','/student/analytics.html','/student/attendance.html','/student/exams.html','/student/schedule.html','/'], admin:['/admin/admin.html'], patient:['/patient/patient.html','/patient/index.html'], hospital:['/hospital/hospital.html','/hospital/index.html'], none:['/login.html','/register.html','/index.html','/offline.html'] };
let bad = 0;
for (const [role, list] of Object.entries(pages)) for (const u of list) {
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/academic|fonts\.g|status of 404/.test(m.text())) errs.push('console ' + m.text().slice(0,120)); });
  p.on('response', r => { const x=r.url(); if (r.status()>=400 && !x.includes('/api/academic') && !x.includes('fonts.g')) errs.push(r.status()+' '+x); });
  if (role !== 'none') await loginAs(p, B, role);
  await p.goto(B + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const t = await p.innerText('body'); if (/\bundefined\b|\bNaN\b/.test(t)) errs.push('text shows undefined/NaN');
  if (errs.length) bad++;
  console.log(errs.length ? '✗' : '✓', role, u, '→', new URL(p.url()).pathname, errs.join(' | '));
  await p.close();
}
const p = await b.newPage(); await loginAs(p, B, 'student'); await p.goto(B + '/student/family-manage.html', { waitUntil: 'networkidle' });
const r = await p.evaluate(async () => {
  const fams = await (await fetch('/api/families')).json();
  const fam = (fams.families || fams)[0]; const fd = await (await fetch('/api/families/' + fam.id)).json();
  const mid = (fd.members || fd.family?.members)[0].id;
  const post = (u, body) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async x => x.status + ' ' + (await x.text()).slice(0, 60));
  const out = {};
  out.med = await post(`/api/members/${mid}/medications`, { medication_name: 'Metformin', dosage: '500mg', frequency: 'BD (Twice daily)', route: 'Oral', prescribed_for: 'Diabetes', start_date: null, adherence_status: 'Good' });
  out.hist = await post(`/api/members/${mid}/history`, { event_type: 'Surgery', description: 'Appendectomy', event_date: '2019', facility_name: 'Civil Hospital', outcome_notes: 'Recovered' });
  out.alg = await post(`/api/members/${mid}/allergies`, { allergen: 'Dust', allergy_type: 'Environmental', severity: 'Mild', reaction_description: 'Sneezing' });
  const m = await (await fetch('/api/members/' + mid)).json();
  out.read = { med: m.medications?.[0] && [m.medications[0].medication_name, m.medications[0].prescribed_for], hist: m.history?.[0] && [m.history[0].event_type, m.history[0].event_date, m.history[0].facility_name, m.history[0].outcome_notes], alg: m.allergies?.[0]?.reaction_description, followUps: Array.isArray(m.follow_ups), err: m.error };
  return { mid, ...out };
});
console.log(JSON.stringify(r));
await b.close(); process.exit(bad ? 1 : 0);
