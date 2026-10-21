import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { reg, toon, glow, bx, cy, cyl2, canvasTex, halo, roundRect } from '../core.js';
import { CROSSINGS } from './layout.js';

/* ====================================================================================================
   Seaside tram (江ノ電-style), Phase 1: one double-ended car that runs on the town's single track.

   Model (car-local frame): +z = the "A" end (towards the north terminus), x = width, y = up from the
   rail head. 11.0 m long, 2.3 m wide, floor at 1.0, roof crown at ~3.6, pantograph head at 4.28 under
   the contact wire (rail + 4.3). Livery: cream upper body, green lower body, a thin gold line, all from
   one shader on one rounded body mesh (crisp belt line, no seams).

   On the track: two bogies 7.2 m apart each sit on reg.railPath (rail-head height); the body hangs
   between them (position = midpoint, heading and pitch = the chord), so on the R = 10 curve the car
   takes the chord like a real one instead of sliding sideways. Each bogie also turns to the local
   track tangent and its wheels roll with the distance travelled.

   Service: a shuttle west terminus -> station -> north terminus -> station -> ... with eased starts
   and stops (trapezoidal speed), dwell at every stop, and the level crossings ringing / lowering their
   arms while the car approaches and until it has cleared them. The car is double-ended: it never
   turns, it just drives the other way (head- and tail-lights swap).
   ==================================================================================================== */

const L = 11.0, W = 2.3, HALF = L / 2;
const FLOOR = 1.0, BELT = 1.95, ROOF = 3.42;
const BOGIE = 3.6; // bogie centres at z = +-3.6
const WHEEL_R = 0.42, GAUGE = 1.067;
const GREEN = new THREE.Color('#3e8f6c'), CREAM = new THREE.Color('#efe6cd'), GOLD = new THREE.Color('#c9a64a');

/* ---------------------------------------------------------------- livery shader on a toon material */
function liveryMat() {
  const m = toon('#ffffff', { nocache: true, lit: 0.02 });
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    prev(sh);
    sh.uniforms.uGreen = { value: GREEN }; sh.uniforms.uCream = { value: CREAM }; sh.uniforms.uGold = { value: GOLD };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLy; uniform vec3 uGreen; uniform vec3 uCream; uniform vec3 uGold;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float aw = fwidth(vLy) * 0.75;
          float belt = ${BELT.toFixed(3)};
          vec3 c = mix(uGreen, uCream, smoothstep(belt - aw, belt + aw, vLy));
          // thin gold line just under the belt, green "eyebrow" line under the roof
          float gl = smoothstep(belt - 0.06 - aw, belt - 0.06 + aw, vLy) * (1.0 - smoothstep(belt - 0.035 - aw, belt - 0.035 + aw, vLy));
          c = mix(c, uGold, gl);
          float eb = smoothstep(3.08 - aw, 3.08 + aw, vLy) * (1.0 - smoothstep(3.16 - aw, 3.16 + aw, vLy));
          c = mix(c, uGreen, eb);
          diffuseColor.rgb *= c;
        }`);
  };
  m.customProgramCacheKey = () => 'tramLivery';
  return m;
}

/* ---------------------------------------------------------------- painted textures */
const PX = 100; // texture pixels per metre (canvasTex doubles it)
/** side glass: alpha-cut window shapes (driver window, two doors, five saloon windows) */
function sideGlassTex() {
  return canvasTex(L * PX, 1.0 * PX, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const y0 = 1.9; // texture covers y 1.9 .. 2.9
    const win = (z0, z1, ya, yb, r = 9) => {
      const x = (z0 + HALF) * PX, X = (z1 + HALF) * PX, top = (2.9 - yb) * PX, bot = (2.9 - ya) * PX;
      const gr = g.createLinearGradient(x, top, X, bot);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#c9d3dc'); gr.addColorStop(0.55, '#e8eef3'); gr.addColorStop(1, '#a9b5c0');
      g.fillStyle = gr; roundRect(g, x, top, X - x, bot - top, r); g.fill();
      // seat backs / passengers as soft shapes in the lower part
      g.fillStyle = 'rgba(40,52,64,0.28)'; g.fillRect(x + 4, bot - (bot - top) * 0.32, X - x - 8, (bot - top) * 0.32);
    };
    for (let i = 0; i < 5; i++) { const z0 = -3.125 + i * 1.3; win(z0, z0 + 1.05, 1.98, 2.72); }
    [-1, 1].forEach((s) => {
      win(s > 0 ? 3.68 : -4.42, s > 0 ? 4.42 : -3.68, 2.02, 2.72, 6); // door windows
      win(s > 0 ? 4.82 : -5.28, s > 0 ? 5.28 : -4.82, 2.0, 2.72, 7); // driver's windows
    });
    void y0;
  });
}
/** side details on the body: door outlines, handles, emblem, car number */
function sideDetailTex(num) {
  return canvasTex(L * PX, 2.2 * PX, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const Y = (y) => (3.1 - y) * PX, Z = (z) => (z + HALF) * PX; // covers y 0.9 .. 3.1
    g.strokeStyle = 'rgba(30,40,36,0.75)'; g.lineWidth = 3;
    [[3.55, 4.55], [-4.55, -3.55]].forEach(([a, b]) => {
      roundRect(g, Z(a), Y(2.8), Z(b) - Z(a), Y(1.02) - Y(2.8), 6); g.stroke();
      g.beginPath(); g.moveTo(Z((a + b) / 2), Y(2.8)); g.lineTo(Z((a + b) / 2), Y(1.02)); g.stroke(); // bi-parting doors
    });
    // grab handles beside the doors
    g.fillStyle = '#c9ccd1';
    [[3.42, 3.5], [4.6, 4.68], [-3.5, -3.42], [-4.68, -4.6]].forEach(([a, b]) => g.fillRect(Z(a), Y(2.4), Z(b) - Z(a), Y(1.5) - Y(2.4)));
    // emblem + car number on the green
    g.fillStyle = '#2f6f53'; g.beginPath(); g.arc(Z(2.6), Y(2.92), 11, 0, 7); g.fill();
    g.strokeStyle = '#efe6cd'; g.lineWidth = 2; g.beginPath(); g.arc(Z(2.6), Y(2.92), 7, 0, 7); g.stroke();
    g.fillStyle = '#efe6cd'; g.font = '800 34px "DIN Alternate","Helvetica Neue",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(num, Z(0.0), Y(1.35));
  });
}
/** windscreen: three panes, alpha-cut */
function frontGlassTex() {
  return canvasTex(2.3 * PX, 1.0 * PX, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const panes = [[-1.0, -0.42], [-0.34, 0.34], [0.42, 1.0]];
    panes.forEach(([a, b]) => {
      const x = (a + 1.15) * PX, X = (b + 1.15) * PX;
      const gr = g.createLinearGradient(x, 0, X, h);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#c3cfd9'); gr.addColorStop(1, '#9fb0bd');
      g.fillStyle = gr; roundRect(g, x, 6, X - x, h - 12, 8); g.fill();
    });
    // wipers
    g.strokeStyle = 'rgba(25,28,32,0.8)'; g.lineWidth = 2.5;
    [[-0.7, 1], [0.7, -1]].forEach(([c, s]) => { const x = (c + 1.15) * PX; g.beginPath(); g.moveTo(x, h - 10); g.lineTo(x + s * 22, h * 0.35); g.stroke(); });
  });
}
function destTex() {
  return canvasTex(256, 48, (g, w, h) => {
    g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 26px "Hiragino Sans","Noto Sans JP",sans-serif'; g.fillText('星空海岸', w * 0.38, h * 0.5);
    g.fillStyle = '#ffd36a'; g.font = '700 13px Arial,sans-serif'; g.fillText('HOSHIZORA', w * 0.8, h * 0.36); g.fillText('KAIGAN', w * 0.8, h * 0.7);
  });
}
function numberTex(num) {
  return canvasTex(128, 40, (g, w, h) => {
    g.fillStyle = '#e8dfc4'; roundRect(g, 2, 2, w - 4, h - 4, 6); g.fill();
    g.fillStyle = '#2f6f53'; g.font = '800 28px "DIN Alternate","Helvetica Neue",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, w / 2, h / 2 + 1);
  });
}

/* ---------------------------------------------------------------- model */
function buildCar(num = '1201') {
  const car = new THREE.Group();
  const body = new THREE.Group(); // everything that rides on the springs
  car.add(body);
  const dark = toon('#2a2d33'), metal = toon('#8d939c'), roofM = toon('#9aa1a3'), black = toon('#17191d');

  // body shell (one rounded box, livery from the shader)
  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, ROOF - FLOOR, L, 4, 0.2), liveryMat());
  shell.geometry.translate(0, (ROOF - FLOOR) / 2 + FLOOR, 0);
  shell.castShadow = true; shell.receiveShadow = true;
  body.add(shell);
  // arched roof (extruded arch with rounded ends)
  {
    const s = new THREE.Shape();
    s.moveTo(-1.08, 0); s.quadraticCurveTo(0, 0.42, 1.08, 0); s.lineTo(-1.08, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: L - 0.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.12, bevelSegments: 3, curveSegments: 14 });
    geo.translate(0, 0, -(L - 0.5) / 2);
    const roof = new THREE.Mesh(geo, roofM); roof.position.y = ROOF - 0.08; roof.castShadow = true; body.add(roof);
  }
  // glass (alpha-cut) + painted details on both sides
  const sideGlass = glow('#ffffff', 1, { map: sideGlassTex(), cat: 'lamp', off: '#5a6a76', transparent: false });
  sideGlass.alphaTest = 0.5; sideGlass.color.set('#5a6a76');
  const lit = reg.emis[reg.emis.length - 1]; lit.base.set('#ffe0ad').multiplyScalar(1.35); // night: warm cabin light
  const frontGlass = glow('#ffffff', 1, { map: frontGlassTex(), cat: 'lamp', off: '#55636e', transparent: false });
  frontGlass.alphaTest = 0.5; frontGlass.color.set('#55636e');
  reg.emis[reg.emis.length - 1].base.set('#ffe6bd').multiplyScalar(1.1);
  const detail = new THREE.MeshBasicMaterial({ map: sideDetailTex(num), transparent: true, alphaTest: 0.3 });
  [-1, 1].forEach((s) => {
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.0), sideGlass);
    gp.position.set(s * (W / 2 + 0.004), 2.4, 0); gp.rotation.y = s * Math.PI / 2; body.add(gp);
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.2), detail);
    dp.position.set(s * (W / 2 + 0.006), 2.0, 0); dp.rotation.y = s * Math.PI / 2; dp.userData.noLine = true; body.add(dp);
    // window frames: thin cream-white sills give the windows depth
    bx(body, toon('#f6f1e4'), s * (W / 2) - 0.01, s * (W / 2) + 0.02 * s, 1.94, 1.98, -3.2, 3.2, { cast: false });
    // rain gutter under the roof
    bx(body, metal, s * (W / 2) - 0.02, s * (W / 2) + 0.03 * s, 3.22, 3.26, -HALF + 0.3, HALF - 0.3, { cast: false });
  });
  // both ends: windscreen, destination blind, headlights, taillights, number plate, anticlimber, coupler
  const ends = {};
  [-1, 1].forEach((e) => {
    const zf = e * (HALF + 0.004);
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.0), frontGlass);
    fg.position.set(0, 2.42, zf); fg.rotation.y = e > 0 ? 0 : Math.PI; body.add(fg);
    const dm = glow('#ffffff', 1.15, { map: destTex(), track: false });
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.19), dm);
    dest.position.set(0, 3.03, zf + e * 0.012); dest.rotation.y = fg.rotation.y; dest.userData.noLine = true; body.add(dest);
    bx(body, black, -0.54, 0.54, 2.92, 3.14, zf - e * 0.01, zf + e * 0.006, { cast: false }); // blind box
    const np = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ map: numberTex(num) }));
    np.position.set(0, 1.42, zf + e * 0.003); np.rotation.y = fg.rotation.y; np.userData.noLine = true; body.add(np);
    const head = glow('#fff4d8', 2.6, { track: false }), tail = glow('#ff2a1a', 2.4, { track: false });
    const lamps = [];
    [-0.78, 0.78].forEach((x) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 18), metal);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.5, zf); body.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 18), head);
      lens.position.set(x, 1.5, zf + e * 0.032); lens.rotation.y = fg.rotation.y; lens.userData.noLine = true; body.add(lens);
      const tl = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), tail);
      tl.position.set(x * 0.72, 1.5, zf + e * 0.01); tl.rotation.y = fg.rotation.y; tl.userData.noLine = true; body.add(tl);
      lamps.push(halo(body, x, 1.5, zf + e * 0.2, '#fff1cc', 1.6, 0.6, 'lamp'));
    });
    const tailHalos = [-0.56, 0.56].map((x) => halo(body, x, 1.5, zf + e * 0.12, '#ff3a2a', 0.7, 0.55));
    bx(body, dark, -1.0, 1.0, FLOOR - 0.06, FLOOR + 0.06, zf - e * 0.05, zf + e * 0.09, { cast: false }); // anticlimber
    bx(body, dark, -0.16, 0.16, 0.66, 0.88, zf, zf + e * 0.38, { cast: false }); // coupler
    ends[e] = { head, tail, headBase: head.color.clone(), tailBase: tail.color.clone(), lamps, tailHalos };
  });
  // under-floor equipment between the bogies + skirts
  bx(body, dark, -0.95, 0.95, 0.62, FLOOR, -2.3, 2.3, { cast: false });
  [-1.5, 0.2, 1.6].forEach((z) => bx(body, toon('#3b3f47'), -0.8, 0.8, 0.5, 0.64, z - 0.45, z + 0.45, { cast: false }));
  // roof: two air-conditioning units, a walkway, the pantograph over the A-end bogie
  [[-1.6, 1.7], [-4.0, 1.2]].forEach(([z, l]) => {
    const ac = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.32, l, 3, 0.08), toon('#b9bfc3'));
    ac.position.set(0, ROOF + 0.3, z); ac.castShadow = true; body.add(ac);
    bx(body, toon('#7d8489'), -0.38, 0.38, ROOF + 0.465, ROOF + 0.475, z - l * 0.25, z + l * 0.25, { cast: false }); // fan grille
  });
  {
    const P = new THREE.Group(); P.position.set(0, ROOF + 0.14, 2.6); body.add(P);
    [-0.35, 0.35].forEach((x) => { cy(P, toon('#c9b48a'), x, 0, -0.35, 0.05, 0.1, 8); cy(P, toon('#c9b48a'), x, 0, 0.35, 0.05, 0.1, 8); });
    bx(P, dark, -0.45, 0.45, 0.1, 0.16, -0.45, 0.45, { cast: false });
    // single-arm pantograph: lower arm, knee, upper arm, pan head with horns, raised to the wire (rail + 4.30)
    const top = 4.27 - (ROOF + 0.14);
    const knee = [0, 0.4, -0.55], headP = [0, top, 0.15];
    cyl2(P, metal, [0, 0.16, 0.35], knee, 0.035, 6);
    cyl2(P, metal, knee, headP, 0.025, 6);
    cyl2(P, metal, [0, 0.16, 0.2], [0, 0.38, -0.28], 0.015, 5);
    cyl2(P, dark, [-0.55, top, 0.15], [0.55, top, 0.15], 0.025, 6);
    [-1, 1].forEach((s) => cyl2(P, dark, [s * 0.55, top, 0.15], [s * 0.72, top - 0.12, 0.15], 0.02, 5));
    cyl2(P, metal, [-0.2, top - 0.05, 0.15], [0.2, top - 0.05, 0.15], 0.015, 4);
  }
  // bogies (not part of the sprung body)
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.1, 20).rotateZ(Math.PI / 2);
  const flangeGeo = new THREE.CylinderGeometry(WHEEL_R + 0.04, WHEEL_R + 0.04, 0.025, 20).rotateZ(Math.PI / 2);
  const wheelM = toon('#3a3d44'), rimM = toon('#9ba1aa');
  const bogies = [-1, 1].map((e) => {
    const b = new THREE.Group(); car.add(b);
    const frame = toon('#30343b');
    [-1, 1].forEach((s) => {
      bx(b, frame, s * 0.86, s * 0.98, 0.32, 0.62, -1.15, 1.15, { cast: true });
      cy(b, toon('#5a5f68'), s * 0.92, 0.62, -0.45, 0.07, 0.22, 8); cy(b, toon('#5a5f68'), s * 0.92, 0.62, 0.45, 0.07, 0.22, 8); // springs
    });
    bx(b, frame, -0.98, 0.98, 0.45, 0.62, -0.25, 0.25); // bolster
    const axles = [-0.9, 0.9].map((z) => {
      const a = new THREE.Group(); a.position.set(0, WHEEL_R, z); b.add(a);
      [-1, 1].forEach((s) => {
        const w = new THREE.Mesh(wheelGeo, wheelM); w.position.x = s * GAUGE / 2; w.castShadow = true; a.add(w);
        const f = new THREE.Mesh(flangeGeo, wheelM); f.position.x = s * (GAUGE / 2 - 0.06); a.add(f);
        // a spoke mark so the rolling is visible
        const k = new THREE.Mesh(new THREE.BoxGeometry(0.02, WHEEL_R * 1.4, 0.06), rimM); k.position.x = s * (GAUGE / 2 + 0.051); a.add(k);
      });
      cyl2(a, toon('#4a4e56'), [-GAUGE / 2, 0, 0], [GAUGE / 2, 0, 0], 0.05, 6);
      return a;
    });
    return { g: b, e, axles };
  });
  return { car, body, bogies, ends };
}

/* ---------------------------------------------------------------- running on the track */
export function buildTrain(parent) {
  const path = reg.railPath;
  if (!path) return null;
  const QS = new URLSearchParams(location.search);
  if (QS.get('train') === '0') return null;
  const { car, body, bogies, ends } = buildCar('1201');
  car.userData.keep = true; // animated: never merged into the static batches
  parent.add(car);

  // stops along the track (s = distance from the west end; on the straight s = x + 48)
  // station stop: centred at x = 17.9 so the rear end (x 12.4) stands clear of the main-road crossing (x 7.5 .. 12)
  const sStation = 17.9 + 48;
  const stops = [{ s: 10.5, name: 'west' }, { s: sStation, name: 'station' }, { s: path.length - 9.0, name: 'north' }, { s: sStation, name: 'station' }];
  const crossS = CROSSINGS.map((c) => ({ id: c.id, s: c.x + 48, half: (c.x1 - c.x0) / 2 }));
  const VMAX = 4.2, ACC = 0.55, DWELL = 6.0;
  const st = { s: stops[0].s, v: 0, leg: 0, dwell: 2.0, dir: 1 };

  const pA = new THREE.Vector3(), pB = new THREE.Vector3();
  const at = (s, out) => { const p = path.at(s); return out.set(p.x, p.y, p.z); };
  const heading = (s) => { const a = path.at(s - 0.3), b = path.at(s + 0.3); return Math.atan2(b.x - a.x, b.z - a.z); };
  const setLights = () => {
    [-1, 1].forEach((e) => {
      const isFront = e === st.dir;
      const E = ends[e];
      E.head.color.copy(E.headBase).multiplyScalar(isFront ? 1 : 0.06);
      E.tail.color.copy(E.tailBase).multiplyScalar(isFront ? 0.08 : 1);
      E.lamps.forEach((h) => (h.visible = isFront));
      E.tailHalos.forEach((h) => (h.visible = !isFront));
    });
  };
  const place = (t) => {
    at(st.s + BOGIE, pA); at(st.s - BOGIE, pB);
    car.position.copy(pA).add(pB).multiplyScalar(0.5);
    const yaw = Math.atan2(pA.x - pB.x, pA.z - pB.z);
    const pitch = Math.atan2(pA.y - pB.y, Math.hypot(pA.x - pB.x, pA.z - pB.z));
    car.rotation.set(-pitch, yaw, 0, 'YXZ');
    // bogies: on their own track point, turned to the local tangent (relative to the body)
    bogies.forEach((b) => {
      const s = st.s + b.e * BOGIE;
      b.g.position.set(0, 0, b.e * BOGIE);
      b.g.rotation.y = heading(s) - yaw;
    });
    // gentle body sway / pitch on the springs, stronger with speed
    const k = Math.min(1, st.v / VMAX);
    body.rotation.z = Math.sin(t * 1.9) * 0.006 * k + Math.sin(t * 5.3) * 0.002 * k;
    body.position.y = Math.sin(t * 3.1) * 0.006 * k;
  };

  setLights();
  place(0);
  // reg.train.paused / reg.train.seek(s) are inspection hooks (screenshots, checks)
  reg.train = { car, state: st, stops, path, paused: false, seek(s) { st.s = Math.max(BOGIE + 1, Math.min(path.length - BOGIE - 1, s)); st.v = 0; } };
  reg.updaters.push((t, dt) => {
    dt = Math.min(dt, 0.1);
    if (reg.train.paused) { place(t); return; }
    if (st.dwell > 0) {
      st.dwell -= dt;
      if (st.dwell <= 0) { st.leg = (st.leg + 1) % stops.length; st.dir = Math.sign(stops[st.leg].s - st.s) || st.dir; setLights(); }
    } else {
      const target = stops[st.leg].s;
      const rem = Math.abs(target - st.s);
      // trapezoidal profile: accelerate, cruise, brake so that v -> 0 exactly at the stop
      st.v = Math.min(VMAX, st.v + ACC * dt, Math.sqrt(2 * ACC * rem));
      const ds = Math.min(rem, st.v * dt);
      st.s += st.dir * ds;
      bogies.forEach((b) => b.axles.forEach((a) => (a.rotation.x += (st.dir * ds) / WHEEL_R)));
      if (rem - ds < 0.002) { st.s = target; st.v = 0; st.dwell = DWELL; }
    }
    // level crossings: warn while the car is approaching (about 7 s ahead) and until its rear has cleared
    let ring = false;
    for (const c of crossS) {
      const d = (c.s - st.s) * st.dir; // > 0: crossing ahead
      const moving = st.dwell <= 0;
      if (moving && d > -HALF - c.half - 1.0 && d < 30) ring = true;
      if (Math.abs(d) < HALF + c.half + 0.2) ring = true; // standing on / across the crossing
    }
    if (ring && reg.crossings) reg.crossings.ring(0.6);
    place(t);
  });
  return reg.train;
}
