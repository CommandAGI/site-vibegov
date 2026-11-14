// The courts' pages (cases.html, file.html, case.html): `node --test test/cases.test.mjs`.
// The filing is the contract editor's (CommandAGI packages/applets/contract/src/ui/files.ts `caseRequest` over
// CaseForm.tsx's draft); the expected bodies below are written out by hand from that function, not computed by ours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The page modules read `<meta name="vibegov-api">` and localStorage when they load; a page's start needs its root
// element, which this stand-in never has, so only the pure functions run.
globalThis.document ??= { querySelector: () => null, getElementById: () => null };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const F = await import('../file.js');
const C = await import('../case.js');
const L = await import('../cases.js');
const { serve } = await import('./serve.mjs');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-13T09:00:00Z');
const SHA = 'a'.repeat(64);
const PHOTO = { type: 'ref', ref: `r2:contract/evidence/${SHA}`, mime: 'image/png', modality: 'image', sha256: SHA, label: 'receipt.png' };
const LIMITS = { penaltyMultiplePermille: 3000, exclusionMaxMs: 365 * DAY };

// ─── the filing ──────────────────────────────────────────────────────────────

test('a civil filing on a duty in law is the body the editor sends for the same form', () => {
  const draft = {
    ...F.blankCaseDraft('2026-11-02'),
    respondent: '  bob ',
    dutyId: 'breach',
    article: 'k6',
    agreementId: 'ignored',
    term: 'ignored',
    act: ' Did not deliver the chairs.\n',
    harms: [
      { id: 'paid', interest: 'agreement', description: ' the price ', amount: '120.50' },
      { id: 'time', interest: 'property', description: 'a day lost', amount: '$40' },
    ],
    relief: [
      { kind: 'restitution', description: ' refund ', harmIds: ['paid'], amount: '120.50', days: '' },
      { kind: 'compensation', description: 'the day', harmIds: ['time'], amount: '40', days: '' },
      { kind: 'correction', description: 'say so', harmIds: ['paid', 'time'], amount: '', days: '' },
    ],
    evidence: ' receipt no. 7 ',
    media: [PHOTO],
  };
  assert.deepEqual(F.caseRequest(draft, NOW), {
    respondent: 'bob',
    criminal: false,
    duty: { source: 'law', dutyId: 'breach' },
    act: { description: 'Did not deliver the chairs.', at: Date.parse('2026-11-02T12:00:00Z') },
    harms: [
      { id: 'paid', interest: 'agreement', description: 'the price', amountCents: 12050 },
      { id: 'time', interest: 'property', description: 'a day lost', amountCents: 4000 },
    ],
    relief: [
      { kind: 'restitution', harmIds: ['paid'], description: 'refund', amountCents: 12050 },
      { kind: 'compensation', harmIds: ['time'], description: 'the day', amountCents: 4000 },
      { kind: 'correction', harmIds: ['paid', 'time'], description: 'say so' },
    ],
    evidence: [{ type: 'text', text: 'receipt no. 7' }, PHOTO],
  });
  assert.deepEqual(F.problemsOf(draft, LIMITS), []);
  assert.equal(F.canFile(draft, LIMITS), true);
});

test('a criminal filing for another, reopening a case, with a penalty and an exclusion, dated today, is the editor’s body', () => {
  const draft = {
    ...F.blankCaseDraft('2030-01-01'),
    respondent: 'dave',
    filedFor: ' carl ',
    criminal: true,
    source: 'law',
    dutyId: 'theft',
    act: 'Took the bicycle.',
    harms: [{ id: 'bike', interest: 'property', description: 'a bicycle', amount: '300' }],
    relief: [
      { kind: 'restitution', description: 'return it', harmIds: ['bike'], amount: '300', days: '' },
      { kind: 'penalty', description: 'twice the harm', harmIds: ['bike'], amount: '600.00', days: '' },
      { kind: 'exclusion', description: 'a month away', harmIds: ['bike'], amount: '', days: '30' },
    ],
    reopens: F.edit(F.blankCaseDraft(), 'reopens', '  case-1  ').reopens,
  };
  assert.deepEqual(F.caseRequest(draft, NOW), {
    respondent: 'dave',
    filedFor: 'carl',
    criminal: true,
    duty: { source: 'law', dutyId: 'theft' },
    // An act dated after now is dated now: the contract refuses an act that has not happened yet.
    act: { description: 'Took the bicycle.', at: NOW },
    harms: [{ id: 'bike', interest: 'property', description: 'a bicycle', amountCents: 30000 }],
    relief: [
      { kind: 'restitution', harmIds: ['bike'], description: 'return it', amountCents: 30000 },
      { kind: 'penalty', harmIds: ['bike'], description: 'twice the harm', amountCents: 60000 },
      { kind: 'exclusion', harmIds: ['bike'], description: 'a month away', durationMs: 30 * DAY },
    ],
    evidence: [],
    reopens: 'case-1',
  });
});

test('the duty names its source as the editor does: a kernel article, or an agreement and its term', () => {
  const base = { ...F.blankCaseDraft('2026-11-01'), respondent: 'bob', act: 'x', dutyId: 'breach', article: 'k8', agreementId: ' acme-7 ', term: ' delivery by Friday ' };
  assert.deepEqual(F.caseRequest({ ...base, source: 'kernel' }, NOW).duty, { source: 'kernel', article: 'k8' });
  assert.deepEqual(F.caseRequest({ ...base, source: 'agreement' }, NOW).duty, { source: 'agreement', agreementId: 'acme-7', term: 'delivery by Friday' });
});

test('the form’s edits are the editor’s: a harm id is lowercase, a renamed harm stays cited, a money remedy keeps one harm', () => {
  let d = F.act(F.blankCaseDraft(), 'add-harm');
  assert.deepEqual(d.harms.map(h => h.id), ['harm-1', 'harm-2']);
  d = F.edit(d, 'harms.0.id', 'Paid In Full!');
  assert.equal(d.harms[0].id, 'paidinfull');
  assert.deepEqual(d.relief[0].harmIds, ['paidinfull'], 'the remedy follows the rename');
  d = F.edit(d, 'relief.0.harm', 'harm-2', true);
  assert.deepEqual(d.relief[0].harmIds, ['harm-2'], 'restitution answers exactly one harm item');
  d = F.edit(d, 'relief.0.kind', 'correction');
  d = F.edit(d, 'relief.0.harm', 'paidinfull', true);
  assert.deepEqual(d.relief[0].harmIds, ['harm-2', 'paidinfull']);
  d = F.edit(d, 'relief.0.kind', 'compensation');
  assert.deepEqual(d.relief[0].harmIds, ['harm-2'], 'a money remedy keeps the first');
  d = F.act(d, 'remove-harm', 1);
  assert.deepEqual(d.relief[0].harmIds, [], 'a removed harm leaves the remedies');
  assert.equal(F.edit(d, 'relief.0.days', '3o d').relief[0].days, '3');
  assert.equal(F.edit(d, 'criminal', 'criminal').criminal, true);
});

// ─── k8 before the API ───────────────────────────────────────────────────────

const valid = () => ({
  ...F.blankCaseDraft('2026-11-01'),
  respondent: 'bob',
  dutyId: 'breach',
  act: 'Did not deliver.',
  harms: [{ id: 'paid', interest: 'agreement', description: 'the price', amount: '120' }],
  relief: [{ kind: 'restitution', description: 'refund', harmIds: ['paid'], amount: '120', days: '' }],
});

test('what the kernel forbids (k8) is refused by the form, and the API is never asked', async () => {
  const cases = [
    ['a penalty on a civil claim', d => ({ ...d, relief: [...d.relief, { kind: 'penalty', description: 'p', harmIds: ['paid'], amount: '10', days: '' }] }), 'problemCriminalOnly'],
    ['restitution and compensation above the harm', d => ({ ...d, relief: [...d.relief, { kind: 'compensation', description: 'c', harmIds: ['paid'], amount: '1', days: '' }] }), 'problemExceedsHarm'],
    ['a penalty above three times the harm', d => ({ ...d, criminal: true, relief: [...d.relief, { kind: 'penalty', description: 'p', harmIds: ['paid'], amount: '360.01', days: '' }] }), 'problemPenaltyCap'],
    ['an exclusion above the longest the law allows', d => ({ ...d, criminal: true, relief: [...d.relief, { kind: 'exclusion', description: 'e', harmIds: ['paid'], amount: '', days: '366' }] }), 'problemExclusionCap'],
    ['two penalties', d => ({ ...d, criminal: true, relief: [...d.relief, ...[1, 2].map(() => ({ kind: 'penalty', description: 'p', harmIds: ['paid'], amount: '1', days: '' }))] }), 'problemOnePenalty'],
    ['a money remedy answering two harms', d => ({ ...d, harms: [...d.harms, { id: 'more', interest: 'property', description: 'm', amount: '1' }], relief: [{ kind: 'restitution', description: 'r', harmIds: ['paid', 'more'], amount: '1', days: '' }] }), 'problemOneHarm'],
    ['a remedy for a harm not in the filing', d => ({ ...d, relief: [{ kind: 'correction', description: 'c', harmIds: ['ghost'], amount: '', days: '' }] }), 'problemNoHarmForRemedy'],
    ['two harm items with one id', d => ({ ...d, harms: [d.harms[0], d.harms[0]] }), 'problemHarmId'],
    ['an amount that is not money', d => ({ ...d, harms: [{ ...d.harms[0], amount: '12,5' }] }), 'problemAmount'],
  ];
  for (const [name, change, problem] of cases) {
    const d = change(valid());
    let asked = 0;
    const r = await F.submitFiling(d, { limits: LIMITS, now: NOW, file: async () => { asked++; return { ok: true, id: 'x' }; } });
    assert.equal(r.ok, false, name);
    assert.ok(r.problems.includes(problem), `${name}: ${r.problems.join(', ')}`);
    assert.equal(asked, 0, `${name}: the API was asked`);
    const html = F.formHtml(d, { duties: [], articles: [], interests: ['agreement', 'property'], limits: LIMITS, params: {}, refusals: [], mediaRefusals: [] });
    assert.match(html, /<button class="btn primary" data-ref="k6" type="submit" id="file-submit" disabled>/, `${name}: the button is off`);
    assert.match(html, /class="problems"/, `${name}: the problem is said`);
  }
  let sent = null;
  const ok = await F.submitFiling(valid(), { limits: LIMITS, now: NOW, file: async body => { sent = body; return { ok: true, id: 'c1' }; } });
  assert.deepEqual(ok, { ok: true, id: 'c1' });
  assert.deepEqual(sent, F.caseRequest(valid(), NOW), 'a filing the kernel allows goes as the editor sends it');
  assert.equal((await F.submitFiling({ ...valid(), respondent: ' ' }, { limits: LIMITS, file: () => assert.fail('asked') })).ok, false, 'no respondent, no filing');
});

test('the filing says what it costs and binds before its button, from the law’s parameters', () => {
  const html = F.formHtml(valid(), { duties: [], articles: [], interests: ['agreement'], limits: LIMITS, params: { caseDepositCents: 500, caseResponseMs: 14 * DAY, caseEvidenceMs: 7 * DAY, appealMs: 14 * DAY, openCasesPerClaimant: 5 }, refusals: [], mediaRefusals: [] });
  const before = html.slice(0, html.indexOf('id="file-submit"'));
  assert.match(before, /cost deposit of \$5\.00/);
  assert.match(before, /never a bar to filing/);
  assert.match(before, /14 days to answer, and that time starts only when the notice reaches them/);
  assert.match(before, /at most 5 open cases/);
});

// ─── the acts of each role at each stage ─────────────────────────────────────

test('each stage shows only the acts of that role at that stage (CaseActions.tsx)', () => {
  const row = (role, stage, more = {}) => C.actsFor({ role, stage, appealable: false, appealed: false, pendingInterim: false, canRaiseStakes: true, ...more });
  const expect = [
    [['claimant', 'screening'], { record: 'evidence', figures: false, freeze: 'form', stakes: true, appeal: null }],
    [['respondent', 'screening'], { record: 'closed', figures: false, freeze: null, stakes: true, appeal: null }],
    [['respondent', 'serving'], { record: 'closed', figures: false, freeze: null, stakes: true, appeal: null }],
    [['respondent', 'awaiting_response'], { record: 'answer', figures: true, freeze: null, stakes: true, appeal: null }],
    [['claimant', 'awaiting_response'], { record: 'evidence', figures: false, freeze: 'form', stakes: true, appeal: null }],
    [['respondent', 'evidence'], { record: 'evidence', figures: true, freeze: null, stakes: true, appeal: null }],
    [['claimant', 'ready', { pendingInterim: true }], { record: 'closed', figures: false, freeze: 'pending', stakes: true, appeal: null }],
    [['respondent', 'decided', { appealable: true, canRaiseStakes: false }], { record: 'closed', figures: false, freeze: null, stakes: false, appeal: 'form' }],
    [['claimant', 'appealed', { appealed: true }], { record: 'closed', figures: false, freeze: 'form', stakes: true, appeal: 'pending' }],
    [['claimant', 'final', { canRaiseStakes: false }], { record: 'closed', figures: false, freeze: null, stakes: false, appeal: null }],
    [['claimant', 'unprocessable'], { record: 'closed', figures: false, freeze: null, stakes: false, appeal: null }],
  ];
  for (const [[role, stage, more], acts] of expect) assert.deepEqual(row(role, stage, more), acts, `${role} at ${stage}`);
});

const filing = {
  claimant: 'alice',
  respondent: 'bob',
  criminal: false,
  duty: { source: 'law', dutyId: 'breach' },
  act: { description: 'Did not deliver the chairs.', at: NOW - 10 * DAY },
  harms: [{ id: 'paid', interest: 'agreement', description: 'the price', amountCents: 12_000 }],
  relief: [{ kind: 'restitution', harmIds: ['paid'], description: 'refund', amountCents: 12_000 }],
  evidence: [],
};
const aCase = (more = {}) => ({
  id: 'c'.repeat(64), panelSeed: 'p', filing, filedAt: NOW - 5 * DAY, family: 'c'.repeat(64), contractVersion: 1, engineHash: 'e', expedited: false, stakesFloorCents: 0, bondExposureCents: 0,
  duty: { title: 'Keep an agreed term', text: 'Perform it.', elements: [{ id: 'term', text: 'accepted' }, { id: 'breach', text: 'not performed' }] },
  stage: 'awaiting_response', servedAt: NOW - 4 * DAY, responseDue: NOW + 10 * DAY, evidenceDue: NOW + 24 * DAY, submissions: [{ party: 'claimant', parts: [{ type: 'text', text: 'receipt' }], at: NOW - 5 * DAY }],
  instances: [], appealableUntil: null, appealedBy: null, costCents: 0, deposits: { claimant: 500, respondent: 0 }, closedReason: null, ...more,
});
const viewOf = (role, c) => ({ case: c, role, pendingInterim: null, agreementId: null, execution: null, determinations: [], renderings: {} });
const ui = () => ({ evidence: '', media: [], figures: {}, freeze: '', floor: '', pending: false, uploading: false, done: null, refusals: [], mediaRefusals: [] });
const actsIn = html => [...html.matchAll(/data-act="(\w+)"/g)].map(m => m[1]);
const LAW = { stakesRaiseDepositBps: 100, caseDepositCents: 500, interimFreezeMs: 30 * DAY };

test('a case page renders only the acts of its reader’s role at its stage', () => {
  assert.deepEqual(actsIn(C.actionsHtml(viewOf('respondent', aCase()), LAW, ui(), NOW)), ['evidence', 'stakes']);
  assert.match(C.actionsHtml(viewOf('respondent', aCase()), LAW, ui(), NOW), /Your answer/, 'the respondent answers');
  assert.match(C.actionsHtml(viewOf('respondent', aCase()), LAW, ui(), NOW), /data-figure="paid"/, 'with a figure per harm item');
  assert.deepEqual(actsIn(C.actionsHtml(viewOf('claimant', aCase()), LAW, ui(), NOW)), ['evidence', 'freeze', 'stakes']);
  assert.doesNotMatch(C.actionsHtml(viewOf('claimant', aCase()), LAW, ui(), NOW), /data-figure=/, 'only the respondent counters');
  const decided = aCase({ stage: 'decided', instances: [{ n: 1, startedAt: NOW - DAY, startTier: 2, panels: {}, routing: null, findings: {}, blockedSince: null, judgment: { outcome: 'liable', elements: { term: true }, awards: {}, remedies: [], reason: 'r', at: NOW - DAY } }], appealableUntil: NOW + 13 * DAY });
  const appeal = C.actionsHtml(viewOf('respondent', decided), LAW, ui(), NOW);
  assert.deepEqual(actsIn(appeal), ['appeal']);
  assert.match(appeal, /took no part in this case/);
  assert.match(appeal, /Its judgment is final/);
  const after = C.actionsHtml(viewOf('claimant', { ...decided, stage: 'appealed', appealedBy: 'respondent' }), LAW, ui(), NOW);
  assert.deepEqual(actsIn(after), ['freeze', 'stakes']);
  assert.match(after, /Appealed by the respondent/);
  assert.deepEqual(actsIn(C.actionsHtml(viewOf('claimant', { ...decided, stage: 'final', appealableUntil: null }), LAW, ui(), NOW)), []);
});

test('the freeze is bounded by k8 and the stakes deposit is the law’s share of the raise, both said before their buttons', () => {
  const html = C.actionsHtml(viewOf('claimant', aCase()), LAW, { ...ui(), floor: '1120' }, NOW);
  assert.match(html, /At most the money you claim: \$120\.00/);
  assert.match(html, /at most 14 days/, 'the law’s 30 days are cut to the kernel’s 14');
  assert.match(html, /takes a deposit of \$10\.00/, 'ceil((112000 − 12000) × 100 / 10000) cents');
  assert.equal(C.stakesWords(12_000, '100', 100), 'The floor must be higher than what is at stake now, $120.00.');
  assert.equal(C.counterOf({ other: ' ' }), undefined, 'no figure, no counter');
  assert.deepEqual(C.counterOf({ paid: '80.5', other: ' ' }), { paid: 8050 });
});

// ─── a party's words are text ────────────────────────────────────────────────

test('a party’s words with markup stay text on every surface', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const c = aCase({
    filing: { ...filing, respondent: '<b>bob</b>', act: { ...filing.act, description: evil }, harms: [{ ...filing.harms[0], description: '<script>alert(2)</script>' }], relief: [{ ...filing.relief[0], description: '<a href=javascript:x>r</a>' }] },
    submissions: [{ party: 'respondent', parts: [{ type: 'text', text: '</p><script>alert(3)</script>' }, { ...PHOTO, label: '<svg onload=alert(4)>' }], at: NOW }],
  });
  const view = { ...viewOf('claimant', c), renderings: { [SHA]: { sha256: SHA, modality: 'image', ok: true, at: NOW, by: [{ seat: '<i>seat</i>', text: '<iframe>' }] } } };
  const pages = [
    C.partyHtml(view, LAW, { ...ui(), evidence: '</textarea><script>x</script>' }, NOW),
    C.publicHtml({ id: '<x>', claimant: '<u>a</u>', respondent: evil, criminal: false, dutyTitle: evil, harms: [{ id: '<h>', interest: 'property', amountCents: 1 }], stage: 'final', filedAt: NOW, servedAt: null, closedReason: evil, judgments: [{ instance: 1, outcome: 'liable', elements: { '<e>': true }, awards: {}, remedies: [], reason: evil, at: NOW }] }, NOW),
    L.renderMyCases([{ id: '<id>', claimant: '<i>alice</i>', respondent: evil, criminal: false, stage: '<stage>', filedAt: NOW }], new Map(), 'bob', NOW),
    F.formHtml({ ...valid(), respondent: '"><script>alert(5)</script>', act: '</textarea><script>alert(6)</script>', harms: [{ id: 'paid', interest: 'agreement', description: '"><img src=x>', amount: '1' }] }, { duties: [{ id: 'breach', title: evil, protects: ['agreement'], elements: [{ id: 'x', text: evil }] }], articles: [], interests: ['agreement'], limits: LIMITS, params: {}, refusals: [{ code: '<c>', detail: evil }], mediaRefusals: [] }),
  ];
  for (const html of pages) {
    const tag = /<(script|img|svg|iframe|u|x|h|e|stage|id|c)[\s>]|<b>bob|<i>(alice|seat)/i;
    assert.doesNotMatch(html, tag, html.match(new RegExp(`${tag.source}[^]{0,60}`, 'i'))?.[0]);
    assert.doesNotMatch(html, /<a href=javascript/i);
  }
  assert.match(pages[0], /&lt;img src=x onerror=alert\(1\)&gt;/, 'shown as the words it is');
});

// ─── the public projection ───────────────────────────────────────────────────

test('the counts by stage say a zero in words and never name anyone', () => {
  assert.equal(L.renderStageCounts({ byStage: {}, judgments: 0 }), '<p class="empty">No case has been filed yet.</p>');
  const html = L.renderStageCounts({ byStage: { final: 2, awaiting_response: 1 }, judgments: 2 });
  assert.match(html, /3 cases in all; 2 with a judgment/);
  assert.ok(html.indexOf('awaiting the answer') < html.indexOf('final'), 'in the order a case passes them');
});

test('a person’s own cases show their role and the clock that runs for them', () => {
  const rows = [{ id: 'c1', claimant: 'alice', respondent: 'bob', criminal: false, stage: 'awaiting_response', filedAt: NOW - DAY }];
  const html = L.renderMyCases(rows, new Map([['c1', { id: 'c1', role: 'respondent', stage: 'awaiting_response', act: 'answer', due: NOW + 2 * DAY }]]), 'bob', NOW);
  assert.match(html, /href="case\.html\?id=c1"/);
  assert.match(html, /alice against you/);
  assert.match(html, /answer by .*in 2 days/);
  assert.match(html, /state state--yours">respondent</);
  assert.match(L.renderMyCases([], new Map(), 'bob', NOW), /You are not a party to any case/);
});

// ─── the pages' frames ───────────────────────────────────────────────────────

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.commandagi.com; media-src 'self' blob: https://api.commandagi.com; connect-src 'self' https://api.commandagi.com; object-src 'none'; base-uri 'self'; form-action 'none'";

for (const [page, title] of [['cases', 'Cases'], ['file', 'File a case'], ['case', 'A case']]) {
  test(`${page}.html has the signed-in pages' frame`, async () => {
    const html = await readFile(`${ROOT}/${page}.html`, 'utf8');
    assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`), 'the CSP of APP.md');
    assert.ok(html.includes('<meta name="vibegov-api" content="https://api.commandagi.com">'));
    assert.ok(html.includes(`<title>${title} · VibeGov</title>`));
    assert.ok(html.includes(`<link rel="canonical" href="https://vibegov.pro/${page}.html">`));
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
    assert.ok(scripts.every(a => /\bsrc="/.test(a)), 'no inline script');
    assert.deepEqual(scripts.filter(a => /type="module"/.test(a)).map(a => /src="([^"]+)"/.exec(a)[1]), ['shell.js', `${page}.js`], 'one module of its own');
    assert.doesNotMatch(html, /\son[a-z]+=/i, 'no inline handler');
    assert.ok(html.includes('<li><a href="cases.html" aria-current="page">Cases</a></li>'), 'the contents line marks Cases');
    assert.ok(html.includes('<link rel="stylesheet" href="cases.css">'));
    assert.ok(html.includes('<span class="runhead__act" data-account></span>'));
    assert.ok(html.includes('<div class="desk"'));
  });
}

test('the three pages and their modules are served, and the fake answers the routes they call', async () => {
  const s = await serve({ fake: `${ROOT}/test/fake-cases.mjs` });
  try {
    for (const p of ['cases.html', 'file.html', 'case.html', 'cases.js', 'file.js', 'case.js', 'cases.css']) assert.equal((await fetch(`${s.origin}/${p}`)).status, 200, p);
    const page = await (await fetch(`${s.origin}/file.html`)).text();
    assert.ok(page.includes(`<meta name="vibegov-api" content="${s.origin}">`), 'the API is this origin');
    const call = (path, method = 'GET', body, who = 'alice') => fetch(`${s.origin}${path}`, { method, headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, json: await r.json() }));
    const filed = await call('/contract/cases', 'POST', F.caseRequest(valid(), Date.now()));
    assert.equal(filed.status, 201, JSON.stringify(filed.json));
    const id = filed.json.case.id;
    assert.equal((await call(`/contract/cases/${id}/submissions`, 'POST', { parts: [{ type: 'text', text: 'no' }] }, 'bob')).json.error, 'not_served');
    await call(`/fake/serve/${id}`, 'POST');
    assert.equal((await call(`/contract/cases/${id}/submissions`, 'POST', { parts: [], counter: { paid: 8000 } }, 'bob')).status, 201);
    assert.equal((await call(`/contract/cases/${id}`, 'GET', undefined, 'bob')).json.case.stage, 'evidence', 'the answer moves the case to evidence');
    assert.ok((await call(`/contract/cases/${id}`, 'GET', undefined, 'carol')).json.public, 'a non-party reads the public projection');
    assert.equal((await call(`/contract/cases/${id}/appeal`, 'POST', {})).json.error, 'not_decided');
    await call(`/fake/decide/${id}`, 'POST');
    assert.equal((await call(`/contract/cases/${id}/appeal`, 'POST', {})).status, 202);
    assert.equal((await call(`/contract/cases/${id}/appeal`, 'POST', {}, 'bob')).json.error, 'already_appealed');
  } finally {
    await s.close();
  }
});
