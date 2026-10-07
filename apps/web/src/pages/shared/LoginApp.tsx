/**
 * login.html: student / faculty admin / patient / hospital sign-in (plus patient registration).
 * Port of the inline scripts of frontend/shared/login.html.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { BodyPortal, removePreloadTransitions, runWhenActive } from './page-utils';
import { StudentRegisterForm, type AuthAlerts } from './StudentRegisterForm';

/** Demo sign-in buttons only appear in `npm run dev`, never on the deployed site. */
const SHOW_DEMO = import.meta.env.DEV;

type AuthMode = 'login' | 'admin' | 'patient' | 'hospital';
type PatientSubMode = 'login' | 'register';

/** Pending OTP verification state — holds auth data between credential check and OTP step */
interface OtpPendingState {
    role: AuthMode;
    displayName: string;
    responseData: unknown;
    redirectUrl: string;
    storageKey: string;
    clearKeys: string[];
}

interface ApiError {
    error?: string;
}
interface StudentLoginResponse extends ApiError {
    student?: { roll_number?: string; name?: string; [k: string]: unknown };
}
interface AdminLoginResponse extends ApiError {
    admin?: { name?: string; [k: string]: unknown };
}
interface PatientLoginResponse extends ApiError {
    patient?: { name?: string; [k: string]: unknown };
}
interface ReferralStudent {
    name?: string;
    roll_number?: string;
    college_name?: string;
}
interface ReferralResponse extends ApiError {
    valid?: boolean;
    student?: ReferralStudent;
}

const ARROW = '→';

/** The mode the URL asks for (hash or query), same precedence as the original. */
function modeFromUrl(): AuthMode {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash === '#admin' || params.get('admin') === '1' || hash === '#register' || params.get('mode') === 'register') return 'admin';
    if (hash === '#patient' || params.get('patient') === '1') return 'patient';
    if (hash === '#hospital' || params.get('hospital') === '1') return 'hospital';
    return 'login';
}

const MODE_VIEW: Record<AuthMode, { icon: string; background: string; boxShadow: string; title: string; subtitle: string; focus: string }> = {
    login: {
        icon: '👨‍⚕',
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #4f46e5)',
        boxShadow: '0 8px 24px rgba(109, 40, 217, 0.4)',
        title: 'Student Portal Sign In',
        subtitle: 'Access your assigned field families, survey metrics, and longitudinal care.',
        focus: 'rollInput',
    },
    admin: {
        icon: '👑',
        background: 'linear-gradient(135deg, #d97706, #b45309, #92400e)',
        boxShadow: '0 8px 24px rgba(217, 119, 6, 0.45)',
        title: 'Faculty & Administrative Portal',
        subtitle: 'Administrative surveillance, student cadre rosters, and institutional data oversight.',
        focus: 'adminUserInput',
    },
    patient: {
        icon: '🏥',
        background: 'linear-gradient(135deg, #0284c7, #0369a1, #075985)',
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
        title: 'Patient Health Portal',
        subtitle: 'Access your personal health records, clinical vitals, prescriptions, and cadet consultations.',
        focus: 'patientLoginId',
    },
    hospital: {
        icon: '🏨',
        background: 'linear-gradient(135deg, #0d9488, #0f766e, #115e59)',
        boxShadow: '0 8px 24px rgba(13, 148, 136, 0.45)',
        title: 'Hospital Command Center',
        subtitle: 'Cross-institutional patient records, university cadet surveillance, and clinical supervision.',
        focus: 'hospUsernameInput',
    },
};

/** Where each role goes after signing in (the `redirect` query param, if it belongs to that portal). */
function studentTarget(): string {
    const target = new URLSearchParams(window.location.search).get('redirect');
    if (!target || target === '/' || target === '/index.html' || target.indexOf('login') !== -1 ||
        target.startsWith('/patient') || target.startsWith('/hospital') || target.startsWith('/admin')) {
        return '/profile.html';
    }
    return target;
}
function portalTarget(prefix: '/admin' | '/patient' | '/hospital', fallback: string): string {
    const target = new URLSearchParams(window.location.search).get('redirect');
    if (!target || target === '/' || target === '/index.html' || target.indexOf('login') !== -1 ||
        (!target.startsWith(prefix) && target !== prefix + '.html')) {
        return fallback;
    }
    return target;
}

const Req = () => <span style={{ color: '#ef4444' }}>*</span>;

const SUB_ACTIVE: CSSProperties = { background: '#fff', color: '#0284c7', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const SUB_INACTIVE: CSSProperties = { background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, boxShadow: 'none' };
const SUB_BASE: CSSProperties = { flex: 1, justifyContent: 'center', padding: 6, fontSize: '0.84rem', border: 'none' };

const linkStyle: CSSProperties = { color: 'var(--accent)', fontWeight: 650, textDecoration: 'underline' };

interface FeedbackState {
    shown: boolean;
    ok: boolean | null;
    student?: ReferralStudent;
    error?: string;
}

export function LoginApp() {
    const [mode, setMode] = useState<AuthMode>(modeFromUrl);
    const [patientSub, setPatientSub] = useState<PatientSubMode>('login');
    const [alert, setAlert] = useState<{ text: string; shown: boolean }>({ text: '', shown: false });
    const [success, setSuccess] = useState<{ text: string; shown: boolean }>({ text: '', shown: false });
    const [focusReq, setFocusReq] = useState<{ id: string; seq: number } | null>(null);
    const [paneSeq, setPaneSeq] = useState(0);
    const paneRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const lastPane = useRef<{ mode: AuthMode; seq: number } | null>(null);

    // OTP verification state
    const [otpPending, setOtpPending] = useState<OtpPendingState | null>(null);
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [otpBusy, setOtpBusy] = useState(false);
    const [otpResendTimer, setOtpResendTimer] = useState(30);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const otpTimerRef = useRef<number | undefined>(undefined);

    // Student
    const [roll, setRoll] = useState('235');
    const [pin, setPin] = useState('1234');
    const [loginBusy, setLoginBusy] = useState(false);
    // Admin
    const [adminUser, setAdminUser] = useState('admin');
    const [adminPin, setAdminPin] = useState('9999');
    const [adminBusy, setAdminBusy] = useState(false);
    // Patient sign-in
    const [patientId, setPatientId] = useState('9876543210');
    const [patientPin, setPatientPin] = useState('1234');
    const [patientBusy, setPatientBusy] = useState(false);
    // Patient registration
    const [pName, setPName] = useState('');
    const [pPhone, setPPhone] = useState('');
    const [pPin, setPPin] = useState('');
    const [pAge, setPAge] = useState('');
    const [pGender, setPGender] = useState('M');
    const [pAdopted, setPAdopted] = useState(false);
    const [pRefCode, setPRefCode] = useState('');
    const [pRegBusy, setPRegBusy] = useState(false);
    const [refIcon, setRefIcon] = useState<{ shown: boolean; text: string }>({ shown: false, text: '' });
    const [refFeedback, setRefFeedback] = useState<FeedbackState>({ shown: false, ok: null });
    const referralTimer = useRef<number | undefined>(undefined);
    // Hospital
    const [hospUser, setHospUser] = useState('hosp_superadmin');
    const [hospPin, setHospPin] = useState('8888');
    const [hospBusy, setHospBusy] = useState(false);

    const hideAlerts = useCallback(() => {
        setAlert((a) => ({ ...a, shown: false }));
        setSuccess((s) => ({ ...s, shown: false }));
    }, []);
    const showError = useCallback((text: string) => setAlert({ text, shown: true }), []);
    const showSuccess = useCallback((text: string) => setSuccess({ text, shown: true }), []);
    const alerts: AuthAlerts = { hide: hideAlerts, error: showError, success: showSuccess };

    const focus = (id: string) => setFocusReq((f) => ({ id, seq: (f?.seq || 0) + 1 }));

    const setAuthMode = useCallback((next: AuthMode | 'register') => {
        const m: AuthMode = next === 'register' ? 'admin' : next;
        hideAlerts();
        setMode(m);
        setPaneSeq((s) => s + 1);
        history.replaceState(null, '', '#' + m);
        focus(MODE_VIEW[m].focus);
    }, [hideAlerts]);

    const switchPatientSubMode = (sub: PatientSubMode) => {
        setPatientSub(sub);
        hideAlerts();
        focus(sub === 'register' ? 'patientRegName' : 'patientLoginId');
    };

    // Focus after the target pane / form is displayed (the original focused synchronously).
    useLayoutEffect(() => {
        if (focusReq) document.getElementById(focusReq.id)?.focus();
    }, [focusReq]);

    // Re-selecting a pane replays its slide animation (remove classes, reflow, add back).
    useLayoutEffect(() => {
        const prev = lastPane.current;
        lastPane.current = { mode, seq: paneSeq };
        if (!prev || prev.mode !== mode || prev.seq === paneSeq) return;
        const el = paneRefs.current[mode];
        if (!el) return;
        const slide = mode === 'login' ? 'slide-left' : 'slide-right';
        el.classList.remove('active', slide);
        void el.offsetWidth;
        el.classList.add('active', slide);
    }, [mode, paneSeq]);

    // DOMContentLoaded: pick the mode from the URL, session-expired notice, prefill roll number.
    useEffect(() => {
        removePreloadTransitions();
        return runWhenActive(() => {
            const initial = modeFromUrl();
            setAuthMode(initial);
            const params = new URLSearchParams(window.location.search);
            if (params.get('session_expired')) {
                setAlert({ text: 'Your session has expired or requires authentication. Please sign in.', shown: true });
            }
            const user = localStorage.getItem('medpulse_user');
            if (user && initial === 'login') {
                try {
                    const parsed = JSON.parse(user) as { roll_number?: string } | null;
                    if (parsed && parsed.roll_number) setRoll(String(parsed.roll_number));
                } catch {
                    /* ignore */
                }
            }
        });
    }, [setAuthMode]);

    useEffect(() => () => window.clearTimeout(referralTimer.current), []);

    // OTP resend countdown timer
    useEffect(() => {
        if (!otpPending) return;
        setOtpResendTimer(30);
        otpTimerRef.current = window.setInterval(() => {
            setOtpResendTimer((t) => {
                if (t <= 1) { window.clearInterval(otpTimerRef.current); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => window.clearInterval(otpTimerRef.current);
    }, [otpPending]);

    /** Transition to OTP screen after successful credential check */
    const enterOtpFlow = (pending: OtpPendingState) => {
        hideAlerts();
        setOtpDigits(['', '', '', '', '', '']);
        setOtpPending(pending);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => otpInputRefs.current[0]?.focus({ preventScroll: true }), 150);
    };

    /** Complete login: store session data and redirect */
    const completeLogin = (pending: OtpPendingState) => {
        pending.clearKeys.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(pending.storageKey, JSON.stringify(pending.responseData));
        window.location.href = pending.redirectUrl;
    };

    /** Handle "Proceed Without OTP" click */
    const handleSkipOtp = () => {
        if (!otpPending) return;
        setOtpBusy(true);
        showSuccess(`✅ OTP verification skipped. Redirecting...`);
        setTimeout(() => completeLogin(otpPending), 600);
    };

    /** Handle OTP verification (placeholder — always succeeds for now) */
    const handleVerifyOtp = () => {
        if (!otpPending) return;
        const code = otpDigits.join('');
        if (code.length < 6) {
            showError('Please enter the complete 6-digit OTP.');
            return;
        }
        setOtpBusy(true);
        showSuccess(`✅ OTP verified successfully. Redirecting...`);
        setTimeout(() => completeLogin(otpPending), 600);
    };

    /** Handle resend OTP */
    const handleResendOtp = () => {
        if (otpResendTimer > 0) return;
        showSuccess('📨 A new OTP has been sent (simulated).');
        setOtpResendTimer(30);
        window.clearInterval(otpTimerRef.current);
        otpTimerRef.current = window.setInterval(() => {
            setOtpResendTimer((t) => {
                if (t <= 1) { window.clearInterval(otpTimerRef.current); return 0; }
                return t - 1;
            });
        }, 1000);
    };

    /** Go back from OTP screen to login form */
    const handleOtpBack = () => {
        hideAlerts();
        setOtpPending(null);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpBusy(false);
        window.clearInterval(otpTimerRef.current);
    };

    /** OTP digit input handlers */
    const handleOtpDigitChange = (index: number, value: string) => {
        const digitsOnly = value.replace(/\D/g, '');
        if (!digitsOnly) {
            const next = [...otpDigits];
            next[index] = '';
            setOtpDigits(next);
            return;
        }
        // If mobile SMS autofill or paste entered multiple digits
        if (digitsOnly.length > 1) {
            const next = [...otpDigits];
            for (let i = 0; i < 6; i++) {
                if (index + i < 6 && i < digitsOnly.length) {
                    next[index + i] = digitsOnly[i];
                }
            }
            setOtpDigits(next);
            const nextFocus = Math.min(index + digitsOnly.length, 5);
            otpInputRefs.current[nextFocus]?.focus({ preventScroll: true });
            return;
        }
        // Single digit entered
        const next = [...otpDigits];
        next[index] = digitsOnly;
        setOtpDigits(next);
        if (index < 5) {
            otpInputRefs.current[index + 1]?.focus({ preventScroll: true });
        }
    };

    const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (!otpDigits[index] && index > 0) {
                const next = [...otpDigits];
                next[index - 1] = '';
                setOtpDigits(next);
                otpInputRefs.current[index - 1]?.focus({ preventScroll: true });
            }
        }
        if (e.key === 'Enter' && otpDigits.join('').length === 6) {
            handleVerifyOtp();
        }
    };

    const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const next = [...otpDigits];
        for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
        setOtpDigits(next);
        const focusIdx = Math.min(pasted.length, 5);
        otpInputRefs.current[focusIdx]?.focus({ preventScroll: true });
    };

    /* ---- Student ---- */
    const handleLogin = async (rollValue: string, pinValue: string) => {
        hideAlerts();
        const rollNumber = rollValue.trim();
        const pinV = pinValue.trim();
        if (!rollNumber) {
            showError('Please enter your roll number');
            return;
        }
        setLoginBusy(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_number: rollNumber, pin: pinV }),
            });
            const data = (await res.json()) as StudentLoginResponse;
            if (!res.ok) throw new Error(data.error || 'Login failed');

            enterOtpFlow({
                role: 'login',
                displayName: data.student?.name || rollNumber,
                responseData: data.student,
                redirectUrl: studentTarget(),
                storageKey: 'medpulse_user',
                clearKeys: ['medpulse_patient', 'medpulse_hospital_admin'],
            });
        } catch (err) {
            showError((err as Error).message);
        } finally {
            setLoginBusy(false);
        }
    };

    const quickDemoLogin = () => {
        setAuthMode('login');
        setRoll('235');
        setPin('1234');
        void handleLogin('235', '1234');
    };

    /* ---- Faculty / Admin ---- */
    const handleAdminLogin = async (userValue: string, pinValue: string) => {
        hideAlerts();
        const username = userValue.trim();
        const pinV = pinValue.trim();
        if (!username) {
            showError('Please enter your administrator username');
            return;
        }
        setAdminBusy(true);
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pin: pinV }),
            });
            const data = (await res.json()) as AdminLoginResponse;
            if (!res.ok) throw new Error(data.error || 'Authentication failed');

            enterOtpFlow({
                role: 'admin',
                displayName: data.admin?.name || username,
                responseData: data.admin,
                redirectUrl: portalTarget('/admin', '/admin/admin.html'),
                storageKey: 'medpulse_admin',
                clearKeys: ['medpulse_patient', 'medpulse_hospital_admin'],
            });
        } catch (err) {
            showError((err as Error).message);
        } finally {
            setAdminBusy(false);
        }
    };

    const quickDemoAdminLogin = () => {
        setAuthMode('admin');
        setAdminUser('admin');
        setAdminPin('9999');
        void handleAdminLogin('admin', '9999');
    };

    /* ---- Patient ---- */
    const handlePatientLogin = async (idValue: string, pinValue: string) => {
        hideAlerts();
        const identifier = idValue.trim();
        const pinV = pinValue.trim();
        if (!identifier) {
            showError('Please enter your phone number or Patient UID.');
            return;
        }
        setPatientBusy(true);
        try {
            const res = await fetch('/api/patient/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, pin: pinV }),
            });
            const data = (await res.json()) as PatientLoginResponse;
            if (!res.ok) throw new Error(data.error || 'Patient login failed');

            enterOtpFlow({
                role: 'patient',
                displayName: data.patient?.name || identifier,
                responseData: data.patient,
                redirectUrl: portalTarget('/patient', '/patient/patient.html'),
                storageKey: 'medpulse_patient',
                clearKeys: ['medpulse_user', 'medpulse_admin', 'medpulse_hospital_admin'],
            });
        } catch (err) {
            showError((err as Error).message);
        } finally {
            setPatientBusy(false);
        }
    };

    const quickDemoPatientLogin = () => {
        setAuthMode('patient');
        switchPatientSubMode('login');
        setPatientId('9876543210');
        setPatientPin('1234');
        void handlePatientLogin('9876543210', '1234');
    };

    const togglePatientReferralInput = (checked: boolean) => {
        setPAdopted(checked);
        if (checked) {
            focus('patientReferralCode');
        } else {
            setPRefCode('');
            setRefFeedback((f) => ({ ...f, shown: false }));
            setRefIcon((i) => ({ ...i, shown: false }));
        }
    };

    const verifyPatientReferralCode = async (raw: string) => {
        const code = raw.trim().toUpperCase();
        if (code.length < 4) {
            setRefIcon((i) => ({ ...i, shown: false }));
            setRefFeedback((f) => ({ ...f, shown: false }));
            return;
        }
        setRefIcon({ shown: true, text: '⏳' });
        try {
            const res = await fetch('/api/patient/verify-referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referral_code: code }),
            });
            const data = (await res.json()) as ReferralResponse;
            if (res.ok && data.valid && data.student) {
                setRefIcon({ shown: true, text: '✅' });
                setRefFeedback({ shown: true, ok: true, student: data.student });
            } else {
                setRefIcon({ shown: true, text: '❌' });
                setRefFeedback({ shown: true, ok: false, error: data.error || 'Invalid cadet referral code. Please verify with your medical student.' });
            }
        } catch {
            setRefIcon({ shown: true, text: '⚠' });
        }
    };

    const debounceVerifyReferral = (value: string) => {
        window.clearTimeout(referralTimer.current);
        referralTimer.current = window.setTimeout(() => void verifyPatientReferralCode(value), 350);
    };

    const handlePatientRegister = async (e: FormEvent) => {
        e.preventDefault();
        hideAlerts();
        const name = pName.trim();
        const phone = pPhone.trim().replace(/[^0-9]/g, '');
        const pinV = pPin.trim();
        const age = pAge.trim();
        const refCode = pRefCode.trim();

        if (!name) {
            showError('Please enter patient full name.');
            return;
        }
        if (phone.length < 10) {
            showError('Please enter a valid 10-digit mobile phone number.');
            return;
        }
        if (pAdopted && !refCode) {
            showError('Please enter the cadet referral code or uncheck the adoption box.');
            return;
        }

        setPRegBusy(true);
        try {
            const res = await fetch('/api/patient/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone,
                    pin: pinV,
                    age_years: age ? parseInt(age, 10) : null,
                    gender: pGender,
                    is_adopted: pAdopted,
                    referral_code: refCode,
                }),
            });
            const data = (await res.json()) as PatientLoginResponse;
            if (!res.ok) throw new Error(data.error || 'Patient registration failed');

            showSuccess(`🎉 Registration successful! Welcome, ${data.patient!.name}. Launching health dashboard...`);
            localStorage.removeItem('medpulse_user');
            localStorage.removeItem('medpulse_admin');
            localStorage.removeItem('medpulse_hospital_admin');
            localStorage.setItem('medpulse_patient', JSON.stringify(data.patient));
            setTimeout(() => {
                window.location.href = portalTarget('/patient', '/patient/patient.html');
            }, 1100);
        } catch (err) {
            showError((err as Error).message);
        } finally {
            setPRegBusy(false);
        }
    };

    /* ---- Hospital ---- */
    const handleHospitalLogin = async (userValue: string, pinValue: string) => {
        hideAlerts();
        const username = userValue.trim();
        const pinV = pinValue.trim();
        if (!username || !pinV) {
            showError('Please enter your hospital staff username and security PIN.');
            return;
        }
        setHospBusy(true);
        try {
            const res = await fetch('/api/hospital/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pin: pinV }),
            });
            const data = (await res.json()) as AdminLoginResponse;
            if (!res.ok) throw new Error(data.error || 'Hospital sign in failed');

            enterOtpFlow({
                role: 'hospital',
                displayName: data.admin?.name || username,
                responseData: data.admin,
                redirectUrl: portalTarget('/hospital', '/hospital/hospital.html'),
                storageKey: 'medpulse_hospital_admin',
                clearKeys: ['medpulse_user', 'medpulse_admin', 'medpulse_patient'],
            });
        } catch (err) {
            showError((err as Error).message);
        } finally {
            setHospBusy(false);
        }
    };

    const quickDemoHospitalLogin = () => {
        setAuthMode('hospital');
        setHospUser('hosp_superadmin');
        setHospPin('8888');
        void handleHospitalLogin('hosp_superadmin', '8888');
    };

    const backToStudent = (e: MouseEvent) => {
        e.preventDefault();
        setAuthMode('login');
    };

    const paneClass = (m: AuthMode) => (mode === m ? `auth-pane active ${m === 'login' ? 'slide-left' : 'slide-right'}` : 'auth-pane');
    const paneRef = (m: string) => (el: HTMLDivElement | null) => {
        paneRefs.current[m] = el;
    };
    const view = MODE_VIEW[otpPending ? otpPending.role : mode];
    const wrapperRegister = mode === 'patient' && patientSub === 'register' && !otpPending;

    return (
        <BodyPortal>
            <main className="login-page-container">
                <div className={wrapperRegister ? 'login-wrapper mode-register' : 'login-wrapper'} id="loginWrapper">

                    {/* MedPulse Brand Header */}
                    <a href="/" className="login-brand-header" title="SAL Education by MedPulse">
                        <div className="login-brand-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </div>
                        <div className="login-brand-text">
                            <span className="brand-title">SAL Education</span>
                            <span className="brand-subtitle">by MedPulse</span>
                        </div>
                    </a>

                    <div className="login-card">
                        {otpPending ? (
                            <OtpVerificationPane
                                pending={otpPending}
                                digits={otpDigits}
                                busy={otpBusy}
                                resendTimer={otpResendTimer}
                                inputRefs={otpInputRefs}
                                alert={alert}
                                success={success}
                                onDigitChange={handleOtpDigitChange}
                                onKeyDown={handleOtpKeyDown}
                                onPaste={handleOtpPaste}
                                onVerify={handleVerifyOtp}
                                onSkip={handleSkipOtp}
                                onResend={handleResendOtp}
                                onBack={handleOtpBack}
                            />
                        ) : (
                            <>
                                {/* Auth Mode Switcher */}
                                <div className={`auth-mode-nav four-items state-${mode}`} id="authModeNav">
                            <div className="auth-mode-glider" id="authModeGlider" style={{ opacity: 1 }} />
                            <button type="button" className={mode === 'login' ? 'auth-mode-btn active' : 'auth-mode-btn'} id="tabSignIn" onClick={() => setAuthMode('login')}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                </svg>
                                <span>Student</span>
                            </button>
                            <button type="button" className={mode === 'admin' ? 'auth-mode-btn active' : 'auth-mode-btn'} id="tabAdmin" onClick={() => setAuthMode('admin')}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>Admin</span>
                            </button>
                            <button type="button" className={mode === 'patient' ? 'auth-mode-btn active' : 'auth-mode-btn'} id="tabPatient" onClick={() => setAuthMode('patient')}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                                </svg>
                                <span>Patient</span>
                            </button>
                            <button type="button" className={mode === 'hospital' ? 'auth-mode-btn active' : 'auth-mode-btn'} id="tabHospital" onClick={() => setAuthMode('hospital')}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M12 8v8" />
                                    <path d="M8 12h8" />
                                </svg>
                                <span>Hospital</span>
                            </button>
                        </div>

                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div
                                id="authHeaderIcon"
                                style={{
                                    width: 54, height: 54, margin: '0 auto 12px', background: view.background, color: '#fff',
                                    borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.75rem', boxShadow: view.boxShadow,
                                }}
                            >
                                {view.icon}
                            </div>
                            <h2 className="page-title-animated" id="authTitle" style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: 4 }}>{view.title}</h2>
                            <p id="authSubtitle" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                {view.subtitle}
                            </p>
                        </div>

                        <div id="authAlert" style={{ display: alert.shown ? 'block' : 'none' }} className="alert alert-error">{alert.text}</div>
                        <div id="authSuccess" style={{ display: success.shown ? 'block' : 'none' }} className="alert alert-success">{success.text}</div>

                        {/* PANE 1: Sign In */}
                        <div id="loginPane" className={paneClass('login')} ref={paneRef('login')}>
                            <form id="loginForm" onSubmit={(e) => { e.preventDefault(); void handleLogin(roll, pin); }}>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="rollInput">Student Roll Number</label>
                                    <input type="text" id="rollInput" placeholder="e.g. 235" required autoFocus value={roll} onChange={(e) => setRoll(e.target.value)} />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="pinInput">PIN / Passcode</label>
                                    <input type="password" id="pinInput" placeholder="PIN" required value={pin} onChange={(e) => setPin(e.target.value)} />
                                </div>

                                <button type="submit" id="loginSubmitBtn" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }} disabled={loginBusy}>
                                    {loginBusy ? '⏳ Signing In...' : `Sign In to Portal ${ARROW}`}
                                </button>
                            </form>

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                {SHOW_DEMO && (<>
<p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                                    Field Testing or Faculty Review?
                                </p>
                                <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 16 }} onClick={quickDemoLogin}>
                                    ⚡ Quick Demo Sign-In (Roll 235 - Dhruv Patel)
                                </button>
</>)}

                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    New medical cadet? Ask your faculty administrator to register you from the Admin console.
                                </p>
                            </div>
                        </div>

                        {/* PANE 2: Student Registration Panel (not reachable: "register" mode opens the admin pane) */}
                        <div id="registerPane" className="auth-pane" ref={paneRef('register')}>
                            <StudentRegisterForm variant="login" alerts={alerts} />

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Already registered? <a href="javascript:void(0)" onClick={backToStudent} style={linkStyle}>Sign In to Portal {ARROW}</a>
                                </p>
                            </div>
                        </div>

                        {/* PANE 3: Faculty / Admin Sign In */}
                        <div id="adminPane" className={paneClass('admin')} ref={paneRef('admin')}>
                            <form id="adminLoginForm" onSubmit={(e) => { e.preventDefault(); void handleAdminLogin(adminUser, adminPin); }}>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="adminUserInput">Faculty / Admin Username <Req /></label>
                                    <input type="text" id="adminUserInput" placeholder="e.g. admin" required value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="adminPinInput">Security PIN / Passcode <Req /></label>
                                    <input type="password" id="adminPinInput" placeholder="PIN" required value={adminPin} onChange={(e) => setAdminPin(e.target.value)} />
                                </div>

                                <button
                                    type="submit" id="adminSubmitBtn" className="btn btn-primary" disabled={adminBusy}
                                    style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #d97706, #b45309)', borderColor: '#d97706', boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)' }}
                                >
                                    {adminBusy ? '⏳ Authenticating Admin...' : `👑 Sign In as Faculty Administrator ${ARROW}`}
                                </button>
                            </form>

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                {SHOW_DEMO && (<>
<p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                                    Immediate Faculty Testing Access
                                </p>
                                <button
                                    type="button" className="btn btn-secondary" onClick={quickDemoAdminLogin}
                                    style={{ width: '100%', marginBottom: 16, borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', color: '#d97706', fontWeight: 700 }}
                                >
                                    ⚡ Quick Demo Admin Sign-In (admin / 9999)
                                </button>
</>)}

                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Medical trainee? <a href="javascript:void(0)" onClick={backToStudent} style={linkStyle}>Return to Student Portal {ARROW}</a>
                                </p>
                            </div>
                        </div>

                        {/* PANE 4: Patient Portal (Dual Model: Independent vs. Dependent) */}
                        <div id="patientPane" className={paneClass('patient')} ref={paneRef('patient')}>
                            {/* Patient Sub-Mode Switcher */}
                            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: '1.25rem' }}>
                                <button
                                    type="button" id="btnPatientSignInMode" className="btn btn-secondary" onClick={() => switchPatientSubMode('login')}
                                    style={{ ...SUB_BASE, ...(patientSub === 'login' ? SUB_ACTIVE : SUB_INACTIVE) }}
                                >
                                    Patient Sign In
                                </button>
                                <button
                                    type="button" id="btnPatientRegisterMode" className="btn btn-secondary" onClick={() => switchPatientSubMode('register')}
                                    style={{ ...SUB_BASE, ...(patientSub === 'register' ? SUB_ACTIVE : SUB_INACTIVE) }}
                                >
                                    New Patient Registration
                                </button>
                            </div>

                            {/* Patient Sign-In Subform */}
                            <form
                                id="patientLoginForm" style={{ display: patientSub === 'login' ? 'block' : 'none' }}
                                onSubmit={(e) => { e.preventDefault(); void handlePatientLogin(patientId, patientPin); }}
                            >
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="patientLoginId">10-Digit Mobile Phone or Patient UID <Req /></label>
                                    <input type="text" id="patientLoginId" placeholder="e.g. 9876543210 or PAT-2026-XXXXX" required value={patientId} onChange={(e) => setPatientId(e.target.value)} />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.35rem' }}>
                                    <label htmlFor="patientLoginPin">Access PIN (4 Digits) <Req /></label>
                                    <input type="password" id="patientLoginPin" placeholder="PIN" required value={patientPin} onChange={(e) => setPatientPin(e.target.value)} />
                                </div>

                                <button
                                    type="submit" id="patientLoginBtn" className="btn btn-primary" disabled={patientBusy}
                                    style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderColor: '#0284c7', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)' }}
                                >
                                    {patientBusy ? '⏳ Signing In...' : `🏥 Sign In to Patient Portal ${ARROW}`}
                                </button>

                                <div style={{ textAlign: 'center', marginTop: 14 }}>
                                    {SHOW_DEMO && (<>
<p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
                                        Need immediate patient testing access?
                                    </p>
                                    <button
                                        type="button" className="btn btn-secondary" onClick={quickDemoPatientLogin}
                                        style={{ width: '100%', borderColor: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', color: '#0369a1', fontWeight: 700 }}
                                    >
                                        ⚡ Quick Demo Patient Sign-In (9876543210 / 1234)
                                    </button>
</>)}
                                </div>
                            </form>

                            {/* Patient Registration Subform */}
                            <form id="patientRegisterForm" onSubmit={handlePatientRegister} style={{ display: patientSub === 'register' ? 'block' : 'none' }}>
                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label htmlFor="patientRegName">Full Patient Name <Req /></label>
                                    <input type="text" id="patientRegName" placeholder="e.g. Rajeshbhai Vora" required value={pName} onChange={(e) => setPName(e.target.value)} />
                                </div>

                                <div className="reg-grid-2" style={{ marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="patientRegPhone">Mobile Phone (10 Digits) <Req /></label>
                                        <input type="tel" id="patientRegPhone" placeholder="e.g. 9876543210" required maxLength={10} value={pPhone} onChange={(e) => setPPhone(e.target.value)} />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="patientRegPin">4-Digit Access PIN <Req /></label>
                                        <input type="password" id="patientRegPin" placeholder="e.g. 1234" minLength={4} maxLength={6} required value={pPin} onChange={(e) => setPPin(e.target.value)} />
                                    </div>
                                </div>

                                <div className="reg-grid-2" style={{ marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="patientRegAge">Age (Years)</label>
                                        <input type="number" id="patientRegAge" placeholder="e.g. 48" min={0} max={120} value={pAge} onChange={(e) => setPAge(e.target.value)} />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="patientRegGender">Gender</label>
                                        <select id="patientRegGender" value={pGender} onChange={(e) => setPGender(e.target.value)}>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Adopted by Cadet Checkbox & Dynamic Referral Input */}
                                <div style={{ marginTop: 12, marginBottom: 14, background: 'rgba(14, 165, 233, 0.07)', border: '1.5px solid rgba(14, 165, 233, 0.35)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, color: '#0369a1', margin: 0, fontSize: '0.88rem' }}>
                                        <input
                                            type="checkbox" id="patientIsAdopted" checked={pAdopted} onChange={(e) => togglePatientReferralInput(e.target.checked)}
                                            style={{ width: 18, height: 18, accentColor: '#0284c7', cursor: 'pointer' }}
                                        />
                                        <span>Adopted by a Medical Cadet? / Link to Medical Student</span>
                                    </label>

                                    <div id="patientReferralArea" style={{ display: pAdopted ? 'block' : 'none', marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(14, 165, 233, 0.35)' }}>
                                        <label htmlFor="patientReferralCode" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', marginBottom: 5, display: 'block' }}>
                                            Cadet Referral Code *
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text" id="patientReferralCode" placeholder="e.g. SAL-235-DA9B" value={pRefCode}
                                                onChange={(e) => { setPRefCode(e.target.value); debounceVerifyReferral(e.target.value); }}
                                                style={{ fontFamily: 'monospace', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.04em', paddingRight: 36 }}
                                            />
                                            <span id="patientRefStatusIcon" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', display: refIcon.shown ? 'block' : 'none' }}>{refIcon.text}</span>
                                        </div>
                                        <ReferralFeedback state={refFeedback} />
                                    </div>
                                </div>

                                <button
                                    type="submit" id="patientRegBtn" className="btn btn-primary" disabled={pRegBusy}
                                    style={{ width: '100%', padding: '0.82rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderColor: '#0284c7', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)' }}
                                >
                                    {pRegBusy ? '⏳ Registering Patient...' : `✨ Register Patient & Access Dashboard ${ARROW}`}
                                </button>
                            </form>

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Medical Trainee or Faculty? <a href="javascript:void(0)" onClick={backToStudent} style={linkStyle}>Return to Student Portal {ARROW}</a>
                                </p>
                            </div>
                        </div>

                        {/* PANE 5: Hospital Staff & Administrative Console Login */}
                        <div id="hospitalPane" className={paneClass('hospital')} ref={paneRef('hospital')}>
                            <form id="hospitalLoginForm" onSubmit={(e) => { e.preventDefault(); void handleHospitalLogin(hospUser, hospPin); }}>
                                <div style={{ background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>🏥</span>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                                        <strong style={{ color: '#0f766e' }}>Independent Hospital Network</strong><br />
                                        Hospital Super Admins (1~3) &amp; Admins (up to 20) with cross-institutional patient surveillance.
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="hospUsernameInput">Hospital Staff Username / ID</label>
                                    <input type="text" id="hospUsernameInput" placeholder="e.g. hosp_superadmin or phone" required value={hospUser} onChange={(e) => setHospUser(e.target.value)} />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="hospPinInput">Staff Security PIN</label>
                                    <input type="password" id="hospPinInput" placeholder="PIN" required value={hospPin} onChange={(e) => setHospPin(e.target.value)} />
                                </div>

                                <button
                                    type="submit" id="hospSubmitBtn" className="btn btn-primary" disabled={hospBusy}
                                    style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #0d9488, #0f766e, #115e59)', border: 'none', boxShadow: '0 4px 14px rgba(13, 148, 136, 0.4)' }}
                                >
                                    {hospBusy ? '⏳ Authenticating...' : `🏨 Sign In to Hospital Console ${ARROW}`}
                                </button>
                            </form>

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                {SHOW_DEMO && (<>
<p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                                    Need immediate surveillance testing access?
                                </p>
                                <button
                                    type="button" className="btn btn-secondary" onClick={quickDemoHospitalLogin}
                                    style={{ width: '100%', marginBottom: 16, borderColor: '#0d9488', background: 'rgba(13, 148, 136, 0.08)', color: '#0f766e', fontWeight: 700 }}
                                >
                                    ⚡ Quick Demo Hospital Sign-In (hosp_superadmin / 8888)
                                </button>
</>)}

                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Medical Trainee or Patient? <a href="javascript:void(0)" onClick={backToStudent} style={linkStyle}>Return to Student Portal {ARROW}</a>
                                </p>
                            </div>
                        </div>

                            </>
                        )}
                    </div>

                    <div className="login-footer">
                        SAL Education by MedPulse &copy; 2026
                    </div>
                </div>
            </main>
        </BodyPortal>
    );
}

function ReferralFeedback({ state }: { state: FeedbackState }) {
    const base: CSSProperties = { fontSize: '0.78rem', marginTop: 6, display: state.shown ? 'block' : 'none' };
    if (state.ok === null) return <div id="patientRefFeedback" style={base} />;
    const tone: CSSProperties = state.ok
        ? { color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: 6 }
        : { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: 6 };
    return (
        <div id="patientRefFeedback" style={{ ...base, ...tone }}>
            {state.ok && state.student ? (
                <>
                    <strong>Linked Cadet:</strong> {state.student.name} • Roll {state.student.roll_number} • {state.student.college_name || 'Medical College'}
                </>
            ) : (
                state.error
            )}
        </div>
    );
}

/* ─── OTP Role Theme Mapping ─── */
const OTP_THEMES: Record<AuthMode, {
    icon: string;
    title: string;
    gradient: string;
    gradientBg: string;
    shadowColor: string;
    accentColor: string;
    accentBg: string;
    borderColor: string;
}> = {
    login: {
        icon: '👨‍⚕',
        title: 'Student Portal',
        gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9, #4f46e5)',
        gradientBg: 'rgba(124, 58, 237, 0.07)',
        shadowColor: 'rgba(109, 40, 217, 0.4)',
        accentColor: '#7c3aed',
        accentBg: 'rgba(124, 58, 237, 0.08)',
        borderColor: '#7c3aed',
    },
    admin: {
        icon: '👑',
        title: 'Faculty & Admin Portal',
        gradient: 'linear-gradient(135deg, #d97706, #b45309, #92400e)',
        gradientBg: 'rgba(217, 119, 6, 0.07)',
        shadowColor: 'rgba(217, 119, 6, 0.45)',
        accentColor: '#d97706',
        accentBg: 'rgba(217, 119, 6, 0.08)',
        borderColor: '#d97706',
    },
    patient: {
        icon: '🏥',
        title: 'Patient Health Portal',
        gradient: 'linear-gradient(135deg, #0284c7, #0369a1, #075985)',
        gradientBg: 'rgba(2, 132, 199, 0.07)',
        shadowColor: 'rgba(2, 132, 199, 0.45)',
        accentColor: '#0284c7',
        accentBg: 'rgba(2, 132, 199, 0.08)',
        borderColor: '#0284c7',
    },
    hospital: {
        icon: '🏨',
        title: 'Hospital Command Center',
        gradient: 'linear-gradient(135deg, #0d9488, #0f766e, #115e59)',
        gradientBg: 'rgba(13, 148, 136, 0.07)',
        shadowColor: 'rgba(13, 148, 136, 0.45)',
        accentColor: '#0d9488',
        accentBg: 'rgba(13, 148, 136, 0.08)',
        borderColor: '#0d9488',
    },
};

/* ─── OTP Verification Pane Component ─── */
interface OtpPaneProps {
    pending: OtpPendingState;
    digits: string[];
    busy: boolean;
    resendTimer: number;
    inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
    alert: { text: string; shown: boolean };
    success: { text: string; shown: boolean };
    onDigitChange: (index: number, value: string) => void;
    onKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
    onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
    onVerify: () => void;
    onSkip: () => void;
    onResend: () => void;
    onBack: () => void;
}

function OtpVerificationPane({ pending, digits, busy, resendTimer, inputRefs, alert, success, onDigitChange, onKeyDown, onPaste, onVerify, onSkip, onResend, onBack }: OtpPaneProps) {
    const theme = OTP_THEMES[pending.role];
    const otpFilled = digits.join('').length === 6;

    const paneStyle: CSSProperties = {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        animation: 'otp-slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        boxSizing: 'border-box',
    };

    const digitBoxStyle = (filled: boolean): CSSProperties => ({
        flex: '1 1 0',
        maxWidth: 48,
        minWidth: 32,
        height: 'clamp(46px, 12vw, 56px)',
        textAlign: 'center',
        fontSize: 'clamp(1.2rem, 4.2vw, 1.5rem)',
        fontWeight: 800,
        fontFamily: 'monospace',
        border: `2px solid ${filled ? theme.accentColor : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        outline: 'none',
        background: filled ? theme.accentBg : '#fff',
        color: 'var(--text-primary)',
        transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
        caretColor: theme.accentColor,
        padding: 0,
        boxSizing: 'border-box',
    });

    return (
        <div style={paneStyle} id="otpPane">
            {/* Top Bar with Back Button and Role Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                    type="button" onClick={onBack}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 650,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                        transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
                    </svg>
                    <span>Back</span>
                </button>
                <span style={{ fontSize: '0.74rem', color: theme.accentColor, fontWeight: 700, background: theme.accentBg, padding: '3px 10px', borderRadius: '12px' }}>
                    {theme.title}
                </span>
            </div>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div
                    style={{
                        width: 48, height: 48, margin: '0 auto 10px', background: theme.gradient, color: '#fff',
                        borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', boxShadow: `0 8px 24px ${theme.shadowColor}`,
                    }}
                >
                    🔐
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
                    OTP Verification
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
                    A 6-digit verification code has been sent to your registered contact.
                    <br />
                    <span style={{ fontWeight: 650, color: theme.accentColor }}>
                        {theme.icon} {pending.displayName}
                    </span>
                </p>
            </div>

            {/* Alerts */}
            <div id="otpAlert" style={{ display: alert.shown ? 'block' : 'none', marginBottom: 12 }} className="alert alert-error">{alert.text}</div>
            <div id="otpSuccess" style={{ display: success.shown ? 'block' : 'none', marginBottom: 12 }} className="alert alert-success">{success.text}</div>

            {/* OTP Input Boxes */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(6px, 1.8vw, 10px)', marginBottom: 8, width: '100%', maxWidth: 360, margin: '0 auto 8px' }}>
                {digits.map((d, i) => (
                    <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={d}
                        onChange={(e) => onDigitChange(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onPaste={i === 0 ? onPaste : undefined}
                        onFocus={(e) => { e.currentTarget.style.borderColor = theme.accentColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.accentBg}`; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = d ? theme.accentColor : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        style={digitBoxStyle(!!d)}
                        disabled={busy}
                        id={`otpDigit${i}`}
                    />
                ))}
            </div>

            {/* Resend Timer */}
            <div style={{ textAlign: 'center', marginBottom: 18, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {resendTimer > 0 ? (
                    <span>Resend code in <strong style={{ color: theme.accentColor }}>{resendTimer}s</strong></span>
                ) : (
                    <button
                        type="button" onClick={onResend}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: theme.accentColor, fontWeight: 700, fontSize: '0.82rem',
                            textDecoration: 'underline',
                        }}
                    >
                        📨 Resend OTP Code
                    </button>
                )}
            </div>

            {/* Verify Button */}
            <button
                type="button" id="otpVerifyBtn" onClick={onVerify} disabled={!otpFilled || busy}
                className="btn btn-primary"
                style={{
                    width: '100%', padding: '0.78rem', fontSize: '0.95rem',
                    background: otpFilled ? theme.gradient : 'var(--bg-secondary)',
                    borderColor: otpFilled ? theme.borderColor : 'var(--border)',
                    boxShadow: otpFilled ? `0 4px 14px ${theme.shadowColor}` : 'none',
                    color: otpFilled ? '#fff' : 'var(--text-muted)',
                    cursor: otpFilled && !busy ? 'pointer' : 'not-allowed',
                    opacity: busy ? 0.7 : 1,
                    marginBottom: 10,
                }}
            >
                {busy ? '⏳ Verifying...' : `🔐 Verify OTP & Continue →`}
            </button>

            {/* Skip / Proceed Without OTP */}
            <button
                type="button" id="otpSkipBtn" onClick={onSkip} disabled={busy}
                className="btn btn-secondary"
                style={{
                    width: '100%', padding: '0.72rem', fontSize: '0.88rem',
                    borderColor: theme.borderColor,
                    background: theme.accentBg,
                    color: theme.accentColor,
                    fontWeight: 700,
                    opacity: busy ? 0.6 : 1,
                }}
            >
                ⚡ Proceed Without OTP
            </button>

            {/* Info notice */}
            <div style={{
                marginTop: 14, padding: '10px 12px',
                background: theme.gradientBg,
                border: `1px solid ${theme.borderColor}22`,
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45,
                display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
                <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>ℹ</span>
                <span>
                    <strong>OTP Provider Not Configured.</strong> When an SMS/email OTP provider is integrated,
                    verification will be mandatory. For now, you may proceed without OTP using the button above.
                </span>
            </div>
        </div>
    );
}
