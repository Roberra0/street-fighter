// cpu.js — Probability-based reactive CPU AI

// ---- Difficulty ----
let cpuDifficulty = 1;
export function getCpuDifficulty() { return cpuDifficulty; }
export function setCpuDifficulty(n) { cpuDifficulty = Math.max(1, Math.min(3, n)); }

// ---- Internal state ----
let rngState = 12345;
let commitAction = null;   // 'approach' | 'block' | 'retreat' | null
let commitTimer = 0;
let decisionCooldown = 0;

export function resetCpuState() {
  rngState = 12345;
  commitAction = null;
  commitTimer = 0;
  decisionCooldown = 0;
}

// ---- Deterministic xorshift32 RNG (returns 0-99) ----
function roll() {
  rngState ^= rngState << 13;
  rngState ^= rngState >> 17;
  rngState ^= rngState << 5;
  return ((rngState >>> 0) % 100);
}

function randRange(min, max) {
  return min + ((rngState >>> 0) % (max - min + 1));
}

// ---- Difficulty parameters ----
const PARAMS = {
  1: { // Easy — slow, rarely blocks, low aggression
    reactBlock: 15, punishRate: 10, attackRate: 20, heavyRate: 10,
    kickRate: 40, approachRate: 50, retreatRate: 10, idleChance: 40,
    reactionDelay: 8, commitWalkMin: 15, commitWalkMax: 30,
    commitBlockMin: 8, commitBlockMax: 15,
  },
  2: { // Medium — decent reactions, mixes attacks
    reactBlock: 45, punishRate: 35, attackRate: 40, heavyRate: 25,
    kickRate: 50, approachRate: 70, retreatRate: 25, idleChance: 20,
    reactionDelay: 4, commitWalkMin: 10, commitWalkMax: 22,
    commitBlockMin: 10, commitBlockMax: 20,
  },
  3: { // Hard — fast reactions, blocks most attacks, punishes well
    reactBlock: 80, punishRate: 70, attackRate: 55, heavyRate: 40,
    kickRate: 50, approachRate: 90, retreatRate: 35, idleChance: 5,
    reactionDelay: 1, commitWalkMin: 8, commitWalkMax: 16,
    commitBlockMin: 12, commitBlockMax: 25,
  },
};

const ATTACK_STATES = new Set(['punch', 'kick', 'heavyPunch', 'heavyKick', 'special']);

// ---- Helpers ----

function isInRecovery(fighter) {
  const move = fighter.def.moves[fighter._state];
  if (!move || !move.startup) return false;
  return fighter.timer > move.startup + move.active;
}

function getStrikeRange(self, opponent) {
  const punch = self.def.moves.punch;
  const reach = punch.hitboxOffsetX + punch.hitboxW;
  const oppHalfW = (opponent.def.hurtboxW || 28) / 2;
  return reach + oppHalfW;
}

function getHeavyReach(self, opponent) {
  const moves = self.def.moves;
  const hk = moves.heavyKick;
  const hp = moves.heavyPunch;
  const hkReach = hk ? hk.hitboxOffsetX + hk.hitboxW : 0;
  const hpReach = hp ? hp.hitboxOffsetX + hp.hitboxW : 0;
  const oppHalfW = (opponent.def.hurtboxW || 28) / 2;
  return Math.max(hkReach, hpReach) + oppHalfW;
}

function pickAttack(inp, p, faceRight, dist, heavyReach) {
  const isKick = roll() < p.kickRate;
  const wantHeavy = roll() < p.heavyRate && dist <= heavyReach;

  if (wantHeavy) {
    // Forward direction + button = heavy attack
    if (faceRight) inp.right = true; else inp.left = true;
    if (isKick) inp.heavyKick = true; else inp.heavyPunch = true;
  } else {
    if (isKick) inp.kick = true; else inp.punch = true;
  }
  return inp;
}

function executeCommit(inp, action, faceRight) {
  switch (action) {
    case 'approach':
      if (faceRight) inp.right = true; else inp.left = true;
      break;
    case 'retreat':
      if (faceRight) inp.left = true; else inp.right = true;
      break;
    case 'block':
      inp.block = true;
      break;
  }
  return inp;
}

// ---- Main CPU snapshot ----

export function cpuSnapshot(self, opponent) {
  const inp = { left: false, right: false, up: false, down: false,
                punch: false, heavyPunch: false, kick: false, heavyKick: false, block: false };

  const canAct = self.canAct();

  // Can't act — reset commitment so we re-evaluate on recovery
  if (!canAct) {
    commitTimer = 0;
    commitAction = null;
    return inp;
  }

  const p = PARAMS[cpuDifficulty];
  const dist = Math.abs(self.x - opponent.x);
  const faceRight = opponent.x > self.x;
  const opponentAttacking = ATTACK_STATES.has(opponent._state);
  const strikeRange = getStrikeRange(self, opponent);
  const heavyReach = getHeavyReach(self, opponent);

  // ---- Continue committed action ----
  if (commitTimer > 0) {
    commitTimer--;

    // Early break: approach entered strike range
    if (commitAction === 'approach' && dist <= strikeRange) {
      commitTimer = 0;
      commitAction = null;
      // Fall through to decision logic below
    }
    // Early break: blocking but opponent stopped attacking (with small delay)
    else if (commitAction === 'block' && !opponentAttacking && commitTimer < (randRange(p.commitBlockMin, p.commitBlockMax) - 5)) {
      commitTimer = 0;
      commitAction = null;
      decisionCooldown = randRange(2, 6);
      return inp;
    }
    else {
      if (commitTimer <= 0) {
        commitAction = null;
        decisionCooldown = p.reactionDelay;
      }
      return executeCommit(inp, commitAction, faceRight);
    }
  }

  // ---- Decision cooldown ----
  if (decisionCooldown > 0) {
    decisionCooldown--;
    return inp;
  }

  // ---- Priority 1: Reactive block — opponent attacking nearby ----
  if (opponentAttacking && dist < 130) {
    if (roll() < p.reactBlock) {
      commitAction = 'block';
      commitTimer = randRange(p.commitBlockMin, p.commitBlockMax);
      inp.block = true;
      return inp;
    }
  }

  // ---- Priority 2: Punish — opponent in recovery and in range ----
  if (isInRecovery(opponent) && dist <= strikeRange) {
    if (roll() < p.punishRate) {
      decisionCooldown = p.reactionDelay;
      return pickAttack(inp, p, faceRight, dist, heavyReach);
    }
  }

  // ---- Priority 3: In strike range — attack, retreat, or idle ----
  if (dist <= strikeRange) {
    if (roll() < p.attackRate) {
      decisionCooldown = p.reactionDelay;
      return pickAttack(inp, p, faceRight, dist, heavyReach);
    }
    if (roll() < p.retreatRate) {
      commitAction = 'retreat';
      commitTimer = randRange(8, 16);
      return executeCommit(inp, 'retreat', faceRight);
    }
    // Idle briefly
    decisionCooldown = randRange(3, p.reactionDelay + 5);
    return inp;
  }

  // ---- Priority 4: Mid range (strikeRange to 250px) ----
  if (dist <= 250) {
    if (roll() < p.idleChance) {
      decisionCooldown = randRange(p.reactionDelay, p.reactionDelay + 10);
      return inp;
    }
    commitAction = 'approach';
    commitTimer = randRange(p.commitWalkMin, p.commitWalkMax);
    return executeCommit(inp, 'approach', faceRight);
  }

  // ---- Priority 5: Far away — approach ----
  if (roll() < p.approachRate) {
    commitAction = 'approach';
    commitTimer = randRange(p.commitWalkMin, p.commitWalkMax);
    return executeCommit(inp, 'approach', faceRight);
  }

  // Otherwise idle
  decisionCooldown = randRange(p.reactionDelay, p.reactionDelay + 8);
  return inp;
}
