/**
 * Controlled <select> that behaves like assigning `select.value = x` in the original pages:
 * when no option has that value the browser shows no selection (selectedIndex -1) and
 * `select.value` reads as ''. React would instead fall back to the first option, so the
 * index is reset after every commit; `selectValue()` gives the value the original read back.
 */
import { useLayoutEffect, useRef, type SelectHTMLAttributes } from 'react';

export type Option = readonly [value: string, label: string];

/** What `select.value` returned in the original after assigning `value`. */
export const selectValue = (options: readonly Option[], value: string) => (options.some(([v]) => v === value) ? value : '');

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
    options: readonly Option[];
    value: string;
    onValue: (value: string) => void;
}

export function Select({ options, value, onValue, ...rest }: Props) {
    const ref = useRef<HTMLSelectElement>(null);
    const matched = options.some(([v]) => v === value);
    useLayoutEffect(() => {
        if (!matched && ref.current) ref.current.selectedIndex = -1;
    });
    return (
        <select ref={ref} {...rest} value={matched ? value : ''} onChange={(e) => onValue(e.target.value)}>
            {options.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
            ))}
        </select>
    );
}
