import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, rng, FONT } from '../core.js';
import { makeGlass } from '../fx.js';
import { makeShrub, makeTree } from '../tree.js';
import { makePot } from '../plants/pottedPlants.js';
import { posterTex } from '../tex.js';
import { vendingMachine, bicycle, trashBins, streetLamp, utilityPole, wire } from '../street.js';
import { rbx } from './streetRow.js';
import { txt, SERIF, wetPass } from './shopkit.js';
import { STATION, PLATFORM, RAIL, groundY } from './layout.js';
import { P, shade } from '../palette.js';

/* ====================================================================================================
   星空町駅 - the town's small local station on the single line (town/rail.js; the tram stops here, town/train.js), on the
   south edge of the station block, north of the track.

     building   one storey, cream plaster over a timber wainscot, timber posts, a slate-tiled gable (eaves north /
                south), a tiled canopy over the entrance, the lit station sign + a clock on the front. Not a shell:
                through the glass the concourse with two ticket machines under the lit fare chart + route map, three
                automatic ticket gates (their little displays lit), the ticket window of the office (a desk, a lamp,
                papers), the waiting room with benches, notice + timetable boards, ceiling lights. The glass doors
                slide open now and then.
     platform   level with the tram's floor (layout.js STATION.deck; the track runs level here), a white edge and the
                yellow tactile line, steps up from the gates, a steel canopy with lights, the station name board, the
                platform number, a departure board that changes, a clock, benches, a vending machine, bins, a fence
     forecourt  at pavement level where it meets Hoshizora-dori (layout.js), a covered bicycle park, a round flower bed
                with a clock post, benches, street lamps, the bus stop, a guide map, a finger-post, notice + poster
                boards, vending machines + bins by the west wall, an umbrella stand, a post box, a utility pole with the
                station's drop; the ground paint adds the tactile path, drain grates and a manhole (town/ground.js)
   Light: warm inside (category 'shop': lit day and night like the convenience store), the platform lamps and the sign
   follow the street lamps ('lamp'), the vending machines glow.
   ==================================================================================================== */

const { floor: F, deck: DK, bx0: X0, bx1: X1, bz0: Z0, bz1: Z1 } = STATION; // Z0 = the front (north), Z1 = the back (platform side)
const WALL = 3.0, TOP = F + WALL;

/* ---------------------------------------------------------------- textures */
const T = {};
const ct = (k, w, h, draw, o) => (T[k] ||= canvasTex(w, h, draw, o));
const kawaraTex = () => ct('stKawara', 128, 128, (g, w, h) => { g.fillStyle = shade(P.slate, -0.22); g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = P.slate; g.fillRect(x + 2, 0, 10, h); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 3, 0, 2, h); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(0, y, w, 2); } }, { repeat: true });
const plasterTex = () => ct('stPlaster', 256, 256, (g, w, h) => { g.fillStyle = P.cream; g.fillRect(0, 0, w, h); const R = rng(5); for (let i = 0; i < 1600; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,252,244,0.14)' : 'rgba(190,176,156,0.08)'; const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s); } }, { repeat: true });
const boardTex = () => ct('stBoards', 256, 256, (g, w, h) => { const R = rng(8); for (let x = 0; x < w; x += 32) { const v = (R() - 0.5) * 0.08; g.fillStyle = shade(P.woodL, v); g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(90,60,30,0.35)'; g.fillRect(x, 0, 2, h); } }, { repeat: true });
const floorTex = () => ct('stFloor', 256, 256, (g, w, h) => { g.fillStyle = '#d6d0c4'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = (x + y) % 128 ? '#ddd8cd' : '#d0cabd'; g.fillRect(x + 1, y + 1, 62, 62); } }, { repeat: true });
const deckTex = () => ct('stDeck', 256, 256, (g, w, h) => { const R = rng(12); g.fillStyle = '#b9b4aa'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = shade('#c6c1b6', (R() - 0.5) * 0.05); g.fillRect(x + 2, y + 2, 60, 60); } }, { repeat: true });
const tactileTex = () => ct('stTactile', 64, 64, (g, w, h) => { g.fillStyle = '#e2b62e'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2cd48'; for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); } g.strokeStyle = 'rgba(120,90,20,0.5)'; g.strokeRect(0.5, 0.5, w - 1, h - 1); }, { repeat: true });
const sign = (k, w, h, draw) => ct(k, w, h, draw);
// the station sign on the front: 星空町駅 / HOSHIZORA STATION
const frontSign = () => sign('stFront', 1024, 192, (g, w, h) => { g.fillStyle = '#f4efe3'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f5a8a'; g.fillRect(0, h - 26, w, 26); txt(g, '星空町駅', w / 2, 82, 104, '#22324a', { font: SERIF, weight: 800 }); txt(g, 'HOSHIZORA  STATION', w / 2, h - 13, 18, '#f4efe3', { font: FONT, weight: 700 }); });
// the station name board (駅名標) on the platform
const nameBoard = () => sign('stName', 1024, 512, (g, w, h) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2e7d5b'; g.fillRect(0, 300, w, 70); // the line's colour band
  g.fillStyle = '#2e7d5b'; g.beginPath(); g.arc(120, 150, 64, 0, 7); g.fill(); txt(g, 'HZ', 120, 132, 40, '#fff', { font: FONT, weight: 800 }); txt(g, '05', 120, 176, 40, '#fff', { font: FONT, weight: 800 });
  txt(g, 'ほしぞら', w / 2 + 40, 120, 132, '#1d2a3a', { font: SERIF, weight: 800 });
  txt(g, '星空町　Hoshizora', w / 2 + 40, 238, 46, '#3a4656', { font: FONT, weight: 600 });
  txt(g, '◀ うみかぜ', 170, 336, 40, '#fff', { font: FONT, weight: 700 }); txt(g, 'みなと ▶', w - 160, 336, 40, '#fff', { font: FONT, weight: 700 });
  txt(g, 'Umikaze', 150, 420, 30, '#3a4656', { font: FONT, weight: 600 }); txt(g, 'Minato', w - 150, 420, 30, '#3a4656', { font: FONT, weight: 600 });
  g.strokeStyle = '#c7ccd2'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
});
const platformNo = () => sign('stNo', 512, 160, (g, w, h) => { g.fillStyle = '#1f2a38'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2b53c'; g.beginPath(); g.arc(80, h / 2, 56, 0, 7); g.fill(); txt(g, '1', 80, h / 2 + 4, 84, '#1f2a38', { font: FONT, weight: 900 }); txt(g, 'のりば', 250, 58, 46, '#fff', { font: FONT, weight: 700 }); txt(g, 'みなと・うみかぜ方面', 300, 118, 30, '#cfd8e2', { font: FONT, weight: 600 }); });
const fareChart = () => sign('stFare', 768, 384, (g, w, h) => {
  g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, w, h); txt(g, '運賃表  Fares', w / 2, 34, 30, '#1d2a3a', { font: FONT, weight: 800 });
  g.strokeStyle = '#2e7d5b'; g.lineWidth = 10; g.beginPath(); g.moveTo(60, 200); g.lineTo(w - 60, 200); g.stroke();
  const st = [['みさき', 260], ['はまかぜ', 220], ['うみかぜ', 180], ['ほしぞら', 0], ['みなと', 180], ['こうえん', 220], ['しんまち', 260]];
  st.forEach(([n, f], i) => { const x = 60 + (i * (w - 120)) / (st.length - 1); g.fillStyle = f ? '#fff' : '#e8674f'; g.strokeStyle = '#2e7d5b'; g.lineWidth = 6; g.beginPath(); g.arc(x, 200, 16, 0, 7); g.fill(); g.stroke(); txt(g, n, x, 150, 24, '#1d2a3a', { font: FONT, weight: 700 }); txt(g, f ? `${f}` : '現在地', x, 252, f ? 30 : 22, f ? '#1d2a3a' : '#e8674f', { font: FONT, weight: 800 }); });
  txt(g, '小児半額  IC カード ご利用いただけます', w / 2, h - 40, 22, '#3a4656', { font: FONT, weight: 600 });
});
const routeMap = () => sign('stRoute', 768, 384, (g, w, h) => {
  g.fillStyle = '#eef3ef'; g.fillRect(0, 0, w, h); txt(g, '路線図  Route Map', 130, 34, 26, '#1d2a3a', { font: FONT, weight: 800 });
  g.fillStyle = '#9fc6e0'; g.beginPath(); g.moveTo(0, h); g.bezierCurveTo(w * 0.3, h * 0.72, w * 0.7, h * 0.86, w, h * 0.62); g.lineTo(w, h); g.fill(); // the sea
  g.strokeStyle = '#2e7d5b'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(60, 300); g.bezierCurveTo(220, 260, 330, 130, 470, 150); g.bezierCurveTo(600, 170, 650, 90, 720, 80); g.stroke();
  [[60, 300, 'みさき'], [170, 272, 'はまかぜ'], [290, 196, 'うみかぜ'], [400, 152, 'ほしぞら'], [520, 156, 'みなと'], [620, 120, 'こうえん'], [720, 80, 'しんまち']].forEach(([x, y, n], i) => { g.fillStyle = i === 3 ? '#e8674f' : '#fff'; g.strokeStyle = '#1d2a3a'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, i === 3 ? 15 : 11, 0, 7); g.fill(); g.stroke(); txt(g, n, x, y - 28, 20, '#1d2a3a', { font: FONT, weight: 700 }); });
});
const timetable = () => sign('stTime', 384, 512, (g, w, h) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#2e7d5b'; g.fillRect(0, 0, w, 64); txt(g, '時刻表  みなと方面', w / 2, 34, 28, '#fff', { font: FONT, weight: 800 });
  for (let hr = 6; hr <= 22; hr++) { const y = 84 + (hr - 6) * 25; g.fillStyle = hr % 2 ? '#f0f2ee' : '#fff'; g.fillRect(0, y - 12, w, 25); txt(g, String(hr), 30, y + 1, 18, '#1d2a3a', { font: FONT, weight: 800 }); txt(g, hr < 8 || (hr > 16 && hr < 20) ? '05  20  35  50' : '12  42', 200, y + 1, 18, '#3a4656', { font: FONT, weight: 600, align: 'center' }); }
});
const notice = () => sign('stNotice', 512, 384, (g, w, h) => { g.fillStyle = '#c9a36b'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, w, 12); [[20, 30, 150, 190, 0], [190, 26, 130, 160, 1], [340, 40, 150, 120, 2], [40, 240, 200, 120, 3], [270, 190, 220, 170, 4]].forEach(([x, y, ww, hh, k]) => { g.fillStyle = ['#fff7e6', '#e8f2f8', '#fde4e4', '#f2f7e8', '#fffbe8'][k]; g.fillRect(x, y, ww, hh); g.fillStyle = ['#c0392b', '#2f5f8a', '#d24c7a', '#4f7f46', '#e0a030'][k]; g.fillRect(x + 10, y + 12, ww - 20, 20); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 5; i++) g.fillRect(x + 12, y + 46 + i * 16, ww - 24 - (i % 2) * 30, 6); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(x + ww / 2, y + 4, 5, 0, 7); g.fill(); }); });
const guideMap = () => sign('stGuide', 512, 384, (g, w, h) => {
  g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f5a8a'; g.fillRect(0, 0, w, 52); txt(g, '周辺案内図  Area Map', w / 2, 28, 28, '#fff', { font: FONT, weight: 800 });
  g.fillStyle = '#cfe0c8'; g.fillRect(30, 80, 160, 120); g.fillStyle = '#9fc6e0'; g.beginPath(); g.ellipse(110, 140, 60, 36, 0, 0, 7); g.fill(); // the lake park
  g.fillStyle = '#b9d3a8'; g.fillRect(220, 70, 150, 130); g.fillStyle = '#e0dccf'; g.fillRect(30, 230, 460, 30); g.fillRect(380, 70, 30, 290); // roads
  g.strokeStyle = '#2e7d5b'; g.lineWidth = 8; g.beginPath(); g.moveTo(20, 215); g.lineTo(420, 215); g.quadraticCurveTo(470, 215, 470, 160); g.lineTo(470, 60); g.stroke();
  g.fillStyle = '#e8674f'; g.beginPath(); g.arc(440, 200, 13, 0, 7); g.fill(); txt(g, '現在地', 440, 175, 18, '#e8674f', { font: FONT, weight: 800 });
  txt(g, '星空神社', 295, 130, 20, '#3a4656', { font: FONT, weight: 700 }); txt(g, '星空湖', 110, 140, 18, '#1d3a5a', { font: FONT, weight: 700 }); txt(g, '海岸通り', 160, 300, 20, '#3a4656', { font: FONT, weight: 700 }); txt(g, 'LAWSON', 330, 300, 16, '#2f5a8a', { font: FONT, weight: 800 });
});
const busStop = () => sign('stBus', 256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill(); g.strokeStyle = '#d24c3f'; g.lineWidth = 14; g.stroke(); txt(g, 'バス', w / 2, 92, 52, '#d24c3f', { font: FONT, weight: 900 }); txt(g, '星空町駅前', w / 2, 158, 32, '#1d2a3a', { font: FONT, weight: 800 }); txt(g, 'のりば', w / 2, 200, 26, '#1d2a3a', { font: FONT, weight: 700 }); });
const clockFace = () => sign('stClock', 256, 256, (g, w, h) => { g.fillStyle = '#fbfaf6'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, 7); g.fill(); g.strokeStyle = '#2f2e38'; g.lineWidth = 10; g.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineWidth = i % 3 ? 4 : 9; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * 96, h / 2 - Math.cos(a) * 96); g.lineTo(w / 2 + Math.sin(a) * 112, h / 2 - Math.cos(a) * 112); g.stroke(); } g.lineCap = 'round'; [[(3 + 42 / 60) / 12, 58, 12], [42 / 60, 88, 7]].forEach(([f, l, lw]) => { const a = f * Math.PI * 2; g.lineWidth = lw; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * l, h / 2 - Math.cos(a) * l); g.stroke(); }); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, 7); g.fill(); });
const fingerTex = (s, flip) => sign(`stFinger${s}${flip}`, 384, 72, (g, w, h) => { g.fillStyle = '#2f5a8a'; g.beginPath(); if (flip) { g.moveTo(30, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(30, h); g.lineTo(0, h / 2); } else { g.moveTo(0, 0); g.lineTo(w - 30, 0); g.lineTo(w, h / 2); g.lineTo(w - 30, h); g.lineTo(0, h); } g.closePath(); g.fill(); txt(g, s, w / 2, h / 2 + 2, 30, '#fff', { font: FONT, weight: 700 }); });
const latticeTex = () => ct('stLattice', 128, 128, (g, w, h) => { g.fillStyle = '#fff1d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a5a3c'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3); });

/* ---------------------------------------------------------------- materials */
const M = {};
function mats() {
  if (M.plaster) return M;
  M.plaster = toon('#ffffff', { map: plasterTex(), nocache: true, lit: 0.05 });
  M.boards = toon('#ffffff', { map: boardTex(), nocache: true, lit: 0.06 });
  M.post = toon(P.woodM, { lit: 0.08 });
  M.trim = toon(P.woodD, { lit: 0.05 });
  M.kawara = toon('#ffffff', { map: kawaraTex(), nocache: true });
  M.ridge = toon(shade(P.slate, -0.3));
  M.inWall = toon('#f2ede3', { lit: 0.3 });
  M.floor = toon('#ffffff', { map: floorTex(), nocache: true, lit: 0.25 });
  M.deck = toon('#ffffff', { map: deckTex(), nocache: true });
  M.face = toon('#a9a49b');
  M.edge = toon('#f1efe8');
  M.tactile = toon('#ffffff', { map: tactileTex(), nocache: true });
  M.steel = toon('#9fb0a6'); // the canopy's painted steel (pale green-grey)
  M.metal = toon('#5a5f66');
  M.roofMetal = toon(P.roofMetal);
  M.ink = toon(P.ink);
  M.white = toon('#f3f0e8', { lit: 0.08 });
  M.machine = toon('#e8eaee', { lit: 0.15 });
  M.gate = toon('#d9dde2', { lit: 0.15 });
  M.bench = toon(P.woodL, { lit: 0.1 });
  M.stone = toon(shade(P.stone, -0.05));
  return M;
}
const plane = (p, mat, w, h, x, y, z, ry = 0) => { const m = pl(p, mat, w, h, x, y, z, ry, 0); m.userData.noLine = true; return m; };
const basic = (map, k = 1) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k) });
const lit = (map, k = 1.1) => glow('#ffffff', k, { map, cat: 'shop', off: '#cfcfcf' });

/* ---------------------------------------------------------------- a gable roof with its ridge along x (eaves north + south) */
function gable(p, x0, x1, z0, z1, y, rise, ovE, ovG) {
  const m = mats(), zr = (z0 + z1) / 2, half = (z1 - z0) / 2, a = Math.atan2(rise, half), th = 0.12;
  const len = (half + ovE) / Math.cos(a), yR = y + rise + th / Math.cos(a), W = x1 - x0 + 2 * ovG;
  [1, -1].forEach((s) => {
    const q = grp(p, 0, yR, zr, 0); q.rotation.x = s * a;
    const geo = new THREE.BoxGeometry(W, th, len), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / 0.9, uv.getY(i) * len / 0.9);
    const slab = new THREE.Mesh(geo, m.kawara); slab.position.set((x0 + x1) / 2, -th / 2, (s * len) / 2); slab.castShadow = slab.receiveShadow = true; q.add(slab);
    bx(q, m.trim, x0 - ovG - 0.02, x1 + ovG + 0.02, -th - 0.1, 0.004, s > 0 ? len - 0.05 : -len, s > 0 ? len : -len + 0.05, { cast: false });
    [x0 - ovG - 0.02, x1 + ovG + 0.02].forEach((x) => bx(q, m.trim, x - 0.035, x + 0.035, -th - 0.12, 0.015, s > 0 ? 0 : -len, s > 0 ? len : 0, { cast: false }));
    cyl2(q, toon('#c3c2bc'), [x0 - ovG, -th - 0.06, s * (len + 0.05)], [x1 + ovG, -th - 0.06, s * (len + 0.05)], 0.05, 8);
  });
  bx(p, m.ridge, x0 - ovG - 0.05, x1 + ovG + 0.05, yR - 0.06, yR + 0.1, zr - 0.13, zr + 0.13, { bevel: 0.02 });
  const sh = new THREE.Shape(); sh.moveTo(z0, 0); sh.lineTo(z1, 0); sh.lineTo(zr, rise); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(x1, y, 0);
  const prism = new THREE.Mesh(geo, m.plaster); prism.castShadow = prism.receiveShadow = true; p.add(prism);
  return { yR, zr, D: half + ovE, drop: (half + ovE) * Math.tan(a) };
}

/* ---------------------------------------------------------------- the building */
function building(g, piles, U) {
  const m = mats();
  // plinth + floor (the steps up from the forecourt are in front of the entrance)
  rbx(g, m.stone, X0 - 0.1, X1 + 0.1, 0.05, F, Z0 - 0.1, Z1 + 0.05, { r: 0.02, cast: false });
  rbx(g, m.floor, X0 + 0.06, X1 - 0.06, F, F + 0.02, Z0 + 0.06, Z1 - 0.06, { r: 0.004, cast: false, tile: 1.2 });
  rbx(g, m.inWall, X0 + 0.06, X1 - 0.06, TOP - 0.06, TOP, Z0 + 0.06, Z1 - 0.06, { r: 0.004, cast: false }); // the ceiling
  // walls as piers round the openings (front: entrance + waiting-room glass + office window; back: the gate passage)
  const yW = F + 1.0; // top of the timber wainscot
  const wallX = (z, a, b, y0 = F, y1 = TOP, t = 0.12) => { // a stretch of wall along x at z (plaster above the wainscot)
    if (y0 < yW) rbx(g, m.boards, a, b, y0, Math.min(y1, yW), z - t / 2, z + t / 2, { r: 0.01, tile: 1.2 });
    if (y1 > yW) rbx(g, m.plaster, a, b, Math.max(y0, yW), y1, z - t / 2, z + t / 2, { r: 0.01, tile: 1.6 });
  };
  const wallZ = (x, a, b, y0 = F, y1 = TOP, t = 0.12) => {
    if (y0 < yW) rbx(g, m.boards, x - t / 2, x + t / 2, y0, Math.min(y1, yW), a, b, { r: 0.01, tile: 1.2 });
    if (y1 > yW) rbx(g, m.plaster, x - t / 2, x + t / 2, Math.max(y0, yW), y1, a, b, { r: 0.01, tile: 1.6 });
  };
  const ENT = [14.0, 15.6], WAIT = [16.1, 18.9], OFF = [19.35, 20.65], GATE = [14.2, 16.2];
  // front (north) wall
  wallX(Z0, X0, ENT[0]); wallX(Z0, ENT[1], WAIT[0]); wallX(Z0, WAIT[1], OFF[0]); wallX(Z0, OFF[1], X1);
  wallX(Z0, ENT[0], ENT[1], F + 2.3, TOP); // over the doors
  wallX(Z0, WAIT[0], WAIT[1], F, F + 0.55); wallX(Z0, WAIT[0], WAIT[1], F + 2.35, TOP); // under / over the big window
  wallX(Z0, OFF[0], OFF[1], F, F + 0.9); wallX(Z0, OFF[0], OFF[1], F + 2.1, TOP);
  // back (south) wall: the passage to the platform + a window onto the platform from the waiting room
  wallX(Z1, X0, GATE[0]); wallX(Z1, GATE[1], 16.9); wallX(Z1, 18.6, X1); wallX(Z1, GATE[0], GATE[1], F + 2.3, TOP);
  wallX(Z1, 16.9, 18.6, F, F + 0.9); wallX(Z1, 16.9, 18.6, F + 2.1, TOP);
  // ends: the west end faces Hoshizora-dori (a window into the concourse), the east end is the office
  wallZ(X0, Z0, -25.9); wallZ(X0, -24.7, Z1); wallZ(X0, -25.9, -24.7, F, F + 1.0); wallZ(X0, -25.9, -24.7, F + 2.2, TOP);
  wallZ(X1, Z0, Z1);
  // inside: the office partition (with its ticket window), the waiting-room partition (glazed)
  wallZ(19.2, Z0, -25.6); wallZ(19.2, -24.6, Z1); wallZ(19.2, -25.6, -24.6, F, F + 1.0); wallZ(19.2, -25.6, -24.6, F + 2.0, TOP);
  // timber posts at the corners + bay lines, a beam under the eaves, the base board
  [X0, ENT[1] + 0.25, WAIT[1] + 0.22, X1].forEach((x) => [Z0, Z1].forEach((z) => rbx(g, m.post, x - 0.09, x + 0.09, F, TOP, z - 0.09, z + 0.09, { r: 0.01 })));
  [Z0, Z1].forEach((z) => rbx(g, m.trim, X0 - 0.1, X1 + 0.1, TOP - 0.2, TOP, z - 0.1, z + 0.1, { r: 0.01 }));
  // glass: doors (sliding: see the updater), the big waiting-room window, the office window, the back + end windows
  const glass = (w, h, x, y, z, ry = 0, seed = 0) => { const gm = makeGlass(w, h, 600 + seed, { alpha: 0.05, drops: 0.25 }); const q = plane(g, gm, w, h, x, y, z, ry); q.renderOrder = 2; reg.noRefl.push(q); return q; };
  const frame = (x0, x1, y0, y1, z) => { [[x0, x0 + 0.05], [x1 - 0.05, x1]].forEach(([a, b]) => rbx(g, m.ink, a, b, y0, y1, z - 0.04, z + 0.04, { r: 0.005 })); [[y0, y0 + 0.05], [y1 - 0.05, y1]].forEach(([a, b]) => rbx(g, m.ink, x0, x1, a, b, z - 0.04, z + 0.04, { r: 0.005 })); };
  frame(WAIT[0], WAIT[1], F + 0.55, F + 2.35, Z0); rbx(g, m.ink, 17.48, 17.52, F + 0.55, F + 2.35, Z0 - 0.04, Z0 + 0.04, { r: 0.004 }); glass(WAIT[1] - WAIT[0], 1.8, (WAIT[0] + WAIT[1]) / 2, F + 1.45, Z0 - 0.01, Math.PI, 1);
  frame(OFF[0], OFF[1], F + 0.9, F + 2.1, Z0); glass(OFF[1] - OFF[0], 1.2, (OFF[0] + OFF[1]) / 2, F + 1.5, Z0 - 0.01, Math.PI, 2);
  frame(16.9, 18.6, F + 0.9, F + 2.1, Z1); glass(1.7, 1.2, 17.75, F + 1.5, Z1 + 0.01, 0, 3);
  { const gq = makeGlass(1.2, 1.2, 604, { alpha: 0.05, drops: 0.25 }); const q = plane(g, gq, 1.2, 1.2, X0 - 0.01, F + 1.6, -25.3, -Math.PI / 2); q.renderOrder = 2; reg.noRefl.push(q); rbx(g, m.ink, X0 - 0.04, X0 + 0.04, F + 1.0, F + 1.05, -25.9, -24.7, { r: 0.004 }); rbx(g, m.ink, X0 - 0.04, X0 + 0.04, F + 2.15, F + 2.2, -25.9, -24.7, { r: 0.004 }); }
  frame(ENT[0], ENT[1], F, F + 2.3, Z0);
  const doors = [0, 1].map((k) => { const d = grp(g, ENT[0] + 0.4 + k * 0.8, F, Z0, 0); rbx(d, m.ink, -0.4, 0.4, 0, 0.06, -0.025, 0.025, { r: 0.004 }); rbx(d, m.ink, -0.4, 0.4, 2.18, 2.24, -0.025, 0.025, { r: 0.004 }); [-0.4, 0.37].forEach((a) => rbx(d, m.ink, a, a + 0.03, 0, 2.24, -0.025, 0.025, { r: 0.004 })); const q = plane(d, makeGlass(0.74, 2.1, 610 + k, { alpha: 0.05, drops: 0.25 }), 0.74, 2.1, 0, 1.12, -0.03, Math.PI); q.renderOrder = 2; reg.noRefl.push(q); d.userData.keep = true; return d; });
  plane(g, basic(sign('stAuto', 256, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); txt(c, '自動ドア', w / 2, h / 2, 30, '#f4efe3', { font: FONT, weight: 700 }); })), 0.5, 0.12, 14.8, F + 1.3, Z0 - 0.06, Math.PI).material.transparent = true;
  U.doors = doors;

  // the roof: slate gable, eaves north + south; the tiled canopy over the entrance
  const r = gable(g, X0, X1, Z0, Z1, TOP, 1.15, 0.6, 0.38);
  piles.push(
    { id: 'stRoofN', a: [X0 - 0.38, r.zr], b: [X1 + 0.38, r.zr], n: [0, -1], D: r.D, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.5, leaf: 0.5 }, snow: 0.18, ridge: true },
    { id: 'stRoofS', a: [X1 + 0.38, r.zr], b: [X0 - 0.38, r.zr], n: [0, 1], D: r.D, y: r.yR + 0.05, drop: r.drop, w: { petal: 0.5, leaf: 0.5 }, snow: 0.18, ridge: true },
  );
  {
    const c0 = 13.55, c1 = 16.35, d = 1.25, y0 = F + 2.62, y1 = F + 2.42, L = Math.hypot(d, y0 - y1);
    const geo = new THREE.BoxGeometry(c1 - c0, 0.07, L), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (c1 - c0) / 0.9, uv.getY(i) * L / 0.9);
    const e = new THREE.Mesh(geo, m.kawara); e.position.set((c0 + c1) / 2, (y0 + y1) / 2, Z0 - d / 2); e.rotation.x = -Math.atan2(y0 - y1, d); e.castShadow = true; g.add(e);
    rbx(g, m.trim, c0, c1, y1 - 0.12, y1, Z0 - d - 0.02, Z0 - d + 0.06, { r: 0.01 });
    [c0 + 0.1, c1 - 0.1].forEach((x) => rbx(g, m.post, x - 0.06, x + 0.06, groundY(x, Z0 - d + 0.08), y1 - 0.08, Z0 - d + 0.02, Z0 - d + 0.14, { r: 0.008 }));
    piles.push({ id: 'stCanopy', a: [c0, Z0], b: [c1, Z0], n: [0, -1], D: d, y: y0 + 0.04, drop: y0 - y1, w: { petal: 0.4, leaf: 0.4 }, snow: 0.1 });
    // the station name board standing on the canopy (lit at dusk), readable from the forecourt and the road
    { const sm = glow('#ffffff', 1.05, { cat: 'lamp', map: frontSign(), off: '#e6e2d8' }); const zc = Z0 - 0.95, yb = y0 - (y0 - y1) * (0.95 / d) + 0.05; /* forward on the canopy, clear of the main eave */ [c0 + 0.35, c1 - 0.35].forEach((x) => rbx(g, m.trim, x - 0.04, x + 0.04, yb - 0.1, yb + 0.15, zc - 0.04, zc + 0.04, { r: 0.006 })); rbx(g, m.trim, c0 + 0.1, c1 - 0.1, yb + 0.1, yb + 0.66, zc - 0.05, zc + 0.03, { r: 0.01 }); plane(g, sm, c1 - c0 - 0.28, 0.52, (c0 + c1) / 2, yb + 0.38, zc - 0.055, Math.PI); }
    // the downlight under it
    bx(g, glow('#ffe6b8', 1.8, { cat: 'lamp', off: '#e8e2d2' }), 14.6, 15.0, y1 - 0.02, y1, Z0 - 0.75, Z0 - 0.55, { cast: false });
    halo(g, 14.8, y1 - 0.15, Z0 - 0.65, '#ffd9a0', 1.6, 0.35, 'lamp');
  }
  // the station sign (lit at dusk) and the clock over the entrance, steps up to the doors
  { const sm = glow('#ffffff', 1.05, { cat: 'lamp', map: frontSign(), off: '#e6e2d8' }); rbx(g, m.trim, 16.0, 19.9, F + 2.4, F + 2.98, Z0 - 0.14, Z0 - 0.06, { r: 0.01 }); plane(g, sm, 3.8, 0.71, 17.95, F + 2.69, Z0 - 0.145, Math.PI); }
  { const cg = grp(g, X0 - 0.07, TOP + 0.5, (Z0 + Z1) / 2, -Math.PI / 2); cy(cg, m.ink, 0, -0.03, 0, 0.29, 0.06, 28).rotation.x = Math.PI / 2; plane(cg, basic(clockFace()), 0.5, 0.5, 0, 0, 0.035); U.clocks.push(cg); } // in the west gable, facing the road
  for (let k = 0; k < 3; k++) { const z = Z0 - k * 0.3; rbx(g, m.stone, ENT[0] - 0.4, ENT[1] + 0.4, 0.1, F - 0.15 * k, z - 0.3, z, { r: 0.015 }); }
  // the barrier-free ramp along the front, from the west end up to the doors (with a rail)
  { const xa = ENT[1] + 0.4, xb = xa + 3.0, ya = F, yb = groundY(xb, Z0 - 0.45), L = Math.hypot(xb - xa, ya - yb);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.9), m.stone); ramp.position.set((xa + xb) / 2, (ya + yb) / 2 - 0.04, Z0 - 0.45); ramp.rotation.z = -Math.atan2(ya - yb, xb - xa); ramp.castShadow = ramp.receiveShadow = true; g.add(ramp);
    cyl2(g, m.metal, [xb, yb + 0.85, Z0 - 0.92], [xa, ya + 0.85, Z0 - 0.92], 0.025, 6); [xa + 0.1, (xa + xb) / 2, xb - 0.1].forEach((x) => { const t = (x - xa) / (xb - xa); cy(g, m.metal, x, groundY(x, Z0 - 0.92), Z0 - 0.92, 0.02, ya + (yb - ya) * t + 0.85 - groundY(x, Z0 - 0.92), 6); }); }

  /* ---- inside ---- */
  // ceiling lights (lit day and night: the station is open)
  [[14.9, -25.2], [17.6, -25.2], [17.6, -24.0], [19.95, -25.1]].forEach(([x, z]) => bx(g, glow('#fff4e0', 1.5, { cat: 'shop', off: '#f0ece2' }), x - 0.5, x + 0.5, TOP - 0.09, TOP - 0.06, z - 0.12, z + 0.12, { cast: false }));
  // concourse: two ticket machines on the west wall under the fare chart + route map
  [-26.2, -25.35].forEach((z, i) => { const t = grp(g, X0 + 0.12, F, z, Math.PI / 2); rbx(t, m.machine, -0.35, 0.35, 0, 1.55, 0, 0.55, { r: 0.03 }); plane(t, glow('#bfe4ff', 0.9, { cat: 'shop' }), 0.42, 0.3, 0, 1.15, 0.56); rbx(t, m.ink, -0.25, 0.25, 0.75, 0.82, 0.5, 0.58, { r: 0.005 }); plane(t, basic(sign(`stTk${i}`, 128, 48, (c, w, h) => { c.fillStyle = '#2e7d5b'; c.fillRect(0, 0, w, h); txt(c, 'きっぷ', w / 2, h / 2 + 1, 26, '#fff', { font: FONT, weight: 800 }); })), 0.5, 0.18, 0, 1.68, 0.3); });
  plane(g, lit(fareChart(), 1.0), 1.5, 0.75, X0 + 0.07, F + 2.35, -25.8, Math.PI / 2);
  plane(g, basic(routeMap()), 1.2, 0.6, X0 + 0.07, F + 2.4, -24.25, Math.PI / 2);
  // the ticket gates (three cabinets, two lanes), their displays and IC readers lit
  for (let k = 0; k < 3; k++) {
    const x = GATE[0] + 0.1 + k * 0.9, z = -24.1;
    rbx(g, m.gate, x - 0.1, x + 0.1, F, F + 1.0, z - 0.6, z + 0.6, { r: 0.03 });
    rbx(g, m.ink, x - 0.1, x + 0.1, F + 1.0, F + 1.04, z - 0.6, z + 0.6, { r: 0.01 });
    bx(g, glow('#7fe0ff', 1.2, { cat: 'shop' }), x - 0.08, x + 0.08, F + 1.04, F + 1.05, z - 0.55, z - 0.4, { cast: false });
    bx(g, glow(k % 2 ? '#7fff9a' : '#7fe0ff', 1.4, { cat: 'shop' }), x - 0.105, x + 0.105, F + 0.8, F + 0.92, z - 0.62, z - 0.58, { cast: false });
  }
  plane(g, basic(sign('stGateSign', 512, 96, (c, w, h) => { c.fillStyle = '#1f2a38'; c.fillRect(0, 0, w, h); txt(c, '改札口  のりば →', w / 2, h / 2 + 2, 44, '#fff', { font: FONT, weight: 800 }); })), 1.6, 0.3, 15.2, F + 2.6, -24.75, Math.PI);
  // the ticket window of the office (in the partition, facing the concourse) + the office behind it
  rbx(g, m.post, 19.15, 19.45, F + 0.95, F + 1.02, -25.65, -24.55, { r: 0.01 }); // the counter
  { const q = plane(g, makeGlass(1.0, 1.0, 620, { alpha: 0.05, drops: 0 }), 1.0, 1.0, 19.2 - 0.07, F + 1.5, -25.1, -Math.PI / 2); q.renderOrder = 2; }
  plane(g, basic(sign('stWin', 384, 96, (c, w, h) => { c.fillStyle = '#2e7d5b'; c.fillRect(0, 0, w, h); txt(c, 'きっぷ・定期券', w / 2, h / 2 + 2, 40, '#fff', { font: FONT, weight: 800 }); })), 1.0, 0.25, 19.2 - 0.075, F + 2.2, -25.1, -Math.PI / 2);
  rbx(g, m.bench, 19.5, 20.85, F, F + 0.75, -26.6, -25.9, { r: 0.02 }); // the desk
  rbx(g, toon('#f4f4f0'), 19.7, 20.1, F + 0.75, F + 0.78, -26.5, -26.2, { r: 0.004, cast: false }); rbx(g, toon('#e8d9a8'), 20.2, 20.55, F + 0.75, F + 0.79, -26.45, -26.15, { r: 0.004, cast: false }); // papers
  { cy(g, m.ink, 20.65, F + 0.75, -26.3, 0.06, 0.02, 10); cyl2(g, m.ink, [20.65, F + 0.77, -26.3], [20.6, F + 1.12, -26.25], 0.012, 5); sph(g, glow('#ffe2a8', 1.6, { cat: 'shop' }), 0.06, 20.55, F + 1.12, -26.22); }
  { const ch = grp(g, 20.1, F, -25.6, 0); rbx(ch, m.ink, -0.2, 0.2, 0.42, 0.48, -0.2, 0.2, { r: 0.02 }); rbx(ch, m.ink, -0.2, 0.2, 0.48, 0.9, 0.17, 0.21, { r: 0.02 }); cy(ch, m.metal, 0, 0, 0, 0.02, 0.42, 6); }
  rbx(g, toon('#c9ccd2'), X1 - 0.5, X1 - 0.08, F, F + 1.9, -24.6, -23.6, { r: 0.02 }); // a locker
  plane(g, basic(posterTex(1)), 0.4, 0.55, X1 - 0.07, F + 1.6, -25.0, -Math.PI / 2);
  // waiting room: benches along the walls, the timetable, the notice board, a clock
  [[16.5, -23.62, Math.PI], [18.2, -23.62, Math.PI]].forEach(([x, z, ry]) => { const b = grp(g, x, F, z, ry); rbx(b, m.bench, -0.55, 0.55, 0.42, 0.47, -0.2, 0.2, { r: 0.01 }); rbx(b, m.bench, -0.55, 0.55, 0.6, 0.9, -0.24, -0.2, { r: 0.01 }); [-0.48, 0.48].forEach((a) => rbx(b, m.metal, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { r: 0.004, cast: false })); });
  { const b = grp(g, 17.6, F, -26.75, Math.PI); rbx(b, m.bench, -0.9, 0.9, 0.42, 0.47, -0.2, 0.2, { r: 0.01 }); [-0.8, 0.8].forEach((a) => rbx(b, m.metal, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { r: 0.004, cast: false })); }
  plane(g, basic(timetable()), 0.6, 0.8, 19.2 - 0.075, F + 1.6, -23.9, -Math.PI / 2);
  plane(g, basic(notice()), 1.2, 0.9, 16.4, F + 1.6, Z1 - 0.07, Math.PI);
  { const cg = grp(g, 17.75, F + 2.55, Z1 - 0.07, Math.PI); plane(cg, basic(clockFace()), 0.36, 0.36, 0, 0, 0); U.clocks.push(cg); }
}

/* ---------------------------------------------------------------- the platform */
function platform(g, piles, U) {
  const m = mats(), { x0, x1, z0, z1 } = PLATFORM, top = DK;
  // the body (a concrete face to the track), the deck, the white edge, the tactile line, the back
  rbx(g, m.face, x0, x1, 0.12, top - 0.06, z0 + 0.05, z1, { r: 0.01, cast: false });
  rbx(g, m.deck, x0, x1, top - 0.06, top, z0, z1 - 0.28, { r: 0.004, tile: 1.0 });
  rbx(g, m.edge, x0, x1, top - 0.06, top + 0.004, z1 - 0.3, z1 + 0.04, { r: 0.006 }); // the white coping, a lip over the face
  rbx(g, m.tactile, x0 + 0.1, x1 - 0.1, top, top + 0.012, z1 - 0.85, z1 - 0.55, { r: 0.002, tile: 0.3, cast: false }); // the yellow tactile line
  rbx(g, m.tactile, 14.95, 15.25, top, top + 0.012, z0 + 0.4, z1 - 0.85, { r: 0.002, tile: 0.3, cast: false }); // the guide from the steps
  rbx(g, m.face, x0 - 0.02, x0, 0.12, top, z0, z1, { r: 0.005, cast: false });
  // steps up from the gate passage (building floor -> deck), handrails
  const n = 3, rise = (top - F) / n, tread = (z0 - Z1) / n;
  for (let k = 0; k < n; k++) rbx(g, m.deck, 14.25, 16.15, 0.12, F + rise * (k + 1), Z1 + k * tread, Z1 + (k + 1) * tread + 0.01, { r: 0.01, tile: 1.0 });
  [14.3, 16.1].forEach((x) => cyl2(g, m.metal, [x, F + 0.9, Z1 + 0.05], [x, top + 0.9, z0 + 0.1], 0.022, 6));
  // the fence along the back of the platform (open at the steps), with the town side's poster frames
  const fm = toon('#9aa1b0');
  [[x0 + 0.05, 14.2], [16.2, x1 - 0.05]].forEach(([a, b]) => { const k = Math.max(1, Math.round((b - a) / 1.2)); for (let i = 0; i <= k; i++) { const x = a + ((b - a) * i) / k; cy(g, fm, x, top, z0 + 0.06, 0.025, 1.05, 6); } [0.5, 1.0].forEach((h) => cyl2(g, fm, [a, top + h, z0 + 0.06], [b, top + h, z0 + 0.06], 0.018, 5)); });
  // the canopy: painted steel posts + beams, a metal mono-pitch roof, lights, the gutter
  const cx0 = 14.0, cx1 = 21.3, cz0 = z0 - 0.05, cz1 = z1 - 0.55, yH = top + 2.85, yL = top + 2.62;
  [14.2, 16.55, 18.9, 21.1].forEach((x) => { cy(g, m.steel, x, top, -22.25, 0.07, yH - top - 0.05, 10); cyl2(g, m.steel, [x, yH - 0.1, cz0 + 0.1], [x, yL - 0.08, cz1 - 0.05], 0.05, 6); });
  { const L = Math.hypot(cz1 - cz0, yH - yL), geo = new THREE.BoxGeometry(cx1 - cx0, 0.06, L + 0.1); const r = new THREE.Mesh(geo, m.roofMetal); r.position.set((cx0 + cx1) / 2, (yH + yL) / 2, (cz0 + cz1) / 2); r.rotation.x = Math.atan2(yH - yL, cz1 - cz0); r.castShadow = r.receiveShadow = true; g.add(r);
    rbx(g, m.white, cx0, cx1, yL - 0.16, yL - 0.02, cz1 - 0.02, cz1 + 0.06, { r: 0.01 }); // the fascia
    cyl2(g, toon('#c3c2bc'), [cx0, yL - 0.06, cz1 + 0.1], [cx1, yL - 0.06, cz1 + 0.1], 0.045, 8);
    piles.push({ id: 'stPlatform', a: [cx1, cz1], b: [cx0, cz1], n: [0, 1], D: cz1 - cz0, y: yH + 0.04, drop: yH - yL, w: { petal: 0.4, leaf: 0.5 }, snow: 0.12 }); }
  [15.3, 17.7, 20.1].forEach((x) => { bx(g, glow('#fff3dc', 1.6, { cat: 'lamp', off: '#e6e2d8' }), x - 0.55, x + 0.55, yL + 0.02, yL + 0.05, -21.6, -21.45, { cast: false }); halo(g, x, yL - 0.1, -21.5, '#ffe2b0', 2.0, 0.28, 'lamp'); });
  // the station name board (both faces), the platform number + departure board + clock hanging from the canopy
  { const b = grp(g, 17.7, top, -22.3, 0); [-0.95, 0.95].forEach((a) => cy(b, m.steel, a, 0, 0, 0.045, 2.2, 8)); rbx(b, m.steel, -1.05, 1.05, 1.15, 2.25, -0.05, 0.05, { r: 0.01 }); const mat = lit(nameBoard(), 1.05); plane(b, mat, 2.0, 1.0, 0, 1.7, 0.056); plane(b, mat, 2.0, 1.0, 0, 1.7, -0.056, Math.PI); }
  { const h = grp(g, 15.9, yL - 0.62, -21.3, 0); [-0.5, 0.5].forEach((a) => cyl2(h, m.metal, [a, 0.2, 0], [a, 0.6, 0], 0.012, 4)); rbx(h, m.ink, -0.62, 0.62, -0.2, 0.2, -0.04, 0.04, { r: 0.01 }); const nm = basic(platformNo()); plane(h, nm, 1.2, 0.37, 0, 0, 0.045); plane(h, nm, 1.2, 0.37, 0, 0, -0.045, Math.PI); }
  { // the departure board: three lines that change every few seconds (amber LED look)
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const pages = [['普通  みなと', '15:42', '1'], ['Local  Minato', '15:42', '1'], ['普通  うみかぜ', '15:57', '1'], ['ワンマン 前乗り', 'ドアは手で', '']];
    const draw = (k) => { const c = cv.getContext('2d'); c.fillStyle = '#121212'; c.fillRect(0, 0, 512, 128); const [a, t, n] = pages[k % pages.length]; txt(c, '次発  Next', 70, 30, 22, '#9fdc7a', { font: FONT, weight: 700 }); txt(c, a, 200, 84, 40, '#ffb347', { font: FONT, weight: 800 }); txt(c, t, 410, 84, 40, '#ffb347', { font: FONT, weight: 800 }); if (n) txt(c, n + '番線', 470, 30, 20, '#9fdc7a', { font: FONT, weight: 700 }); tex.needsUpdate = true; };
    draw(0); U.board = { draw, page: 0, t: 0 };
    const h = grp(g, 19.6, yL - 0.62, -21.3, 0); [-0.5, 0.5].forEach((a) => cyl2(h, m.metal, [a, 0.2, 0], [a, 0.6, 0], 0.012, 4)); rbx(h, m.ink, -0.66, 0.66, -0.2, 0.2, -0.05, 0.05, { r: 0.01 });
    const lm = glow('#ffffff', 1.0, { map: tex, cat: 'shop', off: '#3a3a3a' }); plane(h, lm, 1.24, 0.32, 0, 0, 0.056); plane(h, lm, 1.24, 0.32, 0, 0, -0.056, Math.PI);
  }
  { const cg = grp(g, 14.65, yL - 0.42, -21.15, 0); cyl2(cg, m.metal, [0, 0.2, 0], [0, 0.42, 0], 0.012, 4); cy(cg, m.ink, 0, -0.02, 0, 0.21, 0.08, 24).rotation.x = Math.PI / 2; plane(cg, basic(clockFace()), 0.36, 0.36, 0, 0, 0.045); const b = plane(cg, basic(clockFace()), 0.36, 0.36, 0, 0, -0.045, Math.PI); U.clocks.push(cg); void b; }
  // benches under the canopy facing the track, a vending machine, bins, a timetable on the back fence, a lamp post at the east end
  [16.75, 19.05].forEach((x) => { const b = grp(g, x, top, -21.9, 0); rbx(b, m.bench, -0.6, 0.6, 0.42, 0.47, -0.2, 0.2, { r: 0.01 }); rbx(b, m.bench, -0.6, 0.6, 0.55, 0.85, -0.24, -0.2, { r: 0.01 }); [-0.5, 0.5].forEach((a) => rbx(b, m.metal, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { r: 0.004, cast: false })); });
  vendingMachine(grp(g, 0, top - 0.15, 0), 20.25, -22.15, 0, 1, 41, true);
  trashBins(grp(g, 0, top - 0.15, 0), 13.55, -22.3, 0);
  { const b = grp(g, 13.85, top, z0 + 0.12, 0); rbx(b, m.steel, -0.38, 0.38, 0.9, 1.95, -0.03, 0.03, { r: 0.01 }); plane(b, basic(timetable()), 0.66, 0.9, 0, 1.42, 0.035); [-0.33, 0.33].forEach((a) => cy(b, m.steel, a, 0, 0, 0.025, 0.95, 6)); }
  streetLamp(grp(g, 0, top - 0.15, 0), x1 - 0.15, -22.48, 0, 1, 3.2, 0.5, '#fff1d6', 0, null);
  // the platform end: a gate with the 関係者以外立入禁止 plate
  rbx(g, toon('#e8e2d4'), x1 - 0.06, x1 - 0.02, top, top + 1.0, z0 + 0.1, z1 - 0.4, { r: 0.004 });
  plane(g, basic(sign('stKeepOut', 256, 96, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b'; c.fillRect(0, 0, w, 26); txt(c, '関係者以外', w / 2, 52, 28, '#c0392b', { font: FONT, weight: 800 }); txt(c, '立入禁止', w / 2, 82, 26, '#1d2a3a', { font: FONT, weight: 800 }); })), 0.42, 0.16, x1 + 0.005, top + 0.75, -21.5, Math.PI / 2);
  wetPass([m.deck, m.edge]);
}

/* ---------------------------------------------------------------- the forecourt */
function forecourt(g, piles, U) {
  const m = mats(), gy = groundY, st = (x, z) => grp(g, 0, gy(x, z) - 0.15, 0); // street.js props stand at y 0.15
  // the covered bicycle park (east of the building)
  {
    const a0 = 21.7, a1 = 25.0, b0 = -28.9, b1 = -25.7, y = gy(23.3, -27.3);
    [a0 + 0.1, (a0 + a1) / 2, a1 - 0.1].forEach((x) => cy(g, m.steel, x, y, b0 + 0.1, 0.05, 2.2, 8));
    rbx(g, m.roofMetal, a0 - 0.1, a1 + 0.1, y + 2.2, y + 2.26, b0 - 0.1, b1 + 0.15, { r: 0.01 });
    cyl2(g, m.steel, [a0, y + 2.18, b0 + 0.1], [a1, y + 2.18, b0 + 0.1], 0.04, 6);
    for (let i = 0; i < 6; i++) { const x = a0 + 0.35 + i * 0.52; cyl2(g, m.metal, [x, y, b0 + 0.5], [x, y + 0.4, b0 + 0.5], 0.015, 4); cyl2(g, m.metal, [x, y + 0.4, b0 + 0.5], [x, y + 0.4, b0 + 1.3], 0.015, 4); cyl2(g, m.metal, [x, y, b0 + 1.3], [x, y + 0.4, b0 + 1.3], 0.015, 4); }
    ['#3a8fb8', '#c43a2e', '#e8e2d4', '#6c8a3a', '#2f2e38', '#f2b53c'].forEach((c, i) => { if (i === 4) return; bicycle(st(a0 + 0.35 + i * 0.52, b0 + 0.9), a0 + 0.35 + i * 0.52, b0 + 0.9, 0, c, 0.0); });
    plane(g, basic(sign('stBike', 384, 96, (c, w, h) => { c.fillStyle = '#2f5a8a'; c.fillRect(0, 0, w, h); txt(c, '駐輪場  Bicycle Parking', w / 2, h / 2 + 2, 32, '#fff', { font: FONT, weight: 800 }); })), 1.6, 0.4, (a0 + a1) / 2, y + 2.0, b0 + 0.05, Math.PI);
    piles.push({ id: 'stBikeRoof', a: [a0, b0 - 0.1], b: [a1, b0 - 0.1], n: [0, 1], D: b1 - b0 + 0.25, y: y + 2.27, drop: 0.01, w: { petal: 0.4, leaf: 0.5 }, snow: 0.1 });
  }
  // the round flower bed in the forecourt with the clock post, benches round it, a young tree
  {
    const cx = 17.2, cz = -30.6, y = gy(cx, cz);
    cy(g, m.stone, cx, y, cz, 1.25, 0.32, 40);
    cy(g, toon('#5a4636'), cx, y + 0.32, cz, 1.12, 0.02, 40, { cast: false });
    const R = rng(52);
    for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = 0.25 + R() * 0.8, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sph(g, toon(i % 3 ? '#4f7f46' : '#5f8a48'), 0.13, x, y + 0.42, z, 1.2, 0.8, 1.2); sph(g, toon(['#f3a8be', '#ffffff', '#f2d23a', '#e8674f', '#b28ad8'][i % 5]), 0.045, x, y + 0.52, z); }
    cy(g, m.ink, cx, y + 0.32, cz, 0.06, 2.6, 10);
    const cg = grp(g, cx, y + 3.05, cz, 0); [0, Math.PI].forEach((ry) => { const f = grp(cg, 0, 0, 0, ry); cy(f, m.ink, 0, -0.03, 0.03, 0.27, 0.06, 24).rotation.x = Math.PI / 2; plane(f, basic(clockFace()), 0.46, 0.46, 0, 0, 0.065); }); U.clocks.push(cg);
    [[cx, cz + 2.0, Math.PI], [cx - 2.0, cz, Math.PI / 2], [cx + 2.0, cz, -Math.PI / 2]].forEach(([x, z, ry]) => { const b = grp(g, x, gy(x, z), z, ry); rbx(b, m.bench, -0.7, 0.7, 0.42, 0.47, -0.2, 0.2, { r: 0.01 }); rbx(b, m.bench, -0.7, 0.7, 0.55, 0.85, -0.24, -0.2, { r: 0.01 }); [-0.6, 0.6].forEach((a) => rbx(b, m.metal, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.18, { r: 0.004, cast: false })); });
  }
  // planters along the front, a tree in a pit by the bus stop, low shrubs at the block edge
  [[19.75, -27.35], [20.65, -27.35]].forEach(([x, z], i) => { const y = gy(x, z); rbx(g, m.bench, x - 0.4, x + 0.4, y, y + 0.4, z - 0.2, z + 0.2, { r: 0.02 }); for (let k = 0; k < 4; k++) { sph(g, toon('#4f7f46'), 0.12, x - 0.3 + k * 0.2, y + 0.48, z, 1, 0.8, 1); sph(g, toon(['#f3a8be', '#f2d23a', '#ffffff'][(i + k) % 3]), 0.04, x - 0.28 + k * 0.2, y + 0.58, z); } });
  { const t = makeTree({ seed: 271, height: 3.2, spread: 0.9, palette: 'deep', dens: 0.85 }); t.position.set(13.1, gy(13.1, -33.0), -33.0); g.add(t); cy(g, toon('#5a4636'), 13.1, gy(13.1, -33.0) + 0.01, -33.0, 0.55, 0.02, 20, { cast: false }); }
  [[12.6, -33.9], [12.6, -34.8], [21.2, -32.8]].forEach(([x, z], i) => { const sb = makeShrub({ seed: 290 + i, width: 1.0, height: 0.7, palette: 'deep' }); sb.position.set(x, gy(x, z), z); g.add(sb); });
  // vending machines + bins by the west wall (facing the road), the umbrella stand + post box by the entrance
  vendingMachine(st(12.95, -25.9), 12.95, -25.9, -Math.PI / 2, 0, 42, true);
  vendingMachine(st(12.95, -24.85), 12.95, -24.85, -Math.PI / 2, 2, 43, true);
  trashBins(st(12.85, -26.95), 12.85, -26.95, -Math.PI / 2);
  { const x = 15.75, z = Z0 + 0.4, y = F; const b = grp(g, x, y, z, Math.PI); /* the umbrella stand, just inside the doors */ rbx(b, m.metal, -0.3, 0.3, 0, 0.55, -0.12, 0.12, { r: 0.01 }); ['#2f5a8a', '#e8674f', '#f2b53c', '#2f2e38', '#6c8a3a'].forEach((c, k) => { cyl2(b, toon(c), [-0.22 + k * 0.11, 0.1, 0], [-0.24 + k * 0.11, 0.85, 0.02], 0.025, 6); sph(b, toon(c), 0.035, -0.24 + k * 0.11, 0.86, 0.02); }); plane(b, basic(sign('stUmb', 256, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); txt(c, 'おかし傘', w / 2, h / 2 + 2, 30, '#2f5a8a', { font: FONT, weight: 800 }); })), 0.5, 0.12, 0, 0.42, 0.125); }
  { const x = 13.15, z = -27.7, y = gy(x, z); const b = grp(g, x, y, z, -Math.PI / 2); cy(b, toon('#c43a2e'), 0, 0, 0, 0.2, 1.1, 16); cy(b, toon('#c43a2e'), 0, 1.1, 0, 0.23, 0.1, 16); rbx(b, m.ink, -0.13, 0.13, 0.82, 0.86, 0.17, 0.21, { r: 0.004 }); }
  // the bus stop on the road edge, the guide map, the finger-post, notice + poster boards
  { const x = 12.45, z = -28.6, y = gy(x, z); const b = grp(g, x, y, z, -Math.PI / 2); cy(b, m.metal, 0, 0, 0, 0.18, 0.12, 14); cy(b, m.white, 0, 0.12, 0, 0.035, 2.0, 8); const s = basic(busStop()); plane(b, s, 0.42, 0.42, 0, 2.15, 0.03); plane(b, s, 0.42, 0.42, 0, 2.15, -0.03, Math.PI); rbx(b, m.white, -0.18, 0.18, 1.1, 1.6, 0.04, 0.07, { r: 0.004 }); plane(b, basic(timetable()), 0.32, 0.44, 0, 1.35, 0.075); }
  { const x = 14.6, z = -29.4, y = gy(x, z); const b = grp(g, x, y, z, -Math.PI / 2 + 0.3); [-0.55, 0.55].forEach((a) => cy(b, m.steel, a, 0, 0, 0.04, 1.6, 8)); rbx(b, m.steel, -0.62, 0.62, 0.75, 1.6, -0.03, 0.03, { r: 0.01 }); plane(b, lit(guideMap(), 0.95), 1.15, 0.8, 0, 1.18, 0.035); rbx(b, m.roofMetal, -0.7, 0.7, 1.6, 1.66, -0.12, 0.12, { r: 0.01 }); }
  { const x = 12.6, z = -30.1, y = gy(x, z); cy(g, m.ink, x, y, z, 0.05, 2.5, 8); [['星空神社 →', 0.2, 2.25, 0], ['← 海岸通り', -0.2, 1.95, 1], ['星空湖 →', 1.4, 1.65, 0]].forEach(([s, ry, h, f]) => { const sg = grp(g, x, y + h, z, ry - Math.PI / 2); const mt = basic(fingerTex(s, !!f)); mt.transparent = true; plane(sg, mt, 0.8, 0.15, 0.4 * (f ? -1 : 1), 0, 0.03); plane(sg, mt, 0.8, 0.15, 0.4 * (f ? -1 : 1), 0, -0.03, Math.PI); }); }
  { const x = 12.55, z = -32.2, y = gy(x, z); const b = grp(g, x, y, z, -Math.PI / 2); [-0.7, 0.7].forEach((a) => cy(b, m.post, a, 0, 0, 0.05, 1.9, 8)); rbx(b, m.post, -0.78, 0.78, 0.85, 1.85, -0.04, 0.04, { r: 0.01 }); plane(b, basic(notice()), 1.45, 0.92, 0, 1.35, 0.045); rbx(b, m.roofMetal, -0.85, 0.85, 1.85, 1.9, -0.14, 0.14, { r: 0.01 }); }
  { const x = X0 - 0.07, z = -23.95; [0, 1].forEach((k) => { rbx(g, m.white, x - 0.03, x, F + 1.05, F + 2.0, z - 0.32 - k * 0.0, z + 0.32, { r: 0.006 }); }); plane(g, basic(posterTex(0)), 0.55, 0.85, x - 0.035, F + 1.52, z, -Math.PI / 2); } // the poster frame on the west wall
  // street lamps, the utility pole with the station's drop + a line to the platform canopy
  streetLamp(st(12.7, -27.6), 12.7, -27.6, 1, 0, 4.4, 1.2, '#ffe0a8', 0, null);
  streetLamp(st(21.6, -32.3), 21.6, -32.3, -1, 0, 4.4, 1.2, '#dfeaff', 0, null);
  utilityPole(st(12.55, -35.6), 12.55, -35.6, 7.4, 'z');
  wire(g, [12.55, gy(12.55, -35.6) + 6.4, -35.6], [X0 + 0.3, TOP + 0.9, Z0 - 0.3], 0.5, 0.013);
}

/* ---------------------------------------------------------------- build */
export function buildStation(parent) {
  const g = grp(parent);
  g.name = 'station';
  const piles = [], U = { doors: [], clocks: [], board: null }; // (clocks: their faces show a quiet 3:42)
  building(g, piles, U);
  platform(g, piles, U);
  forecourt(g, piles, U);
  (reg.extraRoofs ||= []).push(...piles);

  // a little life: the doors slide open now and then, the departure board turns its pages, the clocks keep time
  const doorAt = (t) => { const c = t % 17; return c < 6 ? 0 : c < 6.7 ? (c - 6) / 0.7 : c < 9.5 ? 1 : c < 10.2 ? 1 - (c - 9.5) / 0.7 : 0; };
  reg.updaters.push((t, dt) => {
    const o = doorAt(t) * 0.72;
    U.doors.forEach((d, k) => { d.position.x = 14.4 + k * 0.8 + (k ? o : -o); });
    if (U.board) { U.board.t += dt || 0.016; if (U.board.t > 4) { U.board.t = 0; U.board.draw(++U.board.page); } }
  });
  reg.station = { g, U };
  return g;
}
