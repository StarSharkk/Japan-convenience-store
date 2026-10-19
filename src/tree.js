import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMP, rng, patchToon, SNOW_U } from './core.js';

/* ====================================================================================================
   Stylised broadleaf tree / shrub (leaf-card foliage, no sphere stacking)

   skeleton : trunk -> 3 limbs -> 2 twigs (+ side twigs); tapered curved tubes, little root flare
   foliage  : shingled leaf masses ("clusters": rings of pointed leaf cards, outer rings droop, inner
              rings lift). Masses sit on every twig tip AND on satellite / fill positions inside the
              crown, so neighbouring masses overlap into one full, continuous canopy with a natural,
              irregular silhouette.
   crown core: a dark, noise-deformed shell hidden *inside* the leaf masses. It is never seen as a
              shape, it just keeps any small gap dark green (shade) instead of showing the sky.
   cost     : 3 draw calls per tree (bark, core, one InstancedMesh with all leaves)
   ==================================================================================================== */

const UP = new THREE.Vector3(0, 1, 0);

/** shared seasonal controls for all foliage (env.js drives these) */
export const SEASON_U = {
  W: { value: new THREE.Vector4(0, 1, 0, 0) }, // weights: spring, summer, autumn, winter
  drop: { value: 0 }, // fraction of leaves that have fallen
  sakura: { value: 0 }, // sakura festival: forces full cherry blossom on every tree
  tint: { value: new THREE.Vector3(1, 1, 1) }, // holiday colour cast (halloween dusk, christmas frost ...)
  glow: { value: 0 }, // night-time blossom glow (lantern-lit cherry trees)
};

/** every leaf InstancedMesh (so the quality setting can thin them) */
export const FOLIAGE = [];
export function setFoliageDensity(f) { FOLIAGE.density = f; FOLIAGE.forEach((m) => (m.count = Math.max(1, Math.floor(m.userData.total * f * (m.userData.lod ?? 1))))); }
FOLIAGE.density = 1;

function leafMaterial(blossom, dropK) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP, side: THREE.DoubleSide, emissive: '#0a241d' });
  const bl = { value: blossom ? 1 : 0 };
  const dk = { value: dropK };
  m.userData.blossomU = bl;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uSeasonW: SEASON_U.W, uDrop: SEASON_U.drop, uSakura: SEASON_U.sakura, uBlossom: bl, uDropK: dk, uSnow: SNOW_U, uTint: SEASON_U.tint, uBGlow: SEASON_U.glow });
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uDrop; uniform float uDropK; varying float vRnd;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vRnd = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n if (vRnd < uDrop * uDropK) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse; uniform vec4 uSeasonW; uniform float uBlossom; uniform float uSakura; uniform float uSnow; uniform vec3 uTint; uniform float uBGlow; varying float vRnd;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float gBl = 0.0; vec3 gPink = vec3(0.0);
         {
           vec3 base = diffuseColor.rgb;
           float lum = dot(base, vec3(0.299, 0.587, 0.114));
           vec3 spring = mix(base, vec3(lum * 0.7, lum * 1.45 + 0.012, lum * 0.55), 0.8);
           // cherry blossom: ~90% of the leaves become pink / pink-white, brighter near the leaf tips
           float blAmt = uBlossom * step(0.1, fract(vRnd * 7.3)) * max(uSeasonW.x, uSakura);
           vec3 pink = mix(vec3(0.95, 0.5, 0.68), vec3(1.0, 0.88, 0.93), fract(vRnd * 3.1)) * (0.42 + lum * 5.4);
           spring = mix(spring, pink, blAmt);
           gBl = blAmt; gPink = pink;
           // autumn: gold / orange / red-brown / brown, almost no green left
           float pk = fract(vRnd * 5.7);
           vec3 at = pk < 0.2 ? vec3(0.95, 0.7, 0.16) : pk < 0.45 ? vec3(0.9, 0.4, 0.1) : pk < 0.72 ? vec3(0.66, 0.17, 0.09) : pk < 0.96 ? vec3(0.44, 0.27, 0.11) : base * 1.4;
           vec3 autumn = pk < 0.96 ? at * (0.3 + lum * 4.6) : at;
           vec3 winter = vec3(0.5, 0.4, 0.33) * (0.3 + lum * 3.2);
           vec3 mixed = base * uSeasonW.y + spring * uSeasonW.x + autumn * uSeasonW.z + winter * uSeasonW.w;
           mixed = mix(mixed, pink, blAmt * (1.0 - uSeasonW.x));
           diffuseColor.rgb = mixed * uTint;
         }`
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += gPink * gBl * uBGlow * 0.16;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           float topn = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
           float sn = uSnow * smoothstep(0.3, 0.8, topn);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.99), sn * 0.95);
         }`
      );
  };
  m.customProgramCacheKey = () => 'leafSeason';
  return m;
}

/* night palettes: ink green -> blue green / grey green. Desaturated on purpose. */
export const LEAF_PALETTES = {
  deep: ['#16332b', '#25493c', '#376553', '#55876f'],
  teal: ['#14323a', '#224a54', '#34687a', '#527f8f'],
  grey: ['#233d35', '#35544a', '#4d7164', '#6e9286'],
};
const BARK = '#433e40';

/* ---------------------------------------------------------------- leaf card (6 triangles, shared) */
let leafGeo;
function getLeafGeo() {
  if (leafGeo) return leafGeo;
  const P = [[0, 0], [-0.3, 0.3], [-0.21, 0.72], [0, 1], [0.21, 0.72], [0.3, 0.3], [0, 0.4]];
  const pos = [], col = [], idx = [];
  P.forEach(([x, y]) => {
    pos.push(x, y, -0.16 * y * y); // slight curl
    const g = (0.5 + 0.5 * Math.pow(y, 0.8)) * (1 - Math.min(1, Math.abs(x) / 0.34) * 0.14); // dark base -> bright tip
    col.push(g, g, g);
  });
  [[0, 1, 6], [1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6], [5, 0, 6]].forEach((t) => idx.push(...t));
  leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  leafGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  leafGeo.setIndex(idx);
  leafGeo.computeVertexNormals();
  return leafGeo;
}

/* ---------------------------------------------------------------- tapered tube */
function taperTube(curve, r0, r1, seg = 8, rad = 7) {
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], nor = [], uv = [], idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, p);
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      nor.push(nx, ny, nz);
      uv.push(j / rad, t);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function mergeGeos(geos) {
  let total = 0;
  geos.forEach((g) => (total += g.attributes.position.count));
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2);
  const I = [];
  let off = 0;
  geos.forEach((g) => {
    P.set(g.attributes.position.array, off * 3);
    N.set(g.attributes.normal.array, off * 3);
    U.set(g.attributes.uv.array, off * 2);
    g.index.array.forEach((i) => I.push(i + off));
    off += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(I);
  return out;
}

/* ---------------------------------------------------------------- foliage builder */
class Foliage {
  constructor(R, palette, dens = 1, leafScale = 1) {
    this.R = R;
    this.pal = LEAF_PALETTES[palette] || LEAF_PALETTES.deep;
    this.dens = dens;
    this.ls = leafScale;
    this.leaves = [];
    this.m4 = new THREE.Matrix4();
    this.col = new THREE.Color();
  }
  jitter(a) {
    return (this.R() - 0.5) * 2 * a;
  }
  /** one shingled leaf mass; flat < 1 gives a lower, wider mass (shrubs) */
  cluster(center, Rc, tilt, o = {}) {
    const { R, pal, m4, col } = this;
    const flat = o.flat ?? 1;
    const top = o.top ?? 0;
    const L = 6;
    for (let k = 0; k < L; k++) {
      const u = k / (L - 1);
      const ringR = Rc * (1 - 0.82 * u);
      const ringH = Rc * 0.6 * flat * Math.pow(u, 0.85);
      const count = Math.max(5, Math.round((21 - u * 14 + R() * 3) * this.dens));
      const droop = THREE.MathUtils.lerp(-0.85, 0.5, u);
      const len = Rc * THREE.MathUtils.lerp(0.58, 0.4, u) * this.ls;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + k * 0.6 + this.jitter(0.28);
        const o3 = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        const dl = droop + this.jitter(0.2);
        const d = o3.clone().multiplyScalar(Math.cos(dl)).add(new THREE.Vector3(0, Math.sin(dl), 0)).normalize();
        const nrm = new THREE.Vector3().crossVectors(side, d).normalize();
        if (nrm.y < 0) nrm.negate();
        const roll = this.jitter(0.35);
        const s2 = side.clone().applyAxisAngle(d, roll);
        const n2 = nrm.clone().applyAxisAngle(d, roll);
        const sz = len * (0.85 + R() * 0.38);
        const p = new THREE.Vector3(o3.x * ringR * 0.78, ringH, o3.z * ringR * 0.78);
        if (tilt) {
          p.applyAxisAngle(tilt.axis, tilt.ang);
          s2.applyAxisAngle(tilt.axis, tilt.ang);
          d.applyAxisAngle(tilt.axis, tilt.ang);
          n2.applyAxisAngle(tilt.axis, tilt.ang);
        }
        p.add(center);
        m4.makeBasis(s2.multiplyScalar(sz), d.clone().multiplyScalar(sz), n2.multiplyScalar(sz));
        m4.setPosition(p);
        const pick = Math.min(3, Math.max(0, Math.floor(u * 2.4 + R() * 1.5 + top)));
        col.set(pal[pick]);
        col.multiplyScalar(0.82 + R() * 0.3);
        this.leaves.push([m4.clone(), col.clone()]);
      }
    }
  }
  mesh(castShadow = true, blossom = 0, dropK = 1) {
    const mat = leafMaterial(blossom, dropK);
    const im = new THREE.InstancedMesh(getLeafGeo(), mat, this.leaves.length);
    // random order, so that lowering `count` (quality setting) thins the canopy evenly instead of cutting whole clusters
    const L = this.leaves;
    for (let i = L.length - 1; i > 0; i--) { const j = (this.R() * (i + 1)) | 0; [L[i], L[j]] = [L[j], L[i]]; }
    im.userData.total = L.length;
    FOLIAGE.push(im);
    this.leaves.forEach(([m, c], i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = false;
    im.frustumCulled = false;
    return im;
  }
}

/** dark, noise-deformed shell that lives inside the foliage (never shows as a shape) */
function crownCore(R, center, rx, ry, rz, color) {
  let g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p1 = R() * 6, p2 = R() * 6, p3 = R() * 6;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = 1 + 0.16 * Math.sin(3.1 * x + p1) * Math.sin(2.3 * y + p2) + 0.14 * Math.sin(3.7 * z + p3) * Math.cos(2.1 * x + p1) + 0.1 * Math.sin(5 * y + 2 * z + p2);
    pos.setXYZ(i, x * r * rx, Math.max(y, -0.55) * r * ry, z * r * rz);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, patchToon(new THREE.MeshToonMaterial({ color, gradientMap: RAMP, emissive: '#050f0c' })));
  m.position.copy(center);
  m.castShadow = true;
  return m;
}

/* ---------------------------------------------------------------- tree */
export function makeTree({ seed = 1, height = 5.2, lean = 0.06, spread = 1.0, palette = 'deep', dens = 1, leafScale = 1, fill = 1, blossom = 0, evergreen = false } = {}) {
  const R = rng(seed * 7919 + 11);
  const root = new THREE.Group();
  const jitter = (a) => (R() - 0.5) * 2 * a;
  const geos = [];
  const anchors = [];
  const rotate = (dir, axis, ang) => dir.clone().applyAxisAngle(axis, ang);
  const perpendicular = (d) => new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();

  function branch(p0, dir, len, r0, depth, maxDepth) {
    const pts = [p0.clone()];
    let p = p0.clone();
    const d = dir.clone();
    for (let i = 0; i < 3; i++) {
      d.add(new THREE.Vector3(jitter(0.2), jitter(0.06), jitter(0.2))).add(UP.clone().multiplyScalar(depth === 0 ? 0.04 : 0.1)).normalize();
      p = p.clone().add(d.clone().multiplyScalar(len / 3));
      pts.push(p.clone());
    }
    const r1 = r0 * (depth === 0 ? 0.72 : 0.58);
    geos.push(taperTube(new THREE.CatmullRomCurve3(pts), r0, r1, 8, depth === 0 ? 9 : 6));
    const end = pts[pts.length - 1], endDir = d.clone();
    if (depth >= maxDepth) {
      anchors.push({ p: end.clone(), dir: endDir });
      return;
    }
    const kids = depth === 0 ? 3 : 2;
    const az0 = R() * Math.PI * 2;
    const axis0 = perpendicular(endDir);
    for (let k = 0; k < kids; k++) {
      const az = az0 + (k / kids) * Math.PI * 2 + jitter(0.5);
      const ang = (depth === 0 ? 0.62 : 0.5) * spread + jitter(0.16);
      const tiltAxis = rotate(axis0, endDir, az);
      branch(end, rotate(endDir, tiltAxis, ang).normalize(), len * (0.76 + jitter(0.07)), r1 * 0.9, depth + 1, maxDepth);
    }
    if (depth >= 1 && R() < 0.85) {
      const sp = pts[1].clone().lerp(pts[2], 0.3);
      const sd = rotate(endDir, perpendicular(endDir), 0.9 + jitter(0.3)).applyAxisAngle(endDir, R() * 6.28);
      branch(sp, sd.normalize(), len * 0.42, r1 * 0.55, maxDepth, maxDepth);
    }
  }

  const trunkR = height * 0.044;
  branch(new THREE.Vector3(), new THREE.Vector3(lean + jitter(0.04), 1, jitter(0.05)).normalize(), height * 0.36, trunkR, 0, 2);
  for (let i = 0; i < 4; i++) {
    const a = R() * Math.PI * 2 + i * 1.6;
    const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    geos.push(
      taperTube(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(o.x * trunkR * 0.3, trunkR * 1.4, o.z * trunkR * 0.3),
          new THREE.Vector3(o.x * trunkR * 1.4, trunkR * 0.55, o.z * trunkR * 1.4),
          new THREE.Vector3(o.x * trunkR * 2.8, 0, o.z * trunkR * 2.8),
        ]),
        trunkR * 0.55, trunkR * 0.12, 5, 5
      )
    );
  }
  const bark = new THREE.Mesh(mergeGeos(geos), patchToon(new THREE.MeshToonMaterial({ color: BARK, gradientMap: RAMP, emissive: '#08080a' })));
  bark.castShadow = true;
  bark.receiveShadow = true;
  root.add(bark);

  /* ---- foliage ---- */
  const F = new Foliage(R, palette, dens, leafScale);
  const mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  const baseR = height * 0.17 * spread;
  const place = (c, Rc, dirHint, topBias = null) => {
    const axis = dirHint ? new THREE.Vector3().crossVectors(UP, dirHint) : new THREE.Vector3(R() - 0.5, 0, R() - 0.5);
    if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
    const ang = dirHint ? Math.min(0.4, Math.acos(THREE.MathUtils.clamp(dirHint.y, -1, 1)) * 0.35) : jitter(0.25);
    F.cluster(c, Rc, { axis: axis.normalize(), ang }, { top: topBias ?? (c.y > height * 0.7 ? 0.5 : 0) });
    mn.min(c.clone().addScalar(-Rc * 0.9));
    mx.max(c.clone().addScalar(Rc * 0.9));
  };
  anchors.forEach((a) => {
    const Rc = baseR * (0.85 + R() * 0.35);
    const c = a.p.clone().add(a.dir.clone().multiplyScalar(Rc * 0.3)).add(new THREE.Vector3(0, Rc * 0.1, 0));
    place(c, Rc, a.dir);
    // satellite masses overlap the main one -> continuous canopy edge with natural bumps
    const sats = 1 + (R() < 0.6 ? 1 : 0);
    for (let s = 0; s < sats; s++) {
      const off = new THREE.Vector3(jitter(1), jitter(0.35), jitter(1)).normalize().multiplyScalar(Rc * (0.75 + R() * 0.2));
      place(c.clone().add(off), Rc * (0.62 + R() * 0.15), null);
    }
  });
  // fill masses inside the crown so no big holes remain
  const cen = mn.clone().add(mx).multiplyScalar(0.5);
  const half = mx.clone().sub(mn).multiplyScalar(0.5);
  const nFill = Math.round((9 + anchors.length * 1.0) * fill);
  for (let i = 0; i < nFill; i++) {
    const v = new THREE.Vector3(jitter(1), jitter(0.8) + 0.1, jitter(1));
    if (v.length() > 1) v.normalize();
    const c = new THREE.Vector3(cen.x + v.x * half.x * 0.62, cen.y + v.y * half.y * 0.62, cen.z + v.z * half.z * 0.62);
    place(c, baseR * (0.7 + R() * 0.3), null, -0.7); // inner masses are darker: depth without any solid blob
  }
  // a few drooping skirt masses low on the crown: soft underside, hides limb joints
  for (let i = 0; i < Math.round(3 * fill); i++) {
    const a = R() * 6.28;
    const c = new THREE.Vector3(cen.x + Math.cos(a) * half.x * 0.7, mn.y + baseR * 0.55, cen.z + Math.sin(a) * half.z * 0.7);
    place(c, baseR * (0.6 + R() * 0.25), null);
  }
  root.add(F.mesh(true, blossom, evergreen ? 0.12 : 1)); // evergreens keep most leaves in winter
  // NOTE: no solid crown core any more - it showed through as big flat dark lumps. Depth now comes only
  // from real leaves (dark inner masses + bright outer masses).
  root.userData.leafCount = F.leaves.length;
  root.userData.crown = { center: cen, half };
  return root;
}

/* ---------------------------------------------------------------- low shrub (no trunk) */
export function makeShrub({ seed = 1, width = 1.4, height = 0.9, palette = 'deep', dens = 0.8, leafScale = 1 } = {}) {
  const R = rng(seed * 4099 + 5);
  const root = new THREE.Group();
  const F = new Foliage(R, palette, dens, leafScale);
  const n = Math.max(2, Math.round(width / 0.55));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const Rc = height * (0.6 + R() * 0.25);
    F.cluster(new THREE.Vector3(t * width * 0.8, height * 0.28 + R() * height * 0.1, (R() - 0.5) * width * 0.3), Rc, null, { flat: 0.8, top: 0.3 });
  }
  root.add(F.mesh(true, 0, 0.45));
  root.add(crownCore(R, new THREE.Vector3(0, height * 0.4, 0), width * 0.3, height * 0.32, width * 0.16, LEAF_PALETTES[palette][0]));
  return root;
}
