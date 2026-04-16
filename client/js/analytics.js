// analytics.js — PostHog analytics wrapper for Rage Against GPTs
// Game code calls these functions; never posthog.* directly.

const ph = () => window.posthog;

// ---- Screen time tracking ----
let _prevState = null;
let _stateEnteredAt = null;

// ---- Session tracking ----
let _sessionMatchCount = 0;

// ---- Per-round fight stat accumulators ----
let _roundStats = null;

// ---- Page load ----
export function trackPageLoad(totalMs, fileEntries) {
  if (!ph()) return;
  const sorted = [...fileEntries]
    .filter(f => f.loadTime != null)
    .sort((a, b) => b.loadTime - a.loadTime);
  const top5 = sorted.slice(0, 5).map(f => ({
    name: f.name,
    load_ms: Math.round(f.loadTime),
    size_mb: +(f.size / 1048576).toFixed(1),
  }));
  ph().capture('page_loaded', {
    total_load_ms: Math.round(totalMs),
    file_count: fileEntries.length,
    slowest_file: sorted[0]?.name ?? null,
    slowest_file_ms: sorted[0] ? Math.round(sorted[0].loadTime) : null,
    files: top5,
  });
}

// ---- State / screen transition ----
export function checkStateTransition(gameState) {
  if (gameState === _prevState) return;
  const now = performance.now();
  if (_prevState != null && _stateEnteredAt != null && ph()) {
    ph().capture('screen_view', {
      screen: _prevState,
      duration_ms: Math.round(now - _stateEnteredAt),
      session_match_count: _sessionMatchCount,
    });
  }
  _prevState = gameState;
  _stateEnteredAt = now;
}

// ---- Character select ----
export function trackCharacterSelect(p1Id, p2Id, gameMode, p1WasRandom, p2WasRandom) {
  if (!ph()) return;
  ph().capture('character_select', {
    p1_character: p1Id,
    p2_character: p2Id,
    game_mode: gameMode,
    p1_was_random: !!p1WasRandom,
    p2_was_random: !!p2WasRandom,
  });
}

// ---- Map select ----
export function trackMapSelect(mapId, mapName) {
  if (!ph()) return;
  ph().capture('map_select', {
    map_id: mapId,
    map_name: mapName,
  });
}

// ---- Round lifecycle ----
export function onRoundStart(roundNum, p1Def, p2Def) {
  _roundStats = {
    roundNum,
    p1CharId: p1Def.id,
    p2CharId: p2Def.id,
    p1HitsLanded: 0,
    p2HitsLanded: 0,
    p1Blocks: 0,
    p2Blocks: 0,
    startTime: performance.now(),
  };
}

export function onFightEvent(ev) {
  if (!_roundStats) return;
  if (ev.type === 'hit' || ev.type === 'ko') {
    if (ev.scorerId === 0) _roundStats.p1HitsLanded++;
    else _roundStats.p2HitsLanded++;
  }
  if (ev.type === 'block') {
    if (ev.blockerId === 0) _roundStats.p1Blocks++;
    else _roundStats.p2Blocks++;
  }
}

export function onRoundEnd(roundNum, p1Hp, p2Hp, p1MaxHp, p2MaxHp, p1Wins, p2Wins, msgText, roundTimer, p1Score, gameMode, mapId) {
  if (!ph()) return;
  // Determine winner and end condition from msgText
  let winner, endCondition;
  const msg = (msgText || '').toUpperCase();
  if (msg.includes('DRAW')) {
    winner = 'draw';
    endCondition = 'draw';
  } else if (msg.includes('TIME')) {
    endCondition = 'time';
    winner = p1Hp > p2Hp ? 'p1' : 'p2';
  } else if (msg.includes('PERFECT')) {
    endCondition = 'perfect';
    winner = p2Hp <= 0 ? 'p1' : 'p2';
  } else {
    endCondition = 'ko';
    winner = p2Hp <= 0 ? 'p1' : 'p2';
  }

  ph().capture('round_complete', {
    round_num: roundNum,
    winner,
    end_condition: endCondition,
    round_duration_sec: 99 - roundTimer,
    p1_character: _roundStats?.p1CharId ?? null,
    p2_character: _roundStats?.p2CharId ?? null,
    p1_hp_pct: +(p1Hp / p1MaxHp).toFixed(2),
    p2_hp_pct: +(p2Hp / p2MaxHp).toFixed(2),
    p1_hits_landed: _roundStats?.p1HitsLanded ?? 0,
    p2_hits_landed: _roundStats?.p2HitsLanded ?? 0,
    p1_blocks: _roundStats?.p1Blocks ?? 0,
    p2_blocks: _roundStats?.p2Blocks ?? 0,
    game_mode: gameMode,
    map_id: mapId,
    p1_score: p1Score,
  });
  _roundStats = null;
}

// ---- Match lifecycle ----
export function onMatchEnd(p1Wins, p2Wins, p1CharId, p2CharId, mapId, gameMode, roundNum, p1Score) {
  if (!ph()) return;
  _sessionMatchCount++;
  ph().capture('match_complete', {
    winner: p1Wins >= 2 ? 'p1' : 'p2',
    p1_character: p1CharId,
    p2_character: p2CharId,
    map_id: mapId,
    game_mode: gameMode,
    rounds_played: roundNum,
    p1_rounds_won: p1Wins,
    p2_rounds_won: p2Wins,
    session_match_count: _sessionMatchCount,
    p1_score: p1Score,
  });
}
