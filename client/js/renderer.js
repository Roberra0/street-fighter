// renderer.js — all canvas draw calls

const GW = 640;
const GH = 360;
const GROUND = 340;

export const canvas = document.getElementById('c');
export const ctx    = canvas.getContext('2d');

canvas.width  = GW;
canvas.height = GH;

export function resize() {
  const s  = Math.min(window.innerWidth / GW, window.innerHeight / GH);
  const sw = Math.floor(GW * s);
  const sh = Math.floor(GH * s);
  canvas.style.width  = sw + 'px';
  canvas.style.height = sh + 'px';
}

resize();
window.addEventListener('resize', resize);

// ---- Active background map ----
let _activeBG = null;
export function setActiveBG(img) { _activeBG = img; }

// ---- Background ----

export function drawBG() {
  if (_activeBG && _activeBG.complete && _activeBG.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(_activeBG, 0, 0, GW, GH);
  } else {
    // fallback dark background until image loads
    ctx.fillStyle = '#0e0620';
    ctx.fillRect(0, 0, GW, GH);
  }
  // Ground shadow strip so fighters have a visual floor reference
  const g = ctx.createLinearGradient(0, GROUND - 8, 0, GH);
  g.addColorStop(0, '#00000000');
  g.addColorStop(1, '#00000088');
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND - 8, GW, GH - GROUND + 8);
}

// ---- Fighter shadow ----
export function drawShadow(fighter) {
  ctx.fillStyle = '#0004';
  const sw = 20 + (GROUND - fighter.y) * 0.08;
  ctx.fillRect(Math.round(fighter.x - sw / 2), GROUND + 2, Math.round(sw), 3);
}

// ---- Fighter placeholder renderer ----
// ---- Sprite sheet support ----

const SHEET_COLS = 8;
const FRAME_W    = 64;
const FRAME_H    = 80;

// Maps game state → sheet frame range.
// Indices match the grid assembled in ryu_sheet.png.
const _SHEET_ANIM = {
  idle:       { start: 0,  count: 4 },
  walk:       { start: 4,  count: 4 },
  walkBack:   { start: 8,  count: 4 },
  crouch:     { start: 12, count: 2 },
  jumpRise:   { start: 16, count: 2 },
  jumpPeak:   { start: 18, count: 2 },
  jumpFall:   { start: 20, count: 2 },
  land:       { start: 22, count: 2 },
  punch:      { start: 24, count: 4 },
  kick:       { start: 28, count: 4 },
  heavyPunch: { start: 32, count: 5 },
  heavyKick:  { start: 37, count: 5 },
  block:      { start: 44, count: 2 },
  hit:        { start: 48, count: 2 },
  airHit:     { start: 48, count: 2 },
  ko:         { start: 52, count: 8 },
  special:    { start: 60, count: 4 },
};

function _sheetFrameIdx(fighter) {
  const state = fighter.state;
  const f     = fighter.animFrame;
  let anim;
  if (state === 'jump') {
    if (fighter.vy < -1.5)    anim = _SHEET_ANIM.jumpRise;
    else if (fighter.vy < 1.5) anim = _SHEET_ANIM.jumpPeak;
    else                       anim = _SHEET_ANIM.jumpFall;
  } else if (state === 'walk') {
    anim = (fighter.vx * fighter.facing >= 0) ? _SHEET_ANIM.walk : _SHEET_ANIM.walkBack;
  } else if (state.startsWith('special')) {
    anim = _SHEET_ANIM.special;
  } else {
    anim = _SHEET_ANIM[state] || _SHEET_ANIM.idle;
  }
  return anim.start + (f % anim.count);
}

// Call once at startup for any def that has a spriteSheet or idleSheet path.
export function loadSpriteSheet(def) {
  if (def.spriteSheet && !def._spriteImage) {
    const img = new Image();
    img.src = def.spriteSheet;
    def._spriteImage = img;
  }
  if (def.idleSheet && !def._idleImage) {
    const img = new Image();
    img.src = def.idleSheet;
    def._idleImage = img;
  }
  if (def.customSheet && !def._customSheetImage) {
    const img = new Image();
    img.src = def.customSheet;
    def._customSheetImage = img;
  }
  if (def.animSheets && !def._animSheetImages) {
    def._animSheetImages = {};
    for (const [key, sheet] of Object.entries(def.animSheets)) {
      const img = new Image();
      img.src = sheet.src;
      def._animSheetImages[key] = img;
    }
  }
  if (def.overlay && !def.overlay._img) {
    const img = new Image();
    img.src = def.overlay.src;
    def.overlay._img = img;
  }
  if (def.projectile && def.projectile.srcs && !def.projectile._imgs) {
    def.projectile._imgs = def.projectile.srcs.map(src => {
      const img = new Image(); img.src = src; return img;
    });
    def.projectile._idx = 0;
  }
}

export function drawProjectiles(projs) {
  for (const proj of projs) {
    if (!proj.active) continue;
    const img = proj.img;
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    ctx.save();
    ctx.translate(Math.round(proj.x), Math.round(proj.y));
    ctx.rotate(proj.angle);
    ctx.imageSmoothingEnabled = false;
    if (proj.frameW && proj.cols) {
      const frame   = (proj._animFrame || 0) % proj.cols;
      const cropX   = proj.frameCropX || 0;
      const cropW   = proj.frameCropW || proj.frameW;
      ctx.drawImage(img, frame * proj.frameW + cropX, 0, cropW, proj.frameH, -proj.w / 2, -proj.h / 2, proj.w, proj.h);
    } else {
      ctx.drawImage(img, -proj.w / 2, -proj.h / 2, proj.w, proj.h);
    }
    ctx.restore();
  }
}

// Draw overlays that appear over the opponent (e.g. telekinesis effect above head).
export function drawOverlays(p1, p2, renderTime) {
  for (const [attacker, target] of [[p1, p2], [p2, p1]]) {
    const ov = attacker.def.overlay;
    if (!ov) continue;
    if (!ov.states.includes(attacker.state)) continue;
    const img = ov._img;
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    const tx = Math.round(target.x);
    const stateOffset = ov.stateOffsets?.[attacker.state] ?? (ov.offsetY || 0);
    const ty = Math.round(target.y + stateOffset);
    const frame = ov.cols
      ? Math.floor((renderTime / (1000 / (ov.fps || 24))) % ov.cols)
      : 0;
    const sx = frame * ov.frameW;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, 0, ov.frameW, ov.frameH, tx - ov.w / 2, ty - ov.h / 2, ov.w, ov.h);
    ctx.restore();
  }
}

// Dispatches to per-character draw functions based on fighter.def.id.
// All draw functions use renderTime for visual-only animation (idle bob, walk swing).
export function drawFighterPlaceholder(fighter, renderTime) {
  const px = Math.round(fighter.x);
  const py = Math.round(fighter.y);

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(fighter.facing, 1);

  if ((fighter.state === 'hit' || fighter.state === 'airHit') && fighter.stunTimer % 4 < 2) ctx.globalAlpha = 0.55;

  // Per-animation multi-sheet system
  if (fighter.def._animSheetImages) {
    const stateKey =
      (fighter.state === 'heavyPunch' || fighter.state.startsWith('special_') || fighter.state === 'super') ? 'punch' :
      fighter.state === 'heavyKick'  ? 'kick'   :
      (fighter.state === 'block' && fighter.def.animSheets?.block) ? 'block' :
      (fighter.state === 'ko'   && fighter.def.animSheets?.ko)    ? 'ko'    :
      (fighter.state === 'hit' || fighter.state === 'airHit' || fighter.state === 'block' ||
       fighter.state === 'ko'  || fighter.state === 'dash' ||
       fighter.state === 'backdash') ? 'recoil' :
      fighter.state === 'walkFinish'   ? 'walk'   :
      fighter.state === 'crouchFinish' ? 'crouch' :
      fighter.state;
    const imgs    = fighter.def._animSheetImages;
    const sheet   = fighter.def.animSheets[stateKey] || fighter.def.animSheets.idle;
    const img     = imgs[stateKey] || imgs.idle;
    if (img && img.complete && img.naturalWidth > 0 && sheet) {
      const fw      = sheet.frameW;
      const fh      = sheet.frameH;
      const cols    = sheet.cols;
      const div     = fighter.def.animSheetDivisor || 1;
      const scaleX  = fighter.def.animSheetScale  || 1;
      const scaleY  = fighter.def.animSheetScaleY !== undefined ? fighter.def.animSheetScaleY : scaleX;
      const cropX   = sheet.cropX !== undefined ? sheet.cropX : (fighter.def.animSheetCropX !== undefined ? fighter.def.animSheetCropX : 0);
      const cropW   = sheet.cropW !== undefined ? sheet.cropW : (fighter.def.animSheetCropW !== undefined ? fighter.def.animSheetCropW : fw);
      const cropY   = sheet.cropY !== undefined ? sheet.cropY : (fighter.def.animSheetCropY !== undefined ? fighter.def.animSheetCropY : 0);
      const cropH   = fh - cropY;
      const destW   = (cropW / div) * scaleX;
      const destH   = (cropH / div) * scaleY;
      const offsetY = ((fighter.def.animSheetOffsetY || 0) / div) * scaleY;
      const animDef = fighter.def.animations?.[stateKey];
      const seq     = animDef?.frameSequence;
      const f       = seq ? seq[Math.min(fighter.animFrame, seq.length - 1)] : fighter.animFrame + (sheet.frameOffset || 0);
      const col     = f % cols;
      const row     = Math.floor(f / cols);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * fw + cropX, row * fh + cropY, cropW, cropH, -destW / 2, -destH + offsetY, destW, destH);
      ctx.restore();
      drawComboCounter(fighter, px, py, renderTime);
      return;
    }
  }

  // Per-state sheet: use idleSheet when in idle state
  const idleImg = fighter.state === 'idle' ? fighter.def._idleImage : null;
  if (idleImg && idleImg.complete && idleImg.naturalWidth > 0) {
    const cols  = fighter.def.idleSheetCols || 4;
    const fw    = fighter.def.idleFrameW   || 256;
    const fh    = fighter.def.idleFrameH   || 455;
    const f     = fighter.animFrame % (fighter.def.animations.idle?.frames || 12);
    const div     = fighter.def.idleSheetDivisor || 2;
    const destW   = fw / div;
    const destH   = fh / div;
    const offsetY = (fighter.def.idleSheetOffsetY || 0) / div;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(idleImg, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh, -destW / 2, -destH + offsetY, destW, destH);
    ctx.restore();
  // Custom per-character full sprite sheet (all states)
  } else if (fighter.def._customSheetImage && fighter.def.customSheetAnims) {
    const img = fighter.def._customSheetImage;
    if (img.complete && img.naturalWidth > 0) {
      const animMap = fighter.def.customSheetAnims;
      const stateKey = fighter.state.startsWith('special_') ? 'special' :
                       fighter.state === 'super' ? 'super' : fighter.state;
      const anim  = animMap[stateKey] || animMap.idle;
      const cols  = fighter.def.customSheetCols || 10;
      const fw    = fighter.def.customFrameW    || 1102;
      const fh    = fighter.def.customFrameH    || 712;
      const div   = fighter.def.customSheetDivisor || 10;
      const f     = fighter.animFrame % anim.count;
      const fi    = anim.start + f;
      const col   = fi % cols;
      const row   = Math.floor(fi / cols);
      // Optional source crop — trims whitespace padding from each frame
      const cropX = fighter.def.customSrcCropX !== undefined ? fighter.def.customSrcCropX : 0;
      const cropY = fighter.def.customSrcCropY !== undefined ? fighter.def.customSrcCropY : 0;
      const cropW = fighter.def.customSrcCropW !== undefined ? fighter.def.customSrcCropW : fw;
      const cropH = fighter.def.customSrcCropH !== undefined ? fighter.def.customSrcCropH : fh;
      const destW   = cropW / div;
      const destH   = cropH / div;
      const offsetY = (fighter.def.customSheetOffsetY || 0) / div;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * fw + cropX, row * fh + cropY, cropW, cropH, -destW / 2, -destH + offsetY, destW, destH);
    }
    ctx.restore();
  // Full sprite sheet — use it for all states
  } else {
    const sprImg = fighter.def._spriteImage;
    if (sprImg && sprImg.complete && sprImg.naturalWidth > 0) {
      const fi  = _sheetFrameIdx(fighter);
      const col = fi % SHEET_COLS;
      const row = Math.floor(fi / SHEET_COLS);
      ctx.drawImage(sprImg, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, -32, -FRAME_H, FRAME_W, FRAME_H);
      ctx.restore();
    } else {
      // Dispatch to per-character primitive renderer.
      // Scale 3x so placeholder chars match the visual height of sprite-sheet chars.
      // Feet are drawn at y≈0 in local space; scaling about the origin keeps them at GROUND.
      ctx.scale(3, 3);
      const id = fighter.def.id;
      _drawRyu(fighter, renderTime);
      ctx.restore();
    }
  }

  drawComboCounter(fighter, px, py, renderTime);
}

function drawComboCounter(fighter, px, py, renderTime) {
  if (fighter.comboCt <= 1 || fighter.comboTimer <= 0) return;
  const ct = fighter.comboCt;
  let fontSize, color, yShake;
  if (ct === 2) {
    fontSize = 16; color = '#ffffff'; yShake = 0;
  } else if (ct === 3) {
    fontSize = 20; color = '#ffee00'; yShake = 0;
  } else {
    fontSize = 26;
    color    = ct >= 6 ? '#ff2200' : '#ff8800';
    yShake   = Math.round(Math.sin(renderTime / 60) * 2);
  }
  ctx.save();
  ctx.font      = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  // Dark outline for legibility
  ctx.strokeStyle = '#000000';
  ctx.lineWidth   = 3;
  ctx.strokeText(ct + ' HITS!', px, py - 68 + yShake);
  ctx.fillStyle = color;
  ctx.fillText(ct + ' HITS!', px, py - 68 + yShake);
  ctx.restore();
}

// ---- Shared helpers ----

// Quick filled rectangle. x,y,w,h in local (already-translated) coords, c = CSS color.
function R(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w, h);
}

// ============================================================
// RYU — classic archetype
// ============================================================
function _drawRyu(fighter, renderTime) {
  const P     = fighter.def.palette;
  const state = fighter.state;
  const t     = fighter.timer;
  const frame = fighter.animFrame;

  // ---- KO ----
  if (state === 'ko') {
    if (fighter.grounded) {
      // Flat on ground — horizontal layout
      R(-22, -8,  44, 8,  P.body);
      R(-18, -12, 12, 10, P.skin);
      R(-18, -16, 12,  6, P.hair);
      R(  6,  -6, 18,  6, P.pants);
      R( 18,  -3,  8,  3, P.shoes);
    } else {
      // Airborne KO — tumbling
      const tumble = frame % 2 === 0 ? 0 : 2;
      R(-8,  -52 + tumble, 16,  8, P.hair);
      R(-8,  -44 + tumble, 16, 12, P.skin);
      R(-10, -32,          20, 20, P.body);
      R(-8,  -12,           8, 16, P.pants);
      R( 2,  -12,           8, 16, P.pants);
      R(-16, -28,           6,  6, P.skin);
      R( 14, -28,           6,  6, P.skin);
    }
    return;
  }

  // ---- Crouch ----
  if (state === 'crouch') {
    // Body squished to ~60% height — squat diamond silhouette
    R(-7,  -34, 14,  6, P.hair);
    R(-7,  -28, 14, 10, P.skin);
    R(-8,  -24, 16,  3, P.accent); // headband visible even crouched
    R( 2,  -24,  3,  2, '#111');   // nose
    // Shortened torso
    R(-10, -18, 20, 12, P.body);
    R(-10,  -6, 20,  3, P.belt);
    // Arms flared to sides — one forward, one back
    R( 10, -16,  8,  6, P.skin);
    R(-14, -14,  6,  6, P.skin);
    // Legs bent outward — wide squat blocks
    R(-10,  -3, 10,  8, P.pants);
    R(  2,  -3, 10,  8, P.pants);
    R( -8,   0, 10,  4, P.shoes);
    R(  2,   0, 10,  4, P.shoes);
    return;
  }

  // ---- Block ----
  if (state === 'block') {
    R(-7,  -54, 14,  7, P.hair);
    R(-7,  -48, 14, 10, P.skin);
    R(-8,  -48, 16,  3, P.accent);
    R( 2,  -44,  3,  2, '#111');
    R(-10, -38, 20, 18, P.body);
    // Both arms raised in guard — forward arm shields the head
    R( -2, -40, 12, 14, P.skin); // forearms up
    R(-12, -40,  6, 10, P.skin);
    R(-10, -20, 20,  3, P.belt);
    R(-8,  -17,  8, 17, P.pants);
    R(  2, -17,  8, 17, P.pants);
    R(-8,    0, 10,  4, P.shoes);
    R(  2,   0, 10,  4, P.shoes);
    return;
  }

  // ---- Hit / Air Hit (hurt) ----
  if (state === 'hit' || state === 'airHit') {
    // Body jerks back — head tilted, slight backward offset
    const jerk = frame === 0 ? -3 : -2;
    R(-7  + jerk, -54,  14,  7, P.hair);
    R(-7  + jerk, -48,  14, 10, P.skin);
    R(-8  + jerk, -48,  16,  3, P.accent);
    R(-10 + jerk, -38,  20, 18, P.body);
    R(-12,        -36,   7,  6, P.skin);
    R( 10,        -36,   7,  6, P.skin);
    R(-10,        -20,  20,  3, P.belt);
    R(-8,         -17,   8, 17, P.pants);
    R(  2,        -17,   8, 17, P.pants);
    R(-8,           0,  10,  4, P.shoes);
    R(  2,          0,  10,  4, P.shoes);
    return;
  }

  // ---- Punch ----
  if (state === 'punch' || state === 'heavyPunch') {
    R(-7, -54, 14,  7, P.hair);
    R(-7, -48, 14, 10, P.skin);
    R(-8, -48, 16,  3, P.accent);
    R( 3, -44,  3,  2, '#111');
    R(-10, -38, 20, 18, P.body);
    R(-10, -20, 20,  3, P.belt);
    R(-8,  -17,  8, 17, P.pants);
    R(  2, -17,  8, 17, P.pants);
    R(-8,    0, 10,  4, P.shoes);
    R(  2,   0, 10,  4, P.shoes);
    // Frame-driven arm extension:
    // frame 0 = windup (both arms neutral), frame 1 = halfway,
    // frame 2-3 = full extension (active hit window)
    if (frame === 0) {
      // Windup — back arm pulls back slightly
      R(-14, -36,  7,  6, P.skin);
      R(  6, -38,  7,  6, P.skin);
    } else if (frame === 1) {
      // Mid extension
      R(-12, -34,  7,  6, P.skin);
      R( 10, -40, 14,  8, P.skin);
      R( 10, -40,  5,  8, P.body); // gi sleeve
    } else {
      // Full extension — fist at +32
      R(-12, -34,  7,  6, P.skin);
      R( 10, -40, 22,  8, P.skin);
      R( 10, -40,  5,  8, P.body); // gi sleeve
      R( 28, -42,  8,  8, P.skin); // fist block
    }
    return;
  }

  // ---- Kick ----
  if (state === 'kick' || state === 'heavyKick') {
    R(-7, -54, 14,  7, P.hair);
    R(-7, -48, 14, 10, P.skin);
    R(-8, -48, 16,  3, P.accent);
    R( 3, -44,  3,  2, '#111');
    R(-10, -38, 20, 18, P.body);
    R(-10, -20, 20,  3, P.belt);
    R( 10, -36,  7,  6, P.skin); // back arm
    R(-12, -34,  7,  6, P.skin); // front arm
    // Frame-driven leg extension
    if (frame === 0) {
      // Wind-up — rear leg lifts slightly
      R(-8, -17,  8, 17, P.pants);
      R(-8,   0, 10,  4, P.shoes);
      R(  2, -20,  8, 14, P.pants); // front leg raised
    } else if (frame >= 1 && frame <= 3) {
      // Extended kick — leg shoots forward horizontally
      R(-8, -17,  8, 17, P.pants);
      R(-8,   0, 10,  4, P.shoes);
      R(  2, -20, 30,  8, P.pants); // horizontal leg block
      R( 28, -20,  8,  8, P.shoes); // shoe at tip
    } else {
      // Recovery — both legs back to normal
      R(-8, -17,  8, 17, P.pants);
      R(  2, -17,  8, 17, P.pants);
      R(-8,   0, 10,  4, P.shoes);
      R(  2,   0, 10,  4, P.shoes);
    }
    return;
  }

  // ---- Jump ----
  if (state === 'jump') {
    // Legs tucked upward, arms out for balance
    const tuck = frame === 0 ? 8 : frame === 1 ? 14 : 10;
    R(-7, -54,  14,  7, P.hair);
    R(-7, -48,  14, 10, P.skin);
    R(-8, -48,  16,  3, P.accent);
    R( 2, -44,   3,  2, '#111');
    R(-10, -38, 20, 18, P.body);
    R(-10, -20, 20,  3, P.belt);
    // Arms out for balance
    R( 10, -36,  8,  6, P.skin);
    R(-14, -36,  8,  6, P.skin);
    // Legs tucked up
    R(-8, -(17 + tuck),  8, 14, P.pants);
    R(  2, -(17 + tuck),  8, 14, P.pants);
    R(-8, -(tuck - 1),  10,  4, P.shoes);
    R(  2, -(tuck - 1),  10,  4, P.shoes);
    return;
  }

  // ---- Idle / Walk ----
  // Idle: slow breathing bob. Walk: legs scissor, arms swing.
  const bob    = state === 'idle' ? Math.sin(renderTime / 500) * 1.5 : 0;
  const by     = Math.round(bob);

  // Walk uses animFrame for discrete leg positions (more precise than sin alone)
  let aSwing = 0;
  let lSwing = 0;
  if (state === 'walk') {
    // frame 0=left fwd, 1=neutral, 2=right fwd, 3=neutral
    const legPhase = [3, 0, -3, 0];
    const armPhase = [-2, 0, 2, 0];
    lSwing = legPhase[frame % 4];
    aSwing = armPhase[frame % 4];
  }

  // Head + headband + face
  R(-7,  -54 + by, 14,  7, P.hair);
  R(-7,  -48 + by, 14, 10, P.skin);
  R(-8,  -48 + by, 16,  3, P.accent); // red headband
  R( 2,  -44 + by,  3,  3, '#111');   // nose
  R( 1,  -40 + by,  3,  1, P.skinDk); // mouth shadow

  // Torso + belt
  R(-10, -38 + by, 20, 18, P.body);
  R(-10, -20,      20,  3, P.belt);

  // Arms swing opposite to legs
  R( 10, -36 + by - aSwing,  7, 12, P.skin);
  R( 10, -36 + by - aSwing,  7,  5, P.body); // gi sleeve over arm
  R(-13, -36 + by + aSwing,  7, 12, P.skin);
  R(-13, -36 + by + aSwing,  7,  5, P.body);

  // Legs scissor
  R(-8 + lSwing / 2, -17,  8, 17, P.pants);
  R( 2 - lSwing / 2, -17,  8, 17, P.pants);
  R(-8,   0, 10,  4, P.shoes);
  R( 2,   0, 10,  4, P.shoes);
}

// ============================================================
// TRUMP — wide suit, swept hair, long red tie
// ============================================================
function _drawTrump(fighter, renderTime) {
  const P     = fighter.def.palette;
  const state = fighter.state;
  const t     = fighter.timer;
  const frame = fighter.animFrame;

  // Helper: draw the signature hair (base block + forward-swept overhang)
  // hairBy = vertical offset for any bob
  function drawTrumpHair(hairBy) {
    hairBy = hairBy || 0;
    R(-8,  -54 + hairBy, 16,  5, P.hair); // base block
    R(  2, -58 + hairBy, 10,  4, P.hair); // swept overhang (comb-over, goes right/forward)
  }

  // Helper: draw the long red tie down center of torso
  function drawTrumpTie(tieTop, tieH) {
    R(-2, tieTop, 4, tieH, P.tie);
  }

  // ---- KO ----
  if (state === 'ko') {
    if (fighter.grounded) {
      // Wider flat silhouette (26px torso)
      R(-24, -8,  48,  8, P.suit);
      R(-18, -12, 14, 10, P.skin);
      R(-18, -16, 14,  5, P.hair);
      R(  6,  -6, 18,  6, P.suit);
      R( 18,  -3,  8,  3, P.shoes);
      R( -2,  -6,  4,  6, P.tie); // tie still visible
    } else {
      const tumble = frame % 2 === 0 ? 0 : 2;
      R(-8,  -52 + tumble, 16,  8, P.hair);
      R(-8,  -44 + tumble, 16, 12, P.skin);
      R(-12, -32,          24, 20, P.suit); // wider torso
      R(-8,  -12,           8, 16, P.suit);
      R( 2,  -12,           8, 16, P.suit);
      R(-16, -28,           6,  6, P.skin);
      R( 14, -28,           6,  6, P.skin);
    }
    return;
  }

  // ---- Crouch ----
  if (state === 'crouch') {
    // Trump crouches stiffly — body barely compresses (wide silhouette stays)
    R(-8,  -34, 16,  5, P.hair);
    R( 2,  -38, 10,  4, P.hair); // sweep still pokes out
    R(-8,  -28, 16, 10, P.skin);
    R( 2,  -24,  3,  2, '#111'); // pursed lips
    R(-4,  -26,  3,  4, P.shirt); // white collar showing
    R(-12, -18, 26, 12, P.suit);  // wide torso
    drawTrumpTie(-18, 12);
    // Stiff arms — barely bent
    R( 12, -14,  8,  6, P.skin);
    R(-16, -12,  6,  6, P.skin);
    R(-12,  -3, 12,  8, P.suit);  // left leg
    R(  2,  -3, 12,  8, P.suit);  // right leg
    R( -8,   0, 10,  4, P.shoes);
    R(  4,   0, 10,  4, P.shoes);
    return;
  }

  // ---- Block ----
  if (state === 'block') {
    drawTrumpHair(0);
    R(-8,  -42, 16, 10, P.skin);
    R(-4,  -44,  3,  4, P.shirt);
    R( 2,  -42,  3,  2, '#111');
    R(-12, -38, 26, 16, P.suit); // wide torso
    drawTrumpTie(-36, 14);
    // Arms raised — stiff block (both arms come up)
    R( -2, -44, 12, 14, P.skin);
    R(-12, -42,  6, 10, P.skin);
    R(-12, -22, 26,  3, P.suit); // belt line
    R(-10, -19, 10, 19, P.suit);
    R(  2, -19, 10, 19, P.suit);
    R( -8,   0, 10,  4, P.shoes);
    R(  4,   0, 10,  4, P.shoes);
    return;
  }

  // ---- Hit / Air Hit (hurt) ----
  if (state === 'hit' || state === 'airHit') {
    const jerk = frame === 0 ? -4 : -2;
    drawTrumpHair(0);
    R(-8  + jerk, -42, 16, 10, P.skin);
    R(-4  + jerk, -44,  3,  4, P.shirt);
    R(-12 + jerk, -38, 26, 16, P.suit);
    drawTrumpTie(-36, 14);
    R(-14, -36,  7,  6, P.skin);
    R( 12, -36,  7,  6, P.skin);
    R(-12, -22, 26,  3, P.suit);
    R(-10, -19, 10, 19, P.suit);
    R(  2, -19, 10, 19, P.suit);
    R( -8,   0, 10,  4, P.shoes);
    R(  4,   0, 10,  4, P.shoes);
    return;
  }

  // ---- Punch — Trump's signature: both arms jab forward together ----
  if (state === 'punch' || state === 'heavyPunch') {
    drawTrumpHair(0);
    R(-8,  -42, 16, 10, P.skin);
    R(-4,  -44,  3,  4, P.shirt);
    R( 2,  -42,  3,  2, '#111');
    R(-12, -38, 26, 16, P.suit);
    drawTrumpTie(-36, 14);
    R(-12, -22, 26,  3, P.suit);
    R(-10, -19, 10, 19, P.suit);
    R(  2, -19, 10, 19, P.suit);
    R( -8,   0, 10,  4, P.shoes);
    R(  4,   0, 10,  4, P.shoes);
    // Double-fist jab — both arms extend forward together
    if (frame === 0) {
      // Windup — both arms pull back
      R(-14, -38,  6,  6, P.skin);
      R( 12, -38,  6,  6, P.skin);
    } else if (frame === 1) {
      // Mid extension — both arms halfway
      R(-4,  -40, 10,  8, P.skin);
      R( -4, -40,  4,  8, P.suit);
    } else {
      // Full double-fist forward — unique Trump silhouette
      R( 10, -42, 14,  8, P.skin); // upper fist
      R( 10, -34, 14,  8, P.skin); // lower fist
      R( 10, -42,  5,  8, P.suit);
      R( 10, -34,  5,  8, P.suit);
    }
    return;
  }

  // ---- Kick ----
  if (state === 'kick' || state === 'heavyKick') {
    drawTrumpHair(0);
    R(-8,  -42, 16, 10, P.skin);
    R(-4,  -44,  3,  4, P.shirt);
    R( 2,  -42,  3,  2, '#111');
    R(-12, -38, 26, 16, P.suit);
    drawTrumpTie(-36, 14);
    R( 12, -36,  7,  6, P.skin); // back arm
    R(-12, -34,  7,  6, P.skin); // front arm
    R(-12, -22, 26,  3, P.suit);
    if (frame === 0) {
      R(-10, -19, 10, 19, P.suit);
      R(-10,   0, 10,  4, P.shoes);
      R(  2, -22, 10, 14, P.suit); // front leg lifting
    } else if (frame >= 1 && frame <= 3) {
      R(-10, -19, 10, 19, P.suit);
      R(-10,   0, 10,  4, P.shoes);
      R(  2, -20, 28,  8, P.suit); // leg extends stiffly
      R( 28, -20,  8,  8, P.shoes);
    } else {
      R(-10, -19, 10, 19, P.suit);
      R(  2, -19, 10, 19, P.suit);
      R( -8,   0, 10,  4, P.shoes);
      R(  4,   0, 10,  4, P.shoes);
    }
    return;
  }

  // ---- Jump ----
  if (state === 'jump') {
    const tuck = frame === 0 ? 6 : frame === 1 ? 12 : 8;
    drawTrumpHair(0);
    R(-8, -42, 16, 10, P.skin);
    R(-4, -44,  3,  4, P.shirt);
    R(-12, -38, 26, 16, P.suit);
    drawTrumpTie(-36, 14);
    // Stiff arms out (minimal bend — Trump style)
    R( 12, -36,  7,  6, P.skin);
    R(-14, -36,  7,  6, P.skin);
    R(-10, -(19 + tuck), 10, 14, P.suit);
    R(  2, -(19 + tuck), 10, 14, P.suit);
    R(-10, -(tuck - 2),  10,  4, P.shoes);
    R(  2, -(tuck - 2),  10,  4, P.shoes);
    return;
  }

  // ---- Idle / Walk ----
  // Idle: subtle chest-puff using animFrame. Walk: stiff-legged gait (minimal arm swing).
  const bob = state === 'idle' ? Math.sin(renderTime / 500) * 1.2 : 0;
  // Pompous chest-puff: animFrame 0-1 = normal, 2-3 = slight puff (body shifts up 1px)
  const puff = (state === 'idle' && frame >= 2) ? -1 : 0;
  const by   = Math.round(bob) + puff;

  let aSwing = 0;
  let lSwing = 0;
  if (state === 'walk') {
    // Stiff-legged march: minimal arm swing (±1 vs Ryu's ±2)
    const legPhase = [3, 0, -3, 0];
    const armPhase = [-1, 0, 1, 0]; // much stiffer than Ryu
    lSwing = legPhase[frame % 4];
    aSwing = armPhase[frame % 4];
  }

  drawTrumpHair(by);
  // Head (wider than Ryu)
  R(-8,  -42 + by, 16, 10, P.skin);
  R(-4,  -44 + by,  3,  4, P.shirt); // white collar
  R( 2,  -42 + by,  3,  2, '#111'); // pursed lips
  // Short thick neck
  R(-5,  -38 + by, 10,  4, P.skin);
  // Wide torso
  R(-12, -38 + by, 26, 16, P.suit);
  // Tie — never omit
  drawTrumpTie(-36 + by, 14);
  // Belt line
  R(-12, -22 + by, 26,  3, P.suit);

  // Stiff arms close to body
  R( 12, -36 + by - aSwing,  6, 14, P.skin);
  R(-14, -36 + by + aSwing,  6, 14, P.skin);
  // Fists (slightly closed)
  R( 12, -24 + by,  8,  6, P.skin);
  R(-16, -24 + by,  8,  6, P.skin);

  // Legs — wider stance than Ryu
  R(-11 + lSwing / 2, -19, 10, 19, P.suit);
  R(  3 - lSwing / 2, -19, 10, 19, P.suit);
  R( -8,   0, 10,  4, P.shoes);
  R(  4,   0, 10,  4, P.shoes);
}

// ============================================================
// OBAMA — tall, slim, distinguished
// ============================================================
function _drawObama(fighter, renderTime) {
  const P     = fighter.def.palette;
  const state = fighter.state;
  const t     = fighter.timer;
  const frame = fighter.animFrame;

  // Helper: draw the prominent ears (W-notch silhouette)
  function drawEars(headY) {
    R(-11, headY + 3,  4,  5, P.skin); // left ear
    R(  7, headY + 3,  4,  5, P.skin); // right ear
  }

  // Helper: draw slim suit with white shirt showing at chest
  function drawSuit(top, h) {
    R(-8, top, 16, h, P.suit);          // jacket
    R(-2, top,  4, Math.min(h, 8), P.shirt); // white shirt strip at center
  }

  // ---- KO ----
  if (state === 'ko') {
    if (fighter.grounded) {
      // Tall character falls long — horizontal layout
      R(-24, -8,  44,  8, P.suit);
      R(-18, -12, 14, 10, P.skin);
      R(-18, -16,  4,  3, P.hair); // close-cropped dark cap
      R(  6,  -6, 18,  6, P.suit);
      R( 18,  -3,  8,  3, P.shoes);
      R( -2,  -6,  4,  6, P.tie);  // blue tie visible
    } else {
      const tumble = frame % 2 === 0 ? 0 : 2;
      R( -7, -57 + tumble, 14,  3, P.hair); // thin hair cap
      drawEars(-57 + tumble);
      R( -7, -54 + tumble, 14, 11, P.skin);
      R( -8, -32,          16, 20, P.suit);
      R( -7, -12,           7, 16, P.suit);
      R(  2, -12,           7, 16, P.suit);
      R(-16, -28,           6,  6, P.skin);
      R( 14, -28,           6,  6, P.skin);
    }
    return;
  }

  // ---- Crouch ----
  if (state === 'crouch') {
    // Tall character crouches elegantly — still visibly taller than others
    R(-7, -38, 14,  3, P.hair);
    drawEars(-38);
    R(-7, -34, 14, 11, P.skin);
    R(-4, -36,  3,  4, P.shirt);
    R(-8, -22, 16, 14, P.suit);
    R(-2, -22,  4,  8, P.shirt);
    R(-2, -16,  3,  8, P.tie);
    // Long arms — one forward
    R( 8, -20,  6,  6, P.skin);
    R(-12, -18,  6,  6, P.skin);
    // Long legs bent
    R(-8,  -5, 8, 10, P.suit);
    R( 2,  -5, 8, 10, P.suit);
    R(-8,   0, 9,  4, P.shoes);
    R( 2,   0, 9,  4, P.shoes);
    return;
  }

  // ---- Block ----
  if (state === 'block') {
    R(-7, -57, 14,  3, P.hair);
    drawEars(-57);
    R(-7, -54, 14, 11, P.skin);
    R(-8, -46, 16, 20, P.suit);
    R(-2, -46,  4,  8, P.shirt);
    R(-2, -40,  3, 10, P.tie);
    // Arms up in composed guard
    R(-2, -50, 12, 14, P.skin);
    R(-12, -48,  6, 10, P.skin);
    R(-8, -26, 16,  3, P.suit);
    R(-7, -23,  7, 23, P.suit);
    R( 2, -23,  7, 23, P.suit);
    R(-7,   0,  9,  4, P.shoes);
    R( 2,   0,  9,  4, P.shoes);
    return;
  }

  // ---- Hit / Air Hit (hurt) ----
  if (state === 'hit' || state === 'airHit') {
    const jerk = frame === 0 ? -4 : -2;
    R(-7 + jerk, -57, 14,  3, P.hair);
    drawEars(-57);
    R(-7 + jerk, -54, 14, 11, P.skin);
    R(-8 + jerk, -46, 16, 20, P.suit);
    R(-2 + jerk, -46,  4,  8, P.shirt);
    R(-14, -44,  6,  6, P.skin); // arms out from impact
    R( 12, -44,  6,  6, P.skin);
    R(-8, -26, 16,  3, P.suit);
    R(-7, -23,  7, 23, P.suit);
    R( 2, -23,  7, 23, P.suit);
    R(-7,   0,  9,  4, P.shoes);
    R( 2,   0,  9,  4, P.shoes);
    return;
  }

  // ---- Punch — smooth, precise extension ----
  if (state === 'punch' || state === 'heavyPunch') {
    R(-7, -57, 14,  3, P.hair);
    drawEars(-57);
    R(-7, -54, 14, 11, P.skin);
    drawSuit(-46, 20);
    R(-2, -40,  3, 10, P.tie);
    R(-8, -26, 16,  3, P.suit);
    R(-7, -23,  7, 23, P.suit);
    R( 2, -23,  7, 23, P.suit);
    R(-7,   0,  9,  4, P.shoes);
    R( 2,   0,  9,  4, P.shoes);
    // Precise, smooth extension (long arm = longer reach)
    if (frame === 0) {
      R(-14, -46,  6,  6, P.skin);
      R(  8, -48,  6,  6, P.skin);
    } else if (frame === 1) {
      R(-12, -44,  6,  6, P.skin);
      R( 10, -48, 16,  6, P.skin);
      R( 10, -48,  5,  6, P.suit);
    } else {
      // Full extension — long arm reaches far (taller = longer limbs)
      R(-12, -44,  6,  6, P.skin);
      R( 10, -48, 24,  6, P.skin); // longer reach than Ryu
      R( 10, -48,  5,  6, P.suit);
      R( 30, -50,  6,  6, P.skin); // knuckle
    }
    return;
  }

  // ---- Kick — high roundhouse (long legs reach above others' head height) ----
  if (state === 'kick' || state === 'heavyKick') {
    R(-7, -57, 14,  3, P.hair);
    drawEars(-57);
    R(-7, -54, 14, 11, P.skin);
    drawSuit(-46, 20);
    R(-2, -40,  3, 10, P.tie);
    R( 10, -46,  6,  6, P.skin); // back arm
    R(-12, -44,  6,  6, P.skin); // front arm
    R(-8, -26, 16,  3, P.suit);
    if (frame === 0) {
      R(-7, -23,  7, 23, P.suit);
      R(-7,   0,  9,  4, P.shoes);
      R( 2, -28,  7, 18, P.suit); // front leg winding up
    } else if (frame >= 1 && frame <= 3) {
      R(-7, -23,  7, 23, P.suit);
      R(-7,   0,  9,  4, P.shoes);
      // High kick — leg reaches very high (above normal head level)
      R( 2, -30, 32,  7, P.suit);  // long leg fully extended horizontally
      R(30, -30,  7,  7, P.shoes); // shoe at the tip
    } else {
      R(-7, -23,  7, 23, P.suit);
      R( 2, -23,  7, 23, P.suit);
      R(-7,   0,  9,  4, P.shoes);
      R( 2,   0,  9,  4, P.shoes);
    }
    return;
  }

  // ---- Jump ----
  if (state === 'jump') {
    const tuck = frame === 0 ? 10 : frame === 1 ? 18 : 12; // longer tuck due to longer legs
    R(-7, -57, 14,  3, P.hair);
    drawEars(-57);
    R(-7, -54, 14, 11, P.skin);
    drawSuit(-46, 20);
    R(-2, -40,  3, 10, P.tie);
    // Arms out for balance
    R( 10, -46,  7,  6, P.skin);
    R(-13, -46,  7,  6, P.skin);
    // Long legs tuck up significantly
    R(-7, -(23 + tuck),  7, 18, P.suit);
    R( 2, -(23 + tuck),  7, 18, P.suit);
    R(-7, -(tuck + 1),   9,  4, P.shoes);
    R( 2, -(tuck + 1),   9,  4, P.shoes);
    return;
  }

  // ---- Idle / Walk ----
  // Idle: distinguished upright stance, slight professorial arm raise.
  // Walk: smooth, purposeful stride with normal arm swing.
  const bob = state === 'idle' ? Math.sin(renderTime / 500) * 1.2 : 0;
  const by  = Math.round(bob);

  let aSwing = 0;
  let lSwing = 0;
  if (state === 'walk') {
    const legPhase = [3, 0, -3, 0];
    const armPhase = [-2, 0, 2, 0]; // normal swing (matches Ryu)
    lSwing = legPhase[frame % 4];
    aSwing = armPhase[frame % 4];
  }

  // Thin hair cap (close-cropped)
  R(-7, -57 + by, 14,  3, P.hair);
  // Ears — the W-notch silhouette marker
  drawEars(-57 + by);
  // Head
  R(-7, -54 + by, 14, 11, P.skin);
  // Smile — three-pixel arc at lower face
  R(-2, -46 + by,  2,  1, P.shirt); // left smile pixel
  R( 0, -45 + by,  2,  1, P.shirt); // center smile pixel (slightly lower)
  R( 2, -46 + by,  2,  1, P.shirt); // right smile pixel
  // Slim suit + white shirt strip
  drawSuit(-46 + by, 20);
  R(-2, -40 + by,  3, 10, P.tie);  // blue tie

  // Long arms (slightly raised left arm — professorial gesture in idle)
  const leftArmY  = state === 'idle' ? -48 : -46; // left arm slightly higher in idle
  R( 10, -46 + by - aSwing,  6, 16, P.skin);
  R( 10, -46 + by - aSwing,  6,  5, P.suit);  // suit sleeve
  R(-12, leftArmY + by + aSwing,  6, 16, P.skin);
  R(-12, leftArmY + by + aSwing,  6,  5, P.suit);

  // Long legs
  R(-7 + lSwing / 2, -23,  7, 23, P.suit);
  R( 2 - lSwing / 2, -23,  7, 23, P.suit);
  R(-7,   0,  9,  4, P.shoes);
  R( 2,   0,  9,  4, P.shoes);
}

// ============================================================
// NENE — hot pink rushdown, tall hair, gold jewelry, heels
// ============================================================
function _drawNene(fighter, renderTime) {
  const P     = fighter.def.palette;
  const state = fighter.state;
  const frame = fighter.animFrame;

  // --- Shared sub-draw helpers ---

  // Tall hair stack: dark oval/rectangle sitting high above head.
  // hairBy = vertical offset (bob/jerk). hairShift = horizontal shake offset.
  function drawHair(hairBy, hairShift) {
    hairBy    = hairBy    || 0;
    hairShift = hairShift || 0;
    // Voluminous mass — wider than head (20px wide)
    R(-10 + hairShift, -70 + hairBy, 20, 14, P.hair);
    // Rounded top — two smaller blocks to suggest volume
    R( -8 + hairShift, -74 + hairBy, 16,  6, P.hair);
    R( -4 + hairShift, -76 + hairBy,  8,  4, P.hair);
  }

  // Head: warm brown oval.
  function drawHead(headBy) {
    headBy = headBy || 0;
    R(-7, -56 + headBy, 14, 10, P.skin); // head block
    // Lips — tiny red detail
    R(-2, -49 + headBy,  4,  2, '#cc1133');
  }

  // Slim hot-pink dress torso.
  function drawTorso(torsoBy) {
    torsoBy = torsoBy || 0;
    R(-8, -44 + torsoBy, 16, 16, P.dress); // upper dress / bodice
    R(-6, -28 + torsoBy, 12, 10, P.dress); // waist / skirt flare
  }

  // Gold jewelry: small dots at neck and wrists.
  function drawJewelry(neckBy) {
    neckBy = neckBy || 0;
    // Necklace — two dots at neck line
    R(-3, -46 + neckBy, 3, 2, P.jewelry);
    R( 2, -46 + neckBy, 3, 2, P.jewelry);
    // Earring — small square near ear
    R( 6, -54 + neckBy, 2, 3, P.jewelry);
  }

  // Heel feet: toe block + downward spike from heel.
  // x = left edge of foot origin (normally -6 or +2).
  function drawHeel(x, y) {
    R(x,     y,   6, 3, P.shoes); // toe block
    R(x + 4, y,   2, 5, P.shoes); // heel spike downward
  }

  // Deep-pink nail squares at fingertips (drawn after arm extends).
  function drawNails(x, y) {
    R(x, y, 3, 3, P.nails);
  }

  // --- KO ---
  if (state === 'ko') {
    if (fighter.grounded) {
      // Fallen but fabulous: horizontal, heels in the air
      // Body laid flat
      R(-22,  -8, 44,  8, P.dress);
      R(-18, -14, 12, 10, P.skin);  // head
      // Hair disheveled — wide block at an angle
      R(-14, -20, 22,  8, P.hair);
      R(-18, -22,  8,  4, P.hair);  // flyaway tuft
      // Heels pointing upward: draw legs going slightly upward from body
      R( 14, -14,  6, 14, P.dress); // leg going up
      R( 14, -14,  4,  2, P.shoes); // shoe
      R( 18, -22,  2,  8, P.shoes); // heel spike pointing up
      R( 20, -14,  6, 12, P.dress); // second leg
      R( 20, -14,  4,  2, P.shoes);
      R( 24, -20,  2,  6, P.shoes);
      // Gold jewelry still visible
      R(-14,  -8,  3,  2, P.jewelry);
    } else {
      // Airborne tumble
      const tumble = frame % 2 === 0 ? 0 : 2;
      drawHair(tumble, frame % 2 === 0 ? 0 : 3); // hair bounces off-axis
      drawHead(tumble);
      R(-8, -44 + tumble, 16, 26, P.dress);
      // Arms flailing
      R(-18, -40 + tumble,  6, 6, P.skin);
      R( 14, -40 + tumble,  6, 6, P.skin);
      // Legs spread
      R(-8,  -18, 6, 18, P.dress);
      R( 4,  -18, 6, 18, P.dress);
      drawHeel(-8,  0);
      drawHeel( 4,  0);
    }
    return;
  }

  // --- Crouch ---
  if (state === 'crouch') {
    drawHair(20, 0); // hair stays tall but body drops
    drawHead(18);
    drawJewelry(18);
    // Compressed torso
    R(-8, -26, 16, 10, P.dress);
    R(-6, -16,  12,  8, P.dress);
    // Arms — one on knee, one out
    R( 8, -24,  6, 6, P.skin);
    R(-12, -22, 6, 6, P.skin);
    // Legs bent, heels compressed
    R(-8,  -8, 7, 10, P.dress);
    R( 3,  -8, 7, 10, P.dress);
    drawHeel(-7, 0);
    drawHeel( 3, 0);
    return;
  }

  // --- Block ---
  if (state === 'block') {
    // Both arms up with attitude — "oh no you didn't" — not cowering, splayed hands
    drawHair(0, 0);
    drawHead(0);
    drawJewelry(0);
    drawTorso(0);
    // Both arms raised, forearms angled outward — defiant splay
    R(-14, -50, 8, 14, P.skin);  // left arm raised
    R(  8, -50, 8, 14, P.skin);  // right arm raised
    // Splayed hand — small spread of nails
    R(-16, -52, 4, 3, P.nails);
    R(  8, -52, 4, 3, P.nails);
    // Legs
    R(-6, -18, 6, 18, P.dress);
    R( 2, -18, 6, 18, P.dress);
    drawHeel(-6, 0);
    drawHeel( 2, 0);
    return;
  }

  // --- Hit / Air Hit (hurt) ---
  if (state === 'hit' || state === 'airHit') {
    // Dramatic stumble — body tilted back, hair offset as if it got hit
    const jerk      = frame === 0 ? -5 : -2;
    const hairShift = frame === 0 ?  4 :  2; // hair swings opposite to jerk
    drawHair(0, hairShift);
    R(-7 + jerk, -56, 14, 10, P.skin); // head jerks back
    R(-2 + jerk, -49,  4,  2, '#cc1133');
    drawJewelry(jerk);
    R(-8 + jerk, -44, 16, 26, P.dress); // body tilts with head
    // One arm flailing out from impact
    R( 14, -46, 10, 6, P.skin);
    R(-14, -42,  7, 6, P.skin);
    // Legs
    R(-6, -18, 6, 18, P.dress);
    R( 2, -18, 6, 18, P.dress);
    drawHeel(-6, 0);
    drawHeel( 2, 0);
    return;
  }

  // --- Punch (sharp backhand slap) ---
  if (state === 'punch' || state === 'heavyPunch') {
    drawHair(0, 0);
    drawHead(0);
    drawJewelry(0);
    drawTorso(0);
    // Legs (planted)
    R(-6, -18, 6, 18, P.dress);
    R( 2, -18, 6, 18, P.dress);
    drawHeel(-6, 0);
    drawHeel( 2, 0);
    // Frame-driven backhand slap — arm sweeps fully to the side
    if (frame === 0) {
      // Windup — arm pulled back/in
      R(-12, -44,  8, 6, P.skin);
      R(  6, -46,  7, 6, P.skin);
    } else if (frame === 1) {
      // Mid-extension
      R(-12, -44,  8, 6, P.skin);
      R(  8, -46, 16, 6, P.skin);
      R(  8, -46,  5, 6, P.dress); // dress sleeve
    } else {
      // Full backhand extension — nails visible at fingertips
      R(-12, -44,  8,  6, P.skin);
      R(  8, -46, 22,  6, P.skin);
      R(  8, -46,  5,  6, P.dress); // dress sleeve
      drawNails(28, -48);           // nails at tip — small colored squares
    }
    return;
  }

  // --- Kick (dramatic raised kick, heel spike leading) ---
  if (state === 'kick' || state === 'heavyKick') {
    drawHair(0, 0);
    drawHead(0);
    drawJewelry(0);
    // Body leans back for counterbalance
    const lean = (frame >= 1 && frame <= 3) ? -3 : 0;
    R(-8 + lean, -44, 16, 26, P.dress);
    // Arms for balance
    R(-14 + lean, -42, 7, 6, P.skin);
    R( 10 + lean, -44, 7, 6, P.skin);
    // Planted leg
    R(-6, -18, 6, 18, P.dress);
    drawHeel(-6, 0);
    if (frame === 0) {
      // Wind-up — front leg lifts to knee height
      R(  2, -24, 6, 14, P.dress);
      R(  2,  -8, 6,  3, P.shoes);
      R(  6, -10, 2,  5, P.shoes); // heel spike
    } else if (frame >= 1 && frame <= 3) {
      // Extended kick — leg shoots forward at 45° up, heel spike leading
      // Diagonal extension: x increases, y becomes more negative = upward+forward
      R(  2, -24, 28,  6, P.dress); // leg block — horizontal then angles up
      R( 24, -30,  8,  6, P.dress); // upper angled segment
      R( 28, -34,  6,  3, P.shoes); // shoe
      R( 32, -38,  2,  6, P.shoes); // heel spike — leading point
    } else {
      // Recovery
      R( 2, -18, 6, 18, P.dress);
      drawHeel( 2, 0);
    }
    return;
  }

  // --- Jump ---
  if (state === 'jump') {
    const tuck = frame === 0 ? 6 : frame === 1 ? 12 : 8;
    drawHair(0, 0);
    drawHead(0);
    drawJewelry(0);
    drawTorso(0);
    // Arms out for balance / drama
    R( 10, -44,  8, 6, P.skin);
    R(-14, -42,  8, 6, P.skin);
    // Legs tucked, heels visible
    R(-6, -(18 + tuck),  6, 14, P.dress);
    R( 2, -(18 + tuck),  6, 14, P.dress);
    drawHeel(-6, -(tuck - 2));
    drawHeel( 2, -(tuck - 2));
    return;
  }

  // --- Super (wine glass extended forward during super) ---
  if (state === 'super') {
    drawHair(0, 0);
    drawHead(0);
    drawJewelry(0);
    drawTorso(0);
    R(-6, -18, 6, 18, P.dress);
    R( 2, -18, 6, 18, P.dress);
    drawHeel(-6, 0);
    drawHeel( 2, 0);
    // Arm extended forward
    R( 8, -46, 22,  6, P.skin);
    R( 8, -46,  5,  6, P.dress); // sleeve
    // Wine glass shape at the tip: stemmed glass (circle on a narrow Y)
    // Bowl (filled circle approximated as a rect)
    R(28, -50,  8,  7, '#ffeeaa'); // glass bowl (light yellow = liquid)
    R(28, -50,  8,  1, '#ffffff88'); // glass rim glint
    // Stem — narrow vertical
    R(31, -43,  2,  4, '#ffeeaa44'); // stem
    // Base — short horizontal
    R(29, -39,  6,  2, '#ffeeaa44');
    // Glass outline tint
    R(28, -50,  1,  7, '#ffffff44'); // left edge glint
    return;
  }

  // --- Idle / Walk ---
  // Idle: hip cocked to one side, hand on hip, sassy subtle bob.
  // Walk: confident strut — exaggerated hip swing, arms with attitude, heels click.

  const bob = state === 'idle' ? Math.sin(renderTime / 480) * 1.5 : 0;
  const by  = Math.round(bob);

  // Idle: hip cocked — torso shifts ±2px based on animFrame
  // Walk: exaggerated ±4px hip swing on torso
  let hipShift = 0;
  let aSwing   = 0;
  let lSwing   = 0;
  let heelClick = 0; // alternating heel-strike offset

  if (state === 'idle') {
    // Sassy hip cock: frames 0-1 hip right, frames 2-3 hip left
    const hipPhase = [2, 2, -2, -2];
    hipShift = hipPhase[frame % 4];
  } else if (state === 'walk') {
    // Exaggerated strut: large hip swing on torso
    const hipPhase = [4, 2, -4, -2];
    const armPhase = [-3, 0, 3, 0];
    const legPhase = [3, 0, -3, 0];
    hipShift  = hipPhase[frame % 4];
    aSwing    = armPhase[frame % 4];
    lSwing    = legPhase[frame % 4];
    heelClick = frame % 2 === 0 ? 2 : 0; // alternate heel strikes
  }

  drawHair(by, 0);
  drawHead(by);
  drawJewelry(by);

  // Torso with hip shift (dress)
  R(-8 + hipShift, -44 + by, 16, 16, P.dress); // bodice
  R(-6 + hipShift, -28 + by, 12, 10, P.dress); // waist/skirt

  // Idle: hand-on-hip arm (forearm bent inward at elbow) + other arm out
  // Walk: arms swing with attitude
  if (state === 'idle') {
    // Hand on hip — bent elbow: forearm goes inward
    R( 8 + hipShift, -42 + by,  6, 8, P.skin);  // upper arm
    R( 8 + hipShift, -34 + by,  8, 5, P.skin);  // forearm angled in (hand on hip)
    // Other arm slightly out
    R(-12,           -40 + by,  6, 10, P.skin);
    // Wrist jewelry on both
    R( 8 + hipShift, -36 + by,  5, 2, P.jewelry);
    R(-12,           -32 + by,  5, 2, P.jewelry);
  } else {
    // Walk: arms swinging with attitude (larger swing than Ryu)
    R( 10, -42 + by - aSwing,  6, 12, P.skin);
    R( 10, -42 + by - aSwing,  5,  5, P.dress); // sleeve
    R(-12, -40 + by + aSwing,  6, 12, P.skin);
    R(-12, -40 + by + aSwing,  5,  5, P.dress);
    // Wrist jewelry
    R( 10, -32 + by,  5, 2, P.jewelry);
    R(-12, -30 + by,  5, 2, P.jewelry);
  }

  // Legs — slim, elongated
  R(-6 + lSwing / 2, -18,  6, 18, P.dress);
  R( 2 - lSwing / 2, -18,  6, 18, P.dress);

  // Heels — toe block + heel spike, with clickety walk offset
  drawHeel(-6, heelClick);  // alternating heel-strike on walk
  drawHeel( 2, 0);
}

// Apply screen shake by translating the context before drawing.
// Call ctx.save() before this and ctx.restore() after the frame is drawn.
export function applyScreenShake(intensity) {
  if (intensity > 0) {
    ctx.translate(
      Math.round((Math.random() - 0.5) * intensity),
      Math.round((Math.random() - 0.5) * intensity)
    );
  }
}

