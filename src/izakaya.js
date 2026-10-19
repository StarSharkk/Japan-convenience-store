import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect } from './core.js';
import { makeGlass } from './fx.js';
import { T, posterTex } from './tex.js';
import { bicycle } from './street.js';

/* ====================================================================================================
   Izakaya next to the convenience store (3.5 m wide, 2 storeys, tiled gable roof)

   south  = FRONT  (same side as the shop front)  -> reference 1: wooden facade, daruma, big wooden sign,
            menu plaques, lantern row, white noren, lit menu boards, chalkboard, spot lights
   east   = alley side (visible from the street)  -> reference 2: wooden street-shop side: lean-to tile eave,
            lantern string, lattice windows, hanging sign, bicycle, A-frame sign, steel stairs
   west / north = lived-in too (door, lanterns, windows, kitchen duct, AC, crates), no blank walls
   ==================================================================================================== */

const MINCHO = '"Hiragino Mincho ProN","Yu Mincho","Kaiti SC","STKaiti","Songti SC",serif';
const Y0 = 0.15;
export const IZA = { X0: -12, X1: -8.5, Z0: -7.2, Z1: 4.3, H: 6.6 }; // front pushed 0.8 m south: more side wall, deeper front yard use

/* ---------------------------------------------------------------- textures */
let _wood;
function woodBase() {
  if (_wood) return _wood;
  _wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8b5a34'; g.fillRect(0, 0, w, h);
    const R = rng(7);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = `rgba(${R() < 0.5 ? '255,200,140' : '40,20,8'},${0.06 + R() * 0.08})`;
      g.fillRect(x, 0, 32, h);
      g.fillStyle = 'rgba(30,14,6,0.55)'; g.fillRect(x, 0, 2.5, h);
      for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(50,24,10,${0.1 + R() * 0.12})`; g.lineWidth = 1; g.beginPath(); const gx = x + 4 + R() * 24; g.moveTo(gx, 0); g.bezierCurveTo(gx + R() * 6 - 3, h * 0.3, gx + R() * 6 - 3, h * 0.7, gx + R() * 4 - 2, h); g.stroke(); }
    }
  }, { repeat: true });
  return _wood;
}
function woodMat(rx, ry, lit = 0.5, tint = '#ffffff') {
  const t = woodBase().clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return toon(tint, { map: t, lit, nocache: true });
}
let _plaster;
function plasterMat(rx, ry) {
  if (!_plaster) {
    _plaster = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#e4d9c2'; g.fillRect(0, 0, w, h);
      const R = rng(19);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,248,230' : '120,100,70'},${0.03 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 14 + R() * 40, 2 + R() * 6); }
    }, { repeat: true });
  }
  const t = _plaster.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return toon('#fff3e0', { map: t, lit: 0.6, nocache: true });
}
let _tile;
function tileMat(rx, ry) {
  if (!_tile) {
    _tile = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#343b5c'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = '#434b72'; g.beginPath(); g.arc(x + 8, y + 2, 9, 0, Math.PI); g.fill();
          g.strokeStyle = '#6a739c'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + 8, y + 2, 9, 0.15, Math.PI - 0.15); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,10,0.35)'; g.fillRect(0, y + 13, w, 3);
      }
    }, { repeat: true });
  }
  const t = _tile.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return toon('#ffffff', { map: t, lit: 0.25, nocache: true });
}
const brush = (g, s, x, y, size, color = '#16110e', o = {}) => {
  g.font = `900 ${size}px ${MINCHO}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = size * 0.07; g.strokeStyle = color;
  g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
};
const vbrush = (g, s, x, y, size, step, color = '#16110e') => [...s].forEach((c, i) => brush(g, c, x, y + i * step, size, color));

function signBoardTex(text, w = 1024, h = 560, seal = true) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#c99a5a'; g.fillRect(0, 0, w, h);
    const R = rng(3);
    for (let x = 0; x < w; x += w / 7) { g.fillStyle = `rgba(${R() < 0.5 ? '255,220,160' : '70,40,15'},0.14)`; g.fillRect(x, 0, w / 7, h); g.fillStyle = 'rgba(60,30,10,0.5)'; g.fillRect(x, 0, 3, h); }
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(80,45,15,${0.08 + R() * 0.1})`; g.lineWidth = 1; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 8 - 4, w * 0.7, y + R() * 8 - 4, w, y + R() * 6 - 3); g.stroke(); }
    g.strokeStyle = '#3a2314'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    brush(g, text, w / 2, h / 2 + 6, Math.min(h * 0.74, (w * 0.86) / text.length));
    if (seal) { g.fillStyle = '#c4261d'; roundRect(g, w - 120, h - 150, 70, 100, 6); g.fill(); g.fillStyle = '#fff'; g.font = `900 34px ${MINCHO}`; g.textAlign = 'center'; g.fillText('居', w - 85, h - 120); g.fillText('酒', w - 85, h - 82); }
  });
}
function plaqueTex(text) {
  return canvasTex(128, 360, (g, w, h) => {
    g.fillStyle = '#d2a566'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
    g.strokeStyle = '#4b2e17'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const n = [...text].length;
    vbrush(g, text, w / 2, h / 2 - ((n - 1) * Math.min(76, 270 / n)) / 2, Math.min(70, 240 / n + 18), Math.min(76, 270 / n));
  });
}
function norenTex(i) {
  return canvasTex(256, 380, (g, w, h) => {
    g.fillStyle = '#f2ecde'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,100,70,0.12)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.5);
    g.fillStyle = 'rgba(70,50,30,0.35)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
    brush(g, '居酒屋'[i], w / 2, h * 0.5, 190);
    if (i === 2) { g.fillStyle = '#c4261d'; roundRect(g, w - 74, h - 126, 44, 76, 5); g.fill(); g.fillStyle = '#fff'; g.font = `900 24px ${MINCHO}`; g.textAlign = 'center'; g.fillText('居', w - 52, h - 100); g.fillText('酒', w - 52, h - 72); }
  });
}
function foodBoardTex(w = 360, h = 520, header = '居酒屋') {
  return canvasTex(w, h, (g) => {
    const R = rng(w + h);
    g.fillStyle = '#f7efe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b4221b'; g.fillRect(0, 0, w, 58);
    g.fillStyle = '#fff'; g.font = `900 40px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(header, w / 2, 30);
    const cols = Math.max(2, Math.floor(w / 110)), rows = Math.floor((h - 70) / 96);
    const food = ['#d9782b', '#c43d2f', '#d9a441', '#6b9a45', '#e6c78a', '#8a4a2b', '#e8a8a0'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = 10 + c * ((w - 20) / cols), y = 68 + r * 96, tw = (w - 20) / cols - 8;
      g.fillStyle = '#fff'; roundRect(g, x, y, tw, 84, 8); g.fill();
      g.fillStyle = '#e9e2d4'; g.beginPath(); g.ellipse(x + tw / 2, y + 40, tw * 0.4, 28, 0, 0, 7); g.fill();
      for (let k = 0; k < 4; k++) { g.fillStyle = food[(R() * food.length) | 0]; g.beginPath(); g.ellipse(x + tw / 2 + (R() - 0.5) * tw * 0.4, y + 40 + (R() - 0.5) * 22, 9 + R() * 9, 7 + R() * 6, R() * 3, 0, 7); g.fill(); }
      g.fillStyle = '#b4221b'; g.fillRect(x + 4, y + 70, tw - 8, 10);
    }
  });
}
function chalkTex() {
  return canvasTex(256, 400, (g, w, h) => {
    g.fillStyle = '#1b2420'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f3efe0'; g.font = `800 34px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('本日のおすすめ', w / 2, 52);
    ['焼き鳥盛り', '刺身三種', '唐揚げ', 'だし巻き', '日本酒'].forEach((t, i) => {
      g.fillStyle = '#f3efe0'; g.font = `700 28px ${MINCHO}`; g.textAlign = 'left'; g.fillText(t, 26, 118 + i * 52);
      g.fillStyle = '#ff6a5a'; g.textAlign = 'right'; g.fillText(`${480 + i * 40}`, w - 24, 118 + i * 52);
    });
  });
}
function darumaTex() {
  return canvasTex(512, 660, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const k = '#14100e';
    // brows
    g.fillStyle = k;
    [[-1, 1], [1, 1]].forEach(([s]) => {
      g.beginPath(); g.moveTo(w / 2 + s * 40, 168); g.bezierCurveTo(w / 2 + s * 100, 120, w / 2 + s * 170, 120, w / 2 + s * 210, 160);
      g.bezierCurveTo(w / 2 + s * 160, 150, w / 2 + s * 100, 160, w / 2 + s * 46, 204); g.closePath(); g.fill();
    });
    // eyes
    [[-1], [1]].forEach(([s]) => {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2 + s * 92, 232, 44, 38, 0, 0, 7); g.fill();
      g.lineWidth = 6; g.strokeStyle = k; g.stroke();
      g.fillStyle = k; g.beginPath(); g.arc(w / 2 + s * 92 - s * 6, 236, 21, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + s * 92 - s * 12, 228, 7, 0, 7); g.fill();
    });
    // nose + cheeks (whisker swirls)
    g.fillStyle = 'rgba(235,190,170,0.8)'; g.beginPath(); g.ellipse(w / 2, 296, 34, 28, 0, 0, 7); g.fill();
    g.strokeStyle = k; g.lineWidth = 7;
    [[-1], [1]].forEach(([s]) => {
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w / 2 + s * (70 + i * 6), 316 + i * 16); g.bezierCurveTo(w / 2 + s * (130 + i * 18), 300 + i * 20, w / 2 + s * (190 + i * 8), 330 + i * 18, w / 2 + s * (210 + i * 6), 370 + i * 12); g.stroke(); }
    });
    // smile
    g.strokeStyle = '#b4221b'; g.lineWidth = 9; g.beginPath(); g.moveTo(w / 2 - 80, 352); g.quadraticCurveTo(w / 2, 410, w / 2 + 80, 352); g.stroke();
    // belly character + stripes
    brush(g, '福', w / 2, 505, 190);
    g.fillStyle = k;
    [[-1], [1]].forEach(([s]) => { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(w / 2 + s * (150 + i * 36), 450 + i * 10); g.quadraticCurveTo(w / 2 + s * (200 + i * 30), 560, w / 2 + s * (150 + i * 40), 640 - i * 14); g.quadraticCurveTo(w / 2 + s * (150 + i * 30), 560, w / 2 + s * (150 + i * 36), 450 + i * 10); g.fill(); } });
  }, { aniso: 8 });
}
function lanternTex(text) {
  return canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    brush(g, text, 64, 64, text.length > 1 ? 44 : 84);
  });
}
function cafeTex() { // warm interior seen through the open door
  return canvasTex(256, 360, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffcf86'); gr.addColorStop(1, '#e9923f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,40,10,0.55)'; g.fillRect(0, h * 0.62, w, h * 0.38); // counter
    g.fillStyle = '#7a4a22'; g.fillRect(0, h * 0.6, w, 12);
    for (let i = 0; i < 9; i++) { g.fillStyle = ['#c43d2f', '#e6c78a', '#4a7a3a', '#d9a441'][i % 4]; roundRect(g, 18 + i * 26, h * 0.34 + (i % 3) * 6, 16, 52, 6); g.fill(); }
    g.fillStyle = 'rgba(60,30,10,0.5)'; g.fillRect(0, h * 0.3, w, 5);
  });
}

/* ---------------------------------------------------------------- helpers */
export function buildIzakaya(parent, drips) {
  const g = grp(parent);
  const { X0, X1, Z0, Z1, H } = IZA;
  const cx = (X0 + X1) / 2;
  const R = rng(61);

  const wood = toon('#6a4328', { lit: 0.42 });
  const woodD = toon('#3b2415', { lit: 0.3 });
  const plaster = toon('#c8bcaa', { lit: 0.2 });
  const roofTile = toon('#272c46');
  const iron = toon('#6f788c');

  // axis helpers: face = 's' (front, +z), 'e' (alley, +x), 'w' (-x), 'n' (-z). u runs along the face, o = outward offset
  const bxo = (f, u0, u1, y0, y1, o0, o1, mat, op) => {
    if (f === 's') return bx(g, mat, u0, u1, y0, y1, Z1 + o0, Z1 + o1, op);
    if (f === 'n') return bx(g, mat, u0, u1, y0, y1, Z0 - o1, Z0 - o0, op);
    if (f === 'e') return bx(g, mat, X1 + o0, X1 + o1, y0, y1, u0, u1, op);
    return bx(g, mat, X0 - o1, X0 - o0, y0, y1, u0, u1, op);
  };
  const plo = (f, w, h, u, y, o, mat, op = {}) => {
    if (f === 's') return pl(g, mat, w, h, u, y, Z1 + o, 0, 0, op);
    if (f === 'n') return pl(g, mat, w, h, u, y, Z0 - o, Math.PI, 0, op);
    if (f === 'e') return pl(g, mat, w, h, X1 + o, y, u, Math.PI / 2, 0, op);
    return pl(g, mat, w, h, X0 - o, y, u, -Math.PI / 2, 0, op);
  };
  const posOf = (f, u, o) => (f === 's' ? [u, Z1 + o] : f === 'n' ? [u, Z0 - o] : f === 'e' ? [X1 + o, u] : [X0 - o, u]);
  const L = (hex, k = 1.5) => {
    const c = new THREE.Color(hex).multiplyScalar(k);
    const m = new THREE.MeshBasicMaterial({ color: c });
    reg.emis.push({ m, base: c.clone(), cat: 'iza' }); // windows dim in daylight like every other emitter
    return m;
  };

  /* ---- structure ---- */
  bx(g, plaster, X0, X1, Y0, H, Z0, Z1);
  // wooden cladding on every face (planes with a planked texture)
  const clad = (f, len, u0) => {
    const m1 = f === 's' ? woodMat(len / 1.4, (H - 3.2) / 1.4) : plasterMat(len / 1.6, (H - 3.2) / 1.6);
    plo(f, len, H - 3.2, u0 + len / 2, 3.2 + (H - 3.2) / 2, 0.012, m1, { cast: false, recv: true });
    if (f !== 's') {
      // half-timber frame: posts every ~1.45 m, beam under the eave and a mid rail
      const n = Math.max(2, Math.round(len / 1.45));
      for (let i = 0; i <= n; i++) bxo(f, u0 + (len * i) / n - 0.05, u0 + (len * i) / n + 0.05, 3.3, H, 0.01, 0.075, woodD, { cast: false });
      bxo(f, u0, u0 + len, H - 0.22, H - 0.1, 0.01, 0.08, woodD, { cast: false });
      bxo(f, u0, u0 + len, 4.3, 4.37, 0.01, 0.075, woodD, { cast: false });
    }
    const m0 = woodMat(len / 1.4, 3.05 / 1.4, 0.4, '#d8c3a8');
    plo(f, len, 3.05, u0 + len / 2, Y0 + 3.05 / 2, 0.012, m0, { cast: false, recv: true });
  };
  clad('s', X1 - X0, X0);
  clad('e', Z1 - Z0, Z0);
  clad('w', Z1 - Z0, Z0);
  clad('n', X1 - X0, X0);
  // floor band + corner posts (dark timber frame)
  [['s', X0, X1], ['n', X0, X1]].forEach(([f]) => bxo(f, X0 - 0.04, X1 + 0.04, 3.14, 3.3, 0, 0.12, woodD));
  [['e', Z0, Z1], ['w', Z0, Z1]].forEach(([f]) => bxo(f, Z0 - 0.04, Z1 + 0.04, 3.14, 3.3, 0, 0.12, woodD));
  [X0, X1].forEach((x) => bx(g, woodD, x - 0.07, x + 0.07, Y0, H, Z1 - 0.02, Z1 + 0.13));
  [Z0, Z1].forEach((z) => { bx(g, woodD, X0 - 0.06, X0 + 0.07, Y0, H, z - 0.07, z + 0.07); bx(g, woodD, X1 - 0.07, X1 + 0.06, Y0, H, z - 0.07, z + 0.07); });

  /* ---- tiled gable roof (ridge north-south), wooden gable ends ---- */
  {
    const rx0 = X0 - 0.35, rx1 = X1 + 0.5, rz0 = Z0 - 0.4, rz1 = Z1 + 0.75;
    const sh = new THREE.Shape();
    sh.moveTo(rx0, 0); sh.lineTo(rx1, 0); sh.lineTo(cx + 0.075, 1.3); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: rz1 - rz0, bevelEnabled: false });
    geo.translate(0, H, rz0);
    const roof = new THREE.Mesh(geo, [woodMat(1, 1, 0.4), tileMat(3, 5)]);
    roof.castShadow = true; roof.receiveShadow = true;
    g.add(roof);
    bx(g, toon('#3d4466'), cx - 0.05, cx + 0.2, H + 1.28, H + 1.42, rz0 - 0.05, rz1 + 0.05);
    bx(g, woodD, rx0, rx1, H - 0.1, H + 0.05, rz1 - 0.05, rz1 + 0.05); // front bargeboard beam
    // round window in the gable (front)
    const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), L('#ffcf8a', 1.2));
    rw.rotation.x = Math.PI / 2; rw.position.set(cx, H + 0.55, Z1 + 0.78); g.add(rw);
    const rr = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 22), woodD.clone());
    rr.position.set(cx, H + 0.55, Z1 + 0.8); g.add(rr);
    cyl2(g, iron, [-10.2, H + 1.4, 0], [-10.2, H + 2.9, 0], 0.03, 5);
    [0.5, 0.95, 1.35].forEach((d, i) => cyl2(g, iron, [-10.55 - i * 0.04, H + 1.4 + d, 0], [-9.85 + i * 0.04, H + 1.4 + d, 0], 0.018, 4));
  }

  /* ==================================================================== FRONT (south) */
  {
    // lower tile eave projecting 1.0 m, with exposed rafters and a lantern rail
    const ez = Z1 + 1.05;
    bx(g, roofTile, X0 - 0.2, X1 + 0.35, 2.98, 3.14, Z1, ez);
    const eaveTop = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 0.55, 1.05), tileMat(3, 2));
    eaveTop.rotation.x = -Math.PI / 2; eaveTop.position.set((X0 + X1) / 2 + 0.075, 3.145, Z1 + 0.525); g.add(eaveTop);
    for (let x = X0 - 0.1; x < X1 + 0.3; x += 0.32) bx(g, woodD, x, x + 0.07, 2.88, 2.98, Z1, ez - 0.05, { cast: false });
    bx(g, woodD, X0 - 0.2, X1 + 0.35, 2.84, 2.98, ez - 0.07, ez);
    [X0 + 0.1, X1 - 0.05].forEach((x) => cy(g, woodD, x, Y0, ez - 0.12, 0.05, 2.72, 7));
    // door opening with warm interior, sliding lattice leaves
    const dx0 = -10.78, dx1 = -9.52;
    pl(g, new THREE.MeshBasicMaterial({ map: cafeTex(), color: new THREE.Color(1.25, 1.1, 0.85) }), dx1 - dx0, 2.1, (dx0 + dx1) / 2, 1.2, Z1 + 0.03, 0, 0);
    bx(g, woodD, dx0 - 0.08, dx0 + 0.02, Y0, 2.4, Z1, Z1 + 0.12); bx(g, woodD, dx1 - 0.02, dx1 + 0.08, Y0, 2.4, Z1, Z1 + 0.12);
    bx(g, woodD, dx0 - 0.08, dx1 + 0.08, 2.3, 2.42, Z1, Z1 + 0.12);
    // lattice door leaf (half open on the left)
    for (let i = 0; i < 4; i++) bx(g, woodD, dx0 + 0.02 + i * 0.07, dx0 + 0.05 + i * 0.07, Y0, 2.3, Z1 + 0.05, Z1 + 0.08, { cast: false });
    pl(g, makeGlass(1.2, 2.1, 31, { alpha: 0.02 }), 1.2, 2.1, (dx0 + dx1) / 2, 1.2, Z1 + 0.14, 0, 0, { noLine: true });
    // white noren: three panels with 居 酒 屋
    const norens = [];
    for (let i = 0; i < 3; i++) {
      const n = grp(g, dx0 + 0.02 + (i + 0.5) * ((dx1 - dx0 - 0.04) / 3), 2.32, Z1 + 0.24);
      const m = new THREE.Mesh(new THREE.PlaneGeometry((dx1 - dx0 - 0.04) / 3 - 0.01, 0.62), new THREE.MeshBasicMaterial({ map: norenTex(i), color: new THREE.Color(0.78, 0.72, 0.62), side: THREE.DoubleSide }));
      m.position.y = -0.31; n.add(m); n.userData.keep = true; norens.push(n);
    }
    cyl2(g, woodD, [dx0 - 0.05, 2.34, Z1 + 0.24], [dx1 + 0.05, 2.34, Z1 + 0.24], 0.02, 5);
    reg.updaters.push((t) => norens.forEach((n, i) => (n.rotation.x = Math.sin(t * 1.25 + i * 1.3) * 0.045)));

    // left menu window (lit photo board) and right small board
    const board = (x, w, h, y, tex) => {
      bx(g, woodD, x - w / 2 - 0.06, x + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, Z1, Z1 + 0.1);
      pl(g, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.1, 0.95) }), w, h, x, y, Z1 + 0.105, 0, 0);
    };
    board(-11.4, 1.0, 1.5, 1.7, foodBoardTex(360, 520));
    board(-9.0, 0.7, 1.15, 1.6, foodBoardTex(250, 410, 'おすすめ'));
    // tall wooden vertical sign (営業中) on a post by the door
    {
      const px = -9.42, pz = Z1 + 0.42;
      const t = canvasTex(96, 360, (c, w, h) => { c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4b2e17'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); vbrush(c, '営業中', w / 2, 70, 66, 92); });
      bx(g, woodD, px - 0.015, px + 0.015, 0.9, 2.65, pz - 0.02, pz + 0.02);
      pl(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.95, 0.9, 0.8) }), 0.26, 1.0, px, 1.9, pz + 0.03, 0, 0);
    }
    // lantern row (white paper chochin) + warm spot lights under the eave
    const lm = L('#fff0cc', 1.5);
    const capM = toon('#15110e');
    [-11.65, -10.95, -10.25, -9.55, -8.85].forEach((x, i) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), lm);
      l.scale.set(0.9, 1.15, 0.9); l.position.set(x, 2.58, ez - 0.2); g.add(l);
      cy(g, capM, x, 2.73, ez - 0.2, 0.07, 0.05, 8); cy(g, capM, x, 2.37, ez - 0.2, 0.07, 0.04, 8);
      pl(g, new THREE.MeshBasicMaterial({ map: lanternTex(i % 2 ? '居酒屋' : '酒'), transparent: true, depthWrite: false }), 0.24, 0.24, x, 2.58, ez - 0.2 + 0.15, 0, 0, { noLine: true });
    });
    halo(g, cx, 2.6, ez - 0.1, '#ffd9a0', 4.2, 0.32);
    [-11.5, -10.5, -9.5, -8.8].forEach((x) => { cy(g, capM, x, 2.8, Z1 + 0.5, 0.045, 0.06, 8, { cast: false }); cy(g, glow('#ffe7b0', 2.6), x, 2.77, Z1 + 0.5, 0.04, 0.02, 8, { cast: false }); });
    plight(g, '#ffc77a', 8, 7.5, cx, 2.3, Z1 + 1.4, 'izaFront');
    // red chochin accent at the left corner
    {
      const lm2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.34, 0.2) });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lm2); l.scale.set(0.9, 1.15, 0.9); l.position.set(-8.7, 1.55, Z1 + 0.62); g.add(l);
      cy(g, capM, -8.7, 1.75, Z1 + 0.62, 0.1, 0.06, 10); cy(g, capM, -8.7, 1.27, Z1 + 0.62, 0.1, 0.06, 10);
      halo(g, -8.7, 1.55, Z1 + 0.62, '#ff4a2a', 2.0, 0.55);
      plight(g, '#ff5a30', 5, 5.5, -8.7, 1.6, Z1 + 1.0, 'lantern');
    }
    // standing chalkboard menu
    {
      const a = grp(g, -10.0, Y0, Z1 + 1.35, 0.1);
      bx(a, woodD, -0.3, -0.26, 0, 1.0, -0.14, 0.14); bx(a, woodD, 0.26, 0.3, 0, 1.0, -0.14, 0.14);
      pl(a, new THREE.MeshBasicMaterial({ map: chalkTex(), color: new THREE.Color(0.85, 0.85, 0.82) }), 0.52, 0.8, 0, 0.55, 0.045, 0, 0);
      bx(a, woodD, -0.3, 0.3, 0.97, 1.02, -0.05, 0.05);
    }

    // ---- upper facade ----
    // giant daruma (left), big wooden sign (centre/right), menu plaques row, window band
    {
      const D = grp(g, -11.28, 4.85, Z1 + 0.5);
      // own, finer sphere: the shared 20x14 one showed facets on a body this large
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), toon('#d9d6cf', { lit: 0.18 }));
      body.scale.set(0.64, 0.64 * 1.22, 0.64 * 0.76); body.castShadow = body.receiveShadow = true; D.add(body);
      sph(D, toon('#c4c1ba', { lit: 0.15 }), 0.5, 0, -0.78, 0.0, 1.0, 0.16, 0.7); // silver base rim
      // face paint is wrapped onto the body (a flat card in front of the round daruma showed its rectangle
      // as an ink frame and floated off the body when seen from the side)
      const fg = new THREE.PlaneGeometry(1.16, 1.5, 40, 52);
      const pa = fg.attributes.position;
      const RX = 0.64, RY = 0.64 * 1.22, RZ = 0.64 * 0.76;
      for (let i = 0; i < pa.count; i++) {
        let x = pa.getX(i), y = pa.getY(i) - 0.02;
        let s2 = (x / RX) ** 2 + (y / RY) ** 2;
        if (s2 > 0.995) { const f = Math.sqrt(0.995 / s2); x *= f; y *= f; s2 = 0.995; } // paint past the rim folds onto the rim
        const z = RZ * Math.sqrt(1 - s2);
        // lift the paint a hair off the surface along the ellipsoid normal
        const nx = x / (RX * RX), ny = y / (RY * RY), nz = z / (RZ * RZ);
        const nl = Math.hypot(nx, ny, nz) || 1;
        pa.setXYZ(i, x + (nx / nl) * 0.004, y + (ny / nl) * 0.004, z + (nz / nl) * 0.004);
      }
      fg.computeVertexNormals();
      const face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: darumaTex(), transparent: true, color: new THREE.Color(0.8, 0.78, 0.74), depthWrite: false }));
      face.userData.noLine = true; // the body carries the silhouette ink; the paint itself never draws a frame
      D.add(face);
    }
    // sign board
    const sgn = grp(g, -9.62, 4.2, Z1);
    bx(sgn, woodD, -1.08, 1.08, -0.62, 0.62, 0, 0.1);
    pl(sgn, new THREE.MeshBasicMaterial({ map: signBoardTex('居酒屋'), color: new THREE.Color(1.05, 0.98, 0.88) }), 2.0, 1.1, 0, 0, 0.105, 0, 0);
    // menu plaques row
    ['焼き鳥', '刺身', '枝豆', '唐揚げ', 'だし巻き', '日本酒'].forEach((t, i) => {
      const x = -11.45 + i * 0.56 + 0.1;
      bx(g, woodD, x - 0.17, x + 0.17, 5.28, 6.1, Z1, Z1 + 0.06);
      pl(g, new THREE.MeshBasicMaterial({ map: plaqueTex(t), color: new THREE.Color(1.0, 0.92, 0.78) }), 0.3, 0.76, x, 5.69, Z1 + 0.065, 0, 0);
    });
    // spot lights over the sign
    [-10.6, -9.7, -8.8].forEach((x) => { bx(g, capM, x - 0.06, x + 0.06, 5.08, 5.2, Z1 + 0.05, Z1 + 0.22, { cast: false }); bx(g, glow('#ffe7b0', 2.6), x - 0.04, x + 0.04, 5.05, 5.08, Z1 + 0.08, Z1 + 0.2, { cast: false }); });
    // upper window band with lattice
    [[-11.55, 0.8], [-10.25, 0.9], [-9.0, 0.8]].forEach(([x, w]) => {
      bx(g, woodD, x - w / 2 - 0.06, x + w / 2 + 0.06, 6.0, 6.45, Z1, Z1 + 0.08);
      pl(g, L('#ffcf86', 1.0), w, 0.37, x, 6.225, Z1 + 0.085, 0, 0);
      for (let k = 1; k < 4; k++) bx(g, woodD, x - w / 2 + (k * w) / 4 - 0.012, x - w / 2 + (k * w) / 4 + 0.012, 6.0, 6.45, Z1 + 0.085, Z1 + 0.1, { cast: false });
    });
  }

  /* ==================================================================== EAST (alley) side */
  {
    const f = 'e';
    // lean-to tile eave over the shop part of the alley wall (stops before the stair landing)
    const ez0 = Z0 + 0.1, ez1 = -1.95, ew = 0.85;
    bx(g, roofTile, X1, X1 + ew, 2.98, 3.14, ez0, ez1);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(ez1 - ez0, ew), tileMat(3, 1));
    top.rotation.set(-Math.PI / 2, 0, Math.PI / 2); top.position.set(X1 + ew / 2, 3.145, (ez0 + ez1) / 2); g.add(top);
    for (let z = ez0 + 0.1; z < ez1; z += 0.34) bx(g, woodD, X1, X1 + ew - 0.05, 2.88, 2.98, z, z + 0.07, { cast: false });
    bx(g, woodD, X1 + ew - 0.06, X1 + ew + 0.01, 2.84, 2.98, ez0, ez1);
    // lantern string
    const lm = L('#fff0cc', 1.4);
    for (let z = -6.6; z < ez1 - 0.2; z += 0.62) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), lm); l.scale.set(0.9, 1.15, 0.9); l.position.set(X1 + ew - 0.2, 2.6, z); g.add(l);
      cy(g, toon('#15110e'), X1 + ew - 0.2, 2.73, z, 0.06, 0.05, 8);
    }
    halo(g, X1 + 0.6, 2.6, -4.2, '#ffd9a0', 3.6, 0.3);
    // shop wall: lattice windows (shoji glow), sliding door, noren
    const latticeWin = (z, y, w, h, hex = '#ffc980') => {
      bxo(f, z - w / 2 - 0.06, z + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.09, woodD);
      plo(f, w, h, z, y, 0.095, L(hex, 1.05));
      for (let k = 1; k < 4; k++) bxo(f, z - w / 2 + (k * w) / 4 - 0.012, z - w / 2 + (k * w) / 4 + 0.012, y - h / 2, y + h / 2, 0.095, 0.115, woodD, { cast: false });
      for (let k = 1; k < 3; k++) bxo(f, z - w / 2, z + w / 2, y - h / 2 + (k * h) / 3 - 0.012, y - h / 2 + (k * h) / 3 + 0.012, 0.095, 0.115, woodD, { cast: false });
    };
    latticeWin(-6.2, 1.6, 1.1, 0.9);
    latticeWin(-2.9, 1.6, 1.1, 0.9);
    // sliding lattice door
    bxo(f, -4.85, -3.55, Y0, 2.4, 0, 0.1, woodD);
    plo(f, 1.16, 2.18, -4.2, 1.24, 0.105, L('#ffb870', 0.95));
    for (let k = 0; k <= 6; k++) bxo(f, -4.78 + k * 0.19, -4.76 + k * 0.19, Y0 + 0.05, 2.35, 0.105, 0.125, woodD, { cast: false });
    for (let k = 0; k < 7; k++) bxo(f, -4.8, -3.6, Y0 + 0.3 + k * 0.3, Y0 + 0.32 + k * 0.3, 0.105, 0.125, woodD, { cast: false });
    // short noren over the door
    for (let i = 0; i < 2; i++) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.18, 0.42), side: THREE.DoubleSide }));
      n.rotation.y = Math.PI / 2; n.position.set(X1 + 0.16, 2.0, -4.5 + i * 0.6); g.add(n);
    }
    // hanging wooden signboard (perpendicular to the wall, like reference 2)
    {
      const sx = X1 + 0.62, sz = -5.55;
      bx(g, woodD, X1, sx + 0.02, 3.02, 3.06, sz - 0.02, sz + 0.02, { cast: false });
      const t = canvasTex(160, 400, (c, w, h) => { c.fillStyle = '#c99a5a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a2314'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); vbrush(c, '炭火焼', w / 2, 90, 90, 105); });
      [-1, 1].forEach((s) => pl(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.0, 0.9, 0.75) }), 0.3, 0.74, sx, 2.6, sz + s * 0.025, s > 0 ? 0 : Math.PI, 0));
      cyl2(g, toon('#15110e'), [sx, 2.98, sz], [sx, 2.96, sz], 0.01, 4);
    }
    // A-frame menu + bicycle parked at the wall + beer crates (ground)
    {
      const a = grp(g, X1 + 0.65, Y0, -2.55, Math.PI / 2 - 0.2);
      bx(a, woodD, -0.28, -0.24, 0, 0.95, -0.14, 0.14); bx(a, woodD, 0.24, 0.28, 0, 0.95, -0.14, 0.14);
      pl(a, new THREE.MeshBasicMaterial({ map: chalkTex(), color: new THREE.Color(0.85, 0.85, 0.82) }), 0.5, 0.78, 0, 0.52, 0.045, 0, 0);
    }
    // 2F: lattice windows, wooden board, big orange-lit hanging sign
    latticeWin(2.6, 4.9, 1.0, 1.1, '#ffc27a');
    latticeWin(0.55, 4.9, 1.0, 1.1, '#ffb0c8');
    latticeWin(-5.6, 4.9, 1.0, 1.1, '#ffc980');
    latticeWin(-3.2, 4.9, 1.0, 1.1, '#ffc27a');
    // bamboo blind on one window
    {
      const t = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#d9b36a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? '#c79a4c' : '#e3c27c'; c.fillRect(x, 0, 6, h); } c.fillStyle = '#6b4a2a'; c.fillRect(0, h * 0.72, w, 5); });
      plo(f, 1.0, 0.7, 0.55, 5.1, 0.135, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.9, 0.8, 0.65) }));
    }
    {
      const sgx = X1 + 0.12, sgz = 1.55;
      bx(g, woodD, sgx - 0.06, sgx + 0.14, 5.55, 6.3, sgz - 0.95, sgz + 0.95);
      plo(f, 1.8, 0.7, sgz, 5.925, 0.145, new THREE.MeshBasicMaterial({ map: signBoardTex('旨い酒 旨い肴', 1024, 400, false), color: new THREE.Color(1.15, 1.0, 0.8) }), { cast: false });
      halo(g, X1 + 0.5, 5.9, sgz, '#ffc77a', 3.2, 0.3);
    }
    // 2F eave (small, protects the window row) + lantern pair at the stair landing
    bx(g, roofTile, X1, X1 + 0.5, 6.3, 6.42, -7.0, 3.4);
    [[-0.9, 2.55], [-2.0, 2.55]].forEach(([z]) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), L('#fff0cc', 1.4)); l.scale.set(0.9, 1.15, 0.9); l.position.set(X1 + 0.35, 4.1, z); g.add(l);
    });
    // ---- east balcony + wall bulletin board + bike + plants ----
    bxo(f, -7.0, -2.1, 3.14, 3.3, 0, 0.4, woodD);
    for (let z = -6.9; z < -2.15; z += 0.4) bxo(f, z - 0.02, z + 0.02, 3.3, 4.2, 0.33, 0.37, woodD, { cast: false });
    bxo(f, -7.0, -2.1, 4.17, 4.25, 0.31, 0.4, woodD, { cast: false });
    bxo(f, -7.0, -2.1, 3.7, 3.74, 0.33, 0.37, woodD, { cast: false });
    [-6.2, -4.5, -2.8].forEach((z) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), L('#fff0cc', 1.4)); l.scale.set(0.9, 1.15, 0.9); l.position.set(X1 + 0.34, 4.0, z); g.add(l); });
    {
      const bz = Z1 - 0.8, by = 1.7;
      bxo(f, bz - 0.62, bz + 0.62, by - 0.45, by + 0.45, 0, 0.07, woodD);
      plo(f, 1.2, 0.84, bz, by, 0.075, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.45, 0.32) }));
      [[3, -0.38, 0.1, 0.34, 0.5], [4, 0.0, 0.12, 0.34, 0.5], [5, 0.38, 0.05, 0.3, 0.44], [2, -0.1, -0.22, 0.3, 0.4]].forEach(([p, du, dv, w, h], i) => plo(f, w, h, bz + du, by + dv, 0.085, new THREE.MeshBasicMaterial({ map: posterTex(p), color: new THREE.Color(0.78, 0.78, 0.8) })));
      bxo(f, bz - 0.66, bz + 0.66, by + 0.45, by + 0.5, 0, 0.3, roofTile);
      plo(f, 1.2, 0.84, bz, by, 0.09, makeGlass(1.2, 0.84, 21, { drops: 0.7, alpha: 0.04 }), { noLine: true });
    }
    bicycle(g, X1 + 0.55, Z1 + 0.0 - 0.3, 0.0, '#3a8fb8', 0.08);
    [[X1 + 0.35, Z1 - 1.9]].forEach(([x, z]) => { const p = grp(g, x, Y0, z); cy(p, toon('#8a5a3c'), 0, 0, 0, 0.18, 0.32, 10, { rt: 0.8 }); sph(p, toon('#2f5a44'), 0.24, 0, 0.55, 0, 1, 0.9, 1); });
  }

  /* ==================================================================== steel stairs (kept) */
  {
    const st = toon('#7c869b');
    const n = 14, run = 3.6, rise = 3.45;
    for (let i = 0; i < n; i++) {
      const z = 2.7 - (i / n) * run, y = Y0 + ((i + 1) / n) * rise;
      bx(g, st, X1, X1 + 0.8, y - 0.05, y, z - run / n, z, { cast: false });
    }
    cyl2(g, st, [X1 + 0.78, Y0 + 0.9, 2.7], [X1 + 0.78, Y0 + rise + 0.9, 2.7 - run], 0.02, 5);
    cyl2(g, st, [X1 + 0.78, Y0, 2.7], [X1 + 0.78, Y0 + rise, 2.7 - run], 0.04, 5);
    for (let i = 0; i <= 5; i++) { const t = i / 5; cyl2(g, st, [X1 + 0.78, Y0 + t * rise, 2.7 - t * run], [X1 + 0.78, Y0 + t * rise + 0.9, 2.7 - t * run], 0.018, 5); }
    bx(g, st, X1, X1 + 0.85, Y0 + rise - 0.05, Y0 + rise, 2.7 - run - 0.9, 2.7 - run, { cast: false });
    cyl2(g, st, [X1 + 0.83, Y0 + rise + 0.9, 2.7 - run - 0.9], [X1 + 0.83, Y0 + rise + 0.9, 2.7 - run], 0.02, 5);
    bx(g, woodD, X1, X1 + 0.06, Y0 + rise, Y0 + rise + 2.0, 2.7 - run - 0.8, 2.7 - run);
    halo(g, X1 + 0.3, Y0 + rise + 1.7, 2.7 - run - 0.2, '#ffd9a0', 1.0, 0.45);
  }
  // meters / pipes / AC on the alley wall (south end), downpipe at the corner
  bx(g, toon('#aab2c2'), X1 + 0.0, X1 + 0.18, 1.0, 1.7, 2.9, 3.35);
  cyl2(g, toon('#7b8498'), [X1 + 0.1, Y0, -6.9], [X1 + 0.1, 6.5, -6.9], 0.04, 6);
  bx(g, toon('#d6dae3'), X1, X1 + 0.5, 3.9, 4.4, -1.75, -1.15);
  for (let x = X0 + 0.4; x < X1 + 0.3; x += 1.0 + R() * 0.2) drips.push([x, 2.84, Z1 + 1.03, Y0 + 0.01]);
  for (let z = -6.8; z < -2.0; z += 1.3) drips.push([X1 + 0.8, 2.84, z, Y0 + 0.01]);

  /* ==================================================================== WEST side (long street-shop wall, reference 2) */
  {
    const f = 'w';
    const ez0 = Z0 + 0.1, ez1 = Z1 - 0.05, ew = 0.45;
    const lm = L('#fff0cc', 1.4);
    const lantern = (x, y, z, s = 1) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 12, 8), lm); l.scale.set(0.9, 1.15, 0.9); l.position.set(x, y, z); g.add(l); cy(g, toon('#15110e'), x, y + 0.12 * s * 1.15, z, 0.055 * s, 0.045, 8); };
    // lean-to tile eave over the whole ground floor
    bxo(f, ez0, ez1, 2.98, 3.14, 0, ew, roofTile);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(ez1 - ez0, ew), tileMat(5, 1));
    top.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); top.position.set(X0 - ew / 2, 3.145, (ez0 + ez1) / 2); g.add(top);
    for (let z = ez0 + 0.1; z < ez1; z += 0.34) bxo(f, z, z + 0.07, 2.88, 2.98, 0, ew - 0.04, woodD, { cast: false });
    bxo(f, ez0, ez1, 2.84, 2.98, ew - 0.07, ew, woodD);
    for (let z = -6.7; z < ez1 - 0.2; z += 0.66) lantern(X0 - ew + 0.2, 2.6, z);
    halo(g, X0 - 0.3, 2.6, -1.5, '#ffd9a0', 4.0, 0.28);
    halo(g, X0 - 0.3, 2.6, 2.4, '#ffd9a0', 3.2, 0.26);
    const latticeWin = (z, y, w, h, hex) => {
      bxo(f, z - w / 2 - 0.06, z + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.09, woodD);
      plo(f, w, h, z, y, 0.095, L(hex, 1.0));
      for (let k = 1; k < 4; k++) bxo(f, z - w / 2 + (k * w) / 4 - 0.012, z - w / 2 + (k * w) / 4 + 0.012, y - h / 2, y + h / 2, 0.095, 0.115, woodD, { cast: false });
      for (let k = 1; k < 3; k++) bxo(f, z - w / 2, z + w / 2, y - h / 2 + (k * h) / 3 - 0.012, y - h / 2 + (k * h) / 3 + 0.012, 0.095, 0.115, woodD, { cast: false });
    };
    // ground-floor bays
    latticeWin(-6.0, 1.6, 1.1, 0.9, '#ffc980');                  // kitchen
    latticeWin(-3.3, 1.6, 1.1, 0.9, '#ffc27a');
    // side door with noren + canopy
    bxo(f, -1.05, 0.25, Y0, 2.3, 0, 0.1, woodD);
    plo(f, 1.1, 2.1, -0.4, 1.2, 0.105, L('#ffb870', 0.9));
    for (let k = 0; k <= 5; k++) bxo(f, -0.98 + k * 0.2, -0.96 + k * 0.2, Y0 + 0.05, 2.25, 0.105, 0.125, woodD, { cast: false });
    for (let i = 0; i < 2; i++) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.55), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.18, 0.42), side: THREE.DoubleSide })); n.rotation.y = Math.PI / 2; n.position.set(X0 - 0.18, 2.05, -0.7 + i * 0.6); g.add(n); }
    // shop display window with food photos (south bay)
    {
      const w = 1.9, z = 2.6;
      bxo(f, z - w / 2 - 0.07, z + w / 2 + 0.07, 0.75, 2.2, 0, 0.1, woodD);
      plo(f, w, 1.3, z, 1.48, 0.105, new THREE.MeshBasicMaterial({ map: foodBoardTex(520, 360, 'おすすめ'), color: new THREE.Color(1.2, 1.1, 0.95) }));
      plo(f, w, 1.3, z, 1.48, 0.12, makeGlass(w, 1.3, 77, { drops: 0, alpha: 0.03 }), { noLine: true });
      bxo(f, z - w / 2 - 0.1, z + w / 2 + 0.1, 0.7, 0.78, 0, 0.2, woodD);
    }
    // vertical hanging sign (縦看板) under the eave, plus wall posters
    {
      const t = canvasTex(110, 380, (c, w, h) => { c.fillStyle = '#d9c8a0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a2314'; c.lineWidth = 7; c.strokeRect(4, 4, w - 8, h - 8); vbrush(c, '酒処', w / 2, 100, 78, 108); });
      bxo(f, 1.05, 1.09, 3.0, 3.06, 0, 0.0, woodD);
      [-1, 1].forEach((s2) => pl(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.0, 0.92, 0.8) }), 0.28, 0.9, X0 - 0.36, 2.5, 1.07 + s2 * 0.02, s2 > 0 ? 0 : Math.PI, 0));
      cyl2(g, woodD, [X0, 2.84, 1.07], [X0 - 0.36, 2.84, 1.07], 0.015, 5);
    }
    [[-4.7, 1.7, 3], [3.9, 1.5, 5]].forEach(([z, y, p]) => plo(f, 0.42, 0.6, z, y, 0.02, new THREE.MeshBasicMaterial({ map: posterTex(p), color: new THREE.Color(0.8, 0.8, 0.8) })));
    // kitchen AC outdoor unit
    bxo(f, -5.0, -4.4, Y0 + 0.2, Y0 + 0.9, 0, 0.38, toon('#d6dae3', { lit: 0.35 }));
    // ---- balcony (勾欄) along the whole upper floor ----
    bxo(f, ez0, ez1, 3.14, 3.3, 0, ew, woodD);
    for (let z = ez0 + 0.1; z < ez1 - 0.05; z += 0.4) bxo(f, z - 0.02, z + 0.02, 3.3, 4.2, ew - 0.07, ew - 0.03, woodD, { cast: false });
    bxo(f, ez0, ez1, 4.17, 4.25, ew - 0.09, ew, woodD, { cast: false });
    bxo(f, ez0, ez1, 3.7, 3.74, ew - 0.07, ew - 0.03, woodD, { cast: false });
    // upper windows + wall sign boards
    [[-6.2, '#ffc980'], [-4.0, '#ffb0c8'], [-1.8, '#ffc27a'], [0.4, '#ffc980']].forEach(([z, hex]) => latticeWin(z, 5.0, 1.0, 1.2, hex));
    latticeWin(3.7, 5.0, 1.0, 1.2, '#ffc27a');
    {
      bxo(f, 1.2, 3.0, 4.75, 5.55, 0, 0.1, woodD);
      plo(f, 1.64, 0.7, 2.1, 5.15, 0.105, new THREE.MeshBasicMaterial({ map: signBoardTex('日本酒', 1024, 440, false), color: new THREE.Color(1.1, 0.98, 0.8) }), { cast: false });
      halo(g, X0 - 0.4, 5.15, 2.1, '#ffc77a', 3.0, 0.28);
    }
    // little lanterns on the balcony + an AC unit upstairs
    [-6.8, -3.0, 0.9, 4.0].forEach((z) => lantern(X0 - ew + 0.12, 4.0, z, 0.9));
    bxo(f, -3.1, -2.5, 3.4, 3.9, 0, 0.34, toon('#d6dae3', { lit: 0.35 }));
    cyl2(g, toon('#7b8498'), [X0 - 0.08, Y0, 3.6], [X0 - 0.08, 6.3, 3.6], 0.04, 6);
  }

  /* ==================================================================== NORTH side */
  {
    const f = 'n';
    const win = (x, y, w, h, hex) => { bxo(f, x - w / 2 - 0.06, x + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.09, woodD); plo(f, w, h, x, y, 0.095, L(hex, 1.0)); };
    win(-11.0, 4.9, 0.9, 1.0, '#ffc980'); win(-9.4, 4.9, 0.9, 1.0, '#ffb0c8');
    win(-9.6, 1.7, 0.8, 0.7, '#ffc27a');
    bxo(f, -11.5, -10.5, Y0, 2.1, 0, 0.1, woodD); plo(f, 0.84, 1.95, -11.0, 1.1, 0.105, L('#8a5a30', 0.8));
    // kitchen exhaust hood + duct
    bxo(f, -10.0, -9.2, 1.7, 2.3, 0, 0.45, toon('#a8b0c0'));
    cyl2(g, toon('#a8b0c0'), [-9.6, 2.3, Z0 - 0.22], [-9.6, 6.9, Z0 - 0.22], 0.14, 8);
    bxo(f, -9.3, -8.75, Y0, 0.55, 0.0, 0.5, toon('#c4552f')); bxo(f, -9.3, -8.75, Y0 + 0.55, 1.05, 0.0, 0.5, toon('#d8643a'));
  }

  /* ==================================================================== corner vertical neon (kept) */
  {
    const nt = canvasTex(160, 720, (c, w, h) => {
      c.fillStyle = '#10051e'; c.fillRect(0, 0, w, h);
      c.shadowColor = '#ff3fb0'; c.shadowBlur = 22;
      c.strokeStyle = '#6ff3ff'; c.lineWidth = 8; roundRect(c, 10, 10, w - 20, h - 20, 22); c.stroke();
      [...'居酒屋ほたる'].forEach((ch, i) => T(c, ch, w / 2, 70 + i * 106, 88, '#ff6fc2', { weight: 800, stroke: '#ff2f9f', sw: 6 }));
    });
    const nm = new THREE.MeshBasicMaterial({ map: nt, color: new THREE.Color(1.5, 1.5, 1.5) });
    const sgn = grp(g, X1 + 0.3, 0, Z1 + 0.22);
    bx(sgn, toon('#1a1230'), -0.19, 0.19, 3.3, 5.8, -0.09, 0.09);
    pl(sgn, nm, 0.34, 2.4, 0.0, 4.55, 0.0925, 0, 0);
    pl(sgn, nm, 0.34, 2.4, 0.0, 4.55, -0.0925, Math.PI, 0);
    pl(sgn, nm, 0.34, 2.4, 0.1925, 4.55, 0.0, Math.PI / 2, 0);
    pl(sgn, nm, 0.34, 2.4, -0.1925, 4.55, 0.0, -Math.PI / 2, 0);
    bx(g, toon('#1a1230'), X1, X1 + 0.3, 3.4, 3.5, Z1 + 0.18, Z1 + 0.26);
    halo(g, X1 + 0.3, 4.55, Z1 + 0.9, '#ff4fb0', 3.6, 0.35);
    plight(g, '#ff4fb0', 7, 7, X1 + 1.0, 4.4, Z1 + 1.3, 'neonPink');
    reg.neonIza = nm;
  }
  return g;
}
