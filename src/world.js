import * as THREE from 'three';
import { reg, plight } from './core.js';
import { createBase, createGround } from './ground.js';
import { buildStore } from './store.js';
import { buildStreet } from './street.js';
import { buildBuildings } from './buildings.js';
import { createRain, createDrips } from './fx.js';
import { mergeStatic } from './merge.js';
import { buildBackdrop } from './backdrop.js';

const flick = (period, dur, depth, seed = 0) => (t) => {
  const k = (t + seed) % period;
  if (k < dur) return 1 - depth * (0.5 + 0.5 * Math.sign(Math.sin(k * 55 + seed)));
  return 1 - 0.025 * Math.sin(t * 21 + seed * 3);
};

export function buildWorld(scene, renderer, refl) {
  const world = new THREE.Group();
  scene.add(world);

  /* ---- global lighting ---- */
  scene.add(new THREE.HemisphereLight(0x7b8fd0, 0x20264a, 2.1));
  const moon = new THREE.DirectionalLight(0x93a8e8, 1.5);
  moon.position.set(-13, 21, 15);
  moon.castShadow = true;
  moon.shadow.mapSize.set(4096, 4096);
  const sc = moon.shadow.camera;
  sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 70;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.03;
  scene.add(moon);

  const ground = createGround(renderer, refl);
  world.add(ground.road, ground.plot);
  createBase(world);

  const drips = [];
  buildStore(world, drips);
  buildStreet(world, drips);
  buildBuildings(world, drips);
  buildBackdrop(world);

  mergeStatic(world);

  /* ---- rain + drips ---- */
  createRain(world, [
    [-5.6, 4.6, -4.6, 1.6, 3.55], // store
    [-5.6, 5.5, 1.5, 2.5, 3.0], // south awning
    [4.5, 5.5, -4.6, 2.5, 3.0], // east awning
    [-12.2, -8.3, -7.3, 3.6, 7.0], // izakaya
    [-12.2, -8.2, 3.5, 4.55, 3.2], // izakaya eave
    [-12.2, -8.2, 3.5, 4.3, 3.8], // izakaya balcony
  ]);
  createDrips(world, drips);

  /* ---- flicker / animated emitters ---- */
  const fSign = flick(11.3, 0.4, 0.5, 0.0);
  const fPylon = flick(8.2, 0.55, 0.65, 2.1);
  const fOpen = flick(5.9, 0.45, 0.85, 1.0);
  const fIza = flick(4.3, 0.7, 0.8, 0.6);
  const fVend = flick(6.4, 0.5, 0.6, 3.3);
  const fAlley = flick(3.4, 0.6, 0.7, 1.7);
  reg.updaters.push((t) => {
    const s = fSign(t);
    reg.signS.color.setRGB(1.05 * s, 1.03 * s, 0.98 * s);
    reg.signE.color.setRGB(1.05 * s, 1.03 * s, 0.98 * s);
    const p = fPylon(t);
    reg.pylonMat.color.setRGB(1.05 * p, 1.03 * p, 0.98 * p);
    if (reg.lights.pylon) reg.lights.pylon.intensity = reg.lights.pylon.userData.base * p;
    const o = fOpen(t);
    reg.neonOpen.color.setScalar(1.6 * o);
    if (reg.lights.neonOpen) reg.lights.neonOpen.intensity = reg.lights.neonOpen.userData.base * o;
    const n = fIza(t);
    reg.neonIza.color.setScalar(1.5 * n);
    if (reg.lights.neonPink) reg.lights.neonPink.intensity = reg.lights.neonPink.userData.base * n;
    const v = fVend(t);
    if (reg.vend && reg.vend[0]) reg.vend[0].tube.color.setScalar(2.6 * v);
    const a = fAlley(t);
    if (reg.lights.alleyEnd) reg.lights.alleyEnd.intensity = reg.lights.alleyEnd.userData.base * a;
    // faint fluorescent hum in the shop
    ['inA', 'inB', 'inC'].forEach((k, i) => { if (reg.lights[k]) reg.lights[k].intensity = reg.lights[k].userData.base * (1 + 0.012 * Math.sin(t * 60 + i)); });
  });
}
