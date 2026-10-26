import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, RAMP } from './core.js';
import { makeGlass } from './fx.js';
import { T, posterTex } from './tex.js';
import { bicycle, vendingMachine, planter, nobori } from './street.js';
import { snowCapLine } from './roofPiles.js';
import { P } from './palette.js';

/* ====================================================================================================
   Izakaya next to the convenience store (3.5 m wide, 2 storeys, tiled gable roof)

   south = FRONT on the main road (reference 1): tiled lean-to eave, lantern row, white noren, lit photo menus,
           営業中 plate, ranma lattice band; upstairs a lattice window, the big wooden sign under goose-neck lamps,
           vertical menu plaques and a lamp beam
   west  = STREET SIDE on the back lane (reference 2): the front eave turns the corner on a hip and runs the
           whole length; shop bays (food-sample case, side entrance with indigo noren, counter lattice window,
           vending corner), electric stand sign, A-frame menu, bikes, nobori; upstairs a balcony with lanterns,
           a gold-framed board and the projecting shop-name sign at the corner
   east  = BACK of house facing the LAWSON: kitchen windows with grilles, staff door, propane, meters, AC,
           steel stairs to the flat upstairs
   north = kitchen side (duct, door)

   Kept as a reusable module: the bakery (bakery.js) now stands on this lot by default; ?shop=izakaya brings
   the izakaya back here, placeIzakaya() puts it on any other lot.
   ==================================================================================================== */

const MINCHO = '"Hiragino Mincho ProN","Yu Mincho","Kaiti SC","STKaiti","Songti SC",serif';
const Y0 = 0.15;
export const IZA = { X0: -12, X1: -8.5, Z0: -7.2, Z1: 4.3, H: 6.6 }; // front pushed 0.8 m south: more side wall, deeper front yard use

/* ---------------------------------------------------------------- textures */
let _wood;
function woodBase() {
  if (_wood) return _wood;
  _wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b98b5f'; g.fillRect(0, 0, w, h); // light honey timber
    const R = rng(7);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = `rgba(${R() < 0.5 ? '255,200,140' : '40,20,8'},${0.06 + R() * 0.08})`;
      g.fillRect(x, 0, 32, h);
      g.fillStyle = 'rgba(70,44,24,0.45)'; g.fillRect(x, 0, 2.5, h);
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
      g.fillStyle = '#626b86'; g.fillRect(0, 0, w, h); // soft slate tiles (palette slate), a step lighter again
      for (let y = 0; y < h; y += 16) {
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = P.slateL; g.beginPath(); g.arc(x + 8, y + 2, 9, 0, Math.PI); g.fill();
          g.strokeStyle = '#b4bccf'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + 8, y + 2, 9, 0.15, Math.PI - 0.15); g.stroke();
        }
        g.fillStyle = 'rgba(10,12,30,0.2)'; g.fillRect(0, y + 13, w, 3);
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
/* ---------------------------------------------------------------- textures (round 2: storefront kit) */
let _sudare;
function sudareTex() {
  return (_sudare ||= canvasTex(64, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? '#c9a873' : '#b38d58'; g.fillRect(0, y, w, 3); }
    g.fillStyle = 'rgba(60,40,20,0.45)'; g.fillRect(14, 0, 3, h); g.fillRect(46, 0, 3, h);
  }, { repeat: true }));
}
let _rib;
/** pan-tile texture for the lean-to eaves: a rounded rib running down the slope + the course shadow */
function ribTileMat() {
  if (!_rib) {
    _rib = canvasTex(64, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#5d657e'); gr.addColorStop(0.2, '#737c97'); gr.addColorStop(0.5, '#8d96b0'); gr.addColorStop(0.8, '#737c97'); gr.addColorStop(1, '#5b637c'); // lighter slate eaves
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const sh = g.createLinearGradient(0, h - 14, 0, h);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = sh; g.fillRect(0, h - 14, w, 14);
      g.fillStyle = '#a3abc2'; g.fillRect(0, 0, w, 3);
    }, { repeat: true });
  }
  return toon('#ffffff', { map: _rib, lit: 0.12, nocache: true });
}
const texOnce = new Map();
const once = (k, f) => { if (!texOnce.has(k)) texOnce.set(k, f()); return texOnce.get(k); };
/** paper lantern (chochin) skin: ribs + a brush character front and back */
function chochinTex(text, red) {
  return once(`cho|${text}|${red}`, () => canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (red) { gr.addColorStop(0, '#9a1c14'); gr.addColorStop(0.5, '#e0442c'); gr.addColorStop(1, '#9a1c14'); }
    else { gr.addColorStop(0, '#e9d9b8'); gr.addColorStop(0.5, '#fff6e2'); gr.addColorStop(1, '#e6d4b0'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h; y += 15) { g.fillStyle = red ? 'rgba(70,10,5,0.28)' : 'rgba(120,85,40,0.22)'; g.fillRect(0, y, w, 2); }
    const ink = red ? '#1a0d0a' : '#17110d';
    [w / 2, 0, w].forEach((x) => {
      if ([...text].length === 1) brush(g, text, x, h / 2 + 4, 132, ink);
      else vbrush(g, text, x, h / 2 - 64, 60, 64, ink);
    });
  }));
}
let _lanGeo;
function lanternGeo() {
  if (_lanGeo) return _lanGeo;
  const pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.5 * (0.66 + 0.34 * Math.sin(Math.PI * t)), t - 0.5)); }
  // phiStart -PI: u = 0.5 faces +z, so the character sits on the front
  return (_lanGeo = new THREE.LatheGeometry(pts, 26, -Math.PI, Math.PI * 2));
}
function lightBoxTex() {
  return once('lightbox', () => canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4261d'; g.fillRect(0, 0, w, 92);
    g.fillStyle = '#fff'; g.font = `900 54px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('炭火', w / 2, 48);
    vbrush(g, 'やきとり', w / 2, 150, 70, 76, '#17110d');
    g.fillStyle = '#c4261d'; g.fillRect(16, h - 74, w - 32, 4);
    g.fillStyle = '#17110d'; g.font = `800 30px ${MINCHO}`; g.fillText('生ビール ¥390', w / 2, h - 40);
  }));
}
function norenBlueTex(ch) {
  return once('nb' + ch, () => canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#1d2f5c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.5);
    g.fillStyle = '#16244a'; g.fillRect(0, 0, w, 26);
    brush(g, ch, w / 2, h * 0.55, 170, '#f3eee2');
  }));
}
function goldSignTex(text) {
  // dark lacquered board with a gold frame and gold lettering (the horizontal shop board of reference 2)
  return once('gold' + text, () => canvasTex(1024, 280, (g, w, h) => {
    g.fillStyle = '#3a2216'; g.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.1 + R() * 0.15})`; g.lineWidth = 1; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.lineTo(w, y + R() * 6 - 3); g.stroke(); }
    g.strokeStyle = '#e2b450'; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#8a6420'; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    brush(g, text, w / 2, h / 2 + 6, 170, '#f0c45a');
  }));
}
function sodeTex() {
  // vertical projecting sign (袖看板): name of the shop
  return once('sode', () => canvasTex(200, 640, (g, w, h) => {
    g.fillStyle = '#f7efe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b4221b'; g.fillRect(0, 0, w, 120);
    g.fillStyle = '#fff'; g.font = `900 56px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('居酒屋', w / 2, 62);
    vbrush(g, 'ほたる', w / 2, 220, 140, 150, '#17110d');
    g.strokeStyle = '#3a2314'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  }));
}
function bannerTex() {
  return once('banner', () => canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#b4221b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7d36a'; g.fillRect(0, 8, w, 4); g.fillRect(0, h - 12, w, 4);
    g.fillStyle = '#fff'; g.font = `900 64px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('やきとり・おでん', w / 2, h / 2 + 2);
  }));
}

/* ---------------------------------------------------------------- reuse on another lot
   The izakaya is modelled in world coordinates on its home lot (IZA). placeIzakaya() builds the same building
   inside a group moved so that the front-left corner (X0, Z1) lands on (x, z) and turned by ry, e.g.
     placeIzakaya(world, { x: -30, z: 6.0, ry: 0 })   // another Kaigan-dori lot, front to the south
   Its home-lot extras (roof piles / ground piles / weather occluders / holiday decorations in roofPiles.js,
   groundPiles.js, world.js, holiday.js) are keyed to the home lot or to site.js IZA_AWAY; pass drips to keep them. */
export function placeIzakaya(parent, { x, z, ry = 0, y = 0, drips = null }) {
  const g = new THREE.Group();
  g.rotation.y = ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  // after rotation the home corner (X0, Z1) sits at (X0 c + Z1 s, -X0 s + Z1 c): shift it onto (x, z)
  g.position.set(x - (IZA.X0 * c + IZA.Z1 * s), y, z - (-IZA.X0 * s + IZA.Z1 * c));
  parent.add(g);
  const local = [];
  buildIzakaya(g, local);
  // eave drips: [x, y, z, groundY] in the home frame -> the new lot
  if (drips) local.forEach(([dx, dy, dz, gy]) => drips.push([g.position.x + dx * c + dz * s, dy + y, g.position.z - dx * s + dz * c, gy + y]));
  return g;
}

/* ---------------------------------------------------------------- the building */
export function buildIzakaya(parent, drips) {
  const g = grp(parent);
  const { X0, X1, Z0, Z1, H } = IZA;
  const cx = (X0 + X1) / 2;
  const R = rng(61);

  const woodD = toon(P.woodD, { lit: 0.3 }); // the timber frame: palette timber, lighter than the old near-black
  const woodM = toon(P.woodM, { lit: 0.35 });
  const plaster = toon('#e8dfcf', { lit: 0.2 });
  const roofTile = toon(P.slate); // ridge / verge pieces: slate, a step darker than the tiles
  const tileDark = toon('#5a6280');
  const iron = toon('#6f788c');
  const stone = toon(P.stoneD);
  const stoneL = toon('#a59d92');
  const capM = toon(P.ink);
  const ribM = ribTileMat();

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
  const L = (hex, k = 1.5) => {
    const c = new THREE.Color(hex).multiplyScalar(k);
    const m = new THREE.MeshBasicMaterial({ color: c });
    reg.emis.push({ m, base: c.clone(), cat: 'iza' }); // windows dim in daylight like every other emitter
    return m;
  };
  /** a squared timber from p to q (w across, h tall) */
  const beam = (mat, p, q, w, h, op = {}) => {
    const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const len = d.length();
    const b = new THREE.Group();
    b.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    g.add(b);
    bx(b, mat, -len / 2, len / 2, -h / 2, h / 2, -w / 2, w / 2, op);
    return b;
  };
  /** paper lantern; r = radius, text on the front */
  const chochin = (parent, x, y, z, r, text, red = false, ry = 0) => {
    const m = new THREE.Mesh(lanternGeo(), glow('#ffffff', red ? 1.9 : 1.75, { map: chochinTex(text, red), cat: 'iza' }));
    m.scale.set(r * 2, r * 2.5, r * 2); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = false; parent.add(m);
    cy(parent, capM, x, y + r * 1.12, z, r * 0.72, r * 0.2, 12, { cast: false });
    cy(parent, capM, x, y - r * 1.32, z, r * 0.72, r * 0.2, 12, { cast: false });
    return m;
  };

  /** lean-to tile eave (庇) along the wall a -> b (world x/z), sloping out along n by D and dropping `drop`.
      ends: { hip: true } meets a perpendicular eave on a 45° hip, { ov } runs past the wall end */
  const pent = ({ a, b, n, D, y, drop, end0, end1 }) => {
    const t = [b[0] - a[0], b[1] - a[1]]; const tl = Math.hypot(t[0], t[1]); t[0] /= tl; t[1] /= tl;
    const A = end0.hip ? a : [a[0] - t[0] * end0.ov, a[1] - t[1] * end0.ov];
    const B = end1.hip ? b : [b[0] + t[0] * end1.ov, b[1] + t[1] * end1.ov];
    const A2 = end0.hip ? [a[0] + n[0] * D - t[0] * D, a[1] + n[1] * D - t[1] * D] : [A[0] + n[0] * D, A[1] + n[1] * D];
    const B2 = end1.hip ? [b[0] + n[0] * D + t[0] * D, b[1] + n[1] * D + t[1] * D] : [B[0] + n[0] * D, B[1] + n[1] * D];
    const slope = Math.hypot(D, drop);
    const quad = (yIn, yOut, mat, up, uvs) => {
      const P = [[A[0], yIn, A[1]], [B[0], yIn, B[1]], [B2[0], yOut, B2[1]], [A2[0], yOut, A2[1]]];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
      if (uvs) {
        const uv = P.map((p) => { const dx = p[0] - a[0], dz = p[2] - a[1]; const along = dx * t[0] + dz * t[1], out = dx * n[0] + dz * n[1]; return [along / 0.24, (D - out) / D * slope / 0.2]; });
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
      } else geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      // wind the quad so its face points up (tiles) or down (soffit)
      const e1 = new THREE.Vector3(...P[1]).sub(new THREE.Vector3(...P[0])), e2 = new THREE.Vector3(...P[2]).sub(new THREE.Vector3(...P[0]));
      const ny = e1.cross(e2).y;
      geo.setIndex((ny > 0) === up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
      return m;
    };
    quad(y, y - drop, ribM, true, true);
    quad(y - 0.09, y - drop - 0.09, woodM, false, false);
    // fascia board along the eave edge, rafters underneath, round tile ends on the edge
    beam(woodD, [A2[0], y - drop - 0.06, A2[1]], [B2[0], y - drop - 0.06, B2[1]], 0.06, 0.14);
    if (!end0.hip) beam(woodD, [A[0], y - 0.06, A[1]], [A2[0], y - drop - 0.06, A2[1]], 0.05, 0.12);
    if (!end1.hip) beam(woodD, [B[0], y - 0.06, B[1]], [B2[0], y - drop - 0.06, B2[1]], 0.05, 0.12);
    const el = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
    for (let s = 0.11; s < el; s += 0.24) {
      const px = A2[0] + ((B2[0] - A2[0]) * s) / el, pz = A2[1] + ((B2[1] - A2[1]) * s) / el;
      cyl2(g, tileDark, [px - n[0] * 0.06, y - drop + 0.03, pz - n[1] * 0.06], [px + n[0] * 0.015, y - drop + 0.012, pz + n[1] * 0.015], 0.04, 7, { cast: false });
    }
    for (let s = 0.15; s < tl - 0.05; s += 0.34) {
      const px = a[0] + t[0] * s, pz = a[1] + t[1] * s;
      beam(woodD, [px, y - 0.13, pz], [px + n[0] * (D - 0.1), y - drop - 0.11, pz + n[1] * (D - 0.1)], 0.045, 0.06, { cast: false });
    }
    // flashing along the wall, hip ridge with a small end tile
    beam(tileDark, [A[0] + n[0] * 0.04, y + 0.03, A[1] + n[1] * 0.04], [B[0] + n[0] * 0.04, y + 0.03, B[1] + n[1] * 0.04], 0.1, 0.07);
    if (end0.hip) {
      beam(tileDark, [a[0], y + 0.05, a[1]], [A2[0], y - drop + 0.05, A2[1]], 0.11, 0.09);
      sph(g, tileDark, 0.075, A2[0], y - drop + 0.06, A2[1], 1, 0.8, 1);
      snowCapLine(g, [a[0], y + 0.1, a[1]], [A2[0], y - drop + 0.1, A2[1]], 0.07); // covers the seam of the two snow layers
    }
    return { A, B, A2, B2 };
  };

  /* ---- structure ---- */
  bx(g, plaster, X0, X1, Y0, H, Z0, Z1);
  // wooden cladding / plaster with a half-timber frame; posts = where the timber posts go
  const clad = (f, len, u0, posts) => {
    const m1 = f === 's' ? woodMat(len / 1.2, (H - 3.2) / 1.2, 0.3, '#dcc09a') : plasterMat(len / 1.6, (H - 3.2) / 1.6);
    plo(f, len, H - 3.2, u0 + len / 2, 3.2 + (H - 3.2) / 2, 0.012, m1, { cast: false, recv: true });
    if (f !== 's') {
      const np = Math.max(2, Math.round(len / 1.45));
      const ps = posts || Array.from({ length: np + 1 }, (_, i) => u0 + (len * i) / np);
      ps.forEach((u) => bxo(f, u - 0.05, u + 0.05, 3.3, H, 0.01, 0.075, woodD, { cast: false }));
      bxo(f, u0, u0 + len, H - 0.22, H - 0.1, 0.01, 0.08, woodD, { cast: false });
      bxo(f, u0, u0 + len, 5.95, 6.02, 0.01, 0.075, woodD, { cast: false });
    }
    const m0 = woodMat(len / 1.4, 3.05 / 1.4, 0.4, '#ecdcc4');
    plo(f, len, 3.05, u0 + len / 2, Y0 + 3.05 / 2, 0.012, m0, { cast: false, recv: true });
  };
  clad('s', X1 - X0, X0);
  clad('e', Z1 - Z0, Z0);
  clad('w', Z1 - Z0, Z0, [-7.15, -4.95, -2.85, -0.7, 0.2, 3.2, 4.25]);
  clad('n', X1 - X0, X0);
  // floor band + corner posts (dark timber frame)
  [['s'], ['n']].forEach(([f]) => bxo(f, X0 - 0.04, X1 + 0.04, 3.14, 3.3, 0, 0.12, woodD));
  [['e'], ['w']].forEach(([f]) => bxo(f, Z0 - 0.04, Z1 + 0.04, 3.14, 3.3, 0, 0.12, woodD));
  [X0, X1].forEach((x) => bx(g, woodD, x - 0.08, x + 0.08, Y0, H, Z1 - 0.02, Z1 + 0.16));
  [Z0, Z1].forEach((z) => { bx(g, woodD, X0 - 0.16, X0 + 0.07, Y0, H, z - 0.07, z + 0.07); bx(g, woodD, X1 - 0.07, X1 + 0.06, Y0, H, z - 0.07, z + 0.07); });

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

  /* ---- lean-to tile eaves: front + street side meet on a hip at the south-west corner ---- */
  const PY = 3.42, PD = 1.0, PDROP = 0.36;
  pent({ a: [X0, Z1], b: [X1, Z1], n: [0, 1], D: PD, y: PY, drop: PDROP, end0: { hip: true }, end1: { ov: 0.3 } });
  pent({ a: [X0, Z1], b: [X0, Z0], n: [-1, 0], D: PD, y: PY, drop: PDROP, end0: { hip: true }, end1: { ov: 0.2 } });
  const EDGE_Y = PY - PDROP - 0.13; // fascia bottom

  /* ==================================================================== FRONT (south) - reference 1 */
  {
    const fz = Z1;
    const dx0 = -10.86, dx1 = -9.44; // entrance (centre -10.15, holiday props line up with it)
    // stone skirting + low wooden panels (腰板) either side of the door, mullion posts, transom
    [[X0 + 0.08, -10.98], [-9.32, X1 - 0.08]].forEach(([a, b]) => {
      bx(g, stone, a, b, Y0, 0.36, fz, fz + 0.1);
      pl(g, woodMat((b - a) / 0.5, 0.55 / 0.9, 0.35, '#b08a66'), b - a, 0.55, (a + b) / 2, 0.36 + 0.275, fz + 0.06, 0, 0, { cast: false });
      bx(g, woodD, a, b, 0.9, 0.96, fz, fz + 0.12);
    });
    [-10.94, -9.36].forEach((x) => bx(g, woodD, x - 0.065, x + 0.065, Y0, 2.62, fz, fz + 0.16));
    bx(g, woodD, X0, X1, 2.5, 2.62, fz, fz + 0.17);
    // ranma: warm light through a band of vertical slats above the transom
    pl(g, L('#ffcf8a', 1.05), X1 - X0 - 0.2, 0.5, cx, 2.88, fz + 0.03, 0, 0, { noLine: true });
    for (let x = X0 + 0.14; x < X1 - 0.1; x += 0.085) bx(g, woodD, x - 0.014, x + 0.014, 2.62, 3.14, fz + 0.04, fz + 0.08, { cast: false });
    bx(g, woodD, X0, X1, 3.08, 3.16, fz, fz + 0.12);

    // entrance: warm interior, stone step, one sliding lattice-glass leaf (the other is open), white noren
    pl(g, new THREE.MeshBasicMaterial({ map: cafeTex(), color: new THREE.Color(1.25, 1.1, 0.85) }), dx1 - dx0, 2.35, (dx0 + dx1) / 2, Y0 + 1.175, fz + 0.02, 0, 0);
    bx(g, stoneL, dx0 - 0.08, dx1 + 0.08, Y0, Y0 + 0.07, fz, fz + 0.42);
    {
      const l0 = -10.15, l1 = dx1 - 0.02, lz = fz + 0.08;
      bx(g, woodD, l0, l0 + 0.05, Y0, 2.48, lz - 0.025, lz + 0.025); bx(g, woodD, l1 - 0.05, l1, Y0, 2.48, lz - 0.025, lz + 0.025);
      bx(g, woodD, l0, l1, Y0, Y0 + 0.08, lz - 0.025, lz + 0.025); bx(g, woodD, l0, l1, 2.42, 2.48, lz - 0.025, lz + 0.025);
      bx(g, woodM, l0 + 0.05, l1 - 0.05, Y0 + 0.08, 0.62, lz - 0.015, lz + 0.015);
      pl(g, makeGlass(l1 - l0 - 0.1, 1.8, 31, { alpha: 0.03 }), l1 - l0 - 0.1, 1.8, (l0 + l1) / 2, 1.52, lz + 0.02, 0, 0, { noLine: true });
      for (let k = 1; k < 4; k++) bx(g, woodD, (l0 + l1) / 2 - 0.012 + (k - 2) * 0.17, (l0 + l1) / 2 + 0.012 + (k - 2) * 0.17, 0.62, 2.42, lz, lz + 0.03, { cast: false });
      for (let k = 1; k < 5; k++) bx(g, woodD, l0 + 0.05, l1 - 0.05, 0.62 + k * 0.36 - 0.012, 0.62 + k * 0.36 + 0.012, lz, lz + 0.03, { cast: false });
    }
    const norens = [];
    for (let i = 0; i < 3; i++) {
      const w = (dx1 - dx0 - 0.04) / 3;
      const n = grp(g, dx0 + 0.02 + (i + 0.5) * w, 2.44, fz + 0.24);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.012, 0.8), new THREE.MeshBasicMaterial({ map: norenTex(i), color: new THREE.Color(0.86, 0.82, 0.74), side: THREE.DoubleSide }));
      m.position.y = -0.4; n.add(m); n.userData.keep = true; norens.push(n);
    }
    cyl2(g, woodD, [dx0 - 0.06, 2.46, fz + 0.24], [dx1 + 0.06, 2.46, fz + 0.24], 0.022, 6);
    [dx0 - 0.06, dx1 + 0.06].forEach((x) => bx(g, woodD, x - 0.02, x + 0.02, 2.44, 2.5, fz, fz + 0.26, { cast: false }));
    reg.updaters.push((t) => norens.forEach((n, i) => (n.rotation.x = Math.sin(t * 1.25 + i * 1.3) * 0.045)));

    // lit photo menu (left), recommendation poster (right), each with a small spot lamp
    const board = (x, w, h, y, tex) => {
      bx(g, woodD, x - w / 2 - 0.06, x + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, fz, fz + 0.1);
      pl(g, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.08, 0.95) }), w, h, x, y, fz + 0.105, 0, 0);
      cyl2(g, capM, [x, y + h / 2 + 0.06, fz + 0.06], [x, y + h / 2 + 0.2, fz + 0.3], 0.012, 4, { cast: false });
      bx(g, capM, x - 0.05, x + 0.05, y + h / 2 + 0.14, y + h / 2 + 0.22, fz + 0.26, fz + 0.36, { cast: false });
      bx(g, glow('#ffe7b0', 2.4, { cat: 'iza' }), x - 0.035, x + 0.035, y + h / 2 + 0.13, y + h / 2 + 0.14, fz + 0.27, fz + 0.35, { cast: false });
    };
    board(-11.45, 0.8, 1.32, 1.66, foodBoardTex(360, 600));
    board(-8.96, 0.58, 0.9, 1.7, foodBoardTex(250, 400, 'おすすめ'));
    // 営業中 plate hanging on the left mullion
    {
      const t = canvasTex(96, 360, (c, w, h) => { c.fillStyle = '#efe3c6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4b2e17'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); vbrush(c, '営業中', w / 2, 70, 66, 92); });
      bx(g, woodD, -11.06, -10.82, 1.25, 2.12, fz + 0.16, fz + 0.19);
      pl(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.95, 0.9, 0.8) }), 0.2, 0.82, -10.94, 1.685, fz + 0.195, 0, 0);
      cyl2(g, capM, [-10.94, 2.12, fz + 0.18], [-10.94, 2.3, fz + 0.12], 0.006, 3, { cast: false, noLine: true });
    }
    // lantern row hanging from a rail under the eave (alternating 酒 / 居酒屋), soffit down-lights
    beam(woodD, [X0 + 0.04, 2.98, fz + 0.6], [X1 - 0.04, 2.98, fz + 0.6], 0.045, 0.045, { cast: false });
    for (let i = 0; i < 9; i++) {
      const x = X0 + 0.18 + i * ((X1 - X0 - 0.36) / 8);
      chochin(g, x, 2.6, fz + 0.6, 0.145, i % 2 ? '居酒屋' : '酒');
      cyl2(g, capM, [x, 2.82, fz + 0.6], [x, 2.98, fz + 0.6], 0.006, 3, { cast: false, noLine: true });
      halo(g, x, 2.6, fz + 0.75, '#ffd9a0', 0.75, 0.3);
    }
    [-11.6, -10.85, -10.15, -9.45, -8.75].forEach((x) => { cy(g, glow('#ffe7b0', 2.4, { cat: 'iza' }), x, 3.17, fz + 0.32, 0.05, 0.015, 10, { cast: false }); });
    halo(g, cx, 2.5, fz + 0.9, '#ffd9a0', 4.4, 0.3);
    plight(g, '#ffc77a', 8, 7.5, cx, 2.3, Z1 + 1.4, 'izaFront');
    // big red chochin hanging from the hip at the corner
    {
      const x = X0 - 0.42, z = fz + 0.42;
      chochin(g, x, 2.42, z, 0.24, '酒', true, Math.PI / 4);
      cyl2(g, capM, [x, 2.78, z], [x, 3.12, z], 0.008, 3, { cast: false, noLine: true });
      halo(g, x, 2.42, z, '#ff4a2a', 1.8, 0.5);
      plight(g, '#ff5a30', 5, 5.5, x + 0.2, 2.2, z + 0.4, 'lantern');
    }
    // standing chalkboard menu
    {
      const a = grp(g, -8.9, Y0, Z1 + 1.55, -0.15);
      bx(a, woodD, -0.3, -0.26, 0, 1.0, -0.14, 0.14); bx(a, woodD, 0.26, 0.3, 0, 1.0, -0.14, 0.14);
      pl(a, new THREE.MeshBasicMaterial({ map: chalkTex(), color: new THREE.Color(0.85, 0.85, 0.82) }), 0.52, 0.8, 0, 0.55, 0.045, 0, 0);
      bx(a, woodD, -0.3, 0.3, 0.97, 1.02, -0.05, 0.05);
    }

    // ---- upper facade: a lattice window, big wooden sign, menu plaques, lamp beam ----
    {
      // the upstairs room's lattice window (like the flat's windows on the back), a small sill with a flower box
      const x = -11.13, y = 4.9, w = 0.92, h = 1.1;
      bx(g, woodD, x - w / 2 - 0.07, x + w / 2 + 0.07, y - h / 2 - 0.07, y + h / 2 + 0.07, fz, fz + 0.09);
      pl(g, L('#ffc980', 0.9), w, h, x, y, fz + 0.095, 0, 0);
      for (let k = 1; k < 4; k++) bx(g, woodD, x - w / 2 + (k * w) / 4 - 0.012, x - w / 2 + (k * w) / 4 + 0.012, y - h / 2, y + h / 2, fz + 0.095, fz + 0.115, { cast: false });
      for (let k = 1; k < 3; k++) bx(g, woodD, x - w / 2, x + w / 2, y - h / 2 + (k * h) / 3 - 0.012, y - h / 2 + (k * h) / 3 + 0.012, fz + 0.095, fz + 0.115, { cast: false });
      pl(g, makeGlass(w, h, 53, { drops: 0.6, alpha: 0.04 }), w, h, x, y, fz + 0.12, 0, 0, { noLine: true });
      bx(g, woodD, x - w / 2 - 0.12, x + w / 2 + 0.12, y - h / 2 - 0.14, y - h / 2 - 0.07, fz, fz + 0.2); // the sill
      bx(g, woodM, x - w / 2 + 0.02, x + w / 2 - 0.02, y - h / 2 - 0.07, y - h / 2 + 0.11, fz + 0.04, fz + 0.2); // the flower box
      for (let i = 0; i < 7; i++) { const fx = x - w / 2 + 0.1 + i * ((w - 0.2) / 6); sph(g, toon('#4f7f52'), 0.07, fx, y - h / 2 + 0.15, fz + 0.12, 1, 0.8, 1); sph(g, toon(['#f3a8be', '#ffffff', '#e8674f'][i % 3]), 0.028, fx + 0.02, y - h / 2 + 0.22, fz + 0.15); }
    }
    {
      const sgn = grp(g, -9.52, 4.32, fz);
      bx(sgn, woodD, -0.94, 0.94, -0.62, 0.62, 0, 0.11);
      pl(sgn, new THREE.MeshBasicMaterial({ map: signBoardTex('居酒屋'), color: new THREE.Color(1.08, 1.0, 0.9) }), 1.8, 1.14, 0, 0, 0.115, 0, 0);
      bx(sgn, tileDark, -1.0, 1.0, 0.62, 0.68, -0.02, 0.18); // little cap so rain runs off
      // three lamps on goose-neck arms over the sign
      [-0.62, 0, 0.62].forEach((x) => {
        cyl2(sgn, capM, [x, 0.68, 0.04], [x, 0.84, 0.36], 0.012, 4, { cast: false });
        bx(sgn, capM, x - 0.06, x + 0.06, 0.74, 0.84, 0.32, 0.46, { cast: false });
        bx(sgn, glow('#fff0c8', 2.6, { cat: 'iza' }), x - 0.045, x + 0.045, 0.735, 0.745, 0.33, 0.45, { cast: false });
      });
      halo(g, -9.52, 4.4, fz + 0.45, '#ffd59a', 3.0, 0.26);
    }
    ['ハイボール', 'レモンサワー', '焼き鳥', 'もつ煮', '刺身', '唐揚げ', '日本酒'].forEach((t, i) => {
      const x = -10.32 + i * 0.267;
      bx(g, woodD, x - 0.125, x + 0.125, 5.16, 6.0, fz, fz + 0.06);
      pl(g, new THREE.MeshBasicMaterial({ map: plaqueTex(t), color: new THREE.Color(1.0, 0.92, 0.78) }), 0.22, 0.8, x, 5.58, fz + 0.065, 0, 0);
    });
    // top beam with a row of spot lamps shining down on the plaques
    bx(g, woodD, X0 - 0.06, X1 + 0.06, 6.08, 6.24, fz, fz + 0.34);
    for (let i = 0; i < 6; i++) {
      const x = X0 + 0.35 + i * ((X1 - X0 - 0.7) / 5);
      bx(g, capM, x - 0.06, x + 0.06, 5.96, 6.08, fz + 0.2, fz + 0.32, { cast: false });
      cy(g, glow('#fff0c8', 2.6, { cat: 'iza' }), x, 5.95, fz + 0.26, 0.04, 0.012, 10, { cast: false });
    }
    halo(g, -9.5, 5.6, fz + 0.4, '#ffd59a', 2.6, 0.2);
  }

  /* ==================================================================== WEST - street side on the back lane (reference 2) */
  {
    const f = 'w';
    const W = grp(g, X0, 0, 0, -Math.PI / 2); // local x = world z (u), local z = out of the wall
    const ox = (o) => X0 - o; // world x of an outward offset
    // timber frame of the shopfront: posts between bays, head beam, top plate
    [3.4, 1.55, -0.35, -3.75].forEach((u) => bx(W, woodD, u - 0.065, u + 0.065, Y0, 3.16, 0, 0.15));
    bx(W, woodD, Z0, Z1, 2.48, 2.6, 0, 0.16);
    bx(W, woodD, Z0, Z1, 3.08, 3.16, 0, 0.12);
    bx(W, stone, Z0 + 0.05, Z1 - 0.05, Y0, 0.3, 0, 0.08);
    // ranma band over bays A-C
    pl(W, L('#ffcf8a', 1.0), 7.1, 0.46, -0.17, 2.85, 0.03, 0, 0, { noLine: true });
    for (let u = -3.68; u < 3.36; u += 0.085) if (Math.abs(u - 1.55) > 0.08 && Math.abs(u + 0.35) > 0.08) bx(W, woodD, u - 0.014, u + 0.014, 2.6, 3.08, 0.04, 0.08, { cast: false });
    // lantern row under the street-side eave
    beam(woodD, [ox(0.6), 2.98, Z1 - 0.1], [ox(0.6), 2.98, Z0 + 0.3], 0.045, 0.045, { cast: false });
    for (let z = Z1 - 0.45, i = 0; z > Z0 + 0.4; z -= 0.62, i++) {
      if (z > -4.2 && z < -3.3) continue; // leave room above the vending machine's light
      chochin(g, ox(0.6), 2.62, z, 0.13, i % 3 === 1 ? '居酒屋' : '酒', false, -Math.PI / 2);
      cyl2(g, capM, [ox(0.6), 2.82, z], [ox(0.6), 2.98, z], 0.006, 3, { cast: false, noLine: true });
    }
    halo(g, ox(0.8), 2.6, 1.5, '#ffd9a0', 4.6, 0.26);
    halo(g, ox(0.8), 2.6, -3.0, '#ffd9a0', 4.0, 0.22);
    plight(g, '#ffc77a', 6, 7, ox(1.3), 2.3, 0.6, 'izaSide');

    // bay A (u 1.55..3.4): food-sample display case + banner
    {
      bx(W, woodM, 1.7, 3.25, Y0, 0.7, 0, 0.36);
      bx(W, woodD, 1.66, 3.29, 0.7, 0.76, 0, 0.44);
      bx(W, woodD, 1.66, 3.29, 1.7, 1.76, 0, 0.44);
      [1.69, 3.26].forEach((u) => bx(W, woodD, u - 0.03, u + 0.03, 0.76, 1.7, 0.38, 0.44, { cast: false }));
      pl(W, L('#fff1d6', 1.15), 1.5, 0.94, 2.475, 1.23, 0.02, 0, 0, { noLine: true });
      bx(W, toon('#e8eef4', { lit: 0.3 }), 1.72, 3.23, 1.22, 1.24, 0.03, 0.4, { cast: false });
      const foods = [['#e8a23a', 'bowl'], ['#c43d2f', 'plate'], ['#f2e3b3', 'bowl'], ['#7aa04a', 'plate'], ['#d9782b', 'plate'], ['#b8542b', 'bowl'], ['#f4c9a8', 'plate'], ['#e0b84a', 'bowl']];
      foods.forEach(([c, kind], i) => {
        const u = 1.9 + (i % 4) * 0.38, y = i < 4 ? 0.77 : 1.25, o = 0.22;
        if (kind === 'bowl') { cy(W, toon('#2a2220'), u, y, o, 0.11, 0.1, 14, { rt: 1.25, cast: false }); cy(W, toon(c, { lit: 0.25 }), u, y + 0.1, o, 0.125, 0.012, 14, { cast: false }); sph(W, toon(c, { lit: 0.25 }), 0.05, u + 0.03, y + 0.12, o + 0.02, 1, 0.6, 1); }
        else { cy(W, toon('#f4f2ec'), u, y, o, 0.14, 0.02, 16, { cast: false }); for (let k = 0; k < 3; k++) sph(W, toon(c, { lit: 0.25 }), 0.045, u - 0.05 + k * 0.05, y + 0.045, o + (k % 2) * 0.03, 1.3, 0.7, 1); }
        bx(W, toon('#ffffff'), u - 0.05, u + 0.05, y + 0.005, y + 0.035, o + 0.13, o + 0.15, { cast: false });
      });
      pl(W, makeGlass(1.55, 0.94, 77, { drops: 0, alpha: 0.03 }), 1.55, 0.94, 2.475, 1.23, 0.445, 0, 0, { noLine: true });
      pl(W, new THREE.MeshBasicMaterial({ map: bannerTex(), color: new THREE.Color(1.05, 1.0, 0.95) }), 1.5, 0.36, 2.475, 2.12, 0.03, 0, 0);
    }
    // bay B (u -0.35..1.55): side entrance, indigo noren, lattice leaf, light-box stand sign, A-frame menu
    {
      const d0 = -0.2, d1 = 1.4;
      pl(W, new THREE.MeshBasicMaterial({ map: cafeTex(), color: new THREE.Color(1.2, 1.05, 0.82) }), d1 - d0, 2.3, (d0 + d1) / 2, Y0 + 1.15, 0.02, 0, 0);
      bx(W, stoneL, d0 - 0.05, d1 + 0.05, Y0, Y0 + 0.06, 0, 0.4);
      const l0 = 0.62, lz = 0.07;
      bx(W, woodD, l0, l0 + 0.05, Y0, 2.46, lz - 0.025, lz + 0.025); bx(W, woodD, d1 - 0.07, d1 - 0.02, Y0, 2.46, lz - 0.025, lz + 0.025);
      bx(W, woodD, l0, d1 - 0.02, Y0, Y0 + 0.08, lz - 0.025, lz + 0.025);
      pl(W, L('#ffb870', 0.85), d1 - l0 - 0.1, 2.25, (l0 + d1) / 2 - 0.02, Y0 + 1.2, lz - 0.01, 0, 0, { noLine: true });
      for (let k = 0; k < 7; k++) bx(W, woodD, l0 + 0.08 + k * 0.1, l0 + 0.1 + k * 0.1, Y0 + 0.08, 2.42, lz, lz + 0.03, { cast: false });
      for (let i = 0; i < 2; i++) {
        const n = new THREE.Mesh(new THREE.PlaneGeometry((d1 - d0) / 2 - 0.02, 0.66), new THREE.MeshBasicMaterial({ map: norenBlueTex('酒処'[i]), color: new THREE.Color(0.95, 0.95, 0.95), side: THREE.DoubleSide }));
        n.position.set(d0 + (i + 0.5) * ((d1 - d0) / 2), 2.12, 0.22); W.add(n);
      }
      cyl2(W, woodD, [d0 - 0.05, 2.46, 0.22], [d1 + 0.05, 2.46, 0.22], 0.02, 6);
      // electric stand sign (電飾スタンド看板)
      const sb = grp(W, 1.78, 0, 0.5);
      bx(sb, capM, -0.24, 0.24, Y0, Y0 + 0.08, -0.17, 0.17);
      bx(sb, toon('#f2f2ee'), -0.22, 0.22, Y0 + 0.08, Y0 + 0.98, -0.13, 0.13);
      const lbm = glow('#ffffff', 1.45, { map: lightBoxTex(), cat: 'iza' });
      [1, -1].forEach((s) => pl(sb, lbm, 0.4, 0.86, 0, Y0 + 0.53, s * 0.132, s > 0 ? 0 : Math.PI, 0));
      [1, -1].forEach((s) => pl(sb, lbm, 0.24, 0.86, s * 0.222, Y0 + 0.53, 0, s * Math.PI / 2, 0));
      halo(sb, 0, Y0 + 0.55, 0.2, '#fff4e0', 1.2, 0.18);
      // A-frame chalk menu
      const a = grp(W, -0.12, 0, 0.62, 0.25);
      bx(a, woodD, -0.28, -0.24, Y0, Y0 + 0.95, -0.14, 0.14); bx(a, woodD, 0.24, 0.28, Y0, Y0 + 0.95, -0.14, 0.14);
      pl(a, new THREE.MeshBasicMaterial({ map: chalkTex(), color: new THREE.Color(0.85, 0.85, 0.82) }), 0.5, 0.78, 0, Y0 + 0.52, 0.045, 0, 0);
      // a bracket lamp by the door
      bx(W, capM, -0.3, -0.18, 2.05, 2.3, 0.0, 0.14, { cast: false });
      bx(W, glow('#ffd59a', 2.2, { cat: 'iza' }), -0.29, -0.19, 2.08, 2.27, 0.14, 0.17, { cast: false });
    }
    // bay C (u -3.75..-0.35): long tategoshi lattice window onto the counter, sudare, bikes in front
    {
      const u0 = -3.6, u1 = -0.5, y0 = 0.95, y1 = 2.38;
      bx(W, woodM, u0, u1, Y0, y0, 0, 0.08);
      bx(W, woodD, u0 - 0.04, u1 + 0.04, y0 - 0.06, y0, 0, 0.18);
      pl(W, L('#ffc980', 1.0), u1 - u0, y1 - y0, (u0 + u1) / 2, (y0 + y1) / 2, 0.03, 0, 0, { noLine: true });
      for (let u = u0 + 0.05; u < u1; u += 0.075) bx(W, woodD, u - 0.016, u + 0.016, y0, y1, 0.05, 0.1, { cast: false });
      bx(W, woodD, u0, u1, 1.62, 1.66, 0.05, 0.11, { cast: false });
      pl(W, new THREE.MeshToonMaterial({ map: sudareTex(), gradientMap: RAMP }), 1.3, 0.5, -1.4, 2.14, 0.115, 0, 0);
      bicycle(g, ox(0.55), -3.45, 0.03, '#d8c7a0', 0, { type: 'basket', steer: -0.15, case: '#c9b88f' });
      bicycle(g, ox(0.62), -1.75, Math.PI + 0.04, '#2e5a3a', 0.11, { type: 'cross', steer: 0.12 });
    }
    // bay D (u -7.2..-3.75): drink vending machine, crates, planters, kitchen window, AC unit
    {
      vendingMachine(g, ox(0.42), -5.0, -Math.PI / 2, 1, 13);
      const crate = (u, y, c) => bx(W, toon(c), u - 0.22, u + 0.22, y, y + 0.28, 0.12, 0.46);
      crate(-6.05, Y0, '#c4552f'); crate(-6.05, Y0 + 0.28, '#d8643a'); crate(-6.55, Y0, '#2f6fb0');
      planter(W, -7.0, 0.28, 0.16, '#4a7f4a');
      bx(W, woodD, -6.75, -5.75, 1.45, 2.25, 0, 0.09);
      pl(W, L('#ffd8a0', 0.95), 0.88, 0.68, -6.25, 1.85, 0.095, 0, 0);
      for (let k = 1; k < 5; k++) bx(W, iron, -6.75 + k * 0.2 - 0.008, -6.75 + k * 0.2 + 0.008, 1.5, 2.2, 0.1, 0.12, { cast: false });
    }
    // corner: projecting shop-name sign (袖看板) on the upper floor + a nobori by the kerb
    {
      const u = 3.78, o0 = 0.06, o1 = 0.7;
      bx(W, woodD, u - 0.08, u + 0.08, 3.86, 5.76, o0, o1);
      const sm = glow('#ffffff', 1.4, { map: sodeTex(), cat: 'iza' });
      [1, -1].forEach((s) => pl(W, sm, o1 - o0 - 0.08, 1.8, u + s * 0.082, 4.81, (o0 + o1) / 2, s * Math.PI / 2, 0));
      [4.0, 5.6].forEach((y) => cyl2(W, iron, [u, y, 0], [u, y + 0.1, o0 + 0.1], 0.02, 4, { cast: false }));
      halo(W, u, 4.8, o1 * 0.6, '#ffe9c8', 2.4, 0.22);
      const nb = grp(g, ox(1.3), 0, 3.95, -Math.PI / 2);
      nobori(nb, 0, 0, '生ビール', '#c2181c', 4.4);
    }
    // ---- upper floor: balcony with lanterns, gold-framed shop board under goose-neck lamps, windows ----
    {
      const b0 = -7.0, b1 = -0.1, by = 3.56, bo = 0.5;
      bx(W, woodD, b0, b1, by, by + 0.1, 0, bo);
      for (let u = b0 + 0.05; u <= b1; u += 0.38) bx(W, woodD, u - 0.022, u + 0.022, by + 0.1, by + 0.95, bo - 0.06, bo - 0.02, { cast: false });
      bx(W, woodD, b0, b1, by + 0.9, by + 0.98, bo - 0.08, bo, { cast: false });
      bx(W, woodD, b0, b1, by + 0.42, by + 0.46, bo - 0.06, bo - 0.02, { cast: false });
      [-6.2, -4.3, -2.4, -0.7].forEach((u) => {
        chochin(W, u, by + 1.3, bo - 0.04, 0.11, '酒');
        cyl2(W, capM, [u, by + 1.44, bo - 0.04], [u, by + 1.62, bo - 0.04], 0.006, 3, { cast: false, noLine: true });
        bx(W, woodD, u - 0.02, u + 0.02, by + 1.6, by + 1.64, 0, bo, { cast: false });
      });
      halo(g, ox(0.6), by + 1.3, -3.5, '#ffd9a0', 3.6, 0.2);
      const latticeWin = (u, y, w, h, hex, sud) => {
        bx(W, woodD, u - w / 2 - 0.06, u + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.09);
        pl(W, L(hex, 1.0), w, h, u, y, 0.095, 0, 0);
        for (let k = 1; k < 4; k++) bx(W, woodD, u - w / 2 + (k * w) / 4 - 0.012, u - w / 2 + (k * w) / 4 + 0.012, y - h / 2, y + h / 2, 0.095, 0.115, { cast: false });
        for (let k = 1; k < 3; k++) bx(W, woodD, u - w / 2, u + w / 2, y - h / 2 + (k * h) / 3 - 0.012, y - h / 2 + (k * h) / 3 + 0.012, 0.095, 0.115, { cast: false });
        if (sud) pl(W, new THREE.MeshToonMaterial({ map: sudareTex(), gradientMap: RAMP }), w, h * 0.55, u, y + h * 0.22, 0.12, 0, 0);
      };
      latticeWin(-6.05, 4.85, 1.0, 1.15, '#ffc980', false);
      latticeWin(-3.9, 4.85, 1.0, 1.15, '#ffb0c8', true);
      latticeWin(-1.78, 4.85, 1.0, 1.15, '#ffc27a', false);
      latticeWin(0.95, 5.05, 0.9, 0.95, '#ffc980', true);
      latticeWin(2.45, 5.05, 0.9, 0.95, '#ffc27a', false);
      // gold-framed board
      const s0 = 0.35, s1 = 3.05;
      bx(W, woodD, s0 - 0.06, s1 + 0.06, 3.62, 4.42, 0, 0.12);
      pl(W, new THREE.MeshBasicMaterial({ map: goldSignTex('炭火焼鳥'), color: new THREE.Color(1.1, 1.05, 0.95) }), s1 - s0, 0.74, (s0 + s1) / 2, 4.02, 0.125, 0, 0, { cast: false });
      [0.8, 1.7, 2.6].forEach((u) => {
        cyl2(W, capM, [u, 4.42, 0.06], [u, 4.62, 0.38], 0.012, 4, { cast: false });
        bx(W, capM, u - 0.06, u + 0.06, 4.52, 4.62, 0.32, 0.46, { cast: false });
        bx(W, glow('#fff0c8', 2.6, { cat: 'iza' }), u - 0.045, u + 0.045, 4.515, 4.525, 0.33, 0.45, { cast: false });
      });
      halo(g, ox(0.4), 4.05, 1.7, '#ffd59a', 3.2, 0.24);
      // upstairs AC unit + downpipe
      bx(W, toon('#d6dae3', { lit: 0.35 }), -6.95, -6.35, 5.85, 6.25, 0, 0.3);
      cyl2(g, toon('#7b8498'), [X0 - 0.08, Y0, -7.05], [X0 - 0.08, 6.3, -7.05], 0.04, 6);
    }
  }

  /* ==================================================================== EAST - back of house (faces the LAWSON) */
  {
    const f = 'e';
    // kitchen windows: frosted glass behind iron grilles
    const kWin = (z, y, w, h) => {
      bxo(f, z - w / 2 - 0.06, z + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.08, woodD);
      plo(f, w, h, z, y, 0.085, L('#ffe2b8', 0.75));
      for (let k = 1; k < 6; k++) bxo(f, z - w / 2 + (k * w) / 6 - 0.01, z - w / 2 + (k * w) / 6 + 0.01, y - h / 2, y + h / 2, 0.1, 0.12, iron, { cast: false });
      bxo(f, z - w / 2, z + w / 2, y - 0.01, y + 0.01, 0.1, 0.12, iron, { cast: false });
    };
    kWin(-5.45, 1.8, 0.8, 0.6);
    kWin(-2.5, 1.8, 0.8, 0.6);
    // staff door with a small steel hood and a bare bulb
    bxo(f, -4.85, -3.85, Y0, 2.25, 0, 0.08, toon('#4d5c58'));
    bxo(f, -4.9, -3.8, 2.25, 2.32, 0, 0.1, woodD);
    bxo(f, -4.8, -4.7, 1.0, 1.2, 0.08, 0.11, iron, { cast: false });
    bxo(f, -5.05, -3.65, 2.5, 2.56, 0, 0.55, iron);
    bxo(f, -4.4, -4.3, 2.36, 2.5, 0.25, 0.35, capM, { cast: false });
    bxo(f, -4.39, -4.31, 2.3, 2.36, 0.26, 0.34, glow('#ffe6b0', 2.2, { cat: 'iza' }), { cast: false });
    halo(g, X1 + 0.3, 2.3, -4.35, '#ffe0a0', 1.4, 0.35);
    // propane cylinders chained to the wall, gas meter, utility boxes
    [-6.55, -6.22].forEach((z) => { cy(g, toon('#c9ccd2'), X1 + 0.2, Y0, z, 0.15, 1.15, 14); cy(g, toon('#8a919c'), X1 + 0.2, Y0 + 1.15, z, 0.07, 0.12, 8); });
    bxo(f, -6.72, -6.05, 0.95, 0.98, 0.05, 0.37, iron, { cast: false });
    bxo(f, -3.5, -3.15, 1.15, 1.6, 0, 0.18, toon('#c7ccd4'));
    // AC outdoor units under the stair landing
    [-1.25, -2.0].forEach((z) => { bxo(f, z - 0.32, z + 0.32, Y0, Y0 + 0.55, 0, 0.3, toon('#d6dae3', { lit: 0.35 })); });
    // 2F: plain lattice windows of the flat upstairs, one with a bamboo blind
    const latticeWin = (z, y, w, h, hex = '#ffc980') => {
      bxo(f, z - w / 2 - 0.06, z + w / 2 + 0.06, y - h / 2 - 0.06, y + h / 2 + 0.06, 0, 0.09, woodD);
      plo(f, w, h, z, y, 0.095, L(hex, 0.9));
      for (let k = 1; k < 4; k++) bxo(f, z - w / 2 + (k * w) / 4 - 0.012, z - w / 2 + (k * w) / 4 + 0.012, y - h / 2, y + h / 2, 0.095, 0.115, woodD, { cast: false });
      for (let k = 1; k < 3; k++) bxo(f, z - w / 2, z + w / 2, y - h / 2 + (k * h) / 3 - 0.012, y - h / 2 + (k * h) / 3 + 0.012, 0.095, 0.115, woodD, { cast: false });
    };
    latticeWin(2.6, 4.9, 1.0, 1.1, '#ffc27a');
    latticeWin(0.55, 4.9, 1.0, 1.1, '#ffb0c8');
    latticeWin(-5.6, 4.9, 1.0, 1.1, '#ffc980');
    latticeWin(-3.2, 4.9, 1.0, 1.1, '#ffc27a');
    {
      const t = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#d9b36a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? '#c79a4c' : '#e3c27c'; c.fillRect(x, 0, 6, h); } c.fillStyle = '#6b4a2a'; c.fillRect(0, h * 0.72, w, 5); });
      plo(f, 1.0, 0.7, 0.55, 5.1, 0.135, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.9, 0.8, 0.65) }));
    }
    bx(g, roofTile, X1, X1 + 0.5, 6.3, 6.42, -7.0, 3.4);
    // neighbourhood notice board by the front corner, staff bicycle, a planter
    {
      const bz = Z1 - 0.8, by = 1.7;
      bxo(f, bz - 0.62, bz + 0.62, by - 0.45, by + 0.45, 0, 0.07, woodD);
      plo(f, 1.2, 0.84, bz, by, 0.075, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.45, 0.32) }));
      [[3, -0.38, 0.1, 0.34, 0.5], [4, 0.0, 0.12, 0.34, 0.5], [5, 0.38, 0.05, 0.3, 0.44], [2, -0.1, -0.22, 0.3, 0.4]].forEach(([p, du, dv, w, h]) => plo(f, w, h, bz + du, by + dv, 0.085, new THREE.MeshBasicMaterial({ map: posterTex(p), color: new THREE.Color(0.78, 0.78, 0.8) })));
      bxo(f, bz - 0.66, bz + 0.66, by + 0.45, by + 0.5, 0, 0.3, roofTile);
      plo(f, 1.2, 0.84, bz, by, 0.09, makeGlass(1.2, 0.84, 21, { drops: 0.7, alpha: 0.04 }), { noLine: true });
    }
    bicycle(g, X1 + 0.55, Z1 + 0.0 - 0.3, 0.0, '#3a8fb8', 0, { type: 'basket', steer: 0.18 });
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
  // eave drips: front + street side (along the fascia), the staff-door hood at the back
  for (let x = X0 - 0.75; x < X1 + 0.25; x += 0.9 + R() * 0.3) drips.push([x, EDGE_Y, Z1 + PD, Y0 + 0.01]);
  for (let z = Z0 + 0.1; z < Z1 + 0.8; z += 1.0 + R() * 0.4) drips.push([X0 - PD, EDGE_Y, z, Y0 + 0.01]);
  drips.push([X1 + 0.53, 2.5, -4.6, Y0 + 0.01], [X1 + 0.53, 2.5, -4.0, Y0 + 0.01]);

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

  return g;
}
