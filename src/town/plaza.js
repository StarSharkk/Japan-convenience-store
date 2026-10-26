import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, halo, rng } from '../core.js';
import { makeTree, makeShrub } from '../tree.js';
import { makePot } from '../plants/pottedPlants.js';
import { cat } from '../street.js';
import { groundY, PLAZA_CENTRE, PLAZA_TREES, PLAZA_BENCHES, PLAZA_SWING } from './layout.js';
import { ct, txt, SERIF, HAND, wetPass } from './shopkit.js';
import { buildFountain } from './fountain.js';
import { plantBatch, potPlants, planterPlants } from '../plants/wild.js';

/* ====================================================================================================
   桜広場 - the sakura plaza in front of the café and the bookstore (the south part of the south block).
   Light stone paving (painted into the town ground: town/ground.js, so it wets, puddles and takes snow like the
   rest of the town). Walks kept open: the shop frontage, the walks from the two shop doors, the east-west walk
   between the two zebra crossings, the ring round the fountain.

     centre   the fountain (town/fountain.js), its inscription tablet in the rim
     groves   nine cherry trees in two loose groves on the west / east edges (deep pink, light pink, pink-white;
              different heights), stone-ringed pits with low planting and an uplight each; never in front of a
              shop front, a door or a walk
     rest     three benches facing the fountain (a cat on the south one); a two-seat garden swing under a little
              timber pergola on its gravel pad (the seats sway gently), flowers and a retro lamp beside it
     light    four low bollards on the diagonals, six warm ground lights round the fountain ring
     details  a wooden notice board, the town guide map, a drinking fountain, a bin, two flower beds, flower pots
   ==================================================================================================== */

const [CX, CZ] = PLAZA_CENTRE;
const gy = (x, z) => groundY(x, z);
const TONES = [[1.0, 0.8, 0.9], [1.0, 1.0, 1.0], [1.05, 1.13, 1.1]]; // deep pink, light pink, pink-white

export function buildPlaza(parent) {
  const g = grp(parent);
  g.name = 'sakuraPlaza';
  const wood = toon('#b58858', { lit: 0.12 }), woodD = toon('#6b4a32'), black = toon('#262626'), stone = toon('#d4ccbe'), soil = toon('#4a3a2c', { lit: 0.02 });

  /* ---- the fountain ---- */
  buildFountain(g, CX, gy(CX, CZ), CZ);
  // six warm ground lights round the walking ring
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6, x = CX + Math.cos(a) * 3.0, z = CZ + Math.sin(a) * 3.0, y = gy(x, z);
    cy(g, black, x, y - 0.01, z, 0.075, 0.025, 12); cy(g, glow('#ffe6c0', 2.0, { cat: 'lamp', off: '#9a948a' }), x, y + 0.01, z, 0.05, 0.01, 12);
    halo(g, x, y + 0.15, z, '#ffd9a8', 0.8, 0.25, 'lamp');
  }

  // the small flowers and grasses (plants/wild.js): daisies, pink wildflowers, forget-me-nots, clover
  const PB = plantBatch(g, { name: 'PlazaPlants' });
  /* ---- cherry groves: pits with low planting, an uplight each ---- */
  PLAZA_TREES.forEach(([x, z, h, tone, r], i) => {
    const y = gy(x, z), Rt = rng(900 + i * 31);
    cy(g, stone, x, y - 0.05, z, r + 0.1, 0.17, 30);
    cy(g, soil, x, y - 0.05, z, r - 0.02, 0.15, 28);
    const t = makeTree({ seed: 401 + i * 13, height: h, spread: (h > 5.5 ? 1.2 : 0.95) + Rt() * 0.3, palette: 'deep', dens: 0.92, fill: 1.1, leafScale: 0.86 + Rt() * 0.1, lean: (Rt() - 0.5) * 0.14, blossom: 1, pink: TONES[tone] });
    t.position.set(x, y + 0.08, z); t.rotation.y = Rt() * 6.28; g.add(t);
    const n = r > 0.75 ? 5 : 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Rt(), rr = r * (0.55 + Rt() * 0.2);
      if (k % 2) { const sb = makeShrub({ seed: 420 + i * 7 + k, width: 0.38, height: 0.28, palette: 'deep' }); sb.position.set(x + Math.cos(a) * rr, y + 0.08, z + Math.sin(a) * rr); g.add(sb); }
      else for (let f = 0; f < 4; f++) { const fx = x + Math.cos(a) * rr + (Rt() - 0.5) * 0.14, fz = z + Math.sin(a) * rr + (Rt() - 0.5) * 0.14; if (f < 3) PB.add(['daisy', 'pinkWild', 'clover', 'forget'][(i + k + f) % 4], i + k + f, fx, y + 0.12, fz, 1.1 + ((i + f) % 3) * 0.12, { ry: f * 2.1 + k }); }
    }
    const ux = x + (x < CX ? 0.4 : -0.4) * (r / 0.85);
    cy(g, glow('#fff0d0', 2.0, { cat: 'lamp', off: '#5a5a5a' }), ux, y + 0.1, z, 0.045, 0.02, 10);
    halo(g, ux, y + 0.8, z, '#ffe2c8', 1.5, 0.2, 'lamp');
    (reg.townGreenery && reg.townGreenery.trees || []).push({ x, z, s: h / 4.4 }); // fallen petals / leaves gather under them
  });

  /* ---- benches facing the fountain ---- */
  const bench = (x, z, ry) => {
    const b = grp(g, x, gy(x, z), z, ry);
    for (let k = 0; k < 3; k++) bx(b, wood, -0.8, 0.8, 0.42, 0.46, -0.2 + k * 0.14, -0.1 + k * 0.14, { bevel: 0.01 });
    for (let k = 0; k < 2; k++) bx(b, wood, -0.8, 0.8, 0.58 + k * 0.16, 0.7 + k * 0.16, -0.24, -0.2, { bevel: 0.01 });
    [-0.62, 0.62].forEach((a) => { bx(b, black, a - 0.03, a + 0.03, 0, 0.42, -0.18, 0.2, { cast: false }); bx(b, black, a - 0.03, a + 0.03, 0.42, 0.88, -0.26, -0.22, { cast: false }); bx(b, black, a - 0.03, a + 0.03, 0.55, 0.6, -0.22, 0.18, { cast: false }); });
    return b;
  };
  PLAZA_BENCHES.forEach(([x, z]) => bench(x, z, Math.atan2(CX - x, CZ - z)));
  cat(g, PLAZA_BENCHES[0][0] + 0.35, gy(PLAZA_BENCHES[0][0], PLAZA_BENCHES[0][1]) + 0.46, PLAZA_BENCHES[0][1] - 0.02, Math.PI * 0.85);

  /* ---- the garden swing: two seats under a little timber pergola, on its gravel pad ---- */
  {
    const { x, z0, z1, pad } = PLAZA_SWING, y = gy(x, (z0 + z1) / 2), H = 2.25;
    const [px0, px1, pz0, pz1] = pad;
    [[px0, px1, pz0 - 0.04, pz0 + 0.04], [px0, px1, pz1 - 0.04, pz1 + 0.04], [px0 - 0.04, px0 + 0.04, pz0, pz1], [px1 - 0.04, px1 + 0.04, pz0, pz1]].forEach(([a, b, c, d]) => bx(g, stone, a, b, y - 0.04, y + 0.05, c, d, { cast: false }));
    [z0, z1].forEach((zz) => [-1, 1].forEach((s) => cyl2(g, wood, [x + s * 0.6, y, zz], [x + s * 0.06, y + H, zz], 0.05, 8)));
    [z0, z1].forEach((zz) => bx(g, wood, x - 0.42, x + 0.42, y + 0.95, y + 1.02, zz - 0.03, zz + 0.03, { cast: false })); // cross-ties
    bx(g, wood, x - 0.07, x + 0.07, y + H, y + H + 0.14, z0 - 0.2, z1 + 0.2, { bevel: 0.01 });
    for (let k = 0; k < 7; k++) { const zz = z0 - 0.15 + ((z1 - z0 + 0.3) * k) / 6; bx(g, woodD, x - 0.5, x + 0.5, y + H + 0.14, y + H + 0.2, zz - 0.035, zz + 0.035, { bevel: 0.005 }); } // pergola slats
    [-0.46, 0.46].forEach((d) => bx(g, woodD, x + d - 0.03, x + d + 0.03, y + H + 0.2, y + H + 0.25, z0 - 0.25, z1 + 0.25, { cast: false }));
    [z0, z1].forEach((zz) => bx(g, black, x - 0.09, x + 0.09, y + H - 0.04, y + H + 0.02, zz - 0.09, zz + 0.09, { cast: false })); // dark metal brackets
    const seats = [];
    [[(z0 * 2 + z1) / 3, 0.07, 0], [(z0 + z1 * 2) / 3, 0.095, 1.7]].forEach(([zs, amp, ph]) => {
      const pv = grp(g, x, y + H - 0.02, zs, 0); pv.userData.keep = true;
      const sy = -(H - 0.5);
      [-0.21, 0.21].forEach((dz) => { cyl2(pv, black, [0, 0, dz], [0, sy + 0.04, dz], 0.008, 4); bx(pv, black, -0.03, 0.03, -0.03, 0.01, dz - 0.03, dz + 0.03, { cast: false }); });
      bx(pv, wood, -0.17, 0.17, sy, sy + 0.05, -0.25, 0.25, { bevel: 0.01 });
      bx(pv, wood, -0.2, -0.16, sy + 0.05, sy + 0.42, -0.24, 0.24, { bevel: 0.01 });
      [-0.21, 0.21].forEach((dz) => cyl2(pv, black, [-0.18, sy + 0.42, dz], [-0.18, sy + 0.62, dz], 0.008, 4));
      seats.push({ pv, amp, ph });
    });
    reg.updaters.push((t) => seats.forEach(({ pv, amp, ph }) => (pv.rotation.z = amp * Math.sin(t * 1.9 + ph) + amp * 0.25 * Math.sin(t * 0.7 + ph * 2))));
    // flowers at the pad's corners, the retro lamp beside it
    [[px0 + 0.2, pz0 + 0.2], [px1 - 0.2, pz1 - 0.25], [px1 - 0.25, pz0 + 0.25]].forEach(([fx, fz], i) => { PB.add('cover', i, fx, y + 0.02, fz, 1.1, { ry: i * 2 }); PB.add(['pinkWild', 'daisy', 'forget'][i], i, fx + 0.04, y + 0.02, fz - 0.03, 1.1, { ry: i }); });
    lamp(g, -9.55, 28.6, black);
  }

  /* ---- light: four low bollards on the diagonals, a retro lamp in the east grove ---- */
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const x = CX + sx * 2.6, z = CZ + sz * 2.6, y = gy(x, z);
    cy(g, black, x, y, z, 0.075, 0.62, 10);
    cy(g, glow('#ffe2b0', 2.0, { cat: 'lamp', off: '#d8d0c0' }), x, y + 0.52, z, 0.08, 0.08, 12);
    cy(g, black, x, y + 0.6, z, 0.1, 0.05, 12);
    halo(g, x, y + 0.5, z, '#ffd9a8', 0.9, 0.3, 'lamp');
  });
  lamp(g, 4.35, 28.55, black);

  /* ---- two raised flower beds along the south edge ---- */
  const bed = (x0, x1, z0, z1, seed) => {
    const y = gy((x0 + x1) / 2, (z0 + z1) / 2);
    bx(g, stone, x0, x1, y - 0.05, y + 0.36, z0, z0 + 0.1); bx(g, stone, x0, x1, y - 0.05, y + 0.36, z1 - 0.1, z1);
    bx(g, stone, x0, x0 + 0.1, y - 0.05, y + 0.36, z0, z1); bx(g, stone, x1 - 0.1, x1, y - 0.05, y + 0.36, z0, z1);
    bx(g, soil, x0 + 0.1, x1 - 0.1, y, y + 0.3, z0 + 0.1, z1 - 0.1, { cast: false });
    // greenery first, filling the bed, then small flowers threaded through it (plants/wild.js)
    planterPlants(PB, g, x0 + 0.12, x1 - 0.12, z0 + 0.12, z1 - 0.12, y + 0.3, { seed, flowers: ['pansy', 'daisy', 'forget', 'pinkWild'] });
  };
  bed(-9.4, -5.3, 31.1, 31.85, 501); bed(-1.1, 3.1, 31.1, 31.85, 502);

  /* ---- boards: the town guide map (west), the wooden notice board (east) ---- */
  const board = (x, z, ry, tex, w = 0.95, h = 0.62) => {
    const b = grp(g, x, gy(x, z), z, ry);
    [-w / 2 - 0.02, w / 2 + 0.02].forEach((d) => bx(b, woodD, d - 0.035, d + 0.035, 0, 1.75, -0.035, 0.035));
    bx(b, woodD, -w / 2 - 0.05, w / 2 + 0.05, 0.95, 0.95 + h + 0.08, -0.03, 0.02, { bevel: 0.01 });
    const p = pl(b, toon('#ffffff', { map: tex, nocache: true, lit: 0.15 }), w, h, 0, 0.99 + h / 2, 0.021, 0, 0); p.userData.noLine = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.04, 0.32), toon('#3d2a1e')); roof.position.set(0, 1.8, 0.02); roof.rotation.x = 0.12; roof.castShadow = true; b.add(roof);
    return b;
  };
  board(-12.95, 28.1, Math.PI / 2, ct('plazaGuide', 512, 336, (c, w, h) => {
    c.fillStyle = '#f2ead8'; c.fillRect(0, 0, w, h);
    txt(c, '星空町 さくら広場 案内図', w / 2, 30, 30, '#3a2a22', { font: SERIF }); txt(c, 'HOSHIZORA TOWN · GUIDE', w / 2, 60, 16, '#8a6a4a', { font: SERIF, weight: 600 });
    c.fillStyle = '#9cc8d6'; c.fillRect(20, 286, w - 40, 32); txt(c, '海 / SEA', w / 2, 302, 16, '#3a5a6a', { font: SERIF });
    c.fillStyle = '#c9c2b4'; c.fillRect(20, 120, w - 40, 22); c.fillRect(300, 76, 22, 210);
    c.fillStyle = '#e3d6bc'; [[30, 80, 120, 36], [160, 80, 130, 36], [30, 150, 120, 50], [340, 150, 150, 120], [340, 80, 150, 36]].forEach(([a, b2, cw, ch]) => c.fillRect(a, b2, cw, ch));
    c.fillStyle = '#f6c6d6'; c.fillRect(160, 210, 130, 70); c.fillStyle = '#9cc8d6'; c.beginPath(); c.arc(225, 245, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a5236'; c.fillRect(165, 152, 55, 50); c.fillStyle = '#9fcfc0'; c.fillRect(232, 152, 55, 50);
    txt(c, 'CAFÉ', 192, 176, 13, '#f2e6cc', { font: SERIF }); txt(c, 'BOOKS', 259, 176, 12, '#2b2b2b', { font: SERIF }); txt(c, 'LAWSON', 225, 98, 14, '#1c63c4', { font: SERIF });
    c.fillStyle = '#d23a32'; c.beginPath(); c.arc(166, 245, 8, 0, Math.PI * 2); c.fill(); txt(c, '現在地', 166, 228, 13, '#d23a32', { font: SERIF });
  }));
  board(6.95, 28.1, -Math.PI / 2, ct('plazaNotice', 512, 336, (c, w, h) => {
    c.fillStyle = '#b98a5a'; c.fillRect(0, 0, w, h);
    const note = (x, y, nw, nh, bg, lines, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = bg; c.fillRect(0, 0, nw, nh); lines.forEach(([s, size, col], i) => txt(c, s, nw / 2, 26 + i * (size + 10), size, col, { font: i ? HAND : SERIF, weight: 600 })); c.fillStyle = '#d23a32'; c.beginPath(); c.arc(nw / 2, 6, 5, 0, Math.PI * 2); c.fill(); c.restore(); };
    note(18, 16, 220, 150, '#fff6e8', [['春の花まつり', 26, '#b8546e'], ['4/6 (日) 10:00〜', 20, '#3a2a22'], ['さくら広場にて', 18, '#5a4a3a']], -0.03);
    note(262, 20, 230, 120, '#e8f2f0', [['古本交換会', 24, '#2f4a6b'], ['毎週土曜 · 海辺の本屋', 17, '#3a3a3a']], 0.04);
    note(30, 186, 200, 130, '#fff9d6', [['朝市', 26, '#7a5236'], ['日曜 7:00〜 海岸通り', 17, '#3a3a3a']], 0.02);
    note(262, 160, 220, 150, '#ffffff', [['迷い猫 さがしています', 20, '#3a2a22'], ['茶トラ · 名前「みかん」', 17, '#5a4a3a'], ['☎ 0467-xx-xxxx', 16, '#5a4a3a']], -0.04);
  }));

  /* ---- facilities: a drinking fountain and a bin by the south-east bed; flower pots ---- */
  {
    const x = 3.75, z = 31.3, y = gy(x, z), gm = toon('#c9c1b4');
    cy(g, gm, x, y, z, 0.13, 0.78, 14); cy(g, gm, x, y + 0.78, z, 0.2, 0.07, 18); cy(g, toon('#9fb8bc'), x, y + 0.82, z, 0.15, 0.02, 16);
    cyl2(g, toon('#b9bcc0'), [x, y + 0.82, z - 0.04], [x, y + 0.9, z - 0.1], 0.012, 6);
    cy(g, gm, x + 0.32, y, z, 0.17, 0.14, 14); // a step for children
  }
  {
    const x = 3.55, z = 30.4, y = gy(x, z), gm = toon('#3f5a48');
    [-0.17, 0.17].forEach((d, i) => {
      bx(g, gm, x + d - 0.15, x + d + 0.15, y, y + 0.72, z - 0.15, z + 0.15, { bevel: 0.02 }); bx(g, toon('#2b2b2b'), x + d - 0.09, x + d + 0.09, y + 0.56, y + 0.62, z - 0.155, z - 0.15, { cast: false });
      const lab = pl(g, new THREE.MeshBasicMaterial({ map: ct(`plazaBin${i}`, 64, 64, (c, w, h) => { c.fillStyle = i ? '#2f7bd9' : '#d8483f'; c.fillRect(0, 0, w, h); txt(c, i ? '缶・びん' : 'もえる', w / 2, h / 2, 14, '#fff', { font: SERIF }); }) }), 0.18, 0.18, x + d, y + 0.35, z - 0.152, Math.PI, 0); lab.userData.noLine = true;
    });
    bx(g, toon('#2b2f2c'), x - 0.34, x + 0.34, y + 0.72, y + 0.76, z - 0.17, z + 0.17, { bevel: 0.01 });
  }
  [[-8.05, 29.55, '#f2a0c4'], [1.65, 29.55, '#ffffff'], [-9.9, 23.4, '#f2d23a'], [4.2, 23.4, '#9a7ad6']].forEach(([x, z, col], i) => {
    const y = gy(x, z), pot = makePot({ r: 0.13, h: 0.24, seed: 70 + i }), p = pot.group; p.position.set(x, y, z); g.add(p);
    potPlants(PB, x, y + pot.soilY, z, pot.soilR, { style: 'flower', variant: { '#f2a0c4': 1, '#ffffff': 3, '#f2d23a': 0, '#9a7ad6': 2 }[col], seed: i, obj: g });
  });

  PB.flush();
  wetPass([wood, stone]);
  return g;
}

/** a small retro lamp post (warm, on at dusk with the street lamps) */
function lamp(g, x, z, black) {
  const y = groundY(x, z);
  cy(g, black, x, y, z, 0.1, 0.18, 10, { rt: 0.6 }); cy(g, black, x, y + 0.18, z, 0.035, 2.1, 8);
  bx(g, black, x - 0.12, x + 0.12, y + 2.28, y + 2.31, z - 0.12, z + 0.12, { cast: false });
  bx(g, glow('#ffe2b0', 2.2, { cat: 'lamp', off: '#e8e2d2' }), x - 0.09, x + 0.09, y + 2.31, y + 2.55, z - 0.09, z + 0.09, { cast: false });
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), black); cap.position.set(x, y + 2.62, z); cap.rotation.y = Math.PI / 4; g.add(cap);
  halo(g, x, y + 2.4, z, '#ffd9a0', 1.9, 0.4, 'lamp');
}
