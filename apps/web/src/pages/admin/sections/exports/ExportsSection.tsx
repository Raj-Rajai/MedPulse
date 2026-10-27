import type { ExportButtons } from '../../hooks/useExports';

/** VIEW 5: Master data exports (CSV + faculty audit PDF). */
export function ExportsSection({ active, exports }: { active: boolean; exports: ExportButtons }) {
    return (
        <div id="viewExports" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="mm-grid-2">
                {/* Export 1: Master 43-Column Survey CSV */}
                <div className="card export-card mm-export">
                    <div className="mm-export-head">
                        <span className="kpi-icon">📥</span>
                        <div>
                            <h2 className="card-title">Master survey CSV</h2>
                            <span className="mm-sub">All students combined</span>
                        </div>
                    </div>
                    <p className="card-desc">
                        Every surveyed family from every student in one CSV, with all 43 Community Medicine proforma columns and the latest follow-up values.
                    </p>
                    <button className="btn btn-primary" id="btnMasterCsvDownload" onClick={exports.exportMasterCsv} disabled={exports.csvBusy}>
                        {exports.csvBusy ? '⏳ Generating CSV...' : '📥 Download master CSV'}
                    </button>
                </div>

                {/* Export 2: Faculty Clinical Surveillance Audit PDF */}
                <div className="card export-card mm-export">
                    <div className="mm-export-head">
                        <span className="kpi-icon">📄</span>
                        <div>
                            <h2 className="card-title">Faculty audit PDF</h2>
                            <span className="mm-sub">Official academic report</span>
                        </div>
                    </div>
                    <p className="card-desc">
                        An A4 landscape report of student survey quotas, household completion and community disease burden (HTN, DM, anaemia).
                    </p>
                    <button className="btn btn-primary" id="btnFacultyPdfDownload" onClick={exports.exportFacultyPdf} disabled={exports.pdfBusy}>
                        {exports.pdfBusy ? '⏳ Generating PDF...' : '📄 Download audit PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
}
