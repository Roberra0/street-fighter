export default {
  id: 'jacked_jeff',
  voice: 'male',
  displayName: 'JACKED J',
  startX: 140,
  facing: 1,
  stats: {
    hp: 240,           // TODO: tune
    walkSpeed: 2.4,    // TODO: tune
    jumpVy: -12.08,
    jumpVx: 2.4,
  },
  palette: {
    skin:   '#cccccc', // TODO: set from character art
    hair:   '#333333',
    outfit: '#666666',
    accent: '#ff0000',
  },
  hurtboxW: 62, hurtboxH: 190,     // TODO: tune to character proportions
  crouchHurtboxW: 68, crouchHurtboxH: 105,
  moves: {
    punch:      { startup: 2, active: 6, recovery: 6, damage: 8,  knockback: 2.5, hitboxOffsetX: 28, hitboxW: 55, hitboxY: -148, hitboxH: 30 },
    heavyPunch: { startup: 2, active: 5, recovery: 6, damage: 14, knockback: 4.5, hitboxOffsetX: 26, hitboxW: 68, hitboxY: -152, hitboxH: 34 },
    kick:       { startup: 3, active: 8, recovery: 8, damage: 15, knockback: 4.5, hitboxOffsetX: 22, hitboxW: 72, hitboxY: -63,  hitboxH: 34 },
    heavyKick:  { startup: 3, active: 8, recovery: 8, damage: 20, knockback: 6.5, hitboxOffsetX: 18, hitboxW: 92, hitboxY: -78,  hitboxH: 44 },
  },
  holdCrouchFrame: 13,
  animations: {
    idle:        { frames:  25, fps: 24, loop: true, pingPong: true },
    walk:        { frames:  25, fps: 24, loop: true },
    crouch:      { frames:  25, fps: 60, loop: true },
    jump:        { frames:  25, fps: 14, loop: false },
    punch:       { frames:  25, fps: 60, loop: false },
    kick:        { frames:  15, fps: 60, loop: false },
    recoil:      { frames:  25, fps: 40, loop: false },
    block:       { frames: 6, fps: 120, loop: false, frameSequence: [0, 5, 10, 15, 20, 24] },
    ko:          { frames:  25, fps:  8, loop: false },
    heavyPunch:  { frames:  25, fps: 60, loop: false },
    heavyKick:   { frames:  25, fps: 60, loop: false },
    hit:         { frames:  25, fps: 40, loop: false },
    airHit:      { frames:  25, fps: 40, loop: false },
  },

  // Per-animation sprite sheets
  animSheetDivisor: 1,
  animSheetScale:   0.85,
  animSheetScaleY:  0.95,
  animSheetOffsetY: 0,   // TODO: tune vertical offset
  animSheetCropX:   50,  // TODO: tune horizontal crop
  animSheetCropW:   280, // TODO: tune visible width
  animSheets: {
    walk:    { src: 'assets/characters/jacked_jeff/jacked_jeff_walk.png',   cols: 25, frameW: 382, frameH: 216 },
    punch:   { src: 'assets/characters/jacked_jeff/jacked_jeff_punch.png',  cols: 25, frameW: 382, frameH: 216 },
    block:   { src: 'assets/characters/jacked_jeff/jacked_jeff_blockedvf.png',  cols: 25, frameW: 382, frameH: 216 },
    ko:      { src: 'assets/characters/jacked_jeff/jacked_jeff_kofinal.png', cols: 25, frameW: 382, frameH: 216, cropX: 0, cropW: 382 },
    recoil:  { src: 'assets/characters/jacked_jeff/jacked_jeff_recoil.png', cols: 25, frameW: 382, frameH: 216 },
    crouch:  { src: 'assets/characters/jacked_jeff/jacked_jeff_crouch2.png', cols: 25, frameW: 382, frameH: 216 },
    jump:    { src: 'assets/characters/jacked_jeff/jacked_jeff_jump.png',   cols: 25, frameW: 382, frameH: 216 },
    kick:    { src: 'assets/characters/jacked_jeff/jacked_jeff_kick.png',   cols: 25, frameW: 382, frameH: 216 },
    idle:    { src: 'assets/characters/jacked_jeff/jacked_jeff_idle.png',   cols: 25, frameW: 382, frameH: 216 },
  },
  projectile: {
    srcs: [
      'assets/characters/jacked_jeff/boxes_block.png',
      'assets/characters/jacked_jeff/boxes_other1.png',
      'assets/characters/jacked_jeff/boxes_other2.png',
      'assets/characters/jacked_jeff/boxes_other3.png',
      'assets/characters/jacked_jeff/boxes_ko.png',
    ],
    speed: 7, maxRange: 480,
    gravity: 0.35,
    angleSpeed: 0.05,
    w: 66, h: 66,
    damage: 12, knockback: 3.5,
    spawnOffsetX: 55, spawnOffsetY: -133,
  },
  portrait: null,
};
