/* ====================================================================================================
   Town layout: the ONE source of truth for the expanded map (all world units, 1 unit ≈ 1 m).

   The original 24 x 24 diorama (x,z in [-12, 12]) stays exactly where it is; the town grows around it.
   Roads are simply the ground between blocks (the road layer covers the whole map at y≈0); blocks are
   raised slabs with their own (gently varying) height, kerbs and stone retaining walls.

        z -44 ┌──────────── lake park ───┬ lane ┬──── shrine terrace (+2.05) ─┬ R1 ┬ station (+0.3) ─┐
              │                          │      │                             │    │      ╲ rail    │
        z -23 ├──────── rail corridor (single track, Enoden style) ───────────┼────┼───────╯        │
        z -15 ├──────────────────────────── Kita-dori ────────────────────────┼────┼────────────────┤
        z -12 │ west residential (slope)  │ R7 │ … │ R4 │   ORIGINAL BOARD    │ R1 │ east shops │R5 │
        z 6.5 ├────────────────────────── Kaigan-dori (main) ─────────────────┼────┼────────────────┤
        z  12 │ south-west residential (lane R6)   │ R4 │ south block         │ R1 │ south-east │R5 │
        z  32 └───────────────────────────────────────────────────────────────┴────┴────────────────┘
   ==================================================================================================== */

export const MAP = { x0: -48, x1: 36, z0: -44, z1: 32 };
/** the original board (its own road plane + plot + plinth top); the town never paints inside it */
export const OLD = { x0: -12, x1: 12, z0: -12, z1: 12 };
export const PAV = 0.15; // pavement / plot top
export const WATER_Y = -0.35;

/** irregular plinth outline (chamfered corners) */
export const OUTLINE = [[-48, -44], [30, -44], [36, -38], [36, 26], [30, 32], [-40, 32], [-48, 24]];

/* ---------------------------------------------------------------- roads (for painting + furniture) */
// straight roads: rectangles. kind: main (two lanes, centre line) | street (narrow two-way) | lane (narrow, no lines)
export const ROADS = {
  hoshizora: { kind: 'main', x0: 7.5, x1: 12, z0: -44, z1: 32, axis: 'z' }, // R1 (one lane each way, keep left)
  kaigan: { kind: 'main', x0: -48, x1: 36, z0: 6.5, z1: 12, axis: 'x' }, // R2
  kita: { kind: 'street', x0: -48, x1: 36, z0: -15, z1: -12, axis: 'x' }, // R3
  uraroji: { kind: 'lane', x0: -16.5, x1: -13.5, z0: -15, z1: 32, axis: 'z' }, // R4 (south of Kita-dori)
  higashi: { kind: 'lane', x0: 30, x1: 33, z0: -12, z1: 32, axis: 'z' }, // R5
};
// bending lanes: centre polylines (width 3)
export const LANES = {
  lakeLane: [[-15, -15], [-15, -23.5], [-16.5, -29], [-17.5, -36], [-17.5, -44]], // R4 north: over the crossing, down along the lake
  westLane: [[-31, 6.5], [-32, -3], [-30.5, -12]], // R7
  swLane: [[-16.5, 23.5], [-30, 24.5], [-40, 22.5], [-48, 23]], // R6
};
export const LANE_W = 3;

/* ---------------------------------------------------------------- blocks */
// poly: x,z ring. h(x,z): top height. wall: 'kerb' | 'stone' (retaining wall look when tall). surf: ground paint style
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const LAKE = { cx: -32.5, cz: -33.5, rx: 10.5, rz: 6.8 };
/** normalised lake distance: ≈1 on the shoreline, <1 water, >1 land */
export function lakeF(x, z) {
  const dx = (x - LAKE.cx) / LAKE.rx, dz = (z - LAKE.cz) / LAKE.rz;
  const a = Math.atan2(dz, dx);
  const rr = 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1);
  return Math.hypot(dx, dz) / rr;
}
/** lake park ground: rim at pavement level, gentle banks down to a bed below the water */
export function lakeParkH(x, z) {
  const f = lakeF(x, z);
  const bump = 0.05 * Math.sin(x * 0.7 + 1.1) * Math.sin(z * 0.9 + 0.3) * smooth(1.05, 1.3, f);
  return PAV - 0.5 * (1 - smooth(0.95, 1.45, f)) - 0.6 * (1 - smooth(0.55, 1.02, f)) + bump;
}

export const BLOCKS = [
  { id: 'lakePark', zone: 'D', poly: [[-48, -44], [-19, -44], [-19, -36], [-18, -29], [-16.6, -24.5], [-16.5, -23], [-48, -23]], h: lakeParkH, surf: 'park' },
  { id: 'terrace', zone: 'shrine', poly: [[-16, -44], [7.5, -44], [7.5, -23], [-13.5, -23], [-13.6, -24.5], [-15, -29], [-16, -36]], h: () => 2.2, surf: 'forest', wall: 'stone' },
  { id: 'station', zone: 'F', poly: [[12, -44], [29, -44], [29, -30], [27, -25.5], [23, -23], [12, -23]], h: () => 0.45, surf: 'plaza', wall: 'stone' },
  { id: 'corrW', zone: 'E', poly: [[-48, -23], [-16.5, -23], [-16.5, -15], [-48, -15]], h: () => PAV, surf: 'verge' },
  { id: 'corrM', zone: 'E', poly: [[-13.5, -23], [7.5, -23], [7.5, -15], [-13.5, -15]], h: () => PAV, surf: 'verge' },
  { id: 'corrE', zone: 'E', poly: [[12, -23], [23, -23], [27, -25.5], [29, -30], [29, -44], [36, -44], [36, -15], [12, -15]], h: () => PAV, surf: 'verge' },
  { id: 'west1', zone: 'B', poly: [[-48, -12], [-32, -12], [-33.5, -3], [-32.5, 6.5], [-48, 6.5]], h: (x, z) => PAV + 0.85 * smooth(4, -10, z), surf: 'lots', wall: 'stone' },
  { id: 'west2', zone: 'B', poly: [[-29, -12], [-16.5, -12], [-16.5, 6.5], [-29.5, 6.5], [-30.5, -3]], h: (x, z) => PAV + 0.7 * smooth(4, -10, z), surf: 'lots', wall: 'stone' },
  { id: 'west3', zone: 'A', poly: [[-13.5, -12], [-12, -12], [-12, 6.5], [-13.5, 6.5]], h: () => PAV, surf: 'walk' },
  { id: 'eastShops', zone: 'A', poly: [[12, -12], [30, -12], [30, 6.5], [12, 6.5]], h: (x, z) => PAV + 0.22 * smooth(3, -11, z), surf: 'shops' },
  { id: 'east1', zone: 'A', poly: [[33, -12], [36, -12], [36, 6.5], [33, 6.5]], h: () => PAV, surf: 'verge' },
  { id: 'sw1', zone: 'B', poly: [[-48, 12], [-16.5, 12], [-16.5, 22], [-30, 23], [-40, 21], [-48, 21.5]], h: (x, z) => PAV + 0.3 * (1 - smooth(13, 22, z)), surf: 'lots' },
  { id: 'sw2', zone: 'B', poly: [[-48, 24.5], [-40, 24], [-30, 26], [-16.5, 25], [-16.5, 32], [-48, 32]], h: () => PAV, surf: 'lots' },
  { id: 'south', zone: 'C', poly: [[-13.5, 12], [7.5, 12], [7.5, 32], [-13.5, 32]], h: (x, z) => PAV + 0.32 * (1 - smooth(13, 30, z)), surf: 'shops' },
  { id: 'southEast', zone: 'A', poly: [[12, 12], [30, 12], [30, 32], [12, 32]], h: (x, z) => PAV + 0.25 * (1 - smooth(13, 30, z)), surf: 'shops' },
  { id: 'east2', zone: 'A', poly: [[33, 12], [36, 12], [36, 32], [33, 32]], h: () => PAV, surf: 'verge' },
];

/* ---------------------------------------------------------------- railway (single track) */
// straight along the corridor, then a R=10 curve north past the station, out at the north-east corner
export const RAIL = { z: -19.25, x0: -48, xCurve: 22, R: 10, xNorth: 32, zEnd: -41.7, gauge: 1.067 };
export const CROSSINGS = [
  { id: 'lane', x: -15, road: 'lakeLane', x0: -16.5, x1: -13.5, kind: 'road' },
  { id: 'sando', x: -10.1, x0: -10.8, x1: -9.4, kind: 'foot' },
  { id: 'main', x: 9.75, road: 'hoshizora', x0: 7.5, x1: 12, kind: 'road' },
];
export const PLATFORM = { x0: 12.6, x1: 21.5, z0: -21.7, z1: -20.5 };
/** sampled track centreline: [{x,z,dx,dz,s}] every `step` units, from west to the north-east */
export function railSamples(step = 0.5) {
  const out = [];
  const push = (x, z, dx, dz) => { const p = out[out.length - 1]; const s = p ? p.s + Math.hypot(x - p.x, z - p.z) : 0; out.push({ x, z, dx, dz, s }); };
  for (let x = RAIL.x0; x < RAIL.xCurve; x += step) push(x, RAIL.z, 1, 0);
  const cx = RAIL.xCurve, cz = RAIL.z - RAIL.R;
  const n = Math.ceil((Math.PI / 2) * RAIL.R / step);
  for (let i = 0; i < n; i++) { const p = (i / n) * Math.PI / 2; push(cx + RAIL.R * Math.sin(p), cz + RAIL.R * Math.cos(p), Math.cos(p), -Math.sin(p)); }
  for (let z = cz; z >= RAIL.zEnd; z -= step) push(RAIL.xNorth, z, 0, -1);
  return out;
}
/** distance along the straight to the nearest level crossing (for the embankment) */
export function crossingDist(x, z) {
  if (Math.abs(z - RAIL.z) > 0.01 || x > RAIL.xCurve) return 99;
  return Math.min(...CROSSINGS.map((c) => Math.abs(x - c.x)));
}
/** rail head height along the track: low at crossings, on a ~0.4 m embankment between them */
export function railTop(x, z) {
  const d = crossingDist(x, z);
  const e = 0.38 * smooth(4, 10, d);
  const w = smooth(2.2, 5.5, d);
  return 0.21 + (0.24 + e) * w;
}

/* ---------------------------------------------------------------- road height (y of the road layer) */
const distSeg = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz;
  let t = L ? ((px - ax) * vx + (pz - az) * vz) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
};
export function distPolyline(px, pz, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}
export function roadH(x, z) {
  let y = 0;
  // humped level crossings: the road rises to the rail head
  if (Math.abs(z - RAIL.z) < 5 && ((x > 7.2 && x < 12.3) || (x > -16.8 && x < -13.2))) y = Math.max(y, 0.2 * (1 - smooth(1.6, 4.6, Math.abs(z - RAIL.z))));
  // the lake lane runs gently downhill towards the water
  if (x < -13 && z < -22.5 && distPolyline(x, z, LANES.lakeLane) < 2.2) y = Math.min(y, -0.22 * smooth(-24, -31, z));
  return y;
}

/* ---------------------------------------------------------------- geometry helpers */
export function inPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export const inOld = (x, z) => x > OLD.x0 && x < OLD.x1 && z > OLD.z0 && z < OLD.z1;
const OLD_PLOT = { x0: -12, x1: 7.5, z0: -12, z1: 6.5 };
export function blockAt(x, z) {
  for (const b of BLOCKS) if (inPoly(x, z, b.poly)) return b;
  return null;
}
/** top-most walkable ground at (x,z): blocks, the original plot, or the road */
export function groundY(x, z) {
  if (inOld(x, z)) return x >= OLD_PLOT.x0 && x <= OLD_PLOT.x1 && z >= OLD_PLOT.z0 && z <= OLD_PLOT.z1 ? PAV : 0;
  const b = blockAt(x, z);
  return b ? b.h(x, z) : roadH(x, z);
}
export const insideMap = (x, z) => inPoly(x, z, OUTLINE);

/* ---------------------------------------------------------------- reserved land for future buildings
   (data only: nothing is drawn. Each plot touches a road through `front`.) */
export const PLOTS = [
  { id: 'A-shop-1', type: 'shop', block: 'eastShops', rect: [13, 25, -11.5, -7.2], front: 'hoshizora' },
  // plot 4: しずく花店 + the florist's house (built: town/florist.js)
  { id: 'A-shop-2', type: 'florist', block: 'eastShops', rect: [12.6, 25.2, -6.0, 6.0], front: 'kaigan' },
  { id: 'A-cafe-1', type: 'cafe', block: 'eastShops', rect: [26.2, 29.6, -10.5, -2], front: 'kita' },
  { id: 'A-shop-3', type: 'shop', block: 'eastShops', rect: [26.2, 29.6, -0.5, 5], front: 'kaigan' },
  { id: 'A-shop-4', type: 'shop', block: 'southEast', rect: [13, 20, 13.5, 20], front: 'kaigan' },
  { id: 'A-cafe-2', type: 'cafe', block: 'southEast', rect: [21.5, 29, 13.5, 20], front: 'kaigan' },
  { id: 'A-house-1', type: 'house', block: 'southEast', rect: [13, 29, 23, 30], front: 'hoshizora' },
  { id: 'B-house-1', type: 'house', block: 'west1', rect: [-46, -40, -10.5, -4.5], front: 'kita' },
  { id: 'B-house-2', type: 'house', block: 'west1', rect: [-39, -34.5, -10.5, -4.5], front: 'westLane' },
  { id: 'B-house-3', type: 'house', block: 'west1', rect: [-46, -40, -2, 4.5], front: 'kaigan' },
  { id: 'B-house-4', type: 'house', block: 'west1', rect: [-39, -34.5, -2, 4.5], front: 'westLane' },
  { id: 'B-house-5', type: 'house', block: 'west2', rect: [-28, -23, -10.5, -4.5], front: 'kita' },
  { id: 'B-house-6', type: 'house', block: 'west2', rect: [-22, -18, -10.5, -4.5], front: 'uraroji' },
  { id: 'B-house-7', type: 'house', block: 'west2', rect: [-28.5, -23, -2, 4.5], front: 'westLane' },
  { id: 'B-shop-1', type: 'shop', block: 'west2', rect: [-22, -18, -2, 4.5], front: 'kaigan' },
  { id: 'B-house-8', type: 'house', block: 'sw1', rect: [-46, -40, 13.5, 19.5], front: 'kaigan' },
  { id: 'B-house-9', type: 'house', block: 'sw1', rect: [-38, -32, 13.5, 20], front: 'kaigan' },
  { id: 'B-house-10', type: 'house', block: 'sw1', rect: [-28, -22, 13.5, 20.5], front: 'kaigan' },
  { id: 'B-house-11', type: 'house', block: 'sw2', rect: [-44, -38, 26, 30.5], front: 'swLane' },
  { id: 'B-house-12', type: 'house', block: 'sw2', rect: [-35, -29, 27.5, 31], front: 'swLane' },
  { id: 'B-house-13', type: 'house', block: 'sw2', rect: [-26, -19, 27, 31], front: 'swLane' },
  { id: 'C-cafe-1', type: 'cafe', block: 'south', rect: [-11.5, -4, 13.5, 20], front: 'kaigan' },
  { id: 'C-shop-1', type: 'shop', block: 'south', rect: [-2.5, 5.5, 13.5, 20], front: 'kaigan' },
  { id: 'C-plaza', type: 'public', block: 'south', rect: [-11.5, 5.5, 22.5, 30], front: 'uraroji' },
  { id: 'D-lakeside', type: 'lakeside', block: 'lakePark', rect: [-24, -20, -27.5, -24], front: 'lakeLane' },
  { id: 'D-boathouse', type: 'lakeside', block: 'lakePark', rect: [-46.5, -42, -30, -25], front: 'kita' },
  { id: 'F-station', type: 'station', block: 'station', rect: [13, 21, -28, -23.5], front: 'hoshizora' },
  { id: 'F-shrine', type: 'shrine', block: 'terrace', rect: [-8, 0, -38.5, -31], front: 'stairs' },
];
