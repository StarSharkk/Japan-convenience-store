import * as THREE from 'three';

/* ====================================================================================================
   Camera Movement Control - screen-relative panning across the town.

   One input state (up / down / left / right) fed by three sources that share the same logic:
   the W A S D (and arrow) keys, the on-screen D-pad (mouse hold) and touch long-press on the D-pad.
   Every frame the held directions become a screen-space vector (diagonals normalised), which is turned
   into a ground-plane move: "up" = the camera's forward direction flattened onto the ground, "right" =
   its right-hand side, so the keys always match the screen however the view is rotated.
   Camera AND OrbitControls.target move by the same amount, so the viewing angle and zoom never change.
   Speed scales with the zoom distance (fine near buildings, fast over the whole town); a short ease in /
   out (about 0.15 s, no drift) and a frame-rate-independent step. The target stays on the map: the move is
   clamped there, and the camera takes the clamped move too.
   Typing in a field, a modifier key, the window losing focus or the tab going hidden all stop it.
   ==================================================================================================== */

const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
const ARROW = {
  up: 'M12 19V5M5.5 11.5 12 5l6.5 6.5',
  down: 'M12 5v14M5.5 12.5 12 19l6.5-6.5',
  left: 'M19 12H5M11.5 5.5 5 12l6.5 6.5',
  right: 'M5 12h14M12.5 5.5 19 12l-6.5 6.5',
};
const LABEL = { up: '镜头向上平移（W）', down: '镜头向下平移（S）', left: '镜头向左平移（A）', right: '镜头向右平移（D）' };

export function createCamPan({ camera, controls, bounds, parent, onStart }) {
  const keys = new Set(); // directions held on the keyboard
  const pads = new Map(); // pointerId -> direction held on the D-pad
  const vel = new THREE.Vector3();
  const want = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), step = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const btn = {};

  const held = (d) => keys.has(d) || [...pads.values()].includes(d);
  const refresh = () => Object.entries(btn).forEach(([d, b]) => b.classList.toggle('on', held(d)));
  const stopAll = () => { keys.clear(); pads.clear(); refresh(); };
  const typing = (e) => {
    const t = e.target;
    if (!t || t === document.body) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  };

  /* keyboard */
  window.addEventListener('keydown', (e) => {
    const d = KEYMAP[e.code];
    if (!d || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); // arrows never scroll the page
    if (!keys.has(d)) { keys.add(d); onStart && onStart(); refresh(); }
  });
  window.addEventListener('keyup', (e) => { const d = KEYMAP[e.code]; if (d && keys.delete(d)) refresh(); });
  window.addEventListener('blur', stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

  /* D-pad (mouse + touch through pointer events, held until release) */
  const pad = document.createElement('div');
  pad.className = 'ce-pad';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Camera Movement · 方向控制');
  const grid = document.createElement('div');
  grid.className = 'ce-pad-grid';
  ['up', 'left', 'down', 'right'].forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ce-pad-b ce-pad-${d}`;
    b.setAttribute('aria-label', LABEL[d]);
    b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${ARROW[d]}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const release = (e) => { if (pads.delete(e.pointerId)) refresh(); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      pads.set(e.pointerId, d); onStart && onStart(); refresh();
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard users: Enter / Space on a focused button nudges once
    b.addEventListener('click', (e) => { if (e.detail === 0) { keys.add(d); refresh(); setTimeout(() => { keys.delete(d); refresh(); }, 180); } });
    btn[d] = b;
    grid.append(b);
  });
  pad.append(grid);
  parent.append(pad);

  /* per frame */
  function update(dt) {
    const ix = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const iy = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
    // screen directions on the ground plane
    fwd.subVectors(controls.target, camera.position).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    fwd.normalize();
    right.crossVectors(fwd, UP).normalize();
    const dist = camera.position.distanceTo(controls.target);
    const speed = THREE.MathUtils.clamp(dist * 0.55, 3.5, 75); // m/s: fine close up, quick over the town
    want.set(0, 0, 0).addScaledVector(right, ix).addScaledVector(fwd, iy);
    if (want.lengthSq() > 1) want.normalize(); // diagonals are not faster
    want.multiplyScalar(speed);
    // short ease in / out, frame-rate independent; stops in ~0.15 s, no drift
    const rate = want.lengthSq() > 0 ? 11 : 20;
    vel.lerp(want, 1 - Math.exp(-rate * dt));
    if (want.lengthSq() === 0 && vel.lengthSq() < 0.0004) { vel.set(0, 0, 0); return false; }
    step.copy(vel).multiplyScalar(dt);
    // keep the target on the map; the camera takes exactly the move the target could make
    const tx = THREE.MathUtils.clamp(controls.target.x + step.x, bounds.x0, bounds.x1);
    const tz = THREE.MathUtils.clamp(controls.target.z + step.z, bounds.z0, bounds.z1);
    step.set(tx - controls.target.x, 0, tz - controls.target.z);
    if (Math.abs(step.x) < 1e-7) vel.x = 0;
    if (Math.abs(step.z) < 1e-7) vel.z = 0;
    controls.target.add(step);
    camera.position.add(step);
    return true;
  }
  return { update, stop: stopAll, get active() { return keys.size > 0 || pads.size > 0 || vel.lengthSq() > 0; } };
}
