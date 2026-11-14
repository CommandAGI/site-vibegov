// The sky behind every page (redesign/DESIGN.md § the sky): stars as points of light, in one WebGL canvas with no
// library. The sky turns once in 20 minutes; the stars do not twinkle and do not follow the scroll. Nothing else is in it: the
// sun, the moon and the Earth belong to the front door's first screen (earth.js). With no WebGL the page keeps its
// plain dark ground. With reduced motion the sky is drawn still.
const canvas = document.getElementById('sky');
const gl = canvas?.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });

const VS = `
attribute vec3 aPos; attribute vec2 aData;
uniform mat3 uRot; uniform float uF, uAspect, uDpr;
varying vec3 vColor;
void main() {
  vec3 v = uRot * aPos;
  gl_Position = vec4(v.x * uF / uAspect, v.y * uF, 0.0, v.z);
  vec3 tint = mix(vec3(0.70, 0.80, 1.0), vec3(1.0, 0.90, 0.74), fract(aData.y * 7.31));
  gl_PointSize = max(1.0, aData.x * uDpr);
  vColor = tint * 0.86 * min(1.0, 0.25 + aData.x * 0.42);
}`;
const FS = `
precision mediump float; varying vec3 vColor;
void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * smoothstep(0.5, 0.30, d), 1.0); }`;

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

function start() {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.bindAttribLocation(p, 1, 'aData');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  const u = name => gl.getUniformLocation(p, name);
  const data = stars();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const FOV = (58 * Math.PI) / 180;
  let dpr = 1;
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  const t0 = performance.now();
  function draw() {
    const time = still.matches ? 0 : (performance.now() - t0) / 1000;
    const view = mul(rotX(-0.06), rotY(time * ((2 * Math.PI) / 1200)));
    gl.clearColor(0.016, 0.022, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix3fv(u('uRot'), false, view);
    gl.uniform1f(u('uF'), 1 / Math.tan(FOV / 2));
    gl.uniform1f(u('uAspect'), canvas.width / canvas.height);
    gl.uniform1f(u('uDpr'), dpr);
    gl.drawArrays(gl.POINTS, 0, data.length / 5);
  }
  let frame = 0;
  const loop = () => {
    draw();
    frame = still.matches || document.hidden ? 0 : requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };
  size();
  addEventListener('resize', () => { size(); draw(); });
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
