/** Inline stroke icons, ported from the `paths` table + icon() helper in hospital-ui.js. */
const paths = {
    pulse: 'M2 12h4l3-8 6 16 3-8h4', grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
    calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 10h18 M7 14h2 M12 14h2 M7 17h2',
    bed: 'M3 4v17 M21 12v9 M3 17h18 M3 12h18 M7 8h3v4H7z M13 8h5a3 3 0 0 1 3 3v1h-8z',
    staff: 'M6 3v6a6 6 0 0 0 12 0V3 M4 3h4 M16 3h4 M12 15v3a4 4 0 0 0 8 0v-3 M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    building: 'M5 21V4h14v17 M3 21h18 M9 21v-5h6v5 M9 8h1 M14 8h1 M9 12h1 M14 12h1',
    chart: 'M3 3v18h18 M7 16v-4 M12 16V7 M17 16v-7', shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',
    logout: 'M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4', chevron: 'm9 5 6 7-6 7', menu: 'M3 6h18 M3 12h18 M3 18h18',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4', download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
    plus: 'M12 5v14 M5 12h14',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6', close: 'm6 6 12 12 M18 6 6 18',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2', alert: 'm12 3 10 18H2z M12 9v5 M12 17v1',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
    return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] || paths.pulse} /></svg>;
}

/** `<span data-icon="…">` placeholder after icons() filled it. */
export function IconSpan({ name }: { name: IconName }) {
    return <span data-icon={name}><Icon name={name} /></span>;
}
