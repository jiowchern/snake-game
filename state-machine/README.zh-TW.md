# 🐍 貪吃蛇 —— State Machine 版(事件驅動狀態機)

[English](README.md) | **繁體中文**

> 純原生 HTML5 Canvas + JavaScript 實作,零依賴、零建置,雙擊 `index.html` 即玩。
> 沒有 `state` 變數:三個狀態類別 + 事件驅動轉移。原始寫法見 [classic 版](../classic/README.zh-TW.md),兩者差異見[根目錄 README](../README.zh-TW.md)。

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
js/core.js ──── StateMachine(最小狀態機)+ Notifier(供應通知器)
js/board.js ─── 棋盤資料:蛇、蛋(掉落表)、碰撞判定
js/render.js ── Renderer:每幀全量重繪
js/states.js ── 三個遊戲狀態:ReadyState / RunningState / DeadState
js/game.js ──── 擁有者 Game:持有原料、以 #toXxx 方法接線轉移
js/main.js ──── 進入點:組裝 DOM 依賴、鍵盤輸入消費者、主迴圈
```

以傳統 `<script>` 依序載入(非 ES modules),維持零建置、雙擊即玩。

## 核心機制解析

### 狀態機:操作長在狀態上,轉移靠事件

```
ReadyState ──startEvent──► RunningState ──diedEvent──► DeadState ──restartEvent──► ReadyState
```

沒有 `state` 變數,也沒有 `GetState()` 可查詢。三種遊戲狀態各是一個類別,實作 `enable()` / `disable()` / `update(dt)` 生命週期,由 `core.js` 的 `StateMachine` 在 `change()` 時交接(舊 disable → 新 enable)。

- **操作方法只存在於對應狀態上**:`press()` 只在 `ReadyState`、`queueDirection()` 只在 `RunningState`、`restart()` 只在 `DeadState`。「錯誤狀態下呼叫錯誤方法」在結構上不可能發生。
- **狀態不知道下一個狀態是誰**,只對外丟事件(`startEvent` / `diedEvent` / `restartEvent`)。轉移表就是 `Game` 的三個 `#toXxx` 方法:負責 `new` 出下一個狀態、注入它需要的窄依賴、接上事件。例如最高分寫入 `localStorage` 是 `#toDead()` 消化 `diedEvent` 的後果,不屬於任何狀態。
- **外界靠供應事件取得能力介面,而非查詢**:`main.js` 的鍵盤監聽器訂閱 `game.readyStates` / `runningStates` / `deadStates` 三個 `Notifier`,supply 時拿到當前狀態的能力介面、unsupply 時放掉——「手上有哪個介面」就等於「現在能做哪些事」。
- **每次轉移都是全新實例**:一局內的資料(方向緩衝、成長額度、分數、速度)全是 `RunningState` 的欄位,建構子保證乾淨初值。原本一口氣重設九個變數的 `reset()` 因此消失——不存在「殘留欄位值」這類 bug。
- **事件只從 `update()` 發出**:死亡偵測在 `RunningState.update()` 內完成當幀補步後才丟 `diedEvent`,轉移永遠發生在主迴圈的同步時間軸上。

主迴圈 `loop()` 從不停止——它只是每幀把 `dt` 轉發給當前狀態:`ReadyState` / `DeadState` 的 `update()` 純粹重繪盤面,`RunningState` 的 `update()` 才推進邏輯。開始/結束畫面不是畫在 canvas 上,而是覆蓋其上的 DOM 元素,由狀態的 `enable()` / `disable()` 切換顯示。

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
  { key: "grow",   color: "#3fb950", weight: 55, apply: (fx) => fx.grow() },
  { key: "shrink", color: "#f85149", weight: 15, apply: (fx) => fx.shrink() },
  ...
];
```

每種蛋自描述:顏色、權重、效果函式。效果只透過 `fx` 能力介面(`grow` / `shrink` / `faster` / `slower`,由 `RunningState` 提供)作用——蛋拿不到遊戲內部資料,拿得到的就是可以用的。`randomEggType()` 依權重輪盤抽選;`spawnEggs()` 先收集蛇身與現存蛋的占用格,只從空格中生成,保證不重疊。**擴充新蛋種 = 在表中加一筆資料**,其餘邏輯零改動。

### 繪圖:每幀全量重繪

`draw()` 依序:清空畫布 → 半透明格線 → 蛋(圓形)→ 蛇(圓角方塊,蛇頭白色、蛇身綠色)。棋盤僅 28×28,全量重繪毫無壓力,程式碼卻簡單得多。

### 最高分:localStorage 持久化

死亡時若破紀錄即寫入 `localStorage`(鍵名 `snake.best`),跨瀏覽器工作階段保留。

## 常見調校參數

| 參數 | 位置 | 效果 |
|------|------|------|
| `BASE_INTERVAL` | states.js | 基準步進間隔(ms),越小越快 |
| `GRID` | board.js | 棋盤格數 |
| `CELL` | render.js | 每格像素(canvas 尺寸 = GRID × CELL) |
| `DIR_QUEUE_MAX` | states.js | 方向緩衝深度 |
| `EGG_TYPES[].weight` | board.js | 各蛋種出現機率 |
| `:root` CSS 變數 | style.css | 整體配色 |
