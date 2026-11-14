// A fake API for `node test/serve.mjs --fake test/fake-rfcs.mjs`: the proposal routes with the shapes the api-worker
// answers (routes/contract.ts, data/contract-rfcs.ts, data/contract-stats.ts). The bearer token picks who is asking:
//   tok-voice    a person with a voice       tok-novoice   a person with none (`not_a_person`)
//   tok-anon     a voice that answers rfc_open_law only anonymously      (no token: a visitor)
// FAKE_EMPTY=1 answers no proposal at all. State (responses) lives in this module's memory.
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

const DET = { det_out: { id: 'det_out', kind: 'rfc.concurrence', prompt: 'Does the tally stand?', labels: ['concur', 'object'], packageDigest: H('a'), engineHash: H('b'), at: T0 - 27 * DAY, rounds: [{ tier: 2, seats: ['clef', 'clef-flash'], answers: [{ seat: 'clef', label: 'concur', confidence: 910, ms: 812 }, { seat: 'clef-flash', label: null, confidence: 0, error: 'timeout' }], aggregate: { label: 'concur', confidence: 910, groups: 1 }, decisive: true, note: 'quorum of one group' }], outcome: { status: 'decided', label: 'concur', confidence: 910, tier: 2 } } };

const WHO = { 'tok-voice': { voice: 'person:aaa', entity: 'person:aaa' }, 'tok-novoice': { voice: null, why: 'not_a_person', entity: 'person:bbb' }, 'tok-anon': { voice: 'person:ccc', entity: 'person:ccc', anonymous: true } };
const mine = {}; // `${token}:${rfcId}` → responses
const extraction = (rfc) => ({ rfcId: rfc.id, voice: 'person:aaa', responseId: 'r1', scores: { longer: 2, duty: -1 }, unscored: { duty: 'unresolved' }, determinations: [], availableAt: T0 - DAY, contestUntil: T0 + 2 * DAY, contested: false });
const contested = new Set();

const view = (r, tok) => {
  const key = `${tok}:${r.rfc.id}`;
  const ex = tok === 'tok-voice' && ['contest', 'deciding'].includes(r.status) ? { ...extraction(r.rfc), contested: contested.has(r.rfc.id) } : null;
  return { ...r, myResponses: tok ? (mine[key] ?? []) : [], myExtraction: tok ? ex : null, responses: r.responses + (mine[key] ?? []).filter(x => x.confirmedAt).length };
};
const tallyView = (r) => ({ at: T0, id: r.rfc.id, title: r.rfc.title, body: r.rfc.body, target: r.rfc.target, procedure: r.rfc.procedure, status: r.status, openedAt: r.rfc.openedAt, closesAt: r.rfc.closesAt, contractVersion: 3, engineHash: r.rfc.engineHash, people: r.rfc.people, options: r.rfc.options.map(({ id, target, title, summary }) => ({ id, target, title, summary })), responses: r.responses, tally: r.tally, decision: r.decision ? { adopted: r.decision.adopted, reason: r.decision.reason, decidedAt: r.rfc.closesAt + DAY, decisionHash: r.decisionHash, depositReturned: r.decision.depositReturned, participation: r.decision.participation ? { respondents: r.decision.participation.respondents, representativeness: r.decision.participation.representativeness } : null, determinations: r.decision.concurrence.map(i => ({ id: i, kind: DET[i].kind, outcome: 'decided', label: 'concur', tier: 2 })) } : null });

export default ({ method, path, headers, body }) => {
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
  if (path === '/contract/awaiting') return { body: { entity: who.entity, at: T0, voice: who.voice, why: who.why ?? null, rfcs: !who.voice ? [] : Object.values(R).filter(r => r.status === 'open').filter(r => !(mine[`${tok}:${r.rfc.id}`] ?? []).some(x => x.confirmedAt)).map(r => ({ id: r.rfc.id, title: r.rfc.title, target: r.rfc.target, procedure: r.rfc.procedure, options: r.rfc.options.length - 1, closesAt: r.rfc.closesAt, unconfirmed: (mine[`${tok}:${r.rfc.id}`] ?? []).length > 0, anonymous: !!who.anonymous && r.rfc.id === 'rfc_open_law' })), contests: [], cases: [], decisions: [] } };
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
    if (who.anonymous && r.rfc.id === 'rfc_open_law') return { status: 409, body: { error: 'respond_anonymously' } };
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
  if ((m = path.match(/^\/contract\/rfcs\/([^/]+)\/contest$/)) && method === 'POST') {
    if (contested.has(m[1])) return { status: 409, body: { error: 'already_contested' } };
    contested.add(m[1]);
    return { status: 202, body: { ok: true } };
  }
  return undefined;
};
