/* The document's apparatus (redesign/DESIGN.md): the contents popover where popovers are missing, line numbers in the
   margin, loops that play only when seen, and the amendment scene. Every word is in the page, so one script serves each
   locale; with no script the pages read whole (the scene rests on its proposed state, the videos on their posters). */
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // The contents: a popover on phones. Where the Popover API is missing, the button toggles it.
  const contents = document.getElementById('contents');
  const toggle = document.querySelector('.contents-btn');
  if (contents && toggle && !HTMLElement.prototype.hasOwnProperty('popover')) {
    toggle.addEventListener('click', () => {
      const open = contents.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Line numbers, the way a bill is printed: one per laid-out line, redrawn when the measure changes.
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

  // The loops: sources are attached when a loop comes near the screen, and a loop plays only while it is seen and
  // the visitor has not asked for less motion. Otherwise the poster stays.
  const videos = [...document.querySelectorAll('video[data-loop]')];
  const dress = video => { if (video.dataset.poster && !video.poster) video.poster = video.dataset.poster; };
  const attach = video => {
    if (video.dataset.ready) return;
    video.dataset.ready = '1';
    for (const [type, src] of [['video/mp4; codecs="av01.0.08M.08"', video.dataset.av1], ['video/mp4', video.dataset.h264]]) {
      if (!src) continue;
      const source = document.createElement('source');
      source.src = src;
      source.type = type;
      video.append(source);
    }
    video.load();
  };
  const play = video => { if (!still.matches) video.play().catch(() => {}); };
  if (videos.length && 'IntersectionObserver' in window) {
    // The hero's loop waits for the page's own load, so it never competes with the fonts and the first paint.
    const loaded = new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
    const near = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      dress(e.target);
      if (still.matches) return;
      loaded.then(() => attach(e.target));
      near.unobserve(e.target);
    }), { rootMargin: '600px 0px' });
    const seen = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) play(e.target); else e.target.pause();
    }), { threshold: 0.15 });
    videos.forEach(v => { near.observe(v); seen.observe(v); });
    still.addEventListener('change', () => videos.forEach(v => (still.matches ? v.pause() : (attach(v), play(v)))));
  }

  // The amendment scene: five states of one article (as written, proposed, voted, signed off, ratified). Scroll moves
  // through them on a wide screen; the buttons move through them everywhere; the status line says each state aloud.
  const scene = document.querySelector('.amend');
  if (!scene) return;
  const buttons = [...scene.querySelectorAll('[data-to]')];
  const status = scene.querySelector('.status');
  const track = scene.querySelector('.amend__track');
  const set = (step, animate) => {
    if (String(step) === scene.dataset.step) return;
    const apply = () => {
      scene.dataset.step = String(step);
      buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.to) === step)));
      const chosen = buttons.find(b => Number(b.dataset.to) === step);
      if (status && chosen) status.innerHTML = chosen.dataset.status;
    };
    if (animate && document.startViewTransition && !still.matches) document.startViewTransition(apply);
    else apply();
  };
  buttons.forEach(b => b.addEventListener('click', () => {
    set(Number(b.dataset.to), true);
    driven = false;
  }));
  // Scroll drives the scene only where the stage is sticky (wide screens); a button press hands control to the
  // visitor until they scroll again.
  let driven = true;
  let frame = 0;
  const wide = matchMedia('(min-width: 64.01rem)');
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!wide.matches || !track) return;
      const box = track.getBoundingClientRect();
      const span = box.height - innerHeight;
      if (span <= 0) return;
      const progress = Math.min(1, Math.max(0, -box.top / span));
      if (!driven) { driven = true; return; }
      set(Math.min(4, Math.floor(progress * 5)), false);
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  set(wide.matches ? 0 : 1, false);
})();
