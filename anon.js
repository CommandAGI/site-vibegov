// The anonymous voice on this site (CommandAGI docs/coordination-contract.md § anonymous voice): a port of the contract
// editor's `anonymity.ts` (packages/applets/contract/src/ui/) and its AnonymityPanel, and of the core's message, scope
// and digest (packages/domain/core/src/contract/anonymity.ts, rfc.ts, hash.ts), byte for byte (test/anon.test.mjs).
//
// The person's Semaphore identity lives only on this device: in this origin's storage, and in the file the person
// saves. It is never sent anywhere. Registering it sends only its COMMITMENT, signed in as the person
// (`POST /contract/anonymity/commitment`). Every anonymous act (a response, its media, a look-up of how it was read, a
// contest) is proved here, in this browser, and sent to the API's public routes with no token, no cookie and no
// referrer (`credentials: 'omit'`).
//
// Semaphore is vendored (built by redesign/vendor-semaphore.mjs) in two modules, each loaded only when a person starts
// an act that needs it (dynamic import), never on page load:
//   vendor/semaphore/identity.js   make, save, load an identity. No WebAssembly: any page's CSP admits it.
//   vendor/semaphore/semaphore.js  the prover. Its proving artifacts are this site's own files
//                                  (vendor/semaphore/artifacts/), so no third party learns who is proving. A page that
//                                  proves needs `'wasm-unsafe-eval'` in script-src and `worker-src blob:` (its threads
//                                  are blob workers) in its CSP.
//
// Nothing here touches `document` at import time, so test/anon.test.mjs runs it in Node.
import { esc, date } from './live.js';
import { words, hasWords, refusalKey } from './contract-words.js';

export const STORAGE_KEY = 'vibegov.contract.identity';
/** The editor's file kind, so a file saved here loads in the workbench, and one saved there loads here. */
export const IDENTITY_FILE_KIND = 'commandagi.contract.identity';
export const IDENTITY_FILE_NAME = 'contract.identity';
/**
 * The deepest tree this site has proving artifacts for: 2^8 = 256 registered persons of one kind. Keep in step with
 * `--depths` of redesign/vendor-semaphore.mjs. A deeper tree is refused by name (`prover_depth_missing`).
 */
export const MAX_DEPTH = 8;
export const IDENTITY_URL = new URL('./vendor/semaphore/identity.js', import.meta.url).href;
export const PROVER_URL = new URL('./vendor/semaphore/semaphore.js', import.meta.url).href;
export const ARTIFACTS_BASE = new URL('./vendor/semaphore/artifacts/', import.meta.url).href;

// ─── the core's hashes (hash.ts, rfc.ts, anonymity.ts) ─────────────────────

/** Canonical JSON: object keys sorted recursively; refuses undefined in arrays, NaN, ±Infinity, functions and symbols. */
export function canonicalJson(value) {
  return write(value, '$');
}
function write(v, path) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'boolean':
      return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) throw new Error(`canonicalJson: non-finite number at ${path}`);
      return JSON.stringify(v);
    case 'string':
      return JSON.stringify(v);
    case 'object': {
      if (Array.isArray(v)) return `[${v.map((x, i) => write(x, `${path}[${i}]`)).join(',')}]`;
      const keys = Object.keys(v).filter(k => v[k] !== undefined).sort();
      return `{${keys.map(k => `${JSON.stringify(k)}:${write(v[k], `${path}.${k}`)}`).join(',')}}`;
    }
    default:
      throw new Error(`canonicalJson: unsupported ${typeof v} at ${path}`);
  }
}

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

/** `sha256("cc:<domain>:v4\n" + canonicalJson(value))`, lowercase hex. */
export const contractHash = (domain, value) => sha256Hex(`cc:${domain}:v4\n${canonicalJson(value)}`);

/** What a response's receipt binds. */
export const responseDigest = (rfcId, parts) => contractHash('rfc-response', { rfcId, parts });

/** A 64-hex digest as the decimal 32-byte value a Semaphore proof signs (message or scope). */
export function hexField(h) {
  if (!/^[0-9a-f]{64}$/.test(h)) throw new TypeError('expected 64 lowercase hex digits');
  return BigInt(`0x${h}`).toString();
}

/** The scope of every proof in one RFC: its id as a field value. */
export const rfcScope = rfcId => hexField(rfcId);

/** The message a proof signs for an action, domain-separated; a response binds its digest and a fresh nonce. */
export async function anonymousMessage(action, input) {
  switch (action) {
    case 'respond':
      if (!input.digest || !/^[0-9a-f]{64}$/.test(input.nonce ?? '')) throw new TypeError('a response message needs its digest and a 64-hex nonce');
      return hexField(await contractHash('rfc-anonymous-response', { rfcId: input.rfcId, digest: input.digest, nonce: input.nonce }));
    case 'media':
      if (!input.sha256) throw new TypeError('a media message needs its sha256');
      return hexField(await contractHash('rfc-anonymous-media', { rfcId: input.rfcId, sha256: input.sha256 }));
    case 'contest':
      return hexField(await contractHash('rfc-anonymous-contest', { rfcId: input.rfcId }));
    case 'lookup':
      return hexField(await contractHash('rfc-anonymous-lookup', { rfcId: input.rfcId }));
    default:
      throw new TypeError(`no such anonymous action: ${action}`);
  }
}

// ─── the prover and its artifacts ──────────────────────────────────────────

/** A refusal raised inside an act; the act answers it as `{ ok: false, refusals: [{ code, detail }] }`. */
export class Refusal extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    if (detail) this.detail = detail;
  }
}

/** The depth of a tree of `size` commitments (Semaphore's lean incremental Merkle tree): the artifacts are per depth. */
export function semaphoreDepth(size) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, size))));
}

/** The two artifact URLs a proof over a tree of `size` commitments needs, from this site; refused when it has none. */
export function proverArtifacts(size, base = ARTIFACTS_BASE) {
  const depth = semaphoreDepth(size);
  if (depth > MAX_DEPTH) {
    throw new Refusal(
      'prover_depth_missing',
      `This proposal's set has ${size} members, a tree of depth ${depth}. This site has proving files up to depth ${MAX_DEPTH} (${2 ** MAX_DEPTH} members): vendor/semaphore/artifacts/semaphore-${depth}.wasm and semaphore-${depth}.zkey are missing.`,
    );
  }
  const at = `${String(base).replace(/\/?$/, '/')}semaphore-${depth}`;
  return { wasm: `${at}.wasm`, zkey: `${at}.zkey` };
}

let identities = null;
let prover = null;
const unavailable = e => {
  throw new Refusal('prover_unavailable', e?.message);
};
/** { Identity, Group }, loaded once, on the first act that makes or reads an identity. */
export const loadIdentityLib = () => (identities ??= import(IDENTITY_URL).catch(e => ((identities = null), unavailable(e))));
/** { Identity, Group, generateProof }, loaded once, on the first act that proves. */
export const loadProver = () => (prover ??= import(PROVER_URL).catch(e => ((prover = null), unavailable(e))));

// ─── the identity ──────────────────────────────────────────────────────────
//
// Held as the editor's file object: { kind, version: 4, privateKey, commitment, createdAt }. Its `privateKey` IS the
// identity; the commitment is kept beside it so a page can show and compare it without loading any of Semaphore.

const asRecord = (identity, createdAt) => ({ kind: IDENTITY_FILE_KIND, version: 4, privateKey: identity.export(), commitment: identity.commitment.toString(), createdAt });

const wellFormed = f => !!f && f.kind === IDENTITY_FILE_KIND && typeof f.privateKey === 'string' && typeof f.commitment === 'string' && /^[0-9]{1,78}$/.test(f.commitment);

/** A new identity, made on this device. */
export async function makeIdentity(now = new Date()) {
  const { Identity } = await loadIdentityLib();
  return asRecord(new Identity(), now.toISOString());
}

/** The saved file's text (plain JSON the person keeps as `contract.identity`). */
export const identityFileText = rec => `${JSON.stringify({ kind: rec.kind, version: rec.version, privateKey: rec.privateKey, commitment: rec.commitment, createdAt: rec.createdAt }, null, 2)}\n`;

/** Read a saved identity file; null when it is not one, or its commitment does not match its key. */
export async function parseIdentityFile(text, now = new Date()) {
  let f;
  try {
    f = JSON.parse(text);
  } catch {
    return null;
  }
  if (!f || f.kind !== IDENTITY_FILE_KIND || typeof f.privateKey !== 'string') return null;
  const { Identity } = await loadIdentityLib();
  try {
    const id = Identity.import(f.privateKey);
    if (f.commitment && f.commitment !== id.commitment.toString()) return null;
    return asRecord(id, typeof f.createdAt === 'string' ? f.createdAt : now.toISOString());
  } catch {
    return null;
  }
}

const store = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** This device's identity, or null. Reads storage only: nothing of Semaphore is loaded. */
export function loadIdentity(storage = store()) {
  try {
    const f = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return wellFormed(f) ? f : null;
  } catch {
    return null;
  }
}

/** Keep (or forget, with null) this device's identity; false when the browser would not store it. */
export function saveIdentity(rec, storage = store()) {
  try {
    if (!storage) return false;
    if (rec) storage.setItem(STORAGE_KEY, JSON.stringify(rec));
    else storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// ─── the public routes, without the session ────────────────────────────────

const apiOf = o => (o.api ?? globalThis.document?.querySelector?.('meta[name="vibegov-api"]')?.content ?? 'https://api.commandagi.com').replace(/\/+$/, '');

/** One request to the API's public door with no credential, no cookie and no referrer. */
async function anonymous(path, init, o = {}) {
  try {
    return await (o.fetch ?? fetch)(`${apiOf(o)}${path}`, { ...init, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  } catch {
    throw new Refusal('network');
  }
}

async function outcome(res, pick) {
  const data = (await res.json().catch(() => ({}))) ?? {};
  if (res.ok) return { ok: true, ...pick(data) };
  return { ok: false, refusals: [{ code: typeof data.error === 'string' ? data.error : `http_${res.status}` }] };
}

const failed = e => ({ ok: false, refusals: [e instanceof Refusal ? { code: e.code, ...(e.detail ? { detail: e.detail } : {}) } : { code: 'proof_failed', ...(e?.message ? { detail: String(e.message).slice(0, 200) } : {}) }] });

/** A kind's public tree at an instant (now, by default): `{ kind, at, leaves, root, size }`, or null if not read. */
export async function groupAt(kind, at, o = {}) {
  try {
    const q = `kind=${encodeURIComponent(kind)}${at === undefined ? '' : `&at=${encodeURIComponent(at)}`}`;
    const res = await anonymous(`/public/contract/anonymity/group?${q}`, { headers: { accept: 'application/json' } }, o);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The kind's tree as it stood when the RFC opened: what its proofs must be against. */
export const pinnedTree = (rfc, kind = 'human', o = {}) => groupAt(kind, rfc.openedAt, o);

/** Whether this identity is in the tree (then this person answers that RFC only anonymously). */
export const inTree = (rec, tree) => !!rec && !!tree && Array.isArray(tree.leaves) && tree.leaves.includes(rec.commitment);

/** The kind of people a voice belongs to (`human:<key>` → human). */
export const kindOf = voice => (voice ? String(voice).split(':')[0] : null) || 'human';

/** The kinds an RFC pinned a non-empty set for: the only kinds that can answer it anonymously. */
export const anonymousKinds = rfc => Object.entries(rfc?.anonymity ?? {}).filter(([, s]) => (s?.size ?? 0) > 0).map(([k]) => k);

/**
 * Which pinned tree of this RFC holds this identity: `{ kind, tree }`, or `{ kind: null, tree: null }`. `prefer` is the
 * person's own kind when known; a visitor's identity is looked for in every kind the RFC pinned.
 */
export async function findTree(rec, rfc, prefer, o = {}) {
  const kinds = anonymousKinds(rfc).sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : 0));
  let first = null;
  for (const kind of kinds) {
    const tree = await pinnedTree(rfc, kind, o);
    if (!tree) return { kind, tree: null, failed: true };
    first ??= { kind, tree };
    if (inTree(rec, tree)) return { kind, tree };
  }
  return first ?? { kind: null, tree: null };
}

/** The plain line said while an act runs, one per step. No animation: the line changes when the step does. */
export const STEPS = {
  tree: 'Reading this proposal’s anonymity set…',
  prover: 'Loading the prover from this site…',
  proof: 'Making the proof on this device. This takes a few seconds…',
  hash: 'Reading the file on this device…',
  send: 'Sending without your session…',
};
const step = (o, key) => o.onStep?.(key, STEPS[key]);

/** A Semaphore proof over the RFC's pinned tree, made here; refuses if the published tree is not the pinned one. */
async function prove(rec, rfc, message, kind, o) {
  step(o, 'tree');
  const tree = await pinnedTree(rfc, kind, o);
  if (!tree) throw new Refusal('network');
  const pinned = rfc.anonymity?.[kind];
  if (!pinned || tree.root !== pinned.root || tree.size !== pinned.size) throw new Refusal('tree_mismatch');
  if (!inTree(rec, tree)) throw new Refusal('not_in_pinned_tree');
  const artifacts = proverArtifacts(tree.size, o.artifacts);
  step(o, 'prover');
  const { Identity, Group, generateProof } = await loadProver();
  const identity = Identity.import(rec.privateKey);
  if (identity.commitment.toString() !== rec.commitment) throw new Refusal('malformed_identity_file');
  step(o, 'proof');
  // The depth, and the files compiled for it, come from this tree: this site's files, never a third party's.
  return generateProof(identity, new Group(tree.leaves.map(l => BigInt(l))), message, rfcScope(rfc.id), semaphoreDepth(tree.size), artifacts);
}

/** How long to hold an anonymous submission before sending it (so its timing says less): none, or random up to a bound. */
export function delayMs(choice, random = Math.random) {
  return choice === 'minutes' ? Math.floor(random() * 10 * 60_000) : choice === 'hour' ? Math.floor(random() * 60 * 60_000) : 0;
}

const randomNonce = () => hex(crypto.getRandomValues(new Uint8Array(32)));

/** An anonymous response carries no file names: a name can say who someone is. */
export const anonymousParts = parts => parts.map(p => (p.type === 'text' ? p : (({ label, ...rest }) => rest)(p)));

/**
 * Respond anonymously: prove the response's digest with a fresh nonce, wait if asked, send. The proof is the
 * confirmation; a later answer by the same identity replaces it (the same nullifier).
 * `o`: { kind, delay (ms), onStep, api, fetch, artifacts }.
 */
export async function respondAnonymously(rec, rfc, parts, o = {}) {
  try {
    const kind = o.kind ?? 'human';
    const sent = anonymousParts(parts);
    const nonce = randomNonce();
    const digest = await responseDigest(rfc.id, sent);
    const proof = await prove(rec, rfc, await anonymousMessage('respond', { rfcId: rfc.id, digest, nonce }), kind, o);
    if (o.delay) {
      o.onStep?.('wait', words('anonymity')('status.anonymousWaiting'));
      await new Promise(r => setTimeout(r, o.delay));
    }
    step(o, 'send');
    const res = await anonymous(`/public/contract/rfcs/${encodeURIComponent(rfc.id)}/anonymous-responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ kind, parts: sent, nonce, proof }),
    }, o);
    return await outcome(res, d => ({ receipt: d.receipt }));
  } catch (e) {
    return failed(e);
  }
}

/** Upload a media file for an anonymous response, under a proof binding its sha256 to this RFC. */
export async function uploadMediaAnonymously(rec, rfc, file, o = {}) {
  try {
    const kind = o.kind ?? 'human';
    step(o, 'hash');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const proof = await prove(rec, rfc, await anonymousMessage('media', { rfcId: rfc.id, sha256 }), kind, o);
    const header = btoa(JSON.stringify(proof)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    step(o, 'send');
    const res = await anonymous(`/public/contract/rfcs/${encodeURIComponent(rfc.id)}/anonymous-media`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream', accept: 'application/json', 'x-contract-kind': kind, 'x-contract-proof': header },
      body: bytes,
    }, o);
    return await outcome(res, d => ({ part: d.part }));
  } catch (e) {
    return failed(e);
  }
}

/** One's own anonymous responses and how they were read: `{ voice, responses, interpretation }` (a proof is the key). */
export async function lookupAnonymously(rec, rfc, o = {}) {
  try {
    const kind = o.kind ?? 'human';
    const proof = await prove(rec, rfc, await anonymousMessage('lookup', { rfcId: rfc.id }), kind, o);
    step(o, 'send');
    const res = await anonymous(`/public/contract/rfcs/${encodeURIComponent(rfc.id)}/anonymous-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ kind, proof }),
    }, o);
    return await outcome(res, d => ({ lookup: d }));
  } catch (e) {
    return failed(e);
  }
}

/** Contest how one's anonymous response was read, once. */
export async function contestAnonymously(rec, rfc, o = {}) {
  try {
    const kind = o.kind ?? 'human';
    const proof = await prove(rec, rfc, await anonymousMessage('contest', { rfcId: rfc.id }), kind, o);
    step(o, 'send');
    const res = await anonymous(`/public/contract/rfcs/${encodeURIComponent(rfc.id)}/anonymous-contest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ kind, proof }),
    }, o);
    return await outcome(res, () => ({}));
  } catch (e) {
    return failed(e);
  }
}

// ─── saving and loading the file ───────────────────────────────────────────

/** Hand the person the identity as a file to keep (`contract.identity`). */
export function downloadIdentity(rec) {
  const url = URL.createObjectURL(new Blob([identityFileText(rec)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: IDENTITY_FILE_NAME });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read a chosen file onto this device: the record, or a refusal. */
export async function loadIdentityFile(file) {
  const rec = await parseIdentityFile(await file.text());
  if (!rec) return { ok: false, refusals: [{ code: 'malformed_identity_file' }] };
  return { ok: true, rec, stored: saveIdentity(rec) };
}

// ─── words ─────────────────────────────────────────────────────────────────

/** What the site says about where the identity lives (the brief: plainly, before any act). */
export const DEVICE_ONLY =
  'The identity is kept in this browser, on this device only. It never leaves this device: only its commitment is registered. Clearing this site’s data, or closing a private window, deletes it. Save it to a file and keep the file private: whoever holds the file can answer as you.';

/** A refusal in the catalog's words, a code it does not know as its code, and the detail beside it. */
export function renderAnonRefusals(refusals) {
  if (!refusals?.length) return '';
  const text = r => {
    const key = refusalKey(r.code);
    return key && hasWords('refusals', key) ? words('refusals')(key) : words('refusals')('unknown', { code: r.code });
  };
  return `<div class="refusal" role="alert"><ul>${refusals.map(r => `<li>${esc(text(r))}${r.detail ? ` <small>${esc(r.detail)}</small>` : ''} <code>${esc(r.code)}</code></li>`).join('')}</ul></div>`;
}

// ─── the panel a desk page mounts ──────────────────────────────────────────

/**
 * The identity's state and its acts, as escaped HTML (pure). `s`:
 *   commitment   this device's identity's commitment, or null
 *   signedIn, voice, why, meFailed          who is looking (from GET /contract/me)
 *   registered   { commitment, kind, at } | null | undefined (not read)
 *   group        this kind's tree now ({ kind, size, leaves }) | null (not read)
 *   pending, note, refusals
 */
export function renderAnonymity(s) {
  const t = words('anonymity');
  const mine = s.commitment;
  const matches = !!mine && s.registered?.commitment === mine;
  const device = mine
    ? `${esc(t('haveIdentity', { commitment: mine.slice(0, 16) }))} <code class="digest" title="${esc(mine)}">${esc(mine)}</code>`
    : esc(t('noIdentity'));
  let registered;
  if (!s.signedIn) registered = 'Sign in to register an identity for your voice.';
  else if (s.meFailed) registered = 'Your voice could not be read just now. Reload to try again.';
  else if (!s.voice) registered = `You have no voice yet, so you cannot register an identity. ${s.why ? esc(words('refusals')(refusalKey(s.why) ?? 'unknown', { code: s.why })) : ''}`;
  else if (s.registered === undefined) registered = 'Reading what your voice registered…';
  else registered = `<span class="state${matches ? ' state--done' : s.registered ? ' state--bad' : ''}">${esc(matches ? t('registeredThis') : s.registered ? t('registeredOther') : t('notRegistered'))}</span>${s.registered ? ` <span class="note">${esc(t('since', { when: date(s.registered.at) }))}</span>` : ''}${
    s.registered && !matches ? ` <span class="note">The registered commitment is <code title="${esc(s.registered.commitment)}">${esc(s.registered.commitment.slice(0, 16))}…</code>.</span>` : ''
  }`;
  const kind = s.group?.kind ?? s.kind ?? 'human';
  let set;
  if (!mine) set = 'No identity on this device to look for.';
  else if (s.group === undefined) set = 'Reading the public set…';
  else if (!s.group) set = 'The public set could not be read just now.';
  else {
    const i = s.group.leaves.indexOf(mine);
    set =
      i >= 0
        ? `Yes: member ${i + 1} of ${s.group.size} in the <code>${esc(kind)}</code> set now. Every proposal opened from now on pins this set, and you answer those anonymously.`
        : `No: this identity is not among the ${s.group.size} members of the <code>${esc(kind)}</code> set now.${matches ? '' : ' Register it to join the set.'}`;
  }
  const busy = s.pending ? ' disabled' : '';
  const acts = [
    !mine ? `<button class="btn small${s.signedIn && s.voice ? '' : ' primary'}" type="button" data-anon="create"${busy}>${esc(t('create'))}</button>` : `<button class="btn small" type="button" data-anon="save"${busy}>Save the identity to a file</button>`,
    `<button class="btn small" type="button" data-anon="load"${busy}>Load an identity file</button><input type="file" data-anon="file" accept=".identity,application/json" hidden>`,
    mine && s.signedIn && s.voice && s.registered !== undefined && !matches ? `<button class="btn small primary" type="button" data-anon="register"${busy}>${esc(s.registered ? t('rotate') : t('register'))}</button>` : '',
  ].join('');
  return `<p>${esc(t('note'))}</p>
<dl class="kv">
<dt>On this device</dt><dd>${device}</dd>
<dt>Registered</dt><dd>${registered}</dd>
<dt>In the set</dt><dd>${set}</dd>
</dl>
<p class="note">${esc(DEVICE_ONLY)}</p>
<ul class="note">${['ruleOnlyAnonymous', 'ruleRotation', 'ruleKeepFile', 'ruleLinkability'].map(k => `<li>${esc(t(k))}</li>`).join('')}</ul>
<div class="form__act">${acts}</div>
${s.step ? `<p class="note" role="status">${esc(s.step)}</p>` : ''}${s.note ? `<p class="done" role="status">${esc(t(`notes.${s.note}`))}</p>` : ''}${renderAnonRefusals(s.refusals)}`;
}

/**
 * Mount the anonymous-voice section in `container` (an element of a desk page; the heading is the caller's): the
 * identity on this device, what the voice registered and whether it is in the public set, with its acts: create,
 * register (or replace), save to a file, load from a file. vendor/semaphore/identity.js loads only on create and load;
 * the panel never proves, so its page needs no CSP change.
 */
export async function renderAnonymityPanel(container) {
  const { signedIn } = await import('./session.js');
  const A = await import('./contract-api.js');
  const S = { commitment: loadIdentity()?.commitment ?? null, signedIn: signedIn(), voice: null, why: null, meFailed: false, registered: undefined, group: undefined, kind: 'human', pending: false, note: null, refusals: [], step: null };
  const paint = () => {
    container.innerHTML = renderAnonymity(S);
  };
  const readGroup = async () => {
    S.group = S.commitment ? await groupAt(S.kind) : undefined;
  };
  const read = async () => {
    S.signedIn = signedIn();
    if (S.signedIn) {
      const me = await A.loadMe();
      S.meFailed = !me;
      S.voice = me?.voice ?? null;
      S.why = me?.why ?? null;
      S.kind = kindOf(S.voice);
      S.registered = S.voice ? await A.loadMyCommitment() : null;
    }
    await readGroup();
  };
  paint();
  await read();
  paint();
  document.addEventListener('session', async () => {
    await read();
    paint();
  });
  const run = async (stepLine, act) => {
    S.pending = true;
    S.note = null;
    S.refusals = [];
    S.step = stepLine;
    paint();
    try {
      await act();
    } finally {
      S.pending = false;
      S.step = null;
      paint();
    }
  };
  container.addEventListener('click', async e => {
    const b = e.target.closest('[data-anon]');
    if (!b || b.disabled) return;
    const a = b.dataset.anon;
    if (a === 'load') return container.querySelector('[data-anon="file"]')?.click();
    if (a === 'save') {
      const rec = loadIdentity();
      if (!rec) return;
      downloadIdentity(rec);
      S.note = 'exported';
      return paint();
    }
    if (a === 'create') {
      return run('Making an identity on this device…', async () => {
        try {
          const rec = await makeIdentity();
          S.commitment = rec.commitment;
          S.note = saveIdentity(rec) ? null : 'storageUnavailable';
          await readGroup();
        } catch (err) {
          S.refusals = failed(err).refusals;
        }
      });
    }
    if (a === 'register') {
      return run('Registering the commitment, signed in as you…', async () => {
        const r = await A.registerCommitment(S.commitment);
        if (!r.ok) {
          S.refusals = r.refusals;
          return;
        }
        S.registered = await A.loadMyCommitment();
        S.note = r.rotated ? 'rotated' : 'registered';
        await readGroup();
      });
    }
  });
  container.addEventListener('change', async e => {
    if (e.target.dataset?.anon !== 'file' || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    await run('Reading the identity file on this device…', async () => {
      try {
        const r = await loadIdentityFile(file);
        if (!r.ok) {
          S.refusals = r.refusals;
          return;
        }
        S.commitment = r.rec.commitment;
        S.note = r.stored ? 'imported' : 'storageUnavailable';
        await readGroup();
      } catch (err) {
        S.refusals = failed(err).refusals;
      }
    });
  });
}
