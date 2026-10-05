/**
 * Sidebar user badges. Each original page replaced the auth-guard badge with its own
 * initAuth() markup; the variants below reproduce those exactly.
 */
import { MedPulseAuth, type StudentSession } from '../../../shared/session';

export const isCollapsed = () =>
    document.documentElement.classList.contains('sidebar-collapsed') || document.body.classList.contains('sidebar-collapsed');

/** Parse localStorage.medpulse_user like the pages did (no validity check; throws on bad JSON). */
export function readStoredUser(): StudentSession | null {
    const s = localStorage.getItem('medpulse_user');
    if (!s) return null;
    try {
        return JSON.parse(s) as StudentSession;
    } catch {
        return null;
    }
}

/** MedPulseAuth.getUser() first, then the raw localStorage value (schedule / attendance / exams). */
export function readAuthUser(): StudentSession | null {
    return MedPulseAuth.getUser() || readStoredUser();
}

/** remove + go to login (profile / family-manage / index). */
export function logoutToLogin(): void {
    localStorage.removeItem('medpulse_user');
    window.location.href = '/login.html';
}
/** remove + reload (entry / analytics). */
export function logoutReload(): void {
    localStorage.removeItem('medpulse_user');
    window.location.reload();
}

function PersonIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

export function SignInLink() {
    return (
        <a href="/login.html" className="sidebar-login-link" title="Sign In">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="login-label">Sign In</span>
        </a>
    );
}

/** schedule.html's signed-out variant. */
export function StudentSignInLink() {
    return (
        <a href="/login.html" className="sidebar-login-link" title="Student Sign In">
            <div className="login-icon-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
            </div>
            <span>Sign In</span>
        </a>
    );
}

interface StudentBadgeProps {
    roll: string;
    /** "Click to Logout": collapsed click logs out, expanded click does nothing. "View Profile": expanded click opens the profile. */
    mode: 'logout' | 'profile';
    onLogout: () => void;
}

export function StudentBadge({ roll, mode, onLogout }: StudentBadgeProps) {
    const onClick = () => {
        if (isCollapsed()) onLogout();
        else if (mode === 'profile') window.location.href = '/profile.html';
    };
    return (
        <div className="sidebar-user" data-tooltip={`Roll ${roll} (${mode === 'logout' ? 'Click to Logout' : 'View Profile'})`} onClick={onClick} title={`Roll ${roll}`}>
            <div className="user-avatar-badge">
                <PersonIcon />
                <span className="role-dot" />
            </div>
            <div className="user-info-text">
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'block' }}>Student</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>Roll {roll}</span>
            </div>
            <button className="logout-btn" onClick={(e) => { e.stopPropagation(); onLogout(); }} title="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
            </button>
        </div>
    );
}
