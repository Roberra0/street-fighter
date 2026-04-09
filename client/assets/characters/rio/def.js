export default {
  id: 'rio',
  voiceSet: 'set_med',
  displayName: 'RIO',
  startX: 140,
  facing: 1,
  stats: {
    hp: 230,
    walkSpeed: 2.8,
    jumpVy: -13.23,
    jumpVx: 2.8,
  },
  palette: {
    body:   '#552583',  // Lakers purple
    skin:   '#8B5E3C',
    hair:   '#111111',
    accent: '#FDB927',  // Lakers gold
    pants:  '#552583',
    shoes:  '#FDB927',
  },
  hurtboxW: 68, hurtboxH: 165,
  crouchHurtboxW: 74, crouchHurtboxH: 91,
  moves: {
    punch: {
      startup: 1, active: 3, recovery: 9,
      damage: 9, knockback: 2.5,
      hitboxOffsetX: 24, hitboxW: 45, hitboxY: -133, hitboxH: 26,
    },
    heavyPunch: {
      startup: 3, active: 2, recovery: 4,
      damage: 18, knockback: 5.0,
      hitboxOffsetX: 22, hitboxW: 58, hitboxY: -137, hitboxH: 30,
    },
    kick: {
      startup: 2, active: 3, recovery: 3,
      damage: 13, knockback: 3.5,
      hitboxOffsetX: 18, hitboxW: 62, hitboxY: -57, hitboxH: 30,
    },
    heavyKick: {
      startup: 6, active: 5, recovery: 9,
      damage: 22, knockback: 7.0,
      hitboxOffsetX: 15, hitboxW: 82, hitboxY: -70, hitboxH: 38,
    },
  },
  holdCrouchFrame: 6,  // frame 6 of 13 = fully crouched pose
  holdBlockFrame:  23, // frame 23 of 24 = last frame
  animations: {
    idle:       { frames: 12, fps: 16, loop: true  },
    walk:       { frames: 21, fps: 26, loop: true  },
    crouch:     { frames: 13, fps: 40, loop: true  },
    jump:       { frames: 16, fps: 16, loop: false },
    punch:      { frames: 12, fps: 60, loop: false },
    heavyPunch: { frames: 12, fps: 60, loop: false },
    kick:       { frames: 19, fps: 60, loop: false },
    heavyKick:  { frames: 19, fps: 60, loop: false },
    block:      { frames: 24, fps: 80, loop: false },
    hit:        { frames: 2,  fps: 10, loop: false },
    airHit:     { frames: 2,  fps: 10, loop: false },
    ko:         { frames: 8,  fps: 8,  loop: false },
  },

  animSheetDivisor: 1,
  animSheetOffsetY: 9,
  animSheetCropX:   50,
  animSheetCropW:   280,
  animSheets: {
    idle:   { src: 'assets/characters/rio/fighter_trans_idle.png', cols: 4,  frameW: 122, frameH: 216, cropX: 0, cropW: 122 },
    walk:   { src: 'assets/characters/rio/LAKER_WALK',   cols: 21, frameW: 382, frameH: 216 },
    crouch: { src: 'assets/characters/rio/LAKER_CROUCH', cols: 13, frameW: 382, frameH: 216 },
    jump:   { src: 'assets/characters/rio/LAKER_JUMP',   cols: 16, frameW: 382, frameH: 216 },
    punch:  { src: 'assets/characters/rio/LAKER_PUNCH',  cols: 12, frameW: 384, frameH: 216 },
    kick:   { src: 'assets/characters/rio/LAKER_KICK',   cols: 19, frameW: 382, frameH: 216 },
    block:  { src: 'assets/characters/rio/laker_block.png', cols: 24, frameW: 382, frameH: 216 },
  },
  portrait: null,
};
