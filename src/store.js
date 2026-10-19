import * as THREE from 'three';
import { reg, toon, glow, bx, bc, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, clamp, smooth } from './core.js';
import { makeGlass } from './fx.js';
import { signTex, BRAND, posterTex, T, floorTex } from './tex.js';
import { buildInterior } from './interior.js';

export const ST = { x0: -5.5, x1: 4.5, z0: -4.5, z1: 1.5, Y0: 0.15, F: 0.2, CEIL: 3.3, ROOF: 3.5, GT: 2.85, GB: 0.6 };

export function buildStore(parent, drips) {
  const g = grp(parent);
  const { x0, x1, z0, z1, Y0, GT, GB } = ST;

  const wall = toon('#dcd7ca');
  const tileDark = toon('#2d4b5a');
  const frame = toon('#2a3140');
  const roofM = toon('#4a5268');
  const roofTop = toon('#5c6580');
  const inner = toon('#efe3c6', { lit: 0.6 });
  const teal = toon(BRAND.teal, { e: '#0b4a43', ei: 0.6 });
  const orange = toon(BRAND.orange, { e: '#7a3000', ei: 0.6 });
  const white = toon('#f4f2ea', { lit: 0.3 });

  /* ---------------- walls ---------------- */
  bx(g, wall, x0, x1, Y0, ST.ROOF, z0, z0 + 0.1); // north
  bx(g, wall, x0, x0 + 0.1, Y0, ST.ROOF, z0, z1); // west
  bx(g, wall, x1 - 0.1, x1, Y0, ST.ROOF, z0, -2.2); // east solid
  bx(g, wall, x1 - 0.1, x1, GT, ST.ROOF, -2.2, z1); // east header
  bx(g, tileDark, x1 - 0.1, x1, Y0, GB, -2.2, z1); // east sill
  bx(g, wall, x0, x1, GT, ST.ROOF, z1 - 0.1, z1); // south header
  bx(g, tileDark, x0, 1.3, Y0, GB, z1 - 0.1, z1);
  bx(g, tileDark, 3.1, x1, Y0, GB, z1 - 0.1, z1);
  // tile skirting on solid walls
  bx(g, tileDark, x0 - 0.015, x1 + 0.015, Y0, 0.85, z0 - 0.015, z0 + 0.1);
  bx(g, tileDark, x0 - 0.015, x0 + 0.1, Y0, 0.85, z0, z1 + 0.015);
  bx(g, tileDark, x1 - 0.1, x1 + 0.015, Y0, 0.85, z0, -2.2);

  // interior lining
  bx(g, inner, x0 + 0.1, x1 - 0.1, ST.F, ST.CEIL, z0 + 0.1, z0 + 0.13, { cast: false });
  bx(g, inner, x0 + 0.1, x0 + 0.13, ST.F, ST.CEIL, z0 + 0.1, z1 - 0.1, { cast: false });
  bx(g, inner, x1 - 0.13, x1 - 0.1, ST.F, ST.CEIL, z0 + 0.1, -2.2, { cast: false });
  // ceiling
  bx(g, toon('#f6f3ea', { lit: 0.7 }), x0 + 0.1, x1 - 0.1, ST.CEIL, ST.CEIL + 0.08, z0 + 0.1, z1 - 0.1, { cast: false });
  // floor slab
  bx(g, toon('#cfc9b8'), x0 + 0.1, x1 - 0.1, Y0, ST.F, z0 + 0.1, z1 - 0.1, { cast: false });

  /* ---------------- roof ---------------- */
  bx(g, roofM, x0 - 0.12, x1 + 0.12, ST.ROOF, ST.ROOF + 0.14, z0 - 0.12, z1 + 0.12);
  const par = toon('#e4dfd1');
  bx(g, par, x0 - 0.12, x1 + 0.12, ST.ROOF + 0.14, ST.ROOF + 0.42, z0 - 0.12, z0 - 0.04);
  bx(g, par, x0 - 0.12, x0 - 0.04, ST.ROOF + 0.14, ST.ROOF + 0.42, z0 - 0.12, z1 + 0.12);
  bx(g, par, x1 + 0.04, x1 + 0.12, ST.ROOF + 0.14, ST.ROOF + 0.42, z0 - 0.12, z1 + 0.12);
  bx(g, roofTop, x0 - 0.04, x1 + 0.04, ST.ROOF + 0.14, ST.ROOF + 0.18, z0 - 0.04, z1 + 0.04);
  // rooftop equipment
  const rtAC = (cx, cz, w, d) => {
    bc(g, toon('#c9ced8'), cx, ST.ROOF + 0.18, cz, w, 0.7, d);
    cy(g, toon('#2a3040'), cx - w * 0.22, ST.ROOF + 0.88, cz, 0.3, 0.04, 20, { cast: false });
    cy(g, toon('#2a3040'), cx + w * 0.22, ST.ROOF + 0.88, cz, 0.3, 0.04, 20, { cast: false });
    bc(g, toon('#8d95a8'), cx, ST.ROOF + 0.88, cz, w * 0.96, 0.03, 0.05, { cast: false });
  };
  rtAC(-3.2, -3.0, 1.9, 1.1);
  rtAC(-0.4, -3.2, 1.5, 1.0);
  cy(g, toon('#aab2c2'), 2.2, ST.ROOF + 0.18, -3.3, 0.18, 1.1, 14);
  cy(g, toon('#8d95a8'), 2.2, ST.ROOF + 1.28, -3.3, 0.3, 0.12, 14, { rt: 0.4 });
  // satellite dish
  cyl2(g, toon('#8d95a8'), [3.4, ST.ROOF + 0.18, -3.6], [3.4, ST.ROOF + 1.0, -3.6], 0.03);
  sph(g, toon('#e6e9f0'), 0.38, 3.4, ST.ROOF + 1.1, -3.45, 1, 1, 0.22);

  /* ---------------- floor ---------------- */
  const floorMat = toon('#ffffff', { map: floorTexture(), lit: 0.55, nocache: true });
  const floor = pl(g, floorMat, x1 - x0 - 0.2, z1 - z0 - 0.2, (x0 + x1) / 2, ST.F + 0.002, (z0 + z1) / 2, 0, -Math.PI / 2);
  floor.receiveShadow = true;

  /* ---------------- window frames ---------------- */
  const SX = [-5.5, -3.5, -1.5, 0.4, 1.3, 3.1, 4.5];
  SX.forEach((x) => bx(g, frame, x - 0.04, x + 0.04, Y0, GT + 0.1, z1 - 0.06, z1 + 0.04));
  bx(g, frame, x0, x1, GT, GT + 0.1, z1 - 0.06, z1 + 0.04);
  bx(g, frame, x0, 1.3, GB - 0.04, GB + 0.04, z1 - 0.06, z1 + 0.04);
  bx(g, frame, 3.1, x1, GB - 0.04, GB + 0.04, z1 - 0.06, z1 + 0.04);
  [-0.3, -2.2, 1.5].forEach((z) => bx(g, frame, x1 - 0.06, x1 + 0.04, Y0, GT + 0.1, z - 0.04, z + 0.04));
  bx(g, frame, x1 - 0.06, x1 + 0.04, GT, GT + 0.1, -2.2, z1);
  bx(g, frame, x1 - 0.06, x1 + 0.04, GB - 0.04, GB + 0.04, -2.2, z1);
  // thick corner pillar
  bx(g, toon('#c9c4b5'), x1 - 0.12, x1 + 0.08, Y0, ST.ROOF, z1 - 0.08, z1 + 0.12);
  bx(g, toon('#c9c4b5'), x0 - 0.04, x0 + 0.14, Y0, ST.ROOF, z1 - 0.08, z1 + 0.12);

  /* ---------------- glass ---------------- */
  const paneH = GT - GB;
  const glassY = (GT + GB) / 2;
  [[-5.5, -3.5], [-3.5, -1.5], [-1.5, 0.4], [0.4, 1.3], [3.1, 4.5]].forEach(([a, b], i) => {
    pl(g, makeGlass(b - a, paneH, i * 3.1 + 1), b - a - 0.08, paneH, (a + b) / 2, glassY, z1 + 0.012, 0, 0, { noLine: true });
  });
  [[-2.2, -0.3], [-0.3, 1.5]].forEach(([a, b], i) => {
    pl(g, makeGlass(b - a, paneH, i * 5.3 + 17), b - a - 0.08, paneH, x1 + 0.012, glassY, (a + b) / 2, Math.PI / 2, 0, { noLine: true });
  });

  // warm interior haze right behind the glass: lifts the whole shop and sells the "lit from within" feel
  const haze = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.74, 0.42), transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  [[-5.5, -3.5], [-3.5, -1.5], [-1.5, 0.4], [0.4, 3.1], [3.1, 4.5]].forEach(([a, b]) => pl(g, haze, b - a, paneH, (a + b) / 2, glassY, z1 - 0.25, 0, 0, { noLine: true }));
  [[-2.2, -0.3], [-0.3, 1.5]].forEach(([a, b]) => pl(g, haze, b - a, paneH, x1 - 0.25, glassY, (a + b) / 2, Math.PI / 2, 0, { noLine: true }));

  /* ---------------- automatic doors ---------------- */
  const doorGlassMat = (s) => makeGlass(0.9, paneH, s, { alpha: 0.05 });
  const makeDoor = (xc, side) => {
    const d = grp(g, xc, 0, z1 - 0.07);
    const w = 0.9;
    bx(d, frame, -w / 2, w / 2, GB, GB + 0.06, -0.025, 0.025);
    bx(d, frame, -w / 2, w / 2, GT - 0.06, GT, -0.025, 0.025);
    bx(d, frame, -w / 2, -w / 2 + 0.05, GB, GT, -0.025, 0.025);
    bx(d, frame, w / 2 - 0.05, w / 2, GB, GT, -0.025, 0.025);
    // handle bar on the meeting stile
    bx(d, toon('#c8d0de'), side * (w / 2 - 0.08) - 0.015, side * (w / 2 - 0.08) + 0.015, 1.0, 1.55, 0.03, 0.06, { cast: false });
    pl(d, doorGlassMat(side * 4 + 9), w - 0.1, paneH - 0.1, 0, glassY, 0.03, 0, 0, { noLine: true });
    // frosted logo band
    pl(d, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }), w - 0.1, 0.34, 0, 1.18, 0.034, 0, 0, { noLine: true });
    return d;
  };
  const dl = makeDoor(1.75, 1);
  const dr = makeDoor(2.65, -1);
  // sensor + track
  bx(g, toon('#1c2230'), 1.3, 3.1, GT - 0.06, GT + 0.08, z1 - 0.1, z1 + 0.08);
  bx(g, toon('#1c2230'), 2.1, 2.3, GT + 0.02, GT + 0.12, z1 + 0.08, z1 + 0.14, { cast: false });
  dl.userData.keep = true;
  dr.userData.keep = true;
  g.userData.door = { dl, dr };
  reg.doorDebug = () => ({ phase: ds.phase, k: ds.k, x: dl.position.x });
  let ds = { phase: 'closed', t: 0, wait: 3.2, k: 0 };
  reg.updaters.push((t, dt) => {
    ds.t += dt;
    if (ds.phase === 'closed' && ds.t > ds.wait) { ds.phase = 'opening'; ds.t = 0; }
    else if (ds.phase === 'opening') { ds.k = clamp(ds.t / 1.0, 0, 1); if (ds.t >= 1.0) { ds.phase = 'open'; ds.t = 0; } }
    else if (ds.phase === 'open' && ds.t > 2.6) { ds.phase = 'closing'; ds.t = 0; }
    else if (ds.phase === 'closing') { ds.k = 1 - clamp(ds.t / 1.2, 0, 1); if (ds.t >= 1.2) { ds.phase = 'closed'; ds.t = 0; ds.k = 0; ds.wait = 6 + Math.random() * 7; } }
    const e = smooth(0, 1, ds.k);
    dl.position.x = 1.75 - 0.85 * e;
    dr.position.x = 2.65 + 0.85 * e;
    if (reg.lights.door) reg.lights.door.intensity = reg.lights.door.userData.base * (0.35 + 0.65 * e);
  });

  /* ---------------- awnings ---------------- */
  const awTop = toon('#0f6b63', { e: '#06302c', ei: 0.5 });
  const awUnder = toon('#f3efe2', { lit: 0.75 });
  const skirtTex = canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = BRAND.teal; c.fillRect(0, 0, w, h * 0.42);
    c.fillStyle = '#f6f4ea'; c.fillRect(0, h * 0.42, w, h * 0.34);
    c.fillStyle = BRAND.orange; c.fillRect(0, h * 0.76, w, h * 0.24);
  });
  const skirtMat = new THREE.MeshBasicMaterial({ map: skirtTex, color: new THREE.Color(1.25, 1.25, 1.25) });
  const AW_Y = 2.92;
  // south arm
  bx(g, awUnder, x0 - 0.1, 5.45, AW_Y - 0.1, AW_Y, z1, 2.45);
  bx(g, awTop, x0 - 0.1, 5.45, AW_Y, AW_Y + 0.06, z1, 2.45);
  pl(g, skirtMat, 5.45 - (x0 - 0.1), 0.34, (x0 - 0.1 + 5.45) / 2, AW_Y - 0.1 - 0.17 + 0.29, 2.47, 0, 0);
  bx(g, awTop, x0 - 0.1, 5.45, AW_Y - 0.34, AW_Y + 0.06, 2.45, 2.49);
  // east arm
  bx(g, awUnder, x1, 5.45, AW_Y - 0.1, AW_Y, z0 - 0.1, z1);
  bx(g, awTop, x1, 5.45, AW_Y, AW_Y + 0.06, z0 - 0.1, z1);
  bx(g, awTop, 5.43, 5.47, AW_Y - 0.34, AW_Y + 0.06, z0 - 0.1, 2.49);
  pl(g, skirtMat, 2.49 - (z0 - 0.1), 0.34, 5.475, AW_Y - 0.19, (z0 - 0.1 + 2.49) / 2, Math.PI / 2, 0);
  // supports
  [[-5.45, 2.43], [-1.0, 2.43], [5.43, 2.43], [5.43, -1.0], [5.43, -4.4]].forEach(([x, z]) => cy(g, toon('#8e98ab'), x, Y0, z, 0.035, AW_Y - 0.34 - Y0, 8));
  // down-lights under awning
  const dlMat = glow('#fff1cf', 2.0);
  for (let x = -4.8; x <= 4.0; x += 1.8) cy(g, dlMat, x, AW_Y - 0.115, 2.0, 0.1, 0.02, 14, { cast: false });
  for (let z = -3.6; z <= 1.0; z += 1.8) cy(g, dlMat, 4.98, AW_Y - 0.115, z, 0.1, 0.02, 14, { cast: false });
  // drip points (eaves)
  const R = rng(3);
  for (let x = -5.3; x < 5.4; x += 0.9 + R() * 0.5) drips.push([x, AW_Y - 0.34, 2.49, Y0 + 0.01]);
  for (let z = -4.3; z < 2.4; z += 1.0 + R() * 0.6) drips.push([5.47, AW_Y - 0.34, z, Y0 + 0.01]);

  /* ---------------- fascia signs ---------------- */
  const signS = new THREE.MeshBasicMaterial({ map: signTex(2048, 246), color: new THREE.Color(1.05, 1.03, 0.98) });
  const signE = new THREE.MeshBasicMaterial({ map: signTex(1230, 246), color: new THREE.Color(1.05, 1.03, 0.98) });
  const sideM = toon('#e7e2d4', { e: '#8a8676', ei: 0.4 });
  const SY0 = 3.08, SY1 = 4.28;
  bx(g, sideM, x0 - 0.1, x1 + 0.14, SY0, SY1, z1, z1 + 0.2);
  pl(g, signS, x1 + 0.14 - (x0 - 0.1) - 0.1, SY1 - SY0 - 0.1, (x0 - 0.1 + x1 + 0.14) / 2, (SY0 + SY1) / 2, z1 + 0.202, 0, 0);
  bx(g, sideM, x1, x1 + 0.2, SY0, SY1, z0 - 0.1, z1);
  pl(g, signE, z1 - z0 + 0.1 - 0.1, SY1 - SY0 - 0.1, x1 + 0.202, (SY0 + SY1) / 2, (z0 - 0.1 + z1) / 2, Math.PI / 2, 0);
  // brand light strips on sign edge
  bx(g, teal, x0 - 0.1, x1 + 0.14, SY1, SY1 + 0.06, z1, z1 + 0.2, { cast: false });
  bx(g, teal, x1, x1 + 0.2, SY1, SY1 + 0.06, z0 - 0.1, z1, { cast: false });
  reg.signS = signS;
  reg.signE = signE;
  halo(g, 0, 3.7, 2.4, '#fff4d6', 9, 0.1);
  halo(g, 5.6, 3.7, -1.5, '#fff4d6', 6, 0.08);

  /* ---------------- window posters (stuck inside the glass) ---------------- */
  const posterMat = (i) => new THREE.MeshBasicMaterial({ map: posterTex(i), color: new THREE.Color(0.95, 0.95, 0.95) });
  pl(g, posterMat(0), 0.52, 0.74, -4.8, 1.55, z1 - 0.045, 0, 0, { noLine: true });
  pl(g, posterMat(1), 0.52, 0.74, -4.16, 1.4, z1 - 0.045, 0, 0, { noLine: true });
  pl(g, posterMat(6), 0.52, 0.74, -3.86, 1.9, z1 - 0.045, 0, 0, { noLine: true });
  pl(g, posterMat(3), 0.5, 0.7, -0.9, 2.05, z1 - 0.045, 0, 0, { noLine: true });
  pl(g, posterMat(2), 0.5, 0.7, x1 - 0.045, 1.9, 1.1, -Math.PI / 2, 0, { noLine: true });
  // east solid wall exterior posters (behind vending machines) + notice
  pl(g, posterMat(4), 0.7, 1.0, x1 + 0.012, 1.7, -3.7, Math.PI / 2, 0, { noLine: true });

  /* ---------------- 24h neon in the window ---------------- */
  const neon = canvasTex(512, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#ff5fa8'; c.lineWidth = 12; c.lineCap = 'round';
    c.shadowColor = '#ff5fa8'; c.shadowBlur = 24;
    roundRectPath(c, 20, 20, w - 40, h - 40, 30); c.stroke();
    T(c, 'OPEN', w / 2 - 70, h / 2 + 2, 84, '#fff', { weight: 800, stroke: '#ff5fa8', sw: 8 });
    T(c, '24h', w / 2 + 150, h / 2 + 4, 62, '#7ff5ff', { weight: 800, stroke: '#2bb6d6', sw: 6 });
  });
  const neonMat = new THREE.MeshBasicMaterial({ map: neon, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false });
  const neonPlane = pl(g, neonMat, 0.9, 0.28, -2.5, 2.35, z1 - 0.05, 0, 0, { noLine: true });
  reg.neonOpen = neonMat;

  /* ---------------- exterior details ---------------- */
  // downpipes
  cy(g, toon('#9aa3b6'), x1 + 0.05, Y0, z0 + 0.06, 0.05, ST.ROOF - Y0, 10);
  cy(g, toon('#9aa3b6'), x0 - 0.0, Y0, z1 + 0.12, 0.045, GT - Y0, 10);
  // AC outdoor units on west wall (alley)
  const acUnit = (z, y) => {
    const a = grp(g, x0 - 0.3, y, z);
    bx(a, toon('#d6dae3'), -0.22, 0.22, 0, 0.62, -0.45, 0.45);
    bx(a, toon('#2b3342'), -0.24, -0.2, 0.06, 0.56, -0.4, 0.4, { cast: false });
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 20), toon('#7f889b'));
    fan.rotation.y = Math.PI / 2; fan.position.set(-0.235, 0.31, 0); a.add(fan);
    for (let k = 0; k < 4; k++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.2, 0.05), toon('#6d768a'));
      bl.position.set(-0.235, 0.31, 0); bl.rotation.x = (k * Math.PI) / 4; a.add(bl);
    }
    bx(a, toon('#8b93a6'), -0.22, 0.22, -0.05, 0.0, -0.4, 0.4, { cast: false });
    return a;
  };
  acUnit(-1.2, 0.15);
  acUnit(0.5, 0.15);
  acUnit(-3.6, 1.1);
  // conduit & pipes
  cyl2(g, toon('#7a8398'), [x0 - 0.12, 0.2, -2.6], [x0 - 0.12, 3.2, -2.6], 0.03);
  cyl2(g, toon('#7a8398'), [x0 - 0.12, 2.2, -2.6], [x0 - 0.12, 2.2, -0.6], 0.03);
  // alley wall light
  const wl = bx(g, toon('#2b3342'), x0 - 0.18, x0, 2.7, 2.85, -2.1, -1.8);
  bx(g, glow('#ffe6b0', 2.4), x0 - 0.16, x0 - 0.02, 2.62, 2.7, -2.08, -1.82, { cast: false, noLine: false });
  halo(g, x0 - 0.35, 2.65, -1.95, '#ffd9a0', 1.6, 0.55);
  plight(g, '#ffd7a0', 5.5, 6, x0 - 0.5, 2.5, -1.95, 'alleyLamp');
  // back door (alley side)
  bx(g, toon('#7e8798'), x0 - 0.04, x0, 0.15, 2.1, -3.8, -2.9);
  bx(g, toon('#444c5e'), x0 - 0.08, x0 - 0.04, 0.15, 2.18, -3.84, -2.86);
  // mat + step at the entrance
  const matTex = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#1b2638'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2f435e'; c.lineWidth = 3;
    for (let i = 0; i < 24; i++) { c.beginPath(); c.moveTo(i * 22, 0); c.lineTo(i * 22, h); c.stroke(); }
    c.strokeStyle = BRAND.orange; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    T(c, 'いらっしゃいませ', w / 2, h / 2, 46, '#e8eef8', { weight: 800 });
  });
  const mat = pl(g, toon('#ffffff', { map: matTex, nocache: true }), 1.8, 0.56, 2.2, 0.172, 2.0, 0, -Math.PI / 2, { noLine: true });
  bx(g, toon('#141c2c'), 1.28, 3.12, Y0, 0.17, 1.74, 2.28, { cast: false });
  mat.position.y = 0.175;

  /* ---------------- lights ---------------- */
  plight(g, '#ffe3b8', 8, 9, -3.0, 3.0, -1.3, 'inA');
  plight(g, '#ffe8c4', 8, 9, 1.0, 3.0, -2.0, 'inB');
  plight(g, '#ffe6c0', 7, 9, 2.6, 2.3, 2.3, 'door');

  buildInterior(g, ST);
  return g;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function floorTexture() {
  return floorTex(ST.x1 - ST.x0 - 0.2, ST.z1 - ST.z0 - 0.2);
}
