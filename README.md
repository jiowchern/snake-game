# 🐍 Snake Game — One Game, Two State-Management Techniques

**English** | [繁體中文](README.zh-TW.md)

> Pure vanilla HTML5 Canvas + JavaScript. Zero dependencies, zero build step.
> Both versions play identically — the only difference is **how the code manages the `ready → running → dead` lifecycle**.

```
classic/        Original: a single IIFE with one `state` string variable + if/else branches
state-machine/  Refactored: an event-driven state machine — operations live on state objects
```

Open either folder and double-click `index.html` to play. Each version documents its own implementation:

- [classic/README.md](classic/README.md) — full walkthrough of the state-variable version
- [state-machine/README.md](state-machine/README.md) — full walkthrough of the state-machine version

---

## Technical Comparison

| Aspect | classic | state-machine |
|--------|---------|---------------|
| State representation | A `state` string (`"ready"` / `"running"` / `"dead"`) | Three classes: `ReadyState` / `RunningState` / `DeadState` |
| State transitions | Direct assignments scattered around: `state = "running"` in the `keydown` handler, `state = "dead"` in `die()` | States only raise events (`startEvent` / `diedEvent` / `restartEvent`); the owner `Game`'s `#toXxx` methods decide where to go |
| Operation legality | Guarded at runtime by branches: Enter is only honored `if (state === "dead")` | Guarded by structure: `restart()` exists only on `DeadState` — in the wrong state, the method is simply unreachable |
| How outsiders learn the state | Read the `state` variable directly | Not queryable; subscribe to a `Notifier` — receive the current state's capability interface on supply, release it on unsupply |
| Per-round data lifecycle | Global variables + a `reset()` that reassigns 9 of them in one go | All fields of `RunningState`; a fresh instance per round, the constructor guarantees clean initial values (`reset()` does not exist) |
| Egg effects | Closures mutate globals (`speed` / `growPending` / `snake`) directly | Receive only a narrow `fx.grow()/shrink()/faster()/slower()` interface — nothing else is reachable |
| File layout | 1 JS file, ~220 lines | 6 JS files, ~500 lines (including ~100 reusable lines of StateMachine + Notifier core) |

## The Essence of the Difference

The game logic (fixed timestep, direction buffer, tail-vacating collision rule, weighted egg drop table) is identical in both versions, character for character. They diverge on a single question: **who knows "what state we are in", and how is that knowledge used?**

**The classic answer: "a variable everyone can see."** The main loop checks it every frame to decide whether to advance the logic, the keyboard listener checks it to decide what a key means, and `die()` / `reset()` assign to it. The upside is that it is direct and the code is at its shortest. The cost is that the *checks* and the *writes* are scattered along a continuously executing path — every new state or new operation means re-auditing every branch point, and missing one produces bugs that only surface at runtime, like "the snake can still turn after dying." Per-round data lives in globals, so restarting depends on `reset()` manually zeroing each field — miss one and you have a stale-value bug.

**The state-machine answer: "nobody knows, and nobody needs to."** The consumer (the keyboard listener) only ever holds "the capability interface supplied by the current state": during Ready the interface offers nothing but `press()`; at the instant of death that interface is revoked and replaced by a new one offering only `restart()`. An illegal operation goes from "caught by an if at runtime" to "the call cannot even be written." The transition graph is the owner's private knowledge: a state detects on its own that it is time to leave and raises an event, and `Game`'s three `#toXxx` methods *are* the entire transition table — changing the flow means touching exactly one place. The cost is more concepts and more files — for a three-state mini game this is admittedly overkill, but as states multiply or nest (say, normal/invincible inside running), this structure's extension cost stays nearly flat while classic-style branching explodes combinatorially.

In one sentence: **classic treats state as data and relies on discipline to keep it consistent; state-machine treats state as objects and relies on structure to make inconsistency inexpressible.**

## Common Tuning Parameters

| Parameter | classic location | state-machine location | Effect |
|-----------|------|------|--------|
| `BASE_INTERVAL` | js/game.js | js/states.js | Base step interval (ms); smaller = faster |
| `GRID` / `CELL` | js/game.js | js/board.js / js/render.js | Grid size / pixels per cell |
| `DIR_QUEUE_MAX` | js/game.js | js/states.js | Direction buffer depth |
| `EGG_TYPES[].weight` | js/game.js | js/board.js | Spawn probability per egg type |
| `:root` CSS variables | css/style.css | css/style.css | Overall color theme |
