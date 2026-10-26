import * as THREE from 'three';
import { reg, ENVK, SNOW_U, clamp, smooth, lerp, lk } from './core.js';
import { GLASS_U } from './fx.js';
import { SEASON_U } from './tree.js';
import { createSky } from './sky.js';
import { CLOUD_U } from './clouds.js';
import { createHolidays, HOLIDAYS } from './holiday.js';
import { holidayAtmosphereConfig as HC } from './holidayConfig.js';
import { createFireworks } from './fireworks.js';

/* ====================================================================================================
   Environment state manager
   --------------------------------------------------------------------------------------------------
   state  = what the user chose                { weather, season, time, holiday, storeStatus, storeMode ... }
   cur    = what is currently on screen        (every continuous quantity eases towards its target, so
                                                 nothing ever pops: rain fades in, snow piles up, the sun slides)
   Everything is applied to ONE existing scene through uniforms / light intensities / material colours;
   no model is ever recreated. Weather x season x time x holiday x store status are independent axes
   and are combined every frame.
   ==================================================================================================== */

export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'heavy', 'snowy', 'foggy', 'thunder'];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export { HOLIDAYS };

/* ---------------------------------------------------------------- weather targets */
const WX = {
  sunny:   { cloud: 0.1,  sun: 1.0,  dark: 1.0,  desat: 0.0,  rain: 0, snow: 0,    fog: 0.0,   wet: 0.0, puddle: 0.0,  ripple: 0,    wind: 0.0,  spd: 1.0,  thunder: 0 },
  cloudy:  { cloud: 0.85, sun: 0.38, dark: 0.93, desat: 0.5,  rain: 0, snow: 0,    fog: 0.002, wet: 0.0, puddle: 0.0,  ripple: 0,    wind: 0.02, spd: 1.0,  thunder: 0 },
  rainy:   { cloud: 0.95, sun: 0.2,  dark: 0.88, desat: 0.55, rain: 0.55, snow: 0, fog: 0.003, wet: 1.0, puddle: 0.75, ripple: 0.7,  wind: 0.04, spd: 1.0,  thunder: 0 },
  heavy:   { cloud: 1.0,  sun: 0.1,  dark: 0.66, desat: 0.7,  rain: 1.0, snow: 0,  fog: 0.006, wet: 1.0, puddle: 1.0,  ripple: 1.0,  wind: 0.16, spd: 1.22, thunder: 0 },
  snowy:   { cloud: 1.0,  sun: 0.3,  dark: 0.96, desat: 0.6,  rain: 0, snow: 0.75, fog: 0.009, wet: 0.12, puddle: 0.0, ripple: 0,    wind: 0.05, spd: 1.0,  thunder: 0 },
  foggy:   { cloud: 0.7,  sun: 0.3,  dark: 0.9,  desat: 0.55, rain: 0, snow: 0,    fog: 0.0125, wet: 0.4, puddle: 0.3,  ripple: 0,    wind: 0.0,  spd: 1.0,  thunder: 0 },
  thunder: { cloud: 1.0,  sun: 0.06, dark: 0.52, desat: 0.78, rain: 1.0, snow: 0,  fog: 0.005, wet: 1.0, puddle: 1.0,  ripple: 1.0,  wind: 0.2,  spd: 1.25, thunder: 1 },
};
const WX_KEYS = Object.keys(WX.sunny);

/* ---------------------------------------------------------------- time-of-day key frames
   [hour, skyTop, skyHorizon, skyGround, sunColour, sunIntensity, hemiSky, hemiGround, hemiIntensity, lampsOn(0..1), stars] */
const KF_RAW = [
  [0,    '#070b24', '#15193f', '#2b2150', '#8fa8e8', 1.5, '#7b8fd0', '#20264a', 2.1, 1.0, 1.0],
  [4,    '#0a1030', '#1b2250', '#2d2455', '#8fa8e8', 1.5, '#7b8fd0', '#22294e', 2.1, 1.0, 0.95],
  [5,    '#233a78', '#c98a96', '#8a5f86', '#ffb08a', 0.7, '#8a96d0', '#3a3350', 1.9, 0.9, 0.35],
  [6,    '#4a78c8', '#ffb98a', '#d9a0a0', '#ffc08a', 1.7, '#9db6e8', '#5a5068', 2.0, 0.7, 0.0],
  [7.5,  '#4f86d8', '#d9e6f5', '#a9c8ee', '#fff0d0', 2.2, '#a8c8f0', '#6a6f82', 2.2, 0.3, 0.0],
  [9,    '#4a8be0', '#cfe6fb', '#9bc6f4', '#fff4dc', 2.5, '#acd0f8', '#6f7488', 2.3, 0.2, 0.0],
  [12,   '#3a82e6', '#d6ecff', '#8ec0f6', '#fffbf0', 2.75, '#b8d8ff', '#757a8c', 2.4, 0.1, 0.0],
  [15,   '#3f86e2', '#d2e8fb', '#93c0f2', '#fff3dc', 2.6, '#b2d3f8', '#72788a', 2.4, 0.12, 0.0],
  [17,   '#5b7acb', '#ffc486', '#e8a878', '#ffc27e', 2.4, '#f0c8a0', '#5a4a58', 2.1, 0.45, 0.0],
  [18,   '#3c4c96', '#ff8f6a', '#9a5a7a', '#ff9a6a', 1.7, '#d0a0b0', '#3a3050', 1.9, 0.8, 0.0],
  [19,   '#1c2866', '#c8708c', '#4a3478', '#b8a0e0', 0.6, '#8088cc', '#2a2850', 2.0, 1.0, 0.3],
  [20.5, '#0e163f', '#3a3a78', '#2d2455', '#8fa8e8', 1.5, '#7a8cd0', '#222850', 2.1, 1.0, 0.8],
  [22,   '#080c28', '#181c44', '#2b2150', '#8fa8e8', 1.5, '#7b8fd0', '#20264a', 2.1, 1.0, 1.0],
  [24,   '#070b24', '#15193f', '#2b2150', '#8fa8e8', 1.5, '#7b8fd0', '#20264a', 2.1, 1.0, 1.0],
];
const KF = KF_RAW.map((r) => ({ h: r[0], top: new THREE.Color(r[1]), mid: new THREE.Color(r[2]), bot: new THREE.Color(r[3]), sunC: new THREE.Color(r[4]), sunI: r[5], hs: new THREE.Color(r[6]), hg: new THREE.Color(r[7]), hi: r[8], glow: r[9], stars: r[10] }));
const K = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color(), sunC: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sunI: 0, hi: 0, glow: 0, stars: 0 };
function sampleKF(hour) {
  let i = 0;
  while (i < KF.length - 2 && hour >= KF[i + 1].h) i++;
  const a = KF[i], b = KF[i + 1];
  const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
  ['top', 'mid', 'bot', 'sunC', 'hs', 'hg'].forEach((k) => K[k].copy(a[k]).lerp(b[k], t));
  ['sunI', 'hi', 'glow', 'stars'].forEach((k) => (K[k] = lerp(a[k], b[k], t)));
  return K;
}

/* ---------------------------------------------------------------- street lamps: sunset -> sunrise
   The celestial model below puts the sun on the horizon at 6:00 and 18:00 in every season
   (sunSin = sin(maxEl * sin((hour - 6) / 12 * PI)) crosses 0 there), so those ARE sunrise and sunset.
   Lamps come on at sunset and are fully off at sunrise; the short fade (20 min) lies inside the night on
   both ends (18:00 -> 18:20 on, 5:40 -> 6:00 off). Weather never changes this: an overcast or stormy day
   keeps them off. Only the street lamps use it (category 'lamp'); signs, lanterns, windows, car lights
   and holiday lights keep their own controls. */
export const SUN = { rise: 6.0, set: 18.0, fade: 1 / 3 };
export function lampsAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= SUN.rise && h < SUN.set) return 0;
  const sinceSet = (h - SUN.set + 24) % 24, toRise = (SUN.rise - h + 24) % 24; // the night wraps past midnight
  return Math.min(smooth(0, SUN.fade, sinceSet), smooth(0, SUN.fade, toRise));
}

/* ---------------------------------------------------------------- seasons */
const SEASON_DATA = {
  spring: { maxEl: 56, sunMul: 1.0, tint: new THREE.Color('#ffd3df'), tintAmt: 0.13, lawn: [0.95, 1.32, 0.85], light: [1.02, 0.97, 1.0] },
  summer: { maxEl: 70, sunMul: 1.15, tint: new THREE.Color('#2f80f0'), tintAmt: 0.06, lawn: [1, 1, 1], light: [1.02, 1.01, 0.97] },
  autumn: { maxEl: 44, sunMul: 0.95, tint: new THREE.Color('#ffc07a'), tintAmt: 0.2, lawn: [1.9, 1.2, 0.55], light: [1.06, 0.99, 0.88] },
  winter: { maxEl: 33, sunMul: 0.85, tint: new THREE.Color('#cfdcf2'), tintAmt: 0.22, lawn: [1.25, 1.3, 1.4], light: [0.94, 0.98, 1.06] },
};

const PRESETS = {
  rainyMidnight: { weather: 'rainy', season: 'summer', time: 23.5, holiday: 'none', storeStatus: 'open' },
  sunnySummer: { weather: 'sunny', season: 'summer', time: 14.5, holiday: 'none', storeStatus: 'open' },
  snowyChristmas: { weather: 'snowy', season: 'winter', time: 21, holiday: 'christmas', storeStatus: 'open' },
  autumnHalloween: { weather: 'cloudy', season: 'autumn', time: 18.4, holiday: 'halloween', storeStatus: 'open' },
  sakuraMorning: { weather: 'sunny', season: 'spring', time: 7.3, holiday: 'sakura', storeStatus: 'open' },
};
export const PRESET_LIST = [
  ['rainyMidnight', '午夜雨景', 'Rainy Midnight'],
  ['sunnySummer', '夏日晴午', 'Sunny Summer Afternoon'],
  ['snowyChristmas', '圣诞雪夜', 'Snowy Christmas Night'],
  ['autumnHalloween', '秋日万圣节傍晚', 'Autumn Halloween Evening'],
  ['sakuraMorning', '樱花清晨', 'Sakura Morning'],
];

const D2R = Math.PI / 180;
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3();
const GRAY = new THREE.Color();
function desat(c, amt, mul = 1) {
  const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  GRAY.setRGB(l, l, l);
  return c.lerp(GRAY, amt).multiplyScalar(mul);
}
const hourLabel = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
export function periodName(h) {
  if (h >= 4.5 && h < 6.5) return '黎明 Dawn';
  if (h >= 6.5 && h < 11) return '早晨 Morning';
  if (h >= 11 && h < 14.5) return '正午 Noon';
  if (h >= 14.5 && h < 16.5) return '午后 Afternoon';
  if (h >= 16.5 && h < 18) return '黄昏 Golden Hour';
  if (h >= 18 && h < 20.5) return '傍晚 Evening';
  if (h >= 20.5 || h < 1.5) return h >= 22 || h < 1.5 ? '深夜 Late Night' : '夜晚 Night';
  return '凌晨 Small hours';
}
export { hourLabel };

/* ================================================================================================== */
export function createEnvironment(ctx) {
  const { scene, hemi, sun, renderer, post, particles } = ctx;
  const sky = createSky(scene);
  const holidays = createHolidays(ctx.world);
  if (ctx.camera) holidays.setCamera(ctx.camera);
  const fireworks = createFireworks(ctx.world);
  scene.background = null;

  /* ------------------------------------------------ state (user intent) */
  const state = {
    weather: 'rainy', season: 'summer', time: 23, holiday: 'none',
    storeStatus: 'open', storeMode: 'manual', openFrom: 7, openTo: 23, alwaysOpen: true,
    autoTime: false, autoSpeed: 0.25, realClock: false,
    quality: 'auto', fireworks: true,
  };
  const listeners = new Set();
  const emit = (what) => listeners.forEach((f) => f(state, what));

  /* ------------------------------------------------ current (eased) values */
  const cur = { ...WX.rainy, season: [0, 1, 0, 0], hol: Object.fromEntries(HOLIDAYS.map((h) => [h, h === 'none' ? 1 : 0])), open: 1, time: state.time };
  let wet = 1, puddle = 0.75, snowCover = 0;
  let flash = 0, lightningT = 3, lightningSeq = [];
  const last = { dir: new THREE.Vector3(), t: -9 };
  let firstFrame = true;
  let doorTex = true;
  const fCache = {};

  /* ------------------------------------------------ holiday atmosphere blending (config in holidayConfig.js)
     cur.hol[id] are eased weights that always sum to 1, so a weighted sum of every holiday's config values is a
     smooth cross-fade between atmospheres (and 'none' contributes the neutral values). */
  const col = (c) => (c ? new THREE.Color(c) : null);
  const ACC = Object.fromEntries(HOLIDAYS.map((id) => [id, {
    door: col(HC[id].lighting.door), tree: col(HC[id].lighting.tree), lamps: col(HC[id].lighting.lamps),
    fog: new THREE.Color(HC[id].fog.tint), motes: new THREE.Color(HC[id].particles.motes.tint),
  }]));
  const hsum = (fn) => { let a = 0; for (const id of HOLIDAYS) a += fn(HC[id]) * cur.hol[id]; return a; };
  const hvec = (fn, out) => { out.set(0, 0, 0); for (const id of HOLIDAYS) { const v = fn(HC[id]); const w = cur.hol[id]; out.x += v[0] * w; out.y += v[1] * w; out.z += v[2] * w; } return out; };
  const _hv = new THREE.Vector3(), _hv2 = new THREE.Vector3(), _c3 = new THREE.Color(), _c4 = new THREE.Color(), _c5 = new THREE.Color(), _fwc = new THREE.Color();
  const accentLight = (name, key) => {
    const l = reg.lights[name];
    if (!l) return;
    const base = l.userData.baseCol || (l.userData.baseCol = l.color.clone());
    _c3.copy(base);
    for (const id of HOLIDAYS) { const c = ACC[id][key]; const w = cur.hol[id]; if (c && w > 0.001) _c3.lerp(c, w * 0.85); }
    l.color.copy(_c3);
  };
  const fwCfg = { rate: 0, palette: ['#ffffff'], types: [0], scale: 1 };

  const k = (rate, dt) => 1 - Math.exp(-rate * dt);
  const _zero = new THREE.Vector3();
  const isStoreOpenAt = (h) => {
    if (state.alwaysOpen || state.openFrom === state.openTo) return true;
    return state.openFrom < state.openTo ? h >= state.openFrom && h < state.openTo : h >= state.openFrom || h < state.openTo;
  };
  const targetOpen = () => (state.storeMode === 'auto' ? isStoreOpenAt(state.time) : state.storeStatus === 'open');

  /* ------------------------------------------------ public setters */
  function set(patch, opts = {}) {
    Object.assign(state, patch);
    if (patch.time !== undefined) state.time = ((patch.time % 24) + 24) % 24;
    if (patch.autoTime === true && state.realClock) syncClock();
    if (opts.instant) snap();
    emit(Object.keys(patch));
  }
  function syncClock() {
    const d = new Date();
    state.time = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }
  function snap() {
    // jump all eased values to their targets (used on first frame / URL presets)
    const w = WX[state.weather];
    WX_KEYS.forEach((key) => (cur[key] = w[key]));
    SEASONS.forEach((s, i) => (cur.season[i] = s === state.season ? 1 : 0));
    HOLIDAYS.forEach((h) => (cur.hol[h] = h === state.holiday ? 1 : 0));
    cur.open = targetOpen() ? 1 : 0;
    cur.time = state.time;
    wet = w.wet; puddle = w.puddle; snowCover = w.snow > 0.3 ? 0.9 : 0;
  }
  function preset(id) { if (PRESETS[id]) set({ ...PRESETS[id], autoTime: false }); }
  function reset() { set({ ...PRESETS.rainyMidnight, storeMode: 'manual', autoTime: false, realClock: false, alwaysOpen: true }); }
  function random() {
    const pick = (arr, wts) => { const tot = wts.reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (let i = 0; i < arr.length; i++) { r -= wts[i]; if (r <= 0) return arr[i]; } return arr[0]; };
    const weather = pick(WEATHERS, [2, 1.6, 2, 0.8, 1, 0.8, 0.6]);
    let season = SEASONS[(Math.random() * 4) | 0];
    if (weather === 'snowy' && Math.random() < 0.6) season = 'winter';
    const holiday = Math.random() < 0.45 ? 'none' : HOLIDAYS[1 + ((Math.random() * (HOLIDAYS.length - 1)) | 0)];
    set({ weather, season, holiday, time: Math.random() * 24, storeStatus: Math.random() < 0.88 ? 'open' : 'closed', storeMode: 'manual', autoTime: false });
    particles.piles.reseed();
  }

  /* ------------------------------------------------ per-frame */
  function update(t, dt) {
    dt = Math.min(dt, 0.1);
    if (firstFrame) { snap(); firstFrame = false; }

    /* time */
    if (state.autoTime) {
      if (state.realClock) syncClock();
      else state.time = (state.time + dt * state.autoSpeed) % 24;
      tickAcc += dt;
      if (tickAcc > 0.15) { tickAcc = 0; emit(['time']); }
    }
    let dTime = state.time - cur.time;
    if (dTime > 12) dTime -= 24; if (dTime < -12) dTime += 24;
    cur.time = state.autoTime ? state.time : (cur.time + dTime * k(7, dt) + 24) % 24;
    const hour = cur.time;

    /* weather / season / holiday easing */
    const w = WX[state.weather];
    const kw = k(1.5, dt);
    WX_KEYS.forEach((key) => (cur[key] += (w[key] - cur[key]) * kw));
    SEASONS.forEach((s, i) => (cur.season[i] += ((s === state.season ? 1 : 0) - cur.season[i]) * k(1.3, dt)));
    HOLIDAYS.forEach((h) => (cur.hol[h] += ((h === state.holiday ? 1 : 0) - cur.hol[h]) * k(2.4, dt)));
    const openT = targetOpen() ? 1 : 0;
    cur.open += (openT - cur.open) * k(1.8, dt);

    // wetness, puddles and snow cover are slow, remembered quantities
    const sunnyish = 1 - clamp(cur.cloud + cur.rain, 0, 1);
    wet += (w.wet - wet) * (w.wet > wet ? k(0.25, dt) : k(0.03 + 0.06 * sunnyish, dt));
    puddle += (w.puddle - puddle) * (w.puddle > puddle ? k(0.12, dt) : k(0.025 + 0.05 * sunnyish, dt));
    if (cur.snow > 0.15) snowCover = Math.min(1, snowCover + dt * 0.07 * cur.snow);
    else snowCover = Math.max(0, snowCover - dt * (0.028 + 0.05 * sunnyish + 0.05 * cur.rain));

    /* sky + celestial positions */
    const sw = cur.season;
    let maxEl = 0, sunMul = 0, tintAmt = 0;
    SEASONS.forEach((s, i) => { const d = SEASON_DATA[s]; maxEl += d.maxEl * sw[i]; sunMul += d.sunMul * sw[i]; tintAmt += d.tintAmt * sw[i]; });
    const kf = sampleKF(hour);
    const day = clamp(1 - kf.glow, 0, 1);
    const sunSin = Math.sin(maxEl * D2R * Math.sin(((hour - 6) / 12) * Math.PI));
    const az = (hour - 6) * 15 * D2R;
    const sunEl = Math.asin(clamp(sunSin, -1, 1));
    const sunDir = _v.set(Math.cos(az) * Math.cos(sunEl), sunSin, Math.sin(az) * Math.cos(sunEl)).clone();
    const hh = (((hour - 18) % 24) + 24) % 24;
    const maz = (50 + hh * 15) * D2R, mel = 55 * D2R * Math.sin((hh / 12) * Math.PI);
    const moonDir = new THREE.Vector3(Math.cos(maz) * Math.cos(mel), Math.sin(mel), Math.sin(maz) * Math.cos(mel));
    const sunUp = smooth(0.0, 0.14, sunSin);
    const moonUp = smooth(0.0, 0.14, moonDir.y);

    // sky colours = key frame, tinted by season, then weather (cloud darkening + desaturation)
    const dsat = cur.desat * (0.35 + 0.65 * day) + 0.3 * snowCover;
    const dk = 1 - (1 - cur.dark) * (0.25 + 0.75 * day);
    const tintSeason = (c) => {
      SEASONS.forEach((s, i) => { _c1.copy(SEASON_DATA[s].tint); c.lerp(_c1, SEASON_DATA[s].tintAmt * sw[i] * (0.4 + 0.6 * day)); });
      return c;
    };
    const top = desat(tintSeason(K.top.clone()), dsat, dk);
    const mid = desat(tintSeason(K.mid.clone()), dsat * 1.15, dk * (1 + cur.fog * 8 * day));
    const bot = desat(K.bot.clone(), dsat, dk);
    // fog pulls the whole sky toward one flat colour -> the horizon melts into the fog
    const fogK = clamp(cur.fog * 60, 0, 0.8);
    _c2.copy(mid).lerp(GRAY.setRGB(0.72, 0.75, 0.8).multiplyScalar(0.25 + 0.75 * day), 0.5);
    top.lerp(_c2, fogK * 0.7); mid.lerp(_c2, fogK);

    // lightning
    // (weather-driven only; if a firework has just burst the strike waits, so the two rarely coincide)
    if (cur.thunder > 0.5) {
      lightningT -= dt;
      if (lightningT <= 0) {
        if (t - fireworks.state.lastBurst < 1.6 && fireworks.state.strength > 0.15) lightningT = 0.9 + Math.random() * 1.2;
        else { lightningSeq = [1, 0, 0.75, 0, 0.45, 0.15]; lightningT = 3 + Math.random() * 6.5; }
      }
    }
    if (lightningSeq.length) { flash = lightningSeq[0]; lightningStep += dt; if (lightningStep > 0.055) { lightningStep = 0; lightningSeq.shift(); } } else flash += (0 - flash) * k(14, dt);
    const flashA = flash * cur.thunder;

    /* fireworks: only holidays that list them, only at night, far sky; thunder / fog / rain thin them out */
    let dom = null, domW = 0, rate = 0;
    for (const id of HOLIDAYS) {
      const fw = HC[id].sky.fireworks;
      if (!fw) continue;
      const w = cur.hol[id];
      rate += fw.rate * w;
      if (w > domW) { domW = w; dom = fw; }
    }
    if (dom) { fwCfg.rate = rate; fwCfg.scale = dom.scale; fwCfg.palette = dom.palette; fwCfg.types = dom.types; }
    else fwCfg.rate = 0;
    const fogK0 = clamp(cur.fog * 60, 0, 0.8);
    const fwGate = (state.fireworks === false ? 0 : 1) * smooth(0.5, 0.78, kf.glow) * (1 - fogK0 * 0.75) * (1 - cur.rain * 0.3) * (1 - cur.snow * 0.35) * (1 - cur.thunder * 0.65) * (1 - flashA);
    const fws = fireworks.update(t, dt, fwCfg, fwGate, 1 / (reg.pxPerUnit || 0.0017));
    const fwS = fws.strength * Math.min(1, fwGate * 2 + 0.2);

    const u = sky.u;
    u.uTop.value.copy(top); u.uMid.value.copy(mid); u.uBot.value.copy(bot);
    u.uSunDir.value.copy(sunDir);
    u.uSunCol.value.copy(kf.sunC);
    u.uSunVis.value = smooth(-0.1, 0.03, sunSin) * (1 - cur.cloud * 0.78);
    u.uMoonDir.value.copy(moonDir);
    u.uMoonVis.value = smooth(-0.04, 0.08, moonDir.y) * (1 - day) * (1 - cur.cloud * 0.85);
    u.uStars.value = kf.stars * (1 - cur.cloud * 0.9) * (1 - fogK);
    u.uCloud.value = Math.min(1, cur.cloud);
    u.uCloudLit.value.copy(mid).lerp(_c1.setRGB(1, 1, 1), 0.55 * day).multiplyScalar(0.55 + 0.6 * day);
    u.uCloudShade.value.copy(top).multiplyScalar(0.85 + 0.2 * day);
    u.uNight.value = (1 - day) * (1 - cur.cloud * 0.4) * (1 - fogK);
    // night: the sky becomes one flat colour (between its top and horizon colours) once the stars are out
    const solid = smooth(0.25, 0.8, kf.stars);
    u.uSolid.value = solid;
    u.uSolidCol.value.copy(top).lerp(mid, 0.4);
    // the 3D clouds (clouds.js) take their colours from this same sky
    CLOUD_U.uSkyTop.value.copy(top); CLOUD_U.uSkyMid.value.copy(mid); CLOUD_U.uSkyBot.value.copy(bot); CLOUD_U.uSunCol.value.copy(kf.sunC);
    CLOUD_U.uSunDir.value.copy(sunDir); CLOUD_U.uMoonDir.value.copy(moonDir);
    CLOUD_U.uSunVis.value = u.uSunVis.value; CLOUD_U.uMoonVis.value = smooth(-0.04, 0.08, moonDir.y) * (1 - day) * (1 - cur.cloud * 0.85);
    CLOUD_U.uWDay.value = day; CLOUD_U.uWDusk.value = (1 - day) * (1 - kf.stars); CLOUD_U.uWNight.value = (1 - day) * kf.stars;
    CLOUD_U.uCloud.value = Math.min(1, cur.cloud);
    u.uFlash.value = flashA;
    u.uTime.value = t;

    /* lights */
    const li = SEASONS.reduce((a, s, i) => { const L = SEASON_DATA[s].light; return [a[0] + L[0] * sw[i], a[1] + L[1] * sw[i], a[2] + L[2] * sw[i]]; }, [0, 0, 0]);
    const hs = desat(K.hs.clone(), dsat * 0.8 + 0.25 * snowCover, 1).multiply(_c1.setRGB(li[0], li[1], li[2]));
    const hg = desat(K.hg.clone(), dsat * 0.6, 1);
    hs.multiply(_c1.setRGB(...hvec((c) => c.lighting.hemi, _hv).toArray()));
    hs.lerp(fws.color, fwS * 0.28 * (1 - day));
    hemi.color.copy(hs); hemi.groundColor.copy(hg);
    hemi.intensity = K.hi * dk * (1 + 0.14 * cur.cloud * day) + 0.4 * snowCover * day + flashA * 4.2 + fwS * 0.22 * (1 - day);

    const useSun = sunSin > 0.012;
    const lp = useSun ? sunDir : moonDir;
    // the light (and its shadow box) is centred on the part of the town the camera looks at
    const SC = reg.shadowCenter || _zero;
    sun.position.copy(lp).multiplyScalar(45).add(SC);
    sun.target.position.copy(SC);
    sun.target.updateMatrixWorld();
    if (useSun) {
      sun.color.copy(kf.sunC).multiply(_c1.setRGB(li[0], li[1], li[2]));
      sun.intensity = kf.sunI * sunUp * sunMul * cur.sun;
    } else {
      sun.color.setRGB(0.575, 0.66, 0.91);
      sun.intensity = 1.5 * moonUp * (1 - cur.cloud * 0.18) * (1 - (1 - cur.dark) * 0.5);
    }
    sun.color.lerp(_c2.setRGB(0.7, 0.8, 1), flashA * 0.6);
    sun.intensity += flashA * 3.5;
    sun.shadow.intensity = clamp((useSun ? 1 - cur.cloud * 0.82 : 1 - cur.cloud * 0.5) * (useSun ? sunUp : moonUp) + 0.02, 0, 1);
    // shadow map is static, so only re-render it when the light really moved
    if ((lp.angleTo(last.dir) > 0.005 && t - last.t > 0.25) || reg.shadowDirty) { renderer.shadowMap.needsUpdate = true; last.dir.copy(lp); last.t = t; reg.shadowDirty = false; }

    // fog colour follows the horizon, density follows the weather
    const fogCol = mid.clone().multiplyScalar(0.92);
    const fogHoliday = clamp(cur.fog * 80, 0, 1); // holiday air colour matters most when the air is thick
    let fogAmt = 0;
    for (const id of HOLIDAYS) { const w = cur.hol[id]; const a = HC[id].fog.amt * w * (0.35 + 0.65 * fogHoliday); if (a > 0.002) { _c4.copy(ACC[id].fog).multiplyScalar(0.25 + 0.75 * day); fogCol.lerp(_c4, a); fogAmt += a; } }
    fogCol.lerp(u.uSolidCol.value, u.uSolid.value); // at night the haze melts into the flat sky
    scene.fog.color.copy(fogCol);
    scene.fog.far = (0.0034 * (0.6 + 0.4 * (1 - day)) + cur.fog) * (1 + fogAmt * 0.5); // = density (core.js fog chunks)
    post.outline.material.uniforms.uFog.value = scene.fog.far;
    ENVK.fog = clamp(cur.fog * 70, 0, 1);

    /* post: bloom is gentler in daylight, flashes with lightning */
    post.bloom.strength = lerp(0.5, 0.26, day) + flashA * 0.6 + hsum((c) => c.lighting.bloom) * (1 - day);
    post.bloom.threshold = lerp(1.0, 1.7, day);

    /* emissive categories (lamps, windows, signs) */
    const glowN = kf.glow;
    const f = {
      street: lerp(0.1, 1, Math.pow(glowN, 1.1)) + cur.cloud * 0.22 * day * (1 - glowN),
      iza: 0.34 + 0.66 * glowN,
      shop: lerp(0.1, 0.78 + 0.22 * glowN, cur.open),
      sign: lerp(0.28, 0.82 + 0.18 * glowN, cur.open),
      deco: (0.32 + 0.68 * glowN) * (1 + flashA * 1.3 + fwS * 0.12),
      lamp: lampsAt(hour),
    };
    Object.assign(ENVK, f, { open: cur.open, day, rain: cur.rain, drip: Math.max(cur.rain, wet * 0.28 * (1 - snowCover)), wind: cur.wind });
    reg.emis.forEach((e) => {
      const fv = f[e.cat] ?? 1;
      if (e.last === fv) return;
      e.last = fv;
      if (e.off) e.m.color.copy(e.off).multiplyScalar(1 - Math.min(1, fv)).add(_c5.copy(e.base).multiplyScalar(fv));
      else e.m.color.copy(e.base).multiplyScalar(fv);
    });
    reg.litMats.forEach((m) => {
      const uu = m.userData.litU;
      if (uu) uu.value = m.userData.litBase * (f[m.userData.litCat] ?? 1);
    });
    reg.halos.forEach((h) => {
      const fv = (f[h.cat] ?? 1);
      h.s.material.opacity = h.op * fv * (1 + ENVK.fog * 0.8);
      h.s.scale.setScalar(h.size * (1 + ENVK.fog * 1.6));
    });
    const L = reg.lights;
    const setL = (name, v) => { const l = L[name]; if (l) { l.userData.k = v; l.intensity = l.userData.base * v; } };
    setL('inA', f.shop); setL('inB', f.shop); setL('door', f.shop);
    ['lamp1', 'lamp2', 'lamp3'].forEach((n) => setL(n, f.lamp));
    ['alleyLamp', 'vend', 'sigNear'].forEach((n) => setL(n, f.street));
    ['izaSide', 'lantern', 'izaFront', 'florist', 'bakery', 'bakeryKitchen', 'bakeryCroissant', 'zakkaya', 'villa', 'cafe', 'books', 'streetShop'].forEach((n) => setL(n, f.iza));
    setL('tree', lerp(0.3, 1, glowN) * (1 + flashA * 1.4));
    accentLight('door', 'door'); accentLight('tree', 'tree');
    ['lamp1', 'lamp2', 'lamp3'].forEach((n) => accentLight(n, 'lamps'));
    if (reg.haze) reg.haze.opacity = 0.17 * (0.3 + 0.7 * glowN) * cur.open;

    /* glass */
    GLASS_U.uRain.value = clamp(cur.rain * 1.25 + wet * 0.12 * (1 - snowCover), 0, 1);
    GLASS_U.uSkyCol.value.copy(mid).multiplyScalar(1.1);
    GLASS_U.uDay.value = day * (1 - cur.cloud * 0.3);
    GLASS_U.uFrost.value = sw[3] * 0.9 + snowCover * 0.4;
    GLASS_U.uFw.value.set(fws.color.r, fws.color.g, fws.color.b, fwS * 0.9);

    /* ground */
    const G = reg.groundU;
    if (G) {
      G.uWet.value = wet;
      G.uPuddle.value = puddle;
      G.uRipple.value = cur.ripple;
      G.uSnow.value = snowCover;
      G.uDay.value = day * (1 - cur.cloud * 0.25);
      const lw = SEASONS.reduce((a, s, i) => { const l = SEASON_DATA[s].lawn; return [a[0] + l[0] * sw[i], a[1] + l[1] * sw[i], a[2] + l[2] * sw[i]]; }, [0, 0, 0]);
      G.uLawn.value.setRGB(lw[0], lw[1], lw[2]);
      // festive light pooled on wet ground (lanterns / blossom / pumpkins / tree lights) + firework colour
      const nightK = 0.35 + 0.65 * glowN;
      hvec((c) => c.ground.reflA, _hv).multiplyScalar(nightK);
      hvec((c) => c.ground.reflB, _hv2).multiplyScalar(nightK * (0.6 + 0.4 * cur.open));
      G.uTintA.value.copy(_hv); G.uTintB.value.copy(_hv2);
      G.uTintC.value.set(fws.color.r, fws.color.g, fws.color.b).multiplyScalar(fwS * 0.8);
    }
    reg.reflOn = wet * 0.8 + puddle > 0.05 && snowCover < 0.92;

    /* lake: sky colour, sun / moon glints, rain rings, cold season, lightning */
    if (reg.lakeU) {
      const L = reg.lakeU;
      L.uRain.value = cur.rain; L.uDay.value = day * (1 - cur.cloud * 0.35); L.uNight.value = 1 - day;
      L.uSkyLo.value.copy(mid).multiplyScalar(0.9 + 0.2 * day); L.uSkyHi.value.copy(top);
      L.uSunDir.value.copy(sunDir); L.uSunCol.value.copy(kf.sunC); L.uSunVis.value = smooth(-0.05, 0.1, sunSin) * (1 - cur.cloud * 0.85);
      L.uMoonDir.value.copy(moonDir); L.uMoonVis.value = moonUp * (1 - day) * (1 - cur.cloud * 0.8);
      L.uCold.value = clamp(sw[3] * 0.8 + snowCover * 0.4, 0, 1); L.uFlash.value = flashA; L.uWind.value = cur.wind; L.uCloud.value = cur.cloud;
      L.uReflK.value = reg.reflActive ? 1 : 0;
    }
    SNOW_U.value = snowCover;

    /* foliage: season weights + the holiday's own colour cast / blossom force / night glow */
    SEASON_U.W.value.set(sw[0], sw[1], sw[2], sw[3]);
    SEASON_U.drop.value = sw[2] * 0.2 + sw[3] * 0.82;
    const blossom = hsum((c) => c.foliage.blossom);
    SEASON_U.sakura.value = blossom;
    hvec((c) => c.foliage.tint, SEASON_U.tint.value);
    SEASON_U.glow.value = clamp((blossom * 1.0 + sw[0] * 0.35) * (1 - day) * (1 - cur.cloud * 0.25) + flashA * 0.9 * (blossom + sw[0] * 0.5), 0, 1.4);

    /* particles + ground litter / piles (amounts come from the holiday config + season) */
    const snowOn = clamp(cur.snow, 0, 1);
    const petalCfg = hsum((c) => c.particles.petals), petalPile = hsum((c) => c.ground.petalPiles);
    const leafPile = hsum((c) => c.ground.leafPiles), snowPile = hsum((c) => c.ground.snowPiles);
    const petal = clamp((sw[0] * 0.8 + petalCfg * 0.95) * (1 - cur.rain * 0.45) * (1 - snowOn), 0, 1);
    const leaf = clamp((sw[2] * 0.85 + leafPile * 0.5) * (1 - cur.rain * 0.4) * (1 - snowOn), 0, 1);
    const petalish = sw[0] * 0.6 + petalPile, leafish = sw[2] * 0.9 + leafPile;
    const litterAmt = clamp(Math.max(petalish * 0.7, leafish), 0, 1) * (1 - snowCover);
    const litterKind = leafish / (leafish + petalish + 1e-3);
    const calm = 1 - cur.rain * 0.8;
    const moteAmt = hsum((c) => c.particles.motes.amount) * (0.35 + 0.65 * (1 - day)) * calm * (1 - snowOn * 0.5);
    _c4.setRGB(0, 0, 0);
    let moteW = 0;
    for (const id of HOLIDAYS) { const a = HC[id].particles.motes.amount * cur.hol[id]; if (a > 0.001) { _c4.r += ACC[id].motes.r * a; _c4.g += ACC[id].motes.g * a; _c4.b += ACC[id].motes.b * a; moteW += a; } }
    if (moteW > 0.001) _c4.multiplyScalar(1 / moteW);
    const lightDirV = useSun ? sunDir : moonDir;
    const bright = lerp(0.75, 1.0, day);
    particles.apply(t, {
      rain: cur.rain, wind: cur.wind, speed: cur.spd,
      rainCol: _c1.setRGB(lerp(1.1, 0.62, day), lerp(1.3, 0.7, day), lerp(1.5, 0.84, day)),
      rainAlpha: lerp(0.42, 0.5, day),
      snow: snowOn, petal, leaf, litterAmt, litterKind,
      confetti: hsum((c) => c.particles.confetti) * calm * (1 - snowOn * 0.4),
      motes: moteAmt, motesTint: _c4,
      pilePetal: clamp(sw[0] * 0.75 + petalPile, 0, 1) * (1 - snowCover),
      pileLeaf: clamp(sw[2] * 0.9 + leafPile, 0, 1) * (1 - snowCover),
      pileSnow: Math.max(Math.sqrt(snowCover) * 0.9, // drifts outlast the thin cover when it thaws
         snowPile * (0.6 + 0.4 * snowCover) * clamp(sw[3] * 1.2 + snowCover, 0, 1)), // holiday snow drifts only in winter / when it snowed
      pileBright: lerp(0.45, 1.0, day) * (1 - 0.2 * flashA) + flashA * 0.5,
      lightDir: lightDirV,
      bright,
    });
    particles.litter.u.uBright.value = lerp(0.35, 1.0, day) * (1 - 0.2 * flashA) + flashA * 0.4;

    /* holiday props (twinkle & bulbs flare with lightning) + store status */
    holidays.apply(cur.hol, t, dt, glowN, flashA, hsum((c) => c.night.twinkle));
    const closed = 1 - cur.open;
    if (reg.shutters) reg.shutters.forEach((p) => { const sc = smooth(0.25, 0.85, closed); p.scale.y = Math.max(0.001, sc); p.visible = sc > 0.01; });
    if (reg.store) {
      const wantOpen = cur.open > 0.5;
      if (wantOpen !== doorTex) { doorTex = wantOpen; reg.store.doorSign.map = wantOpen ? reg.store.tOpen : reg.store.tClosed; reg.store.doorSign.needsUpdate = true; }
    }
    if (reg.pylonClosed) reg.pylonClosed.visible = cur.open < 0.5;

    // expose a few readings for debugging / the UI
    ctx.readout = { hour, day, wet, puddle, snowCover, sunSin, flash: flashA, open: cur.open };
  }
  let tickAcc = 0;
  let lightningStep = 0;

  snap();
  return {
    state, cur, set, reset, random, preset, update, snap,
    on: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    isOpen: () => cur.open > 0.5,
    holidays, sky, fireworks,
    reseedPiles: (seed) => particles.piles.reseed(seed),
    get readout() { return ctx.readout; },
  };
}
