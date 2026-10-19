import * as THREE from 'three';
import { reg, rng } from './core.js';

/* ------------------------------------------------------------------ rain on glass */
const glassTime = { value: 0 };
reg.updaters.push((t) => (glassTime.value = t));

const GLASS_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const GLASS_FS = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uSeed; uniform float uDrops; uniform float uAlpha;
uniform vec2 uSize; uniform vec3 uTint;
float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
// static beads : x body, y rim, z highlight
vec3 beads(vec2 p, float cell, float seed){
  vec2 id=floor(p/cell), f=fract(p/cell);
  float h=h21(id+seed), h2=h21(id+seed+5.1);
  vec2 c=vec2(0.25+0.5*h2, 0.25+0.5*h21(id+seed+9.3));
  float r=(0.12+0.22*h)*step(0.34,h2);
  vec2 d=f-c; float len=length(vec2(d.x, d.y*1.12));
  float body=smoothstep(r, r*0.78, len);
  float rim=body*smoothstep(r*0.5, r, len);
  float hl=smoothstep(r*0.34, 0.0, length(d-vec2(-r*0.38, r*0.40)))*body;
  return vec3(body, rim, hl);
}
// sliding drops : x body, y trail, z highlight
vec3 slides(vec2 p, float t, float colw, float seed){
  float cx=floor(p.x/colw);
  float h=h21(vec2(cx, seed)), h2=h21(vec2(cx+7.7, seed));
  if(h>0.7) return vec3(0.);
  float H=uSize.y;
  float tt=t*(0.030+0.040*h2)+h*9.0;
  tt += 0.02*sin(t*2.3+h*30.0) + 0.012*sin(t*5.1+h*11.0);
  float yd=H*1.08-fract(tt)*(H*1.16);
  float xc=(cx+0.22+0.56*h)*colw + 0.02*sin(p.y*5.0+h*40.0);
  float dx=p.x-xc, dy=p.y-yd;
  float sz=0.8+0.7*h2;
  float len=length(vec2(dx/(0.042*sz), dy/(0.066*sz)));
  float body=smoothstep(1.0,0.78,len);
  float hl=smoothstep(0.38,0.0,length(vec2(dx/(0.042*sz)+0.28, dy/(0.066*sz)-0.32)))*body;
  float above=p.y-yd;
  float tw=0.010+0.008*exp(-above*3.0);
  float trail=smoothstep(tw, tw*0.35, abs(dx))*step(0.0,above)*exp(-above*1.7)*step(p.y,H);
  return vec3(body, trail, hl);
}
void main(){
  vec2 p=vUv*uSize;
  vec3 b1=beads(p,0.24,uSeed), b2=beads(p+vec2(3.3,1.7),0.13,uSeed+3.0);
  vec3 s1=slides(p,uTime,0.34,uSeed), s2=slides(p+vec2(0.37,0.0),uTime*1.25+11.0,0.5,uSeed+2.0);
  float body=max(max(b1.x,b2.x*0.8),max(s1.x,s2.x))*uDrops;
  float rim=max(max(b1.y,b2.y),max(s1.x*0.55,s2.x*0.55))*uDrops;
  float trail=max(s1.y,s2.y)*uDrops;
  float hl=max(max(b1.z,b2.z),max(s1.z,s2.z))*uDrops;
  // anime-style diagonal glass sheen
  float q=p.x+p.y*0.62+uSeed*1.7;
  float m=mod(q,3.1);
  float sheen=smoothstep(0.30,0.34,m)*smoothstep(0.66,0.62,m)*0.085+smoothstep(0.78,0.80,m)*smoothstep(0.92,0.90,m)*0.075;
  float haze=(1.0-smoothstep(0.0,0.45,vUv.y))*0.07*uDrops;
  vec3 col=uTint;
  float a=uAlpha+sheen+haze;
  a+=body*0.2+rim*0.5+trail*0.24;
  col=mix(col, vec3(0.04,0.09,0.22), rim*0.55);
  col=mix(col, vec3(1.0), clamp(hl*0.95+sheen*2.2+trail*0.25,0.0,1.0));
  gl_FragColor=vec4(col,min(a,0.9));
}`;

export function makeGlass(w, h, seed = 0, o = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: glassTime,
      uSize: { value: new THREE.Vector2(w, h) },
      uSeed: { value: seed },
      uDrops: { value: o.drops ?? 1 },
      uAlpha: { value: o.alpha ?? 0.06 },
      uTint: { value: new THREE.Color(o.tint ?? 0xa9d2ff) },
    },
    vertexShader: GLASS_VS,
    fragmentShader: GLASS_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return m;
}

/* ------------------------------------------------------------------ rain */
export function createRain(parent, occluders) {
  const N = 2000;
  const R = rng(123);
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, -0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4 + 0] = (R() - 0.5) * 26;
    data[i * 4 + 1] = (R() - 0.5) * 26;
    data[i * 4 + 2] = 11 + R() * 5;
    data[i * 4 + 3] = R();
  }
  g.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
  g.instanceCount = N;
  const boxes = [], hs = [];
  for (let i = 0; i < 8; i++) {
    const o = occluders[i];
    boxes.push(o ? new THREE.Vector4(o[0], o[1], o[2], o[3]) : new THREE.Vector4(0, 0, 0, 0));
    hs.push(o ? o[4] : 0);
  }
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBoxes: { value: boxes }, uBoxH: { value: hs }, uPx: { value: 0.001 } },
    vertexShader: /* glsl */ `
      attribute vec4 aData; uniform float uTime; uniform vec4 uBoxes[8]; uniform float uBoxH[8]; uniform float uPx;
      varying float vA;
      void main(){
        float H = 18.0;
        float y = H - mod(aData.w*H + uTime*aData.z, H);
        vec3 pos = vec3(aData.x + (H-y)*0.07, y, aData.y);
        vec3 dir = normalize(vec3(0.07,-1.0,0.0));
        float len = 0.55 + 0.35*fract(aData.z*7.13);
        vec3 tail = pos - dir*len;
        float vis = step(0.2, y);
        for(int i=0;i<8;i++){ vec4 b=uBoxes[i]; if(pos.x>b.x && pos.x<b.y && pos.z>b.z && pos.z<b.w && tail.y<uBoxH[i]) vis=0.0; }
        vec4 ph = modelViewMatrix*vec4(pos,1.0);
        vec4 pt = modelViewMatrix*vec4(tail,1.0);
        vec3 d = normalize(pt.xyz-ph.xyz);
        vec3 side = normalize(cross(d, normalize(ph.xyz)));
        // streak is never thinner than ~1.4 device px, otherwise it shimmers/aliases at distance
        float wd = max(0.02, uPx * (-ph.z) * 1.4);
        vec3 vp = mix(ph.xyz, pt.xyz, uv.y*0.0 + (position.y*-1.0)) + side*position.x*wd;
        gl_Position = projectionMatrix*vec4(vp,1.0);
        vA = vis*(1.0+position.y)*0.62*clamp(0.02/wd*1.0, 0.35, 1.0);  // tail fades out
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.72,0.86,1.0)*1.5, vA*0.42); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.userData.noLine = true;
  parent.add(mesh);
  reg.noRefl.push(mesh);
  reg.updaters.push((t) => { m.uniforms.uTime.value = t; if (reg.pxPerUnit) m.uniforms.uPx.value = reg.pxPerUnit; });
  return mesh;
}

/* ------------------------------------------------------------------ eave drips + splash rings */
export function createDrips(parent, list) {
  // list: [x, y, z, groundY]
  const N = list.length;
  const R = rng(77);
  const pos = new Float32Array(N * 3);
  const info = new Float32Array(N * 4); // groundY, phase, period, size
  list.forEach((d, i) => {
    pos.set([d[0], d[1], d[2]], i * 3);
    info.set([d[3], R(), 1.0 + R() * 1.6, 0.8 + R() * 0.5], i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        float t = fract(uTime/aInfo.z + aInfo.y);
        float hang = 0.55;
        vec3 p = position; float s = 0.0; vA = 1.0;
        if(t < hang){ float k = t/hang; s = 0.35 + 0.65*k; p.y -= 0.03*k*k; }
        else { float k = (t-hang)/(1.0-hang); s = 1.0; p.y = mix(position.y-0.03, aInfo.x, k*k); vA = 1.0 - smoothstep(0.92,1.0,k); }
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = max(2.0, uScale*0.045*s*aInfo.w/(-mv.z));
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=smoothstep(0.5,0.15,d); gl_FragColor=vec4(vec3(0.8,0.92,1.0)*1.6, a*vA); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData.noLine = true;
  parent.add(pts);
  reg.noRefl.push(pts);

  // splash rings
  const ringGeo = new THREE.RingGeometry(0.85, 1.0, 28).rotateX(-Math.PI / 2);
  const rings = list.map((d) => {
    const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.0).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const r = new THREE.Mesh(ringGeo, rm);
    r.position.set(d[0], d[3] + 0.012, d[2]);
    r.userData.noLine = true;
    r.visible = false;
    parent.add(r);
    return { mesh: r, age: 9, last: 0 };
  });

  reg.updaters.push((t, dt) => {
    m.uniforms.uTime.value = t;
    m.uniforms.uScale.value = (window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)) / (2 * Math.tan((30 * Math.PI) / 360));
    list.forEach((d, i) => {
      const per = info[i * 4 + 2], ph = info[i * 4 + 1];
      const tt = (((t / per + ph) % 1) + 1) % 1;
      const ring = rings[i];
      if (tt < ring.last) ring.age = 0; // landed
      ring.last = tt;
      ring.age += dt;
      const k = ring.age / 0.75;
      if (k < 1) {
        ring.mesh.visible = true;
        const s = 0.05 + k * 0.34;
        ring.mesh.scale.set(s, 1, s);
        ring.mesh.material.opacity = (1 - k) * (1 - k) * 0.75;
      } else ring.mesh.visible = false;
    });
  });
  return pts;
}
