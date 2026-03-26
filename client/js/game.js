// game.js — main loop, state machine, fixed timestep dispatcher

import { Fighter, CHARACTERS } from './fighter.js';
// trumpDef and obamaDef are already registered in CHARACTERS via fighter.js imports.
import * as input    from './input.js';
import { ctx, drawBG, setActiveBG, drawShadow, drawFighterPlaceholder, loadSpriteSheet, applyScreenShake, drawProjectiles } from './renderer.js';
import { pushApart, resolveHits, clampToWalls } from './collision.js';
import * as audio    from './audio.js';
import { sfxHitLight, sfxHitHeavy } from './audio.js';
import { spawnHitSpark, spawnBlockSpark, updateParticles, drawParticles, clearParticles } from './particles.js';
import { drawHUD, drawMessage, drawTitle, drawCharSelect, drawMapSelect, drawPauseOverlay, drawControlsOverlay, getTitleMenuIndex, menuUp, menuDown } from './ui.js';
import { cpuSnapshot } from './cpu.js';
import { runVignette, tickVignette, isVignetteActive } from './vignette.js';

// ---- Constants ----
const TICK_MS = 1000 / 60; // ~16.667ms per tick
const GW = 640;
const GH = 360;
const GROUND = 340;

// ---- Sim state ----
// (everything needed to replay or snapshot a round)
let gameState  = 'title';
let gameMode   = '2p';   // '1p' or '2p'
let roundTimer = 99;
let roundTicks = 0;   // 60 ticks = 1 second
let p1Wins = 0, p2Wins = 0, roundNum = 1;

// ---- Character select state ----
const CHAR_IDS = ['ryu', 'trump', 'obama', 'nene', 'laker', 'lady_kickboxer', 'dread', 'skater', 'tech_bro'];
let p1SelIdx    = 0;   // index into CHAR_IDS
let p2SelIdx    = 1;
let p1Confirmed = false;
let p2Confirmed = false;

// ---- Map definitions ----
const MAP_DEFS = [
  { id: 'bk',     name: 'BROOKLYN',      src: 'assets/maps/BK_Map.png' },
  { id: 'dc',     name: 'WASHINGTON DC', src: 'assets/maps/DC_map.png' },
  { id: 'sf',     name: 'SAN FRANCISCO', src: 'assets/maps/SF_Map.png' },
  { id: 'philly', name: 'PHILLY',        src: 'assets/maps/philly_map.png' },
];
MAP_DEFS.forEach(m => { const img = new Image(); img.src = m.src; m._img = img; });

// ---- Map select state ----
let mapSelIdx = 0;

// ---- Menu navigation cooldown (frames) — prevents moving too fast ----
let menuNavCooldown = 0;
const MENU_NAV_DELAY = 12; // ~200ms between steps

// ---- Render state ----
// (never snapshotted — decoration only)
let freezeTimer  = 0;
let screenShake  = 0;
let msgText      = '';
let msgTimer     = 0;

// ---- Projectile system ----
let projectiles = [];

// ---- UI overlay state ----
let paused       = false;
let showControls = false;
let showDebug    = true;

// ---- Fighters ----
// P1 = Ryu (playerIdx 0), P2 = NeNe Leakes (playerIdx 1)
const ryuDef  = CHARACTERS['ryu'];
const neneDef = CHARACTERS['nene'];

// Preload sprite sheets for characters that have one
loadSpriteSheet(ryuDef);
loadSpriteSheet(CHARACTERS['obama']);
loadSpriteSheet(CHARACTERS['laker']);
loadSpriteSheet(CHARACTERS['lady_kickboxer']);
loadSpriteSheet(CHARACTERS['dread']);
loadSpriteSheet(CHARACTERS['skater']);
loadSpriteSheet(CHARACTERS['tech_bro']);

let p1 = new Fighter(ryuDef,  0);
let p2 = new Fighter(neneDef, 1);

// ---- Fixed timestep accumulator ----
let acc  = 0;
let last = 0;

// ---- Debug: last known input snapshot for P1 (render-only, visual debug) ----
let debugInp = { left: false, right: false, up: false, down: false,
                 punch: false, heavyPunch: false, kick: false, heavyKick: false, block: false };

// Flash timers for edge-triggered buttons — keep them lit for ~15 frames (~250ms) so they're visible
const FLASH_FRAMES = 15;
const debugFlash = { punch: 0, heavyPunch: 0, kick: 0, heavyKick: 0, block: 0 };

// ---- Main rAF loop ----
function loop(t) {
  requestAnimationFrame(loop);

  const dt = Math.min(t - last, 100); // clamp: skip if tab was hidden
  last = t;

  // Sample key edges ONCE per rAF, BEFORE the tick loop
  input.sampleKeys();

  acc += dt;
  let ticked = false;
  while (acc >= TICK_MS) {
    tick();
    acc -= TICK_MS;
    ticked = true;
  }

  render(t); // pass rAF timestamp as renderTime

  // Only clear edge-triggered presses if at least one sim tick ran.
  // If no tick ran (acc < TICK_MS), keep presses in the map so the next
  // tick frame can still read them — prevents 0-tick-frame input loss.
  if (ticked) input.clearFrame();
}

// ---- Simulation tick ----
// Accepts optional inputOverrides for future rollback replay (Part 2 hook — not implemented).
function tick(inputOverrides = null) {
  // Pause (1P only)
  if (paused) return;

  // Always sample input BEFORE freeze check so button presses during hitstop
  // are captured into the fighter's input buffer and not lost to clearFrame().
  const i1 = input.snapshot(0);
  const i2 = gameMode === '1p'
    ? cpuSnapshot(p2.x, p1.x)
    : input.snapshot(1);

  // Track last input for debug display (render-side only) — always, not just during fight
  debugInp = i1;
  for (const btn of ['punch', 'heavyPunch', 'kick', 'heavyKick', 'block']) {
    if (i1[btn]) debugFlash[btn] = FLASH_FRAMES;
    else if (debugFlash[btn] > 0) debugFlash[btn]--;
  }

  // Freeze timer: sim is paused, render still runs
  if (freezeTimer > 0) {
    freezeTimer--;
    if (gameState === 'fight') {
      p1.feedInputBuffer(i1);
      p2.feedInputBuffer(i2);
    }
    return;
  }

  if (gameState === 'title') {
    // Input handled in render path for title (menu confirm)
    return;
  }

  if (gameState === 'charSelect') {
    // Input handled in render path (once per rAF, no multi-tick double-fire)
    return;
  }

  if (gameState === 'intro') {
    // Buffer inputs during countdown so presses before FIGHT! aren't lost
    p1.feedInputBuffer(i1);
    if (gameMode !== '1p') p2.feedInputBuffer(i2);
    msgTimer--;
    if (msgTimer === 40) msgText = 'FIGHT!';
    if (msgTimer <= 0)   { msgText = ''; gameState = 'fight'; }
    return;
  }

  if (gameState === 'fight') {
    const events1 = p1.update(i1, p2);
    const events2 = p2.update(i2, p1);

    pushApart(p1, p2);
    clampToWalls(p1);
    clampToWalls(p2);

    const hitEvents1 = resolveHits(p1, p2);
    const hitEvents2 = resolveHits(p2, p1);

    // Update projectiles
    updateProjectiles();

    // Tick round timer — 60 ticks = 1 second
    roundTicks++;
    if (roundTicks >= 60) {
      roundTicks = 0;
      roundTimer = Math.max(0, roundTimer - 1);
    }

    checkRoundEnd();

    processEvents([...events1, ...events2, ...hitEvents1, ...hitEvents2]);
    return;
  }

  if (gameState === 'roundEnd') {
    // Allow physics to continue during round end (fighters settle)
    const noInp = { left: false, right: false, up: false, down: false, punch: false, kick: false, block: false };
    p1.update(noInp, p2);
    p2.update(noInp, p1);

    msgTimer--;
    if (msgTimer <= 0) {
      if (p1Wins >= 2 || p2Wins >= 2) {
        gameState = 'matchEnd';
        msgText   = (p1Wins >= 2 ? 'PLAYER 1' : 'PLAYER 2') + ' WINS!';
        msgTimer  = 200;
      } else {
        roundNum++;
        startRound();
      }
    }
    return;
  }

  if (gameState === 'matchEnd') {
    msgTimer--;
    if (msgTimer <= -30) {
      msgText = 'PRESS ENTER';
    }
    return;
  }
}

// ---- Projectile update ----
function updateProjectiles() {
  const toRemove = [];

  for (let i = 0; i < projectiles.length; i++) {
    const proj = projectiles[i];

    // Move projectile
    proj.x += proj.vx;

    // Age it
    proj.life--;

    // Remove if off-screen or expired
    if (proj.life <= 0 || proj.x < 0 || proj.x > GW) {
      toRemove.push(i);
      continue;
    }

    // Determine the opponent for this projectile
    const opponent = proj.owner === p1 ? p2 : p1;

    // Skip if opponent is already KO'd
    if (opponent.hp <= 0) continue;

    // Collision check — projectile rect vs opponent hurtbox
    const hb = opponent.hurtbox();
    const px = proj.x - proj.w / 2;
    const py = proj.y - proj.h / 2;

    const overlaps =
      px < hb.x + hb.w &&
      px + proj.w > hb.x &&
      py < hb.y + hb.h &&
      py + proj.h > hb.y;

    if (overlaps) {
      // Deal damage — velocity direction from projectile's vx sign
      const hitDir = proj.vx > 0 ? 1 : -1;
      const dmgEvents = opponent.receiveDamage(proj.dmg, 2.5, proj.owner, true);
      processEvents(dmgEvents);
      toRemove.push(i);
    }
  }

  // Remove in reverse order so indexes stay valid
  for (let i = toRemove.length - 1; i >= 0; i--) {
    projectiles.splice(toRemove[i], 1);
  }
}

// ---- Round management ----
function startRound() {
  p1.reset();
  p2.reset();
  projectiles = [];
  roundTimer = 99;
  roundTicks = 0;
  clearParticles();
  gameState  = 'intro';
  msgText    = 'ROUND ' + roundNum;
  msgTimer   = 90;
  audio.sfxRound();
}

function startMatch() {
  p1Wins  = 0;
  p2Wins  = 0;
  roundNum = 1;
  startRound();
}

function checkRoundEnd() {
  if (p1.hp <= 0 || p2.hp <= 0 || roundTimer <= 0) {
    gameState = 'roundEnd';
    msgTimer  = 150;
    if (p1.hp <= 0) {
      p2Wins++;
      msgText = p2.tookDamage ? 'K.O.!' : 'PERFECT!';
    } else if (p2.hp <= 0) {
      p1Wins++;
      msgText = p1.tookDamage ? 'K.O.!' : 'PERFECT!';
    } else if (p1.hp > p2.hp) {
      p1Wins++;
      msgText = 'TIME!';
    } else if (p2.hp > p1.hp) {
      p2Wins++;
      msgText = 'TIME!';
    } else {
      msgText = 'DRAW!';
    }
  }
}

// ---- Event dispatch ----
// Fires audio and spawns particles from events returned by Fighter.update() / receiveDamage().
function processEvents(events) {
  for (const ev of events) {
    if (ev.type === 'swing') {
      audio.sfxSwing();
    }
    if (ev.type === 'hit') {
      // Vary freeze and shake by hit weight
      if (ev.weight === 'light') {
        sfxHitLight();
        freezeTimer = 4;
        screenShake = 0;
      } else if (ev.weight === 'heavy') {
        sfxHitHeavy();
        freezeTimer = 8;
        screenShake = 4;
      } else {
        // special weight
        sfxHitHeavy();
        freezeTimer = 7;
        screenShake = 6;
      }
      spawnHitSpark(ev.x, ev.y);
    }
    if (ev.type === 'block') {
      audio.sfxBlock();
      freezeTimer = 3;
      spawnBlockSpark(ev.x, ev.y);
    }
    if (ev.type === 'ko') {
      audio.sfxKO();
      screenShake = 14;
      freezeTimer = 20;
      spawnHitSpark(ev.x, ev.y);
    }
    if (ev.type === 'spawn_projectile') {
      const sp = ev.special;
      projectiles.push({
        x:     ev.owner.x + (ev.owner.facing * 20),
        y:     ev.owner.y - 35,
        vx:    sp.speed * ev.owner.facing,
        w:     sp.hitboxW,
        h:     sp.hitboxH,
        dmg:   sp.damage,
        owner: ev.owner,
        life:  120, // frames before disappearing
        charId: ev.owner.def.id,
        isSuper: sp.type === 'super_projectile',
      });
    }
    if (ev.type === 'super_start') {
      // Trigger vignette — freezeTimer covers the full 36-frame vignette + margin
      runVignette(ev.fighter.def, () => {
        // Resume is implicit — super state is already set on the fighter
      });
      screenShake = 8;
      freezeTimer = 42; // 36 vignette frames + 6 frame margin
    }
  }
}

// ---- Render ----
// renderTime is the raw rAF timestamp (wall ms) used for visual-only animations.
function render(renderTime) {
  // Decay screen shake
  screenShake *= 0.8;
  if (screenShake < 0.4) screenShake = 0;

  // Title screen
  if (gameState === 'title') {
    // Arrow-key menu navigation (edge-triggered via input module)
    if (input.isMenuUp())   menuUp();
    if (input.isMenuDown()) menuDown();
    if (input.isMenuConfirm()) {
      gameMode    = getTitleMenuIndex() === 0 ? '1p' : '2p';
      audio.initAudio();
      // Go to character select
      p1SelIdx    = 0;
      p2SelIdx    = 1;
      p1Confirmed = false;
      p2Confirmed = false;
      gameState       = 'charSelect';
      menuNavCooldown = MENU_NAV_DELAY;
      input.clearFrame(); // prevent this Enter from immediately confirming in charSelect
    }
    drawTitle(ctx, drawBG, renderTime);
    return;
  }

  if (gameState === 'charSelect') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    // Navigation — arrow keys, processed once per rAF with cooldown
    if (!p1Confirmed) {
      if (menuNavCooldown === 0 && input.isMenuLeft())  { p1SelIdx = (p1SelIdx + CHAR_IDS.length - 1) % CHAR_IDS.length; menuNavCooldown = MENU_NAV_DELAY; }
      if (menuNavCooldown === 0 && input.isMenuRight()) { p1SelIdx = (p1SelIdx + 1) % CHAR_IDS.length; menuNavCooldown = MENU_NAV_DELAY; }
      if (input.isMenuConfirm()) p1Confirmed = true;
    } else if (gameMode === '2p' && !p2Confirmed) {
      if (menuNavCooldown === 0 && input.isMenuLeft())  { p2SelIdx = (p2SelIdx + CHAR_IDS.length - 1) % CHAR_IDS.length; menuNavCooldown = MENU_NAV_DELAY; }
      if (menuNavCooldown === 0 && input.isMenuRight()) { p2SelIdx = (p2SelIdx + 1) % CHAR_IDS.length; menuNavCooldown = MENU_NAV_DELAY; }
      if (input.isMenuConfirm()) p2Confirmed = true;
    }
    // 1P: CPU picks random as soon as P1 confirms
    if (gameMode === '1p' && p1Confirmed && !p2Confirmed) {
      p2SelIdx    = Math.floor(Math.random() * CHAR_IDS.length);
      p2Confirmed = true;
    }
    // Once both confirmed → go to map select
    if (p1Confirmed && p2Confirmed) {
      mapSelIdx       = 0;
      gameState       = 'mapSelect';
      menuNavCooldown = MENU_NAV_DELAY;
      input.clearFrame();
    }
    drawCharSelect(ctx, drawBG, renderTime, {
      p1SelIdx, p2SelIdx, p1Confirmed, p2Confirmed, gameMode,
    });
    return;
  }

  if (gameState === 'mapSelect') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    if (menuNavCooldown === 0 && input.isMenuLeft())  { mapSelIdx = (mapSelIdx + MAP_DEFS.length - 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; }
    if (menuNavCooldown === 0 && input.isMenuRight()) { mapSelIdx = (mapSelIdx + 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; }
    if (input.isMenuConfirm()) {
      setActiveBG(MAP_DEFS[mapSelIdx]._img);
      const d1 = CHARACTERS[CHAR_IDS[p1SelIdx]];
      const d2 = CHARACTERS[CHAR_IDS[p2SelIdx]];
      p1 = new Fighter({ ...d1, startX: 140, facing:  1 }, 0);
      p2 = new Fighter({ ...d2, startX: 340, facing: -1 }, 1);
      p1Wins  = 0;
      p2Wins  = 0;
      roundNum = 1;
      startRound();
    }
    drawMapSelect(ctx, renderTime, { mapSelIdx, maps: MAP_DEFS });
    return;
  }

  // Match end — check for restart (return to char select)
  if (gameState === 'matchEnd' && msgTimer <= -30) {
    if (input.isMenuConfirm()) {
      audio.initAudio();
      p1SelIdx    = 0;
      p2SelIdx    = 1;
      p1Confirmed = false;
      p2Confirmed = false;
      gameState   = 'charSelect';
    }
  }

  // Update particles (render-side only)
  updateParticles();

  // Draw frame
  ctx.save();
  applyScreenShake(screenShake);

  drawBG(renderTime);
  drawShadow(p1);
  drawShadow(p2);
  drawFighterPlaceholder(p1, renderTime);
  drawFighterPlaceholder(p2, renderTime);
  drawProjectiles(ctx, projectiles);
  drawParticles(ctx);
  drawHUD(ctx, { p1, p2, p1Wins, p2Wins, roundTimer, roundNum });
  drawMessage(ctx, msgText);

  ctx.restore();

  // Debug input display (bottom-left corner, fight state only)
  if (gameState === 'fight' || gameState === 'roundEnd') {
    drawDebugInput(ctx, debugInp, p1);
  }

  // Vignette draws on top of everything — called after ctx.restore() so the
  // screen-shake transform does not affect the overlay geometry.
  tickVignette();

  // Pause toggle (1P only, during fight)
  if (gameMode === '1p' && gameState === 'fight' && input.isPauseKey()) {
    paused = !paused;
  }
  // Escape while paused → quit to title
  if (paused && input.isEscapeKey()) {
    paused = false;
    gameState = 'title';
  }
  if (paused) drawPauseOverlay(ctx);

  // Controls overlay (any state, Tab to toggle)
  if (input.isTabKey()) showControls = !showControls;
  if (showControls) drawControlsOverlay(ctx, p1.def, p2.def);

  if (showDebug && (gameState === 'fight' || gameState === 'roundEnd')) {
    drawDebugHitboxes(p1, p2);
    drawDebugConsole(p1, p2);
  }
}

// ---- Debug input display ----
function drawDebugInput(ctx, inp, fighter) {
  const x = 8, y = GH - 8;
  ctx.save();
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';

  const buttons = [
    { label: '←',  on: inp.left },
    { label: '→',  on: inp.right },
    { label: '↑',  on: inp.up },
    { label: '↓',  on: inp.down },
    { label: 'A',  on: inp.punch      || debugFlash.punch      > 0 },
    { label: 'S',  on: inp.heavyPunch || debugFlash.heavyPunch > 0 },
    { label: 'Z',  on: inp.kick       || debugFlash.kick       > 0 },
    { label: 'X',  on: inp.heavyKick  || debugFlash.heavyKick  > 0 },
    { label: 'C',  on: inp.block      || debugFlash.block      > 0 },
  ];

  let cx = x;
  for (const btn of buttons) {
    ctx.fillStyle = btn.on ? '#ffe040' : '#ffffff44';
    ctx.fillText(btn.label, cx, y);
    cx += 14;
  }

  // Show fighter state + buffer
  const bufLabel = fighter.inputBuffer ? `[${fighter.inputBuffer}]` : '';
  ctx.fillStyle = '#ffffff88';
  ctx.fillText(`${fighter._state} ${bufLabel}`, cx + 4, y);

  ctx.restore();
}

// ---- Debug: hitbox visualizer ----
function drawDebugHitboxes(f1, f2) {
  for (const f of [f1, f2]) {
    // Hurtbox — cyan
    const hb = f.hurtbox();
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    ctx.restore();

    // Active hitbox — red (only when attack is live)
    const ab = f.hitbox();
    if (ab) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(ab.x, ab.y, ab.w, ab.h);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 1;
      ctx.strokeRect(ab.x, ab.y, ab.w, ab.h);
      ctx.restore();
    }

    // Origin dot
    ctx.save();
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
    ctx.restore();
  }
}

// ---- Debug: live info console ----
function _debugSheetName(f) {
  if (!f.def._animSheetImages) {
    if (f.def._customSheetImage) return 'custom';
    if (f.def._idleImage)        return 'idle(sheet)';
    return 'placeholder';
  }
  const s = f._state || '';
  const key =
    (s === 'heavyPunch' || s.startsWith('special_') || s === 'super') ? 'punch' :
    s === 'heavyKick' ? 'kick' :
    (s === 'hit' || s === 'airHit' || s === 'block' ||
     s === 'ko'  || s === 'crouch' || s === 'dash' || s === 'backdash') ? 'recoil' : s;
  const imgs = f.def._animSheetImages;
  const resolved = imgs[key] ? key : 'idle';
  const sheet = f.def.animSheets[resolved];
  return sheet ? sheet.src.split('/').pop() + ` [${resolved}]` : '(missing)';
}

function drawDebugConsole(f1, f2) {
  const PW = 195, LH = 9, PAD = 5;

  const rows = [];
  rows.push({ text: '── DEBUG  (I to hide) ──', color: '#ffff00' });
  rows.push({ text: '', color: '#fff' });

  for (const [label, f] of [['P1', f1], ['P2', f2]]) {
    const col = label === 'P1' ? '#44ddff' : '#ff88aa';
    rows.push({ text: `${label}  ${f.def.id}`, color: col });
    rows.push({ text: `  state:  ${f._state}`, color: '#fff' });
    rows.push({ text: `  sprite: ${_debugSheetName(f)}`, color: '#ffaa33' });
    rows.push({ text: `  frame:  ${f.animFrame}`, color: '#fff' });
    rows.push({ text: `  pos:    ${Math.round(f.x)}, ${Math.round(f.y)}`, color: '#fff' });
    rows.push({ text: `  hp:     ${f.hp} / ${f.def.stats.hp}`, color: '#fff' });
    rows.push({ text: `  meter:  ${Math.round(f.meter || 0)}`, color: '#fff' });
    if (f.stunTimer > 0)
      rows.push({ text: `  stun:   ${f.stunTimer}`, color: '#ff5555' });
    rows.push({ text: '', color: '#fff' });
  }

  rows.push({ text: '  cyan  = hurtbox', color: '#00ffff' });
  rows.push({ text: '  red   = active hitbox', color: '#ff4444' });
  rows.push({ text: '  dot   = origin (x,y)', color: '#ffff00' });

  const PH = rows.length * LH + PAD * 2;
  const PX = GW - PW - 4;
  const PY = 4;

  ctx.save();
  ctx.fillStyle = '#000000cc';
  ctx.fillRect(PX, PY, PW, PH);
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.strokeRect(PX, PY, PW, PH);

  ctx.font = '7px monospace';
  ctx.textAlign = 'left';
  rows.forEach((row, i) => {
    ctx.fillStyle = row.color;
    ctx.fillText(row.text, PX + PAD, PY + PAD + (i + 1) * LH);
  });
  ctx.restore();
}

// ---- Boot ----
requestAnimationFrame(loop);
