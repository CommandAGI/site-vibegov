// What every page's frame holds (redesign/APP.md § the shell). The account control in the header: "Sign in" for a
// visitor, "Your desk" for a signed-in person; a page marks the place with `<span data-account></span>`, and it
// follows the session as it changes. And the tape under the header (`[data-live="tape"]`): the contract's figures
// from the public record, read again each 30 s while the page is seen.
import { API, session, signedIn } from './session.js';
import { getJson, relative, renderTape } from './live.js';

function draw() {
  for (const slot of document.querySelectorAll('[data-account]')) {
    const here = location.pathname.split('/').pop();
    slot.innerHTML = signedIn()
      ? `<a class="btn small" href="desk.html" data-ref="you"${here === 'desk.html' ? ' aria-current="page"' : ''}>Your desk</a>`
      : `<a class="btn small" href="signin.html${here && !['signin.html', 'index.html', ''].includes(here) ? `?next=${encodeURIComponent(here + location.search + location.hash)}` : ''}">Sign in</a>`;
  }
  document.documentElement.dataset.session = signedIn() ? 'in' : 'out';
}
draw();
document.addEventListener('session', draw);
// Another tab signed in or out.
addEventListener('storage', e => { if (e.key === 'vibegov.session') draw(); });

const tape = document.querySelector('[data-live="tape"]');
async function figures() {
  if (!tape || document.hidden) return;
  try {
    tape.innerHTML = renderTape(await getJson(fetch, API, '/public/contract/stats'), Date.now());
  } catch {
    if (!tape.firstElementChild) tape.innerHTML = '<p class="empty">The public record could not be reached.</p>';
  }
  tape.removeAttribute('aria-busy');
}
if (tape) {
  figures();
  setInterval(figures, 30_000);
  setInterval(() => tape.querySelectorAll('[data-at]').forEach(t => { t.textContent = relative(Number(t.dataset.at), Date.now()); }), 1000);
  document.addEventListener('visibilitychange', figures);
}
export { session };
