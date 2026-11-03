// The contract's live record, as HTML: data in, escaped markup out. Pure (no DOM, no network), so site.test.mjs runs
// it against a fake API. page.js fetches and places it. Every figure comes from the public record at API; a count of
// zero says so in words, and nothing here is made up.

export const API = 'https://api.commandagi.com';
export const WORKBENCH = 'https://commandagi.com/app';

/** The workbench's contract editor on a record (an untitled document: following the link writes no file). */
export const editorHref = (kind, id) => `${WORKBENCH}?open=${encodeURIComponent(kind ? `/app/contract?${kind}=${id}` : '/app/contract')}`;

/** This site's page for one RFC: its options, its count, and once read its tally (record.html reads the hash). */
export const rfcHref = id => `record.html#rfc=${encodeURIComponent(id)}`;

/** The RFC a record page's address names (`#rfc=<id>`), or null. */
export function rfcOfHash(hash) {
  const m = /^#rfc=([^&]+)$/.exec(hash ?? '');
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

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

/** The figures of the front door. */
export function renderFigures(s) {
  const open = s.rfcs.byStatus.open ?? 0;
  const decided = (s.rfcs.byStatus.adopted ?? 0) + (s.rfcs.byStatus.rejected ?? 0);
  const working = sum(s.rfcs.byStatus) - open - decided;
  const kinds = Object.entries(s.people.withVoice).filter(([, n]) => n > 0);
  const persons = sum(s.people.withVoice);
  const anon = sum(s.people.anonymousCommitments);
  const cases = sum(s.cases.byStage);
  const closedCases = ['final', 'duplicate', 'unprocessable'].reduce((a, k) => a + (s.cases.byStage[k] ?? 0), 0);
  const facilities = sum(s.credit.facilitiesByState);
  return `<dl class="tiles">${[
    tile('Open RFCs', count(open), open ? `${count(working)} more being read or decided` : 'No RFC is open. Anyone may open one.', '§ RFCs'),
    tile('RFCs decided', count(decided), decided ? `${count(s.rfcs.byStatus.adopted ?? 0)} adopted, ${count(s.rfcs.byStatus.rejected ?? 0)} kept the status quo` : 'None yet. The genesis law is in force.', '§ RFCs 5–7'),
    tile('Responses counted', count(s.voices.confirmed), s.voices.confirmed ? `on ${count(s.voices.rfcsAnswered)} RFC${s.voices.rfcsAnswered === 1 ? '' : 's'}, each confirmed by its respondent` : 'No confirmed response yet.', '§ RFCs 2'),
    tile('Persons with a voice', count(persons), persons ? esc(kinds.map(([k, n]) => `${count(n)} ${k}`).join(' · ')) : 'Nobody holds a voice yet. A human gets one with the identity check.', 'k2 · § people'),
    tile('Anonymous identities', count(anon), anon ? 'registered for a zero-knowledge voice' : 'None registered. An anonymous voice counts once without saying whose.', '§ anonymous voice'),
    tile('Cases', count(cases), cases ? `${count(cases - closedCases)} open · ${count(s.cases.judgments)} with a judgment` : 'No case has been filed.', 'k6 · k7 · § justice'),
    tile('The pool', money(s.pool.balanceCents), s.pool.openClaims ? `${count(s.pool.openClaims)} open claims, ${money(s.pool.owedCents)} owed` : 'No open claim.', 'k9 · § the pool'),
    tile('Credit open', money(s.credit.openCapitalCents), s.credit.openMandates || facilities ? `${count(s.credit.openMandates)} open mandates · ${count(facilities)} facilities` : 'No mandate is open.', '§ credit'),
  ].join('')}</dl>`;
}

/** The open RFCs, soonest deadline first, each with the way to respond. */
export function renderOpenRfcs(s, now) {
  if (!s.rfcs.open.length) {
    const deposit = s.parameters.rfcDepositCents;
    return `<p class="empty">No RFC is open now. Anyone may open one${deposit ? ` with a refundable deposit of ${money(deposit)}` : ''}. <a href="${esc(editorHref())}">Open an RFC</a></p>`;
  }
  return `<ol class="rfcs">${s.rfcs.open
    .map(r => `<li class="rfc">
<p class="rfc__meta"><span class="tag">${esc(r.target)}</span><span class="tag">${esc(r.procedure === 'binding_score' ? 'binding score' : 'deliberative')}</span><span>${count(r.options)} option${r.options === 1 ? '' : 's'} and the status quo</span></p>
<h3><a href="${esc(rfcHref(r.id))}">${esc(r.title)}</a></h3>
<p class="rfc__clock">Closes ${time(r.closesAt, now)} · opened ${time(r.openedAt, now)} ${until(r.closesAt, now)}</p>
<p class="rfc__act"><a class="btn small primary" href="${esc(editorHref('rfc', r.id))}">Respond</a> <code>${esc(r.id)}</code></p>
</li>`)
    .join('')}</ol>`;
}

export function renderDecided(s, now) {
  if (!s.rfcs.decided.length) return '<p class="empty">No RFC has been decided yet.</p>';
  return `<ol class="decided">${s.rfcs.decided
    .map(r => `<li><span class="verdict verdict--${r.status === 'adopted' ? 'adopted' : 'kept'}">${r.status === 'adopted' ? 'Adopted' : 'Status quo kept'}</span> <a href="${esc(rfcHref(r.id))}">${esc(r.title)}</a> <span class="note">${r.decidedAt ? time(r.decidedAt, now) : ''}</span></li>`)
    .join('')}</ol>`;
}

/** The record's own state: the log, the sweep, the anchor, the version in force. */
export function renderLedger(s, now) {
  const h = health(s, now);
  const day = Object.entries(s.log.lastDay ?? {}).sort((a, b) => b[1] - a[1]);
  const most = day[0]?.[1] ?? 0;
  const a = s.anchor;
  const anchored = a.last?.status === 'anchored';
  const anchorWords = a.last
    ? anchored
      ? `Checkpoint ${count(a.last.seq)} is anchored on ${esc(a.last.cluster ?? 'chain')}${a.last.tx ? ` (<code title="${esc(a.last.tx)}">${esc(a.last.tx.slice(0, 10))}…</code>)` : ''}.`
      : `The last checkpoint (${count(a.last.seq)}) is not anchored on chain${a.key ? '' : `: ${esc(a.detail ?? 'no anchor key')}`}.`
    : 'No checkpoint yet.';
  return `<div class="ledger">
<p class="health health--${h.state}"><span class="dot" aria-hidden="true"></span>${esc(h.words)}</p>
<dl class="facts">
<div><dt>Log</dt><dd><b>${count(s.log.length)}</b> entries · the last ${s.log.headAt ? time(s.log.headAt, now) : 'never'} · head ${hash(s.log.headHash)}</dd></div>
<div><dt>Anchor</dt><dd>${anchorWords} ${count(a.anchoredOfLast.anchored)} of the last ${count(a.anchoredOfLast.of)} checkpoints are anchored.${a.key ? ` Anchor key <code>${esc(a.key)}</code>.` : ''}</dd></div>
<div><dt>Version</dt><dd>${s.contract ? `${count(s.contract.version)} · in force since ${esc(date(s.contract.effectiveAt))}${s.contract.rfcId ? ` by RFC <code>${esc(s.contract.rfcId)}</code>` : ' (the genesis)'}` : 'none'}</dd></div>
<div><dt>Engine</dt><dd>${hash(s.contract?.engineHash)}</dd></div>
</dl>
${day.length ? `<figure class="kinds"><figcaption>Entries in the last 24 hours, by kind</figcaption><ul>${day.map(([k, n]) => `<li><span>${esc(k)}</span><i style="--w:${Math.max(2, Math.round((n / most) * 100))}%"></i><b>${count(n)}</b></li>`).join('')}</ul></figure>` : '<p class="empty">No entry in the last 24 hours.</p>'}
</div>`;
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

/** The kernel check's line: the hash the API claims, the one recomputed here, the one this site's text holds. */
export function renderKernelCheck({ claimed, recomputed, pinned }) {
  const ok = claimed && claimed === recomputed && (!pinned || pinned === recomputed);
  const words = ok
    ? `Recomputed in your browser from the kernel's twelve articles: it matches the ledger${pinned ? ' and this site\'s text' : ''}.`
    : !claimed
      ? 'The kernel could not be read.'
      : claimed !== recomputed
        ? 'The kernel the API serves does not hash to the hash it claims.'
        : 'The ledger\'s kernel differs from the one this site renders.';
  return `<p class="check check--${ok ? 'ok' : 'bad'}"><span class="dot" aria-hidden="true"></span><span>${esc(words)}</span> ${hash(recomputed ?? claimed, 16)}</p>`;
}

// ─── the record page ────────────────────────────────────────────────────────

const STATUS = { open: 'Open', interpreting: 'Reading the responses', contest: 'Open to contest', deciding: 'Deciding', adopted: 'Adopted', rejected: 'Status quo kept' };

export function renderRfcTable(rfcs, now) {
  if (!rfcs.length) return `<p class="empty">No RFC has been opened. <a href="${esc(editorHref())}">Open the first one</a>.</p>`;
  return `<div class="table-wrap" tabindex="0"><table><thead><tr><th>RFC</th><th>Target</th><th>Status</th><th>Opened</th><th>Closes</th></tr></thead><tbody>${rfcs
    .map(r => `<tr><td><a href="${esc(rfcHref(r.id))}">${esc(r.title)}</a><br><code>${esc(r.id)}</code> · <a href="${esc(editorHref('rfc', r.id))}">${r.status === 'open' ? 'Respond' : 'In the editor'}</a></td><td>${esc(r.target)}</td><td>${esc(STATUS[r.status] ?? r.status)}${r.adopted ? ` (<code>${esc(r.adopted)}</code>)` : ''}</td><td>${time(r.openedAt, now)}</td><td>${time(r.closesAt, now)}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

const SCORES = ['−2', '−1', '0', '+1', '+2'];
const signed = n => (n > 0 ? `+${count(n)}` : n < 0 ? `−${count(-n)}` : '0');

/**
 * One RFC from `/public/contract/rfcs/:id/tally`. Before its responses are read the API sends the count and no score
 * (§ RFCs 4), and this says so; after, each option's score, its histogram from −2 to +2 and the unscored, then the
 * decision and the determinations it rests on.
 */
export function renderTally(v, now) {
  const head = `<header class="tally__head">
<p class="rfc__meta"><span class="tag">${esc(v.target)}</span><span class="tag">${esc(v.procedure === 'binding_score' ? 'binding score' : 'deliberative')}</span><span>${esc(STATUS[v.status] ?? v.status)}</span></p>
<h3>${esc(v.title)}</h3>
<p class="rfc__clock">${v.status === 'open' ? 'Closes' : 'Closed'} ${time(v.closesAt, now)} · opened ${time(v.openedAt, now)} · <code>${esc(v.id)}</code></p>
</header>`;
  const options = v.options.filter(o => o.id !== 'status_quo');
  if (!v.tally) {
    const act = v.status === 'open' ? ` <a class="btn small primary" href="${esc(editorHref('rfc', v.id))}">Respond</a>` : '';
    return `${head}<p class="tally__count"><b>${count(v.responses)}</b> confirmed response${v.responses === 1 ? '' : 's'} so far.</p>
<p class="note">The contract publishes the tally once the responses are read (§ RFCs 4). Until then nobody, the platform included, shows a score.${act}</p>
<ul class="options">${options.map(o => `<li><b>${esc(o.title)}</b>${o.summary ? ` <span>${esc(o.summary)}</span>` : ''}</li>`).join('')}</ul>`;
  }
  const t = v.tally;
  const rows = options
    .map(o => {
      const h = t.histogram[o.id] ?? [0, 0, 0, 0, 0];
      const most = Math.max(1, ...h);
      const bars = h.map((n, i) => `<li title="${esc(`${count(n)} at ${SCORES[i]}`)}"><i style="--h:${Math.round((n / most) * 100)}%"></i><span>${SCORES[i]}</span><b>${count(n)}</b></li>`).join('');
      const fav = t.favored === o.id ? ' <span class="verdict verdict--adopted">favored</span>' : '';
      return `<tr><td><b>${esc(o.title)}</b>${fav}<br><code>${esc(o.id)}</code></td><td class="num">${signed(t.scores[o.id] ?? 0)}</td><td><ol class="hist" aria-label="${esc(`How the ${count(t.respondents)} voices scored ${o.title}`)}">${bars}</ol></td><td class="num">${count(t.unscored[o.id] ?? 0)}</td></tr>`;
    })
    .join('');
  const d = v.decision;
  const decision = d
    ? `<div class="decision"><p><span class="verdict verdict--${d.adopted ? 'adopted' : 'kept'}">${d.adopted ? `Adopted: ${esc(v.options.find(o => o.id === d.adopted)?.title ?? d.adopted)}` : 'Status quo kept'}</span>${d.decidedAt ? ` <span class="note">${time(d.decidedAt, now)}</span>` : ''}</p>
<p>${esc(d.reason)}</p>
<dl class="facts"><div><dt>Decision</dt><dd>${hash(d.decisionHash, 16)}</dd></div><div><dt>Deposit</dt><dd>${d.depositReturned ? 'returned to the opener' : 'to the commons'}</dd></div>${d.participation ? `<div><dt>Participation</dt><dd>${count(d.participation.respondents)} respondents. ${esc(d.participation.representativeness)}</dd></div>` : ''}</dl>
${d.determinations.length ? `<ul class="dets">${d.determinations.map(x => `<li><code>${esc(x.kind)}</code> ${esc(x.outcome)}${x.label ? `: <b>${esc(x.label)}</b>` : ''}${x.tier ? ` at tier ${esc(x.tier)}` : ''} <a href="${esc(`${API}/public/contract/determinations/${encodeURIComponent(x.id)}`)}">its seats' answers</a></li>`).join('')}</ul>` : ''}</div>`
    : '<p class="note">Not decided yet.</p>';
  return `${head}<p class="tally__count"><b>${count(t.respondents)}</b> voice${t.respondents === 1 ? '' : 's'} read.${t.provisional ? ' A respondent may still contest how their response was read, so the scores may move.' : ''}</p>
<div class="table-wrap" tabindex="0"><table><thead><tr><th>Option</th><th>Score</th><th>Voices from −2 to +2</th><th>Unscored</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">Record digest ${hash(t.recordDigest, 16)}: the interpretations it sums are public at <a href="${esc(`${API}/public/contract/rfcs/${encodeURIComponent(v.id)}/record`)}">the RFC's record</a>, each voice as a pseudonym.</p>
${decision}`;
}

const pin = p => (p.kind === 'weights' ? `weights ${hash(p.sha256, 10)}` : `version <code>${esc(p.id)}</code>`);
const permille = n => (n === null || n === undefined ? '—' : `${(n / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);

function seatRows(seats) {
  return seats
    .map(s => `<tr><td><code>${esc(s.id)}</code><br>${esc(s.model)}</td><td>${esc(s.operator)}${s.upstream ? ` via ${esc(s.upstream)}` : ''}</td><td>${pin(s.pin)}</td><td>${esc(s.modalities.join(', '))}</td><td class="num">${s.measured ? `${count(s.measured.calls)} calls · ${permille(s.measured.errorUpperPermille)} wrong at most` : s.economics ? `${permille(s.economics.errorPermille)} wrong (${esc(s.economics.source === 'prior' ? 'prior' : 'measured')})` : '—'}</td></tr>`)
    .join('');
}

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
      return `<li><span class="verdict">${esc(j.stage ?? '')}</span> ${esc(j.dutyTitle ?? j.id)}${j.criminal ? ' (criminal)' : ''} · ${money(claimed)} claimed${last?.outcome ? ` · <b>${esc(last.outcome)}</b>` : ''}${last?.at ? ` <span class="note">${time(last.at, now)}</span>` : ''} <a href="${esc(editorHref('case', j.id))}">Follow</a></li>`;
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

/** The vital signs: the ledger's height and its last entry, the next close, the decisions of this week, the voices. */
export function renderVitals(s, now) {
  const next = s.rfcs.open[0];
  const week = s.rfcs.decided.filter(r => r.decidedAt && now - r.decidedAt <= WEEK_MS).length;
  const persons = sum(s.people.withVoice);
  const vital = (label, value, words, cls = '') => `<div class="vital${cls}"><dt>${esc(label)}</dt><dd><b>${value}</b><span>${words}</span></dd></div>`;
  return `<dl class="vitals">${[
    vital('Ledger height', count(s.log.length), s.log.headAt ? `last entry ${since(s.log.headAt, now)}` : 'no entry yet', ' vital--ledger'),
    vital('Open RFCs', count(s.rfcs.byStatus.open ?? 0), next ? `the next closes in ${until(next.closesAt, now)}` : 'none open: anyone may open one'),
    vital('Decided this week', count(week), week ? `RFC${week === 1 ? '' : 's'} decided in the last 7 days` : 'no RFC decided in the last 7 days'),
    vital('Voices', count(persons), `${count(s.voices.confirmed)} response${s.voices.confirmed === 1 ? '' : 's'} counted`),
  ].join('')}</dl>`;
}

/**
 * The commitment's seal, under the kernel check: the version in force, and whether the log's head is anchored on chain
 * (the last checkpoint, its transaction, how many of the recent ones held) or, if not, why not.
 */
export function renderAnchor(s, now) {
  const a = s.anchor;
  const ok = a.last?.status === 'anchored';
  const where = ok
    ? `Log entry ${count(a.last.seq)} is anchored on ${esc(a.last.cluster ?? 'chain')} ${since(a.last.at, now)}${a.last.tx ? ` <code title="${esc(a.last.tx)}">${esc(a.last.tx.slice(0, 10))}…</code>` : ''}.`
    : a.last
      ? `The log's head is not anchored on chain${a.key ? '' : `: ${esc(a.detail ?? 'no anchor key')}`}.`
      : 'No checkpoint yet.';
  const version = s.contract
    ? `Version ${count(s.contract.version)} in force since ${esc(date(s.contract.effectiveAt))}${s.contract.rfcId ? ` by RFC <a href="${esc(rfcHref(s.contract.rfcId))}"><code>${esc(s.contract.rfcId)}</code></a>` : ', the genesis'}.`
    : 'No version is in force.';
  return `<p class="check check--${ok ? 'ok' : 'wait'}"><span class="dot" aria-hidden="true"></span><span>${where} ${count(a.anchoredOfLast.anchored)} of the last ${count(a.anchoredOfLast.of)} checkpoints are anchored.</span></p><p class="seal__version">${version}</p>`;
}

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
  const href = e.rfcTitle ? rfcHref(e.subject) : e.kind.startsWith('intent.') ? 'index.html#machines' : 'record.html';
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

/** A servo stream (`records.jsonl`): the agent's steps, the number of goals, the simulator's states, the seals. */
export function parseServoRun(text) {
  const rows = String(text).split('\n').filter(Boolean).map(l => JSON.parse(l));
  const t0 = Date.parse(rows[0]?.t ?? 0);
  const ms = r => Date.parse(r.t) - t0;
  return {
    started: rows[0]?.t ?? null,
    durationMs: rows.length ? ms(rows.at(-1)) : 0,
    by: rows.find(r => r.by)?.by ?? null,
    goals: rows.filter(r => r.kind === 'command').length,
    steps: rows.filter(r => r.kind === 'note' && !/: send /.test(r.text)).map(r => ({ at: ms(r), text: String(r.text).replace(/^[^:]+:[^:]+: /, '') })),
    states: rows.filter(r => r.kind === 'state' && r.values).map(r => ({ at: ms(r), values: r.values })),
    seals: rows.filter(r => r.kind === 'seal').map(r => r.seal),
    simulated: rows.some(r => r.src === 'sim'),
    noGrant: rows.some(r => /simulated: no grant needed/.test(r.text ?? '')),
  };
}

/** The joints' paths over the run as one SVG (each joint on its own range), with a rule at each of the agent's steps. */
export function jointTrace(run, width = 640, height = 160) {
  if (run.states.length < 2) return '';
  const joints = Object.keys(run.states[0].values);
  const end = Math.max(1, run.states.at(-1).at);
  const x = at => ((at / end) * width).toFixed(1);
  const paths = joints.map((j, i) => {
    const vs = run.states.map(s => s.values[j]);
    const lo = Math.min(...vs), span = Math.max(...vs) - lo || 1;
    const d = run.states.map((s, k) => `${k ? 'L' : 'M'}${x(s.at)},${(height - 6 - ((s.values[j] - lo) / span) * (height - 12)).toFixed(1)}`).join('');
    return `<path class="trace trace--${i}" d="${d}"><title>${esc(j.replace(/_/g, ' '))}</title></path>`;
  });
  const marks = run.steps.filter(s => s.at > 0 && s.at < end).map(s => `<line class="trace__step" x1="${x(s.at)}" x2="${x(s.at)}" y1="0" y2="${height}"/>`);
  return `<svg class="traces" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(`The ${joints.length} joints over ${duration(end)}: ${joints.join(', ').replace(/_/g, ' ')}`)}" preserveAspectRatio="none">${marks.join('')}${paths.join('')}</svg>
<ul class="traces__key">${joints.map((j, i) => `<li><i class="trace--${i}"></i>${esc(j.replace(/_/g, ' '))}</li>`).join('')}</ul>`;
}

/** A recorded run as the site shows it: labelled a recording and its reality, its steps, its trace, its seals. */
export function renderRecording(run) {
  const seal = run.seals.at(-1);
  return `<p class="rec__label"><span class="badge badge--recorded">Recording</span><span class="tag">${run.simulated ? 'simulation' : 'physical'}</span><span>${run.started ? esc(date(Date.parse(run.started))) : ''} · ${esc(duration(run.durationMs))} · ${count(run.goals)} goals</span></p>
<ol class="rec__steps">${run.steps.map(s => `<li><span>${esc((s.at / 1000).toFixed(1))} s</span>${esc(s.text)}</li>`).join('')}</ol>
${jointTrace(run)}
<p class="note">Driven by <code>${esc(run.by ?? 'an agent')}</code>; each goal is recorded before the simulator gets it.${run.noGrant ? ' A simulated run needs no grant, and its record says so. A physical run needs a standing grant on the machine.' : ''}${seal ? ` Its ${count(run.seals.length)} seals are signed (${esc(seal.alg)}), and the last is bound to ${esc(seal.block?.chain ?? 'a chain')} slot ${count(seal.block?.slot)}.` : ''}</p>`;
}
