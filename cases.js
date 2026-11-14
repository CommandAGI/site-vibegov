// The courts' list (redesign/APP.md § the pages, cases.html): anyone reads the public projection of the cases (counts by
// stage, the judgments; kernel k11); a signed-in person also sees their own cases, their role and the clock that runs
// for them. The helpers at the top are shared with file.js and case.js. The renderers are pure: data in, escaped HTML
// out, so test/cases.test.mjs calls them with no browser.
import { API, api, esc, session, signedIn } from './session.js';
import { count, date, money, duration, relative, renderJudgments } from './live.js';
import { hasWords, refusalKey, words } from './contract-words.js';

const t = words('cases');
const st = words('stages');
const needs = words('needs');
const rf = words('refusals');

// ─── shared by the three court pages ──────────────────────────────────────────

/** A stage in the catalog's words; a stage the catalog does not know is shown as it is. */
export const stageWords = s => (hasWords('stages', s) ? st(s) : String(s ?? ''));

/** A moment as a date and how far it is from now. `data-at` lets the page re-word it as time passes. */
export const when = (at, now = Date.now()) =>
  at ? `<time datetime="${esc(new Date(at).toISOString())}" data-at="${Number(at)}">${esc(`${date(at)} (${relative(at, now)})`)}</time>` : '—';

/** Re-word every `time[data-at]` (each 30 s): a date stays, "in 3 days" moves on. */
export function keepTime(root = document) {
  const tick = () => {
    const now = Date.now();
    for (const el of root.querySelectorAll('time[data-at]')) el.textContent = `${date(Number(el.dataset.at))} (${relative(Number(el.dataset.at), now)})`;
  };
  setInterval(tick, 30_000);
}

/** A kernel article in the margin of the rule it applies, linked to its text. */
export const art = id => `<span class="art"><a href="contract.html#${esc(id)}">${esc(id)}</a></span>`;

/**
 * Refusals in the catalog's words (the editor's Refusals.tsx): a code the catalog knows is said plainly, a kernel code
 * (`k6.interest`) as the article it breaches; the route's detail follows as data, and the code last.
 */
export function refusalsHtml(refusals) {
  if (!refusals?.length) return '';
  return `<div class="refusal" role="alert"><ul>${refusals
    .map(r => {
      const key = refusalKey(String(r.code));
      const text = key && hasWords('refusals', key) ? rf(key) : rf('unknown', { code: r.code });
      return `<li>${esc(text)}${r.detail ? ` <span class="note">${esc(r.detail)}</span>` : ''} <code>${esc(r.code)}</code></li>`;
    })
    .join('')}</ul></div>`;
}

/** The words for an API that could not be read: unreachable, or the status it answered. */
export function unreachable(error) {
  return error?.status === 0 || !error?.status
    ? `The contract’s API could not be reached at ${API}. Check your connection and reload the page.`
    : `The contract’s API answered ${error.status}${error.code ? ` (${error.code})` : ''}: ${error.message}`;
}

/** One read of the API: `{ data }`, or `{ error }` (an ApiError) so the page can say which. */
export async function read(path, opts = {}) {
  try {
    return { data: await api(path, opts) };
  } catch (error) {
    return { error };
  }
}

/** The law's parameters: the full set from `/public/contract`, else the subset `/public/contract/stats` publishes. */
export const parametersOf = (overview, stats) => ({ ...(stats?.parameters ?? {}), ...(overview?.law?.parameters ?? {}) });

/** What filing costs and binds, from the law's parameters, before the button (cases.html and file.html). */
export function filingTerms(p) {
  const items = [];
  if (typeof p.caseDepositCents === 'number')
    items.push(['k7', `Filing holds a cost deposit of ${money(p.caseDepositCents)} from your balance, as far as the balance goes. It is never a bar to filing: an empty balance files all the same. It comes back if the claim succeeds; if it fails, the engine’s costs are paid from it (the losing side pays).`]);
  items.push(['k6', `The contract first checks that the matter was not brought before (one matter is one case), then serves the respondent.${typeof p.caseResponseMs === 'number' ? ` The respondent has ${duration(p.caseResponseMs)} to answer, and that time starts only when the notice reaches them.` : ' Their time to answer starts only when the notice reaches them.'}${typeof p.caseEvidenceMs === 'number' ? ` Evidence then stays open for ${duration(p.caseEvidenceMs)}.` : ''}`]);
  items.push(['k7', `The engine’s seats decide each element of the duty on one record. No human decides. Either side may appeal once${typeof p.appealMs === 'number' ? `, within ${duration(p.appealMs)} of the judgment,` : ''} to seats that took no part; that judgment is final.`]);
  items.push(['k11', 'The parties, the duty, each harm item’s interest and amount, and the judgments are public. What happened, the descriptions and the evidence are seen only by the parties.']);
  if (typeof p.openCasesPerClaimant === 'number') items.push(['law', `You may have at most ${count(p.openCasesPerClaimant)} open cases as claimant at one time.`]);
  return `<ul class="terms">${items.map(([a, s]) => `<li>${a === 'law' ? '<span class="art">law</span>' : art(a)}<span>${esc(s)}</span></li>`).join('')}</ul>`;
}

// ─── this page ────────────────────────────────────────────────────────────────

/** The stages in the order a case passes them. */
export const STAGES = ['screening', 'serving', 'awaiting_response', 'evidence', 'ready', 'decided', 'appealed', 'final', 'unprocessable', 'duplicate'];

/** The counts by stage (`/public/contract/stats` `cases`). A count never names who. */
export function renderStageCounts(cases) {
  const by = cases?.byStage ?? {};
  const total = Object.values(by).reduce((a, b) => a + (Number(b) || 0), 0);
  if (!total) return '<p class="empty">No case has been filed yet.</p>';
  const known = STAGES.filter(s => by[s]);
  const other = Object.keys(by).filter(s => !STAGES.includes(s) && by[s]);
  return `<p class="note">${esc(`${count(total)} ${total === 1 ? 'case' : 'cases'} in all; ${count(cases.judgments ?? 0)} with a judgment.`)}</p><dl class="tally">${[...known, ...other]
    .map(s => `<div><dt>${esc(stageWords(s))}</dt><dd>${count(by[s])}</dd></div>`)
    .join('')}</dl>`;
}

/** The clock that runs for the person (`/contract/awaiting` `cases[]`: act and due), in words. */
export function clockWords(clock, now) {
  if (!clock) return '';
  if (clock.act === 'answer' && clock.due) return needs('caseAnswer', { when: `${date(clock.due)} (${relative(clock.due, now)})` });
  if (clock.act === 'evidence' && clock.due) return needs('caseEvidence', { when: `${date(clock.due)} (${relative(clock.due, now)})` });
  if (clock.act === 'appeal' && clock.due) return needs('caseAppeal', { when: `${date(clock.due)} (${relative(clock.due, now)})` });
  return needs('caseWait', { stage: stageWords(clock.stage) });
}

/**
 * The person's own cases (`GET /contract/cases`: id, claimant, respondent, criminal, stage, filedAt), newest first,
 * each with their role and, for an open case, the clock from `GET /contract/awaiting`.
 */
export function renderMyCases(rows, clocks, me, now) {
  if (!rows.length) return `<p class="empty">${esc(t('empty'))}</p>`;
  return `<ul class="rows">${rows
    .map(r => {
      const role = clocks.get(r.id)?.role ?? (r.respondent === me ? 'respondent' : 'claimant');
      const title = role === 'claimant' ? t('youAgainst', { respondent: r.respondent }) : t('againstYou', { claimant: r.claimant });
      const clock = clocks.get(r.id);
      const due = clock && clock.act !== 'wait';
      const line = [stageWords(r.stage), r.criminal ? t('criminal') : t('civil'), t('filed', { when: date(r.filedAt) })].join(' · ');
      return `<li><span title="${esc(r.id)}">${esc(String(r.id).slice(0, 10))}</span><span><a href="case.html?id=${encodeURIComponent(r.id)}">${esc(title)}</a><small>${esc(line)}</small>${clock ? `<small${due ? ' class="warn"' : ''}>${esc(clockWords(clock, now))}</small>` : ''}</span><span class="state${due ? ' state--yours' : ''}">${esc(role === 'claimant' ? needs('roleClaimant') : needs('roleRespondent'))}</span></li>`;
    })
    .join('')}</ul>`;
}

async function start() {
  const put = (id, html) => { const el = document.getElementById(id); if (el) { el.innerHTML = html; el.removeAttribute('aria-busy'); } };
  const now = Date.now();
  const [stats, overview, judgments] = await Promise.all([
    read('/public/contract/stats', { anonymous: true }),
    read('/public/contract', { anonymous: true }),
    read('/public/contract/judgments', { anonymous: true }),
  ]);
  const p = parametersOf(overview.data, stats.data);
  put('file-terms', stats.error && overview.error ? `<p class="empty">${esc(unreachable(stats.error))}</p>` : filingTerms(p));
  put('file-act', signedIn()
    ? '<a class="btn primary" data-ref="k6" href="file.html">File a case</a>'
    : '<a class="btn primary" data-ref="k6" href="signin.html?next=file.html">Sign in to file a case</a>');
  put('stage-counts', stats.error ? `<p class="empty">${esc(unreachable(stats.error))}</p>` : renderStageCounts(stats.data.cases));
  put('judgments', judgments.error ? `<p class="empty">${esc(unreachable(judgments.error))}</p>` : renderJudgments(judgments.data.judgments ?? [], now));

  const mine = document.getElementById('my-cases');
  if (!signedIn()) {
    put('my-cases', '<p class="empty">Sign in to see the cases you are a party to. <a href="signin.html?next=cases.html">Sign in</a></p>');
    return;
  }
  if (mine) mine.setAttribute('aria-busy', 'true');
  const [list, awaiting] = await Promise.all([read('/contract/cases'), read('/contract/awaiting')]);
  if (list.error) return put('my-cases', `<p class="empty">${esc(list.error.status === 401 ? 'Your session has ended. Sign in again to see your cases.' : unreachable(list.error))}</p>`);
  const clocks = new Map((awaiting.data?.cases ?? []).map(c => [c.id, c]));
  const me = awaiting.data?.entity ?? session()?.userId ?? '';
  put('my-cases', renderMyCases(list.data?.cases ?? [], clocks, me, now));
  keepTime();
}

if (globalThis.document?.getElementById?.('my-cases')) start();
