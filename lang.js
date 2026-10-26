/* The language button (docs/sites.md § the language button): one square A/文 button opens a <dialog> with a row per
   locale. The rows are plain links to that locale's static page, so the pages work with no script; this file adds the
   parts a browser needs help with here: opening the dialog where the invoker commands are missing, closing it on the
   backdrop, and remembering the choice so the language hint stays away. */
(() => {
  const dialog = document.getElementById('lang-dialog');
  const button = document.querySelector('[data-lang-open]');
  if (dialog && button) {
    const supported = typeof dialog.showModal === 'function';
    if (supported && !('commandForElement' in HTMLButtonElement.prototype)) {
      button.addEventListener('click', event => {
        event.preventDefault();
        if (dialog.open) return;
        dialog.showModal();
        const current = dialog.querySelector('a[aria-current="true"]');
        if (current) current.focus();
      });
    }
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) dialog.close();
    });
    dialog.querySelectorAll('[command="close"]').forEach(node => {
      node.addEventListener('click', event => {
        if (!node.closest('dialog')) return;
        event.preventDefault();
        dialog.close();
      });
    });
    dialog.querySelectorAll('a[hreflang]').forEach(link => {
      link.addEventListener('click', () => {
        try { localStorage.setItem('vibegov.lang', link.getAttribute('hreflang')); } catch { /* a private window keeps nothing */ }
      });
    });
  }

  // The hint: a visitor whose browser prefers another of this page's languages is offered it once.
  const hint = document.getElementById('lang-hint');
  if (!hint || !dialog) return;
  const page = (document.documentElement.lang || 'en').toLowerCase();
  let preferred = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  preferred = preferred.toLowerCase();
  try { if (localStorage.getItem('vibegov.lang')) return; } catch { /* no storage: show the hint */ }
  const tag = preferred.startsWith('zh') ? 'zh-Hans' : preferred.split('-')[0];
  if (!tag || tag === page || tag === page.split('-')[0]) return;
  const match = dialog.querySelector(`a[hreflang="${tag}"]`) || dialog.querySelector(`a[hreflang="${tag.split('-')[0]}"]`);
  if (!match) return;
  const link = hint.querySelector('a');
  if (!link) return;
  link.href = match.href;
  link.textContent = hint.dataset.template.replace('{language}', match.dataset.name);
  hint.hidden = false;
})();
