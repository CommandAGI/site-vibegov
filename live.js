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
<p class="rfc__clock">Closes ${time(r.closesAt, now)} · opened ${time(r.openedAt, now)}</p>
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
