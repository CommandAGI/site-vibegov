#!/usr/bin/env node
// A local CommandAGI platform for the journeys (test/journeys.py): the api worker under workerd, its own database and
// files in one folder, with nothing reaching the network. Never production: the Coordination Contract there is a real
// public ledger.
//
//   nice -n 10 node test/platform.mjs --dir <state folder> [--port 8799] [--no-build] [--fake-engine]
//
// It prints `platform <base>` when it answers, and stops on SIGINT/SIGTERM. What it changes from a person's local
// platform, and why:
// - `cloud: ''`: the cloud gate is off, so the contract's routes are answered here. With the default, the gate would
//   forward every /contract call to https://api.commandagi.com with the caller's token.
// - `outbound`: every request the worker makes to another host is refused here (503) and printed, so the run proves
//   nothing left this machine. No service account is given: no model key, no Turnstile, no Stripe.
// - the daily sign-up cap is raised (a fresh platform's migrations make about 70 accounts dated today).
// - `TICK_DUTIES=platform`: the contract's sweep runs on `POST /__tick` of this script's own control port.
//
// COMMANDAGI_ROOT is the CommandAGI checkout (default: five folders up, the checkout this site is mounted in).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.COMMANDAGI_ROOT || path.resolve(here, '../../../../../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const dir = path.resolve(arg('dir') ?? '.platform');
const port = Number(arg('port', 8799));
const control = Number(arg('control', port + 1));
mkdirSync(dir, { recursive: true });
// Miniflare writes `.wrangler/` in the working folder: keep it in the state folder, never in the site (a deploy uploads
// the site folder whole).
process.chdir(dir);

const globalDir = path.join(dir, 'global');
if (!existsSync(globalDir)) cpSync(path.join(ROOT, 'global'), globalDir, { recursive: true });
const settingsFile = path.join(globalDir, 'settings.json');
const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
settings['signup.dailyCap'] = 10000;
writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');

// --fake-engine: the contract's engine seats answer here, offline. Each model operator the engine names gets a service
// account whose key is "fake-engine"; a call to its host is answered by `fakeSeat` with one label from the question's
// own set (the first of FAKE_ENGINE_PREFER that the set holds, else the set's first). It stands in for the models so
// the sweep can read an RFC and decide a case; its answers mean nothing. The Workers AI seats stay unavailable (no `AI`
// binding here).
const FAKE_HOSTS = { 'api.openai.com': 'openai', 'api.anthropic.com': 'anthropic', 'api.typesafe.ai': 'typesafe', 'api.deepinfra.com': 'deepinfra', 'dashscope-intl.aliyuncs.com': 'dashscope', 'openrouter.ai': 'openrouter' };
const fakeEngine = process.argv.includes('--fake-engine');
const PREFER = (process.env.FAKE_ENGINE_PREFER ?? '').split(',').map(s => s.trim()).filter(Boolean);
const pick = labels => PREFER.find(l => labels.includes(l)) ?? labels[0];
const seatBindings = () => Object.fromEntries([...new Set(Object.values(FAKE_HOSTS))].map(service => [`SVC__${service.toUpperCase()}__FAKE`, JSON.stringify({ fields: { API_KEY: 'fake-engine' }, priority: 0, purposes: [], limits: [], enabled: true })]));
const asked = [];
async function fakeSeat(request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const json = v => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
  // OpenAI's chat completions (and the hosts that copy it): the label set is the schema's enum.
  const schemaLabels = body?.response_format?.json_schema?.schema?.properties?.label?.enum;
  if (schemaLabels) { asked.push({ host: url.host, labels: schemaLabels }); return json({ choices: [{ message: { content: JSON.stringify({ label: pick(schemaLabels), confidence: 900, reason: 'A stand-in seat of the journeys: this answer means nothing.' }) } }] }); }
  // Anthropic's Messages API: the determination tool's input schema.
  const toolLabels = body?.tools?.[0]?.input_schema?.properties?.label?.enum;
  if (toolLabels) { asked.push({ host: url.host, labels: toolLabels }); return json({ content: [{ type: 'tool_use', name: 'determination', input: { label: pick(toolLabels), confidence: 900, reason: 'A stand-in seat of the journeys: this answer means nothing.' } }] }); }
  // System One's decisions (TypeSafe and the routers that copy it): one choice question per name.
  if (body?.questions && !Array.isArray(body.questions)) {
    const answers = {};
    for (const [name, q] of Object.entries(body.questions)) {
      const labels = Object.keys(q.criteria ?? {});
      const choice = pick(labels);
      asked.push({ host: url.host, labels });
      answers[name] = { type: 'choice', choice, probabilities: Object.fromEntries(labels.map(l => [l, l === choice ? 0.9 : 0.1 / Math.max(1, labels.length - 1)])), confidence: 0.9 };
    }
    return json({ model: body.model, answers });
  }
  // Image rendering for evidence (chat completions with no schema): a literal description.
  const rendering = 'A stand-in rendering of the journeys: an image was attached.';
  if (Array.isArray(body?.messages)) return json(url.hostname === 'api.anthropic.com' ? { content: [{ type: 'text', text: rendering }] } : { choices: [{ message: { content: rendering } }] });
  return null;
}

const refused = [];
const { startCheckoutPlatform } = await import(pathToFileURL(path.join(ROOT, 'scripts/workbench/local-platform.mjs')).href);
const p = await startCheckoutPlatform({
  dir, port, build: !process.argv.includes('--no-build'), globalDir, cloud: '',
  // `vars`, not `bindings`: a `bindings` option replaces the starter's own (FEATURE_FLAGS=all, which turns the contract on).
  vars: { TICK_DUTIES: 'platform', ...(fakeEngine ? seatBindings() : {}) },
  outbound: async request => {
    if (fakeEngine && FAKE_HOSTS[new URL(request.url).hostname]) { const r = await fakeSeat(request); if (r) return r; }
    refused.push(`${request.method} ${new URL(request.url).host}`);
    console.log(`outbound refused: ${request.method} ${request.url}`);
    return new Response(JSON.stringify({ error: 'offline', message: 'the journeys run with no network' }), { status: 503, headers: { 'content-type': 'application/json' } });
  },
});

// The control port: run the scheduled handler once (the contract's sweep), and say what the worker tried to reach.
const ctl = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url.startsWith('/__tick')) {
      const at = new URL(req.url, 'http://x').searchParams.get('at');
      await p.scheduled(at ? new Date(Number(at)) : new Date());
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}');
    }
    if (req.url === '/__asked') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(asked)); }
    if (req.url === '/__outbound') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(refused)); }
    res.writeHead(404); res.end();
  } catch (e) { res.writeHead(500); res.end(String(e?.stack ?? e)); }
});
await new Promise(r => ctl.listen(control, '127.0.0.1', r));
console.log(`platform ${p.base} control http://127.0.0.1:${control} state ${dir} log ${p.logFile}`);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { ctl.close(); p.stop().finally(() => process.exit(0)); });
