// The anonymous voice (anon.js): its message, scope and digest against the contract's core, its proofs against the
// API's own verifier, and its acts end to end against the fake API, in Node with the vendored prover.
// Run: node --test test/anon.test.mjs
//
// The oracles are CommandAGI's own code, imported by absolute path (CAGI names the checkout):
//   - the core: packages/domain/core/src/contract/ (anonymity.ts, rfc.ts, hash.ts), run through tsx;
//   - the verifier: deployments/platform/cloudflare/api-worker/src/data/semaphore.ts (`verifySemaphoreProof`, the
//     Groth16 check the API runs in workerd), run through tsx.
// The pinned values below were computed by that core for the fixtures of its own test,
// packages/domain/core/src/contract/anonymity.test.ts ("messages are domain-separated by action…": rfcId "a"×64,
// digest "b"×64, nonces "1"×64 and "2"×64; "a claim acts only against the pinned root…": the RFC `rfcWith` opens with
// anonymity { human: { root: "123", size: 3 } }, scope of "ab"×32; "anonymous responses replace each other…": the
// texts "yes" and "no"), so this file also passes where the checkout is absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as A from '../anon.js';
import { serve } from './serve.mjs';
import fake, { ANON_OPEN, ANON_CLOSED } from './fake-rfcs.mjs';

const CAGI = process.env.CAGI ?? '/home/brandonin/Documents/commandagi';
const read = f => readFileSync(new URL(`../${f}`, import.meta.url));
const hasCagi = existsSync(`${CAGI}/node_modules/tsx/dist/esm/api/index.mjs`);
let tsx = null;
const viaTsx = async path => {
  tsx ??= import(`${CAGI}/node_modules/tsx/dist/esm/api/index.mjs`).then(m => m.register());
  await tsx;
  return import(`${CAGI}/${path}`);
};
const core = () => viaTsx('packages/domain/core/src/contract/index.ts');
const apiVerifier = async () => (await viaTsx('deployments/platform/cloudflare/api-worker/src/data/semaphore.ts')).verifySemaphoreProof;

const rfcId = 'a'.repeat(64);
const digest = 'b'.repeat(64);
// The RFC the core's test opens with a pinned set (`rfcWith({ human: { root: "123", size: 3 } })`).
const OPENED = 'e00c92600c11033c172af7509a9b812005a7506f9b1bda724dc34767df500984';
const PINNED = {
  respond1: '108953919728000674263982059152275903206078482685081067768551018315470087736868',
  respond2: '63095524580860748251987165225054380501407954823260654180929379140186072747549',
  media: '47389065503898182650539644101150498325324008944267254915758680313655450999206',
  contest: '36326003299202879223148276325116000103406950953078882982184922437998845365503',
  lookup: '33713637839271551338276712545341876194388475794266611551668246168433845780037',
  scopeA: '77194726158210796949047323339125271902179989777093709359638389338608753093290',
  hexAB: '77648812782670860460512307594061302913369283834606025297048026922953510464427',
  openedScope: '101340290491821269168753609172533757795514024299176313496553428258000252963204',
  openedContest: '6306444983647921698168113408021682268503399503377754319605043080926338561392',
  digestYes: '810924856aa70fd8fea7d403659d8010c6e14ce412b7f43531e217c780f44db7',
  digestNo: 'd46e93f982bc24aabe4243616ff0ca1972a208b6fdc4b3131d688e58487e23c7',
  digestRef: '2d10c9874c1440c209487c1d27e70e0a6b93c4e22d5ecb400ea14c72713c27a6',
  canon: '{"a":[true,null,"x",1.5],"b":1,"é":{"y":"q","z":0}}',
};
const sha = 'c'.repeat(64);
const refParts = [{ type: 'text', text: 'é “quoted” \n line' }, { type: 'ref', ref: `r2:contract/evidence/${sha}`, mime: 'image/png', modality: 'image', sha256: sha }];

test('the message, scope and digest equal the core’s for the fixtures of its own test', async () => {
  assert.equal(await A.anonymousMessage('respond', { rfcId, digest, nonce: '1'.repeat(64) }), PINNED.respond1);
  assert.equal(await A.anonymousMessage('respond', { rfcId, digest, nonce: '2'.repeat(64) }), PINNED.respond2);
  assert.equal(await A.anonymousMessage('media', { rfcId, sha256: digest }), PINNED.media);
  assert.equal(await A.anonymousMessage('contest', { rfcId }), PINNED.contest);
  assert.equal(await A.anonymousMessage('lookup', { rfcId }), PINNED.lookup);
  assert.equal(A.rfcScope(rfcId), PINNED.scopeA);
  assert.equal(A.hexField('ab'.repeat(32)), PINNED.hexAB);
  assert.equal(A.rfcScope(OPENED), PINNED.openedScope);
  assert.equal(await A.anonymousMessage('contest', { rfcId: OPENED }), PINNED.openedContest);
  assert.equal(await A.responseDigest(OPENED, [{ type: 'text', text: 'yes' }]), PINNED.digestYes);
  assert.equal(await A.responseDigest(OPENED, [{ type: 'text', text: 'no' }]), PINNED.digestNo);
  assert.equal(await A.responseDigest(rfcId, refParts), PINNED.digestRef);
  assert.equal(A.canonicalJson({ b: 1, a: [true, null, 'x', 1.5], c: undefined, é: { z: -0, y: 'q' } }), PINNED.canon);
  await assert.rejects(A.anonymousMessage('respond', { rfcId, digest, nonce: 'short' }));
  assert.throws(() => A.rfcScope('rfc_open_law'), TypeError);
});

test('the port and the core agree live, on the core’s fixtures and on other inputs', { skip: !hasCagi && 'no CommandAGI checkout' }, async () => {
  const C = await core();
  const law = C.genesisLaw(['platform_kyc']);
  const r = await C.openRfc(
    { opener: 'u1', title: 't', body: 'b', options: [{ id: 'five', target: 'law', title: 'five', summary: '', changes: [{ op: 'set_parameter', key: 'rfcDepositCents', value: 500 }] }] },
    { law, engine: C.GENESIS_ENGINE, engineHash: 'e', stateHash: 's', contractVersion: 0, now: 0, anonymity: { human: { root: '123', size: 3 } } },
  );
  assert.equal(r.rfc.id, OPENED, 'the fixture RFC is the one the pinned values name');
  const ids = [rfcId, OPENED, createHash('sha256').update('another').digest('hex')];
  const partsList = [[{ type: 'text', text: 'yes' }], refParts, [{ type: 'text', text: '{"k":"v"}   \u{1F600}' }]];
  for (const id of ids) {
    assert.equal(A.rfcScope(id), C.rfcScope(id));
    for (const action of ['contest', 'lookup']) assert.equal(await A.anonymousMessage(action, { rfcId: id }), await C.anonymousMessage(action, { rfcId: id }));
    assert.equal(await A.anonymousMessage('media', { rfcId: id, sha256: sha }), await C.anonymousMessage('media', { rfcId: id, sha256: sha }));
    for (const parts of partsList) {
      const d = await A.responseDigest(id, parts);
      assert.equal(d, await C.responseDigest(id, parts));
      assert.equal(await A.anonymousMessage('respond', { rfcId: id, digest: d, nonce: '9'.repeat(64) }), await C.anonymousMessage('respond', { rfcId: id, digest: d, nonce: '9'.repeat(64) }));
    }
  }
});

test('the depth: a tree proves from its own depth’s files, and a deeper tree than the site has is refused by name', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8, 9, 256, 257].map(A.semaphoreDepth), [1, 1, 2, 2, 3, 3, 4, 8, 9]);
  assert.match(A.proverArtifacts(3, 'https://x/a').wasm, /^https:\/\/x\/a\/semaphore-2\.wasm$/);
  assert.match(A.proverArtifacts(2 ** A.MAX_DEPTH).zkey, new RegExp(`semaphore-${A.MAX_DEPTH}\\.zkey$`));
  assert.throws(() => A.proverArtifacts(2 ** A.MAX_DEPTH + 1), e => e.code === 'prover_depth_missing' && e.detail.includes(`depth ${A.MAX_DEPTH + 1}`) && e.detail.includes(`semaphore-${A.MAX_DEPTH + 1}.wasm`));
  for (let d = 1; d <= A.MAX_DEPTH; d++) {
    for (const ext of ['wasm', 'zkey']) {
      const f = new URL(`../vendor/semaphore/artifacts/semaphore-${d}.${ext}`, import.meta.url);
      assert.ok(statSync(f).size > 1_000_000 && statSync(f).size < 25 * 2 ** 20, `${f.pathname}: present, and under the host's 25 MB`);
    }
  }
  assert.ok(!existsSync(new URL(`../vendor/semaphore/artifacts/semaphore-${A.MAX_DEPTH + 1}.wasm`, import.meta.url)), 'MAX_DEPTH is the deepest file shipped');
});

test('the vendored files are the ones LICENSES.md records, byte for byte', () => {
  const lic = String(read('vendor/semaphore/LICENSES.md'));
  const files = ['semaphore.js', ...Array.from({ length: A.MAX_DEPTH }, (_, i) => [`artifacts/semaphore-${i + 1}.wasm`, `artifacts/semaphore-${i + 1}.zkey`]).flat()];
  for (const f of files) {
    const h = createHash('sha256').update(read(`vendor/semaphore/${f}`)).digest('hex');
    assert.ok(lic.includes(`${h}  vendor/semaphore/${f}`), `${f}: its sha256 is recorded (rerun redesign/vendor-semaphore.mjs and copy what it prints)`);
  }
  for (const [name, version, licence] of [['@semaphore-protocol/identity', '4.14.3', 'MIT'], ['@semaphore-protocol/group', '4.14.3', 'MIT'], ['@semaphore-protocol/proof', '4.14.3', 'MIT'], ['snarkjs', '0.7.5', 'GPL-3.0'], ['ffjavascript', '0.3.1', 'GPL-3.0'], ['@zk-kit/semaphore-artifacts', '4.13.0', 'MIT']])
    assert.ok(lic.includes(`| ${name} | ${version} | ${licence} |`), `${name} ${version} ${licence}`);
});

test('the prover is never loaded with a page: only an act imports it', () => {
  const src = String(read('anon.js'));
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]);
  assert.deepEqual(imports, ['./live.js', './contract-words.js'], 'anon.js imports no prover at load');
  for (const page of ['rfc.html', 'rfcs.html', 'index.html', 'record.html']) assert.ok(!String(read(page)).includes('vendor/semaphore'), `${page} does not load the prover`);
  assert.ok(!String(read('rfc.js')).includes('vendor/'), 'rfc.js reaches the prover only through anon.js');
});

test('the identity: a saved file loads back, here and in the editor’s format; a changed file is refused', async () => {
  const rec = await A.makeIdentity(new Date(Date.UTC(2026, 10, 13)));
  assert.equal(rec.kind, 'commandagi.contract.identity');
  assert.match(rec.commitment, /^[0-9]+$/);
  const text = A.identityFileText(rec);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['kind', 'version', 'privateKey', 'commitment', 'createdAt'], 'the editor’s IdentityFile');
  assert.equal((await A.parseIdentityFile(text)).commitment, rec.commitment);
  const { Identity } = await A.loadProver();
  assert.equal(Identity.import(rec.privateKey).commitment.toString(), rec.commitment, 'the key is the identity');
  assert.equal(await A.parseIdentityFile(text.replace(rec.commitment, '12345')), null, 'a commitment that is not the key’s');
  assert.equal(await A.parseIdentityFile(JSON.stringify({ ...JSON.parse(text), kind: 'other' })), null);
  assert.equal(await A.parseIdentityFile('not json'), null);
  const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  assert.equal(A.loadIdentity(storage), null);
  assert.equal(A.saveIdentity(rec, storage), true);
  assert.equal(A.loadIdentity(storage).commitment, rec.commitment);
  assert.equal(A.saveIdentity(null, storage), true);
  assert.equal(A.loadIdentity(storage), null);
  assert.equal(A.saveIdentity(rec, { setItem() { throw new Error('quota'); } }), false, 'storage refused is said, not thrown');
});

test('end to end: register, answer anonymously with media, and the API’s verifier accepts the proof; the same identity keeps its nullifier in one RFC and not across RFCs', { timeout: 120_000, skip: !hasCagi && 'no CommandAGI checkout' }, async () => {
  const s = await serve({ fake });
  const verify = await apiVerifier();
  const sent = [];
  // Every request the module sends, as sent: the test reads the proofs and the request's credentials from here.
  const spy = async (url, init) => {
    sent.push({ url, init });
    return fetch(url, init);
  };
  const o = { api: s.origin, artifacts: `${s.origin}/vendor/semaphore/artifacts/`, kind: 'person', fetch: spy, onStep: (k) => steps.push(k) };
  const steps = [];
  try {
    const rec = await A.makeIdentity();
    const reg = await fetch(`${s.origin}/contract/anonymity/commitment`, { method: 'POST', headers: { authorization: 'Bearer tok-voice', 'content-type': 'application/json' }, body: JSON.stringify({ commitment: rec.commitment }) });
    assert.equal(reg.status, 201);
    const load = async id => (await (await fetch(`${s.origin}/public/contract/rfcs/${id}`)).json()).rfc;
    const open = await load(ANON_OPEN);
    assert.equal(open.anonymity.person.size, 3, 'two members and this identity');
    const tree = await A.pinnedTree(open, 'person', o);
    assert.ok(A.inTree(rec, tree));

    // Media first, as a person attaches it: a proof binds the bytes' sha256.
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], { type: 'image/png' });
    const media = await A.uploadMediaAnonymously(rec, open, png, o);
    assert.equal(media.ok, true, JSON.stringify(media));
    assert.equal(media.part.ref, `r2:contract/evidence/${media.part.sha256}`);

    const t0 = performance.now();
    const first = await A.respondAnonymously(rec, open, [{ type: 'text', text: 'Publish them.' }, { ...media.part, label: 'my-name.png' }], o);
    const ms = performance.now() - t0;
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.deepEqual(steps.slice(-4), ['tree', 'prover', 'proof', 'send'], 'each step is said');
    const req = sent.findLast(x => x.url.endsWith('/anonymous-responses'));
    assert.equal(req.init.credentials, 'omit');
    assert.equal(req.init.referrerPolicy, 'no-referrer');
    assert.ok(!Object.keys(req.init.headers).some(h => h.toLowerCase() === 'authorization'), 'no token');
    const body = JSON.parse(req.init.body);
    assert.ok(!req.init.body.includes(rec.privateKey), 'the secret never leaves');
    assert.ok(!req.init.body.includes('my-name.png'), 'a file name is not sent');
    // The oracle: the API's own verifier, on the proof exactly as sent, and its public signals as the core binds them.
    assert.equal(await verify(body.proof), true);
    assert.equal(body.proof.scope, A.rfcScope(ANON_OPEN));
    assert.equal(body.proof.merkleTreeRoot, open.anonymity.person.root);
    assert.equal(body.proof.merkleTreeDepth, 2);
    const C = await core();
    assert.equal(body.proof.message, await C.anonymousMessage('respond', { rfcId: ANON_OPEN, digest: await C.responseDigest(ANON_OPEN, body.parts), nonce: body.nonce }));
    assert.equal(await verify({ ...body.proof, nullifier: (BigInt(body.proof.nullifier) + 1n).toString() }), false, 'a forged nullifier is refused');
    assert.equal(await verify({ ...body.proof, message: (BigInt(body.proof.message) + 1n).toString() }), false, 'another message is refused');
    assert.equal(first.receipt.nullifier, body.proof.nullifier);
    console.log(`# one anonymous response proved and sent in ${Math.round(ms)} ms (Node, one thread, depth 2)`);

    const second = await A.respondAnonymously(rec, open, [{ type: 'text', text: 'Publish them, all of them.' }], o);
    assert.equal(second.ok, true);
    assert.equal(second.receipt.nullifier, first.receipt.nullifier, 'a second answer to the same RFC is the same voice');
    assert.notEqual(second.receipt.id, first.receipt.id);

    const closed = await load(ANON_CLOSED);
    const look = await A.lookupAnonymously(rec, closed, o);
    assert.equal(look.ok, true, JSON.stringify(look));
    const lookProof = JSON.parse(sent.findLast(x => x.url.endsWith('/anonymous-lookup')).init.body).proof;
    assert.equal(await verify(lookProof), true);
    assert.notEqual(lookProof.nullifier, first.receipt.nullifier, 'another RFC, another nullifier: unlinkable');
    assert.equal(look.lookup.voice, `anon:person:${lookProof.nullifier}`);
    assert.ok(look.lookup.interpretation);
    const contest = await A.contestAnonymously(rec, closed, o);
    assert.equal(contest.ok, true, JSON.stringify(contest));
    const again = await A.contestAnonymously(rec, closed, o);
    assert.deepEqual(again, { ok: false, refusals: [{ code: 'already_contested' }] });

    // A stranger's identity is not in the set: refused here, before anything is proved or sent.
    const stranger = await A.makeIdentity();
    const before = sent.length;
    assert.deepEqual(await A.respondAnonymously(stranger, open, [{ type: 'text', text: 'x' }], o), { ok: false, refusals: [{ code: 'not_in_pinned_tree' }] });
    // A set that is not the one the RFC pinned: nothing is sent.
    assert.deepEqual(await A.respondAnonymously(rec, { ...open, anonymity: { person: { root: '1', size: 3 } } }, [{ type: 'text', text: 'x' }], o), { ok: false, refusals: [{ code: 'tree_mismatch' }] });
    assert.ok(sent.slice(before).every(x => x.url.includes('/anonymity/group')), 'only the public set was read');
    // The API is not reached: said as such.
    assert.deepEqual((await A.respondAnonymously(rec, open, [{ type: 'text', text: 'x' }], { ...o, api: 'http://127.0.0.1:9' })).refusals[0].code, 'network');
  } finally {
    await s.close();
  }
});

test('the desk panel: the identity’s state and its acts, in words', () => {
  const base = { commitment: null, signedIn: true, voice: 'human:a', why: null, meFailed: false, registered: null, group: undefined, pending: false, note: null, refusals: [] };
  const none = A.renderAnonymity(base);
  assert.match(none, /This device holds no anonymous identity yet/);
  assert.match(none, /data-anon="create"/);
  assert.match(none, /data-anon="load"/);
  assert.match(none, /on this device only/);
  assert.match(none, /Clearing this site’s data/);
  assert.ok(!none.includes('data-anon="register"'));
  const c = '1234567890123456789012345';
  const fresh = A.renderAnonymity({ ...base, commitment: c, group: { kind: 'human', size: 2, leaves: ['1', '2'] } });
  assert.match(fresh, /commitment 1234567890123456…/);
  assert.match(fresh, /Not registered/);
  assert.match(fresh, /data-anon="register">Register this identity/);
  assert.match(fresh, /data-anon="save"/);
  assert.match(fresh, /not among the 2 members of the <code>human<\/code> set/);
  const done = A.renderAnonymity({ ...base, commitment: c, registered: { commitment: c, kind: 'human', at: Date.UTC(2026, 10, 1) }, group: { kind: 'human', size: 3, leaves: ['1', c, '2'] }, note: 'registered' });
  assert.match(done, /Registered: this identity/);
  assert.match(done, /member 2 of 3 in the <code>human<\/code> set now/);
  assert.match(done, /RFCs opened from now on are answered anonymously/);
  assert.ok(!done.includes('data-anon="register"'));
  const other = A.renderAnonymity({ ...base, commitment: c, registered: { commitment: '999', kind: 'human', at: 1 }, group: null });
  assert.match(other, /Registered: another identity/);
  assert.match(other, /data-anon="register">Replace the registered identity with this one/);
  assert.match(other, /could not be read just now/);
  assert.match(A.renderAnonymity({ ...base, signedIn: false }), /Sign in to register/);
  assert.match(A.renderAnonymity({ ...base, voice: null, why: 'not_a_person' }), /no voice yet/);
  const refused = A.renderAnonymity({ ...base, refusals: [{ code: 'commitment_taken' }, { code: 'prover_depth_missing', detail: 'depth <9>' }] });
  assert.match(refused, /registered to someone else/);
  assert.match(refused, /depth &lt;9&gt;/);
});
