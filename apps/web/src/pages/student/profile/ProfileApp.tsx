/**
 * student/profile.html: hero identity card, overall / day-wise attendance, referral code,
 * PIN card, proforma exports, and the Edit Profile / Change PIN modals.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, logoutToLogin, readStoredUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_PROFILE, useToasts } from '../common/Toasts';
import { downloadBlob, errMsg, runWhenActive, shiftIsoDay } from '../common/utils';
import { MedPulseAuth } from '../../../shared/session';
import { useValidatedField, validateEmail, validatePhone } from '../../../shared/validation';
import { DatewiseTableBody, type DatewiseData } from '../common/Datewise';
import { OverallAttendance, type SubjectWiseData } from './OverallAttendance';
import { EditProfileModal, ChangePinModal, type ProfileForm } from './ProfileModals';
import { FillAttendanceModal, type FillableLecture } from '../common/FillAttendanceModal';
import { ActiveAttendanceBanner } from '../common/StudentAttendanceRoom';

interface Student {
    name?: string;
    roll_number?: string;
    college_name?: string;
    college_city?: string;
    college_state?: string;
    posting_unit?: string;
    referral_code?: string;
    batch_year?: string;
    email?: string;
    phone?: string;
}
interface ProfileData {
    student?: Student;
}

const TODAY = new Date().toLocaleDateString('en-CA');

export function ProfileApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_PROFILE);
    const [loggedInUser] = useState(readStoredUser);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [subjectWise, setSubjectWise] = useState<SubjectWiseData | 'loading' | 'error'>('loading');
    const [tab, setTab] = useState<'overall' | 'daywise'>('overall');
    const [dateIso, setDateIso] = useState(TODAY);
    const [dateInput, setDateInput] = useState('');
    const [datewise, setDatewise] = useState<{ data: DatewiseData | null; iso: string; error: string | null }>({ data: null, iso: TODAY, error: null });
    const [copied, setCopied] = useState(false);
    const [csvBusy, setCsvBusy] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [pinOpen, setPinOpen] = useState(false);
    const [form, setForm] = useState<ProfileForm>({ name: '', email: '', phone: '', batch: '', posting: '' });
    const [saving, setSaving] = useState(false);
    const [pin, setPin] = useState({ cur: '', n1: '', n2: '' });
    const [pinSaving, setPinSaving] = useState(false);
    const [fillAttOpen, setFillAttOpen] = useState(false);
    const [selectedFillSession, setSelectedFillSession] = useState<FillableLecture | null>(null);
    const emailField = useValidatedField('email', true);
    const phoneField = useValidatedField('phone', true);
    const emailRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const dateRef = useRef<HTMLInputElement>(null);
    const datewiseCache = useRef<DatewiseData | null>(null);
    const roll = loggedInUser?.roll_number;

    const loadStudentProfile = useCallback(async () => {
        try {
            const query = roll ? `?roll_number=${encodeURIComponent(roll)}` : '';
            const res = await fetch(`/api/students/profile${query}`);
            if (!res.ok) throw new Error('Failed to load student profile');
            setProfile(await res.json());
        } catch (err) {
            showToast(errMsg(err), 'error');
        }
    }, [roll, showToast]);

    const loadProfileAttendance = useCallback(async () => {
        try {
            const query = roll ? `?roll_number=${encodeURIComponent(roll)}` : '';
            const res = await fetch(`/api/academic/attendance/subject-wise${query}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            setSubjectWise(await res.json());
        } catch (err) {
            console.error('Failed to load profile attendance:', err);
            setSubjectWise('error');
        }
    }, [roll]);

    const loadDatewise = useCallback(async (iso: string) => {
        setDateIso(iso);
        setDateInput(iso);
        try {
            const rollParam = roll ? `&roll_number=${encodeURIComponent(roll)}` : '';
            const res = await fetch(`/api/academic/attendance/datewise?date=${encodeURIComponent(iso)}${rollParam}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = (await res.json()) as DatewiseData;
            datewiseCache.current = data;
            setDatewise({ data, iso, error: null });
        } catch (err) {
            console.error('Failed to load profile datewise attendance:', err);
            setDatewise((d) => ({ ...d, error: errMsg(err) }));
        }
    }, [roll]);

    useEffect(() => {
        return runWhenActive(() => {
            loadStudentProfile();
            loadProfileAttendance();
            loadDatewise(TODAY);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const s = profile?.student;
    const refCode = profile ? s?.referral_code || 'Pending' : null;

    const openFillAttendance = (lecture?: FillableLecture) => {
        setSelectedFillSession(lecture ?? null);
        setFillAttOpen(true);
    };

    const handleFillSuccess = (msg: string) => {
        showToast(msg, 'success');
        loadDatewise(dateIso);
        loadProfileAttendance();
    };

    const copyCadetReferralCode = () => {
        const code = (refCode ?? 'Loading...').trim() || s?.referral_code;
        if (!code || code === 'Pending' || code === 'Loading...') {
            showToast('No referral code available to copy', 'warning');
            return;
        }
        navigator.clipboard.writeText(code).then(() => {
            showToast(`Copied referral code ${code} to clipboard!`, 'success');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch((err) => {
            console.error('Clipboard copy failed:', err);
            showToast(`Referral code: ${code}`, 'info');
        });
    };

    const exportIdentity = () => {
        const student = MedPulseAuth.getUser() || JSON.parse(localStorage.getItem('medpulse_user') || '{}');
        const studentId = student.id || (loggedInUser ? loggedInUser.id : 1);
        const r = student.roll_number || (loggedInUser ? loggedInUser.roll_number : '235');
        return { studentId, roll: r };
    };

    const exportProformaCsv = async () => {
        try {
            setCsvBusy(true);
            showToast('Preparing Field Survey CSV export...', 'info');
            const { studentId, roll: r } = exportIdentity();
            const res = await fetch(`/api/export/csv?student_id=${encodeURIComponent(studentId)}&roll_number=${encodeURIComponent(r)}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Export failed with status ${res.status}`);
            }
            downloadBlob(await res.blob(), `Roll_${r}_Health_Survey_Export_${new Date().toISOString().split('T')[0]}.csv`);
            showToast('Survey CSV downloaded successfully!', 'success');
        } catch (err) {
            console.error('CSV Export failed:', err);
            showToast('CSV export failed: ' + errMsg(err), 'error');
        } finally {
            setCsvBusy(false);
        }
    };

    const exportProformaPdf = async () => {
        try {
            setPdfBusy(true);
            showToast('Generating official Clinical Survey PDF...', 'info');
            const { studentId, roll: r } = exportIdentity();
            const res = await fetch(`/api/export/pdf?student_id=${encodeURIComponent(studentId)}&roll_number=${encodeURIComponent(r)}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Export failed with status ${res.status}`);
            }
            downloadBlob(await res.blob(), `Roll_${r}_Health_Survey_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('Survey PDF downloaded successfully!', 'success');
        } catch (err) {
            console.error('PDF Export failed:', err);
            showToast('PDF export failed: ' + errMsg(err), 'error');
        } finally {
            setPdfBusy(false);
        }
    };

    const openEditProfileModal = () => {
        if (!profile || !profile.student) return;
        const st = profile.student;
        setForm({ name: st.name || '', email: st.email || '', phone: st.phone || '', batch: st.batch_year || '', posting: st.posting_unit || '' });
        setEditOpen(true);
    };

    const submitEditProfile = async () => {
        const emailVal = form.email.trim();
        const phoneVal = form.phone.trim();
        if (emailVal) {
            const emailCheck = validateEmail(emailVal, false);
            if (!emailCheck.valid) {
                showToast(emailCheck.error, 'error');
                emailField.showError(emailCheck.error);
                emailRef.current?.focus();
                return;
            }
        }
        let cleanPhoneVal = phoneVal;
        if (phoneVal) {
            const phoneCheck = validatePhone(phoneVal, false);
            if (!phoneCheck.valid) {
                showToast(phoneCheck.error, 'error');
                phoneField.showError(phoneCheck.error);
                phoneRef.current?.focus();
                return;
            }
            cleanPhoneVal = phoneCheck.clean;
        }
        setSaving(true);
        const payload = {
            roll_number: loggedInUser?.roll_number || '235',
            name: form.name.trim(),
            email: emailVal || null,
            phone: cleanPhoneVal || null,
            batch_year: form.batch.trim() || null,
            posting_unit: form.posting.trim() || null,
        };
        try {
            const res = await fetch('/api/students/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update profile');
            showToast('Profile updated successfully!', 'success');
            setEditOpen(false);
            if (loggedInUser) {
                loggedInUser.name = payload.name;
                localStorage.setItem('medpulse_user', JSON.stringify(loggedInUser));
            }
            await loadStudentProfile();
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    const submitChangePin = async () => {
        const cur = pin.cur.trim();
        const n1 = pin.n1.trim();
        const n2 = pin.n2.trim();
        if (n1 !== n2) {
            showToast('New PIN and confirmation do not match', 'error');
            return;
        }
        if (n1.length < 4) {
            showToast('PIN must be at least 4 digits', 'error');
            return;
        }
        setPinSaving(true);
        try {
            const res = await fetch('/api/students/change-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_number: loggedInUser?.roll_number || '235', current_pin: cur, new_pin: n1 }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update PIN');
            showToast('PIN updated successfully!', 'success');
            setPinOpen(false);
        } catch (err) {
            showToast(errMsg(err), 'error');
        } finally {
            setPinSaving(false);
        }
    };

    const setProfileAttendanceTab = (mode: 'overall' | 'daywise') => {
        setTab(mode);
        if (mode === 'daywise' && !datewiseCache.current) loadDatewise(dateIso);
    };


    const dw = datewise.data;
    const sm = dw?.summary || {};
    const locPart = s ? (s.college_city && s.college_state ? ` (${s.college_city}, ${s.college_state})` : s.college_city ? ` (${s.college_city})` : '') : '';

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="profile" onToggle={standardSidebar.toggle}
                badge={loggedInUser ? <StudentBadge roll={String(loggedInUser.roll_number)} mode="logout" onLogout={logoutToLogin} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}
            <main className="main-content">
                <ActiveAttendanceBanner onOpen={() => openFillAttendance()}/>
                <div className="profile-hero anim-fade-up">
                    <div className="profile-hero-content">
                        <div className="profile-identity-group">
                            <img src="/images/sal-logo.png" alt="SAL Logo" className="header-brand-logo" style={{ height: '64px', width: '64px', borderRadius: '12px', background: '#ffffff', padding: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }} />
                            <div className="profile-avatar-wrapper">
                                <div className="profile-avatar-inner" id="heroAvatarIcon">👨‍⚕️</div>
                                <div className="profile-badge-online" title="Active Field Posting" />
                            </div>
                            <div className="profile-details-area">
                                <h1>
                                    <span id="heroStudentName">{(s && s.name) || 'Dhruv Patel'}</span>
                                    <span className="profile-roll-tag" id="heroRollBadge">Roll {(s && s.roll_number) || '235'}</span>
                                    <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '2px 9px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.22)', border: '1px solid rgba(16, 185, 129, 0.45)', color: '#6ee7b7', fontWeight: '700', letterSpacing: '0.02em' }}>Verified</span>
                                </h1>
                                <div className="profile-sub-pills" style={{ marginBottom: '6px' }}>
                                    <span id="heroCollegeName">{`${(s && s.college_name) || 'SAL Institute of Medical Sciences & Hospital'}${locPart}`}</span>
                                    <span>•</span>
                                    <span id="heroPostingUnit">{(s && s.posting_unit) || 'Community Medicine Unit 3'}</span>
                                    <span>•</span>
                                    <span style={{ color: '#6ee7b7', fontWeight: '650' }}>Active Field Posting</span>
                                    <span>•</span>
                                    <span className="referral-pill" id="heroReferralBadge" onClick={copyCadetReferralCode} title="Click to copy Patient Adoption Referral Code" style={{ cursor: 'pointer', background: 'rgba(14, 165, 233, 0.25)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#bae6fd', fontFamily: 'monospace', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>{`Ref: ${refCode ?? 'Pending'}`}</span>
                                </div>
                                <div className="profile-sub-pills" style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.88)', gap: '10px', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span>🎓</span>
                                        <span id="heroBatchYear">{(s && s.batch_year) || '3rd Year MBBS (PSM Batch 2024-25)'}</span>
                                    </span>
                                    <span>•</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span>🏥</span>
                                        <span id="heroDepartment">Community Medicine (PSM)</span>
                                    </span>
                                    <span>•</span>
                                    <a id="heroEmailLink" href={s && s.email ? `mailto:${s.email}` : 'mailto:dhruv.patel@medpulse.edu'} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#bae6fd', textDecoration: 'none' }} title="Institutional Email">
                                        <span>✉️</span>
                                        <span id="heroEmail">{(s && s.email) || 'dhruv.patel@medpulse.edu'}</span>
                                    </a>
                                    <span>•</span>
                                    <a id="heroPhoneLink" href={s && s.phone ? `tel:${s.phone}` : 'tel:+919876543210'} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#bae6fd', textDecoration: 'none' }} title="Official Contact Phone">
                                        <span>📞</span>
                                        <span id="heroPhone">{(s && s.phone) || '+91 98765 43210'}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className="profile-hero-actions">
                            <button className="btn btn-secondary" onClick={openEditProfileModal} style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)', color: '#fff', fontWeight: '650' }}>✏️ Edit Profile</button>
                            <button className="btn btn-secondary" onClick={() => { setPin({ cur: '', n1: '', n2: '' }); setPinOpen(true); }} style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)', color: '#fff', fontWeight: '650' }}>🔒 Change PIN</button>
                        </div>
                    </div>
                </div>
                <div className="card anim-fade-up" style={{ marginBottom: '24px', padding: '22px 26px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: '0' }}>📅</div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span>Attendance</span>
                                    <span className="badge" style={{ background: 'rgba(109, 40, 217, 0.08)', color: '#6d28d9', border: '1px solid rgba(109, 40, 217, 0.2)', fontSize: '0.74rem', padding: '3px 9px', borderRadius: '6px' }}>3rd Year MBBS (2026)</span>
                                </h2>
                            </div>
                        </div>
                        <div className="att-view-toggle-pill" id="profAttToggleGroup">
                            <button type="button" className={`btn-toggle-att${tab === 'overall' ? ' active' : ''}`} id="btnToggleOverall" onClick={() => setProfileAttendanceTab('overall')}>
                                <span>📊 Overall Summary</span>
                            </button>
                            <button type="button" className={`btn-toggle-att${tab === 'daywise' ? ' active' : ''}`} id="btnToggleDaywise" onClick={() => setProfileAttendanceTab('daywise')}>
                                <span>📅 Day-Wise Attendance</span>
                            </button>
                        </div>
                    </div>
                    <div id="profOverallView" style={tab === 'daywise' ? { display: 'none' } : undefined}>
                        <OverallAttendance data={subjectWise} />
                    </div>
                    <div id="profDaywiseView" style={{ display: tab === 'daywise' ? 'block' : 'none' }}>
                        <div className="datewise-container-card" style={{ marginBottom: '0' }}>
                            <div className="datewise-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                                <h2>Datewise Attendance</h2>
                                <a href="/schedule.html" style={{ color: '#ffffff', opacity: '0.92', fontSize: '0.8rem', fontWeight: '650', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span>Academic Schedule</span>
                                    <span>→</span>
                                </a>
                            </div>
                            <div className="datewise-body-content">
                                <div className="date-nav-row">
                                    <div className="date-input-pill">
                                        <input
                                            type="date" id="profDatewiseInput" ref={dateRef} value={dateInput}
                                            onChange={(e) => { setDateInput(e.target.value); if (e.target.value) loadDatewise(e.target.value); }}
                                        />
                                        <button type="button" className="date-calendar-btn" onClick={() => { const inp = dateRef.current; if (!inp) return; if (inp.showPicker) inp.showPicker(); else inp.focus(); }} title="Select date">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                        </button>
                                    </div>
                                    <button type="button" className="date-step-btn" onClick={() => loadDatewise(shiftIsoDay(dateIso, -1))} title="Previous Day">◀ Previous Day</button>
                                    <button type="button" className="date-step-btn" onClick={() => loadDatewise(TODAY)} title="View Today">Today</button>
                                    <button type="button" className="date-step-btn" onClick={() => loadDatewise(shiftIsoDay(dateIso, 1))} title="Next Day">Next Day ▶</button>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => openFillAttendance()}
                                            style={{
                                                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                                border: 'none',
                                                boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                                                fontWeight: '650',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }}
                                            title="View active attendance sessions"
                                        >
                                            📝 Fill Attendance
                                        </button>
                                    </div>
                                </div>
                                <div className="datewise-summary-strip">
                                    <span id="profDatewiseSemesterTag">{dw ? dw.semester || 'Semester - 5' : 'Semester - 5'}</span>
                                    <span className="strip-divider">|</span>
                                    <span>
                                        Date :{' '}
                                        <span id="profDatewiseFormattedLabel">{dw ? dw.date_formatted || datewise.iso : '28/09/2026'}</span>
                                    </span>
                                    <span className="strip-divider">|</span>
                                    <div className="summary-badge-group">
                                        <span>Total :</span>
                                        <span className="summary-badge-val total" id="profBadgeTotalLectures">{dw ? sm.total || 0 : 0}</span>
                                    </div>
                                    <div className="summary-badge-group">
                                        <span>Present :</span>
                                        <span className="summary-badge-val present" id="profBadgePresentCount">{dw ? (sm.present || 0) + (sm.field_duty || 0) : 0}</span>
                                    </div>
                                    <div className="summary-badge-group">
                                        <span>Absent :</span>
                                        <span className="summary-badge-val absent" id="profBadgeAbsentCount">{dw ? sm.absent || 0 : 0}</span>
                                    </div>
                                    <div className="summary-badge-group">
                                        <span>Leave :</span>
                                        <span className="summary-badge-val leave" id="profBadgeLeaveCount">{dw ? sm.leave || 0 : 0}</span>
                                    </div>
                                </div>
                                <div className="datewise-table-wrapper">
                                    <table className="datewise-table" id="profDatewiseTable">
                                        <thead>
                                            <tr>
                                                <th className="center" style={{ width: '100px' }}>Lecture No.</th>
                                                <th style={{ width: '100px' }}>Room No.</th>
                                                <th style={{ width: '130px' }}>Time</th>
                                                <th style={{ width: '130px' }}>Subject Code</th>
                                                <th>Subject Name</th>
                                                <th className="center" style={{ width: '140px' }}>Theory / Practical</th>
                                                <th style={{ width: '180px' }}>Faculty Name</th>
                                                <th className="center" style={{ width: '120px' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody id="profDatewiseTableBody">
                                            {datewise.error !== null ? (
                                                <tr>
                                                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#ef4444' }}>Failed to load attendance for this date. ({datewise.error})</td>
                                                </tr>
                                            ) : dw ? (
                                                <DatewiseTableBody lectures={dw.lectures || []} />
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>Loading datewise attendance...</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="profile-content-grid anim-fade-up">
                    <div className="profile-info-card" style={{ border: '1px solid rgba(14, 165, 233, 0.35)', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.06), rgba(99, 102, 241, 0.04))', position: 'relative', overflow: 'hidden', marginBottom: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: '750', margin: '0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🏷️ Patient Adoption Referral Code</span>
                                </h2>
                                <span className="badge badge-info" style={{ fontSize: '0.72rem', letterSpacing: '0.03em' }}>Cadet Key</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.45' }}>
                                Share this unique referral code with your adopted families. When they sign up or log in, they enter this code under{' '}
                                <strong>"Adopted by a Medical Cadet?"</strong>
                                {' '}to link their patient account to your survey records.
                            </p>
                            <div style={{ background: '#ffffff', border: '1.5px dashed #0284c7', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Your Adoption Code</div>
                                    <div id="cadetReferralCode" style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: '800', color: '#0284c7', letterSpacing: '0.06em' }}>{refCode ?? 'Loading...'}</div>
                                </div>
                                <button className="btn btn-secondary" id="copyReferralBtn" onClick={copyCadetReferralCode} style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0284c7', fontWeight: '700', fontSize: '0.82rem', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title="Copy code to clipboard">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    <span id="copyReferralText">{copied ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                            <span>💡 Automatically routes the patient's vitals &amp; consultations to your portfolio and institutional hospital.</span>
                        </div>
                    </div>
                    <div className="profile-info-card" style={{ marginBottom: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: '750', margin: '0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🔒 Access &amp; Security</span>
                                </h2>
                                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>PIN Protected</span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.45' }}>Your portal session is authenticated using your 4-digit Student PIN. Change your PIN anytime to maintain data security and clinical record privacy.</p>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Portal Access PIN</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.35em', color: 'var(--text-primary)' }}>••••</div>
                                </div>
                                <span className="badge badge-success">Active</span>
                            </div>
                        </div>
                        <button className="btn btn-secondary" onClick={() => { setPin({ cur: '', n1: '', n2: '' }); setPinOpen(true); }} style={{ width: '100%', justifyContent: 'center', marginTop: '10px', fontWeight: '650' }}>Update Access PIN</button>
                    </div>
                    <div className="profile-info-card" style={{ marginBottom: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: '750', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📄 Official Field Survey Proforma</span>
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.45' }}>Download the official Community Medicine (PSM) survey proforma containing all 43 columns, baseline socio-demographics, and latest clinical follow-up records.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            <button className="btn btn-secondary" id="cardExportCsvBtn" disabled={csvBusy} onClick={exportProformaCsv} style={{ width: '100%', justifyContent: 'center', fontWeight: '650', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{csvBusy ? '⏳ Generating CSV...' : '📥 Download Survey CSV (43 Cols)'}</button>
                            <button className="btn btn-primary" id="cardExportPdfBtn" disabled={pdfBusy} onClick={exportProformaPdf} style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', boxShadow: '0 4px 12px rgba(2,132,199,0.35)', fontWeight: '650', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{pdfBusy ? '⏳ Generating PDF...' : '📄 Download Polished PDF Report'}</button>
                            <button className="btn btn-primary" id="cardExportLogbookBtn" onClick={() => window.print()} style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', border: 'none', boxShadow: '0 4px 12px rgba(244,63,94,0.35)', fontWeight: '650', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>🖨️ Export Logbook</button>
                        </div>
                    </div>
                </div>
            </main>
            <EditProfileModal
                open={editOpen} form={form} setForm={setForm} saving={saving}
                emailField={emailField} phoneField={phoneField} emailRef={emailRef} phoneRef={phoneRef}
                onClose={() => setEditOpen(false)} onSubmit={submitEditProfile}
            />
            <ChangePinModal open={pinOpen} pin={pin} setPin={setPin} saving={pinSaving} onClose={() => setPinOpen(false)} onSubmit={submitChangePin} />
            <FillAttendanceModal
                open={fillAttOpen}
                session={selectedFillSession}
                onClose={() => setFillAttOpen(false)}
                onSuccess={handleFillSuccess}
            />
        </BodyPortal>
    );
}
