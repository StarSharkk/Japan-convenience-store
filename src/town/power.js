import * as THREE from 'three';
import { grp } from '../core.js';
import { utilityPole, wire } from '../street.js';
import { groundY, WEST_HOMES, STATION } from './layout.js';
import { IZA_AWAY } from '../site.js';
import { ROW } from './streetRow.js';

/* ====================================================================================================
   The town's overhead power + phone lines, planned as one network (they used to be added street by street).

     poles     about two per block, on one side of each street only (the north side of Kaigan-dori, the south side
               of Kita-dori, the lanes' outer verges), clear of shop fronts, signs, doors and crossings; empty lots
               get none. A transformer only on the poles that feed buildings.
     spans     three conductors on the top cross-arm + one communication cable below; the cross-arms turn across
               the line (at a corner: across the bisector), the conductors keep their order from pole to pole. A
               line crosses a road only to carry on (over Hoshizora-dori at the LAWSON corner, over Kaigan-dori to
               the south block and to the east verge).
     drops     one short service drop per building, from the nearest pole's lower arm to a roof edge / wall top
               (the street-house row is fed across Kaigan-dori, so its own side of the road stays clear).
   ==================================================================================================== */

const H = 7.4; // pole height above its ground
const POLES = {
  // Kaigan-dori, north side (west -> east), across Hoshizora-dori, on to the east verge
  A1: [-38.0, 6.05, true], // 西の住宅地 + the street-house row's west half
  A2: [-23.4, 6.05, true], // in the gap between the izakaya and the corner store; feeds both + the row's east half
  A3: [-13.25, 6.05, true], // the bakery; the line turns south over Kaigan-dori to the south block
  A4: [7.0, 4.3, true], // the LAWSON corner
  A5: [13.0, 6.05, false],
  A6: [23.2, 6.05, true], // the florist's house
  A7: [33.4, 4.6, false], // the east verge; the line crosses Kaigan-dori
  B1: [33.4, 14.0, true], // the villa (across the lane)
  B2: [33.4, 25.0, false],
  // the south block's lane (uraroji, west verge)
  S1: [-13.1, 14.0, true], // the café
  S2: [-13.1, 21.0, false],
  // Kita-dori, south side of the west blocks
  K1: [-40.0, -11.7, true], // 西の住宅地: the north pair
  K2: [-24.0, -11.7, false],
  // the station forecourt
  ST: [12.55, -29.6, true], // clear of the forecourt's street trees
};
const SPANS = [['A1', 'A2'], ['A2', 'A3'], ['A3', 'A4', 1.0], ['A4', 'A5'], ['A5', 'A6'], ['A6', 'A7'], ['A7', 'B1'], ['B1', 'B2'], ['A3', 'S1'], ['S1', 'S2'], ['K1', 'K2']];
// service drops: pole -> a point on the building (roof edge / wall top)
const ZB = ROW.zb, TOPR = 0.45 + 3.0 + 2.7, { yS: YS, yN: YN } = WEST_HOMES;
const DROPS = [
  ['A1', [-42.2, YS + 3.75, 3.0]], ['A1', [-35.75, YS + 3.75, 3.2]], // 西の住宅地: houses 3 + 4
  ['A1', [-39.5, TOPR - 0.1, ZB]], ['A1', [-33.0, TOPR + 0.2, ZB]], // the street-house row: D, C (across the road)
  ['A2', [-27.0, TOPR + 0.3, ZB]], ['A2', [-21.0, TOPR + 0.2, ZB]], // B, A
  ...(IZA_AWAY ? [['A2', [-10.0 + IZA_AWAY.dx, 6.5, 4.3]]] : []), // the izakaya's front gable
  ['A2', [-23.0, 5.9, 2.8]], // the corner store's roof slab
  ['A3', [-12.1, 4.15, 0.95]], // the bakery's parapet
  ['A4', [4.6, 3.75, 0.6]], // the LAWSON roof (east edge)
  ['A6', [24.75, 5.1, 1.06]], // the florist's house
  ['B1', [29.25, 2.3, 16.5]], // the villa's east wall
  ['S1', [-11.45, 3.65, 15.0]], // the café's west wall top
  ['K1', [-44.0, YN + 3.4, -9.4]], ['K1', [-37.2, YN + 4.1, -9.4]], // 西の住宅地: houses 1 + 2 (their backs)
  ['ST', [STATION.bx0 + 0.3, STATION.floor + 3.9, STATION.bz0 - 0.3]], // the station's front eave
];

export function buildPower(parent) {
  const g = grp(parent);
  g.name = 'PowerLines';
  // each pole's cross-arm direction: across its line (the bisector where two spans meet)
  const dirs = {};
  Object.keys(POLES).forEach((id) => { dirs[id] = new THREE.Vector2(); });
  SPANS.forEach(([a, b]) => { const d = new THREE.Vector2(POLES[b][0] - POLES[a][0], POLES[b][1] - POLES[a][1]).normalize(); [a, b].forEach((id) => { const cur = dirs[id]; if (cur.lengthSq() && cur.dot(d) < 0) cur.sub(d); else cur.add(d); }); });
  const P = {};
  Object.entries(POLES).forEach(([id, [x, z, tf]]) => {
    const along = dirs[id].lengthSq() ? dirs[id].clone().normalize() : new THREE.Vector2(1, 0);
    const arm = new THREE.Vector2(-along.y, along.x); // across the line
    const y = groundY(x, z);
    utilityPole(grp(g, x, y - 0.15, z, Math.atan2(-arm.y, arm.x)), 0, 0, H, 'x', { tf });
    P[id] = { x, z, top: y + H, arm };
  });
  // spans: three conductors on the top arm (in order across), the communication cable under the lower arm
  SPANS.forEach(([a, b, sag = 0.75]) => {
    const A = P[a], B = P[b], flip = A.arm.dot(B.arm) < 0 ? -1 : 1;
    [-0.8, 0, 0.8].forEach((o) => wire(g, [A.x + A.arm.x * o, A.top - 0.15, A.z + A.arm.y * o], [B.x + B.arm.x * o * flip, B.top - 0.15, B.z + B.arm.y * o * flip], sag, 0.014));
    wire(g, [A.x, A.top - 1.1, A.z], [B.x, B.top - 1.1, B.z], sag * 1.25, 0.022);
  });
  // service drops from the lower arm
  DROPS.forEach(([id, to]) => { const p = P[id]; const s = Math.sign((to[0] - p.x) * p.arm.x + (to[2] - p.z) * p.arm.y) || 1; wire(g, [p.x + p.arm.x * 0.6 * s, p.top - 0.95, p.z + p.arm.y * 0.6 * s], to, 0.35, 0.012); });
  return g;
}
