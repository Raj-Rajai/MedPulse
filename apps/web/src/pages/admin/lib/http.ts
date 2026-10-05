import type { ApiError } from '../types';

/** POST/PUT/DELETE with a JSON body, the way every write in the original page was sent. */
export function sendJson(url: string, method: 'POST' | 'PUT', body: unknown): Promise<Response> {
    return fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function readJson<T>(res: Response): Promise<T & ApiError> {
    return (await res.json()) as T & ApiError;
}

export const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Programmatic, non-navigating file download (exportMasterCsv / exportFacultyPdf). */
export async function downloadBlob(res: Response, filename: string): Promise<void> {
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
    }, 1500);
}

export const todayIso = () => new Date().toISOString().split('T')[0];
export const datePart = (s?: string | null) => (s ? s.split(' ')[0] : '');

/** Briefly highlight a row after jumping to it from the cadet roster (quickOpenStudent*). */
export function flashRow(rowId: string): void {
    setTimeout(() => {
        const row = document.getElementById(rowId);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.background = '#fef3c7';
            setTimeout(() => {
                row.style.background = '';
            }, 2500);
        }
    }, 350);
}
