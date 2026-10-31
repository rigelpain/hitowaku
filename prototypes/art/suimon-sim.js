// 水門番の仕組み（画面なし）。天の滝を水門で 12 の池（3 段 × 4 方角）へ振り分ける。
// 池のダムが耐えられなければ決壊し、同じ方角のひとつ外の段へ流れ込む。いちばん外が切れると、その方角のふもとの町が浸かる。
// 世帯は空いた手で、自分の家を積み足すか（自分への備え）、ダムを補強するか（みんなへの備え）、よその池を手伝うか、休むかを選ぶ。
import { RINGS, SECTORS, HOMES, FAMILY, GIVEN, FACTS, WALLS, CHAPTERS, NEW_ROOM, TEMP_ROOM, VOICES } from './suimon-data.js';

export const SEASONS = 8;
const DRAIN = 1.6;     // 季節ごとに池から川へ抜ける水（水かさが高いほど DRAIN_K の割合で多く抜ける）
const DRAIN_K = 0.3;
const AGING = 0.25;    // 手入れしないとダムは低くなる
const BUILD = 0.22;    // 補強の効き
const FALL = [24, 40]; // 滝の水の量（12 の池の合計）。季節ごとに FALL_UP ずつ太る
const FALL_UP = 1.8;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const S = SECTORS.length, N = RINGS.length * S;
export const basinIndex = (ring, sector) => ring * S + sector;

export function createSim(seed, { voiceLevel = 2 } = {}) {
  const R = rng(seed);
  let deck = [];
  const draw = (n) => { const out = []; while (out.length < n) { if (!deck.length) deck = [...CHAPTERS].sort(() => R() - 0.5); out.push(deck.pop()); } return out; };
  // 池。内側の段から順に並べる（決壊は内から外へ伝わる）
  const layers = [];
  RINGS.forEach((g, ring) => SECTORS.forEach((sec, sector) => {
    const i = basinIndex(ring, sector);
    layers.push({ i, ring, sector, name: `${sec}の${g.name}`, cap: g.cap + (R() - 0.5), cap0: 0, res: g.res, level: 2, bursts: 0, received: 0, sunk: 0, built: 0, effort: [], down: ring + 1 < RINGS.length ? basinIndex(ring + 1, sector) : null, up: ring > 0 ? basinIndex(ring - 1, sector) : null });
  }));
  layers.forEach((l) => { l.cap0 = l.cap; });
  // 世帯：名前のある 12 世帯と、池ごとに 1〜2 世帯
  // 名前は山から引く。足りなくなったら切り直す
  const deckOf = (arr) => { let d = []; return () => { if (!d.length) d = [...arr].sort(() => R() - 0.5); return d.pop(); }; };
  const nextFamily = deckOf(FAMILY), nextGiven = deckOf(GIVEN);
  const born = [];
  HOMES.forEach((h) => born.push({ ...h, layer: basinIndex(h.ring, h.sector) }));
  layers.forEach((l) => {
    // 外の段ほど池が広く、人が多い
    const extra = [1, 2, 3][l.ring] + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < extra; k++) {
      const fam = nextFamily(), given = nextGiven();
      const [m0, m1] = RINGS[l.ring].members;
      const facts = [pick(R, FACTS)]; if (R() < 0.35) { const f2 = pick(R, FACTS); if (f2 !== facts[0]) facts.push(f2); }
      born.push({ id: `g${l.i}_${k}`, layer: l.i, ring: l.ring, sector: l.sector, name: `${fam} ${given}`, age: 22 + Math.floor(R() * 60), members: m0 + Math.floor(R() * (m1 - m0 + 1)), style: pick(R, ['polite', 'plain', 'plain', 'rough']), facts, wall: pick(R, WALLS) });
    }
  });
  const homes = born.map((h) => ({
    ...h, home: h.layer,
    blocks: draw(6 + Math.floor(R() * 3)).map((c) => ({ ...c, sunk: false })),
    selfish: 0.15 + R() * 0.55, diligence: 0.35 + R() * 0.55,
    // 見通し：水は増え続けると思っているか（低いと、水が来てから慌てる）。余力：資材や蓄え
    foresight: 0.1 + R() * 0.85, means: RINGS[h.ring].res * (0.7 + R() * 0.6),
    // 想像する力：見えない池の暮らしを思い描けるか。上の段ほど強く、下の段ほど弱い
    imagination: clamp([0.7, 0.5, 0.32][h.ring] + (R() - 0.5) * 0.4, 0.05, 0.95),
    trust: 0.6, fatigue: 0, displaced: 0,
    // よその池がどれだけ働いているかの見立て（本当とは限らない）
    belief: Array(N).fill(0.6),
    action: null, target: null, sunkNow: [],
  }));
  // 最初から下の二段は水の中（町はもう沈みはじめている）
  homes.forEach((h) => { h.blocks[0].sunk = true; h.blocks[1].sunk = true; });
  const FOUNDATION = { n: '土台', foundation: true, sunk: true };
  const surgeSeasons = new Set();
  while (surgeSeasons.size < 3) surgeSeasons.add(1 + Math.floor(R() * (SEASONS - 1)));
  const forecasts = Array.from({ length: SEASONS }, (_, k) => {
    const mid = FALL[0] + R() * (FALL[1] - FALL[0]) + k * FALL_UP;
    return { lo: Math.round(mid - 5), hi: Math.round(mid + 5), actual: mid - 5 + R() * 10 };
  });
  const state = { season: 0, layers, homes, history: [], voiceLevel, done: false, town: 0, towns: Array(S).fill(0) };

  const sunkCount = (h) => h.blocks.filter((b) => b.sunk).length;
  const people = (i) => homes.filter((h) => h.layer === i).reduce((s, h) => s + h.members, 0);
  const near = (a, b) => layers[a].sector === layers[b].sector || layers[a].ring === layers[b].ring; // 手伝いに行ける池
  // 見え方。上からは同じ方角の下の池がよく見え（clear）、同じ段どうしはダムの高さから推し量り（hazy）、
  // 下からは真上の池がかすかに見えるだけ（faint）。それ以外は見えない（null）
  const sight = (a, b) => {
    if (a === b) return null;
    const A = layers[a], B = layers[b], dr = B.ring - A.ring;
    if (dr > 0) return A.sector === B.sector ? 'clear' : null;
    if (dr === 0) return 'hazy';
    return A.sector === B.sector && dr === -1 ? 'faint' : null;
  };
  const PRIOR_UP = 0.3; // 見えない上の段への思い込み（楽をしている）
  // 見上げる池への見立ては、想像する力が弱いほど、はじめから思い込み寄り
  homes.forEach((h) => layers.forEach((o) => { if (sight(h.layer, o.i) === 'faint') h.belief[o.i] = 0.6 * h.imagination + PRIOR_UP * (1 - h.imagination); }));

  function sink(i, level, ev) {
    for (const h of homes) {
      if (h.layer !== i) continue;
      const depth = Math.floor(level);
      h.blocks.forEach((b, k) => {
        if (k < depth && !b.sunk) { b.sunk = true; if (!b.foundation) { h.sunkNow.push(b); layers[i].sunk++; } ev.push({ type: 'sink', home: h.id, block: k }); }
      });
    }
  }

  // 季節を一つ進める。shares は池ごとの割合、surgeTo は太った滝を受ける池（なければ null）
  function step(shares, surgeTo = null) {
    const f = forecasts[state.season];
    const ev = [];
    const rec = { season: state.season, rain: f.actual, shares: [...shares], surgeTo, inflow: Array(N).fill(0), bursts: [], before: layers.map((l) => ({ level: l.level, cap: l.cap })) };
    homes.forEach((h) => { h.sunkNow = []; h.cascadeFrom = null; h.wasSpared = false; });
    // 1. 滝の水と、太った分
    const sum = shares.reduce((a, b) => a + b, 0) || 1;
    layers.forEach((l, i) => { const w = f.actual * shares[i] / sum; l.level += w; l.received += w; rec.inflow[i] += w; });
    if (surgeTo !== null) {
      const s = 3.5 + R() * 1.5;
      layers[surgeTo].level += s; layers[surgeTo].received += s; rec.inflow[surgeTo] += s; rec.surge = s;
      ev.push({ type: 'surge', layer: surgeTo, amount: s });
    }
    rec.peak = layers.map((l) => l.level);
    // 2. 内側の段から順に、耐えられなければ決壊して外の段へ
    for (const l of layers) {
      if (l.level <= l.cap) continue;
      sink(l.i, l.cap * 0.7, ev);
      const out = l.level * 0.65;
      l.level -= out; l.bursts++;
      l.cap = Math.max(3, l.cap * 0.75);
      rec.bursts.push(l.i);
      if (l.down !== null) {
        layers[l.down].level += out; layers[l.down].received += out;
        homes.filter((h) => h.layer === l.down).forEach((h) => { h.cascadeFrom = l.i; });
      } else { state.town++; state.towns[l.sector]++; rec.town = true; }
      ev.push({ type: 'burst', layer: l.i, out, to: l.down, levels: layers.map((x) => x.level), caps: layers.map((x) => x.cap) });
    }
    // 川へ抜けて落ち着いた水かさで、家の章が沈む
    layers.forEach((l, i) => { l.level = Math.max(0, l.level - (DRAIN + DRAIN_K * l.level)); sink(i, l.level, ev); });
    rec.settled = layers.map((l) => l.level);
    rec.capMid = layers.map((l) => l.cap);
    // 3. 家が全部沈んだ世帯は、空きのある池へ移る
    for (const h of homes) {
      if (!h.blocks.every((b) => b.sunk)) continue;
      const to = layers.filter((l) => l.i !== h.layer).sort((a, b) => (b.cap - b.level) - (a.cap - a.level))[0].i;
      ev.push({ type: 'displace', home: h.id, from: h.layer, to });
      h.layer = to; h.displaced++;
      const base = Math.ceil(layers[to].level);
      h.blocks = [...Array.from({ length: base }, () => ({ ...FOUNDATION })), { ...TEMP_ROOM, sunk: false }, { ...TEMP_ROOM, sunk: false }];
      h.trust = Math.max(0, h.trust - 0.25);
    }
    // 4. 働く。水を多く抱えた池ほど、見張りと汲み出しに手を取られる
    const effort = Array(N).fill(0), capBefore = layers.map((l) => l.cap);
    for (const h of homes) {
      const l = layers[h.layer];
      const burden = clamp(l.level / l.cap, 0, 1.2);
      const labor = h.members * 0.55 * (1 - 0.55 * Math.min(1, burden)) * (1 - 0.4 * h.fatigue);
      const dry = h.blocks.length - sunkCount(h);
      // 先を見る人ほど、これからの水かさで考える
      const ahead = l.level + 1.5 + h.foresight * 3.5;
      const nowRisk = clamp((l.level + 1.5 - sunkCount(h)) / Math.max(1, dry), 0, 1.5);
      const ownRisk = clamp((ahead - sunkCount(h)) / Math.max(1, dry), 0, 1.5);
      const layerRisk = clamp(ahead / l.cap, 0, 1.5);
      // 手伝いに行けるのは、同じ方角か同じ段の池。内側が切れると水が来るので、内側を手伝うのは自分のためでもある
      const others = layers.filter((o) => o.i !== h.layer && near(o.i, h.layer)).map((o) => ({ o, risk: clamp((o.level + 2.5) / o.cap, 0, 1.5) * (o.i === l.up ? 1.3 : o.sector === l.sector ? 0.8 : 0.6) }));
      const worst = others.sort((a, b) => b.risk - a.risk)[0];
      const score = {
        // 家を高くする（自分への備え）：余力があるほどしやすい
        stack: (h.selfish * 0.8 + 0.3) * ownRisk * (0.5 + 0.5 * Math.min(1.5, h.means)) + 0.02,
        // ダムを強くする（みんなへの備え）：先を見ていて、身勝手でない人ほど
        reinforce: ((1 - h.selfish) * 0.6 + h.diligence * 0.5) * layerRisk * (0.6 + h.foresight * 0.6) + 0.05,
        help: (1 - h.selfish) * h.diligence * 0.8 * worst.risk * (worst.risk > layerRisk ? 1 : 0.3) + 0.01,
        rest: (1 - h.diligence) * 0.7 + h.fatigue * 0.8,
      };
      let total = 0; for (const k in score) { score[k] = score[k] ** 1.6; total += score[k]; }
      let x = R() * total, act = 'rest';
      for (const k in score) { x -= score[k]; if (x <= 0) { act = k; break; } }
      h.action = act; h.target = null;
      h.why = act === 'stack' ? (nowRisk > 0.7 ? 'late' : 'early') : null;
      if (act === 'stack') {
        h.blocks.push({ ...NEW_ROOM, sunk: false, season: state.season });
        h.fatigue = Math.min(1, h.fatigue + 0.25);
      } else if (act === 'reinforce') {
        const g = BUILD * labor * h.means; l.cap += g; l.built += g; effort[h.layer] += labor;
        h.fatigue = Math.min(1, h.fatigue + 0.3 * (0.5 + burden));
      } else if (act === 'help') {
        const o = worst.o; h.target = o.i;
        const g = BUILD * labor * h.means * 0.85; o.cap += g; o.built += g; effort[o.i] += labor * 0.5; effort[h.layer] += labor * 0.5;
        h.fatigue = Math.min(1, h.fatigue + 0.3);
      } else h.fatigue = Math.max(0, h.fatigue - 0.5);
    }
    // 5. 手入れのないダムは低くなる
    layers.forEach((l) => { l.cap = Math.max(3, l.cap - AGING); l.effort.push(effort[l.i]); });
    // 6. 水門番への信頼と、よその池の見立て。rel は公平な取り分を 1 としたときの受けた水
    const tot = rec.inflow.reduce((a, b) => a + b, 0) || 1;
    rec.rel = rec.inflow.map((w) => w / tot * N);
    const avgEffort = effort.reduce((a, b) => a + b, 0) / Math.max(1, homes.reduce((s2, x) => s2 + x.members, 0));
    for (const h of homes) {
      const rel = rec.rel[h.layer];
      h.trust += rel > 1.15 ? -(rel - 1) * 0.3 : (1 - rel) * 0.12;
      if (surgeTo === h.layer) h.trust -= 0.12;
      h.trust -= h.sunkNow.length * 0.06;
      if (rel < 0.75 && !h.sunkNow.length) h.wasSpared = true;
      h.trust = clamp(h.trust, 0, 1);
      // よその池の働きぶりの見立て。見え方で確かさが変わる
      layers.forEach((o) => {
        const how = sight(h.layer, o.i);
        if (!how) return;
        const grew = o.cap - capBefore[o.i];
        if (how === 'clear') {
          // 見下ろせば、手が動いているかがそのまま見える
          const ratio = (effort[o.i] / Math.max(1, people(o.i))) / Math.max(0.01, avgEffort);
          const seen = clamp(0.5 + (ratio - 1) * 0.6 + (R() - 0.5) * 0.15, 0, 1);
          h.belief[o.i] += (seen - h.belief[o.i]) * 0.6;
        } else if (how === 'hazy') {
          // 同じ段どうしは、ダムの高さの変わり方から推し量る。外れることもある
          const seen = clamp(0.5 + grew * 0.5 + (R() - 0.5) * 0.6, 0, 1);
          h.belief[o.i] += (seen - h.belief[o.i]) * 0.4;
        } else {
          // 見上げても、ほとんど見えない。想像する力が弱いと「上は楽をしている」に寄っていく
          const seen = clamp(0.5 + grew * 0.5 + (R() - 0.5) * 1.0, 0, 1);
          h.belief[o.i] += (seen - h.belief[o.i]) * 0.4 * h.imagination;
          h.belief[o.i] += (PRIOR_UP - h.belief[o.i]) * (1 - h.imagination) * 0.35;
        }
      });
    }
    rec.after = layers.map((l) => ({ level: l.level, cap: l.cap }));
    rec.effort = effort;
    rec.voices = voices(rec);
    state.history.push(rec);
    state.season++;
    if (state.season >= SEASONS) state.done = true;
    return { ev, rec };
  }

  // その季節に聞こえてくる声。重みの大きいものから、一世帯一つまで
  function voices(rec) {
    const out = [], r = R;
    const L = (i) => layers[i].name;
    for (const h of homes) {
      const c = [];
      if (h.sunkNow.length) c.push({ w: 2.4, kind: 'muse', text: h.sunkNow[h.sunkNow.length - 1].m });
      if (h.cascadeFrom !== null) c.push({ w: 3.2, kind: 'say', cat: 'cascade', text: pick(r, VOICES.cascade[h.style]).replace('{L}', L(h.cascadeFrom)) });
      if (rec.rel[h.layer] > 1.2 || rec.surgeTo === h.layer) c.push({ w: (1 - h.trust) * 3 + 0.5, kind: 'say', cat: 'complain', text: pick(r, VOICES.complain[h.style]) });
      if (h.trust < 0.3 && state.voiceLevel >= 2) c.push({ w: 2.2, kind: 'say', cat: 'insult', text: pick(r, VOICES.insult[h.style].slice(0, state.voiceLevel >= 3 ? 2 : 1)) });
      const known = layers.filter((o) => sight(h.layer, o.i)).map((o) => o.i);
      const low = known.sort((a, b) => h.belief[a] - h.belief[b])[0];
      // 見上げての思い込みは、確かめようがないぶん口に出やすい
      const upLow = known.filter((o) => layers[o].ring < layers[h.layer].ring).sort((a, b) => h.belief[a] - h.belief[b])[0];
      const target = upLow !== undefined && h.belief[upLow] < 0.45 && R() < 0.6 ? upLow : low;
      if (target !== undefined && h.belief[target] < (target === upLow ? 0.45 : 0.4) && state.voiceLevel >= 1) {
        const low2 = target;
        // 本当に手が止まっていたか：その季節、その池の一人あたりの働きが、山全体の平均の 8 割に届かなかったか
        const avg = rec.effort.reduce((a, b) => a + b, 0) / Math.max(1, homes.reduce((s2, x) => s2 + x.members, 0));
        const truth = rec.effort[low2] / Math.max(1, people(low2)) < avg * 0.8;
        const dir = layers[low2].ring > layers[h.layer].ring ? 'down' : layers[low2].ring < layers[h.layer].ring ? 'up' : 'same';
        const bank = dir === 'up' ? VOICES.accuseUp : dir === 'down' ? VOICES.accuseDown : VOICES.accuse;
        c.push({ w: dir === 'up' ? 1.7 : 1.6, kind: 'say', cat: 'accuse', about: low2, dir, truth, text: pick(r, bank[h.style]).replace('{L}', L(low2)) });
      }
      if (h.wasSpared && h.trust > 0.5) c.push({ w: 1, kind: 'say', cat: 'thanks', text: pick(r, VOICES.thanks[h.style]) });
      if (h.action === 'stack') c.push({ w: 1.1, kind: 'inner', text: pick(r, h.why === 'late' ? VOICES.stackLate : VOICES.stackEarly) });
      if (h.action === 'reinforce' && h.foresight > 0.7) c.push({ w: 0.9, kind: 'inner', text: pick(r, VOICES.pool) });
      if (h.action === 'rest') c.push({ w: 0.7, kind: 'inner', text: pick(r, VOICES.rest) });
      if (h.action === 'help') c.push({ w: 1, kind: 'say', cat: 'help', text: pick(r, VOICES.help[h.style]).replace('{L}', L(h.target)) });
      if (h.action === 'reinforce') c.push({ w: 0.4, kind: 'inner', text: pick(r, VOICES.reinforce) });
      if (!c.length) continue;
      const best = c.sort((a, b) => b.w - a.w)[0];
      out.push({ home: h.id, name: h.name, layer: h.layer, w: best.w + r() * 0.5, ...best });
    }
    out.sort((a, b) => b.w - a.w);
    // 同じ種類の声ばかりにならないよう、種類ごとに数を絞る
    const quota = { muse: 3, cascade: 2, complain: 3, 'accuse-up': 2, 'accuse-down': 2, 'accuse-same': 1, insult: 2, thanks: 1, help: 1, inner: 3 };
    const used = {};
    const limit = state.voiceLevel === 0 ? 4 : 9;
    const said = new Set();
    return out.filter((v) => {
      if (said.has(v.text)) return false;
      said.add(v.text);
      if (state.voiceLevel === 0 && v.kind === 'say' && v.cat !== 'thanks' && v.cat !== 'help') return false;
      const k = v.cat === 'accuse' ? `accuse-${v.dir}` : (v.cat || v.kind);
      used[k] = (used[k] || 0) + 1;
      return used[k] <= (quota[k] ?? 1);
    }).slice(0, limit);
  }

  return {
    state, step, forecasts, surgeSeasons, N, S,
    hasSurge: () => surgeSeasons.has(state.season),
    forecast: () => forecasts[state.season],
    people, sunkCount, sight,
    ringPeople: (ring) => layers.filter((l) => l.ring === ring).reduce((s, l) => s + people(l.i), 0),
  };
}

// 結果の数字
export function summarize(sim) {
  const { layers, homes } = sim.state;
  const capNow = layers.reduce((s, l) => s + l.cap, 0), cap0 = layers.reduce((s, l) => s + l.cap0, 0);
  return {
    sunk: layers.reduce((s, l) => s + l.sunk, 0),
    bursts: layers.reduce((s, l) => s + l.bursts, 0),
    displaced: homes.filter((h) => h.displaced).length,
    town: sim.state.town,
    growth: capNow - cap0,
    trust: homes.reduce((s, h) => s + h.trust, 0) / homes.length,
    byRing: RINGS.map((g, ring) => {
      const ls = layers.filter((l) => l.ring === ring);
      return { name: g.name, received: ls.reduce((s, l) => s + l.received, 0), sunk: ls.reduce((s, l) => s + l.sunk, 0), bursts: ls.reduce((s, l) => s + l.bursts, 0), cap: ls.reduce((s, l) => s + l.cap, 0) / ls.length, people: sim.ringPeople(ring), effort: ls.reduce((s, l) => s + l.effort.reduce((a, b) => a + b, 0), 0) };
    }),
    byBasin: layers.map((l) => ({ name: l.name, received: l.received, sunk: l.sunk, bursts: l.bursts, cap: l.cap })),
  };
}

// AI の水門番。同じ seed の谷を、決まった方針で最後まで回す
export const POLICIES = {
  equal: { label: '平等に分ける', shares: (sim) => sim.state.layers.map(() => 1), surge: (sim) => sim.state.season % sim.N },
  room: { label: '空いている池へ', shares: (sim) => sim.state.layers.map((l) => Math.max(0.2, l.cap - l.level)), surge: (sim) => [...sim.state.layers].sort((a, b) => (b.cap - b.level) - (a.cap - a.level))[0].i },
  many: { label: '人の多い池を守る', shares: (sim) => sim.state.layers.map((l) => 1 / Math.max(1, sim.people(l.i))), surge: (sim) => [...sim.state.layers].sort((a, b) => sim.people(a.i) - sim.people(b.i))[0].i },
  top: { label: '上段に多く受けさせる', shares: (sim) => sim.state.layers.map((l) => [3, 2, 1][l.ring]), surge: (sim) => basinIndex(0, sim.state.season % sim.S) },
};
export function runPolicy(seed, key, opts) {
  const sim = createSim(seed, opts);
  const p = POLICIES[key];
  while (!sim.state.done) sim.step(p.shares(sim), sim.hasSurge() ? p.surge(sim) : null);
  return summarize(sim);
}
