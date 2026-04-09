// fighter.js — Fighter class + stepAnimation() + character registry
import { getWallL, getWallR } from './renderer.js';
const t = () => `+${performance.now().toFixed(1)}ms`;

// ---- Altman idle frame log ----
const _altmanLog = [];
window.downloadAltmanLog = () => {
  const blob = new Blob([_altmanLog.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'samidlelog.md';
  a.click();
};
window.addEventListener('keydown', e => { if (e.key === 'L') window.downloadAltmanLog(); });

import lakerDef        from '../assets/characters/laker/def.js';
import ladyKickboxerDef from '../assets/characters/lady_kickboxer/def.js';
import dreadDef         from '../assets/characters/dread/def.js';
import skaterDef        from '../assets/characters/skater/def.js';
import techBroDef       from '../assets/characters/tech_bro/def.js';
import zuckDef          from '../assets/characters/zuck/def.js';
import altmanDef        from '../assets/characters/sam_altman/def.js';
import jackedJeffDef    from '../assets/characters/jacked_jeff/def.js';
import jensenDef        from '../assets/characters/jensen/def.js';
import skinnyJeffDef    from '../assets/characters/skinny_jeff/def.js';
import muskDef          from '../assets/characters/musk/def.js';
import {
  checkDoubleTap, isDirEdge,
  clearMotionOnUse,
  DIR_RIGHT, DIR_LEFT,
} from './input.js';

// ---- Character registry ----
export const CHARACTERS = {
  laker:          lakerDef,
  lady_kickboxer: ladyKickboxerDef,
  dread:          dreadDef,
  skater:         skaterDef,
  tech_bro:       techBroDef,
  zuck:           zuckDef,
  altman:         altmanDef,
  jacked_jeff:    jackedJeffDef,
  jensen:         jensenDef,
  skinny_jeff:    skinnyJeffDef,
  musk:           muskDef,
};

// ---- Physics constants (must match game.js / collision.js) ----
const GRAVITY = 0.38;
const GROUND  = 340;

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
    this.runBurst    = 0;  // frames remaining of fast-walk dash burst
    this.currentSpecial = null;  // active special/super definition
    this.crouchAttack   = false; // was crouching when attack started (lower hitbox)
    this.tookDamage     = false; // true if hit at least once this round
    this.inputBuffer      = null; // buffered attack type ('punch', 'heavyPunch', 'kick', 'heavyKick')
    this.inputBufferTimer = 0;    // frames left before buffer expires
    // Animation state (stepAnimation lives here per arch-review)
    this.animFrame   = 0;
    this.animCounter = 0;
    this.animDir     = 1; // 1 = forward, -1 = reverse (for pingPong loops)
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
      this.animDir     = 1;
      if (newState === 'ko') {
        this._koBounceCount    = 0;
        this._koHoldFrames     = 0;
        this._koAnnounceTimer  = 0;
      }
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
    const fpsMult = (this._state === 'walk' && this.runBurst > 0) ? 2.0 : 1;
    const defaultTicks = Math.max(1, Math.round(60 / (animDef.fps * fpsMult)));
    const ticksPerFrame = animDef.frameDurations
      ? (animDef.frameDurations[this.animFrame] ?? defaultTicks)
      : defaultTicks;
    if (this.animCounter >= ticksPerFrame) {
      this.animCounter = 0;
      // Crouch hold-frame: advance to holdCrouchFrame then freeze while button held
      const holdCrouchAt = this.def.holdCrouchFrame;
      // Block hold-frame: advance to holdBlockFrame then freeze while blocking
      const holdBlockAt = this.def.holdBlockFrame;
      if (this._state === 'block' && holdBlockAt !== undefined) {
        if (this.animFrame < holdBlockAt) this.animFrame++;
        // else stay frozen at holdBlockAt
      } else if (this._state === 'crouch' && holdCrouchAt !== undefined) {
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
      } else if (animDef.loop && animDef.pingPong) {
        this.animFrame += this.animDir;
        if (this.animFrame >= animDef.frames - 1) {
          this.animFrame = animDef.frames - 1;
          this.animDir = -1;
        } else if (this.animFrame <= 0) {
          this.animFrame = 0;
          this.animDir = 1;
        }
      } else if (animDef.loop) {
        this.animFrame++;
        if (this.animFrame >= animDef.frames) {
          this.animFrame = animDef.loopFrom !== undefined ? animDef.loopFrom : 0;
        }
        if (this.def.id === 'altman' && this._state === 'idle') {
          const seq = animDef.frameSequence;
          const spriteFrame = seq ? seq[Math.min(this.animFrame, seq.length - 1)] : this.animFrame;
          _altmanLog.push(`animFrame=${this.animFrame} spriteFrame=${spriteFrame}`);
        }
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
      inp.punch ? 'punch' :
      inp.kick  ? 'kick'  : null;
    if (freshAtk) {
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

    // Air attacks have reduced reach (1/3 shorter) — harder to stuff jumps
    const airW = this.grounded ? 1 : 2 / 3;

    // Helper: build a normal-attack hitbox from a move definition
    const normalHB = (m) => {
      const w = Math.round(m.hitboxW * airW);
      return {
        x: this.facing === 1
          ? this.x + m.hitboxOffsetX
          : this.x - m.hitboxOffsetX - w,
        y: this.y + m.hitboxY + yShift,
        w, h: m.hitboxH,
        dmg: m.damage, kb: m.knockback,
        isSpecial: false,
      };
    };

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
        this.vy += GRAVITY * (this.def.gravityScale ?? 1);
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
        this.vy += GRAVITY * (this.def.gravityScale ?? 1);
        this.y  += this.vy;
        this.x  += this.vx;
        if (this.y >= GROUND) {
          this.y  = GROUND;
          this.vx = 0;
          if (this._koBounceCount === 0) {
            // First floor hit — freeze frame briefly, then small bounce
            events.push({ type: 'ko_thud' });
            this._koHoldFrames  = 8;
            this.vy             = -3;
            this._koBounceCount = 1;
          } else {
            // Second floor hit — stop and queue announcer
            events.push({ type: 'ko_thud' });
            this.vy                = 0;
            this._koAnnounceTimer  = 20;
          }
        }
      }
      // KO announce countdown (fires after second landing)
      if (this._koAnnounceTimer > 0) {
        this._koAnnounceTimer--;
        if (this._koAnnounceTimer === 0) {
          events.push({ type: 'ko_announce' });
        }
      }
      // Clamp so the full sprite stays on screen (sprite is centered on this.x)
      const spriteHalfW = this.def.animSheets
        ? ((this.def.animSheetCropW || 60) * (this.def.animSheetScale || 1) / (this.def.animSheetDivisor || 1)) / 2
        : (this.def.hurtboxW || 30) / 2;
      this.x = Math.max(getWallL() + spriteHalfW, Math.min(getWallR() - spriteHalfW, this.x));
      // Freeze animation on first landing impact
      if (this._koHoldFrames > 0) {
        this._koHoldFrames--;
      } else {
        this.stepAnimation();
      }
      return events;
    }

    // Air hit: tumble in air, floor-slam on landing
    if (this._state === 'airHit') {
      this.vy += GRAVITY * (this.def.gravityScale ?? 1);
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
      if (!this.grounded) { this.vy += GRAVITY * (this.def.gravityScale ?? 1); this.y += this.vy; this.x += this.vx; }
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

    // Airborne
    if (!this.grounded) {
      // Allow left/right steering mid-air
      if (inp.left  && !inp.right) this.x -= stats.walkSpeed * 0.7;
      if (inp.right && !inp.left)  this.x += stats.walkSpeed * 0.7;
      this.vy += GRAVITY * (this.def.gravityScale ?? 1);
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
        this.inputBuffer = null; this.inputBufferTimer = 0;
        events.push({ type: 'swing' });
        this.stepAnimation();
        return events;
      }
      this.stepAnimation();
      return events;
    }

    // Block: hold direction away from opponent OR dedicated block button
    this.blocking = inp.block || ((this.facing === 1) ? inp.left : inp.right);

    // Double-tap run burst — hold direction after second tap for fast walk
    if (this.canAct() && this.grounded && this.runBurst === 0) {
      const fwdDir  = this.facing === 1 ? DIR_RIGHT : DIR_LEFT;
      const backDir = this.facing === 1 ? DIR_LEFT  : DIR_RIGHT;
      const holdFwd  = this.facing === 1 ? inp.right : inp.left;
      const holdBack = this.facing === 1 ? inp.left  : inp.right;
      if (isDirEdge(this.playerIdx, fwdDir) && checkDoubleTap(this.playerIdx, fwdDir) && holdFwd) {
        this.runBurst = 30;
        clearMotionOnUse(this.playerIdx);
      } else if (isDirEdge(this.playerIdx, backDir) && checkDoubleTap(this.playerIdx, backDir) && holdBack) {
        this.runBurst = 30;
        clearMotionOnUse(this.playerIdx);
      }
    }
    if (this.runBurst > 0) this.runBurst--;

    // Movement (back-walk is 50% slower than forward walk; run burst = 1.5×)
    const movingBack = (this.facing === 1) ? inp.left : inp.right;
    const burstMult  = this.runBurst > 0 ? 2.0 : 1;
    const spd = (movingBack ? stats.walkSpeed * 0.5 : stats.walkSpeed) * burstMult;
    if (inp.block && this.grounded) {
      this.state = 'block';
    } else if (inp.left && !inp.right) {
      this.x -= spd;
      this.state = 'walk';
    } else if (inp.right && !inp.left) {
      this.x += spd;
      this.state = 'walk';
    } else if (inp.down) {
      if (this._state !== 'crouch') events.push({ type: 'crouch_grunt', voiceSet: this.def.voiceSet ?? this.def.voice });
      this.state = 'crouch';
    } else {
      if (this._state === 'block') {
        this.state = 'idle';
      } else if (this._state === 'walk') {
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
      events.push({ type: 'jump_grunt', voiceSet: this.def.voiceSet ?? this.def.voice });
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

    // Merge live input with buffered press
    const bInp = {
      ...inp,
      punch: inp.punch || this.inputBuffer === 'punch',
      kick:  inp.kick  || this.inputBuffer === 'kick',
    };

    // Normal attacks — forward + button = heavy, neutral/back + button = light
    const pressingFwd = (this.facing === 1) ? inp.right : inp.left;
    if (bInp.punch && this.canAct()) {
      const isHeavy = pressingFwd && this.def.moves.heavyPunch;
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = isHeavy ? 'heavyPunch' : 'punch';
      this.timer = 0; this.didHit = false;
      events.push({ type: 'attack_grunt', voiceSet: this.def.voiceSet ?? this.def.voice });
    }
    if (bInp.kick && this.canAct()) {
      const isHeavy = pressingFwd && this.def.moves.heavyKick;
      this.crouchAttack = inp.down;
      this.inputBuffer = null; this.inputBufferTimer = 0;
      this.state = isHeavy ? 'heavyKick' : 'kick';
      this.timer = 0; this.didHit = false;
      events.push({ type: 'attack_grunt', voiceSet: this.def.voiceSet ?? this.def.voice });
    }

    // Face opponent
    if (this.canAct() || this._state === 'jump') {
      this.facing = opp.x > this.x ? 1 : -1;
    }

    this.x = Math.max(getWallL(), Math.min(getWallR(), this.x));

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
    if (this.comboCt === 4) events.push({ type: 'combo4', attackerId: attacker.playerIdx });
    if (this.comboCt === 5) events.push({ type: 'combo5', attackerId: attacker.playerIdx });

    // Score award — base damage * 10, scaled by combo depth
    const COMBO_SCORE_MULT = [0, 1, 1.5, 2, 2.5, 3];
    const scoreAward = Math.round(actualDmg * 10 * (COMBO_SCORE_MULT[Math.min(this.comboCt, 5)] || 1));
    const scorerId = attacker.playerIdx;

    // Air hit: override to tumble state
    if (!this.grounded) {
      this.state = 'airHit';
      this.vy    = 1.5;
      this.vx    = attacker.x > this.x ? -kb * 1.2 : kb * 1.2;
    } else {
      this.state = 'hit';
    }
    events.push({ type: 'recoil_grunt', voiceSet: this.def.voiceSet ?? this.def.voice });

    // Attacker gains meter for dealing damage
    if (attacker && attacker.meter !== undefined) {
      attacker.meter = Math.min(100, attacker.meter + actualDmg * 1.5);
    }

    if (this.hp <= 0) {
      this.state = 'ko';
      this.vy    = -7;
      this.vx    = attacker.x > this.x ? -3 : 3;
      this.y    -= 1;
      events.push({ type: 'ko', x: midX, y: this.y - 36, voiceSet: this.def.voiceSet ?? this.def.voice, noSpark: !!attacker?.def?.telekineticAttack, scoreAward, scorerId });
    } else {
      const attackType = (attacker._state || '').toLowerCase().includes('kick') ? 'kick' : 'punch';
      events.push({ type: 'hit', x: midX, y: this.y - 36, weight, attackType, noSpark: !!attacker?.def?.telekineticAttack, scoreAward, scorerId });
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
