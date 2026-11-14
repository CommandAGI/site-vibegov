// The signed-in person's session (redesign/APP.md § the session). VibeGov is a brand of CommandAGI: a platform-owned
// OAuth client (`vibegov`, CommandAGI docs/brands.md). A person signs in here with their CommandAGI account, and the
// page calls the API from the browser with that person's own token. The site holds no credential of its own, has no
// server and no database, and acts for nobody but the signed-in person. The token is kept in this origin's storage.
export const CLIENT = 'vibegov';
export const API = (document.querySelector('meta[name="vibegov-api"]')?.content || 'https://api.commandagi.com').replace(/\/+$/, '');
const KEY = 'vibegov.session';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The stored session `{ access, refresh, expiresAt, userId, name }`, or null. */
export function session() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function keepSession(s) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* storage may be off: the session lasts for this page */ }
  document.dispatchEvent(new CustomEvent('session', { detail: s }));
}
export const signedIn = () => !!session()?.access;

/** A refusal of the API: `status` (0 when it could not be reached), `code` (the API's `error`), `body`, and plain words in `message`. */
export class ApiError extends Error {
  constructor(status, body, path) {
    super(body?.message || body?.detail || body?.error_description || SAY[body?.error] || (status === 0 ? SAY.unreachable : `The request was refused (${status}).`));
    this.status = status; this.code = body?.error; this.body = body; this.path = path;
  }
}
const SAY = {
  unauthorized: 'Sign in first.',
  forbidden: 'This account may not do that.',
  not_found: 'That record was not found.',
  email_taken: 'An account with this email exists already. Sign in instead.',
  invalid_grant: 'That email or password is not right.',
  invalid_request: 'Something is missing from the form.',
  slow_down: 'Too many tries. Wait a minute and try again.',
  signup_capped: 'New accounts are limited today. Try again tomorrow.',
  password_too_short: 'Use 8 characters or more.',
  name_required: 'Give your name.',
  invalid_email: 'That email address does not look right.',
  account_suspended: 'This account is suspended.',
  unreachable: 'The contract’s API could not be reached. Check your connection and try again.',
};

async function token(fields) {
  const res = await fetch(`${API}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, '/oauth/token');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body, '/oauth/token');
  return body;
}
const keep = (body, more = {}) => {
  const s = { ...(session() ?? {}), access: body.access_token, refresh: body.refresh_token ?? null, expiresAt: Date.now() + (Number(body.expires_in) || 0) * 1000, ...more };
  keepSession(s);
  return s;
};
async function named() {
  const me = await api('/me');
  keepSession({ ...session(), userId: me.id, name: me.name ?? me.displayName ?? me.email ?? '' });
  return me;
}

/** Sign in with a CommandAGI account's email and password (the token endpoint's password grant for this client). */
export async function signIn({ email, password }) {
  keep(await token({ grant_type: 'password', client_id: CLIENT, username: String(email).trim(), password, scope: '*' }));
  return named();
}

/** Make the account and sign it in, in one call (`POST /oauth/signup`). `more` carries what the form adds (a Turnstile token, for one). */
export async function signUp({ name, email, password, ...more }) {
  const res = await fetch(`${API}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: CLIENT, name, email: String(email).trim(), password, scope: '*', ...more }) }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, '/oauth/signup');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body, '/oauth/signup');
  keep(body, { userId: body.userId });
  return named();
}

let refreshing = null;
async function refresh() {
  const s = session();
  if (!s?.refresh) return false;
  refreshing ??= token({ grant_type: 'refresh_token', client_id: CLIENT, refresh_token: s.refresh })
    .then(body => { keep(body); return true; })
    // A refresh that lost a race to another tab's (the stored token moved on) is not a dead session.
    .catch(() => { if (session()?.refresh && session().refresh !== s.refresh) return true; keepSession(null); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
}
async function alive() {
  const s = session();
  if (!s?.access) return false;
  const r = await fetch(`${API}/me`, { headers: { authorization: `Bearer ${s.access}` } }).catch(() => null);
  return !!r && r.status !== 401;
}

/** Sign out: revoke this client's grant on the account, then forget the token. */
export async function signOut() {
  try {
    if (session()?.access) {
      const { grants = [] } = await api('/me/oauth/grants').catch(() => ({ grants: [] }));
      const mine = grants.find(g => g.clientId === CLIENT || g.client?.id === CLIENT);
      if (mine) await api(`/me/oauth/grants/${encodeURIComponent(mine.id)}`, { method: 'DELETE' }).catch(() => null);
    }
  } finally { keepSession(null); }
}

/** On a page that needs a person: true when signed in; else go to the sign-in page, which comes back here. */
export function requireSignIn() {
  if (signedIn()) return true;
  location.replace(`signin.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash)}`);
  return false;
}

/**
 * One call of the API with the person's token. `body` is sent as JSON unless it is a Blob, bytes or FormData.
 * `anonymous: true` sends no token (a public route). `raw: true` answers the Response. A refusal throws ApiError.
 */
export async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: { accept: 'application/json', ...(opts.headers || {}) }, cache: 'no-store' };
  const s = session();
  if (s?.access && !opts.anonymous) init.headers.authorization = `Bearer ${s.access}`;
  if (opts.body instanceof Blob || opts.body instanceof ArrayBuffer || opts.body instanceof Uint8Array || opts.body instanceof FormData) init.body = opts.body;
  else if (typeof opts.body === 'string') init.body = opts.body;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['content-type'] = 'application/json'; }
  let res;
  try { res = await fetch(`${API}${path}`, init); } catch { throw new ApiError(0, { error: 'unreachable' }, path); }
  // A 401 is the route's own answer while the token still opens /me. Only a token that /me refuses is refreshed,
  // once; the session ends only when the refresh fails too.
  if (res.status === 401 && !opts.retried && !opts.anonymous && s?.access && !(await alive())) {
    if (s.refresh && (await refresh())) return api(path, { ...opts, retried: true });
    keepSession(null);
  }
  if (opts.raw) return res;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new ApiError(res.status, data ?? {}, path);
  return data;
}
