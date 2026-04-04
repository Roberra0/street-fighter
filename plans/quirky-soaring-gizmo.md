# Architectural Analysis: Is This Game ECS? Should It Be?

## Context
User asked whether the Street Fighter game uses Entity Component System (ECS) principles, and if not, how it should be structured. This is an advisory/architectural question, not an implementation task.

---

## Current Architecture: Entity-Based Monolith (NOT ECS)

The game uses a **data-driven, module-separated monolith** — not ECS.

### What's actually here

| Module | Pattern |
|--------|---------|
| `fighter.js` | Monolithic `Fighter` class — position + physics + state machine + animation + combat all co-located |
| `game.js` | Mediator — runs the fixed-timestep loop, collects events, dispatches to subsystems |
| `collision.js` | Pure functions — stateless AABB math |
| `renderer.js` | Pure rendering — reads fighter state, draws, no mutations |
| `input.js` | Ring-buffer input with motion detection |
| `particles.js` / `audio.js` | Side-effect subsystems triggered by events |

### The key pattern: Event-based mediation
`Fighter.update()` and `Fighter.receiveDamage()` **return event arrays** — they never call audio or particles directly. `game.js` collects all events and dispatches them. This is the cleanest architectural decision in the codebase.

### What makes it NOT ECS
- Data and behavior are **co-located** in the Fighter class (position, physics, state, animation, inputs all together)
- No component registry, archetype tables, or generic component queries
- Logic is method-based, not data-transformation pipelines
- Only 2 entities ever exist (p1, p2) + a projectile array

---

## What True ECS Would Look Like Here

An ECS version would split Fighter into separate components:

```
PositionComponent   { x, y, vx, vy, facing, grounded }
HealthComponent     { hp, meter, stunTimer }
StateComponent      { state, animFrame, animCounter }
CombatComponent     { blocking, comboCount, comboTimer, didHit, currentSpecial }
InputComponent      { inputBuffer, inputBufferTimer }
CharDefComponent    { def }  // reference to the data blob
```

Then "systems" would iterate over entities with those components:
- `PhysicsSystem.update(entities with Position)`
- `CombatSystem.update(entities with Combat + State)`
- `AnimationSystem.update(entities with State + CharDef)`
- `RenderSystem.draw(entities with Position + State + CharDef)`

---

## Should You Refactor to ECS? No.

**Tech-architect verdict: ECS is the wrong tool here.** Reasons:

1. **You have exactly 2 fighters.** ECS pays off when you're querying hundreds of entities. With 2, the indirection is pure overhead — cognitive and runtime.

2. **The Fighter class is ~720 lines.** Large, but it's a state machine. The complexity is intrinsic to fighting game logic (startup/active/recovery frames, motion inputs, hitboxes per state). Splitting into components doesn't reduce this complexity — it distributes it across more files and makes it harder to trace a single frame of gameplay.

3. **The event-return pattern already solves the main ECS problem.** ECS exists partly to decouple systems from each other. This codebase achieves that through events: Fighter doesn't know about audio or particles. That's the right call, and it's already done.

4. **Rollback netcode (Part 2) requires snapshotting sim state.** In ECS, you'd snapshot component arrays. In the current design, you snapshot Fighter instances and a few module-level vars. Both work; the current approach is simpler and already designed for it.

5. **Character data IS already separated from behavior.** `CHARACTERS` registry holds plain JSON definitions (`def`). `Fighter` class holds behavior. This is the useful part of the ECS data-behavior split — and it's already here.

### What to keep, what to consider improving

**Keep as-is:**
- Event-return pattern in Fighter
- Module-separated rendering (renderer.js reads, never writes)
- `collision.js` as pure functions
- Character definitions as plain JSON

**Worth watching (but not refactoring now):**
- `fighter.js:update()` is 340+ lines. If it grows past ~500, consider splitting into `handleNormalAttacks()`, `handleSpecialMoves()`, `handleMovement()` as private methods — same class, just organized.
- `renderer.js` at 1337 lines is large but justified — each character's primitive renderer is isolated. When sprites land, most of those per-character drawing functions disappear.

### The right mental model for this codebase

Think of it as **"Data-driven state machines with event-based integration":**
- Characters are **state machines** (not component bags)
- Character *differences* are **data** (the `def` object)
- Systems **don't call each other** — they communicate through events via `game.js`
- Simulation is **deterministic and separable** from rendering

This maps well to how fighting game engines actually work (SF, Guilty Gear, etc. use state machines internally).

---

## Verification

This is an advisory analysis — no code changes. Validate by reading:
- `client/js/fighter.js` lines 1–80 (class structure)
- `client/js/game.js` `processEvents()` function (event dispatch pattern)
- `client/js/collision.js` (pure function pattern)
