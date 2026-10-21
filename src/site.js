/* ====================================================================================================
   Which building stands on the lot left of the LAWSON (x -12 .. -7.9, front on Kaigan-dori).

   default        ひよりベーカリー (bakery.js), the wooden neighbourhood bakery
   ?shop=izakaya  the original izakaya ほたる (izakaya.js), exactly as it was - kept as a reusable module:
                  izakaya.js also exports placeIzakaya() to drop the same building on any other lot.

   Every module that knows about that lot (roof piles, ground piles, eave drips, weather occluders, holiday
   decorations, potted plants, the alley props, the pole in front) reads SITE / FRONT from here, so the two
   buildings never mix.
   ==================================================================================================== */
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const SITE = { izakaya: QS.get('shop') === 'izakaya' };
SITE.bakery = !SITE.izakaya;
/** the board's west pole on Kaigan-dori: in front of the izakaya as before, west of the bakery's shop front */
export const POLE_W = SITE.izakaya ? -11.0 : -13.25;

/** with the bakery on the home lot the izakaya moves to the west block, as in the town plan: between the west lane
    (its street side) and the 杂货铺 / 书店 lots, front on Kaigan-dori. x, z = its front-left corner (izakaya.js
    placeIzakaya), dx = the shift from the home lot, rect = the footprint x0, x1, z0, z1 */
export const IZA_AWAY = SITE.bakery ? { x: -28.3, z: 4.3, ry: 0, dx: -16.3, rect: [-28.3, -24.8, -7.2, 4.3] } : null;

/** shop-front anchor points the holiday decorations hang on */
export const FRONT = SITE.izakaya
  ? {
    eave: [-12.1, -8.2, 2.8, 5.36], // swag of bulbs: x0, x1, y, z
    wreath: [-10.15, 2.0, 4.42],
    kado: [[-11.35, 4.85], [-8.95, 4.85]],
    shime: [-10.15, 2.65, 4.42, 1.5],
    stripe: [-10.15, 2.5, 5.37, 3.7],
    nobori: [-8.2, 5.5],
    lanterns: { xs: [-11.5, -10.6, -9.7, -8.8], y: 2.42, z: 5.3 },
    blossom: [-10.15, 2.5, 4.5],
    summer: { xs: [-11.6, -10.9, -10.2, -9.5, -8.8], y: 2.5, z: 5.28 },
    pumpkins: [[-11.3, 5.0, 0.8], [-8.95, 5.05, 0.7]],
    lamp2: -8.3, // the street lamp on the corner of the lot (festoons tie to it)
  }
  : {
    // BREAD (bakery.js): canopy edge at y 3.0 / z 1.95, shop front at z 0.9, terrace deck to z 4.45
    eave: [-12.3, -7.85, 2.98, 1.97],
    wreath: [-10.85, 1.9, 0.93],
    kado: [[-11.85, 1.15], [-8.1, 0.98]],
    shime: [-8.95, 2.7, 0.93, 1.25],
    stripe: [-10.05, 2.88, 1.97, 4.4],
    nobori: [-7.55, 4.3],
    lanterns: { xs: [-11.7, -10.75, -9.8, -8.85], y: 2.82, z: 1.9 },
    blossom: [-8.95, 2.75, 0.96],
    summer: { xs: [-11.8, -11.05, -10.3, -9.55, -8.8], y: 2.8, z: 1.9 },
    pumpkins: [[-10.95, 4.15, 0.6], [-9.7, 1.25, 0.55]],
    lamp2: -7.15,
  };
