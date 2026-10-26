import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, noSnowBox } from '../core.js';
import { makeGlass } from '../fx.js';
import { makeShrub, SEASON_U } from '../tree.js';
import { makeFicusPot } from '../plants/pottedPlants.js';
import { spineTex } from './shopkit.js';
import { P } from '../palette.js';

/* ====================================================================================================
   星野邸 - the house of the large residence (town/villa.js): a low one-storey Japanese modern courtyard house.
   Modelled in villa.js's garden frame (garden in front at z 14 .. 21, house behind; the whole group is mirrored
   north-south so the house stands along Kaigan-dori). Everything that has to read in world space - text plates,
   snow / rain boxes, roof piles, the camera zone - is placed with z_world = MZ - z.

     plan     an L wrapping the garden: the long back wing (x 15.6 .. 28.6, z 24.6 .. 29.9) with the entrance +
              bedroom (A), the slightly taller living room (B) and the kitchen (C); the short east wing (D, dining,
              z 21.3 .. 24.6) turns forward; the timber deck sits in the L's inner corner
     walls    warm white plaster with a soft grain, light oak vertical slats in places, a pale stone plinth (the floor
              is 0.3 m up); every box has small rounded edges
     roofs    thin, almost flat, at three heights (B highest); dark grey metal edges, a gutter, downpipes, oak soffits
              under the deep eaves over the glass and the deck
     glass    the living room opens to the deck with four tall sliding panes; the dining room to the deck too; the
              side and back faces get long low windows and narrow tall ones (slim dark grey frames)
     entrance a recessed porch at the west end: oak door with a slim glass side light, stone landing and steps,
              the name plate, the bell, a post box, a wall lamp, two ceramic pots, an oak lattice screen by the path
     inside   Japandi: oak floor, beige sofa, low oak table, rug, TV console, bookshelf, art, floor lamp, a fig tree;
              the kitchen run; the oak dining table with four chairs under a paper pendant; the getabako in the
              genkan; a low bed in the bedroom. Warm light at night (plight 'villa')
   ==================================================================================================== */

/* ---------------------------------------------------------------- textures */
const T = {};
const ct = (k, w, h, draw, o) => (T[k] ||= canvasTex(w, h, draw, o));
const plasterTex = () => ct('vPlaster', 256, 256, (g, w, h) => {
  g.fillStyle = '#f1ebe1'; g.fillRect(0, 0, w, h);
  const R = rng(5);
  for (let i = 0; i < 2600; i++) { const v = R(); g.fillStyle = v < 0.5 ? `rgba(255,252,246,${0.12 + R() * 0.12})` : `rgba(200,188,170,${0.05 + R() * 0.07})`; const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s); }
}, { repeat: true });
const oakSlatTex = () => ct('vOakSlat', 256, 256, (g, w, h) => {
  const R = rng(6), n = 10, s = w / n;
  g.fillStyle = '#7a6048'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = ['#d8b88c', '#d2b084', '#ddbf94', '#cfab7e'][(R() * 4) | 0]; g.fillRect(i * s + 4, 0, s - 8, h); g.fillStyle = 'rgba(255,248,232,0.18)'; g.fillRect(i * s + 4, 0, 3, h); for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(150,110,70,0.18)'; g.fillRect(i * s + 6 + R() * (s - 14), 0, 1, h); } }
}, { repeat: true });
const oakTex = () => ct('vOak', 256, 256, (g, w, h) => {
  const R = rng(7), n = 8, s = h / n;
  for (let i = 0; i < n; i++) { g.fillStyle = ['#d6b68a', '#d0ae80', '#dcbd92', '#cba779'][(R() * 4) | 0]; g.fillRect(0, i * s, w, s); g.fillStyle = 'rgba(120,85,50,0.3)'; g.fillRect(0, i * s, w, 1); g.fillRect((R() * w) | 0, i * s, 1, s); for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(150,110,70,0.12)'; g.fillRect(0, i * s + 2 + R() * (s - 4), w, 1); } }
}, { repeat: true });
// standing-seam dark grey metal: seams every 0.25 m (vertical stripes = seams along z; the X variant: along x)
const seamDraw = (vertical) => (g, w, h) => { g.fillStyle = P.roofMetal; /* warm grey metal (palette) */ g.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 32) { const a = (c, o, wd) => { g.fillStyle = c; if (vertical) g.fillRect(k + o, 0, wd, h); else g.fillRect(0, k + o, w, wd); }; a('rgba(255,255,255,0.16)', 0, 2); a('rgba(0,0,0,0.22)', 2, 2); a('rgba(255,255,255,0.04)', 4, 26); } };
const seamTex = () => ct('vSeam', 128, 128, seamDraw(true), { repeat: true });
const seamTexX = () => ct('vSeamX', 128, 128, seamDraw(false), { repeat: true });
const stoneTex = () => ct('vStone', 256, 128, (g, w, h) => { const R = rng(9); g.fillStyle = '#9d978d'; g.fillRect(0, 0, w, h); for (let r = 0; r < 2; r++) for (let x = (r % 2) * -40; x < w; x += 80) { const v = 196 + ((R() * 18) | 0); g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.fillRect(x + 2, r * 64 + 2, 76, 60); } }, { repeat: true });
const slabTex = () => ct('vSlab', 256, 256, (g, w, h) => { const R = rng(10); g.fillStyle = '#8f8b84'; g.fillRect(0, 0, w, h); [[0, 0, 160, 120], [160, 0, 96, 120], [0, 120, 100, 136], [100, 120, 156, 136]].forEach(([x, y, ww, hh]) => { const v = 190 + ((R() * 20) | 0); g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x + 3, y + 3, ww - 6, hh - 6); }); }, { repeat: true });
const rattanTex = () => ct('vRattan', 64, 64, (g, w, h) => { g.fillStyle = '#b8915c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = (x + y) % 16 ? '#caa46c' : '#a8824e'; g.fillRect(x + 1, y + 1, 6, 6); } }, { repeat: true });

/* ---------------------------------------------------------------- materials (shared) */
const M = {};
function mats() {
  if (M.plaster) return M;
  M.plaster = toon('#ffffff', { map: plasterTex(), nocache: true, lit: 0.05 });
  M.plasterIn = toon('#ffffff', { map: plasterTex(), nocache: true, lit: 0.22 });
  M.oakSlat = toon('#ffffff', { map: oakSlatTex(), nocache: true, lit: 0.1 });
  M.oak = toon('#ffffff', { map: oakTex(), nocache: true, lit: 0.14 });
  M.oakFloor = toon('#ffffff', { map: oakTex(), nocache: true, lit: 0.22 });
  M.roof = toon('#ffffff', { map: seamTex(), nocache: true });
  M.edge = toon('#4a4d51', { lit: 0.04 });
  M.frame = toon('#3b3d40');
  M.base = toon('#ffffff', { map: stoneTex(), nocache: true });
  M.slab = toon('#ffffff', { map: slabTex(), nocache: true });
  M.ceil = toon('#f3eee6', { lit: 0.3 });
  M.linen = toon('#e6ddcd', { lit: 0.2 });
  M.cream = toon('#efe8da', { lit: 0.2 });
  M.oakD = toon('#a07c55', { lit: 0.14 });
  M.rattan = toon('#ffffff', { map: rattanTex(), nocache: true, lit: 0.12 });
  M.cushion = toon('#efe9dc', { lit: 0.15 });
  M.ceramic = toon('#e9e4da', { lit: 0.12 });
  return M;
}

/* ---------------------------------------------------------------- geometry helpers */
/** a box with small rounded edges and box-projected UVs in metres / tile */
function rbx(p, mat, x0, x1, y0, y1, z0, z1, { r = 0.014, tile = 1, cast = true } = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const w = x1 - x0, h = y1 - y0, d = z1 - z0, cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const rr = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const geo = new RoundedBoxGeometry(w, h, d, 2, rr);
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const X = P.getX(i) + cx, Y = P.getY(i) + cyy, Z = P.getZ(i) + cz, ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    if (ax >= ay && ax >= az) U.setXY(i, Z / tile, Y / tile); else if (ay >= az) U.setXY(i, X / tile, Z / tile); else U.setXY(i, X / tile, Y / tile);
  }
  const m = new THREE.Mesh(geo, mat); m.position.set(cx, cyy, cz); m.castShadow = cast; m.receiveShadow = true; p.add(m);
  return m;
}
/**
 * a wall with openings: along `axis` ('x': the wall runs along x, its thickness t0 .. t1 in z; 'z': runs along z,
 * thickness in x) from a0 to a1, y0 .. y1; holes [[a0, a1, y0, y1]]
 */
function wall(p, mat, axis, t0, t1, a0, a1, y0, y1, holes = [], tile = 2) {
  const box = (a, b, c, d) => { if (b - a < 0.01 || d - c < 0.01) return; if (axis === 'x') rbx(p, mat, a, b, c, d, t0, t1, { tile }); else rbx(p, mat, t0, t1, c, d, a, b, { tile }); };
  let cur = a0;
  [...holes].sort((h1, h2) => h1[0] - h2[0]).forEach(([ha, hb, hy0, hy1]) => { box(cur, ha, y0, y1); box(ha, hb, y0, hy0); box(ha, hb, hy1, y1); cur = hb; });
  box(cur, a1, y0, y1);
}
/** slim dark frame + glass in an opening (mullions at the given positions along the wall) */
function glazing(p, axis, t, a0, a1, y0, y1, mull = [], seed = 1, k = 0.035) {
  const f = (a, b, c, d) => (axis === 'x' ? bx(p, mats().frame, a, b, c, d, t - 0.03, t + 0.03, { cast: false }) : bx(p, mats().frame, t - 0.03, t + 0.03, c, d, a, b, { cast: false }));
  f(a0, a1, y0, y0 + k); f(a0, a1, y1 - k, y1); f(a0, a0 + k, y0, y1); f(a1 - k, a1, y0, y1);
  mull.forEach((a) => f(a - k / 2, a + k / 2, y0, y1));
  const w = a1 - a0, h = y1 - y0;
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), makeGlass(w, h, seed, { alpha: 0.07, drops: 0.35, tint: 0xf2f6f4 }));
  if (axis === 'x') gp.position.set((a0 + a1) / 2, (y0 + y1) / 2, t); else { gp.position.set(t, (y0 + y1) / 2, (a0 + a1) / 2); gp.rotation.y = Math.PI / 2; }
  gp.userData.noLine = true; gp.renderOrder = 2; p.add(gp); reg.noRefl.push(gp);
}

/* ---------------------------------------------------------------- the house */
export function buildVillaHouse(g, root, { YL, MZ }) {
  const m = mats();
  const FL = YL + 0.3; // the floor
  const t = 0.16;
  const X0 = 15.6, XA = 18.7, XB = 24.4, X1 = 28.6; // back wing: A | B | C
  const ZF = 24.6, ZB = 29.9, ZD = 21.3; // back wing front / back, east wing front
  const HA = YL + 2.75, HB = YL + 3.15, HC = YL + 2.85; // wall tops
  const wz = (z) => MZ - z; // to world z

  /* ---- base: pale stone plinth under the whole L, the oak floor on it ---- */
  rbx(g, m.base, X0 - 0.03, X1 + 0.03, YL - 0.06, FL, ZF - 0.03, ZB + 0.03, { tile: 1.2, r: 0.02 });
  rbx(g, m.base, XB - 0.03, X1 + 0.03, YL - 0.06, FL, ZD - 0.03, ZF, { tile: 1.2, r: 0.02 });
  rbx(g, m.oakFloor, X0 + t, X1 - t, FL, FL + 0.012, ZF + t, ZB - t, { tile: 1.6, cast: false, r: 0.002 });
  rbx(g, m.oakFloor, XB + t, X1 - t, FL, FL + 0.012, ZD + t, ZF + t, { tile: 1.6, cast: false, r: 0.002 });

  /* ---- walls ---- */
  const PORCH = [16.0, 17.6], PD = 1.0; // the entrance recess in the front of A
  // A front: the porch recess, a narrow tall window
  wall(g, m.plaster, 'x', ZF, ZF + t, X0, PORCH[0], FL, HA);
  wall(g, m.plaster, 'x', ZF, ZF + t, PORCH[1], XA, FL, HA, [[18.18, 18.46, FL + 0.35, FL + 2.15]]);
  rbx(g, m.plaster, PORCH[0], PORCH[1], FL + 2.3, HA, ZF, ZF + t);
  glazing(g, 'x', ZF + t / 2, 18.18, 18.46, FL + 0.35, FL + 2.15, [], 31);
  // the porch: oak-clad recess walls, the door wall with the side light
  rbx(g, m.oakSlat, PORCH[0] - 0.001, PORCH[0] + t, FL, FL + 2.3, ZF, ZF + PD, { tile: 1 });
  rbx(g, m.oakSlat, PORCH[1] - t, PORCH[1] + 0.001, FL, FL + 2.3, ZF, ZF + PD, { tile: 1 });
  wall(g, m.oakSlat, 'x', ZF + PD, ZF + PD + t, PORCH[0], PORCH[1], FL, FL + 2.3, [[16.25, 17.15, FL, FL + 2.18], [17.2, 17.42, FL + 0.1, FL + 2.1]], 1);
  rbx(g, m.ceil, PORCH[0], PORCH[1], FL + 2.28, FL + 2.3, ZF, ZF + PD, { cast: false });
  glazing(g, 'x', ZF + PD + t / 2, 17.2, 17.42, FL + 0.1, FL + 2.1, [], 32);
  // B front: four tall sliding panes to the deck, a plaster band over them
  wall(g, m.plaster, 'x', ZF, ZF + t, XA, XB, FL, HB, [[XA + 0.12, XB - 0.08, FL, FL + 2.45]]);
  {
    const a0 = XA + 0.12, a1 = XB - 0.08, w = (a1 - a0) / 4;
    glazing(g, 'x', ZF + t / 2, a0, a1, FL, FL + 2.45, [a0 + w, a0 + 2 * w, a0 + 3 * w], 33);
    bx(g, m.frame, a0, a1, FL - 0.005, FL + 0.02, ZF - 0.02, ZF + t + 0.02, { cast: false }); // the sill track
  }
  // D: west face to the deck (two tall panes), south face (oak slats + a long low window), east face (a slit)
  wall(g, m.plaster, 'z', XB, XB + t, ZD, ZF + t, FL, HC, [[ZD + 0.35, ZF - 0.12, FL, FL + 2.45]]);
  glazing(g, 'z', XB + t / 2, ZD + 0.35, ZF - 0.12, FL, FL + 2.45, [(ZD + 0.35 + ZF - 0.12) / 2], 34);
  wall(g, m.plaster, 'x', ZD, ZD + t, XB, X1, FL, HC, [[25.8, 28.2, FL + 1.0, FL + 1.85]]);
  glazing(g, 'x', ZD + t / 2, 25.8, 28.2, FL + 1.0, FL + 1.85, [27.0], 35);
  rbx(g, m.oakSlat, XB - 0.02, 25.55, FL + 0.02, HC - 0.02, ZD - 0.06, ZD + 0.001, { tile: 1 });
  wall(g, m.plaster, 'z', X1 - t, X1, ZD, ZB, FL, HC, [[22.6, 22.9, FL + 0.3, FL + 2.2], [25.5, 28.5, FL + 1.2, FL + 1.9]]);
  glazing(g, 'z', X1 - t / 2, 22.6, 22.9, FL + 0.3, FL + 2.2, [], 36);
  glazing(g, 'z', X1 - t / 2, 25.5, 28.5, FL + 1.2, FL + 1.9, [27.0], 37);
  // C front between the two wings: only the corner post (the L opens inside)
  // back face (Kaigan-dori): long low windows, a narrow tall one, an oak slat panel
  wall(g, m.plaster, 'x', ZB - t, ZB, X0, XA, FL, HA, [[16.2, 18.2, FL + 1.5, FL + 2.1]]);
  wall(g, m.plaster, 'x', ZB - t, ZB, XA, XB, FL, HB, [[19.5, 23.6, FL + 1.35, FL + 2.25]]);
  wall(g, m.plaster, 'x', ZB - t, ZB, XB, X1, FL, HC, [[24.9, 25.2, FL + 0.3, FL + 2.3]]);
  glazing(g, 'x', ZB - t / 2, 16.2, 18.2, FL + 1.5, FL + 2.1, [], 38);
  glazing(g, 'x', ZB - t / 2, 19.5, 23.6, FL + 1.35, FL + 2.25, [21.55], 39);
  glazing(g, 'x', ZB - t / 2, 24.9, 25.2, FL + 0.3, FL + 2.3, [], 40);
  rbx(g, m.oakSlat, 25.9, 28.45, FL + 0.02, HC - 0.04, ZB - 0.001, ZB + 0.06, { tile: 1 });
  // west face (on the gate side): a narrow tall window and a long low one
  wall(g, m.plaster, 'z', X0, X0 + t, ZF, ZB, FL, HA, [[26.5, 26.8, FL + 0.3, FL + 2.2], [27.6, 29.3, FL + 1.5, FL + 2.1]]);
  glazing(g, 'z', X0 + t / 2, 26.5, 26.8, FL + 0.3, FL + 2.2, [], 41);
  glazing(g, 'z', X0 + t / 2, 27.6, 29.3, FL + 1.5, FL + 2.1, [], 42);
  // B's clerestory strips above the lower neighbours, the inner partitions
  rbx(g, m.plaster, XA - t / 2, XA + t / 2, HA, HB, ZF, ZB); rbx(g, m.plaster, XB - t / 2, XB + t / 2, HC, HB, ZF, ZB);
  rbx(g, m.plasterIn, XA - 0.06, XA + 0.06, FL, HA, 26.6, ZB - t); // A | B, with the hall opening at the front
  rbx(g, m.plasterIn, X0 + t, 17.9, FL, HA, 27.15, 27.27); // genkan | bedroom
  rbx(g, m.plasterIn, XB - 0.06, XB + 0.06, FL, HB, 28.7, ZB - t); // a short stub between living and kitchen
  // ceilings (white, seen through the glass)
  rbx(g, m.ceil, X0 + t, XA, HA - 0.03, HA - 0.01, ZF + t, ZB - t, { cast: false, r: 0.002 });
  rbx(g, m.ceil, XA, XB, HB - 0.03, HB - 0.01, ZF + t, ZB - t, { cast: false, r: 0.002 });
  rbx(g, m.ceil, XB, X1 - t, HC - 0.03, HC - 0.01, ZD + t, ZB - t, { cast: false, r: 0.002 });

  /* ---- roofs: four thin low-pitch shed roofs at three heights + two thin canopies ----
     main (living, B)   the highest, rising to the garden: a deep thin eave over the glass, falling to the street
     side (rooms, C+D)  a little lower, falling east; entrance + bedroom (A) lower again, falling west
     porch / deck       thin flat canopies below the main eave (the deck one on a slim steel post)
     Each slab is sheared (its eave edges stay vertical), with standing-seam dark metal running down the slope,
     a slim metal fascia, oak soffits, a gutter on the low edge with downpipes, and a plaster infill under it so the
     walls meet the sloping underside. */
  const K = 0.05; // rise per metre (≈ 3°)
  const shear = (geo, f) => { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, f(P.getX(i), P.getY(i), P.getZ(i))); P.needsUpdate = true; geo.computeVertexNormals(); };
  const boxUV = (geo, tile) => { const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv; for (let i = 0; i < P.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)); if (ax >= ay && ax >= az) U.setXY(i, P.getZ(i) / tile, P.getY(i) / tile); else if (ay >= az) U.setXY(i, P.getX(i) / tile, P.getZ(i) / tile); else U.setXY(i, P.getX(i) / tile, P.getY(i) / tile); } };
  /** a box whose vertices follow bottom(x, z): every vertex is lifted by bottom(x, z) - y0 (top only if `topOnly`) */
  const sheared = (mat, x0, x1, y0, y1, z0, z1, bottom, { r = 0.012, tile = 1, cast = true, topOnly = false } = {}) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const mid = (y0 + y1) / 2;
    shear(geo, (x, y, z) => (topOnly && y < mid ? y : y + bottom(x, z) - y0));
    boxUV(geo, tile);
    const msh = new THREE.Mesh(geo, mat); msh.castShadow = cast; msh.receiveShadow = true; g.add(msh);
    return msh;
  };
  const roofZ = toon('#ffffff', { map: seamTex(), nocache: true }); // seams along z (the main roof falls along z)
  const roofX = toon('#ffffff', { map: seamTexX(), nocache: true }); // seams along x (the side roofs fall along x)
  const TH = 0.07; // slab thickness at the eave
  const shed = ({ x0, x1, z0, z1, mat, bottom, body, soffits = [], gutter }) => {
    sheared(mat, x0, x1, 0, TH, z0, z1, bottom, { r: 0.015 });
    // the slim metal fascia round the edge
    const e = 0.028, fy0 = -0.03, fy1 = TH + 0.025;
    [[x0 - e, x1 + e, z0 - e, z0 + 0.008], [x0 - e, x1 + e, z1 - 0.008, z1 + e], [x0 - e, x0 + 0.008, z0, z1], [x1 - 0.008, x1 + e, z0, z1]].forEach(([a, b, c, d]) => sheared(m.edge, a, b, fy0, fy1, c, d, bottom, { r: 0.008 }));
    // plaster infill between the wall tops and the sloping underside
    if (body) { const [bx0, bx1, bz0, bz1, top] = body; sheared(m.plaster, bx0, bx1, top, top + 0.02, bz0, bz1, (x, z) => bottom(x, z) + 0.001, { topOnly: true, tile: 2, r: 0.004 }); }
    soffits.forEach(([a, b, c, d]) => sheared(m.oak, a, b, -0.022, -0.002, c, d, bottom, { tile: 1.2, cast: false, r: 0.004 }));
    if (gutter) cyl2(g, m.edge, gutter[0], gutter[1], 0.032, 8);
  };
  // main roof (living room): high over the garden, low at the street
  const bB = (x, z) => HB + K * (ZB - z);
  shed({ x0: XA - 0.15, x1: XB + 0.05, z0: ZF - 1.25, z1: ZB + 0.4, mat: roofZ, bottom: bB, body: [XA - t / 2, XB + t / 2, ZF, ZB, HB], soffits: [[XA, XB, ZF - 1.25, ZF]], gutter: [[XA - 0.1, bB(0, ZB + 0.45) - 0.01, ZB + 0.45], [XB + 0.05, bB(0, ZB + 0.45) - 0.01, ZB + 0.45]] });
  // side roof (kitchen + dining): falls east
  const bC = (x) => HC + K * (X1 - x);
  shed({ x0: XB + 0.05, x1: X1 + 0.38, z0: ZD - 0.5, z1: ZB + 0.4, mat: roofX, bottom: bC, body: [XB + t / 2, X1, ZD, ZB, HC], soffits: [[XB + 0.05, X1 + 0.38, ZD - 0.5, ZD]], gutter: [[X1 + 0.42, bC(X1 + 0.42) - 0.01, ZD - 0.5], [X1 + 0.42, bC(X1 + 0.42) - 0.01, ZB + 0.4]] });
  // entrance + bedroom: falls west, a little lower
  const bA = (x) => HA + K * (x - X0);
  shed({ x0: X0 - 0.4, x1: XA + 0.05, z0: ZF - 0.15, z1: ZB + 0.4, mat: roofX, bottom: bA, body: [X0, XA - t / 2, ZF, ZB, HA], soffits: [[X0 - 0.4, X0, ZF - 0.15, ZB + 0.4]], gutter: [[X0 - 0.44, bA(X0 - 0.44) - 0.01, ZF - 0.15], [X0 - 0.44, bA(X0 - 0.44) - 0.01, ZB + 0.4]] });
  // downpipes from the gutters' ends
  [[XA - 0.05, ZB + 0.45, bB(0, ZB + 0.45)], [X1 + 0.42, ZD - 0.42, bC(X1 + 0.42)], [X1 + 0.42, ZB + 0.32, bC(X1 + 0.42)], [X0 - 0.44, ZB + 0.32, bA(X0 - 0.44)]].forEach(([x, z, y]) => { cy(g, m.edge, x, YL, z, 0.028, y - YL - 0.02, 8); bx(g, m.edge, x - 0.035, x + 0.035, YL, YL + 0.04, z - 0.06, z + 0.06, { cast: false }); });
  // the porch canopy (a thin flat plate over the steps, under the entrance roof's eave)
  const canopy = (x0, x1, z0, z1, y, lights) => {
    rbx(g, toon(P.roofMetal), x0, x1, y, y + 0.06, z0, z1, { r: 0.012 }); // warm grey metal, like the roofs
    rbx(g, m.oak, x0 + 0.03, x1 - 0.03, y - 0.012, y, z0 + 0.03, z1, { r: 0.003, cast: false, tile: 1.2 });
    lights.forEach(([x, z]) => { cy(g, glow('#ffe6c4', 2.0, { off: '#d8d0c0' }), x, y - 0.024, z, 0.04, 0.012, 12); halo(g, x, y - 0.25, z, '#ffdcae', 0.9, 0.22); });
  };
  canopy(PORCH[0] - 0.2, PORCH[1] + 0.2, ZF - 0.85, ZF + 0.02, FL + 2.3, [[(PORCH[0] + PORCH[1]) / 2, ZF - 0.4]]);
  // the deck canopy on its slim steel post (a sheltered corner by the dining room's glass)
  canopy(22.55, XB, 21.85, ZF + 0.02, FL + 2.55, [[23.5, 22.6], [23.5, 23.8]]);
  cy(g, m.frame, 22.68, FL - 0.04, 21.98, 0.035, 2.6, 8);
  // downlights in the main eave's soffit (warm, with the house lights)
  [19.6, 21.55, 23.5].forEach((x) => { const z = ZF - 0.6, y = bB(x, z) - 0.024; cy(g, glow('#ffe6c4', 2.0, { off: '#d8d0c0' }), x, y - 0.012, z, 0.045, 0.012, 12); halo(g, x, y - 0.25, z, '#ffdcae', 1.0, 0.22); });

  /* ---- spring: a few cherry petals blown onto the roofs, along the eaves and in the corners (not in the middle) ---- */
  {
    const Rp = rng(321), list = [];
    const roofs = [
      { x0: XA - 0.15, x1: XB + 0.05, z0: ZF - 1.25, z1: ZB + 0.4, top: (x, z) => bB(x, z) + TH, low: 'z1' },
      { x0: XB + 0.05, x1: X1 + 0.38, z0: ZD - 0.5, z1: ZB + 0.4, top: (x) => bC(x) + TH, low: 'x1' },
      { x0: X0 - 0.4, x1: XA + 0.05, z0: ZF - 0.15, z1: ZB + 0.4, top: (x) => bA(x) + TH, low: 'x0' },
    ];
    roofs.forEach((r) => {
      const W = r.x1 - r.x0, D = r.z1 - r.z0;
      // along the edges (thicker by the low eave), then small drifts in the corners
      for (let i = 0; i < 70; i++) {
        const side = (Rp() * 5) | 0, s = Rp(), inset = Math.pow(Rp(), 2.2) * 0.45 + 0.04;
        const edge = side === 4 ? r.low : ['x0', 'x1', 'z0', 'z1'][side];
        const x = edge === 'x0' ? r.x0 + inset : edge === 'x1' ? r.x1 - inset : r.x0 + 0.05 + s * (W - 0.1);
        const z = edge === 'z0' ? r.z0 + inset : edge === 'z1' ? r.z1 - inset : r.z0 + 0.05 + s * (D - 0.1);
        list.push([x, z, r.top(x, z)]);
      }
      [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].forEach(([cx, cz]) => { const n = 4 + ((Rp() * 6) | 0); for (let i = 0; i < n; i++) { const x = cx + Math.sign(r.x0 + W / 2 - cx) * (0.05 + Rp() * 0.35), z = cz + Math.sign(r.z0 + D / 2 - cz) * (0.05 + Rp() * 0.35); list.push([x, z, r.top(x, z)]); } });
    });
    const geo = new THREE.PlaneGeometry(1, 0.62).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), col = new THREE.Color();
    list.forEach(([x, z, y], i) => {
      const s = 0.06 + Rp() * 0.035;
      m4.compose(new THREE.Vector3(x, y + 0.006, z), q.setFromEuler(e3.set((Rp() - 0.5) * 0.4, Rp() * 6.28, (Rp() - 0.5) * 0.4)), new THREE.Vector3(s, 1, s));
      im.setMatrixAt(i, m4); im.setColorAt(i, col.set(['#f7b6c8', '#f4a3bd', '#ffc8d8', '#fbd3df'][(Rp() * 4) | 0]));
    });
    im.castShadow = false; im.receiveShadow = false; im.userData.noLine = true; im.userData.keep = true; g.add(im); reg.noRefl.push(im);
    reg.updaters.push(() => { const Gu = reg.groundU, sp = SEASON_U.W.value.x * (1 - (Gu ? Gu.uSnow.value : 0)); mat.opacity = Math.min(1, sp * 1.4); im.visible = mat.opacity > 0.02; });
  }

  /* ---- the entrance porch ---- */
  {
    // stone landing + steps up to the floor, the porch floor in slabs
    rbx(g, m.slab, PORCH[0], PORCH[1], YL - 0.04, FL, ZF, ZF + PD, { tile: 1.1 });
    rbx(g, m.slab, PORCH[0] - 0.05, PORCH[1] + 0.05, YL - 0.04, YL + 0.15, ZF - 0.45, ZF, { tile: 1.1 });
    // the oak door with a long pull, the slim side light
    rbx(g, m.oak, 16.27, 17.13, FL, FL + 2.16, ZF + PD - 0.02, ZF + PD + 0.04, { tile: 0.9, r: 0.01 });
    bx(g, m.frame, 17.0, 17.03, FL + 0.7, FL + 1.6, ZF + PD - 0.06, ZF + PD - 0.02, { cast: false });
    // bell + intercom, the post box, the wall lamp (on with the house lights)
    rbx(g, m.frame, 17.47, 17.57, FL + 1.15, FL + 1.33, ZF + 0.5, ZF + 0.56, { r: 0.006 });
    rbx(g, m.frame, 15.98, 16.05, FL + 0.95, FL + 1.3, ZF + 0.25, ZF + 0.6, { r: 0.008 });
    rbx(g, m.edge, PORCH[1] - t - 0.06, PORCH[1] - t, FL + 1.75, FL + 2.05, ZF + 0.42, ZF + 0.5, { r: 0.006 });
    bx(g, glow('#ffe2b8', 2.0, { off: '#d8d0c0' }), PORCH[1] - t - 0.065, PORCH[1] - t - 0.06, FL + 1.78, FL + 2.02, ZF + 0.43, ZF + 0.49, { cast: false });
    halo(g, PORCH[1] - t - 0.3, FL + 1.6, ZF + 0.45, '#ffd9a8', 1.3, 0.35);
    // the name plate + house number on the plaster beside the porch (world frame: the text reads the right way)
    const plate = (k, w, h, draw, x, y, z) => { const p = pl(root, toon('#ffffff', { map: ct(k, 256, Math.round(256 * h / w), draw), nocache: true, lit: 0.12 }), w, h, x, y, wz(z), 0, 0); p.userData.noLine = true; };
    plate('vName', 0.34, 0.12, (c, w, h) => { c.fillStyle = '#3b3d40'; c.fillRect(0, 0, w, h); c.font = '600 34px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#efe6d2'; c.fillText('星野  HOSHINO', w / 2, h / 2 + 2); }, 17.84, FL + 1.55, ZF - 0.012);
    plate('vNum', 0.16, 0.1, (c, w, h) => { c.fillStyle = '#d8b88c'; c.fillRect(0, 0, w, h); c.font = '700 84px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#3b3d40'; c.fillText('6-1', w / 2, h / 2 + 4); }, 17.84, FL + 1.37, ZF - 0.012);
    // two ceramic pots with small plants beside the steps
    [[PORCH[0] - 0.3, ZF - 0.3], [PORCH[1] + 0.3, ZF - 0.3]].forEach(([x, z], i) => {
      cy(g, m.ceramic, x, YL, z, 0.17, 0.42, 18, { rt: 1.1 });
      const sb = makeShrub({ seed: 610 + i, width: 0.4, height: 0.45, palette: 'deep' }); sb.position.set(x, YL + 0.4, z); g.add(sb);
    });
    // the oak lattice screen between the gate path and the porch
    { const sx = 15.45, za = 22.85, zb = 24.25; [za, zb].forEach((z) => rbx(g, m.oakD, sx - 0.04, sx + 0.04, YL, YL + 1.95, z - 0.04, z + 0.04, { r: 0.01 })); for (let z = za + 0.08; z < zb - 0.04; z += 0.09) rbx(g, m.oak, sx - 0.02, sx + 0.02, YL + 0.12, YL + 1.88, z - 0.022, z + 0.022, { r: 0.005, cast: false }); rbx(g, m.oakD, sx - 0.05, sx + 0.05, YL + 1.88, YL + 1.95, za - 0.06, zb + 0.06, { r: 0.01 }); }
  }

  /* ---- the timber deck in the L's corner: tea table, two rattan chairs, cushions, plants ---- */
  {
    const dx0 = 19.4, dx1 = XB, dz0 = 22.25, dz1 = ZF, dy = FL - 0.04;
    rbx(g, m.oak, dx0, dx1, YL - 0.04, dy, dz0, dz1, { tile: 1.2, r: 0.012 });
    rbx(g, m.slab, 20.0, 23.8, YL - 0.04, YL + 0.13, 21.82, dz0, { tile: 1.1 }); // the stone step down to the garden
    bx(g, glow('#ffd9a0', 1.6, { off: '#8a6a4a' }), dx0 + 0.1, dx1 - 0.1, YL + 0.03, YL + 0.05, dz0 - 0.005, dz0, { cast: false }); // hidden strip under the deck edge
    // the low tea table
    rbx(g, m.oakD, 21.25, 21.95, dy, dy + 0.33, 23.05, 23.75, { r: 0.02 }); rbx(g, m.oak, 21.15, 22.05, dy + 0.33, dy + 0.38, 22.95, 23.85, { r: 0.015 });
    cy(g, m.ceramic, 21.45, dy + 0.38, 23.3, 0.05, 0.07, 12, { rt: 0.9 }); cy(g, m.ceramic, 21.75, dy + 0.38, 23.5, 0.04, 0.06, 12); bx(g, toon('#5f8a5a'), 21.62, 21.9, dy + 0.38, dy + 0.4, 23.15, 23.3, { cast: false });
    // two rattan lounge chairs with soft cushions, facing the garden
    [[20.45, 23.35, 0.35], [22.85, 23.35, -0.35]].forEach(([x, z, ry]) => {
      const c = grp(g, x, dy, z, Math.PI + ry);
      rbx(c, m.rattan, -0.36, 0.36, 0.06, 0.36, -0.36, 0.36, { r: 0.05, tile: 0.25 });
      rbx(c, m.rattan, -0.36, 0.36, 0.36, 0.78, -0.4, -0.26, { r: 0.05, tile: 0.25 });
      [-0.36, 0.28].forEach((a) => rbx(c, m.rattan, a, a + 0.08, 0.36, 0.56, -0.36, 0.36, { r: 0.035, tile: 0.25 }));
      rbx(c, m.cushion, -0.29, 0.29, 0.36, 0.46, -0.27, 0.32, { r: 0.04 }); rbx(c, m.cushion, -0.27, 0.27, 0.42, 0.74, -0.27, -0.16, { r: 0.04 });
      [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([a, b]) => cy(c, m.oakD, a, 0, b, 0.025, 0.07, 6));
    });
    // plants in ceramic pots on the deck corners
    [[dx0 + 0.3, dz0 + 0.3], [dx1 - 0.35, dz0 + 0.3]].forEach(([x, z], i) => { cy(g, m.ceramic, x, dy, z, 0.18, 0.36, 18, { rt: 0.85 }); const sb = makeShrub({ seed: 630 + i, width: 0.45, height: 0.55, palette: 'deep' }); sb.position.set(x, dy + 0.34, z); g.add(sb); });
  }

  /* ---- inside (Japandi) ---- */
  {
    const y = FL + 0.012;
    // living (B): TV console + TV on the A wall, the beige sofa facing it, low oak table, rug, floor lamp, bookshelf, art, fig
    rbx(g, toon('#d9d2c4', { lit: 0.2 }), 19.8, 23.2, y, y + 0.012, 25.6, 28.4, { r: 0.003, cast: false });
    rbx(g, m.oak, XA + 0.07, XA + 0.5, y, y + 0.42, 26.9, 28.9, { r: 0.015 }); rbx(g, m.frame, XA + 0.065, XA + 0.09, y + 0.85, y + 1.55, 27.25, 28.55, { r: 0.005, cast: false });
    { const c = grp(g, 23.05, y, 27.0, -Math.PI / 2); rbx(c, m.linen, -1.25, 1.25, 0.12, 0.42, -0.45, 0.45, { r: 0.06 }); rbx(c, m.linen, -1.25, 1.25, 0.42, 0.82, -0.45, -0.25, { r: 0.07 }); [-1.25, 1.07].forEach((a) => rbx(c, m.linen, a, a + 0.18, 0.42, 0.62, -0.45, 0.45, { r: 0.07 })); [-0.62, 0.0, 0.62].forEach((a) => rbx(c, m.cushion, a - 0.3, a + 0.3, 0.42, 0.5, -0.24, 0.4, { r: 0.05 })); [[-1.15, -0.35], [1.15, -0.35], [-1.15, 0.35], [1.15, 0.35]].forEach(([a, b]) => cy(c, m.oakD, a, 0, b, 0.025, 0.12, 6)); }
    rbx(g, m.oak, 20.6, 21.7, y + 0.28, y + 0.33, 26.65, 27.35, { r: 0.03 }); rbx(g, m.oakD, 20.7, 21.6, y, y + 0.28, 26.75, 27.25, { r: 0.02 });
    cy(g, m.ceramic, 20.9, y + 0.33, 27.0, 0.06, 0.12, 12, { rt: 0.7 }); bx(g, toon('#7a2e2a'), 21.25, 21.5, y + 0.33, y + 0.36, 26.85, 27.15, { cast: false });
    cy(g, m.frame, 23.75, y, 25.2, 0.12, 0.02, 12); cy(g, m.frame, 23.75, y, 25.2, 0.012, 1.45, 6); cy(g, toon('#f2ead8', { side: THREE.DoubleSide }), 23.75, y + 1.38, 25.2, 0.2, 0.26, 16, { rt: 0.7 }); sph(g, glow('#ffd9a0', 1.6, { off: '#f2ead8' }), 0.06, 23.75, y + 1.45, 25.2);
    {
      const x0 = 19.2, x1 = 21.4, zb = ZB - t;
      rbx(g, m.oak, x0, x1, y, y + 1.9, zb - 0.02, zb, { r: 0.004 }); // the back board, against the wall
      [x0, x1 - 0.03].forEach((x) => rbx(g, m.oak, x, x + 0.03, y, y + 1.9, zb - 0.32, zb, { r: 0.006 }));
      [0, 0.47, 0.94, 1.41, 1.87].forEach((h, k) => { rbx(g, m.oak, x0, x1, y + h, y + h + 0.03, zb - 0.32, zb, { r: 0.006, cast: false }); if (k < 4) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.5, 0.36), toon('#ffffff', { map: spineTex(70 + k, { pale: true }), lit: 0.15 })); sp.position.set((x0 + x1) / 2 - 0.2, y + h + 0.21, zb - 0.06); sp.rotation.y = Math.PI; sp.userData.noLine = true; g.add(sp); cy(g, m.ceramic, x1 - 0.22, y + h + 0.03, zb - 0.16, 0.07, 0.16 + k * 0.03, 12, { rt: 0.6 }); } });
    }
    rbx(g, m.oakD, 22.0, 23.3, y + 1.15, y + 1.95, ZB - t - 0.03, ZB - t, { r: 0.008 }); rbx(g, toon('#c9b79a', { lit: 0.2 }), 22.06, 23.24, y + 1.21, y + 1.89, ZB - t - 0.035, ZB - t - 0.03, { r: 0.002, cast: false });
    { const p = makeFicusPot({ seed: 61 }); p.position.set(XB - 0.4, y, ZF + 0.55); g.add(p); }
    plight(g, '#ffd59a', 9, 10, 21.5, FL + 2.0, 26.6, 'villa');
    // kitchen (C): the oak run with a white top along the back wall, a tall cupboard
    rbx(g, m.oak, 25.0, 27.6, y, y + 0.88, ZB - t - 0.62, ZB - t, { r: 0.01 }); rbx(g, m.cream, 24.98, 27.62, y + 0.88, y + 0.92, ZB - t - 0.64, ZB - t, { r: 0.006 });
    rbx(g, m.oak, 27.65, X1 - t, y, y + 2.2, ZB - t - 0.62, ZB - t, { r: 0.01 });
    rbx(g, m.oak, 25.0, 27.0, y + 1.5, y + 1.53, ZB - t - 0.3, ZB - t, { r: 0.004 }); [25.3, 25.7, 26.4].forEach((x, i) => cy(g, m.ceramic, x, y + 1.53, ZB - t - 0.15, 0.05, 0.1 + i * 0.03, 10));
    // dining (D): the oak table, four chairs, the paper pendant, a low sideboard with a vase
    {
      const cx = 26.4, cz = 23.0, ty = y + 0.72;
      rbx(g, m.oak, cx - 0.8, cx + 0.8, ty - 0.04, ty, cz - 0.42, cz + 0.42, { r: 0.02 });
      [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]].forEach(([a, b]) => rbx(g, m.oakD, cx + a - 0.03, cx + a + 0.03, y, ty - 0.04, cz + b - 0.03, cz + b + 0.03, { r: 0.008 }));
      [[-0.4, -0.62, 0], [0.4, -0.62, 0], [-0.4, 0.62, Math.PI], [0.4, 0.62, Math.PI]].forEach(([a, b, ry]) => {
        const c = grp(g, cx + a, y, cz + b, ry);
        [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.19], [0.19, 0.19]].forEach(([u, v]) => rbx(c, m.oakD, u - 0.018, u + 0.018, 0, 0.44, v - 0.018, v + 0.018, { r: 0.006, cast: false }));
        rbx(c, toon('#cdb48a'), -0.21, 0.21, 0.42, 0.46, -0.2, 0.21, { r: 0.012 });
        rbx(c, m.oakD, -0.2, 0.2, 0.66, 0.78, -0.22, -0.19, { r: 0.01 });
      });
      cyl2(g, m.frame, [cx, HC - 0.02, cz], [cx, HC - 0.75, cz], 0.006, 4, { noLine: true });
      sph(g, glow('#ffe2b8', 1.7, { off: '#f6f0e4' }), 0.22, cx, HC - 0.92, cz, 1, 0.82, 1);
      rbx(g, m.oak, X1 - t - 0.42, X1 - t, y, y + 0.7, 21.9, 23.7, { r: 0.012 });
      cy(g, m.ceramic, X1 - t - 0.2, y + 0.7, 22.4, 0.07, 0.24, 12, { rt: 0.5 }); cyl2(g, toon('#6a7a4a'), [X1 - t - 0.2, y + 0.9, 22.4], [X1 - t - 0.25, y + 1.3, 22.36], 0.006, 3, { noLine: true });
    }
    // genkan (A): the getabako with a vase, a tall storage cupboard; the bedroom: a low bed, a side lamp
    rbx(g, m.oak, X0 + t, X0 + t + 0.38, y, y + 0.95, 25.75, 27.05, { r: 0.01 }); cy(g, m.ceramic, X0 + t + 0.19, y + 0.95, 26.2, 0.06, 0.2, 10, { rt: 0.55 });
    rbx(g, m.oak, 17.95, XA - 0.07, y, y + 2.1, 25.0, 25.95, { r: 0.01 });
    rbx(g, m.slab, 16.05, 17.55, FL - 0.06, FL + 0.005, ZF + PD + t, ZF + PD + t + 0.55, { tile: 1.1, cast: false }); // the tataki, a step below the floor
    rbx(g, m.oak, 16.2, 18.1, y, y + 0.22, 27.6, 29.5, { r: 0.02 }); rbx(g, m.cushion, 16.25, 18.05, y + 0.22, y + 0.36, 27.65, 29.4, { r: 0.05 }); rbx(g, toon('#c9b79a'), 16.25, 18.05, y + 0.3, y + 0.38, 27.65, 28.4, { r: 0.04 });
    rbx(g, m.oak, 18.15, 18.5, y, y + 0.45, 29.0, 29.5, { r: 0.01 }); sph(g, glow('#ffd9a0', 1.4, { off: '#f2ead8' }), 0.09, 18.32, y + 0.58, 29.25);
  }

  /* ---- weather + camera hooks (world frame) ---- */
  // nothing under the roofs takes snow: the back wing with its eaves, the east wing with its eaves
  // (up to just above the tallest furniture: the porch + deck canopies' tops above it still take snow evenly)
  noSnowBox(X0 - 0.45, wz(ZB + 0.45), X1 + 0.45, wz(ZF - 1.25), FL + 2.25);
  noSnowBox(22.55, wz(ZF), X1 + 0.45, wz(ZD - 0.5), FL + 2.25); // the dining wing + under the deck canopy
  // the roofs take leaves + snow (petals: the scatter above) - one slope each, its high edge free (no wall drift)
  const w = { leaf: 0.45 };
  (reg.extraRoofs ||= []).push(
    { id: 'villaB', a: [XA - 0.15, wz(ZF - 1.25)], b: [XB + 0.05, wz(ZF - 1.25)], n: [0, -1], D: ZB + 0.4 - (ZF - 1.25), y: bB(0, ZF - 1.25) + TH, drop: K * (ZB + 0.4 - (ZF - 1.25)), w, snow: 0.15, ridge: true },
    { id: 'villaC', a: [XB + 0.05, wz(ZB + 0.4)], b: [XB + 0.05, wz(ZD - 0.5)], n: [1, 0], D: X1 + 0.38 - XB - 0.05, y: bC(XB + 0.05) + TH, drop: K * (X1 + 0.33 - XB), w, snow: 0.15, ridge: true },
    { id: 'villaA', a: [XA + 0.05, wz(ZF - 0.15)], b: [XA + 0.05, wz(ZB + 0.4)], n: [-1, 0], D: XA + 0.45 - X0, y: bA(XA + 0.05) + TH, drop: K * (XA + 0.45 - X0), w, snow: 0.15, ridge: true },
  );
  // the camera may come close inside the house
  const inside = (p, pad = 0) => (p.x > X0 - pad && p.x < X1 + pad && p.z > wz(ZB) - pad && p.z < wz(ZF) + pad) || (p.x > XB - pad && p.x < X1 + pad && p.z > wz(ZF) - pad && p.z < wz(ZD) + pad);
  (reg.closeZones ||= []).push((p) => inside(p, 0.6));
  return { entrance: new THREE.Vector3((PORCH[0] + PORCH[1]) / 2, FL + 1, wz(ZF)) };
}
