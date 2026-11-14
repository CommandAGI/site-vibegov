// The credit desk: its pure renderers against the shapes the routes answer (api-worker routes/contract.ts,
// data/contract-credit.ts), the mandate request against the editor's, and the page against the fake API.
// Run: node --test test/credit.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import fake, { ME, OTHER, reset, schedule, sent } from './fake-credit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'credit.html'), 'utf8');

// The session module reads `document` and `localStorage` when it loads: stand them in, pointed at the fake.
const server = await serve({ fake });
const store = new Map([['vibegov.session', JSON.stringify({ access: 't', refresh: null, expiresAt: Date.now() + 36e5, userId: 'u-ada', name: 'Ada' })]]);
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document = { querySelector: s => (s.includes('vibegov-api') ? { content: server.origin } : null), getElementById: () => null, dispatchEvent() {}, addEventListener() {} };
const C = await import('../credit.js');
const { money } = await import('../live.js');
const { mandateRequest, blankMandateForm } = await import('../contract-words.js');
test.after(() => server.close());

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 13, 12);
const FORM = { insurance: 'insured-1', capital: '10000', min: '100', max: '5000.50', ratePercent: '7.25', termDays: '360', installments: '12', borrowers: 'persons', openDays: '30' };
const mandate = (over = {}) => ({ id: 'a1b2c3d4e5f60718293a', insurance: 'uninsured', investor: OTHER, capitalCents: 1_000_000, minFacilityCents: 10_000, maxFacilityCents: 500_000, rateBps: 725, termMs: 360 * DAY, installments: 12, borrowers: 'persons', openUntil: NOW + 30 * DAY, createdAt: NOW, availableCents: 1_000_000, closed: false, ...over });

test('the mandate request is what the editor sends for the same form (rate in basis points, term in ms)', () => {
  assert.deepEqual(C.buildMandate(FORM, NOW), {
    request: { insurance: 'insured-1', capitalCents: 1_000_000, minFacilityCents: 10_000, maxFacilityCents: 500_050, rateBps: 725, termMs: 360 * DAY, installments: 12, borrowers: 'persons', openUntil: NOW + 30 * DAY },
  });
  assert.deepEqual(C.buildMandate(FORM, NOW), mandateRequest(FORM, NOW));
  assert.equal(C.buildMandate({ ...FORM, ratePercent: '12' }, NOW).request.rateBps, 1200);
});

test('a form the editor refuses is refused here, with the editor\'s problems in order', () => {
  assert.deepEqual(C.buildMandate(blankMandateForm(), NOW), { problems: ['problemCapital', 'problemBounds', 'problemRate'] });
  assert.deepEqual(C.buildMandate({ ...FORM, ratePercent: '7.255' }, NOW).problems, ['problemRate']);
  assert.deepEqual(C.buildMandate({ ...FORM, max: '20000' }, NOW).problems, ['problemBounds']);
  assert.deepEqual(C.buildMandate({ ...FORM, installments: '361' }, NOW).problems, ['problemInstallments']);
  assert.deepEqual(C.buildMandate({ ...FORM, termDays: '1.5' }, NOW).problems, ['problemTerm']);
});

test('a rate is shown from whole basis points with no float', () => {
  assert.deepEqual([725, 1200, 710, 5, 0, 100_000].map(C.rateText), ['7.25', '12', '7.1', '0.05', '0', '1000']);
});

test('the schedule is shown as the API gives it, and its totals are integer sums of the rows', () => {
  const rows = schedule(100_001, 725, 360 * DAY, 12, NOW);
  rows[0].paidCents = rows[0].principalCents + rows[0].interestCents;
  rows[1].paidCents = 123;
  const out = C.renderSchedule(rows, NOW + 65 * DAY);
  assert.equal(rows.reduce((a, i) => a + i.principalCents, 0), 100_001, 'the API\'s principal adds to the principal (the remainder is in the last row)');
  for (const i of rows) for (const k of ['principalCents', 'interestCents', 'paidCents']) assert.ok(out.includes(money(i[k])), `${k} of installment ${i.n}`);
  const totals = out.slice(out.indexOf('<tfoot>'));
  assert.ok(totals.includes(money(100_001)), 'total principal');
  assert.ok(totals.includes(money(rows.reduce((a, i) => a + i.interestCents, 0))), 'total interest');
  assert.ok(totals.includes(money(rows[0].principalCents + rows[0].interestCents + 123)), 'total paid');
  const owed = rows.reduce((a, i) => a + i.principalCents + i.interestCents - i.paidCents, 0);
  assert.ok(totals.includes(money(owed)), 'total owed = principal + interest - paid');
  assert.deepEqual(C.dueSummary(rows, NOW + 65 * DAY).outstanding, owed);
  assert.match(out, /paid<\/td>/);
  assert.match(out, /due now<\/td>/);
  assert.match(out, /upcoming<\/td>/);
});

test('the issuance premium before a draw is the contract\'s own rounding (ceil of principal × bps)', () => {
  const m = mandate({ insurance: 'insured-1' });
  const said = C.drawStatement(m, '1234.56', { poolPremiumBps: 50 });
  assert.ok(said.includes(money(618)), 'premium: ceil(123456 × 50 / 10000) = 618');
  assert.ok(said.includes(money(123_456 - 618)));
  assert.match(said, /7\.25% a year/);
  assert.match(C.drawStatement(mandate(), '10', null), /uninsured: no premium/);
  assert.match(C.drawStatement(m, 'abc', null), /Give an amount/);
});

test('a visitor sees the mandates and the terms, and no act: "Sign in to …" stands in each place', () => {
  const ctx = { signedIn: false, me: null, law: null, now: NOW, drawing: null, draw: { amount: '', purpose: '' }, repay: '', offer: { to: '', units: '', price: '' } };
  for (const out of [C.renderMandates([mandate(), mandate({ id: 'z', insurance: 'insured-1' })], ctx), C.renderOfferForm(blankMandateForm(), ctx), C.renderMine(null, ctx)]) {
    assert.ok(!/<button|<input|<form/.test(out), 'no act, no field');
    assert.match(out, /Sign in to /);
    assert.ok(out.includes('href="signin.html?next=credit.html"'));
  }
  const list = C.renderMandates([mandate()], ctx);
  assert.ok(list.includes(money(1_000_000)) && list.includes('7.25% a year') && list.includes('360 days') && list.includes('12 installments'));
  assert.ok(list.includes('persons only') && list.includes('Uninsured'));
  assert.match(C.renderMandates([], ctx), /No open mandates\./);
});

test('a signed-in person acts on another\'s mandate, and closes their own', () => {
  const ctx = { signedIn: true, me: ME, law: { creditGraceMs: 7 * DAY }, now: NOW, drawing: null, draw: { amount: '', purpose: '' } };
  const theirs = C.renderMandates([mandate()], ctx);
  assert.ok(theirs.includes('data-act="open-draw"') && !theirs.includes('close-mandate'));
  const mine = C.renderMandates([mandate({ investor: ME })], ctx);
  assert.ok(mine.includes('data-act="close-mandate"') && !mine.includes('open-draw'));
  assert.ok(mine.includes(`returns ${money(1_000_000)}`));
  const open = C.renderMandates([mandate()], { ...ctx, drawing: mandate().id, draw: { amount: '250', purpose: 'a press' } });
  assert.match(open, /accepting this mandate(?:'|&#39;)s terms/);
  assert.match(open, /a default is judged under/);
  assert.match(open, /7 days after its due date is a default/);
  assert.ok(open.includes('value="250"') && open.includes('value="a press"'));
});

test('text with markup stays text, in every renderer', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const view = { facility: { id: 'f1', borrower: ME, principalCents: 1000, rateBps: 725, schedule: schedule(1000, 725, 360 * DAY, 2, NOW), premiumCents: 0, disbursedCents: 1000, holders: { [evil]: 400, [ME]: 600 }, state: 'active', insurance: 'uninsured', drawnAt: NOW, defaultCases: { [evil]: evil } }, offers: [{ id: evil, fromHolder: ME, toHolder: evil, units: 5, priceCents: 5 }] };
  const ctx = { now: NOW, me: ME, repay: evil, offer: { to: evil, units: evil, price: evil } };
  const out = [
    C.renderFacility(view, ctx),
    C.renderMandates([mandate({ id: evil, investor: evil })], { signedIn: true, me: ME, law: null, now: NOW, drawing: evil, draw: { amount: evil, purpose: evil } }),
    C.renderMine({ borrowed: [evil], held: [{ facilityId: evil, units: 1 }], offers: [{ id: evil, facilityId: evil, fromHolder: evil, units: 1, priceCents: 1 }] }, { signedIn: true }),
    C.renderRefusals([{ code: evil, detail: evil }]),
    C.renderOfferForm({ ...blankMandateForm(), capital: evil }, { signedIn: true, now: NOW, law: null }),
  ].join('\n');
  assert.ok(!out.includes('<img'), 'no element from a value');
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('a party sees holders, repays as the borrower, offers as a holder; a stranger sees the public summary', () => {
  const f = { id: 'f1', borrower: ME, principalCents: 100_000, rateBps: 725, schedule: schedule(100_000, 725, 360 * DAY, 12, NOW), premiumCents: 500, disbursedCents: 99_500, holders: { [OTHER]: 70_000, [ME]: 30_000 }, state: 'active', insurance: 'insured-1', drawnAt: NOW, defaultCases: {} };
  const base = { now: NOW + DAY, me: ME, repay: '', offer: { to: '', units: '', price: '' } };
  const party = C.renderFacility({ facility: f, offers: [{ id: 'o1', fromHolder: ME, toHolder: OTHER, units: 100, priceCents: 90 }] }, base);
  assert.ok(party.includes('data-act="repay"') && party.includes('data-act="offer"') && party.includes('data-act="withdraw"'));
  assert.ok(party.includes('(you)') && party.includes('Issuance premium $5.00 to the pool; $995.00 to the borrower'));
  const stranger = C.renderFacility({ public: { id: 'f1', insurance: 'uninsured', principalCents: 100_000, rateBps: 725, state: 'repaid', drawnAt: NOW, schedule: f.schedule, outstandingCents: 0 } }, { ...base, me: 'person:z' });
  assert.ok(!stranger.includes('data-act') && /not a party/.test(stranger));
  const lender = C.renderFacility({ facility: f, offers: [] }, { ...base, me: OTHER });
  assert.ok(lender.includes('data-act="offer"') && !lender.includes('data-act="repay"'));
});

test('the figures and tiers say the contract\'s terms honestly', () => {
  const figures = C.renderFigures({ credit: { openMandates: 2, openCapitalCents: 125_000, facilitiesByState: { active: 3, defaulted: 1 } }, pool: { balanceCents: 1234, openClaims: 2, owedCents: 500 } });
  assert.ok(figures.includes('$1,250.00') && figures.includes('3 active') && figures.includes('1 in default') && figures.includes('$12.34') && figures.includes('2 open, $5.00 owed'));
  assert.match(C.renderFigures(null), /could not be read/);
  const tiers = C.renderTiers({ poolPremiumBps: 50, poolClaimCapCents: 500_000, creditServicingBps: 25, creditGraceMs: 7 * DAY });
  assert.match(tiers, /No premium is paid and the bond has no claim on the pool/);
  assert.match(tiers, /independent attestors verify as an economic loss between unrelated parties/);
  assert.match(tiers, /capped, shared pro rata/);
  assert.ok(tiers.includes('0.5% of the principal') && tiers.includes('$5,000.00 per claim'));
  assert.match(tiers, /not investment advice/);
  assert.match(tiers, /nothing here promises a return/);
});

test('a refusal is said in the catalog\'s words, with its code; an unknown one is its code', () => {
  const out = C.renderRefusals([{ code: 'insufficient_balance' }, { code: 'excluded_by_judgment' }, { code: 'mandate_exhausted' }, { code: 'brand_new_code' }]);
  assert.match(out, /The balance is not enough\./);
  assert.match(out, /A final judgment excludes you/);
  assert.match(out, /The mandate has not that much left\./);
  assert.match(out, /Refused \(brand_new_code\)\./);
  assert.equal(C.renderRefusals([]), '');
});

test('the page frame: the APP.md CSP, one module of its own, no inline script or handler, this page marked', () => {
  assert.ok(html.includes(`content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.commandagi.com; media-src 'self' blob: https://api.commandagi.com; connect-src 'self' https://api.commandagi.com; object-src 'none'; base-uri 'self'; form-action 'none'"`));
  assert.ok(html.includes('<meta name="vibegov-api" content="https://api.commandagi.com">'));
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
  assert.ok(scripts.every(a => /src="/.test(a)), 'every script has a src');
  assert.equal(scripts.filter(a => a.includes('src="credit.js"')).length, 1);
  assert.ok(!/<script[^>]*>[^<]+<\/script>/.test(html));
  assert.ok(!/\son[a-z]+=/i.test(html), 'no inline handler');
  assert.ok(html.includes('<a href="credit.html" aria-current="page">Credit</a>'));
  assert.ok(html.includes('rel="stylesheet" href="credit.css"') && html.includes('<link rel="canonical" href="https://vibegov.pro/credit.html">'));
  assert.ok(html.includes('data-account') && html.includes('class="skip"') && html.includes('<main id="main" class="sheet">'));
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  const css = readFileSync(join(ROOT, 'credit.css'), 'utf8');
  assert.ok(!/animation|transition|@keyframes/.test(css), 'no motion');
});

test('against the fake API: the form\'s request reaches the door as built; a draw, a repayment and a sale follow', async () => {
  reset();
  const made = await C.createFromForm({ ...FORM, insurance: 'uninsured' }, NOW);
  assert.equal(made.ok, true);
  assert.deepEqual(sent().at(-1), { method: 'POST', path: '/contract/mandates', body: C.buildMandate({ ...FORM, insurance: 'uninsured' }, NOW).request });
  const refused = await C.createFromForm({ ...FORM, capital: '999999' }, NOW);
  assert.deepEqual(refused, { ok: false, refusals: [{ code: 'insufficient_balance' }] });
  assert.deepEqual((await C.createFromForm(blankMandateForm(), NOW)).problems.slice(0, 2), ['problemCapital', 'problemBounds']);

  const api = await import('../contract-api.js');
  const first = (await api.listMandates()).find(m => m.investor !== ME);
  const drawn = await api.drawFacility(first.id, 100_000, 'a press');
  assert.equal(drawn.ok, true);
  assert.deepEqual(sent().at(-1).body, { mandateId: first.id, principalCents: 100_000, purpose: 'a press' });
  const view = await api.loadFacility(drawn.id);
  assert.equal(view.facility.schedule.reduce((a, i) => a + i.principalCents, 0), 100_000);
  const page = C.renderFacility(view, { now: Date.now(), me: ME, repay: '', offer: { to: '', units: '', price: '' } });
  assert.ok(page.includes('data-act="repay"'));
  assert.equal((await api.repayFacility('nope', 100)).refusals[0].code, 'not_found');
  assert.equal((await api.repayFacility(drawn.id, 4_000)).ok, true);
  assert.equal((await api.loadFacility(drawn.id)).facility.schedule[0].paidCents, 4_000);
  const mine = await api.loadMyCredit();
  assert.ok(mine.borrowed.includes(drawn.id) && mine.offers.length === 1);
  assert.equal((await api.acceptOffer(mine.offers[0].id)).ok, true);
  assert.equal((await api.closeMandate(made.id)).ok, true);
});
