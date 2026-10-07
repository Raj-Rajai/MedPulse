import type { ExportButtons } from '../../hooks/useExports';
import type { CollegeStat } from '../../types';

/** VIEW 5: Master data exports (CSV + faculty audit PDF). */
export function ExportsSection({ active, exports, collegeOptions }: { active: boolean; exports: ExportButtons; collegeOptions: CollegeStat[] | null }) {
    return (
        <div id="viewExports" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
                {/* Export 1: Master 43-Column Survey CSV */}
                <div className="card export-card" style={{ borderTop: '4px solid #0284c7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.6rem' }}>📥</span>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)' }}>Master Survey Proforma CSV</h2>
                            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>All Cadres Combined</span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                        Generates the complete RFC 4180 CSV containing all 43 standard Community Medicine columns for <strong>all surveyed families across all medical students</strong>, resolved with latest follow-up parameters.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Filter by Medical College (Optional):</label>
                        <select id="exportCsvCollegeSelect" value={exports.csvCollegeId} onChange={(e) => exports.setCsvCollegeId(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff' }}>
                            <option value="">All Medical Colleges Combined</option>
                            {(collegeOptions || []).map((c) => <option key={c.id} value={c.id}>{c.name || ''}</option>)}
                        </select>
                    </div>
                    <button className="btn btn-primary" id="btnMasterCsvDownload" onClick={exports.exportMasterCsv} disabled={exports.csvBusy} style={{ width: '100%', justifyContent: 'center', fontWeight: 650, gap: 8 }}>
                        {exports.csvBusy ? '⏳ Generating Master CSV...' : '📥 Download Master Survey CSV'}
                    </button>
                </div>

                {/* Export 2: Faculty Clinical Surveillance Audit PDF */}
                <div className="card export-card" style={{ borderTop: '4px solid #d97706' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.6rem' }}>📄</span>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 750, margin: 0, color: 'var(--text-primary)' }}>Faculty Surveillance Audit PDF</h2>
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Official Academic Report</span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                        Generates a high-fidelity A4 Landscape clinical report summarizing cadet survey quotas, household completion metrics, and community disease burden (HTN, DM, Anemia).
                    </p>
                    <div style={{ height: 52 }}></div>
                    <button className="btn btn-primary" id="btnFacultyPdfDownload" onClick={exports.exportFacultyPdf} disabled={exports.pdfBusy} style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)', fontWeight: 650, gap: 8 }}>
                        {exports.pdfBusy ? '⏳ Generating Audit PDF...' : '📄 Download Faculty Audit PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
}
