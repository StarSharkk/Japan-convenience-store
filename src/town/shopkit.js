import * as THREE from 'three';
import { reg, canvasTex, rng } from '../core.js';
import { mergeInto } from '../plants/kit.js';
import { P, shade } from '../palette.js';

/* ====================================================================================================
   Small shared kit for the south-block shops (town/cafe.js, town/bookstore.js): boxes with metre UVs,
   a texture cache, canvas text in any font, book-spine rows, pavers, the rain wetness pass.
   ==================================================================================================== */

/** the shops' levelled pad (town/layout.js SOUTH_SHOPS_PAD) */
export const YS = 0.47;

const cache = {};
/** a cached canvas texture */
export const ct = (k, w, h, draw, o) => (cache[k] ||= canvasTex(w, h, draw, o));

/** a box with UVs in metres / tile on every face */
export function wbx(parent, mat, x0, x1, y0, y1, z0, z1, tile = 1, o = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile); }
  const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = o.cast ?? true; m.receiveShadow = true; parent.add(m);
  return m;
}

/** leaf batches merged per material under one root (sub-groups are fine) */
export function makeBins(root) {
  const bins = new Map(), rel = new THREE.Matrix4();
  return {
    add(parent, mat, geo) {
      if (parent && parent !== root) { root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false); geo.applyMatrix4(rel.copy(root.matrixWorld).invert().multiply(parent.matrixWorld)); }
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(geo);
    },
    flush() { bins.forEach((list, mat) => root.add(mergeInto(list, mat, { cast: false }))); },
  };
}

/** canvas text with a chosen font face */
export function txt(g, s, x, y, size, color, { font = 'Georgia, "Times New Roman", serif', weight = 700, align = 'center', italic = false } = {}) {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}
export const SERIF = 'Georgia, "Times New Roman", "Hiragino Mincho ProN", serif';
export const HAND = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", cursive';

/** a row of book spines (fills the whole texture; repeat it along a shelf) */
export function spineTex(seed, { pale = false } = {}) {
  return ct(`spine${seed}${pale}`, 256, 128, (g, w, h) => {
    const R = rng(seed);
    const cols = pale
      ? ['#e9dcc0', '#cdbb94', '#9fb8a8', '#c99f86', '#e3c98d', '#b9c7cf', '#d7b7a6', '#8fa69a', '#f0e6d2']
      : ['#7a2e2a', '#2f4a6b', '#3f5f3a', '#8a6a2e', '#5a3a5c', '#b0532e', '#2e5f5f', '#c9a24a', '#6b4a32', '#e8dcc0', '#1f2f45', '#8f8f6a'];
    g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = 7 + R() * 12, bh = h * (0.68 + R() * 0.3), c = cols[(R() * cols.length) | 0];
      if (R() < 0.06) { x += bw * 0.6; continue; } // a gap
      g.fillStyle = c; g.fillRect(x, h - bh, bw - 1, bh);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, h - bh, 2, bh);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + bw - 3, h - bh, 2, bh);
      if (R() < 0.7) { g.fillStyle = R() < 0.5 ? 'rgba(240,215,150,0.85)' : 'rgba(255,255,255,0.7)'; g.fillRect(x + 2, h - bh + bh * 0.18, bw - 5, 2); g.fillRect(x + 2, h - bh * 0.25, bw - 5, 2); }
      x += bw;
    }
  }, { repeat: true });
}

/** cream pavers (the shop frontage: palette.js paveShop) */
export function paverTex() {
  return ct('pavers', 256, 256, (g, w, h) => {
    const R = rng(31);
    g.fillStyle = shade(P.paveShop2, -0.3); g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 32 : 0;
      for (let x = -off; x < w; x += 64) { const k = R(); g.fillStyle = shade(k < 0.5 ? P.paveShop2 : P.paveShop, (R() - 0.6) * 0.06); g.fillRect(x + 2, r * rh + 2, 60, rh - 4); }
    }
  }, { repeat: true });
}

/** rain: these materials darken as they soak (the town's wetness level, reg.groundU) */
export function wetPass(mats) {
  const base = mats.map((m) => [m, m.color.clone()]);
  let last = -1;
  reg.updaters.push(() => {
    const G = reg.groundU; if (!G) return;
    const w = G.uWet.value;
    if (Math.abs(w - last) < 0.004) return;
    last = w; base.forEach(([m, c]) => m.color.copy(c).multiplyScalar(1 - 0.28 * w));
  });
}
