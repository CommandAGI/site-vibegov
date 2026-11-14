// The two diagrams of the front door (redesign/DESIGN.md § the diagrams), drawn in lines and nodes on a 2D canvas,
// with no library: `<canvas class="figure" data-figure="apex|world">`. They are drawings of an idea, not data, and
// the page's colophon says so. A figure runs only while it is seen. With reduced motion it is drawn once, in its
// last state.
const still = matchMedia('(prefers-reduced-motion: reduce)');
const INK = '242 238 228', SUN = '255 198 90', ACT = '169 193 255', OK = '95 211 154';
const clamp = v => Math.min(1, Math.max(0, v));
const smooth = t => t * t * (3 - 2 * t);
// A fixed random sequence: a figure is the same figure on every visit.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// No throne: a pyramid with one seat above the rest becomes a ring of equals around an empty middle. It happens
// once, when the figure is first seen; then the ring turns slowly and work passes between neighbours.
function apex() {
  const rows = [1, 2, 4, 6], N = 13, HOLD = 1.3, MORPH = 1.7;
  const nodes = [];
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i += 1) {
      const k = nodes.length;
      nodes.push({ px: 0.5 + (count > 1 ? (i / (count - 1) - 0.5) * [0, 0.2, 0.46, 0.72][r] : 0), py: 0.2 + r * 0.19, rank: [2.1, 1.35, 1, 0.8][r], parent: r ? nodes.length - i - rows[r - 1] + Math.floor((i * rows[r - 1]) / count) : -1, turn: (k / N) * Math.PI * 2 - Math.PI / 2 });
    }
  });
  const rnd = random(13);
  const work = Array.from({ length: 5 }, (_, i) => ({ from: Math.floor(rnd() * N), hop: 1 + Math.floor(rnd() * 3), at: -i * 0.9, dir: rnd() < 0.5 ? 1 : -1 }));
  return (g, s, t) => {
    const m = smooth(clamp((t - HOLD) / MORPH)), spin = Math.max(0, t - HOLD - MORPH) * 0.045;
    const at = n => {
      const a = n.turn + spin;
      return [(n.px + (0.5 + Math.cos(a) * 0.34 - n.px) * m) * s, (n.py + (0.5 + Math.sin(a) * 0.34 - n.py) * m) * s];
    };
    const P = nodes.map(at);
    g.lineWidth = Math.max(1, s * 0.0022);
    // The pyramid's lines: each seat answers to the one above it.
    g.strokeStyle = `rgb(${INK} / ${0.5 * (1 - m)})`;
    g.beginPath();
    nodes.forEach((n, i) => { if (n.parent >= 0) { g.moveTo(...P[i]); g.lineTo(...P[n.parent]); } });
    g.stroke();
    // The ring's lines: each voice beside its neighbours, and nothing through the middle.
    [0.55, 0.22, 0.1].forEach((alpha, d) => {
      g.strokeStyle = `rgb(${INK} / ${alpha * m})`;
      g.beginPath();
      for (let i = 0; i < N; i += 1) { g.moveTo(...P[i]); g.lineTo(...P[(i + d + 1) % N]); }
      g.stroke();
    });
    // The seat above the rest: a gold circle that leaves the top node, and stays in the middle, empty.
    const cx = P[0][0] + (0.5 * s - P[0][0]) * m, cy = P[0][1] + (0.5 * s - P[0][1]) * m;
    g.strokeStyle = `rgb(${SUN} / ${0.95 - 0.35 * m})`;
    g.lineWidth = Math.max(1, s * 0.003);
    g.setLineDash(m > 0.5 ? [s * 0.012, s * 0.012] : []);
    g.beginPath();
    g.arc(cx, cy, s * (0.05 + 0.07 * m), 0, 6.2832);
    g.stroke();
    g.setLineDash([]);
    for (let i = 0; i < N; i += 1) {
      const r = s * 0.013 * (nodes[i].rank + (1.15 - nodes[i].rank) * m);
      g.fillStyle = `rgb(${INK})`;
      g.beginPath();
      g.arc(P[i][0], P[i][1], r, 0, 6.2832);
      g.fill();
    }
    // Work passing between neighbours, once the ring stands.
    if (m === 1 && !still.matches)
      for (const w of work) {
        const u = ((t - HOLD - MORPH) * 0.5 + w.at) % 2.4;
        if (u < 0 || u > 1) continue;
        const a = P[w.from], b = P[(w.from + w.dir * w.hop + N) % N], e = smooth(u);
        g.fillStyle = `rgb(${SUN} / ${Math.sin(u * Math.PI)})`;
        g.beginPath();
        g.arc(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, s * 0.007, 0, 6.2832);
        g.fill();
      }
    g.font = `500 ${Math.round(s * 0.027)}px ui-monospace, "SFMono-Regular", "DejaVu Sans Mono", monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = `rgb(${SUN} / ${1 - clamp(m * 3)})`;
    g.fillText('one seat above the rest', P[0][0] + s * 0.075, P[0][1]);
    g.textAlign = 'center';
    g.fillStyle = `rgb(${SUN} / ${clamp(m * 3 - 2)})`;
    g.fillText('no office', 0.5 * s, 0.5 * s);
  };
}

// The world at work: people, agents and machines as one graph on a turning globe. A piece of work starts at a
// person and passes from system to system along the lines; a node lights when work reaches it.
function world() {
  const rnd = random(20261113), N = 150;
  const nodes = Array.from({ length: N }, (_, i) => {
    const y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
    const kind = rnd();
    return { v: [Math.cos(a) * r, y, Math.sin(a) * r], kind: kind < 0.2 ? 0 : kind < 0.66 ? 1 : 2, lit: 0, to: [] };
  });
  const far = (a, b) => (a.v[0] - b.v[0]) ** 2 + (a.v[1] - b.v[1]) ** 2 + (a.v[2] - b.v[2]) ** 2;
  const edges = [];
  nodes.forEach((n, i) => {
    const near = nodes.map((o, j) => [far(n, o), j]).sort((a, b) => a[0] - b[0]).slice(1, 4);
    for (const [, j] of near) if (!n.to.includes(j)) { n.to.push(j); nodes[j].to.push(i); edges.push([i, j]); }
  });
  const people = nodes.map((n, i) => (n.kind === 0 ? i : -1)).filter(i => i >= 0);
  // A piece of work: where it is, where it goes next, how far along, and how many more systems it will pass.
  const start = w => { w.a = people[Math.floor(rnd() * people.length)]; w.b = nodes[w.a].to[Math.floor(rnd() * nodes[w.a].to.length)]; w.u = 0; w.left = 3 + Math.floor(rnd() * 5); w.speed = 0.7 + rnd() * 0.6; nodes[w.a].lit = 1; return w; };
  const work = Array.from({ length: 34 }, () => { const w = start({}); w.u = rnd(); return w; });
  const COLOUR = [SUN, ACT, OK];
  let last = 0;
  return (g, s, t) => {
    const dt = Math.min(0.05, Math.max(0, t - last));
    last = t;
    const a = t * ((2 * Math.PI) / 80) + 0.6, ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(0.38), st = Math.sin(0.38);
    // Turn about the pole, tip the pole toward the reader, and draw a little smaller what is farther away.
    const see = v => {
      const x = v[0] * ca + v[2] * sa, z0 = v[2] * ca - v[0] * sa, y = v[1] * ct - z0 * st, z = v[1] * st + z0 * ct, k = 1 / (1 - z * 0.16);
      return [(0.5 + x * 0.39 * k) * s, (0.5 - y * 0.39 * k) * s, z];
    };
    const P = nodes.map(n => see(n.v));
    g.lineWidth = Math.max(1, s * 0.0016);
    for (const side of [-1, 1]) {
      g.strokeStyle = `rgb(${INK} / ${side < 0 ? 0.07 : 0.24})`;
      g.beginPath();
      for (const [i, j] of edges) if ((P[i][2] + P[j][2] < 0 ? -1 : 1) === side) { g.moveTo(P[i][0], P[i][1]); g.lineTo(P[j][0], P[j][1]); }
      g.stroke();
      nodes.forEach((n, i) => {
        if ((P[i][2] < 0 ? -1 : 1) !== side) return;
        const front = side < 0 ? 0.28 : 0.55 + 0.45 * P[i][2];
        if (n.lit > 0.02) {
          g.fillStyle = `rgb(${COLOUR[n.kind]} / ${0.2 * n.lit * front})`;
          g.beginPath();
          g.arc(P[i][0], P[i][1], s * 0.022, 0, 6.2832);
          g.fill();
        }
        g.fillStyle = `rgb(${COLOUR[n.kind]} / ${front})`;
        g.beginPath();
        g.arc(P[i][0], P[i][1], s * (n.kind === 0 ? 0.0085 : 0.0062) * (1 + 0.5 * n.lit), 0, 6.2832);
        g.fill();
      });
      for (const w of work) {
        const A = P[w.a], B = P[w.b], z = A[2] + (B[2] - A[2]) * w.u;
        if ((z < 0 ? -1 : 1) !== side) continue;
        const e = smooth(w.u), x = A[0] + (B[0] - A[0]) * e, y = A[1] + (B[1] - A[1]) * e, tail = Math.max(0, e - 0.3);
        g.strokeStyle = `rgb(${INK} / ${side < 0 ? 0.25 : 0.9})`;
        g.lineWidth = Math.max(1, s * 0.0034);
        g.beginPath();
        g.moveTo(A[0] + (B[0] - A[0]) * tail, A[1] + (B[1] - A[1]) * tail);
        g.lineTo(x, y);
        g.stroke();
        g.lineWidth = Math.max(1, s * 0.0016);
      }
    }
    for (const n of nodes) n.lit *= Math.exp(-dt * 1.6);
    for (const w of work) {
      w.u += dt * w.speed;
      if (w.u < 1) continue;
      nodes[w.b].lit = 1;
      if ((w.left -= 1) <= 0) { start(w); continue; }
      const next = nodes[w.b].to.filter(j => j !== w.a);
      w.a = w.b;
      w.b = next[Math.floor(rnd() * next.length)] ?? nodes[w.a].to[0];
      w.u = 0;
    }
  };
}

const FIGURES = { apex, world };

function run(canvas) {
  const paint = FIGURES[canvas.dataset.figure]?.();
  if (!paint) return;
  const g = canvas.getContext('2d');
  let seenAt = 0, visible = false, frame = 0;
  function draw(now) {
    frame = 0;
    const s = Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio || 1));
    if (!s) return;
    if (canvas.width !== s) canvas.width = canvas.height = s;
    g.clearRect(0, 0, s, s);
    paint(g, s, still.matches ? 30 : seenAt ? (now - seenAt) / 1000 : 0);
    if (visible && !still.matches) frame = requestAnimationFrame(draw);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
  draw(performance.now());
  new ResizeObserver(wake).observe(canvas);
  new IntersectionObserver(entries => {
    for (const e of entries) {
      visible = e.isIntersecting;
      if (e.intersectionRatio > 0.25 && !seenAt) seenAt = performance.now();
    }
    if (visible) wake();
  }, { threshold: [0, 0.25] }).observe(canvas);
  still.addEventListener('change', wake);
}

for (const canvas of document.querySelectorAll('canvas.figure')) run(canvas);
