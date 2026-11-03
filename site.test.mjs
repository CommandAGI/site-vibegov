// The site of VibeGov, the Coordination Contract's home: four pages, the contract's text in its markers, and the live
// record read from the public API. live.js is run against a fake API on a local port (its HTTP edge), and verify.js
// against real entries of the record (fixtures/). Run: node --test site.test.mjs
// That contract.html renders docs/coordination-contract.md as it is, the CommandAGI repository checks
// (node scripts/seed/vibegov-contract.mjs --check, in scripts/checks/check-generated-files.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './live.js';
import { kernelHash, logProblems } from './verify.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://vibegov.pro';
const PAGES = ['index.html', 'record.html', 'contract.html', 'join.html'];
const read = path => readFileSync(join(ROOT, path), 'utf8');
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

test('the site manifest names VibeGov and no build', () => {
  const site = JSON.parse(read('site.json'));
  assert.equal(site.v, 1);
  assert.equal(site.slug, 'vibegov');
  assert.equal(site.status, 'active');
  assert.ok(!site.build, 'a static folder: no build');
  assert.match(site.description, /Coordination Contract/);
  assert.deepEqual(site.domains, [], 'domains are the platform\'s record, not the folder\'s');
  assert.deepEqual(Object.keys(JSON.parse(read('package.json'))).sort(), ['private', 'type'], 'package.json names no framework: only that the scripts are modules');
});

test('four pages, in English, each with its canonical address and the same contents line', () => {
  const html = readdirSync(ROOT, { recursive: true }).filter(f => String(f).endsWith('.html') && !String(f).startsWith('redesign'));
  assert.deepEqual(html.sort(), [...PAGES].sort(), 'the pages are these four');
  for (const page of PAGES) {
    const text = read(page);
    assert.match(text, /<html lang="en">/, `${page}: English`);
    assert.match(text, new RegExp(`<link rel="canonical" href="${ORIGIN}/${page === 'index.html' ? '' : page}">`), `${page}: canonical`);
    const contents = text.match(/<nav id="contents"[\s\S]*?<\/nav>/)[0];
    assert.deepEqual([...contents.matchAll(/href="([^"]+)"/g)].map(m => m[1]), PAGES, `${page}: the contents line`);
    assert.match(contents, new RegExp(`href="${page}" aria-current="page"`), `${page}: marks itself`);
  }
});

test('every relative link and asset resolves on disk', () => {
  for (const page of PAGES) {
    const text = read(page);
    for (const [, ref] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(mailto:|https?:|data:)/.test(ref)) continue;
      if (ref.startsWith('#')) {
        assert.match(text, new RegExp(`id="${ref.slice(1)}"`), `${page}: ${ref} names no element`);
        continue;
      }
      assert.ok(existsSync(resolve(ROOT, ref.split('#')[0])), `${page}: ${ref} does not resolve`);
    }
  }
});

test('a page connects to the public API and nothing else; no asset comes from another host', () => {
  for (const page of PAGES) {
    const text = read(page);
    const csp = text.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${page}: a CSP`);
    for (const rule of ["default-src 'self'", "script-src 'self'", "connect-src 'self' https://api.commandagi.com;"]) assert.ok(csp.includes(rule), `${page}: ${rule}`);
    assert.match(text, /<meta name="vibegov-api" content="https:\/\/api\.commandagi\.com">/, `${page}: the API it reads`);
    assert.match(csp, page === 'join.html' ? /form-action https:\/\/commandagi\.com(;|$)/ : /form-action 'none'/, `${page}: form-action`);
    for (const [, ref] of text.matchAll(/<(?:script|img|source|link rel="(?:stylesheet|preload|icon|apple-touch-icon)")[^>]*(?:src|href)="(https?:[^"]+)"/g))
      assert.fail(`${page}: an asset from another host (${ref})`);
  }
  const form = read('join.html').match(/<form[^>]*>/)[0];
  assert.match(form, /action="https:\/\/commandagi\.com\/app" method="get"/, 'the prompt goes to the workbench as ?prompt=');
  assert.match(read('join.html'), /<textarea[^>]*name="prompt"/);
});

test('no generated picture stands in for the record: the mark, and frames of a recorded run labelled as recordings', () => {
  assert.ok(!existsSync(join(ROOT, 'media')), 'no media folder');
  const run = readdirSync(join(ROOT, 'robots/labrat')).sort();
  assert.deepEqual(run, ['pick-at-the-collar.jpg', 'pick-lifted.jpg', 'run.json', 'servos.jsonl'], 'the run, copied from its world by scripts/seed/vibegov-contract.mjs');
  assert.equal(JSON.parse(read('robots/labrat/run.json')).reality, 'simulation');
  for (const page of PAGES) {
    const text = read(page);
    assert.doesNotMatch(text, /<video|<picture|\.webp|\.mp4/, `${page}: no footage`);
    for (const [img, src] of text.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)) {
      if (src === 'mark.svg') continue;
      assert.match(src, /^robots\/labrat\/[a-z-]+\.jpg$/, `${page}: an image other than the mark is a frame of the recorded run (${src})`);
      assert.match(img, /alt="[^"]{20,}"/, `${page}: ${src} says what it shows`);
      const figure = text.slice(text.indexOf(img)).match(/<figcaption>([^<]+)<\/figcaption>/)?.[1] ?? '';
      assert.match(figure, /^Recording/, `${page}: ${src} is labelled a recording`);
    }
    assert.doesNotMatch(text, /fal\b|generated footage/i, `${page}: says nothing about footage`);
  }
});

test('each live part of a page is one that page.js fills', () => {
  const filled = new Set([...read('page.js').matchAll(/(?:put|el|view)\('([a-z-]+)'/g)].map(m => m[1]));
  for (const page of PAGES)
    for (const [, name] of read(page).matchAll(/data-live="([a-z-]+)"/g)) assert.ok(filled.has(name), `${page}: data-live="${name}" is filled by page.js`);
  assert.match(read('index.html'), /data-live="figures"/);
  assert.match(read('index.html'), /data-live="open-rfcs"/);
  assert.match(read('record.html'), /data-live="log"/);
});

test('the contract page carries the rendered text between its markers', () => {
  const text = read('contract.html');
  const region = text.match(/<!-- contract:begin [^>]*-->([\s\S]*?)<!-- contract:end -->/)?.[1] ?? '';
  assert.ok(region.length > 10000, 'the region holds the rendered clauses');
  const articles = [...region.matchAll(/<article class="article" id="k(\d+)">/g)].map(m => Number(m[1]));
  assert.deepEqual(articles, Array.from({ length: 12 }, (_, i) => i + 1), 'the kernel\'s twelve articles, in order');
  assert.match(region, /<dt>Kernel<\/dt><dd><code title="[0-9a-f]{64}">/, 'the kernel\'s hash, which page.js holds the ledger to');
  for (const [, id] of region.matchAll(/<a href="#([^"]+)">/g)) assert.match(region, new RegExp(`<section class="clause" id="${id}"`), `the contents link #${id}`);
  for (const f of ['coordination-contract.pdf', 'coordination-contract-short.pdf']) {
    assert.match(text, new RegExp(`href="papers/${f.replace('.', '\\.')}"`));
    assert.equal(readFileSync(join(ROOT, 'papers', f)).subarray(0, 5).toString(), '%PDF-', `papers/${f} is a PDF`);
  }
});

// ─── the live record, against a fake API at its HTTP edge ─────────────────────

const statsOf = over => ({
  at: NOW,
  contract: { kernelHash: 'a'.repeat(64), version: 0, engineHash: 'b'.repeat(64), stateHash: 'c'.repeat(64), effectiveAt: Date.UTC(2026, 9, 14), rfcId: null },
  log: { length: 36178, headHash: 'e'.repeat(64), headAt: NOW - 90_000, lastBeaconAt: NOW - 30_000, lastDay: { seals: 120, beacon: 1440 } },
  anchor: { key: null, detail: 'not configured: CONTRACT_ANCHOR_SECRET', last: { seq: 36178, status: 'not_anchored', cluster: null, tx: null, at: NOW - 60_000 }, anchoredOfLast: { anchored: 0, of: 200 } },
  rfcs: { byStatus: {}, open: [], decided: [] },
  voices: { confirmed: 0, rfcsAnswered: 0 },
  people: { withVoice: { human: 0 }, anonymousCommitments: {} },
  cases: { byStage: {}, judgments: 0 },
  pool: { balanceCents: 0, openClaims: 0, owedCents: 0 },
  credit: { openMandates: 0, openCapitalCents: 0, facilitiesByState: {} },
  parameters: { lawRfcWindowMs: 1_209_600_000, extractionContestMs: 259_200_000, rfcDepositCents: 1000, appealMs: 604_800_000 },
  ...over,
});

/** A fake of the API: the paths it answers and their bodies; any other path answers 404. */
async function fakeApi(routes) {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(req.url);
    const body = routes[req.url];
    res.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(body ?? { error: 'not_found' }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

test('an empty contract says so in words, and every count is zero, not missing', async () => {
  const api = await fakeApi({ '/public/contract/stats': statsOf({}) });
  try {
    const s = await L.getJson(fetch, api.base, '/public/contract/stats');
    const figures = L.renderFigures(s);
    assert.equal([...figures.matchAll(/<div class="tile">/g)].length, 8, 'eight figures');
    for (const words of ['No RFC is open. Anyone may open one.', 'None yet. The genesis law is in force.', 'No confirmed response yet.', 'Nobody holds a voice yet.', 'No case has been filed.', 'No open claim.', 'No mandate is open.'])
      assert.ok(figures.includes(words), `says: ${words}`);
    assert.match(figures, /<b>\$0\.00<\/b>/, 'the pool is $0.00');
    const open = L.renderOpenRfcs(s, NOW);
    assert.match(open, /No RFC is open now\. Anyone may open one with a refundable deposit of \$10\.00\./);
    assert.match(open, /href="https:\/\/commandagi\.com\/app\?open=%2Fapp%2Fcontract"/, 'the way to open one');
    assert.match(L.renderDecided(s, NOW), /No RFC has been decided yet/);
    const ledger = L.renderLedger(s, NOW);
    assert.match(ledger, /health--live/, 'a beacon 30 s ago is live');
    assert.match(ledger, /<b>36,178<\/b> entries/);
    assert.match(ledger, /is not anchored on chain: not configured: CONTRACT_ANCHOR_SECRET/, 'not anchored, and why');
    assert.match(ledger, /0 of the last 200 checkpoints are anchored/);
    assert.match(ledger, /\(the genesis\)/);
    assert.match(L.renderParameters(s), /An RFC on the law is open for<\/dt><dd>14 days/);
    assert.deepEqual(api.seen, ['/public/contract/stats']);
  } finally {
    await api.close();
  }
});

test('open RFCs are listed soonest first with their clocks and a Respond link; a title is text, never markup', async () => {
  const stats = statsOf({
    rfcs: {
      byStatus: { open: 2, deciding: 1, adopted: 1, rejected: 0 },
      open: [
        { id: 'rfc_a', title: 'A longer <script>alert(1)</script> appeal', target: 'law', procedure: 'deliberative', options: 1, openedAt: NOW - 86_400_000, closesAt: NOW + 13 * 86_400_000 },
        { id: 'rfc_b', title: 'Seat a new renderer', target: 'engine', procedure: 'binding_score', options: 2, openedAt: NOW - 3_600_000, closesAt: NOW + 27 * 86_400_000 },
      ],
      decided: [{ id: 'rfc_z', title: 'Lower the deposit', target: 'law', status: 'adopted', decidedAt: NOW - 7 * 86_400_000, adopted: 'x' }],
    },
    voices: { confirmed: 41, rfcsAnswered: 3 },
    people: { withVoice: { human: 12, agent: 3 }, anonymousCommitments: { human: 5 } },
    cases: { byStage: { evidence: 2, final: 1 }, judgments: 1 },
    pool: { balanceCents: 123_456, openClaims: 1, owedCents: 5000 },
  });
  const api = await fakeApi({ '/public/contract/stats': stats });
  try {
    const s = await L.getJson(fetch, api.base, '/public/contract/stats');
    const open = L.renderOpenRfcs(s, NOW);
    assert.ok(!open.includes('<script>'), 'the title is escaped');
    assert.match(open, /A longer &lt;script&gt;alert\(1\)&lt;\/script&gt; appeal/);
    assert.ok(open.indexOf('rfc_a') < open.indexOf('rfc_b'), 'soonest deadline first');
    assert.match(open, /Closes <time datetime="[^"]+" title="[^"]+">in 13 days<\/time>/);
    assert.match(open, /href="https:\/\/commandagi\.com\/app\?open=%2Fapp%2Fcontract%3Frfc%3Drfc_a">Respond/, 'Respond opens the editor on that RFC');
    assert.match(open, /binding score/);
    const figures = L.renderFigures(s);
    assert.match(figures, /<dt>Open RFCs<\/dt><dd><b>2<\/b><span>1 more being read or decided/);
    assert.match(figures, /<b>41<\/b><span>on 3 RFCs/);
    assert.match(figures, /<b>15<\/b><span>12 human · 3 agent/, 'persons with a voice, by kind');
    assert.match(figures, /<b>3<\/b><span>2 open · 1 with a judgment/);
    assert.match(figures, /<b>\$1,234\.56<\/b><span>1 open claims, \$50\.00 owed/);
    assert.match(L.renderDecided(s, NOW), /Adopted<\/span> <a href="record\.html#rfc=rfc_z">Lower the deposit/, 'a decision links to its tally on this site');
    assert.match(open, /<h3><a href="record\.html#rfc=rfc_a">/, 'an open RFC links to its page here');
  } finally {
    await api.close();
  }
});

test('a sweep with no recent beacon reads as quiet, and an API that refuses is an error, not a zero', async () => {
  const quiet = statsOf({ log: { length: 10, headHash: 'e'.repeat(64), headAt: NOW - 3_600_000, lastBeaconAt: NOW - 3_600_000, lastDay: {} } });
  assert.equal(L.health(quiet, NOW).state, 'quiet');
  assert.match(L.renderLedger(quiet, NOW), /No entry in the last 24 hours/);
  const api = await fakeApi({});
  try {
    await assert.rejects(L.getJson(fetch, api.base, '/public/contract/stats'), /\/public\/contract\/stats answered 404/);
  } finally {
    await api.close();
  }
});

// ─── one RFC's tally and the engine's seats ─────────────────────────────────────

const tallyOf = over => ({
  at: NOW,
  id: 'rfc_t',
  title: 'A longer appeal window',
  body: 'fourteen days',
  target: 'law',
  procedure: 'deliberative',
  status: 'open',
  openedAt: NOW - 86_400_000,
  closesAt: NOW + 13 * 86_400_000,
  contractVersion: 0,
  engineHash: 'b'.repeat(64),
  people: ['human'],
  options: [
    { id: 'status_quo', target: 'none', title: 'keep things as they are', summary: 'No change.' },
    { id: 'longer', target: 'law', title: 'Fourteen <b>days</b>', summary: '' },
  ],
  responses: 7,
  tally: null,
  decision: null,
  ...over,
});

test('the record page reads the RFC its address names', () => {
  assert.equal(L.rfcOfHash('#rfc=rfc_t'), 'rfc_t');
  assert.equal(L.rfcOfHash(`#rfc=${encodeURIComponent('rfc a/b')}`), 'rfc a/b');
  for (const h of ['', '#', '#rfcs', '#rfc=', '#rfc=%E0%A4%A']) assert.equal(L.rfcOfHash(h), null, `"${h}" names no RFC`);
  assert.equal(L.rfcHref('rfc_t'), 'record.html#rfc=rfc_t');
  assert.match(read('record.html'), /<section class="band" id="rfc"[^>]*hidden>/, 'the RFC band shows only when an RFC is named');
  assert.match(read('record.html'), /data-live="engine"/);
});

test('an open RFC shows its count and no score; a read one its scores, histogram and decision; a title stays text', async () => {
  const decided = tallyOf({
    status: 'adopted',
    closesAt: NOW - 5 * 86_400_000,
    responses: 3,
    tally: { respondents: 3, scores: { longer: 4 }, histogram: { longer: [0, 0, 1, 0, 2] }, unscored: { longer: 0 }, favored: 'longer', recordDigest: 'd'.repeat(64), provisional: false },
    decision: { adopted: 'longer', reason: 'selected after consideration of comments; the engine concurs', decidedAt: NOW - 86_400_000, decisionHash: 'f'.repeat(64), depositReturned: true, participation: { respondents: 3, representativeness: 'three self-selected comments' }, determinations: [{ id: 'det_1', kind: 'rfc.concur', outcome: 'decided', label: 'concur', tier: 3 }] },
  });
  const api = await fakeApi({ '/public/contract/rfcs/rfc_t/tally': tallyOf({}), '/public/contract/rfcs/rfc_d/tally': decided });
  try {
    const open = L.renderTally(await L.getJson(fetch, api.base, '/public/contract/rfcs/rfc_t/tally'), NOW);
    assert.match(open, /<b>7<\/b> confirmed responses so far/);
    assert.match(open, /publishes the tally once the responses are read/);
    assert.doesNotMatch(open, /<table|Score|favored/, 'no score before the responses are read');
    assert.match(open, /href="https:\/\/commandagi\.com\/app\?open=%2Fapp%2Fcontract%3Frfc%3Drfc_t">Respond/);
    assert.ok(open.includes('Fourteen &lt;b&gt;days&lt;/b&gt;') && !open.includes('<b>days</b>'), 'an option title is escaped');

    const read = L.renderTally(await L.getJson(fetch, api.base, '/public/contract/rfcs/rfc_d/tally'), NOW);
    assert.match(read, /<b>3<\/b> voices read\./);
    assert.match(read, /<td class="num">\+4<\/td>/, 'the option\'s score');
    assert.match(read, /favored/);
    assert.equal([...read.matchAll(/<li title="[^"]+"><i style="--h:(\d+)%"><\/i><span>([^<]+)<\/span><b>(\d+)<\/b><\/li>/g)].map(m => `${m[2]}:${m[3]}`).join(' '), '−2:0 −1:0 0:1 +1:0 +2:2', 'the histogram from −2 to +2');
    assert.match(read, /Adopted: Fourteen &lt;b&gt;days&lt;\/b&gt;/);
    assert.match(read, /<code>rfc\.concur<\/code> decided: <b>concur<\/b> at tier 3/);
    assert.match(read, /returned to the opener/);
    assert.deepEqual(api.seen, ['/public/contract/rfcs/rfc_t/tally', '/public/contract/rfcs/rfc_d/tally']);
  } finally {
    await api.close();
  }
  assert.match(L.renderTally(tallyOf({ status: 'contest', tally: { ...decided.tally, provisional: true } }), NOW), /may still contest/, 'a tally that contests may still move says so');
});

test('the engine\'s seats: operator, pin and figures per tier, the renderers apart', () => {
  const seat = (id, pin, extra = {}) => ({ id, model: `${id}-model`, operator: 'cloudflare', upstream: null, lineage: 'l', protocol: 'p', pin, modalities: ['text'], attested: false, economics: { errorPermille: 25, climbPermille: 100, meanLatencyMs: 1, p99LatencyMs: 2, costMicroUsd: 3, source: 'prior' }, measured: null, ...extra });
  const html = L.renderEngine({
    at: NOW,
    name: 'genesis',
    engineHash: 'b'.repeat(64),
    version: 0,
    effectiveAt: Date.UTC(2026, 9, 14),
    rfcId: null,
    tiers: [
      { tier: 1, name: 'embedding', quorum: null, seats: [seat('bge', { kind: 'weights', sha256: 'a'.repeat(64), source: 'hf' })] },
      { tier: 2, name: 'classifiers', quorum: 2, seats: [seat('clef', { kind: 'version', id: 'clef-1.0' }, { measured: { seat: 'clef', calls: 12, referenced: 3, wrong: 0, errorUpperPermille: 562, climbPermille: 0, meanLatencyMs: 1, p99LatencyMs: 1 } })] },
      { tier: 3, name: 'deliberative', quorum: 3, seats: [seat('opus', { kind: 'version', id: 'claude-opus-5-5' }, { operator: 'openrouter', upstream: 'crusoe' })] },
    ],
    renderers: [seat('whisper', { kind: 'weights', sha256: 'c'.repeat(64), source: 'hf' })],
  });
  assert.equal([...html.matchAll(/<h3 class="tier">/g)].length, 4, 'three tiers and the renderers');
  assert.match(html, /\(the genesis\)/);
  assert.match(html, /weights <code title="a{64}">a{10}…<\/code>/, 'open weights by their hash');
  assert.match(html, /version <code>claude-opus-5-5<\/code>/, 'a hosted model by its version');
  assert.match(html, /openrouter via crusoe/);
  assert.match(html, /12 calls · 56\.2% wrong at most/, 'measured figures where there are some');
  assert.match(html, /2\.5% wrong \(prior\)/);
  assert.match(html, /at least 2 groups agree/);
});

// ─── what a visitor checks without trusting the platform ──────────────────────

test('the kernel hash recomputes from the real kernel the API serves, and a changed word breaks it', async () => {
  const { kernel } = JSON.parse(read('fixtures/kernel.json'));
  const recomputed = await kernelHash(kernel);
  assert.equal(recomputed, kernel.hash);
  const pinned = read('contract.html').match(/<dt>Kernel<\/dt><dd><code title="([0-9a-f]{64})"/)[1];
  assert.equal(pinned, kernel.hash, 'the fixture is the kernel this site renders');
  assert.match(L.renderKernelCheck({ claimed: kernel.hash, recomputed, pinned }), /check--ok/);
  const changed = { ...kernel, articles: kernel.articles.map((a, i) => (i === 2 ? { ...a, text: a.text.replace(/\.$/, '!') } : a)) };
  const other = await kernelHash(changed);
  assert.notEqual(other, kernel.hash);
  assert.match(L.renderKernelCheck({ claimed: kernel.hash, recomputed: other, pinned }), /check--bad[\s\S]*does not hash to the hash it claims/);
});

test('the log chain recomputes over real entries, and a moved entry or a changed digest is named', async () => {
  const { entries } = JSON.parse(read('fixtures/log.json'));
  assert.deepEqual(await logProblems(entries), []);
  assert.match(L.renderLog(entries, [], NOW), /Each of these 6 hashes was recomputed in your browser/);
  const tampered = entries.map((e, i) => (i === 3 ? { ...e, bodyDigest: '0'.repeat(64) } : e));
  assert.deepEqual(await logProblems(tampered), [`entry ${entries[3].seq}: its hash does not recompute`]);
  const gap = [entries[0], ...entries.slice(2)];
  assert.ok((await logProblems(gap)).some(p => p.includes(`expected ${entries[0].seq + 1}`)));
});

// ─── the front door: alive now, what comes next, the machines ─────────────────

test('the vital signs tick: the ledger height and its last entry, the next close as a countdown, this week\'s decisions', () => {
  assert.deepEqual([L.countdown(0), L.countdown(5_400), L.countdown(65_000), L.countdown(4 * 3_600_000 + 12 * 60_000), L.countdown(2 * 86_400_000 + 4 * 3_600_000)], ['now', '5s', '1m 05s', '4h 12m', '2d 04h']);
  const s = statsOf({
    rfcs: {
      byStatus: { open: 1, adopted: 2 },
      open: [{ id: 'rfc_a', title: 'A', target: 'law', procedure: 'deliberative', options: 1, openedAt: NOW - 86_400_000, closesAt: NOW + 3 * 3_600_000 }],
      decided: [{ id: 'rfc_w', title: 'this week', status: 'adopted', decidedAt: NOW - 2 * 86_400_000 }, { id: 'rfc_old', title: 'last month', status: 'adopted', decidedAt: NOW - 30 * 86_400_000 }],
    },
    people: { withVoice: { human: 12, agent: 3 }, anonymousCommitments: {} },
    voices: { confirmed: 41, rfcsAnswered: 3 },
  });
  const v = L.renderVitals(s, NOW);
  assert.match(v, /<dt>Ledger height<\/dt><dd><b>36,178<\/b><span>last entry <time [^>]*data-at="\d+">2 minutes ago<\/time>/, 'the last entry, re-worded each second');
  assert.match(v, /the next closes in <span class="countdown" data-until="\d+"[^>]*>3h 00m<\/span>/);
  assert.match(v, /<dt>Decided this week<\/dt><dd><b>1<\/b>/, 'only the decision of the last 7 days');
  assert.match(v, /<b>15<\/b><span>41 responses counted/);
  assert.match(L.renderOpenRfcs(s, NOW), /data-until="\d+"[^>]*>3h 00m</, 'each open RFC counts down to its close');
  assert.match(L.renderAnchor(statsOf({}), NOW), /check--wait[\s\S]*not anchored on chain: not configured: CONTRACT_ANCHOR_SECRET\. 0 of the last 200 checkpoints are anchored[\s\S]*Version 0 in force since [^<]+, the genesis/, 'an anchor that does not hold says why');
  const anchored = statsOf({ anchor: { key: 'K', detail: null, last: { seq: 36100, status: 'anchored', cluster: 'devnet', tx: '4sigTransaction', at: NOW - 30_000 }, anchoredOfLast: { anchored: 200, of: 200 } } });
  assert.match(L.renderAnchor(anchored, NOW), /check--ok[\s\S]*Log entry 36,100 is anchored on devnet <time[^>]*>30 seconds ago<\/time> <code title="4sigTransaction">/);
  const empty = L.renderVitals(statsOf({}), NOW);
  assert.match(empty, /none open: anyone may open one/);
  assert.match(empty, /no RFC decided in the last 7 days/);
});

test('the activity feed says what happened in plain words, counts runs of one act, names no one, and escapes a title', async () => {
  const entry = (seq, kind, subject, rfcTitle = null) => ({ seq, kind, subject, at: NOW - (100 - seq) * 1000, hash: 'f'.repeat(64), rfcTitle });
  const activity = {
    at: NOW,
    entries: [
      entry(99, 'rfc.response', 'rfc_12', 'Twelve <i>days</i>'),
      entry(98, 'rfc.response', 'rfc_12', 'Twelve <i>days</i>'),
      entry(97, 'rfc.response', 'rfc_12', 'Twelve <i>days</i>'),
      entry(96, 'case.judgment', 'case_abc'),
      entry(95, 'personhood.issued', 'personhood:human'),
      entry(94, 'intent.authorized', 'd'.repeat(64)),
      entry(93, 'rfc.opened', 'rfc_12', 'Twelve <i>days</i>'),
      entry(92, 'something.new', 'x'),
    ],
  };
  const api = await fakeApi({ '/public/contract/activity': activity });
  try {
    const html = L.renderActivity(await L.getJson(fetch, api.base, '/public/contract/activity'), statsOf({}), NOW);
    const lines = [...html.matchAll(/<li class="feed__item feed--([a-z]+)"><a href="([^"]+)">([^<]*(?:<(?!\/a>)[^<]*)*)<\/a>/g)].map(m => [m[1], m[2], m[3]]);
    assert.deepEqual(lines, [
      ['rfc', 'record.html#rfc=rfc_12', '3 responses to “Twelve &lt;i&gt;days&lt;/i&gt;” were confirmed'],
      ['case', 'record.html', 'A case was decided'],
      ['people', 'record.html', 'A human’s voice was confirmed'],
      ['machine', 'index.html#machines', 'The contract authorized a command to a machine'],
      ['rfc', 'record.html#rfc=rfc_12', 'RFC “Twelve &lt;i&gt;days&lt;/i&gt;” opened'],
      ['law', 'record.html', 'something.new was recorded'],
    ]);
    assert.ok(!html.includes('case_abc'), 'a case is not named in the feed');
    assert.match(html, /entry 99<\/span>/);
    assert.match(html, /1,440 chain beacons and 120 seal batches|120 seal batches from machines and hosts and 1,440 chain beacons/, 'the heartbeat in one line');
    assert.deepEqual(api.seen, ['/public/contract/activity']);
  } finally {
    await api.close();
  }
  assert.match(L.renderActivity({ at: NOW, entries: [] }, null, NOW), /Nothing has happened on the record yet/);
});

test('coming up: soonest first with a countdown; an engine sitting that is due is in session; a case by its id alone', async () => {
  const cal = {
    at: NOW,
    horizonMs: 120 * 86_400_000,
    events: [
      { id: 'engine.session:rfc_9:decide', kind: 'engine.session', at: NOW - 60_000, subject: 'rfc_9', title: 'Seat a renderer' },
      { id: 'rfc.closes:rfc_12', kind: 'rfc.closes', at: NOW + 2 * 86_400_000, subject: 'rfc_12', title: 'Twelve <b>days</b>' },
      { id: 'case.evidence_closes:case_abcdef123456', kind: 'case.evidence_closes', at: Date.UTC(2026, 10, 20), subject: 'case_abcdef123456', title: null },
    ],
  };
  const api = await fakeApi({ '/public/contract/calendar': cal });
  try {
    const html = L.renderCalendar(await L.getJson(fetch, api.base, '/public/contract/calendar'), NOW);
    const items = [...html.matchAll(/<li class="cal__item cal--([a-z]+)">/g)].map(m => m[1]);
    assert.deepEqual(items, ['engine', 'rfc', 'case']);
    assert.match(html, /The engine sits to decide “Seat a renderer”<\/a><span class="countdown countdown--now">in session/);
    assert.match(html, /Responses close on “Twelve &lt;b&gt;days&lt;\/b&gt;”<\/a><span class="countdown" data-until="\d+"[^>]*>2d 00h/);
    assert.match(html, /<b>20<\/b>Nov<\/time><a href="record\.html">Evidence closes in case <code title="case_abcdef123456">case_abcde<\/code>/);
  } finally {
    await api.close();
  }
  assert.match(L.renderCalendar({ at: NOW, events: [] }, NOW), /Nothing is on the calendar/);
  assert.match(read('index.html'), /href="https:\/\/api\.commandagi\.com\/public\/contract\/calendar\.ics"/, 'the calendar as a feed to subscribe to');
});

test('the machines: live ones first with a fresh frame, a recording says so, none says "no live robot right now"; the contract\'s commands', async () => {
  const robot = (id, state, over = {}) => ({ id, title: `Arm ${id}`, description: 'sorts <parts>', reality: 'physical', state, lastActivityAt: NOW - 20_000, frameAt: NOW - 20_000, machines: [{ kind: 'robot', noun: 'robot', status: 'running' }], picture: `/threads/${id}/poster`, watch: `https://commandagi.com/app?open=${encodeURIComponent(`/thread/${id}`)}`, ...over });
  const view = {
    at: NOW,
    liveMs: 120_000,
    robots: [robot('t1', 'live'), robot('t2', 'recorded', { reality: 'simulation', frameAt: NOW - 3 * 86_400_000, picture: null })],
    commands: { byStatus: { receipted: 2, refused: 1 }, recent: [{ id: 'd'.repeat(64), kind: 'command', verb: 'frame', channel: 'camera', status: 'receipted', at: NOW - 60_000, updatedAt: NOW - 30_000, tx: '5xTxSignature', cluster: 'devnet', receipted: true }] },
  };
  const none = { at: NOW, liveMs: 120_000, robots: [], commands: { byStatus: {}, recent: [] } };
  const api = await fakeApi({ '/public/contract/robots': view });
  try {
    const v = await L.getJson(fetch, api.base, '/public/contract/robots');
    const html = L.renderRobots(v, NOW, api.base);
    assert.deepEqual([...html.matchAll(/<li class="robot robot--([a-z]+)">/g)].map(m => m[1]), ['live', 'recorded']);
    assert.match(html, /<span class="badge badge--live">Live<\/span><span class="tag">physical<\/span>/);
    assert.match(html, /<span class="badge badge--recorded">Recording<\/span><span class="tag">simulation<\/span>/, 'a recording is labelled a recording');
    assert.ok(html.includes(`src="${api.base}/threads/t1/poster?t=${Math.floor(NOW / 15_000)}"`), 'the live frame from the API, fetched again every 15 s');
    assert.match(html, /robot__frame--none/, 'no picture, no stand-in image');
    assert.match(html, /sorts &lt;parts&gt;/);
    assert.match(html, />Watch it live<\/a>/);
    assert.match(html, />Open its run<\/a>/);
    const cmds = L.renderCommands(v, NOW);
    assert.match(cmds, /3 commands in all: 2 done, with a receipt · 1 refused by its host/);
    assert.match(cmds, /<b>frame on camera<\/b> <span class="verdict verdict--adopted">done, with a receipt<\/span>/);
    assert.match(cmds, /devnet <code title="5xTxSignature">5xTxSignat…<\/code>/);
  } finally {
    await api.close();
  }
  assert.match(L.renderRobots(none, NOW), /No live robot right now\./);
  assert.match(L.renderCommands(none, NOW), /The contract has authorized no command to a machine yet/);
  const csp = read('index.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /img-src 'self' data: https:\/\/api\.commandagi\.com;/, 'a frame comes from the API only');
});

test('the recorded run is drawn from its own servo stream: its steps, its goals, its joints, its seals, labelled a simulation', () => {
  const run = L.parseServoRun(read('robots/labrat/servos.jsonl'));
  assert.equal(run.goals, 56);
  assert.equal(run.by, 'agent:labrat-tip-picker');
  assert.deepEqual(run.steps.map(s => s.text).slice(1, 6), ['open the gripper', 'swing over tip A1, 50 mm above its collar', 'down to its collar', 'close on the collar', 'lift it 40 mm']);
  assert.ok(run.simulated && run.noGrant);
  const html = L.renderRecording(run);
  assert.match(html, /<span class="badge badge--recorded">Recording<\/span><span class="tag">simulation<\/span>/);
  assert.match(html, /8 seconds · 56 goals/);
  assert.equal([...html.matchAll(/<path class="trace trace--\d"/g)].length, 6, 'one path per joint');
  assert.match(html, /A simulated run needs no grant, and its record says so/);
  assert.match(html, /bound to solana:devnet slot 517,540,548/);
  assert.equal(L.jointTrace({ states: [], steps: [] }), '', 'no trace from fewer than two states');
});

test('the home page puts the mission and the binding commitment first, then what is alive, the machines, the way in and the library', () => {
  const text = read('index.html');
  const order = ['id="mission-title"', 'data-live="kernel"', 'data-live="anchor"', 'id="now"', 'data-live="activity"', 'data-live="calendar"', 'id="rfcs"', 'id="machines"', 'data-live="robots"', 'data-live="recording"', 'id="take-part"', 'id="library"'];
  const at = order.map(s => text.indexOf(s));
  assert.ok(at.every(i => i > 0), `each part is on the page: ${order.filter((_, i) => at[i] < 0)}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in this order');
  for (const k of ['k1', 'k2', 'k3 · k4', 'k7', 'k11', 'k12']) assert.match(text, new RegExp(`<li><b>${k}</b>`), `the promise ${k}`);
  assert.match(text, /href="https:\/\/commandagi\.com\/app\?open=%2Fapp%2Fcontract">Needs you</, 'sign in to what needs you, from every screen');
});
