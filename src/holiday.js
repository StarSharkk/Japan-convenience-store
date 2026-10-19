import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, setCat, rng, roundRect, FONT } from './core.js';
import { T } from './tex.js';
import { nobori, cat as makeCat } from './street.js';
import { holidayAtmosphereConfig, HOLIDAY_IDS } from './holidayConfig.js';

/* ====================================================================================================
   Holiday props. Which props a holiday uses is listed in holidayConfig.js (decorations / windowProps /
   signProps / treeLights); this file is the library of builders those names refer to.
   Everything is built once, lazily, the first time the holiday is chosen; afterwards sets are only
   scaled in / out and hidden. World-anchored sets (string lights, bunting ...) simply fade by visibility.

   Store geometry used here: front wall z = 1.5, awning edge z = 2.45 (skirt bottom y = 2.58),
   door x = 1.3..3.1, apron z = 1.5..2.75, panes centred at x = -4.5 / -2.5 / -0.55 / 3.8, fascia z = 1.5..1.7 (y 3.08..4.28).
   Izakaya: front z = 4.3, door x = -10.78..-9.52, front eave edge z = 5.35 (y 2.84), alley wall x = -8.5.
   Lamp poles: L1 (7.0, 2.6) L2 (-8.3, 6.15), pylon (-5.0, 6.0).
   ==================================================================================================== */

const Y0 = 0.15;
export const HOLIDAYS = HOLIDAY_IDS;

/* ---------------------------------------------------------------- shared twinkling bulb material */
const BULB_U = { uTime: { value: 0 }, uK: { value: 1 }, uTw: { value: 1 } };
const bulbMat = new THREE.ShaderMaterial({
  uniforms: BULB_U,
  vertexShader: /* glsl */ `
    varying vec3 vCol; varying float vPh;
    void main(){
      #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
      #else
        vCol = vec3(1.0);
      #endif
      vPh = float(gl_InstanceID);
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uK; uniform float uTw; varying vec3 vCol; varying float vPh;
    void main(){ float tw = 1.0 - uTw * 0.32 * (0.5 - 0.5 * sin(uTime * 3.2 + vPh * 1.9)); gl_FragColor = vec4(vCol * tw * uK * 2.4, 1.0); }`,
});

function bulbs(parent, pts, palette, r = 0.035) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), bulbMat, pts.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  pts.forEach((p, i) => {
    m.makeTranslation(p[0], p[1], p[2]);
    im.setMatrixAt(i, m);
    im.setColorAt(i, c.set(palette[i % palette.length]));
  });
  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  im.userData.noLine = true;
  im.frustumCulled = false;
  parent.add(im);
  return im;
}
const swag = (x0, x1, y, z, step, sag) => {
  const out = [];
  const n = Math.round((x1 - x0) / step);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (i / n) * (x1 - x0);
    out.push([x, y - sag * Math.sin(Math.PI * (((x - x0) % 1.2) / 1.2)), z]);
  }
  return out;
};
const line3 = (a, b, n, sag = 0) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; });

/* ---------------------------------------------------------------- text decals */
const decal = (w, h, draw) => canvasTex(w, h, (g, ww, hh) => { g.clearRect(0, 0, ww, hh); draw(g, ww, hh); }, { aniso: 8 });
const decalMat = (tex, k = 1) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(k, k, k) });
const outlined = (g, s, x, y, size, fill, stroke, weight = 900) => T(g, s, x, y, size, fill, { weight, stroke, sw: size * 0.16 });

function snowflake(g, x, y, r, col) {
  g.strokeStyle = col; g.lineWidth = r * 0.12; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke();
    const bx_ = x + Math.cos(a) * r * 0.6, by_ = y + Math.sin(a) * r * 0.6;
    [-0.5, 0.5].forEach((d) => { g.beginPath(); g.moveTo(bx_, by_); g.lineTo(bx_ + Math.cos(a + d) * r * 0.3, by_ + Math.sin(a + d) * r * 0.3); g.stroke(); });
  }
}
let _petalTex;
const petalTex = () => _petalTex || (_petalTex = decal(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
  grd.addColorStop(0, '#fff3f7'); grd.addColorStop(0.7, '#ffc4d6'); grd.addColorStop(1, '#f28fb0');
  g.fillStyle = grd;
  for (let i = 0; i < 5; i++) { g.save(); g.translate(64, 64); g.rotate((i * 2 * Math.PI) / 5); g.beginPath(); g.ellipse(0, -28, 20, 30, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#e8587f'; g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill();
}));

/** A-frame chalk board with big, readable holiday text */
function board(set, x, z, ry, title, lines, accent, titleCol = '#ffffff') {
  const a = set.pivot(x, Y0, z, ry);
  const wood = toon('#4b3322', { lit: 0.2 });
  bx(a, wood, -0.3, -0.25, 0, 1.0, -0.15, 0.15); bx(a, wood, 0.25, 0.3, 0, 1.0, -0.15, 0.15);
  bx(a, wood, -0.3, 0.3, 0.96, 1.02, -0.06, 0.06);
  const t = canvasTex(320, 480, (g, w, h) => {
    g.fillStyle = '#18211e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
    T(g, title, w / 2, 70, title.length > 8 ? 36 : 46, titleCol, { weight: 900 });
    lines.forEach((l, i) => T(g, l, w / 2, 160 + i * 78, 34, i % 2 ? accent : '#f3efe0', { weight: 800 }));
  });
  pl(a, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.85, 0.85, 0.82) }), 0.52, 0.78, 0, 0.55, 0.07, 0, 0);
  return a;
}

/** helical garland around a pole (tube + bulbs) */
function garland(set, x, z, y0, y1, palette, green = '#1c5c3a', turns = 5, r = 0.1) {
  const P = set.pivot(x, Y0, z);
  const pts = [], bl = [];
  const n = 70;
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * 2 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + t * (y1 - y0), Math.sin(a) * r)); }
  P.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.024, 6), toon(green, { e: '#061a10', ei: 0.6 })));
  for (let i = 0; i < 36; i++) { const t = i / 35, a = t * turns * 2 * Math.PI + 0.2; bl.push([Math.cos(a) * (r + 0.03), y0 + t * (y1 - y0), Math.sin(a) * (r + 0.03)]); }
  bulbs(P, bl, palette, 0.03);
  return P;
}

/** instanced pink blossoms along a curve (garlands, boughs) */
function blossoms(parent, curve, count, spread, size, seed) {
  const R2 = rng(seed);
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: petalTex(), transparent: true, depthWrite: false, alphaTest: 0.05, color: new THREE.Color(0.9, 0.85, 0.88), side: THREE.DoubleSide }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    curve.getPoint(R2(), p);
    p.add(new THREE.Vector3((R2() - 0.5) * spread, (R2() - 0.5) * spread, (R2() - 0.5) * spread));
    e.set(R2() * 3, R2() * 3, R2() * 6.28); q.setFromEuler(e);
    const s = size * (0.7 + R2() * 0.6);
    m4.compose(p, q, sc.set(s, s, 1));
    im.setMatrixAt(i, m4);
  }
  im.userData.noLine = true; im.frustumCulled = false;
  parent.add(im);
  return im;
}

const lanternOf = (parent, x, y, z, redOrColor, txt, s = 1, dark = false) => {
  const col = typeof redOrColor === 'string' ? redOrColor : redOrColor ? '#ff3b2a' : '#fff2d0';
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 14, 10), glow(col, 1.7, { cat: 'deco' }));
  l.scale.set(0.9, 1.15, 0.9); l.position.set(x, y, z); parent.add(l);
  cy(parent, toon('#15110e'), x, y + 0.17 * s, z, 0.07 * s, 0.05, 8); cy(parent, toon('#15110e'), x, y - 0.2 * s, z, 0.07 * s, 0.04, 8);
  if (txt) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * s, 0.22 * s), new THREE.MeshBasicMaterial({ map: decal(128, 128, (g) => T(g, txt, 64, 64, 84, dark ? '#16110e' : '#fff6e0', { weight: 900 })), transparent: true, depthWrite: false }));
    f.position.set(x, y, z + 0.16 * s); f.userData.noLine = true; parent.add(f);
  }
  halo(parent, x, y, z + 0.05, col, 1.0 * s, 0.4);
  return l;
};

/* ================================================================================================== */
export function createHolidays(parent) {
  const root = grp(parent);
  const sets = {};
  const swingers = []; // { obj, amp, speed, phase, axis }
  const camRef = { cam: null };

  const mkSet = () => {
    const set = {
      pivots: [], built: false,
      pivot(x, y, z, ry = 0) {
        const p = grp(root, x, y, z, ry);
        p.userData.flat = x === 0 && y === 0 && z === 0; // world-anchored sets just fade
        p.scale.setScalar(0.001);
        p.visible = false;
        set.pivots.push(p);
        return p;
      },
    };
    return set;
  };
  const swing = (obj, amp, speed, phase = 0, axis = 'z') => swingers.push({ obj, amp, speed, phase, axis });
  reg.updaters.push((t) => swingers.forEach((s) => { if (s.obj.parent && s.obj.parent.visible) s.obj.rotation[s.axis] = Math.sin(t * s.speed + s.phase) * s.amp; }));

  /* ============================================================================ shared pieces */
  const awningBulbs = (set, palette, sag = 0.09) => {
    const S = set.pivot(0, 0, 0);
    bulbs(S, swag(-5.35, 5.3, 2.56, 2.5, 0.34, sag), palette, 0.032);
    const east = [];
    for (let z = -4.3; z <= 2.3; z += 0.34) east.push([5.5, 2.56 - sag * Math.sin(Math.PI * (((z + 4.3) % 1.2) / 1.2)), z]);
    bulbs(S, east, palette, 0.03);
    return S;
  };
  const railBulbs = (set, palette) => {
    const S = set.pivot(0, 0, 0);
    const a = [], b = [];
    for (let x = 1.0; x <= 4.9; x += 0.3) a.push([x, Y0 + 0.9, 6.2]);
    for (let z = -0.4; z <= 3.9; z += 0.3) b.push([7.33, Y0 + 0.9, z]);
    bulbs(S, a.concat(b), palette, 0.028);
  };
  const izakayaEaveBulbs = (set, palette) => {
    const S = set.pivot(0, 0, 0);
    bulbs(S, swag(-12.1, -8.2, 2.8, 5.36, 0.3, 0.07), palette, 0.03);
    return S;
  };
  const fasciaGarland = (set, palette, green) => {
    const S = set.pivot(0, 0, 0);
    const pts = [];
    for (let i = 0; i <= 60; i++) { const x = -5.4 + (i / 60) * 9.8; pts.push(new THREE.Vector3(x, 3.04 - 0.09 * Math.abs(Math.sin(((x + 5.4) / 1.6) * Math.PI)), 1.74)); }
    S.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.03, 6), toon(green, { e: '#061a10', ei: 0.6 })));
    bulbs(S, pts.filter((_, i) => i % 3 === 0).map((p) => [p.x, p.y - 0.03, p.z + 0.03]), palette, 0.03);
    for (let x = -4.6; x < 4.4; x += 1.6) { const y = 3.04 - 0.09 * Math.abs(Math.sin(((x + 5.4) / 1.6) * Math.PI)); bx(S, toon('#d4363f'), x - 0.12, x - 0.02, y - 0.16, y - 0.04, 1.74, 1.78); bx(S, toon('#d4363f'), x + 0.02, x + 0.12, y - 0.16, y - 0.04, 1.74, 1.78); sph(S, toon('#b52a32'), 0.05, x, y - 0.08, 1.77); }
    return S;
  };

  const window1 = (set, x, w, h, tex, k = 1.0, y = 1.7) => { const p = set.pivot(x, y, 1.56); pl(p, decalMat(tex, k), w, h, 0, 0, 0, 0, 0, { noLine: true }); return p; };

  const kadomatsu = (set, x, z, s = 1) => {
    const K = set.pivot(x, Y0, z);
    const inner = grp(K); inner.scale.setScalar(s);
    cy(inner, toon('#c9b172', { lit: 0.15 }), 0, 0, 0, 0.17, 0.3, 12);
    [0.07, 0.17, 0.27].forEach((y) => cy(inner, toon('#8a2a2a'), 0, y, 0, 0.175, 0.025, 12, { cast: false }));
    [[0, 0.95, 0.065], [0.1, 0.7, 0.06], [-0.1, 0.5, 0.055]].forEach(([dx, h, r], i) => {
      cy(inner, toon('#4c8a45', { lit: 0.12 }), dx, 0.3, i * 0.02 - 0.01, r, h, 10);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.02, 10), toon('#e8d9a0'));
      cap.position.set(dx, 0.3 + h + 0.005, i * 0.02 - 0.01); cap.rotation.z = 0.55; inner.add(cap);
    });
    const pine = toon('#2a5c3a', { e: '#0a2a18', ei: 0.6, nosnow: true });
    [[-0.18, 0.5, 0.1, 0.2], [0.17, 0.46, 0.05, -0.2], [0, 0.4, 0.17, 0.0]].forEach(([dx, y, dz, rz]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), pine); c.position.set(dx, y, dz); c.rotation.z = rz; c.castShadow = true; inner.add(c); });
    sph(inner, toon('#d4363f'), 0.03, 0.12, 0.9, 0.08); sph(inner, toon('#ffffff'), 0.03, -0.12, 0.8, 0.08); sph(inner, toon('#e87a1a'), 0.045, 0.0, 0.34, 0.2);
    return K;
  };
  const shimenawa = (set, x, y, z, w = 1.9, s = 1) => {
    const D = set.pivot(x, y, z);
    const inner = grp(D); inner.scale.setScalar(s);
    const half = w / 2;
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(new THREE.Vector3(-half + (i / 24) * w, -0.12 * Math.sin((i / 24) * Math.PI), 0));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 8), toon('#d8c58c', { lit: 0.25 }));
    rope.castShadow = true; inner.add(rope);
    for (let i = 0; i < 24; i++) { const xx = -half + 0.03 + i * (w / 24); const yy = -0.12 * Math.sin(((xx + half) / w) * Math.PI); bx(inner, toon('#b8a468', { lit: 0.2 }), xx, xx + 0.025, yy - 0.052, yy + 0.052, -0.052, 0.052, { cast: false }); }
    const shide = decal(64, 160, (g, ww, h) => { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(ww * 0.5, 0); g.lineTo(ww * 0.9, h * 0.25); g.lineTo(ww * 0.2, h * 0.45); g.lineTo(ww * 0.85, h * 0.7); g.lineTo(ww * 0.35, h); g.lineTo(ww * 0.1, h * 0.7); g.lineTo(ww * 0.65, h * 0.45); g.lineTo(ww * 0.1, h * 0.25); g.closePath(); g.fill(); });
    [-0.37, -0.13, 0.13, 0.37].forEach((f) => { const xx = f * w; pl(inner, decalMat(shide, 0.95), 0.16, 0.38, xx, -0.12 * Math.sin(((xx + half) / w) * Math.PI) - 0.26, 0.02, 0, 0, { noLine: true }); });
    sph(inner, toon('#e87a1a', { lit: 0.2 }), 0.075, 0, 0.08, 0.02);
    bx(inner, toon('#d4363f'), -0.12, -0.03, -0.2, -0.13, 0.0, 0.03, { cast: false }); bx(inner, toon('#ffffff'), 0.03, 0.12, -0.2, -0.13, 0.0, 0.03, { cast: false });
    return D;
  };
  const stripeMat = (rx, a = '#c4262e', b = '#f6f3ea') => {
    const t0 = canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, h); } g.fillStyle = '#d8b04a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); }, { repeat: true });
    t0.repeat.set(rx, 1); t0.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t0, color: new THREE.Color(0.8, 0.78, 0.76), side: THREE.DoubleSide });
  };
  const festoon = (set, a, b, sag, n, pink) => {
    const F = set.pivot(0, 0, 0);
    const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2), new THREE.Vector3(...b)]);
    F.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(cv, 20, 0.012, 4), toon('#2a2230')), { userData: { noLine: true } }));
    for (let i = 1; i <= n; i++) { const p = cv.getPoint(i / (n + 1)); lanternOf(F, p.x, p.y - 0.18, p.z, pink ? '#ff9fc0' : i % 2 === 1, pink ? null : '祭', 0.7); }
    return F;
  };
  const pumpkin = (set, x, z, s) => {
    const P = set.pivot(x, Y0, z, (Math.random() - 0.5) * 0.3);
    const body = toon('#e0701a', { lit: 0.25, e: '#3a1400', ei: 0.5 });
    sph(P, body, 0.34 * s, 0, 0.27 * s, 0, 1.0, 0.82, 0.95);
    sph(P, toon('#c85f12', { lit: 0.2 }), 0.26 * s, -0.19 * s, 0.26 * s, 0.03 * s, 0.7, 0.8, 0.8);
    sph(P, toon('#c85f12', { lit: 0.2 }), 0.26 * s, 0.19 * s, 0.26 * s, 0.03 * s, 0.7, 0.8, 0.8);
    cy(P, toon('#3d6a2a'), 0.0, 0.5 * s, 0, 0.05 * s, 0.13 * s, 7);
    const face = decal(256, 256, (g) => {
      g.fillStyle = '#ffd24a'; g.shadowColor = '#ff8a1a'; g.shadowBlur = 26;
      const tri = (cx, cy_) => { g.beginPath(); g.moveTo(cx, cy_ - 36); g.lineTo(cx + 34, cy_ + 28); g.lineTo(cx - 34, cy_ + 28); g.closePath(); g.fill(); };
      tri(78, 100); tri(178, 100);
      g.beginPath(); g.moveTo(56, 166); g.quadraticCurveTo(128, 232, 200, 166); g.lineTo(184, 158); g.lineTo(166, 186); g.lineTo(146, 160); g.lineTo(128, 190); g.lineTo(110, 160); g.lineTo(90, 186); g.lineTo(72, 158); g.closePath(); g.fill();
    });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * s, 0.5 * s), new THREE.MeshBasicMaterial({ map: face, transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.4, 1.0) }));
    fp.position.set(0, 0.27 * s, 0.31 * s); fp.userData.noLine = true; P.add(fp);
    halo(P, 0, 0.3 * s, 0.35 * s, '#ff9a2a', 1.3 * s, 0.5);
    return P;
  };
  const gift = (parent, x, z, s, c1, c2) => { bx(parent, toon(c1), x - s / 2, x + s / 2, 0, s * 0.8, z - s / 2, z + s / 2); bx(parent, toon(c2, { lit: 0.1 }), x - 0.015, x + 0.015, 0, s * 0.8 + 0.004, z - s / 2 - 0.002, z + s / 2 + 0.002, { cast: false }); };

  /* ============================================================================ builders */
  const B = {
    /* ---------------------------------------------------------------- CHRISTMAS */
    xmasTree(set) {
      const T0 = set.pivot(-0.55, Y0, 1.95);
      cy(T0, toon('#8c1d1d'), 0, 0, 0, 0.2, 0.22, 12);
      cy(T0, toon('#5a3a22'), 0, 0.2, 0, 0.06, 0.15, 8);
      const leaf = toon('#1e6040', { e: '#082a18', ei: 0.7, nosnow: true });
      [[0.28, 0.58, 0.6], [0.68, 0.47, 0.52], [1.02, 0.36, 0.46], [1.32, 0.25, 0.4]].forEach(([y, r, h]) => cy(T0, leaf, 0, y, 0, r, h, 14, { rt: 0 }));
      sph(T0, glow('#ffd84a', 2.4, { cat: 'deco' }), 0.09, 0, 1.78, 0, 1, 1, 1, { cast: false });
      halo(T0, 0, 1.78, 0, '#ffe08a', 1.1, 0.6);
      const sp = [];
      for (let i = 0; i < 34; i++) { const t = i / 33; const r = 0.58 * (1 - t) + 0.05; const a = t * 15; sp.push([Math.cos(a) * r, 0.36 + t * 1.38, Math.sin(a) * r]); }
      bulbs(T0, sp, ['#ff4d4d', '#ffd24a', '#6ad2ff', '#ffffff', '#7bff9a'], 0.034);
      const bz = [];
      for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7; const r = 0.46 * (1 - t) + 0.08; const a = i * 2.1; bz.push([Math.cos(a) * r, 0.5 + t * 1.0, Math.sin(a) * r]); }
      bulbs(T0, bz, ['#d4363f', '#e8b630', '#3a78d6'], 0.06);
      gift(T0, 0.45, 0.0, 0.3, '#d4363f', '#ffe9a0'); gift(T0, -0.42, 0.02, 0.22, '#2f7bd9', '#ffffff');
    },
    awningLights(set) { awningBulbs(set, ['#fff1c8', '#ff5a5a', '#6ad2ff', '#ffd24a', '#7bff9a']); },
    wreaths(set) {
      const W = set.pivot(3.82, 1.72, 1.55);
      const wm = toon('#1c5c3a', { e: '#082a18', ei: 0.7, nosnow: true });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.065, 8, 24), wm); ring.castShadow = true; W.add(ring);
      for (let i = 0; i < 10; i++) { const a = i * 0.63; sph(W, toon('#d4363f'), 0.028, Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.06, 1, 1, 1, { cast: false }); }
      bx(W, toon('#d4363f'), -0.1, -0.02, -0.34, -0.2, 0.04, 0.09); bx(W, toon('#d4363f'), 0.02, 0.1, -0.34, -0.2, 0.04, 0.09); sph(W, toon('#b52a32'), 0.045, 0, -0.3, 0.07);
      bulbs(W, Array.from({ length: 8 }, (_, i) => [Math.cos(i * 0.785) * 0.27, Math.sin(i * 0.785) * 0.27, 0.085]), ['#fff1c8', '#ffd24a'], 0.022);
    },
    lampGarlands(set) { garland(set, 7.0, 2.6, 0.9, 4.4, ['#fff1c8', '#ff5a5a', '#ffd24a']); garland(set, -8.3, 6.15, 0.9, 4.4, ['#fff1c8', '#6ad2ff', '#ffd24a']); },
    railLights(set) { railBulbs(set, ['#fff1c8', '#ffd24a', '#ff8a8a']); },
    gifts(set) {
      const G = set.pivot(7.0, Y0, 3.9);
      gift(G, 0, 0, 0.34, '#d4363f', '#ffe9a0'); gift(G, 0.3, 0.1, 0.24, '#2f7bd9', '#ffffff'); gift(G, -0.05, 0.3, 0.2, '#2fa56a', '#ffd24a');
    },
    snowman(set) {
      const S = set.pivot(-2.45, Y0, 2.15);
      const wht = toon('#f4f8ff', { lit: 0.2, nosnow: true });
      sph(S, wht, 0.3, 0, 0.3, 0); sph(S, wht, 0.22, 0, 0.72, 0); sph(S, wht, 0.16, 0, 1.02, 0);
      cy(S, toon('#1a1a22'), 0, 1.14, 0, 0.12, 0.2, 12); cy(S, toon('#1a1a22'), 0, 1.13, 0, 0.19, 0.025, 12);
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 6), toon('#ff7a1a')); cr.rotation.x = Math.PI / 2; cr.position.set(0, 1.02, 0.2); S.add(cr);
      [-0.06, 0.06].forEach((dx) => sph(S, toon('#111'), 0.016, dx, 1.07, 0.14));
      for (let i = 0; i < 3; i++) sph(S, toon('#111'), 0.018, 0, 0.8 - i * 0.12, 0.21);
      cyl2(S, toon('#5a3a22'), [-0.2, 0.78, 0], [-0.5, 0.95, 0.05], 0.015, 5); cyl2(S, toon('#5a3a22'), [0.2, 0.78, 0], [0.5, 0.93, 0.05], 0.015, 5);
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), toon('#d4363f')); sc.rotation.x = Math.PI / 2; sc.position.y = 0.9; S.add(sc);
    },
    fasciaGarland(set) { fasciaGarland(set, ['#fff1c8', '#ff5a5a', '#ffd24a', '#6ad2ff'], '#1c5c3a'); },
    izakayaXmas(set) {
      izakayaEaveBulbs(set, ['#fff1c8', '#ffd24a', '#ff6a6a']);
      const W = set.pivot(-10.15, 2.0, 4.42);
      W.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 22), toon('#1c5c3a', { e: '#082a18', ei: 0.7, nosnow: true })));
      bx(W, toon('#d4363f'), -0.09, 0.09, -0.3, -0.18, 0.03, 0.08); bulbs(W, Array.from({ length: 8 }, (_, i) => [Math.cos(i * 0.785) * 0.22, Math.sin(i * 0.785) * 0.22, 0.07]), ['#fff1c8', '#ffd24a'], 0.02);
    },
    xmasWindow(set) {
      window1(set, -2.5, 1.7, 0.85, decal(768, 384, (g, w, h) => {
        outlined(g, 'Merry Christmas', w / 2, h * 0.34, 92, '#ffffff', '#c4262e');
        g.fillStyle = '#ffe9a0'; g.font = `800 40px ${FONT}`; g.textAlign = 'center'; g.fillText('メリークリスマス', w / 2, h * 0.64);
        for (let i = 0; i < 7; i++) snowflake(g, 60 + i * 108, h * 0.88 - (i % 2) * 22, 20 + (i % 3) * 5, '#e8f4ff');
        g.strokeStyle = '#2f9a5a'; g.lineWidth = 8; g.beginPath(); g.moveTo(10, 24); g.quadraticCurveTo(w / 2, 70, w - 10, 24); g.stroke();
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#d4363f' : '#ffd24a'; g.beginPath(); g.arc(30 + i * 88, 24 + Math.sin(i / 8 * Math.PI) * 34, 9, 0, 7); g.fill(); }
      }));
    },
    xmasStockings(set) {
      window1(set, -4.5, 1.5, 0.95, decal(576, 352, (g, w) => {
        outlined(g, 'Happy Holidays', w / 2, 56, 62, '#ffffff', '#1f6a46');
        [[110, '#d4363f'], [288, '#2f9a5a'], [466, '#d4363f']].forEach(([x, c]) => {
          g.fillStyle = c; g.beginPath(); g.moveTo(x - 36, 120); g.lineTo(x + 36, 120); g.lineTo(x + 36, 230); g.quadraticCurveTo(x + 36, 290, x - 20, 300); g.quadraticCurveTo(x - 66, 300, x - 62, 262); g.lineTo(x - 36, 250); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(x - 40, 110, 80, 30);
          g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(x - 40, 316, 12, 0, 7); g.fill();
        });
        for (let i = 0; i < 6; i++) snowflake(g, 40 + i * 100, 330 - (i % 2) * 16, 16, '#e8f4ff');
      }));
    },
    xmasCake(set) {
      window1(set, -0.55, 1.2, 0.9, decal(512, 384, (g, w, h) => {
        outlined(g, 'クリスマスケーキ', w / 2, h * 0.3, 64, '#ffffff', '#c4262e');
        outlined(g, 'ご予約受付中', w / 2, h * 0.58, 70, '#ffe9a0', '#8a1e24');
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2, h * 0.88, 120, 34, 0, 0, 7); g.fill(); g.fillStyle = '#d4363f'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w / 2 - 80 + i * 40, h * 0.82, 12, 0, 7); g.fill(); }
      }), 1.0, 1.45);
    },
    xmasBoard(set) { board(set, -1.65, 2.25, 0.18, 'Merry Xmas!', ['ホットココア', '¥150', 'チキン予約中'], '#ff7a6a'); },

    /* ---------------------------------------------------------------- HALLOWEEN */
    pumpkins(set) { pumpkin(set, 0.3, 2.05, 1.0); pumpkin(set, 3.5, 1.8, 0.85); pumpkin(set, -2.6, 2.35, 1.25); },
    awningLightsHalloween(set) { awningBulbs(set, ['#ff8a1a', '#9a4ee0', '#ff8a1a', '#c8ff5a']); },
    lampGarlandsHalloween(set) { garland(set, 7.0, 2.6, 0.9, 4.4, ['#ff8a1a', '#9a4ee0', '#c8ff5a'], '#1a1028'); garland(set, -8.3, 6.15, 0.9, 4.4, ['#ff8a1a', '#9a4ee0'], '#1a1028'); },
    railLightsHalloween(set) { railBulbs(set, ['#ff8a1a', '#9a4ee0']); },
    blackCat(set) {
      const C = set.pivot(-3.65, Y0, 2.15);
      bx(C, toon('#6b4a35'), -0.22, 0.22, 0, 0.34, -0.2, 0.2);
      bx(C, toon('#7d573d'), -0.23, 0.23, 0.34, 0.38, -0.21, 0.21);
      makeCat(C, 0, 0.38, 0, 0.3).scale.setScalar(0.9);
    },
    broom(set) {
      const Bm = set.pivot(0.1, Y0, 1.66);
      cyl2(Bm, toon('#6b4a35'), [0, 0, 0.05], [0.12, 1.3, -0.1], 0.02, 6);
      const straw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), toon('#c9a860', { lit: 0.15 })); straw.position.set(-0.02, 0.18, 0.06); straw.rotation.x = Math.PI; straw.rotation.z = -0.08; Bm.add(straw);
    },
    spiders(set) {
      [[-2.3, 2.45, 2.4], [0.3, 2.45, 2.4], [-9.7, 2.84, 5.3]].forEach(([x, y, z], i) => {
        const P = set.pivot(x, y, z);
        const sw = grp(P);
        cyl2(sw, toon('#cfd0e0'), [0, 0, 0], [0, -0.9 - i * 0.1, 0], 0.004, 3, { cast: false });
        const body = grp(sw, 0, -0.9 - i * 0.1, 0);
        sph(body, toon('#14101e'), 0.07, 0, 0, 0); sph(body, toon('#14101e'), 0.045, 0, 0.07, 0);
        for (let k = 0; k < 4; k++) [-1, 1].forEach((s) => { const a = 0.3 + k * 0.35; const kz = (k - 1.5) * 0.06; cyl2(body, toon('#14101e'), [s * 0.05, 0, (k - 1.5) * 0.02], [s * 0.19, 0.04 + Math.sin(a) * 0.1, kz], 0.008, 4, { cast: false }); cyl2(body, toon('#14101e'), [s * 0.19, 0.04 + Math.sin(a) * 0.1, kz], [s * 0.22, -0.1, (k - 1.5) * 0.08], 0.008, 4, { cast: false }); });
        swing(sw, 0.05, 1.4 + i * 0.3, i * 1.7, 'z');
      });
    },
    ghostLanterns(set) {
      const ghost = decal(128, 192, (g) => {
        g.fillStyle = '#f6f4ff'; g.shadowColor = '#c8b8ff'; g.shadowBlur = 14;
        g.beginPath(); g.moveTo(14, 180); g.lineTo(14, 70); g.quadraticCurveTo(14, 12, 64, 12); g.quadraticCurveTo(114, 12, 114, 70); g.lineTo(114, 180); g.lineTo(96, 160); g.lineTo(80, 182); g.lineTo(64, 160); g.lineTo(48, 182); g.lineTo(32, 160); g.closePath(); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#2a0f3a'; g.beginPath(); g.ellipse(44, 72, 8, 12, 0, 0, 7); g.ellipse(84, 72, 8, 12, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(64, 108, 10, 15, 0, 0, 7); g.fill();
      });
      [-3.2, 0.1, 3.8].forEach((x, i) => {
        const P = set.pivot(x, 2.5, 2.3);
        const s = grp(P);
        cyl2(s, toon('#8a7aa0'), [0, 0, 0], [0, -0.12, 0], 0.005, 3, { cast: false });
        pl(s, decalMat(ghost, 1.4), 0.3, 0.45, 0, -0.35, 0, 0, 0, { noLine: true });
        halo(s, 0, -0.35, 0.05, '#b8a0ff', 0.9, 0.35);
        swing(s, 0.12, 1.1 + i * 0.2, i * 2.1, 'z');
      });
    },
    bats(set) {
      const tex = decal(128, 64, (g) => {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(64, 20); g.quadraticCurveTo(40, 2, 6, 16); g.quadraticCurveTo(24, 22, 28, 40); g.quadraticCurveTo(40, 30, 52, 44); g.lineTo(64, 36); g.lineTo(76, 44); g.quadraticCurveTo(88, 30, 100, 40); g.quadraticCurveTo(104, 22, 122, 16); g.quadraticCurveTo(88, 2, 64, 20); g.fill();
        g.beginPath(); g.moveTo(56, 22); g.lineTo(52, 8); g.lineTo(62, 16); g.lineTo(66, 16); g.lineTo(76, 8); g.lineTo(72, 22); g.fill();
      });
      const F = set.pivot(0, 0, 0);
      const list = [];
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(0.07, 0.03, 0.14), alphaTest: 0.2, side: THREE.DoubleSide }));
        m.userData.noLine = true; m.userData.keep = true; F.add(m);
        list.push({ m, cx: -3 + Math.random() * 6, cz: -4 + Math.random() * 6, cy: 6.5 + Math.random() * 3, r: 7 + Math.random() * 6, sp: 0.18 + Math.random() * 0.2, ph: Math.random() * 6.28, bob: Math.random() * 2 });
      }
      reg.updaters.push((t) => {
        if (!F.visible) return;
        list.forEach((b) => {
          const a = b.ph + t * b.sp;
          b.m.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(t * 0.9 + b.bob) * 0.7, b.cz + Math.sin(a) * b.r * 0.7);
          if (camRef.cam) b.m.quaternion.copy(camRef.cam.quaternion);
          b.m.scale.set(0.7 + 0.4 * Math.abs(Math.sin(t * 11 + b.ph)), 1, 1);
        });
      });
    },
    izakayaHalloween(set) { pumpkin(set, -11.3, 5.0, 0.8); pumpkin(set, -8.95, 5.05, 0.7); izakayaEaveBulbs(set, ['#ff8a1a', '#9a4ee0']); },
    cobwebs(set) {
      const web = (x, y, z, flip, s = 0.8) => {
        const W = set.pivot(x, y, z);
        const t = decal(256, 256, (g, w) => {
          g.strokeStyle = 'rgba(245,245,255,0.9)'; g.lineWidth = 3;
          const ox = flip ? w : 0, sg = flip ? -1 : 1;
          for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox + sg * Math.cos(a) * 250, Math.sin(a) * 250); g.stroke(); }
          for (let r = 40; r <= 240; r += 50) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); const rr = r * (1 - 0.12 * Math.sin(i * 3.1 + r)); const px = ox + sg * Math.cos(a) * rr, py = Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
        });
        pl(W, decalMat(t, 0.9), s, s, 0, 0, 0, 0, 0, { noLine: true });
      };
      web(-5.1, 2.45, 1.56, false); web(4.1, 2.45, 1.56, true); web(-11.6, 2.6, 4.36, false, 0.6); web(-8.8, 2.6, 4.36, true, 0.6);
    },
    halloweenWindow(set) {
      window1(set, -0.55, 1.8, 0.9, decal(768, 384, (g, w, h) => {
        outlined(g, 'HAPPY', w / 2, h * 0.24, 86, '#ffb347', '#2a0f3a');
        outlined(g, 'HALLOWEEN', w / 2, h * 0.52, 96, '#ff8a1a', '#2a0f3a');
        g.fillStyle = '#ffe9c0'; g.font = `800 38px ${FONT}`; g.textAlign = 'center'; g.fillText('トリック・オア・トリート！', w / 2, h * 0.78);
        const bat = (x, y, s) => { g.fillStyle = '#1c0f2a'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 36 * s, y - 40 * s, x - 70 * s, y - 6 * s); g.quadraticCurveTo(x - 46 * s, y + 4 * s, x - 36 * s, y + 20 * s); g.quadraticCurveTo(x - 18 * s, y + 4 * s, x, y + 16 * s); g.quadraticCurveTo(x + 18 * s, y + 4 * s, x + 36 * s, y + 20 * s); g.quadraticCurveTo(x + 46 * s, y + 4 * s, x + 70 * s, y - 6 * s); g.quadraticCurveTo(x + 36 * s, y - 40 * s, x, y); g.fill(); };
        bat(70, 70, 0.7); bat(w - 80, 56, 0.9); bat(w - 190, 320, 0.6);
        g.fillStyle = '#f4f2ff'; g.beginPath(); g.moveTo(w - 130, 330); g.quadraticCurveTo(w - 130, 250, w - 90, 250); g.quadraticCurveTo(w - 50, 250, w - 50, 330); g.lineTo(w - 50, 372); g.lineTo(w - 70, 356); g.lineTo(w - 90, 372); g.lineTo(w - 110, 356); g.lineTo(w - 130, 372); g.closePath(); g.fill();
        g.fillStyle = '#2a0f3a'; g.beginPath(); g.arc(w - 106, 300, 6, 0, 7); g.arc(w - 74, 300, 6, 0, 7); g.fill();
      }));
    },
    halloweenWindow2(set) {
      window1(set, -2.5, 1.6, 0.9, decal(640, 360, (g, w) => {
        outlined(g, 'TRICK', w / 2, 70, 80, '#c8ff5a', '#2a0f3a'); outlined(g, 'OR TREAT?', w / 2, 160, 80, '#ff8a1a', '#2a0f3a');
        g.fillStyle = '#ffe9c0'; g.font = `800 36px ${FONT}`; g.textAlign = 'center'; g.fillText('おかしをくれなきゃいたずらするぞ', w / 2, 240);
        [[90, 300], [w - 90, 300]].forEach(([x, y]) => { g.fillStyle = '#e0701a'; g.beginPath(); g.ellipse(x, y, 40, 32, 0, 0, 7); g.fill(); g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(x - 22, y - 8); g.lineTo(x - 8, y - 8); g.lineTo(x - 15, y - 22); g.moveTo(x + 22, y - 8); g.lineTo(x + 8, y - 8); g.lineTo(x + 15, y - 22); g.fill(); g.beginPath(); g.moveTo(x - 20, y + 8); g.quadraticCurveTo(x, y + 26, x + 20, y + 8); g.lineTo(x + 12, y + 6); g.lineTo(x, y + 14); g.lineTo(x - 12, y + 6); g.fill(); });
      }));
    },
    halloweenBoard(set) { board(set, -1.65, 2.25, 0.18, 'Trick or Treat', ['限定スイーツ', '¥198', 'かぼちゃプリン'], '#ff8a1a', '#ffb347'); },

    /* ---------------------------------------------------------------- NEW YEAR */
    kadomatsu(set) { kadomatsu(set, 0.3, 1.75); kadomatsu(set, 3.55, 1.7); },
    shimenawa(set) { shimenawa(set, 2.2, 2.74, 1.62); },
    kohakuCurtain(set) {
      const C = set.pivot(0, 0, 0);
      pl(C, stripeMat(11), 10.2, 0.3, (-5.6 + 5.45) / 2, 2.42, 2.49, 0, 0);
      pl(C, stripeMat(8), 7.2, 0.3, 5.47, 2.42, -1.5, Math.PI / 2, 0);
    },
    nobori(set) {
      nobori(set.pivot(1.2, 0, 5.7), 0, 0, '迎春', '#c4181c', 2.1);
      nobori(set.pivot(4.0, 0, 5.7), 0, 0, '初売り', '#b0141c', 3.4);
    },
    kagamiMochi(set) {
      const K = set.pivot(-1.65, Y0, 2.2);
      bx(K, toon('#6b4a35'), -0.3, 0.3, 0, 0.5, -0.2, 0.2);
      bx(K, toon('#c4262e', { lit: 0.2 }), -0.34, 0.34, 0.5, 0.53, -0.24, 0.24);
      bx(K, toon('#ffffff', { lit: 0.3 }), -0.2, 0.2, 0.53, 0.55, -0.14, 0.14);
      cy(K, toon('#fffaf0', { lit: 0.3 }), 0, 0.55, 0, 0.16, 0.1, 14); cy(K, toon('#fffaf0', { lit: 0.3 }), 0, 0.65, 0, 0.115, 0.09, 14);
      sph(K, toon('#e87a1a', { lit: 0.2 }), 0.06, 0, 0.78, 0);
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), toon('#2a8a3a')); l.position.set(0.05, 0.83, 0); K.add(l);
    },
    lampGarlandsNewYear(set) { garland(set, 7.0, 2.6, 0.9, 4.4, ['#ffd27a', '#ff4a3a', '#fff1c8'], '#8a1a1a'); garland(set, -8.3, 6.15, 0.9, 4.4, ['#ffd27a', '#ff4a3a'], '#8a1a1a'); },
    fasciaBuntingRW(set) {
      const C = set.pivot(0, 0, 0);
      const t = canvasTex(512, 64, (g, w) => { for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#f6f3ea' : '#c4262e'; g.beginPath(); g.moveTo(i * 25.6, 0); g.lineTo(i * 25.6 + 25.6, 0); g.arc(i * 25.6 + 12.8, 24, 12.8, 0, Math.PI); g.closePath(); g.fill(); g.fillRect(i * 25.6, 0, 25.6, 24); } g.fillStyle = '#d8b04a'; g.fillRect(0, 0, w, 5); });
      pl(C, new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(0.85, 0.82, 0.8) }), 9.9, 0.36, (-5.5 + 4.45) / 2, 3.0, 1.74, 0, 0);
    },
    izakayaNewYear(set) {
      kadomatsu(set, -11.35, 4.85, 0.85); kadomatsu(set, -8.95, 4.85, 0.85);
      shimenawa(set, -10.15, 2.65, 4.42, 1.5, 0.8);
      const C = set.pivot(0, 0, 0);
      pl(C, stripeMat(7), 3.7, 0.26, -10.15, 2.5, 5.37, 0, 0);
      nobori(set.pivot(-8.2, 0, 5.5), 0, 0, '新年会', '#c4181c', 5.2);
    },
    newYearWindow(set) {
      window1(set, -2.5, 1.7, 0.85, decal(768, 384, (g, w, h) => {
        g.fillStyle = 'rgba(196,38,46,0.92)'; roundRect(g, 6, 6, w - 12, h - 12, 26); g.fill();
        g.strokeStyle = '#e8c860'; g.lineWidth = 8; roundRect(g, 18, 18, w - 36, h - 36, 20); g.stroke();
        outlined(g, '謹賀新年', w / 2, h * 0.38, 150, '#ffe9a0', '#7a1218');
        outlined(g, '本年もよろしくお願いします', w / 2, h * 0.74, 46, '#ffffff', '#7a1218', 800);
      }), 1.0);
    },
    newYearFukubukuro(set) {
      window1(set, -0.55, 1.2, 0.9, decal(512, 384, (g, w, h) => { g.fillStyle = '#f6f3ea'; roundRect(g, 6, 6, w - 12, h - 12, 26); g.fill(); outlined(g, '初売り', w / 2, h * 0.38, 130, '#c4262e', '#ffffff'); outlined(g, '福袋 好評発売中', w / 2, h * 0.76, 52, '#7a1218', '#ffffff', 800); }), 0.95, 1.5);
    },
    newYearBoard(set) { board(set, -1.65, 2.25, 0.18, 'あけおめ!', ['おせち予約', '福袋 ¥1000', '初詣へどうぞ'], '#e8c860', '#ffe9a0'); },

    /* ---------------------------------------------------------------- SAKURA FESTIVAL */
    sakuraLanterns(set) {
      const L = set.pivot(0, 0, 0);
      for (let i = 0; i < 7; i++) {
        const x = -4.9 + i * 1.5;
        const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 14), glow('#ff9fc0', 1.6, { cat: 'deco' }));
        lan.position.set(x, 2.36, 2.4); L.add(lan);
        cy(L, toon('#2a1a22'), x, 2.52, 2.4, 0.07, 0.04, 8); cy(L, toon('#2a1a22'), x, 2.17, 2.4, 0.07, 0.03, 8);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: petalTex(), transparent: true, depthWrite: false }));
        fl.position.set(x, 2.36, 2.4 + 0.125); fl.userData.noLine = true; L.add(fl);
        halo(L, x, 2.36, 2.42, '#ffa8c8', 0.9, 0.4);
      }
      bulbs(L, swag(-5.35, 5.3, 2.62, 2.5, 0.34, 0.07), ['#ffb3cd', '#ffe0ec', '#ff8fb5'], 0.03);
    },
    blossomGarland(set) {
      const B2 = set.pivot(3.3, 2.6, 1.7);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, 0.1, 0), new THREE.Vector3(-0.3, -0.1, 0.05), new THREE.Vector3(0.4, 0.05, 0.02), new THREE.Vector3(1.0, -0.12, 0)]);
      B2.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 6), toon('#4a3a40')));
      blossoms(B2, curve, 46, 0.18, 0.13, 12);
      // blossom swag along the fascia
      const S = set.pivot(0, 0, 0);
      const pts = []; for (let i = 0; i <= 40; i++) { const x = -5.4 + (i / 40) * 9.8; pts.push(new THREE.Vector3(x, 3.04 - 0.09 * Math.abs(Math.sin(((x + 5.4) / 1.6) * Math.PI)), 1.76)); }
      const cv = new THREE.CatmullRomCurve3(pts);
      S.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 120, 0.02, 5), toon('#4a3a40')));
      blossoms(S, cv, 150, 0.12, 0.12, 31);
    },
    lampBoughs(set) {
      [[7.0, 2.6, 4.7], [-8.3, 6.15, 4.7], [7.0, 4.3, 5.2]].forEach(([x, z, y], i) => {
        const P = set.pivot(x, Y0, z);
        const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, y - 0.7, 0), new THREE.Vector3(-0.4, y - 0.2, 0.2), new THREE.Vector3(-0.9, y + 0.1, 0.1), new THREE.Vector3(-1.3, y - 0.2, 0.3)]);
        P.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 20, 0.025, 5), toon('#4a3a40')));
        blossoms(P, cv, 60, 0.35, 0.16, 70 + i);
      });
    },
    sakuraNobori(set) {
      nobori(set.pivot(1.2, 0, 5.7), 0, 0, '桜まつり', '#e8588a', 2.7);
      nobori(set.pivot(4.0, 0, 5.7), 0, 0, '春限定', '#f08aac', 4.4);
    },
    sakuraFestoon(set) { festoon(set, [5.4, 2.85, 2.2], [7.0, 4.9, 2.6], 0.35, 5, true); festoon(set, [-5.6, 2.85, 2.2], [-8.3, 4.9, 6.0], 0.5, 5, true); },
    izakayaSakura(set) {
      const L = set.pivot(0, 0, 0);
      [-11.5, -10.6, -9.7, -8.8].forEach((x) => { const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), glow('#ff9fc0', 1.6, { cat: 'deco' })); lan.position.set(x, 2.42, 5.3); L.add(lan); halo(L, x, 2.42, 5.32, '#ffa8c8', 0.8, 0.4); });
      const B2 = set.pivot(-10.15, 2.5, 4.5);
      const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, 0.0, 0), new THREE.Vector3(0, -0.08, 0.04), new THREE.Vector3(0.9, 0.0, 0)]);
      B2.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 16, 0.02, 5), toon('#4a3a40')));
      blossoms(B2, cv, 36, 0.14, 0.12, 91);
    },
    sakuraWindow(set) {
      window1(set, -2.5, 1.7, 0.85, decal(768, 384, (g, w, h) => {
        g.fillStyle = 'rgba(255,214,228,0.94)'; roundRect(g, 6, 6, w - 12, h - 12, 28); g.fill();
        g.strokeStyle = '#e8587f'; g.lineWidth = 6; roundRect(g, 18, 18, w - 36, h - 36, 20); g.stroke();
        outlined(g, '春限定', w / 2, h * 0.3, 110, '#e8346a', '#ffffff'); outlined(g, '桜フェア', w / 2, h * 0.62, 120, '#c4204f', '#ffffff');
        g.fillStyle = '#7a2a44'; g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.fillText('SAKURA FAIR  ·  さくらスイーツ登場', w / 2, h * 0.88);
        for (let i = 0; i < 6; i++) { g.drawImage(petalTex().image, 40 + i * 24, 26 + (i % 2) * 22, 38, 38); g.drawImage(petalTex().image, w - 80 - i * 22, h - 70 - (i % 2) * 18, 34, 34); }
      }));
    },
    sakuraWindow2(set) {
      window1(set, -0.55, 1.2, 0.9, decal(512, 384, (g, w, h) => {
        g.fillStyle = 'rgba(255,236,242,0.94)'; roundRect(g, 6, 6, w - 12, h - 12, 26); g.fill();
        outlined(g, 'さくらラテ', w / 2, h * 0.32, 84, '#d6336c', '#ffffff'); outlined(g, '発売中', w / 2, h * 0.62, 78, '#a82255', '#ffffff');
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2, h * 0.88, 80, 22, 0, 0, 7); g.fill(); g.drawImage(petalTex().image, w / 2 - 20, h * 0.88 - 20, 40, 40);
      }), 1.0, 1.5);
    },
    sakuraBoard(set) { board(set, -1.65, 2.25, 0.18, '桜フェア開催中', ['さくらラテ', '¥320', '花見弁当'], '#ff8fb5', '#ffd6e6'); },

    /* ---------------------------------------------------------------- SUMMER FESTIVAL */
    summerLanterns(set) {
      const L = set.pivot(0, 0, 0);
      for (let i = 0; i < 9; i++) lanternOf(L, -5.1 + i * 1.18, 2.4, 2.4, i % 2 === 0, '祭');
    },
    summerFestoons(set) { festoon(set, [5.4, 2.85, 2.2], [7.0, 4.9, 2.6], 0.35, 5, false); festoon(set, [-5.6, 2.85, 2.2], [-8.3, 4.9, 6.0], 0.5, 5, false); },
    bunting(set) {
      const F = set.pivot(0, 0, 0);
      const pts = line3([-5.0, 6.0, 6.0], [7.0, 5.0, 2.6], 40, 0.9);
      F.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 60, 0.012, 4), toon('#2a2230')), { userData: { noLine: true } }));
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.3, 0], 3));
      const cols = ['#e0343a', '#f6f3ea', '#2f7bd9', '#ffd24a', '#2fa56a'];
      const im = new THREE.InstancedMesh(tri, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xffffff }), 33);
      const c = new THREE.Color(), m4 = new THREE.Matrix4();
      for (let i = 0; i < 33; i++) { const p = pts[1 + i]; m4.makeTranslation(p[0], p[1] - 0.01, p[2]); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(cols[i % cols.length]).multiplyScalar(0.85)); }
      im.userData.noLine = true; im.frustumCulled = false; F.add(im);
    },
    yatai(set) {
      const Y = set.pivot(-2.9, Y0, 4.1);
      const wood = toon('#7a5232', { lit: 0.35 });
      bx(Y, wood, -0.85, 0.85, 0, 0.9, -0.35, 0.35);
      bx(Y, toon('#d8b878', { lit: 0.4 }), -0.9, 0.9, 0.9, 0.95, -0.4, 0.42);
      [-0.8, 0.8].forEach((x) => [-0.32, 0.32].forEach((z) => cy(Y, wood, x, 0.9, z, 0.035, 1.25, 7)));
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9), stripeMat(5, '#d4363f', '#f6f3ea'));
      roof.rotation.x = -Math.PI / 2 + 0.28; roof.position.set(0, 2.2, 0.0); Y.add(roof);
      bx(Y, toon('#d4363f', { lit: 0.3 }), -0.95, 0.95, 2.02, 2.1, 0.34, 0.5, { cast: false });
      [-0.55, -0.2, 0.15].forEach((x, i) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.055, 0.14, 10), toon('#ffffff', { lit: 0.4 })); cup.position.set(x, 1.04, 0.1); Y.add(cup);
        sph(Y, toon(['#ff7aa8', '#5ad1ff', '#ffe066'][i], { lit: 0.5 }), 0.095, x, 1.14, 0.1, 1, 0.8, 1);
      });
      [0.5, 0.64, 0.78].forEach((x, i) => cy(Y, toon(['#e8493f', '#2f7bd9', '#7ed957'][i], { lit: 0.4 }), x, 0.95, 0.05, 0.035, 0.24, 8));
      const sg = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#2b73c4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8); T(g, 'かき氷', w / 2, h / 2 + 2, 62, '#ffffff', { weight: 900 }); });
      pl(Y, new THREE.MeshBasicMaterial({ map: sg, color: new THREE.Color(1.15, 1.15, 1.15) }), 0.9, 0.34, 0, 1.55, 0.45, 0, 0);
      lanternOf(Y, -0.7, 1.9, 0.5, true, '氷', 0.7); lanternOf(Y, 0.7, 1.9, 0.5, false, '氷', 0.7, true);
      const fl = decal(96, 320, (g, w) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 320); g.fillStyle = '#4aa8f0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w / 2, 40 + i * 36, 30, Math.PI, 0); g.fill(); } T(g, '氷', w / 2, 250, 72, '#d4363f', { weight: 900 }); });
      cy(Y, toon('#c9ced8'), 1.2, 0, 0.35, 0.025, 2.2, 6);
      pl(Y, new THREE.MeshBasicMaterial({ map: fl, color: new THREE.Color(0.9, 0.9, 0.9), transparent: true }), 0.36, 1.2, 1.2, 1.55, 0.37, 0, 0);
      halo(Y, 0, 1.5, 0.5, '#ffd9a0', 2.6, 0.35);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.2, 18), toon('#2f7bd9', { lit: 0.3 })); tub.position.set(-1.5, 0.1, 0.1); Y.add(tub);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.7, 1.0) })); water.rotation.x = -Math.PI / 2; water.position.set(-1.5, 0.19, 0.1); Y.add(water);
      for (let i = 0; i < 6; i++) sph(Y, toon(['#ff6a2a', '#ff8a3a', '#ffffff'][i % 3], { lit: 0.5 }), 0.04, -1.5 + Math.cos(i * 1.2) * 0.2, 0.2, 0.1 + Math.sin(i * 1.2) * 0.2, 1.4, 0.7, 0.8, { cast: false });
    },
    furin(set) {
      [-4.4, -1.3, 0.75, 4.0].forEach((x, i) => {
        const P = set.pivot(x, 2.5, 2.38);
        const s = grp(P);
        cyl2(s, toon('#8a8a9a'), [0, 0, 0], [0, -0.12, 0], 0.005, 3, { cast: false });
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.95, 1.1), transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        bell.position.y = -0.2; bell.rotation.x = Math.PI; s.add(bell);
        const tz = canvasTex(32, 96, (g, w, h) => { g.fillStyle = ['#ff7aa8', '#7ad6ff', '#ffe066', '#9ae07a'][i % 4]; g.fillRect(0, 0, w, h); });
        pl(s, new THREE.MeshBasicMaterial({ map: tz, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.1) }), 0.05, 0.16, 0, -0.34, 0, 0, 0, { noLine: true });
        swing(s, 0.16, 1.9 + i * 0.25, i * 1.3, 'z');
      });
    },
    summerNobori(set) {
      nobori(set.pivot(1.2, 0, 5.7), 0, 0, '夏祭り', '#d83a2a', 1.7);
      nobori(set.pivot(4.0, 0, 5.7), 0, 0, '花火大会', '#2a63b8', 5.1);
    },
    izakayaSummer(set) {
      const L = set.pivot(0, 0, 0);
      [-11.6, -10.9, -10.2, -9.5, -8.8].forEach((x, i) => lanternOf(L, x, 2.5, 5.28, i % 2 === 0, '祭', 0.62));
      izakayaEaveBulbs(set, ['#ffd27a', '#ffb347']);
    },
    summerWindow(set) {
      window1(set, -0.55, 0.8, 1.1, decal(512, 700, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#0a1340'); grd.addColorStop(1, '#3a1b60'); g.fillStyle = grd; roundRect(g, 4, 4, w - 8, h - 8, 24); g.fill();
        [[130, 190, '#ff6aa8'], [380, 150, '#ffd24a'], [300, 330, '#5de3ff']].forEach(([x, y, c]) => { g.strokeStyle = c; g.lineWidth = 7; for (let i = 0; i < 20; i++) { const t = (i / 20) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(t) * 20, y + Math.sin(t) * 20); g.lineTo(x + Math.cos(t) * 85, y + Math.sin(t) * 85); g.stroke(); } });
        outlined(g, '夏祭り', w / 2, h * 0.62, 150, '#ffffff', '#c4262e'); outlined(g, '花火大会', w / 2, h * 0.78, 90, '#ffd24a', '#2a1060');
        g.fillStyle = '#bfe0ff'; g.font = `800 36px ${FONT}`; g.textAlign = 'center'; g.fillText('8/23 SAT  19:30', w / 2, h * 0.92);
      }), 1.0, 1.65);
    },
    summerWindow2(set) {
      window1(set, -2.55, 1.4, 0.7, decal(512, 256, (g) => {
        const fan = (cx, col, txt) => { g.fillStyle = col; g.beginPath(); g.arc(cx, 110, 92, 0, 7); g.fill(); g.fillStyle = '#d8b878'; g.fillRect(cx - 12, 196, 24, 56); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, 110, 74, 0, 7); g.stroke(); T(g, txt, cx, 112, 70, '#ffffff', { weight: 900 }); };
        fan(130, '#2f7bd9', '涼'); fan(382, '#d4363f', '祭');
      }), 1.0, 1.6);
      window1(set, -4.5, 1.5, 0.8, decal(576, 288, (g, w) => { outlined(g, 'かき氷', w / 2, 90, 100, '#ffffff', '#2f7bd9'); outlined(g, 'はじめました', w / 2, 200, 66, '#ffe066', '#2f7bd9'); }), 1.0, 1.7);
    },
    summerBoard(set) { board(set, -1.65, 2.25, 0.18, '夏祭り 本日!', ['かき氷 ¥300', '花火 20:00', 'ラムネ冷えてます'], '#5de3ff', '#ffd24a'); },
  };

  /* ---------------------------------------------------------------- fairy lights inside the real trees */
  function treeLights(set, cfg) {
    const trees = reg.trees || [];
    if (!trees.length) return;
    const F = set.pivot(0, 0, 0);
    const R2 = rng(cfg.count * 13 + 5);
    const pts = [];
    const per = Math.max(3, Math.round(cfg.count / trees.length));
    trees.forEach((t) => {
      for (let i = 0; i < per; i++) {
        const a = R2() * Math.PI * 2, e2 = (R2() - 0.25) * 1.9, r = 0.72 + R2() * 0.25;
        pts.push([t.center.x + Math.cos(a) * Math.cos(e2) * t.half.x * r, t.center.y + Math.sin(e2) * t.half.y * r, t.center.z + Math.sin(a) * Math.cos(e2) * t.half.z * r]);
      }
    });
    bulbs(F, pts, cfg.palette, cfg.size);
  }

  function build(id, set) {
    const cfg = holidayAtmosphereConfig[id];
    setCat('deco');
    [...cfg.decorations, ...cfg.windowProps, ...cfg.signProps].forEach((name) => { if (B[name]) B[name](set); else console.warn('holiday builder missing:', name); });
    if (cfg.treeLights) treeLights(set, cfg.treeLights);
    setCat('shop');
    reg.sceneDirty = true; // new props: the ink pass must learn which ones are ink-less / cut-outs
  }

  /* ---------------------------------------------------------------- API */
  return {
    root,
    setCamera: (c) => (camRef.cam = c),
    /** w: { id: weight 0..1 }; night 0..1; flash 0..1 (lightning, weather-driven); twinkle 0..1 blended from config */
    apply(w, t, dt, night, flash = 0, twinkle = 1) {
      BULB_U.uTime.value = t;
      BULB_U.uK.value = (0.35 + 0.65 * night) * (1 + flash * 1.1);
      BULB_U.uTw.value = twinkle * (0.3 + 0.7 * night);
      HOLIDAYS.forEach((id) => {
        if (id === 'none') return;
        const set = (sets[id] = sets[id] || mkSet());
        const wt = w[id] || 0;
        if (wt > 0.005 && !set.built) { build(id, set); set.built = true; }
        if (!set.built) return;
        const k = Math.min(1, wt);
        const e = k <= 0 ? 0 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); // soft pop (ease-out-back)
        set.pivots.forEach((p) => { p.scale.setScalar(p.userData.flat ? 1 : Math.max(0.001, e)); p.visible = wt > 0.01; });
      });
    },
  };
}
