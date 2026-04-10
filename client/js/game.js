// game.js — main loop, state machine, fixed timestep dispatcher

import { Fighter, CHARACTERS } from './fighter.js';
import * as input    from './input.js';
import { canvas, ctx, drawBG, setActiveBG, drawShadow, drawFighterPlaceholder, drawProjectiles, drawOverlays, loadSpriteSheet, applyScreenShake, updateCamera, getCameraX, getStageWidth, getOverscanX } from './renderer.js';
import { pushApart, resolveHits, clampToWalls } from './collision.js';
import * as audio    from './audio.js';
import { spawnHitSpark, spawnBlockSpark, updateParticles, drawParticles, clearParticles } from './particles.js';
import { drawHUD, drawMessage, drawTitle, drawCharSelect, drawMapSelect, drawPauseOverlay, drawControlsOverlay, drawHighScore, drawViewScores, drawLoading, drawSplash, getTitleMenuIndex, menuUp, menuDown, resetTitleMenu } from './ui.js';
import { cpuSnapshot, getCpuDifficulty, setCpuDifficulty, resetCpuState } from './cpu.js';

// ---- Constants ----
const TICK_MS = 1000 / 60; // ~16.667ms per tick
const GW = 640;
const GH = 360;
const GROUND = 340;

// ---- Sim state ----
// (everything needed to replay or snapshot a round)
let gameState  = 'loading';
let gameMode   = '2p';   // '1p' or '2p'
let roundTimer = 99;
let roundTicks = 0;   // 60 ticks = 1 second
let p1Wins = 0, p2Wins = 0, roundNum = 1;

// ---- Character select state ----
const CHAR_IDS = ['altman', 'zuck', 'bezos', 'jensen', 'musk', 'young_bezos', 'rio', 'zuri', 'dre', 'sid', 'jax', 'random'];
const CS_ROW_SIZES = [4, 4, 4];
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
  { id: 'sf',     name: 'SAN FRANCISCO', src: 'assets/maps/sf_wides.png',      city: { fx: 0.104, fy: 0.425 }, thumbName: 'GOLDEN GATE' },
  { id: 'venice', name: 'VENICE',        src: 'assets/maps/venice_wides.png',  city: { fx: 0.160, fy: 0.624 }, cityName: 'LOS ANGELES', labelBelow: true },
  { id: 'bk',     name: 'BROOKLYN',      src: 'assets/maps/bk_wides.png',      city: { fx: 0.840, fy: 0.394 }, thumbName: 'BROOKLYN BRIDGE' },
  { id: 'philly', name: 'PHILLY',        src: 'assets/maps/philly_wide.png',   city: { fx: 0.815, fy: 0.415 }, thumbName: 'INDEPENDENCE HALL' },
  { id: 'dc',     name: 'WASHINGTON DC', src: 'assets/maps/DC_wides.png',      city: { fx: 0.802, fy: 0.477 }, labelBelow: true, thumbName: 'WHITE HOUSE' },
];
MAP_DEFS.forEach(m => { const img = new Image(); img.src = m.src; m._img = img; });

// ---- Map select state ----
let mapSelIdx    = 0;
let mapConfirmed = false; // true while waiting for 2s laugh delay before fight

// ---- Menu navigation cooldown (frames) — prevents moving too fast ----
let menuNavCooldown = 0;
const MENU_NAV_DELAY = 7; // ~117ms between steps

// ---- Tesla sprite preload ----
const teslaImg = new Image();
teslaImg.src = 'assets/characters/musk/tesla_sprite.png';

// ---- Zuck influencer mob sprite preload ----
const zuckMobImg = new Image();
zuckMobImg.src = 'assets/characters/zuck/influencer_mob.png';

// ---- Score (1P mode) ----
let p1Score = 0;

// ---- High score helpers ----
const HS_KEY = 'SFHighScores';
const HS_MAX = 10;
const HS_SEED = [
  { name: 'JNY', score: 420 },
  { name: 'MKE', score: 380 },
  { name: 'SPR', score: 350 },
  { name: 'RND', score: 310 },
];
function loadHighScores() {
  try { const r = localStorage.getItem(HS_KEY); return r ? JSON.parse(r) : HS_SEED.slice(); } catch { return HS_SEED.slice(); }
}
function saveHighScore(name, score) {
  const arr = loadHighScores();
  arr.push({ name, score });
  arr.sort((a, b) => b.score - a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(arr.slice(0, HS_MAX)));
}
function getInsertIdx(scores, score) {
  for (let i = 0; i < scores.length; i++) if (score > scores[i].score) return i;
  return scores.length;
}
const HS_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function nextHsChar(c) { const i = HS_CHARS.indexOf(c); return HS_CHARS[(i + 1) % HS_CHARS.length]; }
function prevHsChar(c) { const i = HS_CHARS.indexOf(c); return HS_CHARS[(i - 1 + HS_CHARS.length) % HS_CHARS.length]; }

// ---- Splash intro state ----
const SPLASH_PATHS = [
  'assets/screens/splash_intro/strip_1.png',
  'assets/screens/splash_intro/Strip_2.png',
  'assets/screens/splash_intro/Strip_3.png',
];
const splashImgs = SPLASH_PATHS.map(src => { const img = new Image(); img.src = src; return img; });
let splashIdx = 0;
let splashStartTime = 0; // rAF timestamp when current strip started
let splashManual = false; // true once user uses arrow keys — disables auto-advance

// ---- Announcer state ----
let finishHimFired = false; // reset each round; fires once when a fighter hits < 20% hp

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
// Zuck influencer mob overlay — { startTime, target } or null
let zuckMobOverlay = null;

// ---- High score screen render state ----
let hsScores       = [];
let hsInitials     = ['A', 'A', 'A'];
let hsCursor       = 0;
let hsInsertIdx    = 0;
let hsScrollOffset = 0;

// ---- UI overlay state ----
let paused       = false;
let pauseMenuIndex = 0;
let practiceMode = false;
let showControls = false;
let showDebug    = false;

// ---- Fighters ----
// Preload sprite sheets for characters that have one
loadSpriteSheet(CHARACTERS['rio']);
loadSpriteSheet(CHARACTERS['zuri']);
loadSpriteSheet(CHARACTERS['dre']);
loadSpriteSheet(CHARACTERS['sid']);
loadSpriteSheet(CHARACTERS['jax']);
loadSpriteSheet(CHARACTERS['zuck']);
loadSpriteSheet(CHARACTERS['altman']);
loadSpriteSheet(CHARACTERS['bezos']);
loadSpriteSheet(CHARACTERS['jensen']);
loadSpriteSheet(CHARACTERS['young_bezos']);
loadSpriteSheet(CHARACTERS['musk']);

// ---- Asset loading gate (image decode preload with progress tracking) ----
// Preloads images via Image objects and waits for actual decode/onload.
// This ensures images are ready to render instantly when needed.
// Fight songs are lazy-loaded on demand (not preloaded).
// TOTAL_ASSET_BYTES is hardcoded from filesystem (run: du -sh assets/ in bytes)
// Update this when adding/replacing assets. Current: ~175MB (maps + sprites + screens + intro music)
const TOTAL_ASSET_BYTES = 175000000;
const loadProgress = { loaded: 0, total: TOTAL_ASSET_BYTES, files: [], ready: false };
let assetsReady = false;

(async () => {
  const ALL_IMAGE_PATHS = [
    // PRIORITY: Loading screen logo (load first so it appears immediately)
    'assets/screens/Rage_Logo.png',
    // Maps
    ...MAP_DEFS.map(m => m.src),
    // Special sprites
    'assets/characters/musk/tesla_sprite.png',
    'assets/characters/zuck/influencer_mob.png',
    // Screen images (loaded by ui.js)
    'assets/screens/vs.png',
    'assets/screens/map.png',
    // Splash intro strips
    ...SPLASH_PATHS,
    // Intro/menu music (preload these; fight songs lazy-load)
    'assets/audio/music/intro.mp3',
    'assets/audio/music/Rage_song.mp4',
    'assets/audio/music/Rage_song2.mp4',
    'assets/audio/music/Rage_song3.mp4',
    // Char select mugs + portraits (loaded by ui.js CHAR_DEFS)
    'assets/characters/sam_altman/altman_mug.png',      'assets/characters/sam_altman/altman_fullbody.png',
    'assets/characters/zuck/zuck_mug.png',              'assets/characters/zuck/zuck_fullbody.png',
    'assets/characters/bezos/jacked_jeff_mug.png','assets/characters/bezos/jacked_jeff_fullbody.png',
    'assets/characters/jensen/jensen_mug.png',          'assets/characters/jensen/jensen_fullbody.png',
    'assets/characters/musk/elon_mugshot.png',          'assets/characters/musk/elon_fullbody.png',
    'assets/characters/young_bezos/skinny_jeff_mug.png','assets/characters/young_bezos/skinny_jeff_fullbody.png',
    'assets/characters/rio/laker_mug.png',            'assets/characters/rio/laker_fullbody.png',
    'assets/characters/zuri/kickboxer_mug.png','assets/characters/zuri/kickboxer_fullbody.png',
    'assets/characters/dre/dread_mug.png',            'assets/characters/dre/dread_fullbody.png',
    'assets/characters/sid/skater_mug.png',          'assets/characters/sid/skater_fullbody.png',
    'assets/characters/jax/tech_mug.png',          'assets/characters/jax/tech_fullbody.png',
    // Character sprite sheets (from CHARACTERS defs)
    ...Object.values(CHARACTERS).flatMap(def => {
      const paths = [];
      if (def.spriteSheet)      paths.push(def.spriteSheet);
      if (def.idleSheet)        paths.push(def.idleSheet);
      if (def.customSheet)      paths.push(def.customSheet);
      if (def.animSheets)       paths.push(...Object.values(def.animSheets).map(s => s.src));
      if (def.overlay?.src)     paths.push(def.overlay.src);
      if (def.projectile?.srcs) paths.push(...def.projectile.srcs);
      return paths;
    }),
  ];

  // Load each image and wait for onload. Track bytes and decode progress.
  function loadImage(path) {
    return new Promise((resolve) => {
      const entry = { name: path.split('/').pop(), path, size: 0, done: false };
      loadProgress.files.push(entry);

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Approximate size from canvas data (width × height × 4 bytes per pixel)
        if (img.complete && img.naturalWidth > 0) {
          entry.size = img.naturalWidth * img.naturalHeight * 4;
        }
        entry.done = true;
        loadProgress.loaded += entry.size;
        resolve();
      };

      img.onerror = () => {
        // Missing asset — renderer.js will handle gracefully
        entry.done = true;
        resolve();
      };

      // Start loading
      img.src = path;
    });
  }

  // Load images in parallel
  await Promise.all(ALL_IMAGE_PATHS.map(loadImage));
  loadProgress.files.sort((a, b) => b.size - a.size);
  loadProgress.ready = true;
  assetsReady = true;
})();

let p1 = new Fighter(CHARACTERS['altman'], 0);
let p2 = new Fighter(CHARACTERS['altman'], 1);

// ---- Fixed timestep accumulator ----
let acc  = 0;
let last = 0;

// ---- Debug: last known input snapshot for P1 (render-only, visual debug) ----
let debugInp = null;
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
    ? (practiceMode ? { left:false, right:false, up:false, down:false, punch:false, heavyPunch:false, kick:false, heavyKick:false, block:false } : cpuSnapshot(p2, p1))
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
    if (msgTimer === 90) { msgText = 'ROUND ' + roundNum; audio.sfxRoundAnnounce(roundNum); }
    if (msgTimer === 40) { msgText = 'FIGHT!'; }
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

    // Freeze the mob target's movement/attacks while the influencer mob is active
    const mobFreeze = inp => ({ ...inp, left: false, right: false, up: false,
                                        punch: false, heavyPunch: false,
                                        kick: false,  heavyKick: false });
    const ei1 = (zuckMobOverlay && zuckMobOverlay.target === p1) ? mobFreeze(i1) : i1;
    const ei2 = (zuckMobOverlay && zuckMobOverlay.target === p2) ? mobFreeze(i2) : i2;

    const events1 = p1.update(ei1, p2);
    const events2 = p2.update(ei2, p1);

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

    // Influencer mob deals light damage to the target once per second while active
    if (zuckMobOverlay) {
      zuckMobOverlay.mobTicks++;
      if (zuckMobOverlay.mobTicks % 60 === 0) {
        const mobEvents = zuckMobOverlay.target.receiveDamage(5, 1.5, zuckMobOverlay.attacker, false);
        processEvents(mobEvents);
      }
    }

    processEvents([...events1, ...events2, ...hitEvents1, ...hitEvents2]);

    // "Finish him" — fire once when either fighter drops below 20% hp
    if (!finishHimFired) {
      const p1Low = p1.hp > 0 && p1.hp / p1.def.stats.hp < 0.2;
      const p2Low = p2.hp > 0 && p2.hp / p2.def.stats.hp < 0.2;
      if (p1Low || p2Low) { audio.sfxFinishHim(); finishHimFired = true; }
    }
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
    if (proj.cols) {
      proj._animTick = (proj._animTick || 0) + 1;
      if (proj._animTick >= 2) {
        proj._animTick = 0;
        proj._animFrame = ((proj._animFrame || 0) + 1) % proj.cols;
      }
    }
    const exitX = getStageWidth() + (proj.w || 0);
    if (Math.abs(proj.x - proj.startX) >= proj.maxRange || proj.x < 0 || proj.x > exitX) {
      proj.active = false;
      continue;
    }
    if (!proj.hasHit) {
      const target = proj.ownerId === 0 ? p2 : p1;
      const hw = target.def.hurtboxW / 2;
      const hh = target.def.hurtboxH;
      if (proj.x > target.x - hw && proj.x < target.x + hw &&
          proj.y > target.y - hh && proj.y < target.y) {
        const events = target.receiveDamage(proj.damage, proj.knockback, proj.owner, false);
        processEvents(events);
        proj.hasHit = true;
      }
    }
  }
  projectiles = projectiles.filter(p => p.active);
}

// ---- Round management ----
function startRound() {
  p1.reset();
  p2.reset();
  resetCpuState();
  roundTimer = 99;
  roundTicks = 0;
  clearParticles();
  projectiles  = [];
  gameState    = 'intro';
  msgText      = '';          // blank for first 60 ticks (1s) before announcement
  msgTimer     = 150;         // 60 tick lead-in + 90 original countdown
  p1GhostHP    = null;
  p2GhostHP    = null;
  koSlideFrame   = null;
  zuckMobOverlay = null;
  finishHimFired = false;
  audio.playFightMusic();
}

function startMatch() {
  p1Wins  = 0;
  p2Wins  = 0;
  roundNum = 1;
  p1Score  = 0;
  startRound();
}

function checkRoundEnd() {
  if (p1.hp <= 0 || p2.hp <= 0 || roundTimer <= 0) {
    gameState = 'roundEnd';
    msgTimer  = 240;
    if (p1.hp <= 0) {
      p2Wins++;
      msgText = p2.tookDamage ? 'K.O.!' : 'PERFECT!';
    } else if (p2.hp <= 0) {
      p1Wins++;
      msgText = p1.tookDamage ? 'K.O.!' : 'PERFECT!';
      if (gameMode === '1p') {
        p1Score += 200;
        if (!p1.tookDamage) p1Score += 500;
        p1Score += Math.floor(roundTimer) * 5;
      }
    } else if (p1.hp > p2.hp) {
      p1Wins++;
      msgText = 'TIME!';
      if (gameMode === '1p') { p1Score += 200 + Math.floor(roundTimer) * 5; }
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
    if ((ev.type === 'hit' || ev.type === 'ko') && ev.scoreAward && ev.scorerId === 0 && gameMode === '1p') {
      p1Score += ev.scoreAward;
    }
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
      audio.sfxFighterKO(ev.voiceSet);
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
      audio.sfxJump(ev.voiceSet);
    }
    if (ev.type === 'crouch_grunt') {
      audio.sfxCrouch(ev.voiceSet);
    }
    if (ev.type === 'attack_grunt') {
      audio.sfxAttack(ev.voiceSet);
    }
    if (ev.type === 'recoil_grunt') {
      audio.sfxRecoil(ev.voiceSet);
    }
    if (ev.type === 'combo4') {
      audio.sfxCombo4();
    }
    if (ev.type === 'combo5') {
      const attacker = ev.attackerId === 0 ? p1 : p2;
      if (attacker.def.id === 'zuck') {
        const target = ev.attackerId === 0 ? p2 : p1;
        zuckMobOverlay = { startTime: null, target, attacker, mobTicks: 0 };
      }
      if (attacker.def.id === 'musk' && !projectiles.some(p => p.img === teslaImg)) {
        projectiles.push({
          x: -110,
          y: GROUND - 20,
          vx: 9,
          vy: 0,
          img: teslaImg,
          frameW: 1280, frameH: 720, cols: 1,
          frameCropX: 155, frameCropW: 975,
          w: 316, h: 234,
          damage: 20,
          knockback: 5.0,
          angle: 0,
          angleSpeed: 0,
          gravity: 0,
          startX: -110,
          maxRange: 1200,
          owner: attacker,
          ownerId: ev.attackerId,
          active: true,
        });
      }
    }
  }
}

// ---- Zuck influencer mob overlay ----
// 25-frame strip (1792×720 each), spread evenly across 3s in front of the opponent.
const ZUCK_MOB_COLS      = 25;
const ZUCK_MOB_FRAMEW    = 1792;
const ZUCK_MOB_FRAMEH    = 720;
const ZUCK_MOB_DURATION  = 3000; // ms total
const ZUCK_MOB_CROP_LEFT = 3;    // strip left pixels to hide black edge line
const ZUCK_MOB_W         = 560;  // display width on canvas
const ZUCK_MOB_H         = Math.round(ZUCK_MOB_W * (ZUCK_MOB_FRAMEH / ZUCK_MOB_FRAMEW));
const ZUCK_MOB_FADE_W    = 48;   // edge fade width in display pixels
let   _zuckMobOffscreen  = null; // reused offscreen canvas for gradient masking

function drawZuckMob(renderTime) {
  if (!zuckMobOverlay) return;
  if (!zuckMobImg.complete || zuckMobImg.naturalWidth === 0) return;

  if (zuckMobOverlay.startTime === null) zuckMobOverlay.startTime = renderTime;

  const elapsed = renderTime - zuckMobOverlay.startTime;
  if (elapsed >= ZUCK_MOB_DURATION) { zuckMobOverlay = null; return; }

  // Spread all 25 frames evenly across the full 3s; hold last frame at the end
  const frame = Math.min(Math.floor(elapsed / (ZUCK_MOB_DURATION / ZUCK_MOB_COLS)), ZUCK_MOB_COLS - 1);

  const target = zuckMobOverlay.target;
  const dx = Math.round(target.x - getCameraX() - ZUCK_MOB_W / 2);
  const dy = Math.round(GROUND - ZUCK_MOB_H);

  // Draw frame (with left crop) into an offscreen canvas, then fade edges
  if (!_zuckMobOffscreen) {
    _zuckMobOffscreen = document.createElement('canvas');
    _zuckMobOffscreen.width  = ZUCK_MOB_W;
    _zuckMobOffscreen.height = ZUCK_MOB_H;
  }
  const oc  = _zuckMobOffscreen;
  const oct = oc.getContext('2d');

  oct.clearRect(0, 0, ZUCK_MOB_W, ZUCK_MOB_H);
  oct.globalCompositeOperation = 'source-over';
  oct.imageSmoothingEnabled = true;
  oct.drawImage(
    zuckMobImg,
    frame * ZUCK_MOB_FRAMEW + ZUCK_MOB_CROP_LEFT, 0,
    ZUCK_MOB_FRAMEW - ZUCK_MOB_CROP_LEFT, ZUCK_MOB_FRAMEH,
    0, 0, ZUCK_MOB_W, ZUCK_MOB_H
  );

  // Knock out edge pixels using destination-in gradient masks
  // Erase edge pixels using destination-out (only affects the filled rects, middle untouched)
  oct.globalCompositeOperation = 'destination-out';

  const lgL = oct.createLinearGradient(0, 0, ZUCK_MOB_FADE_W, 0);
  lgL.addColorStop(0, 'rgba(0,0,0,1)'); // fully erased at far left
  lgL.addColorStop(1, 'rgba(0,0,0,0)'); // untouched at inner edge of fade
  oct.fillStyle = lgL;
  oct.fillRect(0, 0, ZUCK_MOB_FADE_W, ZUCK_MOB_H);

  const lgR = oct.createLinearGradient(ZUCK_MOB_W - ZUCK_MOB_FADE_W, 0, ZUCK_MOB_W, 0);
  lgR.addColorStop(0, 'rgba(0,0,0,0)'); // untouched at inner edge of fade
  lgR.addColorStop(1, 'rgba(0,0,0,1)'); // fully erased at far right
  oct.fillStyle = lgR;
  oct.fillRect(ZUCK_MOB_W - ZUCK_MOB_FADE_W, 0, ZUCK_MOB_FADE_W, ZUCK_MOB_H);

  oct.globalCompositeOperation = 'source-over';

  // Stamp onto main canvas, bypassing screen-shake transform
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(oc, dx + getOverscanX(), dy);
  ctx.restore();
}

// ---- Render ----
// renderTime is the raw rAF timestamp (wall ms) used for visual-only animations.
function render(renderTime) {
  // Smooth upscaling for screens with detailed artwork; pixelated for gameplay
  const smooth = gameState === 'loading' || gameState === 'splash';
  canvas.style.imageRendering = smooth ? 'auto' : 'pixelated';

  // Clear full canvas (including overscan wings)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Center game area in wider canvas (overscan for ultra-wide monitors)
  const osX = getOverscanX();

  // Decay screen shake
  screenShake *= 0.8;
  if (screenShake < 0.4) screenShake = 0;

  // Loading screen — wait for all assets, then gate on user interaction (unblocks audio autoplay)
  if (gameState === 'loading') {
    ctx.save(); ctx.translate(osX, 0);
    drawLoading(ctx, loadProgress, renderTime);
    ctx.restore();
    if (assetsReady && input.isAnyKey()) {
      audio.initAudio();
      splashIdx = 0;
      splashStartTime = renderTime;
      splashManual = false;
      gameState = 'splash';
      audio.playMusic('assets/audio/music/Rage_main_intro.mp4');
      input.clearFrame();
    }
    return;
  }

  // Splash intro — show 3 comic strips in sequence, navigate with arrows
  if (gameState === 'splash') {
    const elapsed = renderTime - splashStartTime;
    let advanced = false;
    // Once user navigates with arrows, disable auto-advance entirely
    if (input.isMenuRight() || input.isMenuLeft()) splashManual = true;
    const holdMs = splashIdx === 0 ? 25000 : 15000;
    const timerFired = !splashManual && elapsed >= holdMs;
    if (input.isMenuRight() || timerFired) {
      if (splashIdx < splashImgs.length - 1) {
        splashIdx++;
        splashStartTime = renderTime;
        advanced = true;
      } else {
        // Past last strip — go to title
        audio.playMusic('assets/audio/music/Rage_main_intro.mp4');
        resetTitleMenu();
        gameState = 'title';
        input.clearFrame();
      }
    }
    if (!advanced && input.isMenuLeft() && splashIdx > 0) {
      splashIdx--;
      splashStartTime = renderTime;
    }
    input.clearFrame();
    const stripAge = renderTime - splashStartTime;
    ctx.save(); ctx.translate(osX, 0);
    drawSplash(ctx, splashImgs[Math.min(splashIdx, splashImgs.length - 1)], splashIdx, splashImgs.length, stripAge);
    ctx.restore();
    return;
  }

  // View scores (from title TOP SCORES → SEE MORE)
  if (gameState === 'viewScores') {
    if (input.isMenuConfirm() || input.isEscapeKey()) {
      resetTitleMenu();
      gameState = 'title';
      input.clearFrame();
    }
    ctx.save(); ctx.translate(osX, 0);
    drawViewScores(ctx, renderTime);
    ctx.restore();
    return;
  }

  // Title screen
  if (gameState === 'title') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    if (input.isEscapeKey()) {
      splashIdx = 0;
      splashStartTime = renderTime;
      splashManual = true; // returning from menu — no auto-advance
      gameState = 'splash';
      input.clearFrame();
    }
    if (menuNavCooldown === 0 && input.isMenuUp())   { menuUp();   audio.sfxScroll(); menuNavCooldown = MENU_NAV_DELAY; }
    if (menuNavCooldown === 0 && input.isMenuDown()) { menuDown(); audio.sfxScroll(); menuNavCooldown = MENU_NAV_DELAY; }
    if (input.isMenuConfirm()) {
      const sel = getTitleMenuIndex();
      if (sel === 3) {
        // TOP SCORES (SEE MORE virtual slot)
        gameState = 'viewScores';
        input.clearFrame();
      } else if (sel === 0 || sel === 1) {
        // VERSUS MODE (0) or PRACTICE MODE (1)
        gameMode     = '1p';
        practiceMode = sel === 1;
        audio.sfxConfirmation();
        setTimeout(() => audio.sfxTestLuck(), 1000);
        p1SelIdx         = 0;
        p2SelIdx         = 1;
        p1Confirmed      = false;
        p2Confirmed      = false;
        charSelectDelay  = 0;
        gameState        = 'charSelect';
        menuNavCooldown  = MENU_NAV_DELAY;
        input.clearFrame();
      }
    }
    ctx.save(); ctx.translate(osX, 0);
    drawTitle(ctx, drawBG, renderTime);
    ctx.restore();
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
        resetTitleMenu();
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
      if (input.isMenuConfirm()) { p1SelIdx = resolveRandom(p1SelIdx); p1Confirmed = true; audio.sfxConfirmation(); setTimeout(() => audio.sfxCharSelect(), 500); }
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
    ctx.save(); ctx.translate(osX, 0);
    drawCharSelect(ctx, drawBG, renderTime, {
      p1SelIdx, p2SelIdx, p1Confirmed, p2Confirmed, gameMode,
    });
    ctx.restore();
    return;
  }

  if (gameState === 'mapSelect') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    // ESC: back to char select (reset confirms so both players re-pick)
    if (!mapConfirmed && input.isEscapeKey()) {
      p1Confirmed      = false;
      p2Confirmed      = false;
      charSelectDelay  = 0;
      gameState        = 'charSelect';
      menuNavCooldown  = MENU_NAV_DELAY;
      input.clearFrame();
    }
    if (!mapConfirmed && menuNavCooldown === 0 && input.isMenuLeft())  { mapSelIdx = (mapSelIdx + MAP_DEFS.length - 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    if (!mapConfirmed && menuNavCooldown === 0 && input.isMenuRight()) { mapSelIdx = (mapSelIdx + 1) % MAP_DEFS.length; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    if (!mapConfirmed && menuNavCooldown === 0 && input.isMenuUp()) {
      const ROW1 = 3;
      if (mapSelIdx >= ROW1) { mapSelIdx = mapSelIdx - ROW1; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    }
    if (!mapConfirmed && menuNavCooldown === 0 && input.isMenuDown()) {
      const ROW1 = 3, row2Len = MAP_DEFS.length - ROW1;
      if (mapSelIdx < ROW1) { mapSelIdx = ROW1 + Math.min(mapSelIdx, row2Len - 1); menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    }
    if (!mapConfirmed && input.isMenuConfirm()) {
      mapConfirmed = true;
      audio.sfxConfirmation();
      setActiveBG(MAP_DEFS[mapSelIdx]._img);
      const d1 = CHARACTERS[CHAR_IDS[p1SelIdx]];
      const d2 = CHARACTERS[CHAR_IDS[p2SelIdx]];
      const sw = getStageWidth();
      p1 = new Fighter({ ...d1, startX: Math.round(sw / 2 - 100), facing:  1 }, 0);
      p2 = new Fighter({ ...d2, startX: Math.round(sw / 2 + 100), facing: -1 }, 1);
      p1Wins  = 0;
      p2Wins  = 0;
      roundNum = 1;
      p1Score  = 0;
      input.clearFrame();
      audio.sfxLaughWithDelay(() => { mapConfirmed = false; startRound(); }, 1000);
    }
    ctx.save(); ctx.translate(osX, 0);
    drawMapSelect(ctx, renderTime, { mapSelIdx, maps: MAP_DEFS });
    ctx.restore();
    return;
  }

  // High score entry (1P win only)
  if (gameState === 'highScore') {
    if (menuNavCooldown > 0) menuNavCooldown--;
    const onBoard = hsInsertIdx < HS_MAX;
    if (onBoard) {
      // Direct keyboard typing
      const typed = input.getTypedLetter();
      if (typed) {
        hsInitials[hsCursor] = typed;
        if (hsCursor < 2) hsCursor++;
        audio.sfxScroll();
      }
      if (input.getBackspace() && hsCursor > 0) {
        hsCursor--;
        hsInitials[hsCursor] = 'A';
        audio.sfxScroll();
      }
      // Up/down still cycle letters on current slot
      if (menuNavCooldown === 0 && input.isMenuUp())    { hsInitials[hsCursor] = prevHsChar(hsInitials[hsCursor]); menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuDown())  { hsInitials[hsCursor] = nextHsChar(hsInitials[hsCursor]); menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuLeft()  && hsCursor > 0) { hsCursor--; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
      if (menuNavCooldown === 0 && input.isMenuRight() && hsCursor < 2) { hsCursor++; menuNavCooldown = MENU_NAV_DELAY; audio.sfxScroll(); }
    }
    if (input.isMenuConfirm()) {
      if (onBoard) saveHighScore(hsInitials.join(''), p1Score);
      audio.sfxConfirmation();
      audio.playMusic('assets/audio/music/Rage_main_intro.mp4');
      p1SelIdx    = 0;
      p2SelIdx    = 1;
      p1Confirmed = false;
      p2Confirmed = false;
      gameState   = 'charSelect';
      input.clearFrame();
    }
    // Smooth auto-scroll to center the player's entry row
    const targetScroll = Math.max(0, 70 + hsInsertIdx * 24 - 180);
    hsScrollOffset += (targetScroll - hsScrollOffset) * 0.08;
    ctx.save(); ctx.translate(osX, 0);
    drawHighScore(ctx, renderTime, { scores: hsScores, playerScore: p1Score, initials: hsInitials, cursor: hsCursor, insertIdx: hsInsertIdx, scrollOffset: Math.round(hsScrollOffset) });
    ctx.restore();
    return;
  }

  // Match end — Enter: char select  |  Escape: title
  if (gameState === 'matchEnd' && msgTimer <= -30) {
    // In 1P mode when P1 wins, auto-transition to high score entry
    if (gameMode === '1p' && p1Wins >= 2) {
      hsScores       = loadHighScores();
      hsInitials     = ['A', 'A', 'A'];
      hsCursor       = 0;
      hsInsertIdx    = getInsertIdx(hsScores, p1Score);
      hsScrollOffset = 0;
      menuNavCooldown = MENU_NAV_DELAY;
      gameState = 'highScore';
      input.clearFrame();
      return;
    }
    if (input.isMenuConfirm()) {
      audio.initAudio();
      audio.playMusic('assets/audio/music/Rage_main_intro.mp4');
      p1SelIdx    = 0;
      p2SelIdx    = 1;
      p1Confirmed = false;
      p2Confirmed = false;
      gameState   = 'charSelect';
    }
    if (input.isEscapeKey()) {
      audio.playMusic('assets/audio/music/Rage_main_intro.mp4');
      resetTitleMenu();
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
  updateCamera(p1, p2);
  const camX = getCameraX();

  ctx.save();
  ctx.translate(osX, 0);
  applyScreenShake(screenShake);

  // Background draws in screen space (parallax handled internally, fills overscan)
  drawBG(renderTime);

  // World-space objects: translate by camera
  ctx.save();
  ctx.translate(-camX, 0);
  drawShadow(p1);
  drawShadow(p2);
  drawFighterPlaceholder(p1, renderTime);
  drawFighterPlaceholder(p2, renderTime);
  drawOverlays(p1, p2, renderTime);
  drawProjectiles(projectiles);
  drawParticles(ctx);
  ctx.restore(); // end world-space translate

  // HUD in screen space (still inside shake block)
  drawHUD(ctx, { p1, p2, p1Wins, p2Wins, roundTimer, roundNum, renderTime, p1GhostHP, p2GhostHP, p1Score, gameMode });
  // Suppress text message while KO door-slide is running
  if (koSlideFrame === null) drawMessage(ctx, msgText);

  ctx.restore(); // end shake + overscan block

  // Zuck mob overlay — drawn outside screen-shake block so KO slide can't bury it
  drawZuckMob(renderTime);

  // Post-shake screen-space elements — apply overscan offset
  ctx.save();
  ctx.translate(osX, 0);

  // Pause toggle (1P only, during fight)
  if (gameMode === '1p' && gameState === 'fight' && (input.isPauseKey() || input.isEscapeKey())) {
    paused = !paused;
    if (paused) pauseMenuIndex = 0;
  }
  // Interactive pause menu
  if (paused) {
    const pauseItems = practiceMode ? ['RESUME', 'QUIT TO MENU'] : ['RESUME', 'DIFFICULTY', 'QUIT TO MENU'];
    const maxIdx = pauseItems.length - 1;
    if (input.isMenuUp())   pauseMenuIndex = Math.max(0, pauseMenuIndex - 1);
    if (input.isMenuDown()) pauseMenuIndex = Math.min(maxIdx, pauseMenuIndex + 1);
    // Difficulty adjustment (left/right on difficulty row, versus mode only)
    if (!practiceMode && pauseMenuIndex === 1) {
      if (input.isMenuLeft())  setCpuDifficulty(getCpuDifficulty() - 1);
      if (input.isMenuRight()) setCpuDifficulty(getCpuDifficulty() + 1);
    }
    if (input.isMenuConfirm()) {
      if (pauseMenuIndex === 0) paused = false; // Resume
      if (pauseMenuIndex === maxIdx) { paused = false; setActiveBG(null); audio.playMusic('assets/audio/music/Rage_main_intro.mp4'); resetTitleMenu(); gameState = 'title'; } // Quit
    }
    if (input.isEscapeKey()) { paused = false; }
    drawPauseOverlay(ctx, { pauseMenuIndex, difficulty: getCpuDifficulty(), practiceMode });
  }

  // Debug overlay toggle (I key)
  if (input.isDebugKey()) showDebug = !showDebug;

  // Controls overlay (any state, Tab to toggle)
  if (input.isTabKey()) showControls = !showControls;
  if (showControls) drawControlsOverlay(ctx, p1.def, p2.def);

  if (showDebug && (gameState === 'fight' || gameState === 'roundEnd')) {
    ctx.save();
    ctx.translate(-getCameraX(), 0);
    drawDebugHitboxes(p1, p2);
    ctx.restore();
    drawDebugConsole(p1, p2);
  }

  ctx.restore(); // end post-shake overscan
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
