# 🐍 Snake — Classic Version (single-file IIFE + state variable)

**English** | [繁體中文](README.zh-TW.md)

> Pure vanilla HTML5 Canvas + JavaScript. Zero dependencies, zero build step — double-click `index.html` to play.
> All logic lives in one `state` string variable and a single ~220-line `game.js`. For the alternative approach see the [state-machine version](../state-machine/README.md); for a side-by-side comparison see the [root README](../README.md).

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
js/game.js ──── The whole game, a single IIFE, ~220 lines
```

Data flow inside `game.js`:

```
Keyboard input ──► dirQueue (direction buffer, ≤3)
                     │ one valid direction consumed per step
                     ▼
requestAnimationFrame ──► loop (fixed timestep) ──► step (game logic)
                     │                                │
                     ▼                                ▼
                  draw (redraw every frame)    snake / eggs / score (state)
```

## Core Mechanics

### State machine: three game states

```
ready ──direction key──► running ──wall/self collision──► dead ──Enter──► ready
```

The `state` variable takes only three values, and each transition is concentrated in one place:

- **`ready` → `running`**: happens in the `keydown` listener. After load (or reset) the game sits in `ready` — the main loop keeps running but `step()` is never executed. When the player presses the **first direction key**, the listener sets `state` to `"running"` and hides the start overlay; from the next frame the main loop starts accumulating time and advancing logic.

  ```js
  if (state === "ready") {
    state = "running";
    el.start.classList.add("hidden");
  }
  ```

- **`running` → `dead`**: happens inside `step()`. After computing the new head each step, if `hitsWall()` or `hitsSelf()` detects a collision, `die()` is called — it sets `state` to `"dead"`, updates the best score and writes it to `localStorage`, and shows the game-over overlay. The main loop's `while` condition includes `state === "running"`, so stepping stops immediately within the same frame.

- **`dead` → `ready`**: back in the `keydown` listener. In the `dead` state only **Enter** is accepted; every other key is ignored. Pressing it calls `reset()`, which rebuilds all state (snake back to center, direction buffer cleared, eggs respawned, `state = "ready"`), waiting for the next direction key to start a round.

  ```js
  if (state === "dead") {
    if (ev.key === "Enter") reset();
    return;
  }
  ```

Worth noting: the main loop `loop()` never stops — it keeps running and redrawing every frame in all three states; `state` only decides "whether to advance the game logic." The start/game-over screens are not drawn on the canvas either — they are DOM elements layered on top, toggled with a CSS class.

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
  { key: "grow",   color: "#3fb950", weight: 55, apply: () => { growPending++; } },
  { key: "shrink", color: "#f85149", weight: 15, apply: () => { ... } },
  ...
];
```

Each egg type is self-describing: color, weight, effect function. `randomEggType()` picks by weighted roulette; `spawnEggs()` first collects cells occupied by the snake and existing eggs, then spawns only into free cells, guaranteeing no overlap. **Adding a new egg type = adding one row to the table** — zero changes elsewhere.

### Rendering: full redraw every frame

`draw()` in order: clear canvas → translucent grid lines → eggs (circles) → snake (rounded squares, white head, green body). The board is only 28×28 — a full redraw costs nothing and the code stays much simpler.

### Best score: persisted in localStorage

On death, if the record is beaten it is written to `localStorage` (key `snake.best`), surviving across browser sessions.

## Common Tuning Parameters

| Parameter | Location | Effect |
|-----------|----------|--------|
| `BASE_INTERVAL` | game.js | Base step interval (ms); smaller = faster |
| `GRID` / `CELL` | game.js | Grid size / pixels per cell (canvas size = GRID × CELL) |
| `DIR_QUEUE_MAX` | game.js | Direction buffer depth |
| `EGG_TYPES[].weight` | game.js | Spawn probability per egg type |
| `:root` CSS variables | style.css | Overall color theme |
