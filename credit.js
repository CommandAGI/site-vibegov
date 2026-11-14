// The credit desk (redesign/APP.md): a port of the contract editor's Credit.tsx (CommandAGI
// packages/applets/contract/src/ui/Credit.tsx). Anyone reads the open mandates and the public figures; a signed-in
// person offers capital, draws, repays, and sells or buys a claim. Each act says what it commits before its button.
// Money is integer cents all the way (`money` only prints it); a rate is basis points, as the API holds it.
import { API, api, esc, signedIn } from './session.js';
import {
  acceptOffer, closeMandate, createMandate, drawFacility, listMandates, loadFacility, loadMe, loadMyCredit,
  loadOverview, offerTransfer, repayFacility, withdrawOffer,
} from './contract-api.js';
import { blankMandateForm, centsOf, days, hasWords, mandateRequest, refusalKey, words } from './contract-words.js';
import { count, money } from './live.js';

const t = words('credit');
const r = words('refusals');
const SIGN_IN = 'signin.html?next=credit.html';
const signInLink = what => `<a class="btn small" href="${SIGN_IN}">Sign in to ${esc(what)}</a>`;

/** Whole basis points as a percent, without a float: 725 → "7.25", 1200 → "12", 710 → "7.1". */
export function rateText(bps) {
  const n = Math.max(0, Math.trunc(Number(bps) || 0));
  const whole = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}
/** A date, in UTC (the pages say so once). */
export const day = ms => (ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const shortId = id => String(id ?? '').slice(0, 12);
const tierName = tier => t(`insurance.${tier === 'insured-1' ? 'insured-1' : 'uninsured'}`);
const stateName = s => (hasWords('credit', `state.${s}`) ? t(`state.${s}`) : String(s ?? ''));
const stateClass = s => (s === 'defaulted' ? 'bad' : s === 'repaid' ? 'done' : 'open');

/** A refusal in the catalog's words, then the route's own detail and code. */
export function renderRefusals(refusals) {
  if (!refusals?.length) return '';
  const items = refusals.map(x => {
    const key = refusalKey(x.code) ?? (hasWords('refusals', x.code) ? x.code : null);
    const said = key ? r(key) : r('unknown', { code: x.code });
    return `<li>${esc(said)}${x.detail ? ` <small>${esc(x.detail)}</small>` : ''} <small class="code">${esc(x.code)}</small></li>`;
  });
  return `<div class="refusal" role="alert"><ul>${items.join('')}</ul></div>`;
}
const doneHtml = key => `<p class="done">${esc(t(`done.${key}`))}</p>`;

// ---------- what the law says about credit (read from the public law, never assumed) ----------

const lawOf = overview => overview?.law?.parameters ?? null;

export function renderFigures(stats) {
  if (!stats) return `<p class="note">The public figures could not be read. They come from the contract's API.</p>`;
  const c = stats.credit ?? {};
  const p = stats.pool ?? {};
  const states = Object.entries(c.facilitiesByState ?? {}).filter(([, n]) => n > 0).map(([s, n]) => `${count(n)} ${esc(stateName(s))}`);
  const facilities = Object.values(c.facilitiesByState ?? {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return `<dl class="kv">
    <dt>Open mandates</dt><dd>${count(c.openMandates)}</dd>
    <dt>Capital offered</dt><dd>${money(c.openCapitalCents)} not yet drawn</dd>
    <dt>Facilities</dt><dd>${count(facilities)}${states.length ? ` (${states.join(', ')})` : ''}</dd>
    <dt>The pool</dt><dd>${money(p.balanceCents)}</dd>
    <dt>Pool claims</dt><dd>${p.openClaims ? `${count(p.openClaims)} open, ${money(p.owedCents)} owed` : 'None open.'}</dd>
  </dl>
  <p class="note">The pool is funded by the issuance premium of insured-1 facilities and by penalty shares. It pays only what it holds.</p>`;
}

export function renderTiers(law) {
  const premium = law && Number.isFinite(law.poolPremiumBps) ? `The borrower pays an issuance premium of ${rateText(law.poolPremiumBps)}% of the principal to the pool, out of the drawdown.` : 'The borrower pays an issuance premium to the pool, out of the drawdown.';
  const cap = law && Number.isFinite(law.poolClaimCapCents) ? ` Coverage is capped at ${money(law.poolClaimCapCents)} per claim.` : ' Coverage is capped.';
  const servicing = law && Number.isFinite(law.creditServicingBps) ? ` The contract keeps ${rateText(law.creditServicingBps)}% of each payment for the commons.` : '';
  const grace = law && Number.isFinite(law.creditGraceMs) ? ` An installment still unpaid ${esc(String(days(law.creditGraceMs)))} days after its due date is a default.` : '';
  return `<dl class="kv">
    <dt>${esc(tierName('uninsured'))}</dt><dd>The default. No premium is paid and the bond has no claim on the pool. If the borrower defaults, each holder files a case for their share, and what cannot be collected stays owed.</dd>
    <dt>${esc(tierName('insured-1'))}</dt><dd>${esc(premium)} It covers only a loss that independent attestors verify as an economic loss between unrelated parties. The cover is capped, shared pro rata with other claims, and paid only as the pool has funds.${esc(cap)} Unpaid amounts stay owed.</dd>
    <dt>Servicing</dt><dd>On each due date the contract collects what is due from the borrower's balance and pays the holders pro rata.${esc(servicing)}${grace}</dd>
  </dl>
  <p class="notice">This page states terms. It is not investment advice, and nothing here promises a return. A borrower may default. A holder may lose some or all of what a facility is owed to them.</p>`;
}

// ---------- the open mandates ----------

const mandateTerms = m => `${t('mandateLine', { available: money(m.availableCents), rate: rateText(m.rateBps), days: days(m.termMs), n: m.installments })}`;

/** What drawing `principalText` on mandate `m` binds, said before the button. `law` may be null. */
export function drawStatement(m, principalText, law) {
  const cents = centsOf(principalText ?? '');
  if (!cents) return `<p class="hint">Give an amount to see what it binds.</p>`;
  const parts = [`You borrow ${money(cents)} at ${rateText(m.rateBps)}% a year, simple interest on what is outstanding, in ${m.installments} equal-principal installments over ${days(m.termMs)} days.`];
  if (m.insurance === 'insured-1' && law && Number.isFinite(law.poolPremiumBps)) {
    const premium = Math.ceil((cents * law.poolPremiumBps) / 10_000);
    parts.push(`The issuance premium is ${money(premium)}, paid to the pool out of the drawdown, so you receive ${money(cents - premium)}.`);
  } else if (m.insurance === 'insured-1') parts.push('The issuance premium is paid to the pool out of the drawdown.');
  else parts.push('This bond is uninsured: no premium is paid.');
  parts.push('The schedule is fixed when you draw, and the contract shows it to you.');
  return `<p>${esc(parts.join(' '))}</p>`;
}
const drawBinds = law => `Drawing is accepting this mandate's terms. That agreement is what a default is judged under. Each installment is collected from your balance on its due date${law && Number.isFinite(law.creditGraceMs) ? `; one unpaid ${days(law.creditGraceMs)} days after its due date is a default, and each holder then files a case against you for their share` : '; one unpaid after the grace period is a default, and each holder then files a case against you for their share'}.`;

export function renderMandates(mandates, ctx) {
  if (!mandates.length) return `<p class="empty">${esc(t('noMandates'))}</p>`;
  const li = mandates.map(m => {
    const yours = !!ctx.me && m.investor === ctx.me;
    const drawing = ctx.drawing === m.id;
    let act;
    if (!ctx.signedIn) act = signInLink('borrow');
    else if (yours) act = `<button class="btn small" type="button" data-act="close-mandate" data-id="${esc(m.id)}">${esc(t('closeMandate'))}</button>`;
    else if (!drawing) act = `<button class="btn small" type="button" data-act="open-draw" data-id="${esc(m.id)}">${esc(t('draw'))}</button>`;
    else act = '';
    const closeNote = yours ? `<p class="hint">This is your mandate. Closing it returns ${money(m.availableCents)}, the capital not drawn, to your balance and takes no new facility. What was drawn stays a bond you hold.</p>` : '';
    const form = drawing ? `<div class="more"><div class="form" data-form="draw">
        <div class="field"><label for="draw-amount">${esc(t('principal'))}</label><input id="draw-amount" data-input="draw.amount" inputmode="decimal" autocomplete="off" value="${esc(ctx.draw.amount)}"><p class="hint">Between ${money(m.minFacilityCents)} and ${money(m.maxFacilityCents)}; this mandate has ${money(m.availableCents)} left.</p></div>
        <div class="field"><label for="draw-purpose">${esc(t('purpose'))}</label><input id="draw-purpose" data-input="draw.purpose" maxlength="5000" autocomplete="off" value="${esc(ctx.draw.purpose)}"></div>
        <p>${esc(drawBinds(ctx.law))}</p>
        <div data-preview="draw">${drawStatement(m, ctx.draw.amount, ctx.law)}</div>
        <div class="form__act"><button class="btn primary" type="button" data-act="draw" data-id="${esc(m.id)}">${esc(t('drawConfirm'))}</button><button class="btn small" type="button" data-act="cancel-draw">Cancel</button></div>
        <div data-slot="draw-problem" role="alert"></div>
      </div></div>` : '';
    return `<li>
      <span title="${esc(m.id)}">${esc(m.id.slice(0, 8))}</span>
      <div><b>${esc(tierName(m.insurance))}</b> · ${esc(mandateTerms(m))}<small>${esc(t('mandateBounds', { min: money(m.minFacilityCents), max: money(m.maxFacilityCents), until: day(m.openUntil) }))} · ${esc(t(`borrowers.${m.borrowers === 'anyone' ? 'anyone' : 'persons'}`))}</small></div>
      <span class="state state--${yours ? 'yours' : 'open'}">${yours ? 'yours' : 'open'}</span>
      <div class="more">${act}${closeNote}</div>${form}
    </li>`;
  });
  return `<ul class="rows rows--credit">${li.join('')}</ul><p class="note">Dates are UTC. A rate is a simple annual rate on the outstanding principal.</p>`;
}

// ---------- offer capital ----------

/** The request the form sends, or the problems with it (the editor's `mandateRequest`). */
export const buildMandate = (form, now) => mandateRequest(form, now);

export function mandateStatement(form, now, law) {
  const built = buildMandate(form, now);
  if ('problems' in built) return `<p class="hint">${built.problems.map(k => esc(t(k))).join(' ')}</p>`;
  const q = built.request;
  const servicing = law && Number.isFinite(law.creditServicingBps) ? ` The contract keeps ${rateText(law.creditServicingBps)}% of each payment for the commons.` : '';
  return `<p>${esc(`You escrow ${money(q.capitalCents)} from your balance now, as a ${tierName(q.insurance).toLowerCase()} mandate: facilities of ${money(q.minFacilityCents)} to ${money(q.maxFacilityCents)} at ${rateText(q.rateBps)}% a year, ${days(q.termMs)} days, ${q.installments} installments, for ${t(`borrowers.${q.borrowers}`)}, open until ${day(q.openUntil)}. A borrower who draws becomes accountable to you through a bond you hold, and the contract pays you each installment pro rata.${servicing} Capital not drawn comes back when you close the mandate. Drawn capital comes back only as the borrower repays. Nothing promises repayment or a return.`)}</p>`;
}

export function renderOfferForm(form, ctx) {
  if (!ctx.signedIn) return `<p>Your capital would be escrowed on your terms. You must be signed in to do that.</p><p>${signInLink('offer capital')}</p>`;
  const field = (id, key, label, mode = 'decimal') => `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" data-input="form.${key}" inputmode="${mode}" autocomplete="off" value="${esc(form[key])}"></div>`;
  const radios = (name, key, options) => options.map(([value, label]) => `<label class="choice"><input type="radio" name="${name}" data-input="form.${key}" value="${value}"${form[key] === value ? ' checked' : ''}> ${esc(label)}</label>`).join('');
  return `<p>${esc(t('newMandateNote'))}</p>
  <div class="form" data-form="mandate">
    <fieldset class="field"><legend>Bond tier</legend>${radios('insurance', 'insurance', [['uninsured', tierName('uninsured')], ['insured-1', tierName('insured-1')]])}<p class="hint">${esc(t('insuranceNote'))}</p></fieldset>
    ${field('m-capital', 'capital', t('capital'))}
    <div class="two">${field('m-min', 'min', t('min'))}${field('m-max', 'max', t('max'))}</div>
    <div class="three">${field('m-rate', 'ratePercent', t('rate'))}${field('m-term', 'termDays', t('term'), 'numeric')}${field('m-n', 'installments', t('installments'), 'numeric')}</div>
    ${field('m-open', 'openDays', t('openDays'), 'numeric')}
    <fieldset class="field"><legend>Who may borrow</legend>${radios('borrowers', 'borrowers', [['persons', t('borrowers.persons')], ['anyone', t('borrowers.anyone')]])}</fieldset>
    <div data-preview="mandate" class="binds">${mandateStatement(form, ctx.now, ctx.law)}</div>
    <div class="form__act"><button class="btn primary" type="button" data-act="create-mandate">${esc(t('createMandate'))}</button></div>
    <div data-slot="mandate-problem" role="alert"></div>
  </div>`;
}

// ---------- a facility ----------

const sum = (rows, key) => rows.reduce((a, row) => a + (Number(row[key]) || 0), 0);
const owedOn = i => i.principalCents + i.interestCents - i.paidCents;
const rowState = (i, now) => (owedOn(i) <= 0 ? 'paid' : i.due <= now ? 'due now' : 'upcoming');

/** The schedule as the API gives it. A total is an integer sum of the rows; nothing is recomputed from the rate. */
export function renderSchedule(schedule, now) {
  const rows = schedule.map(i => `<tr><td>${count(i.n)}</td><td>${day(i.due)}</td><td class="num">${money(i.principalCents)}</td><td class="num">${money(i.interestCents)}</td><td class="num">${money(i.paidCents)}</td><td class="num">${money(Math.max(0, owedOn(i)))}</td><td>${rowState(i, now)}</td></tr>`).join('');
  const owed = schedule.reduce((a, i) => a + Math.max(0, owedOn(i)), 0);
  return `<div class="table-wrap sched"><table><thead><tr><th>No.</th><th>${esc(t('colDue'))} (UTC)</th><th class="num">${esc(t('colPrincipal'))}</th><th class="num">${esc(t('colInterest'))}</th><th class="num">${esc(t('colPaid'))}</th><th class="num">owed</th><th>state</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><th scope="row" colspan="2">Total</th><td class="num">${money(sum(schedule, 'principalCents'))}</td><td class="num">${money(sum(schedule, 'interestCents'))}</td><td class="num">${money(sum(schedule, 'paidCents'))}</td><td class="num">${money(owed)}</td><td></td></tr></tfoot></table></div>`;
}
/** What is due now and when the next installment falls, from the schedule as given. */
export function dueSummary(schedule, now) {
  const dueNow = schedule.filter(i => i.due <= now).reduce((a, i) => a + Math.max(0, owedOn(i)), 0);
  const next = schedule.find(i => i.due > now && owedOn(i) > 0);
  const outstanding = schedule.reduce((a, i) => a + Math.max(0, owedOn(i)), 0);
  return { dueNow, outstanding, next: next ?? null };
}

export function renderFacility(view, ctx) {
  if (!view) return `<p class="note">${esc(t('loading'))}</p>`;
  const f = 'facility' in view ? view.facility : null;
  const pub = 'public' in view ? view.public : null;
  const x = f ?? pub;
  if (!x) return `<p class="note">That facility could not be read.</p>`;
  const due = dueSummary(x.schedule, ctx.now);
  const head = `<p><span class="state state--${stateClass(x.state)}">${esc(stateName(x.state))}</span> ${esc(tierName(x.insurance))}</p>
    <dl class="kv">
      <dt>Facility</dt><dd><code>${esc(x.id)}</code></dd>
      <dt>Terms</dt><dd>${esc(t('terms', { principal: money(x.principalCents), rate: rateText(x.rateBps), drawn: day(x.drawnAt) }))}</dd>
      ${f ? `<dt>Issuance</dt><dd>${esc(t('issuance', { premium: money(f.premiumCents), disbursed: money(f.disbursedCents) }))}</dd>` : ''}
      <dt>Outstanding</dt><dd>${money(due.outstanding)}</dd>
      <dt>Due now</dt><dd>${money(due.dueNow)}</dd>
      <dt>Next due</dt><dd>${due.next ? `${day(due.next.due)}, installment ${count(due.next.n)}: ${money(Math.max(0, owedOn(due.next)))}` : 'Nothing is due later.'}</dd>
    </dl>`;
  const table = renderSchedule(x.schedule, ctx.now);
  if (!f) return `${head}${table}<p class="note">You are not a party to this facility, so its holders and payments are not shown to you.</p>`;
  const holders = Object.entries(f.holders ?? {}).map(([h, u]) => `<li>${esc(h)}${h === ctx.me ? ' (you)' : ''}: ${count(u)} units (${money(u)} face)</li>`).join('');
  const cases = Object.keys(f.defaultCases ?? {}).length ? `<p class="refusal">${esc(t('defaultCases', { cases: Object.values(f.defaultCases).map(shortId).join(', ') }))}</p>` : '';
  const isBorrower = !!ctx.me && f.borrower === ctx.me;
  const repay = isBorrower && f.state === 'active' ? `<h3>Repay</h3>
    <div class="form" data-form="repay">
      <p>Paying takes the amount from your balance and applies it to the schedule above, each installment's interest before its principal, up to what is outstanding (${money(due.outstanding)}). The holders are paid pro rata after the servicing fee. A payment cannot be taken back.</p>
      <div class="field"><label for="repay-amount">${esc(t('repayAmount'))}</label><input id="repay-amount" data-input="repay" inputmode="decimal" autocomplete="off" value="${esc(ctx.repay)}"></div>
      <div data-preview="repay">${repayStatement(ctx.repay)}</div>
      <div class="form__act"><button class="btn primary" type="button" data-act="repay" data-id="${esc(f.id)}">${esc(t('repay'))}</button></div>
      <div data-slot="repay-problem" role="alert"></div></div>` : '';
  const held = ctx.me ? (f.holders?.[ctx.me] ?? 0) : 0;
  const sell = held > 0 && f.state === 'active' ? `<h3>${esc(t('sellTitle'))}</h3>
    <div class="form" data-form="offer">
      <p>You hold ${count(held)} units; one unit is one cent of principal. An offer moves nothing. If the buyer accepts, the units go to them and the price comes from their balance to yours in one step, and from then on they receive that share of each payment and bear its loss. You may withdraw an offer until it is accepted. A price of $0.00 gives the units away.</p>
      <div class="field"><label for="offer-to">${esc(t('buyer'))}</label><input id="offer-to" data-input="offer.to" autocomplete="off" value="${esc(ctx.offer.to)}"></div>
      <div class="two"><div class="field"><label for="offer-units">${esc(t('units'))}</label><input id="offer-units" data-input="offer.units" inputmode="numeric" autocomplete="off" value="${esc(ctx.offer.units)}"></div>
      <div class="field"><label for="offer-price">${esc(t('price'))}</label><input id="offer-price" data-input="offer.price" inputmode="decimal" autocomplete="off" value="${esc(ctx.offer.price)}"></div></div>
      <div data-preview="offer">${offerStatement(ctx.offer)}</div>
      <div class="form__act"><button class="btn primary" type="button" data-act="offer" data-id="${esc(f.id)}">${esc(t('offer'))}</button></div>
      <div data-slot="offer-problem" role="alert"></div></div>` : '';
  const mine = (view.offers ?? []).filter(o => o.fromHolder === ctx.me).map(o => `<li>${esc(t('myOffer', { to: o.toHolder, units: o.units, price: money(o.priceCents) }))} <button class="btn small" type="button" data-act="withdraw" data-id="${esc(o.id)}">${esc(t('withdraw'))}</button></li>`).join('');
  return `${head}${table}<h3>Holders</h3><ul class="plain">${holders}</ul>${cases}${repay}${sell}${mine ? `<h3>Your open offers</h3><ul class="plain">${mine}</ul>` : ''}`;
}
const repayStatement = text => { const c = centsOf(text ?? ''); return c ? `<p>${esc(`You pay ${money(c)} now.`)}</p>` : `<p class="hint">Give an amount in dollars, such as 250.00.</p>`; };
const offerStatement = o => {
  const units = /^\d+$/.test(o.units ?? '') ? Number(o.units) : 0;
  const price = centsOf(o.price || '0');
  if (!units || price === null) return `<p class="hint">Give the units as a whole number and the price in dollars.</p>`;
  return `<p>${esc(`You offer ${count(units)} units (${money(units)} face) to ${o.to.trim() || 'the buyer'} for ${money(price)}.`)}</p>`;
};

// ---------- what is yours ----------

export function renderMine(mine, ctx) {
  if (!ctx.signedIn) return `<p>Your loans and the claims you hold are shown here. You must be signed in to see them.</p><p>${signInLink('see your facilities')}</p>`;
  if (!mine) return `<p class="note">Your facilities could not be read. Try again in a moment.</p>`;
  const rows = [];
  for (const id of mine.borrowed ?? []) rows.push(`<li><span title="${esc(id)}">${esc(shortId(id))}</span><div>${esc(t('borrowedLine', { id: shortId(id) }))}</div><span class="state state--yours">borrower</span><div class="more"><button class="btn small" type="button" data-act="open-facility" data-id="${esc(id)}">Open</button></div></li>`);
  for (const h of mine.held ?? []) rows.push(`<li><span title="${esc(h.facilityId)}">${esc(shortId(h.facilityId))}</span><div>${esc(t('heldLine', { id: shortId(h.facilityId), units: count(h.units), value: money(h.units) }))}</div><span class="state state--yours">holder</span><div class="more"><button class="btn small" type="button" data-act="open-facility" data-id="${esc(h.facilityId)}">Open</button></div></li>`);
  const list = rows.length ? `<ul class="rows rows--credit">${rows.join('')}</ul>` : `<p class="empty">${esc(t('noFacilities'))}</p>`;
  const offers = (mine.offers ?? []).length ? `<h3>${esc(t('offersToYou'))}</h3><ul class="rows rows--credit">${mine.offers.map(o => `<li><span title="${esc(o.id)}">${esc(o.id.slice(0, 8))}</span><div>${esc(t('offerLine', { from: o.fromHolder, units: count(o.units), id: shortId(o.facilityId), price: money(o.priceCents) }))}<small>Buying takes ${money(o.priceCents)} from your balance, in one step with ${count(o.units)} units (${money(o.units)} face). You then hold that share of the facility and bear its loss if it defaults. Look at the facility's terms and tier first.</small></div><span class="state state--open">offer</span><div class="more"><button class="btn small" type="button" data-act="open-facility" data-id="${esc(o.facilityId)}">Look at the facility</button><button class="btn small" type="button" data-act="accept" data-id="${esc(o.id)}">${esc(t('accept'))} for ${money(o.priceCents)}</button></div></li>`).join('')}</ul>` : '';
  return `${list}${offers}`;
}

// ---------- the page ----------

const S = {
  now: () => Date.now(), me: null, mandates: [], stats: null, law: null, mine: null,
  open: null, view: null, drawing: null, draw: { amount: '', purpose: '' },
  form: blankMandateForm(), offer: { to: '', units: '', price: '' }, repay: '', busy: false, reached: true,
};
const slot = name => document.querySelector(`[data-slot="${name}"]`);
const put = (name, html) => { const el = slot(name); if (el) { el.innerHTML = html; el.removeAttribute('aria-busy'); } };
const ctx = () => ({ now: S.now(), signedIn: signedIn(), me: S.me, law: S.law, drawing: S.drawing, draw: S.draw, repay: S.repay, offer: S.offer });

function paint() {
  const c = ctx();
  put('figures', renderFigures(S.stats));
  put('tiers', renderTiers(S.law));
  put('mandates', S.reached ? renderMandates(S.mandates, c) : `<p class="note">The open mandates could not be read. The contract's API is at ${esc(API)}; check your connection and reload.</p>`);
  put('offer', renderOfferForm(S.form, c));
  put('mine', renderMine(S.mine, c));
  const section = slot('facility-section');
  if (section) section.hidden = !S.open;
  if (S.open) {
    const head = document.getElementById('facility-title');
    if (head) head.textContent = t('facilityTitle', { id: shortId(S.open) });
    put('facility', `<p><button class="btn small" type="button" data-act="close-facility">${esc(t('closeFacility'))}</button></p>${renderFacility(S.view, c)}`);
  }
}

async function loadPublic() {
  const [stats, mandates, overview] = await Promise.all([api('/public/contract/stats', { anonymous: true }).catch(() => null), listMandates(), loadOverview()]);
  S.stats = stats; S.mandates = mandates; S.law = lawOf(overview);
  S.reached = !!(stats || overview || mandates.length);
}
async function loadMine() {
  if (!signedIn()) { S.me = null; S.mine = null; return; }
  const [me, mine] = await Promise.all([loadMe(), loadMyCredit()]);
  S.me = me?.entity ?? null; S.mine = mine;
}
async function loadOpen() {
  S.view = S.open ? await loadFacility(S.open) : null;
}
async function reload() {
  await Promise.all([loadPublic(), loadMine(), loadOpen()]);
  paint();
}

/** Run one act: block a second click, say the refusal or the result in the section where it was asked. */
async function act(where, run, doneKey, after) {
  if (S.busy) return;
  S.busy = true;
  for (const el of document.querySelectorAll('button[data-act]')) el.disabled = true;
  put(`${where}-result`, `<p class="note">Sending…</p>`);
  let result;
  try { result = await run(); } finally { S.busy = false; }
  if (result.ok) {
    after?.(result);
    await reload();
    put(`${where}-result`, doneHtml(doneKey));
  } else {
    await reload();
    put(`${where}-result`, renderRefusals(result.refusals));
  }
  return result;
}
const problem = (name, text) => { const el = slot(name); if (el) el.innerHTML = text ? `<p class="refusal">${esc(text)}</p>` : ''; };
const FIX_AMOUNT = 'Give the amount in dollars, such as 250.00.';

/** Create the mandate the form describes, as the editor does. */
export async function createFromForm(form, now) {
  const built = buildMandate(form, now);
  if ('problems' in built) return { ok: false, problems: built.problems };
  return createMandate(built.request);
}

const handlers = {
  'create-mandate': async () => {
    const built = buildMandate(S.form, S.now());
    if ('problems' in built) return problem('mandate-problem', built.problems.map(k => t(k)).join(' '));
    problem('mandate-problem', '');
    await act('offer', () => createMandate(built.request), 'mandateCreated', () => { S.form = blankMandateForm(); });
  },
  'close-mandate': el => act('mandates', () => closeMandate(el.dataset.id), 'mandateClosed'),
  'open-draw': el => { S.drawing = el.dataset.id; S.draw = { amount: '', purpose: '' }; paint(); document.getElementById('draw-amount')?.focus(); },
  'cancel-draw': () => { S.drawing = null; paint(); },
  draw: async el => {
    const cents = centsOf(S.draw.amount);
    if (!cents) return problem('draw-problem', FIX_AMOUNT);
    if (!S.draw.purpose.trim()) return problem('draw-problem', 'Say what it is for.');
    problem('draw-problem', '');
    const res = await act('mandates', () => drawFacility(el.dataset.id, cents, S.draw.purpose.trim()), 'drawn', result => { S.drawing = null; S.open = result.id || null; });
    if (res?.ok && S.open) { const s = slot('facility-section'); s?.focus(); s?.scrollIntoView(); }
  },
  'open-facility': async el => { S.open = el.dataset.id; S.view = null; S.repay = ''; paint(); await loadOpen(); paint(); const s = slot('facility-section'); s?.focus(); s?.scrollIntoView(); },
  'close-facility': () => { S.open = null; S.view = null; paint(); },
  repay: async el => {
    const cents = centsOf(S.repay);
    if (!cents) return problem('repay-problem', FIX_AMOUNT);
    await act('facility', () => repayFacility(el.dataset.id, cents), 'repaid', () => { S.repay = ''; });
  },
  offer: async el => {
    const units = /^\d+$/.test(S.offer.units) ? Number(S.offer.units) : 0;
    const price = centsOf(S.offer.price || '0');
    if (!S.offer.to.trim() || !units || price === null) return problem('offer-problem', 'Give the buyer, the units as a whole number, and the price in dollars.');
    await act('facility', () => offerTransfer(el.dataset.id, S.offer.to.trim(), units, price), 'offered', () => { S.offer = { to: '', units: '', price: '' }; });
  },
  accept: el => act('mine', () => acceptOffer(el.dataset.id), 'offerAccepted'),
  withdraw: el => act('facility', () => withdrawOffer(el.dataset.id), 'withdrawn'),
};

/** A typed value goes to the state; only the sentence that says what it binds is redrawn, so a field keeps its focus. */
function typed(el) {
  const [group, key] = el.dataset.input.split('.');
  const value = el.value;
  if (group === 'form') {
    S.form = { ...S.form, [key]: value };
    const p = document.querySelector('[data-preview="mandate"]');
    if (p) p.innerHTML = mandateStatement(S.form, S.now(), S.law);
  } else if (group === 'draw') {
    S.draw = { ...S.draw, [key]: value };
    const m = S.mandates.find(x => x.id === S.drawing);
    const p = document.querySelector('[data-preview="draw"]');
    if (p && m) p.innerHTML = drawStatement(m, S.draw.amount, S.law);
  } else if (group === 'offer') {
    S.offer = { ...S.offer, [key]: value };
    const p = document.querySelector('[data-preview="offer"]');
    if (p) p.innerHTML = offerStatement(S.offer);
  } else if (group === 'repay') {
    S.repay = value;
    const p = document.querySelector('[data-preview="repay"]');
    if (p) p.innerHTML = repayStatement(S.repay);
  }
}

export async function boot() {
  const root = document.getElementById('credit');
  if (!root) return;
  root.addEventListener('click', e => {
    const el = e.target.closest?.('button[data-act]');
    if (el && !el.disabled) handlers[el.dataset.act]?.(el);
  });
  root.addEventListener('input', e => { if (e.target.dataset?.input) typed(e.target); });
  root.addEventListener('change', e => { if (e.target.dataset?.input && e.target.type === 'radio') typed(e.target); });
  document.addEventListener('session', () => { S.open = null; S.view = null; S.drawing = null; reload(); });
  await reload();
}
if (typeof document !== 'undefined' && document.getElementById?.('credit')) boot();
