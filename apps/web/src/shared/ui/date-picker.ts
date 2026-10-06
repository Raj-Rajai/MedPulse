/**
 * MedPulse calendar popup for every <input type="date"> (styles: styles/controls.css, `.mp-dp`).
 *
 * The browser's own calendar can't be styled, so a click on a date field (or a call to its
 * showPicker()) opens this popup instead. The input stays a real date input: typing still works,
 * the value stays yyyy-mm-dd, and picking a day fires the same `input` + `change` events a user
 * edit does, so React's controlled inputs update as usual. On phones it opens as a bottom sheet.
 * Add `data-native-picker` to an input to keep the browser calendar for it.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON_PREV = svg('m15 18-6-6 6-6');
const ICON_NEXT = svg('m9 18 6-6-6-6');
const ICON_DOWN = svg('m6 9 6 6 6-6');

type Mode = 'days' | 'months' | 'years';
interface Ymd { y: number; m: number; d: number }

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = ({ y, m, d }: Ymd) => `${String(y).padStart(4, '0')}-${pad(m + 1)}-${pad(d)}`;
const parseIso = (s: string): Ymd | null => {
    const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return r ? { y: +r[1], m: +r[2] - 1, d: +r[3] } : null;
};
const todayYmd = (): Ymd => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; };
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const addDays = (v: Ymd, n: number): Ymd => { const t = new Date(v.y, v.m, v.d + n); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; };
const usable = (el: Element | null): el is HTMLInputElement =>
    el instanceof HTMLInputElement && el.type === 'date' && !el.disabled && !el.readOnly && !el.hasAttribute('data-native-picker');

let input: HTMLInputElement | null = null;
let pop: HTMLDivElement | null = null;
let mode: Mode = 'days';
let view = { y: 0, m: 0 };
let focusIso: string | null = null;

function inRange(iso: string): boolean {
    if (!input) return true;
    if (input.min && iso < input.min) return false;
    if (input.max && iso > input.max) return false;
    return true;
}

function commit(iso: string): void {
    const el = input;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, iso); else el.value = iso;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
}

function render(): void {
    if (!pop || !input) return;
    const sel = input.value;
    const today = toIso(todayYmd());
    let title = '';
    let body = '';
    if (mode === 'days') {
        title = `${MONTHS[view.m]} ${view.y}`;
        const first = new Date(view.y, view.m, 1).getDay();
        const start = addDays({ y: view.y, m: view.m, d: 1 }, -first);
        let cells = '';
        for (let i = 0; i < 42; i++) {
            const c = addDays(start, i);
            const iso = toIso(c);
            const cls = ['mp-dp-day', c.m !== view.m ? 'out' : '', iso === today ? 'today' : '', iso === sel ? 'sel' : ''].filter(Boolean).join(' ');
            const tab = iso === (focusIso || '') ? '0' : '-1';
            cells += `<button type="button" class="${cls}" data-iso="${iso}" tabindex="${tab}" aria-label="${c.d} ${MONTHS[c.m]} ${c.y}"${iso === sel ? ' aria-pressed="true"' : ''}${inRange(iso) ? '' : ' disabled'}>${c.d}</button>`;
        }
        body = `<div class="mp-dp-week">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div><div class="mp-dp-grid" role="grid">${cells}</div>`;
    } else if (mode === 'months') {
        title = String(view.y);
        const s = parseIso(sel);
        const t = todayYmd();
        body = `<div class="mp-dp-grid cells">${MONTHS.map((name, m) => {
            const cls = ['mp-dp-cell', s && s.y === view.y && s.m === m ? 'sel' : '', t.y === view.y && t.m === m ? 'today' : ''].filter(Boolean).join(' ');
            const lastIso = toIso({ y: view.y, m, d: daysIn(view.y, m) });
            const firstIso = toIso({ y: view.y, m, d: 1 });
            const off = (input!.min && lastIso < input!.min) || (input!.max && firstIso > input!.max);
            return `<button type="button" class="${cls}" data-month="${m}"${off ? ' disabled' : ''}>${name.slice(0, 3)}</button>`;
        }).join('')}</div>`;
    } else {
        const base = view.y - (view.y % 12);
        title = `${base} – ${base + 11}`;
        const s = parseIso(sel);
        const ty = todayYmd().y;
        let cells = '';
        for (let y = base; y < base + 12; y++) {
            const cls = ['mp-dp-cell', s && s.y === y ? 'sel' : '', ty === y ? 'today' : ''].filter(Boolean).join(' ');
            const off = (input.min && `${y}-12-31` < input.min) || (input.max && `${y}-01-01` > input.max);
            cells += `<button type="button" class="${cls}" data-year="${y}"${off ? ' disabled' : ''}>${y}</button>`;
        }
        body = `<div class="mp-dp-grid cells">${cells}</div>`;
    }
    const prevLabel = mode === 'days' ? 'Previous month' : mode === 'months' ? 'Previous year' : 'Previous years';
    const nextLabel = mode === 'days' ? 'Next month' : mode === 'months' ? 'Next year' : 'Next years';
    pop.innerHTML =
        `<div class="mp-dp-grabber"></div>` +
        `<div class="mp-dp-head"><button type="button" class="mp-dp-nav" data-act="prev" aria-label="${prevLabel}">${ICON_PREV}</button>` +
        `<button type="button" class="mp-dp-title" data-act="mode" aria-live="polite">${title}${mode === 'years' ? '' : ICON_DOWN}</button>` +
        `<button type="button" class="mp-dp-nav" data-act="next" aria-label="${nextLabel}">${ICON_NEXT}</button></div>` +
        body +
        `<div class="mp-dp-foot"><button type="button" data-act="clear"${input.required ? ' disabled' : ''}>Clear</button>` +
        `<button type="button" class="primary" data-act="today"${inRange(today) ? '' : ' disabled'}>Today</button></div>`;
}

function place(): void {
    if (!pop || !input) return;
    if (!input.isConnected) { close(false); return; }
    const sheet = window.matchMedia('(max-width: 560px)').matches;
    pop.classList.toggle('mp-dp-sheet', sheet);
    if (sheet) { pop.style.left = ''; pop.style.top = ''; return; }
    const r = input.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 8;
    if (top + h > vh - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8));
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(Math.max(8, top))}px`;
}

function focusDay(): void {
    if (!pop) return;
    const b = pop.querySelector<HTMLButtonElement>(focusIso ? `[data-iso="${focusIso}"]` : '.sel') || pop.querySelector<HTMLButtonElement>('.mp-dp-day:not(.out):not(:disabled)');
    b?.focus({ preventScroll: true });
}

function open(el: HTMLInputElement): void {
    if (input === el && pop) return;
    close(false);
    input = el;
    const v = parseIso(el.value) || parseIso(el.min > toIso(todayYmd()) ? el.min : '') || todayYmd();
    view = { y: v.y, m: v.m };
    focusIso = toIso(v);
    mode = 'days';
    pop = document.createElement('div');
    pop.className = 'mp-dp';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Choose date');
    const accent = getComputedStyle(el).getPropertyValue('--accent').trim() || getComputedStyle(el).getPropertyValue('--teal').trim();
    if (accent) pop.style.setProperty('--mp-dp-accent', accent);
    pop.addEventListener('click', onPopClick);
    pop.addEventListener('keydown', onPopKey);
    // Inside a modal <dialog> everything outside it is inert, so the popup must live in the dialog.
    (el.closest('dialog[open]') || document.body).appendChild(pop);
    render();
    const canPopover = typeof pop.showPopover === 'function';
    if (canPopover) { pop.setAttribute('popover', 'manual'); pop.showPopover(); }
    place();
    if (window.matchMedia('(pointer: coarse)').matches) focusDay();
}

function close(refocus: boolean): void {
    const el = input;
    if (pop) {
        if (pop.matches(':popover-open')) pop.hidePopover();
        pop.remove();
    }
    pop = null;
    input = null;
    if (refocus && el && el.isConnected) el.focus({ preventScroll: true });
}

function shift(dir: number): void {
    if (mode === 'days') {
        const t = new Date(view.y, view.m + dir, 1);
        view = { y: t.getFullYear(), m: t.getMonth() };
    } else view.y += mode === 'months' ? dir : dir * 12;
    focusIso = null;
    render();
    place();
}

function onPopClick(e: MouseEvent): void {
    const b = (e.target as Element).closest('button');
    if (!b || b.disabled || !input) return;
    e.preventDefault();
    const act = b.dataset.act;
    if (b.dataset.iso) { commit(b.dataset.iso); return; }
    if (b.dataset.month) { view.m = +b.dataset.month; mode = 'days'; render(); place(); return; }
    if (b.dataset.year) { view.y = +b.dataset.year; mode = 'months'; render(); place(); return; }
    if (act === 'prev') shift(-1);
    else if (act === 'next') shift(1);
    else if (act === 'mode') { mode = mode === 'days' ? 'months' : 'years'; render(); place(); }
    else if (act === 'today') commit(toIso(todayYmd()));
    else if (act === 'clear') commit('');
}

function onPopKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (mode !== 'days') return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const active = document.activeElement as HTMLElement | null;
    const cur = active?.dataset?.iso ? parseIso(active.dataset.iso) : null;
    if (!(e.key in step) || !cur) return;
    e.preventDefault();
    const next = addDays(cur, step[e.key]);
    focusIso = toIso(next);
    if (next.m !== view.m || next.y !== view.y) { view = { y: next.y, m: next.m }; render(); }
    focusDay();
}

let installed = false;

/** Route every date field on the page to the MedPulse calendar. Safe to call more than once. */
export function installDatePicker(): void {
    if (installed || typeof document === 'undefined') return;
    installed = true;

    const proto = HTMLInputElement.prototype as HTMLInputElement & { showPicker?: () => void };
    const nativeShow = proto.showPicker;
    if (nativeShow) {
        proto.showPicker = function (this: HTMLInputElement) {
            if (usable(this)) open(this);
            else nativeShow.call(this);
        };
    }

    // Capture phase so the browser's own calendar never opens first.
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (usable(t as Element)) { e.preventDefault(); open(t as HTMLInputElement); }
    }, true);
    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (!usable(t as Element)) return;
        if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F4') { e.preventDefault(); open(t as HTMLInputElement); }
        else if (e.key === 'Escape' && pop) close(false);
        else if (e.key === 'Tab' && pop) close(false);
    }, true);
    document.addEventListener('input', (e) => {
        if (pop && e.target === input && input) {
            const v = parseIso(input.value);
            if (v) { view = { y: v.y, m: v.m }; mode = 'days'; focusIso = toIso(v); render(); }
        }
    }, true);
    document.addEventListener('pointerdown', (e) => {
        if (!pop) return;
        const t = e.target as Node;
        if (pop.contains(t) || t === input) return;
        close(false);
    }, true);
    window.addEventListener('resize', () => place());
    window.addEventListener('scroll', (e) => {
        if (pop && !pop.contains(e.target as Node)) place();
    }, true);
}
