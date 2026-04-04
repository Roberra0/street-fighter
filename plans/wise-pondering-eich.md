# Plan: Arcade-Rat Playtest Session

## Context

The game is mechanically built (Part 1 complete) but hasn't been playtested for game feel. Before moving to sprite art (Part 2), we want a game-feel review that identifies what's working and what needs fixing. The arcade-rat agent will play the game using Chrome DevTools MCP tools, document findings, and propose changes.

## Tooling Reality

| Question | Answer |
|---|---|
| Can I play? | Yes — Chrome DevTools: navigate, press_key, take_screenshot |
| Can you watch live? | Yes — via screenshot viewer at `localhost:8000/playtest/viewer.html` |
| How does viewer work? | I write each screenshot to `client/playtest/screenshots/` as I play; viewer.html auto-refreshes every 2s |
| Where do notes go? | `specs/playtest-notes.md` |

**Viewing setup:**
1. I create `client/playtest/viewer.html` — a simple HTML page that auto-refreshes showing the latest screenshot
2. As I play, each screenshot gets written to `client/playtest/screenshots/frame_NNN.png`
3. You open `http://localhost:8000/playtest/viewer.html` — you see a rolling view of my gameplay frames
4. ~2 second lag between my action and your view

**YouTube reference:** Cannot watch videos. If you want reference frames from SF Alpha 3, screenshot key moments and share the image files.

## Prerequisites

User must have the game server running:
```bash
cd /Users/roberra/Documents/projects/Street_fighter/client
python3 -m http.server 8000
```

## Execution Plan

### Step 0 — Build the screenshot viewer
Create two files:
- `client/playtest/viewer.html` — auto-refreshing gallery showing latest screenshots in order
- `client/playtest/screenshots/` — directory where gameplay screenshots get saved

The viewer HTML will:
- List all `frame_NNN.png` files in `screenshots/`
- Show the most recent one large, thumbnails of prior frames below
- Auto-refresh every 2 seconds via `<meta http-equiv="refresh">`
- User opens `http://localhost:8000/playtest/viewer.html` to watch live

### Step 1 — Start Chrome DevTools session
- Confirm the MCP Chrome DevTools server is connected
- Navigate to `http://localhost:8000`
- Take screenshot → save as `client/playtest/screenshots/frame_001.png`
- Confirm the game loads and viewer works

### Step 2 — Play through all game states
Systematically test each screen and state:

1. **Title screen** — does it render, can I navigate
2. **Character select** — all 4 characters (Ryu, Trump, Obama, NeNe Leakes) selectable
3. **Map select** — 4 maps available
4. **Fight — 1P vs CPU** — play a full round vs CPU as Ryu
5. **Fight — test each move type**: light attack, heavy attack, motion inputs (QCF, DP)
6. **Super meter** — fill it, trigger a super, observe vignette
7. **KO moment** — observe hit stop, screen shake, round end
8. **Round 2, rematch** — does round system work

### Step 3 — Observe and screenshot key moments

For each moment, take a screenshot and note:
- What I see vs what the spec calls for (game-feel.md)
- Hit stop: is there any freeze on impact?
- Sound: is audio firing (can't hear, but can check console for errors)
- Particles: do sparks appear on hit?
- Vignette: does super cutscene trigger?
- UI: health bars, timer, super meter — accurate?

### Step 4 — Write findings to specs/playtest-notes.md

Structure:
```
# Playtest Notes — [date]

## What's Working
## Bugs Found
## Game Feel Gaps (vs game-feel.md spec)
## Proposed Fixes (prioritized)
```

### Step 5 — Proposed changes

After reviewing, propose specific code fixes in priority order:
1. **Blockers** (game-breaking bugs)
2. **High impact** (things that make the game feel bad)
3. **Polish** (nice-to-haves)

## Critical Files

- `client/js/game.js` — state machine, main loop
- `client/js/fighter.js` — move execution, hit stop, frame data
- `client/js/audio.js` — SFX triggers
- `client/js/particles.js` — spark effects
- `client/js/renderer.js` — visual feedback
- `specs/game-feel.md` — the target to compare against
- `specs/playtest-notes.md` — output destination (to be created)

## Verification

After playtest notes are written:
1. User has been watching live via `localhost:8000/playtest/viewer.html`
2. User reads `specs/playtest-notes.md` for the full analysis
3. User plays the game themselves at `localhost:8000` to confirm findings
4. User approves the proposed fix list before any code changes begin
