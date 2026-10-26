import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { reg, rng } from './core.js';
import { SEASON_U } from './tree.js';

/* ====================================================================================================
   CloudSystem: Japanese-animation cumulus round the floating island (town/island.js).

   Models   12 cloud styles modelled here (their look studied from PolyOne Studio's "Stylized Clouds Pack" Vol.02 /
            Vol.07 on Sketchfab - nothing of theirs is used: Vol.07 needs a Sketchfab login to download, Vol.02 is a
            paid asset). Each cloud is a stack of tiers - a flat, slightly flared base with thin tapering tails, a body,
            billowing domes on top - made of round lobes blended into ONE continuous surface (an implicit lobe field,
            a smooth union with a small blend radius, meshed by marching cubes): the lobes stay readable as layered
            puffs with soft creases between them, never a string of separate balls. Lobes sit front and back too, so a
            cloud holds up from every side. Vertex data: crease occlusion (from the field) + height in the cloud.
   Shading  cel-style: three soft bands (light, mid, shade) from the sun or the moon, darker creases, a flat underside, a
            rim. The colours come from the sky round them (CLOUD_U, env.js): white and blue by day; at sunset the lit side
            takes the sun's colour, the mid tones the horizon glow, the shade the violet sky above; at night moonlit edges
            and a body in the night sky's own blue. Heavier and greyer in rain, a faint seasonal cast, haze with distance.
   Layout   CloudRoot -> Cloud_Background_Group (few, big, far, round the horizon)
                      -> Cloud_Midground_Group (round the island: the main ring, some below the tray's rim)
                      -> Cloud_Detail_Group (small puffs, high up or far)
            seeded, and tested against the camera's usual orbit so no cloud ever sits in front of the town.
   Motion   each cloud wanders slowly round its place and bobs a little (big ones slowest); nothing flickers.
   ==================================================================================================== */

/* ---------------------------------------------------------------- the lobe field */
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
/** signed distance of a lobe set (ellipsoid lobes: sx / sy / sz squash, kb: each lobe's blend), a flat base at y = 0 */
function field(L, x, y, z) {
  let d = 1e9;
  for (let i = 0; i < L.length; i++) {
    const l = L[i], dx = (x - l.x) / l.sx, dy = (y - l.y) / l.sy, dz = (z - l.z) / l.sz;
    const e = (Math.sqrt(dx * dx + dy * dy + dz * dz) - l.r) * l.m;
    d = smin(d, e, l.kb * l.r);
  }
  return smax(d, -y, 0.12);
}

/* ---------------------------------------------------------------- the styles (lobe recipes) */
// every recipe returns lobes {x, y, z, r, sx?, sy?, sz?} for a cloud ~1 unit wide (x), resting on y = 0
const lobe = (x, y, z, r, sx = 1, sy = 1, sz = 1, kb = 0.3) => ({ x, y, z, r, sx, sy, sz, kb }); // kb: blend radius (x r)
/** a base skirt: lobes along x from a to b, round in the middle, thinning to tails at the ends (taper^p) */
function skirt(R, out, a, b, r0, n, depth = 0.3, p = 1.4, flat = 0.62) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = a + (b - a) * t, k = Math.pow(Math.sin(Math.PI * t), 1 / p);
    const r = r0 * (0.38 + 0.62 * k) * (0.85 + R() * 0.3);
    out.push(lobe(x + (R() - 0.5) * 0.02, r * flat * 0.95, (R() - 0.5) * depth * k, r, 1.35, flat, 1.1, 0.7));
  }
}
/** a tier: lobes on an arc round (cx, y), front and back, radius r, n of them over width w */
function tier(R, out, cx, y, w, r, n, depth = 0.45) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), x = cx - w / 2 + w * t + (R() - 0.5) * w * 0.12;
    const rr = r * (0.82 + R() * 0.36) * (1 - 0.25 * Math.abs(t - 0.5) * 2);
    out.push(lobe(x, y + (R() - 0.3) * r * 0.3, (i % 2 ? 1 : -1) * depth * (0.3 + R() * 0.7) * r * 2, rr, 1.05 + R() * 0.15, 0.9 + R() * 0.12, 1));
  }
}
export const CLOUD_STYLES = {
  // the classic: flared base with tails both sides, a wide body, two or three domes billowing on top
  cumulus: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.12, 13); tier(R, L, 0, 0.13, 0.55, 0.14, 6); tier(R, L, 0.02, 0.27, 0.32, 0.13, 3); L.push(lobe((R() - 0.5) * 0.08, 0.38, 0, 0.11)); return L; },
  // towering: a narrow base, tiers shrinking upward, the head pushed a little sideways
  tower: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.12, 11, 0.2); let y = 0.12, w = 0.5, r = 0.14, cx = 0; for (let k = 0; k < 5; k++) { tier(R, L, cx, y, w, r, Math.max(2, 5 - k)); y += r * 0.82; w *= 0.72; r *= 0.9; cx += (R() - 0.35) * 0.05; } return L; },
  // two humps joined by a low saddle
  twin: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.1, 14); tier(R, L, -0.2, 0.12, 0.28, 0.12, 3); tier(R, L, -0.2, 0.24, 0.12, 0.1, 2); tier(R, L, 0.22, 0.11, 0.26, 0.115, 3); tier(R, L, 0.24, 0.21, 0.1, 0.085, 1); return L; },
  // a body at one end, a long tail of shrinking puffs trailing away (wind)
  tail: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.11, 14, 0.15, 0.7); tier(R, L, -0.22, 0.12, 0.3, 0.13, 4); tier(R, L, -0.24, 0.24, 0.14, 0.11, 2); for (let i = 0; i < 5; i++) L.push(lobe(-0.02 + i * 0.1, 0.09 - i * 0.008, (R() - 0.5) * 0.05, 0.085 - i * 0.012)); return L; },
  // a long low streak of small lobes (fair-weather stratocumulus)
  streak: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.085, 20, 0.14, 1.0, 0.6); tier(R, L, -0.05, 0.08, 0.55, 0.07, 7, 0.2); return L; },
  // a small round puff
  puff: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.18, 8, 0.3); tier(R, L, 0, 0.17, 0.5, 0.17, 4); tier(R, L, 0.03, 0.31, 0.26, 0.14, 2); L.push(lobe(-0.02, 0.42, 0, 0.11)); return L; },
  // terraced: two flat shelves stepped back like layered paper
  terrace: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.11, 14, 0.3, 1.2, 0.5); const n0 = L.length; skirt(R, L, -0.32, 0.36, 0.1, 10, 0.26, 1.2, 0.5); for (let i = n0; i < L.length; i++) { L[i].y += 0.085; L[i].z -= 0.03; } tier(R, L, 0.05, 0.19, 0.3, 0.09, 3); return L; },
  // castellanus: a flat body with a row of small turrets
  castle: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.1, 14, 0.18, 1.1); tier(R, L, 0, 0.1, 0.62, 0.1, 6, 0.18); for (let i = 0; i < 4; i++) { const x = -0.24 + i * 0.16 + (R() - 0.5) * 0.04; L.push(lobe(x, 0.19, (R() - 0.5) * 0.06, 0.075 + R() * 0.02)); if (R() < 0.6) L.push(lobe(x + 0.01, 0.26, 0, 0.055)); } return L; },
  // a wide low billow, many middling lobes along its top
  billow: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.1, 16); tier(R, L, 0, 0.12, 0.72, 0.11, 8, 0.25); tier(R, L, 0.04, 0.22, 0.36, 0.09, 3); return L; },
  // a small tuft: a round head with a short tail each side
  tuft: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.13, 11, 0.24, 0.8); tier(R, L, 0.02, 0.13, 0.32, 0.13, 3); tier(R, L, 0, 0.24, 0.15, 0.11, 2); L.push(lobe(0.02, 0.33, 0, 0.085)); return L; },
  // wind-sheared: tiers stacked leaning to one side (three: a broad one, a narrower one, one low puff on top - no balls
  // perched up top)
  shear: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.11, 13); let y = 0.12, cx = -0.1, w = 0.42, r = 0.13; [4, 3, 1].forEach((n) => { tier(R, L, cx, y, w, r, n); y += r * 0.72; cx += 0.09; w *= 0.75; r *= 0.86; }); return L; },
  // a chunky cotton ball: round, a little skirt, a big dome
  cotton: (R) => { const L = []; skirt(R, L, -0.5, 0.5, 0.15, 10, 0.28); tier(R, L, 0, 0.17, 0.48, 0.17, 5, 0.3); tier(R, L, 0.02, 0.33, 0.24, 0.15, 2); L.push(lobe(-0.02, 0.46, 0.02, 0.12)); return L; },
};

const RES = { cumulus: 56, tower: 56, twin: 52, tail: 52, streak: 48, puff: 40, terrace: 48, castle: 52, billow: 52, tuft: 40, shear: 52, cotton: 46 };
const MC_MAT = new THREE.MeshBasicMaterial(); // (marching cubes reads its flatShading; never rendered)
const MC = new Map();
const geoCache = new Map();
export const CLOUD_STATS = { models: 0, ms: 0, verts: 0 };
/** one cloud model (style + variant): ~1 unit wide, resting on y = 0, centred on x / z */
export function cloudGeo(style, variant = 0) {
  const key = style + variant;
  if (geoCache.has(key)) return geoCache.get(key);
  const t0 = performance.now();
  const R = rng(8100 + Object.keys(CLOUD_STYLES).indexOf(style) * 53 + variant * 17);
  const L = CLOUD_STYLES[style](R).map((l) => ({ sx: 1, sy: 1, sz: 1, m: 1, kb: 0.3, ...l }));
  L.forEach((l) => { l.m = Math.min(l.sx, l.sy, l.sz); }); // keep the squashed lobes' distance roughly metric
  // the box round the lobes
  let x0 = 1e9, x1 = -1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  L.forEach((l) => { x0 = Math.min(x0, l.x - l.r * l.sx); x1 = Math.max(x1, l.x + l.r * l.sx); y1 = Math.max(y1, l.y + l.r * l.sy); z0 = Math.min(z0, l.z - l.r * l.sz); z1 = Math.max(z1, l.z + l.r * l.sz); });
  const pad = 0.07, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 + pad, hy = (y1 + 0.02) / 2 + pad, hz = (z1 - z0) / 2 + pad, cy = hy - pad;
  const N = RES[style] || 52;
  const mc = MC.get(N) || MC.set(N, new MarchingCubes(N, MC_MAT, false, false, 30000)).get(N); // one per resolution, reused
  mc.isolation = 0;
  // the field, lobe by lobe: each lobe only touches the cells within its reach (fast), then the flat base
  const f = mc.field, h = N / 2, D = new Float32Array(N * N * N).fill(1);
  const gx = (x) => cx + ((x - h) / h) * hx, gy = (y) => cy + ((y - h) / h) * hy, gz = (z) => cz + ((z - h) / h) * hz;
  const ix = (v, c, hh) => Math.round((v - c) / hh * h + h);
  L.forEach((l) => {
    const k = l.kb * l.r, ex = l.r * l.sx + k, ey = l.r * l.sy + k, ez = l.r * l.sz + k;
    const xa = Math.max(0, ix(l.x - ex, cx, hx) - 1), xb = Math.min(N - 1, ix(l.x + ex, cx, hx) + 1);
    const ya = Math.max(0, ix(l.y - ey, cy, hy) - 1), yb = Math.min(N - 1, ix(l.y + ey, cy, hy) + 1);
    const za = Math.max(0, ix(l.z - ez, cz, hz) - 1), zb = Math.min(N - 1, ix(l.z + ez, cz, hz) + 1);
    for (let z = za; z <= zb; z++) { const dz = (gz(z) - l.z) / l.sz; for (let y = ya; y <= yb; y++) { const dy = (gy(y) - l.y) / l.sy, row = y * N + z * N * N; for (let x = xa; x <= xb; x++) {
      const dx = (gx(x) - l.x) / l.sx, e = (Math.sqrt(dx * dx + dy * dy + dz * dz) - l.r) * l.m, q = x + row;
      D[q] = smin(D[q], e, k);
    } } }
  });
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) { const py = gy(y); for (let x = 0; x < N; x++) { const q = x + y * N + z * N * N; f[q] = -smax(D[q], -py, 0.12) * 40; } } // inside > 0
  mc.update();
  // weld the triangle soup (numeric keys on the [-1, 1] grid: much faster than string keys) and map to the box
  const n = mc.count, A = mc.positionArray, map = new Map(), idx = new Uint32Array(n), pos = [];
  for (let i = 0; i < n; i++) {
    const qx = Math.round((A[i * 3] + 1) * 32768), qy = Math.round((A[i * 3 + 1] + 1) * 32768), qz = Math.round((A[i * 3 + 2] + 1) * 32768);
    const key = (qx * 65537 + qy) * 65537 + qz;
    let j = map.get(key);
    if (j === undefined) { j = pos.length / 3; map.set(key, j); pos.push(cx + A[i * 3] * hx, cy + A[i * 3 + 1] * hy, cz + A[i * 3 + 2] * hz); }
    idx[i] = j;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // re-centre: resting on y = 0, x / z centred, 1 unit wide
  geo.computeBoundingBox();
  const bb = geo.boundingBox, sc = 1 / (bb.max.x - bb.min.x);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(sc, sc, sc);
  geo.computeVertexNormals();
  // crease occlusion (how quickly the field falls off along the normal) + height in the cloud
  geo.computeBoundingBox();
  const P = geo.attributes.position, Nm = geo.attributes.normal, H = geo.boundingBox.max.y, ao = new Float32Array(P.count), hh = new Float32Array(P.count);
  const ox = (bb.min.x + bb.max.x) / 2, oy = bb.min.y, oz = (bb.min.z + bb.max.z) / 2, rMean = L.reduce((a, l) => a + l.r, 0) / L.length;
  for (let i = 0; i < P.count; i++) {
    const lx = P.getX(i) / sc + ox, ly = P.getY(i) / sc + oy, lz = P.getZ(i) / sc + oz, d = rMean * 0.55;
    const s = field(L, lx + Nm.getX(i) * d, ly + Nm.getY(i) * d, lz + Nm.getZ(i) * d);
    ao[i] = Math.min(1, Math.max(0, s / d)); // 1 = open, lower in the creases between lobes
    hh[i] = P.getY(i) / H;
  }
  geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  geo.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
  geo.userData = { style, h: H, depth: (bb.max.z - bb.min.z) * sc };
  geo.computeBoundingSphere();
  geoCache.set(key, geo);
  CLOUD_STATS.models++; CLOUD_STATS.ms += performance.now() - t0; CLOUD_STATS.verts += P.count;
  return geo;
}
export const cloudModels = () => Object.keys(CLOUD_STYLES).map((s) => [s, 0]);

/* ---------------------------------------------------------------- material */
// clouds near the camera (zoomed far out, the camera flies among the outer ring) fade out: alpha in the colour pass
// (the cloud is still drawn with depth, after the opaque scene), and in the outline pass a cloud drops out once it is
// more than half gone (so a faded cloud leaves no ink)
const NEAR_FADE = /* glsl */ `
  float nearFade(vec3 w){ return smoothstep(70.0, 130.0, length(cameraPosition - w)); }`;
let LINE = null;
/** the outline pass's normal / depth material for the clouds (the same dither, so a faded cloud leaves no ink) */
function cloudLineMat() {
  return (LINE ||= new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN; varying float vZ; varying vec3 vW;
      void main(){
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        vN = normalize(transformedNormal); vZ = -mvPosition.z; vW = (modelMatrix * vec4(position, 1.0)).xyz;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying float vZ; varying vec3 vW;
      ${NEAR_FADE}
      void main(){ if (nearFade(vW) < 0.5) discard; vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n * 0.5 + 0.5, vZ); }`,
    side: THREE.DoubleSide,
  }));
}
/**
 * the clouds' environment, filled by env.js every frame: the sky dome's own colours (top / horizon / below), the sun's
 * colour, the sun and moon, and how much of the hour is day / sunset / night (weights adding up to 1), so the clouds
 * take their colours from the sky round them instead of a fixed palette
 */
export const CLOUD_U = {
  uSkyTop: { value: new THREE.Color('#3a82e6') }, uSkyMid: { value: new THREE.Color('#d6ecff') }, uSkyBot: { value: new THREE.Color('#8ec0f6') },
  uSunCol: { value: new THREE.Color('#fffbf0') }, uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uWDay: { value: 1 }, uWDusk: { value: 0 }, uWNight: { value: 0 }, uCloud: { value: 0 },
};
let MAT = null;
export function cloudMat() {
  if (MAT) return MAT;
  MAT = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSeasonTint: { value: new THREE.Vector3(1, 1, 1) } }]),
    vertexShader: /* glsl */ `
      attribute float aAO; attribute float aH;
      varying vec3 vN; varying vec3 vW; varying float vAO; varying float vH;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        w = modelMatrix * w; vW = w.xyz;
        mat3 nm = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          nm = nm * mat3(instanceMatrix);
        #endif
        vN = normalize(nm * normal); vAO = aAO; vH = aH;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyTop, uSkyMid, uSkyBot, uSunCol, uSunDir, uMoonDir, uSeasonTint;
      uniform float uSunVis, uMoonVis, uWDay, uWDusk, uWNight, uCloud;
      varying vec3 vN; varying vec3 vW; varying float vAO; varying float vH;
      #include <fog_pars_fragment>
      ${NEAR_FADE}
      vec3 hue(vec3 c){ return c / max(max(c.r, c.g), max(c.b, 1e-4)); } // a sky colour at full brightness
      void main(){
        float fade = nearFade(vW);
        if (fade < 0.01) discard;
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        vec3 L = normalize(uSunDir.y > -0.02 ? uSunDir : uMoonDir);
        // light: wrapped sun / moon + sky from above, darker in the creases and towards the flat base; three soft cel bands
        float lit = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0) * 0.62 + (n.y * 0.5 + 0.5) * 0.38;
        lit *= mix(0.72, 1.0, vAO) * mix(0.84, 1.0, smoothstep(0.0, 0.3, vH));
        float b1 = smoothstep(0.36, 0.44, lit), b2 = smoothstep(0.6, 0.68, lit);
        vec3 sun = hue(uSunCol), top = hue(uSkyTop), hor = hue(uSkyMid), low = hue(uSkyBot);
        // day: warm white light, blue-white mid tones, a shade that takes a little of the sky
        vec3 hiD = vec3(1.0, 0.985, 0.955), midD = vec3(0.9, 0.93, 0.985), shD = mix(vec3(0.74, 0.79, 0.92), uSkyMid, 0.2);
        // sunset: the lit side takes the low sun's colour, the mid tones the glowing horizon, the shade the violet sky
        // above it - the clouds glow in the same colours as the sky
        vec3 hiS = mix(vec3(1.0, 0.94, 0.86), sun, 0.55);
        vec3 midS = mix(sun, hor, 0.55) * 0.82 + 0.04;
        vec3 shS = mix(top, low, 0.4) * 0.5 + 0.05;
        // night: moonlit edges, the body in the night sky's own blue (lighter than the sky, never black)
        vec3 nt = mix(top, vec3(0.58, 0.63, 0.78), 0.5); // the night sky's blue, softened towards blue-grey
        vec3 hiN = mix(nt, vec3(0.8, 0.85, 0.96), 0.55) * (0.34 + 0.14 * uMoonVis);
        vec3 midN = mix(nt, low, 0.25) * 0.22;
        vec3 shN = nt * 0.13 + 0.01;
        vec3 hi = hiD * uWDay + hiS * uWDusk + hiN * uWNight;
        vec3 mid = midD * uWDay + midS * uWDusk + midN * uWNight;
        vec3 sh = shD * uWDay + shS * uWDusk + shN * uWNight;
        vec3 c = mix(mix(sh, mid, b1), hi, b2);
        // the flat underside catches the light from below (the sea, the horizon glow at sunset)
        c = mix(c, sh * mix(vec3(0.95, 0.98, 1.05), low * 1.1, uWDusk), smoothstep(-0.25, -0.75, n.y) * 0.55);
        // the rim: a silver lining by day, a gold-pink one against the low sun, a faint moonlit one at night
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0), back = 0.55 + 0.45 * max(dot(-V, L), 0.0);
        vec3 rim = vec3(0.3, 0.3, 0.28) * uWDay + sun * 0.5 * uWDusk + vec3(0.1, 0.13, 0.26) * uWNight;
        c += fr * back * rim * (0.45 + 0.55 * max(uSunVis, uMoonVis));
        // rain / overcast: heavier and greyer, closer to the sky, but still soft
        float lum = dot(c, vec3(0.3, 0.59, 0.11));
        c = mix(c, mix(vec3(lum), uSkyMid, 0.35) * 0.86, uCloud * 0.7);
        c *= uSeasonTint;
        // haze with distance (far clouds keep their shape but soften into the sky)
        c = mix(c, fogColor, 0.28 * smoothstep(180.0, 480.0, length(cameraPosition - vW)));
        gl_FragColor = vec4(min(c, vec3(1.0)), fade);
      }`,
    fog: true, transparent: true, depthWrite: true,
  });
  Object.assign(MAT.uniforms, CLOUD_U);
  return MAT;
}

/* ---------------------------------------------------------------- layout */
// [layer, group, count, distance range from the island centre, height range, width range (m), styles]. The ring stays
// low (seen from the usual raised camera a cloud on the far side then shows just above the tray's rim, and one on the
// near side stays below the town on screen); a band under the tray (the island floats on it); small puffs high or low
const LAYERS = [
  ['Background', 'Background', 11, [215, 285], [5, 60], [70, 110], ['cumulus', 'tower', 'billow', 'twin', 'shear', 'cotton']],
  ['Midground', 'Midground', 18, [105, 175], [0, 24], [32, 56], ['cumulus', 'twin', 'tail', 'terrace', 'castle', 'billow', 'shear', 'cotton', 'tower']],
  ['Below', 'Midground', 7, [95, 145], [-62, -34], [30, 50], ['cumulus', 'billow', 'streak', 'tail', 'twin']],
  ['Detail', 'Detail', 12, [95, 230], [-62, 95], [9, 18], ['puff', 'tuft', 'streak', 'tail', 'cotton']],
];
const SPEED = { Background: 0.45, Midground: 0.7, Below: 0.6, Detail: 1 }; // wander rate (big slowest)

/** would a cloud at p (bounding radius r) ever sit in front of the town from the camera's usual orbit? */
function blocksTown(p, r, centre) {
  const cam = new THREE.PerspectiveCamera(30, 1.45, 1, 1000), T = new THREE.Vector3(centre[0], -1.5, centre[1]);
  const town = 50, v = new THREE.Vector3(), q = new THREE.Vector3();
  for (const dist of [175, 240]) for (const pol of [40, 51, 63, 74]) for (let az = 0; az < 360; az += 20) { // the usual orbit (zoomed in, the clouds are behind the camera)
    cam.position.setFromSpherical(new THREE.Spherical(dist, THREE.MathUtils.degToRad(pol), THREE.MathUtils.degToRad(az))).add(T);
    cam.lookAt(T); cam.updateMatrixWorld();
    const dc = cam.position.distanceTo(p);
    if (dc > cam.position.distanceTo(T) + town * 0.4) continue; // behind the town: the island hides it, it hides nothing
    v.copy(p).project(cam); q.copy(T).project(cam);
    const k = 1 / Math.tan(THREE.MathUtils.degToRad(15)); // NDC per unit of (size / distance), vertical
    const rc = (r / dc) * k, rt = (town / cam.position.distanceTo(T)) * k;
    if (Math.abs(v.x) > 1.3 || Math.abs(v.y) > 1.3) continue; // off screen
    if (Math.hypot((v.x - q.x) * 1.45, v.y - q.y) < rc + rt) return true;
  }
  return false;
}

export function buildClouds(parent, centre = [-6, -6]) {
  const mat = cloudMat();
  const root = new THREE.Group(); root.name = 'CloudRoot'; parent.add(root);
  const R = rng(3141), list = [];
  const groups = {};
  LAYERS.forEach(([name, gname, count, [r0, r1], [y0, y1], [w0, w1], styles], li) => {
    const g = groups[gname] || (groups[gname] = Object.assign(new THREE.Group(), { name: `Cloud_${gname}_Group` }));
    root.add(g);
    let made = 0;
    for (let tries = 0; made < count && tries < 600; tries++) {
      const a = (made / count) * Math.PI * 2 + R() * (Math.PI * 2 / count) + li * 0.7; // spread all round
      const d = r0 + R() * (r1 - r0), w = w0 + Math.pow(R(), 1.3) * (w1 - w0);
      let y = y0 + R() * (y1 - y0);
      if (name === 'Detail' && y > -30 && y < 30) y = y < 0 ? y - 32 : y + 32; // not level with the tray (hidden there)
      const style = styles[(R() * styles.length) | 0], v = R() < 0.5 ? 0 : 1, geo = cloudGeo(style, v); // two variants of each style
      const p = new THREE.Vector3(centre[0] + Math.cos(a) * d, y, centre[1] + Math.sin(a) * d);
      const br = w * 0.55 + 6; // bounding radius + its wander
      if (blocksTown(new THREE.Vector3(p.x, p.y + geo.userData.h * w * 0.5, p.z), br, centre)) continue;
      if (list.some((c) => c.p.distanceTo(p) < (c.w + w) * 0.55)) continue; // no two clouds overlapping
      const m = new THREE.Mesh(geo, mat);
      m.scale.setScalar(w); m.scale.y *= 0.9 + R() * 0.25; m.scale.z *= 0.85 + R() * 0.35;
      m.rotation.y = -a + Math.PI / 2 + (R() - 0.5) * 0.9; // mostly broadside to the island, so its long side shows
      m.userData.noRefl = true; m.userData.lineMat = cloudLineMat(); m.frustumCulled = true; // outline pass: a soft silhouette, nothing behind draws through
      reg.noRefl.push(m); g.add(m);
      const sp = SPEED[name];
      list.push({ m, p, w, ry: m.rotation.y, ph: R() * 6.28, ph2: R() * 6.28, A: (2 + R() * 3) * (li === 0 ? 1.4 : 1), om: (0.035 + R() * 0.02) * sp, bob: 0.25 + R() * 0.35 });
      made++;
    }
  });
  // gentle motion: a slow wander round each cloud's place, a little bob and sway (no orbit: the layout stays clear
  // of the town)
  const place = (c, t) => {
    const s = t * c.om;
    c.m.position.set(c.p.x + Math.sin(s + c.ph) * c.A, c.p.y + Math.sin(t * 0.11 + c.ph2) * c.bob, c.p.z + Math.cos(s * 0.8 + c.ph) * c.A * 0.7);
    c.m.rotation.y = c.ry + Math.sin(s * 0.6 + c.ph2) * 0.04;
  };
  list.forEach((c) => place(c, 0));
  // a faint seasonal cast: spring a touch pink, autumn a touch warm, winter a touch cool
  const tint = mat.uniforms.uSeasonTint.value;
  reg.updaters.push((t) => {
    list.forEach((c) => place(c, t));
    const W = SEASON_U.W.value;
    tint.set(1 + 0.0 * W.x + 0.01 * W.z - 0.025 * W.w, 1 - 0.012 * W.x - 0.005 * W.z - 0.01 * W.w, 1 - 0.0 * W.x - 0.03 * W.z + 0.015 * W.w);
  });
  reg.clouds = { g: root, list };
  return root;
}
