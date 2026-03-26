export default {
  id: 'obama',
  displayName: 'OBAMA',
  startX: 320,
  facing: -1,
  stats: {
    hp: 240,
    walkSpeed: 2.4,
    jumpVy: -11.0,
    jumpVx: 2.4,
  },
  palette: {
    suit:    '#1c1c2e',  // near-black dark navy jacket
    shirt:   '#f0f0f0',  // white shirt showing at chest
    tie:     '#3366cc',  // blue tie — immediately distinct from Trump's red
    skin:    '#7a5230',  // warm medium brown
    hair:    '#111111',  // very dark, close-cropped
    pants:   '#1c1c2e',
    shoes:   '#222222',
    // renderer aliases
    body:    '#1c1c2e',
    accent:  '#3366cc',
  },
  // Body proportion hints for the coded placeholder renderer.
  // Obama stands 57px tall — 3px taller than Ryu (same ground Y, extends upward).
  proportions: {
    totalH:    57,
    torsoW:    16,    // narrowest torso — slim silhouette
    torsoH:    20,
    torsoTop: -46,
    headW:     14,
    headH:     11,
    headTop:  -57,
    // Ears: protruding 4px on each side — the W-notch silhouette marker
    earW:       4,
    earH:       5,
    earTopY:   -54,   // center ear vertically
    earLX:    -11,    // left ear starts here (extends 4px left of head center -7)
    earRX:      7,    // right ear starts here (extends 4px right of head center +7)
    legW:       7,
    legH:      20,    // long legs — key proportion read
    armW:       6,
    armH:      16,    // long arms
    hairH:      3,    // close-cropped — thin cap at top of head
  },
  animations: {
    idle:   { frames: 4, fps: 8,  loop: true  },
    walk:   { frames: 4, fps: 10, loop: true  },
    crouch: { frames: 2, fps: 6,  loop: false },
    jump:   { frames: 3, fps: 10, loop: false },
    punch:      { frames: 4, fps: 15, loop: false },
    heavyPunch: { frames: 5, fps: 12, loop: false },
    kick:       { frames: 4, fps: 15, loop: false },
    heavyKick:  { frames: 5, fps: 10, loop: false },
    block:      { frames: 2, fps: 8,  loop: true  },
    hurt:       { frames: 2, fps: 12, loop: false },
    hit:        { frames: 2, fps: 12, loop: false },
    ko:         { frames: 8, fps: 8,  loop: false },
  },
  moves: {
    punch: {
      startup: 1, active: 2, recovery: 1,
      damage: 8, knockback: 2.5,
      hitboxOffsetX: 14, hitboxW: 18, hitboxY: -66, hitboxH: 12,
    },
    heavyPunch: {
      startup: 3, active: 2, recovery: 4,
      damage: 17, knockback: 5.0,
      hitboxOffsetX: 12, hitboxW: 24, hitboxY: -68, hitboxH: 14,
    },
    kick: {
      startup: 2, active: 3, recovery: 3,
      damage: 12, knockback: 3.5,
      hitboxOffsetX: 10, hitboxW: 28, hitboxY: -26, hitboxH: 14,
    },
    heavyKick: {
      startup: 7, active: 5, recovery: 10,
      damage: 21, knockback: 6.5,
      hitboxOffsetX: 8, hitboxW: 36, hitboxY: -30, hitboxH: 16,
    },
  },
  specials: [
    {
      id: 'filibuster',
      input: 'qcf',
      button: 'kick',
      damage: 25,
      startup: 6,
      active: 8,
      recovery: 14,
      type: 'poke',
      hitboxW: 50,
      hitboxH: 10,
      hitboxY: -40,
    },
    {
      id: 'hope_dash',
      input: 'ff',
      button: 'punch',
      damage: 22,
      startup: 6,
      active: 10,
      recovery: 12,
      type: 'dash_strike',
      vx: 4,
    },
  ],
  super: {
    id: 'executive_action',
    input: 'qcf_qcf',
    button: 'punch',
    damage: 28,
    meterCost: 100,
    hits: 7,
    vignetteText: 'YES WE CAN.',
    type: 'rush_super',
    vx: 5,
  },
  spriteSheet: 'assets/characters/obama/obama_sheet.png',
  portrait: null,
};
