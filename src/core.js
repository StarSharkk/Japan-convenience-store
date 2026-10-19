import * as THREE from 'three';

export { THREE };

/* ------------------------------------------------------------------ registry */
export const reg = {
  updaters: [], // (t, dt) => void
  ground: [], // meshes using the reflective ground shader (hidden while rendering reflection)
  noRefl: [], // objects that are skipped in the reflection pass (rain, drips...)
  lights: {}, // named lights for animation
};

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
const rampData = new Uint8Array([78, 158, 222, 255]);
export const RAMP = new THREE.DataTexture(rampData, 4, 1, THREE.RedFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
RAMP.needsUpdate = true;

/* ------------------------------------------------------------------ materials */
const cache = new Map();
const col = (c) => new THREE.Color(c);

/**
 * Toon material.  o.lit = k adds k * albedo as emissive (interior "self-lit" look)
 */
export function toon(color, o = {}) {
  const cacheable = !o.map && !o.nocache;
  const key = cacheable ? `${col(color).getHexString()}|${o.lit || 0}|${o.e || ''}|${o.ei || 1}|${o.op ?? 1}|${o.side || 0}` : null;
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
  if (o.lit) {
    const k = o.lit * 0.85;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLit = { value: k };
      sh.fragmentShader = sh.fragmentShader
        .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform float uLit;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uLit;');
    };
    m.customProgramCacheKey = () => 'toonlit';
  }
  if (key) cache.set(key, m);
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
    fog: o.fog ?? false,
  });
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

/** box by extents */
export function bx(parent, mat, x0, x1, y0, y1, z0, z1, o = {}) {
  const m = new THREE.Mesh(UNIT, mat);
  m.scale.set(x1 - x0, y1 - y0, z1 - z0);
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
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 8;
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

export function halo(parent, x, y, z, color, size = 1.5, op = 0.6) {
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
  return s;
}

/* ------------------------------------------------------------------ point lights */
export function plight(parent, color, intensity, dist, x, y, z, name) {
  const l = new THREE.PointLight(col(color), intensity, dist, 2);
  l.position.set(x, y, z);
  l.userData.base = intensity;
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
