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

test('no generated picture stands in for the record: no video, no photograph, one drawn mark', () => {
  assert.ok(!existsSync(join(ROOT, 'media')), 'no media folder');
  for (const page of PAGES) {
    const text = read(page);
    assert.doesNotMatch(text, /<video|<picture|\.webp|\.jpe?g|\.mp4/, `${page}: no footage or photograph`);
    for (const [, src] of text.matchAll(/<img[^>]*src="([^"]+)"/g)) assert.equal(src, 'mark.svg', `${page}: the only image is the mark`);
    assert.doesNotMatch(text, /fal\b|generated footage/i, `${page}: says nothing about footage`);
  }
});

test('each live part of a page is one that page.js fills', () => {
  const filled = new Set([...read('page.js').matchAll(/(?:put|el)\('([a-z-]+)'/g)].map(m => m[1]));
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
    assert.match(L.renderDecided(s, NOW), /Adopted<\/span> <a href="[^"]+rfc%3Drfc_z">Lower the deposit/);
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
