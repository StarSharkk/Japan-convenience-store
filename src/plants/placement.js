import { toon, bx, setCat } from '../core.js';
import * as THREE from 'three';
import { makeTaro, makeFern, makeHosta, makeAspidistra } from './groundPlants.js';
import { makeRhapisPot, makeFicusPot } from './pottedPlants.js';
import { groundY } from '../town/layout.js';
import { SITE } from '../site.js';

/* ====================================================================================================
   Where the approved plants live (built with the world, batched by mergeStatic):
     - the izakaya entrance: 観音竹 in a terracotta pot at the street corner (outside the menu boards,
       under the hip of the eaves), ゴムの木 by the alley mouth. They replace the old cone planters.
     - a low concrete-edged planting bed on the south pavement of Kaigan-dori, across from the shop,
       with the four ground plants (クワズイモ, シダ, ギボウシ, ハラン). The town lamp at x = -4 stands in it.
   ==================================================================================================== */
export function buildPlantings(world) {
  const g = new THREE.Group();
  g.name = 'plantings';
  setCat('street'); // exterior: their toon materials take the shared snow cover (shop-category ones never do)

  /* ---- izakaya entrance pots (the bakery dresses its own front: bakery.js) ---- */
  if (SITE.izakaya) {
    const rh = makeRhapisPot({ seed: 21 }); rh.position.set(-12.32, 0.15, 4.72); rh.rotation.y = 0.6; g.add(rh);
    const fi = makeFicusPot({ seed: 31 }); fi.position.set(-8.42, 0.15, 4.64); fi.rotation.y = 2.2; fi.scale.setScalar(0.92); g.add(fi);
  }

  /* ---- planting bed across the main road ---- */
  const x0 = -9.2, x1 = -1.9, z0 = 12.25, z1 = 13.25, y = groundY(-5.5, 12.75);
  const edge = toon('#b9b3a7'), soil = toon('#4a3a2c', { lit: 0.02 });
  bx(g, edge, x0, x1, y, y + 0.14, z0, z0 + 0.1); bx(g, edge, x0, x1, y, y + 0.14, z1 - 0.1, z1);
  bx(g, edge, x0, x0 + 0.1, y, y + 0.14, z0, z1); bx(g, edge, x1 - 0.1, x1, y, y + 0.14, z0, z1);
  bx(g, soil, x0 + 0.1, x1 - 0.1, y, y + 0.1, z0 + 0.1, z1 - 0.1, { cast: false, bevel: 0 });
  const mk = { taro: makeTaro, fern: makeFern, hosta: makeHosta, aspidistra: makeAspidistra };
  [
    ['taro', -8.55, 12.8, 0.2, 1.0], ['fern', -7.6, 12.6, 1.1, 0.95], ['aspidistra', -6.8, 12.85, 2.0, 1.0],
    ['hosta', -6.0, 12.6, 0.7, 1.0], ['fern', -5.2, 12.85, 2.6, 0.85], ['hosta', -4.55, 12.85, 1.9, 0.9],
    ['taro', -3.3, 12.85, 3.4, 0.85], ['aspidistra', -2.45, 12.7, 0.4, 0.9], // the lamp post at (-4.0, 12.4) sits between them
  ].forEach(([id, x, z, ry, s], i) => {
    const m = mk[id]({ seed: 40 + i * 3, scale: s });
    m.position.set(x, y + 0.1, z); m.rotation.y = ry;
    g.add(m);
  });
  world.add(g);
  setCat('shop');
  return g;
}
