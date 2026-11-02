// What a visitor can check without trusting the platform: the kernel's hash and the transparency log's chain,
// recomputed here with Web Crypto from the public record. The rules are the contract's own (CommandAGI
// packages/domain/core/src/contract/hash.ts, kernel.ts, transparency.ts): sha256 over "cc:<domain>:v4\n" and the
// canonical JSON of the object. Pure: no DOM, no network. The same file runs in the page and in site.test.mjs.

/** Canonical JSON: keys sorted recursively, no whitespace, undefined keys left out. */
export function canonicalJson(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('canonicalJson: a number that is not finite');
  return JSON.stringify(v);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export const contractHash = (domain, value) => sha256Hex(`cc:${domain}:v4\n${canonicalJson(value)}`);

/** The kernel's hash from its articles, floors and protected interests (`GET /public/contract` → `kernel`). */
export function kernelHash(kernel) {
  const articles = kernel.articles.map(a => `${a.id}. ${a.title} — ${a.text}`).join('\n\n') + '\n';
  return contractHash('kernel', { articles, floors: kernel.floors, interests: kernel.interests });
}

export const LOG_GENESIS_PREV = '0'.repeat(64);

/**
 * Check a contiguous run of log entries: each hash recomputes, each `prev` is the entry before's hash, no sequence
 * number is skipped. → the problems, one line each; none means the run holds.
 */
export async function logProblems(entries) {
  const problems = [];
  let before = null;
  for (const e of entries) {
    if (before && e.seq !== before.seq + 1) problems.push(`entry ${e.seq}: expected ${before.seq + 1}`);
    if (before ? e.prev !== before.hash : e.seq === 1 && e.prev !== LOG_GENESIS_PREV) problems.push(`entry ${e.seq}: its prev is not the entry before`);
    const hash = await contractHash('log', { seq: e.seq, prev: e.prev, kind: e.kind, subject: e.subject, bodyDigest: e.bodyDigest, at: e.at });
    if (hash !== e.hash) problems.push(`entry ${e.seq}: its hash does not recompute`);
    before = e;
  }
  return problems;
}
