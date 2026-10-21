import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, toon, rng } from '../core.js';

/* ====================================================================================================
   Plant kit (candidate assets, round 1): procedural leaves and stems in the project's toon look.

   A leaf is real geometry, not an alpha card: two half-blades (left / right of the midrib) built as a
   grid between an inner edge (the midrib, or the sinus between basal lobes) and the outline. The grid is
   then bent: droop along the length, cupping across, a soft keel at the midrib, an edge ripple and a
   twist. So the silhouette is the mesh itself (crisp at any distance, no transparent frame, no sorting,
   correct shadows) and only the veins come from a small painted texture.
   Stems / petioles are tapered tubes along a curve. Every plant is merged into one leaf mesh + one stem
   mesh (2 draw calls), with a per-vertex tint so leaves of one plant are not identical.
   ==================================================================================================== */

/**
 * Leaf blade in leaf space: midrib along +y from the attach point (y = 0) to the tip (y = L), x across,
 * +z = upper face. Options:
 *   L, W        length, full width
 *   width(v)    outline half-width factor along v in [0..1] (0 at the tip)
 *   lobe        basal lobes reach back to y = -lobe * L (heart / arrow leaves); lobeW(v) for v in [-lobe..0]
 *   sinus       half-width of the notch between the lobes at their back end (fraction of W)
 *   droop       tip sag (fraction of L), cup (edges up, fraction of W), keel, wave, twist (radians)
 */
export function bladeGeo(o) {
  const { L, W, width, lobe = 0, lobeW = null, sinus = 0, segL = 10, segW = 4, droop = 0.2, cup = 0.08, keel = 0.02, wave = 0, waveF = 9, twist = 0, curlBack = 0 } = o;
  const halves = [];
  const vmin = -lobe;
  for (const s of [-1, 1]) {
    const pos = [], uv = [], idx = [];
    const rows = segL + (lobe ? Math.ceil(segL * lobe * 1.5) : 0);
    for (let i = 0; i <= rows; i++) {
      const v = vmin + (i / rows) * (1 - vmin);
      let xo, xi;
      if (v >= 0) { xo = (W / 2) * width(v); xi = 0; }
      else {
        const k = -v / lobe; // 0 at the attach point, 1 at the back of the lobe
        xo = (W / 2) * (lobeW ? lobeW(k) : Math.sqrt(Math.max(0, 1 - k * k)));
        xi = W * sinus * Math.pow(k, 0.7);
        if (xi > xo) xi = xo;
      }
      for (let j = 0; j <= segW; j++) {
        const f = j / segW;
        const x = s * (xi + (xo - xi) * f);
        const y = v * L;
        const ax = Math.abs(x) / (W / 2);
        const vv = Math.max(0, v);
        let z = cup * W * ax * ax - keel * W * ax - droop * L * vv * vv * vv * 0.9 - droop * L * vv * vv * 0.3;
        z += wave * W * Math.sin(v * waveF * Math.PI + s * 0.7) * ax * ax;
        if (v < 0) z += curlBack * L * (-v) * (-v);
        // twist about the midrib, growing towards the tip
        const a = twist * vv;
        const xr = x * Math.cos(a) - z * Math.sin(a), zr = x * Math.sin(a) + z * Math.cos(a);
        pos.push(xr, y, zr);
        uv.push(0.5 + x / W, (v - vmin) / (1 - vmin));
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < segW; j++) {
      const a = i * (segW + 1) + j, b = a + 1, c = a + segW + 1, d = c + 1;
      // keep +z as the front face on both halves
      if (s > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    halves.push(g);
  }
  return mergeGeometries(halves, false);
}

/** a tapered tube along a curve (stems, petioles, fern rachis) */
export function taperTube(curve, r0, r1, segs = 10, radial = 5) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r); nor.push(N.x, N.y, N.z); uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
/**
 * place a leaf: attach point p, blade direction dir (leaf +y), roughly-up face direction up (leaf +z).
 * Adds a per-vertex colour tint (shade) so one plant's leaves differ a little.
 */
export function placeLeaf(geo, p, dir, up, shade = 1) {
  _y.copy(dir).normalize();
  _x.crossVectors(_y, up).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z).setPosition(p);
  const g = geo.clone().applyMatrix4(_m);
  tint(g, shade);
  return g;
}
export function tint(g, shade) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3).fill(shade);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** merge collected geometries into one mesh (keeps the shared attribute set) */
export function mergeInto(list, mat, o = {}) {
  const geos = list.map((g) => {
    const h = g.index ? g : g;
    if (!h.attributes.color) tint(h, 1);
    for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) h.deleteAttribute(k);
    return h;
  });
  const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  return m;
}

/* ---------------------------------------------------------------- leaf textures (painted veins) */
const texCache = new Map();
/**
 * kind: 'net' (broad leaf, pinnate side veins), 'parallel' (hosta / aspidistra: curved parallel veins),
 *       'plain' (fern pinnae, palm segments: midrib only)
 * colours: base (blade), edge (darker rim), vein (lighter), center (lighter band along the midrib)
 */
export function leafTex(key, { kind = 'net', base, edge, vein, center, veins = 9, margin = null, glossy = 0 }) {
  if (texCache.has(key)) return texCache.get(key);
  const t = canvasTex(128, 256, (g, w, h) => {
    // across: darker toward the rim, lighter band at the midrib
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, edge); gx.addColorStop(0.3, base); gx.addColorStop(0.5, center); gx.addColorStop(0.7, base); gx.addColorStop(1, edge);
    g.fillStyle = gx; g.fillRect(0, 0, w, h);
    // along: a little darker at the base, a soft sheen in the upper third
    const gy = g.createLinearGradient(0, h, 0, 0);
    gy.addColorStop(0, 'rgba(0,0,0,0.12)'); gy.addColorStop(0.45, 'rgba(255,255,255,0)'); gy.addColorStop(0.7, `rgba(255,255,240,${0.06 + glossy * 0.1})`); gy.addColorStop(1, 'rgba(0,0,0,0.05)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
    if (margin) { g.strokeStyle = margin; g.lineWidth = 9; g.beginPath(); g.moveTo(6, h); g.quadraticCurveTo(0, h * 0.3, w / 2, 2); g.quadraticCurveTo(w, h * 0.3, w - 6, h); g.stroke(); }
    g.strokeStyle = vein; g.lineCap = 'round';
    // midrib
    g.lineWidth = kind === 'plain' ? 2.5 : 4; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke();
    if (kind === 'net') {
      g.lineWidth = 1.8;
      for (let i = 1; i <= veins; i++) {
        const y0 = h * (1 - i / (veins + 1.5)), y1 = y0 - h * 0.12;
        [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(w / 2, y0); g.quadraticCurveTo(w / 2 + s * w * 0.25, y0 - h * 0.04, w / 2 + s * w * 0.47, y1); g.stroke(); });
      }
      g.globalAlpha = 0.35; g.lineWidth = 0.8;
      const R = rng(key.length * 7);
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 14, y - 6 - R() * 8); g.stroke(); }
      g.globalAlpha = 1;
    } else if (kind === 'parallel') {
      g.lineWidth = 1.3;
      for (let i = 1; i <= veins; i++) {
        const f = i / (veins + 1);
        [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(w / 2 + s * 3, h); g.bezierCurveTo(w / 2 + s * w * f * 0.62, h * 0.72, w / 2 + s * w * f * 0.5, h * 0.25, w / 2, 0); g.stroke(); });
      }
    }
  }, { aniso: 8 });
  texCache.set(key, t);
  return t;
}

/** leaf material: toon, two-sided, vertex tint, shared snow cover */
// shared per texture / colour, so every plant of a kind batches into one draw call (see merge.js)
const leafMats = new Map(), stemMats = new Map();
export function leafMat(tex, o = {}) {
  if (leafMats.has(tex)) return leafMats.get(tex);
  const m = toon('#ffffff', { map: tex, side: THREE.DoubleSide, lit: o.lit ?? 0.06, nocache: true });
  m.vertexColors = true;
  leafMats.set(tex, m);
  return m;
}
/** stem / petiole / cane material (vertex-tinted toon) */
export function stemMat(color) {
  if (stemMats.has(color)) return stemMats.get(color);
  const m = toon(color, { lit: 0.04, nocache: true });
  m.vertexColors = true;
  stemMats.set(color, m);
  return m;
}

/** a small irregular soil / mulch mound so a ground plant sits *in* the earth, not on it */
export function moundGeo(r, h, seed = 1, seg = 22) {
  const R = rng(seed);
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28];
  const pos = [0, h, 0], idx = [];
  const rings = 4;
  for (let i = 1; i <= rings; i++) {
    const rho = i / rings;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const k = 1 + 0.18 * Math.sin(3 * a + ph[0]) + 0.1 * Math.sin(5 * a + ph[1]) + 0.06 * Math.sin(9 * a + ph[2]);
      const y = h * Math.pow(1 - rho * rho, 1.3) * (0.85 + 0.3 * R()) - (i === rings ? 0.012 : 0);
      pos.push(Math.cos(a) * r * k * rho, y, Math.sin(a) * r * k * rho);
    }
  }
  for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
  for (let i = 1; i < rings; i++) {
    const o0 = 1 + (i - 1) * seg, o1 = 1 + i * seg;
    for (let j = 0; j < seg; j++) { const a = o0 + j, b = o0 + ((j + 1) % seg), c = o1 + j, d = o1 + ((j + 1) % seg); idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** triangle count of an object (for the review notes) */
export function triCount(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return Math.round(n);
}
