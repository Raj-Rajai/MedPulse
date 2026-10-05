/**
 * student/attendance.html: hero KPI ring, day-wise lecture sheet and the subject-wise table.
 */
import { useEffect, useRef, useState } from 'react';
import { BodyPortal, useStudentChrome } from '../common/Page';
import { MobileNavToggle, SidebarOverlay, StudentSidebar } from '../common/StudentSidebar';
import { SignInLink, StudentBadge, readAuthUser } from '../common/badges';
import { standardSidebar } from '../common/sidebar';
import { TOAST_PLAIN, useToasts } from '../common/Toasts';
import { DatewiseTableBody, type DatewiseData } from '../common/Datewise';
import { downloadCsvDataUri, errMsg, runWhenActive, shiftIsoDay } from '../common/utils';
import { MedPulseAuth } from '../../../shared/session';
import { SubjectRows, type AttSubject } from './SubjectRows';

const TODAY = '2026-09-28';

interface SubjectWise {
    student?: { roll_number?: string; name?: string; batch_year?: string };
    overall_summary?: { overall_percentage?: number; attended_classes?: number; total_classes?: number; eligible_subjects?: number; total_subjects?: number };
    subjects?: AttSubject[];
}

function logoutStudent() {
    MedPulseAuth.logout();
}

export function AttendanceApp() {
    useStudentChrome(standardSidebar);
    const { showToast, container: toasts } = useToasts(TOAST_PLAIN);
    const [user] = useState(readAuthUser);
    const dateIso = useRef(TODAY);
    const [dateInput, setDateInput] = useState('');
    const dateRef = useRef<HTMLInputElement>(null);
    const [dw, setDw] = useState<{ data: DatewiseData; iso: string } | null>(null);
    const [sw, setSw] = useState<SubjectWise | null>(null);
    const [subjects, setSubjects] = useState<AttSubject[] | null>(null);

    const loadDatewise = async (iso: string) => {
        dateIso.current = iso;
        setDateInput(iso);
        try {
            const res = await fetch(`/api/academic/attendance/datewise?date=${encodeURIComponent(iso)}`);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = (await res.json()) as DatewiseData;
            setDw({ data, iso });
        } catch (err) {
            console.error('Failed to load datewise attendance:', err);
            showToast('Error loading datewise attendance: ' + errMsg(err), 'error');
        }
    };

    const loadSubjectWiseTable = async () => {
        try {
            const res = await fetch('/api/academic/attendance/subject-wise');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = (await res.json()) as SubjectWise;
            setSw(data);
            setSubjects(data.subjects || []);
        } catch (err) {
            console.error('Failed to load subject-wise attendance:', err);
        }
    };

    useEffect(() => {
        return runWhenActive(() => {
            loadDatewise(TODAY);
            loadSubjectWiseTable();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const exportDatewiseCsv = () => {
        const lectures = dw?.data.lectures;
        if (!lectures || lectures.length === 0) {
            showToast('No datewise lectures to export.', 'error');
            return;
        }
        const headers = ['Lecture No', 'Room No', 'Time', 'Subject Code', 'Subject Name', 'Theory / Practical', 'Faculty Name', 'Status'];
        const rows = lectures.map((l) => [
            `"${l.lecture_no}"`,
            `"${l.room_no || ''}"`,
            `"${l.time}"`,
            `"${l.subject_code}"`,
            `"${(l.subject_name || '').replace(/"/g, '""')}"`,
            `"${l.theory_practical}"`,
            `"${(l.faculty_name || '').replace(/"/g, '""')}"`,
            `"${l.status}"`,
        ]);
        downloadCsvDataUri([headers.join(','), ...rows.map((e) => e.join(','))].join('\n'), `Datewise_Attendance_${dateIso.current}.csv`);
        showToast('Datewise CSV exported successfully!', 'success');
    };

    const exportSubjectWiseCsv = () => {
        if (!subjects || subjects.length === 0) {
            showToast('No subject data to export.', 'error');
            return;
        }
        const headers = ['Subject', 'Faculty In-Charge', 'Total Classes', 'Attended', 'Absent', 'Leave', 'Theory %', 'Practical %', 'Overall %', 'NMC Status'];
        const rows = subjects.map((s) => [
            `"${s.subject}"`,
            `"${s.faculty_name || ''}"`,
            `"${s.total}"`,
            `"${s.attended}"`,
            `"${s.absent}"`,
            `"${s.leave}"`,
            `"${s.theory.percentage}%"`,
            `"${s.practical.percentage}%"`,
            `"${s.overall_percentage}%"`,
            `"${s.nmc_status}"`,
        ]);
        downloadCsvDataUri([headers.join(','), ...rows.map((e) => e.join(','))].join('\n'), `Subject_Wise_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Subject-wise CSV exported successfully!', 'success');
    };

    const st = sw?.student;
    const ov = sw ? sw.overall_summary || {} : null;
    const pct = ov ? ov.overall_percentage || 0 : 0;
    let gaugeStyle: React.CSSProperties | undefined;
    if (ov) {
        const circumference = 2 * Math.PI * 42;
        gaugeStyle = {
            strokeDasharray: String(circumference),
            strokeDashoffset: String(circumference - (pct / 100) * circumference),
            stroke: pct >= 75 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444',
        };
    }
    const sm = dw?.data.summary || {};
    const roll = user ? String(user.roll_number || '235') : null;

    return (
        <BodyPortal>
            <SidebarOverlay onClose={standardSidebar.close} />
            <StudentSidebar
                active="attendance" onToggle={standardSidebar.toggle}
                badge={roll ? <StudentBadge roll={roll} mode="logout" onLogout={logoutStudent} /> : <SignInLink />}
            />
            <MobileNavToggle onToggle={standardSidebar.toggle} />
            {toasts}
        <main className="main-content">
            <div className="attendance-hero anim-fade-up">
                <div className="hero-split-grid">
                    <div className="hero-left-col">
                        <div className="profile-identity-group" style={{ marginBottom: "8px" }}>
                            <div className="profile-avatar-wrapper" style={{ width: "60px", height: "60px", borderRadius: "17px" }}>
                                <div className="profile-avatar-inner" style={{ fontSize: "1.6rem", borderRadius: "14px" }}>📅</div>
                                <div className="profile-badge-online" title="Active Semester" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: "1.4rem", fontWeight: "800", color: "#ffffff", marginBottom: "2px", display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span>Student Attendance Portal</span>
                                    <span className="profile-roll-tag" id="heroRollBadge">{st ? 'Roll ' + (st.roll_number || '235') : 'Roll 235'}</span>
                                </h1>
                                <div className="profile-sub-pills">
                                    <span id="heroCadetName">{st ? st.name || 'Dhruv Patel' : 'Dhruv Patel'}</span>
                                    <span>•</span>
                                    <span id="heroCadetBatch">{st ? st.batch_year || '3rd Year MBBS' : '3rd Year MBBS'}</span>
                                    <span>•</span>
                                    <span>Semester - 5</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                            <span className="badge" id="nmcStatusBadge" style={{ background: "rgba(16, 185, 129, 0.25)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.5)", fontSize: "0.78rem", padding: "4px 12px" }}>{"✅ NMC Compliance: ≥75% Theory & ≥80% Practical"}</span>
                        </div>
                    </div>
                    <div className="hero-gauge-box">
                        <div className="gauge-circle">
                            <svg viewBox="0 0 100 100">
                                <circle className="gauge-bg" cx="50" cy="50" r="42" />
                                <circle className="gauge-fill" id="gaugeCircleFill" cx="50" cy="50" r="42" strokeDasharray="264" strokeDashoffset="264" style={gaugeStyle} />
                            </svg>
                            <div className="gauge-text" id="gaugeTextVal">{ov ? pct + '%' : '--%'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>Aggregate Attendance</div>
                            <div style={{ fontSize: "1.15rem", fontWeight: "800", color: "#ffffff" }} id="heroAttendedFraction">{ov ? `${ov.attended_classes || 0} / ${ov.total_classes || 0} Classes` : '-- / -- Classes'}</div>
                            <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.75)" }} id="heroEligibleSubjectsCount">{ov ? `${ov.eligible_subjects || 0} of ${ov.total_subjects || 0} Subjects Eligible` : '-- Subjects Eligible'}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="datewise-container-card anim-fade-up">
                <div className="datewise-top-bar">
                    <h2>Datewise Attendance</h2>
                </div>
                <div className="datewise-body-content">
                    <div className="date-nav-row">
                        <div className="date-input-pill">
                            <input type="date" id="datewiseInput" ref={dateRef} value={dateInput} onChange={(e) => { setDateInput(e.target.value); if (e.target.value) loadDatewise(e.target.value); }} />
                            <button className="date-calendar-btn" onClick={() => { const inp = dateRef.current; if (!inp) return; if (inp.showPicker) inp.showPicker(); else inp.focus(); }} title="Select date">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </button>
                        </div>
                        <button className="date-step-btn" onClick={() => loadDatewise(shiftIsoDay(dateIso.current, -1))} title="Previous Day">◀ Previous Day</button>
                        <button className="date-step-btn" onClick={() => loadDatewise(TODAY)} title="View Today">Today</button>
                        <button className="date-step-btn" onClick={() => loadDatewise(shiftIsoDay(dateIso.current, 1))} title="Next Day">Next Day ▶</button>
                        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                            <button className="btn btn-secondary btn-sm" onClick={exportDatewiseCsv} title="Download Datewise CSV">📥 Export CSV</button>
                            <button className="btn btn-primary btn-sm" onClick={() => window.print()} title="Print Datewise Sheet">🖨️ Print</button>
                        </div>
                    </div>
                    <div className="datewise-summary-strip">
                        <span id="datewiseSemesterTag">{dw ? dw.data.semester || 'Semester - 5' : 'Semester - 5'}</span>
                        <span className="strip-divider">|</span>
                        <span>
                            Date :{' '}
                            <span id="datewiseFormattedLabel">{dw ? dw.data.date_formatted || dw.iso : '28/09/2026'}</span>
                        </span>
                        <span className="strip-divider">|</span>
                        <div className="summary-badge-group">
                            <span>Total :</span>
                            <span className="summary-badge-val total" id="badgeTotalLectures">{dw ? sm.total || 0 : 0}</span>
                        </div>
                        <div className="summary-badge-group">
                            <span>Present :</span>
                            <span className="summary-badge-val present" id="badgePresentCount">{dw ? (sm.present || 0) + (sm.field_duty || 0) : 0}</span>
                        </div>
                        <div className="summary-badge-group">
                            <span>Absent :</span>
                            <span className="summary-badge-val absent" id="badgeAbsentCount">{dw ? sm.absent || 0 : 0}</span>
                        </div>
                        <div className="summary-badge-group">
                            <span>Leave :</span>
                            <span className="summary-badge-val leave" id="badgeLeaveCount">{dw ? sm.leave || 0 : 0}</span>
                        </div>
                    </div>
                    <div className="datewise-table-wrapper">
                        <table className="datewise-table" id="datewiseTable">
                            <thead>
                                <tr>
                                    <th className="center" style={{ width: "100px" }}>Lecture No.</th>
                                    <th style={{ width: "100px" }}>Room No.</th>
                                    <th style={{ width: "130px" }}>Time</th>
                                    <th style={{ width: "130px" }}>Subject Code</th>
                                    <th>Subject Name</th>
                                    <th className="center" style={{ width: "140px" }}>Theory / Practical</th>
                                    <th style={{ width: "180px" }}>Faculty Name</th>
                                    <th className="center" style={{ width: "120px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody id="datewiseTableBody">
                                {dw ? (
                                    <DatewiseTableBody lectures={dw.data.lectures || []} variant="attendance" />
                                ) : (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>Loading datewise attendance...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="subject-card anim-fade-up">
                <div className="subject-card-header">
                    <div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: "800", margin: "0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>📚 Overall Attendance (Subject-Wise)</span>
                        </h2>
                        <p style={{ margin: "3px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>Comprehensive curriculum performance across all Phase III medical specialties</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={exportSubjectWiseCsv} title="Download Subject-Wise Attendance Breakdown">📥 Export Subjects CSV</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table className="subject-table" id="subjectWiseTable">
                        <thead>
                            <tr>
                                <th style={{ minWidth: "220px" }}>{"Subject & Faculty In-Charge"}</th>
                                <th style={{ textAlign: "center", width: "80px" }}>Total</th>
                                <th style={{ textAlign: "center", width: "90px" }}>Attended</th>
                                <th style={{ textAlign: "center", width: "100px" }}>Absent / Leave</th>
                                <th style={{ minWidth: "140px" }}>Theory Lectures</th>
                                <th style={{ minWidth: "140px" }}>Practical / Ward</th>
                                <th style={{ textAlign: "center", width: "100px" }}>Overall %</th>
                                <th style={{ textAlign: "center", width: "120px" }}>NMC Status</th>
                            </tr>
                        </thead>
                        <tbody id="subjectWiseTableBody">
                            {subjects === null ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>Loading subject-wise attendance analytics...</td>
                                </tr>
                            ) : (
                                <SubjectRows subjects={subjects} />
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
        </BodyPortal>
    );
}
