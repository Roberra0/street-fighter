# Plan: Street Brawl Full Mechanics Pass

## Context
The game's mechanics are missing several Street Fighter fundamentals documented in `Offical_SF_game_notes.md`. This pass closes the most important gaps to make the game feel authentic: directional blocking, chip damage, perfect round recognition, crouch attacks, asymmetric walk speed, dashes, and air-hit knockdown.

---

## Critical Files
- `client/js/fighter.js` — all mechanic logic lives here
- `client/js/input.js` — bindings + motion buffer
- `client/js/game.js` — round management, checkRoundEnd
- `client/js/ui.js` — controls overlay text
- `client/js/renderer.js` — new states need rendering (dash, airHit)

---

## Changes (in implementation order)

### 1. Directional Blocking — `fighter.js` line 466
**What:** Replace button-block (`inp.block`) with hold-back-to-block.

```js
// Old:
this.blocking = inp.block;

// New:
this.blocking = (this.facing === 1) ? inp.left : inp.right;
```

**Also:** Remove `block: 'KeyX'` from `BINDINGS[0]` in `input.js`.
Update `ui.js` controls overlay: replace "Block  X (hold)" with "Block  ← hold back".

---

### 2. Chip Damage on Specials — `fighter.js` receiveDamage, `game.js` projectiles
**What:** Special moves deal 50% damage through block. Normals deal 0 (unchanged).

Add `isSpecial = false` parameter to `receiveDamage(dmg, kb, attacker, isSpecial = false)`.

In the block branch (currently just pushes 'block' event and returns):
```js
if (isSpecial) {
  const chip = Math.max(1, Math.round(dmg * 0.5));
  this.hp = Math.max(0, this.hp - chip);
  // also emit a hit event so UI knows hp changed
}
```

**Update callers** to pass `true` for specials:
- `fighter.js` `activateSpecial()` → `opp.receiveDamage(sp.damage, sp.knockback || 2.5, this, true)`
- `game.js` `updateProjectiles()` → `opponent.receiveDamage(proj.dmg, 2.5, proj.owner, true)`
- `fighter.js` command_grab → grabs bypass block entirely (already true), no change needed

---

### 3. PERFECT! Recognition — `fighter.js` + `game.js`
**What:** If the winner took zero damage in the round, show "PERFECT!" instead of "K.O.!"

**fighter.js Fighter class:**
- Add `this.tookDamage = false` to constructor and `reset()`
- In `receiveDamage()`, when hit lands unblocked: `this.tookDamage = true`

**game.js `checkRoundEnd()`:**
```js
if (p2.hp <= 0) {
  p1Wins++;
  msgText = p1.tookDamage ? 'K.O.!' : 'PERFECT!';
}
if (p1.hp <= 0) {
  p2Wins++;
  msgText = p2.tookDamage ? 'K.O.!' : 'PERFECT!';
}
```

---

### 4. Crouch Attacks — `fighter.js` + `renderer.js`
**What:** Pressing punch or kick while crouching fires a lower hitbox attack.

**fighter.js:**
- Add `this.crouchAttack = false` to constructor
- In the normal attack block (lines 517–528), when initiating punch/kick:
  ```js
  this.crouchAttack = (inp.down);
  ```
- In `hitbox()`, when `this.crouchAttack` is true, shift hitboxY down by +20px (closer to ground):
  ```js
  const yOffset = this.crouchAttack ? 20 : 0;
  // apply yOffset to the returned hitbox y coordinate
  ```
- Reset `this.crouchAttack = false` when state exits punch/kick (when `canAct()` resumes)

**renderer.js:** For existing punch/kick draw functions, when fighter is in crouch state + attacking, keep body squished (reuse existing crouch body draw, just extend the arm/leg). No new state required — the renderer already checks `this._state`.

---

### 5. Slower Back-Walk — `fighter.js` line 469
**What:** Walking away from opponent is 20% slower (authentic SF pacing).

```js
// Old:
const spd = stats.walkSpeed;

// New:
const movingBack = (this.facing === 1) ? inp.left : inp.right;
const spd = movingBack ? stats.walkSpeed * 0.8 : stats.walkSpeed;
```

---

### 6. Forward / Back Dash — `fighter.js` + `renderer.js`
**What:** Double-tap forward = dash forward (~10 frames). Double-tap back = backdash (~8 frames).

`checkDoubleTap`, `DIR_LEFT`, `DIR_RIGHT` are **already imported** in `fighter.js` (line 8–10).

**fighter.js — in the movement/idle section (after blocking, before jump):**
```js
// Dash detection (only when idle/walk)
if (this.canAct() && this.grounded) {
  const fwdDir  = this.facing === 1 ? DIR_RIGHT : DIR_LEFT;
  const backDir = this.facing === 1 ? DIR_LEFT  : DIR_RIGHT;
  if (checkDoubleTap(this.playerIdx, fwdDir)) {
    this.state = 'dash'; this.timer = 0; this.vx = stats.walkSpeed * 3;
    clearMotionOnUse(this.playerIdx);
  } else if (checkDoubleTap(this.playerIdx, backDir)) {
    this.state = 'backdash'; this.timer = 0; this.vx = -stats.walkSpeed * 2.5;
    clearMotionOnUse(this.playerIdx);
  }
}
```

**Dash state update (add alongside other state handlers in update()):**
```js
if (this._state === 'dash') {
  this.x += this.vx;
  this.timer++;
  if (this.timer >= 10) { this.vx = 0; this.state = 'idle'; }
  this.stepAnimation(); return events;
}
if (this._state === 'backdash') {
  this.x += this.vx;
  this.timer++;
  if (this.timer >= 8) { this.vx = 0; this.state = 'idle'; }
  this.stepAnimation(); return events;
}
```

**renderer.js:** For dash: draw character in walk frame 2 (mid-stride). For backdash: draw in walk frame 0 (feet together). No new art needed.

**Also:** Add `'dash'` and `'backdash'` to each character's `animations` block in their `def.js` files, aliased to walk frames, OR handle them in the renderer as walk frame overrides.

---

### 7. Air-Hit Knockdown — `fighter.js` + `renderer.js`
**What:** Getting hit while airborne knocks the fighter horizontally, they tumble and land hard.

**fighter.js `receiveDamage()`** — after the block check, before the combo scaling:
```js
if (!this.grounded) {
  // Air hit: override normal hit state with tumble
  this.state    = 'airHit';
  this.stunTimer = 30;          // longer stun than ground hit
  this.vy       = 1.5;          // slight downward (gravity does the rest)
  this.vx       = attacker.x > this.x ? -kb * 1.2 : kb * 1.2;
  // still apply damage + attacker meter gain (falls through to existing code)
}
```

When `airHit` fighter lands (y >= GROUND in the airborne update block):
```js
if (this._state === 'airHit' && this.y >= GROUND) {
  this.y  = GROUND;
  this.vy = 0;
  this.vx = 0;
  this.state     = 'hit';    // brief ground recovery
  this.stunTimer = 20;
  events.push({ type: 'hit', weight: 'heavy', x: this.x, y: this.y }); // floor-slam audio+shake
}
```

**renderer.js:** Add 'airHit' case to each `_drawXxx()` function — draw character rotated/horizontal. Implementation: translate to fighter position, rotate canvas 90°, draw the hurt frame. Simple `ctx.save() / ctx.rotate(Math.PI/2) / drawHurtFrame / ctx.restore()` per character.

---

## Verification
1. Start server: `cd client && python3 -m http.server 8000`
2. Hold back arrow while opponent attacks → block animation, no damage for normals, 50% for specials
3. Win a round without taking any damage → "PERFECT!" message
4. Press down + punch while crouching → attack hits low (crouching opponent gets hit, standing may whiff)
5. Walk toward opponent, then walk away → walking away feels visibly slower
6. Double-tap forward → character dashes; double-tap back → backdash
7. Jump and get hit mid-air → tumble horizontally, land with impact shake
