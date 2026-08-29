// ---- 棋盤資料:蛇、蛋、碰撞 ----
const GRID = 28;

// 每種蛋自描述:顏色、權重、效果。效果只透過 fx 能力介面作用,
// 拿不到遊戲內部資料 —— 拿得到的,就是可以用的。
const EGG_TYPES = [
  { key: "grow",   color: "#3fb950", weight: 55, apply: (fx) => fx.grow() },
  { key: "shrink", color: "#f85149", weight: 15, apply: (fx) => fx.shrink() },
  { key: "fast",   color: "#f2cc60", weight: 15, apply: (fx) => fx.faster() },
  { key: "slow",   color: "#58a6ff", weight: 15, apply: (fx) => fx.slower() },
];

function randomEggType() {
  let r = Math.random() * 100;
  for (const t of EGG_TYPES) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return EGG_TYPES[0];
}

function createBoard() {
  const c = Math.floor(GRID / 2);
  const board = { snake: [{ x: c, y: c }], eggs: [] };
  spawnEggs(board);
  return board;
}

function spawnEggs(board) {
  const target = 1 + Math.floor(Math.random() * 3); // 1~3 顆
  const occupied = new Set(board.snake.map(s => s.x + "," + s.y));
  for (const e of board.eggs) occupied.add(e.x + "," + e.y);
  while (board.eggs.length < target) {
    const free = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (!occupied.has(x + "," + y)) free.push({ x, y });
    if (!free.length) return;
    const cell = free[Math.floor(Math.random() * free.length)];
    occupied.add(cell.x + "," + cell.y);
    board.eggs.push({ x: cell.x, y: cell.y, type: randomEggType() });
  }
}

function hitsWall(p) {
  return p.x < 0 || p.x >= GRID || p.y < 0 || p.y >= GRID;
}

function hitsSelf(snake, head, growPending) {
  // 尾巴這一步若會移走,不算碰撞
  const checkLen = growPending === 0 ? snake.length - 1 : snake.length;
  for (let i = 0; i < checkLen; i++)
    if (snake[i].x === head.x && snake[i].y === head.y) return true;
  return false;
}
