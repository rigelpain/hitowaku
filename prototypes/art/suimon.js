// 水門番の山（描画）。天の滝が山の頂に落ち続け、まわりを上段・中段・下段の池が同心円に囲む。
// 環は北・東・南・西に区切られ、池は 3 段 × 4 方角。ふもとには町が広がる。
// 家は積み木のように段を重ね、水かさが上がると下の段（章）から沈む。
import * as THREE from 'three';
import { colorDither } from './post.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { makePerson } from './person.js';
import { ground, water as waterMat, wood, foliage, stone, shared } from './materials.js';

const PALETTE = ['#EDE6D3', '#1E1B22', '#2C3E66', '#3F7A78', '#9DB08A', '#7FA05E', '#4F7A44', '#2F4A2C', '#D9A441', '#D6C094', '#9EC1CF', '#7A5236', '#4A3426', '#8C8A86', '#B9845A', '#E8CDB0', '#C2503A', '#7A5A98', '#4C7FB8', '#E0B13E', '#D4AE90', '#5B9AA0', '#2E5868'];
export const BH = 0.3;                         // 水かさ1と、家の一段の高さ
const PEAK = 13;                               // 頂（水門の受け皿）
// 段ごとの池の帯（中心からの距離）と池の底
const RING = [
  { d0: 4, d1: 7.5, floor: 9.5 },
  { d0: 9.5, d1: 13, floor: 6 },
  { d0: 15, d1: 18.5, floor: 2.5 },
];
const BANK = 3.8;                              // 池を仕切る尾根の高さ（池の底から）
const TOWN = { d0: 20.5, d1: 27, y: 0 };
const EXT = 27;
const SECT = 4;
const sectorAngle = (s) => s * Math.PI / 2;    // 0 北（-z）、1 東（+x）、2 南（+z）、3 西（-x）
const dirOf = (a) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createValley(canvas, { seed = 7 } = {}) {
  const R = rng(seed * 7 + 3);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EDE6D3');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  shared.river.value.set(-999, 999); // 水の泡（岸の判定）は使わない

  // ---------- 地形：一辺 1 の柱を並べる ----------
  const grass = ground('#7FA05E', '#7A5A3C', 'grass'), sandM = ground('#D6C094', '#8A6A48', 'sand'), rockTop = ground('#9A958A', '#6E6A62', 'path');
  const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.02);
  const tiles = { grass: [], sand: [], rock: [] };
  const BOTTOM = -1.5;
  const put = (kind, x, z, top) => tiles[kind].push(m4.clone().compose(new THREE.Vector3(x, (top + BOTTOM) / 2, z), q0, new THREE.Vector3(1, top - BOTTOM, 1)));
  const sectorOf = (x, z) => ((Math.round(Math.atan2(x, -z) / (Math.PI / 2)) % SECT) + SECT) % SECT;
  // 方角の境目（尾根）にどれだけ近いか
  const ridgeDist = (x, z) => { const a = Math.atan2(x, -z); const k = Math.round((a - Math.PI / 4) / (Math.PI / 2)); return Math.abs(Math.sin(a - (Math.PI / 4 + k * Math.PI / 2))) * Math.hypot(x, z); };
  const basinTiles = Array.from({ length: RING.length * SECT }, () => []);
  const damTiles = Array.from({ length: RING.length * SECT }, () => []);
  const townTiles = Array.from({ length: SECT }, () => []);
  const heightOf = new Map();
  for (let x = -EXT; x <= EXT; x++) for (let z = -EXT; z <= EXT; z++) {
    const d = Math.hypot(x, z);
    if (d > EXT + 0.5) continue;
    const s = sectorOf(x, z);
    const ridge = ridgeDist(x, z) < 0.8;
    let top, kind = 'grass';
    if (d < 3.2) { top = PEAK; kind = 'rock'; }
    else if (d < RING[0].d0) top = PEAK - 1.2;
    else {
      let done = false;
      for (let k = 0; k < RING.length; k++) {
        const g = RING[k];
        const next = RING[k + 1];
        if (d >= g.d0 && d < g.d1) {
          if (ridge) top = g.floor + BANK;
          else { top = g.floor; kind = 'sand'; basinTiles[k * SECT + s].push([x, z]); }
          done = true; break;
        }
        if (d >= g.d1 && d < g.d1 + 1) { top = g.floor; if (!ridge) damTiles[k * SECT + s].push([x, z]); else top = g.floor + BANK; done = true; break; } // ダムの立つところ
        if (next && d >= g.d1 + 1 && d < next.d0) { top = ridge ? next.floor + BANK : (g.floor + next.floor) / 2 + 0.6; done = true; break; } // こぼれ口
      }
      if (!done) {
        if (d < TOWN.d0) top = (RING[2].floor + TOWN.y) / 2 + 0.3;
        else { top = TOWN.y; townTiles[s].push([x, z]); }
      }
    }
    put(kind, x, z, top);
    heightOf.set(x + ',' + z, top);
  }
  const instanced = (geo, material, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = list.length;
    im.castShadow = cast; im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  instanced(tileGeo, grass, tiles.grass);
  instanced(tileGeo, sandM, tiles.sand);
  instanced(tileGeo, rockTop, tiles.rock);
  // ふもとの木
  const trunk = wood('#6E4A2E', 'y'), leafs = [foliage('#4F7A44'), foliage('#6A8F4E')];
  const trunks = [], leaves = [[[], [], []], [[], [], []]];
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let x = -EXT; x <= EXT; x++) for (let z = -EXT; z <= EXT; z++) {
    const d = Math.hypot(x, z);
    if (d < TOWN.d0 + 3.5 || d > EXT || R() > 0.3) continue;
    const y = heightOf.get(x + ',' + z) ?? 0;
    trunks.push(m4.clone().compose(new THREE.Vector3(x, y + 0.35, z), q0, new THREE.Vector3(0.25, 0.7, 0.25)));
    const set = leaves[R() < 0.5 ? 0 : 1];
    for (let k = 0; k < 3; k++) set[k].push(m4.clone().compose(new THREE.Vector3(x, y + 0.85 + k * 0.38, z), new THREE.Quaternion().setFromAxisAngle(yAxis, R() * 3), new THREE.Vector3(1, 1, 1)));
  }
  instanced(box, trunk, trunks);
  leafs.forEach((lm, s) => [0, 1, 2].forEach((k) => instanced(new THREE.ConeGeometry(0.62 - k * 0.15, 0.75, 7), lm, leaves[s][k])));
  // ふもとの町：方角ごとに小さな家並み
  const townMat = new THREE.MeshStandardMaterial({ color: '#D9C7A0', roughness: 0.9 }), roofMat = new THREE.MeshStandardMaterial({ color: '#7A5236', roughness: 0.8 });
  const townH = [], townR = [];
  townTiles.forEach((list) => list.forEach(([x, z]) => {
    const d = Math.hypot(x, z);
    if (d > TOWN.d0 + 3 || R() > 0.35 || ridgeDist(x, z) < 1.5) return;
    townH.push(m4.clone().compose(new THREE.Vector3(x, 0.32, z), q0, new THREE.Vector3(0.8, 0.64, 0.7)));
    townR.push(m4.clone().compose(new THREE.Vector3(x, 0.82, z), new THREE.Quaternion().setFromAxisAngle(yAxis, Math.PI / 4), new THREE.Vector3(1, 1, 1)));
  }));
  instanced(box, townMat, townH);
  instanced(new THREE.ConeGeometry(0.62, 0.38, 4), roofMat, townR);

  // ---------- 池の水・ダム ----------
  const pondMat = waterMat('#2F6E8C', 'z');
  const damMat = stone('#9A958A');
  const center = (list) => { let sx = 0, sz = 0; list.forEach(([x, z]) => { sx += x; sz += z; }); return [sx / list.length, sz / list.length]; };
  const ponds = basinTiles.map((list, i) => {
    const ring = Math.floor(i / SECT), sector = i % SECT, F = RING[ring].floor;
    const w = new THREE.InstancedMesh(box, pondMat, list.length); w.receiveShadow = true; w.userData.basin = i; scene.add(w);
    const dam = new THREE.InstancedMesh(box, damMat, damTiles[i].length); dam.castShadow = true; dam.receiveShadow = true; dam.userData.basin = i; scene.add(dam);
    const fall = new THREE.Mesh(box, pondMat); fall.visible = false; scene.add(fall);
    const [cx, cz] = center(list);
    return { i, ring, sector, F, list, dams: damTiles[i], w, dam, fall, cx, cz, level: -1, capV: -1 };
  });
  function setPond(i, level, capV) {
    const p = ponds[i];
    if (Math.abs(p.level - level) > 0.001) {
      const h = Math.max(0.02, Math.min(level, BANK / BH) * BH);
      p.list.forEach(([x, z], k) => p.w.setMatrixAt(k, m4.compose(new THREE.Vector3(x, p.F + h / 2, z), q0, new THREE.Vector3(1, h, 1))));
      p.w.instanceMatrix.needsUpdate = true; p.w.computeBoundingSphere();
      p.level = level;
    }
    if (Math.abs(p.capV - capV) > 0.001) {
      const dh = Math.min(capV, BANK / BH + 1) * BH;
      p.dams.forEach(([x, z], k) => p.dam.setMatrixAt(k, m4.compose(new THREE.Vector3(x, p.F + dh / 2, z), q0, new THREE.Vector3(0.96, dh, 0.96))));
      p.dam.instanceMatrix.needsUpdate = true; p.dam.computeBoundingSphere();
      p.capV = capV;
    }
  }
  // 決壊：ダムから外の段へ流れ落ちる水
  function setFall(i, on, amt = 1) {
    const p = ponds[i];
    p.fall.visible = on;
    if (!on) return;
    const g = RING[p.ring], dir = dirOf(sectorAngle(p.sector));
    const nextFloor = p.ring + 1 < RING.length ? RING[p.ring + 1].floor : TOWN.y;
    const top = dir.clone().multiplyScalar(g.d1 + 0.5).setY(p.F + Math.max(0.4, p.level * BH));
    const bot = dir.clone().multiplyScalar((RING[p.ring + 1]?.d0 ?? TOWN.d0) + 0.5).setY(nextFloor + 0.1);
    p.fall.scale.set(1.6 + amt, 0.25, top.distanceTo(bot));
    p.fall.position.copy(top).add(bot).multiplyScalar(0.5);
    p.fall.lookAt(bot);
  }
  // 町の水：方角ごと
  const townWater = townTiles.map((list) => {
    const w = new THREE.InstancedMesh(box, pondMat, list.length);
    list.forEach(([x, z], k) => w.setMatrixAt(k, m4.compose(new THREE.Vector3(x, 0.2, z), q0, new THREE.Vector3(1, 0.4, 1))));
    w.visible = false; scene.add(w);
    return w;
  });

  // ---------- 天の滝と受け皿、樋 ----------
  const fallMat = waterMat('#5B9AA0', 'z');
  const skyFall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), fallMat);
  skyFall.position.set(0, (PEAK + 1 + 70) / 2, 0); skyFall.scale.set(1.2, 70 - PEAK - 1, 1.2);
  scene.add(skyFall);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2, 0.8, 24), stone('#8C8A86'));
  basin.position.set(0, PEAK + 0.4, 0); basin.castShadow = true; scene.add(basin);
  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 24), fallMat);
  basinWater.position.set(0, PEAK + 0.82, 0); scene.add(basinWater);
  const hut = new THREE.Mesh(box, wood('#857058', 'x')); hut.scale.set(1.2, 1, 1); hut.position.set(2.3, PEAK + 0.5, 1.6); hut.castShadow = true; scene.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.6, 4), roofMat); hutRoof.rotation.y = Math.PI / 4; hutRoof.position.set(2.3, PEAK + 1.3, 1.6); scene.add(hutRoof);
  // 樋：受け皿から放射状に、各池の上まで
  const troughMat = wood('#6E4A2E', 'x'), flowMat = waterMat('#5B9AA0', 'x');
  const seg = (a, b, w, mat) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(box, mat);
    m.scale.set(len, 0.1, w);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    m.castShadow = true; scene.add(m);
    return m;
  };
  const troughs = ponds.map((p) => {
    const a = sectorAngle(p.sector) + (p.ring - 1) * 0.2;
    const mid = (RING[p.ring].d0 + RING[p.ring].d1) / 2;
    const s0 = dirOf(a).multiplyScalar(2).setY(PEAK + 0.6);
    const s1 = dirOf(a).multiplyScalar(mid).setY(p.F + BANK + 0.5);
    seg(s0, s1, 0.24, troughMat);
    // 樋を支える柱
    for (let t = 0.35; t < 1; t += 0.33) {
      const pt = new THREE.Vector3().lerpVectors(s0, s1, t);
      const h = heightOf.get(Math.round(pt.x) + ',' + Math.round(pt.z)) ?? 0;
      if (pt.y - h > 0.6) { const post = new THREE.Mesh(box, troughMat); post.scale.set(0.1, pt.y - h, 0.1); post.position.set(pt.x, (pt.y + h) / 2, pt.z); scene.add(post); }
    }
    const flow = seg(s0.clone().setY(s0.y + 0.07), s1.clone().setY(s1.y + 0.07), 0.14, flowMat);
    const spout = new THREE.Mesh(box, flowMat); spout.scale.set(0.12, BANK + 0.5, 0.12); spout.position.copy(s1).setY(p.F + (BANK + 0.5) / 2); scene.add(spout);
    flow.visible = spout.visible = false;
    return { flow, spout };
  });
  function setTroughs(shares, on) {
    troughs.forEach((t, i) => {
      const v = on && shares[i] > 0.01;
      t.flow.visible = t.spout.visible = v;
      if (v) { const w = 0.04 + shares[i] * 1.4; t.flow.scale.z = Math.min(0.2, w); t.spout.scale.x = t.spout.scale.z = Math.min(0.5, w * 2); }
    });
  }

  // ---------- 家（積み木）と人 ----------
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#1E1B22', side: THREE.BackSide });
  const winMat = new THREE.MeshStandardMaterial({ color: '#2A2620', roughness: 0.6 });
  const houses = new Map();
  // 家を建てられる場所：池の中ほど、互いに隣り合わないところ
  const slots = ponds.map((p) => {
    const mid = (RING[p.ring].d0 + RING[p.ring].d1) / 2;
    const cand = [...p.list].sort((a, b) => Math.abs(Math.hypot(...a) - mid) - Math.abs(Math.hypot(...b) - mid) || a[0] - b[0]);
    const out = [];
    for (const c of cand) if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) >= 2)) out.push(c);
    return out;
  });
  const slotUse = ponds.map(() => new Map());
  function slotFor(h) {
    const used = slotUse[h.layer];
    if (used.has(h.id)) return slots[h.layer][used.get(h.id)];
    const taken = new Set(used.values());
    let k = slots[h.layer].findIndex((_, j) => !taken.has(j));
    if (k < 0) k = used.size % slots[h.layer].length;
    used.set(h.id, k);
    return slots[h.layer][k];
  }
  function buildHouse(h, { hideTop = false } = {}) {
    let H = houses.get(h.id);
    if (!H) {
      const rig = makePerson({ top: h.wall, bottom: '#4A4A52', hair: '#2E2620', build: 1, height: 1.1 }, outlineMat);
      rig.root.scale.setScalar(0.5);
      rig.root.traverse((o) => { o.userData.home = h.id; });
      scene.add(rig.root);
      const wallMat = new THREE.MeshStandardMaterial({ color: h.wall, roughness: 0.85 });
      const sunkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(h.wall).lerp(new THREE.Color('#2E5868'), 0.55), roughness: 0.9 });
      H = { group: new THREE.Group(), rig, wallMat, sunkMat, target: null, from: null, t: 1, sit: 0, hammer: 0 };
      scene.add(H.group);
      houses.set(h.id, H);
    }
    H.group.clear();
    slotUse.forEach((m, i) => { if (i !== h.layer) m.delete(h.id); });
    const [bx, bz] = slotFor(h);
    const F = ponds[h.layer].F;
    const n = h.blocks.length - (hideTop ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const b = h.blocks[k];
      if (b.foundation) continue;
      const m = new THREE.Mesh(box, b.sunk ? H.sunkMat : H.wallMat);
      m.scale.set(0.8, BH * 0.96, 0.8);
      m.position.set(bx, F + BH * (k + 0.5), bz);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.home = h.id;
      H.group.add(m);
      if (!b.sunk) for (const [ox, oz, sx, sz] of [[0, 0.405, 0.2, 0.02], [0.405, 0, 0.02, 0.2], [0, -0.405, 0.2, 0.02], [-0.405, 0, 0.02, 0.2]]) {
        const win = new THREE.Mesh(box, winMat); win.scale.set(sx, BH * 0.4, sz); win.position.set(bx + ox, m.position.y, bz + oz); H.group.add(win);
      }
    }
    const topY = F + BH * n;
    const roof = new THREE.Mesh(box, roofMat); roof.scale.set(0.95, 0.08, 0.95); roof.position.set(bx, topY + 0.04, bz); roof.castShadow = true; roof.userData.home = h.id; H.group.add(roof);
    H.home = new THREE.Vector3(bx + 0.15, topY + 0.08, bz + 0.15);
    if (!H.target || H.t >= 1) { H.rig.root.position.copy(H.home); H.target = null; }
    return H;
  }
  function moveFigure(id, to, sit = 0, hammer = 0) {
    const H = houses.get(id);
    H.from = H.rig.root.position.clone(); H.target = to.clone(); H.t = 0; H.sit = sit; H.hammer = hammer;
  }
  const damSpot = (i, k) => { const p = ponds[i], [x, z] = p.dams[(k * 7) % p.dams.length]; return new THREE.Vector3(x, p.F + Math.min(p.capV, BANK / BH + 1) * BH + 0.05, z); };

  // ---------- 光・カメラ ----------
  scene.add(new THREE.HemisphereLight('#FFF4E0', '#7A8A6A', 1.6));
  const sun = new THREE.DirectionalLight('#FFE2B8', 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, far: 140 });
  scene.add(sun); scene.add(sun.target);
  let cam, fx, W, H0;
  // 視点：中心のまわりを回す（yaw）、拡大（zoom）、平行移動（focus）
  const view = { focus: new THREE.Vector3(0, 5, 0), zoom: 1, yaw: Math.PI / 4, yawTarget: Math.PI / 4 };
  function placeCam() {
    const a = W / H0, s = (a < 1 ? 26 / a : 20) / view.zoom;
    cam.left = -s * a; cam.right = s * a; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix();
    cam.position.set(view.focus.x + Math.sin(view.yaw) * 30, view.focus.y + 26, view.focus.z + Math.cos(view.yaw) * 30);
    cam.lookAt(view.focus);
    sun.position.set(view.focus.x - 20, 40, view.focus.z + 12); sun.target.position.copy(view.focus);
  }
  function size() {
    W = canvas.clientWidth; H0 = canvas.clientHeight;
    renderer.setSize(W, H0, false);
    cam = cam || new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    placeCam();
    fx = colorDither(renderer, W, H0, PALETTE);
  }
  size(); addEventListener('resize', size);
  const toScreen = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H0, p.z]; };
  function pan(dx, dy) {
    const s = (cam.top - cam.bottom) / H0;
    const right = new THREE.Vector3(Math.cos(view.yaw), 0, -Math.sin(view.yaw)), fwd = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    view.focus.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s * 1.6);
    const r = Math.hypot(view.focus.x, view.focus.z); if (r > 24) view.focus.multiplyScalar(24 / r);
    placeCam();
  }
  const zoom = (f) => { view.zoom = clamp(view.zoom * f, 0.8, 4); placeCam(); };
  const rotate = (k) => { view.yawTarget += k * Math.PI / 4; };
  // 池へ視点を寄せる（その池が手前に来るよう回す）
  const focusOn = (i) => {
    const p = ponds[i];
    view.focus.set(p.cx, p.F + 1, p.cz);
    view.zoom = Math.max(view.zoom, 1.7);
    // 斜め 45° の向きのうち、その池が手前に来るものへ
    const want = Math.atan2(p.cx, p.cz);
    const opts = [want - Math.PI / 4, want + Math.PI / 4].map((y) => view.yaw + Math.atan2(Math.sin(y - view.yaw), Math.cos(y - view.yaw)));
    view.yawTarget = Math.abs(opts[0] - view.yaw) < Math.abs(opts[1] - view.yaw) ? opts[0] : opts[1];
    placeCam();
  };
  const ray = new THREE.Raycaster();
  function pick(px, py) {
    ray.setFromCamera(new THREE.Vector2(px / W * 2 - 1, -(py / H0) * 2 + 1), cam);
    const objs = [];
    houses.forEach((H) => objs.push(...H.group.children, H.rig.root));
    ponds.forEach((p) => objs.push(p.w, p.dam));
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return null;
    const u = hit.object.userData;
    return u.home ? { home: u.home } : u.basin !== undefined ? { basin: u.basin } : null;
  }

  // ---------- 毎フレーム ----------
  const mood = { tension: 0, sorrow: 0, warmth: 0.12, hope: 0 }, moodTarget = { ...mood };
  let t = 0, flowAmt = 0.5;
  const selected = { id: null, basin: null };
  function update(dt) {
    t += dt; shared.time.value = t;
    if (Math.abs(view.yawTarget - view.yaw) > 0.001) { view.yaw += (view.yawTarget - view.yaw) * Math.min(1, dt * 6); placeCam(); }
    const wobble = 1 + Math.sin(t * 3.1) * 0.04;
    skyFall.scale.x = skyFall.scale.z = (0.8 + flowAmt * 1.4) * wobble;
    houses.forEach((Hh, id) => {
      const rig = Hh.rig;
      if (Hh.target && Hh.t < 1) {
        Hh.t = Math.min(1, Hh.t + dt / 0.9);
        const k = Hh.t * Hh.t * (3 - 2 * Hh.t);
        rig.root.position.lerpVectors(Hh.from, Hh.target, k);
        rig.root.position.y += Math.sin(Math.PI * k) * 1.2;
        const d = new THREE.Vector3().subVectors(Hh.target, Hh.from);
        if (d.lengthSq() > 0.01) rig.root.rotation.y = Math.atan2(d.x, d.z);
      }
      const moving = Hh.target && Hh.t < 1;
      rig.animate(t, { phase: t * 7, amp: moving ? 0.5 : 0, nod: Hh.hammer ? 0.25 + Math.sin(t * 9) * 0.25 : Hh.sit * 0.4, sorrow: Hh.sorrow || 0, lean: Hh.hammer ? 0.3 : 0 });
      rig.topMat.userData.sorrow.value = Hh.sorrow || 0;
      rig.bottomMat.userData.sorrow.value = Hh.sorrow || 0;
      rig.root.scale.setScalar(selected.id === id ? 0.62 : 0.5);
    });
    for (const k in mood) mood[k] += (moodTarget[k] - mood[k]) * Math.min(1, dt * 2.5);
    const u = fx.uniforms;
    for (const k in mood) u[k].value = mood[k];
    u.time.value = t;
    fx.render(scene, cam, 2);
  }

  return {
    update, setPond, setFall, setTroughs, buildHouse, moveFigure, damSpot, houses, toScreen, pick, pan, zoom, rotate, focusOn, selected,
    setFlow: (v) => { flowAmt = v; }, setMood: (m) => Object.assign(moodTarget, m),
    setTown: (sector, on) => { townWater[sector].visible = on; },
    labelPoint: (i) => { const p = ponds[i]; return new THREE.Vector3(p.cx, p.F + BANK + 0.6, p.cz); },
    gatePoint: () => new THREE.Vector3(0, PEAK + 2.2, 0),
    townPoint: (s) => dirOf(sectorAngle(s)).multiplyScalar(TOWN.d0 + 2.5).setY(1.4),
    headOf: (id) => { const v = new THREE.Vector3(); houses.get(id).rig.root.getWorldPosition(v); v.y += 0.7; return v; },
  };
}
