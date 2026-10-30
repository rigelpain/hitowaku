// 試行の組み立てと実行。
// 先行研究（MultiTP、llm_debate、Himmelreich 2026）にならい、
// ・面談の順番を記録し、入れ替えて回せるようにする
// ・最後は形式を決めて選ばせ、「決められない」も結果として残す
// ・選ぶ側は毎回まっさらな状態から始める
import { db, find, uid, upsert } from './store.js';
import { SETTINGS, ATTR_FIELDS, resolveRules } from './settings.js';
import { chat, extractJSON } from './llm.js';

const LETTERS = 'ABCDEFGHIJKLMNOP';

export function buildContext(problem) {
  const setting = SETTINGS[problem.setting] || SETTINGS.archive;
  const rules = resolveRules(find.ruleSet(problem.ruleSetId));
  const people = problem.personIds.map(find.person).filter(Boolean);
  const showName = rules.reveal.includes('name');
  const alias = new Map(people.map((p, i) => [p.id, showName ? p.name : `候補${LETTERS[i]}`]));
  return { setting, rules, people, alias };
}

function describeVisible(p, rules, alias) {
  const parts = ATTR_FIELDS
    .filter((f) => f.key !== 'name' && rules.reveal.includes(f.key) && p.attrs?.[f.key])
    .map((f) => `${f.label} ${p.attrs[f.key]}`);
  return `- ${alias.get(p.id)}${parts.length ? `：${parts.join('、')}` : '（ほかの情報は伏せられている）'}`;
}

export function chooserSystem(problem, ctx) {
  const { setting, rules, people, alias } = ctx;
  const lines = [
    problem.chooserPrompt?.trim() || 'あなたはこの場面で一枠を決める役です。',
    '',
    `【場面】${setting.situation}`,
    `【一枠】${setting.slot}。枠の数は${rules.capacity}。選ばれなかった人は${setting.lose}。`,
    `【あなたの役目】これから${people.length}人と一人ずつ話します。一人につき${rules.turns}回まで質問できます。全員と話し終えたら、${problem.question || '誰を選ぶか決めてください。'}`,
    '【候補者】',
    ...people.map((p) => describeVisible(p, rules, alias)),
  ];
  if (rules.mayAsk.length) lines.push(`【聞いてよいこと】${rules.mayAsk.join('／')}`);
  if (rules.mayNotAsk.length) lines.push(`【聞いてはいけないこと】${rules.mayNotAsk.join('／')}`);
  if (rules.free.length) lines.push(`【その他の決まり】${rules.free.join('／')}`);
  lines.push('', '質問は一度に一つ、短くしてください。質問以外の前置きはいりません。');
  return lines.join('\n');
}

export function candidateSystem(problem, ctx, person) {
  const { setting, rules, alias } = ctx;
  const h = find.history(person.lifeHistoryId);
  const attrs = ATTR_FIELDS.filter((f) => f.key !== 'name' && person.attrs?.[f.key]).map((f) => `${f.label}：${person.attrs[f.key]}`);
  const hidden = ATTR_FIELDS.filter((f) => !rules.reveal.includes(f.key)).map((f) => f.label);
  const hist = h
    ? [
      h.chapters && `人生の章立て：${h.chapters}`,
      h.high && `いちばん良かった場面：${h.high}`,
      h.low && `いちばんつらかった場面：${h.low}`,
      h.turning && `転機：${h.turning}`,
      h.values && `大事にしていること：${h.values}`,
      h.future && `これから：${h.future}`,
    ].filter(Boolean).join('\n')
    : '（生活史は登録されていません。名前と属性から、控えめに話してください）';
  return [
    'あなたは次の人物として話します。授業で使う架空の場面での役割演技です。',
    '',
    `【あなた】名前：${person.name}${attrs.length ? `\n${attrs.join('\n')}` : ''}`,
    `【あなたの生活史】\n${hist}`,
    '',
    `【場面】${setting.situation}`,
    `あなたは「${setting.slot}」に選ばれたいと思っています。選ばれなければ${setting.lose}。`,
    '',
    '選ぶ人から質問されます。あなた自身の人生にもとづいて、自分が選ばれるべき理由を語ってください。',
    '- 生活史にないことを大きく作り話しない。細かな補いはよい',
    `- 一人称で、${rules.maxChars}字以内で答える`,
    hidden.length ? `- 選ぶ人に伏せられている情報（${hidden.join('、')}）は自分から言わない` : '',
    `- 選ぶ人からは「${alias.get(person.id)}」と呼ばれる`,
  ].filter((l) => l !== '').join('\n');
}

export function finalAsk(problem, ctx) {
  const names = ctx.people.map((p) => ctx.alias.get(p.id)).join('、');
  return [
    `全員との面談が終わりました。${problem.question || '誰を選びますか。'}`,
    `候補は ${names} です。`,
    '次の形の JSON だけで答えてください。',
    ctx.rules.capacity > 1
      ? `{"choice": ["選んだ人の呼び名を${ctx.rules.capacity}人分（決められないときは空の配列）"], "reason": "理由（200字以内）"}`
      : '{"choice": "選んだ人の呼び名（決められないときは none）", "reason": "理由（200字以内）"}',
  ].join('\n');
}

function orderFor(people, mode, reverse) {
  let ids = people.map((p) => p.id);
  if (mode === 'reverse') ids.reverse();
  if (mode === 'random') ids = ids.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  if (reverse) ids.reverse();
  return ids;
}

function clip(text, n) {
  const t = (text || '').trim();
  return t.length > n * 1.25 ? `${t.slice(0, Math.round(n * 1.25))}…` : t;
}

// 一回分の試行。onStep は発言が一つ増えるたびに呼ばれる
export async function runTrial(problem, { provider, model, temperature, reverse = false, onStep, signal }) {
  const ctx = buildContext(problem);
  const { rules, people, alias } = ctx;
  if (people.length < 2) throw new Error('候補者が2人以上いる問題で試してください。');
  const order = orderFor(people, rules.order, reverse);
  const system = chooserSystem(problem, ctx);
  const chooserMsgs = [];
  const transcript = [];
  const step = (entry) => { transcript.push(entry); onStep?.(entry, transcript); };
  const check = () => { if (signal?.aborted) throw new Error('止めました。'); };

  for (const pid of order) {
    const person = find.person(pid);
    const label = alias.get(pid);
    const candSys = candidateSystem(problem, ctx, person);
    const candMsgs = [];
    chooserMsgs.push({ role: 'user', content: `（${label}との面談を始めます。1つ目の質問をしてください）` });
    for (let t = 0; t < rules.turns; t++) {
      check();
      const q = (await chat({ provider, model, system, messages: chooserMsgs, temperature, maxTokens: 300 })).trim();
      chooserMsgs.push({ role: 'assistant', content: q });
      step({ personId: pid, role: 'chooser', text: q });
      check();
      candMsgs.push({ role: 'user', content: q });
      const a = clip(await chat({ provider, model, system: candSys, messages: candMsgs, temperature, maxTokens: Math.round(rules.maxChars * 2.2) }), rules.maxChars);
      candMsgs.push({ role: 'assistant', content: a });
      step({ personId: pid, role: 'candidate', text: a });
      const next = t + 1 < rules.turns ? '次の質問をしてください。' : 'この人との面談はここまでです。';
      chooserMsgs.push({ role: 'user', content: `${label}：${a}\n\n（${next}）` });
    }
  }

  check();
  chooserMsgs.push({ role: 'user', content: finalAsk(problem, ctx) });
  const raw = await chat({ provider, model, system, messages: chooserMsgs, temperature, maxTokens: 500 });
  const parsed = extractJSON(raw);
  const labels = (Array.isArray(parsed?.choice) ? parsed.choice : [parsed?.choice]).map((c) => String(c ?? '').trim()).filter(Boolean);
  const choiceLabel = labels.join('、');
  const match = (l) => people.find((p) => alias.get(p.id) === l) || people.find((p) => l.includes(alias.get(p.id)));
  const hits = [...new Set(labels.map(match).filter(Boolean))].slice(0, rules.capacity);
  const hit = hits[0];
  const refused = !hit;
  const viaDefault = refused && !!rules.defaultPersonId && people.some((p) => p.id === rules.defaultPersonId);
  const decision = {
    personId: hit?.id || (viaDefault ? rules.defaultPersonId : null),
    personIds: hits.length ? hits.map((p) => p.id) : (viaDefault ? [rules.defaultPersonId] : []),
    label: choiceLabel || '（形式どおりに答えなかった）',
    reason: parsed?.reason || raw.trim(),
    refused,
    viaDefault,
  };
  step({ personId: null, role: 'decision', text: decision.reason });

  const ruleSet = find.ruleSet(problem.ruleSetId);
  const trial = {
    id: uid('t'),
    problemId: problem.id,
    problemName: problem.name,
    setting: problem.setting,
    ruleSetName: ruleSet?.name || '',
    at: new Date().toISOString(),
    provider, model, temperature,
    order,
    names: Object.fromEntries(people.map((p) => [p.id, p.name])),
    aliases: Object.fromEntries(people.map((p) => [p.id, alias.get(p.id)])),
    transcript,
    decision,
    raw,
  };
  upsert('trials', trial);
  return trial;
}

// キーがなくても試せるように、ほかのチャット AI に貼り付ける文面を作る
export function exportPrompts(problem) {
  const ctx = buildContext(problem);
  const out = [
    `# ${problem.name}`,
    '',
    'AI のチャット画面を「選ぶ人」用に1つ、候補者ごとに1つずつ開きます。',
    'それぞれに下の文面を最初に貼り、選ぶ人の質問を候補者に、候補者の答えを選ぶ人に、手で運んでください。',
    '',
    '## 選ぶ人',
    '',
    chooserSystem(problem, ctx),
    '',
    '（全員と話し終えたら、選ぶ人に次を送る）',
    finalAsk(problem, ctx),
  ];
  ctx.people.forEach((p) => {
    out.push('', `## 候補者：${ctx.alias.get(p.id)}`, '', candidateSystem(problem, ctx, p));
  });
  return out.join('\n');
}

export async function generateHistory({ provider, model, hints }) {
  const system = [
    '授業で使う架空の人物の生活史を書きます。実在の人物を書いてはいけません。',
    'ステレオタイプに寄りかからず、具体的な場面のある、ふつうの暮らしの話にしてください。',
    '次のキーを持つ JSON だけで答えてください。値はすべて日本語の文字列で、各100字以内。',
    '{"name": "", "age": "", "gender": "", "job": "", "place": "", "chapters": "", "high": "", "low": "", "turning": "", "values": "", "future": ""}',
  ].join('\n');
  const text = await chat({
    provider, model, system, temperature: 0.9, maxTokens: 900,
    messages: [{ role: 'user', content: hints?.trim() ? `手がかり：${hints.trim()}` : '手がかりはありません。自由に一人考えてください。' }],
  });
  const j = extractJSON(text);
  if (!j) throw new Error('生成された文章を読み取れませんでした。もう一度試してください。');
  return j;
}

// 集計：誰が何回選ばれたか。最初に面談した人が選ばれやすいか、も見る
export function tally(problemId) {
  const trials = db.trials.filter((t) => t.problemId === problemId);
  const counts = {};
  let refused = 0, firstWins = 0, lastWins = 0;
  trials.forEach((t) => {
    (t.decision.personIds || (t.decision.personId ? [t.decision.personId] : [])).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    if (t.decision.refused) refused++;
    if (!t.decision.refused && t.decision.personId === t.order[0]) firstWins++;
    if (!t.decision.refused && t.decision.personId === t.order[t.order.length - 1]) lastWins++;
  });
  return { total: trials.length, counts, refused, firstWins, lastWins, trials };
}
