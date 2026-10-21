/* ====================================================================================================
   Holiday atmosphere configuration (data only - no scene code).
   Each holiday is described on the same set of layers; env.js blends the layers of the active holiday
   (weights are eased, so switching fades) and holiday.js builds the listed props once, lazily.

   decorations  : names of builders in holiday.js (shop front, street furniture, izakaya, ...)
   windowProps  : decals on the shop windows            signProps : boards / banners / garlands on signs
   treeLights   : fairy lights placed inside the big trees (positions come from the real tree crowns)
   foliage      : tree colour override  { tint: rgb multiplier, blossom: 0..1 force cherry blossom }
   ground       : roadside & ground details { petalPiles, leafPiles, snowPiles: 0..1, reflA, reflB: colour that
                  wet ground mirrors in the tree zone (A) and the shop zone (B) }
   particles    : { petals, confetti: 0..1, motes: { amount, tint } }  (motes = lights floating in the air)
   lighting     : accent colours — hemi (multiplier), door / tree / lamps (point light tint), bloom boost
   fog          : { tint, amt } how much the holiday colours the air (fog / mist weather)
   sky          : { fireworks: { rate (bursts / s at full night), palette, types } }   — 0 = never
   night        : { twinkle } how much the string lights shimmer after dark
   ==================================================================================================== */

export const HOLIDAY_IDS = ['none', 'christmas', 'halloween', 'newyear', 'sakura', 'summer'];

const zero = {
  decorations: [], windowProps: [], signProps: [],
  treeLights: null,
  foliage: { tint: [1, 1, 1], blossom: 0 },
  ground: { petalPiles: 0, leafPiles: 0, snowPiles: 0, reflA: [0, 0, 0], reflB: [0, 0, 0] },
  particles: { petals: 0, confetti: 0, motes: { amount: 0, tint: '#ffffff' } },
  lighting: { hemi: [1, 1, 1], door: null, tree: null, lamps: null, bloom: 0 },
  fog: { tint: '#ffffff', amt: 0 },
  sky: { fireworks: null },
  night: { twinkle: 0 },
};

export const holidayAtmosphereConfig = {
  none: zero,

  christmas: {
    decorations: ['xmasTree', 'awningLights', 'wreaths', 'lampGarlands', 'railLights', 'gifts', 'snowman', 'fasciaGarland', 'izakayaXmas'],
    windowProps: ['xmasWindow', 'xmasStockings', 'xmasCake'],
    signProps: ['xmasBoard'],
    treeLights: { palette: ['#fff1c8', '#ffd27a', '#ff6a6a', '#8ad6ff', '#fff1c8'], count: 34, size: 0.034 },
    foliage: { tint: [0.92, 1.0, 1.12], blossom: 0 },
    ground: { petalPiles: 0, leafPiles: 0, snowPiles: 0.5, reflA: [0.16, 0.1, 0.05], reflB: [0.2, 0.06, 0.05] },
    particles: { petals: 0, confetti: 0, motes: { amount: 0, tint: '#ffffff' } },
    lighting: { hemi: [1.04, 0.99, 0.93], door: '#ffd9a0', tree: '#ffe8c0', lamps: '#ffe0b0', bloom: 0.05 },
    fog: { tint: '#d8e4ff', amt: 0.1 },
    sky: { fireworks: null },
    night: { twinkle: 1.0 },
  },

  halloween: {
    decorations: ['pumpkins', 'awningLightsHalloween', 'lampGarlandsHalloween', 'railLightsHalloween', 'blackCat', 'broom', 'spiders', 'ghostLanterns', 'bats', 'izakayaHalloween', 'cobwebs'],
    windowProps: ['halloweenWindow', 'halloweenWindow2'],
    signProps: ['halloweenBoard'],
    treeLights: { palette: ['#ff8a1a', '#9a4ee0', '#ff8a1a', '#c8ff5a'], count: 18, size: 0.034 },
    foliage: { tint: [0.62, 0.55, 0.82], blossom: 0 },
    ground: { petalPiles: 0, leafPiles: 0.35, snowPiles: 0, reflA: [0.12, 0.04, 0.22], reflB: [0.26, 0.1, 0.02] },
    particles: { petals: 0, confetti: 0, motes: { amount: 0.55, tint: '#ff9a3a' } },
    lighting: { hemi: [1.0, 0.9, 1.1], door: '#ff9a3a', tree: '#9a5ae0', lamps: '#ffb070', bloom: 0.05 },
    fog: { tint: '#6a3a8a', amt: 0.38 },
    sky: { fireworks: null },
    night: { twinkle: 0.7 },
  },

  newyear: {
    decorations: ['kadomatsu', 'shimenawa', 'kohakuCurtain', 'nobori', 'kagamiMochi', 'lampGarlandsNewYear', 'fasciaBuntingRW', 'izakayaNewYear'],
    windowProps: ['newYearWindow', 'newYearFukubukuro'],
    signProps: ['newYearBoard'],
    treeLights: { palette: ['#ffd27a', '#ff5a4a', '#fff1c8'], count: 22, size: 0.032 },
    foliage: { tint: [1.0, 0.98, 1.03], blossom: 0 },
    ground: { petalPiles: 0, leafPiles: 0, snowPiles: 0.12, reflA: [0.2, 0.12, 0.04], reflB: [0.24, 0.04, 0.04] },
    particles: { petals: 0, confetti: 0.38, motes: { amount: 0, tint: '#ffffff' } },
    lighting: { hemi: [1.05, 0.98, 0.9], door: '#ffcf80', tree: '#ffe0a0', lamps: '#ffd9a0', bloom: 0.04 },
    fog: { tint: '#ffe8c0', amt: 0.06 },
    sky: { fireworks: { rate: 0.26, palette: ['#ffd24a', '#ff4a3a', '#ffffff', '#ffb347'], types: [0, 0, 1, 2], scale: 1.0 } },
    night: { twinkle: 0.4 },
  },

  sakura: {
    decorations: ['sakuraLanterns', 'blossomGarland', 'sakuraNobori', 'sakuraFestoon', 'izakayaSakura'],
    windowProps: ['sakuraWindow', 'sakuraWindow2'],
    signProps: ['sakuraBoard'],
    treeLights: { palette: ['#ffd6e6', '#fff1d8', '#ffb3cd'], count: 40, size: 0.034 },
    foliage: { tint: [1.05, 0.98, 1.03], blossom: 1 },
    ground: { petalPiles: 1.0, leafPiles: 0, snowPiles: 0, reflA: [0.24, 0.08, 0.15], reflB: [0.2, 0.1, 0.12] },
    particles: { petals: 1.0, confetti: 0, motes: { amount: 0.5, tint: '#ffc4da' } },
    lighting: { hemi: [1.05, 0.97, 1.03], door: '#ffc8dc', tree: '#ff9fc4', lamps: '#ffd6e6', bloom: 0.06 },
    fog: { tint: '#ffd0e0', amt: 0.2 },
    sky: { fireworks: { rate: 0.07, palette: ['#ffb3cd', '#ffe0ec', '#ffffff'], types: [0, 1], scale: 0.7 } },
    night: { twinkle: 0.5 },
  },

  summer: {
    decorations: ['summerLanterns', 'summerFestoons', 'bunting', 'yatai', 'furin', 'summerNobori', 'izakayaSummer'],
    windowProps: ['summerWindow', 'summerWindow2'],
    signProps: ['summerBoard'],
    treeLights: { palette: ['#ffd27a', '#ffb347', '#fff1c8'], count: 26, size: 0.034 },
    foliage: { tint: [0.98, 1.08, 0.96], blossom: 0 },
    ground: { petalPiles: 0, leafPiles: 0, snowPiles: 0, reflA: [0.2, 0.12, 0.03], reflB: [0.22, 0.05, 0.03] },
    particles: { petals: 0, confetti: 0, motes: { amount: 0.6, tint: '#d8ff7a' } },
    lighting: { hemi: [1.05, 1.0, 0.9], door: '#ffcf80', tree: '#ffe39a', lamps: '#ffd080', bloom: 0.05 },
    fog: { tint: '#ffd9a0', amt: 0.05 },
    sky: { fireworks: { rate: 0.3, palette: ['#ff6aa8', '#ffd24a', '#5de3ff', '#9aff7a', '#ff8a3a', '#ffffff'], types: [0, 0, 1, 2, 0], scale: 1.1 } },
    night: { twinkle: 0.6 },
  },
};
