import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reg, rng, RAMP, patchToon } from '../core.js';
import { SEASON_U } from '../tree.js';
import { WATER_U } from '../waterSystem.js';
import { bladeGeo, taperTube } from './kit.js';
import { makeHosta, makeFern, makeAspidistra } from './groundPlants.js';

/* ====================================================================================================
   Wild plants: the town's flowers, grasses, clover, groundcover and small shrubs, modelled as real plants.

   Models   12 types x 3-4 variants, each built ONCE from real parts and merged into one geometry:
              leaves      bladeGeo (kit.js): a blade with tip, base, midrib keel, cupping, droop and twist
              petals /    flat fans along an outline (teardrop petals, notched clover leaflets, round groundcover
              leaflets    leaves), cupped and bent
              grass       tapering strips bent along a curve (each blade its own arc and twist)
              stems       tapered tubes along curves (kit.js taperTube), branching for the shrubs / forget-me-nots
              flower      petals in a ring opening at an angle round a domed disc
            per vertex: colour (no textures), sway (0 at the base -> 1 at the tips: what the wind moves) and kind
            (0 leaf / stem, 1 flower, 2 grass blade, 3 seed head): the seasons act on the kinds.
              01 bushFlower   small flowering shrub: forking twigs, ovate leaves dense low, sparse high, blossoms
              02 bushLeaf     medium leafy shrub: bigger leaves on spreading branches, an irregular outline
              03 daisy        white daisies: 13-16 petals round a yellow dome, basal leaves, bent stems
              04 forget       forget-me-not: thin branching stems, clusters of tiny blue five-petal flowers
              05 pinkWild     a light pink wildflower: slender stems, open five / six-petal flowers, buds
              06 clover       three notched leaflets on curved stalks (a rare four-leaf one), now and then a flower
              07 tallGrass    long thin arching blades with a few seed stalks
              08 shortGrass   a short, dense tuft
              09 ornGrass     ornamental fountain grass: arching blades and soft nodding plumes
              10 pampas       pampas grass: a tall arching clump and cream feather plumes on tall stalks
              11 patch        a mixed wildflower patch: grass, daisies, forget-me-nots, pink flowers in one clump
              12 cover        low groundcover: a mat of small round leaves with tiny white flowers
   Material one toon material for all of them (vertex colours on the town's ramp, snow from core.js) + wind (the tips
            sway, each plant on its own phase; the stems stay planted), the seasons (spring flowers, summer deep
            green, autumn: fewer flowers and some grass turning straw, winter: the flowers rest, the evergreen
            shrubs stay green, plumes dry to beige) and rain (a little darker).
   Placing  plantField(): per zone, seeded clusters (same species together, mixed at the edges, gaps left open),
            each model's instances in ONE InstancedMesh (one draw call per model in use), terrain heights.
   ==================================================================================================== */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const C = (h) => new THREE.Color(h);
export const PAL = {
  sage: C('#86a476'), fresh: C('#7db267'), grass: C('#5c9a4c'), deep: C('#3d7240'), grey: C('#7c9580'), stem: C('#6f9a55'), stemD: C('#55743f'),
  cream: C('#fbf6e8'), white: C('#fffaf2'), pink: C('#f5c3d1'), coral: C('#f4b2a6'), lilac: C('#cdb6e6'), blue: C('#93b5ec'), mist: C('#a9c3e8'),
  yellow: C('#f2cf5b'), paleY: C('#f6e8a6'), plume: C('#efe4c8'), straw: C('#c9b27a'), twig: C('#6e5a44'),
};

/* ---------------------------------------------------------------- parts */
// every part carries position, normal, color, aSway, aKind (the merge needs one attribute set)
function part(geo, color, kind, colorFn = null) {
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.position.count, c = new Float32Array(n * 3), P = geo.attributes.position;
  for (let i = 0; i < n; i++) { const cc = colorFn ? colorFn(P.getX(i), P.getY(i), P.getZ(i), i) : color; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
  if (!geo.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); geo.setIndex(idx); }
  return geo;
}
const _m = new THREE.Matrix4(), _x = V(0, 0, 0), _y = V(0, 0, 0), _z = V(0, 0, 0);
/** orient a part: its +y along dir, its +z towards up, origin at p */
function orient(geo, p, dir, up = UP) {
  _y.copy(dir).normalize();
  _x.crossVectors(_y, up); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z).setPosition(p);
  return geo.applyMatrix4(_m);
}
/**
 * a flat shape as a fan from its base (0,0): outline(t) -> [x, y] for t in 0..1 round the edge (from the base back to
 * it); cup bends the sides up (+z), droop bends the tip down, n samples. Petals, leaflets, small round leaves.
 */
function fan(outline, { n = 12, cup = 0, droop = 0, L = 1 } = {}) {
  const pos = [0, 0, 0], idx = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = outline(i / n);
    pos.push(x, y, cup * x * x / Math.max(L, 1e-4) * 4 - droop * y * y / Math.max(L, 1e-4));
  }
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1 > n ? n : i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** a petal: teardrop outline, widest at ~60 %, rounded tip, slightly notched or pointed */
function petal(L, W, { cup = 0.25, droop = 0.1, notch = 0, n = 10 } = {}) {
  return fan((t) => {
    const a = t * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); // t = 0 / 1 at the base, 0.5 at the tip
    const y = L * (1 - c) / 2, side = s; // y 0..L
    const v = y / L, w = W / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + 0.88 * v)), 0.75) * (1 - 0.15 * v);
    return [side >= 0 ? w * Math.min(1, Math.abs(s) * 3) : -w * Math.min(1, Math.abs(s) * 3), y - notch * L * Math.max(0, 1 - Math.abs(t - 0.5) * 12)];
  }, { n, cup: cup * W, droop: droop, L });
}
/** a clover leaflet: obcordate (a heart with the notch at the far end) */
function leaflet(L) {
  return fan((t) => {
    const s = t < 0.5 ? 1 : -1, u = t < 0.5 ? t * 2 : (1 - t) * 2; // 0 at the base -> 1 at the notch
    const y = L * Math.min(1, u * 1.05), w = L * 0.55 * Math.sin(Math.PI * 0.5 * Math.pow(u, 0.55)) * (u > 0.85 ? 1 - (u - 0.85) * 1.6 : 1);
    return [s * w, u > 0.92 ? L * (1 - (u - 0.92) * 2.2) : y];
  }, { n: 9, cup: 0.05, droop: 0.15, L });
}
/** a small round leaf (groundcover, the shrubs' little leaves when cheap) */
function roundLeaf(L, W = L * 0.8) {
  return fan((t) => { const a = t * Math.PI * 2; return [Math.sin(a) * W / 2 * (1 - 0.2 * (1 - Math.cos(a)) / 2), L * (1 - Math.cos(a)) / 2]; }, { n: 7, cup: 0.12, droop: 0.2, L });
}
/** a grass blade: a tapering strip bent along an arc (base at 0, rising along dir, bending towards bend) */
function blade(L, W, { lean = 0.3, curl = 0.5, twist = 0.4, seg = 5 } = {}) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = W * Math.pow(1 - t, 0.85) * (t < 0.08 ? 0.75 + t * 3 : 1);
    const y = L * (t - curl * 0.35 * t * t), x = L * (lean * t + curl * t * t);
    const a = twist * t, dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    pos.push(x - dz, y, -dx, x + dz, y, dx); // the width across z, turned by the twist
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const stem = (pts, r0, r1, segs = 6, radial = 4) => taperTube(new THREE.CatmullRomCurve3(pts), r0, r1, segs, radial);
const mix = (a, b, t) => a.clone().lerp(b, t);
const jit = (R, c, k = 0.08) => c.clone().offsetHSL((R() - 0.5) * k * 0.3, (R() - 0.5) * k, (R() - 0.5) * k);

/** a flower head facing +y: ring of petals round a domed disc; opens by `open` (radians above flat) */
function flowerHead(R, { n = 14, L = 0.04, W = 0.014, open = 0.25, petalCol, disc = PAL.yellow, discR = 0.012, discH = 0.6, notch = 0.08, rings = 1 }) {
  const parts = [];
  for (let ring = 0; ring < rings; ring++) {
    const m = ring ? Math.round(n * 0.8) : n, off = ring ? Math.PI / m : 0;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + off + (R() - 0.5) * 0.12, e = open + ring * 0.25 + (R() - 0.5) * 0.18;
      const dir = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      const up = V(-Math.cos(a) * Math.sin(e), Math.cos(e), -Math.sin(a) * Math.sin(e));
      const Lp = L * (0.85 + R() * 0.3) * (ring ? 0.85 : 1);
      parts.push(part(orient(petal(Lp, W * (0.85 + R() * 0.3), { notch, cup: 0.3 }), V(Math.cos(a) * discR * 0.7, discR * 0.15, Math.sin(a) * discR * 0.7), dir, up), jit(R, petalCol, 0.05), 1));
    }
  }
  const d = new THREE.SphereGeometry(discR, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, discH, 1);
  parts.push(part(d, disc, 1, (x, y) => mix(disc.clone().multiplyScalar(0.8), disc, Math.min(1, y / (discR * discH)))));
  return parts;
}
/** move a list of head-space parts (+y = facing) to p, facing along dir */
function placeHead(parts, p, dir) {
  // head space: +y = facing; build a basis whose y = dir
  const y = dir.clone().normalize(), x = V(1, 0, 0).cross(y); if (x.lengthSq() < 1e-4) x.set(0, 0, 1); x.normalize();
  const z = x.clone().cross(y).normalize(), M = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);
  return parts.map((g) => g.applyMatrix4(M));
}

/** merge + sway: 0 at the base, rising to 1 at the plant's top (flexK: how much the wind moves it) */
function build(parts, flexK = 1, swayPow = 1.6) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingBox();
  const H = Math.max(0.01, g.boundingBox.max.y), P = g.attributes.position, S = g.attributes.aSway;
  for (let i = 0; i < P.count; i++) S.setX(i, Math.pow(Math.max(0, P.getY(i)) / H, swayPow) * flexK);
  g.computeBoundingSphere();
  g.userData.h = H;
  g.userData.tris = g.index.count / 3;
  return g;
}

/* ---------------------------------------------------------------- the plants */
const MODELS = {
  // 03 白いデイジー: bent stems, 1-3 heads (some still opening), strap leaves at the foot
  daisy(R, lite) {
    const parts = [], heads = lite ? 2 : 2 + ((R() * 3) | 0);
    for (let i = 0; i < 5 + ((R() * 3) | 0); i++) { // basal leaves: narrow, toothed-looking via wave
      const a = R() * 6.28, L = 0.09 + R() * 0.06, dir = V(Math.cos(a) * 0.8, 0.55 + R() * 0.2, Math.sin(a) * 0.8);
      parts.push(part(orient(bladeGeo({ L, W: L * 0.32, segL: lite ? 3 : 5, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + v)), 0.6), droop: 0.35, cup: 0.12, wave: 0.12, waveF: 7 }), V(0, 0.005, 0), dir, UP), jit(R, mix(PAL.fresh, PAL.grass, R()), 0.08), 0));
    }
    for (let h = 0; h < heads; h++) {
      const a = R() * 6.28, H = 0.24 + R() * 0.16, lean = 0.04 + R() * 0.07;
      const top = V(Math.cos(a) * lean, H, Math.sin(a) * lean), mid = V(Math.cos(a) * lean * 0.3 + (R() - 0.5) * 0.02, H * 0.55, Math.sin(a) * lean * 0.3);
      parts.push(part(stem([V(0, 0, 0), mid, top], 0.0045, 0.003, lite ? 3 : 6, 4), PAL.stem, 0));
      if (!lite) parts.push(part(orient(bladeGeo({ L: 0.045, W: 0.012, segL: 3, segW: 1, width: (v) => Math.sin(Math.PI * Math.min(1, 0.2 + v)), droop: 0.3 }), mid, V(Math.cos(a + 1.5), 0.5, Math.sin(a + 1.5)), UP), PAL.fresh, 0));
      const face = V(Math.cos(a) * 0.35 + (R() - 0.5) * 0.3, 1, Math.sin(a) * 0.35 + (R() - 0.5) * 0.3);
      const bud = h === 2 && R() < 0.5;
      parts.push(...placeHead(flowerHead(R, { n: lite ? 11 : 14 + ((R() * 3) | 0), L: (bud ? 0.024 : 0.044) * (0.9 + R() * 0.25), W: 0.013, open: bud ? 1.0 : 0.12 + R() * 0.15, petalCol: R() < 0.7 ? PAL.white : PAL.cream, discR: 0.012, notch: 0.06 }), top, face));
    }
    return build(parts, 1);
  },
  // 04 勿忘草: thin forking stems, clusters (cymes) of tiny sky-blue flowers with yellow eyes, a few pink buds
  forget(R, lite) {
    const parts = [];
    for (let i = 0; i < 6; i++) { const a = R() * 6.28, L = 0.05 + R() * 0.03; parts.push(part(orient(bladeGeo({ L, W: L * 0.45, segL: 3, segW: 1, width: (v) => Math.sin(Math.PI * Math.min(1, 0.1 + v)), droop: 0.3, cup: 0.1 }), V(0, 0.004, 0), V(Math.cos(a), 0.45, Math.sin(a)), UP), jit(R, PAL.grey, 0.08), 0)); }
    const stems = lite ? 3 : 4 + ((R() * 4) | 0);
    for (let s = 0; s < stems; s++) {
      const a = R() * 6.28, H = 0.1 + R() * 0.1, lean = 0.05 + R() * 0.07;
      const top = V(Math.cos(a) * lean, H, Math.sin(a) * lean);
      parts.push(part(stem([V(0, 0, 0), V(Math.cos(a) * lean * 0.4, H * 0.5, Math.sin(a) * lean * 0.4), top], 0.003, 0.002, lite ? 3 : 5, 3), PAL.stem, 0));
      // a cluster at the tip: 5-9 tiny flowers on short pedicels
      const nf = lite ? 4 : 7 + ((R() * 5) | 0);
      for (let f = 0; f < nf; f++) {
        const b = R() * 6.28, d = 0.01 + R() * 0.025, p = V(top.x + Math.cos(b) * d, top.y + (R() - 0.3) * 0.02, top.z + Math.sin(b) * d);
        const col = R() < 0.12 ? PAL.pink : jit(R, R() < 0.5 ? PAL.blue : PAL.mist, 0.06);
        const fl = [];
        for (let k = 0; k < 5; k++) { const c = (k / 5) * Math.PI * 2; fl.push(part(orient(petal(0.011, 0.0105, { cup: 0.15, droop: 0, n: 4 }), V(0, 0, 0), V(Math.cos(c), 0.12, Math.sin(c)), UP), col, 1)); }
        const eye = new THREE.CircleGeometry(0.0032, 4); eye.rotateX(-Math.PI / 2); eye.translate(0, 0.0012, 0);
        fl.push(part(eye, PAL.paleY, 1));
        parts.push(...placeHead(fl, p, V((R() - 0.5) * 0.8, 1, (R() - 0.5) * 0.8)));
      }
    }
    return build(parts, 1.2);
  },
  // 05 淡いピンクの野の花: slender stems, open flowers with five-six broad petals, a bud or two
  pinkWild(R, lite) {
    const parts = [], n = lite ? 3 : 4 + ((R() * 4) | 0), col = [PAL.pink, PAL.coral, mix(PAL.pink, PAL.white, 0.5)][(R() * 3) | 0];
    for (let i = 0; i < 4; i++) { const a = R() * 6.28, L = 0.06 + R() * 0.04; parts.push(part(orient(bladeGeo({ L, W: L * 0.3, segL: 3, segW: 1, width: (v) => Math.sin(Math.PI * Math.min(1, 0.15 + v)), droop: 0.4 }), V(0, 0.004, 0), V(Math.cos(a), 0.5, Math.sin(a)), UP), PAL.fresh, 0)); }
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, H = 0.18 + R() * 0.18, lean = 0.05 + R() * 0.1, top = V(Math.cos(a) * lean, H, Math.sin(a) * lean);
      const mid = V(Math.cos(a) * lean * 0.35, H * 0.5, Math.sin(a) * lean * 0.35);
      parts.push(part(stem([V(0, 0, 0), mid, top], 0.0035, 0.0022, lite ? 3 : 6, 3), PAL.stem, 0));
      if (!lite) for (const t of [0.35, 0.6]) { const s = V(0, H * t, 0).lerp(top, t * 0.4); const b = R() * 6.28; parts.push(part(orient(bladeGeo({ L: 0.035, W: 0.008, segL: 3, segW: 1, width: (v) => Math.sin(Math.PI * Math.min(1, 0.2 + v)), droop: 0.2 }), s, V(Math.cos(b), 0.6, Math.sin(b)), UP), PAL.fresh, 0)); }
      const bud = i >= n - 1 - ((R() * 2) | 0) && i > 1;
      parts.push(...placeHead(flowerHead(R, { n: 5 + (R() < 0.4 ? 1 : 0), L: bud ? 0.018 : 0.036 + R() * 0.01, W: bud ? 0.016 : 0.03, open: bud ? 1.1 : 0.18 + R() * 0.2, petalCol: jit(R, col, 0.05), disc: PAL.paleY, discR: 0.006, discH: 0.8, notch: 0.12 }), top, V(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4)));
    }
    return build(parts, 1.1);
  },
  // 06 クローバー: leaves of three notched leaflets on curved stalks; rarely four; now and then a white flower
  clover(R, lite) {
    const parts = [], n = (lite ? 7 : 11) + ((R() * 6) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * 0.08, H = 0.025 + R() * 0.045, base = V(Math.cos(a) * d, 0, Math.sin(a) * d);
      const top = V(base.x + Math.cos(a) * 0.02, H, base.z + Math.sin(a) * 0.02);
      parts.push(part(stem([base, V(base.x, H * 0.6, base.z), top], 0.0022, 0.0016, 3, 3), PAL.stem, 0));
      const k = R() < 0.03 ? 4 : 3, rot = R() * 6.28, L = 0.024 + R() * 0.014, col = jit(R, mix(PAL.grass, PAL.fresh, R()), 0.06);
      for (let j = 0; j < k; j++) {
        const b = rot + (j / k) * Math.PI * 2, dir = V(Math.cos(b), 0.05 + R() * 0.15, Math.sin(b));
        // the pale chevron on clover leaves: lighter towards the middle of each leaflet
        parts.push(part(orient(leaflet(L), top, dir, UP), col, 0));
      }
    }
    if (!lite && R() < 0.35) { // a white clover flower: a little ball of florets
      const a = R() * 6.28, top = V(Math.cos(a) * 0.03, 0.12 + R() * 0.04, Math.sin(a) * 0.03);
      parts.push(part(stem([V(0, 0, 0), V(top.x * 0.5, top.y * 0.6, top.z * 0.5), top], 0.002, 0.0015, 4, 3), PAL.stem, 0));
      for (let f = 0; f < 14; f++) { const u = R() * 6.28, e = R() * 1.2 - 0.3; parts.push(part(orient(petal(0.012, 0.005, { cup: 0.2, n: 6 }), top, V(Math.cos(u) * Math.cos(e), Math.sin(e), Math.sin(u) * Math.cos(e)), UP), R() < 0.8 ? PAL.white : PAL.pink, 1)); }
    }
    return build(parts, 0.6);
  },
  // 07 背の高い野草: long thin arching blades, a few seed stalks
  tallGrass(R, lite) {
    const parts = [], n = (lite ? 7 : 11) + ((R() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, L = 0.3 + R() * 0.32, g = blade(L, 0.012 + R() * 0.006, { lean: 0.08 + R() * 0.15, curl: 0.2 + R() * 0.35, twist: (R() - 0.5) * 1.2, seg: lite ? 3 : 5 });
      g.rotateY(-a); g.translate(Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015);
      parts.push(part(g, jit(R, mix(PAL.grass, PAL.sage, R() * 0.6), 0.08), 2, (x, y) => mix(PAL.deep, PAL.fresh, Math.min(1, y / 0.45))));
    }
    if (!lite) for (let s = 0; s < 1 + ((R() * 3) | 0); s++) { // seed stalks with a slim head
      const a = R() * 6.28, H = 0.5 + R() * 0.2, top = V(Math.cos(a) * 0.08, H, Math.sin(a) * 0.08);
      parts.push(part(stem([V(0, 0, 0), V(top.x * 0.4, H * 0.6, top.z * 0.4), top], 0.0025, 0.0018, 4, 3), PAL.sage, 2));
      const hd = new THREE.CylinderGeometry(0.004, 0.007, 0.06, 5, 1); hd.translate(top.x, top.y + 0.02, top.z);
      parts.push(part(hd, PAL.straw, 3));
    }
    return build(parts, 1.3, 1.4);
  },
  // 08 低い草むら: a short, dense tuft
  shortGrass(R, lite) {
    const parts = [], n = (lite ? 7 : 12) + ((R() * 6) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, L = 0.1 + R() * 0.12, g = blade(L, 0.013 + R() * 0.005, { lean: 0.15 + R() * 0.25, curl: 0.15 + R() * 0.3, twist: (R() - 0.5), seg: lite ? 2 : 4 });
      g.rotateY(-a); g.translate(Math.cos(a) * 0.02 * R(), 0, Math.sin(a) * 0.02 * R());
      parts.push(part(g, PAL.grass, 2, (x, y) => mix(PAL.deep, jit(R, PAL.fresh, 0.05), Math.min(1, y / 0.18))));
    }
    return build(parts, 0.9, 1.4);
  },
  // 09 観賞用の草: arching fountain grass with soft nodding plumes
  ornGrass(R, lite) {
    const parts = [], n = (lite ? 12 : 20) + ((R() * 6) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, L = 0.35 + R() * 0.25, g = blade(L, 0.02, { lean: 0.35 + R() * 0.25, curl: 0.5 + R() * 0.4, twist: (R() - 0.5) * 0.8, seg: lite ? 3 : 5 });
      g.rotateY(-a);
      parts.push(part(g, PAL.sage, 2, (x, y) => mix(PAL.grass, mix(PAL.sage, PAL.paleY, 0.15), Math.min(1, y / 0.4))));
    }
    for (let s = 0; s < (lite ? 3 : 5 + ((R() * 3) | 0)); s++) { // plumes: a bent stalk ending in a soft bottle-brush of thin bristles
      const a = R() * 6.28, H = 0.42 + R() * 0.15, tip = V(Math.cos(a) * 0.22, H, Math.sin(a) * 0.22), mid = V(Math.cos(a) * 0.1, H * 0.85, Math.sin(a) * 0.1);
      parts.push(part(stem([V(0, 0, 0), mid, tip], 0.0025, 0.002, 4, 3), PAL.sage, 2));
      const dir = tip.clone().sub(mid).normalize();
      for (let b = 0; b < (lite ? 10 : 20); b++) {
        const t = b / 20, p = mid.clone().lerp(tip, 0.3 + t * 0.7), u = R() * 6.28;
        const out = V(Math.cos(u), 0, Math.sin(u)).addScaledVector(dir, 0.6).normalize();
        parts.push(part(orient(petal(0.045, 0.012, { cup: 0, droop: 0.2, n: 5 }), p, out, UP), mix(PAL.plume, PAL.lilac, 0.15), 3));
      }
    }
    return build(parts, 1.1, 1.5);
  },
  // 10 パンパスグラス: a tall arching clump and cream feather plumes on tall stalks
  pampas(R, lite) {
    const parts = [], n = (lite ? 16 : 26) + ((R() * 8) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, L = 0.6 + R() * 0.45, g = blade(L, 0.024, { lean: 0.25 + R() * 0.3, curl: 0.55 + R() * 0.45, twist: (R() - 0.5) * 0.6, seg: lite ? 3 : 6 });
      g.rotateY(-a);
      parts.push(part(g, PAL.grey, 2, (x, y) => mix(PAL.grass, PAL.sage, Math.min(1, y / 0.7))));
    }
    for (let s = 0; s < 3 + ((R() * 4) | 0); s++) { // the plumes: many soft feathers round the upper stalk
      const a = R() * 6.28, H = 1.15 + R() * 0.45, lean = 0.08 + R() * 0.12, top = V(Math.cos(a) * lean, H, Math.sin(a) * lean);
      parts.push(part(stem([V(0, 0, 0), V(top.x * 0.3, H * 0.55, top.z * 0.3), top], 0.005, 0.003, 5, 4), PAL.sage, 0));
      const dir = top.clone().normalize();
      const nb = lite ? 18 : 36, pl = 0.3 + R() * 0.12;
      for (let b = 0; b < nb; b++) {
        const t = b / nb, p = top.clone().addScaledVector(dir, -pl * (1 - t)), u = b * 2.4 + R();
        const out = V(Math.cos(u), 0, Math.sin(u)).multiplyScalar(0.8).addScaledVector(dir, 1.1).normalize();
        const Lf = 0.13 * Math.sin(Math.PI * (0.15 + 0.85 * t)) + 0.04;
        parts.push(part(orient(petal(Lf, 0.045, { cup: 0.4, droop: 0.15, n: 7 }), p, out, dir), jit(R, PAL.plume, 0.04), 3));
      }
    }
    return build(parts, 0.8, 1.3);
  },
  // 12 グランドカバー: a low mat of small round leaves, a sprinkle of tiny white flowers
  cover(R, lite) {
    const parts = [], n = (lite ? 30 : 55) + ((R() * 15) | 0), rad = 0.13 + R() * 0.07;
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * rad, h = 0.008 + (1 - d / rad) * 0.03 + R() * 0.01, p = V(Math.cos(a) * d, h, Math.sin(a) * d);
      const b = R() * 6.28, L = 0.028 + R() * 0.014;
      parts.push(part(orient(roundLeaf(L), p, V(Math.cos(b), 0.25 + R() * 0.3, Math.sin(b)), UP), jit(R, mix(PAL.deep, PAL.grass, R()), 0.07), 0));
    }
    for (let f = 0; f < (lite ? 3 : 6 + ((R() * 6) | 0)); f++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * rad * 0.9, p = V(Math.cos(a) * d, 0.05, Math.sin(a) * d), fl = [];
      for (let k = 0; k < 5; k++) { const c = (k / 5) * Math.PI * 2; fl.push(part(orient(petal(0.01, 0.008, { cup: 0.1, n: 6 }), V(0, 0, 0), V(Math.cos(c), 0.1, Math.sin(c)), UP), PAL.white, 1)); }
      parts.push(...placeHead(fl, p, UP));
    }
    return build(parts, 0.3);
  },
  // 01 花の咲く低木: forking twigs, ovate leaves dense low and sparse high, small five-petal blossoms
  bushFlower(R, lite) { return shrub(R, lite, { H: 0.45 + R() * 0.2, W: 0.55 + R() * 0.25, leaves: lite ? 150 : 250, L: 0.078, flowers: lite ? 16 : 30, fcol: [PAL.pink, PAL.white, PAL.lilac, PAL.coral][(R() * 4) | 0], palette: [PAL.grass, PAL.deep, PAL.fresh] }); },
  // 02 葉の茂る低木: bigger leaves on spreading branches, an irregular outline
  bushLeaf(R, lite) { return shrub(R, lite, { H: 0.6 + R() * 0.3, W: 0.7 + R() * 0.35, leaves: lite ? 150 : 240, L: 0.11, flowers: 0, palette: [PAL.deep, PAL.grass, PAL.grey] }); },
  // 11 混ざった野の花: grass, daisies, forget-me-nots and pink flowers in one clump (offset round its centre)
  patch(R, lite) {
    const parts = [], add = (fn, x, z, s = 1) => { const g = MODELS[fn](R, true).clone(); g.scale(s, s, s); g.translate(x, 0, z); parts.push(g); };
    add('shortGrass', 0, 0, 1.2); add('tallGrass', 0.12, -0.05, 0.8);
    for (let i = 0; i < 3; i++) { const a = R() * 6.28, d = 0.06 + R() * 0.18; add(['daisy', 'forget', 'pinkWild', 'daisy'][(R() * 4) | 0], Math.cos(a) * d, Math.sin(a) * d, 0.8 + R() * 0.3); }
    if (R() < 0.6) add('clover', (R() - 0.5) * 0.3, (R() - 0.5) * 0.3);
    const g = mergeGeometries(parts, false); g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.h = g.boundingBox.max.y; g.userData.tris = g.index.count / 3;
    return g;
  },
};
/** a small shrub: a few stems from the base forking twice, leaves along the twigs (more and bigger low down),
    blossoms at some twig ends; the outline stays irregular (the stems lean different ways and lengths) */
function shrub(R, lite, { H, W, leaves, L, flowers, fcol, palette }) {
  const parts = [], tips = [], segs = [];
  const grow = (p, dir, len, r, depth) => {
    const end = p.clone().addScaledVector(dir, len), mid = p.clone().lerp(end, 0.5).add(V((R() - 0.5) * len * 0.15, 0, (R() - 0.5) * len * 0.15));
    parts.push(part(stem([p, mid, end], r, r * 0.6, lite ? 2 : 4, lite ? 3 : 4), PAL.twig, 0));
    segs.push([p, end, depth]);
    if (depth >= 2) { tips.push(end); return; }
    const k = depth === 0 ? 2 + ((R() * 2) | 0) : 2 + (R() < 0.4 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const a = R() * 6.28, d = dir.clone().add(V(Math.cos(a) * 0.75, 0.1 + R() * 0.25, Math.sin(a) * 0.75)).normalize();
      grow(end, d, len * (depth === 0 ? 1.3 + R() * 0.5 : 0.7 + R() * 0.3), r * 0.65, depth + 1); // the forks start low: a shrub, not a sapling
    }
  };
  const ns = 3 + ((R() * 3) | 0);
  for (let s = 0; s < ns; s++) { const a = (s / ns) * 6.28 + R() * 0.8, d = V(Math.cos(a) * (0.35 + R() * 0.3), 1, Math.sin(a) * (0.35 + R() * 0.3)).normalize(); grow(V(Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02), d, H * (0.2 + R() * 0.08), 0.008, 0); }
  // leaves: a rosette round every twig tip + leaves along the twigs (none on the bare stems at the foot); ovate
  // blades of varying size and turn, so the bush is a dense, broken mass of leaves, not a ball
  const leaf = (Lk, lo) => bladeGeo({ L: Lk, W: Lk * 0.6, segL: 2, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + v * 0.95)), 0.7), droop: 0.25, cup: 0.12, keel: 0.03, twist: (R() - 0.5) * 0.6 });
  const addLeaf = (p, out, hk) => {
    const Lk = L * (0.75 + R() * 0.5) * (1.1 - hk * 0.25), c = jit(R, palette[(R() * palette.length) | 0], 0.06);
    parts.push(part(orient(leaf(Lk, lite), p, out, UP), c, 0));
  };
  const per = leaves / Math.max(1, tips.length * 7 + segs.filter((g) => g[2] > 0).length * 4);
  tips.forEach((tp) => {
    const n = Math.round((lite ? 5 : 7) * per * (0.8 + R() * 0.5));
    for (let i = 0; i < n; i++) {
      const u = R() * 6.28, e = -0.2 + R() * 1.1, out = V(Math.cos(u) * Math.cos(e), Math.sin(e), Math.sin(u) * Math.cos(e)).normalize();
      addLeaf(tp.clone().addScaledVector(out, 0.01 + R() * 0.03), out, tp.y / H);
    }
  });
  segs.forEach(([a, b, depth]) => {
    if (depth === 0 && R() < 0.5) return;
    const n = Math.round(4 * per * (0.7 + R() * 0.6));
    for (let i = 0; i < n; i++) {
      const p = a.clone().lerp(b, 0.15 + R() * 0.85), u = R() * 6.28;
      const out = V(p.x, 0, p.z).normalize().multiplyScalar(0.6).add(V(Math.cos(u) * 0.7, 0.2 + R() * 0.5, Math.sin(u) * 0.7)).normalize();
      addLeaf(p, out, p.y / H);
    }
  });
  // blossoms at some twig ends (and a few along them)
  for (let f = 0; f < flowers; f++) {
    const p = tips[(R() * tips.length) | 0].clone().add(V((R() - 0.5) * 0.06, (R() - 0.2) * 0.04, (R() - 0.5) * 0.06));
    const fl = [], nP = 5;
    for (let k = 0; k < nP; k++) { const c = (k / nP) * Math.PI * 2 + R() * 0.2; fl.push(part(orient(petal(0.03, 0.026, { cup: 0.25, notch: 0.08, n: 5 }), V(0, 0, 0), V(Math.cos(c), 0.25, Math.sin(c)), UP), jit(R, fcol, 0.05), 1)); }
    const eye = new THREE.SphereGeometry(0.007, 5, 3); eye.scale(1, 0.6, 1); fl.push(part(eye, PAL.yellow, 1));
    parts.push(...placeHead(fl, p, V((R() - 0.5) * 0.9, 1, (R() - 0.5) * 0.9)));
  }
  // scale to the target width (the forks make the spread random)
  const g = build(parts, 0.35, 1.2);
  g.computeBoundingBox();
  const bb = g.boundingBox, sx = W / Math.max(0.1, bb.max.x - bb.min.x);
  g.scale(Math.min(1.4, sx), 1, Math.min(1.4, sx));
  g.computeBoundingSphere();
  return g;
}

/** a hydrangea head: a dome of small four-petal florets (white: the instance colour tints it blue / violet / pink) */
let HYD = null;
export function hydrangeaGeo() {
  if (HYD) return HYD;
  const R = rng(6900), parts = [], r = 0.15;
  for (let i = 0; i < 30; i++) {
    const u = R() * 6.28, e = Math.acos(1 - R() * 0.95), n = V(Math.sin(e) * Math.cos(u), Math.cos(e), Math.sin(e) * Math.sin(u)), p = n.clone().multiplyScalar(r * (0.85 + R() * 0.15));
    const fl = [], rot = R() * 6.28;
    for (let k = 0; k < 4; k++) { const c = rot + (k / 4) * Math.PI * 2; fl.push(part(orient(petal(0.04, 0.034, { cup: 0.2, n: 5 }), V(0, 0, 0), V(Math.cos(c), 0.2, Math.sin(c)), UP), jit(R, PAL.white, 0.06), 1)); }
    parts.push(...placeHead(fl, p, n));
  }
  const core = new THREE.SphereGeometry(r * 0.82, 10, 6); parts.push(part(core, mix(PAL.grass, PAL.white, 0.45), 0));
  HYD = build(parts, 0.2);
  return HYD;
}

/* ---------------------------------------------------------------- cultivated flowers (pots, planters, the florist)
   kind 4 = cultivated: they never rest for the season (pots and vases are looked after) */
const CUT = {
  hydrangea: [C('#8fa8e8'), C('#b39ae0'), C('#a7c4f0'), C('#e8a6c8')],
  rose: [C('#e66a82'), C('#f4b2c0'), C('#c94a62'), C('#fbe6dc')],
  sunflower: [C('#f5c432'), C('#f7d25a')],
  lavender: [C('#9a7ad6'), C('#b49ae6')],
  gerbera: [C('#ff8a5c'), C('#ffb3c6'), C('#ff6f8a'), C('#ffd36b')],
  pansy: [C('#f6d55c'), C('#f2a6c0'), C('#b59ae0'), C('#fbf7ee'), C('#f4a58e')],
};
const cutStem = (R, parts, H, lean = 0.04) => {
  const a = R() * 6.28, top = V(Math.cos(a) * lean, H, Math.sin(a) * lean);
  parts.push(part(stem([V(0, 0, 0), V(top.x * 0.4, H * 0.5, top.z * 0.4), top], 0.0045, 0.0035, 5, 4), PAL.stem, 0));
  for (let i = 0; i < 2; i++) { const b = a + 2 + i * 2.5, p = V(top.x * 0.3, H * (0.3 + i * 0.22), top.z * 0.3); parts.push(part(orient(bladeGeo({ L: 0.07, W: 0.022, segL: 3, segW: 1, width: (v) => Math.sin(Math.PI * Math.min(1, 0.12 + v)), droop: 0.3, cup: 0.1 }), p, V(Math.cos(b), 0.6, Math.sin(b)), UP), PAL.fresh, 0)); }
  return top;
};
const asKind = (parts, k) => { parts.forEach((g) => { const a = g.attributes.aKind; for (let i = 0; i < a.count; i++) if (a.getX(i) === 1) a.setX(i, k); }); return parts; };
Object.assign(MODELS, {
  // a cut hydrangea: a dome of four-petal florets on a stem
  cutHydrangea(R, lite, v) {
    const parts = [], top = cutStem(R, parts, 0.38 + R() * 0.1), col = CUT.hydrangea[v % 4], r = 0.075;
    for (let i = 0; i < (lite ? 16 : 26); i++) {
      const u = R() * 6.28, e = Math.acos(1 - R() * 0.95), n = V(Math.sin(e) * Math.cos(u), Math.cos(e), Math.sin(e) * Math.sin(u)), p = top.clone().addScaledVector(n, r * (0.8 + R() * 0.2)).add(V(0, r * 0.5, 0));
      const fl = [], rot = R() * 6.28;
      for (let k = 0; k < 4; k++) { const c = rot + (k / 4) * Math.PI * 2; fl.push(part(orient(petal(0.026, 0.022, { cup: 0.2, n: 5 }), V(0, 0, 0), V(Math.cos(c), 0.2, Math.sin(c)), UP), jit(R, col, 0.06), 4)); }
      parts.push(...placeHead(fl, p, n));
    }
    const core = new THREE.SphereGeometry(r * 0.8, 8, 5); core.translate(top.x, top.y + r * 0.5, top.z); parts.push(part(core, mix(col, PAL.grass, 0.45), 0));
    return build(parts, 0.4);
  },
  // a rose: a tight spiral of cupped petals round a bud
  cutRose(R, lite, v) {
    const parts = [], top = cutStem(R, parts, 0.4 + R() * 0.08), col = CUT.rose[v % 4], fl = [];
    const rings = [[3, 0.018, 1.25], [5, 0.024, 0.95], [7, 0.03, 0.6]];
    rings.forEach(([n, L, e], ri) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + ri * 0.7, dir = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); fl.push(part(orient(petal(L, L * 1.1, { cup: 0.9, droop: -0.2, n: 6 }), V(Math.cos(a) * 0.004 * ri, 0, Math.sin(a) * 0.004 * ri), dir, UP), mix(col, PAL.white, ri * 0.05), 4)); } });
    const sepal = new THREE.ConeGeometry(0.012, 0.02, 5); sepal.translate(0, -0.006, 0); fl.push(part(sepal, PAL.grass, 0));
    parts.push(...placeHead(fl, top, V((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4)));
    return build(parts, 0.4);
  },
  // a sunflower: two rings of pointed yellow petals round a domed brown disc, facing out
  cutSunflower(R, lite, v) {
    const parts = [], top = cutStem(R, parts, 0.5 + R() * 0.1, 0.06), col = CUT.sunflower[v % 2];
    parts.push(...placeHead(flowerHead(R, { n: lite ? 14 : 18, rings: 2, L: 0.045, W: 0.014, open: 0.05, petalCol: col, disc: C('#5a3a1c'), discR: 0.03, discH: 0.35, notch: 0 }).map((g) => asKind([g], 4)[0]), top, V(0.5, 1, 0.2)));
    return build(parts, 0.35);
  },
  // lavender: a spike of tiny florets in whorls
  cutLavender(R, lite, v) {
    const parts = [], H = 0.36 + R() * 0.08, top = cutStem(R, parts, H, 0.03), col = CUT.lavender[v % 2];
    for (let w = 0; w < (lite ? 7 : 11); w++) {
      const y = top.y - 0.12 + w * 0.012, rr = 0.011 * (1 - w / 14);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + w; parts.push(part(orient(petal(0.016, 0.012, { cup: 0.3, n: 4 }), V(top.x + Math.cos(a) * rr, y, top.z + Math.sin(a) * rr), V(Math.cos(a), 0.6, Math.sin(a)), UP), jit(R, col, 0.06), 4)); }
    }
    return build(parts, 0.5);
  },
  // a gerbera: a flat ring of narrow petals (two rows) round a small disc
  cutGerbera(R, lite, v) {
    const parts = [], top = cutStem(R, parts, 0.38 + R() * 0.1), col = CUT.gerbera[v % 4];
    parts.push(...placeHead(flowerHead(R, { n: lite ? 16 : 22, rings: 2, L: 0.04, W: 0.011, open: 0.08, petalCol: col, disc: C('#7a5a2a'), discR: 0.012, discH: 0.5, notch: 0.1 }).map((g) => asKind([g], 4)[0]), top, V((R() - 0.5) * 0.6, 1, (R() - 0.5) * 0.6)));
    return build(parts, 0.4);
  },
  // a cluster of small mixed-colour flowers on short stalks (no leaves: it crowns a pot's greenery)
  blooms(R, lite, v) {
    const parts = [], n = lite ? 5 : 7;
    for (let f = 0; f < n; f++) {
      const a = (f / n) * 6.28 + R() * 0.5, d = f ? 0.025 + R() * 0.045 : 0, h = 0.03 + R() * 0.04, p = V(Math.cos(a) * d, h, Math.sin(a) * d), col = CUT.pansy[(v + f) % 5];
      parts.push(part(stem([V(Math.cos(a) * d * 0.4, 0, Math.sin(a) * d * 0.4), p], 0.0022, 0.0018, 2, 3), PAL.stem, 0));
      const fl = [];
      for (let k = 0; k < 5; k++) { const c = (k / 5) * Math.PI * 2 + R() * 0.2; fl.push(part(orient(petal(0.02, 0.021, { cup: 0.15, droop: 0.05, n: 6 }), V(0, 0, 0), V(Math.cos(c), 0.18, Math.sin(c)), UP), jit(R, col, 0.05), 4)); }
      const eye = new THREE.CircleGeometry(0.0045, 5); eye.rotateX(-Math.PI / 2); eye.translate(0, 0.002, 0); fl.push(part(eye, PAL.yellow, 4));
      parts.push(...placeHead(fl, p, V(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45)));
    }
    return build(parts, 0.3);
  },
  // a potted flowering plant (pansy / primula-like): a rosette of round leaves, flowers on short stalks
  pansy(R, lite, v) {
    const parts = [], col = CUT.pansy[v % 5];
    for (let i = 0; i < (lite ? 9 : 14); i++) { const a = R() * 6.28, L = 0.035 + R() * 0.015; parts.push(part(orient(roundLeaf(L, L * 0.85), V(Math.cos(a) * 0.01, 0.01 + R() * 0.02, Math.sin(a) * 0.01), V(Math.cos(a), 0.3 + R() * 0.3, Math.sin(a)), UP), jit(R, mix(PAL.deep, PAL.grass, R()), 0.06), 0)); }
    for (let f = 0; f < (lite ? 5 : 8); f++) {
      const a = R() * 6.28, d = 0.015 + R() * 0.045, h = 0.05 + R() * 0.05, p = V(Math.cos(a) * d, h, Math.sin(a) * d);
      parts.push(part(stem([V(0, 0.01, 0), V(p.x * 0.5, h * 0.6, p.z * 0.5), p], 0.0025, 0.002, 3, 3), PAL.stem, 0));
      const fl = [];
      for (let k = 0; k < 5; k++) { const c = (k / 5) * Math.PI * 2 + R() * 0.2, big = k < 2 ? 1.15 : 1; fl.push(part(orient(petal(0.02 * big, 0.022 * big, { cup: 0.12, droop: 0.05, n: 6 }), V(0, 0, 0), V(Math.cos(c), 0.15, Math.sin(c)), UP), jit(R, col, 0.05), 4)); }
      const eye = new THREE.CircleGeometry(0.004, 5); eye.rotateX(-Math.PI / 2); eye.translate(0, 0.002, 0); fl.push(part(eye, PAL.yellow, 4));
      parts.push(...placeHead(fl, p, V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5)));
    }
    return build(parts, 0.3);
  },
});

export const PLANT_TYPES = { bushFlower: 4, bushLeaf: 3, daisy: 4, forget: 3, pinkWild: 3, clover: 4, tallGrass: 4, shortGrass: 4, ornGrass: 3, pampas: 3, patch: 4, cover: 3, cutHydrangea: 4, cutRose: 4, cutSunflower: 2, cutLavender: 2, cutGerbera: 4, pansy: 5, blooms: 5 };
const cache = new Map();
export const PLANT_STATS = { models: 0, ms: 0, tris: 0 };
/** one plant model (type, variant), its base at the origin; lite: the cheap version (fewer parts) */
export function plantGeo(type, variant = 0, lite = false) {
  const v = variant % PLANT_TYPES[type], key = `${type}${v}${lite ? 'L' : ''}`;
  if (cache.has(key)) return cache.get(key);
  const t0 = performance.now();
  const g = MODELS[type](rng(6200 + Object.keys(PLANT_TYPES).indexOf(type) * 71 + v * 13), lite, v);
  g.userData.type = type;
  cache.set(key, g);
  PLANT_STATS.models++; PLANT_STATS.ms += performance.now() - t0; PLANT_STATS.tris += g.userData.tris;
  return g;
}
export const plantModels = () => Object.entries(PLANT_TYPES).flatMap(([t, n]) => Array.from({ length: n }, (_, v) => [t, v]));

/* ---------------------------------------------------------------- material: wind + seasons + rain */
export const PLANT_U = { uWet: { value: 0 } };
let MAT = null, hooked = false;
export function plantMat() {
  if (MAT) return MAT;
  if (!hooked) { hooked = true; reg.updaters.push(() => { if (reg.groundU) PLANT_U.uWet.value = reg.groundU.uWet.value; }); }
  MAT = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP, vertexColors: true, side: THREE.DoubleSide });
  patchToon(MAT, 0, true); // the town's snow on what faces up
  const snow = MAT.onBeforeCompile;
  MAT.onBeforeCompile = (sh) => {
    snow(sh);
    Object.assign(sh.uniforms, { uTime: WATER_U.uTime, uWind: WATER_U.uWind, uSeason: SEASON_U.W, uWet: PLANT_U.uWet, uDayL: WATER_U.uDay });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSway; attribute float aKind;
        uniform float uTime, uWind; uniform vec4 uSeason;
        varying float vKind; varying float vDry; varying float vSw;
        float plH(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float h = plH(ip.xz), h2 = plH(ip.zx + 7.3);
          // the seasons: flowers bloom in spring, fewer in summer, a few in autumn, none in winter (they collapse
          // to the plant's base, so no triangle is left); seed heads stay all year
          float bloom = dot(uSeason, vec4(1.0, 0.8, 0.3, 0.0));
          if (aKind > 0.5 && aKind < 1.5 && h > bloom) transformed = vec3(0.0); // (kind 4: cultivated, always in flower)
          // some of the grass turns straw in autumn, more in winter
          vDry = step(h2, dot(uSeason, vec4(0.0, 0.05, 0.45, 0.75))) * step(1.5, aKind);
          vKind = aKind; vSw = aSway;
          // wind: the tips sway, each plant on its own phase; a slow gust over the town + a little flutter
          float ph = dot(ip.xz, vec2(0.37, 0.23)) + h * 6.28;
          float gust = sin(uTime * 0.45 + ip.x * 0.06 + ip.z * 0.04) * 0.5 + 0.5;
          float s = sin(uTime * 1.6 + ph) * (0.6 + 0.8 * gust) + sin(uTime * 3.7 + ph * 1.7) * 0.25;
          vec3 w = vec3(0.8, 0.0, 0.6) * s * aSway * (0.03 + 0.06 * uWind);
          #ifdef USE_INSTANCING
            mat3 im = mat3(instanceMatrix); w = transpose(im) * w / max(dot(im[0], im[0]), 1e-4);
          #endif
          transformed += w;
          transformed.y -= dot(w, w) * 2.0 * aSway; // swaying tips dip a touch, they don't stretch
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec4 uSeason; uniform float uWet, uDayL; varying float vKind; varying float vDry; varying float vSw;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // petals and plumes are thin: by day the light comes through them a little
        if (vKind > 0.5 && vKind < 1.5 || vKind > 2.5) totalEmissiveRadiance += diffuseColor.rgb * 0.22 * uDayL; // (petals, plumes, cultivated flowers)`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // leaves: fresh in spring, a little deeper in summer, warmer in autumn, duller in winter
          if (vKind < 0.5 || (vKind > 1.5 && vKind < 2.5)) {
            vec3 c = diffuseColor.rgb;
            c *= mix(vec3(1.0), vec3(1.05, 1.06, 0.95), uSeason.x) * mix(vec3(1.0), vec3(0.9, 0.93, 0.9), uSeason.y);
            c = mix(c, c * vec3(1.08, 1.0, 0.78), uSeason.z * 0.5);
            c = mix(c, vec3(dot(c, vec3(0.33))) * vec3(1.0, 0.98, 0.9), uSeason.w * 0.35);
            // straw grass (the tips most)
            c = mix(c, vec3(0.78, 0.68, 0.42) * (0.75 + 0.35 * vSw), vDry * (0.55 + 0.45 * vSw));
            diffuseColor.rgb = c;
          }
          // seed heads / plumes: cream, drying to beige in autumn / winter
          if (vKind > 2.5 && vKind < 3.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.78, 0.6), uSeason.z * 0.4 + uSeason.w * 0.6);
          // rain: a little darker, nothing shiny
          diffuseColor.rgb *= 1.0 - 0.2 * uWet;
        }`);
  };
  MAT.customProgramCacheKey = () => 'wildPlant';
  return MAT;
}

/* ---------------------------------------------------------------- placement */
const _M = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = V(0, 0, 0), _s = V(1, 1, 1), _c = new THREE.Color();
/**
 * a planting: collect instances (type, variant, x, y, z, scale, turn, lean) and flush them into one InstancedMesh per
 * model. o.cast: shrubs cast shadows; o.lite: use the cheap versions (dense / distant planting)
 */
export function plantBatch(parent, o = {}) {
  const items = [], placed = [];
  return {
    items, placed, parent,
    add(type, variant, x, y, z, s = 1, { ry = 0, lean = 0.06, lite = o.lite || false, R = Math.random, r = 0.12, tilt = null, tint = null } = {}) {
      items.push({ type, variant: (variant | 0) % PLANT_TYPES[type], lite, x, y, z, s, ry, lx: tilt ? tilt[0] : (R() - 0.5) * lean * 2, lz: tilt ? tilt[1] : (R() - 0.5) * lean * 2, tint }); // (any number picks a variant)
      placed.push([x, z, r * s]);
    },
    clear(x, z, r, k = 1) { return placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > (pr + r) * k); },
    world: !!o.world,
    flush(into) {
      const g = new THREE.Group(); g.name = o.name || 'Plants'; (into || parent).add(g);
      const by = new Map();
      items.forEach((it) => { const key = `${it.type}|${it.variant}|${it.lite}`; if (!by.has(key)) by.set(key, []); by.get(key).push(it); });
      const mat = plantMat();
      by.forEach((list) => {
        const geo = plantGeo(list[0].type, list[0].variant, list[0].lite);
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => { _e.set(it.lx, it.ry, it.lz); im.setMatrixAt(i, _M.compose(_p.set(it.x, it.y, it.z), _q.setFromEuler(_e), _s.setScalar(it.s))); if (list.some((q) => q.tint)) im.setColorAt(i, _c.set(it.tint || '#ffffff')); });
        im.castShadow = !!o.cast && /bush/.test(list[0].type); im.receiveShadow = true;
        im.userData.noLine = true; // thin blades / petals: no ink (it would only be noise; and resting flowers leave none)
        im.computeBoundingSphere(); g.add(im);
      });
      return g;
    },
  };
}
const pickW = (R, w) => { const e = Object.entries(w), t = e.reduce((a, [, v]) => a + v, 0); let r = R() * t; for (const [k, v] of e) if ((r -= v) <= 0) return k; return e[0][0]; };
/**
 * a planting zone: seeded clusters - a cluster picks one species (from the zone's weights) and sets a few to a dozen
 * of it round its centre at Poisson-like spacing, with now and then a different one mixed in; gaps stay open.
 * cfg: seed, clusters, per [a, b], spread (m), at(R) -> [x, z] | null, ok(x, z) -> bool, ground(x, z), species {type: w},
 *      scale [a, b], minGap (m), mixIn (chance of a stray of another species), lite
 */
export function plantField(B, cfg) {
  const R = rng(cfg.seed), [s0, s1] = cfg.scale || [0.85, 1.2];
  for (let c = 0, tries = 0; c < cfg.clusters && tries < cfg.clusters * 40; tries++) {
    const p = cfg.at(R); if (!p) continue;
    const [cx, cz] = p; if (!cfg.ok(cx, cz)) continue;
    c++;
    const sp = pickW(R, cfg.species), [n0, n1] = cfg.per || [3, 7], big = sp.startsWith('bush') || sp === 'pampas';
    const n = big ? 1 + (R() < 0.3 ? 1 : 0) : n0 + ((R() * (n1 - n0 + 1)) | 0), spread = cfg.spread ?? 0.45; // shrubs / pampas stand alone or in pairs
    for (let i = 0, t = 0; i < n && t < n * 8; t++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * spread, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      let type = R() < (cfg.mixIn ?? 0.2) ? pickW(R, cfg.species) : sp; const s = s0 + R() * (s1 - s0);
      if (type !== sp && (type.startsWith('bush') || type === 'pampas')) type = 'shortGrass'; // no stray shrubs inside a flower clump
      const gap = (cfg.minGap ?? 0.12) * (type.startsWith('bush') || type === 'pampas' ? 3 : 1);
      if (!cfg.ok(x, z) || !B.clear(x, z, gap * 0.5)) continue;
      B.add(type, (R() * PLANT_TYPES[type]) | 0, x, cfg.ground(x, z), z, s, { ry: R() * 6.28, R, r: gap * 0.5 / s, lite: cfg.lite });
      i++;
    }
  }
  return B;
}

/* ---------------------------------------------------------------- pots and planters */
// one town-wide batch for the many small pots / boxes built inside local groups (world positions; flushed once by
// town/index.js), so a pot costs no extra draw call
let SHARED = null;
export const sharedPlants = () => (SHARED ||= plantBatch(null, { name: 'TownPotPlants', world: true }));
export function flushSharedPlants(parent) { if (SHARED) { SHARED.flush(parent); SHARED = null; } }
const _w = V(0, 0, 0);
/** a point in obj's frame -> where the batch wants it (world for the shared batch, as given otherwise) */
const where = (B, obj, x, y, z) => { if (!B.world || !obj) return [x, y, z]; obj.updateWorldMatrix(true, false); obj.localToWorld(_w.set(x, y, z)); return [_w.x, _w.y, _w.z]; };
const _qw = new THREE.Quaternion(), _ew = new THREE.Euler();
/** add a plant at a point in obj's frame (its turn too, when the batch is in world space) */
export const plantAt = (B, obj, type, variant, x, y, z, s, opts = {}) => {
  const [wx, wy, wz] = where(B, obj, x, y, z);
  if (B.world && obj) { obj.getWorldQuaternion(_qw); _ew.setFromQuaternion(_qw, 'YXZ'); opts = { ...opts, ry: (opts.ry || 0) + _ew.y }; }
  B.add(type, variant, wx, wy, wz, s, opts);
};
/**
 * plant a round pot (soil at y, opening radius r): 'flower' a flowering plant (colour by variant) over a little
 * groundcover; 'green' a small leafy shrub; 'hydrangea' cut-style hydrangea heads; 'herb' daisies / forget-me-nots
 */
export function potPlants(B, x, y, z, r, { style = 'flower', variant = 0, seed = 1, obj = null } = {}) {
  const k = r / 0.1, add = (t, v, px, py, pz, sc, o) => plantAt(B, obj, t, v, px, py, pz, sc, o);
  if (style === 'flower' || style === 'green') {
    // a small version of a medium plant fills the pot first, then (flower pots) a cluster of mixed-colour flowers on its leaves
    const host = obj || B.parent;
    if (host) {
      // three fitted plants stacked into a full mound sitting at the rim (so the leaves arch over it, not through it): a wide hosta at the base, a fern /
      // aspidistra through it, a smaller hosta crowning it - then the blooms on top
      let top = 0;
      [[makeHosta, 3.3, 0.55, 0], [[makeFern, makeAspidistra][seed % 2], 2.7, 0.62, 1.3], [makeHosta, 2.2, 0.85, 2.6]].forEach(([mk, w, lift, rot], i) => {
        const gp = mk({ seed: 900 + seed * 3 + i, scale: 1 });
        gp.children.filter((c) => c.isMesh && !c.geometry.attributes.color).forEach((c) => gp.remove(c));
        fitGroup(gp, r * w); const hb = new THREE.Box3().setFromObject(gp).max.y; // (measured at the origin, before placing)
        gp.position.set(x, y + r * lift, z); gp.rotation.y = seed * 1.9 + rot; host.add(gp);
        top = Math.max(top, r * lift + hb);
      });
      if (style === 'flower') add('blooms', variant, x, y + top * 0.62, z, 1.35 * k, { ry: seed * 1.7 });
      return top;
    } else if (style === 'flower') add('pansy', variant, x, y, z, 1.7 * k, { ry: seed * 1.7 });
    else add('bushLeaf', seed, x, y - 0.01, z, 0.5 * k, { ry: seed * 1.3, lite: true });
    return;
  }
  if (style === 'hydrangea') { for (let i = 0; i < 3; i++) { const a = seed + i * 2.1; add('cutHydrangea', variant + (i === 2 ? 1 : 0), x + Math.cos(a) * r * 0.35, y - 0.15 * k, z + Math.sin(a) * r * 0.35, 0.75 * k, { ry: a, tilt: [Math.sin(a) * 0.25, -Math.cos(a) * 0.25] }); } return; }
  add(seed % 2 ? 'forget' : 'daisy', seed, x, y, z, 0.9 * k, { ry: seed });
}
const fitGroup = (g, w) => { const b = new THREE.Box3().setFromObject(g); const s = w / Math.max(0.01, b.max.x - b.min.x, b.max.z - b.min.z); g.scale.setScalar(s); return g; };
/**
 * a rectangular planter (soil top y, inner rect x0..x1 / z0..z1): first filled with medium greenery from the town's
 * own plants (hosta, fern, aspidistra - staggered, overlapping, no bare soil), then small flowers threaded through
 * between them at different heights. The greenery is added to `parent` (static meshes, merged by the town),
 * the flowers to the plant batch B.
 */
export function planterPlants(B, parent, x0, x1, z0, z1, y, { seed = 1, flowers = ['pansy', 'daisy', 'forget'], greens = ['hosta', 'fern', 'hosta', 'aspidistra'], density = 1 } = {}) {
  const R = rng(seed), alongX = x1 - x0 >= z1 - z0, len = alongX ? x1 - x0 : z1 - z0, dep = alongX ? z1 - z0 : x1 - x0;
  const pt = (u, w) => (alongX ? [x0 + u, z0 + w] : [x0 + w, z0 + u]);
  const mk = { hosta: makeHosta, fern: makeFern, aspidistra: makeAspidistra };
  const step = Math.max(0.24, Math.min(0.4, dep * 0.9)) / density, n = Math.max(1, Math.round(len / step));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * (len / n) + (R() - 0.5) * 0.05, w = dep * (0.5 + (i % 2 ? 0.16 : -0.16) * Math.min(1, dep / 0.4));
    const kind = greens[i % greens.length], gp = mk[kind]({ seed: seed * 7 + i, scale: 1 });
    gp.children.filter((c) => c.isMesh && !c.geometry.attributes.color).forEach((c) => gp.remove(c)); // no soil mound: the planter has its soil
    fitGroup(gp, Math.min(dep * 1.35, step * 1.5) * (kind === 'aspidistra' ? 0.8 : 1));
    const [x, z] = pt(u, w); gp.position.set(x, y - 0.01, z); gp.rotation.y = R() * 6.28; parent.add(gp);
  }
  // the flowers in between, peeking out of the leaves
  const nf = Math.max(1, Math.round(n * 1.2));
  for (let i = 0; i < nf; i++) {
    const u = ((i + 1) * len) / (nf + 1) + (R() - 0.5) * 0.06, w = dep * (0.25 + R() * 0.5), [x, z] = pt(u, w);
    const f = flowers[(i + seed) % flowers.length];
    plantAt(B, parent, f, seed + i, x, y, z, f === 'pansy' ? 1.1 + R() * 0.25 : 0.95 + R() * 0.3, { ry: R() * 6.28 });
  }
}
/** a round bed (soil top y, radius rad round cx, cz; a post in the middle up to r0): greenery in a ring, flowers between */
export function roundBedPlants(B, parent, cx, cz, rad, y, { seed = 1, r0 = 0.2, flowers = ['pansy', 'daisy', 'pinkWild', 'forget'], greens = ['hosta', 'fern', 'aspidistra', 'hosta'] } = {}) {
  const R = rng(seed), mk = { hosta: makeHosta, fern: makeFern, aspidistra: makeAspidistra };
  [[0.72, 9], [0.4, 5]].forEach(([f, n], ring) => {
    const rr = r0 + (rad - r0) * f;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + ring * 0.4, kind = greens[(i + ring) % greens.length], gp = mk[kind]({ seed: seed * 11 + i + ring * 20, scale: 1 });
      gp.children.filter((c) => c.isMesh && !c.geometry.attributes.color).forEach((c) => gp.remove(c));
      fitGroup(gp, (2 * Math.PI * rr / n) * 1.25); gp.position.set(cx + Math.cos(a) * rr, y - 0.01, cz + Math.sin(a) * rr); gp.rotation.y = R() * 6.28; parent.add(gp);
      const fa = a + Math.PI / n, fr = rr + (R() - 0.5) * 0.12;
      plantAt(B, parent, flowers[(i + ring) % flowers.length], seed + i + ring * 7, cx + Math.cos(fa) * fr, y, cz + Math.sin(fa) * fr, 1.1 + R() * 0.3, { ry: R() * 6.28 });
    }
  });
}
