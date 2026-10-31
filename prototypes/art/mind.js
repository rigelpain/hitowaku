// 一行の一人ひとりの「頭の中」。描画からは切り離してある。
//
// 分けて持つもの
//   COMMON        一般常識：「この種類の人はこれくらいの速さで歩く」という、皆が共有している思い込み
//   ability       その人が実際に歩ける速さ（本人も他人も、最初は知らない事実）
//   belief[j]     i が j の速さをどう見積もっているか（最初は一般常識から）。belief[i] は自分の見積もり
//   policy        その人の決めごと。人が決めても AI が決めてもよい
//     adapt       見積もりでいちばん遅い人に、自分の歩みをどれだけ合わせるか（0〜1）
//     observe     実際の歩きぶりを見て、見積もりとのずれに気づくか
//     learn       気づいたずれを、どれだけ見積もりに反映するか（0〜1）
//     metacog     自分の見積もりや変化を自覚しているか。していなければ内心の言葉は出ない
//     voice       自覚したことをどう扱うか。share＝気づいた事実を伝える、declare＝方針だけ言う、hide＝内心にとどめる
//     trust       人から聞いた話を、どれだけ見積もりに取り込むか（0〜1）
//     stereo      思い込みの強さ。自分の見積もりに、実際の歩みがどれだけ引っ張られるか（0〜1）
//     selfLearn   自分を知る。歩いている体の手応えから、自分の見積もりをどれだけ直すか（0〜1）
//     depend      人の見方に左右される。人が自分をどう見ているかを、自分の見積もりにどれだけ取り込むか（0〜1）
//
// 一行の目的と、一人ひとりの目的
//   PARTY_GOAL    一行が目指すこと
//   goal          その人自身の目的
//   commit        一行の目的にどれだけ乗っているか（0〜1）。低い人は、人に合わせて歩みを落としにくい
//
// ふだんは AI が旅ごと（seed ごと）に、性格の芯は保ったまま方針と力を少しずつ変えて決める。
// Minds パネルで人が決めた値は、その上に重ねる。
//
// 速さはすべて、一行の標準の速さ PACE に対する比で表す。

export const COMMON = { elder: 0.6, adult: 1.0 };
export const PARTY_GOAL = '港を出る最後の船に全員で乗る';

export const MINDS = {
  toru:  { kind: 'adult', goal: '全員を船に乗せる', commit: 0.95, policy: { adapt: 0.9, observe: true,  learn: 0.4, metacog: true,  voice: 'declare', trust: 0.5, stereo: 0.5, selfLearn: 0.3,  depend: 0.2 } },
  akari: { kind: 'adult', goal: '港町で待つ子どもたちに会う', commit: 0.6, policy: { adapt: 0,   observe: true,  learn: 0.6, metacog: true,  voice: 'hide',    trust: 0.3, stereo: 0.5, selfLearn: 0.3,  depend: 0.5 } },
  fumio: { kind: 'elder', goal: '港町に住む孫に会う。沈む町を離れたくない気持ちもある', commit: 0.4, policy: { adapt: 0.2, observe: true,  learn: 0,   metacog: true,  voice: 'share',   trust: 0.5, stereo: 0.8, selfLearn: 0.25, depend: 0.7 } },
  yuma:  { kind: 'adult', goal: '沈む町と旅の記録を残す', commit: 0.5, policy: { adapt: 0.3, observe: false, learn: 0,   metacog: false, voice: 'share',   trust: 0.8, stereo: 0.3, selfLearn: 0.5,  depend: 0.1 } },
  nagi:  { kind: 'adult', goal: '途中で拾われた。行き先はまだない', commit: 0.3, policy: { adapt: 0.7, observe: true,  learn: 0.3, metacog: false, voice: 'hide',    trust: 0.2, stereo: 0.6, selfLearn: 0.1,  depend: 0.8 } },
};

const KIND_JA = { elder: 'お年寄り', adult: '大人' };
// 実際の力の幅：一般常識が当たる旅も、外れる旅もある
const ABILITY_RANGE = { elder: [0.5, 1.0], adult: [0.88, 1.15] };
const VOICES = ['share', 'declare', 'hide'];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round1 = (v) => Math.round(v * 10) / 10;

// AI が決める方針：性格の芯（MINDS）から、旅ごとに少しずらす
function autoPolicy(base, r) {
  const p = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'number') p[k] = round1(clamp01(v + (r() - 0.5) * 0.5));
    else if (typeof v === 'boolean') p[k] = r() < 0.2 ? !v : v;
    else p[k] = r() < 0.25 ? VOICES[Math.floor(r() * VOICES.length)] : v;
  }
  return p;
}
const fmt = (v) => v.toFixed(2);

export function createMinds(people, { leader = 0, policies = {}, seed = 7 } = {}) {
  const r = rng(seed * 97 + 13);
  const log = [];
  const listeners = [];
  const minds = people.map((p, i) => {
    const m = MINDS[p.id];
    const [lo, hi] = ABILITY_RANGE[m.kind];
    const ability = Math.round((lo + r() * (hi - lo)) * 100) / 100;
    const commit = round1(clamp01(m.commit + (r() - 0.5) * 0.3));
    const auto = autoPolicy(m.policy, r);
    return {
      i, id: p.id, name: p.name, first: p.name.split(' ').pop(), kind: m.kind, ability, goal: m.goal, commit,
      auto, policy: { ...auto, ...(policies[p.id] || {}) },
      belief: people.map((q) => COMMON[MINDS[q.id].kind]),
      seen: people.map(() => ({ sum: 0, n: 0, avg: null })),
      noticed: new Set(),
      pace: null, saidSelf: false, selfStart: COMMON[m.kind], selfNoticed: false,
    };
  });

  function emit(t, m, kind, text, extra = {}) {
    const e = { t, who: m.i, name: m.name, kind, text, ...extra };
    log.push(e);
    listeners.forEach((f) => f(e));
  }

  // 一行が歩き出したとき：一般常識から見積もりを立てる
  function start(t) {
    minds.forEach((m) => {
      const slow = slowest(m);
      if (!slow) return;
      const v = m.belief[slow.i];
      if (m.policy.metacog) emit(t, m, 'inner', `${slow.first}さんは${KIND_JA[slow.kind]}だから、ゆっくりだろう`, { about: slow.i, belief: v });
      // 方針を言うと、言った人の見積もりも一緒に伝わる
      if (m.policy.metacog && m.policy.voice === 'declare' && m.policy.adapt > 0.5) say(t, m, `${slow.first}さんに合わせて、ゆっくり行こう`, { about: slow.i, value: v });
    });
    minds.forEach((m) => {
      if (m.policy.metacog && m.belief[m.i] < 0.9 && m.policy.stereo > 0.5) emit(t, m, 'inner', '僕は年だから、みんなより遅い', { about: m.i, belief: m.belief[m.i] });
    });
  }

  // m が見積もりでいちばん遅いと思っている相手
  function slowest(m) {
    let best = null;
    minds.forEach((o) => { if (o !== m && (!best || m.belief[o.i] < m.belief[best.i])) best = o; });
    return best && m.belief[best.i] < 0.98 ? best : null;
  }

  // 自分で出せると思っている速さ：実際の力と自分の見積もりを、思い込みの強さで混ぜる（力より速くは歩けない）
  function ownPace(m) {
    const st = m.policy.stereo;
    return (1 - st) * m.ability + st * Math.min(m.ability, m.belief[m.i]);
  }

  // m が出したい速さ：自分で出せる速さと、いちばん遅いと思う人の見積もりを、adapt の割合で混ぜる
  function pace(i) {
    const m = minds[i], own = ownPace(m);
    let slow = Infinity;
    minds.forEach((o) => { if (o !== m) slow = Math.min(slow, m.belief[o.i]); });
    // 一行の目的に乗っていない人ほど、人に合わせて歩みを落としにくい
    const a = m.policy.adapt * (0.4 + 0.6 * m.commit);
    return Math.min(own, (1 - a) * own + a * slow);
  }

  // 誰を見ているか：遅いと思っている人がいればその人、いなければ歩みを決めている先頭
  function watching(m) {
    const slow = slowest(m);
    if (slow) return slow;
    return m.i === leader ? null : minds[leader];
  }

  // 歩いている間、毎フレーム呼ぶ。speeds[j] は j の実際の速さ（PACE に対する比）、moving[j] は歩いているか
  let acc = 0;
  function tick(t, dt, speeds, moving) {
    minds.forEach((m) => {
      const o = watching(m);
      if (!m.policy.observe || !o || !moving[o.i]) return; // 立ち止まって休んでいる間は、歩く速さとして数えない
      const s = m.seen[o.i];
      s.sum += speeds[o.i] * dt; s.n += dt;
    });
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    minds.forEach((m) => {
      const o = watching(m);
      if (m.policy.observe && o) {
        const s = m.seen[o.i];
        if (s.n >= 0.5) {
          s.avg = s.sum / s.n; s.sum = 0; s.n = 0;
          const gap = s.avg - m.belief[o.i];
          if (Math.abs(gap) > 0.15 && !m.noticed.has(o.i)) notice(t, m, o, gap);
          if (m.policy.learn > 0) m.belief[o.i] += m.policy.learn * gap * 0.5;
        }
      }
      // 自分を知る：歩いている体の手応えで、自分の見積もりが実際の力に寄っていく
      if (moving[m.i] && m.policy.selfLearn > 0) m.belief[m.i] += m.policy.selfLearn * 0.25 * (m.ability - m.belief[m.i]);
      noticeSelf(t, m);
      // 歩みの調整：前に出した速さから目に見えて変わったら、行動として記録する
      const p = pace(m.i);
      if (m.pace === null) m.pace = p;
      else if (Math.abs(p - m.pace) > 0.06) {
        emit(t, m, 'act', `歩く速さ ${fmt(m.pace)} → ${fmt(p)}`, { aware: m.policy.metacog, short: p > m.pace ? '足が速まる' : '足がゆるむ' });
        m.pace = p;
      }
    });
  }

  // 見積もりと実際とのずれに気づいたとき
  function notice(t, m, o, gap) {
    m.noticed.add(o.i);
    const faster = gap > 0;
    const meta = m.policy.metacog;
    // 合わせてもらっている側：周りが自分の力より遅いと気づく
    if (o.i === leader && !faster && slowest(o) === m && m.seen[o.i].avg < ownPace(m) - 0.1) {
      if (meta) emit(t, m, 'inner', `みんな僕に合わせてくれている。本当はもう少し歩ける`);
      if (meta && m.policy.voice === 'share' && !m.saidSelf) { m.saidSelf = true; say(t, m, '合わせなくて大丈夫。僕はまだ歩けるよ', { about: m.i, value: m.belief[m.i] }); }
      else if (meta && m.policy.voice === 'declare') say(t, m, '先に行っていいよ');
      else if (meta) emit(t, m, 'inner', '（言わないでおこう）');
      return;
    }
    const word = faster ? '思ったより速い' : '思ったより遅い';
    if (meta) emit(t, m, 'inner', `${o.first}さん、${word}`, { about: o.i, seen: m.seen[o.i].avg, belief: m.belief[o.i] });
    else emit(t, m, 'act', `${o.first}さんの見積もりが変わり始めた`, { aware: false, short: '見積もりが動いた' });
    if (!meta) return;
    if (m.policy.voice === 'share') say(t, m, `${o.first}さん、けっこう${faster ? '速い' : 'ゆっくり'}ですね`, { about: o.i, value: m.seen[o.i].avg });
    else if (m.policy.voice === 'declare' && o.i === leader) {
      // 先頭の歩みについては、自分の出せる速さと比べて言う
      const own = ownPace(m), seen = m.seen[o.i].avg;
      if (seen > own + 0.05) say(t, m, '少し待ってほしい');
      else if (seen < own - 0.1) say(t, m, 'もう少し速くても大丈夫');
    }
    else if (m.policy.voice === 'declare') say(t, m, faster ? '少しペースを上げよう' : 'もう少しゆっくり行こう');
    else emit(t, m, 'inner', '（言わないでおこう）');
  }

  // 自分の見積もりが、歩き出したときから目に見えて変わったことに気づく
  function noticeSelf(t, m) {
    const d = m.belief[m.i] - m.selfStart;
    if (m.selfNoticed || Math.abs(d) < 0.15) return;
    m.selfNoticed = true;
    const up = d > 0;
    if (!m.policy.metacog) { emit(t, m, 'act', `自分の見積もり ${fmt(m.selfStart)} → ${fmt(m.belief[m.i])}`, { aware: false, short: up ? '足が軽くなる' : '足が重くなる' }); return; }
    emit(t, m, 'inner', up ? '思ったより歩ける。まだ足が軽い' : 'やっぱり僕は遅いのかな', { about: m.i, belief: m.belief[m.i] });
    if (m.saidSelf) return; // もう伝えてある
    if (m.policy.voice === 'share' && up) { m.saidSelf = true; say(t, m, '思ったより歩けるよ。合わせなくて大丈夫', { about: m.i, value: m.belief[m.i] }); }
    else if (m.policy.voice === 'declare' && up) say(t, m, '少し速く行っても大丈夫');
    else emit(t, m, 'inner', '（言わないでおこう）');
  }

  // 発話：聞いた人は trust の割合で見積もりを動かす。自分のことを言われたら、depend の割合で自分の見積もりを動かす
  function say(t, m, text, claim) {
    emit(t, m, 'say', text);
    if (!claim) return;
    minds.forEach((o) => {
      const w = claim.about === o.i ? o.policy.depend : o.policy.trust;
      if (o === m || w <= 0) return;
      const before = o.belief[claim.about];
      o.belief[claim.about] += w * (claim.value - before);
      if (Math.abs(o.belief[claim.about] - before) < 0.01) return; // 見積もりが動かなければ、聞き流したことにする
      const whom = claim.about === o.i ? '自分' : minds[claim.about].first + 'さん';
      if (o.policy.metacog) emit(t, o, 'hear', `${m.first}さんの話で、${whom}の見積もり ${fmt(before)} → ${fmt(o.belief[claim.about])}`, { short: 'そうなんだ' });
      else emit(t, o, 'act', `${m.first}さんの話を聞いて、${whom}の見積もり ${fmt(before)} → ${fmt(o.belief[claim.about])}`, { aware: false, short: '見積もりが動いた' });
    });
  }

  return { minds, log, start, tick, pace, ownPace, watching, onLog: (f) => listeners.push(f) };
}
