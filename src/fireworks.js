import * as THREE from 'three';
import { reg, rng } from './core.js';

/* ====================================================================================================
   Distant fireworks (GPU points). A small pool of bursts is recycled; every burst is: rocket trail ->
   explosion (peony / ring / willow) -> fade. The system also reports the colour + strength of the most
   recent flash so the environment can light the wet ground, glass and air with it.
   Rules live in env.js (holiday, night, weather); this file only knows how to draw and schedule.
   ==================================================================================================== */

const POOL = 5;

const VS = /* glsl */ `
  uniform float uT; uniform vec3 uC; uniform float uScale; uniform float uR; uniform float uG; uniform float uType; uniform mat3 uRot; uniform float uSeed;
  varying float vA; varying float vMix; varying float vSpark;
  float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  void main(){
    vec3 d = normalize(position);
    float id = h11(dot(position, vec3(12.9, 78.2, 37.7)) + uSeed);
    if (uType > 0.5 && uType < 1.5) { d = normalize(vec3(d.x, d.y * 0.1, d.z)); d = uRot * d; }   // ring
    float speed = uType > 1.5 ? 0.72 + 0.28 * id : 0.82 + 0.18 * id;                              // willow: lazier
    float r = uR * speed * (1.0 - exp(-uT * 3.0));
    vec3 p = uC + d * r;
    p.y -= uG * uT * uT * (uType > 1.5 ? 1.6 : 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float fadeStart = uType > 1.5 ? 0.55 : 0.4;
    vA = (1.0 - smoothstep(fadeStart, 1.0, uT)) * step(0.0, uT) * step(uT, 1.0);
    vMix = smoothstep(0.15, 0.75, uT);
    vSpark = 0.55 + 0.45 * sin(uT * 38.0 + id * 40.0);
    gl_PointSize = max(2.0, uScale * 0.2 / -mv.z) * (1.15 - 0.55 * uT);
  }`;
const FS = /* glsl */ `
  uniform vec3 uCol; uniform vec3 uCol2; varying float vA; varying float vMix; varying float vSpark;
  void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
    vec3 c = mix(uCol, uCol2, vMix);
    gl_FragColor = vec4(c * 2.4 * vSpark, smoothstep(0.5, 0.05, d) * vA); }`;

const RVS = /* glsl */ `
  uniform float uL; uniform vec3 uBase; uniform vec3 uC; uniform float uScale; varying float vA;
  void main(){
    float k = position.x;                         // 0 = head, 1 = tail
    float head = uL;
    float s = clamp(head - k * 0.22, 0.0, 1.0);
    vec3 p = mix(uBase, uC, s);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (1.0 - k) * step(uL, 1.0) * step(0.0, uL) * (1.0 - k * 0.5);
    gl_PointSize = max(1.6, uScale * 0.1 / -mv.z) * (1.0 - 0.6 * k);
  }`;
const RFS = /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * 2.0, smoothstep(0.5, 0.05, d) * vA); }`;

export function createFireworks(parent) {
  const group = new THREE.Group();
  group.visible = false;
  parent.add(group);

  const R = rng(404);
  const dirs = [];
  for (let i = 0; i < 170; i++) { const a = R() * 6.283, b = Math.acos(2 * R() - 1); dirs.push(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)); }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, (_, i) => [i / 11, 0, 0]).flat(), 3));

  const bursts = [];
  for (let k = 0; k < POOL; k++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(dirs, 3));
    const u = { uT: { value: 2 }, uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() }, uC: { value: new THREE.Vector3() }, uScale: { value: 600 }, uR: { value: 6 }, uG: { value: 2.2 }, uType: { value: 0 }, uRot: { value: new THREE.Matrix3() }, uSeed: { value: k * 3.7 } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    pts.userData.noLine = true; // (not in noRefl: wet ground and glass mirror the fireworks)
    group.add(pts);
    const ru = { uL: { value: 2 }, uBase: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uScale: { value: 600 } };
    const rk = new THREE.Points(trailGeo, new THREE.ShaderMaterial({ uniforms: ru, vertexShader: RVS, fragmentShader: RFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    rk.frustumCulled = false; rk.userData.noLine = true;
    group.add(rk);
    bursts.push({ u, ru, age: 99, dur: 2.6, launch: 0.7, col: new THREE.Color() });
  }

  const state = { color: new THREE.Color(0, 0, 0), strength: 0, lastBurst: -99, count: 0 };
  let timer = 1.5;
  const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _c2 = new THREE.Color();

  /** cfg: {rate, palette[], types[], scale} blended from the active holidays; gate 0..1 (night, weather); returns state */
  function update(t, dt, cfg, gate, px) {
    const on = gate > 0.05 && cfg && cfg.rate > 0.005;
    group.visible = on || bursts.some((b) => b.age < b.dur);
    if (on) {
      timer -= dt * cfg.rate * gate;
      if (timer <= 0) {
        const b = bursts.find((x) => x.age >= x.dur);
        if (b) {
          timer = 0.6 + Math.random() * 1.8;
          b.age = 0;
          const type = cfg.types[(Math.random() * cfg.types.length) | 0];
          const sc = cfg.scale * (0.8 + Math.random() * 0.5);
          const cx = -22 + Math.random() * 26, cy = 8 + Math.random() * 3.5, cz = -10 - Math.random() * 6;
          b.u.uC.value.set(cx, cy, cz);
          b.ru.uC.value.copy(b.u.uC.value);
          b.ru.uBase.value.set(cx + (Math.random() - 0.5) * 3, 1.5, cz - 2);
          b.u.uR.value = 3.6 * sc;
          b.u.uG.value = type === 2 ? 3.4 : 1.8;
          b.u.uType.value = type;
          _e.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6);
          _m.makeRotationFromEuler(_e);
          b.u.uRot.value.setFromMatrix4(_m);
          b.u.uSeed.value = Math.random() * 50;
          const c1 = cfg.palette[(Math.random() * cfg.palette.length) | 0];
          b.u.uCol.value.set(c1);
          b.u.uCol2.value.set(cfg.palette[(Math.random() * cfg.palette.length) | 0]).lerp(_c2.set('#ffffff'), 0.2);
          b.col.set(c1);
          b.dur = 3.0; b.launch = 0.75;
        }
      }
    }
    let best = 0;
    bursts.forEach((b) => {
      if (b.age >= b.dur) { b.u.uT.value = 2; b.ru.uL.value = 2; return; }
      b.age += dt;
      b.u.uScale.value = px; b.ru.uScale.value = px;
      const lt = b.age / b.launch;
      b.ru.uL.value = lt <= 1 ? lt : 2;
      const bt = (b.age - b.launch) / (b.dur - b.launch);
      b.u.uT.value = bt < 0 ? -1 : bt;
      // flash light: bright at the moment of the burst, decaying
      if (b.age > b.launch) {
        const k = Math.exp(-(b.age - b.launch) * 2.4);
        if (k > best) { best = k; state.color.copy(b.col); }
        if (b.age - b.launch < dt * 1.5) { state.lastBurst = t; state.count++; }
      }
    });
    state.strength = best;
    return state;
  }
  return { group, update, state };
}
