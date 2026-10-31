// 最後の渡し：渡し舟は二つの桟橋のどちらか一方にしか寄れない。舵を切らなければ「このまま」の桟橋へ寄る。
// トロッコ問題の形（分かれ道・何もしなければ決まる行き先・切り替える一手）を、命ではなく「この岸に残る」で問う。
import * as THREE from 'three';
import { colorDither } from './post.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { makePerson } from './person.js';
import { ground, water as waterMat, wood, foliage, stone, shared } from './materials.js';
import { PEOPLE, ROUNDS } from './waku-data.js';

const PALETTE = ['#EDE6D3', '#1E1B22', '#2C3E66', '#3F7A78', '#9DB08A', '#7FA05E', '#4F7A44', '#2F4A2C', '#D9A441', '#D6C094', '#9EC1CF', '#7A5236', '#4A3426', '#8C8A86', '#B9845A', '#E8CDB0', '#C2503A', '#7A5A98', '#4C7FB8', '#E0B13E', '#D4AE90', '#5B9AA0', '#2E5868'];
// 一問の長さ（秒）。舟が分かれ目に着くまでに舵を決める
export const STEER = 10;
const PHASES = { commit: 2.6, board: 1.4, leave: 3.2, gap: 0.5 };
const START_X = -5, FORK_X = 0.5;
// 桟橋：far は奥の岸、near は手前の岸
const PIER = { far: { z: 1.5, tip: 3.1, stand: 2.0, face: 0 }, near: { z: 8.5, tip: 6.9, stand: 8.0, face: Math.PI } };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;
const bez = (p0, c, p1, t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];

// 問いの並びと、どちらが「このまま」か、どちらの岸にいるかを seed で決める
export function planRounds(seed) {
  const R = rng(seed);
  const plan = ROUNDS.map((r) => ({ ...r, def: R() < 0.5 ? 'a' : 'b', aSide: R() < 0.5 ? 'far' : 'near' }));
  plan.forEach((r) => {
    if (r.mirror === undefined) return;
    // 同じ顔ぶれで、このままの向きだけ逆にする
    const ref = plan[r.mirror];
    const refDefault = ref[ref.def].join();
    r.def = r.a.join() === refDefault ? 'b' : 'a';
    // 岸も入れ替えて、同じ画面に見えないようにする
    const refSideOfA = ref.a.join() === r.a.join() ? ref.aSide : (ref.aSide === 'far' ? 'near' : 'far');
    r.aSide = refSideOfA === 'far' ? 'near' : 'far';
  });
  return plan;
}

export function createFerry(canvas, ui, { seed = 7, reduced = false } = {}) {
  const R = rng(seed * 13 + 5);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EDE6D3');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();

  // ---------- 地形：x に沿って流れる広い川。奥と手前に岸 ----------
  const X0 = -18, X1 = 24, Z0 = -12, Z1 = 22, W0 = 1, W1 = 9;
  shared.river.value.set(W0, W1); // 岸の位置（水の泡と深さに使う）
  const grass = ground('#7FA05E', '#7A5A3C', 'grass'), sand = ground('#D6C094', '#8A6A48', 'sand'), water = waterMat('#2F6E8C', 'x');
  const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
  const tiles = { grass: [], sand: [], water: [] };
  for (let x = X0; x < X1; x++) {
    for (let z = Z0; z < Z1; z++) {
      const inWater = z >= W0 && z <= W1;
      const bank = z === W0 - 1 || z === W1 + 1;
      let h = inWater ? 0.55 : 1;
      if (!inWater && !bank) {
        if (z < W0 - 1) h += Math.round(R() * Math.min(1, (W0 - 1 - z) / 6) * 3) / 4;
        else if (R() < 0.12) h += 0.25;
      }
      const kind = inWater ? 'water' : bank ? 'sand' : 'grass';
      tiles[kind].push(m4.clone().compose(new THREE.Vector3(x, h / 2 - 1, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
    }
  }
  const instanced = (geo, material, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = cast; im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  instanced(tileGeo, grass, tiles.grass);
  instanced(tileGeo, sand, tiles.sand);
  instanced(tileGeo, water, tiles.water, false);
  // 木と岩：奥の岸は林、手前の岸はまばら（桟橋のまわりは空ける）
  const trunk = wood('#6E4A2E', 'y'), rock = stone('#9A958A');
  const leafMats = [foliage('#4F7A44'), foliage('#6A8F4E')];
  const trunks = [], rocks = [], leaves = [[[], [], []], [[], [], []]];
  const yAxis = new THREE.Vector3(0, 1, 0);
  const plant = (x, z) => {
    if (Math.abs(x - 5) < 2.5 && (z > -3 && z < 13)) return;
    if (R() < 0.8) {
      trunks.push(m4.clone().compose(new THREE.Vector3(x, 0.35, z), new THREE.Quaternion(), new THREE.Vector3(0.25, 0.7, 0.25)));
      const set = leaves[R() < 0.5 ? 0 : 1];
      for (let k = 0; k < 3; k++) set[k].push(m4.clone().compose(new THREE.Vector3(x, 0.85 + k * 0.38, z), new THREE.Quaternion().setFromAxisAngle(yAxis, R() * 3), new THREE.Vector3(1, 1, 1)));
    } else {
      const s = 0.3 + R() * 0.2;
      rocks.push(m4.clone().compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    }
  };
  for (let x = X0; x < X1; x++) {
    for (let z = Z0; z < W0 - 1; z++) if (R() < (z > -3 ? 0.12 : 0.32)) plant(x, z);
    for (let z = W1 + 2; z < Z1; z++) if (R() < 0.05) plant(x, z);
  }
  instanced(box, trunk, trunks);
  instanced(new THREE.DodecahedronGeometry(1), rock, rocks);
  leafMats.forEach((lm, s) => [0, 1, 2].forEach((k) => instanced(new THREE.ConeGeometry(0.62 - k * 0.15, 0.75, 7), lm, leaves[s][k])));
  // 桟橋：板と杭
  const plank = wood('#857058', 'x'), post = wood('#5C3D27', 'y');
  for (const side of ['far', 'near']) {
    const P = PIER[side];
    const deck = new THREE.Mesh(box, plank); deck.scale.set(1.3, 0.1, 2.4); deck.position.set(5, -0.03, P.z); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    [[4.4, -1], [5.6, -1], [4.4, 1], [5.6, 1]].forEach(([x, k]) => { const p = new THREE.Mesh(box, post); p.scale.set(0.12, 0.8, 0.12); p.position.set(x, -0.3, P.z + k * 1.0); scene.add(p); });
  }
  // 渡し舟。舳先は +x。漕ぎ手は透
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(box, wood('#7A5236', 'x')); hull.scale.set(2.4, 0.35, 1.0); hull.castShadow = true; boat.add(hull);
  const rim = new THREE.Mesh(box, wood('#5C3D27', 'x')); rim.scale.set(2.5, 0.08, 1.1); rim.position.y = 0.2; boat.add(rim);
  boat.position.set(START_X, -0.32, 5);
  scene.add(boat);
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#1E1B22', side: THREE.BackSide });
  const rower = makePerson({ top: '#7A5A98', bottom: '#4A4A52', hair: '#3A2E25', build: 1.15, height: 1.14 }, outlineMat);
  rower.root.position.set(-0.95, 0.02, 0); rower.root.rotation.y = Math.PI / 2;
  boat.add(rower.root);
  // 舵の行き先を示す浮き
  const buoyMat = new THREE.MeshStandardMaterial({ color: '#C2503A', roughness: 0.6 });
  const buoys = Array.from({ length: 9 }, () => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 8), buoyMat); b.castShadow = true; scene.add(b); return b; });

  scene.add(new THREE.HemisphereLight('#FFF4E0', '#7A8A6A', 1.6));
  const sun = new THREE.DirectionalLight('#FFE2B8', 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 60 });
  scene.add(sun); scene.add(sun.target);

  // ---------- カメラ ----------
  let cam, fx, W, H;
  const focus = new THREE.Vector3(1.8, 0, 5);
  function size() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    const a = W / H, s = a < 1 ? 3.7 / a : 4.5;
    // 縦長の画面では、桟橋のほうへ寄せる
    focus.x = a < 1 ? 3.4 : 1.8;
    cam = new THREE.OrthographicCamera(-s * a, s * a, s, -s, 0.1, 200);
    cam.position.set(focus.x + 12, 11, focus.z + 12);
    cam.lookAt(focus.x, 0.2, focus.z);
    fx = colorDither(renderer, W, H, PALETTE);
  }
  size(); addEventListener('resize', size);
  sun.position.set(focus.x - 8, 12, focus.z + 6); sun.target.position.copy(focus);
  const toScreen = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };

  // ---------- 問いの流れ ----------
  const plan = planRounds(seed);
  const state = { t: 0, n: -1, phase: 'idle', pt: 0, course: 'far', boatX: START_X, boatZ: 5, buoyZ: [], figs: [], results: [], mood: { tension: 0, sorrow: 0, warmth: 0.15, hope: 0 }, fast: false };
  const sideOf = (r, g) => (g === 'a' ? r.aSide : r.aSide === 'far' ? 'near' : 'far');
  const groupAt = (r, side) => (sideOf(r, 'a') === side ? 'a' : 'b');

  function clearFigs() { state.figs.forEach((f) => (f.parent || scene).remove(f.root)); state.figs = []; }
  function begin(n) {
    clearFigs();
    state.n = n; state.phase = 'steer'; state.pt = 0;
    const r = plan[n];
    state.course = sideOf(r, r.def);
    state.flips = 0; state.lastFlip = 0;
    state.boatX = START_X; state.boatZ = 5;
    boat.position.set(START_X, -0.32, 5); boat.rotation.y = 0;
    for (const g of ['a', 'b']) {
      const side = sideOf(r, g), P = PIER[side];
      r[g].forEach((id, k) => {
        const p = PEOPLE[id];
        const rig = makePerson(p.look, outlineMat);
        const x = 5 + (r[g].length === 1 ? 0 : k ? 0.28 : -0.28);
        rig.root.position.set(x, 0.02, P.stand + (k ? 0.15 : -0.15) * (side === 'far' ? 1 : -1));
        rig.root.rotation.y = P.face;
        scene.add(rig.root);
        state.figs.push({ id, g, side, rig, root: rig.root, x0: rig.root.position.x, z0: rig.root.position.z, sorrow: 0, phase: R() * 6 });
      });
    }
    ui.round?.({ n, total: plan.length, r, sideOf: (g) => sideOf(r, g), def: r.def });
  }
  function steer(to) {
    if (state.phase !== 'steer') return;
    const next = to ?? (state.course === 'far' ? 'near' : 'far');
    if (next === state.course) return;
    state.course = next; state.flips++; state.lastFlip = state.pt;
    ui.steered?.(state.course);
  }
  function decide() {
    const r = plan[state.n];
    const chosen = groupAt(r, state.course);
    const res = { n: state.n, r, chosen, def: r.def, switched: chosen !== r.def, flips: state.flips, time: state.flips ? state.lastFlip : null };
    state.results.push(res);
    ui.decided?.(res);
  }

  function boatPathPoint(t) { // commit の間の舟の位置
    const P = PIER[state.course];
    return bez([FORK_X, 5], [3.4, 5], [5, P.tip], t);
  }
  function update(dt) {
    if (state.fast && state.phase !== 'steer') dt *= 3;
    state.t += dt; state.pt += dt;
    shared.time.value = state.t;
    const t = state.t;
    let tension = 0, sorrow = 0;
    if (state.phase === 'steer') {
      state.boatX = START_X + (FORK_X - START_X) * clamp(state.pt / STEER, 0, 1);
      state.boatZ = 5;
      tension = reduced ? 0 : 0.55 * clamp(state.pt / STEER, 0, 1) ** 2;
      if (state.pt >= STEER) { decide(); state.phase = 'commit'; state.pt = 0; }
    } else if (state.phase === 'commit') {
      const [x, z] = boatPathPoint(ease(clamp(state.pt / PHASES.commit, 0, 1)));
      state.boatX = x; state.boatZ = z;
      if (state.pt >= PHASES.commit) { state.phase = 'board'; state.pt = 0; }
    } else if (state.phase === 'board') {
      const k = ease(clamp(state.pt / PHASES.board, 0, 1));
      state.figs.filter((f) => f.side === state.course).forEach((f, i) => {
        f.root.position.x = f.x0 + (5 - 0.1 + i * 0.45 - f.x0) * k;
        f.root.position.z = f.z0 + (state.boatZ - f.z0) * k;
        f.root.position.y = 0.02 - 0.17 * k;
        f.walk = 1 - k;
      });
      if (state.pt >= PHASES.board) {
        state.figs.filter((f) => f.side === state.course).forEach((f, i) => { scene.remove(f.root); boat.add(f.root); f.root.position.set(-0.1 + i * 0.45, 0.02, 0); f.root.rotation.y = Math.PI / 2; f.walk = 0; f.parent = boat; });
        state.phase = 'leave'; state.pt = 0;
        ui.leaving?.(state.figs.filter((f) => f.side !== state.course));
      }
    } else if (state.phase === 'leave') {
      const P = PIER[state.course];
      const k = clamp(state.pt / PHASES.leave, 0, 1);
      const [x, z] = bez([5, P.tip], [8.5, 5], [17, 5], k * k);
      state.boatX = x; state.boatZ = z;
      sorrow = 0.3 * Math.sin(Math.PI * k);
      state.figs.filter((f) => f.side !== state.course).forEach((f) => { f.sorrow = Math.min(0.7, f.sorrow + dt * 0.4); });
      if (state.pt >= PHASES.leave) { state.phase = 'gap'; state.pt = 0; ui.gap?.(); }
    } else if (state.phase === 'gap') {
      if (state.pt >= PHASES.gap) {
        if (state.n + 1 < plan.length) begin(state.n + 1);
        else { state.phase = 'done'; ui.done?.(state.results, plan); }
      }
    }
    // 舟の向きは進む向きに沿わせる
    const dx = state.boatX - boat.position.x, dz = state.boatZ - boat.position.z;
    if (Math.hypot(dx, dz) > 1e-4) boat.rotation.y += clamp(Math.atan2(Math.sin(Math.atan2(-dz, dx) - boat.rotation.y), Math.cos(Math.atan2(-dz, dx) - boat.rotation.y)), -dt * 3, dt * 3);
    boat.position.set(state.boatX, -0.32 + Math.sin(t * 2) * 0.03, state.boatZ);
    rower.animate(t, { phase: t * 2.2, amp: 0, swing: 0, lean: 0.12 + Math.sin(t * 2.2) * 0.1 });
    // 浮き：舟の先から、舵を向けた桟橋まで並ぶ
    if (state.phase === 'steer' || state.phase === 'commit') {
      const P = PIER[state.course];
      const pts = [];
      const startX = Math.min(state.boatX + 1.6, FORK_X);
      const straight = Math.max(0, FORK_X - startX);
      const total = straight + 5.8;
      for (let i = 0; i < buoys.length; i++) {
        const s = ((i + 1) / (buoys.length + 1)) * total;
        pts.push(s < straight ? [startX + s, 5] : bez([FORK_X, 5], [3.4, 5], [5, P.tip], (s - straight) / 5.8));
      }
      buoys.forEach((b, i) => {
        const [x, z] = pts[i];
        state.buoyZ[i] = state.buoyZ[i] === undefined ? z : state.buoyZ[i] + (z - state.buoyZ[i]) * Math.min(1, dt * 6);
        const show = state.phase === 'steer' && x > state.boatX + 1.3;
        b.visible = show;
        b.position.set(x, -0.42 + Math.sin(t * 2.5 + i) * 0.02, state.buoyZ[i]);
      });
    } else buoys.forEach((b) => { b.visible = false; });
    // 待っている人：舟が近づくほど身構える。残された人は色が抜けてうつむく
    state.figs.forEach((f) => {
      const tense = state.phase === 'steer' && !reduced ? clamp(state.pt / STEER, 0, 1) * 0.5 : 0;
      f.rig.animate(t, { phase: f.phase + t * 6, amp: (f.walk || 0) * 0.5, sorrow: f.sorrow, tension: tense, look: state.phase === 'steer' ? Math.sin(t * 0.7 + f.phase) * 0.3 : 0 });
      f.rig.topMat.userData.sorrow.value = f.sorrow;
      f.rig.bottomMat.userData.sorrow.value = f.sorrow;
    });
    const target = { tension, sorrow, warmth: 0.15, hope: 0 };
    for (const k in state.mood) state.mood[k] += (target[k] - state.mood[k]) * Math.min(1, dt * 3);
    const u = fx.uniforms;
    for (const k in state.mood) u[k].value = state.mood[k];
    u.time.value = t;
    fx.render(scene, cam, 2);
    ui.frame?.(state, toScreen);
  }

  const headOf = (f) => { const v = new THREE.Vector3(); f.root.getWorldPosition(v); v.y += 1.25; return v; };
  return { state, plan, update, begin, steer, toScreen, headOf, pierPoint: (side) => new THREE.Vector3(5, 1.5, PIER[side].stand), setFast: (b) => { state.fast = b; } };
}
