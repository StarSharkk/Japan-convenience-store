import { reg } from '../core.js';
import { rockBatch, rockMat, scatterRocks } from '../rocks.js';
import { LAKE, lakeF, lakeParkH, WATER_Y, ROADS, LANES, LANE_W, PLOTS, RAIL, PLAZA_TREES, PLAZA_CENTRE, blockAt, groundY, distPolyline, insideMap } from './layout.js';

/* ====================================================================================================
   Rock placement by zone (rocks.js holds the models, the material and the placement system). Each zone has its own
   types, density, sizes, clustering, spacing, bedding depth, moss, colour casts and seed, so a lake shore reads as a
   lake shore and a plaza bed as a plaza bed; the same seed gives the same rocks on every load.

     zone              density                      types
     lake shore        medium, in clusters          water-worn shore stones, natural / mossy stones, pebbles
     lake park         low, at a few tree roots     half-buried + mossy stones
     sakura plaza      very low, inside tree pits   small half-buried stones
     verges            very low                     a few natural stones in open grass
   (the villa garden, the florist, the west homes and the island edge place theirs in their own files, with the same
   library: villa.js, florist.js, westHomes.js, island.js)

   Keep-outs everywhere: roads and lanes, the track, building plots, water (except on the shore), the paths; a rock
   sits on the lowest ground under its footprint and beds in, so it never floats on a slope.
   ==================================================================================================== */

const inRect = (x, z, [x0, x1, z0, z1], m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
/** clear of roads, lanes, the track and building plots (m: margin) */
export function rockFree(x, z, r, m = 0.3) {
  if (!insideMap(x, z)) return false;
  for (const R of Object.values(ROADS)) if (inRect(x, z, [R.x0, R.x1, R.z0, R.z1], r + m)) return false;
  for (const L of Object.values(LANES)) if (distPolyline(x, z, L) < LANE_W / 2 + r + m) return false;
  if (Math.abs(z - RAIL.z) < 2.6 + r && x < RAIL.xCurve + 1) return false;
  if (x > RAIL.xCurve - 1 && Math.abs(Math.hypot(x - RAIL.xCurve, z - (RAIL.z - RAIL.R)) - RAIL.R) < 2.6 + r) return false;
  if (x > RAIL.xNorth - 2.6 - r && x < RAIL.xNorth + 2.6 + r && z < RAIL.z - RAIL.R) return false;
  return PLOTS.every((p) => !inRect(x, z, p.rect, r + m));
}

export function buildRocks(parent) {
  const out = {};
  // the lake ring parameter (as lake.js): shoreline at f ~ 1, the walk at f ~ 1.12 .. 1.28
  const rr = (a) => 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1);
  const ring = (a, f) => [LAKE.cx + Math.cos(a) * LAKE.rx * f * rr(a), LAKE.cz + Math.sin(a) * LAKE.rz * f * rr(a)];
  const angOf = (x, z) => Math.atan2((z - LAKE.cz) / LAKE.rz, (x - LAKE.cx) / LAKE.rx);
  const nearJetty = (x, z) => { let d = angOf(x, z) - 1.75; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) < 0.24; };

  /* ---- lake shore: clusters of 3-5 water-worn stones, some standing in the shallows, clean grass between ---- */
  {
    const B = rockBatch(parent, rockMat({ waterY: WATER_Y + 0.02, wet: 1.35, moss: 1, tint: '#eef1f4' }), { name: 'LakeShoreRocks' });
    scatterRocks(B, {
      seed: 4401, clusters: 12, per: [3, 5], pebbles: [2, 4], singles: 6, spread: 0.85,
      at: (R) => {
        const a = R() * Math.PI * 2, [x, z] = ring(a, 0.95 + R() * 0.12);
        // cluster leads (every stone >= 0.42 m) keep apart: the shore between them stays open grass
        const leads = B.placed.filter((p) => p[2] >= 0.42);
        return leads.length < 11 && leads.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 4.2) ? null : [x, z];
      },
      ok: (x, z, r) => {
        if (x > -20.8 || nearJetty(x, z)) return false;
        const f = lakeF(x, z);
        return f > 0.9 - r * 0.05 && f + r / (Math.min(LAKE.rx, LAKE.rz) * 1.2) < 1.115; // not out in the lake, clear of the walk's kerb
      },
      ground: lakeParkH,
      lead: { shore: 3, medium: 2, large: 1, layered: 0.6 }, kinds: { shore: 3, medium: 2, embedded: 1, pebble: 1 },
      size: [0.5, 0.95], sizeS: [0.22, 0.48], sink: [0.12, 0.24], tilt: 0.14, moss: 0.35, minGap: 0.95,
      tints: ['#ffffff', '#f2f4f7', '#e6e9ee', '#f4efe8'],
      turn: (x, z) => -angOf(x, z) + Math.PI / 2, // long side along the shore
    });
    out.lakeStones = B.placed.slice(); // (town/plantZones.js keeps the plants off them)
    out.lake = B.flush();
  }

  /* ---- lake park: a stone or two bedded at a few tree roots ---- */
  {
    const B = rockBatch(parent, rockMat({ moss: 1.2, tint: '#f3f3f0' }), { name: 'LakeParkRocks' });
    const trees = (reg.townGreenery?.trees || []).filter((t) => blockAt(t.x, t.z)?.id === 'lakePark' && lakeF(t.x, t.z) > 1.45);
    trees.forEach((t, i) => {
      if (i % 2) return; // only some trees
      scatterRocks(B, {
        seed: 4500 + i, clusters: 1, per: [0, 1], pebbles: [0, 2],
        at: (R) => { const a = R() * Math.PI * 2, d = 0.7 + R() * 0.5; return [t.x + Math.cos(a) * d, t.z + Math.sin(a) * d]; },
        ok: (x, z, r) => blockAt(x, z)?.id === 'lakePark' && lakeF(x, z) > 1.38 && rockFree(x, z, r, 0.4),
        ground: lakeParkH, lead: { embedded: 2, mossy: 1 }, kinds: { embedded: 1, pebble: 1 },
        size: [0.22, 0.38], sizeS: [0.1, 0.18], sink: [0.3, 0.5], tilt: 0.1, moss: 0.5,
      });
    });
    out.parkStones = B.placed.slice();
    out.lakePark = B.flush();
  }

  /* ---- sakura plaza: two or three small stones bedded in each tree pit, by its rim, clear of the uplight ---- */
  {
    const B = rockBatch(parent, rockMat({ moss: 0.6, tint: '#f7f3ec' }), { name: 'PlazaRocks' });
    PLAZA_TREES.forEach(([x, z, , , r], i) => {
      const ux = x < PLAZA_CENTRE[0] ? 1 : -1; // the uplight sits on the fountain side of the trunk
      scatterRocks(B, {
        seed: 4600 + i, clusters: 1, per: [1, 2], singles: 0, pebbles: [0, 1],
        at: (R) => { const a = R() * Math.PI * 2, d = r * (0.5 + R() * 0.25); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; },
        ok: (px, pz, rs) => Math.hypot(px - x, pz - z) + rs < r + 0.06 && Math.hypot(px - x, pz - z) > 0.28 && (px - x) * ux < 0.15,
        ground: (px, pz) => groundY(px, pz) + 0.12, // the pit (its stone disc tops out at +0.12)
        lead: { flat: 2, embedded: 1 }, kinds: { flat: 1, embedded: 1, pebble: 1 }, // pale / warm grey
        size: [0.12, 0.17], sizeS: [0.07, 0.1], sink: [0.3, 0.45], tilt: 0.08, moss: 0.3, minGap: 1,
        tints: ['#ffffff', '#f6efe4'],
      });
    });
    out.plaza = B.flush();
  }

  /* ---- verges: a few natural stones in the open grass of the east verge (the island edge has its own) ---- */
  {
    const B = rockBatch(parent, rockMat({ moss: 1, tint: '#f1f1ee' }), { name: 'VergeRocks' });
    scatterRocks(B, {
      seed: 4700, clusters: 3, per: [1, 2], pebbles: [1, 3], singles: 2,
      at: (R) => [29.5 + R() * 6, -44 + R() * 28],
      ok: (x, z, r) => blockAt(x, z)?.id === 'corrE' && rockFree(x, z, r, 0.6) && (reg.townGreenery?.trees || []).every((t) => Math.hypot(t.x - x, t.z - z) > 1.0 + r),
      ground: groundY, lead: { medium: 2, embedded: 1 }, kinds: { embedded: 1, pebble: 1 },
      size: [0.28, 0.45], sizeS: [0.12, 0.2], sink: [0.25, 0.4], tilt: 0.1, moss: 0.4,
    });
    out.verge = B.flush();
  }
  reg.rocks = out;
  return out;
}
