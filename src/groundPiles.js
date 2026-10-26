import * as THREE from 'three';
import { SITE, IZA_AWAY } from './site.js';
import { reg, rng } from './core.js';
import { inOld, blockAt, groundY, lakeF, RAIL, MAP, PLAZA_TREES } from './town/layout.js';

/* ====================================================================================================
   Ground accumulation: snow drifts, autumn leaf piles, cherry-petal drifts.

   Why the old version looked fake: 24 fixed hemispheres shared by all three kinds (same spots, same dome
   shape, same orientation), plus 420 litter quads sprinkled uniformly over whole zones.

   Now every kind is generated on its own from "collectors" - places where wind really drops things:
   kerbs / gutters, wall feet, guard-rail feet, building corners, the lawn under the tree crowns.
   Each pile = a few overlapping lobes of stacked flakes (leaves / petals) or a soft noisy drift mesh (snow)
   leaning against its collector, + a thin tail of stray flakes blown away from it, + sparse loose flakes.
   Placement uses a seeded RNG: a new seed every page load and every time a kind (re)appears, so the
   street looks different each time but always follows the same rules. Road centre, door fronts,
   parking stalls and building footprints are kept clean.
   ==================================================================================================== */

const PAV = 0.15; // pavement / plot top
const ROAD = 0.0;

/* ---------------------------------------------------------------- where things collect */
// segment collectors: a/b = line ends (x,z), y = ground height, n = direction from the edge into open ground,
// w = how strongly each kind collects here (relative), off = how far from the line the pile body sits
const SEGMENTS = [
  { a: [-11.6, 6.56], b: [4.5, 6.56], y: ROAD, n: [0, 1], w: { leaf: 1.0, petal: 0.7, snow: 1.0 }, off: 0.0, maxW: 0.3, name: 'gutter S (stops before the crossing)' },
  { a: [7.56, -11.4], b: [7.56, 4.3], y: ROAD, n: [1, 0], w: { leaf: 0.9, petal: 0.6, snow: 1.0 }, off: 0.0, maxW: 0.3, name: 'gutter E (stops before the crossing)' },
  { a: [-6.2, -7.22], b: [7.3, -7.22], y: PAV, n: [0, 1], w: { leaf: 0.45, petal: 0.5, snow: 0.4 }, off: 0.02, name: 'back wall (mostly hidden behind the shop)' },
  ...(SITE.izakaya
    ? [{ a: [-8.4, -7.0], b: [-8.4, 3.9], y: PAV, n: [1, 0], w: { leaf: 0.6, petal: 0.5, snow: 0.8 }, off: 0.02, name: 'izakaya alley wall' }]
    : [{ a: [-7.8, -6.4], b: [-7.8, -1.6], y: PAV, n: [1, 0], w: { leaf: 0.6, petal: 0.5, snow: 0.8 }, off: 0.02, name: 'bakery alley wall' }]),
  { a: [-5.72, -4.4], b: [-5.72, 1.3], y: PAV, n: [-1, 0], w: { leaf: 0.5, petal: 0.5, snow: 0.7 }, off: 0.02, name: 'store west wall' },
  { a: [-5.4, -4.72], b: [4.4, -4.72], y: PAV, n: [0, -1], w: { leaf: 0.3, petal: 0.3, snow: 0.4 }, off: 0.02, name: 'store back wall' },
  { a: [4.72, -4.4], b: [4.72, -2.4], y: PAV, n: [1, 0], w: { leaf: 0.3, petal: 0.3, snow: 0.5 }, off: 0.02, name: 'store east wall (behind vending)' },
  { a: [1.1, 6.1], b: [4.8, 6.1], y: PAV, n: [0, -1], w: { leaf: 0.7, petal: 0.8, snow: 0.9 }, off: 0.04, name: 'guard rail S' },
  { a: [7.2, -0.3], b: [7.2, 3.8], y: PAV, n: [-1, 0], w: { leaf: 0.6, petal: 0.7, snow: 0.8 }, off: 0.04, name: 'guard rail E' },
  { a: [-5.4, 1.66], b: [0.9, 1.66], y: PAV, n: [0, 1], w: { leaf: 0.08, petal: 0.1, snow: 0.05 }, off: 0.02, name: 'shop front (under the awning: little gets here)' },
  ...(SITE.izakaya ? [
    { a: [-11.9, 4.42], b: [-11.1, 4.42], y: PAV, n: [0, 1], w: { leaf: 0.35, petal: 0.4, snow: 0.5 }, off: 0.02, name: 'izakaya front W' },
    { a: [-9.2, 4.42], b: [-8.55, 4.42], y: PAV, n: [0, 1], w: { leaf: 0.35, petal: 0.4, snow: 0.5 }, off: 0.02, name: 'izakaya front E' },
  ] : [
    // along the foot of the bakery's terrace step
    { a: [-12.5, 4.9], b: [-11.1, 4.9], y: PAV, n: [0, 1], w: { leaf: 0.35, petal: 0.4, snow: 0.5 }, off: 0.02, name: 'bakery terrace W' },
  ]),
];
// the town around the board: kerbs / gutters of the main roads, the foot of the terrace wall, rail fences, the lake lane
const T = (a, b, y, n, w, name, maxW = 9, off = 0.02) => SEGMENTS.push({ a, b, y, n, w, name, maxW, off });
const G = { leaf: 0.8, petal: 0.6, snow: 0.9 }, Wl = { leaf: 0.7, petal: 0.7, snow: 0.9 }, Rl = { leaf: 0.45, petal: 0.5, snow: 0.6 };
T([-46, 6.56], [-17.5, 6.56], ROAD, [0, 1], G, 'Kaigan-dori gutter W (north kerb)', 0.3, 0); T([13, 6.56], [28, 6.56], ROAD, [0, 1], G, 'Kaigan-dori gutter E (north kerb)', 0.3, 0);
T([-46, 11.84], [-18.5, 11.84], ROAD, [0, -1], G, 'Kaigan-dori gutter W (south kerb)', 0.3, 0); T([14.5, 11.84], [34, 11.84], ROAD, [0, -1], G, 'Kaigan-dori gutter E (south kerb)', 0.3, 0);
T([7.66, -42], [7.66, -23.5], ROAD, [1, 0], Wl, 'foot of the terrace wall on Hoshizora-dori', 0.3, 0); T([11.84, -42], [11.84, -23.5], ROAD, [-1, 0], G, 'Hoshizora-dori gutter N', 0.3, 0);
T([7.66, 15], [7.66, 31], ROAD, [1, 0], G, 'Hoshizora-dori gutter S (west)', 0.3, 0); T([11.84, 15], [11.84, 31], ROAD, [-1, 0], G, 'Hoshizora-dori gutter S (east)', 0.3, 0);
T([-13.4, -28.5], [-13.4, -23.5], ROAD, [-1, 0], Wl, 'foot of the terrace wall on the lake lane', 0.3, 0);
T([-46, -16.05], [-18, -16.05], PAV, [0, 1], Rl, 'rail fence / Kita-dori verge W'); T([-12, -16.05], [5, -16.05], PAV, [0, 1], Rl, 'rail fence / Kita-dori verge'); T([14, -16.05], [30, -16.05], PAV, [0, 1], Rl, 'Kita-dori verge E');
T([-46, -11.6], [-34, -11.6], 0.98, [0, 1], Wl, 'top of the west slope (Kita-dori)'); T([-28, -11.6], [-18, -11.6], 0.85, [0, 1], Wl, 'top of the west slope (Kita-dori) 2');
T([-18.9, -40], [-18.6, -27], 0.1, [-1, 0], { leaf: 0.6, petal: 0.8, snow: 0.6 }, 'lake lane guardrail foot');
// the newer parts of town (y null: the pile sits on the real ground height there)
const Tn = { leaf: 0.7, petal: 0.75, snow: 0.85 }, Tw = { leaf: 0.55, petal: 0.6, snow: 0.8 };
T([-46, -12.16], [-17, -12.16], ROAD, [0, -1], G, 'Kita-dori gutter W (north side of the west blocks)', 0.3, 0); T([13, -12.16], [30, -12.16], ROAD, [0, -1], G, 'Kita-dori gutter E', 0.3, 0);
T([-46.8, 5.12], [-43.6, 5.12], null, [0, 1], Tw, '西の住宅地: house 3 breeze-block wall'); T([-46.5, -10.22], [-34.0, -10.22], null, [0, 1], Tw, '西の住宅地: the block wall on Kita-dori (garden side)');
T([-46.8, -1.95], [-41.1, -1.95], null, [0, 1], Tw, '西の住宅地: retaining wall foot W'); T([-39.7, -1.95], [-34.6, -1.95], null, [0, 1], Tw, '西の住宅地: retaining wall foot E');
T([13.28, -26.9], [13.28, -24.3], null, [-1, 0], Tn, '星空町駅: west wall foot'); T([16.2, -28.0], [21.0, -28.0], null, [0, -1], Tn, '星空町駅: along the front (ramp foot)');
T([12.08, -43.5], [12.08, -29.0], null, [1, 0], Tn, '星空町駅: forecourt edge on Hoshizora-dori'); T([21.5, -29.1], [25.2, -29.1], null, [0, -1], Tw, '星空町駅: bicycle park');
T([-41.5, 19.55], [-19.8, 19.55], null, [0, 1], Tn, 'street-house row: the front pavement'); T([-13.3, 23.2], [-13.3, 31.6], null, [1, 0], Tn, 'sakura plaza: west edge');
T([7.3, 23.2], [7.3, 31.6], null, [-1, 0], Tn, 'sakura plaza: east edge'); T([-12.0, 31.75], [7.0, 31.75], null, [0, -1], Tw, 'sakura plaza: south edge');
T([14.0, 13.85], [29.4, 13.85], null, [0, -1], Tw, 'villa: north wall (outside)'); T([12.3, 14.4], [12.3, 31.0], null, [1, 0], Tw, 'villa: west wall (outside)');
// point collectors (inside corners): pile hugs both walls
const CORNERS = [
  { p: [-6.15, -7.15], n: [0.7, 0.7], w: { leaf: 0.4, petal: 0.4, snow: 0.5 } },
  { p: [7.25, -7.15], n: [-0.7, 0.7], w: { leaf: 0.6, petal: 0.6, snow: 0.8 } },
  ...(SITE.izakaya ? [{ p: [-8.35, -7.15], n: [0.7, 0.7], w: { leaf: 0.3, petal: 0.3, snow: 0.4 } }] : []),
  { p: [-5.68, 1.62], n: [-0.7, 0.7], w: { leaf: 0.5, petal: 0.6, snow: 0.7 } },
  { p: [4.85, 6.05], n: [-0.7, -0.7], w: { leaf: 0.5, petal: 0.6, snow: 0.7 } },
  ...(SITE.izakaya ? [{ p: [-8.45, 4.4], n: [0.7, 0.7], w: { leaf: 0.4, petal: 0.4, snow: 0.6 } }] : [{ p: [-7.75, -6.5], n: [0.7, 0.7], w: { leaf: 0.3, petal: 0.3, snow: 0.4 } }]),
];

/** places that must stay clean (walk lines, doors, road centre, stalls, inside buildings) */
function blockedOld(x, z) {
  if (x > 1.0 && x < 3.4 && z > 1.45 && z < 3.4) return true; // shop door + approach
  if (SITE.izakaya && x > -11.0 && x < -9.3 && z > 4.3 && z < 5.9) return true; // izakaya door
  if (SITE.bakery && x > -9.8 && x < -8.1 && z > 4.4 && z < 5.9) return true; // bakery: the walk up to the terrace step
  if (x > -5.5 && x < 0.4 && z > 2.95 && z < 5.55) return true; // parking stalls
  if (x > -5.62 && x < 4.62 && z > -4.62 && z < 1.52) return true; // store footprint
  if (SITE.izakaya && x > -12.3 && x < -8.48 && z > -7.4 && z < 4.32) return true; // izakaya footprint
  if (SITE.bakery && x > -12.55 && x < -7.6 && z > -6.9 && z < 4.85) return true; // bakery footprint + terrace deck + step
  if (SITE.bakery && x > -7.95 && x < -6.95 && z > -1.5 && z < 0.75) return true; // bakery trolley / delivery box / bin
  if (z > 6.9 && x < 7.5) return true; // road
  if (x > 7.95) return true; // road
  if (x > 5.0 && x < 7.0 && z > 5.3) return true; // south crossing + landing
  if (x > 6.3 && z > 4.3 && z < 6.4) return true; // east crossing + landing
  if (x > 5.0 && x < 6.9 && z > -6.8 && z < 5.2 && Math.abs(x - 6.0) < 0.6) return true; // middle of the east pavement walk line
  return false;
}
/** the town: piles on blocks (not in the lake, not on the track) or tight against a kerb in the gutter */
function blockedTown(x, z) {
  if (x > -23.3 && x < -17.5 && z > -1.2 && z < 3.6) return true; // the corner store + its machines
  if (x > -11.7 && x < -4.3 && z > 13.9 && z < 21.0) return true; // the café (town/cafe.js) + its hood
  if (x > -41.8 && x < -19.4 && z > 13.5 && z < 19.5) return true; // the street-house row (town/streetRow.js)
  if (x > -2.2 && x < 4.6 && z > 14.4 && z < 20.9) return true; // the bookstore (town/bookstore.js) + its deck
  if (x > 13.9 && x < 29.5 && z > 13.7 && z < 31.3 && !(z > 24.2 && x > 18.8 && x < 27.2)) return true; // the villa's lot: piles on the lawn only
  if (IZA_AWAY) { const [x0, x1, z0, z1] = IZA_AWAY.rect; if (x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3) return true; } // the izakaya in the west block
  // 西の住宅地 (town/westHomes.js): the four houses + their eaves
  if ([[-46.9, -41.1, -10.05, -4.7], [-39.75, -34.65, -9.95, -4.7], [-46.75, -41.65, -1.25, 3.95], [-39.45, -35.25, -0.95, 3.75]].some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) return true;
  // 星空町駅 (town/station.js): the building, its steps + ramp, the bicycle park, the flower bed
  if (x > 13.2 && x < 21.3 && z > -28.1 && z < -23.0) return true;
  if (x > 21.55 && x < 25.15 && z > -29.0 && z < -25.6) return true;
  if (Math.hypot(x - 17.2, z + 30.6) < 1.35) return true;
  if (x < MAP.x0 + 0.6 || x > MAP.x1 - 0.6 || z < MAP.z0 + 0.6 || z > MAP.z1 - 0.6) return true;
  if (Math.abs(z - RAIL.z) < 2.2 && x < 23) return true;
  const b = blockAt(x, z);
  if (b) return b.id === 'lakePark' && lakeF(x, z) < 1.1;
  // road: only the gutter strip along a kerb
  const near = [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].some(([dx, dz]) => blockAt(x + dx, z + dz));
  return !near;
}
function blockedAny(x, z) {
  if (inOld(x, z)) return blockedOld(x, z) || x < -11.95 || z < -11.8 || z > 6.9 && x < 7.5 || x > 7.95;
  return blockedTown(x, z);
}

/* ---------------------------------------------------------------- per-kind look */
export const KIND = {
  leaf: {
    clusters: [50, 64], size: 0.62, lobes: [2, 4], aspect: [1.4, 2.6], height: 0.075,
    core: 90, tail: 34, loose: 1300, flake: [0.1, 0.17], tilt: 0.75, pad: ['#6a3c1c', '#8a4a1e'], padA: 0.62,
    palette: ['#7a4a22', '#94561f', '#b56a24', '#c98a2b', '#d27a2a', '#9b3a20', '#7c2a1a', '#a8892f', '#5e3c1f'],
    tree: 0.7,
  },
  petal: {
    clusters: [50, 64], size: 0.66, lobes: [2, 3], aspect: [1.6, 3.0], height: 0.032,
    core: 150, tail: 55, loose: 1700, flake: [0.065, 0.1], tilt: 0.45, pad: ['#f0a2ba', '#f5b5c8'], padA: 0.62,
    palette: ['#ffe4ec', '#ffd0de', '#fbbacd', '#f6a6bf', '#f095b3', '#ffdae5'], // a step pinker: they read on the pale paving
    tree: 0.8,
  },
  snow: { clusters: [45, 58], size: 0.55, aspect: [1.5, 3.2], height: 0.2, tree: 0.3 },
};

/* ---------------------------------------------------------------- flake material (leaves + petals) */
export function flakeMaterial(shape, u) {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uShape: { value: shape } },
    vertexShader: /* glsl */ `
      attribute vec3 aCol; attribute float aTh; attribute vec3 aC;
      uniform float uAmt; varying vec2 vUv; varying vec3 vCol; varying float vL; uniform vec3 uL;
      void main(){
        // flakes of a pile appear in order (core first, then tail), growing from the pile centre
        float vis = smoothstep(aTh, aTh + 0.08, uAmt);
        vec4 w = instanceMatrix * vec4(position * vis, 1.0);
        w.xyz = aC + (w.xyz - aC) * mix(0.6, 1.0, vis);
        vec3 n = normalize(mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));
        vL = 0.5 + 0.5 * max(dot(n, normalize(uL)), 0.0) + 0.12 * n.y;
        vUv = uv; vCol = aCol;
        gl_Position = projectionMatrix * viewMatrix * w;
        if (vis < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uShape; uniform float uBright; varying vec2 vUv; varying vec3 vCol; varying float vL;
      void main(){
        vec2 p = vUv - 0.5;
        float a; vec3 c = vCol;
        if (uShape < 0.5) {
          // leaf: pointed oval + darker midrib + tiny stem
          float w = 0.3 * (1.0 - pow(abs(p.y) * 2.0, 1.7));
          a = step(abs(p.x), w) * step(abs(p.y), 0.46);
          a = max(a, step(abs(p.x), 0.018) * step(0.4, p.y) * step(p.y, 0.5));
          c *= 1.0 - 0.28 * smoothstep(0.03, 0.0, abs(p.x)) - 0.12 * smoothstep(0.0, 0.3, abs(p.x));
        } else {
          // petal: soft oval with the notch at the tip
          vec2 q = vec2(p.x / 0.32, (p.y + 0.04) / 0.46);
          a = step(length(q), 1.0) * (1.0 - step(length(p - vec2(0.0, 0.47)), 0.11));
          c = mix(c, c * vec3(1.0, 0.86, 0.9), smoothstep(0.1, 0.45, -p.y));
        }
        if (a < 0.5) discard;
        gl_FragColor = vec4(c * vL * uBright, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}

/** soft colour pad under a pile (gives it mass from far away); u: { uAmt, uBright, uL } */
export function padMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute float aTh; attribute vec3 aC; attribute vec4 aCA; uniform float uAmt; varying vec4 vCA;
      void main(){
        float vis = smoothstep(aTh, aTh + 0.1, uAmt);
        vec3 p = aC + (position - aC) * mix(0.5, 1.0, vis);
        vCA = vec4(aCA.rgb, aCA.a * vis);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform float uBright; uniform vec3 uL; varying vec4 vCA;
      void main(){ if (vCA.a < 0.01) discard; gl_FragColor = vec4(vCA.rgb * uBright * (0.62 + 0.38 * max(normalize(uL).y, 0.0)), vCA.a); }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

export function createGroundPiles(parent) {
  const U = { uL: { value: new THREE.Vector3(0.3, 0.9, 0.3) }, uBright: { value: 1 } };
  const kinds = {};
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  const flakeKind = (name, shape, cap) => {
    const u = { ...U, uAmt: { value: 0 } };
    const geo = plane.clone();
    const col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const th = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    const cc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    geo.setAttribute('aCol', col); geo.setAttribute('aTh', th); geo.setAttribute('aC', cc);
    const im = new THREE.InstancedMesh(geo, flakeMaterial(shape, u), cap);
    // soft colour pad under every pile: gives the pile its mass from far away (flakes alone are 2-3 px there)
    const pad = new THREE.Mesh(new THREE.BufferGeometry(), padMaterial(u));
    pad.userData.noLine = true; pad.frustumCulled = false; pad.renderOrder = 1;
    reg.noRefl.push(pad); parent.add(pad);
    im.count = 0;
    im.userData.noLine = true; im.frustumCulled = false; im.visible = false;
    reg.noRefl.push(im); parent.add(im);
    kinds[name] = { name, im, pad, u, cap, col, th, cc, amt: 0, hidden: 99, seeded: false };
  };
  flakeKind('leaf', 0, 13000);
  flakeKind('petal', 1, 16000);

  // snow: one merged, regenerated mesh of soft drifts
  {
    const u = { ...U, uAmt: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute float aTh; attribute vec3 aC; attribute float aRho; uniform float uAmt; varying vec3 vN; varying vec3 vP; varying float vRho;
        void main(){
          float vis = smoothstep(aTh, aTh + 0.12, uAmt);
          vRho = aRho;
          vec3 p = aC + (position - aC) * vec3(mix(0.7, 1.0, vis), vis, mix(0.7, 1.0, vis));
          vN = normal; vP = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          if (vis < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uL; uniform float uBright; varying vec3 vN; varying vec3 vP; varying float vRho;
        float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec3 n = normalize(vN);
          float d = max(dot(n, normalize(uL)), 0.0);
          // toon-ish: lit top, cool blue shade on the far side, soft sky fill
          vec3 col = mix(vec3(0.66, 0.74, 0.9), vec3(0.97, 0.98, 1.0), smoothstep(0.05, 0.55, d * 0.8 + n.y * 0.35));
          // powdery rim: the drift thins out into the ground instead of ending on a hard polygon edge
          float a = 1.0 - smoothstep(0.68, 1.0, vRho + (vn(vP.xz * 7.0) - 0.5) * 0.3 + (vn(vP.xz * 19.0) - 0.5) * 0.12);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col * uBright, a);
        }`,
      transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    mesh.userData.noLine = true; mesh.frustumCulled = false; mesh.visible = false; mesh.receiveShadow = false;
    reg.noRefl.push(mesh); parent.add(mesh);
    kinds.snow = { name: 'snow', mesh, u, amt: 0, hidden: 99, seeded: false };
  }

  /* ---------------------------------------------------------------- collector sampling */
  const treeSpots = () => (reg.trees || []).map((t) => ({ x: t.center.x, z: t.center.z, rx: Math.max(0.8, t.half.x * 0.8), rz: Math.max(0.6, t.half.z * 0.7) }))
    .concat(((reg.townGreenery && reg.townGreenery.trees) || []).map((t) => ({ x: t.x, z: t.z, rx: 1.8 * t.s, rz: 1.8 * t.s, town: true, cherry: t.sp === 'cherry' })))
    .concat(PLAZA_TREES.map(([x, z, , , pit]) => ({ x, z, rx: 2.1, rz: 2.1, rin: pit + 0.2, town: true, cherry: true }))); // the sakura plaza's own cherries (town/plaza.js), round their raised pits

  /** pick one collector for a pile; returns { x, z, y, t:[tx,tz], n:[nx,nz], hug } */
  function pickSite(kind, R) {
    const trees = treeSpots();
    const opts = [];
    SEGMENTS.forEach((s) => { const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); opts.push({ w: s.w[kind] * Math.sqrt(len), s }); });
    CORNERS.forEach((c) => opts.push({ w: c.w[kind] * 1.1, c }));
    // petals fall from the cherries (a little from anywhere on the wind), leaves from every tree
    trees.forEach((t) => opts.push({ w: KIND[kind].tree * 1.2 * (kind === 'petal' ? (t.cherry ? 2.6 : 0.12) : 1), t }));
    const tot = opts.reduce((a, o) => a + o.w, 0);
    let r = R() * tot, o = opts[0];
    for (const it of opts) { r -= it.w; if (r <= 0) { o = it; break; } }
    if (o.s) {
      const s = o.s, f = 0.05 + R() * 0.9;
      const tx = s.b[0] - s.a[0], tz = s.b[1] - s.a[1], tl = Math.hypot(tx, tz);
      const x = s.a[0] + tx * f, z = s.a[1] + tz * f;
      return { x, z, y: s.y ?? groundY(x + s.n[0] * 0.3, z + s.n[1] * 0.3), t: [tx / tl, tz / tl], n: s.n, hug: 1, off: s.off, maxW: s.maxW || 9 };
    }
    if (o.c) { const n = o.c.n; return { x: o.c.p[0], z: o.c.p[1], y: PAV, t: [-n[1], n[0]], n, hug: 1, off: 0.05, corner: true, maxW: 9 }; }
    // under a tree crown (behind the wall on the lawn): no edge to lean on, spread is rounder
    const a = R() * Math.PI * 2, k0 = (o.t.rin || 0) / o.t.rx, rr = k0 + (1 - k0) * Math.sqrt(R()); // (outside a raised pit)
    const x = o.t.x + Math.cos(a) * o.t.rx * rr, z = o.t.z + Math.sin(a) * o.t.rz * rr;
    const ang = R() * Math.PI;
    return { x, z, y: o.t.town ? groundY(x, z) : PAV, t: [Math.cos(ang), Math.sin(ang)], n: [-Math.sin(ang), Math.cos(ang)], hug: 0, off: 0, maxW: 9 };
  }

  /* ---------------------------------------------------------------- leaves / petals */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

  function genFlakes(K, seed) {
    const cfg = KIND[K.name];
    const R = rng(seed);
    let i = 0;
    const put = (x, y, z, size, tilt, colIdx, dark, th, cx, cy, cz) => {
      if (i >= K.cap) return;
      _e.set((R() - 0.5) * tilt, R() * Math.PI * 2, (R() - 0.5) * tilt, 'YXZ'); _q.setFromEuler(_e);
      _p.set(x, y, z); _s.set(size * (0.8 + R() * 0.4), 1, size);
      _m.compose(_p, _q, _s); K.im.setMatrixAt(i, _m);
      _c.set(cfg.palette[colIdx % cfg.palette.length]).multiplyScalar(dark * (0.9 + R() * 0.2));
      K.col.setXYZ(i, _c.r, _c.g, _c.b); K.th.setX(i, th); K.cc.setXYZ(i, cx, cy, cz);
      i++;
    };
    const pp = [], pth = [], pc = [], pca = [], pidx = [];
    const PR = 4, PS = 22;
    const padBlob = (cx, cy, cz, t, n, a, b, alpha, thv) => {
      const base = pp.length / 3;
      const ph = [R() * 6.28, R() * 6.28, R() * 6.28];
      _c.set(cfg.pad[(R() * cfg.pad.length) | 0]);
      const push = (x, z, al) => { pp.push(x, cy + 0.003, z); pth.push(thv); pc.push(cx, cy, cz); pca.push(_c.r, _c.g, _c.b, al); };
      push(cx, cz, alpha);
      for (let r = 1; r <= PR; r++) {
        const rho = r / PR;
        for (let k = 0; k < PS; k++) {
          const ang = (k / PS) * Math.PI * 2;
          const kk = 1 + 0.22 * Math.sin(3 * ang + ph[0]) + 0.12 * Math.sin(5 * ang + ph[1]) + 0.08 * Math.sin(8 * ang + ph[2]);
          const u = Math.cos(ang) * a * kk * rho, v = Math.sin(ang) * b * kk * rho;
          push(cx + t[0] * u + n[0] * v, cz + t[1] * u + n[1] * v, alpha * Math.pow(1 - rho * rho, 0.7) * (0.75 + 0.25 * Math.sin(ang * 4 + ph[2])));
        }
      }
      const flip = t[0] * n[1] - t[1] * n[0] < 0;
      const tri = (A, B2, C) => (flip ? pidx.push(A, C, B2) : pidx.push(A, B2, C));
      for (let k = 0; k < PS; k++) tri(base, base + 1 + ((k + 1) % PS), base + 1 + k);
      for (let r = 1; r < PR; r++) {
        const o0 = base + 1 + (r - 1) * PS, o1 = base + 1 + r * PS;
        for (let k = 0; k < PS; k++) { const A = o0 + k, B2 = o0 + ((k + 1) % PS), C = o1 + k, D = o1 + ((k + 1) % PS); tri(A, B2, C); tri(B2, D, C); }
      }
    };
    const nC = cfg.clusters[0] + Math.floor(R() * (cfg.clusters[1] - cfg.clusters[0] + 1));
    const centres = [];
    let made = 0, guard = 0;
    while (made < nC && guard++ < 900) {
      const s = pickSite(K.name, R);
      const big = Math.pow(R(), 1.6); // mostly small piles, now and then a big one
      const size = cfg.size * (0.45 + big * 1.25);
      const asp = cfg.aspect[0] + R() * (cfg.aspect[1] - cfg.aspect[0]);
      const L = size * asp * (s.corner ? 0.6 : 1), W = Math.min(size * (s.corner ? 0.9 : 0.7), s.maxW);
      // pile leans on the edge: centre sits half a width out from the line
      const cx = s.x + s.n[0] * (s.off + W * 0.55 * s.hug), cz = s.z + s.n[1] * (s.off + W * 0.55 * s.hug);
      if (blockedAny(cx, cz) || centres.some((c) => Math.hypot(c[0] - cx, c[1] - cz) < 1.7 + c[2])) continue;
      centres.push([cx, cz, size]);
      const order = made / nC; // earlier piles appear at lower amounts
      const th0 = order * 0.75;
      const H = cfg.height * (0.5 + big * 1.1) * (0.7 + R() * 0.6);
      // 2..4 overlapping lobes along the edge -> irregular outline instead of one ellipse
      const nl = cfg.lobes[0] + Math.floor(R() * (cfg.lobes[1] - cfg.lobes[0] + 1));
      const lobes = Array.from({ length: nl }, () => ({ u: (R() - 0.5) * L * 0.9, v: (R() - 0.5) * W * 0.5, a: L / nl * (0.7 + R() * 0.6), b: W * (0.55 + R() * 0.5), h: H * (0.55 + R() * 0.6) }));
      lobes.forEach((lb) => {
        const lx = cx + s.t[0] * lb.u + s.n[0] * lb.v, lz = cz + s.t[1] * lb.u + s.n[1] * lb.v;
        if (!blockedAny(lx, lz)) padBlob(lx, s.y, lz, s.t, s.n, lb.a * 1.25, lb.b * 1.2, cfg.padA * (0.7 + R() * 0.3), th0);
      });
      const nCore = Math.round(cfg.core * (0.45 + big * 1.4));
      for (let k = 0; k < nCore; k++) {
        const lb = lobes[(R() * nl) | 0];
        const ang = R() * Math.PI * 2, rr = Math.sqrt(R());
        const u = lb.u + Math.cos(ang) * lb.a * rr, v = lb.v + Math.sin(ang) * lb.b * rr;
        const x = cx + s.t[0] * u + s.n[0] * v, z = cz + s.t[1] * u + s.n[1] * v;
        if (blockedAny(x, z)) continue;
        const hk = (1 - rr * rr);
        const y = s.y + 0.004 + lb.h * hk * (0.25 + 0.75 * R());
        const fs = cfg.flake[0] + R() * (cfg.flake[1] - cfg.flake[0]);
        put(x, y, z, fs, cfg.tilt * (0.4 + hk), (R() * 99) | 0, 0.78 + 0.22 * hk + (y - s.y) * 1.5, th0 + R() * 0.12, cx, s.y, cz);
      }
      // tail: strays blown away from the edge (and a little along it), thinning out with distance
      const nTail = Math.round(cfg.tail * (0.5 + big));
      for (let k = 0; k < nTail; k++) {
        const ang = Math.atan2(s.n[1], s.n[0]) + (R() - 0.5) * (s.hug ? 2.6 : 6.28);
        const d = (s.hug ? W * 0.6 : Math.max(L, W) * 0.7) + Math.pow(R(), 1.8) * size * 2.6;
        const along = (R() - 0.5) * L * 0.8;
        const x = cx + Math.cos(ang) * d + s.t[0] * along, z = cz + Math.sin(ang) * d + s.t[1] * along;
        if (blockedAny(x, z)) continue;
        const fs = cfg.flake[0] + R() * (cfg.flake[1] - cfg.flake[0]);
        put(x, s.y + 0.003, z, fs, 0.25, (R() * 99) | 0, 0.85, th0 + 0.1 + R() * 0.25, cx, s.y, cz);
      }
      made++;
    }
    // loose flakes: sparse, mostly near collectors / under trees, a few anywhere on the pavement
    for (let k = 0; k < cfg.loose; k++) {
      let x, z, y = PAV;
      const r = R();
      if (r < 0.55) { const s = pickSite(K.name, R); const d = Math.pow(R(), 1.5) * 2.2; x = s.x + s.n[0] * d + s.t[0] * (R() - 0.5) * 1.2; z = s.z + s.n[1] * d + s.t[1] * (R() - 0.5) * 1.2; y = s.y; }
      else if (r < 0.75) { x = -11.8 + R() * 19.2; z = -7.2 + R() * 13.6; }
      else { x = MAP.x0 + R() * (MAP.x1 - MAP.x0); z = MAP.z0 + R() * (MAP.z1 - MAP.z0); }
      if (blockedAny(x, z)) continue;
      y = groundY(x, z);
      const fs = cfg.flake[0] + R() * (cfg.flake[1] - cfg.flake[0]);
      put(x, y + 0.003, z, fs, 0.2, (R() * 99) | 0, 0.88, 0.15 + R() * 0.85, x, y, z);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    pg.setAttribute('aTh', new THREE.Float32BufferAttribute(pth, 1));
    pg.setAttribute('aC', new THREE.Float32BufferAttribute(pc, 3));
    pg.setAttribute('aCA', new THREE.Float32BufferAttribute(pca, 4));
    pg.setIndex(pidx);
    K.pad.geometry.dispose();
    K.pad.geometry = pg;
    K.im.count = i;
    K.im.instanceMatrix.needsUpdate = true;
    K.col.needsUpdate = true; K.th.needsUpdate = true; K.cc.needsUpdate = true;
    K.seeded = true;
  }

  /* ---------------------------------------------------------------- snow drifts */
  function genSnow(K, seed) {
    const cfg = KIND.snow;
    const R = rng(seed);
    const pos = [], th = [], cen = [], idx = [], rh = [];
    const RINGS = 9, SEG = 40;
    const drift = (cx, cy, cz, t, n, L, W, H, lean, thv) => {
      const base = pos.length / 3;
      const ph = [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28];
      const amp = [0.16 + R() * 0.12, 0.08 + R() * 0.08, 0.05 + R() * 0.05, 0.03 + R() * 0.03];
      const bump = [R() * 6.28, R() * 6.28];
      pos.push(cx, cy + H * (1 + lean * 0.3), cz); th.push(thv); cen.push(cx, cy, cz); rh.push(0);
      for (let r = 1; r <= RINGS; r++) {
        const rho = r / RINGS;
        for (let sI = 0; sI < SEG; sI++) {
          const a = (sI / SEG) * Math.PI * 2;
          const k = 1 + amp[0] * Math.sin(3 * a + ph[0]) + amp[1] * Math.sin(5 * a + ph[1]) + amp[2] * Math.sin(9 * a + ph[2]) + amp[3] * Math.sin(15 * a + ph[3]) * rho;
          const u = Math.cos(a) * L * k * rho, v = Math.sin(a) * W * k * rho;
          // thicker against the edge (v < 0 = towards the wall), soft shoulder, rim sinks into the ground
          const prof = Math.pow(Math.max(0, 1 - rho * rho), 1.25);
          const side = 1 + lean * (-v / W) * 0.45;
          const lumps = 1 + 0.18 * Math.sin(u * 7 + bump[0]) * Math.sin(v * 9 + bump[1]);
          const y = cy + 0.004 + H * prof * side * lumps - (r === RINGS ? 0.008 : 0);
          pos.push(cx + t[0] * u + n[0] * v, y, cz + t[1] * u + n[1] * v); th.push(thv); cen.push(cx, cy, cz); rh.push(rho);
        }
      }
      // (t, n) can be a mirrored frame depending on the collector: keep every triangle facing up
      const flip = t[0] * n[1] - t[1] * n[0] < 0;
      const tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
      for (let sI = 0; sI < SEG; sI++) tri(base, base + 1 + ((sI + 1) % SEG), base + 1 + sI);
      for (let r = 1; r < RINGS; r++) {
        const o0 = base + 1 + (r - 1) * SEG, o1 = base + 1 + r * SEG;
        for (let sI = 0; sI < SEG; sI++) {
          const a = o0 + sI, b = o0 + ((sI + 1) % SEG), c = o1 + sI, d = o1 + ((sI + 1) % SEG);
          tri(a, b, c); tri(b, d, c);
        }
      }
    };
    const nC = cfg.clusters[0] + Math.floor(R() * (cfg.clusters[1] - cfg.clusters[0] + 1));
    const centres = [];
    let made = 0, guard = 0;
    while (made < nC && guard++ < 900) {
      const s = pickSite('snow', R);
      const thin = R() < 0.3; // thin skin of snow vs. a real little drift
      const big = Math.pow(R(), 1.5);
      const size = cfg.size * (0.5 + big * 1.2) * (thin ? 1.5 : 1);
      const asp = cfg.aspect[0] + R() * (cfg.aspect[1] - cfg.aspect[0]);
      const L = size * asp * (s.corner ? 0.55 : 1), W = Math.min(size * (s.corner ? 0.95 : 0.65), s.maxW);
      const cx = s.x + s.n[0] * (s.off + W * 0.3 * s.hug), cz = s.z + s.n[1] * (s.off + W * 0.3 * s.hug);
      if (blockedAny(cx, cz) || centres.some((c) => Math.hypot(c[0] - cx, c[1] - cz) < 1.6 + c[2])) continue;
      centres.push([cx, cz, size]);
      const H = thin ? 0.035 + R() * 0.02 : cfg.height * (0.45 + big * 1.0) * (0.75 + R() * 0.5);
      const thv = (made / nC) * 0.7;
      const lean = s.hug ? 0.6 + R() * 0.6 : 0;
      drift(cx, s.y, cz, s.t, s.n, L, W, H, lean, thv);
      // one or two small satellite clumps around the drift
      const ns = thin ? 0 : (R() * 3) | 0;
      for (let k = 0; k < ns; k++) {
        const along = (R() < 0.5 ? -1 : 1) * (L * (0.9 + R() * 0.6)), out = (R() - 0.2) * W * 0.8;
        const sx = cx + s.t[0] * along + s.n[0] * out, sz = cz + s.t[1] * along + s.n[1] * out;
        if (blockedAny(sx, sz)) continue;
        const ss = size * (0.2 + R() * 0.25);
        drift(sx, s.y, sz, s.t, s.n, ss * (1.2 + R()), ss, H * (0.3 + R() * 0.3), lean * 0.5, thv + 0.15);
      }
      made++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aTh', new THREE.Float32BufferAttribute(th, 1));
    g.setAttribute('aC', new THREE.Float32BufferAttribute(cen, 3));
    g.setAttribute('aRho', new THREE.Float32BufferAttribute(rh, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    K.mesh.geometry.dispose();
    K.mesh.geometry = g;
    K.seeded = true;
  }

  /* ---------------------------------------------------------------- API */
  const QS = new URLSearchParams(location.search);
  let baseSeed = QS.get('pseed') ? parseInt(QS.get('pseed'), 10) : (Math.random() * 1e6) | 0;
  let gen = 0;
  const regen = (K) => {
    const seed = baseSeed + 7919 * (++gen) + (K.name === 'snow' ? 11 : K.name === 'leaf' ? 23 : 37);
    if (K.name === 'snow') genSnow(K, seed); else genFlakes(K, seed);
  };
  const api = {
    kinds,
    /** brand-new layout for every kind (controlled random: same rules, different seed) */
    reseed(seed) {
      baseSeed = seed ?? ((Math.random() * 1e6) | 0);
      Object.values(kinds).forEach((K) => { K.seeded = false; if (K.amt > 0.01) regen(K); });
    },
    get seed() { return baseSeed; },
    /** p: { pilePetal, pileLeaf, pileSnow, pileBright, lightDir, litterAmt, litterKind } */
    apply(p, dt = 0.016) {
      const want = {
        // loose litter tops up the piles a little (autumn without a holiday still drops leaves etc.)
        leaf: Math.min(1, Math.max(p.pileLeaf, (p.litterAmt || 0) * (p.litterKind || 0) * 0.8)),
        petal: Math.min(1, Math.max(p.pilePetal, (p.litterAmt || 0) * (1 - (p.litterKind || 0)) * 0.8)),
        snow: Math.min(1, p.pileSnow),
      };
      U.uBright.value = p.pileBright;
      U.uL.value.copy(p.lightDir);
      Object.values(kinds).forEach((K) => {
        const a = want[K.name];
        K.amt = a;
        if (a <= 0.01) { K.hidden += dt; (K.im || K.mesh).visible = false; if (K.pad) K.pad.visible = false; return; }
        // a kind that was gone for a while gets a fresh layout when it comes back (new season / holiday)
        if (!K.seeded || K.hidden > 2.0) regen(K);
        K.hidden = 0;
        K.u.uAmt.value = a;
        (K.im || K.mesh).visible = true;
        if (K.pad) K.pad.visible = true;
      });
    },
  };
  return api;
}
