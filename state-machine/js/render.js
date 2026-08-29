// ---- 繪圖:每幀全量重繪 ----
const CELL = 24;

class Renderer {
  #canvas;
  #ctx;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
  }

  draw(board) {
    const ctx = this.#ctx;
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#drawGrid();
    this.#drawEggs(board.eggs);
    this.#drawSnake(board.snake);
  }

  #drawGrid() {
    const ctx = this.#ctx;
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, this.#canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(this.#canvas.width, i * CELL); ctx.stroke();
    }
  }

  #drawEggs(eggs) {
    const ctx = this.#ctx;
    for (const e of eggs) {
      ctx.fillStyle = e.type.color;
      ctx.beginPath();
      ctx.arc(e.x * CELL + CELL / 2, e.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  #drawSnake(snake) {
    const ctx = this.#ctx;
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      ctx.fillStyle = i === 0 ? "#ffffff" : "#7ee787";
      const pad = i === 0 ? 2 : 3;
      ctx.beginPath();
      ctx.roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
      ctx.fill();
    }
  }
}
