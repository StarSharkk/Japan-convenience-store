import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
    if (reg.reflOn !== false) this.refl.render(renderer, scene, camera, reg.ground.concat(reg.noRefl)); // dry / snowy ground has nothing to mirror

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
    scene.overrideMaterial = null;
    scene.background = bg;
    scene.fog = fog;
  }
}

/* ------------------------------------------------------------------ ink lines / grading */
const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uOffD: { value: 1.0 }, // silhouette ink half-width (physical px)
    uOffN: { value: 0.7 }, // crease ink half-width (physical px)
    uFog: { value: 0 }, // scene fog density: ink lines dissolve into fog like everything else
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform vec2 uTexel; uniform float uOffD; uniform float uOffN; uniform float uFog;
  varying vec2 vUv;
  vec4 S(vec2 uv){ vec4 c = texture2D(tNormal, uv); if(c.a < 0.02) c.a = 400.0; return c; }
  vec3 dec(vec4 c){ return normalize(c.rgb*2.0-1.0 + 1e-5); }
  // 8-tap ring so the ink line is round (no axis-aligned stair-stepping)
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
      lap += abs(a.a + a2.a - 2.0*d0);          // second derivative: flat/grazing planes give ~0
      nd += (1.0 - dot(n0, dec(b))) + (1.0 - dot(n0, dec(b2)));
      if(a.a < 300.0 || a2.a < 300.0) bgAll = 0.0;
    }
    float dEdge = smoothstep(0.0055, 0.02, lap / (4.0 * d0) * 2.0);
    float bgMask = (c0.a > 300.0 && bgAll > 0.5) ? 0.0 : 1.0;
    float nEdge = smoothstep(0.55, 1.5, nd) * bgMask;
    float e = max(dEdge, nEdge * 0.85);
    e *= mix(1.0, 0.5, smoothstep(34.0, 90.0, d0));
    e *= exp(-pow(d0 * uFog, 2.0) * 1.6);
    vec3 col = base.rgb;
    // ink colour: deep tinted version of the local paint, like hand-inked vector linework
    vec3 lc = clamp(col, 0.0, 1.0) * 0.14 + vec3(0.012, 0.016, 0.048);
    col = mix(col, lc, e * 0.94);
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, col * vec3(0.94, 0.97, 1.08), (1.0 - smoothstep(0.0, 0.5, l)) * 0.6);
    vec2 vv = vUv - 0.5;
    col *= 1.0 - dot(vv, vv) * 0.4;
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
    outline.material.uniforms.uOffD.value = 0.8 * pr;
    outline.material.uniforms.uOffN.value = 0.55 * pr;
    bloom.resolution.set(bw, bh);
  }
  return { composer, refl, scenePass, outline, bloom, resize };
}
