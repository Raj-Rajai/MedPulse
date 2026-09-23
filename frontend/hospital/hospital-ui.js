(() => {
'use strict';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 pulse:'M2 12h4l3-8 6 16 3-8h4', grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
 calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 10h18 M7 14h2 M12 14h2 M7 17h2',
 bed:'M3 4v17 M21 12v9 M3 17h18 M3 12h18 M7 8h3v4H7z M13 8h5a3 3 0 0 1 3 3v1h-8z',
 staff:'M6 3v6a6 6 0 0 0 12 0V3 M4 3h4 M16 3h4 M12 15v3a4 4 0 0 0 8 0v-3 M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
 building:'M5 21V4h14v17 M3 21h18 M9 21v-5h6v5 M9 8h1 M14 8h1 M9 12h1 M14 12h1',
 chart:'M3 3v18h18 M7 16v-4 M12 16V7 M17 16v-7',shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',
 logout:'M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4',chevron:'m9 5 6 7-6 7',menu:'M3 6h18 M3 12h18 M3 18h18',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',plus:'M12 5v14 M5 12h14',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',close:'m6 6 12 12 M18 6 6 18',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',alert:'m12 3 10 18H2z M12 9v5 M12 17v1'};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.pulse}"/></svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }

const state = { offset: 0, limit: 25, total: 0, options: { students: [], universities: [] }, searchSequence: 0, detailSequence: 0 };
const regState = { offset: 0, limit: 25, total: 0, searchSequence: 0 };
const labels = { HTN: 'Hypertension', DM: 'Diabetes', Anaemia: 'Anaemia', Pediatric: 'Children aged 0–5', NoFollowUp: 'No follow-up recorded' };
const shown = v => v === null || v === undefined || v === '' ? 'Not recorded' : escape(v);

function getInitials(name) {
  if (!name) return 'PT';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function closeNav() {
  $('sidebar').classList.remove('open');
  $('scrim').hidden = true;
  $('menuButton').setAttribute('aria-expanded', 'false');
}

function navigate() {
  const key = location.hash.slice(1);
  const view = ['patients', 'network', 'registered'].includes(key) ? key : 'overview';
  document.querySelectorAll('[data-page]').forEach(e => e.hidden = !e.dataset.page.split(' ').includes(view));
  document.querySelectorAll('[data-view]').forEach(e => {
    e.classList.toggle('active', e.dataset.view === view);
    if (e.dataset.view === view) e.setAttribute('aria-current', 'page');
    else e.removeAttribute('aria-current');
  });

  const titles = {
    overview: 'FAP control centre',
    patients: 'FAP patient registry',
    registered: 'Registered hospital patients',
    network: 'Colleges & students'
  };
  const crumbs = {
    overview: 'Control centre',
    patients: 'Patient registry',
    registered: 'Registered patients',
    network: 'Care network'
  };

  $('pageTitle').innerHTML = (titles[view] || 'FAP control centre') + '<span>.</span>';
  $('breadcrumb').textContent = crumbs[view] || 'Control centre';
  closeNav();

  if (view === 'registered') {
    loadRegisteredPatients();
  }
}

async function api(path, options = {}) {
  const fetchOpts = { ...options };
  if (options.body && typeof options.body === 'object') {
    fetchOpts.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    fetchOpts.body = JSON.stringify(options.body);
  }
  const response = await fetch('/api/hospital/' + path, fetchOpts);
  const data = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? 'Your hospital session expired. Please sign in again.' : (data.error || 'Could not complete request.'));
  return data;
}

function error(message) {
  $('errorText').textContent = message;
  $('loadError').hidden = false;
}

function params() {
  return new URLSearchParams({
    search: $('patientSearch').value.trim(),
    student_id: $('studentFilter').value,
    university_id: $('universityFilter').value,
    condition: $('conditionFilter').value,
    limit: state.limit,
    offset: state.offset
  });
}

function conditions(p) {
  const values = [p.has_htn === 'Y' ? 'Hypertension' : '', p.has_dm === 'Y' ? 'Diabetes' : '', p.has_anaemia === 'Y' ? 'Anaemia' : '', p.conditions_summary || ''].filter(Boolean);
  return values.length ? escape([...new Set(values)].join(' · ')) : 'No condition recorded';
}

function syncQuickChips() {
  const currentCondition = $('conditionFilter') ? $('conditionFilter').value : '';
  document.querySelectorAll('[data-condition-chip]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.conditionChip === currentCondition);
  });
}

function syncFilterUI() {
  syncQuickChips();
  const searchVal = $('patientSearch') ? $('patientSearch').value.trim() : '';
  const clearBtn = $('searchClearBtn');
  if (clearBtn) clearBtn.hidden = !searchVal;

  const container = $('activeFilterTags');
  if (!container) return;

  const tags = [];
  if (searchVal) {
    tags.push(`<span class="active-tag">Search: “${escape(searchVal)}”<button type="button" class="active-tag-remove" data-remove-filter="search" aria-label="Clear search term">✕</button></span>`);
  }
  const univSelect = $('universityFilter');
  if (univSelect && univSelect.value) {
    const text = univSelect.options[univSelect.selectedIndex]?.textContent || 'College';
    tags.push(`<span class="active-tag">College: ${escape(text)}<button type="button" class="active-tag-remove" data-remove-filter="university" aria-label="Remove college filter">✕</button></span>`);
  }
  const studentSelect = $('studentFilter');
  if (studentSelect && studentSelect.value) {
    const text = studentSelect.options[studentSelect.selectedIndex]?.textContent || 'Student';
    tags.push(`<span class="active-tag">Student: ${escape(text)}<button type="button" class="active-tag-remove" data-remove-filter="student" aria-label="Remove student filter">✕</button></span>`);
  }
  const condSelect = $('conditionFilter');
  if (condSelect && condSelect.value) {
    const text = labels[condSelect.value] || condSelect.value;
    tags.push(`<span class="active-tag">Indicator: ${escape(text)}<button type="button" class="active-tag-remove" data-remove-filter="condition" aria-label="Remove indicator filter">✕</button></span>`);
  }

  if (tags.length) {
    container.innerHTML = `<span style="font-size:11px;font-weight:650;color:#537365;margin-right:2px">Active filters:</span>${tags.join('')}<button type="button" class="active-tag-clear-all" id="clearAllFiltersTag">Clear all</button>`;
    container.hidden = false;
  } else {
    container.innerHTML = '';
    container.hidden = true;
  }
}

function renderTable(patients) {
  if (!patients.length) {
    $('patientTable').innerHTML = `<table><thead><tr>
      <th>Patient / FAP record</th>
      <th>Family & location</th>
      <th>Surveying student</th>
      <th>Recorded indicators</th>
      <th>Follow-up</th>
      <th>Record & Action</th>
    </tr></thead><tbody>
      <tr><td colspan="6" class="empty">No matching FAP records. Try another name, family, village or student, or clear the filters.</td></tr>
    </tbody></table>`;
    return;
  }

  $('patientTable').innerHTML = `<table><thead><tr>
    <th>Patient / FAP record</th>
    <th>Family & location</th>
    <th>Surveying student</th>
    <th>Recorded indicators</th>
    <th>Follow-up</th>
    <th>Record & Action</th>
  </tr></thead><tbody>${patients.map(p => {
    const initials = getInitials(p.name);
    const genderClass = p.gender === 'F' ? 'gender-f' : (p.gender === 'M' ? 'gender-m' : 'gender-other');
    const genderLabel = p.gender === 'F' ? 'Female' : (p.gender === 'M' ? 'Male' : shown(p.gender));
    const ageLabel = p.age_years !== null && p.age_years !== undefined ? `${escape(p.age_years)}y${p.age_months ? ` ${escape(p.age_months)}m` : ''}` : 'Age unrecorded';

    // Condition tags
    const conditionTags = [];
    if (p.has_htn === 'Y') conditionTags.push('<span class="cond-tag cond-htn" title="Hypertension Screened">HTN</span>');
    if (p.has_dm === 'Y') conditionTags.push('<span class="cond-tag cond-dm" title="Diabetes Mellitus Screened">DM</span>');
    if (p.has_anaemia === 'Y') conditionTags.push('<span class="cond-tag cond-anaemia" title="Anaemia Detected">Anaemia</span>');
    if (p.conditions_summary) {
      const customs = p.conditions_summary.split(',').map(s => s.trim()).filter(Boolean);
      customs.forEach(c => {
        if (!['Hypertension', 'Diabetes', 'Anaemia'].includes(c)) {
          conditionTags.push(`<span class="cond-tag cond-other" title="${escape(c)}">${escape(c)}</span>`);
        }
      });
    }
    const tagsHtml = conditionTags.length ? conditionTags.join('') : '<span class="cond-tag cond-none">No flagged conditions</span>';

    // Vitals highlighting
    const sbp = p.sbp;
    const dbp = p.dbp;
    const isHtnAlert = (sbp && Number(sbp) >= 140) || (dbp && Number(dbp) >= 90);
    const rbs = p.rbs;
    const isDmAlert = (rbs && Number(rbs) >= 140);
    const hb = p.hb;
    const isHbAlert = (hb && ((p.gender === 'F' && Number(hb) < 11) || (p.gender === 'M' && Number(hb) < 12) || Number(hb) < 11));

    // Follow-up status
    const followUps = Number(p.follow_up_count) || 0;
    const followUpHtml = followUps > 0 
      ? `<div class="followup-pill visited"><span class="dot-status green"></span>${followUps} visit${followUps > 1 ? 's' : ''}</div><div class="followup-date">Last: ${shown(p.last_visit)}</div>`
      : `<div class="followup-pill pending"><span class="dot-status amber"></span>Needs follow-up</div><div class="followup-date pending-text">0 visits recorded</div>`;

    return `<tr>
      <td>
        <div class="patient-cell">
          <div class="patient-avatar ${genderClass}">${initials}</div>
          <div class="patient-info">
            <strong class="patient-name">${shown(p.name)}</strong>
            <div class="patient-meta-row">
              <span class="fap-id-badge">FAP-${p.id}</span>
              <span class="demographics-tag">${ageLabel} / ${genderLabel}</span>
            </div>
            <div class="patient-contact">${p.contact_number ? `<span class="contact-num">📞 ${escape(p.contact_number)}</span>` : '<span class="contact-none">No phone recorded</span>'}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="family-cell">
          <span class="family-code-badge">${shown(p.family_code || `Family ${p.family_id}`)}</span>
          <div class="family-meta-row"><span class="dim-label">Head:</span> <span class="head-name">${shown(p.head_of_family)}</span></div>
          <div class="family-meta-row"><span class="dim-icon">📍</span> <span class="village-name">${shown(p.village)}</span></div>
        </div>
      </td>
      <td>
        <div class="student-cell">
          <div class="student-name">👨‍⚕️ ${shown(p.student_name)}</div>
          <div class="student-sub">
            <span class="roll-badge">Roll ${shown(p.student_roll)}</span>
            <span class="college-abbr" title="${escape(p.university_name || '')}">${shown(p.university_name)}</span>
          </div>
        </div>
      </td>
      <td class="wrap-cell clinical-cell">
        <div class="condition-tags-row">${tagsHtml}</div>
        <div class="vitals-strip">
          <span class="vital-chip ${isHtnAlert ? 'vital-alert' : ''}" title="Blood Pressure (SBP/DBP)">BP <b>${shown(p.sbp)} / ${shown(p.dbp)}</b></span>
          <span class="vital-chip ${isDmAlert ? 'vital-alert' : ''}" title="Random Blood Sugar (mg/dL)">RBS <b>${shown(p.rbs)}</b></span>
          ${hb ? `<span class="vital-chip ${isHbAlert ? 'vital-alert' : ''}" title="Haemoglobin (g/dL)">Hb <b>${escape(hb)}</b></span>` : ''}
        </div>
      </td>
      <td>
        <div class="followup-cell">${followUpHtml}</div>
      </td>
      <td>
        <div class="actions-cell">
          <button class="button action-open-btn" data-patient="${p.id}" aria-label="Open FAP record for ${escape(p.name)}">
            <span>Open</span>
            <span class="arrow-sym">→</span>
          </button>
          <button type="button" class="button action-register-btn" data-register-patient="${p.id}" aria-label="Register hospital visit for ${escape(p.name)}">
            <span>+ Register</span>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function search() {
  const seq = ++state.searchSequence;
  $('patientTable').innerHTML = '<p class="empty">Searching student-entered records…</p>';
  $('previousPage').disabled = true;
  $('nextPage').disabled = true;
  $('pageInfo').textContent = 'Searching…';
  syncFilterUI();
  try {
    const data = await api('fap/patients?' + params());
    if (seq !== state.searchSequence) return;
    state.total = data.total;
    renderTable(data.patients);
    $('patientCount').textContent = `${data.total} matching records`;
    $('pageInfo').textContent = data.total ? `${data.offset + 1}–${data.offset + data.patients.length} of ${data.total} patients` : '0 matching patients';
    $('previousPage').disabled = state.offset === 0;
    $('nextPage').disabled = state.offset + state.limit >= data.total;
    $('updatedAt').textContent = 'Records loaded at ' + new Date().toLocaleTimeString();
  } catch (e) {
    if (seq !== state.searchSequence) return;
    $('patientTable').innerHTML = '<p class="empty">Records could not be loaded. Use Retry above.</p>';
    $('pageInfo').textContent = 'Unable to load records';
    error(e.message);
  }
}

function renderStudents() {
  const college = $('universityFilter').value;
  const selected = $('studentFilter').value;
  $('studentFilter').innerHTML = '<option value="">All students</option>' + state.options.students.filter(s => !college || String(s.college_id) === college).map(s => `<option value="${s.id}">${escape(s.name)} · Roll ${escape(s.roll_number)}</option>`).join('');
  if ([...$('studentFilter').options].some(o => o.value === selected)) $('studentFilter').value = selected;
}

async function loadSummary() {
  const [summary, options] = await Promise.all([api('fap/summary'), api('fap/options')]);
  state.options = options;
  const university = $('universityFilter').value;
  $('universityFilter').innerHTML = '<option value="">All colleges</option>' + options.universities.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('');
  if ([...$('universityFilter').options].some(o => o.value === university)) $('universityFilter').value = university;
  renderStudents();
  $('metrics').innerHTML = [['Surveyed patients', summary.totals.patients, 'users'], ['Adopted families', summary.totals.families, 'building'], ['Surveying students', summary.totals.students, 'staff'], ['Follow-up visits', summary.totals.follow_ups, 'calendar']].map(([label, value, type]) => `<article class="metric"><div class="metric-top">${label}<span class="metric-icon">${icon(type)}</span></div><div class="metric-value">${Number(value).toLocaleString()}</div><div class="metric-foot">From accessible FAP records</div></article>`).join('');
  $('conditions').innerHTML = summary.conditions.map(c => `<button class="indicator" data-condition="${c.key}"><span>${labels[c.key]}</span><strong>${c.count}</strong><span>→</span></button>`).join('');
  $('universities').innerHTML = summary.universities.length ? summary.universities.map(c => `<div class="list-row"><span class="avatar teal">${icon('building')}</span><div><strong>${shown(c.name)}</strong><small>${c.patient_count} surveyed patients</small></div></div>`).join('') : '<p class="empty">No student surveys available for this hospital.</p>';
  $('studentNetwork').innerHTML = options.students.length ? options.students.map(s => `<div class="list-row"><span class="avatar teal">${escape(s.name.slice(0, 1))}</span><div><strong>${escape(s.name)}</strong><small>Roll ${escape(s.roll_number)} · ${shown(options.universities.find(c => c.id === s.college_id)?.name)}</small></div><button class="button" data-student="${s.id}">View patients →</button></div>`).join('') : '<p class="empty">No students with accessible FAP records.</p>';
}

function detailsGrid(pairs) { return `<dl class="detail-grid">${pairs.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${shown(value)}</dd></div>`).join('')}</dl>`; }
function listSection(title, records, fields) { return `<section class="dossier-section"><h3>${title}</h3>${records.length ? records.map(r => detailsGrid(fields.map(([label, key]) => [label, r[key]]))).join('<hr>') : '<p class="form-note">No entries recorded.</p>'}</section>`; }
function surveySection(title, v, keys) { return `<section class="dossier-section"><h3>${title}</h3>${detailsGrid(keys.map(([label, key]) => [label, v[key]]))}</section>`; }

async function openPatient(id) {
  const seq = ++state.detailSequence;
  $('modalTitle').textContent = `FAP-${id}`;
  $('modalBody').innerHTML = '<p class="empty">Loading student survey and follow-ups…</p>';
  $('modal').showModal();
  try {
    const d = await api('fap/patients/' + id);
    if (seq !== state.detailSequence) return;
    const m = d.member, v = d.vitals, f = d.family;
    $('modalTitle').textContent = m.name;

    const sbp = v.sbp ? Number(v.sbp) : null;
    const dbp = v.dbp ? Number(v.dbp) : null;
    let bpStatus = 'Not assessed';
    let bpClass = 'vitals-sub-dim';
    if (sbp || dbp) {
      if ((sbp && sbp >= 140) || (dbp && dbp >= 90)) {
        bpStatus = 'Hypertension (Elevated)';
        bpClass = 'vitals-sub-alert';
      } else {
        bpStatus = 'Normal Blood Pressure';
        bpClass = 'vitals-sub-normal';
      }
    }

    const rbs = v.rbs ? Number(v.rbs) : null;
    let rbsStatus = 'Not assessed';
    let rbsClass = 'vitals-sub-dim';
    if (rbs) {
      if (rbs >= 140) {
        rbsStatus = 'Elevated Blood Sugar';
        rbsClass = 'vitals-sub-alert';
      } else {
        rbsStatus = 'Normal Range';
        rbsClass = 'vitals-sub-normal';
      }
    }

    const hb = v.hb ? Number(v.hb) : null;
    let hbStatus = 'Not assessed';
    let hbClass = 'vitals-sub-dim';
    if (hb) {
      if ((m.gender === 'F' && hb < 11) || (m.gender === 'M' && hb < 12) || hb < 11) {
        hbStatus = 'Anaemia Flagged';
        hbClass = 'vitals-sub-alert';
      } else {
        hbStatus = 'Normal Range';
        hbClass = 'vitals-sub-normal';
      }
    }

    const bmi = v.bmi ? Number(v.bmi) : null;
    let bmiStatus = 'Not calculated';
    let bmiClass = 'vitals-sub-dim';
    if (bmi) {
      if (bmi < 18.5) {
        bmiStatus = 'Underweight';
        bmiClass = 'vitals-sub-alert';
      } else if (bmi > 25) {
        bmiStatus = 'Overweight';
        bmiClass = 'vitals-sub-alert';
      } else {
        bmiStatus = 'Healthy Weight';
        bmiClass = 'vitals-sub-normal';
      }
    }

    $('modalBody').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <p class="form-note" style="margin:0">FAP-${m.id} · Entered by ${escape(m.student_name)} (roll ${escape(m.student_roll)}) · ${shown(m.university_name)}</p>
        <button type="button" class="button action-register-btn" data-register-from-dossier="${m.id}">
          <span>+ Register Hospital Visit</span>
        </button>
      </div>

      <div class="dossier-hero-grid">
        <div class="vitals-card">
          <div class="vitals-card-label">Blood Pressure</div>
          <div class="vitals-card-value">${v.sbp || '--'} / ${v.dbp || '--'} <small style="font-size:11px;font-weight:500;color:#678275">mmHg</small></div>
          <span class="vitals-card-sub ${bpClass}">${bpStatus}</span>
        </div>
        <div class="vitals-card">
          <div class="vitals-card-label">Random Blood Sugar</div>
          <div class="vitals-card-value">${v.rbs || '--'} <small style="font-size:11px;font-weight:500;color:#678275">mg/dL</small></div>
          <span class="vitals-card-sub ${rbsClass}">${rbsStatus}</span>
        </div>
        <div class="vitals-card">
          <div class="vitals-card-label">Haemoglobin</div>
          <div class="vitals-card-value">${v.hb || '--'} <small style="font-size:11px;font-weight:500;color:#678275">g/dL</small></div>
          <span class="vitals-card-sub ${hbClass}">${hbStatus}</span>
        </div>
        <div class="vitals-card">
          <div class="vitals-card-label">Body Mass Index</div>
          <div class="vitals-card-value">${v.bmi || '--'} <small style="font-size:11px;font-weight:500;color:#678275">kg/m²</small></div>
          <span class="vitals-card-sub ${bmiClass}">${bmiStatus}</span>
        </div>
      </div>

      <section class="dossier-section">
        <h3>📋 Patient & adopted family</h3>
        ${detailsGrid([['Age / sex', `${m.age_years} years ${m.age_months || 0} months / ${m.gender || 'Not recorded'}`], ['Patient phone', v.contact_number], ['Family', f.family_code || `Family ${f.id}`], ['Head of family', f.head_of_family], ['Relation', v.relation_to_hof], ['Family phone', f.contact_number], ['Village / ward', f.village_ward || f.village], ['Address', f.address], ['Survey date', f.survey_date], ['Date of birth', v.date_of_birth], ['Education', v.education], ['Occupation', v.occupation]])}
      </section>

      ${surveySection('🩺 Student screening & treatment', v, [['Hypertension flag', 'has_htn'], ['Diabetes flag', 'has_dm'], ['Anaemia flag', 'has_anaemia'], ['Diagnosis', 'diagnosis'], ['Treatment taken', 'treatment_taken'], ['Treatment source', 'treatment_source']])}

      ${surveySection('📊 Baseline measurements', v, [['Systolic BP (mmHg)', 'sbp'], ['Diastolic BP (mmHg)', 'dbp'], ['Random blood sugar (mg/dL)', 'rbs'], ['Haemoglobin (g/dL)', 'hb'], ['Height (m)', 'height_m'], ['Weight (kg)', 'weight_kg'], ['BMI', 'bmi'], ['Waist / hip ratio', 'whr']])}

      ${listSection('🏷️ Recorded conditions', d.conditions, [['Condition', 'condition_name'], ['Status', 'status'], ['Notes', 'notes']])}

      ${listSection('📅 Follow-up visits', d.follow_ups, [['Visit date', 'visit_date'], ['Student', 'student_name'], ['Student roll', 'student_roll'], ['Systolic BP (mmHg)', 'sbp'], ['Diastolic BP (mmHg)', 'dbp'], ['RBS (mg/dL)', 'rbs'], ['Haemoglobin (g/dL)', 'hb'], ['Weight (kg)', 'weight_kg'], ['Progress', 'health_progress'], ['Treatment compliance', 'treatment_compliance'], ['Clinical notes', 'clinical_notes'], ['Next visit', 'next_visit_date']])}

      ${listSection('💊 Medications', d.medications, [['Medicine', 'name'], ['Dosage', 'dosage'], ['Frequency', 'frequency'], ['Currently taking', 'currently_taking'], ['Reason', 'reason']])}

      ${listSection('⚠️ Allergies', d.allergies, [['Allergen', 'allergen'], ['Reaction', 'reaction'], ['Severity', 'severity']])}

      ${listSection('📜 Medical history', d.history, [['Category', 'category'], ['Description', 'description'], ['Year', 'year'], ['Notes', 'notes']])}

      ${surveySection('👶 Child growth & immunisation', v, [['MUAC (cm)', 'muac_cm'], ['Underweight flag', 'is_underweight'], ['Stunting flag', 'is_stunting'], ['Wasting flag', 'is_wasting'], ['Immunisation status', 'immunization_status']])}

      ${surveySection('🌸 Maternal & reproductive health', v, [['Antenatal care', 'anc_taken'], ['Place of delivery', 'delivery_place'], ['Postnatal care', 'pnc_taken'], ['Family planning', 'fp_method_used']])}

      ${surveySection('🌿 Lifestyle', d.lifestyle || {}, [['Smoking', 'smoking_status'], ['Alcohol', 'alcohol_status'], ['Physical activity', 'physical_activity'], ['Diet', 'diet'], ['Notes', 'notes']])}

      <p class="form-note">Y = yes, N = no, NA = not applicable / not assessed as entered. Blank fields are shown as “Not recorded”. Updates made in the student workspace appear when you refresh or reopen the record.</p>
    `;
  } catch (e) {
    if (seq === state.detailSequence) $('modalBody').innerHTML = `<p class="empty" role="alert">${escape(e.message)}</p><button class="button" id="retryDossier">Retry record</button>`;
    const retry = $('retryDossier');
    if (retry) retry.onclick = () => { $('modal').close(); openPatient(id); };
  }
}

let timer;
function resetSearch() { clearTimeout(timer); state.offset = 0; search(); }

$('patientSearch').addEventListener('input', () => {
  clearTimeout(timer);
  state.searchSequence++;
  const hasText = Boolean($('patientSearch').value.trim());
  const clearBtn = $('searchClearBtn');
  if (clearBtn) clearBtn.hidden = !hasText;
  timer = setTimeout(resetSearch, 300);
});

const searchClearBtn = $('searchClearBtn');
if (searchClearBtn) {
  searchClearBtn.onclick = () => {
    $('patientSearch').value = '';
    searchClearBtn.hidden = true;
    resetSearch();
  };
}

$('searchForm').onsubmit = e => { e.preventDefault(); resetSearch(); };
$('universityFilter').onchange = () => { renderStudents(); resetSearch(); };
$('studentFilter').onchange = resetSearch;
$('conditionFilter').onchange = () => { syncQuickChips(); resetSearch(); };
$('clearFilters').onclick = () => {
  $('searchForm').reset();
  const clearBtn = $('searchClearBtn');
  if (clearBtn) clearBtn.hidden = true;
  renderStudents();
  syncQuickChips();
  resetSearch();
};

$('previousPage').onclick = () => { state.offset = Math.max(0, state.offset - state.limit); search(); };
$('nextPage').onclick = () => { state.offset += state.limit; search(); };

/* Registered patients & visit intake logic */

async function loadRegisteredPatients() {
  const seq = ++regState.searchSequence;
  $('registeredTable').innerHTML = '<p class="empty">Loading registered patients…</p>';
  $('regPrevPage').disabled = true;
  $('regNextPage').disabled = true;
  $('registeredPageInfo').textContent = 'Loading…';

  const searchVal = $('registeredSearchInput') ? $('registeredSearchInput').value.trim() : '';
  const deptVal = $('regDeptFilter') ? $('regDeptFilter').value : '';
  const statusVal = $('regStatusFilter') ? $('regStatusFilter').value : '';

  const regParams = new URLSearchParams({
    search: searchVal,
    department: deptVal,
    disposition: statusVal,
    limit: regState.limit,
    offset: regState.offset
  });

  try {
    const [visitsData, summary] = await Promise.all([
      api('visits?' + regParams.toString()),
      api('visits/summary')
    ]);

    if (seq !== regState.searchSequence) return;

    regState.total = visitsData.total;

    // Update KPI cards
    $('kpiTotalVisits').textContent = Number(summary.total_registered || 0).toLocaleString();
    $('kpiTodayVisits').textContent = Number(summary.today_visits || 0).toLocaleString();
    $('kpiAdmittedVisits').textContent = Number(summary.admitted_patients || 0).toLocaleString();
    $('kpiOpdVisits').textContent = Number(summary.opd_discharged || 0).toLocaleString();
    $('registeredCount').textContent = `${visitsData.total} visits`;

    renderRegisteredTable(visitsData.visits);

    $('registeredPageInfo').textContent = visitsData.total
      ? `${visitsData.offset + 1}–${visitsData.offset + visitsData.visits.length} of ${visitsData.total} registered patients`
      : '0 registered patients';
    $('regPrevPage').disabled = regState.offset === 0;
    $('regNextPage').disabled = regState.offset + regState.limit >= visitsData.total;
  } catch (err) {
    if (seq !== regState.searchSequence) return;
    $('registeredTable').innerHTML = `<p class="empty">Could not load registered patients: ${escape(err.message)}</p>`;
    $('registeredPageInfo').textContent = 'Error loading records';
  }
}

function renderRegisteredTable(visits) {
  if (!visits.length) {
    $('registeredTable').innerHTML = `<table><thead><tr>
      <th>Registration ID & Patient</th>
      <th>Visit Date & Dept</th>
      <th>Clinical Intake</th>
      <th>Vitals</th>
      <th>FAP Reference</th>
      <th>Disposition</th>
      <th>Slip</th>
    </tr></thead><tbody>
      <tr><td colspan="7" class="empty">No registered hospital visits found. Click “+ Register Patient Visit” or register from the FAP Registry.</td></tr>
    </tbody></table>`;
    return;
  }

  $('registeredTable').innerHTML = `<table><thead><tr>
    <th>Registration ID & Patient</th>
    <th>Visit Date & Dept</th>
    <th>Clinical Intake</th>
    <th>Vitals</th>
    <th>FAP Reference</th>
    <th>Disposition</th>
    <th>Slip</th>
  </tr></thead><tbody>${visits.map(v => {
    const initials = getInitials(v.patient_name);
    const genderClass = v.gender === 'F' ? 'gender-f' : (v.gender === 'M' ? 'gender-m' : 'gender-other');
    const ageLabel = v.age_years !== null && v.age_years !== undefined ? `${escape(v.age_years)}y` : '';
    const genderLabel = v.gender === 'F' ? 'Female' : (v.gender === 'M' ? 'Male' : shown(v.gender));

    let dispClass = 'disposition-discharged';
    if (v.disposition && v.disposition.includes('Admit')) dispClass = 'disposition-admitted';
    else if (v.disposition === 'Observation') dispClass = 'disposition-observation';
    else if (v.disposition && v.disposition.includes('Referral')) dispClass = 'disposition-referral';

    const vitalsParts = [];
    if (v.sbp || v.dbp) vitalsParts.push(`BP <b>${v.sbp || '-'}/${v.dbp || '-'}</b>`);
    if (v.pulse) vitalsParts.push(`Pulse <b>${v.pulse}</b>`);
    if (v.temperature) vitalsParts.push(`Temp <b>${v.temperature}°F</b>`);
    if (v.rbs) vitalsParts.push(`RBS <b>${v.rbs}</b>`);
    const vitalsStr = vitalsParts.length ? vitalsParts.map(vp => `<span class="vital-chip">${vp}</span>`).join('') : '<span class="vital-chip">None recorded</span>';

    return `<tr>
      <td>
        <div class="patient-cell">
          <div class="patient-avatar ${genderClass}">${initials}</div>
          <div class="patient-info">
            <strong class="patient-name">${shown(v.patient_name)}</strong>
            <div class="patient-meta-row">
              <span class="fap-id-badge" style="background:#eaf4f0;color:#0d5c4e;border-color:#b9ded2">${escape(v.visit_uid)}</span>
              <span class="demographics-tag">${ageLabel} / ${genderLabel}</span>
            </div>
            <div class="patient-contact">${v.contact_number ? `<span class="contact-num">📞 ${escape(v.contact_number)}</span>` : '<span class="contact-none">No phone</span>'}</div>
          </div>
        </div>
      </td>
      <td>
        <div>
          <strong style="color:#1e3c32;font-size:12px">${shown(v.department)}</strong>
          <div style="font-size:11px;color:#5a766a;margin-top:2px">📅 ${shown(v.visit_date)}</div>
          <div style="font-size:10px;color:#789387;margin-top:2px">Dr: ${shown(v.attending_doctor || 'Staff MO')}</div>
        </div>
      </td>
      <td style="max-width:220px">
        <div style="font-size:12px;font-weight:600;color:#1d392e;line-height:1.4">${shown(v.chief_complaint || 'No complaint listed')}</div>
        ${v.diagnosis ? `<div style="font-size:11px;color:#087e72;margin-top:2px">Dx: <b>${shown(v.diagnosis)}</b></div>` : ''}
        ${v.symptoms_duration ? `<div style="font-size:10px;color:#769083">Duration: ${shown(v.symptoms_duration)}</div>` : ''}
      </td>
      <td>
        <div class="vitals-strip">${vitalsStr}</div>
      </td>
      <td>
        ${v.family_code ? `
          <div class="family-cell">
            <span class="family-code-badge">${shown(v.family_code)}</span>
            <div class="family-meta-row"><span class="dim-icon">📍</span> <span class="village-name">${shown(v.village || v.address)}</span></div>
            ${v.student_name ? `<div style="font-size:10px;color:#5d7b6f;margin-top:1px">By ${shown(v.student_name)} (Roll ${shown(v.student_roll)})</div>` : ''}
          </div>
        ` : '<span style="font-size:11px;color:#779386">Hospital direct</span>'}
      </td>
      <td>
        <span class="reg-badge-disposition ${dispClass}">${shown(v.disposition)}</span>
        ${v.ward_bed_no ? `<div style="font-size:10px;font-weight:600;color:#854d0e;margin-top:3px">🛏️ ${shown(v.ward_bed_no)}</div>` : ''}
      </td>
      <td>
        <button type="button" class="button action-open-btn" data-view-slip="${v.id}" aria-label="View visit slip for ${escape(v.patient_name)}">
          <span>Slip</span>
          <span class="arrow-sym">📄</span>
        </button>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function openRegistrationModal(memberId) {
  $('registrationForm').reset();
  const today = new Date().toISOString().slice(0, 10);
  $('regVisitDate').value = today;
  $('regFamilyMemberId').value = '';
  $('regPatientId').value = '';
  $('regFapRefBox').hidden = true;
  delete $('regFapInfo').dataset.familyCode;
  delete $('regFapInfo').dataset.village;
  delete $('regFapInfo').dataset.studentName;
  delete $('regFapInfo').dataset.studentRoll;

  if (memberId) {
    try {
      const d = await api('fap/patients/' + memberId);
      const m = d.member;
      const v = d.vitals || {};
      const f = d.family || {};

      $('regFamilyMemberId').value = m.id;
      $('regPatientName').value = m.name || '';
      $('regContactNumber').value = v.contact_number || m.contact_number || f.contact_number || '';
      $('regAgeYears').value = m.age_years || '';
      $('regGender').value = ['M', 'F', 'Other'].includes(m.gender) ? m.gender : 'Other';
      $('regAddress').value = f.address || f.village_ward || f.village || '';

      const conds = [];
      if (m.has_htn === 'Y') conds.push('Hypertension');
      if (m.has_dm === 'Y') conds.push('Diabetes');
      if (m.has_anaemia === 'Y') conds.push('Anaemia');
      if (d.conditions && d.conditions.length) {
        d.conditions.forEach(c => {
          if (!conds.includes(c.condition_name)) conds.push(c.condition_name);
        });
      }
      $('regExistingConditions').value = conds.join(', ');

      if (d.allergies && d.allergies.length) {
        $('regAllergies').value = d.allergies.map(a => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ');
      } else {
        $('regAllergies').value = '';
      }

      $('regDiagnosis').value = v.diagnosis || '';
      $('regSbp').value = v.sbp || '';
      $('regDbp').value = v.dbp || '';
      $('regRbs').value = v.rbs || '';
      $('regDepartment').value = 'Community Medicine / FAP Referral';
      $('regVisitType').value = 'FAP Survey Referral';

      // Set FAP Ref box
      $('regFapRefBox').hidden = false;
      const famCode = f.family_code || `FAM-${f.id}`;
      const village = f.village_ward || f.village || '';
      const studName = m.student_name || '';
      const studRoll = m.student_roll || '';

      $('regFapInfo').textContent = `Family Code: ${famCode} · Village: ${village} · Surveyor: ${studName} (Roll ${studRoll})`;
      $('regFapInfo').dataset.familyCode = famCode;
      $('regFapInfo').dataset.village = village;
      $('regFapInfo').dataset.studentName = studName;
      $('regFapInfo').dataset.studentRoll = studRoll;

      $('regModalTitle').textContent = `Register Visit · ${m.name} (FAP-${m.id})`;
    } catch (e) {
      alert('Could not fetch FAP member details: ' + e.message);
    }
  } else {
    $('regDepartment').value = 'General Medicine';
    $('regVisitType').value = 'Routine OPD';
    $('regModalTitle').textContent = 'Register Patient Visit';
  }

  $('registrationModal').showModal();
}

async function openVisitSlip(visitId) {
  $('slipModalTitle').textContent = 'Loading slip…';
  $('visitSlipBody').innerHTML = '<p class="empty">Loading patient visit slip…</p>';
  $('visitSlipModal').showModal();

  try {
    const v = await api('visits/' + visitId);
    $('slipModalTitle').textContent = `Visit Slip · ${v.visit_uid}`;

    const hospName = $('hospitalName')?.textContent || 'District / General Hospital';
    const ageGender = `${v.age_years ? `${v.age_years} yrs` : ''} / ${v.gender === 'F' ? 'Female' : (v.gender === 'M' ? 'Male' : shown(v.gender))}`;

    $('visitSlipBody').innerHTML = `
      <div class="slip-header">
        <div>
          <div class="slip-hospital-title">${escape(hospName)}</div>
          <div style="font-size:11px;color:#5c776b;margin-top:2px">Outpatient / Inpatient Registration Record · FAP Connected Care</div>
        </div>
        <div style="text-align:right">
          <div class="slip-reg-num">${escape(v.visit_uid)}</div>
          <div style="font-size:10px;color:#769183;margin-top:3px">Date: <b>${shown(v.visit_date)}</b></div>
        </div>
      </div>

      <div class="slip-grid">
        <div class="slip-item">
          <dt>Patient Full Name</dt>
          <dd>${shown(v.patient_name)}</dd>
        </div>
        <div class="slip-item">
          <dt>Age / Gender</dt>
          <dd>${escape(ageGender)}</dd>
        </div>
        <div class="slip-item">
          <dt>Contact Phone</dt>
          <dd>${shown(v.contact_number)}</dd>
        </div>
        <div class="slip-item">
          <dt>Department & Doctor</dt>
          <dd>${shown(v.department)} · ${shown(v.attending_doctor || 'Medical Officer')}</dd>
        </div>

        ${v.family_code ? `
        <div class="slip-item slip-full" style="background:#f4f9f6;padding:9px 12px;border-radius:6px;border:1px solid #dbeae2">
          <dt style="color:#087e72">🏠 FAP Surveillance Linkage</dt>
          <dd style="font-size:12px;color:#184c3d">
            Family Code: <b>${shown(v.family_code)}</b> · Village: <b>${shown(v.village || v.address)}</b>
            ${v.student_name ? ` · Surveyor: <b>${shown(v.student_name)} (Roll ${shown(v.student_roll)})</b>` : ''}
          </dd>
        </div>` : ''}

        <hr class="slip-divider">

        <div class="slip-item slip-full">
          <dt>Chief Complaint & Symptom Duration</dt>
          <dd>${shown(v.chief_complaint)} ${v.symptoms_duration ? `(Duration: ${escape(v.symptoms_duration)})` : ''}</dd>
        </div>

        <div class="slip-item slip-full">
          <dt>Triage Vital Signs</dt>
          <dd style="font-size:12px;color:#284a3e">
            BP: <b>${v.sbp || '--'}/${v.dbp || '--'} mmHg</b> &nbsp;|&nbsp;
            Pulse: <b>${v.pulse || '--'} bpm</b> &nbsp;|&nbsp;
            Temp: <b>${v.temperature ? `${v.temperature}°F` : '--'}</b> &nbsp;|&nbsp;
            RBS: <b>${v.rbs ? `${v.rbs} mg/dL` : '--'}</b>
          </dd>
        </div>

        <div class="slip-item">
          <dt>Known Conditions</dt>
          <dd>${shown(v.existing_conditions)}</dd>
        </div>
        <div class="slip-item">
          <dt>Known Allergies</dt>
          <dd>${shown(v.allergies)}</dd>
        </div>

        <hr class="slip-divider">

        <div class="slip-item">
          <dt>Provisional Clinical Diagnosis</dt>
          <dd style="color:#087e72">${shown(v.diagnosis || 'Clinical evaluation')}</dd>
        </div>
        <div class="slip-item">
          <dt>Disposition / Ward</dt>
          <dd>${shown(v.disposition)} ${v.ward_bed_no ? `(Bed: ${shown(v.ward_bed_no)})` : ''}</dd>
        </div>

        <div class="slip-item slip-full">
          <dt>Prescribed Treatment / Medication Dispensed</dt>
          <dd style="white-space:pre-wrap">${shown(v.treatment_prescribed || 'As per prescription slip')}</dd>
        </div>

        <div class="slip-item slip-full">
          <dt>Follow-up Advice & Next Steps</dt>
          <dd>${shown(v.follow_up_advice || 'Return for review as directed')}</dd>
        </div>

        <hr class="slip-divider">

        <div class="slip-item slip-full" style="font-size:10px;color:#859c90;display:flex;justify-content:space-between">
          <span>Registered By: <b>${shown(v.registered_by_name || 'Hospital Admission Desk')}</b></span>
          <span>Printed on: ${new Date().toLocaleString()}</span>
        </div>
      </div>
    `;
  } catch (err) {
    $('visitSlipBody').innerHTML = `<p class="empty">Error loading visit slip: ${escape(err.message)}</p>`;
  }
}

$('registrationForm').onsubmit = async (e) => {
  e.preventDefault();
  $('submitRegBtn').disabled = true;
  $('submitRegBtn').textContent = 'Registering…';

  try {
    const payload = {
      family_member_id: $('regFamilyMemberId').value || null,
      patient_id: $('regPatientId').value || null,
      patient_name: $('regPatientName').value.trim(),
      contact_number: $('regContactNumber').value.trim(),
      age_years: $('regAgeYears').value ? Number($('regAgeYears').value) : null,
      gender: $('regGender').value,
      address: $('regAddress').value.trim(),
      village: $('regFapInfo').dataset.village || '',
      family_code: $('regFapInfo').dataset.familyCode || '',
      student_name: $('regFapInfo').dataset.studentName || '',
      student_roll: $('regFapInfo').dataset.studentRoll || '',
      visit_date: $('regVisitDate').value,
      department: $('regDepartment').value,
      attending_doctor: $('regDoctor').value.trim(),
      visit_type: $('regVisitType').value,
      chief_complaint: $('regChiefComplaint').value.trim(),
      symptoms_duration: $('regSymptomsDuration').value.trim(),
      sbp: $('regSbp').value ? Number($('regSbp').value) : null,
      dbp: $('regDbp').value ? Number($('regDbp').value) : null,
      pulse: $('regPulse').value ? Number($('regPulse').value) : null,
      temperature: $('regTemp').value ? Number($('regTemp').value) : null,
      rbs: $('regRbs').value ? Number($('regRbs').value) : null,
      existing_conditions: $('regExistingConditions').value.trim(),
      allergies: $('regAllergies').value.trim(),
      diagnosis: $('regDiagnosis').value.trim(),
      treatment_prescribed: $('regTreatment').value.trim(),
      disposition: $('regDisposition').value,
      ward_bed_no: $('regWardBed').value.trim(),
      follow_up_advice: $('regFollowUp').value.trim()
    };

    const res = await api('visits', { method: 'POST', body: payload });
    $('registrationModal').close();
    $('registrationForm').reset();

    // If registered view is active, refresh it; otherwise switch or load
    regState.offset = 0;
    await loadRegisteredPatients();
    openVisitSlip(res.visit.id);
  } catch (err) {
    alert('Registration failed: ' + err.message);
  } finally {
    $('submitRegBtn').disabled = false;
    $('submitRegBtn').innerHTML = '<span data-icon="plus"></span>Complete Registration & Generate Slip';
    icons($('registrationModal'));
  }
};

let regTimer;
function resetRegSearch() {
  clearTimeout(regTimer);
  regState.offset = 0;
  loadRegisteredPatients();
}

$('registeredSearchInput').addEventListener('input', () => {
  clearTimeout(regTimer);
  regState.searchSequence++;
  const hasText = Boolean($('registeredSearchInput').value.trim());
  const clearBtn = $('regSearchClearBtn');
  if (clearBtn) clearBtn.hidden = !hasText;
  regTimer = setTimeout(resetRegSearch, 300);
});

$('regSearchClearBtn').onclick = () => {
  $('registeredSearchInput').value = '';
  $('regSearchClearBtn').hidden = true;
  resetRegSearch();
};

$('registeredSearchForm').onsubmit = (e) => {
  e.preventDefault();
  resetRegSearch();
};

$('regDeptFilter').onchange = resetRegSearch;
$('regStatusFilter').onchange = resetRegSearch;
$('clearRegFilters').onclick = () => {
  $('registeredSearchForm').reset();
  $('regSearchClearBtn').hidden = true;
  resetRegSearch();
};

$('regPrevPage').onclick = () => {
  regState.offset = Math.max(0, regState.offset - regState.limit);
  loadRegisteredPatients();
};

$('regNextPage').onclick = () => {
  regState.offset += regState.limit;
  loadRegisteredPatients();
};

$('openNewRegistrationBtn').onclick = () => openRegistrationModal();
$('closeRegModal').onclick = () => $('registrationModal').close();
$('cancelRegBtn').onclick = () => $('registrationModal').close();
$('closeSlipModal').onclick = () => $('visitSlipModal').close();
$('closeSlipBtn').onclick = () => $('visitSlipModal').close();
$('printSlipBtn').onclick = () => window.print();

document.addEventListener('click', e => {
  const p = e.target.closest('[data-patient]');
  if (p) openPatient(p.dataset.patient);

  const regPatientBtn = e.target.closest('[data-register-patient]');
  if (regPatientBtn) {
    openRegistrationModal(regPatientBtn.dataset.registerPatient);
    return;
  }

  const dossierRegBtn = e.target.closest('[data-register-from-dossier]');
  if (dossierRegBtn) {
    $('modal').close();
    openRegistrationModal(dossierRegBtn.dataset.registerFromDossier);
    return;
  }

  const slipBtn = e.target.closest('[data-view-slip]');
  if (slipBtn) {
    openVisitSlip(slipBtn.dataset.viewSlip);
    return;
  }

  const chip = e.target.closest('[data-condition-chip]');
  if (chip) {
    $('conditionFilter').value = chip.dataset.conditionChip;
    syncQuickChips();
    location.hash = 'patients';
    resetSearch();
    return;
  }

  const c = e.target.closest('[data-condition]');
  if (c) {
    $('conditionFilter').value = c.dataset.condition;
    syncQuickChips();
    location.hash = 'patients';
    resetSearch();
    return;
  }

  const s = e.target.closest('[data-student]');
  if (s) {
    $('searchForm').reset();
    renderStudents();
    $('studentFilter').value = s.dataset.student;
    syncQuickChips();
    location.hash = 'patients';
    resetSearch();
    return;
  }

  const tagRemove = e.target.closest('[data-remove-filter]');
  if (tagRemove) {
    const filterKey = tagRemove.dataset.removeFilter;
    if (filterKey === 'search') {
      $('patientSearch').value = '';
      const btn = $('searchClearBtn'); if (btn) btn.hidden = true;
    } else if (filterKey === 'university') {
      $('universityFilter').value = '';
      renderStudents();
    } else if (filterKey === 'student') {
      $('studentFilter').value = '';
    } else if (filterKey === 'condition') {
      $('conditionFilter').value = '';
      syncQuickChips();
    }
    resetSearch();
    return;
  }

  const clearAll = e.target.closest('#clearAllFiltersTag');
  if (clearAll) {
    $('clearFilters').click();
    return;
  }
});

$('closeModal').onclick = () => $('modal').close();
$('modal').addEventListener('close', () => state.detailSequence++);
$('menuButton').onclick = () => {
  const open = $('sidebar').classList.toggle('open');
  $('scrim').hidden = !open;
  $('menuButton').setAttribute('aria-expanded', String(open));
};
$('scrim').onclick = closeNav;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
$('signOut').onclick = () => {
  localStorage.removeItem('medpulse_hospital_admin');
  location.href = '/hospital/login';
};

async function refresh() {
  clearTimeout(timer);
  state.searchSequence++;
  $('loadError').hidden = true;
  $('refreshButton').disabled = true;
  try {
    await loadSummary();
    state.offset = 0;
    await search();
    if (location.hash === '#registered') {
      regState.offset = 0;
      await loadRegisteredPatients();
    }
  } catch (e) {
    error(e.message);
    $('metrics').innerHTML = '<p class="empty">FAP totals unavailable. Please retry.</p>';
    $('patientTable').innerHTML = '<p class="empty">Records unavailable. Please retry.</p>';
    $('conditions').innerHTML = '';
    $('universities').innerHTML = '';
    $('updatedAt').textContent = 'Connection failed';
  } finally {
    $('refreshButton').disabled = false;
  }
}

$('refreshButton').onclick = refresh;
$('retryButton').onclick = refresh;

async function start() {
  try {
    const profile = await api('profile');
    const a = profile.admin;
    $('hospitalName').textContent = a.hospital_name;
    $('accountName').textContent = a.name;
    $('accountRole').textContent = a.role;
    $('avatar').textContent = a.name.slice(0, 1);
    await refresh();
  } catch (e) {
    error(e.message);
    $('updatedAt').textContent = 'Hospital sign-in required';
  }
}

window.addEventListener('hashchange', navigate);
icons();
navigate();
start();
})();
