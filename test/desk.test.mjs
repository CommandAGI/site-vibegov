// The sign-in page and the desk (redesign/APP.md § testing): the pure render functions on the shapes CommandAGI's
// routes answer (routes/contract.ts `/contract/awaiting`, `/contract/me`, `/contract/notices`; routes/users.ts
// `/me/credits`, `/users/:id`; routes/stripe.ts `/me/billing/checkouts/:id`), the `next` rule, and the pages' frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { safeNext, formProblem, signinWords } from '../signin.js';
import { renderNeeds, renderVoice, renderNotices, renderBalance, renderAccount, checkoutOutcome, checkoutWords, subjectHref, needsCount, voiceKind } from '../desk.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = f => readFileSync(ROOT + f, 'utf8');
const NOW = Date.UTC(2026, 10, 13, 12);
const H = 3600_000, D = 24 * H;

// `GET /contract/awaiting` (data/contract-attention.ts `awaitingFor`)
const awaiting = {
  entity: 'u-ada', at: NOW, voice: 'human:7c1f0a9b', why: null,
  rfcs: [
    { id: 'rfc-1', title: 'Lower the deposit <b>now</b>', target: 'law', procedure: 'standard', options: 2, closesAt: NOW + 3 * D, unconfirmed: true, anonymous: false },
    { id: 'rfc-2', title: 'Seat a renderer', target: 'engine', procedure: 'standard', options: 1, closesAt: NOW + 9 * D, unconfirmed: false, anonymous: true },
  ],
  contests: [{ rfcId: 'rfc-3', title: 'Shorten the window', contestUntil: NOW + 2 * D, scores: { a: 1 } }],
  cases: [
    { id: 'c0ffee12-3456', duty: 'Deliver the parts', role: 'respondent', stage: 'awaiting_response', act: 'answer', due: NOW + 5 * D },
    { id: 'b16b00b5-aaaa', duty: 'Pay for work', role: 'claimant', stage: 'ready', act: 'wait', due: null },
  ],
  decisions: [
    { id: 'n-1', subject: 'rfc-9', kind: 'rfc.decided', body: 'RFC decided: adopted.', at: NOW - 6 * H },
    { id: 'n-2', subject: 'case-7', kind: 'case.judgment.final', body: 'Judgment entered.', at: NOW - 7 * H },
  ],
};

test('next: only a page of this site, named relatively; anything else goes to the desk', () => {
  for (const ok of ['rfc.html?id=rfc-1', 'case.html?id=a#record', 'desk.html', 'rfcs', 'propose.html']) assert.equal(safeNext(ok), ok, ok);
  for (const bad of [null, '', 'https://evil.example/', '//evil.example', '/\\evil.example', 'rfc.html\\x', 'javascript:alert(1)', '/desk.html', 'a/b.html', 'rfc.html?x=//evil', 'signin.html?next=desk.html', 'desk.html\n', '../index.html'])
    assert.equal(safeNext(bad), 'desk.html', String(bad));
});

test('the forms refuse what they can before sending, and say the doors\' refusals plainly', () => {
  assert.equal(formProblem('signin', { email: 'a@b.c', password: 'x' }), null);
  assert.match(formProblem('signin', { email: 'nope', password: 'x' }), /email/);
  assert.match(formProblem('signup', { email: 'a@b.c', password: 'longenough' }), /name/);
  assert.match(formProblem('signup', { name: 'A', email: 'a@b.c', password: 'short' }), /8 characters/);
  assert.equal(formProblem('reset', { email: 'a@b.c' }), null);
  assert.match(formProblem('newpw', { password: 'short' }), /8 characters/);
  assert.match(signinWords({ code: 'turnstile_failed' }), /challenges\.cloudflare\.com/);
  assert.match(signinWords({ code: 'invalid_token' }), /one hour/);
  assert.match(signinWords({ status: 0 }), /could not be reached/);
});

test('needs you: each list in the catalog\'s words, linked to its page, every title escaped', () => {
  assert.equal(needsCount(awaiting), 2 + 1 + 1 + 2);
  const html = renderNeeds(awaiting, NOW);
  assert.ok(html.includes('Lower the deposit &lt;b&gt;now&lt;/b&gt;') && !html.includes('<b>now'), 'a title is text');
  assert.match(html, /href="rfc\.html\?id=rfc-1"/);
  assert.match(html, /closes <time[^>]*>in 3 days<\/time>/);
  assert.match(html, /it counts only once you confirm its receipt/);
  assert.match(html, /You answer this one anonymously/);
  assert.match(html, /href="rfc\.html\?id=rfc-3"[^>]*>Shorten the window<\/a><small>contest until <time[^>]*title="in 2 days">15 Nov 2026, 12:00 UTC<\/time>/);
  assert.match(html, /href="case\.html\?id=c0ffee12-3456">Deliver the parts<\/a><small>answer by <time[^>]*>18 Nov 2026, 12:00 UTC<\/time>/);
  assert.match(html, /waiting: being decided/);
  assert.match(html, /state state--yours">respondent/);
  assert.match(html, /href="case\.html\?id=case-7"/, 'a judgment opens its case');
  assert.match(html, /data-seen="n-1"/);
  assert.match(html, /data-seen-all="n-1 n-2"/);
  assert.ok(!html.includes('You hold no voice'), 'a voice holder is not told to get one');

  const none = renderNeeds({ ...awaiting, voice: null, why: 'not_a_person', rfcs: [], contests: [], cases: [], decisions: [] }, NOW);
  assert.match(none, /Nothing needs you now\./);
  assert.match(none, /You hold no voice yet/);
  assert.ok(!none.includes('voice tab'), 'the desk has no tabs');
  assert.match(renderNeeds(null, NOW), /could not be read/);
});

test('your voice: held and of which kind; or why not, and the check that gives one', () => {
  assert.equal(voiceKind('human:abc'), 'human');
  assert.equal(voiceKind('anon:human:n'), 'human');
  const held = renderVoice({ entity: 'u', voice: 'human:7c1f', verification: 'verified', cases: [] });
  assert.match(held, /You have one voice: human\./);
  assert.match(held, /<code>human:7c1f<\/code>/);
  assert.ok(!held.includes('data-verify'));

  const fresh = renderVoice({ entity: 'u', voice: null, why: 'not_a_person', verification: 'none', cases: [] });
  assert.match(fresh, /You have no voice yet: You hold no personhood proof the law accepts\./);
  assert.match(fresh, /government ID and a live selfie, checked by Stripe Identity/);
  assert.match(fresh, /<button[^>]*data-verify>Verify your identity<\/button>/);
  assert.ok(fresh.indexOf('Stripe Identity') < fresh.indexOf('data-verify'), 'what the act does is said before its button');

  const pending = renderVoice({ entity: 'u', voice: null, why: 'not_a_person', verification: 'processing', cases: [] }, { returned: true });
  assert.match(pending, /You are back from Stripe\. Your verification is being checked/);
  assert.match(pending, /data-reload-voice/);
  assert.ok(!pending.includes('data-verify>'), 'no second check while one is in flight');

  const retry = renderVoice({ entity: 'u', voice: null, why: 'not_a_person', verification: 'requires_input', cases: [] }, { returned: true });
  assert.match(retry, /Stripe could not finish the check/);
  assert.match(retry, /Try the verification again/);
  assert.match(renderVoice({ entity: 'u', voice: null, why: 'not_a_person', verification: 'none', cases: [] }, { failed: 'origin_not_registered' }), /could not start: origin_not_registered/);

  const twin = renderVoice({ entity: 'u', voice: null, why: 'duplicate_voice', verification: 'verified', cases: [] });
  assert.match(twin, /already speaks through another account/);
  assert.match(twin, /href="file\.html"/);
  assert.ok(!twin.includes('data-verify'));
  assert.ok(!renderVoice({ entity: 'agent:1', voice: null, why: 'not_a_person', verification: null, cases: [] }).includes('data-verify'), 'an agent has no identity check');
  assert.match(renderVoice(null), /could not be read/);
});

test('notices: newest first as given, unread marked, each linked to its subject', () => {
  const list = [
    { id: 'n-1', recipient: 'u', subject: 'rfc-9', kind: 'rfc.decided', body: 'Decided <i>adopted</i>.', deliveredAt: NOW - H, readAt: null },
    { id: 'n-2', recipient: 'u', subject: 'c-1', kind: 'case.served', body: 'Served.', deliveredAt: NOW - D, readAt: NOW - H },
    { id: 'n-3', recipient: 'u', subject: 'f-1', kind: 'facility.drawn', body: 'Drawn.', deliveredAt: NOW - 2 * D, readAt: null },
  ];
  const html = renderNotices(list, NOW);
  assert.ok(html.includes('Decided &lt;i&gt;adopted&lt;/i&gt;.'));
  assert.match(html, /href="rfc\.html\?id=rfc-9">Open the proposal/);
  assert.match(html, /href="case\.html\?id=c-1">Open the case/);
  assert.match(html, /href="credit\.html">Open your credit/);
  assert.equal((html.match(/data-read=/g) ?? []).length, 2);
  assert.match(html, /state state--open">new/);
  assert.match(renderNotices([], NOW), /No notices\./);
  assert.match(renderNotices(null, NOW), /could not be read/);
  assert.equal(subjectHref('mystery', 'x'), null);
});

test('balance: credits as money, the deposits under the law, the packs and what a payment does, said before the buttons', () => {
  const law = { parameters: { rfcDepositCents: 1000, caseDepositCents: 500 } };
  const html = renderBalance(1234, law);
  assert.match(html, /<b>\$12\.34<\/b><span>1,234 credits<\/span>/);
  assert.match(html, /a proposal’s deposit is \$10\.00, and a case’s deposit is \$5\.00/);
  for (const [id, usd, credits] of [['pack-starter', '10.00', '1,000'], ['pack-plus', '50.00', '5,500'], ['pack-pro', '100.00', '12,000']])
    assert.match(html, new RegExp(`data-pack="${id}">Add \\$${usd.replace('.', '\\.')}<small>${credits} credits`));
  assert.ok(html.indexOf('Nothing renews') < html.indexOf('data-pack'));
  assert.match(renderBalance(0, null), /\$0\.00<\/b><span>0 credits/);
  assert.match(renderBalance(null, law), /could not be read/);
  assert.match(checkoutOutcome({ checkout: { id: 'a', status: 'paid' } }), /Paid/);
  assert.match(checkoutOutcome({ canceled: true }), /canceled/);
  assert.match(checkoutOutcome({ checkout: { status: 'open' } }), /not confirmed the payment yet/);
  assert.match(checkoutOutcome({ checkout: { status: 'failed', reason: 'card <x>' } }), /failed: card &lt;x&gt;/);
  assert.match(checkoutWords('origin_not_registered'), /vibegov\.pro/);
});

test('account: the name and email escaped, and signing out', () => {
  const html = renderAccount({ id: 'u', name: 'Ada <L>', email: 'ada@example.com' });
  assert.match(html, /Ada &lt;L&gt;/);
  assert.match(html, /ada@example\.com/);
  assert.match(html, /data-signout/);
  assert.match(html, /href="#anonymous"/);
});

// Found by test/journeys.py (journey 7): file.html asks for the respondent's account id, and no page showed a person theirs.
test('account: the account id is shown, to give to someone who files a case or makes an offer', () => {
  const html = renderAccount({ id: 'c76f5f6e-<x>', name: 'Ada', email: 'ada@example.com' });
  assert.match(html, /<dt>Account id<\/dt><dd><code>c76f5f6e-&lt;x&gt;<\/code><\/dd>/);
});

test('the pages\' frames: the CSP, one module each, no inline script, the contents line', () => {
  const CONTENTS = ['index.html', 'record.html', 'contract.html', 'rfcs.html', 'cases.html', 'credit.html'];
  for (const page of ['signin.html', 'desk.html']) {
    const text = read(page);
    const csp = text.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    for (const rule of ["default-src 'self'", "connect-src 'self' https://api.commandagi.com;", "object-src 'none'", "form-action 'none'"]) assert.ok(csp.includes(rule), `${page}: ${rule}`);
    const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.deepEqual(scripts.map(m => m[1].match(/src="([^"]+)"/)?.[1]), ['gov.js', 'scene.js', 'shell.js', page.replace('.html', '.js')], `${page}: scripts`);
    assert.ok(scripts.every(m => m[2].trim() === ''), `${page}: no inline script`);
    assert.ok(!/\son[a-z]+=/i.test(text), `${page}: no inline handler`);
    assert.deepEqual([...text.match(/<nav id="contents"[\s\S]*?<\/nav>/)[0].matchAll(/href="([^"]+)"/g)].map(m => m[1]), CONTENTS, `${page}: contents`);
    assert.match(text, /<span class="runhead__act" data-account><\/span>/);
    assert.match(text, /<meta name="vibegov-api" content="https:\/\/api\.commandagi\.com">/);
  }
  const signin = read('signin.html').match(/content="(default-src[^"]+)"/)[1];
  // Turnstile needs its script and its frame from challenges.cloudflare.com, and nothing else.
  assert.match(signin, /script-src 'self' https:\/\/challenges\.cloudflare\.com;/);
  assert.match(signin, /frame-src https:\/\/challenges\.cloudflare\.com;/);
  assert.equal((signin.match(/challenges\.cloudflare\.com/g) ?? []).length, 2);
  const desk = read('desk.html').match(/content="(default-src[^"]+)"/)[1];
  assert.ok(!desk.includes('cloudflare') && desk.includes("script-src 'self';"), 'the desk loads no third party');
  assert.match(read('signin.html'), /CommandAGI account[\s\S]*own token/, 'the page says whose account and whose token');
  assert.match(read('signin.html'), /accepts CommandAGI’s <a href="https:\/\/commandagi\.com\/terms"/);
});
