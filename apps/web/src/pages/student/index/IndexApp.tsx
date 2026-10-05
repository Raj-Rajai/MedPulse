/**
 * student/index.html: Community Medicine dashboard (KPIs, assigned households, recent activity, proforma exports).
 */
import { useEffect, useState } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutToLogin, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_INDEX, useToasts } from '../common/Toasts';
import { errMsg } from '../common/utils';
import type { StudentSession } from '../../../shared/session';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

interface Family {
    id: number;
    family_code?: string;
    family_no?: number;
    head_of_family?: string;
    village?: string;
    village_ward?: string;
    member_count?: number;
    surveyed_members?: number;
    calorie_status?: string;
}
interface Activity {
    member_name?: string;
    gender?: string;
    age_years?: number;
    head_of_family?: string;
    visit_date?: string;
    visit_number?: number;
    clinical_notes?: string;
    sbp?: number;
    dbp?: number;
    rbs?: number;
    health_progress?: string;
}
interface Dashboard {
    stats?: Record<string, number>;
    families?: Family[];
    recentActivity?: Activity[];
}

function FamilyCard({ f }: { f: Family }) {
    const totalM = f.member_count || 0;
    const survM = f.surveyed_members || 0;
    const pct = totalM > 0 ? Math.round((survM / totalM) * 100) : 0;
    const calStatus = f.calorie_status === 'Normal' ? 'badge-success' : f.calorie_status === 'Deficient' ? 'badge-danger' : 'badge-warning';
    return (
        <div className="profile-household-card">
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.72rem', fontWeight: 750 }}>{f.family_code || `FAM-${String(f.family_no).padStart(4, '0')}`}</span>
                    <span className={`badge ${calStatus}`} style={{ fontSize: '0.7rem' }}>CU: {f.calorie_status || 'Normal'}</span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 750, color: 'var(--text-primary)', marginBottom: '2px' }}>{f.head_of_family}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    📍 {f.village || f.village_ward || 'Field Area'} • {totalM} Members
                </div>
                <div className="household-progress-bar">
                    <div className="household-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Survey Completion</span>
                    <span>
                        <strong>{survM}</strong> / {totalM} ({pct}%)
                    </span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                <a href={`/family-manage.html?familyId=${f.id}`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '5px 8px', fontWeight: 650 }}>
                    Manage
                </a>
                <a href={`/entry.html?familyId=${f.id}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '5px 8px', fontWeight: 650 }}>
                    Survey
                </a>
            </div>
        </div>
    );
}

function ActivityItem({ a }: { a: Activity }) {
    const bpText = a.sbp && a.dbp ? `${a.sbp}/${a.dbp} mmHg` : null;
    const rbsText = a.rbs ? `RBS: ${a.rbs} mg/dL` : null;
    return (
        <div className="timeline-item">
            <div className="timeline-header">
                <span className="timeline-title">{`${a.member_name ?? ''} (${a.gender ?? ''}, ${a.age_years}y) • ${a.head_of_family ?? ''}'s Family`}</span>
                <span className="timeline-time">{`${a.visit_date ?? ''} (Visit #${a.visit_number || 1})`}</span>
            </div>
            <div className="timeline-body">
                <div>{a.clinical_notes || 'Routine follow-up assessment conducted.'}</div>
                <div className="vitals-pills">
                    {bpText ? <span className="vitals-pill">BP: {bpText}</span> : null}
                    {rbsText ? <span className="vitals-pill" style={{ background: '#fef3c7', color: '#b45309' }}>{rbsText}</span> : null}
                    <span className="vitals-pill" style={{ background: '#ecfdf5', color: '#065f46' }}>{a.health_progress || 'Stable'}</span>
                </div>
            </div>
        </div>
    );
}

export function IndexApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_INDEX);
    const [user] = useState<StudentSession | null>(readStoredUser);
    const [data, setData] = useState<Dashboard | null>(null);

    const {
        activeModal,
        saving: privacySaving,
        handleForm1Continue,
        handleForm2Consent,
        handleForm2Refuse,
        closeModal,
    } = useStudentPrivacy(user?.roll_number);

    useEffect(() => {
        (async () => {
            try {
                const query = user?.roll_number ? `?roll_number=${encodeURIComponent(user.roll_number)}` : '';
                const res = await fetch(`/api/students/profile${query}`);
                if (!res.ok) throw new Error('Failed to load Community Medicine data');
                setData((await res.json()) as Dashboard);
            } catch (err) {
                console.error('Error loading dashboard:', err);
                showToast(errMsg(err), 'error');
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    const st = data?.stats || {};
    const families = data?.families || [];
    const activities = data?.recentActivity || [];

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="home" onToggle={standardSidebar.toggle}
                badge={user ? <StudentBadge roll={String(user.roll_number || '235')} mode="profile" onLogout={logoutToLogin} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}
        <main className="main-content">
            <div className="page-header anim-fade-up">
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img src="/images/sal-logo.png" alt="SAL Logo" className="header-brand-logo" />
                    <div>
                        <span className="families-eyebrow">SAL Institute of Medical Sciences • Field Surveillance</span>
                        <h1 className="page-title">Community Medicine Dashboard</h1>
                        <p className="page-subtitle">Field household surveillance portfolio, enrolled families, and clinical activity overview.</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <a href="/family-manage.html" className="btn btn-secondary" style={{ fontWeight: "650", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>👥 Manage Families</span>
                    </a>
                    <a href="/entry.html" className="btn btn-primary" style={{ fontWeight: "650", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>➕ New Survey Entry</span>
                    </a>
                    <a href="/analytics.html" className="btn btn-secondary" style={{ fontWeight: "650", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>📊 Analytics</span>
                    </a>
                </div>
            </div>
            <div className="profile-kpis-grid anim-fade-up">
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-families">🏡</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiFamilies">{data ? st.total_families || 0 : 0}</div>
                        <div className="kpi-label">Assigned Households</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-patients">👥</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiMembers">{data ? st.total_members || 0 : 0}</div>
                        <div className="kpi-label">Enrolled Family Members</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-followups">🩺</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiFollowups">{data ? st.total_followups || 0 : 0}</div>
                        <div className="kpi-label">Follow-Up Visits Logged</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-conditions">💊</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiConditions">{data ? (st.total_conditions || 0) + (st.total_medications || 0) : 0}</div>
                        <div className="kpi-label">{"Diagnoses & Prescriptions"}</div>
                    </div>
                </div>
            </div>
            <div className="card anim-fade-up" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: "750", color: "var(--text-primary)", marginBottom: "4px" }}>🏡 Assigned Field Households</h2>
                        <p className="card-desc" style={{ margin: "0" }}>All households registered under your roll number with surveillance completion status.</p>
                    </div>
                    <a href="/family-manage.html" className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "6px 14px", fontWeight: "650" }}>Manage Families →</a>
                </div>
                <div className="profile-households-grid" id="profileFamiliesGrid">
                    {!data ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Loading assigned households...</div>
                    ) : families.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>No households assigned to this student roll yet.</div>
                    ) : families.map((f, i) => <FamilyCard key={i} f={f} />)}
                </div>
            </div>
            <div className="card anim-fade-up" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: "750", color: "var(--text-primary)", marginBottom: "4px" }}>🩺 Recent Clinical Surveillance Activity</h2>
                        <p className="card-desc" style={{ margin: "0" }}>Log of recent follow-up visits, vitals checks, and clinical interventions performed in the field.</p>
                    </div>
                    <a href="/entry.html" className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "6px 14px", fontWeight: "650" }}>New Survey Entry →</a>
                </div>
                <div className="activity-timeline" id="profileActivityTimeline">
                    {!data ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Loading recent field visits...</div>
                    ) : activities.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No recent follow-up activity logged yet.</div>
                    ) : activities.map((a, i) => <ActivityItem key={i} a={a} />)}
                </div>
            </div>

        </main>
        {activeModal && (
            <ConfidentialityNoticeModal
                type={activeModal}
                open={Boolean(activeModal)}
                onContinue={handleForm1Continue}
                onConsent={handleForm2Consent}
                onRefuse={handleForm2Refuse}
                onClose={closeModal}
                saving={privacySaving}
            />
        )}
        </BodyPortal>
    );
}
