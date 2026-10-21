import { WEATHERS, SEASONS, HOLIDAYS, PRESET_LIST, hourLabel, periodName } from './env.js';

const W_META = {
  sunny: ['☀️', '晴天', 'Sunny'],
  cloudy: ['⛅', '多云', 'Cloudy'],
  rainy: ['🌧️', '雨天', 'Rainy'],
  heavy: ['🌊', '暴雨', 'Heavy Rain'],
  snowy: ['❄️', '雪天', 'Snowy'],
  foggy: ['🌫️', '雾天', 'Foggy'],
  thunder: ['⛈️', '雷暴', 'Thunderstorm'],
};
const S_META = { spring: ['🌸', '春', 'Spring'], summer: ['🌿', '夏', 'Summer'], autumn: ['🍁', '秋', 'Autumn'], winter: ['⛄', '冬', 'Winter'] };
const H_META = {
  none: ['—', '无', 'None'],
  christmas: ['🎄', '圣诞节', 'Christmas'],
  halloween: ['🎃', '万圣节', 'Halloween'],
  newyear: ['🎍', '新年', 'New Year'],
  sakura: ['🌸', '樱花季', 'Sakura Festival'],
  summer: ['🎆', '夏日祭', 'Summer Festival'],
};
const T_CHIPS = [[5, '黎明'], [9, '早晨'], [12, '正午'], [17, '黄昏'], [19, '傍晚'], [23, '深夜']];

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export function createUI(env, hooks = {}) {
  const st = env.state;
  const root = el('div', 'ce-root');
  const toggle = el('button', 'ce-toggle', '<span class="ce-toggle-ic">⚙︎</span><span class="ce-toggle-tx">环境</span>');
  toggle.setAttribute('aria-label', '打开 / 收起环境控制面板');
  const panel = el('aside', 'ce-panel');
  panel.setAttribute('aria-label', 'Environment controls');
  root.append(toggle, panel);
  // camera shortcuts: back to the shop, or the whole town
  const cam = el('div', 'ce-cam');
  const bHome = el('button', '', '⌂ 回到 LAWSON');
  const bTown = el('button', '', '◎ 全镇视图');
  const bFlor = el('button', '', '✿ しずく花店');
  const bBak = el('button', '', '◒ ひよりベーカリー');
  bHome.setAttribute('aria-label', '镜头回到 LAWSON 便利店');
  bTown.setAttribute('aria-label', '查看整个小镇');
  bFlor.setAttribute('aria-label', '镜头去花店门口，再按一次进入店内');
  bFlor.title = '去花店门口 · 再按一次进入店内';
  bBak.setAttribute('aria-label', '镜头去面包店门口，再按一次进入店内');
  bBak.title = '去面包店门口 · 再按一次进入店内';
  bHome.addEventListener('click', () => hooks.home && hooks.home());
  bTown.addEventListener('click', () => hooks.town && hooks.town());
  bFlor.addEventListener('click', () => hooks.florist && hooks.florist());
  bBak.addEventListener('click', () => hooks.bakery && hooks.bakery());
  cam.append(bHome, bTown, bFlor, bBak);
  root.append(cam);

  const head = el('div', 'ce-head');
  head.innerHTML = '<div><div class="ce-title">Environment</div><div class="ce-sub">環境コントロール · 同一家便利店，任意组合</div></div>';
  const close = el('button', 'ce-x', '✕');
  close.setAttribute('aria-label', 'close');
  head.append(close);
  panel.append(head);
  const body = el('div', 'ce-body');
  panel.append(body);

  const section = (title, sub) => {
    const s = el('section', 'ce-sec');
    s.append(el('h3', 'ce-h', `${title}<span>${sub || ''}</span>`));
    body.append(s);
    return s;
  };
  const groups = {};
  const grid = (sec, list, meta, key, cols) => {
    const g = el('div', `ce-grid c${cols}`);
    groups[key] = [];
    list.forEach((id) => {
      const [ic, zh, en] = meta[id];
      const b = el('button', 'ce-btn', `<span class="ic">${ic}</span><span class="zh">${zh}</span>`);
      b.title = en;
      b.dataset.id = id;
      b.addEventListener('click', () => env.set({ [key]: id }));
      g.append(b);
      groups[key].push(b);
    });
    sec.append(g);
  };

  /* presets */
  {
    const s = section('Quick scenes', '快捷场景');
    const row = el('div', 'ce-chips');
    PRESET_LIST.forEach(([id, zh, en]) => {
      const b = el('button', 'ce-chip', zh);
      b.title = en;
      b.addEventListener('click', () => env.preset(id));
      row.append(b);
    });
    s.append(row);
  }
  grid(section('Weather', '天气'), WEATHERS, W_META, 'weather', 4);
  grid(section('Season', '季节'), SEASONS, S_META, 'season', 4);

  /* time */
  const timeSec = section('Time', '时间');
  const tRead = el('div', 'ce-time');
  const tVal = el('span', 'ce-time-v');
  const tPer = el('span', 'ce-time-p');
  tRead.append(tVal, tPer);
  const slider = el('input', 'ce-range');
  slider.type = 'range'; slider.min = 0; slider.max = 24; slider.step = 0.05; slider.value = st.time;
  slider.setAttribute('aria-label', 'time of day');
  slider.addEventListener('input', () => env.set({ time: parseFloat(slider.value), autoTime: false }));
  const ticks = el('div', 'ce-ticks', '<i>0</i><i>6</i><i>12</i><i>18</i><i>24</i>');
  const tchips = el('div', 'ce-chips small');
  T_CHIPS.forEach(([h, zh]) => {
    const b = el('button', 'ce-chip', `${String(h).padStart(2, '0')}:00 ${zh}`);
    b.addEventListener('click', () => env.set({ time: h, autoTime: false }));
    tchips.append(b);
  });
  const autoRow = el('div', 'ce-row');
  const autoBtn = el('button', 'ce-pill', '▶ 自动推进');
  autoBtn.title = 'Auto Time';
  autoBtn.addEventListener('click', () => env.set({ autoTime: !st.autoTime }));
  const spd = el('select', 'ce-select');
  [['0.08', '慢 Slow'], ['0.25', '中 Normal'], ['0.8', '快 Fast'], ['real', '实时 Real-time']].forEach(([v, l]) => { const o = el('option', '', l); o.value = v; spd.append(o); });
  spd.value = '0.25';
  spd.addEventListener('change', () => {
    if (spd.value === 'real') env.set({ realClock: true, autoTime: true });
    else env.set({ realClock: false, autoSpeed: parseFloat(spd.value) });
  });
  autoRow.append(autoBtn, spd);
  timeSec.append(tRead, slider, ticks, tchips, autoRow);

  const hSec = section('Holiday', '节假日');
  grid(hSec, HOLIDAYS, H_META, 'holiday', 3);
  const fwSw = el('label', 'ce-switch', '<input type="checkbox" checked><i></i><span>允许烟花 Fireworks（新年 / 夏日祭 / 樱花季夜晚）</span>');
  const fwInput = fwSw.querySelector('input');
  fwInput.addEventListener('change', () => env.set({ fireworks: fwInput.checked }));
  const bPiles = el('button', 'ce-act', '🍂 重新生成地面堆积（雪 / 落叶 / 花瓣）');
  bPiles.style.width = '100%'; bPiles.style.marginTop = '8px';
  bPiles.addEventListener('click', () => env.reseedPiles());
  hSec.append(fwSw, bPiles);

  /* store */
  const storeSec = section('Store status', '营业状态');
  const seg = el('div', 'ce-seg');
  const bOpen = el('button', '', '<b>OPEN</b> 营业中');
  const bClosed = el('button', '', '<b>CLOSED</b> 已打烊');
  bOpen.addEventListener('click', () => env.set({ storeStatus: 'open', storeMode: 'manual' }));
  bClosed.addEventListener('click', () => env.set({ storeStatus: 'closed', storeMode: 'manual' }));
  seg.append(bOpen, bClosed);
  const autoStore = el('label', 'ce-switch', '<input type="checkbox"><i></i><span>按营业时间自动 Auto</span>');
  const asInput = autoStore.querySelector('input');
  asInput.addEventListener('change', () => env.set({ storeMode: asInput.checked ? 'auto' : 'manual' }));
  const hours = el('div', 'ce-hours');
  const mkSel = (label, key, vals) => {
    const w = el('label', 'ce-hsel', `<span>${label}</span>`);
    const s = el('select', 'ce-select');
    vals.forEach((v) => { const o = el('option', '', v === 24 ? '24:00' : `${String(v).padStart(2, '0')}:00`); o.value = v; s.append(o); });
    s.addEventListener('change', () => env.set({ [key]: parseInt(s.value, 10), alwaysOpen: false }));
    w.append(s);
    return [w, s];
  };
  const [wFrom, sFrom] = mkSel('开店', 'openFrom', Array.from({ length: 24 }, (_, i) => i));
  const [wTo, sTo] = mkSel('打烊', 'openTo', Array.from({ length: 24 }, (_, i) => i + 1));
  sFrom.value = st.openFrom; sTo.value = st.openTo;
  const always = el('label', 'ce-switch', '<input type="checkbox" checked><i></i><span>24 小时营业（默认）</span>');
  const alInput = always.querySelector('input');
  alInput.addEventListener('change', () => env.set({ alwaysOpen: alInput.checked }));
  hours.append(wFrom, wTo);
  const note = el('div', 'ce-note', '');
  storeSec.append(seg, autoStore, always, hours, note);

  /* quality + actions */
  const qSec = section('Quality', '画质 / 特效密度');
  const qRow = el('div', 'ce-seg small');
  const qBtns = {};
  [['auto', '自动'], ['high', '高'], ['med', '中'], ['low', '低']].forEach(([id, l]) => {
    const b = el('button', '', l);
    b.addEventListener('click', () => { env.set({ quality: id }); hooks.setQuality && hooks.setQuality(id); });
    qRow.append(b);
    qBtns[id] = b;
  });
  qSec.append(qRow);

  const actions = el('div', 'ce-actions');
  const bReset = el('button', 'ce-act', '↺ 重置 Reset');
  const bRand = el('button', 'ce-act accent', '🎲 随机 Random');
  bReset.addEventListener('click', () => { env.reset(); hooks.reset && hooks.reset(); });
  bRand.addEventListener('click', () => env.random());
  actions.append(bReset, bRand);
  panel.append(actions);
  panel.append(el('div', 'ce-foot', '拖动旋转 · 滚轮缩放 · 右键平移 · 按 H 隐藏面板'));

  /* ---------------------------------------------------------------- sync UI <- state */
  function sync(_, what) {
    ['weather', 'season', 'holiday'].forEach((k) => groups[k].forEach((b) => b.classList.toggle('on', b.dataset.id === st[k])));
    tVal.textContent = hourLabel(st.time);
    tPer.textContent = periodName(st.time);
    if (!what || what.includes('time') || !slider.matches(':active')) slider.value = st.time;
    autoBtn.classList.toggle('on', st.autoTime);
    autoBtn.innerHTML = st.autoTime ? '⏸ 暂停' : '▶ 自动推进';
    const open = env.isOpen();
    const eff = st.storeMode === 'auto' ? 'auto' : 'manual';
    bOpen.classList.toggle('on', st.storeMode === 'manual' ? st.storeStatus === 'open' : open);
    bClosed.classList.toggle('on', st.storeMode === 'manual' ? st.storeStatus === 'closed' : !open);
    asInput.checked = eff === 'auto';
    fwInput.checked = st.fireworks !== false;
    always.style.display = eff === 'auto' ? '' : 'none';
    hours.style.display = eff === 'auto' && !st.alwaysOpen ? '' : 'none';
    alInput.checked = st.alwaysOpen;
    seg.classList.toggle('dim', eff === 'auto');
    note.textContent = eff === 'auto' ? (st.alwaysOpen ? '自动模式：24 小时营业，始终 OPEN。' : `自动模式：${String(st.openFrom).padStart(2, '0')}:00 – ${st.openTo === 24 ? '24' : String(st.openTo).padStart(2, '0')}:00 营业，当前${open ? ' OPEN' : ' CLOSED'}。`) : '手动：夜晚不会自动打烊，营业状态由你决定。';
    Object.entries(qBtns).forEach(([id, b]) => b.classList.toggle('on', id === st.quality));
  }
  env.on(sync);
  sync();

  /* ---------------------------------------------------------------- open / close */
  const wide = window.matchMedia('(min-width: 900px)').matches;
  let open = wide;
  const apply = () => { root.classList.toggle('open', open); };
  toggle.addEventListener('click', () => { open = !open; apply(); });
  close.addEventListener('click', () => { open = false; apply(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; root.classList.toggle('hidden'); }
  });
  apply();
  document.body.append(root);
  return { root, sync, setQuality: (q) => { st.quality = q; sync(); } };
}
