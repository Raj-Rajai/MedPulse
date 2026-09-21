const PDFDocument = require('pdfkit');
const { db } = require('./db');

// Helper to convert SQLite object prototype results to clean objects
const clean = (row) => (row ? { ...row } : null);
const cleanList = (rows) => rows.map((r) => ({ ...r }));

/**
 * Fetch complete aggregated dataset for a student,
 * combining family records, baseline data entry, and latest follow-ups.
 */
function getStudentExportData(studentId) {
    const student = db.prepare(`
        SELECT s.*, c.name as college_name, c.city as college_city
        FROM students s
        LEFT JOIN colleges c ON s.college_id = c.id
        WHERE s.id = ?
    `).get(studentId);

    if (!student) return null;

    const families = db.prepare(`
        SELECT f.*
        FROM families f
        WHERE f.student_id = ?
        ORDER BY f.family_no ASC, f.id ASC
    `).all(studentId);

    const fullFamilies = families.map((fam) => {
        const members = db.prepare(`
            SELECT m.*,
                   fu.id as followup_id,
                   fu.visit_number as latest_visit_number,
                   fu.visit_date as latest_visit_date,
                   fu.sbp as fu_sbp,
                   fu.dbp as fu_dbp,
                   fu.rbs as fu_rbs,
                   fu.hb as fu_hb,
                   fu.weight_kg as fu_weight_kg,
                   fu.muac_cm as fu_muac_cm,
                   fu.treatment_compliance as latest_compliance,
                   fu.health_progress as latest_progress,
                   fu.clinical_notes as latest_notes,
                   (SELECT COUNT(*) FROM follow_ups WHERE member_id = m.id) as total_followups
            FROM family_members m
            LEFT JOIN (
                SELECT f1.*
                FROM follow_ups f1
                INNER JOIN (
                    SELECT member_id, MAX(visit_date) as max_date, MAX(id) as max_id
                    FROM follow_ups
                    GROUP BY member_id
                ) f2 ON f1.member_id = f2.member_id AND f1.id = f2.max_id
            ) fu ON fu.member_id = m.id
            WHERE m.family_id = ?
            ORDER BY m.member_order ASC, m.id ASC
        `).all(fam.id);

        const cleanMembers = members.map((m) => {
            const hasFollowup = m.latest_visit_number !== null && m.latest_visit_number !== undefined;
            return {
                ...m,
                has_followup: hasFollowup,
                // Effective parameters (latest follow-up if present, else baseline)
                effective_sbp: hasFollowup && m.fu_sbp !== null ? m.fu_sbp : m.sbp,
                effective_dbp: hasFollowup && m.fu_dbp !== null ? m.fu_dbp : m.dbp,
                effective_rbs: hasFollowup && m.fu_rbs !== null ? m.fu_rbs : m.rbs,
                effective_hb: hasFollowup && m.fu_hb !== null ? m.fu_hb : m.hb,
                effective_weight: hasFollowup && m.fu_weight_kg !== null ? m.fu_weight_kg : m.weight_kg,
                effective_muac: hasFollowup && m.fu_muac_cm !== null ? m.fu_muac_cm : m.muac_cm
            };
        });

        return {
            ...clean(fam),
            members: cleanMembers
        };
    });

    return {
        student: clean(student),
        families: fullFamilies
    };
}

/**
 * Generate standard CSV matching the 43 columns of Roll235.pdf + follow-up tracking columns.
 */
function generateCsv(studentId) {
    const data = getStudentExportData(studentId);
    if (!data) return '';

    const { student, families } = data;

    const headers = [
        "Roll Number",
        "Family No.",
        "Name of Family Member (start with HOF)",
        "Age (in Completed Years)",
        "Age (in Completed Months)",
        "HTN (Y/N)",
        "SBP ONLY for ADULTS",
        "DBP ONLY for ADULTS",
        "DM (Y/N)",
        "RBS (mg/dl)",
        "Pallor (Y/N)",
        "Hb (g/dl)",
        "Anaemia (Y/N)",
        "HC (Upto 2 Years of Age)",
        "CC (Upto 2 Years of Age)",
        "MUAC (6 Month to 5 Years of Age)",
        "Ht (m)",
        "Wt. (kg.)",
        "BMI (kg/m2)",
        "Waist Circumference (in CM) ONLY ADULTS",
        "Hip Circumference (in CM) ONLY ADULTS",
        "WHR Only Adults",
        "Under-weight (Y/ N/ NA) ONLY for 0-5 Years",
        "Overweight (Y/ N/ NA) ONLY for 0-5 Years",
        "Stunting (Y/ N/ NA) ONLY for 0-5 Years",
        "Wasting (Y/ N/ NA) ONLY for 0-5 Years",
        "Severe Wasting (Y/ N/ NA) ONLY for 0-5 Years",
        "Diagnosis (If Known)",
        "Treatment Taken (Y/N/NA)",
        "If Yes, From Where",
        "Oral Hygiene Satisfactory (Y/N)",
        "Hygiene Status Satisfactory (Y/N)",
        "ANC taken (Y/N/NA)",
        "Place (Home/Hospital)",
        "PNC taken (Y/N/NA)",
        "Use of Any FP Methods (Y/N/NA)",
        "Mamta Card (Y/N/NA)",
        "Immunization Status As Per Age (Y/N/NA)",
        "Type of Work (S/M/H)*",
        "Coefficient or Consumption Unit",
        "Calorie Intake (kcal)/CU/Day (Enter in front of 1st family member)",
        "Calorie Intake Status (D/N/E)* (Enter in front of 1st family member)",
        "Dietary Advice Provided (Y/N) (Enter in front of 1st family member)",
        // Extended longitudinal follow-up audit columns
        "Latest Follow-up Visit No",
        "Latest Follow-up Date",
        "Follow-up SBP (mmHg)",
        "Follow-up DBP (mmHg)",
        "Follow-up RBS (mg/dl)",
        "Follow-up Hb (g/dl)",
        "Follow-up Weight (kg)",
        "Treatment Compliance",
        "Health Progress",
        "Follow-up Clinical Notes"
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).trim();
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = [];
    rows.push(headers.map(escapeCsv).join(','));

    for (const fam of families) {
        for (let i = 0; i < fam.members.length; i++) {
            const m = fam.members[i];
            const isFirst = (i === 0);

            // Calorie status: map 'Normal' to 'N', 'Deficient' to 'D', 'Excess' to 'E'
            let calStatus = fam.calorie_status || '';
            if (calStatus.toLowerCase().startsWith('n')) calStatus = 'N';
            else if (calStatus.toLowerCase().startsWith('d')) calStatus = 'D';
            else if (calStatus.toLowerCase().startsWith('e')) calStatus = 'E';

            const row = [
                student.roll_number || '235',
                fam.family_no || '',
                m.name || '',
                m.age_years !== null && m.age_years !== undefined ? m.age_years : '',
                m.age_months !== null && m.age_months !== 0 ? m.age_months : '',
                m.has_htn || 'N',
                m.effective_sbp !== null && m.effective_sbp !== undefined ? m.effective_sbp : '',
                m.effective_dbp !== null && m.effective_dbp !== undefined ? m.effective_dbp : '',
                m.has_dm || 'N',
                m.effective_rbs !== null && m.effective_rbs !== undefined ? m.effective_rbs : '',
                m.has_pallor || 'N',
                m.effective_hb !== null && m.effective_hb !== undefined ? m.effective_hb : '',
                m.has_anaemia || 'N',
                m.hc_cm !== null && m.hc_cm !== undefined ? m.hc_cm : 'NA',
                m.cc_cm !== null && m.cc_cm !== undefined ? m.cc_cm : 'NA',
                m.effective_muac !== null && m.effective_muac !== undefined ? m.effective_muac : 'NA',
                m.height_m !== null && m.height_m !== undefined ? m.height_m : '',
                m.effective_weight !== null && m.effective_weight !== undefined ? m.effective_weight : '',
                m.bmi !== null && m.bmi !== undefined ? m.bmi : '',
                m.waist_cm !== null && m.waist_cm !== undefined ? m.waist_cm : 'NA',
                m.hip_cm !== null && m.hip_cm !== undefined ? m.hip_cm : 'NA',
                m.whr !== null && m.whr !== undefined ? m.whr : '',
                m.is_underweight || 'NA',
                m.is_overweight || 'NA',
                m.is_stunting || 'NA',
                m.is_wasting || 'NA',
                m.is_severe_wasting || 'NA',
                m.diagnosis || '',
                m.treatment_taken || 'NA',
                m.treatment_source || '',
                m.oral_hygiene || 'Y',
                m.general_hygiene || 'Y',
                m.anc_taken || 'NA',
                m.delivery_place || 'NA',
                m.pnc_taken || 'NA',
                m.fp_method_used || 'NA',
                m.mamta_card || 'NA',
                m.immunization_status || 'NA',
                m.work_type || 'S',
                m.consumption_unit !== null && m.consumption_unit !== undefined ? m.consumption_unit : 1.0,
                isFirst ? (fam.calorie_intake_per_cu || '') : '',
                isFirst ? calStatus : '',
                isFirst ? (fam.dietary_advice_given || 'N') : '',
                // Follow-up audit columns
                m.latest_visit_number ? `Visit ${m.latest_visit_number}` : '',
                m.latest_visit_date || '',
                m.fu_sbp !== null && m.fu_sbp !== undefined ? m.fu_sbp : '',
                m.fu_dbp !== null && m.fu_dbp !== undefined ? m.fu_dbp : '',
                m.fu_rbs !== null && m.fu_rbs !== undefined ? m.fu_rbs : '',
                m.fu_hb !== null && m.fu_hb !== undefined ? m.fu_hb : '',
                m.fu_weight_kg !== null && m.fu_weight_kg !== undefined ? m.fu_weight_kg : '',
                m.latest_compliance || '',
                m.latest_progress || '',
                m.latest_notes || ''
            ];

            rows.push(row.map(escapeCsv).join(','));
        }
    }

    return rows.join('\r\n');
}

/**
 * Generate high-fidelity clinical PDF ("make pdf a little good")
 * matching the 43 columns of Roll235.pdf + follow-up tracking sections.
 */
function generatePdfStream(studentId, outputStream) {
    const data = getStudentExportData(studentId);
    if (!data) {
        throw new Error('No survey data found for student');
    }

    const { student, families } = data;

    // A4 Landscape: width 841.89 pt, height 595.28 pt
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 24, bottom: 10, left: 28, right: 28 },
        autoFirstPage: true
    });

    doc.pipe(outputStream);

    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const contentWidth = 785; // Calibrated to 785 pt to fit within margins perfectly

    // Colors
    const primaryNavy = '#0f172a';
    const accentBlue = '#2563eb';
    const lightBg = '#f8fafc';
    const borderGray = '#cbd5e1';
    const textDark = '#1e293b';
    const textMuted = '#64748b';
    const tealBg = '#f0fdf4';
    const tealBorder = '#86efac';
    const roseBg = '#fff1f2';
    const roseBorder = '#fca5a5';

    // Helper: Draw Header on active page
    function drawPageHeader() {
        const topY = 28;
        // Background banner
        doc.rect(28, topY, contentWidth, 54).fillAndStroke('#0f172a', '#1e293b');

        // Institution title
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff')
            .text('MEDPULSE HEALTH SURVEILLANCE & EPIDEMIOLOGICAL FIELD LOGBOOK', 40, topY + 8);
        
        doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8')
            .text('Department of Community Medicine (PSM) • Official Field Practice Area Survey Proforma', 40, topY + 23);

        // Cadet Info block on right side
        const rightX = contentWidth - 260;
        doc.rect(rightX, topY + 6, 280, 42).fillAndStroke('#1e293b', '#334155');
        
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#38bdf8')
            .text(`Cadet: ${student.name} (Roll No: ${student.roll_number})`, rightX + 8, topY + 11);
        
        doc.fontSize(7.5).font('Helvetica').fillColor('#cbd5e1')
            .text(`${student.college_name || 'Medical College'} • ${student.batch_year || 'Batch 2024-25'}`, rightX + 8, topY + 23)
            .text(`Unit: ${student.posting_unit || 'RHTC Rural Center'} • Date: ${new Date().toLocaleDateString('en-GB')}`, rightX + 8, topY + 34);

        doc.y = topY + 62;
    }

    let isFirstPage = true;

    for (let fIdx = 0; fIdx < families.length; fIdx++) {
        const fam = families[fIdx];

        if (!isFirstPage) {
            doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 24, bottom: 10, left: 28, right: 28 } });
        }
        isFirstPage = false;

        drawPageHeader();

        // -------------------------------------------------------------
        // Family Banner Card
        // -------------------------------------------------------------
        let currentY = doc.y;
        doc.rect(28, currentY, contentWidth, 36).fillAndStroke('#f1f5f9', '#cbd5e1');

        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a')
            .text(`HOUSEHOLD #${fam.family_no}: ${fam.family_name || 'Family ' + fam.family_no} (Head: ${fam.head_of_family})`, 38, currentY + 7);

        doc.fontSize(7.5).font('Helvetica').fillColor('#475569')
            .text(`Address: ${fam.address || fam.village_ward || 'Rural Center'}  |  Survey Date: ${fam.survey_date || '2026-08-01'}  |  Total Members: ${fam.members.length}`, 38, currentY + 22);

        // Dietary & Calorie stats on right
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0369a1')
            .text(`Dietary CU: ${fam.total_cu || 0}  |  Intake: ${fam.calorie_intake_per_cu || 0} kcal/CU/Day (${fam.calorie_status || 'Normal'})  |  Advice: ${fam.dietary_advice_given === 'Y' ? 'Provided' : 'None'}`, contentWidth - 280, currentY + 12);

        currentY += 44;

        // -------------------------------------------------------------
        // TABLE 1: Clinical Survey Proforma (Demographics, NCDs, Baseline & Latest Vitals)
        // -------------------------------------------------------------
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(accentBlue)
            .text('1. SOCIO-DEMOGRAPHICS, NCD SCREENING & MONITORED VITALS (BASELINE + LATEST FOLLOW-UP)', 28, currentY);
        currentY += 12;

        // Columns definition for Table 1 (Sum = Exactly 785 pt = contentWidth)
        const t1Cols = [
            { id: 'num', label: '#', w: 16, align: 'center' },
            { id: 'name', label: 'Name of Member', w: 116, align: 'left' },
            { id: 'rel', label: 'Relation', w: 44, align: 'left' },
            { id: 'age', label: 'Age', w: 30, align: 'center' },
            { id: 'work', label: 'Work', w: 26, align: 'center' },
            { id: 'cu', label: 'CU', w: 24, align: 'center' },
            { id: 'htn', label: 'HTN', w: 25, align: 'center' },
            { id: 'sbp_dbp', label: 'SBP/DBP (mmHg)', w: 72, align: 'center' },
            { id: 'dm', label: 'DM', w: 25, align: 'center' },
            { id: 'rbs', label: 'RBS (mg/dl)', w: 54, align: 'center' },
            { id: 'pallor', label: 'Pallor', w: 28, align: 'center' },
            { id: 'hb', label: 'Hb (g/dl)', w: 48, align: 'center' },
            { id: 'anaemia', label: 'Anaemia', w: 40, align: 'center' },
            { id: 'diag', label: 'Diagnosis (If Known)', w: 85, align: 'left' },
            { id: 'rx', label: 'Treatment (Source)', w: 72, align: 'left' },
            { id: 'fu_badge', label: 'Follow-up Status', w: 80, align: 'center' }
        ];

        // Draw Table 1 Header
        const t1HeaderH = 18;
        doc.rect(28, currentY, contentWidth, t1HeaderH).fillAndStroke('#1e293b', '#0f172a');
        let colX = 28;
        for (const col of t1Cols) {
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#ffffff')
                .text(col.label, colX + 2, currentY + 5, { width: col.w - 4, align: col.align, lineBreak: false });
            colX += col.w;
        }
        currentY += t1HeaderH;

        // Draw Table 1 Rows
        const rowH = 15;
        for (let mIdx = 0; mIdx < fam.members.length; mIdx++) {
            const m = fam.members[mIdx];
            const isAlt = (mIdx % 2 === 1);
            const rowBg = isAlt ? '#f8fafc' : '#ffffff';

            doc.rect(28, currentY, contentWidth, rowH).fillAndStroke(rowBg, '#e2e8f0');

            // Format values
            const ageStr = `${m.age_years || 0}y` + (m.age_months ? ` ${m.age_months}m` : '');
            
            // SBP/DBP display: show effective with asterisk if from follow-up
            let bpStr = '-';
            if (m.effective_sbp || m.effective_dbp) {
                bpStr = `${m.effective_sbp || '-'}/${m.effective_dbp || '-'}` + (m.has_followup ? ' *' : '');
            }

            let rbsStr = m.effective_rbs ? `${m.effective_rbs}` + (m.has_followup && m.fu_rbs ? ' *' : '') : '-';
            let hbStr = m.effective_hb ? `${m.effective_hb}` + (m.has_followup && m.fu_hb ? ' *' : '') : '-';
            
            let nameStr = m.name || '';
            if (nameStr.length > 22) nameStr = nameStr.substring(0, 20) + '..';

            let relStr = m.relation_to_hof || 'Other';
            if (relStr.length > 10) relStr = relStr.substring(0, 8) + '..';

            let diagStr = m.diagnosis || '-';
            if (diagStr.length > 18) diagStr = diagStr.substring(0, 16) + '..';

            let rxStr = m.treatment_taken === 'Y' ? `Yes (${m.treatment_source || 'PHC'})` : (m.treatment_taken || 'NA');
            if (rxStr.length > 16) rxStr = rxStr.substring(0, 14) + '..';

            let fuStatus = m.has_followup ? `Visit ${m.latest_visit_number} (${m.latest_progress || 'Stable'})` : 'Baseline Only';
            if (fuStatus.length > 20) fuStatus = fuStatus.substring(0, 18) + '..';

            colX = 28;
            const vals = [
                { t: `${mIdx + 1}`, align: 'center', c: textMuted },
                { t: nameStr, align: 'left', c: textDark, bold: true },
                { t: relStr, align: 'left', c: textDark },
                { t: ageStr, align: 'center', c: textDark },
                { t: m.work_type || 'S', align: 'center', c: textMuted },
                { t: `${m.consumption_unit || 1}`, align: 'center', c: textMuted },
                { t: m.has_htn || 'N', align: 'center', c: m.has_htn === 'Y' ? '#dc2626' : textMuted, bold: m.has_htn === 'Y' },
                { t: bpStr, align: 'center', c: m.has_htn === 'Y' ? '#b91c1c' : textDark, bold: m.has_htn === 'Y' },
                { t: m.has_dm || 'N', align: 'center', c: m.has_dm === 'Y' ? '#dc2626' : textMuted, bold: m.has_dm === 'Y' },
                { t: rbsStr, align: 'center', c: m.effective_rbs > 160 ? '#b91c1c' : textDark, bold: m.effective_rbs > 160 },
                { t: m.has_pallor || 'N', align: 'center', c: m.has_pallor === 'Y' ? '#ea580c' : textMuted },
                { t: hbStr, align: 'center', c: m.effective_hb < 10 ? '#dc2626' : textDark, bold: m.effective_hb < 10 },
                { t: m.has_anaemia || 'N', align: 'center', c: m.has_anaemia === 'Y' ? '#dc2626' : textMuted, bold: m.has_anaemia === 'Y' },
                { t: diagStr, align: 'left', c: textDark },
                { t: rxStr, align: 'left', c: textMuted },
                { t: fuStatus, align: 'center', c: m.has_followup ? '#059669' : textMuted, bold: m.has_followup }
            ];

            for (let c = 0; c < t1Cols.length; c++) {
                const col = t1Cols[c];
                const item = vals[c];
                doc.fontSize(6.5).font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(item.c)
                    .text(item.t, colX + 2, currentY + 4, { width: col.w - 4, align: col.align, lineBreak: false });
                colX += col.w;
            }
            currentY += rowH;
        }

        currentY += 8;

        // -------------------------------------------------------------
        // TABLE 2: Anthropometry, Nutrition & Maternal/Child Health (RCH)
        // -------------------------------------------------------------
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(accentBlue)
            .text('2. ANTHROPOMETRY, PEDIATRIC GROWTH SCREENING & MATERNAL HEALTH (RCH)', 28, currentY);
        currentY += 12;

        // Columns definition for Table 2 (Sum = Exactly 785 pt = contentWidth)
        const t2Cols = [
            { id: 'name', label: 'Member Name', w: 121, align: 'left' },
            { id: 'ht', label: 'Ht (m)', w: 32, align: 'center' },
            { id: 'wt', label: 'Wt (kg)', w: 34, align: 'center' },
            { id: 'bmi', label: 'BMI', w: 32, align: 'center' },
            { id: 'waist', label: 'Waist', w: 32, align: 'center' },
            { id: 'hip', label: 'Hip', w: 32, align: 'center' },
            { id: 'whr', label: 'WHR', w: 30, align: 'center' },
            { id: 'hc', label: 'HC (cm)', w: 34, align: 'center' },
            { id: 'cc', label: 'CC (cm)', w: 34, align: 'center' },
            { id: 'muac', label: 'MUAC', w: 34, align: 'center' },
            { id: 'underwt', label: 'Underwt', w: 36, align: 'center' },
            { id: 'overwt', label: 'Overwt', w: 36, align: 'center' },
            { id: 'stunt', label: 'Stunting', w: 35, align: 'center' },
            { id: 'waste', label: 'Wasting', w: 35, align: 'center' },
            { id: 'hyg', label: 'Oral/Gen Hyg', w: 54, align: 'center' },
            { id: 'anc', label: 'ANC (Place)', w: 50, align: 'center' },
            { id: 'pnc', label: 'PNC', w: 28, align: 'center' },
            { id: 'fp', label: 'FP', w: 28, align: 'center' },
            { id: 'mamta', label: 'Mamta', w: 34, align: 'center' },
            { id: 'imm', label: 'Immun.', w: 34, align: 'center' }
        ];

        // Draw Table 2 Header
        doc.rect(28, currentY, contentWidth, t1HeaderH).fillAndStroke('#334155', '#1e293b');
        colX = 28;
        for (const col of t2Cols) {
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#ffffff')
                .text(col.label, colX + 2, currentY + 5, { width: col.w - 4, align: col.align, lineBreak: false });
            colX += col.w;
        }
        currentY += t1HeaderH;

        // Draw Table 2 Rows
        for (let mIdx = 0; mIdx < fam.members.length; mIdx++) {
            const m = fam.members[mIdx];
            const isAlt = (mIdx % 2 === 1);
            const rowBg = isAlt ? '#f8fafc' : '#ffffff';

            doc.rect(28, currentY, contentWidth, rowH).fillAndStroke(rowBg, '#e2e8f0');

            let nameStr2 = m.name || '';
            if (nameStr2.length > 22) nameStr2 = nameStr2.substring(0, 20) + '..';

            let ancStr = m.anc_taken === 'Y' ? `Y (${m.delivery_place || 'Hosp'})` : (m.anc_taken || 'NA');
            if (ancStr.length > 12) ancStr = ancStr.substring(0, 10) + '..';

            const hygStr = `${m.oral_hygiene || 'Y'} / ${m.general_hygiene || 'Y'}`;

            colX = 28;
            const vals2 = [
                { t: nameStr2, align: 'left', c: textDark, bold: true },
                { t: m.height_m ? `${m.height_m}` : '-', align: 'center', c: textDark },
                { t: m.effective_weight ? `${m.effective_weight}` : '-', align: 'center', c: textDark },
                { t: m.bmi ? `${m.bmi}` : '-', align: 'center', c: m.bmi >= 25 ? '#b91c1c' : textDark, bold: m.bmi >= 25 },
                { t: m.waist_cm ? `${m.waist_cm}` : 'NA', align: 'center', c: textMuted },
                { t: m.hip_cm ? `${m.hip_cm}` : 'NA', align: 'center', c: textMuted },
                { t: m.whr ? `${m.whr}` : '-', align: 'center', c: textMuted },
                { t: m.hc_cm ? `${m.hc_cm}` : 'NA', align: 'center', c: textMuted },
                { t: m.cc_cm ? `${m.cc_cm}` : 'NA', align: 'center', c: textMuted },
                { t: m.effective_muac ? `${m.effective_muac}` : 'NA', align: 'center', c: textMuted },
                { t: m.is_underweight || 'NA', align: 'center', c: m.is_underweight === 'Y' ? '#dc2626' : textMuted },
                { t: m.is_overweight || 'NA', align: 'center', c: m.is_overweight === 'Y' ? '#dc2626' : textMuted },
                { t: m.is_stunting || 'NA', align: 'center', c: m.is_stunting === 'Y' ? '#dc2626' : textMuted },
                { t: m.is_wasting || 'NA', align: 'center', c: m.is_wasting === 'Y' ? '#dc2626' : textMuted },
                { t: hygStr, align: 'center', c: textDark },
                { t: ancStr, align: 'center', c: textDark },
                { t: m.pnc_taken || 'NA', align: 'center', c: textMuted },
                { t: m.fp_method_used || 'NA', align: 'center', c: textMuted },
                { t: m.mamta_card || 'NA', align: 'center', c: textMuted },
                { t: m.immunization_status || 'NA', align: 'center', c: textMuted }
            ];

            for (let c = 0; c < t2Cols.length; c++) {
                const col = t2Cols[c];
                const item = vals2[c];
                doc.fontSize(6.5).font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(item.c)
                    .text(item.t, colX + 2, currentY + 4, { width: col.w - 4, align: col.align, lineBreak: false });
                colX += col.w;
            }
            currentY += rowH;
        }

        currentY += 8;

        // -------------------------------------------------------------
        // SECTION 3: Longitudinal Follow-up Progress Tracking
        // -------------------------------------------------------------
        const followUpMembers = fam.members.filter(m => m.has_followup);
        if (followUpMembers.length > 0) {
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#059669')
                .text(`3. LONGITUDINAL CLINICAL FOLLOW-UP PROGRESS (${followUpMembers.length} Patients Active on Follow-up Protocol)`, 28, currentY);
            currentY += 12;

            const fuCols = [
                { id: 'mname', label: 'Patient Name & Age', w: 130, align: 'left' },
                { id: 'vnum', label: 'Latest Visit # & Date', w: 90, align: 'center' },
                { id: 'vitals_comp', label: 'Baseline -> Latest Follow-Up Vitals', w: 180, align: 'left' },
                { id: 'comp', label: 'Compliance', w: 75, align: 'center' },
                { id: 'prog', label: 'Progress Status', w: 80, align: 'center' },
                { id: 'notes', label: 'Cadet Clinical Notes & Prescription Plan', w: 230, align: 'left' }
            ];

            doc.rect(28, currentY, contentWidth, t1HeaderH).fillAndStroke('#065f46', '#047857');
            colX = 28;
            for (const col of fuCols) {
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#ffffff')
                    .text(col.label, colX + 2, currentY + 5, { width: col.w - 4, align: col.align, lineBreak: false });
                colX += col.w;
            }
            currentY += t1HeaderH;

            const fuRowH = 18;
            for (let fuIdx = 0; fuIdx < followUpMembers.length; fuIdx++) {
                const fm = followUpMembers[fuIdx];
                const isAlt = (fuIdx % 2 === 1);
                doc.rect(28, currentY, contentWidth, fuRowH).fillAndStroke(isAlt ? '#ecfdf5' : '#ffffff', '#a7f3d0');

                // Vitals trajectory string
                let vitalsTrajectory = [];
                if (fm.has_htn === 'Y' || fm.sbp || fm.fu_sbp) {
                    vitalsTrajectory.push(`BP: ${fm.sbp || '-'}/${fm.dbp || '-'} -> ${fm.fu_sbp || '-'}/${fm.fu_dbp || '-'} mmHg`);
                }
                if (fm.has_dm === 'Y' || fm.rbs || fm.fu_rbs) {
                    vitalsTrajectory.push(`RBS: ${fm.rbs || '-'} -> ${fm.fu_rbs || '-'} mg/dL`);
                }
                if (fm.has_anaemia === 'Y' || fm.has_pallor === 'Y' || fm.hb || fm.fu_hb) {
                    vitalsTrajectory.push(`Hb: ${fm.hb || '-'} -> ${fm.fu_hb || '-'} g/dL`);
                }
                if (vitalsTrajectory.length === 0) {
                    vitalsTrajectory.push(`Wt: ${fm.weight_kg || '-'} -> ${fm.fu_weight_kg || '-'} kg`);
                }

                let fmName = `${fm.name} (${fm.age_years}y)`;
                if (fmName.length > 25) fmName = fmName.substring(0, 23) + '..';

                let fmNotes = fm.latest_notes || 'Regular follow-up maintained. Patient stabilized.';
                if (fmNotes.length > 55) fmNotes = fmNotes.substring(0, 52) + '...';

                colX = 28;
                const fuVals = [
                    { t: fmName, align: 'left', c: textDark, bold: true },
                    { t: `Visit ${fm.latest_visit_number} • ${fm.latest_visit_date}`, align: 'center', c: '#065f46', bold: true },
                    { t: vitalsTrajectory.join(' | '), align: 'left', c: '#0f172a', bold: true },
                    { t: fm.latest_compliance || 'Good', align: 'center', c: fm.latest_compliance === 'Irregular' ? '#b45309' : '#047857', bold: true },
                    { t: fm.latest_progress || 'Improved', align: 'center', c: fm.latest_progress === 'Improved' ? '#047857' : '#0369a1', bold: true },
                    { t: fmNotes, align: 'left', c: '#334155' }
                ];

                for (let c = 0; c < fuCols.length; c++) {
                    const col = fuCols[c];
                    const item = fuVals[c];
                    doc.fontSize(6.5).font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(item.c)
                        .text(item.t, colX + 2, currentY + 5, { width: col.w - 4, align: col.align, lineBreak: false });
                    colX += col.w;
                }
                currentY += fuRowH;
            }
        }

        // Footer on active family page (positioned cleanly within margins to prevent page overflow)
        const footerY = 566;
        doc.rect(28, footerY, contentWidth, 14).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fontSize(6.5).font('Helvetica').fillColor(textMuted)
            .text(`MedPulse PSM Clinical Field Registry • Roll ${student.roll_number || '235'} - ${student.name} • Note: Parameters marked with (*) denote values from the Latest Clinical Follow-Up visit`, 34, footerY + 4, { lineBreak: false });
        doc.text(`Family ${fIdx + 1} of ${families.length}`, contentWidth - 40, footerY + 4, { width: 60, align: 'right', lineBreak: false });
    }

    doc.end();
}

/**
 * Generate Master Compilation CSV across ALL students (or filtered by college)
 */
function generateMasterCsv(collegeId = null) {
    let studentQuery = `SELECT id FROM students WHERE 1=1`;
    const params = [];
    if (collegeId) {
        studentQuery += ` AND college_id = ?`;
        params.push(collegeId);
    }
    studentQuery += ` ORDER BY roll_number ASC`;
    const studentRows = db.prepare(studentQuery).all(...params);

    const headers = [
        "Cadet Name",
        "Cadet Roll Number",
        "Medical College",
        "Posting Unit",
        "Family No.",
        "Family Code",
        "Name of Family Member (start with HOF)",
        "Age (in Completed Years)",
        "Age (in Completed Months)",
        "HTN (Y/N)",
        "SBP ONLY for ADULTS",
        "DBP ONLY for ADULTS",
        "DM (Y/N)",
        "RBS (mg/dl)",
        "Pallor (Y/N)",
        "Hb (g/dl)",
        "Anaemia (Y/N)",
        "HC (Upto 2 Years of Age)",
        "CC (Upto 2 Years of Age)",
        "MUAC (6 Month to 5 Years of Age)",
        "Ht (m)",
        "Wt. (kg.)",
        "BMI (kg/m2)",
        "Waist Circumference (in CM) ONLY ADULTS",
        "Hip Circumference (in CM) ONLY ADULTS",
        "WHR Only Adults",
        "Under-weight (Y/ N/ NA) ONLY for 0-5 Years",
        "Overweight (Y/ N/ NA) ONLY for 0-5 Years",
        "Stunting (Y/ N/ NA) ONLY for 0-5 Years",
        "Wasting (Y/ N/ NA) ONLY for 0-5 Years",
        "Severe Wasting (Y/ N/ NA) ONLY for 0-5 Years",
        "Diagnosis (If Known)",
        "Treatment Taken (Y/N/NA)",
        "If Yes, From Where",
        "Oral Hygiene Satisfactory (Y/N)",
        "Hygiene Status Satisfactory (Y/N)",
        "ANC taken (Y/N/NA)",
        "Place (Home/Hospital)",
        "PNC taken (Y/N/NA)",
        "Use of Any FP Methods (Y/N/NA)",
        "Mamta Card (Y/N/NA)",
        "Immunization Status As Per Age (Y/N/NA)",
        "Type of Work (S/M/H)*",
        "Coefficient or Consumption Unit",
        "Calorie Intake (kcal)/CU/Day",
        "Calorie Intake Status (D/N/E)*",
        "Dietary Advice Provided (Y/N)",
        "Latest Follow-up Visit No",
        "Latest Follow-up Date",
        "Follow-up SBP (mmHg)",
        "Follow-up DBP (mmHg)",
        "Follow-up RBS (mg/dl)",
        "Follow-up Hb (g/dl)",
        "Follow-up Weight (kg)",
        "Treatment Compliance",
        "Health Progress",
        "Follow-up Clinical Notes"
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).trim();
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = [];
    rows.push(headers.map(escapeCsv).join(','));

    for (const sRow of studentRows) {
        const data = getStudentExportData(sRow.id);
        if (!data || !data.families) continue;
        const { student, families } = data;

        for (const fam of families) {
            for (let i = 0; i < fam.members.length; i++) {
                const m = fam.members[i];
                const isFirst = (i === 0);

                let calStatus = fam.calorie_status || '';
                if (calStatus.toLowerCase().startsWith('n')) calStatus = 'N';
                else if (calStatus.toLowerCase().startsWith('d')) calStatus = 'D';
                else if (calStatus.toLowerCase().startsWith('e')) calStatus = 'E';

                const row = [
                    student.name || '',
                    student.roll_number || '',
                    student.college_name || '',
                    student.posting_unit || '',
                    fam.family_no || '',
                    fam.family_code || `FAM-${String(fam.family_no).padStart(4, '0')}`,
                    m.name || '',
                    m.age_years !== null && m.age_years !== undefined ? m.age_years : '',
                    m.age_months !== null && m.age_months !== 0 ? m.age_months : '',
                    m.has_htn || 'N',
                    m.effective_sbp !== null && m.effective_sbp !== undefined ? m.effective_sbp : '',
                    m.effective_dbp !== null && m.effective_dbp !== undefined ? m.effective_dbp : '',
                    m.has_dm || 'N',
                    m.effective_rbs !== null && m.effective_rbs !== undefined ? m.effective_rbs : '',
                    m.has_pallor || 'N',
                    m.effective_hb !== null && m.effective_hb !== undefined ? m.effective_hb : '',
                    m.has_anaemia || 'N',
                    m.hc_cm !== null && m.hc_cm !== undefined ? m.hc_cm : 'NA',
                    m.cc_cm !== null && m.cc_cm !== undefined ? m.cc_cm : 'NA',
                    m.effective_muac !== null && m.effective_muac !== undefined ? m.effective_muac : 'NA',
                    m.height_m !== null && m.height_m !== undefined ? m.height_m : '',
                    m.effective_weight !== null && m.effective_weight !== undefined ? m.effective_weight : '',
                    m.bmi !== null && m.bmi !== undefined ? m.bmi : '',
                    m.waist_cm !== null && m.waist_cm !== undefined ? m.waist_cm : '',
                    m.hip_cm !== null && m.hip_cm !== undefined ? m.hip_cm : '',
                    m.whr !== null && m.whr !== undefined ? m.whr : '',
                    m.is_underweight || 'NA',
                    m.is_overweight || 'NA',
                    m.is_stunting || 'NA',
                    m.is_wasting || 'NA',
                    m.is_severe_wasting || 'NA',
                    m.diagnosis || '',
                    m.treatment_taken || 'NA',
                    m.treatment_source || '',
                    m.oral_hygiene || 'Y',
                    m.general_hygiene || 'Y',
                    m.anc_taken || 'NA',
                    m.delivery_place || 'NA',
                    m.pnc_taken || 'NA',
                    m.fp_method_used || 'NA',
                    m.mamta_card || 'NA',
                    m.immunization_status || 'NA',
                    m.work_type || 'NA',
                    m.consumption_unit !== null && m.consumption_unit !== undefined ? m.consumption_unit : '',
                    isFirst && fam.calorie_intake_per_cu ? fam.calorie_intake_per_cu : '',
                    isFirst && calStatus ? calStatus : '',
                    isFirst && fam.dietary_advice_given ? fam.dietary_advice_given : '',
                    m.has_followup ? `Visit ${m.latest_visit_number}` : '',
                    m.has_followup ? m.latest_visit_date : '',
                    m.has_followup && m.fu_sbp !== null ? m.fu_sbp : '',
                    m.has_followup && m.fu_dbp !== null ? m.fu_dbp : '',
                    m.has_followup && m.fu_rbs !== null ? m.fu_rbs : '',
                    m.has_followup && m.fu_hb !== null ? m.fu_hb : '',
                    m.has_followup && m.fu_weight_kg !== null ? m.fu_weight_kg : '',
                    m.has_followup && m.latest_compliance ? m.latest_compliance : '',
                    m.has_followup && m.latest_progress ? m.latest_progress : '',
                    m.has_followup && m.latest_notes ? m.latest_notes : ''
                ];
                rows.push(row.map(escapeCsv).join(','));
            }
        }
    }

    return rows.join('\r\n');
}

/**
 * Generate Master Faculty Surveillance & Audit PDF Report
 */
function generateFacultyAuditPdfStream(res) {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28,
        info: {
            Title: 'MedPulse Faculty Clinical Surveillance Audit Report',
            Author: 'Community Medicine Department (PSM)',
            Subject: 'Master Administrative Health Survey Audit'
        }
    });

    doc.pipe(res);

    const primaryColor = '#0f172a';
    const accentColor = '#7c3aed';
    const skyBlue = '#0284c7';
    const textMuted = '#64748b';
    const contentWidth = 841.89 - 56;

    // Header Banner
    doc.rect(28, 24, contentWidth, 54).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.rect(28, 24, 6, 54).fill(accentColor);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor)
        .text('MEDPULSE • FACULTY CLINICAL SURVEILLANCE AUDIT REPORT', 42, 34);
    doc.fontSize(8.5).font('Helvetica').fillColor(textMuted)
        .text('Community Medicine Department (PSM) • Master Academic Audit & Population Health Roster', 42, 53);

    const genDate = new Date().toISOString().split('T')[0];
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(skyBlue)
        .text(`Audit Date: ${genDate}`, contentWidth - 100, 36, { width: 120, align: 'right' });
    doc.fontSize(7.5).font('Helvetica').fillColor(textMuted)
        .text('Status: Official Academic Record', contentWidth - 100, 52, { width: 120, align: 'right' });

    // Aggregate Stats Query
    const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get()?.c || 0;
    const totalFamilies = db.prepare('SELECT COUNT(*) as c FROM families').get()?.c || 0;
    const totalMembers = db.prepare('SELECT COUNT(*) as c FROM family_members').get()?.c || 0;
    const totalFollowups = db.prepare('SELECT COUNT(*) as c FROM follow_ups').get()?.c || 0;
    const totalHtn = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_htn = 'Y'").get()?.c || 0;
    const totalDm = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_dm = 'Y'").get()?.c || 0;
    const totalAnaemia = db.prepare("SELECT COUNT(*) as c FROM family_members WHERE has_anaemia = 'Y'").get()?.c || 0;

    // Executive KPI Strip
    const kpiY = 88;
    const kpiW = (contentWidth - 24) / 4;
    const kpis = [
        { label: 'Registered Medical Cadets', val: totalStudents, sub: 'Active Survey Teams', col: '#7c3aed' },
        { label: 'Surveyed Households', val: totalFamilies, sub: 'Community Catchment Units', col: '#0284c7' },
        { label: 'Enrolled Population', val: totalMembers, sub: 'Individuals Screened', col: '#059669' },
        { label: 'Follow-Up Visits Logged', val: totalFollowups, sub: 'Longitudinal Encounters', col: '#e11d48' }
    ];

    for (let i = 0; i < kpis.length; i++) {
        const k = kpis[i];
        const x = 28 + i * (kpiW + 8);
        doc.rect(x, kpiY, kpiW, 46).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.rect(x, kpiY, 3, 46).fill(k.col);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(k.col).text(String(k.val), x + 10, kpiY + 8);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor).text(k.label, x + 10, kpiY + 24);
        doc.fontSize(6.5).font('Helvetica').fillColor(textMuted).text(k.sub, x + 10, kpiY + 34);
    }

    // Health Burden Mini-Card
    const burdenY = 142;
    doc.rect(28, burdenY, contentWidth, 22).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor)
        .text(`Catchment Epidemiological Burden Identified:   Hypertension (HTN): ${totalHtn} cases   •   Type 2 Diabetes (DM): ${totalDm} cases   •   Anaemia Burden: ${totalAnaemia} cases`, 38, burdenY + 7);

    // Student Performance Table
    const tableY = 172;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(primaryColor)
        .text('Student Cadre Survey Performance & Submission Roster', 28, tableY);

    const theadY = tableY + 16;
    const cols = [
        { title: 'Roll', w: 45, align: 'center' },
        { title: 'Cadet Full Name', w: 160, align: 'left' },
        { title: 'Medical Institution / College', w: 180, align: 'left' },
        { title: 'Batch & Professional Year', w: 140, align: 'left' },
        { title: 'Posting Unit', w: 120, align: 'left' },
        { title: 'Households', w: 50, align: 'center' },
        { title: 'Members', w: 45, align: 'center' },
        { title: 'Status', w: 45, align: 'center' }
    ];

    doc.rect(28, theadY, contentWidth, 16).fill('#1e293b');
    let hx = 28;
    for (const c of cols) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
            .text(c.title, hx + 2, theadY + 5, { width: c.w - 4, align: c.align, lineBreak: false });
        hx += c.w;
    }

    const students = db.prepare(`
        SELECT s.*, c.name as college_name,
               (SELECT COUNT(*) FROM families f WHERE f.student_id = s.id) as fam_count,
               (SELECT COUNT(*) FROM family_members m JOIN families f ON m.family_id = f.id WHERE f.student_id = s.id) as mem_count
        FROM students s
        LEFT JOIN colleges c ON s.college_id = c.id
        ORDER BY s.roll_number ASC
    `).all();

    let curY = theadY + 16;
    const rowH = 18;

    for (let idx = 0; idx < students.length; idx++) {
        const s = students[idx];
        const isEven = idx % 2 === 0;
        doc.rect(28, curY, contentWidth, rowH).fillAndStroke(isEven ? '#ffffff' : '#f8fafc', '#e2e8f0');

        const vals = [
            { t: s.roll_number, align: 'center', bold: true, c: primaryColor },
            { t: s.name, align: 'left', bold: true, c: '#0f172a' },
            { t: s.college_name || 'GMERS Medical College', align: 'left', bold: false, c: '#334155' },
            { t: s.batch_year || '3rd Year MBBS', align: 'left', bold: false, c: '#475569' },
            { t: s.posting_unit || 'RHTC Training Center', align: 'left', bold: false, c: '#475569' },
            { t: String(s.fam_count), align: 'center', bold: true, c: '#0284c7' },
            { t: String(s.mem_count), align: 'center', bold: true, c: '#059669' },
            { t: s.status || 'Active', align: 'center', bold: true, c: s.status === 'Active' ? '#047857' : '#64748b' }
        ];

        let rx = 28;
        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
            const col = cols[cIdx];
            const item = vals[cIdx];
            doc.fontSize(7).font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(item.c)
                .text(item.t, rx + 2, curY + 5, { width: col.w - 4, align: col.align, lineBreak: false });
            rx += col.w;
        }

        curY += rowH;
    }

    // Footer
    const footY = 566;
    doc.rect(28, footY, contentWidth, 14).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(6.5).font('Helvetica').fillColor(textMuted)
        .text('MedPulse PSM Administrative Surveillance Audit • Department of Community Medicine • Official HOD Registry', 34, footY + 4, { lineBreak: false });
    doc.text(`Page 1 of 1`, contentWidth - 40, footY + 4, { width: 60, align: 'right', lineBreak: false });

    doc.end();
}

module.exports = {
    getStudentExportData,
    generateCsv,
    generatePdfStream,
    generateMasterCsv,
    generateFacultyAuditPdfStream
};

