export default {
  id: 'zuri',
  voice: 'female',
  displayName: 'ZURI',
  startX: 140,
  facing: 1,
  stats: {
    hp: 210,
    walkSpeed: 3.0,
    jumpVy: -12.65,
    jumpVx: 3.0,
  },  hurtboxW: 58, hurtboxH: 150,
  crouchHurtboxW: 64, crouchHurtboxH: 83,
  moves: {
    punch: {
      startup: 1, active: 3, recovery: 1,
      damage: 7, knockback: 2.0,
      hitboxOffsetX: 22, hitboxW: 52, hitboxY: -112, hitboxH: 22,
    },
    heavyPunch: {
      startup: 2, active: 3, recovery: 2,
      damage: 16, knockback: 4.5,
      hitboxOffsetX: 20, hitboxW: 52, hitboxY: -118, hitboxH: 28,
    },
    kick: {
      startup: 1, active: 2, recovery: 1,
      damage: 14, knockback: 4.0,
      hitboxOffsetX: 18, hitboxW: 58, hitboxY: -48, hitboxH: 28,
    },
    heavyKick: {
      startup: 2, active: 3, recovery: 2,
      damage: 24, knockback: 7.5,
      hitboxOffsetX: 15, hitboxW: 75, hitboxY: -60, hitboxH: 35,
    },
  },
  holdCrouchFrame: 17,  // frame 17 of 18 = last frame (fully crouched pose)
  // Frame counts: strip width / ~381.57px per frame
  // idle:4  walk:9  jump:12  kick:14  punch:7  recoil:13
  animations: {
    idle:       { frames: 4,  fps: 8,  loop: true  },
    walk:       { frames: 9,  fps: 20, loop: true  },
    crouch:     { frames: 18, fps: 24, loop: false },
    jump:       { frames: 12, fps: 12, loop: false },
    punch:      { frames: 7,  fps: 90, loop: false },
    heavyPunch: { frames: 7,  fps: 70, loop: false },
    kick:       { frames: 14, fps: 90, loop: false },
    heavyKick:  { frames: 14, fps: 80, loop: false },
    block:      { frames: 13, fps: 80, loop: true  },
    hit:        { frames: 13, fps: 40, loop: false },
    airHit:     { frames: 13, fps: 40, loop: false },
    ko:         { frames: 13, fps: 8,  loop: false },
  },

  // ── Per-animation sprite sheets ───────────────────────────────
  // All strips are 216px tall, ~382px per frame.
  // animSheetCropX / animSheetCropW trim horizontal whitespace — tune if clipped.
  animSheetDivisor: 1,
  animSheetOffsetY: 18,     // measured: 18px pad below feet in frame
  animSheetCropX:   50,     // px from left edge of each frame to character
  animSheetCropW:   280,    // width of visible character area per frame
  animSheets: {
    idle:   { src: 'assets/characters/zuri/lady_kickboxer_idle.webp',   cols: 4,  frameW: 382, frameH: 216 },
    walk:   { src: 'assets/characters/zuri/lady_kickboxer_walk.webp',   cols: 9,  frameW: 382, frameH: 216 },
    jump:   { src: 'assets/characters/zuri/lady_kickboxer_jump.webp',   cols: 12, frameW: 382, frameH: 216 },
    kick:   { src: 'assets/characters/zuri/lady_kickboxer_kick.webp',   cols: 14, frameW: 382, frameH: 216 },
    punch:  { src: 'assets/characters/zuri/lady_kickboxer_punch.webp',  cols: 7,  frameW: 382, frameH: 216 },
    recoil: { src: 'assets/characters/zuri/lady_kickboxer_recoil.webp', cols: 13, frameW: 382, frameH: 216 },
    block:  { src: 'assets/characters/zuri/kickboxer_block.webp',   cols: 13, frameW: 382, frameH: 216 },
  },
  portrait: null,
};
