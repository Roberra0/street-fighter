export default {
  id: 'lady_kickboxer',
  displayName: 'LADY K',
  startX: 140,
  facing: 1,
  stats: {
    hp: 210,
    walkSpeed: 3.0,
    jumpVy: -11.0,
    jumpVx: 3.0,
  },
  palette: {
    skin:   '#c8825a',
    hair:   '#1a1a1a',
    outfit: '#2a2aaa',
    gloves: '#ee2222',
    shoes:  '#111111',
  },
  hurtboxW: 58, hurtboxH: 150,
  crouchHurtboxW: 64, crouchHurtboxH: 83,
  moves: {
    punch: {
      startup: 2, active: 4, recovery: 5,
      damage: 7, knockback: 2.0,
      hitboxOffsetX: 22, hitboxW: 40, hitboxY: -112, hitboxH: 22,
    },
    heavyPunch: {
      startup: 5, active: 4, recovery: 7,
      damage: 16, knockback: 4.5,
      hitboxOffsetX: 20, hitboxW: 52, hitboxY: -118, hitboxH: 28,
    },
    kick: {
      startup: 2, active: 5, recovery: 8,
      damage: 14, knockback: 4.0,
      hitboxOffsetX: 18, hitboxW: 58, hitboxY: -48, hitboxH: 28,
    },
    heavyKick: {
      startup: 6, active: 6, recovery: 9,
      damage: 24, knockback: 7.5,
      hitboxOffsetX: 15, hitboxW: 75, hitboxY: -60, hitboxH: 35,
    },
  },
  specials: [
    {
      id: 'spinning_heel',
      input: 'qcf',
      button: 'kick',
      damage: 26,
      startup: 5,
      active: 12,
      recovery: 12,
      type: 'spinning',
      vx: 3.5,
    },
    {
      id: 'flying_knee',
      input: 'dp',
      button: 'kick',
      damage: 22,
      startup: 4,
      active: 8,
      recovery: 14,
      type: 'uppercut',
      liftVy: -8,
      vx: 3,
      hitboxOffsetX: 4, hitboxW: 28, hitboxY: -50, hitboxH: 18,
    },
  ],
  super: {
    id: 'knockout_storm',
    input: 'qcf_qcf',
    button: 'kick',
    damage: 36,
    meterCost: 100,
    hits: 7,
    vignetteText: 'KNOCKOUT STORM!',
    type: 'rush_super',
    vx: 5,
  },
  holdCrouchFrame: 2,   // frame 2 of 4 = fully crouched pose
  // Frame counts: strip width / ~381.57px per frame
  // idle:4  walk:9  jump:12  kick:14  punch:7  recoil:13
  animations: {
    idle:       { frames: 4,  fps: 8,  loop: true  },
    walk:       { frames: 9,  fps: 20, loop: true  },
    crouch:     { frames: 4,  fps: 8,  loop: true  },
    jump:       { frames: 12, fps: 12, loop: false },
    punch:      { frames: 7,  fps: 40, loop: false },
    heavyPunch: { frames: 7,  fps: 40, loop: false },
    kick:       { frames: 14, fps: 56, loop: false },
    heavyKick:  { frames: 14, fps: 40, loop: false },
    block:      { frames: 13, fps: 30, loop: true  },
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
    idle:   { src: 'assets/characters/lady_kickboxer/lady_kickboxer_idle',   cols: 4,  frameW: 382, frameH: 216 },
    walk:   { src: 'assets/characters/lady_kickboxer/lady_kickboxer_walk',   cols: 9,  frameW: 382, frameH: 216 },
    jump:   { src: 'assets/characters/lady_kickboxer/lady_kickboxer_jump',   cols: 12, frameW: 382, frameH: 216 },
    kick:   { src: 'assets/characters/lady_kickboxer/lady_kickboxer_kick',   cols: 14, frameW: 382, frameH: 216 },
    punch:  { src: 'assets/characters/lady_kickboxer/lady_kickboxer_punch',  cols: 7,  frameW: 382, frameH: 216 },
    recoil: { src: 'assets/characters/lady_kickboxer/lady_kickboxer_recoil', cols: 13, frameW: 382, frameH: 216 },
  },
  portrait: null,
};
