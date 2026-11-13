// The dot pictures (redesign/DESIGN.md § the dot pictures): each `<canvas class="dots" data-src="art/<id>.png">` is
// drawn as points of light, one for each bright pixel of its map. Until the picture is seen its points lie scattered
// like stars; when it scrolls into view they gather into the picture, and then shimmer. With reduced motion the
// picture is drawn gathered and still.
const still = matchMedia('(prefers-reduced-motion: reduce)');
const ease = t => 1 - Math.pow(1 - t, 4);

async function picture(canvas) {
  const img = new Image();
  img.src = canvas.dataset.src;
  await img.decode();
  const n = img.width;
  const map = Object.assign(document.createElement('canvas'), { width: n, height: n }).getContext('2d', { willReadFrequently: true });
  map.drawImage(img, 0, 0);
  const px = map.getImageData(0, 0, n, n).data;
  // One point for each pixel that is bright enough; a narrow screen takes every second row and column.
  const step = matchMedia('(max-width: 40rem)').matches ? 2 : 1;
  const dots = [];
  let seed = n * 7919;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < n; y += step)
    for (let x = (y / step) % 2 ? step / 2 : 0; x < n; x += step) {
      // The picture fades to nothing toward its edge, so it has no frame.
      const edge = Math.min(1, Math.max(0, (0.5 - Math.hypot(x / n - 0.5, y / n - 0.5)) / 0.13));
      const lum = (px[(y * n + Math.floor(x)) * 4] / 255) * edge * edge * (3 - 2 * edge);
      if (lum < 0.09) continue;
      const a = rnd() * Math.PI * 2, d = 0.25 + rnd() * 0.75;
      dots.push({ x: (x + 0.5) / n, y: (y + 0.5) / n, lum, sx: 0.5 + Math.cos(a) * d * 0.9, sy: 0.5 + Math.sin(a) * d * 0.9, delay: rnd() * 0.45, phase: rnd() * 6.283, star: rnd() < 0.045 });
    }
  const g = canvas.getContext('2d');
  let size = 0, dpr = 1, seenAt = 0, visible = false, frame = 0;

  function fit() {
    dpr = Math.min(2, devicePixelRatio || 1);
    size = canvas.clientWidth;
    canvas.width = canvas.height = Math.round(size * dpr);
  }
  function draw(now) {
    frame = 0;
    const t = still.matches ? 9 : seenAt ? (now - seenAt) / 1000 : 0;
    const cell = (canvas.width / n) * step;
    g.clearRect(0, 0, canvas.width, canvas.height);
    // Five levels of light, each one path: bright points are warm, dim ones cool.
    const levels = [[], [], [], [], []];
    for (const d of dots) {
      const p = seenAt ? ease(Math.min(1, Math.max(0, (t - d.delay) / 1.5))) : 0;
      if (p === 0 && !d.star) continue;
      const shimmer = still.matches ? 1 : 0.86 + 0.14 * Math.sin(t * 1.3 + d.phase);
      const light = d.lum * shimmer * (0.25 + 0.75 * p);
      levels[Math.min(4, Math.floor(light * 5))].push(d.sx + (d.x - d.sx) * p, d.sy + (d.y - d.sy) * p, cell * (0.16 + 0.34 * Math.sqrt(d.lum)) * (0.55 + 0.45 * p));
    }
    const colour = ['rgb(104 128 186 / 0.55)', 'rgb(150 170 220 / 0.75)', 'rgb(206 214 236 / 0.9)', 'rgb(246 238 216)', 'rgb(255 247 226)'];
    levels.forEach((pts, i) => {
      g.fillStyle = colour[i];
      g.beginPath();
      for (let k = 0; k < pts.length; k += 3) {
        const x = pts[k] * canvas.width, y = pts[k + 1] * canvas.height, r = pts[k + 2];
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, 6.2832);
      }
      g.fill();
    });
    if (visible && !still.matches) frame = requestAnimationFrame(draw);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
  fit();
  draw(performance.now());
  new ResizeObserver(() => { fit(); wake(); }).observe(canvas);
  new IntersectionObserver(entries => {
    for (const e of entries) {
      visible = e.isIntersecting;
      if (e.intersectionRatio > 0.3 && !seenAt) seenAt = performance.now();
    }
    if (visible) wake();
  }, { threshold: [0, 0.3] }).observe(canvas);
  still.addEventListener('change', wake);
}

for (const canvas of document.querySelectorAll('canvas.dots')) picture(canvas).catch(() => canvas.classList.add('is-missing'));

// A recording plays only while it is on screen, and not at all for a reader who asked for less motion.
for (const video of document.querySelectorAll('video[data-loop]')) {
  new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting && !still.matches) video.play().catch(() => {});
      else video.pause();
    }
  }, { threshold: 0.25 }).observe(video);
  if (still.matches) video.controls = true;
}
