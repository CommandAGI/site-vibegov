// Sign in, make an account, or reset a password (redesign/APP.md § the pages). The account is the person's CommandAGI
// account, signed in through VibeGov's platform-owned client (session.js `signIn`, `signUp`). The sign-up form is
// VibeStartup's (its auth/auth.js): the same door (`POST /oauth/signup`), the same Turnstile handling, and the terms
// accepted by the sentence above the button, which the door records. A forgotten password: `POST /oauth/password-reset`
// mails a link back to this page with `?reset_token=`, and `POST /oauth/password-reset/confirm` sets the new password.

const PAGE_NAME = /^[a-z0-9][a-z0-9-]*(?:\.html)?(?:[?#][^\\]*)?$/i;

/**
 * Where to go after signing in: `next` when it is a page of this site named relatively (`rfc.html?id=1`), else the desk.
 * A scheme, `//`, a backslash, a leading slash or a control character is refused: never an open redirect.
 */
export function safeNext(raw) {
  const next = typeof raw === 'string' ? raw.trim() : '';
  if (!next || next.includes('//') || next.includes('\\') || /[\u0000-\u001f\u007f]/.test(next) || !PAGE_NAME.test(next)) return 'home.html';
  // Back to this page would only send the person on again.
  if (/^signin(?:\.html)?(?:[?#]|$)/i.test(next)) return 'home.html';
  return next;
}

/** Plain words for what the sign-in and sign-up doors refuse (session.js words the common ones). */
export function signinWords(e) {
  const code = e?.code;
  if (code === 'invalid_client') return 'CommandAGI does not know this site as a sign-in client, so it cannot sign you in here. Sign in at commandagi.com.';
  if (code === 'invalid_token') return 'This link no longer works: it was used, it is older than one hour, or a newer link was mailed. Ask for a new link.';
  if (code === 'password_too_short') return 'Use a password of 8 characters or more.';
  if (code === 'invalid_email') return 'That email address does not look right.';
  if (code === 'origin_not_registered') return 'CommandAGI does not send reset links to this address of the site. Use vibegov.pro.';
  if (code === 'turnstile_failed') return 'We could not confirm that a person is making this account. Wait a moment and press the button again. If it keeps happening, allow challenges.cloudflare.com in your browser, or turn off a privacy extension for this page.';
  if (code === 'signup_capped') return 'New accounts are limited today. Try again tomorrow, or write to hello@vibegov.pro.';
  if (code === 'email_taken') return 'An account with this email exists already. Sign in instead.';
  if (code === 'invalid_grant') return 'That email or password is not right.';
  if (code === 'slow_down') return 'Too many tries. Wait a minute and try again.';
  if (e?.status === 0) return 'CommandAGI’s API could not be reached. Check your connection and try again.';
  return e?.message || 'The request was refused.';
}

/** What the form itself refuses before anything is sent; null when it may go. */
export function formProblem(mode, data) {
  if (mode !== 'newpw' && !/^[^\s@]+@[^\s@]+$/.test(String(data.email ?? '').trim())) return 'Enter your email address.';
  if (mode === 'reset') return null;
  if (mode === 'signup' && !String(data.name ?? '').trim()) return 'Give your name.';
  if (!data.password) return 'Enter your password.';
  if ((mode === 'signup' || mode === 'newpw') && String(data.password).length < 8) return 'Use a password of 8 characters or more.';
  return null;
}

if (typeof document !== 'undefined' && document.getElementById('signin')) {
  const { signIn, signUp, signedIn, API, CLIENT, ApiError } = await import('./session.js');
  const params = new URLSearchParams(location.search);
  // The reset link's token is read once and taken out of the address, so it stays out of the history.
  const resetToken = params.get('reset_token');
  if (resetToken) { const u = new URL(location.href); u.searchParams.delete('reset_token'); history.replaceState(null, '', u); }
  /** One call of a password-reset door; a refusal throws ApiError as session.js's doors do. */
  async function resetDoor(path, body) {
    const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: CLIENT, ...body }) }).catch(() => null);
    if (!res) throw new ApiError(0, { error: 'unreachable' }, path);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, out, path);
    return out;
  }
  const next = safeNext(params.get('next'));
  if (signedIn() && !resetToken) location.replace(next);

  const $ = (sel, root = document) => root.querySelector(sel);
  const panels = { signin: $('#signin'), signup: $('#signup'), reset: $('#reset'), newpw: $('#newpw') };
  const TITLES = { signin: 'Sign in', signup: 'Make an account', reset: 'Reset a password', newpw: 'Set a new password' };
  const state = $('[data-state]');

  const say = (form, text) => { const p = $('[data-error]', form); p.className = 'refusal'; p.textContent = text ?? ''; p.hidden = !text; };

  // Turnstile (Cloudflare's check that a person is signing up, invisible unless it is unsure) runs on the hosts the
  // platform's widget lists, with the site key the platform names (`GET /signup/config`). The door requires a token
  // (setting `signup.turnstile.require.oauth`), so a sign-up waits for the widget's token. Elsewhere (a local copy) no
  // token is sent, and a platform with no widget takes the sign-up without one. The script loads only when the
  // sign-up form is first shown, so a person who only signs in tells Cloudflare nothing.
  const TURNSTILE_HOSTS = new Set(['vibegov.pro', 'vibegov.commandagi.app', 'vibegov--dev.commandagi.app']);
  const TOKEN_WAIT_MS = 15000, TICK_WAIT_MS = 180000;
  let widget = null, token = null, waiters = [], broken = false, mustTick = false, failed = false, started = false;
  const gotToken = t => { token = t; const w = waiters; waiters = []; w.forEach(f => f(t)); };
  function startTurnstile() {
    if (started || !TURNSTILE_HOSTS.has(location.hostname)) return;
    started = true;
    fetch(`${API}/signup/config`).then(r => r.json()).then(cfg => {
      const key = cfg?.turnstile?.siteKey;
      if (!key) { broken = true; gotToken(null); return; }
      window.onTurnstileLoad = () => {
        widget = window.turnstile.render('#turnstile', {
          sitekey: key, action: cfg.turnstile.action ?? 'signup', appearance: 'interaction-only',
          callback: t => { mustTick = false; failed = false; gotToken(t); },
          'before-interactive-callback': () => { mustTick = true; },
          'after-interactive-callback': () => { mustTick = false; },
          'expired-callback': () => { token = null; },
          'error-callback': () => { token = null; failed = true; },
        });
      };
      const sc = document.createElement('script');
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
      sc.async = true;
      sc.onerror = () => { broken = true; gotToken(null); };
      document.head.append(sc);
    }).catch(() => { broken = true; gotToken(null); });
  }
  const TICK = 'Tick “Verify you are human” above. Your account is made right after.';
  const CHECK_FAILED = 'Cloudflare could not check this browser. Press Troubleshoot in the box above, or reload the page and try again.';
  /** The widget's token: the one it has, or the next it makes. Null where no widget runs, or it failed. */
  async function turnstileToken() {
    if (!TURNSTILE_HOSTS.has(location.hostname) || broken) return null;
    if (token) return token;
    return new Promise(resolve => {
      const since = Date.now();
      const tick = setInterval(() => {
        if (failed) say(panels.signup, CHECK_FAILED);
        else if (mustTick) say(panels.signup, TICK);
        if (Date.now() - since > (mustTick || failed ? TICK_WAIT_MS : TOKEN_WAIT_MS)) { clearInterval(tick); resolve(null); }
      }, 500);
      waiters.push(v => { clearInterval(tick); say(panels.signup, ''); resolve(v); });
    });
  }
  // A token is used once.
  const spendToken = () => { token = null; try { if (widget != null) window.turnstile.reset(widget); } catch { /* no widget */ } };

  function show(mode) {
    for (const [name, el] of Object.entries(panels)) el.hidden = name !== mode;
    for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    $('#signin-title').textContent = TITLES[mode];
    document.title = `${TITLES[mode]} · VibeGov`;
    const u = new URL(location.href);
    if (mode === 'signin' || mode === 'newpw') u.searchParams.delete('mode'); else u.searchParams.set('mode', mode);
    document.querySelector('.tabs').hidden = mode === 'newpw';
    history.replaceState(null, '', u);
    if (mode === 'signup') startTurnstile();
  }
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => { show(b.dataset.mode); $('input', panels[b.dataset.mode])?.focus(); });
  show(resetToken ? 'newpw' : ['signup', 'reset'].includes(params.get('mode')) ? params.get('mode') : 'signin');

  async function submit(form, mode, act) {
    const button = $('button[type=submit]', form);
    const data = Object.fromEntries(new FormData(form));
    say(form, '');
    const problem = formProblem(mode, data);
    if (problem) return say(form, problem);
    const was = button.textContent;
    button.disabled = true;
    button.textContent = { signup: 'Making the account…', reset: 'Asking for a link…', newpw: 'Setting the password…' }[mode] ?? 'Signing in…';
    try {
      if ((await act(data)) === 'stay') { button.disabled = false; button.textContent = was; return; }
      button.textContent = 'Signed in. Opening the page…';
      location.replace(next);
    } catch (e) {
      say(form, signinWords(e));
      button.disabled = false;
      button.textContent = was;
    }
  }
  panels.signin.addEventListener('submit', e => { e.preventDefault(); submit(panels.signin, 'signin', d => signIn({ email: d.email, password: d.password })); });
  panels.signup.addEventListener('submit', e => {
    e.preventDefault();
    submit(panels.signup, 'signup', async d => {
      const t = await turnstileToken();
      try { await signUp({ name: String(d.name).trim(), email: d.email, password: d.password, ...(t ? { turnstile_token: t } : {}) }); }
      finally { spendToken(); }
    });
  });

  // A forgotten password. The answer is the same whether or not an account has the email, and so are these words.
  panels.reset.addEventListener('submit', e => {
    e.preventDefault();
    const done = $('[data-done]', panels.reset);
    done.hidden = true;
    submit(panels.reset, 'reset', async d => {
      await resetDoor('/oauth/password-reset', { email: String(d.email).trim(), origin: location.origin, returnPath: `/signin.html${location.search}` });
      done.textContent = 'If an account has this email, a link to set a new password is on its way to it. Open the link within one hour.';
      done.hidden = false;
      return 'stay';
    });
  });
  // The page the link opens: the new password, then sign in with it.
  panels.newpw.addEventListener('submit', e => {
    e.preventDefault();
    submit(panels.newpw, 'newpw', async d => {
      await resetDoor('/oauth/password-reset/confirm', { token: resetToken, password: d.password });
      panels.newpw.reset();
      show('signin');
      const p = $('[data-error]', panels.signin);
      p.hidden = false; p.className = 'done'; p.textContent = 'Your password is set. Sign in with it.';
      $('input', panels.signin).focus();
      return 'stay';
    });
  });

  // Show or hide a password: the button says what it does now.
  for (const b of document.querySelectorAll('[data-pw]')) b.addEventListener('click', () => {
    const input = document.getElementById(b.getAttribute('aria-controls'));
    const shown = input.type === 'password';
    input.type = shown ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(shown));
    b.textContent = shown ? 'Hide' : 'Show';
  });
  // A sent form hides its password again.
  for (const f of [panels.signin, panels.signup, panels.newpw]) f.addEventListener('submit', () => f.querySelectorAll('[data-pw][aria-pressed="true"]').forEach(b => b.click()), true);

  state.remove();
  document.documentElement.dataset.signin = 'ready';
}
