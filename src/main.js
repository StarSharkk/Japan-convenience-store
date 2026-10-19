import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { reg, canvasTex, rng } from './core.js';
import { createPipeline } from './post.js';
import { buildWorld } from './world.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const LEVELS = [0.7, 0.85, 1, 1.25, 1.5, 1.75, 2].filter((l) => l <= DPR + 0.01);
let lvl = Math.min(LEVELS.length - 1, LEVELS.findIndex((l) => l >= Math.min(DPR, 1.25)));
if (lvl < 0) lvl = LEVELS.length - 1;
let PR = LEVELS[lvl];
renderer.setPixelRatio(PR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2144, 0.0038);

/* ---- backdrop: deep indigo night with distant bokeh city lights ---- */
scene.background = canvasTex(
  1024,
  1024,
  (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#080b24');
    gr.addColorStop(0.45, '#161a42');
    gr.addColorStop(0.8, '#271f4f');
    gr.addColorStop(1, '#332552');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const R = rng(5);
    const cols = ['255,170,90', '120,200,255', '255,100,170', '170,140,255', '255,230,150'];
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = h * (0.62 + R() * 0.38), r = 6 + R() * 22;
      const c = cols[(R() * cols.length) | 0];
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${c},${0.10 + R() * 0.12})`);
      rg.addColorStop(0.7, `rgba(${c},${0.05 + R() * 0.05})`);
      rg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  },
  { aniso: 1 }
);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 400);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 9;
controls.maxDistance = 120;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.015;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.screenSpacePanning = true;
const TARGET = new THREE.Vector3(0.6, 1.9, -0.2);
controls.target.copy(TARGET);
const clampPan = () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -11, 11);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -11, 11);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, -0.5, 9);
};
controls.addEventListener('change', clampPan);

// start pose (SE, elevated) with a slow intro dolly
const BASE_R = 46;
const sph = new THREE.Spherical(BASE_R, THREE.MathUtils.degToRad(61), THREE.MathUtils.degToRad(36));
const from = new THREE.Spherical(78, THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(70));
let intro = true;
let introT = 0;
const setCam = (s) => {
  camera.position.setFromSpherical(s).add(controls.target);
  camera.lookAt(controls.target);
};
setCam(from);
controls.update();
['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((e) => renderer.domElement.addEventListener(e, () => (intro = false), { passive: true }));

const pipe = createPipeline(renderer, scene, camera);
buildWorld(scene, renderer, pipe.refl);
pipe.scenePass.collect();
renderer.shadowMap.needsUpdate = true;

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(PR);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  sph.radius = BASE_R * Math.max(1, 1.5 / camera.aspect); // keep the whole diorama in frame on narrow windows
  camera.updateProjectionMatrix();
  pipe.resize(w, h, PR);
}
window.addEventListener('resize', onResize);
onResize();

// adaptive resolution: keep the frame rate smooth on any GPU
const perf = { acc: 0, n: 0, t: 0, good: 0, fail: new Map() };
function adapt(dt, t) {
  if (window.__noAdapt) return;
  perf.acc += dt; perf.n++;
  if (perf.acc < 1.2) return;
  const fps = perf.n / perf.acc;
  perf.acc = 0; perf.n = 0;
  if (t < 2.5) return;
  if (fps < 40 && lvl > 0) {
    perf.fail.set(lvl, t);
    lvl--; perf.good = 0;
    PR = LEVELS[lvl]; onResize();
  } else if (fps > 56 && lvl < LEVELS.length - 1) {
    perf.good++;
    const f = perf.fail.get(lvl + 1);
    if (perf.good >= 3 && (f === undefined || t - f > 25)) { lvl++; perf.good = 0; PR = LEVELS[lvl]; onResize(); }
  } else perf.good = 0;
}
const clock = new THREE.Clock();
function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.12);
  const t = clock.elapsedTime;
  if (intro) {
    introT += raw;
    const k = Math.min(1, introT / 3.4);
    const e = 1 - Math.pow(1 - k, 3);
    const cur = new THREE.Spherical(
      THREE.MathUtils.lerp(from.radius, sph.radius, e),
      THREE.MathUtils.lerp(from.phi, sph.phi, e),
      THREE.MathUtils.lerp(from.theta, sph.theta, e)
    );
    setCam(cur);
    if (k >= 1) intro = false;
  }
  controls.update();
  for (const u of reg.updaters) u(t, dt);
  if (reg.groundUniforms) reg.groundUniforms.uTime.value = t;
  pipe.composer.render(dt);
  adapt(dt, t);
  requestAnimationFrame(frame);
}
frame();

// debug hook
window.__konbini = { scene, camera, controls, renderer, pipe, reg };
