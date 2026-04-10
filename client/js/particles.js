// particles.js — particle pool, update, draw
// Particles are render-side only and are NOT part of sim state.

let particles = [];

export function spawnBlockSpark(x, y) {
  for (let i = 0; i < 4; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 2,
      life: 6 + Math.random() * 4,
      color: '#8af',
      size: 2,
    });
  }
}

export function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 5);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
  }
  ctx.globalAlpha = 1;
}

export function clearParticles() {
  particles = [];
}
