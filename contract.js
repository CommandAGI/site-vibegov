// The contract page (redesign/DESIGN.md § the contract page): each part of the contents is closed until it is opened.
// An address that names something inside a part (`contract.html#k7`, `#justice`) opens that part and goes to it.
function reveal() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  const part = target?.closest('details.part');
  if (!part) return;
  part.open = true;
  target.scrollIntoView();
}
reveal();
addEventListener('hashchange', reveal);
