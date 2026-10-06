import { useState } from 'react';
import './privacy.css';
import { StudentPrivacyPolicyContent } from './StudentPrivacyPolicyContent';

export type ConfidentialityNoticeType =
    | 'COMMUNITY_MEDICINE_STUDENT'
    | 'ONE_TIME_CONSENT'
    | 'SENSITIVE_HOUSEHOLD'
    | 'PRIVACY_POLICY';

export type HouseholdContext = 'MY_FAMILY' | 'GLOBAL_HOUSEHOLD';

export interface ConfidentialityNoticeModalProps {
    type: ConfidentialityNoticeType;
    context?: HouseholdContext;
    open: boolean;
    onContinue?: () => void;
    onConsent?: () => void;
    onRefuse?: () => void;
    onClose?: () => void;
    saving?: boolean;
}

export function ConfidentialityNoticeModal({
    type,
    context = 'MY_FAMILY',
    open,
    onContinue,
    onConsent,
    onRefuse,
    onClose,
    saving = false,
}: ConfidentialityNoticeModalProps) {
    const [policyOpen, setPolicyOpen] = useState(false);

    if (!open) return null;

    // Inner policy modal view
    if (policyOpen || type === 'PRIVACY_POLICY') {
        return (
            <div className="modal-overlay privacy-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="policyModalTitle">
                <div className="privacy-modal-dialog wide">
                    <div className="privacy-modal-header">
                        <div className="privacy-modal-header-top">
                            <div className="privacy-badge-row">
                                <span className="privacy-badge privacy">INSTITUTIONAL POLICY</span>
                                <span className="privacy-badge assigned">STUDENT &amp; FAP</span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    if (type === 'PRIVACY_POLICY' && onClose) onClose();
                                    else setPolicyOpen(false);
                                }}
                                style={{ padding: '4px 10px', fontSize: '0.82rem' }}
                                title="Close Policy"
                            >
                                ✕ Close
                            </button>
                        </div>
                        <h2 className="privacy-modal-title" id="policyModalTitle">
                            📄 Student Privacy Policy
                        </h2>
                        <p className="privacy-modal-subtitle">
                            Governance, permitted processing, and clinical record safeguards in the MedPulse training environment
                        </p>
                    </div>
                    <div className="privacy-modal-body">
                        <StudentPrivacyPolicyContent />
                    </div>
                    <div className="privacy-modal-footer">
                        <div className="privacy-footer-note">
                            🔒 Version v1.0.0 • Institutional Compliance Standard
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                                if (type === 'PRIVACY_POLICY' && onClose) onClose();
                                else setPolicyOpen(false);
                            }}
                        >
                            Return to Notice
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── FORM 1: Student Community Medicine Confidentiality Notice ── */
    if (type === 'COMMUNITY_MEDICINE_STUDENT') {
        return (
            <div className="modal-overlay privacy-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="form1Title">
                <div className="privacy-modal-dialog">
                    <div className="privacy-modal-header">
                        <div className="privacy-modal-header-top">
                            <div className="privacy-badge-row">
                                <span className="privacy-badge confidential">CONFIDENTIAL</span>
                                <span className="privacy-badge assigned">ASSIGNED ACCESS</span>
                                <span className="privacy-badge readonly">READ-ONLY MEDICAL RECORDS</span>
                                <span className="privacy-badge privacy">PRIVACY FIRST</span>
                            </div>
                        </div>
                        <h2 className="privacy-modal-title" id="form1Title">
                            🔒 Community Medicine — Confidential Data Handling Notice
                        </h2>
                        <p className="privacy-modal-subtitle">
                            Protected workspace • Student access • Confidential patient, family &amp; clinical data
                        </p>
                    </div>
                    <div className="privacy-modal-body">
                        <div className="privacy-alert-box danger">
                            <div className="privacy-alert-title">
                                <span>⚠ You're entering a confidential workspace</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                                Community Medicine work involves real people's personal, family, and health-related information. Every piece of information here must be treated with professional care, respect, and strict confidentiality.
                            </p>
                        </div>

                        <div className="privacy-section-heading">🎯 Why this matters</div>
                        <p>
                            Your work on MedPulse connects Community Medicine and Family Adoption Programme (FAP) activities with structured clinical follow-up. Accurate and responsible data handling helps:
                        </p>
                        <ul className="privacy-rule-list">
                            <li>Reduce repeated questions and unnecessary re-interviews for vulnerable households.</li>
                            <li>Maintain organized, longitudinal surveillance of community health indicators.</li>
                            <li>Support continuity of care across authorized clinical and academic postings.</li>
                            <li>Prevent avoidable documentation mistakes and safeguard patient trust.</li>
                        </ul>

                        <div className="privacy-section-heading">⛔ Your access is limited &amp; assignment-bound</div>
                        <p>You may only access information that you are actively authorized to view under your current clinical posting:</p>
                        <ul className="privacy-rule-list">
                            <li><strong>No browsing unrelated families:</strong> You are strictly forbidden from viewing households outside your assigned cohort.</li>
                            <li><strong>Curiosity is not authorization:</strong> Never search or inspect records out of personal curiosity.</li>
                            <li><strong>No unauthorized sharing:</strong> Never share records with friends, classmates, social media, or public messaging groups.</li>
                            <li><strong>Read-only medical records:</strong> Hospital clinical records are strictly read-only. You cannot edit, delete, or modify hospital charts.</li>
                            <li><strong>No data extraction:</strong> You are not permitted to copy or export confidential patient data into personal spreadsheets or unvetted tools.</li>
                        </ul>

                        <div className="privacy-section-heading">📝 Responsible data entry principles</div>
                        <p>When recording or updating FAP household data:</p>
                        <ul className="privacy-rule-list">
                            <li>Enter only what is required for the authorized clinical and educational curriculum.</li>
                            <li>Enter information as accurately as possible; double-check all metrics before submitting.</li>
                            <li>Never guess, exaggerate, or populate fields merely because they exist.</li>
                            <li>Never log into MedPulse using another student's account or share your 4-digit PIN.</li>
                        </ul>

                        <div className="privacy-alert-box info" style={{ marginTop: '18px' }}>
                            <div className="privacy-alert-title">
                                <span>💡 A reminder with a human purpose</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                                <strong>The person behind the record is more important than the record itself.</strong> Treat every patient's and household's information as if it were your own family's. If you are ever unsure whether you should view or enter something, stop and consult your Faculty In-Charge.
                            </p>
                        </div>
                    </div>
                    <div className="privacy-modal-footer">
                        <div className="privacy-footer-note">
                            🛡 Privacy first • Purpose first • Minimum necessary data
                        </div>
                        <div className="privacy-btn-group">
                            <button
                                type="button"
                                className="privacy-link-btn"
                                onClick={() => setPolicyOpen(true)}
                            >
                                View Student Privacy Policy
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onContinue}
                                style={{ padding: '8px 20px', fontWeight: 700 }}
                            >
                                I Understand &amp; Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── FORM 2: One-Time Student Data Use & Privacy Consent ── */
    if (type === 'ONE_TIME_CONSENT') {
        return (
            <div className="modal-overlay privacy-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="form2Title">
                <div className="privacy-modal-dialog wide">
                    <div className="privacy-modal-header">
                        <div className="privacy-modal-header-top">
                            <div className="privacy-badge-row">
                                <span className="privacy-badge privacy">ONE-TIME CONSENT</span>
                                <span className="privacy-badge assigned">PURPOSE-BOUND</span>
                                <span className="privacy-badge readonly">SAFEGUARDS IN PLACE</span>
                                <span className="privacy-badge confidential">RIGHTS &amp; CHOICES</span>
                            </div>
                        </div>
                        <h2 className="privacy-modal-title" id="form2Title">
                            🌿 MedPulse Student Data Use &amp; Privacy Consent
                        </h2>
                        <p className="privacy-modal-subtitle">
                            A clear explanation of how information supports your Community Medicine / FAP training
                        </p>
                    </div>
                    <div className="privacy-modal-body">
                        <div className="privacy-alert-box info">
                            <div className="privacy-alert-title">
                                <span>🌿 Your work matters. Your responsibility matters too.</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                                MedPulse is structured to make Community Medicine and Family Adoption Programme (FAP) work accurate and organized while treating personal and health-related information with utmost care. Please review this consent copy before your first interaction with sensitive records.
                            </p>
                        </div>

                        <div className="privacy-section-heading">1. What information may be involved?</div>
                        <p>During your authorized academic workflows, MedPulse processes:</p>
                        <ul className="privacy-rule-list">
                            <li><strong>Identity &amp; Contact:</strong> Student and patient names, age, gender, contact details, and institutional credentials.</li>
                            <li><strong>Household &amp; Family Structure:</strong> Family compositions, socio-economic classifications, dwelling sanitation, and genealogical relationships.</li>
                            <li><strong>FAP Academic Surveillance:</strong> Student-recorded nutritional evaluations, disease screening indicators, and follow-up notes.</li>
                            <li><strong>Authorized Clinical Parameters:</strong> Read-only access to vital indicators (BP, sugar, Hb) necessary for epidemiological study.</li>
                        </ul>

                        <div className="privacy-section-heading">2. Why is this information used?</div>
                        <ul className="privacy-rule-list">
                            <li><strong>Community Medicine &amp; FAP Fieldwork:</strong> To fulfill curriculum requirements under authorized faculty supervision.</li>
                            <li><strong>Family Health Coordination:</strong> To ensure assigned households receive structured surveillance and care continuity.</li>
                            <li><strong>Academic Evaluation:</strong> To verify competency milestones and clinical encounter logs.</li>
                            <li><strong>Platform Security &amp; Auditability:</strong> To detect anomalies, log access trails, and prevent data leakage.</li>
                        </ul>

                        <div className="privacy-section-heading">3. Your access is strictly delimited</div>
                        <p>As a medical student on MedPulse:</p>
                        <ul className="privacy-rule-list">
                            <li>You may only access families actively assigned to you.</li>
                            <li>Your medical-record access is strictly <strong>read-only</strong>. You cannot create, modify, or delete official hospital medical records.</li>
                            <li>You cannot export clinical or personal data to unapproved destinations.</li>
                            <li>When your family assignment ends or is revoked, access to that family and their medical data is terminated immediately.</li>
                        </ul>

                        <div className="privacy-section-heading">4. Data minimisation &amp; responsible documentation</div>
                        <p>
                            Good privacy is about not collecting unnecessary data in the first place. Record only what is required, accurate, and purposeful. Avoid collecting extraneous details or filling fields with guesses.
                        </p>

                        <div className="privacy-section-heading">5. Security safeguards &amp; privacy controls</div>
                        <p>
                            MedPulse applies multi-layered controls: server-side role and tenant authorization, cryptographic PIN authentication, OTP verification for sensitive operations, session timeouts, rate limiting, and immutable audit logging.
                        </p>

                        <div className="privacy-section-heading">6. Student conduct commitments</div>
                        <ul className="privacy-rule-list">
                            <li>Keep credentials and 4-digit PIN confidential. Never share accounts.</li>
                            <li>Never photograph or take screenshots of patient records.</li>
                            <li>Never upload patient data to public artificial intelligence (AI) tools or consumer cloud drives.</li>
                            <li>Never discuss identifiable patients in public forums or social media.</li>
                            <li>Promptly report any suspected unauthorized access or accidental disclosure.</li>
                        </ul>

                        <div className="privacy-section-heading">7. Retention, minors &amp; third parties</div>
                        <p>
                            Health data is retained according to institutional and statutory requirements. Upon retention expiry, records follow irreversible anonymisation. Children/minors receive specialized protections. Technical vendors process data under strict data processing agreements.
                        </p>

                        <div className="privacy-section-heading">8. Rights, choices &amp; consent recording</div>
                        <p>
                            You have rights to review your personal academic profile and request corrections. Where consent is the legal basis, consent is recorded in a tamper-resistant server-side event ledger with versioning. Consent withdrawal is supported through institutional channels without invalidating statutory audit obligations.
                        </p>

                        <div className="privacy-alert-box" style={{ marginTop: '20px', borderLeftColor: '#059669', background: '#f0fdf4' }}>
                            <div className="privacy-alert-title" style={{ color: '#065f46' }}>
                                <span>📋 Student Acknowledgement &amp; Consent Declaration</span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#166534', lineHeight: 1.6 }}>
                                By clicking <strong>"I Agree &amp; Continue"</strong>, I confirm that I have read and understood this notice and the linked MedPulse Student Privacy Policy. I agree to uphold all confidentiality rules, understand the limits of my assignment, and provide my consent where consent is the applicable legal basis for the educational and clinical processing described above.
                            </p>
                        </div>
                    </div>
                    <div className="privacy-modal-footer">
                        <div className="privacy-footer-note">
                            🔒 Server-recorded consent • Version v1.0.0 • FAP Scope
                        </div>
                        <div className="privacy-btn-group">
                            <button
                                type="button"
                                className="privacy-link-btn"
                                onClick={() => setPolicyOpen(true)}
                            >
                                Review Privacy Policy
                            </button>
                            {onRefuse && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={onRefuse}
                                    title="Do not provide consent"
                                >
                                    I Do Not Agree
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onConsent}
                                disabled={saving}
                                style={{ padding: '8px 22px', fontWeight: 700 }}
                            >
                                {saving ? '⏳ Recording...' : 'I Agree & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── FORM 3: Sensitive Household Data Access Notice ── */
    if (type === 'SENSITIVE_HOUSEHOLD') {
        const isPatient = context === 'MY_FAMILY';
        return (
            <div className="modal-overlay privacy-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="form3Title">
                <div className="privacy-modal-dialog">
                    <div className="privacy-modal-header">
                        <div className="privacy-modal-header-top">
                            <div className="privacy-badge-row">
                                <span className="privacy-badge confidential">CONFIDENTIAL</span>
                                <span className="privacy-badge assigned">RESTRICTED ACCESS</span>
                                <span className="privacy-badge privacy">PRIVACY FIRST</span>
                            </div>
                        </div>
                        <h2 className="privacy-modal-title" id="form3Title">
                            🔐 Confidential Household Information
                        </h2>
                        <p className="privacy-modal-subtitle">
                            Please review before entering this {isPatient ? 'family' : 'administrative surveillance'} workspace
                        </p>
                    </div>
                    <div className="privacy-modal-body">
                        <div className="privacy-alert-box danger">
                            <div className="privacy-alert-title">
                                <span>⚠ This is a confidential family workspace</span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                                The records you are about to inspect contain personal, household, and clinical information belonging to real people. Access must be conducted with professional discretion and respect.
                            </p>
                        </div>

                        {isPatient ? (
                            /* Patient / My Family Specific Copy */
                            <div>
                                <div className="privacy-section-heading">👨‍👩‍👧‍👦 For Patients and Family Members</div>
                                <p>
                                    You are viewing private household records. Depending on your authorized relationship and Family Head status, this view includes personal demographics and family health metrics:
                                </p>
                                <ul className="privacy-rule-list">
                                    <li><strong>Information is private:</strong> Being authorized to view information does not grant permission to copy, publish, redistribute, or disclose it to outside parties.</li>
                                    <li><strong>Respect family privacy:</strong> Do not share other members' health records without their knowledge and consent.</li>
                                    <li><strong>Family Head visibility:</strong> Under MedPulse operational rules, the designated Family Head may review aggregated household health indicators. This authorization is periodically audited.</li>
                                    <li><strong>No unauthorized external tools:</strong> Do not copy sensitive family vitals into public messaging apps or social forums.</li>
                                </ul>
                            </div>
                        ) : (
                            /* Admin / Global Household Specific Copy */
                            <div>
                                <div className="privacy-section-heading">🏛 For MedPulse Administrative Personnel</div>
                                <p>
                                    You are entering the platform-level Global Household Registry. Administrative privileges carry strict legal and institutional accountability:
                                </p>
                                <ul className="privacy-rule-list">
                                    <li><strong>Privilege is responsibility:</strong> Administrative visibility is provided solely for institutional surveillance, audit, and cohort allocation. Never browse households out of curiosity.</li>
                                    <li><strong>Hospital clinical boundary:</strong> Admin access does NOT grant unrestricted access to hospital clinical charts or confidential physician encounter notes.</li>
                                    <li><strong>Minimum necessary access:</strong> Inspect only the specific household required for the active administrative task.</li>
                                    <li><strong>Zero tolerance for data leakage:</strong> Do not download or export unmasked household registries onto personal devices.</li>
                                </ul>
                            </div>
                        )}

                        <div className="privacy-section-heading">🛡 Confidential means confidential</div>
                        <ul className="privacy-rule-list">
                            <li>Do not photograph, screenshot, or distribute sensitive screens.</li>
                            <li>Do not share session credentials or bypass workstation screen locks.</li>
                            <li>If you suspect accidental disclosure or misallocated access, report it immediately to the security officer.</li>
                        </ul>

                        <div className="privacy-alert-box info" style={{ marginTop: '16px', fontSize: '0.84rem' }}>
                            <div className="privacy-alert-title" style={{ fontSize: '0.9rem' }}>
                                <span>🔒 Important Security Assurance</span>
                            </div>
                            <p style={{ margin: '4px 0 0' }}>
                                Acknowledging this notice confirms your compliance with confidentiality standards. <strong>This notice does NOT grant or expand user permissions</strong>; all resource access is independently authenticated and authorized server-side.
                            </p>
                        </div>
                    </div>
                    <div className="privacy-modal-footer">
                        <div className="privacy-footer-note">
                            Confidential information • Authorized access only
                        </div>
                        <div className="privacy-btn-group">
                            <button
                                type="button"
                                className="privacy-link-btn"
                                onClick={() => setPolicyOpen(true)}
                            >
                                View Privacy Policy
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onContinue}
                                style={{ padding: '8px 20px', fontWeight: 700 }}
                            >
                                I Understand &amp; Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
