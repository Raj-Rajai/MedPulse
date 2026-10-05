/*!
 * MedPulse QR — tiny dependency-free QR Code encoder (byte mode, ECC level M, versions 1–10).
 * Typed port of frontend/shared/vendor/qr.js (window.MedPulseQR); same algorithm and output.
 * Enough for patient IDs / short URLs (up to ~213 bytes). Algorithm follows ISO/IEC 18004.
 */

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // level M
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]; // level M
const FORMAT_ECL_M = 0;

export interface QrCode {
    version: number;
    size: number;
    modules: boolean[][];
}

export interface QrSvgOptions {
    scale?: number;
    margin?: number | null;
    dark?: string;
    light?: string;
}

function rawDataModules(ver: number): number {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const n = Math.floor(ver / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (ver >= 7) r -= 36;
    }
    return r;
}

function dataCodewords(ver: number): number {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
}

function utf8(str: string): number[] {
    // Same as the original unescape(encodeURIComponent(str)) (throws on lone surrogates like it did).
    const enc = encodeURIComponent(String(str));
    const out: number[] = [];
    for (let i = 0; i < enc.length; i++) {
        if (enc[i] === '%') { out.push(parseInt(enc.slice(i + 1, i + 3), 16)); i += 2; }
        else out.push(enc.charCodeAt(i));
    }
    return out;
}

/* ---- Reed–Solomon over GF(256), poly 0x11D ---- */
function gfMul(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
}

function rsDivisor(degree: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
            result[j] = gfMul(result[j], root);
            if (j + 1 < result.length) result[j] ^= result[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
    const result = divisor.map(() => 0);
    data.forEach((b) => {
        const factor = b ^ (result.shift() as number);
        result.push(0);
        divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
    });
    return result;
}

function maskFn(m: number, x: number, y: number): boolean {
    switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
        case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
        default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
}

export function encode(text: string): QrCode {
    const bytes = utf8(text);
    let ver: number;
    for (ver = 1; ver <= 10; ver++) {
        const ccBits = ver <= 9 ? 8 : 16;
        if (4 + ccBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
    }
    if (ver > 10) throw new Error('QR: text too long');

    /* ---- data bits ---- */
    const bits: number[] = [];
    const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0x4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    const capBits = dataCodewords(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
        data.push(v);
    }

    /* ---- blocks + ECC, interleaved ---- */
    const numBlocks = NUM_BLOCKS[ver], ecLen = ECC_PER_BLOCK[ver];
    const rawCodewords = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - (rawCodewords % numBlocks);
    const shortLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(ecLen);
    const blocks: number[][] = [];
    let pos = 0;
    for (let i = 0; i < numBlocks; i++) {
        const dat = data.slice(pos, pos + shortLen - ecLen + (i < numShort ? 0 : 1));
        pos += dat.length;
        const ecc = rsRemainder(dat, divisor);
        if (i < numShort) dat.push(0);
        blocks.push(dat.concat(ecc));
    }
    const codewords: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((blk, j) => {
            if (i !== shortLen - ecLen || j >= numShort) codewords.push(blk[i]);
        });
    }

    /* ---- matrix ---- */
    const size = ver * 4 + 17;
    const mod: boolean[][] = [], fn: boolean[][] = [];
    for (let i = 0; i < size; i++) { mod.push(new Array<boolean>(size).fill(false)); fn.push(new Array<boolean>(size).fill(false)); }
    const setF = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx: number, cy: number) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
            if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    let align: number[] = [];
    if (ver > 1) {
        const n = Math.floor(ver / 7) + 2;
        const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
        align = [6];
        for (let p = size - 7; align.length < n; p -= step) align.splice(1, 0, p);
    }
    align.forEach((ay, ii) => {
        align.forEach((ax, jj) => {
            const last = align.length - 1;
            if ((ii === 0 && jj === 0) || (ii === 0 && jj === last) || (ii === last && jj === 0)) return;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        });
    });

    const drawFormat = (mask: number) => {
        const d = (FORMAT_ECL_M << 3) | mask;
        let rem = d;
        for (let t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const b = ((d << 10) | rem) ^ 0x5412;
        const bit = (idx: number) => ((b >>> idx) & 1) !== 0;
        for (let t = 0; t <= 5; t++) setF(8, t, bit(t));
        setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (let t = 9; t < 15; t++) setF(14 - t, 8, bit(t));
        for (let t = 0; t < 8; t++) setF(size - 1 - t, 8, bit(t));
        for (let t = 8; t < 15; t++) setF(8, size - 15 + t, bit(t));
        setF(8, size - 8, true);
    };
    drawFormat(0); // reserve

    if (ver >= 7) {
        let rem = ver;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const vb = (ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const bitv = ((vb >>> i) & 1) !== 0, a = size - 11 + (i % 3), bb = Math.floor(i / 3);
            setF(a, bb, bitv); setF(bb, a, bitv);
        }
    }

    // codewords, zig-zag
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
                if (!fn[y][x] && bi < codewords.length * 8) {
                    mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
                    bi++;
                }
            }
        }
    }

    const applyMask = (m: number) => {
        for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
            if (!fn[yy][xx] && maskFn(m, xx, yy)) mod[yy][xx] = !mod[yy][xx];
        }
    };
    const penalty = (): number => {
        let score = 0, dark = 0;
        for (let yy = 0; yy < size; yy++) {
            let runR = 1, runC = 1;
            for (let xx = 0; xx < size; xx++) {
                if (mod[yy][xx]) dark++;
                if (xx > 0) {
                    if (mod[yy][xx] === mod[yy][xx - 1]) { runR++; if (runR === 5) score += 3; else if (runR > 5) score++; } else runR = 1;
                    if (mod[xx][yy] === mod[xx - 1][yy]) { runC++; if (runC === 5) score += 3; else if (runC > 5) score++; } else runC = 1;
                }
                if (xx > 0 && yy > 0) {
                    const c = mod[yy][xx];
                    if (c === mod[yy][xx - 1] && c === mod[yy - 1][xx] && c === mod[yy - 1][xx - 1]) score += 3;
                }
            }
        }
        const total = size * size;
        score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
        return score;
    };

    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
        applyMask(m); drawFormat(m);
        const s = penalty();
        if (s < bestScore) { bestScore = s; best = m; }
        applyMask(m); // undo (XOR)
    }
    applyMask(best); drawFormat(best);
    return { version: ver, size, modules: mod };
}

/** Geometry of the SVG that MedPulseQR.svg() produced: viewBox dim, pixel size and the dark-module path. */
export interface QrSvgModel {
    dim: number;
    width: number;
    height: number;
    path: string;
    light: string;
    dark: string;
}

export function svgModel(text: string, opts: QrSvgOptions = {}): QrSvgModel {
    const q = encode(text);
    const margin = opts.margin == null ? 4 : opts.margin, scale = opts.scale || 4;
    const dim = q.size + margin * 2;
    let path = '';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) {
        if (q.modules[y][x]) path += 'M' + (x + margin) + ' ' + (y + margin) + 'h1v1h-1z';
    }
    return { dim, width: dim * scale, height: dim * scale, path, light: opts.light || '#ffffff', dark: opts.dark || '#000000' };
}

/** Same markup string as the original MedPulseQR.svg(). */
export function svg(text: string, opts: QrSvgOptions = {}): string {
    const m = svgModel(text, opts);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + m.dim + ' ' + m.dim + '" width="' + m.width + '" height="' + m.height +
        '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="' + m.light +
        '"/><path d="' + m.path + '" fill="' + m.dark + '"/></svg>';
}

export const MedPulseQR = { encode, svg };
