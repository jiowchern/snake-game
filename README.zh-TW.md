# 🐍 貪吃蛇(Snake Game)—— 同一個遊戲,兩種狀態管理技術

[English](README.md) | **繁體中文**

> 純原生 HTML5 Canvas + JavaScript,零依賴、零建置。
> 兩個版本玩法完全相同,差別只在**程式如何管理「ready → running → dead」這件事**。

```
classic/        原版:單一 IIFE,一個 state 字串變數 + if/else 分支
state-machine/  重構版:事件驅動狀態機,操作方法長在狀態物件上
```

進入任一資料夾雙擊 `index.html` 即玩。各版本的實作細節見其目錄內的 README:

- [classic/README.zh-TW.md](classic/README.zh-TW.md) —— 狀態變數版的完整解說
- [state-machine/README.zh-TW.md](state-machine/README.zh-TW.md) —— 狀態機版的完整解說

---

## 技術差異對照

| 面向 | classic | state-machine |
|------|---------|---------------|
| 狀態表示 | `state` 字串(`"ready"` / `"running"` / `"dead"`) | 三個類別:`ReadyState` / `RunningState` / `DeadState` |
| 狀態切換 | 散在各處直接賦值:`keydown` 裡 `state = "running"`、`die()` 裡 `state = "dead"` | 狀態只丟事件(`startEvent` / `diedEvent` / `restartEvent`),由擁有者 `Game` 的 `#toXxx` 方法決定去哪 |
| 操作合法性 | 執行期分支把關:`if (state === "dead")` 才理 Enter | 結構把關:`restart()` 只存在於 `DeadState`,錯誤狀態下根本拿不到這個方法 |
| 外界如何得知狀態 | 直接讀 `state` 變數 | 不可查詢;訂閱 `Notifier`,supply 時拿到當前狀態的能力介面、unsupply 時放掉 |
| 一局資料的生命週期 | 全域變數 + `reset()` 一口氣重設 9 個 | 全是 `RunningState` 的欄位,每局 new 新實例,建構子保證乾淨初值(`reset()` 不存在) |
| 蛋效果 | 閉包直接改寫全域 `speed` / `growPending` / `snake` | 只收窄介面 `fx.grow()/shrink()/faster()/slower()`,拿不到其他資料 |
| 檔案結構 | 1 個 JS 檔,約 220 行 | 6 個 JS 檔,約 500 行(含約 100 行可重用的 StateMachine + Notifier 核心) |

## 差異的本質

兩版的遊戲邏輯(固定時間步長、方向緩衝、尾巴讓位、蛋掉落表)一字不差,分歧點只有一個問題的答案:**「現在是什麼狀態」由誰知道、怎麼用?**

**classic 版的答案是「一個大家都看得到的變數」。** 主迴圈每幀檢查它決定要不要推進邏輯,鍵盤監聽器檢查它決定按鍵的意義,`die()` 和 `reset()` 賦值改變它。優點是直觀、程式最短;代價是狀態的「檢查」與「改寫」散落在持續執行的路徑裡,每加一種狀態或一種操作,所有分支點都要重新對一次——忘了哪一處,就是「死了還能轉向」這類執行期才爆的 bug。一局的資料也因為是全域變數,重開時得靠 `reset()` 手動逐一歸零,漏一個就是殘留值 bug。

**state-machine 版的答案是「沒有人知道,也不需要知道」。** 消費者(鍵盤監聽器)手上只有「當前狀態供應的能力介面」:Ready 期間拿到的介面只有 `press()`,死亡瞬間介面被收回、換成只有 `restart()` 的新介面。非法操作從「執行期被 if 擋下」變成「編不出那行呼叫」。轉移圖則是擁有者的私有知識:狀態自己偵測「該離場了」就丟事件,`Game` 的三個 `#toXxx` 方法就是整張轉移表,要改流程只動這一處。代價是概念與檔案數變多——對三個狀態的小遊戲屬於殺雞用牛刀,但狀態一多、或出現巢狀狀態(例如 running 底下再分 normal/invincible)時,這套結構的擴充成本幾乎不變,而 classic 式分支會組合爆炸。

一句話總結:**classic 把狀態當資料,靠紀律維護一致性;state-machine 把狀態當物件,靠結構讓不一致無法表達。**

## 通用調校參數

| 參數 | classic 位置 | state-machine 位置 | 效果 |
|------|------|------|------|
| `BASE_INTERVAL` | js/game.js | js/states.js | 基準步進間隔(ms),越小越快 |
| `GRID` / `CELL` | js/game.js | js/board.js / js/render.js | 棋盤格數 / 每格像素 |
| `DIR_QUEUE_MAX` | js/game.js | js/states.js | 方向緩衝深度 |
| `EGG_TYPES[].weight` | js/game.js | js/board.js | 各蛋種出現機率 |
| `:root` CSS 變數 | css/style.css | css/style.css | 整體配色 |
