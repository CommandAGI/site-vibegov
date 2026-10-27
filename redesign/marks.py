"""The wordmark, the seal and the favicon, drawn from the site's own fonts and a rosette's equations.
Run: python redesign/marks.py   (needs fontTools; writes wordmark.svg, seal.svg, mark.svg)
The wordmark: "Vibe" in Literata italic, light (the voice of a proposal), "Gov" in Literata roman, semibold (the
settled text), both at opsz 72, set tighter than the font's own spacing, with a seal-red section sign between them as
the hinge. The seal: a guilloche rosette (two families of hypotrochoids), the engraving of a public document."""
import math
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
INK, SEAL = "#20252a", "#832f35"

def instance(file, wght):
    return instantiateVariableFont(TTFont(ROOT / "fonts" / file), {"wght": wght, "opsz": 72})

def run(font, text, x, tracking, kerns, scale=1.0, y=0):
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    parts = []
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
        parts.append(pen.getCommands())
        x += (hmtx[name][0] + tracking + kerns.get(text[i:i + 2], 0)) * scale
    return " ".join(parts), x

italic, roman = instance("literata-italic.woff2", 330), instance("literata.woff2", 600)
upm = roman["head"].unitsPerEm
d1, x = run(italic, "Vibe", 0, -18, {"Vi": -40, "ib": -10, "be": -14})
sect, x2 = run(roman, "§", x + 40, 0, {}, scale=0.62, y=-120)
d2, end = run(roman, "Gov", x2 + 40, -22, {"Go": -18, "ov": -26})
asc, desc = 760, 250
W = math.ceil(end + 10)
H = asc + desc
(ROOT / "wordmark.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-asc} {W} {H}" width="{round(W / H * 28)}" height="28" role="img" aria-label="VibeGov">'
    f'<path fill="{INK}" d="{d1} {d2}"/><path fill="{SEAL}" d="{sect}"/></svg>\n')

def band(cx, cy, R, a, k, strands, n=360):
    """A guilloche band: `strands` circles of radius R + a·sin(kθ + φ), their phases spread evenly, so they weave."""
    paths = []
    for j in range(strands):
        phase = 2 * math.pi * j / strands
        pts = []
        for i in range(n + 1):
            t = 2 * math.pi * i / n
            r = R + a * math.sin(k * t + phase)
            pts.append(f"{cx + r * math.cos(t):.1f},{cy + r * math.sin(t):.1f}")
        paths.append("M" + " L".join(pts) + "Z")
    return paths

ring = band(100, 100, 76, 6, 30, 6) + band(100, 100, 56, 7, 18, 6) + band(100, 100, 36, 5, 12, 5)
seal = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="Ratified">'
    f'<g fill="none" stroke="{SEAL}">'
    '<circle cx="100" cy="100" r="96" stroke-width="3"/><circle cx="100" cy="100" r="88" stroke-width="1"/><circle cx="100" cy="100" r="65.5" stroke-width="0.8"/><circle cx="100" cy="100" r="46" stroke-width="0.8"/>'
    + "".join(f'<path d="{p}" stroke-width="0.6"/>' for p in ring)
    + '<circle cx="100" cy="100" r="24" stroke-width="1.5"/></g>'
    + f'<path fill="{SEAL}" transform="translate(100 100)" d="{run(roman, "§", 0, 0, {}, scale=0.045, y=0)[0]}"/>'
    + "</svg>\n")
# Centre the section sign: measure it and move it.
bp = BoundsPen(roman.getGlyphSet()); roman.getGlyphSet()[roman.getBestCmap()[ord("§")]].draw(bp)
xmin, ymin, xmax, ymax = bp.bounds
s = 0.045
seal = seal.replace('transform="translate(100 100)"', f'transform="translate({100 - (xmin + xmax) / 2 * s:.2f} {100 + (ymin + ymax) / 2 * s:.2f})"')
(ROOT / "seal.svg").write_text(seal)
# The favicon: at 16 px an engraving is mud, so the mark is the seal's frame and its section sign only.
sect_d = seal.split(f'<path fill="{SEAL}" ')[1].split('/>')[0]
(ROOT / "mark.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="VibeGov">'
    f'<circle cx="100" cy="100" r="98" fill="{SEAL}"/><circle cx="100" cy="100" r="84" fill="none" stroke="#f5f1e7" stroke-width="6"/>'
    f'<g transform="translate(100 100) scale(2.6) translate(-100 -100)"><path fill="#f5f1e7" {sect_d}/></g></svg>\n')
print("wordmark.svg", W, "x", H)
