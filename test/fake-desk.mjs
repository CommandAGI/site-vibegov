// A fake of the routes the sign-in page and the desk call (`node test/serve.mjs --fake test/fake-desk.mjs`), with the
// shapes the CommandAGI routes answer: routes/oauth.ts (`/oauth/token`, `/oauth/signup`), routes/users.ts (`/me`,
// `/users/:id`, `/me/credits`, `/signup/config`), routes/contract.ts (`/contract/me`, `/contract/awaiting`,
// `/contract/notices`), routes/stripe.ts (`/identity/verify`, `/billing/checkout`). Two people: sign in as an email
// that starts with `empty` for a new account with nothing on its desk; any other email has a voice and items. The
// password `wrong` is refused as the token endpoint refuses it.
const H = 3600_000, D = 24 * H;
const people = new Map(); // token -> { id, name, email, empty }
const read = new Set();
const canceled = new Set();
const verifying = new Set(); // people who started Stripe's check: `processing` until its webhook, which never comes here

const token = (p) => {
  const access = `tok-${p.id}`;
  people.set(access, p);
  return { access_token: access, token_type: 'Bearer', expires_in: 7776000, refresh_token: `ref-${p.id}`, scope: '*' };
};
const person = (email, name) => {
  const empty = /^empty/i.test(email);
  return { id: empty ? 'u-empty' : 'u-ada', name: name ?? (empty ? 'Grace Hopper' : 'Ada Lovelace'), email, empty };
};

function awaiting(p, now) {
  if (p.empty) return { entity: p.id, at: now, voice: null, why: 'not_a_person', rfcs: [], contests: [], cases: [], decisions: [] };
  return {
    entity: p.id, at: now, voice: 'human:7c1f0a9be2d44f55', why: null,
    rfcs: [
      { id: 'rfc-4f2a91c0', title: 'Lower the proposal deposit to $5', target: 'law', procedure: 'standard', options: 2, closesAt: now + 3 * D + 4 * H, unconfirmed: true, anonymous: false },
      { id: 'rfc-88b3e0d1', title: 'Seat a second renderer for video evidence <script>', target: 'engine', procedure: 'standard', options: 1, closesAt: now + 9 * D, unconfirmed: false, anonymous: true },
    ],
    contests: [{ rfcId: 'rfc-1d9c7e22', title: 'Shorten the evidence window to 10 days', contestUntil: now + 2 * D, scores: { keep: 1, shorten: -1 } }],
    cases: [
      { id: 'c0ffee12-3456-4789-abcd-ef0123456789', duty: 'Deliver the ordered parts on time', role: 'respondent', stage: 'awaiting_response', act: 'answer', due: now + 5 * D },
      { id: 'b16b00b5-aaaa-4bbb-8ccc-0123456789ab', duty: 'Pay for work delivered', role: 'claimant', stage: 'ready', act: 'wait', due: null },
    ],
    decisions: [{ id: 'n-decided-1', subject: 'rfc-0a0b0c0d', kind: 'rfc.decided', body: 'RFC “Publish the engine’s seat log daily” was decided: adopted.', at: now - 6 * H }],
  };
}
function notices(p, now) {
  if (p.empty) return [];
  return [
    { id: 'n-decided-1', recipient: p.id, subject: 'rfc-0a0b0c0d', kind: 'rfc.decided', body: 'RFC “Publish the engine’s seat log daily” was decided: adopted.', deliveredAt: now - 6 * H, readAt: null },
    { id: 'n-served-1', recipient: p.id, subject: 'c0ffee12-3456-4789-abcd-ef0123456789', kind: 'case.served', body: 'You are the respondent in a case on the duty “Deliver the ordered parts on time”. Your answer is due in 7 days.', deliveredAt: now - 2 * D, readAt: null },
    { id: 'n-interp-1', recipient: p.id, subject: 'rfc-1d9c7e22', kind: 'rfc.interpretation', body: 'Your response to “Shorten the evidence window to 10 days” was read. You may contest the reading for 2 days.', deliveredAt: now - 3 * D, readAt: now - 2 * D },
  ].map(n => (read.has(n.id) ? { ...n, readAt: n.readAt ?? now } : n));
}

export default function fake({ method, path, headers, body }) {
  const now = Date.now();
  const p = people.get(String(headers.authorization ?? '').replace(/^Bearer /, ''));
  if (method === 'GET' && path === '/signup/config') return { body: { turnstile: null } };
  if (method === 'POST' && path === '/oauth/token') {
    if (body?.client_id !== 'vibegov') return { status: 401, body: { error: 'invalid_client' } };
    if (body.grant_type === 'refresh_token') return { status: 400, body: { error: 'invalid_grant' } };
    if (body.password === 'wrong') return { status: 400, body: { error: 'invalid_grant', error_description: 'invalid username or password' } };
    return { body: token(person(body.username)) };
  }
  if (method === 'POST' && path === '/oauth/signup') {
    if (String(body?.password ?? '').length < 8) return { status: 400, body: { error: 'password_too_short', min: 8 } };
    if (/^taken/.test(body?.email ?? '')) return { status: 409, body: { error: 'email_taken' } };
    const np = person(body.email, body.name);
    return { body: { ...token(np), userId: np.id, created: true } };
  }
  if (method === 'POST' && path === '/oauth/password-reset') {
    if (body?.client_id !== 'vibegov') return { status: 401, body: { error: 'invalid_client' } };
    if (!/^[^\s@]+@[^\s@]+$/.test(body.email ?? '')) return { status: 400, body: { error: 'invalid_email' } };
    return { body: { ok: true } };
  }
  if (method === 'POST' && path === '/oauth/password-reset/confirm') {
    if (String(body?.password ?? '').length < 8) return { status: 400, body: { error: 'password_too_short', min: 8 } };
    return body?.token === 'good-token' ? { body: { ok: true } } : { status: 400, body: { error: 'invalid_token' } };
  }
  if (!p) return path.startsWith('/public/') ? publicRoute(path) : { status: 401, body: { error: 'unauthorized' } };

  if (method === 'GET' && path === '/me') return { body: { id: p.id, exists: true, principalType: 'user', isAdmin: false, locale: null, timezone: null, flags: {} } };
  if (method === 'GET' && path === `/users/${p.id}`) return { body: { id: p.id, email: p.email, handle: null, name: p.name, image: null, kind: 'person', planId: 'plan-free' } };
  if (method === 'GET' && path === '/me/credits') return { body: { credits: p.empty ? 0 : 1234 } };
  if (method === 'GET' && path === '/me/oauth/grants') return { body: { grants: [{ id: 'g-1', clientId: 'vibegov' }] } };
  if (method === 'DELETE' && path === '/me/oauth/grants/g-1') return { body: { ok: true } };
  if (method === 'GET' && path === '/contract/awaiting') {
    const a = awaiting(p, now);
    return { body: { ...a, decisions: a.decisions.filter(d => !read.has(d.id)) } };
  }
  if (method === 'GET' && path === '/contract/notices') return { body: { notices: notices(p, now) } };
  const m = /^\/contract\/notices\/([^/]+)\/read$/.exec(path);
  if (method === 'POST' && m) { read.add(decodeURIComponent(m[1])); return { body: { ok: true } }; }
  if (method === 'GET' && path === '/contract/me') {
    const a = awaiting(p, now);
    return { body: { entity: p.id, ...(a.voice ? { voice: a.voice } : { voice: null, why: a.why }), verification: p.empty ? (verifying.has(p.id) ? 'processing' : 'none') : 'verified', cases: [], unreadNotices: notices(p, now).filter(n => !n.readAt).length, credit: { borrowed: [], held: [], offers: [] } } };
  }
  if (method === 'POST' && path === '/identity/verify') return verifying.add(p.id), { body: { url: `${body.returnPath}?verify=done`, id: 'vs_fake' } };
  if (method === 'POST' && path === '/billing/checkout') {
    if (body?.origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(body.origin)) return { status: 400, body: { error: 'origin_not_registered', origin: body.origin, client: 'vibegov' } };
    return { body: { url: `${body.returnPath}?checkout=act-1&success=1`, checkout: 'act-1' } };
  }
  const co = /^\/me\/billing\/checkouts\/([^/]+)(\/expire)?$/.exec(path);
  if (co) {
    if (co[2]) canceled.add(co[1]);
    return { body: { id: co[1], status: canceled.has(co[1]) ? 'canceled' : 'paid', state: null, reason: null, planId: null, activeFrom: null, by: `person:${p.id}`, updatedAt: now } };
  }
  return path.startsWith('/public/') ? publicRoute(path) : undefined;
}

function publicRoute(path) {
  if (path === '/public/contract') return { body: { version: 3, law: { parameters: { rfcDepositCents: 2500, caseDepositCents: 5000 } } } };
  return undefined;
}
