// game.js — main loop, state machine, fixed timestep dispatcher

import { Fighter, CHARACTERS } from './fighter.js';
// trumpDef and obamaDef are already registered in CHARACTERS via fighter.js imports.
import * as input    from './input.js';
import { ctx, drawBG, setActiveBG, drawShadow, drawFighterPlaceholder, drawProjectiles, drawOverlays, loadSpriteSheet, applyScreenShake } from './renderer.js';
import { pushApart, resolveHits, clampToWalls } from './collision.js';
import * as audio    from './audio.js';
import { spawnHitSpark, spawnBlockSpark, updateParticles, drawParticles, clearParticles } from './particles.js';
import { drawHUD, drawMessage, drawKOScreen, drawTitle, drawCharSelect, drawMapSelect, drawPauseOverlay, drawControlsOverlay, getTitleMenuIndex, menuUp, menuDown } from './ui.js';
import { cpuSnapshot } from './cpu.js';

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
const CHAR_IDS = ['altman', 'zuck', 'jacked_jeff', 'jensen', 'skinny_jeff', 'laker', 'lady_kickboxer', 'dread', 'skater', 'tech_bro', 'random'];
const CS_ROW_SIZES = [4, 4, 3];
// Precompute row start indices
const CS_ROW_STARTS = CS_ROW_SIZES.reduce((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + CS_ROW_SIZES[i - 1]); return acc;
}, []);

function csGridNav(idx, dir) {
  let row = 0;
  for (let r = 0; r < CS_ROW_SIZES.length; r++)
    if (idx >= CS_ROW_STARTS[r] && idx < CS_ROW_STARTS[r] + CS_ROW_SIZES[r]) { row = r; break; }
  const col = idx - CS_ROW_STARTS[row];
  let next = idx;
  if (dir === 'left')  next = CS_ROW_STARTS[row] + Math.max(0, col - 1);
  if (dir === 'right') next = CS_ROW_STARTS[row] + Math.min(CS_ROW_SIZES[row] - 1, col + 1);
  if (dir === 'up' || dir === 'down') {
    const nextRow = dir === 'up' ? Math.max(0, row - 1) : Math.min(CS_ROW_SIZES.length - 1, row + 1);
    const clampedCol = Math.min(col, CS_ROW_SIZES[nextRow] - 1);
    next = CS_ROW_STARTS[nextRow] + clampedCol;
  }
  return Math.min(next, CHAR_IDS.length - 1);
}

// Resolve RANDOM slot to a real character index (0–4)
function resolveRandom(idx) {
  return CHAR_IDS[idx] === 'random'
    ? Math.floor(Math.random() * (CHAR_IDS.length - 1))
    : idx;
}

let p1SelIdx    = 0;   // index into CHAR_IDS
let p2SelIdx    = 1;
let p1Confirmed = false;
let p2Confirmed = false;
let charSelectDelay = 0; // ticks to wait after both confirmed before map screen

// ---- Map definitions ----
const MAP_DEFS = [
  { id: 'sf',     name: 'SAN FRANCISCO', src: 'assets/maps/SF_Map.png',     city: { fx: 0.104, fy: 0.425 } },
  { id: 'bk',     name: 'BROOKLYN',      src: 'assets/maps/BK_Map.png',     city: { fx: 0.840, fy: 0.394 } },
  { id: 'dc',     name: 'WASHINGTON DC', src: 'assets/maps/DC_map.png',     city: { fx: 0.802, fy: 0.477 }, labelBelow: true },
  { id: 'philly', name: 'PHILLY',        src: 'assets/maps/philly_map.png', city: { fx: 0.815, fy: 0.415 }, labelLeft: true },
];
MAP_DEFS.forEach(m => { const img = new Image(); img.src = m.src; m._img = img; });

// ---- Map select state ----
let mapSelIdx = 0;

// ---- Menu navigation cooldown (frames) — prevents moving too fast ----
let menuNavCooldown = 0;
const MENU_NAV_DELAY = 7; // ~117ms between steps

// ---- Render state ----
// (never snapshotted — decoration only)
let freezeTimer  = 0;
let projectiles  = [];
let screenShake  = 0;
let msgText      = '';
let msgTimer     = 0;
// Ghost HP for damage trail — render-side only, lerped toward actual hp
let p1GhostHP = null;
let p2GhostHP = null;
// KO door-slide animation frame (null = inactive)
let koSlideFrame = null;

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
loadSpriteSheet(CHARACTERS['zuck']);
loadSpriteSheet(CHARACTERS['altman']);
loadSpriteSheet(CHARACTERS['jacked_jeff']);
loadSpriteSheet(CHARACTERS['jensen']);
loadSpriteSheet(CHARACTERS['skinny_jeff']);

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
    if (msgTimer === 40) { msgText = 'FIGHT!'; audio.sfxRoundFight(); }
    if (msgTimer <= 0)   { msgText = ''; gameState = 'fight'; }
    return;
  }

  if (gameState === 'fight') {
    // Play whoosh immediately on button press — before fighter state checks
    if (i1.punch) audio.sfxPunchSwing();
    if (i1.kick)  audio.sfxKickSwing();
    if (gameMode !== '1p') {
      if (i2.punch) audio.sfxPunchSwing();
      if (i2.kick)  audio.sfxKickSwing();
    }

    const events1 = p1.update(i1, p2);
    const events2 = p2.update(i2, p1);

    pushApart(p1, p2);
    clampToWalls(p1);
    clampToWalls(p2);

    spawnProjectile(p1, 0);
    spawnProjectile(p2, 1);
    updateProjectiles();

    const hitEvents1 = resolveHits(p1, p2);
    const hitEvents2 = resolveHits(p2, p1);

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
    const reEvents1 = p1.update(noInp, p2);
    const reEvents2 = p2.update(noInp, p1);
    processEvents([...reEvents1, ...reEvents2]);

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

// ---- Projectile system ----
function spawnProjectile(fighter, ownerId) {
  const proj = fighter.def.projectile;
  if (!proj || !proj._imgs) return;
  const startup = fighter.def.moves.punch.startup;
  if (fighter.state !== 'punch' || fighter.timer !== startup) return;
  // Pick next image in cycle
  const img = proj._imgs[proj._idx % proj._imgs.length];
  proj._idx = (proj._idx + 1) % proj._imgs.length;
  projectiles.push({
    x:          fighter.x + fighter.facing * proj.spawnOffsetX,
    y:          fighter.y + proj.spawnOffsetY,
    vx:         fighter.facing * proj.speed,
    startX:     fighter.x,
    maxRange:   proj.maxRange,
    angle:      0,
    angleSpeed: proj.angleSpeed * fighter.facing,
    img,
    w:          proj.w,
    h:          proj.h,
    damage:     proj.damage,
    knockback:  proj.knockback,
    gravity:    proj.gravity || 0,
    vy:         0,
    owner:      fighter,
    ownerId,
    active:     true,
  });
}

function updateProjectiles() {
  for (const proj of projectiles) {
    if (!proj.active) continue;
    if (proj.gravity) {
      proj.vy = (proj.vy || 0) + proj.gravity;
      proj.y += proj.vy;
      if (proj.y >= GROUND) { proj.active = false; continue; }
    }
    proj.x     += proj.vx;
    proj.angle += proj.angleSpeed;
    if (Math.abs(proj.x - proj.startX) >= proj.maxRange || proj.x < 0 || proj.x > 640) {
      proj.active = false;
      continue;
    }
    const target = proj.ownerId === 0 ? p2 : p1;
    const hw = target.def.hurtboxW / 2;
    const hh = target.def.hurtboxH;
    if (proj.x > target.x - hw && proj.x < target.x + hw &&
        proj.y > target.y - hh && proj.y < target.y) {
      const events = target.receiveDamage(proj.damage, proj.knockback, proj.owner, false);
      processEvents(events);
      proj.active = false;
    }
  }
  projectiles = projectiles.filter(p => p.active);
}

// ---- Round management ----
function startRound() {
  p1.reset();
  p2.reset();
  roundTimer = 99;
  roundTicks = 0;
  clearParticles();
  projectiles  = [];
  gameState    = 'intro';
  msgText      = 'ROUND ' + roundNum;
  msgTimer     = 90;
  p1GhostHP    = null;
  p2GhostHP    = null;
  koSlideFrame = null;
  audio.playFightMusic();
  audio.sfxRoundAnnounce(roundNum);
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
    msgTimer  = 240;
    if (p1.hp <= 0) {
      p2Wins++;
      msgText = p2.tookDamage ? 'K.O.!' : 'PERFECT!';
      if (!p2.tookDamage) audio.sfxPerfect();
    } else if (p2.hp <= 0) {
      p1Wins++;
      msgText = p1.tookDamage ? 'K.O.!' : 'PERFECT!';
      if (!p1.tookDamage) audio.sfxPerfect();
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
    if (ev.type === 'hit') {
      // Play punch or kick hit sound based on attack type
      if (ev.attackType === 'kick') {
        audio.sfxKickHit();
      } else {
        audio.sfxPunchHit();
      }
      // Vary freeze and shake by hit weight
      if (ev.weight === 'light') {
        freezeTimer = 4;
        screenShake = 0;
      } else if (ev.weight === 'heavy') {
        freezeTimer = 8;
        screenShake = 4;
      } else {
        // special weight
        freezeTimer = 7;
        screenShake = 6;
      }
      if (!ev.noSpark) spawnHitSpark(ev.x, ev.y);
    }
    if (ev.type === 'block') {
      audio.sfxBlock();
      freezeTimer = 3;
      spawnBlockSpark(ev.x, ev.y);
    }
    if (ev.type === 'ko') {
      audio.sfxFighterKO(ev.voice);
      screenShake = 14;
      freezeTimer = 20;
      if (!ev.noSpark) spawnHitSpark(ev.x, ev.y);
      koSlideFrame = 0;
    }
    if (ev.type === 'ko_thud') {
      audio.sfxKOThud();
      screenShake = Math.max(screenShake, 6);
    }
    if (ev.type === 'ko_announce') {
      audio.sfxKOAnnounce();
    }
    if (ev.type === 'jump_grunt') {
      audio.sfxJump(ev.voice);
    }
    if (ev.type === 'crouch_grunt') {
      audio.sfxCrouch(ev.voice);
    }
    if (ev.type === 'combo5') {
      audio.sfxCombo5();
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
      gameMode    = '1p';
      audio.initAudio();
      audio.sfxConfirmation();
      audio.playMusic('assets/audio/music/intro.mp3');
      // Go to character select
      p1SelIdx         = 0;
      p2SelIdx         = 1;
      p1Confirmed      = false;
      p2Confirmed      = false;
      charSelectDelay  = 0;
      gameState        = 'charSelect';
      menuNavCooldown = MENU_NAV_DELAY;
      input.clearFrame(); // prevent this Enter from immediately confirming in charSelect
    }
    drawTitle(ctx, drawBG, renderTime);
    return;
  }

  if (gameState === 'charSelect') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    // ESC: deselect P1 confirm first, then back to title
    if (input.isEscapeKey()) {
      if (p1Confirmed) {
        p1Confirmed     = false;
        p2Confirmed     = false;
        charSelectDelay = 0;
      } else {
        gameState = 'title';
        menuNavCooldown = MENU_NAV_DELAY;
        input.clearFrame();
      }
    }
    // Navigation — arrow keys (2D grid), processed once per rAF with cooldown
    if (!p1Confirmed) {
      if (menuNavCooldown === 0 && input.isMenuLeft())  { p1SelIdx = csGridNav(p1SelIdx, 'left');  menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuRight()) { p1SelIdx = csGridNav(p1SelIdx, 'right'); menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuUp())    { p1SelIdx = csGridNav(p1SelIdx, 'up');    menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuDown())  { p1SelIdx = csGridNav(p1SelIdx, 'down');  menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (input.isMenuConfirm()) { p1SelIdx = resolveRandom(p1SelIdx); p1Confirmed = true; audio.sfxConfirmation(); }
    } else if (!p2Confirmed) {
      // 1P: P1 picks CPU's character. 2P: second player picks.
      if (menuNavCooldown === 0 && input.isMenuLeft())  { p2SelIdx = csGridNav(p2SelIdx, 'left');  menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuRight()) { p2SelIdx = csGridNav(p2SelIdx, 'right'); menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuUp())    { p2SelIdx = csGridNav(p2SelIdx, 'up');    menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuDown())  { p2SelIdx = csGridNav(p2SelIdx, 'down');  menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (input.isMenuConfirm()) { p2SelIdx = resolveRandom(p2SelIdx); p2Confirmed = true; audio.sfxConfirmation(); }
    }
    // Once both confirmed → wait 1 second then go to map select
    if (p1Confirmed && p2Confirmed) {
      if (charSelectDelay === 0) charSelectDelay = 60;
      charSelectDelay--;
      if (charSelectDelay === 0) {
        mapSelIdx       = 0;
        gameState       = 'mapSelect';
        menuNavCooldown = MENU_NAV_DELAY;
        input.clearFrame();
      }
    }
    drawCharSelect(ctx, drawBG, renderTime, {
      p1SelIdx, p2SelIdx, p1Confirmed, p2Confirmed, gameMode,
    });
    return;
  }

  if (gameState === 'mapSelect') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    // ESC: back to char select (reset confirms so both players re-pick)
    if (input.isEscapeKey()) {
      p1Confirmed      = false;
      p2Confirmed      = false;
      charSelectDelay  = 0;
      gameState        = 'charSelect';
      menuNavCooldown  = MENU_NAV_DELAY;
      input.clearFrame();
    }
    if (menuNavCooldown === 0 && input.isMenuLeft())  { mapSelIdx = (mapSelIdx + MAP_DEFS.length - 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    if (menuNavCooldown === 0 && input.isMenuRight()) { mapSelIdx = (mapSelIdx + 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    if (input.isMenuConfirm()) {
      audio.sfxConfirmation();
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

  // Match end — Enter: char select  |  Escape: title
  if (gameState === 'matchEnd' && msgTimer <= -30) {
    if (input.isMenuConfirm()) {
      audio.initAudio();
      audio.playMusic('assets/audio/music/intro.mp3');
      p1SelIdx    = 0;
      p2SelIdx    = 1;
      p1Confirmed = false;
      p2Confirmed = false;
      gameState   = 'charSelect';
    }
    if (input.isEscapeKey()) {
      audio.playMusic('assets/audio/music/intro.mp3');
      gameState = 'title';
    }
  }

  // Update particles (render-side only)
  updateParticles();

  // Update ghost HP (render-side damage trail, lerps toward actual hp)
  if (p1GhostHP === null) p1GhostHP = p1.hp;
  if (p2GhostHP === null) p2GhostHP = p2.hp;
  p1GhostHP = p1GhostHP > p1.hp ? Math.max(p1.hp, p1GhostHP - 0.5) : p1.hp;
  p2GhostHP = p2GhostHP > p2.hp ? Math.max(p2.hp, p2GhostHP - 0.5) : p2.hp;

  // Draw frame
  ctx.save();
  applyScreenShake(screenShake);

  drawBG(renderTime);
  drawShadow(p1);
  drawShadow(p2);
  drawFighterPlaceholder(p1, renderTime);
  drawFighterPlaceholder(p2, renderTime);
  drawOverlays(p1, p2, renderTime);
  drawProjectiles(projectiles);
  drawParticles(ctx);
  drawHUD(ctx, { p1, p2, p1Wins, p2Wins, roundTimer, roundNum, renderTime, p1GhostHP, p2GhostHP });
  // Suppress text message while KO door-slide is running
  if (koSlideFrame === null) drawMessage(ctx, msgText);

  ctx.restore();

  // KO door-slide renders outside screen shake transform
  if (koSlideFrame !== null) {
    koSlideFrame = drawKOScreen(ctx, koSlideFrame);
  }

  // Debug input display (bottom-left corner, fight state only)
  if (gameState === 'fight' || gameState === 'roundEnd') {
    drawDebugInput(ctx, debugInp, p1);
  }

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

  // Debug overlay toggle (I key)
  if (input.isDebugKey()) showDebug = !showDebug;

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
    { label: 'A↑', on: inp.heavyPunch || debugFlash.heavyPunch > 0 },
    { label: 'S',  on: inp.kick       || debugFlash.kick       > 0 },
    { label: 'S↑', on: inp.heavyKick  || debugFlash.heavyKick  > 0 },
    { label: 'X',  on: inp.block      || debugFlash.block      > 0 },
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
    s === 'crouchFinish' ? 'crouch' :
    (s === 'hit' || s === 'airHit' || s === 'block' ||
     s === 'ko'  || s === 'dash' || s === 'backdash') ? 'recoil' : s;
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
