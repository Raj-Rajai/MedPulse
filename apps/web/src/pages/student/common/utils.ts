/** Small helpers the student pages repeated inline. */

/** The "data:text/csv" + encodeURI + temporary <a download> pattern. */
export function downloadCsvDataUri(csv: string, filename: string): void {
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/** Save a fetched Blob through a hidden <a download>, revoking the object URL after 1.5 s. */
export function downloadBlob(blob: Blob, filename: string): void {
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

/** Shift a YYYY-MM-DD date by whole days in local time. */
export function shiftIsoDay(iso: string, offset: number): string {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Run the callback now if the document is visible, otherwise once it becomes visible. */
export function runWhenActive(callback: () => void): () => void {
    if (document.visibilityState === 'visible') {
        callback();
        return () => {};
    }
    const onVisible = () => {
        if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', onVisible);
            callback();
        }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
}
