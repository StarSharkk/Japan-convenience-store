import * as THREE from 'three';
import { sharedPlants, potPlants } from '../plants/wild.js';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, halo, plight, rng, noSnowBox } from '../core.js';
import { makeGlass } from '../fx.js';
import { makeRhapisPot, makePot } from '../plants/pottedPlants.js';
import { swingDoors, doorHit } from '../doors.js';
import { YS, ct, wbx, txt, SERIF, HAND, spineTex, wetPass } from './shopkit.js';
import { P } from '../palette.js';

/* ====================================================================================================
   海辺の本屋 (bookstore) - the east lot of the south block (plot C-shop-1), one storey, its front facing south onto
   the sakura plaza like the café next door. Light mint walls, cream trim, natural wood.

     walls    x -2.0 .. 4.4, z 14.6 .. 19.6 (front), 3.15 m; the floor is raised 0.3 m on a stone plinth
     front    the big window (small-paned transom) over an outside display ledge with books; the "bookstore" board
              with two little spot lamps; double glass doors (they swing in as the camera comes close) under a
              cream scalloped awning; a timber entrance deck with two steps; a low wall with the BOOKS plaque
     inside   bookcases on three walls packed with books, a low case under the window with face-out books, the
              centre display table, the till counter (register, paper bags, bookmarks), the reading corner
              (armchair, chair, side table, table lamp, open book, rug), a library ladder, pendants, cork board
     outside  the reading spot of the reference: rug, armchair with an open book, floor lamp, side table with a
              mug, stacks of books, flower pots, the welcome board, a postcard rack
   ==================================================================================================== */

export const BOOKS = { X0: -2.0, X1: 4.4, Z0: 14.6, Z1: 19.6, H: 3.15 };
const { X0, X1, Z0, Z1, H } = BOOKS;
const Y = YS, T = 0.16, F = Y + 0.3; // F: the shop floor
const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 + T, IZ1 = Z1 - T;
const WIN = [-1.75, 1.45], DOOR = [1.85, 3.85], WY0 = F + 0.45, WY1 = Y + 2.55;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------------------------------------------- textures */
const signTex = () => ct('bookSign', 1024, 160, (g, w, h) => {
  g.fillStyle = '#f4eedf'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  txt(g, 'bookstore', w / 2, h / 2 + 6, 104, '#1f1f1f', { font: SERIF, weight: 600 });
});
const plaqueTex = () => ct('bookPlaque', 256, 96, (g, w, h) => { g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8c39a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); txt(g, 'BOOKS', w / 2, 38, 36, '#f2e6cc', { font: SERIF }); txt(g, 'umi no hon-ya', w / 2, 70, 18, '#d8c39a', { font: SERIF, italic: true, weight: 500 }); });
const welcomeTex = () => ct('bookWelcome', 192, 288, (g, w, h) => {
  g.fillStyle = '#f4eedf'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a9a8c'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  txt(g, 'Welcome', w / 2, 46, 34, '#2b2b2b', { font: SERIF, italic: true, weight: 600 });
  txt(g, "today's pick", w / 2, 92, 20, '#7a5a3a', { font: HAND, weight: 600 });
  g.fillStyle = '#3f5f8a'; g.fillRect(56, 116, 80, 108); g.fillStyle = '#f2e6cc'; g.fillRect(66, 132, 60, 8); g.fillRect(66, 148, 44, 6);
  txt(g, '海と灯台', w / 2, 252, 20, '#2b2b2b', { font: SERIF });
});
const awnTex = () => ct('bookAwn', 128, 64, (g, w, h) => { g.fillStyle = '#f4eedd'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,140,110,0.12)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); }, { repeat: true });
const scallopTex = () => ct('bookScallop', 256, 64, (g, w, h) => { g.fillStyle = '#f4eedd'; g.fillRect(0, 0, w, 30); const n = 8, s = w / n; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(i * s + s / 2, 30, s / 2, 0, Math.PI); g.fill(); } g.fillStyle = 'rgba(150,130,100,0.25)'; g.fillRect(0, 26, w, 3); }, { repeat: true });
const plankTex = () => ct('bookPlank', 256, 256, (g, w, h) => { const R = rng(14), n = 8, s = h / n; for (let i = 0; i < n; i++) { g.fillStyle = ['#c9a274', '#c29a6a', '#cfa97c', '#bf9566'][(R() * 4) | 0]; g.fillRect(0, i * s, w, s); g.fillStyle = 'rgba(80,50,25,0.4)'; g.fillRect(0, i * s, w, 2); g.fillRect(((R() * w) | 0), i * s, 2, s); } }, { repeat: true });
const stoneTex = () => ct('bookStone', 128, 64, (g, w, h) => { const R = rng(19); g.fillStyle = '#8f8a82'; g.fillRect(0, 0, w, h); for (let r = 0; r < 2; r++) for (let x = (r % 2) * -16; x < w; x += 32) { const v = 170 + ((R() * 30) | 0); g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 2, r * 32 + 2, 28, 28); } }, { repeat: true });
const rugTex = (k) => ct(`bookRug${k}`, 128, 128, (g, w, h) => {
  g.fillStyle = k ? '#7a3a2e' : '#9a4a36'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8d2a6'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#2f4a6b'; g.fillRect(20, 20, w - 40, h - 40); g.fillStyle = '#e8d2a6'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w / 2, 26 + i * 20); g.lineTo(w / 2 + 18, 36 + i * 20); g.lineTo(w / 2, 46 + i * 20); g.lineTo(w / 2 - 18, 36 + i * 20); g.fill(); }
});
const corkTex = () => ct('bookCork', 160, 128, (g, w, h) => { g.fillStyle = '#b98a5a'; g.fillRect(0, 0, w, h); const R = rng(23); for (let i = 0; i < 9; i++) { g.fillStyle = ['#fff6c8', '#f7d6e6', '#d8eef0', '#ffffff'][i % 4]; const x = 10 + R() * (w - 50), y = 10 + R() * (h - 50); g.fillRect(x, y, 36, 30); g.fillStyle = '#d23a32'; g.fillRect(x + 16, y + 2, 4, 4); } });
const coverTex = (k) => ct(`bookCover${k}`, 64, 96, (g, w, h) => { const c = ['#3f5f8a', '#c96a4a', '#e8d2a6', '#5f8a6a', '#2b2b2b', '#d8a4b0'][k % 6]; g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = k % 6 === 2 ? '#3a3a3a' : '#f4eedf'; g.fillRect(10, 16, 44, 6); g.fillRect(10, 28, 30, 4); g.beginPath(); g.arc(32, 64, 14, 0, Math.PI * 2); g.fill(); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.mint) return M;
  M.mint = toon('#a9cfc1', { lit: 0.05 });
  M.mintD = toon('#8fb8a9');
  M.cream = toon('#f2ead8', { lit: 0.1 });
  M.wood = toon('#c9a274', { lit: 0.12 });
  M.woodD = toon('#8a6040');
  M.plank = toon('#ffffff', { map: plankTex(), nocache: true, lit: 0.12 });
  M.stone = toon('#ffffff', { map: stoneTex(), nocache: true });
  M.wall = toon('#f3ecdc', { lit: 0.22 });
  M.black = toon('#2b2b2b');
  M.brass = toon('#c9a24a');
  M.white = toon('#f6f3ec', { lit: 0.2 });
  M.awn = toon('#ffffff', { map: awnTex(), nocache: true, side: THREE.DoubleSide });
  return M;
}

/* ---------------------------------------------------------------- books */
/** a plane of book spines with UVs in metres (the spine texture repeats every 0.9 m) */
function spines(p, w, h, x, y, z, seed, pale) {
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv, off = rng(seed)() * 4;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 0.9) + off);
  const msh = new THREE.Mesh(geo, toon('#ffffff', { map: spineTex(seed % 5, { pale }), lit: 0.1 }));
  msh.position.set(x, y, z); msh.userData.noLine = true; msh.receiveShadow = true; p.add(msh);
  return msh;
}
/** a stack of books lying flat */
function stack(p, x, y, z, n, seed, ry = 0) {
  const R = rng(seed);
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = 0.15 + R() * 0.06, d = 0.21 + R() * 0.06, t = 0.025 + R() * 0.02;
    const b = bx(p, toon(['#3f5f8a', '#c96a4a', '#e8d2a6', '#5f8a6a', '#7a2e2a', '#d8a4b0', '#2b3a4a'][(R() * 7) | 0]), -w / 2, w / 2, 0, t, -d / 2, d / 2, { cast: false });
    b.position.set(x + (R() - 0.5) * 0.02, yy + t / 2, z + (R() - 0.5) * 0.02); b.rotation.y = ry + (R() - 0.5) * 0.3;
    const pg = bx(p, toon('#f4eedf'), -w / 2 + 0.006, w / 2 + 0.003, 0.003, t - 0.003, -d / 2 + 0.006, d / 2 - 0.006, { cast: false }); pg.position.copy(b.position); pg.rotation.copy(b.rotation);
    yy += t;
  }
  return yy;
}
/** a face-out book on a little stand (cover towards local +z of the parent group) */
function faceOut(p, x, y, z, k, ry = 0) {
  const g = grp(p, x, y, z, ry);
  const b = grp(g, 0, 0, 0, 0); b.rotation.x = -0.18;
  bx(b, toon('#f4eedf'), -0.08, 0.08, 0, 0.24, -0.015, 0.015, { cast: false });
  const c = pl(b, toon('#ffffff', { map: coverTex(k), lit: 0.15 }), 0.16, 0.24, 0, 0.12, 0.016, 0, 0); c.userData.noLine = true;
  return g;
}
/**
 * a bookcase, modelled with its shelves along local x (0 .. L), its back at local z 0 and its front at z d,
 * placed with its local origin at (ox, oy, oz) and turned by ry (ry 0: facing +z)
 */
function bookcase(p, ox, oy, oz, ry, L, h, d, n, seed, { pale = false, top = true } = {}) {
  const m = mats(), g = grp(p, ox, oy, oz, ry), R = rng(seed);
  wbx(g, m.wood, 0, L, 0, h, 0, 0.02, 1, { cast: false }); // back
  wbx(g, m.wood, 0, 0.04, 0, h, 0, d); wbx(g, m.wood, L - 0.04, L, 0, h, 0, d);
  const cols = Math.max(1, Math.round(L / 0.9)), cw = L / cols;
  for (let c = 1; c < cols; c++) wbx(g, m.wood, c * cw - 0.02, c * cw + 0.02, 0, h, 0, d, 1, { cast: false });
  const gap = (h - 0.1) / n;
  for (let i = 0; i <= n; i++) wbx(g, m.wood, 0, L, 0.06 + i * gap - 0.02, 0.06 + i * gap + 0.01, 0, d, 1, { cast: i === 0 });
  wbx(g, m.wood, 0, L, 0, 0.06, d - 0.02, d, 1, { cast: false }); // kick
  if (top) wbx(g, m.wood, -0.02, L + 0.02, h - 0.03, h, -0.01, d + 0.03, 1, { cast: false });
  for (let i = 0; i < n; i++) {
    const y0 = 0.07 + i * gap;
    for (let c = 0; c < cols; c++) {
      const a = c * cw + 0.03, b = (c + 1) * cw - 0.03;
      const r = R();
      if (r < 0.14) { // a face-out book + a short run
        faceOut(g, a + 0.14, y0, d * 0.55, (seed + i + c) % 6);
        spines(g, b - a - 0.3, gap * 0.82, (a + 0.3 + b) / 2, y0 + gap * 0.41, d * 0.62, seed + i * 7 + c, pale);
      } else if (r < 0.24) { // a stack lying down + a run
        stack(g, a + 0.14, y0, d * 0.5, 4 + ((R() * 3) | 0), seed + i * 13 + c);
        spines(g, b - a - 0.3, gap * 0.82, (a + 0.3 + b) / 2, y0 + gap * 0.41, d * 0.62, seed + i * 5 + c, pale);
      } else spines(g, b - a, gap * 0.84, (a + b) / 2, y0 + gap * 0.42, d * 0.66, seed + i * 3 + c, pale);
    }
  }
  return g;
}
function armchair(p, x, z, ry, col = '#d9c9a6') {
  const m = mats(), c = grp(p, x, 0, z, ry), fab = toon(col);
  [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]].forEach(([a, b]) => bx(c, m.woodD, a - 0.025, a + 0.025, 0, 0.2, b - 0.025, b + 0.025, { cast: false }));
  bx(c, fab, -0.36, 0.36, 0.2, 0.42, -0.34, 0.34, { bevel: 0.05 });
  bx(c, fab, -0.36, 0.36, 0.42, 0.95, -0.34, -0.16, { bevel: 0.06 });
  [-0.36, 0.28].forEach((a) => bx(c, fab, a, a + 0.08, 0.42, 0.62, -0.3, 0.34, { bevel: 0.04 }));
  [-0.36, 0.36].forEach((a) => bx(c, m.woodD, a - 0.02, a + 0.02, 0.6, 0.64, -0.3, 0.36, { cast: false }));
  return c;
}
function openBook(p, x, y, z, ry = 0) {
  const g = grp(p, x, y, z, ry);
  [-1, 1].forEach((s) => { const pg = grp(g, 0, 0, 0, 0); pg.rotation.z = s * 0.12; bx(pg, toon('#fbf6ea'), s > 0 ? 0 : -0.15, s > 0 ? 0.15 : 0, 0, 0.012, -0.1, 0.1, { cast: false }); });
  bx(g, toon('#7a2e2a'), -0.16, 0.16, -0.006, 0.0, -0.105, 0.105, { cast: false });
  return g;
}
function floorLamp(p, x, y, z, h = 1.45) {
  const m = mats();
  cy(p, m.black, x, y, z, 0.13, 0.03, 14); cy(p, m.brass, x, y, z, 0.015, h, 6);
  cy(p, toon('#f4e6c8', { side: THREE.DoubleSide }), x, y + h - 0.05, z, 0.17, 0.24, 16, { rt: 0.65 });
  sph(p, glow('#ffd9a0', 1.8, { off: '#f4e6c8' }), 0.05, x, y + h, z);
  halo(p, x, y + h, z, '#ffd59a', 1.4, 0.35);
}

/* ---------------------------------------------------------------- the bookstore */
export function buildBookstore(parent) {
  const m = mats();
  const g = grp(parent);
  g.name = 'bookstore';

  /* ---- plinth, floor, walls ---- */
  wbx(g, m.stone, X0 - 0.03, X1 + 0.03, Y - 0.05, F, Z0 - 0.03, Z1 + 0.03, 0.5);
  wbx(g, m.plank, IX0, IX1, F, F + 0.012, IZ0, IZ1, 1.2, { cast: false });
  const f = (x0, x1, y0, y1) => wbx(g, m.mint, x0, x1, y0, y1, IZ1, Z1, 1);
  f(X0, WIN[0], F, Y + H); f(WIN[0], WIN[1], F, WY0); f(WIN[0], WIN[1], WY1, Y + H); f(WIN[1], DOOR[0], F, Y + H); f(DOOR[0], DOOR[1], WY1, Y + H); f(DOOR[1], X1, F, Y + H);
  wbx(g, m.mint, X0, IX0, F, Y + H, Z0, IZ1, 1); wbx(g, m.mint, IX1, X1, F, Y + H, Z0, IZ1, 1);
  wbx(g, m.mint, IX0, IX1, F, Y + H, Z0, IZ0, 1);
  // inside faces
  wbx(g, m.wall, IX0, IX1, F, Y + H, IZ0, IZ0 + 0.01, 1, { cast: false });
  wbx(g, m.wall, IX0, IX0 + 0.01, F, Y + H, IZ0, IZ1, 1, { cast: false });
  wbx(g, m.wall, IX1 - 0.01, IX1, F, Y + H, IZ0, IZ1, 1, { cast: false });
  wbx(g, toon('#efe7d6', { lit: 0.3 }), IX0, IX1, Y + H - 0.03, Y + H - 0.01, IZ0, IZ1, 1, { cast: false });
  // cream cornice + the flat roof
  wbx(g, m.cream, X0 - 0.08, X1 + 0.08, Y + H - 0.16, Y + H + 0.04, Z0 - 0.08, Z1 + 0.1, 1);
  wbx(g, toon(P.roofFlat), X0 - 0.02, X1 + 0.02, Y + H + 0.04, Y + H + 0.06, Z0 - 0.02, Z1 + 0.04, 1, { cast: false });
  wbx(g, m.cream, X0 - 0.04, X1 + 0.04, F - 0.02, F + 0.06, Z1, Z1 + 0.04, 1, { cast: false }); // base trim
  // back (Kaigan-dori): two small windows and a downpipe
  [[-0.6, 0.4], [2.2, 3.2]].forEach(([a, b]) => { bx(g, m.cream, a - 0.06, b + 0.06, Y + 1.7, Y + 2.5, Z0 - 0.04, Z0, { cast: false }); pl(g, glow('#ffe3b8', 0.7, { off: '#7b8794' }), b - a, 0.68, (a + b) / 2, Y + 2.1, Z0 - 0.045, Math.PI, 0); });
  cy(g, m.cream, X1 - 0.12, Y, Z0 - 0.08, 0.04, H, 8);

  /* ---- the front: window, ledge, board, doors, awning, deck, plaque ---- */
  {
    // the big window with its small-paned transom
    const zf = Z1 - 0.08;
    const fr = (x0, x1, y0, y1) => bx(g, m.cream, x0, x1, y0, y1, Z1 - 0.12, Z1 + 0.03, { cast: false });
    fr(WIN[0] - 0.04, WIN[1] + 0.04, WY0 - 0.04, WY0 + 0.04); fr(WIN[0] - 0.04, WIN[1] + 0.04, WY1 - 0.04, WY1 + 0.04);
    fr(WIN[0] - 0.04, WIN[0] + 0.04, WY0, WY1); fr(WIN[1] - 0.04, WIN[1] + 0.04, WY0, WY1);
    fr(WIN[0], WIN[1], Y + 2.0, Y + 2.05);
    for (let k = 1; k < 4; k++) { const x = WIN[0] + ((WIN[1] - WIN[0]) * k) / 4; bx(g, m.cream, x - 0.02, x + 0.02, Y + 2.0, WY1, Z1 - 0.1, Z1 + 0.02, { cast: false }); }
    { const x = (WIN[0] + WIN[1]) / 2; bx(g, m.cream, x - 0.025, x + 0.025, WY0, Y + 2.0, Z1 - 0.1, Z1 + 0.02, { cast: false }); }
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(WIN[1] - WIN[0], WY1 - WY0), makeGlass(WIN[1] - WIN[0], WY1 - WY0, 91, { alpha: 0.05, drops: 0.35, tint: 0xfff4e0 }));
    gw.position.set((WIN[0] + WIN[1]) / 2, (WY0 + WY1) / 2, zf); gw.userData.noLine = true; gw.renderOrder = 2; g.add(gw); reg.noRefl.push(gw);
    // the outside display ledge with books
    bx(g, m.cream, WIN[0] - 0.1, WIN[1] + 0.1, WY0 - 0.08, WY0, Z1, Z1 + 0.3, { bevel: 0.01 });
    stack(g, -1.3, WY0, Z1 + 0.15, 5, 41, 0.2); stack(g, -0.95, WY0, Z1 + 0.16, 3, 42, -0.1);
    { const fb = grp(g, -0.25, WY0, Z1 + 0.13, 0.05); fb.rotation.x = -0.15; bx(fb, m.wood, -0.2, 0.2, 0, 0.5, -0.02, 0.02); const fp = pl(fb, toon('#f4eedf', { lit: 0.15 }), 0.34, 0.42, 0, 0.25, 0.021, 0, 0); fp.userData.noLine = true; }
    faceOut(g, 0.35, WY0, Z1 + 0.14, 3, 0.1); faceOut(g, 0.7, WY0, Z1 + 0.14, 5, -0.1);
    { const pot = makePot({ r: 0.07, h: 0.12, seed: 3 }), p = pot.group; p.position.set(1.15, WY0, Z1 + 0.14); g.add(p); potPlants(sharedPlants(), 1.15, WY0 + pot.soilY, Z1 + 0.14, pot.soilR, { variant: 3, seed: 3, obj: g }); }
    // the "bookstore" board with two little spot lamps
    bx(g, m.black, -1.62, 1.32, Y + 2.62, Y + 3.0, Z1, Z1 + 0.05, { bevel: 0.01 });
    { const s = pl(g, new THREE.MeshBasicMaterial({ map: signTex() }), 2.86, 0.32, -0.15, Y + 2.81, Z1 + 0.052, 0, 0); s.userData.noLine = true; }
    [-1.0, 0.7].forEach((x) => { cyl2(g, m.black, [x, Y + 3.0, Z1 + 0.05], [x, Y + 3.18, Z1 + 0.32], 0.012, 5); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 10), m.black); sh.position.set(x, Y + 3.16, Z1 + 0.36); sh.rotation.x = 0.9; g.add(sh); sph(g, glow('#ffe2b0', 2.2, { off: '#d8d0c0' }), 0.035, x, Y + 3.12, Z1 + 0.4); halo(g, x, Y + 2.9, Z1 + 0.2, '#ffd59a', 0.9, 0.3); });
    // the double glass doors (cream frames), on hinges at the outer edges
    const DH = WY1 - F, dw = (DOOR[1] - DOOR[0]) / 2 - 0.02;
    bx(g, m.cream, DOOR[0] - 0.05, DOOR[0], F, WY1, Z1 - 0.14, Z1 + 0.03, { cast: false }); bx(g, m.cream, DOOR[1], DOOR[1] + 0.05, F, WY1, Z1 - 0.14, Z1 + 0.03, { cast: false });
    bx(g, m.cream, DOOR[0] - 0.05, DOOR[1] + 0.05, WY1 - 0.02, WY1 + 0.05, Z1 - 0.14, Z1 + 0.03, { cast: false });
    const leaves = [];
    [[DOOR[0] + 0.01, 1], [DOOR[1] - 0.01, -1]].forEach(([hx, s], i) => {
      const pv = grp(g, hx, F, Z1 - 0.07, 0); pv.userData.keep = true;
      const a = s > 0 ? 0 : -dw, b = s > 0 ? dw : 0;
      bx(pv, m.wood, a, b, 0, 0.1, -0.025, 0.025); bx(pv, m.wood, a, b, DH - 0.08, DH, -0.025, 0.025);
      bx(pv, m.wood, a, a + 0.07, 0, DH, -0.025, 0.025); bx(pv, m.wood, b - 0.07, b, 0, DH, -0.025, 0.025);
      bx(pv, m.wood, a, b, 0.95, 1.0, -0.025, 0.025, { cast: false });
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.14, DH - 0.2), makeGlass(dw, DH, 92 + i, { alpha: 0.05, drops: 0.3, tint: 0xfff4e0 })); gp.position.set((a + b) / 2, DH / 2, 0); gp.userData.noLine = true; gp.renderOrder = 2; pv.add(gp); reg.noRefl.push(gp);
      bx(pv, m.brass, s > 0 ? b - 0.12 : a + 0.09, s > 0 ? b - 0.09 : a + 0.12, 0.9, 1.25, 0.03, 0.06, { cast: false });
      leaves.push({ pv, s });
    });
    const entrance = V((DOOR[0] + DOOR[1]) / 2, F + 1, Z1);
    const inside = (p, pad = 0) => p.x > X0 - pad && p.x < X1 + pad && p.z > Z0 - pad && p.z < Z1 + pad;
    swingDoors({ leaves, entrance, inside, angle: 1.35, near: 7.5, hit: doorHit(g, DOOR[1] - DOOR[0], DH, (DOOR[0] + DOOR[1]) / 2, F + DH / 2, Z1 - 0.05) });
    (reg.closeZones ||= []).push((p) => inside(p, 0.8));
    reg.bookstore = {
      entrance,
      views: {
        front: { t: V(1.2, F + 1.2, 19.6), s: new THREE.Spherical(8.5, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(-6)) },
        inside: { t: V(1.0, F + 1.1, 16.6), s: new THREE.Spherical(3.4, THREE.MathUtils.degToRad(78), THREE.MathUtils.degToRad(-10)) },
      },
    };
    // the cream scalloped awning over the doors
    {
      const ax0 = DOOR[0] - 0.2, ax1 = X1 + 0.1, ay0 = Y + 3.0, ay1 = Y + 2.6, ad = 1.15, aa = Math.atan2(ay0 - ay1, ad), aL = Math.hypot(ad, ay0 - ay1);
      const aw = wbx(g, m.awn, ax0, ax1, -0.015, 0.015, -aL / 2, aL / 2, 0.5); aw.position.set((ax0 + ax1) / 2, (ay0 + ay1) / 2, Z1 + ad / 2); aw.rotation.x = aa;
      const vg = new THREE.PlaneGeometry(ax1 - ax0, 0.2), vu = vg.attributes.uv; for (let i = 0; i < vu.count; i++) vu.setX(i, vu.getX(i) * (ax1 - ax0) / 0.9);
      const vm = toon('#ffffff', { map: scallopTex(), nocache: true, side: THREE.DoubleSide }); vm.transparent = true; vm.alphaTest = 0.5;
      const val = new THREE.Mesh(vg, vm); val.position.set((ax0 + ax1) / 2, ay1 - 0.1, Z1 + ad + 0.005); val.userData.noLine = true; g.add(val);
      [ax0 + 0.05, ax1 - 0.05].forEach((x) => cyl2(g, m.black, [x, Y + 2.3, Z1 + 0.02], [x, ay1 + 0.02, Z1 + ad - 0.05], 0.012, 5));
      (reg.extraRoofs ||= []).push({ id: 'bookAwning', a: [ax1 - 0.05, Z1 + 0.05], b: [ax0 + 0.05, Z1 + 0.05], n: [0, 1], D: ad - 0.1, y: ay0 + 0.03, drop: ay0 - ay1, w: { leaf: 0.3 }, snow: 0.08 }); // keep the cream awning clean (no petals)
    }
    // the timber entrance deck + two steps, the low wall with the plaque
    wbx(g, m.plank, DOOR[0] - 0.25, X1, F - 0.08, F, Z1, Z1 + 0.6, 0.8);
    wbx(g, m.plank, DOOR[0] + 0.05, DOOR[1] - 0.05, Y + 0.12, Y + 0.2, Z1 + 0.6, Z1 + 0.9, 0.8);
    wbx(g, m.plank, DOOR[0] + 0.05, DOOR[1] - 0.05, Y, Y + 0.1, Z1 + 0.9, Z1 + 1.2, 0.8);
    wbx(g, m.woodD, DOOR[0] + 0.05, DOOR[1] - 0.05, Y, Y + 0.12, Z1 + 0.6, Z1 + 0.9, 1, { cast: false });
    wbx(g, m.mint, X1 - 0.24, X1, Y, F + 0.45, Z1, Z1 + 0.6, 1);
    bx(g, m.cream, X1 - 0.27, X1 + 0.03, F + 0.45, F + 0.5, Z1 - 0.02, Z1 + 0.63, { bevel: 0.01 });
    { const pq = pl(g, new THREE.MeshBasicMaterial({ map: plaqueTex() }), 0.2, 0.075, X1 - 0.12, F + 0.22, Z1 + 0.605, 0, 0); pq.userData.noLine = true; }
    // a wall lamp beside the doors
    bx(g, m.black, 1.6, 1.7, Y + 2.1, Y + 2.35, Z1, Z1 + 0.06, { cast: false }); bx(g, glow('#ffe2b0', 2.0, { off: '#d8d0c0' }), 1.61, 1.69, Y + 2.13, Y + 2.32, Z1 + 0.06, Z1 + 0.07, { cast: false }); halo(g, 1.65, Y + 2.2, Z1 + 0.2, '#ffd59a', 0.9, 0.3);
    // potted yellow flowers + a book stack on the deck
    { const pot = makePot({ r: 0.13, h: 0.22, seed: 8 }), p = pot.group; p.position.set(DOOR[0] - 0.12, F, Z1 + 0.3); g.add(p); potPlants(sharedPlants(), DOOR[0] - 0.12, F + pot.soilY, Z1 + 0.3, pot.soilR, { variant: 0, seed: 8, obj: g }); }
    stack(g, DOOR[1] + 0.25, F, Z1 + 0.3, 6, 44, 0.3);
  }

  /* ---- inside ---- */
  {
    bookcase(g, IX0 + 0.05, F, IZ0 + 0.01, 0, IX1 - IX0 - 0.1, 2.55, 0.32, 6, 101);
    bookcase(g, IX0 + 0.01, F, 18.75, Math.PI / 2, 3.3, 2.4, 0.3, 6, 202, { pale: true });
    bookcase(g, IX1 - 0.01, F, 15.2, -Math.PI / 2, 2.1, 2.4, 0.3, 6, 303);
    // the low case under the window, face-out books on top
    {
      const L = WIN[1] - WIN[0] - 0.1, lc = grp(g, WIN[1] - 0.05, F, IZ1 - 0.02, Math.PI);
      wbx(lc, m.wood, 0, L, 0, 0.42, 0, 0.3);
      spines(lc, L - 0.1, 0.3, L / 2, 0.21, 0.305, 404, true);
      [0.4, 1.0, 1.7, 2.4].forEach((x, k) => faceOut(lc, x, 0.42, 0.15, k + 1, Math.PI)); // covers out to the street
      stack(lc, 2.85, 0.42, 0.15, 4, 45);
    }
    // the centre display table
    {
      const x0 = -0.1, x1 = 1.3, z0 = 16.75, z1 = 17.6;
      [[x0 + 0.06, z0 + 0.06], [x1 - 0.06, z0 + 0.06], [x0 + 0.06, z1 - 0.06], [x1 - 0.06, z1 - 0.06]].forEach(([x, z]) => bx(g, m.woodD, x - 0.03, x + 0.03, F, F + 0.72, z - 0.03, z + 0.03));
      bx(g, m.wood, x0, x1, F + 0.72, F + 0.77, z0, z1, { bevel: 0.01 });
      stack(g, 0.12, F + 0.77, 16.95, 5, 46); stack(g, 0.45, F + 0.77, 17.35, 3, 47, 0.4); stack(g, 1.1, F + 0.77, 17.0, 4, 48, -0.3);
      faceOut(g, 0.7, F + 0.77, 17.0, 0, 0); faceOut(g, 0.75, F + 0.77, 17.38, 2, Math.PI); faceOut(g, 0.3, F + 0.77, 17.38, 4, Math.PI);
    }
    // the till counter: register, paper bags, bookmarks, a stool
    {
      const x0 = 2.25, x1 = 3.75, z0 = 15.75, z1 = 16.3;
      wbx(g, m.wood, x0, x1, F, F + 0.95, z0, z1, 1); bx(g, m.cream, x0 - 0.03, x1 + 0.03, F + 0.95, F + 1.0, z0 - 0.03, z1 + 0.05, { cast: false });
      spines(g, x1 - x0 - 0.2, 0.25, (x0 + x1) / 2, F + 0.55, z1 + 0.006, 505, false);
      bx(g, m.black, 3.2, 3.55, F + 1.0, F + 1.12, 15.85, 16.15, { bevel: 0.01 }); const scr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.02), toon('#3a3d42')); scr.position.set(3.37, F + 1.25, 15.9); scr.rotation.x = -0.3; g.add(scr);
      bx(g, toon('#c9a77a'), 2.4, 2.7, F + 1.0, F + 1.02, 15.85, 16.2, { cast: false }); bx(g, toon('#c9a77a'), 2.42, 2.68, F + 1.02, F + 1.04, 15.87, 16.18, { cast: false });
      cy(g, toon('#d8eef0', { op: 0.75 }), 2.95, F + 1.0, 16.15, 0.05, 0.12, 10); [0, 1, 2, 3].forEach((i) => bx(g, toon(['#d8a4b0', '#3f5f8a', '#f2d23a', '#5f8a6a'][i]), 2.92 + (i % 2) * 0.02 - 0.012, 2.92 + (i % 2) * 0.02 + 0.012, F + 1.05, F + 1.2 + i * 0.01, 16.13, 16.135, { cast: false }));
      cy(g, m.woodD, 3.0, F, 15.45, 0.16, 0.6, 12); cy(g, m.wood, 3.0, F + 0.6, 15.45, 0.18, 0.04, 14);
    }
    // the reading corner: armchair, a small chair, side table, table lamp, open book, rug
    {
      bx(g, toon('#ffffff', { map: rugTex(0), nocache: true }), -1.45, 0.65, F + 0.012, F + 0.02, 17.7, 19.0, { cast: false });
      armchair(g, -1.05, 18.35, Math.PI / 2, '#c9b79a').position.y = F;
      { const c = grp(g, 0.35, F, 18.35, -Math.PI / 2); [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => bx(c, m.woodD, a - 0.02, a + 0.02, 0, 0.45, b - 0.02, b + 0.02, { cast: false })); bx(c, toon('#7a9a8c'), -0.2, 0.2, 0.45, 0.52, -0.2, 0.2, { bevel: 0.02 }); bx(c, m.woodD, -0.2, 0.2, 0.52, 0.9, -0.21, -0.17, { bevel: 0.01 }); }
      cy(g, m.woodD, -0.35, F, 17.95, 0.025, 0.55, 6); cy(g, m.wood, -0.35, F + 0.55, 17.95, 0.22, 0.03, 18);
      cy(g, m.brass, -0.42, F + 0.58, 17.9, 0.05, 0.02, 10); cy(g, m.brass, -0.42, F + 0.6, 17.9, 0.01, 0.3, 6); cy(g, toon('#f4e6c8', { side: THREE.DoubleSide }), -0.42, F + 0.86, 17.9, 0.1, 0.13, 14, { rt: 0.6 });
      sph(g, glow('#ffd9a0', 1.6, { off: '#f4e6c8' }), 0.035, -0.42, F + 0.9, 17.9);
      openBook(g, -0.28, F + 0.58, 18.02, 0.4);
      cy(g, toon('#e8dcc0'), -0.2, F + 0.58, 17.85, 0.035, 0.08, 10);
      stack(g, -0.95, F, 19.05, 5, 49);
    }
    // the library ladder on the back case, a plant, the cork board with notes and two frames on the east wall
    {
      const lg = grp(g, 1.55, F, IZ0 + 0.85, 0); lg.rotation.x = -0.32;
      [-0.2, 0.2].forEach((a) => bx(lg, m.woodD, a - 0.025, a + 0.025, 0, 2.55, -0.025, 0.025));
      for (let y = 0.3; y < 2.5; y += 0.33) bx(lg, m.woodD, -0.2, 0.2, y, y + 0.03, -0.02, 0.02, { cast: false });
      const p = makeRhapisPot({ seed: 61 }); p.position.set(IX1 - 0.3, F, IZ1 - 0.3); g.add(p);
      const cb = pl(g, toon('#ffffff', { map: corkTex(), nocache: true, lit: 0.15 }), 0.9, 0.7, IX1 - 0.012, F + 1.6, 18.4, -Math.PI / 2, 0); cb.userData.noLine = true;
      bx(g, m.woodD, IX1 - 0.03, IX1 - 0.01, F + 1.22, F + 1.98, 17.92, 18.88, { cast: false });
      [[17.55, 2.25, 0], [18.9, 2.3, 1]].forEach(([z, y, k]) => { bx(g, m.woodD, IX1 - 0.04, IX1 - 0.01, F + y - 0.22, F + y + 0.22, z - 0.17, z + 0.17, { cast: false }); const fp = pl(g, toon('#ffffff', { map: coverTex(k + 3), nocache: true }), 0.26, 0.36, IX1 - 0.042, F + y, z, -Math.PI / 2, 0); fp.userData.noLine = true; });
    }
    // warm pendants + the room light
    [[-0.6, 16.3], [1.6, 17.2], [3.0, 16.0]].forEach(([x, z]) => { cyl2(g, m.black, [x, Y + H - 0.02, z], [x, Y + H - 0.7, z], 0.006, 4, { noLine: true }); cy(g, m.brass, x, Y + H - 0.74, z, 0.03, 0.05, 8); sph(g, glow('#ffd9a0', 1.9, { off: '#f4ead6' }), 0.11, x, Y + H - 0.86, z); });
    plight(g, '#ffd09a', 10, 6.5, 1.1, F + 1.0, 17.6, 'books'); // low, so it does not wash the flat roof above
  }

  /* ---- outside: the reading spot of the reference, the welcome board, the postcard rack ---- */
  {
    bx(g, toon('#ffffff', { map: rugTex(1), nocache: true }), -1.75, 0.35, Y, Y + 0.012, Z1 + 0.15, Z1 + 1.35, { cast: false });
    armchair(g, -1.05, Z1 + 0.65, 0.25, '#d9c9a6').position.y = Y;
    openBook(g, -1.03, Y + 0.44, Z1 + 0.72, 0.25);
    floorLamp(g, -1.72, Y, Z1 + 0.3);
    cy(g, m.woodD, -0.25, Y, Z1 + 0.55, 0.025, 0.5, 6); cy(g, m.wood, -0.25, Y + 0.5, Z1 + 0.55, 0.18, 0.03, 16); cy(g, toon('#f6f3ec'), -0.25, Y + 0.53, Z1 + 0.55, 0.04, 0.09, 10);
    stack(g, 0.15, Y, Z1 + 0.35, 7, 50, 0.2); stack(g, 0.45, Y, Z1 + 0.55, 4, 51, -0.3);
    { const pot = makePot({ r: 0.14, h: 0.22, seed: 9 }), p = pot.group; p.position.set(0.85, Y, Z1 + 0.4); g.add(p); potPlants(sharedPlants(), 0.85, Y + pot.soilY, Z1 + 0.4, pot.soilR, { variant: 3, seed: 9, obj: g }); }
    // the welcome board on an easel by the steps
    { const e = grp(g, DOOR[0] - 0.45, Y, Z1 + 1.0, -0.2); [-0.2, 0.2].forEach((a) => cyl2(e, m.woodD, [a, 0, 0.12], [a * 0.4, 1.25, 0], 0.015, 5)); cyl2(e, m.woodD, [0, 0, -0.3], [0, 1.2, 0], 0.015, 5); bx(e, m.woodD, -0.24, 0.24, 0.42, 0.45, 0.02, 0.1, { cast: false }); const wb = grp(e, 0, 0.45, 0.07, 0); wb.rotation.x = -0.1; bx(wb, m.wood, -0.21, 0.21, 0, 0.62, -0.012, 0.012); const wp = pl(wb, new THREE.MeshBasicMaterial({ map: welcomeTex() }), 0.38, 0.57, 0, 0.31, 0.013, 0, 0); wp.userData.noLine = true; }
    // the postcard rack on the east side
    {
      const x = X1 + 0.45, z = Z1 + 0.35;
      cy(g, m.black, x, Y, z, 0.18, 0.02, 12); cy(g, m.black, x, Y, z, 0.015, 1.5, 6);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; for (let r = 0; r < 3; r++) { const c = pl(g, toon(['#f2d6c8', '#cfe3e6', '#f4eedf', '#e8d2a6'][(k + r) % 4], { side: THREE.DoubleSide, lit: 0.15 }), 0.12, 0.17, x + Math.cos(a) * 0.1, Y + 0.85 + r * 0.22, z + Math.sin(a) * 0.1, -a + Math.PI / 2, 0); c.userData.noLine = true; } }
    }
  }

  // the flat roof takes petals / leaves / snow (two near-flat halves)
  { const xc = (X0 + X1) / 2, hw = (X1 - X0) / 2 + 0.06, yr = Y + H + 0.07;
    (reg.extraRoofs ||= []).push(
      { id: 'booksW', a: [xc, Z1 + 0.05], b: [xc, Z0 - 0.05], n: [-1, 0], D: hw, y: yr, drop: 0.02, w: { petal: 0.15, leaf: 0.5 }, snow: 0.15, ridge: true },
      { id: 'booksE', a: [xc, Z0 - 0.05], b: [xc, Z1 + 0.05], n: [1, 0], D: hw, y: yr, drop: 0.02, w: { petal: 0.15, leaf: 0.5 }, snow: 0.15, ridge: true },
    ); }
  noSnowBox(IX0, IZ0, IX1, IZ1, Y + H);
  wetPass([m.plank]);
  return g;
}
