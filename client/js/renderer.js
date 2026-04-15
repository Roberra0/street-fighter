// renderer.js — all canvas draw calls

const GW = 640;
const GH = 360;
const GROUND = 340;

export const canvas = document.getElementById('c');
export const ctx    = canvas.getContext('2d');

// ---- Overscan: expand canvas to fill window width with extra panorama ----
let _overscanX = 0;  // extra pixels on each side of the 640 game area
export function getOverscanX() { return _overscanX; }

export function resize() {
  // Guard: ensure window dimensions are valid (not 0 or extremely small)
  if (window.innerWidth < 100 || window.innerHeight < 100) {
    // Window dimensions not ready; schedule retry on next frame
    requestAnimationFrame(resize);
    return;
  }

  const windowAR = window.innerWidth / window.innerHeight;
  const gameAR   = GW / GH;

  if (windowAR > gameAR) {
    // Window wider than 16:9 — expand canvas to fill, show more panorama
    const canvasW = Math.round(GH * windowAR);
    _overscanX = Math.round((canvasW - GW) / 2);
    canvas.width  = canvasW;
    canvas.height = GH;
    const s = window.innerHeight / GH;
    canvas.style.width  = Math.floor(canvasW * s) + 'px';
    canvas.style.height = Math.floor(GH * s) + 'px';
  } else {
    // Normal or tall window — fit as before
    _overscanX = 0;
    canvas.width  = GW;
    canvas.height = GH;
    const s = Math.min(window.innerWidth / GW, window.innerHeight / GH);
    canvas.style.width  = Math.floor(GW * s) + 'px';
    canvas.style.height = Math.floor(GH * s) + 'px';
  }
}

resize();
window.addEventListener('resize', resize);

// ---- Active background map ----
let _activeBG = null;
export function setActiveBG(img) {
  console.log('[BG] setActiveBG:', img?.src, 'complete:', img?.complete, 'naturalWidth:', img?.naturalWidth);
  _activeBG = img;
  _stageWidth = null;
}

// ---- Camera & stage bounds ----
const WALL_PAD = 24;
const BG_PARALLAX = 0.8; // BG scrolls slower than fighters for depth
let _stageWidth = null;   // computed from active map aspect ratio
let _cameraX = 0;         // world-space X of viewport left edge

// ---- Sprite rendering ----
let _fadeOC = null;  // offscreen canvas for applying edge fade to sprites

export function getStageWidth() {
  if (_stageWidth !== null) return _stageWidth;
  if (_activeBG && _activeBG.complete && _activeBG.naturalWidth > 0) {
    _stageWidth = Math.round(_activeBG.naturalWidth * (GH / _activeBG.naturalHeight));
    return _stageWidth;
  }
  // Fallback: return GW but DON'T cache, so this re-checks next call when image loads
  console.warn('[BG] getStageWidth() fallback to GW — image not ready yet');
  return GW;
}

export function getWallL() { return WALL_PAD; }
export function getWallR() { return getStageWidth() - WALL_PAD; }
export function getCameraX() { return _cameraX; }

export function updateCamera(p1, p2) {
  const mid = (p1.x + p2.x) / 2;
  const sw = getStageWidth();
  const ox = _overscanX;
  // Clamp so the visible area (including overscan wings) stays within the stage
  const minCam = ox;
  const maxCam = Math.max(minCam, sw - GW - ox);
  _cameraX = Math.max(minCam, Math.min(maxCam, mid - GW / 2));
}

// ---- Background (parallax) ----

export function drawBG() {
  const ox = _overscanX;
  const viewW = GW + 2 * ox; // full visible width including overscan wings

  if (_activeBG && _activeBG.complete && _activeBG.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    const natW = _activeBG.naturalWidth;
    const natH = _activeBG.naturalHeight;
    const sw   = getStageWidth();
    const scale = natW / sw; // world-to-source-pixel ratio

    // Source rect: map the visible world range to source pixels
    const worldLeft = _cameraX - ox;
    const srcX = Math.max(0, Math.round(worldLeft * scale));
    const srcW = Math.min(Math.round(viewW * scale), natW - srcX);

    if (srcW <= 0) {
      // Image geometry is in a bad state (race condition) — draw fallback
      console.warn('[BG] srcW <= 0, drawing fallback fill');
      ctx.fillStyle = '#0e0620';
      ctx.fillRect(-ox, 0, viewW, GH);
    } else {
      ctx.drawImage(_activeBG, srcX, 0, srcW, natH, -ox, 0, viewW, GH);
    }
  } else {
    ctx.fillStyle = '#0e0620';
    ctx.fillRect(-ox, 0, viewW, GH);
  }
  // Ground shadow strip so fighters have a visual floor reference
  const g = ctx.createLinearGradient(0, GROUND - 8, 0, GH);
  g.addColorStop(0, '#00000000');
  g.addColorStop(1, '#00000088');
  ctx.fillStyle = g;
  ctx.fillRect(-ox, GROUND - 8, viewW, GH - GROUND + 8);
}

// ---- Fighter shadow ----
export function drawShadow(fighter) {
  ctx.fillStyle = '#0004';
  const sw = 20 + (GROUND - fighter.y) * 0.08;
  ctx.fillRect(Math.round(fighter.x - sw / 2), GROUND + 2, Math.round(sw), 3);
}

// ---- Sprite sheet support ----

// Call once at startup for any def that has animSheets.
export function loadSpriteSheet(def) {
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

// Load sprite sheets for a character and wait for all images to load.
// Returns a Promise that resolves when all images are ready.
export function loadSpriteSheetAsync(def) {
  loadSpriteSheet(def); // Create Image objects on def
  const imgs = [];
  if (def._animSheetImages) imgs.push(...Object.values(def._animSheetImages));
  if (def.overlay?._img) imgs.push(def.overlay._img);
  if (def.projectile?._imgs) imgs.push(...def.projectile._imgs);

  // Wait for all images that haven't loaded yet
  return Promise.all(
    imgs.filter(img => !img.complete).map(img =>
      new Promise(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve even on error to not block
      })
    )
  );
}

// Count how many sprite images for a character def are loaded vs total
export function getDefLoadProgress(def) {
  let total = 0, loaded = 0;
  const check = img => { if (!img) return; total++; if (img.complete && img.naturalWidth > 0) loaded++; };
  if (def._animSheetImages) Object.values(def._animSheetImages).forEach(check);
  if (def.overlay?._img) check(def.overlay._img);
  if (def.projectile?._imgs) def.projectile._imgs.forEach(check);
  return { total, loaded };
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
    const tx = Math.round(target.x - _cameraX + _overscanX);
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
      const dx = -destW / 2;
      const dy = -destH + offsetY;
      const fadeR = fighter.def.animSheetFadeR;
      if (fadeR) {
        // Draw to offscreen canvas so fade doesn't erase the background
        if (!_fadeOC || _fadeOC.width < destW || _fadeOC.height < destH) {
          _fadeOC = document.createElement('canvas');
          _fadeOC.width  = Math.ceil(destW);
          _fadeOC.height = Math.ceil(destH);
        }
        const oc = _fadeOC;
        const oCtx = oc.getContext('2d');
        oCtx.clearRect(0, 0, oc.width, oc.height);
        oCtx.imageSmoothingEnabled = false;
        oCtx.drawImage(img, col * fw + cropX, row * fh + cropY, cropW, cropH, 0, 0, destW, destH);
        // Erase right edge with gradient
        oCtx.globalCompositeOperation = 'destination-out';
        const lg = oCtx.createLinearGradient(destW - fadeR, 0, destW, 0);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(0,0,0,1)');
        oCtx.fillStyle = lg;
        oCtx.fillRect(destW - fadeR, 0, fadeR, destH);
        oCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(oc, 0, 0, destW, destH, dx, dy, destW, destH);
      } else {
        ctx.drawImage(img, col * fw + cropX, row * fh + cropY, cropW, cropH, dx, dy, destW, destH);
      }
      ctx.restore();
      drawComboCounter(fighter, px, py, renderTime);
      return;
    }
  }

  ctx.restore();
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

