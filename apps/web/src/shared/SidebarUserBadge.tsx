/**
 * Signed-in user badge at the bottom of the dark sidebar (renderSidebarUserBadge in
 * frontend/shared/auth-guard.js). Renders inside the page's `#authNavArea` container.
 */
import { pageKind } from './auth-guard';
import {
    getAdmin, getHospitalAdmin, getPatient, getUser,
    logout, logoutAdmin, logoutHospitalAdmin, logoutPatient,
} from './session';

const isCollapsed = () =>
    document.documentElement.classList.contains('sidebar-collapsed') || document.body.classList.contains('sidebar-collapsed');

const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 } as const;

function LogoutIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}

function SignInLink({ href, label, title }: { href: string; label: string; title: string }) {
    return (
        <a href={href} className="sidebar-login-link" title={title}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="login-label">{label}</span>
        </a>
    );
}

interface BadgeProps {
    tooltip: string;
    title: string;
    onClick: () => void;
    boxStyle?: React.CSSProperties;
    avatarStyle?: React.CSSProperties;
    avatar: React.ReactNode;
    dotStyle?: React.CSSProperties;
    dotTitle: string;
    roleLabel: string;
    roleStyle: React.CSSProperties;
    name: string;
    nameTitle: string;
    nameStyle: React.CSSProperties;
    onLogout: () => void;
    logoutTitle: string;
}

function Badge(p: BadgeProps) {
    return (
        <div className="sidebar-user" style={p.boxStyle} data-tooltip={p.tooltip} onClick={p.onClick} title={p.title}>
            <div className="user-avatar-badge" style={p.avatarStyle}>
                {p.avatar}
                <span className="role-dot" style={p.dotStyle} title={p.dotTitle} />
            </div>
            <div className="user-info-text">
                <span style={p.roleStyle}>{p.roleLabel}</span>
                <span style={p.nameStyle} title={p.nameTitle}>{p.name}</span>
            </div>
            <button className="logout-btn" onClick={(e) => { e.stopPropagation(); p.onLogout(); }} title={p.logoutTitle}>
                <LogoutIcon />
            </button>
        </div>
    );
}

export function SidebarUserBadge() {
    const { isAdminPage, isPatientPage, isHospitalPage } = pageKind();
    const user = getUser();
    const admin = getAdmin();
    const patient = getPatient();
    const hosp = getHospitalAdmin();

    if (isHospitalPage || (hosp && !user && !admin && !patient)) {
        if (!hosp) return <SignInLink href="/login.html?hospital=1" label="Hospital Sign In" title="Hospital Sign In" />;
        const name = String(hosp.name || hosp.username);
        const role = String(hosp.role || 'Hospital Staff');
        const h = String(hosp.hospital_name || 'SAL Hospital');
        return (
            <Badge
                tooltip={name} title={`${name} (${role} - ${h})`}
                onClick={() => (isCollapsed() ? logoutHospitalAdmin() : (window.location.href = '/hospital.html'))}
                boxStyle={{ borderColor: 'rgba(13, 148, 136, 0.35)', background: 'rgba(13, 148, 136, 0.08)' }}
                avatarStyle={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff' }} avatar="🏥"
                dotStyle={{ background: '#2dd4bf', boxShadow: '0 0 8px #2dd4bf' }} dotTitle="Active Hospital Session"
                roleLabel={role} roleStyle={{ fontSize: '0.72rem', color: '#5eead4', fontWeight: 700, display: 'block', ...ellipsis }}
                name={name} nameTitle={name} nameStyle={{ fontWeight: 750, color: '#fff', ...ellipsis }}
                onLogout={logoutHospitalAdmin} logoutTitle="Sign Out Hospital Staff"
            />
        );
    }

    if (isPatientPage || (patient && !user && !admin)) {
        if (!patient) return <SignInLink href="/login.html?patient=1" label="Patient Sign In" title="Patient Sign In" />;
        const name = String(patient.name || patient.patient_uid);
        const model = String(patient.model_type || 'Patient');
        return (
            <Badge
                tooltip={name} title={`${name} (${model})`}
                onClick={() => (isCollapsed() ? logoutPatient() : (window.location.href = '/patient.html'))}
                boxStyle={{ borderColor: 'rgba(14, 165, 233, 0.35)', background: 'rgba(14, 165, 233, 0.08)' }}
                avatarStyle={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff' }} avatar="🏥"
                dotStyle={{ background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} dotTitle="Active Patient Session"
                roleLabel={model} roleStyle={{ fontSize: '0.72rem', color: '#7dd3fc', fontWeight: 700, display: 'block', ...ellipsis }}
                name={name} nameTitle={name} nameStyle={{ fontWeight: 750, color: '#fff', ...ellipsis }}
                onLogout={logoutPatient} logoutTitle="Sign Out Patient"
            />
        );
    }

    if (isAdminPage || (admin && !user)) {
        if (!admin) return <SignInLink href="/login.html?admin=1" label="Admin Sign In" title="Faculty Sign In" />;
        const name = String(admin.name || 'Faculty Administrator');
        const role = String(admin.role || 'Super Admin');
        return (
            <Badge
                tooltip={`Admin (${name})`} title={`${name} (${role})`}
                onClick={() => (isCollapsed() ? logoutAdmin() : (window.location.href = '/admin.html'))}
                boxStyle={{ borderColor: 'rgba(234, 179, 8, 0.35)', background: 'rgba(234, 179, 8, 0.08)' }}
                avatarStyle={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#000' }} avatar="👑"
                dotStyle={{ background: '#eab308', boxShadow: '0 0 8px #eab308' }} dotTitle="Active Faculty Session"
                roleLabel={role} roleStyle={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 700, display: 'block', ...ellipsis }}
                name={name} nameTitle={name} nameStyle={{ fontWeight: 750, color: '#fff', ...ellipsis }}
                onLogout={logoutAdmin} logoutTitle="Sign Out Admin"
            />
        );
    }

    if (!user) return <SignInLink href="/login.html" label="Sign In" title="Sign In" />;
    const displayName = String(user.name || 'Roll ' + user.roll_number);
    const displayRole = user.batch_year ? String(user.batch_year).split(' ')[0] + ' MBBS' : 'Medical Cadet';
    const rollNum = String(user.roll_number || '235');
    return (
        <Badge
            tooltip={`Roll ${rollNum} (${displayName})`} title={`${displayName} (Roll ${rollNum})`}
            onClick={() => (isCollapsed() ? logout() : (window.location.href = '/profile.html'))}
            avatar={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            }
            dotTitle="Active Cadet Session"
            roleLabel={displayRole} roleStyle={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', display: 'block', ...ellipsis }}
            name={`Roll ${rollNum}`} nameTitle={displayName} nameStyle={{ fontWeight: 700, color: '#fff', ...ellipsis }}
            onLogout={logout} logoutTitle="Sign Out"
        />
    );
}
