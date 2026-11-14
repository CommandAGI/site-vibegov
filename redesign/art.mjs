#!/usr/bin/env node
// The dot pictures' sources (redesign/DESIGN.md § the dot pictures). Each brief is one generated still (fal, seedream
// v5 pro), kept outside the site (ART_RAW, by default the org Drive's media/dot-pictures/), then cut to a small greyscale map in art/<id>.png that dots.js draws as
// points of light. The page shows only the points; it never shows the still.
//
//   FAL_KEY=… node redesign/art.mjs make [id…]     2 candidates per brief into <ART_RAW>/<id>-<n>.jpg
//   node redesign/art.mjs cut <id> <n> [gamma] [polygon]   art/<id>.png from candidate n
//
// The pictures on the site: voice 1 1.15, ballot 1 1.1, scales 1 1.3,
// door 1 1.0 "0,0 1000,0 740,430 740,1560 0,1560" (the shaft of light above the door is painted out).
//
// In the CommandAGI checkout the key is the `fal` service account (docs/services.md); it is never printed.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// The stills are kept, outside the site's folder (a deploy uploads the whole folder): the org Drive's media/dot-pictures/.
const RAW = process.env.ART_RAW ?? join(ROOT, '../../media/dot-pictures');
const MODEL = 'bytedance/seedream/v5/pro/text-to-image';
const STYLE = 'Black and white studio photograph. One subject, isolated on a pure black background, lit by one hard light from the upper left, high contrast, deep black shadows, crisp edges. The subject is centred with a wide empty black margin on every side. No text, no letters, no logo, no watermark, no face.';
export const BRIEFS = {
  voice: 'A single human hand and forearm raised straight up with an open palm, as a person raises a hand to vote.',
  ballot: 'A human hand lowering a folded sheet of paper into the slot on top of a plain box, a ballot box.',
  scales: 'Classical brass balance scales, two pans hanging level from a centre post on a base.',
  door: 'A door standing wide open in darkness, bright light pouring through the doorway and spreading across the floor.',
};

async function still(key, prompt) {
  const auth = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
  const sub = await fetch(`https://queue.fal.run/${MODEL}`, { method: 'POST', headers: auth, body: JSON.stringify({ prompt, image_size: { width: 2048, height: 2048 }, num_images: 2, output_format: 'jpeg', enable_safety_checker: true }) });
  const job = await sub.json().catch(() => null);
  if (!sub.ok || !job?.status_url) throw Error(`fal ${sub.status}: ${JSON.stringify(job?.detail ?? job).slice(0, 300)}`);
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await (await fetch(job.status_url, { headers: auth })).json();
    if (s.status === 'COMPLETED') break;
    if (s.status !== 'IN_QUEUE' && s.status !== 'IN_PROGRESS') throw Error(`fal: ${JSON.stringify(s).slice(0, 300)}`);
  }
  const out = await (await fetch(job.response_url, { headers: auth })).json();
  if (!out.images?.length) throw Error(`fal: ${JSON.stringify(out?.detail ?? out).slice(0, 300)}`);
  return Promise.all(out.images.map(async i => Buffer.from(await (await fetch(i.url)).arrayBuffer())));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'make') {
  const key = process.env.FAL_KEY;
  if (!key) throw Error('FAL_KEY is not set');
  mkdirSync(RAW, { recursive: true });
  await Promise.all((rest.length ? rest : Object.keys(BRIEFS)).map(async id => {
    const bufs = await still(key, `${BRIEFS[id]} ${STYLE}`);
    bufs.forEach((b, n) => writeFileSync(join(RAW, `${id}-${n + 1}.jpg`), b));
    console.log(`${id}: ${bufs.length} candidates`);
  }));
} else if (cmd === 'cut') {
  const [id, n, gamma = '1', black] = rest;
  // 168 px square, 8-bit grey: one pixel is one possible dot.
  // `black` is a polygon (in the still's own pixels) painted out first: light that is not the subject.
  execFileSync('convert', [join(RAW, `${id}-${n}.jpg`), ...(black ? ['-fill', 'black', '-draw', `polygon ${black}`] : []), '-colorspace', 'Gray', '-resize', '168x168', '-level', '11%,92%', '-gamma', gamma, '-strip', '-define', 'png:compression-level=9', join(ROOT, 'art', `${id}.png`)]);
  console.log(`art/${id}.png from candidate ${n}`);
} else {
  console.error('usage: node redesign/art.mjs make [id…] | cut <id> <n> [gamma] [polygon]');
  process.exit(1);
}
