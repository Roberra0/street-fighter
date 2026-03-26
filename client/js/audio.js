// audio.js — Web Audio SFX system

let audioCtx = null;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
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

export function sfxHit() {
  beep(120, 0.15, 'sawtooth', 0.2);
  beep(80, 0.1, 'square', 0.12);
}

export function sfxHitLight() {
  // Short, higher-frequency click — papery impact
  beep(200, 0.06, 'square', 0.14);
  beep(150, 0.04, 'sawtooth', 0.08);
}

export function sfxHitHeavy() {
  // Bass-heavy thud with sharp transient
  beep(80, 0.12, 'sawtooth', 0.22);
  beep(50, 0.10, 'square', 0.18);
  // Sub-bass layer via Web Audio time scheduling
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 50;
    g.gain.value = 0.15;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

export function sfxBlock() {
  beep(400, 0.06, 'triangle', 0.1);
}

export function sfxSwing() {
  beep(500, 0.06, 'sawtooth', 0.04);
}

export function sfxKO() {
  beep(60, 0.6, 'sawtooth', 0.25);
  // Use Web Audio time scheduling instead of setTimeout
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 40;
    g.gain.value = 0.2;
    const startAt = audioCtx.currentTime + 0.2;
    g.gain.setValueAtTime(0.2, startAt);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.8);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(startAt);
    o.stop(startAt + 0.8);
  } catch (e) {}
}

export function sfxRound() {
  beep(440, 0.12, 'square', 0.12);
  // Schedule the second beep via Web Audio timing
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 660;
    g.gain.value = 0.12;
    const startAt = audioCtx.currentTime + 0.18;
    g.gain.setValueAtTime(0.12, startAt);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.25);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(startAt);
    o.stop(startAt + 0.25);
  } catch (e) {}
}
