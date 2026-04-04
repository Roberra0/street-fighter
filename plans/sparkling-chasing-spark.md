# Game Quality Rubric & Street Fighter Project Assessment

## Save Location

Write final document to:
`.claude/agents/consultants/claude-code/game_assessment.md`

## Context

The user wants a rubric for evaluating game quality, with this Street Fighter project ranked against it and actionable recommendations for improvement.

---

## Rubric: What Makes a Game Good

Each category is scored 1–5. Weights reflect importance for a fighting game specifically.

| # | Category | Weight | Description |
|---|----------|--------|-------------|
| 1 | **Core Game Feel** | ×3 | Does every input feel responsive, weighty, and satisfying? Hitstop, screen shake, audio feedback, animation snap |
| 2 | **Mechanical Depth** | ×3 | Is there something to master? Combos, spacing, mix-ups, okizeme, frame traps |
| 3 | **Visual Clarity** | ×2 | Can you read the action at a glance? Hitboxes communicate, animations are distinct, UI is clean |
| 4 | **Audio Feedback** | ×2 | Do hits, blocks, KOs feel different? Is there music? Do sounds reinforce action? |
| 5 | **Character Identity** | ×2 | Does each character feel meaningfully different to play? Unique specials, speed, range, gimmick |
| 6 | **Progression / Tension Arc** | ×2 | Does the match build? Do rounds escalate? Is there comebacks + stakes? |
| 7 | **Content & Replayability** | ×2 | How many characters, modes, maps? Is there a reason to keep playing? |
| 8 | **Solo Play Quality** | ×1.5 | Is the CPU opponent challenging and fun to fight? Are there goals to chase alone? |
| 9 | **Multiplayer Experience** | ×2 | Is 2P easy to set up? Is online play available? Is it fair? |
| 10 | **UI/UX Polish** | ×1.5 | Menus, flow, onboarding, first impression, readability |
| 11 | **Technical Stability** | ×1.5 | Does it crash? Drop frames? Desync? Undefined behavior? |
| 12 | **Originality / Personality** | ×1 | Does it have a voice? Is the roster or concept compelling and memorable? |

**Max raw score**: 5 × (3+3+2+2+2+2+2+1.5+2+1.5+1.5+1) = 5 × 23.5 = **117.5**

---

## Current Game Score

### 1. Core Game Feel — **4/5** (×3 = 12)
Hitstop is implemented with per-hit-weight variation (light 4fr, heavy 8fr, special 7fr). Screen shake scales with impact. Hit/block particles spawn on contact. Web Audio SFX are distinct. Input buffer preserves presses during freeze frames.
**Deduction**: No music. Coded placeholder art means animations are choppy (no inbetweens). Swing sound is very quiet.

### 2. Mechanical Depth — **3.5/5** (×3 = 10.5)
Combo system with damage scaling. Motion inputs (QCF, QCB, DP, FF). Blocking with chip on specials. Crouch, jump, crossup potential. Super meter with risk/reward activation. Hitstun, knockback, corner pressure.
**Deduction**: Heavy attacks have no keybinds (never directly usable). Armor frames, overhead detection, invincibility, and arcing projectiles are defined but not implemented. Mix-up game is limited without overheads or cross-ups.

### 3. Visual Clarity — **2.5/5** (×2 = 5)
Health bars, super meter, timer, and win indicators are clean and readable. Hitbox debug overlay is excellent for dev. Coded placeholder art communicates character silhouettes.
**Deduction**: 8 of 9 characters have no real sprite art — placeholder art reduces read-ability of attacks. Animations don't communicate startup/active/recovery visually. No attack animation distinguish-ability for opponents to react to.

### 4. Audio Feedback — **3/5** (×2 = 6)
Five distinct SFX (light hit, heavy hit, block, swing, KO, round start) using Web Audio synth. All correctly mapped to game events.
**Deduction**: No music at all (not even a simple loop). No announcer voice. SFX variety is minimal — only one hit sound per weight class, no unique character voices.

### 5. Character Identity — **4/5** (×2 = 8)
9 characters with unique stats (HP, speed, jump arc), distinct special move sets (9 types across roster), different super move types (projectile, rush, command grab), and character-themed vignette cutscenes with colors. Gameplay differentiators: Trump has armor frames + dash, NeNe has overheads + cross-ups, Obama has zoning tools.
**Deduction**: Unimplemented mechanics (armor, overheads) mean character differences are theoretical, not felt in play. Coded art means characters don't look distinct at a glance.

### 6. Progression / Tension Arc — **4/5** (×2 = 8)
Best-of-3 rounds. Super meter builds through combat, creating comeback potential. Combo scaling discourages infinites. KO messages (K.O., PERFECT!, TIME!) punctuate rounds. Win indicator squares track match state. Timer creates urgency.
**Deduction**: No dramatic comeback mechanic (no "rage" or low-health buff). Timer win is abrupt — no tension-of-the-clock drama.

### 7. Content & Replayability — **3/5** (×2 = 6)
9 characters defined. 4 maps. 2P local play. Character and map select screens.
**Deduction**: No arcade/story mode, no unlockables, no training mode, no score tracking. Only 1 real art character. Replay value depends entirely on 2P couch play.

### 8. Solo Play Quality — **1/5** (×1.5 = 1.5)
CPU opponent is a stub — it stands still and never acts. 1P mode is unplayable as a challenge.
**Deduction**: Full deduction. This is a known stub, but it's a major gap.

### 9. Multiplayer Experience — **3/5** (×2 = 6)
2P local works well — two full button sets mapped, both characters fully playable. Character/map select is shared and intuitive.
**Deduction**: No online play (network/rollback are stubs). No training mode for new players to learn. No rematch button (must navigate back through menus).

### 10. UI/UX Polish — **4/5** (×1.5 = 6)
Clean health bars, super meter with glow + hint, round messages, controls overlay (Tab), character select with visual indicators, map select with thumbnails, title screen with cursor.
**Deduction**: Debug overlay is always on (distracting in casual play). P2 control hint has a typo. No controller support.

### 11. Technical Stability — **4.5/5** (×1.5 = 6.75)
Fixed 60fps deterministic tick. Separate simulation/render layers. Proper game state machine. No observed crashes. Input buffer prevents missed inputs.
**Deduction**: Minor: debug mode always on, meter-on-chip-damage appears unintended, heavyPunch/heavyKick keybind gap.

### 12. Originality / Personality — **4.5/5** (×1 = 4.5)
The roster (Trump, Obama, NeNe Leakes, Ryu) is genuinely funny and memorable. Vignette cutscenes are dramatic and character-themed. The concept alone is a strong hook.

---

## Score Summary

| Category | Raw | Weight | Weighted |
|----------|-----|--------|----------|
| Core Game Feel | 4.0 | ×3 | 12.0 |
| Mechanical Depth | 3.5 | ×3 | 10.5 |
| Visual Clarity | 2.5 | ×2 | 5.0 |
| Audio Feedback | 3.0 | ×2 | 6.0 |
| Character Identity | 4.0 | ×2 | 8.0 |
| Progression/Tension | 4.0 | ×2 | 8.0 |
| Content/Replayability | 3.0 | ×2 | 6.0 |
| Solo Play Quality | 1.0 | ×1.5 | 1.5 |
| Multiplayer | 3.0 | ×2 | 6.0 |
| UI/UX Polish | 4.0 | ×1.5 | 6.0 |
| Technical Stability | 4.5 | ×1.5 | 6.75 |
| Originality | 4.5 | ×1 | 4.5 |
| **TOTAL** | | | **80.25 / 117.5** |

### **Overall Grade: 68% — "Solid Prototype"**

---

## Recommendations (Priority Order)

### 🔴 Critical (Blockers to being a real game)

**1. Fix the CPU opponent**
- CPU stands still and never acts. 1P mode is unplayable.
- Implementation: reactive AI — walk toward opponent, throw punch/kick when in range, occasionally block, simple specials.
- File: `client/js/cpu.js` — `cpuSnapshot()` returns all-false stubs.
- Impact: Solo Play jumps from 1 → 3.5. +3.75 weighted points.

**2. Real sprite art for top 4 characters**
- Ryu is done. Trump, Obama, NeNe need real sprite sheets.
- Impact: Visual Clarity jumps 2.5 → 4.5, Character Identity 4 → 5. +7 weighted points.
- This is a human art task, not code.

---

### 🟡 High Impact (Meaningfully improve the experience)

**3. Add background music**
- Even a single looping track per map (or one shared track) transforms the atmosphere.
- Can be synthesized via Web Audio (already used for SFX) or a single MP3/OGG.
- Impact: Audio Feedback 3 → 4. +2 weighted points.

**4. Implement heavy attack keybinds**
- `heavyPunch` and `heavyKick` moves exist per character but no keys map to them.
- Fix: bind `A`/`S` for P1 heavy and `U`/`I` for P2 heavy (currently mentioned in UI hints but not wired).
- Impact: Mechanical Depth 3.5 → 4.5. +3 weighted points.

**5. Implement the defined-but-missing mechanics**
- Invincibility frames on DPs (already in character defs, not in collision logic)
- Armor frames on Trump's Power Walk
- Overhead hits that must be blocked standing
- These are data-defined in `fighter.js` — just need collision/stun logic to check the flags.
- Impact: Mechanical Depth 3.5 → 4.5, Character Identity 4 → 5.

**6. Turn off debug overlay by default**
- `showDebug = true` is hardcoded in `renderer.js` or `game.js`.
- Toggle with `~` key in development, off in release.
- Impact: UI/UX Polish 4 → 4.5. +0.75 weighted points.

---

### 🟢 Nice to Have (Polish and longevity)

**7. Add a rematch button**
- After matchEnd, pressing Enter immediately restarts with same characters + map.
- Removes the friction of navigating back through menus for couch play.

**8. Training mode**
- Simple: P2 is CPU-controlled (can be set to stand still, crouch, jump, or attack dummy)
- Lets new players learn the motion inputs without getting combo'd.

**9. Sound effects variety**
- Per-character hit sounds (Ryu: "Hadouken!", Trump: "Tremendous!", NeNe: "Not today!")
- Even placeholder synth voices would add personality.

**10. Combo counter display**
- Show "2 HIT COMBO", "3 HIT COMBO" etc. on screen.
- Data already exists (combo tracking in fighter.js) — just needs a UI element in ui.js.

**11. Online play (Part 2)**
- WebRTC + rollback are stubbed and ready for implementation.
- Would move Multiplayer from 3 → 5. +4 weighted points. But significant build effort.

---

## Projected Score After Critical + High Impact Fixes

| Fix | Points Added |
|----|-------------|
| CPU opponent | +3.75 |
| Sprite art (top 4) | +7.0 |
| Background music | +2.0 |
| Heavy keybinds + mechanics | +4.0 |
| Debug toggle | +0.75 |
| **Total gain** | **+17.5** |
| **Projected score** | **~97.75 / 117.5 (83%)** |

### Projected Grade: **83% — "Releasable Fun Game"**
