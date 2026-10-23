import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, grp, pl, canvasTex, halo, rng, roundRect, FONT, RAMP, patchToon } from '../core.js';
import { T } from '../tex.js';
import { vendingMachine, trashBins, planter, bicycle } from '../street.js';
import { PLOTS, groundY, PAV } from './layout.js';

/* ====================================================================================================
   Building kit for the town: Japanese houses and small shops in a clean, warm stylised look.
   white / cream plaster · dark timber frame · layered tiled eaves (main gable + pent roof 庇) ·
   lattice windows and doors · noren · sign boards · lanterns · breeze-block walls with gates ·
   vending corners. Every building is built in a local frame (front = +z) and then turned to face its road.
   Edges come from chamfered boxes + material contrast (no heavy ink).
   ==================================================================================================== */

const M = {
  plaster: toon('#eee7da'), cream: toon('#ecdcb4'), sand: toon('#e3cf9b'),
  wood: toon('#5b3a26'), woodM: toon('#8a5a36'), woodL: toon('#b07a48'),
  stone: toon('#8e8b86'), stoneD: toon('#706d6a'), block: toon('#d6cfbf'), blockCap: toon('#bdb5a4'),
  metal: toon('#8d939e'), dark: toon('#2b2f38'), glass: toon('#3a4a5e', { e: '#0a1220', ei: 0.6 }),
  white: toon('#f4f2ec'),
};

/* ---------------------------------------------------------------- textures */
const texCache = new Map();
const once = (k, f) => { if (!texCache.has(k)) texCache.set(k, f()); return texCache.get(k); };
function tileTex(col) {
  // one pan tile per texture tile: a rounded rib running down the slope + the shadow line of the next course
  return once('tile' + col, () => canvasTex(64, 64, (g, w, h) => {
    const c = new THREE.Color(col);
    const hsl = {}; c.getHSL(hsl);
    const tone = (dl) => `hsl(${hsl.h * 360}, ${hsl.s * 100}%, ${Math.max(0, Math.min(100, (hsl.l + dl) * 100))}%)`;
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, tone(-0.12)); gr.addColorStop(0.18, tone(-0.02)); gr.addColorStop(0.5, tone(0.08)); gr.addColorStop(0.82, tone(-0.02)); gr.addColorStop(1, tone(-0.13));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, h - 14, 0, h);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = sh; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = tone(0.12); g.fillRect(0, 0, w, 3); // lit lip of the course
  }, { repeat: true }));
}
function blockTex() {
  return once('block', () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d9d2c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,72,60,0.45)'; g.lineWidth = 3;
    for (let r = 0; r < 2; r++) { g.beginPath(); g.moveTo(0, r * 64 + 1); g.lineTo(w, r * 64 + 1); g.stroke(); for (let i = 0; i <= 2; i++) { const x = i * 128 + (r ? 64 : 0); g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); } }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,50,40'},0.06)`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 2 + Math.random() * 4); }
  }, { repeat: true }));
}
function breezeTex() {
  // the decorative openwork block (花ブロック) of Japanese garden walls
  return once('breeze', () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ddd6c6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,72,60,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#4a4640';
    [[32, 32], [96, 32], [32, 96], [96, 96]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 22, 12, Math.PI / 4 * ((x + y) % 128 ? 1 : -1), 0, 7); g.fill(); });
    g.beginPath(); g.arc(64, 64, 10, 0, 7); g.fill();
  }));
}
function signTex(text, sub, bg, fg, vertical = false) {
  return once(`sign|${text}|${sub}|${bg}|${fg}|${vertical}`, () => vertical
    ? canvasTex(96, 384, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
      [...text].forEach((ch, i) => T(g, ch, w / 2, 58 + i * 80, 64, fg, { weight: 900 }));
    })
    : canvasTex(512, 160, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
      if (sub) T(g, sub, w / 2, 34, 26, fg === '#ffffff' ? '#ffd9a0' : '#3f7a3a', { weight: 700 });
      T(g, text, w / 2, sub ? 100 : 84, sub ? 78 : 92, fg, { weight: 900 });
    }));
}
function norenTex(text, bg) {
  return once(`noren|${text}|${bg}`, () => canvasTex(512, 192, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const n = 4;
    for (let i = 1; i < n; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect((i * w) / n - 2, 26, 4, h); }
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, w, 18);
    [...text].forEach((ch, i) => T(g, ch, ((i + 0.5) * w) / Math.max(n, text.length), 112, 84, '#f6f1e6', { weight: 900 }));
  }));
}
function sudareTex() {
  return once('sudare', () => canvasTex(64, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? '#c9a873' : '#b38d58'; g.fillRect(0, y, w, 3); }
    g.fillStyle = 'rgba(60,40,20,0.45)'; g.fillRect(14, 0, 3, h); g.fillRect(46, 0, 3, h);
  }, { repeat: true }));
}

/* ---------------------------------------------------------------- pieces */
const tileMat = (col) => patchToon(new THREE.MeshToonMaterial({ color: 0xffffff, map: tileTex(col), gradientMap: RAMP }));
const tileMats = new Map();
const tiles = (col) => { if (!tileMats.has(col)) tileMats.set(col, tileMat(col)); return tileMats.get(col); };

function tiledPlane(parent, w, len, mat) {
  const geo = new THREE.PlaneGeometry(w, len);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.3), uv.getY(i) * (len / 0.26));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true; m.castShadow = true;
  parent.add(m);
  return m;
}

/** gable roof, ridge along x. y = eave-line height on the wall, D = depth covered */
function gable(parent, W, D, y, { pitch = 0.46, ov = 0.45, col = '#6e4a38', gableWall = M.plaster } = {}) {
  const run = (D / 2 + ov) / Math.cos(pitch), rise = (D / 2) * Math.tan(pitch);
  const thick = 0.12;
  [-1, 1].forEach((s) => {
    const g = grp(parent, 0, y + rise - ((D / 2 + ov) / 2) * Math.tan(pitch) + 0.02, (s * (D / 2 + ov)) / 2);
    g.rotation.x = s * pitch;
    bx(g, M.wood, -W / 2 - ov, W / 2 + ov, -thick / 2, thick / 2, -run / 2, run / 2);
    const t = tiledPlane(g, W + ov * 2 + 0.02, run + 0.02, tiles(col));
    t.position.y = thick / 2 + 0.006;
    // eave fascia
    bx(g, M.woodM, -W / 2 - ov, W / 2 + ov, -thick / 2 - 0.02, thick / 2 + 0.05, s * run / 2 - 0.05, s * run / 2 + 0.05);
  });
  // ridge cap
  const rc = grp(parent, 0, y + rise + 0.06, 0);
  bx(rc, toon(new THREE.Color(col).multiplyScalar(0.72).getStyle()), -W / 2 - ov - 0.05, W / 2 + ov + 0.05, -0.02, 0.16, -0.16, 0.16);
  // gable triangles + barge boards
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false });
  tg.rotateY(Math.PI / 2);
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(tg, gableWall);
    m.position.set(s * (W / 2) - 0.03, y, 0); m.castShadow = true; m.receiveShadow = true; parent.add(m);
    // a little vent + the dark timber boards along the slope
    bx(parent, M.wood, s * (W / 2) - 0.02 + s * 0.02, s * (W / 2) + s * 0.06, y + rise * 0.45, y + rise * 0.62, -0.18, 0.18);
  });
  return rise;
}
/** pent roof (庇) sloping out from the wall face at local z = z0 */
function pent(parent, x0, x1, y, z0, depth, { pitch = 0.32, col = '#6e4a38', brackets = true } = {}) {
  const run = depth / Math.cos(pitch);
  const g = grp(parent, (x0 + x1) / 2, y - (depth / 2) * Math.tan(pitch), z0 + depth / 2);
  g.rotation.x = pitch;
  bx(g, M.wood, -(x1 - x0) / 2, (x1 - x0) / 2, -0.05, 0.05, -run / 2, run / 2);
  const t = tiledPlane(g, x1 - x0 + 0.02, run + 0.02, tiles(col));
  t.position.y = 0.056;
  bx(g, M.woodM, -(x1 - x0) / 2, (x1 - x0) / 2, -0.07, 0.08, run / 2 - 0.05, run / 2 + 0.04);
  if (brackets) for (let x = x0 + 0.3; x <= x1 - 0.29; x += Math.max(1.2, (x1 - x0 - 0.6) / 3)) cyl2(parent, M.wood, [x, y - 0.38, z0], [x, y - 0.08, z0 + depth * 0.7], 0.04, 5, { cast: true });
}
/** lattice window / door: frame + glass + slats (+ optional bamboo blind) */
function lattice(parent, x, y, z, w, h, { slats = 0, glowK = 0.75, sudare = false, horiz = 0, frame = M.wood } = {}) {
  const f = 0.06;
  bx(parent, frame, x - w / 2, x + w / 2, y, y + f, z - 0.05, z + 0.05);
  bx(parent, frame, x - w / 2, x + w / 2, y + h - f, y + h, z - 0.05, z + 0.05);
  bx(parent, frame, x - w / 2, x - w / 2 + f, y, y + h, z - 0.05, z + 0.05);
  bx(parent, frame, x + w / 2 - f, x + w / 2, y, y + h, z - 0.05, z + 0.05);
  // glass with warm interior light behind (night)
  pl(parent, glow('#ffd8a0', glowK, { cat: 'iza' }), w - f * 2, h - f * 2, x, y + h / 2, z - 0.02, 0, 0, { noLine: true });
  if (sudare) pl(parent, new THREE.MeshToonMaterial({ map: sudareTex(), gradientMap: RAMP }), w - f * 2, (h - f * 2) * 0.6, x, y + h - f - (h - f * 2) * 0.3, z + 0.01, 0, 0);
  for (let i = 1; i <= slats; i++) { const sx = x - w / 2 + (w * i) / (slats + 1); bx(parent, frame, sx - 0.018, sx + 0.018, y + f, y + h - f, z - 0.03, z + 0.03, { cast: false }); }
  for (let i = 1; i <= horiz; i++) { const sy = y + (h * i) / (horiz + 1); bx(parent, frame, x - w / 2 + f, x + w / 2 - f, sy - 0.015, sy + 0.015, z - 0.03, z + 0.03, { cast: false }); }
}
function wallLamp(parent, x, y, z) {
  bx(parent, M.dark, x - 0.08, x + 0.08, y - 0.12, y + 0.14, z, z + 0.16);
  bx(parent, glow('#ffd59a', 2.2, { cat: 'iza' }), x - 0.06, x + 0.06, y - 0.1, y + 0.1, z + 0.1, z + 0.17, { cast: false });
  halo(parent, x, y, z + 0.25, '#ffc880', 0.9, 0.45);
}
function acUnit(parent, x, y, z, ry = 0) {
  const g = grp(parent, x, y, z, ry);
  bx(g, M.white, -0.36, 0.36, 0, 0.5, -0.14, 0.14);
  const fan = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 18), M.metal); fan.position.set(-0.08, 0.25, 0.145); g.add(fan);
  bx(g, M.metal, 0.12, 0.3, 0.06, 0.44, 0.14, 0.15, { cast: false });
}
function lantern(parent, x, y, z, text = '') {
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), glow('#fff1d6', 1.6, { cat: 'iza' }));
  l.scale.set(0.85, 1.15, 0.85); l.position.set(x, y, z); parent.add(l);
  cy(parent, M.dark, x, y + 0.17, z, 0.07, 0.05, 8); cy(parent, M.dark, x, y - 0.24, z, 0.07, 0.05, 8);
  if (text) {
    const t = once('lan' + text, () => canvasTex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); T(g, text, 64, 64, 80, '#c42f22', { weight: 900 }); }));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    f.position.set(x, y, z + 0.155); f.userData.noLine = true; parent.add(f);
  }
  halo(parent, x, y, z + 0.05, '#ffd9a0', 1.1, 0.4);
}

/* ---------------------------------------------------------------- the block wall (with breeze blocks + gate) */
function blockWall(parent, x0, x1, z, h, gate) {
  const bm = new THREE.MeshToonMaterial({ map: blockTex(), gradientMap: RAMP });
  patchToon(bm);
  const seg = (a, b) => {
    if (b - a < 0.05) return;
    // own geometry so the block texture repeats in world units (40 x 20 cm blocks)
    const geo = new THREE.BoxGeometry(b - a, h, 0.16);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((b - a) / 0.8), uv.getY(i) * (h / 0.4));
    const m = new THREE.Mesh(geo, bm);
    m.position.set((a + b) / 2, h / 2, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    bx(parent, M.blockCap, a - 0.02, b + 0.02, h, h + 0.06, z - 0.1, z + 0.1);
    // a row of decorative openwork blocks near the top
    const bz = new THREE.MeshToonMaterial({ map: breezeTex(), gradientMap: RAMP });
    for (let x = a + 0.35; x + 0.3 < b; x += 1.6) { pl(parent, bz, 0.36, 0.36, x + 0.18, h - 0.28, z + 0.085, 0, 0, { noLine: true }); pl(parent, bz, 0.36, 0.36, x + 0.18, h - 0.28, z - 0.085, Math.PI, 0, { noLine: true }); }
  };
  if (gate) {
    seg(x0, gate[0]); seg(gate[1], x1);
    [gate[0], gate[1]].forEach((gx) => bx(parent, M.stone, gx - 0.13, gx + 0.13, 0, h + 0.25, z - 0.13, z + 0.13));
  } else seg(x0, x1);
}

/* ---------------------------------------------------------------- building types */
const SHOPS = [
  { name: '江戸前寿司', sub: '季節の旬のお寿司', noren: '寿司', nbg: '#22365e', sbg: '#f4f0e4', sfg: '#2a2622', v: 'すし処' },
  { name: '和菓子 松月', sub: '', noren: '和菓子', nbg: '#4a2a1e', sbg: '#2a2622', sfg: '#ffffff', v: 'だんご' },
  { name: 'とうふ', sub: '手づくり', noren: 'とうふ', nbg: '#f1ece0', sbg: '#f4f0e4', sfg: '#2a2622', v: '豆腐' },
  { name: '甘味処', sub: 'あんみつ・かき氷', noren: '甘味', nbg: '#7a2a2a', sbg: '#f4f0e4', sfg: '#7a2a2a', v: 'うじ茶' },
  { name: '喫茶 ひだまり', sub: 'COFFEE', noren: '', nbg: '#2c4a3a', sbg: '#2c4a3a', sfg: '#ffffff', v: '珈琲' },
  { name: '八百屋', sub: '新鮮野菜', noren: '八百屋', nbg: '#2f5a32', sbg: '#f4f0e4', sfg: '#2f5a32', v: '野菜' },
];

function shop(g, W, D, R, kind) {
  const S = SHOPS[kind % SHOPS.length];
  const wall = R() < 0.5 ? M.plaster : M.cream;
  const H1 = 2.9, H2 = 2.6;
  const roofCol = ['#6e4a38', '#4a4448', '#5a3e36'][(R() * 3) | 0];
  // ground floor body + timber posts
  bx(g, wall, -W / 2, W / 2, 0, H1, -D / 2, D / 2 - 0.35);
  [-W / 2, W / 2].forEach((x) => bx(g, M.wood, x - 0.08, x + 0.08, 0, H1 + H2, D / 2 - 0.45, D / 2 - 0.27));
  bx(g, M.wood, -W / 2, W / 2, H1 - 0.12, H1 + 0.02, D / 2 - 0.45, D / 2 - 0.27);
  // open shop front: dark recess, display counter with goods, sliding door, noren
  const fx0 = -W / 2 + 0.25, fx1 = W / 2 - 0.25;
  bx(g, M.dark, fx0, fx1, 0.05, 2.3, D / 2 - 0.4, D / 2 - 0.36, { cast: false });
  pl(g, glow('#ffe2b8', 0.85, { cat: 'iza' }), fx1 - fx0 - 0.1, 2.15, (fx0 + fx1) / 2, 1.2, D / 2 - 0.35, 0, 0, { noLine: true });
  const cx1 = fx0 + (fx1 - fx0) * 0.55;
  bx(g, M.woodM, fx0 + 0.05, cx1, 0, 0.9, D / 2 - 0.35, D / 2 + 0.05);
  bx(g, M.woodL, fx0, cx1 + 0.05, 0.9, 0.96, D / 2 - 0.38, D / 2 + 0.1);
  const goods = ['#e85a4f', '#f2c14e', '#7ec46a', '#f4f0e8', '#d98c4a'];
  for (let i = 0; i < 6; i++) { const x = fx0 + 0.25 + i * ((cx1 - fx0 - 0.3) / 6); bx(g, toon(goods[(i + kind) % goods.length]), x, x + 0.22, 0.96, 1.06 + R() * 0.06, D / 2 - 0.25, D / 2 - 0.02, { cast: false }); }
  lattice(g, (cx1 + fx1) / 2 + 0.05, 0.02, D / 2 - 0.3, fx1 - cx1 - 0.15, 2.15, { slats: 3, glowK: 0.9 });
  if (S.noren) {
    const n = new THREE.MeshToonMaterial({ map: norenTex(S.noren, S.nbg), gradientMap: RAMP, side: THREE.DoubleSide });
    pl(g, n, fx1 - fx0 - 0.2, 0.62, (fx0 + fx1) / 2, 1.98, D / 2 + 0.12, 0, 0);
    cyl2(g, M.woodL, [fx0, 2.31, D / 2 + 0.12], [fx1, 2.31, D / 2 + 0.12], 0.025, 6);
  }
  // pent roof over the shop front, sign board above it
  pent(g, -W / 2 - 0.15, W / 2 + 0.15, H1 + 0.05, D / 2 - 0.27, 1.05, { col: roofCol });
  const sg = new THREE.MeshBasicMaterial({ map: signTex(S.name, S.sub, S.sbg, S.sfg), color: new THREE.Color(0.95, 0.94, 0.9) });
  bx(g, M.wood, -W * 0.32 - 0.06, W * 0.32 + 0.06, H1 + 0.42, H1 + 1.28, D / 2 - 0.3, D / 2 - 0.2);
  pl(g, sg, W * 0.64, 0.8, 0, H1 + 0.85, D / 2 - 0.19, 0, 0);
  // vertical hanging sign at the side
  const vs = new THREE.MeshBasicMaterial({ map: signTex(S.v, '', '#f4f0e4', '#2a2622', true), color: new THREE.Color(0.95, 0.94, 0.9) });
  const V = grp(g, W / 2 + 0.05, H1 - 0.1, D / 2 + 0.1, Math.PI / 2);
  bx(V, M.wood, -0.03, 0.03, 0.3, 1.5, -0.2, 0.2);
  pl(V, vs, 0.34, 1.2, 0, 0.9, 0.035, 0, 0); pl(V, vs, 0.34, 1.2, 0, 0.9, -0.035, Math.PI, 0);
  // upper floor: set back, lattice windows with bamboo blinds, AC unit, roof
  const up = R() < 0.55;
  bx(g, wall, -W / 2 + 0.1, W / 2 - 0.1, H1, H1 + H2, -D / 2 + 0.1, D / 2 - 0.6);
  lattice(g, -W * 0.22, H1 + 0.55, D / 2 - 0.58, W * 0.34, 1.35, { slats: 5, sudare: true });
  lattice(g, W * 0.22, H1 + 0.55, D / 2 - 0.58, W * 0.34, 1.35, { slats: up ? 0 : 5, horiz: up ? 1 : 0, glowK: 0.7 });
  acUnit(g, -W / 2 - 0.05, H1 + 0.2, -D * 0.1, -Math.PI / 2);
  if (up) gable(g, W - 0.2, D - 0.7, H1 + H2, { col: roofCol, gableWall: wall });
  else {
    // flat roof with a parapet and a little rooftop railing (the modern shop houses of the references)
    bx(g, M.white, -W / 2 + 0.05, W / 2 - 0.05, H1 + H2, H1 + H2 + 0.3, -D / 2 + 0.05, D / 2 - 0.55);
    bx(g, M.woodM, -W / 2 + 0.02, W / 2 - 0.02, H1 + H2 + 0.3, H1 + H2 + 0.36, -D / 2 + 0.02, D / 2 - 0.52);
    for (let x = -W / 2 + 0.5; x < W / 2 - 0.4; x += 0.42) cy(g, M.metal, x, H1 + H2 + 0.36, -D / 2 + 0.3, 0.018, 0.55, 6);
    cyl2(g, M.metal, [-W / 2 + 0.5, H1 + H2 + 0.9, -D / 2 + 0.3], [W / 2 - 0.4, H1 + H2 + 0.9, -D / 2 + 0.3], 0.02, 6);
  }
  // street props
  lantern(g, fx1 + 0.05, 2.45, D / 2 + 0.35, kind % 2 ? '' : '営');
  const A = grp(g, fx0 + 0.5, 0, D / 2 + 0.75, 0.25);
  bx(A, M.wood, -0.26, -0.22, 0, 0.9, -0.1, 0.1); bx(A, M.wood, 0.22, 0.26, 0, 0.9, -0.1, 0.1);
  pl(A, new THREE.MeshBasicMaterial({ map: once('chalk', () => canvasTex(160, 240, (c, w, h) => { c.fillStyle = '#1e2a24'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b07a48'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); T(c, '本日の', w / 2, 50, 26, '#f3efe0'); T(c, 'おすすめ', w / 2, 90, 26, '#ffd9a0'); for (let i = 0; i < 4; i++) c.fillRect(30, 130 + i * 22, 100, 3); })), color: new THREE.Color(0.85, 0.85, 0.82) }), 0.42, 0.64, 0, 0.5, 0.11, 0, 0);
  planter(g, fx1 + 0.4, D / 2 + 0.6, 0.2, '#3f7a4c');
}

function house(g, W, D, R, kind) {
  const wall = [M.plaster, M.cream, M.sand][kind % 3];
  const roofCol = ['#6e4a38', '#4a4448', '#5c4a3a', '#3e4a5c'][(R() * 4) | 0];
  const H1 = 2.75, H2 = 2.5;
  const dd = D - 1.6; // the front yard is 1.6 deep (wall + gate)
  const z1 = D / 2 - 1.6;
  bx(g, wall, -W / 2, W / 2, 0, H1, -D / 2, z1);
  bx(g, M.stoneD, -W / 2 - 0.02, W / 2 + 0.02, 0, 0.32, -D / 2 - 0.02, z1 + 0.02);
  [-W / 2, W / 2].forEach((x) => bx(g, M.wood, x - 0.07, x + 0.07, 0.32, H1 + H2, z1 - 0.12, z1 + 0.04));
  bx(g, M.wood, -W / 2, W / 2, H1 - 0.12, H1, z1 - 0.12, z1 + 0.05);
  // entrance: lattice sliding doors, wooden panels, wall lamps
  const ex = kind % 2 ? -W * 0.18 : W * 0.12;
  lattice(g, ex, 0.32, z1 + 0.02, 1.7, 2.0, { slats: 6, glowK: 0.8 });
  bx(g, M.stone, ex - 1.05, ex + 1.05, 0, 0.2, z1, z1 + 0.6);
  bx(g, M.woodM, ex + 0.95, ex + 1.75, 0.32, 2.32, z1 - 0.02, z1 + 0.05);
  wallLamp(g, ex - 1.05, 2.0, z1 + 0.05); wallLamp(g, ex + 1.9, 2.0, z1 + 0.05);
  const wx = kind % 2 ? W * 0.28 : -W * 0.3;
  lattice(g, wx, 1.0, z1 + 0.02, 1.1, 1.1, { slats: 0, horiz: 1, glowK: 0.6 });
  pent(g, -W / 2 - 0.2, W / 2 + 0.2, H1 + 0.08, z1 + 0.04, 0.95, { col: roofCol });
  // upper floor
  bx(g, wall, -W / 2 + 0.05, W / 2 - 0.05, H1, H1 + H2, -D / 2 + 0.05, z1 - 0.2);
  lattice(g, -W * 0.2, H1 + 0.5, z1 - 0.18, 1.2, 1.4, { slats: 4, glowK: 0.65 });
  // wooden shutter box (戸袋) beside the window
  bx(g, M.woodM, -W * 0.2 - 1.1, -W * 0.2 - 0.62, H1 + 0.45, H1 + 1.95, z1 - 0.2, z1 - 0.1);
  lattice(g, W * 0.24, H1 + 0.7, z1 - 0.18, 1.3, 1.05, { horiz: 0, slats: 1, glowK: 0.6, frame: M.woodM });
  if (kind % 3 === 1) {
    // small balcony with a timber balustrade
    bx(g, M.woodM, W * 0.24 - 0.9, W * 0.24 + 0.9, H1 + 0.55, H1 + 0.62, z1 - 0.2, z1 + 0.45);
    for (let x = W * 0.24 - 0.85; x <= W * 0.24 + 0.86; x += 0.18) bx(g, M.woodL, x - 0.02, x + 0.02, H1 + 0.62, H1 + 1.42, z1 + 0.38, z1 + 0.43, { cast: false });
    bx(g, M.woodM, W * 0.24 - 0.9, W * 0.24 + 0.9, H1 + 1.42, H1 + 1.48, z1 + 0.36, z1 + 0.46);
  }
  acUnit(g, W / 2 + 0.05, 0.35, -D * 0.15, Math.PI / 2);
  gable(g, W - 0.1, dd - 0.2, H1 + H2, { col: roofCol, gableWall: wall, ov: 0.5 });
  // front wall with gate, mailbox, bicycle, plants
  const gz = D / 2 - 0.2;
  blockWall(g, -W / 2 - 0.2, W / 2 + 0.2, gz, 1.15, [ex - 0.75, ex + 0.75]);
  bx(g, toon('#c43a2e'), ex + 0.85, ex + 1.15, 0.7, 1.0, gz + 0.13, gz + 0.3); // mailbox
  bx(g, M.stone, ex - 0.7, ex + 0.7, 0, 0.12, z1 + 0.6, gz - 0.1); // path
  if (kind % 2 === 0) bicycle(grp(g, 0, -PAV, 0), ex - 1.6, gz + 0.55, 0.05, ['#3aa0c8', '#d8574f', '#6c8a3a'][kind % 3], 0.12);
  planter(grp(g, 0, -PAV, 0), ex + 1.5, z1 + 0.5, 0.22, '#3f7a4c');
  planter(grp(g, 0, -PAV, 0), -W / 2 + 0.5, z1 + 0.6, 0.18, '#4a7f4a');
}

/* ---------------------------------------------------------------- placement on the reserved plots */
const FACE = { kaigan: (p) => (p.rect[2] > 9 ? Math.PI : 0), hoshizora: (p) => (p.rect[0] > 10 ? -Math.PI / 2 : Math.PI / 2), kita: () => Math.PI, westLane: (p) => (p.rect[0] > -31 ? -Math.PI / 2 : Math.PI / 2), uraroji: () => Math.PI / 2, swLane: () => Math.PI };
const PICK = [
  ['A-shop-2', 'shop', 0], ['A-shop-1', 'shop', 1], ['A-shop-3', 'shop', 5], ['A-cafe-1', 'shop', 4],
  ['C-cafe-1', 'shop', 3], ['C-shop-1', 'shop', 2], ['B-shop-1', 'shop', 5],
  ['B-house-7', 'house', 0], ['B-house-3', 'house', 1], ['B-house-5', 'house', 2],
  ['B-house-8', 'house', 3], ['B-house-9', 'house', 4], ['B-house-10', 'house', 5],
  // A-shop-4 / A-cafe-2 / A-house-1: the large residence takes the whole south-east block (town/villa.js)
];

export function buildHouses(parent) {
  const root = grp(parent);
  const TAKEN = new Set(['B-house-8', 'B-house-9', 'B-house-10']); // the street-house row stands there (town/streetRow.js)
  PICK.forEach(([id, type, kind], i) => {
    if (TAKEN.has(id)) return;
    const p = PLOTS.find((q) => q.id === id);
    if (!p) return;
    const R = rng(101 + i * 17);
    const [x0, x1, z0, z1] = p.rect;
    const ry = (FACE[p.front] || (() => 0))(p);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const across = Math.abs(Math.sin(ry)) > 0.5; // the building's width runs along z
    let W = (across ? z1 - z0 : x1 - x0) - 0.4, D = (across ? x1 - x0 : z1 - z0) - 0.3;
    if (type === 'shop') { W = Math.min(W, 7.2); D = Math.min(D, 6.0); }
    // sit level on the highest corner; a stone plinth fills the slope underneath
    const ys = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => groundY(x, z));
    const yTop = Math.max(...ys), yLow = Math.min(...ys);
    const B = grp(root, cx, yTop, cz, ry);
    if (yTop - yLow > 0.04) bx(B, M.stone, -W / 2 - 0.05, W / 2 + 0.05, yLow - yTop - 0.05, 0.02, -D / 2 - 0.05, D / 2 + 0.05);
    (type === 'shop' ? shop : house)(B, W, D, R, kind);
    p.built = type;
  });
  // vending corner next to the corner shop of the west block (as in the reference street corner)
  {
    const x = -18.6, z = 5.2, y = groundY(x, z);
    const V = grp(root, 0, y - PAV, 0);
    vendingMachine(V, x, z, Math.PI, 0, 11); vendingMachine(V, x + 1.05, z, Math.PI, 1, 12); vendingMachine(V, x + 2.1, z, Math.PI, 2, 13);
    trashBins(V, x + 3.2, z + 0.1, Math.PI);
    // little striped awning over the machines
    const aw = once('awning', () => canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e6' : '#d23a32'; g.fillRect(i * 32, 0, 32, h); } }, { repeat: true }));
    const A = grp(root, x + 1.05, y + 2.15, z - 0.2);
    A.rotation.x = -0.3;
    const am = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 0.9), new THREE.MeshToonMaterial({ map: aw, gradientMap: RAMP }));
    am.castShadow = true; A.add(am);
  }
  return root;
}
