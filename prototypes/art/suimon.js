// 水門番の山（描画）。天の滝が頂に落ち続け、まわりを上段・中段・下段の池が同心円に囲む。
// 段は人が築いた円い石積みの台。台の上に扇形の池が並び、外周を石のダムが、方角の境を石の仕切り壁が囲う。
// 池は 3 段 × 4 方角。ふもとには町が広がる。家は積み木のように段を重ね、水かさが上がると下の段（章）から沈む。
import * as THREE from 'three';
import { colorDither } from './post.js';
import { makePerson } from './person.js';
import { ground, water as waterMat, wood, foliage, stone, masonry as masonryMat, shared } from './materials.js';

const PALETTE = ['#EDE6D3', '#1E1B22', '#2C3E66', '#3F7A78', '#9DB08A', '#7FA05E', '#4F7A44', '#2F4A2C', '#D9A441', '#D6C094', '#9EC1CF', '#7A5236', '#4A3426', '#8C8A86', '#B9845A', '#E8CDB0', '#C2503A', '#7A5A98', '#4C7FB8', '#E0B13E', '#D4AE90', '#5B9AA0', '#2E5868', '#B5AE9F', '#958E82', '#6E6A62'];
export const BH = 0.7;                 // 水かさ1と、家の一段の高さ
const WALL = 10.5;                     // 方角の仕切り壁の高さ（池の底から）
// 段：池の帯（d0〜d1）、ダムの厚み（damT）、台の外周（edge）、池の底（floor）
const RING = [
  { d0: 4.5, d1: 12, damT: 1.4, edge: 15.5, floor: 27 },
  { d0: 15.5, d1: 24, damT: 1.6, edge: 28, floor: 15 },
  { d0: 28, d1: 38, damT: 1.8, edge: 42, floor: 3 },
];
const PEAK = 39;                       // 頂の台座
const TOWN = { r0: 42, r1: 62 };
const SECT = 4;
const SPAN = Math.PI / 2;
const sectorAngle = (s) => s * SPAN;   // 0 北（-z）、1 東（+x）、2 南（+z）、3 西（-x）
const dirOf = (a) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
const at = (r, a, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, -Math.cos(a) * r);

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 扇形の環（r0〜r1、角度 a0〜a1）を高さ 1 で押し出した形。y = 0〜1
function sectorGeo(r0, r1, a0, a1, seg = 48) {
  const sh = new THREE.Shape();
  const P = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];
  sh.moveTo(...P(r1, a0));
  for (let k = 1; k <= seg; k++) sh.lineTo(...P(r1, a0 + (a1 - a0) * k / seg));
  for (let k = seg; k >= 0; k--) sh.lineTo(...P(r0, a0 + (a1 - a0) * k / seg));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // 形の y が奥行き（-z）、押し出しが上（+y）になる
  return g;
}
const ringGeo = (r0, r1, seg = 160) => sectorGeo(r0, r1, 0, Math.PI * 2, seg);

export function createValley(canvas, { seed = 7 } = {}) {
  const R = rng(seed * 7 + 3);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EDE6D3');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  shared.river.value.set(-999, 999);
  const add = (geo, mat, { y = 0, h = 1, cast = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.scale.y = h; m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };

  // ---------- 築かれた山：円い石積みの台を重ねる ----------
  const masonry = masonryMat('#A49D8F', 0.9), masonryDark = masonryMat('#8C8578', 0.6);
  const grass = ground('#7FA05E', '#7A5A3C', 'grass', { seams: false }), silt = ground('#C9B48A', '#8A6A48', 'sand', { seams: false }), paving = masonryMat('#B8AE9C', 0.5);
  const BOTTOM = -2;
  add(new THREE.CylinderGeometry(RING[0].d0, RING[0].d0 + 0.3, PEAK - BOTTOM, 64), masonry, { y: (PEAK + BOTTOM) / 2 });
  RING.forEach((g) => {
    add(ringGeo(g.d0, g.edge), masonry, { y: BOTTOM, h: g.floor - BOTTOM });               // 台
    add(ringGeo(g.d0, g.d1), silt, { y: g.floor, h: 0.04, cast: false });                 // 池の底
    add(ringGeo(g.d1 + g.damT, g.edge), paving, { y: g.floor, h: 0.06, cast: false });     // ダムの外の石畳
    // 台の縁の笠石
    add(ringGeo(g.edge - 0.35, g.edge + 0.1), masonryDark, { y: g.floor, h: 0.3 });
  });
  // ふもと
  add(ringGeo(TOWN.r0, TOWN.r1, 200), grass, { y: BOTTOM, h: -BOTTOM, cast: false });
  // 方角の仕切り壁（放射状）
  RING.forEach((g) => {
    for (let s = 0; s < SECT; s++) {
      const a = sectorAngle(s) + SPAN / 2, len = g.d1 + g.damT - g.d0;
      const w = new THREE.Mesh(box, masonryDark);
      w.scale.set(0.9, WALL, len);
      w.position.copy(at(g.d0 + len / 2, a, g.floor + WALL / 2));
      w.rotation.y = -a;
      w.castShadow = w.receiveShadow = true; scene.add(w);
    }
  });
  // ふもとの木と町
  const trunk = wood('#6E4A2E', 'y'), leafs = [foliage('#4F7A44'), foliage('#6A8F4E')];
  const trunks = [], leaves = [[[], [], []], [[], [], []]];
  const townH = [], townR = [];
  for (let k = 0; k < 2600; k++) {
    const r = TOWN.r0 + 1 + R() * (TOWN.r1 - TOWN.r0 - 2), a = R() * Math.PI * 2;
    const off = Math.abs(((a % SPAN) + SPAN) % SPAN - SPAN / 2) * r; // 方角の境からの距離
    const p = at(r, a);
    if (r < TOWN.r0 + 7) {
      if (R() < 0.12 && off > 3) {
        const yaw = -a + (R() - 0.5) * 0.3;
        townH.push(m4.clone().compose(new THREE.Vector3(p.x, 0.45, p.z), new THREE.Quaternion().setFromAxisAngle(yAxis, yaw), new THREE.Vector3(1.4, 0.9, 1.1)));
        townR.push(m4.clone().compose(new THREE.Vector3(p.x, 1.2, p.z), new THREE.Quaternion().setFromAxisAngle(yAxis, yaw + Math.PI / 4), new THREE.Vector3(1.6, 1, 1.6)));
      }
    } else if (R() < 0.35) {
      const s = 1.4 + R() * 0.8;
      trunks.push(m4.clone().compose(new THREE.Vector3(p.x, 0.5 * s, p.z), q0, new THREE.Vector3(0.35 * s, 1 * s, 0.35 * s)));
      const set = leaves[R() < 0.5 ? 0 : 1];
      for (let j = 0; j < 3; j++) set[j].push(m4.clone().compose(new THREE.Vector3(p.x, (1.2 + j * 0.55) * s, p.z), new THREE.Quaternion().setFromAxisAngle(yAxis, R() * 3), new THREE.Vector3(s, s, s)));
    }
  }
  const instanced = (geo, material, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = list.length; im.castShadow = cast; im.receiveShadow = true;
    scene.add(im); return im;
  };
  instanced(box, trunk, trunks);
  leafs.forEach((lm, s) => [0, 1, 2].forEach((k) => instanced(new THREE.ConeGeometry(0.62 - k * 0.15, 0.75, 7), lm, leaves[s][k])));
  const townMat = new THREE.MeshStandardMaterial({ color: '#D9C7A0', roughness: 0.9 }), roofMat = new THREE.MeshStandardMaterial({ color: '#7A5236', roughness: 0.8 });
  instanced(box, townMat, townH);
  instanced(new THREE.ConeGeometry(0.62, 0.45, 4), roofMat, townR);

  // ---------- 池の水・ダム（石積みの弧と控え壁） ----------
  const pondMat = waterMat('#2F6E8C', 'z');
  const capMat = masonryMat('#6E6A62', 0.25);
  const DAM_OK = new THREE.Color('#9A958A'), DAM_BAD = new THREE.Color('#5E5248');
  const ponds = [];
  RING.forEach((g, ring) => {
    for (let s = 0; s < SECT; s++) {
      const i = ring * SECT + s, a0 = sectorAngle(s) - SPAN / 2, a1 = sectorAngle(s) + SPAN / 2;
      const gap = 0.45 / g.d0; // 仕切り壁の厚みの分、角度を詰める
      const w = add(sectorGeo(g.d0, g.d1, a0 + gap, a1 - gap), pondMat, { y: g.floor, h: 0.02, cast: false });
      w.userData.basin = i;
      const damMat = masonryMat('#9A958A', 0.5); // 池ごとに色を変えて、傷みを見せる
      const dam = add(sectorGeo(g.d1, g.d1 + g.damT, a0 + 0.45 / g.d1, a1 - 0.45 / g.d1), damMat, { y: g.floor, h: 1 });
      dam.userData.basin = i;
      const cap = add(sectorGeo(g.d1 - 0.15, g.d1 + g.damT + 0.15, a0 + 0.45 / g.d1, a1 - 0.45 / g.d1), capMat, { y: g.floor, h: 0.25 });
      cap.userData.basin = i;
      // 控え壁：ダムの外側に、一定の間隔で
      const n = Math.max(3, Math.round((a1 - a0) * g.d1 / 3.2));
      const buttress = [];
      for (let k = 1; k < n; k++) {
        const a = a0 + (a1 - a0) * k / n;
        const b = new THREE.Mesh(box, damMat);
        b.position.copy(at(g.d1 + g.damT + 0.6, a, g.floor)); b.rotation.y = -a;
        b.castShadow = b.receiveShadow = true; b.userData.basin = i; scene.add(b); buttress.push(b);
      }
      const fall = new THREE.Mesh(box, pondMat); fall.visible = false; scene.add(fall);
      const mid = (g.d0 + g.d1) / 2, c = at(mid, sectorAngle(s));
      ponds.push({ i, ring, sector: s, g, F: g.floor, w, dam, damMat, cap, buttress, fall, a0, a1, cx: c.x, cz: c.z, level: -1, capV: -1, spill: 0, burst: 0, health: 1 });
    }
  });
  function setPond(i, level, capV) {
    const p = ponds[i];
    if (Math.abs(p.level - level) > 0.001) { p.w.scale.y = Math.max(0.02, Math.min(level * BH, WALL - 0.3)); p.level = level; }
    if (Math.abs(p.capV - capV) > 0.001) {
      const dh = Math.min(capV * BH, WALL + 0.5);
      p.dam.scale.y = dh; p.cap.position.y = p.F + dh;
      p.buttress.forEach((b) => { b.scale.set(1.2, dh * 0.85, 1.2); b.position.y = p.F + dh * 0.425; });
      p.capV = capV;
    }
  }
  // 溢れ（細く流れ続ける）と崩壊（太く一気に）：ダムを越えて、台の縁から下の段へ落ちる水
  function drawFall(p) {
    const w = Math.max(p.spill, p.burst);
    p.fall.visible = w > 0.02;
    if (!p.fall.visible) return;
    const a = sectorAngle(p.sector), g = p.g;
    const nextFloor = p.ring + 1 < RING.length ? RING[p.ring + 1].floor : 0.2;
    const top = at(g.d1 + g.damT, a, p.F + Math.max(0.6, Math.min(p.capV, p.level) * BH));
    const bot = at(g.edge + 2.5, a, nextFloor + 0.2);
    p.fall.scale.set(0.6 + w * 9, 0.3 + w * 0.5, top.distanceTo(bot));
    p.fall.position.copy(top).add(bot).multiplyScalar(0.5);
    p.fall.lookAt(bot);
  }
  const setOverflow = (i, rate) => { ponds[i].spill = Math.min(1, rate * 1.5); };
  const collapse = (i) => { ponds[i].burst = 1; };
  // 傷み：ダムの色が暗くなり、欠片が落ちる
  const setHealth = (i, h) => { const p = ponds[i]; p.health = h; p.damMat.color.copy(DAM_OK).lerp(DAM_BAD, clamp(1 - h, 0, 1)); };
  const debris = new THREE.InstancedMesh(box, capMat, 160); debris.count = 0; debris.castShadow = true; scene.add(debris);
  const chips = [];
  function spawnChip(p) {
    const a = p.a0 + (p.a1 - p.a0) * (0.15 + Math.random() * 0.7);
    const pos = at(p.g.d1 + p.g.damT + 0.2, a, p.F + p.capV * BH * (0.4 + Math.random() * 0.5));
    chips.push({ pos, v: dirOf(a).multiplyScalar(1 + Math.random()), vy: 0, floor: p.ring + 1 < RING.length ? RING[p.ring + 1].floor : 0, life: 3, s: 0.25 + Math.random() * 0.3 });
  }
  // 水門の受け渡し：認めた申し出に沿って、池から池へ流れる水
  const sluiceMeshes = new Map();
  function setSluices(list) {
    const keep = new Set();
    for (const sl of list) {
      const key = sl.from + '>' + sl.to; keep.add(key);
      let m = sluiceMeshes.get(key);
      if (!m) {
        m = new THREE.Mesh(box, flowMat); scene.add(m); sluiceMeshes.set(key, m);
        const A = ponds[sl.from], B = ponds[sl.to];
        let a, b;
        if (A.ring !== B.ring) {
          // 下の池へ：ダムの外を、樋で斜めに下ろす
          const ang = sectorAngle(A.sector) + 0.25;
          a = at(A.g.d1 + A.g.damT, ang, A.F + Math.min(A.capV, A.level) * BH * 0.6);
          b = at(B.g.d0 + 2, ang, B.F + 0.5);
        } else {
          // 隣の池へ：仕切り壁を越えて横に渡す
          const mid = (A.g.d0 + A.g.d1) / 2;
          const wallA = (A.sector + (B.sector === (A.sector + 1) % SECT ? 0.5 : -0.5)) * SPAN;
          a = at(mid, wallA - 2.5 / mid, A.F + WALL - 0.5);
          b = at(mid, wallA + (wallA > sectorAngle(A.sector) ? 2.5 : -2.5) / mid, B.F + WALL - 1.2);
        }
        const d = new THREE.Vector3().subVectors(b, a);
        m.scale.set(d.length(), 0.25, 0.7);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
      }
      m.visible = true;
    }
    sluiceMeshes.forEach((m, k) => { if (!keep.has(k)) m.visible = false; });
  }
  // 町の水：方角ごと
  const townWater = Array.from({ length: SECT }, (_, s) => {
    const m = add(sectorGeo(TOWN.r0, TOWN.r0 + 9, sectorAngle(s) - SPAN / 2, sectorAngle(s) + SPAN / 2), pondMat, { y: 0, h: 0.5, cast: false });
    m.visible = false; return m;
  });

  // ---------- 天の滝と受け皿、樋 ----------
  const fallMat = waterMat('#3F86B0', 'z');
  const skyFall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), fallMat);
  skyFall.position.set(0, (PEAK + 1 + 140) / 2, 0); skyFall.scale.set(1.6, 140 - PEAK - 1, 1.6);
  scene.add(skyFall);
  const basin = add(new THREE.CylinderGeometry(3.6, 3.2, 1.2, 48), stone('#8C8A86'), { y: PEAK + 0.6 });
  add(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 48), fallMat, { y: PEAK + 1.22, cast: false });
  const hut = new THREE.Mesh(box, wood('#857058', 'x')); hut.scale.set(1.6, 1.4, 1.4); hut.position.set(2.9, PEAK + 0.7, 2.2); hut.castShadow = true; scene.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.8, 4), roofMat); hutRoof.rotation.y = Math.PI / 4; hutRoof.position.set(2.9, PEAK + 1.8, 2.2); scene.add(hutRoof);
  // 樋：受け皿から放射状に、柱で支えて各池の上まで
  const troughMat = wood('#6E4A2E', 'x'), flowMat = waterMat('#3F86B0', 'x');
  const heightAtR = (r) => { if (r < RING[0].d0) return PEAK; for (const g of RING) if (r < g.edge) return g.floor; return 0; };
  const seg = (a, b, w, mat) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(box, mat);
    m.scale.set(len, 0.18, w);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    m.castShadow = true; scene.add(m);
    return m;
  };
  const troughs = ponds.map((p) => {
    const a = sectorAngle(p.sector) + (p.ring - 1) * 0.16;
    const mid = (p.g.d0 + p.g.d1) / 2;
    const s0 = at(3.4, a, PEAK + 1);
    const s1 = at(mid, a, p.F + WALL + 0.6);
    seg(s0, s1, 0.5, troughMat);
    for (let t = 0.15; t < 1; t += 0.12) {
      const pt = new THREE.Vector3().lerpVectors(s0, s1, t);
      const h = heightAtR(Math.hypot(pt.x, pt.z));
      if (pt.y - h > 1) { const post = new THREE.Mesh(box, troughMat); post.scale.set(0.22, pt.y - h, 0.22); post.position.set(pt.x, (pt.y + h) / 2, pt.z); post.castShadow = true; scene.add(post); }
    }
    const flow = seg(s0.clone().setY(s0.y + 0.12), s1.clone().setY(s1.y + 0.12), 0.3, flowMat);
    const spout = new THREE.Mesh(box, flowMat); spout.scale.set(0.3, WALL + 0.6, 0.3); spout.position.copy(s1).setY(p.F + (WALL + 0.6) / 2); scene.add(spout);
    flow.visible = spout.visible = false;
    return { flow, spout };
  });
  // 樋の水：池ごとの一日あたりの流れ（flow）に合わせた太さで、流れ続ける
  function setTroughs(flow) {
    troughs.forEach((t, i) => {
      const v = flow[i] > 0.005;
      t.flow.visible = t.spout.visible = v;
      if (v) { const w = 0.06 + flow[i] * 0.8; t.flow.scale.z = Math.min(0.42, w); t.spout.scale.x = t.spout.scale.z = Math.min(1.2, w * 2.2); }
    });
  }

  // ---------- 家（積み木）と人 ----------
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#1E1B22', side: THREE.BackSide });
  const winMat = new THREE.MeshStandardMaterial({ color: '#2A2620', roughness: 0.6 });
  const houses = new Map();
  const HW = 1.7; // 家の幅
  // 家を建てられる場所：池の中に、弧に沿って間をあけて並べる
  const slots = ponds.map((p) => {
    const out = [];
    for (let r = p.g.d0 + 2; r <= p.g.d1 - 1.8; r += 3.2) {
      const margin = 2.2 / r, n = Math.floor((p.a1 - p.a0 - 2 * margin) * r / 3.4);
      for (let k = 0; k <= n; k++) {
        const a = p.a0 + margin + (p.a1 - p.a0 - 2 * margin) * (n ? k / n : 0.5) + (r % 2) * 0.03;
        const v = at(r, a); out.push([v.x, v.z, a]);
      }
    }
    // 真ん中寄りから使う
    const mid = (p.a0 + p.a1) / 2;
    return out.sort((x, y) => Math.abs(x[2] - mid) - Math.abs(y[2] - mid));
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
      rig.root.scale.setScalar(0.95);
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
    const [bx, bz, ba] = slotFor(h);
    H.group.position.set(bx, ponds[h.layer].F, bz); H.group.rotation.y = -ba;
    const n = h.blocks.length - (hideTop ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const b = h.blocks[k];
      if (b.foundation) continue;
      // 段ごとに少しずらして、積み木らしく
      const jx = ((k * 37) % 7 - 3) * 0.03, jz = ((k * 53) % 5 - 2) * 0.03;
      const m = new THREE.Mesh(box, b.sunk ? H.sunkMat : H.wallMat);
      m.scale.set(HW, BH * 0.97, HW);
      m.position.set(jx, BH * (k + 0.5), jz);
      m.castShadow = true; m.receiveShadow = true; m.userData.home = h.id;
      H.group.add(m);
      if (!b.sunk) for (const [ox, oz, sx, sz] of [[0, HW / 2 + 0.01, 0.4, 0.02], [HW / 2 + 0.01, 0, 0.02, 0.4], [0, -HW / 2 - 0.01, 0.4, 0.02], [-HW / 2 - 0.01, 0, 0.02, 0.4]]) {
        const win = new THREE.Mesh(box, winMat); win.scale.set(sx, BH * 0.42, sz); win.position.set(jx + ox, m.position.y, jz + oz); H.group.add(win);
      }
    }
    const topY = BH * n;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(HW * 0.82, 0.8, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.position.set(0.25, topY + 0.4, -0.25); roof.scale.set(0.75, 1, 0.75);
    roof.castShadow = true; roof.userData.home = h.id; H.group.add(roof);
    const slab = new THREE.Mesh(box, roofMat); slab.scale.set(HW + 0.1, 0.1, HW + 0.1); slab.position.y = topY + 0.05; slab.userData.home = h.id; H.group.add(slab);
    H.home = new THREE.Vector3(-0.4, topY + 0.1, 0.4).applyAxisAngle(yAxis, -ba).add(new THREE.Vector3(bx, ponds[h.layer].F, bz));
    if (!H.placed) { H.rig.root.position.copy(H.home); H.placed = true; }
    return H;
  }
  function moveFigure(id, to, sit = 0, hammer = 0) {
    const H = houses.get(id);
    H.from = H.rig.root.position.clone(); H.target = to.clone(); H.t = 0; H.sit = sit; H.hammer = hammer;
  }
  const damSpot = (i, k) => { const p = ponds[i], a = p.a0 + (p.a1 - p.a0) * (0.15 + ((k * 0.37) % 0.7)); return at(p.g.d1 + p.g.damT / 2, a, p.F + Math.min(p.capV * BH, WALL + 0.5) + 0.25); };

  // ---------- 光・カメラ ----------
  scene.add(new THREE.HemisphereLight('#FFF4E0', '#8A8478', 1.6)); // 地面側の光は中立にして、石を緑に寄せない
  const sun = new THREE.DirectionalLight('#FFE2B8', 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 260 });
  scene.add(sun); scene.add(sun.target);
  let cam, fx, W, H0;
  // 視点は滝の軸（山の中心）のまわりを回る。平行移動した分（focus の x・z）も一緒に回す
  const view = { focus: new THREE.Vector3(0, 10, 0), zoom: 1, yaw: Math.PI / 4, yawTarget: Math.PI / 4 };
  function placeCam() {
    const a = W / H0, s = (a < 1 ? 64 / a : 50) / view.zoom;
    cam.left = -s * a; cam.right = s * a; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix();
    cam.position.set(view.focus.x + Math.sin(view.yaw) * 80, view.focus.y + 66, view.focus.z + Math.cos(view.yaw) * 80);
    cam.lookAt(view.focus);
    sun.position.set(-50, 110, 30); sun.target.position.set(0, 0, 0);
  }
  function size() {
    W = canvas.clientWidth; H0 = canvas.clientHeight;
    renderer.setSize(W, H0, false);
    cam = cam || new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    placeCam();
    fx = colorDither(renderer, W, H0, PALETTE);
  }
  size(); addEventListener('resize', size);
  const toScreen = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H0, p.z]; };
  function pan(dx, dy) {
    const s = (cam.top - cam.bottom) / H0;
    const right = new THREE.Vector3(Math.cos(view.yaw), 0, -Math.sin(view.yaw)), fwd = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    view.focus.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s * 1.6);
    const r = Math.hypot(view.focus.x, view.focus.z); if (r > 50) { view.focus.x *= 50 / r; view.focus.z *= 50 / r; }
    placeCam();
  }
  const zoom = (f) => { view.zoom = clamp(view.zoom * f, 0.8, 9); placeCam(); };
  const rotate = (k) => { view.yawTarget += k * Math.PI / 4; };
  // 池へ寄せる：その池が手前に来るまで滝の軸のまわりを回し、近づく
  const focusOn = (i) => {
    const p = ponds[i];
    const want = Math.atan2(p.cx, p.cz);
    const d = Math.atan2(Math.sin(want - view.yaw), Math.cos(want - view.yaw));
    // 回し終えたときに池が真ん中に来るよう、回す前の位置へ置いておく
    const x = p.cx, z = p.cz;
    view.focus.set(x * Math.cos(-d) + z * Math.sin(-d), p.F + 3, -x * Math.sin(-d) + z * Math.cos(-d));
    view.yawTarget = view.yaw + d;
    view.zoom = Math.max(view.zoom, 3);
    placeCam();
  };
  const home = () => { view.focus.set(0, 10, 0); view.zoom = 1; placeCam(); };
  const ray = new THREE.Raycaster();
  function pick(px, py) {
    ray.setFromCamera(new THREE.Vector2(px / W * 2 - 1, -(py / H0) * 2 + 1), cam);
    const objs = [];
    houses.forEach((H) => objs.push(...H.group.children, H.rig.root));
    ponds.forEach((p) => objs.push(p.w, p.dam, p.cap, ...p.buttress));
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
    if (Math.abs(view.yawTarget - view.yaw) > 0.001) {
      const d = (view.yawTarget - view.yaw) * Math.min(1, dt * 6);
      view.yaw += d;
      const { x, z } = view.focus;
      view.focus.x = x * Math.cos(d) + z * Math.sin(d); view.focus.z = -x * Math.sin(d) + z * Math.cos(d);
      placeCam();
    }
    // 溢れ・崩壊の水と、落ちる欠片
    ponds.forEach((p) => {
      if (p.burst > 0) p.burst = Math.max(0, p.burst - dt * 0.5);
      drawFall(p);
      if (p.health < 0.35 && Math.random() < dt * (0.35 - p.health) * 14) spawnChip(p);
    });
    for (let k = chips.length - 1; k >= 0; k--) {
      const c = chips[k]; c.life -= dt; c.vy -= 18 * dt;
      c.pos.addScaledVector(c.v, dt); c.pos.y += c.vy * dt;
      if (c.pos.y < c.floor) { c.pos.y = c.floor; c.vy = 0; c.v.multiplyScalar(0.8); }
      if (c.life <= 0) chips.splice(k, 1);
    }
    debris.count = Math.min(160, chips.length);
    for (let k = 0; k < debris.count; k++) debris.setMatrixAt(k, m4.compose(chips[k].pos, q0, new THREE.Vector3(chips[k].s, chips[k].s, chips[k].s)));
    debris.instanceMatrix.needsUpdate = true;
    const wobble = 1 + Math.sin(t * 3.1) * 0.04;
    skyFall.scale.x = skyFall.scale.z = (1.2 + flowAmt * 2) * wobble;
    houses.forEach((Hh, id) => {
      const rig = Hh.rig;
      if (Hh.target && Hh.t < 1) {
        Hh.t = Math.min(1, Hh.t + dt / 1.1);
        const k = Hh.t * Hh.t * (3 - 2 * Hh.t);
        rig.root.position.lerpVectors(Hh.from, Hh.target, k);
        rig.root.position.y += Math.sin(Math.PI * k) * 2.5;
        const d = new THREE.Vector3().subVectors(Hh.target, Hh.from);
        if (d.lengthSq() > 0.01) rig.root.rotation.y = Math.atan2(d.x, d.z);
      }
      const moving = Hh.target && Hh.t < 1;
      rig.animate(t, { phase: t * 7, amp: moving ? 0.5 : 0, nod: Hh.hammer ? 0.25 + Math.sin(t * 9) * 0.25 : Hh.sit * 0.4, sorrow: Hh.sorrow || 0, lean: Hh.hammer ? 0.3 : 0 });
      rig.topMat.userData.sorrow.value = Hh.sorrow || 0;
      rig.bottomMat.userData.sorrow.value = Hh.sorrow || 0;
      rig.root.scale.setScalar(selected.id === id ? 1.15 : 0.95);
    });
    for (const k in mood) mood[k] += (moodTarget[k] - mood[k]) * Math.min(1, dt * 2.5);
    const u = fx.uniforms;
    for (const k in mood) u[k].value = mood[k];
    u.time.value = t;
    fx.render(scene, cam, 2);
  }

  return {
    update, setPond, setOverflow, collapse, setHealth, setSluices, setTroughs, buildHouse, moveFigure, damSpot, roofSpot: (id) => houses.get(id).home.clone(), houses, toScreen, pick, pan, zoom, rotate, focusOn, home, selected,
    setFlow: (v) => { flowAmt = v; }, setMood: (m) => Object.assign(moodTarget, m),
    setTown: (sector, on) => { townWater[sector].visible = on; },
    labelPoint: (i) => { const p = ponds[i]; return new THREE.Vector3(p.cx, p.F + WALL + 1.2, p.cz); },
    gatePoint: () => new THREE.Vector3(0, PEAK + 3.5, 0),
    headOf: (id) => { const v = new THREE.Vector3(); houses.get(id).rig.root.getWorldPosition(v); v.y += 1.3; return v; },
  };
}
