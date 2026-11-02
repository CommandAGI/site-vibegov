"""The mark (mark.svg: favicon and footer), the share card (og.png) and the touch icon (apple-touch-icon.png).
Run from the site folder: python3 redesign/marks.py   (needs Pillow and DejaVu Sans, the system's fonts)

The mark is geometry, not a picture: a rounded square in the action blue, and a tick that is also a V, the check a
member makes of the record. The share card is type on the ink colour: what the site is, and its address."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ACT, INK, PAPER, MUTED, OK = "#1f4bb0", "#16191d", "#fbfbf9", "#a3a8b0", "#5fd39a"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BOOK = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# The tick: from the upper left down to the base, then up to the upper right (a V whose right arm is the longer).
TICK = [(52, 78), (88, 140), (150, 56)]

def mark_svg():
    pts = " ".join(f"{x},{y}" for x, y in TICK)
    (ROOT / "mark.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="VibeGov">'
        f'<rect width="200" height="200" rx="44" fill="{ACT}"/>'
        f'<polyline points="{pts}" fill="none" stroke="{PAPER}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>'
        "</svg>\n"
    )

def draw_mark(img, x, y, size):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, y, x + size, y + size], radius=size * 0.22, fill=ACT)
    s = size / 200
    d.line([(x + px * s, y + py * s) for px, py in TICK], fill=PAPER, width=round(22 * s), joint="curve")
    for px, py in (TICK[0], TICK[-1]):
        r = 11 * s
        d.ellipse([x + px * s - r, y + py * s - r, x + px * s + r, y + py * s + r], fill=PAPER)

def touch_icon():
    img = Image.new("RGB", (180, 180), ACT)
    draw_mark(img, 0, 0, 180)
    img.save(ROOT / "apple-touch-icon.png", optimize=True)

def share_card():
    img = Image.new("RGB", (1200, 630), INK)
    d = ImageDraw.Draw(img)
    draw_mark(img, 80, 80, 88)
    d.text((196, 100), "VibeGov", font=ImageFont.truetype(BOLD, 44), fill=PAPER)
    title = ImageFont.truetype(BOLD, 76)
    d.text((80, 230), "The Coordination", font=title, fill=PAPER)
    d.text((80, 318), "Contract, live.", font=title, fill=PAPER)
    d.text((80, 440), "Open RFCs, voices, cases and the public ledger,", font=ImageFont.truetype(BOOK, 30), fill=MUTED)
    d.text((80, 480), "checked in your browser.", font=ImageFont.truetype(BOOK, 30), fill=MUTED)
    d.ellipse([80, 553, 96, 569], fill=OK)
    d.text((112, 546), "vibegov.pro", font=ImageFont.truetype(BOLD, 26), fill=PAPER)
    img.save(ROOT / "og.png", optimize=True)

if __name__ == "__main__":
    mark_svg()
    touch_icon()
    share_card()
