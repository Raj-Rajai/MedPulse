/**
 * The gradient header card at the top of every student page (profile, schedule, exams, attendance).
 * One markup for all pages; the look lives in styles/page-hero.css.
 */
import type { ReactNode } from 'react';

export type HeroTone = 'green' | 'blue' | 'amber' | 'violet';

export interface HeroFact {
    /** Short label shown above the value ("Standing", "University exam"). */
    label: string;
    value: ReactNode;
    icon?: string;
    tone?: HeroTone;
    id?: string;
    title?: string;
    onClick?: () => void;
}

export interface HeroStat {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    /** Optional visual next to the number (the attendance ring). */
    visual?: ReactNode;
    valueId?: string;
    subId?: string;
}

function greeting(name?: string): string {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const first = (name || '').trim().split(/\s+/)[0];
    return first ? `${part}, ${first}` : part;
}

export function PageHero(props: {
    icon: ReactNode;
    title: ReactNode;
    titleId?: string;
    /** Student's full name, used for the greeting line. */
    name?: string;
    /** Small items under the title, joined with dots. */
    meta: ReactNode[];
    facts?: HeroFact[];
    stat?: HeroStat;
    /** Extra rows (profile contact links). */
    children?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    const { icon, title, titleId, name, meta, facts = [], stat, children, actions, className } = props;
    return (
        <section className={`ph anim-fade-up${className ? ' ' + className : ''}`}>
            <div className="ph-head">
                <div className="ph-icon" aria-hidden="true">{icon}</div>
                <div className="ph-text">
                    <p className="ph-greeting">{greeting(name)}</p>
                    <h1 className="ph-title" id={titleId}>{title}</h1>
                    <p className="ph-meta">
                        {meta.filter(Boolean).map((m, i) => (
                            <span key={i} className="ph-meta-item">{m}</span>
                        ))}
                    </p>
                </div>
            </div>
            {stat && (
                <div className="ph-stat">
                    {stat.visual}
                    <div className="ph-stat-text">
                        <span className="ph-stat-label">{stat.label}</span>
                        <span className="ph-stat-value" id={stat.valueId}>{stat.value}</span>
                        {stat.sub != null && <span className="ph-stat-sub" id={stat.subId}>{stat.sub}</span>}
                    </div>
                </div>
            )}
            {facts.length > 0 && (
                <ul className="ph-facts">
                    {facts.map((f, i) => {
                        const inner = (
                            <>
                                {f.icon && <span className="ph-fact-icon" aria-hidden="true">{f.icon}</span>}
                                <span className="ph-fact-text">
                                    <span className="ph-fact-label">{f.label}</span>
                                    <span className="ph-fact-value">{f.value}</span>
                                </span>
                            </>
                        );
                        return (
                            <li key={i} className={`ph-fact ph-tone-${f.tone || 'violet'}`} id={f.id} title={f.title}>
                                {f.onClick ? <button type="button" className="ph-fact-btn" onClick={f.onClick}>{inner}</button> : inner}
                            </li>
                        );
                    })}
                </ul>
            )}
            {children}
            {actions && <div className="ph-actions">{actions}</div>}
        </section>
    );
}
