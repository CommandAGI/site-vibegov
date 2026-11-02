// The site of VibeGov, the Coordination Contract's home: three pages, the contract's text in its markers, no request
// leaving the page but the prompt a visitor sends on purpose. Run: node --test site.test.mjs
// That contract.html renders docs/coordination-contract.md as it is, the CommandAGI repository checks
// (node scripts/seed/vibegov-contract.mjs --check, in scripts/checks/check-generated-files.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://vibegov.pro';
const PAGES = ['index.html', 'contract.html', 'join.html'];
const read = path => readFileSync(join(ROOT, path), 'utf8');

test('the site manifest names VibeGov and no build', () => {
  const site = JSON.parse(read('site.json'));
  assert.equal(site.v, 1);
  assert.equal(site.slug, 'vibegov');
  assert.equal(site.status, 'active');
  assert.ok(!site.build, 'a static folder: no build');
  assert.match(site.description, /Coordination Contract/);
  assert.deepEqual(site.domains, [], 'domains are the platform\'s record, not the folder\'s');
});

test('three pages, in English, each with its canonical address and the same contents line', () => {
  const html = readdirSync(ROOT, { recursive: true }).filter(f => String(f).endsWith('.html') && !String(f).startsWith('redesign'));
  assert.deepEqual(html.sort(), [...PAGES].sort(), 'the pages are these three');
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
    for (const [, ref] of text.matchAll(/(?:href|src|data-av1|data-h264|data-poster|poster)="([^"]+)"/g)) {
      if (/^(mailto:|https?:|data:)/.test(ref)) continue;
      if (ref.startsWith('#')) {
        assert.match(text, new RegExp(`id="${ref.slice(1)}"`), `${page}: ${ref} names no element`);
        continue;
      }
      assert.ok(existsSync(resolve(ROOT, ref.split('#')[0])), `${page}: ${ref} does not resolve`);
    }
  }
});

test('no page reaches another host, but the one prompt a visitor sends', () => {
  for (const page of PAGES) {
    const text = read(page);
    const csp = text.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${page}: a CSP`);
    for (const rule of ["default-src 'self'", "script-src 'self'", "connect-src 'none'"]) assert.ok(csp.includes(rule), `${page}: ${rule}`);
    assert.match(csp, page === 'join.html' ? /form-action https:\/\/commandagi\.com(;|$)/ : /form-action 'none'/, `${page}: form-action`);
    for (const [, ref] of text.matchAll(/<(?:script|img|source|video|link rel="(?:stylesheet|preload|icon|apple-touch-icon)")[^>]*(?:src|href)="(https?:[^"]+)"/g))
      assert.fail(`${page}: an asset from another host (${ref})`);
  }
  const form = read('join.html').match(/<form[^>]*>/)[0];
  assert.match(form, /action="https:\/\/commandagi\.com\/" method="get"/, 'the prompt goes to the workbench as ?prompt=');
  assert.match(read('join.html'), /<textarea[^>]*name="prompt"/);
});

test('the contract page carries the rendered text between its markers', () => {
  const text = read('contract.html');
  const region = text.match(/<!-- contract:begin [^>]*-->([\s\S]*?)<!-- contract:end -->/)?.[1] ?? '';
  assert.ok(region.length > 10000, 'the region holds the rendered clauses');
  const articles = [...region.matchAll(/<article class="article" id="k(\d+)">/g)].map(m => Number(m[1]));
  assert.deepEqual(articles, Array.from({ length: 12 }, (_, i) => i + 1), 'the kernel\'s twelve articles, in order');
  assert.match(region, /<dt>Kernel<\/dt><dd><code title="[0-9a-f]{64}">/, 'the kernel\'s hash');
  for (const [, id] of region.matchAll(/<a href="#([^"]+)">/g)) assert.match(region, new RegExp(`<section class="clause" id="${id}"`), `the contents link #${id}`);
  for (const f of ['coordination-contract.pdf', 'coordination-contract-short.pdf']) {
    assert.match(text, new RegExp(`href="papers/${f.replace('.', '\\.')}"`));
    assert.equal(readFileSync(join(ROOT, 'papers', f)).subarray(0, 5).toString(), '%PDF-', `papers/${f} is a PDF`);
  }
});

test('every loop is muted, poster-first, light, and says it is generated', () => {
  const html = read('index.html');
  const sections = [...html.matchAll(/<section[^>]*>[\s\S]*?<\/section>/g)].map(m => m[0]).filter(s => s.includes('<video'));
  assert.equal(sections.length, 3, 'three full-bleed loops');
  for (const section of sections) {
    const video = section.match(/<video[^>]*>/)[0];
    for (const attribute of ['muted', 'loop', 'playsinline', 'preload="none"', 'aria-hidden="true"']) assert.ok(video.includes(attribute), `${video} has ${attribute}`);
    assert.doesNotMatch(video, /autoplay|controls/, 'a loop never autoplays with sound or shows controls');
    for (const key of ['poster', 'data-av1', 'data-h264']) {
      const ref = video.match(new RegExp(`${key}="([^"]+)"`))[1];
      assert.ok(statSync(resolve(ROOT, ref)).size < 3e6, `${ref} is under 3 MB`);
    }
    assert.match(section, /class="caption">[^<]*\bfal\b/, 'the loop\'s caption says it is generated');
  }
});

test('the RFC scene tallies as the contract does: an option scores the sum of its voices', () => {
  const html = read('index.html');
  const ballots = html.match(/<ul class="ballots" data-score="(-?\d+)">([\s\S]*?)<\/ul>/);
  const scores = [...ballots[2].matchAll(/data-s="(-?\d+)"/g)].map(m => Number(m[1]));
  for (const s of scores) assert.ok(s >= -2 && s <= 2, `a score is −2 to +2 (${s})`);
  const sum = scores.reduce((a, b) => a + b, 0);
  assert.equal(Number(ballots[1]), sum, 'the stated score is the sum');
  assert.match(html, new RegExp(`The change <b>\\+${sum}</b>`), 'the legend says the sum');
  const hist = [...html.match(/<div class="hist"[\s\S]*?<\/div>/)[0].matchAll(/--n:(\d+)/g)].map(m => Number(m[1]));
  assert.deepEqual(hist, [-2, -1, 0, 1, 2].map(v => scores.filter(s => s === v).length), 'the histogram counts the scores');
  for (const step of [0, 1, 2, 3, 4]) assert.match(html, new RegExp(`data-to="${step}"`), `the stepper reaches step ${step}`);
  assert.match(html, /class="illustrative">[^<]*Illustrative/, 'the scene says it is illustrative');
});
