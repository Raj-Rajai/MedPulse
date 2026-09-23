/*!
 * MedPulse QR — tiny dependency-free QR Code encoder (byte mode, ECC level M, versions 1–10).
 * Enough for patient IDs / short URLs (up to ~213 bytes). Algorithm follows ISO/IEC 18004.
 * Usage: MedPulseQR.svg('PAT-2026-12345', { scale: 4, margin: 4, dark: '#0f172a', light: '#fff' })
 */
(function (root) {
  'use strict';

  var ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // level M
  var NUM_BLOCKS    = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];           // level M
  var FORMAT_ECL_M  = 0;

  function rawDataModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  function utf8(str) {
    var out = [], s = unescape(encodeURIComponent(String(str)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  /* ---- Reed–Solomon over GF(256), poly 0x11D ---- */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function encode(text) {
    var bytes = utf8(text);
    var ver;
    for (ver = 1; ver <= 10; ver++) {
      var ccBits = ver <= 9 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
    }
    if (ver > 10) throw new Error('QR: text too long');

    /* ---- data bits ---- */
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(0x4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var capBits = dataCodewords(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      data.push(v);
    }

    /* ---- blocks + ECC, interleaved ---- */
    var numBlocks = NUM_BLOCKS[ver], ecLen = ECC_PER_BLOCK[ver];
    var rawCodewords = Math.floor(rawDataModules(ver) / 8);
    var numShort = numBlocks - rawCodewords % numBlocks;
    var shortLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsDivisor(ecLen), blocks = [], pos = 0;
    for (i = 0; i < numBlocks; i++) {
      var dat = data.slice(pos, pos + shortLen - ecLen + (i < numShort ? 0 : 1));
      pos += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var codewords = [];
    for (i = 0; i < blocks[0].length; i++) {
      blocks.forEach(function (blk, j) {
        if (i !== shortLen - ecLen || j >= numShort) codewords.push(blk[i]);
      });
    }

    /* ---- matrix ---- */
    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    var align = [];
    if (ver > 1) {
      var n = Math.floor(ver / 7) + 2;
      var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      align = [6];
      for (var p = size - 7; align.length < n; p -= step) align.splice(1, 0, p);
    }
    align.forEach(function (ay, ii) {
      align.forEach(function (ax, jj) {
        var last = align.length - 1;
        if ((ii === 0 && jj === 0) || (ii === 0 && jj === last) || (ii === last && jj === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });

    function drawFormat(mask) {
      var d = (FORMAT_ECL_M << 3) | mask, rem = d;
      for (var t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412;
      var bit = function (idx) { return ((b >>> idx) & 1) !== 0; };
      for (var t2 = 0; t2 <= 5; t2++) setF(8, t2, bit(t2));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (t2 = 9; t2 < 15; t2++) setF(14 - t2, 8, bit(t2));
      for (t2 = 0; t2 < 8; t2++) setF(size - 1 - t2, 8, bit(t2));
      for (t2 = 8; t2 < 15; t2++) setF(8, size - 15 + t2, bit(t2));
      setF(8, size - 8, true);
    }
    drawFormat(0); // reserve

    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bitv = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3);
        setF(a, bb, bitv); setF(bb, a, bitv);
      }
    }

    // codewords, zig-zag
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < codewords.length * 8) {
            mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    function maskFn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return x * y % 2 + x * y % 3 === 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }
    function applyMask(m) {
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
        if (!fn[yy][xx] && maskFn(m, xx, yy)) mod[yy][xx] = !mod[yy][xx];
      }
    }
    function penalty() {
      var score = 0, dark = 0, yy, xx;
      for (yy = 0; yy < size; yy++) {
        var runR = 1, runC = 1;
        for (xx = 0; xx < size; xx++) {
          if (mod[yy][xx]) dark++;
          if (xx > 0) {
            if (mod[yy][xx] === mod[yy][xx - 1]) { runR++; if (runR === 5) score += 3; else if (runR > 5) score++; } else runR = 1;
            if (mod[xx][yy] === mod[xx - 1][yy]) { runC++; if (runC === 5) score += 3; else if (runC > 5) score++; } else runC = 1;
          }
          if (xx > 0 && yy > 0) {
            var c = mod[yy][xx];
            if (c === mod[yy][xx - 1] && c === mod[yy - 1][xx] && c === mod[yy - 1][xx - 1]) score += 3;
          }
        }
      }
      var total = size * size;
      score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
      return score;
    }

    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var s = penalty();
      if (s < bestScore) { bestScore = s; best = m; }
      applyMask(m); // undo (XOR)
    }
    applyMask(best); drawFormat(best);
    return { version: ver, size: size, modules: mod };
  }

  function svg(text, opts) {
    opts = opts || {};
    var q = encode(text), margin = opts.margin == null ? 4 : opts.margin, scale = opts.scale || 4;
    var dim = q.size + margin * 2, path = '';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) {
      if (q.modules[y][x]) path += 'M' + (x + margin) + ' ' + (y + margin) + 'h1v1h-1z';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" width="' + dim * scale + '" height="' + dim * scale +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="' + (opts.light || '#ffffff') +
      '"/><path d="' + path + '" fill="' + (opts.dark || '#000000') + '"/></svg>';
  }

  var api = { encode: encode, svg: svg };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MedPulseQR = api;
})(typeof window !== 'undefined' ? window : this);
