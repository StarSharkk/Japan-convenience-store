import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, rng } from '../core.js';
import { makeShrub, makeTree } from '../tree.js';
import { makePot } from '../plants/pottedPlants.js';
import { bicycle } from '../street.js';
import { rbx, win, acUnit, pipe } from './streetRow.js';
import { wetPass } from './shopkit.js';
import { WEST_HOMES, groundY } from './layout.js';
import { P, shade } from '../palette.js';
import { rockBatch, rockMat } from '../rocks.js';

/* ====================================================================================================
   西の住宅地 - four quiet south-facing houses in block west1 (between Kita-dori and Kaigan-dori), two by two on two
   terraces (layout.js WEST_HOMES). The north pair sits a step higher and is reached by a stepped stone path between
   the south pair (a 旗竿地 path) and a paved walk along their fronts; a low retaining wall with a slatted fence divides
   the two terraces. Ordinary Japanese homes at an ordinary scale, one family of parts, each with its own roof:

     1 (north-west)  a single-storey timber house: cream walls between light timber posts, a deep veranda (縁側) under
                     a wide low gable in brown-grey, big glazed sliding doors, a sliding lattice door to the genkan;
                     a small dry garden in front (rounded stones, low shrubs, a stool, pots)
     2 (north-east)  a 町家 / storehouse-style house, 1.5 storeys, coloured as the reference: charcoal boards below, a
                     cream band above with two white grille windows, a light grey standing-seam gable, a thin dark pent
                     eave, brown lattice windows and a lattice door; a wooden planter by the door
     3 (south-west)  the everyday family house: a low upper storey (half height) under a grey metal gable, cream lap
                     siding, a balcony with a dark slatted screen, a small canopy over the door; a breeze-block front
                     wall, a bicycle, a post box, a laundry pole and an AC unit at the back
     4 (south-east)  a minimal white house, the upper storey half height, few openings (a picture window, a dark door,
                     one small window upstairs); a wooden bench, pots and a young maple on the lawn
   Every roof's eaves face north and south (ridges east-west).
   Windows light (or not) in the evening with the town's houses (category 'iza').
   ==================================================================================================== */

const { yN: YN, yS: YS } = WEST_HOMES;

/* ---------------------------------------------------------------- textures */
const T = {};
const ct = (k, w, h, draw, o) => (T[k] ||= canvasTex(w, h, draw, o));
// roof covering with courses running along the eaves (house 1's hipped roof): rows every 0.25 m
const coursesTex = () => ct('whCourses', 128, 128, (g, w, h) => { g.fillStyle = P.roofTimber; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, y + 3, w, 2); } const R = rng(4); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(R() * w, ((R() * 4) | 0) * 32 + 5, 8 + R() * 20, 26); } }, { repeat: true });
// warm grey standing-seam metal, seams every 0.25 m running down the slope (houses 3 + 4)
const seamTex = () => ct('whSeam', 128, 128, (g, w, h) => { g.fillStyle = P.roofMetal; g.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 32) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(k, 0, 2, h); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(k + 2, 0, 2, h); } }, { repeat: true });
// dark vertical timber boards (house 2's lower walls): warm dark brown, not black
const boardTex = () => ct('whBoards', 256, 256, (g, w, h) => { const R = rng(12); for (let x = 0; x < w; x += 24) { const v = (R() * 8) | 0; g.fillStyle = `rgb(${44 + v},${42 + v},${41 + v})`; g.fillRect(x, 0, 24, h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 2, 0, 2, h); } }, { repeat: true }); // house 2: charcoal boards (the reference)
// house 2's light grey standing-seam roof (the reference): pale seams every ~0.33 m
const seamLTex = () => ct('whSeamL', 128, 128, (g, w, h) => { g.fillStyle = '#a2a6a8'; g.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 43) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(k, 0, 4, h); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(k + 4, 0, 3, h); } }, { repeat: true });
// cream lap siding (house 3): boards 0.2 m with a soft shadow line under each
const sidingTex = () => ct('whSiding', 128, 128, (g, w, h) => { g.fillStyle = P.cream; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 26) { g.fillStyle = 'rgba(120,100,80,0.18)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, y + 2, w, 1); } }, { repeat: true });
// light concrete slabs (paths, the walk, steps)
const slabTex = () => ct('whSlab', 128, 128, (g, w, h) => { const R = rng(21); g.fillStyle = shade(P.concrete, -0.15); g.fillRect(0, 0, w, h); [[0, 0, 128, 64], [0, 64, 128, 64]].forEach(([x, y, ww, hh]) => { const k = (R() - 0.5) * 0.06; g.fillStyle = shade(P.paveWalk, k); g.fillRect(x + 2, y + 2, ww - 4, hh - 4); }); for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '60,50,40'},0.05)`; g.fillRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 4); } }, { repeat: true });
// the openwork garden-wall block (花ブロック)
const breezeTex = () => ct('whBreeze', 128, 128, (g, w, h) => { g.fillStyle = P.creamD; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,80,66,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#5a554d'; [[32, 32], [96, 32], [32, 96], [96, 96]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 20, 11, ((x + y) % 128 ? 1 : -1) * Math.PI / 4, 0, 7); g.fill(); }); g.beginPath(); g.arc(64, 64, 9, 0, 7); g.fill(); });
const blockTex = () => ct('whBlock', 256, 128, (g, w, h) => { g.fillStyle = P.creamD; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(90,80,66,0.4)'; g.lineWidth = 3; for (let r = 0; r < 2; r++) { g.beginPath(); g.moveTo(0, r * 64 + 1); g.lineTo(w, r * 64 + 1); g.stroke(); for (let i = 0; i <= 2; i++) { const x = i * 128 + (r ? 64 : 0); g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); } } }, { repeat: true });
// a lattice (格子) glowing softly from inside (doors / windows)
const latticeTex = (k) => ct(`whLattice${k}`, 128, 128, (g, w, h) => { g.fillStyle = '#fff1d6'; g.fillRect(0, 0, w, h); g.fillStyle = k ? '#5a4434' : '#7a5a3c'; for (let x = 0; x < w; x += k ? 12 : 32) g.fillRect(x, 0, k ? 4 : 3, h); if (!k) for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3); });
const nameTex = (s) => ct(`whName${s}`, 64, 160, (g, w, h) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a5a3c'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#3a2a22'; g.font = `600 40px "Hiragino Mincho ProN", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; [...s].forEach((ch, i) => g.fillText(ch, w / 2, 48 + i * 60)); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.cream) return M;
  M.cream = toon(P.cream, { lit: 0.05 });
  M.creamD = toon(P.creamD, { lit: 0.04 });
  M.white = toon('#f3f0e8', { lit: 0.05 });
  M.timber = toon(P.woodL, { lit: 0.08 });
  M.timberM = toon(P.woodM, { lit: 0.06 });
  M.timberD = toon(P.woodD, { lit: 0.04 });
  M.ink = toon(P.ink);
  M.base = toon(shade(P.concrete, -0.1)); // foundations
  M.boards = toon('#ffffff', { map: boardTex(), nocache: true, lit: 0.03 });
  M.siding = toon('#ffffff', { map: sidingTex(), nocache: true, lit: 0.05 });
  M.courses = toon('#ffffff', { map: coursesTex(), nocache: true });
  M.seamL = toon('#ffffff', { map: seamLTex(), nocache: true });
  M.seam = toon('#ffffff', { map: seamTex(), nocache: true });
  M.slab = toon('#ffffff', { map: slabTex(), nocache: true });
  M.block = toon('#ffffff', { map: blockTex(), nocache: true });
  M.breeze = toon('#ffffff', { map: breezeTex(), nocache: true });
  M.gravel = toon(shade(P.stone, 0.08));
  M.fascia = toon(P.creamD);
  M.gutter = toon('#c3c2bc');
  M.ridge = toon(shade(P.slate, -0.3));
  M.metal = toon('#5a5f66');
  return M;
}

/* ---------------------------------------------------------------- geometry helpers */
/** a box mesh centred on the origin with UVs in metres / tile on every face */
function boxMesh(mat, w, h, d, tile = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
/**
 * a gable roof with its ridge along x over the wall box x0..x1, z0..z1 (wall plate at yTop): two thick slabs meeting
 * at the ridge, the gable triangles filled with `fill`, fascia + barge boards, gutters, a ridge cap; ovE / ovG: the
 * overhang at the eaves / the gables. Returns the ridge height and the slope data for the roof piles.
 */
function gable(p, x0, x1, z0, z1, yTop, rise, ovE, ovG, roof, fill, { th = 0.1, tile = 1, ridge, fascia, gutter = true } = {}) {
  const m = mats(), zr = (z0 + z1) / 2, half = (z1 - z0) / 2, a = Math.atan2(rise, half);
  const len = (half + ovE) / Math.cos(a), yR = yTop + rise + th / Math.cos(a), W = x1 - x0 + 2 * ovG;
  [1, -1].forEach((s) => {
    const q = grp(p, 0, yR, zr, 0); q.rotation.x = s * a;
    const slab = boxMesh(roof, W, th, len, tile); slab.position.set((x0 + x1) / 2, -th / 2, (s * len) / 2); q.add(slab);
    const e0 = s > 0 ? len - 0.04 : -len, e1 = s > 0 ? len : -len + 0.04;
    bx(q, fascia || m.fascia, x0 - ovG - 0.02, x1 + ovG + 0.02, -th - 0.08, 0.004, e0, e1, { cast: false }); // fascia
    [x0 - ovG - 0.02, x1 + ovG + 0.02].forEach((x) => bx(q, fascia || m.fascia, x - 0.03, x + 0.03, -th - 0.1, 0.015, s > 0 ? 0 : -len, s > 0 ? len : 0, { cast: false })); // barge boards
    if (gutter) cyl2(q, m.gutter, [x0 - ovG, -th - 0.05, s * (len + 0.05)], [x1 + ovG, -th - 0.05, s * (len + 0.05)], 0.045, 8);
  });
  bx(p, ridge || m.ridge, x0 - ovG - 0.04, x1 + ovG + 0.04, yR - 0.05, yR + 0.08, zr - 0.11, zr + 0.11, { bevel: 0.02 }); // ridge cap
  const sh = new THREE.Shape(); sh.moveTo(z0, 0); sh.lineTo(z1, 0); sh.lineTo(zr, rise); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); geo.translate(x1, yTop, 0); // shape x -> world z, extrusion -> x0 .. x1
  const prism = new THREE.Mesh(geo, fill); prism.castShadow = true; prism.receiveShadow = true; p.add(prism);
  return { yR, zr, half: half + ovE, drop: (half + ovE) * Math.tan(a), ta: Math.tan(a), xa: x0 - ovG, xb: x1 + ovG };
}
/** a window on an east (+x, s 1) or west (-x, s -1) wall at x: z0 .. z1 (see streetRow.js win for the options) */
function winX(p, x, s, z0, z1, y0, y1, o) {
  const q = grp(p, x, 0, 0, s * Math.PI / 2);
  win(q, 0, 1, s > 0 ? -z1 : z0, s > 0 ? -z0 : z1, y0, y1, o);
}
/** a door leaf on a south wall at z, x0 .. x1 (a frame, the leaf, a handle), optionally with a narrow glass slit */
function door(p, x0, x1, y0, y1, z, leaf, { slit = false, handle = 1 } = {}) {
  const m = mats();
  rbx(p, m.ink, x0 - 0.04, x1 + 0.04, y0, y1 + 0.04, z, z + 0.03, { r: 0.005 });
  rbx(p, leaf, x0, x1, y0, y1, z + 0.02, z + 0.06, { r: 0.006 });
  if (slit) pl(p, glow('#ffe6c0', 0.8, { cat: 'iza', off: '#9aa3a8' }), 0.08, (y1 - y0) * 0.75, x0 + (x1 - x0) * (handle > 0 ? 0.2 : 0.8), (y0 + y1) / 2, z + 0.062, 0, 0).userData.noLine = true;
  bx(p, toon('#c9c4b8'), (handle > 0 ? x1 - 0.1 : x0 + 0.06), (handle > 0 ? x1 - 0.06 : x0 + 0.1), y0 + 0.95, y0 + 1.15, z + 0.06, z + 0.09, { cast: false });
}
/** a small wall lamp facing +z with its halo */
function lamp(p, x, y, z, col = '#ffe2b0') {
  const m = mats();
  bx(p, m.ink, x - 0.07, x + 0.07, y - 0.12, y + 0.12, z, z + 0.1, { cast: false });
  bx(p, glow(col, 1.8, { cat: 'iza', off: '#d8d0c0' }), x - 0.05, x + 0.05, y - 0.09, y + 0.09, z + 0.1, z + 0.11, { cast: false });
  halo(p, x, y, z + 0.25, '#ffd9a0', 0.9, 0.38, 'iza');
}
const pot = (p, x, z, y, seed, r = 0.14, flower = null) => {
  const q = makePot({ r, h: r * 1.8, seed }).group; q.position.set(x, y, z); p.add(q);
  const sb = makeShrub({ seed: 600 + seed, width: r * 2.6, height: r * 2.4, palette: seed % 2 ? 'deep' : 'grey' }); sb.position.set(x, y + r * 1.6, z); p.add(sb);
  if (flower) for (let k = 0; k < 5; k++) sph(p, toon(flower), 0.03, x + Math.cos(k * 1.3) * r * 0.6, y + r * 2.9, z + Math.sin(k * 1.3) * r * 0.6);
};
const shrub = (p, x, z, y, seed, w = 0.6, h = 0.5, pal = 'deep') => { const sb = makeShrub({ seed, width: w, height: h, palette: pal }); sb.position.set(x, y, z); p.add(sb); return sb; };

/* ---------------------------------------------------------------- 1: the single-storey timber house (north-west) */
function house1(g, piles) {
  const m = mats(), y = YN, x0 = -46.2, x1 = -41.8, z0 = -9.4, z1 = -5.8, fl = y + 0.42, ye = y + 2.9;
  rbx(g, m.base, x0 - 0.04, x1 + 0.04, y - 0.1, fl, z0 - 0.04, z1, { r: 0.02, cast: false }); // the foundation
  rbx(g, m.cream, x0, x1, fl, ye, z0, z1, { r: 0.02 });
  // light timber frame on the walls (真壁): corner + bay posts, the sill and head beams on the front
  const posts = [x0, -44.8, -43.3, x1];
  posts.forEach((x) => rbx(g, m.timber, x - 0.07, x + 0.07, fl, ye, z1 - 0.02, z1 + 0.06, { r: 0.01 }));
  [x0, x1].forEach((x) => [z0, (z0 + z1) / 2].forEach((z) => rbx(g, m.timber, x - 0.06, x + 0.06, fl, ye, z - 0.06, z + 0.06, { r: 0.01 })));
  rbx(g, m.timber, x0 - 0.05, x1 + 0.05, ye - 0.22, ye - 0.08, z1 - 0.02, z1 + 0.07, { r: 0.01 }); // head beam
  rbx(g, m.timber, x0 - 0.05, x1 + 0.05, fl - 0.04, fl + 0.06, z1 - 0.02, z1 + 0.07, { r: 0.01 }); // sill
  // bay 1: the genkan's sliding lattice door + a lit transom; bays 2-3: glazed sliding doors onto the veranda
  rbx(g, m.timberD, -46.0, -45.0, fl + 0.02, fl + 1.95, z1, z1 + 0.03, { r: 0.005 });
  pl(g, glow('#ffe9c4', 0.8, { cat: 'iza', off: '#cbbd9f', map: latticeTex(0) }), 0.86, 1.8, -45.5, fl + 0.98, z1 + 0.034, 0, 0).userData.noLine = true;
  rbx(g, m.timber, -46.12, -44.88, fl + 1.97, fl + 2.03, z1, z1 + 0.05, { r: 0.004 });
  win(g, z1, 1, -44.68, -43.42, fl + 0.05, fl + 1.95, { mull: 1, frame: m.timberD, inner: 'curtain', sill: false });
  win(g, z1, 1, -43.18, -41.92, fl + 0.05, fl + 1.95, { mull: 1, frame: m.timberD, inner: 'curtain', sill: false });
  pl(g, new THREE.MeshBasicMaterial({ map: nameTex('松本') }), 0.1, 0.25, -46.1, fl + 1.45, z1 + 0.07, 0, 0).userData.noLine = true;
  lamp(g, -44.9, fl + 1.85, z1 + 0.06);
  // the sides + the back: small windows (west: the kitchen, east: a bedroom, back: the bath)
  winX(g, x0, -1, -8.4, -7.2, fl + 0.9, fl + 1.8, { mull: 1, inner: 'curtain' });
  winX(g, x1, 1, -8.6, -7.0, fl + 0.8, fl + 1.8, { mull: 1, inner: 'curtain' });
  win(g, z0, -1, -44.4, -43.4, fl + 1.2, fl + 1.8, { inner: 'blind' });
  acUnit(g, -42.4, y, z0, -1);
  // the veranda (縁側) along the front: a deck on low posts, the eave posts, a stone step (沓脱石)
  rbx(g, m.timber, -44.85, x1 + 0.1, fl - 0.08, fl, z1, z1 + 0.75, { r: 0.01, tile: 0.5 }); // (the genkan bay stays open)
  for (let x = -44.75; x < x1; x += 1.0) rbx(g, m.timberD, x - 0.05, x + 0.05, y, fl - 0.08, z1 + 0.6, z1 + 0.7, { r: 0.006, cast: false });
  const ta = 0.85 / ((z1 - z0) / 2); // the roof pitch below (the eave posts stop under its soffit)
  [x0 - 0.05, -44.85, x1 + 0.05].forEach((x) => rbx(g, m.timber, x - 0.06, x + 0.06, y, ye - 0.96 * ta, z1 + 0.84, z1 + 0.96, { r: 0.01 }));
  rbx(g, toon(shade(P.stone, -0.05)), -44.2, -43.4, y, y + 0.22, z1 + 0.8, z1 + 1.2, { r: 0.05 });
  rbx(g, toon(shade(P.stone, -0.05)), -45.85, -45.15, y, y + 0.2, z1 + 0.1, z1 + 0.5, { r: 0.05 }); // the genkan step
  // the wide low gable (eaves north + south): deep eaves over the veranda, brown-grey (palette roofTimber)
  const r = gable(g, x0, x1, z0, z1, ye, 0.85, 1.05, 0.6, M.courses, m.cream, { tile: 1, fascia: m.timber, ridge: toon(shade(P.roofTimber, -0.25)) });
  [r.xa - 0.04, r.xb + 0.04].forEach((x) => cyl2(g, toon(shade(P.roofTimber, -0.3)), [x, r.yR + 0.02, r.zr - 0.14], [x, r.yR + 0.02, r.zr + 0.14], 0.11, 10)); // the ridge-end rolls
  piles.push(
    { id: 'wh1s', a: [r.xb, r.zr], b: [r.xa, r.zr], n: [0, 1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.6, leaf: 0.5 }, snow: 0.16, ridge: true },
    { id: 'wh1n', a: [r.xa, r.zr], b: [r.xb, r.zr], n: [0, -1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.6, leaf: 0.5 }, snow: 0.16, ridge: true },
  );
  // the small dry garden: rounded stones in a gravel bed, low shrubs, a stool, pots
  rbx(g, M.gravel, -43.2, -41.3, y - 0.02, y + 0.03, -4.55, -3.6, { r: 0.01, cast: false });
  {
    // a main stone with a low flat one and a half-buried one beside it (a 三尊 group in miniature), pebbles in the
    // gravel, a mossy stone under the shrub by the gate
    const B = rockBatch(g, rockMat({ moss: 0.8, tint: '#f7f4ee' }), { name: 'DryGardenRocks' });
    B.add('medium', 0, -42.9, y, -4.2, 0.27, { ry: 0.6, sink: 0.18, sq: [1, 1.1, 0.9] });
    B.add('flat', 1, -42.38, y, -3.92, 0.2, { ry: 2.1, sink: 0.3 });
    B.add('embedded', 0, -41.78, y, -4.3, 0.2, { ry: 4.0, sink: 0.38 });
    [[-42.6, -4.48, 0.05], [-42.05, -4.05, 0.045], [-41.55, -3.82, 0.04]].forEach(([x, z, r], i) => B.add('pebble', i, x, y, z, r, { ry: i * 2, sink: 0.3 }));
    B.add('mossy', 1, -46.4, y, -4.1, 0.3, { ry: 1.3, sink: 0.25 });
    B.flush();
  }
  shrub(g, -41.6, -3.75, y, 701, 0.55, 0.45); shrub(g, -46.5, -4.6, y, 702, 0.7, 0.55, 'grey');
  { const b = grp(g, -44.2, y, -3.8, 0); rbx(b, m.timberM, -0.45, 0.45, 0.36, 0.42, -0.15, 0.15, { r: 0.01 }); [-0.36, 0.36].forEach((a) => rbx(b, m.timberD, a - 0.04, a + 0.04, 0, 0.36, -0.12, 0.12, { r: 0.005, cast: false })); }
  pot(g, -45.0, -3.65, y, 11, 0.12, '#f3a8be'); pot(g, -42.25, -5.2, fl, 12, 0.1);
}

/* ---------------------------------------------------------------- 2: the machiya-style house (north-east) */
function house2(g, piles) {
  const m = mats(), y = YN, x0 = -39.2, x1 = -35.2, z0 = -9.4, z1 = -5.4, b = y + 0.3, mid = y + 2.45, top = y + 4.0;
  // colours as the reference: charcoal boards, a cream band, a pale grey seamed roof, brown lattice timber
  const char = toon('#3a3837'), brown = toon('#8a5f3c', { lit: 0.06 });
  rbx(g, char, x0 - 0.05, x1 + 0.05, y - 0.1, b, z0 - 0.05, z1 + 0.05, { r: 0.02, cast: false }); // the base
  rbx(g, m.boards, x0, x1, b, mid, z0, z1, { r: 0.015, tile: 1.2 });
  rbx(g, m.cream, x0, x1, mid, top, z0, z1, { r: 0.015 });
  // the steep standing-seam gable along the street (eaves north + south)
  const r = gable(g, x0, x1, z0, z1, top, 1.5, 0.42, 0.38, M.seamL, m.cream, { tile: 1, fascia: m.cream, ridge: toon('#8e9395') });
  piles.push(
    { id: 'wh2s', a: [r.xb, r.zr], b: [r.xa, r.zr], n: [0, 1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.6, leaf: 0.5 }, snow: 0.18, ridge: true },
    { id: 'wh2n', a: [r.xa, r.zr], b: [r.xb, r.zr], n: [0, -1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.6, leaf: 0.5 }, snow: 0.18, ridge: true },
  );
  // the thin dark pent eave (庇) across the front, on small brackets
  { const d = 0.55, y0 = mid + 0.02, y1 = mid - 0.16, L = Math.hypot(d, y0 - y1), e = boxMesh(toon('#3b3b3d'), x1 - x0 + 0.3, 0.05, L, 1); e.position.set((x0 + x1) / 2, (y0 + y1) / 2, z1 + d / 2); e.rotation.x = Math.atan2(y0 - y1, d); g.add(e);
    for (let x = x0 + 0.2; x < x1; x += 0.9) bx(g, toon('#3b3b3d'), x - 0.02, x + 0.02, y1 - 0.12, y0 - 0.7 * (y0 - y1) - 0.05, z1, z1 + d * 0.7, { cast: false }); // under the eave
    piles.push({ id: 'wh2e', a: [x1 + 0.15, z1], b: [x0 - 0.15, z1], n: [0, 1], D: d, y: y0 + 0.03, drop: y0 - y1, w: { petal: 0.4, leaf: 0.4 }, snow: 0.1 }); }
  // ground floor: a fine lattice window (千本格子) on the left, the sliding lattice doors in the middle, a small window
  pl(g, glow('#ffe6c0', 0.85, { cat: 'iza', off: '#b8ab92', map: latticeTex(1) }), 1.2, 1.15, -38.35, b + 1.15, z1 + 0.012, 0, 0).userData.noLine = true;
  [b + 0.5, b + 1.74].forEach((yy) => rbx(g, brown, -39.0, -37.7, yy, yy + 0.06, z1, z1 + 0.06, { r: 0.004 })); [-39.0, -37.76].forEach((xx) => rbx(g, brown, xx, xx + 0.06, b + 0.5, b + 1.8, z1, z1 + 0.06, { r: 0.004 }));
  rbx(g, brown, -37.55, -36.25, b, b + 2.0, z1, z1 + 0.03, { r: 0.005 });
  [-37.22, -36.58].forEach((x) => pl(g, glow('#ffe9c4', 0.8, { cat: 'iza', off: '#c8bca4', map: latticeTex(0) }), 0.56, 1.85, x, b + 1.0, z1 + 0.034, 0, 0).userData.noLine = true);
  rbx(g, toon(shade(P.stone, -0.05)), -37.7, -36.1, y, b, z1 + 0.05, z1 + 0.55, { r: 0.03 }); // the step
  lamp(g, -35.85, b + 1.75, z1); // the door lamp
  pl(g, new THREE.MeshBasicMaterial({ map: nameTex('藤井') }), 0.1, 0.25, -37.63, b + 1.35, z1 + 0.032, 0, 0).userData.noLine = true;
  win(g, z1, 1, -35.95, -35.45, b + 0.9, b + 1.6, { inner: 'curtain', frame: brown, sill: false });
  // upstairs (cream): two small grille windows, white frames + white bars over a pale ground (the reference)
  [[-38.55, -37.55], [-36.85, -35.85]].forEach(([a, c]) => {
    rbx(g, m.white, a - 0.06, c + 0.06, mid + 0.55, mid + 1.03, z1, z1 + 0.05, { r: 0.008 });
    pl(g, glow('#ffe3b8', 0.7, { cat: 'iza', off: '#c9c8c2' }), c - a, 0.36, (a + c) / 2, mid + 0.79, z1 + 0.052, 0, 0).userData.noLine = true;
    for (let x = a + 0.08; x < c; x += 0.11) bx(g, m.white, x - 0.018, x + 0.018, mid + 0.61, mid + 0.97, z1 + 0.055, z1 + 0.078, { cast: false });
  });
  winX(g, x1, 1, -8.4, -7.4, b + 0.9, b + 1.7, { inner: 'curtain', frame: brown });
  { const q = grp(g, x0 - 0.012, 0, -6.6, -Math.PI / 2); pl(q, glow('#ffe6c0', 0.8, { cat: 'iza', off: '#b8ab92', map: latticeTex(1) }), 0.5, 0.75, 0, b + 1.25, 0, 0, 0).userData.noLine = true; rbx(q, brown, -0.3, 0.3, b + 0.82, b + 1.68, -0.02, 0.02, { r: 0.004 }); } // the small lattice window on the west side
  // the front: a wooden planter with a clipped shrub by the door (the reference)
  { const x = -35.55, z = -4.95; rbx(g, brown, x - 0.3, x + 0.3, y, y + 0.28, z - 0.17, z + 0.17, { r: 0.012 }); shrub(g, x, z, y + 0.22, 712, 0.5, 0.45, 'deep'); }
  shrub(g, -34.95, -8.8, y, 711, 0.6, 0.7, 'teal');
}

/* ---------------------------------------------------------------- 3: the family house (south-west) */
function house3(g, piles) {
  const m = mats(), y = YS, x0 = -46.3, x1 = -42.1, z0 = -0.7, z1 = 3.0, g1 = y + 2.75, top = g1 + 1.25; // the upper storey: half height
  rbx(g, m.base, x0 - 0.03, x1 + 0.03, y - 0.1, y + 0.3, z0 - 0.03, z1 + 0.03, { r: 0.015, cast: false });
  rbx(g, m.siding, x0, x1, y + 0.3, top, z0, z1, { r: 0.015, tile: 1 });
  rbx(g, m.white, x0 - 0.04, x1 + 0.04, g1 - 0.05, g1 + 0.05, z0 - 0.04, z1 + 0.04, { r: 0.01 }); // floor band
  const r = gable(g, x0, x1, z0, z1, top, 1.2, 0.45, 0.35, M.seam, m.siding, { tile: 1, ridge: toon(shade(P.roofMetal, -0.2)) });
  piles.push(
    { id: 'wh3s', a: [r.xb, r.zr], b: [r.xa, r.zr], n: [0, 1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { leaf: 0.5 }, snow: 0.16, ridge: true },
    { id: 'wh3n', a: [r.xa, r.zr], b: [r.xb, r.zr], n: [0, -1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { leaf: 0.5 }, snow: 0.16, ridge: true },
  );
  // ground floor: the living-room window (left), the front door with its canopy (right)
  win(g, z1, 1, -45.9, -44.2, y + 0.75, y + 2.25, { mull: 1, inner: 'curtain' });
  door(g, -43.15, -42.45, y + 0.3, y + 2.35, z1, m.timberM, { slit: true, handle: -1 });
  rbx(g, m.ink, -43.45, -42.15, y + 2.5, y + 2.58, z1, z1 + 0.75, { r: 0.012 }); // the canopy
  lamp(g, -43.4, y + 2.0, z1 + 0.03);
  rbx(g, m.base, -43.4, -42.2, y, y + 0.3, z1, z1 + 0.5, { r: 0.02 }); rbx(g, m.base, -43.3, -42.3, y, y + 0.15, z1 + 0.5, z1 + 0.85, { r: 0.02 }); // the porch + step
  win(g, z1, 1, -43.95, -43.55, y + 1.2, y + 2.1, { inner: 'blind' });
  // upstairs: the balcony (dark slatted screen, a white rail) in front of a French window, a small window
  { const a = -46.05, c = -43.75, d = 0.72, yb = g1 + 0.02;
    win(g, z1, 1, -45.6, -44.2, yb + 0.05, yb + 1.0, { mull: 1, inner: 'curtain', sill: false });
    rbx(g, m.white, a, c, yb - 0.14, yb, z1, z1 + d, { r: 0.01 });
    for (let x = a + 0.06; x < c; x += 0.09) rbx(g, m.timberD, x - 0.025, x + 0.025, yb, yb + 0.55, z1 + d - 0.06, z1 + d - 0.02, { r: 0.004, cast: false });
    [a, c].forEach((x) => rbx(g, m.white, x - 0.04, x + 0.04, yb, yb + 0.61, z1, z1 + d, { r: 0.006 }));
    rbx(g, m.white, a - 0.04, c + 0.04, yb + 0.55, yb + 0.61, z1 + d - 0.08, z1 + d, { r: 0.006 });
    piles.push({ id: 'wh3b', a: [c, z1], b: [a, z1], n: [0, 1], D: d - 0.08, y: yb + 0.01, drop: 0.01, w: { leaf: 0.3 }, snow: 0.06 }); }
  win(g, z1, 1, -43.3, -42.4, g1 + 0.3, g1 + 0.95, { inner: 'curtain' });
  // the sides + back: windows, the AC unit, a downpipe, the laundry pole in the back garden
  winX(g, x0, -1, 0.2, 1.4, y + 1.0, y + 2.0, { mull: 1, inner: 'curtain' });
  winX(g, x0, -1, 0.4, 1.2, g1 + 0.3, g1 + 0.95, { inner: 'curtain' });
  winX(g, x1, 1, -0.2, 0.6, g1 + 0.3, g1 + 0.9, { inner: 'blind' });
  win(g, z0, -1, -45.4, -44.2, y + 1.0, y + 2.0, { mull: 1, inner: 'curtain' });
  win(g, z0, -1, -45.4, -44.4, g1 + 0.3, g1 + 0.9, { inner: 'curtain' });
  acUnit(g, -41.85, y, 1.2, 1);
  pipe(g, x1 + 0.06, z1 - 0.12, y, top);
  { const px = [-45.6, -43.4], z = -1.45; px.forEach((x) => { cy(g, M.metal, x, y, z, 0.03, 1.75, 8); cyl2(g, M.metal, [x - 0.3, y + 1.7, z], [x + 0.3, y + 1.7, z], 0.02, 5); });
    [-0.22, 0.22].forEach((dz) => cyl2(g, toon('#c9c7c0'), [px[0], y + 1.68, z + dz], [px[1], y + 1.68, z + dz], 0.015, 5));
    [['#f2efe6', -45.2, 0.55], ['#8fb3d9', -44.55, 0.45], ['#f2efe6', -44.0, 0.5]].forEach(([c, x, h]) => { const t = pl(g, toon(c, { side: THREE.DoubleSide }), 0.42, h, x, y + 1.68 - h / 2, z + 0.22, 0, 0); t.userData.noLine = true; }); }
  // the front: a breeze-block wall with a cap, open by the door, a post box, the bicycle, pots, a shrub
  { const zw = 5.0, yb = y, hw = 0.62;
    [[-46.85, -43.6]].forEach(([a, c]) => { rbx(g, M.block, a, c, yb - 0.1, yb + 0.2, zw - 0.08, zw + 0.08, { r: 0.01, tile: 0.4 }); rbx(g, M.breeze, a, c, yb + 0.2, yb + hw - 0.06, zw - 0.07, zw + 0.07, { r: 0.004, tile: 0.4 }); rbx(g, m.creamD, a - 0.02, c + 0.02, yb + hw - 0.06, yb + hw, zw - 0.09, zw + 0.09, { r: 0.01 }); });
    rbx(g, M.block, -46.95, -46.79, yb - 0.1, yb + hw, -0.6, zw, { r: 0.01, tile: 0.4 }); // the west side wall
    { const x = -43.45, q = grp(g, x, yb, zw - 0.15, 0); cy(q, M.metal, 0, 0, 0, 0.03, 0.95, 8); rbx(q, toon('#9a3a32'), -0.17, 0.17, 0.95, 1.25, -0.12, 0.12, { r: 0.02 }); bx(q, toon('#e8e2d4'), -0.1, 0.1, 1.12, 1.16, 0.12, 0.13, { cast: false }); } }
  rbx(g, M.slab, -43.5, -42.1, y - 0.01, y + 0.02, z1 + 0.85, 5.05, { r: 0.005, cast: false, tile: 0.8 }); // the drive / walk to the door
  bicycle(grp(g, 0, y - 0.15, 0), -44.6, 4.45, Math.PI / 2 + 0.08, '#6c8a3a', 0.12);
  pot(g, -42.25, 3.2, y, 31, 0.14, '#f2d23a'); pot(g, -46.45, 4.55, y, 32, 0.16);
  shrub(g, -46.4, 3.5, y, 721, 0.7, 0.6); shrub(g, -45.0, 4.65, y, 722, 0.5, 0.42, 'grey');
}

/* ---------------------------------------------------------------- 4: the minimal white house (south-east) */
function house4(g, piles) {
  const m = mats(), y = YS, x0 = -39.1, x1 = -35.6, z0 = -0.6, z1 = 3.2, g1 = y + 2.75, top = g1 + 1.25; // the upper storey: half height
  rbx(g, m.base, x0 - 0.02, x1 + 0.02, y - 0.1, y + 0.22, z0 - 0.02, z1 + 0.02, { r: 0.01, cast: false });
  rbx(g, m.white, x0, x1, y + 0.22, top, z0, z1, { r: 0.012 });
  // a simple gable with its eaves north + south, thin white edges
  const xc = (x0 + x1) / 2;
  const r = gable(g, x0, x1, z0, z1, top, 1.15, 0.25, 0.22, M.seam, m.white, { tile: 1, ridge: toon(shade(P.roofMetal, -0.2)), fascia: m.white });
  piles.push(
    { id: 'wh4s', a: [r.xb, r.zr], b: [r.xa, r.zr], n: [0, 1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { leaf: 0.5 }, snow: 0.16, ridge: true },
    { id: 'wh4n', a: [r.xa, r.zr], b: [r.xb, r.zr], n: [0, -1], D: r.half, y: r.yR + 0.05, drop: r.drop, w: { leaf: 0.5 }, snow: 0.16, ridge: true },
  );
  // the front: a picture window, a dark door with a slit of glass, one small window upstairs, a vent in the gable
  win(g, z1, 1, -38.8, -37.05, y + 0.45, y + 2.3, { mull: 1, inner: 'curtain', sill: false });
  door(g, -36.55, -35.95, y + 0.22, y + 2.3, z1, toon(P.inkSoft), { slit: true, handle: -1 });
  { const yd = y + 2.45; bx(g, m.ink, -36.6, -35.9, yd, yd + 0.04, z1, z1 + 0.3, { cast: false }); halo(g, -36.25, yd - 0.1, z1 + 0.3, '#ffd9a0', 0.9, 0.35, 'iza'); bx(g, glow('#ffe2b0', 1.6, { cat: 'iza', off: '#d8d0c0' }), -36.3, -36.2, yd - 0.01, yd, z1 + 0.13, z1 + 0.23, { cast: false }); }
  win(g, z1, 1, -37.75, -36.95, g1 + 0.25, g1 + 0.9, { inner: 'curtain', sill: false });
  [x0, x1].forEach((x) => bx(g, toon(shade(P.creamD, -0.1)), x + (x < xc ? -0.03 : 0), x + (x < xc ? 0 : 0.03), top + 0.45, top + 0.6, r.zr - 0.18, r.zr + 0.18, { cast: false })); // gable vents
  // the sides: a tall slit window each, a small one at the back; the AC unit on the east
  winX(g, x0, -1, 0.6, 0.95, y + 0.9, g1 + 0.9, { inner: 'blind', sill: false });
  winX(g, x1, 1, 1.4, 1.75, g1 + 0.15, g1 + 0.95, { inner: 'curtain', sill: false });
  win(g, z0, -1, -38.2, -37.4, y + 1.2, y + 1.9, { inner: 'blind', sill: false });
  acUnit(g, -35.35, y, 0.4, 1);
  // the front garden: a concrete step, slabs to the pavement, a long low bench under the window, pots, a young maple
  rbx(g, M.slab, -36.6, -35.9, y, y + 0.14, z1, z1 + 0.42, { r: 0.02, tile: 0.8 });
  [3.9, 4.55].forEach((z) => rbx(g, M.slab, -36.65, -35.85, y - 0.01, y + 0.03, z - 0.22, z + 0.22, { r: 0.01, cast: false, tile: 0.8 }));
  { const b = grp(g, -37.9, y, 3.65, 0); rbx(b, m.timber, -0.8, 0.8, 0.38, 0.44, -0.16, 0.16, { r: 0.012, tile: 0.5 }); [-0.68, 0.68].forEach((a) => rbx(b, m.timberD, a - 0.05, a + 0.05, 0, 0.38, -0.13, 0.13, { r: 0.006, cast: false })); }
  pot(g, -35.45, 3.45, y, 41, 0.15); pot(g, -38.55, 3.65, y + 0.44, 42, 0.08, '#e8674f');
  { const t = makeTree({ seed: 241, height: 2.1, spread: 0.8, palette: 'maple', dens: 0.9, leafScale: 0.5, lean: 0.06 }); t.position.set(-38.75, y, 4.5); t.rotation.y = 0.6; g.add(t); }
  shrub(g, -35.0, 4.6, y, 731, 0.55, 0.42, 'grey'); shrub(g, -39.5, 2.0, y, 732, 0.5, 0.55);
}

/* ---------------------------------------------------------------- the block: walks, the wall between the terraces, boundaries */
export function buildWestHomes(parent) {
  const m = mats();
  const g = grp(parent);
  g.name = 'westHomes';
  const piles = [];
  house1(g, piles); house2(g, piles); house3(g, piles); house4(g, piles);
  (reg.extraRoofs ||= []).push(...piles); // the roofs, the pent eave and the balcony take leaves / petals / snow

  const [px0, px1] = WEST_HOMES.path, [zw0, zw1] = WEST_HOMES.zWall;
  /* ---- the retaining wall between the terraces (it hides the step in the ground), a slatted fence on it ---- */
  [[-46.95, px0], [px1, -34.45]].forEach(([a, c]) => {
    rbx(g, M.block, a, c, YS - 0.08, YN + 0.06, zw0, zw1, { r: 0.012, tile: 0.4 });
    rbx(g, m.creamD, a - 0.02, c + 0.02, YN + 0.06, YN + 0.11, zw0 - 0.02, zw0 + 0.14, { r: 0.01 });
    for (let x = a + 0.08; x < c - 0.05; x += 0.16) rbx(g, m.timberM, x - 0.05, x + 0.05, YN + 0.11, YN + 0.85, zw0 + 0.04, zw0 + 0.08, { r: 0.004, cast: false });
    [YN + 0.3, YN + 0.7].forEach((yy) => rbx(g, m.timberD, a, c, yy, yy + 0.05, zw0 + 0.08, zw0 + 0.11, { r: 0.004, cast: false }));
  });
  /* ---- the stepped path from Kaigan-dori up between the south pair, the walk along the north pair's fronts ---- */
  const slab = (x0, x1, z0, z1, y, h = 0.04) => rbx(g, M.slab, x0, x1, y - 0.02, y + h, z0, z1, { r: 0.01, cast: false, tile: 0.8 });
  for (let k = 0; k < 10; k++) { const zm = -1.07 + k * 0.655; slab(px0 + 0.12, px1 - 0.12, zm - 0.25, zm + 0.25, groundY((px0 + px1) / 2, zm)); }
  const rise = (YN - YS) / 3;
  [[-1.7, -1.4, 1], [-2.0, -1.7, 2], [zw0, -2.0, 3]].forEach(([z0, z1, k]) => rbx(g, M.slab, px0 + 0.05, px1 - 0.05, YS - 0.06, YS + rise * k, z0, z1, { r: 0.012, tile: 0.8 }));
  [px0 - 0.02, px1 + 0.02].forEach((x) => rbx(g, M.block, x - 0.06, x + 0.06, YS - 0.06, YN + 0.06, zw0, -1.3, { r: 0.01, tile: 0.4 })); // the cheeks of the steps
  slab(-46.3, -35.0, -3.35, zw0, YN); // the walk
  [[-45.5, -3.85], [-45.5, -4.45], [-45.5, -5.05], [-43.8, -4.05]].forEach(([x, z]) => slab(x - 0.28, x + 0.28, z - 0.2, z + 0.2, YN, 0.05)); // to house 1's genkan + veranda
  slab(-37.5, -36.3, -4.8, -3.35, YN); // to house 2's door
  /* ---- boundaries: a block wall on Kita-dori, a hedge between the north pair, low hedges on the west edge ---- */
  rbx(g, M.block, -46.9, -33.5, YN - 0.1, YN + 0.85, -10.45, -10.3, { r: 0.01, tile: 0.4 });
  rbx(g, m.creamD, -46.92, -33.48, YN + 0.85, YN + 0.9, -10.47, -10.28, { r: 0.01 });
  for (let z = -9.7; z < -6.2; z += 0.85) shrub(g, -40.4, z, YN, 760 + Math.round(z * 10), 0.65, 0.6, 'deep'); // behind the front walls only
  for (let z = -9.6; z < -5.2; z += 1.1) shrub(g, -46.6, z, YN, 770 + Math.round(z * 10), 0.7, 0.65, 'grey');
  for (let z = -1.6; z < 2.4; z += 1.0) shrub(g, -34.75, z, YS, 780 + Math.round(z * 10), 0.6, 0.55, 'teal');
  /* (power: the service drops come from the network in town/power.js) */

  wetPass([M.slab, M.gravel, m.timber]);
  reg.westHomes = { g };
  return g;
}
