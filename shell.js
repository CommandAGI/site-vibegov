// The account control in every page's header (redesign/APP.md § the shell): "Sign in" for a visitor, "Your desk" for
// a signed-in person. A page marks the place with `<span data-account></span>`. It follows the session as it changes.
import { session, signedIn } from './session.js';

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
export { session };
