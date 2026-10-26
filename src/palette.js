/* ====================================================================================================
   星空町 palette - the one place the town's colours come from (style guide, 2026-10-24).

   base     from しずく花店 (the benchmark): large surfaces - walls, stone, timber, frames
   candy    retro candy accents: small areas only - awnings, signs, doors, window frames, pots
   support  plants, shadow / night tones, and a few derived shades for materials that need them

   Rules: big surfaces use the base colours; at most two candy accents per building; ink (not black) for
   frames and metal. New code takes its colours from here; older modules move over one area at a time.
   ==================================================================================================== */

export const P = {
  // base (from the florist)
  cream: '#F4EFE3', // walls, trims
  stone: '#BDB6A8', // stone, pavement
  woodL: '#C99A64', // shopfronts, furniture
  woodD: '#7A5A3C', // frames, posts
  ink: '#2F2E38', // window frames, metal (instead of black)

  // retro candy accents
  mustard: '#F2B53C',
  coral: '#E8674F',
  mint: '#8ED0A8',
  blue: '#6C93D9',
  pink: '#F3A8BE',

  // support
  leaf: '#4F7F52', // plants
  night: '#33407A', // shadow, night tone
  green: '#3F6A52', // the florist's deep green (trims, signs)

  // derived shades (keep large areas in the mid range: no near-black walls or roofs)
  creamD: '#E6DDCB', // shaded cream, mortar
  stoneD: '#8F877C', // warm grey roofs, plinths
  woodM: '#9A7550', // mid timber (cladding)
  inkSoft: '#5E5A66', // warm charcoal for large dark-ish surfaces (cladding, panels)
  brick: '#C0634C', // coral brick
  brickD: '#9C4A3A', // brick shadow / parapet
  slate: '#66708C', // soft slate-blue tile roofs
  slateL: '#8E98B4', // tile highlights

  // roofs: two languages only
  //   flat / metal  warm grey - flat decks a step lighter, metal (standing seam, mono-pitch) mid warm grey
  //   pitched tile  slate (the izakaya, the street-row house; the florist's grey tiles sit next to it)
  roofFlat: '#A39C90', // flat roof decks / membranes
  roofMetal: '#878074', // metal roofs
  coping: '#E6DDCB', // light copings on parapets (= creamD)
  roofTimber: '#8C7F70', // the one brown-grey low hipped roof (西の住宅地 house 1): the warm-grey family, a touch browner

  // ground: three pavings, all from warm stone / cream (two tones each: tile A, tile B)
  //   walk   sidewalks everywhere - warm stone squares
  //   shop   shop aprons and forecourts - lighter cream tiles, a smaller module (the florist's terracotta stays)
  //   plaza  the sakura plaza and the station square - light stone slabs in running bond
  // plus the plain surfaces round them. Ground paint goes through groundPaint() (the ground shader lifts it by day).
  paveWalk: '#BDB6A8', paveWalk2: '#B3AC9E',
  paveShop: '#E6DDCB', paveShop2: '#DDD4C1',
  pavePlaza: '#D8CFC0', pavePlaza2: '#D2C9BA',
  concrete: '#A39C90', // yards, the backs of lots, under buildings
  kerb: '#C9C1B2', // kerb stones (meshes)
  joint: '60,48,38', // paving joints, as 'r,g,b' for rgba()
};

/** a hex colour lightened (k > 0) or darkened (k < 0), k in -1 .. 1 */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = c.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** the colour to paint into a ground canvas (ground.js makeGroundMaterial) so it shows as `hex` in daylight: the
    shader lifts the painted colour to colour * 2.6 + 0.025 (linear light) when dry and sunny; this undoes that */
export function groundPaint(hex) {
  const n = parseInt(hex.slice(1), 16);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255, lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    const p = Math.max(0, (lin - 0.025) / 2.6);
    return Math.round(255 * (p <= 0.0031308 ? p * 12.92 : 1.055 * p ** (1 / 2.4) - 0.055));
  });
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** 'r,g,b' of a hex colour (for rgba() strings in canvas drawing) */
export const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
