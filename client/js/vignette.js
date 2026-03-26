// vignette.js — super move cutscene system
// Runs entirely in the render loop via tickVignette(). The sim tick is frozen
// for the duration via freezeTimer in game.js.

import { canvas, ctx } from './renderer.js';

// ---- State ----
let active          = false;
let vignetteTimer   = 0;
let vignetteCharDef = null;
let vignetteCallback = null;

const VIGNETTE_DURATION = 36; // 0.6 s at 60 fps

// ---- Character theme table ----
// Keyed by charDef.id. Fallback applied when id is unknown.
const CHAR_THEMES = {
  ryu:   { accent: '#3388ff', panel: '#1a1a3a' },
  trump: { accent: '#ffd700', panel: '#1a237e' },
  obama: { accent: '#cc4444', panel: '#1c1c2e' },
  nene:  { accent: '#ff69b4', panel: '#2d1b2e' },
};

const FALLBACK_THEME = { accent: '#ffffff', panel: '#111111' };

function getTheme(charDef) {
  if (!charDef) return FALLBACK_THEME;
  return CHAR_THEMES[charDef.id] || FALLBACK_THEME;
}

// ---- Helpers ----
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function hexToRgba(hex, alpha) {
  // Accepts 6-char hex strings like '#3388ff'.
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

// ---- Public API ----

export function runVignette(charDef, callback) {
  active           = true;
  vignetteTimer    = 0;
  vignetteCharDef  = charDef;
  vignetteCallback = callback;
}

export function isVignetteActive() {
  return active;
}

// Called from the render loop every frame (NOT every sim tick).
export function tickVignette() {
  if (!active) return;

  vignetteTimer++;
  drawVignette(vignetteTimer, vignetteCharDef);

  if (vignetteTimer >= VIGNETTE_DURATION) {
    active           = false;
    vignetteCharDef  = null;
    if (vignetteCallback) {
      vignetteCallback();
      vignetteCallback = null;
    }
  }
}

// ---- Core draw routine ----
function drawVignette(t, charDef) {
  const W = canvas.width;
  const H = canvas.height;
  const theme = getTheme(charDef);

  // Determine which side the portrait panel sits on.
  // facing: 1 = facing right (P1, left side of screen) → panel on left
  //         -1 = facing left (P2, right side of screen) → panel on right
  const facingRight = charDef ? charDef.facing >= 0 : true;
  const PANEL_W = W * 0.4;

  // ----------------------------------------------------------------
  // Phase 1 — Darkening  (t = 1–8)
  // ----------------------------------------------------------------
  if (t >= 1 && t <= 8) {
    // Dark overlay that ramps up to opacity 0.75 by t=8
    const overlayAlpha = (t / 8) * 0.75;
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    // Accent color flash at t=1, fading out by t=4
    if (t <= 4) {
      const flashAlpha = 0.4 * (1 - (t - 1) / 3);
      ctx.fillStyle = hexToRgba(theme.accent, flashAlpha);
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ----------------------------------------------------------------
  // Phase 2 — Portrait cut-in  (t = 9–24)
  // ----------------------------------------------------------------
  if (t >= 9 && t <= 24) {
    // Full black overlay held at 0.75
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Slide-in progress: 0 at t=9, 1 at t=24
    const slideT = (t - 9) / 15;

    // Compute panel x position (left or right side)
    let panelX;
    if (facingRight) {
      // Slides in from the left
      panelX = lerp(-PANEL_W, 0, slideT);
    } else {
      // Slides in from the right
      panelX = lerp(W, W - PANEL_W, slideT);
    }

    // Panel background
    ctx.fillStyle = theme.panel;
    ctx.fillRect(panelX, 0, PANEL_W, H);

    // Panel accent border — thin strip on the inner edge
    ctx.fillStyle = theme.accent;
    const borderW = 3;
    if (facingRight) {
      ctx.fillRect(panelX + PANEL_W - borderW, 0, borderW, H);
    } else {
      ctx.fillRect(panelX, 0, borderW, H);
    }

    // Character display name centered in the panel
    const panelCenterX = panelX + PANEL_W / 2;
    const panelCenterY = H / 2;

    ctx.save();
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charDef ? charDef.displayName : '???', panelCenterX, panelCenterY);
    ctx.restore();

    // Super text flashes in at t=16 with a scale pulse
    if (t >= 16) {
      const superText = (charDef && charDef.super && charDef.super.vignetteText)
        ? charDef.super.vignetteText
        : 'SUPER!';

      const scale = 1 + 0.3 * Math.sin((t - 16) * 0.5);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = theme.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text shadow for legibility over the scene
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 6;
      ctx.fillText(superText, 0, 0);
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  // Phase 3 — Hold + fade out  (t = 25–36)
  // ----------------------------------------------------------------
  if (t >= 25 && t <= 36) {
    // Overlay fades back out
    const overlayAlpha = 0.75 * (1 - (t - 25) / 11);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    // Slide progress: 0 = still at final position, 1 = fully off-screen
    const slideOutT = (t - 25) / 11;

    let panelX;
    if (facingRight) {
      panelX = lerp(0, -PANEL_W, slideOutT);
    } else {
      panelX = lerp(W - PANEL_W, W, slideOutT);
    }

    // Panel background
    ctx.fillStyle = theme.panel;
    ctx.fillRect(panelX, 0, PANEL_W, H);

    // Panel accent border
    ctx.fillStyle = theme.accent;
    const borderW = 3;
    if (facingRight) {
      ctx.fillRect(panelX + PANEL_W - borderW, 0, borderW, H);
    } else {
      ctx.fillRect(panelX, 0, borderW, H);
    }

    // Display name stays visible while panel is still on screen
    const panelCenterX = panelX + PANEL_W / 2;
    ctx.save();
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(charDef ? charDef.displayName : '???', panelCenterX, H / 2);
    ctx.restore();

    // Super text fades out in the center
    const textAlpha = Math.max(0, 1 - (t - 25) / 6);
    if (textAlpha > 0) {
      const superText = (charDef && charDef.super && charDef.super.vignetteText)
        ? charDef.super.vignetteText
        : 'SUPER!';

      const scale = 1 + 0.3 * Math.sin((24 - 16) * 0.5); // hold last pulse value

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = textAlpha;
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = theme.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 6;
      ctx.fillText(superText, 0, 0);
      ctx.restore();
    }
  }
}
