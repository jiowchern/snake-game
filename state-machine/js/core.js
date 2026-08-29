// ---- 核心模組:最小狀態機 + 供應通知器 ----
// 狀態機只做一件事:Change 時交接(舊 disable → 換人 → 新 enable),其餘一概不管。
// 狀態物件需實作:enable() / disable() / update(dt)。

class StateMachine {
  #current = null;

  change(next) {
    if (this.#current) this.#current.disable();
    this.#current = next;
    if (next) next.enable();
  }

  update(dt) {
    if (this.#current) this.#current.update(dt);
  }

  empty() {
    this.change(null);
  }
}

// Depot 式供應通知器:
// (a) 訂閱時若已有供應,立即補發(catch-up)
// (b) 離開時必有 unsupply 通知(確定的清理時機)
// (c) 消費者只在 supply ~ unsupply 之間持有能力介面 —— 持有即存活
class Notifier {
  #subscribers = new Set();
  #current = null;

  supply(capability) {
    this.#current = capability;
    for (const s of this.#subscribers) s.onSupply(capability);
  }

  unsupply() {
    if (this.#current === null) return;
    const c = this.#current;
    this.#current = null;
    for (const s of this.#subscribers) s.onUnsupply(c);
  }

  subscribe(onSupply, onUnsupply) {
    const sub = { onSupply, onUnsupply };
    this.#subscribers.add(sub);
    if (this.#current !== null) onSupply(this.#current);
    return () => this.#subscribers.delete(sub);
  }
}
