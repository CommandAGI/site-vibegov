// propose.html: the draft the form builds is the request the API's own tests open, field for field; refusals are the
// catalog's words; a title with markup stays text; the page's frame. Run: node --test test/propose.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as P from '../propose.js';
import answer, { OVERVIEW, opened } from './fake-propose.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const DAY = 86_400_000;

/** Type into the form, as the page's events do: each edit through setAt / toggleAt. */
function typed(steps, d = P.blankRfcDraft()) {
  for (const [path, value, toggle] of steps) d = toggle ? P.toggleAt(d, path, value) : P.setAt(d, path, value);
  return d;
}

test('a parameter change: the draft equals the one the route test opens (contract.test.ts, "the public figures…")', () => {
  // POST /contract/rfcs { title: "a longer appeal window", body: "b", options: [{ id: "x", target: "law", title: "x", summary: "",
  //   changes: [{ op: "set_parameter", key: "appealMs", value: 1_209_600_000 }] }] }   → 201
  const d = typed([['title', 'a longer appeal window'], ['body', 'b'], ['options.0.title', 'x'], ['options.0.changes.0.key', 'appealMs'], ['options.0.changes.0.value', '1209600000']]);
  const r = P.rfcRequest(d, 7);
  assert.deepEqual(r.request, {
    procedure: 'deliberative', // the schema's default (rfc.ts RfcDraft), which the editor always sends
    title: 'a longer appeal window',
    body: 'b',
    options: [{ id: 'x', target: 'law', title: 'x', summary: '', changes: [{ op: 'set_parameter', key: 'appealMs', value: 1_209_600_000 }] }],
  });
  assert.equal(P.changeSentence(d.options[0].changes[0]), 'Set Time to appeal to 14 days', 'reads in days, not milliseconds');
  assert.equal(P.inForce(d.options[0].changes[0], OVERVIEW), 'In force: 7 days.');
  assert.deepEqual(P.kernelBound('appealMs', OVERVIEW.kernel.floors), { article: 'k7', text: 'at least 3 days' });
  // The value field keeps only what a whole number may hold, as the editor does.
  assert.equal(P.setAt(d, 'options.0.changes.0.value', '12a,5').options[0].changes[0].value, '125');
});

test('a kind of people: the draft equals the one the route test opens (contract.test.ts, "writes need a principal…")', () => {
  const d = typed([
    ['title', 'recognize agents'], ['body', 'one voice per lineage'], ['options.0.title', 'agents'],
    ['options.0.changes.0.op', 'recognize_people'], ['options.0.changes.0.kind', 'agent'], ['options.0.changes.0.uniqueness', 'lineage'], ['options.0.changes.0.issuers', ' lineage-registry '],
  ]);
  assert.deepEqual(P.rfcRequest(d, 1).request, {
    procedure: 'deliberative',
    title: 'recognize agents',
    body: 'one voice per lineage',
    options: [{ id: 'agents', target: 'law', title: 'agents', summary: '', changes: [{ op: 'recognize_people', kind: { kind: 'agent', uniqueness: 'lineage', issuers: ['lineage-registry'] } }] }],
  });
  assert.equal(P.changeSentence(d.options[0].changes[0]), 'Recognize agent as people (one voice per lineage)');
});

test('a duty: every field the k5 schema holds, elements one per line (files.test.ts "builds the requests")', () => {
  const at = 'options.0.changes.0';
  const d = typed([
    ['title', 'no spam'], ['body', 'Unasked bulk messages cost people time.'], ['procedure', 'binding_score'], ['options.0.title', 'Spam'], ['options.0.summary', 'a duty'],
    [`${at}.op`, 'add_duty'], [`${at}.dutyId`, 'no-spam'], [`${at}.title`, 'no spam'], [`${at}.text`, 'No one may send bulk messages nobody asked for.'],
    [`${at}.protects`, 'privacy', true], [`${at}.protects`, 'access', true], [`${at}.protects`, 'access', true], [`${at}.harm`, 'time lost to unasked messages'],
    [`${at}.elements`, 'sent: they sent it\nharm: it cost me\n\n'], [`${at}.criminal`, true],
  ]);
  assert.deepEqual(P.rfcRequest(d, 5).request, {
    procedure: 'binding_score',
    title: 'no spam',
    body: 'Unasked bulk messages cost people time.',
    options: [{ id: 'spam', target: 'law', title: 'Spam', summary: 'a duty', changes: [{ op: 'add_duty', duty: {
      id: 'no-spam', title: 'no spam', text: 'No one may send bulk messages nobody asked for.', protects: ['privacy'], harm: 'time lost to unasked messages',
      elements: [{ id: 'sent', text: 'they sent it' }, { id: 'harm', text: 'it cost me' }], criminal: true, effectiveFrom: 5,
    } }] }],
  });
  // Amending starts from the duty in force; repealing names it.
  const amend = P.startFromDuty(typed([[`${at}.op`, 'amend_duty'], [`${at}.dutyId`, 'theft']]), 0, 0, OVERVIEW.law);
  assert.equal(amend.options[0].changes[0].title, 'no theft');
  assert.deepEqual(P.toLawChange(amend.options[0].changes[0], 0).duty.elements.map(e => e.id), ['taking', 'ownership', 'no_consent', 'harm']);
  assert.deepEqual(P.toLawChange(typed([[`${at}.op`, 'repeal_duty'], [`${at}.dutyId`, 'theft']]).options[0].changes[0], 0), { op: 'repeal_duty', id: 'theft' });
  // Text is always admitted, whatever is unticked.
  const media = typed([[`${at}.op`, 'set_evidence_modalities'], [`${at}.modalities`, 'text', true], [`${at}.modalities`, 'video', true]]);
  assert.deepEqual(P.toLawChange(media.options[0].changes[0], 0), { op: 'set_evidence_modalities', modalities: ['text', 'video'] });
});

test('an engine RFC is JSON, as in the editor; JSON that is not JSON is refused before the API is asked', () => {
  const d = typed([['title', 't'], ['body', 'b'], ['target', 'engine'], ['options.0.title', 'Next engine'], ['engineJson', '{"tiers": []}']]);
  assert.deepEqual(P.rfcRequest(d, 1).request.options, [{ id: 'next-engine', target: 'engine', title: 'Next engine', summary: '', engine: { tiers: [] } }]);
  assert.deepEqual(P.rfcRequest(P.setAt(d, 'engineJson', 'nope'), 1), { refusal: 'engine_json' });
  assert.match(P.renderRefusals([{ code: 'engine_json' }]), /The engine is not valid JSON\./);
});

test('two options with one effect go to the API (the editor does not check it), which refuses; the page words it', async () => {
  const one = [['options.0.changes.0.key', 'rfcDepositCents'], ['options.0.changes.0.value', '1234'], ['options.0.changes.1.key', 'caseDepositCents'], ['options.0.changes.1.value', '1234']];
  let d = typed([['title', 't'], ['body', 'b'], ['options.0.title', 'a']]);
  d = P.addChange(d, 0);
  d = P.addOption(d);
  d = P.addChange(d, 1);
  d = typed([...one, ['options.1.title', 'b'], ...one.map(([p, v]) => [p.replace('options.0.changes.0', 'options.1.changes.1').replace('options.0.changes.1', 'options.1.changes.0'), v])], d);
  const req = P.rfcRequest(d, 1).request;
  assert.equal(req.options.length, 2, 'both options are sent');
  const res = await answer({ method: 'POST', path: '/contract/rfcs', headers: { authorization: 'Bearer x' }, body: req });
  assert.equal(res.status, 422);
  const html = P.renderRefusals(res.body.refused);
  assert.match(html, /Two options change exactly the same thing\./);
  assert.match(html, /<code>rfc\.duplicate_effect<\/code>/);
  // A kernel code is said as the article it breaches; a code the catalog lacks is shown as its code.
  assert.match(P.renderRefusals([{ code: 'k4.law_window', detail: 'x: law RFC window below the kernel floor' }]), /Breaches the kernel: change only by voice \(k4\)\.[\s\S]*law RFC window below the kernel floor/);
  assert.match(P.renderRefusals([{ code: 'rfc.retry' }]), /Refused \(rfc\.retry\)\./);
  const ok = await answer({ method: 'POST', path: '/contract/rfcs', headers: { authorization: 'Bearer x' }, body: P.rfcRequest(P.removeOption(d, 1), 1).request });
  assert.equal(ok.status, 201);
  assert.equal(opened.at(-1).options[0].id, 'status_quo', 'the contract adds the status quo');
});

test('a title, an option and a refusal with markup stay text', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const d = typed([['title', evil], ['body', 'b'], ['options.0.title', evil], ['options.0.summary', evil], ['options.0.changes.0.op', 'add_duty'], ['options.0.changes.0.title', evil]]);
  for (const html of [P.renderQuestion(d), P.renderOptions(d, OVERVIEW), P.renderBallot(d), P.renderRefusals([{ code: evil, detail: evil }])]) {
    assert.ok(!html.includes('<img'), html.slice(0, 200));
    assert.ok(html.includes('&lt;img'), 'the markup is shown as text');
  }
});

test('what opening does and costs is read from the law in force', () => {
  const law = P.renderCosts(OVERVIEW, 'law');
  assert.match(law, /Opening an RFC holds a deposit of <b>\$10\.00<\/b>\. It comes back/);
  assert.match(law, /<b>14 days<\/b>/);
  assert.match(law, /The kernel holds it at least 7 days/);
  assert.match(law, /<b>human<\/b>/);
  assert.match(law, /same resulting law/);
  assert.match(law, /Contract version <b>3<\/b> and the engine <code[^>]*>24edc06a7777…<\/code>/);
  assert.match(P.renderCosts(OVERVIEW, 'engine'), /<b>28 days<\/b>[\s\S]*at least 21 days/);
  assert.match(P.renderCosts(null, 'law'), /could not be read/);
  assert.equal(P.missingWords(P.blankRfcDraft()), 'Give a title and what and why to open the RFC.');
  assert.equal(P.canOpen(typed([['title', 't'], ['body', ' ']])), false, 'the editor\'s one check: a title and a body');
});

test('a draft kept in sessionStorage comes back whole, a missing field from the blank', () => {
  const d = P.draftOf(JSON.parse(JSON.stringify({ title: 't', options: [{ title: 'o', changes: [{ op: 'repeal_duty', dutyId: 'theft' }] }] })));
  assert.equal(d.procedure, 'deliberative');
  assert.equal(d.options[0].summary, '');
  assert.deepEqual(d.options[0].changes[0].modalities, ['text']);
  assert.deepEqual(P.draftOf('garbage'), P.blankRfcDraft());
});

test('the kernel quoted on the page is the kernel, letter for letter', () => {
  const { kernel } = JSON.parse(read('fixtures/kernel.json'));
  const text = Object.fromEntries(kernel.articles.map(a => [a.id, a.text]));
  const page = read('propose.js');
  const quotes = [...page.matchAll(/ref\('(k\d+)'\)\} <q>([^<]+)<\/q>/g)];
  assert.ok(quotes.length >= 4);
  for (const [, article, quote] of quotes) assert.ok(text[article].includes(quote), `${article}: “${quote}”`);
});

test('the frame: CSP, one module, no inline script, the contents line, its own stylesheet', () => {
  const html = read('propose.html');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const rule of ["default-src 'self'", "script-src 'self'", "connect-src 'self' https://api.commandagi.com;", "form-action 'none'"]) assert.ok(csp.includes(rule), rule);
  assert.match(html, /<meta name="vibegov-api" content="https:\/\/api\.commandagi\.com">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/vibegov\.pro\/propose\.html">/);
  assert.deepEqual([...html.matchAll(/<script[^>]*>/g)].map(m => m[0]), ['<script src="gov.js" defer>', '<script type="module" src="scene.js">', '<script type="module" src="shell.js">', '<script type="module" src="propose.js">']);
  assert.ok(!/<script>[^<]|\son[a-z]+="/.test(html), 'no inline script or handler');
  const contents = html.match(/<nav id="contents"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...contents.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['index.html', 'record.html', 'contract.html', 'rfcs.html', 'cases.html', 'credit.html']);
  assert.match(html, /<link rel="stylesheet" href="propose\.css">/);
  assert.match(html, /<button class="btn primary" type="submit" id="open"/, 'one primary act');
  assert.equal([...html.matchAll(/btn primary/g)].length, 1);
  assert.match(read('propose.js'), /requireSignIn\(\)/);
  assert.ok(!/transition:(?!\s*none)|animation:/.test(read('propose.css')), 'no motion');
});
