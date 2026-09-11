import { CONFIG, FIBONACCI } from '../core/config.js';
import { sendDiscordMessage, sleep, getHumanDelay, emitTracker } from '../core/utils.js';
import { stats } from '../systems/bankroll.js';

let fibIndex = 0;
let history = [];

function predictSide() {
  if (history.length < 3) return 'h';
  const heads = history.filter(x => x === 'heads').length;
  const tails = history.length - heads;
  if (heads > tails) return 't';
  if (tails > heads) return 'h';
  return Math.random() < 0.5 ? 'h' : 't';
}

export async function playCoinflip() {
  const bet = Math.min(CONFIG.CF_BASE_BET * FIBONACCI[fibIndex], CONFIG.CF_MAX_BET);
  const side = predictSide();
  await sendDiscordMessage(`owo cf ${bet} ${side}`, 'coinflip');
  await sleep(getHumanDelay(5000, 7000));

  const chat = document.querySelector('ol[class*="scroller"]');
  const msgs = chat ? chat.querySelectorAll('li[class*="message"]') : [];
  let cfMsg = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].innerText.toLowerCase().includes("spins")) {
      cfMsg = msgs[i];
      break;
    }
  }
  if (!cfMsg) return;

  const text = cfMsg.innerText.toLowerCase();

  // CF win/loss + balance tracking
  stats.cfTotal++;
  if (text.includes('won')) {
    stats.cfWins++;
    stats.owo += bet; // net gain = bet
    fibIndex = 0;
  } else if (text.includes('lost')) {
    stats.owo -= bet;
    fibIndex = Math.min(fibIndex + 1, FIBONACCI.length - 1);
  }
  emitTracker(stats);

  if (text.includes('heads')) history.push('heads');
  else history.push('tails');
  if (history.length > 10) history.shift();
}
