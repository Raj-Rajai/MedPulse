// MedPulse Client-Side App Logic
let stagedMembers = [];

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    const isOpen = sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active', isOpen);
}

function closeSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('active');
}

// Set default survey date to today & handle student auth
document.addEventListener('DOMContentLoaded', () => {
    const surveyDateInput = document.getElementById('surveyDate');
    if (surveyDateInput) {
        surveyDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Check logged in student
    const userStr = localStorage.getItem('medpulse_user');
    const authArea = document.getElementById('authNavArea');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const rollInput = document.getElementById('studentRoll');
            if (rollInput && user.roll_number) {
                rollInput.value = user.roll_number;
            }
            if (authArea) {
                authArea.innerHTML = `
                    <div class="sidebar-user" data-tooltip="Roll ${user.roll_number} (View Profile)" onclick="if(document.documentElement.classList.contains('sidebar-collapsed')||document.body.classList.contains('sidebar-collapsed')){localStorage.removeItem('medpulse_user'); window.location.reload();}else{window.location.href='/profile.html';}" title="Roll ${user.roll_number}">
                        <div class="user-avatar-badge">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <span class="role-dot"></span>
                        </div>
                        <div class="user-info-text">
                            <span style="font-size: 0.72rem; color: rgba(255,255,255,0.5); display: block;">Student</span>
                            <span style="font-weight: 700; color: #fff;">Roll ${user.roll_number}</span>
                        </div>
                        <button class="logout-btn" onclick="event.stopPropagation(); localStorage.removeItem('medpulse_user'); window.location.reload();" title="Logout">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </button>
                    </div>
                `;
            }
        } catch (e) {}
    } else if (authArea) {
        authArea.innerHTML = `<a href="/login.html" class="sidebar-login-link">🔑 Sign In</a>`;
    }

    onDemographicsChange();
});

/**
 * Dynamically toggles field visibility based on age & gender
 */
function onDemographicsChange() {
    const ageYears = parseInt(document.getElementById('mAgeYears').value || 0, 10);
    const gender = document.getElementById('mGender').value;

    const adultSection = document.getElementById('adultHealthSection');
    const pediatricSection = document.getElementById('pediatricSection');
    const maternalSection = document.getElementById('maternalSection');

    if (!adultSection || !pediatricSection || !maternalSection) return;

    // Adult Section: Age >= 18
    if (ageYears >= 18) {
        adultSection.style.display = 'block';
    } else {
        adultSection.style.display = 'none';
    }

    // Pediatric Section: Age <= 5
    if (ageYears <= 5 && document.getElementById('mAgeYears').value !== '') {
        pediatricSection.style.display = 'block';
    } else {
        pediatricSection.style.display = 'none';
    }

    // Maternal Section: Female and Age between 15 and 49
    if (gender === 'F' && ageYears >= 15 && ageYears <= 49) {
        maternalSection.style.display = 'block';
    } else {
        maternalSection.style.display = 'none';
    }
}

/**
 * Real-time BMI Calculator
 */
function calcBMI() {
    const ht = parseFloat(document.getElementById('mHeight').value);
    const wt = parseFloat(document.getElementById('mWeight').value);
    const preview = document.getElementById('bmiPreview');

    if (ht > 0 && wt > 0) {
        const bmi = (wt / (ht * ht)).toFixed(1);
        let label = 'Normal';
        let badgeClass = 'badge-success';

        if (bmi < 18.5) {
            label = 'Underweight';
            badgeClass = 'badge-warning';
        } else if (bmi >= 23.0 && bmi < 27.5) {
            label = 'Overweight';
            badgeClass = 'badge-warning';
        } else if (bmi >= 27.5) {
            label = 'Obese';
            badgeClass = 'badge-danger';
        }

        preview.innerHTML = `BMI: <strong>${bmi}</strong> <span class="badge ${badgeClass}">${label}</span>`;
    } else {
        preview.textContent = 'Enter Ht & Wt';
    }
}

/**
 * Real-time Waist-Hip Ratio Calculator
 */
function calcWHR() {
    const waist = parseFloat(document.getElementById('mWaist').value);
    const hip = parseFloat(document.getElementById('mHip').value);
    const preview = document.getElementById('whrPreview');

    if (waist > 0 && hip > 0) {
        const whr = (waist / hip).toFixed(2);
        preview.innerHTML = `WHR: <strong>${whr}</strong>`;
    } else {
        preview.textContent = 'Enter Waist & Hip';
    }
}

/**
 * Auto-detect Hypertension, Diabetes, and Anaemia flags
 */
function checkAdultVitals() {
    const sbp = parseInt(document.getElementById('mSbp').value || 0, 10);
    const dbp = parseInt(document.getElementById('mDbp').value || 0, 10);
    const rbs = parseFloat(document.getElementById('mRbs').value || 0);
    const hb = parseFloat(document.getElementById('mHb').value || 0);
    const pallor = document.getElementById('mPallor').value;

    const htnSelect = document.getElementById('mHtn');
    const dmSelect = document.getElementById('mDm');
    const anaemiaSelect = document.getElementById('mAnaemia');

    // Auto-flag HTN
    if (sbp >= 140 || dbp >= 90) {
        htnSelect.value = 'Y';
    }

    // Auto-flag DM if RBS >= 200
    if (rbs >= 200) {
        dmSelect.value = 'Y';
    }

    // Auto-flag Anaemia if Hb < 12.0 or clinical pallor is present
    if ((hb > 0 && hb < 12.0) || pallor === 'Y') {
        anaemiaSelect.value = 'Y';
    }
}

/**
 * Autofill ICMR standard Consumption Unit (CU)
 */
function autoFillCU() {
    const workType = document.getElementById('mWorkType').value;
    const gender = document.getElementById('mGender').value;
    const cuInput = document.getElementById('mCu');

    let cu = 1.0;
    if (gender === 'M') {
        if (workType === 'Sedentary') cu = 1.0;
        else if (workType === 'Moderate') cu = 1.2;
        else if (workType === 'Heavy') cu = 1.6;
    } else {
        if (workType === 'Sedentary') cu = 0.8;
        else if (workType === 'Moderate') cu = 0.9;
        else if (workType === 'Heavy') cu = 1.2;
    }
    cuInput.value = cu;
}

/**
 * Add currently typed member to staged list
 */
function stageCurrentMember() {
    const name = document.getElementById('mName').value.trim();
    const relation = document.getElementById('mRelation').value;
    const gender = document.getElementById('mGender').value;
    const ageYearsStr = document.getElementById('mAgeYears').value;

    if (!name) {
        alert('Please enter member name');
        document.getElementById('mName').focus();
        return;
    }

    if (ageYearsStr === '') {
        alert('Please enter age in completed years');
        document.getElementById('mAgeYears').focus();
        return;
    }

    const ageYears = parseInt(ageYearsStr, 10);
    const ageMonths = parseInt(document.getElementById('mAgeMonths').value || 0, 10);

    const ht = parseFloat(document.getElementById('mHeight').value) || null;
    const wt = parseFloat(document.getElementById('mWeight').value) || null;
    let bmi = null;
    if (ht > 0 && wt > 0) {
        bmi = parseFloat((wt / (ht * ht)).toFixed(2));
    }

    const waist = parseFloat(document.getElementById('mWaist').value) || null;
    const hip = parseFloat(document.getElementById('mHip').value) || null;
    let whr = null;
    if (waist > 0 && hip > 0) {
        whr = parseFloat((waist / hip).toFixed(2));
    }

    const member = {
        member_order: stagedMembers.length + 1,
        name,
        relation_to_hof: relation,
        gender,
        age_years: ageYears,
        age_months: ageMonths,
        work_type: document.getElementById('mWorkType').value,
        consumption_unit: parseFloat(document.getElementById('mCu').value) || 1.0,

        // Adult fields
        sbp: parseInt(document.getElementById('mSbp').value) || null,
        dbp: parseInt(document.getElementById('mDbp').value) || null,
        has_htn: document.getElementById('mHtn').value,
        rbs: parseFloat(document.getElementById('mRbs').value) || null,
        has_dm: document.getElementById('mDm').value,
        hb: parseFloat(document.getElementById('mHb').value) || null,
        has_pallor: document.getElementById('mPallor').value,
        has_anaemia: document.getElementById('mAnaemia').value,
        height_m: ht,
        weight_kg: wt,
        bmi,
        waist_cm: waist,
        hip_cm: hip,
        whr,

        // Pediatric fields
        muac_cm: parseFloat(document.getElementById('mMuac').value) || null,
        hc_cm: parseFloat(document.getElementById('mHc').value) || null,
        cc_cm: parseFloat(document.getElementById('mCc').value) || null,
        is_underweight: document.getElementById('mUnderweight').value,
        is_stunting: document.getElementById('mStunting').value,
        is_wasting: document.getElementById('mWasting').value,
        mamta_card: document.getElementById('mMamtaCard').value,
        immunization_status: document.getElementById('mImmunization').value,

        // Maternal fields
        anc_taken: document.getElementById('mAnc').value,
        delivery_place: document.getElementById('mDelivery').value,
        pnc_taken: document.getElementById('mPnc').value,
        fp_method_used: document.getElementById('mFp').value,

        // General
        oral_hygiene: document.getElementById('mOralHygiene').value,
        general_hygiene: document.getElementById('mGenHygiene').value,
        diagnosis: document.getElementById('mDiagnosis').value.trim() || null,
        treatment_source: document.getElementById('mTreatmentSource').value.trim() || null
    };

    stagedMembers.push(member);
    renderStagedMembersTable();

    // Reset member form inputs for next entry
    resetMemberInputs();
}

function resetMemberInputs() {
    document.getElementById('mName').value = '';
    document.getElementById('mAgeYears').value = '';
    document.getElementById('mAgeMonths').value = '0';
    document.getElementById('mSbp').value = '';
    document.getElementById('mDbp').value = '';
    document.getElementById('mHtn').value = 'N';
    document.getElementById('mRbs').value = '';
    document.getElementById('mDm').value = 'N';
    document.getElementById('mHb').value = '';
    document.getElementById('mPallor').value = 'N';
    document.getElementById('mAnaemia').value = 'N';
    document.getElementById('mHeight').value = '';
    document.getElementById('mWeight').value = '';
    document.getElementById('mWaist').value = '';
    document.getElementById('mHip').value = '';
    document.getElementById('mMuac').value = '';
    document.getElementById('mHc').value = '';
    document.getElementById('mCc').value = '';
    document.getElementById('mDiagnosis').value = '';
    document.getElementById('mTreatmentSource').value = '';
    document.getElementById('bmiPreview').textContent = 'Enter Ht & Wt';
    document.getElementById('whrPreview').textContent = 'Enter Waist & Hip';

    onDemographicsChange();
    document.getElementById('mName').focus();
}

function removeStagedMember(index) {
    stagedMembers.splice(index, 1);
    // Re-index member_order
    stagedMembers.forEach((m, idx) => { m.member_order = idx + 1; });
    renderStagedMembersTable();
}

function renderStagedMembersTable() {
    const tbody = document.getElementById('stagedMembersTableBody');
    document.getElementById('stagedCount').textContent = stagedMembers.length;

    if (stagedMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted);">
                    No members added yet. Use the member builder above to add members.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = stagedMembers.map((m, index) => {
        const bpInfo = m.sbp && m.dbp ? `${m.sbp}/${m.dbp} mmHg` : '-';
        const htnBadge = m.has_htn === 'Y' ? '<span class="badge badge-warning">HTN</span>' : '';
        const dmBadge = m.has_dm === 'Y' ? '<span class="badge badge-warning">DM</span>' : '';
        const anaemiaBadge = m.has_anaemia === 'Y' ? '<span class="badge badge-danger">Anaemia</span>' : '';

        const bmiInfo = m.bmi ? `BMI: ${m.bmi}` : '-';
        const whrInfo = m.whr ? ` | WHR: ${m.whr}` : '';

        let pedRch = '-';
        if (m.age_years <= 5) {
            pedRch = `MUAC: ${m.muac_cm || '-'}cm, Card: ${m.mamta_card}`;
        } else if (m.anc_taken !== 'NA') {
            pedRch = `ANC: ${m.anc_taken}, Deliv: ${m.delivery_place}`;
        }

        return `
            <tr>
                <td>${m.member_order}</td>
                <td><strong>${m.name}</strong></td>
                <td>${m.relation_to_hof}</td>
                <td>${m.age_years}y / ${m.gender}</td>
                <td>${bpInfo} ${htnBadge}</td>
                <td>${m.hb ? m.hb + 'g/dl' : '-'} ${anaemiaBadge} ${dmBadge}</td>
                <td>${bmiInfo}${whrInfo}</td>
                <td>${pedRch}</td>
                <td>
                    <button type="button" class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="removeStagedMember(${index})">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Submits the complete family survey to the REST API
 */
async function submitFullFamily() {
    const alertBox = document.getElementById('statusAlert');
    alertBox.style.display = 'none';

    if (stagedMembers.length === 0) {
        alert('Please add at least one family member before submitting the family survey.');
        document.getElementById('mName').focus();
        return;
    }

    const payload = {
        roll_number: document.getElementById('studentRoll').value.trim(),
        family_no: parseInt(document.getElementById('familyNo').value, 10),
        head_of_family: document.getElementById('headOfFamily').value.trim(),
        village_ward: document.getElementById('villageWard').value.trim(),
        address: document.getElementById('familyAddress').value.trim(),
        survey_date: document.getElementById('surveyDate').value,
        total_cu: parseFloat(document.getElementById('totalCu').value) || 0,
        calorie_intake_per_cu: parseFloat(document.getElementById('calorieIntake').value) || 0,
        calorie_status: document.getElementById('calorieStatus').value,
        dietary_advice_given: document.getElementById('dietaryAdvice').value,
        members: stagedMembers
    };

    const submitBtn = document.getElementById('submitSurveyBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving to Database...';

    try {
        const res = await fetch('/api/families', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to save family survey');
        }

        alertBox.className = 'alert alert-success';
        alertBox.textContent = `✅ Success! Family #${data.family_no} (${data.members_count} members) successfully saved to database. Redirecting to overview...`;
        alertBox.style.display = 'block';
        alertBox.scrollIntoView({ behavior: 'smooth' });

        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = '/';
        }, 1800);

    } catch (err) {
        alertBox.className = 'alert alert-error';
        alertBox.textContent = `❌ Error: ${err.message}`;
        alertBox.style.display = 'block';
        alertBox.scrollIntoView({ behavior: 'smooth' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Family & Members to Database';
    }
}
