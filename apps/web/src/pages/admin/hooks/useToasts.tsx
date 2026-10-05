/** Toast notifications (showToast in the original admin page). */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';
export type ShowToast = (message: string, type?: ToastType, duration?: number) => void;

interface ToastItem { id: number; message: string; type: ToastType; leaving: boolean }

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
    return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const remove = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

    const showToast = useCallback<ShowToast>((message, type = 'info', duration = 3200) => {
        const id = nextId.current++;
        setToasts((list) => [...list, { id, message, type, leaving: false }]);
        setTimeout(() => {
            setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
            setTimeout(() => remove(id), 220);
        }, duration);
    }, [remove]);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className="toast-container" id="toastContainer">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.type}`}
                        style={t.leaving ? { opacity: '0', transform: 'translateY(10px)', transition: 'all 0.2s ease' } : undefined}
                    >
                        <span>{t.message}</span>
                        <button className="toast-close" onClick={() => remove(t.id)} title="Dismiss">✕</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
