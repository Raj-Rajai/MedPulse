/**
 * Toast notifications. Every student page had its own showToast() with slightly different
 * markup and timings; `ToastStyle` captures those differences so the DOM and the fade match.
 */
import { useCallback, useRef, useState } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastStyle {
    /** Render the ✕ close button after the message. */
    close: boolean;
    /** profile / family-manage built the toast from a template literal with newlines around the children. */
    spaced?: boolean;
    duration: number;
    /** translateY applied with the fade (px); undefined = opacity only. */
    shift?: number;
    removeAfter: number;
}

export const TOAST_PROFILE: ToastStyle = { close: true, spaced: true, duration: 3200, shift: 10, removeAfter: 200 };
export const TOAST_PLAIN: ToastStyle = { close: false, duration: 3500, removeAfter: 300 };
export const TOAST_ENTRY: ToastStyle = { close: true, duration: 3500, shift: 12, removeAfter: 250 };
export const TOAST_INDEX: ToastStyle = { close: true, duration: 3200, shift: 10, removeAfter: 250 };

interface ToastItem {
    id: number;
    message: string;
    type: string;
    fading: boolean;
}

export type ShowToast = (message: string, type?: ToastType | string, duration?: number) => void;

export function useToasts(cfg: ToastStyle) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const seq = useRef(0);
    const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
    const showToast = useCallback<ShowToast>(
        (message, type = 'info', duration = cfg.duration) => {
            const id = ++seq.current;
            setToasts((t) => [...t, { id, message, type, fading: false }]);
            setTimeout(() => {
                setToasts((t) => t.map((x) => (x.id === id ? { ...x, fading: true } : x)));
                setTimeout(() => remove(id), cfg.removeAfter);
            }, duration);
        },
        [cfg, remove],
    );
    const container = (
        <div id="toastContainer" className="toast-container">
            {toasts.map((t) => (
                <div
                    key={t.id} className={`toast toast-${t.type}`}
                    style={t.fading ? { opacity: '0', ...(cfg.shift !== undefined ? { transform: `translateY(${cfg.shift}px)` } : {}) } : undefined}
                >
                    {cfg.spaced ? ' ' : null}
                    <span>{t.message}</span>
                    {cfg.close ? (
                        <>
                            {cfg.spaced ? ' ' : null}
                            <button className="toast-close" onClick={() => remove(t.id)}>✕</button>
                        </>
                    ) : null}
                    {cfg.spaced ? ' ' : null}
                </div>
            ))}
        </div>
    );
    return { showToast, container };
}
