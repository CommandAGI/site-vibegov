// A fake API for `node test/serve.mjs --fake test/fake-rfcs.mjs`: the proposal routes with the shapes the api-worker
// answers (routes/contract.ts, data/contract-rfcs.ts, data/contract-stats.ts). The bearer token picks who is asking:
//   tok-voice    a person with a voice       tok-novoice   a person with none (`not_a_person`)
//   tok-anon     a voice that answers rfc_open_law only anonymously      (no token: a visitor)
// FAKE_EMPTY=1 answers no proposal at all. State (responses) lives in this module's memory.
//
// The anonymous voice (api-worker data/contract-anonymity.ts, routes/contract.ts § anonymous voice): a person registers
// a commitment (POST/GET /contract/anonymity/commitment), the public tree is read at an instant
// (GET /public/contract/anonymity/group?kind=&at=), and the anonymous acts (…/anonymous-responses, -media, -lookup,
// -contest) carry a Semaphore proof. The fake checks each proof as the API does (message, scope, pinned root) and
// verifies it with the API's own verifier (CommandAGI's api-worker src/data/semaphore.ts, through tsx; CAGI names the
// checkout). Two other members are in the `person` set from the start. A registration is dated ten days back, so the two
// anonymous proposals (ANON_OPEN, opened three days ago; ANON_CLOSED, nine) pinned it: a browser check answers them at
// once. The fake reads every anonymous voice of ANON_CLOSED as having answered it once.
import { Group, Identity } from '../vendor/semaphore/semaphore.js';
import { anonymousMessage, contractHash, responseDigest, rfcScope, sha256Hex } from '../anon.js';
const DAY = 86_400_000;
const T0 = Date.now();
const H = c => c.repeat(64).slice(0, 64);
const law = (id, over = {}) => ({ id, target: 'law', title: id, summary: '', changes: [], ...over });

const base = (id, title, over = {}) => ({
  procedure: 'binding_score', id, opener: 'person:opener', title, body: `Why this matters.\n\nSecond paragraph of ${id}.`, target: 'law',
  options: [
    { id: 'status_quo', target: 'none', title: 'keep things as they are', summary: 'No change.' },
    law('longer', { title: 'A longer window', summary: 'Give people more time.', changes: [{ op: 'set_parameter', key: 'lawRfcWindowMs', value: 21 * DAY }, { op: 'set_parameter', key: 'rfcDepositCents', value: 2500 }] }),
    law('duty', { title: 'A new duty', summary: 'Say what is owed.', changes: [{ op: 'add_duty', duty: { id: 'd-notice', title: 'Give notice' } }] }),
  ],
  openedAt: T0 - 3 * DAY, closesAt: T0 + 4 * DAY, contestMs: 3 * DAY, contractVersion: 3, engineHash: H('b'), baseStateHash: H('c'), people: ['person'], anonymity: { person: { root: '1', size: 0 } }, depositCents: 1000,
  ...over,
});
const tally = (provisional) => ({ respondents: 5, scores: { longer: 4, duty: -2 }, histogram: { longer: [0, 1, 1, 2, 1], duty: [1, 2, 1, 1, 0] }, unscored: { longer: 0, duty: 1 }, favored: 'longer', recordDigest: H('d'), ...(provisional === undefined ? {} : { provisional }) });

const R = {};
const add = (rfc, status, over = {}) => (R[rfc.id] = { rfc, status, responses: 0, decision: null, decisionHash: null, concurrence: null, tally: null, ...over });
if (!process.env.FAKE_EMPTY) {
  add(base('rfc_open_law', 'Give every RFC a longer window'), 'open', { responses: 7 });
  add(base('rfc_open_engine', 'Seat a new reader', { target: 'engine', procedure: 'deliberative', closesAt: T0 + 9 * DAY, options: [{ id: 'status_quo', target: 'none', title: 'keep things as they are', summary: 'No change.' }, { id: 'clef2', target: 'engine', title: 'Clef 2', summary: 'A newer reader.', engine: { name: 'clef-2', embedding: { seat: { id: 's1' } } } }] }), 'open', { responses: 0 });
  add(base('rfc_markup', '<img src=x onerror=alert(1)> Fewer <b>rules</b> & more "trust"', { closesAt: T0 + 11 * DAY, body: '<script>alert(2)</script> plain words' }), 'open', { responses: 2 });
  add(base('rfc_contest', 'Pay the pool by the month', { openedAt: T0 - 9 * DAY, closesAt: T0 - 2 * DAY }), 'contest', { responses: 5, tally: tally(true) });
  add(base('rfc_deciding', 'Let a case be reopened', { openedAt: T0 - 20 * DAY, closesAt: T0 - 8 * DAY }), 'deciding', { responses: 9, tally: tally(false), concurrence: { outgoing: 'det_out', outgoingUnavailableSince: undefined } });
  add(base('rfc_adopted', 'Lower the case deposit', { openedAt: T0 - 40 * DAY, closesAt: T0 - 26 * DAY }), 'adopted', { responses: 12, tally: tally(false), decisionHash: H('e'), concurrence: { outgoing: 'det_out' }, decision: { rfcId: 'rfc_adopted', adopted: 'longer', tally: tally(), concurrence: ['det_out'], reason: 'The tally is positive and uniquely highest, and the engine concurs.', depositReturned: true, participation: { respondents: 12, unscored: {}, representativeness: 'Twelve voices from three kinds of people.' } } });
  add(base('rfc_rejected', 'Remove the appeal window', { openedAt: T0 - 40 * DAY, closesAt: T0 - 30 * DAY }), 'rejected', { responses: 4, tally: tally(false), decisionHash: H('f'), decision: { rfcId: 'rfc_rejected', adopted: null, tally: tally(), concurrence: [], reason: 'No change had a positive, uniquely highest score.', depositReturned: false } });
}
R.rfc_open_law && (R.rfc_open_law.rfc.anonymity = { person: { root: '9', size: 3 } });

// ─── the anonymous voice ───────────────────────────────────────────────────
export const ANON_OPEN = 'a0'.repeat(32);
export const ANON_CLOSED = 'c0'.repeat(32);
const COMMITS = ['fake member one', 'fake member two'].map((seed, i) => ({ voice: `person:seed${i}`, kind: 'person', commitment: new Identity(seed).commitment.toString(), at: T0 - 30 * DAY + i, replacedAt: null }));
const leavesAt = (kind, at) => COMMITS.filter(c => c.kind === kind && c.at <= at && (c.replacedAt === null || c.replacedAt > at)).sort((a, b) => a.at - b.at || (a.commitment < b.commitment ? -1 : a.commitment > b.commitment ? 1 : 0)).map(c => c.commitment);
const treeOf = leaves => (leaves.length ? { root: new Group(leaves.map(l => BigInt(l))).root.toString(), size: leaves.length } : { root: '0', size: 0 });
const inPinned = (voice, at) => COMMITS.some(c => c.voice === voice && c.at <= at && (c.replacedAt === null || c.replacedAt > at));
const ANON = {}; // rfcId → voice → [{ id, digest, receivedAt, parts }]
const anonContested = new Set();
const repin = () => {
  for (const id of [ANON_OPEN, ANON_CLOSED]) if (R[id]) R[id].rfc.anonymity = { person: treeOf(leavesAt('person', R[id].rfc.openedAt)) };
};
if (!process.env.FAKE_EMPTY) {
  add(base(ANON_OPEN, 'Answer anonymously: publish every reading'), 'open', { responses: 3 });
  add(base(ANON_CLOSED, 'Answer anonymously: a shorter appeal', { openedAt: T0 - 9 * DAY, closesAt: T0 - 2 * DAY }), 'contest', { responses: 4, tally: tally(true) });
  repin();
}

let oracle = null;
/** The API's own Groth16 check, run here as the API runs it. */
async function verify(proof) {
  oracle ??= (async () => {
    const cagi = process.env.CAGI ?? '/home/brandonin/Documents/commandagi';
    const { register } = await import(`${cagi}/node_modules/tsx/dist/esm/api/index.mjs`);
    register();
    return (await import(`${cagi}/deployments/platform/cloudflare/api-worker/src/data/semaphore.ts`)).verifySemaphoreProof;
  })();
  return (await oracle)(proof);
}

const field = v => typeof v === 'string' && /^[0-9]{1,78}$/.test(v);
/** The API's `check`: the RFC, the kind, the proof's shape, then the claim against the pinned set, then the proof. */
async function check(rfcId, kind, proof, action, extra = {}) {
  const r = R[rfcId];
  if (!r) return { status: 404, body: { error: 'not_found' } };
  if (typeof kind !== 'string') return { status: 400, body: { error: 'kind' } };
  if (!proof || typeof proof !== 'object') return { status: 400, body: { error: 'proof_missing' } };
  if (!['merkleTreeRoot', 'nullifier', 'message', 'scope'].every(k => field(proof[k])) || !Array.isArray(proof.points) || proof.points.length !== 8) return { status: 400, body: { error: 'malformed_proof' } };
  const expected = await anonymousMessage(action, { rfcId, ...extra });
  const set = r.rfc.anonymity?.[kind];
  const why = !r.rfc.people.includes(kind) ? 'kind_not_recognized_at_open' : !set || set.size === 0 ? 'no_anonymity_set_at_open' : proof.merkleTreeRoot !== set.root ? 'not_the_pinned_tree' : proof.scope !== rfcScope(rfcId) ? 'wrong_scope' : proof.message !== expected ? 'wrong_message' : null;
  if (why) return { status: why.endsWith('_at_open') ? 409 : 403, body: { error: why } };
  if (!(await verify(proof))) return { status: 403, body: { error: 'proof_does_not_verify' } };
  return { r, voice: `anon:${kind}:${proof.nullifier}` };
}

async function anonymousRoute(method, path, query, headers, body) {
  let m;
  if (path === '/public/contract/anonymity/group' && method === 'GET') {
    const kind = query.kind ?? 'human';
    const at = query.at ? Number(query.at) : Date.now();
    const leaves = leavesAt(kind, at);
    return { body: { kind, at, leaves, ...treeOf(leaves), log: COMMITS.filter(c => c.kind === kind).map(({ commitment, at: t, replacedAt }) => ({ commitment, at: t, replacedAt })) } };
  }
  if (!(m = path.match(/^\/public\/contract\/rfcs\/([^/]+)\/anonymous-(responses|media|lookup|contest)$/)) || method !== 'POST') return undefined;
  const [, rfcId, act] = m;
  if (act === 'responses') {
    const parts = body?.parts;
    if (!Array.isArray(parts) || !parts.length || parts.length > 20) return { status: 400, body: { error: 'malformed_parts' } };
    if (!/^[0-9a-f]{64}$/.test(body?.nonce ?? '')) return { status: 400, body: { error: 'malformed_nonce' } };
    if (parts.some(p => p.type === 'ref' && p.ref !== `r2:contract/evidence/${p.sha256}`)) return { status: 422, body: { error: 'anonymous_media_must_be_uploaded' } };
    const digest = await responseDigest(rfcId, parts);
    const ok = await check(rfcId, body.kind, body.proof, 'respond', { digest, nonce: body.nonce });
    if (!ok.voice) return ok;
    if (ok.r.status !== 'open' || Date.now() > ok.r.rfc.closesAt) return { status: 409, body: { error: 'closed' } };
    const id = `anon-${await contractHash('rfc-anonymous-response-id', { voice: ok.voice, nonce: body.nonce })}`;
    const mine = ((ANON[rfcId] ??= {})[ok.voice] ??= []);
    if (!mine.some(x => x.id === id)) mine.push({ id, digest, receivedAt: Date.now(), parts });
    return { status: 201, body: { receipt: { id, digest, nullifier: body.proof.nullifier }, voice: ok.voice } };
  }
  if (act === 'media') {
    let proof;
    try {
      proof = JSON.parse(Buffer.from(String(headers['x-contract-proof'] ?? ''), 'base64url').toString('utf8'));
    } catch {
      return { status: 400, body: { error: 'malformed_proof' } };
    }
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body ?? ''));
    const sha256 = await sha256Hex(new Uint8Array(bytes));
    const ok = await check(rfcId, headers['x-contract-kind'], proof, 'media', { sha256 });
    if (!ok.voice) return ok;
    const mime = String(headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!/^(image|audio)\//.test(mime)) return { status: 415, body: { error: 'unsupported_media_type' } };
    return { status: 201, body: { part: { type: 'ref', ref: `r2:contract/evidence/${sha256}`, mime, modality: mime.split('/')[0], sha256 } } };
  }
  const ok = await check(rfcId, body?.kind, body?.proof, act === 'lookup' ? 'lookup' : 'contest');
  if (!ok.voice) return ok;
  const answered = rfcId === ANON_CLOSED ? [{ id: 'anon-seeded', digest: H('6'), receivedAt: ok.r.rfc.closesAt - DAY, parts: [{ type: 'text', text: 'A shorter appeal helps nobody who needs time.' }] }] : (ANON[rfcId]?.[ok.voice] ?? []);
  const interpretation = rfcId === ANON_CLOSED ? { ...extraction(ok.r.rfc), voice: ok.voice, responseId: 'anon-seeded', contested: anonContested.has(ok.voice) } : null;
  if (act === 'lookup') return { body: { voice: ok.voice, responses: answered, interpretation } };
  if (!interpretation) return { status: 409, body: { error: 'no_interpretation_yet' } };
  if (anonContested.has(ok.voice)) return { status: 409, body: { error: 'already_contested' } };
  anonContested.add(ok.voice);
  return { status: 202, body: { ok: true } };
}

const DET = { det_out: { id: 'det_out', kind: 'rfc.concurrence', prompt: 'Does the tally stand?', labels: ['concur', 'object'], packageDigest: H('a'), engineHash: H('b'), at: T0 - 27 * DAY, rounds: [{ tier: 2, seats: ['clef', 'clef-flash'], answers: [{ seat: 'clef', label: 'concur', confidence: 910, ms: 812 }, { seat: 'clef-flash', label: null, confidence: 0, error: 'timeout' }], aggregate: { label: 'concur', confidence: 910, groups: 1 }, decisive: true, note: 'quorum of one group' }], outcome: { status: 'decided', label: 'concur', confidence: 910, tier: 2 } } };

const WHO = { 'tok-voice': { voice: 'person:aaa', entity: 'person:aaa' }, 'tok-novoice': { voice: null, why: 'not_a_person', entity: 'person:bbb' }, 'tok-anon': { voice: 'person:ccc', entity: 'person:ccc', anonymous: true } };
const mine = {}; // `${token}:${rfcId}` → responses
const extraction = (rfc) => ({ rfcId: rfc.id, voice: 'person:aaa', responseId: 'r1', scores: { longer: 2, duty: -1 }, unscored: { duty: 'unresolved' }, determinations: [], availableAt: T0 - DAY, contestUntil: T0 + 2 * DAY, contested: false });
const contested = new Set();

const view = (r, tok) => {
  const key = `${tok}:${r.rfc.id}`;
  const ex = tok === 'tok-voice' && ['contest', 'deciding'].includes(r.status) ? { ...extraction(r.rfc), contested: contested.has(r.rfc.id) } : null;
  return { ...r, myResponses: tok ? (mine[key] ?? []) : [], myExtraction: tok ? ex : null, responses: r.responses + (mine[key] ?? []).filter(x => x.confirmedAt).length + Object.keys(ANON[r.rfc.id] ?? {}).length };
};
const tallyView = (r) => ({ at: T0, id: r.rfc.id, title: r.rfc.title, body: r.rfc.body, target: r.rfc.target, procedure: r.rfc.procedure, status: r.status, openedAt: r.rfc.openedAt, closesAt: r.rfc.closesAt, contractVersion: 3, engineHash: r.rfc.engineHash, people: r.rfc.people, options: r.rfc.options.map(({ id, target, title, summary }) => ({ id, target, title, summary })), responses: r.responses, tally: r.tally, decision: r.decision ? { adopted: r.decision.adopted, reason: r.decision.reason, decidedAt: r.rfc.closesAt + DAY, decisionHash: r.decisionHash, depositReturned: r.decision.depositReturned, participation: r.decision.participation ? { respondents: r.decision.participation.respondents, representativeness: r.decision.participation.representativeness } : null, determinations: r.decision.concurrence.map(i => ({ id: i, kind: DET[i].kind, outcome: 'decided', label: 'concur', tier: 2 })) } : null });

export default async ({ method, path, query, headers, body }) => {
  const anon = await anonymousRoute(method, path, query ?? {}, headers, body);
  if (anon) return anon;
  const auth = String(headers.authorization ?? '').replace(/^Bearer /, '');
  const tok = WHO[auth] ? auth : null;
  const who = tok && WHO[tok];
  if (path === '/oauth/token') return { body: { access_token: 'tok-voice', refresh_token: 'r', expires_in: 3600 } };
  if (path === '/me') return who ? { body: { id: who.entity, name: 'Test Person', email: 't@example.com' } } : { status: 401, body: { error: 'unauthorized' } };
  if (path === '/public/contract/stats') return { body: { parameters: { lawRfcWindowMs: 14 * DAY, engineRfcWindowMs: 28 * DAY, extractionContestMs: 3 * DAY, rfcDepositCents: 1000, caseResponseMs: 7 * DAY, appealMs: 7 * DAY, caseDepositCents: 500 } } };
  if (path === '/public/contract/rfcs') return { body: { rfcs: Object.values(R).sort((a, b) => b.rfc.openedAt - a.rfc.openedAt).map(r => ({ id: r.rfc.id, title: r.rfc.title, target: r.rfc.target, status: r.status, openedAt: r.rfc.openedAt, closesAt: r.rfc.closesAt, adopted: r.decision?.adopted ?? null })) } };
  let m;
  if ((m = path.match(/^\/public\/contract\/determinations\/([^/]+)$/))) return DET[m[1]] ? { body: { determination: DET[m[1]] } } : { status: 404, body: { error: 'not_found' } };
  if ((m = path.match(/^\/public\/contract\/rfcs\/([^/]+)\/tally$/))) return R[m[1]] ? { body: tallyView(R[m[1]]) } : { status: 404, body: { error: 'not_found' } };
  if ((m = path.match(/^\/public\/contract\/rfcs\/([^/]+)$/))) return R[m[1]] ? { body: view(R[m[1]], null) } : { status: 404, body: { error: 'not_found' } };
  if (!who) return { status: 401, body: { error: 'unauthorized' } };
  if (path === '/contract/me') return { body: { entity: who.entity, ...(who.voice ? { voice: who.voice } : { voice: null, why: who.why }), verification: null, cases: [], unreadNotices: 0 } };
  if (path === '/contract/awaiting') return { body: { entity: who.entity, at: T0, voice: who.voice, why: who.why ?? null, rfcs: !who.voice ? [] : Object.values(R).filter(r => r.status === 'open').filter(r => !(mine[`${tok}:${r.rfc.id}`] ?? []).some(x => x.confirmedAt)).map(r => ({ id: r.rfc.id, title: r.rfc.title, target: r.rfc.target, procedure: r.rfc.procedure, options: r.rfc.options.length - 1, closesAt: r.rfc.closesAt, unconfirmed: (mine[`${tok}:${r.rfc.id}`] ?? []).length > 0, anonymous: (!!who.anonymous && r.rfc.id === 'rfc_open_law') || ((r.rfc.anonymity?.person?.size ?? 0) > 0 && inPinned(who.voice, r.rfc.openedAt)) })), contests: [], cases: [], decisions: [] } };
  if (path === '/contract/media' && method === 'POST') {
    const type = String(headers['content-type'] ?? '').split(';')[0];
    if (!/^(image|audio)\//.test(type)) return { status: 415, body: { error: 'unsupported_media_type' } };
    return { status: 201, body: { part: { type: 'ref', ref: 'r2:abc', mime: type, modality: type.split('/')[0], sha256: H('7') } } };
  }
  if ((m = path.match(/^\/contract\/rfcs\/([^/]+)$/)) && method === 'GET') return R[m[1]] ? { body: view(R[m[1]], tok) } : { status: 404, body: { error: 'not_found' } };
  if ((m = path.match(/^\/contract\/rfcs\/([^/]+)\/responses$/)) && method === 'POST') {
    const r = R[m[1]];
    if (!r) return { status: 404, body: { error: 'not_found' } };
    if (!who.voice) return { status: 403, body: { error: who.why } };
    if ((who.anonymous && r.rfc.id === 'rfc_open_law') || ((r.rfc.anonymity?.person?.size ?? 0) > 0 && inPinned(who.voice, r.rfc.openedAt))) return { status: 409, body: { error: 'respond_anonymously' } };
    if (r.status !== 'open') return { status: 409, body: { error: 'closed' } };
    const parts = body?.parts;
    if (!Array.isArray(parts) || !parts.length) return { status: 400, body: { error: 'malformed_parts' } };
    const id = `resp_${Math.random().toString(16).slice(2, 10)}`;
    const digest = H(String(parts.length) + id.slice(5));
    (mine[`${tok}:${m[1]}`] ??= []).push({ id, digest, at: Date.now(), confirmedAt: null, parts });
    return { status: 201, body: { receipt: { id, digest }, voice: who.voice } };
  }
  if ((m = path.match(/^\/contract\/rfcs\/([^/]+)\/responses\/([^/]+)\/confirm$/)) && method === 'POST') {
    const x = (mine[`${tok}:${m[1]}`] ?? []).find(y => y.id === m[2]);
    if (!x) return { status: 404, body: { error: 'not_found' } };
    if (body?.digest !== x.digest) return { status: 409, body: { error: 'digest_mismatch' } };
    x.confirmedAt = Date.now();
    return { body: { ok: true, confirmedAt: x.confirmedAt } };
  }
  if (path === '/contract/anonymity/commitment' && method === 'GET') {
    const c = who.voice ? COMMITS.find(x => x.voice === who.voice && x.replacedAt === null) : null;
    return { body: { commitment: c ? { commitment: c.commitment, kind: c.kind, at: c.at } : null } };
  }
  if (path === '/contract/anonymity/commitment' && method === 'POST') {
    const c = body?.commitment;
    const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    if (typeof c !== 'string' || !/^[0-9]{1,78}$/.test(c) || BigInt(c) === 0n || BigInt(c) >= FIELD) return { status: 400, body: { error: 'malformed_commitment' } };
    if (!who.voice) return { status: 403, body: { error: who.why } };
    const taken = COMMITS.find(x => x.kind === 'person' && x.commitment === c);
    if (taken) return { status: 409, body: { error: taken.voice === who.voice ? 'already_registered' : 'commitment_taken' } };
    // Dated ten days back (see the header), and after every earlier registration of this voice.
    const active = COMMITS.find(x => x.voice === who.voice && x.replacedAt === null);
    const at = Math.max(T0 - 10 * DAY, (active?.at ?? 0) + 1);
    if (active) active.replacedAt = at;
    COMMITS.push({ voice: who.voice, kind: 'person', commitment: c, at, replacedAt: null });
    repin();
    return { status: 201, body: { ok: true, kind: 'person', rotated: !!active } };
  }
  if ((m = path.match(/^\/contract\/rfcs\/([^/]+)\/contest$/)) && method === 'POST') {
    if (contested.has(m[1])) return { status: 409, body: { error: 'already_contested' } };
    contested.add(m[1]);
    return { status: 202, body: { ok: true } };
  }
  return undefined;
};
