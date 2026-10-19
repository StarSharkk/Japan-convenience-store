import * as THREE from 'three';
import { reg, toon, glow, bx, bc, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect } from './core.js';
import { makeGlass } from './fx.js';
import { T } from './tex.js';

const Y0 = 0.15;

/* =========================================================== instanced windows */
function windows(parent, list, o = {}) {
  // list: [x,y,z,w,h, color(THREE.Color)]
  const geo = new THREE.PlaneGeometry(1, 1);
  if (o.ry) geo.rotateY(o.ry);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const im = new THREE.InstancedMesh(geo, m, list.length);
  const frameGeo = new THREE.BoxGeometry(1, 1, 1);
  const fm = new THREE.InstancedMesh(frameGeo, toon('#1d2231', { nocache: true }), list.length);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, o.ry || 0, 0);
  q.setFromEuler(e);
  list.forEach((a, i) => {
    const nx = Math.sin(o.ry || 0), nz = Math.cos(o.ry || 0);
    mtx.compose(new THREE.Vector3(a[0] + nx * 0.115, a[1], a[2] + nz * 0.115), q, new THREE.Vector3(a[3], a[4], 1));
    im.setMatrixAt(i, mtx);
    im.setColorAt(i, a[5]);
    const sx = o.ry ? 0.1 : a[3] + 0.12, sz = o.ry ? a[3] + 0.12 : 0.1;
    mtx.compose(new THREE.Vector3(a[0] + nx * 0.025, a[1], a[2] + nz * 0.025), q.identity(), new THREE.Vector3(sx, a[4] + 0.12, sz));
    fm.setMatrixAt(i, mtx);
    q.setFromEuler(e);
  });
  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  fm.castShadow = true;
  im.userData.noLine = false;
  parent.add(im, fm);
  return im;
}

const WARM = [new THREE.Color(1.0, 0.76, 0.42), new THREE.Color(0.92, 0.66, 0.36), new THREE.Color(1.05, 0.92, 0.58)];
const COOL = [new THREE.Color(0.48, 0.72, 1.0), new THREE.Color(0.4, 0.6, 0.9)];
const PINK = [new THREE.Color(0.95, 0.46, 0.68)];
const OFF = [new THREE.Color(0.05, 0.07, 0.13), new THREE.Color(0.07, 0.09, 0.17), new THREE.Color(0.04, 0.06, 0.1)];
function pickWin(R) {
  const v = R();
  const arr = v < 0.5 ? WARM : v < 0.62 ? COOL : v < 0.68 ? PINK : OFF;
  return arr[(R() * arr.length) | 0];
}

/* =========================================================== izakaya + flat (west neighbour) */
function izakaya(parent, drips) {
  const g = grp(parent);
  const X0 = -12, X1 = -8.5, Z0 = -7.2, Z1 = 3.5;
  const H = 6.6;
  const plaster = toon('#b9afa0');
  const wood = toon('#5b4030');
  const tile = toon('#2a2d3c');
  bx(g, plaster, X0, X1, Y0, H, Z0, Z1);
  bx(g, toon('#3d342d'), X0, X1 + 0.02, Y0, 1.0, Z0, Z1 + 0.02); // lower wainscot
  bx(g, toon('#8e8474'), X0 - 0.05, X1 + 0.08, 3.55, 3.72, Z0, Z1 + 0.08); // floor band
  // tiled gable roof (ridge runs north-south), plaster gable ends, ridge cap
  {
    const rx0 = X0 - 0.1, rx1 = X1 + 0.45, rz0 = Z0 - 0.1, rz1 = Z1 + 0.7;
    const sh = new THREE.Shape();
    sh.moveTo(rx0, 0); sh.lineTo(rx1, 0); sh.lineTo((X0 + X1) / 2 + 0.15, 1.15); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: rz1 - rz0, bevelEnabled: false });
    geo.translate(0, H, rz0);
    const roofMesh = new THREE.Mesh(geo, [plaster, toon('#2b3048')]);
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    g.add(roofMesh);
    bx(g, toon('#3d4466'), (X0 + X1) / 2 + 0.05, (X0 + X1) / 2 + 0.25, H + 1.1, H + 1.25, rz0 - 0.05, rz1 + 0.05);
    bx(g, toon('#2b3048'), rx0, rx1, H - 0.1, H, rz0, rz1);
    // antenna on the ridge
    cyl2(g, toon('#9aa3b6'), [-10.2, H + 1.25, 0], [-10.2, H + 2.75, 0], 0.03, 5);
    [0.5, 0.95, 1.35].forEach((d, i) => cyl2(g, toon('#9aa3b6'), [-10.55 - i * 0.04, H + 1.25 + d, 0], [-9.85 + i * 0.04, H + 1.25 + d, 0], 0.018, 4));
  }

  /* ---- ground floor south: izakaya front ---- */
  // eave (kawara)
  bx(g, tile, X0, X1 + 0.3, 3.0, 3.16, Z1, Z1 + 1.0);
  bx(g, toon('#1d2030'), X0, X1 + 0.3, 2.84, 3.0, Z1 + 0.96, Z1 + 1.0, { cast: false });
  for (let x = X0 + 0.15; x < X1 + 0.3; x += 0.3) bx(g, toon('#3a3f55'), x, x + 0.16, 3.16, 3.22, Z1, Z1 + 1.0, { cast: false });
  [[X0 + 0.1], [X1 + 0.2]].forEach(([x]) => cy(g, wood, x, Y0, Z1 + 0.9, 0.05, 2.7, 6));
  // lattice door
  const door = (() => {
    const t = canvasTex(256, 360, (c, w, h) => {
      c.fillStyle = '#ffd9a0'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#5b3a1e'; c.lineWidth = 8;
      for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y <= h; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeRect(4, 4, w - 8, h - 8);
    });
    return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.15, 0.7) });
  })();
  bx(g, wood, -10.55, -9.15, Y0, 2.6, Z1 - 0.05, Z1 + 0.1);
  pl(g, door, 1.2, 2.2, -9.85, 1.3, Z1 + 0.115, 0, 0);
  pl(g, makeGlass(1.2, 2.2, 31, { alpha: 0.02 }), 1.2, 2.2, -9.85, 1.3, Z1 + 0.13, 0, 0, { noLine: true });
  // noren
  const norenTex = canvasTex(256, 200, (c, w, h) => {
    c.fillStyle = '#1b2f6b'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 18; i++) c.fillRect(0, i * 11, w, 2);
    c.fillStyle = '#e8ecf6'; c.beginPath(); c.arc(w / 2, 72, 40, 0, 7); c.fill();
    c.fillStyle = '#1b2f6b'; c.beginPath(); c.arc(w / 2 + 12, 62, 34, 0, 7); c.fill();
    c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(w / 2 - 12, 72, 5, 0, 7); c.arc(w / 2 + 5, 90, 3, 0, 7); c.fill();
    T(c, 'ほたる', w / 2, 158, 56, '#e8ecf6', { weight: 800 });
  });
  const norens = [];
  [-10.45, -9.85, -9.25].forEach((x, i) => {
    const n = grp(g, x, 2.55, Z1 + 0.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.75), new THREE.MeshBasicMaterial({ map: norenTex, color: new THREE.Color(0.55, 0.55, 0.62), side: THREE.DoubleSide }));
    m.position.y = -0.38;
    const uvs = m.geometry.attributes.uv;
    for (let k = 0; k < uvs.count; k++) uvs.setX(k, (uvs.getX(k) + i) / 3);
    n.userData.keep = true;
    n.add(m); norens.push(n);
  });
  cyl2(g, wood, [-10.8, 2.56, Z1 + 0.2], [-8.95, 2.56, Z1 + 0.2], 0.018, 5);
  reg.updaters.push((t) => norens.forEach((n, i) => (n.rotation.x = Math.sin(t * 1.3 + i * 1.1) * 0.05)));
  // lantern
  // string of small red chochin lanterns along the eave
  {
    const lm2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.3, 0.2) });
    for (let x = -11.7; x < -8.9; x += 0.62) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), lm2);
      l.scale.set(0.9, 1.15, 0.9); l.position.set(x, 2.68, Z1 + 0.88); g.add(l);
      cy(g, toon('#14161e'), x, 2.78, Z1 + 0.88, 0.04, 0.05, 8);
    }
    halo(g, -10.3, 2.65, Z1 + 1.0, '#ff4a2a', 3.4, 0.28);
  }
  // wooden plaque between the floors
  {
    const pq = canvasTex(512, 128, (c, w, h) => {
      c.fillStyle = '#3a2619'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c9a25a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
      T(c, '炭火焼  ほたる', w / 2, h / 2 + 3, 64, '#f2d89a', { weight: 800 });
    });
    pl(g, new THREE.MeshBasicMaterial({ map: pq, color: new THREE.Color(0.8, 0.75, 0.62) }), 1.5, 0.375, -10.25, 3.38, Z1 + 0.06, 0, 0);
  }
  const lanternPos = [-8.85, 2.15, Z1 + 0.55];
  const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 0.35, 0.22) });
  const lan = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lm);
  lan.scale.set(0.9, 1.15, 0.9); lan.position.set(...lanternPos); g.add(lan);
  cy(g, toon('#14161e'), lanternPos[0], lanternPos[1] + 0.2, lanternPos[2], 0.1, 0.07, 10);
  cy(g, toon('#14161e'), lanternPos[0], lanternPos[1] - 0.27, lanternPos[2], 0.1, 0.07, 10);
  const lt = canvasTex(128, 128, (c, w, h) => { T(c, '酒', 64, 64, 90, '#14161e', { weight: 900 }); });
  pl(g, new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false }), 0.2, 0.2, lanternPos[0], lanternPos[1], lanternPos[2] + 0.2, 0, 0, { noLine: true });
  halo(g, lanternPos[0], lanternPos[1], lanternPos[2], '#ff4a2a', 2.2, 0.7);
  plight(g, '#ff5a30', 7, 6, lanternPos[0], lanternPos[1], lanternPos[2] + 0.4, 'lantern');
  // window (left) with bamboo blind
  const bam = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffc982'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { c.fillStyle = x % 32 ? '#e8aa5a' : '#f2b96b'; c.fillRect(x, 0, 12, h); }
    c.fillStyle = '#6b4a2a'; c.fillRect(0, h * 0.5, w, 6);
  });
  bx(g, wood, -11.95, -10.8, 1.05, 2.3, Z1 - 0.04, Z1 + 0.08);
  pl(g, new THREE.MeshBasicMaterial({ map: bam, color: new THREE.Color(1.2, 1.0, 0.7) }), 1.0, 1.1, -11.38, 1.68, Z1 + 0.09, 0, 0);
  pl(g, makeGlass(1.0, 1.1, 33, { alpha: 0.03 }), 1.0, 1.1, -11.38, 1.68, Z1 + 0.1, 0, 0, { noLine: true });
  // standing sign
  {
    const a = grp(g, -9.0, Y0, Z1 + 1.25, 0.15);
    bx(a, wood, -0.28, 0.28, 0, 0.9, -0.02, 0.02);
    const sg = canvasTex(256, 400, (c, w, h) => {
      c.fillStyle = '#20302a'; c.fillRect(0, 0, w, h);
      T(c, '本日の', w / 2, 60, 46, '#fff8e0'); T(c, 'おすすめ', w / 2, 120, 50, '#ffd24a');
      T(c, '焼き鳥  ¥280', w / 2, 210, 36, '#fff'); T(c, '枝豆    ¥350', w / 2, 262, 36, '#fff'); T(c, '生ビール ¥520', w / 2, 314, 36, '#fff');
    });
    pl(a, new THREE.MeshBasicMaterial({ map: sg, color: new THREE.Color(0.75, 0.75, 0.75) }), 0.52, 0.82, 0, 0.45, 0.025, 0, 0);
  }
  // upper floor south: balcony + windows
  bx(g, toon('#8e8474'), X0, X1 + 0.1, 3.7, 3.82, Z1, Z1 + 0.75);
  bx(g, toon('#2a3142'), X0, X1 + 0.1, 3.82, 4.7, Z1 + 0.71, Z1 + 0.75, { cast: false });
  const upWins = [[-11.2, 4.7, Z1, 1.1, 1.3, WARM[0]], [-9.6, 4.7, Z1, 1.1, 1.3, PINK[0]]];
  windows(g, upWins);
  cy(g, toon('#9aa3b6'), -10.0, 3.82, Z1 + 0.5, 0.0, 0.0, 4);
  bx(g, toon('#c9ced8'), -9.4, -8.9, 3.82, 4.35, Z1 + 0.18, Z1 + 0.6); // AC
  // laundry pole with towels
  cyl2(g, toon('#9aa3b6'), [-11.8, 4.35, Z1 + 0.5], [-10.4, 4.35, Z1 + 0.5], 0.015, 4);
  [-11.5, -11.1, -10.75].forEach((x, i) => bx(g, toon(['#e8ecf6', '#9fd0ff', '#ffd1e0'][i]), x - 0.14, x + 0.14, 3.75, 4.32, Z1 + 0.47, Z1 + 0.53, { cast: false }));

  /* ---- east face (alley) ---- */
  const ewin = [];
  [[-5.8, 1.7], [-3.0, 1.7], [-5.8, 4.7], [-0.4, 4.7], [2.2, 4.7]].forEach(([z, y]) => ewin.push([X1, y, z, 0.9, 1.1, y > 3 ? pickWin(rng(Math.floor(z * 10 + 5))) : WARM[1]]));
  windows(g, ewin, { ry: Math.PI / 2 });
  // metal stairs
  {
    const st = toon('#7c869b');
    const n = 14, run = 3.6, rise = 3.45;
    for (let i = 0; i < n; i++) {
      const z = 2.7 - (i / n) * run, y = Y0 + ((i + 1) / n) * rise;
      bx(g, st, X1, X1 + 0.8, y - 0.05, y, z - run / n, z, { cast: false });
    }
    cyl2(g, st, [X1 + 0.78, Y0 + 0.9, 2.7], [X1 + 0.78, Y0 + rise + 0.9, 2.7 - run], 0.02, 5);
    cyl2(g, st, [X1 + 0.78, Y0 + 0.0, 2.7], [X1 + 0.78, Y0 + rise, 2.7 - run], 0.04, 5);
    for (let i = 0; i <= 5; i++) { const t = i / 5; cyl2(g, st, [X1 + 0.78, Y0 + t * rise, 2.7 - t * run], [X1 + 0.78, Y0 + t * rise + 0.9, 2.7 - t * run], 0.018, 5); }
    bx(g, st, X1, X1 + 0.85, Y0 + rise - 0.05, Y0 + rise, 2.7 - run - 0.9, 2.7 - run, { cast: false });
    cyl2(g, st, [X1 + 0.83, Y0 + rise + 0.9, 2.7 - run - 0.9], [X1 + 0.83, Y0 + rise + 0.9, 2.7 - run], 0.02, 5);
    bx(g, toon('#5b4030'), X1, X1 + 0.06, Y0 + rise, Y0 + rise + 2.0, 2.7 - run - 0.8, 2.7 - run - 0.0);
    halo(g, X1 + 0.3, Y0 + rise + 1.7, 2.7 - run - 0.2, '#ffd9a0', 1.0, 0.45);
  }
  // meters, pipes, AC on east face
  bx(g, toon('#aab2c2'), X1, X1 + 0.18, 1.0, 1.7, 2.55, 3.0);
  cyl2(g, toon('#7b8498'), [X1 + 0.1, Y0, -6.0], [X1 + 0.1, 6.4, -6.0], 0.04, 6);
  cyl2(g, toon('#7b8498'), [X1 + 0.1, 5.4, -6.4], [X1 + 0.1, 5.4, 3.0], 0.025, 5);
  bx(g, toon('#d6dae3'), X1, X1 + 0.5, 3.9, 4.4, -2.8, -2.2);
  // dripping eave points
  for (let x = X0 + 0.4; x < X1 + 0.3; x += 1.0 + Math.random() * 0.2) drips.push([x, 2.84, Z1 + 0.98, Y0 + 0.01]);
  for (let x = X0 + 0.4; x < X1 + 0.1; x += 1.2) drips.push([x, 3.7, Z1 + 0.75, Y0 + 0.01 + 0.0]);

  /* ---- corner vertical neon ---- */
  const nt = canvasTex(160, 720, (c, w, h) => {
    c.fillStyle = '#10051e'; c.fillRect(0, 0, w, h);
    c.shadowColor = '#ff3fb0'; c.shadowBlur = 22;
    c.strokeStyle = '#6ff3ff'; c.lineWidth = 8; roundRect(c, 10, 10, w - 20, h - 20, 22); c.stroke();
    c.shadowColor = '#ff3fb0';
    [...'居酒屋ほたる'].forEach((ch, i) => T(c, ch, w / 2, 70 + i * 106, 88, '#ff6fc2', { weight: 800, stroke: '#ff2f9f', sw: 6 }));
  });
  const nm = new THREE.MeshBasicMaterial({ map: nt, color: new THREE.Color(1.5, 1.5, 1.5) });
  const sgn = grp(g, X1 + 0.28, 0, Z1 + 0.5);
  bx(sgn, toon('#1a1230'), -0.19, 0.19, 3.15, 5.65, -0.09, 0.09);
  pl(sgn, nm, 0.34, 2.4, 0.0, 4.4, 0.0, 0, 0);
  const nm2 = nm;
  pl(sgn, nm, 0.34, 2.4, 0.19 + 0.003, 4.4, 0.0, Math.PI / 2, 0);
  pl(sgn, nm, 0.34, 2.4, -0.19 - 0.003, 4.4, 0.0, -Math.PI / 2, 0);
  pl(sgn, nm, 0.34, 2.4, 0.0, 4.4, 0.0, Math.PI, 0);
  sgn.children[1].position.z = 0.092; sgn.children[4].position.z = -0.092;
  sgn.children[2].position.set(0.192, 4.4, 0); sgn.children[3].position.set(-0.192, 4.4, 0);
  bx(g, toon('#1a1230'), X1, X1 + 0.28, 3.3, 3.4, Z1 + 0.46, Z1 + 0.54);
  halo(g, X1 + 0.28, 4.4, Z1 + 1.0, '#ff4fb0', 3.6, 0.35);
  plight(g, '#ff4fb0', 8, 7, X1 + 1.0, 4.3, Z1 + 1.4, 'neonPink');
  reg.neonIza = nm;
  return g;
}

/* =========================================================== alley & back yard props */
function alleyProps(parent) {
  const g = grp(parent);
  const crate = (x, z, y, c) => bx(g, toon(c), x - 0.22, x + 0.22, y, y + 0.28, z - 0.17, z + 0.17);
  // beer crates beside the izakaya
  [[-8.1, 3.2], [-8.1, 2.7]].forEach(([x, z]) => { crate(x, z, Y0, '#c4552f'); crate(x, z, Y0 + 0.28, '#d8643a'); });
  [[-8.0, 3.0]].forEach(([x, z]) => { for (let i = 0; i < 4; i++) bx(g, toon(['#3d8a4a', '#8a5a2e'][i % 2]), x - 0.05 + (i % 2) * 0.12 - 0.12, x + 0.04 + (i % 2) * 0.12 - 0.12, Y0 + 0.56, Y0 + 0.86, z - 0.07 + (i >> 1) * 0.16 - 0.08, z + 0.03 + (i >> 1) * 0.16 - 0.08, { cast: false }); });
  // bins / garbage bags
  [[-6.2, -1.0], [-6.0, -4.5]].forEach(([x, z]) => {
    bx(g, toon('#3a4a68'), x - 0.3, x + 0.3, Y0, Y0 + 0.9, z - 0.3, z + 0.3);
    bx(g, toon('#2a3652'), x - 0.32, x + 0.32, Y0 + 0.9, Y0 + 0.96, z - 0.32, z + 0.32);
  });
  [[-6.8, 0.2], [-6.5, 0.45], [-6.9, 0.55]].forEach(([x, z]) => sph(g, toon('#c7d3e6', { e: '#222b3c', ei: 0.5 }), 0.19, x, Y0 + 0.17, z, 1, 0.9, 1));
  // yard garbage cage
  bx(g, toon('#7b8498'), -3.5, -1.5, Y0, Y0 + 1.1, -6.9, -5.4);
  for (let i = 0; i < 6; i++) sph(g, toon('#bcc9dd', { e: '#202a3a', ei: 0.5 }), 0.22, -3.2 + (i % 3) * 0.5, Y0 + 0.2 + Math.floor(i / 3) * 0.3, -6.4 + (i % 2) * 0.3, 1, 0.9, 1);
  // back door light
  bx(g, toon('#2a3142'), -0.5, 0.5, 2.55, 2.62, -4.55, -4.2);
  bx(g, glow('#ffe6b0', 2.2), -0.4, 0.4, 2.5, 2.55, -4.5, -4.25, { cast: false });
  halo(g, 0, 2.4, -4.3, '#ffe0a0', 2.0, 0.35);
  // drink pallets behind the store
  for (let i = 0; i < 6; i++) bx(g, toon(['#3a8fd6', '#d8483f', '#e8b83a'][i % 3]), 1.0 + (i % 3) * 0.55, 1.5 + (i % 3) * 0.55, Y0 + Math.floor(i / 3) * 0.32, Y0 + Math.floor(i / 3) * 0.32 + 0.3, -6.3, -5.8);
  // alley lamp (dim fluorescent) at far end
  bx(g, toon('#2a3142'), -7.2, -6.8, 2.9, 3.0, -7.15, -7.0);
  bx(g, glow('#cfe9ff', 2.2), -7.15, -6.85, 2.84, 2.9, -7.14, -7.02, { cast: false });
  halo(g, -7.0, 2.8, -6.8, '#bfe0ff', 2.0, 0.35);
  return g;
}

export function buildBuildings(parent, drips) {
  const g = grp(parent);
  izakaya(g, drips);
  alleyProps(g);
  return g;
}
