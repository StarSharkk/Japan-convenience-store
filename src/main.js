import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { reg } from './core.js';
import { createPipeline } from './post.js';
import { buildWorld } from './world.js';
import { makeTree, setFoliageDensity } from './tree.js';
import { createEnvironment } from './env.js';
import { createUI } from './ui.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
// Render at the display's native density. The old code started at 1.25x and up-scaled it with the browser's
// bilinear filter on retina screens, which is what made lines look soft / low-res. Resolution is now only
// reduced as an emergency brake (<30 fps) and never below 1x unless the display itself is below 1x.
let LEVELS = [1];
let lvl = 0;
let PR = 1;
function buildLevels(cap) {
  LEVELS = [0.75, 1, 1.25, 1.5, 1.75, 2].filter((l) => l <= Math.min(cap, DPR) + 0.01 && (l >= 1 || DPR < 1.01 || cap < 1));
  if (!LEVELS.length) LEVELS = [Math.min(cap, DPR)];
  lvl = LEVELS.length - 1;
  PR = LEVELS[lvl];
}
buildLevels(2);
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
const TARGET = new THREE.Vector3(0.4, 1.4, 0.2);
controls.target.copy(TARGET);
const clampPan = () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -11, 11);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -11, 11);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, -0.5, 9);
};
controls.addEventListener('change', clampPan);

// start pose (SE, elevated) with a slow intro dolly
const BASE_R = 36;
const sph = new THREE.Spherical(BASE_R, THREE.MathUtils.degToRad(61), THREE.MathUtils.degToRad(36));
const from = new THREE.Spherical(78, THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(70));
let intro = true;
let introT = 0;
const setCam = (s) => {
  camera.position.setFromSpherical(s).add(controls.target);
  camera.lookAt(controls.target);
};
const QS = new URLSearchParams(location.search);
const VIEW = QS.get('view');
if (VIEW === 'tree') {
  // review stage: the tree alone on a dark pavement disc, real scene lighting + rain
  controls.target.set(0, 2.7, 0);
  sph.set(14, THREE.MathUtils.degToRad(80), THREE.MathUtils.degToRad(30));
  intro = false;
  setCam(sph);
} else if (QS.get('intro') === '0') {
  intro = false; // ?intro=0 skips the opening dolly (handy for screenshots)
  setCam(sph);
} else setCam(from);
controls.update();
['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((e) => renderer.domElement.addEventListener(e, () => (intro = false), { passive: true }));

const pipe = createPipeline(renderer, scene, camera);
const handles = buildWorld(scene, renderer, pipe.refl);
if (VIEW === 'tree') {
  scene.children.forEach((o) => { if (!o.isLight) o.visible = false; });
  const stage = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.2, 48), new THREE.MeshToonMaterial({ color: '#2b3548' }));
  disc.position.y = -0.1; disc.receiveShadow = true; stage.add(disc);
  const tr = makeTree({ seed: +(QS.get('seed') || 3), height: +(QS.get('h') || 5.4), lean: 0.05, palette: QS.get('pal') || 'deep' });
  stage.add(tr);
  const lamp = new THREE.PointLight('#ffd9a8', 40, 16, 2); lamp.position.set(3, 4, 4); stage.add(lamp);
  scene.add(stage);
}
pipe.scenePass.collect();
renderer.shadowMap.needsUpdate = true;

/* ---- environment: weather / season / time / holiday / store status ---- */
const env = createEnvironment({ camera, scene, renderer, post: pipe, hemi: handles.hemi, sun: handles.sun, particles: handles.particles, world: handles.world });
{
  // ?w=snowy&s=winter&t=21.5&h=christmas&open=0&auto=1  (handy for sharing / testing a scene)
  const q = {};
  if (QS.get('w')) q.weather = QS.get('w');
  if (QS.get('s')) q.season = QS.get('s');
  if (QS.get('t') !== null && QS.get('t') !== '') q.time = parseFloat(QS.get('t'));
  if (QS.get('h')) q.holiday = QS.get('h');
  if (QS.get('fw') !== null) q.fireworks = QS.get('fw') !== '0';
  if (QS.get('open') !== null) q.storeStatus = QS.get('open') === '0' ? 'closed' : 'open';
  if (QS.get('auto') === '1') q.autoTime = true;
  if (QS.get('p')) env.preset(QS.get('p'));
  env.set(q, { instant: true });
}

/* ---- quality: pixel ratio cap, particle density, reflection resolution ---- */
const QUALITY = { auto: { cap: 2, part: 1, refl: 0.75, leaf: 1 }, high: { cap: 2, part: 1, refl: 0.85, leaf: 1 }, med: { cap: 1.25, part: 0.6, refl: 0.6, leaf: 0.78 }, low: { cap: 1, part: 0.3, refl: 0.45, leaf: 0.55 } };
let qNow = 'auto';
function setQuality(q) {
  qNow = q;
  const c = QUALITY[q] || QUALITY.auto;
  buildLevels(c.cap);
  handles.particles.setDensity(c.part);
  setFoliageDensity(c.leaf);
  pipe.refl.scale = c.refl;
  onResize();
}
const ui = createUI(env, { setQuality, reset: () => {} });

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(PR);
  renderer.setSize(w, h);
  reg.pxPerUnit = (2 * Math.tan((30 * Math.PI) / 360)) / (h * PR);
  camera.aspect = w / h;
  if (VIEW !== 'tree') sph.radius = BASE_R * Math.max(1, 1.5 / camera.aspect); // keep the whole diorama in frame on narrow windows
  camera.updateProjectionMatrix();
  pipe.resize(w, h, PR);
}
window.addEventListener('resize', onResize);
onResize();
if (!intro) { setCam(sph); controls.update(); } // ?intro=0 / tree view: apply the aspect-aware radius

// adaptive resolution (quality = auto): keep the frame rate smooth on any GPU; when even the lowest
// resolution is too slow, thin out the particle systems as well
const perf = { acc: 0, n: 0, t: 0, good: 0, fail: new Map(), part: 1 };
function adapt(dt, t) {
  if (window.__noAdapt || qNow !== 'auto') return;
  perf.acc += dt; perf.n++;
  if (perf.acc < 1.2) return;
  const fps = perf.n / perf.acc;
  perf.acc = 0; perf.n = 0;
  if (t < 2.5) return;
  if (fps < 30 && lvl > 0) {
    perf.fail.set(lvl, t);
    lvl--; perf.good = 0;
    PR = LEVELS[lvl]; onResize();
  } else if (fps < 24 && lvl === 0 && qNow === 'auto' && perf.part > 0.31) {
    perf.part = Math.max(0.3, perf.part - 0.25);
    handles.particles.setDensity(perf.part);
    setFoliageDensity(0.4 + 0.6 * perf.part);
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
  env.update(t, dt);
  for (const u of reg.updaters) u(t, dt);
  if (reg.groundUniforms) reg.groundUniforms.uTime.value = t;
  pipe.composer.render(dt);
  adapt(dt, t);
  requestAnimationFrame(frame);
}
frame();

// debug hook
window.__konbini = { THREE, scene, camera, controls, renderer, pipe, reg, env, ui, handles };
