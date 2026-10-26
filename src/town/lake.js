import * as THREE from 'three';
import { reg, toon, cy, cyl2, bx, grp, rng } from '../core.js';
import { LAKE, lakeF, lakeParkH, WATER_Y } from './layout.js';
import { makeWater, WATER_U } from '../waterSystem.js';

/* ====================================================================================================
   The lake (Block D). The basin is part of the lake-park terrain (layout.lakeParkH); this file adds the
   water surface, the lakeside walk, a short timber railing, a small jetty, shore rocks and reeds.
   The water is the town's shared water (waterSystem.js, 'lake' preset): blue-green by depth with the bed showing in
   the shallows, layered moving ripples, the planar reflection of the sky and the banks, sun / moon glints, rain rings.
   ==================================================================================================== */

const GLSL_LAKE = /* glsl */ `
  float lakeF(vec2 p){
    vec2 d = (p - vec2(${LAKE.cx.toFixed(2)}, ${LAKE.cz.toFixed(2)})) / vec2(${LAKE.rx.toFixed(2)}, ${LAKE.rz.toFixed(2)});
    float a = atan(d.y, d.x);
    float rr = 1.0 + 0.12 * sin(3.0 * a + 1.3) + 0.07 * sin(5.0 * a + 0.4) + 0.04 * sin(8.0 * a + 2.1);
    return length(d) / rr;
  }
  float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  float bedH(vec2 p){ float f = lakeF(p); return 0.15 - 0.5 * (1.0 - ss(0.95, 1.45, f)) - 0.6 * (1.0 - ss(0.55, 1.02, f)); }
`;

export function buildLake(parent, refl) {
  const g = grp(parent);
  const R = rng(5150);

  /* ---------------------------------------------------------------- water (waterSystem.js, the 'lake' preset) */
  WATER_U.tRefl.value = refl.rt.texture; WATER_U.uTexMat.value = refl.texMat;
  reg.lakeReflY = WATER_Y; // post.js: the mirror plane's height while only the lake mirrors
  const mat = makeWater('lake', { planar: true, depth: `${GLSL_LAKE}\n  float wDepth(vec2 p){ return ${WATER_Y.toFixed(2)} - bedH(p); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(27, 19, 1, 1).rotateX(-Math.PI / 2), mat);
  water.position.set(-32.2, WATER_Y, -33.3);
  water.userData.noLine = true;
  water.renderOrder = 2;
  reg.noRefl.push(water);
  g.add(water);
  // the lake park's ground in the mirror pass: a plain stand-in for the ground material (which reads the mirror
  // target); brightened by day like the ground shader's daylight lift
  {
    let w = null;
    reg.updaters.push(() => {
      if (!w) {
        const mesh = reg.ground.find((o) => o.userData.block === 'lakePark');
        if (!mesh || !mesh.material.map) return;
        w = { mesh, mat: new THREE.MeshLambertMaterial({ map: mesh.material.map }) };
        (reg.reflSwap ||= []).push(w);
      }
      w.mat.color.setScalar(1 + 1.6 * WATER_U.uDay.value);
    });
  }
  const U = WATER_U;

  /* ---------------------------------------------------------------- lakeside walk (ribbon on the bank) */
  const PATH_F = 1.2;
  const ringPts = [];
  const rr = (a) => 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1);
  const NP = 160;
  for (let i = 0; i < NP; i++) {
    const a = (i / NP) * Math.PI * 2;
    const t = PATH_F * rr(a);
    let x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
    x = Math.min(x, -19.7); z = Math.max(-43.0, Math.min(z, -23.8));
    ringPts.push([x, z, a]);
  }
  const pos = [], nor = [], idx = [];
  const HW = 0.62;
  for (let i = 0; i < NP; i++) {
    const [x, z] = ringPts[i], [xn, zn] = ringPts[(i + 1) % NP], [xp, zp] = ringPts[(i + NP - 1) % NP];
    let tx = xn - xp, tz = zn - zp; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const nx = -tz, nz = tx;
    [[x + nx * HW, z + nz * HW], [x - nx * HW, z - nz * HW]].forEach(([px, pz]) => { pos.push(px, lakeParkH(px, pz) + 0.035, pz); nor.push(0, 1, 0); });
    const a = i * 2, b = ((i + 1) % NP) * 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  pg.setIndex(idx);
  // faces point up whatever the ring direction
  pg.computeVertexNormals();
  if (pg.attributes.normal.getY(0) < 0) { const I = pg.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } pg.computeVertexNormals(); }
  const path = new THREE.Mesh(pg, toon('#6e6a6c'));
  path.receiveShadow = true;
  g.add(path);
  // path edging stones (little kerb on the water side)
  const edgeM = toon('#8a8790');
  for (let i = 0; i < NP; i += 2) {
    const [x, z] = ringPts[i], [xn, zn] = ringPts[(i + 2) % NP];
    const mx = (x + xn) / 2, mz = (z + zn) / 2;
    const dx = mx - LAKE.cx, dz = mz - LAKE.cz, l = Math.hypot(dx, dz);
    const ex = mx - (dx / l) * (HW + 0.06), ez = mz - (dz / l) * (HW + 0.06);
    const e = cyl2(g, edgeM, [x - (dx / l) * (HW + 0.06), lakeParkH(ex, ez) + 0.06, z - (dz / l) * (HW + 0.06)], [xn - (dx / l) * (HW + 0.06), lakeParkH(ex, ez) + 0.06, zn - (dz / l) * (HW + 0.06)], 0.06, 5);
    e.castShadow = false;
  }

  /* timber railing on the steeper south and east banks */
  const wood = toon('#6a4a34');
  const rail = (a0, a1) => {
    let prev = null;
    for (let a = a0; a <= a1 + 1e-6; a += 0.075) {
      const t = (PATH_F - 0.065) * rr(a);
      let x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
      x = Math.min(x, -20.3);
      const y = lakeParkH(x, z);
      cy(g, wood, x, y, z, 0.045, 0.9, 6);
      if (prev) { cyl2(g, wood, [prev[0], prev[1] + 0.85, prev[2]], [x, y + 0.85, z], 0.035, 5); cyl2(g, wood, [prev[0], prev[1] + 0.48, prev[2]], [x, y + 0.48, z], 0.03, 5); }
      prev = [x, y, z];
    }
  };
  rail(0.55, 1.45); rail(-0.55, 0.05);

  /* small jetty on the south shore */
  {
    const a = 1.75, t0 = (PATH_F - 0.1) * rr(a);
    const sx = LAKE.cx + Math.cos(a) * LAKE.rx * t0, sz = LAKE.cz + Math.sin(a) * LAKE.rz * t0;
    const ang = Math.atan2(LAKE.cz - sz, LAKE.cx - sx);
    const J = grp(g, sx, WATER_Y + 0.28, sz, -ang + Math.PI / 2);
    const deck = toon('#7a5a40');
    for (let i = 0; i < 11; i++) bx(J, deck, -0.7, 0.7, 0, 0.06, i * 0.3, i * 0.3 + 0.26, { cast: true });
    [[-0.65, 0.3], [0.65, 0.3], [-0.65, 3.0], [0.65, 3.0]].forEach(([x, z]) => cy(J, wood, x, -0.55, z, 0.06, 0.62, 6));
    [[-0.68], [0.68]].forEach(([x]) => { cy(J, wood, x, 0.06, 3.15, 0.04, 0.7, 6); });
    cyl2(J, wood, [-0.68, 0.72, 3.15], [0.68, 0.72, 3.15], 0.035, 5);
  }

  /* ---------------------------------------------------------------- shore rocks + reeds (instanced) */
  {
    let rg = new THREE.IcosahedronGeometry(1, 1);
    const p = rg.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.78 + 0.35 * Math.abs(Math.sin(p.getX(i) * 4.1 + p.getY(i) * 2.3 + p.getZ(i) * 3.7)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
    rg.computeVertexNormals();
    const N = 46;
    const rocks = new THREE.InstancedMesh(rg, toon('#5d6170'), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < 400 && n < N; i++) {
      const a = R() * Math.PI * 2, t = (0.97 + R() * 0.12) * rr(a);
      const x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
      if (x > -20.5 || Math.abs(lakeF(x, z) - 1.02) > 0.07) continue;
      // clusters: a big stone usually has a smaller one next to it
      const k = R() < 0.3 ? 0.45 + R() * 0.35 : 0.16 + R() * 0.22;
      e.set(R() * 0.4, R() * 6.28, R() * 0.4); q.setFromEuler(e);
      m4.compose(v.set(x, lakeParkH(x, z) - 0.04, z), q, s.set(k * (0.9 + R() * 0.5), k, k * (0.8 + R() * 0.4)));
      rocks.setMatrixAt(n++, m4);
    }
    rocks.count = n;
    rocks.castShadow = true; rocks.receiveShadow = true;
    g.add(rocks);

    const blade = new THREE.ConeGeometry(0.035, 1, 3, 1);
    blade.translate(0, 0.5, 0);
    const reeds = new THREE.InstancedMesh(blade, toon('#5d7a48', { e: '#0c1a0c', ei: 0.4 }), 420);
    n = 0;
    for (let c = 0; c < 14; c++) {
      const a0 = R() * Math.PI * 2;
      for (let j = 0; j < 30; j++) {
        const a = a0 + (R() - 0.5) * 0.18, t = (0.93 + R() * 0.07) * rr(a);
        const x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
        if (x > -20.6) continue;
        e.set((R() - 0.5) * 0.35, R() * 6.28, (R() - 0.5) * 0.35); q.setFromEuler(e);
        const hgt = 0.5 + R() * 0.7;
        m4.compose(v.set(x, Math.max(WATER_Y - 0.05, lakeParkH(x, z)), z), q, s.set(1, hgt, 1));
        reeds.setMatrixAt(n++, m4);
        if (n >= 420) break;
      }
    }
    reeds.count = n;
    reeds.castShadow = false;
    g.add(reeds);
  }

  return { group: g, water, ringPts, U };
}
