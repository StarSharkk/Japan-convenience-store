import * as THREE from 'three';

export { THREE };
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* Diorama air perspective. scene.fog is a THREE.Fog used as: near = where the model begins (the camera's
   distance to its target minus the model's reach, set every frame in main.js), far = the density (env.js).
   Fog then grows with the depth *past* the near side of the model (exponential-squared), a little thicker
   close to the ground and thinner up high. Close up near = 0, so it behaves like the old camera fog;
   from the overview the near half of the base stays crisp and only the far side melts into the air,
   instead of the whole diorama sitting in a white box. */
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth; varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogY = cameraPosition.y + ( transpose( mat3( viewMatrix ) ) * mvPosition.xyz ).y;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth; varying float vFogY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogD = max( vFogDepth - fogNear, 0.0 ) * fogFar * mix( 1.2, 0.78, smoothstep( 0.0, 9.0, vFogY ) );
    float fogFactor = 1.0 - exp( - fogD * fogD );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

/* ------------------------------------------------------------------ registry */
export const reg = {
  updaters: [], // (t, dt) => void
  ground: [], // meshes using the reflective ground shader (hidden while rendering reflection)
  noRefl: [], // objects that are skipped in the reflection pass (rain, drips...)
  lights: {}, // named lights for animation
  emis: [], // tracked emissive (glow) materials: { m, base, cat }
  halos: [], // tracked light-halo sprites: { s, op, size, cat }
  litMats: [], // toon materials with the self-lit hack (interior / warm wood...)
  reflOn: true, // false while the ground is dry: the planar reflection pass is skipped
};

/* ------------------------------------------------------------------ environment hooks (written by env.js) */
// factors 0..1 that scene code may read each frame
export const ENVK = { shop: 1, street: 1, iza: 1, deco: 1, open: 1, sign: 1, rain: 0, drip: 0, day: 0, fog: 0, wind: 0 };
// emissive category used by materials / halos / lit-materials created from now on
export const CAT = { glow: 'shop', lit: 'shop' };
export function setCat(c) {
  CAT.glow = c;
  CAT.lit = c;
}
// shared snow-cover amount for every toon material (white on up-facing surfaces)
export const SNOW_U = { value: 0 };
// boxes that never take snow cover (under a roof: the greenhouse interior): x0, z0, x1, z1 + the height below which
const NOSNOW_U = { value: Array.from({ length: 4 }, () => new THREE.Vector4(1e5, 1e5, -1e5, -1e5)) };
const NOSNOWY_U = { value: [0, 0, 0, 0] };
let nNoSnow = 0;
export function noSnowBox(x0, z0, x1, z1, yTop) {
  if (nNoSnow >= 4) return;
  NOSNOW_U.value[nNoSnow].set(x0, z0, x1, z1);
  NOSNOWY_U.value[nNoSnow++] = yTop;
}
export const lk = (l) => (l.userData.k === undefined ? 1 : l.userData.k);

export const FONT =
  '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP","PingFang SC","Microsoft YaHei",sans-serif';

/* ------------------------------------------------------------------ random */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ toon ramp */
// Cel ramp with *smooth* band edges (linear filtered, 256 texels). A 4-texel NEAREST ramp makes every
// light pool / shadow terminator a hard 1-pixel step, i.e. real shader aliasing; this keeps the same
// four tones but anti-aliases the transitions like a vector gradient stop.
const RAMP_LEVELS = [0.3, 0.62, 0.86, 1.0];
const RAMP_EDGES = [0.25, 0.5, 0.75];
const RAMP_W = 0.035;
const rampData = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const x = i / 255;
  let v = RAMP_LEVELS[0];
  RAMP_EDGES.forEach((e, k) => {
    const t = Math.min(1, Math.max(0, (x - (e - RAMP_W)) / (2 * RAMP_W)));
    v += (RAMP_LEVELS[k + 1] - RAMP_LEVELS[k]) * (t * t * (3 - 2 * t));
  });
  rampData[i] = Math.round(v * 255);
}
export const RAMP = new THREE.DataTexture(rampData, 256, 1, THREE.RedFormat);
RAMP.minFilter = RAMP.magFilter = THREE.LinearFilter;
RAMP.wrapS = RAMP.wrapT = THREE.ClampToEdgeWrapping;
RAMP.generateMipmaps = false;
RAMP.needsUpdate = true;

/* ------------------------------------------------------------------ materials */
const cache = new Map();
const col = (c) => new THREE.Color(c);

/**
 * Toon material.  o.lit = k adds k * albedo as emissive (interior "self-lit" look)
 */
export function toon(color, o = {}) {
  const cacheable = !o.map && !o.nocache;
  const litCat = o.lit ? CAT.lit : '';
  const key = cacheable ? `${col(color).getHexString()}|${o.lit || 0}|${litCat}|${o.e || ''}|${o.ei || 1}|${o.op ?? 1}|${o.side || 0}|${o.nosnow ? 1 : 0}` : null;
  if (key && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({
    color: col(color),
    gradientMap: RAMP,
    map: o.map || null,
    emissive: col(o.e ?? 0x000000),
    emissiveIntensity: o.ei ?? 1,
    transparent: (o.op ?? 1) < 1,
    opacity: o.op ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  // interior (shop) materials never get snow; everything exterior does
  patchToon(m, o.lit ? o.lit * 0.85 : 0, litCat !== 'shop' && !o.nosnow, litCat);
  if (key) cache.set(key, m);
  return m;
}

/**
 * Adds to a MeshToonMaterial: (a) the "self-lit" emissive hack (litK), (b) shared snow cover on up-facing
 * surfaces. One shader program per flag combination is shared by all materials.
 */
export function patchToon(m, litK = 0, snow = true, litCat = '') {
  m.userData.litBase = litK;
  m.userData.litCat = litCat;
  if (litK) reg.litMats.push(m);
  m.onBeforeCompile = (sh) => {
    let fs = sh.fragmentShader;
    if (snow) {
      sh.uniforms.uSnow = SNOW_U;
      sh.uniforms.uNoSnow = NOSNOW_U;
      sh.uniforms.uNoSnowY = NOSNOWY_U;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSnW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
         {
           vec4 snw = vec4(transformed, 1.0);
           #ifdef USE_INSTANCING
             snw = instanceMatrix * snw;
           #endif
           vSnW = (modelMatrix * snw).xyz;
         }`);
      fs = fs.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uSnow;\nuniform vec4 uNoSnow[4];\nuniform float uNoSnowY[4];\nvarying vec3 vSnW;');
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           float topn = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
           float sn = uSnow * smoothstep(0.38, 0.82, topn);
           for (int i = 0; i < 4; i++) {
             vec4 b = uNoSnow[i];
             if (vSnW.x > b.x && vSnW.x < b.z && vSnW.z > b.y && vSnW.z < b.w && vSnW.y < uNoSnowY[i]) sn = 0.0;
           }
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.99), sn * 0.96);
         }`
      );
    }
    if (litK) {
      sh.uniforms.uLit = { value: litK };
      m.userData.litU = sh.uniforms.uLit;
      fs = fs
        .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uLit;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uLit;');
    }
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'toon' + (litK ? 'L' : '') + (snow ? 'S' : '');
  return m;
}

/** Unlit emissive material (HDR capable so that bloom picks it up). */
export function glow(color, k = 1, o = {}) {
  const c = col(color).multiplyScalar(k);
  const m = new THREE.MeshBasicMaterial({
    color: c,
    map: o.map || null,
    transparent: !!o.transparent || (o.op ?? 1) < 1,
    opacity: o.op ?? 1,
    side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? true,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: o.fog ?? true,
  });
  // o.off: the colour the emitter shows when its category is fully off (a lamp lens in daylight is not black)
  if (o.track !== false) reg.emis.push({ m, base: c.clone(), cat: o.cat || CAT.glow, off: o.off ? col(o.off) : null });
  return m;
}

/* ------------------------------------------------------------------ builders */
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new Map();
function cylGeo(seg, rt = 1) {
  const k = seg + '|' + rt;
  if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(rt, 1, 1, seg, 1));
  return cylCache.get(k);
}
const SPH = new THREE.SphereGeometry(1, 20, 14);
const PLANE = new THREE.PlaneGeometry(1, 1);

function flags(m, o) {
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.recv ?? true;
  if (o.noLine) m.userData.noLine = true;
  return m;
}

/* chamfered boxes: every box gets a small bevel (≤ 3.5 cm, scaled to its thinnest side) so its edges catch the
   light instead of drawing a hard crease line. Geometries are cached by size (merged into batches later). */
const boxCache = new Map();
function boxGeo(w, h, d, bevel) {
  const q = (v) => Math.round(v * 400) / 400;
  w = q(w); h = q(h); d = q(d);
  const r = bevel === 0 ? 0 : Math.min(bevel ?? 0.035, Math.min(w, h, d) * 0.16);
  const key = `${w}|${h}|${d}|${r.toFixed(4)}`;
  let g = boxCache.get(key);
  if (!g) {
    g = r < 0.004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r);
    boxCache.set(key, g);
  }
  return g;
}
/** box by extents (o.bevel: chamfer radius, 0 = sharp) */
export function bx(parent, mat, x0, x1, y0, y1, z0, z1, o = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const m = new THREE.Mesh(w > 0 && h > 0 && d > 0 ? boxGeo(w, h, d, o.bevel) : UNIT, mat);
  if (!(w > 0 && h > 0 && d > 0)) m.scale.set(x1 - x0 || 1e-4, y1 - y0 || 1e-4, z1 - z0 || 1e-4);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(m);
  return flags(m, o);
}

/** box by center-bottom */
export function bc(parent, mat, cx, y0, cz, w, h, d, o = {}) {
  return bx(parent, mat, cx - w / 2, cx + w / 2, y0, y0 + h, cz - d / 2, cz + d / 2, o);
}

/** vertical cylinder (radius, height) bottom at y0; rt = top radius ratio */
export function cy(parent, mat, x, y0, z, r, h, seg = 16, o = {}) {
  const m = new THREE.Mesh(cylGeo(seg, o.rt ?? 1), mat);
  m.scale.set(r, h, r);
  m.position.set(x, y0 + h / 2, z);
  parent.add(m);
  return flags(m, o);
}

/** cylinder between two points */
export function cyl2(parent, mat, a, b, r, seg = 8, o = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const m = new THREE.Mesh(cylGeo(seg, o.rt ?? 1), mat);
  m.scale.set(r, len, r);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return flags(m, { cast: false, ...o });
}

export function sph(parent, mat, r, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) {
  const m = new THREE.Mesh(SPH, mat);
  m.scale.set(r * sx, r * sy, r * sz);
  m.position.set(x, y, z);
  parent.add(m);
  return flags(m, o);
}

/** plane (faces +z by default) */
export function pl(parent, mat, w, h, x, y, z, ry = 0, rx = 0, o = {}) {
  const m = new THREE.Mesh(PLANE, mat);
  m.scale.set(w, h, 1);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0, 'YXZ');
  parent.add(m);
  return flags(m, { cast: false, recv: false, ...o });
}

export function grp(parent, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ textures */
export function canvasTex(w, h, draw, o = {}) {
  // Every procedural texture is painted at up to 2x its logical size (4096 px cap). Draw callbacks keep
  // using logical coordinates; the context is scaled, so signs/posters/road paint stay crisp when zoomed in.
  const s = o.scale ?? Math.min(2, 4096 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  const g = c.getContext('2d');
  g.scale(c.width / w, c.height / h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 16;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.nearest) t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function vtext(g, str, x, y, step) {
  [...str].forEach((ch, i) => g.fillText(ch, x, y + i * step));
}

/* ------------------------------------------------------------------ halo sprites */
let haloTex;
function getHaloTex() {
  if (!haloTex) {
    haloTex = canvasTex(
      128,
      128,
      (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      },
      { aniso: 1 }
    );
  }
  return haloTex;
}

export function halo(parent, x, y, z, color, size = 1.5, op = 0.6, cat = null) {
  const m = new THREE.SpriteMaterial({
    map: getHaloTex(),
    color: col(color),
    transparent: true,
    opacity: op,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const s = new THREE.Sprite(m);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  s.userData.noLine = true;
  s.userData.baseOp = op;
  parent.add(s);
  reg.halos.push({ s, op, size, cat: cat || CAT.glow });
  return s;
}

/* ------------------------------------------------------------------ point lights */
export function plight(parent, color, intensity, dist, x, y, z, name) {
  const l = new THREE.PointLight(col(color), intensity, dist, 2);
  l.position.set(x, y, z);
  l.userData.base = intensity;
  l.userData.k = 1;
  parent.add(l);
  if (name) reg.lights[name] = l;
  return l;
}

/* ------------------------------------------------------------------ product pool (instanced) */
export class Pool {
  constructor() {
    this.items = { box: [], cyl: [], cone: [], sph: [] };
  }
  box(x, y, z, w, h, d, color, ry = 0) {
    this.items.box.push([x, y + h / 2, z, w, h, d, color, ry]);
  }
  cyl(x, y, z, r, h, color, rt = 1) {
    this.items.cyl.push([x, y + h / 2, z, r, h, r, color, 0, rt]);
  }
  cone(x, y, z, r, h, color, ry = 0) {
    this.items.cone.push([x, y + h / 2, z, r, h, r, color, ry]);
  }
  ball(x, y, z, r, color, sy = 1) {
    this.items.sph.push([x, y, z, r, r * sy, r, color, 0]);
  }
  build(parent, mat, o = {}) {
    const geos = {
      box: UNIT,
      cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
      cone: new THREE.ConeGeometry(1, 1, 3, 1).rotateY(Math.PI / 6),
      sph: new THREE.SphereGeometry(1, 12, 8),
    };
    const out = [];
    for (const k of Object.keys(this.items)) {
      const arr = this.items[k];
      if (!arr.length) continue;
      const im = new THREE.InstancedMesh(geos[k], mat, arr.length);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const c = new THREE.Color();
      arr.forEach((a, i) => {
        e.set(0, a[7] || 0, 0);
        q.setFromEuler(e);
        mtx.compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(a[3], a[4], a[5]));
        im.setMatrixAt(i, mtx);
        im.setColorAt(i, c.set(a[6]));
      });
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
      im.castShadow = false;
      im.receiveShadow = false;
      if (o.noLine) im.userData.noLine = true;
      parent.add(im);
      out.push(im);
    }
    return out;
  }
}

/* ------------------------------------------------------------------ misc */
export const WHITE = 0xffffff;
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}
export function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
