// A recording plays only while it is on screen (`video[data-loop]`), and not at all for a reader who asked for less
// motion: that reader gets the player's own controls.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
for (const video of document.querySelectorAll('video[data-loop]')) {
  new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting && !calm.matches) video.play().catch(() => {});
      else video.pause();
    }
  }, { threshold: 0.25 }).observe(video);
  if (calm.matches) video.controls = true;
}
