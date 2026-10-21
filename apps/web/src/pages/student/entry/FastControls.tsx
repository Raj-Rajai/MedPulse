import type { ReactNode } from 'react';

export interface YesNoToggleProps {
    id?: string;
    label?: string;
    value: string;
    onChange: (val: 'Y' | 'N') => void;
    disabled?: boolean;
}

/**
 * Compact, keyboard-friendly two-option segmented control for Yes/No.
 * Master Prompt Section 7 & 68: Prefer compact two-option control, do not use large dropdowns.
 */
export function YesNoToggle({ id, value, onChange, disabled }: YesNoToggleProps) {
    const isYes = value === 'Y' || value === 'Yes' || value === 'true';
    const isNo = value === 'N' || value === 'No' || value === 'false';

    return (
        <div id={id} className="fast-yes-no-group" style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #dce5dd', overflow: 'hidden', height: '38px', background: '#ffffff', width: '100%', boxSizing: 'border-box' }}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange('Y')}
                style={{
                    flex: 1,
                    border: 'none',
                    padding: '0 12px',
                    fontSize: '0.825rem',
                    fontWeight: isYes ? 700 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: isYes ? 'var(--primary)' : 'transparent',
                    color: isYes ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                }}
            >
                Yes
            </button>
            <div style={{ width: '1px', background: '#e2e8f0' }} />
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange('N')}
                style={{
                    flex: 1,
                    border: 'none',
                    padding: '0 12px',
                    fontSize: '0.825rem',
                    fontWeight: isNo ? 700 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: isNo ? 'var(--primary)' : 'transparent',
                    color: isNo ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                }}
            >
                No
            </button>
        </div>
    );
}

export interface SegmentedControlProps<T extends string> {
    id?: string;
    options: readonly { label: string; value: T; badge?: string }[];
    value: T;
    onChange: (val: T) => void;
    disabled?: boolean;
}

/**
 * Compact segmented control for fixed choices (M/F/TG, Sedentary/Moderate/Heavy, etc.)
 */
export function SegmentedControl<T extends string>({ id, options, value, onChange, disabled }: SegmentedControlProps<T>) {
    return (
        <div id={id} className="fast-segmented-group" style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #dce5dd', overflow: 'hidden', height: '38px', maxWidth: '100%', background: '#ffffff', boxSizing: 'border-box' }}>
            {options.map((opt, idx) => {
                const active = value === opt.value;
                return (
                    <div key={opt.value} style={{ display: 'inline-flex', flex: 1 }}>
                        {idx > 0 && <div style={{ width: '1px', background: '#e2e8f0' }} />}
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(opt.value)}
                            style={{
                                border: 'none',
                                padding: '0 12px',
                                fontSize: '0.8rem',
                                fontWeight: active ? 700 : 500,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                background: active ? 'var(--primary)' : 'transparent',
                                color: active ? '#ffffff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                                width: '100%',
                            }}
                        >
                            {opt.label}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export interface FormFieldProps {
    label: string;
    sublabel?: string;
    badge?: string;
    children: ReactNode;
    style?: React.CSSProperties;
}

export function FormField({ label, sublabel, badge, children, style }: FormFieldProps) {
    return (
        <div className="form-group" style={style}>
            <label>
                <span>
                    {label}
                    {sublabel && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>({sublabel})</span>}
                </span>
                {badge && <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '1px 5px', marginLeft: 'auto' }}>{badge}</span>}
            </label>
            {children}
        </div>
    );
}

export interface AccordionSectionHeaderProps {
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
    isClosed: boolean;
    onToggle: (id: string) => void;
    style?: React.CSSProperties;
}

/**
 * Clean accordion header matching the MedPulse journal aesthetics.
 */
export function AccordionSectionHeader({ id, title, subtitle, badge, isClosed, onToggle, style }: AccordionSectionHeaderProps) {
    return (
        <div
            id={`accordionHeader_${id}`}
            onClick={() => onToggle(id)}
            role="button"
            tabIndex={0}
            aria-expanded={!isClosed}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(id); } }}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                marginTop: '0',
                marginBottom: isClosed ? '0' : '12px',
                background: '#f5f0ff',
                border: '1.5px solid #e9d5ff',
                borderRadius: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                gap: '12px',
                ...style,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
                <span style={{
                    width: '4px',
                    height: '20px',
                    backgroundColor: 'var(--primary)',
                    borderRadius: '2px',
                    display: 'inline-block',
                    flexShrink: 0,
                }} />
                <h3 style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 750,
                    color: 'var(--primary)',
                    letterSpacing: '-0.01em',
                }}>
                    {title}
                </h3>
                {badge && (
                    <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 7px', fontWeight: 600 }}>
                        {badge}
                    </span>
                )}
                {subtitle && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {subtitle}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{isClosed ? 'Show' : 'Hide'}</span>
                <span style={{
                    fontSize: '0.72rem',
                    display: 'inline-block',
                    transform: isClosed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                }}>▼</span>
            </div>
        </div>
    );
}
