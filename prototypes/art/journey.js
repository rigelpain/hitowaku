// 旅の一場面（仮組み）。一行が歩き、川で舟が足りず、話し合って多数決で一人と別れる。
import * as THREE from 'three';
import { colorDither } from './post.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { makePerson } from './person.js';
import { ground, water as waterMat, wood, foliage, stone, cloth, shared } from './materials.js';

const PALETTE = ['#EDE6D3', '#1E1B22', '#2C3E66', '#3F7A78', '#9DB08A', '#7FA05E', '#4F7A44', '#2F4A2C', '#D9A441', '#D6C094', '#9EC1CF', '#7A5236', '#4A3426', '#8C8A86', '#B9845A', '#E8CDB0', '#C2503A', '#7A5A98', '#4C7FB8', '#E0B13E', '#D4AE90'];
const MOOD0 = { tension: 0, sorrow: 0, warmth: 0.15, hope: 0 };

// ---------- 世界 ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function createJourney(canvas, ui, { seed = 7 } = {}) {
  const R = rng(seed);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EDE6D3');
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });

  const LEN = 64, DEP = 11, RIVER = [36, 40];
  const tiles = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const grassA = ground('#7FA05E', '#7A5A3C', 'grass'), grassB = grassA, path = ground('#D6C094', '#7A5A3C', 'path'), water = waterMat('#3F7A78'), sand = ground('#D6C094', '#8A6A48', 'sand');
  const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
  const heights = [];
  for (let x = 0; x < LEN; x++) {
    heights[x] = [];
    for (let z = 0; z < DEP; z++) {
      const inRiver = x >= RIVER[0] && x <= RIVER[1];
      const onPath = Math.abs(z - 5) <= 0.6;
      let h = 1 + (inRiver ? -0.45 : 0) + (!onPath && !inRiver && R() < 0.18 ? 0.25 : 0);
      if (x === RIVER[0] - 1 || x === RIVER[1] + 1) h = 1;
      heights[x][z] = h;
      const top = inRiver ? water : (x === RIVER[0] - 1 || x === RIVER[1] + 1) ? sand : onPath ? path : ((x + z) % 2 ? grassA : grassB);
      const m = new THREE.Mesh(tileGeo, top);
      m.scale.set(1, h, 1);
      m.position.set(x, h / 2 - 1, z);
      m.receiveShadow = true; m.castShadow = !inRiver;
      tiles.add(m);
    }
  }
  scene.add(tiles);
  // 木と岩
  const trunk = wood('#6E4A2E', 'y'), leaf = foliage('#4F7A44'), leaf2 = foliage('#6A8F4E'), rock = stone('#9A958A');
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(R() * LEN), z = R() < 0.5 ? Math.floor(R() * 3) : 8 + Math.floor(R() * 3);
    if (x >= RIVER[0] - 1 && x <= RIVER[1] + 1) continue;
    const y = heights[x][z] - 1;
    if (R() < 0.75) {
      const t = new THREE.Mesh(box, trunk); t.scale.set(0.25, 0.7, 0.25); t.position.set(x, y + 0.35, z); t.castShadow = true; scene.add(t);
      const lm = R() < 0.5 ? leaf : leaf2;
      for (let k = 0; k < 3; k++) {
        const r = 0.62 - k * 0.15;
        const l = new THREE.Mesh(new THREE.ConeGeometry(r, 0.75, 7), lm);
        l.position.set(x + (R() - 0.5) * 0.06, y + 0.85 + k * 0.38, z + (R() - 0.5) * 0.06); l.rotation.y = R() * 3; l.castShadow = true; scene.add(l);
      }
    } else {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + R() * 0.2), rock); r.position.set(x, y + 0.2, z); r.castShadow = true; scene.add(r);
    }
  }
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
  const state = { t: 0, mood: { ...MOOD0 }, moodTarget: { ...MOOD0 }, speaker: null, rain: 0, rainTarget: 0, boatX: boat.position.x, boatTarget: boat.position.x, walking: true, caravanX: 3 };
  const seat = (i) => figures[i].userData;
  function placeCaravan() {
    figures.forEach((f, i) => {
      const u = f.userData;
      if (u.mode === 'free') return;
      u.x = state.caravanX - i * 0.9 - (i > 1 ? 0.6 : 0);
      u.z = 5 + (i % 2 ? 0.45 : -0.45);
    });
  }
  placeCaravan();

  const toScreen = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };

  function update(dt) {
    state.t += dt;
    shared.time.value = state.t;
    const t = state.t;
    if (state.walking) { state.caravanX += dt * 1.4; placeCaravan(); }
    figures.forEach((f) => {
      const u = f.userData;
      const walkBob = 0;
      u.rig.animate(t + u.i * 0.37, { walking: state.walking && u.mode !== 'free', speed: u.stoop ? 0.8 : 1, sorrow: u.sorrowNow || 0, tension: u.shake || 0 });
      const shake = u.shake;
      const jx = shake ? (Math.random() - 0.5) * 0.12 * shake : 0;
      const jz = shake ? (Math.random() - 0.5) * 0.12 * shake : 0;
      f.position.set(u.x + jx, u.y + walkBob, u.z + jz);
      // 悲しみ：色が抜け、少し沈む
      u.sorrowNow = (u.sorrowNow || 0) + (u.sorrow - (u.sorrowNow || 0)) * 0.05;
      u.rig.topMat.userData.sorrow.value = u.sorrowNow;
      u.rig.bottomMat.userData.sorrow.value = u.sorrowNow;
      f.rotation.y = u.facing ?? Math.PI / 2;
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
    camFocus.lerp(target, Math.min(1, dt * 2));
    cam.position.set(camFocus.x + 12, 11, camFocus.z + 12);
    cam.lookAt(camFocus.x, 0.6, camFocus.z);
    sun.position.set(camFocus.x - 8, 12, camFocus.z + 6); sun.target.position.copy(camFocus);
    // 雨
    state.rain += (state.rainTarget - state.rain) * Math.min(1, dt * 1.5);
    rain.material.opacity = state.rain;
    drops.forEach((d, i) => {
      d.y -= dt * 9; if (d.y < 0) d.y += 8;
      const x = camFocus.x + d.x, z = d.z;
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

  return { state, figures, update, toScreen, RIVER, seat, setCamX: (x) => { state.camX = x; } };
}
