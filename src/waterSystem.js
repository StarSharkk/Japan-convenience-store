import * as THREE from 'three';
import { reg, rng } from './core.js';

/* ====================================================================================================
   One water for the whole town: the lake (town/lake.js), the villa's garden pond (town/villa.js) and the plaza
   fountain's pool + bowl (town/fountain.js) share this shader, its uniforms and one tiling wave-normal texture;
   a preset per kind sets the look (WATER_PRESETS: colours, wave scale + speed, reflection, clarity, ripples).

     waves       three layers of the shared normal texture, each at its own scale, direction and speed (a slow broad
                 swell, mid ripples, a fine glitter layer), plus slow fine ripples along the shore's depth contours
     colour      shallow -> mid -> deep by the water's depth; a pebble bed (or plain stone) shows through the shallows,
                 more when looking straight down; daylight / the night sky light the body
     reflection  fresnel; the lake reads the planar reflection (post.js: its plane drops to the lake's level while the
                 streets are dry), the small pools a sky gradient over a band of their surroundings - all bent by the
                 waves and by rain
     glints      a tight sun glint off the fine layer + a soft sheen, both following the sun; a moon glint at night
     ripples     raindrop rings (fresh spots every cycle, density from the rain), and ripple sources (the fountain's
                 landing points and its bowl's falling sheet, the pond's spill stone)
     alpha       clear shallows feathered into the bank, opaque where the water mirrors (no hard dark / white rim)
   The environment (env.js) drives the shared uniforms through reg.lakeU (= WATER_U): sun / moon, sky, day, rain,
   wind, cloud, cold, lightning; the quality setting (main.js) sets uQ: low drops the fine layer and two rain layers.
   ==================================================================================================== */

/* ---------------------------------------------------------------- the shared wave normals (tiling fbm) */
function makeNormalTex(size = 256) {
  const R = rng(91), h = new Float32Array(size * size);
  [[8, 1], [16, 0.55], [32, 0.3], [64, 0.14]].forEach(([n, a]) => {
    const L = Array.from({ length: n * n }, () => R());
    const at = (i, j) => L[((j + n) % n) * n + ((i + n) % n)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * n, fy = (y / size) * n, i = Math.floor(fx), j = Math.floor(fy);
      let u = fx - i, v = fy - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      h[y * size + x] += a * (at(i, j) * (1 - u) * (1 - v) + at(i + 1, j) * u * (1 - v) + at(i, j + 1) * (1 - u) * v + at(i + 1, j + 1) * u * v);
    }
  });
  const data = new Uint8Array(size * size * 4), s = 9;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const H = (a, b) => h[((b + size) % size) * size + ((a + size) % size)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * s, dy = (H(x, y + 1) - H(x, y - 1)) * s, l = Math.hypot(dx, dy, 1), o = (y * size + x) * 4;
    data[o] = (-dx / l) * 127.5 + 127.5; data[o + 1] = (-dy / l) * 127.5 + 127.5; data[o + 2] = (1 / l) * 127.5 + 127.5; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}

/* ---------------------------------------------------------------- shared uniforms (env.js writes them via reg.lakeU) */
export const WATER_U = {
  uTime: { value: 0 }, uDay: { value: 1 }, uNight: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0 }, uCold: { value: 0 },
  uFlash: { value: 0 }, uCloud: { value: 0 }, uSunVis: { value: 0 }, uMoonVis: { value: 0 }, uQ: { value: 2 },
  uSkyLo: { value: new THREE.Color('#9fbfe6') }, uSkyHi: { value: new THREE.Color('#5d8fd6') },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uSunCol: { value: new THREE.Color(1, 0.96, 0.88) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
  uReflK: { value: 0 }, uReflY: { value: 0 }, tRefl: { value: null }, uTexMat: { value: new THREE.Matrix4() },
  tNrm: { value: null },
};
let ready = false;
function init() {
  if (ready) return;
  ready = true;
  WATER_U.tNrm.value = makeNormalTex();
  reg.lakeU = WATER_U; // env.js drives the shared look through this
  reg.waterU = WATER_U; // post.js writes the reflection plane's height here
  reg.updaters.push((t) => { WATER_U.uTime.value = t; });
}
/** 0 low (two wave layers, two rain layers), 1 medium, 2 high */
export function setWaterQuality(q) { WATER_U.uQ.value = q; }

/* ---------------------------------------------------------------- presets (colours in sRGB) */
export const WATER_PRESETS = {
  // a calm, clean blue-green town lake: pale clear cyan in the shallows, soft blue-green, a deeper blue-teal
  lake: { shallow: '#9fd8cc', mid: '#5aaba6', deep: '#2e7584', bed: '#b8ab8a', horizon: '#5d855a', normalScale: 0.15, waveSpeed: 1.0, waveScale: 1.0, reflStr: 1.0, fresnel: 1.0, r0: 0.16, alphaShallow: 0.3, alphaDeep: 0.93, absorb: 0.55, rippleStr: 1.0, spec: 1.0, rainK: 1.0, edge: 0.05, rough: 0.2 },
  // a clear, quiet garden pool: pale green-cyan, more see-through, smaller and calmer waves
  pond: { shallow: '#bfe4d8', mid: '#93cdbf', deep: '#62a99c', bed: '#a8a088', horizon: '#6f9669', normalScale: 0.09, waveSpeed: 0.6, waveScale: 1.7, reflStr: 0.8, fresnel: 0.95, r0: 0.12, alphaShallow: 0.2, alphaDeep: 0.6, absorb: 0.3, rippleStr: 0.7, spec: 0.8, rainK: 1.0, edge: 0.035, rough: 0.3 },
  // the fountain: the clearest, livelier small ripples, pale stone under it
  // the sea round the island (town/island.js): pale turquoise shallows, a clear blue-green, a soft deep blue; slow broad
  // swell, a little foam lapping the beach
  sea: { shallow: '#a8e4d8', mid: '#5bbccb', deep: '#3384b4', bed: '#e4d5ae', horizon: '#a9c9dc', normalScale: 0.13, waveSpeed: 0.7, waveScale: 0.42, reflStr: 1.0, fresnel: 1.0, r0: 0.12, alphaShallow: 0.32, alphaDeep: 0.96, absorb: 2.4, rippleStr: 0.8, spec: 0.8, rainK: 1.0, edge: 0.07, rough: 0.3, foam: 1.0 },
  fountain: { shallow: '#c6ece7', mid: '#9cd8d4', deep: '#6dbcc0', bed: '#d9d3c4', horizon: '#d6cfc0', normalScale: 0.12, waveSpeed: 1.25, waveScale: 2.2, reflStr: 0.85, fresnel: 1.0, r0: 0.1, alphaShallow: 0.45, alphaDeep: 0.68, absorb: 0.45, rippleStr: 1.0, spec: 0.45, rainK: 1.0, edge: 0, rough: 0.25 },
};

/* ---------------------------------------------------------------- the shader */
const VS = /* glsl */ `
  varying vec3 vWPos;
  #include <fog_pars_vertex>
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FS = (depthGLSL, bedGLSL) => /* glsl */ `
  uniform float uTime, uDay, uNight, uRain, uWind, uCold, uFlash, uCloud, uSunVis, uMoonVis, uQ;
  uniform vec3 uSkyLo, uSkyHi, uSunDir, uSunCol, uMoonDir;
  uniform sampler2D tNrm;
  uniform vec3 uShallow, uMid, uDeep, uBed, uHorizon, uGlowCol;
  uniform vec4 uGlow; // x, z, radius, strength (an underwater light at night)
  uniform float uNormalScale, uWaveSpeed, uWaveScale, uReflStr, uFresnel, uAlphaShallow, uAlphaDeep, uAbsorb, uRippleStr, uSpec, uRainK, uEdge, uRough, uSrcOn, uNSrc, uR0, uFoam;
  uniform vec4 uSrc[10]; // x, z, strength, ring radius (0: a point)
  #ifdef PLANAR
  uniform sampler2D tRefl; uniform mat4 uTexMat; uniform float uReflK, uReflY;
  #endif
  varying vec3 vWPos;
  #include <fog_pars_fragment>

  float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 h22(vec2 p){ return vec2(h21(p), h21(p + 19.19)); }
  vec2 nrmXY(vec2 uv){ return texture2D(tNrm, uv).xy * 2.0 - 1.0; }

  ${depthGLSL}
  ${bedGLSL}

  // one layer of raindrop rings: radial slope (xy) + a soft highlight (z); a fresh spot every cycle
  vec3 rainLayer(vec2 p, float t, float cell, float seed, float dens){
    vec2 q = p / cell, id = floor(q), f = fract(q);
    if (h21(id + seed) > dens) return vec3(0.0);
    float life = 0.9 + h21(id + seed + 5.3) * 0.7, k = t / life + h21(id + seed + 11.7);
    float ph = fract(k);
    vec2 c = 0.25 + 0.5 * h22(id + seed + 3.1 + floor(k) * 1.37);
    vec2 d = (f - c) * cell; float r = length(d);
    float x = r - ph * cell * 0.45, w = 0.03 + ph * 0.05;
    float env = exp(-x * x / (w * w)) * (1.0 - ph) * (1.0 - ph);
    return vec3(d / (r + 1e-4) * sin(x * 60.0) * env, env);
  }
  // ripples from fixed sources (points, or rings where a sheet of water falls round a basin)
  vec3 srcRipples(vec2 p, float t){
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++){
      if (float(i) >= uNSrc) break;
      vec4 s = uSrc[i];
      vec2 d = p - s.xy; float r = length(d);
      float rr = s.w > 0.0 ? abs(r - s.w) : r;
      vec2 dir = d / (r + 1e-4) * (s.w > 0.0 ? sign(r - s.w) : 1.0);
      float env = exp(-rr * 3.4) * s.z, wave = sin(rr * 40.0 - t * 6.0 + s.x * 3.0);
      acc += vec3(dir * wave * env, env * (0.5 + 0.5 * wave));
    }
    return acc * uSrcOn;
  }

  void main(){
    vec2 p = vWPos.xz;
    float depth = wDepth(p);
    if (depth < -0.01) discard;
    depth = max(depth, 0.0);
    float t = uTime;

    /* waves: three layers of the shared normals, each with its own scale / direction / speed */
    float spd = uWaveSpeed * (1.0 + uWind * 1.2);
    float amp = uNormalScale * (1.0 + uWind * 1.4 + uRain * 0.45);
    vec2 s = p * uWaveScale;
    mat2 r1 = mat2(0.8, -0.6, 0.6, 0.8), r2 = mat2(0.28, 0.96, -0.96, 0.28);
    vec2 g = nrmXY(s * 0.05 + vec2(0.010, 0.006) * t * spd) * 0.55;
    g += nrmXY(r1 * s * 0.19 + vec2(-0.019, 0.013) * t * spd) * 0.42;
    vec2 gFine = uQ > 0.5 ? nrmXY(r2 * s * 0.73 + vec2(0.031, -0.037) * t * spd) * 0.32 : vec2(0.0);
    g = (g + gFine) * amp;
    // slow fine ripples along the shore (the depth contours), fading out within a few cm of water
    if (uEdge > 0.0) {
      float e = 0.07;
      vec2 dg = vec2(wDepth(p + vec2(e, 0.0)) - wDepth(p - vec2(e, 0.0)), wDepth(p + vec2(0.0, e)) - wDepth(p - vec2(0.0, e)));
      float lap = exp(-depth * 16.0) * smoothstep(0.0, 0.012, depth);
      g += dg / (length(dg) + 1e-4) * sin(depth * 75.0 - t * 1.25) * lap * 0.1 * uRippleStr;
    }
    vec3 sr = srcRipples(p, t) * uRippleStr;
    g += sr.xy * 0.32;
    vec3 rr = vec3(0.0);
    if (uRain > 0.01 && uRainK > 0.0) {
      float dens = clamp(uRain, 0.0, 1.6) * 0.5;
      rr += rainLayer(p, t, 0.7, 1.0, dens);
      rr += rainLayer(p + 3.7, t * 1.13, 0.5, 7.0, dens);
      if (uQ > 0.5) rr += rainLayer(p - 5.1, t * 0.91, 1.05, 13.0, dens);
      if (uQ > 1.5) rr += rainLayer(p + vec2(2.3, -6.1), t * 1.27, 0.38, 21.0, dens * 0.8);
      rr *= uRainK;
      g += rr.xy * 0.22;
    }
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(cameraPosition - vWPos);
    float NV = clamp(dot(N, V), 0.0, 1.0); // (rounding can push it past 1: pow() of a negative base is NaN, and bloom spreads a NaN over the frame)

    /* body: shallow -> mid -> deep; the bed shows through the shallows (more when looking down) */
    vec3 body = mix(mix(uShallow, uMid, smoothstep(0.0, uAbsorb * 0.4, depth)), uDeep, smoothstep(uAbsorb * 0.3, uAbsorb * 1.1, depth));
    float path = depth / max(V.y, 0.18);
    float bedVis = exp(-path / (uAbsorb * 0.3));
    vec3 bed = bedColor(p + g * 0.8 * depth);
    body = mix(body, bed * mix(vec3(1.0), uShallow * 1.3, 0.3), bedVis * 0.6);
    body = mix(body, body * vec3(0.92, 0.97, 1.02) + 0.02, uCold * 0.5); // a little greyer / clearer when cold
    vec3 amb = mix(uSkyLo * 0.9 + vec3(0.02, 0.03, 0.045), vec3(1.0), uDay) * (1.0 - uCloud * 0.15 * uDay); // night: the sky's glow
    body *= amb;

    /* reflection */
    vec3 R = reflect(-V, N);
    float ry = clamp(R.y, 0.0, 1.0);
    vec3 sky = mix(uSkyLo, uSkyHi, smoothstep(0.0, 0.8, ry));
    vec3 refl = mix(uHorizon * amb, sky, smoothstep(0.02, 0.3, ry)); // the planting round a small pool
    #ifdef PLANAR
    vec4 rc = uTexMat * vec4(vWPos.x, uReflY, vWPos.z, 1.0);
    vec3 rt = texture2D(tRefl, rc.xy / rc.w + g * (0.18 + uRain * 0.35 + uWind * 0.1)).rgb; // bent by the waves, broken up by rain
    refl = mix(sky, rt, uReflK);
    #endif
    refl = mix(refl, (uSkyLo + uSkyHi) * 0.5, uCloud * 0.2); // overcast: softer
    float F = clamp((uR0 + (1.0 - uR0) * pow(1.0 - NV, 5.0)) * uFresnel, 0.0, 1.0) * uReflStr; // uR0: a little base mirror (a model's water reads its reflections from above too)
    vec3 col = mix(body, refl, F);

    /* sun glint (tight, off the fine layer) + a soft sheen; the moon at night */
    vec3 L = normalize(uSunDir), H = normalize(L + V + vec3(0.0, 1e-4, 0.0));
    vec3 Nf = normalize(vec3(-(g.x + gFine.x * amp * 1.6), 1.0, -(g.y + gFine.y * amp * 1.6)));
    float sp = pow(max(dot(Nf, H), 0.0), mix(1600.0, 500.0, uRough)) * 4.0 + pow(max(dot(N, H), 0.0), 120.0) * 0.1;
    col += uSunCol * min(sp, 1.4) * uSunVis * uSpec; // capped: small glints, no bloom blobs
    vec3 Hm = normalize(normalize(uMoonDir) + V + vec3(0.0, 1e-4, 0.0));
    col += vec3(0.62, 0.72, 1.0) * pow(max(dot(N, Hm), 0.0), 320.0) * 1.1 * uMoonVis * uSpec;

    /* ripple highlights, the underwater light at night, lightning */
    col += (mix(sky, vec3(1.0), 0.3) * (0.35 + 0.65 * uDay) + vec3(0.05, 0.06, 0.08) * uNight) * (rr.z * 0.09 + sr.z * 0.05);
    float gl = exp(-length(p - uGlow.xy) / max(uGlow.z, 0.01)) * uGlow.w * uNight;
    col += uGlowCol * gl * (0.75 + 0.5 * sr.z);
    col += vec3(0.45, 0.55, 0.85) * uFlash * 0.35 * F;

    /* alpha: clear shallows feathered into the bank, opaque where it mirrors */
    float a = mix(uAlphaShallow, uAlphaDeep, smoothstep(0.0, uAbsorb * 0.6, depth));
    a = max(a, F * 0.95);
    if (uEdge > 0.0) a *= smoothstep(0.0, uEdge, depth);
    // foam lapping the shore (the sea): broken soft bands that breathe in and out over the shallows
    if (uFoam > 0.0) {
      float nz = texture2D(tNrm, p * 0.31 + vec2(t * 0.011, -t * 0.013)).z;
      float band = 1.0 - smoothstep(0.02, 0.3, depth + 0.07 * sin(t * 0.7 + p.x * 0.6 + p.y * 0.45));
      float f = band * smoothstep(0.62, 0.9, nz + 0.3 * band) * uFoam;
      col = mix(col, vec3(0.95, 0.98, 1.0) * mix(amb, vec3(1.0), 0.6), f * 0.75);
      a = max(a, f * 0.85 * smoothstep(0.0, 0.03, depth));
    }
    if (isnan(a) || isnan(col.x + col.y + col.z)) discard; // never hand the bloom a NaN (it would spread over the frame)
    gl_FragColor = vec4(clamp(col, 0.0, 8.0), clamp(a, 0.0, 1.0));
    #include <fog_fragment>
  }`;

/** a pebble bed (voronoi stones with sandy gaps) */
export const BED_PEBBLES = /* glsl */ `
  vec3 bedColor(vec2 p){
    vec2 q = p * 6.0, id = floor(q), f = fract(q);
    float md = 8.0; vec2 mid = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j)), c = o + 0.15 + 0.7 * h22(id + o);
      float d = length(f - c); if (d < md) { md = d; mid = id + o; }
    }
    vec3 stone = uBed * mix(0.72, 1.18, h21(mid));
    return mix(stone, uBed * 0.88, smoothstep(0.3, 0.46, md));
  }`;
/** a plain stone floor */
export const BED_PLAIN = /* glsl */ `vec3 bedColor(vec2 p){ return uBed; }`;

/**
 * a water material. kind: 'lake' | 'pond' | 'fountain' (WATER_PRESETS); o.depth: GLSL defining float wDepth(vec2 p)
 * (world x / z -> depth in m, < 0 outside); o.bed: BED_PEBBLES / BED_PLAIN; o.planar: read the planar reflection
 * (the lake only: the small pools must not bind its texture, they may be drawn into it); o.sources: up to ten
 * [x, z, strength, ringRadius]; o.glow: { x, z, r, k, col }; o.uniforms: extra uniforms (for o.depth); o.preset: overrides
 */
export function makeWater(kind, o = {}) {
  init();
  const P = { ...WATER_PRESETS[kind], ...(o.preset || {}) };
  const src = Array.from({ length: 10 }, (_, i) => new THREE.Vector4(...((o.sources || [])[i] || [0, 0, 0, 0])));
  const own = {
    uShallow: { value: new THREE.Color(P.shallow) }, uMid: { value: new THREE.Color(P.mid) }, uDeep: { value: new THREE.Color(P.deep) },
    uBed: { value: new THREE.Color(P.bed) }, uHorizon: { value: new THREE.Color(P.horizon) },
    uNormalScale: { value: P.normalScale }, uWaveSpeed: { value: P.waveSpeed }, uWaveScale: { value: P.waveScale }, uReflStr: { value: P.reflStr },
    uFresnel: { value: P.fresnel }, uAlphaShallow: { value: P.alphaShallow }, uAlphaDeep: { value: P.alphaDeep }, uAbsorb: { value: P.absorb },
    uRippleStr: { value: P.rippleStr }, uR0: { value: P.r0 }, uFoam: { value: P.foam || 0 }, uSpec: { value: P.spec }, uRainK: { value: P.rainK }, uEdge: { value: P.edge }, uRough: { value: P.rough },
    uSrc: { value: src }, uNSrc: { value: (o.sources || []).length }, uSrcOn: o.srcOn || { value: 1 },
    uGlow: { value: new THREE.Vector4(o.glow?.x ?? 0, o.glow?.z ?? 0, o.glow?.r ?? 1, o.glow?.k ?? 0) }, uGlowCol: { value: new THREE.Color(o.glow?.col || '#fff1d6') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: VS,
    fragmentShader: FS(o.depth, o.bed || BED_PEBBLES),
    defines: o.planar ? { PLANAR: 1 } : {},
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const shared = { ...WATER_U };
  if (!o.planar) { delete shared.tRefl; delete shared.uTexMat; delete shared.uReflK; delete shared.uReflY; }
  Object.assign(mat.uniforms, shared, own, o.uniforms || {});
  return mat;
}
