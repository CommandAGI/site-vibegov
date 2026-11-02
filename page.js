// Puts the live record into the page: each `[data-live]` element gets its part of live.js, from the public API
// (`<meta name="vibegov-api">`). With no script, or with the API out of reach, each part says so and names the address
// to read it at. The front door refreshes its figures each minute while it is seen.
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

async function figures() {
  try {
    const s = await get('/public/contract/stats');
    const now = Date.now();
    put('figures', L.renderFigures(s));
    put('open-rfcs', L.renderOpenRfcs(s, now));
    put('decided', L.renderDecided(s, now));
    put('ledger', L.renderLedger(s, now));
    put('params', L.renderParameters(s));
    const h = L.health(s, now);
    put('pulse', `<span class="health health--${h.state}"><span class="dot" aria-hidden="true"></span>${L.count(s.log.length)} log entries · last ${s.log.headAt ? L.esc(L.relative(s.log.headAt, now)) : 'never'}</span>`);
  } catch (e) {
    unreachable(['figures', 'open-rfcs', 'decided', 'ledger', 'params', 'pulse'], e, '/public/contract/stats');
  }
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
    el('log') &&
      part(['log'], '/public/contract/log/head', async ({ head }) => {
        if (!head) return put('log', L.renderLog([], [], now));
        const { entries } = await get(`/public/contract/log?from=${Math.max(1, head.seq - 49)}&limit=50`);
        put('log', L.renderLog(entries, await logProblems(entries), now));
      }),
  ]);
}

if (el('figures') || el('pulse')) {
  figures();
  let timer = setInterval(figures, 60_000);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (!document.hidden) {
      figures();
      timer = setInterval(figures, 60_000);
    }
  });
}
kernel();
record();
