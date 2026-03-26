// fighter.js — Fighter class + stepAnimation() + character registry
const t = () => `+${performance.now().toFixed(1)}ms`;

import ryuDef   from '../assets/characters/ryu/def.js';
import trumpDef from '../assets/characters/trump/def.js';
import obamaDef from '../assets/characters/obama/def.js';
import neneDef  from '../assets/characters/nene/def.js';
import lakerDef        from '../assets/characters/laker/def.js';
import ladyKickboxerDef from '../assets/characters/lady_kickboxer/def.js';
import dreadDef         from '../assets/characters/dread/def.js';
import skaterDef        from '../assets/characters/skater/def.js';
import techBroDef       from '../assets/characters/tech_bro/def.js';
import {
  checkQCF, checkQCB, checkDP, checkDoubleTap, isDirEdge,
  clearMotionOnUse,
  DIR_RIGHT, DIR_LEFT,
} from './input.js';

// ---- Character registry ----
export const CHARACTERS = {
  ryu:   ryuDef,
  trump: trumpDef,
  obama: obamaDef,
  nene:  neneDef,
  laker:          lakerDef,
  lady_kickboxer: ladyKickboxerDef,
  dread:          dreadDef,
  skater:         skaterDef,
  tech_bro:       techBroDef,
};

// ---- Physics constants (must match game.js / collision.js) ----
const GRAVITY = 0.38;
const GROUND  = 340;
const WALL_L  = 24;
const WALL_R  = 640 - 24; // GW - 24

// ---- Fighter class ----
export class Fighter {
  // def: a character definition object (e.g. ryuDef)
  // playerIdx: 0 or 1 — used to read the correct input buffer slot
  constructor(def, playerIdx = 0) {
    this.def       = def;
    this.playerIdx = playerIdx;
    this.startX    = def.startX;
    this.facing    = def.facing;
    this.reset();
  }

  reset() {
    this.x        = this.startX;
    this.y        = GROUND;
    this.vx       = 0;
    this.vy       = 0;
    this.hp       = this.def.stats.hp;
    this.meter    = 0;   // 0–100 super meter
    this._state   = 'idle';
    this.timer    = 0;
    this.didHit   = false;
    this.blocking = false;
    this.comboCt  = 0;
    this.comboTimer  = 0;
    this.stunTimer   = 0;
    this.pushVx      = 0;
    this.currentSpecial = null;  // active special/super definition
    this.crouchAttack   = false; // was crouching when attack started (lower hitbox)
    this.tookDamage     = false; // true if hit at least once this round
    this.inputBuffer      = null; // buffered attack type ('punch', 'heavyPunch', 'kick', 'heavyKick')
    this.inputBufferTimer = 0;    // frames left before buffer expires
    // Animation state (stepAnimation lives here per arch-review)
    this.animFrame   = 0;
    this.animCounter = 0;
  }

  // state getter/setter — resets animation counters on state change
  get state() {
    return this._state;
  }
  set state(newState) {
    if (newState !== this._state) {
      this._state      = newState;
      this.animFrame   = 0;
      this.animCounter = 0;
    }
  }

  // stepAnimation — advances animFrame based on the current animation def.
  // Called once per sim tick by game.js (or can be called from update).
  stepAnimation() {
    // crouchFinish reuses the crouch sheet so timing and frame count match
    const stateForAnim = (this._state === 'crouchFinish') ? 'crouch' : this._state;
    const animDef = (this.def.animations && this.def.animations[stateForAnim])
                 || (this.def.animations && this.def.animations.idle)
                 || { frames: 1, fps: 8, loop: true };
    this.animCounter++;
    const defaultTicks = Math.max(1, Math.round(60 / animDef.fps));
    const ticksPerFrame = animDef.frameDurations
      ? (animDef.frameDurations[this.animFrame] ?? defaultTicks)
      : defaultTicks;
    if (this.animCounter >= ticksPerFrame) {
      this.animCounter = 0;
      // Crouch hold-frame: advance to holdCrouchFrame then freeze while button held
      const holdCrouchAt = this.def.holdCrouchFrame;
      if (this._state === 'crouch' && holdCrouchAt !== undefined) {
        if (this.animFrame < holdCrouchAt) this.animFrame++;
        // else stay frozen at holdCrouchAt
      } else if (this._state === 'crouchFinish') {
        // Continue crouch animation from hold frame to end, then return to idle
        this.animFrame = Math.min(this.animFrame + 1, animDef.frames - 1);
        if (this.animFrame >= animDef.frames - 1) this.state = 'idle';
      // Walk hold-frame: cycle between holdWalkFrame-1, holdWalkFrame, holdWalkFrame+1
      } else {
      const holdAt = this.def.holdWalkFrame;
      if (this._state === 'walk' && holdAt !== undefined && this.animFrame >= holdAt - 1) {
        const lo = holdAt - 1, hi = holdAt + 1;
        this.animFrame = this.animFrame >= hi ? lo : this.animFrame + 1;
      } else if (this._state === 'walkFinish') {
        // Continue walk animation from holdWalkFrame+1 after key release
        this.animFrame = Math.min(this.animFrame + 1, animDef.frames - 1);
        if (this.animFrame >= animDef.frames - 1) this.state = 'idle';
      } else if (animDef.loop) {
        this.animFrame = (this.animFrame + 1) % animDef.frames;
      } else {
        this.animFrame = Math.min(this.animFrame + 1, animDef.frames - 1);
        // Hit animation finished and stun already expired → return to idle
        if ((this._state === 'hit' || this._state === 'airHit') &&
            this.animFrame >= animDef.frames - 1 && this.stunTimer <= 0) {
          this.state = 'idle';
        }
      }
      } // end else (non-crouch animation logic)
    }
  }

  // Called during freeze ticks so attack presses aren't lost while sim is paused.
  feedInputBuffer(inp) {
    const freshAtk =
      inp.punch      ? 'punch'      :
      inp.heavyPunch ? 'heavyPunch' :
      inp.kick       ? 'kick'       :
      inp.heavyKick  ? 'heavyKick'  : null;
    if (freshAtk) {
      console.log(`${t()} [P${this.playerIdx + 1}] press: ${freshAtk} | state: ${this._state} | canAct: ${this.canAct()} | stun: ${this.stunTimer}`);
      this.inputBuffer      = freshAtk;
      this.inputBufferTimer = 8;
    }
  }

  get grounded() {
    return this.y >= GROUND;
  }

  hurtbox() {
    const crouch = this._state === 'crouch';
    const w = crouch
      ? (this.def.crouchHurtboxW || 30)
      : (this.def.hurtboxW      || 28);
    const h = crouch
      ? (this.def.crouchHurtboxH || 48)
      : (this.def.hurtboxH      || 68);
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }

  hitbox() {
    const moves  = this.def.moves;
    // Crouch attacks hit lower — shift hitbox Y toward ground
    const yShift = this.crouchAttack ? 20 : 0;

    // Helper: build a normal-attack hitbox from a move definition
    const normalHB = (m) => ({
      x: this.facing === 1
        ? this.x + m.hitboxOffsetX
        : this.x - m.hitboxOffsetX - m.hitboxW,
      y: this.y + m.hitboxY + yShift,
      w: m.hitboxW, h: m.hitboxH,
      dmg: m.damage, kb: m.knockback,
      isSpecial: false,
    });

    if (this._state === 'punch' &&
        this.timer >= moves.punch.startup &&
        this.timer <= moves.punch.startup + moves.punch.active && !this.didHit)
      return normalHB(moves.punch);

    if (this._state === 'heavyPunch' && moves.heavyPunch &&
        this.timer >= moves.heavyPunch.startup &&
        this.timer <= moves.heavyPunch.startup + moves.heavyPunch.active && !this.didHit)
      return normalHB(moves.heavyPunch);

    if (this._state === 'kick' &&
        this.timer >= moves.kick.startup &&
        this.timer <= moves.kick.startup + moves.kick.active && !this.didHit)
      return normalHB(moves.kick);

    if (this._state === 'heavyKick' && moves.heavyKick &&
        this.timer >= moves.heavyKick.startup &&
        this.timer <= moves.heavyKick.startup + moves.heavyKick.active && !this.didHit)
      return normalHB(moves.heavyKick);

    // Special move hitbox — only for non-projectile specials during active frames
    if (
      this._state.startsWith('special_') &&
      this.currentSpecial &&
      this.currentSpecial.type !== 'projectile' &&
      this.currentSpecial.type !== 'super_projectile'
    ) {
      const sp = this.currentSpecial;
      if (
        this.timer >= sp.startup &&
        this.timer <= sp.startup + sp.active &&
        !this.didHit
      ) {
        const offX = sp.hitboxOffsetX !== undefined ? sp.hitboxOffsetX : 8;
        const w    = sp.hitboxW !== undefined ? sp.hitboxW : 30;
        const h    = sp.hitboxH !== undefined ? sp.hitboxH : 16;
        const hy   = sp.hitboxY !== undefined ? sp.hitboxY : -40;
        return {
          x: this.facing === 1
            ? this.x + offX
            : this.x - offX - w,
          y: this.y + hy,
          w,
          h,
          dmg: sp.damage,
          kb:  2.5,
          isSpecial: true,
        };
      }
    }

    // Super hitbox — command grab handled separately; rush/uppercut types get a hitbox
    if (this._state === 'super' && this.currentSpecial) {
      const sp = this.currentSpecial;
      if (
        sp.type !== 'command_grab' &&
        sp.type !== 'super_projectile' &&
        this.timer >= sp.startup &&
        this.timer <= sp.startup + (sp.active || 30) &&
        !this.didHit
      ) {
        const w  = sp.hitboxW !== undefined ? sp.hitboxW : 40;
        const h  = sp.hitboxH !== undefined ? sp.hitboxH : 20;
        const hy = sp.hitboxY !== undefined ? sp.hitboxY : -40;
        return {
          x: this.facing === 1
            ? this.x + 8
            : this.x - 8 - w,
          y: this.y + hy,
          w,
          h,
          dmg: sp.damage,
          kb:  4.0,
          isSpecial: true,
        };
      }
    }

    return null;
  }

  canAct() {
    return (
      (this._state === 'idle' ||
       this._state === 'walk' ||
       this._state === 'walkFinish' ||
       this._state === 'crouch' ||
       this._state === 'crouchFinish') &&
      this.stunTimer <= 0
    );
  }

  // --- Special input detection ---

  // Returns true when the special's motion + correct button are present.
  checkSpecialInput(special, inp) {
    const pi = this.playerIdx;
    // Any punch or heavy punch triggers punch-button specials (and same for kick)
    if (special.button === 'punch' && !inp.punch && !inp.heavyPunch) return false;
    if (special.button === 'kick'  && !inp.kick  && !inp.heavyKick)  return false;

    switch (special.input) {
      case 'qcf': return checkQCF(pi);
      case 'qcb': return checkQCB(pi);
      case 'dp':  return checkDP(pi, this.facing);
      case 'ff':  return checkDoubleTap(pi, this.facing === 1 ? DIR_RIGHT : DIR_LEFT);
      default:    return false;
    }
  }

  // Super fires on plain punch press when meter >= 100 — no motion input required.
  checkSuperInput(inp) {
    const superMove = this.def.super;
    if (!superMove) return false;
    return !!(inp.punch || inp.heavyPunch);
  }

  // Activate a special move.
  activateSpecial(special) {
    const events = [];
    clearMotionOnUse(this.playerIdx);
    this.state          = 'special_' + special.id;
    this.timer          = 0;
    this.didHit         = false;
    this.currentSpecial = special;

    if (special.type === 'projectile') {
      events.push({ type: 'spawn_projectile', owner: this, special });
    } else if (special.type === 'uppercut' || special.type === 'spinning' || special.type === 'armored_dash' || special.type === 'dash_strike') {
      // Apply a velocity burst on the fighter itself
      if (special.liftVy !== undefined) {
        this.vy = special.liftVy;
        this.y -= 1;
      }
      if (special.vx !== undefined) {
        this.vx = special.vx * this.facing;
      }
    }
    events.push({ type: 'swing' });
    return events;
  }

  // Activate the super move.
  activateSuper(superMove) {
    const events = [];
    clearMotionOnUse(this.playerIdx);
    this.meter          = 0;
    this.state          = 'super';
    this.timer          = 0;
    this.didHit         = false;
    this.currentSpecial = superMove;

    if (superMove.type === 'super_projectile') {
      events.push({ type: 'spawn_projectile', owner: this, special: superMove });
    } else if (superMove.type === 'rush_super') {
      this.vx = superMove.vx * this.facing;
    }
    events.push({ type: 'super_start', fighter: this, superMove });
    events.push({ type: 'swing' });
    return events;
  }

  // update() returns an array of event objects.
  // It must NOT call audio functions or set global state.
  update(inp, opp) {
    const events = [];
    const stats  = this.def.stats;

    // Buffer attack inputs immediately — before any early returns (stun, attack, dash, etc.)
    // so presses during any non-actionable state are preserved until canAct() is true.
    this.feedInputBuffer(inp);

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.comboCt = 0;
    }

    // Pushback
    if (this.pushVx !== 0) {
      this.x += this.pushVx;
      this.pushVx *= 0.7;
      if (Math.abs(this.pushVx) < 0.3) this.pushVx = 0;
    }

    // Stun
    if (this.stunTimer > 0) {
      this.stunTimer--;
      if (this.stunTimer <= 0 && (this._state === 'hit' || this._state === 'block')) {
        // For hit: wait until the recoil animation finishes before returning to idle
        const animDef = this.def.animations?.[this._state];
        const animDone = !animDef || this.animFrame >= animDef.frames - 1;
        if (animDone || this._state === 'block') this.state = 'idle';
      }
      if (!this.grounded) {
        this.vy += GRAVITY;
        this.y  += this.vy;
        this.x  += this.vx;
        if (this.y >= GROUND) {
          this.y  = GROUND;
          this.vx = 0;
          this.vy = 0;
        }
      }
      this.stepAnimation();
      return events;
    }

    // KO — physics only, no input
    if (this._state === 'ko') {
      if (!this.grounded) {
        this.vy += GRAVITY;
        this.y  += this.vy;
        this.x  += this.vx;
        if (this.y >= GROUND) {
          this.y  = GROUND;
          this.vx = 0;
        }
      }
      this.stepAnimation();
      return events;
    }

    // Air hit: tumble in air, floor-slam on landing
    if (this._state === 'airHit') {
      this.vy += GRAVITY;
      this.y  += this.vy;
      this.x  += this.vx;
      if (this.y >= GROUND) {
        this.y         = GROUND;
        this.vy        = 0;
        this.vx        = 0;
        this.state     = 'hit';
        this.stunTimer = 12;
        events.push({ type: 'hit', weight: 'heavy', x: this.x, y: this.y - 10 });
      }
      this.stepAnimation();
      return events;
    }

    // Attack animation timer — handles all 4 normal attack states
    const attackStates = {
      punch:      this.def.moves.punch,
      heavyPunch: this.def.moves.heavyPunch,
      kick:       this.def.moves.kick,
      heavyKick:  this.def.moves.heavyKick,
    };
    const atkMove = attackStates[this._state];
    if (atkMove) {
      this.timer++;
      const total = atkMove.startup + atkMove.active + atkMove.recovery;
      if (this.timer > total) {
        this.state        = 'idle';
        this.timer        = 0;
        this.didHit       = false;
        this.crouchAttack = false;
      }
      if (!this.grounded) { this.vy += GRAVITY; this.y += this.vy; this.x += this.vx; }
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.vx = 0; }
      this.stepAnimation();
      return events;
    }

    // Dash states
    if (this._state === 'dash') {
      this.x += this.vx;
      this.timer++;
      if (this.timer >= 10) { this.vx = 0; this.state = 'idle'; }
      this.stepAnimation();
      return events;
    }
    if (this._state === 'backdash') {
      this.x += this.vx;
      this.timer++;
      if (this.timer >= 8) { this.vx = 0; this.state = 'idle'; }
      this.stepAnimation();
      return events;
    }

    // Special move animation timer
    if (this._state.startsWith('special_') && this.currentSpecial) {
      this.timer++;
      const sp    = this.currentSpecial;
      const total = sp.startup + sp.active + sp.recovery;

      // Apply continuous velocity for movement-based specials
      if ((sp.type === 'spinning' || sp.type === 'dash_strike' || sp.type === 'armored_dash') &&
           sp.vx !== undefined &&
           this.timer >= sp.startup &&
           this.timer < sp.startup + sp.active) {
        this.x += sp.vx * this.facing;
      }

      // Apply gravity if airborne during special
      if (!this.grounded) {
        this.vy += GRAVITY;
        this.y  += this.vy;
        this.x  += this.vx;
        if (this.y >= GROUND) {
          this.y  = GROUND;
          this.vx = 0;
          this.vy = 0;
        }
      }

      if (this.timer > total) {
        this.state          = 'idle';
        this.timer          = 0;
        this.didHit         = false;
        this.currentSpecial = null;
        this.vx             = 0;
      }
      this.stepAnimation();
      return events;
    }

    // Super animation timer
    if (this._state === 'super' && this.currentSpecial) {
      this.timer++;
      const sp    = this.currentSpecial;
      const total = (sp.startup || 0) + (sp.active || 30) + (sp.recovery || 30);

      // Rush super: move toward opponent during active frames
      if (sp.type === 'rush_super' && sp.vx !== undefined &&
          this.timer >= sp.startup &&
          this.timer < sp.startup + (sp.active || 30)) {
        this.x += sp.vx * this.facing;
      }

      // Command grab: check contact range once at startup completion
      if (sp.type === 'command_grab' && this.timer === sp.startup && !this.didHit) {
        const dist = Math.abs(this.x - opp.x);
        if (dist <= sp.grabRange) {
          const grabEvents = opp.receiveDamage(sp.damage, 3.0, this, true);
          events.push(...grabEvents);
          this.didHit = true;
          // Drain opponent's meter on successful grab
          if (sp.onHitDrainMeter) {
            opp.meter = Math.max(0, opp.meter - sp.onHitDrainMeter);
          }
          // Gain meter for landing the super
          this.meter = Math.min(100, this.meter + sp.damage * 0.5);
        }
      }

      if (this.timer > total) {
        this.state          = 'idle';
        this.timer          = 0;
        this.didHit         = false;
        this.currentSpecial = null;
        this.vx             = 0;
      }
      this.stepAnimation();
      return events;
    }

    // Airborne
    if (!this.grounded) {
      // Allow left/right steering mid-air
      if (inp.left  && !inp.right) this.x -= stats.walkSpeed * 0.7;
      if (inp.right && !inp.left)  this.x += stats.walkSpeed * 0.7;
      this.vy += GRAVITY;
      this.y  += this.vy;
      this.x  += this.vx;
      if (this.y >= GROUND) {
        this.y  = GROUND;
        this.vy = 0;
        this.vx = 0;
        this.state = 'idle';
      }
      const airAtk =
        inp.punch      ? 'punch'      :
        inp.heavyPunch ? 'heavyPunch' :
        inp.kick       ? 'kick'       :
        inp.heavyKick  ? 'heavyKick'  : null;
      if (airAtk) {
        this.state  = airAtk;
        this.timer  = 0;
        this.didHit = false;
        events.push({ type: 'swing' });
        this.stepAnimation();
        return events;
      }
      this.stepAnimation();
      return events;
    }

    // Block: hold direction away from opponent OR dedicated block button
    this.blocking = inp.block || ((this.facing === 1) ? inp.left : inp.right);

    // Dash detection (double-tap forward or back, grounded only)
    if (this.canAct() && this.grounded) {
      const fwdDir  = this.facing === 1 ? DIR_RIGHT : DIR_LEFT;
      const backDir = this.facing === 1 ? DIR_LEFT  : DIR_RIGHT;
      if (isDirEdge(this.playerIdx, fwdDir) && checkDoubleTap(this.playerIdx, fwdDir)) {
        this.state = 'dash';
        this.timer = 0;
        this.vx    = stats.walkSpeed * 3 * this.facing;
        clearMotionOnUse(this.playerIdx);
      } else if (isDirEdge(this.playerIdx, backDir) && checkDoubleTap(this.playerIdx, backDir)) {
        this.state = 'backdash';
        this.timer = 0;
        this.vx    = -stats.walkSpeed * 2.5 * this.facing;
        clearMotionOnUse(this.playerIdx);
      }
    }

    // Movement (back-walk is 20% slower than forward walk)
    const movingBack = (this.facing === 1) ? inp.left : inp.right;
    const spd = movingBack ? stats.walkSpeed * 0.5 : stats.walkSpeed;
    if (inp.left && !inp.right) {
      this.x -= spd;
      this.state = 'walk';
    } else if (inp.right && !inp.left) {
      this.x += spd;
      this.state = 'walk';
    } else if (inp.down) {
      this.state = 'crouch';
    } else {
      if (this._state === 'walk') {
        // If character has a holdWalkFrame and was holding there, play finish before idle
        const holdAt = this.def.holdWalkFrame;
        if (holdAt !== undefined && this.animFrame >= holdAt) {
          this.state = 'walkFinish';
        } else {
          this.state = 'idle';
        }
      } else if (this._state === 'crouch') {
        const holdCrouchAt = this.def.holdCrouchFrame;
        if (holdCrouchAt !== undefined && this.animFrame >= holdCrouchAt) {
          // Preserve animFrame across state change so finish plays from hold position
          const savedFrame = this.animFrame;
          this.state = 'crouchFinish';
          this.animFrame = savedFrame;
        } else {
          this.state = 'idle';
        }
      }
    }

    // Jump
    if (inp.up && this.grounded) {
      this.vy    = stats.jumpVy;
      this.y    -= 1;
      this.state = 'jump';
      this.vx    = inp.left ? -stats.jumpVx : inp.right ? stats.jumpVx : 0;
    }

    // Decay input buffer timer — only counts down when the fighter is actionable (not during
    // stun/attack/etc. since those paths return early before reaching here).
    if (this.inputBufferTimer > 0) {
      this.inputBufferTimer--;
    } else {
      if (this.inputBuffer) {
        console.log(`${t()} [P${this.playerIdx + 1}] buffer EXPIRED: ${this.inputBuffer} | state: ${this._state}`);
      }
      this.inputBuffer = null;
    }

    // Merge live input with buffered press so specials + normals can both fire from buffer
    const bInp = {
      ...inp,
      punch:      inp.punch      || this.inputBuffer === 'punch',
      heavyPunch: inp.heavyPunch || this.inputBuffer === 'heavyPunch',
      kick:       inp.kick       || this.inputBuffer === 'kick',
      heavyKick:  inp.heavyKick  || this.inputBuffer === 'heavyKick',
    };

    // --- Special / Super input detection (highest priority before normals) ---
    if (this.canAct()) {
      // Check super first
      if ((bInp.punch || bInp.heavyPunch || bInp.kick || bInp.heavyKick) && this.meter >= 100) {
        if (this.def.super && this.checkSuperInput(bInp)) {
          this.inputBuffer = null; this.inputBufferTimer = 0;
          const superEvents = this.activateSuper(this.def.super);
          events.push(...superEvents);
          this.stepAnimation();
          return events;
        }
      }

      // Then check specials
      if (bInp.punch || bInp.heavyPunch || bInp.kick || bInp.heavyKick) {
        const specials = this.def.specials || [];
        for (const special of specials) {
          if (this.checkSpecialInput(special, bInp)) {
            this.inputBuffer = null; this.inputBufferTimer = 0;
            const spEvents = this.activateSpecial(special);
            events.push(...spEvents);
            this.stepAnimation();
            return events;
          }
        }
      }
    }

    // Normal attacks (crouchAttack flag lowers hitbox when initiated from crouch)
    if (bInp.punch && this.canAct()) {
      console.log(`${t()} [P${this.playerIdx + 1}] FIRE: punch (fromBuffer: ${!inp.punch})`);
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = 'punch'; this.timer = 0; this.didHit = false;
      events.push({ type: 'swing' });
    } else if (bInp.heavyPunch && this.canAct()) {
      console.log(`${t()} [P${this.playerIdx + 1}] FIRE: heavyPunch (fromBuffer: ${!inp.heavyPunch})`);
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = 'heavyPunch'; this.timer = 0; this.didHit = false;
      events.push({ type: 'swing' });
    }
    if (bInp.kick && this.canAct()) {
      console.log(`${t()} [P${this.playerIdx + 1}] FIRE: kick (fromBuffer: ${!inp.kick})`);
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = 'kick'; this.timer = 0; this.didHit = false;
      events.push({ type: 'swing' });
    } else if (bInp.heavyKick && this.canAct()) {
      console.log(`${t()} [P${this.playerIdx + 1}] FIRE: heavyKick (fromBuffer: ${!inp.heavyKick})`);
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = 'heavyKick'; this.timer = 0; this.didHit = false;
      events.push({ type: 'swing' });
    }

    // Face opponent
    if (this.canAct() || this._state === 'jump') {
      this.facing = opp.x > this.x ? 1 : -1;
    }

    this.x = Math.max(WALL_L, Math.min(WALL_R, this.x));

    this.stepAnimation();
    return events;
  }

  // receiveDamage() returns an array of event objects.
  // It must NOT call audio functions or set global state.
  // isSpecial: true → specials deal 50% chip damage through block
  receiveDamage(dmg, kb, attacker, isSpecial = false) {
    const events = [];
    const midX   = (this.x + attacker.x) / 2;

    const facingAtt = (attacker.x > this.x) === (this.facing === 1);
    if (this.blocking && facingAtt && this.grounded) {
      this.state     = 'block';
      this.stunTimer = 5;
      this.pushVx    = attacker.x > this.x ? -kb * 0.8 : kb * 0.8;
      // Special moves deal 50% chip damage through block
      if (isSpecial) {
        const chip = Math.max(1, Math.round(dmg * 0.5));
        this.hp = Math.max(0, this.hp - chip);
        this.tookDamage = true;
      }
      events.push({ type: 'block', x: midX, y: this.y - 34 });
      return events;
    }

    // Combo damage scaling: 100%, 90%, 75%, 60%, 50% for hits 1, 2, 3, 4, 5+
    const COMBO_SCALE = [1.0, 0.9, 0.75, 0.6, 0.5];
    const scale = COMBO_SCALE[Math.min(this.comboCt, COMBO_SCALE.length - 1)];
    const actualDmg = Math.round(dmg * scale);

    // Determine hit weight for hitstop/shake variation
    let weight;
    if (dmg < 8)       weight = 'light';
    else if (dmg < 15) weight = 'heavy';
    else               weight = 'special';

    this.hp         = Math.max(0, this.hp - actualDmg);
    this.tookDamage = true;
    this.stunTimer  = 8;
    this.pushVx     = attacker.x > this.x ? -kb * 1.4 : kb * 1.4;
    this.comboCt++;
    this.comboTimer = 60;

    // Air hit: override to tumble state
    if (!this.grounded) {
      this.state = 'airHit';
      this.vy    = 1.5;
      this.vx    = attacker.x > this.x ? -kb * 1.2 : kb * 1.2;
    } else {
      this.state = 'hit';
    }

    // Attacker gains meter for dealing damage
    if (attacker && attacker.meter !== undefined) {
      attacker.meter = Math.min(100, attacker.meter + actualDmg * 1.5);
    }

    if (this.hp <= 0) {
      this.state = 'ko';
      this.vy    = -7;
      this.vx    = attacker.x > this.x ? -3 : 3;
      this.y    -= 1;
      events.push({ type: 'ko', x: midX, y: this.y - 36 });
    } else {
      events.push({ type: 'hit', x: midX, y: this.y - 36, weight });
    }

    return events;
  }
}

// Convenience factory: create a Fighter from a character id in the registry.
// playerIdx is passed through so input buffer lookups target the correct slot.
export function createFighter(id, playerIdx = 0) {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`Unknown character id: ${id}`);
  return new Fighter(def, playerIdx);
}
