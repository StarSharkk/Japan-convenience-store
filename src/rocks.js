import * as THREE from 'three';
import { mergeVertices, mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reg, rng, RAMP, SNOW_U } from './core.js';
import { SEASON_U } from './tree.js';

/* ====================================================================================================
   The town's rocks: one library of natural rock shapes + a seeded, zone-based placement system.

   Shapes   every base model starts from an icosphere and becomes its own rock, built once at load:
              ellipsoid proportions -> a low-frequency warp (no two sides alike) -> planar fracture cuts (the flat broken
              faces) -> strata ledges (layered / cliff rock) -> Laplacian smoothing (water-worn edges) -> fine cracks
              pressed into the surface -> a flattened underside (it sits / beds into the ground).
            vertex colour: the stone's own colour with mottling, strata bands, darker cavities and cracks, pale
            weathering specks; uv.x carries a moss mask, uv.y the cavity (the shader uses both). Smooth normals, with
            hard creases only on the fractured kinds (large / cliff / layered: the outline pass then picks out real
            breaks, not every facet).
            types: pebble, medium, large, flat, step (stepping stones), mossy, shore, cliff, layered, embedded - 25 base
            models in all (several seeds per type); each placement adds its own size, proportions, turn, tilt and tint.
   Material one toon material per zone (vertex colours on the town's ramp) + a shader patch shared by all of them:
            moss (lusher in summer, drier olive in autumn / winter), a darker wet band at the waterline and lower contrast
            under water, rain soaking (more for shore and cliff rock), a few petals / leaves on the tops in spring /
            autumn, snow on up-facing surfaces only above the water.
   Batches  a zone collects its rocks and turns them into one merged mesh (few rocks) or one InstancedMesh per base
            model (many rocks, the island); nothing is rebuilt per frame.
   ==================================================================================================== */

/* ---------------------------------------------------------------- noise (seeded value noise) */
function noise3(seed) {
  const h = (x, y, z) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 974634511)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n & 0xffff) / 0xffff;
  };
  const f = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    const x00 = l(h(xi, yi, zi), h(xi + 1, yi, zi), u), x10 = l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u);
    const x01 = l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), x11 = l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u);
    return l(l(x00, x10, v), l(x01, x11, v), w) * 2 - 1;
  };
  f.fbm = (x, y, z, o = 3) => { let s = 0, a = 0.5, k = 1, n = 0; for (let i = 0; i < o; i++) { s += a * f(x * k, y * k, z * k); n += a; a *= 0.5; k *= 2.03; } return s / n; };
  return f;
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------------------------------------------------------- the rock types */
// det: icosphere detail; s: proportions; warp: low-frequency shape change; cuts: fracture planes [count, depth range,
// strength]; side: extra near-vertical cuts (an irregular outline: stepping stones, cliff faces); top: a flattened top
// [depth, strength]; strata [amount, per metre]; smooth: water-wear passes; crack: crack amount; bot: underside height
// (fraction); crease: hard-edge angle in degrees (0 = smooth); moss: moss amount; cav: cavity darkening; pal: colours
const C = { grey: '#9a9893', warm: '#a39b8f', brown: '#988c7d', blue: '#8e959f', dark: '#827f7b', pale: '#b2aca1', slate: '#888e97' };
export const ROCK_TYPES = {
  pebble: { n: 3, det: 2, box: 0.8, s: [1, 0.62, 0.84], warp: 0.12, cuts: [4, [0.6, 0.85], 0.8], strata: 0, smooth: 1, crack: 0, bot: 0.16, crease: 0, moss: 0, cav: 0.3, pal: [C.grey, C.warm, C.blue, C.brown] },
  medium: { n: 3, det: 3, s: [1, 0.74, 0.86], warp: 0.14, cuts: [8, [0.45, 0.8], 1], strata: 0, smooth: 0, wear: 1, crack: 0.8, bot: 0.14, crease: 40, moss: 0.2, cav: 0.55, pal: [C.grey, C.blue, C.warm] },
  large: { n: 2, det: 3, s: [1, 1.08, 0.82], warp: 0.16, cuts: [11, [0.42, 0.82], 1], strata: [0.03, 3.2], smooth: 0, wear: 1, crack: 1.1, bot: 0.12, crease: 38, moss: 0.25, cav: 0.6, pal: [C.grey, C.brown] },
  flat: { n: 2, det: 3, s: [1, 0.3, 0.8], warp: 0.1, cuts: [5, [0.5, 0.8], 1], top: [0.7, 1], strata: 0, smooth: 0, wear: 1, crack: 0.5, bot: 0.22, crease: 45, moss: 0.12, cav: 0.4, pal: [C.pale, C.warm] },
  step: { n: 3, det: 3, s: [1, 0.2, 0.8], warp: 0.08, cuts: [0, [0, 0], 0], side: [6, [0.72, 0.9], 1], top: [0.62, 1], strata: 0, smooth: 0, wear: 1, crack: 0.3, bot: 0.3, crease: 50, moss: 0.06, cav: 0.3, pal: [C.pale, C.warm, C.grey] },
  mossy: { n: 2, det: 3, box: 0.65, s: [1, 0.7, 0.88], warp: 0.15, cuts: [7, [0.5, 0.82], 1], strata: 0, smooth: 0, wear: 2, crack: 0.6, bot: 0.14, crease: 42, moss: 0.95, cav: 0.5, pal: [C.grey, C.slate] },
  shore: { n: 3, det: 3, box: 0.72, s: [1, 0.44, 0.8], warp: 0.15, cuts: [5, [0.55, 0.82], 0.9], top: [0.66, 0.8], strata: 0, smooth: 2, crack: 0.4, bot: 0.16, crease: 0, moss: 0.1, cav: 0.4, pal: [C.blue, C.grey, C.slate] },
  cliff: { n: 3, det: 3, box: 0.7, s: [1, 0.8, 0.58], warp: 0.14, cuts: [6, [0.45, 0.8], 1], side: [5, [0.62, 0.86], 1], strata: [0.11, 3.0], smooth: 0, wear: 1, crack: 1.0, bot: 0.06, crease: 36, moss: 0.18, cav: 0.55, pal: [C.brown, C.grey, C.warm] },
  layered: { n: 2, det: 3, box: 0.78, s: [1, 0.72, 0.78], warp: 0.2, cuts: [7, [0.45, 0.8], 1], strata: [0.16, 4.2], smooth: 0, wear: 1, crack: 0.8, bot: 0.1, crease: 36, moss: 0.12, cav: 0.6, pal: [C.brown, C.warm] },
  embedded: { n: 2, det: 3, s: [1, 0.6, 0.9], warp: 0.14, cuts: [6, [0.5, 0.82], 1], strata: 0, smooth: 0, wear: 1, crack: 0.5, bot: 0.42, crease: 42, moss: 0.35, cav: 0.5, pal: [C.grey, C.warm] },
};

const geoCache = new Map();
export const ROCK_STATS = { models: 0, ms: 0 }; // build cost (the debug hook reads it)
/** one base rock model: footprint radius ~1 (x / z half-extent), resting on y = 0; userData.h = its height */
export function rockGeo(type, variant = 0) {
  const T = ROCK_TYPES[type], v = variant % T.n, key = type + v;
  if (geoCache.has(key)) return geoCache.get(key);
  const t0 = performance.now();
  const seed = 7001 + Object.keys(ROCK_TYPES).indexOf(type) * 97 + v * 31;
  const R = rng(seed), N = noise3(seed), N2 = noise3(seed + 5), N3 = noise3(seed + 9);

  let geo = new THREE.IcosahedronGeometry(1, T.det);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position, cnt = pos.count, I = geo.index.array;
  const P = new Float32Array(cnt * 3), D = new Float32Array(cnt * 3); // working positions, unit directions
  for (let i = 0; i < cnt; i++) { D[i * 3] = pos.getX(i); D[i * 3 + 1] = pos.getY(i); D[i * 3 + 2] = pos.getZ(i); }
  // neighbours (for smoothing and cavities)
  const nb = Array.from({ length: cnt }, () => new Set());
  for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const NB = nb.map((s) => [...s]);

  // 1. proportions (each model its own) + a low-frequency warp + broad bumps
  const s = T.s.map((k, i) => k * (i === 1 ? 0.85 + R() * 0.3 : 0.88 + R() * 0.24));
  const ex = T.box ?? 0.63; // a superellipsoid: 1 = a sphere, lower = a chunkier, boxier block (the base of a real stone)
  for (let i = 0; i < cnt; i++) {
    const sx = D[i * 3], sy = D[i * 3 + 1], sz = D[i * 3 + 2];
    const dx = Math.sign(sx) * Math.abs(sx) ** ex, dy = Math.sign(sy) * Math.abs(sy) ** ex, dz = Math.sign(sz) * Math.abs(sz) ** ex;
    const b = 1 + N.fbm(dx * 1.7, dy * 1.7, dz * 1.7, 3) * 0.08;
    P[i * 3] = dx * s[0] * b + N(dx * 0.9 + 3, dy * 0.9, dz * 0.9) * T.warp;
    P[i * 3 + 1] = dy * s[1] * b + N2(dx * 0.9, dy * 0.9 + 3, dz * 0.9) * T.warp * 0.6;
    P[i * 3 + 2] = dz * s[2] * b + N3(dx * 0.9, dy * 0.9, dz * 0.9 + 3) * T.warp;
  }
  // 2. fracture planes: flatten everything beyond a plane (a broken face); 'side' cuts are near-vertical
  const cut = (nx, ny, nz, depth, k) => {
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    let sup = -1e9; for (let i = 0; i < cnt; i++) sup = Math.max(sup, P[i * 3] * nx + P[i * 3 + 1] * ny + P[i * 3 + 2] * nz);
    const off = sup * depth;
    for (let i = 0; i < cnt; i++) { const d = P[i * 3] * nx + P[i * 3 + 1] * ny + P[i * 3 + 2] * nz - off; if (d > 0) { P[i * 3] -= nx * d * k; P[i * 3 + 1] -= ny * d * k; P[i * 3 + 2] -= nz * d * k; } }
  };
  const [nc, [d0, d1], ck] = T.cuts;
  for (let c = 0; c < nc; c++) { const a = R() * Math.PI * 2, e = (R() - 0.35) * 1.6; cut(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), d0 + R() * (d1 - d0), ck * (0.75 + R() * 0.25)); }
  if (T.side) { const [ns, [s0, s1], sk] = T.side, a0 = R() * 6.28; for (let c = 0; c < ns; c++) { const a = a0 + (c / ns) * Math.PI * 2 + (R() - 0.5) * 0.5; cut(Math.cos(a), (R() - 0.5) * 0.25, Math.sin(a), s0 + R() * (s1 - s0), sk); } }
  if (T.top) cut((R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12, T.top[0], T.top[1]);
  // 3. strata: horizontal ledges stepping in, a thin groove at each bedding plane
  if (T.strata) {
    const [amt, per] = T.strata;
    let y0 = 1e9, y1 = -1e9; for (let i = 0; i < cnt; i++) { y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
    const tilt = (R() - 0.5) * 0.5;
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const t = (y - y0 + x * tilt) * per + N.fbm(x * 1.3, y * 0.6, z * 1.3, 2) * 0.55, f = t - Math.floor(t);
      const k = 1 - amt * (0.55 * f + 0.9 * sst(0.84, 0.95, f) * (1 - sst(0.95, 1.0, f)));
      P[i * 3] *= k; P[i * 3 + 2] *= k;
    }
  }
  // 4. water-wear: Laplacian smoothing
  for (let it = 0; it < T.smooth; it++) {
    const Q = P.slice();
    for (let i = 0; i < cnt; i++) { let ax = 0, ay = 0, az = 0; const L = NB[i]; for (const j of L) { ax += Q[j * 3]; ay += Q[j * 3 + 1]; az += Q[j * 3 + 2]; } const n = L.length; P[i * 3] = Q[i * 3] * 0.45 + (ax / n) * 0.55; P[i * 3 + 1] = Q[i * 3 + 1] * 0.45 + (ay / n) * 0.55; P[i * 3 + 2] = Q[i * 3 + 2] * 0.45 + (az / n) * 0.55; }
  }
  // 5. fine cracks pressed in along ridged-noise lines
  const crackM = new Float32Array(cnt);
  if (T.crack) {
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const r = 1 - Math.abs(N2(x * 2.6 + 11, y * 2.6, z * 2.6)), m = sst(0.86, 0.965, r) * T.crack;
      crackM[i] = Math.min(1, m);
      const l = Math.hypot(x, y, z) || 1, dd = 0.03 * m; P[i * 3] -= (x / l) * dd; P[i * 3 + 1] -= (y / l) * dd; P[i * 3 + 2] -= (z / l) * dd;
    }
  }
  // weathering: a light pass that takes the sharpness off the broken edges (the faces stay flat)
  for (let it = 0; it < (T.wear || 0); it++) {
    const Q = P.slice();
    for (let i = 0; i < cnt; i++) { let ax = 0, ay = 0, az = 0; const L = NB[i]; for (const j of L) { ax += Q[j * 3]; ay += Q[j * 3 + 1]; az += Q[j * 3 + 2]; } const n = L.length; P[i * 3] = Q[i * 3] * 0.78 + (ax / n) * 0.22; P[i * 3 + 1] = Q[i * 3 + 1] * 0.78 + (ay / n) * 0.22; P[i * 3 + 2] = Q[i * 3 + 2] * 0.78 + (az / n) * 0.22; }
  }
  // 6. the underside: squash what is below the bed line so it sits (and beds into the ground)
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < cnt; i++) { y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
  const yb = y0 + (y1 - y0) * T.bot;
  for (let i = 0; i < cnt; i++) if (P[i * 3 + 1] < yb) P[i * 3 + 1] = yb - (yb - P[i * 3 + 1]) * 0.18;
  // normalise: footprint radius 1, resting on y = 0, centred
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9; y0 = 1e9; y1 = -1e9;
  for (let i = 0; i < cnt; i++) { bx0 = Math.min(bx0, P[i * 3]); bx1 = Math.max(bx1, P[i * 3]); bz0 = Math.min(bz0, P[i * 3 + 2]); bz1 = Math.max(bz1, P[i * 3 + 2]); y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
  const sc = 2 / Math.max(bx1 - bx0, bz1 - bz0), cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  for (let i = 0; i < cnt; i++) pos.setXYZ(i, (P[i * 3] - cx) * sc, (P[i * 3 + 1] - y0) * sc, (P[i * 3 + 2] - cz) * sc);
  const H = (y1 - y0) * sc;
  geo.computeVertexNormals();

  // colour + masks
  const nrm = geo.attributes.normal, col = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2);
  const base = new THREE.Color(T.pal[v % T.pal.length]), c = new THREE.Color();
  let el = 0; for (let i = 0; i < cnt; i++) for (const j of NB[i]) el += Math.hypot(pos.getX(i) - pos.getX(j), pos.getY(i) - pos.getY(j), pos.getZ(i) - pos.getZ(j)); el /= I.length || 1;
  for (let i = 0; i < cnt; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nrm.getY(i), yt = y / H;
    let ax = 0, ay = 0, az = 0; for (const j of NB[i]) { ax += pos.getX(j); ay += pos.getY(j); az += pos.getZ(j); }
    const n = NB[i].length, cav = sst(0.0, 0.22, ((ax / n - x) * nrm.getX(i) + (ay / n - y) * ny + (az / n - z) * nrm.getZ(i)) / el);
    const mott = N.fbm(x * 1.8 + 5, y * 1.8, z * 1.8, 3), speck = N3(x * 14, y * 14, z * 14);
    let k = 0.92 + mott * 0.3;
    if (T.strata) k *= 0.95 + 0.12 * Math.sin((y * T.strata[1] + N2(x, y, z) * 0.6) * Math.PI * 2);
    k *= 1 - T.cav * cav;
    k *= 1 - 0.6 * crackM[i];
    k *= 0.8 + 0.2 * sst(0.0, 0.35, yt); // the foot, out of the light
    if (speck > 0.7) k *= 1.12; // pale weathering specks
    c.copy(base).multiplyScalar(k);
    c.offsetHSL(mott * 0.012, mott * 0.03, 0);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    // moss: round the foot and in the hollows, on tops that face up, broken up by noise
    const mm = T.moss * Math.min(1, sst(0.4, 0.0, yt) * 0.9 + sst(0.35, 0.85, ny) * 0.55 + cav * 0.6) * sst(-0.15, 0.3, N2.fbm(x * 2.4 + 7, y * 2.4, z * 2.4, 2));
    uv[i * 2] = Math.min(0.99, mm * 1.4) + Math.round(Math.min(3, T.crack * 2)); uv[i * 2 + 1] = Math.min(1, cav + crackM[i]); // x: moss + the crack level (integer part)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (T.crease) geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(T.crease));
  geo.userData.h = H;
  geo.userData.type = type;
  geoCache.set(key, geo);
  ROCK_STATS.models++; ROCK_STATS.ms += performance.now() - t0;
  return geo;
}
/** every base model (warm-up / a review grid) */
export const rockModels = () => Object.entries(ROCK_TYPES).flatMap(([t, T]) => Array.from({ length: T.n }, (_, v) => [t, v]));

/* ---------------------------------------------------------------- material */
const ROCK_U = { uWet: { value: 0 } };
let wetHooked = false;
const matCache = new Map();
/**
 * the rock material of a zone: waterY (the wet band + no snow below it; -1e3 = none), band (the wet band's height,
 * 1 = a lake's), wet (how much rain shows),
 * moss (zone moss multiplier), tint (a colour cast over the stones' own colours)
 */
export function rockMat({ waterY = -1e3, wet = 1, moss = 1, tint = '#ffffff', band = 1 } = {}) {
  const key = [waterY, wet, moss, tint, band].join('|');
  if (matCache.has(key)) return matCache.get(key);
  if (!wetHooked) { wetHooked = true; reg.updaters.push(() => { if (reg.groundU) ROCK_U.uWet.value = reg.groundU.uWet.value; }); }
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(tint), gradientMap: RAMP, vertexColors: true });
  m.shadowSide = THREE.BackSide; // closed models: the back faces cast, so the lit faces don't shadow themselves (no acne)
  const U = { uRkWaterY: { value: waterY }, uRkWetK: { value: wet }, uRkMoss: { value: moss }, uRkBand: { value: band } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uRkWet: ROCK_U.uWet, uRkSnow: SNOW_U, uRkSeason: SEASON_U.W });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW;\nvarying vec2 vRkM;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 w = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            w = instanceMatrix * w;
          #endif
          vRkW = (modelMatrix * w).xyz; vRkM = uv; }`);
    // the sun's shadow fades out on faces that turn away from it (the ramp darkens those anyway): many-faceted stones
    // would otherwise catch shadow acne at grazing angles when the shadow box is wide
    const lights = THREE.ShaderChunk.lights_fragment_begin
      .replace('? getShadow( directionalShadowMap[ i ]', '? mix( 1.0, getShadow( directionalShadowMap[ i ]')
      .replace('vDirectionalShadowCoord[ i ] ) : 1.0;', 'vDirectionalShadowCoord[ i ] ), smoothstep( 0.04, 0.3, dot( geometryNormal, directLight.direction ) ) ) : 1.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <common>', `#include <common>
        varying vec3 vRkW; varying vec2 vRkM;
        uniform float uRkWaterY, uRkWetK, uRkMoss, uRkBand, uRkWet, uRkSnow; uniform vec4 uRkSeason;
        float rkH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float rkN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(rkH(i), rkH(i + vec3(1,0,0)), f.x), mix(rkH(i + vec3(0,1,0)), rkH(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(rkH(i + vec3(0,0,1)), rkH(i + vec3(1,0,1)), f.x), mix(rkH(i + vec3(0,1,1)), rkH(i + vec3(1,1,1)), f.x), f.y), f.z); }
        vec3 rkH3(vec3 p){ return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
        // cellular (F2 - F1): the polygon network of a stone's cracks
        float rkVor(vec3 x){ vec3 i = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
          for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
            vec3 g = vec3(a, b, c); float d = length(g + rkH3(i + g) - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
          return d2 - d1; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float up = wn.y, n1 = rkN(vRkW * 3.1), n2 = rkN(vRkW * 9.7 + 3.1);
          float above = vRkW.y - uRkWaterY;
          float mossM = fract(vRkM.x), crackL = floor(vRkM.x + 0.001);
          // fine cracks: ridged noise lines in world space (the stones never move), stronger on the fractured kinds,
          // fading out with distance
          float fade = 1.0 - smoothstep(12.0, 32.0, length(vViewPosition));
          float crack = 0.0;
          if (crackL > 0.5 && fade > 0.0) {
            vec3 q = vRkW * vec3(1.4, 1.7, 1.4);
            float v1 = rkVor(q), w1 = fwidth(v1) * 1.0 + 0.008;
            float part = smoothstep(0.64, 0.72, rkN(vRkW * 1.1 + 2.0) + 0.03 * crackL); // only some edges crack
            crack = (1.0 - smoothstep(w1, w1 * 2.2, v1)) * part;
            if (crackL > 1.5) { float v2 = rkVor(q * 2.1 + 5.0), w2 = fwidth(v2) * 1.2 + 0.01; crack = max(crack, (1.0 - smoothstep(w2, w2 * 2.0, v2)) * part * smoothstep(0.6, 0.75, n1) * 0.5); }
            crack *= fade * min(1.0, crackL * 0.45);
          }
          diffuseColor.rgb *= 1.0 - 0.42 * clamp(crack, 0.0, 1.0);
          // moss: patches (large + small noise) where the model's mask allows; lusher in summer, olive in autumn / winter
          float mn = rkN(vRkW * 2.2 + 4.0) * 0.65 + n2 * 0.35;
          float mk = smoothstep(0.3, 0.55, mossM * uRkMoss * (1.0 + 0.25 * uRkSeason.y - 0.2 * uRkSeason.w) + (mn - 0.5) * 0.6);
          vec3 mossC = mix(vec3(0.19, 0.25, 0.12), vec3(0.29, 0.35, 0.16), n1);
          mossC = mix(mossC, vec3(0.45, 0.45, 0.27), uRkSeason.z * 0.55 + uRkSeason.w * 0.4);
          mossC *= 0.85 + 0.3 * step(0.62, n2); // lighter tufts in the moss
          diffuseColor.rgb = mix(diffuseColor.rgb, mossC, mk * 0.85);
          // the waterline: a darker wet band, and under the water less contrast, a little cooler
          diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, (0.16 + 0.12 * n1) * uRkBand, above)) * smoothstep(-0.14 * uRkBand - 0.02, 0.0, above);
          float under = 1.0 - smoothstep(-0.04, 0.01, above);
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(lum), diffuseColor.rgb, 0.45) * vec3(0.86, 0.95, 1.0), under * 0.55);
          // rain: the stone soaks darker (the hollows most)
          diffuseColor.rgb *= 1.0 - 0.3 * clamp(uRkWet * uRkWetK, 0.0, 1.2) * (0.75 + 0.25 * vRkM.y);
          // a few petals (spring) / leaves (autumn) caught on the tops, never under the water or the snow
          float top = smoothstep(0.55, 0.88, up) * step(0.04, above) * (1.0 - uRkSnow);
          vec3 c16 = vRkW * 16.0; float cell = rkH(floor(c16)), dot16 = step(length(fract(c16) - 0.5), 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.79, 0.86), step(1.0 - 0.07 * uRkSeason.x * top, cell) * dot16);
          vec3 c11 = vRkW * 11.0 + 17.0; float cell2 = rkH(floor(c11)), dot11 = step(length(fract(c11) - 0.5), 0.34);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.76, 0.38, 0.15), vec3(0.86, 0.62, 0.22), cell), step(1.0 - 0.06 * uRkSeason.z * top, cell2) * dot11);
          // snow: on what faces up, above the water, broken at its edge
          float sn = uRkSnow * smoothstep(0.32, 0.78, up + (n1 - 0.5) * 0.3) * smoothstep(0.02, 0.08, above);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.99), sn * 0.96);
        }`);
  };
  m.customProgramCacheKey = () => 'rock';
  matCache.set(key, m);
  return m;
}

/* ---------------------------------------------------------------- batches + placement */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/**
 * a zone's rocks. add() one rock; flush() builds the meshes: merged (default) or instanced (o.instanced: many rocks,
 * one InstancedMesh per base model). o.shadow: big rocks cast shadows (pebbles never do).
 */
export function rockBatch(parent, mat, o = {}) {
  const items = [];
  const placed = []; // [x, z, r] for spacing checks
  const B = {
    mat, placed, items,
    /** r: footprint radius (m); sink: how deep it beds in (fraction of its height); sq: [x, y, z] extra proportions */
    add(type, variant, x, y, z, r, { ry = 0, tilt = [0, 0], sink = 0.15, sq = [1, 1, 1], tint = null } = {}) {
      const geo = rockGeo(type, variant), h = geo.userData.h * r * sq[1];
      _e.set(tilt[0], ry, tilt[1]);
      items.push({ geo, type, pos: [x, y - sink * h, z], q: new THREE.Quaternion().setFromEuler(_e), s: [r * sq[0], r * sq[1], r * sq[2]], tint, big: r > 0.18 });
      placed.push([x, z, r]);
      return h;
    },
    /** is (x, z, r) clear of the rocks already placed (k < 1 lets them touch / overlap a little) */
    clear(x, z, r, k = 0.9) { return placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > (pr + r) * k); },
    flush() {
      if (!items.length) return null;
      const g = new THREE.Group(); g.name = o.name || 'Rocks'; parent.add(g);
      if (o.instanced) {
        const by = new Map(); items.forEach((it) => { if (!by.has(it.geo)) by.set(it.geo, []); by.get(it.geo).push(it); });
        by.forEach((list, geo) => {
          const im = new THREE.InstancedMesh(geo, mat, list.length);
          list.forEach((it, i) => { im.setMatrixAt(i, _m4.compose(_v.set(...it.pos), it.q, _s.set(...it.s))); im.setColorAt(i, _c.set(it.tint || '#ffffff')); });
          im.castShadow = o.shadow !== false && list.some((it) => it.big); im.receiveShadow = true;
          im.computeBoundingSphere(); g.add(im);
        });
      } else {
        // merged: one mesh for the casters, one for the small stones (indexed + creased models merge separately)
        const bins = new Map();
        items.forEach((it) => {
          const k = (it.big && o.shadow !== false ? 'c' : 'n') + (it.geo.index ? 'i' : 'x');
          const geo = it.geo.clone(); geo.applyMatrix4(_m4.compose(_v.set(...it.pos), it.q, _s.set(...it.s)));
          if (it.tint) { _c.set(it.tint); const cl = geo.attributes.color; for (let i = 0; i < cl.count; i++) cl.setXYZ(i, cl.getX(i) * _c.r, cl.getY(i) * _c.g, cl.getZ(i) * _c.b); }
          if (!bins.has(k)) bins.set(k, []); bins.get(k).push(geo);
        });
        bins.forEach((list, k) => {
          const m = new THREE.Mesh(mergeGeometries(list, false), mat);
          list.forEach((x) => x.dispose());
          m.castShadow = k[0] === 'c'; m.receiveShadow = true; m.userData.keep = true; m.matrixAutoUpdate = false; g.add(m);
        });
      }
      return g;
    },
  };
  return B;
}

const pick = (R, w) => { const e = Object.entries(w), t = e.reduce((a, [, v]) => a + v, 0); let r = R() * t; for (const [k, v] of e) { if ((r -= v) <= 0) return k; } return e[0][0]; };
/** the lowest ground under a footprint (so a rock on a slope beds in instead of floating on its low side) */
export const footY = (ground, x, z, r) => Math.min(ground(x, z), ground(x + r * 0.8, z), ground(x - r * 0.8, z), ground(x, z + r * 0.8), ground(x, z - r * 0.8));

/**
 * Rock Placement System: seeded clusters (a lead stone with smaller ones bedded round it, pebbles strewn at its foot)
 * + loose singles. cfg:
 *   seed, clusters (count), per: [min, max] stones round a lead, singles (count), pebbles: per cluster [min, max]
 *   at(R) -> [x, z] | null       a candidate spot (the zone's own sampler: a shoreline, a bed, a verge ...)
 *   ok(x, z, r) -> bool          the zone's keep-outs (roads, paths, doors, water, buildings ...)
 *   ground(x, z) -> y
 *   lead / kinds: { type: weight }  the lead stone's / the others' types; size / sizeS: [min, max] footprint radius
 *   sink: [min, max] fraction of height bedded in; tilt: max tilt (rad); spread: cluster radius multiple
 *   moss: chance a medium stone is a mossy one; tints: per-stone colour casts; minGap: spacing factor
 *   turn(x, z) -> ry             an optional heading (e.g. along a shore), jittered
 */
export function scatterRocks(B, cfg) {
  const R = rng(cfg.seed);
  const tints = cfg.tints || ['#ffffff'];
  const one = (type, x, z, r, sinkK = 1) => {
    if (type === 'medium' && R() < (cfg.moss || 0)) type = 'mossy';
    const v = (R() * ROCK_TYPES[type].n) | 0;
    const [s0, s1] = cfg.sink || [0.12, 0.25];
    const ry = cfg.turn ? cfg.turn(x, z) + (R() - 0.5) * 0.7 : R() * Math.PI * 2, t = cfg.tilt ?? 0.12;
    B.add(type, v, x, footY(cfg.ground, x, z, r), z, r, { ry, tilt: [(R() - 0.5) * 2 * t, (R() - 0.5) * 2 * t], sink: (s0 + R() * (s1 - s0)) * sinkK, sq: [0.9 + R() * 0.25, 0.8 + R() * 0.45, 0.9 + R() * 0.25], tint: tints[(R() * tints.length) | 0] });
  };
  const gap = cfg.minGap ?? 0.9;
  for (let c = 0, tries = 0; c < (cfg.clusters || 0) && tries < 400; tries++) {
    const p = cfg.at(R); if (!p) continue;
    const [x, z] = p, [a, b] = cfg.size, r = a + Math.pow(R(), 1.4) * (b - a);
    if (!cfg.ok(x, z, r) || !B.clear(x, z, r, gap)) continue;
    one(pick(R, cfg.lead || cfg.kinds), x, z, r); c++;
    const [p0, p1] = cfg.per || [1, 3], n = p0 + ((R() * (p1 - p0 + 1)) | 0);
    for (let i = 0, t = 0; i < n && t < 30; t++) {
      const [sa, sb] = cfg.sizeS || [r * 0.3, r * 0.6], rs = sa + R() * (sb - sa), ang = R() * Math.PI * 2, d = (r + rs) * (0.75 + R() * 0.5) * (cfg.spread || 1);
      const xs = x + Math.cos(ang) * d, zs = z + Math.sin(ang) * d;
      if (!cfg.ok(xs, zs, rs) || !B.clear(xs, zs, rs, 0.8)) continue;
      one(pick(R, cfg.kinds), xs, zs, rs); i++;
    }
    const [q0, q1] = cfg.pebbles || [0, 0], np = q0 + ((R() * (q1 - q0 + 1)) | 0);
    for (let i = 0, t = 0; i < np && t < 30; t++) {
      const rs = 0.04 + R() * 0.07, ang = R() * Math.PI * 2, d = r * (1.0 + R() * 1.4);
      const xs = x + Math.cos(ang) * d, zs = z + Math.sin(ang) * d;
      if (!cfg.ok(xs, zs, rs) || !B.clear(xs, zs, rs, 0.8)) continue;
      one('pebble', xs, zs, rs, 0.6); i++;
    }
  }
  for (let c = 0, tries = 0; c < (cfg.singles || 0) && tries < 300; tries++) {
    const p = cfg.at(R); if (!p) continue;
    const [x, z] = p, [a, b] = cfg.sizeS || cfg.size, r = a + R() * (b - a);
    if (!cfg.ok(x, z, r) || !B.clear(x, z, r, gap)) continue;
    one(pick(R, cfg.kinds), x, z, r); c++;
  }
  return B;
}
