import * as THREE from 'three';
import { reg, toon, glow, cy, cyl2, bx, grp, halo, rng } from '../core.js';
import { utilityPole, wire, streetLamp, roadSign, signalHead, guardrail } from '../street.js';
import { groundY, PAV, BLOCKS, LANES, CROSSINGS, RAIL, lakeParkH } from './layout.js';

/* ====================================================================================================
   Town street furniture. The original board's helpers (street.js) sit on Y0 = 0.15, so everything is
   placed through `lift()`, a group that moves them onto the real ground height of the spot.
   Traffic signals only at the important junctions; minor junctions get stop lines, 止まれ and signs.
   ==================================================================================================== */

export function buildFurniture(parent, lake) {
  const g = grp(parent);
  const lift = (x, z) => grp(g, 0, groundY(x, z) - PAV, 0);

  /* ---------------------------------------------------------------- street lamps (no point lights: glow + halo only) */
  const lamps = [
    [12.6, -40, -1, 0], [12.6, -31, -1, 0], [7.1, 18, 1, 0], [7.1, 28, 1, 0],
    [-42, 12.4, 0, -1], [-28, 12.4, 0, -1], [-4, 12.4, 0, -1], [20, 12.4, 0, -1], [-22, 6.1, 0, 1], [24, 6.1, 0, 1],
    [-40, -15.4, 0, 1], [-26, -15.4, 0, 1], [20, -15.4, 0, 1],
    [-13.1, 20, -1, 0], [33.4, -4, -1, 0], [33.4, 22, -1, 0], [-34.2, 0, 1, 0], [-24, 26.6, 0, -1], [-18.9, -32, 1, 0],
  ];
  lamps.forEach(([x, z, dx, dz], i) => streetLamp(lift(x, z), x, z, dx, dz, 4.6, 1.5, i % 3 ? '#ffe0a8' : '#dfeaff', 0, null));

  // low garden lamps along the lake walk
  const lampM = glow('#ffd9a0', 2.6);
  const postM = toon('#3a3f4c');
  if (lake) {
    lake.ringPts.forEach(([x, z, a], i) => {
      if (i % 27 !== 5 || x > -20.2) return;
      const dx = x - (-32.5), dz = z - (-33.5), l = Math.hypot(dx, dz);
      const px = x + (dx / l) * 0.95, pz = z + (dz / l) * 0.95;
      const y = lakeParkH(px, pz);
      cy(g, postM, px, y, pz, 0.05, 2.6, 8);
      bx(g, postM, px - 0.17, px + 0.17, y + 2.58, y + 2.64, pz - 0.17, pz + 0.17, { cast: false });
      bx(g, lampM, px - 0.12, px + 0.12, y + 2.3, y + 2.58, pz - 0.12, pz + 0.12, { cast: false });
      halo(g, px, y + 2.45, pz, '#ffd9a0', 1.8, 0.5);
    });
    // benches facing the water
    const wood = toon('#7a5a40'), iron = toon('#2b2f3a');
    [0.9, 2.6, 4.4].forEach((a) => {
      const t = 1.33 * (1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1));
      const x = -32.5 + Math.cos(a) * 10.5 * t, z = -33.5 + Math.sin(a) * 6.8 * t;
      if (x > -20.5) return;
      const B = grp(g, x, lakeParkH(x, z), z, Math.atan2(-32.5 - x, -33.5 - z));
      [-0.6, 0.6].forEach((o) => bx(B, iron, o - 0.04, o + 0.04, 0, 0.42, -0.2, 0.2));
      for (let k = 0; k < 3; k++) bx(B, wood, -0.75, 0.75, 0.42, 0.46, -0.2 + k * 0.14, -0.1 + k * 0.14);
      for (let k = 0; k < 2; k++) bx(B, wood, -0.75, 0.75, 0.55 + k * 0.16, 0.65 + k * 0.16, -0.24, -0.21);
    });
  }

  /* ---------------------------------------------------------------- utility poles + wires */
  const pole = (x, z, axis) => { utilityPole(lift(x, z), x, z, 7.4, axis); return [x, groundY(x, z) + 7.4, z]; };
  const off = { x: [[0, -0.15, -0.8], [0, -0.15, 0], [0, -0.15, 0.8], [0, -0.95, -0.6], [0, -0.95, 0.6]], z: [[-0.8, -0.15, 0], [0, -0.15, 0], [0.8, -0.15, 0], [-0.6, -0.95, 0], [0.6, -0.95, 0]] };
  const chain = (pts, axis, sag = 0.85) => {
    const tops = pts.map(([x, z]) => pole(x, z, axis));
    for (let i = 0; i < tops.length - 1; i++) off[axis].forEach((o) => wire(g, [tops[i][0] + o[0], tops[i][1] + o[1], tops[i][2] + o[2]], [tops[i + 1][0] + o[0], tops[i + 1][1] + o[1], tops[i + 1][2] + o[2]], sag));
    return tops;
  };
  // Kaigan-dori north side, joining the board's pole at (-11, 6.05)
  const kw = chain([[-47, 6.05], [-40, 6.05], [-34, 6.05], [-26, 6.05], [-18.5, 6.05]], 'x');
  off.x.forEach((o) => wire(g, [kw[kw.length - 1][0] + o[0], kw[kw.length - 1][1] + o[1], kw[kw.length - 1][2] + o[2]], [-11 + o[0], 7.2 + PAV + o[1], 6.05 + o[2]], 0.8));
  chain([[14, 6.05], [21.5, 6.05], [29, 6.05]], 'x');
  // Kita-dori south side
  chain([[-46, -11.7], [-38, -11.7], [-27, -11.7], [-19, -11.7]], 'x');
  chain([[14.5, -11.7], [22, -11.7], [29, -11.7]], 'x');
  // lanes
  chain([[-13.1, 14], [-13.1, 22], [-13.1, 30]], 'z');
  chain([[33.4, -9], [33.4, -1], [33.4, 15], [33.4, 23]], 'z', 0.9);
  chain([[-20, 26.4], [-28, 27.0], [-36, 25.6], [-44, 25.2]], 'x');
  // service drops to future houses (they end at the lot edge, like a cut lead waiting for the house)
  wire(g, [-34, 6.4 + 0.15, 6.05], [-37, 2.6, 4.6], 0.4, 0.013);
  wire(g, [22, 7.25 + 0.3, 6.05], [24.5, 3.0, 4.6], 0.4, 0.013);

  /* ---------------------------------------------------------------- signals: Hoshizora-dori × Kita-dori */
  {
    const heads = [];
    const mast = (x, z, ry, armLen, hx) => {
      const P = grp(lift(x, z), x, PAV, z, ry);
      cy(P, toon('#7d869a'), 0, 0, 0, 0.09, 4.7, 10, { rt: 0.75 });
      cyl2(P, toon('#7d869a'), [0, 4.7, 0], [armLen, 4.84, 0], 0.06, 8, { rt: 0.7 });
      hx.forEach((dx) => { cyl2(P, toon('#4a5266'), [dx, 4.82, 0], [dx, 4.56, 0], 0.025, 5); heads.push({ h: signalHead(P, dx, 4.4, 0, 0), grp: 'main' }); });
    };
    mast(12.45, -11.55, Math.PI, 2.2, [1.4]); // southbound, far side
    mast(7.15, -15.45, 0, 2.2, [1.5]); // northbound, far side
    const post = (x, z, ry) => {
      const P = grp(lift(x, z), x, PAV, z, ry);
      cy(P, toon('#7d869a'), 0, 0, 0, 0.07, 3.6, 10);
      heads.push({ h: signalHead(P, 0, 3.55, 0.12, 0), grp: 'side' });
    };
    post(12.45, -14.7, -Math.PI / 2); // eastbound Kita-dori
    post(7.15, -12.25, Math.PI / 2); // westbound Kita-dori
    const CYC = 26;
    reg.updaters.push((t) => {
      const k = (t + 7) % CYC;
      const main = k < 11 ? 'g' : k < 13 ? 'y' : 'r';
      const side = k > 13.5 && k < 23 ? 'g' : k >= 23 && k < 25 ? 'y' : 'r';
      heads.forEach(({ h, grp: gp }) => {
        const ph = gp === 'main' ? main : side;
        h.lens.forEach((l) => { const on = l.k === ph; l.m.color.copy(l.c).multiplyScalar(on ? 3.0 : 0.09); l.halo.material.opacity = on ? 0.9 : 0; });
      });
    });
  }

  /* ---------------------------------------------------------------- signs */
  const sign = (x, z, ry, kind, h = 2.5, size = 0.66) => roadSign(lift(x, z), x, z, ry, kind, h, size);
  sign(7.25, -11.2, 0, 'rail'); sign(12.45, -27, Math.PI, 'rail'); sign(-13.2, -10.5, 0, 'rail'); sign(-18.7, -27.5, Math.PI, 'rail');
  sign(4.3, -15.4, -Math.PI / 2, 'cross', 2.4, 0.55);
  sign(-13.2, 5.9, Math.PI, 'stop', 2.4, 0.7); sign(-16.8, 12.45, 0, 'stop', 2.4, 0.7);
  sign(33.4, 5.9, Math.PI, 'stop', 2.4, 0.7); sign(29.65, 12.45, 0, 'stop', 2.4, 0.7);
  sign(-33.8, 5.9, Math.PI, 'stop', 2.4, 0.7); sign(-28.6, -11.6, 0, 'stop', 2.4, 0.7);
  sign(-26, 6.05, -Math.PI / 2, '40', 2.6, 0.6); sign(24, 12.45, Math.PI / 2, '40', 2.6, 0.6);
  sign(-34.2, -6, 0, '30', 2.5, 0.55); sign(30.0 - 0.35, -6, Math.PI, '30', 2.5, 0.55);
  sign(-29.0, -4, Math.PI, 'curve', 2.4, 0.6);
  sign(-16.9, -10.8, 0, 'lake', 2.9, 0.95); sign(12.45, -16, 0, 'station', 2.9, 0.95);

  /* ---------------------------------------------------------------- curve mirrors (カーブミラー) at the blind T-junctions */
  {
    const orange = toon('#e8762b', { e: '#3a1a04', ei: 0.3 });
    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.72, 0.84) });
    const mirror = (x, z, face) => {
      const P = grp(lift(x, z), x, PAV, z, face);
      cy(P, orange, 0, 0, 0, 0.045, 2.75, 8);
      cyl2(P, orange, [0, 2.7, 0], [0, 2.75, 0.12], 0.03, 6);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), orange);
      back.rotation.x = Math.PI / 2; back.position.set(0, 2.85, 0.15); back.castShadow = true; P.add(back);
      const face_ = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 8, 0, Math.PI * 2, 0, 0.5), glass);
      face_.rotation.x = Math.PI / 2; face_.position.set(0, 2.85, 0.16); face_.userData.noLine = true; P.add(face_);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.03, 6, 22), orange);
      rim.position.set(0, 2.85, 0.19); P.add(rim);
    };
    mirror(-28.6, -11.3, Math.PI * 0.8); mirror(-29.2, 5.85, Math.PI * 0.25); mirror(-17.0, 25.9, Math.PI * 0.3);
    mirror(-13.15, -11.4, -Math.PI * 0.75); mirror(29.65, -11.4, Math.PI * 0.75); mirror(-12.95, 12.6, -Math.PI * 0.25);
  }

  /* ---------------------------------------------------------------- stone stairs up to the shrine terrace */
  {
    const stone = toon('#8b8a94'), dark = toon('#6c6b76');
    const z0 = -22.95, z1 = -21.75, x0 = -9.3, n = 15, tread = 0.45, rise = (2.2 - PAV) / n;
    for (let i = 0; i < n; i++) bx(g, i % 2 ? stone : dark, x0 + i * tread, -1.3, PAV, PAV + (i + 1) * rise, z0, z1);
    // side wall + handrail
    bx(g, dark, x0, -1.3, PAV, PAV + 0.1, z1, z1 + 0.18);
    const rail = toon('#5b4a3c');
    for (let i = 0; i <= 5; i++) { const x = x0 + 0.2 + i * 1.3; const y = PAV + Math.min(n, (x - x0) / tread) * rise; cy(g, rail, x, y, z1 + 0.09, 0.03, 0.9, 6); }
    cyl2(g, rail, [x0 + 0.2, PAV + 0.9 + 0.2 / tread * rise, z1 + 0.09], [x0 + 0.2 + 6.5, PAV + 0.9 + Math.min(n, 6.7 / tread) * rise, z1 + 0.09], 0.035, 6);
  }

  /* ---------------------------------------------------------------- fence along the top of the terrace walls */
  {
    const T = BLOCKS.find((b) => b.id === 'terrace');
    const fm = toon('#3d3b42');
    const edges = [[[7.25, -44], [7.25, -23.25]], [[7.25, -23.25], [-1.0, -23.25]], [[-3.0, -23.25], [-13.3, -23.25]], [[-13.3, -23.25], [-13.85, -24.5]], [[-13.85, -24.5], [-15.25, -29]], [[-15.25, -29], [-15.75, -36]], [[-15.75, -36], [-15.75, -43.6]]];
    edges.forEach(([a, b]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.6));
      for (let i = 0; i <= n; i++) { const x = a[0] + ((b[0] - a[0]) * i) / n, z = a[1] + ((b[1] - a[1]) * i) / n; cy(g, fm, x, T.h(x, z), z, 0.03, 0.95, 6); }
      [0.92, 0.5].forEach((h) => cyl2(g, fm, [a[0], 2.2 + h, a[1]], [b[0], 2.2 + h, b[1]], 0.022, 5));
    });
  }

  /* ---------------------------------------------------------------- guardrail on the bank side of the lake lane */
  {
    const segs = [[[-16.7, -24.6], [-18.15, -29.2]], [[-18.15, -29.2], [-19.15, -36]], [[-19.15, -36], [-19.15, -42.8]]];
    segs.forEach(([a, b]) => { const y = Math.min(groundY(a[0], a[1]), groundY(b[0], b[1])); const G = grp(g, 0, y - PAV, 0); guardrail(G, a[0], a[1], b[0], b[1]); });
  }

  /* ---------------------------------------------------------------- bollards at the footpath crossing */
  {
    const c = CROSSINGS.find((q) => q.id === 'sando');
    const bm = toon('#e8b82a', { e: '#4a3808', ei: 0.4 });
    [-16.4, -15.6].forEach((z) => [c.x0 + 0.15, c.x1 - 0.15].forEach((x) => cy(g, bm, x, PAV, z, 0.06, 0.8, 8)));
  }
  return { group: g };
}
