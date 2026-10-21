import * as THREE from 'three';
import { toon } from '../core.js';
import { GROUND_PLANTS } from './groundPlants.js';
import { POTTED_PLANTS } from './pottedPlants.js';

/* ====================================================================================================
   Review helpers for the plant candidates (nothing here is part of the shipped scene):
     ?view=plants  a stage with every candidate in a row, real scene lighting / ink / weather / time.
                   window.__plants.view('lineup' | 'front' | 'side' | 'q45' | 'pot' | 'potTop' | ...)
   (the approved plants are placed in the town by plants/placement.js)
   ==================================================================================================== */

export function buildPlantStage(scene) {
  const stage = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.2, 64), toon('#8f8778', { lit: 0.02 }));
  disc.position.y = -0.1; disc.receiveShadow = true; stage.add(disc);
  const items = [];
  // ground plants on a soil bed (left), pots on the paving (right)
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.06, 48), toon('#5a4636', { lit: 0.02 }));
  bed.scale.set(1.35, 1, 0.55); bed.position.set(-1.55, 0.0, 0); bed.receiveShadow = true; stage.add(bed);
  GROUND_PLANTS.forEach((p, i) => {
    const m = p.make({ seed: 3 + i * 4 });
    m.position.set(-4.1 + i * 1.7, 0.03, 0); m.rotation.y = 0.4 * i;
    stage.add(m); items.push({ id: p.id, obj: m });
  });
  POTTED_PLANTS.forEach((p, i) => {
    const m = p.make({});
    m.position.set(2.6 + i * 1.15, 0, 0.1); m.rotation.y = -0.5 + i;
    stage.add(m); items.push({ id: p.id, obj: m });
  });
  scene.add(stage);
  return { stage, items };
}
