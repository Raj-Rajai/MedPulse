/**
 * student/index.html: Community Medicine dashboard (KPIs, assigned households, recent activity, proforma exports).
 */
import { useEffect, useState } from 'react';
import { readStoredUser } from '../common/badges';
import { TOAST_INDEX, useToasts } from '../common/Toasts';
import { errMsg } from '../common/utils';
import type { StudentSession } from '../../../shared/session';
import { ConfidentialityNoticeModal } from '../../../shared/privacy/ConfidentialityNoticeModal';
import { useStudentPrivacy } from '../../../shared/privacy/useStudentPrivacy';

interface Family {
    id: number;
    family_code?: string;
    family_no?: number;
    family_name?: string | null;
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
    family_name?: string;
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

export function getHouseholdDisplayName(f: Family): string {
    if (f.family_name && f.family_name.trim()) {
        return f.family_name.trim();
    }
    const hof = (f.head_of_family || '').trim();
    if (hof) {
        if (/household/i.test(hof)) return hof;
        const parts = hof.split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        const cap = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
        return `${cap} Household${f.family_no ? ` ${f.family_no}` : ''}`;
    }
    return `Household ${f.family_no || f.id}`;
}

function FamilyCard({ f }: { f: Family }) {
    const totalM = f.member_count || 0;
    const survM = f.surveyed_members || 0;
    const pct = totalM > 0 ? Math.round((survM / totalM) * 100) : 0;
    const householdName = getHouseholdDisplayName(f);

    return (
        <div className="profile-household-card">
            <div>
                <div className="household-card-top">
                    <div className="household-card-icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" />
                        </svg>
                    </div>
                    <div className="household-card-header-info">
                        <h3 className="household-title">{householdName}</h3>
                    </div>
                </div>

                <div className="household-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="household-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="household-progress-labels">
                    <span>Survey Completion</span>
                    <span>
                        <strong>{survM}</strong> / {totalM} ({pct}%)
                    </span>
                </div>
            </div>
            <div className="household-card-actions">
                <a href={`/family-manage.html?familyId=${f.id}`} className="household-btn-manage">
                    Manage
                </a>
                <a href={`/entry.html?familyId=${f.id}`} className="household-btn-survey">
                    Survey
                </a>
            </div>
        </div>
    );
}

function ActivityItem({ a }: { a: Activity }) {
    const bpText = a.sbp && a.dbp ? `${a.sbp}/${a.dbp} mmHg` : null;
    const rbsText = a.rbs ? `RBS: ${a.rbs} mg/dL` : null;
    let famLabel = a.family_name;
    if (!famLabel && a.head_of_family) {
        if (/household/i.test(a.head_of_family)) {
            famLabel = a.head_of_family;
        } else {
            const rawLast = a.head_of_family.split(/\s+/).pop() || '';
            const capLast = rawLast.charAt(0).toUpperCase() + rawLast.slice(1);
            famLabel = `${capLast} Household`;
        }
    }
    famLabel = famLabel || 'Household';

    return (
        <div className="timeline-item">
            <div className="timeline-header">
                <span className="timeline-title">{`${a.member_name ?? ''} (${a.gender ?? ''}, ${a.age_years}y) • ${famLabel}`}</span>
                <span className="timeline-time">{`${a.visit_date ?? ''} (Visit #${a.visit_number || 1})`}</span>
            </div>
            <div className="timeline-body">
                <div className="vitals-pills">
                    {bpText ? <span className="vitals-pill">BP: {bpText}</span> : null}
                    {rbsText ? <span className="vitals-pill" style={{ background: '#fefce8', color: '#854d0e', borderColor: '#fef08a' }}>{rbsText}</span> : null}
                    <span className="vitals-pill" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>{a.health_progress || 'Stable'}</span>
                </div>
            </div>
        </div>
    );
}

export function IndexApp() {
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
        <>
            {toasts}
            <main className="main-content">
            <div className="page-header anim-fade-up">
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img src="/images/sal-logo.png" alt="SAL Logo" className="header-brand-logo" />
                    <div>
                        <h1 className="page-title">Community Medicine</h1>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <a href="/entry.html" className="btn btn-primary" style={{ fontWeight: "650", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>➕ New survey entry</span>
                    </a>
                    <a href="/family-manage.html" className="btn btn-secondary" style={{ fontWeight: "650", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>👥 Families</span>
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
                        <div className="kpi-label">Households</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-patients">👥</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiMembers">{data ? st.total_members || 0 : 0}</div>
                        <div className="kpi-label">Family members</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-followups">🩺</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiFollowups">{data ? st.total_followups || 0 : 0}</div>
                        <div className="kpi-label">Follow-up visits</div>
                    </div>
                </div>
                <div className="profile-kpi-card">
                    <div className="profile-kpi-icon kpi-icon-conditions">💊</div>
                    <div className="profile-kpi-info">
                        <div className="kpi-num" id="kpiConditions">{data ? (st.total_conditions || 0) + (st.total_medications || 0) : 0}</div>
                        <div className="kpi-label">Diagnoses and prescriptions</div>
                    </div>
                </div>
            </div>
            <div className="card anim-fade-up" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: "750", color: "var(--text-primary)", marginBottom: "4px" }}>Households</h2>
                    </div>
                </div>
                <div className="profile-households-grid" id="profileFamiliesGrid">
                    {!data ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Loading assigned households...</div>
                    ) : families.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>No households yet. Add one from Families.</div>
                    ) : families.map((f, i) => <FamilyCard key={i} f={f} />)}
                </div>
            </div>
            <div className="card anim-fade-up" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: "750", color: "var(--text-primary)", marginBottom: "4px" }}>Recent activity</h2>
                    </div>
                </div>
                <div className="activity-timeline" id="profileActivityTimeline">
                    {!data ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Loading recent field visits...</div>
                    ) : activities.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No visits logged yet.</div>
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
        </>
    );
}
