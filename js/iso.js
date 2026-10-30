// アイソメトリック投影の最小カーネル。
// MrBongoC/ai-iso-skill（MIT）の「平面に平らな図形を置く」考え方を canvas に移したもの。
// +x は右下、+y は左下、+z は上。見えるのは上面、y=最大の面（左手前）、x=最大の面（右手前）。

const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = f >= 0 ? 255 : 0;
  const k = Math.abs(f);
  r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function makeIso(ctx, unit, ox, oy) {
  const P = (x, y, z) => [(x - y) * C * unit + ox, (x + y) * S * unit - z * unit + oy];
  const D = (x, y, z) => [(x - y) * C * unit, (x + y) * S * unit - z * unit];

  function poly(pts, fill) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // 面に沿った座標系で描く。u・v は 0..1 ではなく世界単位。
  function onPlane(O, U, V, draw) {
    const o = P(...O), u = D(...U), v = D(...V);
    ctx.save();
    ctx.transform(u[0], u[1], v[0], v[1], o[0], o[1]);
    draw(ctx);
    ctx.restore();
  }
  const top = (x, y, z, draw) => onPlane([x, y, z], [1, 0, 0], [0, 1, 0], draw);
  // 左手前の面（y が一定）。左上の角を渡す。v は下向き。
  const front = (x, y, z, draw) => onPlane([x, y, z], [1, 0, 0], [0, 0, -1], draw);
  // 右手前の面（x が一定）。左上の角を渡す。
  const side = (x, y, z, draw) => onPlane([x, y, z], [0, -1, 0], [0, 0, -1], draw);

  // 三つの見える面で箱を描く。色は上・左・右で明るさを変えるだけ（影や線は使わない）
  function box(x, y, z, w, d, h, color, o = {}) {
    const tc = o.top ?? shade(color, 0.16);
    const lc = o.left ?? color;
    const rc = o.right ?? shade(color, -0.2);
    poly([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)], rc);
    poly([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)], lc);
    poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], tc);
  }

  return { P, D, poly, box, top, front, side, unit };
}
