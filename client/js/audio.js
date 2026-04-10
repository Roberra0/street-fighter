// audio.js — Web Audio SFX system

let audioCtx = null;
const buffers = {};

// --- Music ---
let musicEl      = null;
let currentTrack = null;
let musicBaseVol = 0.4; // intended volume — tracked so duckMusic can restore correctly

// Fight songs: lazy-loaded (not preloaded with game assets)
const FIGHT_SONGS = [
  'assets/audio/music/fight_song1.mp3',
  'assets/audio/music/fight_song2.mp3',
  'assets/audio/music/fight_song3.mp3',
  'assets/audio/music/fight_song4.mp3',
  'assets/audio/music/fight_song5.mp3',
];

// Menu/intro songs: preloaded with game assets
const INTRO_SONGS = [
  'assets/audio/music/intro.mp3',
  'assets/audio/music/Rage_song.mp4',
  'assets/audio/music/Rage_song2.mp4',
  'assets/audio/music/Rage_song3.mp4',
];

export function playMusic(src, volume = 0.4) {
  if (currentTrack === src) return; // already playing
  if (musicEl) { musicEl.pause(); musicEl.src = ''; }
  musicEl = new Audio(src);
  musicEl.loop   = true;
  musicEl.volume = volume;
  musicBaseVol   = volume;
  musicEl.play().catch(() => {});
  currentTrack = src;
  console.log(`[audio] music: ${src}`);
}

// Duck music by 33% for durationMs then restore — used for voice-over clips
function duckMusic(durationMs) {
  if (!musicEl) return;
  musicEl.volume = musicBaseVol * 0.67;
  setTimeout(() => { if (musicEl) musicEl.volume = musicBaseVol; }, durationMs);
}

// Preload a fight song in the background for smooth transitions
function preloadFightSong(src) {
  // Use Image object to preload (browser caches it for playMusic to use)
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'audio';
  link.href = src;
  document.head.appendChild(link);
}

export function playFightMusic() {
  const src = FIGHT_SONGS[Math.floor(Math.random() * FIGHT_SONGS.length)];
  playMusic(src, 0.28); // 0.4 × 0.7 ≈ 0.28

  // Preload next random song for smooth transitions
  const nextSrc = FIGHT_SONGS[Math.floor(Math.random() * FIGHT_SONGS.length)];
  preloadFightSong(nextSrc);
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
  round_1_fight:    'assets/audio/voice/announcer/Round 1 Fight.mp3',
  round_2_fight:    'assets/audio/voice/announcer/Round 2 Fight.mp3',
  final_round:      'assets/audio/voice/announcer/Final round.mp3',
  outstanding:      'assets/audio/voice/announcer/Outstanding.mp3',
  impressive:       'assets/audio/voice/announcer/Impressive.mp3',
  well_done:        'assets/audio/voice/announcer/Well Done.mp3',
  fatality:         'assets/audio/voice/announcer/Fatality.mp3',
  finish_him:       'assets/audio/voice/announcer/finish him.mp3',
  test_luck:        'assets/audio/voice/announcer/Test Luck.mp3',
  laugh:            'assets/audio/voice/announcer/laugh.mp3',
  female_ko:        'assets/audio/voice/fighters/female_ko.wav',
  female_jump:      'assets/audio/voice/fighters/female_jump.wav',
  female_crouch:    'assets/audio/voice/fighters/female_crouch.wav',
};

// Voice sets for male fighters — loaded dynamically
const VOICE_SETS = ['set_big', 'set_med', 'set_smaller', 'set_1', 'set_2'];
const VOICE_ACTIONS = ['attack', 'crouch', 'dead', 'jump', 'recoil'];

async function loadVoiceSets() {
  for (const set of VOICE_SETS) {
    for (const action of VOICE_ACTIONS) {
      const key  = `${set}_${action}`;
      const path = `assets/audio/voice/sets/${set}/${action}.wav`;
      try {
        const res = await fetch(path);
        const arr = await res.arrayBuffer();
        buffers[key] = await audioCtx.decodeAudioData(arr);
      } catch (e) {}
    }
  }
}

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
    loadVoiceSets();
  }
}

function playBuffer(key, vol = 1, delay = 0) {
  if (!audioCtx) return;
  console.log(`[audio] ${key}${delay ? ` (+${(delay * 1000).toFixed(0)}ms)` : ''}`);
  // Buffer not ready yet (still loading) — fall back to HTMLAudioElement
  if (!buffers[key]) {
    const path = SOUND_FILES[key];
    if (!path || delay > 0) return;
    try { const a = new Audio(path); a.volume = vol; a.play(); } catch (e) {}
    return;
  }
  try {
    const src = audioCtx.createBufferSource();
    const g   = audioCtx.createGain();
    src.buffer  = buffers[key];
    g.gain.value = vol;
    src.connect(g);
    g.connect(audioCtx.destination);
    src.start(audioCtx.currentTime + delay);
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

function playVoice(voiceSet, action, vol) {
  if (voiceSet === 'female') {
    playBuffer(`female_${action === 'dead' ? 'ko' : action}`, vol);
  } else {
    const key  = `${voiceSet}_${action}`;
    const path = `assets/audio/voice/sets/${voiceSet}/${action}.wav`;
    if (!audioCtx) return;
    console.log(`[audio] ${key}`);
    if (!buffers[key]) {
      try { const a = new Audio(path); a.volume = vol; a.play(); } catch (e) {}
      return;
    }
    try {
      const src = audioCtx.createBufferSource();
      const g   = audioCtx.createGain();
      src.buffer  = buffers[key];
      g.gain.value = vol;
      src.connect(g);
      g.connect(audioCtx.destination);
      src.start();
    } catch (e) {}
  }
}

export function sfxFighterKO(voiceSet) {
  if (voiceSet === 'female') { playBuffer('female_ko', 0.5); return; }
  playVoice(voiceSet, 'dead', 0.5);
}

export function sfxJump(voiceSet) {
  playVoice(voiceSet, 'jump', 0.45);
}

export function sfxCrouch(voiceSet) {
  playVoice(voiceSet, 'crouch', 0.45);
}

export function sfxAttack(voiceSet) {
  if (!voiceSet || voiceSet === 'female') return;
  playVoice(voiceSet, 'attack', 0.45);
}

export function sfxRecoil(voiceSet) {
  if (!voiceSet || voiceSet === 'female') return;
  playVoice(voiceSet, 'recoil', 0.45);
}

// --- Announcer voice ---

export function sfxRoundAnnounce(roundNum) {
  const key = roundNum <= 1 ? 'round_1_fight' : roundNum <= 2 ? 'round_2_fight' : 'final_round';
  duckMusic(clipMs(key));
  playBuffer(key, 0.78);
}

// Randomly pick a KO praise clip or Fatality
const KO_CLIPS = ['outstanding', 'impressive', 'well_done', 'fatality'];
export function sfxKOAnnounce() {
  const key = KO_CLIPS[Math.floor(Math.random() * KO_CLIPS.length)];
  duckMusic(clipMs(key));
  playBuffer(key, 0.78);
}

// Random praise on a 4-hit combo
const PRAISE_CLIPS = ['outstanding', 'impressive', 'well_done'];
export function sfxCombo4() {
  const key = PRAISE_CLIPS[Math.floor(Math.random() * PRAISE_CLIPS.length)];
  duckMusic(clipMs(key));
  playBuffer(key, 0.78);
}

// Returns buffer duration in ms + padding, or a safe fallback if not yet decoded
function clipMs(key) {
  const buf = buffers[key];
  return buf ? Math.ceil(buf.duration * 1000) + 300 : 2000;
}

export function sfxFinishHim() { duckMusic(clipMs('finish_him')); playBuffer('finish_him', 0.78); }
export function sfxTestLuck()  { duckMusic(clipMs('test_luck'));  playBuffer('test_luck',  0.78); }

// Plays laugh via HTMLAudio so we know when it ends, then fires callback after extraMs
export function sfxLaughWithDelay(callback, extraMs = 0) {
  const a = new Audio(SOUND_FILES['laugh']);
  a.volume = 0.65;
  a.onended = () => setTimeout(callback, extraMs);
  a.onerror  = () => setTimeout(callback, extraMs);
  a.play().catch(() => setTimeout(callback, extraMs));
}

// Randomly plays Well Done or Outstanding on P1 character confirm
const CHAR_SELECT_CLIPS = ['well_done', 'outstanding'];
export function sfxCharSelect() {
  const key = CHAR_SELECT_CLIPS[Math.floor(Math.random() * CHAR_SELECT_CLIPS.length)];
  duckMusic(clipMs(key));
  playBuffer(key, 0.65);
}

// Legacy no-ops — call sites removed in game.js
export function sfxRoundFight() {}
export function sfxPerfect()    {}
export function sfxCombo5()     {}

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
