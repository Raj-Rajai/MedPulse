"""Build apps/web/src/styles/fonts/medpulse-icons.woff2 from Lucide SVGs.

Usage (from the repo root, needs network once):
    npm i --no-save lucide-static
    python -m pip install picosvg fonttools brotli
    python tools/icon-font/build.py node_modules/lucide-static/icons

Then paste the printed unicode-range into the @font-face in apps/web/src/styles/controls.css.
"""
import json, os, sys
import pathops
from picosvg.svg import SVG
from fontTools.svgLib.path import parse_path
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.fontBuilder import FontBuilder
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = sys.argv[1] if len(sys.argv) > 1 else 'node_modules/lucide-static/icons'
OUT = os.path.join(HERE, '..', '..', 'apps', 'web', 'src', 'styles', 'fonts', 'medpulse-icons.woff2')
cfg = json.load(open(os.path.join(HERE, 'icons.json')))
MAP, LIGS = cfg['map'], cfg['ligatures']
UPM, SIZE, ADV, BOTTOM = 1000, 900, 1060, -130  # icon box 0.9em, sits slightly below the baseline like text
LEFT, SCALE = (ADV - SIZE) / 2, SIZE / 24


def outline(name):
    raw = open(os.path.join(ICONS, name + '.svg')).read()
    svg = SVG.fromstring(raw[raw.index('<svg'):]).topicosvg()  # strokes -> filled outlines
    path = pathops.Path()
    for shape in svg.shapes():
        part = pathops.Path()
        parse_path(shape.d, part.getPen())
        path = pathops.op(path, part, pathops.PathOp.UNION)
    return path


gname = lambda icon: 'i_' + icon.replace('-', '_')
glyphs = {}
for icon in sorted(set(MAP.values()) | {i for _, i in LIGS}):
    pen = TTGlyphPen(None)
    outline(icon).draw(TransformPen(ReverseContourPen(Cu2QuPen(pen, 1.0)), (SCALE, 0, 0, -SCALE, LEFT, BOTTOM + SIZE)))
    glyphs[gname(icon)] = pen.glyph()

empty = TTGlyphPen(None).glyph()
order = ['.notdef', 'zwj', 'vs16'] + list(glyphs)
cmap = {0x200D: 'zwj', 0xFE0F: 'vs16', **{int(cp, 16): gname(icon) for cp, icon in MAP.items()}}
fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf({'.notdef': empty, 'zwj': empty, 'vs16': empty, **glyphs})
fb.setupHorizontalMetrics({g: ((0 if g in ('zwj', 'vs16') else 500 if g == '.notdef' else ADV), 0) for g in order})
fb.setupHorizontalHeader(ascent=900, descent=-250)
fb.setupNameTable({'familyName': 'MedPulse Icons', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, usWinAscent=900, usWinDescent=250)
fb.setupPost()
subs = ''.join(f"  sub {' '.join(cmap[c] for c in seq)} by {gname(icon)};\n" for seq, icon in LIGS)
addOpenTypeFeaturesFromString(fb.font, f'languagesystem DFLT dflt;\nfeature ccmp {{\n{subs}}} ccmp;\nfeature liga {{\n{subs}}} liga;\n')
fb.font.flavor = 'woff2'
fb.save(OUT)

cps = sorted(cmap)
ranges, start = [], cps[0]
for a, b in zip(cps, cps[1:] + [None]):
    if b != a + 1:
        ranges.append(f'U+{start:X}' if start == a else f'U+{start:X}-{a:X}')
        start = b
print(f'{len(glyphs)} icons -> {os.path.normpath(OUT)}')
print('unicode-range:', ', '.join(ranges))
