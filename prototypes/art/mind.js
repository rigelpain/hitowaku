// 一行の一人ひとりの「頭の中」。描画からは切り離してある。
//
// 分けて持つもの
//   COMMON        一般常識：「この種類の人はこれくらいの速さで歩く」という、皆が共有している思い込み
//   ability       その人が実際に歩ける速さ（本人も他人も、最初は知らない事実）
//   belief[j]     i が j の速さをどう見積もっているか（最初は一般常識から）
//   policy        その人の決めごと。人が決めても AI が決めてもよい
//     adapt       見積もりでいちばん遅い人に、自分の歩みをどれだけ合わせるか（0〜1）
//     observe     実際の歩きぶりを見て、見積もりとのずれに気づくか
//     learn       気づいたずれを、どれだけ見積もりに反映するか（0〜1）
//     metacog     自分の見積もりや変化を自覚しているか。していなければ内心の言葉は出ない
//     voice       自覚したことをどう扱うか。share＝気づいた事実を伝える、declare＝方針だけ言う、hide＝内心にとどめる
//     trust       人から聞いた話を、どれだけ見積もりに取り込むか（0〜1）
//
// 速さはすべて、一行の標準の速さ PACE に対する比で表す。

export const COMMON = { elder: 0.6, adult: 1.0 };

export const MINDS = {
  toru:  { kind: 'adult', ability: 1.0,  policy: { adapt: 0.9, observe: true,  learn: 0.4, metacog: true,  voice: 'declare', trust: 0.5 } },
  akari: { kind: 'adult', ability: 1.05, policy: { adapt: 0,   observe: true,  learn: 0.6, metacog: true,  voice: 'hide',    trust: 0.3 } },
  fumio: { kind: 'elder', ability: 0.92, policy: { adapt: 0.2, observe: true,  learn: 0,   metacog: true,  voice: 'share',   trust: 0.5 } },
  yuma:  { kind: 'adult', ability: 1.1,  policy: { adapt: 0.3, observe: false, learn: 0,   metacog: false, voice: 'share',   trust: 0.8 } },
  nagi:  { kind: 'adult', ability: 0.95, policy: { adapt: 0.7, observe: true,  learn: 0.3, metacog: false, voice: 'hide',    trust: 0.2 } },
};

const KIND_JA = { elder: 'お年寄り', adult: '大人' };
const fmt = (v) => v.toFixed(2);

export function createMinds(people, { leader = 0, policies = {} } = {}) {
  const log = [];
  const listeners = [];
  const minds = people.map((p, i) => {
    const m = MINDS[p.id];
    return {
      i, id: p.id, name: p.name, first: p.name.split(' ').pop(), kind: m.kind, ability: m.ability,
      policy: { ...m.policy, ...(policies[p.id] || {}) },
      belief: people.map((q) => COMMON[MINDS[q.id].kind]),
      seen: people.map(() => ({ sum: 0, n: 0, avg: null })),
      noticed: new Set(),
      pace: null, saidSelf: false,
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
      if (m.policy.metacog && m.policy.voice === 'declare' && m.policy.adapt > 0.5) emit(t, m, 'say', `${slow.first}さんに合わせて、ゆっくり行こう`);
    });
  }

  // m が見積もりでいちばん遅いと思っている相手
  function slowest(m) {
    let best = null;
    minds.forEach((o) => { if (o !== m && (!best || m.belief[o.i] < m.belief[best.i])) best = o; });
    return best && m.belief[best.i] < 0.98 ? best : null;
  }

  // m が出したい速さ：自分の力と、いちばん遅いと思う人の見積もりを、adapt の割合で混ぜる
  function pace(i) {
    const m = minds[i];
    let slow = Infinity;
    minds.forEach((o) => { if (o !== m) slow = Math.min(slow, m.belief[o.i]); });
    const a = m.policy.adapt;
    return Math.min(m.ability, (1 - a) * m.ability + a * slow);
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
    if (o.i === leader && !faster && slowest(o) === m && m.seen[o.i].avg < m.ability - 0.1) {
      if (meta) emit(t, m, 'inner', `みんな僕に合わせてくれている。本当はもう少し歩ける`);
      if (meta && m.policy.voice === 'share' && !m.saidSelf) { m.saidSelf = true; say(t, m, '合わせなくて大丈夫。僕はまだ歩けるよ', { about: m.i, value: m.ability }); }
      else if (meta && m.policy.voice === 'declare') say(t, m, '先に行っていいよ');
      else if (meta) emit(t, m, 'inner', '（言わないでおこう）');
      return;
    }
    const word = faster ? '思ったより速い' : '思ったより遅い';
    if (meta) emit(t, m, 'inner', `${o.first}さん、${word}`, { about: o.i, seen: m.seen[o.i].avg, belief: m.belief[o.i] });
    else emit(t, m, 'act', `${o.first}さんの見積もりが変わり始めた`, { aware: false, short: '見積もりが動いた' });
    if (!meta) return;
    if (m.policy.voice === 'share') say(t, m, `${o.first}さん、けっこう${faster ? '速い' : 'ゆっくり'}ですね`, { about: o.i, value: m.seen[o.i].avg });
    else if (m.policy.voice === 'declare') say(t, m, faster ? '少しペースを上げよう' : 'もう少しゆっくり行こう');
    else emit(t, m, 'inner', '（言わないでおこう）');
  }

  // 発話：聞いた人は trust の割合で見積もりを動かす
  function say(t, m, text, claim) {
    emit(t, m, 'say', text);
    if (!claim) return;
    minds.forEach((o) => {
      if (o === m || o.policy.trust <= 0) return;
      const before = o.belief[claim.about];
      o.belief[claim.about] += o.policy.trust * (claim.value - before);
      const whom = claim.about === o.i ? '自分' : minds[claim.about].first + 'さん';
      if (o.policy.metacog) emit(t, o, 'hear', `${m.first}さんの話で、${whom}の見積もり ${fmt(before)} → ${fmt(o.belief[claim.about])}`, { short: 'そうなんだ' });
      else emit(t, o, 'act', `${m.first}さんの話を聞いて、${whom}の見積もり ${fmt(before)} → ${fmt(o.belief[claim.about])}`, { aware: false, short: '見積もりが動いた' });
    });
  }

  return { minds, log, start, tick, pace, watching, onLog: (f) => listeners.push(f) };
}
