import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, halo, plight, rng, roundRect, noSnowBox } from '../core.js';
import { makeGlass } from '../fx.js';
import { makeRhapisPot, makeFicusPot } from '../plants/pottedPlants.js';
import { swingDoors, doorHit } from '../doors.js';
import { YS, ct, wbx, txt, SERIF, HAND, wetPass } from './shopkit.js';

/* ====================================================================================================
   海辺の珈琲店 (seaside café, "COFFEE & BAKERY") - the west lot of the south block (plot C-cafe-1), one storey,
   its shop front facing south onto the sakura plaza (the same way as the LAWSON), its back to Kaigan-dori.

     walls    x -11.4 .. -4.6, z 14.2 .. 20.0 (front), 3.3 m high; dark walnut boards outside, olive green inside
     roof     a low mono-pitch falling to the back; the shop-name board along the front; a shingled hood over the
              two shop windows and the arched timber door (it swings in as the camera comes close: doors.js)
     inside   the back counter (espresso machine, grinder, cups, plates, a basket of baguettes) under the chalk
              menu, the glass pastry case + till, open bread shelves on the east wall, three small round tables
              with blue-cushioned chairs, green pendant lamps, posters, a cubby shelf, a fig tree
     outside  two café tables on the terrace, an A-frame menu board, a leaning board, umbrella stand, bin, the
              potted conifer, a door mat, the toast-shaped blade sign, a classic lantern post, a bench on the lane
   Nothing under the roof takes snow; rain stops at the roof and the hood (world.js occluders).
   ==================================================================================================== */

export const CAFE = { X0: -11.4, X1: -4.6, Z0: 14.2, Z1: 20.0, H: 3.3 };
const { X0, X1, Z0, Z1, H } = CAFE;
const Y = YS, T = 0.18;
const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 + T, IZ1 = Z1 - T;
const W1 = [-11.0, -8.05], DOOR = [-7.75, -6.55], W2 = [-6.3, -4.95], SILL = 0.55, HEAD = 2.6, DH = 2.5;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------------------------------------------- textures */
const boardsTex = () => ct('cafeBoards', 256, 256, (g, w, h) => {
  const R = rng(5), n = 8, s = w / n;
  for (let i = 0; i < n; i++) { g.fillStyle = ['#5a3c28', '#61422c', '#553826', '#5e3f2a'][(R() * 4) | 0]; g.fillRect(i * s, 0, s, h); g.fillStyle = 'rgba(20,10,4,0.55)'; g.fillRect(i * s, 0, 2, h); for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(30,18,8,0.25)'; g.beginPath(); const x = i * s + 5 + R() * (s - 10); g.moveTo(x, 0); g.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 1, h); g.stroke(); } }
}, { repeat: true });
const floorTex = () => ct('cafeFloor', 256, 256, (g, w, h) => {
  const n = 8, s = w / n, R = rng(8);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 222 + ((R() * 12) | 0); g.fillStyle = (i + j) % 2 ? `rgb(${v},${v - 6},${v - 22})` : `rgb(${v - 14},${v - 20},${v - 34})`; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = 'rgba(90,80,60,0.25)'; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
}, { repeat: true });
const shingleTex = () => ct('cafeShingle', 128, 128, (g, w, h) => {
  const R = rng(12); g.fillStyle = '#3d2a1e'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 6; r++) for (let x = (r % 2) * -10; x < w; x += 20) { g.fillStyle = ['#6b4a34', '#5f412d', '#74523a'][(R() * 3) | 0]; g.fillRect(x + 1, r * (h / 6) + 1, 18, h / 6 - 3); }
}, { repeat: true });
const signTex = () => ct('cafeSign', 1024, 128, (g, w, h) => {
  g.fillStyle = '#3a271b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(240,226,196,0.55)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
  txt(g, 'COFFEE  &  BAKERY', w / 2, h / 2 + 2, 64, '#f2e6cc', { font: SERIF, weight: 700 });
  txt(g, '海辺の珈琲店', 120, h / 2 + 2, 26, '#d8c39a', { font: SERIF, weight: 600 });
  txt(g, 'EST. 2026', w - 110, h / 2 + 2, 24, '#d8c39a', { font: SERIF, weight: 600 });
});
const menuTex = () => ct('cafeMenu', 512, 256, (g, w, h) => {
  g.fillStyle = '#1f2a24'; g.fillRect(0, 0, w, h);
  const R = rng(3); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(R() * w, R() * h, 30 + R() * 60, 2); }
  txt(g, 'COFFEE & BAKERY', w / 2, 38, 40, '#f4f0e4', { font: HAND, weight: 700 });
  const L = [['Coffee', '450'], ['Latte', '520'], ['Cappuccino', '520'], ['Americano', '480']], Rr = [['Croissant', '280'], ['Rye Bread', '360'], ['Cinnamon Roll', '320'], ['Baguette', '380']];
  L.forEach(([a, p], i) => { txt(g, `· ${a}`, 40, 92 + i * 38, 24, '#e9e4d6', { font: HAND, align: 'left', weight: 600 }); txt(g, p, 232, 92 + i * 38, 22, '#e8c97a', { font: HAND, align: 'right', weight: 600 }); });
  Rr.forEach(([a, p], i) => { txt(g, `· ${a}`, 262, 92 + i * 38, 21, '#e9e4d6', { font: HAND, align: 'left', weight: 600 }); txt(g, p, 496, 92 + i * 38, 21, '#e8c97a', { font: HAND, align: 'right', weight: 600 }); });
  g.strokeStyle = 'rgba(244,240,228,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, 62); g.lineTo(372, 62); g.stroke();
});
const aboardTex = () => ct('cafeABoard', 256, 384, (g, w, h) => {
  g.fillStyle = '#20291f'; g.fillRect(0, 0, w, h);
  txt(g, 'TODAY', w / 2, 46, 40, '#f4f0e4', { font: HAND });
  txt(g, 'Latte ¥520', w / 2, 120, 30, '#e9e4d6', { font: HAND, weight: 600 });
  txt(g, 'Croissant', w / 2, 170, 30, '#e9e4d6', { font: HAND, weight: 600 });
  txt(g, 'fresh at 7:00', w / 2, 214, 24, '#e8c97a', { font: HAND, weight: 600 });
  g.strokeStyle = '#f2b8c6'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, 300, 34, 0, Math.PI * 2); g.stroke(); txt(g, '☕', w / 2, 302, 40, '#f4f0e4', { font: HAND });
});
const toastTex = () => ct('cafeToast', 256, 256, (g, w, h) => {
  const path = () => { g.beginPath(); g.moveTo(40, 240); g.lineTo(40, 110); g.arc(80, 100, 52, Math.PI, Math.PI * 1.55); g.arc(176, 100, 52, Math.PI * 1.45, 0); g.lineTo(216, 240); g.closePath(); };
  path(); g.fillStyle = '#b8743a'; g.fill();
  g.save(); g.translate(w / 2, h / 2 + 18); g.scale(0.82, 0.82); g.translate(-w / 2, -h / 2 - 18); path(); g.fillStyle = '#f3dfb4'; g.fill(); g.restore();
  txt(g, 'CAFÉ', w / 2, 168, 46, '#5a3a24', { font: SERIF, weight: 800 });
});
const posterTex = (k) => ct(`cafePoster${k}`, 128, 180, (g, w, h) => {
  g.fillStyle = k ? '#ebe2cc' : '#efe7d5'; g.fillRect(0, 0, w, h);
  if (k) { g.fillStyle = '#b8543a'; g.fillRect(12, 14, w - 24, 22); txt(g, 'FRENCH', w / 2, 26, 16, '#f6eedc', { font: SERIF }); g.fillStyle = '#6f8aa0'; g.fillRect(16, 46, w - 32, 90); g.fillStyle = '#d8b56a'; for (let i = 0; i < 4; i++) g.fillRect(24 + i * 22, 70 + (i % 2) * 14, 14, 60 - (i % 2) * 14); txt(g, 'DISPATCH', w / 2, 156, 15, '#3a3a3a', { font: SERIF }); }
  else { txt(g, 'Le Journal', w / 2, 22, 16, '#333', { font: SERIF }); g.fillStyle = '#9a9a92'; for (let i = 0; i < 9; i++) g.fillRect(12 + (i % 2) * 54, 40 + ((i / 2) | 0) * 26, 48, 16); }
});
const archTex = () => ct('cafeArch', 64, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(6, h - 4); g.lineTo(6, 34); g.arc(w / 2, 34, w / 2 - 6, Math.PI, 0); g.lineTo(w - 6, h - 4); g.closePath(); g.fill(); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.clad) return M;
  M.clad = toon('#ffffff', { map: boardsTex(), nocache: true, lit: 0.04 });
  M.walnut = toon('#4a3020');
  M.wood = toon('#7a5236', { lit: 0.1 });
  M.woodL = toon('#b0814f', { lit: 0.12 });
  M.green = toon('#2f4436');
  M.olive = toon('#58603d', { lit: 0.18 });
  M.cream = toon('#efe6d2', { lit: 0.15 });
  M.stone = toon('#d9d2c2', { lit: 0.12 });
  M.steel = toon('#b9bcc0');
  M.black = toon('#262626');
  M.blue = toon('#3f5c86');
  M.white = toon('#f6f3ec', { lit: 0.2 });
  M.floor = toon('#ffffff', { map: floorTex(), nocache: true, lit: 0.18 });
  M.shingle = toon('#ffffff', { map: shingleTex(), nocache: true });
  M.roof = toon('#45403c');
  M.crust = toon('#b8743a'); M.crustD = toon('#8f5428'); M.crustL = toon('#d9a05c'); M.dough = toon('#e8c88e');
  return M;
}

/* ---------------------------------------------------------------- small pieces */
/** a pastry / bread at x, y, z (s = scale) */
function bread(p, kind, x, y, z, s = 1, ry = 0) {
  const m = mats();
  if (kind === 'croissant') {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.03 * s, 6, 10, Math.PI * 1.15), m.crustL);
    t.rotation.set(-Math.PI / 2, 0, ry); t.position.set(x, y + 0.025 * s, z); t.scale.z = 0.8; p.add(t);
  } else if (kind === 'donut' || kind === 'bagel') {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.024 * s, 6, 12), kind === 'bagel' ? m.crustL : m.crust);
    t.rotation.x = -Math.PI / 2; t.position.set(x, y + 0.022 * s, z); p.add(t);
    if (kind === 'donut') { const ic = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.02 * s, 5, 12, Math.PI * 2), toon(['#f2a0c4', '#5a3424', '#fbf3e4'][(Math.abs(x * 37 + z * 11) | 0) % 3])); ic.rotation.x = -Math.PI / 2; ic.position.set(x, y + 0.032 * s, z); ic.scale.z = 0.6; p.add(ic); }
  } else if (kind === 'loaf') sph(p, m.crust, 0.09 * s, x, y + 0.045 * s, z, 1.6, 0.75, 1).rotation.y = ry;
  else if (kind === 'rye') sph(p, m.crustD, 0.1 * s, x, y + 0.05 * s, z, 1.1, 0.7, 1.1);
  else if (kind === 'baguette') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 * s, 0.4 * s, 4, 8), m.crustL); b.rotation.set(0, ry, Math.PI / 2); b.position.set(x, y + 0.03 * s, z); p.add(b); }
  else if (kind === 'toast') { bx(p, m.crustL, x - 0.09 * s, x + 0.09 * s, y, y + 0.08 * s, z - 0.06 * s, z + 0.06 * s, { cast: false }); sph(p, m.crustL, 0.09 * s, x, y + 0.08 * s, z, 1, 0.35, 0.66); }
  else if (kind === 'muffin') { cy(p, toon('#c7a06a'), x, y, z, 0.04 * s, 0.05 * s, 10, { rt: 1.2 }); sph(p, m.crustD, 0.05 * s, x, y + 0.05 * s, z, 1, 0.7, 1); }
  else if (kind === 'cake') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 0.07 * s, 10, 1, false, 0, Math.PI / 3), toon('#f6ead4')); c.position.set(x, y + 0.035 * s, z); c.rotation.y = ry; p.add(c); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 0.015 * s, 10, 1, false, 0, Math.PI / 3), toon('#e86a8a')); top.position.set(x, y + 0.075 * s, z); top.rotation.y = ry; p.add(top); }
  else if (kind === 'roll') { cy(p, m.crust, x, y, z, 0.05 * s, 0.04 * s, 12); cy(p, toon('#f4ead6'), x, y + 0.04 * s, z, 0.04 * s, 0.006, 12); }
}
/** a café chair (front = local +z) */
function chair(p, x, z, ry, { cushion = true, metal = false } = {}) {
  const m = mats(), c = grp(p, x, Y, z, ry), fm = metal ? m.black : m.walnut;
  [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => bx(c, fm, a - 0.018, a + 0.018, 0, 0.44, b - 0.018, b + 0.018, { cast: false }));
  bx(c, metal ? m.woodL : m.wood, -0.21, 0.21, 0.42, 0.46, -0.21, 0.21, { bevel: 0.01 });
  if (cushion) bx(c, m.blue, -0.18, 0.18, 0.46, 0.5, -0.18, 0.18, { bevel: 0.015, cast: false });
  [-0.18, 0.18].forEach((a) => bx(c, fm, a - 0.018, a + 0.018, 0.44, 0.88, -0.2, -0.17, { cast: false }));
  bx(c, metal ? m.woodL : m.wood, -0.2, 0.2, 0.72, 0.86, -0.21, -0.17, { bevel: 0.01, cast: false });
}
/** a small round table with things on it */
function table(p, x, z, { r = 0.34, h = 0.72, metal = false, seed = 1, takeaway = false } = {}) {
  const m = mats(), R = rng(seed);
  cy(p, metal ? m.black : m.walnut, x, Y, z, 0.2, 0.03, 16);
  cy(p, metal ? m.black : m.walnut, x, Y, z, 0.035, h - 0.04, 8);
  cy(p, metal ? m.woodL : m.wood, x, Y + h - 0.04, z, r, 0.04, 24);
  const yt = Y + h;
  // cups on saucers, a plate with a croissant, a menu card, a bud vase
  [[-0.14, 0.1], [0.14, -0.08]].forEach(([a, b], i) => {
    if (takeaway && i) { cy(p, m.white, x + a, yt, z + b, 0.035, 0.12, 10, { rt: 1.25 }); cy(p, toon('#a77a4c'), x + a, yt + 0.045, z + b, 0.041, 0.04, 10, { rt: 1.08 }); cy(p, m.white, x + a, yt + 0.12, z + b, 0.046, 0.012, 10); return; }
    cy(p, m.white, x + a, yt, z + b, 0.07, 0.01, 14); cy(p, m.white, x + a, yt + 0.01, z + b, 0.038, 0.06, 12, { rt: 1.15 }); cy(p, toon('#5a3420'), x + a, yt + 0.065, z + b, 0.038, 0.004, 12);
  });
  cy(p, m.white, x + 0.08, yt, z + 0.15, 0.08, 0.01, 14); bread(p, R() < 0.5 ? 'croissant' : 'roll', x + 0.08, yt + 0.01, z + 0.15, 0.8, R() * 3);
  cy(p, toon('#cfe3e6', { op: 0.8 }), x - 0.08, yt, z - 0.12, 0.022, 0.12, 8, { rt: 0.6 }); sph(p, toon(['#f2a0c4', '#ffffff', '#f2d23a'][(R() * 3) | 0]), 0.03, x - 0.08, yt + 0.15, z - 0.12);
  if (takeaway) { bx(p, toon('#c9a77a'), x - 0.02, x + 0.12, yt, yt + 0.18, z - 0.02, z + 0.06, { cast: false }); bx(p, toon('#7a5236'), x - 0.02, x + 0.12, yt + 0.12, yt + 0.13, z - 0.021, z + 0.061, { cast: false }); }
}
/** a pendant lamp (green enamel shade) hanging from the ceiling */
function pendant(p, x, z, drop = 0.9) {
  const m = mats(), yc = Y + H - 0.02, yb = yc - drop;
  cyl2(p, m.black, [x, yc, z], [x, yb + 0.12, z], 0.006, 4, { noLine: true });
  const sh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 16, 1, true), toon('#2f4a3a', { side: THREE.DoubleSide })); sh.position.set(x, yb + 0.06, z); p.add(sh);
  sph(p, glow('#ffd59a', 2.2, { off: '#e8dcc0' }), 0.045, x, yb, z);
}

/* ---------------------------------------------------------------- the café */
export function buildCafe(parent) {
  const m = mats();
  const g = grp(parent);
  g.name = 'cafe';
  const R = rng(91);

  /* ---- walls: walnut boards outside, olive inside with a dark wainscot ---- */
  const f = (x0, x1, y0, y1) => wbx(g, m.clad, x0, x1, Y + y0, Y + y1, IZ1, Z1, 1);
  f(X0, W1[0], 0, H); f(W1[0], W1[1], 0, SILL); f(W1[0], W1[1], HEAD, H); f(W1[1], DOOR[0], 0, H); f(DOOR[0], DOOR[1], DH, H);
  f(DOOR[1], W2[0], 0, H); f(W2[0], W2[1], 0, SILL); f(W2[0], W2[1], HEAD, H); f(W2[1], X1, 0, H);
  wbx(g, m.clad, X0, IX0, Y, Y + H, Z0, IZ1, 1); // west
  wbx(g, m.clad, IX1, X1, Y, Y + H, Z0, IZ1, 1); // east
  // back (Kaigan-dori): a staff door and a small high window
  wbx(g, m.clad, IX0, -9.6, Y, Y + H, Z0, IZ0, 1); wbx(g, m.clad, -8.7, IX1, Y, Y + H, Z0, IZ0, 1); wbx(g, m.clad, -9.6, -8.7, Y + 2.2, Y + H, Z0, IZ0, 1);
  bx(g, m.green, -9.58, -8.72, Y, Y + 2.18, Z0 - 0.04, Z0 + 0.02);
  bx(g, toon('#c9a24a'), -8.88, -8.84, Y + 1.0, Y + 1.12, Z0 - 0.07, Z0 - 0.04, { cast: false });
  bx(g, m.green, -9.75, -8.55, Y + 2.2, Y + 2.26, Z0 - 0.25, Z0, { cast: false }); // a little drip hood
  // AC unit + gas meter on the back wall
  bx(g, toon('#e4e2dc'), -6.6, -5.8, Y + 0.05, Y + 0.65, Z0 - 0.32, Z0, { bevel: 0.02 });
  cy(g, toon('#9a9a96'), -6.2, Y + 0.35, Z0 - 0.33, 0.2, 0.01, 18).rotation.x = Math.PI / 2;
  bx(g, toon('#cfcac0'), -7.4, -7.1, Y + 1.0, Y + 1.4, Z0 - 0.12, Z0, { cast: false });
  // inside: olive walls, wainscot, ceiling, the tiled floor
  wbx(g, m.olive, IX0, IX1, Y, Y + H, IZ0, IZ0 + 0.01, 1, { cast: false });
  wbx(g, m.olive, IX0, IX0 + 0.01, Y, Y + H, IZ0, IZ1, 1, { cast: false });
  wbx(g, m.olive, IX1 - 0.01, IX1, Y, Y + H, IZ0, IZ1, 1, { cast: false });
  wbx(g, m.walnut, IX0, IX1, Y, Y + 0.9, IZ0, IZ0 + 0.03, 1, { cast: false });
  wbx(g, m.walnut, IX0, IX0 + 0.03, Y, Y + 0.9, IZ0, IZ1, 1, { cast: false });
  wbx(g, m.walnut, IX1 - 0.03, IX1, Y, Y + 0.9, IZ0, IZ1, 1, { cast: false });
  wbx(g, toon('#e9e1cf', { lit: 0.3 }), IX0, IX1, Y + H - 0.03, Y + H - 0.01, IZ0, IZ1, 1, { cast: false });
  wbx(g, m.floor, IX0, IX1, Y, Y + 0.015, IZ0, IZ1, 0.9, { cast: false });

  /* ---- the front: window frames, glass, sills, the arched timber door ---- */
  {
    const frame = (x0, x1, y0, y1, mull = []) => {
      const z0 = Z1 - 0.12, z1 = Z1 + 0.02, k = 0.06;
      bx(g, m.green, x0, x1, Y + y0, Y + y0 + k, z0, z1, { cast: false }); bx(g, m.green, x0, x1, Y + y1 - k, Y + y1, z0, z1, { cast: false });
      bx(g, m.green, x0, x0 + k, Y + y0, Y + y1, z0, z1, { cast: false }); bx(g, m.green, x1 - k, x1, Y + y0, Y + y1, z0, z1, { cast: false });
      mull.forEach(([a, b, c, d]) => bx(g, m.green, a, b, Y + c, Y + d, Z1 - 0.1, Z1 + 0.01, { cast: false }));
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.1, y1 - y0 - 0.1), makeGlass(x1 - x0, y1 - y0, 60 + x0, { alpha: 0.06, drops: 0.35, tint: 0xfff2dc }));
      gp.position.set((x0 + x1) / 2, Y + (y0 + y1) / 2, Z1 - 0.05); gp.userData.noLine = true; gp.renderOrder = 2; g.add(gp); reg.noRefl.push(gp);
    };
    const mid = (W1[0] + W1[1]) / 2;
    frame(W1[0], W1[1], SILL, HEAD, [[mid - 0.03, mid + 0.03, SILL, HEAD], [W1[0], W1[1], 2.0, 2.05]]);
    frame(W2[0], W2[1], SILL, HEAD, [[W2[0], W2[1], 2.0, 2.05]]);
    // sills + dark green panels under the windows
    [W1, W2].forEach(([a, b]) => { bx(g, m.cream, a - 0.08, b + 0.08, Y + SILL - 0.05, Y + SILL + 0.01, Z1 - 0.05, Z1 + 0.14, { bevel: 0.01 }); bx(g, m.green, a + 0.05, b - 0.05, Y + 0.08, Y + SILL - 0.1, Z1, Z1 + 0.025, { cast: false }); });
    // the door frame + the door leaf on its hinge (swings in as the camera comes close)
    bx(g, m.green, DOOR[0] - 0.05, DOOR[0], Y, Y + DH, Z1 - 0.14, Z1 + 0.03, { cast: false }); bx(g, m.green, DOOR[1], DOOR[1] + 0.05, Y, Y + DH, Z1 - 0.14, Z1 + 0.03, { cast: false });
    bx(g, m.green, DOOR[0] - 0.05, DOOR[1] + 0.05, Y + DH - 0.05, Y + DH + 0.03, Z1 - 0.14, Z1 + 0.03, { cast: false });
    const dw = DOOR[1] - DOOR[0] - 0.04, pv = grp(g, DOOR[0] + 0.02, Y, Z1 - 0.08, 0); pv.userData.keep = true;
    bx(pv, m.wood, 0, dw, 0.02, DH - 0.04, -0.03, 0.03, { bevel: 0.01 });
    [-0.031, 0.031].forEach((zz, k) => {
      const a = pl(pv, glow('#ffd8a0', 0.75, { map: archTex(), transparent: true, off: '#5b6a74' }), dw * 0.62, 1.15, dw / 2, 1.45, zz * 1.02, k ? 0 : Math.PI, 0); a.userData.noLine = true;
      bx(pv, toon('#c9a24a'), dw - 0.14, dw - 0.11, 0.95, 1.2, zz + (k ? 0 : -0.03), zz + (k ? 0.03 : 0), { cast: false });
    });
    // vertical OPEN plate beside the arch
    const op = pl(pv, new THREE.MeshBasicMaterial({ map: ct('cafeOpen', 32, 128, (c, w, h) => { c.fillStyle = '#2f4436'; c.fillRect(0, 0, w, h); ['O', 'P', 'E', 'N'].forEach((s, i) => txt(c, s, w / 2, 20 + i * 28, 22, '#f2e6cc', { font: SERIF })); }) }), 0.07, 0.28, 0.12, 1.45, 0.032, 0, 0);
    op.userData.noLine = true;
    const entrance = V((DOOR[0] + DOOR[1]) / 2, Y + 1, Z1);
    const inside = (p, pad = 0) => p.x > X0 - pad && p.x < X1 + pad && p.z > Z0 - pad && p.z < Z1 + pad;
    swingDoors({ leaves: [{ pv, s: 1 }], entrance, inside, angle: 1.45, near: 7.5, hit: doorHit(g, DOOR[1] - DOOR[0], DH, (DOOR[0] + DOOR[1]) / 2, Y + DH / 2, Z1 - 0.05) });
    (reg.closeZones ||= []).push((p) => inside(p, 0.8));
    reg.cafe = {
      entrance,
      views: {
        front: { t: V(-8.0, Y + 1.4, 19.5), s: new THREE.Spherical(8.5, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(8)) },
        inside: { t: V(-8.4, Y + 1.2, 16.2), s: new THREE.Spherical(3.6, THREE.MathUtils.degToRad(78), THREE.MathUtils.degToRad(5)) },
      },
    };
    // the door mat
    bx(g, toon('#4a3626'), DOOR[0] + 0.05, DOOR[1] - 0.05, Y, Y + 0.02, Z1 + 0.05, Z1 + 0.6, { cast: false });
  }

  /* ---- roof: low mono-pitch to the back, the name board, side fascias, the shingle hood ---- */
  {
    const yF = Y + H + 0.45, yB = Y + H + 0.07, zF = Z1 + 0.45, zB = Z0 - 0.3, a = Math.atan2(yF - yB, zF - zB), L = Math.hypot(zF - zB, yF - yB);
    const slab = (x0, x1, dy, th, mat) => { const r = wbx(g, mat, x0, x1, -th / 2, th / 2, -L / 2, L / 2, 1); r.position.set(r.position.x, (yF + yB) / 2 + dy, (zF + zB) / 2); r.rotation.x = -a; return r; };
    slab(X0 - 0.25, X1 + 0.25, 0, 0.14, m.roof);
    slab(X0 - 0.27, X0 - 0.13, -0.28, 0.46, m.walnut); slab(X1 + 0.13, X1 + 0.27, -0.28, 0.46, m.walnut);
    // the name board across the front
    bx(g, m.walnut, X0 - 0.27, X1 + 0.27, Y + 2.78, yF + 0.02, Z1, Z1 + 0.12, { bevel: 0.01 });
    const sg = pl(g, new THREE.MeshBasicMaterial({ map: signTex() }), 5.6, 0.7, (X0 + X1) / 2, Y + 3.24, Z1 + 0.122, 0, 0); sg.userData.noLine = true;
    // gooseneck lamps over the board
    [-10.4, -7.15, -5.4].forEach((x) => {
      cyl2(g, m.black, [x, yF - 0.05, Z1 + 0.12], [x, yF + 0.12, Z1 + 0.35], 0.012, 5); cyl2(g, m.black, [x, yF + 0.12, Z1 + 0.35], [x, yF + 0.02, Z1 + 0.5], 0.012, 5);
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.09, 12, 1, true), toon('#2f4436', { side: THREE.DoubleSide })); sh.position.set(x, yF - 0.02, Z1 + 0.52); sh.rotation.x = -0.5; g.add(sh);
      sph(g, glow('#ffe0b0', 2.0, { off: '#d8d0c0' }), 0.03, x, yF - 0.06, Z1 + 0.54); halo(g, x, Y + 3.2, Z1 + 0.3, '#ffd59a', 1.1, 0.3);
    });
    // the shingle hood over the shop front, on three brackets
    const hd = 0.8, hy0 = Y + 2.68, hy1 = Y + 2.46, ha = Math.atan2(hy0 - hy1, hd);
    const hood = wbx(g, m.shingle, X0 + 0.05, X1 - 0.05, -0.035, 0.035, -hd / 2, hd / 2, 0.5);
    hood.position.set((X0 + X1) / 2, (hy0 + hy1) / 2, Z1 + hd / 2); hood.rotation.x = ha;
    bx(g, m.walnut, X0 + 0.05, X1 - 0.05, hy1 - 0.08, hy1 + 0.0, Z1 + hd - 0.05, Z1 + hd + 0.02, { cast: false }); // fascia strip
    [X0 + 0.2, (W1[1] + DOOR[0]) / 2, (DOOR[1] + W2[0]) / 2, X1 - 0.2].forEach((x) => cyl2(g, m.walnut, [x, Y + 2.1, Z1 + 0.02], [x, hy1 + 0.02, Z1 + hd * 0.7], 0.025, 5));
    // the toast blade sign on the east corner (both faces)
    const tm = toon('#ffffff', { map: toastTex(), nocache: true, side: THREE.DoubleSide });
    tm.transparent = true; tm.alphaTest = 0.5;
    const bs = pl(g, tm, 0.62, 0.62, X1 - 0.12, Y + 2.15, Z1 + 0.52, Math.PI / 2, 0); bs.userData.noLine = true;
    cyl2(g, m.black, [X1 - 0.12, Y + 2.5, Z1 + 0.02], [X1 - 0.12, Y + 2.5, Z1 + 0.85], 0.012, 5);
    // roof piles: one plane falling to the back, the hood falling to the plaza
    (reg.extraRoofs ||= []).push(
      { id: 'cafeRoof', a: [X0 - 0.2, zF - 0.05], b: [X1 + 0.2, zF - 0.05], n: [0, -1], D: zF - zB - 0.1, y: yF + 0.08, drop: yF - yB, w: { petal: 0.2, leaf: 0.5 }, snow: 0.16, ridge: true }, // the high edge is free (no wall drift); a light petal fall
      { id: 'cafeHood', a: [X1 - 0.1, Z1 + 0.05], b: [X0 + 0.1, Z1 + 0.05], n: [0, 1], D: hd - 0.1, y: hy0 + 0.04, drop: hy0 - hy1, w: { leaf: 0.3 }, snow: 0.08 }, // no petal drift against the wall (it read as a pink stain)
    );
  }

  /* ---- inside ---- */
  {
    const yt = Y + 1.0;
    // the back counter
    wbx(g, m.walnut, IX0 + 0.03, -7.7, Y, Y + 0.95, IZ0 + 0.03, IZ0 + 0.62, 1);
    wbx(g, m.stone, IX0 + 0.03, -7.66, Y + 0.95, yt, IZ0 + 0.03, IZ0 + 0.66, 1, { cast: false });
    for (let x = -10.9; x < -7.9; x += 0.62) bx(g, toon('#3a2618'), x, x + 0.56, Y + 0.6, Y + 0.62, IZ0 + 0.62, IZ0 + 0.63, { cast: false });
    // espresso machine, grinder, cups, plates, the baguette basket
    {
      const x = -10.45, z = IZ0 + 0.3;
      bx(g, m.steel, x - 0.3, x + 0.3, yt, yt + 0.42, z - 0.2, z + 0.2, { bevel: 0.02 });
      bx(g, toon('#7a2e2a'), x - 0.3, x + 0.3, yt + 0.12, yt + 0.32, z + 0.2, z + 0.205, { cast: false });
      [-0.13, 0.13].forEach((d) => { cy(g, m.steel, x + d, yt + 0.12, z + 0.24, 0.04, 0.06, 10); cyl2(g, m.black, [x + d, yt + 0.12, z + 0.26], [x + d, yt + 0.1, z + 0.42], 0.015, 5); });
      for (let k = 0; k < 4; k++) cy(g, m.white, x - 0.2 + k * 0.13, yt + 0.42, z, 0.04, 0.06, 10, { rt: 1.2 });
      cy(g, m.black, x + 0.6, yt, z, 0.07, 0.28, 12); cy(g, toon('#c9d6d8', { op: 0.7 }), x + 0.6, yt + 0.28, z, 0.06, 0.16, 12, { rt: 1.4 });
      for (let k = 0; k < 5; k++) cy(g, m.white, -9.4, yt + k * 0.06, z, 0.045, 0.055, 10, { rt: 1.2 });
      for (let k = 0; k < 6; k++) cy(g, m.white, -9.0, yt + k * 0.018, z, 0.12, 0.012, 16);
      cy(g, toon('#b98a52'), -8.4, yt, z, 0.15, 0.18, 14, { rt: 1.12 });
      [[-0.05, 0.02, 0.25], [0.04, -0.03, -0.2], [0.0, 0.05, 0.05]].forEach(([dx, dz, tilt]) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.5, 4, 8), m.crustL); b.position.set(-8.4 + dx, yt + 0.38, z + dz); b.rotation.set(dz * 3, 0, tilt); g.add(b); });
      cy(g, m.white, -7.95, yt, z, 0.12, 0.14, 14, { rt: 0.4 }); cy(g, m.white, -7.95, yt + 0.14, z, 0.16, 0.012, 16); [[0, 0], [0.06, 0.05], [-0.06, 0.04]].forEach(([a, b]) => bread(g, 'muffin', -7.95 + a, yt + 0.152, z + b, 0.9));
    }
    // the chalk menu over the counter + posters, the cubby shelf
    bx(g, m.wood, -10.95, -8.15, Y + 1.42, Y + 2.62, IZ0 + 0.01, IZ0 + 0.06, { bevel: 0.01 });
    { const mm = pl(g, new THREE.MeshBasicMaterial({ map: menuTex(), color: 0xd8d8d8 }), 2.68, 1.08, -9.55, Y + 2.02, IZ0 + 0.062, 0, 0); mm.userData.noLine = true; }
    [[-7.65, 1.75, 0], [-6.95, 1.85, 1]].forEach(([x, y, k]) => { const pp = pl(g, toon('#ffffff', { map: posterTex(k), nocache: true, lit: 0.2 }), 0.5, 0.7, x, Y + y, IZ0 + 0.02, 0, 0); pp.userData.noLine = true; });
    {
      const x0 = -6.55, x1 = -5.85, z0 = IZ0 + 0.01, z1 = IZ0 + 0.36;
      wbx(g, m.walnut, x0, x0 + 0.04, Y, Y + 2.2, z0, z1); wbx(g, m.walnut, x1 - 0.04, x1, Y, Y + 2.2, z0, z1); wbx(g, m.walnut, x0, x1, Y + 2.16, Y + 2.2, z0, z1);
      [0.04, 0.6, 1.15, 1.7].forEach((y, k) => { wbx(g, m.walnut, x0, x1, Y + y, Y + y + 0.03, z0, z1, 1, { cast: false }); const yy = Y + y + 0.03; if (k === 1) { cy(g, m.cream, x0 + 0.18, yy, z0 + 0.18, 0.07, 0.2, 10, { rt: 0.6 }); cy(g, toon('#8fa69a'), x0 + 0.45, yy, z0 + 0.18, 0.06, 0.14, 10); } else if (k === 2) { [0, 1, 2, 3].forEach((i) => bx(g, toon(['#2f4a6b', '#e8dcc0', '#7a2e2a', '#3f5f3a'][i]), x0 + 0.08 + i * 0.07, x0 + 0.14 + i * 0.07, yy, yy + 0.24 - (i % 2) * 0.03, z0 + 0.06, z0 + 0.3, { cast: false })); } else if (k === 3) { cy(g, toon('#d9c7a2'), x0 + 0.35, yy, z0 + 0.18, 0.1, 0.1, 10); } else { bx(g, toon('#7a5a3a'), x0 + 0.08, x1 - 0.08, yy, yy + 0.3, z0 + 0.04, z1 - 0.04); } });
    }
    // open bread shelves on the east wall
    {
      const xa = IX1 - 0.44, xb = IX1 - 0.03, za = 15.0, zb = 17.8;
      [za, zb].forEach((z) => wbx(g, m.walnut, xa, xb, Y + 0.85, Y + 2.85, z - 0.03, z + 0.03));
      const breads = ['loaf', 'croissant', 'baguette', 'rye', 'toast', 'bagel'];
      [0.9, 1.38, 1.86, 2.34, 2.82].forEach((y, k) => {
        wbx(g, m.wood, xa, xb, Y + y, Y + y + 0.03, za, zb, 1, { cast: false });
        if (k === 4) return;
        const kind = breads[(k * 2 + 1) % breads.length], kind2 = breads[(k * 2) % breads.length];
        for (let z = za + 0.15; z < zb - 0.1; z += 0.2) bread(g, (z * 5 | 0) % 2 ? kind : kind2, (xa + xb) / 2 + (R() - 0.5) * 0.08, Y + y + 0.03, z, 1.0, R() * 3);
      });
      // wooden crates with bottles under the shelves
      [[15.5, 0], [16.6, 1]].forEach(([z, k]) => { wbx(g, m.woodL, xa, xb, Y, Y + 0.32, z - 0.42, z + 0.42, 0.5); if (k) for (let i = 0; i < 6; i++) cy(g, toon(['#3f5f3a', '#7a2e2a', '#e8dcc0'][i % 3]), (xa + xb) / 2 + ((i % 2) - 0.5) * 0.16, Y + 0.32, z - 0.3 + ((i / 2) | 0) * 0.3, 0.035, 0.24, 8, { rt: 0.5 }); else { bread(g, 'baguette', (xa + xb) / 2, Y + 0.32, z, 1.2, Math.PI / 2); bread(g, 'loaf', (xa + xb) / 2, Y + 0.32, z - 0.25, 1.1); } });
      // a string of paper bags on a hook rail
      bx(g, m.walnut, IX1 - 0.04, IX1 - 0.01, Y + 1.0, Y + 1.04, 18.0, 18.9, { cast: false });
    }
    // the glass pastry case + the till
    {
      const x0 = -10.4, x1 = -7.95, z0 = 16.3, z1 = 16.9;
      wbx(g, m.walnut, x0, x1, Y, Y + 0.85, z0, z1, 1);
      bx(g, toon('#3a2618'), x0 + 0.05, x1 - 0.05, Y + 0.1, Y + 0.7, z1, z1 + 0.01, { cast: false });
      bx(g, m.stone, x0, x1, Y + 0.85, Y + 0.88, z0, z1, { cast: false });
      bx(g, m.black, x0, x1, Y + 1.38, Y + 1.42, z0, z1, { cast: false });
      [x0, x1].forEach((x) => bx(g, m.black, x - 0.02, x + 0.02, Y + 0.88, Y + 1.38, z0, z1, { cast: false }));
      const gl = new THREE.MeshBasicMaterial({ color: 0xe8f4f6, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.52), gl); front.position.set((x0 + x1) / 2, Y + 1.13, z1); front.userData.noLine = true; front.renderOrder = 3; g.add(front);
      bx(g, toon('#dfe9ea', { op: 0.5 }), x0 + 0.02, x1 - 0.02, Y + 1.12, Y + 1.13, z0 + 0.05, z1 - 0.05, { cast: false });
      const lower = ['croissant', 'donut', 'cake', 'roll', 'bagel', 'muffin'], upper = ['toast', 'croissant', 'donut', 'cake', 'roll'];
      lower.forEach((k, i) => [0, 1, 2, 3].forEach((j) => bread(g, k, x0 + 0.14 + i * 0.4 + (j % 2) * 0.13, Y + 0.88, (z0 + z1) / 2 + (j < 2 ? -0.11 : 0.1), 1.15, i + j)));
      upper.forEach((k, i) => [0, 1, 2].forEach((j) => bread(g, k, x0 + 0.16 + i * 0.47 + j * 0.13, Y + 1.13, (z0 + z1) / 2 + (j % 2 ? 0.08 : -0.06), 1.1, i + j)));
      sph(g, glow('#fff0d0', 1.2, { off: '#efe6d2' }), 0.02, (x0 + x1) / 2, Y + 1.37, (z0 + z1) / 2, 40, 1, 6);
      // the till counter
      wbx(g, m.walnut, x1, -7.15, Y, Y + 0.98, z0, z1, 1);
      bx(g, m.stone, x1, -7.12, Y + 0.98, Y + 1.02, z0 - 0.02, z1 + 0.02, { cast: false });
      bx(g, m.black, -7.75, -7.4, Y + 1.02, Y + 1.12, 16.45, 16.75, { bevel: 0.01 });
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.02), toon('#2f3236')); scr.position.set(-7.57, Y + 1.24, 16.5); scr.rotation.x = -0.3; g.add(scr);
      cy(g, toon('#d8eef0', { op: 0.7 }), -7.3, Y + 1.02, 16.75, 0.05, 0.12, 10); // tip jar
      bx(g, m.cream, -7.45, -7.32, Y + 1.02, Y + 1.12, 16.38, 16.42, { cast: false }); // card stand
    }
    // pendant lamps (over the counter and the tables), the room light
    [[-10.2, 15.5], [-8.7, 15.5], [-10.25, 18.75, 1.1], [-8.75, 18.75, 1.1], [-5.75, 18.55, 1.1]].forEach(([x, z, d]) => pendant(g, x, z, d || 0.95));
    plight(g, '#ffcf8f', 9, 9.5, -8.0, Y + 2.6, 17.2, 'cafe');
    // three small tables with blue-cushioned chairs, the rug by the door
    table(g, -10.25, 18.75, { seed: 3 }); chair(g, -10.85, 18.75, Math.PI / 2); chair(g, -9.65, 18.75, -Math.PI / 2);
    table(g, -8.75, 18.75, { seed: 4 }); chair(g, -9.3, 18.75, Math.PI / 2); chair(g, -8.2, 18.75, -Math.PI / 2);
    table(g, -5.75, 18.55, { seed: 5 }); chair(g, -6.35, 18.55, Math.PI / 2); chair(g, -5.15, 18.55, -Math.PI / 2);
    bx(g, toon('#7a6a58'), -7.55, -6.75, Y + 0.015, Y + 0.025, 17.3, 19.6, { cast: false });
    { const p = makeFicusPot({ seed: 33 }); p.position.set(-10.95, Y, 15.55); g.add(p); }
  }

  /* ---- outside: the terrace tables, A-frame board, leaning board, umbrella stand, bin, conifer, lamp, bench ---- */
  {
    table(g, -10.35, 21.05, { metal: true, seed: 7, h: 0.7 }); chair(g, -10.92, 21.05, Math.PI / 2, { cushion: false, metal: true }); chair(g, -9.78, 21.05, -Math.PI / 2, { cushion: false, metal: true });
    table(g, -8.85, 21.05, { metal: true, seed: 8, h: 0.7, takeaway: true }); chair(g, -9.42, 21.05, Math.PI / 2, { cushion: false, metal: true }); chair(g, -8.28, 21.05, -Math.PI / 2, { cushion: false, metal: true });
    // the A-frame menu board
    {
      const a = grp(g, -5.55, Y, 20.95, -0.15), tex = aboardTex();
      // two boards hinged at the top: each foot stands out at z = ±0.19, each top leans in to meet at z = 0
      [1, -1].forEach((s) => {
        const b = grp(a, 0, 0, s * 0.19, 0); b.rotation.x = -s * Math.atan2(0.19, 0.92);
        bx(b, m.woodL, -0.27, 0.27, 0, 0.94, -0.02, 0.02, { bevel: 0.01 });
        const bp = pl(b, new THREE.MeshBasicMaterial({ map: tex }), 0.46, 0.7, 0, 0.5, s * 0.022, s > 0 ? 0 : Math.PI, 0); bp.userData.noLine = true;
      });
    }
    // a little board leaning against the pier: "fresh bread daily"
    { const lb = grp(g, -6.43, Y, Z1 + 0.12, 0); lb.rotation.x = -0.12; bx(lb, m.walnut, -0.11, 0.11, 0, 0.7, -0.015, 0.015); const lp = pl(lb, new THREE.MeshBasicMaterial({ map: ct('cafeLean', 64, 200, (c, w, h) => { c.fillStyle = '#f0e6d0'; c.fillRect(0, 0, w, h); ['FRESH', 'BREAD', 'DAILY'].forEach((s, i) => txt(c, s, w / 2, 50 + i * 50, 16, '#5a3a24', { font: SERIF })); }) }), 0.18, 0.62, 0, 0.35, 0.017, 0, 0); lp.userData.noLine = true; }
    // umbrella stand left of the door, a low green bin on the corner
    cy(g, m.green, -7.98, Y, Z1 + 0.25, 0.11, 0.42, 12);
    [[0.03, 0.02, '#2f4a6b'], [-0.03, -0.02, '#7a2e2a']].forEach(([a, b, c]) => { cyl2(g, toon(c), [-7.98 + a, Y + 0.1, Z1 + 0.25 + b], [-7.98 + a * 3, Y + 0.85, Z1 + 0.25 + b * 3], 0.03, 6); cyl2(g, m.black, [-7.98 + a * 3, Y + 0.85, Z1 + 0.25 + b * 3], [-7.98 + a * 3, Y + 0.95, Z1 + 0.25 + b * 3], 0.008, 4); });
    cy(g, m.green, -4.85, Y, 20.7, 0.17, 0.62, 14); cy(g, m.black, -4.85, Y + 0.62, 20.7, 0.18, 0.04, 14);
    // the potted conifer on the west corner
    { cy(g, toon('#d9cdb4'), -11.1, Y, 20.45, 0.22, 0.38, 14, { rt: 1.15 }); cy(g, toon('#5a4a3a'), -11.1, Y + 0.36, 20.45, 0.03, 0.2, 6); [[0.45, 0.62, 0.3], [0.36, 0.95, 0.5], [0.26, 1.25, 0.4]].forEach(([r, y, h]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h + 0.25, 9), toon('#2f5a3a')); c.position.set(-11.1, Y + y, 20.45); c.castShadow = true; g.add(c); }); }
    { const p = makeRhapisPot({ seed: 44 }); p.position.set(-6.45, Y, 20.45); p.scale.setScalar(0.75); g.add(p); }
    // the classic lantern post at the corner
    {
      const x = -11.95, z = 21.9;
      cy(g, m.black, x, Y, z, 0.12, 0.25, 12, { rt: 0.6 }); cy(g, m.black, x, Y + 0.25, z, 0.045, 2.9, 10);
      bx(g, m.black, x - 0.15, x + 0.15, Y + 3.1, Y + 3.14, z - 0.15, z + 0.15, { cast: false });
      bx(g, glow('#ffe2b0', 2.3, { cat: 'lamp', off: '#e8e2d2' }), x - 0.11, x + 0.11, Y + 3.14, Y + 3.44, z - 0.11, z + 0.11, { cast: false });
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 4), m.black); cap.position.set(x, Y + 3.53, z); cap.rotation.y = Math.PI / 4; g.add(cap);
      halo(g, x, Y + 3.3, z, '#ffd9a0', 2.4, 0.45, 'lamp');
    }
    // a bench against the west wall (on the lane)
    { const b = grp(g, X0 - 0.32, Y, 17.1, Math.PI / 2); bx(b, m.woodL, -0.8, 0.8, 0.42, 0.47, -0.2, 0.2, { bevel: 0.01 }); [-0.65, 0.65].forEach((a) => bx(b, m.black, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { cast: false })); bx(b, m.woodL, -0.8, 0.8, 0.6, 0.85, -0.22, -0.18, { bevel: 0.01 }); }
  }

  // no snow inside; wet boards outside darken a little in rain
  noSnowBox(IX0, IZ0, IX1, IZ1, Y + H);
  wetPass([m.woodL]);
  return g;
}
