export default {
  id: 'dre',
  voiceSet: 'set_2',
  displayName: 'DRE',
  startX: 140,
  facing: 1,
  stats: {
    hp: 240,
    walkSpeed: 2.6,
    jumpVy: -12.08,
    jumpVx: 2.6,
  },
  palette: {
    skin:   '#6b3a2a',
    hair:   '#3a2010',
    outfit: '#1a3a1a',
    accent: '#cc8800',
  },
  hurtboxW: 62, hurtboxH: 190,
  crouchHurtboxW: 68, crouchHurtboxH: 105,
  moves: {
    punch: {
      startup: 2, active: 6, recovery: 6,
      damage: 8, knockback: 2.5,
      hitboxOffsetX: 28, hitboxW: 55, hitboxY: -148, hitboxH: 30,
    },
    heavyPunch: {
      startup: 2, active: 5, recovery: 6,
      damage: 14, knockback: 4.5,
      hitboxOffsetX: 26, hitboxW: 68, hitboxY: -152, hitboxH: 34,
    },
    kick: {
      startup: 3, active: 8, recovery: 8,
      damage: 15, knockback: 4.5,
      hitboxOffsetX: 22, hitboxW: 72, hitboxY: -63, hitboxH: 34,
    },
    heavyKick: {
      startup: 3, active: 8, recovery: 8,
      damage: 20, knockback: 6.5,
      hitboxOffsetX: 18, hitboxW: 92, hitboxY: -78, hitboxH: 44,
    },
  },
  holdCrouchFrame: 10,  // frame 10 of 20 = fully crouched pose
  holdBlockFrame:  24,  // frame 24 of 25 = last frame
  // Frame counts: idle:25  walk:21  punch:13  kick:19  recoil:12
  animations: {
    idle:       { frames: 13, fps: 24, loop: true, pingPong: true },
    walk:       { frames: 21, fps: 24, loop: true  },
    crouch:     { frames: 20, fps: 60, loop: true  },
    jump:       { frames: 14, fps: 14, loop: false },
    punch:      { frames: 13, fps: 60, loop: false },
    heavyPunch: { frames: 13, fps: 60, loop: false },
    kick:       { frames: 19, fps: 60, loop: false },
    heavyKick:  { frames: 19, fps: 60, loop: false },
    block:      { frames: 25, fps: 80, loop: false },
    hit:        { frames: 9,  fps: 40, loop: false },
    airHit:     { frames: 9,  fps: 40, loop: false },
    ko:         { frames: 9,  fps: 8,  loop: false },
  },

  // ── Per-animation sprite sheets ───────────────────────────────
  animSheetDivisor: 1,
  animSheetOffsetY: 1,
  animSheetCropX:   50,
  animSheetCropW:   280,
  animSheets: {
    idle:   { src: 'assets/characters/dre/dread_idle',    cols: 25, frameW: 382, frameH: 216 },
    walk:   { src: 'assets/characters/dre/dread_walk',    cols: 21, frameW: 382, frameH: 216 },
    punch:  { src: 'assets/characters/dre/dread_punch',   cols: 13, frameW: 382, frameH: 216 },
    kick:   { src: 'assets/characters/dre/dread_kick',    cols: 19, frameW: 382, frameH: 216 },
    recoil: { src: 'assets/characters/dre/DREAD_RECOIL',  cols: 9,  frameW: 382, frameH: 216 },
    crouch: { src: 'assets/characters/dre/DREAD_CROUCH',  cols: 20, frameW: 382, frameH: 216 },
    jump:   { src: 'assets/characters/dre/DREAD_JUMP',    cols: 14, frameW: 382, frameH: 216 },
    block:  { src: 'assets/characters/dre/dread_block.png', cols: 25, frameW: 382, frameH: 216 },
  },
  portrait: null,
};
