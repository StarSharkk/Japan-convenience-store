import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, halo, plight, rng, canvasTex } from './core.js';

const Y0 = 0.15;

/* ------------------------------------------------------------------ stylised trees
   Soft, rounded cel-shaded crowns: one big "mass" sphere plus a ring of overlapping puffs, painted in a
   4-shade palette (dark underside -> bright top). Smooth spheres + the AA ink silhouette give the clean
   vector-illustration look without any noisy leaf geometry. */
const PALETTES = {
  green: ['#1f4a43', '#2b6558', '#3a8068', '#55a07c'],
  teal: ['#1c4150', '#285c68', '#357b80', '#4f9a96'],
  sakura: ['#b86a92', '#d98aae', '#eaa9c4', '#f6c9dc'],
  ginkgo: ['#8a7228', '#b8963a', '#d8b64e', '#efd272'],
};
const trunkMat = toon('#4a3a40');
const trunkLit = toon('#6a5560');

function crownMat(c, kind) {
  return toon(c, { e: kind === 'sakura' ? '#3a1630' : '#06141a', ei: kind === 'sakura' ? 0.6 : 0.8 });
}

export function tree(parent, x, z, h, kind = 'green', seed = 1) {
  const R = rng(seed * 97 + 13);
  const g = grp(parent, x, Y0, z, R() * 6.28);
  const pal = PALETTES[kind];
  const mats = pal.map((c) => crownMat(c, kind));
  const trunkH = h * 0.42;
  const tr = h * 0.045;
  cy(g, trunkMat, 0, 0, 0, tr, trunkH, 9, { rt: 0.62 });
  cy(g, trunkLit, 0.0, 0, 0, tr * 0.5, trunkH * 0.96, 7, { rt: 0.5, cast: false });
  // two stub branches
  cyl2(g, trunkMat, [0, trunkH * 0.7, 0], [h * 0.12, trunkH * 1.12, h * 0.03], tr * 0.45, 6);
  cyl2(g, trunkMat, [0, trunkH * 0.62, 0], [-h * 0.11, trunkH * 1.05, -h * 0.04], tr * 0.4, 6);
  const cy0 = h * 0.62;
  const r = h * 0.31;
  sph(g, mats[1], r, 0, cy0, 0, 1, 0.88, 1);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.5;
    const d = r * (0.62 + R() * 0.22);
    const yo = (R() - 0.35) * r * 0.75;
    const rr = r * (0.5 + R() * 0.28);
    const shade = yo > r * 0.15 ? 3 : yo > -r * 0.1 ? 2 : 0;
    sph(g, mats[Math.min(3, shade + (R() < 0.3 ? 1 : 0))], rr, Math.cos(a) * d, cy0 + yo, Math.sin(a) * d, 1, 0.9, 1);
  }
  sph(g, mats[3], r * 0.62, r * 0.1, cy0 + r * 0.62, -r * 0.05, 1, 0.8, 1);
  sph(g, mats[0], r * 0.7, 0, cy0 - r * 0.55, 0, 1, 0.55, 1, { cast: false });
  return g;
}

function bush(parent, x, z, r, kind = 'green') {
  const mats = PALETTES[kind].map((c) => crownMat(c, kind));
  const g = grp(parent, x, Y0, z);
  sph(g, mats[1], r, 0, r * 0.55, 0, 1.25, 0.8, 1);
  sph(g, mats[2], r * 0.7, r * 0.5, r * 0.8, r * 0.1, 1, 0.75, 1);
  sph(g, mats[3], r * 0.45, -r * 0.3, r * 1.05, 0, 1, 0.7, 1);
  return g;
}

/* ------------------------------------------------------------------ small, quiet houses behind the trees */
function lowHouse(parent, x0, x1, z0, z1, h, wall, roof, windows) {
  const g = grp(parent);
  bx(g, toon(wall), x0, x1, Y0, Y0 + h, z0, z1);
  const rw = x1 - x0 + 0.8;
  const sh = new THREE.Shape();
  sh.moveTo(-rw / 2, 0);
  sh.lineTo(rw / 2, 0);
  sh.lineTo(0, 1.15);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 + 0.8, bevelEnabled: false });
  geo.translate((x0 + x1) / 2, Y0 + h, z0 - 0.4);
  const m = new THREE.Mesh(geo, [toon(wall), toon(roof)]);
  m.castShadow = true;
  g.add(m);
  windows.forEach(([wx, wy, c]) => {
    bx(g, toon('#1d2231'), wx - 0.42, wx + 0.42, Y0 + wy - 0.04, Y0 + wy + 0.62, z1, z1 + 0.06);
    bx(g, glow(c, 1.0), wx - 0.36, wx + 0.36, Y0 + wy, Y0 + wy + 0.56, z1 + 0.06, z1 + 0.075, { cast: false });
  });
  return g;
}

/* ------------------------------------------------------------------ stone garden lantern */
function toro(parent, x, z) {
  const g = grp(parent, x, Y0, z);
  const st = toon('#7a8294');
  cy(g, st, 0, 0, 0, 0.14, 0.12, 8);
  cy(g, st, 0, 0.12, 0, 0.07, 0.5, 8);
  cy(g, st, 0, 0.62, 0, 0.2, 0.07, 8);
  bx(g, glow('#ffd9a0', 2.4), -0.1, 0.1, 0.69, 0.9, -0.1, 0.1, { cast: false });
  cy(g, st, 0, 0.9, 0, 0.26, 0.1, 8, { rt: 0.3 });
  sph(g, st, 0.06, 0, 1.05, 0);
  halo(g, 0, 0.8, 0, '#ffd9a0', 1.5, 0.5);
  return g;
}

export function buildBackdrop(parent) {
  const g = grp(parent);

  /* ---- low concrete-block wall closing the back lot (and the alley end) ---- */
  const wall = toon('#8e95a8');
  const cap = toon('#b4bacb');
  const WZ0 = -7.5, WZ1 = -7.3;
  bx(g, wall, -8.5, -7.7, Y0, Y0 + 1.15, WZ0, WZ1);
  bx(g, wall, -6.3, 7.5, Y0, Y0 + 1.15, WZ0, WZ1);
  bx(g, cap, -8.55, -7.65, Y0 + 1.15, Y0 + 1.22, WZ0 - 0.04, WZ1 + 0.04);
  bx(g, cap, -6.35, 7.55, Y0 + 1.15, Y0 + 1.22, WZ0 - 0.04, WZ1 + 0.04);
  for (let x = -5.0; x < 7.4; x += 2.4) bx(g, toon('#7c8397'), x - 0.1, x + 0.1, Y0, Y0 + 1.15, WZ0 - 0.04, WZ1 + 0.06);
  // wooden gate at the alley end
  const wood = toon('#6b4a35');
  bx(g, wood, -7.7, -7.6, Y0, Y0 + 1.7, WZ0 - 0.06, WZ1 + 0.06);
  bx(g, wood, -6.4, -6.3, Y0, Y0 + 1.7, WZ0 - 0.06, WZ1 + 0.06);
  bx(g, wood, -7.75, -6.25, Y0 + 1.7, Y0 + 1.82, WZ0 - 0.1, WZ1 + 0.1);
  for (let x = -7.55; x < -6.4; x += 0.14) bx(g, toon('#7d573d'), x, x + 0.1, Y0, Y0 + 1.5, WZ0 + 0.04, WZ1 - 0.04, { cast: false });
  halo(g, -7.0, 1.9, -7.2, '#bfe0ff', 1.6, 0.3);

  /* ---- hedge + bushes along the inside of the wall ---- */
  for (let x = -4.6; x < 7.2; x += 1.15) bush(g, x + (Math.sin(x * 3.1) * 0.15), -7.95, 0.52 + 0.1 * Math.sin(x * 5.3), x > 1 && x < 3 ? 'teal' : 'green');
  toro(g, 3.4, -7.0);

  /* ---- quiet low houses peeking over the trees ---- */
  lowHouse(g, -5.2, 0.4, -11.6, -9.4, 3.1, '#3b4160', '#242a45', [[-3.6, 1.3, '#ffcf8a'], [-1.2, 1.3, '#5d6a90']]);
  lowHouse(g, 2.6, 6.6, -11.7, -9.6, 2.8, '#363c58', '#222741', [[4.2, 1.2, '#5d6a90'], [5.7, 1.2, '#ffc27a']]);

  /* ---- tree rows: back row (tall, soft) + front row (smaller) ---- */
  const back = [
    [-10.6, -9.6, 4.9, 'green'], [-8.6, -10.8, 5.4, 'teal'], [-6.5, -9.1, 4.4, 'sakura'], [-4.3, -10.9, 5.6, 'green'],
    [-1.8, -8.9, 4.2, 'green'], [0.6, -10.8, 5.2, 'ginkgo'], [3.0, -9.0, 4.4, 'teal'], [5.4, -10.4, 5.0, 'green'], [7.0, -8.6, 4.2, 'sakura'],
    [-11.2, -11.4, 4.6, 'teal'], [-7.6, -11.6, 4.8, 'green'], [-3.0, -11.5, 4.6, 'teal'], [2.0, -11.6, 4.8, 'green'], [-5.6, -8.9, 4.0, 'green'],
  ];
  back.forEach(([x, z, h, k], i) => tree(g, x, z, h, k, i + 1));
  const front = [
    [-9.8, -8.2, 3.2, 'green'], [-5.6, -8.4, 3.0, 'teal'], [-0.4, -8.6, 3.0, 'green'], [4.6, -8.4, 3.2, 'sakura'],
  ];
  front.forEach(([x, z, h, k], i) => tree(g, x, z, h, k, i + 20));

  /* ---- street trees on the east pavement (framing the road, softening the pole line) ---- */
  [[6.15, -5.4, 3.3, 'green'], [6.15, -7.9, 3.6, 'sakura']].forEach(([x, z, h, k], i) => {
    // tree pit
    bx(g, toon('#2a3142'), x - 0.45, x + 0.45, Y0, Y0 + 0.06, z - 0.45, z + 0.45, { cast: false });
    tree(g, x, z, h, k, i + 40);
  });

  /* ---- cool ambient light under the canopy so the greens read as lit, not black ---- */
  plight(g, '#8fb8d8', 5, 12, -2, 3.2, -8, 'tree');
  plight(g, '#ffb8d0', 3, 9, 6.5, 3.0, -7.5, 'sakura');
  return g;
}
