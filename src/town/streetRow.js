import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, noSnowBox } from '../core.js';
import { makeGlass } from '../fx.js';
import { makeShrub } from '../tree.js';
import { makePot } from '../plants/pottedPlants.js';
import { bicycle, vendingMachine, trashBins } from '../street.js';
import { txt, SERIF, HAND } from './shopkit.js';
import { groundY } from './layout.js';
import { P } from '../palette.js';

/* ====================================================================================================
   街屋の並び - a row of four narrow two-storey Japanese street buildings in block sw1 (south of Kaigan-dori). Like the
   café and the bookstore further east, their fronts face south (onto the lane with the sakura plaza beyond); their
   backs, with the service bits of real houses, face Kaigan-dori. Shared walls, one family of parts (facade bands,
   framed windows with sills, parapets with copings, rooftop huts with doors, awnings, blade signs, planters), each
   building with its own character:

     A (east)   a quiet modern studio + flat: dark vertical metal panels, a dark plinth, a recessed oak-lined entrance,
                the big studio window with its plate, a projecting light-concrete window box upstairs, a narrow slot
                window, a parapet, a set-back stair hut with its door
     B          まんぷく食堂, the lively one: dark red brick with stone floor + cornice bands, a timber shopfront (head
                beam, posts, lit lattice window, glass doors, navy noren, a stone step), the sign board with two lamps,
                a striped awning with side cheeks on arms, a vertical 定食 sign, a red lantern; a real interior
     C          喫茶ひだまり, the warm eye-catcher: mustard plaster, white pilasters + cornice, a terracotta tiled
                base, a raised entrance up two steps, a green awning, a hanging 喫茶 sign; the balcony across the
                front (planters, an AC unit tucked in), two French windows; a parapet and a small plant room
     D (west)   an ordinary house with a small laundry: grey tiles below, light plaster above, a tiled pent eave, a
                half-raised shutter over the shop's glass, a lattice house door, a post box, a window flower guard,
                a low tiled gable
     ends       west: a two-bay parking corner with vending machines; east: bicycle racks + recycling bins
   Upper windows are lit (or not) in the evening like the rest of the town (category 'iza').
   ==================================================================================================== */

export const ROW = { x0: -41.6, x1: -19.6, zf: 19.4, zb: 13.7 }; // the fronts at zf (south), the backs at zb
export const ROW_PAD = [-48, -16.5, 12.0, 19.6]; // town/layout.js levels this; the front pavement falls gently to the lane
const Y = 0.45; // the levelled pad (layout.js swRowPad): PAV + 0.3
const GH = 3.0, FH = 2.7; // the ground floor, the upper floor

/* ---------------------------------------------------------------- textures */
const T = {};
const ct = (k, w, h, draw, o) => (T[k] ||= canvasTex(w, h, draw, o));
const panelTex = () => ct('srPanel', 256, 256, (g, w, h) => { const R = rng(3); for (let x = 0; x < w; x += 32) { const v = 90 + ((R() * 10) | 0); g.fillStyle = `rgb(${v + 2},${v - 2},${v + 10})`; /* warm charcoal around palette inkSoft */ g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, 0, 2, h); } }, { repeat: true });
const brickTex = () => ct('srBrick', 256, 256, (g, w, h) => { const R = rng(5); g.fillStyle = P.creamD; g.fillRect(0, 0, w, h); const bh = 16, bw = 48; for (let r = 0; r < h / bh; r++) for (let x = (r % 2) * -24; x < w; x += bw) { const v = (R() * 26) | 0; g.fillStyle = `rgb(${176 + v},${88 + (v >> 1)},${68 + (v >> 1)})`; /* coral brick (palette brick), light mortar */ g.fillRect(x + 2, r * bh + 2, bw - 3, bh - 3); } }, { repeat: true });
const mustardTex = () => ct('srMustard', 256, 256, (g, w, h) => { g.fillStyle = '#b5913f'; g.fillRect(0, 0, w, h); const R = rng(7); for (let i = 0; i < 2200; i++) { g.fillStyle = R() < 0.5 ? `rgba(230,200,120,${0.1 + R() * 0.1})` : `rgba(90,70,30,${0.05 + R() * 0.08})`; const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s); } g.fillStyle = 'rgba(70,55,30,0.12)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 1); }, { repeat: true });
const greyTileTex = () => ct('srGreyTile', 256, 256, (g, w, h) => { const R = rng(9); g.fillStyle = '#6a6e74'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = 128 + ((R() * 16) | 0); g.fillStyle = `rgb(${v},${v + 3},${v + 7})`; g.fillRect(x + 1, y + 1, 14, 14); } }, { repeat: true });
const kawaraTex = () => ct('srKawara', 128, 128, (g, w, h) => { g.fillStyle = '#4c5470'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = P.slate; /* slate tiles, like the izakaya */ g.fillRect(x + 2, 0, 9, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, 0, 2, h); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, w, 2); } }, { repeat: true });
const shutterTex = () => ct('srShutter', 64, 128, (g, w, h) => { g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 1); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + 1, w, 1); } }, { repeat: true });
const blindTex = (k) => ct(`srBlind${k}`, 64, 64, (g, w, h) => { g.fillStyle = k ? '#cdbf9e' : '#d9dbd6'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, w, 1); } });
const signTex = () => ct('srSign', 512, 96, (g, w, h) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a2e2a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); txt(g, '— まんぷく食堂 —', w / 2, h / 2 + 3, 56, '#a8302a', { font: SERIF, weight: 800 }); });
const norenTex = () => ct('srNoren', 256, 96, (g, w, h) => { g.fillStyle = '#23365c'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(240,240,240,0.85)'; g.lineWidth = 3; for (let x = -10; x < w; x += 28) { g.beginPath(); g.arc(x + 14, h - 8, 12, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x, h - 22, 12, Math.PI, 0); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h); txt(g, '食', w / 2, 34, 34, '#f2ecdc', { font: SERIF }); });
const awnTex = () => ct('srAwn', 128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#efe6d2' : '#a8402e'; g.fillRect(i * 16, 0, 16, h); } }, { repeat: true });
const menuTex = () => ct('srMenu', 192, 288, (g, w, h) => { g.fillStyle = '#20291f'; g.fillRect(0, 0, w, h); txt(g, '本日の定食', w / 2, 40, 28, '#f4f0e4', { font: SERIF }); ['焼き魚定食 850', '生姜焼き 880', 'カレー 750', '日替わり 800'].forEach((s, i) => txt(g, s, w / 2, 100 + i * 42, 22, '#e9e4d6', { font: HAND, weight: 600 })); });
const latticeTex = () => ct('srLattice', 128, 128, (g, w, h) => { g.fillStyle = '#fff1d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b4a32'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3); });
const posterTex = (k) => ct(`srPoster${k}`, 96, 128, (g, w, h) => { g.fillStyle = ['#f2e6c8', '#e8f0f2', '#fbe0e0'][k % 3]; g.fillRect(0, 0, w, h); g.fillStyle = ['#c0392b', '#2f5f8a', '#4f7f46'][k % 3]; g.fillRect(8, 10, w - 16, 26); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(10, 48 + i * 12, w - 20 - (i % 2) * 20, 5); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.panel) return M;
  M.panel = toon('#ffffff', { map: panelTex(), nocache: true, lit: 0.04 });
  M.brick = toon('#ffffff', { map: brickTex(), nocache: true, lit: 0.04 });
  M.mustard = toon('#ffffff', { map: mustardTex(), nocache: true, lit: 0.04 });
  M.greyTile = toon('#ffffff', { map: greyTileTex(), nocache: true, lit: 0.04 });
  M.kawara = toon('#ffffff', { map: kawaraTex(), nocache: true });
  M.shutter = toon('#ffffff', { map: shutterTex(), nocache: true });
  M.frame = toon(P.ink);
  M.frameW = toon('#e8e2d4');
  M.concrete = toon('#9c9a94');
  M.concreteL = toon('#c4c0b6');
  M.wood = toon('#6b4a32', { lit: 0.08 });
  M.woodL = toon('#a07c55', { lit: 0.1 });
  M.metal = toon('#5a5f66');
  M.rail = toon('#2e3b33');
  M.white = toon('#e9e6de');
  M.red = toon('#8a2a24');
  M.green = toon('#2f5a3a');
  return M;
}

/* ---------------------------------------------------------------- helpers */
export function rbx(p, mat, x0, x1, y0, y1, z0, z1, { r = 0.012, tile = 1, cast = true } = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)); if (ax >= ay && ax >= az) U.setXY(i, P.getZ(i) / tile, P.getY(i) / tile); else if (ay >= az) U.setXY(i, P.getX(i) / tile, P.getZ(i) / tile); else U.setXY(i, P.getX(i) / tile, P.getY(i) / tile); }
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; p.add(m);
  return m;
}
/**
 * a window on a facade at z (s = +1: facing south / +z, the fronts; -1: facing north, the backs), x0 .. x1, y0 .. y1:
 * a dark reveal, a slim frame with mullions, glass, and a room behind it (blinds / curtain / dark, lit in the evening)
 */
let wSeed = 400;
export function win(p, z, s, x0, x1, y0, y1, { mull = 0, frame, inner = 'blind', sill = true, lit = true, tint = 0xe8f0f4 } = {}) {
  // layers out from the wall: the dark reveal, the room behind (a plane), the frame, the glass
  const m = mats(), fr = frame || m.frame, k = 0.04, zr = z + s * 0.008, zbk = z + s * 0.012, zfr = z + s * 0.03, zgl = z + s * 0.036;
  bx(p, toon('#24272b'), x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, Math.min(z, zr), Math.max(z, zr), { cast: false }); // the reveal
  const f = (a, b, c, d) => bx(p, fr, a, b, c, d, zfr - 0.012, zfr + 0.012, { cast: false });
  f(x0, x1, y0, y0 + k); f(x0, x1, y1 - k, y1); f(x0, x0 + k, y0, y1); f(x1 - k, x1, y0, y1);
  for (let i = 1; i <= mull; i++) { const x = x0 + ((x1 - x0) * i) / (mull + 1); f(x - k / 2, x + k / 2, y0, y1); }
  const w = x1 - x0, h = y1 - y0, ry = s < 0 ? Math.PI : 0;
  const on = lit && (wSeed * 37) % 10 < 6; // some rooms lit in the evening, some not
  const back = inner === 'dark' ? toon('#2a2f36') : on ? glow(inner === 'curtain' ? '#ffdcae' : '#ffe6c0', 0.9, { cat: 'iza', off: inner === 'curtain' ? '#b9ae9c' : '#aeb3b6', map: inner === 'curtain' ? null : blindTex(wSeed % 2) }) : toon('#ffffff', { map: blindTex(wSeed % 2) }); // blinds / curtains by day, lit (or not) at night
  const bp = pl(p, back, w - 0.06, h - 0.06, (x0 + x1) / 2, (y0 + y1) / 2, zbk, ry, 0); bp.userData.noLine = true;
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), makeGlass(w, h, wSeed++, { alpha: 0.08, drops: 0.3, tint }));
  gp.position.set((x0 + x1) / 2, (y0 + y1) / 2, zgl); gp.rotation.y = ry; gp.userData.noLine = true; gp.renderOrder = 2; p.add(gp); reg.noRefl.push(gp);
  if (sill) bx(p, m.concreteL, x0 - 0.05, x1 + 0.05, y0 - 0.06, y0 - 0.01, z + s * 0.08, z, { cast: false });
}
/** an AC outdoor unit (on the ground or on a wall bracket) facing s */
export function acUnit(p, x, y, z, s) {
  const m = mats();
  bx(p, toon('#dcdcd6'), x - 0.38, x + 0.38, y, y + 0.55, Math.min(z, z + s * 0.28), Math.max(z, z + s * 0.28), { bevel: 0.015 });
  const f = cy(p, toon('#8e9298'), x - 0.08, y + 0.27, z + s * 0.285, 0.19, 0.01, 18); f.rotation.x = Math.PI / 2;
  if (y > Y + 0.3) [[-0.3], [0.3]].forEach(([d]) => bx(p, m.metal, x + d - 0.02, x + d + 0.02, y - 0.04, y, Math.min(z, z + s * 0.32), Math.max(z, z + s * 0.32), { cast: false }));
}
export function pipe(p, x, z, y0, y1, r = 0.04) { cy(p, toon('#b9b5ab'), x, y0, z, r, y1 - y0, 8); }
export function railing(p, pts, y, h = 1.0) {
  const m = mats();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx2, bz] = pts[i + 1], L = Math.hypot(bx2 - ax, bz - az), n = Math.max(1, Math.round(L / 0.14));
    for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx2 - ax) * t, z = az + (bz - az) * t; cyl2(p, m.metal, [x, y, z], [x, y + h, z], k % 7 === 0 ? 0.022 : 0.009, 4, { noLine: true }); }
    cyl2(p, m.metal, [ax, y + h, az], [bx2, y + h, bz], 0.022, 6); cyl2(p, m.metal, [ax, y + 0.1, az], [bx2, y + 0.1, bz], 0.014, 5, { noLine: true });
  }
}
/** a flat roof's take of leaves / snow (two near-flat halves meeting along the centre) */
function flatPile(id, x0, x1, z0, z1, y) {
  const xc = (x0 + x1) / 2, half = (x1 - x0) / 2, w = { leaf: 0.4 }; // leaves + snow (no pink patches on the roofs)
  return [
    { id: id + 'W', a: [xc, z1], b: [xc, z0], n: [-1, 0], D: half, y, drop: 0.02, w, snow: 0.15, ridge: true },
    { id: id + 'E', a: [xc, z0], b: [xc, z1], n: [1, 0], D: half, y, drop: 0.02, w, snow: 0.15, ridge: true },
  ];
}

/* ---------------------------------------------------------------- shared facade parts */
// the fronts face south (+z, s = +1), like the café and the bookstore further east; the backs face Kaigan-dori
const ZF = ROW.zf, ZB = ROW.zb, TOP = Y + GH + FH;
const signPlate = (k, w, h, draw) => new THREE.MeshBasicMaterial({ map: ct(k, Math.round(256 * Math.min(1, w / h)), Math.round(256 * Math.min(1, h / w)), draw) });
/** a plaque / sign plane on the front (facing +z) */
function plate(p, mat, w, h, x, y, z) { const s = pl(p, mat, w, h, x, y, z, 0, 0); s.userData.noLine = true; return s; }
/** a vertical blade sign standing out from the front at x (both faces), lit in the evening when `lit` */
function blade(p, x, y, z, w, h, draw, key, lit) {
  const m = mats();
  rbx(p, m.metal, x - 0.02, x + 0.02, y + h / 2 - 0.05, y + h / 2 + 0.05, z, z + 0.25, { r: 0.006 });
  rbx(p, m.frame, x - 0.04, x + 0.04, y - h / 2 - 0.03, y + h / 2 + 0.03, z + 0.25, z + 0.25 + w + 0.06, { r: 0.01 });
  const tex = ct(key, 64, Math.round(64 * h / w), draw);
  [1, -1].forEach((s) => { const mat = lit ? glow('#ffffff', 1.1, { cat: 'iza', map: tex, off: '#d8d2c6' }) : new THREE.MeshBasicMaterial({ map: tex }); const b = pl(p, mat, w, h, x + s * 0.042, y, z + 0.28 + w / 2, s * Math.PI / 2, 0); b.userData.noLine = true; });
}
/** a horizontal band (string course / floor line) across the front */
function band(p, mat, x0, x1, y0, y1, d = 0.06) { rbx(p, mat, x0, x1, y0, y1, ZF - 0.01, ZF + d, { r: 0.01 }); }
/** a parapet cap round the roof edge and the plain roof deck */
function parapet(p, mat, x0, x1, z0, z1, top, h = 0.32) {
  rbx(p, mat, x0, x1, top, top + h, z1 - 0.18, z1, { r: 0.015 }); rbx(p, mat, x0, x1, top, top + h, z0, z0 + 0.18, { r: 0.015 });
  rbx(p, mat, x0, x0 + 0.18, top, top + h, z0, z1, { r: 0.015 }); rbx(p, mat, x1 - 0.18, x1, top, top + h, z0, z1, { r: 0.015 });
  rbx(p, toon(P.roofFlat), x0 + 0.18, x1 - 0.18, top, top + 0.03, z0 + 0.18, z1 - 0.18, { r: 0.004, cast: false });
  rbx(p, mats().concreteL, x0 - 0.04, x1 + 0.04, top + h, top + h + 0.05, z1 - 0.22, z1 + 0.04, { r: 0.01 }); // the front coping
}
/** a rooftop stair hut / plant room with its door on the front */
function hut(p, mat, x0, x1, z0, z1, y, h, door = true) {
  rbx(p, mat, x0, x1, y, y + h, z0, z1, { r: 0.02, tile: 1.6 });
  rbx(p, toon(P.roofMetal), x0 - 0.06, x1 + 0.06, y + h, y + h + 0.08, z0 - 0.06, z1 + 0.12, { r: 0.012 }); // the hut's roof (warm grey metal)
  if (door) { // the door and its lamp follow the hut's size
    const dx = (x0 + x1) / 2, dw = Math.min(0.36, (x1 - x0) * 0.22), dh = h * 0.78;
    rbx(p, mats().metal, dx - dw, dx + dw, y, y + dh, z1, z1 + 0.04, { r: 0.006 }); bx(p, toon('#c9c4b8'), dx + dw - 0.16, dx + dw - 0.1, y + dh * 0.49, y + dh * 0.49 + 0.05, z1 + 0.04, z1 + 0.07, { cast: false });
    bx(p, glow('#ffe2b8', 1.6, { cat: 'iza', off: '#cfc8b8' }), dx - 0.07, dx + 0.07, y + dh + 0.06, y + dh + 0.14, z1, z1 + 0.06, { cast: false });
  }
}
/** a planter box (on a sill or the ground) with a few flowers */
export function flowerBox(p, x0, x1, y, z, seed) {
  const R = rng(seed), m = mats();
  rbx(p, m.wood, x0, x1, y, y + 0.18, z, z + 0.22, { r: 0.01 });
  for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.16) { sph(p, toon('#4f7f46'), 0.08, x, y + 0.22, z + 0.11, 1, 0.8, 1); if (R() < 0.6) sph(p, toon(['#e86a8a', '#ffffff', '#f2d23a', '#c96ad8'][(R() * 4) | 0]), 0.035, x + (R() - 0.5) * 0.06, y + 0.3, z + 0.11 + (R() - 0.5) * 0.06); }
}

/* ---------------------------------------------------------------- the four buildings */
/** A - a quiet modern studio + flat: dark vertical metal panels, a light concrete window box, an oak-lined recessed entrance */
function bldA(g, piles) {
  const m = mats(), x0 = -24.3, x1 = -19.6, top = TOP;
  const ent = [-20.95, -19.9], DEP = 0.75;
  // the body: upper floor whole; the ground floor round the entrance recess
  rbx(g, m.panel, x0, x1, Y + GH, top, ZB, ZF, { tile: 2, r: 0.02 });
  rbx(g, m.panel, x0, ent[0], Y, Y + GH, ZB, ZF, { tile: 2 }); rbx(g, m.panel, ent[1], x1, Y, Y + GH, ZB, ZF, { tile: 2 }); rbx(g, m.panel, ent[0], ent[1], Y, Y + GH, ZB, ZF - DEP, { tile: 2 });
  rbx(g, toon(P.ink), x0 - 0.02, x1 + 0.02, Y - 0.02, Y + 0.35, ZF - 0.05, ZF + 0.03, { r: 0.01 }); // the dark plinth
  band(g, m.concreteL, x0, x1, Y + GH - 0.08, Y + GH + 0.04, 0.05); // the floor line
  // the entrance recess: oak walls + soffit, an oak door, a wall lamp, the number, the intercom
  rbx(g, m.woodL, ent[0], ent[0] + 0.04, Y, Y + 2.5, ZF - DEP, ZF, { r: 0.004 }); rbx(g, m.woodL, ent[1] - 0.04, ent[1], Y, Y + 2.5, ZF - DEP, ZF, { r: 0.004 }); rbx(g, m.woodL, ent[0], ent[1], Y + 2.5, Y + 2.54, ZF - DEP, ZF, { r: 0.004 });
  rbx(g, m.wood, ent[0] + 0.12, ent[1] - 0.12, Y, Y + 2.3, ZF - DEP, ZF - DEP + 0.04, { r: 0.008 }); bx(g, m.frame, ent[1] - 0.24, ent[1] - 0.21, Y + 0.8, Y + 1.5, ZF - DEP + 0.04, ZF - DEP + 0.07, { cast: false });
  bx(g, glow('#ffe2b8', 1.8, { cat: 'iza', off: '#d8d0c0' }), ent[0] + 0.04, ent[0] + 0.07, Y + 1.8, Y + 2.1, ZF - 0.4, ZF - 0.3, { cast: false }); halo(g, ent[0] + 0.3, Y + 1.9, ZF - 0.3, '#ffd9a8', 0.9, 0.3, 'iza');
  rbx(g, m.concrete, ent[0] - 0.05, ent[1] + 0.05, Y - 0.04, Y + 0.12, ZF, ZF + 0.4, { r: 0.01 }); // the step out
  plate(g, signPlate('srNumA', 0.24, 0.12, (c, w, h) => { c.fillStyle = '#e8e2d4'; c.fillRect(0, 0, w, h); txt(c, '3-12', w / 2, h / 2 + 2, h * 0.55, '#2b2b2b', { font: SERIF }); }), 0.24, 0.12, ent[0] - 0.3, Y + 1.7, ZF + 0.002);
  rbx(g, m.frame, ent[0] - 0.42, ent[0] - 0.24, Y + 1.15, Y + 1.38, ZF, ZF + 0.03, { r: 0.006 });
  // the studio window with its small black plate
  win(g, ZF, 1, -24.0, -21.35, Y + 0.55, Y + 2.55, { mull: 2, inner: 'curtain', sill: false });
  plate(g, signPlate('srStudioA', 0.9, 0.16, (c, w, h) => { c.fillStyle = '#1e2024'; c.fillRect(0, 0, w, h); txt(c, 'STUDIO  MONO', w / 2, h / 2 + 2, h * 0.5, '#e8e2d4', { font: SERIF, weight: 600 }); }), 0.9, 0.16, -22.67, Y + 2.75, ZF + 0.002);
  // upstairs: the projecting light concrete window box, a narrow vertical window beside it
  { const a = -24.0, b = -21.55, y0 = Y + GH + 0.35, y1 = top - 0.4, d = 0.42;
    rbx(g, m.concreteL, a, b, y0 - 0.12, y0, ZF, ZF + d, { r: 0.015 }); rbx(g, m.concreteL, a, b, y1, y1 + 0.12, ZF, ZF + d, { r: 0.015 });
    rbx(g, m.concreteL, a, a + 0.12, y0 - 0.12, y1 + 0.12, ZF, ZF + d, { r: 0.015 }); rbx(g, m.concreteL, b - 0.12, b, y0 - 0.12, y1 + 0.12, ZF, ZF + d, { r: 0.015 });
    win(g, ZF + 0.12, 1, a + 0.12, b - 0.12, y0, y1, { mull: 1, sill: false }); }
  win(g, ZF, 1, -21.0, -20.55, Y + GH + 0.35, top - 0.4, { sill: false, inner: 'curtain' });
  // the roof: parapet, a set-back stair hut with its door, a short railing, a condenser
  parapet(g, m.frame, x0, x1, ZB, ZF, top, 0.28);
  hut(g, m.concreteL, -21.5, -20.05, 14.1, 15.5, top + 0.03, 1.4);
  railing(g, [[x0 + 0.25, ZF - 0.3], [-21.9, ZF - 0.3]], top + 0.28, 0.85);
  acUnit(g, -23.2, top + 0.03, 15.2, 1);
  // the back (Kaigan-dori): two small windows per floor, a door, an AC unit, a downpipe
  [Y + 0.9, Y + GH + 0.7].forEach((y) => { win(g, ZB, -1, -23.6, -22.6, y, y + 1.1, { inner: 'curtain' }); });
  rbx(g, m.metal, -21.3, -20.5, Y, Y + 2.05, ZB - 0.04, ZB, { r: 0.006 }); acUnit(g, -22.0, Y + GH + 0.3, ZB, -1); pipe(g, x1 - 0.12, ZB - 0.08, Y, top);
  piles.push(...flatPile('srA', x0, x1, ZB, ZF, top + 0.03));
}

/** B - まんぷく食堂: dark red brick, stone floor bands, a timber shopfront, the striped awning with side cheeks, a vertical sign */
function bldB(g, piles) {
  const m = mats(), x0 = -30.6, x1 = -24.3, top = TOP + 0.12, sh = Y + 2.65, KZ = 16.3; // KZ: the kitchen wall
  rbx(g, m.brick, x0, x1, Y + GH, top, ZB, ZF, { tile: 1.6, r: 0.02 });
  rbx(g, m.brick, x0, x1, Y, Y + GH, ZB, KZ, { tile: 1.6 });
  rbx(g, m.brick, x0, x0 + 0.3, Y, Y + GH, KZ, ZF, { tile: 1.6 }); rbx(g, m.brick, x1 - 0.6, x1, Y, Y + GH, KZ, ZF, { tile: 1.6 });
  band(g, toon('#d8d0c0'), x0, x1, Y + GH - 0.06, Y + GH + 0.08, 0.06); // the stone floor band
  band(g, toon('#d8d0c0'), x0, x1, top - 0.1, top, 0.07); // the cornice band
  rbx(g, toon(P.brickD), x0 + 0.08, x1 - 0.08, Y + GH + 1.95, Y + GH + 2.08, ZF - 0.01, ZF + 0.03, { r: 0.006 }); // soldier course over the windows
  // the timber shopfront: a head beam over the whole opening, posts, a lit lattice window (east), glass doors with the noren (west)
  const o0 = x0 + 0.3, o1 = x1 - 0.6, fz = ZF - 0.12;
  rbx(g, m.wood, o0 - 0.05, o1 + 0.05, sh, Y + GH, fz - 0.06, ZF + 0.08, { r: 0.012 });
  rbx(g, m.wood, o0, o1, Y, Y + 0.08, fz - 0.06, fz + 0.06, { r: 0.006 });
  [-29.0, -27.4].forEach((x) => rbx(g, m.wood, x - 0.05, x + 0.05, Y, sh, fz - 0.06, fz + 0.08, { r: 0.006 }));
  [[o0 + 0.02, -29.05], [-28.95, -27.45]].forEach(([a, b], i) => { const gp = new THREE.Mesh(new THREE.PlaneGeometry(b - a, sh - Y - 0.12), makeGlass(b - a, 2, 440 + i, { alpha: 0.06, drops: 0.3, tint: 0xfff2dc })); gp.position.set((a + b) / 2, (Y + sh) / 2, fz); gp.userData.noLine = true; gp.renderOrder = 2; g.add(gp); reg.noRefl.push(gp); });
  { const n = pl(g, new THREE.MeshBasicMaterial({ map: norenTex(), side: THREE.DoubleSide }), 2.9, 0.62, (o0 - 27.45) / 2, sh - 0.36, fz + 0.07, 0, 0); n.userData.noLine = true; }
  { const lw = pl(g, glow('#ffe9c4', 1.2, { cat: 'iza', off: '#d8ccb0', map: latticeTex() }), 2.0, 1.5, (-27.35 + o1) / 2, Y + 1.55, fz + 0.002, 0, 0); lw.userData.noLine = true; }
  rbx(g, m.wood, -27.35, o1, Y, Y + 0.75, fz - 0.06, fz + 0.06, { r: 0.006 });
  rbx(g, toon('#b8b2a6'), o0 - 0.1, -27.35, Y - 0.04, Y + 0.12, ZF, ZF + 0.45, { r: 0.012 }); // the entrance step
  // the sign board on the brick above the head beam
  rbx(g, m.wood, -30.15, -25.05, Y + GH + 0.1, Y + GH + 0.72, ZF, ZF + 0.08, { r: 0.012 });
  plate(g, new THREE.MeshBasicMaterial({ map: signTex() }), 4.9, 0.54, -27.6, Y + GH + 0.41, ZF + 0.082);
  [-29.6, -25.6].forEach((x) => { cyl2(g, m.metal, [x, Y + GH + 0.85, ZF], [x, Y + GH + 0.95, ZF + 0.35], 0.01, 4); bx(g, glow('#ffe2b0', 1.8, { cat: 'iza', off: '#d8d0c0' }), x - 0.06, x + 0.06, Y + GH + 0.88, Y + GH + 0.94, ZF + 0.32, ZF + 0.42, { cast: false }); });
  // the striped awning: canvas on arms, a straight valance, side cheeks
  {
    const ax0 = o0 - 0.05, ax1 = o1 + 0.05, d = 1.0, y0 = sh + 0.02, y1 = sh - 0.4, L = Math.hypot(d, y0 - y1);
    const geo = new THREE.PlaneGeometry(ax1 - ax0, L), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (ax1 - ax0) / 1.3);
    const cm = toon('#ffffff', { map: awnTex(), nocache: true, side: THREE.DoubleSide });
    const aw = new THREE.Mesh(geo, cm); aw.position.set((ax0 + ax1) / 2, (y0 + y1) / 2, ZF + d / 2); aw.rotation.x = -Math.atan2(d, y0 - y1); aw.castShadow = true; g.add(aw);
    const vg = new THREE.PlaneGeometry(ax1 - ax0, 0.2), vu = vg.attributes.uv; for (let i = 0; i < vu.count; i++) vu.setX(i, vu.getX(i) * (ax1 - ax0) / 1.3);
    const val = new THREE.Mesh(vg, cm); val.position.set((ax0 + ax1) / 2, y1 - 0.1, ZF + d); val.userData.noLine = true; g.add(val);
    [ax0, ax1].forEach((x) => { const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(d, -(y0 - y1)); sh2.lineTo(d, -(y0 - y1) - 0.2); sh2.closePath(); const cg = new THREE.ShapeGeometry(sh2); cg.rotateY(-Math.PI / 2); const ch = new THREE.Mesh(cg, toon('#a8402e', { side: THREE.DoubleSide })); ch.position.set(x, y0, ZF); ch.userData.noLine = true; g.add(ch); });
    [ax0 + 0.3, ax1 - 0.3].forEach((x) => cyl2(g, m.metal, [x, sh - 0.6, ZF], [x, y1 + 0.02, ZF + d - 0.05], 0.012, 5));
    piles.push({ id: 'srBawn', a: [ax1, ZF], b: [ax0, ZF], n: [0, 1], D: d, y: y0, drop: y0 - y1, w: { leaf: 0.3 }, snow: 0.06 });
  }
  // the vertical sign on the east pier, the red lantern on the west, the door to the flat upstairs
  blade(g, x1 - 0.3, Y + GH + 0.6, ZF, 0.34, 1.3, (c, w, h) => { c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a2e2a'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); ['定', '食'].forEach((s, i) => txt(c, s, w / 2, h * (0.3 + i * 0.4), w * 0.62, '#a8302a', { font: SERIF, weight: 800 })); }, 'srBladeB', true);
  cyl2(g, m.metal, [x0 + 0.15, Y + 2.55, ZF], [x0 + 0.15, Y + 2.55, ZF + 0.3], 0.01, 4); sph(g, glow('#ff6a4a', 1.6, { cat: 'iza', off: '#a8302a' }), 0.16, x0 + 0.15, Y + 2.2, ZF + 0.32, 1, 1.35, 1); halo(g, x0 + 0.15, Y + 2.2, ZF + 0.4, '#ff9a6a', 1.0, 0.35, 'iza');
  rbx(g, m.wood, x1 - 0.55, x1 - 0.08, Y, Y + 2.1, ZF, ZF + 0.03, { r: 0.006 }); rbx(g, m.frame, x1 - 0.5, x1 - 0.13, Y + 2.2, Y + 2.25, ZF, ZF + 0.25, { r: 0.006 });
  // the diner inside: counter by the kitchen wall, stools, menu strips, two lanterns, the warm light
  {
    const ix0 = o0, ix1 = o1, iz0 = KZ, iz1 = fz - 0.08;
    rbx(g, toon('#8a6a4a', { lit: 0.2 }), ix0, ix1, Y, Y + 0.02, iz0, iz1, { r: 0.002, cast: false });
    rbx(g, toon('#efe4cc', { lit: 0.3 }), ix0, ix1, sh - 0.02, sh, iz0, iz1, { r: 0.002, cast: false });
    rbx(g, toon('#e8dcc0', { lit: 0.25 }), ix0, ix1, Y, sh, KZ + 0.012, KZ + 0.035, { r: 0.002, cast: false });
    rbx(g, m.wood, ix0 + 0.2, ix1 - 0.2, Y, Y + 1.05, KZ + 0.3, KZ + 0.7, { r: 0.01 }); rbx(g, m.woodL, ix0 + 0.15, ix1 - 0.15, Y + 1.05, Y + 1.1, KZ + 0.25, KZ + 0.85, { r: 0.008 });
    for (let k = 0; k < 5; k++) { const x = ix0 + 0.6 + k * 0.82; cy(g, m.frame, x, Y, KZ + 1.15, 0.03, 0.62, 6); cy(g, m.red, x, Y + 0.62, KZ + 1.15, 0.17, 0.06, 14); }
    for (let k = 0; k < 9; k++) plate(g, toon('#ffffff', { map: ct(`srMenuS${k % 3}`, 32, 128, (c, w, h) => { c.fillStyle = ['#fbf6ea', '#f6e8c8', '#fbf6ea'][k % 3]; c.fillRect(0, 0, w, h); ['焼', '魚', '定', '食'].forEach((s2, i) => txt(c, s2, w / 2, 18 + i * 28, 20, '#2b2b2b', { font: SERIF })); }), nocache: true, lit: 0.25 }), 0.16, 0.6, ix0 + 0.35 + k * 0.48, Y + 1.85, KZ + 0.04);
    [ix0 + 1.3, ix1 - 1.3].forEach((x) => { cyl2(g, m.frame, [x, sh - 0.02, KZ + 1.4], [x, sh - 0.45, KZ + 1.4], 0.006, 4, { noLine: true }); sph(g, glow('#ffd59a', 1.8, { cat: 'iza', off: '#efe4cc' }), 0.13, x, sh - 0.6, KZ + 1.4, 1, 1.25, 1); });
    plight(g, '#ffcf8f', 7, 7, (ix0 + ix1) / 2, Y + 2.0, KZ + 1.6, 'streetShop');
    noSnowBox(ix0, iz0, ix1, iz1, sh);
  }
  // upstairs: three windows with stone sills, a flower box under the middle one
  [[-30.0, -28.75], [-28.15, -26.9], [-26.3, -25.05]].forEach(([a, b], i) => { win(g, ZF, 1, a, b, Y + GH + 0.75, Y + GH + 1.9, { mull: 1 }); if (i === 1) flowerBox(g, a + 0.05, b - 0.05, Y + GH + 0.52, ZF + 0.02, 71); });
  // the roof: parapet + coping, a railing, the brick stair hut with its door
  parapet(g, toon(P.brickD), x0, x1, ZB, ZF, top, 0.3);
  railing(g, [[x0 + 0.25, ZF - 0.32], [x1 - 0.25, ZF - 0.32]], top + 0.3, 0.8);
  hut(g, m.brick, -30.0, -28.5, 14.0, 15.4, top + 0.03, 1.4);
  // the back (Kaigan-dori): windows, the kitchen door, propane, the exhaust duct, AC
  [Y + GH + 0.75].forEach((y) => win(g, ZB, -1, -29.5, -27.9, y, y + 1.1, { inner: 'curtain' }));
  win(g, ZB, -1, -26.6, -25.4, Y + 1.3, Y + 2.2, { inner: 'dark', lit: false });
  rbx(g, m.metal, -28.4, -27.6, Y, Y + 2.05, ZB - 0.04, ZB, { r: 0.006 });
  [[-29.6, 0], [-29.25, 1]].forEach(([x]) => { cy(g, toon('#c9c4b8'), x, Y, ZB - 0.3, 0.16, 0.85, 14); sph(g, toon('#c9c4b8'), 0.16, x, Y + 0.85, ZB - 0.3, 1, 0.5, 1); cy(g, m.metal, x, Y + 0.95, ZB - 0.3, 0.035, 0.1, 6); });
  rbx(g, m.metal, -26.0, -25.6, Y + 2.3, top - 0.2, ZB - 0.3, ZB, { r: 0.01 }); acUnit(g, -24.9, Y + GH + 0.3, ZB, -1);
  piles.push(...flatPile('srB', x0, x1, ZB, ZF, top + 0.03));
}

/** C - 喫茶ひだまり: the warm one - mustard plaster, white trims, a terracotta base, the balcony over a raised entrance */
function bldC(g, piles) {
  const m = mats(), x0 = -36.4, x1 = -30.6, top = TOP, zf = ZF - 0.15;
  const white = toon('#f0ece2', { lit: 0.08 }), terra = toon('#a8583a');
  rbx(g, m.mustard, x0, x1, Y, top, ZB, zf, { tile: 2, r: 0.02 });
  rbx(g, terra, x0 - 0.02, x1 + 0.02, Y - 0.02, Y + 0.55, zf - 0.04, zf + 0.04, { r: 0.012, tile: 0.5 }); // the tiled base
  [x0 + 0.06, x1 - 0.06].forEach((x) => rbx(g, white, x - 0.08, x + 0.08, Y, top, zf - 0.02, zf + 0.06, { r: 0.012 })); // white pilasters
  rbx(g, white, x0 - 0.04, x1 + 0.04, top - 0.18, top + 0.06, zf - 0.04, zf + 0.12, { r: 0.015 }); // the cornice
  // ground floor: the café window (west), the raised entrance with two steps (east)
  win(g, zf, 1, -36.0, -32.9, Y + 0.65, Y + 2.55, { mull: 2, frame: white, inner: 'curtain', sill: true, tint: 0xfff0d8 });
  plate(g, toon('#ffffff', { map: ct('srCafeCurtain', 128, 32, (c, w, h) => { c.fillStyle = '#f6efe0'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(160,80,50,0.35)'; for (let x = 0; x < w; x += 10) c.fillRect(x, 0, 4, h); }), nocache: true, lit: 0.2 }), 3.0, 0.5, -34.45, Y + 1.05, zf + 0.02);
  { const ex0 = -32.55, ex1 = -31.25;
    [[ex0 - 0.1, ex0, Y, Y + 2.62], [ex1, ex1 + 0.1, Y, Y + 2.62], [ex0 - 0.1, ex1 + 0.1, Y + 2.52, Y + 2.62]].forEach(([a, b, c, d]) => rbx(g, white, a, b, c, d, zf - 0.02, zf + 0.08, { r: 0.012 })); // the white door frame
    rbx(g, m.wood, ex0, ex1, Y + 0.3, Y + 2.5, zf, zf + 0.04, { r: 0.008 });
    { const gp = new THREE.Mesh(new THREE.PlaneGeometry(ex1 - ex0 - 0.3, 1.2), makeGlass(1, 1.2, 470, { alpha: 0.07, drops: 0.3, tint: 0xfff0d8 })); gp.position.set((ex0 + ex1) / 2, Y + 1.75, zf + 0.045); gp.userData.noLine = true; gp.renderOrder = 2; g.add(gp); reg.noRefl.push(gp); plate(g, glow('#ffe2b8', 0.9, { cat: 'iza', off: '#7a6a5a' }), ex1 - ex0 - 0.32, 1.18, (ex0 + ex1) / 2, Y + 1.75, zf + 0.042); }
    bx(g, toon('#c9a24a'), ex1 - 0.2, ex1 - 0.16, Y + 1.2, Y + 1.5, zf + 0.04, zf + 0.08, { cast: false });
    [0, 1].forEach((k) => rbx(g, toon('#b8b2a6'), ex0 - 0.12 - k * 0.12, ex1 + 0.12 + k * 0.12, Y - 0.04, Y + 0.3 - k * 0.15, zf, zf + 0.35 + k * 0.32, { r: 0.012 }));
  }
  // the green canvas awning over the window, the hanging blade sign
  {
    const ax0 = -36.1, ax1 = -32.75, d = 0.6, y0 = Y + 2.78, y1 = Y + 2.55; // under the balcony slab
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(ax1 - ax0, Math.hypot(d, y0 - y1)), toon('#2f5a44', { side: THREE.DoubleSide })); aw.position.set((ax0 + ax1) / 2, (y0 + y1) / 2, zf + d / 2); aw.rotation.x = -Math.atan2(d, y0 - y1); aw.castShadow = true; g.add(aw);
    plate(g, toon('#ffffff', { map: ct('srCafeVal', 256, 32, (c, w, h) => { c.fillStyle = '#2f5a44'; c.fillRect(0, 0, w, h); txt(c, '喫茶 ひだまり · COFFEE', w / 2, h / 2 + 1, 17, '#f2ecdc', { font: SERIF }); }), nocache: true, side: THREE.DoubleSide }), ax1 - ax0, 0.2, (ax0 + ax1) / 2, y1 - 0.1, zf + d);
    piles.push({ id: 'srCawn', a: [ax1, zf], b: [ax0, zf], n: [0, 1], D: d, y: y0, drop: y0 - y1, w: { leaf: 0.3 }, snow: 0.06 });
  }
  blade(g, x0 + 0.3, Y + 2.0, zf + 0.06, 0.3, 1.0, (c, w, h) => { c.fillStyle = '#2f5a44'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2ecdc'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8); ['喫', '茶'].forEach((s, i) => txt(c, s, w / 2, h * (0.3 + i * 0.4), w * 0.6, '#f2ecdc', { font: SERIF, weight: 800 })); }, 'srBladeC', true);
  // upstairs: the balcony across the front (it shelters the entrance), two French windows, planters, an AC unit
  { const by = Y + GH, d = 0.85;
    rbx(g, white, x0 + 0.1, x1 - 0.1, by - 0.14, by, zf, zf + d, { r: 0.02 });
    railing(g, [[x0 + 0.15, zf + 0.02], [x0 + 0.15, zf + d - 0.05], [x1 - 0.15, zf + d - 0.05], [x1 - 0.15, zf + 0.02]], by, 0.95);
    [[-35.85, -33.75], [-33.25, -31.15]].forEach(([a, b]) => win(g, zf, 1, a, b, by + 0.05, top - 0.5, { mull: 1, frame: white, sill: false }));
    [[-36.1, -35.3], [-31.9, -31.1]].forEach(([a, b], i) => flowerBox(g, a, b, by, zf + d - 0.32, 81 + i));
    acUnit(g, -33.5, by, zf + 0.12, 1);
    [x0 + 0.2, x1 - 0.2].forEach((x) => cy(g, white, x, by - 0.14, zf + d - 0.08, 0.025, 0.01, 6)); }
  pipe(g, x1 - 0.2, zf + 0.08, Y, top, 0.035);
  // the roof: parapet, railing, the small plant room
  parapet(g, white, x0, x1, ZB, zf, top, 0.24);
  railing(g, [[x0 + 0.25, zf - 0.3], [x1 - 0.25, zf - 0.3]], top + 0.24, 0.85);
  hut(g, m.mustard, -35.4, -33.8, 14.0, 15.2, top + 0.03, 1.2);
  // the back (Kaigan-dori): windows, a door, AC
  win(g, ZB, -1, -35.8, -34.2, Y + GH + 0.7, Y + GH + 1.9, { mull: 1, inner: 'curtain' });
  rbx(g, m.metal, -32.4, -31.6, Y, Y + 2.05, ZB - 0.04, ZB, { r: 0.006 }); acUnit(g, -33.6, Y, ZB, -1);
  piles.push(...flatPile('srC', x0, x1, ZB, zf, top + 0.03));
}

/** D - an ordinary house with a small laundry shop: grey tiles below, light plaster above, a tiled pent eave, a low gable */
function bldD(g, piles) {
  const m = mats(), x0 = -41.6, x1 = -36.4, top = TOP, zf = ZF - 0.3, ridge = top + 1.25, zc = (zf + ZB) / 2;
  const plaster = toon('#d6d2c8', { lit: 0.05 });
  rbx(g, m.greyTile, x0, x1, Y, Y + GH, ZB, zf, { tile: 1.2, r: 0.02 });
  rbx(g, plaster, x0, x1, Y + GH, top, ZB, zf, { tile: 2, r: 0.02 });
  // the low tiled gable (ridge along x), its gable ends filled, a ridge roll
  const half = (zf - ZB) / 2 + 0.45, pitch = Math.atan2(ridge - top, half), L = Math.hypot(half, ridge - top);
  [-1, 1].forEach((s) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.5, 0.1, L + 0.05), M.kawara); r.position.set((x0 + x1) / 2, (top + ridge) / 2 + 0.05, zc + s * half / 2); r.rotation.x = s * pitch; r.castShadow = true; r.receiveShadow = true;
    const uv = r.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0 + 0.5) / 0.9, uv.getY(i) * L / 0.9); g.add(r);
  });
  cyl2(g, toon('#4a5068'), [x0 - 0.25, ridge + 0.1, zc], [x1 + 0.25, ridge + 0.1, zc], 0.07, 8); // slate ridge, like the izakaya
  [x0, x1].forEach((x) => { const sh = new THREE.Shape(); sh.moveTo(zf - zc, 0); sh.lineTo(0, ridge - top); sh.lineTo(ZB - zc, 0); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); geo.rotateY(Math.PI / 2); const gm = new THREE.Mesh(geo, plaster); gm.position.set(x - 0.06, top, zc); gm.castShadow = true; g.add(gm); });
  // the tiled pent eave over the ground floor (front)
  { const d = 0.72, y0 = Y + GH + 0.12, y1 = Y + GH - 0.15, r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.07, Math.hypot(d, y0 - y1)), M.kawara); r.position.set((x0 + x1) / 2, (y0 + y1) / 2, zf + d / 2); r.rotation.x = Math.atan2(y0 - y1, d); r.castShadow = true; g.add(r); piles.push({ id: 'srDeave', a: [x1, zf], b: [x0, zf], n: [0, 1], D: d, y: y0 + 0.04, drop: y0 - y1, w: { leaf: 0.4 }, snow: 0.1 }); }
  // ground floor: the laundry (a half-raised shutter over its glass front, its small sign), the house door, a post box
  { const a = -41.3, b = -38.95;
    win(g, zf, 1, a, b, Y + 0.1, Y + 2.35, { mull: 1, inner: 'curtain', sill: false, tint: 0xe8f2f6 });
    rbx(g, m.shutter, a - 0.02, b + 0.02, Y + 1.7, Y + 2.4, zf + 0.04, zf + 0.08, { tile: 1, r: 0.004 }); rbx(g, m.metal, a - 0.05, b + 0.05, Y + 2.4, Y + 2.62, zf, zf + 0.14, { r: 0.012 });
    plate(g, signPlate('srLaundry', 1.6, 0.26, (c, w, h) => { c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6f9a'; c.fillRect(0, 0, 18, h); txt(c, 'クリーニング はやし', w / 2 + 8, h / 2 + 2, h * 0.5, '#2f4a6b', { font: SERIF, weight: 700 }); }), 1.6, 0.26, (a + b) / 2, Y + 2.78, zf + 0.002); }
  rbx(g, m.woodL, -38.4, -37.25, Y, Y + 2.2, zf, zf + 0.04, { r: 0.006 }); plate(g, glow('#ffe9c4', 0.8, { cat: 'iza', off: '#c8bca4', map: latticeTex() }), 0.95, 1.9, -37.83, Y + 1.1, zf + 0.042);
  rbx(g, m.red, -38.75, -38.5, Y + 1.0, Y + 1.32, zf, zf + 0.13, { r: 0.01 });
  plate(g, signPlate('srNameD', 0.3, 0.12, (c, w, h) => { c.fillStyle = '#3a2a22'; c.fillRect(0, 0, w, h); txt(c, '林', w / 2, h / 2 + 2, h * 0.7, '#f2e6cc', { font: SERIF }); }), 0.2, 0.08, -36.95, Y + 1.7, zf + 0.002);
  win(g, zf, 1, -37.05, -36.65, Y + 1.1, Y + 2.2, { inner: 'curtain', sill: false });
  // upstairs: a window with an iron flower guard, a smaller one, an AC unit on its bracket
  win(g, zf, 1, -41.1, -39.4, Y + GH + 0.7, Y + GH + 1.9, { mull: 1, inner: 'curtain' });
  rbx(g, m.rail, -41.2, -39.3, Y + GH + 0.6, Y + GH + 0.64, zf + 0.04, zf + 0.3, { r: 0.006 }); for (let x = -41.15; x <= -39.35; x += 0.12) cyl2(g, m.rail, [x, Y + GH + 0.64, zf + 0.28], [x, Y + GH + 1.0, zf + 0.28], 0.007, 4, { noLine: true }); cyl2(g, m.rail, [-41.2, Y + GH + 1.0, zf + 0.28], [-39.3, Y + GH + 1.0, zf + 0.28], 0.012, 5);
  win(g, zf, 1, -38.3, -37.3, Y + GH + 0.9, Y + GH + 1.8, { inner: 'curtain' });
  acUnit(g, -37.0, Y + GH + 0.2, zf, 1);
  // the west wall faces the parking: a small window, a pipe; the back: windows, a door, AC
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glow('#ffe3b8', 0.8, { cat: 'iza', off: '#a8a49a' })); w.position.set(x0 - 0.012, Y + GH + 1.4, 16.4); w.rotation.y = -Math.PI / 2; w.userData.noLine = true; g.add(w); bx(g, m.frame, x0 - 0.04, x0 - 0.01, Y + GH + 0.92, Y + GH + 1.88, 15.92, 16.88, { cast: false }); }
  pipe(g, x0 - 0.06, zf - 0.3, Y, top);
  win(g, ZB, -1, -41.0, -39.6, Y + GH + 0.8, Y + GH + 1.8, { mull: 1, inner: 'curtain' });
  rbx(g, m.wood, -38.2, -37.4, Y, Y + 2.0, ZB - 0.04, ZB, { r: 0.006 }); acUnit(g, -39.0, Y, ZB, -1);
  piles.push(
    { id: 'srDs', a: [x0 - 0.25, zc], b: [x1 + 0.25, zc], n: [0, -1], D: half, y: ridge + 0.1, drop: ridge - top, w: { leaf: 0.5 }, snow: 0.18, ridge: true },
    { id: 'srDn', a: [x1 + 0.25, zc], b: [x0 - 0.25, zc], n: [0, 1], D: half, y: ridge + 0.1, drop: ridge - top, w: { leaf: 0.5 }, snow: 0.18, ridge: true },
  );
}

/* ---------------------------------------------------------------- the row */
export function buildStreetRow(parent) {
  const m = mats();
  const g = grp(parent);
  g.name = 'streetRow';
  const piles = [];
  bldA(g, piles); bldB(g, piles); bldC(g, piles); bldD(g, piles);
  (reg.extraRoofs ||= []).push(...piles); // the roofs, the awnings and the eave take leaves / snow
  const st = (y = Y) => grp(g, 0, y - 0.15, 0); // street.js props stand at y 0.15
  const gy = (x, z) => groundY(x, z);

  /* ---- Kaigan-dori side (the backs): the kerb-side railing, grates (power: drops across the road, town/power.js) ---- */
  {
    const zr = 12.32;
    [[-47.4, -43.2], [-41.4, -36.1], [-35.3, -29.2], [-26.4, -20.2], [-19.2, -17.0]].forEach(([a, b]) => {
      const n = Math.max(1, Math.round((b - a) / 1.6));
      for (let k = 0; k <= n; k++) { const x = a + ((b - a) * k) / n; cy(g, m.rail, x, Y, zr, 0.025, 0.82, 8); sph(g, m.rail, 0.035, x, Y + 0.84, zr); }
      cyl2(g, m.rail, [a, Y + 0.8, zr], [b, Y + 0.8, zr], 0.02, 6); cyl2(g, m.rail, [a, Y + 0.45, zr], [b, Y + 0.45, zr], 0.014, 5, { noLine: true });
      for (let k = 0; k < n; k++) { const xa = a + ((b - a) * k) / n, xb = a + ((b - a) * (k + 1)) / n, xm = (xa + xb) / 2; cyl2(g, m.rail, [xa + 0.1, Y + 0.45, zr], [xm, Y + 0.72, zr], 0.01, 4, { noLine: true }); cyl2(g, m.rail, [xm, Y + 0.72, zr], [xb - 0.1, Y + 0.45, zr], 0.01, 4, { noLine: true }); }
    });
    [-44.0, -37.6, -31.0, -24.8, -18.4].forEach((x) => { bx(g, toon('#2a2d31'), x - 0.3, x + 0.3, Y + 0.002, Y + 0.012, 12.08, 12.3, { cast: false }); for (let k = 0; k < 7; k++) bx(g, toon('#5a5d61'), x - 0.27 + k * 0.09, x - 0.25 + k * 0.09, Y + 0.012, Y + 0.016, 12.1, 12.28, { cast: false }); });
    bx(g, toon('#cfcac0'), -19.95, -19.7, Y + 1.0, Y + 1.4, ZB - 0.12, ZB, { cast: false }); // a meter box
  }

  /* ---- the front pavement (south): a few things of daily life per shop, not too many ---- */
  {
    // B: the menu board, two pots, a stool, a bicycle, beer crates, a door mat, an umbrella stand
    { const z = ZF + 0.75, a = grp(g, -26.95, gy(-26.95, z), z, Math.PI - 0.1); [1, -1].forEach((s) => { const b = grp(a, 0, 0, s * 0.18, 0); b.rotation.x = -s * 0.2; bx(b, m.woodL, -0.26, 0.26, 0, 0.9, -0.02, 0.02, { bevel: 0.01 }); const p = pl(b, new THREE.MeshBasicMaterial({ map: menuTex() }), 0.44, 0.66, 0, 0.5, s * 0.022, s > 0 ? 0 : Math.PI, 0); p.userData.noLine = true; }); }
    [[-30.2, ZF + 0.35], [-25.2, ZF + 0.35]].forEach(([x, z], i) => { const y = gy(x, z), p = makePot({ r: 0.16, h: 0.3, seed: 30 + i }).group; p.position.set(x, y, z); g.add(p); const sb = makeShrub({ seed: 830 + i, width: 0.4, height: 0.42, palette: 'deep' }); sb.position.set(x, y + 0.28, z); g.add(sb); });
    { const x = -26.2, z = ZF + 0.4, y = gy(x, z); cy(g, m.wood, x, y, z, 0.16, 0.42, 10); cy(g, m.red, x, y + 0.42, z, 0.18, 0.05, 12); }
    bicycle(st(gy(-29.4, ZF + 1.0)), -29.4, ZF + 1.0, Math.PI / 2 - 0.15, '#2f6f9a', 0.12);
    { const x = -24.75, z = ZF + 0.4, y = gy(x, z); [[0, 0, 0], [0, 0.3, 0], [-0.44, 0, 1]].forEach(([dx, dy, k]) => bx(g, toon(k ? '#2f5a9a' : '#c43a2e'), x - 0.2 + dx, x + 0.2 + dx, y + dy, y + dy + 0.3, z - 0.2, z + 0.2, { bevel: 0.01 })); }
    cy(g, m.metal, -27.25, gy(-27.25, ZF + 0.25), ZF + 0.25, 0.11, 0.42, 10);
    // C: the café's A-board, pots on the steps, a small bench under the window
    { const z = ZF + 0.95, a = grp(g, -33.7, gy(-33.7, z), z, Math.PI + 0.1); [1, -1].forEach((s) => { const b = grp(a, 0, 0, s * 0.15, 0); b.rotation.x = -s * 0.18; bx(b, m.white, -0.22, 0.22, 0, 0.75, -0.015, 0.015, { bevel: 0.01 }); const p = pl(b, new THREE.MeshBasicMaterial({ map: ct('srCafeA', 128, 192, (c, w, h) => { c.fillStyle = '#20291f'; c.fillRect(0, 0, w, h); txt(c, '喫茶', w / 2, 34, 30, '#f4f0e4', { font: SERIF }); txt(c, 'ブレンド 450', w / 2, 92, 17, '#e9e4d6', { font: HAND, weight: 600 }); txt(c, 'ナポリタン 780', w / 2, 126, 17, '#e9e4d6', { font: HAND, weight: 600 }); txt(c, 'プリン 380', w / 2, 160, 17, '#e8c97a', { font: HAND, weight: 600 }); }) }), 0.38, 0.6, 0, 0.42, s * 0.017, s > 0 ? 0 : Math.PI, 0); p.userData.noLine = true; }); }
    [[-32.85, ZF + 0.25], [-30.95, ZF + 0.25]].forEach(([x, z], i) => { const y = gy(x, z), p = makePot({ r: 0.13, h: 0.24, seed: 70 + i }).group; p.position.set(x, y, z); g.add(p); sph(g, toon(i ? '#5f8a48' : '#4f7f46'), 0.15, x, y + 0.32, z, 1.1, 0.9, 1.1); for (let k = 0; k < 5; k++) sph(g, toon('#f2d23a'), 0.03, x + Math.cos(k) * 0.1, y + 0.42, z + Math.sin(k) * 0.1); });
    { const x = -34.4, z = ZF + 0.35, b = grp(g, x, gy(x, z), z, 0); bx(b, m.woodL, -0.7, 0.7, 0.4, 0.45, -0.17, 0.17, { bevel: 0.01 }); [-0.6, 0.6].forEach((a) => bx(b, m.wood, a - 0.04, a + 0.04, 0, 0.4, -0.14, 0.14, { cast: false })); }
    // A: a bicycle, a narrow planter under the studio window
    bicycle(st(gy(-22.9, ZF + 0.9)), -22.9, ZF + 0.9, Math.PI / 2 + 0.1, '#c9c4b8', 0.12);
    flowerBox(g, -23.9, -21.45, gy(-22.6, ZF + 0.1), ZF + 0.02, 91);
    // D: pots by the door, a bench, the poster board on the parking side
    [[-38.65, ZF + 0.1], [-37.1, ZF + 0.1], [-36.75, ZF + 0.1]].forEach(([x, z], i) => { const y = gy(x, z), p = makePot({ r: 0.12, h: 0.22, seed: 40 + i }).group; p.position.set(x, y, z); g.add(p); sph(g, toon(i % 2 ? '#4f7f46' : '#5f8a48'), 0.13, x, y + 0.32, z, 1.1, 0.9, 1.1); });
    { const x = -40.2, z = ZF + 0.3, b = grp(g, x, gy(x, z), z, 0); bx(b, m.woodL, -0.6, 0.6, 0.4, 0.45, -0.18, 0.18, { bevel: 0.01 }); [-0.5, 0.5].forEach((a) => bx(b, m.wood, a - 0.04, a + 0.04, 0, 0.4, -0.15, 0.15, { cast: false })); }
    { const x = -42.0, z = 18.2, y = gy(x, z); [-0.4, 0.4].forEach((d) => cy(g, m.metal, x, y, z + d, 0.025, 1.6, 6)); bx(g, m.wood, x - 0.03, x + 0.03, y + 0.9, y + 1.6, z - 0.48, z + 0.48, { bevel: 0.01 }); [0, 1, 2].forEach((k) => { const p = pl(g, toon('#ffffff', { map: posterTex(k), nocache: true, lit: 0.15 }), 0.26, 0.36, x - 0.035, y + 1.25, z - 0.3 + k * 0.3, -Math.PI / 2, 0); p.userData.noLine = true; }); }
  }

  /* ---- the two ends: a parking corner with vending machines (west), bicycles + recycling (east) ---- */
  {
    vendingMachine(st(), -42.35, 14.6, 0, 1, 31); vendingMachine(st(), -43.4, 14.6, 0, 2, 32);
    trashBins(st(), -44.9, 14.5, 0);
    [[-47.6, -45.0], [-45.0, -42.4]].forEach(([a, b]) => { [a, b].forEach((x) => bx(g, toon('#e8e6e0'), x - 0.05, x + 0.05, Y + 0.004, Y + 0.012, 15.6, 19.4, { cast: false })); bx(g, M.concreteL, (a + b) / 2 - 0.6, (a + b) / 2 + 0.6, Y, Y + 0.1, 15.7, 15.9, { bevel: 0.02 }); });
    for (let k = 0; k < 3; k++) { const x = -19.2 + k * 0.6; cyl2(g, m.metal, [x, Y, 16.6], [x, Y + 0.5, 16.6], 0.02, 5); cyl2(g, m.metal, [x, Y + 0.5, 16.6], [x, Y + 0.5, 17.4], 0.02, 5); cyl2(g, m.metal, [x, Y, 17.4], [x, Y + 0.5, 17.4], 0.02, 5); }
    bicycle(st(), -18.9, 17.0, 0, '#d8574f', 0.0); bicycle(st(), -18.3, 17.0, 0, '#6c8a3a', 0.0);
    trashBins(st(), -18.2, 15.0, -Math.PI / 2);
    { const p = makePot({ r: 0.25, h: 0.5, seed: 51 }).group; p.position.set(-17.3, Y, 19.0); g.add(p); const sb = makeShrub({ seed: 851, width: 0.6, height: 0.6, palette: 'deep' }); sb.position.set(-17.3, Y + 0.45, 19.0); g.add(sb); }
  }
  reg.streetRow = { row: ROW };
  return g;
}
