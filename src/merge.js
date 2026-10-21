import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Static batching: every plain mesh that shares a material (and render flags) is baked into one geometry.
 * Anything flagged userData.keep (or living under such a node) stays untouched so it can be animated.
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    let p = o.parent;
    while (p) {
      if (p.userData && p.userData.keep) return;
      p = p.parent;
    }
    const mat = o.material;
    if (!mat || Array.isArray(mat) || mat.isShaderMaterial) return;
    if (!o.geometry.attributes.normal || !o.geometry.attributes.uv) return;
    const key = [mat.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.userData.noLine ? 1 : 0, o.geometry.index ? 'i' : 'n', o.geometry.attributes.color ? 'c' : ''].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let before = 0, after = 0;
  groups.forEach((list) => {
    before += list.length;
    if (list.length < 2) { after += list.length; return; }
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      // keep only shared attributes
      // vertex colours survive when the whole batch has them (plant leaf tints); everything else is trimmed
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) { after += list.length; return; }
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.userData.noLine = first.userData.noLine;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    list.forEach((m) => m.parent && m.parent.remove(m));
    after += 1;
  });
  console.log(`static merge: ${before} meshes -> ${after}`);
}
