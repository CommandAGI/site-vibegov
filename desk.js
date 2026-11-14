// The person's desk (redesign/APP.md § the pages): what needs them (the editor's NeedsPanel.tsx), their voice and the
// way to get one (Overview.tsx `VoicePanel`), their notices (`NoticesPanel`), the balance their deposits come from, and
// their account. The render functions are pure (data in, escaped HTML out) so test/desk.test.mjs runs them on the
// shapes the routes answer; the end of this file reads the API with the person's own token and places them.
import { esc, money, count, date, relative } from './live.js';
import { words, hasWords } from './contract-words.js';

const needs = words('needs');
const stages = words('stages');
const notices = words('notices');
const overview = words('overview');
const refusals = words('refusals');

/** A time as words a person reads now, with the exact moment beside it. */
const when = (at, now) => (at ? `<time datetime="${esc(new Date(at).toISOString())}" title="${esc(date(at))}">${esc(relative(at, now))}</time>` : '—');
/** A deadline as its moment ("until 15 Nov 2026, 12:00 UTC"), with how far off it is beside it. */
const until = (at, now) => (at ? `<time datetime="${esc(new Date(at).toISOString())}" title="${esc(relative(at, now))}">${esc(date(at))}</time>` : '—');
const shortId = id => String(id ?? '').slice(0, 8);
/** The catalog's words as escaped HTML, with one value that is HTML already (a `<time>`) put in its place. */
const withTime = (t, key, name, html) => esc(t(key, { [name]: '\u0000' })).replace('\u0000', html);

/** The page of a notice's or a decision's subject: an RFC, a case, or a facility's credit. */
export function subjectHref(kind, subject) {
  const k = String(kind ?? '');
  if (k.startsWith('rfc.')) return `rfc.html?id=${encodeURIComponent(subject)}`;
  if (k.startsWith('case.')) return `case.html?id=${encodeURIComponent(subject)}`;
  if (k.startsWith('facility.') || k.startsWith('offer.') || k.startsWith('mandate.')) return 'credit.html';
  return null;
}
const subjectWords = kind => (String(kind).startsWith('rfc.') ? 'Open the proposal' : String(kind).startsWith('case.') ? 'Open the case' : 'Open your credit');

/** How many items wait on the person (the editor's `needsCount`). */
export function needsCount(a) {
  return a ? a.rfcs.length + a.contests.length + a.cases.filter(c => c.act !== 'wait').length + a.decisions.length : 0;
}

function caseWords(c, now) {
  if (c.act === 'answer') return withTime(needs, 'caseAnswer', 'when', until(c.due, now));
  if (c.act === 'evidence') return withTime(needs, 'caseEvidence', 'when', until(c.due, now));
  if (c.act === 'appeal') return withTime(needs, 'caseAppeal', 'when', until(c.due, now));
  return esc(needs('caseWait', { stage: stages(String(c.stage)) }));
}

/** What needs the person (`GET /contract/awaiting`); null when it could not be read. */
export function renderNeeds(a, now) {
  if (!a) return `<p class="refusal">What needs you could not be read. Reload the page to try again.</p>`;
  const { rfcs, contests, cases, decisions } = a;
  let html = `<p class="note">${esc(needs('note'))}</p>`;
  if (!a.voice) html += `<p>${esc(needs('noVoice').replace('The voice tab says', 'The section “Your voice” says'))}</p>`;
  if (!needsCount(a) && !cases.length) return html + `<p class="empty">${esc(needs('empty'))}</p>`;
  if (rfcs.length) {
    html += `<h3 class="desk__sub">${esc(needs('rfcsTitle'))}</h3><ul class="rows">` + rfcs.map(r => {
      const href = `rfc.html?id=${encodeURIComponent(r.id)}`;
      const lines = [withTime(needs, 'rfcLine', 'when', when(r.closesAt, now))];
      if (r.unconfirmed) lines.push(esc(needs('unconfirmed')));
      if (r.anonymous) lines.push(esc(needs('anonymous')));
      return `<li data-rfc="${esc(r.id)}"><span>${esc(shortId(r.id))}</span><div><a href="${esc(href)}">${esc(r.title)}</a>${lines.map(l => `<small>${l}</small>`).join('')}</div><a class="btn small" href="${esc(href)}">${esc(needs('respond'))}</a></li>`;
    }).join('') + '</ul>';
  }
  if (contests.length) {
    html += `<h3 class="desk__sub">${esc(needs('contestsTitle'))}</h3><ul class="rows">` + contests.map(c => {
      const href = `rfc.html?id=${encodeURIComponent(c.rfcId)}`;
      return `<li data-contest="${esc(c.rfcId)}"><span>${esc(shortId(c.rfcId))}</span><div><a href="${esc(href)}">${esc(c.title)}</a><small>${withTime(needs, 'contestLine', 'when', until(c.contestUntil, now))}</small></div><a class="btn small" href="${esc(href)}">${esc(needs('review'))}</a></li>`;
    }).join('') + '</ul>';
  }
  if (cases.length) {
    html += `<h3 class="desk__sub">${esc(needs('casesTitle'))}</h3><ul class="rows">` + cases.map(c => {
      const href = `case.html?id=${encodeURIComponent(c.id)}`;
      const role = c.role === 'respondent' ? needs('roleRespondent') : needs('roleClaimant');
      return `<li data-case="${esc(c.id)}"><span>case-${esc(shortId(c.id))}</span><div><a href="${esc(href)}">${esc(c.duty)}</a><small>${caseWords(c, now)}</small></div><span class="state${c.act === 'wait' ? '' : ' state--yours'}">${esc(role)}</span></li>`;
    }).join('') + '</ul>';
  }
  if (decisions.length) {
    html += `<h3 class="desk__sub">${esc(needs('decisionsTitle'))}</h3><ul class="rows">` + decisions.map(d => {
      const href = subjectHref(d.kind, d.subject);
      return `<li data-decision="${esc(d.id)}"><span>${when(d.at, now)}</span><div><p class="desk__body">${esc(d.body)}</p>${href ? `<small><a href="${esc(href)}">${esc(needs('open'))}</a></small>` : ''}</div><button type="button" class="btn small" data-seen="${esc(d.id)}">${esc(needs('seen'))}</button></li>`;
    }).join('') + '</ul>';
    if (decisions.length > 1) html += `<div class="form__act desk__more"><button type="button" class="btn small" data-seen-all="${esc(decisions.map(d => d.id).join(' '))}">${esc(needs('allSeen'))}</button></div>`;
  }
  return html;
}

/** The kind of a voice key (`human:<key>`), as the contract's `voiceKind` reads it. */
export function voiceKind(voice) {
  const parts = String(voice ?? '').split(':');
  return parts[0] === 'anon' ? (parts[1] ?? '') : (parts[0] ?? '');
}

/**
 * The person's voice (`GET /contract/me`): held, of which kind; or why not, and the way to get one. `returned` is true
 * when the person has just come back from Stripe's page (`?verify=done`, the return the route names).
 */
export function renderVoice(me, { returned = false, starting = false, failed = null } = {}) {
  if (!me) return `<p class="refusal">Your voice could not be read. Reload the page to try again.</p>`;
  if (me.voice) {
    return `<p>${esc(overview('voiceYes', { voice: voiceKind(me.voice) }))}</p>`
      + `<dl class="kv"><dt>Kind</dt><dd>${esc(voiceKind(me.voice))}</dd><dt>Voice key</dt><dd><code>${esc(me.voice)}</code></dd></dl>`
      + `<p class="note">The key is one-way: it is derived from your verified identity and cannot be read back into it.</p>`;
  }
  const why = me.why ?? 'not_a_person';
  let html = `<p>${esc(overview('voiceNo', { reason: hasWords('refusals', why) ? refusals(why) : why }))}</p>`;
  if (me.verification === 'processing') {
    html += `<p class="note" data-verify-pending>${returned ? 'You are back from Stripe. ' : ''}${esc(overview('verifyPending'))}</p>`
      + `<div class="form__act"><button type="button" class="btn small" data-reload-voice>Check again</button></div>`;
  }
  if (why === 'duplicate_voice') html += `<p class="note">${esc(overview('duplicateHelp'))} <a href="file.html">File a case</a>.</p>`;
  const canVerify = why === 'not_a_person' && me.verification !== null && me.verification !== undefined && me.verification !== 'processing';
  if (canVerify) {
    if (returned && me.verification === 'requires_input') html += `<p class="refusal">Stripe could not finish the check. You may try it again.</p>`;
    if (returned && me.verification === 'canceled') html += `<p class="note">The check was canceled. Nothing was kept.</p>`;
    html += `<p class="note">${esc(overview('verifyNote'))} You leave this site for Stripe’s page, then come back to this desk.</p>`
      + `<div class="form__act"><button type="button" class="btn primary" data-verify${starting ? ' disabled' : ''}>${esc(starting ? overview('verifyStarting') : me.verification === 'requires_input' ? overview('verifyRetry') : overview('verifyAction'))}</button></div>`;
    if (failed) html += `<p class="refusal">${esc(overview('verifyFailed', { error: hasWords('refusals', failed) ? refusals(failed) : failed }))}</p>`;
  }
  return html;
}

/** The contract inbox (`GET /contract/notices`): the newest first, each with the page of its subject. */
export function renderNotices(list, now) {
  if (list === null) return `<p class="refusal">Your notices could not be read. Reload the page to try again.</p>`;
  if (!list.length) return `<p class="note">${esc(notices('note'))}</p><p class="empty">${esc(notices('empty'))}</p>`;
  return `<p class="note">${esc(notices('note'))}</p><ul class="rows">` + list.map(n => {
    const href = subjectHref(n.kind, n.subject);
    const unread = !n.readAt;
    return `<li data-notice="${esc(n.id)}"${unread ? ' data-unread' : ''}><span>${when(n.deliveredAt, now)}</span><div><p class="desk__body">${esc(n.body)}</p>${href ? `<small><a href="${esc(href)}">${esc(subjectWords(n.kind))}</a></small>` : ''}</div>`
      + (unread ? `<span class="desk__acts-cell"><span class="state state--open">${esc(notices('unread'))}</span><button type="button" class="btn small" data-read="${esc(n.id)}">${esc(notices('markRead'))}</button></span>` : `<span class="state">read</span>`)
      + '</li>';
  }).join('') + '</ul>';
}

/** CommandAGI's credit packs (packages/domain/core billing.ts `CREDIT_PACKS`): one credit is $0.01. */
export const PACKS = [
  { id: 'pack-starter', credits: 1000, usd: 10 },
  { id: 'pack-plus', credits: 5500, usd: 50 },
  { id: 'pack-pro', credits: 12000, usd: 100 },
];

/**
 * The balance (`GET /me/credits`: `{ credits }`, whole credits; one credit is one cent, and the contract draws its
 * deposits in cents from the same ledger). `law` is the law in force (`GET /public/contract`), for the deposits;
 * `back` is the return from Stripe's Checkout: `{ canceled }` from the address, and `checkout`, the act as recorded
 * (`GET /me/billing/checkouts/:id`: `status` open | pending | paid | failed | canceled, `reason`), once it is read.
 */
export function renderBalance(credits, law, { back = null, refusal = null, busy = null } = {}) {
  let html = '';
  if (back) html += checkoutOutcome(back);
  if (credits === null || credits === undefined) html += `<p class="refusal">Your balance could not be read. Reload the page to try again.</p>`;
  else {
    const cents = Math.max(0, Math.floor(Number(credits) || 0));
    html += `<p class="desk__figure"><b>${esc(money(cents))}</b><span>${esc(count(cents))} ${cents === 1 ? 'credit' : 'credits'}</span></p>`;
  }
  const p = law?.parameters ?? {};
  const deposits = [Number.isFinite(p.rfcDepositCents) ? `a proposal’s deposit is ${money(p.rfcDepositCents)}` : null, Number.isFinite(p.caseDepositCents) ? `a case’s deposit is ${money(p.caseDepositCents)}` : null].filter(Boolean);
  html += `<p class="note">One credit is one cent. Deposits are drawn from this balance${deposits.length ? `: under the law in force, ${esc(deposits.join(', and '))}` : ''}. It is your CommandAGI balance: the same credits pay for work there.</p>`;
  html += `<h3 class="desk__sub">Add to it</h3><p class="note">Stripe’s page takes the payment by card, once. Nothing renews. The credits arrive when Stripe confirms the payment, and you come back to this desk.</p>`;
  html += `<div class="desk__packs">${PACKS.map(k => `<button type="button" class="btn small" data-pack="${esc(k.id)}"${busy ? ' disabled' : ''}>${esc(busy === k.id ? 'Opening Stripe…' : `Add ${money(k.usd * 100)}`)}<small>${esc(count(k.credits))} credits</small></button>`).join('')}</div>`;
  if (refusal) html += `<p class="refusal">${esc(refusal)}</p>`;
  return html;
}

/** What came of a return from Checkout, in words. */
export function checkoutOutcome({ canceled = false, checkout } = {}) {
  const status = checkout?.status ?? (checkout === null ? 'unread' : 'reading');
  if (status === 'paid') return `<p class="done">Paid. The credits are in your balance.</p>`;
  if (status === 'failed') return `<p class="refusal">The payment failed${checkout.reason ? `: ${esc(checkout.reason)}` : ''}. Nothing was charged.</p>`;
  if (status === 'canceled' || canceled) return `<p class="note">The payment was canceled. Nothing was charged.</p>`;
  if (status === 'reading') return `<p class="note">Reading what came of the payment…</p>`;
  if (status === 'unread') return `<p class="note">What came of the payment could not be read. Reload to see your balance.</p>`;
  return `<p class="note">Stripe has not confirmed the payment yet. The credits arrive when it does; reload to see them.</p>`;
}

/** Plain words for a refusal of the checkout door (`POST /billing/checkout`). */
export function checkoutWords(code) {
  if (code === 'origin_not_registered') return 'CommandAGI does not send people back from Stripe to this address of the site. Use vibegov.pro, or add credits at commandagi.com.';
  if (code === 'unknown_pack') return 'That amount is not one CommandAGI sells.';
  if (code === 'return_path_invalid') return 'The page to come back to was refused.';
  if (code === 'network') return 'CommandAGI’s API could not be reached. Try again.';
  if (code === 'unauthorized') return 'Sign in first.';
  return `The payment could not start (${code}).`;
}

/** The account (`GET /users/:id` of `GET /me`): its name and email, and signing out. */
export function renderAccount(user) {
  const rows = user ? `<dl class="kv"><dt>Name</dt><dd>${esc(user.name || '—')}</dd><dt>Email</dt><dd>${esc(user.email || '—')}</dd></dl>` : `<p class="refusal">Your account could not be read.</p>`;
  return rows
    + `<p class="note">This is your CommandAGI account. VibeGov acts with your own token and for nobody else; signing out takes that token back.</p>`
    + `<div class="form__act"><button type="button" class="btn small" data-signout>Sign out</button><a href="#anonymous">About anonymous voice</a></div>`;
}

if (typeof document !== 'undefined' && document.querySelector('[data-desk]')) {
  const { requireSignIn, signOut, api, ApiError, API } = await import('./session.js');
  const C = await import('./contract-api.js');
  if (requireSignIn()) {
    const part = name => document.querySelector(`[data-part="${name}"]`);
    const params = new URLSearchParams(location.search);
    const returned = params.get('verify') === 'done';
    const checkoutId = params.get('checkout');
    const back = checkoutId ? { canceled: params.get('canceled') === '1' } : null;
    // The return's words show once; a reload reads the record again.
    if (returned || back) { const u = new URL(location.href); for (const k of ['verify', 'checkout', 'success', 'canceled']) u.searchParams.delete(k); history.replaceState(null, '', u); }
    const unreachable = `<p class="refusal">CommandAGI’s API could not be reached at ${esc(API)}. Check your connection and reload.</p>`;

    let me = null, credits, law = null;
    const drawNeeds = async () => { part('needs').innerHTML = renderNeeds(await C.loadAwaiting(), Date.now()); };
    const drawNotices = async () => { const list = await C.listNotices().catch(() => null); part('notices').innerHTML = renderNotices(list, Date.now()); };
    const drawVoice = async (opts = {}) => { me = await C.loadMe(); part('voice').innerHTML = renderVoice(me, { returned, ...opts }); };
    const drawBalance = (opts = {}) => { part('balance').innerHTML = renderBalance(credits, law, { back, ...opts }); };
    // The return names the checkout act: a cancel expires it at Stripe (the route's act), then its record is read.
    if (checkoutId) {
      const path = `/me/billing/checkouts/${encodeURIComponent(checkoutId)}`;
      (back.canceled ? api(`${path}/expire`, { method: 'POST', body: {} }).catch(() => null) : Promise.resolve())
        .then(() => api(path)).then(v => v, () => null)
        .then(v => { back.checkout = v; if (credits !== undefined) drawBalance(); });
    }

    // Each part reads on its own, so a slow one never holds the others.
    // A person back from Stripe sees what came of it first: the page opens at that section, with no scrolling motion.
    const showSection = name => part(name).closest('section').scrollIntoView({ block: 'start', behavior: 'instant' });
    drawNeeds();
    drawNotices();
    drawVoice().then(() => { if (returned) showSection('voice'); });
    Promise.all([api('/me/credits').then(r => r?.credits ?? null).catch(() => null), C.loadOverview().then(o => o?.law ?? null)]).then(([c, l]) => { credits = c; law = l; drawBalance(); if (back) showSection('balance'); });
    api('/me')
      .then(m => api(`/users/${encodeURIComponent(m.id)}`))
      .then(u => { part('account').innerHTML = renderAccount(u); })
      .catch(e => { part('account').innerHTML = (e instanceof ApiError && e.status === 0 ? unreachable : '') + renderAccount(null); });

    document.addEventListener('click', async e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.seen || t.dataset.seenAll) {
        t.disabled = true;
        await Promise.all((t.dataset.seen ? [t.dataset.seen] : t.dataset.seenAll.split(' ')).map(id => C.markNoticeRead(id)));
        await Promise.all([drawNeeds(), drawNotices()]);
      } else if (t.dataset.read) {
        t.disabled = true;
        const r = await C.markNoticeRead(t.dataset.read);
        if (!r.ok) { t.disabled = false; t.insertAdjacentHTML('afterend', `<span class="refusal">${esc(refusalWords(r.refusals))}</span>`); return; }
        await Promise.all([drawNotices(), drawNeeds()]);
      } else if (t.hasAttribute('data-reload-voice')) {
        t.disabled = true;
        await drawVoice();
      } else if (t.hasAttribute('data-verify')) {
        part('voice').innerHTML = renderVoice(me, { returned, starting: true });
        const out = await C.startIdentityVerification('/desk.html');
        if (out.url) location.href = out.url;
        else part('voice').innerHTML = renderVoice(me, { returned, failed: out.error });
      } else if (t.dataset.pack) {
        drawBalance({ busy: t.dataset.pack });
        try {
          const r = await api('/billing/checkout', { method: 'POST', body: { type: 'pack', packId: t.dataset.pack, origin: location.origin, returnPath: '/desk.html' } });
          if (r?.url) { location.href = r.url; return; }
          drawBalance({ refusal: checkoutWords('http_200') });
        } catch (err) {
          drawBalance({ refusal: checkoutWords(err instanceof ApiError ? (err.status === 0 ? 'network' : err.code ?? `http_${err.status}`) : 'network') });
        }
      } else if (t.hasAttribute('data-signout')) {
        t.disabled = true;
        t.textContent = 'Signing out…';
        await signOut();
        location.replace('index.html');
      }
    });

    function refusalWords(list) {
      return (list ?? []).map(r => (hasWords('refusals', r.code) ? refusals(r.code) : r.code)).join(' ');
    }
  }
}

// The anonymous voice's identity on this device: make it, register it, save it to a file, load it back (anon.js).
const anonymity = typeof document !== 'undefined' && document.querySelector('[data-slot="anonymity"]');
if (anonymity) import('./anon.js').then(m => m.renderAnonymityPanel(anonymity)).catch(() => { anonymity.innerHTML = '<p class="refusal">The anonymous voice could not be loaded on this device.</p>'; });

