/* The pages' apparatus: the contents popover where popovers are missing, and line numbers in the margin of a lined
   clause. Every word is in the page; with no script the pages read whole. The live record is page.js. */
(() => {
  // The contents: a popover on phones. Where the Popover API is missing, the button toggles it.
  const contents = document.getElementById('contents');
  const toggle = document.querySelector('.contents-btn');
  if (contents && toggle && !HTMLElement.prototype.hasOwnProperty('popover')) {
    toggle.addEventListener('click', () => {
      const open = contents.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Line numbers, one per laid-out line, redrawn when the measure changes.
  const number = block => {
    block.querySelectorAll(':scope > .ln').forEach(n => n.remove());
    const lh = parseFloat(getComputedStyle(block).lineHeight);
    if (!lh) return;
    const lines = Math.round(block.getBoundingClientRect().height / lh);
    const start = Number(block.dataset.from || 1);
    for (let i = 0; i < lines; i += 1) {
      const n = document.createElement('span');
      n.className = 'ln';
      n.setAttribute('aria-hidden', 'true');
      n.textContent = String(start + i);
      n.style.top = `${i * lh + lh * 0.32}px`;
      block.append(n);
    }
  };
  const lined = [...document.querySelectorAll('.lined')];
  if (lined.length && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(entries => entries.forEach(e => number(e.target)));
    document.fonts?.ready.then(() => lined.forEach(b => { number(b); ro.observe(b); }));
  }
})();
