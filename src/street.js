import * as THREE from 'three';
import { reg, toon, glow, bx, bc, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, clamp, smooth, lerp } from './core.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeGlass } from './fx.js';
import { snowCapBox, snowCapLine, snowCapDome } from './roofPiles.js';
import { T, BRAND, logo, posterTex } from './tex.js';

const Y0 = 0.15;
const lbl = (parent, tex, w, h, x, y, z, ry = 0, k = 1.1, o = {}) =>
  pl(parent, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), side: o.side || THREE.FrontSide, transparent: !!o.transparent }), w, h, x, y, z, ry, 0, { noLine: o.noLine });

/* ================================================================ vending machines */
function vendingTex(theme, seed) {
  return canvasTex(512, 950, (g, w, h) => {
    const R = rng(seed);
    const body = theme === 0 ? '#c8242b' : theme === 1 ? '#1f64bd' : '#2a9d6f';
    g.fillStyle = body; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, 120);
    gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, 120);
    T(g, theme === 0 ? 'つめた〜い' : theme === 1 ? 'あったか〜い' : 'おいしい水', w / 2 - 20, 56, 54, '#fff', { weight: 900, stroke: 'rgba(0,0,0,0.3)', sw: 8 });
    // product window
    g.fillStyle = '#0d1320'; roundRect(g, 24, 112, 348, 600, 14); g.fill();
    g.fillStyle = '#e8f0ff'; roundRect(g, 30, 118, 336, 588, 10); g.fill();
    const pal = ['#ff9f43', '#5ad1ff', '#7ed957', '#ff5d6c', '#ffd24a', '#b48cff', '#f4f4f4', '#c58a5a', '#2f7bd9'];
    for (let r = 0; r < 5; r++) {
      const y = 128 + r * 116;
      g.fillStyle = '#c9d3e6'; g.fillRect(34, y + 78, 328, 6);
      for (let c = 0; c < 6; c++) {
        const x = 44 + c * 53;
        const col = pal[(R() * pal.length) | 0];
        const can = (r + c) % 3 === 0;
        g.fillStyle = col;
        if (can) { roundRect(g, x, y + 28, 36, 50, 6); g.fill(); g.fillStyle = '#d5dae6'; g.fillRect(x, y + 28, 36, 7); }
        else { roundRect(g, x + 3, y + 14, 30, 64, 9); g.fill(); g.fillStyle = '#f4f4f4'; g.fillRect(x + 11, y + 6, 14, 12); }
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 8, y + 40, 20, 14);
      }
      for (let c = 0; c < 6; c++) {
        g.fillStyle = '#d62839'; g.fillRect(44 + c * 53 + 2, y + 88, 32, 16);
        T(g, '130', 44 + c * 53 + 18, y + 97, 13, '#fff');
      }
    }
    // control column
    g.fillStyle = '#d5dae6'; g.fillRect(388, 112, 100, 600);
    g.fillStyle = '#0d1320'; g.fillRect(398, 128, 80, 40);
    T(g, '130', 438, 150, 30, '#ff4a3a', { weight: 900 });
    for (let i = 0; i < 5; i++) { g.fillStyle = '#7a8397'; roundRect(g, 402, 190 + i * 40, 72, 28, 5); g.fill(); g.fillStyle = '#ffd24a'; g.fillRect(412, 198 + i * 40, 52, 12); }
    g.fillStyle = '#0d1320'; g.fillRect(412, 420, 52, 10);
    g.fillStyle = '#f2c230'; roundRect(g, 402, 460, 72, 60, 10); g.fill();
    T(g, '返却', 438, 490, 22, '#333');
    // pickup
    g.fillStyle = '#0d1320'; roundRect(g, 60, 756, 330, 120, 16); g.fill();
    g.fillStyle = '#1f2638'; roundRect(g, 70, 766, 310, 100, 12); g.fill();
    T(g, '▼ とりだし口', 225, 820, 26, '#7e89a3', { weight: 700 });
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 900, w, 50);
  }, { aniso: 8 });
}

export function vendingMachine(parent, x, z, ry, theme, seed, light = false) {
  const m = grp(parent, x, Y0, z, ry);
  const body = toon(theme === 0 ? '#a81f25' : theme === 1 ? '#174e99' : '#1f7d58', { lit: 0.15 });
  bx(m, body, -0.5, 0.5, 0, 1.85, -0.38, 0.38);
  bx(m, toon('#e6e9f0', { lit: 0.3 }), -0.5, 0.5, 1.85, 1.9, -0.4, 0.4);
  bx(m, toon('#141a28'), -0.46, 0.46, 0, 0.08, -0.34, 0.4);
  const tex = vendingTex(theme, seed);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) });
  const front = pl(m, mat, 0.98, 1.84, 0, 0.92, 0.384, 0, 0);
  pl(m, makeGlass(0.7, 1.2, seed, { drops: 0.7, alpha: 0.03 }), 0.7, 1.2, -0.12, 1.15, 0.39, 0, 0, { noLine: true });
  const tube = glow('#eaf6ff', 2.6, { track: false });
  bx(m, tube, -0.4, 0.4, 1.8, 1.84, 0.384, 0.395, { cast: false });
  halo(m, 0, 1.0, 0.7, theme === 0 ? '#ffd0c0' : '#c8e4ff', 2.4, 0.22);
  const L = light ? plight(m, '#cfe6ff', 7, 6, 0, 1.2, 1.2, 'vend') : null;
  return { m, mat, tube, L };
}

/* ================================================================ bicycles */
// Two kinds, after the reference photos:
//  'basket' – mamachari: step-through frame, wire front basket, fenders, chain case, rear rack, ring lock,
//             sprung saddle, two-leg rear stand (so it stands upright); o.e adds the e-bike battery.
//  'cross'  – cross bike: diamond frame, flat bar, slim saddle, exposed chainring / derailleur, no fenders,
//             side stand on the left (it leans on it).
// Local frame: front = +z, x = width, ground y = 0. o.steer turns the front assembly about the head tube.
const BIKE = {};
const bgeo = (key, make) => BIKE[key] || (BIKE[key] = make());
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function tube(parent, mat, pts, r, seg = 12) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(V)), seg, r, 6), mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function basketMat() {
  if (BIKE.basket) return BIKE.basket;
  const t = canvasTex(96, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.lineWidth = 3.2;
    for (let i = 0; i <= 8; i++) {
      const p = 1.6 + (i * (w - 3.2)) / 8;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, h); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(w, p); c.stroke();
    }
  });
  const m = toon('#b9c1cd', { map: t, side: THREE.DoubleSide });
  m.alphaTest = 0.5;
  return (BIKE.basket = m);
}
function wheel(parent, z, R, tr, mats, spokes) {
  const w = grp(parent, 0, R + tr, z);
  const tire = new THREE.Mesh(bgeo(`t${R}${tr}`, () => new THREE.TorusGeometry(R, tr, 6, 30).rotateY(Math.PI / 2)), mats.tire);
  tire.castShadow = true; tire.receiveShadow = true; w.add(tire);
  w.add(new THREE.Mesh(bgeo(`r${R}${tr}`, () => new THREE.TorusGeometry(R - tr - 0.008, mats.rimW, 4, 30).rotateY(Math.PI / 2)), mats.rim));
  const sp = new THREE.Mesh(bgeo(`s${R}${spokes}`, () => {
    const L = (R - 0.02) * 2;
    return mergeGeometries(Array.from({ length: spokes }, (_, k) => new THREE.BoxGeometry(0.005, L, 0.005).rotateX((k * Math.PI) / spokes).translate(k % 2 ? 0.012 : -0.012, 0, 0)));
  }), mats.spoke);
  sp.userData.noLine = true; w.add(sp);
  cyl2(w, mats.hub, [-0.055, 0, 0], [0.055, 0, 0], 0.024, 8);
  return w;
}
function fender(parent, z, y, R, a0, a1, mat) {
  // torus arc in the bike's z/y plane: angle 0 = rear, PI/2 = top, PI = front; widened sideways
  const m = new THREE.Mesh(bgeo(`f${R}${a0}${a1}`, () => new THREE.TorusGeometry(R, 0.013, 3, 18, a1 - a0).rotateZ(a0).rotateY(Math.PI / 2).scale(3.4, 1, 1)), mat);
  m.position.set(0, y, z); m.castShadow = true;
  parent.add(m);
  return m;
}
/** a group that turns about the head-tube axis (hb → ht); children use the bike's own coordinates */
function steerGroup(parent, hb, ht, steer) {
  const fr = grp(parent, 0, hb[1], hb[2]);
  fr.quaternion.setFromAxisAngle(V([0, ht[1] - hb[1], ht[2] - hb[2]]).normalize(), steer);
  return grp(fr, 0, -hb[1], -hb[2]);
}
function pedals(g, bb, mat, dark) {
  [[1, 0.6], [-1, 0.6 + Math.PI]].forEach(([s, a]) => {
    const e = [s * 0.11, bb[1] - Math.sin(a) * 0.16, bb[2] + Math.cos(a) * 0.16];
    cyl2(g, mat, [s * 0.075, bb[1], bb[2]], e, 0.012, 6);
    bx(g, dark, e[0] + s * 0.005, e[0] + s * 0.1, e[1] - 0.012, e[1] + 0.012, e[2] - 0.045, e[2] + 0.045, { cast: false });
  });
}

export function bicycle(parent, x, z, ry, color = '#3aa0c8', tilt = 0.12, o = {}) {
  if (typeof o === 'string') o = { type: o };
  const type = o.type || 'basket';
  const b = grp(parent, x, Y0, z, ry);
  const inner = grp(b, 0, 0, 0, 0);
  const paint = toon(color);
  const silver = toon('#c3cad6');
  const dark = toon('#1e2229');
  const black = toon('#14181f');
  const sad = toon(o.saddle || '#24262d');
  if (type === 'cross') {
    /* ---------------------------------------------------------------- cross bike */
    const lean = Math.max(0.08, Math.abs(tilt));
    inner.rotation.z = lean; // leans onto its left side stand
    const R = 0.345, tr = 0.017, hy = R + tr;
    const mats = { tire: black, rim: dark, rimW: 0.014, spoke: toon('#9ea6b2'), hub: silver };
    const rz = -0.52, fz = 0.53;
    const BB = [0, 0.28, -0.1], ST = [0, 0.84, -0.25], HT = [0, 0.875, 0.37], HB = [0, 0.73, 0.41];
    wheel(inner, rz, R, tr, mats, 12);
    // diamond frame
    cyl2(inner, paint, [0, 0.832, -0.247], [0, 0.866, 0.37], 0.019, 8);
    cyl2(inner, paint, BB, [0, 0.745, 0.405], 0.025, 8);
    cyl2(inner, paint, BB, ST, 0.02, 8);
    cyl2(inner, paint, [0, 0.71, 0.415], [0, 0.89, 0.365], 0.025, 8);
    [-1, 1].forEach((s) => {
      cyl2(inner, paint, [s * 0.022, 0.8, -0.238], [s * 0.05, hy, rz], 0.01, 6);
      cyl2(inner, paint, [s * 0.035, BB[1], BB[2]], [s * 0.05, hy, rz], 0.011, 6);
    });
    // seat post + slim saddle + rear reflector
    cyl2(inner, silver, ST, [0, 0.975, -0.288], 0.013, 8);
    sph(inner, sad, 1, 0, 0.99, -0.255, 0.045, 0.024, 0.13);
    sph(inner, sad, 1, 0, 0.992, -0.33, 0.07, 0.027, 0.065);
    bx(inner, glow('#ff3b3b', 2.2), -0.022, 0.022, 0.88, 0.93, -0.292, -0.282, { cast: false });
    // drivetrain (right side)
    const ring = new THREE.Mesh(bgeo('ring', () => new THREE.TorusGeometry(0.098, 0.012, 4, 24).rotateY(Math.PI / 2)), silver);
    ring.position.set(0.07, BB[1], BB[2]); inner.add(ring);
    cyl2(inner, dark, [0.064, BB[1], BB[2]], [0.076, BB[1], BB[2]], 0.05, 10, { cast: false });
    cyl2(inner, dark, [0.055, hy, rz], [0.08, hy, rz], 0.045, 12, { cast: false });
    bx(inner, dark, 0.07, 0.095, hy - 0.11, hy - 0.02, rz - 0.035, rz + 0.01, { cast: false });
    cyl2(inner, black, [0.07, BB[1] + 0.1, BB[2]], [0.068, hy + 0.045, rz], 0.005, 4, { noLine: true });
    cyl2(inner, black, [0.07, BB[1] - 0.1, BB[2]], [0.082, hy - 0.11, rz + 0.01], 0.005, 4, { noLine: true });
    pedals(inner, BB, silver, dark);
    // side stand (left), foot on the ground of the leaned frame
    cyl2(inner, dark, [-0.05, 0.32, -0.22], [-0.2, 0.2 * Math.tan(lean) + 0.01, -0.36], 0.011, 6);
    // front: fork, stem, flat bar
    const f = steerGroup(inner, HB, HT, o.steer || 0);
    wheel(f, fz, R, tr, mats, 12);
    [-1, 1].forEach((s) => cyl2(f, paint, [s * 0.03, 0.72, 0.415], [s * 0.05, hy, fz], 0.013, 6));
    bx(f, paint, -0.05, 0.05, 0.69, 0.725, 0.39, 0.44, { bevel: 0.012 });
    cyl2(f, dark, [0, 0.88, 0.367], [0, 0.94, 0.352], 0.017, 8);
    cyl2(f, dark, [0, 0.935, 0.35], [0, 0.95, 0.45], 0.015, 8);
    cyl2(f, dark, [-0.3, 0.952, 0.452], [0.3, 0.952, 0.452], 0.012, 8);
    [-1, 1].forEach((s) => {
      cyl2(f, black, [s * 0.2, 0.952, 0.452], [s * 0.305, 0.952, 0.452], 0.019, 8);
      cyl2(f, silver, [s * 0.17, 0.955, 0.465], [s * 0.24, 0.94, 0.53], 0.006, 4, { noLine: true });
    });
    bx(f, glow('#fff1c0', 1.6), 0.08, 0.13, 0.94, 0.97, 0.47, 0.5, { cast: false });
    return b;
  }

  /* ---------------------------------------------------------------- mamachari */
  inner.rotation.z = 0; // two-leg stand keeps it upright
  const R = 0.33, tr = 0.024, hy = R + tr;
  const mats = { tire: black, rim: silver, rimW: 0.012, spoke: toon('#aab2bd'), hub: silver };
  const rz = -0.56, fz = 0.52;
  const BB = [0, 0.27, -0.08], HT = [0, 0.86, 0.34], HB = [0, 0.66, 0.4];
  wheel(inner, rz, R, tr, mats, 14);
  fender(inner, rz, hy, R + tr + 0.03, -0.35, 1.95, silver);
  // step-through frame: one big swooping main tube + seat tube
  cyl2(inner, paint, [0, 0.635, 0.408], [0, 0.885, 0.333], 0.027, 10);
  tube(inner, paint, [[0, 0.79, 0.363], [0, 0.58, 0.25], [0, 0.34, 0.06], [0, 0.27, -0.09]], 0.03);
  cyl2(inner, paint, BB, [0, 0.8, -0.25], 0.022, 8);
  [-1, 1].forEach((s) => {
    cyl2(inner, paint, [s * 0.03, BB[1], BB[2]], [s * 0.05, hy, rz], 0.012, 6);
    cyl2(inner, paint, [s * 0.025, 0.72, -0.225], [s * 0.05, hy, rz], 0.012, 6);
  });
  if (o.e) {
    // e-bike battery behind the seat tube
    const bt = grp(inner, 0, 0.535, -0.165); bt.rotation.x = -0.31;
    bx(bt, toon('#3b4049'), -0.048, 0.048, -0.17, 0.17, -0.115, -0.02, { bevel: 0.03 });
    bx(bt, toon('#8c949f'), -0.05, 0.05, 0.12, 0.175, -0.118, -0.018, { bevel: 0.02 });
  }
  // full chain case + pedals
  const cc = grp(inner, 0.075, 0.312, -0.32); cc.rotation.x = 0.173;
  const cm = toon(o.case || '#aeb5bf');
  bx(cc, cm, -0.012, 0.012, -0.035, 0.055, -0.28, 0.24, { bevel: 0.02 });
  cyl2(inner, cm, [0.064, BB[1], BB[2]], [0.088, BB[1], BB[2]], 0.105, 18, { cast: false });
  pedals(inner, BB, silver, dark);
  // rear rack
  [-1, 1].forEach((s) => {
    cyl2(inner, silver, [s * 0.075, 0.765, -0.78], [s * 0.075, 0.765, -0.27], 0.01, 6);
    cyl2(inner, silver, [s * 0.075, 0.765, -0.72], [s * 0.058, hy, rz], 0.009, 6);
    cyl2(inner, silver, [s * 0.075, 0.765, -0.27], [s * 0.02, 0.745, -0.235], 0.008, 6);
  });
  [-0.77, -0.63, -0.49, -0.35].forEach((cz) => cyl2(inner, silver, [-0.075, 0.765, cz], [0.075, 0.765, cz], 0.008, 4));
  bx(inner, glow('#ff3b3b', 2.2), -0.035, 0.035, 0.69, 0.74, -0.79, -0.778, { cast: false });
  // ring lock over the rear wheel
  bx(inner, dark, -0.055, 0.055, 0.6, 0.66, -0.33, -0.29, { bevel: 0.015 });
  // seat post, sprung comfort saddle
  cyl2(inner, silver, [0, 0.8, -0.25], [0, 0.9, -0.274], 0.015, 8);
  [-1, 1].forEach((s) => cy(inner, silver, s * 0.055, 0.885, -0.345, 0.014, 0.05, 6));
  sph(inner, sad, 1, 0, 0.945, -0.31, 0.105, 0.042, 0.095);
  sph(inner, sad, 1, 0, 0.94, -0.215, 0.05, 0.033, 0.085);
  // two-leg stand down at the rear axle
  [-1, 1].forEach((s) => cyl2(inner, silver, [s * 0.065, hy, rz], [s * 0.1, 0.015, rz - 0.08], 0.011, 6));
  cyl2(inner, silver, [-0.1, 0.015, rz - 0.08], [0.1, 0.015, rz - 0.08], 0.011, 6);

  // front assembly: fork, swept-back bar, basket, lamp, wheel, fender
  const f = steerGroup(inner, HB, HT, o.steer || 0);
  wheel(f, fz, R, tr, mats, 14);
  fender(f, fz, hy, R + tr + 0.03, 1.2, 3.5, silver);
  [-1, 1].forEach((s) => cyl2(f, paint, [s * 0.03, 0.645, 0.405], [s * 0.05, hy, fz], 0.014, 6));
  bx(f, paint, -0.05, 0.05, 0.615, 0.65, 0.38, 0.43, { bevel: 0.012 });
  cyl2(f, silver, [0, 0.88, 0.334], [0, 0.965, 0.31], 0.017, 8);
  [-1, 1].forEach((s) => {
    tube(f, silver, [[0, 0.962, 0.31], [s * 0.12, 0.968, 0.325], [s * 0.22, 0.962, 0.265], [s * 0.27, 0.952, 0.17]], 0.012, 10);
    cyl2(f, black, [s * 0.27, 0.952, 0.185], [s * 0.278, 0.946, 0.075], 0.02, 8);
    cyl2(f, silver, [s * 0.2, 0.96, 0.25], [s * 0.26, 0.93, 0.31], 0.006, 4, { noLine: true });
  });
  sph(f, silver, 0.026, 0.1, 0.99, 0.32, 1, 0.7, 1);
  // wire basket over the front wheel (open top), with stays to the fork ends
  const bm = basketMat();
  const k0 = 0.42, k1 = 0.74, y0 = 0.77, y1 = 0.98, hw = 0.19;
  const bkf = (w, h, px, py, pz, ry_, rx_) => pl(f, bm, w, h, px, py, pz, ry_, rx_, { noLine: true });
  bkf(hw * 2, y1 - y0, 0, (y0 + y1) / 2, k1, 0, 0);
  bkf(hw * 2, y1 - y0, 0, (y0 + y1) / 2, k0, 0, 0);
  bkf(k1 - k0, y1 - y0, hw, (y0 + y1) / 2, (k0 + k1) / 2, Math.PI / 2, 0);
  bkf(k1 - k0, y1 - y0, -hw, (y0 + y1) / 2, (k0 + k1) / 2, Math.PI / 2, 0);
  bkf(hw * 2, k1 - k0, 0, y0, (k0 + k1) / 2, 0, -Math.PI / 2);
  const rim = toon('#aab2be');
  cyl2(f, rim, [-hw, y1, k0], [hw, y1, k0], 0.009, 4); cyl2(f, rim, [-hw, y1, k1], [hw, y1, k1], 0.009, 4);
  cyl2(f, rim, [-hw, y1, k0], [-hw, y1, k1], 0.009, 4); cyl2(f, rim, [hw, y1, k0], [hw, y1, k1], 0.009, 4);
  cyl2(f, rim, [-hw, y0, k1], [hw, y0, k1], 0.007, 4); cyl2(f, rim, [-hw, y0, k0], [hw, y0, k0], 0.007, 4);
  [-1, 1].forEach((s) => cyl2(f, silver, [s * 0.11, y0, k1 - 0.05], [s * 0.052, hy, fz], 0.008, 4));
  bx(f, silver, -0.03, 0.03, 0.86, 0.9, 0.33, k0, { cast: false });
  // dynamo lamp on the fork crown
  cyl2(f, dark, [0, 0.655, 0.45], [0, 0.66, 0.52], 0.035, 10);
  pl(f, glow('#fff1c0', 1.6), 0.055, 0.055, 0, 0.66, 0.522, 0, 0);
  return b;
}

/* ================================================================ umbrella stand */
function umbrellaStand(parent, x, z) {
  const g = grp(parent, x, Y0, z);
  const metal = toon('#8d96aa');
  bx(g, toon('#2a3142'), -0.3, 0.3, 0, 0.04, -0.14, 0.14);
  [[-0.3, -0.14], [0.3, -0.14], [-0.3, 0.14], [0.3, 0.14]].forEach(([a, b]) => cy(g, metal, a, 0, b, 0.015, 0.78, 6));
  bx(g, metal, -0.31, 0.31, 0.74, 0.77, -0.15, 0.15, { cast: false });
  bx(g, metal, -0.31, 0.31, 0.3, 0.32, -0.15, 0.15, { cast: false });
  const cols = ['#e8493f', '#2f7bd9', '#f6d84a', '#2fbf8f', '#ffffff', '#9a5ad6'];
  cols.forEach((c, i) => {
    const ux = -0.22 + i * 0.088, uz = ((i % 2) - 0.5) * 0.12;
    const u = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.7, 8), toon(c));
    u.position.set(ux, 0.5, uz); u.rotation.z = (i - 2.5) * 0.04; u.castShadow = true; g.add(u);
    cy(g, toon('#2a2f3c'), ux, 0.84 - 0.0, uz, 0.012, 0.0, 4);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 5, 10, Math.PI), toon('#2a2f3c'));
    h.position.set(ux, 0.1, uz); h.rotation.z = Math.PI; g.add(h);
  });
  // clear vinyl umbrella dripping
  return g;
}

/* ================================================================ poles & wires */
const poleMat = toon('#6f778a');
const armMat = toon('#4d5568');
const insMat = toon('#c8d0e0');
export function utilityPole(parent, x, z, h = 7.4, armAxis = 'x') {
  const p = grp(parent, x, Y0, z);
  cy(p, poleMat, 0, 0, 0, 0.11, h, 10, { rt: 0.62 });
  cy(p, toon('#d4b82a'), 0, 1.0, 0, 0.113, 0.28, 10, { cast: false });
  cy(p, toon('#222733'), 0, 1.28, 0, 0.113, 0.1, 10, { cast: false });
  [h - 0.35, h - 1.15].forEach((y, k) => {
    const w = k ? 1.5 : 2.0;
    if (armAxis === 'x') bx(p, armMat, -w / 2, w / 2, y, y + 0.09, -0.05, 0.05);
    else bx(p, armMat, -0.05, 0.05, y, y + 0.09, -w / 2, w / 2);
    for (let i = -1; i <= 1; i++) {
      const o = (i * w) / 2 * 0.8;
      if (armAxis === 'x') cy(p, insMat, o, y + 0.09, 0, 0.035, 0.11, 8, { cast: false });
      else cy(p, insMat, 0, y + 0.09, o, 0.035, 0.11, 8, { cast: false });
    }
  });
  // transformer
  const tf = cy(p, toon('#8c95a8'), 0.28, h - 2.0, 0, 0.2, 0.62, 12);
  cy(p, toon('#6a7388'), 0.28, h - 1.4, 0, 0.21, 0.06, 12, { cast: false });
  bx(p, toon('#f0c030'), -0.12, 0.12, 2.5, 2.8, 0.1, 0.12, { cast: false });
  return p;
}

export function wire(parent, a, b, sag = 0.5, r = 0.017) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, r, 4, false);
  const m = new THREE.Mesh(geo, toon('#323a52', { e: '#10141f', ei: 1 }));
  m.userData.noLine = true;
  parent.add(m);
  return m;
}

/* ================================================================ traffic signal */
export function signalHead(parent, x, y, z, ry = 0) {
  const s = grp(parent, x, y, z, ry);
  const body = bx(s, toon('#2b3242'), -0.56, 0.56, -0.17, 0.17, -0.1, 0.1);
  const lens = [];
  [[-0.38, '#4cffb0', 'g'], [0, '#ffc23a', 'y'], [0.38, '#ff4141', 'r']].forEach(([lx, c, k]) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.12) });
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 18), m);
    d.rotation.x = Math.PI / 2; d.position.set(lx, 0, 0.11);
    s.add(d);
    // visor
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14, 1, true, -Math.PI * 0.7, Math.PI * 1.4), toon('#1b202c', { side: THREE.DoubleSide }));
    v.rotation.x = Math.PI / 2; v.position.set(lx, 0.02, 0.15);
    s.add(v);
    lens.push({ m, c: new THREE.Color(c), k, halo: halo(s, lx, 0, 0.25, c, 0.9, 0) });
  });
  return { g: s, lens };
}

function mastSignals(parent, poleX, poleZ, armDx, armY, heads, name) {
  const p = grp(parent, poleX, Y0, poleZ);
  cy(p, toon('#7d869a'), 0, 0, 0, 0.09, armY, 10, { rt: 0.75 });
  cyl2(p, toon('#7d869a'), [0, armY, 0], [armDx, armY + 0.14, 0], 0.06, 8, { rt: 0.7 });
  const hs = heads.map((dx) => {
    const h = signalHead(p, dx, armY - 0.3, 0.0, 0);
    cyl2(p, toon('#4a5266'), [dx, armY + 0.12, 0], [dx, armY - 0.14, 0], 0.025, 5);
    return h;
  });
  return hs;
}

/* ================================================================ lamp posts */
export function streetLamp(parent, x, z, dirx, dirz, h, armLen, color, lightI, name) {
  const p = grp(parent, x, Y0, z);
  cy(p, toon('#5f677c'), 0, 0, 0, 0.075, h, 10, { rt: 0.66 });
  cy(p, toon('#4a5266'), 0, 0, 0, 0.12, 0.35, 10, { rt: 0.65 });
  const ex = dirx * armLen, ez = dirz * armLen;
  cyl2(p, toon('#5f677c'), [0, h - 0.1, 0], [ex * 0.8, h + 0.35, ez * 0.8], 0.045, 8);
  cyl2(p, toon('#5f677c'), [ex * 0.8, h + 0.35, ez * 0.8], [ex, h + 0.28, ez], 0.04, 8);
  const hd = grp(p, ex, h + 0.2, ez, Math.atan2(dirx, dirz));
  bx(hd, toon('#3a4156'), -0.18, 0.18, 0.0, 0.1, -0.42, 0.42);
  // lens + halo + light follow the 'lamp' channel (sunset -> sunrise, see env.js lampsAt); unlit the lens is frosted grey
  bx(hd, glow(color, 3.2, { cat: 'lamp', off: '#b9bfc9' }), -0.14, 0.14, -0.02, 0.01, -0.36, 0.36, { cast: false });
  // snow caps (only visible when it has snowed): lamp head, the arm, the pole top
  snowCapBox(hd, -0.19, 0.19, 0.1, -0.43, 0.43, 0.075);
  snowCapLine(p, [0, h - 0.1, 0], [ex * 0.8, h + 0.35, ez * 0.8], 0.045);
  snowCapLine(p, [ex * 0.8, h + 0.35, ez * 0.8], [ex * 0.95, h + 0.3, ez * 0.95], 0.04);
  snowCapDome(p, 0, h, 0, 0.058);
  const hl = halo(p, ex, h + 0.12, ez, color, 3.2, 0.5, 'lamp');
  const L = lightI > 0.1 ? plight(p, color, lightI, 14, ex, h - 0.1, ez, name) : null;
  return { p, halo: hl, L };
}

/* ================================================================ guardrail */
export function guardrail(parent, x0, z0, x1, z1) {
  const g = grp(parent, 0, Y0, 0);
  const L = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(L / 1.3));
  const white = toon('#e8ebf2');
  const yel = toon('#e8c53a');
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(x0, x1, t), z = lerp(z0, z1, t);
    cy(g, white, x, 0, z, 0.028, 0.9, 8);
    cy(g, toon('#d9b32e', { e: '#4a3a08', ei: 0.4 }), x, 0.45, z, 0.03, 0.06, 8, { cast: false });
  }
  [0.86, 0.5].forEach((y, k) => {
    const rail = cyl2(g, k ? white : white, [x0, y, z0], [x1, y, z1], 0.022, 8);
  });
  cyl2(g, yel, [x0, 0.86, z0], [x1, 0.86, z1], 0.0, 4);
  return g;
}

/* ================================================================ misc small */
export function trashBins(parent, x, z, ry) {
  const g = grp(parent, x, Y0, z, ry);
  const cols = [['#2f7bd9', 'ペット\nボトル'], ['#7a8397', 'かん・\nびん'], ['#d8483f', '燃える\nごみ']];
  cols.forEach(([c, label], i) => {
    const px = (i - 1) * 0.52;
    bx(g, toon('#2d3446'), px - 0.24, px + 0.24, 0, 0.82, -0.24, 0.24);
    bx(g, toon(c), px - 0.25, px + 0.25, 0.8, 0.9, -0.25, 0.25);
    bx(g, toon('#0e121c'), px - 0.14, px + 0.14, 0.62, 0.7, 0.24, 0.26, { cast: false });
    const t = canvasTex(128, 128, (cc, w, h) => { cc.fillStyle = c; cc.fillRect(0, 0, w, h); const ls = label.split('\n'); ls.forEach((s, k) => T(cc, s, w / 2, 40 + k * 46, 34, '#fff', { weight: 800 })); });
    pl(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.8, 0.8, 0.8) }), 0.3, 0.3, px, 0.3, 0.252, 0, 0);
  });
  return g;
}

export function planter(parent, x, z, r = 0.3, plant = '#2f6f4e') {
  const g = grp(parent, x, Y0, z);
  cy(g, toon('#8a5a3c'), 0, 0, 0, r, r * 1.3, 12, { rt: 0.8 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 2.0, 5), toon(plant));
    l.position.set(Math.cos(a) * r * 0.45, r * 1.3 + r * 0.8, Math.sin(a) * r * 0.45);
    l.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    l.castShadow = true;
    g.add(l);
  }
  sph(g, toon(plant), r * 0.8, 0, r * 2.2, 0, 1, 0.9, 1);
  return g;
}

export function nobori(parent, x, z, text, bg, seed) {
  const g = grp(parent, x, Y0, z);
  cy(g, toon('#c9ced8'), 0, 0, 0, 0.03, 2.5, 6);
  cy(g, toon('#c9ced8'), 0, 0, 0, 0.12, 0.05, 10);
  cyl2(g, toon('#c9ced8'), [0, 2.45, 0], [0.34, 2.45, 0], 0.014, 5);
  const tex = canvasTex(128, 512, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h);
    c.font = `900 80px sans-serif`;
    [...text].forEach((ch, i) => T(c, ch, w / 2, 70 + i * 92, 84, '#fff', { weight: 900, stroke: 'rgba(0,0,0,0.3)', sw: 8 }));
  });
  const geo = new THREE.PlaneGeometry(0.46, 1.7, 5, 14);
  geo.translate(0.23, -0.85, 0);
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.85, 0.85, 0.85), side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = { value: 0 };
    m.userData.sh = sh;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uT;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
      float k = smoothstep(0.0, 0.46, position.x) * (0.4 + 0.6*smoothstep(-1.7, 0.0, position.y));
      transformed.z += sin(position.y*5.0 - uT*2.6 + ${seed.toFixed(1)}) * 0.045 * k + sin(position.y*11.0 - uT*4.1) * 0.012 * k;
      transformed.x -= (1.0 - cos(sin(position.y*5.0 - uT*2.6 + ${seed.toFixed(1)}) * 0.2)) * 0.1 * k;`);
  };
  const f = new THREE.Mesh(geo, m);
  f.position.set(0.0, 2.42, 0);
  f.userData.noLine = false;
  g.add(f);
  reg.updaters.push((t) => { if (m.userData.sh) m.userData.sh.uniforms.uT.value = t; });
  return g;
}

/* ================================================================ road sign plates */
export function signTexture(kind) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (kind === 'stop') {
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(10, 40); g.lineTo(246, 40); g.lineTo(128, 246); g.closePath(); g.fill();
      g.fillStyle = '#c91b1b';
      g.beginPath(); g.moveTo(38, 56); g.lineTo(218, 56); g.lineTo(128, 212); g.closePath(); g.fill();
      T(g, '止まれ', 128, 100, 40, '#fff', { weight: 900 });
    } else if (kind === 'p') {
      g.fillStyle = '#1255b5'; roundRect(g, 10, 10, 236, 236, 22); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 18, 18, 220, 220, 16); g.stroke();
      T(g, 'P', 128, 120, 170, '#fff', { weight: 900 });
      T(g, '駐車場', 128, 214, 36, '#fff');
    } else if (kind === '30') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
      g.strokeStyle = '#c91b1b'; g.lineWidth = 22; g.beginPath(); g.arc(128, 128, 98, 0, 7); g.stroke();
      T(g, '30', 128, 132, 110, '#111', { weight: 900 });
    } else if (kind === 'school') {
      g.fillStyle = '#f6d12a'; g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); roundRect(g, -88, -88, 176, 176, 12); g.fill(); g.restore();
      T(g, '学校', 128, 100, 44, '#111', { weight: 900 }); T(g, '注意', 128, 150, 44, '#111', { weight: 900 });
    } else if (kind === 'oneway') {
      g.fillStyle = '#1255b5'; g.fillRect(10, 60, 236, 136);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(16, 66, 224, 124);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(40, 112); g.lineTo(130, 112); g.lineTo(130, 90); g.lineTo(200, 128); g.lineTo(130, 166); g.lineTo(130, 144); g.lineTo(40, 144); g.closePath(); g.fill();
      T(g, '一方通行', 128, 178, 26, '#fff');
    } else if (kind === 'street') {
      g.fillStyle = '#134a9a'; roundRect(g, 4, 70, 248, 116, 14); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; roundRect(g, 10, 76, 236, 104, 10); g.stroke();
      T(g, '星空通り', 128, 112, 50, '#fff', { weight: 900 });
      T(g, 'Hoshizora-dori', 128, 160, 24, '#cfe4ff', { weight: 600 });
    } else if (kind === 'rail') {
      // 踏切あり: yellow diamond with the steam-loco pictogram
      g.fillStyle = '#f6d12a'; g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); roundRect(g, -84, -84, 168, 168, 12); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 8; roundRect(g, -76, -76, 152, 152, 9); g.stroke(); g.restore();
      g.fillStyle = '#111';
      g.fillRect(70, 118, 96, 34); g.fillRect(150, 92, 30, 60); g.fillRect(84, 98, 16, 22); g.fillRect(66, 152, 122, 8);
      [88, 118, 160].forEach((x) => { g.beginPath(); g.arc(x, 168, 12, 0, 7); g.fill(); });
    } else if (kind === '40') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
      g.strokeStyle = '#c91b1b'; g.lineWidth = 22; g.beginPath(); g.arc(128, 128, 98, 0, 7); g.stroke();
      T(g, '40', 128, 132, 110, '#1f4fb8', { weight: 900 });
    } else if (kind === 'curve') {
      g.fillStyle = '#f6d12a'; g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); roundRect(g, -84, -84, 168, 168, 12); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 8; roundRect(g, -76, -76, 152, 152, 9); g.stroke(); g.restore();
      g.strokeStyle = '#111'; g.lineWidth = 18; g.lineCap = 'round';
      g.beginPath(); g.moveTo(110, 190); g.lineTo(110, 130); g.quadraticCurveTo(110, 96, 146, 96); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(140, 70); g.lineTo(176, 96); g.lineTo(140, 122); g.closePath(); g.fill();
    } else if (kind === 'cross') {
      g.fillStyle = '#1255b5'; roundRect(g, 18, 18, 220, 220, 18); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(128, 40); g.lineTo(222, 214); g.lineTo(34, 214); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(128, 104, 13, 0, 7); g.fill(); g.fillRect(118, 118, 20, 44);
      g.fillRect(96, 196, 64, 8);
    } else if (kind === 'lake' || kind === 'station') {
      const lake = kind === 'lake';
      g.fillStyle = '#134a9a'; roundRect(g, 4, 54, 248, 148, 14); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; roundRect(g, 10, 60, 236, 136, 10); g.stroke();
      T(g, lake ? '星空湖' : '星空駅', 112, 108, 46, '#fff', { weight: 900 });
      T(g, lake ? 'Hoshizora Lake' : 'Hoshizora Sta.', 112, 152, 22, '#cfe4ff', { weight: 600 });
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(200, 84); g.lineTo(232, 128); g.lineTo(212, 128); g.lineTo(212, 170); g.lineTo(188, 170); g.lineTo(188, 128); g.lineTo(168, 128); g.closePath(); g.fill();
    }
  });
}

export function roadSign(parent, x, z, ry, kind, h = 2.6, size = 0.7) {
  const g = grp(parent, x, Y0, z, ry);
  cy(g, toon('#8d96aa'), 0, 0, 0, 0.03, h, 8);
  const mat = new THREE.MeshBasicMaterial({ map: signTexture(kind), color: new THREE.Color(0.95, 0.95, 0.98), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  pl(g, mat, size, size, 0, h - size * 0.4, 0.04, 0, 0, { noLine: false });
  // reflective sparkle
  return g;
}

/* ================================================================ pylon sign */
function pylonSign(parent, x, z) {
  const g = grp(parent, x, Y0, z);
  cy(g, toon('#c9ced8'), 0, 0, 0, 0.14, 3.8, 12);
  cy(g, toon('#99a2b6'), 0, 0, 0, 0.3, 0.22, 12, { rt: 0.6 });
  const tex = canvasTex(400, 900, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1f6fd2'); gr.addColorStop(1, '#1858b4');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6f9fd'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 40, w, 40);
    c.fillStyle = BRAND.orange; c.fillRect(0, h - 52, w, 8);
    logo(c, w / 2, 250, 150);
    c.fillStyle = '#f6f9fd'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#f6f9fd';
    c.font = `900 96px "Rockwell Extra Bold","Rockwell","Roboto Slab","Georgia",serif`;
    c.strokeText('LAWSON', w / 2, 520); c.fillText('LAWSON', w / 2, 520);
    c.font = `800 40px sans-serif`;
    c.fillText('ローソン', w / 2, 600);
    c.fillStyle = '#f6f9fd'; roundRect(c, 90, 665, 220, 120, 26); c.fill();
    c.fillStyle = BRAND.teal; c.font = `900 84px sans-serif`; c.fillText('24h', w / 2, 722);
    c.font = `800 26px sans-serif`; c.fillText('OPEN', w / 2, 768);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.05, 1.03, 0.98) });
  const box = bx(g, toon('#eef3fa', { e: '#8a93a6', ei: 0.4 }), -0.6, 0.6, 3.7, 6.0, -0.17, 0.17);
  const f = pl(g, mat, 1.14, 2.22, 0, 4.85, 0.172, 0, 0);
  const b = pl(g, mat, 1.14, 2.22, 0, 4.85, -0.172, Math.PI, 0);
  bx(g, toon(BRAND.teal, { e: '#0a2a5c', ei: 0.6 }), -0.62, 0.62, 6.0, 6.08, -0.19, 0.19, { cast: false });
  halo(g, 0, 4.85, 0.5, '#dcecff', 4.2, 0.26);
  reg.pylonMat = mat;
  {
    const ct = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#c9342b'; roundRect(c, 4, 4, w - 8, h - 8, 22); c.fill(); c.fillStyle = '#fff'; c.font = '900 52px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CLOSED', w / 2, h * 0.38); c.font = '800 34px sans-serif'; c.fillText('準備中', w / 2, h * 0.76); });
    const badge = pl(g, new THREE.MeshBasicMaterial({ map: ct, color: new THREE.Color(1.1, 1.1, 1.1) }), 0.66, 0.33, 0, 4.17, 0.176, 0, 0);
    badge.visible = false;
    reg.pylonClosed = badge;
  }
  return g;
}

/* ================================================================ cat */
export function cat(parent, x, y, z, ry) {
  const g = grp(parent, x, y, z, ry);
  const fur = toon('#171a26');
  sph(g, fur, 0.13, 0, 0.14, 0, 1, 1.0, 1.35);
  sph(g, fur, 0.105, 0, 0.3, 0.17);
  [-0.06, 0.06].forEach((ex) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur);
    e.position.set(ex, 0.4, 0.17); e.castShadow = true; g.add(e);
    sph(g, glow('#ffe36a', 2.6), 0.017, ex * 0.7, 0.31, 0.27, 1, 1.2, 0.5);
  });
  const tail = grp(g, 0, 0.12, -0.17);
  tail.userData.keep = true;
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.34, 6), fur);
  tl.position.set(0, 0.13, -0.05); tl.rotation.x = -0.5; tail.add(tl);
  reg.updaters.push((t) => { tail.rotation.z = Math.sin(t * 1.6) * 0.4; tail.rotation.y = Math.sin(t * 0.9) * 0.3; });
  return g;
}

/* ================================================================ bulletin board */
function bulletinBoard(parent, x, z, ry) {
  const g = grp(parent, x, Y0, z, ry);
  const wood = toon('#6b4a35');
  [-0.62, 0.62].forEach((px) => cy(g, wood, px, 0, 0, 0.04, 1.9, 6));
  bx(g, toon('#3a2d26'), -0.7, 0.7, 1.0, 1.9, -0.05, 0.05);
  bx(g, toon('#c9a77a', { lit: 0.12 }), -0.64, 0.64, 1.06, 1.84, 0.05, 0.065, { cast: false });
  [[0, -0.34, 1.62, 0.4, 0.55], [4, 0.18, 1.58, 0.42, 0.56], [5, -0.04, 1.3, 0.28, 0.38], [2, 0.42, 1.3, 0.3, 0.4], [3, -0.4, 1.28, 0.26, 0.36]].forEach(([p, px, py, w, h], i) => {
    pl(g, new THREE.MeshBasicMaterial({ map: posterTex(p), color: new THREE.Color(0.7, 0.7, 0.72) }), w, h, px, py, 0.07, 0.04 * (i - 2), 0, { noLine: true });
  });
  pl(g, makeGlass(1.28, 0.78, 21, { drops: 0.8, alpha: 0.05 }), 1.28, 0.78, 0, 1.45, 0.14, 0, 0, { noLine: true });
  // little roof
  bx(g, toon('#2f3b52'), -0.78, 0.78, 1.9, 1.96, -0.22, 0.3);
  bx(g, toon('#2f3b52'), -0.78, 0.78, 1.94, 2.02, -0.22, -0.16);
  return g;
}

/* ================================================================ wheel stop */
function wheelStop(parent, x, z) {
  const m = bx(parent, toon('#7d8499'), x - 0.35, x + 0.35, Y0, Y0 + 0.1, z - 0.06, z + 0.06);
  return m;
}

/* ================================================================ kei car */
function prism(profile, width, mat, parent, bevel = 0.05) {
  const sh = new THREE.Shape();
  profile.forEach(([z, y], i) => (i ? sh.lineTo(-z, y) : sh.moveTo(-z, y)));
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function keiCar(parent, x, z, ry, color) {
  const g = grp(parent, x, Y0, z, ry);
  const body = toon(color);
  const dark = toon('#1a2030');
  // side profile (z forward, y up), extruded across the car
  prism([[-1.4, 0.3], [1.38, 0.3], [1.42, 0.66], [1.18, 0.86], [0.66, 0.92], [0.42, 1.44], [-0.98, 1.46], [-1.22, 0.96], [-1.42, 0.86]], 1.4, body, g, 0.06);
  prism([[0.55, 0.98], [0.4, 1.38], [-0.95, 1.4], [-1.12, 0.98]], 1.52, toon('#1a2438', { e: '#0a1a30', ei: 0.7 }), g, 0.0);
  bx(g, body, -0.76, 0.76, 0.9, 1.44, -0.22, -0.13, { cast: false });
  [[-0.7, -0.85], [0.7, -0.85], [-0.7, 0.85], [0.7, 0.85]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), dark);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.28, wz); w.castShadow = true; g.add(w);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 10), toon('#9aa3b6'));
    h.rotation.z = Math.PI / 2; h.position.set(wx, 0.28, wz); g.add(h);
  });
  bx(g, glow('#ff2a2a', 2.2), -0.64, -0.3, 0.62, 0.78, -1.5, -1.47, { cast: false });
  bx(g, glow('#ff2a2a', 2.2), 0.3, 0.64, 0.62, 0.78, -1.5, -1.47, { cast: false });
  bx(g, glow('#fff1c0', 1.6), -0.62, -0.32, 0.56, 0.7, 1.46, 1.49, { cast: false });
  bx(g, glow('#fff1c0', 1.6), 0.32, 0.62, 0.56, 0.7, 1.46, 1.49, { cast: false });
  bx(g, toon('#e8ecf5'), -0.18, 0.18, 0.42, 0.52, -1.5, -1.47, { cast: false });
  halo(g, -0.47, 0.7, -1.6, '#ff4040', 0.8, 0.5);
  halo(g, 0.47, 0.7, -1.6, '#ff4040', 0.8, 0.5);
  return g;
}

/* ================================================================ MAIN */
export function buildStreet(parent, drips) {
  const g = grp(parent);
  const R = rng(9);

  /* ---- vending machines on the store's east wall (facing east) ---- */
  const vm = [
    vendingMachine(g, 5.0, -3.95, Math.PI / 2, 0, 3, true),
    vendingMachine(g, 5.0, -2.95, Math.PI / 2, 1, 8),
  ];
  reg.vend = vm;
  trashBins(g, 5.1, -1.7, Math.PI / 2);
  // vending machine at the alley mouth (green)
  const vm3 = vendingMachine(g, -8.1, -2.5, Math.PI / 2, 2, 5);
  vm.push(vm3);

  /* ---- bikes ---- */
  bicycle(g, 5.85, 0.95, 0.04, '#8cc4d8', 0, { type: 'basket', e: true, steer: 0.22 });
  bicycle(g, 5.95, -0.95, -0.03, '#4a515c', 0.11, { type: 'cross', steer: -0.12 });
  bicycle(g, 3.85, 2.05, Math.PI / 2, '#d8574f', 0, { type: 'basket', steer: -0.2 });
  bicycle(g, -6.25, 4.0, 0.15, '#2f6f8f', 0.12, { type: 'cross', steer: 0.15 });
  umbrellaStand(g, 0.85, 1.85);

  /* ---- flags / signs ---- */
  nobori(g, 0.75, 3.05, 'おでん始めました', '#c2181c', 1.3);
  nobori(g, 4.8, 3.05, 'あたたかコーヒー', '#1c63c4', 4.2);
  pylonSign(g, -5.0, 6.0);

  /* ---- two short yellow pipe barriers on the apron (as in the reference) ---- */
  [[-2.1, 2.45], [-0.5, 2.45]].forEach(([x, z]) => {
    const ym = toon('#e8b82a', { e: '#4a3808', ei: 0.4 });
    [-0.4, 0.4].forEach((dx) => cy(g, ym, x + dx, Y0, z, 0.025, 0.55, 8));
    cyl2(g, ym, [x - 0.4, Y0 + 0.55, z], [x + 0.4, Y0 + 0.55, z], 0.025, 8);
    cyl2(g, ym, [x - 0.4, Y0 + 0.28, z], [x + 0.4, Y0 + 0.28, z], 0.02, 8);
  });

  /* ---- guardrails ---- */
  guardrail(g, 1.0, 6.2, 4.9, 6.2);
  guardrail(g, 7.33, -0.4, 7.33, 3.9);
  guardrail(g, 4.9, 6.2, 4.9, 5.45);

  /* ---- wheel stops & parked kei car ---- */
  [-4.9, -3.2, -1.5].forEach((x) => wheelStop(g, x, 5.5));
  keiCar(g, -4.9, 4.15, Math.PI, '#d8e0ee');

  /* ---- street lamps ---- */
  const L1 = streetLamp(g, 7.0, 2.6, 1, 0, 5.0, 1.9, '#ffe0a8', 60, 'lamp1');
  const L2 = streetLamp(g, -8.3, 6.15, 0, 1, 5.0, 1.8, '#d6e8ff', 40, 'lamp2');
  const L3 = streetLamp(g, 7.2, -8.5, 1, 0, 5.0, 1.9, '#ffe0a8', 0.01, 'lamp3');
  reg.lampHalos = [L1.halo, L2.halo];

  /* ---- utility poles & wires ---- */
  const U = [
    [7.0, 4.3, 7.4, 'z'],
    [7.0, -1.0, 7.4, 'z'],
    [7.0, -9.2, 7.4, 'z'],
    [-1.8, 6.05, 7.2, 'x'],
    [-11.0, 6.05, 7.2, 'x'],
  ];
  U.forEach((u) => utilityPole(g, u[0], u[1], u[2], u[3]));
  const wl = (a, b, sag, offs) => offs.forEach((o) => wire(g, [a[0] + o[0], a[1] + o[1], a[2] + o[2]], [b[0] + o[0], b[1] + o[1], b[2] + o[2]], sag));
  const top = (u) => u[2] + Y0;
  const zoff = [[-0.8, -0.15, 0], [0, -0.15, 0], [0.8, -0.15, 0], [-0.6, -0.95, 0], [0.6, -0.95, 0]];
  wl([7.0, top(U[0]), U[0][1]], [7.0, top(U[1]), U[1][1]], 0.6, zoff);
  wl([7.0, top(U[1]), U[1][1]], [7.0, top(U[2]), U[2][1]], 0.7, zoff);
  const xoff = [[0, -0.15, -0.8], [0, -0.15, 0], [0, -0.15, 0.8], [0, -0.95, -0.6], [0, -0.95, 0.6]];
  wl([-1.8, top(U[3]), U[3][1]], [-11.0, top(U[4]), U[4][1]], 0.9, xoff);
  wire(g, [7.0, top(U[0]) - 0.15, 4.3], [-1.8, top(U[3]) - 0.15, 6.05], 1.1);
  // service drop to the store roof
  wire(g, [7.0, top(U[1]) - 0.95, -1.0], [4.55, 3.7, -1.0], 0.5, 0.015);
  wire(g, [7.0, top(U[1]) - 0.95, -0.8], [4.55, 3.85, -1.2], 0.5, 0.015);
  // drop to the neighbour house
  wire(g, [-11.0, top(U[4]) - 0.95, 6.05], [-10.0, 6.6, 4.3], 0.5, 0.015);
  // stray crossing wire at the alley

  /* ---- traffic signals ---- */
  const near = mastSignals(g, 7.2, 6.0, 3.6, 4.7, [1.0, 2.5, 3.5], 'near');
  const far = mastSignals(g, 12.45, -9.6, -4.1, 4.7, [-1.9, -3.3, -4.1], 'far'); // pole on the new east sidewalk
  // pedestrian signal boxes
  const peds = [];
  [[6.95, 5.5, Math.PI / 2], [5.85, 6.3, 0]].forEach(([x, z, ry]) => {
    const p = grp(g, x, Y0, z, ry);
    p.scale.setScalar(0.7);
    cy(p, toon('#7d869a'), 0, 0, 0, 0.04, 2.3, 8);
    bx(p, toon('#2b3242'), -0.16, 0.16, 2.1, 2.62, -0.07, 0.07);
    const mR = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.15, 0.1).multiplyScalar(0.1) });
    const mG = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.0, 0.6).multiplyScalar(0.1) });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mR); r.position.set(0, 2.5, 0.075); p.add(r);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mG); gr.position.set(0, 2.22, 0.075); p.add(gr);
    bx(p, toon('#f2c230'), -0.1, 0.1, 1.5, 1.7, 0.04, 0.06, { cast: false });
    peds.push({ mR, mG });
  });
  const sigLight = plight(g, '#ff4040', 5, 9, 9.2, 4.0, 5.2, 'sigNear');
  const sigLightFar = { color: new THREE.Color() };
  const CYC = 19;
  reg.updaters.push((t) => {
    const k = t % CYC;
    let phaseNear = k < 8 ? 'g' : k < 9.6 ? 'y' : 'r';
    const phaseFar = k < 10.5 ? 'r' : k < 18.5 ? 'g' : 'y';
    const setH = (hs, ph) => hs.forEach((h) => h.lens.forEach((l) => {
      const on = l.k === ph;
      l.m.color.copy(l.c).multiplyScalar(on ? 3.0 : 0.09);
      l.halo.material.opacity = on ? 0.9 : 0;
    }));
    setH(near, phaseNear);
    setH(far, phaseFar);
    // pedestrian lights are the opposite of the road
    peds.forEach((p) => {
      const walk = phaseNear === 'r';
      p.mG.color.setRGB(0.2, 1.0, 0.6).multiplyScalar(walk ? 2.6 : 0.08);
      p.mR.color.setRGB(1.0, 0.15, 0.1).multiplyScalar(walk ? 0.08 : 2.6);
    });
    sigLight.color.set(phaseNear === 'g' ? '#4cffb0' : phaseNear === 'y' ? '#ffc23a' : '#ff4040');
    sigLightFar.color.set(phaseFar === 'g' ? '#4cffb0' : phaseFar === 'y' ? '#ffc23a' : '#ff4040');
  });

  /* ---- road signs ---- */
  roadSign(g, -5.95, 5.95, 0, 'p', 2.4, 0.62);
  roadSign(g, 7.2, -3.2, Math.PI / 2, '30', 2.6, 0.6);
  roadSign(g, 7.2, -6.0, Math.PI / 2, 'oneway', 2.6, 0.8);
  // street name plate on the corner lamp
  pl(g, new THREE.MeshBasicMaterial({ map: signTexture('street'), color: new THREE.Color(1.0, 1.0, 1.05), transparent: true, alphaTest: 0.1 }), 0.7, 0.7, 7.2, Y0 + 3.6, 2.7 + 0.1, 0, 0);

  /* ---- bulletin board + planters ---- */
  planter(g, -4.55, 1.75, 0.22, '#2f6f4e');
  // (the izakaya entrance pots are terracotta plants now: plants/placement.js)

  /* ---- cat watching the rain ---- */
  cat(g, -6.0, Y0 + 0.5, 2.9, 0.4);
  bx(g, toon('#8a6b45'), -6.35, -5.75, Y0, Y0 + 0.5, 2.6, 3.2);
  bx(g, toon('#7a5d3b'), -6.35, -5.75, Y0 + 0.5, Y0 + 0.54, 2.6, 3.2);

  return { vending: vm, lamps: [L1, L2], pylonMat: reg.pylonMat };
}
