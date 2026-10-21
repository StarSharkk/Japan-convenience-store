import * as THREE from 'three';
import { rng, toon, canvasTex } from '../core.js';
import { bladeGeo, taperTube, placeLeaf, tint, mergeInto, leafTex, leafMat, triCount, stemMat } from './kit.js';

/* ====================================================================================================
   Potted plants (plant + terracotta pot + soil) - candidates after reference 2, sized for the izakaya
   entrance (the pot stays below the menu boards, the plant does not reach the noren):
     rhapis  観音竹 (Rhapis excelsa): a clump of thin canes carrying fans of narrow leaf segments
     ficus   ゴムの木 (Ficus elastica): one stem, spiralling glossy oval leaves, red growing tip
   The pot is a lathe: foot band, slightly flared wall, a thick rounded rim, the inner wall going down to
   the soil, a bottom. The soil sits below the rim with a soft bumpy surface and a few pebbles; stems
   start below the soil surface.
   ==================================================================================================== */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const upOf = (dir) => UP.clone().addScaledVector(dir, -UP.dot(dir)).normalize();

/* ---------------------------------------------------------------- terracotta */
let _clay;
function clayTex() {
  if (_clay) return _clay;
  _clay = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b4613f'; g.fillRect(0, 0, w, h);
    const R = rng(77);
    // broad colour drift around the pot + soft vertical streaks (no dense noise)
    for (let i = 0; i < 26; i++) {
      const x = R() * w, y = R() * h, r = 30 + R() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = R() < 0.5 ? '205,128,88' : '128,62,38';
      gr.addColorStop(0, `rgba(${c},${0.12 + R() * 0.12})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(90,45,25,${0.04 + R() * 0.05})`; g.fillRect(R() * w, h * 0.35 + R() * h * 0.3, 2 + R() * 4, h * (0.2 + R() * 0.3)); }
    // a faint pale mineral bloom near the rim and the wear on the foot
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(70,35,20,0.25)'); gy.addColorStop(0.12, 'rgba(70,35,20,0)');
    gy.addColorStop(0.62, 'rgba(240,215,190,0)'); gy.addColorStop(0.8, 'rgba(240,215,190,0.12)'); gy.addColorStop(1, 'rgba(240,215,190,0.05)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
  }, { repeat: true });
  return _clay;
}
let _soil;
function soilTex() {
  if (_soil) return _soil;
  _soil = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3b2b20'; g.fillRect(0, 0, w, h);
    const R = rng(9);
    for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.5 ? 'rgba(90,70,52,0.5)' : 'rgba(20,12,8,0.45)'; g.beginPath(); g.arc(R() * w, R() * h, 0.8 + R() * 2.2, 0, 7); g.fill(); }
  }, { repeat: true });
  return _soil;
}

let _clayM, _soilM;
const clayMat = () => (_clayM ||= toon('#ffffff', { map: clayTex(), lit: 0.03, nocache: true }));
const soilMatP = () => (_soilM ||= toon('#ffffff', { map: soilTex(), lit: 0.02, nocache: true }));

/**
 * terracotta pot with soil. r = rim outer radius, h = height. Returns { group, soilY, soilR }.
 */
export function makePot({ r = 0.2, h = 0.4, seed = 1 } = {}) {
  const g = new THREE.Group();
  const lip = 0.028, wall = 0.018;
  const rb = r * 0.84, rf = r * 0.88; // wall at the bottom, foot band
  const P = (x, y) => new THREE.Vector2(x, y);
  // profile from the bottom centre, out along the base, up the outside, over the rim, down the inside
  const prof = [
    P(0.0, 0.004), P(rf - 0.02, 0.0), P(rf - 0.004, 0.006), P(rf, 0.02), P(rf, 0.05), P(rf - 0.006, 0.056), P(rb, 0.064),
    P(rb + (r - rb) * 0.35, h * 0.4), P(r - 0.006, h - lip - 0.004),
    P(r + 0.006, h - lip + 0.004), P(r + 0.01, h - lip * 0.5), P(r + 0.006, h - 0.004), P(r - 0.004, h), // rim roll
    P(r - lip * 0.75, h - 0.002), P(r - lip - 0.002, h - 0.012), // rim top -> inner edge
    P(r - lip - wall * 0.2, h - lip - 0.03), P(rb - wall, 0.08), P(rb - wall - 0.02, 0.05), P(0.0, 0.05),
  ];
  const geo = new THREE.LatheGeometry(prof, 44);
  // uv: u around, v up the wall in metres-ish so the clay texture is not stretched on the rim
  const mat = clayMat();
  const pot = new THREE.Mesh(geo, mat);
  pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);
  // soil: a bumpy disc a little below the rim, sealing against the inner wall
  const soilY = h - 0.06, soilR = r - lip - wall * 0.15;
  {
    const R = rng(seed + 3);
    const rings = 5, seg = 36;
    const pos = [0, soilY + 0.012, 0], uv = [0.5, 0.5], idx = [];
    for (let i = 1; i <= rings; i++) {
      const rho = i / rings;
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const rr = soilR * rho * (i === rings ? 1.02 : 1);
        const y = soilY + (i === rings ? -0.006 : 0.012 * (1 - rho * rho) + (R() - 0.5) * 0.008);
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); uv.push(0.5 + Math.cos(a) * rho * 0.5, 0.5 + Math.sin(a) * rho * 0.5);
      }
    }
    for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
    for (let i = 1; i < rings; i++) { const o0 = 1 + (i - 1) * seg, o1 = 1 + i * seg; for (let j = 0; j < seg; j++) { const a = o0 + j, b = o0 + ((j + 1) % seg), c = o1 + j, d = o1 + ((j + 1) % seg); idx.push(a, b, c, b, d, c); } }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sg.setIndex(idx); sg.computeVertexNormals();
    const soil = new THREE.Mesh(sg, soilMatP());
    soil.receiveShadow = true; g.add(soil);
    // a few pebbles
    const peb = toon('#6a645c');
    for (let k = 0; k < 7; k++) {
      const a = R() * 6.28, d = soilR * (0.35 + R() * 0.55);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.012 + R() * 0.01, 7, 5), peb);
      s.scale.set(1.3, 0.6, 1); s.position.set(Math.cos(a) * d, soilY + 0.008, Math.sin(a) * d); s.rotation.y = R() * 3; g.add(s);
    }
  }
  return { group: g, soilY, soilR };
}

/* ---------------------------------------------------------------- 観音竹 */
export function makeRhapisPot({ seed = 21 } = {}) {
  const R = rng(seed);
  const { group: g, soilY, soilR } = makePot({ r: 0.19, h: 0.36, seed });
  const leaves = [], canes = [];
  const tex = leafTex('rhapis', { kind: 'plain', base: '#3f733a', edge: '#30602f', vein: '#7aa868', center: '#4b8444', glossy: 0.8 });
  const seg = (l) => bladeGeo({ L: l, W: l * 0.15, segL: 6, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * (0.05 + 0.95 * v)), 0.7) * (1 - 0.4 * v), droop: 0.32, cup: 0.18, keel: 0.1 });
  const nC = 8;
  for (let c = 0; c < nC; c++) {
    const a = c * 2.39996 + R() * 0.4, d = soilR * (0.15 + 0.6 * Math.sqrt(R()));
    const b = V(Math.cos(a) * d, soilY - 0.04, Math.sin(a) * d);
    const H = 0.42 + R() * 0.42;
    const lean = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.06 + R() * 0.08);
    const top = b.clone().add(lean.clone().multiplyScalar(H * 0.9)).setY(soilY + H);
    const cv = new THREE.CatmullRomCurve3([b, b.clone().lerp(top, 0.5).add(V((R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.02)), top]);
    canes.push(tint(taperTube(cv, 0.011, 0.006, 8, 5), 0.85 + R() * 0.25));
    // leaves along the upper part of the cane: petiole + a fan of 5-7 narrow segments
    const nL = 4 + ((R() * 3) | 0);
    for (let k = 0; k < nL; k++) {
      const t = 0.3 + (k / Math.max(1, nL - 1)) * 0.68;
      const p = cv.getPointAt(Math.min(1, t));
      const az = a + k * 2.1 + R() * 0.6;
      const hz = V(Math.cos(az), 0, Math.sin(az));
      const pl = 0.09 + R() * 0.07;
      const pEnd = p.clone().addScaledVector(hz, pl * 0.75).add(V(0, pl * 0.7, 0));
      canes.push(tint(taperTube(new THREE.CatmullRomCurve3([p, p.clone().lerp(pEnd, 0.5).add(V(0, 0.01, 0)), pEnd]), 0.004, 0.003, 4, 4), 1.05));
      const side = new THREE.Vector3().crossVectors(UP, hz).normalize();
      const fanUp = 0.35 + R() * 0.2;
      const ns = 6 + ((R() * 3) | 0);
      const shade = 0.85 + R() * 0.25;
      for (let s = 0; s < ns; s++) {
        const phi = (s / (ns - 1) - 0.5) * (1.9 + R() * 0.3);
        const dir = hz.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi)).multiplyScalar(Math.cos(fanUp)).addScaledVector(UP, Math.sin(fanUp)).normalize();
        const l = (0.15 + R() * 0.08) * (1 - Math.abs(phi) * 0.18);
        leaves.push(placeLeaf(seg(l), pEnd, dir, upOf(dir), shade * (0.95 + R() * 0.1)));
      }
    }
  }
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(canes, stemMat('#7d6c4a')));
  g.userData = { name: '観音竹 (rhapis) + 陶土鉢', tris: triCount(g) };
  return g;
}

/* ---------------------------------------------------------------- ゴムの木 */
export function makeFicusPot({ seed = 31 } = {}) {
  const R = rng(seed);
  const { group: g, soilY } = makePot({ r: 0.16, h: 0.32, seed });
  const leaves = [], stems = [];
  const tex = leafTex('ficus', { kind: 'net', base: '#2f5a33', edge: '#244a2a', vein: '#5a8458', center: '#3b6c3f', veins: 8, glossy: 1 });
  const H = 0.72;
  const stem = new THREE.CatmullRomCurve3([V(0, soilY - 0.05, 0), V(0.015, soilY + H * 0.35, 0.005), V(-0.01, soilY + H * 0.7, 0.01), V(0.005, soilY + H, -0.005)]);
  stems.push(tint(taperTube(stem, 0.017, 0.008, 12, 6), 0.95));
  const n = 14;
  for (let k = 0; k < n; k++) {
    const t = 0.16 + (k / (n - 1)) * 0.8;
    const p = stem.getPointAt(t);
    const az = k * 2.39996 + R() * 0.3;
    const hz = V(Math.cos(az), 0, Math.sin(az));
    const pEnd = p.clone().addScaledVector(hz, 0.045).add(V(0, 0.035, 0));
    stems.push(tint(taperTube(new THREE.CatmullRomCurve3([p, p.clone().lerp(pEnd, 0.5).add(V(0, 0.008, 0)), pEnd]), 0.006, 0.004, 4, 4), 1.0));
    const young = t > 0.85;
    const beta = young ? -0.6 : -0.05 + (1 - t) * 0.45 + R() * 0.12; // lower leaves hang more
    const dir = hz.clone().multiplyScalar(Math.cos(beta)).addScaledVector(UP, -Math.sin(beta)).normalize();
    const L = (young ? 0.13 : 0.2 + 0.1 * Math.sin(Math.PI * t)) * (0.92 + R() * 0.16);
    const blade = bladeGeo({ L, W: L * 0.5, segL: 9, segW: 3, width: (v) => Math.pow(Math.sin(Math.PI * (0.08 + 0.9 * v)), 0.7) * (1 - 0.25 * v), droop: 0.16, cup: 0.08, keel: 0.05, twist: (R() - 0.5) * 0.3 });
    leaves.push(placeLeaf(blade, pEnd, dir, upOf(dir), 0.86 + R() * 0.24));
  }
  g.add(mergeInto(leaves, leafMat(tex)));
  g.add(mergeInto(stems, stemMat('#5f6e42')));
  // the red sheath of the growing tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 7), toon('#a8402e'));
  tip.position.copy(stem.getPointAt(1)).add(V(0, 0.03, 0)); g.add(tip);
  g.userData = { name: 'ゴムの木 (ficus) + 陶土鉢', tris: triCount(g) };
  return g;
}

export const POTTED_PLANTS = [
  { id: 'rhapis', make: makeRhapisPot },
  { id: 'ficus', make: makeFicusPot },
];
