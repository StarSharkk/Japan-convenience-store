import * as THREE from 'three';
import { reg, toon, glow, bx, bc, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect } from './core.js';
import { makeGlass } from './fx.js';
import { buildIzakaya } from './izakaya.js';

const Y0 = 0.15;

/* =========================================================== alley & back yard props */
function alleyProps(parent) {
  const g = grp(parent);
  const crate = (x, z, y, c) => bx(g, toon(c), x - 0.22, x + 0.22, y, y + 0.28, z - 0.17, z + 0.17);
  // beer crates beside the izakaya
  [[-8.1, 3.2], [-8.1, 2.7]].forEach(([x, z]) => { crate(x, z, Y0, '#c4552f'); crate(x, z, Y0 + 0.28, '#d8643a'); });
  [[-8.0, 3.0]].forEach(([x, z]) => { for (let i = 0; i < 4; i++) bx(g, toon(['#3d8a4a', '#8a5a2e'][i % 2]), x - 0.05 + (i % 2) * 0.12 - 0.12, x + 0.04 + (i % 2) * 0.12 - 0.12, Y0 + 0.56, Y0 + 0.86, z - 0.07 + (i >> 1) * 0.16 - 0.08, z + 0.03 + (i >> 1) * 0.16 - 0.08, { cast: false }); });
  // bins / garbage bags
  [[-6.2, -1.0], [-6.0, -4.5]].forEach(([x, z]) => {
    bx(g, toon('#3a4a68'), x - 0.3, x + 0.3, Y0, Y0 + 0.9, z - 0.3, z + 0.3);
    bx(g, toon('#2a3652'), x - 0.32, x + 0.32, Y0 + 0.9, Y0 + 0.96, z - 0.32, z + 0.32);
  });
  [[-6.8, 0.2], [-6.5, 0.45], [-6.9, 0.55]].forEach(([x, z]) => sph(g, toon('#c7d3e6', { e: '#222b3c', ei: 0.5 }), 0.19, x, Y0 + 0.17, z, 1, 0.9, 1));
  // yard garbage cage
  bx(g, toon('#7b8498'), -3.5, -1.5, Y0, Y0 + 1.1, -6.9, -5.4);
  for (let i = 0; i < 6; i++) sph(g, toon('#bcc9dd', { e: '#202a3a', ei: 0.5 }), 0.22, -3.2 + (i % 3) * 0.5, Y0 + 0.2 + Math.floor(i / 3) * 0.3, -6.4 + (i % 2) * 0.3, 1, 0.9, 1);
  // back door light
  bx(g, toon('#2a3142'), -0.5, 0.5, 2.55, 2.62, -4.55, -4.2);
  bx(g, glow('#ffe6b0', 2.2), -0.4, 0.4, 2.5, 2.55, -4.5, -4.25, { cast: false });
  halo(g, 0, 2.4, -4.3, '#ffe0a0', 2.0, 0.35);
  // drink pallets behind the store
  for (let i = 0; i < 6; i++) bx(g, toon(['#3a8fd6', '#d8483f', '#e8b83a'][i % 3]), 1.0 + (i % 3) * 0.55, 1.5 + (i % 3) * 0.55, Y0 + Math.floor(i / 3) * 0.32, Y0 + Math.floor(i / 3) * 0.32 + 0.3, -6.3, -5.8);
  // alley lamp (dim fluorescent) at far end
  bx(g, toon('#2a3142'), -7.2, -6.8, 2.9, 3.0, -7.15, -7.0);
  bx(g, glow('#cfe9ff', 2.2), -7.15, -6.85, 2.84, 2.9, -7.14, -7.02, { cast: false });
  halo(g, -7.0, 2.8, -6.8, '#bfe0ff', 2.0, 0.35);
  return g;
}

export function buildBuildings(parent, drips) {
  const g = grp(parent);
  buildIzakaya(g, drips);
  alleyProps(g);
  return g;
}
