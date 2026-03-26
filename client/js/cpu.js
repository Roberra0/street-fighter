// cpu.js — dumb CPU controller for 1-player mode

// Returns an input snapshot shaped like input.snapshot().
export function cpuSnapshot(_selfX, _opponentX) {
  return { left: false, right: false, up: false, down: false, punch: false, heavyPunch: false, kick: false, heavyKick: false, block: false };
}
