// 素材のシェーダー。MeshStandardMaterial に手続き的な模様を差し込み、
// 「粘土の箱」ではなく草・土・水・木・布として読めるようにする。
// 点描の後処理は明暗を拾うので、模様は主に明るさの揺らぎとして入れる。
import * as THREE from 'three';

export const shared = { time: { value: 0 }, river: { value: new THREE.Vector2(36, 40) } };

const NOISE = /* glsl */`
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

function patch(material, { uniforms = {}, vertexPre = '', vertex = '', fragmentPre = '', color = '', normal = '' }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld; varying vec3 vLocal; varying vec3 vWNormal;\n${vertexPre}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        // InstancedMesh でも模様が世界座標に貼りつくよう、instanceMatrix を通す
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vWorld = (wm * vec4(transformed, 1.0)).xyz; vLocal = position; vWNormal = normalize(mat3(wm) * objectNormal);\n${vertex}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld; varying vec3 vLocal; varying vec3 vWNormal;\nuniform float time; uniform vec2 river;\n${NOISE}\n${fragmentPre}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${normal}`);
  };
  material.customProgramCacheKey = () => material.name;
  return material;
}

// 地面の塊：上は草（または道・砂）、側面は層になった土。上の縁には草が垂れる。
export function ground(top, side = '#7A5A3C', kind = 'grass') {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  m.name = `ground-${kind}-${top}`;
  return patch(m, {
    uniforms: { topCol: { value: new THREE.Color(top) }, sideCol: { value: new THREE.Color(side) } },
    fragmentPre: `uniform vec3 topCol; uniform vec3 sideCol;`,
    color: `
      vec3 n = normalize(vWNormal);
      vec2 xz = vWorld.xz;
      if (n.y > 0.5) {
        float big = fbm(xz * 0.35);
        float mid = fbm(xz * 2.2 + 7.0);
        vec3 c = topCol * (0.82 + 0.32 * big) * (0.9 + 0.2 * mid);
        ${kind === 'grass' ? `
        // 草の葉先：細かい明るい点と、かたまりの影
        float blade = step(0.86, h21(floor(xz * 22.0)));
        c = mix(c, c * 1.35 + 0.04, blade * 0.7);
        c *= 0.88 + 0.12 * smoothstep(0.3, 0.7, fbm(xz * 6.0));
        // ところどころ花
        float fl = step(0.992, h21(floor(xz * 9.0) + 3.1));
        c = mix(c, vec3(0.95, 0.88, 0.62), fl);` : ''}
        ${kind === 'path' ? `
        // 轍と小石
        float rut = smoothstep(0.08, 0.0, abs(fract(vWorld.z) - 0.3)) + smoothstep(0.08, 0.0, abs(fract(vWorld.z) - 0.7));
        c *= 1.0 - rut * 0.12;
        float pebble = step(0.93, h21(floor(xz * 14.0)));
        c = mix(c, c * 0.72, pebble * 0.8);` : ''}
        ${kind === 'sand' ? `
        float ripple = sin(xz.x * 9.0 + fbm(xz * 2.0) * 4.0);
        c *= 0.95 + 0.06 * ripple;` : ''}
        // タイルの継ぎ目は、ごく薄い溝として残す
        vec2 e = abs(fract(xz + 0.5) - 0.5);
        c *= 1.0 - 0.025 * smoothstep(0.48, 0.5, max(e.x, e.y));
        diffuseColor.rgb = c;
      } else {
        // 側面：横に流れる地層と、上縁の草
        float y = vLocal.y;
        float strata = fbm(vec2(vWorld.x * 0.8 + vWorld.z * 0.8, vWorld.y * 7.0));
        vec3 c = sideCol * (0.75 + 0.4 * strata);
        c *= 0.85 + 0.15 * step(0.5, fract(vWorld.y * 3.0 + strata));
        float stone = step(0.95, h21(floor(vec2(vWorld.x + vWorld.z, vWorld.y) * 8.0)));
        c = mix(c, vec3(0.62, 0.6, 0.55), stone * 0.8);
        ${kind === 'grass' ? `
        float lip = 0.5 - 0.09 - 0.07 * vnoise(vec2((vWorld.x + vWorld.z) * 9.0, 0.0));
        c = mix(c, topCol * 0.8, step(lip, y));` : ''}
        // 下にいくほど暗く
        c *= 0.6 + 0.4 * smoothstep(-0.5, 0.5, y);
        diffuseColor.rgb = c;
      }
    `,
  });
}

// 水：揺れる法線、浅瀬の明るさ、岸の泡
export function water(col = '#3F7FA0') {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.0 });
  m.name = 'water';
  return patch(m, {
    color: `
      vec2 xz = vWorld.xz;
      float d = min(vWorld.x - (river.x - 0.5), (river.y + 0.5) - vWorld.x);
      float deep = smoothstep(0.0, 2.2, d);
      vec3 c = mix(diffuseColor.rgb * 1.15, diffuseColor.rgb * 0.8, deep);
      float n = fbm(xz * 1.6 + vec2(time * 0.25, time * 0.1));
      c *= 0.95 + 0.1 * n;
      // 流れの筋（細く、まばらに）
      float streak = smoothstep(0.88, 0.97, vnoise(vec2(xz.x * 3.0, xz.y * 0.4 - time * 0.9)));
      c = mix(c, vec3(0.85, 0.92, 0.92), streak * 0.5);
      // 岸の泡
      float foam = smoothstep(0.35, 0.1, d + 0.15 * vnoise(xz * 6.0 + time));
      c = mix(c, vec3(0.93, 0.95, 0.92), foam);
      diffuseColor.rgb = c;
    `,
    normal: `
      vec2 q = vWorld.xz * 2.5 + vec2(0.0, -time * 0.8);
      float a = vnoise(q), b = vnoise(q + vec2(0.13, 0.0)), cc = vnoise(q + vec2(0.0, 0.13));
      vec3 wn = normalize(vec3((a - b) * 1.4, 1.0, (a - cc) * 1.4));
      normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
    `,
  });
}

// 木：長い方向に流れる木目と節
export function wood(col = '#8A6440', axis = 'x') {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
  m.name = `wood-${col}-${axis}`;
  const along = axis === 'x' ? 'vWorld.x' : axis === 'y' ? 'vWorld.y' : 'vWorld.z';
  const across = axis === 'x' ? 'vWorld.y * 3.0 + vWorld.z * 3.0' : 'vWorld.x * 3.0 + vWorld.z * 3.0';
  return patch(m, {
    color: `
      float g = fbm(vec2(${along} * 0.6, (${across}) * 9.0));
      float ring = fract(g * 6.0);
      vec3 c = diffuseColor.rgb * (0.75 + 0.35 * smoothstep(0.0, 0.6, ring));
      float knot = smoothstep(0.12, 0.0, length(fract(vec2(${along} * 0.7, (${across}) * 0.7)) - 0.5) - 0.02);
      c *= 1.0 - knot * 0.35;
      // 板の継ぎ目
      c *= 0.85 + 0.15 * step(0.06, fract((${across}) * 0.8));
      diffuseColor.rgb = c;
    `,
  });
}

// 葉の塊：まだらな明暗
export function foliage(col = '#4F7A44') {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true });
  m.name = `leaf-${col}`;
  return patch(m, {
    color: `
      float n = fbm(vWorld.xz * 3.5 + vWorld.y * 2.0);
      vec3 c = diffuseColor.rgb * (0.7 + 0.55 * n);
      c = mix(c, c * 1.4, step(0.82, h21(floor(vWorld.xy * 18.0 + vWorld.z * 7.0))) * 0.6);
      diffuseColor.rgb = c;
    `,
  });
}

// 岩：粒と割れ目
export function stone(col = '#9A958A') {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true });
  m.name = `stone-${col}`;
  return patch(m, {
    color: `
      float n = fbm(vWorld.xz * 5.0 + vWorld.y * 3.0);
      vec3 c = diffuseColor.rgb * (0.75 + 0.4 * n);
      c *= 1.0 - 0.3 * smoothstep(0.03, 0.0, abs(vnoise(vWorld.xz * 4.0 + vWorld.y * 4.0) - 0.5));
      diffuseColor.rgb = c;
    `,
  });
}

// 布：縦のひだと、ふちの明るさ。悲しみ（sorrow）で色が抜ける
export function cloth(col) {
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
  m.name = `cloth-${col}`;
  m.userData.sorrow = { value: 0 };
  return patch(m, {
    uniforms: { sorrowAmt: m.userData.sorrow },
    fragmentPre: `uniform float sorrowAmt;`,
    color: `
      float ang = atan(vLocal.z, vLocal.x);
      float fold = sin(ang * 7.0 + fbm(vec2(ang * 2.0, vLocal.y * 3.0)) * 3.0);
      vec3 c = diffuseColor.rgb * (0.86 + 0.14 * fold);
      // 裾にいくほど少し濃く
      c *= 0.85 + 0.2 * smoothstep(-0.4, 0.3, vLocal.y);
      // 織り目
      c *= 0.94 + 0.06 * step(0.5, fract((vWorld.y) * 40.0));
      float g = dot(c, vec3(0.3, 0.59, 0.11));
      c = mix(c, vec3(g) * vec3(0.92, 0.96, 1.05), sorrowAmt * 0.85);
      diffuseColor.rgb = c;
    `,
    normal: `
      // ふちを明るくして、輪郭を背景から浮かせる
    `,
  });
}
