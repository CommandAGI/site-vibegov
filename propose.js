// Open an RFC (redesign/APP.md § the pages): a port of CommandAGI's contract editor's RfcForm.tsx, with the draft and
// its request from files.ts (blankChange, toLawChange, optionSlug, rfcRequest). In the editor the draft is a
// `.rfc.tsx` file; here it is this form, kept in sessionStorage while it is edited. Its result is the same request
// `openRfc(draft)` posts to `POST /contract/rfcs`. The contract checks every option against the kernel and decides;
// this page gathers what the person means, shows how each option will read, and words what the contract refuses.
//
// The part above `boot` is pure (data in, escaped HTML out), so test/propose.test.mjs runs it with no browser. The
// session and the API are imported only when the page boots, because session.js reads the document.
import { words, hasWords, PARAMETER_KEYS, parameterUnit, parameterValue, describeLawChange, parseElements, refusalKey } from './contract-words.js';
import { esc, money, duration, date } from './live.js';

export const DRAFT_KEY = 'vibegov.propose.draft';
export const OPS = ['set_parameter', 'add_duty', 'amend_duty', 'repeal_duty', 'recognize_people', 'unrecognize_people', 'set_evidence_modalities'];
export const MEDIA = ['text', 'image', 'audio', 'video', 'file'];
export const UNIQUENESS = ['identity_fingerprint', 'lineage', 'registration', 'custodial_individual'];
const PROCEDURES = ['deliberative', 'binding_score'];

const t = words('rfcForm');
const p = words('lawParams');
const ch = words('changes');
const it = words('interests');
const refusalWords = words('refusals');

// ─── the draft (files.ts) ───────────────────────────────────────────────────────

export const blankChange = () => ({ op: 'set_parameter', key: 'rfcDepositCents', value: '', dutyId: '', title: '', text: '', protects: [], harm: '', elements: '', criminal: false, kind: '', uniqueness: 'lineage', issuers: '', modalities: ['text'] });
export const blankOption = () => ({ title: '', summary: '', changes: [blankChange()] });
export const blankRfcDraft = () => ({ procedure: 'deliberative', title: '', body: '', target: 'law', options: [blankOption()], engineJson: '' });

const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);

/** A stored draft as the form edits it: what it says, and the blank's value for each field it does not say (files.ts draftFile). */
export function draftOf(raw) {
  const base = blankRfcDraft();
  if (!isObject(raw)) return base;
  const options = Array.isArray(raw.options) && raw.options.length
    ? raw.options.filter(isObject).map(o => ({ ...blankOption(), ...o, changes: Array.isArray(o.changes) && o.changes.length ? o.changes.filter(isObject).map(c => ({ ...blankChange(), ...c })) : [blankChange()] }))
    : base.options;
  return { ...base, ...raw, options };
}

/** The law change an option's change means (files.ts toLawChange). */
export function toLawChange(c, now) {
  switch (c.op) {
    case 'set_parameter':
      return { op: 'set_parameter', key: c.key, value: Number.parseInt(c.value, 10) };
    case 'add_duty':
    case 'amend_duty':
      return { op: c.op, duty: { id: c.dutyId.trim(), title: c.title.trim(), text: c.text.trim(), protects: c.protects, harm: c.harm.trim(), elements: parseElements(c.elements), criminal: c.criminal, effectiveFrom: now } };
    case 'repeal_duty':
      return { op: 'repeal_duty', id: c.dutyId };
    case 'recognize_people':
      return { op: 'recognize_people', kind: { kind: c.kind.trim(), uniqueness: c.uniqueness, issuers: c.issuers.split(',').map(s => s.trim()).filter(Boolean) } };
    case 'unrecognize_people':
      return { op: 'unrecognize_people', kind: c.kind.trim() };
    case 'set_evidence_modalities':
      return { op: 'set_evidence_modalities', modalities: c.modalities.includes('text') ? c.modalities : ['text', ...c.modalities] };
  }
  return null;
}

export function optionSlug(title, i) {
  const x = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return x && x !== 'status-quo' ? x : `option-${i + 1}`;
}

/** What `POST /contract/rfcs` takes, from a draft; or `engine_json` when the pasted engine is not JSON (files.ts rfcRequest). */
export function rfcRequest(d, now) {
  if (d.target === 'engine') {
    let engine;
    try {
      engine = JSON.parse(d.engineJson);
    } catch {
      return { refusal: 'engine_json' };
    }
    const o = d.options[0];
    return { request: { procedure: d.procedure, title: d.title.trim(), body: d.body.trim(), options: [{ id: optionSlug(o?.title ?? '', 0), target: 'engine', title: o?.title.trim() || optionSlug('', 0), summary: o?.summary.trim() ?? '', engine }] } };
  }
  return {
    request: {
      procedure: d.procedure,
      title: d.title.trim(),
      body: d.body.trim(),
      options: d.options.map((o, i) => ({ id: optionSlug(o.title, i), target: 'law', title: o.title.trim() || optionSlug(o.title, i), summary: o.summary.trim(), changes: o.changes.map(c => toLawChange(c, now)) })),
    },
  };
}

/** The editor's one check before the button: a title and a body (RfcForm.tsx). The contract checks the rest. */
export const canOpen = d => !!d.title.trim() && !!d.body.trim();

// ─── edits: the form's events call these, and so does the test ────────────────

const FIELDS = new Set(['title', 'body', 'procedure', 'target', 'engineJson']);
const OPTION_FIELDS = new Set(['title', 'summary']);
const CHANGE_FIELDS = new Set(['op', 'key', 'value', 'dutyId', 'title', 'text', 'harm', 'elements', 'kind', 'uniqueness', 'issuers']);

/** The draft with one field set. `path` is `title`, `options.<i>.summary`, `options.<i>.changes.<k>.value` … */
export function setAt(draft, path, value) {
  const d = structuredClone(draft);
  const [a, i, b, k, f] = path.split('.');
  if (FIELDS.has(a) && i === undefined) {
    if (a === 'procedure' && !PROCEDURES.includes(value)) return d;
    if (a === 'target' && value !== 'law' && value !== 'engine') return d;
    d[a] = String(value);
    return d;
  }
  const o = a === 'options' ? d.options[Number(i)] : null;
  if (!o) return d;
  if (k === undefined && OPTION_FIELDS.has(b)) {
    o[b] = String(value);
    return d;
  }
  const c = b === 'changes' ? o.changes[Number(k)] : null;
  if (!c) return d;
  if (f === 'criminal') c.criminal = !!value;
  else if (CHANGE_FIELDS.has(f)) c[f] = f === 'value' ? String(value).replace(/[^0-9-]/g, '') : String(value);
  return d;
}

/** The draft with one item of a change's set (`protects`, `modalities`) turned on or off. Text is always admitted. */
export function toggleAt(draft, path, item) {
  const d = structuredClone(draft);
  const [, i, , k, f] = path.split('.');
  const c = d.options[Number(i)]?.changes[Number(k)];
  if (!c || (f !== 'protects' && f !== 'modalities')) return d;
  if (f === 'modalities' && item === 'text') return d;
  c[f] = c[f].includes(item) ? c[f].filter(x => x !== item) : [...c[f], item];
  return d;
}

export function addOption(d) { const n = structuredClone(d); n.options.push(blankOption()); return n; }
export function removeOption(d, i) { const n = structuredClone(d); if (n.options.length > 1) n.options.splice(i, 1); return n; }
export function addChange(d, i) { const n = structuredClone(d); n.options[i]?.changes.push(blankChange()); return n; }
export function removeChange(d, i, k) { const n = structuredClone(d); const o = n.options[i]; if (o && o.changes.length > 1) o.changes.splice(k, 1); return n; }

/** Amending a duty starts from its text in force when the person has written none of it yet. */
export function startFromDuty(d, i, k, law) {
  const n = structuredClone(d);
  const c = n.options[i]?.changes[k];
  const duty = law?.duties?.find(x => x.id === c?.dutyId);
  if (!c || !duty || c.op !== 'amend_duty' || c.title || c.text || c.harm || c.elements || c.protects.length) return n;
  Object.assign(c, { title: duty.title, text: duty.text, harm: duty.harm, protects: [...duty.protects], elements: duty.elements.map(e => `${e.id}: ${e.text}`).join('\n'), criminal: !!duty.criminal });
  return n;
}

// ─── how a change reads ─────────────────────────────────────────────────────────

const GAP = '…';
const valueOf = (key, v) => (Number.isInteger(v) ? parameterValue(key, v, money, p) : GAP);

/** One change as the people asked will read it (words.ts describeLawChange), with "…" where the draft is not written yet. */
export function changeSentence(c, now = 0) {
  const l = toLawChange(c, now);
  if (!l) return '';
  const shown = structuredClone(l);
  if (shown.duty) { shown.duty.title ||= GAP; shown.duty.id ||= GAP; }
  if (shown.op === 'repeal_duty') shown.id ||= GAP;
  if (shown.op === 'recognize_people') shown.kind.kind ||= GAP;
  if (shown.op === 'unrecognize_people') shown.kind ||= GAP;
  return describeLawChange(shown, ch, key => p(key), valueOf);
}

/** What the kernel fixes for a parameter (`kernel.floors`), as [article, words], or null (law.ts lawViolations). */
const FLOORS = {
  lawRfcWindowMs: ['lawRfcMinWindowMs', 'k4', 'at least'],
  engineRfcWindowMs: ['engineRfcMinWindowMs', 'k4', 'at least'],
  extractionContestMs: ['extractionContestMinMs', 'k4', 'at least'],
  caseResponseMs: ['caseResponseMinMs', 'k7', 'at least'],
  appealMs: ['appealMinMs', 'k7', 'at least'],
  expeditedResponseMs: ['expeditedResponseMinMs', 'k7', 'at least'],
  expeditedAppealMs: ['expeditedAppealMinMs', 'k7', 'at least'],
  criminalConfidencePermille: ['criminalConfidencePermille', 'k7', 'at least'],
  interimFreezeMs: ['interimFreezeMaxMs', 'k8', 'at most'],
  penaltyMultiplePermille: ['penaltyMaxMultiplePermille', 'k8', 'at most'],
  exclusionMaxMs: ['exclusionMaxMs', 'k8', 'at most'],
};
export function kernelBound(key, floors) {
  const f = FLOORS[key];
  const v = f && floors?.[f[0]];
  return Number.isInteger(v) ? { article: f[1], text: `${f[2]} ${parameterValue(key, v, money, p)}` } : null;
}

const uniquenessWords = u => (hasWords('rfcForm', `uniqueness.${u}`) ? t(`uniqueness.${u}`) : u);

/** What the law in force says about the thing a change touches: the other side of "as it will read". */
export function inForce(c, overview) {
  const law = overview?.law;
  if (!law) return '';
  const duty = id => law.duties.find(d => d.id === id.trim());
  switch (c.op) {
    case 'set_parameter': {
      const v = law.parameters?.[c.key];
      return Number.isInteger(v) ? `In force: ${parameterValue(c.key, v, money, p)}.` : '';
    }
    case 'add_duty': {
      const d = c.dutyId.trim() && duty(c.dutyId);
      return d ? `A duty with this id is in force already: “${d.title}”. Amend it instead.` : 'In force: no duty with this id.';
    }
    case 'amend_duty':
    case 'repeal_duty': {
      const d = c.dutyId && duty(c.dutyId);
      return d ? `In force: “${d.title}” (${d.id}), protecting ${d.protects.map(x => it(x)).join(', ')}${d.criminal ? '; criminal' : ''}.` : `In force: ${law.duties.length} duties. Choose one.`;
    }
    case 'recognize_people':
    case 'unrecognize_people': {
      const k = c.kind.trim() && law.people.find(x => x.kind === c.kind.trim());
      return k ? `In force: ${k.kind} is recognized, one voice per ${uniquenessWords(k.uniqueness)}.` : `In force: ${law.people.map(x => x.kind).join(', ')} ${law.people.length === 1 ? 'is' : 'are'} recognized.`;
    }
    case 'set_evidence_modalities':
      return `In force: ${law.evidenceModalities.join(', ')}.`;
  }
  return '';
}

// ─── the page's parts, as HTML ──────────────────────────────────────────────────

const id = path => `f-${path.replace(/\./g, '-')}`;
const ref = a => `<span class="ref">${esc(a)}</span>`;
const input = (path, value, extra = '') => `<input id="${id(path)}" data-path="${esc(path)}" value="${esc(value)}" autocomplete="off"${extra}>`;
const textarea = (path, value, rows, extra = '') => `<textarea id="${id(path)}" data-path="${esc(path)}" rows="${rows}"${extra}>${esc(value)}</textarea>`;
const select = (path, value, options, placeholder) =>
  `<select id="${id(path)}" data-path="${esc(path)}">${value ? '' : `<option value="" selected disabled>${esc(placeholder)}</option>`}${options.map(([v, label]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
const field = (path, label, control, hint = '') => `<div class="field"><label for="${id(path)}">${label}</label>${control}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
const checks = (path, items, chosen, label, locked = []) =>
  `<div class="checks" role="group" aria-label="${esc(label)}">${items.map(([v, words]) => `<label class="check"><input type="checkbox" data-toggle="${esc(path)}" value="${esc(v)}"${chosen.includes(v) ? ' checked' : ''}${locked.includes(v) ? ' disabled' : ''}> ${esc(words)}</label>`).join('')}</div>`;
const radios = (path, value, items) =>
  items.map(([v, words]) => `<label class="choice"><input type="radio" name="${esc(path)}" data-path="${esc(path)}" value="${esc(v)}"${v === value ? ' checked' : ''}> <span>${esc(words)}</span></label>`).join('');

/** One change of one option: the kind of change, its fields, and how it reads beside what is in force. */
export function renderChange(c, i, k, n, overview) {
  const at = `options.${i}.changes.${k}`;
  const law = overview?.law;
  const dutyIds = (law?.duties ?? []).map(d => [d.id, `${d.id}: ${d.title}`]);
  const interests = overview?.kernel?.interests ?? [];
  const parts = [field(`${at}.op`, `Change ${k + 1}`, select(`${at}.op`, c.op, OPS.map(op => [op, t(`op.${op}`)]), t('chooseChange')))];
  if (c.op === 'set_parameter') {
    const bound = kernelBound(c.key, overview?.kernel?.floors);
    const typed = Number.parseInt(c.value, 10);
    parts.push(`<div class="pair">${field(`${at}.key`, esc(t('chooseParameter')), select(`${at}.key`, c.key, PARAMETER_KEYS.map(key => [key, p(key)]), t('chooseParameter')), bound ? `${ref(bound.article)} The kernel holds it ${esc(bound.text)}.` : '')}${field(`${at}.value`, `${esc(t('value'))}, in ${esc(t(`unit.${parameterUnit(c.key)}`))}`, input(`${at}.value`, c.value, ` inputmode="numeric" placeholder="${esc(t(`unit.${parameterUnit(c.key)}`))}"`), `<span data-reads-value="${esc(at)}">${Number.isInteger(typed) ? `Reads as ${esc(valueOf(c.key, typed))}.` : 'A whole number.'}</span>`)}</div>`);
  }
  if (c.op === 'repeal_duty') parts.push(field(`${at}.dutyId`, esc(t('chooseDuty')), select(`${at}.dutyId`, c.dutyId, dutyIds, t('chooseDuty'))));
  if (c.op === 'add_duty' || c.op === 'amend_duty') {
    parts.push(
      c.op === 'amend_duty'
        ? field(`${at}.dutyId`, esc(t('chooseDuty')), select(`${at}.dutyId`, c.dutyId, dutyIds, t('chooseDuty')), 'Choosing a duty fills in its text in force, to amend.')
        : field(`${at}.dutyId`, esc(t('dutyId')), input(`${at}.dutyId`, c.dutyId, ' spellcheck="false"')),
      field(`${at}.title`, esc(t('dutyTitle')), input(`${at}.title`, c.title)),
      field(`${at}.text`, esc(t('dutyText')), textarea(`${at}.text`, c.text, 3)),
      `<p class="kernel">${ref('k5')} <q>Every duty the law creates names the protected interest it protects, the harm it forbids and the elements that make a breach, and binds everyone alike.</q></p>`,
      `<div class="field"><span class="label" id="${id(`${at}.protects`)}">${esc(t('protects').replace(/:$/, ''))}</span>${interests.length ? checks(`${at}.protects`, interests.map(x => [x, it(x)]), c.protects, t('protects')) : '<p class="hint">Reading the protected interests…</p>'}</div>`,
      field(`${at}.harm`, esc(t('harm')), input(`${at}.harm`, c.harm)),
      field(`${at}.elements`, esc(t('elements')), textarea(`${at}.elements`, c.elements, 3, ' spellcheck="false"'), `<span data-reads-elements="${esc(at)}">${esc(elementsWords(c.elements))}</span>`),
      `<label class="check"><input type="checkbox" data-path="${esc(at)}.criminal"${c.criminal ? ' checked' : ''}> ${esc(t('criminal'))}</label>`,
    );
  }
  if (c.op === 'set_evidence_modalities')
    parts.push(`<div class="field"><span class="label">Admitted as evidence</span><p class="hint">${ref('k10')} ${esc(t('modalitiesNote'))}</p>${checks(`${at}.modalities`, MEDIA.map(m => [m, m]), c.modalities.includes('text') ? c.modalities : ['text', ...c.modalities], 'Admitted as evidence', ['text'])}</div>`);
  if (c.op === 'recognize_people' || c.op === 'unrecognize_people') {
    parts.push(field(`${at}.kind`, esc(t('kind')), input(`${at}.kind`, c.kind, ' spellcheck="false"')));
    if (c.op === 'unrecognize_people') parts.push(`<p class="kernel">${ref('k2')} <q>Human is a kind of people and always will be.</q></p>`);
  }
  if (c.op === 'recognize_people')
    parts.push(
      field(`${at}.uniqueness`, esc(t('chooseUniqueness')), select(`${at}.uniqueness`, c.uniqueness, UNIQUENESS.map(u => [u, t(`uniqueness.${u}`)]), t('chooseUniqueness'))),
      field(`${at}.issuers`, esc(t('issuers')), input(`${at}.issuers`, c.issuers, ' spellcheck="false"')),
      `<p class="kernel">${ref('k2')} <q>Each kind has one uniqueness rule, and every issuer of that kind's proofs derives the same key for the same individual, so that one person cannot speak as many.</q></p>`,
    );
  return `<fieldset class="change"><legend class="sr-only">Option ${i + 1}, change ${k + 1}</legend>${parts.join('')}
  <div class="reads" data-reads="${esc(at)}">${renderReads(c, overview)}</div>
  ${n > 1 ? `<div class="change__act"><button class="btn small" type="button" data-act="remove-change" data-i="${i}" data-k="${k}">${esc(t('removeChange'))}</button></div>` : ''}</fieldset>`;
}

const elementsWords = text => {
  const els = parseElements(text);
  return els.length ? `${els.length} element${els.length === 1 ? '' : 's'}: ${els.map(e => e.id).join(', ')}.` : 'One element per line. A case determines each one (k7).';
};

export const renderReads = (c, overview) => `<p><b>Reads</b> ${esc(changeSentence(c))}</p>${overview?.law ? `<p class="now">${esc(inForce(c, overview))}</p>` : ''}`;

/** The options of a law RFC, or the one option of an engine RFC (RfcForm.tsx). */
export function renderOptions(d, overview) {
  if (d.target === 'engine') {
    const o = d.options[0] ?? blankOption();
    return `<fieldset class="fieldset option"><legend>${esc(t('newEngine'))}</legend>
      ${field('options.0.title', esc(t('optionTitle')), input('options.0.title', o.title))}
      ${field('options.0.summary', esc(t('optionSummary')), input('options.0.summary', o.summary))}
      <p class="kernel">${ref('k4')} <q>An engine replacement requires outgoing then incoming concurrence; the proposed engine holds no private record or credential before adoption.</q></p>
      ${field('engineJson', esc(t('engineJson')), textarea('engineJson', d.engineJson, 14, ' class="code" spellcheck="false"'), `${esc(t('engineNote'))} An engine has no fields here: it is its tiers, seats, pins and renderers, written as JSON, as in the contract editor. ${overview?.engine ? '<button class="btn small" type="button" data-act="copy-engine">Start from the engine in force</button>' : ''}`)}
    </fieldset>`;
  }
  return d.options
    .map((o, i) => `<fieldset class="fieldset option"><legend>${esc(t('optionN', { n: i + 1 }))}</legend>
      ${field(`options.${i}.title`, esc(t('optionTitle')), input(`options.${i}.title`, o.title), `Its id: <code data-slug="${i}">${esc(optionSlug(o.title, i))}</code>`)}
      ${field(`options.${i}.summary`, esc(t('optionSummary')), input(`options.${i}.summary`, o.summary), 'Not binding: the engine reads the changes, not the summary.')}
      ${o.changes.map((c, k) => renderChange(c, i, k, o.changes.length, overview)).join('')}
      <div class="form__act"><button class="btn small" type="button" data-act="add-change" data-i="${i}">${esc(t('addChange'))}</button>${d.options.length > 1 ? `<button class="btn small" type="button" data-act="remove-option" data-i="${i}">${esc(t('removeOption'))}</button>` : ''}</div>
    </fieldset>`)
    .join('') + `<div class="form__act"><button class="btn small" type="button" data-act="add-option">${esc(t('addOption'))}</button></div>`;
}

/** The whole question as the people asked will read it: the status quo the contract adds, then each option. */
export function renderBallot(d) {
  const title = d.title.trim() ? `<p class="ballot__title">${esc(d.title.trim())}</p>` : '<p class="ballot__title ballot__title--none">No title yet.</p>';
  const quo = '<li><span class="opt">status_quo</span><div><b>keep things as they are</b><small>No change. The contract adds this option.</small></div></li>';
  const options = d.target === 'engine'
    ? [`<li><span class="opt">${esc(optionSlug(d.options[0]?.title ?? '', 0))}</span><div><b>${esc(d.options[0]?.title.trim() || optionSlug('', 0))}</b><small>Replaces the engine with the one written as JSON${d.engineJson.trim() ? '' : ' (none written yet)'}.</small></div></li>`]
    : d.options.map((o, i) => `<li><span class="opt">${esc(optionSlug(o.title, i))}</span><div><b>${esc(o.title.trim() || optionSlug(o.title, i))}</b>${o.summary.trim() ? `<small>${esc(o.summary.trim())}</small>` : ''}<ol>${o.changes.map(c => `<li>${esc(changeSentence(c))}</li>`).join('')}</ol></div></li>`);
  return `${title}<p class="hint">${esc(t(`procedure.${d.procedure}`))}</p><ol class="ballot">${quo}${options.join('')}</ol>`;
}

/** What opening the RFC does and costs, from the law in force (§ RFCs 1; k4, k10). */
export function renderCosts(overview, target) {
  const law = overview?.law;
  if (!law) return '<p class="note">The law in force could not be read, so its deposit and window are not shown. The contract applies them when the RFC opens.</p>';
  const P = law.parameters;
  const floors = overview.kernel?.floors ?? {};
  const engine = target === 'engine';
  const windowMs = Math.max(engine ? P.engineRfcWindowMs : P.lawRfcWindowMs, (engine ? floors.engineRfcMinWindowMs : floors.lawRfcMinWindowMs) ?? 0);
  const kinds = law.people.map(k => k.kind);
  const hash = String(overview.engineHash ?? '');
  const rows = [
    ['Deposit', `${esc(t('depositNote', { deposit: money(P.rfcDepositCents) })).replace(esc(money(P.rfcDepositCents)), `<b>${esc(money(P.rfcDepositCents))}</b>`)} It is held from your account’s balance when the RFC opens.`],
    ['Open for', `<b>${esc(duration(windowMs))}</b> from the moment it opens (${esc(p(engine ? 'engineRfcWindowMs' : 'lawRfcWindowMs'))}). ${ref('k4')} The kernel holds it at least ${esc(duration((engine ? floors.engineRfcMinWindowMs : floors.lawRfcMinWindowMs) ?? 0))}.`],
    ['Who is asked', `Every person of a kind the law recognizes: <b>${esc(kinds.join(', '))}</b>. Each has one voice in it, given by their own act. ${ref('k2')}`],
    ['The options', `The contract adds the status quo. It refuses two options that produce the same resulting law, even with the same changes in another order, and two options with the same id.`],
    ['What it pins', `Contract version <b>${esc(String(overview.version ?? law.version))}</b> and the engine <code title="${esc(hash)}">${esc(hash.slice(0, 12))}${hash.length > 12 ? '…' : ''}</code>, which reads the responses and must concur. ${ref('k10')} <q>A matter is decided by the engine and procedure in force when it began.</q>`],
    ['After it closes', `The engine reads each response option by option, from −2 to +2. Each respondent may contest their reading for ${esc(duration(Math.max(P.extractionContestMs, floors.extractionContestMinMs ?? 0)))}.${engine ? ' The outgoing engine concurs first, then the proposed one.' : ''}`],
  ];
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

/** A route's detail names a moment in epoch milliseconds (`cooldown until 1802396563027`); a person reads a date. */
export const momentsAsDates = detail => String(detail).replace(/\b1\d{12}\b/g, ms => date(Number(ms)));

/** The refusals the API (or the form) gave, in the catalog's words; the route's own detail follows as data (Refusals.tsx). */
export function renderRefusals(refusals) {
  if (!refusals?.length) return '';
  return `<div class="refusal" role="alert" tabindex="-1"><p class="refusal__head">The contract did not open the RFC.</p><ul>${refusals
    .map(r => {
      const key = refusalKey(String(r.code));
      const said = key && hasWords('refusals', key) ? refusalWords(key) : refusalWords('unknown', { code: r.code });
      return `<li><span>${esc(said)}</span>${r.detail ? ` <span class="refusal__detail">${esc(momentsAsDates(r.detail))}</span>` : ''} <code>${esc(r.code)}</code></li>`;
    })
    .join('')}</ul></div>`;
}

/** The refusals the API may give an RFC, in the catalog's words: said before the button, so nobody learns them by failing. */
export const REFUSED = ['unauthorized', 'rfc.deposit', 'rfc.malformed', 'rfc.status_quo_reserved', 'rfc.mixed_targets', 'rfc.duplicate_option', 'rfc.duplicate_effect', 'rfc.no_change', 'rfc.repeat'];
export function renderWho() {
  return `<p>Anyone with a CommandAGI account opens an RFC: a person, or an agent signed in as one. Opening needs no personhood proof; answering does. The opener has no more voice in it than anyone else. ${ref('k4')}</p>
  <details class="refused"><summary>What the contract refuses</summary><ul>${REFUSED.map(c => `<li>${esc(refusalWords(refusalKey(c)))} <code>${esc(c)}</code></li>`).join('')}<li>${esc('An option that would breach the kernel, with the article it breaches.')} <code>k1 … k12</code></li></ul></details>`;
}

/** The question: title, what and why, the procedure, and what it changes (RfcForm.tsx, in its order). */
export function renderQuestion(d) {
  return `${field('title', esc(t('title')), input('title', d.title, ' maxlength="300" required'), 'Up to 300 characters.')}
  ${field('body', esc(t('body')), textarea('body', d.body, 6, ' maxlength="100000" required'))}
  <fieldset class="field"><legend>Procedure</legend><div class="choices">${radios('procedure', d.procedure, PROCEDURES.map(x => [x, t(`procedure.${x}`)]))}</div><p class="hint">${ref('k4')} ${esc(t('procedureNote'))}</p></fieldset>
  <fieldset class="field"><legend>What it changes</legend><div class="choices">${radios('target', d.target, [['law', t('targetLaw')], ['engine', t('targetEngine')]])}</div><p class="hint">All options of one RFC change the same thing.</p></fieldset>`;
}

export const missingWords = d => (canOpen(d) ? '' : `Give ${[!d.title.trim() && 'a title', !d.body.trim() && 'what and why'].filter(Boolean).join(' and ')} to open the RFC.`);

// ─── the page ───────────────────────────────────────────────────────────────────

async function boot() {
  const { requireSignIn, API } = await import('./session.js');
  if (!requireSignIn()) return;
  const { loadOverview, openRfc } = await import('./contract-api.js');
  const $ = s => document.querySelector(s);
  const form = $('#rfc-form');
  const store = {
    read() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } },
    write(d) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage may be off: the draft lasts for this page */ } },
    clear() { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing kept */ } },
  };
  let draft = draftOf(store.read());
  let overview = null;
  let pending = false;
  let refusals = [];
  if (store.read()) $('#kept').hidden = false;
  $('#who').innerHTML = renderWho();

  const drawLight = () => {
    store.write(draft);
    $('#ballot').innerHTML = renderBallot(draft);
    $('#costs').innerHTML = renderCosts(overview, draft.target);
    for (const el of form.querySelectorAll('[data-reads]')) {
      const [, i, , k] = el.dataset.reads.split('.');
      const c = draft.options[Number(i)]?.changes[Number(k)];
      if (c) el.innerHTML = renderReads(c, overview);
    }
    for (const el of form.querySelectorAll('[data-reads-value]')) {
      const [, i, , k] = el.dataset.readsValue.split('.');
      const c = draft.options[Number(i)]?.changes[Number(k)];
      const n = Number.parseInt(c?.value, 10);
      if (c) el.textContent = Number.isInteger(n) ? `Reads as ${valueOf(c.key, n)}.` : 'A whole number.';
    }
    for (const el of form.querySelectorAll('[data-reads-elements]')) {
      const [, i, , k] = el.dataset.readsElements.split('.');
      const c = draft.options[Number(i)]?.changes[Number(k)];
      if (c) el.textContent = elementsWords(c.elements);
    }
    for (const el of form.querySelectorAll('[data-slug]')) el.textContent = optionSlug(draft.options[Number(el.dataset.slug)]?.title ?? '', Number(el.dataset.slug));
    $('#open').disabled = pending || !canOpen(draft);
    $('#missing').textContent = pending ? 'Opening the RFC…' : missingWords(draft);
    $('#refusals').innerHTML = renderRefusals(refusals);
  };
  const draw = () => {
    const active = document.activeElement;
    const key = active?.dataset?.path ?? active?.dataset?.toggle ?? null;
    const val = active?.value;
    const act = active?.dataset?.act ? `${active.dataset.act}:${active.dataset.i ?? ''}` : null;
    $('#question').innerHTML = renderQuestion(draft);
    $('#options').innerHTML = renderOptions(draft, overview);
    $('#options-head').textContent = draft.target === 'engine' ? 'The engine' : 'The options';
    drawLight();
    // A redraw keeps the person where they were.
    const back = key
      ? [...form.querySelectorAll(`[data-path="${CSS.escape(key)}"], [data-toggle="${CSS.escape(key)}"]`)].find(el => el.type !== 'radio' && el.type !== 'checkbox' || el.value === val)
      : act ? form.querySelector(`[data-act="${CSS.escape(act.split(':')[0])}"]`) : null;
    back?.focus();
  };
  const edited = next => { draft = next; refusals = []; };

  form.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.path || el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') return;
    edited(setAt(draft, el.dataset.path, el.value));
    if (el.dataset.path.endsWith('.value')) {
      const [, i, , k] = el.dataset.path.split('.');
      const v = draft.options[Number(i)].changes[Number(k)].value;
      if (el.value !== v) el.value = v;
    }
    drawLight();
  });
  form.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.toggle) edited(toggleAt(draft, el.dataset.toggle, el.value));
    else if (el.type === 'checkbox' && el.dataset.path) edited(setAt(draft, el.dataset.path, el.checked));
    else if ((el.type === 'radio' || el.tagName === 'SELECT') && el.dataset.path) {
      edited(setAt(draft, el.dataset.path, el.value));
      const m = /^options\.(\d+)\.changes\.(\d+)\.dutyId$/.exec(el.dataset.path);
      if (m) draft = startFromDuty(draft, Number(m[1]), Number(m[2]), overview?.law);
    } else return;
    draw();
  });
  form.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = Number(b.dataset.i), k = Number(b.dataset.k);
    if (b.dataset.act === 'add-option') edited(addOption(draft));
    else if (b.dataset.act === 'remove-option') edited(removeOption(draft, i));
    else if (b.dataset.act === 'add-change') edited(addChange(draft, i));
    else if (b.dataset.act === 'remove-change') edited(removeChange(draft, i, k));
    else if (b.dataset.act === 'copy-engine' && overview?.engine) edited(setAt(draft, 'engineJson', JSON.stringify(overview.engine, null, 2)));
    else return;
    draw();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pending || !canOpen(draft)) return;
    pending = true;
    refusals = [];
    drawLight();
    const req = rfcRequest(draft, Date.now());
    const result = 'refusal' in req ? { ok: false, refusals: [{ code: req.refusal }] } : await openRfc(req.request);
    pending = false;
    if (!result.ok) {
      refusals = result.refusals;
      drawLight();
      $('#refusals').querySelector('[role="alert"]')?.focus();
      return;
    }
    store.clear();
    $('#refusals').innerHTML = `<p class="done" role="status">The RFC is open${result.id ? `: <code>${esc(result.id.slice(0, 16))}…</code>. Going to it…` : '.'} <a href="${result.id ? `rfc.html?id=${encodeURIComponent(result.id)}` : 'rfcs.html'}">Read it</a></p>`;
    form.querySelector('#open').disabled = true;
    if (result.id) location.assign(`rfc.html?id=${encodeURIComponent(result.id)}`);
  });
  $('#discard').addEventListener('click', () => {
    store.clear();
    edited(blankRfcDraft());
    $('#kept').hidden = true;
    draw();
  });

  draw();
  $('#law-state').textContent = 'Reading the law in force…';
  overview = await loadOverview();
  $('#law-state').textContent = overview?.law ? '' : `The law in force could not be read from ${API}/public/contract. You can still write the proposal; the contract checks it when it opens.`;
  $('#law-state').hidden = !!overview?.law;
  draw();
}

if (typeof document !== 'undefined' && document.getElementById('rfc-form')) boot();
