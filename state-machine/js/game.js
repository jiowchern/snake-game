// ---- 擁有者:Game ----
// 持有原料(繪圖器、HUD、覆蓋層、最高分儲存)。
// 轉移表 = #toXxx 方法集合:狀態只丟事件,這裡負責組裝下一個狀態並接線。
// 外界不查詢狀態,只透過三個 Notifier 取得當前狀態的能力介面。

const BEST_KEY = "snake.best";

class Game {
  readyStates = new Notifier();
  runningStates = new Notifier();
  deadStates = new Notifier();

  #machine = new StateMachine();
  #activeNotifier = null;
  #renderer;
  #hud;
  #overlays;
  #best;

  constructor(renderer, hud, overlays) {
    this.#renderer = renderer;
    this.#hud = hud;
    this.#overlays = overlays;
    this.#best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.#hud.setBest(this.#best);
  }

  start() {
    this.#toReady();
  }

  update(dt) {
    this.#machine.update(dt);
  }

  // 交接:先收回外界持有的舊能力,再換狀態,再供應新能力
  #change(state, notifier, capability) {
    if (this.#activeNotifier) this.#activeNotifier.unsupply();
    this.#machine.change(state);
    this.#activeNotifier = notifier;
    notifier.supply(capability);
  }

  #toReady() {
    const s = new ReadyState(createBoard(), this.#renderer, this.#overlays.start, this.#hud);
    s.startEvent = ({ board, dir }) => this.#toRunning(board, dir);
    this.#change(s, this.readyStates, { press: (d) => s.press(d) });
  }

  #toRunning(board, firstDir) {
    const s = new RunningState(board, firstDir, this.#renderer, this.#hud);
    s.diedEvent = ({ board, score }) => this.#toDead(board, score);
    this.#change(s, this.runningStates, { queueDirection: (d) => s.queueDirection(d) });
  }

  #toDead(board, score) {
    // 最高分持久化是擁有者消化 died 事件的後果,不屬於任何狀態
    if (score > this.#best) {
      this.#best = score;
      localStorage.setItem(BEST_KEY, this.#best);
      this.#hud.setBest(this.#best);
    }
    const s = new DeadState(board, `本局分數 ${score}　最高分 ${this.#best}`, this.#renderer, this.#overlays.dead);
    s.restartEvent = () => this.#toReady();
    this.#change(s, this.deadStates, { restart: () => s.restart() });
  }
}
