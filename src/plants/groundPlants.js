import * as THREE from 'three';
import { rng, toon } from '../core.js';
import { bladeGeo, taperTube, placeLeaf, tint, mergeInto, leafTex, leafMat, moundGeo, triCount, stemMat } from './kit.js';

/* ====================================================================================================
   Ground plants (no pot) - candidate set after reference 1, picked for a Japanese street:
     taro      クワズイモ (Alocasia odora): big arrow / heart leaves on long petioles, nodding outward
     fern      シダ: a crown of arching pinnate fronds
     hosta     ギボウシ: low rosette of cupped, cream-edged leaves with curved parallel veins
     aspidistra ハラン: tall, glossy strap leaves arching out of the ground
   Every function returns a THREE.Group with its origin at ground level (y = 0), base sunk a little
   into a small soil mound. opts.seed varies the plant, opts.scale sizes it.
   ==================================================================================================== */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const upOf = (dir) => UP.clone().addScaledVector(dir, -UP.dot(dir)).normalize();
const soilMat = () => toon('#4a3a2c', { lit: 0.04 });

/* ---------------------------------------------------------------- クワズイモ */
export function makeTaro({ seed = 3, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const leaves = [], stems = [];
  const tex = leafTex('taro', { kind: 'net', base: '#4d8639', edge: '#3a6a2e', vein: '#86b566', center: '#5a9443', veins: 7, glossy: 0.6 });
  const blade = (L) => bladeGeo({
    L, W: L * 0.86, segL: 12, segW: 5, lobe: 0.34, sinus: 0.15,
    width: (v) => Math.pow(1 - Math.pow(v, 1.7), 0.75) * (1 - 0.1 * v),
    lobeW: (k) => Math.sqrt(Math.max(0, 1 - k * k)) * (1 - 0.32 * k),
    droop: 0.24, cup: 0.06, keel: 0.035, wave: 0.02, waveF: 6, curlBack: 0.05,
  });
  const n = 6 + ((R() * 2) | 0);
  const ga = 2.39996;
  for (let i = 0; i < n; i++) {
    const age = i / (n - 1); // 0 = oldest (outer, low), 1 = youngest (inner, upright)
    const a = i * ga + R() * 0.5;
    const h = V(Math.cos(a), 0, Math.sin(a));
    const Lp = (0.55 + 0.5 * age + R() * 0.12) * scale;
    const reach = (0.42 - 0.26 * age + R() * 0.06) * scale;
    const base = V(h.x * 0.035, -0.03, h.z * 0.035).multiplyScalar(scale);
    const top = h.clone().multiplyScalar(reach).setY(Lp);
    const mid = h.clone().multiplyScalar(reach * 0.35).setY(Lp * 0.62);
    const curve = new THREE.CatmullRomCurve3([base, mid, top]);
    stems.push(tint(taperTube(curve, 0.03 * scale, 0.015 * scale, 12, 6), 0.9 + R() * 0.15));
    // blade nods outward / down from the top of the petiole
    const beta = (0.42 - 0.28 * age + R() * 0.14); // radians below horizontal (the droop adds the rest)
    const dir = h.clone().multiplyScalar(Math.cos(beta)).addScaledVector(UP, -Math.sin(beta)).normalize();
    const L = (0.42 + 0.22 * (1 - Math.abs(age - 0.5) * 2) + R() * 0.1) * scale;
    leaves.push(placeLeaf(blade(L), top, dir, upOf(dir), 0.86 + R() * 0.2));
  }
  // short stout trunk
  stems.push(tint(taperTube(new THREE.CatmullRomCurve3([V(0, -0.04, 0), V(0.01, 0.06, 0), V(0, 0.14 * scale, 0.01)]), 0.06 * scale, 0.035 * scale, 4, 8), 0.7));
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(stems, stemMat('#7a9a52')));
  const m = new THREE.Mesh(moundGeo(0.32 * scale, 0.05 * scale, seed), soilMat()); m.receiveShadow = true; g.add(m);
  g.userData = { name: 'クワズイモ (taro)', tris: triCount(g) };
  return g;
}

/* ---------------------------------------------------------------- シダ */
export function makeFern({ seed = 5, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const leaves = [], stems = [];
  const tex = leafTex('fern', { kind: 'plain', base: '#5f9440', edge: '#456f2f', vein: '#a8cc80', center: '#6aa048' });
  const pinna = (l) => bladeGeo({ L: l, W: l * 0.36, segL: 3, segW: 1, width: (v) => Math.pow(1 - v, 0.8) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, v * 1.6 + 0.2))), droop: 0.12, cup: 0.1, keel: 0 });
  const n = 15 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.35;
    const h = V(Math.cos(a), 0, Math.sin(a));
    const Lf = (0.5 + R() * 0.3) * scale;
    const up = 1.0 + R() * 0.45; // how upright this frond starts
    const pts = [V(0, 0.0, 0), h.clone().multiplyScalar(Lf * 0.16).setY(Lf * 0.42 * up), h.clone().multiplyScalar(Lf * 0.55).setY(Lf * 0.5 * up), h.clone().multiplyScalar(Lf * 0.92).setY(Lf * 0.2 * up)];
    const c = new THREE.CatmullRomCurve3(pts);
    stems.push(tint(taperTube(c, 0.008 * scale, 0.003 * scale, 12, 4), 0.85 + R() * 0.2));
    const side = new THREE.Vector3().crossVectors(UP, h).normalize(); // frond plane = (h, up); pinnae go sideways
    const shade = 0.85 + R() * 0.25;
    const np = 24;
    for (let k = 0; k < np; k++) {
      const t = 0.14 + (k / (np - 1)) * 0.84;
      const p = c.getPointAt(t), T = c.getTangentAt(t);
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.1) / 0.92)), 0.65);
      const l = (0.16 * Lf / scale) * (0.3 + 0.7 * env) * scale;
      const N = new THREE.Vector3().crossVectors(side, T).normalize(); // frond face normal (roughly up)
      if (N.y < 0) N.negate();
      [-1, 1].forEach((s) => {
        const d = side.clone().multiplyScalar(s * 0.92).addScaledVector(T, 0.42).addScaledVector(N, -0.1).normalize();
        leaves.push(placeLeaf(pinna(l * (0.9 + R() * 0.2)), p, d, N, shade * (0.95 + (1 - t) * 0.05)));
      });
    }
    // fiddlehead-ish rolled tip
    leaves.push(placeLeaf(pinna(0.05 * scale), c.getPointAt(1), c.getTangentAt(1), UP, shade));
  }
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(stems, stemMat('#6b7f3e')));
  const m = new THREE.Mesh(moundGeo(0.22 * scale, 0.04 * scale, seed + 1), soilMat()); m.receiveShadow = true; g.add(m);
  g.userData = { name: 'シダ (fern)', tris: triCount(g) };
  return g;
}

/* ---------------------------------------------------------------- ギボウシ */
export function makeHosta({ seed = 7, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const leaves = [], stems = [];
  const tex = leafTex('hosta', { kind: 'parallel', base: '#5b8f48', edge: '#4c7c3c', vein: '#86b36a', center: '#6aa052', veins: 6, margin: '#e3dca6' });
  const n = 17 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const age = R();
    const a = i * 2.39996 + R() * 0.4;
    const h = V(Math.cos(a), 0, Math.sin(a));
    const Lp = (0.09 + 0.15 * age) * scale;
    const elev = 0.85 + 0.45 * age; // inner leaves more upright
    const top = h.clone().multiplyScalar(Lp * Math.cos(elev) + 0.04 * scale).setY(Lp * Math.sin(elev) + 0.03 * scale);
    stems.push(tint(taperTube(new THREE.CatmullRomCurve3([V(h.x * 0.01, -0.02, h.z * 0.01), h.clone().multiplyScalar(0.02 * scale).setY(top.y * 0.6), top]), 0.011 * scale, 0.008 * scale, 6, 5), 0.95));
    const beta = -0.15 + 0.5 * (1 - age) + R() * 0.15; // younger leaves point up, older lie down
    const dir = h.clone().multiplyScalar(Math.cos(beta)).addScaledVector(UP, -Math.sin(beta)).normalize();
    const L = (0.22 + 0.12 * age + R() * 0.05) * scale;
    const blade = bladeGeo({ L, W: L * 0.74, segL: 9, segW: 4, lobe: 0.1, sinus: 0.02, width: (v) => Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * v)), 0.75) * Math.pow(1 - v, 0.25), droop: 0.14, cup: 0.14, keel: 0.05, wave: 0.03, waveF: 5, twist: (R() - 0.5) * 0.3 });
    leaves.push(placeLeaf(blade, top, dir, upOf(dir), 0.88 + R() * 0.2));
  }
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(stems, stemMat('#8aa864')));
  const m = new THREE.Mesh(moundGeo(0.26 * scale, 0.035 * scale, seed + 2), soilMat()); m.receiveShadow = true; g.add(m);
  g.userData = { name: 'ギボウシ (hosta)', tris: triCount(g) };
  return g;
}

/* ---------------------------------------------------------------- ハラン */
export function makeAspidistra({ seed = 11, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const leaves = [], stems = [];
  const tex = leafTex('aspidistra', { kind: 'parallel', base: '#3f7236', edge: '#30592b', vein: '#6e9c5c', center: '#4a823e', veins: 7, glossy: 1 });
  const n = 16 + ((R() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + R() * 0.6;
    const h = V(Math.cos(a), 0, Math.sin(a));
    const lean = 0.06 + R() * 0.22;
    const Lp = (0.16 + R() * 0.14) * scale;
    const base = V(h.x * 0.03 * scale, -0.02, h.z * 0.03 * scale);
    const top = base.clone().add(h.clone().multiplyScalar(Math.sin(lean) * Lp)).setY(Math.cos(lean) * Lp);
    stems.push(tint(taperTube(new THREE.CatmullRomCurve3([base, base.clone().lerp(top, 0.5).setY(top.y * 0.5), top]), 0.008 * scale, 0.006 * scale, 5, 4), 0.85));
    const gam = 0.12 + lean * 0.9 + R() * 0.16; // angle from vertical of the blade's first part
    const dir = UP.clone().multiplyScalar(Math.cos(gam)).addScaledVector(h, Math.sin(gam)).normalize();
    const L = (0.44 + R() * 0.22) * scale;
    const face = new THREE.Vector3().crossVectors(new THREE.Vector3().crossVectors(dir, h), dir).normalize().negate();
    const blade = bladeGeo({ L, W: L * 0.27, segL: 12, segW: 3, width: (v) => Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * v)), 0.8) * (1 - 0.15 * v), droop: 0.3 + R() * 0.18, cup: 0.12, keel: 0.08, twist: (R() - 0.5) * 0.6 });
    leaves.push(placeLeaf(blade, top, dir, face.y > 0 ? face : face.negate(), 0.85 + R() * 0.25));
  }
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(stems, stemMat('#4f6b3a')));
  const m = new THREE.Mesh(moundGeo(0.2 * scale, 0.03 * scale, seed + 3), soilMat()); m.receiveShadow = true; g.add(m);
  g.userData = { name: 'ハラン (aspidistra)', tris: triCount(g) };
  return g;
}

export const GROUND_PLANTS = [
  { id: 'taro', make: makeTaro },
  { id: 'fern', make: makeFern },
  { id: 'hosta', make: makeHosta },
  { id: 'aspidistra', make: makeAspidistra },
];
