import * as THREE from 'three';
import { reg, plight, setCat, ENVK, lk } from './core.js';
import { createBase, createGround } from './ground.js';
import { buildStore } from './store.js';
import { buildStreet } from './street.js';
import { buildBuildings } from './buildings.js';
import { createDrips } from './fx.js';
import { createParticles } from './particles.js';
import { mergeStatic } from './merge.js';
import { buildBackdrop } from './backdrop.js';
import { buildTown } from './town/index.js';
import { buildPlantings } from './plants/placement.js';
import { SITE } from './site.js';

const flick = (period, dur, depth, seed = 0) => (t) => {
  const k = (t + seed) % period;
  if (k < dur) return 1 - depth * (0.5 + 0.5 * Math.sign(Math.sin(k * 55 + seed)));
  return 1 - 0.025 * Math.sin(t * 21 + seed * 3);
};

/** Builds the whole static scene ONCE. Returns the handles the environment system drives. */
export function buildWorld(scene, renderer, refl) {
  const world = new THREE.Group();
  scene.add(world);

  /* ---- global lighting (colours / intensities are owned by env.js from here on) ---- */
  const hemi = new THREE.HemisphereLight(0x7b8fd0, 0x20264a, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0x93a8e8, 1.5);
  sun.position.set(-13, 21, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  // the shadow box follows the camera target across the town (env.js re-centres it and re-renders the map)
  sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const ground = createGround(renderer, refl);
  world.add(ground.road, ground.plot);
  scene.add(sun.target);

  const drips = [];
  // emissive categories: what the environment dims by day / switches by store status
  setCat('shop');
  buildStore(world, drips);
  setCat('street');
  buildStreet(world, drips);
  setCat('iza');
  buildBuildings(world, drips);
  setCat('street');
  buildBackdrop(world);
  setCat('shop');
  // the town around the original board: roads, terrain, lake, railway, furniture, greenery (+ the new plinth)
  buildTown(world, renderer, refl);
  // potted plants at the izakaya entrance + the planting bed across the main road
  buildPlantings(world);

  mergeStatic(world);

  /* ---- weather particles + eave drips ---- */
  const particles = createParticles(world, [
    [-5.6, 4.6, -4.6, 1.6, 3.55], // store
    [-5.6, 5.5, 1.5, 2.5, 3.0], // south awning
    [4.5, 5.5, -4.6, 2.5, 3.0], // east awning
    ...(SITE.izakaya ? [
      [-12.2, -8.3, -7.3, 4.4, 7.0], // izakaya
      [-13.0, -8.2, 4.3, 5.3, 3.4], // izakaya front eave
      [-13.0, -12.0, -7.4, 4.3, 3.4], // izakaya street-side eave
      [-8.5, -7.95, -5.05, -3.65, 2.55], // izakaya staff-door hood
    ] : [
      [-12.35, -7.8, -6.75, 1.98, 4.4], // bakery (with its canopy)
      [-29.3, -24.5, -7.3, 5.3, 7.0], // the izakaya in the west block (with its front eave)
      [-23.3, -18.3, -1.2, 4.7, 6.4], // the corner store (with its awning)
      [15.15, 29.05, 14.65, 21.65, 3.9], // the villa's back wing under its shed roofs + eaves (town/villaHouse.js)
      [22.55, 29.05, 20.4, 24.2, 3.3], // its dining wing + the deck canopy
    ]),
    [14.45, 21.95, -6.95, 2.75, 5.6], // florist greenhouse roof
    [-11.7, -4.3, 13.9, 20.85, 4.35], // the café (town/cafe.js) with its front hood
    [-2.1, 4.5, 14.5, 19.7, 3.7], // the bookstore (town/bookstore.js)
    [1.6, 4.55, 19.6, 20.75, 3.45], // the bookstore's awning
    [-41.7, -19.5, 13.6, 20.5, 7.6], // the street-house row (town/streetRow.js) with its awnings + eave on the south fronts
  ]);
  createDrips(world, drips);

  /* ---- flicker / animated emitters (multiplied by the environment factors) ---- */
  const fSign = flick(11.3, 0.4, 0.5, 0.0);
  const fPylon = flick(8.2, 0.55, 0.65, 2.1);
  const fOpen = flick(5.9, 0.45, 0.85, 1.0);
  const fIza = flick(4.3, 0.7, 0.8, 0.6);
  const fVend = flick(6.4, 0.5, 0.6, 3.3);
  const fAlley = flick(3.4, 0.6, 0.7, 1.7);
  reg.updaters.push((t) => {
    const sg = ENVK.sign;
    const s = fSign(t) * sg;
    reg.signS.color.setRGB(1.05 * s, 1.03 * s, 0.98 * s);
    reg.signE.color.setRGB(1.05 * s, 1.03 * s, 0.98 * s);
    const p = fPylon(t) * (0.35 + 0.65 * sg);
    reg.pylonMat.color.setRGB(1.05 * p, 1.03 * p, 0.98 * p);
    const o = fOpen(t) * ENVK.open;
    reg.neonOpen.color.setScalar(1.6 * o);
    const n = fIza(t) * ENVK.iza;
    if (reg.neonIza) reg.neonIza.color.setScalar(1.5 * n);
    if (reg.lights.neonPink) reg.lights.neonPink.intensity = reg.lights.neonPink.userData.base * fIza(t) * lk(reg.lights.neonPink);
    const v = fVend(t) * ENVK.street;
    if (reg.vend && reg.vend[0]) reg.vend[0].tube.color.setScalar(2.6 * v);
    const a = fAlley(t);
    if (reg.lights.alleyEnd) reg.lights.alleyEnd.intensity = reg.lights.alleyEnd.userData.base * a;
    // faint fluorescent hum in the shop
    ['inA', 'inB', 'inC'].forEach((k, i) => {
      const l = reg.lights[k];
      if (l) l.intensity = l.userData.base * lk(l) * (1 + 0.012 * Math.sin(t * 60 + i));
    });
  });

  return { world, hemi, sun, particles };
}
