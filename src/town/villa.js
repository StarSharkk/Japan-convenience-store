import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, noSnowBox } from '../core.js';
import { T } from '../tex.js';
import { makeGlass } from '../fx.js';
import { makeTree, makeShrub } from '../tree.js';
import { makeHosta, makeFern, makeAspidistra } from '../plants/groundPlants.js';
import { makeRhapisPot } from '../plants/pottedPlants.js';
import { bladeGeo, placeLeaf, mergeInto, leafTex, leafMat } from '../plants/kit.js';
import { flipWinding } from '../merge.js';

/* ====================================================================================================
   The large residence (大型住宅) - the south-east block, Kaigan-dori to the north, Hoshizora-dori to the west.
   A walled lot: the white two-storey modern villa stands along Kaigan-dori, its glass living room looks south onto
   the landscaped garden that fills the southern half of the lot.
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
     villa    white boxes: a wide ground floor with floor-to-ceiling glass to the garden, a recessed timber-clad
              entrance under a thin canopy; a narrower upper storey set back, a glass-railed roof terrace,
              a timber screen panel, a long window; flat roofs with crisp fascias; warm light inside at night
   Nothing inside the house takes snow; the roofs and the canopy take petals / leaves / snow (reg.extraRoofs).
   ==================================================================================================== */

export const VILLA_LOT = [14.2, 29.2, 14.0, 31.0];
const [LX0, LX1, LZ0, LZ1] = VILLA_LOT;
const YL = 0.4; // the levelled lot
const GF = { x0: 15.8, x1: 27.8, z0: 22.6, z1: 29.8, h: 3.3 };
const UF = { x0: 17.6, x1: 27.8, z0: 23.4, z1: 29.4, h: 3.1 };
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
const lawnTex = () => ct('lawn', 128, 128, (g, w, h) => {
  g.fillStyle = '#3f7a3a'; g.fillRect(0, 0, w, h);
  const R = rng(17); for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(120,170,90,0.35)' : 'rgba(30,70,30,0.3)'; g.fillRect(R() * w, R() * h, 1, 2 + R() * 3); }
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
  M.rock = toon('#9d9384');
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
function boulder(p, x, z, s, seed) {
  const R = rng(seed), m = mats();
  const b = sph(p, R() < 0.5 ? m.rock : m.rockL, s, x, YL + s * 0.25, z, 1.2 + R() * 0.4, 0.55 + R() * 0.2, 1 + R() * 0.3);
  b.rotation.y = R() * 6.28; b.castShadow = true;
  return b;
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

/* ---------------------------------------------------------------- the lot */
export function buildVilla(parent) {
  const m = mats();
  const root = grp(parent);
  root.name = 'villa';
  const g = grp(root, 0, 0, MZ); // garden + house, mirrored north-south
  g.scale.z = -1;
  const bins = makeBins(root);
  const R = rng(64);

  /* ---- ground: gravel under everything, the terrace in stone tiles, the lawn, the pond ---- */
  wbx(g, m.gravel, LX0, LX1, YL - 0.08, YL + 0.004, LZ0, LZ1, 1.5, { cast: false });
  wbx(g, m.tile, 14.6, 28.8, YL, YL + 0.03, 20.9, 22.62, 1.6, { cast: false }); // terrace along the house front
  wbx(g, m.tile, 14.6, 28.8, YL, YL + 0.03, 29.8, 30.7, 1.6, { cast: false }); // a strip round the back
  [[14.6, 15.8], [27.8, 28.8]].forEach(([a, b]) => wbx(g, m.tile, a, b, YL, YL + 0.03, 22.62, 29.8, 1.6, { cast: false }));
  bx(g, m.whiteW, 14.6, 28.8, YL, YL + 0.08, 20.84, 20.92, { cast: false }); // the terrace's edge kerb
  const lawn = groundShape(g, [[19.3, 15.25], [23.0, 15.05], [26.6, 15.3], [26.9, 17.5], [26.7, 20.55], [23.5, 20.7], [21.4, 20.6], [20.6, 19.4], [20.1, 18.3], [19.4, 17.2], [19.1, 16.2]], YL + 0.012, m.lawn, 2);
  // stepping stones from the gate to the front door
  {
    const path = new THREE.CatmullRomCurve3([V(24.3, 0, 20.6), V(23.7, 0, 19.6), V(23.0, 0, 18.7), V(22.5, 0, 17.7), V(21.7, 0, 16.8), V(20.5, 0, 16.4), V(19.2, 0, 16.6)]);
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = path.getPointAt(t);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 9), m.stone);
      st.scale.set(0.3 + R() * 0.08, 1, 0.24 + R() * 0.06); st.rotation.y = R() * 3; st.position.set(p.x + (R() - 0.5) * 0.12, YL + 0.03, p.z); st.receiveShadow = true; g.add(st);
      if (i % 3 === 1) pathLight(g, p.x + (i % 2 ? 0.55 : -0.55), p.z + 0.1);
    }
  }
  // the pond: a soft kidney shape, dark basin, clear water, lily pads, rocks round the rim, a stream lobe by the deck
  {
    const pts = [[15.2, 18.9], [16.6, 18.55], [18.0, 18.75], [19.2, 18.2], [19.9, 17.3], [20.6, 17.6], [20.7, 18.6], [21.1, 19.6], [20.6, 20.45], [18.8, 20.6], [16.9, 20.55], [15.4, 20.35], [14.95, 19.6]];
    groundShape(g, pts, YL + 0.006, toon('#2f5a5e', { lit: 0.05 }), 1);
    const water = groundShape(g, pts, YL + 0.075, new THREE.MeshToonMaterial({ map: waterTex(), transparent: true, opacity: 0.72, color: 0xffffff }), 2.5);
    water.mesh.userData.noLine = true; water.mesh.receiveShadow = false;
    reg.updaters.push((t) => { water.mesh.material.map.offset.set(Math.sin(t * 0.15) * 0.05, t * 0.01); });
    // rocks + pebbles round the rim, leaving the deck side open
    water.outline.forEach((p, i) => { if (i % 5) return; const s = 0.13 + R() * 0.12; boulder(g, p.x + (R() - 0.5) * 0.1, p.z + (R() - 0.5) * 0.1, s, 100 + i); });
    for (let i = 0; i < water.outline.length; i += 2) { const p = water.outline[i]; sph(g, m.rockL, 0.05 + R() * 0.03, p.x, YL + 0.04, p.z, 1.2, 0.6, 1); }
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
    ballLamp(g, 19.0, 15.6); ballLamp(g, 27.0, 19.0, 0.26); ballLamp(g, 14.9, 18.3, 0.2); ballLamp(g, 21.3, 18.9, 0.18); ballLamp(g, 26.2, 15.6, 0.2);
    // potted palms by the front door, a sculptural pot by the basin
    [[22.9, 21.7], [26.0, 21.7]].forEach(([x, z], i) => { const p = makeRhapisPot({ seed: 50 + i }); p.position.set(x, YL + 0.03, z); p.scale.setScalar(1.05); g.add(p); });
  }

  /* ---- the fence round the lot (world frame, not mirrored): white base + piers; metal bars on the street sides
     (north, west), slats on the private sides; the gate on Hoshizora-dori opens onto the terrace ---- */
  {
    const F = root;
    const base = (x0, x1, z0, z1, h) => wbx(F, m.white, x0, x1, 0.1, YL + h, z0, z1, 1, {});
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

  /* ---- the villa ---- */
  {
    const y0 = YL, y1 = YL + GF.h, y2 = y1 + UF.h;
    // ground floor: a white box opened to the garden; the living room behind the glass is hollow
    const liv = { x0: GF.x0 + 0.15, x1: 22.4, z0: GF.z0, z1: 26.4 };
    wbx(g, m.white, GF.x0, GF.x1, y0, y1, liv.z1, GF.z1, 1.5); // back half
    wbx(g, m.white, liv.x1, GF.x1, y0, y1, GF.z0 + 0.8, liv.z1, 1.5); // entrance / study block (the entrance is recessed)
    wbx(g, m.white, GF.x0, liv.x0, y0, y1, GF.z0, liv.z1, 1.5); // west end wall
    wbx(g, m.white, GF.x0, GF.x1, y1 - 0.42, y1, GF.z0, liv.z1, 1.5); // the band over the glass
    bx(g, m.fascia, GF.x0 - 0.05, GF.x1 + 0.05, y1 - 0.02, y1 + 0.12, GF.z0 - 0.05, GF.z1 + 0.05, { bevel: 0.01 }); // GF roof edge
    // the living room: floor, back wall, a sofa, rug, coffee table, a floor lamp, a plant, the warm light
    wbx(g, toon('#d9c4a4', { lit: 0.2 }), liv.x0, liv.x1, y0, y0 + 0.02, liv.z0, liv.z1, 1, { cast: false });
    bx(g, toon('#f2ece0', { lit: 0.25 }), liv.x0, liv.x1, y1 - 0.43, y1 - 0.42, liv.z0, liv.z1, { cast: false });
    bx(g, toon('#e9e2d4', { lit: 0.3 }), liv.x0, liv.x1, y0, y1 - 0.42, liv.z1 - 0.02, liv.z1, { cast: false });
    bx(g, m.cushion, 16.6, 20.2, y0, y0 + 0.42, 25.4, 26.2, { bevel: 0.05 }); bx(g, m.cushion, 16.6, 20.2, y0 + 0.42, y0 + 0.8, 25.95, 26.25, { bevel: 0.05 }); bx(g, m.cushion, 16.6, 17.4, y0, y0 + 0.42, 24.2, 25.4, { bevel: 0.05 });
    bx(g, toon('#9a8c7a'), 17.6, 20.4, y0 + 0.02, y0 + 0.03, 23.6, 25.2, { cast: false });
    cy(g, toon('#ece6da'), 18.7, y0, 24.4, 0.5, 0.36, 24); cy(g, toon('#2f3236'), 19.4, y0, 24.0, 0.35, 0.3, 20);
    cyl2(g, m.dark, [21.6, y0, 25.8], [21.6, y0 + 1.5, 25.8], 0.015, 5); sph(g, glow('#ffe0b0', 1.8), 0.15, 21.6, y0 + 1.55, 25.8);
    { const p = makeRhapisPot({ seed: 61 }); p.position.set(16.4, y0, 23.1); g.add(p); }
    plight(g, '#ffd9a8', 9, 9, 19.0, y1 - 0.7, 24.6, 'villa');
    // the glass wall: three big panes in thin dark frames, the middle one slid open
    {
      const zg = GF.z0 + 0.06, x0 = liv.x0 + 0.02, x1 = liv.x1, w = (x1 - x0) / 3, gh = y1 - 0.42 - y0;
      const glass = makeGlass(2.2, 2.9, 81, { alpha: 0.08, drops: 0.35, tint: 0xeaf4f6 });
      for (let k = 0; k < 3; k++) {
        const a = x0 + k * w - (k === 1 ? 0.0 : 0), z = k === 1 ? zg + 0.07 : zg;
        const xa = k === 1 ? a + w * 0.55 : a;
        bx(g, m.dark, xa, xa + w, y0, y0 + 0.04, z - 0.03, z + 0.03, { cast: false });
        bx(g, m.dark, xa, xa + w, y0 + gh - 0.04, y0 + gh, z - 0.03, z + 0.03, { cast: false });
        [xa, xa + w].forEach((x) => bx(g, m.dark, x - 0.025, x + 0.025, y0, y0 + gh, z - 0.03, z + 0.03, { cast: false }));
        const gp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, gh - 0.08), glass); gp.position.set(xa + w / 2, y0 + gh / 2, z); gp.userData.noLine = true; g.add(gp); reg.noRefl.push(gp);
      }
    }
    // a tall window in the west end wall (Hoshizora-dori side) into the living room
    bx(g, m.dark, GF.x0 - 0.03, GF.x0 + 0.01, y0 + 0.35, y1 - 0.6, 23.3, 25.5, { cast: false });
    pl(g, glow('#ffe3b8', 0.85, { cat: 'iza', off: '#7b8794' }), 2.1, y1 - 0.95 - y0 - 0.1, GF.x0 - 0.032, (y0 + 0.35 + y1 - 0.6) / 2, 24.4, -Math.PI / 2, 0);
    [24.4].forEach((z) => bx(g, m.dark, GF.x0 - 0.05, GF.x0 - 0.03, y0 + 0.35, y1 - 0.6, z - 0.02, z + 0.02, { cast: false }));
    // the entrance: recessed under a thin canopy, timber-clad walls, a tall pivot door, steps, wall lights
    {
      const ex0 = 22.6, ex1 = 25.7, ez = GF.z0 + 0.8;
      wbx(g, m.slat, ex0, ex1, y0, y1 - 0.42, ez - 0.04, ez, 1);
      wbx(g, m.slat, ex0, ex0 + 0.04, y0, y1 - 0.42, GF.z0, ez, 1); wbx(g, m.slat, ex1 - 0.04, ex1, y0, y1 - 0.42, GF.z0, ez, 1);
      wbx(g, m.white, ex1, GF.x1, y0, y1, GF.z0, ez, 1.5); // the white wall right of the entrance
      bx(g, toon('#7a5236', { lit: 0.08 }), 23.7, 24.9, y0, y0 + 2.6, ez - 0.07, ez - 0.04, { bevel: 0.01 }); // door
      bx(g, toon('#c9a24a'), 24.7, 24.74, y0 + 0.6, y0 + 1.9, ez - 0.12, ez - 0.07, { cast: false }); // long pull
      [y0 + 0.02, y0 + 0.14].forEach((yy, k) => bx(g, m.tile, 23.2 - k * 0.2, 25.4 + k * 0.2, YL - 0.0, yy + 0.06, GF.z0 - 0.3 - k * 0.3, ez - 0.04, { cast: false }));
      wbx(g, m.fascia, 22.4, 26.0, y1 - 0.5, y1 - 0.36, 21.2, GF.z0 + 0.05, 1); // canopy slab
      [23.3, 24.3, 25.2].forEach((x) => { cy(g, glow('#ffe8c8', 2.0, { off: '#e6e0d2' }), x, y1 - 0.515, 21.9, 0.05, 0.01, 12); halo(g, x, y1 - 0.6, 21.9, '#ffdcae', 0.9, 0.3); });
      [ex0 + 0.25, ex1 - 0.25].forEach((x) => { bx(g, m.dark, x - 0.04, x + 0.04, y0 + 1.6, y0 + 2.0, ez - 0.07, ez - 0.04, { cast: false }); bx(g, glow('#ffe2b8', 1.8, { off: '#cfc8b8' }), x - 0.03, x + 0.03, y0 + 1.62, y0 + 1.98, ez - 0.075, ez - 0.07, { cast: false }); });
      // a tall narrow window on the white wall to the right
      bx(g, m.dark, 26.4, 26.9, y0 + 0.4, y1 - 0.6, GF.z0 - 0.03, GF.z0 + 0.02, { cast: false });
      pl(g, glow('#ffe3b8', 0.9, { cat: 'iza', off: '#7b8794' }), 0.42, y1 - 1.08 - y0, 26.65, (y0 + 0.4 + y1 - 0.6) / 2, GF.z0 - 0.032, Math.PI, 0);
    }
    // upper storey: set back; a long window, a timber screen panel with a slit window, the roof terrace in front
    {
      wbx(g, m.white, UF.x0, UF.x1, y1, y2, UF.z0, UF.z1, 1.5);
      bx(g, m.fascia, UF.x0 - 0.08, UF.x1 + 0.08, y2 - 0.02, y2 + 0.16, UF.z0 - 0.08, UF.z1 + 0.08, { bevel: 0.01 });
      bx(g, toon('#c9cbc8'), UF.x0 + 0.1, UF.x1 - 0.1, y2 + 0.16, y2 + 0.2, UF.z0 + 0.1, UF.z1 - 0.1, { cast: false }); // roof
      // the long window across the front
      const wx0 = 18.6, wx1 = 23.4, wy0 = y1 + 0.35, wy1 = y2 - 0.45;
      bx(g, m.dark, wx0 - 0.05, wx1 + 0.05, wy0 - 0.05, wy1 + 0.05, UF.z0 - 0.03, UF.z0 + 0.01, { cast: false });
      pl(g, glow('#ffe6c4', 0.85, { cat: 'iza', off: '#7b8794' }), wx1 - wx0, wy1 - wy0, (wx0 + wx1) / 2, (wy0 + wy1) / 2, UF.z0 - 0.032, Math.PI, 0);
      const ug = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), makeGlass(4.8, 2.3, 82, { alpha: 0.12, drops: 0.3, tint: 0xeaf4f6 })); ug.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, UF.z0 - 0.04); ug.rotation.y = Math.PI; ug.userData.noLine = true; g.add(ug); reg.noRefl.push(ug);
      [20.2, 21.8].forEach((x) => bx(g, m.dark, x - 0.02, x + 0.02, wy0, wy1, UF.z0 - 0.05, UF.z0 - 0.02, { cast: false }));
      // the timber screen panel with a slit window
      wbx(g, m.slat, 23.9, UF.x1 + 0.02, y1 + 0.1, y2 - 0.05, UF.z0 - 0.08, UF.z0, 1);
      bx(g, m.dark, 26.6, 26.9, y1 + 0.4, y2 - 0.4, UF.z0 - 0.1, UF.z0 - 0.08, { cast: false });
      // side + back windows
      [[UF.x0, 24.5, 26.5, -1], [UF.x1, 25.0, 27.6, 1]].forEach(([x, z0, z1, s]) => { bx(g, m.dark, x + (s < 0 ? -0.03 : 0), x + (s < 0 ? 0 : 0.03), y1 + 0.5, y2 - 0.5, z0, z1, { cast: false }); pl(g, glow('#ffe3b8', 0.8, { cat: 'iza', off: '#7b8794' }), z1 - z0 - 0.1, y2 - y1 - 1.1, x + s * 0.032, (y1 + y2) / 2, (z0 + z1) / 2, s * Math.PI / 2, 0); });
      [[18.8, 22.0], [24.0, 26.8]].forEach(([x0, x1]) => { bx(g, m.dark, x0, x1, y1 + 0.6, y2 - 0.6, UF.z1, UF.z1 + 0.03, { cast: false }); pl(g, glow('#ffe3b8', 0.8, { cat: 'iza', off: '#7b8794' }), x1 - x0 - 0.1, y2 - y1 - 1.3, (x0 + x1) / 2, (y1 + y2) / 2, UF.z1 + 0.032, 0, 0); });
      [[17.0, 20.0], [22.8, 24.6]].forEach(([x0, x1]) => { bx(g, m.dark, x0, x1, y0 + 0.9, y1 - 0.6, GF.z1, GF.z1 + 0.03, { cast: false }); pl(g, glow('#ffe3b8', 0.8, { cat: 'iza', off: '#7b8794' }), x1 - x0 - 0.1, y1 - y0 - 1.6, (x0 + x1) / 2, (y0 + 0.9 + y1 - 0.6) / 2, GF.z1 + 0.032, 0, 0); });
      // the roof terrace on the ground floor roof: timber deck, glass railing with a slim cap, two loungers
      wbx(g, m.plank, GF.x0 + 0.1, UF.x0, y1 + 0.12, y1 + 0.16, GF.z0 + 0.1, GF.z1 - 0.1, 1.2, { cast: false });
      wbx(g, m.plank, UF.x0, GF.x1 - 0.1, y1 + 0.12, y1 + 0.16, GF.z0 + 0.1, UF.z0, 1.2, { cast: false });
      const rail = new THREE.MeshBasicMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      const glassRail = (x0, x1, z0, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); const p2 = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.95), rail); p2.position.set((x0 + x1) / 2, y1 + 0.62, (z0 + z1) / 2); p2.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); p2.userData.noLine = true; g.add(p2); cyl2(g, m.fascia, [x0, y1 + 1.1, z0], [x1, y1 + 1.1, z1], 0.025, 6); };
      glassRail(GF.x0 + 0.05, GF.x1 - 0.05, GF.z0 + 0.05, GF.z0 + 0.05); glassRail(GF.x0 + 0.05, GF.x0 + 0.05, GF.z0 + 0.05, GF.z1 - 0.05);
      [[16.4, 27.0], [16.4, 28.4]].forEach(([x, z]) => { bx(g, m.white, x - 0.32, x + 0.32, y1 + 0.16, y1 + 0.42, z - 0.9, z + 0.9, { bevel: 0.03 }); bx(g, m.cushion, x - 0.28, x + 0.28, y1 + 0.42, y1 + 0.5, z - 0.85, z + 0.85, { bevel: 0.03 }); });
      { const p = makeRhapisPot({ seed: 77 }); p.position.set(16.3, y1 + 0.16, 23.0); g.add(p); }
    }
    // the roofs and the canopy take petals / leaves / snow
    const roofs = (id, x0, x1, z0, z1, y, o = {}) => {
      const xc = (x0 + x1) / 2, half = (x1 - x0) / 2;
      return [
        { id: id + 'W', a: [xc, z1], b: [xc, z0], n: [-1, 0], D: half, y, drop: 0.02, w: { petal: 0.5, leaf: 0.5 }, snow: 0.14, ridge: true, ...o },
        { id: id + 'E', a: [xc, z0], b: [xc, z1], n: [1, 0], D: half, y, drop: 0.02, w: { petal: 0.5, leaf: 0.5 }, snow: 0.14, ridge: true, ...o },
      ];
    };
    (reg.extraRoofs ||= []).push(
      ...roofs('villaUp', UF.x0, UF.x1, MZ - UF.z1, MZ - UF.z0, y2 + 0.2),
      ...roofs('villaTerr', GF.x0 + 0.1, UF.x0, MZ - GF.z1 + 0.1, MZ - GF.z0 - 0.1, y1 + 0.16),
      { id: 'villaCanopy', a: [26.0, MZ - GF.z0], b: [22.4, MZ - GF.z0], n: [0, 1], D: GF.z0 - 21.2, y: y1 - 0.36, drop: 0.02, w: { petal: 0.4, leaf: 0.4 }, snow: 0.08 },
    );
    // nothing inside the ground floor takes snow (world z)
    noSnowBox(GF.x0 + 0.1, MZ - GF.z1 + 0.1, GF.x1 - 0.1, MZ - GF.z0 - 0.04, y1 - 0.1);
  }

  /* ---- rain: the paving, the stepping stones and the deck darken as they soak, shallow puddles shine on the
     terrace (the town's wetness / puddle levels, reg.groundU) ---- */
  {
    const base = [[m.tile, m.tile.color.clone()], [m.stone, m.stone.color.clone()], [m.plank, m.plank.color.clone()], [m.gravel, m.gravel.color.clone()]];
    const soft = ct('puddle', 128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const sheen = new THREE.MeshBasicMaterial({ color: 0x9fb6cc, alphaMap: soft, transparent: true, opacity: 0, depthWrite: false });
    const sky = new THREE.Color(0x9fb6cc), nightC = new THREE.Color(0x2c3a52);
    [[17.2, 21.6, 1.5, 0.45], [20.6, 21.4, 1.1, 0.35], [27.0, 21.8, 0.9, 0.4], [24.1, 22.2, 0.8, 0.3], [21.6, 30.2, 1.6, 0.35]].forEach(([x, z, w, d], i) => {
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
  root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });
  reg.villa = { lot: VILLA_LOT };
  return root;
}
