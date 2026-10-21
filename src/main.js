import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { reg } from './core.js';
import { createPipeline } from './post.js';
import { buildWorld } from './world.js';
import { makeTree, setFoliageDensity } from './tree.js';
import { createEnvironment } from './env.js';
import { createUI } from './ui.js';
import { groundY, MAP } from './town/layout.js';
import { buildPlantStage } from './plants/preview.js';
import { createCamPan } from './camPan.js';

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
scene.fog = new THREE.Fog(0x1a2144, 0, 0.0038); // near / far = start / density (see the fog chunks in core.js)

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 400);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 6;
controls.maxDistance = 240; // far enough to see the whole diorama, base included
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.015;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.screenSpacePanning = true;
const TARGET = new THREE.Vector3(0.4, 1.4, 0.2);
controls.target.copy(TARGET);
const clampPan = () => {
  // panning explores the town, but the target never leaves the map
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, MAP.x0 + 2, MAP.x1 - 2);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, MAP.z0 + 2, MAP.z1 - 2);
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
['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((e) => renderer.domElement.addEventListener(e, () => { intro = false; fly = null; }, { passive: true }));

/* ---- smooth camera moves: back to LAWSON / the whole town ---- */
let fly = null;
function flyTo(target, s, dur = 1.6) {
  intro = false;
  const cur = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  let dTheta = s.theta - cur.theta;
  dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; // shortest way round
  fly = { t: 0, dur, t0: controls.target.clone(), t1: target.clone(), s0: cur, s1: new THREE.Spherical(s.radius, s.phi, cur.theta + dTheta) };
}
const TOWN_TARGET = new THREE.Vector3(-5, -1, -5);
const camHome = () => flyTo(TARGET, sph);
// the whole diorama, base included, fits the frame at any aspect
// しずく花店: first to the doors (they open as the camera nears), pressed again from there: inside down the aisle
const camFlorist = () => {
  const f = reg.florist;
  if (!f) return;
  const v = camera.position.distanceTo(f.entrance) < 13 ? f.views.inside : f.views.front;
  flyTo(v.t, v.s, 1.8);
};
const camTown = () => flyTo(TOWN_TARGET, new THREE.Spherical(Math.max(150, 150 * (1.55 / camera.aspect)), THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(30)), 2.0);

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
// plant candidates under review: ?view=plants (stage) / ?plants=1 (temporary placement in the town)
if (VIEW === 'plants') {
  scene.children.forEach((o) => { if (!o.isLight) o.visible = false; });
  const st = buildPlantStage(scene);
  intro = false;
  controls.minDistance = 0.3;
  const find = (id) => st.items.find((i) => i.id === id).obj;
  const look = (tx, ty, tz, r, phiDeg, thetaDeg) => {
    fly = null; intro = false;
    controls.target.set(tx, ty, tz);
    camera.position.setFromSpherical(new THREE.Spherical(r, THREE.MathUtils.degToRad(phiDeg), THREE.MathUtils.degToRad(thetaDeg))).add(controls.target);
    camera.lookAt(controls.target); controls.update();
  };
  window.__plants = {
    items: st.items.map((i) => ({ id: i.id, name: i.obj.userData.name, tris: i.obj.userData.tris })),
    view(name, id) {
      st.items.forEach((i) => (i.obj.visible = !id || i.id === id)); // per-plant views show that plant alone
      if (name === 'lineup') return look(-0.3, 0.5, 0, 12.2, 76, 0);
      if (name === 'ground') return look(-1.55, 0.45, 0, 9.2, 70, 0);
      if (name === 'pots') return look(3.18, 0.5, 0.1, 3.4, 74, 0);
      const o = find(id), p = o.position;
      const box = new THREE.Box3().setFromObject(o), hgt = box.max.y - box.min.y, wid = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      const r = Math.max(hgt, wid) * 1.55 + 0.2, ty = p.y + hgt * 0.45;
      if (name === 'front') return look(p.x, ty, p.z, r, 84, 0);
      if (name === 'side') return look(p.x, ty, p.z, r, 84, 90);
      if (name === 'q45') return look(p.x, ty, p.z, r * 0.95, 62, 45);
      if (name === 'top') return look(p.x, p.y + hgt * 0.35, p.z, r * 0.75, 28, 30);
      if (name === 'close') return look(p.x, ty + hgt * 0.1, p.z, r * 0.5, 70, 30);
      if (name === 'rim') return look(p.x, p.y + 0.3, p.z, 0.75, 52, 20);
    },
  };
  window.__plants.view('lineup');
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
const ui = createUI(env, { setQuality, reset: () => {}, home: camHome, town: camTown, florist: camFlorist });
// Camera Movement Control: W A S D / arrows / the D-pad pan the view across the town (screen-relative)
const pan = createCamPan({
  camera, controls, parent: ui.root,
  bounds: { x0: MAP.x0 + 2, x1: MAP.x1 - 2, z0: MAP.z0 + 2, z1: MAP.z1 - 2 },
  onStart: () => { intro = false; fly = null; }, // a pan takes over from the intro / a camera fly
});

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
const perf = { acc: 0, n: 0, t: 0, good: 0, fail: new Map(), part: 1, deg: 0 };
// "sharp first": when frames are slow, give up cheap-to-lose things before resolution. Each step can be undone.
const DEGRADE = [
  (on) => setFoliageDensity(on ? 0.78 : 1),
  (on) => { pipe.refl.scale = on ? 0.5 : (QUALITY[qNow] || QUALITY.auto).refl; onResize(); },
  (on) => handles.particles.setDensity(on ? 0.6 : 1),
  (on) => { pipe.outline.material.uniforms.uAO.value = on ? 0 : 0.3; },
];
// never go below 1.5x on a retina screen unless the frame rate is really poor (an up-scaled canvas is what looks blurry)
const floorLvl = () => { let f = 0; LEVELS.forEach((l, i) => { if (l <= Math.min(1.5, DPR) + 0.01) f = i; }); return f; };
function adapt(dt, t) {
  if (window.__noAdapt || qNow !== 'auto') return;
  perf.acc += dt; perf.n++;
  if (perf.acc < 1.2) return;
  const fps = perf.n / perf.acc;
  perf.acc = 0; perf.n = 0;
  if (t < 2.5) return;
  if (fps < 30) {
    perf.good = 0;
    if (perf.deg < DEGRADE.length) DEGRADE[perf.deg++](true);
    else if (lvl > floorLvl() || (fps < 20 && lvl > 0)) { perf.fail.set(lvl, t); lvl--; PR = LEVELS[lvl]; onResize(); }
  } else if (fps > 56) {
    perf.good++;
    if (perf.good < 3) return;
    perf.good = 0;
    const f = perf.fail.get(lvl + 1);
    if (lvl < LEVELS.length - 1 && (f === undefined || t - f > 25)) { lvl++; PR = LEVELS[lvl]; onResize(); }
    else if (perf.deg > 0) DEGRADE[--perf.deg](false);
  } else perf.good = 0;
}
/* ---- things that follow the camera around the town: shadow box, weather volume, lake visibility ---- */
const SHADOW = { key: '', box: new THREE.Box3(new THREE.Vector3(-46.5, -1.2, -42.5), new THREE.Vector3(-19, 1.5, -24)) };
const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
reg.shadowCenter = new THREE.Vector3();
reg.camera = camera;
reg.controls = controls;
// click (not drag) on something in reg.clickables, e.g. the florist's doors
{
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.layers.enableAll(); // click targets may sit on a layer the camera never draws
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 450) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null;
    (reg.clickables || []).forEach((c) => { const h = ray.intersectObjects(c.objects, true)[0]; if (h && (!best || h.distance < best.d)) best = { d: h.distance, c }; });
    if (best && best.d < 60) best.c.onClick();
  });
}
const LAKE_C = new THREE.Vector3(-32.5, 0, -33.5);
function followCamera() {
  const dist = camera.position.distanceTo(controls.target);
  const half = dist < 55 ? 24 : dist < 95 ? 36 : 52;
  const snap = half / 3;
  const cx = Math.round(controls.target.x / snap) * snap, cz = Math.round(controls.target.z / snap) * snap;
  const key = `${cx}|${cz}|${half}`;
  if (key !== SHADOW.key) {
    SHADOW.key = key;
    reg.shadowCenter.set(cx, 0, cz);
    const sc = handles.sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 60 + half * 2;
    sc.updateProjectionMatrix();
    reg.shadowDirty = true;
  }
  // fog starts where the model starts (air perspective across the diorama, not a box round the camera)
  scene.fog.near = Math.max(0, dist - 42);
  pipe.outline.material.uniforms.uFogNear.value = scene.fog.near;
  // weather tile: a soft round patch round the target; from far away it grows to cover the whole base
  // (fewer particles per m² in the overview, which is what a distant shower looks like anyway)
  // close up the patch leans toward the camera so the foreground gets its rain / snow too
  const lean = 0.32 * (1 - THREE.MathUtils.smoothstep(dist, 60, 110));
  handles.particles.setCenter(
    controls.target.x + (camera.position.x - controls.target.x) * lean,
    controls.target.z + (camera.position.z - controls.target.z) * lean,
    THREE.MathUtils.clamp(dist * 1.0, 34, 135));
  pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(pv);
  // the lake earns a reflection pass only when it is on screen and near enough to matter
  reg.lakeVisible = frustum.intersectsBox(SHADOW.box) && camera.position.distanceTo(LAKE_C) < 72;
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
  if (fly) {
    fly.t += raw;
    const k = Math.min(1, fly.t / fly.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    setCam(new THREE.Spherical(THREE.MathUtils.lerp(fly.s0.radius, fly.s1.radius, e), THREE.MathUtils.lerp(fly.s0.phi, fly.s1.phi, e), THREE.MathUtils.lerp(fly.s0.theta, fly.s1.theta, e)));
    if (k >= 1) fly = null;
  }
  pan.update(dt);
  controls.update();
  // never below the ground (the terrace and banks are not flat)
  {
    const gy = groundY(camera.position.x, camera.position.z) + 0.8;
    if (camera.position.y < gy) { camera.position.y = gy; camera.lookAt(controls.target); }
  }
  followCamera();
  env.update(t, dt);
  for (const u of reg.updaters) u(t, dt);
  if (reg.groundUniforms) reg.groundUniforms.uTime.value = t;
  pipe.composer.render(dt);
  adapt(dt, t);
  requestAnimationFrame(frame);
}
frame();

// debug hook
window.__konbini = { perf, flyTo, camHome, camTown, THREE, scene, camera, controls, renderer, pipe, reg, env, ui, handles, pan };
