// The sky behind every page (redesign/DESIGN.md § the sky): stars, the sun, the moon and, where a page has a
// `.globe` box, the Earth drawn as points of light, its land from art/land.png. The camera turns slowly, and a
// little more as the page scrolls. One WebGL canvas, no library. With no WebGL the page keeps its plain dark ground.
// With reduced motion the sky is drawn still.
const canvas = document.getElementById('sky');
const gl = canvas?.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });

const POINT_VS = `
attribute vec3 aPos; attribute vec2 aData;
uniform int uMode; uniform mat3 uRot; uniform vec2 uCenter, uScale; uniform vec3 uSun;
uniform float uF, uAspect, uTime, uDpr, uSize, uAlpha;
varying vec4 vColor;
void main() {
  if (uMode == 0) {                                   // a star: a direction on the sky
    vec3 v = uRot * aPos;
    gl_Position = vec4(v.x * uF / uAspect, v.y * uF, 0.0, v.z);
    float tw = 0.72 + 0.28 * sin(uTime * (0.5 + aData.y * 2.4) + aData.y * 43.0);
    vec3 tint = mix(vec3(0.70, 0.80, 1.0), vec3(1.0, 0.90, 0.74), fract(aData.y * 7.31));
    gl_PointSize = max(1.0, aData.x * uDpr);
    vColor = vec4(tint * tw * min(1.0, 0.25 + aData.x * 0.42), 1.0) * uAlpha;
  } else if (uMode == 3) {                            // the sun: a disc of points and its corona
    float r = length(aPos.xy);
    float wave = 0.55 + 0.45 * sin(uTime * 0.9 - r * 4.0 + aData.y * 6.283);
    float glow = r < 1.0 ? 1.0 : wave / (r * r * r);
    gl_Position = vec4(uCenter + uScale * aPos.xy, 0.0, 1.0);
    gl_PointSize = uSize * aData.x * uDpr * (r < 1.0 ? 1.0 : 0.5 + 0.5 * wave);
    vColor = vec4(mix(vec3(1.0, 0.96, 0.84), vec3(1.0, 0.62, 0.22), clamp((r - 0.6) / 2.2, 0.0, 1.0)) * glow, 1.0) * uAlpha;
  } else {                                            // a point on a sphere: the Earth (1) or the moon (2)
    vec3 n = uRot * aPos;
    float facing = -n.z;
    gl_Position = vec4(uCenter + uScale * n.xy, 0.0, 1.0);
    if (facing <= 0.03) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec4(0.0); return; }
    float lit = dot(n, uSun);
    float day = smoothstep(-0.10, 0.24, lit);
    vec3 c;
    float size = uSize * (0.42 + 0.58 * facing);
    if (uMode == 1) {
      if (aData.x > 0.5) {
        vec3 sunlit = vec3(1.0, 0.95, 0.83) * (0.62 + 0.38 * clamp(lit, 0.0, 1.0));
        vec3 dark = vec3(0.20, 0.27, 0.44) * 0.62;
        float lamp = step(0.80, aData.y) * (0.75 + 0.25 * sin(uTime * 1.7 + aData.y * 91.0));
        dark = mix(dark, vec3(1.0, 0.70, 0.34), lamp);
        c = mix(dark, sunlit, day);
      } else {
        c = mix(vec3(0.05, 0.08, 0.16), vec3(0.16, 0.34, 0.70), day) * 0.9;
        size *= 0.62;
      }
    } else {
      float albedo = 0.62 + 0.38 * fract(aData.y * 13.7);
      c = vec3(0.90, 0.91, 0.96) * albedo * (0.05 + 0.95 * day);
    }
    gl_PointSize = max(1.0, size * uDpr);
    vColor = vec4(c, 1.0) * uAlpha * smoothstep(0.03, 0.2, facing);
  }
}`;
const POINT_FS = `
precision mediump float; varying vec4 vColor;
void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vColor * smoothstep(0.5, 0.30, d); }`;
const DISC_VS = `
attribute vec2 aQ; uniform vec2 uCenter, uScale; uniform mediump float uExtent; varying vec2 vP;
void main() { vP = aQ * uExtent; gl_Position = vec4(uCenter + uScale * vP, 0.0, 1.0); }`;
const DISC_FS = `
precision mediump float; varying vec2 vP; uniform int uMode; uniform vec3 uSun; uniform float uAlpha, uExtent;
void main() {
  float r = length(vP);
  if (uMode == 0) {                                   // the Earth's body and its air
    float body = smoothstep(1.0, 0.988, r);
    float z = sqrt(max(0.0, 1.0 - r * r));
    float day = smoothstep(-0.15, 0.35, dot(vec3(vP, -z), uSun));
    vec3 c = mix(vec3(0.010, 0.014, 0.028), vec3(0.022, 0.060, 0.150), day);
    c += vec3(0.22, 0.48, 1.0) * pow(1.0 - z, 3.0) * (0.05 + 0.85 * day);
    float limb = smoothstep(-0.45, 0.55, dot(normalize(vec3(vP, -0.18)), uSun));
    vec3 air = vec3(0.26, 0.52, 1.0) * exp(-(max(r, 1.0) - 1.0) * 11.0) * (0.04 + 0.66 * limb);
    gl_FragColor = vec4(c * body + air * (1.0 - body), body) * uAlpha;
  } else if (uMode == 1) {                            // the moon's body: it hides the stars behind it
    float body = smoothstep(1.0, 0.96, r);
    gl_FragColor = vec4(vec3(0.016, 0.018, 0.026) * body, body) * uAlpha;
  } else {                                            // the sun's light
    float g = exp(-r * r * 1.6) + 0.30 / (1.0 + r * r * 5.0);
    g *= smoothstep(uExtent, uExtent * 0.35, r);
    gl_FragColor = vec4(vec3(1.0, 0.76, 0.40) * g * uAlpha, 0.0);
  }
}`;

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, vs.includes('aQ') ? 'aQ' : 'aPos');
  gl.bindAttribLocation(p, 1, 'aData');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i += 1) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

// A fixed random sequence: the sky is the same sky on every visit.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const rotY = a => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
const rotX = a => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
const rotZ = a => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
// Column-major 3×3 matrices, as WebGL reads them.
const mul = (a, b) => {
  const o = new Array(9);
  for (let c = 0; c < 3; c += 1) for (let r = 0; r < 3; r += 1) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
};
const apply = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

function stars() {
  const rnd = random(20261113);
  const out = [];
  const add = (v, size) => out.push(...v, size, rnd());
  for (let i = 0; i < 5200; i += 1) {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    add([s * Math.cos(a), z, s * Math.sin(a)], 0.9 + Math.pow(rnd(), 9) * 3.4 + rnd() * 0.7);
  }
  // A band of faint stars along one great circle: the galaxy seen edge on.
  const tilt = mul(rotZ(1.02), rotX(0.48));
  for (let i = 0; i < 5200; i += 1) {
    const a = rnd() * Math.PI * 2, spread = (rnd() + rnd() + rnd() - 1.5) * 0.24;
    add(apply(tilt, norm([Math.cos(a), spread, Math.sin(a)])), 0.7 + rnd() * 0.8);
  }
  return new Float32Array(out);
}

function sunPoints() {
  const rnd = random(7);
  const out = [];
  for (let i = 0; i < 1500; i += 1) {
    const r = Math.sqrt((i + 0.5) / 420), a = i * 2.39996323;
    if (r > 3.4) break;
    out.push(r * Math.cos(a), r * Math.sin(a), 0, r < 1 ? 1 : Math.max(0.35, 1.05 - r * 0.24), rnd());
  }
  return new Float32Array(out);
}

// Points spread evenly over a sphere (a Fibonacci lattice). `keep(lat, lon, i)` says what each one is, or drops it.
function sphere(count, keep) {
  const rnd = random(count);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + 0.5) / count) * 2, s = Math.sqrt(1 - y * y), a = i * 2.39996323;
    const kind = keep(Math.asin(y), Math.atan2(Math.sin(a), Math.cos(a)), i);
    if (kind !== null) out.push(s * Math.cos(a), y, s * Math.sin(a), kind, rnd());
  }
  return new Float32Array(out);
}

async function landMask() {
  const img = new Image();
  img.src = 'art/land.png';
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  return (lat, lon) => {
    const x = Math.min(c.width - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * c.width));
    const y = Math.min(c.height - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * c.height));
    return px[(y * c.width + x) * 4] > 127;
  };
}

function start() {
  const points = program(POINT_VS, POINT_FS);
  const disc = program(DISC_VS, DISC_FS);
  const buffer = (data, size) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { b, n: data.length / size };
  };
  const sky = buffer(stars(), 5);
  const sun = buffer(sunPoints(), 5);
  const moon = buffer(sphere(2600, () => 1), 5);
  const quad = buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2);
  let earth = null;
  let earthAt = 0;
  landMask().then(isLand => {
    // Land from one lattice, the sea from a sparser one. East is the lattice's +z, so the longitude's sign turns.
    const n = matchMedia('(max-width: 40rem)').matches ? 30000 : 56000;
    const land = sphere(n, (lat, lon) => (isLand(lat, lon) ? 1 : null));
    const sea = sphere(Math.round(n / 5), (lat, lon) => (isLand(lat, lon) ? null : 0));
    const all = new Float32Array(land.length + sea.length);
    all.set(land);
    all.set(sea, land.length);
    earth = buffer(all, 5);
    earthAt = performance.now();
    draw();
  }).catch(() => {});

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const globes = [...document.querySelectorAll('.globe')];
  const SUN = norm([-0.82, 0.18, -0.5]);
  const MOON = norm([0.5, 0.2, -0.8]);
  const FOV = (58 * Math.PI) / 180;
  let W = 0, H = 0, dpr = 1;

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function bindPoints(buf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  }
  function drawDisc(mode, cx, cy, r, extent, sunView, alpha) {
    gl.useProgram(disc.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad.b);
    gl.disableVertexAttribArray(1);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.uniform1i(disc.u.uMode, mode);
    gl.uniform2f(disc.u.uCenter, (cx / W) * 2 - 1, 1 - (cy / H) * 2);
    gl.uniform2f(disc.u.uScale, (r / W) * 2, (r / H) * 2);
    gl.uniform1f(disc.u.uExtent, extent);
    gl.uniform3fv(disc.u.uSun, sunView);
    gl.uniform1f(disc.u.uAlpha, alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function drawPoints(buf, mode, rot, cx, cy, r, sizePx, sunView, alpha, time) {
    gl.useProgram(points.p);
    bindPoints(buf);
    gl.uniform1i(points.u.uMode, mode);
    gl.uniformMatrix3fv(points.u.uRot, false, rot);
    gl.uniform2f(points.u.uCenter, (cx / W) * 2 - 1, 1 - (cy / H) * 2);
    gl.uniform2f(points.u.uScale, (r / W) * 2, (r / H) * 2);
    gl.uniform3fv(points.u.uSun, sunView);
    gl.uniform1f(points.u.uF, 1 / Math.tan(FOV / 2));
    gl.uniform1f(points.u.uAspect, W / H);
    gl.uniform1f(points.u.uTime, time);
    gl.uniform1f(points.u.uDpr, dpr);
    gl.uniform1f(points.u.uSize, sizePx);
    gl.uniform1f(points.u.uAlpha, alpha);
    gl.drawArrays(gl.POINTS, 0, buf.n);
  }
  // Where a direction of the sky falls on the screen, in CSS pixels, or null when it is behind the camera.
  function onScreen(view, dir) {
    const v = apply(view, dir);
    if (v[2] <= 0.05) return null;
    const f = 1 / Math.tan(FOV / 2);
    return [((v[0] * f) / (W / H) / v[2] * 0.5 + 0.5) * W, (0.5 - (v[1] * f) / v[2] * 0.5) * H];
  }

  const t0 = performance.now();
  function draw() {
    const now = performance.now();
    const time = still.matches ? 0 : (now - t0) / 1000;
    const scroll = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    // The camera: one turn of the sky in eleven minutes, and most of a turn more from the top of the page to its end.
    const yaw = time * ((2 * Math.PI) / 660) + scroll * 4.6;
    const view = mul(rotX(-0.06 - scroll * 0.12), rotY(yaw));
    const sunView = apply(view, SUN);

    gl.clearColor(0.016, 0.022, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    drawPoints(sky, 0, view, 0, 0, 1, 1, sunView, 1, time);

    const unit = H / 2 / Math.tan(FOV / 2);
    const s = onScreen(view, SUN);
    if (s) {
      const r = Math.max(15, unit * 0.036);
      drawDisc(2, s[0], s[1], r, 16, sunView, 0.9);
      drawPoints(sun, 3, view, s[0], s[1], r, r * 0.115, sunView, 1, time);
    }
    const m = onScreen(view, MOON);
    if (m) {
      const r = Math.max(17, unit * 0.05);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      drawDisc(1, m[0], m[1], r, 1.05, sunView, 1);
      gl.blendFunc(gl.ONE, gl.ONE);
      drawPoints(moon, 2, rotY(0.5), m[0], m[1], r, r * 0.055, sunView, 1, time);
    }

    // The Earth, in the page's `.globe` box that is on screen.
    for (const box of globes) {
      const b = box.getBoundingClientRect();
      if (b.bottom < -80 || b.top > H + 80 || !b.width) continue;
      const r = Math.min(b.width, b.height) / 2;
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const alpha = earth ? Math.min(1, (now - earthAt) / 1400) : 0;
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      drawDisc(0, cx, cy, r, 1.6, sunView, 1);
      gl.blendFunc(gl.ONE, gl.ONE);
      if (earth) {
        const spin = mul(view, mul(rotZ(0.41), rotY(time * ((2 * Math.PI) / 240) - 0.62)));
        drawPoints(earth, 1, spin, cx, cy, r, Math.max(1.35, r * 0.0098), sunView, alpha, time);
      }
    }
  }

  let frame = 0;
  const loop = () => {
    draw();
    frame = still.matches || document.hidden ? 0 : requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };
  size();
  addEventListener('resize', () => { size(); draw(); });
  addEventListener('scroll', () => { if (!frame) draw(); }, { passive: true });
  document.addEventListener('visibilitychange', wake);
  still.addEventListener('change', wake);
  canvas.classList.add('is-on');
  loop();
}

if (gl) {
  try {
    start();
  } catch (e) {
    console.warn('sky:', e.message);
  }
}
