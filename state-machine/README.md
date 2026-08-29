# 🐍 Snake — State Machine Version (event-driven states)

**English** | [繁體中文](README.zh-TW.md)

> Pure vanilla HTML5 Canvas + JavaScript. Zero dependencies, zero build step — double-click `index.html` to play.
> There is no `state` variable: three state classes + event-driven transitions. For the original approach see the [classic version](../classic/README.md); for a side-by-side comparison see the [root README](../README.md).

| | |
|---|---|
| **Controls** | Arrow keys / WASD to move, Enter to restart |
| **Board** | 28 × 28 cells |
| **Goal** | Eat eggs to score; don't hit the wall or bite yourself |
| **Tech** | Canvas 2D, requestAnimationFrame, localStorage |

Four egg types (1–3 on the board at any time, each worth +1 point):
🟢 Grow (55%)　🔴 Shrink (15%)　🟡 Speed up ×1.25 (15%)　🔵 Slow down ×0.8 (15%)

---

## Architecture Overview

```
index.html ──── Layout: HUD scoreboard, <canvas>, start/game-over overlays, legend
css/style.css ─ Dark theme (GitHub Dark style), colors centralized in CSS variables
js/core.js ──── StateMachine (minimal) + Notifier (supply/unsupply)
js/board.js ─── Board data: snake, eggs (drop table), collision checks
js/render.js ── Renderer: full redraw every frame
js/states.js ── The three game states: ReadyState / RunningState / DeadState
js/game.js ──── The owner, Game: holds raw materials, wires transitions in #toXxx methods
js/main.js ──── Entry point: assembles DOM dependencies, keyboard input consumer, main loop
```

Loaded as ordinary `<script>` tags in order (not ES modules), preserving zero-build, double-click-to-play.

## Core Mechanics

### State machine: operations live on states, transitions ride on events

```
ReadyState ──startEvent──► RunningState ──diedEvent──► DeadState ──restartEvent──► ReadyState
```

There is no `state` variable, and no `GetState()` to query. Each of the three game states is a class implementing the `enable()` / `disable()` / `update(dt)` lifecycle; `core.js`'s `StateMachine` performs the handover on `change()` (old disable → new enable).

- **Operation methods exist only on the matching state**: `press()` only on `ReadyState`, `queueDirection()` only on `RunningState`, `restart()` only on `DeadState`. "Calling the wrong method in the wrong state" is structurally impossible.
- **A state doesn't know what comes next** — it only raises events (`startEvent` / `diedEvent` / `restartEvent`). The transition table *is* `Game`'s three `#toXxx` methods: they `new` up the next state, inject the narrow dependencies it needs, and wire its events. For example, writing the best score to `localStorage` is what `#toDead()` does while digesting `diedEvent` — it belongs to no state.
- **Outsiders obtain capability interfaces through supply events, never by querying**: the keyboard listener in `main.js` subscribes to three `Notifier`s (`game.readyStates` / `runningStates` / `deadStates`), receiving the current state's capability interface on supply and releasing it on unsupply — "which interface you hold" *is* "what you can do right now."
- **Every transition creates a fresh instance**: all per-round data (direction buffer, growth credit, score, speed) are fields of `RunningState`, and the constructor guarantees clean initial values. The old `reset()` that reassigned nine variables in one go is gone — the "stale field value" bug class cannot exist.
- **Events fire only from `update()`**: death detection completes the current frame's catch-up steps inside `RunningState.update()` before raising `diedEvent`, so transitions always happen on the main loop's synchronous timeline.

The main loop `loop()` never stops — it merely forwards `dt` to the current state every frame: `ReadyState` / `DeadState` `update()` just redraw the board, and only `RunningState.update()` advances logic. The start/game-over screens are not drawn on the canvas — they are DOM elements layered on top, toggled by each state's `enable()` / `disable()`.

### Snake data structure: coordinate array + head/tail operations

The snake is `[{x, y}, ...]` with `snake[0]` as the head. Each step:

```js
snake.unshift(head);           // insert new head at the front
if (growPending > 0) growPending--;
else snake.pop();              // no growth credit → remove the tail
```

"Moving" touches only the two ends of the array; "growing" is simply not cutting the tail for a while. An elegant `O(1)` solution — no need to shift the whole snake.

### Main loop: fixed timestep

```js
acc += dt;                               // accumulate real elapsed time
while (acc >= BASE_INTERVAL / speed) {   // every full interval
  acc -= interval;
  step();                                // advance logic one step
}
draw();                                  // but redraw every frame
```

**Logic rate decoupled from frame rate**: the snake moves at the same speed on 60Hz and 144Hz displays; the speed eggs only need to change the `speed` multiplier. `MAX_STEPS_PER_FRAME = 30` prevents a burst of catch-up steps after the tab returns from being idle.

### Direction buffer: fast key mashing won't kill you

Key presses don't change direction directly — they enter the `dirQueue` (capacity 3), one consumed per step, with two kinds of invalid input filtered out:

- **180° reversal** (when length ≥ 2) — prevents two quick presses within one step from causing an "in-place reversal" self-collision
- **Same as current direction** — don't waste a buffer slot

### Collision: the tail-vacating rule

```js
const checkLen = growPending === 0 ? snake.length - 1 : snake.length;
```

If the tail will move away this step, the head entering the "old tail cell" doesn't count as a collision — chasing your own tail closely is a legal move, per the classic rules.

### Egg system: a data-driven drop table

```js
const EGG_TYPES = [
  { key: "grow",   color: "#3fb950", weight: 55, apply: (fx) => fx.grow() },
  { key: "shrink", color: "#f85149", weight: 15, apply: (fx) => fx.shrink() },
  ...
];
```

Each egg type is self-describing: color, weight, effect function. Effects act only through the `fx` capability interface (`grow` / `shrink` / `faster` / `slower`, provided by `RunningState`) — an egg cannot reach any other game data; what it can reach is exactly what it may use. `randomEggType()` picks by weighted roulette; `spawnEggs()` first collects cells occupied by the snake and existing eggs, then spawns only into free cells, guaranteeing no overlap. **Adding a new egg type = adding one row to the table** — zero changes elsewhere.

### Rendering: full redraw every frame

`draw()` in order: clear canvas → translucent grid lines → eggs (circles) → snake (rounded squares, white head, green body). The board is only 28×28 — a full redraw costs nothing and the code stays much simpler.

### Best score: persisted in localStorage

On death, if the record is beaten it is written to `localStorage` (key `snake.best`), surviving across browser sessions.

## Common Tuning Parameters

| Parameter | Location | Effect |
|-----------|----------|--------|
| `BASE_INTERVAL` | states.js | Base step interval (ms); smaller = faster |
| `GRID` | board.js | Grid size |
| `CELL` | render.js | Pixels per cell (canvas size = GRID × CELL) |
| `DIR_QUEUE_MAX` | states.js | Direction buffer depth |
| `EGG_TYPES[].weight` | board.js | Spawn probability per egg type |
| `:root` CSS variables | style.css | Overall color theme |
