import * as THREE from 'three';
import { canvasTex, FONT, roundRect, rng, vtext } from './core.js';

const memo = new Map();
const once = (k, f) => {
  if (!memo.has(k)) memo.set(k, f());
  return memo.get(k);
};

export function T(g, s, x, y, size, color, o = {}) {
  g.font = `${o.weight || 700} ${size}px ${FONT}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = o.base || 'middle';
  if (o.stroke) {
    g.lineJoin = 'round';
    g.lineWidth = o.sw || size * 0.14;
    g.strokeStyle = o.stroke;
    g.strokeText(s, x, y);
  }
  g.fillStyle = color;
  g.fillText(s, x, y);
}

/* ---------------------------------------------------------------- brand sign (LAWSON style: blue / white / pink-red line) */
// (BRAND.teal / BRAND.orange are kept as property names because the rest of the scene already uses them;
//  they now hold LAWSON blue and the thin red-pink accent.)
export const BRAND = { teal: '#1c63c4', orange: '#e0386a', navy: '#0d2a5e', cream: '#f6f9fd', sky: '#3a93e0' };
const SLAB = '"Rockwell Extra Bold","Rockwell","Roboto Slab","Georgia","Times New Roman",serif';

/** blue milk-bottle shield ("LAWSON STATION") */
export function logo(g, cx, cy, r) {
  g.save();
  g.translate(cx, cy);
  const sh = () => {
    g.beginPath();
    g.moveTo(-r * 0.78, -r * 0.82);
    g.quadraticCurveTo(0, -r * 1.02, r * 0.78, -r * 0.82);
    g.lineTo(r * 0.86, r * 0.35);
    g.quadraticCurveTo(r * 0.78, r * 0.82, 0, r * 1.0);
    g.quadraticCurveTo(-r * 0.78, r * 0.82, -r * 0.86, r * 0.35);
    g.closePath();
  };
  sh(); g.fillStyle = '#f6f9fd'; g.fill();
  g.save(); g.scale(0.92, 0.92); sh(); g.fillStyle = '#1c63c4'; g.fill(); g.restore();
  g.save(); g.scale(0.82, 0.82); sh(); g.lineWidth = r * 0.045; g.strokeStyle = '#f6f9fd'; g.stroke(); g.restore();
  // milk bottle
  g.fillStyle = '#f6f9fd';
  roundRect(g, -r * 0.2, -r * 0.18, r * 0.4, r * 0.62, r * 0.1); g.fill();
  roundRect(g, -r * 0.11, -r * 0.4, r * 0.22, r * 0.28, r * 0.05); g.fill();
  g.fillStyle = '#1c63c4'; g.fillRect(-r * 0.13, -r * 0.43, r * 0.26, r * 0.06);
  g.fillStyle = '#f6f9fd';
  g.font = `900 ${r * 0.25}px ${SLAB}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LAWSON', 0, -r * 0.62);
  g.font = `800 ${r * 0.2}px ${SLAB}`;
  g.fillText('STATION', 0, r * 0.66);
  g.restore();
}

export function signTex(w, h) {
  return canvasTex(w, h, (g) => {
    const s = h / 240;
    // blue fascia, built from panels with fine white seams (like the real modular fascia)
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1f6fd2'); gr.addColorStop(1, '#1858b4');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    const pw = 205 * s;
    for (let x = pw; x < w - 4; x += pw) g.fillRect(x - 1.5 * s, 14 * s, 3 * s, h - 28 * s);
    // white trim top / bottom + thin pink-red line
    g.fillStyle = '#f6f9fd'; g.fillRect(0, 0, w, 14 * s); g.fillRect(0, h - 26 * s, w, 26 * s);
    g.fillStyle = BRAND.orange; g.fillRect(0, h - 36 * s, w, 7 * s);
    // wordmark
    g.fillStyle = '#f6f9fd';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const logoR = 86 * s;
    const cxText = w > 1500 ? w * 0.47 : w * 0.43;
    g.font = `900 ${128 * s}px ${SLAB}`;
    g.lineJoin = 'round'; g.lineWidth = 7 * s; g.strokeStyle = '#f6f9fd';
    g.strokeText('LAWSON', cxText, h / 2 - 8 * s);
    g.fillText('LAWSON', cxText, h / 2 - 8 * s);
    g.font = `800 ${34 * s}px ${FONT}`;
    g.fillText('ローソン', cxText + (w > 1500 ? 300 : 230) * s, h / 2 + 66 * s * 0.0 + 52 * s);
    logo(g, w - logoR - 22 * s, h / 2 - 6 * s, logoR);
  });
}

/* ---------------------------------------------------------------- posters */
export function posterTex(i) {
  return once('poster' + i, () =>
    canvasTex(512, 724, (g, w, h) => {
      const R = rng(i * 31 + 5);
      const grad = (a, b) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, a); gr.addColorStop(1, b);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      };
      if (i === 0) {
        grad('#ffd9e6', '#ff8fb5');
        g.fillStyle = '#fff6ee'; g.beginPath(); g.ellipse(w / 2, 400, 190, 100, 0, 0, 7); g.fill();
        g.fillStyle = '#ffc7a0'; g.beginPath(); g.ellipse(w / 2, 380, 150, 70, 0, 0, 7); g.fill();
        for (let k = 0; k < 6; k++) {
          const x = 140 + k * 46, y = 330 + (k % 2) * 16;
          g.fillStyle = '#e8203f'; g.beginPath(); g.moveTo(x - 24, y - 14); g.quadraticCurveTo(x, y + 44, x + 24, y - 14); g.quadraticCurveTo(x, y - 30, x - 24, y - 14); g.fill();
          g.fillStyle = '#3aa35a'; g.fillRect(x - 12, y - 24, 24, 8);
        }
        T(g, '新作', w / 2, 90, 120, '#fff', { stroke: '#e0457b', sw: 18 });
        T(g, 'スイーツ', w / 2, 210, 96, '#fff', { stroke: '#e0457b', sw: 16 });
        T(g, 'とろける いちごプリン', w / 2, 560, 44, '#7a1f44');
        T(g, '¥198', w / 2, 640, 80, '#e8203f', { stroke: '#fff', sw: 14 });
      } else if (i === 1) {
        grad('#6b3a22', '#2a1610');
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(170, 290); g.lineTo(340, 290); g.lineTo(318, 470); g.quadraticCurveTo(255, 500, 192, 470); g.closePath(); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 16; g.beginPath(); g.arc(344, 350, 42, -1.3, 1.3); g.stroke();
        g.fillStyle = '#6d3a1d'; g.fillRect(180, 296, 150, 20);
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 10; g.lineCap = 'round';
        [200, 255, 310].forEach((x, k) => { g.beginPath(); g.moveTo(x, 270); g.bezierCurveTo(x - 24, 230, x + 24, 200, x, 150 - k * 6); g.stroke(); });
        T(g, 'HOT', w / 2, 80, 90, '#ffd9a0', { weight: 900 });
        T(g, 'COFFEE', w / 2, 170, 70, '#ffd9a0', { weight: 900 });
        T(g, 'いれたて ホット', w / 2, 580, 44, '#fff');
        T(g, '¥110', w / 2, 650, 84, '#ffb347', { stroke: '#2a1610', sw: 14 });
      } else if (i === 2) {
        grad('#bfe8ff', '#2d7bd6');
        for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 5, 0, 7); g.fill(); }
        g.fillStyle = '#d8dde8'; roundRect(g, 190, 230, 130, 270, 20); g.fill();
        g.fillStyle = '#1b4fb5'; g.fillRect(190, 300, 130, 130);
        g.fillStyle = '#ffd24a'; g.fillRect(190, 340, 130, 18);
        T(g, '冷え冷え', w / 2, 90, 100, '#fff', { stroke: '#1b4fb5', sw: 16 });
        T(g, 'ビール', w / 2, 175, 70, '#fff', { stroke: '#1b4fb5', sw: 14 });
        T(g, '今夜は 雨でも 乾杯', w / 2, 570, 40, '#0c2f6b');
        T(g, '¥218', w / 2, 650, 80, '#fff', { stroke: '#1b4fb5', sw: 14 });
      } else if (i === 3) {
        grad('#0b1240', '#5b3a8a');
        for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; g.beginPath(); g.arc(R() * w, R() * h * 0.8, 1 + R() * 2.4, 0, 7); g.fill(); }
        g.fillStyle = '#ffeaa5'; g.beginPath(); g.arc(300, 250, 90, 0, 7); g.fill();
        g.fillStyle = '#5b3a8a'; g.beginPath(); g.arc(340, 232, 82, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 4;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(90 + k * 120, 80 + k * 30); g.lineTo(190 + k * 120, 150 + k * 30); g.stroke(); }
        T(g, '流星フェア', w / 2, 460, 86, '#fff', { stroke: '#2a1a5a', sw: 14 });
        T(g, '星空マート限定', w / 2, 560, 44, '#ffd9f2');
        T(g, 'STARFALL FAIR', w / 2, 640, 44, '#9fd0ff', { weight: 600 });
      } else if (i === 4) {
        grad('#07102e', '#241046');
        [[150, 220, '#ff6aa8'], [360, 160, '#ffd24a'], [300, 330, '#5de3ff'], [120, 400, '#8cff8a']].forEach(([x, y, c]) => {
          g.strokeStyle = c; g.lineWidth = 5;
          for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(t) * 20, y + Math.sin(t) * 20); g.lineTo(x + Math.cos(t) * 78, y + Math.sin(t) * 78); g.stroke(); }
        });
        T(g, '夏祭り', w / 2, 500, 110, '#fff', { stroke: '#d6336c', sw: 18 });
        T(g, '花火大会', w / 2, 600, 70, '#ffd24a');
        T(g, '8/23 SAT  19:30', w / 2, 672, 38, '#bfe0ff', { weight: 600 });
      } else if (i === 5) {
        g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#d11'; g.fillRect(0, 0, w, 120);
        T(g, '迷い猫', w / 2, 62, 100, '#fff');
        g.fillStyle = '#141414';
        g.beginPath(); g.ellipse(w / 2, 330, 110, 90, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(w / 2 - 100, 270); g.lineTo(w / 2 - 90, 190); g.lineTo(w / 2 - 40, 245); g.fill();
        g.beginPath(); g.moveTo(w / 2 + 100, 270); g.lineTo(w / 2 + 90, 190); g.lineTo(w / 2 + 40, 245); g.fill();
        g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(w / 2 - 40, 320, 18, 22, 0, 0, 7); g.ellipse(w / 2 + 40, 320, 18, 22, 0, 0, 7); g.fill();
        T(g, 'この子を 探しています', w / 2, 470, 40, '#222');
        T(g, '黒猫 / 首輪は赤', w / 2, 530, 36, '#222');
        T(g, '090-0000-0000', w / 2, 640, 56, '#d11');
      } else {
        g.fillStyle = '#c2181c'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff'; g.fillRect(20, 20, w - 40, h - 40);
        g.fillStyle = '#c2181c'; g.fillRect(34, 34, w - 68, h - 68);
        T(g, 'おでん', w / 2, 190, 170, '#fff', { weight: 900 });
        T(g, '始めました', w / 2, 340, 90, '#ffe9a8');
        g.fillStyle = '#d7dde6'; g.beginPath(); g.ellipse(w / 2, 470, 160, 40, 0, 0, 7); g.fill();
        g.fillStyle = '#f0a43a'; g.beginPath(); g.ellipse(w / 2, 462, 140, 30, 0, 0, 7); g.fill();
        g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(w / 2 - 50, 462, 24, 0, 7); g.fill();
        g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(w / 2 + 30, 462, 22, 0, 7); g.fill();
        T(g, 'あつあつ 100円〜', w / 2, 600, 52, '#fff');
      }
    })
  );
}

/* ---------------------------------------------------------------- magazines */
export function magAtlas() {
  return once('mag', () =>
    canvasTex(1024, 712, (g, w, h) => {
      const R = rng(11);
      const titles = ['週刊 ミライ', 'MODE', 'ゲーム王', '旅と温泉', 'ねこ♡', 'シネマ', 'ごはん', 'ANIME'];
      const pal = [['#ff7aa8', '#ffd1e0'], ['#2c3e8f', '#8fb4ff'], ['#2fbf8f', '#d4ffe9'], ['#f0a43a', '#fff0c8'], ['#a05bd6', '#f1ddff'], ['#d33', '#ffd1d1'], ['#4db6ff', '#e4f5ff'], ['#ff5a3c', '#ffe3c4']];
      for (let n = 0; n < 8; n++) {
        const tx = (n % 4) * 256, ty = Math.floor(n / 4) * 356;
        const gr = g.createLinearGradient(tx, ty, tx, ty + 356);
        gr.addColorStop(0, pal[n][0]); gr.addColorStop(1, pal[n][1]);
        g.fillStyle = gr; g.fillRect(tx, ty, 256, 356);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath(); g.arc(tx + 128, ty + 200, 62, 0, 7); g.fill();
        g.fillStyle = '#3a2a2a'; g.beginPath(); g.arc(tx + 128, ty + 180, 66, Math.PI, 0); g.fill();
        g.fillStyle = '#ffd9c2'; g.beginPath(); g.arc(tx + 128, ty + 210, 50, 0, 7); g.fill();
        T(g, titles[n], tx + 128, ty + 44, 38, '#fff', { stroke: 'rgba(0,0,0,0.45)', sw: 7 });
        for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#fff' : '#ffe27a'; g.fillRect(tx + 14, ty + 276 + k * 17, 60 + R() * 110, 8); }
        g.fillStyle = '#fff'; g.fillRect(tx + 196, ty + 300, 44, 44);
        g.fillStyle = '#111'; for (let k = 0; k < 8; k++) g.fillRect(tx + 200 + k * 5, ty + 304, 2 + (k % 3), 36);
      }
    }, { aniso: 4 })
  );
}

/* ---------------------------------------------------------------- cigarette / pack wall */
export function packWall() {
  return once('packs', () =>
    canvasTex(1024, 640, (g, w, h) => {
      const R = rng(21);
      g.fillStyle = '#20242e'; g.fillRect(0, 0, w, h);
      const cols = ['#f4f4f0', '#d4202c', '#1e57b8', '#e6c14a', '#2ea05a', '#111', '#ff7b2c', '#8b3fc4', '#7ac8e8'];
      const rows = 8, per = 24;
      for (let r = 0; r < rows; r++) {
        g.fillStyle = '#3b4252'; g.fillRect(0, r * 80 + 70, w, 10);
        for (let c = 0; c < per; c++) {
          const x = 6 + c * (w / per), pw = w / per - 6;
          const col = cols[(R() * cols.length) | 0];
          g.fillStyle = col; g.fillRect(x, r * 80 + 12, pw, 56);
          g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, r * 80 + 12, pw, 14);
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 3, r * 80 + 34, pw - 6, 5);
        }
      }
    }, { aniso: 4 })
  );
}

/* ---------------------------------------------------------------- interior floor */
export function floorTex(W, H) {
  return once('floor', () =>
    canvasTex(2048, 1212, (g, w, h) => {
      const ppm = w / W; // px per metre
      const tile = 0.6 * ppm;
      for (let y = 0; y < h / tile + 1; y++)
        for (let x = 0; x < w / tile + 1; x++) {
          g.fillStyle = (x + y) % 2 ? '#e6dcc4' : '#dbd0b6';
          g.fillRect(x * tile, y * tile, tile, tile);
        }
      g.strokeStyle = '#cbc5b3'; g.lineWidth = 2;
      for (let x = 0; x < w; x += tile) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const X = (x) => (x + 5.4) * ppm, Z = (z) => (z + 4.4) * ppm;
      // entrance mat
      g.fillStyle = '#3b4c5c'; g.fillRect(X(1.3), Z(0.55), 1.8 * ppm, 0.85 * ppm);
      g.fillStyle = '#4e6377'; for (let i = 0; i < 9; i++) g.fillRect(X(1.3) + i * 0.2 * ppm, Z(0.55), 0.1 * ppm, 0.85 * ppm);
      // guide line (yellow tactile / floor navigation)
      g.strokeStyle = '#f2c230'; g.lineWidth = 0.07 * ppm; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(2.2), Z(0.5)); g.lineTo(X(2.2), Z(-0.55)); g.lineTo(X(1.6), Z(-0.55)); g.stroke();
      const arrow = (x, z, a) => {
        g.save(); g.translate(X(x), Z(z)); g.rotate(a); g.fillStyle = '#1f6fd0';
        g.beginPath(); g.moveTo(-0.28 * ppm, -0.07 * ppm); g.lineTo(0.05 * ppm, -0.07 * ppm); g.lineTo(0.05 * ppm, -0.2 * ppm); g.lineTo(0.3 * ppm, 0); g.lineTo(0.05 * ppm, 0.2 * ppm); g.lineTo(0.05 * ppm, 0.07 * ppm); g.lineTo(-0.28 * ppm, 0.07 * ppm); g.closePath(); g.fill(); g.restore();
      };
      arrow(-1.6, -1.4, 0); arrow(-1.6, 0.0, 0); arrow(-1.9, -2.9, Math.PI);
      // queue line
      g.strokeStyle = '#f2c230'; g.lineWidth = 0.05 * ppm; g.setLineDash([0.2 * ppm, 0.12 * ppm]);
      g.beginPath(); g.moveTo(X(0.9), Z(-0.55)); g.lineTo(X(3.9), Z(-0.55)); g.stroke();
      g.setLineDash([]);
      T(g, 'レジ →', X(3.3), Z(-0.32), 0.17 * ppm, '#1f6fd0', { weight: 800 });
      T(g, 'いらっしゃいませ', X(2.2), Z(1.12), 0.17 * ppm, '#e9f4f4', { weight: 700 });
      // scuffs
      const R = rng(5);
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(120,110,90,${R() * 0.06})`; g.fillRect(R() * w, R() * h, 3 + R() * 10, 2); }
    }, { aniso: 16, scale: 1.5 })
  );
}

/* ---------------------------------------------------------------- small label boards */
export function labelTex(text, bg, fg, w = 512, h = 128, size = 0.5) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    T(g, text, w / 2, h / 2 + 2, h * size, fg, { weight: 800 });
  });
}

export function hangSignTex(text, bg, fg) {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, h - 14, w, 14);
    T(g, text, w / 2, h / 2 - 6, 84, fg, { weight: 900 });
  });
}

export function exitSignTex() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#0c7a3c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(150, 38, 10, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(150, 52); g.lineTo(130, 78); g.lineTo(110, 70); g.moveTo(138, 62); g.lineTo(158, 80); g.lineTo(172, 110); g.moveTo(130, 78); g.lineTo(140, 108); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(40, 30, 50, 70); g.fillStyle = '#0c7a3c'; g.fillRect(48, 38, 34, 54);
    T(g, '非常口', 200, 106, 22, '#fff', { weight: 800 });
  });
}

export { vtext };
