import { useCallback, useState } from 'react';

/** Open/close state for one modal plus the data it was opened with. `nonce` changes on every open. */
export interface ModalState<T> {
    open: boolean;
    data: T | null;
    nonce: number;
    show: (data: T) => void;
    hide: () => void;
}

export function useModal<T = true>(): ModalState<T> {
    const [state, setState] = useState<{ open: boolean; data: T | null; nonce: number }>({ open: false, data: null, nonce: 0 });
    const show = useCallback((data: T) => setState((s) => ({ open: true, data, nonce: s.nonce + 1 })), []);
    const hide = useCallback(() => setState((s) => ({ ...s, open: false })), []);
    return { ...state, show, hide };
}
