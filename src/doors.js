import * as THREE from 'three';
import { reg } from './core.js';

/* ====================================================================================================
   Shop doors you can walk through (florist, bakery): leaves on hinges that swing in when the camera comes
   close to the entrance or is inside, and close again as soon as it moves away. A click on the doors (or the
   doorway) opens / shuts them by hand until the camera has gone well away.

   leaves   [{ pv, s }]  pivot groups at the hinges; the leaf turns pv.rotation.y = s * angle * open
   entrance THREE.Vector3 in front of the doorway (camera distance is measured to it, in 3D)
   inside   (p, pad) => bool, the shop's floor area
   hit      an unrendered mesh in the doorway (layer 5) so an open door can be clicked shut
   ==================================================================================================== */
export function swingDoors({ leaves, entrance, inside, hit, angle = 1.4, near = 9, look = 16, far = 24 }) {
  const door = { open: 0, manual: null };
  reg.updaters.push((t, dt) => {
    const cam = reg.camera, ctl = reg.controls;
    if (!cam) return;
    const d = cam.position.distanceTo(entrance);
    // open: the camera at the door, inside, or looking into the shop from close by
    let want = d < near || inside(cam.position, 0.2) || (ctl && inside(ctl.target, 0.4) && d < look) ? 1 : 0;
    if (door.manual !== null) { want = door.manual; if (d > far) door.manual = null; }
    door.open += (want - door.open) * (1 - Math.exp(-dt * (want > door.open ? 3.4 : 2.6)));
    const e = door.open * door.open * (3 - 2 * door.open);
    leaves.forEach(({ pv, s }) => (pv.rotation.y = s * e * angle));
  });
  (reg.clickables ||= []).push({ objects: [hit, ...leaves.map((l) => l.pv)], onClick: () => { door.manual = door.open > 0.5 ? 0 : 1; } });
  return door;
}

/** the unrendered click panel for a doorway (layer 5: no render pass draws it, the click raycaster sees it) */
export function doorHit(parent, w, h, x, y, z, ry = 0) {
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  hit.position.set(x, y, z); hit.rotation.y = ry; hit.layers.set(5); hit.userData.keep = true;
  parent.add(hit);
  return hit;
}
