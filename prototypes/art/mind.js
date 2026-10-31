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
//     talk        話しかけやすさ。自分から話を振る頻度と、話しかけられたときに返事をするか（0〜1）
//
// 人どうしのやりとり（歩いている間）
//   affinity[j]   i が j をどれだけ近く感じているか（0〜1）。やりとりで少しずつ動く
//   声をかける    遅れている人や休んでいる人に「大丈夫？」と聞く。聞かれた人は方針しだいで本音を言うか隠す
//   付き添う      心配した人が、しばらく相手の横を歩く（intent）
//   話しかける    自分の目的に関わる話をする。返事があるかで近さが変わる
//   急ぎたい      一行の目的に乗りきれていない人が、先頭の歩みに不満を持つ。言うか飲み込むかは方針しだい
//
// 内側の状態（本人にも周りにも、数値としては見えない）
//   inner.vision     見える範囲。弱いと道の筋からそれても気づくのが遅れ、近くのものしか目に入らない
//   inner.reminisce  目に入ったものから思い出に引かれる強さ。強いと立ち止まって見入る
//   inner.will       前へ進む気持ち。弱いと歩みが落ち、来た道を振り返る
//
// 思い（muse）：目に入ったもの・思い出・目的から、数秒おきにとりとめなく浮かぶ考え。
//   depth（0〜3）で出す深さを決める。0 は出さない、1 は見えたもの、2 は思い出と現実逃避、
//   3 は生きる気持ちが薄れた考えまで。授業では教える人が決める
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
  toru:  { kind: 'adult', goal: '全員を船に乗せる', commit: 0.95, policy: { adapt: 0.9, observe: true,  learn: 0.4, metacog: true,  voice: 'declare', trust: 0.5, stereo: 0.5, selfLearn: 0.3,  depend: 0.2, talk: 0.3 } },
  akari: { kind: 'adult', goal: '港町で待つ子どもたちに会う', commit: 0.6, policy: { adapt: 0,   observe: true,  learn: 0.6, metacog: true,  voice: 'hide',    trust: 0.3, stereo: 0.5, selfLearn: 0.3,  depend: 0.5, talk: 0.3 } },
  fumio: { kind: 'elder', goal: '港町に住む孫に会う。沈む町を離れたくない気持ちもある', commit: 0.4, policy: { adapt: 0.2, observe: true,  learn: 0,   metacog: true,  voice: 'share',   trust: 0.5, stereo: 0.8, selfLearn: 0.25, depend: 0.7, talk: 0.4 } },
  yuma:  { kind: 'adult', goal: '沈む町と旅の記録を残す', commit: 0.5, policy: { adapt: 0.3, observe: false, learn: 0,   metacog: false, voice: 'share',   trust: 0.8, stereo: 0.3, selfLearn: 0.5,  depend: 0.1, talk: 0.9 } },
  nagi:  { kind: 'adult', goal: '途中で拾われた。行き先はまだない', commit: 0.3, policy: { adapt: 0.7, observe: true,  learn: 0.3, metacog: false, voice: 'hide',    trust: 0.2, stereo: 0.6, selfLearn: 0.1,  depend: 0.8, talk: 0.1 } },
};

const KIND_JA = { elder: 'お年寄り', adult: '大人' };
// 自分から振る話。目的や立場がにじむようにする
const TOPICS = {
  toru: ['川まではもう少しだ', '食料は足りそうだ'],
  akari: ['船に間に合うかな', '子どもたち待ってるだろうな'],
  fumio: ['この道は昔よく通ったんだ', '町が沈むなんてまだ信じられない'],
  yuma: ['この景色撮っておきたいな', '町の写真あとで見せるね'],
  nagi: ['この道はどこまで続くんですか'],
};
const WARM = ['いいですね', 'そうですね', 'うん楽しみ', 'ほんとに'];

// 内側の状態の幅。旅ごとにこの中から決まる
const INNER = {
  fumio: { vision: [0.15, 0.55], reminisce: [0.5, 0.95], will: [0.15, 0.6] },
  other: { vision: [0.8, 1], reminisce: [0.1, 0.4], will: [0.6, 0.95] },
};

// 思いの種。[深さ, 文] の組。目に入ったもの（tag）ごと、人ごとに持つ
const MUSE = {
  fumio: {
    road: [[1, '道の端がよく見えない。足もとの色が溶けている'], [1, '前を歩く背中がぼやけて見える']],
    tree: [[1, 'この木はもっと低かった気がする'], [2, '妻はこういう木の下で弁当を広げるのが好きだった'], [2, '子どものころ、この先の林で迷ったことがある']],
    rock: [[1, '道ばたの石に腰をおろしたくなる'], [2, '父はこんな石を積んで畑の境にしていた']],
    river: [[1, '水の音だけはよく聞こえる'], [2, 'この川で孫と釣りをした。あの子は魚より石を集めていた']],
    behind: [[1, '振り返ってももう屋根は見えない'], [2, '町の時計は誰が止めるんだろう'], [3, '町と一緒に沈むのも悪くなかった']],
    free: [[2, '船に乗ったら、もう戻れない'], [2, '孫に会えたら何を話そう。話すことが思いつかない'], [3, 'このまま歩くのをやめたら、誰か困るだろうか'], [3, '港に着かなくてもいい気がしてきた']],
    toru: [[2, '透くんは父親に似てきた']], akari: [[2, '灯さんは急いでいる。若いうちはそれでいい']],
    yuma: [[2, '由真さんのカメラに、町はどう写っているんだろう']], nagi: [[2, 'あの子は昔の自分に似ている']],
  },
  toru: {
    road: [[1, 'あと何日で港に着くか数え直す']], river: [[1, '橋は無事だろうか']],
    free: [[1, '全員を乗せる。それだけ考えればいい'], [2, '父ならこういうときどうしただろう']],
    fumio: [[1, '文雄さん、また止まっている。足が痛むのかな']],
  },
  akari: {
    road: [[1, '急げば一日早く着ける']], free: [[2, '子どもたちは港で泣いていないだろうか'], [2, '先に一人で行けたら楽なのに']],
    fumio: [[1, '文雄さんに合わせていたら船に遅れる']],
  },
  yuma: {
    tree: [[1, 'この光は撮っておきたい']], river: [[1, '川の色が町の写真と同じだ']], rock: [[1, '石の苔がきれいだ']],
    free: [[2, '写真に残せば、沈んでも町はある']], nagi: [[1, 'ナギさんも写してあげたい']],
  },
  nagi: {
    road: [[1, '道はどこまで続くんだろう']], free: [[2, 'この人たちは私をどこまで連れて行くんだろう'], [2, '行き先がある人はいいな']],
    fumio: [[1, '文雄さんは時々遠くを見ている']],
  },
};
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
      affinity: people.map((q) => (q.id === 'nagi' || p.id === 'nagi' ? 0.2 : 0.3) + r() * 0.35),
      intent: null, rushed: false, cool: people.map(() => 0), easeUntil: 0,
      inner: Object.fromEntries(Object.entries(INNER[p.id] || INNER.other).map(([k, [lo, hi]]) => [k, round1(lo + r() * (hi - lo))])),
      nextMuse: 2 + r() * 5, mused: new Set(), attrCool: 0, why: {},
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
    // 先頭が「少しゆっくり行こう」と言ったあと、しばらく一行の歩みを落とす
    const ease = m.easeUntil > now ? 0.8 : 1;
    return Math.min(own, (1 - a) * own + a * slow) * ease;
  }

  // 誰を見ているか：遅いと思っている人がいればその人、いなければ歩みを決めている先頭
  function watching(m) {
    const slow = slowest(m);
    if (slow) return slow;
    return m.i === leader ? null : minds[leader];
  }

  // 歩いている間、毎フレーム呼ぶ。speeds[j] は j の実際の速さ（PACE に対する比）、moving[j] は歩いているか、
  // behind[j] は j が列のいつもの位置からどれだけ遅れているか、acts[j] は j がいましていること（rest・pause など）
  let acc = 0;
  let leadPace = null; // 先頭の歩みは、誰の目にも入る
  let now = 0;
  function tick(t, dt, speeds, moving, behind = [], acts = [], percepts = []) {
    now = t;
    if (moving[leader]) leadPace = leadPace === null ? speeds[leader] : leadPace + (speeds[leader] - leadPace) * Math.min(1, dt);
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
      // 急ぎたい：自分ならもっと速く歩けるのに、先頭が遅いと感じる
      if (t >= 3 && m.i !== leader && !m.rushed && m.commit < 0.7 && leadPace !== null && ownPace(m) > leadPace + 0.25) rush(t, m);
      // 歩みの調整：前に出した速さから目に見えて変わったら、行動として記録する
      const p = pace(m.i);
      if (m.pace === null) m.pace = p;
      else if (Math.abs(p - m.pace) > 0.06) {
        emit(t, m, 'act', `歩く速さ ${fmt(m.pace)} → ${fmt(p)}`, { aware: m.policy.metacog, short: p > m.pace ? '足が速まる' : '足がゆるむ' });
        m.pace = p;
      }
    });
    interact(t, behind, acts);
    attribute(t, acts);
    minds.forEach((m) => { if (t >= m.nextMuse) { muse(t, m, percepts[m.i]); m.nextMuse = t + museGap(m); } });
  }

  // ---------- 思い ----------
  let depth = 2;
  // 思いの種から、まだ浮かべていない文を選ぶ。tag が無ければ、そばの人や目的についての思いにする
  function pick(m, tags) {
    const bank = MUSE[m.id] || {};
    for (const tag of tags) {
      const list = (bank[tag] || []).filter(([d, text]) => d <= depth && !m.mused.has(text));
      if (list.length) return list[Math.floor(r() * list.length)][1];
    }
    return null;
  }
  // 思い出に引かれやすい人ほど、思いが次々に浮かぶ
  const museGap = (m) => (3 + r() * 4) * (1.4 - m.inner.reminisce);
  function muse(t, m, tag) {
    if (depth === 0) return;
    const others = minds.filter((o) => o !== m).map((o) => o.id);
    const tags = [tag, ...(r() < 0.4 ? others.sort(() => r() - 0.5) : []), 'free', 'road'].filter(Boolean);
    let text = pick(m, tags);
    if (!text) return;
    m.mused.add(text);
    // 深さ 2 以上では、見えたものから目的や思い出へ考えが流れていくことがある
    if (depth >= 2 && r() < 0.4) {
      const next = pick(m, ['free']);
      if (next) { m.mused.add(next); text += '。' + next; }
    }
    emit(t, m, 'muse', text);
  }
  // 立ち止まって何かに見入ったとき・振り返ったとき（journey.js から呼ぶ）
  function linger(i, tag, t) {
    const m = minds[i];
    m.lingerAt = t;
    if (depth === 0) return;
    const text = pick(m, [tag, 'free']);
    if (text) { m.mused.add(text); emit(t, m, 'muse', text); m.nextMuse = t + museGap(m); }
  }

  // 周りの解釈：立ち止まった人を見て、一般常識から理由を当てはめる（本当の理由は内側にあって見えない）
  function attribute(t, acts) {
    minds.forEach((m) => {
      const o = watching(m);
      if (!o || acts[o.i] !== 'linger' || t < m.attrCool || !m.policy.observe) return;
      m.attrCool = t + 8;
      if (m.why[o.i] === 'memory') {
        if (m.policy.metacog) emit(t, m, 'inner', `${o.first}さん、また昔を思い出しているのかな`, { about: o.i });
      } else if (m.belief[o.i] < 0.85) {
        if (m.policy.metacog) emit(t, m, 'inner', `${o.first}さんまた止まった。やっぱり足が弱いのかな`, { about: o.i });
        else emit(t, m, 'act', `${o.first}さんの見積もりが下がる`, { aware: false, short: '見積もりが下がる' });
        m.belief[o.i] = Math.max(0.3, m.belief[o.i] - 0.05);
      } else if (m.policy.metacog) emit(t, m, 'inner', `${o.first}さん、何を見ているんだろう`, { about: o.i });
    });
  }

  // ---------- 人どうしのやりとり ----------
  const busy = (m, t) => m.intent && m.intent.until > t;
  const near = (a, b, d) => { a.affinity[b.i] = clamp01(a.affinity[b.i] + d); };
  function accompany(t, m, o, secs, why) {
    m.intent = { with: o.i, until: t + secs, why };
    emit(t, m, 'act', `${o.first}さんの横を歩く（${why}）`, { aware: m.policy.metacog, short: why });
  }

  // 新しいやりとりは 1 秒に 1 つまで（同時に話し出さない）
  function interact(t, behind, acts) {
    let done = false;
    // 声をかける：遅れている人、休んでいる人
    minds.forEach((o) => {
      if (done || o.i === leader) return;
      const lagging = (behind[o.i] ?? 0) > 1.8 || acts[o.i] === 'rest' || acts[o.i] === 'pause' || acts[o.i] === 'linger';
      if (!lagging || t < o.cool[o.i] || busy(o, t)) return;
      let helper = null, best = -1;
      minds.forEach((m) => {
        if (m === o || busy(m, t) || !m.policy.observe || m.commit < 0.5) return;
        const score = m.affinity[o.i] + m.commit;
        if (score > best) { best = score; helper = m; }
      });
      if (!helper) return;
      o.cool[o.i] = t + 10;
      checkIn(t, helper, o, acts[o.i] === 'linger');
      done = true;
    });
    // 話しかける
    minds.forEach((m) => {
      if (done || busy(m, t) || r() > m.policy.talk * 0.12) return;
      const others = minds.filter((o) => o !== m && !busy(o, t));
      if (!others.length) return;
      let sum = others.reduce((a, o) => a + m.affinity[o.i] + 0.2, 0), pick = r() * sum, o = others[0];
      for (const q of others) { pick -= m.affinity[q.i] + 0.2; if (pick <= 0) { o = q; break; } }
      chat(t, m, o);
      done = true;
    });
  }

  // lingering：疲れではなく、何かに見入ったり振り返ったりして止まっていた
  function checkIn(t, m, o, lingering = false) {
    say(t, m, `${o.first}さん、大丈夫？`);
    let worried = false;
    if (!o.policy.metacog) say(t, o, 'うん');
    else if (o.policy.voice === 'share') {
      say(t, o, lingering ? 'ちょっと昔を思い出していた' : '少し休みたい');
      worried = !lingering;
      // 本人の言葉を信じた人は、立ち止まる理由を足のせいにしなくなる
      if (lingering) minds.forEach((q) => { if (q !== o && q.policy.trust >= 0.3) q.why[o.i] = 'memory'; });
    }
    else if (o.policy.voice === 'declare') say(t, o, '先に行っていいよ');
    else { say(t, o, '大丈夫'); emit(t, o, 'inner', lingering ? '本当は昔のことを考えていた' : '本当は少し疲れている'); }
    // 言葉と見た目のずれ：観察する人は、遅れていることを自分の目でも見ている
    if (!worried && m.policy.observe) {
      worried = true;
      if (m.policy.metacog) emit(t, m, 'inner', '大丈夫って言うけど遅れている');
    }
    near(o, m, 0.1); near(m, o, 0.05);
    if (o.policy.voice === 'declare' && o.policy.metacog) {
      if (m.commit >= 0.8) { say(t, m, '置いていかないよ'); if (m.i === leader) m.easeUntil = t + 5; else accompany(t, m, o, 6, '付き添う'); }
      else if (m.policy.metacog) emit(t, m, 'inner', '本人がそう言うなら');
      return;
    }
    if (!worried) return;
    // 先頭は列を離れず、一行全体の歩みを落とす
    if (m.i === leader) { say(t, m, '少しゆっくり行こう'); m.easeUntil = t + 5; return; }
    if (m.policy.adapt >= 0.3 || m.affinity[o.i] >= 0.5) accompany(t, m, o, 6, '付き添う');
  }

  function chat(t, m, o) {
    const lines = TOPICS[m.id];
    say(t, m, `${o.first}さん、${lines[Math.floor(r() * lines.length)]}`);
    if (o.policy.talk < 0.2 && o.affinity[m.i] < 0.45) {
      // 返事をしない。自覚があれば、言葉が出なかったことが内心に残る
      if (o.policy.metacog) emit(t, o, 'inner', '何て返せばいいか分からない');
      if (m.policy.metacog) emit(t, m, 'inner', '返事がない');
      near(m, o, -0.03);
      return;
    }
    say(t, o, o.affinity[m.i] > 0.55 ? WARM[Math.floor(r() * WARM.length)] : 'うん');
    near(m, o, 0.08); near(o, m, 0.06);
    accompany(t, m, o, 5, '話しながら歩く');
  }

  // 急ぎたい人：言うか飲み込むか。言われた先頭は、一行の目的に乗る度合いで答える
  function rush(t, m) {
    m.rushed = true;
    const L = minds[leader];
    if (!m.policy.metacog) { emit(t, m, 'act', '足が前へ出がちになる', { aware: false, short: '足が前へ出る' }); return; }
    if (m.policy.voice === 'hide') { emit(t, m, 'inner', '本当はもっと急ぎたいのに'); return; }
    say(t, m, `${L.first}さん、もう少し急げませんか。船に間に合わないかも`);
    if (L.commit >= 0.7) { say(t, L, '全員で行こう'); near(m, L, -0.05); if (m.policy.metacog) emit(t, m, 'inner', '急ぎたいのに'); }
    else { say(t, L, 'そうだね。少し急ごう'); L.policy.adapt = Math.max(0, L.policy.adapt - 0.3); near(m, L, 0.05); }
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

  const intent = (i, t) => (busy(minds[i], t) ? minds[i].intent : null);
  return { minds, log, start, tick, pace, ownPace, watching, intent, linger, setDepth: (d) => { depth = d; }, getDepth: () => depth, onLog: (f) => listeners.push(f) };
}
