import { useCallback, useEffect, useState } from 'react';
import type { ConfidentialityNoticeType } from './ConfidentialityNoticeModal';

const CONSENT_VERSION = '1.0.0';
const PURPOSE_VERSION = '1.0.0';
const POLICY_VERSION = '1.0.0';
const CONSENT_TYPE = 'STUDENT_DATA_USE_PRIVACY';
const SESSION_NOTICE_KEY = 'medpulse_comm_med_noticed';

export function useStudentPrivacy(rollNumber?: string | null) {
    const [activeModal, setActiveModal] = useState<ConfidentialityNoticeType | null>(null);
    const [saving, setSaving] = useState(false);

    const roll = rollNumber || '235';

    useEffect(() => {
        let mounted = true;

        async function verifyConsentAndNotice() {
            try {
                // 1. Check server-side one-time consent status
                const res = await fetch(`/api/consent/status?consent_type=${CONSENT_TYPE}&version=${CONSENT_VERSION}&user_id=${encodeURIComponent(roll)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (mounted && !data.consented) {
                        // User has not yet granted one-time consent on the server
                        setActiveModal('ONE_TIME_CONSENT');
                        return;
                    }
                } else {
                    // If status endpoint returns error, ensure student is presented with consent
                    if (mounted) {
                        setActiveModal('ONE_TIME_CONSENT');
                        return;
                    }
                }
            } catch (err) {
                console.warn('Consent status check offline or failed, presenting consent:', err);
                if (mounted) {
                    setActiveModal('ONE_TIME_CONSENT');
                    return;
                }
            }

            // 2. If one-time consent is already recorded, check session confidentiality notice
            if (mounted) {
                const sessionNoticed = sessionStorage.getItem(SESSION_NOTICE_KEY);
                if (!sessionNoticed) {
                    setActiveModal('COMMUNITY_MEDICINE_STUDENT');
                }
            }
        }

        verifyConsentAndNotice();

        return () => {
            mounted = false;
        };
    }, [roll]);

    const handleForm1Continue = useCallback(() => {
        sessionStorage.setItem(SESSION_NOTICE_KEY, 'true');
        setActiveModal(null);
    }, []);

    const handleForm2Consent = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: roll,
                    role: 'student',
                    consent_type: CONSENT_TYPE,
                    consent_version: CONSENT_VERSION,
                    purpose_version: PURPOSE_VERSION,
                    privacy_policy_version: POLICY_VERSION,
                    purpose_scope: 'COMMUNITY_MEDICINE_FAP',
                    action: 'GRANTED',
                    source: 'STUDENT_PORTAL',
                }),
            });
            if (!res.ok) throw new Error('Failed to record consent on server');
            sessionStorage.setItem(SESSION_NOTICE_KEY, 'true');
            setActiveModal(null);
        } catch (err) {
            console.error('Failed to submit consent:', err);
            // Fallback gracefully so the student can continue work
            sessionStorage.setItem(SESSION_NOTICE_KEY, 'true');
            setActiveModal(null);
        } finally {
            setSaving(false);
        }
    }, [roll]);

    const handleForm2Refuse = useCallback(() => {
        // As defined in the specification, redirect away from restricted workspace if refused
        window.location.href = '/profile.html';
    }, []);

    return {
        activeModal,
        saving,
        handleForm1Continue,
        handleForm2Consent,
        handleForm2Refuse,
        closeModal: () => setActiveModal(null),
    };
}
