// The Earth, as a camera in orbit sees it (redesign/DESIGN.md § the Earth). `<canvas class="earth">` is one WebGL2
// picture, traced per pixel: the ground from NASA's Blue Marble, the night side's lamps from NASA's Black Marble,
// clouds from noise, the air as a thin shell that turns orange where the sun is low, the sun, and the moon lit by that
// sun. The horizon lies across the bottom of the first screen and the sun comes up over it. The canvas is taller than
// that screen: the picture is framed on the canvas's parent (the first screen), and the ground goes on below it, into
// the night, under the words that follow. No library. With no WebGL2 the canvas stays empty and the page keeps its
// sky. With reduced motion one frame is drawn.
const VS = `#version 300 es
in vec2 aQ; void main() { gl_Position = vec4(aQ, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uMid; uniform float uHalf, uTime, uTan, uMoonR, uFlare; uniform vec3 uCam, uSun, uMoon, uMoonSun; uniform mat3 uBasis, uEarth; uniform vec2 uSunUV;
uniform sampler2D uDay, uNight, uMoonTex;
out vec4 o;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// A map of the whole sphere, read without a line where its left edge meets its right.
vec3 map(sampler2D t, vec3 n) {
  vec2 uv = vec2(atan(n.z, n.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(n.y, -1.0, 1.0)) / 3.14159265);
  vec2 alt = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv), ax = dFdx(alt), ay = dFdy(alt);
  if (abs(ax.x) < abs(dx.x)) dx = ax;
  if (abs(ay.x) < abs(dy.x)) dy = ay;
  return textureGrad(t, uv, dx, dy).rgb;
}
// Where a ray meets a sphere: the near distance, or -1.
float sphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 q = ro - c; float b = dot(q, rd), d = b * b - dot(q, q) + r * r;
  if (d < 0.0) return -1.0;
  return -b - sqrt(d);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - uMid) / uHalf;
  vec3 rd = normalize(uBasis * vec3(uv * uTan, 1.0));
  vec3 col = vec3(0.0); float alpha = 0.0;
  float t = sphere(uCam, rd, vec3(0.0), 1.0);
  float toSun = max(dot(rd, uSun), 0.0);
  if (t > 0.0) {
    vec3 n = normalize(uCam + rd * t);
    float mu = dot(n, uSun);
    float day = smoothstep(-0.10, 0.22, mu);
    vec3 e = uEarth * n;
    vec3 ground = pow(map(uDay, e), vec3(2.2));
    float sea = smoothstep(0.0, 0.06, ground.b - max(ground.r, ground.g) * 0.92);
    float cloud = smoothstep(0.56, 0.82, fbm(e * 3.4 + vec3(0.0, uTime * 0.004, 0.0)) * 0.72 + fbm(e * 11.0) * 0.38);
    vec3 low = mix(vec3(1.0, 0.60, 0.36), vec3(1.0), smoothstep(0.0, 0.30, mu));   // light through much air is red
    vec3 lit = mix(ground * 1.25, vec3(0.95), cloud * 0.92) * low * (max(mu, 0.0) * 1.7 + 0.025 * day);
    vec3 h = normalize(uSun - rd);
    lit += low * sea * (1.0 - cloud) * pow(max(dot(n, h), 0.0), 90.0) * 1.3 * day;
    vec3 lamps = pow(map(uNight, e), vec3(2.6)) * vec3(1.0, 0.80, 0.55) * 1.5 * (1.0 - day) * (1.0 - cloud * 0.75);
    vec3 dark = mix(ground, vec3(0.5), cloud) * vec3(0.010, 0.016, 0.034) * (1.0 - day);
    col = lit + lamps + dark;
    float graze = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col += vec3(0.16, 0.38, 1.0) * graze * (0.012 + 0.42 * smoothstep(-0.16, 0.25, mu));
    col += vec3(1.0, 0.36, 0.10) * graze * graze * smoothstep(-0.24, -0.02, mu) * (1.0 - smoothstep(0.02, 0.26, mu)) * (0.10 + 0.9 * pow(toSun, 10.0));
    alpha = 1.0;
  } else {
    float m = sphere(uCam, rd, uMoon, uMoonR);
    if (m > 0.0) {
      vec3 n = normalize(uCam + rd * m - uMoon);
      float face = pow(map(uMoonTex, n.zyx * vec3(1.0, 1.0, -1.0)).r, 2.2);
      col = vec3(1.0, 0.98, 0.94) * (0.25 + 1.4 * face) * (max(dot(n, uMoonSun), 0.0) * 1.7 + 0.035);
      alpha = smoothstep(0.0, 0.04, dot(n, -rd));
      col *= alpha;
    }
    // The air: how near the ray passes to the ground, and how high the sun is where it passes.
    float along = -dot(uCam, rd);
    vec3 near = uCam + rd * max(along, 0.0);
    float height = length(near) - 1.0;
    float sunHere = dot(normalize(near), uSun);
    float thick = exp(-height / 0.007), thin = exp(-height / 0.022);
    vec3 air = vec3(0.14, 0.38, 1.0) * (thick * 0.95 + thin * 0.16) * smoothstep(-0.24, 0.06, sunHere);
    air += vec3(1.0, 0.34, 0.08) * exp(-height / 0.0035) * smoothstep(-0.30, -0.03, sunHere) * (1.0 - smoothstep(0.03, 0.26, sunHere)) * (0.25 + 2.2 * pow(toSun, 8.0));
    air += vec3(1.0, 0.86, 0.66) * exp(-height / 0.003) * pow(toSun, 90.0) * 1.6;
    col += air * (1.0 - alpha);
    // The sun: its disc, its glare, and the streak a lens draws through it.
    float clear = 1.0 - alpha;
    float disc = smoothstep(0.99990, 0.99997, dot(rd, uSun));
    vec3 sun = vec3(1.0, 0.95, 0.86) * (disc * 40.0 + pow(toSun, 2600.0) * 5.0 + pow(toSun, 420.0) * 0.55) + vec3(1.0, 0.74, 0.46) * (pow(toSun, 60.0) * 0.16 + pow(toSun, 12.0) * 0.035);
    col += sun * clear;
  }
  vec2 fromSun = uv - uSunUV;
  col += vec3(1.0, 0.80, 0.55) * uFlare * (exp(-abs(fromSun.y) * 120.0) * exp(-abs(fromSun.x) * 2.2) * 0.42 + exp(-abs(fromSun.x) * 160.0) * exp(-abs(fromSun.y) * 6.0) * 0.12);
  col = 1.0 - exp(-col * 1.15);
  col = pow(col, vec3(1.0 / 2.2));
  float a = max(alpha, clamp(max(col.r, max(col.g, col.b)) * 1.6, 0.0, 1.0));
  o = vec4(col * a, a);
}`;

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rotX = a => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
const rotY = a => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
const rotZ = a => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(9);
  for (let c = 0; c < 3; c += 1) for (let r = 0; r < 3; r += 1) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
};
const DEG = Math.PI / 180;
const still = matchMedia('(prefers-reduced-motion: reduce)');

// The camera, the sun, the moon and the turn of the Earth at one time, for a first screen of this aspect.
export function view(time, aspect) {
  const tan = Math.tan(25 * DEG);
  const half = Math.atan(aspect * tan);                      // half the width of the picture, as an angle
  // In orbit, 0.15 of the Earth's radius up, looking ahead and down so the horizon lies across the lower third.
  const D = 1.15, dip = Math.acos(1 / D);
  const pitch = dip - Math.atan(0.46 * tan);
  const forward = [0, -Math.sin(pitch), Math.cos(pitch)], right = [1, 0, 0], up = cross(forward, right);
  // The sun comes up over the horizon in the first seconds, then climbs very slowly.
  const rise = -1.4 + 5.2 * (1 - Math.exp(-time / 7)) + Math.min(time, 240) * 0.006;
  const az = Math.min(0.20, half * 0.42), el = -dip + rise * DEG;
  const sun = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  // On a tall screen the words fill the middle, so the moon goes up beside the title.
  const maz = Math.min(0.44, half * 0.66), mel = -pitch + (aspect < 1 ? 20.5 : 14) * DEG;
  const moonDir = [Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)];
  const cam = [0, D, 0];
  // Where the sun is in the picture, for the lens's streak; the streak fades in as the sun clears the horizon.
  const sx = sun[0] * right[0] + sun[1] * right[1] + sun[2] * right[2], sy = sun[0] * up[0] + sun[1] * up[1] + sun[2] * up[2], sz = sun[0] * forward[0] + sun[1] * forward[1] + sun[2] * forward[2];
  // The moon is close to the sun in this sky, so it would be almost new. It is lit a little from the side instead,
  // from the sun's side, so it reads as a crescent: the one thing in the picture that is not where the light says.
  const along = sun[0] * moonDir[0] + sun[1] * moonDir[1] + sun[2] * moonDir[2];
  const moonSun = norm(sun.map((c, i) => c - moonDir[i] * along).map((c, i) => c / Math.sqrt(1 - along * along) + moonDir[i] * 0.5));
  return { cam, basis: [...right, ...up, ...forward], tan, sun, moonSun, moon: cam.map((c, i) => c + moonDir[i] * 60), moonR: 60 * Math.tan(1.5 * DEG), sunUV: [sx / sz / tan, sy / sz / tan],
    flare: Math.min(1, Math.max(0, (rise + 0.2) / 1.6)),
    earth: mul(mul(rotY(0.35), rotZ(0.72)), rotX(-time * ((2 * Math.PI) / 1500))) };
}

function texture(gl, unit, src, fallback) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(fallback));
  return new Promise(done => {
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      done();
    };
    img.onerror = () => done();
    img.src = src;
  });
}

function start(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(prog, s);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(prog, 'aQ');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const u = name => gl.getUniformLocation(prog, name);
  // A narrow screen, or a GPU with small textures, takes the smaller maps.
  const small = matchMedia('(max-width: 48rem)').matches || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096;
  const ready = Promise.all([
    texture(gl, 0, small ? 'sky/earth-day-2k.jpg' : 'sky/earth-day.jpg', [10, 30, 70, 255]),
    texture(gl, 1, small ? 'sky/earth-night-2k.jpg' : 'sky/earth-night.jpg', [0, 0, 0, 255]),
    texture(gl, 2, 'sky/moon.jpg', [150, 150, 150, 255]),
  ]);
  gl.uniform1i(u('uDay'), 0); gl.uniform1i(u('uNight'), 1); gl.uniform1i(u('uMoonTex'), 2);

  const screen = canvas.parentElement;
  let t0 = 0, frame = 0, seen = false;
  function draw(now) {
    frame = 0;
    const dpr = Math.min(matchMedia('(max-width: 48rem)').matches ? 2 : 1.5, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    // The picture is framed on the first screen; the canvas goes on below it.
    const top = Math.min(h, Math.round(screen.clientHeight * dpr));
    const v = view(still.matches ? 40 : (now - t0) / 1000, w / top);
    gl.uniform2f(u('uMid'), w / 2, h - top / 2);
    gl.uniform1f(u('uHalf'), top / 2);
    gl.uniform1f(u('uTime'), (now - t0) / 1000);
    gl.uniform1f(u('uTan'), v.tan);
    gl.uniform3fv(u('uCam'), v.cam); gl.uniform3fv(u('uSun'), v.sun); gl.uniform3fv(u('uMoon'), v.moon); gl.uniform3fv(u('uMoonSun'), v.moonSun);
    gl.uniform1f(u('uMoonR'), v.moonR); gl.uniform1f(u('uFlare'), v.flare); gl.uniform2fv(u('uSunUV'), v.sunUV);
    gl.uniformMatrix3fv(u('uBasis'), false, v.basis); gl.uniformMatrix3fv(u('uEarth'), false, v.earth);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.classList.add('is-on');
    if (seen && !still.matches && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
  ready.then(() => {
    t0 = performance.now();
    new IntersectionObserver(entries => { seen = entries.some(e => e.isIntersecting); if (seen) wake(); }).observe(canvas);
    new ResizeObserver(wake).observe(canvas);
    document.addEventListener('visibilitychange', wake);
    still.addEventListener('change', wake);
  });
}

if (typeof document !== 'undefined')
  for (const canvas of document.querySelectorAll('canvas.earth')) {
    try { start(canvas); } catch (e) { console.warn('earth:', e.message); }
  }
