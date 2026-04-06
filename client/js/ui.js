// ui.js — HUD: health bars, timer, round counter, message overlay

const GW = 640;
const GH = 360;

export const BUILD = '2026-03-24 22:29 PST v8';

// titleBlink is render-side state — lives in ui.js module scope
let titleBlink = 0;

// Title-screen menu state
const MENU_ITEMS = ['1 PLAYER', 'TOP SCORES'];
let menuIndex = 0;

// Returns the currently highlighted menu option index (0 = 1P, 1 = TOP SCORES).
export function getTitleMenuIndex() { return menuIndex; }

export function menuUp()   { menuIndex = Math.max(0, menuIndex - 1); }
export function menuDown() { menuIndex = Math.min(MENU_ITEMS.length - 1, menuIndex + 1); }

export function drawLoading(ctx, progress, renderTime) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, GW, GH);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('STREET BRAWL', GW / 2, 28);

  if (progress.ready) {
    const blink = Math.floor(renderTime / 500) % 2 === 0;
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = blink ? '#ffcc44' : '#886622';
    ctx.fillText('PRESS ANY KEY TO START', GW / 2, GH / 2);
    return;
  }

  // Progress bar
  const pct  = progress.total > 0 ? Math.min(progress.loaded / progress.total, 1) : 0;
  const barW = 320, barH = 10;
  const barX = (GW - barW) / 2, barY = 50;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(barX, barY, Math.round(barW * pct), barH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Percentage + byte count
  const mb = n => (n / 1048576).toFixed(1) + ' MB';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(pct * 100) + '%', GW / 2, barY + barH + 12);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText(mb(progress.loaded) + ' / ' + mb(progress.total), GW / 2, barY + barH + 22);

  // Category buckets
  const BUCKETS = [
    { label: 'Maps',              match: p => p.startsWith('assets/maps/') },
    { label: 'Character Sprites', match: p => p.startsWith('assets/characters/') },
    { label: 'Screens',          match: p => p.startsWith('assets/screens/') },
    { label: 'Other',            match: () => true },
  ];

  const buckets = BUCKETS.map(b => {
    const files = progress.files.filter(f => b.match(f.path));
    const total = files.length;
    const done  = files.filter(f => f.done).length;
    const size  = files.reduce((s, f) => s + f.size, 0);
    return { label: b.label, total, done, size, complete: total > 0 && done === total };
  }).filter(b => b.total > 0);

  const tableX = GW / 2 - 110, tableY = barY + barH + 38;
  const rowH = 18;

  buckets.forEach((b, i) => {
    const y = tableY + i * rowH;
    const sz = b.size >= 1048576 ? (b.size / 1048576).toFixed(1) + ' MB'
             : b.size >= 1024    ? Math.round(b.size / 1024) + ' KB' : '';

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = b.complete ? '#aaffaa' : '#ffcc44';
    ctx.textAlign = 'left';
    ctx.fillText(b.complete ? '✓' : '↓', tableX, y);

    ctx.fillStyle = b.complete ? '#aaa' : '#fff';
    ctx.fillText(b.label, tableX + 16, y);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'right';
    ctx.fillText(sz, tableX + 220, y);
  });
}

// drawHUD reads all its data from the sim state passed in.
// This keeps ui.js free of global references.
export function drawHUD(ctx, { p1, p2, p1Wins, p2Wins, roundTimer, roundNum, renderTime, p1GhostHP, p2GhostHP, p1Score, gameMode }) {
  const MUG    = 38;
  const CON    = 10;
  const bH     = 10;
  const bY     = 8;
  const R      = 20;              // timer circle radius
  const cx     = GW / 2;         // 320
  const cy     = 20;             // circle center y
  const bW     = cx - R - (MUG + CON + 2);  // 250
  const p1BarX = MUG + CON + 2;  // 50
  const p2BarR = GW - MUG - CON - 2; // 590
  const p2BarX = cx + R;         // 340

  function hpFill(ratio) {
    if (ratio > 0.5) return '#22cc22';
    if (ratio > 0.25) return '#e8d000';
    return Math.floor(renderTime / 133) % 2 === 0 ? '#cc1111' : '#ff3333';
  }
  function hpBevel(ratio) {
    if (ratio > 0.5) return '#88ff88';
    if (ratio > 0.25) return '#fff066';
    return '#ff7744';
  }

  // ── Mugshots ────────────────────────────────────────────────────────────────
  const mugY = 0;
  const p1MugDef = CHAR_DEFS.find(c => c.id === p1.def.id);
  const p2MugDef = CHAR_DEFS.find(c => c.id === p2.def.id);

  function drawMug(def, x, mirror) {
    const r = 4;  // corner radius
    // Rounded-rect helper
    function roundRect(rx, ry, rw, rh) {
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.arcTo(rx + rw, ry,      rx + rw, ry + r,      r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
      ctx.lineTo(rx + r, ry + rh);
      ctx.arcTo(rx,      ry + rh, rx,      ry + rh - r, r);
      ctx.lineTo(rx,      ry + r);
      ctx.arcTo(rx,      ry,      rx + r,  ry,          r);
      ctx.closePath();
    }
    // Gradient background
    const grad = ctx.createLinearGradient(x, mugY, x, mugY + MUG);
    grad.addColorStop(0,   '#7aaee8');
    grad.addColorStop(1,   '#3a6fbe');
    ctx.save();
    roundRect(x, mugY, MUG, MUG);
    ctx.fillStyle = grad;
    ctx.fill();
    // Portrait image, clipped to rounded rect
    if (def?._mug?.complete && def._mug.naturalWidth > 0) {
      roundRect(x, mugY, MUG, MUG);
      ctx.clip();
      if (mirror) { ctx.translate(x + MUG, mugY); ctx.scale(-1, 1); drawImageCover(ctx, def._mug, 0, 0, MUG, MUG); }
      else drawImageCover(ctx, def._mug, x, mugY, MUG, MUG);
    }
    ctx.restore();
    // White rounded border
    ctx.save();
    roundRect(x, mugY, MUG, MUG);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  drawMug(p1MugDef, 0, false);
  drawMug(p2MugDef, GW - MUG, true);

  // ── Green pixel connector (chevron shape between mug and bar) ───────────────
  function drawConnector(x, facingRight) {
    const g = '#cc8800', gd = '#7a4e00';
    // 5-row staircase chevron pointing toward center
    const rows = [
      { off: 0, w: CON },
      { off: 0, w: CON - 2 },
      { off: 0, w: CON - 4 },
      { off: 0, w: CON - 2 },
      { off: 0, w: CON },
    ];
    const rowH = Math.floor(bH / rows.length);
    rows.forEach((r, i) => {
      const rx = facingRight ? x + (CON - r.w) : x;
      ctx.fillStyle = i === 0 ? gd : g;
      ctx.fillRect(rx, bY + i * rowH, r.w, rowH);
    });
    // top/bottom full-width pixel
    ctx.fillStyle = gd;
    ctx.fillRect(x, bY, CON, 1);
    ctx.fillRect(x, bY + bH - 1, CON, 1);
  }
  drawConnector(MUG + 2, true);
  drawConnector(GW - MUG - CON - 2, false);

  // ── Timer circle background (drawn before HP bars so bars render over the edges) ──
  ctx.fillStyle = '#3a2200';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc8800';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // ── HP bars ──────────────────────────────────────────────────────────────────
  // P1 (fills left → right)
  const p1Ratio  = p1.hp / p1.def.stats.hp;
  const p1GRatio = Math.min(1, (p1GhostHP ?? p1.hp) / p1.def.stats.hp);
  ctx.fillStyle = '#1a0800';
  ctx.fillRect(p1BarX, bY, bW, bH);
  const gw1 = Math.max(0, p1GRatio * bW);
  if (gw1 > 0) { ctx.fillStyle = '#aa6600'; ctx.fillRect(p1BarX, bY, gw1, bH); }
  const w1 = Math.max(0, p1Ratio * bW);
  if (w1 > 0) {
    ctx.fillStyle = hpFill(p1Ratio); ctx.fillRect(p1BarX, bY, w1, bH);
    ctx.fillStyle = hpBevel(p1Ratio); ctx.fillRect(p1BarX, bY, w1, 1);
    ctx.fillStyle = '#0004';         ctx.fillRect(p1BarX, bY + bH - 2, w1, 2);
  }
  // green border on bar
  ctx.strokeStyle = '#44cc22'; ctx.lineWidth = 1;
  ctx.strokeRect(p1BarX - 0.5, bY - 0.5, bW + 1, bH + 1);

  // P2 (fills right → left)
  const p2Ratio  = p2.hp / p2.def.stats.hp;
  const p2GRatio = Math.min(1, (p2GhostHP ?? p2.hp) / p2.def.stats.hp);
  ctx.fillStyle = '#1a0800';
  ctx.fillRect(p2BarX, bY, bW, bH);
  const gw2 = Math.max(0, p2GRatio * bW);
  if (gw2 > 0) { ctx.fillStyle = '#aa6600'; ctx.fillRect(p2BarR - gw2, bY, gw2, bH); }
  const w2 = Math.max(0, p2Ratio * bW);
  if (w2 > 0) {
    ctx.fillStyle = hpFill(p2Ratio); ctx.fillRect(p2BarR - w2, bY, w2, bH);
    ctx.fillStyle = hpBevel(p2Ratio); ctx.fillRect(p2BarR - w2, bY, w2, 1);
    ctx.fillStyle = '#0004';         ctx.fillRect(p2BarR - w2, bY + bH - 2, w2, 2);
  }
  ctx.strokeStyle = '#44cc22'; ctx.lineWidth = 1;
  ctx.strokeRect(p2BarX - 0.5, bY - 0.5, bW + 1, bH + 1);

  // ── Decorative under-bars (SFA3 guard style) ─────────────────────────────────
  const ubY = bY + bH + 3;   // 21
  const ubH = 4;
  ctx.fillStyle = '#1a1000';
  ctx.fillRect(p1BarX, ubY, cx - R - p1BarX, ubH);
  ctx.fillRect(cx + R, ubY, p2BarR - (cx + R), ubH);
  ctx.fillStyle = '#cc8800';
  for (let sx = p1BarX + 1; sx < cx - R - 4; sx += 6) {
    ctx.fillRect(sx, ubY + 1, 4, ubH - 2);
  }
  for (let sx = cx + R + 1; sx < p2BarR - 4; sx += 6) {
    ctx.fillRect(sx, ubY + 1, 4, ubH - 2);
  }
  ctx.strokeStyle = '#cc8800'; ctx.lineWidth = 1;
  ctx.strokeRect(p1BarX - 0.5, ubY - 0.5, cx - R - p1BarX + 1, ubH + 1);
  ctx.strokeRect(cx + R - 0.5, ubY - 0.5, p2BarR - (cx + R) + 1, ubH + 1);

  // ── Win dots ─────────────────────────────────────────────────────────────────
  const dotY = ubY + ubH + 3;
  function drawDot(x, y, filled) {
    ctx.strokeStyle = '#cc8800'; ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, 7, 7);
    ctx.fillStyle = filled ? '#ffcc00' : '#3a2800';
    ctx.fillRect(x, y, 6, 6);
  }
  for (let i = 0; i < 2; i++) drawDot(p1BarX + i * 10, dotY, i < p1Wins);
  for (let i = 0; i < 2; i++) drawDot(p2BarR - 6 - i * 10, dotY, i < p2Wins);

  // ── Score tally (1P mode only, top-left below mugshot) ───────────────────────
  if (gameMode === '1p' && p1Score !== undefined) {
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#aa7700';
    ctx.fillText('SCORE', 2, 40);
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#ffee88';
    ctx.fillText(String(p1Score).padStart(6, '0'), 2, 48);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Super meters — bottom of screen, P1 left / P2 right
  const mW = 220, mH = 14;
  const mY = GH - mH - 6;

  // P1 super
  ctx.fillStyle = '#181818';
  ctx.fillRect(7, mY - 1, mW + 2, mH + 2);
  ctx.fillStyle = '#111122';
  ctx.fillRect(8, mY, mW, mH);
  const m1 = Math.max(0, (p1.meter / 100) * mW);
  const p1Full = p1.meter >= 100;
  if (m1 > 0) {
    ctx.fillStyle = p1Full ? (Math.floor(renderTime / 150) % 2 === 0 ? '#44ee22' : '#22cc44') : '#22cc44';
    ctx.fillRect(8, mY, m1, mH);
    ctx.fillStyle = '#88ff66';
    ctx.fillRect(8, mY, m1, 1);
  }
  if (p1Full) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAX', 8 + mW / 2, mY + mH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // P2 super (right-aligned, fills right-to-left)
  const p2MX = GW - 8 - mW;
  ctx.fillStyle = '#181818';
  ctx.fillRect(p2MX - 1, mY - 1, mW + 2, mH + 2);
  ctx.fillStyle = '#111122';
  ctx.fillRect(p2MX, mY, mW, mH);
  const m2 = Math.max(0, (p2.meter / 100) * mW);
  const p2Full = p2.meter >= 100;
  if (m2 > 0) {
    ctx.fillStyle = p2Full ? (Math.floor(renderTime / 150) % 2 === 0 ? '#44ee22' : '#22cc44') : '#22cc44';
    ctx.fillRect(p2MX + (mW - m2), mY, m2, mH);
    ctx.fillStyle = '#88ff66';
    ctx.fillRect(p2MX + (mW - m2), mY, m2, 1);
  }
  if (p2Full) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAX', p2MX + mW / 2, mY + mH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Timer circle ─────────────────────────────────────────────────────────────
  // Outer dark ring
  ctx.fillStyle = '#3a2200';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();
  // Gold fill
  ctx.fillStyle = '#cc8800';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // Upper-half bevel highlight
  ctx.fillStyle = '#ddbb44';
  ctx.beginPath(); ctx.arc(cx, cy - 1, R - 5, Math.PI, Math.PI * 2); ctx.fill();
  // Inner shadow rim
  ctx.strokeStyle = '#664400'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, Math.PI * 2); ctx.stroke();
  // Number
  ctx.fillStyle = '#221100';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.ceil(roundTimer)).padStart(2, ' '), cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
  // Round number below circle
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ROUND ' + roundNum, cx, cy + R + 9);
}

// KO door-slide animation — call each rAF frame while active.
// Returns the next frame number, or null when the animation is complete.
export function drawKOScreen(ctx, frame) {
  const SLIDE_IN = 8, HOLD = 90, SLIDE_OUT = 8;
  const TOTAL = SLIDE_IN + HOLD + SLIDE_OUT;

  let panelW;
  if (frame < SLIDE_IN) {
    panelW = Math.round((GW / 2) * (frame / SLIDE_IN));
  } else if (frame < SLIDE_IN + HOLD) {
    panelW = GW / 2;
  } else {
    const t = (frame - SLIDE_IN - HOLD) / SLIDE_OUT;
    panelW = Math.round((GW / 2) * (1 - t));
  }

  ctx.fillStyle = 'rgba(10,10,10,0.85)';
  ctx.fillRect(0, 0, panelW, GH);
  ctx.fillRect(GW - panelW, 0, panelW, GH);

  // KO text appears 2 frames after panels fully close
  if (frame >= SLIDE_IN + 2 && frame < SLIDE_IN + HOLD) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px monospace';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000000';
    ctx.strokeText('KO', GW / 2, GH / 2);
    ctx.fillStyle = '#ffcc22';
    ctx.fillText('KO', GW / 2, GH / 2);
    ctx.restore();
  }

  return frame + 1 >= TOTAL ? null : frame + 1;
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

  // ── Top-right hint ────────────────────────────────────────────────────────────
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#666644';
  ctx.textAlign = 'right';
  ctx.fillText('ENTER  to confirm', GW - 8, 14);

  // ── Title ─────────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#fc5';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STREET BRAWL', GW / 2, 68);

  // ── Mugshot roster strip ──────────────────────────────────────────────────────
  const realChars = CHAR_DEFS.filter(c => c.id !== 'random');
  const mugSz = 28, mugGap = 4;
  const mugRowW = realChars.length * mugSz + (realChars.length - 1) * mugGap;
  const mugX0 = Math.round((GW - mugRowW) / 2);
  const mugY0 = 74;
  realChars.forEach((ch, i) => {
    const mx = mugX0 + i * (mugSz + mugGap);
    ctx.fillStyle = ch.color;
    ctx.fillRect(mx, mugY0, mugSz, mugSz);
    if (ch._mug && ch._mug.complete && ch._mug.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(mx, mugY0, mugSz, mugSz); ctx.clip();
      drawImageCover(ctx, ch._mug, mx, mugY0, mugSz, mugSz);
      ctx.restore();
    } else {
      ctx.fillStyle = ch.accent;
      ctx.fillRect(mx + 5, mugY0 + 4, mugSz - 10, mugSz - 12);
    }
  });

  // ── Menu items ────────────────────────────────────────────────────────────────
  titleBlink += 0.04;
  MENU_ITEMS.forEach((label, i) => {
    const y = 125 + i * 26;
    const selected = i === menuIndex;
    if (selected) {
      ctx.fillStyle = '#fc5';
      ctx.font = 'bold 16px monospace';
      ctx.globalAlpha = 0.5 + Math.sin(titleBlink * 3) * 0.5;
      ctx.fillText('> ' + label + ' <', GW / 2, y);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(label, GW / 2, y);
    }
  });

  // ── Top scores panel ──────────────────────────────────────────────────────────
  let allScores = [];
  const _uiSeed = [{name:'JNY',score:420},{name:'MKE',score:380},{name:'SPR',score:350},{name:'RND',score:310}];
  try { const r = localStorage.getItem('SFHighScores'); allScores = r ? JSON.parse(r) : _uiSeed; } catch { allScores = _uiSeed; }
  const top3 = allScores.slice(0, 3);
  const hasMore = allScores.length > 3;
  const scoresHighlighted = menuIndex === 1; // TOP SCORES menu item selected

  const panelTop = 184;
  ctx.fillStyle = '#221800';
  ctx.fillRect(GW / 2 - 120, panelTop, 240, 1);

  ctx.font = 'bold 7px monospace';
  ctx.fillStyle = '#886622';
  ctx.textAlign = 'center';
  ctx.fillText('TOP  SCORES', GW / 2, panelTop + 11);

  if (top3.length === 0) {
    ctx.fillStyle = '#3a2a10';
    ctx.font = '7px monospace';
    ctx.fillText('— NO SCORES YET —', GW / 2, panelTop + 30);
  } else {
    top3.forEach((entry, i) => {
      const y = panelTop + 24 + i * 16;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#886622';
      ctx.fillText(
        String(i + 1) + '.  ' + entry.name + '  ' + String(entry.score).padStart(6, '0'),
        GW / 2, y
      );
    });
  }

  // "SEE MORE" — only shown when there are >3 scores; flashes when highlighted
  if (hasMore) {
    const seeMoreY = panelTop + 24 + top3.length * 16 + 8;
    const seeBlink = scoresHighlighted && Math.floor(renderTime / 300) % 2 === 0;
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = scoresHighlighted ? (seeBlink ? '#ffcc44' : '#665533') : '#3a2a10';
    ctx.fillText('SEE MORE  ▼', GW / 2, seeMoreY);
  }
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

  ctx.fillStyle = '#555';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Specials coming soon', GW / 2, GH - 18);
}

// Character select screen
const CHAR_DEFS = [
  { id: 'altman',        name: 'ALTMAN',   color: '#1a1a1a', accent: '#aaffaa', mug: 'assets/characters/sam_altman/altman_mug.png',           portrait: 'assets/characters/sam_altman/altman_fullbody.png' },
  { id: 'zuck',          name: 'ZUCK',     color: '#1877f2', accent: '#ffffff', mug: 'assets/characters/zuck/zuck_mug.png',                   portrait: 'assets/characters/zuck/zuck_fullbody.png' },
  { id: 'jacked_jeff',   name: 'JACKED J', color: '#d4af37', accent: '#222222', mug: 'assets/characters/jacked_jeff/jacked_jeff_mug.png',     portrait: 'assets/characters/jacked_jeff/jacked_jeff_fullbody.png' },
  { id: 'jensen',        name: 'JENSEN',   color: '#1a1a22', accent: '#76b900', mug: 'assets/characters/jensen/jensen_mug.png',               portrait: 'assets/characters/jensen/jensen_fullbody.png' },
  { id: 'musk',          name: 'MUSK',     color: '#1a1a2e', accent: '#cc0000', mug: 'assets/characters/musk/elon_mugshot.png',               portrait: 'assets/characters/musk/elon_fullbody.png' },
  { id: 'skinny_jeff',   name: 'SLIM JEFF',color: '#232f3e', accent: '#ff9900', mug: 'assets/characters/skinny_jeff/skinny_jeff_mug.png',     portrait: 'assets/characters/skinny_jeff/skinny_jeff_fullbody.png', mugScale: 0.85 },
  { id: 'laker',         name: 'LAKER',    color: '#552583', accent: '#FDB927', mug: 'assets/characters/laker/laker_mug.png',                 portrait: 'assets/characters/laker/laker_fullbody.png' },
  { id: 'lady_kickboxer',name: 'LADY K',   color: '#2a2aaa', accent: '#ee2222', mug: 'assets/characters/lady_kickboxer/kickboxer_mug.png',   portrait: 'assets/characters/lady_kickboxer/kickboxer_fullbody.png' },
  { id: 'dread',         name: 'DREAD',    color: '#1a3a1a', accent: '#cc8800', mug: 'assets/characters/dread/dread_mug.png',                 portrait: 'assets/characters/dread/dread_fullbody.png' },
  { id: 'skater',        name: 'SKATER',   color: '#2a2a2a', accent: '#ff4400', mug: 'assets/characters/skater/skater_mug.png',               portrait: 'assets/characters/skater/skater_fullbody.png' },
  { id: 'tech_bro',      name: 'TECH BRO', color: '#2c3e50', accent: '#3498db', mug: 'assets/characters/tech_bro/tech_mug.png',              portrait: 'assets/characters/tech_bro/tech_fullbody.png' },
  { id: 'random',        name: 'RANDOM',   color: '#111111', accent: '#ffffff', mug: null, portrait: null },
];

// Preload mugshot and portrait images
CHAR_DEFS.forEach(ch => {
  if (ch.mug) { ch._mug = new Image(); ch._mug.src = ch.mug; }
  if (ch.portrait) { ch._portrait = new Image(); ch._portrait.src = ch.portrait; }
});

// Offscreen canvas for pixelated RANDOM question mark (created once, reused)
const _randomQCanvas = document.createElement('canvas');
_randomQCanvas.width = 16; _randomQCanvas.height = 16;

// Preload shared screen assets
const _vsImg = new Image();       _vsImg.src = 'assets/screens/vs.png';
const _mapWorldImg = new Image(); _mapWorldImg.src = 'assets/screens/map.png';

// Grid layout constants — 4/4/3 variable row layout, all rows centered
const ROW_SIZES = [4, 4, 4];
const CELL = 46, CGAP = 4;
const MAX_COLS = Math.max(...ROW_SIZES);
const GRID_W = MAX_COLS * CELL + (MAX_COLS - 1) * CGAP;
const GRID_H = ROW_SIZES.length * CELL + (ROW_SIZES.length - 1) * CGAP;
const GRID_X = Math.round((GW - GRID_W) / 2);
const GRID_Y = 165;

// Precompute per-character {row, col, rowSize} from ROW_SIZES
const CHAR_POS = (() => {
  const pos = [];
  for (let r = 0; r < ROW_SIZES.length; r++)
    for (let c = 0; c < ROW_SIZES[r]; c++)
      pos.push({ row: r, col: c, rowSize: ROW_SIZES[r] });
  return pos;
})();

// Module-scope render state for V3 effects
let p1ScrollX = 0;
let p2ScrollX = 0;
let p1FlashFrames = 0;
let p2FlashFrames = 0;
let _prevP1Confirmed = false;
let _prevP2Confirmed = false;

// Draws a pixelated animated "?" centered at (cx, cy) for the RANDOM portrait slot.
function drawRandomPortrait(ctx, cx, cy, renderTime) {
  const hue = (renderTime * 0.08) % 360;
  const QSZ = 16; // render size (pixels) — will be scaled up for chunky pixel look
  const scale = 8; // 16 × 8 = 128px tall on screen
  const ofx = _randomQCanvas.getContext('2d');
  ofx.clearRect(0, 0, QSZ, QSZ);
  ofx.fillStyle = `hsl(${hue}, 90%, 62%)`;
  ofx.font = `bold ${QSZ}px monospace`;
  ofx.textAlign = 'center';
  ofx.textBaseline = 'middle';
  ofx.fillText('?', QSZ / 2, QSZ / 2);
  const destW = QSZ * scale, destH = QSZ * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(_randomQCanvas, Math.round(cx - destW / 2), Math.round(cy - destH / 2), destW, destH);
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function draw3DSelBox(ctx, cx, cy, sz, gold, goldHi, goldSh, playerTag, pulse) {
  const E = 2, FT = 5; // outset, frame thickness
  const x = cx - E, y = cy - E, w = sz + E * 2, h = sz + E * 2;
  ctx.save();
  ctx.globalAlpha = pulse;
  // Main gold frame
  ctx.fillStyle = gold;
  ctx.fillRect(x,          y,          w,  FT);       // top
  ctx.fillRect(x,          y + h - FT, w,  FT);       // bottom
  ctx.fillRect(x,          y + FT,     FT, h - FT*2); // left
  ctx.fillRect(x + w - FT, y + FT,     FT, h - FT*2); // right
  // Top-left highlight
  ctx.fillStyle = goldHi;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  // Bottom-right shadow
  ctx.fillStyle = goldSh;
  ctx.fillRect(x,     y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y,     1, h);
  // Red inner border
  ctx.strokeStyle = '#cc2200';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 1, cy + 1, sz - 2, sz - 2);
  // Player tag label (top-left corner of cell)
  ctx.fillStyle = goldHi;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(playerTag, cx + 3, cy + 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawNamePlate(ctx, ch, playerTag, x, y, w, confirmed) {
  const h = 22;
  ctx.fillStyle = hexToRgba(ch.color, 0.85);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = confirmed
    ? (playerTag === 'P1' ? '#00ffff' : '#ff8800')
    : ch.accent;
  ctx.lineWidth = confirmed ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  // top bevel
  ctx.fillStyle = hexToRgba(ch.accent, 0.5);
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  // player tag
  const tagColor = confirmed
    ? (playerTag === 'P1' ? '#00ffff' : '#ff8800')
    : ch.accent;
  ctx.fillStyle = tagColor;
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerTag, x + 5, y + h / 2);
  // character name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ch.name, x + w / 2 + 6, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

// Draw image scaled to COVER the target rect (crops excess, no squish)
function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const sr = img.naturalWidth / img.naturalHeight;
  const dr = w / h;
  let sx, sy, sw, sh;
  if (sr > dr) { sh = img.naturalHeight; sw = sh * dr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else          { sw = img.naturalWidth;  sh = sw / dr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Rectangular variant of draw3DSelBox (for map thumbnails)
function draw3DSelBoxRect(ctx, x, y, w, h, gold, goldHi, goldSh, pulse) {
  const E = 2, FT = 5;
  const rx = x - E, ry = y - E, rw = w + E*2, rh = h + E*2;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = gold;
  ctx.fillRect(rx,          ry,          rw, FT);
  ctx.fillRect(rx,          ry + rh - FT, rw, FT);
  ctx.fillRect(rx,          ry + FT,     FT, rh - FT*2);
  ctx.fillRect(rx + rw - FT, ry + FT,    FT, rh - FT*2);
  ctx.fillStyle = goldHi;
  ctx.fillRect(rx, ry, rw, 1);
  ctx.fillRect(rx, ry, 1, rh);
  ctx.fillStyle = goldSh;
  ctx.fillRect(rx,      ry + rh - 1, rw, 1);
  ctx.fillRect(rx + rw - 1, ry,      1,  rh);
  ctx.strokeStyle = '#cc2200';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

export function drawCharSelect(ctx, drawBG, renderTime, { p1SelIdx, p2SelIdx, p1Confirmed, p2Confirmed, gameMode }) {
  const p1Ch = CHAR_DEFS[p1SelIdx];
  const p2Ch = CHAR_DEFS[p2SelIdx];
  const PORT_W = 220; // portrait zone width (portraits bleed past grid edges)
  const cpuPicking = gameMode === '1p' && p1Confirmed && !p2Confirmed;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, GW, GH);

  // ── Gradient washes behind portrait zones ───────────────────────────────────
  const p1Grad = ctx.createLinearGradient(0, 30, PORT_W, 30);
  p1Grad.addColorStop(0, hexToRgba(p1Ch.color, 0.6));
  p1Grad.addColorStop(1, hexToRgba(p1Ch.color, 0));
  ctx.fillStyle = p1Grad;
  ctx.fillRect(0, 30, PORT_W, GH - 30);

  const rightCh = (gameMode === '2p' || cpuPicking || p1Confirmed) ? p2Ch : CHAR_DEFS[0];
  const p2Grad = ctx.createLinearGradient(GW, 30, GW - PORT_W, 30);
  p2Grad.addColorStop(0, hexToRgba(rightCh.color, 0.6));
  p2Grad.addColorStop(1, hexToRgba(rightCh.color, 0));
  ctx.fillStyle = p2Grad;
  ctx.fillRect(GW - PORT_W, 30, PORT_W, GH - 30);

  // ── VS image above grid ──────────────────────────────────────────────────────
  const vsH = 110, vsW = 110; // square PNG
  const vsX = Math.round(GW / 2 - vsW / 2);
  const vsY = 34;
  if (_vsImg.complete && _vsImg.naturalWidth > 0) {
    ctx.drawImage(_vsImg, vsX, vsY, vsW, vsH);
  } else {
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', GW / 2, vsY + vsH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Scrolling name banners (top band) ───────────────────────────────────────
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, GW, 30);
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 29, GW, 1);

  ctx.font = 'bold 10px monospace';
  const ZONE_W = GW / 3 - 12;

  // P1 left banner
  p1ScrollX -= 1;
  const p1Label = `P1 ${p1Ch.name}   `;
  const p1LabelW = ctx.measureText(p1Label).width;
  if (p1ScrollX < -p1LabelW) p1ScrollX += p1LabelW;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, ZONE_W, 30); ctx.clip();
  ctx.fillStyle = p1Ch.accent;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let tx = p1ScrollX; tx < ZONE_W; tx += p1LabelW) ctx.fillText(p1Label, tx, 15);
  ctx.restore();

  // Right banner — only shown after P1 confirms
  if (p1Confirmed) {
    p2ScrollX -= 1;
    const rightTag    = gameMode === '2p' ? '2P' : 'CPU';
    const rightAccent = rightCh.accent;
    const p2Label     = `${rightTag} ${p2Ch.name}   `;
    const p2LabelW    = ctx.measureText(p2Label).width;
    if (p2ScrollX < -p2LabelW) p2ScrollX += p2LabelW;
    ctx.save();
    ctx.beginPath(); ctx.rect(GW - ZONE_W, 0, ZONE_W, 30); ctx.clip();
    ctx.fillStyle = rightAccent;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let tx = p2ScrollX + GW - ZONE_W; tx < GW; tx += p2LabelW) ctx.fillText(p2Label, tx, 15);
    ctx.restore();
  }

  // Center title
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#664400';
  ctx.fillText('SELECT YOUR FIGHTER', GW / 2 + 1, 21);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('SELECT YOUR FIGHTER', GW / 2, 20);

  // ── Character grid ── (3×2, perfectly centered) ──────────────────────────────
  CHAR_DEFS.forEach((ch, i) => {
    const { row, col, rowSize } = CHAR_POS[i] || { row: 0, col: 0, rowSize: 1 };
    const rowW = rowSize * CELL + (rowSize - 1) * CGAP;
    const cx   = Math.round((GW - rowW) / 2) + col * (CELL + CGAP);
    const cy   = GRID_Y + row * (CELL + CGAP);

    // RANDOM cell gets animated gradient bg
    if (ch.id === 'random') {
      const isRandomSelected = i === p1SelIdx || i === p2SelIdx;
      const hue = (renderTime * (isRandomSelected ? 0.65 : 0.15)) % 360;
      ctx.fillStyle = `hsl(${hue},60%,15%)`;
      ctx.fillRect(cx, cy, CELL, CELL);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx + CELL / 2, cy + CELL / 2);
      ctx.font = 'bold 6px monospace';
      ctx.fillText('RANDOM', cx + CELL / 2, cy + CELL - 7);
      ctx.textBaseline = 'alphabetic';
    } else {
      // Uniform cyan cell background
      ctx.fillStyle = '#0099bb';
      ctx.fillRect(cx, cy, CELL, CELL);
      // Mugshot — cover crop to preserve aspect ratio
      if (ch._mug && ch._mug.complete && ch._mug.naturalWidth > 0) {
        const mugPad = ch.mugScale ? Math.round((CELL - 4) * (1 - ch.mugScale) / 2) : 0;
        const mx = cx + 2 + mugPad, my = cy + 2 + mugPad;
        const msz = CELL - 4 - mugPad * 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(cx + 2, cy + 2, CELL - 4, CELL - 4); ctx.clip();
        drawImageCover(ctx, ch._mug, mx, my, msz, msz);
        ctx.restore();
      } else {
        ctx.fillStyle = ch.accent;
        ctx.fillRect(cx + 10, cy + 7, CELL - 20, CELL - 22);
        ctx.fillStyle = '#ffffffcc';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch.name, cx + CELL / 2, cy + CELL - 8);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // P1 cursor — gold 3D box
    if (i === p1SelIdx) {
      const pulse = p1Confirmed ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(renderTime * 0.008));
      draw3DSelBox(ctx, cx, cy, CELL, '#ffcc00', '#ffee88', '#886600', 'P1', pulse);
    }

    // CPU cursor (1P) — teal 3D box
    if (i === p2SelIdx && (gameMode === '2p' || cpuPicking || (gameMode === '1p' && p2Confirmed))) {
      const inset  = (i === p1SelIdx) ? 5 : 0;
      const pulse  = p2Confirmed ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(renderTime * 0.008 + 1.2));
      const label  = gameMode === '2p' ? 'P2' : 'CPU';
      // P2 = orange, CPU = teal
      const [fc, fh, fs] = gameMode === '2p'
        ? ['#ff8800', '#ffcc88', '#663300']
        : ['#00cc88', '#88ffcc', '#006644'];
      draw3DSelBox(ctx, cx + inset, cy + inset, CELL - inset*2, fc, fh, fs, label, pulse);
    }
  });

  // ── Select label (centered above grid) ──────────────────────────────────────
  const labelY = GRID_Y - 16;
  const selectLabel = p1Confirmed ? (gameMode === '2p' ? 'PLAYER 2 SELECT' : 'CPU SELECT') : 'PLAYER 1 SELECT';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#443300';
  ctx.fillText(selectLabel, GW / 2 + 1, labelY + 1);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(selectLabel, GW / 2, labelY);

  // ── Instructions — top right, under CPU scroll ───────────────────────────────
  ctx.font = '7px monospace';
  ctx.fillStyle = '#555555';
  ctx.textAlign = 'right';
  ctx.fillText('ENTER confirm   ESC back', GW - 6, 44);

  // ── Confirmation flash ───────────────────────────────────────────────────────
  if (p1Confirmed && !_prevP1Confirmed) p1FlashFrames = 5;
  if (p2Confirmed && !_prevP2Confirmed) p2FlashFrames = 5;
  _prevP1Confirmed = p1Confirmed;
  _prevP2Confirmed = p2Confirmed;
  if (p1FlashFrames > 0) { ctx.fillStyle = `rgba(255,255,255,${(p1FlashFrames/5)*0.28})`; ctx.fillRect(0,0,GW/2,GH); p1FlashFrames--; }
  if (p2FlashFrames > 0) { ctx.fillStyle = `rgba(255,255,255,${(p2FlashFrames/5)*0.28})`; ctx.fillRect(GW/2,0,GW/2,GH); p2FlashFrames--; }

  // ── PORTRAITS — top layer, drawn last so they're above everything ────────────
  const PPORT_H = Math.round((GH - 30) * 0.85);
  const PPORT_W = Math.round(PPORT_H * 4 / 5);
  const portY   = 30 + Math.round(((GH - 30) - PPORT_H) / 2);

  // P1 portrait (left edge, faces right)
  if (p1Ch._portrait && p1Ch._portrait.complete && p1Ch._portrait.naturalWidth > 0) {
    drawImageCover(ctx, p1Ch._portrait, 0, portY, PPORT_W, PPORT_H);
  } else if (p1Ch.id === 'random') {
    drawRandomPortrait(ctx, Math.round(PPORT_W / 2), Math.round(portY + PPORT_H / 2), renderTime);
  }
  // P1 character name over portrait
  if (p1Ch.id !== 'random') {
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000aa';
    ctx.fillRect(0, portY + PPORT_H - 22, PPORT_W, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p1Ch.name, PPORT_W / 2, portY + PPORT_H - 8);
  }

  // Right portrait — P2 in 2P mode, CPU's character in 1P after P1 confirms
  const rightPortCh = (gameMode === '2p' || (gameMode === '1p' && p1Confirmed)) ? p2Ch : null;
  if (rightPortCh && rightPortCh._portrait && rightPortCh._portrait.complete && rightPortCh._portrait.naturalWidth > 0) {
    ctx.save();
    ctx.translate(GW, 0);
    ctx.scale(-1, 1);
    drawImageCover(ctx, rightPortCh._portrait, 0, portY, PPORT_W, PPORT_H);
    ctx.restore();
  } else if (rightPortCh && rightPortCh.id === 'random') {
    drawRandomPortrait(ctx, Math.round(GW - PPORT_W / 2), Math.round(portY + PPORT_H / 2), renderTime);
  }
  // Right character name over portrait
  if (rightPortCh && rightPortCh.id !== 'random') {
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000aa';
    ctx.fillRect(GW - PPORT_W, portY + PPORT_H - 22, PPORT_W, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rightPortCh.name, GW - PPORT_W / 2, portY + PPORT_H - 8);
  }

  // Ready banners
  ctx.font = 'bold 9px monospace';
  if (p1Confirmed) { ctx.fillStyle = '#00ffff'; ctx.textAlign = 'left';  ctx.fillText('P1 READY', 10, GH - 10); }
  if (p2Confirmed) {
    ctx.fillStyle = gameMode === '2p' ? '#ff8800' : '#00cc88';
    ctx.textAlign = 'right';
    ctx.fillText(gameMode === '2p' ? 'P2 READY' : 'CPU SET', GW - 10, GH - 10);
  }
}

export function drawMapSelect(ctx, renderTime, { mapSelIdx, maps }) {
  // ── Background — keep the selected map image ─────────────────────────────────
  const sel = maps[mapSelIdx];
  if (sel._img && sel._img.complete && sel._img.naturalWidth > 0) {
    ctx.drawImage(sel._img, 0, 0, GW, GH);
  } else {
    ctx.fillStyle = '#0e0620';
    ctx.fillRect(0, 0, GW, GH);
  }
  ctx.fillStyle = '#000000bb';
  ctx.fillRect(0, 0, GW, GH);

  // ── Title ────────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#664400';
  ctx.fillText('SELECT YOUR STAGE', GW / 2 + 1, 19);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('SELECT YOUR STAGE', GW / 2, 18);

  // ── World map image (~2/3 of screen height) ──────────────────────────────────
  const mapH = Math.round(GH * 0.56); // 202px — leaves room for thumbs below
  const mapW = Math.round(mapH * (2752 / 1536)); // ~362px (16:9 source)
  const mapX = Math.round((GW - mapW) / 2);
  const mapY = 24;

  if (_mapWorldImg.complete && _mapWorldImg.naturalWidth > 0) {
    ctx.drawImage(_mapWorldImg, mapX, mapY, mapW, mapH);
  }

  // ── City dots — pixelated 3D markers ────────────────────────────────────────
  maps.forEach((m, i) => {
    if (!m.city) return;
    const dotX = Math.round(mapX + m.city.fx * mapW);
    const dotY = Math.round(mapY + m.city.fy * mapH);
    const isHot = i === mapSelIdx;
    const pulse = isHot ? 0.7 + 0.3 * Math.abs(Math.sin(renderTime * 0.01)) : 1;

    ctx.save();
    ctx.globalAlpha = isHot ? 1 : 0.45;
    const sz = isHot ? 9 : 6;
    // Drop shadow
    ctx.fillStyle = '#220000';
    ctx.fillRect(dotX - sz/2 + 2, dotY - sz/2 + 2, sz, sz);
    // Main red fill
    ctx.fillStyle = isHot ? '#ff2200' : '#881100';
    ctx.fillRect(dotX - sz/2, dotY - sz/2, sz, sz);
    // Top-left highlight (3D pixel feel)
    ctx.fillStyle = isHot ? '#ff8866' : '#cc4422';
    ctx.fillRect(dotX - sz/2, dotY - sz/2, Math.ceil(sz/3), Math.ceil(sz/3));
    // Bright pixel
    if (isHot) {
      ctx.fillStyle = '#ffccbb';
      ctx.globalAlpha = pulse;
      ctx.fillRect(dotX - sz/2 + 1, dotY - sz/2 + 1, 2, 2);
    }
    // City label with pixelated gray backing block — only when selected
    if (isHot) {
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    const labelText = m.cityName || m.name;
    const tw = ctx.measureText(labelText).width;
    const pad = 2;
    const lh = 8;
    let lx, ly;
    if (m.labelBelow) {
      lx = dotX;
      ly = dotY + sz / 2 + 1;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(lx - tw / 2 - pad), Math.round(ly), Math.round(tw + pad * 2), lh + 1);
      ctx.globalAlpha = isHot ? 1 : 0.5;
      ctx.fillStyle = isHot ? '#ffffff' : '#cccccc';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, lx, ly);
    } else if (m.labelLeft) {
      lx = dotX - sz / 2 - pad - 1;
      ly = dotY;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(lx - tw - pad), Math.round(ly - lh / 2 - 1), Math.round(tw + pad * 2), lh + 1);
      ctx.globalAlpha = isHot ? 1 : 0.5;
      ctx.fillStyle = isHot ? '#ffffff' : '#cccccc';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(labelText, lx, ly);
      ctx.textAlign = 'center';
    } else {
      lx = dotX;
      ly = dotY - sz / 2 - 1;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(lx - tw / 2 - pad), Math.round(ly - lh - 1), Math.round(tw + pad * 2), lh + 1);
      ctx.globalAlpha = isHot ? 1 : 0.5;
      ctx.fillStyle = isHot ? '#ffffff' : '#cccccc';
      ctx.textBaseline = 'bottom';
      ctx.fillText(labelText, lx, ly);
    }
    ctx.textBaseline = 'alphabetic';
    } // end isHot label
    ctx.restore();
  });

  // ── Thumbnail strip — row of 3, row of 2 ─────────────────────────────────
  const thumbW = 90, thumbH = 44, gap = 10, rowGap = 8;
  const thumbY = mapY + mapH + 8;
  const ROW1 = 3;

  maps.forEach((m, i) => {
    const isRow2 = i >= ROW1;
    const rowIdx = isRow2 ? i - ROW1 : i;
    const rowCount = isRow2 ? maps.length - ROW1 : ROW1;
    const rowTotalW = rowCount * thumbW + (rowCount - 1) * gap;
    const rowStartX = Math.round((GW - rowTotalW) / 2);
    const tx = rowStartX + rowIdx * (thumbW + gap);
    const ty = isRow2 ? thumbY + thumbH + 11 + rowGap : thumbY;
    const isSelected = i === mapSelIdx;

    if (m._img && m._img.complete && m._img.naturalWidth > 0) {
      ctx.drawImage(m._img, tx, ty, thumbW, thumbH);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(tx, ty, thumbW, thumbH);
    }

    if (isSelected) {
      const pulse = 0.7 + 0.3 * Math.abs(Math.sin(renderTime * 0.008));
      draw3DSelBoxRect(ctx, tx, ty, thumbW, thumbH, '#ffcc00', '#ffee88', '#886600', pulse);
    } else {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, thumbW, thumbH);
    }

    ctx.fillStyle = isSelected ? '#ffcc00' : '#888';
    ctx.font = isSelected ? 'bold 8px monospace' : '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(m.thumbName || m.name, tx + thumbW / 2, ty + thumbH + 11);
  });

  // ── Instructions ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#666';
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('← ↑ ↓ → pick   ENTER confirm   ESC back', GW - 4, 18);
}

// ── High Score entry screen ───────────────────────────────────────────────────
export function drawHighScore(ctx, renderTime, { scores, playerScore, initials, cursor, insertIdx, scrollOffset }) {
  // Build the display list: existing scores with player's pending entry spliced in
  const display = scores.map((s, i) => ({ rank: i + 1, name: s.name, score: s.score, isPlayer: false }));
  const onBoard = insertIdx < 10;
  if (onBoard) {
    display.splice(insertIdx, 0, { rank: insertIdx + 1, name: initials.join(''), score: playerScore, isPlayer: true });
    for (let i = insertIdx + 1; i < display.length; i++) display[i].rank = i + 1;
    display.splice(10, display.length - 10);
  }

  const ROW_H   = 24;
  const LIST_Y  = 72;
  const blink   = Math.floor(renderTime / 350) % 2 === 0;

  // Background
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, GW, GH);
  // Subtle scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < GH; y += 4) ctx.fillRect(0, y, GW, 2);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('HIGH SCORES', GW / 2, 12);
  ctx.fillStyle = '#885500';
  ctx.fillRect(GW / 2 - 80, 37, 160, 1);

  // Column headers
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#886622';
  ctx.textAlign = 'left';
  ctx.fillText('RANK', 88, 48);
  ctx.fillText('NAME', 190, 48);
  ctx.textAlign = 'right';
  ctx.fillText('SCORE', 552, 48);
  ctx.fillStyle = '#2a2010';
  ctx.fillRect(70, 58, 500, 1);

  // Rows
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 60, GW, GH - 90);
  ctx.clip();

  for (let i = 0; i < display.length; i++) {
    const e   = display[i];
    const rowY = LIST_Y + i * ROW_H - scrollOffset;

    if (e.isPlayer) {
      // Highlight strip
      ctx.fillStyle = 'rgba(255,200,0,0.07)';
      ctx.fillRect(68, rowY - 1, 504, ROW_H);

      // Rank
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffcc00';
      ctx.textAlign = 'right';
      ctx.fillText(String(e.rank), 152, rowY + 5);

      // Blinking arrow
      if (blink) {
        ctx.textAlign = 'left';
        ctx.fillText('►', 70, rowY + 5);
      }

      // Initials slots
      for (let c = 0; c < 3; c++) {
        const slotX = 188 + c * 22;
        const active = c === cursor;
        ctx.fillStyle = active ? (blink ? '#ffcc00' : '#664400') : '#1a1000';
        ctx.fillRect(slotX - 1, rowY + 1, 18, 17);
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = active ? (blink ? '#000000' : '#ffcc00') : '#ffcc00';
        const ch = initials[c] === ' ' ? '_' : initials[c];
        ctx.fillText(ch, slotX + 8, rowY + 5);
      }

      // Score
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(String(playerScore).padStart(6, '0'), 552, rowY + 5);
    } else {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = i % 2 === 0 ? '#cccccc' : '#999999';
      ctx.textAlign = 'right';
      ctx.fillText(String(e.rank).padStart(2, ' '), 152, rowY + 6);
      ctx.textAlign = 'left';
      ctx.fillText(e.name, 190, rowY + 6);
      ctx.textAlign = 'right';
      ctx.fillText(String(e.score).padStart(6, '0'), 552, rowY + 6);
    }
  }

  ctx.restore();

  // Bottom rule
  ctx.fillStyle = '#2a2010';
  ctx.fillRect(70, GH - 44, 500, 1);

  // Instructions
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (onBoard) {
    ctx.fillStyle = '#886622';
    ctx.fillText('↑ ↓  CHANGE LETTER     ← →  MOVE     ENTER  CONFIRM', GW / 2, GH - 38);
  } else {
    ctx.fillStyle = '#776655';
    ctx.fillText('YOUR SCORE: ' + String(playerScore).padStart(6, '0') + '     PRESS ENTER TO CONTINUE', GW / 2, GH - 38);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

// ── Full high score viewer (title → TOP SCORES → SEE MORE) ───────────────────
export function drawViewScores(ctx, renderTime) {
  let scores = [];
  const _vsSeed = [{name:'JNY',score:420},{name:'MKE',score:380},{name:'SPR',score:350},{name:'RND',score:310}];
  try { const r = localStorage.getItem('SFHighScores'); scores = r ? JSON.parse(r) : _vsSeed; } catch { scores = _vsSeed; }

  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, GW, GH);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < GH; y += 4) ctx.fillRect(0, y, GW, 2);

  // Top-right back hint
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#666644';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('ENTER or ESC  to go back', GW - 8, 8);

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('HIGH SCORES', GW / 2, 14);
  ctx.fillStyle = '#885500';
  ctx.fillRect(GW / 2 - 80, 39, 160, 1);

  // List
  if (scores.length === 0) {
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#555544';
    ctx.fillText('— NO SCORES YET —', GW / 2, GH / 2);
  } else {
    const ROW_H = 26;
    const LIST_Y = 52;
    scores.forEach((entry, i) => {
      const y = LIST_Y + i * ROW_H;
      // Alternating row tint
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,200,0,0.04)'; ctx.fillRect(70, y - 1, 500, ROW_H); }
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = i === 0 ? '#ffcc44' : '#aaaaaa';
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1).padStart(2, ' '), 160, y + 14);
      ctx.textAlign = 'left';
      ctx.fillText(entry.name, 186, y + 14);
      ctx.textAlign = 'right';
      ctx.fillText(String(entry.score).padStart(6, '0'), 554, y + 14);
    });
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}
