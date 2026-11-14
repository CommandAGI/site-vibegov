// The proposal pages (rfcs.html, rfc.html): their pure render functions against the shapes the API answers, and the
// pages' frames. Run: node --test test/rfcs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../rfcs.js';
import * as P from '../rfc.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 13, 12);
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const H = c => c.repeat(64);
const row = (id, status, over = {}) => ({ id, title: id, target: 'law', status, openedAt: NOW - 3 * DAY, closesAt: NOW + 4 * DAY, adopted: null, ...over });

test('the list: open first by soonest close, then being read, then decided', () => {
  const rows = [
    row('d_old', 'rejected', { closesAt: NOW - 30 * DAY }),
    row('open_late', 'open', { closesAt: NOW + 9 * DAY }),
    row('d_new', 'adopted', { closesAt: NOW - 5 * DAY, adopted: 'longer' }),
    row('reading', 'contest', { closesAt: NOW - 1 * DAY }),
    row('open_soon', 'open', { closesAt: NOW + 2 * DAY }),
    row('late_open', 'open', { closesAt: NOW - 1000 }),
  ];
  const html = L.renderRfcList(rows, NOW);
  const at = id => html.indexOf(`rfc.html?id=${id}"`);
  assert.ok(at('open_soon') < at('open_late'), 'soonest close first');
  assert.ok(at('open_late') < at('reading') && at('late_open') > at('open_late'), 'a proposal past its close is not open');
  assert.ok(at('reading') < at('d_new') && at('d_new') < at('d_old'), 'then decided, newest first');
  assert.match(html, /Adopted/);
  assert.match(html, /Status quo kept/);
  assert.match(html, /Closed, waiting to be read/);
  assert.match(html, /closes in 2d 00h/);
});

test('the list: a proposal that waits for your voice is marked; the others are not', () => {
  const html = L.renderRfcList([row('a', 'open'), row('b', 'open')], NOW, new Map([['a', { unconfirmed: false }], ['b', { unconfirmed: true }]]));
  assert.match(html, /Waits for your voice/);
  assert.match(html, /Confirm your response/);
  assert.equal((L.renderRfcList([row('c', 'open')], NOW).match(/state--yours/g) ?? []).length, 0);
});

test('the list: a title with markup stays text', () => {
  const html = L.renderRfcList([row('x', 'open', { title: '<img src=x onerror=alert(1)> & "q"' })], NOW);
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;q&quot;/);
});

test('the list: with no proposal it says so and shows the law\'s windows', () => {
  const html = L.renderRfcList([], NOW, new Map(), { lawRfcWindowMs: 14 * DAY, rfcDepositCents: 1000, extractionContestMs: 3 * DAY });
  assert.match(html, /No proposal has been opened yet/);
  assert.match(html, /An RFC on the law is open for/);
  assert.match(html, /\$10\.00/);
  assert.match(L.renderRfcList([], NOW), /No proposal has been opened yet/);
  assert.ok(!L.renderRfcList([], NOW).includes('What the law sets now'), 'no windows when they could not be read');
});

test('the act says what it costs before the button', () => {
  const html = L.renderOpenAct({ rfcDepositCents: 1000 });
  assert.ok(html.includes('href="propose.html"'));
  assert.match(html, /deposit of \$10\.00/);
  assert.match(html, /comes back when someone other than you supports a change/);
});

test('awaiting words: no voice names why; a voice names the count', () => {
  assert.match(L.renderAwaitingNote({ voice: null, why: 'not_a_person', rfcs: [] }), /no voice yet.*personhood proof/);
  assert.match(L.renderAwaitingNote({ voice: 'person:a', rfcs: [{}, {}] }), /2 open proposals wait/);
  assert.match(L.renderAwaitingNote({ voice: 'person:a', rfcs: [] }), /No open proposal waits/);
  assert.match(L.renderAwaitingNote(null), /could not be read/);
});

// ─── one proposal ───────────────────────────────────────────────────────────

const rfc = (over = {}) => ({
  procedure: 'binding_score', id: 'rfc_1', opener: 'person:x', title: 'Longer window', body: 'Why.\nBecause.', target: 'law',
  options: [
    { id: 'status_quo', target: 'none', title: 'keep things as they are', summary: 'No change.' },
    { id: 'longer', target: 'law', title: 'A longer window', summary: 'More time.', changes: [{ op: 'set_parameter', key: 'lawRfcWindowMs', value: 21 * DAY }, { op: 'add_duty', duty: { id: 'd1', title: 'Give notice' } }] },
    { id: 'new_reader', target: 'engine', title: 'A reader', summary: '', engine: { name: 'clef-2' } },
  ],
  openedAt: NOW - 3 * DAY, closesAt: NOW + 4 * DAY, contestMs: 3 * DAY, contractVersion: 3, engineHash: H('b'), baseStateHash: H('c'), people: ['person'], anonymity: {}, depositCents: 1000, ...over,
});
const tally = { respondents: 5, scores: { longer: 4 }, histogram: { longer: [0, 1, 1, 2, 1] }, unscored: { longer: 1 }, favored: 'longer', recordDigest: H('d') };
const view = (over = {}) => P.normalize({ rfc: rfc(), status: 'open', responses: 7, decision: null, decisionHash: null, concurrence: null, tally: null, myResponses: [], myExtraction: null, ...over }, null);

test('options: each option\'s changes in plain words; the status quo has its own words', () => {
  const html = P.renderOptions(rfc().options);
  assert.match(html, /Keep things as they are/);
  assert.match(html, /Set Law RFC window to 21 days/);
  assert.match(html, /Add the duty “Give notice” \(d1\)/);
  assert.match(html, /Replace the engine with “clef-2”/);
});

test('head and facts: an open proposal counts its responses and shows no score', () => {
  const v = view();
  assert.match(P.renderHead(v, NOW), /Open/);
  assert.match(P.renderHead(v, NOW), /closes in 4d 00h/);
  assert.match(P.renderFacts(v, NOW), /7 confirmed so far.*nobody shows a score/);
  assert.match(P.renderTally(v, NOW), /<b>7<\/b> confirmed responses so far/);
  assert.ok(!P.renderTally(v, NOW).includes('table'), 'no histogram before the reading');
});

test('a title or a body with markup stays text on the page', () => {
  const v = view({ rfc: rfc({ title: '<script>alert(1)</script>', options: [{ id: 'status_quo', target: 'none', title: 't', summary: '' }, { id: 'a', target: 'law', title: '<b>x</b>', summary: '<i>s</i>', changes: [{ op: 'add_duty', duty: { id: 'i', title: '<u>d</u>' } }] }] }) });
  for (const html of [P.renderHead(v, NOW), P.renderOptions(v.rfc.options)]) {
    assert.ok(!/<(script|b|i|u)>/.test(html), html);
    assert.match(html, /&lt;/);
  }
});

test('after the reading: the tally with its histogram, the favored option, and the provisional note', () => {
  const v = view({ status: 'contest', tally: { ...tally, provisional: true } });
  const html = P.renderTally(v, NOW);
  assert.match(html, /5<\/b> voices read/);
  assert.match(html, /may still contest/);
  assert.match(html, /<td class="num">\+4<\/td>/);
  assert.match(html, /1 at −1/);
  assert.match(html, /favored/);
  assert.match(html, /Favored by the voice: A longer window/);
});

test('a decision: adopted with its reason and deposit, or the status quo kept', () => {
  const d = { adopted: 'longer', reason: 'The tally is positive.', decidedAt: NOW - DAY, decisionHash: H('e'), depositReturned: true, participation: { respondents: 5, representativeness: 'Five voices.' }, concurrence: ['det_1'] };
  const adopted = P.renderDecision(view({ status: 'adopted', decision: { adopted: 'longer', reason: d.reason, depositReturned: true, concurrence: ['det_1'] }, decisionHash: H('e') }), NOW);
  assert.match(adopted, /Adopted: A longer window/);
  assert.match(adopted, /The opener’s deposit was returned/);
  assert.match(adopted, /Decision record/);
  const kept = P.renderDecision(view({ status: 'rejected', decision: { adopted: null, reason: 'No score led.', depositReturned: false, concurrence: [] } }), NOW);
  assert.match(kept, /Status quo kept/);
  assert.match(kept, /went to the commons/);
  assert.equal(P.renderDecision(view(), NOW), '');
  assert.deepEqual(P.determinationIds(view({ concurrence: { outgoing: 'o', incoming: 'i' }, decision: { adopted: null, reason: '', depositReturned: false, concurrence: ['o', 'z'] } })), ['o', 'i', 'z']);
});

test('a determination: its rounds, its answers and its outcome in the catalog\'s words', () => {
  const html = P.renderDetermination({ id: 'det_1', kind: 'rfc.concurrence', packageDigest: H('a'), outcome: { status: 'decided', label: 'concur', confidence: 910, tier: 2 }, rounds: [{ tier: 2, note: 'quorum', answers: [{ seat: 'clef', label: 'concur', confidence: 910, ms: 800 }, { seat: 'x<b>', error: 'timeout' }], aggregate: { label: 'concur', confidence: 910, groups: 1 } }] });
  assert.match(html, /concur at tier 2, 910\/1000/);
  assert.match(html, /failed: timeout/);
  assert.match(html, /concur at 910\/1000 from 1 groups/);
  assert.ok(!html.includes('x<b>') && html.includes('x&lt;b&gt;'), 'a seat name is text');
});

const panel = (over = {}) => ({ rfc: rfc(), now: NOW, open: true, signedIn: true, voice: 'person:a', why: null, meFailed: false, anonymous: false, hasAnonymity: false, myResponses: [], extraction: null, titles: { longer: 'A longer window' }, text: '', media: [], receipt: null, refusals: [], mediaRefusals: [], done: null, pending: false, uploading: false, ...over });

test('the panel: a visitor is asked to sign in, with the way back to this proposal', () => {
  const html = P.renderPanel(panel({ signedIn: false }));
  assert.match(html, /Sign in to respond/);
  assert.match(html, /href="signin\.html\?next=rfc\.html%3Fid%3Drfc_1"/);
  assert.ok(!html.includes('<textarea'));
  assert.ok(!P.renderPanel(panel({ signedIn: false, open: false })).includes('Sign in to respond'));
});

test('the panel: a person with no voice is told why and sent to the desk', () => {
  const html = P.renderPanel(panel({ voice: null, why: 'not_a_person' }));
  assert.match(html, /You cannot respond yet/);
  assert.match(html, /no personhood proof the law accepts/);
  assert.match(html, /href="home\.html"/);
  assert.ok(!html.includes('<textarea'));
  assert.match(P.renderPanel(panel({ meFailed: true })), /could not be read/);
});

test('the panel: an anonymous voice on a device without its identity is asked for the file; the form is not offered', () => {
  const html = P.renderPanel(panel({ anonymous: true }));
  assert.match(html, /answer it anonymously, and only so/);
  assert.match(html, /This device does not hold that identity/);
  assert.match(html, /data-act="anon-load"/);
  assert.match(html, /on this device only/);
  assert.match(html, /Clearing this site’s data/);
  assert.ok(!html.includes('commandagi.com/app'), 'no act is sent to the workbench');
  assert.ok(!html.includes('<textarea'));
  assert.match(P.renderPanel(panel({ anonymous: true, commitment: '12345678901234567890' })), /holds another identity \(commitment <code>1234567890123456…<\/code>\)/);
  assert.match(P.renderPanel(panel({ anonymous: true, treeFailed: true })), /could not be read just now/);
});

const tree = { kind: 'person', leaves: ['1', '2', '3'], root: '9', size: 3 };
test('the panel, anonymously: write, attach, when to send, prove; the proof is the confirmation', () => {
  const html = P.renderPanel(panel({ anonMode: true, tree, text: 'I <b>agree</b>', delay: 'minutes', signedIn: false }));
  assert.match(html, /Answering anonymously/);
  assert.match(html, /among 3 registered persons/);
  assert.match(html, /<textarea id="resp-text"[^>]*>I &lt;b&gt;agree&lt;\/b&gt;<\/textarea>/);
  assert.match(html, /<option value="minutes" selected>after a random wait of up to 10 minutes<\/option>/);
  assert.match(html, /its name is not sent/);
  assert.match(html, /data-act="anon-send">Prove and send anonymously/);
  assert.ok(html.indexOf('no separate confirmation') < html.indexOf('data-act="anon-send"') || html.indexOf('There is no separate confirmation') < html.indexOf('data-act="anon-send"'), 'what it binds is said before the button');
  assert.match(html, /data-slot="step"/);
  assert.ok(!html.includes('data-act="send"') && !html.includes('confirm-receipt'), 'no signed-in act, no confirm');
  assert.match(P.renderPanel(panel({ anonMode: true, tree })), /data-act="anon-send" disabled/);
  const sent = P.renderPanel(panel({ anonMode: true, tree, done: 'anonymousSent', anonReceipt: { id: 'anon-1', digest: H('a'), nullifier: '4242' } }));
  assert.match(sent, /Sent anonymously\./);
  assert.match(sent, /Received anonymously/);
  assert.match(sent, /Your voice in this RFC: 4242/);
  assert.match(sent, /digest a{64}/);
});

test('the panel, anonymously after the close: look up under a proof, then the reading and the contest', () => {
  const closed = panel({ anonMode: true, tree, open: false, titles: { longer: 'A longer window', other: 'Other' } });
  assert.match(P.renderPanel(closed), /data-act="anon-lookup">Look up my interpretation \(anonymously\)/);
  assert.match(P.renderPanel({ ...closed, lookup: { voice: 'anon:person:1', responses: [], interpretation: null } }), /You did not respond to this RFC/);
  const waiting = P.renderPanel({ ...closed, lookup: { voice: 'anon:person:1', responses: [{ id: 'anon-1', digest: H('5'), receivedAt: NOW, parts: [{ type: 'text', text: 'mine <i>' }] }], interpretation: null } });
  assert.match(waiting, /has not been interpreted yet/);
  assert.match(waiting, /mine &lt;i&gt;/);
  const read = P.renderPanel({ ...closed, lookup: { voice: 'anon:person:1', responses: [], interpretation: extraction() } });
  assert.match(read, /How your response was read/);
  assert.match(read, /data-act="contest"/);
});

test('the panel: write, then the receipt with its digest, and the binding said before the confirm button', () => {
  const html = P.renderPanel(panel({ text: 'I <b>agree</b>', receipt: { id: 'resp_1', digest: H('a') }, myResponses: [{ id: 'resp_1', digest: H('a'), at: NOW, confirmedAt: null, parts: [{ type: 'text', text: 'I <b>agree</b>' }] }] }));
  assert.match(html, /<textarea id="resp-text"[^>]*>I &lt;b&gt;agree&lt;\/b&gt;<\/textarea>/);
  assert.match(html, /digest a{64}/);
  assert.match(html, /Only a confirmed response counts/);
  assert.match(html, /later confirmed response replaces an earlier one until the proposal closes/);
  assert.ok(html.indexOf('Only a confirmed response counts') < html.indexOf('data-act="confirm-receipt"'));
  assert.equal((html.match(/data-act="confirm"/g) ?? []).length, 0, 'the receipt is not listed twice');
  assert.match(html, /Sending gives you a receipt/);
});

test('the panel: the send button waits for text or a file; an earlier unconfirmed response can be confirmed', () => {
  assert.match(P.renderPanel(panel()), /data-act="send" disabled/);
  assert.ok(!/data-act="send" disabled/.test(P.renderPanel(panel({ text: 'x' }))));
  assert.ok(!/data-act="send" disabled/.test(P.renderPanel(panel({ media: [{ type: 'ref', modality: 'image', sha256: H('7'), label: 'a.png' }] }))));
  const html = P.renderPanel(panel({ myResponses: [{ id: 'r9', digest: H('9'), at: NOW, confirmedAt: null, parts: [{ type: 'text', text: 'hi' }] }, { id: 'r8', digest: H('8'), at: NOW - 1, confirmedAt: NOW - 1, parts: [{ type: 'text', text: 'old' }] }] }));
  assert.match(html, /data-act="confirm" data-id="r9"/);
  assert.match(html, /not confirmed/);
  assert.match(html, />confirmed</);
});

test('the panel: attached media shows its kind and name, and a refusal in words', () => {
  const html = P.renderPanel(panel({ media: [{ type: 'ref', modality: 'audio', sha256: H('7'), label: 'my<b>.mp3' }], mediaRefusals: [{ code: 'too_large' }] }));
  assert.match(html, /<span>audio<\/span><span>my&lt;b&gt;\.mp3<\/span>/);
  assert.match(html, /The file is too large\./);
});

test('refusals: said in the catalog\'s words, a code with no words as its code', () => {
  const html = P.renderRefusals([{ code: 'closed' }, { code: 'digest_mismatch' }, { code: 'zzz_new' }, { code: 'respond_anonymously' }], 'rfc_1');
  assert.match(html, /The RFC has closed\./);
  assert.match(html, /does not match this response/);
  assert.match(html, /Refused \(zzz_new\)/);
  assert.match(html, /so you answer it anonymously\./);
  assert.ok(!html.includes('workbench'), 'the anonymous act is on this site');
  assert.equal(P.renderRefusals([]), '');
});

const extraction = (over = {}) => ({ rfcId: 'rfc_1', voice: 'v', responseId: 'r1', scores: { longer: 2, other: -1 }, unscored: { other: 'unresolved' }, determinations: [], availableAt: NOW - DAY, contestUntil: NOW + 2 * DAY, contested: false, ...over });

test('after the close: how the response was read, and what a contest does', () => {
  const html = P.renderPanel(panel({ open: false, extraction: extraction(), titles: { longer: 'A longer window', other: 'Other' } }));
  assert.match(html, /How your response was read/);
  assert.match(html, /strongly for/);
  assert.match(html, /\(\+2 on a scale from −2 to \+2\)/);
  assert.match(html, /against/);
  assert.match(html, /the engine was divided: scored 0/);
  assert.match(html, /read again at the top tier, by seats that took no part/);
  assert.match(html, /data-act="contest"/);
});

test('after the close: a contested reading, or a closed window, offers no contest', () => {
  assert.ok(!P.renderPanel(panel({ open: false, extraction: extraction({ contested: true }) })).includes('data-act="contest"'));
  assert.match(P.renderPanel(panel({ open: false, extraction: extraction({ contested: true }) })), /You contested this/);
  const late = P.renderPanel(panel({ open: false, extraction: extraction({ contestUntil: NOW - 1 }) }));
  assert.ok(!late.includes('data-act="contest"'));
  assert.match(late, /contest window closed/);
});

test('after the close: no reading yet, or no response, in words', () => {
  assert.match(P.renderPanel(panel({ open: false, myResponses: [{ id: 'r', digest: H('1'), at: NOW, confirmedAt: NOW, parts: [] }] })), /has not been interpreted yet/);
  assert.match(P.renderPanel(panel({ open: false })), /You did not respond to this RFC/);
  assert.match(P.renderPanel(panel({ open: false, hasAnonymity: true })), /answered this proposal anonymously/);
});

test('a missing proposal says so in words', () => {
  assert.match(P.renderMissing('nope', 404), /No proposal has the id <code>nope<\/code>/);
  assert.match(P.renderMissing('<x>', 404), /&lt;x&gt;/);
  assert.match(P.renderMissing('x', 502), /could not be reached/);
});

// ─── the frames ─────────────────────────────────────────────────────────────

for (const page of ['rfcs', 'rfc']) {
  test(`${page}.html: the frame (CSP, one module, no inline script, the contents line)`, () => {
    const html = read(`${page}.html`);
    assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self'/);
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.ok(!csp.includes("'unsafe-eval'"), 'never unsafe-eval');
    // Only the page that proves may compile WebAssembly and start the prover's blob workers.
    assert.equal(csp.includes("'wasm-unsafe-eval'"), page === 'rfc');
    assert.equal(/worker-src blob:;/.test(csp), page === 'rfc');
    assert.equal((html.match(/<script type="module" src="[^"]+"/g) ?? []).length, 2, 'shell and the page module');
    assert.ok(html.includes(`<script type="module" src="${page}.js">`));
    assert.ok(!/<script(?![^>]*\bsrc=)/.test(html), 'no inline script');
    assert.ok(!/\son[a-z]+="/.test(html), 'no inline handler');
    assert.match(html, /<link rel="stylesheet" href="rfcs\.css">/);
    assert.match(html, /<a href="rfcs\.html" aria-current="page">Proposals<\/a>/);
    assert.match(html, /data-account/);
    assert.match(html, /<main id="main" class="sheet">/);
    assert.match(html, /<title>[^<]+ · VibeGov<\/title>/);
  });
}
