import type { CSSProperties, ReactNode } from 'react';

/** `.modal-overlay` shell: always in the DOM, shown with display:flex, closes on backdrop click. */
export function ModalOverlay({ id, open, onClose, contentStyle, children }: {
    id: string;
    open: boolean;
    onClose: () => void;
    contentStyle: CSSProperties;
    children: ReactNode;
}) {
    return (
        <div id={id} className="modal-overlay" style={{ display: open ? 'flex' : 'none' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-content" style={contentStyle}>{children}</div>
        </div>
    );
}

export const closeBtnStyle: CSSProperties = { fontSize: '0.8rem', padding: '0.25rem 0.5rem' };
export const modalHeadStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' };
export const modalFootStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem' };
export const twoColStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
export const loadingCellStyle = (padding: number, color = 'var(--text-muted)'): CSSProperties => ({ textAlign: 'center', color, padding });

/** A single full-width message row in a table body. */
export function MessageRow({ colSpan, padding, color, children }: { colSpan: number; padding: number; color?: string; children: ReactNode }) {
    return (
        <tr><td colSpan={colSpan} style={loadingCellStyle(padding, color)}>{children}</td></tr>
    );
}
