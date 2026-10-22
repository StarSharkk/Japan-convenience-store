import { reg, setCat } from '../core.js';
import { buildTownGround } from './ground.js';
import { buildLake } from './lake.js';
import { buildRail } from './rail.js';
import { buildTrain } from './train.js';
import { buildFlorist } from './florist.js';
import { buildZakkaya } from './zakkaya.js';
import { buildVilla } from './villa.js';
import { buildFurniture } from './furniture.js';
import { buildGreenery } from './greenery.js';
import { buildHouses } from './houses.js';
import { PLOTS, BLOCKS, MAP, groundY } from './layout.js';

/**
 * Hoshizora town: the expanded map around the original board.
 * Modules: ground (roads / blocks / walls / plinth) · lake · rail · furniture · greenery.
 * Future buildings: reg.town.plots (data only, nothing is drawn for them).
 */
export function buildTown(world, renderer, refl) {
  const t0 = performance.now();
  const ground = buildTownGround(world, renderer, refl);
  const lake = buildLake(world, refl);
  setCat('street');
  const rail = buildRail(world);
  const train = buildTrain(world); // the seaside tram running on reg.railPath (?train=0 hides it)
  const furniture = buildFurniture(world, lake);
  const greenery = buildGreenery(world, lake);
  // しずく花店: the greenhouse florist on the corner across Hoshizora-dori from the LAWSON (plot A-shop-2)
  setCat('iza');
  const florist = buildFlorist(world);
  // 青空雑貨店: the old corner general store at Kita-dori x 裏路地 (north-east corner of the west block)
  const zakkaya = buildZakkaya(world);
  // 星野邸: the large residence filling the south-east block (front garden + white modern villa)
  const villa = buildVilla(world);
  setCat('street');
  // the houses / shops kit (houses.js) is kept but switched off for now; ?houses=1 shows it
  let houses = null;
  if (new URLSearchParams(location.search).get('houses') === '1') {
    setCat('iza'); // house / shop windows and lanterns follow the evening lights
    houses = buildHouses(world);
  }
  setCat('shop');
  reg.town = { map: MAP, blocks: BLOCKS, plots: PLOTS, groundY, ground, lake, rail, train, florist, zakkaya, villa, furniture, greenery, houses, buildMs: Math.round(performance.now() - t0) };
  return reg.town;
}
