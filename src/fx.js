import * as THREE from 'three';
import { reg, rng, ENVK } from './core.js';

/* ------------------------------------------------------------------ rain on glass */
const glassTime = { value: 0 };
/** shared by every window: rain on the glass, sky reflection by day, frost in winter */
export const GLASS_U = { uRain: { value: 1 }, uSkyCol: { value: new THREE.Color(0.6, 0.72, 0.95) }, uDay: { value: 0 }, uFrost: { value: 0 }, uFw: { value: new THREE.Vector4(0, 0, 0, 0) } };
reg.updaters.push((t) => (glassTime.value = t));

const GLASS_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const GLASS_FS = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uSeed; uniform float uDrops; uniform float uAlpha;
uniform vec2 uSize; uniform vec3 uTint;
uniform float uRain; uniform vec3 uSkyCol; uniform float uDay; uniform float uFrost; uniform vec4 uFw;
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
  float dr=uDrops*uRain;
  float body=max(max(b1.x,b2.x*0.8),max(s1.x,s2.x))*dr;
  float rim=max(max(b1.y,b2.y),max(s1.x*0.55,s2.x*0.55))*dr;
  float trail=max(s1.y,s2.y)*dr;
  float hl=max(max(b1.z,b2.z),max(s1.z,s2.z))*dr;
  // anime-style diagonal glass sheen
  float q=p.x+p.y*0.62+uSeed*1.7;
  float m=mod(q,3.1);
  float sheen=smoothstep(0.30,0.34,m)*smoothstep(0.66,0.62,m)*0.085+smoothstep(0.78,0.80,m)*smoothstep(0.92,0.90,m)*0.075;
  float haze=(1.0-smoothstep(0.0,0.45,vUv.y))*0.07*uDrops*uRain;
  // winter: frosted rim along the edges and bottom
  vec2 ed=min(vUv,1.0-vUv);
  float frost=uFrost*(1.0-smoothstep(0.0,0.22,min(ed.x*0.6,ed.y*0.45)))*(0.5+0.5*sin(vUv.x*60.0+vUv.y*40.0))*uDrops;
  vec3 col=uTint;
  float a=uAlpha+sheen+haze+frost*0.35;
  // daylight: the glass mirrors the sky
  float skyR=uDay*(0.55+0.45*(1.0-vUv.y));
  a+=skyR*0.16;
  a+=body*0.2+rim*0.5+trail*0.24;
  col=mix(col, vec3(0.04,0.09,0.22), rim*0.55);
  col=mix(col, vec3(1.0), clamp(hl*0.95+sheen*2.2+trail*0.25,0.0,1.0));
  col=mix(col, uSkyCol, skyR*0.55);
  col=mix(col, vec3(0.9,0.96,1.0), clamp(frost,0.0,1.0));
  // firework flashes mirrored in the glass
  col=mix(col, uFw.rgb*1.2, uFw.a*0.45*(0.4+0.6*vUv.y));
  a+=uFw.a*0.12*(0.4+0.6*vUv.y);
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
      uRain: GLASS_U.uRain,
      uSkyCol: GLASS_U.uSkyCol,
      uDay: GLASS_U.uDay,
      uFrost: GLASS_U.uFrost,
      uFw: GLASS_U.uFw,
    },
    vertexShader: GLASS_VS,
    fragmentShader: GLASS_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return m;
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
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo; uniform float uTime; uniform float uScale; uniform float uAmt; varying float vA;
      void main(){
        float t = fract(uTime/aInfo.z + aInfo.y);
        float hang = 0.55;
        vec3 p = position; float s = 0.0; vA = 1.0;
        if(t < hang){ float k = t/hang; s = 0.35 + 0.65*k; p.y -= 0.03*k*k; }
        else { float k = (t-hang)/(1.0-hang); s = 1.0; p.y = mix(position.y-0.03, aInfo.x, k*k); vA = 1.0 - smoothstep(0.92,1.0,k); }
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        vA *= smoothstep(0.04, 0.3, uAmt);
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
    m.uniforms.uAmt.value = ENVK.drip;
    m.uniforms.uScale.value = (window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)) / (2 * Math.tan((30 * Math.PI) / 360));
    list.forEach((d, i) => {
      const per = info[i * 4 + 2], ph = info[i * 4 + 1];
      const tt = (((t / per + ph) % 1) + 1) % 1;
      const ring = rings[i];
      if (tt < ring.last) ring.age = 0; // landed
      ring.last = tt;
      ring.age += dt;
      const k = ring.age / 0.75;
      if (k < 1 && ENVK.drip > 0.08) {
        ring.mesh.visible = true;
        const s = 0.05 + k * 0.34;
        ring.mesh.scale.set(s, 1, s);
        ring.mesh.material.opacity = (1 - k) * (1 - k) * 0.75 * Math.min(1, ENVK.drip * 1.6);
      } else ring.mesh.visible = false;
    });
  });
  return pts;
}
