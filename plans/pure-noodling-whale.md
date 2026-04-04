# Sprite Pipeline Automation Plan

## Context
Creating new characters requires repeating a tedious workflow 6-9 times (once per action). The user generates action videos in Grok, then processes each one individually through the Sprite Extractor app (frame picking + export), then runs Photoshop actions on each exported sheet (green removal, resize, color reduction). This plan eliminates the repetition and removes the Photoshop step entirely.

## Current Workflow (per action, repeated 6-9 times)
1. Generate base image → Grok video (1 sec, 480p 16:9, lime green BG)
2. Load video into Sprite Extractor → pick frames that loop well → export sprite sheet
3. Photoshop actions: remove green BG → resize → 256-color indexed palette → export

## Target Workflow (all actions at once)
1. Upload base image → type prompts per action → **generate 3 video variations simultaneously** via xAI API → preview & pick winners (new Grok Generation UI)
2. Selected videos flow into batch frame picker → pick frames per action → **one-click "Export All"** that does green removal + resize + quantize + proper naming
3. (Optional) CLI for re-processing or batch post-processing existing sheets

---

## What We're Building

### A. Grok Video Generation UI (new tab/page in Sprite Extractor)
**Eliminates the Grok web UI bottleneck.** Generate 3 parallel video variations per action via xAI API, preview side-by-side, pick the best, flow directly into frame picker.

### B. Web UI Batch Mode (upgrade Sprite Extractor)
**The main win.** Load all action videos simultaneously (from Grok gen or manual upload), curate frames for each, export everything processed and game-ready in one click.

### C. CLI Batch Script
For post-processing: takes exported sprite sheets (or videos) and batch-runs green removal + resize + quantize + rename + export to game folder + generate def.js. Useful when you already have sheets from the web UI and want to reprocess, or for scripting.

---

## Phase 0: Grok Video Generation UI

### New file: `backend/grok_client.py`
Async wrapper around xAI's video generation API.
- `generate_video(api_key, prompt, image_url_or_base64, duration=2, resolution="480p", aspect_ratio="16:9")` → returns `request_id`
- `poll_status(api_key, request_id)` → returns `{status, progress, video_url}`
- `generate_variations(api_key, prompt, image, count=3)` → fires N parallel generation requests, returns list of request_ids

**API flow:**
1. `POST https://api.x.ai/v1/videos/generations` with `model: "grok-imagine-video"`, `prompt`, `image` (base64 data URI of uploaded base image), `duration: 2`, `resolution: "480p"`, `aspect_ratio: "16:9"`
2. Returns `{request_id}` immediately
3. Poll `GET https://api.x.ai/v1/videos/{request_id}` until `status: "done"`
4. Download video from returned `video.url`

### New endpoints in `backend/main.py`:
| Endpoint | Purpose |
|----------|---------|
| `POST /grok/generate` | Start generation: accepts `{prompt, image (base64), action_name, variations: 3}` → fires N parallel API calls, returns request_ids |
| `GET /grok/status/{request_id}` | Poll single generation status + progress % |
| `GET /grok/status-all` | Poll all active generations at once |
| `POST /grok/select/{action}` | User picks a winner → downloads video, loads into batch state for frame picking |

API key stored server-side via env var `XAI_API_KEY` or entered in the UI (stored in session, never persisted to disk).

### Frontend: "Generate" tab in Sprite Extractor
- **API key input** (masked, stored in JS memory only)
- **Base image upload** — single image used for all actions
- **Action prompt table** — 9 rows (idle, walk, punch, kick, jump, crouch, recoil, block, ko), each with:
  - Editable prompt text (pre-filled with sensible defaults like "character performing idle breathing animation on lime green background")
  - "Generate 3" button → fires 3 parallel generations
  - Progress bars (polls `/grok/status-all` every 2 seconds)
  - 3 video thumbnails/players when done → click to select winner
- **"Send to Batch"** button — takes all selected videos and loads them into the batch frame picker (Phase 2)

**Cost estimate:** 9 actions × 3 variations × 2 sec × $0.05/sec = **$2.70 per character** (if all actions generated fresh). Regens of individual actions cost $0.30 each.

---

## Phase 1: Post-Processing Module (shared by both tools)

### New file: `backend/post_process.py`
- `resize_frame(pil_image, target_w=382, target_h=216)` — LANCZOS resize
- `quantize_colors(pil_image, num_colors=256)` — indexed 256-color palette with alpha preservation
- `process_strip(strip_image, target_frame_size, chroma_params, quantize=True)` — full pipeline: chroma key → resize → quantize on a complete sprite strip

### Modify: `backend/sprite_builder.py`
- Add optional `target_size=(w, h)` param to resize frames before compositing
- Add `quantize` param to reduce colors on final strip
- Already produces horizontal strips — no layout change needed

### New file: `backend/defjs_generator.py`
- Template-based def.js generation using dread's format as reference
- Auto-fills: `id`, `displayName`, `animations` frame counts, `animSheets` paths/cols
- Placeholder defaults for stats, moves, hitboxes (user tunes later)

---

## Phase 2: Web UI Batch Mode

### Modify: `backend/main.py`
Expand `_state` to hold multiple videos keyed by action name.

New endpoints:
| Endpoint | Purpose |
|----------|---------|
| `POST /batch/upload/{action}` | Upload video for one action slot (idle, punch, etc.) |
| `GET /batch/frame/{action}/{index}` | Frame preview for specific action |
| `POST /batch/preview-bg/{action}` | BG removal preview for specific action |
| `POST /batch/export` | Export ALL actions as ZIP: processed strips + def.js |
| `DELETE /batch/{action}` | Remove an action from batch |

Memory management: only hold full frames for the currently-active action. Other actions store metadata (frame count, fps) until export time.

### Modify: `frontend/index.html`
Add batch mode UI (toggled from single-video mode):
- **Character name** text input
- **9 action slots** (idle, walk, punch, kick, jump, crouch, recoil, block, ko) — each is a drop zone
- Each slot shows: uploaded filename, frame count, mini loop preview
- **Expandable frame picker** per action — click an action to expand its frame selection UI (reuse existing range/manual mode, compact)
- **Shared settings panel**: chroma key (hue/tolerance/softness), target frame size (382x216 default), quantize toggle
- **"Export All" button** → processes everything server-side → downloads ZIP

### Modify: `frontend/app.js`
- `batchState` object: character name, per-action upload/frame-selection state
- Per-action upload handlers
- Compact per-action frame picker (collapse/expand)
- Loop preview per action (reuse existing animation preview)
- Batch export → ZIP download
- Existing single-video mode untouched

### Modify: `frontend/style.css`
- Action slot grid layout
- Expandable panel styling
- Compact frame picker variant

---

## Phase 3: CLI Batch Script

### New file: `batch_sprites.py` (project root)

```
python batch_sprites.py \
  --input-dir ./videos/nene/ \
  --character nene \
  --game-root /path/to/Street_fighter \
  --generate-def
```

**Accepts two input types:**
1. **Video files** — extracts all frames, assembles strip (no frame picking — use web UI for that)
2. **Existing sprite sheet PNGs** — just runs post-processing (green removal, resize, quantize)

**Workflow:**
1. Scan input dir, match files to actions by filename (`idle.mp4`, `nene_punch.png`, etc.)
2. For videos: extract frames → assemble horizontal strip
3. For all: chroma key → resize to 382x216 → quantize to 256 colors
4. Save as `{character}_{action}` (extensionless) to game character folder
5. If `--generate-def`: produce `def.js` with correct frame counts and animSheets paths
6. Print summary table

**Flags:** `--frame-size WxH`, `--hue/--tolerance/--softness`, `--output-dir`, `--with-extension`

---

## Phase 4: Game Integration Helper

Generated `def.js` includes:
- Correct `animSheets` entries with paths and frame counts
- Placeholder stats/moves/palette with TODO comments
- The import line to add to `client/js/fighter.js`

---

## Files Summary

**Sprite Extractor — modify:**
| File | Changes |
|------|---------|
| `backend/main.py` | Batch endpoints, multi-video state |
| `backend/sprite_builder.py` | Add target_size + quantize params |
| `frontend/index.html` | Batch mode UI with action slots |
| `frontend/app.js` | Batch state management + handlers |
| `frontend/style.css` | Batch mode styling |

**Sprite Extractor — create:**
| File | Purpose |
|------|---------|
| `backend/grok_client.py` | xAI video generation API wrapper |
| `backend/post_process.py` | Resize, quantize, chroma pipeline |
| `backend/defjs_generator.py` | Template-based def.js generation |
| `batch_sprites.py` | CLI batch pipeline |

**Street Fighter — generated output (per character):**
| File | Purpose |
|------|---------|
| `client/assets/characters/{name}/def.js` | Character definition |
| `client/assets/characters/{name}/{name}_{action}` | Strip PNGs (extensionless) |

---

## Build Order
1. `backend/post_process.py` — standalone processing functions
2. `backend/sprite_builder.py` updates — add resize + quantize params
3. `backend/defjs_generator.py` — def.js template generator
4. `backend/main.py` — batch endpoints (upload/frame/export)
5. Frontend batch mode (HTML + JS + CSS)
6. `backend/grok_client.py` — xAI API wrapper
7. `backend/main.py` — Grok generation endpoints
8. Frontend Grok generation tab + "Send to Batch" flow
9. `batch_sprites.py` — CLI script (uses backend modules)

---

## Verification
1. **Grok generation:** Enter API key, upload base image, generate 3 variations for one action → verify videos appear, selection works, "Send to Batch" loads video into batch state
2. **Web UI batch:** Upload 3 action videos, pick frames for each, Export All → verify ZIP contains correct strips (transparent, 382x216, 256-color, extensionless) + valid def.js
3. **CLI:** Run on existing sprite sheets → verify post-processing output matches expectations
4. **Game integration:** Drop generated files into character folder, add import to fighter.js → confirm character renders and animates correctly in-game
5. **Regression:** Single-video mode in Sprite Extractor still works unchanged

---

## Dependencies
- `httpx` or `aiohttp` — async HTTP client for xAI API calls (add to requirements.txt)
- Existing deps (FastAPI, OpenCV, Pillow, NumPy, rembg) remain unchanged

Sources:
- [xAI Video Generation Docs](https://docs.x.ai/developers/model-capabilities/video/generation)
- [xAI REST API Reference — Videos](https://docs.x.ai/developers/rest-api-reference/inference/videos)
