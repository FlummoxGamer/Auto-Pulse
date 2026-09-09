import { CONFIG } from './config.js';
import { sendDiscordMessage, parseBalance, sleep } from './utils.js';

export const bankroll = {
  sessionStart: null,
  sessionBudget: null,
  sessionProfit: 0,
  sessionLoss: 0,
  profitTarget: null,

  async init() {
    await sendDiscordMessage('owo bal');
    await sleep(3000);
    const chat = document.querySelector('ol[class*="scroller"]');
    const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
    const lastMsg = msgs[msgs.length - 1];
    const bal = lastMsg ? parseBalance(lastMsg.innerText) : null;
    if (bal !== null) {
      this.sessionStart = bal;
      this.sessionBudget = Math.round(bal * CONFIG.BANKROLL_PERCENT);
      this.profitTarget = bal * CONFIG.PROFIT_TARGET_PERCENT;
      console.log(`[Bankroll] Start: ${bal}, Budget: ${this.sessionBudget}, Target: ${this.profitTarget}`);
    }
  },

  reset() {
    this.sessionStart = null;
    this.sessionBudget = null;
    this.sessionProfit = 0;
    this.sessionLoss = 0;
    this.profitTarget = null;
  },

  isOverBudget() {
    return this.sessionLoss > this.sessionBudget;
  },

  isProfitTargetHit() {
    return this.sessionProfit >= this.profitTarget;
  },

  addProfit(amount) { this.sessionProfit += amount; },
  addLoss(amount) { this.sessionLoss += amount; }
};
