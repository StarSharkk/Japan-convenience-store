import * as THREE from 'three';
import { reg, toon, bx, cy, cyl2, grp, canvasTex, rng } from '../core.js';

/* ====================================================================================================
   Flat-roof life for the plainest roofs (the cafe, the bookstore, the street-house row, the corner store):
     · a weathered slab: joints, darker patches, drain streaks (a thin decal over the roof deck)
     · what a Japanese flat roof carries: AC condensers on blocks, vent stacks, a drain, a roof hatch, a laundry
       frame, a small dish - each kept clear of what the building already has up there
     · cherry petals and autumn leaves: the roofs' pile weights go up (the plaza's cherries are right there), and
       every fixture is an obstacle for the piles (roofPiles.js), so drifts bank against its foot
   ==================================================================================================== */

let SLAB = null;
const slabTex = () => (SLAB ||= canvasTex(256, 256, (g, w, h) => {
  const R = rng(733);
  g.fillStyle = '#a7a39b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 14 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < 0.5 ? '90,86,80' : '196,192,184'},${0.04 + R() * 0.05})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.strokeStyle = 'rgba(70,68,64,0.18)'; g.lineWidth = 1.5;
  for (let k = 1; k < 2; k++) { g.beginPath(); g.moveTo((k * w) / 4, 0); g.lineTo((k * w) / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, (k * h) / 4); g.lineTo(w, (k * h) / 4); g.stroke(); }
  for (let i = 0; i < 3; i++) { const x = R() * w; const gr = g.createLinearGradient(x, 0, x, h * 0.3); gr.addColorStop(0, 'rgba(60,56,50,0.08)'); gr.addColorStop(1, 'rgba(60,56,50,0)'); g.fillStyle = gr; g.fillRect(x - 3, 0, 6, h * 0.3); }
}, { repeat: true }));

// roofs: deck rect + height, the pile surfaces that cover it, and its fixtures [kind, x, z, (turn)]
const ROOFS = [
  { id: 'cafe', rect: [-11.6, -4.4, 13.9, 20.4], y: 4.3, piles: ['cafeRoof'], fix: [['ac', -10.5, 14.55, 0], ['ac', -9.55, 14.55, 0], ['vent', -5.2, 14.6], ['hatch', -6.7, 18.4], ['drain', -11.2, 20.0]] },
  { id: 'books', rect: [-2.1, 4.5, 14.5, 19.7], y: 3.7, piles: ['booksW', 'booksE'], fix: [['ac', 3.75, 15.15, 0], ['vent', -1.5, 15.1], ['dish', 0.2, 15.0], ['drain', 4.1, 19.3]] },
  { id: 'srA', rect: [-24.3, -19.7, 13.7, 19.4], y: 6.2, piles: ['srAW', 'srAE'], fix: [['laundry', -22.6, 17.6], ['vent', -23.8, 14.3], ['drain', -23.9, 19.0]] },
  { id: 'srB', rect: [-30.7, -24.3, 13.7, 19.4], y: 6.3, piles: ['srBW', 'srBE'], fix: [['ac', -25.2, 14.4, 0], ['vent', -25.0, 18.6]] },
  { id: 'srC', rect: [-36.4, -30.6, 13.7, 19.3], y: 6.2, piles: ['srCW', 'srCE'], fix: [['dish', -31.3, 14.3], ['vent', -31.2, 18.6]] },
  { id: 'zak', rect: [-23.0, -18.5, -1.0, 3.4], y: 5.9, piles: ['zakW', 'zakE'], fix: [] },
];
const MORE = { petal: 1.0, leaf: 0.8 }; // the pile weights for these roofs (+ the street-house gable)

export function buildRoofTops(parent) {
  const g = grp(parent); g.name = 'RoofTops';
  const m = { unit: toon('#e4e2dc'), grille: toon('#3a3d42'), block: toon('#b8b3a8'), pipe: toon('#d9d6cf'), cap: toon('#8a8780'), metal: toon('#9aa0a6'), drain: toon('#4a4744'), pole: toon('#b9bcc0') };
  const slabMat = toon('#ffffff', { map: slabTex(), nocache: true });
  const piles = (id) => (reg.extraRoofs || []).find((r) => r.id === id);
  // the real deck height under each roof (a ray straight down through its middle; a few spots, the most common hit)
  parent.updateMatrixWorld(true);
  const solids = []; parent.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && !(o.material && o.material.transparent)) solids.push(o); });
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const deck = (rf) => {
    const [x0, x1, z0, z1] = rf.rect, hits = [];
    [[0.5, 0.5], [0.3, 0.7], [0.7, 0.3], [0.35, 0.35], [0.65, 0.65]].forEach(([a, b]) => {
      rc.set(new THREE.Vector3(x0 + (x1 - x0) * a, rf.y + 3, z0 + (z1 - z0) * b), down); rc.far = 4;
      const h = rc.intersectObjects(solids, false)[0]; if (h && Math.abs(h.point.y - rf.y) < 1.2) hits.push(+h.point.y.toFixed(2));
    });
    if (!hits.length) return rf.y;
    const count = (v) => hits.filter((q) => Math.abs(q - v) < 0.02).length;
    return hits.reduce((best, v) => (count(v) > count(best) || (count(v) === count(best) && v < best) ? v : best), hits[0]);
  };
  ROOFS.forEach((rf) => {
    const [x0, x1, z0, z1] = rf.rect, y = deck(rf), obst = [];
    // the weathered slab, a hair above the deck (inset from the parapets)
    const w = x1 - x0 - 0.3, d = z1 - z0 - 0.3, slab = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), slabMat);
    const uv = slab.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3.2, uv.getY(i) * d / 3.2);
    slab.position.set((x0 + x1) / 2, y + 0.006, (z0 + z1) / 2); slab.receiveShadow = true; slab.userData.noLine = true; g.add(slab);
    rf.fix.forEach(([kind, x, z, ry = 0]) => {
      if (kind === 'ac') { // a condenser on two concrete blocks, its fan grille and the refrigerant pipes running off
        const u = grp(g, x, y, z, ry);
        bx(u, m.block, -0.32, -0.2, 0, 0.1, -0.16, 0.16); bx(u, m.block, 0.2, 0.32, 0, 0.1, -0.16, 0.16);
        bx(u, m.unit, -0.38, 0.38, 0.1, 0.62, -0.17, 0.17, { bevel: 0.02 });
        const fan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), m.grille); fan.position.set(-0.08, 0.36, 0.172); u.add(fan);
        for (let k = -2; k <= 2; k++) bx(u, m.unit, -0.28, 0.12, 0.36 + k * 0.06, 0.37 + k * 0.06, 0.174, 0.18, { cast: false });
        cyl2(u, m.pipe, [0.3, 0.3, -0.17], [0.3, 0.3, -0.45], 0.025, 6); cyl2(u, m.pipe, [0.3, 0.3, -0.45], [0.3, 0.03, -0.45], 0.025, 6);
        obst.push([x - 0.42, x + 0.42, z - 0.5, z + 0.22]);
      } else if (kind === 'vent') { // two vent stacks with rain caps
        [[0, 0, 0.5], [0.22, 0.08, 0.36]].forEach(([dx, dz, h]) => { cy(g, m.pipe, x + dx, y, z + dz, 0.05, h, 10); cy(g, m.cap, x + dx, y + h, z + dz, 0.085, 0.03, 12); cy(g, m.cap, x + dx, y + h + 0.03, z + dz, 0.04, 0.05, 10); });
        obst.push([x - 0.1, x + 0.32, z - 0.1, z + 0.18]);
      } else if (kind === 'hatch') { // a low roof hatch with a lid
        bx(g, m.block, x - 0.38, x + 0.38, y, y + 0.28, z - 0.38, z + 0.38, { bevel: 0.02 }); bx(g, m.metal, x - 0.42, x + 0.42, y + 0.28, y + 0.33, z - 0.42, z + 0.42, { bevel: 0.01 });
        obst.push([x - 0.44, x + 0.44, z - 0.44, z + 0.44]);
      } else if (kind === 'drain') { // a drain grate in a shallow sump
        cy(g, m.drain, x, y + 0.004, z, 0.09, 0.008, 12, { cast: false });
      } else if (kind === 'laundry') { // a laundry frame: two posts, two poles across
        [-0.9, 0.9].forEach((dx) => { cy(g, m.block, x + dx, y, z, 0.12, 0.08, 10); cyl2(g, m.pole, [x + dx, y + 0.08, z], [x + dx, y + 1.45, z], 0.025, 6); cyl2(g, m.pole, [x + dx, y + 1.45, z - 0.18], [x + dx, y + 1.45, z + 0.18], 0.02, 6); });
        [-0.18, 0.18].forEach((dz) => cyl2(g, m.metal, [x - 0.95, y + 1.47, z + dz], [x + 0.95, y + 1.47, z + dz], 0.016, 6));
        obst.push([x - 1.0, x - 0.8, z - 0.15, z + 0.15], [x + 0.8, x + 1.0, z - 0.15, z + 0.15]);
      } else if (kind === 'dish') { // a small satellite dish on a stand
        cy(g, m.block, x, y, z, 0.16, 0.1, 10); cyl2(g, m.pole, [x, y + 0.1, z], [x, y + 0.55, z], 0.025, 6);
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, 0.9), m.unit); dish.material.side = THREE.DoubleSide; dish.scale.set(1, 0.35, 1); dish.position.set(x, y + 0.6, z); dish.rotation.set(-1.1, 0.6, 0); dish.castShadow = true; g.add(dish);
        obst.push([x - 0.18, x + 0.18, z - 0.18, z + 0.18]);
      }
    });
    rf.piles.forEach((id) => { const r = piles(id); if (!r) return; r.w = { petal: Math.max(MORE.petal, r.w?.petal || 0), leaf: Math.max(MORE.leaf, r.w?.leaf || 0) }; r.obst = obst; if (r.y < y + 0.01 && !r.drop || r.y < y + 0.01 && r.drop < 0.05) r.y = y + 0.03; r.walls = rf.piles.length > 1 ? { u0: 1, u1: 1, v0: 1 } : { u0: 1, u1: 1, v0: 1, v1: 1 }; }); // parapets: all round a whole roof; a half's open side (v1) is the roof's middle
  });
  // the street-house row's tiled gable takes petals too
  ['srDs', 'srDn'].forEach((id) => { const r = piles(id); if (r) r.w = { petal: 0.6, leaf: Math.max(0.6, r.w?.leaf || 0) }; });
  return g;
}
