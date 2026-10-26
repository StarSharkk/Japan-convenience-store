import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, noSnowBox } from '../core.js';
import { T } from '../tex.js';
import { cat as makeCat } from '../street.js';
import { makeFicusPot } from '../plants/pottedPlants.js';
import { groundY } from './layout.js';
import { P } from '../palette.js';

/* ====================================================================================================
   青空雑貨店 - the old corner general store (雑貨・日用品・食品) at Kita-dori x 裏路地, the north-east corner of the
   west block (town plan: 杂货铺). After the reference corner shop, turned from a liquor / tobacco shop into a
   mom-and-pop general store:

     a narrow, tall two-storey box on the corner, white-grey tiles a little weathered; flat roof crowded with
     condensers on a frame, pipes, a water tank, vents, an aerial, a pipe rail on the parapet
     FRONT (east, on 裏路地)  the big shop sign, a red canvas awning "日用品・雑貨", a rolling shutter painted with
                             the shop's name / hours on the left, the open store on the right (glass doors pushed
                             aside, shelves of goods inside), a vertical corner sign, goods stacked outside
     SIDE (north, Kita-dori) dense with posters, stickers, an AC unit, meters, pipes, a camera, a graffiti tag and a
                             row of machines: drinks (110円), capsule toys, a snack machine with a cat on top, the
                             recycling bin, an electric cabinet; the pole carries the street signs
     STREET                  red / white guard rails round the corner, black-yellow bollards, a pedestrian
                             signal with its push-button box, street signs on the corner pole; pavers, guide
                             blocks, a manhole and grates are painted in town/ground.js

   It stands on the FRONT corner of the block, Kaigan-dori x 裏路地: modelled in a local frame (front +x, machines
   on -z) and turned so the shop front faces Kaigan-dori (south) and the machines face 裏路地 (east), the way the
   reference reads from the default (south-east) view.
   ==================================================================================================== */

export const ZAK = { X0: -23.0, X1: -18.4, Z0: -10.0, Z1: -5.2 }; // local frame
// local -> world: turned -90° about y (local +x -> world +z, local -z -> world +x), the corner (X1, Z0) at (-18.4, 4.5)
const PLACE = { x: -28.4, z: 21.9 }; // corner (X1, Z0) at (-18.4, 3.5): set back so the Kaigan-dori pavement stays wide
const TW = (lx, lz) => [-lz + PLACE.x, lx + PLACE.z];
const TN = (nx, nz) => [-nz, nx];
/** the footprint in world coordinates: x0, x1, z0, z1 */
export const ZAK_WORLD = [-23.2, -18.4, -1.1, 3.5];
const { X0, X1, Z0, Z1 } = ZAK;
const YS = 0.15; // pavement (the corner pad is level: layout.js)
const YF = 0.25; // shop floor
const Y1 = 3.2; // first floor line
const Y2 = 5.9; // roof slab
const YP = 6.3; // parapet top
const SH = { z0: -5.45, z1: -7.6 }; // shutter (front, south part)
const OP = { z0: -7.8, z1: -9.75 }; // open store front (front, north part)
const AW = { y: 2.95, d: 1.15, drop: 0.5 }; // awning

/* ---------------------------------------------------------------- textures */
const tex = {};
const ct = (k, w, h, draw) => (tex[k] ||= canvasTex(w, h, draw));
function tileTex() {
  return (tex.tile ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c5bd'; g.fillRect(0, 0, w, h);
    const R = rng(11), n = 8, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 228 + ((R() * 12) | 0); g.fillStyle = `rgb(${v},${v - 2},${v - 7})`; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3); }
    for (let i = 0; i < 9; i++) { const x = R() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,85,75,0.0)'); gr.addColorStop(1, 'rgba(90,85,75,0.12)'); g.fillStyle = gr; g.fillRect(x, 0, 4 + R() * 10, h); } // rain streaks
  }, { repeat: true }));
}
function shutterTex() {
  return ct('shutter', 256, 300, (g, w, h) => {
    g.fillStyle = '#9ea7b3'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(30,40,60,0.18)'; g.fillRect(0, y + 5, w, 2); }
    // the shop's name and hours painted on the slats
    g.fillStyle = 'rgba(250,250,248,0.92)'; g.fillRect(16, 26, w - 32, 70);
    g.fillStyle = '#d33a2f'; g.beginPath(); g.arc(48, 61, 24, 0, 7); g.fill();
    T(g, '青', 48, 62, 26, '#ffffff', { weight: 900 });
    T(g, '青空雑貨店', 150, 62, 34, '#2b3a6a', { weight: 900 });
    T(g, '営業時間  8:00 – 21:00', w / 2, 128, 22, '#2b3a6a', { weight: 800 });
    T(g, '定休日 水曜', w / 2, 168, 34, '#2b3a6a', { weight: 900 });
    g.fillStyle = '#d33a2f'; g.fillRect(30, 196, w - 60, 34); T(g, '日用品・食品・雑貨', w / 2, 214, 22, '#ffffff', { weight: 900 });
    g.fillStyle = 'rgba(40,40,40,0.12)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1);
  });
}
function awningTex() {
  return ct('awning', 512, 160, (g, w, h) => {
    // yellow / white stripes running down the slope, no lettering
    const n = 14, sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#fbf6e8' : '#f2c230'; g.fillRect(i * sw, 0, sw + 1, h); }
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(120,80,0,0.12)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,0.03)'; g.fillRect(x, 0, 2, h); }
  });
}
function valanceTex() {
  return ct('valance', 512, 48, (g, w, h) => {
    // the valance carries on the same stripes, a slightly deeper yellow, no lettering
    const n = 14, sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#f4eedd' : '#e9b72a'; g.fillRect(i * sw, 0, sw + 1, h); }
    g.fillStyle = 'rgba(120,80,0,0.18)'; g.fillRect(0, h - 4, w, 4);
  });
}
function bigSignTex() {
  return ct('bigSign', 600, 120, (g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d33a2f'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#d33a2f'; g.beginPath(); g.arc(70, h / 2, 40, 0, 7); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.arc(70, h / 2, 30, 0, 7); g.stroke();
    T(g, '青', 70, h / 2 + 2, 40, '#ffffff', { weight: 900 });
    T(g, '青空雑貨店', 300, h / 2 - 4, 66, '#c2302a', { weight: 900 });
    T(g, 'General Store', 300, h - 18, 18, '#2b3a6a', { weight: 700 });
    g.fillStyle = '#2b3a6a'; roundRect(g, w - 110, 22, 92, 76, 8); g.fill();
    T(g, '食品', w - 64, 44, 22, '#ffffff', { weight: 900 }); T(g, '日用品', w - 64, 78, 20, '#ffffff', { weight: 900 });
  });
}
function vSignTex() {
  return ct('vSign', 110, 420, (g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d33a2f'; g.fillRect(0, 0, w, 120);
    T(g, '雑', w / 2, 40, 54, '#ffffff', { weight: 900 }); T(g, '貨', w / 2, 92, 54, '#ffffff', { weight: 900 });
    ['あ', 'お', 'ぞ', 'ら'].forEach((c, i) => T(g, c, w / 2, 168 + i * 66, 54, '#2b3a6a', { weight: 900 }));
    g.strokeStyle = '#c9c5bd'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
  });
}
function poster(kind) {
  const P = {
    camera: [128, 170, (g, w, h) => { g.fillStyle = '#f2d23a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.fillRect(6, 6, w - 12, 34); T(g, '防犯カメラ', w / 2, 24, 20, '#f2d23a', { weight: 900 }); ['作', '動', '中'].forEach((c, i) => T(g, c, w / 2, 70 + i * 34, 30, '#111', { weight: 900 })); }],
    danger: [100, 150, (g, w, h) => { g.fillStyle = '#f2d23a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d33a2f'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); T(g, '危', w / 2, 50, 44, '#d33a2f', { weight: 900 }); T(g, '険', w / 2, 102, 44, '#d33a2f', { weight: 900 }); }],
    nosmoke: [120, 120, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d33a2f'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, 52, 34, 0, 7); g.stroke(); g.beginPath(); g.moveTo(w / 2 - 24, 28); g.lineTo(w / 2 + 24, 76); g.stroke(); g.fillStyle = '#333'; g.fillRect(w / 2 - 24, 50, 40, 8); T(g, '禁煙', w / 2, 104, 20, '#d33a2f', { weight: 900 }); }],
    cat: [120, 160, (g, w, h) => { g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); T(g, '迷い猫', w / 2, 24, 22, '#d33a2f', { weight: 900 }); g.fillStyle = '#222'; g.beginPath(); g.ellipse(w / 2, 86, 28, 24, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(w / 2 - 24, 70); g.lineTo(w / 2 - 14, 52); g.lineTo(w / 2 - 6, 66); g.fill(); g.beginPath(); g.moveTo(w / 2 + 24, 70); g.lineTo(w / 2 + 14, 52); g.lineTo(w / 2 + 6, 66); g.fill(); g.fillStyle = '#f2d23a'; [-10, 10].forEach((d) => { g.beginPath(); g.arc(w / 2 + d, 84, 4, 0, 7); g.fill(); }); T(g, 'クロ 見かけた方', w / 2, 132, 13, '#333', { weight: 700 }); T(g, '店主まで', w / 2, 150, 13, '#333', { weight: 700 }); }],
    sale: [130, 110, (g, w, h) => { g.fillStyle = '#d33a2f'; g.fillRect(0, 0, w, h); T(g, '特売', w / 2, 34, 36, '#fff04a', { weight: 900 }); T(g, 'トイレットペーパー', w / 2, 70, 12, '#ffffff', { weight: 800 }); T(g, '12ロール ¥398', w / 2, 92, 18, '#ffffff', { weight: 900 }); }],
    deliver: [130, 90, (g, w, h) => { g.fillStyle = '#2e6da4'; g.fillRect(0, 0, w, h); T(g, '配達します', w / 2, 32, 22, '#ffffff', { weight: 900 }); T(g, 'お米・灯油・水', w / 2, 62, 16, '#ffffff', { weight: 700 }); }],
    job: [110, 130, (g, w, h) => { g.fillStyle = '#eaf7e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f8f4f'; g.fillRect(0, 0, w, 36); T(g, 'パート募集', w / 2, 19, 18, '#ffffff', { weight: 900 }); T(g, '週2日〜', w / 2, 64, 18, '#2a2a2a', { weight: 800 }); T(g, '時給 1100円', w / 2, 96, 16, '#d33a2f', { weight: 900 }); }],
    tabako: [100, 60, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d33a2f'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); T(g, 'たばこ', w / 2, h / 2 + 1, 24, '#d33a2f', { weight: 900 }); }],
    kerosene: [100, 70, (g, w, h) => { g.fillStyle = '#f2a23a'; g.fillRect(0, 0, w, h); T(g, '灯油', w / 2, 26, 26, '#2a2a2a', { weight: 900 }); T(g, 'あります', w / 2, 54, 16, '#2a2a2a', { weight: 800 }); }],
    closed: [90, 160, (g, w, h) => { g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2b3a6a'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); ['水', '曜', '定', '休'].forEach((c, i) => T(g, c, w / 2, 28 + i * 35, 28, i < 2 ? '#d33a2f' : '#2b3a6a', { weight: 900 })); }],
    graffiti: [256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#1a1a1a'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, 90); g.bezierCurveTo(40, 10, 70, 110, 90, 40); g.bezierCurveTo(110, 0, 120, 100, 150, 60); g.bezierCurveTo(170, 30, 200, 110, 236, 50); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(30, 105); g.lineTo(220, 98); g.stroke(); }],
    clinic: [100, 400, (g, w, h) => { g.fillStyle = '#3f8f4f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(8, 8, w - 16, 70); T(g, '🦷', w / 2, 44, 40, '#3f8f4f', { weight: 900 }); ['み', 'ど', 'り', '歯', '科'].forEach((c, i) => T(g, c, w / 2, 116 + i * 52, 46, '#ffffff', { weight: 900 })); T(g, 'この先50m', w / 2, 384, 15, '#ffffff', { weight: 700 }); }],
    address: [100, 300, (g, w, h) => { g.fillStyle = '#2459a8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10); ['星', '空', '町'].forEach((c, i) => T(g, c, w / 2, 56 + i * 64, 54, '#ffffff', { weight: 900 })); T(g, '2-7', w / 2, 262, 26, '#ffffff', { weight: 800 }); }],
  }[kind];
  return ct('poster-' + kind, P[0], P[1], P[2]);
}
function drinkTex() {
  // the drinks machine's display: three rows of bottles + cans with price tags, the 110円 header
  return ct('drinks', 256, 330, (g, w, h) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d33a2f'; g.fillRect(10, 8, w - 20, 52); T(g, '110円', w / 2, 35, 40, '#fff04a', { weight: 900 });
    const R = rng(5), cols = ['#3fa34d', '#e8a23a', '#2e6da4', '#d33a2f', '#f2d23a', '#7a4bb0', '#c8e6f0', '#4a2a18'];
    for (let r = 0; r < 4; r++) {
      const y = 80 + r * 60;
      g.fillStyle = '#e4ecef'; g.fillRect(14, y - 6, w - 28, 54);
      for (let i = 0; i < 6; i++) { const x = 24 + i * 36; g.fillStyle = cols[(R() * cols.length) | 0]; roundRect(g, x, y, 22, 36, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 4, y + 6, 4, 22); g.fillStyle = '#111'; g.fillRect(x - 2, y + 40, 26, 8); g.fillStyle = '#f2d23a'; g.fillRect(x + 10, y + 42, 4, 4); }
    }
  });
}
function gachaTex(c) {
  return ct('gacha' + c, 128, 160, (g, w, h) => {
    g.fillStyle = c; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; roundRect(g, 10, 10, w - 20, 70, 10); g.fill();
    const R = rng(c.length * 3); for (let i = 0; i < 9; i++) { g.fillStyle = ['#ff6a8a', '#ffd23a', '#5ac8fa', '#7fd65a'][i % 4]; g.beginPath(); g.arc(24 + (i % 3) * 38, 26 + ((i / 3) | 0) * 20, 9, 0, 7); g.fill(); }
    T(g, '200円', w / 2, 100, 22, '#ffffff', { weight: 900 });
    g.fillStyle = '#444'; g.beginPath(); g.arc(w / 2, 136, 14, 0, 7); g.fill();
  });
}
function snackTex() {
  return ct('snack', 200, 300, (g, w, h) => {
    g.fillStyle = '#f2a6b8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; roundRect(g, 12, 12, w - 24, 46, 10); g.fill(); T(g, 'おかし', w / 2, 36, 28, '#d33a2f', { weight: 900 });
    const R = rng(8), cols = ['#f2d23a', '#5ac8fa', '#ff8a3a', '#7fd65a', '#c79be0'];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; roundRect(g, 22 + i * 56, 72 + r * 52, 44, 38, 6); g.fill(); g.fillStyle = '#ffffff'; T(g, '100', 44 + i * 56, 122 + r * 52, 12, '#d33a2f', { weight: 900 }); }
  });
}
function recycleTex() {
  return ct('recycle', 128, 160, (g, w, h) => {
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2e6da4'; g.fillRect(0, 96, w, 64);
    T(g, 'かん・びん', w / 2, 116, 18, '#ffffff', { weight: 900 }); T(g, 'ペットボトル', w / 2, 142, 14, '#ffffff', { weight: 800 });
    T(g, '♻', w / 2, 60, 40, '#3fa34d', { weight: 900 });
  });
}
/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.tile) return M;
  M.tile = toon('#ffffff', { map: tileTex(), nocache: true, lit: 0.08 });
  M.wall = toon('#d8d5cd');
  M.concrete = toon('#b9b6ae');
  M.trim = toon('#8e939a');
  M.steel = toon('#c3c9ce');
  M.dark = toon('#3a3d44');
  M.iron = toon('#2e3034');
  M.white = toon('#f3f2ee');
  M.red = toon('#d33a2f');
  M.redD = toon('#a8281c');
  M.yellow = toon('#f2c230', { e: '#4a3a08', ei: 0.3 });
  M.cardboard = toon('#c9a26a');
  M.wood = toon('#a87a4c');
  M.glass = toon('#dff0f4', { op: 0.22 });
  return M;
}
/** a box whose UVs are in metres / tile on every face (tiles keep their size on any box) */
function wbx(parent, mat, xa, xb, ya, yb, za, zb, tile = 1) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; parent.add(m);
  return m;
}
/** a flat picture on a wall: face = 'e' (x = const, facing +x) or 'n' (z = const, facing -z) */
function decal(p, map, w, h, face, u, y, at, o = {}) {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: !!o.alpha, alphaTest: o.alpha ? 0.3 : 0, color: new THREE.Color(o.k ?? 0.95, o.k ?? 0.95, o.k ?? 0.93) });
  const m = face === 'e' ? pl(p, mat, w, h, at, y, u, Math.PI / 2, 0) : pl(p, mat, w, h, u, y, at, Math.PI, 0);
  m.userData.noLine = true;
  return m;
}
function crate(p, x, y, z, col, ry = 0, bottles = null) {
  const g = grp(p, x, y, z, ry), m = toon(col);
  bx(g, m, -0.22, 0.22, 0, 0.02, -0.16, 0.16);
  [-1, 1].forEach((s) => { bx(g, m, s * 0.22 - 0.012, s * 0.22 + 0.012, 0, 0.26, -0.16, 0.16); bx(g, m, -0.22, 0.22, 0, 0.26, s * 0.16 - 0.012, s * 0.16 + 0.012); });
  bx(g, m, -0.22, 0.22, 0.12, 0.15, -0.16, 0.16, { cast: false });
  if (bottles) for (let i = 0; i < 12; i++) { const bxp = -0.17 + (i % 4) * 0.11, bz = -0.1 + ((i / 4) | 0) * 0.1; cy(g, toon(bottles), bxp, 0.02, bz, 0.03, 0.26, 8); cy(g, toon(bottles), bxp, 0.28, bz, 0.012, 0.07, 6); }
  return g;
}
function box(p, x, y, z, w, h, d, ry = 0, col = '#c9a26a', label = null) {
  const g = grp(p, x, y, z, ry);
  bx(g, toon(col), -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.006 });
  bx(g, toon('#e8d6b0'), -w / 2 - 0.002, w / 2 + 0.002, h - 0.002, h + 0.002, -0.015, 0.015, { cast: false }); // tape
  if (label) bx(g, toon(label), -w * 0.3, w * 0.3, h * 0.3, h * 0.7, d / 2, d / 2 + 0.003, { cast: false });
  return g;
}

/* ---------------------------------------------------------------- the store */
export function buildZakkaya(parent) {
  const m = mats();
  const g = grp(parent, PLACE.x, 0, PLACE.z, -Math.PI / 2);
  g.name = 'zakkaya';
  const R = rng(37);

  /* ---- shell: tiled walls, a low concrete base, the floor band, the parapet ---- */
  bx(g, m.concrete, X0 - 0.03, X1 + 0.03, YS - 0.05, YF, Z0 - 0.03, Z1 + 0.03, { bevel: 0.01 });
  // solid behind the shutter and behind the shop room; the room itself (behind the open front) stays hollow
  wbx(g, m.tile, X0, X1 - 0.15, YF, Y1, SH.z1 - 0.1, Z1);
  wbx(g, m.tile, X0, X1 - 2.62, YF, Y1, Z0, SH.z1 - 0.1);
  wbx(g, m.tile, X0, X1, Y1, YP, Z0, Z1); // upper storey + parapet
  wbx(g, m.tile, X0, X1, YF, Y1, Z0, Z0 + 0.15); // side wall (north), ground floor
  wbx(g, m.tile, X0, X1, YF, Y1, Z1 - 0.15, Z1); // south wall
  // front ground floor: pier at the south end, the pier between shutter and store, the corner pillar
  wbx(g, m.tile, X1 - 0.15, X1, YF, Y1, Z1 - 0.15, SH.z0);
  wbx(g, m.tile, X1 - 0.15, X1, YF, Y1, SH.z1, OP.z0);
  wbx(g, m.tile, X1 - 0.15, X1, YF, Y1, OP.z1, Z0);
  bx(g, m.concrete, X0 - 0.02, X1 + 0.02, YF, 0.55, Z0 - 0.02, Z0 + 0.15); // splash band along the side
  bx(g, m.trim, X0 - 0.04, X1 + 0.04, Y1 - 0.06, Y1 + 0.04, Z0 - 0.04, Z1 + 0.04, { bevel: 0.01 }); // floor line
  bx(g, m.trim, X0 - 0.04, X1 + 0.04, YP, YP + 0.06, Z0 - 0.04, Z1 + 0.04, { bevel: 0.01 }); // coping
  bx(g, toon(P.roofFlat), X0 + 0.15, X1 - 0.15, Y2 - 0.02, Y2 + 0.03, Z0 + 0.15, Z1 - 0.15, { cast: false }); // roof membrane
  // a dark interior box behind the store front so the shop reads as a room, with its own floor
  bx(g, toon('#efe9dc', { lit: 0.25 }), X1 - 2.6, X1 - 0.15, YF, YF + 0.01, OP.z1, OP.z0 + 0.0, { cast: false });
  bx(g, toon('#e9e2d2', { lit: 0.25 }), X1 - 2.62, X1 - 2.6, YF, Y1 - 0.1, OP.z1, OP.z0);
  bx(g, toon('#e9e2d2', { lit: 0.25 }), X1 - 2.62, X1 - 0.15, Y1 - 0.12, Y1 - 0.1, OP.z1, OP.z0);

  /* ---- the front (east): shutter, open store, big sign, awning, vertical corner sign ---- */
  {
    const xf = X1 - 0.1;
    // rolling shutter with the box above it, guide rails each side
    bx(g, m.trim, xf - 0.2, xf + 0.08, 2.55, 2.85, SH.z1, SH.z0, { bevel: 0.01 });
    [SH.z0, SH.z1].forEach((z) => bx(g, m.trim, xf - 0.02, xf + 0.06, YF, 2.55, z - 0.03, z + 0.03));
    const sh = pl(g, toon('#ffffff', { map: shutterTex(), nocache: true }), SH.z0 - SH.z1 - 0.06, 2.3, xf + 0.02, YF + 1.15, (SH.z0 + SH.z1) / 2, Math.PI / 2, 0, { cast: false });
    sh.userData.noLine = true;
    bx(g, m.iron, xf, xf + 0.06, YF, YF + 0.06, SH.z1, SH.z0, { cast: false }); // bottom bar
    // the open store: a frame, glass sliding doors pushed to one side, the counter and shelves inside
    bx(g, m.trim, xf - 0.08, xf + 0.06, 2.5, 2.62, OP.z1, OP.z0);
    // a sliding glass leaf, z0 < z1
    const sd = (z0, z1, x) => { bx(g, m.trim, x - 0.02, x + 0.02, YF, 2.5, z0, z0 + 0.04); bx(g, m.trim, x - 0.02, x + 0.02, YF, 2.5, z1 - 0.04, z1); bx(g, m.trim, x - 0.02, x + 0.02, YF, YF + 0.12, z0, z1); bx(g, m.trim, x - 0.02, x + 0.02, 2.4, 2.5, z0, z1); const gl = pl(g, m.glass, z0 - z1 - 0.08, 2.28, x, YF + 1.26, (z0 + z1) / 2, Math.PI / 2, 0, { cast: false }); gl.userData.noLine = true; };
    sd(OP.z0 - 1.0, OP.z0, xf - 0.04); sd(OP.z0 - 1.02, OP.z0 - 0.02, xf + 0.02); // both leaves slid to the south end: the way in is by the corner
    decal(g, poster('tabako'), 0.3, 0.18, 'e', OP.z0 - 0.5, 1.9, xf + 0.045);
    // inside: wall shelves full of goods, a gondola, the counter with the register and a cigarette case
    const shelf = (x0, x1, z0, z1, n, h = 1.9) => {
      bx(g, m.steel, x0, x1, YF, YF + h, z0, z0 + 0.03); bx(g, m.steel, x0, x1, YF, YF + h, z1 - 0.03, z1);
      for (let k = 0; k < n; k++) {
        const y = YF + 0.12 + k * (h - 0.2) / (n - 1);
        bx(g, m.steel, x0, x1, y - 0.02, y, z0, z1);
        if (k === n - 1) continue;
        for (let zz = Math.min(z0, z1) + 0.06; zz < Math.max(z0, z1) - 0.05; zz += 0.11 + R() * 0.06) {
          const c = ['#d33a2f', '#f2c230', '#2e6da4', '#3fa34d', '#f4f1ea', '#ff8a3a', '#7a4bb0', '#5ac8fa'][(R() * 8) | 0];
          const kind = R();
          if (kind < 0.35) cy(g, toon(c), (x0 + x1) / 2, y, zz + 0.04, 0.045, 0.1 + R() * 0.05, 10); // cup noodles / cans
          else if (kind < 0.7) bx(g, toon(c), x0 + 0.03, x1 - 0.03, y, y + 0.12 + R() * 0.12, zz, zz + 0.09, { cast: false }); // boxes, bags
          else { cy(g, toon(c), (x0 + x1) / 2, y, zz + 0.04, 0.04, 0.22, 8); cy(g, toon('#ffffff'), (x0 + x1) / 2, y + 0.22, zz + 0.04, 0.02, 0.05, 6); } // bottles
        }
      }
    };
    shelf(X1 - 2.55, X1 - 2.2, OP.z0 - 0.05, OP.z1 + 0.05, 5, 2.0); // back wall
    shelf(X1 - 1.7, X1 - 1.35, OP.z0 - 0.35, OP.z1 + 0.5, 4, 1.4); // gondola
    bx(g, toon('#c9a26a'), X1 - 1.0, X1 - 0.5, YF, YF + 0.85, OP.z0 - 0.05, OP.z0 - 0.75, { bevel: 0.01 }); // counter
    bx(g, m.white, X1 - 1.02, X1 - 0.48, YF + 0.85, YF + 0.9, OP.z0 - 0.03, OP.z0 - 0.77);
    bx(g, toon('#e8e4da'), X1 - 0.9, X1 - 0.65, YF + 0.9, YF + 1.05, OP.z0 - 0.25, OP.z0 - 0.5, { bevel: 0.01 }); // register
    bx(g, m.glass, X1 - 1.0, X1 - 0.6, YF + 0.9, YF + 1.35, OP.z0 - 0.55, OP.z0 - 0.77); // a little glass case of sweets
    for (let k = 0; k < 6; k++) bx(g, toon(['#f2c230', '#ff8a3a', '#5ac8fa', '#d33a2f'][k % 4]), X1 - 0.95 + (k % 3) * 0.12, X1 - 0.87 + (k % 3) * 0.12, YF + 0.92 + (k > 2 ? 0.2 : 0), YF + 1.02 + (k > 2 ? 0.2 : 0), OP.z0 - 0.6, OP.z0 - 0.72, { cast: false });
    plight(g, '#ffe2b8', 6, 6, X1 - 1.2, 2.8, (OP.z0 + OP.z1) / 2, 'zakkaya');
    pl(g, glow('#fff6e4', 1.5), 1.6, 0.08, X1 - 1.3, Y1 - 0.13, (OP.z0 + OP.z1) / 2, Math.PI / 2, -Math.PI / 2); // fluorescent tube
    // big sign over the awning, the vertical corner sign
    bx(g, m.trim, X1, X1 + 0.08, 3.32, 4.38, Z1 - 0.2, Z0 + 0.2, { bevel: 0.01 });
    decal(g, bigSignTex(), Z1 - Z0 - 0.5, 0.98, 'e', (Z0 + Z1) / 2, 3.85, X1 + 0.082, { k: 1.0 });
    bx(g, m.white, X1 + 0.02, X1 + 0.1, 1.4, 3.1, Z0 + 0.03, Z0 + 0.35, { bevel: 0.01 });
    decal(g, vSignTex(), 0.28, 1.62, 'e', Z0 + 0.19, 2.25, X1 + 0.102, { k: 1.0 });
    // the red canvas awning: sloped sheet, a valance with the small print, iron arms underneath
    const aw = grp(g, X1, AW.y, (Z0 + Z1) / 2, 0); aw.rotation.z = -Math.atan2(AW.drop, AW.d);
    const L = Math.hypot(AW.drop, AW.d), W = Z1 - Z0 + 0.1;
    // the printed canvas: text runs along the awning, upright for someone in the street (plane x -> -z, y -> up the slope)
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, L), toon('#ffffff', { map: awningTex(), nocache: true, side: THREE.DoubleSide }));
    top.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
    top.position.set(L / 2, 0.005, 0); top.castShadow = true; aw.add(top);
    bx(aw, toon('#e9d9a8'), 0, L, -0.02, 0.0, -W / 2, W / 2, { cast: false }); // underside
    const ex = X1 + AW.d, ey = AW.y - AW.drop;
    bx(g, toon('#e9b72a'), ex - 0.01, ex + 0.01, ey - 0.26, ey + 0.01, Z0 - 0.05, Z1 + 0.05);
    decal(g, valanceTex(), W, 0.24, 'e', (Z0 + Z1) / 2, ey - 0.13, ex + 0.012, { k: 1.0 });
    [Z0 + 0.1, (Z0 + Z1) / 2, Z1 - 0.1].forEach((z) => cyl2(g, m.iron, [X1, AW.y - 0.55, z], [ex - 0.05, ey - 0.02, z], 0.012, 4));
    // posters and a fire extinguisher on the south pier, the hours plate by the door
    decal(g, poster('closed'), 0.16, 0.3, 'e', Z1 - 0.08, 1.8, X1 + 0.004);
    decal(g, poster('sale'), 0.3, 0.25, 'e', Z1 - 0.08, 1.35, X1 + 0.006);
    cy(g, m.red, X1 + 0.1, YS, -5.32, 0.07, 0.48, 10); cy(g, m.iron, X1 + 0.1, YS + 0.48, -5.32, 0.03, 0.06, 6); cyl2(g, m.iron, [X1 + 0.1, YS + 0.52, -5.32], [X1 + 0.2, YS + 0.36, -5.27], 0.008, 4); // fire extinguisher
    decal(g, poster('kerosene'), 0.24, 0.17, 'e', SH.z1 - 0.1, 1.7, X1 + 0.004);
  }

  /* ---- the side (north, Kita-dori): posters, AC unit, meters, pipes, camera, graffiti; the machines ---- */
  {
    const zf = Z0 - 0.004;
    [['camera', 0.36, 0.48, -18.95, 2.25], ['danger', 0.26, 0.4, -19.45, 2.45], ['nosmoke', 0.3, 0.3, -19.85, 2.7], ['cat', 0.3, 0.4, -20.3, 2.45], ['job', 0.28, 0.34, -20.75, 2.6], ['deliver', 0.36, 0.25, -21.3, 2.5], ['sale', 0.34, 0.29, -21.85, 2.55], ['camera', 0.24, 0.32, -22.6, 2.3]]
      .forEach(([k, w, h, x, y]) => decal(g, poster(k), w, h, 'n', x, y, zf));
    decal(g, poster('graffiti'), 1.4, 0.7, 'n', -20.2, 4.3, zf, { alpha: true });
    // the AC unit on a bracket, a meter board, the gas meter, the drain pipe, the refrigerant pipes from the roof
    const ac = grp(g, -21.0, 3.6, Z0, 0);
    bx(ac, m.white, -0.42, 0.42, 0, 0.6, -0.32, 0, { bevel: 0.03 });
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 18), toon('#9aa2ab')); fan.position.set(-0.1, 0.3, -0.325); ac.add(fan);
    for (let k = -2; k <= 2; k++) bx(ac, toon('#9aa2ab'), -0.3, 0.1, 0.3 + k * 0.06 - 0.008, 0.3 + k * 0.06 + 0.008, -0.33, -0.32, { cast: false });
    [-0.35, 0.35].forEach((x) => cyl2(ac, m.trim, [x, -0.05, 0], [x, -0.05, -0.35], 0.015, 4));
    bx(g, toon('#d8dbe0'), -22.3, -21.75, 1.0, 1.7, Z0 - 0.12, Z0, { bevel: 0.01 });
    bx(g, toon('#c9ccd2'), -22.2, -21.85, 1.1, 1.35, Z0 - 0.13, Z0 - 0.12, { cast: false });
    cyl2(g, m.trim, [-22.85, YS, Z0 - 0.07], [-22.85, YP, Z0 - 0.07], 0.045, 8);
    [[-19.1, 0.06], [-19.25, 0.12]].forEach(([x, o]) => cyl2(g, toon('#e8e4da'), [x, YP + 0.05, Z0 - o], [x, 3.0, Z0 - o], 0.03, 6));
    cyl2(g, toon('#e8e4da'), [-19.1, 3.0, Z0 - 0.06], [-20.6, 3.0, Z0 - 0.06], 0.03, 6);
    // the security camera on the corner, a small lamp, the second-floor window with a grille
    const cam = grp(g, X1 - 0.08, 3.05, Z0 - 0.06, 0);
    bx(cam, m.white, -0.05, 0.05, 0, 0.12, 0, -0.05); bx(cam, m.white, -0.08, 0.08, -0.1, 0.0, -0.05, -0.28, { bevel: 0.02 }); cy(cam, m.dark, 0, -0.06, -0.3, 0.035, 0.02, 10).rotation.x = Math.PI / 2;
    bx(g, m.trim, -22.0, -21.2, 4.4, 5.2, Z0 - 0.06, Z0);
    pl(g, glow('#b7c4cc', 0.9, { cat: 'iza', off: '#6c7a86' }), 0.72, 0.72, -21.6, 4.8, Z0 - 0.062, Math.PI, 0);
    for (let x = -21.95; x < -21.2; x += 0.1) bx(g, m.iron, x - 0.008, x + 0.008, 4.4, 5.2, Z0 - 0.1, Z0 - 0.08, { cast: false });
    // the front window upstairs (the office / flat): aluminium frame, a mullion, half-drawn curtains, a sill
    bx(g, m.trim, X1, X1 + 0.06, 4.55, 5.45, -6.35, -7.65);
    pl(g, glow('#ffe3b8', 0.85, { cat: 'iza', off: '#7b8794' }), 1.18, 0.8, X1 + 0.062, 5.0, -7.0, Math.PI / 2, 0);
    pl(g, toon('#e8e0cc', { side: THREE.DoubleSide }), 0.38, 0.78, X1 + 0.07, 5.0, -6.6, Math.PI / 2, 0, { cast: false });
    bx(g, m.steel, X1 + 0.06, X1 + 0.09, 4.6, 5.4, -7.02, -6.98, { cast: false });
    bx(g, m.steel, X1, X1 + 0.16, 4.5, 4.55, -6.3, -7.7, { cast: false });
    const ofc = canvasTex(160, 48, (c, w, h) => { c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, w, h); T(c, '2F 青空商店 事務所', w / 2, h / 2 + 1, 16, '#2b3a6a', { weight: 800 }); });
    const of = pl(g, new THREE.MeshBasicMaterial({ map: ofc }), 0.5, 0.15, X1 + 0.065, 4.75, -7.4, Math.PI / 2, 0); of.userData.noLine = true;

    // the machines on the pavement, against the side wall
    const zm = Z0 - 0.78; // machine fronts
    // recycling bin
    { const b = grp(g, -22.38, YS, Z0 - 0.38, 0); bx(b, m.white, -0.22, 0.22, 0, 0.82, -0.3, 0.3, { bevel: 0.03 }); [-0.09, 0.09].forEach((x) => cy(b, m.dark, x, 0.62, -0.31, 0.06, 0.02, 12).rotation.x = Math.PI / 2); decal(b, recycleTex(), 0.4, 0.5, 'n', 0, 0.35, -0.305); }
    // the big drinks machine, a carton and a crate of bottles on top
    {
      const v = grp(g, -21.5, YS, Z0 - 0.4, 0);
      bx(v, m.white, -0.52, 0.52, 0, 1.83, -0.38, 0.38, { bevel: 0.03 });
      decal(v, drinkTex(), 0.86, 1.1, 'n', 0, 1.2, -0.385, { k: 1.05 });
      pl(v, glow('#ffffff', 0.35, { cat: 'street', off: '#000000', transparent: true, op: 0.3 }), 0.86, 1.1, 0, 1.2, -0.389, Math.PI, 0);
      bx(v, m.dark, -0.44, 0.1, 0.12, 0.32, -0.4, -0.38, { cast: false }); // take-out slot
      bx(v, toon('#d33a2f'), 0.2, 0.44, 0.45, 0.65, -0.4, -0.38, { cast: false }); bx(v, m.dark, 0.26, 0.38, 0.52, 0.6, -0.41, -0.4, { cast: false });
      box(v, -0.15, 1.83, 0, 0.5, 0.32, 0.42, 0.15, '#c9a26a', '#e8743a');
      const c = crate(v, 0.28, 1.83, 0.05, '#e8a23a', -0.3, '#7a4a20');
      halo(v, 0, 1.2, -0.6, '#e6f2ff', 1.4, 0.18, 'street');
    }
    // two capsule-toy machines, two high
    [[-20.78, '#f2a23a'], [-20.36, '#5ac8fa']].forEach(([x, c], i) => {
      for (let k = 0; k < 2; k++) {
        const gm = grp(g, x, YS + k * 0.62, Z0 - 0.3, 0);
        bx(gm, toon(c), -0.2, 0.2, 0, 0.6, -0.26, 0.26, { bevel: 0.02 });
        decal(gm, gachaTex(k ? (i ? '#7fd65a' : '#ff6a8a') : c), 0.36, 0.5, 'n', 0, 0.32, -0.262, { k: 1.0 });
      }
    });
    // the snack machine with a sleeping cat on it
    { const v = grp(g, -19.7, YS, Z0 - 0.36, 0); bx(v, toon('#f2a6b8'), -0.36, 0.36, 0, 1.62, -0.34, 0.34, { bevel: 0.03 }); decal(v, snackTex(), 0.6, 0.95, 'n', 0, 1.05, -0.345, { k: 1.05 }); bx(v, m.dark, -0.28, 0.28, 0.15, 0.35, -0.35, -0.34, { cast: false }); makeCat(v, 0.05, 1.62, 0.0, 0.6); }
    // the electric cabinet at the corner end, a standing ashtray, a crate of empties, a stray can
    bx(g, toon('#d6d9dd'), -19.25, -18.82, YS, YS + 1.45, Z0 - 0.4, Z0, { bevel: 0.02 });
    bx(g, m.trim, -19.22, -18.85, YS + 0.6, YS + 0.62, Z0 - 0.41, Z0 - 0.4, { cast: false });
    cy(g, m.steel, -22.85, YS, Z0 - 0.95, 0.12, 0.85, 12); cy(g, m.dark, -22.85, YS + 0.85, Z0 - 0.95, 0.13, 0.04, 12);
    crate(g, -23.3, YS, Z0 - 0.35, '#3a6ab8', 0.1, '#6a8a4a');
    cy(g, toon('#3fa34d'), -21.0, YS, Z0 - 1.05, 0.03, 0.12, 8).rotation.z = Math.PI / 2;
    void zm;
  }

  /* ---- the roof: condensers on a frame, pipes, a water tank, vents, an aerial, a pipe rail ---- */
  {
    const y = Y2 + 0.03;
    const unit = (x, z, yy, w = 0.95, h = 0.75, d = 0.38, ry = 0) => {
      const u = grp(g, x, yy, z, ry);
      bx(u, m.white, -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.03 });
      const f = new THREE.Mesh(new THREE.TorusGeometry(h * 0.33, 0.025, 6, 20), toon('#9aa2ab')); f.position.set(-w * 0.12, h / 2, -d / 2 - 0.005); u.add(f);
      for (let k = -3; k <= 3; k++) bx(u, toon('#9aa2ab'), -w * 0.12 - h * 0.3, -w * 0.12 + h * 0.3, h / 2 + k * h * 0.08 - 0.006, h / 2 + k * h * 0.08 + 0.006, -d / 2 - 0.01, -d / 2, { cast: false });
      cy(u, toon('#9aa2ab'), -w * 0.12, h / 2, -d / 2 - 0.01, 0.04, 0.01, 8).rotation.x = Math.PI / 2;
      return u;
    };
    // a steel frame carrying two units, stacked
    const fx = -21.5, fz = -8.9;
    [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(([a, b]) => bx(g, m.trim, fx + a - 0.03, fx + a + 0.03, y, y + 1.65, fz + b - 0.03, fz + b + 0.03));
    [0.02, 0.82].forEach((h) => { bx(g, m.trim, fx - 0.6, fx + 0.6, y + h, y + h + 0.05, fz - 0.28, fz + 0.28); });
    unit(fx, fz, y + 0.07); unit(fx, fz, y + 0.87);
    unit(-19.4, -9.3, y, 0.8, 0.62, 0.32); unit(-22.2, -6.2, y, 0.8, 0.62, 0.32, Math.PI / 2);
    // pipes from the units to the parapet and down the side wall, a cable tray
    cyl2(g, toon('#e8e4da'), [fx + 0.4, y + 0.3, fz - 0.2], [-19.25, y + 0.3, Z0 + 0.25], 0.03, 6);
    cyl2(g, toon('#e8e4da'), [-19.25, y + 0.3, Z0 + 0.25], [-19.25, YP + 0.05, Z0 - 0.12], 0.03, 6);
    cyl2(g, toon('#e8e4da'), [-19.4, y + 0.2, -9.1], [-19.1, YP + 0.05, Z0 - 0.06], 0.03, 6);
    bx(g, m.trim, -22.6, -19.0, y, y + 0.08, -6.0, -5.85);
    // water tank on a stand, vent stacks, a box, the aerial
    [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([a, b]) => bx(g, m.trim, -19.6 + a - 0.025, -19.6 + a + 0.025, y, y + 0.55, -6.3 + b - 0.025, -6.3 + b + 0.025));
    cy(g, toon('#e9ebee'), -19.6, y + 0.55, -6.3, 0.42, 0.75, 18); cy(g, m.trim, -19.6, y + 1.3, -6.3, 0.2, 0.06, 12);
    [[-20.6, -6.9], [-20.2, -7.5]].forEach(([x, z]) => { cyl2(g, m.steel, [x, y, z], [x, y + 0.75, z], 0.07, 8); cy(g, m.steel, x, y + 0.75, z, 0.1, 0.06, 8); });
    bx(g, toon('#5a8a4a'), -22.4, -22.0, y, y + 0.32, -7.8, -7.5, { bevel: 0.02 });
    cyl2(g, m.iron, [-22.5, y, -9.5], [-22.5, y + 2.0, -9.5], 0.02, 5);
    for (let k = 0; k < 5; k++) cyl2(g, m.iron, [-22.5, y + 1.3 + k * 0.14, -9.5 - 0.35 + k * 0.02], [-22.5, y + 1.3 + k * 0.14, -9.5 + 0.35 - k * 0.02], 0.007, 3);
    // a pipe rail along the parapet, posts every metre
    const rail = (a, b) => { cyl2(g, m.trim, [a[0], YP + 0.65, a[1]], [b[0], YP + 0.65, b[1]], 0.02, 5); const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let k = 0; k <= n; k++) { const t = k / n; cyl2(g, m.trim, [a[0] + (b[0] - a[0]) * t, YP + 0.06, a[1] + (b[1] - a[1]) * t], [a[0] + (b[0] - a[0]) * t, YP + 0.65, a[1] + (b[1] - a[1]) * t], 0.016, 4); } };
    rail([X0 + 0.05, Z0 + 0.05], [X1 - 0.05, Z0 + 0.05]); rail([X1 - 0.05, Z0 + 0.05], [X1 - 0.05, Z1 - 0.05]);
    // the roof takes petals / leaves / snow
    const xc = (X0 + X1) / 2, half = (X1 - X0) / 2;
    // (given in the local frame, handed over in world coordinates)
    const roof = (id, a, b, n, D, yy, drop, o) => ({ id, a: TW(...a), b: TW(...b), n: TN(...n), D, y: yy, drop, ...o });
    (reg.extraRoofs ||= []).push(
      roof('zakW', [xc, Z0 + 0.15], [xc, Z1 - 0.15], [-1, 0], half - 0.15, Y2 + 0.04, 0.03, { w: { petal: 0.6, leaf: 0.6 }, snow: 0.14, ridge: true }),
      roof('zakE', [xc, Z1 - 0.15], [xc, Z0 + 0.15], [1, 0], half - 0.15, Y2 + 0.04, 0.03, { w: { petal: 0.6, leaf: 0.6 }, snow: 0.14, ridge: true }),
      roof('zakAwning', [X1, Z1 + 0.05], [X1, Z0 - 0.05], [1, 0], AW.d, AW.y, AW.drop, { w: { petal: 0.7, leaf: 0.7 }, snow: 0.1 }),
    );
  }

  /* ---- goods outside the front (the walk to the open door stays clear) ---- */
  {
    const x = X1 + 0.35;
    // crates of drinks stacked by the shutter, cartons, a potted rubber plant, a small chest freezer by the door
    crate(g, x, YS, -5.62, '#d33a2f', 0.05, '#4a2a18'); crate(g, x, YS + 0.26, -5.62, '#d33a2f', -0.05, '#3f6a3a');
    crate(g, x + 0.05, YS, -6.08, '#2e6da4', 0.1); crate(g, x + 0.05, YS + 0.26, -6.08, '#2e6da4', 0.0, '#c8e6f0');
    box(g, x + 0.02, YS + 0.52, -5.85, 0.4, 0.22, 0.32, 0.2, '#c9a26a', '#f4f1ea'); // a carton on the crates
    const fic = makeFicusPot({ seed: 41 }); fic.position.set(x + 0.02, YS, -7.62); fic.scale.setScalar(0.9); g.add(fic);
    // the chest freezer (アイス) by the shop door
    { const f = grp(g, x + 0.08, YS, -8.35, 0); bx(f, m.white, -0.3, 0.3, 0, 0.78, -0.45, 0.45, { bevel: 0.03 }); bx(f, m.glass, -0.27, 0.27, 0.78, 0.8, -0.42, 0.42); bx(f, toon('#2e6da4'), 0.3, 0.302, 0.4, 0.72, -0.4, 0.4, { cast: false }); for (let k = 0; k < 8; k++) bx(f, toon(['#f2c230', '#ff6a8a', '#5ac8fa', '#f4f1ea'][k % 4]), -0.22 + (k % 4) * 0.11, -0.14 + (k % 4) * 0.11, 0.62, 0.74, -0.3 + ((k / 4) | 0) * 0.3, -0.12 + ((k / 4) | 0) * 0.3, { cast: false }); const ic = canvasTex(160, 60, (c, w, h) => { c.fillStyle = '#2e6da4'; c.fillRect(0, 0, w, h); T(c, 'アイス', w / 2, h / 2 + 2, 30, '#ffffff', { weight: 900 }); }); const il = pl(f, new THREE.MeshBasicMaterial({ map: ic }), 0.5, 0.2, 0.304, 0.56, 0, Math.PI / 2, 0); il.userData.noLine = true; }
    // a vegetable basket, a rack of snacks + price tags, an umbrella stand, a hand trolley, a bin
    { const b = grp(g, x + 0.05, YS, -6.6, 0); bx(b, toon('#a87a4c'), -0.25, 0.25, 0, 0.3, -0.2, 0.2, { bevel: 0.02 }); for (let k = 0; k < 9; k++) sph(b, toon(k % 3 ? '#c9894a' : '#d8c27a'), 0.055, -0.15 + (k % 3) * 0.15, 0.32, -0.12 + ((k / 3) | 0) * 0.12, 1, 0.8, 1); const pt = canvasTex(96, 48, (c, w, h) => { c.fillStyle = '#fff04a'; c.fillRect(0, 0, w, h); T(c, '3コ ¥198', w / 2, h / 2 + 1, 18, '#d33a2f', { weight: 900 }); }); const tg = pl(b, new THREE.MeshBasicMaterial({ map: pt }), 0.22, 0.11, 0.26, 0.42, 0.0, Math.PI / 2, 0); tg.userData.noLine = true; }
    { const r = grp(g, X1 + 0.3, YS, -7.1, 0); [-0.18, 0.18].forEach((z) => bx(r, m.steel, -0.2, 0.2, 0, 1.25, z - 0.015, z + 0.015)); [0.3, 0.65, 1.0].forEach((h) => { bx(r, m.steel, -0.2, 0.2, h - 0.02, h, -0.18, 0.18); for (let k = 0; k < 3; k++) bx(r, toon(['#f2c230', '#ff8a3a', '#d33a2f', '#5ac8fa'][(k + h * 10) % 4 | 0]), -0.14, 0.12, h, h + 0.18, -0.15 + k * 0.1, -0.07 + k * 0.1, { cast: false }); }); const pt = canvasTex(120, 56, (c, w, h) => { c.fillStyle = '#d33a2f'; c.fillRect(0, 0, w, h); T(c, 'おかし 98円', w / 2, h / 2 + 1, 18, '#ffffff', { weight: 900 }); }); const tg = pl(r, new THREE.MeshBasicMaterial({ map: pt }), 0.34, 0.16, 0.205, 1.12, 0, Math.PI / 2, 0); tg.userData.noLine = true; }
    { const u = grp(g, X1 + 0.22, YS, Z0 - 0.1, 0); cy(u, toon('#2e6da4'), 0, 0, 0, 0.11, 0.45, 12); cyl2(u, toon('#c0331f'), [0.02, 0.1, 0], [0.06, 0.9, 0.04], 0.022, 5); cyl2(u, toon('#2f2f33'), [-0.03, 0.1, 0], [-0.06, 0.95, -0.03], 0.022, 5); cyl2(u, toon('#f4f1ea', { op: 0.85 }), [0.0, 0.1, 0.02], [0.01, 0.85, 0.07], 0.02, 5); }
    { const t = grp(g, X1 + 0.35, YS, Z1 + 0.85, 0.3); bx(t, m.steel, -0.2, 0.2, 0.05, 0.08, -0.25, 0.25); cyl2(t, m.steel, [-0.18, 0.08, -0.25], [-0.18, 1.0, -0.3], 0.015, 4); cyl2(t, m.steel, [0.18, 0.08, -0.25], [0.18, 1.0, -0.3], 0.015, 4); cyl2(t, m.steel, [-0.18, 1.0, -0.3], [0.18, 1.0, -0.3], 0.015, 4); [-0.15, 0.15].forEach((xx) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 5, 10), m.dark); w.rotation.y = Math.PI / 2; w.position.set(xx, 0.05, 0.2); t.add(w); }); box(t, 0, 0.08, -0.02, 0.36, 0.3, 0.36, 0, '#c9a26a', '#2e6da4'); }
    cy(g, toon('#5a6068'), X0 + 0.4, YS, Z1 + 0.35, 0.16, 0.55, 12); cy(g, toon('#3f454c'), X0 + 0.4, YS + 0.55, Z1 + 0.35, 0.17, 0.04, 12); // bin round the side
    // a tissue / kitchen-paper carton and a detergent promo board just past the south end
    box(g, X1 + 0.3, YS, Z1 + 0.25, 0.42, 0.3, 0.32, 0, '#f4f1ea', '#5ac8fa');
    { const pb = canvasTex(120, 160, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2e6da4'; c.fillRect(0, 0, w, 40); T(c, '洗剤', w / 2, 21, 24, '#ffffff', { weight: 900 }); c.fillStyle = '#5ac8fa'; roundRect(c, 30, 52, 60, 70, 10); c.fill(); T(c, '¥298', w / 2, 140, 24, '#d33a2f', { weight: 900 }); }); const s = grp(g, X1 + 0.3, YS, Z1 + 0.42 + 0.5, Math.PI / 2 - 0.3); cyl2(s, m.iron, [0, 0, 0], [0, 0.95, 0], 0.012, 4); bx(s, m.iron, -0.15, 0.15, 0, 0.02, -0.15, 0.15); const pp = pl(s, new THREE.MeshBasicMaterial({ map: pb }), 0.3, 0.4, 0, 0.75, 0.015, 0, 0); pp.userData.noLine = true; }
  }

  /* ---- the street round the corner: guard rails, bollards, the signal, the pole's signs ---- */
  {
    const rw = toon('#ffffff'), rr = toon('#d33a2f');
    // a red / white guard rail section: posts with white bands, two rails
    const guard = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.2));
      for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; cy(g, rr, x, YS, z, 0.03, 0.9, 8); cy(g, rw, x, YS + 0.62, z, 0.032, 0.08, 8, { cast: false }); }
      [0.88, 0.48].forEach((h) => cyl2(g, rr, [a[0], YS + h, a[1]], [b[0], YS + h, b[1]], 0.026, 8));
      const seg = Math.max(2, Math.round(L / 0.35));
      for (let k = 0; k < seg; k += 2) { const t0 = k / seg, t1 = (k + 1) / seg; cyl2(g, rw, [a[0] + (b[0] - a[0]) * t0, YS + 0.88, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, YS + 0.88, a[1] + (b[1] - a[1]) * t1], 0.028, 8); }
    };
    // (local frame: x -15.78 is the Kaigan-dori kerb in front of the shop, z -11.78 the 裏路地 kerb by the machines)
    guard([-15.78, -5.0], [-15.78, -6.0]); // along Kaigan-dori, either side of the street lamp
    guard([-15.78, -6.8], [-15.78, -8.6]);
    guard([-16.9, -11.78], [-18.75, -11.78]); // along 裏路地 from the signal past the machines
    guard([-20.2, -11.78], [-23.05, -11.78]); // along 裏路地 past the machines (up to the sign post)
    // black-yellow bollards at the corner
    [[-16.2, -11.5], [-15.8, -11.1]].forEach(([x, z]) => { cy(g, m.iron, x, YS, z, 0.06, 0.85, 10); for (let k = 0; k < 3; k++) cy(g, m.yellow, x, YS + 0.12 + k * 0.25, z, 0.062, 0.1, 10, { cast: false }); sph(g, m.iron, 0.06, x, YS + 0.85, z, 1, 0.6, 1); });
    // the pedestrian signal with its push-button box at the corner
    { const sx = -16.45, sz = -11.75; cy(g, toon('#7d869a'), sx, YS, sz, 0.05, 2.7, 10); const hd = grp(g, sx, YS + 2.1, sz, -Math.PI / 4); bx(hd, toon('#2b3242'), -0.17, 0.17, 0, 0.62, 0.05, 0.22, { bevel: 0.02 }); pl(hd, glow('#ff3a2a', 1.8, { cat: 'street', off: '#5a2020' }), 0.2, 0.2, 0, 0.45, 0.225, 0, 0); pl(hd, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.25, 0.18) }), 0.2, 0.2, 0, 0.17, 0.225, 0, 0); const pb = grp(g, sx, YS + 1.0, sz, -Math.PI / 4); bx(pb, m.yellow, -0.09, 0.09, 0, 0.28, 0.05, 0.14, { bevel: 0.01 }); cy(pb, m.white, 0, 0.12, 0.15, 0.03, 0.02, 10).rotation.x = Math.PI / 2; const lb = canvasTex(64, 96, (c, w, h) => { c.fillStyle = '#2e6da4'; c.fillRect(0, 0, w, h); ['押', 'ボ', 'タ', 'ン'].forEach((ch, i) => T(c, ch, w / 2, 14 + i * 22, 18, '#ffffff', { weight: 900 })); }); const lp = pl(g, new THREE.MeshBasicMaterial({ map: lb }), 0.12, 0.6, sx + 0.04, YS + 1.75, sz + 0.06, -Math.PI / 4, 0); lp.userData.noLine = true; }
    // street signs on the Kita-dori pole at (-19, -11.7): the blue address plate, the green clinic sign
    // a sign post at the far end of the machines on 裏路地 (world -16.8, -0.5): grey, a yellow-black sleeve, the signs
    { const px = -23.4, pz = -11.6;
      cy(g, toon('#8e939a'), px, YS, pz, 0.075, 5.2, 10, { rt: 0.85 }); cy(g, m.trim, px, YS + 5.2, pz, 0.08, 0.05, 10);
      for (let k = 0; k < 6; k++) cy(g, k % 2 ? m.iron : m.yellow, px, YS + 0.3 + k * 0.28, pz, 0.08, 0.28, 10, { cast: false }); const ad = pl(g, new THREE.MeshBasicMaterial({ map: poster('address') }), 0.28, 0.84, px, 4.3, pz + 0.13, 0, 0); ad.userData.noLine = true; const ad2 = pl(g, new THREE.MeshBasicMaterial({ map: poster('address') }), 0.28, 0.84, px, 4.3, pz + 0.125, Math.PI, 0); ad2.userData.noLine = true; bx(g, m.iron, px - 0.15, px + 0.15, 3.86, 4.74, pz + 0.11, pz + 0.12, { cast: false }); const cl = pl(g, new THREE.MeshBasicMaterial({ map: poster('clinic') }), 0.3, 1.2, px + 0.13, 2.6, pz, Math.PI / 2, 0); cl.userData.noLine = true; const cl2 = pl(g, new THREE.MeshBasicMaterial({ map: poster('clinic') }), 0.3, 1.2, px + 0.125, 2.6, pz, -Math.PI / 2, 0); cl2.userData.noLine = true; [1.9, 3.3].forEach((y) => cyl2(g, m.iron, [px, y, pz], [px + 0.13, y, pz], 0.01, 4)); }
  }

  g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });
  // inside the shop and behind its walls nothing takes snow
  noSnowBox(-23.05, -0.95, -18.55, 3.48, Y1); // the local box (X0 + 0.15 .. X1, Z0 + 0.15 .. Z1 - 0.15) in world terms
  reg.zakkaya = { rect: ZAK_WORLD };
  return g;
}
