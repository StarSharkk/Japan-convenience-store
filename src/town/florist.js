import * as THREE from 'three';
import { reg, toon, glow, bx, cy, cyl2, sph, pl, grp, canvasTex, halo, plight, rng, roundRect, noSnowBox } from '../core.js';
import { makeGlass } from '../fx.js';
import { swingDoors, doorHit } from '../doors.js';
import { T } from '../tex.js';
import { bicycle } from '../street.js';
import { makeTree, makeShrub } from '../tree.js';
import { groundY, PAV } from './layout.js';
import { bladeGeo, taperTube, placeLeaf, tint, mergeInto, leafTex, leafMat, stemMat } from '../plants/kit.js';
import { makePot, makeRhapisPot, makeFicusPot } from '../plants/pottedPlants.js';
import { makeTaro, makeFern, makeHosta, makeAspidistra } from '../plants/groundPlants.js';
import { rockBatch, rockMat, scatterRocks } from '../rocks.js';
import { sharedPlants, plantAt, potPlants } from '../plants/wild.js';

/* ====================================================================================================
   しずく花店 + the florist's house - the street corner across Hoshizora-dori from the LAWSON
   (east block, x 12..30, z -7..6.5; Kaigan-dori in front, Hoshizora-dori to the west).

   The greenhouse is the corner's main building, centred on the block with the house set off to the right:

     x 12 ─ 14.6 │ 14.6 ───────────── 21.8 │ 21.9 ── 24.5 │ 24.6 ────── 29.3 │ 30
     corner walk │ greenhouse 7.2 x 9.4 m   │ green strip   │ house 4.7 x 5.2  │ lane
                 │ (entrance gable south)   │ trees, board  │ + front yard     │
     z 2.6 ─ 4.0   shop forecourt (displays, steps, bench, post box)
     z 4.0 ─ 6.5   sidewalk (pavers, poles at the strip and the corner; tactile + fences: town/roadside.js)

   greenhouse  white frame on a cream-brick base; entrance gable on the street: pale green double glass
               doors (they swing open when the camera comes close, or on a click), fan window, wooden
               sign under two lamps, glass canopy, a projecting 花 sign. The back gable is a solid plaster
               wall (work-room door, clock, pegboard). Inside, after the reference video: terracotta tiles,
               a tiered staging in the middle, a fiddle-leaf fig, a kentia palm, a monstera, an iron plant
               stand, a two-tier bench of flower buckets along the right wall, a wrapping table on the
               left, the till at the back left, workbench + pegboard, cabinet, flower fridge, seed rack,
               soil bags, hanging baskets, two pendant lamps. All roof / wall glass is ONE mesh.
   house       two storeys, gable roof along the street (built from two thick slabs over a gable prism,
               so slopes, eaves and gable walls line up), a recessed genkan, lattice window, balcony,
               a block-wall front yard.
   Glass roof and house roof register petal / leaf / snow surfaces (reg.extraRoofs -> roofPiles.js).
   ==================================================================================================== */

/* ---------------------------------------------------------------- textures */
const tex = {};
function woodTex() {
  return (tex.wood ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c99c6a'; g.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${R() < 0.5 ? '120,80,45' : '235,200,160'},${0.05 + R() * 0.06})`; g.fillRect(0, y, w, 1 + R() * 2); }
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(110,70,40,0.18)'; g.lineWidth = 1; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 10 - 5, w * 0.7, y + R() * 10 - 5, w, y + R() * 6 - 3); g.stroke(); }
  }, { repeat: true }));
}
function brickTex() {
  return (tex.brick ||= canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e7dccb'; g.fillRect(0, 0, w, h);
    const R = rng(8);
    const bh = 16, bw = 48;
    for (let r = 0; r < h / bh; r++) for (let x = -((r % 2) * bw) / 2; x < w; x += bw) {
      const c = ['#d9b79a', '#cfa88a', '#e0c2a6', '#d4ad8e', '#c99d80'][(R() * 5) | 0];
      g.fillStyle = c; g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, r * bh + 2, bw - 4, 2);
    }
  }, { repeat: true }));
}
function floorTex() {
  return (tex.floor ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a7735a'; g.fillRect(0, 0, w, h);
    const R = rng(12);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = ['#c48a66', '#bb7f5d', '#c99472', '#b3785a'][(R() * 4) | 0];
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      g.fillStyle = 'rgba(255,240,220,0.1)'; g.fillRect(x * 64 + 4, y * 64 + 4, 56, 3);
    }
  }, { repeat: true }));
}
function plasterTex() {
  return (tex.plaster ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe5d2'; g.fillRect(0, 0, w, h);
    const R = rng(3);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '150,130,100'},${0.03 + R() * 0.04})`; g.fillRect(R() * w, R() * h, 10 + R() * 30, 2 + R() * 4); }
  }, { repeat: true }));
}
function roofTileTex() {
  return (tex.roof ||= canvasTex(64, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#4a5058'); gr.addColorStop(0.5, '#6b727b'); gr.addColorStop(1, '#474c55');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, h - 12, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = sh; g.fillRect(0, h - 12, w, 12);
    g.fillStyle = '#7d848d'; g.fillRect(0, 0, w, 3);
  }, { repeat: true }));
}
function signTex() {
  return (tex.sign ||= canvasTex(640, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a77446'); gr.addColorStop(1, '#8a5d36');
    g.fillStyle = gr; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
    const R = rng(4);
    for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(70,40,20,0.2)'; g.lineWidth = 1.2; g.beginPath(); const y = 12 + R() * (h - 24); g.moveTo(14, y); g.bezierCurveTo(w * 0.3, y + R() * 6 - 3, w * 0.7, y + R() * 6 - 3, w - 14, y); g.stroke(); }
    g.strokeStyle = '#5c3a1f'; g.lineWidth = 5; roundRect(g, 10, 10, w - 20, h - 20, 14); g.stroke();
    // water-drop mark
    g.fillStyle = '#eaf3f6'; g.beginPath(); g.arc(92, h / 2 + 12, 30, 0, Math.PI); g.lineTo(92, h / 2 - 40); g.closePath(); g.fill();
    g.fillStyle = '#7fb4c8'; g.beginPath(); g.arc(92, h / 2 + 12, 20, 0, Math.PI); g.lineTo(92, h / 2 - 24); g.closePath(); g.fill();
    T(g, 'しずく花店', w / 2 + 50, h / 2 + 4, 76, '#fbf3e4', { weight: 800 });
  }));
}
function transomTex() {
  // gilt lettering on the transom glass above the doors
  return (tex.transom ||= canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    T(g, 'FLOWERS  ·  GREEN  ·  GIFTS', w / 2, h / 2 + 2, 30, '#e9cf8a', { weight: 700 });
    g.strokeStyle = 'rgba(233,207,138,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, h - 8); g.lineTo(w - 40, h - 8); g.stroke();
  }));
}
function chalkTex() {
  return (tex.chalk ||= canvasTex(256, 380, (g, w, h) => {
    g.fillStyle = '#26332c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f3eedf'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 34px "Hiragino Sans","Noto Sans JP",sans-serif'; g.fillText('本日の花', w / 2, 50);
    const items = [['ひまわり', '#ffd34d'], ['あじさい', '#9bb6ff'], ['ガーベラ', '#ff8fa8'], ['ラベンダー', '#c6a6ff']];
    items.forEach(([t, c], i) => { g.fillStyle = c; g.beginPath(); g.arc(46, 118 + i * 56, 12, 0, 7); g.fill(); g.fillStyle = '#f3eedf'; g.font = '600 28px "Hiragino Sans",sans-serif'; g.textAlign = 'left'; g.fillText(t, 70, 120 + i * 56); });
    g.strokeStyle = 'rgba(243,238,223,0.5)'; g.lineWidth = 2; g.strokeRect(14, 14, w - 28, h - 28);
  }));
}
function boardTex() {
  return (tex.board ||= canvasTex(320, 220, (g, w, h) => {
    g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, w, h);
    [[12, 14, 92, 120], [116, 20, 86, 104], [212, 12, 96, 128], [30, 144, 120, 64], [170, 150, 132, 58]].forEach(([x, y, ww, hh], i) => {
      g.fillStyle = ['#fff7e8', '#ffe3e3', '#e8f4ff', '#fffbe0', '#eaf7e4'][i]; g.fillRect(x, y, ww, hh);
      g.fillStyle = ['#c0392b', '#2e6da4', '#3f8f4f', '#b07a1d', '#7a4bb0'][i]; g.fillRect(x + 6, y + 8, ww - 12, 10);
      g.fillStyle = 'rgba(40,40,40,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(x + 6, y + 26 + k * 12, ww - 18 - (k % 2) * 14, 4);
    });
  }));
}
function boardHeadTex() {
  return (tex.boardHead ||= canvasTex(320, 48, (g, w, h) => {
    g.fillStyle = '#2f5a45'; g.fillRect(0, 0, w, h);
    T(g, '星空町 掲示板', w / 2, h / 2 + 2, 26, '#f1ead8', { weight: 800 });
  }));
}
function blockWallTex() {
  return (tex.block ||= canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d8d1c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,82,70,0.45)'; g.lineWidth = 3;
    for (let r = 0; r < 2; r++) { g.beginPath(); g.moveTo(0, r * 64 + 1); g.lineTo(w, r * 64 + 1); g.stroke(); for (let i = 0; i <= 2; i++) { const x = i * 128 + (r ? 64 : 0); g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); } }
    const R = rng(31);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '60,50,40'},0.05)`; g.fillRect(R() * w, R() * h, 3 + R() * 10, 2 + R() * 4); }
  }, { repeat: true }));
}
function sidingTex() {
  // dark-stained vertical board siding for the house's ground floor front
  return (tex.siding ||= canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b4232'; g.fillRect(0, 0, w, h);
    const R = rng(17);
    for (let x = 0; x < w; x += 32) { g.fillStyle = `rgba(${R() < 0.5 ? '255,220,180' : '20,10,4'},${0.05 + R() * 0.06})`; g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(20,10,5,0.55)'; g.fillRect(x, 0, 2, h); }
  }, { repeat: true }));
}
function welcomeTex() {
  return (tex.welcome ||= canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#f6efe0'; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
    g.strokeStyle = '#3f6a52'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 14); g.stroke();
    T(g, 'WELCOME', w / 2, 72, 40, '#3f6a52', { weight: 800 });
    T(g, 'ようこそ', w / 2, 126, 34, '#7a5a3a', { weight: 700 });
    ['#ff8fa8', '#ffd34d', '#9bb6ff'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2 - 40 + i * 40, 166, 10, 0, 7); g.fill(); });
  }));
}
function nameplateTex() {
  return (tex.nameplate ||= canvasTex(96, 200, (g, w, h) => {
    g.fillStyle = '#e9e2d2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b5a44'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    ['雫', '石'].forEach((c, i) => T(g, c, w / 2, 62 + i * 76, 60, '#2a2420', { weight: 800 }));
  }));
}
function pegTex() {
  // pegboard with tools hung on it (scissors, pruners, trowel, twine, wire)
  return (tex.peg ||= canvasTex(360, 200, (g, w, h) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,70,50,0.35)';
    for (let y = 10; y < h; y += 14) for (let x = 10; x < w; x += 14) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
    const tool = (x, y, c, kind) => {
      g.save(); g.translate(x, y);
      if (kind === 'scissors') {
        g.strokeStyle = c; g.lineWidth = 5; [-7, 7].forEach((d) => { g.beginPath(); g.arc(d, 0, 7, 0, 7); g.stroke(); });
        g.strokeStyle = '#8a8f96'; g.lineWidth = 4; g.beginPath(); g.moveTo(-4, 6); g.lineTo(4, 62); g.moveTo(4, 6); g.lineTo(-4, 62); g.stroke();
      } else if (kind === 'pruner') {
        g.strokeStyle = c; g.lineWidth = 7; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-3, 44); g.moveTo(8, 0); g.lineTo(3, 44); g.stroke();
        g.fillStyle = '#9aa0a6'; g.beginPath(); g.moveTo(-4, 44); g.lineTo(4, 44); g.lineTo(0, 70); g.closePath(); g.fill();
      } else if (kind === 'trowel') {
        g.fillStyle = c; g.fillRect(-4, 0, 8, 34);
        g.fillStyle = '#a9afb5'; g.beginPath(); g.moveTo(-12, 36); g.lineTo(12, 36); g.lineTo(0, 76); g.closePath(); g.fill();
      } else if (kind === 'twine') {
        g.fillStyle = c; g.beginPath(); g.arc(0, 20, 16, 0, 7); g.fill(); g.strokeStyle = 'rgba(80,50,20,0.5)'; g.lineWidth = 1.5; for (let k = -12; k <= 12; k += 4) { g.beginPath(); g.moveTo(k, 6); g.lineTo(k, 34); g.stroke(); }
      } else if (kind === 'fork') {
        g.fillStyle = c; g.fillRect(-4, 0, 8, 34); g.fillStyle = '#a9afb5'; for (let k = -9; k <= 9; k += 6) g.fillRect(k - 1.5, 36, 3, 34);
      }
      g.restore();
    };
    tool(30, 24, '#d9483f', 'scissors'); tool(72, 20, '#2f6db3', 'pruner'); tool(110, 18, '#7a5a3c', 'trowel'); tool(150, 18, '#e0b45a', 'twine');
    tool(196, 20, '#e07a2f', 'scissors'); tool(236, 18, '#5b8a4a', 'fork'); tool(276, 18, '#d9483f', 'pruner'); tool(318, 20, '#c9a77a', 'twine');
    tool(54, 116, '#7a5a3c', 'trowel'); tool(98, 118, '#5b8a4a', 'scissors'); tool(140, 120, '#9bb6d8', 'twine');
    g.strokeStyle = '#7a5a3c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  }));
}
function clockTex() {
  return (tex.clock ||= canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#4a4440'; g.lineWidth = 5; g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineWidth = i % 3 ? 2 : 4; g.beginPath(); g.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); g.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 22, 64 - 18); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 6, 64 - 42); g.stroke();
  }));
}
function pictureTex() {
  return (tex.picture ||= canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#6b5236'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.fillRect(12, 12, w - 24, h - 24);
    g.strokeStyle = '#5f8a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 140); g.quadraticCurveTo(60, 100, 64, 70); g.stroke();
    g.fillStyle = '#6f8fd6'; for (let i = 0; i < 9; i++) { const a = i * 0.7; g.beginPath(); g.arc(64 + Math.cos(a) * 14, 58 + Math.sin(a) * 12, 9, 0, 7); g.fill(); }
    g.fillStyle = '#7fa65e'; g.beginPath(); g.ellipse(50, 110, 12, 5, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(78, 100, 12, 5, 0.5, 0, 7); g.fill();
  }));
}
function seedTex() {
  // seed-packet rack "たねの店": rows of little illustrated packets
  return (tex.seed ||= canvasTex(200, 300, (g, w, h) => {
    g.fillStyle = '#c99c6a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f5a45'; g.fillRect(0, 0, w, 40);
    T(g, 'たねの店', w / 2, 21, 24, '#f6efe0', { weight: 800 });
    const R = rng(77);
    const cols = ['#f2c14e', '#e86a7a', '#7fb4e0', '#9ccf7a', '#c79be0', '#f29b54', '#f4f0e6'];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
      const x = 10 + c * 46, y = 50 + r * 41;
      g.fillStyle = '#f8f3e8'; g.fillRect(x, y, 40, 36);
      g.fillStyle = cols[(R() * cols.length) | 0]; g.beginPath(); g.arc(x + 20, y + 15, 9, 0, 7); g.fill();
      g.fillStyle = '#5f8a4a'; g.fillRect(x + 19, y + 22, 2, 8);
      g.fillStyle = 'rgba(60,40,20,0.5)'; g.fillRect(x + 6, y + 31, 28, 2);
    }
  }));
}
function soilTex() {
  return (tex.soil ||= canvasTex(160, 220, (g, w, h) => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f6a3c'; g.fillRect(0, 70, w, 90);
    T(g, '腐葉土', w / 2, 116, 40, '#f6efe0', { weight: 900 });
    T(g, 'やわらか熟成', w / 2, 40, 18, '#2f6a3c', { weight: 700 });
    T(g, '14L', w / 2, 190, 22, '#5a4a3a', { weight: 800 });
  }));
}
function doorSignTex() {
  return (tex.doorSign ||= canvasTex(128, 48, (g, w, h) => {
    g.fillStyle = '#f2ead8'; roundRect(g, 2, 2, w - 4, h - 4, 6); g.fill();
    g.strokeStyle = '#6b4f32'; g.lineWidth = 3; roundRect(g, 4, 4, w - 8, h - 8, 5); g.stroke();
    T(g, '作業室', w / 2, h / 2 + 2, 24, '#3a2c20', { weight: 800 });
  }));
}
function crateTex() {
  return (tex.crate ||= canvasTex(160, 64, (g, w, h) => {
    g.fillStyle = '#c99c6a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,30,0.5)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
    T(g, 'あさひ農園', w / 2, h / 2 + 2, 22, '#7a3a24', { weight: 800 });
  }));
}
function openTex() {
  return (tex.open ||= canvasTex(160, 72, (g, w, h) => {
    g.fillStyle = '#f6efe0'; roundRect(g, 3, 3, w - 6, h - 6, 12); g.fill();
    g.strokeStyle = '#3f6a52'; g.lineWidth = 4; roundRect(g, 7, 7, w - 14, h - 14, 9); g.stroke();
    T(g, 'OPEN', w / 2, 30, 26, '#3f6a52', { weight: 900 });
    T(g, '営業中', w / 2, 54, 18, '#7a5a3a', { weight: 700 });
  }));
}

/* ---------------------------------------------------------------- materials (shared; batched by mergeStatic) */
const M = {};
function mats() {
  if (M.frame) return M;
  M.frame = toon('#eef0ea');
  M.frameD = toon('#d9ddd6');
  M.wood = toon('#ffffff', { map: woodTex(), lit: 0.25, nocache: true });
  M.woodD = toon('#8a5d3a', { lit: 0.2 });
  M.brick = toon('#ffffff', { map: brickTex(), nocache: true });
  M.floor = toon('#ffffff', { map: floorTex(), lit: 0.35, nocache: true });
  M.plaster = toon('#ffffff', { map: plasterTex(), nocache: true });
  M.plasterIn = toon('#f3eadb', { lit: 0.3 });
  M.door = toon('#a9c2b4');
  M.green = toon('#3f6a52');
  M.iron = toon('#3a3f46');
  M.zinc = toon('#b9c0c6');
  M.clay = toon('#b8653f');
  M.clayL = toon('#cf8a5e');
  M.white = toon('#f4f1ea');
  M.red = toon('#c8302a');
  M.kraft = toon('#c9a77a');
  M.brass = toon('#c9a24a');
  return M;
}

/* ---------------------------------------------------------------- plants & flowers */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const upOf = (d) => UP.clone().addScaledVector(d, -UP.dot(d)).normalize();
/** collects leaf / stem geometry for the whole shop, merged per material at the end */
function makeBins(root) {
  const bins = new Map(), rel = new THREE.Matrix4();
  return {
    // geometry built in a sub-group's frame (a shelf, a cart) is moved into the root's frame before merging
    add(parent, mat, geo) {
      if (parent && parent !== root) {
        root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false);
        geo.applyMatrix4(rel.copy(root.matrixWorld).invert().multiply(parent.matrixWorld));
      }
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(geo);
    },
    flush() { bins.forEach((list, mat) => root.add(mergeInto(list, mat, { cast: false }))); },
  };
}
const TEX = {};
function texes() {
  if (TEX.mon) return TEX;
  TEX.mon = leafTex('monstera', { kind: 'net', base: '#2f6b3c', edge: '#245731', vein: '#5f9a63', center: '#3a7a46', veins: 7, glossy: 1 });
  TEX.pothos = leafTex('pothos', { kind: 'net', base: '#6aa04a', edge: '#4f8a3a', vein: '#d9e8a8', center: '#86b85c', veins: 4 });
  TEX.small = leafTex('succ', { kind: 'plain', base: '#7fae6a', edge: '#5f8f52', vein: '#a8cf92', center: '#8cbc74' });
  TEX.palm = leafTex('kentia', { kind: 'plain', base: '#4f8a3c', edge: '#3d7231', vein: '#86b56a', center: '#5c9846' });
  TEX.snake = leafTex('snake', { kind: 'plain', base: '#3d6a3a', edge: '#d2c868', vein: '#2b4d2a', center: '#577f4b' });
  TEX.fig = leafTex('fiddleFig', { kind: 'net', base: '#3c6f3a', edge: '#2f5b2f', vein: '#78a56c', center: '#4a7f45', veins: 6, glossy: 1 });
  TEX.lily = leafTex('lily', { kind: 'net', base: '#2e5f35', edge: '#244d2b', vein: '#5c8f5c', center: '#3a7042', veins: 6, glossy: 1 });
  return TEX;
}
/** a monstera in a pot: big split leaves (deep notches in the outline) on long petioles */
function monstera(parent, bins, x, y, z, s, seed) {
  const R = rng(seed);
  const pot = makePot({ r: 0.2 * s, h: 0.36 * s, seed });
  pot.group.position.set(x, y, z); parent.add(pot.group);
  const base = V(x, y + pot.soilY - 0.03, z);
  const n = 6 + ((R() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R() * 0.5, h = V(Math.cos(a), 0, Math.sin(a));
    const Lp = (0.55 + R() * 0.45) * s, reach = (0.25 + R() * 0.25) * s;
    const top = base.clone().addScaledVector(h, reach).add(V(0, Lp, 0));
    const c = new THREE.CatmullRomCurve3([base.clone().addScaledVector(h, 0.03), base.clone().addScaledVector(h, reach * 0.3).add(V(0, Lp * 0.65, 0)), top]);
    bins.add(parent, stemMat('#5c8a48'), tint(taperTube(c, 0.014 * s, 0.009 * s, 8, 5), 1));
    const L = (0.36 + R() * 0.16) * s, beta = 0.35 + R() * 0.35;
    const dir = h.clone().multiplyScalar(Math.cos(beta)).addScaledVector(UP, -Math.sin(beta)).normalize();
    const geo = bladeGeo({ L, W: L * 0.92, segL: 12, segW: 6, lobe: 0.22, sinus: 0.06,
      width: (v) => Math.pow(1 - Math.pow(v, 1.6), 0.7) * (v > 0.12 && v < 0.85 ? 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(v * Math.PI * 4.5)), 0.4) : 1),
      droop: 0.2, cup: 0.04, keel: 0.03 });
    bins.add(parent, leafMat(texes().mon), placeLeaf(geo, top, dir, upOf(dir), 0.85 + R() * 0.25));
  }
}
/** a kentia palm: a few canes, arching pinnate fronds of narrow leaflets */
function palm(parent, bins, x, y, z, s, seed) {
  const R = rng(seed);
  const pot = makePot({ r: 0.25 * s, h: 0.44 * s, seed });
  pot.group.position.set(x, y, z); parent.add(pot.group);
  const base = V(x, y + pot.soilY - 0.02, z);
  const nF = 9;
  for (let i = 0; i < nF; i++) {
    const a = i * 2.4 + R() * 0.4, h = V(Math.cos(a), 0, Math.sin(a));
    const cane = base.clone().addScaledVector(h, 0.04 * s).add(V(0, (0.35 + R() * 0.55) * s, 0));
    bins.add(parent, stemMat('#6f8a4a'), tint(taperTube(new THREE.CatmullRomCurve3([base.clone().addScaledVector(h, 0.02), cane]), 0.016 * s, 0.012 * s, 4, 5), 1));
    const len = (0.95 + R() * 0.45) * s, up = 0.45 + R() * 0.35;
    const c = new THREE.CatmullRomCurve3([cane, cane.clone().addScaledVector(h, len * 0.35).add(V(0, len * up, 0)), cane.clone().addScaledVector(h, len * 0.78).add(V(0, len * up * 0.75, 0)), cane.clone().addScaledVector(h, len).add(V(0, len * (up * 0.3 - 0.2), 0))]);
    bins.add(parent, stemMat('#6f8a4a'), tint(taperTube(c, 0.009 * s, 0.004 * s, 10, 4), 1));
    for (let t = 0.1; t < 0.98; t += 0.05) {
      const p = c.getPointAt(t), tg = c.getTangentAt(t), side = new THREE.Vector3().crossVectors(tg, UP).normalize();
      const l = 0.26 * s * (0.35 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.75);
      [1, -1].forEach((sg) => {
        const dir = side.clone().multiplyScalar(sg * 0.75).addScaledVector(tg, 0.55).addScaledVector(UP, -0.25).normalize();
        bins.add(parent, leafMat(texes().palm), placeLeaf(bladeGeo({ L: l, W: l * 0.13, segL: 4, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * v)), 0.8), droop: 0.3, cup: 0.12 }), p, dir, upOf(dir), 0.85 + R() * 0.3));
      });
    }
  }
}
/** a fiddle-leaf fig: a tall stem with two side shoots, big violin-shaped leaves held out and up */
function fiddleFig(parent, bins, x, y, z, s, seed) {
  const R = rng(seed);
  const pot = makePot({ r: 0.22 * s, h: 0.38 * s, seed });
  pot.group.position.set(x, y, z); parent.add(pot.group);
  const base = V(x, y + pot.soilY - 0.02, z), H = 1.55 * s;
  const trunk = new THREE.CatmullRomCurve3([base, base.clone().add(V(0.04 * s, H * 0.5, -0.02 * s)), base.clone().add(V(0.02 * s, H, 0.03 * s))]);
  bins.add(parent, stemMat('#7a6046'), tint(taperTube(trunk, 0.024 * s, 0.01 * s, 10, 6), 1));
  const shoots = [trunk];
  [[0.5, 0.6], [0.66, 3.2]].forEach(([f, a]) => {
    const p = trunk.getPointAt(f), h = V(Math.cos(a), 0, Math.sin(a));
    const c = new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(h, 0.18 * s).add(V(0, 0.2 * s, 0)), p.clone().addScaledVector(h, 0.3 * s).add(V(0, 0.55 * s, 0))]);
    bins.add(parent, stemMat('#7a6046'), tint(taperTube(c, 0.012 * s, 0.007 * s, 8, 5), 1));
    shoots.push(c);
  });
  shoots.forEach((c, k) => {
    const n = k ? 9 : 16;
    for (let i = 0; i < n; i++) {
      const t = (k ? 0.15 : 0.32) + (i / n) * (k ? 0.85 : 0.68);
      const p = c.getPointAt(Math.min(1, t)), a = i * 2.4 + R() * 0.6 + k, h = V(Math.cos(a), 0, Math.sin(a));
      const el = 0.6 + R() * 0.55 + (t > 0.9 ? 0.3 : 0); // held steeply, so the blades read broad from the side
      const dir = h.clone().multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el)).normalize();
      const l = (0.2 + R() * 0.1) * s * (t > 0.9 ? 0.75 : 1);
      const geo = bladeGeo({ L: l, W: l * 0.78, segL: 8, segW: 4, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + v * 0.94)), 0.55) * (0.62 + 0.38 * v) * (1 - 0.1 * Math.sin(Math.PI * v * 2)), droop: 0.12, cup: 0.12, keel: 0.02 });
      const nUp = upOf(dir).applyAxisAngle(dir, (R() - 0.5) * 1.1); // a little roll about the midrib
      bins.add(parent, leafMat(texes().fig), placeLeaf(geo, p.clone().addScaledVector(h, 0.03 * s), dir, nUp, 0.82 + R() * 0.3));
    }
  });
}
/** sansevieria: upright banded swords in a pot */
function snakePlant(parent, bins, x, y, z, s, seed, potMat) {
  const R = rng(seed), m = mats();
  const r = 0.1 * s, h = 0.16 * s;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 14), potMat || m.white); pot.position.set(x, y + h / 2, z); pot.castShadow = true; parent.add(pot);
  const n = 6 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R(), d = V(Math.cos(a), 0, Math.sin(a));
    const el = 1.32 + R() * 0.18;
    const dir = d.clone().multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el)).normalize();
    const l = (0.38 + R() * 0.28) * s;
    bins.add(parent, leafMat(texes().snake), placeLeaf(bladeGeo({ L: l, W: l * 0.17, segL: 5, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * v)), 0.5) * (1 - v * 0.3), droop: 0.03, cup: 0.25 }), V(x + d.x * 0.03, y + h - 0.01, z + d.z * 0.03), dir, upOf(dir), 0.85 + R() * 0.3));
  }
}
/** peace lily: dark glossy arching leaves + a few white spathes */
function peaceLily(parent, bins, x, y, z, s, seed, potMat) {
  const R = rng(seed), m = mats();
  const r = 0.12 * s, h = 0.18 * s;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 14), potMat || m.clay); pot.position.set(x, y + h / 2, z); pot.castShadow = true; parent.add(pot);
  const top = V(x, y + h - 0.01, z);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + R(), d = V(Math.cos(a), 0, Math.sin(a));
    const el = 0.7 + R() * 0.5;
    const dir = d.clone().multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el)).normalize();
    const l = (0.24 + R() * 0.1) * s;
    bins.add(parent, leafMat(texes().lily), placeLeaf(bladeGeo({ L: l, W: l * 0.36, segL: 6, segW: 2, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.05 + v)), 0.7), droop: 0.35, cup: 0.15 }), top, dir, upOf(dir), 0.85 + R() * 0.3));
  }
  const spathe = toon('#f6f4ec');
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + R(), tip = V(x + Math.cos(a) * 0.08 * s, y + h + (0.38 + R() * 0.1) * s, z + Math.sin(a) * 0.08 * s);
    cyl2(parent, toon('#5e8a44'), [x, y + h, z], [tip.x, tip.y, tip.z], 0.005, 3, { noLine: true });
    sph(parent, spathe, 0.045 * s, tip.x, tip.y + 0.04 * s, tip.z, 0.55, 1.2, 0.3);
  }
}
/** a trailing pothos in a hanging pot (strings to the roof purlin above) */
function hangingPot(parent, bins, x, y, z, hookY, seed, basket = false) {
  const R = rng(seed), m = mats();
  const potM = basket ? toon('#8a6a46') : m.white;
  const pot = basket ? new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), potM) : new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.17, 14), potM);
  pot.position.set(x, y + (basket ? 0.08 : 0), z); parent.add(pot);
  [0, 2.1, 4.2].forEach((a) => cyl2(parent, m.iron, [x + Math.cos(a) * 0.13, y + 0.08, z + Math.sin(a) * 0.13], [x, hookY, z], 0.004, 3, { noLine: true }));
  const nv = 6 + ((R() * 3) | 0);
  for (let k = 0; k < nv; k++) {
    const a = (k / nv) * 6.28 + R() * 0.5, len = 0.4 + R() * 0.7;
    const p0 = V(x + Math.cos(a) * 0.12, y + 0.08, z + Math.sin(a) * 0.12);
    const pts = [p0, p0.clone().add(V(Math.cos(a) * 0.12, -0.05, Math.sin(a) * 0.12)), p0.clone().add(V(Math.cos(a) * 0.18, -len * 0.6, Math.sin(a) * 0.18)), p0.clone().add(V(Math.cos(a) * 0.16 + (R() - 0.5) * 0.1, -len, Math.sin(a) * 0.16))];
    const c = new THREE.CatmullRomCurve3(pts);
    bins.add(parent, stemMat('#5c8a48'), tint(taperTube(c, 0.006, 0.004, 8, 3), 1));
    for (let t = 0.12; t < 1; t += 0.14) {
      const p = c.getPointAt(t), side = V(Math.cos(a + 1.6 * (t * 10 % 2 > 1 ? 1 : -1)), -0.2, Math.sin(a + 1.6 * (t * 10 % 2 > 1 ? 1 : -1))).normalize();
      const l = 0.07 + R() * 0.03;
      bins.add(parent, leafMat(texes().pothos), placeLeaf(bladeGeo({ L: l, W: l * 0.8, segL: 4, segW: 2, lobe: 0.15, sinus: 0.04, width: (v) => Math.pow(1 - v, 0.8), droop: 0.2, cup: 0.1 }), p, side, upOf(side), 0.9 + R() * 0.2));
    }
  }
}
/** a small potted plant: terracotta / white pot + a little rosette */
function smallPot(parent, bins, x, y, z, seed, s = 1) {
  const R = rng(seed), m = mats();
  const r = (0.07 + R() * 0.04) * s, h = r * 1.2;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 12), R() < 0.65 ? m.clay : m.white); pot.position.set(x, y + h / 2, z); pot.castShadow = true; parent.add(pot);
  const top = V(x, y + h - 0.01, z);
  const n = 5 + ((R() * 5) | 0), tall = R() < 0.4;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R(), d = V(Math.cos(a), 0, Math.sin(a));
    const el = tall ? 0.9 + R() * 0.4 : 0.25 + R() * 0.5;
    const dir = d.clone().multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el)).normalize();
    const l = (tall ? 0.16 + R() * 0.1 : 0.07 + R() * 0.05) * s;
    bins.add(parent, leafMat(texes().small), placeLeaf(bladeGeo({ L: l, W: l * (tall ? 0.25 : 0.55), segL: 4, segW: 1, width: (v) => Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * v)), 0.7), droop: tall ? 0.25 : 0.1, cup: 0.15 }), top, dir, upOf(dir), 0.85 + R() * 0.3));
  }
}
/** a bucket / vase of cut flowers: kind = hydrangea | sunflower | rose | lavender | gerbera */
function flowers(parent, x, y, z, kind, seed, bucket = true) {
  const R = rng(seed), m = mats();
  if (bucket) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.26, 14), m.zinc); b.position.set(x, y + 0.13, z); b.castShadow = true; parent.add(b); }
  // real cut flowers (plants/wild.js) fanning out of the bucket / vase / pot
  const top = y + (bucket ? 0.26 : 0);
  const type = { hydrangea: 'cutHydrangea', sunflower: 'cutSunflower', rose: 'cutRose', lavender: 'cutLavender', gerbera: 'cutGerbera' }[kind];
  const n = kind === 'hydrangea' ? 4 : kind === 'lavender' ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R(), lean = 0.08 + R() * 0.22, sc = (bucket ? 1.0 : 0.72) * (0.9 + R() * 0.25);
    plantAt(sharedPlants(), parent, type, seed + i, x + Math.cos(a) * 0.02, top - 0.1 * sc, z + Math.sin(a) * 0.02, sc, { ry: 0, tilt: [Math.sin(a) * lean, -Math.cos(a) * lean] });
  }
}
/** a clay pot of flowers: a full mound of greenery first, the flower heads set into it just above the leaves */
function potFlowers(parent, x, y, z, kind, seed, r = 0.11) {
  const m = mats(), R = rng(seed);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, r * 1.25, 14), m.clay); p.position.set(x, y + r * 0.62, z); p.castShadow = true; parent.add(p);
  const ty = y + r * 1.25, top = potPlants(sharedPlants(), x, ty, z, r * 0.88, { style: 'green', seed, obj: parent }) || r;
  const type = { hydrangea: 'cutHydrangea', sunflower: 'cutSunflower', rose: 'cutRose', lavender: 'cutLavender', gerbera: 'cutGerbera' }[kind];
  const n = kind === 'hydrangea' ? 3 : 5, stemH = kind === 'hydrangea' ? 0.43 : 0.42, sc = r / 0.11 * (kind === 'hydrangea' ? 0.95 : 0.7);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + R(), d = (i ? 0.45 : 0.1) * r, lean = i ? 0.25 : 0.05;
    plantAt(sharedPlants(), parent, type, seed + i, x + Math.cos(a) * d, ty + top * (kind === 'hydrangea' ? 0.5 : 0.75) - stemH * sc, z + Math.sin(a) * d, sc, { ry: 0, tilt: [Math.sin(a) * lean, -Math.cos(a) * lean] });
  }
}
/** an open wooden crate (label on the long side facing -x in the crate's frame) */
function crate(parent, x, y, z, w = 0.5, d = 0.36, h = 0.26, ry = 0) {
  const m = mats();
  const c = grp(parent, x, y, z, ry);
  bx(c, m.wood, -w / 2, w / 2, 0, 0.02, -d / 2, d / 2);
  bx(c, m.wood, -w / 2, w / 2, 0, h, -d / 2, -d / 2 + 0.02); bx(c, m.wood, -w / 2, w / 2, 0, h, d / 2 - 0.02, d / 2);
  bx(c, m.wood, -w / 2, -w / 2 + 0.02, 0, h, -d / 2, d / 2); bx(c, m.wood, w / 2 - 0.02, w / 2, 0, h, -d / 2, d / 2);
  const lb = pl(c, new THREE.MeshBasicMaterial({ map: crateTex(), color: new THREE.Color(0.9, 0.88, 0.85) }), w * 0.8, h * 0.6, 0, h * 0.5, d / 2 + 0.004, 0, 0); lb.userData.noLine = true;
  return c;
}

/* ---------------------------------------------------------------- the greenhouse (local frame)
   local x: 0 at the entrance gable (south) .. L at the back (north); local z: 0 .. W across (world +x).
   The group turns it so the entrance gable faces Kaigan-dori, like the LAWSON's shop front. */
const L = 9.4, W = 7.2, WALL = 3.0, BRICK = 0.55;
const PITCH = Math.PI / 6;
const RIDGE = WALL + (W / 2) * Math.tan(PITCH);
const ORIGIN = { x: 14.6, z: 2.6 }; // local (0, 0): south-west corner of the greenhouse
const DOOR = 0.8; // half the door opening
const toWorld = (lx, lz) => [ORIGIN.x + lz, ORIGIN.z - lx];
// the house beside it, front to the south, behind its own front yard
const HX0 = 24.6, HX1 = 29.3, HZ0 = -4.2, HZ1 = 1.0, YARD_Z = 3.85;

function buildGreenhouse(g, Y, m) {
  const G = grp(g, ORIGIN.x, 0, ORIGIN.z, Math.PI / 2);
  const bins = makeBins(G);
  const zc = W / 2, half = W / 2;
  const F = (x0, x1, y0, y1, z0, z1, mat = m.frame) => bx(G, mat, x0, x1, y0, y1, z0, z1, { bevel: 0.012 });
  const beam = (p, q, w, h, mat = m.frame) => {
    const d = V(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const len = d.length();
    const b = new THREE.Group(); b.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    b.quaternion.setFromUnitVectors(V(1, 0, 0), d.normalize()); G.add(b);
    bx(b, mat, -len / 2, len / 2, -h / 2, h / 2, -w / 2, w / 2, { bevel: 0.01 });
    return b;
  };

  /* foundation, floor, brick base (doors in the south gable, the back is a solid wall) */
  bx(G, m.brick, -0.08, L + 0.08, Y - 0.36, Y + 0.04, -0.08, W + 0.08, { bevel: 0.03 });
  const fl = pl(G, m.floor, L - 0.1, W - 0.1, L / 2, Y + 0.045, zc, 0, -Math.PI / 2);
  m.floor.map.repeat.set(L / 1.6, W / 1.6); fl.receiveShadow = true;
  const brick = (x0, x1, z0, z1) => bx(G, m.brick, x0, x1, Y, Y + BRICK, z0, z1, { bevel: 0.02 });
  brick(0, L, 0, 0.16); brick(0, L, W - 0.16, W); brick(L - 0.16, L, 0, W);
  brick(0, 0.16, 0, zc - DOOR - 0.08); brick(0, 0.16, zc + DOOR + 0.08, W);
  F(0, L, Y + BRICK, Y + BRICK + 0.05, -0.04, 0.2, m.frameD); F(0, L, Y + BRICK, Y + BRICK + 0.05, W - 0.2, W + 0.04, m.frameD);
  [[0, zc - DOOR - 0.08], [zc + DOOR + 0.08, W]].forEach(([a, b]) => F(-0.04, 0.2, Y + BRICK, Y + BRICK + 0.05, a, b, m.frameD));

  /* frame */
  const bays = 11, bw = L / bays, t = 0.08, tt = 0.042;
  for (let i = 0; i <= bays; i++) {
    const x = i * bw;
    [0.08, W - 0.08].forEach((z) => F(x - t / 2, x + t / 2, Y + BRICK, Y + WALL, z - t / 2, z + t / 2));
    if (i < bays) [0.08, W - 0.08].forEach((z) => F(x + bw / 2 - tt / 2, x + bw / 2 + tt / 2, Y + BRICK, Y + WALL, z - tt / 2, z + tt / 2));
  }
  [Y + 1.6, Y + 2.3].forEach((yy) => [0.08, W - 0.08].forEach((z) => F(0, L, yy - tt / 2, yy + tt / 2, z - tt / 2, z + tt / 2)));
  [0.08, W - 0.08].forEach((z) => F(-0.04, L + 0.04, Y + WALL - 0.05, Y + WALL + 0.05, z - 0.06, z + 0.06));
  [-0.02, W + 0.02].forEach((z) => F(-0.16, L + 0.16, Y + WALL - 0.02, Y + WALL + 0.06, z - 0.06, z + 0.06, m.frameD)); // gutters
  for (let i = 0; i <= bays * 2; i++) {
    const x = (i * bw) / 2, main = i % 2 === 0;
    [0.08, W - 0.08].forEach((z) => beam([x, Y + WALL + 0.04, z], [x, Y + RIDGE, zc], main ? t : tt, main ? t : tt));
  }
  [1 / 3, 2 / 3].forEach((f) => [1, -1].forEach((s) => { const z = zc + s * (half - 0.08) * (1 - f), y = Y + WALL + (RIDGE - WALL) * f; F(0, L, y - tt / 2, y + tt / 2, z - tt / 2, z + tt / 2); }));
  F(-0.12, L + 0.12, Y + RIDGE - 0.02, Y + RIDGE + 0.1, zc - 0.07, zc + 0.07); // ridge
  for (let x = 0.4; x < L; x += 0.5) sph(G, m.frame, 0.035, x, Y + RIDGE + 0.12, zc, 1, 1.4, 1); // cresting
  // two ridge vents, one propped open
  [[3.0, 0], [6.6, 1]].forEach(([x, open]) => {
    const vg = grp(G, x, Y + RIDGE + 0.04, zc + 0.08, 0);
    vg.rotation.x = open ? -0.35 : 0;
    bx(vg, m.frame, -0.4, 0.4, 0, 0.05, 0, 0.7, { bevel: 0.01 });
    if (open) cyl2(G, m.iron, [x, Y + RIDGE - 0.15, zc + 0.55], [x, Y + RIDGE + 0.22, zc + 0.68], 0.012, 4);
  });
  // gable ends: the south one carries the doors + fan window; the north one is glass above a solid wall
  const nm = 9;
  [0.08, L - 0.08].forEach((x, k) => {
    F(x - t / 2, x + t / 2, Y + WALL - 0.04, Y + WALL + 0.04, 0, W);
    for (let j = 1; j < nm; j++) {
      const z = 0.08 + (j * (W - 0.16)) / nm;
      const yTop = Y + WALL + (RIDGE - WALL) * (1 - Math.abs(z - zc) / half);
      if (k === 1 || Math.abs(z - zc) < DOOR + 0.12) { F(x - tt / 2, x + tt / 2, Y + WALL, yTop, z - tt / 2, z + tt / 2); continue; }
      F(x - tt / 2, x + tt / 2, Y + BRICK, yTop, z - tt / 2, z + tt / 2);
    }
    [1, -1].forEach((s) => beam([x, Y + WALL, zc + s * half], [x, Y + RIDGE, zc], t, t));
    if (k === 0) { F(x - tt / 2, x + tt / 2, Y + 1.6 - tt / 2, Y + 1.6 + tt / 2, 0, zc - DOOR - 0.08); F(x - tt / 2, x + tt / 2, Y + 1.6 - tt / 2, Y + 1.6 + tt / 2, zc + DOOR + 0.08, W); }
  });
  {
    const x = 0.04, cy0 = Y + WALL + 0.02, r = 1.0;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 30, Math.PI), m.frame); arc.rotation.y = Math.PI / 2; arc.position.set(x, cy0, zc); G.add(arc);
    const arc2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.35, 0.022, 6, 18, Math.PI), m.frame); arc2.rotation.y = Math.PI / 2; arc2.position.set(x, cy0, zc); G.add(arc2);
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; cyl2(G, m.frame, [x, cy0 + Math.sin(a) * r * 0.35, zc + Math.cos(a) * r * 0.35], [x, cy0 + Math.sin(a) * r, zc + Math.cos(a) * r], 0.014, 4); }
  }

  /* glass: walls, gables and roof in one mesh (lighter than before: the interior has to read through it) */
  {
    const quads = [], tris = [];
    const Q = (a, b, c, d) => quads.push([a, b, c, d]);
    const z0 = 0.06, z1 = W - 0.06, xs = 0.06, xn = L - 0.06;
    Q([0, Y + BRICK, z1], [L, Y + BRICK, z1], [L, Y + WALL, z1], [0, Y + WALL, z1]);
    Q([L, Y + BRICK, z0], [0, Y + BRICK, z0], [0, Y + WALL, z0], [L, Y + WALL, z0]);
    [W - 0.08, 0.08].forEach((ze) => Q([0, Y + WALL + 0.06, ze], [L, Y + WALL + 0.06, ze], [L, Y + RIDGE + 0.02, zc], [0, Y + RIDGE + 0.02, zc]));
    Q([xs, Y + BRICK, 0], [xs, Y + BRICK, zc - DOOR - 0.08], [xs, Y + WALL, zc - DOOR - 0.08], [xs, Y + WALL, 0]);
    Q([xs, Y + BRICK, zc + DOOR + 0.08], [xs, Y + BRICK, W], [xs, Y + WALL, W], [xs, Y + WALL, zc + DOOR + 0.08]);
    Q([xs, Y + 2.3, zc - DOOR - 0.08], [xs, Y + 2.3, zc + DOOR + 0.08], [xs, Y + WALL, zc + DOOR + 0.08], [xs, Y + WALL, zc - DOOR - 0.08]); // transom
    [xn, xs].forEach((x) => tris.push([[x, Y + WALL, 0], [x, Y + WALL, W], [x, Y + RIDGE, zc]]));
    const pos = [], uv = [], idx = [];
    const addV = (p) => { pos.push(...p); uv.push((p[0] + p[2]) / 3, p[1] / 3); return pos.length / 3 - 1; };
    quads.forEach(([a, b, c, d]) => { const i0 = addV(a), i1 = addV(b), i2 = addV(c), i3 = addV(d); idx.push(i0, i1, i2, i0, i2, i3); });
    tris.forEach(([a, b, c]) => { const i0 = addV(a), i1 = addV(b), i2 = addV(c); idx.push(i0, i1, i2); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const glass = new THREE.Mesh(geo, makeGlass(3, 3, 61, { alpha: 0.12, drops: 0.45, tint: 0xd6ecf2 }));
    glass.userData.noLine = true; glass.renderOrder = 2;
    G.add(glass); reg.noRefl.push(glass);
    // gilt lettering on the transom
    const tm = pl(G, new THREE.MeshBasicMaterial({ map: transomTex(), transparent: true, depthWrite: false }), 1.6, 0.2, xs - 0.012, Y + 2.42, zc, -Math.PI / 2, 0); tm.userData.noLine = true;
  }

  /* back wall: plaster inside and out on the brick base, a work-room door */
  {
    bx(G, m.plaster, L - 0.2, L, Y + BRICK, Y + WALL - 0.05, 0.1, W - 0.1, { bevel: 0.01 });
    bx(G, m.plasterIn, L - 0.21, L - 0.2, Y + 0.05, Y + WALL - 0.05, 0.12, W - 0.12, { cast: false });
    bx(G, m.woodD, L - 0.26, L - 0.2, Y + 0.05, Y + 0.17, 0.12, W - 0.12); // skirting
    bx(G, m.woodD, L - 0.25, L - 0.2, Y + WALL - 0.2, Y + WALL - 0.12, 0.12, W - 0.12); // picture rail
    // the work-room door (inside face) + the same door outside
    const door = (x, s) => {
      const z0 = 1.45, z1 = 2.35, top = Y + 2.12;
      bx(G, m.wood, x - 0.03 * s, x + 0.01 * s, Y + 0.05, top + 0.08, z0 - 0.08, z0, { bevel: 0.01 });
      bx(G, m.wood, x - 0.03 * s, x + 0.01 * s, Y + 0.05, top + 0.08, z1, z1 + 0.08, { bevel: 0.01 });
      bx(G, m.wood, x - 0.03 * s, x + 0.01 * s, top, top + 0.08, z0 - 0.08, z1 + 0.08, { bevel: 0.01 });
      bx(G, toon('#9a6a40', { lit: 0.1 }), x - 0.02 * s, x, Y + 0.06, top, z0, z1, { bevel: 0.01 });
      pl(G, glow('#fff1d6', 0.95, { cat: 'iza', off: '#d8cdb8' }), 0.52, 0.5, x - 0.022 * s, Y + 1.6, (z0 + z1) / 2, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      bx(G, toon('#7a5030'), x - 0.03 * s, x - 0.022 * s, Y + 1.34, Y + 1.86, (z0 + z1) / 2 - 0.012, (z0 + z1) / 2 + 0.012, { cast: false });
      bx(G, toon('#7a5030'), x - 0.03 * s, x - 0.022 * s, Y + 1.59, Y + 1.61, z0 + 0.15, z1 - 0.15, { cast: false });
      cy(G, m.brass, x - 0.05 * s, Y + 1.0, z1 - 0.12, 0.025, 0.04, 8);
    };
    door(L - 0.21, 1); door(L + 0.0, -1);
    const ds = pl(G, new THREE.MeshBasicMaterial({ map: doorSignTex() }), 0.36, 0.13, L - 0.245, Y + 1.98, 1.9, -Math.PI / 2, 0); ds.userData.noLine = true;
    cy(G, glow('#ffe2b0', 1.6, { cat: 'iza' }), L + 0.12, Y + 2.3, 1.9, 0.08, 0.12, 10); // back-door lamp
  }

  /* entrance (south gable): pale green double glass doors on hinges, canopy, wooden sign + lamps */
  const leaves = [];
  {
    const x = 0.02, d0 = zc - DOOR, d1 = zc + DOOR, top = Y + 2.22;
    // fixed frame: jambs + head
    F(x - 0.06, x + 0.06, Y, top + 0.1, d0 - 0.09, d0, m.door); F(x - 0.06, x + 0.06, Y, top + 0.1, d1, d1 + 0.09, m.door);
    F(x - 0.06, x + 0.06, top, top + 0.1, d0 - 0.09, d1 + 0.09, m.door);
    F(x - 0.02, x + 0.12, Y + 0.02, Y + 0.05, d0, d1, toon('#8a8f86')); // threshold
    // the two leaves turn on their outer hinges, inwards
    const gl = makeGlass(0.64, 1.36, 62, { alpha: 0.1, drops: 0.35, tint: 0xd6ecf2 });
    [[d0, 1], [d1, -1]].forEach(([hz, s]) => {
      const pv = grp(G, x, Y, hz, 0);
      pv.userData.keep = true; // animated: kept out of mergeStatic
      const lw = DOOR - 0.01, h = top - Y - 0.01;
      const Fz = (a, b, y0, y1, mat = m.door) => bx(pv, mat, -0.03, 0.03, y0, y1, Math.min(a * s, b * s), Math.max(a * s, b * s), { bevel: 0.008 });
      Fz(0.0, 0.07, 0.02, h); Fz(lw - 0.07, lw, 0.02, h);
      Fz(0.07, lw - 0.07, 0.02, 0.6); Fz(0.07, lw - 0.07, h - 0.1, h);
      Fz(0.07, lw - 0.07, 1.1, 1.13); Fz(0.07, lw - 0.07, 1.62, 1.65);
      Fz(lw / 2 - 0.013, lw / 2 + 0.013, 0.6, h - 0.1);
      bx(pv, toon('#93ab9e'), -0.032, 0.032, 0.12, 0.5, Math.min(0.14 * s, (lw - 0.14) * s), Math.max(0.14 * s, (lw - 0.14) * s), { bevel: 0.01 }); // kick panel
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.14, h - 0.7), gl);
      gp.position.set(0, (0.6 + h - 0.1) / 2, (lw / 2) * s); gp.rotation.y = Math.PI / 2; gp.userData.noLine = true; pv.add(gp); reg.noRefl.push(gp);
      // long brass pull handles on both faces near the meeting stiles
      [-0.06, 0.06].forEach((ox) => {
        cyl2(pv, m.brass, [ox, 0.82, (lw - 0.13) * s], [ox, 1.2, (lw - 0.13) * s], 0.012, 6);
        [0.86, 1.16].forEach((yy) => cyl2(pv, m.brass, [0, yy, (lw - 0.13) * s], [ox, yy, (lw - 0.13) * s], 0.008, 4));
      });
      leaves.push({ pv, s });
    });
    const op = pl(leaves[1].pv, new THREE.MeshBasicMaterial({ map: openTex(), side: THREE.DoubleSide }), 0.3, 0.135, -0.04, 1.42, -(DOOR / 2), -Math.PI / 2, 0); op.userData.noLine = true;
    cyl2(leaves[1].pv, m.iron, [-0.04, 1.49, -DOOR / 2 - 0.1], [-0.04, 1.62, -DOOR / 2], 0.003, 3, { noLine: true });
    cyl2(leaves[1].pv, m.iron, [-0.04, 1.49, -DOOR / 2 + 0.1], [-0.04, 1.62, -DOOR / 2], 0.003, 3, { noLine: true });
    // steps: a landing at the floor level and one step down to the forecourt
    const gyF = groundY(ORIGIN.x + zc, ORIGIN.z + 0.8);
    bx(G, toon('#c9c3b8'), x - 0.5, x + 0.02, gyF - 0.05, Y + 0.02, d0 - 0.25, d1 + 0.25, { bevel: 0.02 });
    bx(G, toon('#bdb6aa'), x - 0.88, x - 0.5, gyF - 0.05, (gyF + Y) / 2, d0 - 0.15, d1 + 0.15, { bevel: 0.02 });
    const mat = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#8a6a46'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6b4f32'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); T(c, 'WELCOME', w / 2, h / 2 + 2, 38, '#e9dcc4', { weight: 800 }); });
    const mp = pl(G, new THREE.MeshBasicMaterial({ map: mat, color: new THREE.Color(0.85, 0.82, 0.78) }), 1.1, 0.42, x - 0.26, Y + 0.025, zc, -Math.PI / 2, -Math.PI / 2); mp.userData.noLine = true;
    // glass canopy on iron brackets
    const cv = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), makeGlass(1, 2, 63, { alpha: 0.14, drops: 0.8, tint: 0xcfe4ea }));
    cv.position.set(x - 0.5, top + 0.3, zc); cv.rotation.set(-Math.PI / 2, 0, 0); cv.userData.noLine = true; G.add(cv); reg.noRefl.push(cv);
    [d0 - 0.06, d1 + 0.06].forEach((z) => { cyl2(G, m.iron, [x, top + 0.3, z], [x - 1.0, top + 0.3, z], 0.012, 4); cyl2(G, m.iron, [x, top - 0.25, z], [x - 0.8, top + 0.3, z], 0.01, 4); });
    cyl2(G, m.iron, [x - 1.0, top + 0.3, d0 - 0.06], [x - 1.0, top + 0.3, d1 + 0.06], 0.012, 4);
    // the hand-made sign under two gooseneck lamps
    const sx = x - 0.07, sy = top + 0.36;
    bx(G, m.woodD, sx - 0.05, sx + 0.01, sy, sy + 0.44, zc - 1.02, zc + 1.02, { bevel: 0.02 });
    const sp = pl(G, new THREE.MeshBasicMaterial({ map: signTex(), color: new THREE.Color(1.05, 1.0, 0.95) }), 1.96, 0.44, sx - 0.055, sy + 0.22, zc, -Math.PI / 2, 0); sp.userData.noLine = true;
    [-0.76, 0.76].forEach((dz) => {
      cyl2(G, m.iron, [sx, sy + 0.44, zc + dz], [sx - 0.3, sy + 0.54, zc + dz], 0.01, 4);
      bx(G, m.green, sx - 0.36, sx - 0.24, sy + 0.48, sy + 0.58, zc + dz - 0.06, zc + dz + 0.06, { cast: false });
      bx(G, glow('#ffe8c0', 2.2, { cat: 'iza' }), sx - 0.35, sx - 0.25, sy + 0.475, sy + 0.485, zc + dz - 0.05, zc + dz + 0.05, { cast: false });
    });
    halo(G, sx - 0.3, sy + 0.24, zc, '#ffd9a8', 2.0, 0.2);
    // wall lanterns either side of the doors
    [d0 - 0.32, d1 + 0.32].forEach((z) => {
      bx(G, m.iron, -0.04, 0.0, Y + 1.85, Y + 2.15, z - 0.05, z + 0.05, { cast: false });
      bx(G, m.iron, -0.22, -0.04, Y + 2.12, Y + 2.15, z - 0.09, z + 0.09, { cast: false });
      bx(G, glow('#ffe2b0', 1.8, { cat: 'iza' }), -0.2, -0.06, Y + 1.9, Y + 2.12, z - 0.07, z + 0.07, { cast: false });
      halo(G, -0.13, Y + 2.0, z, '#ffd9a8', 0.9, 0.35);
    });
    // a projecting bracket sign on the corner post (seen from up and down the street)
    const bs = canvasTex(160, 160, (c, w, h) => { c.fillStyle = '#3f6a52'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.fill(); c.strokeStyle = '#e9dcc4'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 12, 0, 7); c.stroke(); T(c, '花', w / 2, h / 2 + 4, 76, '#f6efe0', { weight: 900 }); });
    // two single-sided faces back to back on a thin disc, so 花 reads the right way round from either direction
    const bm = new THREE.MeshBasicMaterial({ map: bs, transparent: true, alphaTest: 0.5 });
    cyl2(G, m.iron, [0, Y + 2.65, -0.02], [0, Y + 2.65, -0.62], 0.012, 4);
    [[0.011, Math.PI / 2], [-0.011, -Math.PI / 2]].forEach(([dx, ry]) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), bm); f.position.set(dx, Y + 2.35, -0.38); f.rotation.y = ry; f.userData.noLine = true; G.add(f); });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.242, 0.242, 0.02, 32), m.green); disc.rotation.z = Math.PI / 2; disc.position.set(0, Y + 2.35, -0.38); G.add(disc);
    [-0.2, -0.56].forEach((z) => cyl2(G, m.iron, [0, Y + 2.65, z], [0, Y + 2.35 + Math.sqrt(Math.max(0, 0.0576 - (z + 0.38) ** 2)) - 0.01, z], 0.005, 3, { noLine: true }));
  }

  /* interior, after the reference video (local frame; door at lx 0, aisle up the middle-right) */
  {
    const fy = Y + 0.05;
    const legs = (x0, x1, z0, z1, h, mat = m.woodD, r = 0.025) => [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]].forEach(([a, b]) => bx(G, mat, a - r, a + r, fy, fy + h, b - r, b + r, { bevel: 0.006 }));
    const table = (x0, x1, z0, z1, h, shelf = true) => {
      bx(G, m.wood, x0, x1, fy + h - 0.05, fy + h, z0, z1, { bevel: 0.015 });
      legs(x0, x1, z0, z1, h - 0.05);
      if (shelf) bx(G, m.wood, x0 + 0.05, x1 - 0.05, fy + 0.18, fy + 0.21, z0 + 0.05, z1 - 0.05, { bevel: 0.01 });
    };
    let sd = 100;
    const pots = (x0, x1, y, z, n, s = 1) => { for (let i = 0; i < n; i++) smallPot(G, bins, x0 + ((x1 - x0) * (i + 0.5)) / n, y, z + ((sd % 3) - 1) * 0.03, sd++, s * (0.9 + (sd % 4) * 0.08)); };

    // (1) left of the door: a round side table of potted hydrangeas, a low bench of pots
    {
      const tx = 0.95, tz = 1.0;
      cy(G, m.white, tx, fy + 0.6, tz, 0.4, 0.04, 22);
      [0, 2.09, 4.19].forEach((a) => cyl2(G, m.white, [tx + Math.cos(a) * 0.3, fy, tz + Math.sin(a) * 0.3], [tx + Math.cos(a) * 0.22, fy + 0.6, tz + Math.sin(a) * 0.22], 0.018, 5, { cast: true }));
      cy(G, m.white, tx, fy + 0.22, tz, 0.26, 0.02, 18);
      potFlowers(G, tx - 0.15, fy + 0.64, tz - 0.1, 'hydrangea', 601); potFlowers(G, tx + 0.16, fy + 0.64, tz + 0.05, 'hydrangea', 602, 0.1); potFlowers(G, tx - 0.02, fy + 0.64, tz + 0.22, 'rose', 603, 0.08);
      potFlowers(G, tx + 0.05, fy + 0.24, tz - 0.05, 'hydrangea', 604, 0.1);
      table(1.6, 2.8, 0.22, 0.66, 0.5, true);
      pots(1.65, 2.75, fy + 0.5, 0.44, 4, 1.25); pots(1.7, 2.7, fy + 0.21, 0.44, 3, 1.1);
    }
    // (2) the wrapping table along the left glass: foam blocks, ribbons, kraft roll, a bouquet in progress
    {
      const x0 = 3.1, x1 = 6.3, z0 = 0.22, z1 = 1.1, h = 0.9, ty = fy + h;
      table(x0, x1, z0, z1, h);
      bx(G, toon('#5f9a5a'), 3.45, 3.75, ty, ty + 0.08, 0.6, 0.82, { bevel: 0.01 }); bx(G, toon('#6faa64'), 3.8, 4.02, ty, ty + 0.08, 0.66, 0.86, { bevel: 0.01 });
      cyl2(G, m.kraft, [3.3, ty + 0.06, 0.34], [4.6, ty + 0.06, 0.34], 0.055, 12, { cast: true });
      [[3.25, 0.34], [4.65, 0.34]].forEach(([a, b]) => bx(G, m.woodD, a - 0.02, a + 0.02, ty, ty + 0.12, b - 0.04, b + 0.04));
      ['#e86a7a', '#f2c14e', '#7fb4e0', '#f4f0e6', '#9ccf7a'].forEach((c, i) => cyl2(G, toon(c), [5.0 + i * 0.075, ty + 0.07, 0.36], [5.05 + i * 0.075, ty + 0.07, 0.36], 0.065, 12, { cast: true }));
      cyl2(G, m.woodD, [4.95, ty + 0.07, 0.36], [5.42, ty + 0.07, 0.36], 0.01, 4);
      // scissors, gloves, wire, loose stems
      const sc = grp(G, 4.35, ty + 0.005, 0.85, 0.4);
      bx(sc, toon('#9aa0a6'), -0.11, 0.06, 0, 0.008, -0.01, 0.01); bx(sc, toon('#9aa0a6'), -0.11, 0.06, 0, 0.008, -0.01, 0.01).rotation.y = 0.25;
      [-0.012, 0.03].forEach((z) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 5, 10), toon('#d9483f')); r.rotation.x = Math.PI / 2; r.position.set(0.09, 0.006, z); sc.add(r); });
      bx(G, toon('#f2c6c6'), 5.55, 5.72, ty, ty + 0.02, 0.75, 0.86, { bevel: 0.006 }); bx(G, toon('#f2c6c6'), 5.62, 5.8, ty + 0.02, ty + 0.035, 0.8, 0.9, { bevel: 0.006 });
      const wire = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 14), toon('#4a7a8c')); wire.rotation.x = Math.PI / 2; wire.position.set(6.0, ty + 0.012, 0.55); G.add(wire);
      for (let i = 0; i < 5; i++) { const zz = 0.62 + i * 0.05, xa = 4.75 + i * 0.04; plantAt(sharedPlants(), G, ['cutRose', 'cutRose', 'cutGerbera', 'cutHydrangea', 'cutSunflower'][i], i, xa, ty + 0.012, zz, 0.95, { ry: -0.1, tilt: [0, -Math.PI / 2] }); } // loose stems, lying
      // a bouquet in kraft paper waiting to be tied
      const bq = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 10, 1, true), m.kraft); bq.rotation.z = Math.PI / 2 + 0.1; bq.position.set(5.85, ty + 0.1, 0.42); G.add(bq);
      flowers(G, 5.62, ty + 0.03, 0.42, 'gerbera', 611, false);
      // under the table: crates, a bucket of stems, a watering can
      crate(G, 3.6, fy + 0.21, 0.66, 0.6, 0.4, 0.26); crate(G, 4.35, fy + 0.21, 0.66, 0.6, 0.4, 0.26);
      flowers(G, 5.4, fy + 0.21, 0.62, 'lavender', 612);
      // a pendant lamp over the table
    }
    // (3) the till at the back left: closed counter, register, paper bags, a vase
    {
      const x0 = 6.75, x1 = 8.95, z0 = 0.22, z1 = 1.25, h = 0.92, ty = fy + h;
      bx(G, m.wood, x0, x1, fy, ty - 0.04, z0, z1, { bevel: 0.02 });
      bx(G, m.white, x0 - 0.03, x1 + 0.02, ty - 0.04, ty, z0 - 0.02, z1 + 0.03, { bevel: 0.01 });
      for (let x = x0 + 0.12; x < x1 - 0.05; x += 0.14) bx(G, toon('#b98a5c'), x - 0.012, x + 0.012, fy + 0.08, ty - 0.1, z1, z1 + 0.012, { cast: false }); // slatted front
      bx(G, toon('#e8e4da'), 7.55, 7.95, ty, ty + 0.1, 0.45, 0.85, { bevel: 0.02 }); // register
      bx(G, toon('#3a3f46'), 7.6, 7.63, ty + 0.12, ty + 0.3, 0.5, 0.8, { bevel: 0.006 }); // customer display
      pl(G, glow('#bfe3ff', 0.8, { cat: 'iza', off: '#55606a' }), 0.26, 0.15, 7.597, ty + 0.21, 0.65, -Math.PI / 2, 0);
      bx(G, toon('#2e3036'), 7.15, 7.3, ty, ty + 0.03, 0.95, 1.1, { bevel: 0.006 }); // card reader
      bx(G, m.kraft, 8.25, 8.6, ty, ty + 0.12, 0.4, 0.62, { bevel: 0.006 }); bx(G, m.kraft, 8.27, 8.58, ty + 0.12, ty + 0.2, 0.42, 0.6, { bevel: 0.006 });
      potFlowers(G, 8.6, ty, 1.0, 'rose', 621, 0.07);
      snakePlant(G, bins, 7.0, ty, 0.42, 0.7, 622);
    }
    // (4) the back wall: clock, picture, pegboard over the workbench, rake + broom, hose reel, cabinet
    {
      const wx = L - 0.215; // inner face
      const cl = pl(G, new THREE.MeshBasicMaterial({ map: clockTex() }), 0.36, 0.36, wx - 0.012, Y + 2.45, 0.8, -Math.PI / 2, 0); cl.userData.noLine = true;
      cy(G, toon('#6b5236'), wx - 0.004, Y + 2.45 - 0.005, 0.8, 0.19, 0.01, 20).rotation.z = Math.PI / 2;
      const pc = pl(G, new THREE.MeshBasicMaterial({ map: pictureTex() }), 0.36, 0.45, wx - 0.012, Y + 1.62, 0.75, -Math.PI / 2, 0); pc.userData.noLine = true;
      // pegboard + workbench
      const pg = pl(G, new THREE.MeshBasicMaterial({ map: pegTex(), color: new THREE.Color(0.95, 0.93, 0.9) }), 1.8, 1.0, wx - 0.034, Y + 1.62, 3.8, -Math.PI / 2, 0); pg.userData.noLine = true;
      bx(G, m.woodD, wx - 0.03, wx, Y + 1.1, Y + 2.14, 2.88, 4.72, { cast: false });
      table(8.55, wx, 2.7, 4.9, 0.9);
      bx(G, m.wood, 8.95, wx, fy + 2.12, fy + 2.16, 2.7, 4.9, { bevel: 0.01 }); // shelf above
      for (let i = 0; i < 6; i++) smallPot(G, bins, 9.07, fy + 2.16, 2.85 + i * 0.36, 700 + i, 0.9);
      // on the bench: stacked clay pots, a trowel, a bag of potting mix, a tray of seedlings
      [0, 1, 2, 3].forEach((k) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.12, 12, 1, true), m.clay); p.position.set(8.85, fy + 0.96 + k * 0.035, 3.0); G.add(p); });
      bx(G, toon('#4a3a2c'), 8.65, 9.05, fy + 0.9, fy + 0.95, 3.55, 4.15, { bevel: 0.01 }); // seedling tray
      for (let i = 0; i < 8; i++) smallPot(G, bins, 8.75 + (i % 2) * 0.2, fy + 0.95, 3.62 + (i >> 1) * 0.14, 720 + i, 0.5);
      bx(G, toon('#e8e2cf'), 8.7, 9.0, fy + 0.9, fy + 1.24, 4.35, 4.7, { bevel: 0.03 }); // potting mix bag
      // a watering can and a zinc bucket under the bench
      const wc = grp(G, 8.85, fy, 4.4, 0.3); cy(wc, m.zinc, 0, 0, 0, 0.11, 0.24, 12); cyl2(wc, m.zinc, [0.08, 0.14, 0], [0.3, 0.32, 0], 0.015, 5); cyl2(wc, m.zinc, [-0.1, 0.24, 0], [-0.1, 0.34, 0], 0.012, 4);
      flowers(G, 8.85, fy, 3.2, 'sunflower', 731);
      // rake + broom leaning on the wall, a coiled hose on a reel
      const lean = (z, top) => cyl2(G, toon('#b48a5c'), [8.95, fy, z], [wx - 0.03, fy + top, z + 0.05], 0.016, 5, { cast: true });
      lean(5.05, 1.75); lean(5.25, 1.55);
      for (let k = -4; k <= 4; k++) cyl2(G, toon('#b48a5c'), [wx - 0.04, fy + 1.75, 5.1], [wx - 0.05, fy + 2.15, 5.1 + k * 0.045], 0.006, 3, { noLine: true });
      bx(G, toon('#a8743c'), 8.85, 9.05, fy, fy + 0.22, 5.12, 5.42, { bevel: 0.02 }); // broom head
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 18), toon('#3f8a52')); hose.position.set(wx - 0.06, Y + 1.25, 5.55); hose.rotation.y = Math.PI / 2; G.add(hose);
      bx(G, m.iron, wx - 0.05, wx, Y + 1.38, Y + 1.46, 5.5, 5.6, { cast: false });
      // tall cabinet with glass doors over drawers
      {
        const x0 = 8.68, x1 = wx, z0 = 5.85, z1 = 6.95, hh = 2.25;
        bx(G, m.wood, x0, x1, fy, fy + hh, z0, z1, { bevel: 0.02 });
        bx(G, toon('#f0e8d8'), x0 - 0.005, x0 + 0.02, fy + 1.0, fy + hh - 0.1, z0 + 0.06, z1 - 0.06, { cast: false }); // inside back, seen through the glass
        for (let k = 0; k < 3; k++) bx(G, m.woodD, x0 - 0.01, x0 + 0.05, fy + 1.0 + k * 0.38, fy + 1.03 + k * 0.38, z0 + 0.06, z1 - 0.06, { cast: false });
        for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), toon(['#d9e8ee', '#e8d6b6', '#c6dcc0'][(i + k) % 3])); jar.position.set(x0 - 0.04, fy + 1.12 + k * 0.38, z0 + 0.22 + i * 0.32); G.add(jar); }
        [z0 + 0.04, (z0 + z1) / 2, z1 - 0.04].forEach((z) => bx(G, m.woodD, x0 - 0.04, x0, fy + 0.95, fy + hh, z - 0.025, z + 0.025, { cast: false }));
        bx(G, m.woodD, x0 - 0.04, x0, fy + hh - 0.08, fy + hh, z0, z1, { cast: false });
        for (let k = 0; k < 3; k++) { bx(G, m.woodD, x0 - 0.03, x0, fy + 0.08 + k * 0.29, fy + 0.1 + k * 0.29, z0 + 0.04, z1 - 0.04, { cast: false }); [z0 + 0.3, z1 - 0.3].forEach((z) => cy(G, m.brass, x0 - 0.04, fy + 0.22 + k * 0.29, z, 0.018, 0.03, 6)); }
        bx(G, m.woodD, x0 - 0.04, x1, fy + 0.92, fy + 0.96, z0, z1, { cast: false });
      }
      // two framed small notices by the door
      [[2.6, '#fff7e8'], [2.9, '#e8f4ff']].forEach(([z, c]) => bx(G, toon(c), wx - 0.012, wx, Y + 1.5, Y + 1.78, z - 0.1, z + 0.1, { cast: false }));
    }
    // (5) right wall: a two-tier bench of zinc buckets full of cut flowers
    {
      const x0 = 1.0, x1 = 7.3;
      bx(G, m.wood, x0, x1, fy + 0.3, fy + 0.34, 6.2, 6.6, { bevel: 0.01 });
      bx(G, m.wood, x0, x1, fy + 0.62, fy + 0.66, 6.6, 7.0, { bevel: 0.01 });
      for (let x = x0 + 0.05; x <= x1; x += 1.05) { bx(G, m.woodD, x - 0.025, x + 0.025, fy, fy + 0.3, 6.22, 6.27); bx(G, m.woodD, x - 0.025, x + 0.025, fy, fy + 0.62, 6.93, 6.98); }
      const kinds = ['hydrangea', 'rose', 'lavender', 'gerbera', 'sunflower', 'hydrangea', 'rose', 'gerbera', 'lavender'];
      for (let i = 0; i < 9; i++) flowers(G, x0 + 0.35 + i * 0.7, fy + 0.34, 6.4, kinds[i], 640 + i);
      for (let i = 0; i < 9; i++) flowers(G, x0 + 0.7 + i * 0.68, fy + 0.66, 6.8, kinds[(i + 4) % 9], 660 + i);
      // little price cards on the bench edge
      for (let i = 0; i < 9; i++) bx(G, toon('#f6f0e2'), x0 + 0.28 + i * 0.7, x0 + 0.42 + i * 0.7, fy + 0.22, fy + 0.3, 6.18, 6.195, { cast: false });
    }
    // (6) back right corner: flower fridge, soil bags, stacked nursery pots
    {
      const x0 = 7.65, x1 = 8.6, z0 = 6.25, z1 = 7.02, hh = 1.95;
      bx(G, toon('#eef0f0'), x0, x1, fy, fy + hh, z0, z1, { bevel: 0.03 });
      bx(G, toon('#c9cfd2'), x0 - 0.01, x0, fy + 0.05, fy + hh - 0.05, (z0 + z1) / 2 - 0.006, (z0 + z1) / 2 + 0.006, { cast: false });
      for (let k = 0; k < 4; k++) bx(G, toon('#9aa2a8'), x0 - 0.01, x0, fy + hh - 0.5 + k * 0.08, fy + hh - 0.47 + k * 0.08, z0 + 0.08, z0 + 0.3, { cast: false });
      [(z0 + z1) / 2 - 0.06, (z0 + z1) / 2 + 0.06].forEach((z) => bx(G, toon('#9aa2a8'), x0 - 0.03, x0, fy + 0.9, fy + 1.2, z - 0.012, z + 0.012, { cast: false }));
      const bag = grp(G, 7.35, fy, 5.95, 0); bag.rotation.z = -0.12;
      bx(bag, toon('#f2efe6'), -0.09, 0.09, 0, 0.62, -0.23, 0.23, { bevel: 0.05 });
      const sl = pl(bag, new THREE.MeshBasicMaterial({ map: soilTex(), color: new THREE.Color(0.95, 0.94, 0.9) }), 0.42, 0.58, -0.095, 0.31, 0, -Math.PI / 2, 0); sl.userData.noLine = true;
      bx(G, toon('#e9e4d6'), 7.1, 7.32, fy, fy + 0.2, 5.62, 6.1, { bevel: 0.04 }); // a second bag lying flat
      for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.14, 12, 1, true), toon('#3f7a4a')); p.position.set(7.35, fy + 0.07 + k * 0.045, 5.35); G.add(p); }
      for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.18, 12, 1, true), m.clay); p.position.set(6.95, fy + 0.09 + k * 0.05, 5.55); G.add(p); }
    }
    // (7) the seed rack "たねの店", facing the door at the end of the aisle
    {
      const r = grp(G, 7.25, fy, 4.75, 0);
      [-0.32, 0.32].forEach((z) => bx(r, m.woodD, -0.04, 0.04, 0, 1.72, z - 0.03, z + 0.03));
      bx(r, m.wood, -0.03, 0.03, 0.28, 1.62, -0.3, 0.3, { bevel: 0.01 });
      const sp = pl(r, new THREE.MeshBasicMaterial({ map: seedTex(), color: new THREE.Color(0.97, 0.96, 0.93) }), 0.58, 1.3, -0.035, 0.95, 0, -Math.PI / 2, 0); sp.userData.noLine = true;
      for (let k = 0; k < 6; k++) bx(r, m.woodD, -0.12, -0.03, 0.42 + k * 0.205, 0.44 + k * 0.205, -0.3, 0.3, { cast: false });
      [-0.32, 0.32].forEach((z) => bx(r, m.woodD, -0.25, 0.25, 0, 0.04, z - 0.03, z + 0.03));
      bx(r, m.wood, -0.18, -0.03, 0.2, 0.24, -0.3, 0.3);
      for (let i = 0; i < 4; i++) smallPot(r, bins, -0.1, 0.24, -0.22 + i * 0.15, 740 + i, 0.6);
    }
    // (8) the tiered staging in the middle: three steps each side, crowded with pots
    {
      const x0 = 3.3, x1 = 6.1, zc0 = 2.7;
      const tiers = [[0.32, 0.72, 0.45], [0.58, 0.45, 0.18]]; // height, outer / inner half-width (the top board below)
      tiers.forEach(([h, o, i]) => {
        [1, -1].forEach((s) => bx(G, m.wood, x0, x1, fy + h - 0.035, fy + h, zc0 + s * i - (s > 0 ? 0 : o - i), zc0 + s * i + (s > 0 ? o - i : 0), { bevel: 0.01 }));
        for (let x = x0 + 0.04; x <= x1; x += 0.92) [1, -1].forEach((s) => bx(G, m.woodD, x - 0.022, x + 0.022, fy, fy + h - 0.03, zc0 + s * o - 0.022, zc0 + s * o + 0.022));
      });
      bx(G, m.wood, x0 - 0.02, x1 + 0.02, fy + 0.84, fy + 0.875, zc0 - 0.18, zc0 + 0.18, { bevel: 0.01 });
      for (let x = x0 + 0.04; x <= x1; x += 0.92) [1, -1].forEach((s) => bx(G, m.woodD, x - 0.022, x + 0.022, fy, fy + 0.84, zc0 + s * 0.16 - 0.022, zc0 + s * 0.16 + 0.022));
      [[0.32, 0.585], [0.58, 0.315]].forEach(([h, off]) => [1, -1].forEach((s) => pots(x0 + 0.1, x1 - 0.1, fy + h, zc0 + s * off, h < 0.4 ? 8 : 6, h < 0.4 ? 1.25 : 1.1)));
      snakePlant(G, bins, x0 + 0.35, fy + 0.875, zc0, 1.3, 751); snakePlant(G, bins, x1 - 0.4, fy + 0.875, zc0, 1.1, 752, m.clay);
      peaceLily(G, bins, (x0 + x1) / 2, fy + 0.875, zc0, 1.25, 753, m.white);
      peaceLily(G, bins, x0 + 0.2, fy + 0.32, zc0 + 0.57, 1.0, 754);
      const hs = makeHosta({ seed: 5, scale: 0.42 }); hs.position.set(x1 - 0.25, fy + 0.62, zc0 - 0.33); G.add(hs);
    }
    // (9) floor plants: fiddle-leaf fig, kentia palm, monstera, an iron plant stand, more pots
    {
      fiddleFig(G, bins, 2.25, fy, 2.15, 1.25, 77);
      const fic = makeFicusPot({ seed: 78 }); fic.position.set(7.95, fy, 5.05); fic.scale.setScalar(1.3); G.add(fic); // a rubber plant by the seed rack
      palm(G, bins, 6.75, fy, 2.65, 1.3, 61);
      monstera(G, bins, 2.25, fy, 5.45, 1.35, 41);
      const rh = makeRhapisPot({ seed: 55 }); rh.position.set(5.0, fy, 5.85); rh.scale.setScalar(1.15); G.add(rh);
      const inPot = (make, x, y, z, r, h, s, seed) => { const p = makePot({ r, h, seed }); p.group.position.set(x, y, z); G.add(p.group); const pl2 = make({ seed, scale: s }); pl2.position.set(x, y + p.soilY - 0.02, z); pl2.children.filter((c) => c.geometry && !c.geometry.attributes.color).forEach((c) => pl2.remove(c)); G.add(pl2); };
      inPot(makeTaro, 6.15, fy, 1.6, 0.22, 0.34, 0.75, 12);
      inPot(makeAspidistra, 3.05, fy, 5.75, 0.16, 0.28, 0.65, 14);
      inPot(makeFern, 1.45, fy, 5.9, 0.15, 0.24, 0.6, 9);
      // iron plant stand: three rings on a centre post
      {
        const sx = 6.55, sz = 4.0;
        cyl2(G, m.iron, [sx, fy, sz], [sx, fy + 1.3, sz], 0.015, 6, { cast: true });
        [[0.32, 0.36], [0.68, 0.27], [1.04, 0.18]].forEach(([h, r], i) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 5, 24), m.iron); ring.rotation.x = Math.PI / 2; ring.position.set(sx, fy + h, sz); G.add(ring);
          const n = [5, 4, 2][i];
          for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + i; smallPot(G, bins, sx + Math.cos(a) * r * 0.7, fy + h, sz + Math.sin(a) * r * 0.7, 760 + i * 10 + k, 0.95); }
        });
        [0, 2.09, 4.19].forEach((a) => cyl2(G, m.iron, [sx + Math.cos(a) * 0.4, fy, sz + Math.sin(a) * 0.4], [sx, fy + 0.32, sz], 0.012, 4, { cast: true }));
        for (let k = 0; k < 3; k++) { const cur = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 4, 10, Math.PI * 1.5), m.iron); cur.position.set(sx + Math.cos(k * 2.09) * 0.25, fy + 0.5, sz + Math.sin(k * 2.09) * 0.25); cur.rotation.y = k * 2.09; G.add(cur); }
      }
      // floor pots along the aisles
      [[1.55, 2.3, 1.7], [3.0, 1.55, 1.4], [5.8, 3.75, 1.5], [1.4, 4.65, 1.6], [4.2, 3.65, 1.3], [8.2, 5.2, 1.4]].forEach(([x, z, s], i) => smallPot(G, bins, x, fy, z, 780 + i, s));
    }
    // (10) hanging baskets and pots from the roof purlins
    {
      const hookY = Y + WALL + (RIDGE - WALL) / 3 - 0.02;
      [[1.5, 1], [2.9, -1], [4.3, 1], [5.6, -1], [7.0, 1], [8.3, -1], [2.2, -1], [6.3, 1], [4.9, -1], [8.1, 1]].forEach(([x, s], i) => {
        const z = zc + s * (half - 0.08) * (2 / 3);
        hangingPot(G, bins, x, hookY - 0.7 - (i % 3) * 0.12, z, hookY, 500 + i, i % 2 === 1);
      });
    }
    // (11) two enamel pendant lamps (work table, staging) + the fill light
    [[4.7, 0.75], [4.7, 2.7]].forEach(([x, z]) => {
      const yTop = Y + WALL + (RIDGE - WALL) * (1 - Math.abs(z - zc) / half) - 0.05, yl = Y + 2.35;
      cyl2(G, m.iron, [x, yTop, z], [x, yl + 0.2, z], 0.005, 3, { noLine: true });
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 16, 1, true), toon('#3f6a52', { side: THREE.DoubleSide })); sh.position.set(x, yl + 0.1, z); G.add(sh);
      sph(G, glow('#fff0d0', 2.4, { cat: 'iza' }), 0.06, x, yl + 0.02, z, 1, 1, 1);
      halo(G, x, yl, z, '#ffe2bd', 1.2, 0.35);
    });
    plight(G, '#ffdcae', 12, 12, L / 2, Y + 2.6, zc, 'florist');
  }
  bins.flush(G);
  // under the glass nothing takes snow cover (floor, tables, pots, leaves); the roof frame above the eaves still does
  noSnowBox(ORIGIN.x + 0.12, ORIGIN.z - L + 0.12, ORIGIN.x + W - 0.12, ORIGIN.z - 0.02, Y + WALL + 0.3);
  // roof surfaces for petals / leaves / snow (glass roof: thin layers), see roofPiles.js
  const [ex0] = toWorld(0, 0.08), [ex1] = toWorld(0, W - 0.08), [rx] = toWorld(0, zc);
  const zS = ORIGIN.z + 0.12, zN = ORIGIN.z - L - 0.12;
  const ribs = { axis: 'z', origin: ORIGIN.z, step: L / (bays * 2) };
  (reg.extraRoofs ||= []).push(
    { id: 'floristW', a: [rx, zS], b: [rx, zN], n: [-1, 0], D: rx - ex0, y: Y + RIDGE + 0.03, drop: RIDGE - WALL, w: { petal: 0.5, leaf: 0.5 }, snow: 0.06, ridge: true, patch: 1.6, ribs },
    { id: 'floristE', a: [rx, zN], b: [rx, zS], n: [1, 0], D: ex1 - rx, y: Y + RIDGE + 0.03, drop: RIDGE - WALL, w: { petal: 0.5, leaf: 0.5 }, snow: 0.06, ridge: true, patch: 1.6, ribs },
  );
  return { G, leaves };
}

/* ---------------------------------------------------------------- the house (world frame, front to the south) */
/** a gable roof with its ridge along x: two thick tiled slabs, fascia, bargeboards, gutters, and a gable
    prism under them, so the slopes, eaves and gable walls always meet (the slab undersides pass through
    the wall-plate line at yTop) */
function gableRoof(g, x0, x1, z0, z1, yTop, rise, ov, fillMat) {
  const zr = (z0 + z1) / 2, half = (z1 - z0) / 2, a = Math.atan2(rise, half);
  const th = 0.12, len = (half + ov) / Math.cos(a), yR = yTop + rise + th / Math.cos(a);
  const t = roofTileTex().clone(); t.needsUpdate = true; t.repeat.set((x1 - x0 + 2 * ov) / 0.3, len / 0.26);
  const roofM = toon('#ffffff', { map: t, nocache: true });
  const fascia = toon('#e8e2d4'), gutter = toon('#c3c7cc');
  [1, -1].forEach((s) => {
    const p = grp(g, 0, yR, zr, 0); p.rotation.x = s * a;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 2 * ov, th, len), roofM);
    slab.position.set((x0 + x1) / 2, -th / 2, (s * len) / 2); slab.castShadow = true; slab.receiveShadow = true; p.add(slab);
    const e0 = s > 0 ? len - 0.05 : -len, e1 = s > 0 ? len : -len + 0.05;
    bx(p, fascia, x0 - ov - 0.03, x1 + ov + 0.03, -th - 0.1, 0.005, e0, e1);
    [x0 - ov - 0.03, x1 + ov + 0.03].forEach((x) => bx(p, fascia, x - 0.035, x + 0.035, -th - 0.12, 0.02, s > 0 ? 0 : -len, s > 0 ? len : 0));
    cyl2(p, gutter, [x0 - ov, -th - 0.06, s * (len + 0.06)], [x1 + ov, -th - 0.06, s * (len + 0.06)], 0.055, 8);
  });
  bx(g, toon('#3e434a'), x0 - ov - 0.06, x1 + ov + 0.06, yR - 0.05, yR + 0.1, zr - 0.13, zr + 0.13, { bevel: 0.02 }); // ridge cap
  const sh = new THREE.Shape();
  sh.moveTo(z0, 0); sh.lineTo(z1, 0); sh.lineTo(zr, rise); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); geo.translate(x1, yTop, 0); // shape x -> world z, extrusion -> world x0..x1
  const prism = new THREE.Mesh(geo, fillMat); prism.castShadow = true; prism.receiveShadow = true; g.add(prism);
  return { yR, zr, len, a };
}

function buildHouse(g, YH, m) {
  const bins = makeBins(g);
  const H1 = 2.6, H2 = 2.4, rise = 1.15, ov = 0.45;
  const top = YH + H1 + H2;
  const xc = (HX0 + HX1) / 2;
  // plinth + walls: dark board siding on the ground floor front, cream plaster above and on the sides
  bx(g, toon('#c4bdb0'), HX0 - 0.05, HX1 + 0.05, YH - 0.4, YH + 0.35, HZ0 - 0.05, HZ1 + 0.05, { bevel: 0.03 });
  bx(g, m.plaster, HX0, HX1, YH + 0.35, top, HZ0, HZ1, { bevel: 0.03 });
  const sid = toon('#ffffff', { map: sidingTex(), nocache: true, lit: 0.05 });
  sid.map.repeat.set(3.5, 2);
  pl(g, sid, HX1 - HX0 - 0.02, H1 - 0.35, xc, YH + 0.35 + (H1 - 0.35) / 2, HZ1 + 0.008, 0, 0, { cast: false });
  bx(g, toon('#d9cfbd'), HX0 - 0.04, HX1 + 0.04, YH + H1 - 0.06, YH + H1 + 0.08, HZ0 - 0.04, HZ1 + 0.04, { bevel: 0.02 }); // floor band
  const roof = gableRoof(g, HX0, HX1, HZ0, HZ1, top, rise, ov, m.plaster);
  cy(g, toon('#c3c7cc'), HX1 - 0.12, YH, HZ1 + 0.08, 0.045, top - YH - 0.05, 8); // downpipe

  const winFront = (x0, x1, y0, y1, lattice) => {
    bx(g, m.white, x0 - 0.07, x1 + 0.07, y0 - 0.07, y1 + 0.07, HZ1, HZ1 + 0.06, { bevel: 0.015 });
    pl(g, glow('#6c7a86', 1, { cat: 'iza', off: '#5a6773' }), x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, HZ1 + 0.062, 0, 0);
    bx(g, m.white, (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0, y1, HZ1 + 0.06, HZ1 + 0.08);
    bx(g, m.white, x0 - 0.1, x1 + 0.1, y0 - 0.12, y0 - 0.07, HZ1, HZ1 + 0.14, { bevel: 0.01 }); // sill
    if (lattice) for (let x = x0 + 0.06; x < x1; x += 0.08) bx(g, toon('#7a5a3c'), x - 0.012, x + 0.012, y0, y1, HZ1 + 0.1, HZ1 + 0.13, { cast: false });
  };
  const winSide = (z0, z1, y0, y1, x, s) => {
    bx(g, m.white, x + (s < 0 ? -0.06 : 0), x + (s < 0 ? 0 : 0.06), y0 - 0.07, y1 + 0.07, z0 - 0.07, z1 + 0.07, { bevel: 0.015 });
    pl(g, glow('#6c7a86', 1, { cat: 'iza', off: '#5a6773' }), z1 - z0, y1 - y0, x + s * 0.062, (y0 + y1) / 2, (z0 + z1) / 2, s * Math.PI / 2, 0);
  };
  // ground floor: recessed genkan (left) + lattice window (right) under a small tiled pent roof
  const g0 = HX0 + 0.3, g1 = HX0 + 1.65;
  bx(g, toon('#3a2c22'), g0, g1, YH + 0.35, YH + 2.3, HZ1 - 0.02, HZ1 + 0.02); // recess shadow
  const door = toon('#8a5d3a', { lit: 0.05 });
  bx(g, door, g0 + 0.1, g1 - 0.1, YH + 0.38, YH + 2.2, HZ1 + 0.02, HZ1 + 0.06, { bevel: 0.015 });
  for (let x = g0 + 0.2; x < g1 - 0.15; x += 0.11) bx(g, toon('#6b4528'), x - 0.012, x + 0.012, YH + 0.45, YH + 2.1, HZ1 + 0.06, HZ1 + 0.085, { cast: false });
  pl(g, glow('#ffe6c0', 0.9, { cat: 'iza', off: '#c9bfae' }), 0.26, 1.45, g1 - 0.3, YH + 1.32, HZ1 + 0.065, 0, 0); // frosted side light
  bx(g, toon('#c9a24a'), g1 - 0.48, g1 - 0.44, YH + 1.12, YH + 1.38, HZ1 + 0.06, HZ1 + 0.1);
  const rm = toon('#5b6169');
  bx(g, rm, g0 - 0.3, g1 + 0.3, YH + 2.4, YH + 2.5, HZ1, HZ1 + 0.9, { bevel: 0.02 }); // entrance canopy (庇)
  [g0 - 0.12, g1 + 0.12].forEach((x) => cyl2(g, m.iron, [x, YH + 2.36, HZ1 + 0.85], [x, YH + 1.96, HZ1], 0.012, 4));
  bx(g, toon('#bfb8ab'), g0 - 0.12, g1 + 0.12, YH + 0.0, YH + 0.35, HZ1, HZ1 + 0.9, { bevel: 0.02 }); // porch
  bx(g, toon('#bfb8ab'), g0 + 0.1, g1 - 0.1, YH - 0.25, YH + 0.15, HZ1 + 0.9, HZ1 + 1.3, { bevel: 0.02 }); // step
  const lamp = glow('#ffe2b0', 2.0, { cat: 'iza' });
  bx(g, m.iron, g1 + 0.16, g1 + 0.3, YH + 1.92, YH + 2.17, HZ1, HZ1 + 0.12, { cast: false });
  bx(g, lamp, g1 + 0.18, g1 + 0.28, YH + 1.94, YH + 2.14, HZ1 + 0.12, HZ1 + 0.13, { cast: false });
  halo(g, g1 + 0.23, YH + 2.02, HZ1 + 0.3, '#ffd9a0', 1.0, 0.4);
  const np = pl(g, new THREE.MeshBasicMaterial({ map: nameplateTex() }), 0.12, 0.25, g0 - 0.16, YH + 1.6, HZ1 + 0.012, 0, 0); np.userData.noLine = true;
  winFront(HX0 + 2.2, HX1 - 0.4, YH + 0.85, YH + 2.05, true);
  bx(g, rm, HX0 + 2.0, HX1 - 0.2, YH + 2.25, YH + 2.33, HZ1, HZ1 + 0.55, { bevel: 0.02 });
  // first floor: two windows + a balcony with a slatted rail
  winFront(HX0 + 0.4, HX0 + 1.45, YH + 3.2, YH + 4.4, false);
  winFront(HX0 + 2.45, HX1 - 0.5, YH + 3.2, YH + 4.5, false);
  {
    const b0 = HX0 + 2.2, b1 = HX1 - 0.25, d = 0.8;
    bx(g, toon('#d9d3c6'), b0, b1, YH + H1 + 0.05, YH + H1 + 0.18, HZ1, HZ1 + d, { bevel: 0.02 });
    for (let x = b0 + 0.05; x <= b1; x += 0.12) bx(g, toon('#7a5a3c'), x - 0.02, x + 0.02, YH + H1 + 0.18, YH + H1 + 1.0, HZ1 + d - 0.06, HZ1 + d - 0.02, { cast: false });
    bx(g, toon('#7a5a3c'), b0, b1, YH + H1 + 0.95, YH + H1 + 1.03, HZ1 + d - 0.08, HZ1 + d, { bevel: 0.01 });
    [b0, b1].forEach((x) => bx(g, toon('#7a5a3c'), x - 0.03, x + 0.03, YH + H1 + 0.18, YH + H1 + 1.0, HZ1, HZ1 + d));
    cyl2(g, m.zinc, [b0 + 0.2, YH + H1 + 1.6, HZ1 + 0.42], [b1 - 0.2, YH + H1 + 1.6, HZ1 + 0.42], 0.015, 5); // laundry pole
    [[b0 + 0.45, '#f4f1ea'], [b0 + 0.78, '#9bb6d8'], [b0 + 1.08, '#f2c6c6']].forEach(([x, c]) => pl(g, toon(c, { side: THREE.DoubleSide }), 0.26, 0.4, x, YH + H1 + 1.38, HZ1 + 0.42, 0, 0));
    flowers(g, b1 - 0.28, YH + H1 + 0.18, HZ1 + 0.42, 'gerbera', 820, false);
  }
  // the west side (on the green strip) and the east side: windows, AC unit
  winSide(-3.3, -2.3, YH + 1.0, YH + 2.0, HX0, -1); winSide(-3.2, -2.3, YH + 3.3, YH + 4.3, HX0, -1); winSide(-0.6, 0.3, YH + 3.3, YH + 4.3, HX0, -1);
  winSide(-2.0, -0.9, YH + 1.0, YH + 2.05, HX1, 1); winSide(-2.0, -0.9, YH + 3.3, YH + 4.4, HX1, 1);
  bx(g, toon('#e8ebee'), HX1, HX1 + 0.3, YH + 0.05, YH + 0.62, -3.75, -3.1, { bevel: 0.03 });
  const fan = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), toon('#9aa2ab')); fan.rotation.y = Math.PI / 2; fan.position.set(HX1 + 0.31, YH + 0.33, -3.42); g.add(fan);

  /* front yard: block wall with a gate, post box, stepping stones, a planted bed, a small tree, a bike */
  {
    const wz = YARD_Z, wh = 1.0, gy = groundY(xc, wz);
    const bm = toon('#ffffff', { map: blockWallTex(), nocache: true }); bm.map.repeat.set(1, 1);
    const seg = (a, b) => {
      const geo2 = new THREE.BoxGeometry(b - a, wh, 0.15);
      const uv = geo2.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((b - a) / 0.8), uv.getY(i) * (wh / 0.4));
      const w = new THREE.Mesh(geo2, bm); w.position.set((a + b) / 2, gy + wh / 2, wz); w.castShadow = true; w.receiveShadow = true; g.add(w);
      bx(g, toon('#bdb5a4'), a - 0.02, b + 0.02, gy + wh, gy + wh + 0.06, wz - 0.1, wz + 0.1);
    };
    const gate0 = g0 - 0.12, gate1 = g1 + 0.12;
    seg(HX0, gate0); seg(gate1, HX1);
    // side walls back to the house
    [HX0, HX1].forEach((x) => { const geo2 = new THREE.BoxGeometry(0.15, wh * 0.85, wz - HZ1); const w = new THREE.Mesh(geo2, bm); w.position.set(x, gy + wh * 0.425, (wz + HZ1) / 2); w.castShadow = true; g.add(w); bx(g, toon('#bdb5a4'), x - 0.1, x + 0.1, gy + wh * 0.85, gy + wh * 0.85 + 0.06, HZ1, wz + 0.1); });
    [gate0, gate1].forEach((x) => bx(g, toon('#9a958c'), x - 0.14, x + 0.14, gy, gy + wh + 0.3, wz - 0.14, wz + 0.14, { bevel: 0.02 }));
    // post box + intercom + house number on the gate posts
    bx(g, toon('#3f6a52'), gate1 + 0.14, gate1 + 0.52, gy + wh - 0.42, gy + wh - 0.08, wz + 0.08, wz + 0.26, { bevel: 0.02 });
    bx(g, toon('#2e2f33'), gate0 - 0.08, gate0 + 0.08, gy + 1.0, gy + 1.18, wz + 0.14, wz + 0.17);
    const hn = canvasTex(96, 48, (c, w, h) => { c.fillStyle = '#2f4a6a'; c.fillRect(0, 0, w, h); T(c, '星空 4-12', w / 2, h / 2 + 1, 20, '#ffffff', { weight: 700 }); });
    const hp = pl(g, new THREE.MeshBasicMaterial({ map: hn }), 0.26, 0.13, gate1, gy + 1.15, wz + 0.145, 0, 0); hp.userData.noLine = true;
    // stepping stones from the gate to the porch step
    {
      // flat stepping stones (rocks.js), tops ~3 cm proud of the ground, and two small stones bedded at the bed's corner
      const B = rockBatch(g, rockMat({ moss: 0.6, tint: '#f8f4ec' }), { name: 'FloristYardRocks' });
      for (let z = wz - 0.4, i = 0; z > HZ1 + 1.4; z -= 0.52, i++) {
        const x = (g0 + g1) / 2 + (i % 2 ? 0.08 : -0.06), y = groundY(x, z), r = 0.27;
        B.add('step', i % 3, x, y, z, r, { ry: i * 1.7, sink: 0.55, sq: [1, 1, 0.82], tint: i % 2 ? '#ffffff' : '#f3ede2' });
      }
      B.add('embedded', 1, HX0 + 2.75, gy + 0.13, wz - 0.42, 0.14, { ry: 0.8, sink: 0.35 });
      B.add('pebble', 2, HX0 + 3.0, gy + 0.13, wz - 0.3, 0.06, { ry: 2.0, sink: 0.3 });
      B.flush();
    }
    // planted bed on the right with an edging, a small tree, ground plants
    const b0 = HX0 + 2.6, b1 = HX1 - 0.15, bz0 = HZ1 + 0.3, bz1 = wz - 0.15;
    bx(g, toon('#b9b3a7'), b0, b1, gy, gy + 0.18, bz0, bz0 + 0.08); bx(g, toon('#b9b3a7'), b0, b0 + 0.08, gy, gy + 0.18, bz0, bz1);
    bx(g, toon('#4a3a2c', { lit: 0.02 }), b0 + 0.08, b1, gy, gy + 0.13, bz0 + 0.08, bz1, { cast: false, bevel: 0 });
    const tr = makeTree({ seed: 31, height: 3.0, lean: 0.03, palette: 'deep', spread: 0.6 });
    tr.position.set(b1 - 0.5, gy + 0.1, bz0 + 1.2); g.add(tr);
    [[makeHosta, b0 + 0.4, bz1 - 0.4, 0.75], [makeAspidistra, b0 + 0.45, bz0 + 0.5, 0.7], [makeFern, b0 + 1.1, bz1 - 0.35, 0.55]].forEach(([mk, x, z, s], i) => { const p = mk({ seed: 60 + i * 5, scale: s }); p.position.set(x, gy + 0.12, z); g.add(p); });
    // potted plants by the door, the family bicycle in the yard
    smallPot(g, bins, g0 - 0.02, YH + 0.35, HZ1 + 0.7, 840, 1.5);
    smallPot(g, bins, g1 + 0.02, YH + 0.35, HZ1 + 0.7, 841, 1.35);
    const lift = grp(g, 0, groundY(HX0 + 2.05, 2.4) - PAV, 0);
    bicycle(lift, HX0 + 2.1, 2.45, 0.05, '#8cc4d8', 0, { type: 'basket', steer: -0.12 });
  }
  bins.flush(g);
  // the house roof also takes petals / leaves / snow
  const { yR, zr, a } = roof, Dh = (HZ1 - HZ0) / 2 + ov;
  (reg.extraRoofs ||= []).push(
    { id: 'houseS', a: [HX1 + ov, zr], b: [HX0 - ov, zr], n: [0, 1], D: Dh, y: yR, drop: Dh * Math.tan(a), w: { petal: 0.6, leaf: 0.6 }, snow: 0.15, ridge: true },
    { id: 'houseN', a: [HX0 - ov, zr], b: [HX1 + ov, zr], n: [0, -1], D: Dh, y: yR, drop: Dh * Math.tan(a), w: { petal: 0.5, leaf: 0.5 }, snow: 0.15, ridge: true },
  );
}

/* ---------------------------------------------------------------- street props: post box, wheelbarrow, bench */
function postTex() {
  return (tex.post ||= canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#e9e2cc'; roundRect(g, 3, 3, w - 6, h - 6, 8); g.fill();
    g.strokeStyle = '#3d5a4c'; g.lineWidth = 3; roundRect(g, 7, 7, w - 14, h - 14, 6); g.stroke();
    T(g, '〒 POST', w / 2, h / 2 + 2, 24, '#2f4a3e', { weight: 900 });
  }));
}
/** a retro cylinder post box in dark grey-green: plinth, body, band, domed cap with a knob, slot, door, plate */
function postBox(parent, x, z, ry = 0) {
  const p = grp(parent, x, groundY(x, z), z, ry);
  const body = toon('#3d5a4c'), dark = toon('#2c4338'), trim = toon('#4f6e5f');
  cy(p, dark, 0, 0, 0, 0.24, 0.08, 20);
  cy(p, trim, 0, 0.08, 0, 0.215, 0.06, 20);
  cy(p, body, 0, 0.14, 0, 0.19, 0.86, 20);
  cy(p, trim, 0, 0.98, 0, 0.21, 0.07, 20);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), body); cap.scale.set(1, 0.55, 1); cap.position.y = 1.05; cap.castShadow = true; p.add(cap);
  cy(p, trim, 0, 1.15, 0, 0.045, 0.05, 10); sph(p, trim, 0.05, 0, 1.23, 0);
  bx(p, toon('#1d2620'), -0.11, 0.11, 0.84, 0.875, 0.165, 0.2); // slot
  bx(p, trim, -0.13, 0.13, 0.88, 0.905, 0.15, 0.215); // slot hood
  bx(p, trim, -0.11, 0.11, 0.3, 0.6, 0.16, 0.2, { bevel: 0.01 }); // collection door
  bx(p, toon('#c9b98a'), 0.06, 0.085, 0.42, 0.48, 0.195, 0.21); // lock
  const pt = pl(p, new THREE.MeshBasicMaterial({ map: postTex() }), 0.22, 0.11, 0, 0.72, 0.193, 0, 0); pt.userData.noLine = true;
  return p;
}
/** a heap of flowers + leaves on an ellipsoid cap (wheelbarrow / planter displays) */
function flowerMound(parent, bins, cx, cy0, cz, rx, rz, h, seed) {
  // greenery first, filling the tub (the town's own hosta / fern, fitted), then a low dome of flower heads over it:
  // hydrangeas, roses and clusters of small mixed-colour flowers - no stems poking out anywhere (plants/wild.js)
  const R = rng(seed), B = sharedPlants();
  const surf = (a, t) => V(cx + rx * Math.cos(a) * Math.sin(t), cy0 + h * Math.cos(t), cz + rz * Math.sin(a) * Math.sin(t));
  [[-0.55, -0.45], [0, -0.5], [0.55, -0.45], [-0.55, 0.45], [0, 0.5], [0.55, 0.45], [-0.25, 0], [0.25, 0]].forEach(([u, w], i) => {
    const gp = (i % 3 === 1 ? makeFern : makeHosta)({ seed: seed + i, scale: 1 });
    gp.children.filter((c) => c.isMesh && !c.geometry.attributes.color).forEach((c) => gp.remove(c));
    const b = new THREE.Box3().setFromObject(gp); gp.scale.setScalar((rx * 0.95) / Math.max(0.01, b.max.x - b.min.x, b.max.z - b.min.z));
    gp.position.set(cx + u * rx, cy0 - 0.03 + (i > 5 ? h * 0.35 : 0), cz + w * rz); gp.rotation.y = R() * 6.28; parent.add(gp);
  });
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, t = Math.acos(1 - R() * 0.85), p = surf(a, t);
    const n = V((p.x - cx) / (rx * rx), (p.y - cy0) / (h * h), (p.z - cz) / (rz * rz)).normalize(), tilt = [Math.atan2(n.z, n.y) * 0.7, -Math.atan2(n.x, n.y) * 0.7];
    const k = i % 5, y = p.y - h * 0.18;
    if (k === 0) plantAt(B, parent, 'hydHead', i, p.x, y, p.z, 1.1, { ry: a, tilt });
    else if (k === 1) plantAt(B, parent, 'roseHead', i, p.x, y + 0.01, p.z, 1.2, { ry: a, tilt });
    else plantAt(B, parent, 'blooms', i, p.x, y - 0.02, p.z, 1.5, { ry: a, tilt });
  }
}
/** a wooden wheelbarrow brimming with flowers: tapered plank tub, long handles with rope wraps, legs, spoked wheel */
function wheelbarrow(parent, bins, x, z, ry, seed, sc = 1) {
  const p = grp(parent, x, groundY(x, z), z, ry);
  p.scale.setScalar(sc);
  const wood = toon('#ffffff', { map: woodTex(), side: THREE.DoubleSide, lit: 0.2, nocache: true });
  const woodD = toon('#9a6a3e', { lit: 0.15 }), rope = toon('#c9a26a');
  // tub: a square frustum stretched along x, open at the top
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * Math.SQRT2, 0.22 * Math.SQRT2, 0.36, 4, 1, true), wood);
  tub.rotation.y = Math.PI / 4; const tg = grp(p, 0.02, 0.56, 0, 0); tg.scale.set(1.32, 1, 1); tg.add(tub); tub.castShadow = true;
  bx(p, wood, -0.28, 0.32, 0.37, 0.4, -0.21, 0.21);
  // plank seams and the top rim
  [-0.21, -0.07, 0.07, 0.21].forEach((zz) => [1, -1].forEach((s) => { const zt = zz * (0.32 / 0.32), zb = zz * (0.22 / 0.32); cyl2(p, woodD, [0.02 + s * 0.42, 0.74, zt], [0.02 + s * 0.29, 0.38, zb], 0.006, 3, { noLine: true }); }));
  [[-0.42, 0.42, 0.32, 0.32], [-0.42, 0.42, -0.32, -0.32]].forEach(([a, b, za, zb]) => cyl2(p, woodD, [0.02 + a, 0.745, za], [0.02 + b, 0.745, zb], 0.018, 5));
  [0.44, -0.40].forEach((xx) => cyl2(p, woodD, [xx, 0.745, -0.33], [xx, 0.745, 0.33], 0.018, 5));
  // a rope swag round the tub
  for (let k = 0; k < 6; k++) { const a0 = -0.38 + k * 0.14; cyl2(p, rope, [a0, 0.64 - (k % 2) * 0.05, 0.305], [a0 + 0.14, 0.64 - ((k + 1) % 2) * 0.05, 0.305], 0.008, 3, { noLine: true }); }
  // handles: from the grips at the back, under the tub, to the axle
  [-0.27, 0.27].forEach((zz) => {
    const zf = zz * 0.45;
    cyl2(p, woodD, [-1.05, 0.62, zz], [-0.3, 0.38, zz * 0.85], 0.03, 6, { cast: true });
    cyl2(p, woodD, [-0.3, 0.38, zz * 0.85], [0.64, 0.24, zf], 0.028, 6, { cast: true });
    for (let k = 0; k < 4; k++) cyl2(p, rope, [-0.88 + k * 0.035, 0.585 - k * 0.011, zz], [-0.86 + k * 0.035, 0.578 - k * 0.011, zz], 0.036, 6); // grip wrap
    // legs with a rope lashing
    bx(p, woodD, -0.42, -0.36, 0, 0.44, zz * 0.85 - 0.03, zz * 0.85 + 0.03, { bevel: 0.008 });
    cyl2(p, rope, [-0.39, 0.33, zz * 0.85 - 0.04], [-0.39, 0.33, zz * 0.85 + 0.04], 0.04, 6);
  });
  cyl2(p, woodD, [-0.39, 0.12, -0.23], [-0.39, 0.12, 0.23], 0.018, 5); // leg brace
  // the wheel: rim, eight spokes, hub on an axle between the handle ends
  {
    const wx = 0.66, wy = 0.23, r = 0.22;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 22), woodD); rim.position.set(wx, wy, 0); rim.castShadow = true; p.add(rim);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cyl2(p, woodD, [wx, wy, 0], [wx + Math.cos(a) * (r - 0.02), wy + Math.sin(a) * (r - 0.02), 0], 0.011, 4); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), toon('#6b4a2c')); hub.rotation.x = Math.PI / 2; hub.position.set(wx, wy, 0); p.add(hub);
    cyl2(p, m_iron(), [wx, wy, -0.13], [wx, wy, 0.13], 0.012, 5);
  }
  bx(p, toon('#4a3a2c', { lit: 0.02 }), -0.38, 0.42, 0.7, 0.72, -0.29, 0.29, { cast: false }); // soil just under the rim
  flowerMound(p, bins, 0.04, 0.72, 0, 0.5, 0.36, 0.4, seed);
  // a couple of yellow leaves drooping over the side
  const yl = leafMat(leafTex('autumnY', { kind: 'net', base: '#e8c14a', edge: '#c99a2a', vein: '#f4dc8a', center: '#f0cf5c', veins: 5 }));
  [[0.15, 0.62, 0.31], [0.3, 0.56, 0.3], [-0.2, 0.66, 0.31]].forEach(([lx, ly, lz], i) => { const d = V(0.2 * (i - 1), -1, 0.35).normalize(); bins.add(p, yl, placeLeaf(bladeGeo({ L: 0.12, W: 0.08, segL: 4, segW: 2, width: (v) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + v)), 0.6), droop: 0.1, cup: 0.1 }), V(lx, ly, lz), d, V(0, 0, 1), 0.95)); });
  return p;
}
const m_iron = () => mats().iron;
/** a park bench after the reference model: cast-iron legs, warm two-tone slats, a three-slat back, bolt heads */
function bench(parent, x, z, ry, L = 1.5) {
  const p = grp(parent, x, groundY(x, z), z, ry);
  const iron = toon('#2f3236'), wA = toon('#b77845', { lit: 0.12 }), wB = toon('#94492c', { lit: 0.12 }), bolt = toon('#8a9097');
  [-(L / 2 - 0.22), L / 2 - 0.22].forEach((lx) => {
    bx(p, iron, lx - 0.06, lx + 0.06, 0, 0.03, -0.17, 0.17, { bevel: 0.008 }); // foot
    bx(p, iron, lx - 0.035, lx + 0.035, 0.03, 0.4, -0.04, 0.04, { bevel: 0.008 }); // column
    cyl2(p, iron, [lx, 0.03, -0.12], [lx, 0.25, -0.03], 0.018, 4); cyl2(p, iron, [lx, 0.03, 0.12], [lx, 0.25, 0.03], 0.018, 4);
    bx(p, iron, lx - 0.03, lx + 0.03, 0.38, 0.42, -0.24, 0.23, { bevel: 0.006 }); // seat bearer
    cyl2(p, iron, [lx, 0.4, -0.22], [lx, 0.9, -0.33], 0.02, 5, { cast: true }); // back post
  });
  const sl = [wA, wB, wA, wB];
  for (let k = 0; k < 4; k++) {
    const z0 = -0.23 + k * 0.118;
    bx(p, sl[k], -L / 2, L / 2, 0.42, 0.465, z0, z0 + 0.105, { bevel: 0.008 });
    [-(L / 2 - 0.22), L / 2 - 0.22].forEach((lx) => sph(p, bolt, 0.008, lx, 0.467, z0 + 0.052));
  }
  const back = grp(p, 0, 0.47, -0.29, 0); back.rotation.x = -0.2;
  [[0.04, 0.13, wA], [0.155, 0.33, wB], [0.355, 0.44, wA]].forEach(([y0, y1, w]) => {
    bx(back, w, -L / 2 - 0.02, L / 2 + 0.02, y0, y1, -0.02, 0.02, { bevel: 0.008 });
    [-(L / 2 - 0.22), L / 2 - 0.22].forEach((lx) => sph(back, bolt, 0.008, lx, (y0 + y1) / 2, 0.021));
  });
  return p;
}

/* ---------------------------------------------------------------- the side display (Hoshizora-dori) */
function shopBoardTex() {
  // the shop's own dark-green notice board: opening hours, closed day, Mother's Day, a subscription poster
  return (tex.shopBoard ||= canvasTex(300, 220, (g, w, h) => {
    g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, w, h);
    const R = rng(91);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '150,120,80' : '255,250,235'},0.12)`; g.fillRect(R() * w, R() * h, 2 + R() * 4, 2 + R() * 4); } // cork
    const paper = (x, y, ww, hh, rot, bg, draw) => { g.save(); g.translate(x + ww / 2, y + hh / 2); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-ww / 2 + 3, -hh / 2 + 3, ww, hh); g.fillStyle = bg; g.fillRect(-ww / 2, -hh / 2, ww, hh); draw(ww, hh); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -hh / 2 + 6, 4, 0, 7); g.fill(); g.restore(); };
    paper(12, 12, 132, 92, -0.03, '#fffaf0', (ww) => { T(g, '営業時間', 0, -24, 20, '#3f6a52', { weight: 800 }); T(g, '10:00 – 19:00', 0, 6, 22, '#2a2420', { weight: 800 }); T(g, '定休日 水曜', 0, 32, 17, '#7a5a3a', { weight: 700 }); });
    paper(156, 14, 130, 100, 0.04, '#ffe8ec', () => { T(g, '母の日', 0, -28, 24, '#c0396a', { weight: 900 }); T(g, 'ギフト', 0, 0, 19, '#c0396a', { weight: 800 }); T(g, 'ご予約受付中', 0, 26, 16, '#7a3a4a', { weight: 700 }); ['#ff8fa8', '#f2c14e', '#ffb3c6'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(-40 + i * 40, 42, 6, 0, 7); g.fill(); }); });
    paper(20, 116, 150, 92, 0.02, '#eef7e6', () => { T(g, '花の定期便', 0, -22, 22, '#3f6a52', { weight: 900 }); T(g, 'はじめました', 0, 6, 17, '#3f6a52', { weight: 700 }); T(g, '月1回 · 季節の花', 0, 30, 14, '#5a4a3a', { weight: 700 }); });
    paper(184, 126, 100, 82, -0.05, '#f2f6ff', () => { g.fillStyle = '#7fa65e'; g.fillRect(-2, -6, 4, 26); g.fillStyle = '#9bb6ff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i) * 12, -14 + Math.sin(i) * 9, 8, 0, 7); g.fill(); } T(g, 'あじさい入荷', 0, 30, 13, '#2e4a7a', { weight: 800 }); });
  }));
}
function shopBoardHeadTex() {
  return (tex.shopBoardHead ||= canvasTex(300, 44, (g, w, h) => {
    g.fillStyle = '#23402f'; g.fillRect(0, 0, w, h);
    T(g, 'しずく花店 おしらせ', w / 2, h / 2 + 2, 22, '#efe6cf', { weight: 800 });
  }));
}
/** along the west glass, out of the walkway (x 12.4 .. 13.8 stays clear): a white ladder shelf, crates and
    buckets, a walnut X-frame shelf, the shop's notice board, watering cans + nursery pots, a planter box,
    two wall brackets with trailing pots, the delivery bike by the kerb */
function sideDisplay(g, bins, m) {
  const xw = ORIGIN.x - 0.1; // just off the brick base
  const at = (x, z, ry = 0) => grp(g, x, groundY(x, z), z, ry);
  const trailing = (p, x, y, z, seed) => hangingPot(p, bins, x, y, z, y + 0.09, seed); // a trailing pot standing on a shelf
  const pine = toon('#e6c99a'), whiteF = toon('#f1efe8'), walnut = toon('#7a4a2c', { lit: 0.12 }), walnutL = toon('#94603a', { lit: 0.12 });

  // (1) white ladder shelf, natural pine boards (three steps, deepest at the bottom), leaning on the glass
  {
    const r = at(xw, 1.75), H = 1.45, Wd = 0.5, D = 0.62;
    [-Wd, Wd].forEach((z) => {
      bx(r, whiteF, -0.06, 0.0, 0, H, z - 0.025, z + 0.025, { bevel: 0.008 });
      cyl2(r, whiteF, [-D, 0, z], [-0.1, H, z], 0.026, 6, { cast: true });
      cy(r, m.iron, -D + 0.02, 0, z, 0.03, 0.04, 8); // casters
    });
    [[0.22, 0], [0.66, 1], [1.08, 2]].forEach(([y, k]) => {
      const xf = -D + (D - 0.1) * (y / H) - 0.02;
      for (let i = 0; i < 4; i++) { const a = xf + ((-0.02 - xf) * i) / 4; bx(r, pine, a + 0.008, a + (-0.02 - xf) / 4 - 0.008, y - 0.025, y, -Wd, Wd, { bevel: 0.006 }); }
      bx(r, whiteF, xf - 0.01, -0.02, y - 0.06, y - 0.025, -Wd, -Wd + 0.03); bx(r, whiteF, xf - 0.01, -0.02, y - 0.06, y - 0.025, Wd - 0.03, Wd);
      const mid = (xf - 0.02) / 2;
      if (k === 0) { potFlowers(r, mid, y, -0.3, 'hydrangea', 1501, 0.12); smallPot(r, bins, mid - 0.05, y, 0.0, 1502, 2.2); potFlowers(r, mid, y, 0.3, 'gerbera', 1503, 0.11); }
      if (k === 1) { smallPot(r, bins, mid, y, -0.32, 1504, 1.9); potFlowers(r, mid, y, -0.05, 'rose', 1505, 0.1); smallPot(r, bins, mid, y, 0.18, 1506, 1.8); trailing(r, mid, y, 0.38, 1507); }
      if (k === 2) { snakePlant(r, bins, mid, y, -0.3, 0.75, 1508, m.clay); potFlowers(r, mid, y, 0.0, 'lavender', 1509, 0.08); smallPot(r, bins, mid, y, 0.28, 1510, 1.6); }
    });
  }
  // (2) crates, a seedling tray and zinc buckets of cut flowers
  {
    const c = at(xw - 0.3, 0.72, -Math.PI / 2); // labels to the street
    crate(c, 0, 0, 0, 0.55, 0.42, 0.28); crate(c, 0.02, 0.28, 0.02, 0.5, 0.4, 0.22);
    const tr = at(xw - 0.3, 0.72);
    bx(tr, toon('#2e3330'), -0.2, 0.2, 0.5, 0.55, -0.24, 0.24, { bevel: 0.01 }); // garden tray on the top crate
    for (let i = 0; i < 6; i++) smallPot(tr, bins, -0.1 + (i % 2) * 0.2, 0.55, -0.16 + (i >> 1) * 0.16, 1520 + i, 0.55);
    flowers(g, xw - 0.85, groundY(13.6, 0.95), 0.95, 'sunflower', 1530);
    flowers(g, xw - 0.82, groundY(13.6, 0.55), 0.5, 'hydrangea', 1531);
  }
  // (3) walnut X-frame shelf, two slatted tiers (after the reference photo)
  {
    const r = at(xw, -0.4), Wd = 0.66, D = 0.46, top = 0.82, low = 0.16;
    [-Wd, Wd].forEach((z) => {
      cyl2(r, walnut, [-D, 0, z], [-0.03, top + 0.03, z], 0.028, 6, { cast: true });
      cyl2(r, walnut, [-0.03, 0, z], [-D, top + 0.03, z], 0.028, 6, { cast: true });
      sph(r, m.brass, 0.018, -D / 2 - 0.015, top / 2 + 0.015, z + 0.03);
    });
    [top, low].forEach((y) => {
      for (let i = 0; i < 6; i++) { const a = -D + 0.02 + (i * (D - 0.04)) / 6; bx(r, walnutL, a + 0.006, a + (D - 0.04) / 6 - 0.006, y - 0.025, y, -Wd - 0.04, Wd + 0.04, { bevel: 0.005 }); }
      bx(r, walnut, -D - 0.01, -0.02, y - 0.06, y - 0.025, -Wd - 0.04, -Wd + 0.0); bx(r, walnut, -D - 0.01, -0.02, y - 0.06, y - 0.025, Wd, Wd + 0.04);
    });
    // top: a white tin of small pink flowers, a woven basket of herbs with a tiny label, a pot of yellow roses
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.22, 16), toon('#f2efe6')); tin.position.set(-D / 2, top + 0.11, -0.42); r.add(tin);
    flowers(r, -D / 2, top + 0.2, -0.42, 'gerbera', 1540, false);
    bx(r, toon('#b98a52'), -D / 2 - 0.12, -D / 2 + 0.12, top, top + 0.16, -0.18, 0.2, { bevel: 0.02 });
    const herb = toon('#5f9a4a');
    for (let i = 0; i < 22; i++) { const zz = -0.14 + (i % 11) * 0.03, xx = -D / 2 - 0.07 + (i >> 4) * 0.05 + (i % 3) * 0.04; cyl2(r, herb, [xx, top + 0.14, zz], [xx + (i % 2 ? 0.02 : -0.02), top + 0.36 + (i % 4) * 0.03, zz + 0.01], 0.008, 3, { noLine: true }); }
    bx(r, toon('#f6f0e2'), -D / 2 - 0.125, -D / 2 - 0.12, top + 0.04, top + 0.12, -0.08, 0.1, { cast: false }); // label
    potFlowers(r, -D / 2, top, 0.45, 'sunflower', 1541, 0.1);
    // bottom: a small monstera, white tulips in a green vase, a cactus
    monstera(r, bins, -D / 2, low, -0.38, 0.62, 1542);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.24, 8), toon('#7fae86')); vase.position.set(-D / 2, low + 0.12, 0.08); r.add(vase);
    flowers(r, -D / 2, low + 0.18, 0.08, 'rose', 1543, false);
    snakePlant(r, bins, -D / 2, low, 0.45, 0.6, 1544, m.clay);
  }
  // (4) the shop's dark-green notice board facing the street, under a little roof
  {
    const nb = at(xw - 0.22, -1.85, -Math.PI / 2);
    const dg = toon('#2f5240');
    [-0.56, 0.56].forEach((x) => bx(nb, dg, x - 0.04, x + 0.04, 0, 1.8, -0.04, 0.04));
    bx(nb, dg, -0.64, 0.64, 0.82, 1.7, -0.05, 0.03, { bevel: 0.015 });
    const bp = pl(nb, new THREE.MeshBasicMaterial({ map: shopBoardTex(), color: new THREE.Color(0.95, 0.95, 0.92) }), 1.14, 0.7, 0, 1.22, 0.035, 0, 0); bp.userData.noLine = true;
    const bh = pl(nb, new THREE.MeshBasicMaterial({ map: shopBoardHeadTex() }), 1.14, 0.12, 0, 1.635, 0.036, 0, 0); bh.userData.noLine = true;
    const rf = grp(nb, 0, 1.8, 0, 0); rf.rotation.x = 0.25;
    bx(rf, dg, -0.74, 0.74, 0, 0.05, -0.26, 0.2, { bevel: 0.02 });
    bx(nb, dg, -0.62, 0.62, 0.84, 0.87, 0.03, 0.08); // ledge
    bx(nb, toon('#f2efe6'), -0.4, -0.2, 0.87, 0.9, 0.04, 0.07); // a stack of leaflets
  }
  // (5) watering cans, a bucket, stacked nursery pots, a bag of soil
  {
    const can = (x, z, ry, mat) => { const wc = at(x, z, ry); cy(wc, mat, 0, 0, 0, 0.11, 0.24, 12); cyl2(wc, mat, [0.08, 0.14, 0], [0.32, 0.32, 0], 0.015, 5); cyl2(wc, mat, [-0.1, 0.24, 0], [-0.1, 0.34, 0], 0.012, 4); cyl2(wc, mat, [-0.1, 0.34, 0], [0.06, 0.26, 0], 0.012, 4); };
    can(13.95, -2.75, 0.7, m.zinc); can(13.75, -3.05, -0.4, toon('#3f7a5a'));
    const b = at(14.2, -3.15); cy(b, m.zinc, 0, 0, 0, 0.15, 0.3, 14); cy(b, toon('#6a8fae'), 0, 0.22, 0, 0.13, 0.04, 14, { cast: false }); // a bucket of water
    for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.14, 12, 1, true), m.clay); p.position.set(14.25, groundY(14.25, -2.55) + 0.07 + k * 0.045, -2.55); g.add(p); }
    const bag = at(14.25, -3.6, 0); bag.rotation.z = 0.1;
    bx(bag, toon('#f2efe6'), -0.08, 0.08, 0, 0.55, -0.2, 0.2, { bevel: 0.05 });
    const sl = pl(bag, new THREE.MeshBasicMaterial({ map: soilTex(), color: new THREE.Color(0.95, 0.94, 0.9) }), 0.36, 0.5, -0.085, 0.28, 0, -Math.PI / 2, 0); sl.userData.noLine = true;
  }
  // (6) a planter box further back, the delivery bike parked by the kerb
  {
    const x0 = xw - 0.3, z0 = -4.1, z1 = -6.3, gy = groundY(x0, (z0 + z1) / 2);
    bx(g, m.wood, x0, x0 + 0.28, gy, gy + 0.34, z1, z0, { bevel: 0.015 });
    ['gerbera', 'rose', 'lavender', 'gerbera', 'hydrangea'].forEach((kd, i) => flowers(g, x0 + 0.14, gy + 0.34, z0 - 0.22 - i * 0.44, kd, 1560 + i, false));
    const lift = grp(g, 0, groundY(12.8, -4.9) - PAV, 0);
    bicycle(lift, 13.75, -4.9, 0.04, '#e9e2cf', 0, { type: 'basket', steer: 0.15, case: '#d6cdb6' });
  }
  // (7) wall brackets on the frame posts with trailing pots above the shelves
  [[0.95, 1600], [-1.0, 1601]].forEach(([z, seed]) => {
    const y = groundY(xw, z) + 2.25;
    cyl2(g, m.iron, [ORIGIN.x - 0.02, y, z], [ORIGIN.x - 0.42, y, z], 0.012, 4);
    cyl2(g, m.iron, [ORIGIN.x - 0.02, y - 0.25, z], [ORIGIN.x - 0.3, y, z], 0.01, 4);
    hangingPot(g, bins, ORIGIN.x - 0.38, y - 0.55, z, y, seed);
  });
}

/* ---------------------------------------------------------------- the whole corner */
export function buildFlorist(parent) {
  const m = mats();
  const g = grp(parent);
  g.name = 'florist';
  const bins = makeBins(g);
  // floor levels: the highest ground under each footprint (the block rises a little towards the north)
  const fp = (pts) => Math.max(...pts.map(([x, z]) => groundY(x, z)));
  const [wx1, wz1] = toWorld(L, W);
  const Y = fp([[ORIGIN.x, ORIGIN.z], [wx1, ORIGIN.z], [ORIGIN.x, wz1], [wx1, wz1]]) + 0.12;
  const YH = fp([[HX0, HZ0], [HX1, HZ0], [HX0, HZ1], [HX1, HZ1]]) + 0.1;
  const gh = buildGreenhouse(g, Y, m);
  buildHouse(g, YH, m);
  const yS = groundY(18, 3.4); // forecourt + sidewalk level
  const dx0 = ORIGIN.x + W / 2 - DOOR, dx1 = ORIGIN.x + W / 2 + DOOR; // door span in world x
  const fz = ORIGIN.z; // the greenhouse front

  /* ---- the forecourt (z 2.6 .. 4.0): displays either side of the door, kept clear in front of it ---- */
  {
    // left of the door: flower cart, bouquet buckets on a crate, a tall lavender planter by the step
    {
      wheelbarrow(g, bins, ORIGIN.x + 0.95, fz + 0.7, 0, 980, 0.9); // handles to the corner, wheel towards the door
      // wrapped bouquets (kraft cones) in two buckets, a lavender planter and a pot by the step
      const kraft = m.kraft;
      [[dx0 - 0.85, fz + 0.3, 'sunflower'], [dx0 - 0.55, fz + 0.48, 'rose']].forEach(([x, z, kd], i) => {
        flowers(g, x, yS, z, kd, 1300 + i);
        for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 8, 1, true), kraft); cn.rotation.x = Math.PI; cn.position.set(x + (k - 1) * 0.07, yS + 0.42, z + (k % 2) * 0.05); cn.castShadow = true; g.add(cn); }
      });
      potFlowers(g, dx0 - 0.45, yS, fz + 1.0, 'lavender', 1310, 0.15);
      smallPot(g, bins, dx0 - 0.12, yS, fz + 1.12, 1311, 1.3);
    }
    // right of the door: pots on the step side, the WELCOME easel, the chalkboard, a tiered flower stand
    {
      smallPot(g, bins, dx1 + 0.3, yS, fz + 0.78, 1312, 1.6);
      potFlowers(g, dx1 + 0.32, yS, fz + 0.3, 'hydrangea', 1313, 0.16);
      const e = grp(g, dx1 + 0.8, yS, fz + 0.4, -0.12);
      cyl2(e, m.woodD, [-0.18, 0, -0.08], [0, 1.0, 0], 0.015, 4); cyl2(e, m.woodD, [0.18, 0, -0.08], [0, 1.0, 0], 0.015, 4); cyl2(e, m.woodD, [0, 0, -0.3], [0, 0.95, -0.02], 0.012, 4);
      const wp = pl(e, new THREE.MeshBasicMaterial({ map: welcomeTex() }), 0.42, 0.33, 0, 0.72, 0.03, 0, 0); wp.userData.noLine = true;
      bx(e, m.woodD, -0.22, 0.22, 0.52, 0.55, -0.02, 0.06);
      // chalkboard A-frame, turned to the street (both faces painted)
      const a = grp(g, dx1 + 1.25, yS, fz + 1.02, -0.18);
      const lean = 0.2;
      [1, -1].forEach((s) => {
        const side = grp(a, 0, 0, s * 0.13, 0); side.rotation.x = -s * lean; // the two boards meet at the top
        bx(side, m.woodD, -0.34, 0.34, 0, 0.05, -0.02, 0.02); bx(side, m.woodD, -0.34, 0.34, 1.0, 1.05, -0.02, 0.02);
        bx(side, m.woodD, -0.34, -0.3, 0, 1.05, -0.025, 0.025); bx(side, m.woodD, 0.3, 0.34, 0, 1.05, -0.025, 0.025);
        const p = pl(side, new THREE.MeshBasicMaterial({ map: chalkTex(), color: new THREE.Color(0.95, 0.95, 0.92) }), 0.58, 0.88, 0, 0.53, s * 0.028, s > 0 ? 0 : Math.PI, 0); p.userData.noLine = true;
      });
      // tiered flower stand against the glass
      const st = grp(g, ORIGIN.x + W - 0.65, yS, fz + 0.14, 0);
      [[0, 0.25, 0.42], [1, 0.52, 0.26], [2, 0.8, 0.1]].forEach(([k, h, z]) => bx(st, m.wood, -0.6, 0.6, h - 0.04, h, z - 0.14, z + 0.14, { bevel: 0.01 }));
      [-0.58, 0.58].forEach((x) => { cyl2(st, m.woodD, [x, 0, 0.55], [x, 0.84, 0.02], 0.02, 4); cyl2(st, m.woodD, [x, 0, -0.05], [x, 0.84, 0.0], 0.02, 4); });
      let sd = 1200;
      for (let i = 0; i < 4; i++) smallPot(st, bins, -0.45 + i * 0.3, 0.25, 0.42, sd++, 1.2);
      ['hydrangea', 'gerbera', 'rose'].forEach((k, i) => flowers(st, -0.38 + i * 0.38, 0.52, 0.26, k, 1250 + i, false));
      for (let i = 0; i < 3; i++) smallPot(st, bins, -0.35 + i * 0.35, 0.8, 0.1, sd++, 1.0);
    }
    // the corner (x 12 .. 14.6): a bench facing the street, the red post box, planters along the west glass
    {
      postBox(g, ORIGIN.x - 0.32, fz + 0.32, 0); // tucked into the building's corner
      // the Hoshizora-dori side: a lived-in outdoor display along the west glass (see sideDisplay)
      sideDisplay(g, bins, m);
    }
  }

  /* ---- the green strip between the shop and the house: two trees, shrubs, low planting, the notice board ---- */
  {
    const x0 = ORIGIN.x + W + 0.12, x1 = HX0 - 0.12, z0 = ORIGIN.z - L - 0.1, z1 = fz + 0.1;
    const gyB = groundY((x0 + x1) / 2, fz);
    // stone edging round a soil bed (follows the gentle slope towards the north)
    const ed = toon('#b9b3a7');
    bx(g, ed, x0, x1, gyB - 0.05, gyB + 0.16, z1 - 0.08, z1);
    for (let z = z1; z > z0 + 0.01; z -= 1.0) { const za = Math.max(z0, z - 1.0), y = groundY(x0, za); bx(g, ed, x0, x0 + 0.08, y - 0.05, y + 0.16, za, z); bx(g, ed, x1 - 0.08, x1, y - 0.05, y + 0.16, za, z); }
    for (let z = z1 - 0.08; z > z0 + 0.01; z -= 1.0) { const za = Math.max(z0, z - 1.0), y = groundY((x0 + x1) / 2, (z + za) / 2); bx(g, toon('#3d3226', { lit: 0.02 }), x0 + 0.08, x1 - 0.08, y - 0.04, y + 0.11, za, z, { cast: false, bevel: 0 }); }
    const soil = (x, z) => groundY(x, z) + 0.1;
    // small garden stones and a little warm-grey gravel along the bed's edges, clear of the trees and plants
    {
      const keep = [[23.1, 0.4, 0.5], [23.0, -4.6, 0.5], [22.6, -1.6, 0.6], [23.5, -2.6, 0.5], [22.7, -6.0, 0.55], [23.6, 1.8, 0.45], [22.4, 1.9, 0.3], [24.0, -0.6, 0.3], [22.45, -3.3, 0.3], [23.9, -5.4, 0.3], [22.5, 0.6, 0.25], [23.95, -3.6, 0.25]];
      const B = rockBatch(g, rockMat({ moss: 0.7, tint: '#f8f3ea' }), { name: 'FloristBedRocks' });
      scatterRocks(B, {
        seed: 4800, clusters: 4, per: [0, 1], pebbles: [2, 4], singles: 2,
        at: (R) => [R() < 0.5 ? x0 + 0.24 + R() * 0.12 : x1 - 0.24 - R() * 0.12, z0 + 0.3 + R() * (z1 - z0 - 0.6)],
        ok: (x, z, r) => x - r > x0 + 0.1 && x + r < x1 - 0.1 && z - r > z0 + 0.12 && z + r < z1 - 0.12 && keep.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r),
        ground: soil, lead: { embedded: 2, medium: 1, flat: 1 }, kinds: { embedded: 1, flat: 1 },
        size: [0.13, 0.2], sizeS: [0.07, 0.11], sink: [0.25, 0.4], tilt: 0.08, moss: 0.3, tints: ['#ffffff', '#f4ece0'],
      });
      B.flush();
    }
    const t1 = makeTree({ seed: 47, height: 5.4, lean: 0.04, palette: 'deep', spread: 0.85 }); t1.position.set(23.1, soil(23.1, 0.4), 0.4); g.add(t1);
    const t2 = makeTree({ seed: 52, height: 4.4, lean: -0.03, palette: 'deep', spread: 0.7 }); t2.position.set(23.0, soil(23.0, -4.6), -4.6); g.add(t2);
    [[22.6, -1.6, 1.3, 0.85, 3], [23.5, -2.6, 1.1, 0.75, 4], [22.7, -6.0, 1.2, 0.8, 6], [23.6, 1.8, 0.9, 0.6, 8]].forEach(([x, z, w, h, s]) => { const sb = makeShrub({ seed: s, width: w, height: h, palette: 'deep' }); sb.position.set(x, soil(x, z), z); g.add(sb); });
    [[makeHosta, 22.4, 1.9, 0.75], [makeFern, 24.0, -0.6, 0.65], [makeAspidistra, 22.45, -3.3, 0.7], [makeHosta, 23.9, -5.4, 0.7], [makeFern, 22.5, 0.6, 0.55], [makeTaro, 23.95, -3.6, 0.55]].forEach(([mk, x, z, s], i) => { const p = mk({ seed: 90 + i * 7, scale: s }); p.position.set(x, soil(x, z), z); g.add(p); });
    // the community notice board at the front of the strip, under its own little roof
    const nb = grp(g, 22.95, groundY(22.95, fz + 0.45), fz + 0.45, 0);
    [-0.6, 0.6].forEach((x) => bx(nb, m.green, x - 0.045, x + 0.045, 0, 1.85, -0.045, 0.045));
    bx(nb, m.green, -0.68, 0.68, 0.88, 1.7, -0.05, 0.03, { bevel: 0.015 });
    const bp = pl(nb, new THREE.MeshBasicMaterial({ map: boardTex(), color: new THREE.Color(0.95, 0.95, 0.92) }), 1.2, 0.68, 0, 1.25, 0.035, 0, 0); bp.userData.noLine = true;
    const bh = pl(nb, new THREE.MeshBasicMaterial({ map: boardHeadTex() }), 1.2, 0.12, 0, 1.64, 0.036, 0, 0); bh.userData.noLine = true;
    bx(nb, toon('#2f5240'), -0.66, 0.66, 0.9, 0.93, 0.03, 0.08); // chalk ledge
    const rf = grp(nb, 0, 1.86, 0, 0); rf.rotation.x = 0.25;
    bx(rf, m.green, -0.8, 0.8, 0, 0.05, -0.3, 0.22, { bevel: 0.02 });
    bx(nb, toon('#2f5240'), -0.8, 0.8, 1.86, 1.94, -0.06, 0.04);
  }
  bench(g, ORIGIN.x + W - 0.5, fz + 1.15, 0, 1.3); // in front of the tiered flower stand, right of the door

  /* ---- the sidewalk fences along both kerbs + the tactile paving: town/roadside.js ---- */

  bins.flush(g);
  g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });

  /* ---- the doors: same logic as the bakery's (doors.js): open only while the camera is at the door or inside ---- */
  const ex = ORIGIN.x + W / 2, ez = ORIGIN.z;
  const entrance = new THREE.Vector3(ex, Y + 1, ez);
  const inside = (p, pad = 0) => p.x > ORIGIN.x - pad && p.x < ORIGIN.x + W + pad && p.z < ORIGIN.z + pad && p.z > ORIGIN.z - L - pad;
  const door = swingDoors({ leaves: gh.leaves, entrance, inside, angle: 1.45, hit: doorHit(g, DOOR * 2, 2.2, ex, Y + 1.12, ez - 0.02) });
  // zooming into the shop: the orbit may come closer than usual while the target is inside (main.js)
  (reg.closeZones ||= []).push((p) => inside(p, 1.2));
  // camera views for the UI button: in front of the doors, then inside down the aisle
  const tgtF = new THREE.Vector3(ex, Y + 1.2, ez - 2.2), tgtI = new THREE.Vector3(ex + 0.4, Y + 1.05, ez - 6.2);
  reg.florist = {
    Y, YH, ridge: Y + RIDGE, door, entrance,
    views: {
      front: { t: tgtF, s: new THREE.Spherical(9.5, THREE.MathUtils.degToRad(74), 0.12) },
      inside: { t: tgtI, s: new THREE.Spherical(5.6, THREE.MathUtils.degToRad(72), 0.0) },
    },
  };
  return g;
}
