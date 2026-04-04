export default {
  id: 'tech_bro',
  voiceSet: 'set_2',
  displayName: 'TECH BRO',
  startX: 140,
  facing: 1,
  stats: {
    hp: 220,
    walkSpeed: 2.4,
    jumpVy: -11.5,
    jumpVx: 2.4,
  },
  palette: {
    skin:   '#f0c090',
    hair:   '#8b4513',
    outfit: '#2c3e50',
    accent: '#3498db',
  },
  hurtboxW: 70, hurtboxH: 190,
  crouchHurtboxW: 76, crouchHurtboxH: 105,
  moves: {
    punch: {
      startup: 2, active: 5, recovery: 5,
      damage: 8, knockback: 2.2,
      hitboxOffsetX: 30, hitboxW: 55, hitboxY: -150, hitboxH: 30,
    },
    heavyPunch: {
      startup: 5, active: 5, recovery: 8,
      damage: 18, knockback: 5.0,
      hitboxOffsetX: 28, hitboxW: 70, hitboxY: -155, hitboxH: 35,
    },
    kick: {
      startup: 3, active: 5, recovery: 7,
      damage: 14, knockback: 4.0,
      hitboxOffsetX: 25, hitboxW: 75, hitboxY: -65, hitboxH: 35,
    },
    heavyKick: {
      startup: 6, active: 6, recovery: 8,
      damage: 22, knockback: 6.5,
      hitboxOffsetX: 20, hitboxW: 95, hitboxY: -80, hitboxH: 45,
    },
  },
  holdCrouchFrame: 11,   // frame 7 of 15 = fully crouched pose
  holdBlockFrame:  18,   // frame 18 of 19 = last frame
  // Frame counts: idle:8  walk:10  jump:25  kick:15  punch:20
  animations: {
    idle:       { frames: 8,  fps: 12, loop: true  },
    walk:       { frames: 10, fps: 20, loop: true  },
    crouch:     { frames: 15, fps: 40, loop: true  },
    jump:       { frames: 25, fps: 30, loop: false },
    punch:      { frames: 20, fps: 90, loop: false },
    heavyPunch: { frames: 20, fps: 90, loop: false },
    kick:       { frames: 15, fps: 60, loop: false },
    heavyKick:  { frames: 15, fps: 60, loop: false },
    block:      { frames: 19, fps: 80, loop: false },
    hit:        { frames: 19, fps: 60, loop: false },
    airHit:     { frames: 19, fps: 60, loop: false },
    ko:         { frames: 19, fps: 8,  loop: false },
  },

  animSheetDivisor: 1,
  animSheetOffsetY: 0,
  animSheetCropX:   50,
  animSheetCropW:   280,
  animSheets: {
    idle:   { src: 'assets/characters/tech_bro/techbro_idle',  cols: 8,  frameW: 382, frameH: 216 },
    walk:   { src: 'assets/characters/tech_bro/techbro_walk',  cols: 10, frameW: 382, frameH: 216 },
    crouch: { src: 'assets/characters/tech_bro/TECH_CROUCH1',  cols: 15, frameW: 382, frameH: 216 },
    jump:   { src: 'assets/characters/tech_bro/techbro_jump',  cols: 25, frameW: 382, frameH: 216 },
    punch:  { src: 'assets/characters/tech_bro/techbro_punch', cols: 20, frameW: 382, frameH: 216 },
    kick:   { src: 'assets/characters/tech_bro/techbro_kick',  cols: 15, frameW: 382, frameH: 216 },
    recoil: { src: 'assets/characters/tech_bro/TECH_RECOIL2',  cols: 19, frameW: 382, frameH: 216 },
    block:  { src: 'assets/characters/tech_bro/tech_block.png', cols: 19, frameW: 382, frameH: 216 },
  },
  portrait: null,
};
