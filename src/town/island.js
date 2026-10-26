import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, grp, halo, rng, patchToon, RAMP } from '../core.js';
import { OUTLINE, RAIL, groundY } from './layout.js';
import { makeWater, BED_PLAIN } from '../waterSystem.js';
import { makeShrub, makeTree } from '../tree.js';
import { guardRailW } from './roadside.js';
import { rockBatch, rockMat, rockGeo, footY } from '../rocks.js';
import { plantBatch } from '../plants/wild.js';

/* ====================================================================================================
   The island: the town (its outline, layout.js OUTLINE) becomes a small island in a round sea, the whole thing a
   display piece floating in the sky.

     IslandBase      a ring of land round the town's edge, one profile everywhere: a grass verge at the town's own
                     height, a slope (steep and rocky under the shrine terrace and here and there), a sand beach at the
                     waterline, an underwater shelf down to the sea floor; vertex-coloured (grass / rock / sand / wet
                     sand / sea floor) in the toon look, snow in winter like the rest
     EdgeLandscape   rocks on the slopes, the beach and the shallows; shrubs, a few trees, grass tufts and wild flowers
                     on the verge; guard rails where the roads reach the edge, buffer stops at the track ends, a small
                     wooden jetty with a rowboat off the south-west beach
     SurroundingSea  the town's shared water (waterSystem.js, 'sea' preset) on a round sea; its depth comes from the
                     same profile (a depth map), so the shallows, the colours and the foam follow the beach
     the tray        the sea's edge: a water cross-section band, then a rounded rock + earth underside tapering away
                     below (the piece floats; town/clouds.js drifts round it)
   ==================================================================================================== */

export const SEA = -1.3, FLOOR = -4.6;
export const ISLAND = { cx: -6, cz: -6, R: 82 }; // the round sea (the tray): the town stays the main thing

/* ---------------------------------------------------------------- the edge: samples round the outline */
const hsh = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hsh(i) * (1 - u) + hsh(i + 1) * u; };
const fbm = (x) => vn(x) * 0.65 + vn(x * 2.3 + 7.1) * 0.35;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const N = OUTLINE.length;
const area = OUTLINE.reduce((a, [x0, z0], i) => { const [x1, z1] = OUTLINE[(i + 1) % N]; return a + x0 * z1 - x1 * z0; }, 0) / 2;
const EDGES = OUTLINE.map(([ax, az], i) => {
  const [bx2, bz] = OUTLINE[(i + 1) % N], L = Math.hypot(bx2 - ax, bz - az), tx = (bx2 - ax) / L, tz = (bz - az) / L;
  const sg = area > 0 ? 1 : -1; // outward normal of a convex ring
  return { ax, az, bx: bx2, bz, L, tx, tz, nx: tz * sg, nz: -tx * sg };
});
// the s parameter (for the noise along the coast): edge lengths + the corner arcs at a nominal radius
const ARC_R = 4;
const turn = (i) => { const a = EDGES[i], b = EDGES[(i + 1) % N]; let d = Math.atan2(b.nz, b.nx) - Math.atan2(a.nz, a.nx); while (d < 0) d += Math.PI * 2; while (d > Math.PI * 2) d -= Math.PI * 2; return d > Math.PI ? d - Math.PI * 2 : d; };
const S0 = []; { let s = 0; EDGES.forEach((e, i) => { S0.push(s); s += e.L + Math.abs(turn(i)) * ARC_R; }); }

const S_TOT = S0[N - 1] + EDGES[N - 1].L + Math.abs(turn(N - 1)) * ARC_R;
const wrapS = (s) => ((s % S_TOT) + S_TOT) % S_TOT;
/** a smooth swell along the coast in 0..1: a few whole-number harmonics of the coast's length (so it closes on itself),
    no plateaus or ramps like the value noise - the outline's widths ease in and out */
const swell = (s, ks, seed) => {
  let v = 0, A = 0;
  ks.forEach((k, i) => { const a = 0.55 + 0.45 * hsh(seed + i * 7.3); v += a * Math.sin((Math.PI * 2 * k * s) / S_TOT + 6.283 * hsh(seed + i * 3.1)); A += a; });
  return Math.min(1, Math.max(0, 0.5 + 0.8 * v / A));
};
const W_A = [11, 15, 19], W_B = [8, 13, 23], W_SPIT = [3, 5, 7], W_C = [9, 14, 21];

/* the steep stretches along the coast (under the raised terrace, and here and there by noise), eased over ~±8 m of s:
   a hard on / off switch made the slope - and with it the beach line - jump in steps */
let CLIFF = null; const CL_D = 0.5;
function cliffAt(s) {
  if (!CLIFF) {
    const raw = coastSamples().map((sm) => [sm.s, Math.max(ss(0.8, 1.2, topAt(sm.x, sm.z, sm.nx, sm.nz)), ss(0.6, 0.8, swell(sm.s, W_C, 11.3)))]);
    const n = Math.ceil(S_TOT / CL_D), W = 8; CLIFF = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const s0 = i * CL_D; let sw = 0, sv = 0;
      raw.forEach(([sr, v]) => { let ds = Math.abs(sr - s0); ds = Math.min(ds, S_TOT - ds); if (ds < W) { const w = Math.cos((ds / W) * Math.PI) + 1; sw += w; sv += w * v; } });
      CLIFF[i] = sw ? ss(0.15, 0.75, sv / sw) : 0;
    }
  }
  const f = wrapS(s) / CL_D, i = Math.floor(f), t = f - i;
  return CLIFF[i] * (1 - t) + CLIFF[Math.min(i + 1, CLIFF.length - 1)] * t;
}

/** the land profile at coast parameter s, distance d out from the town's edge (whose height is hTop) */
function profile(s, d, hTop) {
  const a = swell(s, W_A, 1.7), b = swell(s, W_B, 11.3);
  const cliff = cliffAt(s);
  const spit = 6 * ss(0.45, 0.85, swell(s, W_SPIT, 3.7)); // now and then a broad beach, swelling and easing back
  const lip = 0.6, dS = (2.4 + 4.2 * a) * (1 - cliff) + (1.0 + 0.9 * a) * cliff;
  const dB = dS + 1.6 + 2.4 * b + spit + 1.2 * cliff, dU = dB + 5 + 3 * a; // a cliff keeps a strip of beach at its foot
  if (d <= lip) return { h: hTop - 0.03 * (d / lip), dS, dB, dU, cliff };
  if (d <= dS) { const t = (d - lip) / (dS - lip), e = t * t * (3 - 2 * t) * (1 - cliff) + (1 - Math.pow(1 - t, 2.2)) * cliff; return { h: hTop - 0.03 + (SEA + 0.28 - hTop + 0.03) * e, dS, dB, dU, cliff }; }
  if (d <= dB) return { h: SEA + 0.28 - 0.42 * (d - dS) / (dB - dS), dS, dB, dU, cliff };
  if (d <= dU) { const t = (d - dB) / (dU - dB); return { h: SEA - 0.14 + (FLOOR + 0.12 - SEA + 0.14) * t * t * (3 - 2 * t), dS, dB, dU, cliff }; }
  return { h: FLOOR + 0.12 - 0.12 * ss(dU, dU + 3, d), dS, dB, dU, cliff };
}
/** the town's height just inside its edge at a base point */
const topAt = (x, z, nx, nz) => groundY(x - nx * 0.08, z - nz * 0.08);

/** samples along the coast: base point, outward normal, s (edges every ~0.5 m, corners as arcs) */
function coastSamples() {
  const out = [];
  EDGES.forEach((e, i) => {
    const n = Math.max(2, Math.round(e.L / 0.5));
    for (let k = 0; k < n; k++) { const t = k / n; out.push({ x: e.ax + (e.bx - e.ax) * t, z: e.az + (e.bz - e.az) * t, nx: e.nx, nz: e.nz, s: S0[i] + e.L * t }); }
    const tr = turn(i), m = Math.max(1, Math.round(Math.abs(tr) / 0.17)), a0 = Math.atan2(e.nz, e.nx);
    for (let k = 0; k < m; k++) { const a = a0 + (tr * k) / m; out.push({ x: e.bx, z: e.bz, nx: Math.cos(a), nz: Math.sin(a), s: S0[i] + e.L + Math.abs(tr) * ARC_R * (k / m) }); }
  });
  return out;
}
/** for any point outside the town: (s, d, base point + normal) of its nearest coast point */
function coastOf(x, z) {
  let best = null;
  EDGES.forEach((e, i) => {
    const t = ((x - e.ax) * e.tx + (z - e.az) * e.tz);
    if (t >= 0 && t <= e.L) { const d = (x - e.ax) * e.nx + (z - e.az) * e.nz; if (d > 0 && (!best || d < best.d)) best = { d, s: S0[i] + t, bx: e.ax + e.tx * t, bz: e.az + e.tz * t, nx: e.nx, nz: e.nz }; }
    // the corner at the end of this edge
    const dx = x - e.bx, dz = z - e.bz, d = Math.hypot(dx, dz), nx = dx / (d || 1), nz = dz / (d || 1);
    const nxt = EDGES[(i + 1) % N];
    if (nx * e.tx + nz * e.tz >= 0 && nx * nxt.tx + nz * nxt.tz <= 0 && (!best || d < best.d)) {
      const a0 = Math.atan2(e.nz, e.nx); let da = Math.atan2(nz, nx) - a0; while (da < -Math.PI) da += Math.PI * 2; while (da > Math.PI) da -= Math.PI * 2;
      best = { d, s: S0[i] + e.L + Math.abs(da) * ARC_R, bx: e.bx, bz: e.bz, nx, nz };
    }
  });
  return best;
}

/* ---------------------------------------------------------------- IslandBase: the rim mesh */
const C = { grass: new THREE.Color('#6a9a52'), grass2: new THREE.Color('#5a8a4a'), verge: new THREE.Color('#78a85c'), rock: new THREE.Color('#8f877b'), rock2: new THREE.Color('#77726a'), sand: new THREE.Color('#e9dab4'), wet: new THREE.Color('#cdb98f'), floor: new THREE.Color('#d2c197'), deep: new THREE.Color('#a9a07e') };
function buildRim(g, samples) {
  const pos = [], col = [], idx = [];
  const rows = [];
  samples.forEach((sm) => {
    const hTop = topAt(sm.x, sm.z, sm.nx, sm.nz), p0 = profile(sm.s, 0, hTop);
    const ds = [0, 0.3, 0.6];
    for (let k = 1; k <= 7; k++) ds.push(0.6 + (p0.dS - 0.6) * (k / 7));
    for (let k = 1; k <= 3; k++) ds.push(p0.dS + (p0.dB - p0.dS) * (k / 3));
    for (let k = 1; k <= 4; k++) ds.push(p0.dB + (p0.dU - p0.dB) * (k / 4));
    ds.push(p0.dU + 3.5);
    const row = [];
    let prevH = null, prevD = 0;
    const gn = fbm(sm.s * 0.21 + 3.3);
    ds.forEach((d, k) => {
      const { h } = profile(sm.s, d, hTop);
      let x = sm.x + sm.nx * d, z = sm.z + sm.nz * d;
      { const dx = x - ISLAND.cx, dz = z - ISLAND.cz, r = Math.hypot(dx, dz), rm = ISLAND.R - 0.6; if (r > rm) { x = ISLAND.cx + (dx * rm) / r; z = ISLAND.cz + (dz * rm) / r; } } // stay inside the tray
      row.push(pos.length / 3); pos.push(x, h, z);
      const slope = prevH === null ? 0 : Math.abs(h - prevH) / Math.max(0.05, d - prevD);
      prevH = h; prevD = d;
      // colour: verge -> grass -> rock on the steep parts -> sand -> wet sand -> sea floor
      const c = new THREE.Color();
      if (h > SEA + 0.5) { c.copy(d < 0.65 ? C.verge : C.grass).lerp(C.grass2, gn * 0.6); c.lerp(C.rock, ss(0.9, 1.6, slope) * (0.85 + 0.15 * gn)); c.lerp(C.rock2, ss(1.6, 2.6, slope) * 0.6); c.lerp(C.sand, ss(SEA + 0.9, SEA + 0.5, h)); }
      else if (h > SEA - 0.05) c.copy(C.sand).lerp(C.wet, ss(SEA + 0.12, SEA - 0.05, h)).lerp(C.rock, ss(1.2, 2, slope) * 0.7);
      else c.copy(C.floor).lerp(C.deep, ss(SEA - 0.3, FLOOR, h));
      col.push(c.r, c.g, c.b);
    });
    rows.push(row);
  });
  for (let i = 0; i < rows.length; i++) {
    const A = rows[i], B = rows[(i + 1) % rows.length];
    for (let k = 0; k < A.length - 1; k++) idx.push(A[k], B[k], A[k + 1], B[k], B[k + 1], A[k + 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // keep faces pointing up (the winding depends on the outline's direction)
  const nrm = geo.attributes.normal; let up = 0; for (let i = 0; i < nrm.count; i++) up += nrm.getY(i);
  if (up < 0) { for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; geo.setIndex(idx); geo.computeVertexNormals(); }
  const m = patchToon(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP }), 0, true);
  // at night the rim dims with the town's ground (whose paint is darker after dark), so the beach does not glow
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    prev(sh);
    sh.uniforms.uDayK = reg.waterU.uDay;
    sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uDayK;').replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.5, 1.0, uDayK);');
  };
  m.customProgramCacheKey = () => 'islandRim';
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true; mesh.name = 'IslandRim';
  g.add(mesh);
  return mesh;
}

/* ---------------------------------------------------------------- the sea + the tray */
function buildSea(g) {
  // depth map from the same profile: depth = SEA - land height (0 inside the town: the shader drops it)
  const { cx, cz, R } = ISLAND, S = 256, size = 2 * R, x0 = cx - R, z0 = cz - R;
  const data = new Uint8Array(S * S * 4), pIn = (x, z) => EDGES.every((e) => (x - e.ax) * e.nx + (z - e.az) * e.nz <= 0);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = x0 + ((i + 0.5) / S) * size, z = z0 + ((j + 0.5) / S) * size, o = (j * S + i) * 4;
    let depth = -0.25;
    if (!pIn(x, z)) { const c = coastOf(x, z); depth = c ? SEA - profile(c.s, c.d, topAt(c.bx, c.bz, c.nx, c.nz)).h : 3.3; }
    data[o] = Math.round(255 * Math.min(1, Math.max(0, (depth + 0.25) / 4))); data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const mat = makeWater('sea', {
    bed: BED_PLAIN,
    depth: /* glsl */ `uniform sampler2D tDepth; uniform vec3 uBox;
      float wDepth(vec2 p){ vec2 uv = (p - uBox.xy) / uBox.z; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 3.3; return texture2D(tDepth, uv).r * 4.0 - 0.25; }`,
    uniforms: { tDepth: { value: tex }, uBox: { value: new THREE.Vector3(x0, z0, size) } },
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(R, 160).rotateX(-Math.PI / 2), mat);
  sea.position.set(cx, SEA, cz); sea.renderOrder = 2; sea.userData.noLine = true; sea.name = 'SurroundingSea';
  reg.noRefl.push(sea); g.add(sea);
  // the sea floor beyond the island's shelf
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2), toon('#cdbd92', { nosnow: true }));
  floor.position.set(cx, FLOOR - 0.03, cz); floor.receiveShadow = true; g.add(floor);
  // the tray's edge: the water's cross-section (clear at the top, deeper blue below, a pale lip), then the underside
  {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R, R, SEA - FLOOR, 160, 1, true), new THREE.ShaderMaterial({
      uniforms: { uDay: reg.waterU.uDay, uTime: reg.waterU.uTime },
      vertexShader: /* glsl */ `varying float vY; varying vec2 vA; void main(){ vY = uv.y; vA = vec2(atan(position.z, position.x), position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uDay, uTime; varying float vY; varying vec2 vA;
        void main(){
          float wave = 0.012 * sin(vA.x * 140.0 + uTime * 0.8) + 0.008 * sin(vA.x * 310.0 - uTime * 1.1);
          vec3 c = mix(vec3(0.16, 0.42, 0.62), vec3(0.42, 0.8, 0.84), smoothstep(0.0, 1.0, vY));
          c = mix(c, vec3(0.92, 0.97, 1.0), smoothstep(0.955, 0.985, vY + wave)); // the pale lip at the surface
          c *= mix(0.32, 1.0, uDay);
          gl_FragColor = vec4(c, mix(0.86, 0.72, vY));
        }`,
      transparent: true, depthWrite: false,
    }));
    band.position.set(cx, (SEA + FLOOR) / 2, cz); band.userData.noLine = true; band.renderOrder = 3; g.add(band);
    // the underside: sand -> earth strata -> rock, tapering away (a lathe, its radius gently irregular round the edge)
    const prof = [[1.0, 0], [0.995, -0.5], [0.975, -1.6], [0.93, -3.2], [0.85, -5.0], [0.74, -6.8], [0.6, -8.4], [0.42, -9.8], [0.22, -10.9], [0.0, -11.5]];
    const pts = prof.map(([r, y]) => new THREE.Vector2(r * R, FLOOR + y));
    const geo = new THREE.LatheGeometry(pts, 128);
    const P = geo.attributes.position, cols = [], Rn = rng(17);
    const bumps = Array.from({ length: 6 }, () => [Rn() * 6.28, 2 + ((Rn() * 7) | 0), 0.02 + Rn() * 0.03]);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), dy = FLOOR - y;
      const k = 1 + bumps.reduce((s, [ph, f, amp]) => s + amp * Math.sin(a * f + ph), 0) * ss(0.3, 2.5, dy);
      if (r > 1e-3) { P.setX(i, x * k); P.setZ(i, z * k); }
      const band2 = Math.sin(dy * 2.2 + Math.sin(a * 5) * 0.6);
      const c = dy < 0.55 ? new THREE.Color('#e3d2a6') : dy < 3.5 ? new THREE.Color('#9a7b5c').lerp(new THREE.Color('#b48d68'), 0.5 + 0.5 * band2) : new THREE.Color('#857c70').lerp(new THREE.Color('#6d665d'), ss(3.5, 9, dy) * 0.8 + 0.1 * band2);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const under = new THREE.Mesh(geo, patchToon(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP, side: THREE.DoubleSide }), 0.06, false));
    under.position.set(cx, 0, cz); under.userData.noRefl = true; g.add(under);
  }
  return sea;
}

/* ---------------------------------------------------------------- EdgeLandscape */
function buildEdge(g, samples) {
  const R = rng(909);
  const at = (sm, d) => { const hTop = topAt(sm.x, sm.z, sm.nx, sm.nz); return { x: sm.x + sm.nx * d, z: sm.z + sm.nz * d, ...profile(sm.s, d, hTop), hTop }; };
  const road = (sm) => topAt(sm.x, sm.z, sm.nx, sm.nz) < 0.08; // a road meets the edge here

  /* rocks (rocks.js): water-worn stones on the slope foot, the beach and the shallows; on the steep stretches a
     continuous wall of layered cliff rock bedded into the slope, with fallen blocks and debris at its foot */
  {
    // the ground anywhere on the rim (outside the town): the same profile as the rim mesh
    const edgeGround = (x, z) => { const c = coastOf(x, z); return c ? profile(c.s, c.d, topAt(c.bx, c.bz, c.nx, c.nz)).h : groundY(x, z); };
    const B = rockBatch(g, rockMat({ waterY: SEA, wet: 1.4, moss: 1, tint: '#f4f1ec' }), { name: 'EdgeRocks', instanced: true });
    const tints = ['#ffffff', '#f2eee6', '#e8e6e2', '#f6efe2'];
    let n = 0;
    samples.forEach((sm) => {
      if (n >= 420) return;
      const p0 = at(sm, 0), cliff = p0.cliff > 0.5;
      const k = cliff ? 3 : R() < 0.35 ? 1 : 0;
      for (let j = 0; j < k && n < 420; j++) {
        // (the same random draws as the first version of the island, so everything placed after the rocks stays put)
        const d = cliff && R() < 0.6 ? 0.8 + R() * (p0.dS - 0.6) : p0.dS - 0.4 + R() * (p0.dB - p0.dS + 2.2);
        const p = at(sm, d), sz = (cliff ? 0.35 : 0.18) + Math.pow(R(), 2) * (cliff ? 0.8 : 0.55);
        const t = R() * 0.6 - 0.3, x = p.x + sm.nz * t * 2, z = p.z - sm.nx * t * 2;
        const e0 = R(), e1 = R(), e2 = R(), s0 = R(), s1 = R(), s2 = R(), ci = R();
        n++;
        if (cliff && (j > 0 || e0 > 0.45)) continue; // under the cliff walls (below) only a few loose ones
        const under = p.h < SEA - 0.05, onSlope = d < p0.dS;
        const type = cliff ? (sz > 0.75 ? 'layered' : sz > 0.5 ? 'large' : 'medium') : under ? (sz > 0.3 ? 'shore' : 'pebble') : sz > 0.42 ? (s0 < 0.5 ? 'medium' : 'shore') : s0 < 0.55 ? 'shore' : 'pebble';
        const r = sz * (1.05 + s0 * 0.4);
        B.add(type, (e2 * 3) | 0, x, footY(edgeGround, x, z, r), z, r, { ry: e1 * 6.28, tilt: [(e0 - 0.5) * 0.3, (e2 - 0.5) * 0.3], sink: onSlope ? 0.3 : 0.2 + s1 * 0.15, sq: [1, 0.75 + s1 * 0.45, 0.85 + s2 * 0.3], tint: tints[(ci * 4) | 0] });
      }
    });
    // the cliff walls: overlapping slabs of layered rock along every steep stretch, each standing from below the beach
    // up to just under the grass lip, long side along the coast, leaning back into the slope
    const Rc = rng(919);
    let run = 0, next = 0;
    samples.forEach((sm, i) => {
      const p0 = at(sm, 0);
      if (p0.cliff < 0.5) { run = 0; return; }
      if (run++ < next) return;
      run = 0; next = 3 + ((Rc() * 2) | 0); // ~1.6 .. 2.2 m apart (samples every ~0.5 m): the slabs overlap
      const type = Rc() < 0.62 ? 'cliff' : 'layered', v = (Rc() * 3) | 0, geo = rockGeo(type, v);
      const yb = SEA + 0.05, H = Math.max(0.6, p0.hTop - 0.12 - yb) * (0.8 + Rc() * 0.25);
      const sy = 0.85 + Rc() * 0.3, r = Math.min(2.0, Math.max(0.6, H / (geo.userData.h * sy)));
      const d = Math.min(p0.dS * 0.55, 0.45 + r * 0.45), x = sm.x + sm.nx * d, z = sm.z + sm.nz * d;
      const tx = -sm.nz, tz = sm.nx, ry = Math.atan2(-tz, tx) + (Rc() - 0.5) * 0.35;
      B.add(type, v, x, yb, z, r, { ry, tilt: [(Rc() - 0.5) * 0.12, (Rc() - 0.5) * 0.12], sink: 0.04, sq: [1, sy * (H / (geo.userData.h * r * sy)), 0.9 + Rc() * 0.2], tint: tints[(Rc() * 4) | 0] });
      // a fallen block or two and some debris at its foot, on the beach
      const nf = Rc() < 0.5 ? 1 : 0;
      for (let f = 0; f < nf + 2; f++) {
        const df = p0.dS + 0.15 + Rc() * 0.9, tf = (Rc() - 0.5) * 1.6, fx = sm.x + sm.nx * df + tx * tf, fz = sm.z + sm.nz * df + tz * tf;
        const rf = f < nf ? 0.28 + Rc() * 0.25 : 0.07 + Rc() * 0.1;
        if (!B.clear(fx, fz, rf, 0.8)) continue;
        B.add(f < nf ? (Rc() < 0.5 ? 'large' : 'medium') : 'pebble', (Rc() * 3) | 0, fx, footY(edgeGround, fx, fz, rf), fz, rf, { ry: Rc() * 6.28, tilt: [(Rc() - 0.5) * 0.4, (Rc() - 0.5) * 0.4], sink: 0.2, tint: tints[(Rc() * 4) | 0] });
      }
    });
    B.flush();
  }
  /* grass, clover and wild flowers on the verge and the upper slope (plants/wild.js): thinning out down the slope,
     none on the cliff faces; the same random draws as the first version, so everything placed after stays put */
  {
    const B = plantBatch(g, { name: 'EdgePlants', lite: true });
    let nt = 0, nf = 0;
    samples.forEach((sm) => {
      if (road(sm)) return;
      for (let j = 0; j < 4; j++) {
        const p0 = at(sm, 0); const d = 0.15 + R() * Math.max(0.3, p0.dS * 0.75), p = at(sm, d);
        if (p.h < SEA + 0.6) continue;
        const t = (R() - 0.5) * 0.9, x = p.x + sm.nz * t, z = p.z - sm.nx * t;
        const onFace = p0.cliff > 0.5 && d > 0.6, slope = Math.min(1, d / Math.max(0.6, p0.dS)); // 0 on the verge -> 1 at the foot
        if (nt < 1600) {
          const s = 0.6 + R() * 0.9; R(); const ry = R(); R(); const ci = R(); nt++;
          if (!onFace && nt % 2 === 0 && ci > slope * 0.7) B.add(['shortGrass', 'tallGrass', 'shortGrass', 'clover'][(ci * 4) | 0], nt, x, p.h - 0.02, z, 0.8 + s * 0.4, { ry: ry * 6.28, lean: 0.1 });
        }
        if (R() < 0.45 && nf < 900) {
          const hh = R(), ci = R(); nf++;
          if (!onFace && slope < 0.45 && nf % 4 === 0) B.add(['daisy', 'clover', 'pinkWild', 'daisy', 'clover', 'forget'][(ci * 6) | 0], nf, x + 0.1, p.h - 0.01, z, 1.1 + hh * 0.4, { ry: ci * 9 });
        }
      }
    });
    B.flush();
  }
  /* shrubs + a few trees on the verge (never in front of a road end) */
  samples.forEach((sm, i) => {
    if (road(sm) || i % 9) return;
    const p0 = at(sm, 0); if (p0.hTop > 1.2) return; // the terrace's own wood stands above
    if (R() < 0.55) { const d = 0.9 + R() * Math.max(0.2, p0.dS * 0.5), p = at(sm, d); const sb = makeShrub({ seed: 500 + i, width: 0.9 + R() * 0.8, height: 0.6 + R() * 0.5, palette: R() < 0.5 ? 'deep' : 'grey' }); sb.position.set(p.x, p.h - 0.05, p.z); g.add(sb); }
    if (R() < 0.12) { const d = 1.3 + R() * Math.max(0.2, p0.dS * 0.4), p = at(sm, d); const t = makeTree({ seed: 700 + i, height: 3.2 + R() * 1.6, spread: 0.9, palette: R() < 0.3 ? 'maple' : 'deep', dens: 0.8, lean: (R() - 0.5) * 0.2 }); t.position.set(p.x, p.h - 0.05, p.z); t.rotation.y = R() * 6; g.add(t); }
  });
  /* guard rails across the road ends at the edge, a reflector post at each end */
  {
    let run = [];
    const flush = () => {
      if (run.length > 3) {
        const a = run[0], b = run[run.length - 1], o = 0.35;
        const y = Math.min(topAt(a.x, a.z, a.nx, a.nz), topAt(b.x, b.z, b.nx, b.nz));
        guardRailW(g, a.x + a.nx * o, a.z + a.nz * o, b.x + b.nx * o, b.z + b.nz * o, [-a.nx, -a.nz], y); // the beam faces the road
        [a, b].forEach((p) => { const px = p.x + p.nx * (o + 0.25), pz = p.z + p.nz * (o + 0.25); cy(g, toon('#f2f0ea'), px, y, pz, 0.035, 0.95, 8); bx(g, glow('#ff8a3c', 1.2, { cat: 'lamp', off: '#e06a2a' }), px - 0.03, px + 0.03, y + 0.78, y + 0.92, pz - 0.03, pz + 0.03, { cast: false }); }); // reflector posts just behind the ends
      }
      run = [];
    };
    samples.forEach((sm) => { if (road(sm) && sm.nx * sm.nx + sm.nz * sm.nz > 0.99 && (run.length === 0 || (Math.abs(run[run.length - 1].nx - sm.nx) < 0.01 && Math.abs(run[run.length - 1].nz - sm.nz) < 0.01))) run.push(sm); else flush(); });
    flush();
  }
  /* buffer stops (車止め) at the two ends of the track */
  [[RAIL.x0 + 0.7, RAIL.z, 0], [RAIL.xNorth, RAIL.zEnd + 0.6, Math.PI / 2]].forEach(([x, z, ry]) => {
    const b = grp(g, x, groundY(x, z), z, ry); const yel = toon('#f2c230'), blk = toon('#2f2e38');
    [-0.55, 0.55].forEach((o) => { cyl2(b, blk, [0, 0.3, o], [0.45, 0, o], 0.05, 6); cyl2(b, blk, [0, 0.3, o], [-0.1, 0, o], 0.05, 6); });
    bx(b, yel, -0.12, 0.06, 0.25, 0.75, -0.8, 0.8); for (let k = 0; k < 4; k++) bx(b, blk, -0.125, 0.065, 0.3, 0.7, -0.75 + k * 0.42, -0.6 + k * 0.42, { cast: false });
    bx(b, glow('#ff4a3a', 1.6, { cat: 'lamp', off: '#c03a2a' }), -0.14, -0.12, 0.6, 0.7, -0.05, 0.05, { cast: false });
  });
  /* a small wooden jetty off the south-west beach, a rowboat tied to it, a lamp at its end */
  {
    const base = samples.reduce((b, sm) => (Math.abs(sm.nz - 1) < 1e-3 && Math.abs(sm.x + 27) < Math.abs(b.x + 27) ? sm : b), samples[0]);
    const p0 = at(base, 0), d0 = p0.dS - 0.6, d1 = p0.dB + 9, y = SEA + 0.62, wood = toon('#9a7350', { lit: 0.05 }), woodD = toon('#6b4a32');
    const J = grp(g, base.x, 0, base.z, 0);
    for (let d = d0; d < d1; d += 0.42) bx(J, wood, -0.75, 0.75, y - 0.06, y, d, d + 0.36, { cast: true });
    for (let d = d0 + 0.6; d < d1; d += 1.6) [-0.72, 0.72].forEach((x) => cy(J, woodD, x, FLOOR + 0.1, d, 0.08, y - FLOOR - 0.12, 8));
    cyl2(J, woodD, [-0.72, y + 0.9, d0 + 0.6], [-0.72, y + 0.9, d1 - 0.2], 0.03, 6); for (let d = d0 + 0.6; d < d1; d += 1.6) cy(J, woodD, -0.72, y, d, 0.03, 0.9, 6);
    [0.72].forEach((x) => [d1 - 0.5, d1 - 3.2].forEach((d) => cy(J, toon('#3f3a36'), x, y, d, 0.07, 0.28, 10)));
    { const x = -0.72, d = d1 - 0.25; cy(J, woodD, x, y, d, 0.05, 2.4, 8); bx(J, glow('#ffe2b0', 2.2, { cat: 'lamp', off: '#d8cfbf' }), x - 0.1, x + 0.1, y + 2.4, y + 2.62, d - 0.1, d + 0.1, { cast: false }); halo(J, x, y + 2.5, d, '#ffd9a0', 2.0, 0.4, 'lamp'); }
    // the rowboat (moored alongside, bobbing a little)
    const boat = grp(J, 1.7, SEA + 0.08, d1 - 2.4, 0.08);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#f1ece2', { nocache: true, side: THREE.DoubleSide }));
    hull.scale.set(0.62, 0.42, 1.7); hull.position.y = 0.3; hull.castShadow = true; boat.add(hull);
    bx(boat, toon('#2f6f9a'), -0.6, 0.6, 0.26, 0.32, -1.6, 1.6, { cast: false }); bx(boat, wood, -0.55, 0.55, 0.12, 0.16, -0.2, 0.15); bx(boat, wood, -0.55, 0.55, 0.12, 0.16, 0.8, 1.1);
    reg.updaters.push((t) => { boat.position.y = SEA + 0.08 + Math.sin(t * 0.9) * 0.04; boat.rotation.z = Math.sin(t * 0.7) * 0.04; });
    cyl2(J, toon('#d8cfb8'), [0.72, y + 0.2, d1 - 2.4], [1.4, SEA + 0.5, d1 - 2.0], 0.012, 4); // the mooring line
  }
}

/* ---------------------------------------------------------------- build */
export function buildIsland(parent) {
  const root = grp(parent);
  root.name = 'TownIslandRoot';
  const base = grp(root); base.name = 'IslandBase';
  const edge = grp(root); edge.name = 'EdgeLandscape';
  const sea = grp(root); sea.name = 'SeaAndTray';
  const samples = coastSamples();
  buildRim(base, samples);
  buildSea(sea);
  buildEdge(edge, samples);
  reg.island = { root, SEA, ISLAND };
  return root;
}
