import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reg, toon, cy, cyl2, grp, canvasTex } from '../core.js';
import { groundY } from './layout.js';

/* ====================================================================================================
   Roadside safety: ONE plan for the town's tactile paving (点字ブロック) and its white fences, laid out the way a
   Japanese town does it.

     tactile paving   yellow blocks, 30 cm, a little proud of the paving:
                      · linear guide blocks (誘導ブロック, bars running with the walk) along the sidewalks of the two
                        main roads (Kaigan-dori, Hoshizora-dori), a steady distance in from the kerb
                      · warning blocks (警告ブロック, dots) where a line turns or meets another, where it ends at a side
                        street, and as a pad on the kerb at every zebra landing (a short branch leads to it from the
                        line); the station's path from the road to its steps
     sidewalk fences  横断防止柵: white posts, a top and a bottom rail, slim vertical bars; 25 cm in from the kerb, only
                      near the crossings and the main corner (to keep people from crossing anywhere), with a gap at
                      every crossing, side street and driveway; a run breaks round whatever stands at the kerb
                      (poles, lamps, signs, trees, bins) - found from the scene itself
     guard rails      ガードレール: white W-beam on round posts, where the road is the danger (the lake lane's bank,
                      the road ends at the island's edge) - guardRailW(), also used by furniture.js / island.js

   Everything stands on groundY (the sidewalks slope gently here and there).
   ==================================================================================================== */

const T = 0.3; // tile module
let TEX = null;
const tex = () => (TEX ||= {
  line: canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#d9a91f'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) { const x = 6 + k * 14.5; g.fillStyle = '#b58a12'; g.fillRect(x + 2, 4, 7, h - 8); g.fillStyle = '#f2c63c'; g.fillRect(x, 3, 7, h - 9); }
    g.strokeStyle = 'rgba(90,64,10,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  }),
  dots: canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#d9a91f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = 8 + i * 12, y = 8 + j * 12; g.fillStyle = '#b58a12'; g.beginPath(); g.arc(x + 1, y + 1.2, 3.6, 0, 7); g.fill(); g.fillStyle = '#f2c63c'; g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(90,64,10,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  }),
});

/* ---------------------------------------------------------------- what stands on the sidewalks (from the scene) */
function obstacles(root) {
  root.updateMatrixWorld(true);
  const C = 2, cells = new Map(), box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
    const geo = o.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
    box.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
    const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
    if (sx * sz > 30 || box.max.y - box.min.y < 0.05) return; // ground, kerbs, merged shells; flat paint / decals
    const who = []; for (let q = o; q && who.length < 4; q = q.parent) if (q.name) who.push(q.name);
    const b = [box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z, who.join('<') || o.geometry.type];
    for (let i = Math.floor(b[0] / C); i <= Math.floor(b[1] / C); i++) for (let j = Math.floor(b[4] / C); j <= Math.floor(b[5] / C); j++) {
      const k = i * 1000 + j; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(b);
    }
  });
  // anything in the box x0..x1, z0..z1 between y0 and y1?
  const fn = (x0, x1, z0, z1, y0, y1) => {
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const l = cells.get(i * 1000 + j); if (!l) continue;
      for (const b of l) if (b[0] < x1 && b[1] > x0 && b[4] < z1 && b[5] > z0 && b[2] < y1 && b[3] > y0) return b[6]; // what stands there
    }
    return false;
  };
  // (debug) every box round x, z
  fn.probe = (x, z, r = 0.5) => { const out = new Set(); for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) (cells.get(i * 1000 + j) || []).forEach((b) => { if (b[0] < x + r && b[1] > x - r && b[4] < z + r && b[5] > z - r) out.add(b.map((v) => (typeof v === 'number' ? +v.toFixed(2) : v)).join(' ')); }); return [...out]; };
  return fn;
}

/* ---------------------------------------------------------------- the plan
   kerbs: a = the road's axis ('x': the kerb runs along x at z = k), s = the side the walk lies on (+1 / -1) */
const KERB = {
  kgN: { a: 'x', k: 6.5, s: -1 }, kgS: { a: 'x', k: 12, s: 1 }, // Kaigan-dori
  hzW: { a: 'z', k: 7.5, s: -1 }, hzE: { a: 'z', k: 12, s: 1 }, // Hoshizora-dori
  kitaS: { a: 'x', k: -12, s: 1 }, // Kita-dori, south side
  urW: { a: 'z', k: -16.5, s: -1 }, urE: { a: 'z', k: -13.5, s: 1 }, // 裏路地
};
// a point d in from kerb `id`, at t along it
const at = (id, t, d) => { const K = KERB[id]; return K.a === 'x' ? [t, K.k + K.s * d] : [K.k + K.s * d, t]; };

// guide lines: kerb, from / to along it, distance in from the kerb (tile centre), what each end does
// ('dot': a warning block - a side street or a plain end; 'join': it meets another line there - one warning block)
const LINES = [
  { kerb: 'kgN', t: [-23.55, -17.25], d: 0.75, ends: ['dot', 'dot'] }, // 青空雑貨店's corner, short of the posts at the 裏路地 kerb
  { kerb: 'kgN', t: [-4.55, 6.53], d: 0.38, ends: ['dot', 'join'] }, // LAWSON's narrow front walk: from the pylon sign over the car park's mouth to the corner
  { kerb: 'kgN', t: [13.0, 29.85], d: 1.3, ends: ['join', 'dot'] }, // しずく花店, to Higashi lane
  { kerb: 'kgS', t: [-46.2, -16.65], d: 0.85, ends: ['dot', 'dot'] }, // the street-house row
  { kerb: 'kgS', t: [-12.55, 6.75], d: 0.75, ends: ['dot', 'join'] }, // the coffee shop + bookstore (from the curve mirror)
  { kerb: 'kgS', t: [12.75, 29.85], d: 0.75, ends: ['join', 'dot'] }, // 星野邸's wall
  { kerb: 'hzW', t: [-6.75, 6.12], d: 0.97, ends: ['dot', 'join'] }, // LAWSON's east walk, from the back-yard wall that closes it
  { kerb: 'hzW', t: [12.75, 22.2], d: 0.75, ends: ['join', 'dot'] }, // up to the sakura plaza (its trees stand at the kerb)
  { kerb: 'hzE', t: [-11.85, 5.2], d: 1.0, ends: ['dot', 'join'] }, // しずく花店's side walk
  { kerb: 'hzE', t: [12.75, 26.95], d: 0.75, ends: ['join', 'dot'] }, // 星野邸's west wall, to the plaza crossing
];
// zebra landings: the kerb, the crossing's middle along it, its width; `line`: the guide line it branches from (index)
const LANDINGS = [
  { kerb: 'kgN', t: 6.45, w: 1.6, line: 1 }, { kerb: 'kgS', t: 6.0, w: 1.6, line: 4 }, // across Kaigan-dori by LAWSON
  { kerb: 'hzW', t: 4.9, w: 1.6, line: 6 }, { kerb: 'hzE', t: 5.4, w: 1.6, line: 8 }, // across Hoshizora-dori, north of the corner
  { kerb: 'hzW', t: 13.5, w: 1.8, line: 7 }, { kerb: 'hzE', t: 13.5, w: 1.8, line: 9 }, // ... south of the corner
  { kerb: 'hzW', t: 26.5, w: 1.8, line: null }, { kerb: 'hzE', t: 26.5, w: 1.8, line: 9 }, // the plaza crossing
  { kerb: 'urE', t: 26.5, w: 1.8, line: null }, { kerb: 'urW', t: 26.5, w: 1.5, line: null }, // across 裏路地 from the plaza
  { kerb: 'kgN', t: -18.3, w: 1.8, line: 0 }, { kerb: 'kgS', t: -18.3, w: 1.8, line: 3 }, // by 青空雑貨店
  { kerb: 'kgN', t: 28.3, w: 1.8, line: 2 }, { kerb: 'kgS', t: 28.3, w: 1.8, line: 5 }, // by しずく花店's house
  { kerb: 'kitaS', t: 6.6, w: 1.5, line: null }, { kerb: 'kitaS', t: 13.2, w: 1.8, line: 8 }, // across Kita-dori either side of R1
];
// sidewalk fences: kerb, from / to (gaps at crossings, side streets, driveways are left out here; poles etc. found below)
const FENCES = [
  { kerb: 'kgN', t: [0.85, 4.95] }, { kerb: 'hzW', t: [-3.0, 4.35] }, // LAWSON's corner (the car park's mouth stays open)
  { kerb: 'kgN', t: [12.9, 20.5] }, { kerb: 'hzE', t: [-4.5, 4.35] }, // しずく花店's corner
  { kerb: 'kgS', t: [-1.5, 4.95] }, { kerb: 'hzW', t: [14.65, 21.0] }, // the coffee shop's corner
  { kerb: 'kgS', t: [12.6, 19.5] }, { kerb: 'hzE', t: [14.65, 25.35] }, { kerb: 'hzE', t: [27.65, 31.2] }, // 星野邸's corner + the plaza crossing
  { kerb: 'kgN', t: [-23.5, -19.45] }, // by 青空雑貨店, up to its crossing
  // the street-house row's backs along Kaigan-dori (gaps for the parking corner, the passages, the crossing)
  { kerb: 'kgS', t: [-47.4, -43.2] }, { kerb: 'kgS', t: [-41.4, -36.1] }, { kerb: 'kgS', t: [-35.3, -29.2] }, { kerb: 'kgS', t: [-26.4, -19.45] },
  { kerb: 'kgN', t: [23.0, 27.15] }, { kerb: 'kgS', t: [22.5, 27.15] }, // the crossing by しずく花店's house
];
// the station: in from the forecourt's edge (past the sign at the kerb), south of the entrance canopy's post, a turn,
// then a row of warning blocks along the foot of the steps (x 13.6 .. 16, from z -27.9)
const STATION_PATH = { z: -28.5, x0: 13.05, x1: 14.25, turn: 14.55, zSteps: -28.2, steps: [14.55, 15.75] };

/* ---------------------------------------------------------------- tactile paving */
function buildTactile(parent, blocked, log) {
  const tiles = { line: [], dots: [] }; // [x, z, yaw]
  const taken = [];
  const free = (x, z) => !taken.some(([a, b]) => Math.abs(a - x) < 0.2 && Math.abs(b - z) < 0.2);
  const put = (kind, x, z, yaw = 0) => {
    if (!free(x, z)) return;
    const y = groundY(x, z);
    const hit = blocked(x - 0.13, x + 0.13, z - 0.13, z + 0.13, y + 0.03, y + 1.7);
    if (hit) { log.push(`tactile ${kind} ${x.toFixed(2)},${z.toFixed(2)} (${hit})`); return; }
    taken.push([x, z]); tiles[kind].push([x, z, yaw]);
  };
  const yawOf = (id) => (KERB[id].a === 'x' ? Math.PI / 2 : 0); // the bars run with the walk
  // a pad of warning blocks: n tiles along the kerb centred on t, rows from d0 inwards
  const pad = (id, t, n, d0, rows) => { for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const [x, z] = at(id, t + (i - (n - 1) / 2) * T, d0 + r * T); put('dots', x, z); } };

  // 1. warning blocks first (they win where they meet a line): zebra landings, ends, joins
  LANDINGS.forEach((L) => {
    const n = Math.max(2, Math.round(L.w / T) - 2), ln = L.line != null ? LINES[L.line] : null;
    const d = ln ? ln.d : 0.75;
    if (d <= 0.9) pad(L.kerb, L.t, n, 0.15, Math.round((d - 0.15) / T) + 1); // the line runs close to the kerb: one pad out to it
    else {
      pad(L.kerb, L.t, n, 0.15, 2); // two rows at the kerb, a branch of guide blocks in to the line, a warning block on it
      const K = KERB[L.kerb];
      for (let dd = 0.15 + 2 * T; dd < d - T / 2; dd += T) { const [x, z] = at(L.kerb, L.t, dd); put('line', x, z, K.a === 'x' ? 0 : Math.PI / 2); }
      const [x, z] = at(L.kerb, L.t, d); put('dots', x, z);
    }
  });
  LINES.forEach((ln) => ln.ends.forEach((e, i) => { const [x, z] = at(ln.kerb, ln.t[i], ln.d); put('dots', x, z); if (e === 'dot') { const [x2, z2] = at(ln.kerb, ln.t[i] + (i ? -T : T), ln.d); put('dots', x2, z2); } }));
  // 2. the guide lines
  LINES.forEach((ln) => {
    const [t0, t1] = ln.t, n = Math.round((t1 - t0) / T);
    for (let i = 0; i <= n; i++) { const [x, z] = at(ln.kerb, t0 + ((t1 - t0) * i) / n, ln.d); put('line', x, z, yawOf(ln.kerb)); }
  });
  // 3. the station's path
  {
    const P = STATION_PATH;
    put('dots', P.x0, P.z); put('dots', P.turn, P.z);
    for (let x = P.steps[0]; x <= P.steps[1] + 0.01; x += T) put('dots', x, P.zSteps);
    for (let x = P.x0 + T; x <= P.x1 + 0.01; x += T) put('line', x, P.z, Math.PI / 2);
  }

  const g = grp(parent); g.name = 'TactilePaving';
  const unit = new THREE.BoxGeometry(T - 0.012, 0.014, T - 0.012), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  Object.entries(tiles).forEach(([kind, list]) => {
    if (!list.length) return;
    const geo = mergeGeometries(list.map(([x, z, yaw]) => unit.clone().applyMatrix4(m4.compose(new THREE.Vector3(x, groundY(x, z) + 0.007, z), q.setFromAxisAngle(up, yaw), new THREE.Vector3(1, 1, 1)))));
    const mesh = new THREE.Mesh(geo, toon('#ffffff', { map: tex()[kind], nocache: true }));
    mesh.receiveShadow = true; mesh.userData.noLine = true; mesh.userData.keep = true; mesh.name = `Tactile_${kind}`;
    g.add(mesh);
  });
  return { lines: tiles.line.length, dots: tiles.dots.length };
}

/* ---------------------------------------------------------------- sidewalk fences (横断防止柵) */
let FM = null;
const fenceMats = () => (FM ||= { white: toon('#eef0f1'), bar: toon('#e6e9eb'), cap: toon('#c9cdd1') });
/** one straight fence from (x0, z0) to (x1, z1): posts every ~2 m, a top + bottom rail, vertical bars */
export function sidewalkFence(parent, x0, z0, x1, z1) {
  const m = fenceMats(), g = grp(parent), L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2)), H = 0.78;
  const P = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; return [x, groundY(x, z), z]; });
  P.forEach(([x, y, z]) => { cy(g, m.white, x, y, z, 0.03, H + 0.02, 8); cy(g, m.cap, x, y + H + 0.02, z, 0.036, 0.025, 8, { cast: false }); });
  for (let i = 0; i < n; i++) {
    const [ax, ay, az] = P[i], [bx, by, bz] = P[i + 1];
    cyl2(g, m.white, [ax, ay + H - 0.02, az], [bx, by + H - 0.02, bz], 0.022, 8);
    cyl2(g, m.white, [ax, ay + 0.14, az], [bx, by + 0.14, bz], 0.016, 6, { cast: false });
    const k = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.14));
    for (let j = 1; j < k; j++) { const t = j / k, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t; cyl2(g, m.bar, [x, y + 0.15, z], [x, y + H - 0.03, z], 0.0095, 5, { noLine: true }); }
  }
  return g;
}

function buildFences(parent, blocked, log) {
  const g = grp(parent); g.name = 'SidewalkFences';
  let runs = 0;
  FENCES.forEach((f) => {
    const [t0, t1] = f.t, step = 0.1, open = [];
    // the kerbside clear of poles, lamps, signs, trees, bins: break the run ±0.25 round them
    for (let t = t0; t <= t1 + 1e-6; t += step) {
      const [x, z] = at(f.kerb, t, 0.25), y = groundY(x, z);
      const hit = blocked(x - 0.12, x + 0.12, z - 0.12, z + 0.12, y + 0.05, y + 0.85);
      if (hit && !open.length || hit && open[open.length - 1]) log.push(`fence ${f.kerb} @${t.toFixed(1)}: ${hit}`);
      open.push(!hit);
    }
    const ok = open.map((_, i) => open.slice(Math.max(0, i - 3), i + 4).every(Boolean));
    let s = null;
    ok.concat([false]).forEach((v, i) => {
      if (v && s === null) s = i;
      if (!v && s !== null) {
        const a = t0 + s * step, b = t0 + (i - 1) * step;
        if (b - a >= 1.2) { const [x0, z0] = at(f.kerb, a, 0.25), [x1, z1] = at(f.kerb, b, 0.25); sidewalkFence(g, x0, z0, x1, z1); runs++; }
        else log.push(`fence piece dropped ${f.kerb} ${a.toFixed(1)}..${b.toFixed(1)}`);
        s = null;
      }
    });
    if (ok.some((v) => !v)) log.push(`fence ${f.kerb} ${t0}..${t1}: broken round something at the kerb`);
  });
  return runs;
}

/* ---------------------------------------------------------------- guard rails (ガードレール: W-beam) */
let BEAM = null;
const beamGeo = () => {
  if (BEAM) return BEAM;
  // the W profile (out from the posts, up), a thin plate, extruded 1 m along +z (scaled per span)
  const p = [[0, 0.175], [0.035, 0.16], [0.07, 0.09], [0.03, 0.0], [0.07, -0.09], [0.035, -0.16], [0, -0.175]], th = 0.012;
  const sh = new THREE.Shape(); p.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  [...p].reverse().forEach(([x, y]) => sh.lineTo(x - th, y)); sh.closePath();
  BEAM = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, steps: 1 });
  return BEAM;
};
/**
 * a W-beam guard rail from (x0, z0) to (x1, z1); the beam hangs on the side `side` points to (a world direction
 * [x, z]: towards the road); y0: an optional fixed ground height (else groundY), ends flared back towards the posts
 */
export function guardRailW(parent, x0, z0, x1, z1, side, y0 = null) {
  const m = fenceMats(), g = grp(parent), L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2));
  const tx = (x1 - x0) / L, tz = (z1 - z0) / L;
  let nx = -tz, nz = tx; if (nx * side[0] + nz * side[1] < 0) { nx = -nx; nz = -nz; }
  const gy = (x, z) => (y0 ?? groundY(x, z));
  const P = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; return [x, gy(x, z), z]; });
  P.forEach(([x, y, z]) => { cy(g, m.white, x, y - 0.1, z, 0.048, 0.85, 10); cy(g, m.cap, x, y + 0.75, z, 0.052, 0.025, 10, { cast: false }); cyl2(g, m.cap, [x, y + 0.6, z], [x + nx * 0.07, y + 0.6, z + nz * 0.07], 0.025, 6, { cast: false }); });
  const span = (a, b, out) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    const mesh = new THREE.Mesh(beamGeo(), m.white);
    const zA = d.clone().normalize(), xA = new THREE.Vector3(nx, 0, nz).sub(zA.clone().multiplyScalar(nx * zA.x + nz * zA.z)).normalize(), yA = new THREE.Vector3().crossVectors(zA, xA);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.makeBasis(xA, yA, zA).scale(new THREE.Vector3(1, 1, len)).setPosition(a[0] + nx * out, a[1] + 0.6, a[2] + nz * out);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  };
  for (let i = 0; i < n; i++) span(P[i], P[i + 1], 0.075);
  // the ends: a short piece angled back to the post line
  const e0 = P[0], e1 = P[n];
  span([e0[0] - tx * 0.35 - nx * 0.06, e0[1], e0[2] - tz * 0.35 - nz * 0.06], [e0[0], e0[1], e0[2]], 0.075);
  span([e1[0], e1[1], e1[2]], [e1[0] + tx * 0.35 - nx * 0.06, e1[1], e1[2] + tz * 0.35 - nz * 0.06], 0.075);
  return g;
}

/* ---------------------------------------------------------------- build */
export function buildRoadside(parent) {
  const blocked = obstacles(parent), log = [];
  const g = grp(parent); g.name = 'Roadside';
  const tactile = buildTactile(g, blocked, log);
  const fences = buildFences(g, blocked, log);
  reg.roadside = { tactile, fences, log, probe: blocked.probe };
  const clash = log.filter((l) => l.startsWith('tactile')); // a fence breaking round a pole is expected; a block that can't be laid is not
  if (clash.length) console.warn('roadside: tactile blocks left out:', clash.join(' | '));
  return reg.roadside;
}
