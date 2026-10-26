import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, rng, roundRect } from '../core.js';
import { T } from '../tex.js';
import { makeTree, makeShrub } from '../tree.js';
import { makeHosta, makeFern, makeAspidistra } from '../plants/groundPlants.js';
import { bladeGeo, placeLeaf, mergeInto, leafTex, leafMat } from '../plants/kit.js';
import { flipWinding } from '../merge.js';
import { buildVillaHouse } from './villaHouse.js';
import { makeWater, BED_PEBBLES } from '../waterSystem.js';
import { rockBatch, rockMat, rockGeo } from '../rocks.js';

/* ====================================================================================================
   The large residence (大型住宅) - the south-east block, Kaigan-dori to the north, Hoshizora-dori to the west.
   A walled lot: a low one-storey Japanese modern courtyard house (town/villaHouse.js) stands along Kaigan-dori, an L
   wrapping the landscaped garden that fills the southern half of the lot; its glass living room opens onto a deck.
   The garden + house are modelled with the garden on the north side (z 14 .. 21) and the house behind it
   (z 22.6 .. 29.8), then mirrored north-south as one group: z_world = MZ - z (merge.js flips the triangle winding).

     lot      x 14.2 .. 29.2, z 14.0 .. 31.0, levelled at y 0.40 (town/layout.js villaPad)
     fence    a white base wall with white piers all round; dark metal bars on the street sides (north, west),
              dark horizontal slats on the private sides (east, south); the gate on Hoshizora-dori (opening onto
              the terrace in front of the house) with lamps, the nameplate, an intercom and a post box
     garden   after the reference: a round timber deck in the front-left corner (fire bowl, two lounge chairs)
              held by a curved white planter wall, a cherry tree; a soft-edged pond with lily pads, rocks and a
              round overflowing stone basin; a lawn with a curving line of stepping stones from the front door
              to the fire deck; gravel borders with boulders, agaves and flowers; glowing ball lamps, path lights, uplights
     house    town/villaHouse.js (plan, facades, entrance porch, deck, Japandi interior, its weather hooks)
     paths    a stone walk from the gate along the garden, the entrance path to the porch, two small stone lanterns
   ==================================================================================================== */

export const VILLA_LOT = [14.2, 29.2, 14.0, 31.0];
const [LX0, LX1, LZ0, LZ1] = VILLA_LOT;
const YL = 0.4; // the levelled lot
const MZ = LZ0 + LZ1; // the north-south mirror (see the header)
const GATE = { z0: 22.55, z1: 23.95 }; // the gate in the west fence (world z), onto the terrace
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------------------------------------------- textures */
const tex = {};
const ct = (k, w, h, draw, o) => (tex[k] ||= canvasTex(w, h, draw, o));
const plankTex = () => ct('plank', 256, 256, (g, w, h) => {
  const R = rng(4), n = 9, s = w / n;
  for (let i = 0; i < n; i++) { g.fillStyle = ['#a8794e', '#b0825a', '#9f7148', '#ad7f54'][(R() * 4) | 0]; g.fillRect(i * s, 0, s, h); g.fillStyle = 'rgba(60,35,15,0.5)'; g.fillRect(i * s, 0, 2, h); for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(80,50,25,0.15)'; g.beginPath(); const x = i * s + 4 + R() * (s - 8); g.moveTo(x, 0); g.lineTo(x + R() * 4 - 2, h); g.stroke(); } }
}, { repeat: true });
const slatTex = () => ct('slat', 256, 256, (g, w, h) => {
  const R = rng(6), n = 12, s = w / n;
  g.fillStyle = '#5a4434'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = ['#c49a6c', '#bb9064', '#c9a274'][(R() * 3) | 0]; g.fillRect(i * s + 3, 0, s - 6, h); g.fillStyle = 'rgba(255,240,215,0.12)'; g.fillRect(i * s + 3, 0, 3, h); }
}, { repeat: true });
const stoneTileTex = () => ct('stoneTile', 256, 256, (g, w, h) => {
  g.fillStyle = '#cfc6b6'; g.fillRect(0, 0, w, h);
  const R = rng(9);
  const rects = [[0, 0, 128, 96], [128, 0, 128, 96], [0, 96, 96, 80], [96, 96, 160, 80], [0, 176, 160, 80], [160, 176, 96, 80]];
  rects.forEach(([x, y, ww, hh]) => { const v = 214 + ((R() * 16) | 0); g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 2, y + 2, ww - 4, hh - 4); });
}, { repeat: true });
const gravelTex = () => ct('gravel', 128, 128, (g, w, h) => {
  g.fillStyle = '#b9a98f'; g.fillRect(0, 0, w, h);
  const R = rng(13); for (let i = 0; i < 700; i++) { g.fillStyle = ['#cbbca2', '#a6967d', '#d8cbb3', '#9a8b74'][(R() * 4) | 0]; g.fillRect(R() * w, R() * h, 2 + R() * 2, 2 + R() * 2); }
}, { repeat: true });
// the lawn: soft mowing stripes, gentle tonal patches, blades (not one flat green)
const lawnTex = () => ct('lawn', 256, 256, (g, w, h) => {
  g.fillStyle = '#3f7a3a'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(190,230,140,0.07)'; g.fillRect(x, 0, 32, h); }
  const R = rng(17);
  for (let i = 0; i < 14; i++) { const x = R() * w, y = R() * h, r = 20 + R() * 46, gr = g.createRadialGradient(x, y, 0, x, y, r), c = R() < 0.5 ? '150,190,90' : '30,70,35'; gr.addColorStop(0, `rgba(${c},0.16)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 3200; i++) { g.fillStyle = R() < 0.5 ? 'rgba(130,180,95,0.3)' : 'rgba(28,66,30,0.28)'; g.fillRect(R() * w, R() * h, 1, 2 + R() * 4); }
}, { repeat: true });
// raked gravel (the tea platform's border, the maple's crescent)
const rakedTex = () => ct('raked', 128, 128, (g, w, h) => {
  g.fillStyle = '#cfc8ba'; g.fillRect(0, 0, w, h);
  const R = rng(19); for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,110,95,0.3)'; g.fillRect(R() * w, R() * h, 2, 2); }
  for (let y = 4; y < h; y += 12) { g.fillStyle = 'rgba(110,100,86,0.35)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y + 2, w, 1); }
}, { repeat: true });
const waterTex = () => ct('water', 256, 256, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#9fd8dc'); gr.addColorStop(1, '#5fb0bf'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const R = rng(21); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 22; g.beginPath(); g.arc(x, y, r, R() * 3, R() * 3 + 1.4); g.stroke(); }
}, { repeat: true });
const nameTex = () => ct('name', 200, 80, (g, w, h) => { g.fillStyle = '#2f3236'; roundRect(g, 2, 2, w - 4, h - 4, 6); g.fill(); T(g, '星野', w / 2, 32, 30, '#f2ede2', { weight: 700 }); T(g, 'HOSHINO', w / 2, 62, 16, '#c9b48a', { weight: 700 }); });
const numTex = () => ct('num', 96, 48, (g, w, h) => { g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h); T(g, '6-1', w / 2, h / 2 + 1, 24, '#2f3236', { weight: 800 }); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.white) return M;
  M.white = toon('#f4f2ec', { lit: 0.06 });
  M.whiteW = toon('#ece8de');
  M.fascia = toon('#fbfaf6', { lit: 0.08 });
  M.dark = toon('#2f3236');
  M.metal = toon('#3a3d42');
  M.slat = toon('#ffffff', { map: slatTex(), nocache: true, lit: 0.12 });
  M.plank = toon('#ffffff', { map: plankTex(), nocache: true, lit: 0.1 });
  M.tile = toon('#ffffff', { map: stoneTileTex(), nocache: true });
  M.gravel = toon('#ffffff', { map: gravelTex(), nocache: true });
  M.lawn = toon('#ffffff', { map: lawnTex(), nocache: true });
  M.stone = toon('#b7ada0', { nocache: true });
  M.rockL = toon('#c2b7a6');
  M.cushion = toon('#efe9dc');
  M.wood = toon('#b8875a', { lit: 0.15 });
  M.soil = toon('#4a3a2c', { lit: 0.02 });
  return M;
}
/** a box with UVs in metres / tile on every face */
function wbx(parent, mat, x0, x1, y0, y1, z0, z1, tile = 1, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = o.cast ?? true; m.receiveShadow = true; parent.add(m);
  return m;
}
/** a flat shape on the ground through smooth points [x, z] (closed), UVs in metres / tile */
/* ---------------------------------------------------------------- the pond's water (waterSystem.js) */
// depth comes from a small map of the distance to the pond's outline (in the garden's own frame: the garden is mirrored)
const POND_DEPTH = 0.3; // the water's look reads this depth (the real basin is shallow)
function pondWater() {
  return makeWater('pond', {
    bed: BED_PEBBLES,
    depth: /* glsl */ `uniform sampler2D tDepth; uniform vec4 uDBox; uniform mat3 uW2L;
      float wDepth(vec2 p){ vec2 uv = ((uW2L * vec3(p, 1.0)).xy - uDBox.xy) / uDBox.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -1.0;
        return texture2D(tDepth, uv).r * ${POND_DEPTH.toFixed(2)} - 0.003; }`,
    uniforms: { tDepth: { value: null }, uDBox: { value: new THREE.Vector4() }, uW2L: { value: new THREE.Matrix3() } },
  });
}
const inPolyXZ = (x, z, O) => { let c = false; for (let i = 0, j = O.length - 1; i < O.length; j = i++) { const a = O[i], b = O[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; } return c; };
const edgeDistXZ = (x, z, O) => { let d = 1e9; for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length], vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L)); d = Math.min(d, Math.hypot(x - a.x - vx * t, z - a.z - vz * t)); } return d; };
/** the depth map, the world -> garden transform, the ripple sources (the spill stone, a few rim rocks), the night light */
function bindPond(mesh, O) {
  const U = mesh.material.uniforms;
  const xs = O.map((p) => p.x), zs = O.map((p) => p.z), x0 = Math.min(...xs) - 0.1, z0 = Math.min(...zs) - 0.1, w = Math.max(...xs) + 0.1 - x0, h = Math.max(...zs) + 0.1 - z0;
  const W = 128, H = Math.max(8, Math.round((W * h) / w)), data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + ((i + 0.5) / W) * w, z = z0 + ((j + 0.5) / H) * h, o = (j * W + i) * 4;
    const k = inPolyXZ(x, z, O) ? Math.min(1, edgeDistXZ(x, z, O) / 0.85) : 0;
    data[o] = Math.round(255 * k * k * (3 - 2 * k)); data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  U.tDepth.value = tex; U.uDBox.value.set(x0, z0, w, h);
  // world positions are known once the garden is placed (it is mirrored): set them on the first draw
  let done = false;
  mesh.onBeforeRender = () => {
    if (done) return;
    done = true;
    const m = new THREE.Matrix4().copy(mesh.matrixWorld).invert().elements;
    U.uW2L.value.set(m[0], m[8], m[12], m[2], m[10], m[14], 0, 0, 1);
    const wp = (x, z) => mesh.localToWorld(new THREE.Vector3(x, 0, z));
    const src = [[15.95, 20.0, 0.9, 0.66], [O[12].x, O[12].z, 0.25, 0], [O[48].x, O[48].z, 0.2, 0], [O[90].x, O[90].z, 0.25, 0]];
    src.forEach(([x, z, k, r], i) => { const p = wp(x, z); U.uSrc.value[i].set(p.x, p.z, k, r); });
    U.uNSrc.value = src.length;
    const gp = wp(18.2, 19.6); U.uGlow.value.set(gp.x, gp.z, 0.7, 0.45); U.uGlowCol.value.set('#d4efff');
  };
}
/** pebbles on the pond's floor, seen through the clear water */
function pondPebbles(g, O) {
  const R = rng(311), geo = rockGeo('pebble', 1), mat = rockMat({ waterY: YL + 0.07, band: 0.3, wet: 0, moss: 0, tint: '#ffffff' });
  const im = new THREE.InstancedMesh(geo, mat, 46), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const xs = O.map((p) => p.x), zs = O.map((p) => p.z), cols = ['#f2efe6', '#d8d4ca', '#ffffff', '#c9c6be', '#fff6e6']; // casts over the pebbles' own colours
  let n = 0;
  for (let k = 0; k < 600 && n < 46; k++) {
    const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + R() * (Math.max(...zs) - Math.min(...zs));
    if (!inPolyXZ(x, z, O) || edgeDistXZ(x, z, O) < 0.12) continue;
    const s = 0.04 + R() * 0.07;
    m4.compose(new THREE.Vector3(x, YL + 0.004, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28), new THREE.Vector3(s * (1 + R() * 0.5), s * 0.7, s));
    im.setMatrixAt(n, m4); im.setColorAt(n, c.set(cols[(R() * cols.length) | 0])); n++;
  }
  im.count = n; im.receiveShadow = true; g.add(im);
}

function groundShape(parent, pts, y, mat, tile = 1) {
  const sh = new THREE.Shape();
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), true, 'centripetal');
  const P = curve.getPoints(pts.length * 10);
  P.forEach((p, i) => (i ? sh.lineTo(p.x, -p.z) : sh.moveTo(p.x, -p.z)));
  const geo = new THREE.ShapeGeometry(sh, 2);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
  const m = new THREE.Mesh(geo, mat); m.position.y = y; m.receiveShadow = true; parent.add(m);
  return { mesh: m, outline: P };
}
function makeBins(root) {
  const bins = new Map(), rel = new THREE.Matrix4();
  return {
    add(parent, mat, geo) {
      if (parent && parent !== root) { root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false); geo.applyMatrix4(rel.copy(root.matrixWorld).invert().multiply(parent.matrixWorld)); if (rel.determinant() < 0) flipWinding(geo); }
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(geo);
    },
    flush() { bins.forEach((list, mat) => root.add(mergeInto(list, mat, { cast: false }))); },
  };
}

/* ---------------------------------------------------------------- garden pieces */
// the garden's stones (rocks.js): restrained Japanese-garden stones, bedded into the gravel / lawn, flat stepping stones
let VB = null, VBP = null; // the garden's stones / the pond's (with its waterline)
/** a garden stone: bigger ones natural / mossy / half-buried, small ones half-buried or pebbles (s: the old radius) */
function boulder(p, x, z, s, seed, pond = false) {
  const R = rng(seed), big = s > 0.2;
  const type = big ? ['medium', 'mossy', 'embedded'][(R() * 3) | 0] : R() < 0.6 ? 'embedded' : 'pebble';
  (pond ? VBP : VB).add(type, (R() * 3) | 0, x, YL, z, s * (pond ? 1.0 : 1.15), { ry: R() * 6.28, tilt: [(R() - 0.5) * 0.15, (R() - 0.5) * 0.15], sink: type === 'embedded' ? 0.35 : 0.2, sq: [1, 0.85 + R() * 0.3, 1], tint: R() < 0.5 ? '#ffffff' : '#f3ede2' });
}
/** a flat stepping stone, its top ~3 cm above the lawn */
function stepStone(x, z, rx, rz, ry, i) {
  const h = rockGeo('step', i % 3).userData.h * Math.max(rx, rz);
  VB.add('step', i % 3, x, YL + 0.012, z, Math.max(rx, rz), { ry, sink: Math.max(0, 1 - 0.035 / h), sq: [1, 1, rz / Math.max(rx, rz)], tint: i % 2 ? '#ffffff' : '#f4efe6' });
}
function flowers(p, x, z, kind, seed, r = 0.35) {
  // a clump: hydrangea (blue / violet balls), cosmos (pink / white), lavender spikes, white daisies
  const R = rng(seed);
  const leaf = toon('#4f7f46');
  sph(p, leaf, r * 0.7, x, YL + r * 0.35, z, 1.2, 0.7, 1.2);
  const n = kind === 'lavender' ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, d = R() * r * 0.8, fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
    if (kind === 'hydrangea') sph(p, toon(['#7f9fe6', '#9b8fe0', '#a8c4f2', '#b6a2ea'][(R() * 4) | 0]), 0.09 + R() * 0.04, fx, YL + r * 0.6 + R() * 0.1, fz, 1, 0.85, 1);
    else if (kind === 'lavender') { cyl2(p, leaf, [fx, YL + 0.1, fz], [fx, YL + 0.5 + R() * 0.15, fz], 0.006, 3, { noLine: true }); const c = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 6), toon('#9a7ad6')); c.position.set(fx, YL + 0.6 + R() * 0.15, fz); p.add(c); }
    else sph(p, toon(kind === 'cosmos' ? ['#f2a0c4', '#f7d6e6', '#e86a9a', '#ffffff'][(R() * 4) | 0] : ['#ffffff', '#f7f2d0'][(R() * 2) | 0]), 0.045, fx, YL + r * 0.7 + R() * 0.12, fz, 1, 0.5, 1);
  }
}
function agave(p, bins, x, z, s, seed) {
  const R = rng(seed);
  const tx = leafTex('agave', { kind: 'plain', base: '#6f9aa0', edge: '#5a8890', vein: '#9cc2c4', center: '#7aa6ab' });
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4 + R() * 0.3, d = V(Math.cos(a), 0, Math.sin(a)), el = 0.35 + (i % 3) * 0.3 + R() * 0.15;
    const dir = d.clone().multiplyScalar(Math.cos(el)).addScaledVector(V(0, 1, 0), Math.sin(el)).normalize();
    const l = (0.32 + R() * 0.14) * s;
    const up = V(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
    bins.add(p, leafMat(tx), placeLeaf(bladeGeo({ L: l, W: l * 0.22, segL: 5, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + v * 0.94)), 0.7) * (1 - v * 0.4), droop: 0.08, cup: 0.3 }), V(x, YL + 0.05, z), dir, up, 0.85 + R() * 0.3));
  }
}
/** a glowing ball lamp on the ground (warm white, dims by day) */
function ballLamp(p, x, z, r = 0.22) {
  sph(p, glow('#ffe9c8', 1.8, { off: '#ece6d8' }), r, x, YL + r * 0.95, z);
  halo(p, x, YL + r, z, '#ffdcae', r * 5, 0.4);
}
/** a low mushroom lawn light (warm, glowing under its cap) */
function lawnLight(p, x, z) {
  const m = mats();
  cy(p, m.dark, x, YL, z, 0.03, 0.32, 8);
  cy(p, m.dark, x, YL + 0.32, z, 0.13, 0.03, 16, { rt: 0.5 });
  cy(p, glow('#ffe2b8', 2.0, { off: '#d8d2c4' }), x, YL + 0.3, z, 0.1, 0.02, 14);
  halo(p, x, YL + 0.2, z, '#ffd9a8', 0.9, 0.3);
}
function pathLight(p, x, z) {
  const m = mats();
  cy(p, m.dark, x, YL, z, 0.035, 0.42, 8);
  bx(p, m.dark, x - 0.06, x + 0.06, YL + 0.42, YL + 0.47, z - 0.06, z + 0.06, { cast: false });
  bx(p, glow('#ffe2b8', 1.8, { off: '#d8d2c4' }), x - 0.045, x + 0.045, YL + 0.36, YL + 0.42, z - 0.045, z + 0.045, { cast: false });
  halo(p, x, YL + 0.3, z, '#ffd9a8', 0.7, 0.35);
}
function uplight(p, x, z) {
  cy(p, glow('#fff0d0', 2.2, { off: '#5a5a5a' }), x, YL, z, 0.06, 0.03, 10);
  halo(p, x, YL + 0.6, z, '#ffe2b8', 1.6, 0.25);
}

/** a small stone lantern (tōrō): base, post, platform, the lit fire box, a pyramid cap (warm with the house lights) */
function stoneLantern(p, x, z) {
  const st = toon('#b8b0a2'), y = YL;
  cy(p, st, x, y, z, 0.16, 0.08, 8); cy(p, st, x, y + 0.08, z, 0.06, 0.42, 8);
  bx(p, st, x - 0.15, x + 0.15, y + 0.5, y + 0.56, z - 0.15, z + 0.15, { bevel: 0.015 });
  bx(p, st, x - 0.1, x + 0.1, y + 0.56, y + 0.78, z - 0.1, z + 0.1, { bevel: 0.01 });
  bx(p, glow('#ffd9a0', 2.0, { off: '#6a6258' }), x - 0.065, x + 0.065, y + 0.6, y + 0.74, z - 0.102, z + 0.102, { cast: false });
  bx(p, glow('#ffd9a0', 2.0, { off: '#6a6258' }), x - 0.102, x + 0.102, y + 0.6, y + 0.74, z - 0.065, z + 0.065, { cast: false });
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), st); cap.position.set(x, y + 0.86, z); cap.rotation.y = Math.PI / 4; cap.castShadow = true; p.add(cap);
  sph(p, st, 0.04, x, y + 0.96, z);
  halo(p, x, y + 0.68, z, '#ffd59a', 1.0, 0.3);
}

/* ---------------------------------------------------------------- the lot */
export function buildVilla(parent) {
  const m = mats();
  const root = grp(parent);
  root.name = 'villa';
  const g = grp(root, 0, 0, MZ); // garden + house, mirrored north-south
  g.scale.z = -1;
  const bins = makeBins(root);
  const R = rng(64);
  VB = rockBatch(g, rockMat({ wet: 1.0, moss: 0.8, tint: '#faf6ee' }), { name: 'VillaRocks' });
  VBP = rockBatch(g, rockMat({ waterY: YL + 0.07, band: 0.3, wet: 1.1, moss: 1.0, tint: '#faf6ee' }), { name: 'VillaPondRocks' });

  /* ---- ground: gravel under everything, the terrace in stone tiles, the lawn, the pond ---- */
  wbx(g, m.gravel, LX0, LX1, YL - 0.08, YL + 0.004, LZ0, LZ1, 1.5, { cast: false });
  wbx(g, m.tile, 14.6, 24.35, YL, YL + 0.03, 20.92, 21.82, 1.6, { cast: false }); // the walk from the gate along the garden
  wbx(g, m.tile, 15.75, 17.85, YL, YL + 0.03, 21.82, 24.15, 1.6, { cast: false }); // the entrance path up to the porch steps
  wbx(g, m.tile, 14.6, 28.8, YL, YL + 0.03, 29.95, 30.7, 1.6, { cast: false }); // a strip round the back
  wbx(g, m.tile, 14.6, 15.5, YL, YL + 0.03, 24.15, 29.95, 1.6, { cast: false }); // and the west side
  bx(g, m.whiteW, 14.6, 28.8, YL, YL + 0.08, 20.84, 20.92, { cast: false }); // the terrace's edge kerb
  const lawn = groundShape(g, [[19.3, 15.25], [23.0, 15.05], [26.6, 15.3], [26.9, 17.5], [26.7, 20.55], [23.5, 20.7], [21.4, 20.6], [20.6, 19.4], [20.1, 18.3], [19.4, 17.2], [19.1, 16.2]], YL + 0.012, m.lawn, 3);
  // stepping stones from the deck's front step across the lawn to the fire deck
  {
    const path = new THREE.CatmullRomCurve3([V(21.9, 0, 20.5), V(22.35, 0, 19.6), V(22.6, 0, 18.7), V(22.3, 0, 17.7), V(21.6, 0, 16.9), V(20.5, 0, 16.4), V(19.2, 0, 16.6)]);
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = path.getPointAt(t);
      const rx = 0.3 + R() * 0.08, rz = 0.24 + R() * 0.06, ry = R() * 3;
      stepStone(p.x + (R() - 0.5) * 0.12, p.z, rx, rz, ry, i);
      if (i % 3 === 1) pathLight(g, p.x + (i % 2 ? 0.55 : -0.55), p.z + 0.1);
    }
  }
  // the pond: a soft kidney shape, dark basin, clear water, lily pads, rocks round the rim, a stream lobe by the deck
  {
    const pts = [[15.2, 18.9], [16.6, 18.55], [18.0, 18.75], [19.2, 18.2], [19.9, 17.3], [20.6, 17.6], [20.7, 18.6], [21.1, 19.6], [20.6, 20.45], [18.8, 20.6], [16.9, 20.55], [15.4, 20.35], [14.95, 19.6]];
    groundShape(g, pts, YL + 0.006, toon('#7f9488', { lit: 0.05 }), 1); // a pale stone floor that shows through the clear water
    const water = groundShape(g, pts, YL + 0.075, pondWater(), 2.5); // the town's shared water, 'pond' preset (waterSystem.js)
    water.mesh.userData.noLine = true; water.mesh.receiveShadow = false; water.mesh.renderOrder = 3;
    bindPond(water.mesh, water.outline);
    pondPebbles(g, water.outline);
    // rocks + pebbles round the rim, leaving the deck side open
    // rim stones at irregular spacing: some big ones (often with a small one beside), small ones between, pebbles
    {
      const Rr = rng(77), O = water.outline;
      for (let i = 1; i < O.length; i += 3 + ((Rr() * 5) | 0)) {
        const p = O[i], big = Rr() < 0.3, s = big ? 0.22 + Rr() * 0.1 : 0.1 + Rr() * 0.09;
        boulder(g, p.x + (Rr() - 0.5) * 0.12, p.z + (Rr() - 0.5) * 0.12, s, 100 + i, true);
        if (big && Rr() < 0.6) { const q = O[Math.min(O.length - 1, i + 1)]; boulder(g, q.x + (Rr() - 0.5) * 0.12, q.z + (Rr() - 0.5) * 0.12, s * 0.5, 160 + i, true); }
      }
      for (let i = 0; i < O.length; i++) { if (Rr() < 0.55) continue; const p = O[i], r = 0.045 + Rr() * 0.045; VBP.add('pebble', i % 3, p.x + (Rr() - 0.5) * 0.08, YL, p.z + (Rr() - 0.5) * 0.08, r, { ry: i * 2.1, sink: 0.25 }); }
    }
    // lily pads with a few white / pink flowers
    [[16.0, 19.4], [16.6, 19.9], [17.3, 19.2], [18.4, 19.9], [19.6, 19.3], [20.1, 18.3], [20.3, 19.9], [15.7, 20.0], [18.9, 19.0]].forEach(([x, z], i) => {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.17 + (i % 3) * 0.04, 14, 0.3, Math.PI * 1.8), toon(i % 2 ? '#4f8f4a' : '#5f9f52', { side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = i; pad.position.set(x, YL + 0.082, z); g.add(pad);
      if (i % 3 === 0) { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const pe = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), toon(i % 2 ? '#f7c6d8' : '#fbf8f0')); pe.position.set(x + Math.cos(a) * 0.04, YL + 0.12, z + Math.sin(a) * 0.04); pe.rotation.z = Math.cos(a) * 0.6; pe.rotation.x = -Math.sin(a) * 0.6; g.add(pe); } sph(g, toon('#f2d23a'), 0.02, x, YL + 0.12, z); }
    });
    // reeds + water iris at the back edge, an underwater light
    for (let i = 0; i < 9; i++) { const x = 15.4 + i * 0.12, z = 20.25 + (i % 2) * 0.08; cyl2(g, toon('#5f8a48'), [x, YL + 0.05, z], [x + (R() - 0.5) * 0.08, YL + 0.6 + R() * 0.3, z], 0.008, 3, { noLine: true }); }
    flowers(g, 20.4, 17.4, 'lavender', 7, 0.3);
    sph(g, glow('#bfe8ff', 1.2, { off: '#5fb0bf' }), 0.06, 18.2, YL + 0.04, 19.6);
    halo(g, 18.2, YL + 0.2, 19.6, '#a8e0ff', 2.2, 0.25);
  }
  // the round stone basin overflowing into the pond, by the terrace corner
  {
    const x = 15.95, z = 20.0;
    cy(g, m.stone, x, YL, z, 0.5, 0.5, 24, { rt: 0.85 });
    cy(g, m.rockL, x, YL + 0.5, z, 0.62, 0.06, 28);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.56, 28), new THREE.MeshToonMaterial({ map: waterTex(), transparent: true, opacity: 0.85 })); top.rotation.x = -Math.PI / 2; top.position.set(x, YL + 0.565, z); top.userData.noLine = true; g.add(top);
    const sheet = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.66, 0.5, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfeef4, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); sheet.position.set(x, YL + 0.31, z); sheet.userData.noLine = true; g.add(sheet);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.35, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.6, depthWrite: false })); jet.position.set(x, YL + 0.74, z); jet.userData.noLine = true; jet.userData.keep = true; g.add(jet);
    reg.updaters.push((t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.08; });
  }

  /* ---- the round timber deck in the front-left corner: fire bowl, two lounge chairs, the curved planter wall ---- */
  {
    const cx = 16.85, cz = 16.75, r = 1.7;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 40), [toon('#8a6040'), m.plank, toon('#8a6040')]); deck.position.set(cx, YL + 0.07, cz); deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
    // a curved white planter wall wrapping the deck on the corner side, soil and planting on top
    {
      const a0 = Math.PI * 0.45, a1 = Math.PI * 1.35, r0 = r + 0.08, r1 = r + 0.42, hh = 0.55;
      const sh = new THREE.Shape(); sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: hh, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 32 });
      geo.rotateX(-Math.PI / 2);
      const w = new THREE.Mesh(geo, m.white); w.position.set(cx, YL, cz); w.castShadow = true; w.receiveShadow = true; g.add(w);
      for (let k = 0; k <= 8; k++) { const a = a0 + ((a1 - a0) * k) / 8, rr = (r0 + r1) / 2, px = cx + Math.cos(a) * rr, pz = cz - Math.sin(a) * rr; if (k % 2) flowers(g, px, pz, ['hydrangea', 'cosmos', 'daisy'][k % 3], 30 + k, 0.2); else { const sb = makeShrub({ seed: 40 + k, width: 0.6, height: 0.5, palette: 'deep' }); sb.position.set(px, YL + hh - 0.05, pz); g.add(sb); } }
    }
    // the fire bowl and two lounge chairs with cushions
    cy(g, m.dark, cx + 0.15, YL + 0.14, cz + 0.1, 0.42, 0.3, 24, { rt: 0.8 });
    cy(g, toon('#2a2522'), cx + 0.15, YL + 0.44, cz + 0.1, 0.36, 0.02, 24);
    for (let k = 0; k < 5; k++) { const a = k * 1.3; cyl2(g, toon('#5a3a22'), [cx + 0.15 + Math.cos(a) * 0.12, YL + 0.47, cz + 0.1 + Math.sin(a) * 0.12], [cx + 0.15 - Math.cos(a) * 0.12, YL + 0.5, cz + 0.1 - Math.sin(a) * 0.12], 0.025, 5); }
    sph(g, glow('#ff8a3a', 2.4, { off: '#5a3a2a' }), 0.12, cx + 0.15, YL + 0.5, cz + 0.1, 1.2, 0.7, 1.2);
    halo(g, cx + 0.15, YL + 0.7, cz + 0.1, '#ffa050', 1.4, 0.5);
    const chair = (x, z, ry) => {
      const c = grp(g, x, YL + 0.14, z, ry);
      [[-0.28, -0.3], [0.28, -0.3], [-0.28, 0.3], [0.28, 0.3]].forEach(([a, b]) => bx(c, m.wood, a - 0.03, a + 0.03, 0, 0.36, b - 0.03, b + 0.03));
      bx(c, m.wood, -0.32, 0.32, 0.3, 0.36, -0.34, 0.34, { bevel: 0.01 });
      bx(c, m.cushion, -0.28, 0.28, 0.36, 0.46, -0.3, 0.3, { bevel: 0.04 });
      const back = grp(c, 0, 0.36, -0.3, 0); back.rotation.x = -0.35; bx(back, m.wood, -0.32, 0.32, 0, 0.62, -0.03, 0.03); bx(back, m.cushion, -0.27, 0.27, 0.06, 0.58, 0.03, 0.12, { bevel: 0.04 });
      [-0.32, 0.32].forEach((a) => bx(c, m.wood, a - 0.03, a + 0.03, 0.36, 0.58, -0.3, 0.3)); // arms
    };
    chair(cx - 0.75, cz + 0.85, Math.PI * 0.85); chair(cx + 0.95, cz - 0.65, -Math.PI * 0.35);
    bx(g, toon('#e8e2d6'), cx - 0.85, cx - 0.55, YL + 0.6, YL + 0.66, cz + 0.65, cz + 0.95, { bevel: 0.03 }); // a folded throw
  }
  // the cherry tree in the front-left corner, lit from below
  { const t = makeTree({ seed: 88, height: 3.9, spread: 0.85, palette: 'deep', dens: 0.8, leafScale: 0.85, lean: -0.08, blossom: 1 }); t.position.set(14.85, YL, 14.6); t.rotation.y = 2.4; g.add(t); uplight(g, 15.35, 14.95); }

  /* ---- planting: the beds along the fences, the gravel border with boulders and agaves, ball lamps ---- */
  {
    // the bed along the south fence (the far end of the garden)
    for (let x = 17.6; x < 22.3; x += 0.7) { if (R() < 0.5) { const sb = makeShrub({ seed: 70 + ((x * 10) | 0), width: 0.7, height: 0.55, palette: 'deep' }); sb.position.set(x, YL, 14.55); g.add(sb); } else flowers(g, x, 14.55, ['hydrangea', 'lavender', 'cosmos'][(x * 3 | 0) % 3], (x * 7) | 0, 0.32); }
    for (let x = 24.4; x < 28.9; x += 0.7) { if (R() < 0.55) { const sb = makeShrub({ seed: 90 + ((x * 10) | 0), width: 0.7, height: 0.6, palette: 'deep' }); sb.position.set(x, YL, 14.55); g.add(sb); } else flowers(g, x, 14.55, ['cosmos', 'hydrangea', 'daisy'][(x * 3 | 0) % 3], (x * 9) | 0, 0.32); }
    // the west bed behind the pond, a few clipped balls (the gate is beyond its north end)
    [[14.65, 17.4], [14.65, 18.8]].forEach(([x, z], i) => { const sb = makeShrub({ seed: 120 + i, width: 0.7, height: 0.75, palette: 'deep' }); sb.position.set(x, YL, z); g.add(sb); });
    // the gravel border on the east with boulders, agaves, flowers and ball lamps
    [[27.4, 16.0, 0.35], [27.9, 17.2, 0.45], [27.3, 18.6, 0.3], [28.2, 19.6, 0.38], [27.6, 20.3, 0.25]].forEach(([x, z, s], i) => boulder(g, x, z, s, 200 + i));
    agave(g, bins, 28.3, 16.4, 1.1, 1); agave(g, bins, 27.2, 17.9, 0.9, 2); agave(g, bins, 28.5, 18.6, 1.0, 3);
    flowers(g, 27.5, 19.3, 'cosmos', 11, 0.38); flowers(g, 28.4, 20.4, 'hydrangea', 12, 0.36); flowers(g, 27.2, 15.4, 'lavender', 13, 0.32);
    [[makeHosta, 21.0, 20.4, 0.6], [makeFern, 19.4, 16.6, 0.55], [makeAspidistra, 26.4, 20.5, 0.55], [makeFern, 21.6, 15.6, 0.5]].forEach(([mk, x, z, s], i) => { const p = mk({ seed: 300 + i * 7, scale: s }); p.position.set(x, YL, z); g.add(p); });
    ballLamp(g, 19.0, 15.6); ballLamp(g, 27.0, 19.0, 0.26); ballLamp(g, 14.9, 18.3, 0.2); ballLamp(g, 21.3, 18.9, 0.18);
    // two small stone lanterns: by the pond, by the entrance path
    [[21.45, 20.25], [15.05, 22.3]].forEach(([x, z]) => stoneLantern(g, x, z));
  }

  /* ---- the lawn: a small tea platform on raked gravel, the path to it, a Japanese maple, soft edges, lawn lights ---- */
  {
    const Rl = rng(515), raked = toon('#ffffff', { map: rakedTex(), nocache: true }), woodD = toon('#7a5a3c'), cushion = toon('#e9e2d4');
    const px0 = 23.55, px1 = 25.75, pz0 = 16.8, pz1 = 18.6, cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2, py = YL + 0.14;
    wbx(g, raked, px0 - 0.32, px1 + 0.32, YL + 0.004, YL + 0.018, pz0 - 0.32, pz1 + 0.32, 0.8, { cast: false });
    [[px0 - 0.36, px1 + 0.36, pz0 - 0.36, pz0 - 0.32], [px0 - 0.36, px1 + 0.36, pz1 + 0.32, pz1 + 0.36], [px0 - 0.36, px0 - 0.32, pz0 - 0.32, pz1 + 0.32], [px1 + 0.32, px1 + 0.36, pz0 - 0.32, pz1 + 0.32]].forEach(([a, b, c, d]) => bx(g, m.stone, a, b, YL, YL + 0.045, c, d, { bevel: 0.01, cast: false }));
    wbx(g, m.plank, px0, px1, YL, py, pz0, pz1, 1.2);
    // the low tea table with a tea set, three low chairs round it (the side to the path stays open)
    [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]].forEach(([a, b]) => bx(g, woodD, cx + a - 0.03, cx + a + 0.03, py, py + 0.3, cz + b - 0.03, cz + b + 0.03, { bevel: 0.008 }));
    bx(g, m.wood, cx - 0.42, cx + 0.42, py + 0.3, py + 0.35, cz - 0.42, cz + 0.42, { bevel: 0.015 });
    sph(g, toon('#4a5a50'), 0.07, cx - 0.1, py + 0.41, cz + 0.05, 1, 0.85, 1); cyl2(g, toon('#4a5a50'), [cx - 0.04, py + 0.41, cz + 0.05], [cx + 0.03, py + 0.45, cz + 0.05], 0.012, 5); sph(g, toon('#3a4a40'), 0.025, cx - 0.1, py + 0.47, cz + 0.05);
    [[0.14, -0.12], [0.18, 0.12]].forEach(([a, b]) => cy(g, toon('#efe8da'), cx + a, py + 0.35, cz + b, 0.032, 0.05, 10, { rt: 1.15 }));
    cy(g, toon('#d8cfc0'), cx - 0.2, py + 0.35, cz - 0.22, 0.03, 0.12, 8, { rt: 0.6 }); sph(g, toon('#f2a0c4'), 0.03, cx - 0.2, py + 0.5, cz - 0.22);
    [[0, 0.78, Math.PI], [0, -0.78, 0], [0.8, 0, -Math.PI / 2]].forEach(([a, b, ry]) => {
      const c = grp(g, cx + a, py, cz + b, ry);
      [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([u, v]) => bx(c, woodD, u - 0.025, u + 0.025, 0, 0.22, v - 0.025, v + 0.025, { cast: false }));
      bx(c, m.wood, -0.25, 0.25, 0.2, 0.25, -0.25, 0.25, { bevel: 0.01 }); bx(c, cushion, -0.22, 0.22, 0.25, 0.31, -0.22, 0.22, { bevel: 0.025 });
      const back = grp(c, 0, 0.25, -0.24, 0); back.rotation.x = -0.25; bx(back, m.wood, -0.25, 0.25, 0, 0.42, -0.025, 0.025, { bevel: 0.01 });
    });
    // two stepping stones off the curving path to the platform
    [[22.98, 18.38], [23.3, 18.0]].forEach(([x, z], i) => { const rx = 0.26 + Rl() * 0.05, rz = 0.21 + Rl() * 0.04; stepStone(x, z, rx, rz, Rl() * 3, 20 + i); });
    // a small Japanese maple in the lawn's front-left corner, by the fire deck (clear of every view onto the glass):
    // moss, two stones, an uplight
    { const t = makeTree({ seed: 233, height: 2.2, spread: 0.85, palette: 'maple', dens: 0.9, leafScale: 0.5, lean: -0.1 }); t.position.set(20.15, YL, 15.45); t.rotation.y = 1.1; g.add(t); }
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + Rl() * 0.4, r = 0.3 + Rl() * 0.2; sph(g, toon(k % 2 ? '#4f7a3a' : '#5d8a44'), 0.14 + Rl() * 0.05, 20.15 + Math.cos(a) * r, YL + 0.02, 15.45 + Math.sin(a) * r, 1.3, 0.28, 1.1); }
    boulder(g, 20.75, 15.3, 0.22, 501); boulder(g, 20.95, 15.6, 0.12, 502);
    uplight(g, 20.5, 15.85);
    // soft lawn edges: groundcover, a few low shrubs, flower clumps and stones, at irregular intervals (not on the paths)
    const O = lawn.outline;
    for (let i = 0; i < O.length; i += 4 + ((Rl() * 4) | 0)) {
      const p = O[i];
      if (p.x < 21.6 || (Math.abs(p.x - 21.9) < 0.9 && p.z > 19.8)) continue; // the pond + maple side, the path's start
      const k = Rl();
      if (k < 0.45) for (let c = 0; c < 3; c++) sph(g, toon(c % 2 ? '#4f7a3a' : '#5f8a48'), 0.12 + Rl() * 0.06, p.x + (Rl() - 0.5) * 0.35, YL + 0.03, p.z + (Rl() - 0.5) * 0.25, 1.3, 0.35, 1.1);
      else if (k < 0.65) { const sb = makeShrub({ seed: 520 + i, width: 0.45, height: 0.38, palette: 'deep' }); sb.position.set(p.x, YL, p.z); g.add(sb); }
      else if (k < 0.85) flowers(g, p.x, p.z, ['lavender', 'hydrangea', 'daisy'][i % 3], 530 + i, 0.24);
      else boulder(g, p.x, p.z, 0.12 + Rl() * 0.08, 540 + i);
    }
    // warm lawn lights round the tea platform
    [[23.0, 16.55], [26.25, 18.95], [25.0, 19.2]].forEach(([x, z]) => lawnLight(g, x, z));
  }

  /* ---- the fence round the lot (world frame, not mirrored): white base + piers; metal bars on the street sides
     (north, west), slats on the private sides; the gate on Hoshizora-dori opens onto the terrace ---- */
  {
    const F = root;
    const coping = toon('#e6e0d4', { lit: 0.08 }), plinth = toon('#bdb7ad');
    const base = (x0, x1, z0, z1, h) => {
      wbx(F, m.white, x0, x1, 0.1, YL + h, z0, z1, 1, {});
      bx(F, coping, x0 - 0.03, x1 + 0.03, YL + h, YL + h + 0.05, z0 - 0.03, z1 + 0.03, { bevel: 0.015 });
      bx(F, plinth, x0 - 0.012, x1 + 0.012, 0.1, YL + 0.1, z0 - 0.012, z1 + 0.012, { bevel: 0.01, cast: false });
    };
    const pier = (x, z, h = 1.55) => { bx(F, m.white, x - 0.17, x + 0.17, 0.1, YL + h, z - 0.17, z + 0.17, { bevel: 0.02 }); bx(F, m.fascia, x - 0.2, x + 0.2, YL + h, YL + h + 0.05, z - 0.2, z + 0.2, { bevel: 0.01 }); };
    const bars = (a, b, axis) => { // dark metal bars between y 0.55 .. 1.4 above the lot
      const L = axis === 'x' ? b[0] - a[0] : b[1] - a[1];
      for (let t = 0.06; t < L; t += 0.12) { const x = axis === 'x' ? a[0] + t : a[0], z = axis === 'x' ? a[1] : a[1] + t; bx(F, m.metal, x - 0.012, x + 0.012, YL + 0.55, YL + 1.42, z - 0.012, z + 0.012, { cast: false }); }
      bx(F, m.metal, Math.min(a[0], b[0]) - 0.02, Math.max(a[0], b[0]) + 0.02, YL + 1.4, YL + 1.45, Math.min(a[1], b[1]) - 0.02, Math.max(a[1], b[1]) + 0.02, { cast: false });
    };
    const slats = (a, b, axis) => {
      for (let y = YL + 0.6; y < YL + 1.5; y += 0.14) bx(F, toon('#4a4d52'), axis === 'x' ? a[0] : a[0] - 0.03, axis === 'x' ? b[0] : a[0] + 0.03, y, y + 0.1, axis === 'x' ? a[1] - 0.03 : a[1], axis === 'x' ? a[1] + 0.03 : b[1], { cast: false });
    };
    // one side between a0 .. a1 (along x or z at `at`): a pier every ~2.4 m, bars / slats between them
    const run = (a0, a1, at, axis, fill) => {
      const n = Math.max(1, Math.round((a1 - a0) / 2.4)), P = (t) => (axis === 'x' ? [t, at] : [at, t]);
      for (let k = 0; k <= n; k++) pier(...P(a0 + ((a1 - a0) * k) / n));
      for (let k = 0; k < n; k++) fill(P(a0 + ((a1 - a0) * k) / n + 0.17), P(a0 + ((a1 - a0) * (k + 1)) / n - 0.17), axis);
    };
    // north (Kaigan-dori): bars along the whole front, behind them a row of clipped shrubs against the house
    base(LX0, LX1, LZ0 - 0.1, LZ0 + 0.1, 0.55); run(LX0, LX1, LZ0, 'x', bars);
    for (let x = 15.3; x < 28.6; x += 1.1) { const sb = makeShrub({ seed: 140 + ((x * 10) | 0), width: 0.55, height: 0.7, palette: 'deep' }); sb.position.set(x, YL, 14.62); F.add(sb); }
    // west (Hoshizora-dori): bars, the gap for the gate
    base(LX0 - 0.1, LX0 + 0.1, LZ0, GATE.z0 - 0.2, 0.55); base(LX0 - 0.1, LX0 + 0.1, GATE.z1 + 0.2, LZ1, 0.55);
    run(LZ0, GATE.z0 - 0.2, LX0, 'z', bars); run(GATE.z1 + 0.2, LZ1, LX0, 'z', bars);
    // east + south (private sides): slats
    base(LX1 - 0.1, LX1 + 0.1, LZ0, LZ1, 0.55); base(LX0, LX1, LZ1 - 0.1, LZ1 + 0.1, 0.55);
    run(LZ0, LZ1, LX1, 'z', slats); run(LX0, LX1, LZ1, 'x', slats);
    // the gate: two taller piers with lamps, a metal + timber door, the nameplate, the intercom, the post box;
    // modelled along local x with the street on local -z, turned to face Hoshizora-dori (local x 0 = GATE.z1)
    const W = GATE.z1 - GATE.z0, zf = 0;
    const gf = grp(root, LX0, 0, GATE.z1, Math.PI / 2);
    [-0.2, W + 0.2].forEach((x, i) => {
      bx(gf, m.white, x - 0.22, x + 0.22, 0.1, YL + 1.85, zf - 0.22, zf + 0.22, { bevel: 0.02 });
      bx(gf, m.fascia, x - 0.25, x + 0.25, YL + 1.85, YL + 1.91, zf - 0.25, zf + 0.25, { bevel: 0.01 });
      bx(gf, glow('#ffe6c4', 1.8, { off: '#e6e0d2' }), x - 0.12, x + 0.12, YL + 1.55, YL + 1.75, zf - 0.225, zf - 0.22, { cast: false });
      halo(gf, x, YL + 1.65, zf - 0.4, '#ffd9a8', 1.2, 0.35);
      if (i === 0) { const np = pl(gf, new THREE.MeshBasicMaterial({ map: nameTex() }), 0.36, 0.14, x, YL + 1.2, zf - 0.226, Math.PI, 0); np.userData.noLine = true; bx(gf, m.dark, x - 0.06, x + 0.06, YL + 0.95, YL + 1.08, zf - 0.24, zf - 0.22, { cast: false }); }
      else { bx(gf, m.dark, x - 0.16, x + 0.16, YL + 0.7, YL + 1.0, zf - 0.32, zf - 0.22, { bevel: 0.01 }); bx(gf, m.fascia, x - 0.1, x + 0.1, YL + 0.94, YL + 0.95, zf - 0.33, zf - 0.32, { cast: false }); const nm = pl(gf, new THREE.MeshBasicMaterial({ map: numTex() }), 0.2, 0.1, x, YL + 1.3, zf - 0.226, Math.PI, 0); nm.userData.noLine = true; }
    });
    const gate = grp(gf, 0, 0, zf, 0);
    bx(gate, m.metal, 0, W, YL + 0.05, YL + 1.6, -0.03, 0.03, { bevel: 0.01 });
    for (let x = 0.12; x < W - 0.05; x += 0.1) bx(gate, m.slat, x - 0.035, x + 0.035, YL + 0.15, YL + 1.5, -0.045, 0.045, { cast: false });
    bx(gate, toon('#c9a24a'), W - 0.18, W - 0.15, YL + 0.9, YL + 1.15, -0.08, -0.045, { cast: false });
    // the step down to the pavement in front of the gate
    bx(gf, m.stone, -0.1, W + 0.1, 0.12, YL, zf - 0.6, zf - 0.1, { bevel: 0.02 });
  }

  /* ---- the house (town/villaHouse.js) ---- */
  const house = buildVillaHouse(g, root, { YL, MZ });

  /* ---- rain: the paving, the stepping stones and the deck darken as they soak, shallow puddles shine on the
     terrace (the town's wetness / puddle levels, reg.groundU) ---- */
  {
    const base = [[m.tile, m.tile.color.clone()], [m.stone, m.stone.color.clone()], [m.plank, m.plank.color.clone()], [m.gravel, m.gravel.color.clone()]];
    const soft = ct('puddle', 128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const sheen = new THREE.MeshBasicMaterial({ color: 0x9fb6cc, alphaMap: soft, transparent: true, opacity: 0, depthWrite: false });
    const sky = new THREE.Color(0x9fb6cc), nightC = new THREE.Color(0x2c3a52);
    [[17.0, 21.4, 1.2, 0.35], [20.4, 21.35, 1.0, 0.3], [16.8, 23.0, 0.5, 0.4], [21.6, 30.3, 1.6, 0.35]].forEach(([x, z, w, d], i) => {
      const pm = new THREE.Mesh(new THREE.CircleGeometry(1, 20), sheen); pm.rotation.x = -Math.PI / 2; pm.rotation.z = i; pm.scale.set(w, d, 1); pm.position.set(x, YL + 0.034, z); pm.userData.noLine = true; g.add(pm); reg.noRefl.push(pm);
    });
    let last = -1;
    reg.updaters.push(() => {
      const G = reg.groundU; if (!G) return;
      const w = G.uWet.value, pd = G.uPuddle.value * (1 - G.uSnow.value);
      if (Math.abs(w - last) > 0.004) { last = w; base.forEach(([mt, c]) => mt.color.copy(c).multiplyScalar(1 - 0.3 * w)); }
      sheen.opacity = pd * 0.22; sheen.color.copy(nightC).lerp(sky, G.uDay.value);
    });
  }

  bins.flush();
  VB.flush(); VBP.flush();
  root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });
  reg.villa = { lot: VILLA_LOT, entrance: house.entrance };
  return root;
}
