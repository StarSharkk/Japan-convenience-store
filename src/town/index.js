import { reg, setCat } from '../core.js';
import { buildTownGround } from './ground.js';
import { buildLake } from './lake.js';
import { buildRail } from './rail.js';
import { buildTrain } from './train.js';
import { buildFlorist } from './florist.js';
import { buildZakkaya } from './zakkaya.js';
import { buildVilla } from './villa.js';
import { buildCafe } from './cafe.js';
import { buildBookstore } from './bookstore.js';
import { buildSouthStreet } from './southstreet.js';
import { buildPlaza } from './plaza.js';
import { buildStreetRow } from './streetRow.js';
import { buildWestHomes } from './westHomes.js';
import { buildStation } from './station.js';
import { buildIsland } from './island.js';
import { buildClouds } from '../clouds.js';
import { buildPower } from './power.js';
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
  // the south block facing the sakura plaza: 海辺の珈琲店 (COFFEE & BAKERY) + 海辺の本屋 (bookstore), one storey each
  const cafe = buildCafe(world);
  const bookstore = buildBookstore(world);
  const southStreet = buildSouthStreet(world);
  // 街屋の並び: four narrow town buildings on the south side of Kaigan-dori (block sw1)
  const streetRow = buildStreetRow(world);
  // 西の住宅地: four south-facing houses on two terraces in block west1 (between Kita-dori and Kaigan-dori)
  const westHomes = buildWestHomes(world);
  // 星空町駅: the local station on the station block, its platform by the track, the forecourt
  const station = buildStation(world);
  // the island: the rim of land, beaches, the round sea + the tray it floats on; clouds drifting round it
  const island = buildIsland(world);
  const clouds = buildClouds(world);
  // the overhead power + phone lines: one network for the whole town (town/power.js)
  const power = buildPower(world);
  setCat('street');
  // 桜広場: the sakura plaza in front of the two shops (after greenery: its trees join the petal / leaf piles)
  const plaza = buildPlaza(world);
  // the houses / shops kit (houses.js) is kept but switched off for now; ?houses=1 shows it
  let houses = null;
  if (new URLSearchParams(location.search).get('houses') === '1') {
    setCat('iza'); // house / shop windows and lanterns follow the evening lights
    houses = buildHouses(world);
  }
  setCat('shop');
  reg.town = { map: MAP, blocks: BLOCKS, plots: PLOTS, groundY, ground, lake, rail, train, florist, zakkaya, villa, cafe, bookstore, southStreet, plaza, streetRow, westHomes, station, island, clouds, power, furniture, greenery, houses, buildMs: Math.round(performance.now() - t0) };
  return reg.town;
}
