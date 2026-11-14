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
import { contractHash, kernelHash, logProblems } from './verify.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://vibegov.pro';
const PAGES = ['index.html', 'record.html', 'contract.html', 'legal.html'];
// The signed-in pages (redesign/APP.md); each has its own test under test/.
const APP = ['signin.html', 'desk.html', 'rfcs.html', 'rfc.html', 'propose.html', 'cases.html', 'case.html', 'file.html', 'credit.html'];
const NAV = ['index.html', 'record.html', 'contract.html', 'rfcs.html', 'cases.html', 'credit.html'];
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

test('the pages, in English, each with its canonical address, the same contents line and the account control', () => {
  const html = readdirSync(ROOT, { recursive: true }).filter(f => String(f).endsWith('.html') && !/^(redesign|test|\.wrangler)\//.test(String(f)));
  assert.deepEqual(html.sort(), [...PAGES, ...APP].sort(), 'the public pages and the signed-in pages');
  for (const page of [...PAGES, ...APP]) {
    const text = read(page);
    assert.match(text, /<html lang="en">/, `${page}: English`);
    assert.match(text, new RegExp(`<link rel="canonical" href="${ORIGIN}/${page === 'index.html' ? '' : page}">`), `${page}: canonical`);
    const contents = text.match(/<nav id="contents"[\s\S]*?<\/nav>/)[0];
    assert.deepEqual([...contents.matchAll(/href="([^"]+)"/g)].map(m => m[1]), NAV, `${page}: the contents line`);
    if (NAV.includes(page)) assert.match(contents, new RegExp(`href="${page}" aria-current="page"`), `${page}: marks itself`);
    assert.match(text, /<span class="runhead__act" data-account><\/span>/, `${page}: the account control's place`);
    assert.match(text, /<script type="module" src="shell\.js"><\/script>/, `${page}: shell.js fills it`);
  }
});

test('every relative link and asset resolves on disk', () => {
  for (const page of PAGES) {
    const text = read(page);
    for (const [, ref] of text.matchAll(/(?:href|src|data-src)="([^"]+)"/g)) {
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
    assert.match(csp, /form-action 'none'/, `${page}: form-action`);
    for (const [, ref] of text.matchAll(/<(?:script|img|source|link rel="(?:stylesheet|preload|icon|apple-touch-icon)")[^>]*(?:src|href)="(https?:[^"]+)"/g))
      assert.fail(`${page}: an asset from another host (${ref})`);
  }
  // No page sends a person to the workbench to act: every act is on this site.
  for (const page of [...PAGES, ...APP]) assert.doesNotMatch(read(page), /commandagi\.com\/app/, `${page}: no link into the workbench`);
});

test('the pictures: the mark, the Earth from NASA\'s maps on the first screen only, plates of facts, two diagrams, one film', () => {
  assert.ok(!existsSync(join(ROOT, 'media')) && !existsSync(join(ROOT, 'art')) && !existsSync(join(ROOT, 'dots.js')), 'no generated picture');
  const home = read('index.html');
  assert.deepEqual([...home.matchAll(/data-live="(plate-[a-z]+)"/g)].map(m => m[1]), ['plate-voice', 'plate-change', 'plate-case'], 'the plates read from the record');
  // A diagram is a canvas that figures.js draws, and it says in words what it shows.
  assert.deepEqual([...home.matchAll(/<canvas class="figure" data-figure="([a-z]+)" role="img" aria-label="Diagram: [^"]{60,}"><\/canvas>/g)].map(m => m[1]), ['apex', 'world']);
  assert.match(read('figures.js'), /const FIGURES = \{ apex, world \};/);
  // The night is the front door's first screen: the sky and the Earth are inside it, and on no other page.
  const night = home.match(/<div class="night">([\s\S]*?)\n  <\/div>\n\n  <section class="feature/)?.[1] ?? '';
  assert.match(night, /<canvas id="sky" aria-hidden="true"><\/canvas>/);
  assert.equal([...night.matchAll(/<canvas class="earth" aria-hidden="true"><\/canvas>/g)].length, 1);
  assert.match(night, /class="creed/, 'the reason stands on the night side');
  assert.equal([...home.matchAll(/<canvas (?:id="sky"|class="earth")/g)].length, 2);
  for (const page of [...PAGES, ...APP].filter(p => p !== 'index.html')) assert.doesNotMatch(read(page), /id="sky"|scene\.js|class="earth"/, `${page}: paper, no sky`);
  assert.deepEqual(readdirSync(join(ROOT, 'sky')).sort(), ['earth-day-2k.jpg', 'earth-day.jpg', 'earth-night-2k.jpg', 'earth-night.jpg', 'moon.jpg']);
  for (const [, src] of read('earth.js').matchAll(/'(sky\/[a-z0-9-]+\.jpg)'/g)) assert.ok(existsSync(join(ROOT, src)), `earth.js reads ${src}`);
  // The one film: a recording of a simulation, and its caption says so.
  const films = [...home.matchAll(/<video[^>]*>[\s\S]*?<\/video>\s*<figcaption>([^<]+)<\/figcaption>/g)];
  assert.equal(films.length, 1);
  assert.match(films[0][0], /<video data-loop muted loop playsinline preload="none" poster="robots\/so101-cube\/poster\.jpg"[^>]*aria-label="[^"]{20,}"/, 'muted, not loaded until it is seen, and named');
  assert.match(films[0][1], /^Recording, 13 November 2026: a simulated /, 'the film is labelled a recording of a simulation');
  // Where the words, figures and pictures come from is said on the page about the site, not in every footer.
  assert.match(read('legal.html'), /The Earth and the Moon are drawn from NASA’s maps[^<]*The robot is a recording of a simulation\. The two diagrams are drawings of an idea, not data\./);
  for (const page of [...PAGES, ...APP]) {
    const foot = read(page).match(/<footer class="site-foot">\n  <p>([\s\S]*?)<\/p>\n<\/footer>/)?.[1];
    assert.ok(foot && !foot.includes('\n'), `${page}: the footer is one line`);
    assert.match(foot, /<a href="legal\.html">About this site<\/a>/, `${page}: the footer links the page about the site`);
    assert.doesNotMatch(read(page), /<img(?![^>]*src="mark\.svg")/, `${page}: no image but the mark`);
  }
});

test('each live part of a page is one that page.js fills', () => {
  const filled = new Set([...read('page.js').matchAll(/(?:put|el|view)\('([a-z-]+)'/g)].map(m => m[1]));
  for (const page of PAGES)
    for (const [, name] of read(page).matchAll(/data-live="([a-z-]+)"/g)) assert.ok(filled.has(name) || name === 'tape', `${page}: data-live="${name}" is filled by page.js (the tape by shell.js)`);
  assert.match(read('shell.js'), /querySelector\('\[data-live="tape"\]'\)[\s\S]*renderTape\(/, 'shell.js fills the tape on every page');
  assert.match(read('index.html'), /data-live="chain"/);
  assert.match(read('index.html'), /data-live="rfc-strip"/);
  assert.match(read('record.html'), /data-live="engine"/);
  assert.match(read('record.html'), /data-live="log"/);
});

test('the contract page is an opening, the contents and a closing; each entry of the contents holds its part, closed', () => {
  const text = read('contract.html');
  const region = text.match(/<!-- contract:begin [^>]*-->([\s\S]*?)<!-- contract:end -->/)?.[1] ?? '';
  assert.ok(region.length > 10000, 'the region holds the rendered clauses');
  const parts = [...region.matchAll(/<li><details class="part" id="([a-z]+)">\n<summary><span>§ (\d+)<\/span><h2 id="\1-title">[^<]+<\/h2><i>[^<]{20,}<\/i><\/summary>/g)];
  assert.deepEqual(parts.map(m => m[1]), ['parts', 'kernel', 'people', 'rfcs', 'engine', 'evidence', 'justice', 'pool', 'credit']);
  assert.deepEqual(parts.map(m => Number(m[2])), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.doesNotMatch(region, /<details[^>]* open/, 'every part is closed until a reader opens it');
  assert.equal(region.match(/<details/g).length, 9, 'nothing of the contract is outside a part');
  const articles = [...region.matchAll(/<article class="article" id="k(\d+)">/g)].map(m => Number(m[1]));
  assert.deepEqual(articles, Array.from({ length: 12 }, (_, i) => i + 1), 'the kernel\'s twelve articles, in order');
  assert.match(region, /<dt>Kernel<\/dt><dd><code title="[0-9a-f]{64}">/, 'the kernel\'s hash, which page.js holds the ledger to');
  // A process is a diagram the contract declares, never a picture in characters.
  assert.doesNotMatch(region, /<pre/, 'no preformatted block');
  assert.equal(region.match(/<figure class="flow"><svg [^>]*role="img" aria-label="Diagram: [^"]+"/g).length, 4, 'the flows of RFCs, the engine, justice and credit, each said in words');
  // An address inside a part opens it (the front door links to #k2 … #k12).
  assert.match(text, /<script type="module" src="contract\.js"><\/script>/);
  assert.match(read('contract.js'), /closest\('details\.part'\)[\s\S]*part\.open = true/);
  const [before, after] = text.split(/<!-- contract:begin [\s\S]*<!-- contract:end -->/);
  assert.match(before, /<p class="lede">[^<]+<\/p>\n\s*<div class="btn-row">\n\s*<a class="btn primary" href="desk\.html" data-ref="k2">Take your voice<\/a>/, 'one opening paragraph, then the acts');
  assert.equal(after.match(/<p class="lede">/g).length, 1, 'one closing paragraph');
  assert.doesNotMatch(text, /data-live="kernel"|class="btn-row"[\s\S]*class="btn-row"/, 'no kernel line, and the acts once');
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
    const open = L.renderRfcStrip(s, NOW);
    assert.match(open, /with a refundable deposit of \$10\.00\.[\s\S]*none open today<\/span><\/p><h4>Open the first proposal/);
    assert.match(open, /<a class="btn small" href="propose\.html" data-ref="k4">Open a proposal<\/a>/, 'the way to open one, on this site');
    const tape = L.renderTape(s, NOW);
    assert.match(tape, /<dt>Proposals<\/dt><dd>0<\/dd>/, 'a zero is a zero, not missing');
    assert.match(tape, /<dt>Anchored<\/dt><dd>0 of 200<\/dd>/);
    assert.match(L.renderParameters(s), /An RFC on the law is open for<\/dt><dd>14 days/);
    assert.deepEqual(api.seen, ['/public/contract/stats']);
  } finally {
    await api.close();
  }
});

test('proposals are a row of cards: open ones soonest first with a Respond link, then decided ones; with none, the path a proposal takes; a title is text, never markup', async () => {
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
    const open = L.renderRfcStrip(s, NOW);
    assert.ok(!open.includes('<script>'), 'the title is escaped');
    assert.match(open, /A longer &lt;script&gt;alert\(1\)&lt;\/script&gt; appeal/);
    assert.ok(open.indexOf('rfc_a') < open.indexOf('rfc_b'), 'soonest deadline first');
    assert.match(open, /Closes <time datetime="[^"]+" title="[^"]+">in 13 days<\/time>/);
    assert.match(open, /<a class="btn small primary" href="rfc\.html\?id=rfc_a">Respond/, 'Respond opens that RFC\'s page on this site');
    assert.match(open, /binding score/);
    assert.match(open, /<h4><a href="rfc\.html\?id=rfc_a">/, 'an open RFC links to its page here');
    assert.ok(open.indexOf('rfc_b') < open.indexOf('Lower the deposit') && open.indexOf('Lower the deposit') < open.indexOf('Propose a change'), 'open, then decided, then the way to open one');
    assert.doesNotMatch(open, /card--step/, 'no path cards beside real proposals');
    const none = L.renderRfcStrip(statsOf({}), NOW);
    assert.equal(none.match(/card--step/g).length, 4, 'with no proposal, the four steps of one');
    assert.match(none, /stays open for 14 days/, 'with the law\'s own window');
    assert.match(none, /none open today<\/span><\/p><h4>Open the first proposal/);
  } finally {
    await api.close();
  }
});

test('a sweep with no recent beacon reads as quiet, and an API that refuses is an error, not a zero', async () => {
  const quiet = statsOf({ log: { length: 10, headHash: 'e'.repeat(64), headAt: NOW - 3_600_000, lastBeaconAt: NOW - 3_600_000, lastDay: {} } });
  assert.equal(L.health(quiet, NOW).state, 'quiet');
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
  const changed = { ...kernel, articles: kernel.articles.map((a, i) => (i === 2 ? { ...a, text: a.text.replace(/\.$/, '!') } : a)) };
  const other = await kernelHash(changed);
  assert.notEqual(other, kernel.hash);
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
      ['rfc', 'rfc.html?id=rfc_12', '3 responses to “Twelve &lt;i&gt;days&lt;/i&gt;” were confirmed'],
      ['case', 'record.html', 'A case was decided'],
      ['people', 'record.html', 'A human’s voice was confirmed'],
      ['machine', 'record.html#machines', 'The contract authorized a command to a machine'],
      ['rfc', 'rfc.html?id=rfc_12', 'RFC “Twelve &lt;i&gt;days&lt;/i&gt;” opened'],
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
  assert.match(read('record.html'), /href="https:\/\/api\.commandagi\.com\/public\/contract\/calendar\.ics"/, 'the calendar as a feed to subscribe to');
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
  const csp = read('record.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /img-src 'self' data: https:\/\/api\.commandagi\.com;/, 'a frame comes from the API only');
});

test('the front door: A World in Command, what the contract holds in the kernel\'s own words, a robot at work, and what to do today', () => {
  const text = read('index.html');
  assert.match(text, /<title>VibeGov: A World in Command<\/title>/);
  assert.match(text, /<h1 id="top-title">A World <em>in Command\.<\/em><\/h1>/);
  const order = ['data-live="tape"', 'class="earth"', 'id="top-title"', 'class="creed', 'id="f-voice"', 'id="f-throne"', 'id="f-change"', 'data-live="rfc-strip"', 'id="f-robots"', 'data-live="chain"', 'data-live="chain-check"', 'id="f-record"', 'id="f-justice"', 'id="f-exit"', 'id="today-title"', 'data-figure="world"', 'id="close-title"'];
  const at = order.map(s => text.indexOf(s));
  assert.ok(at.every(i => i > 0), `each part is on the page: ${order.filter((_, i) => at[i] < 0)}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in this order');
  // A quotation is the kernel's text, letter for letter (an ellipsis marks where it is cut), under the article it names.
  const kernel = Object.fromEntries(JSON.parse(read('fixtures/kernel.json')).kernel.articles.map(a => [a.id, a.text]));
  const quotes = [...text.matchAll(/<blockquote><p>“([^”]+)”<\/p><footer><a href="contract\.html#(k\d+)">The kernel, article (\d+)<\/a><\/footer><\/blockquote>/g)];
  assert.deepEqual(quotes.map(q => q[2]), ['k2', 'k3', 'k4', 'k11', 'k7', 'k12'], 'one quotation per thing the contract holds');
  for (const [, words, id, n] of quotes) {
    assert.equal(id, `k${n}`, 'the link and its words name the same article');
    assert.ok(kernel[id].includes(words.replace(/^…|…$/g, '').replaceAll('’', "'")), `“${words}” is in ${id}`);
  }
  assert.equal([...text.matchAll(/<blockquote>/g)].length, quotes.length, 'no quotation that is not the kernel\'s');
  assert.match(text, /<a class="btn primary" href="desk\.html" data-ref="k2">Take your voice<\/a>/, 'the one act the page asks for');
  assert.equal([...text.matchAll(/<ol class="clauses">[\s\S]*?<\/ol>/g)][0][0].match(/<li>/g).length, 5, 'five things to do today');
});

test('the front door\'s ledger is blocks, all alike: number, time, plain words, its hash after the one it follows', async () => {
  const entries = [];
  let prev = '0'.repeat(64);
  for (const [seq, kind, subject] of [[1, 'version', 'version:0'], [2, 'seals', 'seals:sb_1'], [3, 'rfc.opened', 'rfc_<b>']]) {
    const e = { seq, prev, kind, subject, bodyDigest: 'd'.repeat(64), at: NOW - (4 - seq) * 60_000 };
    e.hash = await contractHash('log', e);
    entries.push(e);
    prev = e.hash;
  }
  const blocks = entries.map(e => L.renderBlock({ ...e, rfcTitle: e.kind === 'rfc.opened' ? 'Lower <the> deposit' : null }, NOW));
  blocks.forEach((b, i) => assert.match(b, new RegExp(`^<li class="block" data-seq="${i + 1}"><p class="block__top"><b>Entry ${i + 1}</b><time [^>]*data-at="\\d+">[^<]+</time></p><p class="block__what">[^<]+</p><p class="block__hash"><code title="${entries[i].hash}">${entries[i].hash.slice(0, 14)}</code><span>follows</span><code title="${entries[i].prev}">${entries[i].prev.slice(0, 14)}</code></p></li>$`), 'every block has the same parts'));
  assert.match(blocks[0], /Contract version 0 took effect/);
  assert.match(blocks[1], /Seals from machines and hosts/);
  assert.match(blocks[2], /RFC “Lower &lt;the&gt; deposit” opened/, 'a title is text');
  assert.match(L.renderChainCheck(3, await logProblems(entries)), /check--ok.*recomputed the last 3 hashes/);
  entries[1].at += 1;
  assert.match(L.renderChainCheck(3, await logProblems(entries)), /check--bad.*entry 2: its hash does not recompute/, 'a changed entry is named');
});

test('the record page is the ledger and what stands on it, each under one heading, none in a box', () => {
  const text = read('record.html');
  const order = ['id="now"', 'data-live="activity"', 'data-live="calendar"', 'id="log"', 'data-live="log"', 'data-live="checkpoints"', 'id="engine"', 'data-live="engine"', 'id="machines"', 'data-live="robots"', 'data-live="commands"', 'id="law"', 'data-live="params"', 'data-live="versions"'];
  const at = order.map(s => text.indexOf(s));
  assert.ok(at.every(i => i > 0), `each part is on the page: ${order.filter((_, i) => at[i] < 0)}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in this order');
  const main = text.match(/<main[\s\S]*<\/main>/)[0];
  assert.equal(main.match(/<section /g).length, 6, 'six sections');
  assert.doesNotMatch(main, /class="(?:band|panel|tile|rec|steps|hero)\b/, 'no band, panel, tile or card around a section');
  for (const [, body] of main.matchAll(/<section [^>]*>([\s\S]*?)<\/section>/g)) assert.doesNotMatch(body, /<section|<article/, 'no section inside a section');
});

test('the tape under every header: the contract\'s figures on one line', () => {
  for (const page of [...PAGES, ...APP]) assert.match(read(page), /<\/header>\n<div class="tape" data-live="tape" aria-label="[^"]+" aria-busy="true"><\/div>/, `${page}: the tape follows the header`);
  const html = L.renderTape(statsOf({ people: { withVoice: { human: 12, agent: 3 }, anonymousCommitments: {} }, voices: { confirmed: 41, rfcsAnswered: 3 }, pool: { balanceCents: 123_456, openClaims: 0, owedCents: 0 } }), NOW);
  const cells = Object.fromEntries([...html.matchAll(/<div><dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map(m => [m[1], m[2].replace(/<[^>]+>/g, '')]));
  assert.deepEqual(Object.keys(cells), ['Record', 'Ledger', 'Last entry', 'Version', 'Kernel', 'Proposals', 'Open now', 'Voices', 'Responses', 'Cases', 'Judgments', 'Pool', 'Credit open', 'Anchored']);
  assert.equal(cells.Record, 'live');
  assert.equal(cells.Ledger, '36,178 entries');
  assert.equal(cells.Voices, '15');
  assert.equal(cells.Pool, '$1,234.56');
  assert.equal(cells.Anchored, '0 of 200');
  assert.match(L.renderTape(statsOf({ log: { length: 10, headHash: 'e'.repeat(64), headAt: NOW - 3_600_000, lastBeaconAt: null, lastDay: {} } }), NOW), /tape__state--quiet">quiet/, 'a record with no recent beacon is quiet, in words');
});

test('the plates state a figure from the record and a rule from the law, exactly', () => {
  const s = statsOf({ people: { withVoice: { human: 2 }, anonymousCommitments: {} }, parameters: { lawRfcWindowMs: 1_209_600_000, engineRfcWindowMs: 2_419_200_000, extractionContestMs: 259_200_000, rfcDepositCents: 1000, caseResponseMs: 604_800_000, caseEvidenceMs: 604_800_000, caseDepositCents: 500, appealMs: 604_800_000, poolClaimCapCents: 1_000_000, penaltyMultiplePermille: 2000 } });
  const row = (html, label) => html.match(new RegExp(`<th scope="row">${label}(?:<small>[^<]*</small>)?</th><td>([\\s\\S]*?)</td>`))?.[1];
  const voice = L.renderVoicePlate(s);
  assert.equal(row(voice, 'Persons with a voice'), '2 <span>2 human</span>');
  for (const w of ['Wealth', 'Stake', 'Activity', 'Intelligence', 'Position']) assert.equal(row(voice, `${w} adds`), '0', `${w} adds nothing (k2)`);
  const change = L.renderChangePlate(s);
  assert.equal(row(change, 'A change to the law stays open'), '14 days');
  assert.equal(row(change, 'A change to the engine stays open'), '28 days');
  assert.equal(row(change, 'Deposit to open one, refundable'), '$10.00');
  const kase = L.renderCasePlate(s);
  assert.equal(row(kase, '1. Filing'), 'cost deposit $5.00, never a bar');
  assert.equal(row(kase, '6. Appeal'), '7 days, to seats that took no part');
  assert.equal(row(kase, '7. Execution'), 'penalty at most 2× the proved harm');
  assert.equal(row(kase, 'Pool cover for an unpaid victim'), 'up to $10,000.00');
});

test('what moves, and nothing else: the tape, a shimmer where something is being read, and the ledger\'s new block', () => {
  const css = read('style.css').replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/, '');
  assert.deepEqual([...css.matchAll(/@keyframes (\w+)/g)].map(m => m[1]), ['shimmer'], 'one keyframe animation: the shimmer');
  assert.deepEqual([...css.matchAll(/([.\w# -]+) \{[^}]*animation: /g)].map(m => m[1].trim()), ['.loading'], 'on a thing that is being read, and nothing else');
  assert.deepEqual([...css.matchAll(/transition: ([^;]+);/g)].map(m => m[1]).filter(t => !/^opacity /.test(t)), ['transform 0.6s ease'], 'the one transition that moves a thing is the ledger\'s new block');
  for (const f of ['rfcs.css', 'cases.css', 'desk.css', 'credit.css', 'propose.css']) assert.doesNotMatch(read(f), /@keyframes|animation:|transition:/, `${f}: no motion`);
  assert.doesNotMatch(read('scene.js'), /uTime|scrollY/, 'the stars do not twinkle or follow the scroll');
  assert.match(read('shell.js'), /calm\.matches/, 'the tape rests for a reader who asked for less motion');
  // A loading placeholder keeps its words for a screen reader.
  for (const page of [...PAGES, ...APP]) for (const [, words] of read(page).matchAll(/<p class="note loading">([^<]*)<\/p>/g)) assert.match(words, /…$/, `${page}: "${words}"`);
});

test('a judgment in the public list links to its case page on this site', () => {
  const html = L.renderJudgments([{ id: 'case_<1>', stage: 'final', dutyTitle: 'Give <notice>', criminal: false, harms: [{ amountCents: 12_500 }], judgments: [{ outcome: 'liable', at: NOW - 86_400_000 }] }], NOW);
  assert.match(html, /Give &lt;notice&gt; · \$125\.00 claimed · <b>liable<\/b>/, 'the duty is text, the money exact');
  assert.match(html, /<a href="case\.html\?id=case_%3C1%3E">Read<\/a>/);
  assert.match(L.renderJudgments([], NOW), /No judgment yet/);
});
