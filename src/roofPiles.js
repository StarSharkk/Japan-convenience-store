import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reg, rng, RAMP } from './core.js';
import { KIND, flakeMaterial, padMaterial } from './groundPiles.js';

/* ====================================================================================================
   Roof accumulation: cherry petals / autumn leaves piled on the roofs, a real snow layer on roofs,
   eaves, awnings, fascia tops and street lamps.

   Every roof is a planar "surface" with its own (u, v) frame: flat trays (store roof, awnings, eaves) and
   the two slopes of the izakaya's gable. Things collect where they would on a real roof: deep drifts along
   parapets / the wall an eave leans on, around the feet of the rooftop AC units, in the eave band of a tile
   slope; plus big open patches and a dense layer of loose flakes over the whole surface.
   Snow is a blanket mesh following the surface: rounded shoulders on open edges, a slab skirt so the edge
   reads as thickness, deeper against walls, a little cornice hanging over the eaves of the slopes.
   ==================================================================================================== */

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** flat tray: u = +x from x0, v = +z from z0; walls: { u0: west, u1: east, v0: north, v1: south } */
function flat(id, x0, x1, z0, z1, y, o = {}) {
  const obst = (o.obst || []).map(([a, b, c, d]) => [a - x0, b - x0, c - z0, d - z0]);
  return { id, o: v3(x0, y, z0), U: v3(1, 0, 0), V: v3(0, 0, 1), lu: x1 - x0, lv: z1 - z0, walls: o.walls || {}, obst, w: o.w || {}, snow: o.snow || 0, ov: o.ov ?? 0.035 };
}
/** gable slope: eave line along z at (ex, ey), rising to the ridge at (rx, ry); z from z0 to z1 */
function slope(id, ex, ey, rx, ry, z0, z1, o = {}) {
  const V = v3(rx - ex, ry - ey, 0);
  const lv = V.length(); V.normalize();
  const west = rx > ex;
  // keep N = V x U pointing up and out
  const U = west ? v3(0, 0, -1) : v3(0, 0, 1);
  const org = v3(ex, ey, west ? z1 : z0);
  return { id, o: org, U, V, lu: z1 - z0, lv, walls: {}, obst: [], w: o.w || {}, snow: o.snow || 0, ov: o.ov ?? 0.06, eave: true };
}

// store: ST x -5.5..4.5, z -4.5..1.5, roof top 3.68, parapet N/W to 3.92, fascia S/E to 4.34, awnings top 2.98
// izakaya: X -12..-8.5, Z -7.2..4.3, gable eaves at 6.6 (x -12.35 / -8.0), ridge x -10.175 at 7.9, eaves 3.145
const SURFACES = [
  flat('storeRoof', -5.54, 4.5, -4.54, 1.5, 3.68, {
    walls: { u0: 1, u1: 1, v0: 1, v1: 1 },
    obst: [[-4.15, -2.25, -3.55, -2.45], [-1.15, 0.35, -3.7, -2.7], [2.02, 2.38, -3.48, -3.12], [3.36, 3.44, -3.64, -3.56]],
    w: { petal: 1, leaf: 1 }, snow: 0.17,
  }),
  flat('ac1', -4.15, -2.25, -3.55, -2.45, 4.38, { w: { petal: 0.35, leaf: 0.35 }, snow: 0.11 }),
  flat('ac2', -1.15, 0.35, -3.7, -2.7, 4.38, { w: { petal: 0.35, leaf: 0.35 }, snow: 0.11 }),
  flat('parapetN', -5.62, 4.62, -4.62, -4.54, 3.92, { snow: 0.07, ov: 0.025 }),
  flat('parapetW', -5.62, -5.54, -4.54, 1.62, 3.92, { snow: 0.07, ov: 0.025 }),
  flat('fasciaS', -5.6, 4.64, 1.5, 1.7, 4.34, { snow: 0.09, ov: 0.03 }),
  flat('fasciaE', 4.5, 4.7, -4.6, 1.5, 4.34, { snow: 0.09, ov: 0.03 }),
  flat('awningS', -5.6, 5.47, 1.7, 2.49, 2.98, { walls: { v0: 1 }, w: { petal: 0.9, leaf: 0.9 }, snow: 0.13 }),
  flat('awningE', 4.7, 5.47, -4.6, 1.7, 2.98, { walls: { u0: 1 }, w: { petal: 0.9, leaf: 0.9 }, snow: 0.13 }),
  slope('izaRoofW', -12.35, 6.6, -10.175, 7.9, -7.6, 5.05, { w: { petal: 0.85, leaf: 0.85 }, snow: 0.19, ov: 0.12 }),
  slope('izaRoofE', -8.0, 6.6, -10.175, 7.9, -7.6, 5.05, { w: { petal: 0.85, leaf: 0.85 }, snow: 0.19, ov: 0.12 }),
  flat('izaRidge', -10.3, -10.05, -7.65, 5.1, 8.02, { snow: 0.08, ov: 0.03 }),
];
// izakaya lean-to eaves (front + street side, meeting on a hip at the south-west corner); see izakaya.js pent()
SURFACES.push(
  pentS('izaFrontEave', [-12, 4.3], [-8.5, 4.3], [0, 1], 1.0, 3.42, 0.36, { hipAtA: true, ovB: 0.3, w: { petal: 0.85, leaf: 0.85 }, snow: 0.13, ov: 0.08 }),
  pentS('izaSideEave', [-12, 4.3], [-12, -7.2], [-1, 0], 1.0, 3.42, 0.36, { hipAtA: true, ovB: 0.2, w: { petal: 0.7, leaf: 0.7 }, snow: 0.13, ov: 0.08 }),
);
/** a lean-to eave: wall line a -> b (x/z) at height y, sloping out along n by D, dropping `drop`;
    hipAtA: the a end is cut on the 45° hip it shares with the perpendicular eave */
function pentS(id, a, b, n, D, y, drop, o = {}) {
  const t = v3(b[0] - a[0], 0, b[1] - a[1]); const len = t.length(); t.normalize();
  const N2 = v3(n[0], 0, n[1]);
  const V = v3(-n[0] * D, drop, -n[1] * D); const lv = V.length(); V.normalize();
  // U along the outer edge, chosen so that N = V x U points up
  let U = t.clone();
  if (new THREE.Vector3().crossVectors(V, U).y < 0) U.negate();
  const fromA = U.dot(t) > 0;
  const ext0 = o.hipAtA ? D : 0, ext1 = o.ovB || 0;
  // u = 0 at the outer edge's start (the end U points away from)
  const startXZ = fromA ? [a[0] - t.x * ext0, a[1] - t.z * ext0] : [b[0] + t.x * ext1, b[1] + t.z * ext1];
  const lu = len + ext0 + ext1;
  const org = v3(startXZ[0] + N2.x * D, y - drop, startXZ[1] + N2.z * D);
  // a roof half that starts at a ridge (o.ridge) has no wall at the top: nothing banks up there
  const S = { id, o: org, U, V, lu, lv, walls: o.ridge ? {} : { v1: 1 }, obst: [], w: o.w || {}, snow: o.snow || 0, ov: o.ov ?? 0.06, eave: true };
  if (o.hipAtA) {
    // keep only the part on this side of the hip: distance past the corner along the wall <= distance from the wall
    S.clip = (u, v) => {
      const along = fromA ? u - ext0 : lu - ext0 - u; // measured from a, positive towards b
      return -along <= D * (1 - v / lv) + 1e-3;
    };
  }
  return S;
}
SURFACES.forEach((S) => {
  S.N = new THREE.Vector3().crossVectors(S.V, S.U).normalize();
  S.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(S.U, S.N, S.V));
});
const P = (S, u, v, h = 0, out = new THREE.Vector3()) => out.copy(S.o).addScaledVector(S.U, u).addScaledVector(S.V, v).addScaledVector(S.N, h);
const inObst = (S, u, v, m = 0) => S.obst.some(([a, b, c, d]) => u > a - m && u < b + m && v > c - m && v < d + m);
const inside = (S, u, v, m = 0.02) => u > m && u < S.lu - m && v > m && v < S.lv - m && !inObst(S, u, v, 0.02) && (!S.clip || S.clip(u, v));

/* ---------------------------------------------------------------- small value noise (JS side) */
const hsh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
  const a = hsh(i, j), b = hsh(i + 1, j), c = hsh(i, j + 1), d = hsh(i + 1, j + 1);
  const sx = f * f * (3 - 2 * f), sy = g * g * (3 - 2 * g);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y) => vnoise(x, y) * 0.62 + vnoise(x * 2.3 + 5.1, y * 2.3 - 3.7) * 0.38;

/* ---------------------------------------------------------------- snow material (blanket + lamp caps) */
const SNOW_GLSL = /* glsl */ `
  float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }`;
function snowMaterial(u, cap) {
  // a toon material like the rest of the scene (lit by sun / lamps, receives shadows), grown from aC by uAmt
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(0.9, 0.93, 1.0), gradientMap: RAMP });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAmt = u.uAmt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTh; attribute vec3 aC; uniform float uAmt; varying float vVis; varying vec3 vW;')
      .replace('#include <begin_vertex>', `float vis = smoothstep(aTh, aTh + 0.18, uAmt); vVis = vis;
        vec3 transformed = aC + (position - aC) * ${cap ? 'vec3(mix(0.75, 1.0, vis), vis, mix(0.75, 1.0, vis))' : 'vis'};
        vW = transformed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vVis; varying vec3 vW;\n' + SNOW_GLSL)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // thin patches break up first while the layer grows / thaws
        if (vVis < 0.03 + 0.1 * vn(vW.xz * 5.0)) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.93 + 0.07 * vn(vW.xz * 1.3 + vW.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.08, 1.1, 1.14), step(0.985, h2(floor(vW.xz * 70.0))) * 0.6);`);
  };
  m.customProgramCacheKey = () => 'roofSnow' + (cap ? 'C' : 'B');
  return m;
}

/** the same displacement for the ink pass's normal / depth target, so lines follow the snow (and hide what it covers) */
function snowLineMat(u, cap) {
  return new THREE.ShaderMaterial({
    uniforms: { uAmt: u.uAmt },
    vertexShader: /* glsl */ `
      attribute float aTh; attribute vec3 aC; uniform float uAmt; varying vec3 vN; varying float vZ; varying float vVis; varying vec3 vW;
      void main(){
        float vis = smoothstep(aTh, aTh + 0.18, uAmt); vVis = vis;
        vec3 p = aC + (position - aC) * ${cap ? 'vec3(mix(0.75, 1.0, vis), vis, mix(0.75, 1.0, vis))' : 'vis'};
        vW = p;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vN = normalize(mat3(viewMatrix) * normal); vZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying float vZ; varying float vVis; varying vec3 vW;
      ${SNOW_GLSL}
      void main(){
        if (vVis < 0.03 + 0.1 * vn(vW.xz * 5.0)) discard;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n * 0.5 + 0.5, vZ);
      }`,
    side: THREE.DoubleSide,
  });
}

/* ---------------------------------------------------------------- snow caps for street furniture
   Placed while building (lamp heads, arms, pole tops); baked into one mesh when the roof piles are created. */
const CAP_TAG = new THREE.MeshBasicMaterial({ visible: false });
function tagCap(m, parent) {
  m.userData.snowCap = true; m.userData.keep = true; m.userData.noLine = true;
  m.castShadow = false; m.receiveShadow = false;
  parent.add(m);
  return m;
}
/** a soft snow slab sitting on the box top x0..x1 / z0..z1 at height y (parent's local frame) */
export function snowCapBox(parent, x0, x1, y, z0, z1, t = 0.07) {
  const w = x1 - x0, d = z1 - z0;
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, t * 1.5, d, 2, Math.min(t * 0.7, w * 0.3, d * 0.3)), CAP_TAG);
  m.position.set((x0 + x1) / 2, y + t * 0.25, (z0 + z1) / 2);
  m.userData.capBase = y;
  return tagCap(m, parent);
}
/** a snow line along the top of a round bar a -> b of radius r */
export function snowCapLine(parent, a, b, r) {
  const A = v3(...a), B = v3(...b);
  const d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.75, len, 3, 6), CAP_TAG);
  m.scale.set(1, 1, 0.7);
  m.position.copy(A).add(B).multiplyScalar(0.5).add(v3(0, r * 0.75, 0));
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
  m.userData.capBase = Math.min(a[1], b[1]) + r * 0.3;
  return tagCap(m, parent);
}
/** a small dome on a pole top */
export function snowCapDome(parent, x, y, z, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), CAP_TAG);
  m.scale.set(1, 0.55, 1);
  m.position.set(x, y - 0.005, z);
  m.userData.capBase = y;
  return tagCap(m, parent);
}

export function createRoofPiles(parent, root) {
  // roofs registered by buildings built after this module loaded (florist glass roof, its house)
  (reg.extraRoofs || []).forEach((r) => {
    if (SURFACES.some((S) => S.id === r.id)) return;
    const S = pentS(r.id, r.a, r.b, r.n, r.D, r.y, r.drop, { w: r.w, snow: r.snow, ridge: r.ridge, ov: r.ov });
    if (r.patch) { S.patch = r.patch; S.ribs = r.ribs; }
    S.N = new THREE.Vector3().crossVectors(S.V, S.U).normalize();
    S.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(S.U, S.N, S.V));
    SURFACES.push(S);
  });
  const U = { uL: { value: new THREE.Vector3(0.3, 0.9, 0.3) }, uBright: { value: 1 } };
  const R = rng(4242);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _w = new THREE.Vector3();

  /* ================================================================ petals + leaves */
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const kinds = {};
  const flakeKind = (name, shape, cap) => {
    const u = { ...U, uAmt: { value: 0 } };
    const geo = plane.clone();
    const col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const th = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    const cc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    geo.setAttribute('aCol', col); geo.setAttribute('aTh', th); geo.setAttribute('aC', cc);
    const im = new THREE.InstancedMesh(geo, flakeMaterial(shape, u), cap);
    im.count = 0; im.userData.noLine = true; im.frustumCulled = false; im.visible = false;
    const pad = new THREE.Mesh(new THREE.BufferGeometry(), padMaterial(u));
    pad.userData.noLine = true; pad.frustumCulled = false; pad.renderOrder = 1; pad.visible = false;
    reg.noRefl.push(im, pad); parent.add(pad, im);
    const K = { name, im, pad, u, cap, col, th, cc, i: 0, pp: [], pth: [], pc: [], pca: [], pidx: [] };
    kinds[name] = K;
    return K;
  };

  function genFlakes(K) {
    const cfg = KIND[K.name];
    const leaf = K.name === 'leaf';
    const put = (S, u, v, h, size, tilt, dark, th, cu, cv) => {
      if (K.i >= K.cap) return;
      _e.set((R() - 0.5) * tilt, R() * Math.PI * 2, (R() - 0.5) * tilt, 'YXZ');
      _q.copy(S.q).multiply(new THREE.Quaternion().setFromEuler(_e));
      P(S, u, v, h, _p); _s.set(size * (0.8 + R() * 0.4), 1, size);
      _m.compose(_p, _q, _s); K.im.setMatrixAt(K.i, _m);
      _c.set(cfg.palette[(R() * cfg.palette.length) | 0]).multiplyScalar(dark * (0.9 + R() * 0.2));
      K.col.setXYZ(K.i, _c.r, _c.g, _c.b); K.th.setX(K.i, th);
      P(S, cu, cv, 0, _w); K.cc.setXYZ(K.i, _w.x, _w.y, _w.z);
      K.i++;
    };
    // soft colour pad (ellipse a x b in the surface, axis angle ang), clipped to the surface by alpha
    const PR = 4, PS = 22;
    const pad = (S, cu, cv, a, b, ang, alpha, thv) => {
      const base = K.pp.length / 3;
      const ph = [R() * 6.28, R() * 6.28, R() * 6.28];
      _c.set(cfg.pad[(R() * cfg.pad.length) | 0]);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      P(S, cu, cv, 0.004, _w); const cx = _w.x, cy = _w.y, cz = _w.z;
      const push = (u, v, al) => {
        const ok = u > -0.01 && u < S.lu + 0.01 && v > -0.01 && v < S.lv + 0.01 && !inObst(S, u, v, -0.01);
        P(S, Math.min(S.lu, Math.max(0, u)), Math.min(S.lv, Math.max(0, v)), 0.004, _w);
        K.pp.push(_w.x, _w.y, _w.z); K.pth.push(thv); K.pc.push(cx, cy, cz); K.pca.push(_c.r, _c.g, _c.b, ok ? al : 0);
      };
      push(cu, cv, alpha);
      for (let r = 1; r <= PR; r++) {
        const rho = r / PR;
        for (let k = 0; k < PS; k++) {
          const t = (k / PS) * Math.PI * 2;
          const kk = 1 + 0.2 * Math.sin(3 * t + ph[0]) + 0.12 * Math.sin(5 * t + ph[1]) + 0.07 * Math.sin(8 * t + ph[2]);
          const x = Math.cos(t) * a * kk * rho, y = Math.sin(t) * b * kk * rho;
          push(cu + x * ca - y * sa, cv + x * sa + y * ca, alpha * Math.pow(1 - rho * rho, 0.6) * (0.8 + 0.2 * Math.sin(t * 4 + ph[2])));
        }
      }
      for (let k = 0; k < PS; k++) K.pidx.push(base, base + 1 + ((k + 1) % PS), base + 1 + k); // faces along N
      for (let r = 1; r < PR; r++) {
        const o0 = base + 1 + (r - 1) * PS, o1 = base + 1 + r * PS;
        for (let k = 0; k < PS; k++) { const A = o0 + k, B = o0 + ((k + 1) % PS), C = o1 + k, D = o1 + ((k + 1) % PS); K.pidx.push(A, B, C, B, D, C); }
      }
    };
    const fsz = () => (cfg.flake[0] + R() * (cfg.flake[1] - cfg.flake[0])) * (leaf ? 0.9 : 1);
    /** one pile: lobes along direction ang, length L, width W, height H; flakes stacked in a dome */
    const pile = (S, cu, cv, ang, L, W, H, wk, th0, padA = cfg.padA) => {
      const nl = 2 + ((R() * 3) | 0);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const lobes = Array.from({ length: nl }, () => ({ x: (R() - 0.5) * L * 0.9, y: (R() - 0.5) * W * 0.4, a: (L / nl) * (0.8 + R() * 0.6), b: W * (0.55 + R() * 0.45), h: H * (0.6 + R() * 0.6) }));
      lobes.forEach((lb) => pad(S, cu + lb.x * ca - lb.y * sa, cv + lb.x * sa + lb.y * ca, lb.a * 1.25, lb.b * 1.2, ang, Math.min(0.95, padA * (0.85 + R() * 0.3)), th0));
      const n = Math.round((leaf ? 40 : 72) * L * W * 6 * wk);
      for (let k = 0; k < n; k++) {
        const lb = lobes[(R() * nl) | 0];
        const t = R() * Math.PI * 2, rr = Math.sqrt(R());
        const x = lb.x + Math.cos(t) * lb.a * rr, y = lb.y + Math.sin(t) * lb.b * rr;
        const u = cu + x * ca - y * sa, v = cv + x * sa + y * ca;
        if (!inside(S, u, v, 0.01)) continue;
        const hk = 1 - rr * rr;
        const h = 0.004 + lb.h * hk * (0.3 + 0.7 * R());
        put(S, u, v, h, fsz(), cfg.tilt * (0.4 + hk), 0.76 + 0.24 * hk + h * 1.4, th0 + R() * 0.15, cu, cv);
      }
    };
    SURFACES.forEach((S) => {
      const wk = S.w[K.name] || 0;
      if (!wk) return;
      const area = S.lu * S.lv;
      const big = Math.min(S.lu, S.lv);
      // 1. deep drifts along every wall the surface leans on (mostly continuous, a few gaps)
      const edges = [];
      if (S.walls.v0) edges.push({ a: [0, 0], d: [1, 0], n: [0, 1], len: S.lu });
      if (S.walls.v1) edges.push({ a: [0, S.lv], d: [1, 0], n: [0, -1], len: S.lu });
      if (S.walls.u0) edges.push({ a: [0, 0], d: [0, 1], n: [1, 0], len: S.lv });
      if (S.walls.u1) edges.push({ a: [S.lu, 0], d: [0, 1], n: [-1, 0], len: S.lv });
      // the feet of rooftop obstacles collect too (each side facing open roof)
      S.obst.forEach(([a, b, c, d]) => {
        if (b - a < 0.3) return;
        edges.push({ a: [a, c], d: [1, 0], n: [0, -1], len: b - a, ob: 1 }, { a: [a, d], d: [1, 0], n: [0, 1], len: b - a, ob: 1 });
        edges.push({ a: [a, c], d: [0, 1], n: [-1, 0], len: d - c, ob: 1 }, { a: [b, c], d: [0, 1], n: [1, 0], len: d - c, ob: 1 });
      });
      // 1b. the eave band of a tile slope: petals / leaves caught on the lowest courses and the gutter
      if (S.eave) edges.push({ a: [0, 0], d: [1, 0], n: [0, 1], len: S.lu, eave: 1 });
      edges.forEach((E) => {
        let s = R() * 0.3;
        while (s < E.len - 0.15) {
          const L = (E.eave ? 0.6 : 0.5) + R() * 1.1;
          if (R() < (E.eave ? 0.2 : 0.14)) { s += L * 0.6; continue; } // gap
          const W = Math.min(big * 0.45, (E.eave ? 0.2 : 0.22) + Math.pow(R(), 1.3) * (E.ob ? 0.4 : E.eave ? 0.35 : 0.55));
          const m = Math.min(L * 0.5, E.len - s);
          const cu = E.a[0] + E.d[0] * (s + m * 0.5) + E.n[0] * (W * 0.5 + 0.02), cv = E.a[1] + E.d[1] * (s + m * 0.5) + E.n[1] * (W * 0.5 + 0.02);
          const H = (leaf ? 0.07 : 0.035) * (0.6 + R() * 0.9) * (E.eave ? 0.7 : 1);
          if (inside(S, cu, cv, 0)) pile(S, cu, cv, Math.atan2(E.d[1], E.d[0]), Math.min(L, E.len), W, H, wk, R() * 0.35 + (E.ob ? 0.1 : 0));
          s += L * (0.75 + R() * 0.3);
        }
      });
      // 2. big open patches across the surface (wind-swept heaps, irregular)
      const nOpen = Math.round(area * (S.eave ? 0.11 : 0.09) * wk);
      for (let k = 0; k < nOpen; k++) {
        const cu = 0.2 + R() * (S.lu - 0.4), cv = 0.15 + R() * (S.lv - 0.3);
        if (!inside(S, cu, cv, 0.05)) continue;
        const L = Math.min(big * 0.8, 0.5 + Math.pow(R(), 1.5) * 1.5), W = L * (0.45 + R() * 0.4);
        pile(S, cu, cv, R() * Math.PI, L, W, (leaf ? 0.05 : 0.025) * (0.5 + R()), wk, 0.25 + R() * 0.4, cfg.padA * 0.85);
      }
      // 3. dense loose layer everywhere (denser where the patches are, thinner towards the open edges)
      const nLoose = Math.round(area * (leaf ? 34 : 70) * wk * (S.eave ? 1.35 : 1));
      for (let k = 0; k < nLoose; k++) {
        const u = R() * S.lu, v = R() * S.lv;
        if (!inside(S, u, v, 0.01)) continue;
        const f = fbm(u * 0.9 + S.o.x, v * 0.9 + S.o.z);
        if (R() > 0.35 + 0.8 * f) continue;
        put(S, u, v, 0.003 + R() * 0.006, fsz(), 0.25, 0.86, 0.1 + R() * 0.8, u, v);
      }
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(K.pp, 3));
    pg.setAttribute('aTh', new THREE.Float32BufferAttribute(K.pth, 1));
    pg.setAttribute('aC', new THREE.Float32BufferAttribute(K.pc, 3));
    pg.setAttribute('aCA', new THREE.Float32BufferAttribute(K.pca, 4));
    pg.setIndex(K.pidx);
    K.pad.geometry = pg;
    K.im.count = K.i;
    K.im.instanceMatrix.needsUpdate = true;
    K.col.needsUpdate = true; K.th.needsUpdate = true; K.cc.needsUpdate = true;
    K.pp = K.pth = K.pc = K.pca = K.pidx = null;
  }
  genFlakes(flakeKind('leaf', 0, 24000));
  genFlakes(flakeKind('petal', 1, 36000));
  console.log(`roof piles: ${kinds.leaf.i} leaves, ${kinds.petal.i} petals`);

  /* ================================================================ snow blanket */
  const snowU = { ...U, uAmt: { value: 0 } };
  const geos = [];
  SURFACES.forEach((S) => {
    const T = S.snow;
    if (!T) return;
    const ov = S.ov;
    // overhang beyond open edges (none against walls)
    const e0u = S.walls.u0 ? 0 : ov, e1u = S.walls.u1 ? 0 : ov;
    const e0v = S.walls.v0 ? 0 : (S.eave ? ov * 1.4 : ov), e1v = S.walls.v1 ? 0 : (S.eave ? 0 : ov);
    const uA = -e0u, uB = S.lu + e1u, vA = -e0v, vB = S.lv + e1v;
    const c = Math.max(0.02, Math.min(0.1, (uB - uA) / 4, (vB - vA) / 4));
    const nu = Math.max(2, Math.ceil((uB - uA) / c)), nv = Math.max(2, Math.ceil((vB - vA) / c));
    const du = (uB - uA) / nu, dv = (vB - vA) / nv;
    const shoulder = Math.min(0.26, Math.min(uB - uA, vB - vA) * 0.45);
    const cellOk = (i, j) => i >= 0 && j >= 0 && i < nu && j < nv && !inObst(S, uA + (i + 0.5) * du, vA + (j + 0.5) * dv, 0.015) && (!S.clip || S.clip(uA + (i + 0.5) * du, vA + (j + 0.5) * dv));
    // distance to the nearest open (snow-free) boundary, and to the nearest wall / obstacle for drifts
    const dOpen = (u, v) => {
      let d = Infinity;
      if (!S.walls.u0) d = Math.min(d, u - uA);
      if (!S.walls.u1) d = Math.min(d, uB - u);
      if (!S.walls.v0) d = Math.min(d, v - vA);
      if (!S.walls.v1) d = Math.min(d, vB - v);
      return d;
    };
    const dWall = (u, v) => {
      let d = Infinity;
      if (S.walls.u0) d = Math.min(d, u);
      if (S.walls.u1) d = Math.min(d, S.lu - u);
      if (S.walls.v0) d = Math.min(d, v);
      if (S.walls.v1) d = Math.min(d, S.lv - v);
      // rooftop units are walls too: snow banks up against them
      S.obst.forEach(([a, b, cc, dd]) => { const ex = Math.max(a - u, 0, u - b), ez = Math.max(cc - v, 0, v - dd); d = Math.min(d, Math.hypot(ex, ez) * 1.3); });
      return d;
    };
    const base = (u, v, out) => {
      P(S, u, v, 0, out);
      // the cornice over a slope's eave hangs down a little
      if (S.eave && v < 0) out.addScaledVector(S.N, v * 0.55);
      return out;
    };
    const thick = (u, v) => {
      const sh = 0.32 + 0.68 * Math.sqrt(THREE.MathUtils.smoothstep(dOpen(u, v), 0, shoulder));
      const n = fbm(u * 1.7 + S.o.x * 0.3, v * 1.7 + S.o.z * 0.3);
      const drift = T * 0.75 * Math.exp(-dWall(u, v) / 0.35) * (0.6 + 0.8 * vnoise(u * 2.1, v * 2.1));
      return T * sh * (0.82 + 0.36 * n) + drift;
    };
    const thOf = (u, v) => {
      const w = P(S, u, v, 0, _w);
      let th = 0.04 + 0.4 * fbm(w.x * 0.45 + 3.1, w.z * 0.45 - 1.7);
      // glass roofs (S.patch): snow settles at the low edge and along the glazing bars first and stays
      // thin up the slope, so the roof keeps reading as glass instead of turning into a white lid
      if (S.patch) {
        th = 0.04 + 0.16 * fbm(w.x * 2.3, w.z * 2.3) + S.patch * Math.pow(Math.max(0, v) / S.lv, 0.8);
        if (S.ribs) {
          const d = Math.abs(((w[S.ribs.axis] - S.ribs.origin) % S.ribs.step + S.ribs.step) % S.ribs.step);
          th -= 0.32 * (1 - THREE.MathUtils.smoothstep(Math.min(d, S.ribs.step - d), 0.03, 0.09));
        }
      }
      return th;
    };
    // top surface (shared vertices, smooth normals)
    const pos = [], cen = [], th = [], idx = [];
    const vid = new Int32Array((nu + 1) * (nv + 1)).fill(-1);
    const used = new Uint8Array((nu + 1) * (nv + 1));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) if (cellOk(i, j)) { used[i * (nv + 1) + j] = used[(i + 1) * (nv + 1) + j] = used[i * (nv + 1) + j + 1] = used[(i + 1) * (nv + 1) + j + 1] = 1; }
    const B0 = new THREE.Vector3();
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const k = i * (nv + 1) + j;
      if (!used[k]) continue;
      const u = uA + i * du, v = vA + j * dv;
      base(u, v, B0);
      const t = thick(u, v);
      vid[k] = pos.length / 3;
      pos.push(B0.x + S.N.x * t, B0.y + S.N.y * t, B0.z + S.N.z * t); cen.push(B0.x, B0.y, B0.z); th.push(thOf(u, v));
    }
    const V = (i, j) => vid[i * (nv + 1) + j];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      if (!cellOk(i, j)) continue;
      const a = V(i, j), b = V(i + 1, j), c2 = V(i, j + 1), d = V(i + 1, j + 1);
      idx.push(a, c2, b, b, c2, d); // V x U = N: faces point out of the roof
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute('aC', new THREE.Float32BufferAttribute(cen, 3));
    top.setAttribute('aTh', new THREE.Float32BufferAttribute(th, 1));
    top.setIndex(idx);
    top.computeVertexNormals();
    geos.push(top.toNonIndexed());
    // skirt along every border edge: the slab's side, dropping just below the roof surface
    const sp = [], sc = [], st = [], sn = [];
    const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), Bb1 = new THREE.Vector3(), Bb2 = new THREE.Vector3();
    const edge = (i1, j1, i2, j2, nx, nz) => {
      const p1 = V(i1, j1), p2 = V(i2, j2);
      T1.fromArray(pos, p1 * 3); T2.fromArray(pos, p2 * 3);
      Bb1.fromArray(cen, p1 * 3).addScaledVector(S.N, -0.03); Bb2.fromArray(cen, p2 * 3).addScaledVector(S.N, -0.03);
      const C1 = cen.slice(p1 * 3, p1 * 3 + 3), C2 = cen.slice(p2 * 3, p2 * 3 + 3);
      const out = v3(0, 0, 0).addScaledVector(S.U, nx).addScaledVector(S.V, nz).addScaledVector(S.N, 0.25).normalize();
      [[T1, C1, th[p1]], [Bb1, C1, th[p1]], [T2, C2, th[p2]], [T2, C2, th[p2]], [Bb1, C1, th[p1]], [Bb2, C2, th[p2]]].forEach(([q, cc, tv]) => {
        sp.push(q.x, q.y, q.z); sc.push(...cc); st.push(tv); sn.push(out.x, out.y, out.z);
      });
    };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      if (!cellOk(i, j)) continue;
      if (!cellOk(i, j - 1)) edge(i, j, i + 1, j, 0, -1);
      if (!cellOk(i, j + 1)) edge(i + 1, j + 1, i, j + 1, 0, 1);
      if (!cellOk(i - 1, j)) edge(i, j + 1, i, j, -1, 0);
      if (!cellOk(i + 1, j)) edge(i + 1, j, i + 1, j + 1, 1, 0);
    }
    if (sp.length) {
      const sk = new THREE.BufferGeometry();
      sk.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      sk.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
      sk.setAttribute('aC', new THREE.Float32BufferAttribute(sc, 3));
      sk.setAttribute('aTh', new THREE.Float32BufferAttribute(st, 1));
      geos.push(sk);
    }
  });
  const blanket = new THREE.Mesh(mergeGeometries(geos, false), Object.assign(snowMaterial(snowU, false), { side: THREE.DoubleSide }));
  blanket.receiveShadow = true;
  blanket.userData.lineMat = snowLineMat(snowU, false); blanket.frustumCulled = false; blanket.visible = false;
  reg.noRefl.push(blanket); parent.add(blanket);

  /* ================================================================ lamp snow caps (baked from the tagged meshes) */
  let caps = null;
  {
    const list = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isMesh && o.userData.snowCap) list.push(o); });
    const cg = list.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(m.matrixWorld);
      const wp = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
      // grow from the bottom centre of the cap; each lamp gets its own threshold
      const by = m.parent.localToWorld(v3(m.position.x, m.userData.capBase, m.position.z)).y;
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3), t = new Float32Array(n);
      const tv = 0.04 + hsh(Math.round(wp.x * 3), Math.round(wp.z * 3)) * 0.32;
      for (let i = 0; i < n; i++) { c[i * 3] = wp.x; c[i * 3 + 1] = by; c[i * 3 + 2] = wp.z; t[i] = tv; }
      g.setAttribute('aC', new THREE.BufferAttribute(c, 3));
      g.setAttribute('aTh', new THREE.BufferAttribute(t, 1));
      return g;
    });
    list.forEach((m) => { m.parent.remove(m); m.geometry.dispose(); });
    if (cg.length) {
      caps = new THREE.Mesh(mergeGeometries(cg, false), snowMaterial(snowU, true));
      caps.receiveShadow = true;
      caps.userData.lineMat = snowLineMat(snowU, true); caps.frustumCulled = false; caps.visible = false;
      reg.noRefl.push(caps); parent.add(caps);
    }
  }

  return {
    kinds, blanket, caps,
    /** same inputs as the ground piles: { pilePetal, pileLeaf, pileSnow, pileBright, lightDir, litterAmt, litterKind } */
    apply(p) {
      U.uBright.value = p.pileBright;
      U.uL.value.copy(p.lightDir);
      const want = {
        leaf: Math.min(1, Math.max(p.pileLeaf, (p.litterAmt || 0) * (p.litterKind || 0) * 0.8)),
        petal: Math.min(1, Math.max(p.pilePetal, (p.litterAmt || 0) * (1 - (p.litterKind || 0)) * 0.8)),
      };
      Object.values(kinds).forEach((K) => {
        const a = want[K.name];
        K.u.uAmt.value = a;
        K.im.visible = K.pad.visible = a > 0.01;
      });
      const s = Math.min(1, p.pileSnow * 1.1);
      snowU.uAmt.value = s;
      blanket.visible = s > 0.01;
      if (caps) caps.visible = s > 0.01;
    },
  };
}
