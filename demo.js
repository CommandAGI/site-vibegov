/* The governance room: one round of governance on a fictional sample organization, in the visitor's browser only.
   Every word is from M below, chosen by the page's lang, so one page serves each locale. The rules the round applies
   are the constitution template's (constitution.html): an amendment needs two-thirds of the weight cast, a person's
   weight is 3, an agent's is capped at 2, and a dissent stays in the record. */
(() => {
  const LI = (document.documentElement.lang || 'en').toLowerCase();
  const LOCALE = LI.startsWith('zh') ? 'zh' : LI.startsWith('es') ? 'es' : 'en';

  const M = {
    en: {
      eyebrow: 'Demo · a fictional organization',
      title: 'The governance room',
      lede: 'One round of governance on Helios Labs, an invented lab-robotics company with two people and two AI agents. Nothing you do here leaves this page.',
      steps: ['Propose', 'Vote', 'Audit drift', 'Rule'],
      chooseTitle: 'Step 1 · Choose a proposal',
      chooseLede: 'Each proposal quotes the article it changes. An amendment needs two-thirds of the weight cast.',
      continue: 'Continue to the vote',
      voteTitle: 'Step 2 · Cast your vote',
      voteLede: 'Your weight is the square root of the credits you commit, at most 3: quadratic voting, so conviction costs more than it counts.',
      credits: 'Credits committed',
      weight: 'Your weight',
      position: 'Your vote',
      positions: { for: 'For', against: 'Against', abstain: 'Abstain' },
      reason: 'Your reason (kept beside the count)',
      reasonPlaceholder: 'Say why, in one sentence.',
      cast: 'Cast the vote',
      tallyTitle: 'The tally',
      columns: ['Member', 'Vote', 'Weight', 'Rule it rests on'],
      person: 'Article 1: a person holds a weight of 3',
      agent: "Article 4: an agent's weight is capped at 2",
      delegated: 'Article 3: a delegation to Maya, reviewed each round',
      delegatedMark: ' (delegated)',
      for: 'For',
      against: 'Against',
      abstain: 'Abstain',
      auditTitle: 'Step 3 · Audit the drift',
      auditLede: 'The room checks this round against the constitution: the amendment threshold, the dissent and the article each vote rests on.',
      audit: 'Run the audit',
      ok: 'Aligned',
      warn: 'Drift: a person must review',
      bad: 'Drift: the amendment did not carry',
      rulingTitle: 'Step 4 · The ruling',
      rulingLede: 'A three-member panel rules on the round. The ruling cites the article it rests on and joins the precedent list.',
      rule: 'Ask the panel to rule',
      up: 'The amendment carries',
      down: 'The proposal is dismissed',
      again: 'Start another round',
      recordTitle: "The round's record",
      recordNote: 'In a real organization this record is files in its own Drive: one each for the proposal, the votes, the finding and the ruling.',
      empty: 'Nothing recorded yet.',
      reset: 'Clear this session',
      kinds: { proposal: 'proposal', vote: 'vote', drift: 'drift', ruling: 'ruling' },
      pct: value => `${Math.round(value * 1000) / 10}%`,
      threshold: 'for of the weight cast; the amendment needs two-thirds',
      sample: 'Sample organization: Helios Labs. Sample people and agents.',
    },
    es: {
      eyebrow: 'Demostración · una organización ficticia',
      title: 'La sala de gobierno',
      lede: 'Una ronda de gobierno en Helios Labs, una empresa inventada de robótica de laboratorio con dos personas y dos agentes de IA. Nada de lo que hagas aquí sale de esta página.',
      steps: ['Proponer', 'Votar', 'Auditar la deriva', 'Fallar'],
      chooseTitle: 'Paso 1 · Elige una propuesta',
      chooseLede: 'Cada propuesta cita el artículo que cambia. Una enmienda necesita dos tercios del peso emitido.',
      continue: 'Seguir a la votación',
      voteTitle: 'Paso 2 · Emite tu voto',
      voteLede: 'Tu peso es la raíz cuadrada de los créditos que comprometes, como máximo 3: voto cuadrático, así la convicción cuesta más de lo que cuenta.',
      credits: 'Créditos comprometidos',
      weight: 'Tu peso',
      position: 'Tu voto',
      positions: { for: 'A favor', against: 'En contra', abstain: 'Abstención' },
      reason: 'Tu motivo (queda junto al recuento)',
      reasonPlaceholder: 'Di por qué, en una frase.',
      cast: 'Emitir el voto',
      tallyTitle: 'El recuento',
      columns: ['Miembro', 'Voto', 'Peso', 'Artículo en que se apoya'],
      person: 'Artículo 1: una persona tiene un peso de 3',
      agent: 'Artículo 4: el peso de un agente se limita a 2',
      delegated: 'Artículo 3: una delegación en Maya, revisada en cada ronda',
      delegatedMark: ' (delegado)',
      for: 'A favor',
      against: 'En contra',
      abstain: 'Abstención',
      auditTitle: 'Paso 3 · Audita la deriva',
      auditLede: 'La sala contrasta esta ronda con la constitución: el umbral de la enmienda, la disidencia y el artículo en que se apoya cada voto.',
      audit: 'Ejecutar la auditoría',
      ok: 'Sin deriva',
      warn: 'Deriva: una persona debe revisarla',
      bad: 'Deriva: la enmienda no prosperó',
      rulingTitle: 'Paso 4 · El fallo',
      rulingLede: 'Un panel de tres miembros falla sobre la ronda. El fallo cita el artículo en que se apoya y entra en la lista de precedentes.',
      rule: 'Pedir el fallo del panel',
      up: 'La enmienda prospera',
      down: 'La propuesta se desestima',
      again: 'Empezar otra ronda',
      recordTitle: 'El acta de la ronda',
      recordNote: 'En una organización real este acta son archivos en su propio Drive: uno por la propuesta, los votos, la conclusión y el fallo.',
      empty: 'Todavía no hay nada registrado.',
      reset: 'Borrar esta sesión',
      kinds: { proposal: 'propuesta', vote: 'voto', drift: 'deriva', ruling: 'fallo' },
      pct: value => `${(Math.round(value * 1000) / 10).toString().replace('.', ',')} %`,
      threshold: 'a favor del peso emitido; la enmienda necesita dos tercios',
      sample: 'Organización de muestra: Helios Labs. Personas y agentes de muestra.',
    },
    zh: {
      eyebrow: '演示 · 一个虚构的组织',
      title: '治理室',
      lede: '在 Helios Labs 上走一轮治理。Helios Labs 是一家虚构的实验室机器人公司，有两名人和两个 AI 智能体。你在这里做的事不会离开这个页面。',
      steps: ['提案', '投票', '审计漂移', '裁决'],
      chooseTitle: '第 1 步 · 选择一份提案',
      chooseLede: '每份提案都引用它要修改的条款。修正案需要已投票权重的三分之二。',
      continue: '进入投票',
      voteTitle: '第 2 步 · 投出你的一票',
      voteLede: '你的权重是你所投入积分的平方根，最多为 3：这是二次方投票，信念的代价高于它所占的票数。',
      credits: '投入的积分',
      weight: '你的权重',
      position: '你的选择',
      positions: { for: '赞成', against: '反对', abstain: '弃权' },
      reason: '你的理由（与计票一同保留）',
      reasonPlaceholder: '用一句话说明理由。',
      cast: '投票',
      tallyTitle: '计票',
      columns: ['成员', '选择', '权重', '所依据的条款'],
      person: '第一条：每个人的权重为 3',
      agent: '第四条：智能体的权重上限为 2',
      delegated: '第三条：授权给 Maya，每轮复核',
      delegatedMark: '（已授权）',
      for: '赞成',
      against: '反对',
      abstain: '弃权',
      auditTitle: '第 3 步 · 审计漂移',
      auditLede: '治理室依据宪法检查本轮：修正案的阈值、异议，以及每张票所依据的条款。',
      audit: '执行审计',
      ok: '无漂移',
      warn: '漂移：须由人复核',
      bad: '漂移：修正案未通过',
      rulingTitle: '第 4 步 · 裁决',
      rulingLede: '由三名成员组成的合议庭对本轮作出裁决。裁决引用它所依据的条款，并进入先例列表。',
      rule: '请合议庭裁决',
      up: '修正案通过',
      down: '提案被驳回',
      again: '再来一轮',
      recordTitle: '本轮记录',
      recordNote: '在真实的组织里，这份记录是该组织自己 Drive 中的文件：提案、选票、结论和裁决各一份。',
      empty: '还没有任何记录。',
      reset: '清空本次会话',
      kinds: { proposal: '提案', vote: '选票', drift: '漂移', ruling: '裁决' },
      pct: value => `${Math.round(value * 1000) / 10}%`,
      threshold: '赞成，占已投票权重的比例；修正案需要三分之二',
      sample: '样本组织：Helios Labs。样本人物与智能体。',
    },
  };
  const t = M[LOCALE];

  const PROPOSALS = {
    en: [
      { id: 'agent-council', article: 'Article 4', title: 'Admit a new AI agent to the treasury council', text: 'Article 4 lets an agent hold a treasury seat when two-thirds of the weight admits it. This proposal admits Juno, the lab-operations agent, to the council for one year.' },
      { id: 'publish-30', article: 'Article 2', title: 'Publish every decision after 30 days', text: 'Article 2 says decisions are transparent. This proposal sets the term at 30 days and names the record kept: the decision, its votes and its reasons, with the customer data removed.' },
      { id: 'agent-allocation', article: 'Article 4', title: "Give an agent its own treasury allocation", text: "Article 4 caps an agent's allocation at 5% of the treasury. This proposal sets Atlas's allocation at 3%, reviewed each round." },
    ],
    es: [
      { id: 'agent-council', article: 'Artículo 4', title: 'Admitir un nuevo agente de IA en el consejo del tesoro', text: 'El artículo 4 permite que un agente ocupe un puesto en el tesoro cuando lo admite dos tercios del peso. Esta propuesta admite a Juno, el agente de operaciones del laboratorio, por un año.' },
      { id: 'publish-30', article: 'Artículo 2', title: 'Publicar cada decisión a los 30 días', text: 'El artículo 2 dice que las decisiones son transparentes. Esta propuesta fija el plazo en 30 días y nombra el registro que se guarda: la decisión, sus votos y sus motivos, sin los datos de clientes.' },
      { id: 'agent-allocation', article: 'Artículo 4', title: 'Dar a un agente su propia asignación del tesoro', text: 'El artículo 4 limita la asignación de un agente al 5 % del tesoro. Esta propuesta fija la asignación de Atlas en el 3 %, revisada en cada ronda.' },
    ],
    zh: [
      { id: 'agent-council', article: '第四条', title: '接纳一个新的 AI 智能体进入财务委员会', text: '第四条允许在三分之二权重同意时由智能体占据财务席位。本提案接纳实验室运营智能体 Juno 进入委员会，任期一年。' },
      { id: 'publish-30', article: '第二条', title: '每项决定在 30 天后公开', text: '第二条规定决定是透明的。本提案把期限定为 30 天，并写明所保留的记录：决定、它的选票和理由，去除客户数据。' },
      { id: 'agent-allocation', article: '第四条', title: '给某个智能体自己的财务拨款', text: '第四条把智能体的拨款上限设为财务的 5%。本提案把 Atlas 的拨款定为 3%，每轮复核。' },
    ],
  }[LOCALE];

  const MEMBERS = {
    en: { maya: 'Maya Chen', omar: 'Omar Haddad', atlas: 'Atlas', juno: 'Juno' },
    es: { maya: 'Maya Chen', omar: 'Omar Haddad', atlas: 'Atlas', juno: 'Juno' },
    zh: { maya: 'Maya Chen', omar: 'Omar Haddad', atlas: 'Atlas', juno: 'Juno' },
  }[LOCALE];

  const DISSENTS = {
    en: {
      atlas: 'A treasury seat carries authority over money, and the new agent has no record with it.',
      juno: 'An agent that holds the treasury must not also be a treasurer.',
    },
    es: {
      atlas: 'Un puesto en el tesoro da autoridad sobre el dinero, y el nuevo agente no tiene historial con él.',
      juno: 'Un agente que recibe del tesoro no debe ser además tesorero.',
    },
    zh: {
      atlas: '财务席位意味着对资金的支配权，而新智能体在这方面没有任何记录。',
      juno: '从财务中拨款的智能体不应同时担任财务管理者。',
    },
  }[LOCALE];

  // The round's preset votes, one set per proposal: a person (weight 3), a delegation to that person, and two agents
  // (weight capped at 2). The visitor's own vote joins them.
  const PRESET = {
    'agent-council': [
      { key: 'maya', kind: 'person', vote: 'for', weight: 3, rule: 'person' },
      { key: 'omar', kind: 'person', vote: 'for', weight: 3, rule: 'delegated' },
      { key: 'atlas', kind: 'agent', vote: 'against', weight: 2, rule: 'agent', reason: DISSENTS.atlas },
      { key: 'juno', kind: 'agent', vote: 'for', weight: 2, rule: 'agent' },
    ],
    'publish-30': [
      { key: 'maya', kind: 'person', vote: 'for', weight: 3, rule: 'person' },
      { key: 'omar', kind: 'person', vote: 'for', weight: 3, rule: 'person' },
      { key: 'atlas', kind: 'agent', vote: 'for', weight: 2, rule: 'agent' },
      { key: 'juno', kind: 'agent', vote: 'abstain', weight: 2, rule: 'agent', reason: DISSENTS.juno },
    ],
    'agent-allocation': [
      { key: 'maya', kind: 'person', vote: 'for', weight: 3, rule: 'person' },
      { key: 'omar', kind: 'person', vote: 'for', weight: 3, rule: 'delegated' },
      { key: 'atlas', kind: 'agent', vote: 'abstain', weight: 2, rule: 'agent', reason: DISSENTS.atlas },
      { key: 'juno', kind: 'agent', vote: 'against', weight: 2, rule: 'agent', reason: DISSENTS.juno },
    ],
  };

  const state = { step: 1, proposal: null, position: 'for', credits: 4, reason: '', tally: null, drift: null, ruling: null, record: [] };
  const panel = document.getElementById('panel');
  const stepsList = document.getElementById('steps');
  const recordList = document.getElementById('record');

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    }
    for (const child of children) if (child) node.append(child);
    return node;
  };
  const paragraph = (text, cls) => el('p', cls ? { class: cls, text } : { text });
  const weightOf = credits => Math.min(3, Math.max(1, Math.round(Math.sqrt(credits))));

  function renderSteps() {
    stepsList.replaceChildren(...t.steps.map((label, i) => {
      const li = el('li', i + 1 === state.step ? { 'aria-current': 'step' } : i + 1 < state.step ? { class: 'done' } : {});
      li.append(el('span', { text: String(i + 1) }), document.createTextNode(label));
      return li;
    }));
  }

  function renderRecord() {
    recordList.replaceChildren();
    if (!state.record.length) { recordList.append(el('li', { class: 'note', text: t.empty })); return; }
    state.record.forEach(entry => {
      const li = el('li');
      li.append(el('span', { class: 'kind', text: t.kinds[entry.kind] }), document.createTextNode(entry.text));
      recordList.append(li);
    });
  }

  function addRecord(kind, text) {
    state.record.push({ kind, text });
    renderRecord();
  }

  function render() {
    renderSteps();
    if (state.step === 1) return renderChoose();
    if (state.step === 2) return renderVote();
    if (state.step === 3) return renderAudit();
    return renderRuling();
  }

  function renderChoose() {
    const box = el('div');
    box.append(el('h2', { text: t.chooseTitle, style: 'margin-top:0' }), paragraph(t.chooseLede, 'note'));
    PROPOSALS.forEach((proposal, i) => {
      const label = el('label', { class: 'choice' });
      const input = el('input', { type: 'radio', name: 'proposal', value: proposal.id });
      input.checked = state.proposal ? state.proposal.id === proposal.id : i === 0;
      input.addEventListener('change', () => { state.proposal = proposal; });
      label.append(input, el('strong', { text: proposal.title }), el('small', { text: `${proposal.article} · ${proposal.text}` }));
      box.append(label);
    });
    if (!state.proposal) state.proposal = PROPOSALS[0];
    box.append(el('div', { class: 'btn-row' }, el('button', {
      class: 'btn primary', type: 'button', text: t.continue,
      onclick: () => {
        const chosen = panel.querySelector('input[name="proposal"]:checked');
        state.proposal = PROPOSALS.find(p => p.id === chosen.value);
        state.step = 2;
        addRecord('proposal', `${state.proposal.title} (${state.proposal.article})`);
        render();
      },
    })));
    box.append(paragraph(t.sample, 'note'));
    panel.replaceChildren(box);
  }

  function tallyOf() {
    const preset = PRESET[state.proposal.id];
    const weight = weightOf(state.credits);
    const rows = preset.map(member => ({ ...member, name: MEMBERS[member.key] }));
    rows.push({ key: 'you', kind: 'person', name: 'You', vote: state.position, weight, rule: 'person', reason: state.reason || '', you: true });
    const sum = vote => rows.filter(r => r.vote === vote).reduce((total, r) => total + r.weight, 0);
    const cast = sum('for') + sum('against');
    const forWeight = sum('for');
    return { rows, forWeight, againstWeight: sum('against'), abstainWeight: sum('abstain'), cast, share: cast ? forWeight / cast : 0, passes: cast > 0 && forWeight / cast >= 2 / 3, weight, dissent: rows.find(r => r.vote === 'against' && r.reason) ?? null };
  }

  function renderVote() {
    const box = el('div');
    box.append(el('h2', { text: t.voteTitle, style: 'margin-top:0' }), paragraph(t.voteLede, 'note'), paragraph(`${state.proposal.title} · ${state.proposal.article}`, 'tag'));

    const positions = el('div', { class: 'field' });
    positions.append(el('label', { text: t.position }));
    const row = el('div', { class: 'btn-row', style: 'margin:0' });
    for (const key of ['for', 'against', 'abstain']) {
      const button = el('button', { class: state.position === key ? 'btn primary small' : 'btn small', type: 'button', text: t.positions[key] });
      button.addEventListener('click', () => { state.position = key; render(); });
      row.append(button);
    }
    positions.append(row);
    box.append(positions);

    const credits = el('div', { class: 'field' });
    const label = el('label', { text: `${t.credits}: ${state.credits} · ${t.weight}: ${weightOf(state.credits)}` });
    const range = el('input', { type: 'range', min: '1', max: '9', step: '1', value: String(state.credits), 'aria-label': t.credits });
    range.addEventListener('input', () => { state.credits = Number(range.value); label.textContent = `${t.credits}: ${state.credits} · ${t.weight}: ${weightOf(state.credits)}`; });
    credits.append(label, range);
    box.append(credits);

    const reason = el('div', { class: 'field' });
    const area = el('textarea', { id: 'reason', placeholder: t.reasonPlaceholder });
    area.value = state.reason;
    area.addEventListener('input', () => { state.reason = area.value.trim(); });
    reason.append(el('label', { for: 'reason', text: t.reason }), area);
    box.append(reason);

    box.append(el('div', { class: 'btn-row' }, el('button', {
      class: 'btn primary', type: 'button', text: t.cast,
      onclick: () => {
        state.tally = tallyOf();
        state.step = 3;
        const chose = state.tally.rows.find(r => r.you);
        addRecord('vote', `${chose.name}: ${t.positions[chose.vote]}, ${t.weight} ${chose.weight}${chose.reason ? ` — ${chose.reason}` : ''}`);
        render();
      },
    })));
    panel.replaceChildren(box);
    requestAnimationFrame(() => { const first = panel.querySelector('button'); if (first) first.focus(); });
  }

  function renderAudit() {
    const box = el('div');
    const tally = state.tally;
    box.append(el('h2', { text: t.tallyTitle, style: 'margin-top:0' }));
    const table = el('table', { class: 'tally' });
    const head = el('tr');
    t.columns.forEach(name => head.append(el('th', { text: name })));
    table.append(el('thead', {}, head));
    const body = el('tbody');
    tally.rows.forEach(member => {
      const tr = el('tr');
      const name = el('td');
      name.append(document.createTextNode(member.name));
      if (member.rule === 'delegated') name.append(el('span', { class: 'note', text: t.delegatedMark }));
      tr.append(name, el('td', { text: t.positions[member.vote] }), el('td', { text: String(member.weight) }), el('td', { text: t[member.rule] }));
      if (member.reason) {
        const why = el('td');
        why.append(el('span', { class: 'note', text: `— ${member.reason}` }));
        tr.append(why);
      }
      body.append(tr);
    });
    table.append(body);
    box.append(table);
    box.append(paragraph(`${t.pct(tally.share)} ${t.threshold}.`, 'note'));

    box.append(el('h2', { text: t.auditTitle }), paragraph(t.auditLede, 'note'));
    const resultBox = el('div');
    const run = el('button', { class: 'btn primary', type: 'button', text: t.audit });
    run.addEventListener('click', () => {
      state.drift = driftOf(tally);
      resultBox.replaceChildren(resultOf(tally, state.drift));
      addRecord('drift', state.drift.text);
      run.disabled = true;
      next.hidden = false;
    });
    const next = el('button', { class: 'btn', type: 'button', text: t.rulingTitle, hidden: '' });
    next.addEventListener('click', () => { state.step = 4; render(); });
    box.append(resultBox, el('div', { class: 'btn-row' }, run, next));
    if (state.drift) { resultBox.replaceChildren(resultOf(tally, state.drift)); run.disabled = true; next.hidden = false; }
    panel.replaceChildren(box);
  }

  function driftOf(tally) {
    if (!tally.passes) return { status: 'bad', text: (() => {
      const worst = tally.rows.find(r => r.vote === 'against' && r.reason);
      return worst
        ? `${state.proposal.article}: ${tally.forWeight} of ${tally.cast} for. The amendment did not carry, and ${worst.name} dissent stays in the record.`
        : `${state.proposal.article}: ${tally.forWeight} of ${tally.cast} for. The amendment did not carry.`;
    })() };
    if (tally.dissent) return { status: 'warn', text: `${state.proposal.article}: amendment carries, ${tally.forWeight} of ${tally.cast}. Article 5: ${tally.dissent.name}'s dissent names a risk a person must review.` };
    return { status: 'ok', text: `${state.proposal.article}: no drift. Every vote names its weight and the rule behind it.` };
  }

  function resultOf(tally, drift) {
    const box = el('div', { class: `result ${drift.status === 'ok' ? 'ok' : drift.status === 'warn' ? 'warn' : 'bad'}` });
    box.append(document.createTextNode(drift.status === 'ok' ? t.ok : drift.status === 'warn' ? t.warn : t.bad));
    box.append(paragraph(drift.text));
    return box;
  }

  function renderRuling() {
    const box = el('div');
    box.append(el('h2', { text: t.rulingTitle, style: 'margin-top:0' }), paragraph(t.rulingLede, 'note'));
    const out = el('div');
    const ask = el('button', { class: 'btn primary', type: 'button', text: t.rule });
    ask.addEventListener('click', () => {
      state.ruling = state.tally.passes
        ? `${t.up}: ${state.proposal.article}. ${state.tally.share >= 2 / 3 ? `${t.pct(state.tally.share)} ${t.threshold}.` : ''} Precedent: an amendment passes on two-thirds of the weight cast, abstentions excluded, and a dissent stays beside it.`
        : `${t.down}: ${state.proposal.article}. Precedent: a change to an article needs two-thirds of the weight cast; a majority is not enough.`;
      out.replaceChildren(el('div', { class: `result ${state.tally.passes ? 'ok' : 'bad'}` }, document.createTextNode(state.ruling)));
      addRecord('ruling', state.ruling);
      ask.disabled = true;
      again.hidden = false;
    });
    const again = el('button', { class: 'btn', type: 'button', text: t.again, hidden: '' });
    again.addEventListener('click', () => {
      state.step = 1; state.tally = null; state.drift = null; state.ruling = null; state.reason = '';
      render();
    });
    box.append(out, el('div', { class: 'btn-row' }, ask, again));
    if (state.ruling) { out.replaceChildren(el('div', { class: `result ${state.tally.passes ? 'ok' : 'bad'}` }, document.createTextNode(state.ruling))); ask.disabled = true; again.hidden = false; }
    panel.replaceChildren(box);
  }

  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.dataset.i18n;
    if (t[key]) node.textContent = t[key];
  });
  const reset = document.getElementById('reset');
  if (reset) reset.addEventListener('click', () => {
    Object.assign(state, { step: 1, proposal: null, position: 'for', credits: 4, reason: '', tally: null, drift: null, ruling: null, record: [] });
    render();
  });
  renderRecord();
  render();
})();
