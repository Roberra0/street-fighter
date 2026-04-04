# Plan: Frame Thumbnail — Show Full Frame + Lightbox Preview

## Context

Two problems visible in the screenshot:
1. `object-fit: cover` + `aspect-ratio: 16/9` crops the sprite — you only see the mid-torso because the sprite is taller than the 16:9 cell
2. No way to inspect a frame at full size before deciding to select it

---

## Fix 1 — Show full frame in thumbnails (1-line CSS change)

Change `object-fit: cover` → `object-fit: contain` on `.frame-thumb img`.

The cell keeps `aspect-ratio: 16/9` as a safe bounding box. The full frame fits inside with letterboxing on non-16:9 content. The dark `var(--surface)` background already fills the letterbox areas cleanly.

**File:** `frontend/style.css` — `.frame-thumb img`

---

## Fix 2 — Expand icon + lightbox modal

### Thumbnail hover state
Each thumbnail gets a `<button class="thumb-expand">⤢</button>` overlay injected in `buildFrameStrip`. It sits top-right, hidden until hover. Clicking it opens the lightbox **without** toggling selection (stopPropagation).

```
┌──────────────────┐
│               [⤢]│  ← expand button (visible on hover)
│                  │
│   [full frame]   │
│                  │
└──────────────────┘
  frame 4 ✓
```

### Lightbox modal
Fullscreen dark overlay. Shows:
- Full frame image (contained, any aspect ratio)
- Frame number + selected state badge
- ← → arrow buttons to step through ALL frames
- "Select / Deselect" toggle button
- × close button (top-right)
- Keyboard: `Escape` = close, `←` `→` = navigate, `Space` = toggle selection

```
┌─────────────────────────────────────────────────────┐
│                                                  [×] │
│                                                      │
│              ┌─────────────────┐                     │
│              │                 │                     │
│    [  ←  ]   │  [full frame]   │   [  →  ]           │
│              │                 │                     │
│              └─────────────────┘                     │
│                   Frame 4                            │
│              [ ✓ Deselect ]                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation

### `frontend/style.css`
- `object-fit: cover` → `object-fit: contain` on `.frame-thumb img`
- Add `.thumb-expand` button: `position: absolute`, top-right of thumb, hidden by default, shown on `.frame-thumb:hover`
- `.frame-thumb` gets `position: relative`
- Add `.lightbox` overlay (fixed, full viewport, z-index 100, dark bg)
- `.lightbox-img` — contained, max 80vw/80vh
- `.lightbox-nav` — left/right arrow buttons
- `.lightbox-toggle-btn` — select/deselect button

### `frontend/index.html`
- Add lightbox markup before `</body>`: single `<div id="lightbox" class="lightbox hidden">` with inner structure

### `frontend/app.js`
- In `buildFrameStrip`: add `<button class="thumb-expand">` with `stopPropagation`, calls `openLightbox(i)`
- `openLightbox(index)`: sets lightbox image src, frame label, selected state, removes `hidden`
- `closeLightbox()`: adds `hidden`
- Lightbox prev/next: navigate through all frames (0 to frameCount-1), update image + label + button state
- Lightbox toggle button: calls `toggleFrame`, updates button label
- Keyboard listener: `keydown` on document — Escape, ArrowLeft, ArrowRight, Space

---

## Files changed
- `frontend/style.css` — thumbnail + lightbox styles
- `frontend/index.html` — lightbox HTML
- `frontend/app.js` — expand button in buildFrameStrip + lightbox open/close/navigate/toggle logic
