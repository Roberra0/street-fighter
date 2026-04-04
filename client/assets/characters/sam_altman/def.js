export default {
  id: 'altman',
  voice: 'male',
  displayName: 'ALTMAN',
  startX: 140,
  facing: 1,
  gravityScale: 0.6,
  stats: {
    hp: 240,           // TODO: tune
    walkSpeed: 2.4,    // TODO: tune
    jumpVy: -10.5,
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
    punch:      { startup: 2, active: 6, recovery: 6, damage: 8,  knockback: 2.5, hitboxOffsetX: 0, hitboxW: 640, hitboxY: -190, hitboxH: 500 },
    heavyPunch: { startup: 2, active: 5, recovery: 6, damage: 14, knockback: 4.5, hitboxOffsetX: 0, hitboxW: 640, hitboxY: -190, hitboxH: 500 },
    kick:       { startup: 3, active: 8, recovery: 8, damage: 15, knockback: 4.5, hitboxOffsetX: 0, hitboxW: 640, hitboxY: -190, hitboxH: 500 },
    heavyKick:  { startup: 3, active: 8, recovery: 8, damage: 20, knockback: 6.5, hitboxOffsetX: 0, hitboxW: 640, hitboxY: -190, hitboxH: 500 },
  },
  holdCrouchFrame: 10,  // TODO: set to the frame index of the fully crouched pose
  animations: {
    idle:        { frames: 66, fps: 24, loop: true, loopFrom: 10, frameSequence: [0,5,10,15,20,25,30,35,40,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120] },
    walk:        { frames: 66, fps: 24, loop: true, loopFrom: 0, frameSequence: [55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120] },
    crouch:      { frames: 20, fps: 60, loop: true },
    jump:        { frames: 66, fps: 16, loop: true, loopFrom: 0, frameSequence: [55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120] },
    punch:       { frames: 25, fps: 60, loop: false },
    kick:        { frames: 25, fps: 60, loop: false },
    recoil:      { frames: 49, fps: 40, loop: false },
    block:       { frames: 20, fps: 80, loop: true, loopFrom: 15, frameSequence: [0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190] },
    ko:          { frames: 25, fps: 24, loop: false, frameSequence: [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48] },
    heavyPunch:  { frames: 25, fps: 60, loop: false },
    heavyKick:   { frames: 25, fps: 60, loop: false },
    hit:         { frames: 49, fps: 40, loop: false },
    airHit:      { frames: 49, fps: 40, loop: false },
  },

  animSheetDivisor: 1,
  animSheetScale:   0.85,
  animSheetScaleY:  0.95,
  animSheetOffsetY: 0,
  animSheetCropX:   50,
  animSheetCropW:   280,
  animSheets: {
    punch:   { src: 'assets/characters/sam_altman/altman_punch.png',  cols: 25, frameW: 382, frameH: 216 },
    idle:    { src: 'assets/characters/sam_altman/altman_idle2.png',  cols: 192, frameW: 382, frameH: 216 },
    walk:    { src: 'assets/characters/sam_altman/altman_walk2.png',   cols: 192, frameW: 382, frameH: 216 },
    kick:    { src: 'assets/characters/sam_altman/altman_kick.png',   cols: 25, frameW: 382, frameH: 216 },
    jump:    { src: 'assets/characters/sam_altman/altman_walk2.png',  cols: 192, frameW: 382, frameH: 216 },
    crouch:  { src: 'assets/characters/sam_altman/altman_crouch.png', cols: 20, frameW: 382, frameH: 216 },
    ko:      { src: 'assets/characters/sam_altman/altman_ko.png',     cols: 49, frameW: 382, frameH: 216, cropX: 0, cropW: 382 },
    block:   { src: 'assets/characters/sam_altman/altman_block2.png', cols: 192, frameW: 382, frameH: 216 },
    recoil:  { src: 'assets/characters/sam_altman/altman_recoil.png', cols: 49, frameW: 382, frameH: 216 },
  },
  portrait: null,
  overlay: {
    src: 'assets/characters/sam_altman/telekenf.png',
    states: ['punch', 'heavyPunch', 'kick', 'heavyKick'],
    cols: 20, frameW: 215, frameH: 120,
    fps: 24,
    w: 108, h: 60,
    offsetY: -170,
    stateOffsets: { kick: -90, heavyKick: -90 },
  },
};
