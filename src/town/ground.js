import * as THREE from 'three';
import { reg, toon, canvasTex, rng, FONT, RAMP, patchToon } from '../core.js';
import { makeGroundMaterial } from '../ground.js';
import { MAP, OLD, BLOCKS, OUTLINE, ROADS, LANES, LAKE, lakeF, roadH, inPoly, PAV, RAIL, CROSSINGS, PLOTS, inOld, groundY, ZAK_PAD, SAKURA_PLAZA, PLAZA_CENTRE, PLAZA_TREES, PLAZA_BENCHES, PLAZA_SWING, PLAZA_DRAINS, SW_ROW_PAD, WEST_HOMES } from './layout.js';
import { surface, walls, clipConvex } from './geom.js';
import { IZA_AWAY } from '../site.js';
import { P, groundPaint, shade } from '../palette.js';

/* ====================================================================================================
   Town ground: one painted canvas for the whole expanded map (roads, sidewalks, lawns, lots, verges),
   a road layer, raised blocks with kerbs / stone retaining walls, and the new irregular plinth.
   The original board keeps its own (sharper) canvas; this one skips the board's square.
   ==================================================================================================== */

const K = 40; // px per unit
const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
const X = (x) => (x - MAP.x0) * K;
const Z = (z) => (z - MAP.z0) * K;

// pavings come from the palette (palette.js: walk / shop / plaza + concrete), painted through groundPaint()
const COL = {
  asphalt: '#1b2133',
  walkA: groundPaint(P.paveWalk), walkB: groundPaint(P.paveWalk2),
  shopA: groundPaint(P.paveShop), shopB: groundPaint(P.paveShop2),
  plazaA: groundPaint(P.pavePlaza), plazaB: groundPaint(P.pavePlaza2), concrete: groundPaint(P.concrete),
  grass: '#22403a', grass2: '#1c3730', forest: '#1a3029', earth: '#3a3633', earth2: '#332f2c',
  gravel: '#3d3c46', sand: '#4a4636', lakebed: '#14282b',
  white: '#cfd5e2', gutter: '#10151f', yellow: '#c7a933',
};

function polyPath(g, poly) {
  g.beginPath();
  poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
  g.closePath();
}

const WALK = 0.6; // sidewalk tile module (m)
const joint = (a) => `rgba(${P.joint},${a})`;

function tilePattern(g, a, b, step = WALK) {
  const s = Math.round(step * K);
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const t = c.getContext('2d');
  [[0, 0, a], [s, 0, b], [0, s, b], [s, s, a]].forEach(([x, y, col]) => { t.fillStyle = col; t.fillRect(x, y, s, s); });
  t.strokeStyle = joint(0.35); t.lineWidth = 2;
  t.strokeRect(1, 1, s - 1, s - 1); t.strokeRect(s + 1, 1, s - 1, s - 1); t.strokeRect(1, s + 1, s - 1, s - 1); t.strokeRect(s + 1, s + 1, s - 1, s - 1);
  return g.createPattern(c, 'repeat');
}

/** the plaza paving: light stone slabs, 0.6 x 0.3 m in running bond, soft joints (`vertical`: long side along z) */
function slabPattern(g, vertical) {
  const a = Math.round(0.6 * K), b = Math.round(0.3 * K), w = vertical ? b : a, h = vertical ? a : b;
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const t = c.getContext('2d'), cols = [P.pavePlaza, P.pavePlaza2, shade(P.pavePlaza, 0.03), shade(P.pavePlaza2, -0.02)].map(groundPaint);
  const cells = vertical ? [[0, 0, 0], [0, h, 1], [w, -h / 2, 2], [w, h / 2, 3], [w, h * 1.5, 0]] : [[0, 0, 0], [w, 0, 1], [-w / 2, h, 2], [w / 2, h, 3], [w * 1.5, h, 0]];
  cells.forEach(([x, y, k]) => { t.fillStyle = cols[k]; t.fillRect(x, y, w, h); t.strokeStyle = joint(0.3); t.lineWidth = 1; t.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); });
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
  const tiles = tilePattern(g, COL.walkA, COL.walkB);
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
      g.fillStyle = slabPattern(g, false); g.fill();
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
      // shops / walk: sidewalk tiles with plain concrete lots
      g.fillStyle = tiles; g.fill();
      PLOTS.filter((q) => q.block === b.id).forEach((q) => {
        const [x0, x1, z0, z1] = q.rect;
        g.fillStyle = q.id === 'C-plaza' ? tiles : q.type === 'public' ? COL.grass : COL.concrete; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
        for (let i = 0; i < 6; i++) blob(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), 0.4 + R() * 1.0, `rgba(${P.joint},0.12)`);
      });
    }
    g.restore();
  });

  // 西の住宅地 (town/westHomes.js): lawn over the four gardens (the plots' earth above still paints: same random stream)
  { const [x0, x1, z0, z1] = WEST_HOMES.area; g.save(); polyPath(g, BLOCKS.find((q) => q.id === 'west1').poly); g.clip(); g.fillStyle = COL.grass; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K); g.restore(); }

  // 星空町駅 (town/station.js): drain grates along the front, a manhole in the forecourt (its tactile path: town/roadside.js)
  {
    [[16.6, -28.05], [18.4, -28.05], [20.2, -27.9]].forEach(([cx, cz]) => { rect(cx - 0.45, cx + 0.45, cz - 0.12, cz + 0.12, '#1c2030'); g.strokeStyle = '#4a5572'; g.lineWidth = 2; g.strokeRect(X(cx - 0.45), Z(cz - 0.12), 0.9 * K, 0.24 * K); for (let k = 0; k < 8; k++) rect(cx - 0.4 + k * 0.105, cx - 0.37 + k * 0.105, cz - 0.09, cz + 0.09, '#3a4258'); });
    g.fillStyle = '#20263a'; g.beginPath(); g.arc(X(19.6), Z(-33.2), 0.32 * K, 0, 7); g.fill(); g.strokeStyle = '#59627e'; g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(X(19.6), Z(-33.2), 0.2 * K, 0, 7); g.stroke();
  }

  /* しずく花店 corner (town/florist.js): sidewalk pavers along both kerbs, the shop's tiled
     forecourt, the planting strip between the shop and the house, the house's gravel yard (own rng: the rest
     of the town paints exactly as before) */
  {
    const Rf = rng(4321);
    g.fillStyle = tiles;
    g.fillRect(X(12), Z(4.0), 18 * K, 2.5 * K); // Kaigan-dori sidewalk
    g.fillRect(X(12), Z(-7.2), 2.2 * K, 11.2 * K); // Hoshizora-dori side
    line(12, 4.0, 30, 4.0, joint(0.45), 0.05);
    g.fillStyle = tilePattern(g, '#5a4a52', '#52434b', 0.4);
    g.fillRect(X(14.2), Z(2.6), 10.4 * K, 1.4 * K); // forecourt (terracotta tiles)
    g.fillRect(X(12.2), Z(2.0), 2.4 * K, 2.0 * K);
    rect(21.85, 24.55, -7.0, 2.7, COL.earth); // planting strip
    for (let i = 0; i < 26; i++) blob(21.9 + Rf() * 2.6, -7 + Rf() * 9.7, 0.3 + Rf() * 0.6, 'rgba(60,110,80,0.3)');
    rect(24.55, 29.45, 1.0, 3.85, COL.gravel); // house yard
    for (let i = 0; i < 40; i++) blob(24.6 + Rf() * 4.8, 1.0 + Rf() * 2.8, 0.1 + Rf() * 0.25, Rf() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,10,0.12)');
    rect(24.55, 29.45, -4.6, 1.0, COL.concrete); // round the house
  }
  // 青空雑貨店 at Kaigan-dori x 裏路地 (town/zakkaya.js): grey pavers round the corner, a manhole, kerb grates (own rng;
  // the tactile paving: town/roadside.js)
  {
    const [x0, x1, z0, z1] = ZAK_PAD;
    g.fillStyle = tiles;
    g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
    const mh = (cx, cz, r) => { g.fillStyle = '#20263a'; g.beginPath(); g.arc(X(cx), Z(cz), r * K, 0, 7); g.fill(); g.strokeStyle = '#59627e'; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(120,130,160,0.5)'; g.lineWidth = 1.5; for (let a = 0; a < 6.28; a += 0.5) { g.beginPath(); g.moveTo(X(cx), Z(cz)); g.lineTo(X(cx + Math.cos(a) * r * 0.9), Z(cz + Math.sin(a) * r * 0.9)); g.stroke(); } };
    mh(-15.4, 2.4, 0.32);
    [[-16.62, 1.2], [-16.62, 3.6], [-21.3, 6.38]].forEach(([cx, cz], i) => { const w = i < 2 ? 0.25 : 0.9, h = i < 2 ? 0.9 : 0.25; rect(cx - w / 2, cx + w / 2, cz - h / 2, cz + h / 2, '#0a0d15'); g.strokeStyle = '#4a5572'; g.lineWidth = 2; g.strokeRect(X(cx - w / 2), Z(cz - h / 2), w * K, h * K); });
  }
  // the izakaya's lot in the west block (site.js IZA_AWAY): paving under it, its street side and its frontage
  if (IZA_AWAY) {
    const [x0, x1, z0] = IZA_AWAY.rect;
    g.fillStyle = tiles;
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
        if (f < 0.985) { const k = Math.min(1, Math.max(0, (0.985 - f) / 0.4)), e = k * k * (3 - 2 * k); col = [cs[0] + (cb[0] - cs[0]) * e, cs[1] + (cb[1] - cs[1]) * e, cs[2] + (cb[2] - cs[2]) * e]; } // the bed: sand easing into the deep (no step under the clear shallows)
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

  /* 街屋の並び (town/streetRow.js): the pavement along Kaigan-dori (the backs), concrete under the houses, the front
     pavement on the lane side (the fronts face south), the parking corner's asphalt at the west end (no random numbers) */
  {
    const [x0, x1, z0, z1] = SW_ROW_PAD;
    g.save(); polyPath(g, BLOCKS.find((q) => q.id === 'sw1').poly); g.clip();
    g.fillStyle = COL.concrete; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K); // concrete
    g.fillStyle = tiles; g.fillRect(X(x0), Z(z0), (x1 - x0) * K, 1.7 * K); // Kaigan-dori's pavement
    g.fillRect(X(x0), Z(z1 - 0.2), (x1 - x0) * K, 4.5 * K); // the front pavement down to the lane
    g.fillStyle = '#2f3442'; g.fillRect(X(x0), Z(15.4), 5.6 * K, (z1 - 0.2 - 15.4) * K); // the parking corner
    g.strokeStyle = joint(0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(X(-41.8), Z(19.45)); g.lineTo(X(-19.4), Z(19.45)); g.stroke(); // the building line
    g.restore();
  }

  /* 桜広場 (town/plaza.js): light stone slabs over the south part of the south block up to the kerbs - east-west in the
     middle, north-south in the two cherry groves (a quiet change of direction marks the rest areas); round the
     fountain a radial ring with a slotted ring drain and a soft contact shadow at the pool's foot; the swing's fine
     gravel pad, gravel tree pits, square drain grates, soft shadows under the benches (no random numbers used) */
  {
    const [x0, x1, z0, z1] = SAKURA_PLAZA, [cx, cz] = PLAZA_CENTRE;
    g.save(); polyPath(g, BLOCKS.find((q) => q.id === 'south').poly); g.clip();
    g.fillStyle = slabPattern(g, false); g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
    g.fillStyle = slabPattern(g, true); [[x0, -8.6], [4.25, x1]].forEach(([a, b]) => g.fillRect(X(a), Z(z0), (b - a) * K, (z1 - z0) * K));
    g.strokeStyle = 'rgba(40,32,26,0.35)'; g.lineWidth = 2; [-8.6, 4.25].forEach((x) => { g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke(); });
    // the fountain surround: radial slabs out to r 2.8, a ring drain, the contact shadow
    const circ = (r, fill, stroke, lw = 3) => { g.beginPath(); g.arc(X(cx), Z(cz), r * K, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    circ(2.8, groundPaint(shade(P.pavePlaza2, -0.03)), 'rgba(40,32,26,0.45)');
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; g.beginPath(); g.moveTo(X(cx + Math.cos(a) * 1.62), Z(cz + Math.sin(a) * 1.62)); g.lineTo(X(cx + Math.cos(a) * 2.8), Z(cz + Math.sin(a) * 2.8)); g.strokeStyle = 'rgba(40,32,26,0.26)'; g.lineWidth = 2; g.stroke(); }
    circ(2.2, null, 'rgba(40,32,26,0.32)', 2);
    circ(2.62, null, '#3d3832', 6); // the slotted ring drain
    for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; g.fillStyle = 'rgba(150,140,128,0.9)'; g.fillRect(X(cx + Math.cos(a) * 2.62) - 1, Z(cz + Math.sin(a) * 2.62) - 1, 2, 2); }
    { const gr = g.createRadialGradient(X(cx), Z(cz), 1.55 * K, X(cx), Z(cz), 2.05 * K); gr.addColorStop(0, 'rgba(20,16,12,0.5)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X(cx), Z(cz), 2.05 * K, 0, Math.PI * 2); g.fill(); }
    // the swing's fine gravel pad inside a stone edge
    { const [a, b, c, d] = PLAZA_SWING.pad; g.fillStyle = '#7d756b'; g.fillRect(X(a), Z(c), (b - a) * K, (d - c) * K); for (let i = 0; i < 160; i++) { const u = (i * 0.618034) % 1, v = (i * 0.754877) % 1; g.fillStyle = i % 2 ? 'rgba(150,140,128,0.35)' : 'rgba(50,44,38,0.2)'; g.fillRect(X(a + u * (b - a)) - 1, Z(c + v * (d - c)) - 1, 2, 2); } g.strokeStyle = '#9a9086'; g.lineWidth = 5; g.strokeRect(X(a), Z(c), (b - a) * K, (d - c) * K); }
    // gravel tree pits, drain grates, soft contact shadows under the benches
    PLAZA_TREES.forEach(([x, z, , , r]) => { g.beginPath(); g.arc(X(x), Z(z), (r + 0.1) * K, 0, Math.PI * 2); g.fillStyle = '#3a332f'; g.fill(); for (let i = 0; i < 40; i++) { const a = i * 2.39996, rr = r * Math.sqrt((i + 0.5) / 40); g.fillStyle = i % 2 ? 'rgba(120,110,100,0.5)' : 'rgba(20,16,14,0.4)'; g.fillRect(X(x + Math.cos(a) * rr) - 2, Z(z + Math.sin(a) * rr) - 2, 4, 4); } });
    PLAZA_DRAINS.forEach(([x, z]) => { g.fillStyle = '#4a4540'; g.fillRect(X(x - 0.22), Z(z - 0.22), 0.44 * K, 0.44 * K); g.fillStyle = '#1c1916'; for (let k = 0; k < 6; k++) g.fillRect(X(x - 0.18 + k * 0.066), Z(z - 0.18), 0.03 * K, 0.36 * K); });
    PLAZA_BENCHES.forEach(([x, z]) => { const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), 1.0 * K); gr.addColorStop(0, 'rgba(20,16,12,0.28)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.fillRect(X(x - 1), Z(z - 1), 2 * K, 2 * K); });
    g.restore();
  }

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
    dash(9.75, za, 9.75, zb, 1.6, 1.4, W_, 0.12, (x, z) => (z > -21.2 && z < -17.3) || (z > -15.6 && z < -11.4) || (z > 11.5 && z < 15.2) || (z > 25.3 && z < 27.7));
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
  zebraX(7.5, 12, 25.6, 27.4); zebraX(-16.5, -13.5, 25.6, 27.4); // from the sakura plaza (town/plaza.js) to the blocks either side
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
  // ...but not the paved pads inside the lots blocks (the seasonal grass tint would turn their stone green)
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000';
  const pads = [[SW_ROW_PAD[0], SW_ROW_PAD[1], SW_ROW_PAD[2], SW_ROW_PAD[3] + 4.3], ZAK_PAD]; // the row's front pavement runs on to the lane
  if (IZA_AWAY) { const [x0, x1, z0] = IZA_AWAY.rect; pads.push([x0 - 1.3, x1 + 0.8, z0 - 0.5, 6.5]); }
  pads.forEach(([x0, x1, z0, z1]) => g.fillRect((x0 - MAP.x0) * k, (z0 - MAP.z0) * k, (x1 - x0) * k, (z1 - z0) * k));
  BLOCKS.forEach((b) => { // and the sidewalk bands round the lots / the park (drawTown)
    const band = { lots: 1.1, park: 0.9 }[b.surf];
    if (!band) return;
    const path = () => { g.beginPath(); b.poly.forEach(([x, z], i) => (i ? g.lineTo((x - MAP.x0) * k, (z - MAP.z0) * k) : g.moveTo((x - MAP.x0) * k, (z - MAP.z0) * k))); g.closePath(); };
    g.save(); path(); g.clip(); g.strokeStyle = '#000'; g.lineWidth = band * 2 * k; path(); g.stroke(); g.restore();
  });
  g.globalCompositeOperation = 'lighter';
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
  const kerb = toon(P.kerb);
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
    const top = new THREE.Mesh(surface(poly, b.h, b.res || (b.id === 'lakePark' ? 0.5 : 1.0), null), mat);
    top.receiveShadow = true;
    top.userData.keep = true;
    top.userData.block = b.id;
    g.add(top);
    reg.ground.push(top);
    const wl = walls(poly, b.h, roadY, { skip: (x, z) => onOutline(x, z) || inOld(x, z) });
    if (wl.low) { const m = new THREE.Mesh(wl.low, kerb); m.receiveShadow = true; g.add(m); }
    if (wl.high) { const m = new THREE.Mesh(wl.high, stone); m.receiveShadow = true; m.castShadow = true; g.add(m); }
  });

  reg.townGround = { mat, road };
  return { mat, road, group: g };
}
