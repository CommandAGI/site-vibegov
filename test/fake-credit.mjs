// A fake of the contract API's credit doors, for `node test/serve.mjs --fake test/fake-credit.mjs` and for the
// credit test. The shapes are the routes' (api-worker routes/contract.ts, data/contract-credit.ts). Any bearer token
// is the person `person:ada`; `person:grace` is the other account. State is in memory: `reset()` clears it.
const DAY = 86_400_000;
const YEAR = 365 * DAY;
export const ME = 'person:ada';
export const OTHER = 'person:grace';
const LAW = { poolPremiumBps: 50, creditServicingBps: 25, creditGraceMs: 7 * DAY, poolClaimCapCents: 500_000 };

/** The route's own schedule: equal principal, remainder in the last, interest on the outstanding, floored. */
export function schedule(principal, rateBps, termMs, n, start) {
  const period = Math.floor(termMs / n);
  const base = Math.floor(principal / n);
  let out = principal;
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const p = i === n ? out : base;
    rows.push({ n: i, due: start + period * i, principalCents: p, interestCents: Math.floor((out * rateBps * period) / (10_000 * YEAR)), paidCents: 0 });
    out -= p;
  }
  return rows;
}

let state;
export function reset() {
  const now = Date.now();
  state = {
    balance: { [ME]: 5_000_000, [OTHER]: 5_000_000 }, seq: 0, sent: [],
    mandates: [
      { id: 'a1b2c3d4e5f60718293a', insurance: 'uninsured', investor: OTHER, capitalCents: 1_000_000, minFacilityCents: 10_000, maxFacilityCents: 500_000, rateBps: 725, termMs: 360 * DAY, installments: 12, borrowers: 'persons', openUntil: now + 30 * DAY, createdAt: now - DAY, availableCents: 1_000_000, closed: false },
      { id: 'b9c8d7e6f5a40312ffee', insurance: 'insured-1', investor: OTHER, capitalCents: 250_000, minFacilityCents: 5_000, maxFacilityCents: 100_000, rateBps: 1200, termMs: 180 * DAY, installments: 6, borrowers: 'anyone', openUntil: now + 14 * DAY, createdAt: now - 2 * DAY, availableCents: 250_000, closed: false },
    ],
    facilities: {}, offers: [],
  };
  seedOfferToMe();
}
reset();
export const sent = () => state.sent;

const outstanding = f => f.schedule.reduce((a, i) => a + i.principalCents + i.interestCents - i.paidCents, 0);
const fail = (status, error) => ({ status, body: { error } });

export default function answer({ method, path, body }) {
  if (method !== 'GET') state.sent.push({ method, path, body });
  const ok = b => ({ body: b });
  if (path === '/me') return ok({ id: 'u-ada', name: 'Ada Lovelace' });
  if (path === '/contract/me') return ok({ entity: ME, voice: 'v', cases: [], credit: null });
  if (path === '/public/contract') return ok({ law: { parameters: LAW } });
  if (path === '/public/contract/stats') {
    const fs = Object.values(state.facilities);
    const byState = {};
    for (const f of fs) byState[f.state] = (byState[f.state] ?? 0) + 1;
    return ok({ credit: { openMandates: state.mandates.filter(m => !m.closed).length, openCapitalCents: state.mandates.filter(m => !m.closed).reduce((a, m) => a + m.availableCents, 0), facilitiesByState: byState }, pool: { balanceCents: 12_345, openClaims: 0, owedCents: 0 } });
  }
  if (path === '/public/contract/mandates') return ok({ mandates: state.mandates.filter(m => !m.closed) });
  if (method === 'POST' && path === '/contract/mandates') {
    if (!body || !Number.isInteger(body.capitalCents)) return fail(400, 'malformed: capitalCents');
    if (body.capitalCents > state.balance[ME]) return fail(402, 'insufficient_balance');
    const m = { ...body, investor: ME, id: `m${++state.seq}`.padEnd(20, '0'), createdAt: Date.now(), availableCents: body.capitalCents, closed: false };
    state.balance[ME] -= body.capitalCents;
    state.mandates.unshift(m);
    return { status: 201, body: { mandate: m } };
  }
  let g;
  if (method === 'POST' && (g = path.match(/^\/contract\/mandates\/([^/]+)\/close$/))) {
    const m = state.mandates.find(x => x.id === g[1]);
    if (!m) return fail(404, 'not_found');
    if (m.investor !== ME) return fail(403, 'not_the_investor');
    state.balance[ME] += m.availableCents; const returnedCents = m.availableCents; m.availableCents = 0; m.closed = true;
    return ok({ ok: true, returnedCents });
  }
  if (method === 'POST' && path === '/contract/facilities') {
    const m = state.mandates.find(x => x.id === body?.mandateId);
    if (!m) return fail(404, 'mandate_not_found');
    const refused = [];
    if (m.investor === ME) refused.push('self_dealing');
    if (body.principalCents < m.minFacilityCents || body.principalCents > m.maxFacilityCents) refused.push('outside_mandate_size');
    if (body.principalCents > m.availableCents) refused.push('mandate_exhausted');
    if (refused.length) return fail(422, refused.join(', '));
    const premium = m.insurance === 'insured-1' ? Math.ceil((body.principalCents * LAW.poolPremiumBps) / 10_000) : 0;
    const now = Date.now();
    const f = { id: `f${++state.seq}`.padEnd(24, 'e'), mandateId: m.id, borrower: ME, principalCents: body.principalCents, insurance: m.insurance, insuranceCapCents: 0, rateBps: m.rateBps, schedule: schedule(body.principalCents, m.rateBps, m.termMs, m.installments, now), premiumCents: premium, disbursedCents: body.principalCents - premium, holders: { [m.investor]: body.principalCents }, state: 'active', drawnAt: now, defaultCases: {} };
    m.availableCents -= body.principalCents; state.balance[ME] += f.disbursedCents; state.facilities[f.id] = f;
    return { status: 201, body: { facility: f } };
  }
  if (method === 'GET' && path === '/contract/facilities') {
    const all = Object.values(state.facilities);
    return ok({
      borrowed: all.filter(f => f.borrower === ME).map(f => f.id),
      held: all.filter(f => (f.holders[ME] ?? 0) > 0).map(f => ({ facilityId: f.id, units: f.holders[ME] })),
      offers: state.offers.filter(o => o.toHolder === ME && o.state === 'open'),
    });
  }
  if (method === 'GET' && (g = path.match(/^\/contract\/facilities\/([^/]+)$/))) {
    const f = state.facilities[g[1]];
    if (!f) return fail(404, 'not_found');
    const party = f.borrower === ME || (f.holders[ME] ?? 0) > 0;
    if (!party) return ok({ public: { insurance: f.insurance, insuranceCapCents: f.insuranceCapCents, id: f.id, mandateId: f.mandateId, principalCents: f.principalCents, rateBps: f.rateBps, state: f.state, drawnAt: f.drawnAt, outstandingCents: outstanding(f), schedule: f.schedule } });
    return ok({ facility: f, offers: state.offers.filter(o => o.facilityId === f.id && o.state === 'open') });
  }
  if (method === 'POST' && (g = path.match(/^\/contract\/facilities\/([^/]+)\/repay$/))) {
    const f = state.facilities[g[1]];
    if (!f) return fail(404, 'not_found');
    if (f.state !== 'active') return fail(409, 'not_active');
    let left = Math.min(body.amountCents, outstanding(f));
    if (left > state.balance[ME]) return fail(402, 'insufficient_balance');
    state.balance[ME] -= left;
    for (const i of f.schedule) {
      const room = i.principalCents + i.interestCents - i.paidCents;
      const pay = Math.min(room, left); i.paidCents += pay; left -= pay;
    }
    if (outstanding(f) === 0) f.state = 'repaid';
    return ok({ ok: true });
  }
  if (method === 'POST' && (g = path.match(/^\/contract\/facilities\/([^/]+)\/offers$/))) {
    const f = state.facilities[g[1]];
    if (!f) return fail(404, 'not_found');
    if (body.to === ME) return fail(409, 'same_holder');
    if ((f.holders[ME] ?? 0) < body.units) return fail(409, 'insufficient_units');
    const o = { id: `o${++state.seq}`.padEnd(12, '0'), facilityId: f.id, fromHolder: ME, toHolder: body.to, units: body.units, priceCents: body.priceCents, state: 'open', createdAt: Date.now() };
    state.offers.push(o);
    return { status: 201, body: { offer: { id: o.id } } };
  }
  if (method === 'POST' && (g = path.match(/^\/contract\/offers\/([^/]+)\/(accept|withdraw)$/))) {
    const o = state.offers.find(x => x.id === g[1] && x.state === 'open');
    if (!o) return fail(404, 'not_found');
    if (g[2] === 'withdraw') { if (o.fromHolder !== ME) return fail(404, 'not_found'); o.state = 'withdrawn'; return ok({ ok: true }); }
    if (o.toHolder !== ME) return fail(403, 'not_the_buyer');
    const f = state.facilities[o.facilityId];
    state.balance[ME] -= o.priceCents; f.holders[o.fromHolder] -= o.units; f.holders[ME] = (f.holders[ME] ?? 0) + o.units; o.state = 'accepted';
    return ok({ ok: true });
  }
  return undefined;
}

/** An older facility that the other account holds and offers ten thousand units of to the signed-in person. */
function seedOfferToMe() {
  const units = 10_000;
  const g = state.facilities['fgrace'.padEnd(24, 'e')] = { id: 'fgrace'.padEnd(24, 'e'), mandateId: 'x', borrower: 'person:linus', principalCents: 200_000, insurance: 'uninsured', insuranceCapCents: 0, rateBps: 900, schedule: schedule(200_000, 900, 120 * DAY, 4, Date.now() - 40 * DAY), premiumCents: 0, disbursedCents: 200_000, holders: { [OTHER]: 200_000 }, state: 'active', drawnAt: Date.now() - 40 * DAY, defaultCases: {} };
  state.offers.push({ id: 'offer-1'.padEnd(12, '0'), facilityId: g.id, fromHolder: OTHER, toHolder: ME, units, priceCents: 9_500, state: 'open', createdAt: Date.now() });
}
