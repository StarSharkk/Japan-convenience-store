import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reg, rng } from './core.js';

/* ====================================================================================================
   Modelled clouds round the floating island (town/island.js): soft rounded clumps, each a few merged blobs (a flat
   base, a puffy top), in three layers - a few near ones low beside the tray, a ring in the middle distance, more far
   off - some above the island, some below the tray's rim so the piece reads as floating in the sky. They drift
   round very slowly and bob a little. Shading: warm white on the sunlit side, a soft blue-grey underneath, a bright
   rim against the light; at night cool and dim (the town's lights stay the brightest thing).
   ==================================================================================================== */

function cloudGeo(R, w, h) {
  const parts = [];
  const n = 5 + ((R() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const r = (0.45 + R() * 0.4) * h * (1 - Math.abs(t) * 0.7);
    const g = new THREE.IcosahedronGeometry(1, 3);
    g.scale(r * (1.1 + R() * 0.4), r * (0.8 + R() * 0.3), r * (1.0 + R() * 0.4));
    g.translate(t * w + (R() - 0.5) * w * 0.15, r * 0.35 + R() * h * 0.25, (R() - 0.5) * w * 0.25);
    parts.push(g);
  }
  // a flattened base so it sits like a cloud, not a ball
  const b = new THREE.IcosahedronGeometry(1, 3); b.scale(w * 0.62, h * 0.32, w * 0.3); b.translate(0, h * 0.1, 0); parts.push(b);
  const geo = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }), false);
  geo.computeVertexNormals();
  return geo;
}

export function buildClouds(parent, centre = [-6, -6]) {
  const W = reg.waterU; // shared sun / day / sky uniforms (waterSystem.js, driven by env.js)
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSkyLo, uSkyHi; uniform float uDay, uSunVis, uCloud;
      varying vec3 vN; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSunDir);
        float lit = clamp(dot(n, L) * 0.55 + n.y * 0.45 + 0.25, 0.0, 1.0);
        lit = smoothstep(0.15, 0.85, lit); // a soft two-tone (toon) step
        vec3 dayLit = vec3(1.0, 0.985, 0.955), dayShade = mix(vec3(0.74, 0.8, 0.9), uSkyLo, 0.25);
        vec3 nightLit = vec3(0.42, 0.47, 0.62), nightShade = vec3(0.2, 0.23, 0.36);
        vec3 c = mix(mix(nightShade, dayShade, uDay), mix(nightLit, dayLit, uDay), lit);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        c += rim * mix(vec3(0.1, 0.12, 0.2), vec3(0.2, 0.2, 0.18), uDay) * (0.5 + 0.5 * uSunVis);
        c = mix(c, c * 0.72 + uSkyLo * 0.2, uCloud * 0.8); // overcast / rain: greyer, closer to the sky
        // a gentle haze with distance (not the town's full fog: far clouds keep their shape)
        c = mix(c, fogColor, 0.45 * smoothstep(120.0, 460.0, length(cameraPosition - vW)));
        gl_FragColor = vec4(c, 1.0);
      }`,
    fog: true,
  });
  Object.assign(mat.uniforms, { uSunDir: W.uSunDir, uSkyLo: W.uSkyLo, uSkyHi: W.uSkyHi, uDay: W.uDay, uSunVis: W.uSunVis, uCloud: W.uCloud });

  const g = new THREE.Group();
  g.name = 'CloudGroup';
  parent.add(g);
  const R = rng(3131), list = [];
  // [count, radius range, height range, size range]
  const layers = [
    [6, [90, 104], [-8, 6], [6, 10]], // near: low beside the tray, some below its rim
    [9, [112, 148], [-22, 26], [9, 15]], // middle
    [12, [160, 225], [-30, 45], [15, 24]], // far
  ];
  layers.forEach(([n, [r0, r1], [y0, y1], [s0, s1]], li) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.5 + li;
      const r = r0 + R() * (r1 - r0), y = y0 + R() * (y1 - y0), w = s0 + R() * (s1 - s0);
      const m = new THREE.Mesh(cloudGeo(R, w, w * (0.38 + R() * 0.18)), mat);
      m.userData.noLine = true; m.userData.noRefl = true; m.frustumCulled = true;
      reg.noRefl.push(m); g.add(m);
      list.push({ m, a, r, y, sp: (0.0016 + R() * 0.0018) * (R() < 0.5 ? 1 : -1) * (li ? 1 : 0.7), bob: R() * 6.28, ry: R() * 6.28 });
    }
  });
  const place = (c, t) => { const a = c.a + c.sp * t; c.m.position.set(centre[0] + Math.cos(a) * c.r, c.y + Math.sin(t * 0.15 + c.bob) * 0.6, centre[1] + Math.sin(a) * c.r); c.m.rotation.y = c.ry - a * 0.5; };
  list.forEach((c) => place(c, 0));
  reg.updaters.push((t) => list.forEach((c) => place(c, t)));
  reg.clouds = { g, list };
  return g;
}
