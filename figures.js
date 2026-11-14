// The two diagrams of the front door (redesign/DESIGN.md § the diagrams), drawn in lines and nodes on a 2D canvas,
// with no library: `<canvas class="figure" data-figure="apex|world">`. They are drawings of an idea, not data, and
// the page's colophon says so. `apex` is still. `world` turns slowly while it is seen; with reduced motion it is
// drawn once.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const INK = '242 238 228', SUN = '255 198 90', ACT = '169 193 255', OK = '95 211 154';
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

// No throne: at the left, the structure the contract refuses (a pyramid of thirteen seats, one above the rest); at
// the right, the one it has (the same thirteen seats in a ring, all alike, around a middle that stays empty).
function apex() {
  const rows = [1, 2, 4, 6], N = 13;
  const seats = [];
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i += 1) seats.push({ x: count > 1 ? (i / (count - 1) - 0.5) * [0, 0.26, 0.6, 0.94][r] : 0, y: r / 3, rank: [1.9, 1.3, 1, 0.8][r], parent: r ? seats.length - i - rows[r - 1] + Math.floor((i * rows[r - 1]) / count) : -1 });
  });
  const paint = (g, w, h) => {
    const u = Math.min(w / 3, h / 2), cy = h * 0.47, font = px => `500 ${Math.round(u * px)}px ui-monospace, "SFMono-Regular", "DejaVu Sans Mono", monospace`;
    const dot = (x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Left: the pyramid, dim. Each seat answers to the one above it.
    const lx = w * 0.25, P = seats.map(s => [lx + s.x * u * 0.92, cy - u * 0.5 + s.y * u * 0.98]);
    g.lineWidth = Math.max(1, u * 0.004);
    g.strokeStyle = `rgb(${INK} / 0.3)`;
    g.beginPath();
    seats.forEach((s, i) => { if (s.parent >= 0) { g.moveTo(...P[i]); g.lineTo(...P[s.parent]); } });
    g.stroke();
    seats.forEach((s, i) => dot(P[i][0], P[i][1], u * 0.019 * s.rank, `rgb(${INK} / 0.55)`));
    g.strokeStyle = `rgb(${SUN} / 0.9)`;
    g.lineWidth = Math.max(1, u * 0.006);
    g.beginPath();
    g.arc(P[0][0], P[0][1], u * 0.075, 0, 6.2832);
    g.stroke();
    // Right: the ring. Each seat beside its neighbours, and nothing through the middle.
    const rx = w * 0.75, R = u * 0.56, Q = Array.from({ length: N }, (_, i) => { const a = (i / N) * 6.2832 - 1.5708; return [rx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    g.lineWidth = Math.max(1, u * 0.004);
    [0.6, 0.24, 0.1].forEach((alpha, d) => {
      g.strokeStyle = `rgb(${INK} / ${alpha})`;
      g.beginPath();
      for (let i = 0; i < N; i += 1) { g.moveTo(...Q[i]); g.lineTo(...Q[(i + d + 1) % N]); }
      g.stroke();
    });
    Q.forEach(q => dot(q[0], q[1], u * 0.022, `rgb(${INK})`));
    g.strokeStyle = `rgb(${SUN} / 0.7)`;
    g.lineWidth = Math.max(1, u * 0.005);
    g.setLineDash([u * 0.02, u * 0.02]);
    g.beginPath();
    g.arc(rx, cy, u * 0.27, 0, 6.2832);
    g.stroke();
    g.setLineDash([]);
    g.font = font(0.072);
    g.fillStyle = `rgb(${SUN})`;
    g.fillText('no office', rx, cy);
    // What each one is, under it, and the line between them.
    g.fillStyle = `rgb(${INK} / 0.62)`;
    g.fillText('one seat above the rest', lx, cy + u * 0.82);
    g.fillStyle = `rgb(${INK})`;
    g.fillText('thirteen equal seats', rx, cy + u * 0.82);
    g.strokeStyle = `rgb(${INK} / 0.2)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(w / 2, cy - u * 0.7);
    g.lineTo(w / 2, cy + u * 0.9);
    g.stroke();
    g.font = font(0.062);
    g.fillStyle = `rgb(${INK} / 0.5)`;
    g.fillText('not this', lx, cy - u * 0.82);
    g.fillStyle = `rgb(${SUN})`;
    g.fillText('this', rx, cy - u * 0.82);
  };
  return { paint, moves: false };
}

// The world at work: people, agents and machines as one graph on a globe that turns slowly. A piece of work starts
// at a person and passes from system to system along the lines.
function world() {
  const rnd = random(20261113), N = 150;
  const nodes = Array.from({ length: N }, (_, i) => {
    const y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
    const kind = rnd();
    return { v: [Math.cos(a) * r, y, Math.sin(a) * r], kind: kind < 0.2 ? 0 : kind < 0.66 ? 1 : 2, to: [] };
  });
  const far = (a, b) => (a.v[0] - b.v[0]) ** 2 + (a.v[1] - b.v[1]) ** 2 + (a.v[2] - b.v[2]) ** 2;
  const edges = [];
  nodes.forEach((n, i) => {
    const near = nodes.map((o, j) => [far(n, o), j]).sort((a, b) => a[0] - b[0]).slice(1, 4);
    for (const [, j] of near) if (!n.to.includes(j)) { n.to.push(j); nodes[j].to.push(i); edges.push([i, j]); }
  });
  const people = nodes.map((n, i) => (n.kind === 0 ? i : -1)).filter(i => i >= 0);
  // A piece of work: where it is, where it goes next, how far along, and how many more systems it will pass.
  const start = w => { w.a = people[Math.floor(rnd() * people.length)]; w.b = nodes[w.a].to[Math.floor(rnd() * nodes[w.a].to.length)]; w.u = 0; w.left = 3 + Math.floor(rnd() * 5); w.speed = 0.22 + rnd() * 0.16; return w; };
  const work = Array.from({ length: 16 }, () => { const w = start({}); w.u = rnd(); return w; });
  const COLOUR = [SUN, ACT, OK];
  let last = 0;
  const paint = (g, s, h, t) => {
    const dt = Math.min(0.05, Math.max(0, t - last));
    last = t;
    const a = t * ((2 * Math.PI) / 240) + 0.6, ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(0.38), st = Math.sin(0.38);
    // Turn about the pole, tip the pole toward the reader, and draw a little smaller what is farther away.
    const see = v => {
      const x = v[0] * ca + v[2] * sa, z0 = v[2] * ca - v[0] * sa, y = v[1] * ct - z0 * st, z = v[1] * st + z0 * ct, k = 1 / (1 - z * 0.16);
      return [(0.5 + x * 0.39 * k) * s, (0.5 - y * 0.39 * k) * s, z];
    };
    const P = nodes.map(n => see(n.v));
    for (const side of [-1, 1]) {
      g.lineWidth = Math.max(1, s * 0.0016);
      g.strokeStyle = `rgb(${INK} / ${side < 0 ? 0.07 : 0.24})`;
      g.beginPath();
      for (const [i, j] of edges) if ((P[i][2] + P[j][2] < 0 ? -1 : 1) === side) { g.moveTo(P[i][0], P[i][1]); g.lineTo(P[j][0], P[j][1]); }
      g.stroke();
      nodes.forEach((n, i) => {
        if ((P[i][2] < 0 ? -1 : 1) !== side) return;
        g.fillStyle = `rgb(${COLOUR[n.kind]} / ${side < 0 ? 0.28 : 0.55 + 0.45 * P[i][2]})`;
        g.beginPath();
        g.arc(P[i][0], P[i][1], s * (n.kind === 0 ? 0.0085 : 0.0062), 0, 6.2832);
        g.fill();
      });
      g.lineWidth = Math.max(1, s * 0.003);
      g.strokeStyle = `rgb(${INK} / ${side < 0 ? 0.2 : 0.8})`;
      g.beginPath();
      for (const w of work) {
        const A = P[w.a], B = P[w.b];
        if ((A[2] + (B[2] - A[2]) * w.u < 0 ? -1 : 1) !== side) continue;
        const e = smooth(w.u), tail = Math.max(0, e - 0.3);
        g.moveTo(A[0] + (B[0] - A[0]) * tail, A[1] + (B[1] - A[1]) * tail);
        g.lineTo(A[0] + (B[0] - A[0]) * e, A[1] + (B[1] - A[1]) * e);
      }
      g.stroke();
    }
    for (const w of work) {
      w.u += dt * w.speed;
      if (w.u < 1) continue;
      if ((w.left -= 1) <= 0) { start(w); continue; }
      const next = nodes[w.b].to.filter(j => j !== w.a);
      w.a = w.b;
      w.b = next[Math.floor(rnd() * next.length)] ?? nodes[w.a].to[0];
      w.u = 0;
    }
  };
  return { paint, moves: true };
}

const FIGURES = { apex, world };

function run(canvas) {
  const figure = FIGURES[canvas.dataset.figure]?.();
  if (!figure) return;
  const g = canvas.getContext('2d');
  const moves = () => figure.moves && !calm.matches;
  let visible = false, frame = 0;
  const t0 = performance.now();
  function draw(now) {
    frame = 0;
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    g.clearRect(0, 0, w, h);
    figure.paint(g, w, h, moves() ? (now - t0) / 1000 : 30);
    if (visible && moves()) frame = requestAnimationFrame(draw);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
  draw(performance.now());
  new ResizeObserver(wake).observe(canvas);
  new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); if (visible) wake(); }).observe(canvas);
  calm.addEventListener('change', wake);
  document.fonts?.ready.then(wake);
}

for (const canvas of document.querySelectorAll('canvas.figure')) run(canvas);
