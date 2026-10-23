import * as THREE from 'three';
import { reg, toon, glow, cy, grp, halo, pl } from '../core.js';
import { GLASS_U } from '../fx.js';
import { SEASON_U } from '../tree.js';
import { ct, txt, SERIF } from './shopkit.js';

/* ====================================================================================================
   The sakura plaza's fountain (town/plaza.js): a low round pool of pale stone with softly bevelled rims, a pedestal
   with a small overflowing bowl, a slim central jet and eight low arcs curving in towards the pedestal.

     streams   translucent tubes with a flowing stripe (one draw for the eight arcs, one for the column, one for the
               bowl's overflow sheet)
     drops     one Points draw, all motion in the vertex shader (no per-frame CPU work): the column's crown falling
               back into the bowl, drops along the arcs, small splashes where they land, drips off the bowl's lip
     water     translucent blue-green with moving rings round the landing ring, rain rings when it rains, a fresnel
               sky reflection, small sparkles by day and a soft warm-white underwater glow at night
     seasons   in winter the fountain is shut off: the jets stop and the water lies calm (the rims take snow)
   ==================================================================================================== */

const R_OUT = 1.62, R_IN = 1.38, RIM = 0.44, WATER = 0.33;
const G = 4.0; // a gentle "gravity" for a quiet, light fountain
const LAND = 0.64, NOZ = 1.24, ARCH = 0.4, NARC = 8, TOP = 1.42, BOWL = 0.76;

const T = { value: 0 }, ON = { value: 1 }, NIGHT = { value: 0 }, RAIN = { value: 0 }, DAY = { value: 1 };

/* ---------------------------------------------------------------- materials */
/** the water surface; o.centre: the surface's centre in its geometry's x / z, o.rings: the fountain's moving rings,
    o.glow: the strength of the underwater light at night */
function waterMat(radius, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: T, uOn: ON, uNight: NIGHT, uRain: RAIN, uDay: DAY, uR: { value: radius }, uSky: GLASS_U.uSkyCol, uC: { value: new THREE.Vector2(...(o.centre || [0, 0])) }, uRing: { value: o.rings === false ? 0 : 1 }, uGlowK: { value: o.glow ?? 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vP; varying vec3 vW;
      void main() { vP = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOn, uNight, uRain, uDay, uR, uRing, uGlowK; uniform vec3 uSky; uniform vec2 uC;
      varying vec2 vP; varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float d = length(vP - uC), r = min(1.0, d / uR);
        // rings: round the landing ring of the arcs (pool) / from the centre (bowl)
        float src = uR > 1.0 ? ${LAND.toFixed(2)} : 0.0;
        float h = uRing * uOn * sin(d * 30.0 - uTime * 5.0) * exp(-abs(d - src) * 2.6);
        // rain: little rings popping up in cells
        vec2 q = vP * 4.0, cell = floor(q), f = fract(q) - 0.5;
        float rnd = hash(cell), ph = fract(uTime * 0.85 + rnd);
        vec2 c = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
        float rain = smoothstep(0.05, 0.0, abs(length(f - c) - ph * 0.42)) * (1.0 - ph) * uRain;
        float lines = smoothstep(0.55, 0.95, h) * 0.55 + rain * 0.6;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        vec3 deep = vec3(0.16, 0.38, 0.42), light = vec3(0.5, 0.78, 0.8);
        vec3 col = mix(deep, light, 0.35 + 0.35 * (1.0 - r));
        col = mix(col, uSky, fres * 0.55);
        col = mix(col, col * 0.82 + 0.04, 1.0 - uOn) ; // calm, a little greyer when the fountain is off
        col += lines * vec3(0.85, 0.95, 1.0) * (0.35 + 0.65 * uDay);
        float sp = pow(hash(floor(vP * 40.0) + floor(uTime * 6.0)), 40.0) * uDay * (0.4 + uOn);
        col += sp * 0.8;
        col *= mix(0.42, 1.0, uDay); // the water darkens with the evening; the light below then carries it
        // night: the warm-white underwater light
        col += uNight * uGlowK * vec3(1.0, 0.88, 0.68) * (0.42 * exp(-r * 1.7) + lines * 0.35);
        gl_FragColor = vec4(col, 0.8 + fres * 0.15);
      }`,
    transparent: true,
    depthWrite: false,
  });
}
function streamMat(vertical) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: T, uOn: ON, uNight: NIGHT },
    vertexShader: /* glsl */ `
      varying float vS; varying float vF;
      void main() {
        vS = ${vertical ? '1.0 - uv.y' : 'uv.x'};
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vF = 1.0 - abs(dot(n, normalize(cameraPosition - w.xyz)));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOn, uNight; varying float vS; varying float vF;
      void main() {
        float stripe = 0.72 + 0.28 * sin(vS * ${vertical ? '34.0' : '58.0'} - uTime * ${vertical ? '9.0' : '13.0'});
        float a = (0.22 + 0.5 * vF) * stripe * uOn;
        vec3 col = mix(vec3(0.74, 0.92, 0.95), vec3(1.0), vF * 0.6) + uNight * vec3(1.0, 0.9, 0.72) * 0.3;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** the same water for a still garden pond (town/villa.js): sky reflection, rain rings, sparkles, a soft night glow */
export function pondWaterMat(cx, cz, radius) { return waterMat(radius, { centre: [cx, cz], rings: false, glow: 0.35 }); }

/* ---------------------------------------------------------------- drops (one Points draw, motion in the shader) */
function drops() {
  const O = [], Vv = [], A = [];
  const add = (o, v, phase, life, size) => { O.push(...o); Vv.push(...v); A.push(phase, life, size); };
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const vy0 = Math.sqrt(2 * G * ARCH), Tarc = (2 * vy0) / G, vx = (NOZ - LAND) / Tarc;
  for (let k = 0; k < NARC; k++) {
    const a = (k / NARC) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    // drops along each arc
    for (let i = 0; i < 18; i++) add([cx * NOZ, WATER + 0.02, cz * NOZ], [-cx * vx, vy0, -cz * vx], i / 18 + rnd() * 0.02, Tarc, 0.028);
    // little splashes where it lands
    for (let i = 0; i < 8; i++) { const b = a + (rnd() - 0.5) * 0.4, up = 0.35 + rnd() * 0.35; add([Math.cos(b) * LAND, WATER, Math.sin(b) * LAND], [Math.cos(b) * (rnd() - 0.3) * 0.25, up, Math.sin(b) * (rnd() - 0.3) * 0.25], rnd(), (2 * up) / G, 0.02); }
  }
  // the column's crown: up from the bowl and back into it
  const vc = Math.sqrt(2 * G * (TOP - BOWL));
  for (let i = 0; i < 120; i++) { const b = rnd() * Math.PI * 2, rr = 0.06 + rnd() * 0.22, up = vc * (0.88 + rnd() * 0.12); add([0, BOWL, 0], [Math.cos(b) * rr, up, Math.sin(b) * rr], rnd(), (2 * up) / G, 0.032); }
  // drips off the bowl's lip
  const tl = Math.sqrt((2 * (BOWL - WATER)) / G);
  for (let i = 0; i < 40; i++) { const b = (i / 40) * Math.PI * 2 + rnd() * 0.1; add([Math.cos(b) * 0.52, BOWL - 0.01, Math.sin(b) * 0.52], [Math.cos(b) * 0.12, 0, Math.sin(b) * 0.12], rnd(), tl, 0.022); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(O, 3));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(Vv, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(A, 3));
  const SC = { value: 800 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: T, uOn: ON, uNight: NIGHT, uScale: SC },
    vertexShader: /* glsl */ `
      uniform float uTime, uOn, uScale; attribute vec3 aV; attribute vec3 aT; varying float vA;
      void main() {
        float t = fract(uTime / aT.y + aT.x) * aT.y;
        vec3 p = position + aV * t + vec3(0.0, -0.5 * ${G.toFixed(1)} * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float k = t / aT.y;
        vA = (1.0 - k * k * k) * uOn;
        gl_PointSize = max(1.0, aT.z * uScale / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight; varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
        if (d > 0.25 || vA < 0.01) discard;
        vec3 col = vec3(0.88, 0.97, 1.0) + uNight * vec3(1.0, 0.88, 0.66) * 0.35;
        gl_FragColor = vec4(col, vA * (1.0 - d * 3.2) * 0.85);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.noLine = true;
  pts.onBeforeRender = (renderer, scene, camera) => { const h = renderer.getContext().drawingBufferHeight; SC.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 30) / 2)); };
  return pts;
}

/* ---------------------------------------------------------------- the fountain */
export function buildFountain(parent, x, y, z) {
  const g = grp(parent, x, y, z);
  g.name = 'fountain';
  const stone = toon('#e3ddd0', { lit: 0.06, nocache: true, side: THREE.DoubleSide });
  const lathe = (pts, seg = 64) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), stone); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  // the pool: rim with soft bevels, the floor, nozzles
  lathe([[R_IN - 0.01, 0.02], [R_IN, 0.06], [R_IN, RIM - 0.05], [R_IN + 0.02, RIM - 0.015], [R_IN + 0.06, RIM], [R_OUT - 0.06, RIM], [R_OUT - 0.015, RIM - 0.015], [R_OUT, RIM - 0.06], [R_OUT, 0.1], [R_OUT + 0.04, 0.04], [R_OUT + 0.05, -0.14]]); // the foot reaches below the gently falling paving
  cy(g, toon('#5c7774', { lit: 0.04 }), 0, -0.02, 0, R_IN + 0.01, 0.06, 56);
  for (let k = 0; k < NARC; k++) { const a = (k / NARC) * Math.PI * 2; cy(g, toon('#8a7350'), Math.cos(a) * NOZ, WATER - 0.06, Math.sin(a) * NOZ, 0.022, 0.09, 8); }
  // the pedestal and the little bowl
  lathe([[0.0, 0.03], [0.3, 0.03], [0.3, 0.08], [0.22, 0.14], [0.16, 0.22], [0.14, 0.5], [0.18, 0.6], [0.32, 0.66], [0.47, BOWL - 0.03], [0.53, BOWL], [0.5, BOWL + 0.015], [0.44, BOWL - 0.01], [0.0, BOWL - 0.05]], 48);
  cy(g, toon('#8a7350'), 0, BOWL - 0.04, 0, 0.035, 0.06, 10);
  // underwater lights (warm white, on at dusk with the street lamps)
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; cy(g, glow('#fff1d6', 2.2, { cat: 'lamp', off: '#6f8a88' }), Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62, 0.06, 0.02, 12); }
  halo(g, 0, WATER + 0.05, 0, '#ffeacc', 3.0, 0.22, 'lamp');

  // water: pool + bowl
  const water = new THREE.Mesh(new THREE.CircleGeometry(R_IN + 0.005, 72).rotateX(-Math.PI / 2), waterMat(R_IN));
  water.position.y = WATER; water.renderOrder = 3; water.userData.noLine = true; g.add(water);
  const bw = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40).rotateX(-Math.PI / 2), waterMat(0.45));
  bw.position.y = BOWL - 0.012; bw.renderOrder = 3; bw.userData.noLine = true; g.add(bw);

  // streams: the eight arcs (one geometry), the column, the bowl's overflow sheet
  const arcs = [];
  for (let k = 0; k < NARC; k++) {
    const a = (k / NARC) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a), P = [];
    for (let i = 0; i <= 16; i++) { const s = i / 16, r = NOZ + (LAND - NOZ) * s; P.push(new THREE.Vector3(cx * r, WATER + 0.02 + 4 * ARCH * s * (1 - s), cz * r)); }
    arcs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), 28, 0.013, 5, false));
  }
  const merged = mergeTubes(arcs);
  const streams = [
    new THREE.Mesh(merged, streamMat(false)),
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.034, TOP - BOWL, 10, 1, true).translate(0, (TOP + BOWL) / 2, 0), streamMat(true)),
    new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.58, BOWL - WATER, 40, 1, true).translate(0, (BOWL + WATER) / 2, 0), streamMat(true)),
  ];
  streams.forEach((m) => { m.renderOrder = 4; m.userData.noLine = true; g.add(m); reg.noRefl.push(m); });
  const pts = drops(); pts.renderOrder = 5; g.add(pts); reg.noRefl.push(pts);

  // the small inscription tablet set into the rim, facing the south bench
  {
    const tex = ct('fountainPlate', 256, 112, (c, w, h) => { c.fillStyle = '#5d5750'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b9ad98'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16); txt(c, 'さくら広場の泉', w / 2, 44, 30, '#efe6d2', { font: SERIF }); txt(c, 'SAKURA FOUNTAIN  ·  2026', w / 2, 82, 16, '#d8c8a8', { font: SERIF, weight: 600 }); });
    const p = pl(g, toon('#ffffff', { map: tex, nocache: true, lit: 0.1 }), 0.46, 0.2, 0, 0.24, R_OUT + 0.012, 0, 0); p.userData.noLine = true;
  }

  // shared uniforms: time, the season switch (off in winter), night glow, rain rings
  reg.updaters.push((t, dt) => {
    T.value = t;
    const want = 1 - THREE.MathUtils.smoothstep(SEASON_U.W.value.w, 0.3, 0.7);
    ON.value += (want - ON.value) * Math.min(1, (dt || 0.016) * 1.5);
    const Gu = reg.groundU;
    if (Gu) { DAY.value = Gu.uDay.value; NIGHT.value = 1 - Gu.uDay.value; RAIN.value = Gu.uRipple.value; }
    const vis = ON.value > 0.01;
    streams.forEach((m) => (m.visible = vis)); pts.visible = vis;
  });
  return g;
}

/** merge tube geometries (same attributes) into one */
function mergeTubes(list) {
  let nv = 0, ni = 0;
  list.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  list.forEach((g) => {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); uv.set(g.attributes.uv.array, ov * 2);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
    ov += g.attributes.position.count; oi += ix.length; g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
