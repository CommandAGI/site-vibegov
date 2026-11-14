// A stand-in for the contract's case routes (redesign/APP.md § testing), for `node test/serve.mjs --fake
// test/fake-cases.mjs`. The shapes are the API's (CommandAGI deployments/platform/cloudflare/api-worker/src/routes/
// contract.ts and data/contract-cases.ts; the case is core justice.ts `Case`); the rules are the core's, cut down:
// a party reads the record, anyone else the public projection; the respondent answers once served; an appeal needs
// a decided case in its window; a raise must be higher and takes `stakesRaiseDepositBps` of the difference.
//
// The bearer token is the account id (`alice`, `bob`, `carol`): set `vibegov.session` to `{ "access": "alice" }`.
// The sweep is two routes of this fake only: `POST /fake/serve/<id>` serves a screened case, and
// `POST /fake/decide/<id>` gives the first judgment (liable on every element), as the engine's seats would.
import { createHash } from 'node:crypto';

const DAY = 86_400_000;
const PARAMETERS = {
  lawRfcWindowMs: 14 * DAY,
  engineRfcWindowMs: 21 * DAY,
  extractionContestMs: 3 * DAY,
  rfcDepositCents: 2_500,
  caseResponseMs: 14 * DAY,
  caseEvidenceMs: 14 * DAY,
  appealMs: 14 * DAY,
  stakesRaiseDepositBps: 100,
  interimFreezeMs: 14 * DAY,
  criminalConfidencePermille: 950,
  penaltyMultiplePermille: 3_000,
  exclusionMaxMs: 365 * DAY,
  poolClaimCapCents: 500_000,
  caseDepositCents: 500,
  reopenWindowMs: 365 * DAY,
  unprocessableAfterMs: 7 * DAY,
  openCasesPerClaimant: 5,
};
const DUTIES = [
  {
    id: 'breach',
    title: 'Keep an agreed term',
    text: 'Whoever accepts a term of an agreement performs it, or makes good the loss its breach causes.',
    protects: ['agreement', 'property'],
    harm: 'a loss caused by an agreed term not kept',
    elements: [
      { id: 'term', text: 'The respondent accepted the term.' },
      { id: 'breach', text: 'The respondent did not perform it.' },
      { id: 'loss', text: 'The breach caused the claimant a loss.' },
    ],
    criminal: false,
    effectiveFrom: 0,
  },
  {
    id: 'theft',
    title: 'Do not take what is another’s',
    text: 'No one takes property that is another’s without their consent.',
    protects: ['property'],
    harm: 'property taken without consent',
    elements: [
      { id: 'taking', text: 'The respondent took the property.' },
      { id: 'owner', text: 'It was the claimant’s.' },
      { id: 'consent', text: 'The claimant did not consent.' },
    ],
    criminal: true,
    effectiveFrom: 0,
  },
];
const ARTICLES = [
  ['k1', 'truth and justice'], ['k2', 'people and voice'], ['k3', 'no offices'], ['k4', 'change only by voice'], ['k5', 'a free market'], ['k6', 'the scope of justice'],
  ['k7', 'due process without juries'], ['k8', 'bounded remedies'], ['k9', 'victims are made whole'], ['k10', 'the engine'], ['k11', 'records'], ['k12', 'exit'],
].map(([id, title]) => ({ id, title, text: `The text of kernel article ${id}.` }));
const INTERESTS = ['life', 'bodily_integrity', 'liberty', 'property', 'privacy', 'agreement', 'voice', 'access'];
const LAW = { duties: DUTIES, parameters: PARAMETERS, evidenceModalities: ['text', 'image', 'audio'], people: { kinds: [] } };
const USERS = { alice: 'Alice Moreau', bob: 'Bob Ito', carol: 'Carol Diaz' };

const sha = x => createHash('sha256').update(x).digest('hex');
const cases = new Map();
const renderings = new Map();
const determinations = new Map();
const freezes = new Map();

function dutyFor(f) {
  if (f.duty.source === 'law') {
    const d = DUTIES.find(x => x.id === f.duty.dutyId);
    return d ? { title: d.title, text: `${d.text} (protects ${d.protects.join(', ')}; forbids ${d.harm})`, elements: d.elements } : { title: '', text: '', elements: [] };
  }
  if (f.duty.source === 'kernel') {
    const a = ARTICLES.find(x => x.id === f.duty.article);
    return { title: a ? `kernel ${a.id}. ${a.title}` : '', text: a?.text ?? '', elements: [{ id: 'conduct', text: `The respondent's act or omission went against kernel article ${f.duty.article}.` }, { id: 'harm', text: 'It caused the claimant (or the being filed for) harm to a protected interest.' }] };
  }
  return { title: `agreement ${f.duty.agreementId}`, text: `term: ${f.duty.term}`, elements: [{ id: 'agreement', text: 'The respondent accepted the agreement containing the term.' }, { id: 'nonperformance', text: 'The respondent did not perform the term, and no term excused it.' }, { id: 'harm', text: 'The nonperformance caused the claimant a loss.' }] };
}

/** The core's structural checks that a person can meet from the form (justice.ts `filingRefusals`, cut down). */
function refusals(f, now) {
  const r = [];
  if (f.claimant === f.respondent || f.filedFor === f.respondent) r.push({ code: 'k6.self', detail: 'the respondent cannot be the harmed party' });
  if (f.act.at > now) r.push({ code: 'k6.future_act', detail: 'the act has not happened yet' });
  if (f.duty.source === 'law') {
    const d = DUTIES.find(x => x.id === f.duty.dutyId);
    if (!d) r.push({ code: 'k6.no_duty', detail: `no duty ${f.duty.dutyId} was in force at the time of the act` });
    else {
      for (const h of f.harms) if (!d.protects.includes(h.interest)) r.push({ code: 'k6.interest', detail: `duty ${d.id} does not protect ${h.interest} (${h.id})` });
      if (f.criminal && !d.criminal) r.push({ code: 'k6.not_criminal', detail: `breach of ${d.id} is not a criminal matter` });
    }
  }
  if (f.duty.source === 'agreement') r.push({ code: 'k6.no_agreement', detail: 'the respondent did not accept that agreement term' });
  return r;
}

function malformed(f) {
  const out = [];
  if (!f || typeof f !== 'object') return [{ code: 'case.malformed', detail: ': Expected object' }];
  if (typeof f.respondent !== 'string' || !f.respondent) out.push({ code: 'case.malformed', detail: 'respondent: Required' });
  if (typeof f.criminal !== 'boolean') out.push({ code: 'case.malformed', detail: 'criminal: Required' });
  if (!f.act?.description) out.push({ code: 'case.malformed', detail: 'act.description: String must contain at least 1 character(s)' });
  if (!Array.isArray(f.harms) || !f.harms.length) out.push({ code: 'case.malformed', detail: 'harms: Array must contain at least 1 element(s)' });
  for (const [i, h] of (f.harms ?? []).entries()) if (!h.description) out.push({ code: 'case.malformed', detail: `harms.${i}.description: String must contain at least 1 character(s)` });
  if (!Array.isArray(f.relief) || !f.relief.length) out.push({ code: 'case.malformed', detail: 'relief: Array must contain at least 1 element(s)' });
  return out;
}

const partyOf = (c, who) => (who === c.filing.respondent ? 'respondent' : who === c.filing.claimant || who === c.filing.filedFor ? 'claimant' : null);
function stageAt(c, now) {
  if (c.stage === 'awaiting_response' && c.responseDue !== null && now > c.responseDue) return c.evidenceDue !== null && now > c.evidenceDue ? 'ready' : 'evidence';
  if (c.stage === 'evidence' && c.evidenceDue !== null && now > c.evidenceDue) return 'ready';
  if (c.stage === 'decided' && c.appealedBy === null && c.appealableUntil !== null && now > c.appealableUntil) return 'final';
  return c.stage;
}
const stakes = c => Math.max(c.filing.harms.reduce((s, h) => s + h.amountCents, 0) + c.filing.relief.filter(r => r.kind === 'penalty').reduce((s, r) => s + (r.amountCents ?? 0), 0) + c.bondExposureCents, c.stakesFloorCents);
const publicCase = c => ({
  id: c.id, family: c.family, claimant: c.filing.claimant, filedFor: c.filing.filedFor ?? null, respondent: c.filing.respondent, criminal: c.filing.criminal, duty: c.filing.duty, dutyTitle: c.duty.title,
  harms: c.filing.harms.map(h => ({ id: h.id, interest: h.interest, amountCents: h.amountCents })), stage: c.stage, filedAt: c.filedAt, servedAt: c.servedAt, appealedBy: c.appealedBy, closedReason: c.closedReason,
  judgments: c.instances.filter(i => i.judgment).map(i => ({ instance: i.n, ...i.judgment, determinations: undefined })),
});

function file(f, now) {
  const id = sha(JSON.stringify({ filing: f, filedAt: now }));
  const c = {
    id, panelSeed: id, filing: f, filedAt: now, family: id, contractVersion: 1, engineHash: 'e'.repeat(64), expedited: false, stakesFloorCents: 0, bondExposureCents: 0,
    duty: dutyFor(f), stage: 'screening', servedAt: null, responseDue: null, evidenceDue: null,
    submissions: [{ party: 'claimant', parts: f.evidence ?? [], at: now }], instances: [], appealableUntil: null, appealedBy: null, costCents: 0,
    deposits: { claimant: PARAMETERS.caseDepositCents, respondent: 0 }, closedReason: null,
  };
  cases.set(id, { c, pendingInterim: null, execution: null });
  return c;
}

function decide(rec, now) {
  const c = rec.c;
  const awards = Object.fromEntries(c.filing.harms.map(h => [h.id, { cents: h.amountCents, figure: 'claimant' }]));
  const dets = [];
  const findings = {};
  const det = (kind, key, label) => {
    const d = {
      id: sha(`${c.id}|${key}`), kind, subject: c.id, packageDigest: sha(`pkg|${c.id}|${key}`), at: now,
      routing: { input: { stakesMicroUsd: stakes(c) * 10_000, deadlineMs: null }, plan: { startTier: 2, maxTier: 3, infeasible: false, tiers: {} } },
      rounds: [{ tier: 2, note: 'the panel of this instance', decisive: true, answers: [{ seat: 'clef', label, confidence: 930, ms: 4120 }, { seat: 'gemma-judge', label, confidence: 910, ms: 5230 }], aggregate: { label, confidence: 920, groups: 2 } }],
      outcome: { status: 'decided', label, confidence: 920, tier: 2 },
    };
    dets.push(d);
    findings[key] = { determination: d.id, status: 'decided', label, confidence: 920, tier: 2 };
  };
  det('case.justiciable', 'justiciable', 'justiciable');
  for (const e of c.duty.elements) det('case.element', `element:${e.id}`, 'established');
  for (const h of c.filing.harms) det('case.figure', `harm:${h.id}`, 'claimant');
  c.filing.relief.forEach((_, i) => det('case.remedy', `remedy:${i}`, 'justified'));
  const plan = { startTier: 2, maxTier: 3, expectedLossMicroUsd: 1_250_000, tiers: { 2: { quorum: 2, groups: [{ seat: 'clef' }, { seat: 'gemma-judge' }] }, 3: { quorum: 2, groups: [{ seat: 'opus-bench' }, { seat: 'gpt-bench' }] } } };
  c.instances.push({
    n: 1, startedAt: now - 60_000, startTier: 2, panels: { 2: ['clef', 'gemma-judge'], 3: ['opus-bench', 'gpt-bench'] }, routing: { input: {}, draw: {}, plan }, findings, blockedSince: null,
    judgment: { outcome: 'liable', elements: Object.fromEntries(c.duty.elements.map(e => [e.id, true])), awards, remedies: c.filing.relief, determinations: dets.map(d => d.id), reason: `liable on every element; awarded ${Object.values(awards).reduce((s, a) => s + a.cents, 0)} cents across ${c.filing.harms.length} harm item(s)`, at: now },
  });
  c.costCents = 37;
  c.stage = 'decided';
  c.appealableUntil = now + PARAMETERS.appealMs;
  determinations.set(c.id, dets);
}

// A judged matter between two others, so the public judgments are not empty.
{
  const now = Date.now();
  const c = file({ claimant: 'carol', respondent: 'dave', criminal: false, duty: { source: 'law', dutyId: 'breach' }, act: { description: 'Paid for a repair that was never done.', at: now - 40 * DAY }, harms: [{ id: 'paid', interest: 'agreement', description: 'the price of the repair', amountCents: 42_000 }], relief: [{ kind: 'restitution', harmIds: ['paid'], description: 'return the price', amountCents: 42_000 }], evidence: [{ type: 'text', text: 'The invoice and the messages.' }] }, now - 30 * DAY);
  c.stage = 'awaiting_response';
  c.servedAt = now - 29 * DAY;
  decide(cases.get(c.id), now - 20 * DAY);
  c.stage = 'final';
  c.appealableUntil = null;
}

const json = (status, body) => ({ status, body });

export default function answer({ method, path, headers, body }) {
  const now = Date.now();
  const who = /^Bearer (.+)$/.exec(headers.authorization ?? '')?.[1] ?? null;
  const m = (re) => re.exec(path);

  if (method === 'GET' && path === '/public/contract') return json(200, { kernel: { hash: 'k'.repeat(64), articles: ARTICLES, floors: { interimFreezeMaxMs: 14 * DAY }, interests: INTERESTS }, version: 1, law: LAW, engine: {}, engineHash: 'e'.repeat(64), lawHistory: [], engineHistory: [], lastRfc: null });
  if (method === 'GET' && path === '/public/contract/versions') return json(200, { versions: [{ version: 1, kernelHash: 'k'.repeat(64), stateHash: 's'.repeat(64), law: LAW, engine: {}, engineHash: 'e'.repeat(64), effectiveAt: 0, rfcId: null }] });
  if (method === 'GET' && path === '/public/contract/stats') {
    const byStage = {};
    for (const { c } of cases.values()) { const s = stageAt(c, now); byStage[s] = (byStage[s] ?? 0) + 1; }
    const n = s => byStage[s] ?? 0;
    const keys = ['lawRfcWindowMs', 'engineRfcWindowMs', 'extractionContestMs', 'rfcDepositCents', 'caseResponseMs', 'caseEvidenceMs', 'caseDepositCents', 'appealMs', 'unprocessableAfterMs', 'poolClaimCapCents', 'penaltyMultiplePermille'];
    return json(200, { at: now, cases: { byStage, judgments: n('decided') + n('final') + n('appealed') }, parameters: Object.fromEntries(keys.map(k => [k, PARAMETERS[k]])) });
  }
  if (method === 'GET' && path === '/public/contract/judgments')
    return json(200, { judgments: [...cases.values()].filter(({ c }) => ['final', 'decided', 'appealed'].includes(c.stage)).map(({ c }) => publicCase(c)) });
  let x;
  if (method === 'GET' && (x = m(/^\/public\/contract\/cases\/([^/]+)$/))) {
    const rec = cases.get(decodeURIComponent(x[1]));
    return rec ? json(200, { public: publicCase({ ...rec.c, stage: stageAt(rec.c, now) }) }) : json(404, { error: 'not_found' });
  }

  // the fake sweep
  if (method === 'POST' && (x = m(/^\/fake\/serve\/([^/]+)$/))) {
    const rec = cases.get(decodeURIComponent(x[1]));
    if (!rec) return json(404, { error: 'not_found' });
    Object.assign(rec.c, { stage: 'awaiting_response', servedAt: now, responseDue: now + PARAMETERS.caseResponseMs, evidenceDue: now + PARAMETERS.caseResponseMs + PARAMETERS.caseEvidenceMs });
    return json(200, { ok: true });
  }
  if (method === 'POST' && (x = m(/^\/fake\/decide\/([^/]+)$/))) {
    const rec = cases.get(decodeURIComponent(x[1]));
    if (!rec) return json(404, { error: 'not_found' });
    decide(rec, now);
    return json(200, { ok: true });
  }

  if (path === '/me' || path.startsWith('/contract/')) {
    if (!who || !USERS[who]) return json(401, { error: 'unauthorized' });
  } else return undefined;

  if (method === 'GET' && path === '/me') return json(200, { id: who, name: USERS[who] });
  if (method === 'GET' && path === '/contract/cases')
    return json(200, { cases: [...cases.values()].map(({ c }) => c).filter(c => c.filing.claimant === who || c.filing.respondent === who).sort((a, b) => b.filedAt - a.filedAt).map(c => ({ id: c.id, claimant: c.filing.claimant, respondent: c.filing.respondent, criminal: c.filing.criminal, stage: c.stage, filedAt: c.filedAt })) });
  if (method === 'GET' && path === '/contract/awaiting') {
    const mine = [...cases.values()].map(({ c }) => ({ c, role: partyOf(c, who), stage: stageAt(c, now) })).filter(x => x.role && !['final', 'duplicate', 'unprocessable'].includes(x.stage));
    const clock = ({ c, role, stage }) => stage === 'awaiting_response' && role === 'respondent' ? { act: 'answer', due: c.responseDue } : stage === 'evidence' ? { act: 'evidence', due: c.evidenceDue } : stage === 'decided' && !c.appealedBy && now <= c.appealableUntil ? { act: 'appeal', due: c.appealableUntil } : { act: 'wait', due: null };
    return json(200, { entity: who, at: now, voice: null, why: 'not_a_person', rfcs: [], contests: [], cases: mine.map(x => ({ id: x.c.id, duty: x.c.duty.title, role: x.role, stage: x.stage, ...clock(x) })), decisions: [] });
  }
  if (method === 'POST' && path === '/contract/media') {
    const mime = String(headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body ?? ''));
    const modality = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : null;
    if (!bytes.length) return json(415, { error: 'empty' });
    if (!modality) return json(415, { error: 'unsupported_media_type' });
    const sha256 = sha(bytes);
    renderings.set(sha256, { sha256, modality, ok: true, at: now, by: [{ seat: 'render-a', text: `(the fake's rendering) An ${modality} file of ${bytes.length} bytes.` }, { seat: 'render-b', text: `(the fake's rendering) ${modality}, ${bytes.length} bytes, type ${mime}.` }] });
    return json(201, { part: { type: 'ref', ref: `r2:contract/evidence/${sha256}`, mime, modality, sha256 } });
  }
  if (method === 'POST' && path === '/contract/cases') {
    const bad = malformed(body);
    if (bad.length) return json(422, { error: 'refused', refused: bad });
    const f = { ...body, claimant: who };
    const open = [...cases.values()].filter(({ c }) => c.filing.claimant === who && c.stage !== 'final').length;
    if (open >= PARAMETERS.openCasesPerClaimant) return json(422, { error: 'refused', refused: [{ code: 'case.capacity', detail: `at most ${PARAMETERS.openCasesPerClaimant} open cases per claimant` }] });
    const r = refusals(f, now);
    if (r.length) return json(422, { error: 'refused', refused: r });
    return json(201, { case: file(f, now) });
  }
  if ((x = m(/^\/contract\/cases\/([^/]+)(?:\/(submissions|appeal|stakes|interim))?$/))) {
    const rec = cases.get(decodeURIComponent(x[1]));
    if (!rec) return json(404, { error: 'not_found' });
    const c = rec.c;
    c.stage = stageAt(c, now);
    const role = partyOf(c, who);
    if (method === 'GET' && !x[2]) {
      if (!role) return json(200, { public: publicCase(c) });
      return json(200, { case: c, role, pendingInterim: rec.pendingInterim, agreementId: null, execution: rec.execution, determinations: determinations.get(c.id) ?? [], renderings: Object.fromEntries(c.submissions.flatMap(s => s.parts).filter(p => p.type === 'ref' && renderings.has(p.sha256)).map(p => [p.sha256, renderings.get(p.sha256)])) });
    }
    if (method !== 'POST') return undefined;
    if (x[2] === 'submissions') {
      if (!role) return json(403, { error: 'not_a_party' });
      const parts = body?.parts ?? [];
      if (!Array.isArray(parts) || parts.length > 20 || parts.some(p => p.type === 'text' && typeof p.text !== 'string')) return json(400, { error: 'malformed_parts' });
      let counter;
      if (body?.counter !== undefined) {
        if (role !== 'respondent') return json(403, { error: 'only_the_respondent_counters' });
        for (const [k, v] of Object.entries(body.counter)) if (!c.filing.harms.some(h => h.id === k) || !Number.isInteger(v) || v < 0) return json(400, { error: 'malformed_counter' });
        counter = body.counter;
      }
      if (!parts.length && !counter) return json(400, { error: 'empty_submission' });
      if (c.stage === 'screening' || c.stage === 'serving') { if (role !== 'claimant') return json(409, { error: 'not_served' }); }
      else if (c.stage !== 'awaiting_response' && c.stage !== 'evidence') return json(409, { error: 'record_closed' });
      c.submissions.push({ party: role, parts, ...(counter ? { counter } : {}), at: now });
      if (role === 'respondent' && c.stage === 'awaiting_response') c.stage = 'evidence';
      return json(201, { ok: true });
    }
    if (x[2] === 'appeal') {
      if (!role) return json(403, { error: 'not_a_party' });
      if (c.appealedBy) return json(409, { error: 'already_appealed' });
      if (c.stage !== 'decided') return json(409, { error: 'not_decided' });
      if (c.appealableUntil !== null && now > c.appealableUntil) return json(409, { error: 'window_closed' });
      c.stage = 'appealed';
      c.appealedBy = role;
      c.deposits[role] += PARAMETERS.caseDepositCents;
      return json(202, { ok: true });
    }
    if (x[2] === 'stakes') {
      if (!role) return json(403, { error: 'not_a_party' });
      if (['duplicate', 'final', 'unprocessable'].includes(c.stage)) return json(409, { error: 'closed' });
      const next = c.instances.length + 1;
      if (next > 2 || (next === 2 && c.stage !== 'appealed')) return json(409, { error: 'instance_started' });
      const floor = Number(body?.floorCents);
      const current = stakes(c);
      if (!Number.isInteger(floor) || floor <= current) return json(409, { error: 'not_higher' });
      const depositCents = Math.ceil(((floor - current) * PARAMETERS.stakesRaiseDepositBps) / 10_000);
      c.stakesFloorCents = floor;
      c.deposits[role] += depositCents;
      return json(202, { ok: true, depositCents });
    }
    if (x[2] === 'interim') {
      if (role !== 'claimant') return json(403, { error: 'only_the_claimant' });
      const amount = Number(body?.amountCents);
      if (!Number.isInteger(amount) || amount <= 0) return json(400, { error: 'amount' });
      if (freezes.has(c.id) || rec.pendingInterim) return json(409, { error: 'already_requested' });
      if (['final', 'unprocessable', 'duplicate'].includes(c.stage)) return json(409, { error: 'closed' });
      rec.pendingInterim = { by: who, amountCents: amount, at: now };
      return json(202, { ok: true });
    }
  }
  return undefined;
}
