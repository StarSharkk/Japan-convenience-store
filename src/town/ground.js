import * as THREE from 'three';
import { reg, toon, canvasTex, rng, FONT, RAMP, patchToon } from '../core.js';
import { makeGroundMaterial } from '../ground.js';
import { MAP, OLD, BLOCKS, OUTLINE, ROADS, LANES, LAKE, lakeF, roadH, inPoly, PAV, RAIL, CROSSINGS, PLOTS, inOld, groundY } from './layout.js';
import { surface, walls, offsetConvex, clipConvex, area } from './geom.js';
import { IZA_AWAY } from '../site.js';

/* ====================================================================================================
   Town ground: one painted canvas for the whole expanded map (roads, sidewalks, lawns, lots, verges),
   a road layer, raised blocks with kerbs / stone retaining walls, and the new irregular plinth.
   The original board keeps its own (sharper) canvas; this one skips the board's square.
   ==================================================================================================== */

const K = 40; // px per unit
const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
const X = (x) => (x - MAP.x0) * K;
const Z = (z) => (z - MAP.z0) * K;

const COL = {
  asphalt: '#1b2133',
  tileA: '#3d4661', tileB: '#394259',
  grass: '#22403a', grass2: '#1c3730', forest: '#1a3029', earth: '#3a3633', earth2: '#332f2c',
  gravel: '#3d3c46', paving: '#353d55', paving2: '#313951', sand: '#4a4636', lakebed: '#14282b',
  white: '#cfd5e2', gutter: '#10151f', yellow: '#c7a933',
};

function polyPath(g, poly) {
  g.beginPath();
  poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
  g.closePath();
}

function tilePattern(g, a, b, step = 0.75) {
  const s = Math.round(step * K);
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const t = c.getContext('2d');
  [[0, 0, a], [s, 0, b], [0, s, b], [s, s, a]].forEach(([x, y, col]) => { t.fillStyle = col; t.fillRect(x, y, s, s); });
  t.strokeStyle = 'rgba(8,10,24,0.55)'; t.lineWidth = 2;
  t.strokeRect(1, 1, s - 1, s - 1); t.strokeRect(s + 1, 1, s - 1, s - 1); t.strokeRect(1, s + 1, s - 1, s - 1); t.strokeRect(s + 1, s + 1, s - 1, s - 1);
  return g.createPattern(c, 'repeat');
}

/* ---------------------------------------------------------------- the painted canvas */
function drawTown(g) {
  const R = rng(2024);
  const rect = (x0, x1, z0, z1, c) => { g.fillStyle = c; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K); };
  const line = (x0, z0, x1, z1, c, w) => { g.strokeStyle = c; g.lineWidth = w * K; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const dash = (x0, z0, x1, z1, len, gap, c, w, skip = () => false) => {
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    for (let d = 0; d < L; d += len + gap) {
      const ax = x0 + dx * d, az = z0 + dz * d, bx = x0 + dx * Math.min(d + len, L), bz = z0 + dz * Math.min(d + len, L);
      if (skip((ax + bx) / 2, (az + bz) / 2)) continue;
      line(ax, az, bx, bz, c, w);
    }
  };
  const blob = (x, z, r, rgba) => {
    const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * K);
    gr.addColorStop(0, rgba); gr.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(X(x) - r * K, Z(z) - r * K, 2 * r * K, 2 * r * K);
  };

  /* asphalt + soft tonal drifts */
  rect(MAP.x0, MAP.x1, MAP.z0, MAP.z1, COL.asphalt);
  for (let i = 0; i < 160; i++) blob(MAP.x0 + R() * W, MAP.z0 + R() * H, 1.5 + R() * 4, R() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,14,0.05)');

  /* blocks */
  const tiles = tilePattern(g, COL.tileA, COL.tileB);
  const pave = tilePattern(g, COL.paving, COL.paving2, 0.6);
  BLOCKS.forEach((b) => {
    g.save();
    polyPath(g, b.poly);
    g.clip();
    const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
    const scatter = (n, col, rMin, rMax) => { for (let i = 0; i < n; i++) blob(bx0 + R() * (bx1 - bx0), bz0 + R() * (bz1 - bz0), rMin + R() * (rMax - rMin), col); };
    if (b.surf === 'forest') {
      g.fillStyle = COL.forest; g.fill();
      scatter(90, 'rgba(70,140,110,0.18)', 0.8, 2.6);
      scatter(60, 'rgba(6,20,16,0.35)', 0.6, 1.8);
      // gravel court of the (future) shrine + the approach from the stairs
      const p = PLOTS.find((q) => q.id === 'F-shrine').rect;
      g.fillStyle = COL.gravel; g.fillRect(X(p[0] - 1), Z(p[2] - 1), (p[1] - p[0] + 2) * K, (p[3] - p[2] + 2) * K);
      g.fillStyle = '#45444e'; g.fillRect(X(-2.6), Z(p[3] + 1), 1.4 * K, (-23 - p[3] - 1) * K);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#55545e'; g.fillRect(X(-2.5), Z(p[3] + 1.4 + i * 0.85), 1.2 * K, 0.5 * K); }
    } else if (b.surf === 'plaza') {
      g.fillStyle = pave; g.fill();
    } else if (b.surf === 'verge') {
      g.fillStyle = COL.grass; g.fill();
      scatter(Math.round((bx1 - bx0) * 3), 'rgba(70,140,110,0.16)', 0.6, 2.0);
    } else if (b.surf === 'park') {
      g.fillStyle = COL.grass; g.fill(); // replaced pixel-by-pixel below
    } else if (b.surf === 'lots') {
      g.fillStyle = COL.grass2; g.fill();
      // vacant lots (future houses): packed earth with grass at the edges
      PLOTS.filter((q) => q.block === b.id).forEach((q) => {
        const [x0, x1, z0, z1] = q.rect;
        g.fillStyle = COL.earth; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
        for (let i = 0; i < 10; i++) blob(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), 0.5 + R() * 1.3, 'rgba(60,110,80,0.22)');
        for (let i = 0; i < 6; i++) blob(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), 0.4 + R() * 0.9, 'rgba(10,8,6,0.25)');
      });
      scatter(40, 'rgba(70,140,110,0.14)', 0.6, 1.8);
    } else {
      // shops / walk: paving with darker concrete lots
      g.fillStyle = pave; g.fill();
      PLOTS.filter((q) => q.block === b.id).forEach((q) => {
        const [x0, x1, z0, z1] = q.rect;
        g.fillStyle = q.type === 'public' ? COL.grass : '#2f3548'; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
        for (let i = 0; i < 6; i++) blob(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), 0.4 + R() * 1.0, 'rgba(0,0,10,0.18)');
      });
    }
    g.restore();
  });

  /* しずく花店 corner (town/florist.js): sidewalk pavers along both kerbs with a guide strip, the shop's tiled
     forecourt, the planting strip between the shop and the house, the house's gravel yard (own rng: the rest
     of the town paints exactly as before) */
  {
    const Rf = rng(4321);
    g.fillStyle = tilePattern(g, '#424b66', '#3c445d', 0.45);
    g.fillRect(X(12), Z(4.0), 18 * K, 2.5 * K); // Kaigan-dori sidewalk
    g.fillRect(X(12), Z(-7.2), 2.2 * K, 11.2 * K); // Hoshizora-dori side
    rect(12.7, 29.8, 5.0, 5.3, '#9b8227'); // linear guide blocks (bars run with the walk)
    for (let x = 12.7; x < 29.75; x += 0.3) for (let k = 0; k < 4; k++) rect(x + 0.03, x + 0.27, 5.04 + k * 0.065, 5.065 + k * 0.065, '#d3b53a');
    line(12, 4.0, 30, 4.0, 'rgba(10,12,26,0.55)', 0.05);
    g.fillStyle = tilePattern(g, '#5a4a52', '#52434b', 0.4);
    g.fillRect(X(14.2), Z(2.6), 10.4 * K, 1.4 * K); // forecourt (terracotta tiles)
    g.fillRect(X(12.2), Z(2.0), 2.4 * K, 2.0 * K);
    rect(21.85, 24.55, -7.0, 2.7, COL.earth); // planting strip
    for (let i = 0; i < 26; i++) blob(21.9 + Rf() * 2.6, -7 + Rf() * 9.7, 0.3 + Rf() * 0.6, 'rgba(60,110,80,0.3)');
    rect(24.55, 29.45, 1.0, 3.85, COL.gravel); // house yard
    for (let i = 0; i < 40; i++) blob(24.6 + Rf() * 4.8, 1.0 + Rf() * 2.8, 0.1 + Rf() * 0.25, Rf() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,10,0.12)');
    rect(24.55, 29.45, -4.6, 1.0, COL.paving2); // round the house
  }
  // the izakaya's lot in the west block (site.js IZA_AWAY): paving under it, its street side and its frontage
  if (IZA_AWAY) {
    const [x0, x1, z0] = IZA_AWAY.rect;
    g.fillStyle = tilePattern(g, COL.paving, COL.paving2, 0.6);
    g.fillRect(X(x0 - 1.3), Z(z0 - 0.5), (x1 - x0 + 2.1) * K, (6.5 - z0 + 0.5) * K);
  }

  /* lake park: grass, sand beach, lake bed (per pixel from the same field the terrain uses) */
  {
    const park = BLOCKS.find((b) => b.id === 'lakePark');
    const px0 = Math.floor(X(-48)), px1 = Math.ceil(X(-16.4)), pz0 = Math.floor(Z(-44)), pz1 = Math.ceil(Z(-22.9));
    const img = g.getImageData(px0, pz0, px1 - px0, pz1 - pz0);
    const d = img.data;
    const c = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const cg = c(COL.grass), cg2 = c('#2a4a3e'), cs = c(COL.sand), cb = c(COL.lakebed);
    for (let j = 0; j < pz1 - pz0; j++) {
      const z = MAP.z0 + (pz0 + j + 0.5) / K;
      for (let i = 0; i < px1 - px0; i++) {
        const x = MAP.x0 + (px0 + i + 0.5) / K;
        if (!inPoly(x, z, park.poly)) continue;
        const f = lakeF(x, z);
        const n = 0.5 + 0.5 * Math.sin(x * 2.1 + z * 1.3) * Math.cos(z * 1.7 - x * 0.6);
        let col;
        if (f < 0.985) col = cb;
        else if (f < 1.075 + n * 0.035) col = cs;
        else { const k = Math.min(1, (f - 1.07) * 3); col = [cg[0] + (cg2[0] - cg[0]) * n * k, cg[1] + (cg2[1] - cg[1]) * n * k, cg[2] + (cg2[2] - cg[2]) * n * k]; }
        const o = (j * (px1 - px0) + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
      }
    }
    g.putImageData(img, px0, pz0);
  }

  /* sidewalk bands along the block edges (a tile-patterned stroke clipped to the block) */
  BLOCKS.forEach((b) => {
    const band = { lots: 1.1, shops: 1.5, walk: 9, park: 0.9 }[b.surf];
    if (!band) return;
    g.save(); polyPath(g, b.poly); g.clip();
    g.strokeStyle = tiles; g.lineWidth = band * 2 * K; polyPath(g, b.poly); g.stroke();
    g.restore();
  });

  /* rail corridor: gravel shoulder under the track + the footpath over the sando crossing */
  g.save();
  BLOCKS.filter((b) => b.surf === 'verge' && b.id.startsWith('corr')).forEach((b) => { polyPath(g, b.poly); });
  g.clip();
  g.strokeStyle = COL.gravel; g.lineWidth = 4.2 * K; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(X(RAIL.x0), Z(RAIL.z)); g.lineTo(X(RAIL.xCurve), Z(RAIL.z));
  g.arc(X(RAIL.xCurve), Z(RAIL.z - RAIL.R), RAIL.R * K, Math.PI / 2, 0, true);
  g.lineTo(X(RAIL.xNorth), Z(RAIL.zEnd - 2)); g.stroke();
  const sd = CROSSINGS.find((c) => c.id === 'sando');
  g.fillStyle = '#46454f'; g.fillRect(X(sd.x0), Z(-23), (sd.x1 - sd.x0) * K, 8 * K);
  // platform-side paving next to the station
  g.fillStyle = tiles; g.fillRect(X(12), Z(-23), 10.5 * K, 1.6 * K);
  g.restore();

  /* ---- road paint ---- */
  const W_ = COL.white;
  const gutter = (x0, x1, z0, z1) => { rect(x0, x1, z0, z1, COL.gutter); };
  const old = (x, z) => inOld(x, z);
  // Hoshizora-dori (R1): gutters, edge lines, centre dashes, arrows (keep left: northbound on the west lane)
  const R1 = ROADS.hoshizora;
  [[-44, -12], [12, 32]].forEach(([za, zb]) => {
    gutter(7.5, 7.85, za, zb); gutter(11.65, 12, za, zb);
    line(7.95, za, 7.95, zb, W_, 0.1); line(11.55, za, 11.55, zb, W_, 0.1);
    dash(9.75, za, 9.75, zb, 1.6, 1.4, W_, 0.12, (x, z) => (z > -21.2 && z < -17.3) || (z > -15.6 && z < -11.4) || (z > 11.5 && z < 15.2));
  });
  // Kaigan-dori (R2)
  [[-48, -12], [12, 36]].forEach(([xa, xb]) => {
    gutter(xa, xb, 6.5, 6.85); gutter(xa, xb, 11.65, 12);
    line(xa, 7.15, xb, 7.15, W_, 0.1); line(xa, 11.35, xb, 11.35, W_, 0.1);
    dash(xa, 9.45, xb, 9.45, 1.6, 1.4, W_, 0.12, (x) => (x > -17.5 && x < -12.5) || (x > -33.6 && x < -28.4) || (x > 29 && x < 34) || (x > 12 && x < 14.6));
  });
  // Kita-dori (R3): narrow two-way, edge lines only
  [[-48, -16.6], [-13.4, 7.4], [12.1, 36]].forEach(([xa, xb]) => {
    line(xa, -14.75, xb, -14.75, W_, 0.08); line(xa, -12.25, xb, -12.25, W_, 0.08);
  });
  const arrow = (cx, cz, ang) => {
    g.save(); g.translate(X(cx), Z(cz)); g.rotate(ang); g.fillStyle = W_;
    const s = K;
    g.beginPath(); g.moveTo(-0.9 * s, -0.12 * s); g.lineTo(0.35 * s, -0.12 * s); g.lineTo(0.35 * s, -0.4 * s); g.lineTo(1.0 * s, 0); g.lineTo(0.35 * s, 0.4 * s); g.lineTo(0.35 * s, 0.12 * s); g.lineTo(-0.9 * s, 0.12 * s);
    g.closePath(); g.fill(); g.restore();
  };
  arrow(8.75, -30, -Math.PI / 2); arrow(10.8, -36, Math.PI / 2); arrow(8.75, 24, -Math.PI / 2); arrow(10.8, 19, Math.PI / 2);
  arrow(-24, 8.3, 0); arrow(-40, 10.6, Math.PI); arrow(20, 8.3, 0); arrow(25, 10.6, Math.PI);
  // zebra crossings (stripes run with the traffic)
  const zebraX = (x0, x1, z0, z1) => { for (let x = x0 + 0.05; x < x1 - 0.2; x += 0.62) rect(x, x + 0.34, z0 + 0.25, z1 - 0.25, W_); };
  const zebraZ = (x0, x1, z0, z1) => { for (let z = z0 + 0.05; z < z1 - 0.2; z += 0.62) rect(x0 + 0.25, x1 - 0.25, z, z + 0.34, W_); };
  zebraZ(5.4, 7.2, -15, -12); zebraZ(12.3, 14.1, -15, -12); // across Kita-dori either side of R1
  zebraX(7.5, 12, 12.6, 14.4); // across R1 south of the corner
  zebraZ(-19.2, -17.4, 6.5, 12); zebraZ(27.4, 29.2, 6.5, 12); // across Kaigan-dori
  // stop lines + 止まれ
  const tomare = (cx, cz, ang) => {
    g.save(); g.translate(X(cx), Z(cz)); g.rotate(ang); g.fillStyle = W_;
    g.font = `bold ${0.8 * K}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.scale(1, 2.0); g.fillText('止まれ', 0, 0); g.restore();
  };
  const stopZ = (x0, x1, z) => rect(x0, x1, z - 0.18, z + 0.18, W_);
  const stopX = (x, z0, z1) => rect(x - 0.18, x + 0.18, z0, z1, W_);
  // rail crossings: everybody stops before the track
  stopZ(7.5, 9.75, -16.2); stopZ(9.75, 12, -22.3);
  stopZ(-16.5, -13.5, -16.2); stopZ(-16.5, -13.5, -22.3);
  // minor roads meeting the main roads
  stopX(4.6, -15, -12); stopX(14.9, -15, -12); // signalised: stop lines only
  stopZ(-16.5, -13.5, 5.8); tomare(-15, 4.6, 0); stopZ(-16.5, -13.5, 12.7); tomare(-15, 13.9, Math.PI);
  stopZ(30, 33, 5.8); tomare(31.5, 4.6, 0); stopZ(30, 33, 12.7); tomare(31.5, 13.9, Math.PI);
  stopZ(-33.2, -30, 5.8); tomare(-31.6, 4.4, 0);
  stopZ(-32, -29, -11.4); tomare(-30.6, -10.2, Math.PI);
  stopZ(-16.5, -13.5, -11.4); tomare(-15, -10.2, Math.PI);
  stopX(-17.0, 22, 25); tomare(-18.3, 23.5, Math.PI / 2);
  // tactile warning blocks at the new crossings / station
  const dots = (x0, x1, z0, z1) => {
    rect(x0, x1, z0, z1, '#9b8227'); g.fillStyle = '#d3b53a';
    for (let x = x0 + 0.06; x < x1 - 0.03; x += 0.12) for (let z = z0 + 0.06; z < z1 - 0.03; z += 0.12) { g.beginPath(); g.arc(X(x), Z(z), 0.03 * K, 0, 7); g.fill(); }
  };
  dots(5.2, 6.8, 12, 12.6); dots(12, 12.6, 4.6, 6.2);
  dots(12.6, 14.1, -11.9, -11.3); dots(5.5, 7.1, -11.9, -11.3);
  // storm grates + manholes
  const grate = (cx, cz, w, h) => { rect(cx - w / 2, cx + w / 2, cz - h / 2, cz + h / 2, '#0a0d15'); g.strokeStyle = '#4a5572'; g.lineWidth = 3; g.strokeRect(X(cx - w / 2), Z(cz - h / 2), w * K, h * K); };
  for (let x = -46; x < 36; x += 7.5) { if (!old(x, 6.7)) grate(x, 6.675, 0.9, 0.3); if (!old(x, 11.8)) grate(x + 3, 11.825, 0.9, 0.3); }
  for (let z = -42; z < 32; z += 7.5) { if (!old(7.7, z) && Math.abs(z - RAIL.z) > 3) grate(7.675, z, 0.3, 0.9); if (!old(11.8, z) && Math.abs(z - RAIL.z) > 3) grate(11.825, z + 3, 0.3, 0.9); }
  const manhole = (cx, cz, r) => { g.fillStyle = '#12172a'; g.beginPath(); g.arc(X(cx), Z(cz), r * K, 0, 7); g.fill(); g.strokeStyle = '#475270'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.arc(X(cx), Z(cz), r * 0.62 * K, 0, 7); g.stroke(); };
  [[-30, 9.9], [-6, 30], [20, 9.0], [10.6, -30], [9.0, 22], [-38, -13.6], [22, -13.4], [-15, 18], [31.5, -2]].forEach(([x, z]) => manhole(x, z, 0.32));
  // cracks + stains on the asphalt
  for (let i = 0; i < 120; i++) {
    let x = MAP.x0 + R() * W, z = MAP.z0 + R() * H;
    if (old(x, z)) continue;
    g.strokeStyle = 'rgba(2,4,12,0.5)'; g.lineWidth = 1.4 + R() * 1.4;
    g.beginPath(); g.moveTo(X(x), Z(z));
    for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 0.6; z += (R() - 0.4) * 0.5; g.lineTo(X(x), Z(z)); }
    g.stroke();
  }
}

/* masks: r puddles (roads), g lawn (seasonal tint), b gutters (rain streams) */
function drawTownMask(g, w, h) {
  const k = w / W;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const R = rng(4242);
  g.globalCompositeOperation = 'lighter';
  const fillPoly = (poly, col) => { g.fillStyle = col; g.beginPath(); poly.forEach(([x, z], i) => (i ? g.lineTo((x - MAP.x0) * k, (z - MAP.z0) * k) : g.moveTo((x - MAP.x0) * k, (z - MAP.z0) * k))); g.closePath(); g.fill(); };
  // lawn
  BLOCKS.forEach((b) => { if (['verge', 'park', 'forest'].includes(b.surf)) fillPoly(b.poly, 'rgb(0,255,0)'); else if (b.surf === 'lots') fillPoly(b.poly, 'rgb(0,120,0)'); });
  // gutters
  g.fillStyle = 'rgb(0,0,255)';
  const r = (x0, x1, z0, z1) => g.fillRect((x0 - MAP.x0) * k, (z0 - MAP.z0) * k, (x1 - x0) * k, (z1 - z0) * k);
  r(MAP.x0, MAP.x1, 6.5, 6.85); r(MAP.x0, MAP.x1, 11.65, 12); r(7.5, 7.85, MAP.z0, MAP.z1); r(11.65, 12, MAP.z0, MAP.z1);
  // puddles on the roads
  const blob = (x, z, rx, rz) => {
    for (let i = 0; i < 4; i++) {
      const ox = (R() - 0.5) * rx, oz = (R() - 0.5) * rz;
      g.save(); g.translate((x + ox - MAP.x0) * k, (z + oz - MAP.z0) * k); g.scale(rx * (0.5 + R() * 0.5) * k, rz * (0.5 + R() * 0.5) * k);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, 'rgba(255,0,0,0.9)'); gr.addColorStop(0.6, 'rgba(255,0,0,0.6)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore();
    }
  };
  for (let i = 0; i < 70; i++) {
    const pick = R();
    let x, z;
    if (pick < 0.4) { x = MAP.x0 + R() * W; z = 6.9 + R() * 4.8; }
    else if (pick < 0.7) { x = 7.8 + R() * 3.9; z = MAP.z0 + R() * H; }
    else { x = MAP.x0 + R() * W; z = -14.8 + R() * 2.6; }
    if (inOld(x, z)) continue;
    blob(x, z, 0.8 + R() * 1.6, 0.4 + R() * 0.7);
  }
  g.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- ishigaki (stone retaining wall) texture */
function stoneTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(77);
    g.fillStyle = '#4c5163'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 7; row++) {
      let x = -R() * 30;
      const y = row * 37;
      while (x < w) {
        const sw = 34 + R() * 34;
        g.fillStyle = `hsl(${222 + R() * 10}, ${8 + R() * 8}%, ${30 + R() * 12}%)`;
        g.beginPath();
        g.moveTo(x + 3, y + 3 + R() * 4); g.lineTo(x + sw - 2, y + 2 + R() * 4); g.lineTo(x + sw - 3 + R() * 3, y + 34 - R() * 4); g.lineTo(x + 2, y + 35 - R() * 3);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 4, y + 4, sw - 9, 4);
        x += sw;
      }
    }
    g.strokeStyle = 'rgba(10,12,22,0.55)'; g.lineWidth = 2;
    for (let row = 0; row <= 7; row++) { g.beginPath(); g.moveTo(0, row * 37 + 1); g.lineTo(w, row * 37 + 1); g.stroke(); }
  }, { repeat: true });
}

/* ---------------------------------------------------------------- build */
export function buildTownGround(parent, renderer, refl) {
  const maxA = renderer.capabilities.getMaxAnisotropy();
  const tex = canvasTex(W * K, H * K, drawTown, { aniso: maxA, scale: 1 });
  const mask = canvasTex(1024, Math.round((1024 * H) / W), drawTownMask, { aniso: 2, linear: true, scale: 1 });
  const mat = makeGroundMaterial(refl, tex, mask, { x0: MAP.x0, z0: MAP.z0, w: W, h: H }, true);
  const g = new THREE.Group();
  parent.add(g);

  /* road layer: whole map (minus the board's square, discarded in the shader); sinks under the lake basin */
  const park = BLOCKS.find((b) => b.id === 'lakePark');
  const roadY = (x, z) => {
    let y = roadH(x, z);
    if (x < -18 && z < -23.5 && inPoly(x, z, park.poly)) y = Math.min(y, park.h(x, z) - 0.35);
    return y;
  };
  const road = new THREE.Mesh(surface(OUTLINE, roadY, 1.0, null), mat);
  road.receiveShadow = true;
  road.userData.keep = true;
  g.add(road);
  reg.ground.push(road);

  /* blocks: top surfaces + kerbs / retaining walls */
  const kerb = toon('#5d6683');
  const stone = patchToon(new THREE.MeshToonMaterial({ color: 0xffffff, map: stoneTex(), gradientMap: RAMP }));
  const onOutline = (x, z) => {
    for (let i = 0; i < OUTLINE.length; i++) {
      const [ax, az] = OUTLINE[i], [bx, bz] = OUTLINE[(i + 1) % OUTLINE.length];
      const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz);
      const t = ((x - ax) * vx + (z - az) * vz) / (L * L);
      if (t >= -0.01 && t <= 1.01 && Math.abs((x - ax) * vz - (z - az) * vx) / L < 0.4) return true;
    }
    return false;
  };
  BLOCKS.forEach((b) => {
    const poly = clipConvex(b.poly, OUTLINE);
    if (poly.length < 3) return;
    const top = new THREE.Mesh(surface(poly, b.h, b.id === 'lakePark' ? 0.5 : 1.0, null), mat);
    top.receiveShadow = true;
    top.userData.keep = true;
    top.userData.block = b.id;
    g.add(top);
    reg.ground.push(top);
    const wl = walls(poly, b.h, roadY, { skip: (x, z) => onOutline(x, z) || inOld(x, z) });
    if (wl.low) { const m = new THREE.Mesh(wl.low, kerb); m.receiveShadow = true; g.add(m); }
    if (wl.high) { const m = new THREE.Mesh(wl.high, stone); m.receiveShadow = true; m.castShadow = true; g.add(m); }
  });

  buildPlinth(parent);
  reg.townGround = { mat, road };
  return { mat, road, group: g };
}

/* ---------------------------------------------------------------- the display base (diorama plinth)
   A collector's-model base that follows the irregular outline:
     terrain cut   the town's own ground, sliced clean at the outline: a section strip from the real edge
                   height (road 0 .. shrine terrace 2.2) down to -0.55, painted as topsoil -> earth -> rock
                   strata that follow the surface, so every height step at the edge is closed
     trim          a thin, low-key bronze band over the joint
     body          dark blue-black stone, chamfered (one extrusion with a bevel), slightly proud of the town
     foot          a darker, wider slab with its own chamfer; a recessed name plate on the long faces
   Base materials never take snow / petals (nosnow) - weather stays on the town's surface. */
function cutTex() {
  return canvasTex(256, 256, (g, w, h) => {
    // v = depth below the surface (0 at the top .. 1 at ~2.8 m)
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3d4a2f'); gr.addColorStop(0.025, '#4a3b2c'); gr.addColorStop(0.05, '#6a5442');
    gr.addColorStop(0.3, '#5e4c3f'); gr.addColorStop(0.55, '#4c4440'); gr.addColorStop(1, '#3a383d');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const R = rng(23);
    // soft, irregular strata (broken, varying width) + blotches + a few pebbles: earth, not planks
    for (let i = 0; i < 7; i++) {
      const y0 = h * (0.1 + i * 0.13 + R() * 0.05);
      for (let x = -20; x < w; x += 20 + R() * 50) {
        const len = 30 + R() * 90, th = 1 + R() * 3;
        g.fillStyle = `rgba(${R() < 0.6 ? '28,20,16' : '150,126,100'},${0.07 + R() * 0.08})`;
        g.beginPath(); g.ellipse(x + len / 2, y0 + (R() - 0.5) * 6, len / 2, th, (R() - 0.5) * 0.06, 0, 7); g.fill();
      }
    }
    for (let i = 0; i < 70; i++) { const r = 6 + R() * 22; g.fillStyle = `rgba(${R() < 0.5 ? '255,236,210' : '20,14,10'},${0.03 + R() * 0.04})`; g.beginPath(); g.ellipse(R() * w, h * (0.08 + R() * 0.9), r, r * 0.45, 0, 0, 7); g.fill(); }
    for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,108,96' : '40,34,30'},0.35)`; g.beginPath(); g.ellipse(R() * w, h * (0.12 + R() * 0.85), 2 + R() * 4, 1.5 + R() * 2.5, R() * 3, 0, 7); g.fill(); }
  }, { repeat: true });
}
function stoneBaseTex() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, w, h);
    const R = rng(41);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + R() * 0.03})`; g.fillRect(R() * w, R() * h, 6 + R() * 30, 1 + R() * 3); }
  }, { repeat: true });
}
function buildPlinth(parent) {
  const g = new THREE.Group();
  g.name = 'displayBase';
  const shape = (poly) => { const s = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; };
  /** extruded slab of the outline offset by `off` (negative = outward), from y0 to y1, chamfer `bev` */
  const slab = (off, y0, y1, bev, mat) => {
    const geo = new THREE.ExtrudeGeometry(shape(offsetConvex(OUTLINE, off)), { depth: y1 - y0 - bev * 2, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0 + bev, 0);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const CUT_BOTTOM = -0.55;

  /* terrain cut: one strip all round the outline, top = the ground height just inside the edge */
  {
    const pos = [], uv = [], idx = [];
    let run = 0;
    for (let i = 0; i < OUTLINE.length; i++) {
      const [ax, az] = OUTLINE[i], [bx, bz] = OUTLINE[(i + 1) % OUTLINE.length];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / 0.25));
      // inward normal (the outline is CCW in x/z with area > 0)
      const ix = -(bz - az) / L, iz = (bx - ax) / L;
      const sgn = area(OUTLINE) > 0 ? 1 : -1;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const top = Math.max(-0.4, groundY(x + ix * sgn * 0.08, z + iz * sgn * 0.08));
        const base = pos.length / 3;
        pos.push(x, top, z, x, CUT_BOTTOM, z);
        const u = (run + t * L) / 4;
        uv.push(u, 1, u, 1 - (top - CUT_BOTTOM) / 2.8);
        if (k > 0) idx.push(base - 2, base - 1, base, base, base - 1, base + 1);
      }
      run += L;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const t = cutTex(); t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(geo, toon('#ffffff', { map: t, nosnow: true, nocache: true, e: '#0c0a0a', ei: 1 }));
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
    g.add(m);
  }
  /* trim, body, foot */
  // a faint self-light keeps the dark stone readable against the night sky without washing it out by day
  const stone = toon('#ffffff', { map: stoneBaseTex(), nosnow: true, nocache: true, e: '#141b2c', ei: 1 });
  stone.map.repeat.set(1 / 6, 1 / 3);
  slab(-0.04, -2.32, -0.62, 0.1, stone);
  slab(-0.16, -0.66, -0.5, 0.025, toon('#8a7550', { nosnow: true, e: '#1c150a', ei: 1 }));
  slab(-0.34, -2.62, -2.28, 0.06, toon('#0f131b', { nosnow: true, e: '#04060a', ei: 1 }));
  /* recessed name plates on the long faces */
  const plate = canvasTex(1440, 160, (c, w, hh) => {
    c.fillStyle = '#121826'; c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#a68d5c'; c.lineWidth = 4; c.strokeRect(10, 10, w - 20, hh - 20);
    c.fillStyle = '#d9c799'; c.textBaseline = 'middle';
    c.textAlign = 'left'; c.font = `600 68px ${FONT}`; c.fillText('星空町', 60, hh / 2 + 2);
    c.fillStyle = '#a68d5c'; c.fillRect(330, 40, 3, hh - 80);
    c.fillStyle = '#d9c799'; c.font = `500 34px ${FONT}`; c.fillText('HOSHIZORA TOWN  ·  a Japanese seaside town  ·  1:60', 370, hh / 2 + 3);
  });
  const pm = new THREE.MeshBasicMaterial({ map: plate, color: 0xb9b09a });
  const zS = MAP.z1 + 0.14, zN = MAP.z0 - 0.14;
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(9.9, 1.1), pm); p1.position.set(-5, -1.45, zS + 0.002); g.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(9.9, 1.1), pm); p2.position.set(-5, -1.45, zN - 0.002); p2.rotation.y = Math.PI; g.add(p2);
  g.traverse((o) => { if (o.isMesh) o.userData.noRefl = true; });
  parent.add(g);
  return g;
}
