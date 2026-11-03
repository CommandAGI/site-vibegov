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
    put('open-rfcs', L.renderOpenRfcs(s, now));
    put('decided', L.renderDecided(s, now));
    put('ledger', L.renderLedger(s, now));
    put('params', L.renderParameters(s));
    const h = L.health(s, now);
    put('pulse', `<span class="health health--${h.state}"><span class="dot" aria-hidden="true"></span>${L.count(s.log.length)} log entries · last ${s.log.headAt ? L.esc(L.relative(s.log.headAt, now)) : 'never'}</span>`);
  } catch (e) {
    unreachable(['vitals', 'anchor', 'figures', 'open-rfcs', 'decided', 'ledger', 'params', 'pulse'], e, '/public/contract/stats');
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
  await Promise.all([activity(), calendar(), machines()]);
};
if (el('figures') || el('pulse')) {
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
// One RFC, named by the address (`record.html#rfc=<id>`): its tally once read, its count before.
async function rfc() {
  const node = el('rfc');
  if (!node) return;
  const id = L.rfcOfHash(location.hash);
  node.closest('section')?.toggleAttribute('hidden', !id);
  if (!id) return;
  const path = `/public/contract/rfcs/${encodeURIComponent(id)}/tally`;
  try {
    put('rfc', L.renderTally(await get(path), Date.now()));
    node.closest('section')?.scrollIntoView();
  } catch (e) {
    unreachable(['rfc'], e, path);
  }
}

kernel();
record();
rfc();
window.addEventListener('hashchange', rfc);
