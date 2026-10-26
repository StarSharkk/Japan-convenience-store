import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, noSnowBox } from './core.js';
import { makeGlass } from './fx.js';
import { T } from './tex.js';
import { makeShrub } from './tree.js';
import { bladeGeo, placeLeaf, mergeInto, leafTex, leafMat } from './plants/kit.js';
import { swingDoors, doorHit } from './doors.js';
import { P } from './palette.js';
import { sharedPlants, potPlants, planterPlants, plantAt } from './plants/wild.js';

/* ====================================================================================================
   BREAD - the one-storey neighbourhood bakery on the lot left of the LAWSON (replaces the izakaya, which is
   kept as a module: see site.js / izakaya.js).

   The shop stands back from Kaigan-dori (front wall at z 0.9) so a wooden terrace opens in front of it:
     outside   cream plaster + light honey wood, a thick cream canopy across the front with BREAD on its fascia
               and a giant croissant resting on it (on a low plinth, lit from the canopy edge at night); a big
               shop window and double wooden glass doors (doors.js: they open while the camera is at the door
               or inside); the WEST side is nearly all glass, so the display shelves read from the street
     terrace   a low plank deck with three round tables (two chairs each), a TODAY'S BREAD board, a BREAD sign
               stand, crates of baguettes, planters with shrubs, pots, a welcome mat; the walk beyond stays clear
     inside    stepped display along the west glass, a front-window stage, a centre table of baskets, a glass
               showcase of cakes / tarts / donuts / danishes in front of the till, shelves along the back and
               the east wall, a tray + tong station, the bake house glimpsed through a doorway
     bread     croissant, pain au chocolat, baguette, rolls, 食パン, sliced bread, bagel, danish, cinnamon roll,
               あんパン, メロンパン, カレーパン, クリームパン, sandwiches, donuts, fruit tarts, cake, cookies,
               scones, gift boxes - each its own shape and colour
   Warm 2700-3000 K light inside; nothing under the roof takes snow (noSnowBox).
   ==================================================================================================== */

export const BAK = { X0: -12.2, X1: -7.9, Z0: -6.6, Z1: 0.9 };
const { X0, X1, Z0, Z1 } = BAK;
const Y0 = 0.15; // pavement
const YF = 0.27; // shop floor = terrace deck
const YW = 3.9; // wall top / flat roof
const YP = 4.3; // front parapet
const CAN = { y0: 3.0, y1: 3.32, d: 1.05 }; // canopy: underside, top, depth
const XC = (X0 + X1) / 2;
const WIN = { x0: X0 + 0.22, x1: -9.75, y0: 0.45, y1: 2.85 };
const DOOR = { x0: -9.55, x1: -8.35, y1: 2.55 };
const SIDE = { z0: -5.2, z1: Z1 - 0.3, y0: 0.42, y1: 2.95 }; // the west glass wall
const IN = { x0: X0 + 0.12, x1: X1 - 0.12, z1: Z1 - 0.12 };
const PART = -5.0; // partition to the bake house
const DECK = { x0: X0 - 0.25, x1: X1, z1: 4.45 };

/* ---------------------------------------------------------------- textures */
const tex = {};
function boardTex(key, cols, gap = 'rgba(70,40,20,0.45)', boards = 7) {
  // vertical boards, 1 m per tile: tone per board, grain, a little weathering
  return (tex[key] ||= canvasTex(256, 256, (g, w, h) => {
    const R = rng(key.length * 13 + 5), bw = w / boards;
    for (let i = 0; i < boards; i++) {
      g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect(i * bw, 0, bw, h);
      for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(110,70,35,${0.07 + R() * 0.08})`; g.lineWidth = 1; g.beginPath(); const x = i * bw + 3 + R() * (bw - 6); g.moveTo(x, 0); g.bezierCurveTo(x + R() * 6 - 3, h * 0.35, x + R() * 6 - 3, h * 0.7, x + R() * 4 - 2, h); g.stroke(); }
      for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(255,245,225,${0.05 + R() * 0.05})`; g.fillRect(i * bw + R() * bw * 0.6, R() * h, bw * 0.3, 10 + R() * 40); }
      g.fillStyle = gap; g.fillRect(i * bw, 0, 2, h);
    }
  }, { repeat: true }));
}
function plasterTex() {
  return (tex.plaster ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3e9d4'; g.fillRect(0, 0, w, h);
    const R = rng(21);
    for (let i = 0; i < 240; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,252,242' : '160,138,104'},${0.025 + R() * 0.035})`; g.fillRect(R() * w, R() * h, 12 + R() * 34, 2 + R() * 5); }
  }, { repeat: true }));
}
function rattanTex() {
  return (tex.rattan ||= canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c9a56c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) { g.fillStyle = (y / 8 + x / 16) % 2 ? '#b38a52' : '#dcbc84'; g.fillRect(x + ((y / 8) % 2) * 8, y, 12, 6); }
  }, { repeat: true }));
}
function melonTex() {
  return (tex.melon ||= canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#efc77c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(170,110,40,0.55)'; g.lineWidth = 3;
    for (let i = -h; i < w + h; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  }));
}
function rollTopTex() {
  return (tex.rollTop ||= canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c48a4f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a5326'; g.lineWidth = 5; g.beginPath();
    for (let t = 0; t < 18; t += 0.1) { const r = t * 3.3, x = w / 2 + Math.cos(t) * r, y = h / 2 + Math.sin(t) * r; t ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = 'rgba(255,250,240,0.95)'; g.lineWidth = 6;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(20 + k * 22, 18); g.bezierCurveTo(30 + k * 22, 60, 10 + k * 22, 80, 28 + k * 22, 112); g.stroke(); }
  }));
}
function crumbTex() {
  return (tex.crumb ||= canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#b8783a'; g.fillRect(0, 0, w, h);
    const R = rng(9); for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.5 ? '#d9a35e' : '#8f5626'; g.fillRect(R() * w, R() * h, 2 + R() * 2, 2 + R() * 2); }
  }));
}
function croissantTex(dark) {
  // giant croissant lobes: golden top, deeper bake underneath, flaky streaks along the layers
  const k = dark ? 'crD' : 'crL';
  return (tex[k] ||= canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (dark) { gr.addColorStop(0, '#e9a64e'); gr.addColorStop(0.45, '#c87a30'); gr.addColorStop(1, '#8a4a1c'); }
    else { gr.addColorStop(0, '#f7c86a'); gr.addColorStop(0.45, '#df9a44'); gr.addColorStop(1, '#a35a22'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const R = rng(dark ? 7 : 3);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '255,235,180' : '120,60,20'},${0.12 + R() * 0.18})`; g.lineWidth = 1 + R() * 2.5; const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 10 - 5, w * 0.7, y + R() * 10 - 5, w, y + R() * 6 - 3); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(R() * w, R() * h * 0.4, 2, 2); } // a few sugar glints on top
  }));
}
function breadSignTex(small = false) {
  const k = small ? 'signS' : 'sign';
  return (tex[k] ||= canvasTex(900, 120, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // a little croissant mark, then BREAD in a warm, friendly sans
    const cx = w / 2 - 190, cyy = h / 2 + 2;
    g.fillStyle = '#c98a45';
    [[-34, 0.55], [-17, 0.8], [0, 1], [17, 0.8], [34, 0.55]].forEach(([dx, s]) => { g.beginPath(); g.ellipse(cx + dx, cyy - 6 + Math.abs(dx) * 0.25, 13 * s, 22 * s, dx * 0.02, 0, 7); g.fill(); });
    g.strokeStyle = '#8a5326'; g.lineWidth = 2; [-26, -9, 9, 26].forEach((dx) => { g.beginPath(); g.moveTo(cx + dx, cyy - 22); g.lineTo(cx + dx, cyy + 12); g.stroke(); });
    g.fillStyle = '#5a3a22'; g.font = `800 ${small ? 70 : 78}px "Avenir Next","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (g.letterSpacing !== undefined) g.letterSpacing = '14px';
    g.fillText('BREAD', w / 2 + 40, h / 2 + 4);
    if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
    g.fillStyle = '#a57a4e'; g.font = '700 20px "Hiragino Sans",sans-serif'; g.fillText('焼きたてパン  ·  BAKERY', w / 2 + 250, h / 2 + 34);
  }));
}
function chalkTex(lines, key, title = '本日のパン', sub = "Today's Bread") {
  return (tex[key] ||= canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = '#26332c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(243,238,223,0.45)'; g.lineWidth = 2; g.strokeRect(12, 12, w - 24, h - 24);
    T(g, title, w / 2, 46, title.length > 8 ? 25 : 32, '#f3eedf', { weight: 800 });
    T(g, sub, w / 2, 80, 18, '#e8c98a', { weight: 700 });
    lines.forEach(([t, p, c], i) => {
      g.fillStyle = c; g.beginPath(); g.arc(34, 122 + i * 42, 8, 0, 7); g.fill();
      g.fillStyle = '#f3eedf'; g.font = `600 ${t.length > 5 ? 17 : 20}px "Hiragino Sans","Noto Sans JP",sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, 50, 124 + i * 42);
      g.font = '700 19px "Hiragino Sans",sans-serif'; g.textAlign = 'right'; g.fillText(p, w - 20, 124 + i * 42);
    });
  }));
}
function windowLetterTex() {
  return (tex.letter ||= canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,252,244,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 700 44px Georgia,"Times New Roman",serif'; g.fillText('Fresh Bread', w / 2, 74);
    g.font = '800 34px "Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif'; g.fillText('焼きたて · 毎朝7時', w / 2, 132);
  }));
}
function hoursTex() {
  return (tex.hours ||= canvasTex(160, 160, (g, w, h) => {
    g.fillStyle = '#f6efe0'; roundRect(g, 4, 4, w - 8, h - 8, 12); g.fill();
    g.strokeStyle = '#a57a4e'; g.lineWidth = 3; roundRect(g, 9, 9, w - 18, h - 18, 9); g.stroke();
    T(g, 'OPEN', w / 2, 32, 20, '#5a3a22', { weight: 800 });
    T(g, '7:00 – 18:00', w / 2, 64, 22, '#3a2a1e', { weight: 800 });
    T(g, '定休日 月曜', w / 2, 96, 17, '#7a3b2a', { weight: 700 });
    T(g, 'パンがなくなり次第終了', w / 2, 126, 12, '#5a4a3a', { weight: 600 });
  }));
}
function payTex() {
  return (tex.pay ||= canvasTex(160, 48, (g, w, h) => {
    g.fillStyle = '#ffffff'; roundRect(g, 2, 2, w - 4, h - 4, 6); g.fill();
    [['#e74c3c', 'IC'], ['#2e6da4', 'QR'], ['#f2c14e', 'CARD']].forEach(([c, t], i) => { g.fillStyle = c; roundRect(g, 8 + i * 50, 9, 44, 30, 5); g.fill(); T(g, t, 30 + i * 50, 25, 14, '#ffffff', { weight: 900 }); });
  }));
}
function openTex(open) {
  return (tex['open' + open] ||= canvasTex(160, 80, (g, w, h) => {
    g.fillStyle = open ? '#f6efe0' : '#3a2a20'; roundRect(g, 3, 3, w - 6, h - 6, 12); g.fill();
    g.strokeStyle = open ? '#a57a4e' : '#d9b57a'; g.lineWidth = 4; roundRect(g, 8, 8, w - 16, h - 16, 9); g.stroke();
    T(g, open ? 'OPEN' : 'CLOSED', w / 2, 32, 28, open ? '#5a3a22' : '#f6efe0', { weight: 900 });
    T(g, open ? '営業中' : '本日は終了', w / 2, 58, 16, open ? '#7a3b2a' : '#d9b57a', { weight: 700 });
  }));
}
function menuTex() {
  return (tex.menu ||= canvasTex(320, 220, (g, w, h) => {
    g.fillStyle = '#26332c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a06a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    T(g, 'DRINK  ドリンク', w / 2, 34, 22, '#f3eedf', { weight: 800 });
    [['ブレンドコーヒー', '¥300'], ['カフェラテ', '¥380'], ['紅茶', '¥300'], ['ミルク', '¥200']].forEach(([a, b], i) => {
      g.fillStyle = '#f3eedf'; g.font = '600 18px "Hiragino Sans",sans-serif'; g.textBaseline = 'middle';
      g.textAlign = 'left'; g.fillText(a, 28, 76 + i * 34); g.textAlign = 'right'; g.fillText(b, w - 28, 76 + i * 34);
    });
  }));
}
function priceTex(name, price) {
  const k = 'p' + name;
  return (tex[k] ||= canvasTex(128, 72, (g, w, h) => {
    g.fillStyle = '#fbf6ea'; roundRect(g, 2, 2, w - 4, h - 4, 8); g.fill();
    g.strokeStyle = '#c9a77a'; g.lineWidth = 2; roundRect(g, 5, 5, w - 10, h - 10, 6); g.stroke();
    T(g, name, w / 2, 26, name.length > 5 ? 15 : 18, '#3a2a1e', { weight: 800 });
    T(g, price, w / 2, 52, 20, '#7a3b2a', { weight: 900 });
  }));
}
function printTex() {
  return (tex.print ||= canvasTex(180, 250, (g, w, h) => {
    g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a77a'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#d6a05c'; g.beginPath(); g.ellipse(w / 2 - 10, 140, 50, 26, 0, Math.PI, 0); g.lineTo(w / 2 + 40, 158); g.lineTo(w / 2 - 60, 158); g.closePath(); g.fill();
    g.fillStyle = '#c98a45'; g.save(); g.translate(w / 2 + 20, 110); g.rotate(-0.6); g.beginPath(); g.ellipse(0, 0, 66, 12, 0, 0, 7); g.fill(); g.restore();
    g.strokeStyle = '#b8954a'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(40 + k * 8, 170); g.quadraticCurveTo(36 + k * 6, 90, 50 + k * 10, 50); g.stroke(); }
    T(g, 'BOULANGERIE', w / 2, 196, 16, '#6b4123', { weight: 800 });
    T(g, 'pain de mie · baguette', w / 2, 220, 11, '#8a6a46', { weight: 600 });
  }));
}
function signStandTex() {
  return (tex.stand ||= canvasTex(160, 400, (g, w, h) => {
    g.fillStyle = '#f4ead6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a57a4e'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#c98a45'; [[-22, 0.6], [-11, 0.85], [0, 1], [11, 0.85], [22, 0.6]].forEach(([dx, s]) => { g.beginPath(); g.ellipse(w / 2 + dx, 70 + Math.abs(dx) * 0.3, 9 * s, 16 * s, 0, 0, 7); g.fill(); });
    g.fillStyle = '#5a3a22'; g.font = '900 38px "Avenir Next","Hiragino Sans",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    'BREAD'.split('').forEach((c, i) => g.fillText(c, w / 2, 140 + i * 46));
    g.font = '700 16px "Hiragino Sans",sans-serif'; g.fillStyle = '#7a3b2a'; g.fillText("TODAY'S", w / 2, 372);
  }));
}
function sliceTex() {
  return (tex.slice ||= canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#b8743a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4e3bf'; roundRect(g, 5, 5, w - 10, h - 10, 12); g.fill();
    const R = rng(4); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(200,160,100,0.35)'; g.beginPath(); g.arc(8 + R() * (w - 16), 8 + R() * (h - 16), 1 + R() * 1.5, 0, 7); g.fill(); }
  }));
}

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.plaster) return M;
  M.plaster = toon('#ffffff', { map: plasterTex(), nocache: true, lit: 0.12 });
  M.plasterIn = toon('#f6eedc', { lit: 0.35 });
  M.slat = toon('#ffffff', { map: boardTex('slat', ['#d9b07a', '#d2a872', '#ddb682', '#cfa46d'], 'rgba(120,80,40,0.45)', 10), lit: 0.2, nocache: true });
  M.wainscot = toon('#ffffff', { map: boardTex('wain', ['#d6aa72', '#ddb37c', '#cfa36a', '#d9ae76'], 'rgba(120,80,40,0.4)', 8), lit: 0.3, nocache: true });
  M.floor = toon('#ffffff', { map: boardTex('floor', ['#c9995f', '#c2915a', '#d1a167', '#bd8c55'], 'rgba(90,55,25,0.5)', 5), lit: 0.3, nocache: true });
  M.deck = toon('#ffffff', { map: boardTex('deck', ['#c69a64', '#cfa36d', '#bd905b', '#c9a069'], 'rgba(70,45,20,0.6)', 6), lit: 0.12, nocache: true });
  M.rattan = toon('#ffffff', { map: rattanTex(), nocache: true, lit: 0.25 });
  M.frame = toon('#c58f55', { lit: 0.2 }); // honey wood frames
  M.frameD = toon('#9a6838', { lit: 0.18 });
  M.table = toon('#c9935a', { lit: 0.3 });
  M.tableD = toon('#8f6038', { lit: 0.2 });
  M.cream = toon('#f3ead6');
  M.creamD = toon('#e2d4b8');
  M.stone = toon('#b3aa9c');
  M.iron = toon('#3a3c40');
  M.brass = toon('#c9a24a');
  M.white = toon('#f6f3ec');
  M.kraft = toon('#c9a77a');
  M.clay = toon('#b8653f');
  M.steel = toon('#c3c9ce');
  M.glassCase = toon('#eef6f4', { op: 0.18 });
  return M;
}
/** a box whose UVs are in metres / tile on every face, so boards keep their size on any box */
function wbx(parent, mat, x0, x1, y0, y1, z0, z1, tile = 1, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = o.cast ?? true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function makeBins(root) {
  const bins = new Map(), rel = new THREE.Matrix4();
  return {
    add(parent, mat, geo) {
      if (parent && parent !== root) { root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false); geo.applyMatrix4(rel.copy(root.matrixWorld).invert().multiply(parent.matrixWorld)); }
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(geo);
    },
    flush() { bins.forEach((list, mat) => root.add(mergeInto(list, mat, { cast: false }))); },
  };
}

/* ---------------------------------------------------------------- bread (stylised, toon colours, each kind its own shape) */
const B = {};
function breadMats() {
  if (B.crust) return B;
  B.crust = toon('#c98a45', { lit: 0.12 }); B.crustD = toon('#a5642e', { lit: 0.1 }); B.crustL = toon('#ddaa66', { lit: 0.12 });
  B.loaf = toon('#d6a05c', { lit: 0.12 }); B.loafTop = toon('#b4743a', { lit: 0.1 });
  B.slice = toon('#ffffff', { map: sliceTex(), lit: 0.15, nocache: true });
  B.anpan = toon('#94522a', { lit: 0.12 }); B.sesame = toon('#f3ead0');
  B.melon = toon('#ffffff', { map: melonTex(), lit: 0.15, nocache: true });
  B.curry = toon('#ffffff', { map: crumbTex(), lit: 0.12, nocache: true });
  B.cream = toon('#e8b86e', { lit: 0.14 });
  B.croissant = toon('#c8843a', { lit: 0.12 });
  B.choco = toon('#4a2a18');
  B.roll = toon('#d59c55', { lit: 0.12 });
  B.bagel = toon('#bf8040', { lit: 0.12 });
  B.cinnSide = toon('#c48a4f', { lit: 0.12 }); B.cinnTop = toon('#ffffff', { map: rollTopTex(), lit: 0.15, nocache: true });
  B.white = toon('#f4ecd8'); B.egg = toon('#f3d35a'); B.lettuce = toon('#7fb85a'); B.ham = toon('#e7a1a0');
  B.scone = toon('#d8a865', { lit: 0.12 }); B.cookie = toon('#c98d4c', { lit: 0.12 }); B.pie = toon('#cf9a52', { lit: 0.12 });
  B.custard = toon('#f6dc8a'); B.icing = toon('#fbf6ec'); B.pink = toon('#f2a3b8'); B.chocI = toon('#5a3420');
  B.berry = toon('#d83a4a'); B.kiwi = toon('#8cc04a'); B.blue = toon('#4a4a9a'); B.orange = toon('#f29a3a');
  B.sponge = toon('#f2d9a2');
  B.bag = toon('#f3efe6', { op: 0.92 }); B.jar = toon('#eef6f4', { op: 0.16 });
  return B;
}
function shokupan(p, x, y, z, ry = 0, s = 1) {
  const b = breadMats(), g = grp(p, x, y, z, ry); g.scale.setScalar(s);
  bx(g, b.loaf, -0.11, 0.11, 0, 0.1, -0.055, 0.055, { bevel: 0.02 });
  [-0.055, 0.055].forEach((dx) => sph(g, b.loafTop, 0.06, dx, 0.1, 0, 0.95, 0.6, 0.95)); // the two humps of a 山型 loaf
  return g;
}
function slicedLoaf(p, x, y, z, ry = 0) {
  // a half loaf with slices leaning off the cut end
  const b = breadMats(), g = grp(p, x, y, z, ry);
  bx(g, b.loaf, -0.1, 0.02, 0, 0.11, -0.055, 0.055, { bevel: 0.015 });
  sph(g, b.loafTop, 0.06, -0.04, 0.1, 0, 1.1, 0.55, 0.95);
  for (let k = 0; k < 4; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.11, 0.11), [b.slice, b.slice, b.crust, b.crust, b.crust, b.crust]); sl.position.set(0.035 + k * 0.022, 0.055, 0); sl.rotation.z = -0.15 - k * 0.06; g.add(sl); }
  return g;
}
function baguette(p, x, y, z, ry = 0, tilt = 0, L = 0.5) {
  const b = breadMats(), g = grp(p, x, y, z, ry); g.rotation.z = tilt;
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, L, 4, 10), b.crust); m.rotation.z = Math.PI / 2; m.position.y = 0.032; m.castShadow = true; g.add(m);
  for (let k = 0; k < 4; k++) sph(g, b.crustL, 0.02, -L / 2 + 0.08 + k * (L - 0.16) / 3, 0.058, 0, 2.2, 0.35, 0.8);
  return g;
}
function croissant(p, x, y, z, ry = 0) {
  const b = breadMats(), g = grp(p, x, y, z, ry);
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.024, 8, 14, Math.PI * 1.15), b.croissant); t.rotation.x = Math.PI / 2; t.rotation.z = -0.4; t.position.y = 0.022; g.add(t);
  sph(g, b.croissant, 0.034, 0.0, 0.03, -0.032, 1.3, 0.85, 0.9);
  return g;
}
/** small breads and pastries by kind (y = the surface they sit on) */
function bun(p, x, y, z, kind, R = Math.random) {
  const b = breadMats();
  if (kind === 'anpan') { sph(p, b.anpan, 0.05, x, y + 0.022, z, 1, 0.55, 1); sph(p, b.sesame, 0.008, x, y + 0.05, z); }
  else if (kind === 'melon') sph(p, b.melon, 0.055, x, y + 0.025, z, 1, 0.62, 1);
  else if (kind === 'curry') sph(p, b.curry, 0.05, x, y + 0.024, z, 1.35, 0.55, 0.9);
  else if (kind === 'cream') { // クリームパン: a glove shape with three notches
    const g = grp(p, x, y, z, R() * 0.6); sph(g, b.cream, 0.055, 0, 0.022, 0, 1.25, 0.45, 0.95);
    [-0.03, 0, 0.03].forEach((dx) => bx(g, b.crustD, dx - 0.004, dx + 0.004, 0.02, 0.04, 0.045, 0.055, { cast: false }));
  }
  else if (kind === 'roll') sph(p, b.roll, 0.034, x, y + 0.022, z, 1, 0.72, 1);
  else if (kind === 'boule') { sph(p, b.crust, 0.085, x, y + 0.04, z, 1, 0.62, 1); bx(p, b.crustL, x - 0.05, x + 0.05, y + 0.087, y + 0.09, z - 0.006, z + 0.006, { cast: false }); bx(p, b.crustL, x - 0.006, x + 0.006, y + 0.087, y + 0.09, z - 0.05, z + 0.05, { cast: false }); }
  else if (kind === 'scone') cy(p, b.scone, x, y, z, 0.038, 0.045, 10);
  else if (kind === 'cinnamon') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.036, 16), [b.cinnSide, b.cinnTop, b.cinnSide]); m.position.set(x, y + 0.018, z); m.castShadow = true; p.add(m); }
  else if (kind === 'pie') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.03, 18), b.pie); m.position.set(x, y + 0.015, z); p.add(m); for (let k = -1; k <= 1; k++) { bx(p, b.crustL, x + k * 0.03 - 0.006, x + k * 0.03 + 0.006, y + 0.03, y + 0.034, z - 0.06, z + 0.06, { cast: false }); bx(p, b.crustL, x - 0.06, x + 0.06, y + 0.03, y + 0.034, z + k * 0.03 - 0.006, z + k * 0.03 + 0.006, { cast: false }); } }
  else if (kind === 'painchoco') { // pain au chocolat: a laminated pillow with two dark stripes peeking out
    const g = grp(p, x, y, z, R() * 0.4 - 0.2); bx(g, b.croissant, -0.06, 0.06, 0, 0.042, -0.038, 0.038, { bevel: 0.016 });
    [-0.02, 0.02].forEach((dz) => bx(g, b.choco, -0.064, 0.064, 0.016, 0.026, dz - 0.006, dz + 0.006, { cast: false }));
    [-0.03, 0, 0.03].forEach((dx) => bx(g, b.crustD, dx - 0.003, dx + 0.003, 0.04, 0.044, -0.03, 0.03, { cast: false }));
  }
  else if (kind === 'bagel') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.019, 8, 16), b.bagel); t.rotation.x = Math.PI / 2; t.position.set(x, y + 0.018, z); p.add(t); for (let k = 0; k < 5; k++) sph(p, b.sesame, 0.005, x + Math.cos(k * 1.3) * 0.036, y + 0.035, z + Math.sin(k * 1.3) * 0.036); }
  else if (kind === 'danish') { // a square danish with custard and a fruit on top
    const g = grp(p, x, y, z, Math.PI / 4); bx(g, b.croissant, -0.045, 0.045, 0, 0.024, -0.045, 0.045, { bevel: 0.01 });
    cy(g, b.custard, 0, 0.022, 0, 0.026, 0.008, 12); sph(g, [b.berry, b.orange, b.blue][(R() * 3) | 0], 0.016, 0, 0.034, 0);
  }
  else if (kind === 'donut') {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.018, 8, 16), b.roll); t.rotation.x = Math.PI / 2; t.position.set(x, y + 0.017, z); p.add(t);
    const ic = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.016, 6, 16), R() < 0.5 ? b.pink : b.chocI); ic.rotation.x = Math.PI / 2; ic.scale.set(1, 1, 0.55); ic.position.set(x, y + 0.026, z); p.add(ic);
    for (let k = 0; k < 4; k++) sph(p, [b.icing, b.egg, b.kiwi][k % 3], 0.004, x + Math.cos(k * 1.6) * 0.036, y + 0.036, z + Math.sin(k * 1.6) * 0.036);
  }
  else if (kind === 'tart') {
    cy(p, b.pie, x, y, z, 0.055, 0.026, 16); cy(p, b.custard, x, y + 0.02, z, 0.045, 0.01, 14);
    for (let k = 0; k < 6; k++) sph(p, [b.berry, b.kiwi, b.blue, b.orange][k % 4], 0.012, x + Math.cos(k) * 0.028, y + 0.034, z + Math.sin(k) * 0.028);
    sph(p, b.berry, 0.016, x, y + 0.038, z);
  }
  else if (kind === 'cookie') { for (let k = 0; k < 3; k++) cy(p, b.cookie, x + (k - 1) * 0.025, y + k * 0.01, z + (k % 2) * 0.01, 0.028, 0.009, 10); }
}
function sandwich(p, x, y, z, ry = 0, filling = 'egg') {
  const b = breadMats(), g = grp(p, x, y, z, ry);
  const tri = (y0, h, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 3), mat); m.rotation.x = Math.PI / 2; m.position.set(0, 0.06, y0); g.add(m); };
  tri(-0.018, 0.012, b.white); tri(0, 0.024, filling === 'egg' ? b.egg : b.ham); tri(0.018, 0.012, b.white);
  if (filling !== 'egg') tri(0.003, 0.004, b.lettuce);
  return g;
}
function cake(p, x, y, z, r = 0.09, kind = 0) {
  const b = breadMats();
  cy(p, b.sponge, x, y, z, r, r * 0.55, 20); cy(p, kind ? b.chocI : b.icing, x, y + r * 0.55, z, r * 1.01, r * 0.18, 20);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sph(p, kind ? b.icing : b.berry, r * 0.13, x + Math.cos(a) * r * 0.75, y + r * 0.78, z + Math.sin(a) * r * 0.75); }
}
function cakeSlice(p, x, y, z, ry = 0) {
  const b = breadMats(), g = grp(p, x, y, z, ry);
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 6, 1, false, 0, 0.75), b.sponge); w.position.y = 0.025; g.add(w);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.081, 0.014, 6, 1, false, 0, 0.75), b.icing); c.position.y = 0.057; g.add(c);
  sph(g, b.berry, 0.014, Math.sin(0.37) * 0.05, 0.072, Math.cos(0.37) * 0.05);
  return g;
}
function giftBox(p, x, y, z, w, h, d, col, ribbon) {
  bx(p, toon(col), x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, { bevel: 0.006 });
  const r = toon(ribbon);
  bx(p, r, x - w / 2 - 0.002, x + w / 2 + 0.002, y, y + h + 0.002, z - 0.008, z + 0.008, { cast: false });
  bx(p, r, x - 0.008, x + 0.008, y, y + h + 0.002, z - d / 2 - 0.002, z + d / 2 + 0.002, { cast: false });
  sph(p, r, 0.014, x, y + h + 0.01, z, 1.4, 0.7, 1);
}
/** a wooden tray / rattan basket with breads of one kind on it */
function tray(p, x, y, z, w, d, kind, seed = 1, basket = false) {
  const m = mats(), R = rng(seed);
  if (basket) {
    const h = 0.07;
    bx(p, m.rattan, x - w / 2, x + w / 2, y, y + 0.012, z - d / 2, z + d / 2);
    [-1, 1].forEach((s) => bx(p, m.rattan, x + s * w / 2 - 0.012, x + s * w / 2 + 0.012, y, y + h, z - d / 2, z + d / 2));
    [-1, 1].forEach((s) => bx(p, m.rattan, x - w / 2, x + w / 2, y, y + h, z + s * d / 2 - 0.012, z + s * d / 2 + 0.012));
  } else {
    bx(p, m.frame, x - w / 2, x + w / 2, y, y + 0.014, z - d / 2, z + d / 2, { bevel: 0.004 });
    [-1, 1].forEach((s) => bx(p, m.frameD, x - w / 2, x + w / 2, y, y + 0.03, z + s * d / 2 - 0.008, z + s * d / 2 + 0.008));
  }
  const yb = y + 0.014;
  if (kind === 'shokupan') { shokupan(p, x, yb, z, Math.PI / 2); return; }
  if (kind === 'sliced') { slicedLoaf(p, x, yb, z, Math.PI / 2); return; }
  if (kind === 'baguette') { for (let k = 0; k < 2; k++) baguette(p, x - w / 4 + (k * w) / 2, yb, z, Math.PI / 2, 0, Math.min(0.5, d * 0.85)); return; }
  const nx = Math.max(1, Math.floor(w / 0.12)), nz = Math.max(1, Math.floor(d / 0.12));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const px = x - w / 2 + (i + 0.5) * (w / nx) + (R() - 0.5) * 0.015, pz = z - d / 2 + (j + 0.5) * (d / nz) + (R() - 0.5) * 0.015;
    if (kind === 'croissant') croissant(p, px, yb, pz, R() * 6.28);
    else if (kind === 'sandwich') sandwich(p, px, yb, pz, R() < 0.5 ? 0 : Math.PI, R() < 0.5 ? 'egg' : 'ham');
    else bun(p, px, yb, pz, kind, R);
  }
}
function priceCard(p, x, y, z, name, price, ry = 0) {
  const g = grp(p, x, y, z, ry);
  cyl2(g, mats().iron, [0, 0, 0], [0, 0.08, 0], 0.003, 3, { noLine: true });
  const c = pl(g, new THREE.MeshBasicMaterial({ map: priceTex(name, price), color: new THREE.Color(0.95, 0.94, 0.9) }), 0.09, 0.05, 0, 0.1, 0.002, 0, -0.25); c.userData.noLine = true;
  return g;
}
function cookieJar(p, x, y, z, h = 0.2, r = 0.065) {
  const b = breadMats(), m = mats();
  for (let k = 0; k < Math.floor(h / 0.02) - 1; k++) cy(p, b.cookie, x + (k % 2 ? 0.01 : -0.01), y + 0.01 + k * 0.018, z, r * 0.72, 0.012, 10);
  const j = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16, 1, true), b.jar); j.position.set(x, y + h / 2, z); j.userData.noLine = true; p.add(j);
  cy(p, m.frame, x, y + h, z, r * 0.85, 0.03, 14); sph(p, m.frameD, 0.015, x, y + h + 0.04, z);
}
function bag(p, x, y, z, w = 0.14, h = 0.24, d = 0.08, ry = 0, label = true) {
  const m = mats(), g = grp(p, x, y, z, ry);
  bx(g, m.kraft, -w / 2, w / 2, 0, h, -d / 2, d / 2, { bevel: 0.006 });
  bx(g, toon('#b89464'), -w / 2, w / 2, h - 0.03, h, -d / 2 - 0.003, d / 2 + 0.003, { cast: false });
  if (label) bx(g, m.cream, -w * 0.3, w * 0.3, h * 0.35, h * 0.6, d / 2, d / 2 + 0.003, { cast: false });
  return g;
}
function herbPot(p, bins, x, y, z, kind, seed) {
  const R = rng(seed), m = mats();
  const r = 0.09, h = 0.13;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 12), m.clay); pot.position.set(x, y + h / 2, z); pot.castShadow = true; p.add(pot);
  const tx = leafTex('herb-' + kind, kind === 'rosemary' ? { kind: 'plain', base: '#5f7f5a', edge: '#4c6a48', vein: '#8aa784', center: '#6c8e66' } : kind === 'mint' ? { kind: 'net', base: '#6fae58', edge: '#5a9447', vein: '#a3d38c', center: '#7fbf66', veins: 4 } : { kind: 'plain', base: '#6f8f58', edge: '#5a7a48', vein: '#94b07a', center: '#7c9c62' });
  const n = kind === 'rosemary' ? 22 : 16;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R(), d = V(Math.cos(a), 0, Math.sin(a));
    const el = kind === 'rosemary' ? 1.15 + R() * 0.3 : 0.5 + R() * 0.6;
    const dir = d.clone().multiplyScalar(Math.cos(el)).addScaledVector(V(0, 1, 0), Math.sin(el)).normalize();
    const l = kind === 'rosemary' ? 0.16 + R() * 0.1 : 0.06 + R() * 0.04;
    const geo = bladeGeo({ L: l, W: l * (kind === 'rosemary' ? 0.12 : kind === 'mint' ? 0.7 : 0.35), segL: 4, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + v)), 0.7), droop: kind === 'rosemary' ? 0.05 : 0.2, cup: 0.12 });
    const up = V(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
    bins.add(p, leafMat(tx), placeLeaf(geo, V(x + d.x * 0.03, y + h - 0.01, z + d.z * 0.03), dir, up, 0.85 + R() * 0.3));
  }
}
function wheat(p, x, y, z, n = 7, h = 0.45, seed = 3) {
  const R = rng(seed), stem = toon('#d8b46a'), ear = toon('#e2c078');
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, r = R() * 0.03, top = V(x + Math.cos(a) * (0.03 + r), y + h * (0.85 + R() * 0.2), z + Math.sin(a) * (0.03 + r));
    cyl2(p, stem, [x + Math.cos(a) * r * 0.3, y, z + Math.sin(a) * r * 0.3], [top.x, top.y, top.z], 0.004, 3, { noLine: true });
    sph(p, ear, 0.018, top.x, top.y + 0.03, top.z, 0.7, 2.2, 0.7);
  }
}
/** a simple wooden café chair (seat at 0.45), facing +z in its own frame */
function chair(p, x, z, ry) {
  const m = mats(), g = grp(p, x, YF, z, ry);
  bx(g, m.table, -0.2, 0.2, 0.43, 0.47, -0.19, 0.19, { bevel: 0.01 });
  [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]].forEach(([a, b]) => bx(g, m.frameD, a - 0.02, a + 0.02, 0, 0.43, b - 0.02, b + 0.02));
  [-0.17, 0.17].forEach((a) => bx(g, m.frameD, a - 0.02, a + 0.02, 0.47, 0.88, -0.18, -0.14));
  [0.6, 0.78].forEach((y) => bx(g, m.table, -0.19, 0.19, y, y + 0.07, -0.18, -0.15, { bevel: 0.008 }));
  return g;
}
function roundTable(p, x, z, r = 0.34) {
  const m = mats();
  cy(p, m.table, x, YF + 0.7, z, r, 0.04, 22);
  cy(p, m.frameD, x, YF, z, 0.035, 0.7, 8);
  [0, 2.09, 4.19].forEach((a) => cyl2(p, m.frameD, [x, YF + 0.12, z], [x + Math.cos(a) * 0.26, YF + 0.01, z + Math.sin(a) * 0.26], 0.018, 4, { cast: true }));
  return YF + 0.74;
}
/** the giant croissant: lobes along a curved spine (light / deeper bake alternating), dark seams between the layers */
function giantCroissant(p, cx, y, cz, L = 2.5, rMax = 0.44) {
  const g = grp(p, cx, y, cz, 0);
  const light = toon('#ffffff', { map: croissantTex(false), lit: 0.3, nocache: true });
  const dark = toon('#ffffff', { map: croissantTex(true), lit: 0.28, nocache: true });
  const seam = toon('#8a4a1c', { lit: 0.15 });
  // seven layers: a plump middle roll, three wrapped bands either side getting smaller, the tips curling
  // forward and down; each band is a squashed ellipsoid tilted on the diagonal like rolled dough
  const n = 7;
  const at = (s) => V(s * L * 0.42, -0.34 * Math.pow(Math.abs(s), 2.2) * rMax, 0.62 * s * s); // the crescent
  const rad = (s) => rMax * (0.32 + 0.68 * Math.pow(Math.max(0, 1 - s * s), 0.7));
  const Q = new THREE.Quaternion(), X = V(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * 2 - 1, c = at(s), r = rad(s);
    const tg = at(s + 0.01).sub(at(s - 0.01)).normalize();
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), i % 2 ? dark : light);
    const len = (L / n) * (i === (n - 1) / 2 ? 1.25 : 1.05);
    lobe.scale.set(len * 0.62, r * 0.82, r * 1.02);
    lobe.position.set(c.x, c.y + r * 0.78, c.z);
    lobe.quaternion.copy(Q.setFromUnitVectors(X, tg));
    lobe.rotateY(Math.sign(s || 1) * 0.18); // bands sit on the diagonal, mirrored either side of the middle
    lobe.rotateZ(-s * 0.25);
    lobe.castShadow = true; g.add(lobe);
    if (i < n - 1) { // the seam where one band wraps over the next
      const s2 = s + 1 / (n - 1), c2 = at(s2), r2 = Math.min(rad(s), rad(s + 2 / (n - 1)));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r2 * 0.92, Math.max(0.014, r2 * 0.06), 6, 24), seam);
      ring.scale.set(1, 0.84, 1);
      ring.position.set(c2.x, c2.y + r2 * 0.78, c2.z);
      ring.quaternion.copy(Q.setFromUnitVectors(V(0, 0, 1), at(s2 + 0.01).sub(at(s2 - 0.01)).normalize()));
      ring.rotateY(Math.sign(s2 || 1) * 0.3);
      g.add(ring);
    }
  }
  // the curled tips
  [-1, 1].forEach((sg) => { const c = at(sg * 1.06), r = rMax * 0.24; const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), dark); tip.scale.set(r * 1.8, r * 0.9, r); tip.position.set(c.x, c.y + r * 0.9, c.z); tip.quaternion.copy(Q.setFromUnitVectors(X, at(sg * 1.07).sub(at(sg * 1.05)).normalize())); g.add(tip); });
  return g;
}

/* ---------------------------------------------------------------- the building */
export function buildBakery(parent, drips) {
  const m = mats();
  const g = grp(parent);
  g.name = 'bakery';
  const bins = makeBins(g);

  /* ---- shell: floor, walls (cream plaster, honey wood), flat roof behind a front parapet ---- */
  bx(g, m.stone, X0 - 0.02, X1 + 0.02, Y0 - 0.05, YF - 0.01, Z0 - 0.02, Z1 + 0.02, { bevel: 0.01 });
  wbx(g, m.floor, IN.x0, IN.x1, YF - 0.02, YF, Z0 + 0.12, IN.z1, 1, { cast: false });
  // east (alley) + back walls, solid
  wbx(g, m.plaster, X1 - 0.12, X1, Y0, YW, Z0, Z1, 1.2);
  wbx(g, m.plaster, X0, X1, Y0, YW, Z0, Z0 + 0.12, 1.2);
  // west side: a solid bay at the back (bake house), the glass wall over a low wooden base, a cream band above
  wbx(g, m.plaster, X0, X0 + 0.12, Y0, YW, Z0, SIDE.z0, 1.2);
  wbx(g, m.plaster, X0, X0 + 0.12, Y0, YW, SIDE.z1, Z1, 1.2);
  wbx(g, m.wainscot, X0, X0 + 0.12, Y0, SIDE.y0, SIDE.z0, SIDE.z1, 1);
  wbx(g, m.plaster, X0, X0 + 0.12, SIDE.y1, YW, SIDE.z0, SIDE.z1, 1.2);
  // front: pier left of the window, the pier between window and door, the right pier, below-window base, the band over the openings
  wbx(g, m.plaster, X0, WIN.x0, Y0, YW, Z1 - 0.12, Z1, 1.2);
  wbx(g, m.plaster, WIN.x1, DOOR.x0, Y0, YW, Z1 - 0.12, Z1, 1.2);
  wbx(g, m.plaster, DOOR.x1, X1, Y0, YW, Z1 - 0.12, Z1, 1.2);
  wbx(g, m.wainscot, WIN.x0, WIN.x1, Y0, WIN.y0, Z1 - 0.12, Z1, 1);
  wbx(g, m.plaster, WIN.x0, DOOR.x1, WIN.y1, YW, Z1 - 0.12, Z1, 1.2);
  // stone plinth strip
  bx(g, m.stone, X0 - 0.02, X1 + 0.02, Y0, 0.3, Z0 - 0.02, Z0 + 0.12); bx(g, m.stone, X1 - 0.12, X1 + 0.02, Y0, 0.3, Z0, Z1 + 0.02);
  // upper front: honey slats up to the parapet, a coping all round the roof
  wbx(g, m.slat, X0 - 0.02, X1 + 0.02, CAN.y1, YP, Z1, Z1 + 0.04, 1);
  wbx(g, m.plaster, X0, X1, YW, YP, Z1 - 0.12, Z1, 1.2);
  bx(g, m.creamD, X0 - 0.05, X1 + 0.05, YP, YP + 0.06, Z1 - 0.15, Z1 + 0.08, { bevel: 0.01 });
  [[X0 - 0.03, X0 + 0.12], [X1 - 0.12, X1 + 0.03]].forEach(([a, b]) => bx(g, m.creamD, a, b, YW, YW + 0.12, Z0 - 0.03, Z1 - 0.12));
  bx(g, m.creamD, X0, X1, YW, YW + 0.12, Z0 - 0.03, Z0 + 0.1);
  bx(g, toon(P.roofFlat), X0 + 0.12, X1 - 0.12, YW - 0.04, YW + 0.02, Z0 + 0.12, Z1 - 0.12, { cast: false }); // roof membrane
  bx(g, m.plasterIn, IN.x0, IN.x1, 3.48, 3.52, Z0 + 0.12, IN.z1, { cast: false }); // shop ceiling
  // things on the roof: an AC unit and the oven flue
  bx(g, toon('#e8ebee'), -9.4, -8.6, YW + 0.02, YW + 0.6, -4.5, -3.9, { bevel: 0.03 });
  const fan = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 16), toon('#9aa2ab')); fan.rotation.x = Math.PI / 2; fan.position.set(-9.0, YW + 0.61, -4.2); g.add(fan);
  cyl2(g, toon('#a8b0c0'), [-11.2, YW, -5.8], [-11.2, YW + 1.1, -5.8], 0.1, 8); cy(g, toon('#a8b0c0'), -11.2, YW + 1.1, -5.8, 0.16, 0.06, 10);
  // the east wall: staff door, meter box, a downpipe
  bx(g, m.frameD, X1, X1 + 0.06, Y0, 2.3, -3.9, -3.05); bx(g, toon('#c9a77a'), X1 + 0.06, X1 + 0.08, 0.3, 2.2, -3.83, -3.12, { cast: false });
  cy(g, m.brass, X1 + 0.1, 1.1, -3.25, 0.02, 0.05, 6);
  bx(g, toon('#5a6068'), X1, X1 + 0.5, 2.4, 2.45, -4.0, -2.95);
  bx(g, toon('#aab2c2'), X1, X1 + 0.16, 1.2, 1.75, -1.8, -1.4);
  cyl2(g, toon('#8a9097'), [X1 + 0.08, Y0, Z0 + 0.1], [X1 + 0.08, YW, Z0 + 0.1], 0.035, 6);
  // the roof takes petals / leaves / snow (two near-flat halves meeting on the centre line)
  const halfW = (X1 - X0) / 2;
  (reg.extraRoofs ||= []).push(
    { id: 'bakeryW', a: [XC, Z1 - 0.12], b: [XC, Z0], n: [-1, 0], D: halfW - 0.12, y: YW + 0.04, drop: 0.03, w: { petal: 0.7, leaf: 0.7 }, snow: 0.16, ridge: true },
    { id: 'bakeryE', a: [XC, Z0], b: [XC, Z1 - 0.12], n: [1, 0], D: halfW - 0.12, y: YW + 0.04, drop: 0.03, w: { petal: 0.7, leaf: 0.7 }, snow: 0.16, ridge: true },
  );

  /* ---- the big west glass wall (slim honey mullions), the bake-house window, a small BREAD plate and lamps ---- */
  {
    const xg = X0 + 0.05;
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(SIDE.z1 - SIDE.z0, SIDE.y1 - SIDE.y0), makeGlass(6, 2.5, 74, { alpha: 0.07, drops: 0.4, tint: 0xfff2dc }));
    gw.position.set(xg, (SIDE.y0 + SIDE.y1) / 2, (SIDE.z0 + SIDE.z1) / 2); gw.rotation.y = -Math.PI / 2; gw.userData.noLine = true; gw.renderOrder = 2; g.add(gw); reg.noRefl.push(gw);
    const nM = 6;
    for (let k = 0; k <= nM; k++) { const z = SIDE.z0 + ((SIDE.z1 - SIDE.z0) * k) / nM; bx(g, m.frame, X0 - 0.02, X0 + 0.1, SIDE.y0, SIDE.y1, z - (k % nM ? 0.03 : 0.05), z + (k % nM ? 0.03 : 0.05)); }
    bx(g, m.frame, X0 - 0.03, X0 + 0.1, SIDE.y0 - 0.04, SIDE.y0 + 0.02, SIDE.z0, SIDE.z1); // sill
    bx(g, m.frame, X0 - 0.03, X0 + 0.1, SIDE.y1 - 0.02, SIDE.y1 + 0.04, SIDE.z0, SIDE.z1); // head
    bx(g, m.frame, X0 - 0.02, X0 + 0.08, 2.32, 2.36, SIDE.z0, SIDE.z1); // transom line
    const lt = pl(g, new THREE.MeshBasicMaterial({ map: windowLetterTex(), transparent: true, depthWrite: false }), 1.6, 0.8, xg - 0.006, 1.85, -1.3, -Math.PI / 2, 0); lt.userData.noLine = true;
    const sp = pl(g, new THREE.MeshBasicMaterial({ map: breadSignTex(true), transparent: true }), 2.4, 0.32, X0 - 0.004, 3.42, -2.1, -Math.PI / 2, 0); sp.userData.noLine = true;
    [-4.0, -0.2].forEach((z) => {
      bx(g, m.iron, X0 - 0.16, X0, 3.15, 3.19, z - 0.04, z + 0.04);
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 12, 1, true), toon('#3a3c40', { side: THREE.DoubleSide })); sh.position.set(X0 - 0.18, 3.12, z); g.add(sh);
      sph(g, glow('#ffd9a0', 2.2), 0.035, X0 - 0.18, 3.07, z); halo(g, X0 - 0.2, 3.02, z, '#ffd39a', 0.9, 0.35);
    });
    // a small bake-house window at the back
    bx(g, m.frame, X0 - 0.05, X0, 1.5, 2.3, -6.1, -5.5);
    pl(g, glow('#ffdcae', 0.9, { cat: 'iza', off: '#6c7680' }), 0.5, 0.7, X0 - 0.052, 1.9, -5.8, -Math.PI / 2, 0);
  }

  /* ---- shop front: the big window, double wooden glass doors, the canopy with BREAD, the giant croissant ---- */
  {
    const zf = Z1 - 0.06;
    // window: frames, mullion, transom, sill, glass, lettering
    bx(g, m.frame, WIN.x0, WIN.x1, WIN.y0 - 0.02, WIN.y0 + 0.05, Z1 - 0.12, Z1 + 0.1, { bevel: 0.01 });
    [WIN.x0, WIN.x1].forEach((x, k) => bx(g, m.frame, x + (k ? -0.07 : 0), x + (k ? 0 : 0.07), WIN.y0, WIN.y1, Z1 - 0.1, Z1 + 0.02));
    bx(g, m.frame, WIN.x0, WIN.x1, WIN.y1 - 0.07, WIN.y1, Z1 - 0.1, Z1 + 0.02);
    bx(g, m.frame, WIN.x0, WIN.x1, 2.32, 2.36, Z1 - 0.09, Z1 - 0.03);
    { const x = (WIN.x0 + WIN.x1) / 2; bx(g, m.frame, x - 0.025, x + 0.025, WIN.y0, WIN.y1, Z1 - 0.09, Z1 - 0.03); }
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0 - 0.1, WIN.y1 - WIN.y0 - 0.1), makeGlass(2.3, 2.4, 71, { alpha: 0.07, drops: 0.4, tint: 0xfff2dc }));
    gw.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, zf); gw.userData.noLine = true; gw.renderOrder = 2; g.add(gw); reg.noRefl.push(gw);
    const lt = pl(g, new THREE.MeshBasicMaterial({ map: windowLetterTex(), transparent: true, depthWrite: false }), 1.3, 0.65, (WIN.x0 + WIN.x1) / 2, 1.95, zf + 0.004, 0, 0); lt.userData.noLine = true;
    // door frame, transom glass, a low stone threshold
    [[DOOR.x0 - 0.02, DOOR.x0 + 0.05], [DOOR.x1 - 0.05, DOOR.x1 + 0.02]].forEach(([a, b]) => bx(g, m.frame, a, b, YF, WIN.y1, Z1 - 0.12, Z1 + 0.02));
    bx(g, m.frame, DOOR.x0, DOOR.x1, DOOR.y1, DOOR.y1 + 0.06, Z1 - 0.12, Z1 + 0.02);
    const tg = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 - 0.1, WIN.y1 - DOOR.y1 - 0.12), makeGlass(1.2, 0.3, 72, { alpha: 0.07, drops: 0.3, tint: 0xfff2dc }));
    tg.position.set((DOOR.x0 + DOOR.x1) / 2, (DOOR.y1 + 0.06 + WIN.y1 - 0.07) / 2, zf); tg.userData.noLine = true; g.add(tg); reg.noRefl.push(tg);
    bx(g, m.stone, DOOR.x0 - 0.06, DOOR.x1 + 0.06, YF - 0.01, YF + 0.012, Z1 - 0.12, Z1 + 0.06);
    // the canopy: a thick cream slab across the front, BREAD on its fascia, three downlights in the soffit
    wbx(g, m.plaster, X0 - 0.12, X1 + 0.06, CAN.y0, CAN.y1, Z1, Z1 + CAN.d, 1.2);
    bx(g, m.creamD, X0 - 0.13, X1 + 0.07, CAN.y1 - 0.02, CAN.y1 + 0.02, Z1, Z1 + CAN.d + 0.01, { cast: false });
    const sg = pl(g, new THREE.MeshBasicMaterial({ map: breadSignTex(), transparent: true }), 3.9, 0.3, XC + 0.1, (CAN.y0 + CAN.y1) / 2, Z1 + CAN.d + 0.004, 0, 0); sg.userData.noLine = true;
    [-11.4, -10.2, -8.95].forEach((x) => { cy(g, glow('#ffe6c0', 2.2), x, CAN.y0 - 0.012, Z1 + 0.5, 0.06, 0.012, 14); halo(g, x, CAN.y0 - 0.08, Z1 + 0.5, '#ffd9a8', 0.8, 0.3); });
    // the giant croissant on a low plinth on the canopy, two small uplights on the canopy edge for the evening
    const cyTop = CAN.y1 + 0.02;
    bx(g, m.creamD, XC - 1.05, XC + 1.05, cyTop, cyTop + 0.07, Z1 + 0.18, Z1 + 0.82, { bevel: 0.02 });
    giantCroissant(g, XC, cyTop + 0.07, Z1 + 0.4, 2.55, 0.44);
    [XC - 0.8, XC + 0.8].forEach((x) => { bx(g, m.iron, x - 0.06, x + 0.06, cyTop, cyTop + 0.08, Z1 + CAN.d - 0.14, Z1 + CAN.d - 0.04); bx(g, glow('#ffe2b0', 2.0), x - 0.045, x + 0.045, cyTop + 0.08, cyTop + 0.085, Z1 + CAN.d - 0.13, Z1 + CAN.d - 0.05, { cast: false }); });
    plight(g, '#ffd59a', 4, 4.5, XC, cyTop + 1.3, Z1 + 1.5, 'bakeryCroissant');
    // the right pier: hours and payment stickers
    const hr = pl(g, new THREE.MeshBasicMaterial({ map: hoursTex() }), 0.24, 0.24, (DOOR.x1 + X1) / 2, 1.55, Z1 + 0.004, 0, 0); hr.userData.noLine = true;
    const py = pl(g, new THREE.MeshBasicMaterial({ map: payTex() }), 0.3, 0.09, (DOOR.x1 + X1) / 2, 1.28, Z1 + 0.004, 0, 0); py.userData.noLine = true;
  }

  /* ---- the doors ---- */
  const leaves = [];
  {
    const zf = Z1 - 0.06, lw = (DOOR.x1 - DOOR.x0) / 2 - 0.035, h = DOOR.y1 - YF - 0.02;
    const gl = makeGlass(0.5, 1.6, 73, { alpha: 0.07, drops: 0.3, tint: 0xfff2dc });
    [[DOOR.x0 + 0.05, 1], [DOOR.x1 - 0.05, -1]].forEach(([hx, s]) => {
      const pv = grp(g, hx, YF + 0.01, zf, 0);
      pv.userData.keep = true; // animated: kept out of mergeStatic
      const F = (a0, a1, y0, y1, mat = m.frame) => bx(pv, mat, Math.min(a0 * s, a1 * s), Math.max(a0 * s, a1 * s), y0, y1, -0.025, 0.025, { bevel: 0.006 });
      F(0, 0.06, 0, h); F(lw - 0.06, lw, 0, h); F(0.06, lw - 0.06, 0, 0.3); F(0.06, lw - 0.06, h - 0.08, h);
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.12, h - 0.38), gl); gp.position.set((lw / 2) * s, (0.3 + h - 0.08) / 2, 0); gp.userData.noLine = true; pv.add(gp); reg.noRefl.push(gp);
      [-0.045, 0.045].forEach((oz) => { cyl2(pv, m.brass, [(lw - 0.11) * s, 0.85, oz], [(lw - 0.11) * s, 1.25, oz], 0.011, 6); [0.88, 1.22].forEach((yy) => cyl2(pv, m.brass, [(lw - 0.11) * s, yy, 0], [(lw - 0.11) * s, yy, oz], 0.007, 4)); });
      leaves.push({ pv, s });
    });
    const L0 = leaves[0].pv;
    cyl2(L0, m.iron, [0.18, 1.62, 0.03], [0.27, 1.75, 0.03], 0.002, 3, { noLine: true }); cyl2(L0, m.iron, [0.36, 1.62, 0.03], [0.27, 1.75, 0.03], 0.002, 3, { noLine: true });
    const op = pl(L0, new THREE.MeshBasicMaterial({ map: openTex(true) }), 0.24, 0.12, 0.27, 1.56, 0.032, 0, 0); op.userData.noLine = true;
    const cl = pl(L0, new THREE.MeshBasicMaterial({ map: openTex(false) }), 0.24, 0.12, 0.27, 1.56, -0.032, Math.PI, 0); cl.userData.noLine = true;
    const bxx = (DOOR.x0 + DOOR.x1) / 2;
    cyl2(g, m.brass, [bxx, DOOR.y1 - 0.02, Z1 - 0.13], [bxx, DOOR.y1 - 0.02, Z1 - 0.24], 0.006, 4);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 10, 1, true), toon('#c9a24a', { side: THREE.DoubleSide })); bell.position.set(bxx, DOOR.y1 - 0.08, Z1 - 0.24); g.add(bell);
  }

  /* ---- inside: walls, beams, partition with the bake-house doorway ---- */
  const DX0 = -9.7, DX1 = -9.0; // doorway in the partition
  {
    wbx(g, m.wainscot, IN.x1 - 0.015, IN.x1, YF, 1.0, PART, IN.z1, 1, { cast: false });
    bx(g, m.plasterIn, IN.x1 - 0.01, IN.x1, 1.0, 3.48, PART, IN.z1, { cast: false });
    bx(g, m.frame, IN.x1 - 0.03, IN.x1, 0.98, 1.03, PART, IN.z1, { cast: false });
    bx(g, m.plasterIn, IN.x0, IN.x0 + 0.01, SIDE.y1, 3.48, SIDE.z0, IN.z1, { cast: false });
    for (let z = 0.2; z > PART; z -= 1.3) bx(g, m.frame, IN.x0, IN.x1, 3.32, 3.48, z - 0.06, z + 0.06);
    bx(g, m.plasterIn, IN.x0, DX0, YF, 3.48, PART - 0.1, PART, { cast: false });
    bx(g, m.plasterIn, DX1, IN.x1, YF, 3.48, PART - 0.1, PART, { cast: false });
    bx(g, m.plasterIn, DX0, DX1, 2.3, 3.48, PART - 0.1, PART, { cast: false });
    [[DX0 - 0.05, DX0], [DX1, DX1 + 0.05]].forEach(([a, b]) => bx(g, m.frame, a, b, YF, 2.35, PART - 0.12, PART + 0.03));
    bx(g, m.frame, DX0 - 0.05, DX1 + 0.05, 2.3, 2.35, PART - 0.12, PART + 0.03);
    pl(g, toon('#efe3c8', { side: THREE.DoubleSide }), DX1 - DX0 - 0.02, 0.5, (DX0 + DX1) / 2, 2.02, PART - 0.05, 0, 0);
    bx(g, m.white, IN.x0, IN.x1, YF, YF + 0.004, Z0 + 0.12, PART - 0.1, { cast: false }); // bake-house floor
    // bake house: a deck oven glowing behind the doorway, a rack of cooling trays
    const ox0 = -10.2, ox1 = -8.5, oz0 = Z0 + 0.14, oz1 = Z0 + 0.9;
    bx(g, m.steel, ox0, ox1, YF, YF + 1.8, oz0, oz1, { bevel: 0.02 });
    for (let k = 0; k < 3; k++) { const y = YF + 0.45 + k * 0.45; bx(g, toon('#8d949b'), ox0 + 0.08, ox1 - 0.08, y, y + 0.36, oz1, oz1 + 0.02); pl(g, glow('#ff9a3c', 1.6), 0.8, 0.11, (ox0 + ox1) / 2, y + 0.2, oz1 + 0.022, 0, 0); }
    halo(g, (ox0 + ox1) / 2, YF + 1.1, oz1 + 0.25, '#ffa050', 2.0, 0.25);
    [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0.25], [0.2, 0.25]].forEach(([a, b]) => bx(g, m.steel, -11.3 + a - 0.015, -11.3 + a + 0.015, YF, YF + 1.6, -5.6 + b - 0.015, -5.6 + b + 0.015));
    for (let k = 0; k < 6; k++) { const y = YF + 0.2 + k * 0.24; bx(g, m.steel, -11.5, -11.1, y, y + 0.012, -5.85, -5.35); if (k % 2 === 0) for (let i = 0; i < 4; i++) bun(g, -11.4 + (i % 2) * 0.2, y + 0.012, -5.75 + (i >> 1) * 0.25, k ? 'roll' : 'melon'); }
    plight(g, '#ffcf9a', 3, 4, -9.5, 2.5, -5.8, 'bakeryKitchen');
  }

  /* ---- inside: stepped display along the west glass (reads from the street and from inside) ---- */
  {
    const xs = [[IN.x0, IN.x0 + 0.24, 0.55], [IN.x0 + 0.24, IN.x0 + 0.48, 0.82], [IN.x0 + 0.48, IN.x0 + 0.7, 1.08]];
    const za = SIDE.z1 - 0.05, zb = SIDE.z0 + 0.25;
    xs.forEach(([a, b, h]) => { bx(g, m.table, a, b, YF + h - 0.035, YF + h, zb, za, { bevel: 0.006 }); });
    for (let z = za; z >= zb - 0.01; z -= (za - zb) / 4) bx(g, m.frameD, IN.x0, IN.x0 + 0.7, YF, YF + 1.04, z - 0.025, z + 0.025);
    bx(g, m.wainscot, IN.x0 + 0.66, IN.x0 + 0.7, YF, YF + 1.04, zb, za); // inner back of the stepping
    const sections = [
      ['croissant', 'painchoco', 'danish', ['クロワッサン', '¥220']], ['baguette', 'bagel', 'cinnamon', ['バゲット', '¥320']],
      ['melon', 'anpan', 'cream', ['メロンパン', '¥180']], ['shokupan', 'sliced', 'roll', ['食パン', '¥380']],
      ['curry', 'donut', 'scone', ['カレーパン', '¥200']],
    ];
    const nS = sections.length, span = (za - zb) / nS;
    sections.forEach((sec, i) => {
      const z = za - span * (i + 0.5);
      xs.forEach(([a, b, h], k) => tray(g, (a + b) / 2, YF + h, z, b - a - 0.04, span - 0.12, sec[k], 100 + i * 3 + k, (i + k) % 2 === 1));
      priceCard(g, IN.x0 + 0.72, YF + 1.08, z, sec[3][0], sec[3][1], Math.PI / 2);
    });
  }

  /* ---- inside: the front window stage ---- */
  {
    const y = YF + 0.36, z0 = IN.z1 - 0.48, z1 = IN.z1 - 0.02;
    bx(g, m.table, WIN.x0 + 0.06, WIN.x1 - 0.06, YF, y, z0, z1, { bevel: 0.012 });
    { const x = WIN.x0 + 0.28, z = (z0 + z1) / 2; cy(g, m.rattan, x, y, z, 0.1, 0.24, 14); for (let k = 0; k < 5; k++) { const bg = baguette(g, x + (k - 2) * 0.03, y + 0.05, z + (k % 2 ? 0.03 : -0.03), 0, Math.PI / 2 - 0.12 + k * 0.06, 0.55); bg.rotation.y = k * 0.6; } }
    { const x = WIN.x0 + 0.72, z = (z0 + z1) / 2; cy(g, m.white, x, y, z, 0.03, 0.14, 10); cy(g, m.white, x, y + 0.14, z, 0.16, 0.015, 18); cake(g, x, y + 0.155, z, 0.11); }
    bx(g, m.frame, WIN.x0 + 1.0, WIN.x0 + 1.4, y, y + 0.02, z0 + 0.1, z1 - 0.08); bun(g, WIN.x0 + 1.2, y + 0.02, (z0 + z1) / 2, 'boule');
    slicedLoaf(g, WIN.x0 + 1.62, y, (z0 + z1) / 2, 0.2);
    { const x = WIN.x0 + 1.95, z = z0 + 0.14; cy(g, breadMats().jar, x, y, z, 0.05, 0.16, 12); wheat(g, x, y + 0.02, z, 9, 0.42, 7); }
    giftBox(g, WIN.x0 + 2.0, y, z1 - 0.12, 0.16, 0.1, 0.12, '#f4ead6', '#c0573a');
  }

  /* ---- inside: the centre table of baskets ---- */
  {
    const x0 = -10.75, x1 = -9.75, z0 = -3.6, z1 = -0.65, h = 0.82, ty = YF + h;
    bx(g, m.table, x0, x1, ty - 0.07, ty, z0, z1, { bevel: 0.02 });
    [[x0 + 0.07, z0 + 0.07], [x1 - 0.07, z0 + 0.07], [x0 + 0.07, z1 - 0.07], [x1 - 0.07, z1 - 0.07]].forEach(([a, b]) => bx(g, m.tableD, a - 0.045, a + 0.045, YF, ty - 0.07, b - 0.045, b + 0.045, { bevel: 0.01 }));
    bx(g, m.table, x0 + 0.07, x1 - 0.07, YF + 0.18, YF + 0.22, z0 + 0.07, z1 - 0.07, { bevel: 0.01 });
    bx(g, m.tableD, -10.42, -10.08, ty, ty + 0.15, z0 + 0.35, z1 - 0.35, { bevel: 0.01 }); // riser
    bx(g, m.frame, -10.46, -10.04, ty + 0.15, ty + 0.17, z0 + 0.3, z1 - 0.3, { bevel: 0.006 });
    const items = [[-10.58, -1.0, 'sandwich', ['サンドイッチ', '¥320']], [-10.58, -1.75, 'curry', ['カレーパン', '¥200']], [-10.58, -2.5, 'anpan', ['あんパン', '¥160']], [-10.58, -3.25, 'pie', ['アップルパイ', '¥280']],
      [-9.92, -1.0, 'cinnamon', ['シナモンロール', '¥240']], [-9.92, -1.75, 'painchoco', ['パン・オ・ショコラ', '¥240']], [-9.92, -2.5, 'cream', ['クリームパン', '¥170']], [-9.92, -3.25, 'bagel', ['ベーグル', '¥200']]];
    items.forEach(([x, z, k, c], i) => { tray(g, x, ty, z, 0.28, 0.6, k, 60 + i, i % 3 === 1); priceCard(g, x + (x < -10.2 ? -0.17 : 0.17), ty, z, c[0], c[1], x < -10.2 ? -Math.PI / 2 : Math.PI / 2); });
    for (let k = 0; k < 3; k++) { croissant(g, -10.25, ty + 0.17, -1.0 - k * 0.12, 1.2); bx(g, breadMats().lettuce, -10.3, -10.2, ty + 0.195, ty + 0.2, -1.02 - k * 0.12, -0.98 - k * 0.12, { cast: false }); }
    cookieJar(g, -10.3, ty + 0.17, -1.9); cookieJar(g, -10.18, ty + 0.17, -2.2, 0.16, 0.055);
    tray(g, -10.25, ty + 0.17, -2.85, 0.32, 0.4, 'roll', 77, true);
    for (let k = 0; k < 4; k++) bx(g, m.frame, -10.6, -10.1, YF + 0.22 + k * 0.025, YF + 0.24 + k * 0.025, -2.6, -2.1);
    cy(g, m.rattan, -9.95, YF + 0.22, -1.3, 0.13, 0.11, 14);
  }

  /* ---- inside: tray + tong station by the door, the east wall shelf ---- */
  {
    const x0 = -10.45, x1 = -9.95, z0 = -0.35, z1 = 0.15, ty = YF + 0.82;
    bx(g, m.table, x0, x1, ty - 0.04, ty, z0, z1, { bevel: 0.01 });
    [[x0 + 0.04, z0 + 0.04], [x1 - 0.04, z0 + 0.04], [x0 + 0.04, z1 - 0.04], [x1 - 0.04, z1 - 0.04]].forEach(([a, b]) => bx(g, m.tableD, a - 0.02, a + 0.02, YF, ty - 0.04, b - 0.02, b + 0.02));
    for (let k = 0; k < 8; k++) bx(g, m.frame, x0 + 0.04, x1 - 0.12, ty + k * 0.018, ty + k * 0.018 + 0.012, z0 + 0.04, z1 - 0.04);
    const tx = x1 - 0.06, tz = (z0 + z1) / 2;
    cy(g, m.steel, tx, ty, tz, 0.045, 0.12, 10);
    for (let k = 0; k < 4; k++) cyl2(g, m.steel, [tx + (k % 2 ? 0.012 : -0.012), ty + 0.05, tz + (k > 1 ? 0.012 : -0.012)], [tx + (k % 2 ? 0.028 : -0.028), ty + 0.26, tz + (k > 1 ? 0.028 : -0.028)], 0.005, 3);
    // the east wall: a tall shelf of packaged cookies, rusks, sliced loaves and gift boxes
    const sx0 = IN.x1 - 0.34, za = -0.1, zb = -1.95;
    [za, zb].forEach((z) => bx(g, m.frameD, sx0, IN.x1, YF, 2.1, z - 0.03, z + 0.03));
    const lv = [0.5, 0.95, 1.4, 1.85];
    lv.forEach((y) => bx(g, m.table, sx0, IN.x1, y - 0.03, y, zb, za, { bevel: 0.006 }));
    const R = rng(51);
    for (let z = za - 0.15; z > zb + 0.1; z -= 0.17) bag(g, sx0 + 0.16, lv[0], z, 0.12, 0.17, 0.06, -Math.PI / 2, true);
    for (let z = za - 0.25; z > zb + 0.2; z -= 0.3) slicedLoaf(g, sx0 + 0.17, lv[1], z, Math.PI / 2);
    for (let z = za - 0.25; z > zb + 0.2; z -= 0.42) cookieJar(g, sx0 + 0.16, lv[2], z, 0.2 + R() * 0.06);
    [['#f4ead6', '#c0573a'], ['#e9d2b2', '#2f5240'], ['#f6e4e4', '#c0396a'], ['#efe6d6', '#a57a4e']].forEach(([c, r], i) => giftBox(g, sx0 + 0.17, lv[3], za - 0.3 - i * 0.42, 0.2, 0.12 + (i % 2) * 0.04, 0.18, c, r));
    priceCard(g, sx0 - 0.01, lv[0], -0.6, 'ラスク', '¥250', -Math.PI / 2); priceCard(g, sx0 - 0.01, lv[1], -1.1, 'パンドミ', '¥420', -Math.PI / 2); priceCard(g, sx0 - 0.01, lv[2], -0.5, 'クッキー', '¥300', -Math.PI / 2);
  }

  /* ---- inside: the glass showcase and the till, shelves behind ---- */
  {
    const x0 = -9.55, x1 = IN.x1 - 0.36, z0 = -2.95, z1 = -2.25, yb = YF + 0.62, yt = YF + 1.12;
    wbx(g, m.wainscot, x0, x1, YF, yb, z0, z1, 1);
    bx(g, m.table, x0 - 0.02, x1 + 0.02, yb, yb + 0.03, z0 - 0.02, z1 + 0.02, { bevel: 0.006 });
    const gc = bx(g, m.glassCase, x0, x1, yb + 0.03, yt, z0, z1); gc.userData.noLine = true; gc.castShadow = false;
    bx(g, m.frame, x0 - 0.02, x1 + 0.02, yt, yt + 0.025, z0 - 0.02, z1 + 0.02, { bevel: 0.006 });
    bx(g, m.white, x0 + 0.02, x1 - 0.02, yb + 0.25, yb + 0.26, z0 + 0.02, z1 - 0.02, { cast: false });
    const n = 5, dx = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + dx * (i + 0.5);
      if (i === 1) cake(g, x, yb + 0.03, (z0 + z1) / 2, 0.09, 0); else if (i === 3) cake(g, x, yb + 0.03, (z0 + z1) / 2, 0.08, 1);
      else for (let k = 0; k < 2; k++) cakeSlice(g, x + (k - 0.5) * 0.11, yb + 0.03, (z0 + z1) / 2, k * 0.5 + i);
      for (let k = 0; k < 2; k++) bun(g, x + (k - 0.5) * 0.12, yb + 0.26, (z0 + z1) / 2, ['tart', 'donut', 'danish', 'tart', 'donut'][i]);
    }
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.06, z1 - z0 - 0.06), glow('#fff3dc', 1.2)); lit.rotation.x = Math.PI / 2; lit.position.set((x0 + x1) / 2, yt - 0.006, (z0 + z1) / 2); g.add(lit);
    // the till behind it
    const cx0 = -9.55, cx1 = IN.x1, cz0 = -3.65, cz1 = -3.1, ty = YF + 0.95;
    wbx(g, m.wainscot, cx0, cx1, YF, ty - 0.04, cz0, cz1, 1);
    bx(g, m.table, cx0 - 0.03, cx1, ty - 0.04, ty, cz0 - 0.02, cz1 + 0.04, { bevel: 0.01 });
    bx(g, toon('#e8e4da'), -8.75, -8.4, ty, ty + 0.06, cz0 + 0.15, cz0 + 0.45, { bevel: 0.01 });
    bx(g, toon('#3a3f46'), -8.72, -8.43, ty + 0.06, ty + 0.25, cz1 - 0.05, cz1 - 0.02);
    pl(g, glow('#cfe8ff', 0.8, { off: '#55606a' }), 0.26, 0.16, -8.575, ty + 0.155, cz1 - 0.018, 0, 0);
    bx(g, toon('#2e3036'), -9.0, -8.87, ty, ty + 0.025, cz1 - 0.2, cz1 - 0.06, { bevel: 0.005 });
    for (let k = 0; k < 4; k++) bag(g, -9.4 + k * 0.035, ty, cz0 + 0.2, 0.12, 0.22, 0.02, 0, false);
    bx(g, m.kraft, -8.3, -8.06, ty, ty + 0.1, cz0 + 0.05, cz0 + 0.3, { bevel: 0.006 }); bx(g, m.white, -8.28, -8.08, ty + 0.1, ty + 0.18, cz0 + 0.07, cz0 + 0.28, { bevel: 0.006 });
    const rb = grp(g, -9.25, ty, cz1 - 0.06, Math.PI);
    cyl2(rb, m.frameD, [-0.08, 0, 0], [0, 0.26, -0.04], 0.008, 3); cyl2(rb, m.frameD, [0.08, 0, 0], [0, 0.26, -0.04], 0.008, 3);
    const rp = pl(rb, new THREE.MeshBasicMaterial({ map: chalkTex([['塩パン', '¥120', '#f2c14e'], ['クロワッサン', '¥220', '#e8a64a']], 'pick', '今日のおすすめ', 'Pick') }), 0.15, 0.21, 0, 0.14, -0.035, Math.PI, -0.15); rp.userData.noLine = true;
    cy(g, m.white, -9.4, ty, cz1 - 0.1, 0.05, 0.006, 12); cy(g, m.white, -9.4, ty + 0.006, cz1 - 0.1, 0.034, 0.06, 10); // a cup on a saucer
    // behind the till: bread racks with baguettes and loaves, the coffee machine, the drink menu
    const bz0 = PART + 0.02, bz1 = PART + 0.45;
    bx(g, m.wainscot, DX1 + 0.05, IN.x1, YF, YF + 0.86, bz0, bz1);
    bx(g, m.table, DX1 + 0.05, IN.x1, YF + 0.86, YF + 0.9, bz0, bz1 + 0.02, { bevel: 0.008 });
    const cm = grp(g, -8.35, YF + 0.9, bz0 + 0.22, 0);
    bx(cm, toon('#3a3f46'), -0.15, 0.15, 0, 0.4, -0.15, 0.15, { bevel: 0.02 }); bx(cm, m.steel, -0.13, 0.13, 0.28, 0.32, 0.15, 0.17, { cast: false });
    for (let k = 0; k < 4; k++) cy(g, m.white, -8.95 + k * 0.1, YF + 0.9, bz0 + 0.3, 0.04, 0.07, 10);
    [1.35, 1.75, 2.15].forEach((y) => bx(g, m.table, DX1 + 0.05, IN.x1, y - 0.03, y, bz0, bz0 + 0.3, { bevel: 0.006 }));
    for (let k = 0; k < 3; k++) { cy(g, m.rattan, -8.75 + k * 0.26, 1.35, bz0 + 0.15, 0.1, 0.18, 12); for (let j = 0; j < 3; j++) baguette(g, -8.75 + k * 0.26 + (j - 1) * 0.025, 1.4, bz0 + 0.15, 0, Math.PI / 2 - 0.1 + j * 0.1, 0.42); }
    for (let k = 0; k < 3; k++) shokupan(g, -8.78 + k * 0.28, 1.75, bz0 + 0.15, 0, 0.9);
    const mn = pl(g, new THREE.MeshBasicMaterial({ map: menuTex() }), 0.8, 0.55, -8.5, 2.75, PART + 0.012, 0, 0); mn.userData.noLine = true;
  }

  /* ---- inside: back wall shelves (left of the doorway): loaves, sliced bread, bagels, gift bags ---- */
  {
    const x0 = IN.x0 + 0.72, x1 = DX0 - 0.08, z0 = PART + 0.02, z1 = PART + 0.4;
    [x0, (x0 + x1) / 2, x1].forEach((x) => bx(g, m.frameD, x - 0.03, x + 0.03, YF, 2.3, z0, z1));
    const lv = [0.55, 1.0, 1.45, 1.9, 2.3];
    lv.forEach((y) => bx(g, m.table, x0, x1, y - 0.03, y, z0, z1, { bevel: 0.006 }));
    const w = x1 - x0;
    for (let i = 0; i < 4; i++) shokupan(g, x0 + w * (i + 0.5) / 4, lv[0], (z0 + z1) / 2, 0, 0.95);
    for (let i = 0; i < 3; i++) slicedLoaf(g, x0 + w * (i + 0.5) / 3, lv[1], (z0 + z1) / 2, 0);
    tray(g, x0 + w * 0.25, lv[2], (z0 + z1) / 2, w * 0.45, 0.3, 'bagel', 90, true); tray(g, x0 + w * 0.75, lv[2], (z0 + z1) / 2, w * 0.45, 0.3, 'cookie', 91);
    for (let i = 0; i < 6; i++) bag(g, x0 + w * (i + 0.5) / 6, lv[3], (z0 + z1) / 2, 0.11, 0.2, 0.07, 0, true);
    for (let i = 0; i < 3; i++) cy(g, m.rattan, x0 + w * (i + 0.5) / 3, lv[4], (z0 + z1) / 2, 0.13, 0.14, 14);
    priceCard(g, x0 + w * 0.3, lv[1], z1 + 0.01, 'パンドミ', '¥420'); priceCard(g, x0 + w * 0.3, lv[2], z1 + 0.01, 'ベーグル', '¥200');
    const pr = pl(g, new THREE.MeshBasicMaterial({ map: printTex() }), 0.42, 0.58, (x0 + x1) / 2, 2.95, PART + 0.012, 0, 0); pr.userData.noLine = true;
  }

  /* ---- inside: pendant lamps + the warm fill ---- */
  {
    const pend = (x, z, glass) => {
      const y = 3.48 - 0.75;
      cyl2(g, m.iron, [x, 3.32, z], [x, y + 0.12, z], 0.004, 3, { noLine: true });
      if (glass) { const gm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), toon('#fff3dc', { op: 0.45 })); gm.position.set(x, y, z); g.add(gm); }
      else { const sh = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 16, 1, true), toon('#f3ead6', { side: THREE.DoubleSide })); sh.position.set(x, y + 0.06, z); g.add(sh); }
      sph(g, glow('#ffd9a0', 2.6), 0.04, x, y, z);
      halo(g, x, y - 0.02, z, '#ffd39a', 1.1, 0.35);
    };
    pend(-10.25, -1.4, false); pend(-10.25, -2.8, false); pend(-8.85, -2.6, true); pend(-11.3, -0.4, true); pend(-11.3, -3.2, true);
    plight(g, '#ffcf98', 11, 9, -10.0, 3.0, -1.6, 'bakery');
  }

  /* ---- the terrace: a low plank deck in front (z 0.9 .. 4.45), the walk beyond it kept clear ---- */
  {
    wbx(g, m.deck, DECK.x0, DECK.x1, Y0 - 0.02, YF - 0.005, Z1, DECK.z1, 1, { cast: false });
    bx(g, m.frameD, DECK.x0 - 0.01, DECK.x1, Y0 - 0.02, YF - 0.01, DECK.z1 - 0.06, DECK.z1 + 0.01); // nosing
    bx(g, m.stone, DECK.x0 + 1.2, DECK.x1 - 0.5, Y0 - 0.01, Y0 + 0.06, DECK.z1, DECK.z1 + 0.32, { bevel: 0.01 }); // a shallow step
    // planters with shrubs at the two front corners, a low box along the west edge
    const planter = (x0, x1, z0, z1) => { bx(g, m.frame, x0, x1, YF - 0.01, YF + 0.42, z0, z1, { bevel: 0.015 }); bx(g, toon('#4a3a2c', { lit: 0.02 }), x0 + 0.04, x1 - 0.04, YF + 0.36, YF + 0.41, z0 + 0.04, z1 - 0.04, { cast: false }); };
    planter(DECK.x0 + 0.02, DECK.x0 + 0.7, DECK.z1 - 0.65, DECK.z1 - 0.05);
    planter(DECK.x1 - 0.6, DECK.x1 - 0.02, DECK.z1 - 0.62, DECK.z1 - 0.05);
    planter(DECK.x0 + 0.02, DECK.x0 + 0.38, Z1 + 0.15, DECK.z1 - 0.9);
    // greenery first, then small flowers threaded through it (plants/wild.js)
    planterPlants(sharedPlants(), g, DECK.x0 + 0.06, DECK.x0 + 0.66, DECK.z1 - 0.61, DECK.z1 - 0.09, YF + 0.41, { seed: 11, flowers: ['pansy', 'daisy'] });
    planterPlants(sharedPlants(), g, DECK.x1 - 0.56, DECK.x1 - 0.06, DECK.z1 - 0.58, DECK.z1 - 0.09, YF + 0.41, { seed: 13, flowers: ['pansy', 'forget'] });
    planterPlants(sharedPlants(), g, DECK.x0 + 0.06, DECK.x0 + 0.34, Z1 + 0.19, DECK.z1 - 0.94, YF + 0.41, { seed: 19, flowers: ['pansy', 'daisy', 'pinkWild'], greens: ['fern', 'hosta'] });
    // three round tables, two chairs each, set at easy angles
    const t1 = roundTable(g, -11.25, 1.85), t2 = roundTable(g, -10.15, 2.95), t3 = roundTable(g, -11.25, 3.85, 0.3);
    chair(g, -11.25 - 0.55, 1.85 - 0.08, Math.PI / 2 + 0.15); chair(g, -11.25 + 0.55, 1.85 + 0.05, -Math.PI / 2 - 0.1);
    chair(g, -10.15 - 0.05, 2.95 - 0.56, 0.12); chair(g, -10.15 + 0.06, 2.95 + 0.56, Math.PI - 0.1);
    chair(g, -11.25 - 0.52, 3.85 + 0.1, Math.PI / 2 - 0.2); chair(g, -11.25 + 0.5, 3.85 - 0.12, -Math.PI / 2 + 0.25);
    // on the tables: a plate with croissants + a coffee, a cake slice + a paper bag; the third one just a little vase
    cy(g, m.white, -11.3, t1, 1.8, 0.11, 0.012, 18); croissant(g, -11.32, t1 + 0.012, 1.8, 0.4); croissant(g, -11.25, t1 + 0.012, 1.86, 2.2);
    cy(g, m.white, -11.05, t1, 1.98, 0.05, 0.006, 12); cy(g, m.white, -11.05, t1 + 0.006, 1.98, 0.034, 0.06, 10); cy(g, toon('#5a3420'), -11.05, t1 + 0.062, 1.98, 0.028, 0.004, 10);
    cy(g, m.white, -10.2, t2, 2.92, 0.1, 0.012, 18); cakeSlice(g, -10.2, t2 + 0.012, 2.92, 0.6); bag(g, -9.98, t2, 3.05, 0.13, 0.2, 0.07, -0.4, true);
    cy(g, toon('#eef6f4', { op: 0.4 }), -11.25, t3, 3.85, 0.035, 0.12, 10); [['cutGerbera', 3, 0.3], ['cutRose', 1, -0.25], ['cutGerbera', 1, 0]].forEach(([t, v, a], k) => plantAt(sharedPlants(), g, t, v, -11.25 + (k - 1) * 0.01, t3 + 0.02, 3.85, 0.42, { ry: 0, tilt: [a * 0.6, (k - 1) * 0.3] })); // a little vase of real flowers
    // by the door: a welcome mat, an A-frame TODAY'S BREAD board, a BREAD sign stand, crates of baguettes, pots, herbs
    const wm = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#9a7a52'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a5d3b'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); T(c, 'WELCOME', w / 2, h / 2 + 2, 36, '#efe2c8', { weight: 800 }); });
    const mp = pl(g, new THREE.MeshBasicMaterial({ map: wm, color: new THREE.Color(0.88, 0.85, 0.8) }), 1.0, 0.36, (DOOR.x0 + DOOR.x1) / 2, YF + 0.004, Z1 + 0.3, 0, -Math.PI / 2); mp.userData.noLine = true;
    const a = grp(g, -8.55, YF, 3.75, -0.18);
    [1, -1].forEach((s) => {
      const side = grp(a, 0, 0, s * 0.12, 0); side.rotation.x = -s * 0.2;
      bx(side, m.frame, -0.32, 0.32, 0, 0.045, -0.02, 0.02); bx(side, m.frame, -0.32, 0.32, 0.95, 1.0, -0.02, 0.02);
      bx(side, m.frame, -0.32, -0.28, 0, 1.0, -0.025, 0.025); bx(side, m.frame, 0.28, 0.32, 0, 1.0, -0.025, 0.025);
      const p = pl(side, new THREE.MeshBasicMaterial({ map: chalkTex([['クロワッサン', '¥220', '#e8a64a'], ['メロンパン', '¥180', '#f2c14e'], ['ベーグル', '¥200', '#c38a48'], ['カレーパン', '¥200', '#c97a3a'], ['食パン', '¥380', '#f3eedf']], 'aframe', "TODAY'S BREAD", '本日のパン') }), 0.54, 0.84, 0, 0.5, s * 0.027, s > 0 ? 0 : Math.PI, 0); p.userData.noLine = true;
    });
    { const st = grp(g, -8.25, YF, 1.25, -0.35); bx(st, m.frameD, -0.03, 0.03, 0, 1.25, -0.03, 0.03); bx(st, m.frameD, -0.2, 0.2, 0, 0.04, -0.15, 0.15); bx(st, m.cream, -0.17, 0.17, 0.35, 1.22, 0.035, 0.06, { bevel: 0.01 }); const sp = pl(st, new THREE.MeshBasicMaterial({ map: signStandTex() }), 0.32, 0.84, 0, 0.785, 0.062, 0, 0); sp.userData.noLine = true; }
    { const c = grp(g, -8.25, YF, 1.95, 0); const crateM = toon('#c69a64', { lit: 0.15 }); for (let k = 0; k < 2; k++) { const y = k * 0.24; bx(c, crateM, -0.24, 0.24, y, y + 0.02, -0.18, 0.18); [-1, 1].forEach((sx) => bx(c, crateM, sx * 0.24 - 0.015, sx * 0.24 + 0.015, y, y + 0.22, -0.18, 0.18)); [-1, 1].forEach((sz) => { bx(c, crateM, -0.24, 0.24, y, y + 0.06, sz * 0.18 - 0.015, sz * 0.18 + 0.015); bx(c, crateM, -0.24, 0.24, y + 0.14, y + 0.22, sz * 0.18 - 0.015, sz * 0.18 + 0.015); }); }
      for (let j = 0; j < 5; j++) baguette(c, (j - 2) * 0.05, 0.3, 0, Math.PI / 2 + (j - 2) * 0.06, -0.55 - (j % 2) * 0.1, 0.5); }
    [['rosemary', -8.65, 1.12], ['mint', -9.75, 1.15], ['thyme', -8.2, 2.42]].forEach(([k, x, z], i) => herbPot(g, bins, x, YF, z, k, 400 + i));
    [[-9.85, 1.42, 0.12], [-8.62, 2.45, 0.1]].forEach(([x, z, r], i) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, r * 1.25, 12), m.clay); p.position.set(x, YF + r * 0.62, z); p.castShadow = true; g.add(p); potPlants(sharedPlants(), x, YF + r * 1.2, z, r * 0.9, { variant: i ? 4 : 0, seed: i, obj: g }); });
  }

  /* ---- the alley mouth: a tray trolley of bread crates, the delivery box, a small bin ---- */
  {
    const crateM = toon('#b98a52', { lit: 0.15 });
    const tr = grp(g, -7.45, Y0, 0.25, 0.1);
    bx(tr, m.steel, -0.3, 0.3, 0.12, 0.15, -0.4, 0.4);
    [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]].forEach(([a, b]) => bx(tr, m.steel, a - 0.01, a + 0.01, 0.0, 0.12, b - 0.01, b + 0.01));
    cyl2(tr, m.steel, [-0.28, 0.15, 0.4], [-0.28, 0.95, 0.42], 0.012, 5); cyl2(tr, m.steel, [0.28, 0.15, 0.4], [0.28, 0.95, 0.42], 0.012, 5); cyl2(tr, m.steel, [-0.28, 0.95, 0.42], [0.28, 0.95, 0.42], 0.012, 5);
    for (let k = 0; k < 3; k++) { const y = 0.15 + k * 0.2; bx(tr, crateM, -0.27, 0.27, y, y + 0.02, -0.36, 0.36); [-1, 1].forEach((sx) => bx(tr, crateM, sx * 0.27 - 0.015, sx * 0.27 + 0.015, y, y + 0.18, -0.36, 0.36)); [-1, 1].forEach((sz) => bx(tr, crateM, -0.27, 0.27, y, y + 0.18, sz * 0.36 - 0.015, sz * 0.36 + 0.015)); }
    for (let i = 0; i < 6; i++) bun(tr, -0.15 + (i % 3) * 0.15, 0.57, -0.2 + ((i / 3) | 0) * 0.35, 'roll');
    const db = grp(g, -7.6, Y0, -0.65, 0);
    bx(db, crateM, -0.25, 0.25, 0, 0.22, -0.2, 0.2); bx(db, toon('#c58f55'), -0.22, 0.22, 0.22, 0.58, -0.17, 0.17, { bevel: 0.03 });
    cy(g, toon('#8d8f86'), -7.55, Y0, -1.25, 0.17, 0.5, 14); cy(g, toon('#7a7c74'), -7.55, Y0 + 0.5, -1.25, 0.18, 0.04, 14);
  }

  bins.flush();
  g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });
  // under the roof nothing takes snow (the canopy, the croissant and the terrace outside still do)
  noSnowBox(IN.x0, Z0 + 0.12, IN.x1, Z1 - 0.04, 3.6);
  // the canopy takes petals / leaves / snow, rain drips off its front edge
  (reg.extraRoofs ||= []).push({ id: 'bakeryCanopy', a: [X1 + 0.06, Z1], b: [X0 - 0.12, Z1], n: [0, 1], D: CAN.d, y: CAN.y1 + 0.02, drop: 0.02, w: { petal: 0.5, leaf: 0.5 }, snow: 0.1 });
  for (let x = X0; x < X1; x += 0.7) drips.push([x, CAN.y0 - 0.02, Z1 + CAN.d + 0.02, YF + 0.005]);

  /* ---- the doors open while the camera is at the door or inside (doors.js) ---- */
  const entrance = new THREE.Vector3((DOOR.x0 + DOOR.x1) / 2, YF + 1, Z1);
  const inside = (p, pad = 0) => p.x > X0 - pad && p.x < X1 + pad && p.z < Z1 + pad && p.z > PART - pad;
  const door = swingDoors({ leaves, entrance, inside, angle: 1.4, hit: doorHit(g, DOOR.x1 - DOOR.x0, DOOR.y1 - YF, (DOOR.x0 + DOOR.x1) / 2, (YF + DOOR.y1) / 2, Z1 - 0.05) });
  (reg.closeZones ||= []).push((p) => inside(p, 0.8));
  reg.bakery = {
    door, entrance,
    views: {
      front: { t: new THREE.Vector3(entrance.x - 0.6, YF + 1.3, Z1 - 1.2), s: new THREE.Spherical(9.5, THREE.MathUtils.degToRad(74), -0.22) },
      inside: { t: new THREE.Vector3(-9.6, YF + 1.0, -2.6), s: new THREE.Spherical(3.6, THREE.MathUtils.degToRad(70), -0.25) },
    },
  };
  return g;
}
