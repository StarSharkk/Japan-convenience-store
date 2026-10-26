import * as THREE from 'three';
import { reg, toon, canvasTex, rng, bx, pl, FONT, RAMP, roundRect } from './core.js';
import { P, groundPaint, shade, rgb } from './palette.js';

/* world (x,z in [-12,12]) -> canvas */
const S = 3072;
const K = S / 24;
const X = (x) => (x + 12) * K;
const Z = (z) => (z + 12) * K;

export const PLOT = { x0: -12, x1: 7.5, z0: -12, z1: 6.5, r: 1.1, h: 0.15 };

function drawGround(g) {
  const R = rng(7);
  const rect = (x0, x1, z0, z1, c) => {
    g.fillStyle = c;
    g.fillRect(X(x0), Z(z0), (x1 - x0) * K, (z1 - z0) * K);
  };
  const line = (x0, z0, x1, z1, c, w) => {
    g.strokeStyle = c;
    g.lineWidth = w * K;
    g.beginPath();
    g.moveTo(X(x0), Z(z0));
    g.lineTo(X(x1), Z(z1));
    g.stroke();
  };

  /* ---- asphalt ---- */
  rect(-12, 12, -12, 12, '#1b2133');
  // large soft tonal drifts only (no per-pixel grain: it reads as low-res noise, not as vector paint)
  for (let i = 0; i < 40; i++) {
    const x = -12 + R() * 24, z = -12 + R() * 24;
    const rr = (1.5 + R() * 4) * K;
    const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), rr);
    const c = R() < 0.5 ? '255,255,255' : '0,0,14';
    gr.addColorStop(0, `rgba(${c},${0.035 + R() * 0.03})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(X(x) - rr, Z(z) - rr, rr * 2, rr * 2);
  }

  /* ---- plot (raised pavement): the shared pavings (palette.js) - walk tiles, the shop apron, concrete yards ---- */
  const walkA = groundPaint(P.paveWalk), walkB = groundPaint(P.paveWalk2);
  const shopA = groundPaint(P.paveShop), shopB = groundPaint(P.paveShop2);
  const conc = groundPaint(P.concrete), joint = (a) => `rgba(${P.joint},${a})`;
  g.fillStyle = walkB;
  g.beginPath();
  const { x0, x1, z0, z1, r } = PLOT;
  g.moveTo(X(x0), Z(z0));
  g.lineTo(X(x1), Z(z0));
  g.lineTo(X(x1), Z(z1 - r));
  g.arc(X(x1 - r), Z(z1 - r), r * K, 0, Math.PI / 2);
  g.lineTo(X(x0), Z(z1));
  g.closePath();
  g.fill();

  const tiles = (xa, xb, za, zb, a, b, step = 0.6) => {
    for (let x = xa; x < xb; x += step)
      for (let z = za; z < zb; z += step) {
        g.fillStyle = (Math.floor((x - xa) / step) + Math.floor((z - za) / step)) % 2 ? a : b;
        g.fillRect(X(x), Z(z), step * K, step * K);
      }
    g.strokeStyle = joint(0.35);
    g.lineWidth = 2.2;
    g.beginPath();
    for (let x = xa; x <= xb + 0.001; x += step) { g.moveTo(X(x), Z(za)); g.lineTo(X(x), Z(zb)); }
    for (let z = za; z <= zb + 0.001; z += step) { g.moveTo(X(xa), Z(z)); g.lineTo(X(xb), Z(z)); }
    g.stroke();
  };

  // east sidewalk, front sidewalk
  tiles(4.5, 7.5, -12, 6.5, walkA, walkB);
  tiles(-12, 4.5, 5.75, 6.5, walkA, walkB);
  // store apron
  tiles(-5.75, 4.5, 1.5, 2.75, shopA, shopB, 0.3125);
  // neighbour front yard
  tiles(-12, -8.5, 3.0, 5.75, walkB, walkA);
  // alley + back yard concrete
  rect(-8.5, -5.5, -7.3, 5.75, conc);
  rect(-5.5, 4.5, -7.3, -4.5, conc);
  line(-7, -7.3, -7, 5.75, joint(0.55), 0.06);
  for (let i = 0; i < 26; i++) line(-8.5, -7.3 + i * 0.5, -5.5, -7.3 + i * 0.5 + (R() - 0.5) * 0.1, joint(0.3), 0.012);
  // soft lawn behind the wall (quiet dark teal-green, painted as flat vector shapes)
  rect(-12, 4.5, -12, -7.3, '#1f3a34');
  for (let i = 0; i < 46; i++) {
    const x = -12 + R() * 16.5, z = -12 + R() * 4.6;
    const rr = (0.8 + R() * 2.2) * K;
    const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), rr);
    const c = R() < 0.55 ? '70,140,110' : '8,30,30';
    gr.addColorStop(0, `rgba(${c},0.22)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(X(x) - rr, Z(z) - rr, rr * 2, rr * 2);
  }
  // stepping stones from the gate
  for (let i = 0; i < 6; i++) { g.fillStyle = walkA; g.beginPath(); g.ellipse(X(-7 + Math.sin(i) * 0.25), Z(-7.9 - i * 0.62), 0.3 * K, 0.22 * K, 0, 0, 7); g.fill(); }
  // east pavement continues behind the store
  tiles(4.5, 7.5, -12, -4.5, walkA, walkB);

  // parking lot
  rect(-5.75, 0.55, 2.75, 5.75, '#242b3e');
  g.fillStyle = 'rgba(0,0,0,0)';
  const stall = ['-5.75', '-4.05', '-2.35', '-0.65', '0.55'];
  stall.forEach((s) => line(+s, 2.9, +s, 5.6, '#cfd6e6', 0.07));
  line(-5.75, 2.9, 0.55, 2.9, '#cfd6e6', 0.05);

  // tactile paving: town/roadside.js (3D blocks over the whole town)

  // door mat zone (lighter) + guide
  rect(1.1, 3.3, 1.5, 2.7, groundPaint(P.cream));

  /* ---- road markings ---- */
  const dash = (x0_, z0_, x1_, z1_, len, gap, c, w) => {
    const L = Math.hypot(x1_ - x0_, z1_ - z0_);
    const dx = (x1_ - x0_) / L, dz = (z1_ - z0_) / L;
    for (let d = 0; d < L; d += len + gap) line(x0_ + dx * d, z0_ + dz * d, x0_ + dx * Math.min(d + len, L), z0_ + dz * Math.min(d + len, L), c, w);
  };
  const white = '#cfd5e2';
  // south road centre dashes, east road centre dashes (stop before crossing)
  dash(-12, 9.45, 4.6, 9.45, 1.6, 1.4, white, 0.12);
  dash(9.75, -12, 9.75, 3.9, 1.6, 1.4, white, 0.12);
  // road edge lines
  line(-12, 7.15, 5.0, 7.15, white, 0.1);
  line(8.15, -12, 8.15, 4.3, white, 0.1);
  // zebra crossings
  for (let z = 7.0; z < 11.9; z += 0.62) { g.fillStyle = white; g.fillRect(X(5.2), Z(z), 1.6 * K, 0.34 * K); }
  for (let x = 7.9; x < 11.9; x += 0.62) { g.fillStyle = white; g.fillRect(X(x), Z(4.6), 0.34 * K, 1.6 * K); }
  // stop lines
  rect(4.6, 4.95, 9.55, 11.95, white);
  rect(9.85, 11.95, 3.95, 4.3, white);
  // crossing edge lines (inside intersection)
  // arrows
  const arrow = (cx, cz, ang) => {
    g.save();
    g.translate(X(cx), Z(cz));
    g.rotate(ang);
    g.fillStyle = white;
    const s = K;
    g.beginPath();
    g.moveTo(-0.9 * s, -0.12 * s); g.lineTo(0.35 * s, -0.12 * s); g.lineTo(0.35 * s, -0.4 * s); g.lineTo(1.0 * s, 0); g.lineTo(0.35 * s, 0.4 * s); g.lineTo(0.35 * s, 0.12 * s); g.lineTo(-0.9 * s, 0.12 * s);
    g.closePath();
    g.fill();
    g.restore();
  };
  arrow(1.8, 8.2, 0);
  arrow(-6.5, 8.2, 0);
  arrow(10.9, -1.5, Math.PI / 2);
  arrow(10.9, -7.5, Math.PI / 2);
  // 止まれ painted text
  g.save();
  g.translate(X(10.8), Z(2.3));
  g.rotate(Math.PI / 2 * 0);
  g.fillStyle = white;
  g.font = `bold ${0.9 * K}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.scale(1, 2.2);
  g.fillText('止まれ', 0, 0);
  g.restore();

  // gutters along curbs
  const gutter = (xa, xb, za, zb, vertical) => {
    g.fillStyle = '#10151f';
    g.fillRect(X(xa), Z(za), (xb - xa) * K, (zb - za) * K);
    g.fillStyle = '#2d3548';
    if (vertical) { g.fillRect(X(xa), Z(za), 2, (zb - za) * K); g.fillRect(X(xb) - 2, Z(za), 2, (zb - za) * K); }
    else { g.fillRect(X(xa), Z(za), (xb - xa) * K, 2); g.fillRect(X(xa), Z(zb) - 2, (xb - xa) * K, 2); }
  };
  gutter(-12, 7.5, 6.5, 6.85, false);
  gutter(7.5, 7.85, -12, 6.85, true);
  gutter(-12, 12, 11.65, 12, false);
  gutter(11.65, 12, -12, 11.65, true);
  line(-12, 11.35, 4.6, 11.35, white, 0.1);
  line(11.35, -12, 11.35, 3.9, white, 0.1);
  // storm grates
  const grate = (cx, cz, w, h) => {
    g.fillStyle = '#0a0d15';
    g.fillRect(X(cx - w / 2), Z(cz - h / 2), w * K, h * K);
    g.fillStyle = '#3b4560';
    if (w > h) for (let x = cx - w / 2 + 0.05; x < cx + w / 2 - 0.03; x += 0.1) g.fillRect(X(x), Z(cz - h / 2) + 3, 0.035 * K, h * K - 6);
    else for (let z = cz - h / 2 + 0.05; z < cz + h / 2 - 0.03; z += 0.1) g.fillRect(X(cx - w / 2) + 3, Z(z), w * K - 6, 0.035 * K);
    g.strokeStyle = '#4a5572'; g.lineWidth = 3; g.strokeRect(X(cx - w / 2), Z(cz - h / 2), w * K, h * K);
  };
  [-9.2, -5.5, -1.4, 3.2, 6.9].forEach((x) => grate(x, 6.675, 0.9, 0.3));
  [-9.5, -4.5, 0.5, 4.0].forEach((z) => grate(7.675, z, 0.3, 0.9));
  grate(7.675, 6.675, 0.5, 0.5);

  // manholes
  const manhole = (cx, cz, rr) => {
    g.fillStyle = '#12172a';
    g.beginPath(); g.arc(X(cx), Z(cz), rr * K, 0, 7); g.fill();
    g.strokeStyle = '#475270'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = '#2b3350'; g.lineWidth = 2;
    for (let a = -rr; a <= rr; a += 0.1) {
      g.beginPath(); g.moveTo(X(cx + a), Z(cz - Math.sqrt(Math.max(0, rr * rr - a * a)) * 0.9)); g.lineTo(X(cx + a), Z(cz + Math.sqrt(Math.max(0, rr * rr - a * a)) * 0.9)); g.stroke();
    }
    g.beginPath(); g.arc(X(cx), Z(cz), rr * 0.62 * K, 0, 7); g.stroke();
  };
  manhole(10.9, 9.0, 0.38);
  manhole(1.8, 10.6, 0.34);
  manhole(-7.0, 3.5, 0.28);
  manhole(-0.4, 7.9, 0.3);

  // cracks / patches / stains
  for (let i = 0; i < 26; i++) {
    let x = -12 + R() * 24, z = -12 + R() * 24;
    g.strokeStyle = 'rgba(2,4,12,0.55)';
    g.lineWidth = 1.5 + R() * 1.5;
    g.beginPath(); g.moveTo(X(x), Z(z));
    for (let j = 0; j < 7; j++) { x += (R() - 0.5) * 0.6; z += (R() - 0.35) * 0.5; g.lineTo(X(x), Z(z)); }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = R() < 0.6 ? 8 + R() * 4 : -12 + R() * 19, z = R() < 0.5 ? 7 + R() * 5 : -12 + R() * 20;
    g.fillStyle = 'rgba(5,6,16,0.28)';
    g.beginPath(); g.ellipse(X(x), Z(z), (0.25 + R() * 0.6) * K, (0.2 + R() * 0.4) * K, R() * 3, 0, 7); g.fill();
  }

  // curb highlight line along plot edge (painted)
  g.strokeStyle = `rgba(${rgb(P.cream)},0.3)`;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(X(x0), Z(z1) - 1);
  g.lineTo(X(x1 - r), Z(z1) - 1);
  g.arc(X(x1 - r), Z(z1 - r), r * K, Math.PI / 2, 0, true);
  g.lineTo(X(x1) - 1, Z(z0));
  g.stroke();
}

function drawMask(g, w, h) {
  const k = w / 24;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const R = rng(99);
  const blob = (x, z, rx, rz, rot = 0, n = 5) => {
    for (let i = 0; i < n; i++) {
      const ox = (R() - 0.5) * rx * 1.1, oz = (R() - 0.5) * rz * 1.1;
      const sx = rx * (0.45 + R() * 0.5), sz = rz * (0.45 + R() * 0.5);
      g.save();
      g.translate((x + ox + 12) * k, (z + oz + 12) * k);
      g.rotate(rot);
      g.scale(sx * k, sz * k);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.8)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill();
      g.restore();
    }
  };
  // roads
  [[-9, 7.4, 2.2, 0.6], [-4.6, 7.5, 1.8, 0.5], [-1, 7.3, 2.4, 0.55], [3.2, 7.4, 2, 0.5], [-7, 8.6, 2.4, 0.8, 0.1], [0.5, 8.4, 3.2, 0.9], [-3.2, 10.6, 2.8, 0.9], [3.2, 11.1, 2.2, 0.7],
    [8.6, -9, 0.6, 2.2], [8.5, -4, 0.55, 2.4], [8.7, 1, 0.55, 2], [11, -2.4, 0.8, 1.6], [10.6, -8, 0.9, 1.4],
    [9.6, 8.8, 2.0, 1.5, 0.3], [11, 11, 1.4, 1.0], [8.5, 7.7, 0.9, 0.6], [6.2, 9.6, 0.7, 1.7], [9.5, 5.3, 1.7, 0.45]].forEach((b) => blob(b[0], b[1], b[2], b[3], b[4] || 0, 6));
  // lot / apron / drip lines
  [[-4.6, 4.3, 0.7, 0.9], [-2.9, 3.7, 0.8, 0.6], [-1.2, 4.9, 0.8, 0.8], [0.0, 3.6, 0.5, 0.4], [-0.1, 2.58, 5.2, 0.24], [2.2, 2.35, 1.0, 0.6], [-4.5, 2.1, 1.0, 0.3], [5.5, -1.2, 0.24, 5.2],
    [6.0, 3.3, 0.8, 0.7], [5.4, -6.5, 0.7, 1.2], [6.5, -9.5, 0.5, 0.8]].forEach((b) => blob(b[0], b[1], b[2], b[3], b[4] || 0, 5));
  // alley / yard
[[-7, 3.3, 1.0, 1.3], [-7.2, -0.5, 0.7, 1.5], [-6.8, -4, 0.9, 1.0], [-10.2, 4.8, 1.1, 0.7], [-2, -5.8, 2.2, 0.55], [3, -5.6, 1.4, 0.5]].forEach((b) => blob(b[0], b[1], b[2], b[3], b[4] || 0, 5));
}

/* ------------------------------------------------------------------ material */
/** shared environment uniforms of every ground material (the original board + the town around it) */
function groundShared(refl) {
  if (reg.groundU) return reg.groundU;
  const uniforms = {
    tRefl: { value: refl.rt.texture },
    uTexMat: { value: refl.texMat },
    uTime: { value: 0 },
    // --- environment (driven by env.js) ---
    uWet: { value: 1 }, // 0 dry .. 1 soaked
    uReflOn: { value: 1 }, // the planar reflection was rendered this frame
    uPuddle: { value: 0.75 }, // puddle coverage
    uRipple: { value: 0.7 }, // rain-ring strength
    uSnow: { value: 0 }, // snow cover
    uDay: { value: 0 }, // daylight lift
    uLawn: { value: new THREE.Color(1, 1, 1) }, // seasonal lawn tint
    uTintA: { value: new THREE.Vector3() }, // colours the wet ground mirrors: A = tree zone (north)
    uTintB: { value: new THREE.Vector3() }, //                                   B = shop front
    uTintC: { value: new THREE.Vector3() }, //                                   C = everywhere (fireworks)
  };
  reg.groundU = uniforms;
  reg.groundUniforms = uniforms;
  return uniforms;
}

/**
 * The painted, wet-able ground material. `area` maps world xz to the canvas; `town` switches the parts
 * that were hard-coded for the original board (lawn rectangle, gutter strips) to mask channels
 * (mask.r puddles, mask.g lawn, mask.b gutters) and skips the original board's square.
 */
export function makeGroundMaterial(refl, map, mask, area = { x0: -12, z0: -12, w: 24, h: 24 }, town = false) {
  const uniforms = { ...groundShared(refl), tMask: { value: mask } };
  const A = (v) => v.toFixed(3);
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, map, gradientMap: RAMP });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vWPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
varying vec3 vWPos;
uniform sampler2D tRefl; uniform mat4 uTexMat; uniform sampler2D tMask; uniform float uTime;
uniform float uWet; uniform float uPuddle; uniform float uRipple; uniform float uSnow; uniform float uDay; uniform float uReflOn; uniform vec3 uLawn; uniform vec3 uTintA; uniform vec3 uTintB; uniform vec3 uTintC;
float gh21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float gnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(gh21(i),gh21(i+vec2(1,0)),f.x), mix(gh21(i+vec2(0,1)),gh21(i+vec2(1,1)),f.x), f.y); }
vec3 ripLayer(vec2 p, float t, float cell, float seed){
  vec2 q = p/cell; vec2 id = floor(q); vec2 f = fract(q);
  float h = gh21(id+seed); float h2 = gh21(id+seed+17.3);
  float per = 0.9 + h*0.9;
  float ph = fract(t/per + h2);
  vec2 c = vec2(0.4+0.2*gh21(id+seed+3.1), 0.4+0.2*gh21(id+seed+9.7));
  vec2 d = (f - c)*cell; float dist = length(d);
  float R = ph*cell*0.38; float w = 0.035 + ph*0.012 + fwidth(dist)*1.1;
  float ring = smoothstep(w, 0.0, abs(dist-R)) * (1.0-ph)*(1.0-ph) * step(0.3, h);
  return vec3(ring, d/(dist+1e-4)*ring);
}
void main() {`
      )
      .replace(
        '#include <map_fragment>',
        `vec2 gUv = vec2((vWPos.x-(${A(area.x0)}))/${A(area.w)}, 1.-(vWPos.z-(${A(area.z0)}))/${A(area.h)});
         ${town ? 'if (abs(vWPos.x) < 11.995 && abs(vWPos.z) < 11.995) discard;' : ''}
         diffuseColor *= texture2D(map, gUv);
         {
           float lawn = ${town ? 'texture2D(tMask, gUv).g' : 'step(-12.0, vWPos.x) * step(vWPos.x, 4.5) * step(-12.0, vWPos.z) * step(vWPos.z, -7.3) * (1.0 - step(0.1, vWPos.y))'};
           diffuseColor.rgb *= mix(vec3(1.0), uLawn, lawn);
           // dry & sunny pavement is lighter and greyer than the soaked night asphalt
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 2.6 + vec3(0.025, 0.027, 0.03), uDay * (1.0 - uWet * 0.55));
           diffuseColor.rgb *= mix(1.0, 0.82, uWet);
         }`
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
  {
    vec2 wp = vWPos.xz;
    float m = texture2D(tMask, gUv).r;
    float nz = gnoise(wp*2.7)*0.20 + gnoise(wp*8.0)*0.07;
    float snoise = gnoise(wp*1.7)*0.6 + gnoise(wp*6.0)*0.4;
    float cover = smoothstep(0.12, 0.5, uSnow*1.25 - snoise*0.5 + (vWPos.y > 0.1 ? 0.28 : -0.12));
    float mv = m + nz - 0.13 + (uPuddle - 0.75) * 0.34;
    float pm = smoothstep(0.38, 0.46, mv) * smoothstep(0.02, 0.22, uPuddle) * (1.0 - cover);
    float rim = smoothstep(0.30, 0.38, mv) * (1.0 - smoothstep(0.38, 0.45, mv)) * smoothstep(0.02, 0.22, uPuddle) * (1.0 - cover);
    // ripples
    vec3 rp = vec3(0.0);
    if (uRipple > 0.002) { // rain rings only while it rains
      rp = ripLayer(wp, uTime, 0.9, 1.0) + ripLayer(wp, uTime*1.13, 0.62, 7.0) + ripLayer(wp+3.7, uTime*0.91, 1.25, 13.0);
    }
    // thinner ripples on merely wet ground
    float wetRip = (1.0-pm) * 0.45;
    float ripAmt = mix(wetRip, 1.0, pm) * uRipple;
    vec2 distort = rp.yz * 0.012 * ripAmt + (vec2(gnoise(wp*14.+uTime*0.6), gnoise(wp*14.-uTime*0.5))-0.5)*0.004;
    vec3 V = normalize(cameraPosition - vWPos);
    float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.2);
    float k = mix(0.20 + 0.45*fr, 0.78 + 0.2*fr, pm);
    k = mix(0.04 * fr, k, uWet) * (1.0 - cover * 0.9);
    // only the near-street-level ground mirrors (the planar reflection is the y = 0 plane), and only when it was rendered
    k *= smoothstep(0.55, 0.3, vWPos.y) * smoothstep(-0.6, -0.25, vWPos.y) * uReflOn;
    // reflection (9 taps) - skipped on dry ground
    vec3 refl = vec3(0.0);
    if (k > 0.003) {
      vec4 rc = uTexMat * vec4(vWPos, 1.0);
      vec2 ruv = rc.xy / rc.w + distort;
      float blur = mix(0.012, 0.006, pm);
      float tw = 0.0;
      for(int i=-4;i<=4;i++){ float w = 1.0 - abs(float(i))/5.0; refl += texture2D(tRefl, ruv + vec2(0.0, float(i)*blur)).rgb * w; tw += w; }
      refl /= tw;
    }
    vec3 wet = outgoingLight;
    vec3 puddleBase = wet * vec3(0.42, 0.5, 0.7);
    wet = mix(wet, puddleBase, pm * 0.75);
    outgoingLight = mix(wet, refl*vec3(0.96,1.0,1.08) + wet*0.12, k);
    outgoingLight += rp.x * vec3(0.55, 0.72, 1.0) * (0.10 + 0.34*pm);
    outgoingLight += rim * vec3(0.20, 0.28, 0.45) * 0.55;
    // gutter streams
    ${town ? `float g1 = texture2D(tMask, gUv).b; float g2 = 0.0;
    float flow = g1 * (0.5+0.5*sin((wp.x+wp.y)*9.0 - uTime*3.2 + gnoise(wp*5.0)*5.0));` : `float g1 = step(6.5, wp.y) * step(wp.y, 6.85) * step(wp.x, 7.5);
    float g2 = step(7.5, wp.x) * step(wp.x, 7.85) * step(wp.y, 6.85);
    float flow = g1 * (0.5+0.5*sin(wp.x*13.0 - uTime*3.2 + gnoise(wp*5.0)*5.0)) + g2 * (0.5+0.5*sin(wp.y*13.0 - uTime*3.2 + gnoise(wp*5.0)*5.0));`}
    outgoingLight += ((g1+g2) * vec3(0.05,0.08,0.13) + flow * vec3(0.10, 0.17, 0.26) * (g1+g2)) * uWet * (1.0 - cover);
    // festive colour on wet ground: lantern / blossom / firework light pooled in puddles
    {
      float zoneA = smoothstep(2.0, -7.0, vWPos.z);
      float zoneB = exp(-length(vWPos.xz - vec2(0.5, 3.2)) * 0.16);
      vec3 tint = uTintA * zoneA + uTintB * zoneB + uTintC * 0.7;
      outgoingLight += tint * (pm * 0.95 + uWet * 0.14 + rim * 0.4) * (1.0 - cover) * (1.0 - uDay * 0.6);
    }
    // snow: lit like white paint so it picks up lamps, moon and sun consistently
    vec3 irr = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(0.05));
    vec3 snowCol = irr * vec3(0.93, 0.95, 1.0) * 0.92 + totalEmissiveRadiance;
    outgoingLight = mix(outgoingLight, snowCol, cover * 0.97);
  }
  #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => (town ? 'groundTown' : 'ground');
  return mat;
}

export function createGround(renderer, refl) {
  const maxA = renderer.capabilities.getMaxAnisotropy();
  const groundTex = canvasTex(S, S, drawGround, { aniso: maxA, scale: 4096 / S });
  const maskTex = canvasTex(1536, 1536, drawMask, { aniso: 4, linear: true, scale: 4/3 });
  const mat = makeGroundMaterial(refl, groundTex, maskTex);

  const curb = toon(P.kerb);
  const curbTop = toon(shade(P.kerb, 0.2));

  // road plane
  const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2), mat);
  road.receiveShadow = true;
  road.userData.keep = true;
  reg.ground.push(road);

  // raised plot with rounded corner
  const { x0, x1, z0, z1, r, h } = PLOT;
  const sh = new THREE.Shape();
  sh.moveTo(x0, -z1);
  sh.lineTo(x1 - r, -z1);
  sh.absarc(x1 - r, -z1 + r, r, -Math.PI / 2, 0, false);
  sh.lineTo(x1, -z0);
  sh.lineTo(x0, -z0);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 14 });
  geo.rotateX(-Math.PI / 2);
  const plot = new THREE.Mesh(geo, [mat, curb]);
  plot.receiveShadow = true;
  plot.castShadow = true;
  plot.userData.keep = true;
  reg.ground.push(plot);

  return { road, plot, mat };
}

/* ------------------------------------------------------------------ plinth */
export function createBase(parent) {
  const g = new THREE.Group();
  const foot = toon('#0f1424');
  const body = toon('#1b2744');
  const gold = toon('#d1ad63', { e: '#3a2a08' });
  const cream = toon('#efe6d0');
  const W = 12.36;
  bx(g, foot, -12.65, 12.65, -1.62, -1.2, -12.65, 12.65);
  bx(g, body, -W, W, -1.2, -0.02, -W, W);
  bx(g, gold, -12.4, 12.4, -0.46, -0.38, -12.4, 12.4, { cast: false });
  // lip
  const lipH = 0.3;
  bx(g, cream, -W, W, -0.02, lipH, -W, -12);
  bx(g, cream, -W, W, -0.02, lipH, 12, W);
  bx(g, cream, -W, -12, -0.02, lipH, -12, 12);
  bx(g, cream, 12, W, -0.02, lipH, -12, 12);
  // top surface of body under ground (hidden but closes the model)
  // name plate
  const plate = canvasTex(1024, 128, (c, w, hh) => {
    c.fillStyle = '#0d1426';
    c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#d1ad63';
    c.lineWidth = 4;
    c.strokeRect(10, 10, w - 20, hh - 20);
    c.fillStyle = '#e9d7a4';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `600 54px ${FONT}`;
    c.fillText('雨夜の街角  ―  コンビニ', w / 2 - 70, hh / 2 + 2);
    c.font = `500 26px ${FONT}`;
    c.fillText('RAINY NIGHT KONBINI  1:60', w / 2 + 330, hh / 2 + 4);
  });
  const pm = new THREE.MeshBasicMaterial({ map: plate, color: 0xcfc4a8 });
  const p = pl(g, pm, 5.2, 0.65, 0, -0.75, W + 0.005, 0);
  p.userData.noLine = false;
  const p2 = pl(g, pm, 5.2, 0.65, 0, -0.75, -W - 0.005, Math.PI);
  parent.add(g);
  return g;
}
