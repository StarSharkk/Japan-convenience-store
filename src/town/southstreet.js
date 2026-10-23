import * as THREE from 'three';
import { toon, glow, bx, cy, cyl2, sph, pl, grp, halo, rng } from '../core.js';
import { bicycle } from '../street.js';
import { makeShrub } from '../tree.js';
import { makePot } from '../plants/pottedPlants.js';
import { YS, ct, wbx, txt, SERIF, paverTex, wetPass } from './shopkit.js';

/* ====================================================================================================
   The south block's shared street front (town/cafe.js + town/bookstore.js): one paving over the levelled pad
   (layout.js SOUTH_SHOPS_PAD) with a stone edge where it meets the sakura plaza, and the street things between
   and beside the two shops - a bench facing the plaza, a wooden flower + cup cart, a parked bicycle, planter
   boxes, a classic lantern post, a finger-post to the plaza and the sea, a clipped hedge on Hoshizora-dori.
   ==================================================================================================== */

const Y = YS;

export function buildSouthStreet(parent) {
  const g = grp(parent);
  g.name = 'southStreet';
  const R = rng(57);
  const pav = toon('#ffffff', { map: paverTex(), nocache: true });
  const edge = toon('#d6cfc0');
  const wood = toon('#b0814f', { lit: 0.12 }), woodD = toon('#6b4a32'), black = toon('#262626');

  /* ---- paving over the pad, the stone edge to the plaza ---- */
  wbx(g, pav, -12.25, 6.35, Y - 0.06, Y + 0.012, 13.15, 22.55, 1.6, { cast: false });
  wbx(g, edge, -12.25, 6.35, Y - 0.1, Y + 0.03, 22.55, 22.75, 1, { cast: false });

  /* ---- between the shops: planter boxes, the bicycle, the cart, the bench ---- */
  const box = (x, z, w, d) => {
    wbx(g, wood, x - w / 2, x + w / 2, Y, Y + 0.42, z - d / 2, z + d / 2, 0.5);
    wbx(g, toon('#4a3a2c'), x - w / 2 + 0.05, x + w / 2 - 0.05, Y + 0.38, Y + 0.41, z - d / 2 + 0.05, z + d / 2 - 0.05, 1, { cast: false });
    for (let i = 0; i < Math.round(w / 0.45); i++) { const sb = makeShrub({ seed: 160 + i + ((x * 10) | 0), width: 0.45, height: 0.45, palette: 'deep' }); sb.position.set(x - w / 2 + 0.25 + i * 0.45, Y + 0.38, z); g.add(sb); }
    for (let i = 0; i < 7; i++) sph(g, toon(['#f2a0c4', '#ffffff', '#9a7ad6'][i % 3]), 0.035, x - w / 2 + 0.15 + R() * (w - 0.3), Y + 0.72 + R() * 0.1, z + (R() - 0.5) * (d - 0.15));
  };
  box(-3.3, 15.2, 1.6, 0.5);
  bicycle(grp(g, 0, Y - 0.15, 0), -3.15, 17.6, Math.PI / 2, '#6c8a3a', 0.12);
  // the wooden cart with flower pots and cups
  {
    const c = grp(g, -3.3, Y, 20.35, 0.08);
    bx(c, wood, -0.55, 0.55, 0.55, 0.62, -0.3, 0.3, { bevel: 0.01 });
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([a, b]) => bx(c, wood, a - 0.02, a + 0.02, 0.62, 0.8, b - 0.02, b + 0.02, { cast: false }));
    bx(c, wood, -0.55, 0.55, 0.78, 0.82, -0.32, -0.28, { cast: false }); bx(c, wood, -0.55, 0.55, 0.78, 0.82, 0.28, 0.32, { cast: false });
    [-0.36, 0.36].forEach((b) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 18), woodD); w.position.set(-0.1, 0.26, b); c.add(w); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; cyl2(c, woodD, [-0.1 + Math.cos(a) * 0.22, 0.26 + Math.sin(a) * 0.22, b], [-0.1 - Math.cos(a) * 0.22, 0.26 - Math.sin(a) * 0.22, b], 0.012, 4); } });
    cyl2(c, woodD, [-0.1, 0.26, -0.36], [-0.1, 0.26, 0.36], 0.02, 6);
    cyl2(c, woodD, [0.55, 0.6, 0], [0.95, 0.85, 0], 0.025, 6); bx(c, woodD, -0.62, -0.55, 0, 0.55, -0.03, 0.03, { cast: false });
    [[-0.35, -0.1, '#f2d23a'], [-0.05, 0.12, '#f2a0c4'], [0.25, -0.12, '#ffffff']].forEach(([a, b, col], i) => { const p = makePot({ r: 0.08, h: 0.13, seed: 20 + i }).group; p.position.set(a, 0.62, b); c.add(p); for (let k = 0; k < 6; k++) sph(c, toon(k % 2 ? col : '#4f7f46'), 0.03, a + Math.cos(k) * 0.05, 0.8 + (k % 3) * 0.02, b + Math.sin(k) * 0.05); });
    for (let k = 0; k < 4; k++) cy(c, toon('#f6f3ec'), 0.38 + (k % 2) * 0.08, 0.62 + ((k / 2) | 0) * 0.11, 0.1 - (k % 2) * 0.06, 0.035, 0.11, 10, { rt: 1.25 });
  }
  // the bench facing the plaza
  {
    const b = grp(g, -3.3, Y, 21.75, 0);
    bx(b, wood, -0.75, 0.75, 0.42, 0.47, -0.2, 0.2, { bevel: 0.01 });
    bx(b, wood, -0.75, 0.75, 0.6, 0.85, -0.22, -0.18, { bevel: 0.01 });
    [-0.6, 0.6].forEach((a) => { bx(b, black, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { cast: false }); bx(b, black, a - 0.03, a + 0.03, 0.42, 0.85, -0.22, -0.18, { cast: false }); });
  }

  /* ---- the east side (Hoshizora-dori): a clipped hedge, a lantern post, a finger-post ---- */
  [15.3, 16.4, 17.5, 18.6].forEach((z, i) => { const sb = makeShrub({ seed: 180 + i, width: 0.6, height: 0.6, palette: 'deep' }); sb.position.set(5.0, Y, z); g.add(sb); });
  const lantern = (x, z) => {
    cy(g, black, x, Y, z, 0.12, 0.25, 12, { rt: 0.6 }); cy(g, black, x, Y + 0.25, z, 0.045, 2.9, 10);
    bx(g, black, x - 0.15, x + 0.15, Y + 3.1, Y + 3.14, z - 0.15, z + 0.15, { cast: false });
    bx(g, glow('#ffe2b0', 2.3, { cat: 'lamp', off: '#e8e2d2' }), x - 0.11, x + 0.11, Y + 3.14, Y + 3.44, z - 0.11, z + 0.11, { cast: false });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 4), black); cap.position.set(x, Y + 3.53, z); cap.rotation.y = Math.PI / 4; g.add(cap);
    halo(g, x, Y + 3.3, z, '#ffd9a0', 2.4, 0.45, 'lamp');
  };
  lantern(5.6, 22.0); lantern(-3.3, 22.35);
  {
    const x = 5.6, z = 20.6, sgn = (k) => ct(`southSign${k}`, 256, 64, (c, w, h) => { c.fillStyle = '#f2ead8'; c.beginPath(); if (k) { c.moveTo(0, 0); c.lineTo(w - 30, 0); c.lineTo(w, h / 2); c.lineTo(w - 30, h); c.lineTo(0, h); } else { c.moveTo(30, 0); c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(30, h); c.lineTo(0, h / 2); } c.closePath(); c.fill(); txt(c, k ? '桜広場 →' : '← 海辺', w / 2, h / 2 + 2, 30, '#3a2a22', { font: SERIF }); });
    cy(g, woodD, x, Y, z, 0.05, 2.3, 8);
    [[0, Y + 2.0, 0.3], [1, Y + 1.7, -0.9]].forEach(([k, y, ry]) => { const m = toon('#ffffff', { map: sgn(k), nocache: true, side: THREE.DoubleSide }); m.transparent = true; m.alphaTest = 0.5; const s = pl(g, m, 0.6, 0.15, x + Math.sin(ry) * 0.3, y, z + Math.cos(ry) * 0.3, ry + Math.PI / 2, 0); s.userData.noLine = true; });
  }

  wetPass([pav, wood]);
  return g;
}
