import * as THREE from 'three';
import { reg, toon, glow, cy, cyl2, bx, grp, halo, canvasTex, rng, patchToon, RAMP } from '../core.js';
import { RAIL, CROSSINGS, railSamples, railTop, blockAt, groundY, roadH } from './layout.js';

/* ====================================================================================================
   Block E — an Enoden-inspired single-track local railway.
   ballast embankment (low between crossings, flush at crossings) · sleepers (instanced) · two rails ·
   rubber crossing decks · catenary (poles, brackets, messenger + contact wire with droppers) ·
   fences near the crossings · two road level crossings (踏切) + one footpath crossing.
   reg.railPath keeps the continuous centreline (x, y, z, heading, s) for a future train.
   ==================================================================================================== */

function gravelTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(31);
    g.fillStyle = '#4b4a52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = R() * w, y = R() * h, r = 1.5 + R() * 3.5;
      g.fillStyle = `hsl(${220 + R() * 30}, ${4 + R() * 8}%, ${26 + R() * 26}%)`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + R() * 0.4), R() * 3, 0, 7); g.fill();
    }
  }, { repeat: true });
}
function stripes(w, h, a = '#f2c230', b = '#17171c', n = 6, ang = 1) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    const s = w / n;
    for (let i = -n; i < n * 2; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + s / 2, 0); g.lineTo(i * s + s / 2 + h * ang, h); g.lineTo(i * s + h * ang, h); g.closePath(); g.fill(); }
  });
}

/* ---------------------------------------------------------------- a level crossing signal (+ optional barrier) */
function crossingPost(parent, x, z, faceX, faceZ, armLen, { foot = false } = {}) {
  const y = groundY(x, z);
  const P = grp(parent, x, y, z, Math.atan2(faceX, faceZ));
  const black = toon('#16161b');
  const strip = new THREE.MeshBasicMaterial({ map: stripes(64, 256, '#f2c230', '#17171c', 2, 0.3), color: new THREE.Color(0.95, 0.92, 0.85) });
  // striped post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, foot ? 2.6 : 3.4, 10), strip);
  post.position.y = (foot ? 2.6 : 3.4) / 2; post.castShadow = true; P.add(post);
  const H = foot ? 2.6 : 3.4;
  // crossbuck: two yellow/black boards in an X
  const xb = new THREE.MeshBasicMaterial({ map: stripes(512, 64, '#f2c230', '#17171c', 8, 0.6), color: new THREE.Color(1.0, 0.96, 0.88) });
  [0.62, -0.62].forEach((r) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.15, 0.03), xb); b.position.set(0, H - 0.05, 0.09); b.rotation.z = r; b.castShadow = true; P.add(b); });
  // twin red lamps under the X (lamp housing + hood), facing the road user
  const lamps = [];
  bx(P, black, -0.55, 0.55, H - 0.72, H - 0.64, 0.02, 0.12, { cast: false });
  [-0.36, 0.36].forEach((lx) => {
    const house = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 16), black);
    house.rotation.x = Math.PI / 2; house.position.set(lx, H - 0.68, 0.16); P.add(house);
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.03, 0.03) });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), lm);
    lens.position.set(lx, H - 0.68, 0.245); lens.userData.noLine = true; P.add(lens);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 16, 1, true, -Math.PI * 0.6, Math.PI * 1.2), toon('#16161b', { side: THREE.DoubleSide }));
    hood.rotation.x = Math.PI / 2; hood.position.set(lx, H - 0.68, 0.3); P.add(hood);
    lamps.push({ lm, h: halo(P, lx, H - 0.68, 0.36, '#ff3020', 1.2, 0) });
  });
  // the little "↑" direction board and the warning-bell box
  bx(P, toon('#d8dbe3'), -0.13, 0.13, H - 1.12, H - 0.86, 0.06, 0.08, { cast: false });
  cy(P, black, 0, H + 0.08, 0, 0.11, 0.18, 10);
  let arm = null;
  if (!foot && armLen > 0) {
    // barrier machine + striped arm (raised while no train is due)
    bx(P, toon('#d8c23a', { e: '#3a3008', ei: 0.3 }), 0.12, 0.52, 0, 1.15, -0.22, 0.22);
    bx(P, black, 0.5, 0.56, 0.9, 1.0, -0.06, 0.06);
    const pivot = grp(P, 0.56, 0.95, 0);
    pivot.userData.keep = true;
    const am = new THREE.MeshBasicMaterial({ map: stripes(512, 32, '#f2c230', '#17171c', 10, 0), color: new THREE.Color(1.0, 0.96, 0.88) });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.09, 0.07), am);
    bar.position.x = armLen / 2; bar.castShadow = true; pivot.add(bar);
    pivot.rotation.z = 1.38; // raised
    arm = pivot;
  }
  return { lamps, arm };
}

export function buildRail(parent) {
  const g = grp(parent);
  const S = railSamples(0.5);
  const roadCross = CROSSINGS.filter((c) => c.kind === 'road');
  const onRoadCrossing = (p, pad = 0.15) => Math.abs(p.z - RAIL.z) < 0.01 && roadCross.some((c) => p.x > c.x0 - pad && p.x < c.x1 + pad);
  S.forEach((p) => (p.y = railTop(p.x, p.z)));

  /* ---- ballast embankment ---- */
  {
    const pos = [], uv = [], idx = [];
    let run = 0;
    for (let i = 0; i < S.length; i++) {
      const p = S[i];
      const nx = -p.dz, nz = p.dx; // left of travel
      const top = p.y - 0.18, base = 0.12;
      const hwT = 1.25, hwB = hwT + Math.max(0, top - 0.15) * 1.6 + 0.15;
      [[-hwB, base], [-hwT, top], [hwT, top], [hwB, base]].forEach(([o, y]) => { pos.push(p.x + nx * o, y, p.z + nz * o); });
      uv.push(0, run, 0.35, run, 0.85, run, 1.2, run);
      if (i > 0) run += Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z) / 2.5;
      if (i < S.length - 1 && !onRoadCrossing(p, 0.4) && !onRoadCrossing(S[i + 1], 0.4)) {
        const a = i * 4, b = (i + 1) * 4;
        for (let k = 0; k < 3; k++) idx.push(a + k, b + k, a + k + 1, b + k, b + k + 1, a + k + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const t = gravelTex();
    const m = patchToon(new THREE.MeshToonMaterial({ color: 0xffffff, map: t, gradientMap: RAMP }));
    const bed = new THREE.Mesh(geo, m);
    bed.receiveShadow = true;
    g.add(bed);
  }

  /* ---- sleepers (instanced) ---- */
  {
    const step = 0.62;
    const list = [];
    let acc = 0;
    for (let i = 1; i < S.length; i++) {
      acc += Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z);
      if (acc >= step) { acc -= step; list.push(S[i]); }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.05, 0.1, 0.22), toon('#6c6460'), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, Math.atan2(-p.dz, p.dx) + Math.PI / 2);
      m4.compose(v.set(p.x, p.y - 0.15, p.z), q, one);
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }

  /* ---- rails (box section ribbons) ---- */
  {
    const half = RAIL.gauge / 2, w = 0.035, h = 0.1;
    const pos = [], nor = [], idx = [];
    [-half, half].forEach((off) => {
      const base = pos.length / 3;
      S.forEach((p) => {
        const nx = -p.dz, nz = p.dx;
        const cx = p.x + nx * off, cz = p.z + nz * off;
        // 4 corners: bottom-left, top-left, top-right, bottom-right
        [[-w, p.y - h, -1], [-w, p.y, 0], [w, p.y, 0], [w, p.y - h, 1]].forEach(([o, y, side]) => {
          pos.push(cx + nx * o, y, cz + nz * o);
          nor.push(side ? nx * side : 0, side ? 0 : 1, side ? nz * side : 0);
        });
      });
      for (let i = 0; i < S.length - 1; i++) {
        const a = base + i * 4, b = base + (i + 1) * 4;
        for (let k = 0; k < 3; k++) idx.push(a + k, a + k + 1, b + k, b + k, a + k + 1, b + k + 1);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    const rails = new THREE.Mesh(geo, toon('#a8adb9', { e: '#202430', ei: 0.4 }));
    rails.castShadow = true;
    rails.material.side = THREE.DoubleSide;
    g.add(rails);
  }

  /* ---- crossing decks ---- */
  const deckM = toon('#2b2f3a');
  const deckEdge = toon('#c9cdd8');
  roadCross.forEach((c) => {
    bx(g, deckM, c.x0 - 0.05, c.x1 + 0.05, 0.0, 0.205, RAIL.z - 1.45, RAIL.z + 1.45, { cast: false });
    [-1.45, 1.45].forEach((o) => bx(g, deckEdge, c.x0 - 0.05, c.x1 + 0.05, 0.0, 0.215, RAIL.z + o - 0.05, RAIL.z + o + 0.05, { cast: false }));
  });
  const foot = CROSSINGS.find((c) => c.kind === 'foot');
  const boards = toon('#6a5440');
  for (let z = RAIL.z - 1.3; z < RAIL.z + 1.3; z += 0.26) bx(g, boards, foot.x0, foot.x1, railTop(foot.x, RAIL.z) - 0.04, railTop(foot.x, RAIL.z) - 0.005, z, z + 0.22, { cast: false });

  /* ---- catenary ---- */
  {
    const poleM = toon('#8d93a2'), wireM = toon('#2a2d36');
    const poles = [];
    let next = 3;
    for (const p of S) {
      if (p.s < next) continue;
      const near = CROSSINGS.some((c) => Math.abs(p.z - RAIL.z) < 0.01 && Math.abs(p.x - c.x) < 3.6);
      const off = 2.45;
      const px = p.x + p.dz * off, pz = p.z - p.dx * off; // north / inside of the curve
      if (near || !blockAt(px, pz)) { next = p.s + 1.5; continue; }
      poles.push({ p, px, pz });
      // short spans on the curve keep the (straight) contact wire over the track
      const onCurve = p.x > RAIL.xCurve - 0.5 && p.z > RAIL.z - RAIL.R - 0.5;
      next = p.s + (onCurve ? 4.2 : 10);
    }
    poles.forEach((P, i) => {
      const gy = groundY(P.px, P.pz);
      cy(g, poleM, P.px, gy, P.pz, 0.12, 6.4, 10, { rt: 0.72 });
      const ay = P.p.y + 4.95;
      // bracket over the track + brace
      cyl2(g, poleM, [P.px, ay, P.pz], [P.p.x - P.p.dz * 0.25, ay, P.p.z + P.p.dx * 0.25], 0.04, 6);
      cyl2(g, poleM, [P.px, ay - 0.85, P.pz], [P.p.x + P.p.dz * 0.9, ay, P.p.z - P.p.dx * 0.9], 0.03, 6);
      cy(g, toon('#6a4a34'), P.px, gy + 6.2, P.pz, 0.06, 0.2, 6);
      const zig = (i % 2 ? 1 : -1) * 0.18;
      P.cw = [P.p.x - P.p.dz * zig, P.p.y + 4.3, P.p.z + P.p.dx * zig];
      P.mw = [P.p.x, P.p.y + 4.95, P.p.z];
      cyl2(g, wireM, P.mw, P.cw, 0.012, 4); // registration dropper at the pole
      // insulator
      cy(g, toon('#c8a46a'), P.p.x - P.p.dz * 0.25, ay - 0.08, P.p.z + P.p.dx * 0.25, 0.04, 0.16, 6);
    });
    for (let i = 0; i < poles.length - 1; i++) {
      const A = poles[i], B = poles[i + 1];
      if (B.p.s - A.p.s > 14) continue; // a crossing sits between: the wire is anchored on the next pair
      const span = B.p.s - A.p.s;
      cyl2(g, wireM, A.cw, B.cw, 0.012, 4);
      // messenger sags between the poles; droppers hang the contact wire from it
      const mid = (t) => [A.mw[0] + (B.mw[0] - A.mw[0]) * t, A.mw[1] + (B.mw[1] - A.mw[1]) * t - 0.032 * span * Math.sin(Math.PI * t), A.mw[2] + (B.mw[2] - A.mw[2]) * t];
      const cwAt = (t) => [A.cw[0] + (B.cw[0] - A.cw[0]) * t, A.cw[1] + (B.cw[1] - A.cw[1]) * t, A.cw[2] + (B.cw[2] - A.cw[2]) * t];
      let prev = A.mw;
      [0.25, 0.5, 0.75, 1].forEach((t) => { const q = t === 1 ? B.mw : mid(t); cyl2(g, wireM, prev, q, 0.014, 4); prev = q; });
      [0.25, 0.5, 0.75].forEach((t) => cyl2(g, wireM, mid(t), cwAt(t), 0.006, 3));
    }
    // continuous feeder along the pole tops
    for (let i = 0; i < poles.length - 1; i++) {
      const A = poles[i], B = poles[i + 1];
      cyl2(g, wireM, [A.px, groundY(A.px, A.pz) + 6.25, A.pz], [B.px, groundY(B.px, B.pz) + 6.25, B.pz], 0.015, 4);
    }
  }

  /* ---- fences near the crossings ---- */
  {
    const fm = toon('#9aa1b0');
    // posts only on solid ground (never across a road); rails join consecutive posts
    const fence = (x0, x1, z) => {
      const n = Math.max(1, Math.round((x1 - x0) / 1.6));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        if (!blockAt(x, z)) { prev = null; continue; }
        const y = groundY(x, z);
        cy(g, fm, x, y, z, 0.03, 1.0, 6);
        if (prev) [0.95, 0.5].forEach((h) => cyl2(g, fm, [prev[0], prev[1] + h, z], [x, y + h, z], 0.02, 5));
        prev = [x, y];
      }
    };
    roadCross.concat([foot]).forEach((c) => {
      [-3.0, 3.0].forEach((o) => { fence(c.x0 - 7, c.x0 - 0.8, RAIL.z + o); fence(c.x1 + 0.8, c.x1 + 7, RAIL.z + o); });
    });
  }

  /* ---- level crossing equipment ---- */
  const posts = [];
  const main = CROSSINGS.find((c) => c.id === 'main'), lane = CROSSINGS.find((c) => c.id === 'lane');
  posts.push(crossingPost(g, main.x0 - 0.35, RAIL.z + 2.35, 0, 1, 4.5));
  posts.push(crossingPost(g, main.x1 + 0.35, RAIL.z - 2.35, 0, -1, 4.5));
  posts.push(crossingPost(g, lane.x0 - 0.35, RAIL.z + 2.35, 0, 1, 3.1));
  posts.push(crossingPost(g, lane.x1 + 0.35, RAIL.z - 2.35, 0, -1, 3.1));
  posts.push(crossingPost(g, foot.x0 - 0.4, RAIL.z + 2.4, 0, 1, 0, { foot: true }));
  posts.push(crossingPost(g, foot.x1 + 0.4, RAIL.z - 2.4, 0, -1, 0, { foot: true }));
  // crossing state: idle (lamps off, arms up). reg.crossings.ring(sec) runs one warning cycle (for a future train).
  const state = { t: 0, until: 0 };
  reg.crossings = {
    posts,
    ring: (sec = 14) => { state.until = state.t + sec; },
    get active() { return state.t < state.until; },
  };
  const QS = new URLSearchParams(location.search);
  const demo = QS.get('crossing') === '1';
  reg.updaters.push((t, dt) => {
    state.t = t;
    if (demo && t % 45 < 0.05) reg.crossings.ring(14);
    const on = t < state.until;
    const phase = Math.floor(t * 1.6) % 2;
    posts.forEach((p) => {
      p.lamps.forEach((l, k) => {
        const lit = on && k === phase;
        l.lm.color.setRGB(lit ? 3.2 : 0.25, lit ? 0.35 : 0.03, lit ? 0.25 : 0.03);
        l.h.material.opacity = lit ? 0.9 : 0;
      });
      if (p.arm) {
        const target = on ? 0 : 1.38;
        p.arm.rotation.z += (target - p.arm.rotation.z) * Math.min(1, dt * 1.8);
      }
    });
  });

  /* ---- path data for a future train ---- */
  reg.railPath = {
    points: S.map((p) => ({ x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.dx, p.dz), s: p.s })),
    length: S[S.length - 1].s,
    at(s) {
      const P = this.points;
      s = Math.max(0, Math.min(this.length, s));
      let lo = 0, hi = P.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s < s) lo = m; else hi = m; }
      const a = P[lo], b = P[hi], t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, heading: a.heading };
    },
  };
  return { group: g };
}
