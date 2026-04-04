// audio.js — Web Audio SFX system

let audioCtx = null;
const buffers = {};

// --- Music ---
let musicEl = null;
let currentTrack = null;

const FIGHT_SONGS = [
  'assets/audio/music/fight_song1.wav',
  'assets/audio/music/fight_song3.wav',
  'assets/audio/music/fight_song4.wav',
];

export function playMusic(src, volume = 0.4) {
  if (currentTrack === src) return; // already playing
  if (musicEl) { musicEl.pause(); musicEl.src = ''; }
  musicEl = new Audio(src);
  musicEl.loop   = true;
  musicEl.volume = volume;
  musicEl.play().catch(() => {});
  currentTrack = src;
  console.log(`[audio] music: ${src}`);
}

export function playFightMusic() {
  const src = FIGHT_SONGS[Math.floor(Math.random() * FIGHT_SONGS.length)];
  playMusic(src, 0.28); // 0.4 × 0.7 ≈ 0.28
}

export function stopMusic() {
  if (musicEl) { musicEl.pause(); musicEl.src = ''; musicEl = null; }
  currentTrack = null;
}

const SOUND_FILES = {
  confirmation:     'assets/audio/sfx/confirmation.wav',
  scroll:           'assets/audio/sfx/scroll.wav',
  punch_swing:      'assets/audio/sfx/punch_swing.wav',
  kick_swing:       'assets/audio/sfx/punch_swing.wav',
  punch_hit:        'assets/audio/sfx/punch_hit.wav',
  kick_hit:         'assets/audio/sfx/kick_hit.wav',
  ko_thud:          'assets/audio/sfx/ko_thud.wav',
  round_announce_1: 'assets/audio/voice/round_announce_1.wav',
  round_announce_2: 'assets/audio/voice/round_announce_2.wav',
  round_announce_3: 'assets/audio/voice/round_announce_3.wav',
  round_fight:      'assets/audio/voice/round_fight.wav',
  ko_announce:      'assets/audio/voice/ko_announce.wav',
  ko_perfect:       'assets/audio/voice/ko_perfect.wav',
  combo_5hit:       'assets/audio/voice/combo_5hit.wav',
  male_ko:          'assets/audio/voice/fighters/male_ko.wav',
  male_jump:        'assets/audio/voice/fighters/male_jump.wav',
  male_crouch:      'assets/audio/voice/fighters/male_crouch.wav',
  female_ko:        'assets/audio/voice/fighters/female_ko.wav',
  female_jump:      'assets/audio/voice/fighters/female_jump.wav',
  female_crouch:    'assets/audio/voice/fighters/female_crouch.wav',
};

async function loadSounds() {
  for (const [key, path] of Object.entries(SOUND_FILES)) {
    try {
      const res = await fetch(path);
      const arr = await res.arrayBuffer();
      buffers[key] = await audioCtx.decodeAudioData(arr);
    } catch (e) {}
  }
}

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    loadSounds();
  }
}

function playBuffer(key, vol = 1, delay = 0) {
  if (!audioCtx || !buffers[key]) return;
  try {
    const src = audioCtx.createBufferSource();
    const g   = audioCtx.createGain();
    src.buffer  = buffers[key];
    g.gain.value = vol;
    src.connect(g);
    g.connect(audioCtx.destination);
    src.start(audioCtx.currentTime + delay);
    console.log(`[audio] ${key}${delay ? ` (+${(delay * 1000).toFixed(0)}ms)` : ''}`);
  } catch (e) {}
}

function beep(freq, dur, type, vol) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

// --- Combat SFX (real audio files) ---

export function sfxConfirmation() { playBuffer('confirmation', 0.9); }
export function sfxScroll()       { playBuffer('scroll', 0.8); }
export function sfxPunchSwing() { playBuffer('punch_swing', 0.8); }
export function sfxKickSwing()  { playBuffer('kick_swing',  0.8); }
export function sfxPunchHit(delay = 0) { playBuffer('punch_hit', 1.0, delay); }
export function sfxKickHit(delay = 0)  { playBuffer('kick_hit',  1.0, delay); }
export function sfxKOThud()     { playBuffer('ko_thud',     1.0); }

// --- Fighter voices ---

export function sfxFighterKO(voice) {
  playBuffer(voice === 'female' ? 'female_ko' : 'male_ko', 0.5);
}

export function sfxJump(voice) {
  playBuffer(voice === 'female' ? 'female_jump' : 'male_jump', 0.45);
}

export function sfxCrouch(voice) {
  playBuffer(voice === 'female' ? 'female_crouch' : 'male_crouch', 0.45);
}

// --- Announcer voice ---

export function sfxRoundAnnounce(roundNum) {
  const n = Math.min(Math.max(roundNum, 1), 3);
  playBuffer(`round_announce_${n}`, 0.5);
}

export function sfxRoundFight()  { playBuffer('round_fight',  0.5); }
export function sfxKOAnnounce()  { playBuffer('ko_announce',  0.5); }
export function sfxPerfect()     { playBuffer('ko_perfect',   0.5); }
export function sfxCombo5()      { playBuffer('combo_5hit', 0.5); }

// --- Synth fallbacks for sounds with no audio file ---

export function sfxHitLight() {
  beep(200, 0.06, 'square',   0.14);
  beep(150, 0.04, 'sawtooth', 0.08);
}

export function sfxHitHeavy() {
  beep(80, 0.12, 'sawtooth', 0.22);
  beep(50, 0.10, 'square',   0.18);
}

export function sfxBlock() {
  beep(400, 0.06, 'triangle', 0.1);
}

// Legacy aliases — kept so existing call sites don't crash
export function sfxHit()   { sfxPunchHit(); }
export function sfxSwing() { sfxPunchSwing(); }
export function sfxKO()    {} // replaced by sfxFighterKO + sfxKOThud + sfxKOAnnounce
export function sfxRound() {} // replaced by sfxRoundAnnounce + sfxRoundFight
