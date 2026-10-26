import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { reg } from './core.js';

/* ------------------------------------------------------------------ planar reflection (y = 0) */
export class PlanarReflection {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.cam = new THREE.PerspectiveCamera();
    this.texMat = new THREE.Matrix4();
    this.n = new THREE.Vector3(0, 1, 0);
    this.P = new THREE.Vector3(0, 0, 0);
    this.plane = new THREE.Plane();
    this.clip = new THREE.Vector4();
    this.q = new THREE.Vector4();
    this.scale = 0.75;
  }
  setSize(w, h) {
    this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale)));
  }
  render(renderer, scene, camera, hide) {
    const { n, P, cam, plane, clip, q } = this;
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new THREE.Vector3().subVectors(P, camPos);
    if (view.dot(n) > 0) return;
    view.reflect(n).negate().add(P);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = new THREE.Vector3().subVectors(P, look).reflect(n).negate().add(P);
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    cam.lookAt(target);
    cam.far = camera.far;
    cam.near = camera.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);

    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMat.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    plane.setFromNormalAndCoplanarPoint(n, P).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - 0.002;
    pm.elements[14] = clip.w;

    hide.forEach((o) => (o.visible = false));
    const prevRT = renderer.getRenderTarget();
    const sa = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    renderer.shadowMap.autoUpdate = sa;
    renderer.setRenderTarget(prevRT);
    hide.forEach((o) => (o.visible = true));
  }
}

/* ------------------------------------------------------------------ scene + normal/depth pass */
const NORMAL_VS = /* glsl */ `
varying vec3 vN;
varying float vZ;
void main(){
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal);
  vZ = -mvPosition.z;
}`;
// cut-out decals (road signs, stickers ...) write normal/depth only where their texture is opaque, so the
// ink line follows the painted shape instead of the plane's rectangle
const CUT_VS = /* glsl */ `
varying vec3 vN;
varying float vZ;
varying vec2 vUv;
void main(){
  vUv = uv;
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal);
  vZ = -mvPosition.z;
}`;
const CUT_FS = /* glsl */ `
uniform sampler2D map; uniform mat3 uvT; uniform float cut;
varying vec3 vN;
varying float vZ;
varying vec2 vUv;
void main(){
  if(texture2D(map, (uvT * vec3(vUv, 1.0)).xy).a < cut) discard;
  vec3 n = normalize(vN);
  if(!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(n*0.5+0.5, vZ);
}`;
const NORMAL_FS = /* glsl */ `
varying vec3 vN;
varying float vZ;
void main(){
  vec3 n = normalize(vN);
  if(!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(n*0.5+0.5, vZ);
}`;

class ScenePass extends Pass {
  constructor(scene, camera, refl) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.refl = refl;
    this.needsSwap = false;
    this.noLine = [];
    this.cut = [];
    this.nmat = new THREE.ShaderMaterial({ vertexShader: NORMAL_VS, fragmentShader: NORMAL_FS, side: THREE.DoubleSide });
    // MSAA + linear filtering: the edge detector then sees sub-pixel coverage, so ink lines come out anti-aliased
    this.nrt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.nrt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this._c = new THREE.Color();
  }
  /** sort the scene into: ink-less objects, alpha cut-outs (ink follows the texture's alpha), everything else.
      Re-run whenever objects are added later (holiday props are built lazily) - see reg.sceneDirty. */
  collect() {
    this.noLine = [];
    this.cut = [];
    this.scene.traverse((o) => {
      if (!o.userData) return;
      // meshes that move their vertices in the shader (roof snow) bring their own normal/depth material
      if (o.userData.lineMat) { o.userData.cutMat = o.userData.lineMat; o.layers.enable(1); this.cut.push(o); return; }
      if (o.userData.noLine) { this.noLine.push(o); return; }
      const m = o.isMesh && !Array.isArray(o.material) ? o.material : null;
      if (m && m.map && (m.alphaTest > 0 || m.transparent) && !o.isInstancedMesh) {
        if (!o.userData.cutMat) {
          o.userData.cutMat = new THREE.ShaderMaterial({
            vertexShader: CUT_VS, fragmentShader: CUT_FS, side: THREE.DoubleSide,
            uniforms: { map: { value: m.map }, uvT: { value: m.map.matrix }, cut: { value: Math.max(0.35, m.alphaTest) } },
          });
        }
        o.layers.enable(1);
        this.cut.push(o);
      }
    });
    reg.sceneDirty = false;
  }
  setSize(w, h) {
    this.nrt.setSize(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    const { scene, camera } = this;
    if (reg.sceneDirty) this.collect();
    // dry / snowy ground has nothing to mirror, but the lake always does when it is on screen
    reg.reflActive = reg.reflOn !== false || !!reg.lakeVisible;
    if (reg.groundU) reg.groundU.uReflOn.value = reg.reflActive ? 1 : 0;
    // lake only (dry streets): the far greenery cannot show in the lake, leave it out of the mirror pass; the mirror plane
    // drops to the lake's level and the lake park's own ground joins the pass (its banks mirror in the water), drawn with a
    // plain stand-in material because the ground material reads this very target (reg.reflSwap, town/lake.js)
    if (reg.reflActive) {
      const lakeOnly = reg.reflOn === false;
      this.refl.P.y = lakeOnly ? reg.lakeReflY || 0 : 0;
      if (reg.waterU) reg.waterU.uReflY.value = this.refl.P.y;
      const hide = lakeOnly ? reg.ground.filter((o) => o.userData.block !== 'lakePark').concat(reg.noRefl, reg.reflLakeHide || []) : reg.ground.concat(reg.noRefl);
      const swap = lakeOnly ? reg.reflSwap || [] : [];
      swap.forEach((w) => { w.keep = w.mesh.material; w.mesh.material = w.mat; });
      this.refl.render(renderer, scene, camera, hide);
      swap.forEach((w) => (w.mesh.material = w.keep));
    }

    renderer.setRenderTarget(readBuffer);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    // normal / depth
    const bg = scene.background;
    const fog = scene.fog;
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = this.nmat;
    this.noLine.forEach((o) => (o.visible = false));
    // far tree chunks: their ink lines would be sub-pixel anyway (greenery LOD fills reg.lineHide)
    const lh = reg.lineHide || [];
    const lhVis = lh.map((o) => o.visible);
    lh.forEach((o) => (o.visible = false));
    const cutVis = this.cut.map((o) => o.visible);
    this.cut.forEach((o) => (o.visible = false));
    renderer.getClearColor(this._c);
    const ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.nrt);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    if (this.cut.length) {
      // second draw on top: only the cut-out decals (layer 1), each with its alpha-tested normal material
      scene.overrideMaterial = null;
      const mask = camera.layers.mask;
      const ac = renderer.autoClear;
      camera.layers.set(1);
      renderer.autoClear = false;
      this.cut.forEach((o, i) => { o.visible = cutVis[i]; o.userData.realMat = o.material; o.material = o.userData.cutMat; });
      renderer.render(scene, camera);
      this.cut.forEach((o) => { o.material = o.userData.realMat; });
      renderer.autoClear = ac;
      camera.layers.mask = mask;
      scene.overrideMaterial = this.nmat;
    }
    this.cut.forEach((o, i) => (o.visible = cutVis[i]));
    renderer.setClearColor(this._c, ca);
    this.noLine.forEach((o) => (o.visible = true));
    lh.forEach((o, i) => (o.visible = lhVis[i]));
    scene.overrideMaterial = null;
    scene.background = bg;
    scene.fog = fog;
  }
}

/* ------------------------------------------------------------------ ink lines / AO / grading
   Silhouettes (depth jumps) keep a soft, colour-tinted line; inner creases only get a faint one that fades
   out with distance, so structure reads from light, AO and material contrast instead of black lines.
   AO: a small depth-only occlusion estimate from the same normal/depth target (corners, contact, eaves). */
const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uOffD: { value: 0.65 }, // silhouette half-width (physical px)
    uOffN: { value: 0.5 }, // crease half-width (physical px)
    uFog: { value: 0 }, // fog density: lines and AO dissolve into fog
    uFogNear: { value: 0 }, // ... measured past the near side of the model, like the scene fog
    uFocal: { value: 900 }, // px per unit at distance 1 (for the AO radius)
    uSil: { value: 0.68 }, // silhouette strength (keeps neighbouring objects apart)
    uCrease: { value: 0.3 }, // crease strength
    uAO: { value: 0.3 }, // AO strength
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform vec2 uTexel; uniform float uOffD; uniform float uOffN; uniform float uFog; uniform float uFogNear;
  uniform float uFocal; uniform float uSil; uniform float uCrease; uniform float uAO;
  varying vec2 vUv;
  vec4 S(vec2 uv){ vec4 c = texture2D(tNormal, uv); if(c.a < 0.02) c.a = 400.0; return c; }
  vec3 dec(vec4 c){ return normalize(c.rgb*2.0-1.0 + 1e-5); }
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  const vec2 DIRS[8] = vec2[8](vec2(1,0), vec2(-1,0), vec2(0,1), vec2(0,-1), vec2(.7071,.7071), vec2(-.7071,-.7071), vec2(.7071,-.7071), vec2(-.7071,.7071));
  void main(){
    vec4 base = texture2D(tDiffuse, vUv);
    vec4 c0 = S(vUv);
    float d0 = c0.a;
    vec3 n0 = dec(c0);
    float lap = 0.0, nd = 0.0; float bgAll = 1.0;
    for(int i=0;i<8;i+=2){
      vec4 a = S(vUv + DIRS[i]*uTexel*uOffD);
      vec4 a2 = S(vUv + DIRS[i+1]*uTexel*uOffD);
      vec4 b = S(vUv + DIRS[i]*uTexel*uOffN);
      vec4 b2 = S(vUv + DIRS[i+1]*uTexel*uOffN);
      lap += abs(a.a + a2.a - 2.0*d0);
      nd += (1.0 - dot(n0, dec(b))) + (1.0 - dot(n0, dec(b2)));
      if(a.a < 300.0 || a2.a < 300.0) bgAll = 0.0;
    }
    float bg = c0.a > 300.0 ? 1.0 : 0.0;
    float dEdge = smoothstep(0.006, 0.026, lap / (4.0 * d0) * 2.0);
    float bgMask = (bg > 0.5 && bgAll > 0.5) ? 0.0 : 1.0;
    // creases: only real corners, gone in the middle distance
    float nEdge = smoothstep(0.95, 2.4, nd) * bgMask * (1.0 - smoothstep(14.0, 42.0, d0));
    float e = max(dEdge * uSil, nEdge * uCrease);
    e *= mix(1.0, 0.55, smoothstep(30.0, 90.0, d0));
    e *= exp(-pow(max(d0 - uFogNear, 0.0) * uFog, 2.0) * 1.6);

    /* depth AO: neighbours that are closer (but not far in front) occlude this pixel */
    float ao = 0.0;
    if (bg < 0.5) {
      float rpx = clamp(0.42 * uFocal / d0, 2.5, 22.0);
      float rot = h12(gl_FragCoord.xy) * 6.2831;
      float cr = cos(rot), sr = sin(rot);
      for (int i = 0; i < 8; i++) {
        vec2 d = DIRS[i]; d = vec2(d.x * cr - d.y * sr, d.x * sr + d.y * cr);
        float k = (i < 4) ? 1.0 : 0.55;
        float dn = S(vUv + d * uTexel * rpx * k).a;
        float dz = d0 - dn;
        ao += smoothstep(0.02 * d0 * 0.05 + 0.03, 0.22, dz) * (1.0 - smoothstep(0.9, 2.2, dz));
      }
      ao = clamp(ao / 8.0, 0.0, 1.0) * uAO * exp(-pow(max(d0 - uFogNear, 0.0) * uFog, 2.0) * 1.6) * (1.0 - smoothstep(60.0, 140.0, d0));
    }
    vec3 col = base.rgb * (1.0 - ao);
    // ink: the local colour, darkened and slightly cooled (never pure black)
    vec3 lc = clamp(col, 0.0, 1.0) * vec3(0.4, 0.42, 0.48) + vec3(0.008, 0.01, 0.022);
    col = mix(col, lc, e);
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, col * vec3(0.94, 0.97, 1.08), (1.0 - smoothstep(0.0, 0.5, l)) * 0.6);
    vec2 vv = vUv - 0.5;
    col *= 1.0 - dot(vv, vv) * 0.28;
    gl_FragColor = vec4(col, base.a);
  }`,
};

// last pass: 8-bit dither so the dark navy gradients never band
const DitherShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: OutlineShader.vertexShader,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; varying vec2 vUv;
  float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb += (h(gl_FragCoord.xy) + h(gl_FragCoord.xy + 17.0) - 1.0) / 255.0; gl_FragColor = c; }`,
};

export function createPipeline(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const refl = new PlanarReflection();
  const scenePass = new ScenePass(scene, camera, refl);
  composer.addPass(scenePass);
  const outline = new ShaderPass(OutlineShader);
  outline.material.uniforms.tNormal.value = scenePass.nrt.texture;
  composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.5, 0.55, 1.0);
  // bloom works at half resolution: soft glow does not need more and it saves a lot of fill rate
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  /* anti-aliasing. The scene is already rendered with 4x MSAA (geometry edges) and the ink is computed from
     an MSAA normal/depth target, so the default adds nothing on top: FXAA blurred sign text and road paint.
     ?aa=fxaa | smaa switches a post AA pass on for comparison (pipe.setAA at runtime). */
  const fxaa = new ShaderPass(FXAAShader);
  const smaa = new SMAAPass();
  composer.addPass(fxaa);
  composer.addPass(smaa);
  const setAA = (mode) => { fxaa.enabled = mode === 'fxaa'; smaa.enabled = mode === 'smaa'; };
  setAA(new URLSearchParams(location.search).get('aa') || 'msaa');
  composer.addPass(new ShaderPass(DitherShader));

  function resize(w, h, pr) {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    const bw = Math.floor(w * pr);
    const bh = Math.floor(h * pr);
    scenePass.setSize(bw, bh);
    refl.setSize(bw, bh);
    outline.material.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    // ink weight is defined in CSS pixels, so it looks the same on 1x, 2x and adaptive-scaled canvases
    outline.material.uniforms.uOffD.value = 0.65 * pr;
    outline.material.uniforms.uOffN.value = 0.5 * pr;
    outline.material.uniforms.uFocal.value = bh / (2 * Math.tan((30 * Math.PI) / 360));
    fxaa.material.uniforms.resolution.value.set(1 / bw, 1 / bh);
    bloom.resolution.set(bw, bh);
  }
  return { composer, refl, scenePass, outline, bloom, fxaa, smaa, setAA, resize };
}
