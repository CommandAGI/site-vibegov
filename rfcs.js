// rfcs.html: every proposal (the contract's RFC), open first. The render functions are pure (data in, escaped HTML
// out) so test/rfcs.test.mjs runs them with no browser; the page code at the bottom runs only in a page of this site.
// Reads: GET /public/contract/rfcs (rows: id, title, target, status, openedAt, closesAt, adopted), GET
// /public/contract/stats (parameters, for the law's windows) and, signed in, GET /contract/awaiting.
import { esc, count, money, date, relative, countdown, renderParameters } from './live.js';
import { words, hasWords, refusalKey } from './contract-words.js';

/** A time with its exact date for a reader who points at it. */
export const at = (ms, now) => `<time datetime="${esc(new Date(ms).toISOString())}" title="${esc(date(ms))}">${esc(relative(ms, now))}</time>`;

/** A refusal in the catalog's words; a code with no words is said as its code (what the editor's Refusals does). */
export function refusalText(r) {
  const key = refusalKey(r.code);
  return key && hasWords('refusals', key) ? words('refusals')(key) : words('refusals')('unknown', { code: r.code });
}

/** The state a row shows, and the group it sits in. A proposal still `open` after its close is waiting to be read. */
export function stage(r, now) {
  if (r.status === 'open') return now < r.closesAt ? 'open' : 'reading';
  if (r.status === 'adopted' || r.status === 'rejected') return 'decided';
  return 'reading';
}
const STATE = {
  open: ['Open', 'open'],
  reading: ['Being read', ''],
  contest: ['Open to contest', ''],
  deciding: ['Deciding', ''],
  interpreting: ['Being read', ''],
  adopted: ['Adopted', 'done'],
  rejected: ['Status quo kept', ''],
};
const stateOf = (r, now) => (r.status === 'open' && now >= r.closesAt ? ['Closed, waiting to be read', ''] : (STATE[r.status] ?? [r.status, '']));

const row = (r, now, mine) => {
  const [label, tone] = stateOf(r, now);
  const g = stage(r, now);
  const clock =
    g === 'open' ? `closes in ${esc(countdown(r.closesAt - now))} (${esc(date(r.closesAt))})` : `closed ${at(r.closesAt, now)}`;
  const yours = mine
    ? `<span class="state state--yours">${mine.unconfirmed ? 'Confirm your response' : 'Waits for your voice'}</span>`
    : '';
  return `<li><span title="${esc(r.id)}">${esc(r.id)}</span><span><a href="rfc.html?id=${encodeURIComponent(r.id)}">${esc(r.title)}</a><small>${r.target === 'engine' ? 'Changes the engine' : 'Changes the law'} · opened ${at(r.openedAt, now)} · ${clock}${r.adopted ? ` · adopted option <code>${esc(r.adopted)}</code>` : ''}</small></span><span class="marks">${yours}<span class="state${tone ? ` state--${tone}` : ''}">${esc(label)}</span></span></li>`;
};

const GROUPS = [
  ['open', 'Open now', 'No proposal is open now.'],
  ['reading', 'Being read or decided', 'No proposal is waiting to be read or decided.'],
  ['decided', 'Decided', 'No proposal has been decided yet.'],
];

/**
 * The list. `awaiting` maps a proposal id to `{ unconfirmed }` for a signed-in person's open proposals that wait for their
 * voice. With no row at all, it says so and shows the law's windows (`parameters` from /public/contract/stats).
 */
export function renderRfcList(rfcs, now, awaiting = new Map(), parameters = null) {
  if (!rfcs.length) {
    return `<p class="empty">No proposal has been opened yet. The first one sets the pattern for the rest.</p>${renderWindows(parameters)}`;
  }
  const by = { open: [], reading: [], decided: [] };
  for (const r of rfcs) by[stage(r, now)].push(r);
  by.open.sort((a, b) => a.closesAt - b.closesAt);
  by.reading.sort((a, b) => b.closesAt - a.closesAt);
  by.decided.sort((a, b) => b.closesAt - a.closesAt);
  return GROUPS.map(
    ([key, title, none], i) =>
      `<section aria-labelledby="g-${key}"><h2 class="group" id="g-${key}">${esc(title)} <span class="note">${count(by[key].length)}</span></h2>${
        by[key].length ? `<ul class="rows">${by[key].map(r => row(r, now, awaiting.get(r.id))).join('')}</ul>` : `<p class="note">${esc(none)}</p>`
      }</section>${i === GROUPS.length - 1 ? renderWindows(parameters) : ''}`,
  ).join('');
}

/** The law's windows, as the ledger holds them now. Empty when they could not be read. */
export function renderWindows(parameters) {
  if (!parameters) return '';
  const p = renderParameters({ parameters });
  return p.startsWith('<dl') ? `<section aria-labelledby="g-law"><h2 class="group" id="g-law">What the law sets now</h2><p class="sentence">Every proposal runs inside these windows and deposits. A proposal can change them.</p>${p}</section>` : '';
}

/** What opening a proposal costs, said before the act. A visitor's act is "Sign in to …", which comes back to the form. */
export function renderOpenAct(parameters, { signedIn = true } = {}) {
  const dep = parameters?.rfcDepositCents;
  const cost = typeof dep === 'number' ? `Opening a proposal needs an account with a voice and a deposit of ${money(dep)}.` : 'Opening a proposal needs an account with a voice and a deposit.';
  const act = signedIn ? '<a class="btn primary" href="propose.html">Open a proposal</a>' : '<a class="btn primary" href="signin.html?next=propose.html">Sign in to open a proposal</a>';
  return `${act}<p class="note">${esc(cost)} The deposit comes back when someone other than you supports a change.</p>`;
}

/** What a signed-in person is told about their voice on this list, in the contract's words. */
export function renderAwaitingNote(awaiting) {
  if (!awaiting) return 'Which proposals wait for your voice could not be read just now.';
  if (!awaiting.voice) return `You have no voice yet, so no proposal waits for you. ${awaiting.why ? refusalText({ code: awaiting.why }) : ''} A voice is obtained at your desk.`.replace(/ +/g, ' ').trim();
  const n = awaiting.rfcs.length;
  return n ? `${count(n)} open proposal${n === 1 ? ' waits' : 's wait'} for your voice, marked below.` : 'No open proposal waits for your voice.';
}

// ─── the page ──────────────────────────────────────────────────────────────

if (typeof document !== 'undefined' && document.body?.dataset.page === 'rfcs') {
  const { api, signedIn } = await import('./session.js');
  const slot = name => document.querySelector(`[data-slot="${name}"]`);
  const read = async path => {
    try {
      return await api(path, { anonymous: true });
    } catch {
      return null;
    }
  };
  const [rows, stats] = await Promise.all([read('/public/contract/rfcs'), read('/public/contract/stats')]);
  const list = slot('list');
  const now = Date.now();
  slot('act').innerHTML = renderOpenAct(stats?.parameters, { signedIn: signedIn() });
  if (!rows) {
    list.innerHTML = `<p class="refusal">The proposals could not be read. The contract's API could not be reached; check your connection and try again. They are public at <a href="https://api.commandagi.com/public/contract/rfcs">https://api.commandagi.com/public/contract/rfcs</a>.</p>`;
  } else {
    let awaiting = new Map();
    if (signedIn()) {
      let a = null;
      try {
        a = await api('/contract/awaiting');
      } catch { /* said below */ }
      awaiting = new Map((a?.rfcs ?? []).map(r => [r.id, r]));
      const note = slot('yours');
      note.textContent = renderAwaitingNote(a);
      note.hidden = false;
    }
    list.innerHTML = renderRfcList(rows.rfcs ?? [], now, awaiting, stats?.parameters ?? null);
  }
  list.removeAttribute('aria-busy');
}
