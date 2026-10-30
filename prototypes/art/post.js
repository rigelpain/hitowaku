// 後処理：案A のティルトシフト（上下をぼかしてミニチュアに見せる）と、案C の 1bit ディザ。
import * as THREE from 'three';

const quadVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fullscreen(material) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return scene;
}
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function tiltShift(renderer, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
  const mid = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  const make = (dir) => new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, res: { value: new THREE.Vector2(w, h) }, dir: { value: dir }, focus: { value: 0.52 }, band: { value: 0.16 } },
    vertexShader: quadVert,
    fragmentShader: `
      uniform sampler2D tex; uniform vec2 res; uniform vec2 dir; uniform float focus; uniform float band;
      varying vec2 vUv;
      void main(){
        float d = max(0.0, abs(vUv.y - focus) - band);
        float r = clamp(d * 16.0, 0.0, 5.0);
        vec4 acc = vec4(0.0); float wsum = 0.0;
        for (int i = -6; i <= 6; i++) {
          float fi = float(i);
          float wgt = exp(-fi*fi/18.0);
          acc += texture2D(tex, vUv + dir * fi * r / res) * wgt; wsum += wgt;
        }
        gl_FragColor = acc / wsum;
        #include <colorspace_fragment>
      }`,
  });
  const h1 = make(new THREE.Vector2(1, 0)), v1 = make(new THREE.Vector2(0, 1));
  const s1 = fullscreen(h1), s2 = fullscreen(v1);
  return (scene, cam) => {
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    h1.uniforms.tex.value = rt.texture; renderer.setRenderTarget(mid); renderer.render(s1, orthoCam);
    v1.uniforms.tex.value = mid.texture; renderer.setRenderTarget(null); renderer.render(s2, orthoCam);
  };
}

export function dither(renderer, w, h, { scale = 2, paper = '#E9E4D4', ink = '#22201C', accent = null } = {}) {
  const lw = Math.round(w / scale), lh = Math.round(h / scale);
  const rt = new THREE.WebGLRenderTarget(lw, lh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: rt.texture }, res: { value: new THREE.Vector2(lw, lh) },
      paper: { value: new THREE.Color(paper) }, ink: { value: new THREE.Color(ink) },
      accent: { value: new THREE.Color(accent || paper) }, useAccent: { value: accent ? 1 : 0 },
    },
    vertexShader: quadVert,
    fragmentShader: `
      uniform sampler2D tex; uniform vec2 res; uniform vec3 paper; uniform vec3 ink; uniform vec3 accent; uniform float useAccent;
      varying vec2 vUv;
      float bayer(vec2 p){
        int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        for (int k=0;k<16;k++){ if(k==i) return (m[k]+0.5)/16.0; }
        return 0.5;
      }
      void main(){
        vec2 px = floor(vUv * res);
        vec4 c = texture2D(tex, (px + 0.5) / res);
        // 赤みが強い画素は「一枠」の印として、ディザを通さずに塗る
        if (useAccent > 0.5 && c.r > 0.6 && c.g < 0.08 && c.b < 0.08) { gl_FragColor = vec4(accent, 1.0); }
        else {
          float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          l = pow(l, 1.0 / 2.2);
          gl_FragColor = vec4(l > bayer(px) ? paper : ink, 1.0);
        }
        #include <colorspace_fragment>
      }`,
  });
  const s = fullscreen(mat);
  return (scene, cam) => {
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.render(s, orthoCam);
  };
}

// 色つきディザ。限られた色の組から、近い2色をベイヤー行列で混ぜる。
// 話し手の感情（mood）で、量子化の前の色の傾きと、粒の大きさ・揺れを変える。
export function colorDither(renderer, w, h, palette) {
  const maxScale = 4;
  const targets = {};
  const target = (s) => targets[s] ||= new THREE.WebGLRenderTarget(Math.round(w / s), Math.round(h / s), { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const pal = palette.map((c) => new THREE.Color(c).convertLinearToSRGB());
  while (pal.length < 20) pal.push(pal[pal.length - 1].clone());
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: null }, res: { value: new THREE.Vector2(w, h) }, time: { value: 0 },
      pal: { value: pal.map((c) => new THREE.Vector3(c.r, c.g, c.b)) }, palN: { value: palette.length },
      tension: { value: 0 }, sorrow: { value: 0 }, warmth: { value: 0 }, hope: { value: 0 },
      focus: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader: quadVert,
    fragmentShader: `
      uniform sampler2D tex; uniform vec2 res; uniform float time;
      uniform vec3 pal[20]; uniform int palN;
      uniform float tension, sorrow, warmth, hope; uniform vec2 focus;
      varying vec2 vUv;
      float bayer(vec2 p){
        int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        for (int k=0;k<16;k++){ if(k==i) return (m[k]+0.5)/16.0; }
        return 0.5;
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
      void main(){
        vec2 uv = vUv;
        // 張りつめ：行ごとに横へずれる
        float row = floor(uv.y * res.y / 2.0);
        uv.x += tension * 0.006 * (hash(vec2(row, floor(time * 12.0))) - 0.5) * step(0.7, hash(vec2(row * 0.37, floor(time * 6.0))));
        vec2 px = floor(uv * res);
        vec3 c = toSRGB(texture2D(tex, (px + 0.5) / res).rgb);
        float d = distance(vUv * vec2(res.x / res.y, 1.0), focus * vec2(res.x / res.y, 1.0));
        // 悲しみ：青く沈み、色が抜け、周りが暗くなる
        float g = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(c, vec3(g) * vec3(0.9, 0.95, 1.05), sorrow * 0.6);
        // あたたかさ・希望：話し手のまわりから光がにじむ
        c += vec3(1.0, 0.72, 0.35) * warmth * 0.22 * (1.0 - smoothstep(0.0, 0.7, d));
        c = mix(c, c * vec3(1.08, 1.02, 0.9) + 0.06, hope * 0.6);
        c += vec3(0.9, 0.95, 0.7) * hope * 0.16 * (1.0 - smoothstep(0.0, 0.9, d));
        // 張りつめ：コントラストを上げ、ディザの閾値が這う
        c = mix(c, (c - 0.5) * 1.2 + 0.5, tension);
        float th = bayer(px + tension * vec2(floor(time * 20.0), 0.0));
        th = mix(th, hash(px + floor(time * 15.0)), tension * 0.5);
        // 近い2色を探して混ぜる
        float best = 1e9, second = 1e9; vec3 a = pal[0], b = pal[0];
        for (int i = 0; i < 20; i++) {
          if (i >= palN) break;
          float dd = distance(c, pal[i]);
          if (dd < best) { second = best; b = a; best = dd; a = pal[i]; }
          else if (dd < second) { second = dd; b = pal[i]; }
        }
        float t = best / max(best + second, 1e-4);
        vec3 outc = (t * 2.0 > th) ? b : a;
        gl_FragColor = vec4(pow(outc, vec3(2.2)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const s = fullscreen(mat);
  return {
    uniforms: mat.uniforms,
    render(scene, cam, scale) {
      const rt = target(scale);
      renderer.setRenderTarget(rt); renderer.render(scene, cam);
      mat.uniforms.tex.value = rt.texture;
      mat.uniforms.res.value.set(rt.width, rt.height);
      renderer.setRenderTarget(null); renderer.render(s, orthoCam);
    },
  };
}
