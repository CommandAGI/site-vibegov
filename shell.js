// What every page's frame holds (redesign/APP.md § the shell). The account control in the header: "Sign in" for a
// visitor, "Home" for a signed-in person; a page marks the place with `<span data-account></span>`, and it
// follows the session as it changes. And the tape under the header (`[data-live="tape"]`): the contract's figures
// from the public record, read again each 30 s while the page is seen.
import { API, session, signedIn } from './session.js';
import { getJson, relative, renderTape } from './live.js';

// One origin holds a person's session. The other names of the site (www., .tech, .me) send a reader to vibegov.pro,
// at the same page, so a person signs in once and the sign-up check knows the host.
const ALIASES = ['www.vibegov.pro', 'vibegov.tech', 'www.vibegov.tech', 'vibegov.me', 'www.vibegov.me'];
if (ALIASES.includes(location.hostname)) location.replace(`https://vibegov.pro${location.pathname}${location.search}${location.hash}`);

function draw() {
  for (const slot of document.querySelectorAll('[data-account]')) {
    const here = location.pathname.split('/').pop();
    slot.innerHTML = signedIn()
      ? `<a class="btn small" href="home.html" data-ref="you"${here === 'home.html' ? ' aria-current="page"' : ''}>Home</a>`
      : `<a class="btn small" href="signin.html${here && !['signin.html', 'index.html', ''].includes(here) ? `?next=${encodeURIComponent(here + location.search + location.hash)}` : ''}">Sign in</a>`;
  }
  document.documentElement.dataset.session = signedIn() ? 'in' : 'out';
}
draw();
document.addEventListener('session', draw);
// Another tab signed in or out.
addEventListener('storage', e => { if (e.key === 'vibegov.session') draw(); });

// The tape: one line. It holds the figures twice, end to end, and moves slowly to the left, so the line never ends;
// it stops under a pointer, a person can drag it either way, and with reduced motion it moves only when dragged.
const tape = document.querySelector('[data-live="tape"]');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let track = null, offset = 0, lap = 0, held = null, over = false, last = 0;
function lay(html) {
  if (!track) {
    tape.innerHTML = '<div class="tape__track"></div>';
    track = tape.firstElementChild;
  }
  track.innerHTML = html + html.replace('<dl class="tape__in"', '<dl class="tape__in" aria-hidden="true"');
  lap = track.firstElementChild.getBoundingClientRect().width;
}
function move(now) {
  if (track && lap) {
    if (!held && !over && !calm.matches && !document.hidden) offset += ((now - last) / 1000) * 22;
    offset = ((offset % lap) + lap) % lap;
    track.style.transform = `translateX(${-offset}px)`;
  }
  last = now;
  requestAnimationFrame(move);
}
async function figures() {
  if (!tape || document.hidden) return;
  try {
    lay(renderTape(await getJson(fetch, API, '/public/contract/stats'), Date.now()));
  } catch {
    if (!track) tape.innerHTML = '<p class="empty">The public record could not be reached.</p>';
  }
  tape.removeAttribute('aria-busy');
}
if (tape) {
  figures();
  setInterval(figures, 30_000);
  setInterval(() => tape.querySelectorAll('[data-at]').forEach(t => { t.textContent = relative(Number(t.dataset.at), Date.now()); }), 1000);
  document.addEventListener('visibilitychange', figures);
  tape.addEventListener('pointerenter', () => { over = true; });
  tape.addEventListener('pointerleave', () => { over = false; });
  tape.addEventListener('pointerdown', e => { held = { x: e.clientX, at: offset }; tape.setPointerCapture(e.pointerId); });
  tape.addEventListener('pointermove', e => { if (held) offset = held.at - (e.clientX - held.x); });
  for (const end of ['pointerup', 'pointercancel']) tape.addEventListener(end, () => { held = null; });
  requestAnimationFrame(now => { last = now; move(now); });
}

// The contract's signed-in doors are closed for this account (contract-api.js): say so once, under the tape.
document.addEventListener('contract-closed', () => {
  if (document.querySelector('.closed')) return;
  const bar = document.createElement('p');
  bar.className = 'closed';
  bar.setAttribute('role', 'status');
  bar.textContent = 'The contract is not open to this account yet. You can read the public record on every page. Responding, proposing, filing a case and credit open when CommandAGI turns the contract on for your account.';
  (tape ?? document.querySelector('.runhead'))?.after(bar);
});
export { session };
