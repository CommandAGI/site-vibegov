// One case as a party sees it (redesign/APP.md § the pages, case.html?id=): a port of CommandAGI's contract editor's
// CaseView.tsx, CaseActions.tsx, MediaAttach.tsx and DeterminationView.tsx. Its parties see the record: the duty and its
// elements, where the case stands and until when, what each party submitted (media as the engine's renderers read
// it), each instance's panels and findings, the judgments with their elements, awards and remedies, the deposits and
// what execution did. Anyone else sees only the public projection (kernel k11). No human decides any of it.
//
// What each party may do is the editor's rule (`actsFor`): add evidence while the record is open (the respondent's
// answer carries their own figure per harm item), ask an interim freeze (the claimant), raise the stakes before the next
// hearing, and appeal once while the judgment is appealable. The contract refuses anything else and says why.
//
// Left out, as the workbench's own: stream windows (StreamAttach.tsx) and an agreement's leaves and intents
// (AgreementView.tsx). A stream's proven facts, once in the record, show as text.
import { esc, requireSignIn } from './session.js';
import { appealCase, raiseStakes, requestFreeze, submitEvidence, uploadMedia } from './contract-api.js';
import { centsOf, days, hasWords, stakesRaiseDeposit, words } from './contract-words.js';
import { date, duration, money } from './live.js';
import { art, keepTime, read, refusalsHtml, stageWords, unreachable, when as whenHtml } from './cases.js';

const t = words('cases');
const ca = words('caseActions');
const it = words('interests');
const rk = words('remedyKinds');
const out = words('outcomes');
const md = words('media');
const dt = words('determination');
const needs = words('needs');

/** The kernel's longest interim freeze (KERNEL_FLOORS.interimFreezeMaxMs): fourteen days (k8). */
const FREEZE_MAX_MS = 14 * 86_400_000;
const CLOSED = ['final', 'unprocessable', 'duplicate'];

/**
 * The catalog's words with values, escaped, where a value may be HTML (`{ html }`: a time that re-words itself). The
 * catalog's text and every plain value are text; only the page's own markup passes.
 */
export function say(fn, key, values = {}) {
  const html = [];
  const plain = Object.fromEntries(Object.entries(values).map(([k, v]) => (v && typeof v === 'object' && 'html' in v ? [k, `\u0001${html.push(v.html) - 1}\u0001`] : [k, v])));
  return esc(fn(key, plain)).replace(/\u0001(\d+)\u0001/g, (m, i) => html[Number(i)]);
}
const at = (ms, now) => ({ html: whenHtml(ms, now) });

/** What the claim puts at stake (core justice.ts `caseStakesCents`): the harm and the penalty asked, any bond exposure, or the raised floor. */
export function caseStakesCents(c) {
  const claimed = c.filing.harms.reduce((s, h) => s + h.amountCents, 0) + c.filing.relief.filter(r => r.kind === 'penalty').reduce((s, r) => s + (r.amountCents ?? 0), 0);
  return Math.max(claimed + (c.bondExposureCents ?? 0), c.stakesFloorCents ?? 0);
}

/** The money a freeze may hold at most (core `freezeFrom`): what the money remedies claim. */
export const claimedMoneyCents = c => c.filing.relief.filter(r => r.kind === 'restitution' || r.kind === 'compensation').reduce((s, r) => s + (r.amountCents ?? 0), 0);

/** The clock that runs for a party (the API's `caseClock`, data/contract-attention.ts). */
export function caseClock(c, role, now) {
  const stage = c.stage;
  if (stage === 'awaiting_response' && role === 'respondent') return { role, stage, act: 'answer', due: c.responseDue };
  if (stage === 'evidence') return { role, stage, act: 'evidence', due: c.evidenceDue };
  if (stage === 'decided' && !c.appealedBy && c.appealableUntil !== null && now <= c.appealableUntil) return { role, stage, act: 'appeal', due: c.appealableUntil };
  return { role, stage, act: 'wait', due: null };
}

/** The flags CaseView.tsx hands CaseActions.tsx, from a party's view of a case. */
export function flagsOf(view, now) {
  const c = view.case;
  return {
    role: view.role,
    stage: c.stage,
    appealable: c.stage === 'decided' && !c.appealedBy && (c.appealableUntil ?? 0) >= now,
    appealed: !!c.appealedBy,
    pendingInterim: !!view.pendingInterim,
    canRaiseStakes: c.instances.length === 0 || (c.stage === 'appealed' && c.instances.length === 1),
  };
}

/**
 * The acts a party has at a stage (CaseActions.tsx): `record` is 'answer', 'evidence' or 'closed'; `figures` when the
 * respondent gives their own figures; `freeze` 'form' or 'pending' (the claimant, until the case closes); `stakes`
 * before the next hearing starts; `appeal` 'form' while appealable, 'pending' once appealed.
 */
export function actsFor({ role, stage, appealable, appealed, pendingInterim, canRaiseStakes }) {
  const recordOpen = stage === 'awaiting_response' || stage === 'evidence' || (role === 'claimant' && (stage === 'screening' || stage === 'serving'));
  const closed = CLOSED.includes(stage);
  return {
    record: recordOpen ? (role === 'respondent' && stage === 'awaiting_response' ? 'answer' : 'evidence') : 'closed',
    figures: recordOpen && role === 'respondent',
    freeze: role === 'claimant' && !closed ? (pendingInterim ? 'pending' : 'form') : null,
    stakes: canRaiseStakes && !closed,
    appeal: appealed ? 'pending' : appealable ? 'form' : null,
  };
}

// ─── the record ──────────────────────────────────────────────────────────────

const OUTCOME_STATE = { liable: 'state--bad', not_liable: 'state--done' };
const party = p => (p === 'claimant' ? t('claimant') : t('respondent'));
const remedyLine = r =>
  `${rk(r.kind)} (${(r.harmIds ?? []).join(', ')})${r.description ? `: ${r.description}` : ''}${r.amountCents !== undefined ? ` · ${money(r.amountCents)}` : ''}${r.durationMs !== undefined ? ` · ${t('days', { n: days(r.durationMs) })}` : ''}`;

/** One judgment: its outcome, its reason, each element established or not, the awards with whose figure, the remedies. */
export function judgmentHtml(j, instance, now) {
  const elements = Object.entries(j.elements ?? {});
  const awards = Object.entries(j.awards ?? {});
  return `<div class="judgment"><p><span class="state ${OUTCOME_STATE[j.outcome] ?? ''}">${esc(hasWords('outcomes', j.outcome) ? out(j.outcome) : j.outcome)}</span> <span class="note">${say(t, instance === 2 ? 'appealJudgment' : 'firstJudgment', { when: at(j.at, now) })}</span></p>
${j.reason ? `<p>${esc(j.reason)}</p>` : ''}
${elements.length ? `<ul class="lines">${elements.map(([id, ok]) => `<li>${esc(t(ok ? 'elementEstablished' : 'elementNotEstablished', { id }))}</li>`).join('')}</ul>` : ''}
${awards.length ? `<ul class="lines">${awards.map(([id, a]) => `<li>${esc(t(a.figure === 'claimant' ? 'awardClaimant' : 'awardRespondent', { id, amount: money(a.cents) }))}</li>`).join('')}</ul>` : ''}
${(j.remedies ?? []).length ? `<ul class="lines">${j.remedies.map(r => `<li>${esc(remedyLine(r))}</li>`).join('')}</ul>` : ''}</div>`;
}

/** A part of a submission: text as text (never markup), a stream's proven facts, or media as its renderings. */
export function partHtml(p, renderings) {
  const stream = p.type === 'text' && p.label?.startsWith('stream ') ? p.label.slice('stream '.length) : null;
  if (stream !== null)
    return `<div class="media"><p>${esc(t('streamFacts', { stream }))}</p><p class="note">${esc(t('streamFactsNote'))}</p><p class="said"><code>${esc(p.text)}</code></p></div>`;
  if (p.type === 'text') return `<p class="said">${esc(p.text)}</p>`;
  const r = renderings?.[p.sha256];
  const head = `<p>${esc(t('mediaItem', { modality: hasWords('media', `modality.${p.modality}`) ? md(`modality.${p.modality}`) : p.modality, label: p.label ?? String(p.sha256).slice(0, 12) }))} <code title="${esc(p.sha256)}">${esc(String(p.sha256).slice(0, 12))}</code></p>`;
  if (!r) return `<div class="media">${head}<p class="note">${esc(t('notRendered'))}</p></div>`;
  return `<div class="media">${head}${r.ok ? '' : `<p class="warn">${esc(t('renderFailed'))}</p>`}<ul>${(r.by ?? [])
    .map(b => `<li><span class="seat">${esc(b.seat)}</span>${b.text ? `<span class="said">${esc(b.text)}</span>` : `<span class="bad">${esc(b.error ?? '')}</span>`}</li>`)
    .join('')}</ul></div>`;
}

function instanceHtml(inst, now) {
  const r = inst.routing;
  const routing = r?.plan
    ? `<p class="note">${esc(t('routingPlan', { start: r.plan.startTier, top: r.plan.maxTier, loss: money(r.plan.expectedLossMicroUsd / 10_000) }))}</p>${[2, 3]
        .map(tier => r.plan.tiers?.[tier] ? `<p class="note"><code>${esc(t('routingTier', { tier, quorum: r.plan.tiers[tier].quorum, seats: r.plan.tiers[tier].groups.map(g => g.seat).join(', ') }))}</code></p>` : '')
        .join('')}`
    : `<p class="note"><code>${esc(t('panels', { two: (inst.panels?.[2] ?? []).join(', ') || '—', three: (inst.panels?.[3] ?? []).join(', ') || '—' }))}</code></p>`;
  const findings = Object.entries(inst.findings ?? {});
  return `<div class="instance"><h3>${say(t, inst.n === 2 ? 'instanceAppeal' : 'instanceFirst', { tier: inst.startTier, when: at(inst.startedAt, now) })}</h3>${routing}
${inst.blockedSince ? `<p class="warn">${say(t, 'blocked', { since: at(inst.blockedSince, now) })}</p>` : ''}
${findings.length ? `<table class="findings"><tbody>${findings
    .map(([key, f]) => `<tr><td>${esc(key)}</td><td>${esc(f.status === 'decided' ? t('findingDecided', { label: f.label ?? '', tier: f.tier ?? 0, confidence: f.confidence }) : t(f.status === 'unresolved' ? 'findingUnresolved' : 'findingUnavailable'))}</td></tr>`)
    .join('')}</tbody></table>` : ''}</div>`;
}

/** One determination, round by round (DeterminationView.tsx): the record a person can check the contract against. */
export function determinationHtml(d) {
  const o = d.outcome ?? {};
  const outcome = o.status === 'decided' && o.label !== null ? dt('outcomeDecided', { label: o.label, tier: o.tier ?? 0, confidence: o.confidence }) : o.status === 'unresolved' ? dt('outcomeUnresolved', { tier: o.tier ?? 0, confidence: o.confidence }) : dt('outcomeUnavailable');
  const routed = d.routing
    ? `<p class="note">${esc(d.routing.plan?.infeasible ? dt('routedInfeasible') : dt('routed', { start: d.routing.plan?.startTier, top: d.routing.plan?.maxTier, stakes: `$${(d.routing.input.stakesMicroUsd / 1_000_000).toFixed(2)}` }))}${d.routing.input?.deadlineMs !== null && d.routing.input?.deadlineMs !== undefined ? esc(` ${dt('routedDeadline', { ms: d.routing.input.deadlineMs })}`) : ''}</p>`
    : '';
  return `<details class="determination" id="d-${esc(d.id)}"><summary><b>${esc(d.kind)}</b> <span class="note">${esc(outcome)}</span>${o.status === 'unresolved' ? ` <span class="state">${esc(dt('unresolved'))}</span>` : ''}</summary>
<p class="note"><code>${esc(dt('id', { id: d.id }))}</code><br><code>${esc(dt('package', { digest: d.packageDigest ?? '' }))}</code></p>${routed}
<ol>${(d.rounds ?? [])
    .map(r => `<li><b>${esc(dt('tier', { tier: r.tier }))}</b> <span class="note">${esc(r.note ?? '')}</span><ul class="lines">${(r.answers ?? [])
      .map(a => `<li><code>${esc(a.seat)}</code> ${a.error ? `<span class="bad">${esc(dt('seatError', { error: a.error }))}</span>` : esc(dt('seatAnswer', { label: a.label ?? '', confidence: a.confidence }))}${typeof a.ms === 'number' ? ` <span class="note">${esc(dt('seatMs', { ms: a.ms }))}</span>` : ''}</li>`)
      .join('')}</ul><p class="note">${esc(r.aggregate ? (r.aggregate.label === null ? dt('aggregateTie', { groups: r.aggregate.groups }) : dt('aggregate', { label: r.aggregate.label, confidence: r.aggregate.confidence, groups: r.aggregate.groups })) : dt('noAnswer'))}</p></li>`)
    .join('')}</ol></details>`;
}

const section = (id, title, body, article = '') => `<section aria-labelledby="${id}"><div class="part-head"><h2 id="${id}">${esc(title)}</h2>${article ? art(article) : ''}</div>${body}</section>`;

/** The head of a party's view: the act as its title, the parties, its states in words. */
function partyHead(view, now) {
  const c = view.case;
  const f = c.filing;
  const states = [
    `<span class="state">${esc(stageWords(c.stage))}</span>`,
    `<span class="state">${esc(f.criminal ? t('criminal') : t('civil'))}</span>`,
    `<span class="state state--yours">${esc(view.role === 'claimant' ? needs('roleClaimant') : needs('roleRespondent'))}</span>`,
    view.agreementId ? `<span class="state">${esc(t('agreement', { id: view.agreementId }))}</span>` : '',
    c.family !== c.id ? `<span class="state">${esc(t('reopening', { id: String(c.family).slice(0, 12) }))}</span>` : '',
    c.expedited ? `<span class="state">${esc(t('expedited'))}</span>` : '',
  ].join('');
  return `<header class="desk__head"><div><p class="ref-line">Case <span title="${esc(c.id)}">${esc(c.id)}</span></p><h1 class="case-title">${esc(f.act.description)}</h1><p class="parties">${esc(t('parties', { claimant: f.claimant, respondent: f.respondent }))}</p>${f.filedFor ? `<p class="note">${esc(t('filedFor', { person: f.filedFor }))}</p>` : ''}<div class="states">${states}</div></div><a class="btn small quiet" href="cases.html">All cases</a></header>`;
}

/** Where the case stands and until when: the editor's lines, in the catalog's words. */
function standsHtml(view, now) {
  const c = view.case;
  const clock = caseClock(c, view.role, now);
  const runs = clock.act === 'answer' ? say(needs, 'caseAnswer', { when: at(clock.due, now) }) : clock.act === 'evidence' ? say(needs, 'caseEvidence', { when: at(clock.due, now) }) : clock.act === 'appeal' ? say(needs, 'caseAppeal', { when: at(clock.due, now) }) : say(needs, 'caseWait', { stage: stageWords(c.stage) });
  const lines = [
    say(t, 'filed', { when: at(c.filedAt, now) }),
    c.servedAt ? say(t, 'served', { when: at(c.servedAt, now) }) : esc(t('notServed')),
    c.responseDue ? say(t, 'responseDue', { when: at(c.responseDue, now) }) : '',
    c.evidenceDue ? say(t, 'evidenceDue', { when: at(c.evidenceDue, now) }) : '',
    c.appealableUntil ? say(t, 'appealableUntil', { when: at(c.appealableUntil, now) }) : '',
    c.appealedBy ? esc(t('appealedBy', { party: party(c.appealedBy) })) : '',
    c.closedReason ? esc(t('closed', { reason: c.closedReason })) : '',
    esc(t('stakes', { amount: money(caseStakesCents(c)) })),
    esc(t('deposits', { claimant: money(c.deposits.claimant), respondent: money(c.deposits.respondent), costs: money(c.costCents) })),
  ].filter(Boolean);
  return `<p class="${clock.act === 'wait' ? 'note' : 'warn'}"><b>${runs.charAt(0).toUpperCase()}${runs.slice(1)}</b></p><ul class="lines">${lines.map(l => `<li>${l}</li>`).join('')}</ul><p class="note">${esc(t('noHuman'))}</p>`;
}

/** Everything a party reads of a case but the acts. */
export function partyRecordHtml(view, now) {
  const c = view.case;
  const f = c.filing;
  const exec = view.execution;
  const plan = exec?.plan ?? null;
  return [
    section('duty-title', 'The duty', `<h3>${esc(c.duty.title)}</h3>${c.duty.text ? `<p>${esc(c.duty.text)}</p>` : ''}<p class="note">${art('k7')} Each element is decided on its own; the claimant bears the burden of every one.</p><ul class="lines">${c.duty.elements.map(e => `<li><code>${esc(e.id)}</code>: ${esc(e.text)}</li>`).join('')}</ul>`, 'k6'),
    section('claim-title', 'The claim', `<p>${esc(t('act', { description: f.act.description, when: date(f.act.at) }))}</p><ul class="lines">${f.harms.map(h => `<li>${esc(t('harmLine', { id: h.id, interest: hasWords('interests', h.interest) ? it(h.interest) : h.interest, description: h.description, amount: money(h.amountCents) }))}</li>`).join('')}</ul>`, 'k6'),
    section('relief-title', t('reliefTitle'), `<ul class="lines">${f.relief.map(r => `<li>${esc(remedyLine(r))}</li>`).join('')}</ul>`, 'k8'),
    section('record-title', t('submissionsTitle'), c.submissions.length
      ? `<p class="note">The record both parties and the deciding seats read. It is never public (k11). A file is kept by the contract under its sha256; what is shown here is what its renderers wrote, which is what the seats read.</p><ol class="record">${c.submissions
          .map(s => `<li><p class="by">${say(t, 'submittedBy', { party: party(s.party), when: at(s.at, now) })}</p>${s.counter ? `<p>${esc(t('counter', { figures: Object.entries(s.counter).map(([id, v]) => `${id}: ${money(v)}`).join(', ') }))}</p>` : ''}${s.parts.map(p => partHtml(p, view.renderings)).join('')}</li>`)
          .join('')}</ol>`
      : '<p class="empty">Nothing has been submitted yet.</p>', 'k7'),
    section('deciding-title', t('instancesTitle'), `${c.instances.length === 0 ? `<p class="empty">${esc(t('noInstance'))}</p>` : c.instances.map(inst => `${instanceHtml(inst, now)}${inst.judgment ? judgmentHtml(inst.judgment, inst.n, now) : ''}`).join('')}${(view.determinations ?? []).length ? `<h3 class="sub">Determinations</h3>${view.determinations.map(determinationHtml).join('')}` : ''}`, 'k7'),
    exec ? section('exec-title', t('executionTitle'), `${exec.verdict ? `<p>${esc(t('agreementSettled', { verdict: exec.verdict }))}</p>` : ''}${plan ? `<p>${esc(t('executionLine', { due: money(Number(plan.dueCents ?? 0)), collected: money(Number(plan.collectedCents ?? 0)), shortfall: money(Number(exec.poolClaimCents ?? 0)), payer: String(plan.costPayer ?? '') }))}</p>` : ''}`, 'k9') : '',
  ].join('');
}

// ─── the acts ────────────────────────────────────────────────────────────────

const terms = items => `<ul class="terms">${items.filter(Boolean).map(([a, s]) => `<li>${art(a)}<span>${s}</span></li>`).join('')}</ul>`;
const button = (label, disabled, more = '') => `<button class="btn${more}" type="submit"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;

/** The figures typed by the respondent as `counter` (cents), or undefined when none (CaseActions.tsx `counter`). */
export function counterOf(figures) {
  const o = {};
  for (const [id, v] of Object.entries(figures)) {
    const c = centsOf(v);
    if (v.trim() && c !== null) o[id] = c;
  }
  return Object.keys(o).length ? o : undefined;
}
const badFigure = figures => Object.values(figures).some(v => v.trim() && centsOf(v) === null);
/** A raise must be above what is at stake now (the core refuses `not_higher`, which the catalog does not word). */
const canRaise = (ui, current) => !ui.pending && (centsOf(ui.floor) ?? 0) > current;
const canSubmit = ui => !ui.pending && !badFigure(ui.figures) && (!!ui.evidence.trim() || ui.media.length > 0 || !!counterOf(ui.figures));

/** What a raise of the stakes to the typed floor would take, in words, or what is wrong with the floor. */
export function stakesWords(current, floorText, bps) {
  const floor = centsOf(floorText);
  if (!floorText.trim()) return `At stake now: ${money(current)}. Give a higher floor to see the deposit it takes.`;
  if (floor === null) return 'Give the floor in dollars, as 1500 or 1500.00.';
  if (floor <= current) return `The floor must be higher than what is at stake now, ${money(current)}.`;
  if (typeof bps !== 'number') return `Raising the stakes from ${money(current)} to ${money(floor)} takes a deposit of the law’s share of the difference.`;
  return `Raising the stakes from ${money(current)} to ${money(floor)} takes a deposit of ${money(stakesRaiseDeposit(current, floor, bps))} from your balance now (${bps / 100}% of the difference). The side that loses pays it.`;
}

/** The acts block of a party (CaseActions.tsx), with `ui` the page's state: typed values, pending, done, refusals. */
export function actionsHtml(view, law, ui, now) {
  const c = view.case;
  const fl = flagsOf(view, now);
  const a = actsFor(fl);
  const blocks = [];

  if (a.record === 'closed') blocks.push(`<p class="note">${esc(ca('recordClosed'))}</p>`);
  else {
    const answer = a.record === 'answer';
    const clock = answer
      ? ['k7', `${say(t, 'responseDue', { when: at(c.responseDue, now) })}. Your answer moves the case to evidence; the record then stays open until ${c.evidenceDue ? whenHtml(c.evidenceDue, now) : 'the law’s time runs out'}.`]
      : c.stage === 'screening' || c.stage === 'serving'
        ? ['k6', esc('The respondent has not been served yet. What you add now is in the record they will be served with.')]
        : ['k7', c.evidenceDue ? `${say(t, 'evidenceDue', { when: at(c.evidenceDue, now) })}. Then the seats decide on the record as it stands.` : esc('Then the seats decide on the record as it stands.')];
    const figures = a.figures
      ? `<div class="field"><p class="hint">${esc(ca('figuresNote'))}</p><div class="offers">${c.filing.harms
          .map(h => `<div class="offer"><label for="fig-${esc(h.id)}"><code>${esc(h.id)}</code></label><input id="fig-${esc(h.id)}" data-figure="${esc(h.id)}" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${esc(ui.figures[h.id] ?? '')}" aria-label="${esc(ca('figureFor', { id: h.id }))}"${centsOf(ui.figures[h.id] ?? '') === null && (ui.figures[h.id] ?? '').trim() ? ' aria-invalid="true"' : ''}><p class="hint">${esc(`Claimed ${money(h.amountCents)}`)}</p></div>`)
          .join('')}</div></div>`
      : '';
    blocks.push(`<form class="act" data-act="evidence" novalidate><h3>${esc(answer ? ca('answer') : ca('addEvidence'))}${art('k7')}</h3>
<div class="field"><label for="ev-text">${esc(ca('evidenceLabel'))}</label><textarea id="ev-text" data-ui="evidence" rows="5">${esc(ui.evidence)}</textarea></div>
<div class="field"><span class="hint">${esc(md('note'))}</span>${ui.media.length ? `<ul class="attached">${ui.media.map((m, i) => `<li><span>${esc(md(`modality.${m.modality}`))}</span><span>${esc(m.label ?? m.sha256.slice(0, 12))}</span><code>${esc(m.sha256.slice(0, 12))}</code><button class="btn small quiet" type="button" data-do="remove-media" data-i="${i}">${esc(md('remove'))}</button></li>`).join('')}</ul>` : ''}
<div class="attach-row"><label class="btn small" for="ev-media">${esc(ui.uploading ? md('uploading') : md('attach'))}</label><input class="vh" id="ev-media" type="file" accept="image/*,audio/*" multiple${ui.uploading || ui.pending ? ' disabled' : ''}></div>${refusalsHtml(ui.mediaRefusals)}</div>
${figures}
${terms([clock, ['k11', esc('What you submit joins the record. Both parties and the deciding seats read it; it is never public.')], a.figures ? ['k7', esc('Your figure for a harm item is a final offer. For each item the engine takes whichever figure, yours or the claimant’s, is closer to the loss the record proves. Your latest figure counts. An item you give no figure for counts as 0 for you.')] : null])}
<div class="form__act">${button(ca('submit'), !canSubmit(ui), ' primary')}</div></form>`);
  }

  if (a.freeze === 'pending') blocks.push(`<p class="note">${esc(ca('freezePending'))}</p>`);
  if (a.freeze === 'form') {
    const max = claimedMoneyCents(c);
    const days14 = Math.min(typeof law.interimFreezeMs === 'number' ? law.interimFreezeMs : FREEZE_MAX_MS, FREEZE_MAX_MS);
    blocks.push(`<form class="act" data-act="freeze" novalidate><h3>${esc(ca('freezeTitle'))}${art('k8')}</h3><p>${esc(ca('freezeNote'))}</p>
${terms([['k8', esc(`At most the money you claim: ${money(max)}. A larger amount is held only up to that. The freeze lasts at most ${duration(days14)}.`)], ['k8', esc('The engine decides it on the record as it stands. The respondent’s money is held, not taken, and returns when the freeze ends. Asking takes no deposit.')]])}
<div class="inline"><div class="field"><label for="freeze-amount">${esc(ca('freezeAmount'))}</label><input id="freeze-amount" data-ui="freeze" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${esc(ui.freeze)}"></div>${button(ca('freeze'), ui.pending || !centsOf(ui.freeze))}</div></form>`);
  }

  if (a.stakes) {
    const current = caseStakesCents(c);
    blocks.push(`<form class="act" data-act="stakes" novalidate><h3>${esc(ca('stakesTitle'))}${art('k7')}</h3><p>${esc(ca('stakesNote'))}</p>
${terms([['k7', `<span data-deposit>${esc(stakesWords(current, ui.floor, law.stakesRaiseDepositBps))}</span>`]])}
<div class="inline"><div class="field"><label for="stakes-floor">${esc(ca('stakesAmount'))}</label><input id="stakes-floor" data-ui="floor" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${esc(ui.floor)}"></div>${button(ca('raiseStakes'), !canRaise(ui, current))}</div></form>`);
  }

  if (a.appeal === 'pending') blocks.push(`<p class="note">${esc(c.appealedBy === view.role ? ca('appealPending') : t('appealedBy', { party: party(c.appealedBy) }))} A fresh panel of seats that took no part hears it; its judgment is final.</p>`);
  if (a.appeal === 'form')
    blocks.push(`<form class="act" data-act="appeal" novalidate><h3>${esc(ca('appeal'))}${art('k7')}</h3><p>${esc(ca('appealNote'))}</p>
${terms([
  ['k7', `Once only, and only until ${whenHtml(c.appealableUntil, now)}. A fresh panel of top-tier seats that took no part in this case hears it, on the same record. <b>Its judgment is final.</b>`],
  ['k7', esc(`The appeal holds a cost deposit${typeof law.caseDepositCents === 'number' ? ` of ${money(law.caseDepositCents)}` : ''} from your balance, as far as it goes: it is never refused for want of money. A timely appeal stays execution.`)],
])}
<div class="form__act">${button(ca('appeal'), ui.pending, ' primary')}</div></form>`);

  // What was done, or refused, stands above the acts, where the person who just pressed a button sees it.
  return `${ui.done ? `<p class="done" role="status">${esc(ca(ui.done))}</p>` : ''}${refusalsHtml(ui.refusals)}<div class="acts-list">${blocks.join('')}</div>`;
}

/** A party's whole page. */
export function partyHtml(view, law, ui, now) {
  return `${partyHead(view, now)}${section('stands-title', 'Where it stands', standsHtml(view, now))}${section('acts-title', t('actionsTitle'), actionsHtml(view, law, ui, now))}${partyRecordHtml(view, now)}`;
}

/** Anyone else's view: the public projection only (k11), and why. */
export function publicHtml(pc, now) {
  return `<header class="desk__head"><div><p class="ref-line">Case <span title="${esc(pc.id)}">${esc(pc.id)}</span></p><h1 class="case-title">${esc(t('publicTitle', { claimant: pc.claimant, respondent: pc.respondent }))}</h1><div class="states"><span class="state">${esc(stageWords(pc.stage))}</span><span class="state">${esc(pc.criminal ? t('criminal') : t('civil'))}</span></div></div><a class="btn small quiet" href="cases.html">All cases</a></header>
${section('public-title', 'The public record', `<p class="warn"><b>You are not a party to this case.</b> ${esc(t('publicNote'))}</p>${pc.dutyTitle ? `<h3>${esc(pc.dutyTitle)}</h3>` : ''}<ul class="lines">${(pc.harms ?? []).map(h => `<li>${esc(t('harmItem', { id: h.id, interest: hasWords('interests', h.interest) ? it(h.interest) : h.interest, amount: money(h.amountCents) }))}</li>`).join('')}</ul><ul class="lines">${[say(t, 'filed', { when: at(pc.filedAt, now) }), pc.servedAt ? say(t, 'served', { when: at(pc.servedAt, now) }) : '', pc.closedReason ? esc(t('closed', { reason: pc.closedReason })) : ''].filter(Boolean).map(l => `<li>${l}</li>`).join('')}</ul><p><a href="cases.html">Every case’s public judgment is on the cases page.</a></p>`, 'k11')}
${section('public-judgments', t('judgmentsTitle'), (pc.judgments ?? []).length ? pc.judgments.map(j => judgmentHtml(j, j.instance, now)).join('') : `<p class="empty">${esc(t('noJudgment'))}</p>`, 'k7')}`;
}

/** A page that has no case to show, in words. */
export const missingHtml = (title, words) => `<header class="desk__head"><div><h1>${esc(title)}</h1><p>${esc(words)}</p></div><a class="btn small quiet" href="cases.html">All cases</a></header>`;

// ─── the page ────────────────────────────────────────────────────────────────

const blankUi = () => ({ evidence: '', media: [], figures: {}, freeze: '', floor: '', pending: false, uploading: false, done: null, refusals: [], mediaRefusals: [] });

async function start() {
  if (!requireSignIn()) return;
  const root = document.getElementById('case');
  const id = new URLSearchParams(location.search).get('id');
  const show = html => { root.innerHTML = html; root.removeAttribute('aria-busy'); };
  if (!id) return show(missingHtml('No case named', 'This address names no case. Open one from your cases.'));
  document.title = `Case ${id.slice(0, 10)} · VibeGov`;

  let view = null;
  let law = {};
  let ui = blankUi();
  const versions = read('/public/contract/versions', { anonymous: true });
  const overview = read('/public/contract', { anonymous: true });

  const draw = () => {
    const now = Date.now();
    show(partyHtml(view, law, ui, now));
  };
  const load = async () => {
    const r = await read(`/contract/cases/${encodeURIComponent(id)}`);
    if (r.error) {
      view = null;
      if (r.error.status === 404) return show(missingHtml('No such case', 'No case has this id. Check the address, or open the case from your list.'));
      if (r.error.status === 401) return show(missingHtml('Signed out', 'Your session has ended. Sign in again to read this case.'));
      return show(missingHtml('Not reached', unreachable(r.error)));
    }
    if (r.data?.public) {
      view = null;
      return show(publicHtml(r.data.public, Date.now()));
    }
    view = r.data;
    // The law the case is decided by: the version it began under (k10); else the law in force now.
    const v = (await versions).data?.versions?.find(x => x.version === view.case.contractVersion);
    law = v?.law?.parameters ?? (await overview).data?.law?.parameters ?? {};
    draw();
  };

  // Typing changes the state and the buttons, not the page: the field keeps its caret.
  const refreshButtons = () => {
    if (!view) return;
    for (const form of root.querySelectorAll('form[data-act]')) {
      const b = form.querySelector('button[type="submit"]');
      if (!b) continue;
      const act = form.dataset.act;
      b.disabled = act === 'evidence' ? !canSubmit(ui) : act === 'freeze' ? ui.pending || !centsOf(ui.freeze) : act === 'stakes' ? !canRaise(ui, caseStakesCents(view.case)) : ui.pending;
    }
    const deposit = root.querySelector('[data-deposit]');
    if (deposit) deposit.textContent = stakesWords(caseStakesCents(view.case), ui.floor, law.stakesRaiseDepositBps);
  };
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.ui) ui[el.dataset.ui] = el.value;
    else if (el.dataset.figure) {
      ui.figures = { ...ui.figures, [el.dataset.figure]: el.value };
      el.setAttribute('aria-invalid', String(!!el.value.trim() && centsOf(el.value) === null));
    } else return;
    refreshButtons();
  });
  root.addEventListener('change', async e => {
    const el = e.target;
    if (el.id !== 'ev-media' || !el.files?.length) return;
    const files = [...el.files];
    ui.uploading = true;
    ui.mediaRefusals = [];
    draw();
    const added = [];
    for (const f of files) {
      const r = await uploadMedia(f);
      if (r.ok) added.push({ ...r.part, label: f.name });
      else ui.mediaRefusals = [...ui.mediaRefusals, ...r.refusals];
    }
    ui.media = [...ui.media, ...added];
    ui.uploading = false;
    draw();
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-do="remove-media"]');
    if (!b) return;
    ui.media = ui.media.filter((_, j) => j !== Number(b.dataset.i));
    draw();
  });
  root.addEventListener('submit', async e => {
    e.preventDefault();
    const act = e.target.dataset.act;
    if (!view || ui.pending) return;
    const caseId = view.case.id;
    const run = {
      evidence: () => submitEvidence(caseId, [...(ui.evidence.trim() ? [{ type: 'text', text: ui.evidence.trim() }] : []), ...ui.media], view.role === 'respondent' ? counterOf(ui.figures) : undefined),
      freeze: () => requestFreeze(caseId, centsOf(ui.freeze) ?? 0),
      stakes: () => raiseStakes(caseId, centsOf(ui.floor) ?? 0),
      appeal: () => appealCase(caseId),
    }[act];
    if (!run) return;
    ui = { ...ui, pending: true, refusals: [], done: null };
    refreshButtons();
    const r = await run();
    if (r.ok) {
      ui = { ...blankUi(), done: { evidence: 'submitted', freeze: 'freezeRequested', stakes: 'stakesRaised', appeal: 'appealed' }[act] };
      await load();
    } else {
      ui = { ...ui, pending: false, refusals: r.refusals };
      draw();
    }
    root.querySelector('.done, .refusal')?.scrollIntoView({ block: 'center' });
  });

  await load();
  keepTime(root);
}

if (globalThis.document?.getElementById?.('case')) start();
