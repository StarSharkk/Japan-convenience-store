import { setCat } from '../core.js';
import * as THREE from 'three';
import { makeRhapisPot, makeFicusPot } from './pottedPlants.js';
import { SITE } from '../site.js';

/* ====================================================================================================
   Where the approved plants live (built with the world, batched by mergeStatic):
     - the izakaya entrance: 観音竹 in a terracotta pot at the street corner (outside the menu boards,
       under the hip of the eaves), ゴムの木 by the alley mouth. They replace the old cone planters.
     (the planting bed that stood on the south pavement of Kaigan-dori is gone: the café's back wall is there now)
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

  world.add(g);
  setCat('shop');
  return g;
}
