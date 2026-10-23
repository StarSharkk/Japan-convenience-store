import * as THREE from 'three';
import { reg, toon, rng } from '../core.js';
import { makeTree, makeShrub, FOLIAGE, SEASON_U } from '../tree.js';
import { BLOCKS, PLOTS, RAIL, lakeF, LAKE, groundY, blockAt, CROSSINGS, ZAK_PAD, VILLA_PAD, SOUTH_SHOPS_PAD, SAKURA_PLAZA, SW_ROW_PAD } from './layout.js';
import { IZA_AWAY } from '../site.js';

/* ====================================================================================================
   Town greenery. Five tree species + three shrubs are grown ONCE as templates with the same leaf-card
   foliage as the original grove; every placement is then an instance:
     · leaves of all copies of a species (per map chunk) live in ONE InstancedMesh, ordered leaf-major
       (leaf 0 of every tree, leaf 1 of every tree …) so the quality setting thins canopies evenly
     · bark is an InstancedMesh per species and chunk
   Placement is seeded, rule-based random: street trees along the kerbs, an avenue on Kita-dori,
   a shrine wood on the terrace, cherries round the lake, a few trees per block away from future lots.
   ==================================================================================================== */

const SPECIES = {
  broadA: { seed: 41, height: 6.0, spread: 1.15, palette: 'deep', dens: 0.78, leafScale: 0.98, lean: 0.05 },
  broadB: { seed: 57, height: 5.2, spread: 1.0, palette: 'teal', dens: 0.78, leafScale: 0.98, lean: 0.07 },
  tall: { seed: 63, height: 7.0, spread: 0.8, palette: 'grey', dens: 0.74, leafScale: 0.98, lean: 0.03 },
  cherry: { seed: 88, height: 4.9, spread: 1.35, palette: 'deep', dens: 0.82, leafScale: 0.95, lean: 0.1, blossom: 1 },
  ever: { seed: 95, height: 6.2, spread: 1.0, palette: 'deep', dens: 0.85, leafScale: 0.98, lean: 0.04, evergreen: true },
};
const SHRUBS = {
  s1: { seed: 3, width: 1.4, height: 0.85, palette: 'deep', dens: 0.85 },
  s2: { seed: 9, width: 1.1, height: 0.7, palette: 'teal', dens: 0.85 },
  s3: { seed: 14, width: 1.7, height: 1.0, palette: 'grey', dens: 0.85 },
};

function extract(root) {
  const t = { leaf: null, solids: [] };
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isInstancedMesh) {
      t.leaf = o;
      const k = FOLIAGE.indexOf(o);
      if (k >= 0) FOLIAGE.splice(k, 1); // the template itself is never drawn
    } else if (o.isMesh) {
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      t.solids.push({ geo, mat: o.material, cast: o.castShadow });
    }
  });
  return t;
}

export function buildGreenery(parent, lake) {
  const g = new THREE.Group();
  parent.add(g);
  const R = rng(777);

  /* ---------------------------------------------------------------- placement rules */
  const blocked = [];
  PLOTS.filter((p) => p.type !== 'public').forEach((p) => blocked.push({ x0: p.rect[0] - 0.6, x1: p.rect[1] + 0.6, z0: p.rect[2] - 0.6, z1: p.rect[3] + 0.6 }));
  const inBlocked = (x, z) => blocked.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const edgeDist = (x, z, poly) => {
    let d = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz;
      let t = ((x - ax) * vx + (z - az) * vz) / L; t = Math.max(0, Math.min(1, t));
      d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
    }
    return d;
  };
  const nearRail = (x, z) => {
    if (Math.abs(z - RAIL.z) < 4.2 && x < RAIL.xCurve + 1) return true;
    const cx = RAIL.xCurve, cz = RAIL.z - RAIL.R;
    if (x > cx - 1 && z < RAIL.z + 1 && z > cz - 1 && Math.abs(Math.hypot(x - cx, z - cz) - RAIL.R) < 4.2) return true;
    return Math.abs(x - RAIL.xNorth) < 4.2 && z < cz + 1;
  };
  const placed = [];
  const okSpot = (x, z, minGap, edge = 1.0) => {
    const b = blockAt(x, z);
    if (!b || edgeDist(x, z, b.poly) < edge || inBlocked(x, z) || nearRail(x, z)) return false;
    if (b.id === 'lakePark' && lakeF(x, z) < 1.33) return false; // not in the water or on the lake walk
    if (b.id === 'terrace' && x > -3.5 && x < -0.5 && z > -24.5) return false; // keep the stair landing open
    return !placed.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(minGap, p.gap));
  };
  const trees = [];
  const add = (x, z, sp, gap = 3.2, scale = 0.86 + R() * 0.28) => {
    if (!okSpot(x, z, gap)) return false;
    placed.push({ x, z, gap });
    trees.push({ x, y: groundY(x, z), z, sp, s: scale, r: R() * Math.PI * 2 });
    return true;
  };
  const pick = (list) => list[(R() * list.length) | 0];

  // street trees: kerbside rows, alternating species (never perfectly regular)
  const row = (x0, z0, x1, z1, step, sps) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / step);
    for (let i = 0; i <= n; i++) {
      const t = (i + (R() - 0.5) * 0.25) / Math.max(1, n);
      if (R() < 0.12) continue; // the odd missing tree
      add(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, pick(sps), step * 0.7);
    }
  };
  row(13.1, -42, 13.1, -24.5, 7.5, ['broadB', 'broadA']);
  row(6.4, 14.5, 6.4, 30.5, 7.5, ['broadA', 'broadB']);
  row(13.1, 15.5, 13.1, 30.5, 7.5, ['broadB', 'tall']);
  // Block C: Kita-dori avenue towards the lake (both sides, staggered), cherries mixed in
  row(-46, -16.2, -19.5, -16.2, 6.5, ['broadA', 'cherry', 'broadB']);
  row(-43, -10.9, -34, -10.9, 6.5, ['cherry', 'broadA']);
  row(-27.5, -10.9, -18.5, -10.9, 6.5, ['broadB', 'cherry']);
  // Kaigan-dori: a few trees on the south kerb, in front of future cafés
  row(-46, 13.0, -18, 13.0, 9, ['broadA', 'tall', 'broadB']);
  row(14.5, 5.6, 28.5, 5.6, 8, ['broadB']);

  // shrine wood on the terrace (mostly evergreen, a pair of cherries near the stairs)
  const T = BLOCKS.find((b) => b.id === 'terrace');
  add(-5.6, -25.2, 'cherry', 3.5); add(0.8, -25.4, 'cherry', 3.5);
  for (let i = 0, n = 0; i < 400 && n < 16; i++) {
    const x = -15 + R() * 22, z = -43 + R() * 19;
    if (!T || !blockAt(x, z) || blockAt(x, z).id !== 'terrace') continue;
    if (add(x, z, R() < 0.6 ? 'ever' : R() < 0.6 ? 'tall' : 'broadA', 3.9, 0.9 + R() * 0.3)) n++;
  }
  // lake: cherries and broadleaves on the banks, outside the walk
  for (let i = 0, n = 0; i < 600 && n < 12; i++) {
    const a = R() * Math.PI * 2, t = 1.38 + R() * 0.55;
    const rr = 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1);
    const x = LAKE.cx + Math.cos(a) * LAKE.rx * t * rr, z = LAKE.cz + Math.sin(a) * LAKE.rz * t * rr;
    if (add(x, z, R() < 0.45 ? 'cherry' : pick(['broadA', 'broadB', 'tall']), 4.6)) n++;
  }
  // a few trees inside each other block, away from the future lots and the sidewalks
  BLOCKS.forEach((b) => {
    if (['terrace', 'lakePark'].includes(b.id) || b.id.startsWith('corr')) return;
    const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    const want = Math.min(4, Math.round(area / 90));
    for (let i = 0, n = 0; i < 200 && n < want; i++) {
      const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + R() * (Math.max(...zs) - Math.min(...zs));
      if (blockAt(x, z) !== b) continue;
      if (!okSpot(x, z, 6, 1.8)) continue;
      if (add(x, z, pick(['broadA', 'broadB', 'ever', 'cherry', 'tall']), 6)) n++;
    }
  });
  // station plaza + the cherry plaza in the south block
  add(26.5, -38, 'broadA', 4); add(26.8, -32.5, 'cherry', 4); add(16, -40.5, 'tall', 4);
  [[-8.5, 25], [-3, 27.5], [2.5, 25]].forEach(([x, z]) => add(x, z, 'cherry', 4)); // the small public plaza

  /* ---------------------------------------------------------------- shrubs */
  const shrubs = [];
  const addShrub = (x, z, sp, s = 0.8 + R() * 0.45) => {
    const b = blockAt(x, z);
    if (!b || edgeDist(x, z, b.poly) < 0.55 || nearRail(x, z) || inBlocked(x, z)) return;
    if (b.id === 'lakePark' && lakeF(x, z) < 1.29) return;
    if (x > ZAK_PAD[0] - 0.2 && x < ZAK_PAD[1] + 0.1 && z > ZAK_PAD[2] - 0.3 && z < ZAK_PAD[3] + 0.1) return; // the corner store's lot (town/zakkaya.js)
    if (IZA_AWAY && x > IZA_AWAY.rect[0] - 1.7 && x < IZA_AWAY.rect[1] + 1.0 && z > IZA_AWAY.rect[2] - 0.8 && z < 6.6) return; // the izakaya's lot
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2)) return;
    shrubs.push({ x, y: groundY(x, z), z, sp, s, r: R() * Math.PI * 2 });
  };
  // hedges along the future lots (broken runs, varied sizes)
  PLOTS.filter((p) => ['house', 'cafe'].includes(p.type)).forEach((p) => {
    const [x0, x1, z0, z1] = p.rect;
    const side = (R() * 4) | 0;
    const run = 2 + ((R() * 3) | 0);
    for (let k = 0; k < run; k++) {
      const t = R();
      const pos = [[x0 + (x1 - x0) * t, z0 - 0.9], [x1 + 0.9, z0 + (z1 - z0) * t], [x0 + (x1 - x0) * t, z1 + 0.9], [x0 - 0.9, z0 + (z1 - z0) * t]][side];
      addShrub(pos[0], pos[1], pick(['s1', 's2', 's3']));
    }
  });
  // lake shore clumps, terrace edge, verges, around the trees
  for (let i = 0; i < 40; i++) { const a = R() * 6.283, t = 1.3 + R() * 0.25; const x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t; addShrub(x, z, pick(['s1', 's3'])); }
  trees.forEach((t) => { if (R() < 0.55) { const a = R() * 6.283, d = 1.3 + R() * 0.8; addShrub(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, pick(['s1', 's2', 's3']), 0.6 + R() * 0.4); } });
  for (let x = -46; x < 34; x += 2.6 + R() * 2.4) { if (!CROSSINGS.some((c) => Math.abs(x - c.x) < 3)) addShrub(x, -15.9 - R() * 0.4, 'hyd', 0.7 + R() * 0.35); }

  /* ---------------------------------------------------------------- instancing */
  const CH = 30; // chunk size for frustum culling
  const chunkOf = (x, z) => `${Math.floor(x / CH)},${Math.floor(z / CH)}`;
  const m4 = new THREE.Matrix4(), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let leafTotal = 0;
  const lods = [], lakeHide = (reg.reflLakeHide = reg.reflLakeHide || []), lineHide = (reg.lineHide = reg.lineHide || []);
  // distance LOD: far chunks draw fewer leaves (leaf-major order thins every tree evenly)
  reg.updaters.push(() => {
    const cam = reg.camera;
    if (!cam) return;
    lods.forEach((im) => {
      const d = cam.position.distanceTo(im.userData.center);
      const lod = d < 30 ? 1 : d < 55 ? 0.62 : d < 90 ? 0.44 : 0.32;
      if (im.userData.lod === lod) return;
      im.userData.lod = lod;
      im.count = Math.max(1, Math.floor(im.userData.total * FOLIAGE.density * lod));
      const far = lod < 0.5, k = lineHide.indexOf(im);
      if (far && k < 0) lineHide.push(im); else if (!far && k >= 0) lineHide.splice(k, 1);
    });
  });
  const instance = (tpl, list) => {
    const chunks = new Map();
    list.forEach((t) => { const k = chunkOf(t.x, t.z); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(t); });
    chunks.forEach((items) => {
      const L = tpl.leaf, nl = L.count, nt = items.length;
      const im = new THREE.InstancedMesh(L.geometry, L.material, nl * nt);
      const tm = items.map((t) => mt.clone().compose(v.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.r), sc.set(t.s, t.s, t.s)));
      for (let j = 0; j < nl; j++) {
        L.getMatrixAt(j, m4);
        L.getColorAt(j, col);
        for (let i = 0; i < nt; i++) {
          const k = j * nt + i;
          im.setMatrixAt(k, mt.copy(tm[i]).multiply(m4));
          im.setColorAt(k, col);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = false;
      im.computeBoundingSphere();
      im.userData.total = nl * nt;
      im.userData.center = im.boundingSphere.center.clone();
      FOLIAGE.push(im);
      g.add(im);
      lods.push(im);
      leafTotal += nl * nt;
      const farFromLake = Math.hypot(im.userData.center.x - LAKE.cx, im.userData.center.z - LAKE.cz) > 24;
      if (farFromLake) lakeHide.push(im);
      tpl.solids.forEach((s) => {
        const sm = new THREE.InstancedMesh(s.geo, s.mat, nt);
        tm.forEach((m, i) => sm.setMatrixAt(i, m));
        sm.castShadow = s.cast; sm.receiveShadow = true;
        sm.computeBoundingSphere();
        g.add(sm);
        if (farFromLake) lakeHide.push(sm);
      });
    });
  };
  const bySp = (list) => list.reduce((a, t) => ((a[t.sp] = a[t.sp] || []).push(t), a), {});
  // the large residence's walled lot (town/villa.js) has its own garden: drop what fell inside the wall
  // ... and so do the south block's two shops (town/cafe.js, town/bookstore.js) on their paved pad
  const inVilla = (p) => (p.x > VILLA_PAD[0] - 0.3 && p.x < VILLA_PAD[1] + 0.3 && p.z > VILLA_PAD[2] - 0.3 && p.z < VILLA_PAD[3] + 0.3)
    || (p.x > SOUTH_SHOPS_PAD[0] && p.x < SOUTH_SHOPS_PAD[1] - 0.1 && p.z > SOUTH_SHOPS_PAD[2] && p.z < SOUTH_SHOPS_PAD[3])
    || (p.x > SAKURA_PLAZA[0] && p.x < SAKURA_PLAZA[1] && p.z > SAKURA_PLAZA[2] - 0.2 && p.z < SAKURA_PLAZA[3] + 0.5) // town/plaza.js plants its own
    || (p.x > SW_ROW_PAD[0] && p.x < SW_ROW_PAD[1] && p.z > SW_ROW_PAD[2] - 0.2 && p.z < SW_ROW_PAD[3] + 3.8); // the street-house row + its front pavement (town/streetRow.js)
  trees.splice(0, trees.length, ...trees.filter((p) => !inVilla(p)));
  shrubs.splice(0, shrubs.length, ...shrubs.filter((p) => !inVilla(p)));
  Object.entries(bySp(trees)).forEach(([sp, list]) => instance(extract(makeTree(SPECIES[sp])), list));
  const shrubT = {};
  Object.entries(bySp(shrubs)).forEach(([sp, list]) => {
    const def = sp === 'hyd' ? { ...SHRUBS.s2, seed: 21, width: 1.2, height: 0.9 } : SHRUBS[sp];
    shrubT[sp] = extract(makeShrub(def));
    instance(shrubT[sp], list);
  });

  /* hydrangea flower heads (spring / early summer), on the corridor shrubs */
  {
    const hyd = shrubs.filter((s) => s.sp === 'hyd');
    const N = hyd.length * 7;
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 1), toon('#ffffff', { e: '#101830', ei: 0.3 }), N);
    const pal = ['#7f9ae6', '#9a84d8', '#6fb0e8', '#c48ad6', '#e6a6c8'].map((c) => new THREE.Color(c));
    let n = 0;
    hyd.forEach((s) => {
      for (let k = 0; k < 7; k++) {
        const a = R() * 6.283, d = R() * 0.5 * s.s;
        m4.compose(v.set(s.x + Math.cos(a) * d, s.y + (0.55 + R() * 0.3) * s.s, s.z + Math.sin(a) * d * 0.6), q.identity(), sc.setScalar(0.8 + R() * 0.5));
        fl.setMatrixAt(n, m4);
        fl.setColorAt(n, pal[(R() * pal.length) | 0]);
        n++;
      }
    });
    fl.castShadow = false;
    fl.computeBoundingSphere();
    g.add(fl);
    reg.updaters.push(() => { const w = SEASON_U.W.value; fl.visible = w.x * 0.7 + w.y > 0.45; });
  }

  /* ---------------------------------------------------------------- grass tufts (season-coloured) */
  {
    const blade = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3, r = 0.06;
      const bx0 = Math.cos(a) * r, bz0 = Math.sin(a) * r, tx = Math.cos(a) * 0.16, tz = Math.sin(a) * 0.16;
      blade.push(bx0 - 0.03 * Math.sin(a), 0, bz0 + 0.03 * Math.cos(a), bx0 + 0.03 * Math.sin(a), 0, bz0 - 0.03 * Math.cos(a), tx, 0.26 + 0.08 * (k % 2), tz);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3));
    tg.computeVertexNormals();
    const tm = toon('#3c6a44', { side: THREE.DoubleSide, nocache: true });
    const N = 2600;
    const tufts = new THREE.InstancedMesh(tg, tm, N);
    let n = 0;
    for (let i = 0; i < N * 6 && n < N; i++) {
      const x = -48 + R() * 84, z = -44 + R() * 76;
      const b = blockAt(x, z);
      if (!b || !['verge', 'park', 'forest', 'lots'].includes(b.surf)) continue;
      if (b.id === 'lakePark' && (lakeF(x, z) < 1.06 || Math.abs(lakeF(x, z) - 1.2) < 0.06)) continue;
      if (Math.abs(z - RAIL.z) < 2.2 && x < RAIL.xCurve) continue;
      if (b.surf === 'lots' && !inBlocked(x, z) && R() < 0.6) continue; // lots: mostly along their edges
      const s = 0.7 + R() * 0.9;
      // the paved lots (corner store, izakaya) grow none: the tuft is sunk out of sight, so the rest of the town's
      // tufts keep exactly their places
      const paved = (x > ZAK_PAD[0] && x < ZAK_PAD[1] && z > ZAK_PAD[2] && z < ZAK_PAD[3]) || (x > SW_ROW_PAD[0] && x < SW_ROW_PAD[1] && z > SW_ROW_PAD[2] && z < SW_ROW_PAD[3] + 3.8) || (IZA_AWAY && x > IZA_AWAY.rect[0] - 1.4 && x < IZA_AWAY.rect[1] + 0.9 && z > IZA_AWAY.rect[2] - 0.6 && z < 6.6);
      m4.compose(v.set(x, paved ? -60 : groundY(x, z) - 0.01, z), q.setFromAxisAngle(up, R() * 6.28), sc.set(s, s * (0.7 + R() * 0.6), s));
      tufts.setMatrixAt(n, m4);
      tufts.setColorAt(n, col.setHSL(0.27 + R() * 0.08, 0.35 + R() * 0.2, 0.55 + R() * 0.35));
      n++;
    }
    tufts.count = n;
    tufts.castShadow = false;
    tufts.receiveShadow = true;
    tufts.computeBoundingSphere();
    g.add(tufts);
    // season colour: spring fresh, summer deep, autumn straw, winter dry
    const C = [new THREE.Color('#4f8a4c'), new THREE.Color('#3c6a44'), new THREE.Color('#8a7a3e'), new THREE.Color('#6f6650')];
    reg.updaters.push(() => {
      const w = SEASON_U.W.value;
      tm.color.setRGB(C[0].r * w.x + C[1].r * w.y + C[2].r * w.z + C[3].r * w.w, C[0].g * w.x + C[1].g * w.y + C[2].g * w.z + C[3].g * w.w, C[0].b * w.x + C[1].b * w.y + C[2].b * w.z + C[3].b * w.w);
    });
  }

  reg.townGreenery = { trees, shrubs, leafTotal };
  return { group: g, trees, shrubs, leafTotal };
}
