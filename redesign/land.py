"""art/land.png: where the Earth's land is, 720 x 360, one bit a pixel (longitude -180..180 left to right, latitude 90..-90
top to bottom). scene.js puts a point of light on the globe wherever this map is white.

Run from the site folder: python3 redesign/land.py <land-50m.json>
The source is Natural Earth's 1:50m land (public domain) as the npm package world-atlas carries it (TopoJSON)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
topo = json.load(open(sys.argv[1]))
(sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
arcs = []
for arc in topo["arcs"]:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx
        y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(indexes):
    out = []
    for i in indexes:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out += pts if not out else pts[1:]
    # Unwrap the longitudes, so a ring that crosses the antimeridian is one shape and not a line across the map.
    flat = [out[0]]
    for lon, lat in out[1:]:
        prev = flat[-1][0]
        while lon - prev > 180: lon -= 360
        while lon - prev < -180: lon += 360
        flat.append((lon, lat))
    # A ring that goes all the way round holds a pole: close it there.
    if abs(flat[-1][0] - flat[0][0]) > 180:
        pole = -90 if sum(p[1] for p in flat) < 0 else 90
        flat += [(flat[-1][0], pole), (flat[0][0], pole)]
    return flat

W, H = 1440, 720
img = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(img)

def polygon(rings):
    for k, r in enumerate(rings):
        pts = ring(r)
        for shift in (-360, 0, 360):
            draw.polygon([((lon + shift + 180) / 360 * W, (90 - lat) / 180 * H) for lon, lat in pts], fill=0 if k else 255)

def geometry(g):
    if g["type"] == "GeometryCollection":
        for x in g["geometries"]: geometry(x)
    elif g["type"] == "Polygon": polygon(g["arcs"])
    elif g["type"] == "MultiPolygon":
        for p in g["arcs"]: polygon(p)

geometry(topo["objects"]["land"])
img.resize((720, 360), Image.LANCZOS).point(lambda v: 255 if v > 110 else 0).convert("1").save(ROOT / "art/land.png", optimize=True)
