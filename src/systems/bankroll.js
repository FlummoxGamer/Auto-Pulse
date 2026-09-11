import { CONFIG } from '../core/config.js';
import { sendDiscordMessage, parseBalance, sleep } from '../core/utils.js';

export const stats = {
  hunt: 0, battle: 0,
  cfWins: 0, cfTotal: 0,
  owo: 0,
  runtimeSeconds: 0
};

export const bankroll = {
  sessionStart: null,
  sessionBudget: null,
  sessionProfit: 0,
  sessionLoss: 0,
  profitTarget: null,

  async init() {
    await sendDiscordMessage('owo cash', 'bankroll', true);
    await sleep(3000);
    const chat = document.querySelector('ol[class*="scroller"]');
    const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
    const lastMsg = msgs[msgs.length - 1];
    const bal = lastMsg ? parseBalance(lastMsg.innerText) : null;
    if (bal !== null) {
      this.sessionStart = bal;
      this.sessionBudget = Math.round(bal * CONFIG.BANKROLL_PERCENT);
      this.profitTarget = Math.round(bal * CONFIG.PROFIT_TARGET_PERCENT);
      stats.owo = bal;
    }
  },

  reset() {
    this.sessionStart = null;
    this.sessionBudget = null;
    this.sessionProfit = 0;
    this.sessionLoss = 0;
    this.profitTarget = null;
  },

  isOverBudget() { return this.sessionLoss > this.sessionBudget; },
  isProfitTargetHit() { return this.sessionProfit >= this.profitTarget; },
  addProfit(a) { this.sessionProfit += a; },
  addLoss(a) { this.sessionLoss += a; }
};

export function resetCF() {
  stats.cfWins = 0;
  stats.cfTotal = 0;
}
