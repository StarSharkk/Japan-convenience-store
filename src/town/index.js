import { reg, setCat } from '../core.js';
import { buildTownGround } from './ground.js';
import { buildLake } from './lake.js';
import { buildRail } from './rail.js';
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
  const furniture = buildFurniture(world, lake);
  const greenery = buildGreenery(world, lake);
  // the houses / shops kit (houses.js) is kept but switched off for now; ?houses=1 shows it
  let houses = null;
  if (new URLSearchParams(location.search).get('houses') === '1') {
    setCat('iza'); // house / shop windows and lanterns follow the evening lights
    houses = buildHouses(world);
  }
  setCat('shop');
  reg.town = { map: MAP, blocks: BLOCKS, plots: PLOTS, groundY, ground, lake, rail, furniture, greenery, houses, buildMs: Math.round(performance.now() - t0) };
  return reg.town;
}
