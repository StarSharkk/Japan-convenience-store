import * as THREE from 'three';
import { reg, rng } from './core.js';
import { createGroundPiles } from './groundPiles.js';
import { createRoofPiles } from './roofPiles.js';
import { OUTLINE } from './town/layout.js';

/* ====================================================================================================
   GPU particle systems for the environment: rain, snow, cherry petals, autumn leaves (+ ground piles).
   Every system is ONE instanced draw call whose motion is computed in the vertex shader (no per-frame
   JS work per particle). The number of visible particles is a continuous 0..1 amount (so weather can
   fade in/out smoothly) and the allocated instance count is only a quality cap.
   Roofs / awnings occlude the particles through the shared box list.
   ==================================================================================================== */

const BOX_GLSL = /* glsl */ `
uniform vec4 uBoxes[8]; uniform float uBoxH[8];
float roofHidden(vec3 p, float lowY){
  float v = 0.0;
  for(int i=0;i<8;i++){ vec4 b=uBoxes[i]; if(p.x>b.x && p.x<b.y && p.z>b.z && p.z<b.w && lowY<uBoxH[i]) v=1.0; }
  return v;
}`;

function boxUniforms(occluders) {
  const boxes = [], hs = [];
  for (let i = 0; i < 8; i++) {
    const o = occluders[i];
    boxes.push(o ? new THREE.Vector4(o[0], o[1], o[2], o[3]) : new THREE.Vector4(0, 0, 0, 0));
    hs.push(o ? o[4] : 0);
  }
  return { uBoxes: { value: boxes }, uBoxH: { value: hs } };
}

function instanced(N, fill) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const data = new Float32Array(N * 4);
  const R = rng(N * 31 + 7);
  for (let i = 0; i < N; i++) fill(data, i, R);
  g.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
  g.instanceCount = N;
  return g;
}

export function createParticles(parent, occluders) {
  const box = boxUniforms(occluders);
  // uC / uSpan: the particle volume is a wrapped tile that follows the camera across the town.
  // uEdge: the diorama outline as half-planes (outward normal, offset) -> weather fades out softly past
  // the edge of the base (and before it reaches the base's sides), never ending on a hard square wall.
  const edges = OUTLINE.map((a, i) => {
    const b = OUTLINE[(i + 1) % OUTLINE.length];
    const ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez);
    let nx = ez / l, nz = -ex / l;
    const cx = OUTLINE.reduce((t, p) => t + p[0], 0) / OUTLINE.length, cz = OUTLINE.reduce((t, p) => t + p[1], 0) / OUTLINE.length;
    if (nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
    return new THREE.Vector3(nx, nz, nx * a[0] + nz * a[1]);
  });
  while (edges.length < 8) edges.push(new THREE.Vector3(0, 0, -1e4));
  const common = { uTime: { value: 0 }, uPx: { value: 0.001 }, uC: { value: new THREE.Vector2() }, uSpan: { value: 26 }, uEdge: { value: edges }, ...box };
  const WRAP = /* glsl */ `uniform vec2 uC; uniform float uSpan; uniform vec3 uEdge[8];
  vec2 wrapXZ(vec2 a){ vec2 u = a / 26.0 + 0.5; return uC + (fract(u - uC / uSpan) - 0.5) * uSpan; }
  // 1 inside the town, 0 a few metres past the base; also a round, soft edge of the camera tile
  float weatherFade(vec3 p){
    float o = -1e4;
    for (int i = 0; i < 8; i++) o = max(o, dot(uEdge[i].xy, p.xz) - uEdge[i].z);
    float f = 1.0 - smoothstep(-1.5, 4.5, o);
    f *= mix(1.0, smoothstep(0.8, 4.0, p.y), smoothstep(-0.5, 1.0, o)); // past the edge: gone before the base's sides
    float r = length(p.xz - uC) / (0.5 * uSpan);
    return f * (1.0 - smoothstep(0.72, 0.98, r));
  }`;
  const sys = {};
  const flag = (m) => {
    m.frustumCulled = false;
    m.userData.noLine = true;
    reg.noRefl.push(m);
    parent.add(m);
    return m;
  };

  /* ------------------------------------------------------------ rain streaks (screen-width-clamped quads) */
  {
    const N = 9000; // (the tile is wider now and fades out round its edge; this keeps the close-up density)
    const g = instanced(N, (d, i, R) => {
      d[i * 4] = (R() - 0.5) * 26; d[i * 4 + 1] = (R() - 0.5) * 26; d[i * 4 + 2] = 11 + R() * 5; d[i * 4 + 3] = R();
    });
    g.attributes.position.array; // (shared plane)
    const geo = g;
    // streak runs along -y of the quad: head at 0, tail at -1
    const pos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const u = { ...common, uAmt: { value: 0 }, uWind: { value: 0 }, uSpeed: { value: 1 }, uCol: { value: new THREE.Color(1.1, 1.3, 1.5) }, uAlpha: { value: 0.42 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute vec4 aData; uniform float uTime, uPx, uAmt, uWind, uSpeed; varying float vA;
        ${BOX_GLSL}
        ${WRAP}
        void main(){
          float rnd = fract(aData.x*7.31 + aData.y*3.17 + aData.w*11.3);
          float vis = step(rnd, uAmt);
          float H = 18.0;
          float y = H - mod(aData.w*H + uTime*aData.z*uSpeed, H);
          float slant = 0.07 + uWind;
          vec2 wp = wrapXZ(aData.xy);
          vec3 pos = vec3(wp.x + (H-y)*slant, y, wp.y);
          vec3 dir = normalize(vec3(slant, -1.0, 0.0));
          float len = (0.55 + 0.35*fract(aData.z*7.13)) * (0.8 + 0.4*uSpeed);
          vec3 tail = pos - dir*len;
          vis *= step(0.2, y) * (1.0 - roofHidden(pos, tail.y));
          vec4 ph = modelViewMatrix*vec4(pos,1.0);
          vec4 pt = modelViewMatrix*vec4(tail,1.0);
          vec3 d = normalize(pt.xyz-ph.xyz);
          vec3 side = normalize(cross(d, normalize(ph.xyz)));
          float wd = max(0.02, uPx*(-ph.z)*1.4);
          vec3 vp = mix(ph.xyz, pt.xyz, -position.y) + side*position.x*wd;
          gl_Position = projectionMatrix*vec4(vp,1.0);
          vA = vis*(1.0+position.y)*0.62*clamp(0.02/wd, 0.35, 1.0)*weatherFade(pos);
        }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA*uAlpha); }`,
      transparent: true,
      depthWrite: false,
    });
    sys.rain = { mesh: flag(new THREE.Mesh(geo, m)), u, N };
  }

  /* ------------------------------------------------------------ billboard sprites: snow / petals / leaves */
  const sprite = ({ N, size, fall, sway, spin, shape, palette, H = 18, yLift = 0 }) => {
    const g = instanced(N, (d, i, R) => {
      d[i * 4] = (R() - 0.5) * 26; d[i * 4 + 1] = (R() - 0.5) * 26; d[i * 4 + 2] = R(); d[i * 4 + 3] = R();
    });
    const cols = new Float32Array(N * 3);
    const R2 = rng(N + 99);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) { c.set(palette[(R2() * palette.length) | 0]); cols.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 3));
    const u = { ...common, uAmt: { value: 0 }, uWind: { value: 0 }, uSize: { value: size }, uFall: { value: fall }, uSway: { value: sway }, uSpin: { value: spin }, uShape: { value: shape }, uBright: { value: 1 }, uH: { value: H }, uLift: { value: yLift }, uTint: { value: new THREE.Color(1, 1, 1) } };
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute vec4 aData; attribute vec3 aCol;
        uniform float uTime, uPx, uAmt, uWind, uSize, uFall, uSway, uSpin, uH, uLift; varying vec2 vUv; varying vec3 vCol; varying float vA;
        ${BOX_GLSL}
        ${WRAP}
        void main(){
          float rnd = fract(aData.x*5.13 + aData.y*9.71 + aData.w*3.3);
          float vis = step(rnd, uAmt);
          float H = uH;
          float spd = uFall*(0.55 + 0.9*aData.z);
          float y = uLift + H - mod(aData.w*H + uTime*spd, H);
          float ph = aData.w*40.0;
          vec2 wp = wrapXZ(aData.xy);
          vec3 pos = vec3(wp.x + sin(uTime*0.55 + ph)*uSway + (H-y)*uWind*0.6, y, wp.y + cos(uTime*0.43 + ph*1.3)*uSway);
          vis *= step(0.2, y) * (1.0 - roofHidden(pos, pos.y));
          vec4 mv = modelViewMatrix*vec4(pos,1.0);
          float ang = ph + uTime*uSpin*(0.6 + aData.z);
          float flip = 0.4 + 0.6*abs(cos(uTime*1.25*uSpin + aData.z*9.0));
          vec2 c = position.xy; c.y *= mix(1.0, flip, step(0.5, uSpin));
          vec2 rc = vec2(cos(ang)*c.x - sin(ang)*c.y, sin(ang)*c.x + cos(ang)*c.y);
          float sz = max(uSize*(0.7 + 0.6*aData.z), uPx*(-mv.z)*1.5);
          mv.xy += rc*sz;
          gl_Position = projectionMatrix*mv;
          vUv = position.xy + 0.5; vCol = aCol; vA = vis * weatherFade(pos);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uShape; uniform float uBright; uniform vec3 uTint; varying vec2 vUv; varying vec3 vCol; varying float vA;
        void main(){
          vec2 p = vUv - 0.5;
          float a;
          if(uShape < 0.5){ a = smoothstep(0.5, 0.2, length(p)); }
          else if(uShape < 1.5){ a = smoothstep(1.0, 0.7, length(vec2(p.x/0.5, p.y/0.3))); }
          else if(uShape < 2.5){ float w = 0.34*(1.0 - pow(abs(p.y)*2.0, 1.6)); a = smoothstep(w, w*0.6, abs(p.x)) * step(abs(p.y), 0.5); }
          else { a = smoothstep(0.5, 0.42, abs(p.x)) * smoothstep(0.3, 0.22, abs(p.y)); }
          if(a*vA < 0.02) discard;
          gl_FragColor = vec4(vCol*uBright*uTint, a*vA*0.95);
        }`,
      transparent: true,
      depthWrite: false,
    });
    return { mesh: flag(new THREE.Mesh(g, m)), u, N };
  };
  sys.snow = sprite({ N: 7000, size: 0.055, fall: 1.15, sway: 0.7, spin: 0, shape: 0, palette: ['#ffffff', '#eef4ff', '#f6fbff'] });
  sys.petals = sprite({ N: 520, size: 0.075, fall: 0.8, sway: 1.5, spin: 1.1, shape: 1, palette: ['#ffc9dc', '#ffdce8', '#f7a9c4', '#ffeef3'] });
  sys.leaves = sprite({ N: 420, size: 0.1, fall: 1.0, sway: 1.9, spin: 1.5, shape: 2, palette: ['#d9701c', '#e8a02a', '#b5361b', '#9a5a1e', '#f0c040'] });
  sys.confetti = sprite({ N: 260, size: 0.055, fall: 0.55, sway: 1.1, spin: 2.4, shape: 3, palette: ['#e0343a', '#ffffff', '#ffd24a', '#e0343a', '#ffb347'], H: 9 });
  sys.motes = sprite({ N: 220, size: 0.05, fall: 0.09, sway: 1.5, spin: 0, shape: 0, palette: ['#ffffff', '#fff2dc'], H: 7, yLift: 0.5 });

  /* ------------------------------------------------------------ ground accumulation (snow drifts, leaf / petal piles)
     generated from wind "collectors" with a seeded layout - see groundPiles.js */
  sys.piles = createGroundPiles(parent);
  // the same on the roofs / eaves / awnings, plus the snow layer and the lamp snow caps (see roofPiles.js)
  sys.roof = createRoofPiles(parent, parent);
  // (the old uniformly scattered litter is now part of the piles' loose flakes; the handle stays for env.js)
  sys.litter = { u: { uAmt: { value: 0 }, uKind: { value: 0 }, uBright: { value: 1 } } };

  /* ------------------------------------------------------------ control */
  sys.setDensity = (f) => {
    sys.rain.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.rain.N * f));
    sys.snow.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.snow.N * f));
    sys.petals.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.petals.N * Math.max(0.4, f)));
    sys.leaves.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.leaves.N * Math.max(0.4, f)));
    sys.confetti.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.confetti.N * Math.max(0.4, f)));
    sys.motes.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.motes.N * Math.max(0.4, f)));
  };
  /** follow the camera: x, z = centre of the wrapped volume, span = its size (bigger = sparser, for wide views) */
  sys.setCenter = (x, z, span = 26) => { common.uC.value.set(x, z); common.uSpan.value = span; };
  /** p: { rain, wind, speed, rainCol, rainAlpha, snow, petal, leaf, litterAmt, litterKind, bright } */
  sys.apply = (t, p) => {
    const px = reg.pxPerUnit || 0.001;
    const shared = [sys.rain, sys.snow, sys.petals, sys.leaves, sys.confetti, sys.motes];
    shared.forEach((s) => { s.u.uTime.value = t; s.u.uPx.value = px; });
    sys.rain.u.uAmt.value = p.rain;
    sys.rain.u.uWind.value = p.wind;
    sys.rain.u.uSpeed.value = p.speed;
    sys.rain.u.uCol.value.copy(p.rainCol);
    sys.rain.u.uAlpha.value = p.rainAlpha;
    sys.rain.mesh.visible = p.rain > 0.005;
    sys.snow.u.uAmt.value = p.snow;
    sys.snow.u.uWind.value = p.wind * 1.5;
    sys.snow.u.uBright.value = p.bright;
    sys.snow.mesh.visible = p.snow > 0.005;
    sys.petals.u.uAmt.value = p.petal;
    sys.petals.u.uWind.value = p.wind;
    sys.petals.u.uBright.value = p.bright;
    sys.petals.mesh.visible = p.petal > 0.005;
    sys.leaves.u.uAmt.value = p.leaf;
    sys.leaves.u.uWind.value = p.wind;
    sys.leaves.u.uBright.value = p.bright;
    sys.leaves.mesh.visible = p.leaf > 0.005;
    sys.confetti.u.uAmt.value = p.confetti;
    sys.confetti.u.uWind.value = p.wind;
    sys.confetti.u.uBright.value = p.bright * 1.1;
    sys.confetti.mesh.visible = p.confetti > 0.005;
    sys.motes.u.uAmt.value = p.motes;
    sys.motes.u.uWind.value = p.wind * 0.4;
    sys.motes.u.uBright.value = 2.4;
    sys.motes.u.uTint.value.copy(p.motesTint);
    sys.motes.mesh.visible = p.motes > 0.005;
    sys.litter.u.uAmt.value = p.litterAmt;
    sys.litter.u.uKind.value = p.litterKind;
    sys.piles.apply(p, Math.min(0.1, Math.max(0, t - (sys._t ?? t))));
    sys.roof.apply(p);
    sys._t = t;
  };
  return sys;
}
