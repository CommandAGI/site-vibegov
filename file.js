// File a case (redesign/APP.md § the pages, file.html): a port of CommandAGI's contract editor's CaseForm.tsx, with the
// draft and the request of its files.ts (`blankCaseDraft`, `harmRowsOf`, `reliefRowsOf`, `caseRequest`). The fields,
// their order and the checks are the editor's. The form applies the kernel's limits (`reliefProblems`, k6 and k8)
// before the API is asked; the contract applies them again and is the one that decides. The claimant is whoever is
// signed in: the contract adds them. Filing for someone who cannot is `filedFor`, never acting as them.
//
// Left out, as the workbench's own (APP.md § the reference implementation): stream windows (StreamAttach.tsx), whose
// proof bundles are files in a Drive.
import { esc, requireSignIn } from './session.js';
import { fileCase, uploadMedia } from './contract-api.js';
import { centsOf, hasWords, reliefKindsFor, reliefProblems, toRemedies, words } from './contract-words.js';
import { count, duration, money } from './live.js';
import { art, filingTerms, parametersOf, read, refusalsHtml, unreachable } from './cases.js';

const t = words('caseForm');
const it = words('interests');
const rk = words('remedyKinds');
const md = words('media');

// ─── the draft and its request (files.ts) ────────────────────────────────────

/** Today in the viewer's own calendar (YYYY-MM-DD), not UTC's, which may already be tomorrow. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const blankHarm = i => ({ id: `harm-${i + 1}`, interest: 'property', description: '', amount: '' });
export const blankCaseDraft = (today = localDay()) => ({
  respondent: '',
  filedFor: '',
  criminal: false,
  source: 'law',
  dutyId: '',
  article: '',
  agreementId: '',
  term: '',
  act: '',
  actDate: today,
  harms: [blankHarm(0)],
  relief: [{ kind: 'restitution', description: '', harmIds: ['harm-1'], amount: '', days: '' }],
  evidence: '',
  media: [],
  reopens: '',
});

/** The harm items as the kernel's checks read them (cents; −1 when not a valid amount). */
export const harmRowsOf = d => d.harms.map(h => ({ id: h.id.trim(), description: h.description, amountCents: centsOf(h.amount || '0') ?? -1 }));

/** The relief rows as the kernel's checks read them. */
export const reliefRowsOf = d =>
  d.relief.map(r => ({
    kind: r.kind,
    description: r.description,
    harmIds: r.harmIds,
    ...(r.amount ? { amountCents: centsOf(r.amount) ?? -1 } : {}),
    ...(r.days ? { durationDays: Number(r.days) } : {}),
  }));

/**
 * What `POST /contract/cases` takes (files.ts `caseRequest`). The act is dated noon UTC of the chosen day, never later
 * than now: the contract refuses an act that has not happened yet. Media parts go as the contract stored them.
 */
export function caseRequest(d, now = Date.now()) {
  const duty = d.source === 'law' ? { source: 'law', dutyId: d.dutyId } : d.source === 'kernel' ? { source: 'kernel', article: d.article } : { source: 'agreement', agreementId: d.agreementId.trim(), term: d.term.trim() };
  const evidence = [...(d.evidence.trim() ? [{ type: 'text', text: d.evidence.trim() }] : []), ...d.media];
  return {
    respondent: d.respondent.trim(),
    ...(d.filedFor.trim() ? { filedFor: d.filedFor.trim() } : {}),
    criminal: d.criminal,
    duty,
    act: { description: d.act.trim(), at: Math.min(Date.parse(`${d.actDate}T12:00:00Z`), now) },
    harms: harmRowsOf(d).map((h, i) => ({ id: h.id, interest: d.harms[i].interest, description: h.description.trim(), amountCents: Math.max(0, h.amountCents) })),
    relief: toRemedies(reliefRowsOf(d)),
    evidence,
    ...(d.reopens.trim() ? { reopens: d.reopens.trim() } : {}),
  };
}

/** Restitution and compensation answer exactly one harm item. */
export const single = k => k === 'restitution' || k === 'compensation';

/** What the kernel would refuse (caseForm problem keys), when the law's limits are known; the editor's check. */
export const problemsOf = (d, limits) => (limits ? reliefProblems(harmRowsOf(d), reliefRowsOf(d), d.criminal, limits) : []);

/** The editor's button: no problem, a respondent and an act. */
export const canFile = (d, limits, pending = false) => !pending && problemsOf(d, limits).length === 0 && !!d.respondent.trim() && !!d.act.trim();

/** File, unless the form already knows the kernel would refuse it: then the API is not asked. */
export async function submitFiling(d, { limits, file = fileCase, now = Date.now() } = {}) {
  if (!canFile(d, limits)) return { ok: false, problems: problemsOf(d, limits), refusals: [] };
  return file(caseRequest(d, now));
}

/** The article each of the form's problems applies. */
const PROBLEM_ARTICLE = { problemNoHarm: 'k6', problemHarmId: 'k6', problemHarmDescription: 'k6' };

/** A draft's edit: the editor's rules for each field (a harm id is lowercase, a renamed harm stays cited, …). */
export function edit(d, path, value, checked) {
  const [head, i, key] = path.split('.');
  const n = Number(i);
  if (head === 'harms') {
    if (key === 'id') {
      const before = d.harms[n].id;
      const id = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      return { ...d, harms: d.harms.map((h, j) => (j === n ? { ...h, id } : h)), relief: d.relief.map(r => ({ ...r, harmIds: r.harmIds.map(x => (x === before ? id : x)) })) };
    }
    return { ...d, harms: d.harms.map((h, j) => (j === n ? { ...h, [key]: value } : h)) };
  }
  if (head === 'relief') {
    const row = d.relief[n];
    let patch;
    if (key === 'kind') patch = { kind: value, harmIds: single(value) ? row.harmIds.slice(0, 1) : row.harmIds };
    else if (key === 'harm') patch = { harmIds: single(row.kind) ? [value] : checked ? [...row.harmIds.filter(x => x !== value), value] : row.harmIds.filter(x => x !== value) };
    else if (key === 'days') patch = { days: String(value).replace(/[^0-9]/g, '') };
    else patch = { [key]: value };
    return { ...d, relief: d.relief.map((r, j) => (j === n ? { ...r, ...patch } : r)) };
  }
  if (path === 'criminal') return { ...d, criminal: value === 'criminal' };
  if (path === 'reopens') return { ...d, reopens: String(value).trim() };
  return { ...d, [path]: value };
}

/** The structural acts: add or remove a harm item or a remedy, remove an attached file. */
export function act(d, what, i) {
  switch (what) {
    case 'add-harm':
      return { ...d, harms: [...d.harms, blankHarm(d.harms.length)] };
    case 'remove-harm': {
      const id = d.harms[i].id;
      return { ...d, harms: d.harms.filter((_, j) => j !== i), relief: d.relief.map(r => ({ ...r, harmIds: r.harmIds.filter(x => x !== id) })) };
    }
    case 'add-relief':
      return { ...d, relief: [...d.relief, { kind: 'correction', description: '', harmIds: d.harms[0] ? [d.harms[0].id] : [], amount: '', days: '' }] };
    case 'remove-relief':
      return { ...d, relief: d.relief.filter((_, j) => j !== i) };
    case 'remove-media':
      return { ...d, media: d.media.filter((_, j) => j !== i) };
    default:
      return d;
  }
}

// ─── the form, as HTML ───────────────────────────────────────────────────────

const field = (id, label, control, hint = '') => `<div class="field"><label for="${id}">${label}</label>${control}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
const input = (id, k, value, more = '') => `<input id="${id}" data-k="${k}" value="${esc(value)}" ${more}>`;
const option = (value, label, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
const radio = (name, k, value, label, checked) => `<label><input type="radio" name="${name}" data-k="${k}" value="${esc(value)}"${checked ? ' checked' : ''}>${label}</label>`;
const head = (n, title, article) => `<div class="part-head"><h2 id="part-${n}">${esc(`${n} · ${title}`)}</h2>${article ? art(article) : ''}</div>`;

/** The elements a breach of the chosen duty is made of (core justice.ts `dutyFor`): what the claimant must establish. */
export function elementsOf(d, duties, articles) {
  if (d.source === 'law') {
    const duty = duties.find(x => x.id === d.dutyId);
    return duty ? { text: duty.text, protects: duty.protects ?? [], harm: duty.harm, criminal: !!duty.criminal, elements: duty.elements ?? [] } : null;
  }
  if (d.source === 'kernel') {
    const a = articles.find(x => x.id === d.article);
    if (!d.article) return null;
    return {
      text: a?.text ?? '',
      elements: [
        { id: 'conduct', text: `The respondent's act or omission went against kernel article ${d.article}.` },
        { id: 'harm', text: 'It caused the claimant (or the being filed for) harm to a protected interest.' },
      ],
    };
  }
  return {
    text: '',
    elements: [
      { id: 'agreement', text: 'The respondent accepted the agreement containing the term.' },
      { id: 'nonperformance', text: 'The respondent did not perform the term, and no term excused it.' },
      { id: 'harm', text: 'The nonperformance caused the claimant a loss.' },
    ],
  };
}

function dutyHtml(d, ctx) {
  const parts = [`<fieldset class="choice" aria-label="Where the duty comes from">${['law', 'kernel', 'agreement'].map(s => radio('source', 'source', s, esc(t(`source.${s}`)), d.source === s)).join('')}</fieldset>`];
  if (d.source === 'law')
    parts.push(field('f-duty', `${esc(t('chooseDuty'))}`, `<select id="f-duty" data-k="dutyId">${option('', t('chooseDuty'), !d.dutyId)}${ctx.duties.map(x => option(x.id, `${x.title} (${x.id})${x.criminal ? ' · criminal' : ''}`, d.dutyId === x.id)).join('')}</select>`, ctx.duties.length ? 'A duty of the law in force at the time of the act.' : 'The law could not be read, so no duty can be chosen. Reload the page.'));
  if (d.source === 'kernel')
    parts.push(field('f-article', esc(t('chooseArticle')), `<select id="f-article" data-k="article">${option('', t('chooseArticle'), !d.article)}${ctx.articles.map(a => option(a.id, `${a.id}. ${a.title}`, d.article === a.id)).join('')}</select>`, 'A kernel article alone is never a criminal duty.'));
  if (d.source === 'agreement')
    parts.push(`<div class="pair">${field('f-agreement', esc(t('agreementId')), input('f-agreement', 'agreementId', d.agreementId, 'autocomplete="off" spellcheck="false"'))}${field('f-term', esc(t('term')), input('f-term', 'term', d.term))}</div><p class="hint">An agreement the respondent accepted. Breach of an agreement alone is never a criminal matter.</p>`);
  const e = elementsOf(d, ctx.duties, ctx.articles);
  if (e)
    parts.push(`<div class="field"><p class="hint">${art('k7')} What must be established. The engine decides each element on its own, and you bear the burden of every one.</p>${e.protects?.length ? `<p class="hint">It protects: ${esc(e.protects.map(x => it(x)).join(', '))}. A harm item must name one of these interests (k6).${e.criminal ? ' Its breach is a criminal matter.' : ''}</p>` : ''}<ul class="facts-list">${e.elements.map(x => `<li><code>${esc(x.id)}</code>: ${esc(x.text)}</li>`).join('')}</ul></div>`);
  return parts.join('');
}

function harmHtml(h, i, d, ctx) {
  const p = `f-harm-${i}`;
  return `<fieldset class="fieldset"><legend>${esc(`Harm item ${i + 1}`)}</legend>
<div class="pair">${field(`${p}-id`, esc(t('harmId')), input(`${p}-id`, `harms.${i}.id`, h.id, 'autocomplete="off" spellcheck="false"'))}${field(`${p}-interest`, esc(t('chooseInterest')), `<select id="${p}-interest" data-k="harms.${i}.interest">${ctx.interests.map(x => option(x, it(x), h.interest === x)).join('')}</select>`)}</div>
${field(`${p}-description`, esc(t('harm')), input(`${p}-description`, `harms.${i}.description`, h.description))}
${field(`${p}-amount`, esc(t('harmAmount')), input(`${p}-amount`, `harms.${i}.amount`, h.amount, 'inputmode="decimal" placeholder="0.00" autocomplete="off"'))}
${d.harms.length > 1 ? `<div class="fieldset__foot"><button class="btn small quiet" type="button" data-do="remove-harm" data-i="${i}">${esc(t('removeHarm'))}</button></div>` : ''}</fieldset>`;
}

function reliefHtml(r, i, d, ctx) {
  const p = `f-relief-${i}`;
  const kinds = reliefKindsFor(d.criminal);
  const options = kinds.includes(r.kind) ? kinds : [...kinds, r.kind];
  const one = single(r.kind);
  const harms = d.harms
    .map(h => `<label><input type="${one ? 'radio' : 'checkbox'}" name="${p}-harm" data-k="relief.${i}.harm" value="${esc(h.id)}"${r.harmIds.includes(h.id) ? ' checked' : ''}><code>${esc(h.id || '—')}</code></label>`)
    .join('');
  return `<fieldset class="fieldset"><legend>${esc(`Remedy ${i + 1}`)}</legend>
${field(`${p}-kind`, esc(t('chooseRemedy')), `<select id="${p}-kind" data-k="relief.${i}.kind">${options.map(k => option(k, rk(k), r.kind === k)).join('')}</select>`)}
<div class="field"><p class="hint" id="${p}-answers">${esc(one ? t('answersOneHarm') : t('answersHarms'))}</p><fieldset class="choice" aria-labelledby="${p}-answers">${harms}</fieldset></div>
${field(`${p}-description`, esc(t('reliefDescription')), input(`${p}-description`, `relief.${i}.description`, r.description))}
${one || r.kind === 'penalty' ? field(`${p}-amount`, esc(t('reliefAmount')), input(`${p}-amount`, `relief.${i}.amount`, r.amount, 'inputmode="decimal" placeholder="0.00" autocomplete="off"')) : ''}
${r.kind === 'exclusion' ? field(`${p}-days`, esc(t('reliefDays')), input(`${p}-days`, `relief.${i}.days`, r.days, 'inputmode="numeric" autocomplete="off"'), ctx.limits ? esc(`At most ${duration(ctx.limits.exclusionMaxMs)}.`) : '') : ''}
${d.relief.length > 1 ? `<div class="fieldset__foot"><button class="btn small quiet" type="button" data-do="remove-relief" data-i="${i}">${esc(t('removeRelief'))}</button></div>` : ''}</fieldset>`;
}

/** The kernel's problems with the draft, in the catalog's words, each beside its article. */
export function problemsHtml(problems) {
  if (!problems.length) return '';
  return `<div class="problems" role="status"><ul>${problems.map(k => `<li><span class="art">${esc(PROBLEM_ARTICLE[k] ?? 'k8')}</span>${esc(hasWords('caseForm', k) ? t(k) : k)}</li>`).join('')}</ul></div>`;
}

/** The whole form for a draft. `ctx`: duties, articles, interests, limits, params, modalities, pending, refusals, media. */
export function formHtml(d, ctx) {
  const p = ctx.params ?? {};
  const penalty = ctx.limits ? Math.min(ctx.limits.penaltyMultiplePermille, 3000) / 1000 : null;
  return `<p class="note">${esc(t('note'))}</p>
<section aria-labelledby="part-1">${head(1, 'The parties', 'k6')}
${field('f-respondent', esc(t('respondent')), input('f-respondent', 'respondent', d.respondent, 'autocomplete="off" spellcheck="false" required'), 'The account id of the one who owed the duty. They are served before anything is decided.')}
${field('f-filedfor', esc(t('filedFor')), input('f-filedfor', 'filedFor', d.filedFor, 'autocomplete="off" spellcheck="false"'), esc(`The account id of ${t('filedForHint')}. You file; they are the harmed party.`))}
</section>
<section aria-labelledby="part-2">${head(2, 'Civil or criminal', 'k7')}
<fieldset class="choice" aria-label="Civil or criminal">${radio('criminal', 'criminal', 'civil', esc(t('civil')), !d.criminal)}${radio('criminal', 'criminal', 'criminal', esc(t('criminal')), d.criminal)}</fieldset>
${d.criminal ? `<p class="hint">${esc(t('criminalNote'))}</p>` : ''}
</section>
<section aria-labelledby="part-3">${head(3, 'The duty', 'k6')}
${dutyHtml(d, ctx)}
</section>
<section aria-labelledby="part-4">${head(4, 'The act', 'k6')}
${field('f-act', esc(t('act')), `<textarea id="f-act" data-k="act" rows="4" required>${esc(d.act)}</textarea>`, 'The act or omission, as it happened. Only the parties read it.')}
${field('f-actdate', esc(t('actDate')), input('f-actdate', 'actDate', d.actDate, `type="date" max="${esc(localDay())}"`), 'The law in force on this day is the law that judges it. An act that has not happened yet is refused.')}
</section>
<section aria-labelledby="part-5">${head(5, t('harmTitle'), 'k6')}
<p class="hint">${esc(t('harmNote'))}</p>
${d.harms.map((h, i) => harmHtml(h, i, d, ctx)).join('')}
<div><button class="btn small" type="button" data-do="add-harm">${esc(t('addHarm'))}</button></div>
</section>
<section aria-labelledby="part-6">${head(6, t('reliefTitle'), 'k8')}
<p class="hint">${esc(`Each remedy answers harm items of this filing, and no harm is repaired twice. A penalty${penalty !== null ? ` (at most ${penalty} times the total harm)` : ''} and an exclusion${ctx.limits ? ` (at most ${duration(ctx.limits.exclusionMaxMs)})` : ''} are for a criminal claim only. No remedy touches a body or compels labor.`)}</p>
${d.relief.map((r, i) => reliefHtml(r, i, d, ctx)).join('')}
<div><button class="btn small" type="button" data-do="add-relief">${esc(t('addRelief'))}</button></div>
</section>
<section aria-labelledby="part-7">${head(7, t('evidence'), 'k7')}
${field('f-evidence', esc(t('evidence')), `<textarea id="f-evidence" data-k="evidence" rows="5">${esc(d.evidence)}</textarea>`, 'What shows it happened. You may add more until the record closes.')}
<div class="field"><span class="hint">${esc(md('note'))}${ctx.modalities?.length ? esc(` The law admits: ${ctx.modalities.map(m => md(`modality.${m}`)).join(', ')}.`) : ''}</span>
${d.media.length ? `<ul class="attached">${d.media.map((m, i) => `<li><span>${esc(md(`modality.${m.modality}`))}</span><span>${esc(m.label ?? m.sha256.slice(0, 12))}</span><code>${esc(m.sha256.slice(0, 12))}</code><button class="btn small quiet" type="button" data-do="remove-media" data-i="${i}">${esc(md('remove'))}</button></li>`).join('')}</ul>` : ''}
<div class="attach-row"><label class="btn small" for="f-media">${esc(ctx.uploading ? md('uploading') : md('attach'))}</label><input class="vh" id="f-media" type="file" accept="image/*,audio/*" multiple${ctx.uploading ? ' disabled' : ''}></div>
${refusalsHtml(ctx.mediaRefusals)}</div>
${field('f-reopens', esc(t('reopens')), input('f-reopens', 'reopens', d.reopens, 'autocomplete="off" spellcheck="false"'), esc(`A case id: ${t('reopensHint')} (k6).`))}
</section>
<section aria-labelledby="part-8">${head(8, 'File', '')}
<div id="problems">${problemsHtml(problemsOf(d, ctx.limits))}</div>
<div id="refusals">${refusalsHtml(ctx.refusals)}</div>
${filingTerms(p)}
<div class="form__act"><button class="btn primary" data-ref="k6" type="submit" id="file-submit"${canFile(d, ctx.limits, ctx.pending) ? '' : ' disabled'}>${esc(ctx.pending ? 'Filing…' : t('submit'))}</button><span class="note" id="file-why">${esc(whyNot(d, ctx))}</span></div>
</section>`;
}

/** Why the button is off, in words (or nothing). */
export function whyNot(d, ctx) {
  if (ctx.pending) return 'Filing. Do not leave this page.';
  if (!d.respondent.trim()) return 'Name the respondent first.';
  if (!d.act.trim()) return 'Say what happened first.';
  if (problemsOf(d, ctx.limits).length) return 'Fix what is listed above first.';
  return '';
}

/** The law's figures beside the form. */
export function lawHtml(p, modalities) {
  const rows = [
    ['Cost deposit', typeof p.caseDepositCents === 'number' ? `${money(p.caseDepositCents)}, never a bar to filing` : null],
    ['Time to answer', typeof p.caseResponseMs === 'number' ? `${duration(p.caseResponseMs)} from service` : null],
    ['Evidence open', typeof p.caseEvidenceMs === 'number' ? `${duration(p.caseEvidenceMs)} after the answer is due` : null],
    ['Appeal window', typeof p.appealMs === 'number' ? `${duration(p.appealMs)} from the judgment` : null],
    ['Open cases', typeof p.openCasesPerClaimant === 'number' ? `at most ${count(p.openCasesPerClaimant)} per claimant` : null],
    ['Penalty cap', typeof p.penaltyMultiplePermille === 'number' ? `${Math.min(p.penaltyMultiplePermille, 3000) / 1000} times the total harm (criminal only)` : null],
    ['Longest exclusion', typeof p.exclusionMaxMs === 'number' ? `${duration(p.exclusionMaxMs)} (criminal only)` : null],
    ['Evidence admitted', modalities?.length ? modalities.join(', ') : null],
  ].filter(([, v]) => v);
  if (!rows.length) return '<p class="empty">The law’s parameters could not be read.</p>';
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

// ─── the page ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'vibegov.caseDraft';
const saved = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return d && Array.isArray(d.harms) && Array.isArray(d.relief) ? { ...blankCaseDraft(), ...d } : null;
  } catch {
    return null;
  }
};
const keep = d => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage off: the draft lasts for this page */ } };
const forget = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing kept */ } };

async function start() {
  if (!requireSignIn()) return;
  const form = document.getElementById('case-form');
  const law = document.getElementById('law');
  const [overview, stats] = await Promise.all([read('/public/contract', { anonymous: true }), read('/public/contract/stats', { anonymous: true })]);
  const o = overview.data;
  const ctx = {
    duties: o?.law?.duties ?? [],
    articles: o?.kernel?.articles ?? [],
    interests: o?.kernel?.interests ?? ['life', 'bodily_integrity', 'liberty', 'property', 'privacy', 'agreement', 'voice', 'access'],
    limits: o ? { penaltyMultiplePermille: o.law.parameters.penaltyMultiplePermille, exclusionMaxMs: o.law.parameters.exclusionMaxMs } : null,
    params: parametersOf(o, stats.data),
    modalities: o?.law?.evidenceModalities ?? [],
    pending: false,
    uploading: false,
    refusals: [],
    mediaRefusals: [],
  };
  law.innerHTML = overview.error && stats.error ? `<p class="empty">${esc(unreachable(overview.error))}</p>` : lawHtml(ctx.params, ctx.modalities);
  law.removeAttribute('aria-busy');
  let d = saved() ?? blankCaseDraft();

  const render = () => {
    const active = document.activeElement;
    const k = active?.dataset?.k;
    const v = active?.type === 'radio' || active?.type === 'checkbox' ? active.value : null;
    const at = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
    form.innerHTML = formHtml(d, ctx);
    form.removeAttribute('aria-busy');
    if (overview.error) form.insertAdjacentHTML('afterbegin', `<p class="refusal" role="alert">${esc(unreachable(overview.error))} The duties and the kernel’s limits could not be read; the contract still checks the filing.</p>`);
    if (k) {
      const again = [...form.querySelectorAll(`[data-k="${CSS.escape(k)}"]`)].find(el => v === null || el.value === v);
      if (again) {
        again.focus();
        if (at !== null && typeof again.setSelectionRange === 'function' && again.type !== 'date') try { again.setSelectionRange(at, at); } catch { /* not a text field */ }
      }
    }
  };
  // A keystroke changes the draft and the verdicts, not the form: the field keeps its caret.
  const refresh = () => {
    document.getElementById('problems').innerHTML = problemsHtml(problemsOf(d, ctx.limits));
    const button = document.getElementById('file-submit');
    button.disabled = !canFile(d, ctx.limits, ctx.pending);
    document.getElementById('file-why').textContent = whyNot(d, ctx);
    keep(d);
  };

  form.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.k || el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    const renamed = el.dataset.k.endsWith('.id') ? d.harms[Number(el.dataset.k.split('.')[1])].id : null;
    d = edit(d, el.dataset.k, el.value);
    // The editor's own clean-up of what was typed (a harm id is lowercase; days are digits).
    const shown = el.dataset.k.endsWith('.id') ? d.harms[Number(el.dataset.k.split('.')[1])].id : el.dataset.k.endsWith('.days') ? d.relief[Number(el.dataset.k.split('.')[1])].days : null;
    if (shown !== null && shown !== el.value) el.value = shown;
    // A renamed harm item stays cited by the remedies that named it: their choices take the new id in place.
    if (renamed !== null && renamed !== shown)
      for (const chip of form.querySelectorAll('input[data-k$=".harm"]')) {
        if (chip.value !== renamed) continue;
        chip.value = shown;
        chip.nextElementSibling.textContent = shown || '—';
      }
    refresh();
  });
  form.addEventListener('change', async e => {
    const el = e.target;
    if (el.id === 'f-media') {
      const files = [...(el.files ?? [])];
      if (!files.length) return;
      ctx.uploading = true;
      ctx.mediaRefusals = [];
      render();
      const added = [];
      for (const f of files) {
        const r = await uploadMedia(f);
        if (r.ok) added.push({ ...r.part, label: f.name });
        else ctx.mediaRefusals = [...ctx.mediaRefusals, ...r.refusals];
      }
      d = { ...d, media: [...d.media, ...added] };
      ctx.uploading = false;
      keep(d);
      return render();
    }
    // Only a choice changes the form's shape. A text field's change (on leaving it) re-renders nothing, so the button
    // the person is pressing at that moment stays the one they press.
    if (!el.dataset.k || !(el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT')) return;
    d = edit(d, el.dataset.k, el.value, el.checked);
    keep(d);
    render();
  });
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-do]');
    if (!b) return;
    d = act(d, b.dataset.do, Number(b.dataset.i));
    keep(d);
    render();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!canFile(d, ctx.limits, ctx.pending)) return;
    ctx.pending = true;
    ctx.refusals = [];
    render();
    const r = await submitFiling(d, { limits: ctx.limits });
    ctx.pending = false;
    if (r.ok && r.id) {
      forget();
      location.assign(`case.html?id=${encodeURIComponent(r.id)}`);
      return;
    }
    ctx.refusals = r.refusals ?? [];
    render();
    document.getElementById('refusals')?.scrollIntoView({ block: 'center' });
  });
  render();
}

if (globalThis.document?.getElementById?.('case-form')) start();
