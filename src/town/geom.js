import * as THREE from 'three';

/* small polygon / surface helpers for the town (all polygons are [[x, z], ...] rings) */

/** signed area, > 0 for a counter-clockwise ring (x right, z up) */
export function area(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
  return a / 2;
}

/** Sutherland–Hodgman: clip `subject` (any ring) by a CONVEX `clip` ring */
export function clipConvex(subject, clip) {
  const ccw = area(clip) > 0; // area() > 0  <=>  counter-clockwise in (x, z)
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const side = (p) => { const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); return ccw ? c : -c; }; // >= 0: inside
    const inp = out;
    out = [];
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k], q = inp[(k + 1) % inp.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** move every edge of a convex ring inwards by d (negative d grows it) */
export function offsetConvex(poly, d) {
  const n = poly.length;
  const s = area(poly) > 0 ? 1 : -1; // left normal points inwards on a CCW ring
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = (-dz / L) * s * d, nz = (dx / L) * s * d;
    lines.push([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz]]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const [p1, p2] = lines[(i + n - 1) % n], [p3, p4] = lines[i];
    const d1x = p2[0] - p1[0], d1z = p2[1] - p1[1], d2x = p4[0] - p3[0], d2z = p4[1] - p3[1];
    const den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) { out.push(p3); continue; }
    const t = ((p3[0] - p1[0]) * d2z - (p3[1] - p1[1]) * d2x) / den;
    out.push([p1[0] + d1x * t, p1[1] + d1z * t]);
  }
  return out;
}

/**
 * Height-field surface clipped to `poly` (and the convex `bound`): a grid of `step` cells, every cell
 * clipped and triangulated, smooth normals from the height function.
 */
export function surface(poly, hFn, step, bound, uvFn) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) / step) * step, x1 = Math.max(...xs);
  const z0 = Math.floor(Math.min(...zs) / step) * step, z1 = Math.max(...zs);
  const pos = [], nor = [], idx = [];
  const e = 0.05;
  const put = (x, z) => {
    const y = hFn(x, z);
    const gx = (hFn(x + e, z) - hFn(x - e, z)) / (2 * e), gz = (hFn(x, z + e) - hFn(x, z - e)) / (2 * e);
    const l = Math.hypot(gx, 1, gz);
    pos.push(x, y, z);
    nor.push(-gx / l, 1 / l, -gz / l);
    return pos.length / 3 - 1;
  };
  for (let x = x0; x < x1; x += step) {
    for (let z = z0; z < z1; z += step) {
      const cell = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      let c = clipConvex(poly, cell);
      if (c.length >= 3 && bound) c = clipConvex(c, bound);
      if (c.length < 3 || Math.abs(area(c)) < 1e-5) continue;
      const v2 = c.map((p) => new THREE.Vector2(p[0], p[1]));
      const tris = THREE.ShapeUtils.triangulateShape(v2, []);
      const base = c.map((p) => put(p[0], p[1]));
      tris.forEach((t) => {
        // keep the faces pointing up: (x, z) winding decides it
        const A = c[t[0]], B = c[t[1]], C = c[t[2]];
        const cr = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        if (cr > 0) idx.push(base[t[0]], base[t[2]], base[t[1]]);
        else idx.push(base[t[0]], base[t[1]], base[t[2]]);
      });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uvFn) {
    const uv = [];
    for (let i = 0; i < pos.length; i += 3) uv.push(...uvFn(pos[i], pos[i + 2]));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  g.setIndex(idx);
  return g;
}

/**
 * Vertical side walls along the ring from bottom(x,z) up to top(x,z), facing out of the polygon.
 * Returns { low, high } geometries (kerb-height walls vs. retaining walls taller than `split`).
 */
export function walls(poly, top, bottom, { split = 0.45, skip = () => false, seg = 0.5 } = {}) {
  const out = { low: { p: [], n: [], u: [], i: [] }, high: { p: [], n: [], u: [], i: [] } };
  const s = area(poly) > 0 ? 1 : -1; // right normal points outwards on a CCW ring
  let run = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 1e-4) continue;
    const nx = (dz / L) * s, nz = (-dx / L) * s; // outward
    const n = Math.max(1, Math.ceil(L / seg));
    for (let j = 0; j < n; j++) {
      const t0 = j / n, t1 = (j + 1) / n;
      const p0 = [a[0] + dx * t0, a[1] + dz * t0], p1 = [a[0] + dx * t1, a[1] + dz * t1];
      const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      if (skip(mx, mz, nx, nz)) { run += L / n; continue; }
      const ta = top(p0[0], p0[1]), tb = top(p1[0], p1[1]);
      const ba = bottom(p0[0] + nx * 0.05, p0[1] + nz * 0.05) - 0.03, bb = bottom(p1[0] + nx * 0.05, p1[1] + nz * 0.05) - 0.03;
      if (ta - ba < 0.03 && tb - bb < 0.03) { run += L / n; continue; }
      const O = Math.max(ta - ba, tb - bb) > split ? out.high : out.low;
      const base = O.p.length / 3;
      O.p.push(p0[0], ba, p0[1], p1[0], bb, p1[1], p1[0], tb, p1[1], p0[0], ta, p0[1]);
      for (let q = 0; q < 4; q++) O.n.push(nx, 0, nz);
      const u0 = run, u1 = run + L / n;
      O.u.push(u0, ba, u1, bb, u1, tb, u0, ta);
      O.i.push(base, base + 2, base + 1, base, base + 3, base + 2); // front faces look out of the block
      run += L / n;
    }
  }
  const mk = (O) => {
    if (!O.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(O.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(O.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(O.u, 2));
    g.setIndex(O.i);
    return g;
  };
  return { low: mk(out.low), high: mk(out.high) };
}

/** points along a polyline every `step`, with tangent */
export function samplePolyline(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < n; j++) out.push({ x: ax + ((bx - ax) * j) / n, z: az + ((bz - az) * j) / n, dx: (bx - ax) / L, dz: (bz - az) / L });
  }
  const [lx, lz] = pts[pts.length - 1], [px, pz] = pts[pts.length - 2];
  const L = Math.hypot(lx - px, lz - pz);
  out.push({ x: lx, z: lz, dx: (lx - px) / L, dz: (lz - pz) / L });
  return out;
}
