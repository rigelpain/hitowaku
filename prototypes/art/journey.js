// 旅の一場面（仮組み）。一行が歩き、川で舟が足りず、話し合って多数決で一人と別れる。
import * as THREE from 'three';
import { colorDither } from './post.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { makePerson } from './person.js';
import { createMinds } from './mind.js';
import { ground, water as waterMat, wood, foliage, stone, cloth, shared } from './materials.js';

const PALETTE = ['#EDE6D3', '#1E1B22', '#2C3E66', '#3F7A78', '#9DB08A', '#7FA05E', '#4F7A44', '#2F4A2C', '#D9A441', '#D6C094', '#9EC1CF', '#7A5236', '#4A3426', '#8C8A86', '#B9845A', '#E8CDB0', '#C2503A', '#7A5A98', '#4C7FB8', '#E0B13E', '#D4AE90'];
const MOOD0 = { tension: 0, sorrow: 0, warmth: 0.15, hope: 0 };

// ---------- 歩き方 ----------
// 一行の進む速さ。人はそれぞれの性格で、この速さのまわりを行ったり来たりする。
const PACE = 1.4;
// kind：行き先と速さの選び方（drift は、目と心で道筋がぶれる歩き方）。stride：歩幅。swing：腕の振り。lean：前かがみ。bounce：上下動。
// accel：速さの変わりやすさ。turn：曲がる速さ（小さいほど大回り）。lane：道の中での位置。spot：止まったときの立ち位置のずれ。
const GAIT = {
  toru:  { kind: 'steady',   stride: 1.0,  swing: 0.8,  lean: 0.03,  bounce: 1.0, accel: 3,   turn: 4,   pace: 1.0, lane: -0.25, spot: [0, -0.45] },
  akari: { kind: 'hurry',    stride: 0.7,  swing: 0.35, lean: 0.12,  bounce: 1.4, accel: 6,   turn: 6,   pace: 1.3, lane: 0.3,   spot: [0.1, 0.5] },
  fumio: { kind: 'drift',    stride: 0.6,  swing: 0.25, lean: 0.06,  bounce: 0.5, accel: 1.2, turn: 2,   pace: 0.8, lane: -0.2,  spot: [0.2, -0.6] },
  yuma:  { kind: 'wander',   stride: 1.15, swing: 1.25, lean: -0.04, bounce: 1.7, accel: 2.5, turn: 1.6, pace: 1.1, lane: 0,     spot: [-0.2, 1.2] },
  nagi:  { kind: 'hesitant', stride: 0.75, swing: 0.3,  lean: 0.07,  bounce: 0.7, accel: 2,   turn: 3,   pace: 0.9, lane: 0.5,   spot: [-0.9, 0.9] },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 世界 ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createJourney(canvas, ui, { seed = 7, policies = {} } = {}) {
  const R = rng(seed);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EDE6D3');
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });

  // 道は z = 5 を通る。カメラに映る範囲の外まで地面を敷き、端の断崖が見えないようにする
  const LEN = 64, RIVER = [36, 40];
  const X0 = -16, X1 = LEN + 12, Z0 = -14, Z1 = 24;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const grass = ground('#7FA05E', '#7A5A3C', 'grass'), path = ground('#D6C094', '#7A5A3C', 'path'), water = waterMat('#3F7A78'), sand = ground('#D6C094', '#8A6A48', 'sand');
  const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
  // 道から離れるほど起伏を大きくする（手前側は人を隠さないよう低く抑える）
  const lattice = new Map();
  const at = (i, j) => { const k = i + ',' + j; if (!lattice.has(k)) lattice.set(k, R()); return lattice.get(k); };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  const heights = new Map();
  const heightAt = (x, z) => heights.get(x + ',' + z) ?? 1;
  const isBank = (x) => x === RIVER[0] - 1 || x === RIVER[1] + 1;
  const tileMats = { grass: [], path: [], water: [], sand: [] };
  const m4 = new THREE.Matrix4();
  for (let x = X0; x < X1; x++) {
    for (let z = Z0; z < Z1; z++) {
      const inRiver = x >= RIVER[0] && x <= RIVER[1];
      const onPath = Math.abs(z - 5) <= 0.6;
      let h = 1;
      if (inRiver) h = 0.55;
      else if (!onPath && !isBank(x)) {
        if (z >= 0 && z <= 10) h += R() < 0.18 ? 0.25 : 0;
        else {
          const far = z < 0 ? Math.min(1, -z / 6) * 0.75 : 0.25;
          h += Math.round(noise(x / 4, z / 4) * far * 4) / 4;
        }
      }
      heights.set(x + ',' + z, h);
      const kind = inRiver ? 'water' : isBank(x) ? 'sand' : onPath ? 'path' : 'grass';
      tileMats[kind].push(m4.clone().compose(new THREE.Vector3(x, h / 2 - 1, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    }
  }
  const instanced = (geo, material, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = cast; im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  instanced(tileGeo, grass, tileMats.grass);
  instanced(tileGeo, path, tileMats.path);
  instanced(tileGeo, sand, tileMats.sand);
  instanced(tileGeo, water, tileMats.water, false);
  // 木と岩。道の脇は元の配置の密度、奥は森、手前はまばら
  const trunk = wood('#6E4A2E', 'y'), leaf = foliage('#4F7A44'), leaf2 = foliage('#6A8F4E'), rock = stone('#9A958A');
  const trunks = [], rocks = [], leaves = [[[], [], []], [[], [], []]];
  const yAxis = new THREE.Vector3(0, 1, 0);
  // 目に入るもの：木・岩の位置。人はこれを見て、思い出したり立ち止まったりする
  const landmarks = [];
  const plant = (x, z) => {
    if (x >= RIVER[0] - 1 && x <= RIVER[1] + 1) return;
    const y = heightAt(x, z) - 1;
    if (R() < 0.75) {
      landmarks.push({ x, z, tag: 'tree' });
      trunks.push(m4.clone().compose(new THREE.Vector3(x, y + 0.35, z), new THREE.Quaternion(), new THREE.Vector3(0.25, 0.7, 0.25)));
      const set = leaves[R() < 0.5 ? 0 : 1];
      for (let k = 0; k < 3; k++) {
        const q = new THREE.Quaternion().setFromAxisAngle(yAxis, R() * 3);
        set[k].push(m4.clone().compose(new THREE.Vector3(x + (R() - 0.5) * 0.06, y + 0.85 + k * 0.38, z + (R() - 0.5) * 0.06), q, new THREE.Vector3(1, 1, 1)));
      }
    } else {
      const s = 0.3 + R() * 0.2;
      landmarks.push({ x, z, tag: 'rock' });
      rocks.push(m4.clone().compose(new THREE.Vector3(x, y + 0.2, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    }
  };
  for (let i = 0; i < 70; i++) plant(Math.floor(R() * LEN), R() < 0.5 ? Math.floor(R() * 3) : 8 + Math.floor(R() * 3));
  for (let x = X0; x < X1; x++) {
    for (let z = Z0; z < 0; z++) if (R() < 0.3) plant(x, z);
    for (let z = 11; z < Z1; z++) if (R() < 0.06) plant(x, z);
  }
  instanced(box, trunk, trunks);
  instanced(new THREE.DodecahedronGeometry(1), rock, rocks);
  [leaf, leaf2].forEach((lm, s) => [0, 1, 2].forEach((k) => instanced(new THREE.ConeGeometry(0.62 - k * 0.15, 0.75, 7), lm, leaves[s][k])));
  // 壊れた橋と舟
  const plank = wood('#857058', 'x');
  [[RIVER[0] - 0.2, 0.5], [RIVER[1] + 0.2, 0.5]].forEach(([x]) => { const p = new THREE.Mesh(box, plank); p.scale.set(1.2, 0.12, 1.4); p.position.set(x, 0.04, 5); p.castShadow = true; scene.add(p); });
  [RIVER[0] + 0.5, RIVER[1] - 0.6].forEach((x) => { const p = new THREE.Mesh(box, plank); p.scale.set(0.2, 0.9, 0.2); p.position.set(x, -0.2, 4.3); scene.add(p); });
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(box, wood('#7A5236', 'x')); hull.scale.set(2.2, 0.35, 1.0); hull.castShadow = true; boat.add(hull);
  const rim = new THREE.Mesh(box, wood('#5C3D27', 'x')); rim.scale.set(2.3, 0.08, 1.1); rim.position.y = 0.2; boat.add(rim);
  boat.position.set(RIVER[0] + 1, -0.32, 6.6);
  scene.add(boat);

  // ---------- 人 ----------
  const PEOPLE = [
    { id: 'toru', name: '渡瀬 透', top: '#7A5A98', bottom: '#4A4A52', hair: '#3A2E25', prop: 'pack', build: 1.15, height: 1.14 },
    { id: 'akari', name: '春日 灯', top: '#C2503A', bottom: '#2C3E66', hair: '#2E2620', prop: 'bucket', build: 0.9, height: 1.06, hairStyle: 'tied' },
    { id: 'fumio', name: '大槻 文雄', top: '#4C7FB8', bottom: '#6E6A62', hair: '#C8C8C0', prop: 'cane', build: 1.0, height: 1.08, stoop: 1, hairStyle: 'bald' },
    { id: 'yuma', name: '森 由真', top: '#E0B13E', bottom: '#3F4A3C', hair: '#3A2E25', prop: 'camera', build: 0.95, height: 1.1, hairStyle: 'long' },
    { id: 'nagi', name: 'ナギ', top: '#3F7A78', bottom: '#5E4630', hair: '#1E1B22', prop: 'none', build: 0.85, height: 0.98 },
  ];
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#1E1B22', side: THREE.BackSide });
  const figures = PEOPLE.map((p, i) => {
    const rig = makePerson(p, outlineMat);
    const g = rig.root;
    g.userData = { ...p, i, rig, bodyMat: rig.topMat, shake: 0, sorrow: 0, x: 0, z: 5, y: 0 };
    scene.add(g);
    return g;
  });
  // 荷車
  const cart = new THREE.Group();
  const cbox = new THREE.Mesh(box, wood('#8A6440', 'x')); cbox.scale.set(1.2, 0.45, 0.8); cbox.position.y = 0.45; cbox.castShadow = true; cart.add(cbox);
  const load = new THREE.Mesh(box, mat('#D9C79A')); load.scale.set(1.0, 0.35, 0.65); load.position.y = 0.82; load.castShadow = true; cart.add(load);
  [[-0.4, 0.45], [0.4, 0.45], [-0.4, -0.45], [0.4, -0.45]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), mat('#3A2E25')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.2, z); cart.add(w); });
  scene.add(cart);

  // 雨（悲しみの演出）
  const RAIN = 500;
  const rainPos = new Float32Array(RAIN * 6);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#C9DCE6', transparent: true, opacity: 0 }));
  scene.add(rain);
  const drops = Array.from({ length: RAIN }, () => ({ x: R() * 14 - 7, y: R() * 8, z: R() * 11 }));

  scene.add(new THREE.HemisphereLight('#FFF4E0', '#7A8A6A', 1.6));
  const sun = new THREE.DirectionalLight('#FFE2B8', 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 60 });
  scene.add(sun); scene.add(sun.target);

  // ---------- カメラと後処理 ----------
  let cam, fx, W, H;
  function size() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    const a = W / H, s = a < 1 ? 4.4 / a : 4.6;
    cam = new THREE.OrthographicCamera(-s * a, s * a, s, -s, 0.1, 200);
    fx = colorDither(renderer, W, H, PALETTE);
  }
  size(); addEventListener('resize', size);
  const camFocus = new THREE.Vector3(4, 0, 5);

  // ---------- 状態 ----------
  const minds = createMinds(PEOPLE, { policies, seed });
  const state = { arriveX: 34.24, arrivedAt: null, t: 0, mood: { ...MOOD0 }, moodTarget: { ...MOOD0 }, speaker: null, rain: 0, rainTarget: 0, boatX: boat.position.x, boatTarget: boat.position.x, walking: true, caravanX: 3 };
  const seat = (i) => figures[i].userData;
  const slot = (i) => i * 0.9 + (i > 1 ? 0.6 : 0);
  // 隊列の中のいつもの位置（歩く間の目安）と、立ち止まったときの立ち位置
  const anchorX = (i) => state.caravanX - slot(i);
  figures.forEach((f, i) => {
    const u = f.userData, g = GAIT[u.id];
    Object.assign(u, { gait: g, r: rng(seed * 31 + i * 7), heading: Math.PI / 2, v: 0, phase: R() * 6, look: 0, nod: 0, act: 'go', timer: 1 + R() * 2, placed: false });
    if (g.kind === 'wander') { u.wz = 5 + (R() < 0.5 ? -1 : 1) * (1.6 + R()); u.timer = 2 + R(); }
  });

  // いちばん近くの目に入るもの。視力が弱いほど、近くのものしか見えない
  function percept(u, vision = 1) {
    if (u.x > RIVER[0] - 5) return { tag: 'river', x: RIVER[0], z: u.z };
    const reach = 1.2 + 3 * vision;
    let best = null, bd = reach;
    for (const l of landmarks) {
      const d = Math.hypot(l.x - u.x, l.z - u.z);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  // 一人分の行き先・速さ・向きを決めて、少し進める
  function steer(u, dt) {
    const g = u.gait, r = u.r, i = u.i;
    if (!u.placed) { u.x = anchorX(i); u.z = 5 + g.lane; u.placed = true; }
    u.timer -= dt;
    const behind = anchorX(i) - u.x; // 正なら列から遅れている
    // B：この人が出したい速さ。自分の力と、遅いと思っている人への見積もりから mind.js が決める
    const B = PACE * minds.pace(i);
    let tz = 5 + g.lane, v = 0, look = 0, nod = 0, face = null;
    if (state.walking) {
      if (g.kind === 'steady') {
        // 真面目：道の決まった筋を、ほぼ一定の速さで
        v = B * (1 + clamp(behind * 0.25, -0.3, 0.3));
      } else if (g.kind === 'hurry') {
        // 焦り：小走りで前に出ては、振り返って皆を待つ
        if (u.act === 'go') {
          v = B * 1.7;
          if (-behind > 1.4) { u.act = 'wait'; u.timer = 0.7 + r() * 0.8; }
        } else {
          face = -Math.PI / 2;
          if (u.timer < 0 && -behind < 0.3) u.act = 'go';
        }
        tz += Math.sin(state.t * 1.7 + i) * 0.15;
      } else if (g.kind === 'drift') {
        // 足腰ではなく、目と心で道筋がぶれる。足腰が弱い人なら最短の道を行こうとする
        const inn = minds.minds[i].inner;
        // 視力：道の筋から外れても、すぐには気づかない
        u.drift = (u.drift ?? 0) + (r() - 0.5) * dt * 3 * (1 - inn.vision);
        u.drift *= 1 - dt * inn.vision * 1.2;
        tz += clamp(u.drift, -1.8, 1.8);
        if (u.act === 'linger') {
          // 見入る、振り返る
          face = u.lingerFace; nod = u.lingerNod;
          if (u.timer < 0) { u.act = 'go'; u.timer = 2 + r() * 3; }
        } else {
          // 前へ進む気持ちが弱いほど、歩みが落ちる
          v = B * (0.8 + 0.3 * inn.will) * (1 + clamp(behind * 0.08, 0, 0.15));
          if (u.timer < 0) {
            const p = percept(u, inn.vision);
            if (p && r() < inn.reminisce * 0.7) {
              u.act = 'linger'; u.timer = 1.5 + r() * 2.5; u.lingerNod = 0;
              u.lingerFace = Math.atan2(p.x - u.x, p.z - u.z);
              minds.linger(i, p.tag, state.t);
            } else if (r() < (1 - inn.will) * 0.6) {
              u.act = 'linger'; u.timer = 1.2 + r() * 1.8; u.lingerNod = 0.1;
              u.lingerFace = -Math.PI / 2; // 来た道（沈む町のほう）を振り返る
              minds.linger(i, 'behind', state.t);
            } else u.timer = 1.5 + r() * 2;
          }
        }
      } else if (g.kind === 'wander') {
        // 楽観・好奇心：道を外れて寄り道し、写真を撮り、置いていかれそうになると走って追いつく
        if (u.act === 'photo') {
          face = u.photoDir; look = 0.3; tz = u.z;
          if (u.timer < 0) { u.act = 'go'; u.timer = 1.5 + r() * 2; }
        } else {
          if (u.timer < 0) {
            if (r() < 0.4) { u.act = 'photo'; u.timer = 1 + r() * 1.2; u.photoDir = (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.8; }
            else { u.wz = 5 + (r() < 0.5 ? -1 : 1) * (1 + r() * 2); u.timer = 1.5 + r() * 1.5; }
          }
          tz = u.wz ?? 5;
          v = B * (0.9 + clamp(behind * 0.3, -0.4, 0.6));
          if (behind > 2) { v = B * 2.1; tz = 5 + g.lane; }
        }
      } else if (g.kind === 'hesitant') {
        // 遠慮がち：列の後ろの端を、速くなったり止まったりしながら
        if (u.act === 'pause') {
          nod = 0.25; look = -0.5;
          if (u.timer < 0) { u.act = 'go'; u.timer = 1.5 + r() * 2.5; }
        } else {
          v = B * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(state.t * 1.3 + 2))) * (1 + clamp(behind * 0.3, -0.5, 0.5));
          if (u.timer < 0) { u.act = 'pause'; u.timer = 0.4 + r() * 0.7; }
        }
      }
      if (g.kind !== 'hurry' && g.kind !== 'wander' && -behind > 0.6) v *= clamp(1 + (behind + 0.6) * 0.8, 0.2, 1);
      // 付き添う・話しながら歩く：相手の横に寄って、相手の速さに合わせる
      const it = minds.intent(i, state.t);
      if (it) {
        const q = figures[it.with].userData;
        tz = q.z + (u.z >= q.z ? 0.5 : -0.5);
        v = clamp(q.v + (q.x - u.x) * 1.5, 0, PACE * 2);
        if (q.v < 0.1 && Math.abs(q.x - u.x) < 0.6) { v = 0; face = Math.atan2(q.x - u.x, q.z - u.z); }
      }
    } else {
      // 立ち止まった：それぞれの立ち位置まで歩き、話している人のほうを向く
      if (u.spotX === undefined) { u.spotX = anchorX(i) + g.spot[0]; u.spotZ = 5 + g.spot[1]; u.act = 'go'; }
      tz = u.spotZ;
      const d = Math.hypot(u.spotX - u.x, u.spotZ - u.z);
      v = d > 0.08 ? Math.min(PACE * g.pace * 1.1, d * 2) : 0;
      if (v === 0) {
        let fx = 0, fz = 0;
        if (state.speaker !== null && state.speaker !== i) { const s = figures[state.speaker].userData; fx = s.x - u.x; fz = s.z - u.z; }
        else figures.forEach((o) => { const q = o.userData; if (q !== u && q.mode !== 'free') { fx += q.x - u.x; fz += q.z - u.z; } });
        if (fx || fz) face = Math.atan2(fx, fz);
      }
    }
    // 速さは急には変わらない（止まるほうが少し速い）
    u.v += clamp(v - u.v, -g.accel * dt * 1.5, g.accel * dt);
    // 向き：歩いている間は行き先へ、止まっている間は face へ、曲がる速さの範囲で回る
    const tx = state.walking ? u.x + 1.5 : u.spotX;
    const want = u.v > 0.05 ? Math.atan2(tx - u.x, tz - u.z) : face;
    if (want !== null) u.heading += clamp(wrap(want - u.heading), -g.turn * dt, g.turn * dt);
    const step = u.v * dt;
    u.x += Math.sin(u.heading) * step;
    u.z += Math.cos(u.heading) * step;
    u.phase += (step / (0.6 * g.stride)) * Math.PI;
    u.y += (heightAt(Math.round(u.x), Math.round(u.z)) - 1 - u.y) * Math.min(1, dt * 10);
    u.look += (look - u.look) * Math.min(1, dt * 4);
    u.nod += (nod - u.nod) * Math.min(1, dt * 3);
  }

  const toScreen = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };

  function update(dt) {
    state.t += dt;
    shared.time.value = state.t;
    const t = state.t;
    if (state.walking) {
      if (!state.started) { state.started = true; minds.start(state.t); }
      // 一行の進みは先頭（透）の歩みで決まる
      state.caravanX += dt * PACE * minds.pace(0);
      minds.tick(state.t, dt, figures.map((f) => f.userData.v / PACE), figures.map((f) => f.userData.v > 0.4), figures.map((f) => anchorX(f.userData.i) - f.userData.x), figures.map((f) => f.userData.act), figures.map((f) => percept(f.userData, minds.minds[f.userData.i].inner.vision)?.tag ?? null));
      if (state.caravanX >= state.arriveX) { state.walking = false; state.arrivedAt = state.t; }
    }
    figures.forEach((f) => {
      const u = f.userData;
      if (u.mode !== 'free') steer(u, dt);
      const g = u.gait;
      const moving = u.mode === 'free' ? 0 : Math.min(1, u.v / 0.5);
      u.rig.animate(t, { phase: u.phase, amp: 0.5 * g.stride * moving, swing: g.swing, lean: g.lean * (0.4 + 0.6 * moving) + (u.act === 'rest' ? 0.12 : 0), look: u.look, nod: u.nod, bounce: g.bounce, sorrow: u.sorrowNow || 0, tension: u.shake || 0 });
      const shake = u.shake;
      const jx = shake ? (Math.random() - 0.5) * 0.12 * shake : 0;
      const jz = shake ? (Math.random() - 0.5) * 0.12 * shake : 0;
      f.position.set(u.x + jx, u.y + f.position.y, u.z + jz);
      // 悲しみ：色が抜け、少し沈む
      u.sorrowNow = (u.sorrowNow || 0) + (u.sorrow - (u.sorrowNow || 0)) * 0.05;
      u.rig.topMat.userData.sorrow.value = u.sorrowNow;
      u.rig.bottomMat.userData.sorrow.value = u.sorrowNow;
      f.rotation.y = u.mode === 'free' ? (u.facing ?? Math.PI / 2) : u.heading;
    });
    if (state.boatMode) cart.position.set(state.boatX + 0.2, -0.14, 7.3); else cart.position.set(state.caravanX + 1.4, 0, 5);
    // 舟
    state.boatX += (state.boatTarget - state.boatX) * Math.min(1, dt * 0.8);
    boat.position.x = state.boatX;
    boat.position.y = -0.32 + Math.sin(t * 2) * 0.03;
    figures.forEach((f) => { const u = f.userData; if (u.inBoat !== undefined) { u.x = state.boatX - 0.7 + u.inBoat * 0.5; u.z = 6.6; u.y = -0.15; } });
    // カメラは一行を追う
    const target = new THREE.Vector3(state.caravanX - 1.5, 0, 5);
    if (state.camX !== undefined) target.x = state.camX;
    camFocus.lerp(target, state.t === 0 ? 1 : Math.min(1, dt * 2)); // 歩き出す前はすぐ一行に合わせる
    cam.position.set(camFocus.x + 12, 11, camFocus.z + 12);
    cam.lookAt(camFocus.x, 0.6, camFocus.z);
    sun.position.set(camFocus.x - 8, 12, camFocus.z + 6); sun.target.position.copy(camFocus);
    // 雨
    state.rain += (state.rainTarget - state.rain) * Math.min(1, dt * 1.5);
    rain.material.opacity = state.rain;
    drops.forEach((d, i) => {
      d.y -= dt * 9; if (d.y < 0) d.y += 8;
      const x = camFocus.x + d.x, z = camFocus.z + d.z - 5.5;
      rainPos.set([x, d.y, z, x - 0.05, d.y + 0.45, z], i * 6);
    });
    rainGeo.attributes.position.needsUpdate = true;
    // 感情
    for (const k in state.mood) state.mood[k] += (state.moodTarget[k] - state.mood[k]) * Math.min(1, dt * 2.5);
    const u = fx.uniforms;
    for (const k in state.mood) u[k].value = state.mood[k];
    u.time.value = t;
    if (state.speaker !== null) {
      const sp = figures[state.speaker];
      const p = sp.position.clone().add(new THREE.Vector3(0, 0.8, 0)).project(cam);
      u.focus.value.lerp(new THREE.Vector2((p.x + 1) / 2, (p.y + 1) / 2), 0.2);
    }
    fx.render(scene, cam, state.mood.sorrow > 0.5 ? 3 : 2);
    ui.frame?.(state, figures, toScreen);
  }

  return { state, figures, minds, update, toScreen, RIVER, seat, setCamX: (x) => { state.camX = x; } };
}
