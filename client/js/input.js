// input.js — raw key state, per-player input snapshot, input buffer

import { getRemoteInput } from './network.js';

// --- Key state ---
const keysDown = new Set();
// Counter map instead of Set — tracks how many times a key was pressed this frame.
// A Set would collapse two rapid presses between rAF frames into one, dropping inputs.
let pressedThisAccum = new Map();

window.addEventListener('keydown', e => {
  e.preventDefault();
  if (!e.repeat) {
    pressedThisAccum.set(e.code, (pressedThisAccum.get(e.code) || 0) + 1);
  }
  keysDown.add(e.code);
});

window.addEventListener('keyup', e => {
  e.preventDefault();
  keysDown.delete(e.code);
});

// --- Key bindings per player ---
const BINDINGS = [
  // Player 1 — Arrow keys + A/S/X
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    punch: 'KeyA', kick: 'KeyS', block: 'KeyX' },
  // Player 2 — WASD + J/K/L  (no key conflicts with P1)
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    punch: 'KeyJ', kick: 'KeyK', block: 'KeyL' },
];

// --- Input buffer (12-frame ring buffer, per-sim-tick) ---
const BUFFER_SIZE = 12;
export const DIR_UP    = 0b0001;
export const DIR_DOWN  = 0b0010;
export const DIR_LEFT  = 0b0100;
export const DIR_RIGHT = 0b1000;

const dirBuffer  = [new Uint8Array(BUFFER_SIZE), new Uint8Array(BUFFER_SIZE)];
const bufferHead = [0, 0];

// Called once per rAF, BEFORE the tick loop.
// pressedThisAccum is already populated by keydown events directly — nothing to do here.
// Kept as a call-site hook for future use (e.g. rollback input sampling).
export function sampleKeys() {}

// Called per simulation tick. Returns input snapshot for the given player.
// Movement is level-triggered (from keysDown).
// Punch/kick/block button presses are edge-triggered (from pressedThisAccum).
export function snapshot(playerIdx) {
  // Check network first (Part 2 hook — currently always returns null)
  const remote = getRemoteInput(playerIdx);
  if (remote !== null) return remote;

  const b = BINDINGS[playerIdx];

  const left  = keysDown.has(b.left);
  const right = keysDown.has(b.right);
  const up    = keysDown.has(b.up);
  const down  = keysDown.has(b.down);
  // Read counts, then consume (decrement) so a 2-tick rAF frame can't double-fire the same press.
  const pc = pressedThisAccum.get(b.punch) || 0;
  const kc = pressedThisAccum.get(b.kick)  || 0;
  const punch = pc > 0;
  const kick  = kc > 0;
  if (punch) pressedThisAccum.set(b.punch, pc - 1);
  if (kick)  pressedThisAccum.set(b.kick,  kc - 1);
  const block = keysDown.has(b.block);

  // Push to direction buffer
  let dir = 0;
  if (up)    dir |= DIR_UP;
  if (down)  dir |= DIR_DOWN;
  if (left)  dir |= DIR_LEFT;
  if (right) dir |= DIR_RIGHT;

  const head = bufferHead[playerIdx];
  dirBuffer[playerIdx][head] = dir;
  bufferHead[playerIdx] = (head + 1) % BUFFER_SIZE;

  return { left, right, up, down, punch, heavyPunch: false, kick, heavyKick: false, block };
}

// Called once per rAF, AFTER the tick loop (only when at least one tick ran).
// Attack keys are consumed (decremented) by snapshot(), so any remaining count
// here means something went wrong.
export function clearFrame() {
  pressedThisAccum.clear();
}

// Detect double-tap of a direction (dir = DIR_RIGHT or DIR_LEFT)
export function checkDoubleTap(playerIdx, dir) {
  const buf  = dirBuffer[playerIdx];
  const head = bufferHead[playerIdx];
  let count    = 0;
  let lastWas  = false;
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const idx = (head - i + BUFFER_SIZE) % BUFFER_SIZE;
    const has = !!(buf[idx] & dir);
    if (!lastWas && has) count++;
    lastWas = has;
    if (count >= 2) return true;
  }
  return false;
}

// Zero out the direction buffer for a player after a special fires,
// preventing the same motion from triggering the special again next frame.
export function clearMotionOnUse(playerIdx) {
  dirBuffer[playerIdx].fill(0);
}

// Check if Enter or Space is currently pressed (for menu navigation).
// Consuming read — prevents double-confirm on 0-tick frames (same issue as isPauseKey).
export function isMenuConfirm() {
  const e = pressedThisAccum.get('Enter');
  const s = pressedThisAccum.get('Space');
  if (e) pressedThisAccum.delete('Enter');
  if (s) pressedThisAccum.delete('Space');
  return e || s;
}

// Pause toggle (1P mode only) — consuming reads prevent double-toggle on 0-tick frames
export function isPauseKey() {
  const c = pressedThisAccum.get('KeyP');
  if (c) pressedThisAccum.delete('KeyP');
  return c;
}
export function isEscapeKey() {
  const c = pressedThisAccum.get('Escape');
  if (c) pressedThisAccum.delete('Escape');
  return c;
}

// Controls overlay toggle
export function isTabKey() { return pressedThisAccum.get('Tab'); }

// Debug overlay toggle (I key)
export function isDebugKey() { return pressedThisAccum.get('KeyI'); }

// Arrow-key edge triggers for menu navigation.
export function isMenuUp()   { return pressedThisAccum.get('ArrowUp');   }
export function isMenuDown() { return pressedThisAccum.get('ArrowDown'); }

// Left/right edge triggers for character select navigation — always arrow keys.
// Char select is sequential so both players can share the same keys.
export function isMenuLeft()  { return pressedThisAccum.get('ArrowLeft');  }
export function isMenuRight() { return pressedThisAccum.get('ArrowRight'); }

// Returns true if a direction key was just pressed this frame (edge, not hold).
// Used to gate dash detection — dash should only fire on a fresh tap, not while holding.
export function isDirEdge(playerIdx, dirBitmask) {
  const b = BINDINGS[playerIdx];
  if (dirBitmask === DIR_LEFT)  return pressedThisAccum.get(b.left);
  if (dirBitmask === DIR_RIGHT) return pressedThisAccum.get(b.right);
  return false;
}
