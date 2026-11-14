// A stand-in for the API that propose.html calls (`node test/serve.mjs --fake test/fake-propose.mjs`): the law in force
// (`GET /public/contract`, the genesis law of CommandAGI's law.ts with the kernel of fixtures/kernel.json) and
// `POST /contract/rfcs`, which refuses as the route does (routes/contract.ts, data/contract-rfcs.ts, rfc.ts openRfc):
// 401 with no token; 422 `rfc.malformed` with the schema path; `rfc.duplicate_option`; `rfc.duplicate_effect` when two
// options give the same resulting law; the kernel's codes (`k4.law_window`, `k2.human_removed`) and `law.inapplicable`.
// What it accepted is kept in `opened`, for a test to read.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DAY = 86_400_000;
const { kernel: K } = JSON.parse(readFileSync(new URL('../fixtures/kernel.json', import.meta.url), 'utf8'));
const duty = (id, title, protects, criminal, elements) => ({ id, title, text: `The rule of ${title}.`, protects, harm: `the harm ${title} forbids`, elements: elements.map(e => ({ id: e, text: `The ${e} is shown.` })), criminal, effectiveFrom: 0 });

export const LAW = {
  version: 3,
  people: [{ kind: 'human', uniqueness: 'identity_fingerprint', issuers: ['platform_kyc'] }],
  duties: [
    duty('fraud', 'no fraud', ['property', 'agreement'], true, ['representation', 'falsity', 'knowledge', 'reliance', 'harm']),
    duty('theft', 'no theft', ['property'], true, ['taking', 'ownership', 'no_consent', 'harm']),
    duty('breach', 'keep agreements', ['agreement'], false, ['agreement', 'nonperformance', 'harm']),
    duty('privacy', 'no exposure', ['privacy'], false, ['private', 'source', 'publication', 'no_consent']),
  ],
  parameters: {
    lawRfcWindowMs: 14 * DAY, engineRfcWindowMs: 28 * DAY, extractionContestMs: 3 * DAY, rfcDepositCents: 1_000, rfcRepeatCooldownMs: 90 * DAY,
    rfcConcurrenceSample: 24, caseResponseMs: 7 * DAY, caseEvidenceMs: 7 * DAY, caseDepositCents: 500, reopenWindowMs: 180 * DAY,
    unprocessableAfterMs: 14 * DAY, openCasesPerClaimant: 20, appealMs: 7 * DAY, expeditedResponseMs: 60_000, expeditedEvidenceMs: 60_000,
    expeditedAppealMs: 60_000, routingTemperatureMicroUsd: 2_000, hotFlowMicroUsdPerSec: 10_000, hotDeadlineMs: 2_000, reviewSamplePermille: 50,
    stakesRaiseDepositBps: 100, rfcStanceStakesCents: 10_000, interimFreezeMs: 14 * DAY, criminalConfidencePermille: 950,
    penaltyMultiplePermille: 2_000, exclusionMaxMs: 180 * DAY, poolPremiumBps: 50, poolClaimCapCents: 1_000_000, commonsFeeBps: 10,
    creditServicingBps: 25, creditGraceMs: 7 * DAY,
  },
  evidenceModalities: ['text', 'image', 'audio'],
};
export const ENGINE = { tiers: [{ tier: 2, seats: [{ id: 'jev', operator: 'typesafe', pin: { kind: 'hash', value: 'ab12' } }] }], renderers: { image: ['luna', 'haiku'] } };
export const OVERVIEW = { kernel: K, version: 3, law: LAW, engine: ENGINE, engineHash: '24edc06a'.padEnd(64, '7'), lawHistory: [], engineHistory: [], lastRfc: null };

export const opened = [];
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const sorted = x => (Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x);

/** The schema's checks of a draft (rfc.ts RfcDraft, law.ts LawChange and Duty), as `path: problem`. */
function malformed(d) {
  const out = [];
  const need = (ok, path, why) => ok || out.push(`${path}: ${why}`);
  need(typeof d.title === 'string' && d.title.length >= 1 && d.title.length <= 300, 'title', 'String must contain at least 1 character(s)');
  need(typeof d.body === 'string' && d.body.length >= 1, 'body', 'String must contain at least 1 character(s)');
  need(Array.isArray(d.options) && d.options.length >= 1 && d.options.length <= 12, 'options', 'Array must contain 1 to 12 element(s)');
  (d.options ?? []).forEach((o, i) => {
    const at = `options.${i}`;
    need(SLUG.test(o.id ?? ''), `${at}.id`, 'Invalid');
    need(!!o.title, `${at}.title`, 'String must contain at least 1 character(s)');
    if (o.target === 'engine') return need(o.engine && typeof o.engine === 'object', `${at}.engine`, 'Required');
    need(Array.isArray(o.changes) && o.changes.length >= 1, `${at}.changes`, 'Array must contain at least 1 element(s)');
    (o.changes ?? []).forEach((c, k) => {
      const cat = `${at}.changes.${k}`;
      if (c.op === 'set_parameter') { need(c.key in LAW.parameters, `${cat}.key`, 'Invalid enum value'); need(Number.isInteger(c.value), `${cat}.value`, 'Expected number, received null'); }
      if (c.op === 'add_duty' || c.op === 'amend_duty') {
        const u = c.duty ?? {};
        need(/^[a-z0-9][a-z0-9_.-]*$/.test(u.id ?? ''), `${cat}.duty.id`, 'Invalid');
        for (const f of ['title', 'text', 'harm']) need(!!u[f], `${cat}.duty.${f}`, 'String must contain at least 1 character(s)');
        need(u.protects?.length >= 1, `${cat}.duty.protects`, 'Array must contain at least 1 element(s)');
        need(u.elements?.length >= 1 && u.elements.every(e => SLUG.test(e.id) && e.text), `${cat}.duty.elements`, 'Array must contain at least 1 element(s)');
        need(Number.isInteger(u.effectiveFrom), `${cat}.duty.effectiveFrom`, 'Expected integer');
      }
      if (c.op === 'repeal_duty') need(!!c.id, `${cat}.id`, 'String must contain at least 1 character(s)');
      if (c.op === 'recognize_people') { need(/^[a-z][a-z0-9_]*$/.test(c.kind?.kind ?? ''), `${cat}.kind.kind`, 'Invalid'); need(c.kind?.issuers?.length >= 1, `${cat}.kind.issuers`, 'Array must contain at least 1 element(s)'); }
      if (c.op === 'unrecognize_people') need(!!c.kind, `${cat}.kind`, 'String must contain at least 1 character(s)');
      if (c.op === 'set_evidence_modalities') need(c.modalities?.length >= 1, `${cat}.modalities`, 'Array must contain at least 1 element(s)');
    });
  });
  return out;
}

/** law.ts applyLawChanges, enough to compare effects and find the kernel's violations. */
function apply(law, changes) {
  const next = structuredClone(law);
  for (const c of changes) {
    if (c.op === 'add_duty') { if (next.duties.some(d => d.id === c.duty.id)) throw new Error(`duty ${c.duty.id} already exists`); next.duties.push(c.duty); }
    if (c.op === 'amend_duty') { const i = next.duties.findIndex(d => d.id === c.duty.id); if (i < 0) throw new Error(`duty ${c.duty.id} does not exist`); next.duties[i] = c.duty; }
    if (c.op === 'repeal_duty') { if (!next.duties.some(d => d.id === c.id)) throw new Error(`duty ${c.id} does not exist`); next.duties = next.duties.filter(d => d.id !== c.id); }
    if (c.op === 'set_parameter') next.parameters[c.key] = c.value;
    if (c.op === 'recognize_people') next.people = [...next.people.filter(k => k.kind !== c.kind.kind), c.kind];
    if (c.op === 'unrecognize_people') next.people = next.people.filter(k => k.kind !== c.kind);
    if (c.op === 'set_evidence_modalities') next.evidenceModalities = [...new Set(c.modalities)];
  }
  return next;
}
const effect = law => JSON.stringify(sorted({ ...law, duties: [...law.duties].sort((a, b) => a.id.localeCompare(b.id)).map(d => ({ ...d, effectiveFrom: 0, protects: [...d.protects].sort() })), people: [...law.people].sort((a, b) => a.kind.localeCompare(b.kind)), evidenceModalities: [...law.evidenceModalities].sort() }));

export default function answer({ method, path, headers, body }) {
  if (method === 'GET' && path === '/public/contract') return { body: OVERVIEW };
  if (method === 'GET' && path === '/me') return headers.authorization ? { body: { id: 'u1', name: 'A. Tester' } } : { status: 401, body: { error: 'unauthorized' } };
  if (method === 'POST' && path === '/contract/rfcs') {
    if (!headers.authorization) return { status: 401, body: { error: 'unauthorized' } };
    if (!body || typeof body !== 'object') return { status: 400, body: { error: 'malformed' } };
    const bad = malformed(body);
    if (bad.length) return { status: 422, body: { error: 'refused', refused: bad.map(detail => ({ code: 'rfc.malformed', detail })) } };
    const refused = [];
    const ids = new Set(), effects = new Map();
    for (const o of body.options) {
      if (o.id === 'status_quo') refused.push({ code: 'rfc.status_quo_reserved', detail: 'the option id status_quo is reserved' });
      if (ids.has(o.id)) refused.push({ code: 'rfc.duplicate_option', detail: o.id });
      ids.add(o.id);
      if (o.target !== 'law') continue;
      let next;
      try { next = apply(LAW, o.changes); } catch (e) { refused.push({ code: 'law.inapplicable', detail: `${o.id}: ${e.message}` }); continue; }
      const twin = effects.get(effect(next));
      if (twin) refused.push({ code: 'rfc.duplicate_effect', detail: `${o.id} changes exactly what ${twin} changes` });
      effects.set(effect(next), o.id);
      if (next.parameters.lawRfcWindowMs < K.floors.lawRfcMinWindowMs) refused.push({ code: 'k4.law_window', detail: `${o.id}: law RFC window below the kernel floor` });
      if (!next.people.some(k => k.kind === 'human')) refused.push({ code: 'k2.human_removed', detail: `${o.id}: human must remain a recognized kind of people` });
    }
    if (new Set(body.options.map(o => o.target)).size !== 1) refused.push({ code: 'rfc.mixed_targets', detail: 'all options of an RFC change the same thing: law, or the engine' });
    if (refused.length) return { status: 422, body: { error: 'refused', refused } };
    const id = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const now = Date.now();
    const engine = body.options[0].target === 'engine';
    const rfc = { id, opener: 'u1', ...body, target: engine ? 'engine' : 'law', options: [{ id: 'status_quo', target: 'none', title: 'keep things as they are', summary: 'No change.' }, ...body.options], openedAt: now, closesAt: now + (engine ? LAW.parameters.engineRfcWindowMs : LAW.parameters.lawRfcWindowMs), contestMs: LAW.parameters.extractionContestMs, contractVersion: 3, engineHash: OVERVIEW.engineHash, baseStateHash: '0'.repeat(64), people: ['human'], anonymity: { human: { root: '0', size: 0 } }, depositCents: LAW.parameters.rfcDepositCents };
    opened.push(rfc);
    return { status: 201, body: { rfc } };
  }
  return undefined;
}
