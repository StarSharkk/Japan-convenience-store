import * as THREE from 'three';
import { reg, toon, glow, bx, bc, cy, cyl2, sph, pl, grp, canvasTex, halo, Pool, rng } from './core.js';
import { makeGlass } from './fx.js';
import { posterTex, magAtlas, packWall, hangSignTex, exitSignTex, T, BRAND } from './tex.js';

const lbl = (parent, tex, w, h, x, y, z, ry = 0, k = 1.1, o = {}) =>
  pl(parent, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), side: o.side || THREE.FrontSide }), w, h, x, y, z, ry, 0, { noLine: o.noLine });

export function buildInterior(parent, ST) {
  const g = grp(parent);
  const Y = ST.F;
  const R = rng(42);
  const pool = new Pool();

  const gray = toon('#e3e8f0', { lit: 0.5 });
  const grayD = toon('#8a93a8', { lit: 0.4 });
  const board = toon('#f8f9fc', { lit: 0.65 });
  const yellow = toon('#f6d84a', { lit: 0.9 });
  const teal = toon(BRAND.teal, { lit: 0.7 });
  const orange = toon(BRAND.orange, { lit: 0.7 });
  const frameD = toon('#343c4d', { lit: 0.25 });
  const white = toon('#f7f6f0', { lit: 0.55 });

  const snackPal = ['#ff7aa2', '#ffd24a', '#5ad1ff', '#7ed957', '#ff8a3d', '#b48cff', '#f2f2f2', '#e8493f', '#35c0a8'];
  const cupPal = ['#e8493f', '#ffd24a', '#2f7bd9', '#f08a24', '#3aa35a', '#b04acb'];
  const drinkPal = ['#ffb347', '#7ed957', '#5ad1ff', '#ff6b6b', '#c58a5a', '#f5f5f5', '#a778ff', '#ffe66b', '#2f7bd9', '#ff9ecb'];
  const pick = (a) => a[(R() * a.length) | 0];

  /* ============================================================ gondolas */
  function gondola(x0, x1, cz, sKind, nKind) {
    bx(g, grayD, x0, x1, Y, Y + 0.12, cz - 0.31, cz + 0.31);
    bx(g, gray, x0, x1, Y + 0.12, Y + 1.66, cz - 0.025, cz + 0.025);
    [x0, x1].forEach((x) => bx(g, gray, x - 0.03, x + 0.03, Y, Y + 1.66, cz - 0.31, cz + 0.31));
    for (let x = x0 + 1.1; x < x1 - 0.5; x += 1.1) [-1, 1].forEach((s) => bx(g, gray, x - 0.015, x + 0.015, Y + 0.12, Y + 1.5, cz + s * 0.29 - 0.015, cz + s * 0.29 + 0.015, { cast: false }));
    bx(g, teal, x0, x1, Y + 1.66, Y + 1.74, cz - 0.31, cz + 0.31);
    for (let t = 0; t < 4; t++) {
      const y = Y + 0.3 + t * 0.33;
      bx(g, board, x0, x1, y - 0.012, y + 0.012, cz - 0.3, cz + 0.3, { cast: false });
      [-1, 1].forEach((s) => bx(g, yellow, x0, x1, y - 0.045, y - 0.012, cz + s * 0.3 - 0.008, cz + s * 0.3 + 0.008, { cast: false }));
      [[1, sKind], [-1, nKind]].forEach(([s, kind]) => {
        for (let row = 0; row < 2; row++) {
          const zz = cz + s * (0.2 - row * 0.1);
          for (let x = x0 + 0.1; x < x1 - 0.1; x += kind === 'cup' ? 0.13 : kind === 'can' ? 0.075 : 0.15) {
            if (R() < 0.05) continue;
            const yy = y + 0.012;
            if (kind === 'snack') pool.box(x, yy, zz, 0.12, 0.16 + R() * 0.07, 0.04, pick(snackPal), s > 0 ? 0 : Math.PI);
            else if (kind === 'cup') { const c = pick(cupPal); pool.cyl(x, yy, zz, 0.052, 0.1, c); pool.cyl(x, yy + 0.1, zz, 0.056, 0.012, '#f4f4f0'); }
            else if (kind === 'can') { pool.cyl(x, yy, zz, 0.03, 0.115, pick(drinkPal)); pool.cyl(x, yy + 0.115, zz, 0.027, 0.01, '#d9dde6'); }
            else { pool.box(x, yy, zz, 0.1, 0.06, 0.1, pick(snackPal)); if (R() < 0.6) pool.box(x, yy + 0.06, zz, 0.09, 0.05, 0.09, pick(snackPal)); }
          }
        }
      });
    }
  }
  gondola(-3.9, -0.6, -0.55, 'snack', 'cup');
  gondola(-3.9, -0.6, -2.15, 'sweet', 'can');
  // end cap (east end of the gondolas): promo stand
  [-0.55, -2.15].forEach((cz, i) => {
    bx(g, i ? orange : teal, -0.52, -0.2, Y, Y + 0.9, cz - 0.3, cz + 0.3);
    for (let k = 0; k < 6; k++) pool.box(-0.36, Y + 0.9, cz - 0.22 + (k % 3) * 0.2, 0.2, 0.18 + R() * 0.08, 0.14, pick(snackPal), 0.2 * (k - 2));
  });

  /* ============================================================ magazine rack (faces the window) */
  {
    const z = 1.16;
    bx(g, gray, -3.9, -1.2, Y, Y + 1.15, z - 0.1, z - 0.06);
    bx(g, grayD, -3.9, -1.2, Y, Y + 0.14, z - 0.13, z + 0.16);
    [-3.9, -1.2].forEach((x) => bx(g, gray, x - 0.025, x + 0.025, Y, Y + 1.15, z - 0.13, z + 0.16));
    const pos = [], uv = [], idx = [];
    const tilt = -0.34;
    let n = 0;
    for (let t = 0; t < 4; t++) {
      const y = Y + 0.18 + t * 0.255;
      bx(g, board, -3.9, -1.2, y - 0.01, y + 0.01, z - 0.1, z + 0.14, { cast: false });
      bx(g, yellow, -3.9, -1.2, y - 0.01, y + 0.03, z + 0.13, z + 0.16, { cast: false });
      for (let x = -3.8; x < -1.3; x += 0.205) {
        const tile = (R() * 8) | 0;
        const u0 = (tile % 4) / 4, v0 = 1 - (Math.floor(tile / 4) + 1) / 2, u1 = u0 + 0.25, v1 = v0 + 0.5;
        const w = 0.19, h = 0.25;
        const cx = x + w / 2;
        const ca = Math.cos(tilt), sa = Math.sin(tilt);
        // quad in local xy, rotate about x by tilt, position at (cx, y+0.015, z)
        const P = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]].map(([px, py]) => [cx + px, y + 0.015 + py * ca, z + 0.09 + py * sa]);
        P.forEach((p) => pos.push(p[0], p[1], p[2]));
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, toon('#ffffff', { map: magAtlas(), lit: 0.65, nocache: true, side: THREE.DoubleSide }));
    mesh.userData.noLine = true;
    g.add(mesh);
    lbl(g, hangSignTex('雑誌', '#ff7aa8', '#fff'), 0.7, 0.22, -2.55, Y + 1.3, z + 0.02, 0, 1.0);
  }

  /* ============================================================ drink cooler wall (north) */
  {
    const cx0 = -4.4, cx1 = 0.9, zb = -4.38, zf = -3.55;
    bx(g, toon('#d8eeff', { lit: 1.0 }), cx0, cx1, Y, Y + 2.15, zb - 0.02, zb + 0.02, { cast: false });
    bx(g, frameD, cx0 - 0.04, cx0, Y, Y + 2.3, zb, zf);
    bx(g, frameD, cx1, cx1 + 0.04, Y, Y + 2.3, zb, zf);
    bx(g, frameD, cx0, cx1, Y, Y + 0.12, zb, zf);
    bx(g, frameD, cx0, cx1, Y + 2.15, Y + 2.3, zb, zf);
    const nd = 6, dw = (cx1 - cx0) / nd;
    for (let i = 0; i <= nd; i++) bx(g, frameD, cx0 + i * dw - 0.02, cx0 + i * dw + 0.02, Y + 0.12, Y + 2.15, zf - 0.04, zf);
    for (let i = 0; i < nd; i++) {
      const x = cx0 + (i + 0.5) * dw;
      pl(g, makeGlass(dw, 2.0, 40 + i, { drops: 0, alpha: 0.05, tint: 0xcdeaff }), dw - 0.04, 2.0, x, Y + 1.13, zf - 0.01, 0, 0, { noLine: true });
      bx(g, toon('#c6ced9', { lit: 0.5 }), x + dw * 0.38, x + dw * 0.38 + 0.025, Y + 0.7, Y + 1.5, zf - 0.07, zf - 0.04, { cast: false });
    }
    for (let t = 0; t < 4; t++) {
      const y = Y + 0.42 + t * 0.4;
      bx(g, toon('#e8eef6', { lit: 0.8 }), cx0, cx1, y - 0.012, y + 0.012, zb, zf - 0.05, { cast: false });
      for (let row = 0; row < 2; row++) {
        const zz = zb + 0.22 + row * 0.27;
        for (let x = cx0 + 0.07; x < cx1 - 0.05; x += 0.085) {
          if (R() < 0.05) continue;
          const col = pick(drinkPal);
          const can = R() < 0.25;
          const h = can ? 0.12 : 0.17 + R() * 0.05;
          pool.cyl(x, y + 0.012, zz, can ? 0.032 : 0.029, h, col);
          pool.cyl(x, y + 0.012 + h, zz, can ? 0.028 : 0.014, can ? 0.01 : 0.03, can ? '#d9dde6' : R() < 0.5 ? '#f4f4f4' : pick(drinkPal));
        }
      }
    }
    const hb = canvasTex(1024, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#1f7fe0'); gr.addColorStop(1, '#19b6a6');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      T(c, 'ひえひえドリンク   COLD DRINKS   お茶・ジュース・コーヒー', w / 2, h / 2 + 3, 62, '#fff', { weight: 800 });
    });
    lbl(g, hb, cx1 - cx0, 0.24, (cx0 + cx1) / 2, Y + 2.42, zf + 0.012, 0, 1.2);
    bx(g, frameD, cx0, cx1, Y + 2.3, Y + 2.56, zb, zf + 0.01);
  }

  /* ============================================================ bento / onigiri multideck (north-east) */
  {
    const bx0 = 1.4, bx1 = 4.3, zb = -4.38, zf = -3.6;
    bx(g, toon('#e9eef5', { lit: 0.6 }), bx0, bx1, Y, Y + 0.36, zb, zf);
    bx(g, toon('#dfeaf6', { lit: 1.0 }), bx0, bx1, Y + 0.36, Y + 1.95, zb, zb + 0.03, { cast: false });
    [bx0, bx1].forEach((x) => bx(g, gray, x - 0.03, x + 0.03, Y, Y + 2.06, zb, zf + 0.04));
    bx(g, orange, bx0, bx1, Y + 1.95, Y + 2.1, zb, zf + 0.06);
    bx(g, teal, bx0, bx1, Y + 0.2, Y + 0.3, zf, zf + 0.04, { cast: false });
    const kinds = ['bento', 'onigiri', 'sand', 'bento'];
    for (let t = 0; t < 4; t++) {
      const y = Y + 0.5 + t * 0.36;
      bx(g, board, bx0, bx1, y - 0.012, y + 0.012, zb, zf, { cast: false });
      bx(g, yellow, bx0, bx1, y - 0.04, y - 0.012, zf - 0.008, zf + 0.008, { cast: false });
      const k = kinds[t];
      for (let row = 0; row < 3; row++) {
        const zz = zb + 0.15 + row * 0.2;
        const step = k === 'onigiri' ? 0.125 : 0.23;
        for (let x = bx0 + 0.12; x < bx1 - 0.1; x += step) {
          if (R() < 0.06) continue;
          if (k === 'bento') { pool.box(x, y + 0.012, zz, 0.2, 0.05, 0.15, pick(['#d8483f', '#3aa35a', '#e8a33a', '#7a4acb', '#f2f0e8'])); pool.box(x, y + 0.062, zz, 0.18, 0.02, 0.13, '#f2f0e8'); }
          else if (k === 'onigiri') { pool.cone(x, y + 0.012, zz, 0.07, 0.1, '#f6f6f0', R() * 0.5); pool.box(x, y + 0.012, zz + 0.012, 0.06, 0.04, 0.03, '#1d2b24'); }
          else { pool.box(x, y + 0.012, zz, 0.18, 0.045, 0.11, pick(['#f6e7b4', '#f2c9a8', '#d7ecc5'])); pool.box(x, y + 0.057, zz, 0.18, 0.015, 0.1, '#f8f8f0'); }
        }
      }
    }
    const lb = canvasTex(1024, 128, (c, w, h) => {
      c.fillStyle = BRAND.orange; c.fillRect(0, 0, w, h);
      T(c, 'おにぎり ・ お弁当 ・ サンドイッチ', w / 2, h / 2 + 3, 66, '#fff', { weight: 800 });
    });
    lbl(g, lb, bx1 - bx0, 0.15, (bx0 + bx1) / 2, Y + 2.03, zf + 0.065, 0, 1.2);
  }

  /* ============================================================ register counter, oden, coffee */
  {
    const cz0 = -2.1, cz1 = -1.2, cx0 = 0.9, cx1 = 3.9;
    bx(g, white, cx0, cx1, Y, Y + 0.92, cz0, cz1);
    bx(g, orange, cx0, cx1, Y + 0.12, Y + 0.3, cz1, cz1 + 0.02, { cast: false });
    bx(g, toon('#c9a275', { lit: 0.7 }), cx0 - 0.05, cx1 + 0.05, Y + 0.92, Y + 0.97, cz0 - 0.03, cz1 + 0.04);
    const top = Y + 0.97;
    // coffee machine
    bx(g, toon('#b22a2a', { lit: 0.5 }), 1.0, 1.52, top, top + 0.74, -2.05, -1.62);
    bx(g, toon('#2b2f3c', { lit: 0.3 }), 1.04, 1.48, top + 0.32, top + 0.62, -1.62, -1.6);
    bx(g, glow('#8ff0ff', 1.8), 1.12, 1.4, top + 0.5, top + 0.58, -1.6, -1.59, { cast: false });
    bx(g, toon('#2b2f3c', { lit: 0.3 }), 1.14, 1.38, top + 0.12, top + 0.24, -1.7, -1.62);
    cy(g, white, 1.26, top, -1.45, 0.045, 0.1, 10); cy(g, white, 1.4, top, -1.45, 0.045, 0.1, 10);
    // POS
    bx(g, toon('#2a3040', { lit: 0.35 }), 1.62, 2.0, top, top + 0.06, -1.98, -1.64);
    bx(g, toon('#2a3040', { lit: 0.35 }), 1.72, 1.9, top + 0.06, top + 0.3, -1.8, -1.74);
    bx(g, glow('#9fd9ff', 1.5), 1.62, 2.0, top + 0.16, top + 0.28, -1.7, -1.66, { cast: false });
    bx(g, toon('#d9dde6', { lit: 0.5 }), 1.64, 1.98, top + 0.06, top + 0.08, -1.55, -1.36, { cast: false });
    // hot snack case
    bx(g, toon('#c9ced8', { lit: 0.5 }), 2.2, 2.78, top, top + 0.06, -2.04, -1.55);
    bx(g, glow('#ffb25a', 1.1), 2.22, 2.76, top + 0.06, top + 0.5, -2.0, -1.58, { cast: false });
    for (let i = 0; i < 6; i++) pool.cyl(2.3 + (i % 3) * 0.16, top + 0.08 + Math.floor(i / 3) * 0.2, -1.78, 0.04, 0.08, '#c4752a');
    pl(g, makeGlass(0.58, 0.46, 7, { drops: 0, alpha: 0.05 }), 0.58, 0.46, 2.49, top + 0.29, -1.54, 0, 0, { noLine: true });
    bx(g, toon('#2a3040', { lit: 0.3 }), 2.2, 2.78, top + 0.5, top + 0.54, -2.04, -1.54);
    // oden warmer
    bx(g, toon('#c4cad6', { lit: 0.55 }), 2.95, 3.8, top, top + 0.22, -2.02, -1.42);
    bx(g, glow('#f0b050', 1.0), 3.0, 3.75, top + 0.22, top + 0.225, -1.98, -1.46, { cast: false });
    for (let i = 0; i < 10; i++) {
      const x = 3.06 + (i % 5) * 0.145, z = -1.88 + Math.floor(i / 5) * 0.22;
      const t = i % 4;
      if (t === 0) pool.cyl(x, top + 0.225, z, 0.045, 0.04, '#f0e2c4');
      else if (t === 1) pool.ball(x, top + 0.25, z, 0.04, '#f6f2e4', 1.2);
      else if (t === 2) pool.cone(x, top + 0.225, z, 0.05, 0.05, '#5a4a40');
      else pool.cyl(x, top + 0.225, z, 0.028, 0.055, '#c99a60');
    }
    cy(g, toon('#c4cad6'), 3.9, top, -1.7, 0.02, 0.3, 6);
    lbl(g, hangSignTex('おでん', '#c2181c', '#fff'), 0.5, 0.16, 3.4, top + 0.32, -1.43, 0, 1.1);
    // baskets of impulse buys
    for (let i = 0; i < 4; i++) pool.box(1.65 + i * 0.12, top + 0.075, -1.4, 0.1, 0.05, 0.08, pick(snackPal));
    // register hanging sign
    lbl(g, hangSignTex('レジ', '#19b6a6', '#fff'), 0.6, 0.19, 2.4, Y + 2.62, -1.2, 0, 1.0, { side: THREE.DoubleSide });
    cyl2(g, toon('#8c95a8'), [2.15, ST.CEIL, -1.2], [2.15, Y + 2.72, -1.2], 0.01, 4);
    cyl2(g, toon('#8c95a8'), [2.65, ST.CEIL, -1.2], [2.65, Y + 2.72, -1.2], 0.01, 4);
  }

  /* ---- cigarette wall behind counter + menu lightbox ---- */
  {
    bx(g, toon('#4a5164', { lit: 0.35 }), 1.2, 4.2, Y, Y + 2.0, -2.78, -2.5);
    pl(g, new THREE.MeshBasicMaterial({ map: packWall(), color: new THREE.Color(0.95, 0.95, 0.95) }), 2.9, 1.5, 2.7, Y + 1.15, -2.495, 0, 0);
    const menu = canvasTex(1536, 220, (c, w, h) => {
      c.fillStyle = '#161e30'; c.fillRect(0, 0, w, h);
      T(c, '◆ ホットスナック  唐揚げ¥180   ◆ おでん  大根¥90 たまご¥90   ◆ コーヒー  R¥110', w / 2, h / 2, 62, '#ffd27a', { weight: 800 });
    });
    lbl(g, menu, 3.0, 0.3, 2.7, Y + 2.05, -2.495, 0, 1.0);
  }

  /* ============================================================ chest freezer (ice cream) */
  {
    bx(g, toon('#f3f6fb', { lit: 0.55 }), -5.3, -4.25, Y, Y + 0.82, -0.7, 0.8);
    bx(g, toon('#4aa8f0', { lit: 0.8 }), -5.3, -4.25, Y + 0.3, Y + 0.42, -0.7, 0.8, { cast: false });
    bx(g, toon('#e6f4ff', { lit: 0.9 }), -5.25, -4.3, Y + 0.7, Y + 0.76, -0.65, 0.75, { cast: false });
    for (let i = 0; i < 10; i++) pool.box(-5.15 + (i % 2) * 0.45, Y + 0.76, -0.55 + Math.floor(i / 2) * 0.28, 0.2, 0.08, 0.18, pick(snackPal));
    pl(g, makeGlass(1.0, 1.4, 3, { drops: 0, alpha: 0.17, tint: 0xd8f1ff }), 1.0, 1.4, -4.78, Y + 0.84, 0.05, 0, -Math.PI / 2, { noLine: true });
    lbl(g, hangSignTex('アイス', '#4aa8f0', '#fff'), 0.7, 0.22, -4.26, Y + 0.6, 0.05, Math.PI / 2, 1.0);
  }

  /* ============================================================ lockers, back door, ATM, baskets */
  {
    const lk = toon('#a7b0c2', { lit: 0.45 });
    for (let i = 0; i < 4; i++) {
      const z = -2.45 + i * 0.37;
      bx(g, lk, -5.36, -4.92, Y, Y + 1.7, z, z + 0.35);
      bx(g, toon('#7b8599', { lit: 0.3 }), -4.93, -4.91, Y + 1.2, Y + 1.5, z + 0.04, z + 0.31, { cast: false });
      bx(g, toon('#7b8599', { lit: 0.3 }), -4.93, -4.91, Y + 0.3, Y + 0.34, z + 0.04, z + 0.31, { cast: false });
      bx(g, toon('#4c5468', { lit: 0.3 }), -4.92, -4.9, Y + 0.95, Y + 1.05, z + 0.28, z + 0.32, { cast: false });
    }
    bx(g, toon('#a7b0c2', { lit: 0.3 }), -5.36, -4.92, Y + 1.7, Y + 1.76, -2.45, -0.97);
    // back door inside face
    bx(g, toon('#d9dde6', { lit: 0.5 }), -5.4, -5.34, Y, Y + 2.08, -3.8, -2.9);
    bx(g, toon('#8a93a8', { lit: 0.4 }), -5.34, -5.32, Y + 1.0, Y + 1.5, -3.55, -3.15, { cast: false });
    bx(g, glow('#bfe6ff', 0.9), -5.335, -5.325, Y + 1.5, Y + 1.8, -3.55, -3.15, { cast: false });
    lbl(g, canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#c2181c'; c.fillRect(0, 0, w, h); T(c, '関係者以外', w / 2, 44, 40, '#fff'); T(c, '立入禁止', w / 2, 92, 40, '#fff'); }), 0.34, 0.17, -5.33, Y + 2.2, -3.35, Math.PI / 2, 1.0);
    lbl(g, exitSignTex(), 0.44, 0.22, -5.33, Y + 2.52, -3.35, Math.PI / 2, 1.5);
    // ATM
    bx(g, toon('#2d3a56', { lit: 0.45 }), 3.75, 4.3, Y, Y + 1.5, 0.35, 0.95);
    bx(g, glow('#7ecbff', 1.4), 3.74, 3.76, Y + 1.05, Y + 1.35, 0.45, 0.85, { cast: false });
    bx(g, toon('#f2c230', { lit: 0.7 }), 3.74, 3.78, Y + 0.85, Y + 0.95, 0.5, 0.8, { cast: false });
    // baskets
    for (let i = 0; i < 4; i++) bx(g, toon('#d8483f', { lit: 0.6 }), 3.2, 3.6, Y + 0.02 + i * 0.1, Y + 0.14 + i * 0.1, 0.9, 1.2, { cast: false });
  }

  /* ============================================================ hanging category signs */
  [['お菓子', '#ff7aa2', -2.3, -0.55], ['カップ麺', '#f08a24', -2.3, -2.15]].forEach(([t, c, x, z]) => {
    lbl(g, hangSignTex(t, c, '#fff'), 1.0, 0.31, x, Y + 2.42, z, 0, 1.15, { side: THREE.DoubleSide });
    cyl2(g, toon('#8c95a8'), [x - 0.4, ST.CEIL, z], [x - 0.4, Y + 2.57, z], 0.01, 4);
    cyl2(g, toon('#8c95a8'), [x + 0.4, ST.CEIL, z], [x + 0.4, Y + 2.57, z], 0.01, 4);
  });

  /* ============================================================ posters on interior walls */
  [0, 2, 3, 1].forEach((p, i) => lbl(g, posterTex(p), 0.52, 0.73, -3.7 + i * 1.3, Y + 2.78, -4.35, 0, 1.0));
  [4, 6].forEach((p, i) => lbl(g, posterTex(p), 0.5, 0.7, 2.1 + i * 1.5, Y + 2.78 - 0.0, -4.35, 0, 1.0));
  lbl(g, posterTex(5), 0.5, 0.7, 4.36, Y + 1.7, -3.3, -Math.PI / 2, 1.0);
  lbl(g, posterTex(0), 0.6, 0.85, 4.36, Y + 1.5, -2.7, -Math.PI / 2, 1.0);
  lbl(g, posterTex(3), 0.6, 0.85, -5.35, Y + 1.7, 0.0, Math.PI / 2, 1.0);

  /* ============================================================ ceiling light fixtures */
  const fl = glow('#fff6e3', 1.8);
  [-3.4, -1.5, 0.45].forEach((z) => [-4.2, -1.8, 0.7, 3.1].forEach((x) => {
    bx(g, toon('#e9eaee', { lit: 0.5 }), x - 0.62, x + 0.62, ST.CEIL - 0.04, ST.CEIL, z - 0.11, z + 0.11, { cast: false });
    bx(g, fl, x - 0.58, x + 0.58, ST.CEIL - 0.055, ST.CEIL - 0.04, z - 0.08, z + 0.08, { cast: false });
  }));

  pool.build(g, toon('#ffffff', { lit: 0.55, nocache: true }), { noLine: true });
  // oden steam
  const steamTex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  }, { aniso: 1 });
  const steam = [];
  for (let i = 0; i < 7; i++) {
    const sm = new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const s = new THREE.Sprite(sm);
    s.userData.noLine = true;
    s.userData.ph = i / 7;
    s.userData.ox = (R() - 0.5) * 0.5;
    g.add(s);
    steam.push(s);
  }
  reg.updaters.push((t) => {
    steam.forEach((s) => {
      const k = (t * 0.28 + s.userData.ph) % 1;
      s.position.set(3.4 + s.userData.ox + Math.sin(k * 6 + s.userData.ph * 9) * 0.04, Y + 1.25 + k * 0.7, -1.72);
      const sc = 0.12 + k * 0.28;
      s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(k * Math.PI) * 0.35;
    });
  });
  return g;
}
