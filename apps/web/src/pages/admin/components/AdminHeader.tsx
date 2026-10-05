import type { ExportButtons } from '../hooks/useExports';

export interface Heading { title: string; sub: string }

/** Top action bar: brand, dynamic heading for the active tab, and quick actions. */
export function AdminHeader({ heading, exports, onRegisterCadet, onRefresh }: {
    heading: Heading;
    exports: ExportButtons;
    onRegisterCadet: () => void;
    onRefresh: () => void;
}) {
    return (
        <div className="page-header anim-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/images/sal-logo.png" alt="SAL Logo" className="header-brand-logo" />
                <div>
                    <div className="admin-pill" style={{ marginBottom: 8 }}>
                        <span>👑</span> SAL Faculty &amp; Administrative Command Center
                    </div>{' '}
                    <h1 className="page-title page-title-animated" id="adminPageHeading">{heading.title}</h1>
                    <p className="page-subtitle" id="adminPageSubheading">{heading.sub}</p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={onRegisterCadet} style={{ fontWeight: 650 }}>
                    ➕ Register Cadet
                </button>
                <button className="btn btn-secondary" onClick={exports.exportMasterCsv} style={{ fontWeight: 650 }} id="topMasterCsvBtn" title="Download master 43-column CSV of all surveyed families" disabled={exports.csvBusy}>
                    {exports.csvBusy ? '⏳ Exporting...' : '📥 Master CSV'}
                </button>
                <button className="btn btn-primary" onClick={exports.exportFacultyPdf} style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', boxShadow: '0 4px 14px rgba(217,119,6,0.4)', fontWeight: 650 }} id="topFacultyPdfBtn" title="Download Faculty Audit PDF Report" disabled={exports.pdfBusy}>
                    {exports.pdfBusy ? '⏳ Generating...' : '📄 Faculty Audit PDF'}
                </button>
                <button className="btn btn-secondary" onClick={onRefresh} title="Refresh live statistics">
                    ↺ Refresh
                </button>
            </div>
        </div>
    );
}
