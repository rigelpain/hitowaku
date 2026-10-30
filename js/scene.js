// 上部のジオラマ。黒板の上に置いた紙の模型のような見た目にしている。
import { makeIso, shade } from './iso.js';

const COL = {
  board: '#2E4638',
  paper: '#D9D5C4',
  paperDark: '#BDB8A3',
  wood: '#A18F70',
  ink: '#4A4840',
  chalk: '#E9C64B',
  water: '#46666B',
  face: '#ECE8DA',
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 人が並ぶ位置。最大 8 人まで描く（それ以上は先頭の 8 人）
function queueSpot(i, n) {
  // 手前に横一列に並ぶ（画面上でほぼ水平になる向き）
  const step = Math.min(1.3, 7.2 / Math.max(1, n));
  return { x: 1.6 + i * step, y: 6.3 - i * step * 0.62 };
}

const SLOT = {
  archive: { x: 4.3, y: 3.1, z: 0 },
  ferry: { x: 4.6, y: 2.25, z: 0.5 },
  sequel: { x: 3.0, y: 3.2, z: 0 },
};

export function createScene(canvas, { onPick } = {}) {
  const ctx = canvas.getContext('2d');
  let state = { setting: 'archive', people: [], chosenId: null, highlightId: null };
  let hits = [];
  let tagPos = [];
  let anim = null; // { id, t0, from, to }
  let dpr = 1, cssW = 0, cssH = 0;
  const tagListeners = new Set();

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = r.width; cssH = r.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    draw();
  }

  function frame() {
    // 台の四隅と、いちばん高いものの上端が収まるように縮尺を決める
    const probe = makeIso(ctx, 1, 0, 0);
    const pts = [];
    [0, 10].forEach((x) => [0, 7].forEach((y) => { pts.push(probe.P(x, y, -0.8)); pts.push(probe.P(x, y, 3.8)); }));
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const unit = Math.min((cssW * 0.94) / (maxX - minX), (cssH * 0.9) / (maxY - minY));
    const ox = cssW / 2 - ((minX + maxX) / 2) * unit;
    const oy = cssH / 2 - ((minY + maxY) / 2) * unit;
    return makeIso(ctx, unit, ox, oy);
  }

  function personPos(p, i, now) {
    const spot = queueSpot(i, Math.min(8, state.people.length));
    const slot = SLOT[state.setting] || SLOT.archive;
    if (anim && anim.id === p.id) {
      const raw = Math.min(1, (now - anim.t0) / anim.dur);
      const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      // 最初に手前へ一歩出てから枠へ向かう
      const mid = { x: spot.x - 0.3, y: Math.min(spot.y, slot.y + 1.6), z: 0 };
      const a = t < 0.4 ? spot : mid;
      const b = t < 0.4 ? mid : slot;
      const k = t < 0.4 ? t / 0.4 : (t - 0.4) / 0.6;
      const z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * Math.min(1, k * 1.6);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z, bob: Math.abs(Math.sin(raw * Math.PI * 7)) * 0.07 };
    }
    if (state.chosenId === p.id && !anim) return { ...slot, bob: 0 };
    return { ...spot, z: 0, bob: 0 };
  }

  function drawFigure(iso, p, pos) {
    const { x, y } = pos;
    const z = (pos.z || 0) + (pos.bob || 0);
    const legs = shade(p.color, -0.45);
    const k = 1.35;
    iso.box(x - 0.15 * k, y - 0.15 * k, z, 0.3 * k, 0.3 * k, 0.32 * k, legs);
    iso.box(x - 0.2 * k, y - 0.2 * k, z + 0.32 * k, 0.4 * k, 0.4 * k, 0.46 * k, p.color);
    iso.box(x - 0.15 * k, y - 0.15 * k, z + 0.78 * k, 0.3 * k, 0.3 * k, 0.3 * k, COL.face);
    const marked = state.highlightId === p.id;
    if (marked) iso.box(x - 0.1, y - 0.1, z + 1.75, 0.2, 0.2, 0.2, COL.chalk);
    const head = iso.P(x, y, z + 1.08 * k);
    const foot = iso.P(x, y, z);
    const w = iso.unit * 0.55;
    hits.push({ id: p.id, x0: head[0] - w, x1: head[0] + w, y0: head[1] - iso.unit * 0.2, y1: foot[1] + iso.unit * 0.3 });
    tagPos.push({ id: p.id, x: head[0], y: head[1] - iso.unit * (marked ? 0.75 : 0.3) });
  }

  function drawPlatform(iso) {
    const { box, top } = iso;
    if (state.setting === 'ferry') {
      box(0, 0, -0.75, 10, 3.2, 0.45, COL.water, { top: shade(COL.water, 0.08) });
      box(0, 3.2, -0.6, 10, 3.8, 0.6, COL.paperDark, { top: COL.paper });
      top(0, 3.2, 0, (c) => {
        c.fillStyle = shade(COL.paper, -0.05);
        for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) c.fillRect(i, j * 0.95, 1, 0.95);
      });
      // 水面のゆらぎは線ではなく、少し明るい短い帯で表す
      top(0, 0, -0.3, (c) => {
        c.fillStyle = shade(COL.water, 0.18);
        [[1, 0.5], [6.5, 0.4], [8, 1.6], [0.5, 2.4], [7.2, 2.7]].forEach(([u, v]) => c.fillRect(u, v, 1.2, 0.08));
      });
      return;
    }
    box(0, 0, -0.6, 10, 7, 0.6, COL.paperDark, { top: COL.paper });
    top(0, 0, 0, (c) => {
      c.fillStyle = shade(COL.paper, -0.05);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) c.fillRect(i, j, 1, 1);
    });
  }

  function slotFilledColor() {
    const p = state.people.find((x) => x.id === state.chosenId);
    return p && !anim ? p.color : null;
  }

  function drawArchive(iso) {
    const { box, front } = iso;
    const x = 1.0, y = 1.0, w = 5.2, d = 1.2, h = 3.4;
    box(x, y, 0, w, d, h, COL.wood);
    const filled = slotFilledColor();
    front(x, y + d, h, (c) => {
      const rows = 4, rowH = (h - 0.4) / rows;
      const bookCols = ['#7E6F57', '#93846A', '#6B6250', '#A9997B', '#857A66', '#5F5848'];
      for (let r = 0; r < rows; r++) {
        const v = 0.2 + r * rowH;
        c.fillStyle = shade(COL.wood, -0.35);
        c.fillRect(0.2, v, w - 0.4, rowH - 0.12);
        let u = 0.25, k = r * 3;
        const last = r === rows - 1;
        const stop = last ? w - 1.45 : w - 0.25;
        while (u < stop - 0.12) {
          const bw = 0.16 + ((k * 37) % 5) * 0.03;
          const bh = rowH - 0.2 - ((k * 13) % 3) * 0.08;
          c.fillStyle = bookCols[k % bookCols.length];
          c.fillRect(u, v + (rowH - 0.12 - bh), Math.min(bw, stop - u), bh);
          u += bw + 0.02; k++;
        }
        if (last) {
          // 最後の一段に残った一枠
          c.fillStyle = filled ? COL.chalk : shade(COL.chalk, -0.45);
          c.fillRect(w - 1.35, v + 0.06, 1.05, rowH - 0.24);
          if (filled) {
            c.fillStyle = filled;
            c.fillRect(w - 1.0, v + 0.14, 0.34, rowH - 0.4);
          }
        }
      }
    });
    // 脚立
    box(6.7, 2.2, 0, 0.5, 0.5, 1.1, shade(COL.wood, -0.1));
    box(6.7, 2.7, 0, 0.5, 0.5, 0.55, shade(COL.wood, -0.1));
  }

  function drawFerry(iso) {
    const { box, front, side } = iso;
    // 桟橋
    box(6.4, 1.1, -0.35, 1.3, 2.1, 0.35, COL.wood);
    box(6.5, 1.15, -0.75, 0.2, 0.2, 0.4, shade(COL.wood, -0.3));
    // 船体と船室
    const hull = '#3D4F55';
    box(1.0, 1.2, -0.45, 5.0, 1.8, 0.95, hull, { top: '#8C8B7C' });
    box(1.4, 1.4, 0.5, 1.7, 1.4, 1.0, COL.face);
    front(1.4, 2.8, 1.5, (c) => {
      c.fillStyle = '#5B6E73';
      [0.2, 0.75, 1.3].forEach((u) => c.fillRect(u, 0.25, 0.3, 0.35));
    });
    side(3.1, 2.8, 1.5, (c) => {
      c.fillStyle = '#5B6E73';
      c.fillRect(0.3, 0.25, 0.8, 0.35);
    });
    box(1.9, 1.7, 1.5, 0.4, 0.4, 0.6, shade(hull, 0.1));
    // 座席。最後の一席だけ黄色
    const filled = slotFilledColor();
    for (let i = 0; i < 4; i++) {
      const sx = 3.5 + i * 0.6;
      const last = i === 3;
      const col = last ? (filled ? COL.chalk : shade(COL.chalk, -0.45)) : '#6C7A72';
      if (!last || !filled) box(sx, 1.5, 0.5, 0.42, 0.42, 0.35, col);
      else box(sx, 1.5, 0.5, 0.42, 0.42, 0.35, col);
    }
  }

  function drawSequel(iso) {
    const { box, top } = iso;
    // 本棚
    box(0.8, 0.6, 0, 3.6, 0.7, 2.6, shade(COL.wood, -0.05));
    iso.front(0.8, 1.3, 2.6, (c) => {
      const cols = ['#7E6F57', '#93846A', '#6B6250', '#A9997B'];
      for (let r = 0; r < 3; r++) {
        c.fillStyle = shade(COL.wood, -0.38);
        c.fillRect(0.15, 0.2 + r * 0.8, 3.3, 0.66);
        for (let k = 0; k < 15; k++) {
          c.fillStyle = cols[(k + r) % 4];
          c.fillRect(0.2 + k * 0.21, 0.28 + r * 0.8, 0.17, 0.58);
        }
      }
    });
    // 机・椅子・開いた本・灯り
    box(1.6, 1.9, 0, 2.6, 1.3, 1.0, COL.wood);
    box(2.4, 3.35, 0, 0.8, 0.8, 0.55, shade(COL.wood, -0.15));
    box(2.4, 4.05, 0, 0.8, 0.15, 1.2, shade(COL.wood, -0.15));
    const filled = slotFilledColor();
    const pageCol = filled ? COL.chalk : shade(COL.chalk, -0.45);
    box(2.2, 2.25, 1.0, 0.75, 0.9, 0.06, pageCol, { top: pageCol });
    box(2.97, 2.25, 1.0, 0.75, 0.9, 0.06, pageCol, { top: shade(pageCol, 0.12) });
    top(2.2, 2.25, 1.06, (c) => {
      c.fillStyle = filled || shade(COL.chalk, -0.6);
      for (let i = 0; i < 4; i++) c.fillRect(0.12, 0.18 + i * 0.16, 0.5, 0.05);
    });
    box(3.85, 2.0, 1.0, 0.12, 0.12, 0.9, COL.ink);
    box(3.7, 1.95, 1.85, 0.42, 0.3, 0.2, COL.ink);
  }

  function draw(now = performance.now()) {
    if (!cssW) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COL.board;
    ctx.fillRect(0, 0, cssW, cssH);
    const iso = frame();
    hits = []; tagPos = [];
    drawPlatform(iso);

    const objects = { archive: drawArchive, ferry: drawFerry, sequel: drawSequel };
    const people = state.people.slice(0, 8);
    // 画家のアルゴリズム：奥（x+y が小さい）から描く。設えの大物は人より奥にある
    (objects[state.setting] || drawArchive)(iso);
    const items = people.map((p, i) => ({ p, pos: personPos(p, i, now) }));
    items.sort((a, b) => (a.pos.x + a.pos.y) - (b.pos.x + b.pos.y));
    items.forEach(({ p, pos }) => drawFigure(iso, p, pos));

    tagListeners.forEach((fn) => fn(tagPos));
  }

  function loop(now) {
    draw(now);
    if (anim && now - anim.t0 < anim.dur) requestAnimationFrame(loop);
    else if (anim) { anim = null; draw(); }
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) { onPick?.(h.id); return; }
    }
  });

  new ResizeObserver(resize).observe(canvas);

  return {
    set(next) { state = { ...state, ...next }; draw(); },
    // 試行で選ばれた人を、一枠まで歩かせる。動きを減らす設定では、すぐに着かせる
    play(id) {
      state.chosenId = id;
      if (!id || reduceMotion()) { anim = null; draw(); return; }
      anim = { id, t0: performance.now(), dur: 1500 };
      requestAnimationFrame(loop);
    },
    onTags(fn) { tagListeners.add(fn); fn(tagPos); return () => tagListeners.delete(fn); },
  };
}
