/**
 * Student cadre registration form (the "registerPane" form of login.html and register.html).
 * Same fields, validation, request and redirects as the original handleRegister().
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useValidatedField, validateEmail, validatePhone } from '../../shared/validation';

export interface AuthAlerts {
    hide: () => void;
    error: (msg: string) => void;
    success: (msg: string) => void;
}

interface College {
    id: number | string;
    name: string;
}

interface RegisterResponse {
    student?: { name?: string; [key: string]: unknown };
    error?: string;
}

const SUBMIT_LABEL = '✨ Complete Registration & Launch Portal →';
const Req = () => <span style={{ color: '#ef4444' }}>*</span>;

/** GET /api/colleges, replacing the default option when the list is non-empty (loadColleges). */
export function useColleges(): College[] | null {
    const [colleges, setColleges] = useState<College[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/colleges');
                if (!res.ok) return;
                const list = (await res.json()) as unknown;
                if (!cancelled && Array.isArray(list) && list.length > 0) setColleges(list as College[]);
            } catch (e) {
                console.warn('Could not load colleges:', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    return colleges;
}

export function StudentRegisterForm({
    variant,
    alerts,
    autoFocusName = false,
}: {
    /** 'login' = the pane inside login.html, 'register' = the standalone register.html. */
    variant: 'login' | 'register';
    alerts: AuthAlerts;
    autoFocusName?: boolean;
}) {
    const colleges = useColleges();
    const [name, setName] = useState('');
    const [roll, setRoll] = useState('');
    const [batch, setBatch] = useState('3rd Year MBBS (Community Medicine)');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [unit, setUnit] = useState('RHTC - Rural Health Training Center');
    const [college, setCollege] = useState('1');
    const [busy, setBusy] = useState(false);
    const [mismatchShown, setMismatchShown] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const emailField = useValidatedField('email', true);
    const phoneField = useValidatedField('phone', true);

    // The <select> takes the first loaded college, like replacing its innerHTML did.
    useEffect(() => {
        if (colleges && colleges.length > 0) setCollege(String(colleges[0].id));
    }, [colleges]);

    const validatePinMatch = (p = pin, c = pinConfirm): boolean => {
        const mismatch = !!c && p !== c;
        setMismatchShown(mismatch);
        return !mismatch;
    };

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        alerts.hide();

        if (!validatePinMatch()) {
            alerts.error('PIN / Passcode and confirmation do not match.');
            return;
        }

        const rollV = roll.trim();
        const nameV = name.trim();
        const pinV = pin.trim();
        const emailV = email.trim();
        const phoneV = phone.trim();

        if (!rollV || !nameV) {
            alerts.error('Please provide both Student Name and Roll Number.');
            return;
        }

        if (emailV) {
            const emailCheck = validateEmail(emailV, false);
            if (!emailCheck.valid) {
                alerts.error(emailCheck.error);
                emailField.showError(emailCheck.error);
                emailRef.current?.focus();
                return;
            }
        }

        let cleanPhoneVal = phoneV;
        if (phoneV) {
            const phoneCheck = validatePhone(phoneV, false);
            if (!phoneCheck.valid) {
                alerts.error(phoneCheck.error);
                phoneField.showError(phoneCheck.error);
                phoneRef.current?.focus();
                return;
            }
            cleanPhoneVal = phoneCheck.clean;
        }

        const standalone: boolean = variant === 'register';
        setBusy(true);
        try {
            if (standalone) {
                // The original register.html built the request body from an undeclared `unit`
                // variable, so every submit failed here with this ReferenceError before any request.
                throw new ReferenceError('unit is not defined');
            }
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roll_number: rollV,
                    name: nameV,
                    pin: pinV,
                    batch_year: batch,
                    posting_unit: unit,
                    email: emailV,
                    phone: cleanPhoneVal,
                    college_id: college,
                }),
            });
            const data = (await res.json()) as RegisterResponse;
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            alerts.success(`🎉 Registration successful! Welcome, ${data.student!.name}. Launching portal...`);

            if (!standalone) {
                localStorage.removeItem('medpulse_patient');
                localStorage.removeItem('medpulse_hospital_admin');
            }
            localStorage.setItem('medpulse_user', JSON.stringify(data.student));

            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                let target = params.get('redirect');
                if (standalone) {
                    target = target || '/family-manage.html';
                } else if (
                    !target || target === '/' || target === '/index.html' || target.indexOf('login') !== -1 ||
                    target.startsWith('/patient') || target.startsWith('/hospital') || target.startsWith('/admin')
                ) {
                    target = '/profile.html';
                }
                window.location.href = target;
            }, 1200);
        } catch (err) {
            alerts.error((err as Error).message);
            setBusy(false);
        }
    };

    return (
        <form id="registerForm" onSubmit={handleRegister}>
            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label htmlFor="regName">Full Name <Req /></label>
                <input type="text" id="regName" placeholder="e.g. Dr. Ananya Sharma" required autoFocus={autoFocusName} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="reg-grid-2" style={{ marginBottom: '0.85rem' }}>
                <div className="form-group">
                    <label htmlFor="regRoll">Roll Number <Req /></label>
                    <input type="text" id="regRoll" placeholder="e.g. 236" required value={roll} onChange={(e) => setRoll(e.target.value)} />
                </div>

                <div className="form-group">
                    <label htmlFor="regBatch">MBBS Batch / Year</label>
                    <select id="regBatch" value={batch} onChange={(e) => setBatch(e.target.value)}>
                        <option value="3rd Year MBBS (Community Medicine)">3rd Year MBBS (PSM)</option>
                        <option value="2nd Year MBBS">2nd Year MBBS</option>
                        <option value="Final Year MBBS Part 1">Final Year MBBS Part 1</option>
                        <option value="Final Year MBBS Part 2">Final Year MBBS Part 2</option>
                        <option value="CRMI Intern Doctor">CRMI Intern Doctor</option>
                    </select>
                </div>
            </div>

            <div className="reg-grid-2" style={{ marginBottom: '0.85rem' }}>
                <div className="form-group">
                    <label htmlFor="regPin">Security PIN (4-6 digits) <Req /></label>
                    <input
                        type="password" id="regPin" placeholder="e.g. 1234" minLength={4} maxLength={8} required value={pin}
                        onChange={(e) => { setPin(e.target.value); validatePinMatch(e.target.value, pinConfirm); }}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="regPinConfirm">Confirm PIN <Req /></label>
                    <input
                        type="password" id="regPinConfirm" placeholder="Re-enter PIN" minLength={4} maxLength={8} required value={pinConfirm}
                        onChange={(e) => { setPinConfirm(e.target.value); validatePinMatch(pin, e.target.value); }}
                    />
                </div>
            </div>
            <div id="pinMismatchMsg" className="pin-feedback-hint" style={{ display: mismatchShown ? 'block' : 'none', color: '#ef4444', marginBottom: '0.85rem' }}>⚠️ PINs do not match</div>

            <div className="reg-grid-2" style={{ marginBottom: '0.85rem' }}>
                <div className="form-group">
                    <label htmlFor="regEmail">Email Address</label>
                    <input
                        ref={emailRef} type="email" id="regEmail" placeholder="ananya.sharma@medpulse.edu" className={emailField.className} value={email}
                        onChange={(e) => { setEmail(e.target.value); emailField.onInput(e.target.value); }}
                        onBlur={(e) => emailField.onInput(e.target.value)}
                    />
                    {emailField.hints}
                </div>

                <div className="form-group">
                    <label htmlFor="regPhone">Contact Phone</label>
                    <input
                        ref={phoneRef} type="tel" id="regPhone" placeholder="10-digit mobile number" {...phoneField.inputProps} className={phoneField.className} value={phone}
                        onChange={(e) => { setPhone(e.target.value); phoneField.onInput(e.target.value); }}
                        onBlur={(e) => phoneField.onInput(e.target.value)}
                    />
                    {phoneField.hints}
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label htmlFor="regUnit">Clinical Posting Unit</label>
                <select id="regUnit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option value="RHTC - Rural Health Training Center">RHTC - Rural Health Training Center</option>
                    <option value="UHTC - Urban Health Training Center">UHTC - Urban Health Training Center</option>
                    <option value="Community Medicine Unit 1">Community Medicine Unit 1</option>
                    <option value="Community Medicine Unit 2">Community Medicine Unit 2</option>
                    <option value="Primary Health Center (PHC) Posting">Primary Health Center (PHC) Posting</option>
                    <option value="Field Health Survey Department">Field Health Survey Department</option>
                </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.35rem' }}>
                <label htmlFor="regCollege">Medical College / Institution</label>
                <select id="regCollege" value={college} onChange={(e) => setCollege(e.target.value)}>
                    {colleges ? (
                        colleges.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)
                    ) : (
                        <option value="1">SAL Institute of Medical Sciences &amp; Hospital</option>
                    )}
                </select>
            </div>

            <button type="submit" id="regSubmitBtn" className="btn btn-primary" style={{ width: '100%', padding: '0.82rem', fontSize: '0.95rem' }} disabled={busy}>
                {busy ? '⏳ Registering Student...' : SUBMIT_LABEL}
            </button>
        </form>
    );
}
