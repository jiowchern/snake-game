// ---- 三個遊戲狀態 ----
// 每個狀態:
//   - 能力方法只存在於對應狀態上(錯誤狀態呼叫錯誤方法 → 根本拿不到介面)
//   - 不知道下一個狀態是誰,只對外丟事件,由擁有者(Game)決定去哪
//   - enable() / disable() / update(dt) 是狀態機專用的生命週期

const BASE_INTERVAL = 140; // ms per step at 1.00x
const MAX_STEPS_PER_FRAME = 30;
const DIR_QUEUE_MAX = 3;

// 等待開局:顯示開始覆蓋層,收到第一個方向鍵即丟出 startEvent。
class ReadyState {
  startEvent = () => {};

  #board;
  #renderer;
  #overlay;
  #hud;

  constructor(board, renderer, overlay, hud) {
    this.#board = board;
    this.#renderer = renderer;
    this.#overlay = overlay;
    this.#hud = hud;
  }

  // -- 能力 --
  press(dir) {
    this.startEvent({ board: this.#board, dir });
  }

  // -- 生命週期 --
  enable() {
    this.#overlay.show();
    this.#hud.set({ score: 0, len: this.#board.snake.length, speed: 1 });
  }

  disable() {
    this.#overlay.hide();
  }

  update() {
    this.#renderer.draw(this.#board);
  }
}

// 進行中:固定時間步長推進,撞牆/撞自己時丟出 diedEvent。
// 所有局內資料(方向緩衝、成長額度、分數、速度、時間累積)都是
// 本實例的新欄位 —— 建構子保證乾淨初值,不存在殘留欄位。
class RunningState {
  diedEvent = () => {};

  #board;
  #dir = null;
  #dirQueue = [];
  #growPending = 0;
  #score = 0;
  #speed = 1;
  #acc = 0;
  #renderer;
  #hud;
  #fx; // 蛋效果的能力介面:蛋只拿得到這四件事

  constructor(board, firstDir, renderer, hud) {
    this.#board = board;
    this.#renderer = renderer;
    this.#hud = hud;
    this.#dirQueue.push(firstDir);
    this.#fx = {
      grow: () => { this.#growPending++; },
      shrink: () => {
        if (this.#board.snake.length > 1) this.#board.snake.pop();
        this.#growPending = 0;
      },
      faster: () => { this.#speed *= 1.25; },
      slower: () => { this.#speed *= 0.8; },
    };
  }

  // -- 能力 --
  queueDirection(d) {
    if (this.#dirQueue.length < DIR_QUEUE_MAX) this.#dirQueue.push(d);
  }

  // -- 生命週期 --
  enable() {
    this.#updateHud();
  }

  disable() {}

  update(dt) {
    this.#acc += dt;
    const interval = BASE_INTERVAL / this.#speed;
    let steps = 0;
    let dead = false;
    while (this.#acc >= interval && steps < MAX_STEPS_PER_FRAME && !dead) {
      this.#acc -= interval;
      dead = !this.#step();
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.#acc = 0;
    this.#renderer.draw(this.#board);
    // 事件只從 update 發出:轉換永遠發生在主迴圈的同步時間軸上
    if (dead) this.diedEvent({ board: this.#board, score: this.#score });
  }

  // -- 內部邏輯 --
  #step() {
    const snake = this.#board.snake;
    this.#dir = this.#nextDir();
    if (!this.#dir) return true;

    const head = { x: snake[0].x + this.#dir.x, y: snake[0].y + this.#dir.y };
    if (hitsWall(head) || hitsSelf(snake, head, this.#growPending)) return false;

    snake.unshift(head);
    if (this.#growPending > 0) this.#growPending--;
    else snake.pop();

    this.#eatEggAt(head);
    this.#updateHud();
    return true;
  }

  #nextDir() {
    // 從緩衝取出下一個有效方向(長度 >= 2 禁止 180 度回頭)
    const snake = this.#board.snake;
    while (this.#dirQueue.length) {
      const d = this.#dirQueue.shift();
      if (snake.length >= 2 && this.#dir && d.x === -this.#dir.x && d.y === -this.#dir.y) continue;
      if (this.#dir && d.x === this.#dir.x && d.y === this.#dir.y) continue;
      return d;
    }
    return this.#dir;
  }

  #eatEggAt(head) {
    const eggs = this.#board.eggs;
    const idx = eggs.findIndex(e => e.x === head.x && e.y === head.y);
    if (idx === -1) return;
    const egg = eggs[idx];
    eggs.splice(idx, 1);
    this.#score++;
    egg.type.apply(this.#fx);
    spawnEggs(this.#board);
  }

  #updateHud() {
    this.#hud.set({ score: this.#score, len: this.#board.snake.length, speed: this.#speed });
  }
}

// 結束畫面:凍結最後盤面持續重繪,收到 restart 即丟出 restartEvent。
class DeadState {
  restartEvent = () => {};

  #board;
  #statsText;
  #renderer;
  #overlay;

  constructor(board, statsText, renderer, overlay) {
    this.#board = board;
    this.#statsText = statsText;
    this.#renderer = renderer;
    this.#overlay = overlay;
  }

  // -- 能力 --
  restart() {
    this.restartEvent();
  }

  // -- 生命週期 --
  enable() {
    this.#overlay.show(this.#statsText);
  }

  disable() {
    this.#overlay.hide();
  }

  update() {
    this.#renderer.draw(this.#board);
  }
}
