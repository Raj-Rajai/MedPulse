/**
 * MedPulse universal form validation (port of frontend/shared/validation.js, window.MedPulseValidation).
 *
 * - `validatePhone` / `validateEmail` are the same pure checks with the same messages.
 * - `useValidatedField` replaces attachPhone/attachEmail + showError/showValid/clearValidation:
 *   it keeps the field's validation state and gives the input's className and the hint
 *   spans to render, so the DOM matches what the original helpers produced
 *   (`is-invalid input-invalid` / `is-valid input-valid` on the input, a
 *   `span.validation-error-hint` / `span.validation-success-hint` appended after it inside the
 *   same parent, and kept with display:none once created).
 */
import { createElement, Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';

export interface ValidationResult {
    valid: boolean;
    clean: string;
    error: string;
}

/**
 * Clean and validate a 10-digit mobile/phone number.
 * Allows optional +91 / 91 / 0 prefix, spaces, and hyphens.
 */
export function validatePhone(phone: string | number | null | undefined, allowEmpty = true): ValidationResult {
    if (!phone || !phone.toString().trim()) {
        if (allowEmpty) return { valid: true, clean: '', error: '' };
        return { valid: false, clean: '', error: 'Phone number is required.' };
    }

    const raw = phone.toString().trim();
    let clean = raw.replace(/[\s\-().]/g, '');

    if (clean.startsWith('+91') && clean.length === 13) {
        clean = clean.substring(3);
    } else if (clean.startsWith('91') && clean.length === 12 && /^[6-9]/.test(clean.substring(2))) {
        clean = clean.substring(2);
    } else if (clean.startsWith('0') && clean.length === 11 && /^[6-9]/.test(clean.substring(1))) {
        clean = clean.substring(1);
    }

    if (!/^\d+$/.test(clean)) {
        return { valid: false, clean, error: 'Phone number must contain only numeric digits.' };
    }
    if (clean.length !== 10) {
        return { valid: false, clean, error: `Phone number must be exactly 10 digits (currently ${clean.length} digits).` };
    }
    if (!/^[6-9]\d{9}$/.test(clean)) {
        return { valid: false, clean, error: 'Please enter a valid 10-digit mobile number (starts with 6, 7, 8, or 9).' };
    }
    return { valid: true, clean, error: '' };
}

/** Validate an email address. */
export function validateEmail(email: string | null | undefined, allowEmpty = true): ValidationResult {
    if (!email || !email.toString().trim()) {
        if (allowEmpty) return { valid: true, clean: '', error: '' };
        return { valid: false, clean: '', error: 'Email address is required.' };
    }
    const clean = email.toString().trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean)) {
        return { valid: false, clean, error: 'Please enter a valid email address (e.g. doctor@medpulse.edu).' };
    }
    return { valid: true, clean, error: '' };
}

/** Same object shape as the original global, for code that wants the pure checks by name. */
export const MedPulseValidation = { validatePhone, validateEmail };

export type FieldKind = 'phone' | 'email';
type Status = 'none' | 'invalid' | 'valid';

interface FieldState {
    status: Status;
    /** null = hint span not created yet; otherwise its text and whether it is shown. */
    errorHint: { text: string; shown: boolean } | null;
    successHint: { text: string; shown: boolean } | null;
}

export interface ValidatedField {
    /** Class names for the input (merge with the input's own classes, if any). */
    className: string | undefined;
    /** Extra input attributes attachPhone() set (inputmode / maxlength). */
    inputProps: { inputMode?: 'numeric'; maxLength?: number };
    /** Real-time handler (the original listened to `input` and `blur`). */
    onInput: (value: string) => void;
    /** The hint spans; render right after the input inside the same parent. */
    hints: ReactNode;
    showError: (msg: string) => void;
    showValid: (msg?: string) => void;
    clear: () => void;
}

/**
 * React replacement for MedPulseValidation.attachPhone / attachEmail(input, allowEmpty).
 * Pass `attached = false` to get only showError/showValid/clear (no live validation).
 */
export function useValidatedField(kind: FieldKind, allowEmpty = true, attached = true): ValidatedField {
    const [state, setState] = useState<FieldState>({ status: 'none', errorHint: null, successHint: null });

    const showError = useCallback((msg: string) => {
        setState((s) => ({
            status: 'invalid',
            errorHint: { text: msg, shown: true },
            successHint: s.successHint ? { ...s.successHint, shown: false } : null,
        }));
    }, []);

    const showValid = useCallback((msg?: string) => {
        setState((s) => ({
            status: 'valid',
            errorHint: s.errorHint ? { ...s.errorHint, shown: false } : null,
            successHint: msg ? { text: msg, shown: true } : s.successHint,
        }));
    }, []);

    const clear = useCallback(() => {
        setState((s) => ({
            status: 'none',
            errorHint: s.errorHint ? { ...s.errorHint, shown: false } : null,
            successHint: s.successHint ? { ...s.successHint, shown: false } : null,
        }));
    }, []);

    const onInput = useCallback(
        (value: string) => {
            if (!attached) return;
            const val = value.trim();
            if (!val && allowEmpty) {
                clear();
                return;
            }
            const res = kind === 'phone' ? validatePhone(val, allowEmpty) : validateEmail(val, allowEmpty);
            if (!res.valid) showError(res.error);
            else showValid();
        },
        [attached, allowEmpty, kind, clear, showError, showValid],
    );

    const className = state.status === 'invalid' ? 'is-invalid input-invalid' : state.status === 'valid' ? 'is-valid input-valid' : undefined;

    const hints = useMemo(
        () =>
            createElement(
                Fragment,
                null,
                state.errorHint &&
                    createElement('span', { key: 'e', className: 'validation-error-hint', style: { display: state.errorHint.shown ? 'block' : 'none' } }, state.errorHint.text),
                state.successHint &&
                    createElement('span', { key: 's', className: 'validation-success-hint', style: { display: state.successHint.shown ? 'block' : 'none' } }, state.successHint.text),
            ),
        [state.errorHint, state.successHint],
    );

    const inputProps = attached && kind === 'phone' ? { inputMode: 'numeric' as const, maxLength: 14 } : {};

    return { className, inputProps, onInput, hints, showError, showValid, clear };
}
