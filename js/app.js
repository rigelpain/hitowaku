import { db, find, uid, upsert, remove, save, persist, currentProblem, exportJSON, importJSON, resetToSamples, clearAll, keys, prefs } from './store.js';
import { SETTINGS, ATTR_FIELDS, HISTORY_FIELDS, RULE_TYPES, ORDER_MODES, resolveRules } from './settings.js';
import { FIGURE_COLORS } from './samples.js';
import { createScene } from './scene.js';
import { PROVIDERS } from './llm.js';
import { runTrial, exportPrompts, generateHistory, tally, buildContext } from './trial.js';
import { $, $$, esc, toast, download, copy, fmtDate } from './ui.js';

const TABS = [
  { id: 'histories', label: '生活史' },
  { id: 'people', label: '人' },
  { id: 'rules', label: '決まり' },
  { id: 'problems', label: '問題' },
  { id: 'trials', label: '試す' },
];

const ui = {
  tab: prefs.get('tab', 'problems'),
  sel: { histories: null, people: null, ruleSets: null },
  peekId: null,
  running: null, // { abort, transcript, problemId }
};

/* ---------- 場面 ---------- */

const scene = createScene($('#scene'), { onPick: (id) => togglePeek(id) });

scene.onTags((tags) => {
  const box = $('#tags');
  // 名札が重なるときは、重ならない高さまで持ち上げる
  const placed = [];
  tags = tags.slice().sort((a, b) => a.x - b.x).map((t) => {
    const p = find.person(t.id);
    const w = (p?.name.length || 4) * 13 + 16;
    let y = t.y;
    while (placed.some((q) => Math.abs(q.x - t.x) < (q.w + w) / 2 + 4 && Math.abs(q.y - y) < 22)) y -= 24;
    placed.push({ x: t.x, y, w });
    return { ...t, y };
  });
  box.innerHTML = tags.map((t) => {
    const p = find.person(t.id);
    if (!p) return '';
    return `<button class="tag" data-id="${esc(p.id)}" aria-pressed="${ui.peekId === p.id}" style="left:${t.x}px;top:${t.y}px">${esc(p.name)}</button>`;
  }).join('');
});
$('#tags').addEventListener('click', (e) => {
  const b = e.target.closest('.tag');
  if (b) togglePeek(b.dataset.id);
});

function togglePeek(id) {
  ui.peekId = ui.peekId === id ? null : id;
  scene.set({ highlightId: ui.peekId });
  renderPeek();
}

function renderPeek() {
  const el = $('#peek');
  const p = find.person(ui.peekId);
  if (!p) { el.classList.remove('open'); el.innerHTML = ''; return; }
  const h = find.history(p.lifeHistoryId);
  const attrs = ATTR_FIELDS.filter((f) => f.key !== 'name' && p.attrs?.[f.key]).map((f) => `${esc(f.label)} ${esc(p.attrs[f.key])}`).join('、');
  el.innerHTML = `
    <h3>${esc(p.name)}</h3>
    <p>${attrs || '属性は未入力'}</p>
    ${h ? `<dl>${HISTORY_FIELDS.filter((f) => h[f.key]).map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(h[f.key])}</dd>`).join('')}</dl>` : '<p>生活史はまだ結びついていません。</p>'}`;
  el.classList.add('open');
}

function refreshBoard() {
  const prob = currentProblem();
  const sw = $('#problem-switch');
  sw.innerHTML = db.problems.map((p) => `<option value="${esc(p.id)}" ${prob?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')
    || '<option value="">問題がありません</option>';
  if (!prob) {
    $('#board-q').innerHTML = '<small>問題がありません</small>「問題」で、人と決まりを組み合わせてください。';
    scene.set({ setting: 'archive', people: [] });
    return;
  }
  const s = SETTINGS[prob.setting] || SETTINGS.archive;
  const people = prob.personIds.map(find.person).filter(Boolean);
  const last = db.trials.filter((t) => t.problemId === prob.id).at(-1);
  $('#board-q').innerHTML = `<small>${esc(s.name)}　${people.length}人が待っている</small>${esc(prob.question || s.slot)}`;
  scene.set({ setting: prob.setting, people, chosenId: last?.decision.personId ?? null });
  if (ui.peekId && !people.some((p) => p.id === ui.peekId)) { ui.peekId = null; scene.set({ highlightId: null }); renderPeek(); }
}

$('#problem-switch').addEventListener('change', (e) => {
  db.currentProblemId = e.target.value;
  save();
  render();
});

/* ---------- タブ ---------- */

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((t) => `<button role="tab" id="tab-${t.id}" aria-selected="${ui.tab === t.id}" data-tab="${t.id}">${t.label}</button>`).join('');
  $('#panel').setAttribute('aria-labelledby', `tab-${ui.tab}`);
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  prefs.set('tab', ui.tab);
  render();
});
$('#tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const i = TABS.findIndex((t) => t.id === ui.tab);
  const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  ui.tab = n.id; prefs.set('tab', ui.tab); render();
  $(`#tab-${n.id}`).focus();
});

function render() {
  renderTabs();
  const panel = $('#panel');
  ({ histories: renderHistories, people: renderPeople, rules: renderRules, problems: renderProblems, trials: renderTrials })[ui.tab](panel);
  refreshBoard();
}

// 入力欄の変更を項目に反映する。data-k="attrs.age" のような書き方に対応
function bindFields(root, item, { onCommit } = {}) {
  root.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const path = k.split('.');
    let o = item;
    path.slice(0, -1).forEach((p) => { o[p] ??= {}; o = o[p]; });
    o[path.at(-1)] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    persist();
    onCommit?.(k);
  });
  root.addEventListener('change', (e) => { if (e.target.dataset.k) { save(); } });
}

/* ---------- 生活史 ---------- */

const SOURCE_LABEL = { real: '実在の人の話', synthetic: '原本なし（生成・創作）', draft: '下書き' };

function renderHistories(panel) {
  const sel = find.history(ui.sel.histories) || db.histories[0];
  ui.sel.histories = sel?.id ?? null;
  panel.innerHTML = `
    <h2>生活史</h2>
    <p class="lead">人が自分の人生について話すときの材料です。実在の人から聞いた話も、原本なしで作った話も登録できます。欄は、人生を本の章に見立てて語ってもらう聞き取りの型（McAdams の Life Story Interview）にならっています。</p>
    <div class="split">
      <div>
        <ul class="list">${db.histories.map((h) => `
          <li><button data-id="${esc(h.id)}" aria-current="${sel?.id === h.id}">
            <span class="dot" style="background:${h.source === 'real' ? 'var(--board)' : 'var(--paper-3)'}"></span>
            <span class="name">${esc(h.title || '題のない生活史')}</span>
            <span class="meta">${esc(SOURCE_LABEL[h.source] || '')}・${db.people.filter((p) => p.lifeHistoryId === h.id).length}人が使用</span>
          </button></li>`).join('')}
        </ul>
        <div class="list-actions">
          <button class="btn" id="h-new">白紙から書く</button>
          <button class="btn" id="h-gen">AI に作らせる</button>
        </div>
      </div>
      <div class="editor" id="h-editor">${sel ? historyEditor(sel) : '<p class="empty">左の「白紙から書く」で最初の生活史を登録してください。</p>'}</div>
    </div>`;

  $$('.list button', panel).forEach((b) => b.addEventListener('click', () => { ui.sel.histories = b.dataset.id; render(); }));
  $('#h-new', panel).addEventListener('click', () => {
    const h = { id: uid('h'), title: '', source: 'draft', consent: '', note: '' };
    HISTORY_FIELDS.forEach((f) => { h[f.key] = ''; });
    upsert('histories', h);
    ui.sel.histories = h.id; render();
    $('#h-editor [data-k="title"]')?.focus();
  });
  $('#h-gen', panel).addEventListener('click', () => openGenerator(panel));

  if (!sel) return;
  const ed = $('#h-editor', panel);
  bindFields(ed, sel, { onCommit: (k) => { if (k === 'title') $(`.list button[data-id="${sel.id}"] .name`, panel).textContent = sel.title || '題のない生活史'; } });
  ed.addEventListener('change', (e) => { if (e.target.name === 'source') { sel.source = e.target.value; save(); render(); } });
  $('#h-person', ed)?.addEventListener('click', () => {
    const p = { id: uid('p'), name: sel.title.replace(/さん?の生活史.*$/, '') || '名前のない人', attrs: {}, lifeHistoryId: sel.id, color: FIGURE_COLORS[db.people.length % FIGURE_COLORS.length] };
    upsert('people', p);
    ui.sel.people = p.id; ui.tab = 'people'; render();
    toast('この生活史で人を作りました');
  });
  $('#h-del', ed).addEventListener('click', () => {
    if (!confirm(`「${sel.title || '題のない生活史'}」を消します。この生活史を使っている人からは外れます。`)) return;
    remove('histories', sel.id); ui.sel.histories = null; render();
  });
}

function historyEditor(h) {
  return `
    <h3>生活史を書く</h3>
    <div class="fields">
      <label class="field"><span>題</span><input type="text" data-k="title" value="${esc(h.title)}" placeholder="例：港町で写真を撮る人の話"></label>
      <fieldset class="field" style="border:0;padding:0;margin:0">
        <span>どこから来た話か</span>
        <div class="choices">
          ${Object.entries(SOURCE_LABEL).map(([k, v]) => `
            <label class="choice"><input type="radio" name="source" value="${k}" ${h.source === k ? 'checked' : ''}>
              <span>${v}</span>
              <small>${k === 'real' ? '本人の同意を取ったうえで登録してください。名前や地名は変えておくと安心です。' : k === 'synthetic' ? '架空の人物。AI に作らせたものもここに入ります。' : 'まだ書きかけ。'}</small>
            </label>`).join('')}
        </div>
      </fieldset>
      ${h.source === 'real' ? `
        <div class="note warn">AI に選ばせる実験では、実在の人生が「選ばれない」ことになります。本人に、何に使うかと、選ばれないこともあると伝えてから使ってください。</div>
        <label class="field"><span>同意のメモ</span><small>いつ、誰が、どう説明して同意をもらったか</small><input type="text" data-k="consent" value="${esc(h.consent)}"></label>` : ''}
      ${HISTORY_FIELDS.map((f) => `
        <label class="field"><span>${esc(f.label)}</span><small>${esc(f.hint)}</small><textarea data-k="${f.key}">${esc(h[f.key])}</textarea></label>`).join('')}
      <label class="field"><span>メモ</span><textarea data-k="note" style="min-height:3em">${esc(h.note)}</textarea></label>
    </div>
    <div class="actions">
      <button class="btn primary" id="h-person">この生活史で人を作る</button>
      <button class="btn danger" id="h-del">この生活史を消す</button>
    </div>`;
}

function openGenerator(panel) {
  const ed = $('#h-editor', panel);
  const provider = prefs.get('provider', 'anthropic');
  ed.innerHTML = `
    <h3>AI に生活史を作らせる</h3>
    <p>原本のない、架空の人物の生活史を一人分作ります。手がかりは空でもかまいません。</p>
    <div class="fields">
      <label class="field"><span>手がかり</span><small>例：60代、商店街の豆腐屋、娘が東京にいる</small><textarea id="g-hints" style="min-height:3em"></textarea></label>
      ${keys.get(provider) ? '' : '<div class="note warn">API キーが入っていません。「試す」の中にある「AI の設定」でキーを入れてから使ってください。</div>'}
    </div>
    <div class="actions">
      <button class="btn primary" id="g-run" ${keys.get(provider) ? '' : 'disabled'}>作る</button>
      <button class="btn quiet" id="g-cancel">やめる</button>
      <span class="progress" id="g-status" aria-live="polite"></span>
    </div>`;
  $('#g-cancel', ed).addEventListener('click', () => render());
  $('#g-run', ed).addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#g-status', ed).textContent = '作っています…';
    try {
      const j = await generateHistory({ provider, model: prefs.get('model:' + provider, ''), hints: $('#g-hints', ed).value });
      const h = { id: uid('h'), title: `${j.name || '名前のない人'}さんの生活史（生成）`, source: 'synthetic', consent: '', note: `AI（${provider}）が生成。手がかり：${$('#g-hints', ed).value || 'なし'}` };
      HISTORY_FIELDS.forEach((f) => { h[f.key] = j[f.key] || ''; });
      upsert('histories', h);
      const p = { id: uid('p'), name: j.name || '名前のない人', attrs: { age: j.age || '', gender: j.gender || '', job: j.job || '', place: j.place || '' }, lifeHistoryId: h.id, color: FIGURE_COLORS[db.people.length % FIGURE_COLORS.length] };
      upsert('people', p);
      ui.sel.histories = h.id; render();
      toast(`${p.name}さんを作り、人の一覧にも加えました`);
    } catch (err) {
      $('#g-status', ed).textContent = err.message;
      e.target.disabled = false;
    }
  });
}

/* ---------- 人 ---------- */

function renderPeople(panel) {
  const sel = find.person(ui.sel.people) || db.people[0];
  ui.sel.people = sel?.id ?? null;
  panel.innerHTML = `
    <h2>人</h2>
    <p class="lead">生活史に、名前・年齢・性別などをつけたものが「人」です。同じ生活史に別の名前や年齢をつけた人を作ると、属性だけが違う比較ができます。</p>
    <div class="split">
      <div>
        <ul class="list">${db.people.map((p) => `
          <li><button data-id="${esc(p.id)}" aria-current="${sel?.id === p.id}">
            <span class="dot" style="background:${esc(p.color)}"></span>
            <span class="name">${esc(p.name)}</span>
            <span class="meta">${esc([p.attrs?.age && `${p.attrs.age}歳`, p.attrs?.job].filter(Boolean).join('、') || '属性は未入力')}</span>
          </button></li>`).join('')}
        </ul>
        <div class="list-actions"><button class="btn" id="p-new">人を加える</button></div>
      </div>
      <div class="editor" id="p-editor">${sel ? personEditor(sel) : '<p class="empty">「人を加える」で最初の一人を登録してください。</p>'}</div>
    </div>`;
  $$('.list button', panel).forEach((b) => b.addEventListener('click', () => { ui.sel.people = b.dataset.id; render(); }));
  $('#p-new', panel).addEventListener('click', () => {
    const p = { id: uid('p'), name: '', attrs: {}, lifeHistoryId: db.histories[0]?.id ?? null, color: FIGURE_COLORS[db.people.length % FIGURE_COLORS.length] };
    upsert('people', p); ui.sel.people = p.id; render();
    $('#p-editor [data-k="name"]')?.focus();
  });
  if (!sel) return;
  const ed = $('#p-editor', panel);
  bindFields(ed, sel, { onCommit: (k) => { if (k === 'name') { $(`.list button[data-id="${sel.id}"] .name`, panel).textContent = sel.name; refreshBoard(); } } });
  $('#p-hist', ed).addEventListener('change', (e) => { sel.lifeHistoryId = e.target.value || null; save(); });
  $$('.swatch', ed).forEach((s) => s.addEventListener('click', () => { sel.color = s.dataset.c; save(); render(); }));
  $('#p-twin', ed).addEventListener('click', () => {
    const t = structuredClone(sel);
    t.id = uid('p'); t.name = `${sel.name}（入れ替え）`;
    t.color = FIGURE_COLORS[(FIGURE_COLORS.indexOf(sel.color) + 3) % FIGURE_COLORS.length];
    upsert('people', t); ui.sel.people = t.id; render();
    toast('同じ生活史の人を作りました。名前や年齢を変えてください');
  });
  $('#p-del', ed).addEventListener('click', () => {
    if (!confirm(`${sel.name || 'この人'}を消します。入っている問題からも外れます。`)) return;
    remove('people', sel.id); ui.sel.people = null; render();
  });
}

function personEditor(p) {
  return `
    <h3>人を整える</h3>
    <div class="fields">
      <label class="field"><span>名前</span><input type="text" data-k="name" value="${esc(p.name)}"></label>
      <div class="row2">
        ${ATTR_FIELDS.filter((f) => f.key !== 'name').map((f) => `<label class="field"><span>${esc(f.label)}</span><input type="text" data-k="attrs.${f.key}" value="${esc(p.attrs?.[f.key])}"></label>`).join('')}
      </div>
      <label class="field"><span>生活史</span>
        <select id="p-hist"><option value="">（結びつけない）</option>
          ${db.histories.map((h) => `<option value="${esc(h.id)}" ${p.lifeHistoryId === h.id ? 'selected' : ''}>${esc(h.title || '題のない生活史')}</option>`).join('')}
        </select>
      </label>
      <div class="field"><span>場面での色</span>
        <div class="swatches">${FIGURE_COLORS.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${p.color === c}" aria-label="色 ${c}"></button>`).join('')}</div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="p-twin">属性だけ変えた人を作る</button>
      <button class="btn danger" id="p-del">この人を消す</button>
    </div>`;
}

/* ---------- 決まり ---------- */

function renderRules(panel) {
  const sel = find.ruleSet(ui.sel.ruleSets) || db.ruleSets[0];
  ui.sel.ruleSets = sel?.id ?? null;
  panel.innerHTML = `
    <h2>決まり</h2>
    <p class="lead">選ぶ側が何を知っていて、何を聞けて、どう決めるか。決まりを束にしておくと、同じ人たちで決まりだけを変えて比べられます。</p>
    <div class="split">
      <div>
        <ul class="list">${db.ruleSets.map((r) => `
          <li><button data-id="${esc(r.id)}" aria-current="${sel?.id === r.id}">
            <span class="dot" style="background:var(--board)"></span>
            <span class="name">${esc(r.name || '名前のない決まり')}</span>
            <span class="meta">${r.rules.length}個の決まり</span>
          </button></li>`).join('')}
        </ul>
        <div class="list-actions"><button class="btn" id="r-new">決まりの束を作る</button></div>
      </div>
      <div class="editor" id="r-editor">${sel ? rulesEditor(sel) : '<p class="empty">「決まりの束を作る」から始めてください。</p>'}</div>
    </div>`;
  $$('.list button', panel).forEach((b) => b.addEventListener('click', () => { ui.sel.ruleSets = b.dataset.id; render(); }));
  $('#r-new', panel).addEventListener('click', () => {
    const r = { id: uid('r'), name: '新しい決まり', rules: [{ id: uid('ru'), type: 'capacity', n: 1 }, { id: uid('ru'), type: 'turns', n: 2 }] };
    upsert('ruleSets', r); ui.sel.ruleSets = r.id; render();
  });
  if (!sel) return;
  const ed = $('#r-editor', panel);
  ed.addEventListener('input', (e) => {
    if (e.target.dataset.k === 'name') { sel.name = e.target.value; persist(); $(`.list button[data-id="${sel.id}"] .name`, panel).textContent = sel.name; return; }
    const row = e.target.closest('[data-rule]');
    if (!row) return;
    const rule = sel.rules.find((r) => r.id === row.dataset.rule);
    const f = e.target.dataset.f;
    if (f === 'fields') rule.fields = $$('input[data-f="fields"]:checked', row).map((i) => i.value);
    else rule[f] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    persist();
  });
  ed.addEventListener('change', () => save());
  ed.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { sel.rules = sel.rules.filter((r) => r.id !== del.dataset.del); save(); render(); }
  });
  $('#r-add', ed).addEventListener('click', () => {
    const type = $('#r-type', ed).value;
    sel.rules.push({ id: uid('ru'), type, ...structuredClone(RULE_TYPES[type].defaults) });
    save(); render();
  });
  $('#r-del', ed).addEventListener('click', () => {
    if (db.problems.some((p) => p.ruleSetId === sel.id) && !confirm('この決まりを使っている問題があります。消しますか。')) return;
    remove('ruleSets', sel.id); ui.sel.ruleSets = null; render();
  });
}

function ruleBody(rule) {
  const num = (f, min, max, unit) => `<span style="display:flex;gap:8px;align-items:center"><input type="number" data-f="${f}" value="${esc(rule[f])}" min="${min}" max="${max}" style="max-width:7em">${unit}</span>`;
  const text = (ph) => `<input type="text" data-f="text" value="${esc(rule.text)}" placeholder="${esc(ph)}">`;
  switch (rule.type) {
    case 'capacity': return num('n', 1, 9, '人');
    case 'turns': return num('n', 1, 6, '回');
    case 'maxChars': return num('n', 40, 600, '字まで');
    case 'reveal': return `<div class="checks">${ATTR_FIELDS.map((f) => `<label class="check"><input type="checkbox" data-f="fields" value="${f.key}" ${rule.fields?.includes(f.key) ? 'checked' : ''}>${f.label}</label>`).join('')}</div>`;
    case 'order': return `<select data-f="mode">${Object.entries(ORDER_MODES).map(([k, v]) => `<option value="${k}" ${rule.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    case 'default': return `<select data-f="personId"><option value="">決めない（選べなかった、と記録する）</option>${db.people.map((p) => `<option value="${esc(p.id)}" ${rule.personId === p.id ? 'selected' : ''}>${esc(p.name)}が選ばれる</option>`).join('')}</select>`;
    case 'mayAsk': return text('例：これからやりたいこと');
    case 'mayNotAsk': return text('例：収入、家族構成');
    default: return text('例：迷ったら、より若い人を選ぶ');
  }
}

function rulesEditor(r) {
  return `
    <h3>決まりの束</h3>
    <div class="fields">
      <label class="field"><span>束の名前</span><input type="text" data-k="name" value="${esc(r.name)}"></label>
      <div class="rules">
        ${r.rules.map((rule) => `
          <div class="rule" data-rule="${esc(rule.id)}">
            <b>${esc(RULE_TYPES[rule.type]?.label || rule.type)}</b>
            <div class="rule-body">${ruleBody(rule)}</div>
            <button class="btn danger" data-del="${esc(rule.id)}" aria-label="${esc(RULE_TYPES[rule.type]?.label)}を外す">外す</button>
          </div>`).join('') || '<p class="empty">決まりがありません。下から加えてください。</p>'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="r-type" style="max-width:16em">${Object.entries(RULE_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
        <button class="btn" id="r-add">決まりを加える</button>
      </div>
      <div class="note">「誰も選ばれなかったら」はトロッコ問題の、レバーを引かなければこちらに進む、にあたります。何もしないことと選ぶことで、判断が変わるかを見られます。</div>
    </div>
    <div class="actions"><button class="btn danger" id="r-del">この束を消す</button></div>`;
}

/* ---------- 問題 ---------- */

function renderProblems(panel) {
  const prob = currentProblem();
  panel.innerHTML = `
    <h2>問題</h2>
    <p class="lead">設え、待っている人、決まりを組み合わせて一つの問いにします。上の黒板に映っているのが、いま選んでいる問題です。</p>
    <div class="split">
      <div>
        <ul class="list">${db.problems.map((p) => `
          <li><button data-id="${esc(p.id)}" aria-current="${prob?.id === p.id}">
            <span class="dot" style="background:var(--chalk)"></span>
            <span class="name">${esc(p.name || '名前のない問題')}</span>
            <span class="meta">${esc(SETTINGS[p.setting]?.name)}、${p.personIds.length}人</span>
          </button></li>`).join('')}
        </ul>
        <div class="list-actions"><button class="btn" id="q-new">問題を作る</button></div>
      </div>
      <div class="editor" id="q-editor">${prob ? problemEditor(prob) : '<p class="empty">「問題を作る」から始めてください。</p>'}</div>
    </div>`;
  $$('.list button', panel).forEach((b) => b.addEventListener('click', () => { db.currentProblemId = b.dataset.id; save(); render(); }));
  $('#q-new', panel).addEventListener('click', () => {
    const p = { id: uid('q'), name: '新しい問題', setting: 'archive', personIds: db.people.slice(0, 3).map((x) => x.id), ruleSetId: db.ruleSets[0]?.id ?? null, chooserPrompt: '', question: '' };
    upsert('problems', p); db.currentProblemId = p.id; save(); render();
  });
  if (!prob) return;
  const ed = $('#q-editor', panel);
  bindFields(ed, prob, { onCommit: (k) => { if (k === 'name') $(`.list button[data-id="${prob.id}"] .name`, panel).textContent = prob.name; if (k === 'question') refreshBoard(); } });
  ed.addEventListener('change', (e) => {
    if (e.target.name === 'setting') { prob.setting = e.target.value; save(); render(); }
    if (e.target.name === 'who') { prob.personIds = $$('input[name="who"]:checked', ed).map((i) => i.value); save(); refreshBoard(); }
    if (e.target.id === 'q-rules') { prob.ruleSetId = e.target.value; save(); render(); }
  });
  $('#q-go', ed).addEventListener('click', () => { ui.tab = 'trials'; prefs.set('tab', 'trials'); render(); window.scrollTo({ top: $('#tabs').offsetTop - 16 }); });
  $('#q-copy', ed).addEventListener('click', async () => {
    const ok = await copy(exportPrompts(prob));
    toast(ok ? '指示文をコピーしました' : 'コピーできませんでした');
  });
  $('#q-del', ed).addEventListener('click', () => {
    if (!confirm(`「${prob.name}」と、その試行の記録を消します。`)) return;
    db.trials = db.trials.filter((t) => t.problemId !== prob.id);
    remove('problems', prob.id); render();
  });
}

function problemEditor(p) {
  const rs = find.ruleSet(p.ruleSetId);
  const r = resolveRules(rs);
  return `
    <h3>問題を組む</h3>
    <div class="fields">
      <label class="field"><span>問題の名前</span><input type="text" data-k="name" value="${esc(p.name)}"></label>
      <fieldset class="field" style="border:0;padding:0;margin:0"><span>設え</span>
        <div class="choices">${Object.values(SETTINGS).map((s) => `
          <label class="choice"><input type="radio" name="setting" value="${s.id}" ${p.setting === s.id ? 'checked' : ''}><span>${esc(s.name)}</span><small>${esc(s.situation)}</small></label>`).join('')}
        </div>
      </fieldset>
      <fieldset class="field" style="border:0;padding:0;margin:0"><span>待っている人</span><small>8人まで場面に描かれます。</small>
        <div class="checks">${db.people.map((x) => `<label class="check"><input type="checkbox" name="who" value="${esc(x.id)}" ${p.personIds.includes(x.id) ? 'checked' : ''}><span class="dot" style="width:10px;height:10px;margin:0;background:${esc(x.color)}"></span>${esc(x.name)}</label>`).join('') || '「人」で人を加えてください。'}</div>
      </fieldset>
      <label class="field"><span>決まり</span>
        <select id="q-rules">${db.ruleSets.map((x) => `<option value="${esc(x.id)}" ${p.ruleSetId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <small>枠 ${r.capacity}、1人に ${r.turns} 回まで質問、答えは ${r.maxChars} 字まで、話を聞く順番は「${esc(ORDER_MODES[r.order])}」</small>
      </label>
      <label class="field"><span>選ぶ側の立場</span><small>AI に与える役。言い方を変えると結果が変わることがあります。</small><textarea data-k="chooserPrompt">${esc(p.chooserPrompt)}</textarea></label>
      <label class="field"><span>最後に投げかける問い</span><input type="text" data-k="question" value="${esc(p.question)}" placeholder="誰を選びますか。"></label>
    </div>
    <div class="actions">
      <button class="btn primary" id="q-go">この問題を試す</button>
      <button class="btn" id="q-copy">AI に貼る指示文をコピー</button>
      <button class="btn danger" id="q-del">この問題を消す</button>
    </div>`;
}

/* ---------- 試す ---------- */

function renderTrials(panel) {
  const prob = currentProblem();
  const provider = prefs.get('provider', 'anthropic');
  const model = prefs.get('model:' + provider, '') || PROVIDERS[provider].defaultModel;
  const hasKey = !!keys.get(provider);
  panel.innerHTML = `
    <h2>試す</h2>
    <p class="lead">AI が選ぶ側と、待っている一人ひとりを演じます。選ぶ側は一人ずつ面談して質問し、最後に誰に枠を渡すかを決めます。同じ問題を何度も回したり、順番を逆にしたりして、結果がどう動くかを見てください。</p>
    ${!prob ? '<p class="empty">先に「問題」を作ってください。</p>' : `
    <details class="note" ${hasKey ? '' : 'open'} id="ai-settings">
      <summary style="cursor:pointer;font-weight:700">AI の設定${hasKey ? `（${esc(PROVIDERS[provider].label)}、${esc(model)}）` : '（キーが入っていません）'}</summary>
      <div class="fields" style="margin-top:12px">
        <div class="row2">
          <label class="field"><span>使う AI</span><select id="ai-provider">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${provider === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
          <label class="field"><span>モデル名</span><input type="text" id="ai-model" value="${esc(model)}"></label>
          <label class="field"><span>ゆらぎ（temperature）</span><input type="number" id="ai-temp" min="0" max="1" step="0.1" value="${esc(prefs.get('temperature', 0.7))}"></label>
        </div>
        <label class="field"><span>API キー</span><small>キーはこのブラウザから AI の会社へ直接送られ、このサイトには届きません。共有の端末では「覚えさせる」を外し、使い終わったら消してください。上限額を設定したキーをおすすめします。</small>
          <input type="password" id="ai-key" autocomplete="off" placeholder="${esc(PROVIDERS[provider].keyHint)}" value="${hasKey ? '••••••••' : ''}">
        </label>
        <label class="check" style="width:fit-content"><input type="checkbox" id="ai-remember" ${keys.remembered(provider) ? 'checked' : ''}>この端末に覚えさせる（外すとタブを閉じたときに消える）</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="ai-save">キーを保存</button><button class="btn danger" id="ai-forget">キーを消す</button></div>
      </div>
    </details>

    <div class="actions">
      <button class="btn primary" id="run-1" ${hasKey ? '' : 'disabled'}>1回試す</button>
      <button class="btn" id="run-swap" ${hasKey ? '' : 'disabled'}>順番を逆にしてもう1回</button>
      <label class="check"><input type="number" id="run-n" min="2" max="10" value="${esc(prefs.get('runN', 3))}" style="width:4.5em;padding:4px 8px">回まとめて</label>
      <button class="btn" id="run-many" ${hasKey ? '' : 'disabled'}>続けて試す</button>
      <button class="btn quiet" id="run-stop" hidden>止める</button>
      <span class="progress" id="run-status" aria-live="polite"></span>
    </div>
    ${hasKey ? '' : '<p class="progress">キーがなくても、「問題」の「AI に貼る指示文をコピー」で、ふだん使っているチャット AI に手で試せます。</p>'}

    <div class="live" id="live"></div>
    <div id="tally"></div>`}`;
  if (!prob) return;

  $('#ai-provider', panel).addEventListener('change', (e) => { prefs.set('provider', e.target.value); render(); });
  $('#ai-model', panel).addEventListener('change', (e) => prefs.set('model:' + provider, e.target.value.trim()));
  $('#ai-temp', panel).addEventListener('change', (e) => prefs.set('temperature', Math.max(0, Math.min(1, Number(e.target.value) || 0))));
  $('#run-n', panel).addEventListener('change', (e) => prefs.set('runN', Math.max(2, Math.min(10, Number(e.target.value) || 3))));
  $('#ai-save', panel).addEventListener('click', () => {
    const v = $('#ai-key', panel).value.trim();
    if (!v || v === '••••••••') { toast('キーを入力してください'); return; }
    keys.set(provider, v, $('#ai-remember', panel).checked);
    toast('キーを保存しました'); render();
  });
  $('#ai-forget', panel).addEventListener('click', () => { keys.forget(provider); toast('キーを消しました'); render(); });

  const go = async (times, reverseFirst) => {
    const ctl = new AbortController();
    ui.running = { abort: () => ctl.abort() };
    $$('#run-1, #run-swap, #run-many', panel).forEach((b) => { b.disabled = true; });
    $('#run-stop', panel).hidden = false;
    const status = $('#run-status', panel);
    try {
      for (let i = 0; i < times; i++) {
        status.textContent = times > 1 ? `${i + 1}回目／${times}回` : '面談しています…';
        const reverse = times > 1 ? i % 2 === 1 : reverseFirst;
        const trial = await runTrial(prob, {
          provider,
          model: prefs.get('model:' + provider, '') || PROVIDERS[provider].defaultModel,
          temperature: prefs.get('temperature', 0.7),
          reverse,
          signal: ctl.signal,
          onStep: (_, tr) => renderLive(prob, tr),
        });
        renderLive(prob, trial.transcript, trial);
        scene.play(trial.decision.personId);
        renderTally(prob);
      }
      status.textContent = '終わりました';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      ui.running = null;
      $$('#run-1, #run-swap, #run-many', panel).forEach((b) => { b.disabled = false; });
      $('#run-stop', panel).hidden = true;
    }
  };
  $('#run-1', panel).addEventListener('click', () => go(1, false));
  $('#run-swap', panel).addEventListener('click', () => go(1, true));
  $('#run-many', panel).addEventListener('click', () => go(prefs.get('runN', 3), false));
  $('#run-stop', panel).addEventListener('click', () => ui.running?.abort());

  renderTally(prob);
}

function sayHTML(entry, aliases) {
  if (entry.role === 'decision') return `<div class="say decision"><div class="who">決定</div><div class="text">${esc(entry.text)}</div></div>`;
  const p = find.person(entry.personId);
  if (entry.role === 'chooser') return `<div class="say chooser"><div class="who">選ぶ側</div><div class="text">${esc(entry.text)}</div></div>`;
  return `<div class="say" style="--who:${esc(p?.color || '#999')}"><div class="who">${esc(aliases?.[entry.personId] || p?.name || '')}</div><div class="text">${esc(entry.text)}</div></div>`;
}

function dialogHTML(transcript, aliases) {
  let lastPid = null;
  return transcript.map((e) => {
    let head = '';
    if (e.personId && e.personId !== lastPid) {
      head = `<div class="divider-name">${esc(aliases?.[e.personId] || find.person(e.personId)?.name || '')}との面談</div>`;
      lastPid = e.personId;
    }
    if (e.role === 'decision') head = '<div class="divider-name">決めたこと</div>';
    return head + sayHTML(e, aliases);
  }).join('');
}

function renderLive(prob, transcript, trial) {
  const live = $('#live');
  if (!live) return;
  const { alias } = buildContext(prob);
  const aliases = Object.fromEntries(alias);
  const head = trial
    ? `<h3 style="font-size:22px">${trial.decision.refused ? (trial.decision.viaDefault ? `決められず、初めから決まっていた${esc(find.person(trial.decision.personId)?.name)}さんに` : '決められなかった') : `${(trial.decision.personIds || [trial.decision.personId]).map((id) => `${esc(find.person(id)?.name)}さん`).join('と')}が選ばれた`}</h3>`
    : '<h3 style="font-size:22px">面談中</h3>';
  live.innerHTML = head + `<div class="dialog">${dialogHTML(transcript, aliases)}</div>`;
}

function renderTally(prob) {
  const box = $('#tally');
  if (!box) return;
  const t = tally(prob.id);
  if (!t.total) { box.innerHTML = ''; return; }
  const people = prob.personIds.map(find.person).filter(Boolean);
  const max = Math.max(1, ...Object.values(t.counts), t.refused);
  box.innerHTML = `
    <h3 style="font-size:22px;margin-top:40px">これまでの結果（${t.total}回）</h3>
    <div class="bars">
      ${people.map((p) => `<div class="bar"><span>${esc(p.name)}</span><span class="track"><span class="fill" style="display:block;width:${((t.counts[p.id] || 0) / max) * 100}%;background:${esc(p.color)}"></span></span><span class="n">${t.counts[p.id] || 0}回</span></div>`).join('')}
      <div class="bar"><span>決められず</span><span class="track"><span class="fill" style="display:block;width:${(t.refused / max) * 100}%;background:var(--ink-2)"></span></span><span class="n">${t.refused}回</span></div>
    </div>
    <div class="stats">
      <span>最初に面談した人が選ばれた <b>${t.firstWins}</b>回</span>
      <span>最後に面談した人が選ばれた <b>${t.lastWins}</b>回</span>
    </div>
    <p class="progress" style="margin-top:8px">順番で結果が偏るなら、AI は話の中身より並び順に引っぱられているのかもしれません。</p>
    <ul class="trials">${t.trials.slice().reverse().map((tr) => `
      <li><details>
        <summary><b>${tr.decision.refused && !tr.decision.viaDefault ? '決められず' : (tr.decision.personIds || [tr.decision.personId]).map((id) => esc(tr.names?.[id] || find.person(id)?.name || '')).join('、')}</b>
          <span class="when">${fmtDate(tr.at)}、${esc(tr.model)}、ゆらぎ ${esc(tr.temperature)}、順番 ${tr.order.map((id) => esc(tr.aliases?.[id] || '')).join('、')}</span></summary>
        <div class="body"><div class="dialog">${dialogHTML(tr.transcript, tr.aliases)}</div>
          <div class="actions"><button class="btn danger" data-trial-del="${esc(tr.id)}">この記録を消す</button></div></div>
      </details></li>`).join('')}
    </ul>
    <div class="actions">
      <button class="btn" id="t-csv">結果を表で書き出す</button>
      <button class="btn danger" id="t-clear">この問題の記録をすべて消す</button>
    </div>`;
  box.onclick = (e) => {
    const d = e.target.closest('[data-trial-del]');
    if (d) { db.trials = db.trials.filter((x) => x.id !== d.dataset.trialDel); save(); renderTally(prob); }
    if (e.target.id === 't-clear' && confirm('この問題の試行の記録をすべて消します。')) { db.trials = db.trials.filter((x) => x.problemId !== prob.id); save(); renderTally(prob); }
    if (e.target.id === 't-csv') {
      const rows = [['日時', 'モデル', 'ゆらぎ', '面談の順番', '選ばれた人', '決められなかった', '理由']];
      t.trials.forEach((tr) => rows.push([tr.at, tr.model, tr.temperature, tr.order.map((id) => tr.names?.[id]).join(' > '), (tr.decision.personIds || [tr.decision.personId]).map((id) => tr.names?.[id]).join('、'), tr.decision.refused ? 'はい' : '', tr.decision.reason]));
      const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      download(`${prob.name}-結果.csv`, csv, 'text/csv');
    }
  };
}

/* ---------- 書き出し・読み込み ---------- */

$('#export-all').addEventListener('click', () => download(`hitowaku-${new Date().toISOString().slice(0, 10)}.json`, exportJSON()));
$('#import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const replace = confirm('いまのデータを置き換えますか。\n「キャンセル」を選ぶと、いまのデータに足します。');
    importJSON(await f.text(), replace ? 'replace' : 'merge');
    render(); toast('読み込みました');
  } catch {
    toast('読み込めませんでした。ひとわくで書き出した JSON か確かめてください');
  }
  e.target.value = '';
});
$('#reset-samples').addEventListener('click', () => { if (confirm('いまのデータを消して、見本の状態に戻します。')) { resetToSamples(); render(); } });
$('#clear-all').addEventListener('click', () => { if (confirm('生活史・人・決まり・問題・記録をすべて消します。')) { clearAll(); render(); } });

render();
