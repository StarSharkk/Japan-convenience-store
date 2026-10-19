import * as THREE from 'three';

/**
 * World-space sky dome: vertical gradient (top / horizon / ground), sun + moon discs at their real
 * positions, stars, drifting fbm clouds, distant city-light bokeh at night, lightning flash.
 * One draw call, one fragment shader, no textures.
 */
export function createSky(scene) {
  const u = {
    uTop: { value: new THREE.Color('#080b24') },
    uMid: { value: new THREE.Color('#161a42') },
    uBot: { value: new THREE.Color('#2b2150') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color('#fff0d0') },
    uSunVis: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonVis: { value: 0 },
    uStars: { value: 1 },
    uCloud: { value: 0.4 },
    uCloudLit: { value: new THREE.Color('#9aa6c8') },
    uCloudShade: { value: new THREE.Color('#3a4068') },
    uNight: { value: 1 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBot, uSunDir, uSunCol, uMoonDir, uCloudLit, uCloudShade;
      uniform float uSunVis, uMoonVis, uStars, uCloud, uNight, uFlash, uTime;
      float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.0; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uBot, smoothstep(0.03, -0.62, h));
        // sun
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 90.0) * 1.4 + pow(sd, 7.0) * 0.28) * uSunVis;
        col = mix(col, uSunCol * 3.2, smoothstep(0.9989, 0.9995, sd) * uSunVis);
        // moon
        float md = max(dot(d, uMoonDir), 0.0);
        col += vec3(0.55, 0.65, 0.95) * pow(md, 60.0) * 0.55 * uMoonVis;
        col = mix(col, vec3(0.92, 0.95, 1.0) * 1.7, smoothstep(0.9983, 0.9989, md) * uMoonVis);
        // stars
        vec3 sp = d * 230.0; vec3 ip = floor(sp);
        float r = h13(ip);
        float star = step(0.9972, r) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5)) * (0.65 + 0.35 * sin(uTime * 2.0 + r * 60.0));
        col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.02, 0.25, h) * 1.4;
        // far city lights (bokeh) near the horizon at night
        if(uNight > 0.02 && h > -0.6 && h < 0.3){
          float az = atan(d.z, d.x);
          vec2 bc = vec2(az * 12.0, h * 14.0); vec2 id = floor(bc); vec2 f = fract(bc) - 0.5;
          float rn = h12(id); vec2 off = vec2(h12(id + 3.1), h12(id + 7.7)) - 0.5;
          float blob = smoothstep(0.26, 0.0, length(f - off * 0.5)) * step(0.62, rn);
          vec3 bcol = rn < 0.74 ? vec3(1.0, 0.62, 0.3) : rn < 0.84 ? vec3(0.45, 0.75, 1.0) : rn < 0.92 ? vec3(1.0, 0.4, 0.66) : vec3(1.0, 0.9, 0.55);
          col += bcol * blob * 0.2 * uNight * smoothstep(0.3, 0.0, h) * smoothstep(-0.6, -0.15, h);
        }
        // clouds (planar projection, slowly drifting)
        if(h > 0.0){
          vec2 cuv = d.xz / (h + 0.22) * 1.15 + vec2(uTime * 0.012, uTime * 0.005);
          float c = fbm(cuv * 1.3);
          float cov = smoothstep(1.0 - uCloud * 0.95, 1.0 - uCloud * 0.95 + 0.32, c) * smoothstep(0.0, 0.18, h);
          vec3 cc = mix(uCloudShade, uCloudLit, smoothstep(0.35, 0.8, c + (1.0 - h) * 0.08));
          cc += uSunCol * pow(sd, 12.0) * 0.5 * uSunVis;
          col = mix(col, cc, cov * (0.35 + 0.65 * uCloud));
        }
        col += vec3(0.5, 0.6, 0.95) * uFlash * (0.35 + 0.65 * smoothstep(-0.2, 0.8, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 40, 24), m);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.userData.noLine = true;
  scene.add(mesh);
  return { mesh, u };
}
