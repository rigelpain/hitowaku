// 案A・案C で共有する記録庫の立体。見え方（光・色・描き方）だけを案ごとに変える。
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';

export const PEOPLE = [
  { name: '春日 灯', color: '#C9785B', prop: 'bucket' },
  { name: '大槻 文雄', color: '#5F84A6', prop: 'bag' },
  { name: '森 由真', color: '#C2A04E', prop: 'camera' },
  { name: '渡瀬 透', color: '#8C6E9C', prop: 'pot' },
];

export function buildRoom(pal) {
  const root = new THREE.Group();
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const rbox = (w, h, d, r, m) => {
    const g = new RoundedBoxGeometry(w, h, d, 3, r);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); root.add(mesh); return mesh; };

  // 床と壁（切り取ったジオラマ）
  add(rbox(10, 0.5, 7, 0.08, mat(pal.base)), 0, -0.25, 0);
  const floor = add(rbox(9.6, 0.06, 6.6, 0.02, mat(pal.floor)), 0, 0.03, 0);
  floor.castShadow = false;
  // 床板の目地
  for (let i = -4; i <= 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 6.6), mat(pal.floorLine)), i * 1.07, 0.065, 0);
  add(rbox(10, 3.6, 0.3, 0.05, mat(pal.wall)), 0, 1.8, -3.35);
  add(rbox(0.3, 3.6, 7, 0.05, mat(pal.wall2)), -4.85, 1.8, 0);
  // 窓（左の壁）
  const win = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 1.6), new THREE.MeshBasicMaterial({ color: pal.window })), -4.68, 2.1, 1.0);
  win.castShadow = false;

  // 棚。真ん中の段に一枠だけ空きがある
  const shelf = new THREE.Group();
  const wood = mat(pal.wood);
  const W = 6.2, H = 3.0, D = 0.8;
  const part = (w, h, d, x, y, z, m = wood) => { const b = rbox(w, h, d, 0.03, m); b.position.set(x, y, z); shelf.add(b); return b; };
  part(W, 0.12, D, 0, 0.06, 0);
  part(W, 0.12, D, 0, H, 0);
  part(0.12, H, D, -W / 2, H / 2, 0);
  part(0.12, H, D, W / 2, H / 2, 0);
  part(W, H, 0.08, 0, H / 2, -D / 2 + 0.04);
  const rows = 3;
  const books = pal.books;
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let slotPos = null;
  for (let r = 0; r < rows; r++) {
    const y0 = 0.12 + (r * (H - 0.12)) / rows;
    if (r > 0) part(W, 0.08, D, 0, y0, 0);
    let x = -W / 2 + 0.12;
    const gapAt = r === 1 ? -1.6 : null;
    while (x < W / 2 - 0.3) {
      if (gapAt !== null && Math.abs(x - gapAt) < 0.4 && !slotPos) {
        slotPos = new THREE.Vector3(gapAt + 0.1, y0 + 0.45, 0);
        x += 0.95; continue;
      }
      const bw = 0.1 + rnd() * 0.1;
      const bh = 0.55 + rnd() * 0.3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * 0.7), mat(books[Math.floor(rnd() * books.length)]));
      b.position.set(x + bw / 2, y0 + 0.04 + bh / 2, 0.05);
      if (rnd() < 0.08) { b.rotation.z = 0.18; b.position.x += 0.04; }
      b.castShadow = true; b.receiveShadow = true;
      shelf.add(b);
      x += bw + 0.01;
    }
  }
  // 空き枠：案ごとに光らせ方を変えるため、名前をつけておく
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.85, 0.05), new THREE.MeshBasicMaterial({ color: pal.slot }));
  slot.position.copy(slotPos).add(new THREE.Vector3(0, 0, -0.3));
  slot.name = 'slot';
  shelf.add(slot);
  shelf.position.set(-0.6, 0.06, -2.7);
  root.add(shelf);

  // 選ぶ側の机（話を聞く場所）
  const desk = new THREE.Group();
  const dk = (w, h, d, x, y, z, m = wood) => { const b = rbox(w, h, d, 0.03, m); b.position.set(x, y, z); desk.add(b); };
  dk(1.8, 0.08, 1.0, 0, 0.8, 0);
  [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].forEach(([x, z]) => dk(0.08, 0.8, 0.08, x, 0.4, z));
  dk(0.5, 0.04, 0.35, -0.3, 0.86, 0.1, mat(pal.paper));
  dk(0.06, 0.5, 0.06, 0.6, 1.08, -0.25, mat(pal.ink));
  const shade = rbox(0.34, 0.2, 0.34, 0.06, mat(pal.lampShade, { emissive: pal.lampGlow, emissiveIntensity: pal.lampEmissive }));
  shade.position.set(0.6, 1.36, -0.25); desk.add(shade);
  // 椅子と、聞き手（人ではなく、顔のない机の主として）
  dk(0.55, 0.06, 0.55, 0, 0.5, -0.9);
  dk(0.55, 0.7, 0.06, 0, 0.85, -1.15);
  [[-0.24, -0.66], [0.24, -0.66], [-0.24, -1.12], [0.24, -1.12]].forEach(([x, z]) => dk(0.05, 0.5, 0.05, x, 0.25, z));
  desk.position.set(2.6, 0.06, -0.6);
  desk.rotation.y = -0.35;
  root.add(desk);
  const lamp = new THREE.PointLight(pal.lampLight, pal.lampIntensity, 6, 1.6);
  lamp.position.set(2.75, 1.3, -0.9);
  root.add(lamp);

  // 人。こけしのような木の人形に、その人の暮らしを表す持ち物をひとつ
  const figures = [];
  const spots = [[-2.6, 1.9], [-1.1, 2.3], [0.4, 2.1], [1.7, 2.6]];
  PEOPLE.forEach((p, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 6, 16), mat(pal.people?.[i] ?? p.color));
    body.position.y = 0.56; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), mat(pal.skin));
    head.position.y = 1.2; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(pal.hair[i % pal.hair.length]));
    hair.position.y = 1.22; hair.rotation.x = -0.25; hair.castShadow = true; g.add(hair);
    g.add(prop(p.prop, mat, pal));
    g.position.set(spots[i][0], 0.06, spots[i][1]);
    g.lookAt(desk.position.x, 0.06, desk.position.z);
    root.add(g);
    figures.push(g);
  });

  return { root, slot, figures, desk };
}

function prop(kind, mat, pal) {
  const g = new THREE.Group();
  const m = (c) => { const x = mat(c); return x; };
  if (kind === 'bucket') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.26, 16), m('#D7D3C6'));
    b.position.set(0.42, 0.35, 0.05); g.add(b);
  } else if (kind === 'bag') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.14), m('#7B5B3A'));
    b.position.set(0.34, 0.55, 0.12); g.add(b);
  } else if (kind === 'camera') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), m('#2C2C2C'));
    b.position.set(0, 0.86, 0.32); g.add(b);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), m('#555'));
    l.rotation.x = Math.PI / 2; l.position.set(0, 0.86, 0.42); g.add(l);
  } else if (kind === 'pot') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.18, 14), m('#A9643F'));
    b.position.set(0, 0.62, 0.36); g.add(b);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), m('#E8B93A'));
    f.position.set(0, 0.8, 0.36); g.add(f);
  }
  g.children.forEach((c) => { c.castShadow = true; });
  return g;
}

export function isoCamera(aspect, size = 7.2) {
  const cam = new THREE.OrthographicCamera(-size * aspect, size * aspect, size, -size, 0.1, 100);
  cam.position.set(14, 12, 14);
  cam.lookAt(0, 0.9, 0);
  return cam;
}
