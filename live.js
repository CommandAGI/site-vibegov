// The contract's live record, as HTML: data in, escaped markup out. Pure (no DOM, no network), so site.test.mjs runs
// it against a fake API. page.js fetches and places it. Every figure comes from the public record at API; a count of
// zero says so in words, and nothing here is made up.

export const API = 'https://api.commandagi.com';
/** This site's page for one RFC: its options, its count or tally, its decision, and the acts of a voice on it. */
export const rfcHref = id => `rfc.html?id=${encodeURIComponent(id)}`;
/** This site's page that opens an RFC. */
export const PROPOSE = 'propose.html';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nf = new Intl.NumberFormat('en-US');
export const count = n => nf.format(Number(n) || 0);
export const money = cents => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function duration(ms) {
  const s = Math.round(Math.abs(ms) / 1000);
  const units = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [name, size] of units) if (s >= size) { const n = Math.round(s / size); return `${n} ${name}${n === 1 ? '' : 's'}`; }
  return '0 seconds';
}
export const relative = (at, now) => (at > now ? `in ${duration(at - now)}` : `${duration(now - at)} ago`);
export const date = at => new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
const time = (at, now) => `<time datetime="${new Date(at).toISOString()}" title="${esc(date(at))}">${esc(relative(at, now))}</time>`;
const hash = (h, n = 12) => (h ? `<code title="${esc(h)}">${esc(h.slice(0, n))}…</code>` : '<span class="none">none</span>');
const sum = o => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);

/** A sweep that has not written a beacon for this long is not running (it writes one a minute). */
export const BEACON_STALE_MS = 10 * 60_000;

/** The state of the record in one line: live, quiet or not reached. */
export function health(stats, now) {
  const beacon = stats.log.lastBeaconAt;
  if (!stats.log.length) return { state: 'empty', words: 'The log has no entry yet.' };
  if (beacon && now - beacon < BEACON_STALE_MS) return { state: 'live', words: `Live. The sweep wrote its last beacon ${relative(beacon, now)}.` };
  return { state: 'quiet', words: beacon ? `The sweep's last beacon was ${relative(beacon, now)}: it is not writing one a minute.` : 'The sweep has written no beacon yet.' };
}

const tile = (label, value, words, cite) =>
  `<div class="tile"><dt>${esc(label)}</dt><dd><b>${value}</b><span>${words}</span><cite>${esc(cite)}</cite></dd></div>`;

/**
 * The proposals as a row of cards: the open ones, soonest deadline first, each with the way to respond, then the
 * decided ones, then the way to open one. With none open or decided, the row is the path a proposal takes, with the
 * law's own windows.
 */
export function renderRfcStrip(s, now) {
  const deposit = s.parameters.rfcDepositCents;
  const open = s.rfcs.open.map(r => `<li class="card card--open">
<p class="card__meta"><span class="tag">${esc(r.target)}</span><span class="tag">${esc(r.procedure === 'binding_score' ? 'binding score' : 'deliberative')}</span>${until(r.closesAt, now)}</p>
<h4><a href="${esc(rfcHref(r.id))}">${esc(r.title)}</a></h4>
<p class="card__words">Closes ${time(r.closesAt, now)} · ${count(r.options)} option${r.options === 1 ? '' : 's'} and the status quo</p>
<p class="card__act"><a class="btn small primary" href="${esc(rfcHref(r.id))}">Respond</a></p>
</li>`);
  const decided = s.rfcs.decided.map(r => `<li class="card">
<p class="card__meta"><span class="verdict verdict--${r.status === 'adopted' ? 'adopted' : 'kept'}">${r.status === 'adopted' ? 'Adopted' : 'Status quo kept'}</span></p>
<h4><a href="${esc(rfcHref(r.id))}">${esc(r.title)}</a></h4>
<p class="card__words">${r.decidedAt ? `Decided ${time(r.decidedAt, now)}` : 'Decided'}</p>
</li>`);
  const step = (n, title, words) => `<li class="card card--step"><p class="card__meta"><span>step ${n}</span></p><h4>${title}</h4><p class="card__words">${words}</p></li>`;
  const path = open.length || decided.length ? [] : [
    step(1, 'Proposed in public', `Any person with a voice writes the change as options${deposit ? `, with a refundable deposit of ${money(deposit)}` : ''}.`),
    step(2, 'Open to every voice', `A change to the law stays open for ${esc(duration(s.parameters.lawRfcWindowMs))}. Every person may answer once.`),
    step(3, 'Read in full', `Every answer is read. You see how yours was read, and you have ${esc(duration(s.parameters.extractionContestMs))} to contest it.`),
    step(4, 'Decided on the record', 'The choice and its reasons are published. Silence counts for nothing.'),
  ];
  const start = `<li class="card card--new"><p class="card__meta"><span>${open.length ? 'yours' : 'none open today'}</span></p><h4>${open.length ? 'Propose a change' : 'Open the first proposal'}</h4><p class="card__act"><a class="btn small" href="${PROPOSE}" data-ref="k4">Open a proposal</a></p></li>`;
  return `<ol class="strip">${[...open, ...decided, ...path, start].join('')}</ol>`;
}

const PARAMS = [
  ['lawRfcWindowMs', 'An RFC on the law is open for', duration],
  ['engineRfcWindowMs', 'An RFC on the engine is open for', duration],
  ['extractionContestMs', 'You may contest how your response was read for', duration],
  ['rfcDepositCents', 'The deposit to open an RFC (refundable)', money],
  ['caseResponseMs', 'A respondent answers a case within', duration],
  ['caseEvidenceMs', 'Evidence is taken for', duration],
  ['appealMs', 'Either party may appeal within', duration],
  ['caseDepositCents', 'The cost deposit with a filing (never a bar to filing)', money],
  ['poolClaimCapCents', 'The pool covers a victim up to', money],
];

/** The law's windows and deposits, as the genesis or the last adopted RFC set them. */
export function renderParameters(s) {
  const rows = PARAMS.filter(([k]) => typeof s.parameters[k] === 'number');
  if (!rows.length) return '<p class="empty">The law\'s parameters could not be read.</p>';
  return `<dl class="params">${rows.map(([k, label, f]) => `<div><dt>${esc(label)}</dt><dd>${esc(f(s.parameters[k]))} <code>${esc(k)}</code></dd></div>`).join('')}</dl>`;
}

// ─── the record page ────────────────────────────────────────────────────────

const STATUS = { open: 'Open', interpreting: 'Reading the responses', contest: 'Open to contest', deciding: 'Deciding', adopted: 'Adopted', rejected: 'Status quo kept' };

const SCORES = ['−2', '−1', '0', '+1', '+2'];
const signed = n => (n > 0 ? `+${count(n)}` : n < 0 ? `−${count(-n)}` : '0');

const pin = p => (p.kind === 'weights' ? `weights ${hash(p.sha256, 10)}` : `version <code>${esc(p.id)}</code>`);
const permille = n => (n === null || n === undefined ? '—' : `${(n / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);

function seatRows(seats) {
  return seats
    .map(s => `<tr><td><code>${esc(s.id)}</code><br>${esc(s.model)}</td><td>${esc(s.operator)}${s.upstream ? ` via ${esc(s.upstream)}` : ''}</td><td>${pin(s.pin)}</td><td>${esc(s.modalities.join(', '))}</td><td class="num">${s.measured ? `${count(s.measured.calls)} calls · ${permille(s.measured.errorUpperPermille)} wrong at most` : s.economics ? `${permille(s.economics.errorPermille)} wrong (${esc(s.economics.source === 'prior' ? 'prior' : 'measured')})` : '—'}</td></tr>`)
    .join('');
}

/** The engine's seats from `/public/contract/engine`: who runs each and what pins its model. Models and companies only. */

/** The engine's seats from `/public/contract/engine`: who runs each and what pins its model. Models and companies only. */
export function renderEngine(e) {
  const head = '<thead><tr><th>Seat</th><th>Operator</th><th>Pinned by</th><th>Reads</th><th>Figures</th></tr></thead>';
  const tiers = e.tiers
    .map(t => `<h3 class="tier">Tier ${esc(t.tier)}: ${esc(t.name)}${t.quorum ? ` <span class="note">at least ${count(t.quorum)} groups agree</span>` : ''}</h3><div class="table-wrap" tabindex="0"><table>${head}<tbody>${seatRows(t.seats)}</tbody></table></div>`)
    .join('');
  return `<dl class="facts"><div><dt>Engine</dt><dd>${esc(e.name)} · ${hash(e.engineHash, 16)}</dd></div><div><dt>In force</dt><dd>version ${count(e.version)}${e.effectiveAt ? ` since ${esc(date(e.effectiveAt))}` : ''}${e.rfcId ? ` by RFC <a href="${esc(rfcHref(e.rfcId))}"><code>${esc(e.rfcId)}</code></a>` : ' (the genesis)'}</dd></div></dl>
${tiers}<h3 class="tier">Renderers <span class="note">media to text, two independent groups per medium</span></h3><div class="table-wrap" tabindex="0"><table>${head}<tbody>${seatRows(e.renderers)}</tbody></table></div>`;
}

export function renderJudgments(judgments, now) {
  if (!judgments.length) return '<p class="empty">No judgment yet. A case\'s record stays with its parties; its judgment is public here once it is given (k11).</p>';
  return `<ol class="decided">${judgments
    .map(j => {
      const last = (j.judgments ?? []).at(-1) ?? null;
      const claimed = (j.harms ?? []).reduce((a, h) => a + (Number(h.amountCents) || 0), 0);
      return `<li><span class="verdict">${esc(j.stage ?? '')}</span> ${esc(j.dutyTitle ?? j.id)}${j.criminal ? ' (criminal)' : ''} · ${money(claimed)} claimed${last?.outcome ? ` · <b>${esc(last.outcome)}</b>` : ''}${last?.at ? ` <span class="note">${time(last.at, now)}</span>` : ''} <a href="case.html?id=${encodeURIComponent(j.id)}">Read</a></li>`;
    })
    .join('')}</ol>`;
}

/** The last entries of the log, newest first, with the chain's check over them. */
export function renderLog(entries, problems, now) {
  if (!entries.length) return '<p class="empty">The log has no entry yet.</p>';
  const check = problems.length
    ? `<p class="check check--bad"><span class="dot" aria-hidden="true"></span>${esc(problems.slice(0, 3).join('; '))}</p>`
    : `<p class="check check--ok"><span class="dot" aria-hidden="true"></span>Each of these ${count(entries.length)} hashes was recomputed in your browser, and each links to the one before.</p>`;
  return `${check}<div class="table-wrap" tabindex="0"><table><thead><tr><th>#</th><th>Kind</th><th>Subject</th><th>When</th><th>Hash</th></tr></thead><tbody>${[...entries]
    .reverse()
    .map(e => `<tr><td>${count(e.seq)}</td><td>${esc(e.kind)}</td><td><code>${esc(String(e.subject).slice(0, 40))}</code></td><td>${time(e.at, now)}</td><td>${hash(e.hash)}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

export function renderCheckpoints({ anchor, checkpoints }, now) {
  const rows = checkpoints.slice(0, 20);
  const key = anchor?.key ? `The log is anchored by the key <code>${esc(anchor.key)}</code>.` : `No key anchors the log: ${esc(anchor?.detail ?? 'unknown')}.`;
  if (!rows.length) return `<p class="note">${key}</p><p class="empty">No checkpoint yet.</p>`;
  return `<p class="note">${key}</p><div class="table-wrap" tabindex="0"><table><thead><tr><th>Log entry</th><th>Status</th><th>Chain</th><th>When</th></tr></thead><tbody>${rows
    .map(c => `<tr><td>${count(c.seq)} ${hash(c.head)}</td><td>${esc(c.status === 'anchored' ? 'anchored' : c.status === 'failed' ? 'failed' : 'not anchored')}</td><td>${c.tx ? `${esc(c.cluster ?? '')} <code title="${esc(c.tx)}">${esc(c.tx.slice(0, 10))}…</code>` : esc(c.detail ?? '')}</td><td>${time(c.at, now)}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

export function renderVersions(versions) {
  if (!versions.length) return '<p class="empty">No version.</p>';
  return `<div class="table-wrap" tabindex="0"><table><thead><tr><th>Version</th><th>In force since</th><th>From</th><th>Kernel</th><th>Engine</th><th>State</th></tr></thead><tbody>${versions
    .map(v => `<tr><td>${count(v.version)}</td><td>${esc(date(v.effectiveAt))}</td><td>${v.rfcId ? `RFC <code>${esc(v.rfcId)}</code>` : 'the genesis'}</td><td>${hash(v.kernelHash)}</td><td>${hash(v.engineHash)}</td><td>${hash(v.stateHash)}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

/** GET a public path of the API as JSON, or throw with the status. */
export async function getJson(fetchFn, base, path) {
  const res = await fetchFn(`${base}${path}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json();
}

// ─── the front door: what is alive now (docs/vibegov.md § the site) ──────────────────────────────────────────

const WEEK_MS = 7 * 86_400_000;

/** A countdown in its two largest units, padded so that it does not jump as it ticks: "2d 04h", "4h 12m", "12m 05s". */
export function countdown(ms) {
  if (!(ms > 0)) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = n => String(n).padStart(2, '0');
  if (d) return `${d}d ${p(h)}h`;
  if (h) return `${h}h ${p(m)}m`;
  if (m) return `${m}m ${p(sec)}s`;
  return `${sec}s`;
}

/** A time that page.js words again each second: `data-at` for "4 seconds ago", `data-until` for a countdown. */
const since = (at, now) => `<time datetime="${new Date(at).toISOString()}" title="${esc(date(at))}" data-at="${at}">${esc(relative(at, now))}</time>`;
const until = (at, now) => `<span class="countdown" data-until="${at}" title="${esc(date(at))}">${esc(countdown(at - now))}</span>`;

const cap = t =>t.charAt(0).toUpperCase() + t.slice(1);

/**
 * One act of the log in plain words: what happened, about what, and where to read it. Counts and RFC titles only: an
 * act on a case or a person names neither (the log itself holds only a digest of the act's body).
 */
export function activityWords(e) {
  const rfc = e.rfcTitle ? `“${esc(e.rfcTitle)}”` : 'an RFC';
  const n = e.n ?? 1;
  const many = (one, more) => (n === 1 ? one : more.replace('{n}', count(n)));
  const on = e.rfcTitle ? ` on ${rfc}` : '';
  const version = esc(String(e.subject).replace(/^version:/, ''));
  const W = {
    version: ['law', `Contract version ${version} took effect`],
    'adoption.executed': ['law', `Version ${version} was written on chain`],
    'rfc.opened': ['rfc', `RFC ${rfc} opened`],
    'rfc.response': ['rfc', many(`A response to ${rfc} was confirmed`, `{n} responses to ${rfc} were confirmed`)],
    'rfc.interpretation': ['engine', many(`The engine read a response to ${rfc}`, `The engine read {n} responses to ${rfc}`)],
    'rfc.reinterpretation': ['engine', many(`A contested reading${on} was read again`, `{n} contested readings${on} were read again`)],
    'rfc.decided': ['rfc', `${cap(rfc)} was decided`],
    determination: ['engine', many(`The engine made a determination${on}`, `The engine made {n} determinations${on}`)],
    'determination.review': ['engine', many('A determination was reviewed', '{n} determinations were reviewed')],
    'case.filed': ['case', many('A case was filed', '{n} cases were filed')],
    'case.submission': ['case', many('A party added to a case’s record', 'Parties added {n} submissions to a case')],
    'case.appeal': ['case', 'A judgment was appealed'],
    'case.stakes': ['case', 'A party raised a case’s stakes'],
    'case.judgment': ['case', many('A case was decided', '{n} judgments were given')],
    'case.executed': ['case', 'A judgment was carried out'],
    'case.insurance': ['money', 'The pool decided an insurance claim'],
    'identity.resolved': ['case', 'A judgment resolved an identity'],
    'personhood.issued': ['people', many(`A ${esc(String(e.subject).replace(/^personhood:/, '') || 'person')}’s voice was confirmed`, '{n} voices were confirmed')],
    'personhood.revoked': ['people', 'A voice was revoked'],
    'pool.epoch': ['money', 'The pool settled an epoch'],
    'credit.mandate': ['money', 'A credit mandate opened'],
    'credit.mandate.closed': ['money', 'A credit mandate closed'],
    'credit.facility': ['money', 'A loan was made'],
    'credit.payment': ['money', many('A loan payment was made', '{n} loan payments were made')],
    'credit.transfer': ['money', 'A loan changed hands'],
    'credit.default': ['money', 'A loan defaulted'],
    'intent.authorized': ['machine', many('The contract authorized a command to a machine', 'The contract authorized {n} commands to machines')],
    'intent.recorded': ['machine', many('A machine’s receipt was recorded on chain', '{n} machines’ receipts were recorded on chain')],
    'intent.closed': ['machine', many('A finished command was closed on chain', '{n} finished commands were closed on chain')],
  }[e.kind];
  const [family, words] = W ?? ['law', `${esc(e.kind)} was recorded`];
  const href = e.rfcTitle ? rfcHref(e.subject) : e.kind.startsWith('intent.') ? 'record.html#machines' : 'record.html';
  return { family, words, href };
}

/** Acts of one kind on one subject in a row read as one line with a count ("12 responses to … were confirmed"). */
export function groupActivity(entries) {
  const out = [];
  for (const e of entries) {
    const last = out.at(-1);
    if (last && last.kind === e.kind && last.subject === e.subject) last.n += 1;
    else out.push({ ...e, n: 1 });
  }
  return out;
}

/** What just happened, newest first; the routine heartbeat (beacons, seal batches) as one closing line. */
export function renderActivity(activity, stats, now) {
  const lines = groupActivity(activity.entries).slice(0, 12);
  const routine = stats ? Object.entries(stats.log.lastDay ?? {}).filter(([k]) => k === 'beacon' || k === 'seals') : [];
  const heartbeat = routine.length
    ? `<p class="feed__routine">Also in the last 24 hours: ${routine.map(([k, n]) => `${count(n)} ${k === 'beacon' ? 'chain beacons' : 'seal batches from machines and hosts'}`).join(' and ')}. That is the record’s heartbeat.</p>`
    : '';
  if (!lines.length) return `<p class="empty">Nothing has happened on the record yet but its heartbeat.</p>${heartbeat}`;
  return `<ol class="feed">${lines
    .map(e => {
      const w = activityWords(e);
      return `<li class="feed__item feed--${w.family}"><a href="${esc(w.href)}">${w.words}</a><span class="feed__when">${since(e.at, now)} · entry ${count(e.seq)}</span></li>`;
    })
    .join('')}</ol>${heartbeat}`;
}

const caseRef = e => `<code title="${esc(e.subject)}">${esc(String(e.subject).slice(0, 10))}</code>`;
const CAL = {
  'rfc.closes': ['rfc', e => `Responses close on “${esc(e.title)}”`],
  'rfc.contest_closes': ['rfc', e => `Last moment to contest a reading on “${esc(e.title)}”`],
  'engine.session': ['engine', e => (e.id.endsWith(':decide') ? `The engine sits to decide “${esc(e.title)}”` : `The engine sits to read the responses to “${esc(e.title)}”`)],
  'case.answer_due': ['case', e => `A respondent’s answer is due in case ${caseRef(e)}`],
  'case.evidence_closes': ['case', e => `Evidence closes in case ${caseRef(e)}`],
  'case.appeal_closes': ['case', e => `The appeal window closes in case ${caseRef(e)}`],
};

/** What comes next, soonest first: a date block, the event in words, and a countdown. A due engine sitting is "in session". */
export function renderCalendar(cal, now) {
  if (!cal.events.length) return '<p class="empty">Nothing is on the calendar: no RFC is open and no case waits on a deadline.</p>';
  const part = (at, o) => new Date(at).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  return `<ol class="cal">${cal.events
    .slice(0, 10)
    .map(e => {
      const [family, words] = CAL[e.kind] ?? ['rfc', () => esc(e.kind)];
      const href = family === 'case' ? 'record.html' : rfcHref(e.subject);
      const when = e.at <= now ? '<span class="countdown countdown--now">in session</span>' : until(e.at, now);
      return `<li class="cal__item cal--${family}"><time class="cal__date" datetime="${new Date(e.at).toISOString()}"><b>${esc(part(e.at, { day: 'numeric' }))}</b>${esc(part(e.at, { month: 'short' }))}</time><a href="${esc(href)}">${words(e)}</a>${when}</li>`;
    })
    .join('')}</ol>`;
}

/** A picture's address on the API, in 15-second buckets: a live frame is fetched again each bucket, cached between. */
export const pictureHref = (base, path, now) => `${base}${path}${path.includes('?') ? '&' : '?'}t=${Math.floor(now / 15_000)}`;

const STATE = { live: ['live', 'Live'], recorded: ['recorded', 'Recording'], idle: ['idle', 'Idle'] };

/**
 * Machines that their owners made public and published (`/public/contract/robots`). Live means a frame or an act in
 * the last two minutes; anything older is a recording and says so. With none on view, the page says that.
 */
export function renderRobots(view, now, base = API) {
  if (!view.robots.length)
    return '<p class="empty robots__none"><b>No live robot right now.</b> A machine shows here while its owner has made its run public and published it. Below is a recording.</p>';
  return `<ul class="robots">${view.robots
    .slice(0, 6)
    .map(r => {
      const [cls, label] = STATE[r.state] ?? STATE.idle;
      const pic = r.picture
        ? `<img class="robot__frame" src="${esc(pictureHref(base, r.picture, now))}" alt="${esc(`What ${r.title} shows${r.state === 'live' ? ' now' : ' last'}`)}" loading="lazy" data-frame="${esc(r.picture)}">`
        : '<div class="robot__frame robot__frame--none" aria-hidden="true"></div>';
      const last = r.frameAt ?? r.lastActivityAt;
      return `<li class="robot robot--${cls}">
<figure>${pic}<figcaption><span class="badge badge--${cls}">${label}</span><span class="tag">${esc(r.reality)}</span></figcaption></figure>
<h3>${esc(r.title)}</h3>
${r.description ? `<p>${esc(r.description)}</p>` : ''}
<p class="robot__meta">${esc(r.machines.map(m => m.noun).join(', '))}${last ? ` · ${r.state === 'live' ? 'last frame' : 'last active'} ${since(last, now)}` : ''}</p>
<p><a class="btn small" href="${esc(r.watch)}">${r.state === 'live' ? 'Watch it live' : 'Open its run'}</a></p>
</li>`;
    })
    .join('')}</ul>`;
}

const CMD_STATUS = { authorized: 'authorized', delivered: 'delivered', receipted: 'done, with a receipt', refused: 'refused by its host', failed: 'failed', not_authorized: 'not authorized' };

/** The commands the contract itself authorized (an agreement's verdict listed them): verb, channel, state, chain. */
export function renderCommands(view, now) {
  const by = view.commands.byStatus;
  const total = sum(by);
  if (!total)
    return '<p class="empty">The contract has authorized no command to a machine yet. One comes from an agreement whose verdict lists an intent: the engine’s seats sign it on chain, and the machine’s host runs it once, under its own standing grant to the contract.</p>';
  return `<p class="note">${count(total)} command${total === 1 ? '' : 's'} in all: ${Object.entries(by).map(([k, n]) => `${count(n)} ${esc(CMD_STATUS[k] ?? k)}`).join(' · ')}.</p><ol class="cmds">${view.commands.recent
    .map(c => `<li><b>${esc(c.kind === 'command' ? `${c.verb ?? 'command'}${c.channel ? ` on ${c.channel}` : ''}` : c.kind)}</b> <span class="verdict${c.status === 'receipted' ? ' verdict--adopted' : ''}">${esc(CMD_STATUS[c.status] ?? c.status)}</span> <span class="note">${since(c.updatedAt ?? c.at, now)}${c.tx ? ` · ${esc(c.cluster ?? 'chain')} <code title="${esc(c.tx)}">${esc(c.tx.slice(0, 10))}…</code>` : ''}</span></li>`)
    .join('')}</ol>`;
}

// ─── a recorded run (robots/labrat/, copied from the run by the repository's scripts/seed/vibegov-contract.mjs) ──

// The tape under every page's header: the contract's figures now, one line, each a label over a value.
export function renderTape(s, now) {
  const h = health(s, now);
  const cell = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  const a = s.anchor;
  return `<dl class="tape__in">${[
    cell('Record', `<span class="tape__state tape__state--${h.state}">${h.state === 'live' ? 'live' : h.state === 'empty' ? 'empty' : 'quiet'}</span>`),
    cell('Ledger', `${count(s.log.length)} ${s.log.length === 1 ? 'entry' : 'entries'}`),
    cell('Last entry', s.log.headAt ? since(s.log.headAt, now) : 'none'),
    cell('Version', count(s.contract.version)),
    cell('Kernel', `<code title="${esc(s.contract.kernelHash)}">${esc(String(s.contract.kernelHash).slice(0, 8))}</code>`),
    cell('Proposals', count(sum(s.rfcs.byStatus))),
    cell('Open now', count(s.rfcs.open.length)),
    cell('Voices', count(sum(s.people.withVoice))),
    cell('Responses', count(s.voices.confirmed)),
    cell('Cases', count(sum(s.cases.byStage))),
    cell('Judgments', count(s.cases.judgments)),
    cell('Pool', money(s.pool.balanceCents)),
    cell('Credit open', money(s.credit.openCapitalCents)),
    cell('Anchored', `${count(a.anchoredOfLast?.anchored)} of ${count(a.anchoredOfLast?.of)}`),
  ].join('')}</dl>`;
}

// The front door's plates: a few rows of fact under each thing the contract holds. A figure is read from the public
// record; a rule is the kernel's or the law's, and its row says which.
const plate = rows => `<table class="plate"><tbody>${rows.map(([label, value, note]) => `<tr><th scope="row">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</th><td>${value}</td></tr>`).join('')}</tbody></table>`;
const kinds = o => Object.entries(o ?? {}).filter(([, n]) => n).map(([k, n]) => `${count(n)} ${esc(k)}`).join(' · ');

/** One person, one voice (k2): who holds a voice now, and what adds nothing to one. */
export function renderVoicePlate(s) {
  const persons = sum(s.people.withVoice);
  return plate([
    ['Persons with a voice', `${count(persons)}${persons ? ` <span>${kinds(s.people.withVoice)}</span>` : ''}`, 'now, from the record'],
    ['Voices for each person', '1'],
    ...['Wealth', 'Stake', 'Activity', 'Intelligence', 'Position'].map(w => [`${w} adds`, '0']),
  ]);
}

/** Governed by human voice (k4): the proposals now, and the law's own windows. */
export function renderChangePlate(s) {
  const p = s.parameters;
  return plate([
    ['Proposals open', count(s.rfcs.open.length), 'now, from the record'],
    ['Proposals in all', count(sum(s.rfcs.byStatus))],
    ['Responses counted', count(s.voices.confirmed)],
    ['A change to the law stays open', esc(duration(p.lawRfcWindowMs)), 'the law'],
    ...(p.engineRfcWindowMs ? [['A change to the engine stays open', esc(duration(p.engineRfcWindowMs))]] : []),
    ['Time to contest how you were read', esc(duration(p.extractionContestMs))],
    ['Deposit to open one, refundable', money(p.rfcDepositCents)],
  ]);
}

/** An autonomous judicial system (k6 to k9): a case in order, with the law's clocks and limits. */
export function renderCasePlate(s) {
  const p = s.parameters;
  return plate([
    ['Cases open', count(sum(s.cases.byStage)), 'now, from the record'],
    ['Judgments given', count(s.cases.judgments)],
    ['1. Filing', `cost deposit ${money(p.caseDepositCents)}, never a bar`, 'the law'],
    ['2. Service', 'the clock starts here'],
    ['3. Answer', esc(duration(p.caseResponseMs))],
    ['4. Evidence', esc(duration(p.caseEvidenceMs))],
    ['5. Decision', 'each element, with reasons'],
    ['6. Appeal', `${esc(duration(p.appealMs))}, to seats that took no part`],
    ['7. Execution', p.penaltyMultiplePermille ? `penalty at most ${esc(String(p.penaltyMultiplePermille / 1000))}× the proved harm` : 'for the harm established'],
    ['Pool cover for an unpaid victim', `up to ${money(p.poolClaimCapCents)}`],
  ]);
}

// The ledger as blocks (the front door): one entry of the log is one block, all alike.
const BLOCK = { seals: 'Seals from machines and hosts', beacon: 'A chain beacon' };

/** One entry: its number, when, what it is in plain words, and its hash after the hash it follows. */
export function renderBlock(e, now) {
  return `<li class="block" data-seq="${esc(e.seq)}"><p class="block__top"><b>Entry ${count(e.seq)}</b>${since(e.at, now)}</p><p class="block__what">${BLOCK[e.kind] ?? activityWords(e).words}</p><p class="block__hash"><code title="${esc(e.hash)}">${esc(e.hash.slice(0, 14))}</code><span>follows</span><code title="${esc(e.prev)}">${esc(e.prev.slice(0, 14))}</code></p></li>`;
}

/** The check of the blocks a reader has in front of them. */
export function renderChainCheck(n, problems) {
  return problems.length
    ? `<p class="check check--bad"><span class="dot" aria-hidden="true"></span>${esc(problems.slice(0, 3).join('; '))}</p>`
    : `<p class="check check--ok"><span class="dot" aria-hidden="true"></span>Your browser recomputed the last ${count(n)} hashes. Each one follows the one before.</p>`;
}
