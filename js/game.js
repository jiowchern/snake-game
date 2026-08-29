(() => {
  // ---- 常數設定 ----
  const GRID = 28;
  const CELL = 24;
  const BASE_INTERVAL = 140; // ms per step at 1.00x
  const MAX_STEPS_PER_FRAME = 30;
  const DIR_QUEUE_MAX = 3;
  const BEST_KEY = "snake.best";

  const EGG_TYPES = [
    { key: "grow",   color: "#3fb950", weight: 55, apply: () => { growPending++; } },
    { key: "shrink", color: "#f85149", weight: 15, apply: () => { if (snake.length > 1) snake.pop(); growPending = 0; } },
    { key: "fast",   color: "#f2cc60", weight: 15, apply: () => { speed *= 1.25; } },
    { key: "slow",   color: "#58a6ff", weight: 15, apply: () => { speed *= 0.8; } },
  ];

  const KEY_DIRS = {
    ArrowUp: { x: 0, y: -1 },   KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },  KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
  };

  // ---- DOM ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const el = {
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    len: document.getElementById("len"),
    spd: document.getElementById("spd"),
    start: document.getElementById("startOverlay"),
    dead: document.getElementById("deadOverlay"),
    deadStats: document.getElementById("deadStats"),
  };

  // ---- 遊戲狀態 ----
  let snake, dir, dirQueue, growPending, eggs, score, speed, state, acc, lastTime;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);

  function reset() {
    const c = Math.floor(GRID / 2);
    snake = [{ x: c, y: c }];
    dir = null;
    dirQueue = [];
    growPending = 0;
    eggs = [];
    score = 0;
    speed = 1;
    state = "ready";
    acc = 0;
    spawnEggs();
    el.start.classList.remove("hidden");
    el.dead.classList.add("hidden");
    updateHud();
  }

  function updateHud() {
    el.score.textContent = score;
    el.best.textContent = best;
    el.len.textContent = snake.length;
    el.spd.textContent = speed.toFixed(2) + "x";
  }

  // ---- 蛋 ----
  function randomEggType() {
    let r = Math.random() * 100;
    for (const t of EGG_TYPES) {
      if (r < t.weight) return t;
      r -= t.weight;
    }
    return EGG_TYPES[0];
  }

  function spawnEggs() {
    const target = 1 + Math.floor(Math.random() * 3); // 1~3 顆
    const occupied = new Set(snake.map(s => s.x + "," + s.y));
    for (const e of eggs) occupied.add(e.x + "," + e.y);
    while (eggs.length < target) {
      const free = [];
      for (let y = 0; y < GRID; y++)
        for (let x = 0; x < GRID; x++)
          if (!occupied.has(x + "," + y)) free.push({ x, y });
      if (!free.length) return;
      const cell = free[Math.floor(Math.random() * free.length)];
      occupied.add(cell.x + "," + cell.y);
      eggs.push({ x: cell.x, y: cell.y, type: randomEggType() });
    }
  }

  // ---- 遊戲邏輯 ----
  function die() {
    state = "dead";
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, best);
    }
    el.deadStats.textContent = `本局分數 ${score}　最高分 ${best}`;
    el.dead.classList.remove("hidden");
    updateHud();
  }

  function nextDir() {
    // 從緩衝取出下一個有效方向(長度 >= 2 禁止 180 度回頭)
    while (dirQueue.length) {
      const d = dirQueue.shift();
      if (snake.length >= 2 && dir && d.x === -dir.x && d.y === -dir.y) continue;
      if (dir && d.x === dir.x && d.y === dir.y) continue;
      return d;
    }
    return dir;
  }

  function hitsWall(p) {
    return p.x < 0 || p.x >= GRID || p.y < 0 || p.y >= GRID;
  }

  function hitsSelf(head) {
    // 尾巴這一步若會移走,不算碰撞
    const checkLen = growPending === 0 ? snake.length - 1 : snake.length;
    for (let i = 0; i < checkLen; i++)
      if (snake[i].x === head.x && snake[i].y === head.y) return true;
    return false;
  }

  function eatEggAt(head) {
    const idx = eggs.findIndex(e => e.x === head.x && e.y === head.y);
    if (idx === -1) return;
    const egg = eggs[idx];
    eggs.splice(idx, 1);
    score++;
    egg.type.apply();
    spawnEggs();
  }

  function step() {
    dir = nextDir();
    if (!dir) return;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (hitsWall(head) || hitsSelf(head)) return die();

    snake.unshift(head);
    if (growPending > 0) growPending--;
    else snake.pop();

    eatEggAt(head);
    updateHud();
  }

  // ---- 繪圖 ----
  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
    }
  }

  function drawEggs() {
    for (const e of eggs) {
      ctx.fillStyle = e.type.color;
      ctx.beginPath();
      ctx.arc(e.x * CELL + CELL / 2, e.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      ctx.fillStyle = i === 0 ? "#ffffff" : "#7ee787";
      const pad = i === 0 ? 2 : 3;
      ctx.beginPath();
      ctx.roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawEggs();
    drawSnake();
  }

  // ---- 主迴圈 ----
  function loop(t) {
    if (lastTime === undefined) lastTime = t;
    const dt = t - lastTime;
    lastTime = t;
    if (state === "running") {
      acc += dt;
      const interval = BASE_INTERVAL / speed;
      let steps = 0;
      while (acc >= interval && steps < MAX_STEPS_PER_FRAME && state === "running") {
        acc -= interval;
        step();
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ---- 輸入 ----
  document.addEventListener("keydown", (ev) => {
    if (state === "dead") {
      if (ev.key === "Enter") reset();
      return;
    }
    const d = KEY_DIRS[ev.code];
    if (!d) return;
    ev.preventDefault();
    if (state === "ready") {
      state = "running";
      el.start.classList.add("hidden");
    }
    if (dirQueue.length < DIR_QUEUE_MAX) dirQueue.push(d);
  });

  reset();
  requestAnimationFrame(loop);
})();
