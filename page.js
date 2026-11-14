// Puts the live record into the page: each `[data-live]` element gets its part of live.js, from the public API
// (`<meta name="vibegov-api">`). With no script, or with the API out of reach, each part says so and names the address
// to read it at. The front door reads its public views each 30 s while it is seen, and words its times again each second.
import * as L from './live.js';
import { kernelHash, logProblems } from './verify.js';

const base = document.querySelector('meta[name="vibegov-api"]')?.content || L.API;
const el = name => document.querySelector(`[data-live="${name}"]`);
const put = (name, html) => {
  const node = el(name);
  if (!node) return;
  node.innerHTML = html;
  node.removeAttribute('aria-busy');
};
const unreachable = (names, error, path) =>
  names.forEach(n => put(n, `<p class="empty">The live record could not be reached (${L.esc(error.message)}). It is public at <a href="${L.esc(base + path)}">${L.esc(base + path)}</a>.</p>`));
const get = path => L.getJson(fetch, base, path);

let stats = null;
async function figures() {
  try {
    const s = (stats = await get('/public/contract/stats'));
    const now = Date.now();
    put('vitals', L.renderVitals(s, now));
    put('anchor', L.renderAnchor(s, now));
    put('figures', L.renderFigures(s));
    put('rfc-strip', L.renderRfcStrip(s, now));
    put('decided', L.renderDecided(s, now));
    put('ledger', L.renderLedger(s, now));
    put('params', L.renderParameters(s));
    put('plate-voice', L.renderVoicePlate(s));
    put('plate-change', L.renderChangePlate(s));
    put('plate-case', L.renderCasePlate(s));
  } catch (e) {
    unreachable(['vitals', 'anchor', 'figures', 'rfc-strip', 'decided', 'ledger', 'params', 'plate-voice', 'plate-change', 'plate-case'], e, '/public/contract/stats');
  }
}

// What just happened, what comes next, and the machines: each its own public view, refreshed while the page is seen.
const view = (name, path, render) => async () => {
  if (!el(name)) return;
  try {
    put(name, render(await get(path), Date.now()));
  } catch (e) {
    unreachable([name], e, path);
  }
};
const activity = view('activity', '/public/contract/activity', (a, now) => L.renderActivity(a, stats, now));
const calendar = view('calendar', '/public/contract/calendar', L.renderCalendar);
const machines = async () => {
  if (!el('robots')) return;
  try {
    const v = await get('/public/contract/robots');
    const now = Date.now();
    put('robots', L.renderRobots(v, now, base));
    put('commands', L.renderCommands(v, now));
    // A frame that cannot be fetched (no display channel, a stream that ended) leaves its card without a picture.
    document.querySelectorAll('img[data-frame]').forEach(img => img.addEventListener('error', () => img.replaceWith(Object.assign(document.createElement('div'), { className: 'robot__frame robot__frame--none' })), { once: true }));
  } catch (e) {
    unreachable(['robots', 'commands'], e, '/public/contract/robots');
  }
};

// A recorded run, copied into this site byte for byte; it never changes, so it is read once.
async function recording() {
  const node = el('recording');
  if (!node) return;
  try {
    const res = await fetch(node.dataset.src);
    if (!res.ok) throw new Error(`${node.dataset.src} answered ${res.status}`);
    put('recording', L.renderRecording(L.parseServoRun(await res.text())));
  } catch (e) {
    put('recording', `<p class="empty">The recording could not be read (${L.esc(e.message)}).</p>`);
  }
}

// The front door's ledger: the log's three newest entries as blocks, the newest on top. They stand still. When the
// log gains an entry while the page is open, its block comes in at the top and pushes the others down: the one
// movement, and it happens only when the record changes. The page recomputes each hash it shows.
const SHOW = 3;
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let head = 0, checked = 0;
function push(entry, slide) {
  const list = el('chain')?.querySelector('ol');
  if (!list) return;
  list.insertAdjacentHTML('afterbegin', L.renderBlock(entry, Date.now()));
  while (list.children.length > SHOW + 1) list.lastElementChild.remove();
  if (!slide || calm.matches) return;
  // Start one block up with no transition, then let the stack come down.
  list.classList.remove('is-moving');
  list.style.transform = 'translateY(calc(-1 * var(--block)))';
  list.getBoundingClientRect();
  list.classList.add('is-moving');
  list.style.transform = '';
}
async function chain() {
  if (!el('chain')) return;
  try {
    const top = (await get('/public/contract/log/head')).head;
    if (!top) return put('chain', '<p class="empty">The log has no entry yet.</p>');
    if (top.seq === head) return;
    // Read from the last entry the page has, so the check covers the link to the new ones.
    const { entries } = await get(`/public/contract/log?from=${head || Math.max(1, top.seq - SHOW + 1)}&limit=50`);
    const problems = await logProblems(entries);
    const fresh = entries.filter(e => e.seq > head);
    if (!head) put('chain', '<ol class="blocks"></ol>');
    fresh.forEach(e => push(e, !!head));
    checked = Math.min(SHOW, checked + fresh.length);
    head = top.seq;
    put('chain-check', L.renderChainCheck(checked, problems));
  } catch (e) {
    if (!head) unreachable(['chain'], e, '/public/contract/log/head');
  }
}

// Every time on the page words itself again each second: "4 seconds ago", and countdowns to each deadline.
function tick() {
  const now = Date.now();
  document.querySelectorAll('[data-at]').forEach(t => { t.textContent = L.relative(Number(t.dataset.at), now); });
  document.querySelectorAll('[data-until]').forEach(t => { t.textContent = L.countdown(Number(t.dataset.until) - now); });
}

async function kernel() {
  if (!el('kernel')) return;
  try {
    const [contract, page] = await Promise.all([get('/public/contract'), fetch('contract.html').then(r => (r.ok ? r.text() : ''))]);
    const pinned = page.match(/<dt>Kernel<\/dt><dd><code title="([0-9a-f]{64})"/)?.[1] ?? null;
    put('kernel', L.renderKernelCheck({ claimed: contract.kernel.hash, recomputed: await kernelHash(contract.kernel), pinned }));
  } catch (e) {
    unreachable(['kernel'], e, '/public/contract');
  }
}

async function record() {
  const now = Date.now();
  const part = async (names, path, render) => {
    try {
      await render(await get(path));
    } catch (e) {
      unreachable(names, e, path);
    }
  };
  await Promise.all([
    el('rfcs') && part(['rfcs'], '/public/contract/rfcs', d => put('rfcs', L.renderRfcTable(d.rfcs, now))),
    el('judgments') && part(['judgments'], '/public/contract/judgments', d => put('judgments', L.renderJudgments(d.judgments, now))),
    el('checkpoints') && part(['checkpoints'], '/public/contract/checkpoints', d => put('checkpoints', L.renderCheckpoints(d, now))),
    el('versions') && part(['versions'], '/public/contract/versions', d => put('versions', L.renderVersions(d.versions))),
    el('engine') && part(['engine'], '/public/contract/engine', d => put('engine', L.renderEngine(d))),
    el('log') &&
      part(['log'], '/public/contract/log/head', async ({ head }) => {
        if (!head) return put('log', L.renderLog([], [], now));
        const { entries } = await get(`/public/contract/log?from=${Math.max(1, head.seq - 49)}&limit=50`);
        put('log', L.renderLog(entries, await logProblems(entries), now));
      }),
  ]);
}

// The public views are cached for 30 s at the API, so reading them each 30 s while the page is seen is the freshest
// they get; a hidden page reads nothing.
const refresh = async () => {
  await figures();
  await Promise.all([activity(), calendar(), machines(), chain()]);
};
if (el('figures') || el('plate-voice') || el('vitals')) {
  refresh();
  let timer = setInterval(refresh, 30_000);
  let ticker = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    clearInterval(ticker);
    if (!document.hidden) {
      refresh();
      timer = setInterval(refresh, 30_000);
      ticker = setInterval(tick, 1000);
    }
  });
}
recording();
kernel();
record();
