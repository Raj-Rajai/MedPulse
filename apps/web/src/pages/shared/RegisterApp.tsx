/**
 * register.html: the old standalone student registration page. The entry HTML redirects to
 * /login.html#admin straight away (meta refresh + location.replace), exactly like the original;
 * this is the markup the original page rendered underneath.
 */
import { useEffect, useState } from 'react';
import { BodyPortal, removePreloadTransitions } from './page-utils';
import { StudentRegisterForm, type AuthAlerts } from './StudentRegisterForm';

export function RegisterApp() {
    const [alert, setAlert] = useState<{ text: string; shown: boolean }>({ text: '', shown: false });
    const [success, setSuccess] = useState<{ text: string; shown: boolean }>({ text: '', shown: false });

    useEffect(() => {
        removePreloadTransitions();
        // initSidebar(): there is no sidebar on this page, but the collapsed state is still synced.
        const collapsed = (localStorage.getItem('sidebar_collapsed') === '1' || localStorage.getItem('sidebar_collapsed') === 'true') && window.innerWidth > 860;
        document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
        document.body.classList.toggle('sidebar-collapsed', collapsed);
    }, []);

    const alerts: AuthAlerts = {
        hide: () => {
            setAlert((a) => ({ ...a, shown: false }));
            setSuccess((s) => ({ ...s, shown: false }));
        },
        error: (text) => setAlert({ text, shown: true }),
        success: (text) => setSuccess({ text, shown: true }),
    };

    return (
        <BodyPortal>
            <main className="login-page-container">
                <div className="login-wrapper mode-register" id="loginWrapper">

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
                        {/* Auth Mode Switcher */}
                        <div className="auth-mode-nav state-register" id="authModeNav">
                            <div className="auth-mode-glider" id="authModeGlider" />
                            <button type="button" className="auth-mode-btn" id="tabSignIn" onClick={() => { window.location.href = '/login.html'; }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Sign In
                            </button>
                            <button type="button" className="auth-mode-btn active" id="tabRegister">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <line x1="19" y1="8" x2="19" y2="14" />
                                    <line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                                Register Student
                            </button>
                        </div>

                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div
                                className="anim-float" id="authHeaderIcon"
                                style={{
                                    width: 54, height: 54, margin: '0 auto 12px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #4f46e5)', color: '#fff',
                                    borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem',
                                    boxShadow: '0 8px 24px rgba(109, 40, 217, 0.4)',
                                }}
                            >
                                📝
                            </div>
                            <h2 className="page-title-animated" id="authTitle" style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: 4 }}>Student Cadre Registration</h2>
                            <p id="authSubtitle" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Register your clinical student profile to begin field health surveys.
                            </p>
                        </div>

                        <div id="authAlert" style={{ display: alert.shown ? 'block' : 'none' }} className="alert alert-error">{alert.text}</div>
                        <div id="authSuccess" style={{ display: success.shown ? 'block' : 'none' }} className="alert alert-success">{success.text}</div>

                        {/* Student Registration Panel Form */}
                        <div id="registerPane" className="auth-pane active">
                            <StudentRegisterForm variant="register" alerts={alerts} autoFocusName />

                            <div className="section-divider" />

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Already registered? <a href="/login.html" style={{ color: 'var(--accent)', fontWeight: 650, textDecoration: 'underline' }}>Sign In to Portal {'→'}</a>
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </BodyPortal>
    );
}
