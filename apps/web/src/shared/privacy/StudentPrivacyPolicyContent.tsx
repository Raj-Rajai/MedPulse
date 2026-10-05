export function StudentPrivacyPolicyContent() {
    return (
        <div className="privacy-policy-document" style={{ lineHeight: '1.7', color: 'var(--text-secondary, #334155)' }}>
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 8px' }}>
                    MedPulse Student Privacy Policy
                </h1>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', flexWrap: 'wrap' }}>
                    <span><strong>Last Updated:</strong> 05 October 2026</span>
                    <span>•</span>
                    <span><strong>Policy Version:</strong> v1.0.0</span>
                    <span>•</span>
                    <span><strong>Scope:</strong> Student Community Medicine / FAP</span>
                </div>
            </div>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>1. What this policy covers</h3>
                <p>This policy explains how MedPulse handles information in the Student Community Medicine / Family Adoption Programme (FAP) environment. It explains:</p>
                <ul className="privacy-rule-list">
                    <li>Information categories that may be processed</li>
                    <li>Authorized purposes of data use</li>
                    <li>Who may access information and how access is restricted</li>
                    <li>Student professional responsibilities and conduct</li>
                    <li>Security safeguards and tenant isolation</li>
                    <li>Retention and anonymisation rules</li>
                    <li>Consent and withdrawal workflows where applicable</li>
                    <li>Special handling of health-related information and minors</li>
                    <li>Privacy concerns and incident escalation channels</li>
                </ul>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>2. Information we may process</h3>
                <p>Depending on your authorized workflow, MedPulse processes:</p>
                <ul className="privacy-rule-list">
                    <li><strong>Student &amp; Account Information:</strong> Name, roll number, official email, contact phone, batch/cadre, authenticated session metadata, and security logs.</li>
                    <li><strong>FAP &amp; Programme Information:</strong> Student-entered baseline family surveys, socio-demographic indicators, household head records, and longitudinal follow-up visit entries.</li>
                    <li><strong>Patient &amp; Family Information:</strong> Member names, age, gender, contact details, genealogical relationships, village/ward location, and dwelling conditions.</li>
                    <li><strong>Health-Related Information:</strong> Where explicitly authorized by clinical posting: vital parameters (BP, pulse), blood glucose (RBS), haemoglobin (Hb), BMI, nutritional assessments, and hospital diagnostic observations.</li>
                </ul>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>3. Why we process information</h3>
                <p>Information is processed strictly for legitimate educational, clinical, and institutional purposes:</p>
                <ul className="privacy-rule-list">
                    <li>Execution of authorized Family Adoption Programme (FAP) field curriculum.</li>
                    <li>Academic evaluation and Competency Based Medical Education (CBME) logging.</li>
                    <li>Coordination of longitudinal family health surveillance and referral follow-ups.</li>
                    <li>Platform security, rate limiting, audit compliance, and abuse prevention.</li>
                </ul>
                <p style={{ fontStyle: 'italic', color: '#64748b' }}>Information is never processed for unrelated commercial purposes or personal curiosity.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>4. Data minimisation</h3>
                <p>MedPulse enforces the principle of minimum necessary data. Students must enter only what is clinically and academically required, accurate, and purposeful. Do not invent, guess, or populate fields merely because they exist on the interface.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>5. Student access &amp; assignment lifecycle</h3>
                <p>Student access is strictly conditional upon: <code>Authentication + Active Account + Student Role + Active Family Assignment</code>. Knowing a family ID or patient ID does not grant access. If an assignment ends or is revoked, access terminates immediately. Unsaved changes are rejected and incomplete drafts are handled per institutional policy.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>6. Medical records restriction</h3>
                <p>Medical records remain hospital-managed. Student access to hospital clinical records is strictly <strong>read-only</strong>. Students cannot create, edit, delete, or comment on official hospital medical charts, nor export clinical records outside authorized channels.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>7. Security safeguards</h3>
                <p>MedPulse employs defense-in-depth security: tenant isolation, role-based and assignment-based server authorization, cryptographic PIN authentication, OTP verification for sensitive operations, audit logging, rate limiting, and session security controls.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>8. Retention &amp; irreversible anonymisation</h3>
                <p>MedPulse does not invent arbitrary retention durations. Retention follows medical council and statutory rules. When retention expires, the workflow requires: <code>Retention Expiration → Admin Review → Permanent &amp; Irreversible System Anonymisation</code>.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>9. Third parties, vendors &amp; AI tools</h3>
                <p>Identifiable health records are never transferred to external consumer AI tools, public cloud spreadsheets, or unauthorized third parties. Technical infrastructure vendors operate under strict data protection covenants.</p>
            </section>

            <section style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>10. Institutional contact &amp; incident reporting</h3>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 6px' }}><strong>Institution:</strong> [INSTITUTION NAME — SAL Institute of Medical Sciences / SAL Education]</p>
                    <p style={{ margin: '0 0 6px' }}><strong>Privacy Officer / Faculty In-Charge:</strong> [PRIVACY CONTACT — Head of Department, Community Medicine]</p>
                    <p style={{ margin: '0 0 6px' }}><strong>Privacy Email:</strong> [PRIVACY EMAIL — privacy@salhospital.edu]</p>
                    <p style={{ margin: '0 0 6px' }}><strong>Security &amp; IT Incident Channel:</strong> [SECURITY EMAIL — security@salhospital.edu]</p>
                    <p style={{ margin: '0' }}><strong>Grievance Redressal:</strong> [GRIEVANCE CHANNEL — Institutional Ethics &amp; Grievance Committee]</p>
                </div>
            </section>
        </div>
    );
}
