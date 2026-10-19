import * as THREE from 'three';
import { reg, toon, bx, grp, halo, plight, rng } from './core.js';
import { makeTree, makeShrub } from './tree.js';

const Y0 = 0.15;

/* ====================================================================================================
   Back-of-store green belt: ONLY trees, shrubs, a low boundary wall, lawn and a path.
   No buildings, sheds or boxes here (the lawn itself is painted in ground.js).
   ==================================================================================================== */
export function buildBackdrop(parent) {
  const g = grp(parent);
  const R = rng(2024);

  /* ---- low concrete-block wall closing the back lot (and the alley end) ---- */
  const wall = toon('#8e95a8');
  const cap = toon('#b4bacb');
  const WZ0 = -7.5, WZ1 = -7.3;
  bx(g, wall, -8.5, -7.7, Y0, Y0 + 1.15, WZ0, WZ1);
  bx(g, wall, -6.3, 7.5, Y0, Y0 + 1.15, WZ0, WZ1);
  bx(g, cap, -8.55, -7.65, Y0 + 1.15, Y0 + 1.22, WZ0 - 0.04, WZ1 + 0.04);
  bx(g, cap, -6.35, 7.55, Y0 + 1.15, Y0 + 1.22, WZ0 - 0.04, WZ1 + 0.04);
  for (let x = -5.0; x < 7.4; x += 2.4) bx(g, toon('#7c8397'), x - 0.1, x + 0.1, Y0, Y0 + 1.15, WZ0 - 0.04, WZ1 + 0.06);
  // wooden gate at the alley end (part of the boundary)
  const wood = toon('#6b4a35');
  bx(g, wood, -7.7, -7.6, Y0, Y0 + 1.7, WZ0 - 0.06, WZ1 + 0.06);
  bx(g, wood, -6.4, -6.3, Y0, Y0 + 1.7, WZ0 - 0.06, WZ1 + 0.06);
  bx(g, wood, -7.75, -6.25, Y0 + 1.7, Y0 + 1.82, WZ0 - 0.1, WZ1 + 0.1);
  for (let x = -7.55; x < -6.4; x += 0.14) bx(g, toon('#7d573d'), x, x + 0.1, Y0, Y0 + 1.5, WZ0 + 0.04, WZ1 - 0.04, { cast: false });
  halo(g, -7.0, 1.9, -7.2, '#bfe0ff', 1.6, 0.3);

  /* ---- the grove: 5 tall, widely spreading trees at an even rhythm, each a different height.
          Long visible trunks (like the reference), then one continuous low shrub bed underneath. ---- */
  const grove = grp(g);
  const pals = ['deep', 'teal', 'grey', 'deep', 'grey', 'teal'];
  let seed = 11;
  const tree = (x, z, h, o = {}) => {
    const t = makeTree({ seed: seed++, height: h, lean: (R() - 0.5) * 0.16, spread: 1.25, palette: pals[seed % pals.length], dens: 2.6, leafScale: 0.55, ...o });
    t.position.set(x, Y0, z);
    t.rotation.y = R() * 6.28;
    grove.add(t);
    // remember the crown so holiday lights / glows can sit inside the real tree
    const cr = t.userData.crown;
    if (cr) { const c = cr.center.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t.rotation.y).add(t.position); (reg.trees = reg.trees || []).push({ center: c, half: cr.half.clone(), height: h }); }
    return t;
  };
  // x spacing ~3.1 m, heights deliberately uneven (tall / mid / tallest / mid-tall / tall)
  [[-7.0, -9.7, 7.3], [-3.9, -9.4, 6.2], [-0.8, -9.9, 8.1], [2.3, -9.5, 6.7], [5.2, -9.8, 7.5]].forEach(([x, z, h]) => tree(x, z + (R() - 0.5) * 0.4, h, { blossom: 1 })); // every tree can turn into a cherry tree (spring / sakura festival)

  // low shrub bed: two overlapping rows -> one continuous green band under the trunks
  const bed = (x0, x1, z, hMin, hMax, step, palOff, o = {}) => {
    for (let x = x0, i = 0; x < x1; x += step * (0.85 + R() * 0.3), i++) {
      const s = makeShrub({ seed: seed++, width: step * 1.5, height: hMin + R() * (hMax - hMin), palette: pals[(i + palOff) % pals.length], ...o });
      s.position.set(x, Y0, z + (R() - 0.5) * 0.35);
      s.rotation.y = R() * 6.28;
      grove.add(s);
    }
  };
  bed(-8.4, 7.2, -7.95, 0.7, 1.05, 1.1, 0);      // front row, hugging the wall
  bed(-8.4, 7.2, -8.6, 1.0, 1.5, 1.5, 2);        // back row, a little taller
  // broad-leaf accent plants (big leaves, like the reference) tucked into the bed
  [-6.0, -2.4, 1.2, 4.6].forEach((x, i) => {
    const s = makeShrub({ seed: seed++, width: 1.5, height: 1.0, palette: 'grey', dens: 0.3, leafScale: 2.3 });
    s.position.set(x + (R() - 0.5) * 0.8, Y0, -7.9);
    s.rotation.y = R() * 6.28;
    grove.add(s);
  });
  reg.noRefl.push(grove); // the grove is behind the wall: skip it in the (expensive) ground reflection pass

  /* ---- cool ambient light under the canopy so the greens read as lit, not black ---- */
  plight(g, '#8fb8d8', 5, 12, -2, 3.2, -8, 'tree');
  return g;
}
