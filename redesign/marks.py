"""The mark (mark.svg: favicon, header and footer) and the touch icon (apple-touch-icon.png).
Run from the site folder: python3 redesign/marks.py   (needs Pillow)

The mark is geometry, not a picture: the sun as a gold disc, and on it a tick that is also a V, the check a person
makes of the record. The share card (og.png) is a browser's picture of redesign/og.html at 1200 x 630."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SUN, SKY = "#ffc65a", "#04060b"
DARK = "#1b1304"

# The tick: from the upper left down to the base, then up to the upper right (a V whose right arm is the longer).
TICK = [(56, 84), (90, 138), (146, 62)]

def mark_svg():
    pts = " ".join(f"{x},{y}" for x, y in TICK)
    (ROOT / "mark.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="VibeGov">'
        f'<circle cx="100" cy="100" r="96" fill="{SUN}"/>'
        f'<polyline points="{pts}" fill="none" stroke="{DARK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>'
        "</svg>\n"
    )

def draw_mark(img, x, y, size):
    d = ImageDraw.Draw(img)
    s = size / 200
    d.ellipse([x + 4 * s, y + 4 * s, x + 196 * s, y + 196 * s], fill=SUN)
    d.line([(x + px * s, y + py * s) for px, py in TICK], fill=DARK, width=round(20 * s), joint="curve")
    for px, py in (TICK[0], TICK[-1]):
        r = 10 * s
        d.ellipse([x + px * s - r, y + py * s - r, x + px * s + r, y + py * s + r], fill=DARK)

def touch_icon():
    img = Image.new("RGB", (720, 720), SKY)
    draw_mark(img, 60, 60, 600)
    img.resize((180, 180), Image.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)

if __name__ == "__main__":
    mark_svg()
    touch_icon()
