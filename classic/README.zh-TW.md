# 🐍 貪吃蛇 —— Classic 版(單檔 IIFE + 狀態變數)

[English](README.md) | **繁體中文**

> 純原生 HTML5 Canvas + JavaScript 實作,零依賴、零建置,雙擊 `index.html` 即玩。
> 全部邏輯集中在一個 `state` 字串變數與一份約 220 行的 `game.js`。另一種寫法見 [state-machine 版](../state-machine/README.zh-TW.md),兩者差異見[根目錄 README](../README.zh-TW.md)。

| | |
|---|---|
| **操作** | 方向鍵 / WASD 移動,Enter 重新開始 |
| **棋盤** | 28 × 28 格 |
| **目標** | 吃蛋得分,別撞牆、別咬到自己 |
| **技術** | Canvas 2D、requestAnimationFrame、localStorage |

四種蛋(場上隨時 1~3 顆,吃到皆 +1 分):
🟢 加長(55%)　🔴 減短(15%)　🟡 加速 ×1.25(15%)　🔵 減速 ×0.8(15%)

---

## 架構總覽

```
index.html ──── 版面:HUD 計分板、<canvas>、開始/結束覆蓋層、圖例
css/style.css ─ 深色主題(GitHub Dark 風格),配色集中於 CSS 變數
js/game.js ──── 遊戲本體,單一 IIFE,約 220 行
```

`game.js` 內部的資料流向:

```
鍵盤輸入 ──► dirQueue(方向緩衝,≤3)
                  │ 每步取一個有效方向
                  ▼
requestAnimationFrame ──► loop(固定時間步長)──► step(遊戲邏輯)
                  │                                │
                  ▼                                ▼
               draw(每幀重繪)              snake / eggs / score(狀態)
```

## 核心機制解析

### 狀態機:三種遊戲狀態

```
ready ──按方向鍵──► running ──撞牆/撞自己──► dead ──Enter──► ready
```

`state` 變數只有三種值,切換點各自集中在一處:

- **`ready` → `running`**:發生在 `keydown` 監聽器裡。遊戲載入(或重置)後停在 `ready`,主迴圈照常跑但 `step()` 不會被執行;當玩家按下**第一個方向鍵**,監聽器把 `state` 改為 `"running"` 並隱藏開始覆蓋層,下一幀起主迴圈就開始累積時間、推進邏輯。

  ```js
  if (state === "ready") {
    state = "running";
    el.start.classList.add("hidden");
  }
  ```

- **`running` → `dead`**:發生在 `step()` 內。每步算出新蛇頭後,若 `hitsWall()` 或 `hitsSelf()` 判定碰撞,呼叫 `die()`——它把 `state` 設為 `"dead"`、更新最高分並寫入 `localStorage`、顯示結束覆蓋層。主迴圈的 `while` 條件包含 `state === "running"`,所以死亡當幀立即停止補步。

- **`dead` → `ready`**:回到 `keydown` 監聽器。`dead` 狀態下只接受 **Enter**,其餘按鍵一律忽略;按下後呼叫 `reset()` 重建所有狀態(蛇回到中央、清空方向緩衝、重生蛋、`state = "ready"`),等待下一次方向鍵開局。

  ```js
  if (state === "dead") {
    if (ev.key === "Enter") reset();
    return;
  }
  ```

值得注意的是:主迴圈 `loop()` 從不停止——三種狀態下它都持續執行並每幀重繪,`state` 只決定「要不要推進遊戲邏輯」。開始/結束畫面也不是畫在 canvas 上,而是覆蓋其上的 DOM 元素,用 CSS class 切換顯示。

### 蛇的資料結構:座標陣列 + 頭尾操作

蛇是 `[{x, y}, ...]`,`snake[0]` 為頭。每步:

```js
snake.unshift(head);           // 新蛇頭插入開頭
if (growPending > 0) growPending--;
else snake.pop();              // 沒有成長額度 → 蛇尾移除
```

「移動」只碰陣列頭尾兩端,「變長」則是暫時不砍尾。`O(1)` 的優雅解法,不需要移動整條蛇。

### 主迴圈:固定時間步長(Fixed Timestep)

```js
acc += dt;                               // 累積真實流逝時間
while (acc >= BASE_INTERVAL / speed) {   // 每滿一個間隔
  acc -= interval;
  step();                                // 推進一步邏輯
}
draw();                                  // 但畫面每幀都重繪
```

**邏輯頻率與畫面頻率分離**:60Hz 與 144Hz 螢幕上蛇速一致;加減速蛋只需改 `speed` 倍率。另設 `MAX_STEPS_PER_FRAME = 30` 防止分頁閒置後回來瞬間狂補步數。

### 方向緩衝:快速連按不誤死

按鍵不直接改方向,而是進入 `dirQueue` 佇列(上限 3),每步僅消化一個,且過濾兩類無效輸入:

- **180 度回頭**(長度 ≥ 2 時)——避免一步內連按兩鍵造成「原地反轉」自撞
- **與目前方向相同**——不浪費緩衝空位

### 碰撞判定:尾巴讓位規則

```js
const checkLen = growPending === 0 ? snake.length - 1 : snake.length;
```

若這一步蛇尾將移走,蛇頭走進「原尾巴格」不算碰撞——緊追自己尾巴是合法走位,符合經典規則。

### 蛋系統:資料驅動的掉落表

```js
const EGG_TYPES = [
  { key: "grow",   color: "#3fb950", weight: 55, apply: () => { growPending++; } },
  { key: "shrink", color: "#f85149", weight: 15, apply: () => { ... } },
  ...
];
```

每種蛋自描述:顏色、權重、效果函式。`randomEggType()` 依權重輪盤抽選;`spawnEggs()` 先收集蛇身與現存蛋的占用格,只從空格中生成,保證不重疊。**擴充新蛋種 = 在表中加一筆資料**,其餘邏輯零改動。

### 繪圖:每幀全量重繪

`draw()` 依序:清空畫布 → 半透明格線 → 蛋(圓形)→ 蛇(圓角方塊,蛇頭白色、蛇身綠色)。棋盤僅 28×28,全量重繪毫無壓力,程式碼卻簡單得多。

### 最高分:localStorage 持久化

死亡時若破紀錄即寫入 `localStorage`(鍵名 `snake.best`),跨瀏覽器工作階段保留。

## 常見調校參數

| 參數 | 位置 | 效果 |
|------|------|------|
| `BASE_INTERVAL` | game.js | 基準步進間隔(ms),越小越快 |
| `GRID` / `CELL` | game.js | 棋盤格數 / 每格像素(canvas 尺寸 = GRID × CELL) |
| `DIR_QUEUE_MAX` | game.js | 方向緩衝深度 |
| `EGG_TYPES[].weight` | game.js | 各蛋種出現機率 |
| `:root` CSS 變數 | style.css | 整體配色 |
