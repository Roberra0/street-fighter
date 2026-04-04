export default {
  id: 'nene',
  voice: 'female',
  displayName: 'NENE',
  startX: 320,
  facing: -1,
  stats: {
    hp: 225,         // glass cannon
    walkSpeed: 2.3,
    jumpVy: -10.93,  // fast arc, low height
    jumpVx: 2.3,
  },
  palette: {
    skin:    '#c8825a',   // warm brown
    hair:    '#1a1a1a',   // black/dark
    dress:   '#ff69b4',   // hot pink — her signature color
    shoes:   '#222',
    jewelry: '#ffd700',   // gold jewelry
    nails:   '#ff1493',   // deep pink nails
  },
  proportions: {
    // For the coded placeholder renderer
    torsoW: 22,    // slim
    torsoH: 28,
    headR:  9,     // slightly larger head (big hair)
    hairH:  12,    // tall hair stack
    legH:   26,
    heelH:  5,     // visible heel spike at bottom
  },
  moves: {
    punch: {
      startup: 1, active: 3, recovery: 1, damage: 6, knockback: 1.5,
      hitboxOffsetX: 8, hitboxW: 24, hitboxY: -44, hitboxH: 10,
    },
    heavyPunch: {
      startup: 5, active: 3, recovery: 8, damage: 15, knockback: 4.5,
      hitboxOffsetX: 8, hitboxW: 30, hitboxY: -44, hitboxH: 12,
    },
    kick: {
      startup: 2, active: 3, recovery: 3, damage: 12, knockback: 4.5,
      hitboxOffsetX: 6, hitboxW: 32, hitboxY: -22, hitboxH: 14,
    },
    heavyKick: {
      startup: 7, active: 5, recovery: 10, damage: 22, knockback: 7.5,
      hitboxOffsetX: 6, hitboxW: 38, hitboxY: -24, hitboxH: 16,
    },
  },
  animations: {
    idle:   { frames: 4, fps: 8,  loop: true  },
    walk:   { frames: 4, fps: 10, loop: true  },
    crouch: { frames: 2, fps: 6,  loop: false },
    jump:   { frames: 3, fps: 10, loop: false },
    punch:  { frames: 4, fps: 15, loop: false },
    kick:   { frames: 5, fps: 12, loop: false },
    block:  { frames: 1, fps: 8,  loop: true  },
    hurt:   { frames: 2, fps: 12, loop: false },
    hit:    { frames: 2, fps: 12, loop: false },
    ko:     { frames: 3, fps: 8,  loop: false },
  },
  spriteSheet: null,
  portrait: null,
};
