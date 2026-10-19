import * as THREE from 'three';
import { reg, toon, cy, cyl2, bx, grp, rng } from '../core.js';
import { LAKE, lakeF, lakeParkH, WATER_Y } from './layout.js';

/* ====================================================================================================
   The lake (Block D). The basin is part of the lake-park terrain (layout.lakeParkH); this file adds the
   water surface, the lakeside walk, a short timber railing, a small jetty, shore rocks and reeds.
   Water colour follows the environment (sky colour, day/night, cold season), rain draws rings,
   sun / moon leave glints and, whenever the planar reflection is rendered, the shore mirrors in it.
   ==================================================================================================== */

const GLSL_LAKE = /* glsl */ `
  float lakeF(vec2 p){
    vec2 d = (p - vec2(${LAKE.cx.toFixed(2)}, ${LAKE.cz.toFixed(2)})) / vec2(${LAKE.rx.toFixed(2)}, ${LAKE.rz.toFixed(2)});
    float a = atan(d.y, d.x);
    float rr = 1.0 + 0.12 * sin(3.0 * a + 1.3) + 0.07 * sin(5.0 * a + 0.4) + 0.04 * sin(8.0 * a + 2.1);
    return length(d) / rr;
  }
  float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  float bedH(vec2 p){ float f = lakeF(p); return 0.15 - 0.5 * (1.0 - ss(0.95, 1.45, f)) - 0.6 * (1.0 - ss(0.55, 1.02, f)); }
`;

export function buildLake(parent, refl) {
  const g = grp(parent);
  const R = rng(5150);

  /* ---------------------------------------------------------------- water */
  const U = {
    uTime: { value: 0 }, uRain: { value: 0 }, uDay: { value: 0 }, uNight: { value: 1 },
    uSkyLo: { value: new THREE.Color('#1c2550') }, uSkyHi: { value: new THREE.Color('#0b1030') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) }, uSunVis: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonVis: { value: 0 },
    uCold: { value: 0 }, uFlash: { value: 0 }, uWind: { value: 0 },
    tRefl: { value: refl.rt.texture }, uTexMat: { value: refl.texMat }, uReflK: { value: 0 },
  };
  reg.lakeU = U;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */ `
      varying vec3 vWPos;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uRain, uDay, uNight, uSunVis, uMoonVis, uCold, uFlash, uReflK, uWind;
      uniform vec3 uSkyLo, uSkyHi, uSunDir, uSunCol, uMoonDir;
      uniform sampler2D tRefl; uniform mat4 uTexMat;
      varying vec3 vWPos;
      #include <fog_pars_fragment>
      ${GLSL_LAKE}
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 ring(vec2 p, float t, float cell, float seed){
        vec2 q = p / cell; vec2 id = floor(q); vec2 f = fract(q);
        float h = h21(id + seed), h2 = h21(id + seed + 17.3);
        float ph = fract(t / (0.8 + h * 0.8) + h2);
        vec2 c = vec2(0.3 + 0.4 * h21(id + seed + 3.1), 0.3 + 0.4 * h21(id + seed + 9.7));
        vec2 d = (f - c) * cell; float r = length(d);
        float R = ph * cell * 0.42, w = 0.03 + ph * 0.02 + fwidth(r);
        float k = smoothstep(w, 0.0, abs(r - R)) * (1.0 - ph) * (1.0 - ph) * step(0.35, h);
        return vec3(k, d / (r + 1e-4) * k);
      }
      void main(){
        vec2 p = vWPos.xz;
        float depth = ${WATER_Y.toFixed(2)} - bedH(p);
        if (depth < -0.02) discard;
        // gentle wind waves + rain rings perturb the normal
        float t = uTime;
        vec2 gr = vec2(
          cos(p.x * 1.7 + t * 1.1) * 0.6 + cos(p.x * 3.1 - p.y * 2.3 + t * 1.7) * 0.35,
          cos(p.y * 1.9 - t * 0.9) * 0.6 + cos(p.y * 2.7 + p.x * 1.6 - t * 1.4) * 0.35) * (0.012 + uWind * 0.08);
        vec3 r1 = ring(p, t, 0.8, 1.0), r2 = ring(p + 3.7, t * 1.13, 0.55, 7.0), r3 = ring(p - 5.1, t * 0.91, 1.1, 13.0);
        vec3 rr = (r1 + r2 + r3) * uRain;
        gr += rr.yz * 0.22;
        vec3 N = normalize(vec3(-gr.x, 1.0, -gr.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 Rv = reflect(-V, N);
        vec3 sky = mix(uSkyLo, uSkyHi, clamp(Rv.y * 1.5, 0.0, 1.0));
        // planar reflection (rendered when the lake or wet streets are on screen)
        vec4 rc = uTexMat * vec4(vWPos.x, 0.0, vWPos.z, 1.0);
        vec3 rt = texture2D(tRefl, rc.xy / rc.w + N.xz * 0.04).rgb;
        vec3 refl = mix(sky, rt + sky * 0.25, uReflK);
        // water body: deep teal by day, ink blue at night, grey-blue and clear in the cold season
        vec3 deepD = mix(vec3(0.07, 0.2, 0.24), vec3(0.16, 0.22, 0.28), uCold);
        vec3 deepN = mix(vec3(0.015, 0.04, 0.07), vec3(0.03, 0.05, 0.08), uCold);
        vec3 deep = mix(deepN, deepD, uDay);
        vec3 shallow = mix(vec3(0.03, 0.06, 0.07), vec3(0.24, 0.3, 0.26), uDay);
        vec3 body = mix(shallow, deep, smoothstep(0.0, 0.45, depth));
        vec3 col = mix(body, refl, clamp(fres * 0.9 + 0.12, 0.0, 1.0));
        // glints
        float sg = pow(max(dot(reflect(-normalize(uSunDir), N), V), 0.0), 140.0) * uSunVis;
        float mg = pow(max(dot(reflect(-normalize(uMoonDir), N), V), 0.0), 90.0) * uMoonVis;
        col += uSunCol * sg * 2.2 + vec3(0.7, 0.8, 1.0) * mg * 0.9;
        col += vec3(0.55, 0.7, 0.95) * rr.x * (0.25 + 0.25 * uNight);
        // a little foam / lighter water where it laps the shore
        col = mix(col, mix(vec3(0.25, 0.3, 0.35), vec3(0.8, 0.85, 0.85), uDay), smoothstep(0.07, 0.0, depth) * 0.3);
        col += vec3(0.45, 0.55, 0.85) * uFlash * 0.45;
        float alpha = mix(0.45, 0.94, smoothstep(0.0, 0.28, depth));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  Object.assign(mat.uniforms, U);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(27, 19, 1, 1).rotateX(-Math.PI / 2), mat);
  water.position.set(-32.2, WATER_Y, -33.3);
  water.userData.noLine = true;
  water.renderOrder = 2;
  reg.noRefl.push(water);
  g.add(water);
  reg.updaters.push((t) => (U.uTime.value = t));

  /* ---------------------------------------------------------------- lakeside walk (ribbon on the bank) */
  const PATH_F = 1.2;
  const ringPts = [];
  const rr = (a) => 1 + 0.12 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4) + 0.04 * Math.sin(8 * a + 2.1);
  const NP = 160;
  for (let i = 0; i < NP; i++) {
    const a = (i / NP) * Math.PI * 2;
    const t = PATH_F * rr(a);
    let x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
    x = Math.min(x, -19.7); z = Math.max(-43.0, Math.min(z, -23.8));
    ringPts.push([x, z, a]);
  }
  const pos = [], nor = [], idx = [];
  const HW = 0.62;
  for (let i = 0; i < NP; i++) {
    const [x, z] = ringPts[i], [xn, zn] = ringPts[(i + 1) % NP], [xp, zp] = ringPts[(i + NP - 1) % NP];
    let tx = xn - xp, tz = zn - zp; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const nx = -tz, nz = tx;
    [[x + nx * HW, z + nz * HW], [x - nx * HW, z - nz * HW]].forEach(([px, pz]) => { pos.push(px, lakeParkH(px, pz) + 0.035, pz); nor.push(0, 1, 0); });
    const a = i * 2, b = ((i + 1) % NP) * 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  pg.setIndex(idx);
  // faces point up whatever the ring direction
  pg.computeVertexNormals();
  if (pg.attributes.normal.getY(0) < 0) { const I = pg.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } pg.computeVertexNormals(); }
  const path = new THREE.Mesh(pg, toon('#6e6a6c'));
  path.receiveShadow = true;
  g.add(path);
  // path edging stones (little kerb on the water side)
  const edgeM = toon('#8a8790');
  for (let i = 0; i < NP; i += 2) {
    const [x, z] = ringPts[i], [xn, zn] = ringPts[(i + 2) % NP];
    const mx = (x + xn) / 2, mz = (z + zn) / 2;
    const dx = mx - LAKE.cx, dz = mz - LAKE.cz, l = Math.hypot(dx, dz);
    const ex = mx - (dx / l) * (HW + 0.06), ez = mz - (dz / l) * (HW + 0.06);
    const e = cyl2(g, edgeM, [x - (dx / l) * (HW + 0.06), lakeParkH(ex, ez) + 0.06, z - (dz / l) * (HW + 0.06)], [xn - (dx / l) * (HW + 0.06), lakeParkH(ex, ez) + 0.06, zn - (dz / l) * (HW + 0.06)], 0.06, 5);
    e.castShadow = false;
  }

  /* timber railing on the steeper south and east banks */
  const wood = toon('#6a4a34');
  const rail = (a0, a1) => {
    let prev = null;
    for (let a = a0; a <= a1 + 1e-6; a += 0.075) {
      const t = (PATH_F - 0.065) * rr(a);
      let x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
      x = Math.min(x, -20.3);
      const y = lakeParkH(x, z);
      cy(g, wood, x, y, z, 0.045, 0.9, 6);
      if (prev) { cyl2(g, wood, [prev[0], prev[1] + 0.85, prev[2]], [x, y + 0.85, z], 0.035, 5); cyl2(g, wood, [prev[0], prev[1] + 0.48, prev[2]], [x, y + 0.48, z], 0.03, 5); }
      prev = [x, y, z];
    }
  };
  rail(0.55, 1.45); rail(-0.55, 0.05);

  /* small jetty on the south shore */
  {
    const a = 1.75, t0 = (PATH_F - 0.1) * rr(a);
    const sx = LAKE.cx + Math.cos(a) * LAKE.rx * t0, sz = LAKE.cz + Math.sin(a) * LAKE.rz * t0;
    const ang = Math.atan2(LAKE.cz - sz, LAKE.cx - sx);
    const J = grp(g, sx, WATER_Y + 0.28, sz, -ang + Math.PI / 2);
    const deck = toon('#7a5a40');
    for (let i = 0; i < 11; i++) bx(J, deck, -0.7, 0.7, 0, 0.06, i * 0.3, i * 0.3 + 0.26, { cast: true });
    [[-0.65, 0.3], [0.65, 0.3], [-0.65, 3.0], [0.65, 3.0]].forEach(([x, z]) => cy(J, wood, x, -0.55, z, 0.06, 0.62, 6));
    [[-0.68], [0.68]].forEach(([x]) => { cy(J, wood, x, 0.06, 3.15, 0.04, 0.7, 6); });
    cyl2(J, wood, [-0.68, 0.72, 3.15], [0.68, 0.72, 3.15], 0.035, 5);
  }

  /* ---------------------------------------------------------------- shore rocks + reeds (instanced) */
  {
    let rg = new THREE.IcosahedronGeometry(1, 1);
    const p = rg.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.78 + 0.35 * Math.abs(Math.sin(p.getX(i) * 4.1 + p.getY(i) * 2.3 + p.getZ(i) * 3.7)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
    rg.computeVertexNormals();
    const N = 46;
    const rocks = new THREE.InstancedMesh(rg, toon('#5d6170'), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < 400 && n < N; i++) {
      const a = R() * Math.PI * 2, t = (0.97 + R() * 0.12) * rr(a);
      const x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
      if (x > -20.5 || Math.abs(lakeF(x, z) - 1.02) > 0.07) continue;
      // clusters: a big stone usually has a smaller one next to it
      const k = R() < 0.3 ? 0.45 + R() * 0.35 : 0.16 + R() * 0.22;
      e.set(R() * 0.4, R() * 6.28, R() * 0.4); q.setFromEuler(e);
      m4.compose(v.set(x, lakeParkH(x, z) - 0.04, z), q, s.set(k * (0.9 + R() * 0.5), k, k * (0.8 + R() * 0.4)));
      rocks.setMatrixAt(n++, m4);
    }
    rocks.count = n;
    rocks.castShadow = true; rocks.receiveShadow = true;
    g.add(rocks);

    const blade = new THREE.ConeGeometry(0.035, 1, 3, 1);
    blade.translate(0, 0.5, 0);
    const reeds = new THREE.InstancedMesh(blade, toon('#5d7a48', { e: '#0c1a0c', ei: 0.4 }), 420);
    n = 0;
    for (let c = 0; c < 14; c++) {
      const a0 = R() * Math.PI * 2;
      for (let j = 0; j < 30; j++) {
        const a = a0 + (R() - 0.5) * 0.18, t = (0.93 + R() * 0.07) * rr(a);
        const x = LAKE.cx + Math.cos(a) * LAKE.rx * t, z = LAKE.cz + Math.sin(a) * LAKE.rz * t;
        if (x > -20.6) continue;
        e.set((R() - 0.5) * 0.35, R() * 6.28, (R() - 0.5) * 0.35); q.setFromEuler(e);
        const hgt = 0.5 + R() * 0.7;
        m4.compose(v.set(x, Math.max(WATER_Y - 0.05, lakeParkH(x, z)), z), q, s.set(1, hgt, 1));
        reeds.setMatrixAt(n++, m4);
        if (n >= 420) break;
      }
    }
    reeds.count = n;
    reeds.castShadow = false;
    g.add(reeds);
  }

  return { group: g, water, ringPts, U };
}
