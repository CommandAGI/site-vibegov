#!/usr/bin/env node
// The site's generated media, made once on a maintainer's machine and committed (the site itself has no build).
// fal's key is read from the environment or the CommandAGI .env cascade and never printed or written anywhere.
// Run: COMMANDAGI_ENV_ROOT=<checkout> node redesign/media.mjs [name …]
// Writes redesign/raw/<name>.{png,mp4} (fal's originals, not deployed) and appends each call to redesign/raw/calls.jsonl;
// redesign/encode.sh turns them into media/.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
mkdirSync(RAW, { recursive: true });

const STYLE = 'archival documentary macro photograph, warm ivory and iron-gall ink palette, raking late-afternoon window light from the left, fine film grain, quiet, restrained, no text, no letters, no logos, no people, no faces';

export const STILLS = {
  ink: `Extreme macro of a steel fountain-pen nib resting on heavy ivory cotton laid paper, a single fresh line of blue-black iron gall ink trailing behind it, paper fibres and chain lines visible, shallow depth of field, ${STYLE}`,
  seal: `Close-up still life of a round burgundy sealing-wax seal on an ivory cotton paper document, the wax impression is an abstract engraved rosette of concentric fine lines with no letters, a burgundy silk ribbon passes under the wax, ${STYLE}`,
  archive: `Long low shelves of plain ivory archival document boxes tied with faded red cotton tape, receding into soft shadow, oak shelving, dust in a beam of window light, ${STYLE}`,
};
export const CLIPS = {
  ink: { from: 'ink', prompt: 'The pen nib glides slowly to the right, drawing the ink line further; the wet ink catches the light and wicks into the paper fibres. Static camera, slow and calm, no cuts.' },
  seal: { from: 'seal', prompt: 'A slow sweep of warm light passes across the red wax seal, revealing the fine engraved lines; very slow push in. Static subject, calm, no cuts.' },
  archive: { from: 'archive', prompt: 'Slow lateral dolly along the shelves of archive boxes, dust drifting in the light beam. Calm, steady, no cuts.' },
};
const IMAGE_MODEL = 'fal-ai/flux-pro/v1.1';
const VIDEO_MODEL = 'fal-ai/kling-video/v2.1/standard/image-to-video';

function key() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  const root = process.env.COMMANDAGI_ENV_ROOT;
  if (!root) throw new Error('set COMMANDAGI_ENV_ROOT to the CommandAGI checkout that holds the .env cascade');
  for (const file of ['.env', '.env.api']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, 'utf8').split('\n').find(l => l.startsWith('SVC__FAL__MAIN__API_KEY='));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('no SVC__FAL__MAIN__API_KEY in the .env cascade');
}

async function run(model, input) {
  const auth = { Authorization: `Key ${key()}`, 'Content-Type': 'application/json' };
  const submit = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: auth, body: JSON.stringify(input) });
  const queued = await submit.json();
  if (!submit.ok) throw new Error(`fal ${submit.status}: ${JSON.stringify(queued).slice(0, 300)}`);
  log({ submitted: model, requestId: queued.request_id, responseUrl: queued.response_url });
  for (;;) {
    await new Promise(r => setTimeout(r, 4000));
    const status = await (await fetch(queued.status_url, { headers: auth })).json();
    if (status.status === 'COMPLETED') break;
    if (status.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(status.status)) throw new Error(`fal ${model}: ${JSON.stringify(status).slice(0, 300)}`);
  }
  const result = await fetch(queued.response_url, { headers: auth });
  const body = await result.json();
  if (!result.ok) throw new Error(`fal ${result.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return { body, requestId: queued.request_id };
}

async function save(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

const log = entry => appendFileSync(join(RAW, 'calls.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);

async function still(name) {
  const path = join(RAW, `${name}.png`);
  if (existsSync(path)) return path;
  const input = { prompt: STILLS[name], image_size: { width: 1920, height: 1088 }, output_format: 'png', safety_tolerance: '5' };
  const { body, requestId } = await run(IMAGE_MODEL, input);
  if (body.has_nsfw_concepts?.[0]) throw new Error(`${name}: fal's safety checker blanked the image; reword the prompt`);
  await save(body.images[0].url, path);
  log({ name, kind: 'still', model: IMAGE_MODEL, prompt: input.prompt, requestId, estimatedUsd: 0.04 * 2 });
  return path;
}

async function clip(name) {
  const path = join(RAW, `${name}.mp4`);
  if (existsSync(path)) return path;
  const { from, prompt } = CLIPS[name];
  const image = readFileSync(await still(from)).toString('base64');
  const input = { prompt, image_url: `data:image/png;base64,${image}`, duration: '5', negative_prompt: 'text, letters, watermark, people, hands, fast motion, flicker, cuts' };
  const { body, requestId } = await run(VIDEO_MODEL, input);
  await save(body.video.url, path);
  log({ name, kind: 'clip', model: VIDEO_MODEL, from, prompt, requestId, estimatedUsd: 0.25 });
  return path;
}

const names = process.argv.slice(2);
const wanted = names.length ? names : Object.keys(CLIPS);
await Promise.all(wanted.map(async name => {
  const out = CLIPS[name] ? await clip(name) : await still(name);
  console.log(`${name}: ${out}`);
}));
