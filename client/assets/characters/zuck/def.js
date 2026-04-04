export default {
  id: 'zuck',
  voice: 'male',
  displayName: 'ZUCK',
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
    punch:      { startup: 2, active: 6, recovery: 6, damage: 8,  knockback: 2.5, hitboxOffsetX: 50, hitboxW: 99,  hitboxY: -148, hitboxH: 30 },
    heavyPunch: { startup: 2, active: 5, recovery: 6, damage: 14, knockback: 4.5, hitboxOffsetX: 47, hitboxW: 122, hitboxY: -152, hitboxH: 34 },
    kick:       { startup: 3, active: 8, recovery: 8, damage: 15, knockback: 4.5, hitboxOffsetX: 22, hitboxW: 72, hitboxY: -63,  hitboxH: 34 },
    heavyKick:  { startup: 3, active: 8, recovery: 8, damage: 20, knockback: 6.5, hitboxOffsetX: 18, hitboxW: 92, hitboxY: -78,  hitboxH: 44 },
  },
  holdCrouchFrame: 10,  // TODO: set to the frame index of the fully crouched pose
  animations: {
    idle:        { frames:  25, fps: 24, loop: true, pingPong: true },
    walk:        { frames:  25, fps: 24, loop: true },
    crouch:      { frames:  25, fps: 60, loop: true },
    jump:        { frames:  25, fps: 14, loop: false },
    punch:       { frames:  25, fps: 60, loop: false },
    kick:        { frames:  25, fps: 60, loop: false },
    recoil:      { frames:  25, fps: 40, loop: false },
    block:       { frames:  25, fps: 80, loop: false },
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
    walk:    { src: 'assets/characters/zuck/zuck2_walk.png',   cols: 25, frameW: 382, frameH: 216 },
    punch:   { src: 'assets/characters/zuck/zuck2_punch.png',  cols: 25, frameW: 382, frameH: 216 },
    block:   { src: 'assets/characters/zuck/zuck2_block.png',  cols: 25, frameW: 382, frameH: 216 },
    ko:      { src: 'assets/characters/zuck/zuck2_ko.png',     cols: 25, frameW: 382, frameH: 216, cropX: 0, cropW: 382 },
    recoil:  { src: 'assets/characters/zuck/zuck2_recoil.png', cols: 25, frameW: 382, frameH: 216 },
    crouch:  { src: 'assets/characters/zuck/zuck2_crouch.png', cols: 25, frameW: 382, frameH: 216 },
    jump:    { src: 'assets/characters/zuck/zuck2_jump.png',   cols: 25, frameW: 382, frameH: 216 },
    kick:    { src: 'assets/characters/zuck/zuck2_kick.png',   cols: 25, frameW: 382, frameH: 216 },
    idle:    { src: 'assets/characters/zuck/zuck2_idle.png',   cols: 25, frameW: 382, frameH: 216 },
  },
  portrait: null,
};

// Add to client/js/fighter.js:
// import zuckDef from '../assets/characters/zuck/def.js';
// In CHARACTERS: { ..., zuck: zuckDef }
