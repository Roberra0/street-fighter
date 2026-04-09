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
export function setActiveBG(img) { _activeBG = img; _stageWidth = null; }

// ---- Camera & stage bounds ----
const WALL_PAD = 24;
const BG_PARALLAX = 0.8; // BG scrolls slower than fighters for depth
let _stageWidth = null;   // computed from active map aspect ratio
let _cameraX = 0;         // world-space X of viewport left edge

export function getStageWidth() {
  if (_stageWidth !== null) return _stageWidth;
  if (_activeBG && _activeBG.complete && _activeBG.naturalWidth > 0) {
    _stageWidth = Math.round(_activeBG.naturalWidth * (GH / _activeBG.naturalHeight));
  } else {
    _stageWidth = GW; // fallback to viewport width
  }
  return _stageWidth;
}

export function getWallL() { return WALL_PAD; }
export function getWallR() { return getStageWidth() - WALL_PAD; }
export function getCameraX() { return _cameraX; }

export function updateCamera(p1, p2) {
  const mid = (p1.x + p2.x) / 2;
  const maxCam = getStageWidth() - GW;
  _cameraX = Math.max(0, Math.min(maxCam, mid - GW / 2));
}

// ---- Background (parallax) ----

export function drawBG() {
  if (_activeBG && _activeBG.complete && _activeBG.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    const sw = getStageWidth();
    const maxCam = sw - GW;
    // Parallax: BG scrolls at a fraction of camera movement
    const bgOffset = maxCam > 0 ? (_cameraX / maxCam) * (_activeBG.naturalWidth - _activeBG.naturalWidth * (GW / sw)) : 0;
    const srcX = Math.round(bgOffset);
    const srcW = Math.round(_activeBG.naturalWidth * (GW / sw));
    ctx.drawImage(_activeBG, srcX, 0, srcW, _activeBG.naturalHeight, 0, 0, GW, GH);
  } else {
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
    const tx = Math.round(target.x - _cameraX);
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
      ctx.restore();
      throw new Error(`Sprite PNG not loaded for character: ${fighter.def.id}`);
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

