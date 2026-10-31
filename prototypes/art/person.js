// ふつうの人間の体つき（およそ七頭身）。関節ごとに組んで、歩くときは脚と腕を振る。
import * as THREE from 'three';
import { cloth } from './materials.js';

const std = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

// opts: { top, bottom, skin, hair, height, build, stoop, hairStyle }
export function makePerson(opts, outlineMat) {
  const H = opts.height ?? 1.12;
  const w = opts.build ?? 1;
  const k = H / 1.12;
  const topMat = cloth(opts.top);
  const bottomMat = cloth(opts.bottom);
  const skin = std(opts.skin ?? '#E3C3A3');
  const hairMat = std(opts.hair ?? '#2E2620', 0.7);
  const root = new THREE.Group();
  const meshes = [];
  const add = (parent, geo, mat, pos, scale) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    parent.add(m); meshes.push(m);
    return m;
  };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 10);
  const joint = (parent, pos) => { const j = new THREE.Group(); j.position.set(...pos); parent.add(j); return j; };

  // 脚（股関節→膝）
  const hipY = 0.56 * k;
  const legs = [-1, 1].map((side) => {
    const hip = joint(root, [0.055 * w * side, hipY, 0]);
    add(hip, cap(0.048 * w, 0.2 * k), bottomMat, [0, -0.13 * k, 0]);
    const knee = joint(hip, [0, -0.27 * k, 0]);
    add(knee, cap(0.04 * w, 0.2 * k), bottomMat, [0, -0.13 * k, 0]);
    add(knee, new THREE.BoxGeometry(0.07 * w, 0.04, 0.13), std('#2E2A26'), [0, -0.255 * k, 0.03]);
    return { hip, knee };
  });
  // 胴
  const spine = joint(root, [0, hipY, 0]);
  add(spine, cap(0.085 * w, 0.06 * k), bottomMat, [0, 0.03 * k, 0], [1.05, 1, 0.7]);
  const chest = joint(spine, [0, 0.07 * k, 0]);
  add(chest, cap(0.1 * w, 0.18 * k), topMat, [0, 0.15 * k, 0], [1, 1, 0.66]);
  // 首と頭（頭は小さめ、縦に少し長い）
  const neck = joint(chest, [0, 0.33 * k, 0]);
  add(neck, new THREE.CylinderGeometry(0.03, 0.035, 0.06 * k, 8), skin, [0, 0.02 * k, 0]);
  const head = joint(neck, [0, 0.11 * k, 0]);
  add(head, new THREE.SphereGeometry(0.068 * k, 16, 12), skin, [0, 0, 0.005], [0.95, 1.18, 1.0]);
  const hs = opts.hairStyle ?? 'short';
  add(head, new THREE.SphereGeometry(0.073 * k, 16, 10, 0, Math.PI * 2, 0, Math.PI * (hs === 'bald' ? 0.25 : 0.55)), hairMat, [0, 0.012, -0.008], [0.98, 1.18, 1.04]);
  if (hs === 'long') add(head, new THREE.BoxGeometry(0.13 * k, 0.16 * k, 0.05), hairMat, [0, -0.06 * k, -0.05]);
  if (hs === 'tied') add(head, new THREE.SphereGeometry(0.035, 10, 8), hairMat, [0, 0.03, -0.085]);
  // 腕（肩→肘）
  const arms = [-1, 1].map((side) => {
    const sh = joint(chest, [0.125 * w * side, 0.29 * k, 0]);
    add(sh, cap(0.034 * w, 0.17 * k), topMat, [0, -0.11 * k, 0]);
    const el = joint(sh, [0, -0.23 * k, 0]);
    add(el, cap(0.028 * w, 0.15 * k), skin, [0, -0.1 * k, 0]);
    const hand = joint(el, [0, -0.2 * k, 0]);
    return { sh, el, hand };
  });

  // 持ち物
  const P = opts.prop;
  if (P === 'pack') add(chest, new THREE.BoxGeometry(0.2, 0.26, 0.12), std('#5E4630'), [0, 0.16 * k, -0.12]);
  if (P === 'bucket') add(arms[1].hand, new THREE.CylinderGeometry(0.06, 0.045, 0.1, 10), std('#CFCABC'), [0, -0.05, 0]);
  if (P === 'bag') add(spine, new THREE.BoxGeometry(0.16, 0.13, 0.06), std('#6E4F33'), [0.1 * w, 0.0, 0.07]);
  if (P === 'camera') add(chest, new THREE.BoxGeometry(0.1, 0.065, 0.05), std('#2A2A2A'), [0, 0.18 * k, 0.09]);
  if (P === 'cane') add(arms[1].hand, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), std('#4A3426'), [0, -0.2, 0.02]);

  // 細い輪郭線
  meshes.forEach((m) => {
    const h = new THREE.Mesh(m.geometry, outlineMat);
    h.position.copy(m.position); h.scale.copy(m.scale).multiplyScalar(1.09);
    m.parent.add(h);
  });

  const stoop = opts.stoop ?? 0;
  spine.rotation.x = stoop * 0.22;
  neck.rotation.x = stoop * 0.15;

  // 歩き・立ち・身じろぎ
  function animate(t, { walking = false, speed = 1, sorrow = 0, tension = 0 } = {}) {
    const ph = t * 6.5 * speed;
    const amp = walking ? 0.5 : 0;
    legs.forEach((L, i) => {
      const s = Math.sin(ph + i * Math.PI);
      L.hip.rotation.x = s * amp;
      L.knee.rotation.x = walking ? Math.max(0, -Math.cos(ph + i * Math.PI)) * 0.7 : 0;
    });
    arms.forEach((A, i) => {
      const s = Math.sin(ph + (1 - i) * Math.PI);
      A.sh.rotation.x = walking ? s * 0.45 : 0.02 + sorrow * 0.05;
      A.sh.rotation.z = (i ? -1 : 1) * (0.08 + tension * 0.25);
      A.el.rotation.x = walking ? -0.35 : -0.12 - tension * 0.6;
    });
    // 歩くときの上下動と、うつむき
    root.position.y = walking ? Math.abs(Math.cos(ph)) * 0.02 : 0;
    spine.rotation.x = stoop * 0.22 + sorrow * 0.1;
    neck.rotation.x = stoop * 0.15 + sorrow * 0.3;
    // 張りつめると肩が上がる
    chest.position.y = 0.07 * k + tension * 0.012;
  }

  return { root, animate, topMat, bottomMat };
}
