/**
 * Admin data table with Excel-style column filters (value checklist, search, sort) and pagination.
 * Filtering, sorting and paging all happen on the rows already loaded in the page.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface Column<T> {
    key: string;
    label: string;
    /** Text used for filtering, sorting and the filter checklist. */
    value: (row: T) => string | number | null | undefined;
    render?: (row: T) => ReactNode;
    align?: 'left' | 'center' | 'right';
    /** Numeric sort for count columns. */
    numeric?: boolean;
    filterable?: boolean;
    width?: number | string;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

const BLANK = '(Blanks)';
const PAGE_SIZES = [10, 25, 50, 100];

const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? BLANK : String(v));

function FilterIcon({ active }: { active: boolean }) {
    return active ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
    ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    );
}

function FilterMenu({ anchor, values, selected, sort, onApply, onSort, onClose }: {
    anchor: DOMRect;
    values: string[];
    selected: Set<string> | null;
    sort: 'asc' | 'desc' | null;
    onApply: (sel: Set<string> | null) => void;
    onSort: (dir: 'asc' | 'desc') => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState('');
    const [draft, setDraft] = useState<Set<string>>(() => new Set(selected ?? values));
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        window.addEventListener('resize', onClose);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', esc);
            window.removeEventListener('resize', onClose);
        };
    }, [onClose]);

    const shown = values.filter((v) => v.toLowerCase().includes(q.toLowerCase().trim()));
    const allShown = shown.length > 0 && shown.every((v) => draft.has(v));

    const toggle = (v: string) => setDraft((d) => {
        const n = new Set(d);
        if (n.has(v)) n.delete(v); else n.add(v);
        return n;
    });
    const toggleAll = () => setDraft((d) => {
        const n = new Set(d);
        shown.forEach((v) => (allShown ? n.delete(v) : n.add(v)));
        return n;
    });
    const apply = () => {
        // While searching, Excel keeps only the matching values that are ticked.
        const sel = q.trim() ? new Set(shown.filter((v) => draft.has(v))) : draft;
        onApply(sel.size === values.length ? null : sel);
        onClose();
    };

    // Portalled to <body> (as an <aside>, which style.css lets through) and fixed to the viewport,
    // because <main> is a size container and the table scrolls: either would clip it otherwise.
    const width = 260;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - 400));

    return createPortal(
        <aside className="dt-menu" ref={ref} style={{ top, left, width }} role="dialog" aria-label="Column filter" onClick={(e) => e.stopPropagation()}>
            <button type="button" className={`dt-menu-item${sort === 'asc' ? ' on' : ''}`} onClick={() => { onSort('asc'); onClose(); }}>Sort A to Z</button>
            <button type="button" className={`dt-menu-item${sort === 'desc' ? ' on' : ''}`} onClick={() => { onSort('desc'); onClose(); }}>Sort Z to A</button>
            <button type="button" className="dt-menu-item" disabled={!selected} onClick={() => { onApply(null); onClose(); }}>Clear filter</button>
            <div className="dt-menu-sep" />
            <input className="dt-menu-search" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <div className="dt-menu-list">
                <label className="dt-check"><input type="checkbox" checked={allShown} onChange={toggleAll} /><span>(Select all{q.trim() ? ' search results' : ''})</span></label>
                {shown.map((v) => (
                    <label className="dt-check" key={v}><input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} /><span>{v}</span></label>
                ))}
                {shown.length === 0 && <div className="dt-menu-empty">No matches</div>}
            </div>
            <div className="dt-menu-foot">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={draft.size === 0}>OK</button>
            </div>
        </aside>,
        document.body,
    );
}

export function DataTable<T>({ id, columns, rows, rowKey, loadingText, emptyText, resetKey }: {
    id?: string;
    columns: Column<T>[];
    rows: T[] | null;
    rowKey: (row: T, index: number) => string | number;
    loadingText: string;
    emptyText: string;
    /** Changing this clears the column filters (for example when the page's own filters change). */
    resetKey?: string;
}) {
    const [filters, setFilters] = useState<Record<string, Set<string>>>({});
    const [sort, setSort] = useState<Sort>(null);
    const [open, setOpen] = useState<{ key: string; anchor: DOMRect } | null>(null);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(10);

    useEffect(() => { setFilters({}); }, [resetKey]);
    useEffect(() => { setPage(1); }, [rows, filters, sort, size]);

    const colOf = (key: string) => columns.find((c) => c.key === key)!;
    const passes = (row: T, except?: string) =>
        Object.entries(filters).every(([key, sel]) => key === except || sel.has(text(colOf(key).value(row))));

    const filtered = useMemo(() => {
        const out = (rows || []).filter((r) => passes(r));
        if (!sort) return out;
        const col = colOf(sort.key);
        const sign = sort.dir === 'asc' ? 1 : -1;
        return [...out].sort((a, b) => {
            const va = col.value(a), vb = col.value(b);
            if (col.numeric) return (Number(va || 0) - Number(vb || 0)) * sign;
            return text(va).localeCompare(text(vb), undefined, { numeric: true, sensitivity: 'base' }) * sign;
        });
    }, [rows, filters, sort, columns]);

    /** Checklist values for a column: what is left after every other column's filter, like Excel. */
    const valuesFor = (key: string) => {
        const col = colOf(key);
        const set = new Set((rows || []).filter((r) => passes(r, key)).map((r) => text(col.value(r))));
        return [...set].sort((a, b) => (col.numeric ? Number(a) - Number(b) : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
    };

    const pages = Math.max(1, Math.ceil(filtered.length / size));
    const current = Math.min(page, pages);
    const start = (current - 1) * size;
    const visible = filtered.slice(start, start + size);
    const activeCount = Object.keys(filters).length;

    const setFilter = (key: string, sel: Set<string> | null) => setFilters((f) => {
        const n = { ...f };
        if (sel) n[key] = sel; else delete n[key];
        return n;
    });

    return (
        <div className="dt">
            {activeCount > 0 && (
                <div className="dt-active">
                    <span>{activeCount} column filter{activeCount > 1 ? 's' : ''} applied</span>
                    <button type="button" className="dt-link" onClick={() => setFilters({})}>Clear all</button>
                </div>
            )}
            <div className="table-wrapper dt-scroll">
                <table id={id}>
                    <thead>
                        <tr>
                            {columns.map((c) => {
                                const isFiltered = !!filters[c.key];
                                const canFilter = c.filterable !== false;
                                return (
                                    <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }} className={isFiltered ? 'dt-th-filtered' : undefined}>
                                        {canFilter ? (
                                            <div className="dt-th">
                                                <button type="button" className={`dt-th-btn${open?.key === c.key ? ' open' : ''}`} aria-haspopup="dialog" aria-expanded={open?.key === c.key}
                                                    onMouseDown={(e) => { if (open?.key === c.key) e.nativeEvent.stopImmediatePropagation(); }}
                                                    onClick={(e) => setOpen(open?.key === c.key ? null : { key: c.key, anchor: e.currentTarget.getBoundingClientRect() })} title={`Filter ${c.label}`}>
                                                    <span>{c.label}</span>
                                                    {sort?.key === c.key && <span className="dt-sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                                                    <FilterIcon active={isFiltered} />
                                                </button>
                                                {open?.key === c.key && (
                                                    <FilterMenu
                                                        anchor={open.anchor}
                                                        values={valuesFor(c.key)}
                                                        selected={filters[c.key] || null}
                                                        sort={sort?.key === c.key ? sort.dir : null}
                                                        onApply={(sel) => setFilter(c.key, sel)}
                                                        onSort={(dir) => setSort({ key: c.key, dir })}
                                                        onClose={() => setOpen(null)}
                                                    />
                                                )}
                                            </div>
                                        ) : c.label}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows === null ? (
                            <tr><td colSpan={columns.length} className="dt-message">{loadingText}</td></tr>
                        ) : visible.length === 0 ? (
                            <tr><td colSpan={columns.length} className="dt-message">{rows.length && activeCount ? 'No rows match the column filters.' : emptyText}</td></tr>
                        ) : (
                            visible.map((r, i) => (
                                <tr key={rowKey(r, start + i)}>
                                    {columns.map((c) => (
                                        <td key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.render ? c.render(r) : text(c.value(r)) === BLANK ? '' : c.value(r)}</td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {rows !== null && filtered.length > 0 && (
                <div className="dt-pager">
                    <div className="dt-pager-info">
                        Showing {start + 1}–{Math.min(start + size, filtered.length)} of {filtered.length}
                        {filtered.length !== rows.length && <span> (filtered from {rows.length})</span>}
                    </div>
                    <div className="dt-pager-controls">
                        <label className="dt-pager-size">
                            <span>Rows per page</span>
                            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <button type="button" className="dt-page-btn" disabled={current <= 1} onClick={() => setPage(1)} aria-label="First page">«</button>
                        <button type="button" className="dt-page-btn" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">‹</button>
                        <span className="dt-page-num">Page {current} of {pages}</span>
                        <button type="button" className="dt-page-btn" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">›</button>
                        <button type="button" className="dt-page-btn" disabled={current >= pages} onClick={() => setPage(pages)} aria-label="Last page">»</button>
                    </div>
                </div>
            )}
        </div>
    );
}
