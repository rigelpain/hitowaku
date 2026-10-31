// 水門番の仕組み（画面なし）。日々流れ続ける天の滝を、水門で 12 の池（3 段 × 4 方角）へ振り分ける。
// 時間は日単位で連続に進む（tick に渡す dt は日数）。滝が太る・細るは、ときどき起きる出来事。
//
// ダムには高さ（cap）と傷み（health）がある。
//   溢れる：水かさが高さを越えると、越えた分だけ同じ方角のひとつ外の段へこぼれる。ダムは少し傷む
//   崩壊　：傷みが限界に達すると、貯めていた水がまるごと外の段へ押し寄せ、ダムは大きく低くなる
// ダムが傷むと欠片が落ちる。下の池の人は気づいて「少し引き受ける」と申し出、同じ段の隣は「うちに回していい」と申し出る。
// 自分の池がもたない人は「水門を絞ってくれ」と頼む。申し出と頼みは、水門番が受けるか断るかを決める。
// 世帯は日々、家を積み足す（自分への備え）、ダムを補強する（みんなへの備え）、よその池を手伝う、休むのどれかに手を使う。
import { RINGS, SECTORS, HOMES, FAMILY, GIVEN, FACTS, WALLS, CHAPTERS, NEW_ROOM, TEMP_ROOM, VOICES } from './suimon-data.js';

export const DAYS = 160;
export const TOWN_PEOPLE = 200; // ふもとの町の人。山の外で、決壊のつけを受ける
const FALL = { base: 2.6, rise: 1.8, wave: 0.35 }; // 滝の量（12 の池の合計、一日あたり）。日がたつほど太る
const DRAIN = 0.13, DRAIN_K = 0.035;  // 池から川へ抜ける水（一日あたり、水かさが高いほど多い）
const LABOR = 0.12;                   // 一人が一日に出せる手
const BUILD = 0.055;                  // 補強の効き（ダムの高さ）
const REPAIR = 0.05;                  // 補強の効き（傷みの手当て）
const STACK = 0.9;                    // 家を一段積む速さ
const CRACK = 0.35;                   // これより傷むと欠片が落ちはじめる
const DECIDE = 3;                     // 何日おきに手の使い道を考え直すか

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const S = SECTORS.length, N = RINGS.length * S;
export const basinIndex = (ring, sector) => ring * S + sector;
export const GROUPS = {
  basin: (i) => [i],
  sector: (s) => RINGS.map((_, r) => basinIndex(r, s)),
  ring: (r) => SECTORS.map((_, s) => basinIndex(r, s)),
  all: () => Array.from({ length: N }, (_, i) => i),
};

export function createSim(seed, { voiceLevel = 2 } = {}) {
  const R = rng(seed);
  let deck = [];
  const draw = (n) => { const out = []; while (out.length < n) { if (!deck.length) deck = [...CHAPTERS].sort(() => R() - 0.5); out.push(deck.pop()); } return out; };
  // 池。内側の段から順に並べる（溢れと崩壊は内から外へ伝わる）
  const layers = [];
  RINGS.forEach((g, ring) => SECTORS.forEach((sec, sector) => {
    const i = basinIndex(ring, sector);
    layers.push({
      i, ring, sector, name: `${sec}の${g.name}`, cap: g.cap + (R() - 0.5), cap0: 0, health: 1, level: 2, res: g.res,
      received: 0, sunk: 0, built: 0, overflows: 0, overflowing: 0, spillRate: 0, collapses: 0, cracked: false, effort: 0, effortWin: 0,
      down: ring + 1 < RINGS.length ? basinIndex(ring + 1, sector) : null, up: ring > 0 ? basinIndex(ring - 1, sector) : null,
      side: [basinIndex(ring, (sector + 1) % S), basinIndex(ring, (sector + S - 1) % S)],
    });
  }));
  layers.forEach((l) => { l.cap0 = l.cap; l.capMark = l.cap; l.grew = 0; });
  // 世帯：名前のある 12 世帯と、池ごとに数世帯
  const deckOf = (arr) => { let d = []; return () => { if (!d.length) d = [...arr].sort(() => R() - 0.5); return d.pop(); }; };
  const nextFamily = deckOf(FAMILY), nextGiven = deckOf(GIVEN);
  const born = [];
  HOMES.forEach((h) => born.push({ ...h, layer: basinIndex(h.ring, h.sector) }));
  layers.forEach((l) => {
    const extra = [1, 2, 3][l.ring] + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < extra; k++) {
      const fam = nextFamily(), given = nextGiven();
      const [m0, m1] = RINGS[l.ring].members;
      const facts = [pick(R, FACTS)]; if (R() < 0.35) { const f2 = pick(R, FACTS); if (f2 !== facts[0]) facts.push(f2); }
      born.push({ id: `g${l.i}_${k}`, layer: l.i, ring: l.ring, sector: l.sector, name: `${fam} ${given}`, age: 22 + Math.floor(R() * 60), members: m0 + Math.floor(R() * (m1 - m0 + 1)), style: pick(R, ['polite', 'plain', 'plain', 'rough']), facts, wall: pick(R, WALLS) });
    }
  });
  const homes = born.map((h, k) => ({
    ...h, home: h.layer,
    blocks: draw(6 + Math.floor(R() * 3)).map((c) => ({ ...c, sunk: false })),
    selfish: 0.15 + R() * 0.55, diligence: 0.35 + R() * 0.55,
    // 見通し：水は増え続けると思っているか。余力：資材や蓄え。想像する力：見えない池の暮らしを思い描けるか（上の段ほど強い）
    foresight: 0.1 + R() * 0.85, means: RINGS[h.ring].res * (0.7 + R() * 0.6),
    imagination: clamp([0.7, 0.5, 0.32][h.ring] + (R() - 0.5) * 0.4, 0.05, 0.95),
    trust: 0.6, fatigue: 0, displaced: 0, progress: 0,
    belief: Array(N).fill(0.6),
    action: 'rest', target: null, why: null, next: (k % DECIDE) * 0.4 + R(), quiet: R() * 3, sunkNow: [],
  }));
  homes.forEach((h) => { h.blocks[0].sunk = true; h.blocks[1].sunk = true; });
  const FOUNDATION = { n: '土台', foundation: true, sunk: true };

  const near = (a, b) => layers[a].sector === layers[b].sector || layers[a].ring === layers[b].ring;
  // 見え方。上からは同じ方角の下の池がよく見え（clear）、同じ段どうしはダムの高さから推し量り（hazy）、
  // 下からは真上の池がかすかに見えるだけ（faint）
  const sight = (a, b) => {
    if (a === b) return null;
    const A = layers[a], B = layers[b], dr = B.ring - A.ring;
    if (dr > 0) return A.sector === B.sector ? 'clear' : null;
    if (dr === 0) return 'hazy';
    return A.sector === B.sector && dr === -1 ? 'faint' : null;
  };
  const PRIOR_UP = 0.3;
  homes.forEach((h) => layers.forEach((o) => { if (sight(h.layer, o.i) === 'faint') h.belief[o.i] = 0.6 * h.imagination + PRIOR_UP * (1 - h.imagination); }));

  // 出来事：滝が太る（受ける池を水門番が決める）、滝が細る
  const events = [];
  const pickDays = (n, lo, hi) => { const d = new Set(); while (d.size < n) d.add(Math.round(lo + R() * (hi - lo))); return [...d]; };
  pickDays(3, 25, DAYS - 15).forEach((day) => events.push({ day, type: 'surge', len: 3, amount: 2.2 + R() * 0.8 }));
  pickDays(2, 15, DAYS - 20).forEach((day) => events.push({ day, type: 'drought', len: 6 }));
  events.sort((a, b) => a.day - b.day);

  const state = {
    day: 0, layers, homes, voiceLevel, done: false, town: 0, towns: Array(S).fill(0), townWater: Array(S).fill(0), townWet: Array(S).fill(false), townDays: 0, townDaysBy: Array(S).fill(0), townTrust: 0.6,
    sluices: [], easing: [], requests: [], answered: { approved: 0, refused: 0 }, active: [], events, surge: null, fallNow: FALL.base,
    voices: [], shareWin: Array(N).fill(0),
  };
  let reqId = 1;
  const sunkCount = (h) => h.blocks.filter((b) => b.sunk).length;
  const people = (i) => homes.filter((h) => h.layer === i).reduce((s, h) => s + h.members, 0);
  const totalPeople = () => homes.reduce((s, h) => s + h.members, 0);
  const L = (i) => layers[i].name;
  let out = [];

  // ---------- 声 ----------
  let voiceGap = 0;
  function voice(h, kind, text, extra = {}, force = false) {
    if (!text) return;
    if (!force && (h.quiet > 0 || voiceGap > 0)) return;
    if (state.voiceLevel === 0 && kind === 'say' && !['thanks', 'help', 'offerTake', 'offerLateral', 'askEase', 'approved'].includes(extra.cat)) return;
    h.quiet = 4 + R() * 3; voiceGap = 0.35;
    const v = { day: state.day, home: h.id, name: h.name, layer: h.layer, kind, text, ...extra };
    state.voices.push(v); out.push({ type: 'voice', v });
  }
  const say = (h, cat, L1, extra = {}, force = false) => voice(h, 'say', pick(R, VOICES[cat][h.style]).replace('{L}', L1 ?? ''), { cat, ...extra }, force);

  // ---------- 章が沈む ----------
  function sink(i, level) {
    for (const h of homes) {
      if (h.layer !== i) continue;
      const depth = Math.floor(level);
      h.blocks.forEach((b, k) => {
        if (k < depth && !b.sunk) {
          b.sunk = true;
          if (!b.foundation) { h.sunkNow.push(b); layers[i].sunk++; h.trust = clamp(h.trust - 0.025, 0, 1); voice(h, 'muse', b.m); out.push({ type: 'sink', home: h.id }); }
        }
      });
      if (h.blocks.every((b) => b.sunk)) {
        const to = layers.filter((l) => l.i !== h.layer).sort((a, b) => (b.cap - b.level) - (a.cap - a.level))[0].i;
        out.push({ type: 'displace', home: h.id, from: h.layer, to });
        say(h, 'displaced', L(to), {}, true);
        h.layer = to; h.displaced++;
        const base = Math.ceil(layers[to].level);
        h.blocks = [...Array.from({ length: base }, () => ({ ...FOUNDATION })), { ...TEMP_ROOM, sunk: false }, { ...TEMP_ROOM, sunk: false }];
        h.trust = Math.max(0, h.trust - 0.25);
      }
    }
  }

  // ---------- 水を外の段へ送る（溢れ・崩壊） ----------
  function pour(i, amount, why) {
    const l = layers[i];
    if (l.down !== null) { layers[l.down].level += amount; layers[l.down].received += amount; return; }
    state.townWater[l.sector] += amount;
    // 町が浸かった回数は、浸かりはじめた回で数える（浸かり続けている間は数えない）
    if (!state.townWet[l.sector] && (why === 'collapse' || state.townWater[l.sector] > 1.5)) { state.townWet[l.sector] = true; state.town++; state.towns[l.sector]++; out.push({ type: 'town', sector: l.sector }); }
  }

  // ---------- 申し出と頼み ----------
  function request(type, from, to, by, rate, days) {
    if (state.requests.some((q) => q.type === type && q.from === from && q.to === to)) return;
    if (state.sluices.some((s) => s.from === from && s.to === to)) return;
    if (type === 'ease' && state.easing.some((e) => e.basin === from)) return;
    const q = { id: reqId++, type, from, to, by: by.id, rate, days, made: state.day, expires: state.day + 5 };
    state.requests.push(q);
    out.push({ type: 'request', q });
    const cat = type === 'take' ? 'offerTake' : type === 'lateral' ? 'offerLateral' : 'askEase';
    say(by, cat, L(from), { req: q.id }, true);
  }
  function answer(id, yes) {
    const q = state.requests.find((x) => x.id === id);
    if (!q) return null;
    state.requests.splice(state.requests.indexOf(q), 1);
    const by = homes.find((h) => h.id === q.by);
    if (yes) {
      state.answered.approved++;
      if (q.type === 'ease') state.easing.push({ basin: q.from, until: state.day + q.days });
      else state.sluices.push({ from: q.from, to: q.to, rate: q.rate, until: state.day + q.days, moved: 0 });
      by.trust = clamp(by.trust + 0.12, 0, 1);
      say(by, 'approved', null, {}, true);
    } else {
      state.answered.refused++;
      by.trust = clamp(by.trust - 0.1, 0, 1);
      by.refusedAt = { basin: q.from, day: state.day };
      say(by, 'refused', null, {}, true);
    }
    return q;
  }

  // ---------- 手の使い道を考える ----------
  function decide(h) {
    const l = layers[h.layer];
    const dry = h.blocks.length - sunkCount(h);
    const ahead = l.level + 1 + h.foresight * 4;
    const nowRisk = clamp((l.level + 1 - sunkCount(h)) / Math.max(1, dry), 0, 1.5);
    const ownRisk = clamp((ahead - sunkCount(h)) / Math.max(1, dry), 0, 1.5);
    const layerRisk = clamp(ahead / l.cap, 0, 1.5) + (1 - l.health) * 0.6;
    const others = layers.filter((o) => o.i !== h.layer && near(o.i, h.layer)).map((o) => ({ o, risk: (clamp((o.level + 2) / o.cap, 0, 1.5) + (1 - o.health) * 0.8) * (o.i === l.up ? 1.3 : o.sector === l.sector ? 0.8 : 0.6) }));
    const worst = others.sort((a, b) => b.risk - a.risk)[0];
    const score = {
      stack: (h.selfish * 0.8 + 0.3) * ownRisk * (0.5 + 0.5 * Math.min(1.5, h.means)) + 0.02,
      reinforce: ((1 - h.selfish) * 0.6 + h.diligence * 0.5) * layerRisk * (0.6 + h.foresight * 0.6) + 0.05,
      help: (1 - h.selfish) * h.diligence * 0.8 * worst.risk * (worst.risk > layerRisk ? 1 : 0.3) + 0.01,
      rest: (1 - h.diligence) * 0.6 + h.fatigue * 0.9,
    };
    let total = 0; for (const k in score) { score[k] = score[k] ** 1.6; total += score[k]; }
    let x = R() * total, act = 'rest';
    for (const k in score) { x -= score[k]; if (x <= 0) { act = k; break; } }
    const changed = act !== h.action || (act === 'help' && worst.o.i !== h.target);
    h.action = act; h.target = act === 'help' ? worst.o.i : null;
    h.why = act === 'stack' ? (nowRisk > 0.7 ? 'late' : 'early') : null;
    if (changed) {
      out.push({ type: 'task', home: h.id });
      if (act === 'stack') voice(h, 'inner', pick(R, h.why === 'late' ? VOICES.stackLate : VOICES.stackEarly));
      else if (act === 'reinforce') voice(h, 'inner', pick(R, l.health < 0.6 ? VOICES.repair : h.foresight > 0.7 ? VOICES.pool : VOICES.reinforce));
      else if (act === 'help') say(h, 'help', L(h.target));
      else if (R() < 0.5) voice(h, 'inner', pick(R, VOICES.rest));
    }
  }

  // ---------- 見立てと声（5 日ごと） ----------
  function judge() {
    const avg = layers.reduce((s, l) => s + l.effortWin, 0) / Math.max(1, totalPeople());
    const win = state.shareWin.reduce((a, b) => a + b, 0) || 1;
    for (const h of homes) {
      const rel = state.shareWin[h.layer] / win * N;
      h.rel = rel;
      h.trust = clamp(h.trust + (rel > 1.15 ? -(rel - 1) * 0.15 : (1 - rel) * 0.05), 0, 1);
      layers.forEach((o) => {
        const how = sight(h.layer, o.i);
        if (!how) return;
        const ratio = (o.effortWin / Math.max(1, people(o.i))) / Math.max(0.01, avg);
        if (how === 'clear') h.belief[o.i] += (clamp(0.5 + (ratio - 1) * 0.6 + (R() - 0.5) * 0.15, 0, 1) - h.belief[o.i]) * 0.6;
        else if (how === 'hazy') h.belief[o.i] += (clamp(0.5 + o.grew * 1.2 + (R() - 0.5) * 0.6, 0, 1) - h.belief[o.i]) * 0.4;
        else {
          h.belief[o.i] += (clamp(0.5 + o.grew * 1.2 + (R() - 0.5), 0, 1) - h.belief[o.i]) * 0.4 * h.imagination;
          h.belief[o.i] += (PRIOR_UP - h.belief[o.i]) * (1 - h.imagination) * 0.35;
        }
      });
      if (rel > 1.25) say(h, 'complain');
      else if (h.trust < 0.3 && state.voiceLevel >= 2 && R() < 0.5) voice(h, 'say', pick(R, VOICES.insult[h.style].slice(0, state.voiceLevel >= 3 ? 2 : 1)), { cat: 'insult' });
      else if (rel < 0.7 && h.trust > 0.5 && R() < 0.3) say(h, 'thanks');
      const known = layers.filter((o) => sight(h.layer, o.i)).map((o) => o.i);
      const upLow = known.filter((o) => layers[o].ring < layers[h.layer].ring).sort((a, b) => h.belief[a] - h.belief[b])[0];
      const low = known.sort((a, b) => h.belief[a] - h.belief[b])[0];
      const target = upLow !== undefined && h.belief[upLow] < 0.45 && R() < 0.6 ? upLow : low;
      if (target !== undefined && h.belief[target] < (target === upLow ? 0.45 : 0.4) && state.voiceLevel >= 1 && R() < 0.5) {
        // 本当に手が止まっていたか：その 5 日、その池の一人あたりの働きが、山全体の平均の 8 割に届かなかったか
        const truth = layers[target].effortWin / Math.max(1, people(target)) < avg * 0.8;
        const dir = layers[target].ring > layers[h.layer].ring ? 'down' : layers[target].ring < layers[h.layer].ring ? 'up' : 'same';
        const bank = dir === 'up' ? VOICES.accuseUp : dir === 'down' ? VOICES.accuseDown : VOICES.accuse;
        voice(h, 'say', pick(R, bank[h.style]).replace('{L}', L(target)), { cat: 'accuse', about: target, dir, truth });
      }
    }
    layers.forEach((l) => { l.effortWin = 0; l.capMark = l.cap; });
    state.shareWin.fill(0);
  }

  // ---------- 一歩進める ----------
  let nextJudge = 5;
  function tick(dt, shares) {
    out = [];
    if (state.done || state.surge?.pending) return out; // 太った滝の行き先を待っている間は止まる
    state.day += dt;
    voiceGap -= dt;
    for (const e of events) {
      if (!e.started && state.day >= e.day) {
        e.started = true;
        if (e.type === 'surge') { state.surge = { ...e, pending: true, until: e.day + e.len }; out.push({ type: 'surge', e: state.surge }); return out; }
        state.active.push({ ...e, until: e.day + e.len }); out.push({ type: 'drought', e });
      }
    }
    state.active = state.active.filter((a) => a.until > state.day);
    if (state.surge && !state.surge.pending && state.surge.until <= state.day) { state.surge = null; out.push({ type: 'surgeEnd' }); }
    // 1. 滝の水（絞ると決めた池は半分に）
    let fall = FALL.base + FALL.rise * (state.day / DAYS) + FALL.wave * Math.sin(state.day / 9);
    if (state.active.some((a) => a.type === 'drought')) fall *= 0.45;
    state.fallNow = fall;
    state.easing = state.easing.filter((e) => e.until > state.day);
    const w = shares.map((x, i) => x * (state.easing.some((e) => e.basin === i) ? 0.5 : 1));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    state.flow = w.map((x) => fall * x / sum);
    layers.forEach((l, i) => { const in_ = state.flow[i] * dt; l.level += in_; l.received += in_; state.shareWin[i] += in_; });
    if (state.surge && !state.surge.pending) {
      const per = state.surge.amount * dt / state.surge.targets.length;
      state.surge.targets.forEach((i) => { layers[i].level += per; layers[i].received += per; state.shareWin[i] += per; });
    }
    // 2. 水門の受け渡し（認めた申し出）
    state.sluices = state.sluices.filter((s) => s.until > state.day);
    for (const s of state.sluices) {
      const a = layers[s.from], b = layers[s.to];
      const m = Math.min(s.rate * dt, Math.max(0, a.level - 0.5));
      a.level -= m; b.level += m; b.received += m; s.moved += m;
    }
    // 3. 内側の段から順に、溢れと崩壊
    for (const l of layers) {
      if (l.level > l.cap) {
        const spill = l.level - l.cap;
        l.level = l.cap;
        l.spillRate = spill / dt;
        if (l.overflowing <= 0) { l.overflows++; out.push({ type: 'overflow', i: l.i }); const down = homes.filter((h) => h.layer === l.down); if (down.length) say(pick(R, down), 'overflow', l.name); }
        l.overflowing = 1;
        l.health -= spill * 0.03;
        pour(l.i, spill, 'overflow');
      } else { l.overflowing = Math.max(0, l.overflowing - dt * 2); if (l.overflowing <= 0) l.spillRate = 0; }
      // 水かさが高さに近いほど傷む。何もしなくても少しずつ傷む
      const r = l.level / l.cap;
      l.health -= ((r > 0.8 ? (r - 0.8) * 0.3 : 0) + 0.002) * dt;
      if (l.health < CRACK && !l.cracked) { l.cracked = true; out.push({ type: 'crack', i: l.i }); }
      if (l.health >= CRACK + 0.1) l.cracked = false;
      l.health = Math.max(0, l.health);
      if (l.health <= 0 && l.cap > 4) {
        // 崩壊：抱えていた水がまるごと外の段へ
        const outW = l.level * 0.9;
        sink(l.i, l.cap * 0.75);
        l.level -= outW; l.collapses++;
        l.cap = Math.max(3, l.cap * 0.55); l.health = 0.55; l.cracked = false;
        out.push({ type: 'collapse', i: l.i, out: outW });
        homes.filter((h) => h.layer === l.down).forEach((h) => { h.trust = clamp(h.trust - 0.08, 0, 1); });
        const down = homes.filter((h) => h.layer === l.down);
        if (down.length) say(pick(R, down), 'cascade', l.name, {}, true);
        homes.filter((h) => h.refusedAt?.basin === l.i && state.day - h.refusedAt.day < 15).forEach((h) => { h.trust = clamp(h.trust - 0.2, 0, 1); });
        pour(l.i, outW, 'collapse');
      }
    }
    // 4. 川へ抜けて落ち着いた水かさで、家の章が沈む
    layers.forEach((l, i) => { l.level = Math.max(0, l.level - (DRAIN + DRAIN_K * l.level) * dt); sink(i, l.level); });
    state.townWater.forEach((x, k) => { if (x > 0.2) { state.townDays += dt; state.townDaysBy[k] += dt; state.townTrust = Math.max(0, state.townTrust - 0.012 * dt); } });
    state.townWater = state.townWater.map((x) => Math.max(0, x - 0.6 * dt));
    state.townWater.forEach((x, k) => { if (x < 0.2 && state.townWet[k]) { state.townWet[k] = false; out.push({ type: 'townDry', sector: k }); } });
    // 5. 欠片に気づく：下の池と、同じ段の隣。自分の池がもたない人は水門を絞ってほしいと頼む
    for (const l of layers) {
      if (l.health >= CRACK) continue;
      for (const h of homes.filter((x) => x.layer === l.down)) {
        if (R() > h.foresight * 0.25 * dt) continue;
        voice(h, 'inner', pick(R, VOICES.crack).replace('{L}', l.name));
        const d = layers[h.layer];
        if (d.level / d.cap < 0.75) request('take', l.i, d.i, h, 0.45, 4);
      }
      for (const si of l.side) {
        const sl = layers[si];
        if (sl.level / sl.cap > 0.55) continue;
        const h = homes.filter((x) => x.layer === si && R() < (1 - x.selfish) * 0.06 * dt)[0];
        if (h) request('lateral', l.i, si, h, 0.4, 4);
      }
      const mine = homes.filter((x) => x.layer === l.i && R() < 0.08 * dt)[0];
      if (mine) request('ease', l.i, l.i, mine, 0, 5);
    }
    state.requests.filter((q) => q.expires <= state.day).forEach((q) => { state.requests.splice(state.requests.indexOf(q), 1); out.push({ type: 'expire', q }); });
    // 6. 働く
    for (const h of homes) {
      h.quiet -= dt;
      h.next -= dt;
      if (h.next <= 0) { h.next = DECIDE * (0.8 + R() * 0.4); decide(h); }
      const l = layers[h.layer];
      const burden = clamp(l.level / l.cap, 0, 1.2);
      const labor = h.members * LABOR * (1 - 0.5 * Math.min(1, burden)) * (1 - 0.4 * h.fatigue) * dt;
      if (h.action === 'stack') {
        h.progress += labor * STACK * (0.5 + 0.5 * Math.min(1.5, h.means));
        if (h.progress >= 1) { h.progress = 0; h.blocks.push({ ...NEW_ROOM, sunk: false, day: Math.floor(state.day) }); out.push({ type: 'block', home: h.id }); }
        h.fatigue = Math.min(1, h.fatigue + 0.05 * dt);
      } else if (h.action === 'reinforce') {
        const g = BUILD * labor * h.means; l.cap += g; l.built += g; l.health = Math.min(1, l.health + REPAIR * labor); l.effort += labor; l.effortWin += labor;
        h.fatigue = Math.min(1, h.fatigue + 0.06 * (0.5 + burden) * dt);
      } else if (h.action === 'help') {
        const o = layers[h.target];
        const g = BUILD * labor * h.means * 0.85; o.cap += g; o.built += g; o.health = Math.min(1, o.health + REPAIR * labor * 0.85);
        o.effort += labor * 0.5; o.effortWin += labor * 0.5; l.effort += labor * 0.5; l.effortWin += labor * 0.5;
        h.fatigue = Math.min(1, h.fatigue + 0.06 * dt);
      } else h.fatigue = Math.max(0, h.fatigue - 0.15 * dt);
    }
    layers.forEach((l) => { l.cap = Math.max(3, l.cap - 0.012 * dt); l.grew = l.cap - l.capMark; });
    // 7. 見立てと声
    if (state.day >= nextJudge) { nextJudge += 5; judge(); }
    if (state.day >= DAYS) { state.done = true; out.push({ type: 'done' }); }
    return out;
  }

  // 太った滝を受ける池（または池のまとまり）を決める
  function routeSurge(targets) {
    if (!state.surge) return;
    state.surge.targets = targets; state.surge.pending = false;
    homes.filter((h) => targets.includes(h.layer)).forEach((h) => { h.trust = clamp(h.trust - 0.1 / Math.sqrt(targets.length), 0, 1); });
  }

  return {
    state, tick, answer, routeSurge, sight, people, sunkCount, N, S,
    ringPeople: (ring) => layers.filter((l) => l.ring === ring).reduce((s, l) => s + people(l.i), 0),
  };
}

export function trustAll(sim) {
  const { homes } = sim.state;
  const ppl = homes.reduce((s, h) => s + h.members, 0);
  return (homes.reduce((s, h) => s + h.trust * h.members, 0) + sim.state.townTrust * TOWN_PEOPLE) / (ppl + TOWN_PEOPLE);
}

// 結果の数字
export function summarize(sim) {
  const { layers, homes } = sim.state;
  const capNow = layers.reduce((s, l) => s + l.cap, 0), cap0 = layers.reduce((s, l) => s + l.cap0, 0);
  return {
    sunk: layers.reduce((s, l) => s + l.sunk, 0),
    overflows: layers.reduce((s, l) => s + l.overflows, 0),
    collapses: layers.reduce((s, l) => s + l.collapses, 0),
    displaced: homes.filter((h) => h.displaced).length,
    town: sim.state.town, townDays: sim.state.townDays,
    growth: capNow - cap0,
    // 信頼は、山の人とふもとの町の人を人数で平均する
    trust: trustAll(sim),
    townTrust: sim.state.townTrust,
    byRing: RINGS.map((g, ring) => {
      const ls = layers.filter((l) => l.ring === ring);
      return { name: g.name, received: ls.reduce((s, l) => s + l.received, 0), sunk: ls.reduce((s, l) => s + l.sunk, 0), overflows: ls.reduce((s, l) => s + l.overflows, 0), collapses: ls.reduce((s, l) => s + l.collapses, 0), cap: ls.reduce((s, l) => s + l.cap, 0) / ls.length, people: sim.ringPeople(ring), effort: ls.reduce((s, l) => s + l.effort, 0) };
    }),
  };
}

// AI の水門番。同じ山・同じ滝を、決まった方針で最後まで回す
export const POLICIES = {
  equal: { label: '平等に分け、申し出は受ける', shares: (sim) => sim.state.layers.map(() => 1), answer: () => true, surge: () => GROUPS.all() },
  room: { label: '空いている池へ流し、申し出は受ける', shares: (sim) => sim.state.layers.map((l) => Math.max(0.2, l.cap - l.level)), answer: () => true, surge: (sim) => [[...sim.state.layers].sort((a, b) => (b.cap - b.level) - (a.cap - a.level))[0].i] },
  many: { label: '人の多い池を守り、申し出は断る', shares: (sim) => sim.state.layers.map((l) => 1 / Math.max(1, sim.people(l.i))), answer: () => false, surge: (sim) => [[...sim.state.layers].sort((a, b) => sim.people(a.i) - sim.people(b.i))[0].i] },
  top: { label: '上段に多く受けさせ、申し出は断る', shares: (sim) => sim.state.layers.map((l) => [3, 2, 1][l.ring]), answer: () => false, surge: () => GROUPS.ring(0) },
};
export function runPolicy(seed, key, opts) {
  const sim = createSim(seed, opts);
  const p = POLICIES[key];
  let shares = p.shares(sim), nextShares = 1;
  let guard = 0;
  while (!sim.state.done && guard++ < 100000) {
    if (sim.state.surge?.pending) sim.routeSurge(p.surge(sim));
    for (const q of [...sim.state.requests]) sim.answer(q.id, p.answer(q));
    sim.tick(0.25, shares);
    if (sim.state.day >= nextShares) { shares = p.shares(sim); nextShares += 1; }
  }
  return summarize(sim);
}
