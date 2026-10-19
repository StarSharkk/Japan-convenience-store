import * as THREE from 'three';
import { reg, rng } from './core.js';

/* ====================================================================================================
   GPU particle systems for the environment: rain, snow, cherry petals, autumn leaves, ground litter.
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
  const common = { uTime: { value: 0 }, uPx: { value: 0.001 }, ...box };
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
    const N = 4600;
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
        void main(){
          float rnd = fract(aData.x*7.31 + aData.y*3.17 + aData.w*11.3);
          float vis = step(rnd, uAmt);
          float H = 18.0;
          float y = H - mod(aData.w*H + uTime*aData.z*uSpeed, H);
          float slant = 0.07 + uWind;
          vec3 pos = vec3(aData.x + (H-y)*slant, y, aData.y);
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
          vA = vis*(1.0+position.y)*0.62*clamp(0.02/wd, 0.35, 1.0);
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
        void main(){
          float rnd = fract(aData.x*5.13 + aData.y*9.71 + aData.w*3.3);
          float vis = step(rnd, uAmt);
          float H = uH;
          float spd = uFall*(0.55 + 0.9*aData.z);
          float y = uLift + H - mod(aData.w*H + uTime*spd, H);
          float ph = aData.w*40.0;
          vec3 pos = vec3(aData.x + sin(uTime*0.55 + ph)*uSway + (H-y)*uWind*0.6, y, aData.y + cos(uTime*0.43 + ph*1.3)*uSway);
          vis *= step(0.2, y) * (1.0 - roofHidden(pos, pos.y));
          vec4 mv = modelViewMatrix*vec4(pos,1.0);
          float ang = ph + uTime*uSpin*(0.6 + aData.z);
          float flip = 0.4 + 0.6*abs(cos(uTime*1.25*uSpin + aData.z*9.0));
          vec2 c = position.xy; c.y *= mix(1.0, flip, step(0.5, uSpin));
          vec2 rc = vec2(cos(ang)*c.x - sin(ang)*c.y, sin(ang)*c.x + cos(ang)*c.y);
          float sz = max(uSize*(0.7 + 0.6*aData.z), uPx*(-mv.z)*1.5);
          mv.xy += rc*sz;
          gl_Position = projectionMatrix*mv;
          vUv = position.xy + 0.5; vCol = aCol; vA = vis;
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
  sys.snow = sprite({ N: 3600, size: 0.055, fall: 1.15, sway: 0.7, spin: 0, shape: 0, palette: ['#ffffff', '#eef4ff', '#f6fbff'] });
  sys.petals = sprite({ N: 520, size: 0.075, fall: 0.8, sway: 1.5, spin: 1.1, shape: 1, palette: ['#ffc9dc', '#ffdce8', '#f7a9c4', '#ffeef3'] });
  sys.leaves = sprite({ N: 420, size: 0.1, fall: 1.0, sway: 1.9, spin: 1.5, shape: 2, palette: ['#d9701c', '#e8a02a', '#b5361b', '#9a5a1e', '#f0c040'] });
  sys.confetti = sprite({ N: 260, size: 0.055, fall: 0.55, sway: 1.1, spin: 2.4, shape: 3, palette: ['#e0343a', '#ffffff', '#ffd24a', '#e0343a', '#ffb347'], H: 9 });
  sys.motes = sprite({ N: 220, size: 0.05, fall: 0.09, sway: 1.5, spin: 0, shape: 0, palette: ['#ffffff', '#fff2dc'], H: 7, yLift: 0.5 });

  /* ------------------------------------------------------------ litter lying on the ground (petals / leaves) */
  {
    const N = 420;
    const R = rng(8801);
    const zones = [
      [4.9, 7.2, -6.5, 5.6, 0.152], // east pavement
      [-5.6, 0.4, 2.8, 5.6, 0.152], // parking lot
      [-5.6, 4.4, 1.6, 2.7, 0.152], // shop apron
      [-8.3, -5.7, -7.0, 4.5, 0.152], // alley
      [-8.4, 4.8, -9.8, -7.6, 0.152], // lawn under the trees
      [-11.5, -8.6, 4.4, 5.6, 0.152], // front yard of the izakaya
      [-5.8, 4.6, -7.0, -4.8, 0.152], // back yard
    ];
    const areas = zones.map((z) => (z[1] - z[0]) * (z[3] - z[2]));
    const total = areas.reduce((a, b) => a + b, 0);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const rand = new Float32Array(N);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      let r = R() * total, zi = 0;
      while (r > areas[zi]) { r -= areas[zi]; zi++; }
      const z = zones[zi];
      e.set(0, R() * 6.28, 0);
      q.setFromEuler(e);
      const s = 0.1 + R() * 0.1;
      mtx.compose(new THREE.Vector3(z[0] + R() * (z[1] - z[0]), z[4] + 0.004, z[2] + R() * (z[3] - z[2])), q, new THREE.Vector3(s, 1, s * (0.55 + R() * 0.3)));
      im.setMatrixAt(i, mtx);
      rand[i] = R();
    }
    im.geometry = geo.clone();
    im.geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
    const u = { uAmt: { value: 0 }, uKind: { value: 0 }, uBright: { value: 1 } };
    im.material = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute float aRand; uniform float uAmt; varying float vR; varying vec2 vUv;
        void main(){
          vR = aRand; vUv = uv;
          float vis = step(aRand, uAmt);
          vec3 p = position * vis;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uKind; uniform float uBright; varying float vR; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5;
          float a = smoothstep(0.5, 0.25, length(vec2(p.x/0.5, p.y/0.36)));
          if(a < 0.05) discard;
          vec3 pet = mix(vec3(1.0,0.78,0.86), vec3(0.96,0.6,0.76), fract(vR*7.0));
          float k = fract(vR*5.0);
          vec3 lef = k < 0.25 ? vec3(0.82,0.42,0.1) : k < 0.5 ? vec3(0.7,0.2,0.1) : k < 0.75 ? vec3(0.9,0.64,0.16) : vec3(0.48,0.3,0.12);
          gl_FragColor = vec4((fract(vR*13.7) < uKind ? lef : pet) * uBright, a);
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    im.userData.noLine = true;
    im.frustumCulled = false;
    reg.noRefl.push(im);
    parent.add(im);
    sys.litter = { mesh: im, u, N };
  }

  /* ------------------------------------------------------------ petal / leaf / snow piles (mounds) */
  {
    const spots = [
      // [x, z, radius] visible kerbside, corners, tree feet, doorways
      [6.7, -4.3, 0.55], [6.2, 0.9, 0.45], [7.15, -2.4, 0.4], [7.1, 3.3, 0.5], [5.2, 4.7, 0.5], [4.6, 2.65, 0.4], [-5.4, 2.3, 0.45],
      [0.2, 5.5, 0.5], [-5.6, 3.0, 0.4], [-1.0, 6.0, 0.55], [3.0, 6.05, 0.5], [-7.0, 5.1, 0.5], [-8.2, 3.6, 0.4], [-6.3, -1.3, 0.35],
      [-11.4, 5.0, 0.5], [-9.0, 5.2, 0.4], [-2.2, 1.7, 0.4], [4.4, -4.7, 0.45],
      [-6.5, -8.0, 0.6], [-3.5, -7.9, 0.55], [-0.4, -8.0, 0.6], [2.6, -7.9, 0.55], [5.0, -8.0, 0.5], [-8.2, -7.9, 0.5],
    ];
    const R = rng(5150);
    const geo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const rand = new Float32Array(spots.length);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), spots.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    spots.forEach(([x, z, r], i) => {
      e.set(0, R() * 6.28, 0); q.setFromEuler(e);
      mtx.compose(new THREE.Vector3(x, 0.15, z), q, new THREE.Vector3(r * (1.0 + R() * 0.5), r * (0.22 + R() * 0.12), r * (0.8 + R() * 0.4)));
      im.setMatrixAt(i, mtx);
      rand[i] = (i % 5) / 5 * 0.7 + R() * 0.3; // appears progressively as the amount grows
    });
    im.geometry = geo.clone();
    im.geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
    const u = { uW: { value: new THREE.Vector3() }, uL: { value: new THREE.Vector3(0.3, 0.9, 0.3) }, uBright: { value: 1 } };
    im.material = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        attribute float aRand; uniform vec3 uW; varying vec3 vN; varying vec3 vP;
        void main(){
          float amt = max(uW.x, max(uW.y, uW.z));
          float vis = smoothstep(aRand - 0.2, aRand + 0.02, amt);
          mat3 m = mat3(normalize(instanceMatrix[0].xyz), normalize(instanceMatrix[1].xyz), normalize(instanceMatrix[2].xyz));
          vN = m * normal;
          vec4 w = instanceMatrix * vec4(position * vis, 1.0);
          vP = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uW; uniform vec3 uL; uniform float uBright; varying vec3 vN; varying vec3 vP;
        float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main(){
          float n = h2(floor(vP.xz * 46.0 + vP.y * 20.0)); float n2 = h2(floor(vP.xz * 23.0));
          vec3 pet = mix(vec3(1.0, 0.72, 0.82), vec3(1.0, 0.94, 0.96), n); pet = mix(pet, vec3(0.9, 0.45, 0.62), step(0.86, n2) * 0.6);
          vec3 lef = n < 0.28 ? vec3(0.85, 0.42, 0.1) : n < 0.52 ? vec3(0.65, 0.2, 0.1) : n < 0.78 ? vec3(0.92, 0.66, 0.16) : vec3(0.42, 0.27, 0.12);
          vec3 snw = mix(vec3(0.86, 0.9, 0.99), vec3(1.0), n) * (0.92 + 0.08 * step(0.97, n2));
          float tot = max(uW.x + uW.y + uW.z, 1e-3);
          vec3 col = (pet * uW.x + lef * uW.y + snw * uW.z) / tot;
          float l = 0.32 + 0.68 * max(dot(normalize(vN), normalize(uL)), 0.0);
          gl_FragColor = vec4(col * l * uBright, 1.0);
        }`,
    });
    im.userData.noLine = true;
    im.frustumCulled = false;
    im.receiveShadow = false;
    reg.noRefl.push(im);
    parent.add(im);
    sys.piles = { mesh: im, u, apply: (p) => { u.uW.value.set(p.pilePetal, p.pileLeaf, p.pileSnow); u.uBright.value = p.pileBright; u.uL.value.copy(p.lightDir); im.visible = p.pilePetal + p.pileLeaf + p.pileSnow > 0.01; } };
  }

  /* ------------------------------------------------------------ control */
  sys.setDensity = (f) => {
    sys.rain.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.rain.N * f));
    sys.snow.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.snow.N * f));
    sys.petals.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.petals.N * Math.max(0.4, f)));
    sys.leaves.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.leaves.N * Math.max(0.4, f)));
    sys.confetti.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.confetti.N * Math.max(0.4, f)));
    sys.motes.mesh.geometry.instanceCount = Math.max(1, Math.floor(sys.motes.N * Math.max(0.4, f)));
  };
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
    sys.litter.u.uBright.value = p.bright;
    sys.litter.mesh.visible = p.litterAmt > 0.005;
    sys.piles.apply(p);
  };
  return sys;
}
