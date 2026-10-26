import * as THREE from 'three';
import { reg, toon, glow, cy, grp, halo, pl } from '../core.js';
import { makeWater, BED_PLAIN, WATER_U } from '../waterSystem.js';
import { SEASON_U } from '../tree.js';
import { ct, txt, SERIF } from './shopkit.js';

/* ====================================================================================================
   The sakura plaza's fountain (town/plaza.js): a low round pool of pale stone with softly bevelled rims, a pedestal
   with a small overflowing bowl, a slim central jet and eight low arcs curving in towards the pedestal.

     streams   translucent tubes (one draw for the eight arcs, one for the column, one for the bowl's overflow sheet):
               they taper and swell as the water pulses through, catch the sun, and break into drops near their ends
     drops     one Points draw, all motion in the vertex shader (no per-frame CPU work): the column's crown falling
               back into the bowl, drops along the arcs, small splashes where they land, drips off the bowl's lip
     water     the town's shared water (waterSystem.js, 'fountain' preset): clear over the pale stone floor, rings
               spreading from each arc's landing point and from under the bowl's falling sheet, rain rings, fresnel
               sky reflection, sun glints, a soft warm-white underwater glow at night
     seasons   in winter the fountain is shut off: the jets stop and the water lies calm (the rims take snow)
   ==================================================================================================== */

const R_OUT = 1.62, R_IN = 1.38, RIM = 0.44, WATER = 0.33;
const G = 4.0; // a gentle "gravity" for a quiet, light fountain
const LAND = 0.64, NOZ = 1.24, ARCH = 0.4, NARC = 8, TOP = 1.42, BOWL = 0.76;

const T = { value: 0 }, ON = { value: 1 }, NIGHT = { value: 0 }, DAY = { value: 1 };

/* ---------------------------------------------------------------- materials */
/**
 * a stream of water. kind 'arc' (along the tube from nozzle to landing), 'column' (up from the bowl), 'sheet' (down off
 * the bowl's lip); r: its radius. The water pulses along it (it swells a little where a pulse passes), the sun catches it,
 * and near its end it breaks into drops.
 */
function streamMat(kind, r) {
  const sExpr = kind === 'arc' ? 'uv.x' : kind === 'column' ? 'uv.y' : '1.0 - uv.y';
  const sp = { arc: '1.6', column: '2.4', sheet: '1.2' }[kind], brk = { arc: '0.72', column: '0.8', sheet: '0.9' }[kind];
  return new THREE.ShaderMaterial({
    uniforms: { uTime: T, uOn: ON, uNight: NIGHT, uDay: DAY, uSunDir: WATER_U.uSunDir, uSunVis: WATER_U.uSunVis },
    vertexShader: /* glsl */ `
      uniform float uTime; varying float vS; varying vec3 vN; varying vec3 vW;
      void main() {
        vS = ${sExpr};
        float flow = vS * 6.0 - uTime * ${sp} * 2.0;
        float swell = 1.0 + 0.18 * sin(flow * 6.2832) * ${kind === 'sheet' ? '0.3' : '1.0'};
        vec3 p = position + normal * ${r.toFixed(3)} * (swell - 1.0);
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
        vec3 nn = mat3(modelMatrix) * normal; vN = nn / max(length(nn), 1e-5);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOn, uNight, uDay, uSunVis; uniform vec3 uSunDir;
      varying float vS; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW), n = vN / max(length(vN), 1e-5);
        float rim = clamp(1.0 - abs(dot(n, V)), 0.0, 1.0);
        float flow = vS * 6.0 - uTime * ${sp} * 2.0;
        float pulse = 0.72 + 0.28 * sin(flow * 6.2832 + sin(flow * 2.3) * 1.4);
        // near the end the stream breaks into drops
        float brk = smoothstep(${brk}, 1.0, vS), drops = step(0.4, fract(flow * 2.0 + sin(flow * 3.7) * 0.25));
        vec3 H = normalize(normalize(uSunDir) + V + vec3(0.0, 1e-4, 0.0));
        float spec = pow(clamp(dot(n, H), 0.0, 1.0), 140.0) * uSunVis * 0.5; // a thin glint, kept low (bloom)
        float a = ((0.14 + 0.5 * rim) * pulse + spec * 0.5) * mix(1.0, drops, brk) * uOn;
        vec3 col = mix(vec3(0.76, 0.92, 0.95), vec3(1.0), rim * 0.6) * mix(0.4, 1.0, uDay) * 0.9 + spec * 0.5 + uNight * vec3(1.0, 0.9, 0.72) * 0.32;
        if (isnan(a) || isnan(col.x + col.y + col.z)) discard; // never hand the bloom a NaN
        gl_FragColor = vec4(clamp(col, 0.0, 2.0), clamp(a, 0.0, 0.95));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

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
  cy(g, toon('#cfc8b8', { lit: 0.04 }), 0, -0.02, 0, R_IN + 0.01, 0.06, 56); // pale stone under the clear water
  for (let k = 0; k < NARC; k++) { const a = (k / NARC) * Math.PI * 2; cy(g, toon('#8a7350'), Math.cos(a) * NOZ, WATER - 0.06, Math.sin(a) * NOZ, 0.022, 0.09, 8); }
  // the pedestal and the little bowl
  lathe([[0.0, 0.03], [0.3, 0.03], [0.3, 0.08], [0.22, 0.14], [0.16, 0.22], [0.14, 0.5], [0.18, 0.6], [0.32, 0.66], [0.47, BOWL - 0.03], [0.53, BOWL], [0.5, BOWL + 0.015], [0.44, BOWL - 0.01], [0.0, BOWL - 0.05]], 48);
  cy(g, toon('#8a7350'), 0, BOWL - 0.04, 0, 0.035, 0.06, 10);
  // underwater lights (warm white, on at dusk with the street lamps)
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; cy(g, glow('#fff1d6', 2.2, { cat: 'lamp', off: '#6f8a88' }), Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62, 0.06, 0.02, 12); }
  halo(g, 0, WATER + 0.05, 0, '#ffeacc', 3.0, 0.22, 'lamp');

  // water: pool + bowl
  // the shared water ('fountain' preset): ripple sources at the arcs' landing points + under the bowl's falling sheet,
  // set in world space on the first draw (the plaza places the fountain)
  const poolMat = makeWater('fountain', { bed: BED_PLAIN, depth: 'float wDepth(vec2 p){ return 0.3; }', srcOn: ON });
  const bowlMat = makeWater('fountain', { bed: BED_PLAIN, depth: 'float wDepth(vec2 p){ return 0.06; }', srcOn: ON, preset: { alphaDeep: 0.6 } });
  const water = new THREE.Mesh(new THREE.CircleGeometry(R_IN + 0.005, 72).rotateX(-Math.PI / 2), poolMat);
  water.position.y = WATER; water.renderOrder = 3; water.userData.noLine = true; g.add(water);
  const bw = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40).rotateX(-Math.PI / 2), bowlMat);
  bw.position.y = BOWL - 0.012; bw.renderOrder = 3; bw.userData.noLine = true; g.add(bw);
  {
    let done = false;
    water.onBeforeRender = () => {
      if (done) return;
      done = true;
      const c = g.localToWorld(new THREE.Vector3(0, 0, 0)), U = poolMat.uniforms, B = bowlMat.uniforms;
      for (let k = 0; k < NARC; k++) { const a = (k / NARC) * Math.PI * 2, p = g.localToWorld(new THREE.Vector3(Math.cos(a) * LAND, 0, Math.sin(a) * LAND)); U.uSrc.value[k].set(p.x, p.z, 0.8, 0); }
      U.uSrc.value[NARC].set(c.x, c.z, 0.7, 0.56); U.uNSrc.value = NARC + 1;
      B.uSrc.value[0].set(c.x, c.z, 0.9, 0); B.uNSrc.value = 1;
      [U, B].forEach((u, i) => { u.uGlow.value.set(c.x, c.z, i ? 0.4 : 0.9, i ? 0.25 : 0.45); u.uGlowCol.value.set('#fff1d6'); });
    };
  }

  // streams: the eight arcs (one geometry), the column, the bowl's overflow sheet
  const arcs = [];
  for (let k = 0; k < NARC; k++) {
    const a = (k / NARC) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a), P = [];
    for (let i = 0; i <= 16; i++) { const s = i / 16, r = NOZ + (LAND - NOZ) * s; P.push(new THREE.Vector3(cx * r, WATER + 0.02 + 4 * ARCH * s * (1 - s), cz * r)); }
    arcs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), 40, 0.013, 6, false));
  }
  const merged = mergeTubes(arcs);
  const streams = [
    new THREE.Mesh(merged, streamMat('arc', 0.013)),
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.034, TOP - BOWL, 10, 12, true).translate(0, (TOP + BOWL) / 2, 0), streamMat('column', 0.024)),
    new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.58, BOWL - WATER, 40, 6, true).translate(0, (BOWL + WATER) / 2, 0), streamMat('sheet', 0.02)),
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
    if (Gu) { DAY.value = Gu.uDay.value; NIGHT.value = 1 - Gu.uDay.value; }
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
