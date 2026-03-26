export default {
  id: 'trump',
  displayName: 'TRUMP',
  startX: 320,
  facing: -1,
  stats: {
    hp: 290,
    walkSpeed: 1.8,
    jumpVy: -10.0,
    jumpVx: 1.8,
  },
  palette: {
    suit:    '#1a2d4a',  // dark navy — jacket and pants
    shirt:   '#f5f5f5',  // white collar/shirt
    tie:     '#cc1a1a',  // bright red tie — must pop against suit
    skin:    '#f0c070',  // orange-tinted skin
    hair:    '#e8a820',  // golden blond, slightly orange
    pants:   '#1a2d4a',  // match jacket — one continuous suit read
    shoes:   '#1a1a1a',  // black oxfords
    // renderer aliases (some draw code accesses body/accent for compat)
    body:    '#1a2d4a',
    accent:  '#cc1a1a',
  },
  // Body proportion hints for the coded placeholder renderer.
  // All values are in game pixels, relative to foot origin (0, 0).
  proportions: {
    torsoW:    26,    // wider than Ryu's 20px
    torsoH:    16,
    torsoTop: -38,
    headW:     16,    // slightly wider than Ryu's 14px
    headH:     12,
    headTop:  -54,
    neckW:     10,
    neckH:      4,
    neckTop:  -42,
    legW:       9,    // slightly wider stance than Ryu
    legH:      17,
    tieW:       4,
    tieTop:   -36,
    tieH:      14,
    // Hair: base block + forward-swept overhang
    hairBaseW:  16,
    hairBaseH:   5,
    hairBaseTop: -54,
    hairSweepW:  10,
    hairSweepH:   4,
    hairSweepTop: -58,
    hairSweepX:    2,  // offset right (toward facing direction) for comb-over
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
  moves: {
    punch: {
      startup: 1, active: 2, recovery: 1,
      damage: 8, knockback: 2.5,
      hitboxOffsetX: 8, hitboxW: 26, hitboxY: -44, hitboxH: 12,
    },
    heavyPunch: {
      startup: 3, active: 2, recovery: 4,
      damage: 20, knockback: 6.0,
      hitboxOffsetX: 8, hitboxW: 34, hitboxY: -42, hitboxH: 14,
    },
    kick: {
      startup: 2, active: 3, recovery: 3,
      damage: 12, knockback: 3.5,
      hitboxOffsetX: 6, hitboxW: 32, hitboxY: -22, hitboxH: 14,
    },
    heavyKick: {
      startup: 7, active: 5, recovery: 10,
      damage: 24, knockback: 7.0,
      hitboxOffsetX: 6, hitboxW: 40, hitboxY: -24, hitboxH: 16,
    },
  },
  specials: [
    {
      id: 'wall_builder',
      input: 'qcf',
      button: 'punch',
      damage: 22,
      startup: 18,
      active: 35,
      recovery: 20,
      type: 'projectile',
      speed: 2,
      hitboxW: 18,
      hitboxH: 22,
    },
    {
      id: 'power_walk',
      input: 'ff',
      button: 'kick',
      damage: 28,
      startup: 10,
      active: 14,
      recovery: 18,
      type: 'armored_dash',
      armorFrames: [4, 14],
      vx: 3,
    },
  ],
  super: {
    id: 'art_of_the_deal',
    input: 'qcf_qcf',
    button: 'punch',
    damage: 40,
    meterCost: 100,
    vignetteText: "YOU'RE FIRED!",
    type: 'command_grab',
    grabRange: 60,
    onHitDrainMeter: 25,
  },
  spriteSheet: null,
  portrait: null,
};
