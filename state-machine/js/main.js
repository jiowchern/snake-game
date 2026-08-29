// ---- 進入點:組裝 DOM 依賴、輸入消費者、主迴圈 ----
(() => {
  const KEY_DIRS = {
    ArrowUp: { x: 0, y: -1 },   KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },  KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
  };

  const el = {
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    len: document.getElementById("len"),
    spd: document.getElementById("spd"),
    start: document.getElementById("startOverlay"),
    dead: document.getElementById("deadOverlay"),
    deadStats: document.getElementById("deadStats"),
  };

  const hud = {
    set: ({ score, len, speed }) => {
      el.score.textContent = score;
      el.len.textContent = len;
      el.spd.textContent = speed.toFixed(2) + "x";
    },
    setBest: (b) => { el.best.textContent = b; },
  };

  const overlays = {
    start: {
      show: () => el.start.classList.remove("hidden"),
      hide: () => el.start.classList.add("hidden"),
    },
    dead: {
      show: (statsText) => {
        el.deadStats.textContent = statsText;
        el.dead.classList.remove("hidden");
      },
      hide: () => el.dead.classList.add("hidden"),
    },
  };

  const game = new Game(new Renderer(document.getElementById("game")), hud, overlays);

  // ---- 輸入(消費者)----
  // 不查詢遊戲狀態:只在供應期間持有能力介面,unsupply 時放掉。
  // 拿得到哪個介面,就代表現在能做哪些事。
  let iReady = null, iRunning = null, iDead = null;
  game.readyStates.subscribe(c => { iReady = c; }, () => { iReady = null; });
  game.runningStates.subscribe(c => { iRunning = c; }, () => { iRunning = null; });
  game.deadStates.subscribe(c => { iDead = c; }, () => { iDead = null; });

  document.addEventListener("keydown", (ev) => {
    if (iDead) {
      if (ev.key === "Enter") iDead.restart();
      return;
    }
    const d = KEY_DIRS[ev.code];
    if (!d) return;
    ev.preventDefault();
    if (iReady) iReady.press(d);
    else if (iRunning) iRunning.queueDirection(d);
  });

  // ---- 主迴圈:永不停止,每幀轉發給當前狀態 ----
  game.start();
  let lastTime;
  function loop(t) {
    if (lastTime === undefined) lastTime = t;
    const dt = t - lastTime;
    lastTime = t;
    game.update(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
