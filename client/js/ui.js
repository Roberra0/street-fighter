// ui.js — HUD: health bars, timer, round counter, message overlay

const GW = 640;
const GH = 360;

export const BUILD = '2026-03-24 22:29 PST v8';

// titleBlink is render-side state — lives in ui.js module scope
let titleBlink = 0;

// Title-screen menu state
const MENU_ITEMS = ['1 PLAYER', '2 PLAYER'];
let menuIndex = 1; // default: 2P

// Returns the currently highlighted menu option index (0 = 1P, 1 = 2P).
export function getTitleMenuIndex() { return menuIndex; }

// Move the menu cursor up or down (called from game.js using input.isMenuUp/Down).
export function menuUp()   { if (menuIndex > 0)                    menuIndex--; }
export function menuDown() { if (menuIndex < MENU_ITEMS.length - 1) menuIndex++; }

// drawHUD reads all its data from the sim state passed in.
// This keeps ui.js free of global references.
export function drawHUD(ctx, { p1, p2, p1Wins, p2Wins, roundTimer, roundNum }) {
  const bW = 170, bH = 12, bY = 14;
  const mW = 170, mH = 6;  // super meter bar dimensions
  const mY = bY + bH + 6;  // positioned below health bar + 6px gap

  // P1 health bar
  ctx.fillStyle = '#181818';
  ctx.fillRect(18, bY - 1, bW + 2, bH + 2);
  ctx.fillStyle = '#440000';
  ctx.fillRect(19, bY, bW, bH);
  const w1 = Math.max(0, (p1.hp / p1.def.stats.hp) * bW);
  ctx.fillStyle = p1.hp / p1.def.stats.hp > 0.5 ? '#3c3' : p1.hp / p1.def.stats.hp > 0.25 ? '#cc3' : '#c33';
  ctx.fillRect(19, bY, w1, bH);
  ctx.fillStyle = '#fff3';
  ctx.fillRect(19, bY, w1, 3);

  // P2 health bar
  ctx.fillStyle = '#181818';
  ctx.fillRect(GW - 20 - bW, bY - 1, bW + 2, bH + 2);
  ctx.fillStyle = '#440000';
  ctx.fillRect(GW - 19 - bW, bY, bW, bH);
  const w2 = Math.max(0, (p2.hp / p2.def.stats.hp) * bW);
  ctx.fillStyle = p2.hp / p2.def.stats.hp > 0.5 ? '#3c3' : p2.hp / p2.def.stats.hp > 0.25 ? '#cc3' : '#c33';
  ctx.fillRect(GW - 19 - bW + (bW - w2), bY, w2, bH);
  ctx.fillStyle = '#fff3';
  ctx.fillRect(GW - 19 - bW + (bW - w2), bY, w2, 3);

  // Character name labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(p1.def.displayName, 19, bY - 3);
  ctx.textAlign = 'right';
  ctx.fillText(p2.def.displayName, GW - 19, bY - 3);

  // P1 super meter bar
  ctx.fillStyle = '#181818';
  ctx.fillRect(18, mY - 1, mW + 2, mH + 2);
  ctx.fillStyle = '#2a2000';
  ctx.fillRect(19, mY, mW, mH);
  const m1 = Math.max(0, (p1.meter / 100) * mW);
  const p1Full = p1.meter >= 100;
  ctx.fillStyle = p1Full
    ? (Math.floor(Date.now() / 200) % 2 === 0 ? '#ffe040' : '#ffaa00')
    : '#cc9900';
  ctx.fillRect(19, mY, m1, mH);
  if (m1 > 0) {
    ctx.fillStyle = '#fff4';
    ctx.fillRect(19, mY, m1, 2);
  }

  // P2 super meter bar (right-aligned, fills left from right edge)
  ctx.fillStyle = '#181818';
  ctx.fillRect(GW - 20 - mW, mY - 1, mW + 2, mH + 2);
  ctx.fillStyle = '#2a2000';
  ctx.fillRect(GW - 19 - mW, mY, mW, mH);
  const m2 = Math.max(0, (p2.meter / 100) * mW);
  const p2Full = p2.meter >= 100;
  ctx.fillStyle = p2Full
    ? (Math.floor(Date.now() / 200) % 2 === 0 ? '#ffe040' : '#ffaa00')
    : '#cc9900';
  ctx.fillRect(GW - 19 - mW + (mW - m2), mY, m2, mH);
  if (m2 > 0) {
    ctx.fillStyle = '#fff4';
    ctx.fillRect(GW - 19 - mW + (mW - m2), mY, m2, 2);
  }

  // "SUPER READY" label + activation hint when meter is full
  if (p1Full) {
    ctx.fillStyle = '#ffe040';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('★ PRESS A', 19, mY + mH + 8);
  }
  if (p2Full) {
    ctx.fillStyle = '#ffe040';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('PRESS A ★', GW - 19, mY + mH + 8);
  }

  // Win dots — shifted down to clear super meter
  const dotY = mY + mH + 14;
  for (let i = 0; i < p1Wins; i++) {
    ctx.fillStyle = '#fc5';
    ctx.fillRect(20 + i * 12, dotY, 7, 7);
  }
  for (let i = 0; i < p2Wins; i++) {
    ctx.fillStyle = '#fc5';
    ctx.fillRect(GW - 27 - i * 12, dotY, 7, 7);
  }

  // Round timer
  ctx.fillStyle = '#181818';
  ctx.fillRect(GW / 2 - 16, bY - 4, 32, 22);
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.ceil(roundTimer)).padStart(2, '0'), GW / 2, bY + 14);

  // Round number
  ctx.fillStyle = '#888';
  ctx.font = '7px monospace';
  ctx.fillText('ROUND ' + roundNum, GW / 2, bY + 26);
}

export function drawMessage(ctx, msgText) {
  if (!msgText) return;
  ctx.fillStyle = '#00000099';
  ctx.fillRect(0, GH / 2 - 22, GW, 44);
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msgText, GW / 2, GH / 2);
  ctx.textBaseline = 'alphabetic';
}

export function drawTitle(ctx, drawBG, renderTime) {
  drawBG(renderTime);
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, GW, GH);

  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STREET BRAWL', GW / 2, 78);

  ctx.fillStyle = '#cc8800';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('RYU  ·  TRUMP  ·  OBAMA  ·  NENE  ·  LAKER', GW / 2, 96);

  ctx.fillStyle = '#555';
  ctx.font = '8px monospace';
  ctx.fillText('build ' + BUILD, GW / 2, 108);

  ctx.fillStyle = '#bbb';
  ctx.font = '10px monospace';
  ctx.fillText('P1:  Arrows move  |  A/S punch  |  Z/X kick  |  C block', GW / 2, 118);
  ctx.fillText('P2:  WASD move  |  J/K punch  |  U/I kick  |  L block', GW / 2, 133);

  // Menu items
  titleBlink += 0.04;
  MENU_ITEMS.forEach((label, i) => {
    const y = 170 + i * 28;
    const selected = i === menuIndex;
    if (selected) {
      ctx.fillStyle = '#fc5';
      ctx.font = 'bold 16px monospace';
      // Blinking cursor
      ctx.globalAlpha = 0.5 + Math.sin(titleBlink * 3) * 0.5;
      ctx.fillText('> ' + label + ' <', GW / 2, y);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(label, GW / 2, y);
    }
  });

  ctx.fillStyle = '#555';
  ctx.font = '9px monospace';
  ctx.fillText('UP / DOWN  to select    ENTER to confirm', GW / 2, 240);
}

export function drawPauseOverlay(ctx) {
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, GW, GH);
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', GW / 2, GH / 2 - 10);
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.fillText('P  to resume        ESC  to quit to menu', GW / 2, GH / 2 + 16);
  ctx.textBaseline = 'alphabetic';
}

export function drawControlsOverlay(ctx, p1Def, p2Def) {
  // Semi-transparent panel
  ctx.fillStyle = '#000000cc';
  ctx.fillRect(10, 10, GW - 20, GH - 20);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, GW - 20, GH - 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('CONTROLS  (TAB to close)', GW / 2, 28);

  // Column headers
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('P1  —  ' + (p1Def?.displayName || 'P1'), 22, 44);
  ctx.textAlign = 'right';
  ctx.fillText('P2  —  ' + (p2Def?.displayName || 'P2'), GW - 22, 44);

  const col1 = [
    ['Move',  '← → ↑ ↓'],
    ['Punch', 'Z'],
    ['Kick',  'X'],
    ['Block', 'C  or  hold ← (back)'],
    ['Dash',  '← ←  or  → →'],
  ];
  const col2 = [
    ['Move',  'W A S D'],
    ['Punch', 'J'],
    ['Kick',  'K'],
    ['Block', 'L  or  hold A (back)'],
    ['Dash',  'A A  or  D D'],
  ];

  ctx.font = '8px monospace';
  col1.forEach(([label, key], i) => {
    const y = 60 + i * 13;
    ctx.fillStyle = '#888';
    ctx.textAlign = 'left';
    ctx.fillText(label, 22, y);
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'left';
    ctx.fillText(key, 80, y);
  });
  col2.forEach(([label, key], i) => {
    const y = 60 + i * 13;
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText(label, GW - 80, y);
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'right';
    ctx.fillText(key, GW - 22, y);
  });

  // Special moves section
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SPECIAL MOVES', GW / 2, 150);

  const specRows = [
    ['Fireball  (Ryu)',        'QCF + Punch',   '↓ ↘ →  A'],
    ['Dragon Punch  (Ryu)',    'DP + Punch',     '→ ↓ ↘  A'],
    ['Hurricane Kick  (Ryu)', 'QCB + Kick',     '↓ ↙ ←  Z'],
    ['Wall Builder  (Trump)', 'QCF + Punch',    '↓ ↘ →  A'],
    ['Power Walk  (Trump)',   'FF + Kick',      '→ →  Z'],
    ['Filibuster  (Obama)',   'QCF + Kick',     '↓ ↘ →  Z'],
    ['Hope Dash  (Obama)',    'FF + Punch',     '→ →  A'],
    ['Wine Toss  (NeNe)',     'QCF + Punch',    '↓ ↘ →  A'],
    ['Hair Pull  (NeNe)',     'FF + Kick',      '→ →  Z'],
  ];

  ctx.font = '7px monospace';
  specRows.forEach(([name, motion, keys], i) => {
    const y = 162 + i * 11;
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.fillText(name, 22, y);
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText(motion, GW / 2, y);
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'right';
    ctx.fillText(keys, GW - 22, y);
  });

  ctx.fillStyle = '#555';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SUPER: Press A when meter is full', GW / 2, GH - 18);
}

// Character select screen
const CHAR_DEFS = [
  { id: 'ryu',   name: 'RYU',   color: '#2244aa', accent: '#4488ff' },
  { id: 'trump', name: 'TRUMP', color: '#8b0000', accent: '#ffcc00' },
  { id: 'obama', name: 'OBAMA', color: '#1a3a1a', accent: '#44cc44' },
  { id: 'nene',  name: 'NENE',  color: '#880044', accent: '#ff69b4' },
  { id: 'laker',          name: 'LAKER',  color: '#552583', accent: '#FDB927' },
  { id: 'lady_kickboxer', name: 'LADY K', color: '#2a2aaa', accent: '#ee2222' },
  { id: 'dread',    name: 'DREAD',    color: '#1a3a1a', accent: '#cc8800' },
  { id: 'skater',   name: 'SKATER',   color: '#2a2a2a', accent: '#ff4400' },
  { id: 'tech_bro', name: 'TECH BRO', color: '#2c3e50', accent: '#3498db' },
];

export function drawCharSelect(ctx, drawBG, renderTime, { p1SelIdx, p2SelIdx, p1Confirmed, p2Confirmed, gameMode }) {
  drawBG(renderTime);
  ctx.fillStyle = '#000000cc';
  ctx.fillRect(0, 0, GW, GH);

  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SELECT YOUR FIGHTER', GW / 2, 22);

  const gap   = 8;
  const boxW  = Math.min(88, Math.floor((GW - 16 - gap * (CHAR_DEFS.length - 1)) / CHAR_DEFS.length));
  const boxH  = 80;
  const totalW = CHAR_DEFS.length * boxW + (CHAR_DEFS.length - 1) * gap;
  const startX = (GW - totalW) / 2;
  const boxY  = 38;

  CHAR_DEFS.forEach((ch, i) => {
    const bx = startX + i * (boxW + gap);

    // Box background
    ctx.fillStyle = ch.color;
    ctx.fillRect(bx, boxY, boxW, boxH);

    // P1 selection border
    if (i === p1SelIdx) {
      ctx.strokeStyle = p1Confirmed ? '#00ffff' : '#ffffff';
      ctx.lineWidth   = p1Confirmed ? 3 : 2;
      ctx.strokeRect(bx + 1, boxY + 1, boxW - 2, boxH - 2);
    }
    // P2 selection border (offset slightly so both are visible if same char)
    if (i === p2SelIdx) {
      ctx.strokeStyle = p2Confirmed ? '#ff8800' : '#aaaaaa';
      ctx.lineWidth   = p2Confirmed ? 3 : 2;
      ctx.strokeRect(bx + 4, boxY + 4, boxW - 8, boxH - 8);
    }

    // Character color swatch (large central block)
    ctx.fillStyle = ch.accent;
    ctx.fillRect(bx + 16, boxY + 10, boxW - 32, boxH - 36);

    // Name label
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, bx + boxW / 2, boxY + boxH - 8);

    // P1 / P2 label tags above the box
    ctx.font = 'bold 8px monospace';
    if (i === p1SelIdx) {
      ctx.fillStyle = p1Confirmed ? '#00ffff' : '#ffffff';
      ctx.fillText('P1', bx + boxW / 4, boxY - 4);
    }
    if (i === p2SelIdx && gameMode === '2p') {
      ctx.fillStyle = p2Confirmed ? '#ff8800' : '#aaaaaa';
      ctx.fillText('P2', bx + (boxW * 3) / 4, boxY - 4);
    }
  });

  // "VS" center text once both confirmed
  if (p1Confirmed && p2Confirmed) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(renderTime / 200));
    ctx.fillStyle   = '#fc5';
    ctx.font        = 'bold 28px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('VS', GW / 2, boxY + boxH / 2 + 10);
    ctx.restore();
  }

  // Instructions
  const p2ModeLabel = gameMode === '2p' ? 'P2: ← → to pick   ENTER to confirm' : 'P2: CPU';
  ctx.fillStyle = '#888';
  ctx.font      = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('← → to pick   ENTER to confirm', GW / 2, boxY + boxH + 18);
  ctx.fillText(p2ModeLabel, GW / 2, boxY + boxH + 30);

  // Confirmed status
  ctx.font = 'bold 9px monospace';
  if (p1Confirmed) {
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    ctx.fillText('P1 READY', 10, GH - 10);
  }
  if (p2Confirmed && gameMode === '2p') {
    ctx.fillStyle = '#ff8800';
    ctx.textAlign = 'right';
    ctx.fillText('P2 READY', GW - 10, GH - 10);
  }
}

export function drawMapSelect(ctx, renderTime, { mapSelIdx, maps }) {
  // Draw selected map as background preview
  const sel = maps[mapSelIdx];
  if (sel._img && sel._img.complete && sel._img.naturalWidth > 0) {
    ctx.drawImage(sel._img, 0, 0, GW, GH);
  } else {
    ctx.fillStyle = '#0e0620';
    ctx.fillRect(0, 0, GW, GH);
  }
  // Dark overlay so text is readable
  ctx.fillStyle = '#000000aa';
  ctx.fillRect(0, 0, GW, GH);

  // Title
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SELECT YOUR STAGE', GW / 2, 28);

  // Thumbnails row
  const thumbW = 120, thumbH = 68, gap = 12;
  const totalW = maps.length * thumbW + (maps.length - 1) * gap;
  const startX = (GW - totalW) / 2;
  const thumbY = GH / 2 - thumbH / 2;

  maps.forEach((m, i) => {
    const tx = startX + i * (thumbW + gap);
    // Border
    const isSelected = i === mapSelIdx;
    ctx.strokeStyle = isSelected ? '#fc5' : '#555';
    ctx.lineWidth   = isSelected ? 3 : 1;
    if (m._img && m._img.complete && m._img.naturalWidth > 0) {
      ctx.drawImage(m._img, tx, thumbY, thumbW, thumbH);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(tx, thumbY, thumbW, thumbH);
    }
    ctx.strokeRect(tx, thumbY, thumbW, thumbH);

    // Map name below thumbnail
    ctx.fillStyle = isSelected ? '#fc5' : '#888';
    ctx.font = isSelected ? 'bold 9px monospace' : '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, tx + thumbW / 2, thumbY + thumbH + 14);
  });

  // Instructions
  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('← → to pick   ENTER to confirm', GW / 2, GH - 14);
}
