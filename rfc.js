// rfc.html?id=<rfc id>: one proposal. Anyone reads its options, clock, count or tally, and decision. A signed-in person
// with a voice answers it here: a port of the contract editor's RfcView, RespondPanel, MediaAttach and DeterminationView
// (CommandAGI packages/applets/contract/src/ui/), keeping their checks and their order: write, receipt, confirm the
// digest, then (after the close) how the response was read and the one contest.
//
// The render functions are pure (data in, escaped HTML out) for test/rfcs.test.mjs. The page code at the bottom runs only
// in rfc.html. Reads (shapes from api-worker routes/contract.ts and data/contract-rfcs.ts, data/contract-stats.ts):
//   GET  /public/contract/rfcs/:id          { rfc, status, responses, decision, decisionHash, concurrence, tally, myResponses: [], myExtraction: null }
//   GET  /contract/rfcs/:id                 the same, with this person's myResponses [{ id, digest, at, confirmedAt, parts }] and myExtraction
//   GET  /public/contract/rfcs/:id/tally    { …, tally: { respondents, scores, histogram, unscored, favored, recordDigest, provisional } | null,
//                                             decision: { adopted, reason, decidedAt, decisionHash, depositReturned, participation, determinations } | null }
//   GET  /public/contract/determinations/:id   one determination (rounds, answers, outcome)
//   GET  /contract/me, GET /contract/awaiting  the person's voice (or why none) and whether this proposal needs it anonymously
// Acts (contract-api.js): POST /contract/media, POST /contract/rfcs/:id/responses → { receipt: { id, digest } },
// POST /contract/rfcs/:id/responses/:rid/confirm { digest }, POST /contract/rfcs/:id/contest.
// Anonymous acts (anon.js, no session): a person whose identity on this device is in the tree this proposal pinned
// answers it only anonymously, proved in this browser: respond (with media), look up how it was read, contest.
import { esc, count, money, date, countdown } from './live.js';
import { words, describeLawChange, parameterValue, scoreKey, days } from './contract-words.js';
import { at, refusalText } from './rfcs.js';
import * as Anon from './anon.js';

const minus = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const short = (h, n = 12) => (h ? esc(String(h).slice(0, n)) : '—');
const when = ms => (ms ? esc(date(ms)) : '—');

// ─── the options ───────────────────────────────────────────────────────────

export const optionTitle = (rfc, id) => (id === 'status_quo' ? words('rfc')('statusQuo') : (rfc.options.find(o => o.id === id)?.title ?? id));

function changeLine(c) {
  const p = words('lawParams');
  try {
    return describeLawChange(c, words('changes'), p, (k, n) => parameterValue(k, n, money, p)) ?? 'A change this page cannot word.';
  } catch {
    return 'A change this page cannot word.';
  }
}

/** Each option, with what it would change in plain words (the editor's OptionList). */
export function renderOptions(options) {
  return `<ol class="opts">${options
    .map(o => {
      const title = `<p class="opt__title">${esc(o.id === 'status_quo' ? words('rfc')('statusQuo') : o.title)}<code>${esc(o.id)}</code></p>`;
      const summary = o.summary && o.id !== 'status_quo' ? `<p class="opt__sum">${esc(o.summary)}</p>` : '';
      const changes =
        o.target === 'law' ? `<ul>${(o.changes ?? []).map(c => `<li>${esc(changeLine(c))}</li>`).join('')}</ul>` : '';
      const engine =
        o.target === 'engine'
          ? `<details><summary>${esc(words('rfc')('engineOption', { name: o.engine?.name ?? '' }))}</summary><pre>${esc(JSON.stringify(o.engine, null, 2))}</pre></details>`
          : '';
      return `<li>${title}${summary}${changes}${engine}</li>`;
    })
    .join('')}</ol>`;
}

// ─── the head and the facts ────────────────────────────────────────────────

export const isOpen = (v, now) => v.status === 'open' && now < v.rfc.closesAt;

const STATUS = { open: ['Open', 'open'], interpreting: ['Being read', ''], contest: ['Open to contest', ''], deciding: ['Deciding', ''], adopted: ['Adopted', 'done'], rejected: ['Status quo kept', ''] };
export const statusOf = (v, now) => (v.status === 'open' && !isOpen(v, now) ? ['Closed, waiting to be read', ''] : (STATUS[v.status] ?? [v.status, '']));

export function renderHead(v, now) {
  const [label, tone] = statusOf(v, now);
  const r = v.rfc;
  const line =
    isOpen(v, now)
      ? `A proposal to change the ${r.target === 'engine' ? 'engine' : 'law'}. It closes in ${esc(countdown(r.closesAt - now))}, on ${when(r.closesAt)}.`
      : `A proposal to change the ${r.target === 'engine' ? 'engine' : 'law'}. It closed on ${when(r.closesAt)}.`;
  return `<header class="desk__head"><div><h1>${esc(r.title)}</h1><p>${line}</p></div><div><span class="state${tone ? ` state--${tone}` : ''}">${esc(label)}</span></div></header>`;
}

export function renderFacts(v, now) {
  const r = v.rfc;
  const open = isOpen(v, now);
  const t = words('rfc');
  const answers = open
    ? `${count(v.responses)} confirmed so far. This is a count only: nobody shows a score before the responses are read.`
    : `${count(v.responses)} confirmed`;
  return `<dl class="kv">
<dt>Changes</dt><dd>${r.target === 'engine' ? 'The engine that reads the answers' : 'The law'}</dd>
<dt>Procedure</dt><dd>${r.procedure === 'binding_score' ? 'Binding score: the tally decides, if the engine concurs.' : 'Deliberative: scores describe the comments and do not bind.'}</dd>
<dt>Opened</dt><dd>${when(r.openedAt)}</dd>
<dt>Closes</dt><dd>${when(r.closesAt)}</dd>
<dt>Responses</dt><dd>${esc(answers)}</dd>
<dt>Contest window</dt><dd>${esc(count(days(r.contestMs)))} days after a reading is shown</dd>
<dt>Who may respond</dt><dd>${esc((r.people ?? []).join(', ') || 'no kind of person')}</dd>
<dt>Began under</dt><dd class="fact-mono">${esc(`contract version ${r.contractVersion} · engine ${String(r.engineHash ?? '').slice(0, 12)} · state ${String(r.baseStateHash ?? '').slice(0, 12)}`)}</dd>
<dt>Proposal</dt><dd class="fact-mono">${esc(r.id)}</dd>
</dl>`;
}

// ─── the tally and the decision ────────────────────────────────────────────

/** The count before the reading, or the tally with each option's histogram after it. */
export function renderTally(v, now) {
  const t = words('rfc');
  const note = esc(t(v.rfc.procedure === 'deliberative' ? 'deliberativeNote' : 'tallyNote'));
  if (!v.tally) {
    return `<p class="sentence"><b>${count(v.responses)}</b> confirmed response${v.responses === 1 ? '' : 's'} so far.</p>
<p class="note">${esc(t('noTallyWhileOpen'))} The contract publishes the tally once the responses are read (§ RFCs 4). Until then nobody, the platform included, shows a score.</p>
<p class="note">${note}</p>`;
  }
  const tl = v.tally;
  const SC = ['−2', '−1', '0', '+1', '+2'];
  const rows = Object.keys(tl.scores)
    .map(id => {
      const h = tl.histogram[id] ?? [0, 0, 0, 0, 0];
      const most = Math.max(1, ...h);
      const bars = h.map((n, i) => `<li title="${esc(`${count(n)} at ${SC[i]}`)}"><i style="--h:${Math.round((n / most) * 100)}%"></i><span>${SC[i]}</span><b>${count(n)}</b></li>`).join('');
      const fav = tl.favored === id ? ' <span class="verdict verdict--adopted">favored</span>' : '';
      return `<tr><td><b>${esc(optionTitle(v.rfc, id))}</b>${fav}<br><code>${esc(id)}</code></td><td class="num">${minus(tl.scores[id] ?? 0)}</td><td><ol class="hist" aria-label="${esc(`How the ${count(tl.respondents)} voices scored ${optionTitle(v.rfc, id)}`)}">${bars}</ol></td><td class="num">${count(tl.unscored?.[id] ?? 0)}</td></tr>`;
    })
    .join('');
  const prov = (tl.provisional ?? v.status === 'contest') ? ' A respondent may still contest how their response was read, so the scores may move.' : '';
  return `<p class="sentence"><b>${count(tl.respondents)}</b> voice${tl.respondents === 1 ? '' : 's'} read.${esc(prov)}</p>
<p class="note">${note}</p>
<div class="table-wrap" tabindex="0"><table class="sum"><thead><tr><th>Option</th><th class="num">Score</th><th>Voices from −2 to +2</th><th class="num">Unscored</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">${esc(tl.favored ? t('favored', { option: optionTitle(v.rfc, tl.favored) }) : t('noneFavored'))}</p>
<p class="note">Tally record <code title="${esc(tl.recordDigest)}">${short(tl.recordDigest, 16)}…</code>: the readings it sums are public at <a href="https://api.commandagi.com/public/contract/rfcs/${encodeURIComponent(v.rfc.id)}/record">the proposal's record</a>, each voice as a pseudonym.</p>`;
}

/** The decision with its reason and hash; empty before there is one. */
export function renderDecision(v, now) {
  const d = v.decision;
  if (!d) return '';
  const t = words('rfc');
  const verdict = d.adopted ? `Adopted: ${esc(optionTitle(v.rfc, d.adopted))}` : 'Status quo kept';
  return `<p class="sentence"><span class="verdict verdict--${d.adopted ? 'adopted' : 'kept'}">${verdict}</span>${d.decidedAt ? ` <span class="note">${when(d.decidedAt)}</span>` : ''}</p>
<p class="prose">${esc(d.reason)}</p>
<dl class="kv">
<dt>Deposit</dt><dd>${esc(d.depositReturned ? t('depositReturned') : t('depositKept'))}</dd>
${d.participation ? `<dt>Participation</dt><dd>${count(d.participation.respondents)} respondents. ${esc(d.participation.representativeness)}</dd>` : ''}
${d.decisionHash ? `<dt>Decision record</dt><dd class="fact-mono" title="${esc(d.decisionHash)}">${esc(d.decisionHash)}</dd>` : ''}
</dl>`;
}

/** Where the engine's concurrence stands (the editor's concurrence section); empty when the API sent none. */
export function renderConcurrence(v) {
  const p = v.concurrence;
  if (!p) return '';
  const t = words('rfc');
  // A decided proposal waits for nothing: when its outgoing engine was not asked (the status quo was kept), say nothing of it.
  const decided = v.status === 'adopted' || v.status === 'rejected';
  const lines = [
    ...(p.outgoing ? [t('outgoingAnswered')] : p.outgoingUnavailableSince ? [t('outgoingUnavailable', { since: date(p.outgoingUnavailableSince) })] : decided ? [] : [t('outgoingWaiting')]),
    ...(v.rfc.target === 'engine' ? (p.incoming ? [t('incomingAnswered')] : p.incomingUnavailableSince ? [t('incomingUnavailable', { since: date(p.incomingUnavailableSince) })] : decided ? [] : [t('incomingWaiting')]) : []),
    ...(p.fallback ? [t('fallback')] : []),
  ];
  return `<p class="note">${esc(t('concurrenceNote'))}</p><ul class="read">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
}

/** The determination ids a proposal rests on, in the order the editor lists them. */
export function determinationIds(v) {
  const p = v.concurrence ?? {};
  const d = v.decision ?? {};
  return [...new Set([p.deliberation, p.outgoing, p.incoming, p.grounds, d.deliberation, ...(d.concurrence ?? [])].filter(Boolean))];
}

/** One determination, round by round: which seats answered what and how the answers aggregated (DeterminationView). */
export function renderDetermination(d) {
  const t = words('determination');
  const o = d.outcome ?? {};
  const outcome =
    o.status === 'decided' && o.label !== null ? t('outcomeDecided', { label: o.label, tier: o.tier ?? 0, confidence: o.confidence }) : o.status === 'unresolved' ? t('outcomeUnresolved', { tier: o.tier ?? 0, confidence: o.confidence }) : t('outcomeUnavailable');
  const pref = (tier, seat) => {
    const pick = (tier === 2 || tier === 3 ? d.routing?.plan?.tiers?.[tier] : undefined)?.groups?.find(g => g.seat === seat);
    if (!pick || Object.keys(pick.preference ?? {}).length < 2) return '';
    return ` <span class="note">${esc(t('preference', { choices: Object.entries(pick.preference).map(([id, p]) => `${id} ${Math.round(p / 10)}%`).join(', ') }))}</span>`;
  };
  const routed = d.routing
    ? `<p class="note">${esc(d.routing.plan?.infeasible ? t('routedInfeasible') : t('routed', { start: d.routing.plan?.startTier, top: d.routing.plan?.maxTier, stakes: `$${((d.routing.input?.stakesMicroUsd ?? 0) / 1e6).toFixed(2)}` }))}${d.routing.input?.deadlineMs != null ? ` ${esc(t('routedDeadline', { ms: d.routing.input.deadlineMs }))}` : ''}</p>`
    : '';
  const rounds = (d.rounds ?? [])
    .map(
      r => `<li><b>${esc(t('tier', { tier: r.tier }))}</b> <span class="note">${esc(r.note)}</span><ul>${(r.answers ?? [])
        .map(a => `<li><code>${esc(a.seat)}</code> ${a.error ? esc(t('seatError', { error: a.error })) : esc(t('seatAnswer', { label: a.label ?? '', confidence: a.confidence }))}${typeof a.ms === 'number' ? ` <span class="note">${esc(t('seatMs', { ms: a.ms }))}</span>` : ''}${pref(r.tier, a.seat)}</li>`)
        .join('')}</ul><p class="note">${esc(r.aggregate ? (r.aggregate.label === null ? t('aggregateTie', { groups: r.aggregate.groups }) : t('aggregate', { label: r.aggregate.label, confidence: r.aggregate.confidence, groups: r.aggregate.groups })) : t('noAnswer'))}</p></li>`,
    )
    .join('');
  return `<details class="det" id="d-${esc(d.id)}"><summary><b>${esc(d.kind)}</b> <span class="note">${esc(outcome)}</span>${o.status === 'unresolved' ? ` <span class="state">${esc(t('unresolved'))}</span>` : ''}</summary><p class="mono">${esc(t('id', { id: d.id }))}</p><p class="mono">${esc(t('package', { digest: d.packageDigest }))}</p>${routed}<ol>${rounds}</ol></details>`;
}

// ─── the refusals ──────────────────────────────────────────────────────────

/** What the contract refused, in the catalog's words, with the route's own detail and the code beside it. */
export function renderRefusals(refusals) {
  if (!refusals?.length) return '';
  return `<div class="refusal" role="alert"><ul>${refusals.map(r => `<li>${esc(refusalText(r))}${r.detail ? ` <small>${esc(r.detail)}</small>` : ''} <code>${esc(r.code)}</code></li>`).join('')}</ul></div>`;
}

// ─── the person's part ─────────────────────────────────────────────────────

export const signInHref = id => `signin.html?next=${encodeURIComponent(`rfc.html?id=${encodeURIComponent(id)}`)}`;

const partLine = p => (p.type === 'text' ? esc(p.text) : esc(`${p.modality}: ${p.label ?? String(p.sha256).slice(0, 12)}`));

/** The person's earlier responses (the editor's `mine`): confirmed or not, and a button to confirm while it is open. */
export function renderMine(myResponses, open, pending) {
  if (!myResponses?.length) return '';
  const t = words('respond');
  return `<ul class="mine">${[...myResponses]
    .sort((a, b) => b.at - a.at)
    .map(
      r => `<li><span class="head"><span class="state state--${r.confirmedAt ? 'done' : 'open'}">${esc(r.confirmedAt ? t('confirmed') : t('unconfirmed'))}</span><span class="note">${when(r.confirmedAt ?? r.at)}</span><span class="digest">${short(r.digest, 16)}</span></span>${(r.parts ?? []).map(p => `<p class="text">${partLine(p)}</p>`).join('')}${
        open && !r.confirmedAt ? `<button class="btn small" type="button" data-act="confirm" data-id="${esc(r.id)}" data-digest="${esc(r.digest)}"${pending ? ' disabled' : ''}>${esc(t('confirm'))}</button>` : ''
      }</li>`,
    )
    .join('')}</ul>`;
}

/** How a closed proposal read the person's response, option by option, and the one contest (the editor's Interpretation). */
export function renderInterpretation(x, titles, now, pending, done) {
  const t = words('respond');
  const contestOpen = !x.contested && now <= x.contestUntil;
  return `<p>${esc(t('readAs'))}</p>
<ul class="read">${Object.entries(x.scores)
    .map(([id, s]) => `<li><span>${esc(titles[id] ?? id)}</span><span>${esc(t(`stance.${scoreKey(s)}`))} <span class="score">(${minus(s)} on a scale from −2 to +2)</span>${x.unscored?.[id] ? ` <span class="note">${esc(t(`unscored.${x.unscored[id]}`))}</span>` : ''}</span></li>`)
    .join('')}</ul>
<p class="note">${esc(t('available', { when: date(x.availableAt), until: date(x.contestUntil) }))}</p>
${
  x.contested
    ? `<p class="note">${esc(t('contested'))}</p>`
    : contestOpen
      ? `<div class="box"><p><b>What a contest does.</b> Your response is read again at the top tier, by seats that took no part in the first reading. You may contest once, until ${when(x.contestUntil)}. The new reading replaces this one.</p><div class="form__act"><button class="btn" type="button" data-act="contest"${pending ? ' disabled' : ''}>${esc(t('contest'))}</button></div></div>`
      : `<p class="note">The contest window closed on ${when(x.contestUntil)}.</p>`
}${done === 'contestSent' ? `<p class="done" role="status">${esc(t('contestSent'))}</p>` : ''}`;
}

/** The attached files, the attach button and its refusals (MediaAttach). Anonymously, each file is proved as it goes. */
export function renderMedia(media, uploading, refusals, anonymous = false) {
  const t = words('media');
  const hint = anonymous ? ' Each file is proved on this device before it is sent; its name is not sent.' : '';
  return `<div class="field"><span class="hint">${esc(t('note'))} Images and audio only; the law may admit fewer kinds.${hint}</span>${
    media.length
      ? `<ul class="parts">${media.map((p, i) => `<li><span>${esc(t(`modality.${p.modality}`))}</span><span>${esc(p.label ?? String(p.sha256).slice(0, 12))}</span><span class="digest">${short(p.sha256)}</span><button class="btn small link" type="button" data-act="remove" data-i="${i}">${esc(t('remove'))}</button></li>`).join('')}</ul>`
      : ''
  }<div class="form__act"><input id="resp-file" type="file" accept="image/*,audio/*" multiple hidden><button class="btn small" type="button" data-act="attach"${uploading ? ' disabled' : ''}>${esc(uploading ? t('uploading') : t('attach'))}</button></div>${renderRefusals(refusals)}</div>`;
}

const LOAD_FILE = `<input id="anon-file" type="file" accept=".identity,application/json" hidden>`;

/** The anonymous mode's banner: the badge, the size of the set the proof hides in, and what it means (anonBanner). */
const anonBanner = s => {
  const a = words('anonymity');
  return `<div class="box box--sun"><p><span class="state state--open">${esc(a('modeBadge'))}</span> <span class="note">${esc(a('setSize', { size: s.tree?.size ?? 0 }))}</span></p><p>${esc(a('modeNote'))}</p></div>`;
};

/** The line an anonymous act says while it runs (the page sets it step by step; it is empty between acts). */
const stepLine = s => `<p class="note" role="status" data-slot="step">${esc(s.step ?? '')}</p>`;

/**
 * The panel when this device's identity is in the tree this proposal pinned (the editor's anonymous RespondPanel): while
 * open, write, attach, choose when to send, prove and send; the receipt names the voice (the nullifier). After the close,
 * look up how the response was read, under a proof, and contest it once.
 */
export function renderAnonymousPanel(s) {
  const t = words('respond');
  const a = words('anonymity');
  if (s.open) {
    const empty = !String(s.text).trim() && !s.media.length;
    const delay = ['none', 'minutes', 'hour'].map(k => `<option value="${k}"${s.delay === k ? ' selected' : ''}>${esc(a(`delay.${k}`))}</option>`).join('');
    return `<div class="panel">
${anonBanner(s)}
<p>${esc(a('respondNote'))}</p>
<div class="field"><label for="resp-text">${esc(t('label'))}</label><textarea id="resp-text" rows="6" placeholder="${esc(t('placeholder'))}">${esc(s.text)}</textarea></div>
${renderMedia(s.media, s.uploading, s.mediaRefusals, true)}
<div class="field"><label for="anon-delay">${esc(a('delayLabel'))}</label><select id="anon-delay">${delay}</select><span class="hint">${esc(a('ruleLinkability'))}</span></div>
<div class="form__act"><button class="btn primary" type="button" data-act="anon-send"${s.pending || s.uploading || empty ? ' disabled' : ''}>${esc(a('submit'))}</button><span class="note">The proof is made on this device first, in a few seconds. It counts at once: there is no separate confirmation. A later answer replaces it until the proposal closes.</span></div>
${stepLine(s)}
${s.done ? `<p class="done" role="status">${esc(a(`status.${s.done}`))}</p>` : ''}
${
  s.anonReceipt
    ? `<div class="box box--sun"><p><b>${esc(a('receiptTitle'))}</b></p><p class="digest">${esc(t('receiptDigest', { digest: s.anonReceipt.digest }))}</p><p class="digest">${esc(a('nullifier', { nullifier: s.anonReceipt.nullifier }))}</p><p>${esc(a('receiptNote'))}</p></div>`
    : ''
}
${renderRefusals(s.refusals)}</div>`;
  }
  const x = s.lookup?.interpretation ?? null;
  const body = !s.lookup
    ? `<p>Your response, if you sent one, is found by a proof made on this device. Nothing sent says which member of the set you are.</p><div class="form__act"><button class="btn" type="button" data-act="anon-lookup"${s.pending ? ' disabled' : ''}>${esc(a('lookup'))}</button></div>`
    : !x
      ? `<p>${esc(t(s.lookup.responses?.length ? 'notInterpretedYet' : 'noResponse'))}</p>${renderMine((s.lookup.responses ?? []).map(r => ({ ...r, at: r.receivedAt, confirmedAt: r.receivedAt })), false, s.pending)}`
      : renderInterpretation(x, s.titles, s.now, s.pending, s.done);
  return `<div class="panel">${anonBanner(s)}${body}${stepLine(s)}${renderRefusals(s.refusals)}</div>`;
}

/**
 * The response panel, by who is looking (the editor's RespondPanel order): an identity on this device that is in the
 * pinned tree answers anonymously, signed in or not; a visitor signs in; a person with no voice is told why; a voice that
 * answers only anonymously, on a device without its identity, is asked for the identity file; otherwise, while open,
 * write, receipt, confirm; after the close, how it was read and the contest.
 */
export function renderPanel(s) {
  const t = words('respond');
  const id = s.rfc.id;
  const open = s.open;
  if (s.anonMode) return renderAnonymousPanel(s);
  if (!s.signedIn) {
    return open
      ? `<div class="panel"><p>Only a person with a voice may respond. Sign in with your CommandAGI account; if you have no voice yet, your desk shows how to get one.</p><div class="form__act"><a class="btn primary" href="${esc(signInHref(id))}">Sign in to respond</a></div></div>`
      : `<div class="panel"><p>This proposal no longer takes responses. Sign in to see whether you answered it and how it was read.</p><div class="form__act"><a class="btn" href="${esc(signInHref(id))}">Sign in</a></div></div>`;
  }
  if (s.meFailed) return '<div class="panel"><p class="refusal">Your voice could not be read just now. Reload the page to try again.</p></div>';
  if (!s.voice) {
    return `<div class="panel"><p><b>You cannot respond yet.</b> ${s.why ? esc(refusalText({ code: s.why })) : 'The contract does not know a voice for this account.'}</p><p class="note">A voice is what lets a person answer once, as one person. It is obtained at your desk.</p><div class="form__act"><a class="btn" href="desk.html">Go to your desk</a></div></div>`;
  }
  if (s.anonymous && open) {
    const other = s.commitment ? ` It holds another identity (commitment <code>${esc(s.commitment.slice(0, 16))}…</code>).` : '';
    return `<div class="panel"><div class="box box--sun"><p><b>${esc(words('anonymity')('modeBadge'))}.</b> Your identity was registered when this proposal opened, so you answer it anonymously, and only so.</p>${
      s.treeFailed
        ? `<p class="refusal">This proposal’s anonymity set could not be read just now. Reload the page to try again.</p>`
        : `<p>This device does not hold that identity.${other} Load the identity file you saved. It stays on this device.</p><div class="form__act"><button class="btn primary" type="button" data-act="anon-load"${s.pending ? ' disabled' : ''}>Load an identity file</button>${LOAD_FILE}</div>`
    }<p class="note">${esc(Anon.DEVICE_ONLY)}</p></div>${renderRefusals(s.refusals)}</div>`;
  }
  if (open) {
    const mediaPart = renderMedia(s.media, s.uploading, s.mediaRefusals);
    const empty = !String(s.text).trim() && !s.media.length;
    return `<div class="panel">
<p>${esc(t('note'))}</p>
<div class="field"><label for="resp-text">${esc(t('label'))}</label><textarea id="resp-text" rows="6" placeholder="${esc(t('placeholder'))}">${esc(s.text)}</textarea></div>
${mediaPart}
<div class="form__act"><button class="btn primary" type="button" data-act="send"${s.pending || empty ? ' disabled' : ''}>${esc(t('submit'))}</button><span class="note">Sending gives you a receipt. It does not count yet.</span></div>
${s.done ? `<p class="done" role="status">${esc(t(s.done))}</p>` : ''}
${
  s.receipt
    ? `<div class="box box--sun"><p><b>${esc(t('receiptTitle'))}</b></p><p class="digest">${esc(t('receiptDigest', { digest: s.receipt.digest }))}</p><p>${esc(t('receiptNote'))}</p><p><b>Only a confirmed response counts.</b> A later confirmed response replaces an earlier one until the proposal closes, so you may confirm a better answer later.</p><div class="form__act"><button class="btn primary" type="button" data-act="confirm-receipt"${s.pending ? ' disabled' : ''}>${esc(t('confirm'))}</button></div></div>`
    : ''
}
${renderMine(s.myResponses.filter(r => !s.receipt || r.id !== s.receipt.id), true, s.pending)}
${renderRefusals(s.refusals)}</div>`;
  }
  // Closed.
  const mine = renderMine(s.myResponses, false, s.pending);
  const anonHint =
    !s.extraction && s.hasAnonymity
      ? `<p class="note">If you answered this proposal anonymously, load your identity file to look up how it was read. It stays on this device.</p><div class="form__act"><button class="btn small" type="button" data-act="anon-load"${s.pending ? ' disabled' : ''}>Load an identity file</button>${LOAD_FILE}</div>${renderRefusals(s.refusals)}`
      : '';
  if (!s.extraction) {
    return `<div class="panel"><p>${esc(t(s.myResponses.some(r => r.confirmedAt) ? 'notInterpretedYet' : 'noResponse'))}</p>${mine}${anonHint}</div>`;
  }
  return `<div class="panel">${renderInterpretation(s.extraction, s.titles, s.now, s.pending, s.done)}${renderRefusals(s.refusals)}</div>`;
}

/** The proposal as the page holds it, from the detail route and the public tally route. */
export function normalize(detail, tv) {
  const tally = tv?.tally ?? detail.tally ?? null;
  const decision = tv?.decision
    ? { ...tv.decision, concurrence: detail.decision?.concurrence ?? [], deliberation: detail.decision?.deliberation ?? null }
    : detail.decision
      ? { adopted: detail.decision.adopted, reason: detail.decision.reason, decidedAt: null, decisionHash: detail.decisionHash, depositReturned: detail.decision.depositReturned, participation: detail.decision.participation ?? null, concurrence: detail.decision.concurrence ?? [], deliberation: detail.decision.deliberation ?? null }
      : null;
  return { rfc: detail.rfc, status: detail.status, responses: detail.responses, concurrence: detail.concurrence ?? null, tally, decision, myResponses: detail.myResponses ?? [], myExtraction: detail.myExtraction ?? null };
}

/** A line for an id that names no proposal, or one that could not be read. */
export const renderMissing = (id, status) =>
  status === 404
    ? `<header class="desk__head"><div><h1>No such proposal</h1><p>${id ? `No proposal has the id <code>${esc(id)}</code>.` : 'This address names no proposal.'} It may have been mistyped.</p></div></header><p><a class="btn" href="rfcs.html">See every proposal</a></p>`
    : `<header class="desk__head"><div><h1>Proposal not reached</h1><p>The contract's API could not be reached, or it refused the read. Check your connection and reload.</p></div></header><p><a class="btn" href="rfcs.html">See every proposal</a></p>`;

// ─── the page ──────────────────────────────────────────────────────────────

async function start() {
  const { api, signedIn } = await import('./session.js');
  const A = await import('./contract-api.js');
  const root = document.querySelector('[data-slot="page"]');
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const get = async (path, anonymous) => {
    try {
      return { status: 200, data: await api(path, { anonymous }) };
    } catch (e) {
      return { status: e?.status ?? 0, data: null };
    }
  };
  if (!id) {
    root.innerHTML = renderMissing('', 404);
    root.removeAttribute('aria-busy');
    return;
  }
  const S = { text: '', media: [], receipt: null, refusals: [], mediaRefusals: [], done: null, pending: false, uploading: false, voice: null, why: null, meFailed: false, anonymous: false, tree: null, treeFailed: false, step: null, anonReceipt: null, lookup: null, delay: 'none' };
  let view = null;
  const dets = new Map();
  // The anonymous voice (anon.js). `rec` holds the identity's secret: it is never put in S, so no render sees it. The
  // prover loads only when an anonymous act starts.
  let rec = Anon.loadIdentity();
  let kind = 'human';
  const anonMode = () => Anon.inTree(rec, S.tree);

  const paintPanel = () => {
    const slot = document.querySelector('[data-slot="panel"]');
    if (!slot || !view) return;
    const now = Date.now();
    slot.innerHTML = renderPanel({
      ...S,
      rfc: view.rfc,
      now,
      open: isOpen(view, now),
      signedIn: signedIn(),
      commitment: rec?.commitment ?? null,
      anonMode: anonMode(),
      myResponses: view.myResponses,
      extraction: view.myExtraction,
      titles: Object.fromEntries(view.rfc.options.filter(o => o.id !== 'status_quo').map(o => [o.id, o.title])),
      hasAnonymity: Object.values(view.rfc.anonymity ?? {}).some(a => (a?.size ?? 0) > 0),
    });
  };
  const paint = () => {
    const now = Date.now();
    const concurrence = renderConcurrence(view);
    const decision = renderDecision(view, now);
    const det = [...dets.values()].map(renderDetermination).join('');
    root.innerHTML = `${renderHead(view, now)}
<div class="cols">
<div>
<section aria-labelledby="h-about"><h2 id="h-about">The proposal</h2><p class="prose">${esc(view.rfc.body)}</p></section>
<section aria-labelledby="h-options"><h2 id="h-options">Options</h2>${renderOptions(view.rfc.options)}</section>
<section aria-labelledby="h-you"><h2 id="h-you">Your response</h2><div data-slot="panel"></div></section>
</div>
<aside>
<section aria-labelledby="h-facts"><h2 id="h-facts">Facts</h2>${renderFacts(view, now)}</section>
</aside>
</div>
<section aria-labelledby="h-tally"><h2 id="h-tally">${view.tally ? 'Tally' : 'Responses'}</h2>${renderTally(view, now)}</section>
${decision ? `<section aria-labelledby="h-decision"><h2 id="h-decision">Decision</h2>${decision}</section>` : ''}
${concurrence || det ? `<section aria-labelledby="h-engine"><h2 id="h-engine">The engine's reasons</h2>${concurrence}${det ? `<p class="sentence">Each determination, round by round: which seats answered what.</p>${det}` : ''}</section>` : ''}`;
    root.removeAttribute('aria-busy');
    document.title = `${view.rfc.title} · VibeGov`;
    paintPanel();
  };

  async function load() {
    const authed = signedIn();
    const [d, t] = await Promise.all([get(authed ? `/contract/rfcs/${encodeURIComponent(id)}` : `/public/contract/rfcs/${encodeURIComponent(id)}`, !authed), get(`/public/contract/rfcs/${encodeURIComponent(id)}/tally`, true)]);
    if (!d.data) {
      root.innerHTML = renderMissing(id, d.status);
      root.removeAttribute('aria-busy');
      return false;
    }
    view = normalize(d.data, t.data);
    await Promise.all(determinationIds(view).filter(x => !dets.has(x)).map(async x => { const r = await get(`/public/contract/determinations/${encodeURIComponent(x)}`, true); if (r.data?.determination ?? r.data) dets.set(x, r.data.determination ?? r.data); }));
    return true;
  }
  async function loadVoice() {
    if (!signedIn()) return;
    const [me, aw] = await Promise.all([A.loadMe(), A.loadAwaiting()]);
    S.meFailed = !me;
    S.voice = me?.voice ?? null;
    S.why = me?.why ?? null;
    S.anonymous = !!aw?.rfcs?.find(r => r.id === id)?.anonymous;
  }

  /** Which tree this proposal pinned holds this device's identity; read only when there is an identity to look for. */
  async function loadTree() {
    S.tree = null;
    S.treeFailed = false;
    if (!rec || !Anon.anonymousKinds(view.rfc).length) return;
    const found = await Anon.findTree(rec, view.rfc, S.voice ? Anon.kindOf(S.voice) : null);
    S.tree = found.tree;
    S.treeFailed = !!found.failed;
    if (found.kind) kind = found.kind;
  }

  if (!(await load())) return;
  await loadVoice();
  await loadTree();
  paint();

  const refresh = async () => { if (await load()) { await loadVoice(); await loadTree(); paint(); } };
  const act = async run => {
    S.refusals = [];
    S.done = null;
    S.pending = true;
    paintPanel();
    const r = await run();
    S.pending = false;
    S.step = null;
    return r;
  };
  // Each step of a proof is said in the status line as it starts; the rest of the panel stays as it is.
  const onStep = (_key, line) => {
    S.step = line;
    const el = root.querySelector('[data-slot="step"]');
    if (el) el.textContent = line;
  };
  const anonOpts = () => ({ kind, onStep });
  root.addEventListener('input', e => {
    if (e.target.id !== 'resp-text') return;
    S.text = e.target.value;
    const send = root.querySelector('[data-act="send"], [data-act="anon-send"]');
    if (send) send.disabled = S.pending || S.uploading || (!S.text.trim() && !S.media.length);
  });
  root.addEventListener('change', async e => {
    if (e.target.id === 'anon-delay') {
      S.delay = e.target.value;
      return;
    }
    if (e.target.id === 'anon-file' && e.target.files?.[0]) {
      const file = e.target.files[0];
      const r = await act(() => Anon.loadIdentityFile(file));
      if (!r.ok) {
        S.refusals = r.refusals;
        return paintPanel();
      }
      rec = r.rec;
      await loadTree();
      return paintPanel();
    }
    if (e.target.id !== 'resp-file' || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const anonymous = anonMode();
    S.uploading = true;
    S.mediaRefusals = [];
    paintPanel();
    for (const f of files) {
      const r = anonymous ? await Anon.uploadMediaAnonymously(rec, view.rfc, f, anonOpts()) : await A.uploadMedia(f);
      if (r.ok) S.media.push({ ...r.part, label: f.name });
      else S.mediaRefusals.push(...r.refusals);
    }
    S.uploading = false;
    S.step = null;
    paintPanel();
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'attach') return root.querySelector('#resp-file')?.click();
    if (a === 'anon-load') return root.querySelector('#anon-file')?.click();
    if (a === 'anon-send') {
      const parts = [...(S.text.trim() ? [{ type: 'text', text: S.text.trim() }] : []), ...S.media];
      const r = await act(() => Anon.respondAnonymously(rec, view.rfc, parts, { ...anonOpts(), delay: Anon.delayMs(S.delay) }));
      if (r.ok) Object.assign(S, { anonReceipt: r.receipt, done: 'anonymousSent', text: '', media: [] });
      else S.refusals = r.refusals;
      return paintPanel();
    }
    if (a === 'anon-lookup' || (a === 'contest' && anonMode())) {
      const r = await act(async () => {
        if (a === 'contest') {
          const c = await Anon.contestAnonymously(rec, view.rfc, anonOpts());
          if (!c.ok) return c;
          S.done = 'contestSent';
        }
        return Anon.lookupAnonymously(rec, view.rfc, anonOpts());
      });
      if (r.ok) S.lookup = r.lookup;
      else S.refusals = r.refusals;
      return paintPanel();
    }
    if (a === 'remove') {
      S.media.splice(Number(b.dataset.i), 1);
      return paintPanel();
    }
    if (a === 'send') {
      const parts = [...(S.text.trim() ? [{ type: 'text', text: S.text.trim() }] : []), ...S.media];
      const r = await act(() => A.respondToRfc(id, parts));
      if (r.ok) S.receipt = r.receipt;
      else S.refusals = r.refusals;
      return r.ok ? refresh() : paintPanel();
    }
    if (a === 'confirm-receipt' || a === 'confirm') {
      const [rid, digest] = a === 'confirm-receipt' ? [S.receipt.id, S.receipt.digest] : [b.dataset.id, b.dataset.digest];
      const r = await act(() => A.confirmResponse(id, rid, digest));
      if (r.ok) {
        S.done = 'confirmedNow';
        if (a === 'confirm-receipt') Object.assign(S, { receipt: null, text: '', media: [] });
        return refresh();
      }
      S.refusals = r.refusals;
      return paintPanel();
    }
    if (a === 'contest') {
      const r = await act(() => A.contestInterpretation(id));
      if (r.ok) {
        S.done = 'contestSent';
        return refresh();
      }
      S.refusals = r.refusals;
      return paintPanel();
    }
  });
}

if (typeof document !== 'undefined' && document.body?.dataset.page === 'rfc') await start();
