import { reg } from '../core.js';
import { plantBatch, plantField } from '../plants/wild.js';
import { rockFree } from './rockZones.js';
import { LAKE, lakeF, lakeParkH, WATER_Y, blockAt, groundY } from './layout.js';

/* ====================================================================================================
   Wild planting by zone (plants/wild.js holds the models and the placement): every zone has its own species mix,
   density, cluster size, spacing, sizes and seed - the same plants on every load.

     zone                 density           plants
     florist strip / yard rich, layered     forget-me-nots, daisies, pink flowers, clover, groundcover in front;
                                            flowering shrubs in the middle; ornamental grass at the back
     lake shore           clusters, gaps    wild grass, clover, forget-me-nots, small white flowers among the stones;
                                            a few ornamental grasses / pampas; open shore between
     lake park meadow     scattered         mixed wildflower patches, clover, tall grass, a few flowering shrubs
     verges / lots        sparse            short grass, clover, a few daisies, leafy shrubs
   (the sakura plaza, the villa garden and the island edge plant theirs in plaza.js, villa.js, island.js)

   Keep-outs: roads, lanes, the track, building plots (rockFree), the walk round the lake, water, stones, and the
   existing plants of each bed (so nothing grows through them).
   ==================================================================================================== */

const near = (list, x, z, r) => list.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + r);

export function buildPlants(parent) {
  const out = {};
  const stones = [...(reg.rocks?.lakeStones || []), ...(reg.rocks?.parkStones || [])];
  const trees = (reg.townGreenery?.trees || []).map((t) => [t.x, t.z, 0.45 * (t.s || 1)])
    .concat((reg.townGreenery?.shrubs || []).map((b) => [b.x, b.z, 0.6 * (b.s || 1)])); // trees + the existing shrubs: nothing grows through them

  /* ---- the florist (しずく花店): the green strip between the shop and the house, the house's front bed ---- */
  {
    const B = plantBatch(parent, { name: 'FloristPlants', cast: true });
    // what already grows there (trees, shrubs, hosta, ferns, aspidistra, taro) + the stones
    const keep = [[23.1, 0.4, 0.55], [23.0, -4.6, 0.55], [22.6, -1.6, 0.6], [23.5, -2.6, 0.5], [22.7, -6.0, 0.55], [23.6, 1.8, 0.45], [22.4, 1.9, 0.3], [24.0, -0.6, 0.3], [22.45, -3.3, 0.3], [23.9, -5.4, 0.3], [22.5, 0.6, 0.25], [23.95, -3.6, 0.25]];
    const x0 = 21.92 + 0.15, x1 = 24.48 - 0.15, z0 = -6.9 + 0.2, z1 = 2.7 - 0.2, soil = (x, z) => groundY(x, z) + 0.1;
    const inStrip = (x, z) => x > x0 && x < x1 && z > z0 && z < z1 && !near(keep, x, z, 0.08);
    // front layer: low flowers and clover along both edges
    plantField(B, { seed: 7100, clusters: 9, per: [3, 6], spread: 0.32, at: (R) => [R() < 0.5 ? x0 + 0.15 + R() * 0.25 : x1 - 0.15 - R() * 0.25, z0 + R() * (z1 - z0)], ok: inStrip, ground: soil,
      species: { forget: 3, daisy: 2, pinkWild: 2, clover: 2, cover: 2 }, scale: [1.0, 1.4], minGap: 0.13, mixIn: 0.3 });
    // middle: two flowering shrubs where there is room; back: ornamental grass along the middle line
    plantField(B, { seed: 7110, clusters: 3, per: [1, 1], spread: 0.1, at: (R) => [(x0 + x1) / 2 + (R() - 0.5) * 0.6, z0 + R() * (z1 - z0)], ok: (x, z) => inStrip(x, z) && !near(keep, x, z, 0.35), ground: soil,
      species: { bushFlower: 2, ornGrass: 1 }, scale: [0.85, 1.05], minGap: 0.2 });
    // the house's front bed (between the hosta / aspidistra / fern and the small tree)
    const b0 = 24.6 + 2.6 + 0.12, b1 = 29.3 - 0.15 - 0.08, bz0 = 1.0 + 0.3 + 0.12, bz1 = 3.85 - 0.15 - 0.08, gy = groundY((b0 + b1) / 2, 3.85) + 0.13;
    const bedKeep = [[b1 - 0.5, bz0 + 1.2, 0.5], [b0 + 0.4, bz1 - 0.4, 0.35], [b0 + 0.45, bz0 + 0.5, 0.35], [b0 + 1.1, bz1 - 0.35, 0.3], [24.6 + 2.75, 3.85 - 0.42, 0.15]];
    plantField(B, { seed: 7120, clusters: 5, per: [2, 4], spread: 0.25, at: (R) => [b0 + R() * (b1 - b0), bz0 + R() * (bz1 - bz0)], ok: (x, z) => x > b0 && x < b1 && z > bz0 && z < bz1 && !near(bedKeep, x, z, 0.06), ground: () => gy,
      species: { forget: 2, daisy: 2, pinkWild: 1, cover: 2 }, scale: [1.0, 1.3], minGap: 0.12, mixIn: 0.3 });
    out.florist = B.flush();
  }

  /* ---- the lake: wild grass, clover, forget-me-nots and white flowers among the shore stones; open shore between ---- */
  {
    const B = plantBatch(parent, { name: 'LakePlants', lite: true });
    const ring = (a, f) => { const rr = 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1); return [LAKE.cx + Math.cos(a) * LAKE.rx * f * rr, LAKE.cz + Math.sin(a) * LAKE.rz * f * rr]; };
    const jetty = (x, z) => { let d = Math.atan2((z - LAKE.cz) / LAKE.rz, (x - LAKE.cx) / LAKE.rx) - 1.75; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) < 0.26; };
    const shoreOk = (x, z) => { const f = lakeF(x, z); return x < -20.8 && f > 1.0 && f < 1.105 && lakeParkH(x, z) > WATER_Y + 0.02 && !jetty(x, z) && !near(stones, x, z, 0.06); };
    // by the stones: two or three small plants beside some of them
    plantField(B, { seed: 7200, clusters: 16, per: [2, 4], spread: 0.35, at: (R) => { const s = stones[(R() * stones.length) | 0]; if (!s) return null; const a = R() * 6.28, d = s[2] + 0.12; return [s[0] + Math.cos(a) * d, s[1] + Math.sin(a) * d]; }, ok: shoreOk, ground: lakeParkH,
      species: { shortGrass: 3, clover: 2, forget: 2, daisy: 1, tallGrass: 2 }, scale: [1.0, 1.4], minGap: 0.14, mixIn: 0.35 });
    // grassy stretches with nothing but grass, and a few taller grasses leaning over the water
    plantField(B, { seed: 7210, clusters: 10, per: [3, 6], spread: 0.6, at: (R) => ring(R() * 6.28, 1.02 + R() * 0.06), ok: shoreOk, ground: lakeParkH,
      species: { tallGrass: 3, shortGrass: 3, ornGrass: 1, pampas: 0.4 }, scale: [0.85, 1.2], minGap: 0.15, mixIn: 0.15 });
    // the meadow beyond the walk: wildflower patches, clover, tall grass, a few flowering shrubs, round the trees
    const parkOk = (x, z) => blockAt(x, z)?.id === 'lakePark' && lakeF(x, z) > 1.33 && rockFree(x, z, 0.1, 0.4) && !near(stones, x, z, 0.08) && !near(trees, x, z, 0.1);
    plantField(B, { seed: 7220, clusters: 22, per: [3, 7], spread: 0.7, at: (R) => [-47 + R() * 29, -43.5 + R() * 20], ok: parkOk, ground: lakeParkH,
      species: { patch: 3, clover: 2, tallGrass: 2, daisy: 2, forget: 1.5, pinkWild: 1, cover: 1.5, bushFlower: 0.5 }, scale: [1.0, 1.4], minGap: 0.16, mixIn: 0.3, lite: true });
    out.lake = B.flush();
  }

  /* ---- verges and the edges of the lots: short grass, clover, a few daisies, leafy shrubs (sparse) ---- */
  {
    const B = plantBatch(parent, { name: 'VergePlants', lite: true });
    const okV = (x, z) => { const b = blockAt(x, z); return b && ['verge', 'lots'].includes(b.surf) && rockFree(x, z, 0.1, 0.35) && !near(trees, x, z, 0.05); };
    plantField(B, { seed: 7300, clusters: 46, per: [2, 5], spread: 0.5, at: (R) => [-48 + R() * 84, -44 + R() * 76], ok: okV, ground: groundY,
      species: { shortGrass: 4, clover: 3, daisy: 1, tallGrass: 1.5, cover: 1, bushLeaf: 0.4 }, scale: [0.85, 1.15], minGap: 0.15, mixIn: 0.25 });
    out.verge = B.flush();
  }

  reg.plants = out;
  return out;
}
