// The site of VibeGov: three locales of every page, the language button, the demo's words, and no request leaving the
// page. Run: node --test site.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://vibegov.commandagi.app';
const PAGES = ['index.html', 'constitution.html', 'about.html', 'demo.html'];
const LOCALES = [
  { tag: 'en', dir: '' },
  { tag: 'es', dir: 'es' },
  { tag: 'zh-Hans', dir: 'zh' },
];
const pagePath = (locale, page) => (locale.dir ? `${locale.dir}/${page}` : page);
const read = path => readFileSync(join(ROOT, path), 'utf8');

test('the site manifest names VibeGov and no build', () => {
  const site = JSON.parse(read('site.json'));
  assert.equal(site.v, 1);
  assert.equal(site.slug, 'vibegov');
  assert.equal(site.status, 'active');
  assert.ok(!site.build, 'a static folder: no build');
  assert.match(site.description, /VibeGov/);
  assert.deepEqual(site.domains, [], 'domains are the platform\'s record, not the folder\'s');
});

test('every page exists in every locale', () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) assert.ok(existsSync(join(ROOT, pagePath(locale, page))), `${pagePath(locale, page)} is missing`);
  }
});

test('each page declares its own lang and the same three locales', () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const path = pagePath(locale, page);
      const html = read(path);
      assert.match(html, new RegExp(`<html lang="${locale.tag.replace('-', '-')}">`), `${path}: <html lang>`);
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => ({ tag: m[1], href: m[2] }));
      assert.deepEqual(alternates.map(a => a.tag).sort(), ['en', 'es', 'x-default', 'zh-Hans'], `${path}: the alternate set`);
      for (const alternate of alternates) {
        const expectedPage = alternate.tag === 'x-default' ? page : pagePath(LOCALES.find(l => l.tag === alternate.tag), page);
        const expected = `${ORIGIN}/${expectedPage.replace(/index\.html$/, '')}`;
        assert.equal(alternate.href, expected, `${path}: ${alternate.tag} names the right page`);
      }
    }
  }
});

test('the language button opens a dialog whose rows are the same page in each locale', () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const path = pagePath(locale, page);
      const html = read(path);
      assert.match(html, /class="lang-button"[^>]*commandfor="lang-dialog"/, `${path}: the A/文 button`);
      assert.match(html, />A\/文</, `${path}: the A/文 glyph`);
      const dialog = html.match(/<dialog[^>]*id="lang-dialog"[\s\S]*?<\/dialog>/);
      assert.ok(dialog, `${path}: the language dialog`);
      const rows = [...dialog[0].matchAll(/<a href="([^"]+)" hreflang="([^"]+)"[^>]*>/g)].map(m => ({ href: m[1], tag: m[2] }));
      assert.equal(rows.length, 3, `${path}: one row per locale`);
      for (const row of rows) {
        const target = resolve(ROOT, dirname(path), row.href);
        assert.ok(existsSync(target), `${path}: ${row.href} resolves`);
        const targetHtml = readFileSync(target, 'utf8');
        assert.match(targetHtml, new RegExp(`<html lang="${row.tag}">`), `${path}: ${row.href} is the ${row.tag} page`);
      }
      assert.equal(rows.filter(r => r.tag === locale.tag).length, 1, `${path}: its own locale is listed once`);
    }
  }
});

test('every relative link and asset resolves on disk', () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const path = pagePath(locale, page);
      const html = read(path);
      const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
      for (const ref of refs) {
        if (/^(mailto:|https?:|#|data:)/.test(ref)) continue;
        const target = resolve(ROOT, dirname(path), ref.split('#')[0]);
        assert.ok(existsSync(target), `${posix.join(locale.dir, page)}: ${ref} does not resolve`);
      }
    }
  }
});

test('no page reaches another host: the CSP, and no external asset', () => {
  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const path = pagePath(locale, page);
      const html = read(path);
      const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
      assert.ok(csp, `${path}: a CSP`);
      for (const rule of ["default-src 'self'", "script-src 'self'", "connect-src 'none'", "form-action 'none'"]) assert.ok(csp[1].includes(rule), `${path}: CSP has ${rule}`);
      for (const ref of [...html.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map(m => m[1])) {
        assert.ok(ref.startsWith(`${ORIGIN}/`), `${path}: ${ref} leaves the site`);
      }
    }
  }
});

test('the demo speaks all three locales, with the same keys and no English left out', () => {
  const source = read('demo.js');
  const literal = source.slice(source.indexOf('const M = {') + 'const M = '.length, source.indexOf('\n  const t = M['));
  const M = new Function(`return ${literal}`)();
  const keys = Object.keys(M.en).sort();
  assert.deepEqual(Object.keys(M.es).sort(), keys, 'es has the same keys as en');
  assert.deepEqual(Object.keys(M.zh).sort(), keys, 'zh has the same keys as en');
  for (const [locale, messages] of Object.entries(M)) {
    for (const key of keys) {
      const value = messages[key];
      if (typeof value === 'function') continue;
      if (Array.isArray(value)) assert.ok(value.length >= 3, `${locale}.${key} lists the three steps`);
      else if (typeof value === 'object') assert.deepEqual(Object.keys(value).sort(), Object.keys(M.en[key]).sort(), `${locale}.${key}: same members`);
      else assert.ok(String(value).trim().length > 0, `${locale}.${key} is empty`);
    }
  }
  // Each page's placeholder is a key the demo fills, in every locale.
  for (const page of PAGES) {
    const html = read(pagePath(LOCALES[0], page));
    for (const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(keys.includes(key), `${page}: data-i18n ${key} is not a demo message`);
  }
  // The proposal set is the same three in every locale, each quoting an article.
  assert.equal((source.match(/id: '[a-z0-9-]+', article:/g) ?? []).length, 9, 'three proposals in three locales');
});

test('the demo keeps its record in the page and sends nothing', () => {
  const demo = read('demo.js');
  assert.doesNotMatch(demo, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage/, 'the demo does not reach the network or storage');
  assert.match(demo, /Nothing you do here leaves this page|Nothing you do there leaves the page/);
  assert.match(demo, /two-thirds|2 \/ 3/, 'the amendment threshold the audit applies');
  for (const locale of ['es', 'zh']) {
    const html = read(`${locale}/demo.html`);
    assert.match(html, new RegExp(`<script src="\\.\\./demo\\.js" defer>`), `${locale}/demo.html loads the one demo script`);
  }
});

test('the pages that are not the demo say what is not built', () => {
  for (const locale of LOCALES) {
    assert.match(read(pagePath(locale, 'about.html')), /not built|no construido|尚未完成|no hecho/i, `${locale}: about says what is not built`);
    assert.match(read(pagePath(locale, 'constitution.html')), /Article 8|Artículo 8|第八条/, `${locale}: the constitution's records article`);
  }
});

test('every loop is muted, poster-first, light, and says it is generated', () => {
  for (const locale of LOCALES) {
    const path = pagePath(locale, 'index.html');
    const html = read(path);
    const sections = [...html.matchAll(/<section[^>]*>[\s\S]*?<\/section>/g)].map(m => m[0]).filter(s => s.includes('<video'));
    assert.equal(sections.length, 3, `${path}: three full-bleed loops`);
    for (const section of sections) {
      const video = section.match(/<video[^>]*>/)[0];
      for (const attribute of ['muted', 'loop', 'playsinline', 'preload="none"', 'aria-hidden="true"']) assert.ok(video.includes(attribute), `${path}: ${video} has ${attribute}`);
      assert.doesNotMatch(video, /autoplay|controls/, `${path}: a loop never autoplays with sound or shows controls`);
      for (const key of ['poster', 'data-av1', 'data-h264']) {
        const ref = video.match(new RegExp(`${key}="([^"]+)"`))[1];
        const file = resolve(ROOT, dirname(path), ref);
        assert.ok(existsSync(file), `${path}: ${ref} exists`);
        assert.ok(statSync(file).size < 3e6, `${path}: ${ref} is under 3 MB`);
      }
      assert.match(section, /class="caption">[^<]*\bfal\b/, `${path}: the loop's caption says it is generated`);
    }
  }
});

test('the amendment scene counts by the template\'s rules, the same in every locale', () => {
  const counts = LOCALES.map(locale => {
    const html = read(pagePath(locale, 'index.html'));
    const ballots = [...html.matchAll(/<li class="ballot" data-vote="(for|against|abstain)"[\s\S]*?<span class="who( agent)?">[^<]*<\/span><span class="w">(\d)<\/span>/g)]
      .map(m => ({ vote: m[1], agent: Boolean(m[2]), weight: Number(m[3]) }));
    assert.equal(ballots.length, 4, `${locale.tag}: four ballots`);
    for (const b of ballots) assert.equal(b.weight, b.agent ? 2 : 3, `${locale.tag}: Article 1 gives a person 3, Article 4 caps an agent at 2`);
    const sum = vote => ballots.filter(b => b.vote === vote).reduce((t, b) => t + b.weight, 0);
    const cast = sum('for') + sum('against');
    assert.ok(sum('for') / cast >= 2 / 3, `${locale.tag}: the amendment carries only past two-thirds of the weight cast`);
    const legend = html.match(/<div class="count__legend"><span>([^]*?)<\/span><\/div>\s*<\/div>/)[1].replace(/<[^>]+>/g, '');
    assert.ok(legend.includes(String(sum('for'))) && legend.includes(String(cast)), `${locale.tag}: the legend says ${sum('for')} of ${cast}`);
    assert.match(html, /class="illustrative"[^>]*>[^<]*Helios Labs/, `${locale.tag}: the scene is labeled illustrative and names the invented organization`);
    assert.equal((html.match(/data-to="\d"/g) ?? []).length, 5, `${locale.tag}: five states, each a button`);
    assert.match(html, /class="status" aria-live="polite"/, `${locale.tag}: the state is announced`);
    return `${sum('for')}/${cast}`;
  });
  assert.equal(new Set(counts).size, 1, 'one count in every locale');
});
