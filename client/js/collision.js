// collision.js — boxHit, pushApart, hitbox/hurtbox resolution

const WALL_L = 24;
const WALL_R = 640 - 24; // GW - 24

export function boxHit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Push two fighters apart if their hurtboxes overlap.
// Accepts fighters as arguments (no global p1/p2 references).
export function pushApart(f1, f2) {
  const a = f1.hurtbox();
  const b = f2.hurtbox();
  if (boxHit(a, b)) {
    const ov = Math.min(a.x + a.w - b.x, b.x + b.w - a.x);
    if (ov > 0) {
      const push = ov / 2 + 1;
      if (f1.x < f2.x) {
        f1.x -= push;
        f2.x += push;
      } else {
        f1.x += push;
        f2.x -= push;
      }
    }
  }
}

// Check hitbox of attacker against hurtbox of defender.
// Returns an event object if a hit registered, null otherwise.
// Mutates attacker.didHit and calls defender.receiveDamage() which returns events.
export function resolveHits(attacker, defender) {
  const hb = attacker.hitbox();
  if (hb && !attacker.didHit && boxHit(hb, defender.hurtbox())) {
    attacker.didHit = true;
    return defender.receiveDamage(hb.dmg, hb.kb, attacker, hb.isSpecial || false);
  }
  return [];
}

// Clamp a fighter's x position within the wall bounds.
export function clampToWalls(fighter) {
  fighter.x = Math.max(WALL_L, Math.min(WALL_R, fighter.x));
}
