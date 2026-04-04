# Audio Integration Plan

## Context
The game currently uses synthesized Web Audio API tones (oscillators) for all sound effects. The user has recorded/sourced real audio files and wants them wired into the game. This covers combat SFX, announcer voice lines, fighter voice grunts, and new game events (KO floor thuds ×2, 5-hit combo callout, per-character jump/crouch grunts).

---

## File Naming & Organization

### Current files → proposed names

Audio must live under `client/` to be served by the HTTP server. Copy from `/audio/` into `client/assets/audio/`.

**`client/assets/audio/sfx/`** — pure sound effects
| New name | Source file | Trigger |
|---|---|---|
| `punch_swing.wav` | `Effects/punch_whoosh.wav` | Punch thrown |
| `kick_swing.wav` | `Effects/kick_whoosh.wav` | Kick thrown |
| `punch_hit.wav` | `Effects/punch_connect.wav` | Punch lands |
| `kick_hit.wav` | `Effects/kick_connect.wav` | Kick lands |
| `ko_thud.wav` | `Effects/thud.wav` | Character hits floor (×2 during KO) |

**`client/assets/audio/voice/`** — announcer + fighter voices
| New name | Source file | Trigger |
|---|---|---|
| `round_announce_1.wav` | `Voices/announcer/1Round1.wav` | Round 1 intro |
| `round_announce_2.wav` | `Voices/announcer/1Round2.wav` | Round 2 intro |
| `round_announce_3.wav` | `Voices/announcer/1Round3.wav` | Round 3 intro |
| `round_fight.wav` | `Voices/announcer/1fight.wav` | Fight call ("Fight!") |
| `ko_announce.wav` | `Voices/announcer/1KOannounce.wav` | After KO lands |
| `ko_perfect.wav` | `Voices/announcer/1Perfect.wav` | Perfect win |
| `fighter_ko.wav` | `Voices/fighters/1KO.wav` | Default KO grunt (all except kickboxer) |

**`client/assets/audio/voice/fighters/`** — gender-based fighter voices
| New name | Source file | Trigger |
|---|---|---|
| `male_jump.wav` | `Voices/fighters/male_jump.wav` | Male character jumps |
| `male_crouch.wav` | `Voices/fighters/male_crouch.wav` | Male character crouches |
| `male_ko.wav` | `Voices/fighters/male_KO.wav` | Male character KO'd |
| `female_jump.wav` | `Voices/fighters/female_jump.wav` | Female character jumps |
| `female_crouch.wav` | `Voices/fighters/female_crouch.wav` | Female character crouches |

> **No female KO grunt** — female characters skip the KO grunt entirely.
> Each character def gets a `voice: 'male' | 'female'` field. The engine picks the matching file set.
> **Missing:** No 5-hit combo sound file found. `combo_5hit.wav` slot is reserved in `client/assets/audio/voice/`; wired once file is added.

---

## Code Changes

### 1. `client/js/audio.js`
- Add `loadSounds()` — preloads all files into an `AudioBuffer` map via `fetch` + `decodeAudioData`
- Add `playSound(key, volume=1)` — plays a buffered sound via `AudioBufferSourceNode`
- Replace `sfxSwing()` with `sfxPunchSwing()` and `sfxKickSwing()` using real files (keep synth as fallback if buffer missing)
- Replace `sfxKO()` with `sfxFighterKO(hasSfx)` — plays `fighter_ko.wav` (skip if `hasSfx=false` i.e. kickboxer)
- Add: `sfxKOThud()`, `sfxKOAnnounce()`, `sfxRoundAnnounce()`, `sfxRoundFight()`, `sfxPerfect()`, `sfxCombo5()`
- Call `loadSounds()` inside existing `initAudio()`

### 2. `client/js/fighter.js`
**Differentiate punch vs kick swing events** (lines ~498–513):
- `'punch'`/`'heavyPunch'` → `{ type: 'punch_swing' }`
- `'kick'`/`'heavyKick'` → `{ type: 'kick_swing' }`

**Add jump grunt event** (line ~471, where `inp.up && this.grounded`):
- Emit `{ type: 'jump_grunt', char: this.id }`

**Add crouch grunt event** (line ~445, where state becomes `'crouch'`):
- Emit `{ type: 'crouch_grunt', char: this.id }` only on state transition (guard with `this.state !== 'crouch'`)

**Add 5-hit combo event** (line ~563–564, after `comboCt++`):
- If `this.comboCt === 5` → emit `{ type: 'combo5' }`

**Wire KO double-thud audio + visual emphasis** (bounce physics already exist via `_koBounceCount` at fighter.js:315–322):
- On first floor hit (`_koBounceCount === 0`, line 317): emit `{ type: 'ko_thud' }` + set `this._koHoldFrames = 8` to freeze animation
- On second floor hit (`_koBounceCount === 1`, line 321): emit `{ type: 'ko_thud' }`, then after 20-frame delay emit `{ type: 'ko_announce' }`
- In `stepAnimation()` call (line 330): skip advance if `this._koHoldFrames > 0`, decrement it each tick instead — this gives a visible "slam" pause before the bounce so the floor hit reads clearly

**Character def voice field:**
- Add `voice: 'male'` or `voice: 'female'` to each character def
- Female characters have no KO grunt — engine skips it when `voice === 'female'`

### 3. `client/js/game.js`
Update `processEvents()` to handle new event types:
| Event | Audio call |
|---|---|
| `punch_swing` | `audio.sfxPunchSwing()` |
| `kick_swing` | `audio.sfxKickSwing()` |
| `hit` (punch) | `sfxPunchHit()` or `sfxKickHit()` based on `ev.attackType` |
| `ko` | `audio.sfxFighterKO(def.voice)` — skips if female |
| `ko_thud` | `audio.sfxKOThud()` |
| `ko_announce` | `audio.sfxKOAnnounce()` |
| `jump_grunt` | `audio.sfxJump(def.voice)` — plays male or female file |
| `crouch_grunt` | `audio.sfxCrouch(def.voice)` — plays male or female file |
| `combo5` | `audio.sfxCombo5()` |

Update `startRound()`:
- Play `sfxRoundAnnounce(roundNum)` on round start — picks `round_announce_1/2/3.wav` by `roundNum` (clamps to 3)
- Play `sfxRoundFight()` when `msgTimer` expires and state transitions to `'fight'`

Update `checkRoundEnd()`:
- Play `sfxPerfect()` when win condition is `'PERFECT!'`

---

## Verification
1. `cd client && python3 -m http.server 8000`
2. Start a match → hear "Round 1!" then "Fight!"
3. Throw punches and kicks → distinct whoosh sounds
4. Land a hit → distinct punch/kick impact sounds
5. Perform 5-hit combo → combo callout plays
6. KO opponent → KO grunt, two floor thuds, then "K.O.!" announcement
7. Win without taking damage → "Perfect!" call
8. Play as kickboxer → jump and crouch grunts fire; no KO grunt on KO
9. Play against kickboxer → KO grunt fires on opponent KO
