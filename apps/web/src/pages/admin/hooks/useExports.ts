/** Master CSV + Faculty Audit PDF downloads, shared by the header and the Exports tab. */
import { useCallback, useState } from 'react';
import { downloadBlob, errMessage, todayIso } from '../lib/http';
import type { ApiError } from '../types';
import type { ShowToast } from './useToasts';

export interface ExportButtons {
    csvBusy: boolean;
    pdfBusy: boolean;
    csvCollegeId: string;
    setCsvCollegeId: (v: string) => void;
    exportMasterCsv: () => void;
    exportFacultyPdf: () => void;
}

async function failure(res: Response): Promise<Error> {
    const errData = (await res.json().catch(() => ({}))) as ApiError;
    return new Error(errData.error || `Export failed with status ${res.status}`);
}

export function useExports(showToast: ShowToast): ExportButtons {
    const [csvBusy, setCsvBusy] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [csvCollegeId, setCsvCollegeId] = useState('');

    const exportMasterCsv = useCallback(async () => {
        try {
            setCsvBusy(true);
            showToast('Compiling master survey proforma CSV across all cadres...', 'info');
            const url = `/api/admin/export/all-csv${csvCollegeId ? '?college_id=' + encodeURIComponent(csvCollegeId) : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw await failure(res);
            await downloadBlob(res, `MedPulse_Master_Health_Survey_Compilation_${todayIso()}.csv`);
            showToast('Master Survey CSV downloaded successfully!', 'success');
        } catch (err) {
            console.error('Master CSV export failed:', err);
            showToast('Master export failed: ' + errMessage(err), 'error');
        } finally {
            setCsvBusy(false);
        }
    }, [csvCollegeId, showToast]);

    const exportFacultyPdf = useCallback(async () => {
        try {
            setPdfBusy(true);
            showToast('Generating official Faculty Surveillance Audit PDF Report...', 'info');
            const res = await fetch('/api/admin/export/audit-pdf');
            if (!res.ok) throw await failure(res);
            await downloadBlob(res, `MedPulse_Faculty_Surveillance_Audit_${todayIso()}.pdf`);
            showToast('Faculty Audit PDF downloaded successfully!', 'success');
        } catch (err) {
            console.error('Faculty PDF export failed:', err);
            showToast('Audit PDF failed: ' + errMessage(err), 'error');
        } finally {
            setPdfBusy(false);
        }
    }, [showToast]);

    return { csvBusy, pdfBusy, csvCollegeId, setCsvCollegeId, exportMasterCsv, exportFacultyPdf };
}
